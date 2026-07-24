"""
BidBlitz V2 - Admin Approval System
Handle large transactions and crypto deposits that require admin approval
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from datetime import datetime, timezone
from core.database import db
from core.security import get_current_user
from bson import ObjectId

router = APIRouter(prefix="/api/admin/approvals", tags=["admin-approvals"])


def _ensure_admin(user: dict):
    """Only admins can access approval endpoints."""
    if user.get("role") != "admin":
        raise HTTPException(403, "Admin access required")


class ApprovalDecision(BaseModel):
    item_id: str
    decision: str  # "approve" or "reject"
    reason: str = ""


@router.get("/pending")
async def get_pending_approvals(request: Request):
    """Get all pending approvals (crypto deposits + wallet top-ups)."""
    user = await get_current_user(request)
    _ensure_admin(user)
    
    # Get pending crypto deposits
    crypto_deposits = await db.crypto_earn_deposits.find(
        {"status": "pending_approval"},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    # Get pending wallet top-ups
    wallet_topups = await db.transactions.find(
        {"status": "pending_approval", "type": "topup"},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    return {
        "pending_crypto_deposits": crypto_deposits,
        "pending_wallet_topups": wallet_topups,
        "total_pending": len(crypto_deposits) + len(wallet_topups),
    }


@router.post("/crypto-deposit")
async def approve_crypto_deposit(decision: ApprovalDecision, request: Request):
    """Approve or reject a crypto deposit."""
    user = await get_current_user(request)
    _ensure_admin(user)
    
    deposit = await db.crypto_earn_deposits.find_one(
        {"deposit_id": decision.item_id, "status": "pending_approval"}
    )
    if not deposit:
        raise HTTPException(404, "Deposit not found or already processed")
    
    now = datetime.now(timezone.utc).isoformat()
    
    if decision.decision == "approve":
        # Approve deposit
        await db.crypto_earn_deposits.update_one(
            {"deposit_id": decision.item_id},
            {"$set": {
                "status": "active",
                "approved_by": user.get("email"),
                "approved_at": now,
            }}
        )
        
        # Notify user
        await db.notifications.insert_one({
            "user_id": deposit.get("user_id"),
            "type": "success",
            "title": "✅ Crypto Earn Deposit Approved",
            "message": f"Your deposit of {deposit['amount']} {deposit['coin']} has been approved and is now earning {deposit['apy']}% APY!",
            "read": False,
            "created_at": now,
        })
        
        return {"ok": True, "message": f"Deposit approved: {deposit['amount']} {deposit['coin']}"}
    
    else:  # reject
        await db.crypto_earn_deposits.update_one(
            {"deposit_id": decision.item_id},
            {"$set": {
                "status": "rejected",
                "rejected_by": user.get("email"),
                "rejected_at": now,
                "rejection_reason": decision.reason,
            }}
        )
        
        # Notify user
        await db.notifications.insert_one({
            "user_id": deposit.get("user_id"),
            "type": "warning",
            "title": "⚠️ Crypto Earn Deposit Rejected",
            "message": f"Your deposit of {deposit['amount']} {deposit['coin']} was rejected. Reason: {decision.reason}",
            "read": False,
            "created_at": now,
        })
        
        return {"ok": True, "message": f"Deposit rejected: {deposit['amount']} {deposit['coin']}"}


@router.post("/wallet-topup")
async def approve_wallet_topup(decision: ApprovalDecision, request: Request):
    """Approve or reject a wallet top-up."""
    user = await get_current_user(request)
    _ensure_admin(user)
    
    txn = await db.transactions.find_one(
        {"id": decision.item_id, "status": "pending_approval", "type": "topup"}
    )
    if not txn:
        raise HTTPException(404, "Transaction not found or already processed")
    
    now = datetime.now(timezone.utc).isoformat()
    
    if decision.decision == "approve":
        # Approve top-up and credit user balance
        user_obj = await db.users.find_one({"_id": ObjectId(txn["user_id"])})
        if not user_obj:
            raise HTTPException(404, "User not found")
        
        await db.users.update_one(
            {"_id": ObjectId(txn["user_id"])},
            {"$inc": {"balance": txn["amount"]}}
        )
        
        await db.transactions.update_one(
            {"id": decision.item_id},
            {"$set": {
                "status": "completed",
                "approved_by": user.get("email"),
                "approved_at": now,
            }}
        )
        
        # Notify user
        await db.notifications.insert_one({
            "user_id": txn["user_id"],
            "type": "success",
            "title": "✅ Top-Up Approved",
            "message": f"Your top-up of EUR {txn['amount']:,.2f} has been approved and credited to your wallet!",
            "read": False,
            "created_at": now,
        })
        
        return {"ok": True, "message": f"Top-up approved: EUR {txn['amount']:,.2f}"}
    
    else:  # reject
        await db.transactions.update_one(
            {"id": decision.item_id},
            {"$set": {
                "status": "rejected",
                "rejected_by": user.get("email"),
                "rejected_at": now,
                "rejection_reason": decision.reason,
            }}
        )
        
        # Notify user
        await db.notifications.insert_one({
            "user_id": txn["user_id"],
            "type": "warning",
            "title": "⚠️ Top-Up Rejected",
            "message": f"Your top-up of EUR {txn['amount']:,.2f} was rejected. Reason: {decision.reason}",
            "read": False,
            "created_at": now,
        })
        
        return {"ok": True, "message": f"Top-up rejected: EUR {txn['amount']:,.2f}"}


@router.get("/stats")
async def get_approval_stats(request: Request):
    """Get approval statistics."""
    user = await get_current_user(request)
    _ensure_admin(user)
    
    pending_crypto = await db.crypto_earn_deposits.count_documents({"status": "pending_approval"})
    pending_topups = await db.transactions.count_documents({"status": "pending_approval", "type": "topup"})
    
    approved_crypto = await db.crypto_earn_deposits.count_documents({"status": "active", "needs_admin_approval": True})
    approved_topups = await db.transactions.count_documents({"status": "completed", "needs_admin_approval": True})
    
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
