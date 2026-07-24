# BidBlitz - Promo Codes & Vouchers
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from datetime import datetime, timezone
from uuid import uuid4
from core.database import db
from routes.auth import get_current_user

router = APIRouter(prefix="/api/promo", tags=["Promo Codes"])

class ApplyPromoRequest(BaseModel):
    code: str
    service_type: str  # taxi, food, scooter, marketplace

@router.post("/apply")
async def apply_promo_code(req: ApplyPromoRequest, user=Depends(get_current_user)):
    """Apply promo code"""
    promo = await db.promo_codes.find_one({"code": req.code.upper()}, {"_id": 0})
    
    if not promo:
        raise HTTPException(404, "Invalid promo code")
    
    # Check if expired
    if promo.get("expires_at"):
        expiry = datetime.fromisoformat(promo["expires_at"])
        if expiry < datetime.now(timezone.utc):
            raise HTTPException(400, "Promo code expired")
    
    # Check usage limit
    if promo.get("max_uses") and promo.get("used_count", 0) >= promo["max_uses"]:
        raise HTTPException(400, "Promo code usage limit reached")
    
    # Check if user already used
    if promo.get("one_per_user"):
        usage = await db.promo_usage.find_one({
            "user_id": user["user_id"],
            "code": req.code.upper(),
        })
        if usage:
            raise HTTPException(400, "You already used this promo code")
    
    # Check service type
    if promo.get("service_type") and promo["service_type"] != req.service_type:
        raise HTTPException(400, f"This promo is only for {promo['service_type']}")
    
    # Record usage
    usage_id = str(uuid4())
    await db.promo_usage.insert_one({
        "usage_id": usage_id,
        "user_id": user["user_id"],
        "code": req.code.upper(),
        "service_type": req.service_type,
        "discount_type": promo["discount_type"],
        "discount_value": promo["discount_value"],
        "used_at": datetime.now(timezone.utc).isoformat(),
    })
    
    # Increment usage count
    await db.promo_codes.update_one(
        {"code": req.code.upper()},
        {"$inc": {"used_count": 1}}
    )
    
    return {
        "success": True,
        "discount_type": promo["discount_type"],  # percentage, fixed
        "discount_value": promo["discount_value"],
        "message": f"Promo applied! {'€' if promo['discount_type'] == 'fixed' else ''}{promo['discount_value']}{'%' if promo['discount_type'] == 'percentage' else ''} off",
    }

@router.get("/available")
async def get_available_promos(user=Depends(get_current_user)):
    """Get available promo codes for user"""
    promos = await db.promo_codes.find({
        "active": True,
        "$or": [
            {"expires_at": {"$exists": False}},
            {"expires_at": {"$gt": datetime.now(timezone.utc).isoformat()}},
        ]
    }, {"_id": 0}).to_list(50)
    
    # Filter out already used (if one_per_user)
    available = []
    for promo in promos:
        if promo.get("one_per_user"):
            usage = await db.promo_usage.find_one({
                "user_id": user["user_id"],
                "code": promo["code"],
            })
            if usage:
                continue
        available.append(promo)
    
    return {"promos": available}

@router.post("/create")  # Admin only
async def create_promo_code(
    code: str,
    discount_type: str,
    discount_value: float,
    service_type: str = None,
    max_uses: int = None,
    one_per_user: bool = True,
    expires_at: str = None,
    user=Depends(get_current_user)
):
    """Create new promo code (admin only)"""
    if user.get("role") != "admin":
        raise HTTPException(403, "Admin only")
    
    existing = await db.promo_codes.find_one({"code": code.upper()})
    if existing:
        raise HTTPException(400, "Promo code already exists")
    
    promo = {
        "code": code.upper(),
        "discount_type": discount_type,
        "discount_value": discount_value,
        "service_type": service_type,
        "max_uses": max_uses,
        "one_per_user": one_per_user,
        "expires_at": expires_at,
        "used_count": 0,
        "active": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    
    await db.promo_codes.insert_one(promo)
    
    return {"success": True, "promo": promo}
