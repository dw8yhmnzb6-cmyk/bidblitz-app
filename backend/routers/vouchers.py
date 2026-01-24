"""Vouchers router - Voucher management"""
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone
from typing import List
import uuid

from config import db, logger
from dependencies import get_admin_user, get_current_user
from schemas import VoucherCreate

router = APIRouter(tags=["Vouchers"])

# ==================== ADMIN ENDPOINTS ====================

@router.post("/admin/vouchers")
async def create_voucher(voucher: VoucherCreate, admin: dict = Depends(get_admin_user)):
    """Create a new voucher (admin only)"""
    existing = await db.vouchers.find_one({"code": voucher.code.upper()})
    if existing:
        raise HTTPException(status_code=400, detail="Voucher code already exists")
    
    voucher_id = str(uuid.uuid4())
    doc = {
        "id": voucher_id,
        "code": voucher.code.upper(),
        "bids": voucher.bids,
        "max_uses": voucher.max_uses,
        "used_count": 0,
        "used_by": [],
        "expires_at": voucher.expires_at,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.vouchers.insert_one(doc)
    return doc

@router.get("/admin/vouchers")
async def get_vouchers(admin: dict = Depends(get_admin_user)):
    """Get all vouchers (admin only)"""
    vouchers = await db.vouchers.find({}, {"_id": 0}).to_list(100)
    return vouchers

@router.delete("/admin/vouchers/{voucher_id}")
async def delete_voucher(voucher_id: str, admin: dict = Depends(get_admin_user)):
    """Delete a voucher (admin only)"""
    result = await db.vouchers.delete_one({"id": voucher_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Voucher not found")
    return {"message": "Voucher deleted"}

# ==================== USER ENDPOINTS ====================

from pydantic import BaseModel

class VoucherRedeemRequest(BaseModel):
    code: str

@router.post("/vouchers/redeem")
async def redeem_voucher(request: VoucherRedeemRequest, user: dict = Depends(get_current_user)):
    """Redeem a voucher code"""
    code = request.code
    voucher = await db.vouchers.find_one({"code": code.upper()}, {"_id": 0})
    
    if not voucher:
        raise HTTPException(status_code=404, detail="Ungültiger Gutscheincode")
    
    # Check if already used by this user
    if user["id"] in voucher.get("used_by", []):
        raise HTTPException(status_code=400, detail="Gutschein bereits eingelöst")
    
    # Check max uses
    if voucher.get("used_count", 0) >= voucher.get("max_uses", 1):
        raise HTTPException(status_code=400, detail="Gutschein ist ausgeschöpft")
    
    # Check expiry
    if voucher.get("expires_at"):
        expires = datetime.fromisoformat(voucher["expires_at"].replace("Z", "+00:00"))
        if datetime.now(timezone.utc) > expires:
            raise HTTPException(status_code=400, detail="Gutschein ist abgelaufen")
    
    # Credit bids
    bids = voucher["bids"]
    await db.users.update_one(
        {"id": user["id"]},
        {"$inc": {"bids_balance": bids}}
    )
    
    # Update voucher usage
    await db.vouchers.update_one(
        {"id": voucher["id"]},
        {
            "$inc": {"used_count": 1},
            "$push": {"used_by": user["id"]}
        }
    )
    
    logger.info(f"User {user['email']} redeemed voucher {code} for {bids} bids")
    
    return {
        "message": f"{bids} Gebote gutgeschrieben!",
        "bids_added": bids
    }
