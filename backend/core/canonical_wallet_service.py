from __future__ import annotations

import hashlib
import secrets
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from bson import ObjectId

from core.database import db


SYSTEM_WALLET_ID = "system:eur-treasury"
SYSTEM_USER_ID = "system"
DEFAULT_IDEMPOTENCY_TTL_DAYS = 30
TRANSFER_RECOVERY_STALE_SECONDS = 60
TRANSFER_DEBIT_MARKERS_FIELD = "wallet_transfer_debit_markers"
TRANSFER_CREDIT_MARKERS_FIELD = "wallet_transfer_credit_markers"


@dataclass
class WalletOperationResult:
    success: bool
    transaction_id: Optional[str] = None
    reference: Optional[str] = None
    new_balance: Optional[float] = None
    error: Optional[str] = None
    status: str = "pending"
    idempotent_replay: bool = False


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def generate_transaction_id() -> str:
    return f"TXN-{secrets.token_hex(8).upper()}"


def generate_reference(prefix: str = "BLZ") -> str:
    return f"{prefix}-{secrets.token_hex(4).upper()}"


def amount_to_minor(amount_major: float) -> int:
    return int(round(float(amount_major or 0) * 100))


def minor_to_major(amount_minor: int) -> float:
    return round((int(amount_minor or 0) / 100.0), 2)


def wallet_owner_selector(user_id: str) -> dict[str, Any]:
    return {"_id": ObjectId(user_id)} if ObjectId.is_valid(user_id) else {"_id": user_id}


def request_hash_for(operation: str, payload: dict[str, Any]) -> str:
    ordered = "|".join(f"{key}={payload[key]}" for key in sorted(payload.keys()))
    return hashlib.sha256(f"{operation}|{ordered}".encode("utf-8")).hexdigest()


async def get_canonical_balance(user_id: str) -> float:
    user = await db.users.find_one(wallet_owner_selector(user_id), {"_id": 0, "balance": 1})
    if not user:
        raise ValueError(f"User not found: {user_id}")
    return round(float(user.get("balance", 0.0) or 0.0), 2)


async def _claim_idempotency(idempotency_key: str, operation: str, request_hash: str, user_id: str) -> tuple[str, dict[str, Any] | None]:
    existing = await db.payment_idempotency.find_one({"idempotency_key": idempotency_key}, {"_id": 0})
    if existing:
        if existing.get("request_hash") != request_hash:
            return "conflict", existing
        return existing.get("status", "pending"), existing

    doc = {
        "idempotency_key": idempotency_key,
        "operation": operation,
        "request_hash": request_hash,
        "user_id": user_id,
        "status": "pending",
        "response": None,
        "created_at": now_iso(),
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=DEFAULT_IDEMPOTENCY_TTL_DAYS)).isoformat(),
    }
    try:
        await db.payment_idempotency.insert_one(doc)
        return "claimed", doc
    except Exception:
        existing = await db.payment_idempotency.find_one({"idempotency_key": idempotency_key}, {"_id": 0})
        if existing and existing.get("request_hash") != request_hash:
            return "conflict", existing
        return (existing or {}).get("status", "pending"), existing


def _existing_idempotency_result(
    claim_state: str,
    existing: dict[str, Any] | None,
) -> WalletOperationResult | None:
    """Return a terminal/replay result for every state that is not a fresh claim.

    A retry must never execute the money movement again while the original operation
    is still pending or after it already failed. Interrupted transfers are handled
    separately by the durable transfer-recovery path before this helper is called.
    """
    if claim_state == "claimed":
        return None

    response = (existing or {}).get("response") or {}
    if claim_state == "completed":
        return WalletOperationResult(
            success=True,
            transaction_id=response.get("transaction_id"),
            reference=response.get("reference"),
            new_balance=response.get("new_balance"),
            status="completed",
            idempotent_replay=True,
        )

    if claim_state == "failed":
        return WalletOperationResult(
            success=False,
            transaction_id=response.get("transaction_id"),
            reference=response.get("reference"),
            new_balance=response.get("new_balance"),
            error=response.get("error") or "Previous operation with this idempotency key failed",
            status="failed",
            idempotent_replay=True,
        )

    if claim_state == "reconciliation_required":
        return WalletOperationResult(
            success=False,
            transaction_id=response.get("transaction_id"),
            reference=response.get("reference"),
            new_balance=response.get("new_balance"),
            error=response.get("error") or "Operation requires wallet reconciliation",
            status="reconciliation_required",
            idempotent_replay=True,
        )

    if claim_state == "conflict":
        return WalletOperationResult(
            success=False,
            transaction_id=response.get("transaction_id"),
            reference=response.get("reference"),
            error="Idempotency key payload mismatch",
            status="failed",
            idempotent_replay=True,
        )

    return WalletOperationResult(
        success=False,
        transaction_id=response.get("transaction_id"),
        reference=response.get("reference"),
        new_balance=response.get("new_balance"),
        error=response.get("error") or "Operation with this idempotency key is already in progress",
        status="pending",
        idempotent_replay=True,
    )


async def _complete_idempotency(idempotency_key: str, response: dict[str, Any]) -> None:
    await db.payment_idempotency.update_one(
        {"idempotency_key": idempotency_key},
        {"$set": {"status": "completed", "response": response, "completed_at": now_iso()}},
    )


async def _fail_idempotency(idempotency_key: str, response: dict[str, Any]) -> None:
    await db.payment_idempotency.update_one(
        {"idempotency_key": idempotency_key},
        {"$set": {"status": "failed", "response": response, "failed_at": now_iso()}},
    )


async def _append_audit(action: str, user_id: str, details: dict[str, Any], status: str = "success") -> None:
    await db.audit_log.insert_one({
        "id": secrets.token_hex(8),
        "action": action,
        "user_id": user_id,
        "details": details,
        "status": status,
        "created_at": now_iso(),
    })


async def _append_audit_best_effort(action: str, user_id: str, details: dict[str, Any], status: str = "success") -> None:
    try:
        await _append_audit(action, user_id, details, status=status)
    except Exception:
        # Audit availability must never change an already-settled wallet balance.
        pass


