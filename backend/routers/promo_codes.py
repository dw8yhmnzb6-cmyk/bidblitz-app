"""Promo Code System - Promotional codes for special occasions"""
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone, timedelta
from typing import Optional, List
from pydantic import BaseModel, Field
import uuid

from config import db, logger
from dependencies import get_current_user, get_admin_user

router = APIRouter(prefix="/promo-codes", tags=["Promo Codes"])

# ==================== MODELS ====================

class PromoCodeCreate(BaseModel):
    code: str = Field(..., min_length=3, max_length=30, description="Unique promo code")
    name: str = Field(..., description="Name/Description of the promo")
    reward_type: str = Field(default="bids", description="bids, vip_days, discount_percent")
    reward_amount: int = Field(..., gt=0, description="Amount of reward (bids, days, or percent)")
    max_uses: Optional[int] = Field(default=None, description="Max total uses (None = unlimited)")
    one_per_user: bool = Field(default=True, description="Each user can only redeem once")
    valid_from: Optional[str] = None
    valid_until: Optional[str] = None
    is_active: bool = True

class PromoCodeRedeem(BaseModel):
    code: str

# ==================== ADMIN ENDPOINTS ====================

@router.post("/admin/create")
async def create_promo_code(data: PromoCodeCreate, admin: dict = Depends(get_admin_user)):
    """Create a new promo code (Admin only)"""
    # Check if code already exists
    existing = await db.promo_codes.find_one({"code": data.code.upper()})
    if existing:
        raise HTTPException(status_code=400, detail="Dieser Code existiert bereits")
    
    promo_id = str(uuid.uuid4())
    doc = {
        "id": promo_id,
        "code": data.code.upper(),
        "name": data.name,
        "reward_type": data.reward_type,
        "reward_amount": data.reward_amount,
        "max_uses": data.max_uses,
        "one_per_user": data.one_per_user,  # New field
        "current_uses": 0,
        "valid_from": data.valid_from,
        "valid_until": data.valid_until,
        "is_active": data.is_active,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": admin.get("id")
    }
    
    await db.promo_codes.insert_one(doc)
    doc.pop("_id", None)
    
    logger.info(f"Promo code created: {data.code.upper()} by {admin.get('email')}")
    
    return {"success": True, "promo_code": doc}

@router.get("/admin/list")
async def list_promo_codes(admin: dict = Depends(get_admin_user)):
    """List all promo codes (Admin only)"""
    codes = await db.promo_codes.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return {"promo_codes": codes, "count": len(codes)}

@router.put("/admin/{code_id}/toggle")
async def toggle_promo_code(code_id: str, admin: dict = Depends(get_admin_user)):
    """Toggle promo code active/inactive (Admin only)"""
    promo = await db.promo_codes.find_one({"id": code_id})
    if not promo:
        raise HTTPException(status_code=404, detail="Code nicht gefunden")
    
    new_status = not promo.get("is_active", True)
    await db.promo_codes.update_one(
        {"id": code_id},
        {"$set": {"is_active": new_status}}
    )
    
    return {"success": True, "is_active": new_status}

