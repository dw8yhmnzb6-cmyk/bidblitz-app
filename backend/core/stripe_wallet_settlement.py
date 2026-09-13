from __future__ import annotations

import hashlib
from datetime import datetime, timezone
from typing import Any

from bson import ObjectId

from core.database import db


class WalletSettlementNeedsReview(RuntimeError):
    """Raised when a legacy payment state cannot be proven safe to auto-credit."""


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _user_identity_selector(user_id: str) -> dict[str, Any]:
    candidates: list[dict[str, Any]] = [{"_id": user_id}]
    if ObjectId.is_valid(user_id):
        candidates.append({"_id": ObjectId(user_id)})
    return {"$or": candidates}


def _transaction_identity(session_id: str) -> tuple[str, str, str]:
    digest = hashlib.sha256(session_id.encode("utf-8")).hexdigest().upper()
    return (
        f"stripe_topup:{session_id}",
        f"STP-{digest[:16]}",
        f"STRIPE-{session_id[:12].upper()}",
    )


async def _mark_manual_review(payment: dict[str, Any], reason: str) -> None:
    await db.payment_transactions.update_one(
        {"session_id": payment["session_id"], "type": "wallet_topup"},
        {"$set": {
            "status": "manual_review_required",
            "payment_status": "paid",
            "settlement_error": reason,
            "updated_at": _now_iso(),
        }},
    )