async def _ledger_entry_count(transaction_id: str) -> int | None:
    """Return ledger rows for a transaction, or None when ledger state is unknown."""
    try:
        return int(await db.wallet_ledger_entries.count_documents({"transaction_id": transaction_id}))
    except Exception:
        return None


async def _record_failed_operation(
    *,
    transaction_ids: list[str],
    wallet_transaction_id: str | None,
    idempotency_key: str,
    transaction_id: str,
    reference: str,
    error: str,
    audit_action: str,
    audit_user_id: str,
    audit_details: dict[str, Any],
) -> WalletOperationResult:
    for tx_id in transaction_ids:
        try:
            await _set_transaction_status(tx_id, "failed", {"metadata.error": error, "metadata.compensated": True})
        except Exception:
            pass
    if wallet_transaction_id:
        try:
            await db.wallet_transactions.update_many(
                {"transaction_id": wallet_transaction_id},
                {"$set": {"status": "failed", "updated_at": now_iso(), "metadata.error": error, "metadata.compensated": True}},
            )
        except Exception:
            pass
    response = {"success": False, "transaction_id": transaction_id, "reference": reference, "error": error, "status": "failed"}
    try:
        await _fail_idempotency(idempotency_key, response)
    except Exception:
        pass
    await _append_audit_best_effort(audit_action, audit_user_id, audit_details, status="failed")
    return WalletOperationResult(success=False, transaction_id=transaction_id, reference=reference, error=error, status="failed")


async def _record_reconciliation_required(
    *,
    transaction_ids: list[str],
    wallet_transaction_id: str | None,
    idempotency_key: str,
    transaction_id: str,
    reference: str,
    error: str,
    audit_action: str,
    audit_user_id: str,
    audit_details: dict[str, Any],
) -> WalletOperationResult:
    reconciliation_error = f"{error}; wallet reconciliation required"
    for tx_id in transaction_ids:
        try:
            await _set_transaction_status(
                tx_id,
                "reconciliation_required",
                {"metadata.error": error, "metadata.reconciliation_required": True},
            )
        except Exception:
            pass
    if wallet_transaction_id:
        try:
            await db.wallet_transactions.update_many(
                {"transaction_id": wallet_transaction_id},
                {"$set": {
                    "status": "reconciliation_required",
                    "updated_at": now_iso(),
                    "metadata.error": error,
                    "metadata.reconciliation_required": True,
                }},
            )
        except Exception:
            pass
    response = {
        "success": False,
        "transaction_id": transaction_id,
        "reference": reference,
        "error": reconciliation_error,
        "status": "reconciliation_required",
    }
    try:
        await db.payment_idempotency.update_one(
            {"idempotency_key": idempotency_key},
            {"$set": {
                "status": "reconciliation_required",
                "response": response,
                "reconciliation_required_at": now_iso(),
            }},
        )
    except Exception:
        pass
    await _append_audit_best_effort(
        audit_action,
        audit_user_id,
        {**audit_details, "reconciliation_required": True},
        status="failed",
    )
    return WalletOperationResult(
        success=False,
        transaction_id=transaction_id,
        reference=reference,
        error=reconciliation_error,
        status="reconciliation_required",
    )


async def _insert_transaction_doc(
    *,
    transaction_id: str,
    idempotency_key: str,
    user_id: str,
    tx_type: str,
    amount_minor: int,
    description: str,
    reference: str,
    direction: str,
    source: str,
    metadata: dict[str, Any],
    merchant_id: str | None = None,
    merchant_name: str | None = None,
) -> None:
    amount_major = minor_to_major(amount_minor)
    now = now_iso()
    await db.transactions.insert_one({
        "id": transaction_id,
        "idempotency_key": idempotency_key,
        "user_id": user_id,
        "type": tx_type,
        "amount": -amount_major if direction == "debit" else amount_major,
        "amount_minor": amount_minor,
        "description": description,
        "reference": reference,
        "currency": "EUR",
        "direction": direction,
        "status": "pending",
        "source": source,
        "merchant_id": merchant_id,
        "merchant_name": merchant_name or "",
        "metadata": {
            **metadata,
            "transaction_id": transaction_id,
            "amount_minor": amount_minor,
            "canonical_source": "users.balance",
        },
        "created_at": now,
        "updated_at": now,
    })


async def _insert_wallet_transaction_doc(
    *,
    transaction_id: str,
    user_id: str,
    amount_minor: int,
    tx_type: str,
    status: str,
    direction: str,
    reference: str,
    idempotency_key: str,
    metadata: dict[str, Any],
) -> None:
    await db.wallet_transactions.insert_one({
        "transaction_id": transaction_id,
        "user_id": user_id,
        "amount": -minor_to_major(amount_minor) if direction == "debit" else minor_to_major(amount_minor),
        "amount_minor": amount_minor,
        "type": tx_type,
        "status": status,
        "direction": direction,
        "currency": "EUR",
        "reference": reference,
        "idempotency_key": idempotency_key,
        "metadata": metadata,
        "created_at": now_iso(),
        "updated_at": now_iso(),
    })


async def _set_transaction_status(transaction_id: str, status: str, extra: Optional[dict[str, Any]] = None) -> None:
    updates = {"status": status, "updated_at": now_iso(), "metadata.status": status}
    if extra:
        updates.update(extra)
    await db.transactions.update_one({"id": transaction_id}, {"$set": updates})
    await db.wallet_transactions.update_many({"transaction_id": transaction_id}, {"$set": {"status": status, "updated_at": now_iso()}})


