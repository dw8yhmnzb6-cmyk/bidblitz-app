from __future__ import annotations

import hashlib
from datetime import datetime, timezone
from typing import Any

from bson import ObjectId

from core.database import db


class BidCreditSettlementNeedsReview(RuntimeError):
    """Raised when legacy bid-credit state cannot be proven safe to auto-settle."""


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _user_selector(user_id: str) -> dict[str, Any]:
    candidates: list[dict[str, Any]] = [{"_id": user_id}]
    if ObjectId.is_valid(user_id):
        candidates.append({"_id": ObjectId(user_id)})
    return {"$or": candidates}


def _transaction_selector(session_id: str, user_id: str) -> dict[str, Any]:
    return {
        "stripe_session_id": session_id,
        "user_id": user_id,
        "type": "bid_credits_purchase",
        "status": "completed",
    }


def _transaction_identity(session_id: str) -> tuple[str, str, str]:
    digest = hashlib.sha256(session_id.encode("utf-8")).hexdigest().upper()
    return (
        f"stripe_bid_credits:{session_id}",
        f"BID-{digest[:16]}",
        f"BIDS-{session_id[:12].upper()}",
    )


async def _mark_manual_review(payment: dict[str, Any], reason: str) -> None:
    await db.payment_transactions.update_one(
        {"session_id": payment["session_id"]},
        {"$set": {
            "credit_settlement_status": "manual_review_required",
            "settlement_error": reason,
            "updated_at": _now_iso(),
        }},
    )


