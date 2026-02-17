"""
Partner Referral System - Partner können andere Partner einladen
Bonus-System für beide Parteien
"""
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone, timedelta
from typing import Optional
from pydantic import BaseModel
import uuid
import random
import string

from config import db, logger
from dependencies import get_current_user

router = APIRouter(prefix="/partner-referral", tags=["Partner Referral"])

# ==================== SCHEMAS ====================

class ReferralCodeResponse(BaseModel):
    code: str
    link: str
    total_referrals: int
    pending_bonus: float
    paid_bonus: float

class ReferralStatsResponse(BaseModel):
    total_referrals: int
    successful_referrals: int
    pending_referrals: int
    total_earned: float
    pending_bonus: float
    referrals: list

# ==================== HELPER FUNCTIONS ====================

def generate_partner_referral_code(name: str) -> str:
    """Generate unique referral code for partner"""
    name_part = ''.join(c for c in name.upper() if c.isalnum())[:4]
    random_part = ''.join(random.choices(string.ascii_uppercase + string.digits, k=4))
    return f"P{name_part}{random_part}"

# ==================== ENDPOINTS ====================

@router.get("/my-code")
async def get_partner_referral_code(token: str):
    """Get or create partner's referral code"""
    # Verify partner
    partner = await db.partners.find_one({"token": token}, {"_id": 0})
    if not partner:
        raise HTTPException(status_code=401, detail="Ungültiger Token")
    
    partner_id = partner.get("id")
    
    # Check if partner already has a referral code
    if partner.get("referral_code"):
        referral_code = partner["referral_code"]
    else:
        # Generate new code
        referral_code = generate_partner_referral_code(partner.get("name", "PARTNER"))
        
        # Ensure uniqueness
        while await db.partners.find_one({"referral_code": referral_code}):
            referral_code = generate_partner_referral_code(partner.get("name", "PARTNER"))
        
        # Save to partner
        await db.partners.update_one(
            {"id": partner_id},
            {"$set": {"referral_code": referral_code}}
        )
    
    # Get referral stats
    referrals = await db.partner_referrals.find(
        {"referrer_id": partner_id}
    ).to_list(100)
    
    successful = [r for r in referrals if r.get("status") == "completed"]
    pending_bonus = sum(r.get("bonus", 0) for r in referrals if r.get("status") == "pending")
    paid_bonus = sum(r.get("bonus", 0) for r in referrals if r.get("bonus_paid"))
    
    return {
        "code": referral_code,
        "link": f"https://bidblitz.ae/partner/register?ref={referral_code}",
        "total_referrals": len(referrals),
        "successful_referrals": len(successful),
        "pending_bonus": pending_bonus,
        "paid_bonus": paid_bonus
    }


@router.get("/stats")
async def get_referral_stats(token: str):
    """Get detailed referral statistics for partner"""
    partner = await db.partners.find_one({"token": token}, {"_id": 0})
    if not partner:
        raise HTTPException(status_code=401, detail="Ungültiger Token")
    
    partner_id = partner.get("id")
    
    # Get all referrals
    referrals = await db.partner_referrals.find(
        {"referrer_id": partner_id}
    ).to_list(100)
    
    # Enrich with referred partner info
    enriched_referrals = []
    for ref in referrals:
        referred_partner = await db.partners.find_one(
            {"id": ref.get("referred_id")},
            {"_id": 0, "name": 1, "business_type": 1, "created_at": 1}
        )
        enriched_referrals.append({
            "id": ref.get("id"),
            "referred_name": referred_partner.get("name", "Unbekannt") if referred_partner else "Unbekannt",
            "business_type": referred_partner.get("business_type", "other") if referred_partner else "other",
            "status": ref.get("status", "pending"),
            "bonus": ref.get("bonus", 10.0),
            "bonus_paid": ref.get("bonus_paid", False),
            "created_at": ref.get("created_at"),
            "completed_at": ref.get("completed_at")
        })
    
    successful = [r for r in referrals if r.get("status") == "completed"]
    pending = [r for r in referrals if r.get("status") == "pending"]
    
    return {
        "total_referrals": len(referrals),
        "successful_referrals": len(successful),
        "pending_referrals": len(pending),
        "total_earned": sum(r.get("bonus", 0) for r in referrals if r.get("bonus_paid")),
        "pending_bonus": sum(r.get("bonus", 0) for r in referrals if r.get("status") == "completed" and not r.get("bonus_paid")),
        "referrals": sorted(enriched_referrals, key=lambda x: x.get("created_at", ""), reverse=True)
    }