async def _insert_balanced_ledger_entries(
    *,
    transaction_id: str,
    debit_wallet_id: str,
    debit_user_id: str,
    credit_wallet_id: str,
    credit_user_id: str,
    amount_minor: int,
    tx_type: str,
    status: str,
    reference: str,
    idempotency_key: str,
    metadata: dict[str, Any],
) -> list[dict[str, Any]]:
    created_at = now_iso()
    posted_at = now_iso() if status == "completed" else None
    debit_entry = {
        "entry_id": f"LED-{secrets.token_hex(8)}",
        "transaction_id": transaction_id,
        "wallet_id": debit_wallet_id,
        "user_id": debit_user_id,
        "counterparty_wallet_id": credit_wallet_id,
        "direction": "debit",
        "amount_minor": amount_minor,
        "currency": "EUR",
        "transaction_type": tx_type,
        "status": status,
        "reference": reference,
        "idempotency_key": idempotency_key,
        "created_at": created_at,
        "posted_at": posted_at,
        "reversed_by": None,
        "metadata": metadata,
        "audit_version": 1,
    }
    credit_entry = {
        "entry_id": f"LED-{secrets.token_hex(8)}",
        "transaction_id": transaction_id,
        "wallet_id": credit_wallet_id,
        "user_id": credit_user_id,
        "counterparty_wallet_id": debit_wallet_id,
        "direction": "credit",
        "amount_minor": amount_minor,
        "currency": "EUR",
        "transaction_type": tx_type,
        "status": status,
        "reference": reference,
        "idempotency_key": idempotency_key,
        "created_at": created_at,
        "posted_at": posted_at,
        "reversed_by": None,
        "metadata": metadata,
        "audit_version": 1,
    }
    if sum(entry["amount_minor"] for entry in [debit_entry] if entry["direction"] == "debit") != sum(entry["amount_minor"] for entry in [credit_entry] if entry["direction"] == "credit"):
        raise ValueError("Ledger imbalance detected")
    await db.wallet_ledger_entries.insert_many([debit_entry, credit_entry])
    return [debit_entry, credit_entry]


async def _update_user_balance(user_id: str, delta_minor: int, require_minimum_minor: int | None = None) -> bool:
    selector = wallet_owner_selector(user_id)
    if delta_minor < 0 and require_minimum_minor is not None:
        selector["balance"] = {"$gte": minor_to_major(require_minimum_minor)}
    result = await db.users.update_one(selector, {"$inc": {"balance": minor_to_major(delta_minor)}, "$set": {"last_balance_update": now_iso()}})
    return result.modified_count == 1


async def _transfer_marker_state(user_id: str, marker_field: str, transaction_id: str) -> tuple[bool, dict[str, Any] | None]:
    user = await db.users.find_one(
        wallet_owner_selector(user_id),
        {"_id": 1, "balance": 1, marker_field: 1},
    )
    if not user:
        return False, None
    markers = user.get(marker_field, []) or []
    return transaction_id in markers, user


async def _apply_transfer_balance_once(
    *,
    user_id: str,
    transaction_id: str,
    delta_minor: int,
    marker_field: str,
    require_minimum_minor: int | None = None,
) -> tuple[bool, bool]:
    selector = wallet_owner_selector(user_id)
    selector[marker_field] = {"$ne": transaction_id}
    if delta_minor < 0 and require_minimum_minor is not None:
        selector["balance"] = {"$gte": minor_to_major(require_minimum_minor)}
    result = await db.users.update_one(
        selector,
        {
            "$inc": {"balance": minor_to_major(delta_minor)},
            "$addToSet": {marker_field: transaction_id},
            "$set": {"last_balance_update": now_iso()},
        },
    )
    if result.modified_count == 1:
        return True, True
    marker_present, user = await _transfer_marker_state(user_id, marker_field, transaction_id)
    return False, marker_present if user else False


async def _reverse_transfer_balance_once(
    *,
    user_id: str,
    transaction_id: str,
    delta_minor: int,
    marker_field: str,
    require_minimum_minor: int | None = None,
) -> bool:
    selector = wallet_owner_selector(user_id)
    selector[marker_field] = transaction_id
    if delta_minor < 0 and require_minimum_minor is not None:
        selector["balance"] = {"$gte": minor_to_major(require_minimum_minor)}
    result = await db.users.update_one(
        selector,
        {
            "$inc": {"balance": minor_to_major(delta_minor)},
            "$pull": {marker_field: transaction_id},
            "$set": {"last_balance_update": now_iso()},
        },
    )
    if result.modified_count == 1:
        return True
    marker_present, user = await _transfer_marker_state(user_id, marker_field, transaction_id)
    return bool(user) and not marker_present


async def _clear_transfer_markers(from_user_id: str, to_user_id: str, transaction_id: str) -> None:
    try:
        await db.users.update_one(
            wallet_owner_selector(from_user_id),
            {"$pull": {TRANSFER_DEBIT_MARKERS_FIELD: transaction_id}},
        )
    except Exception:
        pass
    try:
        await db.users.update_one(
            wallet_owner_selector(to_user_id),
            {"$pull": {TRANSFER_CREDIT_MARKERS_FIELD: transaction_id}},
        )
    except Exception:
        pass


def _transfer_recovery_is_stale(existing: dict[str, Any]) -> bool:
    recovery = existing.get("transfer_recovery") or {}
    raw = recovery.get("updated_at") or existing.get("updated_at") or existing.get("created_at")
    if not raw:
        return False
    try:
        timestamp = datetime.fromisoformat(str(raw))
        if timestamp.tzinfo is None:
            timestamp = timestamp.replace(tzinfo=timezone.utc)
        return datetime.now(timezone.utc) - timestamp >= timedelta(seconds=TRANSFER_RECOVERY_STALE_SECONDS)
    except Exception:
        return False


async def _persist_transfer_recovery(idempotency_key: str, recovery: dict[str, Any]) -> None:
    now = now_iso()
    recovery = {**recovery, "updated_at": now}
    result = await db.payment_idempotency.update_one(
        {"idempotency_key": idempotency_key, "status": "pending"},
        {"$set": {"transfer_recovery": recovery, "updated_at": now}},
    )
    if result.modified_count != 1:
        raise RuntimeError("Could not persist transfer recovery state")


