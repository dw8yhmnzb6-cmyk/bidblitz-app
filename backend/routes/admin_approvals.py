"""
BidBlitz V2 - Admin Approval System
Handle large transactions and crypto deposits that require admin approval.
"""
from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from core.database import db
from core.payment_engine import TransactionType, credit_wallet
from core.security import get_current_user

router = APIRouter(prefix="/api/admin/approvals", tags=["admin-approvals"])


TOPUP_PENDING_STATUSES = (
    "pending_approval",
    "approval_processing",
    "approval_failed",
    "approval_reconciliation_required",
)
TOPUP_APPROVED_STATUS = "approval_completed"


def _ensure_admin(user: dict):
    """Only admins can access approval endpoints."""
    if user.get("role") not in ("admin", "super_admin"):
        raise HTTPException(403, "Admin access required")


def _validate_decision(decision: str) -> None:
    if decision not in {"approve", "reject"}:
        raise HTTPException(400, "Decision must be 'approve' or 'reject'")


class ApprovalDecision(BaseModel):
    item_id: str
    decision: str
    reason: str = ""


async def _notify_once(notification_id: str, payload: dict) -> None:
    """Create an approval notification at most once across retries/replays."""
    await db.notifications.update_one(
        {"id": notification_id},
        {"$setOnInsert": {"id": notification_id, **payload}},
        upsert=True,
    )


@router.get("/pending")
async def get_pending_approvals(request: Request):
    """Get all pending approvals (crypto deposits + wallet top-ups)."""
    user = await get_current_user(request)
    _ensure_admin(user)

    crypto_deposits = await db.crypto_earn_deposits.find(
        {"status": "pending_approval"},
        {"_id": 0},
    ).sort("created_at", -1).to_list(100)

    wallet_topups = await db.transactions.find(
        {"status": {"$in": list(TOPUP_PENDING_STATUSES)}, "type": "topup", "needs_admin_approval": True},
        {"_id": 0},
    ).sort("created_at", -1).to_list(100)

    return {
        "pending_crypto_deposits": crypto_deposits,
        "pending_wallet_topups": wallet_topups,
        "total_pending": len(crypto_deposits) + len(wallet_topups),
    }


@router.post("/crypto-deposit")
async def approve_crypto_deposit(decision: ApprovalDecision, request: Request):
    """Approve or reject a crypto deposit exactly once."""
    user = await get_current_user(request)
    _ensure_admin(user)
    _validate_decision(decision.decision)

    deposit = await db.crypto_earn_deposits.find_one(
        {"deposit_id": decision.item_id, "status": "pending_approval"}
    )
    if not deposit:
        raise HTTPException(404, "Deposit not found or already processed")

    now = datetime.now(timezone.utc).isoformat()

    if decision.decision == "approve":
        update_result = await db.crypto_earn_deposits.update_one(
            {"deposit_id": decision.item_id, "status": "pending_approval"},
            {"$set": {
                "status": "active",
                "approved_by": user.get("email"),
                "approved_at": now,
            }},
        )
        if update_result.modified_count != 1:
            raise HTTPException(409, "Deposit approval already processed")

        await _notify_once(
            f"crypto-deposit-approved:{decision.item_id}",
            {
                "user_id": deposit.get("user_id"),
                "type": "success",
                "title": "✅ Crypto Earn Deposit Approved",
                "message": f"Your deposit of {deposit['amount']} {deposit['coin']} has been approved and is now earning {deposit['apy']}% APY!",
                "read": False,
                "created_at": now,
            },
        )
        return {"ok": True, "message": f"Deposit approved: {deposit['amount']} {deposit['coin']}"}

    update_result = await db.crypto_earn_deposits.update_one(
        {"deposit_id": decision.item_id, "status": "pending_approval"},
        {"$set": {
            "status": "rejected",
            "rejected_by": user.get("email"),
            "rejected_at": now,
            "rejection_reason": decision.reason,
        }},
    )
    if update_result.modified_count != 1:
        raise HTTPException(409, "Deposit rejection already processed")

    await _notify_once(
        f"crypto-deposit-rejected:{decision.item_id}",
        {
            "user_id": deposit.get("user_id"),
            "type": "warning",
            "title": "⚠️ Crypto Earn Deposit Rejected",
            "message": f"Your deposit of {deposit['amount']} {deposit['coin']} was rejected. Reason: {decision.reason}",
            "read": False,
            "created_at": now,
        },
    )
    return {"ok": True, "message": f"Deposit rejected: {deposit['amount']} {deposit['coin']}"}