async def settle_stripe_wallet_topup(
    session_id: str,
    *,
    expected_user_id: str | None = None,
) -> dict[str, Any]:
    """Settle one paid Stripe Checkout wallet top-up exactly once.

    Safety model:
    - Stripe payment must already be verified as paid by the caller.
    - The wallet balance increment and the session marker are written atomically to
      the same user document.
    - The transaction document has a deterministic Mongo _id, so concurrent
      polling/webhook settlement converges on one audit row.
    - payment_transactions.status becomes ``credited`` only after both wallet
      proof and transaction proof exist.
    - Ambiguous legacy rows are stopped for manual review instead of risking a
      duplicate wallet credit.
    """
    query: dict[str, Any] = {
        "session_id": session_id,
        "type": "wallet_topup",
    }
    if expected_user_id is not None:
        query["user_id"] = expected_user_id

    payment = await db.payment_transactions.find_one(query)
    if not payment:
        return {"found": False, "credited": False, "credited_now": False}

    user_id = str(payment.get("user_id") or "")
    if not user_id:
        await _mark_manual_review(payment, "missing_user_id")
        raise WalletSettlementNeedsReview("Stripe top-up is missing a user id")

    try:
        amount = round(float(payment.get("amount", 0) or 0), 2)
    except (TypeError, ValueError):
        amount = 0.0
    if amount <= 0:
        await _mark_manual_review(payment, "invalid_amount")
        raise WalletSettlementNeedsReview("Stripe top-up amount is invalid")

    txn_mongo_id, transaction_id, reference = _transaction_identity(session_id)
    existing_txn = await db.transactions.find_one(
        {
            "_id": txn_mongo_id,
            "stripe_session_id": session_id,
            "user_id": user_id,
            "type": "topup",
            "status": "completed",
        },
        {"_id": 1, "id": 1, "amount": 1},
    )

    identity_selector = _user_identity_selector(user_id)
    user_doc = await db.users.find_one(
        identity_selector,
        {"balance": 1, "stripe_checkout_credited_sessions": 1},
    )
    if not user_doc:
        raise RuntimeError("Stripe wallet settlement failed: user not found")

    credited_sessions = user_doc.get("stripe_checkout_credited_sessions", []) or []
    has_wallet_marker = session_id in credited_sessions

    # Legacy code wrote status=credited/completed before every durable proof existed.
    # If a matching completed transaction exists, the old flow had already applied
    # the balance before inserting that transaction, so we can safely backfill only
    # the marker (without another balance increment). Without either proof, the state
    # is ambiguous and must not be auto-credited.
    if payment.get("status") in {"credited", "completed", "manual_review_required"}:
        if has_wallet_marker:
            pass
        elif existing_txn:
            await db.users.update_one(
                identity_selector,
                {"$addToSet": {"stripe_checkout_credited_sessions": session_id}},
            )
            has_wallet_marker = True
        else:
            await _mark_manual_review(payment, "legacy_terminal_state_without_wallet_proof")
            raise WalletSettlementNeedsReview(
                "Legacy Stripe top-up needs manual review before wallet credit"
            )

    credited_now = False
    if not has_wallet_marker:
        await db.payment_transactions.update_one(
            {"session_id": session_id, "type": "wallet_topup"},
            {"$set": {
                "status": "settling",
                "payment_status": "paid",
                "settlement_version": 2,
                "updated_at": _now_iso(),
            }},
        )

        credit_selector = {
            **identity_selector,
            "stripe_checkout_credited_sessions": {"$ne": session_id},
        }
        credit_time = _now_iso()
        wallet_result = await db.users.update_one(
            credit_selector,
            {
                "$inc": {"balance": amount},
                "$addToSet": {"stripe_checkout_credited_sessions": session_id},
                "$set": {"last_balance_update": credit_time},
            },
        )

        user_doc = await db.users.find_one(
            identity_selector,
            {"balance": 1, "stripe_checkout_credited_sessions": 1},
        )
        if not user_doc:
            raise RuntimeError("Stripe wallet settlement failed: user disappeared")

        credited_sessions = user_doc.get("stripe_checkout_credited_sessions", []) or []
        if wallet_result.modified_count != 1 and session_id not in credited_sessions:
            raise RuntimeError("Stripe wallet settlement failed: balance was not credited")
        credited_now = wallet_result.modified_count == 1

    if existing_txn is None:
        txn_doc = {
            "_id": txn_mongo_id,
            "id": transaction_id,
            "idempotency_key": f"stripe_checkout:{session_id}",
            "user_id": user_id,
            "type": "topup",
            "amount": amount,
            "description": f"Stripe top-up (EUR {amount:.2f})",
            "merchant_name": "Stripe",
            "status": "completed",
            "reference": reference,
            "payment_method": "stripe",
            "category": "topup",
            "stripe_session_id": session_id,
            "settlement_version": 2,
            "created_at": _now_iso(),
        }
        try:
            await db.transactions.insert_one(txn_doc)
        except Exception:
            existing_txn = await db.transactions.find_one(
                {
                    "_id": txn_mongo_id,
                    "stripe_session_id": session_id,
                    "user_id": user_id,
                    "type": "topup",
                    "status": "completed",
                },
                {"_id": 1, "id": 1, "amount": 1},
            )
            if not existing_txn:
                await db.payment_transactions.update_one(
                    {"session_id": session_id, "type": "wallet_topup"},
                    {"$set": {
                        "status": "wallet_credited_audit_pending",
                        "payment_status": "paid",
                        "settlement_version": 2,
                        "updated_at": _now_iso(),
                    }},
                )
                raise RuntimeError(
                    "Stripe wallet was credited but transaction finalization is pending"
                )

    final_user = await db.users.find_one(identity_selector, {"balance": 1})
    new_balance = round(float((final_user or {}).get("balance", 0) or 0), 2)
    now = _now_iso()
    await db.payment_transactions.update_one(
        {"session_id": session_id, "type": "wallet_topup"},
        {"$set": {
            "status": "credited",
            "payment_status": "paid",
            "settlement_version": 2,
            "transaction_id": transaction_id,
            "reference": reference,
            "new_balance": new_balance,
            "credited_at": now,
            "updated_at": now,
        }, "$unset": {"settlement_error": ""}},
    )

    return {
        "found": True,
        "credited": True,
        "credited_now": credited_now,
        "user_id": user_id,
        "amount": amount,
        "currency": payment.get("currency", "EUR"),
        "transaction_id": transaction_id,
        "reference": reference,
        "new_balance": new_balance,
    }
