"""
Wallet Ledger System - Integrated with existing user wallet
Uses wallet_balance_cents on user document + ledger entries for audit trail
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
import uuid

from dependencies import get_current_user, get_admin_user
from config import db

router = APIRouter(prefix="/wallet-ledger", tags=["Wallet Ledger"])


class WalletTopup(BaseModel):
    amount_cents: int
    method: str = "card"  # card, bank_transfer, cash


async def get_wallet_balance(user_id: str) -> int:
    """Get wallet balance from user document"""
    user = await db.users.find_one({"id": user_id}, {"wallet_balance_cents": 1})
    return user.get("wallet_balance_cents", 0) if user else 0


async def create_ledger_entry(user_id: str, entry_type: str, amount_cents: int,
                               category: str, description: str, reference_id: str = None) -> dict:
    """Create a ledger entry AND update user balance atomically"""
    amount = abs(amount_cents)
    
    if entry_type == "debit":
        # Check sufficient balance
        current = await get_wallet_balance(user_id)
        if current < amount:
            raise HTTPException(402, f"Nicht genug Guthaben. Verfuegbar: EUR {current/100:.2f}")
        
        # Deduct from user balance
        result = await db.users.update_one(
            {"id": user_id, "wallet_balance_cents": {"$gte": amount}},
            {"$inc": {"wallet_balance_cents": -amount}}
        )
        if result.modified_count == 0:
            raise HTTPException(402, "Nicht genug Guthaben")
    else:
        # Credit to user balance
        await db.users.update_one(
            {"id": user_id},
            {"$inc": {"wallet_balance_cents": amount}},
        )
    
    # Get new balance
    new_balance = await get_wallet_balance(user_id)
    
    entry = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "type": entry_type,
        "amount_cents": amount,
        "category": category,
        "description": description,
        "reference_id": reference_id,
        "balance_after_cents": new_balance,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.wallet_ledger.insert_one(entry)
    entry.pop("_id", None)
    return entry


@router.get("/balance")
async def get_balance(user: dict = Depends(get_current_user)):
    """Get wallet balance"""
    balance = user.get("wallet_balance_cents", 0)
    return {
        "user_id": user["id"],
        "balance_cents": balance,
        "balance_eur": round(balance / 100, 2),
        "bids_balance": user.get("bids_balance", 0),
        "currency": "EUR"
    }


@router.get("/transactions")
async def get_transactions(limit: int = 50, user: dict = Depends(get_current_user)):
    """Get transaction history"""
    entries = await db.wallet_ledger.find(
        {"user_id": user["id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(limit)
    
    return {"transactions": entries, "total": len(entries)}


@router.post("/topup")
async def topup_wallet(data: WalletTopup, user: dict = Depends(get_current_user)):
    """Add funds to wallet"""
    if data.amount_cents < 100:
        raise HTTPException(400, "Mindestbetrag: EUR 1.00")
    if data.amount_cents > 50000:
        raise HTTPException(400, "Maximalbetrag: EUR 500.00")
    
    entry = await create_ledger_entry(
        user_id=user["id"],
        entry_type="credit",
        amount_cents=data.amount_cents,
        category="topup",
        description=f"Einzahlung via {data.method}"
    )
    
    return {
        "success": True,
        "entry": entry,
        "new_balance_cents": entry["balance_after_cents"],
        "message": f"EUR {data.amount_cents/100:.2f} eingezahlt"
    }


# ==================== ADMIN ====================

@router.get("/admin/user/{user_id}")
async def admin_get_user_ledger(user_id: str, admin: dict = Depends(get_admin_user)):
    """Admin: View user's ledger"""
    entries = await db.wallet_ledger.find(
        {"user_id": user_id}, {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    target_user = await db.users.find_one({"id": user_id}, {"_id": 0, "name": 1, "email": 1, "wallet_balance_cents": 1})
    
    return {
        "user": target_user,
        "transactions": entries,
        "balance_cents": target_user.get("wallet_balance_cents", 0) if target_user else 0
    }


@router.post("/admin/credit/{user_id}")
async def admin_credit_user(user_id: str, amount_cents: int = 0, reason: str = "Admin Gutschrift", admin: dict = Depends(get_admin_user)):
    """Admin: Credit user's wallet"""
    if amount_cents <= 0:
        raise HTTPException(400, "Betrag muss positiv sein")
    
    entry = await create_ledger_entry(
        user_id=user_id,
        entry_type="credit",
        amount_cents=amount_cents,
        category="admin_credit",
        description=f"Admin Gutschrift: {reason}",
        reference_id=f"admin-{admin['id']}"
    )
    
    return {"success": True, "entry": entry}