@router.post("/wallet-topup")
async def approve_wallet_topup(decision: ApprovalDecision, request: Request):
    """Approve or reject a wallet top-up without allowing duplicate credits.

    Approval first claims the request with an atomic status transition. The actual
    balance mutation then goes through the canonical wallet/payment engine with a
    deterministic idempotency key. A retry after a crash therefore replays the same
    settlement instead of crediting the user again.
    """
    user = await get_current_user(request)
    _ensure_admin(user)
    _validate_decision(decision.decision)

    txn = await db.transactions.find_one({"id": decision.item_id, "type": "topup"})
    if not txn:
        raise HTTPException(404, "Transaction not found")

    now = datetime.now(timezone.utc).isoformat()

    if decision.decision == "reject":
        if txn.get("status") == "rejected":
            return {"ok": True, "message": f"Top-up already rejected: EUR {txn['amount']:,.2f}", "idempotent_replay": True}
        if txn.get("status") != "pending_approval":
            raise HTTPException(409, f"Top-up cannot be rejected from status: {txn.get('status')}")

        reject_result = await db.transactions.update_one(
            {"id": decision.item_id, "type": "topup", "status": "pending_approval"},
            {"$set": {
                "status": "rejected",
                "rejected_by": user.get("email"),
                "rejected_at": now,
                "rejection_reason": decision.reason,
            }},
        )
        if reject_result.modified_count != 1:
            raise HTTPException(409, "Top-up decision is already being processed")

        await _notify_once(
            f"wallet-topup-rejected:{decision.item_id}",
            {
                "user_id": txn["user_id"],
                "type": "warning",
                "title": "⚠️ Top-Up Rejected",
                "message": f"Your top-up of EUR {txn['amount']:,.2f} was rejected. Reason: {decision.reason}",
                "read": False,
                "created_at": now,
            },
        )
        return {"ok": True, "message": f"Top-up rejected: EUR {txn['amount']:,.2f}"}

    if txn.get("status") == TOPUP_APPROVED_STATUS:
        return {
            "ok": True,
            "message": f"Top-up already approved: EUR {txn['amount']:,.2f}",
            "settlement_transaction_id": txn.get("settlement_transaction_id"),
            "idempotent_replay": True,
        }

    if txn.get("status") == "pending_approval":
        claim = await db.transactions.update_one(
            {"id": decision.item_id, "type": "topup", "status": "pending_approval"},
            {"$set": {
                "status": "approval_processing",
                "approval_processing_by": user.get("email"),
                "approval_processing_at": now,
            }},
        )
        if claim.modified_count != 1:
            txn = await db.transactions.find_one({"id": decision.item_id, "type": "topup"}) or txn
        else:
            txn["status"] = "approval_processing"

    if txn.get("status") not in {"approval_processing", "approval_failed", "approval_reconciliation_required"}:
        raise HTTPException(409, f"Top-up cannot be approved from status: {txn.get('status')}")

    user_obj = await db.users.find_one({"_id": ObjectId(txn["user_id"])})
    if not user_obj:
        await db.transactions.update_one(
            {"id": decision.item_id, "status": {"$in": list(TOPUP_PENDING_STATUSES)}},
            {"$set": {"status": "approval_failed", "approval_error": "User not found", "approval_failed_at": now}},
        )
        raise HTTPException(404, "User not found")

    settlement_key = f"wallet_topup_approval:{decision.item_id}"
    result = await credit_wallet(
        user_id=txn["user_id"],
        amount=txn["amount"],
        tx_type=TransactionType.TOPUP,
        description=f"Approved top-up via {txn.get('payment_method', 'admin_approval')}",
        reference=txn.get("reference") or decision.item_id,
        source="admin_approval",
        metadata={
            "approval_request_transaction_id": decision.item_id,
            "approved_by": user.get("email"),
            "payment_method": txn.get("payment_method"),
            "audit_metadata": {"route": "admin_approvals.wallet_topup"},
        },
        idempotency_key=settlement_key,
    )

    if not result.success:
        result_status = getattr(result.status, "value", result.status)
        if result_status == "pending":
            raise HTTPException(409, "Top-up approval settlement is already processing")

        failure_status = "approval_reconciliation_required" if result_status == "reconciliation_required" else "approval_failed"
        await db.transactions.update_one(
            {"id": decision.item_id, "type": "topup", "status": {"$in": list(TOPUP_PENDING_STATUSES)}},
            {"$set": {
                "status": failure_status,
                "approval_error": result.error or "Top-up settlement failed",
                "approval_failed_at": datetime.now(timezone.utc).isoformat(),
                "approval_settlement_idempotency_key": settlement_key,
            }},
        )
        raise HTTPException(409, result.error or "Top-up settlement failed")

    approved_at = datetime.now(timezone.utc).isoformat()
    finalize = await db.transactions.update_one(
        {
            "id": decision.item_id,
            "type": "topup",
            "status": {"$in": list(TOPUP_PENDING_STATUSES)},
        },
        {"$set": {
            "status": TOPUP_APPROVED_STATUS,
            "approved_by": user.get("email"),
            "approved_at": approved_at,
            "settlement_transaction_id": result.transaction_id,
            "approval_settlement_idempotency_key": settlement_key,
            "canonical_source": "users.balance",
        }},
    )

    if finalize.modified_count != 1:
        latest = await db.transactions.find_one({"id": decision.item_id, "type": "topup"})
        if not latest or latest.get("status") != TOPUP_APPROVED_STATUS:
            raise HTTPException(409, "Top-up settlement completed but approval record needs reconciliation")
        return {
            "ok": True,
            "message": f"Top-up already approved: EUR {txn['amount']:,.2f}",
            "settlement_transaction_id": latest.get("settlement_transaction_id") or result.transaction_id,
            "idempotent_replay": True,
        }

    await _notify_once(
        f"wallet-topup-approved:{decision.item_id}",
        {
            "user_id": txn["user_id"],
            "type": "success",
            "title": "✅ Top-Up Approved",
            "message": f"Your top-up of EUR {txn['amount']:,.2f} has been approved and credited to your wallet!",
            "read": False,
            "created_at": approved_at,
        },
    )

    return {
        "ok": True,
        "message": f"Top-up approved: EUR {txn['amount']:,.2f}",
        "settlement_transaction_id": result.transaction_id,
        "new_balance": result.new_balance,
        "idempotent_replay": bool(getattr(result, "idempotent_replay", False)),
    }


