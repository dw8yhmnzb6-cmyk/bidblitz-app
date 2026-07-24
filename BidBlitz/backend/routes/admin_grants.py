"""
BidBlitz V2 - Admin Grants & Coupon System
Admin can grant balance, coins, create coupons. Users can redeem coupons.
"""

from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel, Field
from datetime import datetime, timezone
from typing import Optional
import secrets, string

from core.security import get_current_user
from core.database import db

router = APIRouter(prefix="/api/admin/grants", tags=["admin-grants"])


# ══════════════════════════════════════════════════════════════════════════════
# ADMIN: Grant Balance / Coins to User
# ══════════════════════════════════════════════════════════════════════════════

class GrantRequest(BaseModel):
    user_email: str
    grant_type: str  # "eur", "coins", "bid_credits", "blz"
    amount: float = Field(..., gt=0)
    reason: str = ""


@router.post("/balance")
async def admin_grant_balance(req: GrantRequest, request: Request):
    """Admin: Grant EUR, Coins, Bid Credits, or BLZ to a user."""
    admin = await get_current_user(request)
    if admin.get("role") != "admin":
        raise HTTPException(403, "Nur für Admins")

    user = await db.users.find_one({"email": req.user_email})
    if not user:
        raise HTTPException(404, f"User '{req.user_email}' nicht gefunden")

    now = datetime.now(timezone.utc).isoformat()
    user_id = str(user["_id"])
    field_map = {"eur": "balance", "coins": "coins", "bid_credits": "bid_credits", "blz": "blz_balance"}
    field = field_map.get(req.grant_type)
    if not field:
        raise HTTPException(400, f"Unbekannter Typ: {req.grant_type}. Erlaubt: eur, coins, bid_credits, blz")

    await db.users.update_one({"_id": user["_id"]}, {"$inc": {field: req.amount}})

    # Transaction record
    await db.transactions.insert_one({
        "tx_id": secrets.token_hex(8),
        "user_id": user_id,
        "type": "ADMIN_GRANT",
        "amount": req.amount,
        "description": f"Admin-Gutschrift: {req.amount} {req.grant_type.upper()} — {req.reason or 'Keine Angabe'}",
        "granted_by": str(admin["_id"]),
        "grant_type": req.grant_type,
        "created_at": now,
    })

    # Notify user
    type_labels = {"eur": "EUR", "coins": "Coins", "bid_credits": "Bid Credits", "blz": "BLZ Token"}
    await db.notifications.insert_one({
        "id": secrets.token_hex(8),
        "user_id": user_id,
        "type": "admin_grant",
        "title": f"Gutschrift erhalten!",
        "message": f"Du hast {req.amount:.2f} {type_labels.get(req.grant_type, req.grant_type)} erhalten. {req.reason}",
        "read": False,
        "created_at": now,
    })

    updated = await db.users.find_one({"_id": user["_id"]})
    return {
        "ok": True,
        "user_email": req.user_email,
        "granted": req.amount,
        "type": req.grant_type,
        "new_value": updated.get(field, 0),
    }


# ══════════════════════════════════════════════════════════════════════════════
# ADMIN: Create Coupons
# ══════════════════════════════════════════════════════════════════════════════

class CreateCouponRequest(BaseModel):
    coupon_type: str  # "eur", "coins", "bid_credits", "blz", "kids_abo", "premium_month"
    value: float = Field(..., gt=0)
    max_uses: int = Field(default=1, ge=1, le=10000)
    code: Optional[str] = None  # auto-generate if not provided
    description: str = ""
    expires_days: int = Field(default=30, ge=1, le=365)


@router.post("/coupon/create")
async def admin_create_coupon(req: CreateCouponRequest, request: Request):
    """Admin: Create a coupon code."""
    admin = await get_current_user(request)
    if admin.get("role") != "admin":
        raise HTTPException(403, "Nur für Admins")

    code = req.code or ("BLITZ-" + "".join(secrets.choice(string.ascii_uppercase + string.digits) for _ in range(6)))
    code = code.upper().strip()

    # Check uniqueness
    existing = await db.coupons.find_one({"code": code})
    if existing:
        raise HTTPException(400, f"Code '{code}' existiert bereits")

    now = datetime.now(timezone.utc)
    from datetime import timedelta
    expires = now + timedelta(days=req.expires_days)

    coupon = {
        "coupon_id": secrets.token_hex(8),
        "code": code,
        "coupon_type": req.coupon_type,
        "value": req.value,
        "description": req.description or f"{req.value} {req.coupon_type.upper()}",
        "max_uses": req.max_uses,
        "used_count": 0,
        "used_by": [],
        "created_by": str(admin["_id"]),
        "created_at": now.isoformat(),
        "expires_at": expires.isoformat(),
        "active": True,
    }
    await db.coupons.insert_one(coupon)
    coupon.pop("_id", None)

    return {"ok": True, "coupon": coupon}


