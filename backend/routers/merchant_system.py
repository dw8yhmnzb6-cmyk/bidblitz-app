"""
Merchant Topup System - Commission on ALL topups (online + cash) + Daily Limit
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from datetime import datetime, timezone, timedelta
import uuid

from dependencies import get_current_user, get_admin_user
from config import db

router = APIRouter(prefix="/merchant", tags=["Merchant"])

DEFAULT_COMMISSION_RATE = 1.0  # 1%
DEFAULT_DAILY_LIMIT = 3000  # EUR


class MerchantCashTopup(BaseModel):
    user_id: str
    amount: float

class MerchantRegister(BaseModel):
    commission_rate_percent: float = 1.0
    daily_limit: float = 3000


async def apply_merchant_commission(user_id: str, amount_cents: int, merchant_id: str = None):
    """Apply commission on topup - works for online AND cash"""
    merchant = None
    rate = DEFAULT_COMMISSION_RATE

    if merchant_id:
        merchant = await db.merchant_profiles.find_one({"user_id": merchant_id})
        if merchant:
            rate = merchant.get("commission_rate_percent", DEFAULT_COMMISSION_RATE)

    commission_cents = int(amount_cents * rate / 100)
    net_cents = amount_cents - commission_cents
    now = datetime.now(timezone.utc).isoformat()

    # Credit user wallet (net)
    await db.users.update_one({"id": user_id}, {"$inc": {"wallet_balance_cents": net_cents}})

    # User transaction
    await db.wallet_transactions.insert_one({
        "id": str(uuid.uuid4()), "user_id": user_id,
        "type": "topup_cash" if merchant_id else "topup_online",
        "amount_cents": net_cents, "direction": "in",
        "merchant_id": merchant_id, "created_at": now,
        "metadata": {"gross": amount_cents, "commission": commission_cents, "rate": rate}
    })

    # Commission to platform
    platform = await db.users.find_one({"email": "platform@bidblitz.ae"})
    if platform and commission_cents > 0:
        await db.users.update_one({"id": platform["id"]}, {"$inc": {"wallet_balance_cents": commission_cents}})
        await db.wallet_transactions.insert_one({
            "id": str(uuid.uuid4()), "user_id": platform["id"],
            "type": "commission", "amount_cents": commission_cents, "direction": "in",
            "merchant_id": merchant_id, "created_at": now,
            "metadata": {"topup_user": user_id, "gross": amount_cents, "rate": rate}
        })

    return {"net_cents": net_cents, "commission_cents": commission_cents, "rate": rate}


@router.post("/cash-topup")
async def merchant_cash_topup(data: MerchantCashTopup, user: dict = Depends(get_current_user)):
    """Merchant tops up customer wallet via cash/QR"""
    # Check merchant profile
    profile = await db.merchant_profiles.find_one({"user_id": user["id"]})
    if not profile or not profile.get("is_active", True):
        raise HTTPException(403, "Kein aktives Merchant-Konto")

    amount_cents = int(data.amount * 100)
    if amount_cents < 100:
        raise HTTPException(400, "Mindestbetrag: 1 EUR")

    # Check daily limit
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0).isoformat()
    today_total = await db.wallet_transactions.aggregate([
        {"$match": {"merchant_id": user["id"], "created_at": {"$gte": today_start}}},
        {"$group": {"_id": None, "total": {"$sum": "$amount_cents"}}}
    ]).to_list(1)
    daily_used = (today_total[0]["total"] if today_total else 0) / 100
    daily_limit = profile.get("daily_limit", DEFAULT_DAILY_LIMIT)

    if daily_used + data.amount > daily_limit:
        raise HTTPException(400, f"Tageslimit erreicht ({daily_used:.0f}/{daily_limit:.0f} EUR)")

    # Check target user exists
    target = await db.users.find_one({"id": data.user_id})
    if not target:
        raise HTTPException(404, "Kunde nicht gefunden")

    result = await apply_merchant_commission(data.user_id, amount_cents, user["id"])

    return {
        "success": True,
        "customer_name": target.get("name"),
        "gross_amount": data.amount,
        "net_credited": result["net_cents"] / 100,
        "commission": result["commission_cents"] / 100,
        "commission_rate": result["rate"],
        "message": f"{result['net_cents']/100:.2f} EUR an {target.get('name')} gutgeschrieben"
    }


@router.post("/online-topup")
async def online_topup(amount: float, user: dict = Depends(get_current_user)):
    """Online wallet topup (commission still applies)"""
    amount_cents = int(amount * 100)
    if amount_cents < 100:
        raise HTTPException(400, "Mindestbetrag: 1 EUR")

    result = await apply_merchant_commission(user["id"], amount_cents)

    return {
        "success": True,
        "gross_amount": amount,
        "net_credited": result["net_cents"] / 100,
        "commission": result["commission_cents"] / 100,
        "message": f"{result['net_cents']/100:.2f} EUR aufgeladen (Fee: {result['commission_cents']/100:.2f} EUR)"
    }


@router.get("/my-transactions")
async def merchant_transactions(user: dict = Depends(get_current_user)):
    """Get merchant's topup transactions"""
    txns = await db.wallet_transactions.find(
        {"merchant_id": user["id"]}, {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    return {"transactions": txns}


@router.get("/my-stats")
async def merchant_stats(user: dict = Depends(get_current_user)):
    """Get merchant stats"""
    profile = await db.merchant_profiles.find_one({"user_id": user["id"]}, {"_id": 0})
    pipeline = [
        {"$match": {"merchant_id": user["id"], "type": "commission"}},
        {"$group": {"_id": None, "total": {"$sum": "$amount_cents"}, "count": {"$sum": 1}}}
    ]
    result = await db.wallet_transactions.aggregate(pipeline).to_list(1)
    s = result[0] if result else {}
    return {
        "profile": profile,
        "total_commission_cents": s.get("total", 0),
        "total_topups": s.get("count", 0)
    }


# ==================== ADMIN ====================

@router.post("/admin/create")
async def admin_create_merchant(user_id: str, data: MerchantRegister = MerchantRegister(), admin: dict = Depends(get_admin_user)):
    """Admin: Create merchant profile for a user"""
    await db.merchant_profiles.update_one(
        {"user_id": user_id},
        {"$set": {
            "user_id": user_id,
            "commission_rate_percent": data.commission_rate_percent,
            "daily_limit": data.daily_limit,
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        }},
        upsert=True
    )
    await db.users.update_one({"id": user_id}, {"$set": {"is_merchant": True, "role": "merchant"}})
    return {"success": True, "message": "Merchant-Profil erstellt"}

@router.get("/admin/list")
async def admin_list_merchants(admin: dict = Depends(get_admin_user)):
    merchants = await db.merchant_profiles.find({}, {"_id": 0}).to_list(100)
    for m in merchants:
        u = await db.users.find_one({"id": m["user_id"]}, {"_id": 0, "name": 1, "email": 1})
        if u:
            m["name"] = u.get("name")
            m["email"] = u.get("email")
    return {"merchants": merchants}