async def settle_stripe_bid_credits(
    session_id: str,
    *,
    metadata: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Apply one paid Stripe bid-credit purchase exactly once.

    The Stripe webhook caller must already have verified that the checkout is paid.
    The user credit increment and Stripe-session marker are written atomically in the
    same user document. A deterministic transaction row then provides audit proof.
    """
    payment = await db.payment_transactions.find_one({"session_id": session_id})
    if not payment:
        return {"found": False, "credited": False, "credited_now": False}

    payment_meta = payment.get("metadata") or {}
    event_meta = metadata or {}
    if payment_meta.get("type") != "bid_credits" and event_meta.get("type") != "bid_credits":
        return {"found": False, "credited": False, "credited_now": False}

    merged_meta = {**event_meta, **payment_meta}
    user_id = str(payment.get("user_id") or merged_meta.get("user_id") or "")
    pending_id = str(merged_meta.get("pending_id") or "")
    try:
        credits_to_add = int(merged_meta.get("credits", 0) or 0)
    except (TypeError, ValueError):
        credits_to_add = 0

    if not user_id:
        await _mark_manual_review(payment, "missing_user_id")
        raise BidCreditSettlementNeedsReview("Stripe bid-credit purchase is missing user_id")
    if credits_to_add <= 0:
        await _mark_manual_review(payment, "invalid_credit_amount")
        raise BidCreditSettlementNeedsReview("Stripe bid-credit purchase has invalid credit amount")

    txn_mongo_id, generated_txn_id, generated_reference = _transaction_identity(session_id)
    txn_selector = _transaction_selector(session_id, user_id)
    existing_txn = await db.transactions.find_one(
        txn_selector,
        {"_id": 1, "id": 1, "reference": 1, "credits": 1},
    )
    if existing_txn:
        try:
            existing_credits = int(existing_txn.get("credits", 0) or 0)
        except (TypeError, ValueError):
            existing_credits = 0
        if existing_credits != credits_to_add:
            await _mark_manual_review(payment, "legacy_transaction_credit_mismatch")
            raise BidCreditSettlementNeedsReview(
                "Legacy Stripe bid-credit transaction does not match purchased credits"
            )

    user_query = _user_selector(user_id)
    user = await db.users.find_one(
        user_query,
        {"bid_credits": 1, "stripe_bid_credit_sessions": 1},
    )
    if not user:
        raise RuntimeError("Stripe bid-credit settlement failed: user not found")

    credited_sessions = user.get("stripe_bid_credit_sessions", []) or []
    has_marker = session_id in credited_sessions

    # In the legacy flow, the user credits were incremented before the completed
    # transaction row was inserted. A completed transaction is therefore proof of
    # an already-applied credit, even when payment_status is stale.
    if existing_txn and not has_marker:
        await db.users.update_one(
            user_query,
            {"$addToSet": {"stripe_bid_credit_sessions": session_id}},
        )
        has_marker = True

    # Old code set payment_status=credited before incrementing the user credits.
    # Without either a durable user marker or completed transaction, that state is
    # ambiguous: another increment could duplicate credits, while skipping could
    # lose them. Stop for manual review instead of guessing.
    if payment.get("payment_status") == "credited" and not has_marker and not existing_txn:
        await _mark_manual_review(payment, "legacy_credited_without_credit_proof")
        raise BidCreditSettlementNeedsReview(
            "Legacy Stripe bid-credit purchase needs manual review"
        )

    credited_now = False
    if not has_marker:
        await db.payment_transactions.update_one(
            {"session_id": session_id},
            {"$set": {
                "payment_status": "paid",
                "credit_settlement_status": "settling",
                "settlement_version": 2,
                "updated_at": _now_iso(),
            }},
        )

        credit_time = _now_iso()
        result = await db.users.update_one(
            {
                **user_query,
                "stripe_bid_credit_sessions": {"$ne": session_id},
            },
            {
                "$inc": {"bid_credits": credits_to_add},
                "$addToSet": {"stripe_bid_credit_sessions": session_id},
                "$set": {"last_bid_credit_update": credit_time},
            },
        )
        user = await db.users.find_one(
            user_query,
            {"bid_credits": 1, "stripe_bid_credit_sessions": 1},
        )
        if not user:
            raise RuntimeError("Stripe bid-credit settlement failed: user disappeared")
        sessions = user.get("stripe_bid_credit_sessions", []) or []
        if result.modified_count != 1 and session_id not in sessions:
            raise RuntimeError("Stripe bid-credit settlement failed: credits not applied")
        credited_now = result.modified_count == 1

    transaction_id = generated_txn_id
    reference = generated_reference
    if existing_txn is None:
        txn_doc = {
            "_id": txn_mongo_id,
            "id": generated_txn_id,
            "idempotency_key": f"stripe_bid_credits:{session_id}",
            "user_id": user_id,
            "type": "bid_credits_purchase",
            "amount": payment.get("amount", 0),
            "credits": credits_to_add,
            "description": f"{credits_to_add}x Gebot-Credits",
            "merchant_name": "BidBlitz",
            "status": "completed",
            "reference": generated_reference,
            "payment_method": "stripe",
            "category": "auction_credits",
            "stripe_session_id": session_id,
            "settlement_version": 2,
            "created_at": _now_iso(),
        }
        try:
            await db.transactions.insert_one(txn_doc)
        except Exception:
            existing_txn = await db.transactions.find_one(
                txn_selector,
                {"_id": 1, "id": 1, "reference": 1, "credits": 1},
            )
            if not existing_txn:
                await db.payment_transactions.update_one(
                    {"session_id": session_id},
                    {"$set": {
                        "payment_status": "paid",
                        "credit_settlement_status": "credits_applied_audit_pending",
                        "settlement_version": 2,
                        "updated_at": _now_iso(),
                    }},
                )
                raise RuntimeError(
                    "Stripe bid credits applied but transaction audit is pending"
                )

    if existing_txn:
        transaction_id = str(existing_txn.get("id") or generated_txn_id)
        reference = str(existing_txn.get("reference") or generated_reference)

    if pending_id:
        await db.pending_credit_purchases.update_one(
            {"pending_id": pending_id},
            {"$set": {
                "status": "completed",
                "completed_at": _now_iso(),
                "session_id": session_id,
            }},
        )

    user = await db.users.find_one(user_query, {"bid_credits": 1})
    new_balance = int((user or {}).get("bid_credits", 0) or 0)
    now = _now_iso()
    await db.payment_transactions.update_one(
        {"session_id": session_id},
        {
            "$set": {
                "payment_status": "credited",
                "credit_settlement_status": "credited",
                "settlement_version": 2,
                "transaction_id": transaction_id,
                "reference": reference,
                "credited_at": now,
                "completed_at": now,
                "updated_at": now,
            },
            "$unset": {"settlement_error": ""},
        },
    )

    return {
        "found": True,
        "credited": True,
        "credited_now": credited_now,
        "user_id": user_id,
        "credits": credits_to_add,
        "new_bid_credit_balance": new_balance,
        "transaction_id": transaction_id,
        "reference": reference,
    }
