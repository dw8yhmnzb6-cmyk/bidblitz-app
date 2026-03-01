"""
Payment Source Resolution - Uses bidblitz_pay_adapter for actual DB queries
"""
import os
from fastapi import HTTPException
from utils.bidblitz_pay_adapter import get_personal_wallet, get_business_wallet_balance

MIN_WALLET_EUR = float(os.getenv("MIN_WALLET_TO_START_EUR", "5"))

async def resolve_payment_wallet(db, user_id: str, payment_source: str, business_id: str = None):
    payment_source = (payment_source or "personal").lower().strip()

    if payment_source == "personal":
        w = await get_personal_wallet(db, user_id)
        if w["balance"] < MIN_WALLET_EUR:
            raise HTTPException(402, f"Wallet-Guthaben zu niedrig (min. {MIN_WALLET_EUR} EUR)")
        return {"source": "personal", "user_id": user_id, "business_id": None, "balance": w["balance"], "balance_cents": w["balance_cents"]}

    if payment_source == "business":
        if not business_id:
            raise HTTPException(400, "business_id erforderlich")

        m = await db.business_members.find_one({"business_id": business_id, "user_id": user_id, "status": "active"})
        if not m:
            raise HTTPException(403, "Kein Mitglied dieses Unternehmens")

        limits = m.get("limits", {})
        cap = limits.get("monthly_cap_eur")
        spent = limits.get("monthly_spent_eur", 0)
        if cap is not None and spent >= cap:
            raise HTTPException(402, f"Monatslimit erreicht ({spent:.0f}/{cap:.0f} EUR)")

        b = await db.business_accounts.find_one({"business_id": business_id})
        if not b or b.get("status") != "active":
            raise HTTPException(403, "Firmenkonto nicht aktiv")

        bal = await get_business_wallet_balance(db, business_id)
        if bal < MIN_WALLET_EUR:
            raise HTTPException(402, "Firmen-Guthaben zu niedrig")

        return {"source": "business", "user_id": user_id, "business_id": business_id, "balance": bal, "balance_cents": int(bal * 100)}

    raise HTTPException(400, "payment_source muss 'personal' oder 'business' sein")
