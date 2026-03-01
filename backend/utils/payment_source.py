"""
Payment Source Resolution - Personal vs Business Wallet
+ Update business_accounts.py with resolve_payment_wallet
"""
import os
from fastapi import HTTPException

MIN_WALLET_EUR = float(os.getenv("MIN_WALLET_TO_START_EUR", "5"))

async def resolve_payment_wallet(db, user_id: str, payment_source: str, business_id: str = None):
    """Resolve which wallet to charge: personal or business"""
    payment_source = (payment_source or "personal").lower()

    if payment_source == "personal":
        user = await db.users.find_one({"id": user_id}, {"wallet_balance_cents": 1})
        balance_cents = user.get("wallet_balance_cents", 0) if user else 0
        if balance_cents < int(MIN_WALLET_EUR * 100):
            raise HTTPException(402, f"Wallet-Guthaben zu niedrig. Minimum: {MIN_WALLET_EUR} EUR")
        return {"source": "personal", "user_id": user_id, "business_id": None, "balance_cents": balance_cents}

    if payment_source == "business":
        if not business_id:
            raise HTTPException(400, "business_id erforderlich")
        
        member = await db.business_members.find_one({"business_id": business_id, "user_id": user_id, "status": "active"})
        if not member:
            raise HTTPException(403, "Kein Mitglied dieses Unternehmens")

        # Check monthly limit
        limits = member.get("limits", {})
        cap = limits.get("monthly_cap_eur")
        spent = limits.get("monthly_spent_eur", 0)
        if cap is not None and spent >= cap:
            raise HTTPException(402, f"Monatslimit erreicht ({spent}/{cap} EUR)")

        biz = await db.business_accounts.find_one({"business_id": business_id})
        if not biz or biz.get("status") != "active":
            raise HTTPException(403, "Firmenkonto nicht aktiv")

        biz_balance = biz.get("wallet_balance_cents", 0)
        if biz_balance < int(MIN_WALLET_EUR * 100):
            raise HTTPException(402, "Firmen-Wallet zu niedrig")

        return {"source": "business", "user_id": user_id, "business_id": business_id, "balance_cents": biz_balance}

    raise HTTPException(400, "payment_source muss 'personal' oder 'business' sein")


async def charge_wallet(db, payment_info: dict, amount_cents: int, description: str):
    """Charge the resolved wallet"""
    from datetime import datetime, timezone
    import uuid
    now = datetime.now(timezone.utc).isoformat()

    if payment_info["source"] == "personal":
        await db.users.update_one({"id": payment_info["user_id"]}, {"$inc": {"wallet_balance_cents": -amount_cents}})
        await db.wallet_transactions.insert_one({"id": str(uuid.uuid4()), "user_id": payment_info["user_id"], "type": "ride_payment", "amount_cents": amount_cents, "direction": "out", "description": description, "created_at": now})
    
    elif payment_info["source"] == "business":
        await db.business_accounts.update_one({"business_id": payment_info["business_id"]}, {"$inc": {"wallet_balance_cents": -amount_cents}})
        await db.business_members.update_one(
            {"business_id": payment_info["business_id"], "user_id": payment_info["user_id"]},
            {"$inc": {"limits.monthly_spent_eur": amount_cents / 100}}
        )
        await db.wallet_transactions.insert_one({"id": str(uuid.uuid4()), "user_id": payment_info["user_id"], "type": "business_ride", "amount_cents": amount_cents, "direction": "out", "business_id": payment_info["business_id"], "description": description, "created_at": now})