async def _ensure_transfer_documents(recovery: dict[str, Any], idempotency_key: str) -> None:
    transaction_id = recovery["transaction_id"]
    sender_tx_id = recovery["sender_tx_id"]
    recipient_tx_id = recovery["recipient_tx_id"]
    from_user_id = recovery["from_user_id"]
    to_user_id = recovery["to_user_id"]
    amount_minor = int(recovery["amount_minor"])
    tx_type = recovery["tx_type"]
    description = recovery["description"]
    ref = recovery["reference"]
    metadata = recovery.get("metadata") or {}
    base_meta = {**metadata, "canonical_source": "users.balance", "amount_minor": amount_minor, "counterparty_user_id": to_user_id}
    receiver_meta = {**metadata, "canonical_source": "users.balance", "amount_minor": amount_minor, "counterparty_user_id": from_user_id}

    sender_doc = await db.transactions.find_one({"id": sender_tx_id}, {"_id": 1})
    if not sender_doc:
        await _insert_transaction_doc(
            transaction_id=sender_tx_id,
            idempotency_key=idempotency_key,
            user_id=from_user_id,
            tx_type=tx_type,
            amount_minor=amount_minor,
            description=f"{description} (sent)",
            reference=ref,
            direction="debit",
            source="payment_engine_transfer",
            metadata=base_meta,
        )
    recipient_doc = await db.transactions.find_one({"id": recipient_tx_id}, {"_id": 1})
    if not recipient_doc:
        await _insert_transaction_doc(
            transaction_id=recipient_tx_id,
            idempotency_key=f"recv:{idempotency_key}",
            user_id=to_user_id,
            tx_type=tx_type,
            amount_minor=amount_minor,
            description=f"{description} (received)",
            reference=ref,
            direction="credit",
            source="payment_engine_transfer",
            metadata=receiver_meta,
        )

    sender_wallet_doc = await db.wallet_transactions.find_one(
        {"transaction_id": transaction_id, "user_id": from_user_id, "direction": "debit"},
        {"_id": 1},
    )
    if not sender_wallet_doc:
        await _insert_wallet_transaction_doc(
            transaction_id=transaction_id,
            user_id=from_user_id,
            amount_minor=amount_minor,
            tx_type=tx_type,
            status="pending",
            direction="debit",
            reference=ref,
            idempotency_key=idempotency_key,
            metadata=base_meta,
        )
    recipient_wallet_doc = await db.wallet_transactions.find_one(
        {"transaction_id": transaction_id, "user_id": to_user_id, "direction": "credit"},
        {"_id": 1},
    )
    if not recipient_wallet_doc:
        await _insert_wallet_transaction_doc(
            transaction_id=transaction_id,
            user_id=to_user_id,
            amount_minor=amount_minor,
            tx_type=tx_type,
            status="pending",
            direction="credit",
            reference=ref,
            idempotency_key=f"recv:{idempotency_key}",
            metadata=receiver_meta,
        )


async def _ensure_transfer_ledger_entries(recovery: dict[str, Any], idempotency_key: str) -> None:
    transaction_id = recovery["transaction_id"]
    from_user_id = recovery["from_user_id"]
    to_user_id = recovery["to_user_id"]
    amount_minor = int(recovery["amount_minor"])
    tx_type = recovery["tx_type"]
    reference = recovery["reference"]
    metadata = {
        **(recovery.get("metadata") or {}),
        "canonical_source": "users.balance",
        "amount_minor": amount_minor,
        "sender_transaction_id": recovery["sender_tx_id"],
        "recipient_transaction_id": recovery["recipient_tx_id"],
    }
    digest = hashlib.sha256(transaction_id.encode("utf-8")).hexdigest().upper()[:20]
    created_at = now_iso()
    entries = [
        {
            "entry_id": f"LED-TRF-{digest}-D",
            "transaction_id": transaction_id,
            "wallet_id": from_user_id,
            "user_id": from_user_id,
            "counterparty_wallet_id": to_user_id,
            "direction": "debit",
            "amount_minor": amount_minor,
            "currency": "EUR",
            "transaction_type": tx_type,
            "status": "completed",
            "reference": reference,
            "idempotency_key": idempotency_key,
            "created_at": created_at,
            "posted_at": created_at,
            "reversed_by": None,
            "metadata": metadata,
            "audit_version": 2,
        },
        {
            "entry_id": f"LED-TRF-{digest}-C",
            "transaction_id": transaction_id,
            "wallet_id": to_user_id,
            "user_id": to_user_id,
            "counterparty_wallet_id": from_user_id,
            "direction": "credit",
            "amount_minor": amount_minor,
            "currency": "EUR",
            "transaction_type": tx_type,
            "status": "completed",
            "reference": reference,
            "idempotency_key": idempotency_key,
            "created_at": created_at,
            "posted_at": created_at,
            "reversed_by": None,
            "metadata": metadata,
            "audit_version": 2,
        },
    ]
    for entry in entries:
        existing = await db.wallet_ledger_entries.find_one({"entry_id": entry["entry_id"]}, {"_id": 0})
        if existing:
            if (
                existing.get("transaction_id") != transaction_id
                or existing.get("direction") != entry["direction"]
                or int(existing.get("amount_minor", 0) or 0) != amount_minor
            ):
                raise RuntimeError("Deterministic transfer ledger entry mismatch")
            continue
        try:
            await db.wallet_ledger_entries.insert_one(entry)
        except Exception:
            existing = await db.wallet_ledger_entries.find_one({"entry_id": entry["entry_id"]}, {"_id": 0})
            if not existing:
                raise
            if (
                existing.get("transaction_id") != transaction_id
                or existing.get("direction") != entry["direction"]
                or int(existing.get("amount_minor", 0) or 0) != amount_minor
            ):
                raise RuntimeError("Deterministic transfer ledger entry mismatch")


