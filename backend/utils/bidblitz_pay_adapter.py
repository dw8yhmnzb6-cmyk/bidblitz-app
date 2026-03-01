"""
BidBlitz Pay Adapter - Maps to actual DB structure
Personal wallet: db.users.wallet_balance_cents (integer, cents)
Business wallet: db.business_accounts.wallet_balance_cents (integer, cents)
"""
from fastapi import HTTPException
from datetime import datetime, timezone
import uuid


async def get_personal_wallet(db, user_id: str) -> dict:
    """BidBlitz uses db.users.wallet_balance_cents"""
    u = await db.users.find_one({"id": user_id}, {"wallet_balance_cents": 1})
    cents = u.get("wallet_balance_cents", 0) if u else 0
    return {"user_id": user_id, "balance": cents / 100, "balance_cents": cents}


async def get_business_wallet_balance(db, business_id: str) -> float:
    """Business wallet stored in business_accounts.wallet_balance_cents"""
    b = await db.business_accounts.find_one({"business_id": business_id}, {"wallet_balance_cents": 1})
    cents = b.get("wallet_balance_cents", 0) if b else 0
    return cents / 100


async def debit_personal_wallet(db, user_id: str, amount_cents: int, description: str = "", meta: dict = None):
    """Atomic debit from user wallet_balance_cents"""
    if amount_cents <= 0:
        return
    r = await db.users.update_one(
        {"id": user_id, "wallet_balance_cents": {"$gte": amount_cents}},
        {"$inc": {"wallet_balance_cents": -amount_cents}}
    )
    if r.matched_count == 0:
        raise HTTPException(402, "Nicht genug Guthaben")

    await db.wallet_ledger.insert_one({
        "id": str(uuid.uuid4()), "user_id": user_id, "type": "debit",
        "amount_cents": amount_cents, "category": "payment",
        "description": description, "metadata": meta or {},
        "created_at": datetime.now(timezone.utc).isoformat()
    })


async def debit_business_wallet(db, business_id: str, user_id: str, amount_cents: int, description: str = "", meta: dict = None):
    """Atomic debit from business wallet + update monthly spent"""
    if amount_cents <= 0:
        return
    r = await db.business_accounts.update_one(
        {"business_id": business_id, "wallet_balance_cents": {"$gte": amount_cents}},
        {"$inc": {"wallet_balance_cents": -amount_cents}}
    )
    if r.matched_count == 0:
        raise HTTPException(402, "Firmen-Guthaben nicht ausreichend")

    # Update monthly spent for the member
    await db.business_members.update_one(
        {"business_id": business_id, "user_id": user_id},
        {"$inc": {"limits.monthly_spent_eur": amount_cents / 100}}
    )

    await db.business_ledger.insert_one({
        "id": str(uuid.uuid4()), "business_id": business_id, "user_id": user_id,
        "type": "debit", "amount_cents": amount_cents,
        "description": description, "metadata": meta or {},
        "created_at": datetime.now(timezone.utc).isoformat()
    })