@router.get("/coupons")
async def admin_list_coupons(request: Request):
    """Admin: List all coupons."""
    admin = await get_current_user(request)
    if admin.get("role") != "admin":
        raise HTTPException(403, "Nur für Admins")

    coupons = await db.coupons.find({}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return {"coupons": coupons, "total": len(coupons)}


@router.delete("/coupon/{coupon_id}")
async def admin_delete_coupon(coupon_id: str, request: Request):
    """Admin: Deactivate a coupon."""
    admin = await get_current_user(request)
    if admin.get("role") != "admin":
        raise HTTPException(403, "Nur für Admins")

    await db.coupons.update_one({"coupon_id": coupon_id}, {"$set": {"active": False}})
    return {"ok": True}


# ══════════════════════════════════════════════════════════════════════════════
# USER: Redeem Coupon
# ══════════════════════════════════════════════════════════════════════════════

class RedeemRequest(BaseModel):
    code: str


@router.post("/coupon/redeem")
async def redeem_coupon(req: RedeemRequest, request: Request):
    """User: Redeem a coupon code."""
    user = await get_current_user(request)
    user_id = str(user["_id"])

    code = req.code.upper().strip()
    coupon = await db.coupons.find_one({"code": code, "active": True})
    if not coupon:
        raise HTTPException(404, "Ungültiger Gutscheincode")

    # Check expiry
    if coupon.get("expires_at"):
        expires = datetime.fromisoformat(coupon["expires_at"].replace("Z", "+00:00"))
        if datetime.now(timezone.utc) > expires:
            raise HTTPException(400, "Gutschein ist abgelaufen")

    # Check max uses
    if coupon["used_count"] >= coupon["max_uses"]:
        raise HTTPException(400, "Gutschein wurde bereits vollständig eingelöst")

    # Check if user already redeemed
    if user_id in coupon.get("used_by", []):
        raise HTTPException(400, "Du hast diesen Gutschein bereits eingelöst")

    now = datetime.now(timezone.utc).isoformat()
    ct = coupon["coupon_type"]
    val = coupon["value"]

    # Apply reward based on type
    if ct == "eur":
        await db.users.update_one({"_id": user["_id"]}, {"$inc": {"balance": val}})
        reward_msg = f"€{val:.2f} Guthaben"
    elif ct == "coins":
        await db.users.update_one({"_id": user["_id"]}, {"$inc": {"coins": val}})
        reward_msg = f"{int(val)} Coins"
    elif ct == "bid_credits":
        await db.users.update_one({"_id": user["_id"]}, {"$inc": {"bid_credits": int(val)}})
        reward_msg = f"{int(val)} Bid Credits"
    elif ct == "blz":
        await db.users.update_one({"_id": user["_id"]}, {"$inc": {"blz_balance": val}})
        reward_msg = f"{val:.2f} BLZ Token"
    elif ct == "kids_abo":
        # Grant Kids subscription
        from datetime import timedelta
        sub_end = datetime.now(timezone.utc) + timedelta(days=int(val) * 30)
        await db.kids_subscriptions.update_one(
            {"user_id": user_id},
            {"$set": {
                "plan": "premium", "status": "active",
                "expires_at": sub_end.isoformat(),
                "granted_by_coupon": code,
            }},
            upsert=True,
        )
        reward_msg = f"BidBlitz Kids Premium ({int(val)} Monate)"
    elif ct == "premium_month":
        from datetime import timedelta
        sub_end = datetime.now(timezone.utc) + timedelta(days=int(val) * 30)
        await db.subscriptions.update_one(
            {"user_id": user_id},
            {"$set": {
                "plan": "premium", "status": "active",
                "expires_at": sub_end.isoformat(),
                "granted_by_coupon": code,
            }},
            upsert=True,
        )
        reward_msg = f"Premium-Abo ({int(val)} Monate)"
    else:
        raise HTTPException(400, f"Unbekannter Gutscheintyp: {ct}")

    # Update coupon usage
    await db.coupons.update_one(
        {"code": code},
        {"$inc": {"used_count": 1}, "$push": {"used_by": user_id}}
    )

    # Transaction
    await db.transactions.insert_one({
        "tx_id": secrets.token_hex(8),
        "user_id": user_id,
        "type": "COUPON_REDEEM",
        "amount": val,
        "description": f"Gutschein eingelöst: {code} — {reward_msg}",
        "coupon_code": code,
        "created_at": now,
    })

    # Notify
    await db.notifications.insert_one({
        "id": secrets.token_hex(8),
        "user_id": user_id,
        "type": "coupon_redeemed",
        "title": "Gutschein eingelöst!",
        "message": f"{reward_msg} wurde deinem Konto gutgeschrieben.",
        "read": False,
        "created_at": now,
    })

    return {
        "ok": True,
        "reward": reward_msg,
        "coupon_type": ct,
        "value": val,
        "message": f"{reward_msg} erfolgreich eingelöst!",
    }


# ══════════════════════════════════════════════════════════════════════════════
# ADMIN: Grant History
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/history")
async def admin_grant_history(request: Request):
    """Admin: Get grant/coupon redemption history."""
    admin = await get_current_user(request)
    if admin.get("role") != "admin":
        raise HTTPException(403, "Nur für Admins")

    grants = await db.transactions.find(
        {"type": {"$in": ["ADMIN_GRANT", "COUPON_REDEEM"]}},
        {"_id": 0}
    ).sort("created_at", -1).limit(100).to_list(100)

    return {"history": grants, "total": len(grants)}