async def _execute_transfer_recovery(recovery: dict[str, Any], idempotency_key: str, *, idempotent_replay: bool) -> WalletOperationResult:
    transaction_id = recovery["transaction_id"]
    sender_tx_id = recovery["sender_tx_id"]
    recipient_tx_id = recovery["recipient_tx_id"]
    from_user_id = recovery["from_user_id"]
    to_user_id = recovery["to_user_id"]
    amount_minor = int(recovery["amount_minor"])
    ref = recovery["reference"]

    sender_marker, sender_user = await _transfer_marker_state(from_user_id, TRANSFER_DEBIT_MARKERS_FIELD, transaction_id)
    recipient_marker, recipient_user = await _transfer_marker_state(to_user_id, TRANSFER_CREDIT_MARKERS_FIELD, transaction_id)
    if sender_user is None:
        return await _record_failed_operation(
            transaction_ids=[sender_tx_id, recipient_tx_id],
            wallet_transaction_id=transaction_id,
            idempotency_key=idempotency_key,
            transaction_id=transaction_id,
            reference=ref,
            error="Sender not found",
            audit_action="transfer_failed",
            audit_user_id=from_user_id,
            audit_details={"transaction_id": transaction_id, "amount_minor": amount_minor, "to_user_id": to_user_id},
        )
    if recipient_user is None:
        return await _record_failed_operation(
            transaction_ids=[sender_tx_id, recipient_tx_id],
            wallet_transaction_id=transaction_id,
            idempotency_key=idempotency_key,
            transaction_id=transaction_id,
            reference=ref,
            error="Recipient not found",
            audit_action="transfer_failed",
            audit_user_id=from_user_id,
            audit_details={"transaction_id": transaction_id, "amount_minor": amount_minor, "to_user_id": to_user_id},
        )
    if recipient_marker and not sender_marker:
        return await _record_reconciliation_required(
            transaction_ids=[sender_tx_id, recipient_tx_id],
            wallet_transaction_id=transaction_id,
            idempotency_key=idempotency_key,
            transaction_id=transaction_id,
            reference=ref,
            error="Recipient credit marker exists without sender debit marker",
            audit_action="transfer_reconciliation_required",
            audit_user_id=from_user_id,
            audit_details={"transaction_id": transaction_id, "amount_minor": amount_minor, "to_user_id": to_user_id},
        )

    sender_debited = sender_marker
    recipient_credited = recipient_marker
    try:
        await _ensure_transfer_documents(recovery, idempotency_key)

        if not sender_debited:
            applied_now, marker_present = await _apply_transfer_balance_once(
                user_id=from_user_id,
                transaction_id=transaction_id,
                delta_minor=-amount_minor,
                marker_field=TRANSFER_DEBIT_MARKERS_FIELD,
                require_minimum_minor=amount_minor,
            )
            if not marker_present:
                current_balance = await get_canonical_balance(from_user_id)
                raise ValueError(
                    f"Insufficient balance or sender debit could not be applied. Available: €{current_balance:.2f}, Required: €{minor_to_major(amount_minor):.2f}"
                )
            sender_debited = applied_now or marker_present
            await _persist_transfer_recovery(idempotency_key, {**recovery, "stage": "sender_debited"})

        if not recipient_credited:
            applied_now, marker_present = await _apply_transfer_balance_once(
                user_id=to_user_id,
                transaction_id=transaction_id,
                delta_minor=amount_minor,
                marker_field=TRANSFER_CREDIT_MARKERS_FIELD,
            )
            if not marker_present:
                raise ValueError("Recipient credit could not be applied")
            recipient_credited = applied_now or marker_present
            await _persist_transfer_recovery(idempotency_key, {**recovery, "stage": "recipient_credited"})

        await _ensure_transfer_ledger_entries(recovery, idempotency_key)
        await _persist_transfer_recovery(idempotency_key, {**recovery, "stage": "ledger_written"})
        await _set_transaction_status(sender_tx_id, "completed")
        await _set_transaction_status(recipient_tx_id, "completed")
        await db.wallet_transactions.update_many(
            {"transaction_id": transaction_id},
            {"$set": {"status": "completed", "updated_at": now_iso()}},
        )
        new_balance = await get_canonical_balance(from_user_id)
        response = {
            "success": True,
            "transaction_id": transaction_id,
            "reference": ref,
            "new_balance": new_balance,
            "status": "completed",
        }
        await _complete_idempotency(idempotency_key, response)
        await _clear_transfer_markers(from_user_id, to_user_id, transaction_id)
        await _append_audit_best_effort(
            "transfer_recovered" if idempotent_replay else "transfer_complete",
            from_user_id,
            {
                "transaction_id": transaction_id,
                "amount_minor": amount_minor,
                "to_user_id": to_user_id,
                "reference": ref,
                "recovered": idempotent_replay,
            },
        )
        return WalletOperationResult(
            success=True,
            transaction_id=transaction_id,
            reference=ref,
            new_balance=new_balance,
            status="completed",
            idempotent_replay=idempotent_replay,
        )
    except Exception as exc:
        error = str(exc)
        ledger_count = await _ledger_entry_count(transaction_id)
        if ledger_count is None or ledger_count > 0:
            return await _record_reconciliation_required(
                transaction_ids=[sender_tx_id, recipient_tx_id],
                wallet_transaction_id=transaction_id,
                idempotency_key=idempotency_key,
                transaction_id=transaction_id,
                reference=ref,
                error=error,
                audit_action="transfer_reconciliation_required",
                audit_user_id=from_user_id,
                audit_details={"transaction_id": transaction_id, "amount_minor": amount_minor, "to_user_id": to_user_id, "error": error},
            )

        if recipient_credited:
            recipient_rollback_ok = await _reverse_transfer_balance_once(
                user_id=to_user_id,
                transaction_id=transaction_id,
                delta_minor=-amount_minor,
                marker_field=TRANSFER_CREDIT_MARKERS_FIELD,
                require_minimum_minor=amount_minor,
            )
            if not recipient_rollback_ok:
                return await _record_reconciliation_required(
                    transaction_ids=[sender_tx_id, recipient_tx_id],
                    wallet_transaction_id=transaction_id,
                    idempotency_key=idempotency_key,
                    transaction_id=transaction_id,
                    reference=ref,
                    error=f"{error}; recipient compensation failed",
                    audit_action="transfer_reconciliation_required",
                    audit_user_id=from_user_id,
                    audit_details={"transaction_id": transaction_id, "amount_minor": amount_minor, "to_user_id": to_user_id, "error": error},
                )
            recipient_credited = False

        if sender_debited:
            sender_refund_ok = await _reverse_transfer_balance_once(
                user_id=from_user_id,
                transaction_id=transaction_id,
                delta_minor=amount_minor,
                marker_field=TRANSFER_DEBIT_MARKERS_FIELD,
            )
            if not sender_refund_ok:
                return await _record_reconciliation_required(
                    transaction_ids=[sender_tx_id, recipient_tx_id],
                    wallet_transaction_id=transaction_id,
                    idempotency_key=idempotency_key,
                    transaction_id=transaction_id,
                    reference=ref,
                    error=f"{error}; sender compensation failed",
                    audit_action="transfer_reconciliation_required",
                    audit_user_id=from_user_id,
                    audit_details={"transaction_id": transaction_id, "amount_minor": amount_minor, "to_user_id": to_user_id, "error": error},
                )

        return await _record_failed_operation(
            transaction_ids=[sender_tx_id, recipient_tx_id],
            wallet_transaction_id=transaction_id,
            idempotency_key=idempotency_key,
            transaction_id=transaction_id,
            reference=ref,
            error=error,
            audit_action="transfer_failed",
            audit_user_id=from_user_id,
            audit_details={"transaction_id": transaction_id, "amount_minor": amount_minor, "to_user_id": to_user_id, "error": error},
        )