@router.get("/stats")
async def get_approval_stats(request: Request):
    """Get approval statistics."""
    user = await get_current_user(request)
    _ensure_admin(user)

    pending_crypto = await db.crypto_earn_deposits.count_documents({"status": "pending_approval"})
    pending_topups = await db.transactions.count_documents({
        "status": {"$in": list(TOPUP_PENDING_STATUSES)},
        "type": "topup",
        "needs_admin_approval": True,
    })

    approved_crypto = await db.crypto_earn_deposits.count_documents({"status": "active", "needs_admin_approval": True})
    approved_topups = await db.transactions.count_documents({
        "status": {"$in": ["completed", TOPUP_APPROVED_STATUS]},
        "needs_admin_approval": True,
    })

    rejected_crypto = await db.crypto_earn_deposits.count_documents({"status": "rejected"})
    rejected_topups = await db.transactions.count_documents({"status": "rejected", "type": "topup"})

    return {
        "pending": {
            "crypto_deposits": pending_crypto,
            "wallet_topups": pending_topups,
            "total": pending_crypto + pending_topups,
        },
        "approved": {
            "crypto_deposits": approved_crypto,
            "wallet_topups": approved_topups,
            "total": approved_crypto + approved_topups,
        },
        "rejected": {
            "crypto_deposits": rejected_crypto,
            "wallet_topups": rejected_topups,
            "total": rejected_crypto + rejected_topups,
        },
    }
