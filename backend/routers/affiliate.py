"""Affiliate router - Affiliate program endpoints"""
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone, timedelta
from typing import Optional
import uuid

from config import db, logger
from dependencies import get_current_user, get_admin_user
from schemas import AffiliateRegister

router = APIRouter(prefix="/affiliate", tags=["Affiliate"])

# ==================== PUBLIC AFFILIATE ENDPOINTS ====================

@router.post("/register")
async def register_affiliate(data: AffiliateRegister, user: dict = Depends(get_current_user)):
    """Register as an affiliate"""
    # Check if already registered
    existing = await db.affiliates.find_one({"user_id": user["id"]})
    if existing:
        raise HTTPException(status_code=400, detail="Already registered as affiliate")
    
    affiliate_code = f"AFF-{user['id'][:8].upper()}"
    
    affiliate = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "user_email": user["email"],
        "name": data.name,
        "code": affiliate_code,
        "payment_method": data.payment_method,
        "payment_details": data.payment_details,
        "status": "pending",  # pending, approved, rejected
        "commission_rate": 0.10,  # 10% default
        "total_earnings": 0.0,
        "pending_earnings": 0.0,
        "paid_out": 0.0,
        "referrals": 0,
        "conversions": 0,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.affiliates.insert_one(affiliate)
    
    return {
        "message": "Affiliate registration submitted",
        "code": affiliate_code,
        "status": "pending"
    }

@router.get("/status")
async def get_affiliate_status(user: dict = Depends(get_current_user)):
    """Get current user's affiliate status"""
    affiliate = await db.affiliates.find_one({"user_id": user["id"]}, {"_id": 0})
    
    if not affiliate:
        return {"is_affiliate": False}
    
    return {
        "is_affiliate": True,
        **affiliate
    }

@router.get("/stats")
async def get_affiliate_stats(user: dict = Depends(get_current_user)):
    """Get affiliate statistics"""
    affiliate = await db.affiliates.find_one({"user_id": user["id"]}, {"_id": 0})
    
    if not affiliate or affiliate["status"] != "approved":
        raise HTTPException(status_code=403, detail="Not an approved affiliate")
    
    # Get referral stats
    referrals = await db.affiliate_referrals.find(
        {"affiliate_id": affiliate["id"]},
        {"_id": 0}
    ).to_list(1000)
    
    # Calculate stats
    total_clicks = sum(r.get("clicks", 0) for r in referrals)
    total_signups = len([r for r in referrals if r.get("signed_up")])
    total_conversions = len([r for r in referrals if r.get("converted")])
    
    return {
        "code": affiliate["code"],
        "commission_rate": affiliate["commission_rate"],
        "total_earnings": affiliate["total_earnings"],
        "pending_earnings": affiliate["pending_earnings"],
        "paid_out": affiliate["paid_out"],
        "total_clicks": total_clicks,
        "total_signups": total_signups,
        "total_conversions": total_conversions,
        "conversion_rate": round(total_conversions / max(total_signups, 1) * 100, 1)
    }

@router.get("/referrals")
async def get_affiliate_referrals(user: dict = Depends(get_current_user)):
    """Get list of referrals"""
    affiliate = await db.affiliates.find_one({"user_id": user["id"]})
    
    if not affiliate:
        raise HTTPException(status_code=403, detail="Not an affiliate")
    
    referrals = await db.affiliate_referrals.find(
        {"affiliate_id": affiliate["id"]},
        {"_id": 0, "user_email": 0}  # Hide emails for privacy
    ).sort("created_at", -1).to_list(100)
    
    return referrals

# ==================== TRACKING ENDPOINTS ====================

@router.get("/track/{affiliate_code}")
async def track_affiliate_click(affiliate_code: str):
    """Track affiliate link click"""
    affiliate = await db.affiliates.find_one({"code": affiliate_code.upper()})
    
    if not affiliate or affiliate["status"] != "approved":
        return {"valid": False}
    
    # Log click
    await db.affiliates.update_one(
        {"id": affiliate["id"]},
        {"$inc": {"total_clicks": 1}}
    )
    
    return {
        "valid": True,
        "code": affiliate["code"]
    }

# ==================== ADMIN ENDPOINTS ====================

@router.get("/admin/list")
async def admin_list_affiliates(admin: dict = Depends(get_admin_user)):
    """Get all affiliates"""
    affiliates = await db.affiliates.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return affiliates

@router.put("/admin/{affiliate_id}/approve")
async def admin_approve_affiliate(affiliate_id: str, admin: dict = Depends(get_admin_user)):
    """Approve an affiliate"""
    result = await db.affiliates.update_one(
        {"id": affiliate_id},
        {"$set": {"status": "approved", "approved_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Affiliate not found")
    
    return {"message": "Affiliate approved"}

@router.put("/admin/{affiliate_id}/reject")
async def admin_reject_affiliate(affiliate_id: str, admin: dict = Depends(get_admin_user)):
    """Reject an affiliate"""
    result = await db.affiliates.update_one(
        {"id": affiliate_id},
        {"$set": {"status": "rejected"}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Affiliate not found")
    
    return {"message": "Affiliate rejected"}

@router.put("/admin/{affiliate_id}/commission")
async def admin_set_commission(
    affiliate_id: str,
    rate: float,
    admin: dict = Depends(get_admin_user)
):
    """Set affiliate commission rate"""
    if rate < 0 or rate > 0.5:
        raise HTTPException(status_code=400, detail="Rate must be between 0 and 0.5 (50%)")
    
    result = await db.affiliates.update_one(
        {"id": affiliate_id},
        {"$set": {"commission_rate": rate}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Affiliate not found")
    
    return {"message": f"Commission rate set to {rate * 100}%"}

@router.post("/admin/{affiliate_id}/payout")
async def admin_process_payout(
    affiliate_id: str,
    amount: float,
    admin: dict = Depends(get_admin_user)
):
    """Process affiliate payout"""
    affiliate = await db.affiliates.find_one({"id": affiliate_id})
    
    if not affiliate:
        raise HTTPException(status_code=404, detail="Affiliate not found")
    
    if amount > affiliate["pending_earnings"]:
        raise HTTPException(status_code=400, detail="Amount exceeds pending earnings")
    
    # Create payout record
    payout = {
        "id": str(uuid.uuid4()),
        "affiliate_id": affiliate_id,
        "amount": amount,
        "payment_method": affiliate["payment_method"],
        "payment_details": affiliate["payment_details"],
        "status": "completed",
        "processed_by": admin["id"],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.affiliate_payouts.insert_one(payout)
    
    # Update affiliate balance
    await db.affiliates.update_one(
        {"id": affiliate_id},
        {
            "$inc": {"pending_earnings": -amount, "paid_out": amount}
        }
    )
    
    return {"message": f"Payout of €{amount:.2f} processed"}