async def credit_canonical_balance(
    *,
    user_id: str,
    amount_major: float,
    tx_type: str,
    description: str,
    reference: Optional[str],
    source: str,
    metadata: Optional[dict[str, Any]],
    idempotency_key: str,
) -> WalletOperationResult:
    amount_minor = amount_to_minor(amount_major)
    if amount_minor <= 0:
        return WalletOperationResult(success=False, error="Amount must be positive", status="failed")

    ref = reference or generate_reference()
    payload_hash = request_hash_for("credit", {"user_id": user_id, "amount_minor": amount_minor, "type": tx_type, "reference": ref, "source": source})
    claim_state, existing = await _claim_idempotency(idempotency_key, "credit", payload_hash, user_id)
    replay = _existing_idempotency_result(claim_state, existing)
    if replay is not None:
        return replay

    transaction_id = generate_transaction_id()
    base_meta = {**(metadata or {}), "canonical_source": "users.balance", "amount_minor": amount_minor}
    balance_applied = False
    ledger_written = False
    try:
        await _insert_transaction_doc(transaction_id=transaction_id, idempotency_key=idempotency_key, user_id=user_id, tx_type=tx_type, amount_minor=amount_minor, description=description, reference=ref, direction="credit", source=source, metadata=base_meta)
        await _insert_wallet_transaction_doc(transaction_id=transaction_id, user_id=user_id, amount_minor=amount_minor, tx_type=tx_type, status="pending", direction="credit", reference=ref, idempotency_key=idempotency_key, metadata=base_meta)
        balance_ok = await _update_user_balance(user_id, amount_minor)
        if not balance_ok:
            raise ValueError("User not found")
        balance_applied = True
        await _insert_balanced_ledger_entries(transaction_id=transaction_id, debit_wallet_id=SYSTEM_WALLET_ID, debit_user_id=SYSTEM_USER_ID, credit_wallet_id=user_id, credit_user_id=user_id, amount_minor=amount_minor, tx_type=tx_type, status="completed", reference=ref, idempotency_key=idempotency_key, metadata=base_meta)
        ledger_written = True
        await _set_transaction_status(transaction_id, "completed")
        new_balance = await get_canonical_balance(user_id)
        response = {"success": True, "transaction_id": transaction_id, "reference": ref, "new_balance": new_balance, "status": "completed"}
        await _complete_idempotency(idempotency_key, response)
        await _append_audit_best_effort(f"credit_{tx_type}", user_id, {"transaction_id": transaction_id, "amount_minor": amount_minor, "new_balance": new_balance, "source": source})
        return WalletOperationResult(success=True, transaction_id=transaction_id, reference=ref, new_balance=new_balance, status="completed")
    except Exception as exc:
        error = str(exc)
        if balance_applied:
            ledger_count = await _ledger_entry_count(transaction_id)
            if ledger_written or ledger_count is None or ledger_count > 0:
                return await _record_reconciliation_required(
                    transaction_ids=[transaction_id],
                    wallet_transaction_id=None,
                    idempotency_key=idempotency_key,
                    transaction_id=transaction_id,
                    reference=ref,
                    error=error,
                    audit_action=f"credit_{tx_type}_reconciliation_required",
                    audit_user_id=user_id,
                    audit_details={"transaction_id": transaction_id, "amount_minor": amount_minor, "error": error},
                )
            compensation_ok = await _update_user_balance(user_id, -amount_minor, require_minimum_minor=amount_minor)
            if not compensation_ok:
                return await _record_reconciliation_required(
                    transaction_ids=[transaction_id],
                    wallet_transaction_id=None,
                    idempotency_key=idempotency_key,
                    transaction_id=transaction_id,
                    reference=ref,
                    error=f"{error}; credit compensation failed",
                    audit_action=f"credit_{tx_type}_reconciliation_required",
                    audit_user_id=user_id,
                    audit_details={"transaction_id": transaction_id, "amount_minor": amount_minor, "error": error},
                )
        return await _record_failed_operation(
            transaction_ids=[transaction_id],
            wallet_transaction_id=None,
            idempotency_key=idempotency_key,
            transaction_id=transaction_id,
            reference=ref,
            error=error,
            audit_action=f"credit_{tx_type}_failed",
            audit_user_id=user_id,
            audit_details={"transaction_id": transaction_id, "amount_minor": amount_minor, "error": error},
        )