@router.delete("/admin/{code_id}")
async def delete_promo_code(code_id: str, admin: dict = Depends(get_admin_user)):
    """Delete a promo code (Admin only)"""
    result = await db.promo_codes.delete_one({"id": code_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Code nicht gefunden")
    
    return {"success": True, "message": "Code gelöscht"}

@router.get("/admin/{code_id}/usage")
async def get_promo_code_usage(code_id: str, admin: dict = Depends(get_admin_user)):
    """Get usage history for a promo code (Admin only)"""
    promo = await db.promo_codes.find_one({"id": code_id}, {"_id": 0})
    if not promo:
        raise HTTPException(status_code=404, detail="Code nicht gefunden")
    
    redemptions = await db.promo_code_redemptions.find(
        {"promo_code_id": code_id},
        {"_id": 0}
    ).sort("redeemed_at", -1).to_list(500)
    
    return {
        "promo_code": promo,
        "redemptions": redemptions,
        "total_redemptions": len(redemptions)
    }

# ==================== USER ENDPOINTS ====================

@router.post("/redeem")
async def redeem_promo_code(data: PromoCodeRedeem, user: dict = Depends(get_current_user)):
    """Redeem a promo code - each user can only use each code ONCE"""
    code = data.code.upper().strip()
    user_id = user["id"]
    
    # Find the promo code
    promo = await db.promo_codes.find_one({"code": code})
    if not promo:
        raise HTTPException(status_code=404, detail="Ungültiger Code")
    
    # Check if active
    if not promo.get("is_active", True):
        raise HTTPException(status_code=400, detail="Dieser Code ist nicht mehr aktiv")
    
    # Check validity dates
    now = datetime.now(timezone.utc)
    if promo.get("valid_from"):
        valid_from = datetime.fromisoformat(promo["valid_from"].replace("Z", "+00:00"))
        if now < valid_from:
            raise HTTPException(status_code=400, detail="Dieser Code ist noch nicht gültig")
    
    if promo.get("valid_until"):
        valid_until = datetime.fromisoformat(promo["valid_until"].replace("Z", "+00:00"))
        if now > valid_until:
            raise HTTPException(status_code=400, detail="Dieser Code ist abgelaufen")
    
    # Check max uses
    if promo.get("max_uses") and promo.get("current_uses", 0) >= promo["max_uses"]:
        raise HTTPException(status_code=400, detail="Dieser Code wurde bereits zu oft eingelöst")
    
    # Check if user already used this code
    existing_redemption = await db.promo_code_redemptions.find_one({
        "promo_code_id": promo["id"],
        "user_id": user_id
    })
    if existing_redemption:
        raise HTTPException(status_code=400, detail="Sie haben diesen Code bereits eingelöst")
    
    # Apply the reward
    reward_type = promo.get("reward_type", "bids")
    reward_amount = promo.get("reward_amount", 0)
    reward_message = ""
    
    if reward_type == "bids":
        # Add free bids to user account
        await db.users.update_one(
            {"id": user_id},
            {"$inc": {"bid_balance": reward_amount}}
        )
        reward_message = f"{reward_amount} Gratis-Gebote gutgeschrieben!"
        
    elif reward_type == "vip_days":
        # Add VIP days
        current_vip = await db.users.find_one({"id": user_id})
        current_expiry = current_vip.get("vip_expires_at")
        
        if current_expiry:
            try:
                expiry_date = datetime.fromisoformat(current_expiry.replace("Z", "+00:00"))
                if expiry_date > now:
                    new_expiry = expiry_date + timedelta(days=reward_amount)
                else:
                    new_expiry = now + timedelta(days=reward_amount)
            except:
                new_expiry = now + timedelta(days=reward_amount)
        else:
            new_expiry = now + timedelta(days=reward_amount)
        
        await db.users.update_one(
            {"id": user_id},
            {"$set": {
                "is_vip": True,
                "vip_expires_at": new_expiry.isoformat()
            }}
        )
        reward_message = f"{reward_amount} Tage VIP-Mitgliedschaft aktiviert!"
        
    elif reward_type == "discount_percent":
        # Store discount for next purchase
        await db.user_discounts.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "discount_percent": reward_amount,
            "promo_code": code,
            "is_used": False,
            "created_at": now.isoformat()
        })
        reward_message = f"{reward_amount}% Rabatt auf Ihren nächsten Einkauf!"
    
    # Record the redemption
    await db.promo_code_redemptions.insert_one({
        "id": str(uuid.uuid4()),
        "promo_code_id": promo["id"],
        "promo_code": code,
        "user_id": user_id,
        "user_email": user.get("email"),
        "reward_type": reward_type,
        "reward_amount": reward_amount,
        "redeemed_at": now.isoformat()
    })
    
    # Increment usage counter
    await db.promo_codes.update_one(
        {"id": promo["id"]},
        {"$inc": {"current_uses": 1}}
    )
    
    logger.info(f"Promo code {code} redeemed by {user.get('email')}: {reward_type} x {reward_amount}")
    
    return {
        "success": True,
        "message": reward_message,
        "reward_type": reward_type,
        "reward_amount": reward_amount,
        "promo_name": promo.get("name")
    }

@router.get("/check/{code}")
async def check_promo_code(code: str):
    """Check if a promo code is valid (public endpoint)"""
    promo = await db.promo_codes.find_one({"code": code.upper()}, {"_id": 0})
    
    if not promo:
        return {"valid": False, "message": "Code nicht gefunden"}
    
    if not promo.get("is_active", True):
        return {"valid": False, "message": "Code nicht aktiv"}
    
    now = datetime.now(timezone.utc)
    
    if promo.get("valid_until"):
        valid_until = datetime.fromisoformat(promo["valid_until"].replace("Z", "+00:00"))
        if now > valid_until:
            return {"valid": False, "message": "Code abgelaufen"}
    
    if promo.get("max_uses") and promo.get("current_uses", 0) >= promo["max_uses"]:
        return {"valid": False, "message": "Code ausgeschöpft"}
    
    return {
        "valid": True,
        "name": promo.get("name"),
        "reward_type": promo.get("reward_type"),
        "reward_amount": promo.get("reward_amount"),
        "message": f"Gültig: {promo.get('name')}"
    }
