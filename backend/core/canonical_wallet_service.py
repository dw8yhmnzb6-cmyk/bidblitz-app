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
    amount_major = minor_to_major(abs(delta_minor))
    selector = wallet_owner_selector(user_id)
    if delta_minor < 0 and require_minimum_minor is not None:
        selector["balance"] = {"$gte": minor_to_major(require_minimum_minor)}
    result = await db.users.update_one(selector, {"$inc": {"balance": minor_to_major(delta_minor)}, "$set": {"last_balance_update": now_iso()}})
    return result.modified_count == 1


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
    if claim_state == "conflict":
        return WalletOperationResult(success=False, error="Idempotency key payload mismatch", status="failed")
    if claim_state == "completed" and existing and existing.get("response"):
        response = existing["response"]
        return WalletOperationResult(success=True, transaction_id=response.get("transaction_id"), reference=response.get("reference"), new_balance=response.get("new_balance"), status="completed", idempotent_replay=True)
    if claim_state == "pending" and existing and existing.get("response"):
        response = existing["response"]
        return WalletOperationResult(success=bool(response.get("success")), transaction_id=response.get("transaction_id"), reference=response.get("reference"), new_balance=response.get("new_balance"), error=response.get("error"), status=existing.get("status", "pending"), idempotent_replay=True)

    transaction_id = generate_transaction_id()
    base_meta = {**(metadata or {}), "canonical_source": "users.balance", "amount_minor": amount_minor}
    try:
        await _insert_transaction_doc(transaction_id=transaction_id, idempotency_key=idempotency_key, user_id=user_id, tx_type=tx_type, amount_minor=amount_minor, description=description, reference=ref, direction="credit", source=source, metadata=base_meta)
        await _insert_wallet_transaction_doc(transaction_id=transaction_id, user_id=user_id, amount_minor=amount_minor, tx_type=tx_type, status="pending", direction="credit", reference=ref, idempotency_key=idempotency_key, metadata=base_meta)
        balance_ok = await _update_user_balance(user_id, amount_minor)
        if not balance_ok:
            raise ValueError("User not found")
        await _insert_balanced_ledger_entries(transaction_id=transaction_id, debit_wallet_id=SYSTEM_WALLET_ID, debit_user_id=SYSTEM_USER_ID, credit_wallet_id=user_id, credit_user_id=user_id, amount_minor=amount_minor, tx_type=tx_type, status="completed", reference=ref, idempotency_key=idempotency_key, metadata=base_meta)
        await _set_transaction_status(transaction_id, "completed")
        new_balance = await get_canonical_balance(user_id)
        response = {"success": True, "transaction_id": transaction_id, "reference": ref, "new_balance": new_balance, "status": "completed"}
        await _complete_idempotency(idempotency_key, response)
        await _append_audit(f"credit_{tx_type}", user_id, {"transaction_id": transaction_id, "amount_minor": amount_minor, "new_balance": new_balance, "source": source})
        return WalletOperationResult(success=True, transaction_id=transaction_id, reference=ref, new_balance=new_balance, status="completed")
    except Exception as exc:
        await _set_transaction_status(transaction_id, "failed", {"metadata.error": str(exc)})
        response = {"success": False, "transaction_id": transaction_id, "reference": ref, "error": str(exc), "status": "failed"}
        await _fail_idempotency(idempotency_key, response)
        await _append_audit(f"credit_{tx_type}_failed", user_id, {"transaction_id": transaction_id, "amount_minor": amount_minor, "error": str(exc)}, status="failed")
        return WalletOperationResult(success=False, transaction_id=transaction_id, reference=ref, error=str(exc), status="failed")


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
    if claim_state == "conflict":
        return WalletOperationResult(success=False, error="Idempotency key payload mismatch", status="failed")
    if claim_state == "completed" and existing and existing.get("response"):
        response = existing["response"]
        return WalletOperationResult(success=True, transaction_id=response.get("transaction_id"), reference=response.get("reference"), new_balance=response.get("new_balance"), status="completed", idempotent_replay=True)

    transaction_id = generate_transaction_id()
    base_meta = {**(metadata or {}), "canonical_source": "users.balance", "amount_minor": amount_minor}
    try:
        await _insert_transaction_doc(transaction_id=transaction_id, idempotency_key=idempotency_key, user_id=user_id, tx_type=tx_type, amount_minor=amount_minor, description=description, reference=ref, direction="debit", source=source, metadata=base_meta, merchant_id=merchant_id, merchant_name=merchant_name)
        await _insert_wallet_transaction_doc(transaction_id=transaction_id, user_id=user_id, amount_minor=amount_minor, tx_type=tx_type, status="pending", direction="debit", reference=ref, idempotency_key=idempotency_key, metadata=base_meta)
        current_balance = await get_canonical_balance(user_id)
        if current_balance < minor_to_major(amount_minor):
            raise ValueError(f"Insufficient balance. Available: €{current_balance:.2f}, Required: €{minor_to_major(amount_minor):.2f}")
        balance_ok = await _update_user_balance(user_id, -amount_minor, require_minimum_minor=amount_minor)
        if not balance_ok:
            raise ValueError("Balance changed during transaction. Please try again.")
        await _insert_balanced_ledger_entries(transaction_id=transaction_id, debit_wallet_id=user_id, debit_user_id=user_id, credit_wallet_id=SYSTEM_WALLET_ID, credit_user_id=SYSTEM_USER_ID, amount_minor=amount_minor, tx_type=tx_type, status="completed", reference=ref, idempotency_key=idempotency_key, metadata=base_meta)
        await _set_transaction_status(transaction_id, "completed")
        new_balance = await get_canonical_balance(user_id)
        response = {"success": True, "transaction_id": transaction_id, "reference": ref, "new_balance": new_balance, "status": "completed"}
        await _complete_idempotency(idempotency_key, response)
        await _append_audit(f"debit_{tx_type}", user_id, {"transaction_id": transaction_id, "amount_minor": amount_minor, "new_balance": new_balance, "merchant_id": merchant_id or ""})
        return WalletOperationResult(success=True, transaction_id=transaction_id, reference=ref, new_balance=new_balance, status="completed")
    except Exception as exc:
        await _set_transaction_status(transaction_id, "failed", {"metadata.error": str(exc)})
        response = {"success": False, "transaction_id": transaction_id, "reference": ref, "error": str(exc), "status": "failed"}
        await _fail_idempotency(idempotency_key, response)
        await _append_audit(f"debit_{tx_type}_failed", user_id, {"transaction_id": transaction_id, "amount_minor": amount_minor, "error": str(exc)}, status="failed")
        return WalletOperationResult(success=False, transaction_id=transaction_id, reference=ref, error=str(exc), status="failed")


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
    ref = reference or generate_reference("TRF")
    payload_hash = request_hash_for("transfer", {"from_user_id": from_user_id, "to_user_id": to_user_id, "amount_minor": amount_minor, "type": tx_type, "reference": ref})
    claim_state, existing = await _claim_idempotency(idempotency_key, "transfer", payload_hash, from_user_id)
    if claim_state == "conflict":
        return WalletOperationResult(success=False, error="Idempotency key payload mismatch", status="failed")
    if claim_state == "completed" and existing and existing.get("response"):
        response = existing["response"]
        return WalletOperationResult(success=True, transaction_id=response.get("transaction_id"), reference=response.get("reference"), new_balance=response.get("new_balance"), status="completed", idempotent_replay=True)

    transaction_id = generate_transaction_id()
    sender_tx_id = f"{transaction_id}-OUT"
    recipient_tx_id = f"{transaction_id}-IN"
    base_meta = {**(metadata or {}), "canonical_source": "users.balance", "amount_minor": amount_minor, "counterparty_user_id": to_user_id}
    receiver_meta = {**(metadata or {}), "canonical_source": "users.balance", "amount_minor": amount_minor, "counterparty_user_id": from_user_id}
    try:
        current_balance = await get_canonical_balance(from_user_id)
        if current_balance < minor_to_major(amount_minor):
            raise ValueError(f"Insufficient balance. Available: €{current_balance:.2f}, Required: €{minor_to_major(amount_minor):.2f}")
        await _insert_transaction_doc(transaction_id=sender_tx_id, idempotency_key=idempotency_key, user_id=from_user_id, tx_type=tx_type, amount_minor=amount_minor, description=f"{description} (sent)", reference=ref, direction="debit", source="payment_engine_transfer", metadata=base_meta)
        await _insert_transaction_doc(transaction_id=recipient_tx_id, idempotency_key=f"recv:{idempotency_key}", user_id=to_user_id, tx_type=tx_type, amount_minor=amount_minor, description=f"{description} (received)", reference=ref, direction="credit", source="payment_engine_transfer", metadata=receiver_meta)
        await _insert_wallet_transaction_doc(transaction_id=transaction_id, user_id=from_user_id, amount_minor=amount_minor, tx_type=tx_type, status="pending", direction="debit", reference=ref, idempotency_key=idempotency_key, metadata=base_meta)
        await _insert_wallet_transaction_doc(transaction_id=transaction_id, user_id=to_user_id, amount_minor=amount_minor, tx_type=tx_type, status="pending", direction="credit", reference=ref, idempotency_key=f"recv:{idempotency_key}", metadata=receiver_meta)
        debit_ok = await _update_user_balance(from_user_id, -amount_minor, require_minimum_minor=amount_minor)
        if not debit_ok:
            raise ValueError("Balance changed during transaction. Please try again.")
        credit_ok = await _update_user_balance(to_user_id, amount_minor)
        if not credit_ok:
            await _update_user_balance(from_user_id, amount_minor)
            raise ValueError("Recipient not found")
        await _insert_balanced_ledger_entries(transaction_id=transaction_id, debit_wallet_id=from_user_id, debit_user_id=from_user_id, credit_wallet_id=to_user_id, credit_user_id=to_user_id, amount_minor=amount_minor, tx_type=tx_type, status="completed", reference=ref, idempotency_key=idempotency_key, metadata={**base_meta, "recipient_transaction_id": recipient_tx_id, "sender_transaction_id": sender_tx_id})
        await _set_transaction_status(sender_tx_id, "completed")
        await _set_transaction_status(recipient_tx_id, "completed")
        await db.wallet_transactions.update_many({"transaction_id": transaction_id}, {"$set": {"status": "completed", "updated_at": now_iso()}})
        new_balance = await get_canonical_balance(from_user_id)
        response = {"success": True, "transaction_id": transaction_id, "reference": ref, "new_balance": new_balance, "status": "completed"}
        await _complete_idempotency(idempotency_key, response)
        await _append_audit("transfer_complete", from_user_id, {"transaction_id": transaction_id, "amount_minor": amount_minor, "to_user_id": to_user_id, "reference": ref})
        return WalletOperationResult(success=True, transaction_id=transaction_id, reference=ref, new_balance=new_balance, status="completed")
    except Exception as exc:
        await _set_transaction_status(sender_tx_id, "failed", {"metadata.error": str(exc)})
        await _set_transaction_status(recipient_tx_id, "failed", {"metadata.error": str(exc)})
        await db.wallet_transactions.update_many({"transaction_id": transaction_id}, {"$set": {"status": "failed", "updated_at": now_iso(), "metadata.error": str(exc)}})
        response = {"success": False, "transaction_id": transaction_id, "reference": ref, "error": str(exc), "status": "failed"}
        await _fail_idempotency(idempotency_key, response)
        await _append_audit("transfer_failed", from_user_id, {"transaction_id": transaction_id, "amount_minor": amount_minor, "to_user_id": to_user_id, "error": str(exc)}, status="failed")
        return WalletOperationResult(success=False, transaction_id=transaction_id, reference=ref, error=str(exc), status="failed")


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