async def debit_canonical_balance(
    *,
    user_id: str,
    amount_major: float,
    tx_type: str,
    description: str,
    reference: Optional[str],
    metadata: Optional[dict[str, Any]],
    idempotency_key: str,
    source: str = "payment_engine",
    merchant_id: Optional[str] = None,
    merchant_name: Optional[str] = None,
) -> WalletOperationResult:
    amount_minor = amount_to_minor(amount_major)
    if amount_minor <= 0:
        return WalletOperationResult(success=False, error="Amount must be positive", status="failed")

    ref = reference or generate_reference()
    payload_hash = request_hash_for("debit", {"user_id": user_id, "amount_minor": amount_minor, "type": tx_type, "reference": ref, "merchant_id": merchant_id or "", "source": source})
    claim_state, existing = await _claim_idempotency(idempotency_key, "debit", payload_hash, user_id)
    replay = _existing_idempotency_result(claim_state, existing)
    if replay is not None:
        return replay

    transaction_id = generate_transaction_id()
    base_meta = {**(metadata or {}), "canonical_source": "users.balance", "amount_minor": amount_minor}
    balance_applied = False
    ledger_written = False
    try:
        await _insert_transaction_doc(transaction_id=transaction_id, idempotency_key=idempotency_key, user_id=user_id, tx_type=tx_type, amount_minor=amount_minor, description=description, reference=ref, direction="debit", source=source, metadata=base_meta, merchant_id=merchant_id, merchant_name=merchant_name)
        await _insert_wallet_transaction_doc(transaction_id=transaction_id, user_id=user_id, amount_minor=amount_minor, tx_type=tx_type, status="pending", direction="debit", reference=ref, idempotency_key=idempotency_key, metadata=base_meta)
        current_balance = await get_canonical_balance(user_id)
        if current_balance < minor_to_major(amount_minor):
            raise ValueError(f"Insufficient balance. Available: €{current_balance:.2f}, Required: €{minor_to_major(amount_minor):.2f}")
        balance_ok = await _update_user_balance(user_id, -amount_minor, require_minimum_minor=amount_minor)
        if not balance_ok:
            raise ValueError("Balance changed during transaction. Please try again.")
        balance_applied = True
        await _insert_balanced_ledger_entries(transaction_id=transaction_id, debit_wallet_id=user_id, debit_user_id=user_id, credit_wallet_id=SYSTEM_WALLET_ID, credit_user_id=SYSTEM_USER_ID, amount_minor=amount_minor, tx_type=tx_type, status="completed", reference=ref, idempotency_key=idempotency_key, metadata=base_meta)
        ledger_written = True
        await _set_transaction_status(transaction_id, "completed")
        new_balance = await get_canonical_balance(user_id)
        response = {"success": True, "transaction_id": transaction_id, "reference": ref, "new_balance": new_balance, "status": "completed"}
        await _complete_idempotency(idempotency_key, response)
        await _append_audit_best_effort(f"debit_{tx_type}", user_id, {"transaction_id": transaction_id, "amount_minor": amount_minor, "new_balance": new_balance, "merchant_id": merchant_id or ""})
        return WalletOperationResult(success=True, transaction_id=transaction_id, reference=ref, new_balance=new_balance, status="completed")
    except Exception as exc:
        error = str(exc)
        if balance_applied:
            ledger_count = await _ledger_entry_count(transaction_id)
            if ledger_written or ledger_count is None or ledger_count > 0:
                return await _record_reconciliation_required(
                    transaction_ids=[transaction_id],
                    wallet_transaction_id=None,
                    idempotency_key=idempotency_key,
                    transaction_id=transaction_id,
                    reference=ref,
                    error=error,
                    audit_action=f"debit_{tx_type}_reconciliation_required",
                    audit_user_id=user_id,
                    audit_details={"transaction_id": transaction_id, "amount_minor": amount_minor, "error": error},
                )
            compensation_ok = await _update_user_balance(user_id, amount_minor)
            if not compensation_ok:
                return await _record_reconciliation_required(
                    transaction_ids=[transaction_id],
                    wallet_transaction_id=None,
                    idempotency_key=idempotency_key,
                    transaction_id=transaction_id,
                    reference=ref,
                    error=f"{error}; debit compensation failed",
                    audit_action=f"debit_{tx_type}_reconciliation_required",
                    audit_user_id=user_id,
                    audit_details={"transaction_id": transaction_id, "amount_minor": amount_minor, "error": error},
                )
        return await _record_failed_operation(
            transaction_ids=[transaction_id],
            wallet_transaction_id=None,
            idempotency_key=idempotency_key,
            transaction_id=transaction_id,
            reference=ref,
            error=error,
            audit_action=f"debit_{tx_type}_failed",
            audit_user_id=user_id,
            audit_details={"transaction_id": transaction_id, "amount_minor": amount_minor, "error": error},
        )