@router.post("/apply")
async def apply_referral_code(code: str, new_partner_id: str):
    """Apply a referral code during partner registration"""
    # Find referring partner
    referrer = await db.partners.find_one({"referral_code": code.upper()}, {"_id": 0})
    if not referrer:
        raise HTTPException(status_code=404, detail="Ungültiger Empfehlungscode")
    
    referrer_id = referrer.get("id")
    
    # Check if new partner exists
    new_partner = await db.partners.find_one({"id": new_partner_id}, {"_id": 0})
    if not new_partner:
        raise HTTPException(status_code=404, detail="Partner nicht gefunden")
    
    # Check if already referred
    existing = await db.partner_referrals.find_one({
        "referred_id": new_partner_id
    })
    if existing:
        raise HTTPException(status_code=400, detail="Partner wurde bereits empfohlen")
    
    # Create referral record
    referral_id = str(uuid.uuid4())
    referral_bonus = 10.0  # €10 bonus for referrer
    new_partner_bonus = 5.0  # €5 bonus for new partner
    
    await db.partner_referrals.insert_one({
        "id": referral_id,
        "referrer_id": referrer_id,
        "referred_id": new_partner_id,
        "code_used": code.upper(),
        "status": "pending",  # pending until first voucher sold
        "bonus": referral_bonus,
        "new_partner_bonus": new_partner_bonus,
        "bonus_paid": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    # Add welcome bonus to new partner's balance
    await db.partners.update_one(
        {"id": new_partner_id},
        {
            "$inc": {"pending_payout": new_partner_bonus},
            "$set": {
                "referred_by": referrer_id,
                "referral_code_used": code.upper()
            }
        }
    )
    
    logger.info(f"Partner referral applied: {referrer_id} -> {new_partner_id}")
    
    return {
        "success": True,
        "message": "Empfehlungscode angewendet! Sie erhalten €5 Startguthaben.",
        "bonus": new_partner_bonus
    }


@router.post("/complete/{referral_id}")
async def complete_referral(referral_id: str, admin_key: str = None):
    """Mark referral as completed (called when referred partner sells first voucher)"""
    referral = await db.partner_referrals.find_one({"id": referral_id})
    if not referral:
        raise HTTPException(status_code=404, detail="Empfehlung nicht gefunden")
    
    if referral.get("status") == "completed":
        return {"success": True, "message": "Bereits abgeschlossen"}
    
    # Update referral status
    await db.partner_referrals.update_one(
        {"id": referral_id},
        {
            "$set": {
                "status": "completed",
                "completed_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    # Add bonus to referrer's pending payout
    await db.partners.update_one(
        {"id": referral.get("referrer_id")},
        {"$inc": {"pending_payout": referral.get("bonus", 10.0)}}
    )
    
    logger.info(f"Referral completed: {referral_id}, bonus: €{referral.get('bonus', 10.0)}")
    
    return {
        "success": True,
        "message": "Empfehlung abgeschlossen, Bonus gutgeschrieben"
    }


@router.get("/leaderboard")
async def get_referral_leaderboard():
    """Get top partners by referrals"""
    # Aggregate referrals by partner
    pipeline = [
        {"$match": {"status": "completed"}},
        {"$group": {
            "_id": "$referrer_id",
            "total_referrals": {"$sum": 1},
            "total_earned": {"$sum": "$bonus"}
        }},
        {"$sort": {"total_referrals": -1}},
        {"$limit": 10}
    ]
    
    results = await db.partner_referrals.aggregate(pipeline).to_list(10)
    
    # Enrich with partner info
    leaderboard = []
    for i, result in enumerate(results):
        partner = await db.partners.find_one(
            {"id": result["_id"]},
            {"_id": 0, "name": 1, "business_type": 1, "logo_url": 1}
        )
        if partner:
            leaderboard.append({
                "rank": i + 1,
                "partner_name": partner.get("name", "Unbekannt"),
                "business_type": partner.get("business_type", "other"),
                "logo_url": partner.get("logo_url"),
                "total_referrals": result["total_referrals"],
                "total_earned": result["total_earned"]
            })
    
    return {"leaderboard": leaderboard}