async def transfer_canonical_balance(
    *,
    from_user_id: str,
    to_user_id: str,
    amount_major: float,
    tx_type: str,
    description: str,
    reference: Optional[str],
    metadata: Optional[dict[str, Any]],
    idempotency_key: str,
) -> WalletOperationResult:
    amount_minor = amount_to_minor(amount_major)
    if amount_minor <= 0:
        return WalletOperationResult(success=False, error="Amount must be positive", status="failed")
    if from_user_id == to_user_id:
        return WalletOperationResult(success=False, error="Sender and recipient must be different", status="failed")

    # Reuse the persisted/generated reference for retries. The previous code hashed a
    # newly generated reference before the idempotency lookup, so a retry without an
    # explicit reference could incorrectly conflict with the original request.
    preexisting = await db.payment_idempotency.find_one({"idempotency_key": idempotency_key}, {"_id": 0})
    persisted_recovery = (preexisting or {}).get("transfer_recovery") or {}
    persisted_response = (preexisting or {}).get("response") or {}
    ref = reference or persisted_recovery.get("reference") or persisted_response.get("reference") or generate_reference("TRF")
    payload_hash = request_hash_for(
        "transfer",
        {
            "from_user_id": from_user_id,
            "to_user_id": to_user_id,
            "amount_minor": amount_minor,
            "type": tx_type,
            "reference": ref,
        },
    )
    claim_state, existing = await _claim_idempotency(idempotency_key, "transfer", payload_hash, from_user_id)

    if claim_state == "pending" and existing and existing.get("operation") == "transfer":
        recovery = existing.get("transfer_recovery") or {}
        if recovery and _transfer_recovery_is_stale(existing):
            return await _execute_transfer_recovery(recovery, idempotency_key, idempotent_replay=True)

    replay = _existing_idempotency_result(claim_state, existing)
    if replay is not None:
        return replay

    transaction_id = generate_transaction_id()
    recovery = {
        "transaction_id": transaction_id,
        "sender_tx_id": f"{transaction_id}-OUT",
        "recipient_tx_id": f"{transaction_id}-IN",
        "from_user_id": from_user_id,
        "to_user_id": to_user_id,
        "amount_minor": amount_minor,
        "tx_type": tx_type,
        "description": description,
        "reference": ref,
        "metadata": metadata or {},
        "stage": "prepared",
        "created_at": now_iso(),
    }
    try:
        await _persist_transfer_recovery(idempotency_key, recovery)
    except Exception as exc:
        return await _record_failed_operation(
            transaction_ids=[],
            wallet_transaction_id=None,
            idempotency_key=idempotency_key,
            transaction_id=transaction_id,
            reference=ref,
            error=str(exc),
            audit_action="transfer_failed",
            audit_user_id=from_user_id,
            audit_details={"transaction_id": transaction_id, "amount_minor": amount_minor, "to_user_id": to_user_id},
        )
    recovery["updated_at"] = now_iso()
    return await _execute_transfer_recovery(recovery, idempotency_key, idempotent_replay=False)


async def reconcile_pending_wallet_transfers(*, limit: int = 100, stale_seconds: int = TRANSFER_RECOVERY_STALE_SECONDS) -> dict[str, int]:
    """Recover stale canonical transfers after a process crash.

    New transfers persist durable recovery data before the first balance mutation.
    Legacy pending rows without that data are never guessed; they are escalated to
    reconciliation_required for manual accounting review.
    """
    cursor = db.payment_idempotency.find(
        {"operation": "transfer", "status": "pending"},
        {"_id": 0},
    )
    rows = await cursor.to_list(max(1, min(int(limit or 100), 500)))
    stats = {"checked": 0, "recovered": 0, "manual_review": 0, "still_pending": 0}
    cutoff = datetime.now(timezone.utc) - timedelta(seconds=max(1, int(stale_seconds)))

    for row in rows:
        stats["checked"] += 1
        recovery = row.get("transfer_recovery") or {}
        raw = recovery.get("updated_at") or row.get("updated_at") or row.get("created_at")
        try:
            timestamp = datetime.fromisoformat(str(raw)) if raw else None
            if timestamp and timestamp.tzinfo is None:
                timestamp = timestamp.replace(tzinfo=timezone.utc)
        except Exception:
            timestamp = None
        if timestamp and timestamp > cutoff:
            stats["still_pending"] += 1
            continue

        key = str(row.get("idempotency_key") or "")
        if not key:
            stats["manual_review"] += 1
            continue
        if not recovery:
            response = {
                "success": False,
                "error": "Legacy pending transfer has no durable recovery state; wallet reconciliation required",
                "status": "reconciliation_required",
            }
            await db.payment_idempotency.update_one(
                {"idempotency_key": key, "status": "pending"},
                {"$set": {
                    "status": "reconciliation_required",
                    "response": response,
                    "reconciliation_required_at": now_iso(),
                }},
            )
            stats["manual_review"] += 1
            continue

        result = await _execute_transfer_recovery(recovery, key, idempotent_replay=True)
        if result.success:
            stats["recovered"] += 1
        elif result.status == "reconciliation_required":
            stats["manual_review"] += 1
        else:
            stats["still_pending"] += 1
    return stats


async def sync_canonical_balance(
    *,
    user_id: str,
    target_balance_major: float,
    description: str,
    reference: Optional[str],
    metadata: Optional[dict[str, Any]],
    idempotency_key: str,
) -> WalletOperationResult:
    target_minor = amount_to_minor(target_balance_major)
    current_minor = amount_to_minor(await get_canonical_balance(user_id))
    if target_minor == current_minor:
        return WalletOperationResult(success=True, transaction_id=None, reference=reference or generate_reference("SYNC"), new_balance=minor_to_major(target_minor), status="completed")
    delta_minor = target_minor - current_minor
    if delta_minor > 0:
        return await credit_canonical_balance(user_id=user_id, amount_major=minor_to_major(delta_minor), tx_type="reconciliation_sync", description=description, reference=reference or generate_reference("SYNC"), source="wallet_reconciliation", metadata={**(metadata or {}), "sync_target_balance_minor": target_minor}, idempotency_key=idempotency_key)
    return await debit_canonical_balance(user_id=user_id, amount_major=minor_to_major(abs(delta_minor)), tx_type="reconciliation_sync", description=description, reference=reference or generate_reference("SYNC"), metadata={**(metadata or {}), "sync_target_balance_minor": target_minor}, idempotency_key=idempotency_key, source="wallet_reconciliation")


async def admin_adjustment(
    *,
    user_id: str,
    amount_minor: int,
    reason: str,
    evidence: str,
    approved_by: str,
    idempotency_key: str,
) -> WalletOperationResult:
    metadata = {"approved_by": approved_by, "reason": reason, "evidence": evidence, "adjustment_type": "manual_admin_adjustment"}
    if amount_minor >= 0:
        return await credit_canonical_balance(user_id=user_id, amount_major=minor_to_major(amount_minor), tx_type="admin_credit", description=reason, reference=generate_reference("ADJ"), source="admin_adjustment", metadata=metadata, idempotency_key=idempotency_key)
    return await debit_canonical_balance(user_id=user_id, amount_major=minor_to_major(abs(amount_minor)), tx_type="admin_debit", description=reason, reference=generate_reference("ADJ"), metadata=metadata, idempotency_key=idempotency_key, source="admin_adjustment")