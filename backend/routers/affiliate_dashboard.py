"""Affiliate Dashboard Router - Affiliate program management"""
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone, timedelta
from typing import Optional, List
from pydantic import BaseModel
import uuid
import hashlib

from config import db, logger
from dependencies import get_current_user, get_admin_user

router = APIRouter(prefix="/affiliate-dashboard", tags=["Affiliate Dashboard"])

# Affiliate Program Configuration
COMMISSION_RATE = 0.10  # 10% commission
MIN_PAYOUT = 50.00  # Minimum payout amount
COOKIE_DAYS = 30  # Attribution window

# ==================== SCHEMAS ====================

class AffiliateApplication(BaseModel):
    website: Optional[str] = None
    social_media: Optional[str] = None
    promotion_method: str
    expected_monthly_referrals: int

class PayoutRequest(BaseModel):
    amount: float
    payment_method: str  # paypal, bank_transfer
    payment_details: str  # Email or IBAN

# ==================== PUBLIC ENDPOINTS ====================

@router.get("/program-info")
async def get_program_info():
    """Get affiliate program information"""
    return {
        "commission_rate": COMMISSION_RATE * 100,
        "cookie_duration_days": COOKIE_DAYS,
        "minimum_payout": MIN_PAYOUT,
        "payment_methods": ["PayPal", "Banküberweisung"],
        "payout_schedule": "Monatlich (1. des Monats)",
        "benefits": [
            f"{int(COMMISSION_RATE * 100)}% Provision auf alle Käufe",
            f"{COOKIE_DAYS} Tage Cookie-Laufzeit",
            "Echtzeit-Statistiken",
            "Persönlicher Affiliate-Link",
            "Marketing-Materialien",
            "Dedizierter Support"
        ]
    }

@router.get("/my-dashboard")
async def get_affiliate_dashboard(user: dict = Depends(get_current_user)):
    """Get affiliate dashboard for current user"""
    user_id = user["id"]
    
    # Check if user is an affiliate
    affiliate = await db.affiliates.find_one({"user_id": user_id}, {"_id": 0})
    
    if not affiliate:
        return {
            "is_affiliate": False,
            "message": "Du bist noch kein Affiliate. Bewerbe dich jetzt!"
        }
    
    if affiliate.get("status") != "active":
        return {
            "is_affiliate": False,
            "status": affiliate.get("status"),
            "message": "Deine Bewerbung wird noch geprüft" if affiliate.get("status") == "pending" else "Deine Bewerbung wurde abgelehnt"
        }
    
    # Get referral stats
    total_referrals = await db.referral_clicks.count_documents({"affiliate_id": affiliate["id"]})
    conversions = await db.affiliate_conversions.count_documents({"affiliate_id": affiliate["id"]})
    
    # Revenue stats
    pipeline = [
        {"$match": {"affiliate_id": affiliate["id"]}},
        {"$group": {
            "_id": None,
            "total_revenue": {"$sum": "$order_amount"},
            "total_commission": {"$sum": "$commission"}
        }}
    ]
    revenue_stats = await db.affiliate_conversions.aggregate(pipeline).to_list(1)
    
    total_revenue = revenue_stats[0]["total_revenue"] if revenue_stats else 0
    total_commission = revenue_stats[0]["total_commission"] if revenue_stats else 0
    
    # Pending vs paid commissions
    pending = await db.affiliate_conversions.aggregate([
        {"$match": {"affiliate_id": affiliate["id"], "paid": False}},
        {"$group": {"_id": None, "amount": {"$sum": "$commission"}}}
    ]).to_list(1)
    pending_amount = pending[0]["amount"] if pending else 0
    
    # Recent conversions
    recent = await db.affiliate_conversions.find(
        {"affiliate_id": affiliate["id"]},
        {"_id": 0}
    ).sort("created_at", -1).limit(10).to_list(10)
    
    return {
        "is_affiliate": True,
        "affiliate_code": affiliate.get("code"),
        "affiliate_link": f"https://bidblitz.de?ref={affiliate.get('code')}",
        "stats": {
            "total_clicks": total_referrals,
            "total_conversions": conversions,
            "conversion_rate": round((conversions / total_referrals) * 100, 1) if total_referrals > 0 else 0,
            "total_revenue": round(total_revenue, 2),
            "total_commission": round(total_commission, 2),
            "pending_commission": round(pending_amount, 2),
            "paid_commission": round(total_commission - pending_amount, 2)
        },
        "recent_conversions": recent,
        "can_request_payout": pending_amount >= MIN_PAYOUT
    }

@router.post("/apply")
async def apply_as_affiliate(application: AffiliateApplication, user: dict = Depends(get_current_user)):
    """Apply to become an affiliate"""
    user_id = user["id"]
    
    # Check existing application
    existing = await db.affiliates.find_one({"user_id": user_id})
    if existing:
        return {
            "already_applied": True,
            "status": existing.get("status"),
            "code": existing.get("code") if existing.get("status") == "active" else None
        }
    
    # Generate unique affiliate code
    code = hashlib.md5(f"{user_id}{datetime.now().isoformat()}".encode()).hexdigest()[:8].upper()
    
    # Create affiliate record
    affiliate = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "user_email": user.get("email"),
        "code": code,
        "website": application.website,
        "social_media": application.social_media,
        "promotion_method": application.promotion_method,
        "expected_monthly_referrals": application.expected_monthly_referrals,
        "commission_rate": COMMISSION_RATE,
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.affiliates.insert_one(affiliate)
    
    logger.info(f"New affiliate application from {user_id}")
    
    return {
        "success": True,
        "message": "Deine Bewerbung wurde eingereicht! Wir melden uns innerhalb von 24-48 Stunden."
    }

@router.post("/request-payout")
async def request_payout(payout: PayoutRequest, user: dict = Depends(get_current_user)):
    """Request commission payout"""
    affiliate = await db.affiliates.find_one({"user_id": user["id"], "status": "active"})
    
    if not affiliate:
        raise HTTPException(status_code=403, detail="Du bist kein aktiver Affiliate")
    
    # Calculate pending commission
    pending = await db.affiliate_conversions.aggregate([
        {"$match": {"affiliate_id": affiliate["id"], "paid": False}},
        {"$group": {"_id": None, "amount": {"$sum": "$commission"}}}
    ]).to_list(1)
    pending_amount = pending[0]["amount"] if pending else 0
    
    if payout.amount > pending_amount:
        raise HTTPException(status_code=400, detail=f"Maximale Auszahlung: €{pending_amount:.2f}")
    
    if payout.amount < MIN_PAYOUT:
        raise HTTPException(status_code=400, detail=f"Mindestauszahlung: €{MIN_PAYOUT:.2f}")
    
    # Create payout request
    payout_id = str(uuid.uuid4())
    await db.affiliate_payouts.insert_one({
        "id": payout_id,
        "affiliate_id": affiliate["id"],
        "user_id": user["id"],
        "amount": payout.amount,
        "payment_method": payout.payment_method,
        "payment_details": payout.payment_details,
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {
        "success": True,
        "payout_id": payout_id,
        "message": "Auszahlungsanfrage eingereicht. Bearbeitung innerhalb von 3-5 Werktagen."
    }

@router.get("/my-payouts")
async def get_my_payouts(user: dict = Depends(get_current_user)):
    """Get user's payout history"""
    affiliate = await db.affiliates.find_one({"user_id": user["id"]})
    
    if not affiliate:
        return {"payouts": []}
    
    payouts = await db.affiliate_payouts.find(
        {"affiliate_id": affiliate["id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    
    return {"payouts": payouts}

@router.get("/marketing-materials")
async def get_marketing_materials(user: dict = Depends(get_current_user)):
    """Get marketing materials for affiliates"""
    affiliate = await db.affiliates.find_one({"user_id": user["id"], "status": "active"})
    
    if not affiliate:
        raise HTTPException(status_code=403, detail="Nur für aktive Affiliates")
    
    return {
        "banners": [
            {"size": "728x90", "url": "/assets/affiliate/banner-728x90.png"},
            {"size": "300x250", "url": "/assets/affiliate/banner-300x250.png"},
            {"size": "160x600", "url": "/assets/affiliate/banner-160x600.png"}
        ],
        "text_links": [
            "Spare bis zu 90% bei BidBlitz Auktionen!",
            "Gewinne Produkte für nur wenige Cent!",
            "Die spannendste Art zu sparen - BidBlitz"
        ],
        "social_posts": [
            {
                "platform": "instagram",
                "text": "Gerade dieses Produkt für nur €X bei @bidblitz gewonnen! Link in Bio #bidblitz #gewonnen"
            },
            {
                "platform": "twitter",
                "text": "Habe gerade 90% gespart bei @BidBlitz! Probier es aus:"
            }
        ],
        "affiliate_link": f"https://bidblitz.de?ref={affiliate['code']}"
    }

# ==================== ADMIN ENDPOINTS ====================

@router.get("/admin/applications")
async def get_affiliate_applications(
    status: Optional[str] = None,
    admin: dict = Depends(get_admin_user)
):
    """Get affiliate applications"""
    query = {}
    if status:
        query["status"] = status
    
    applications = await db.affiliates.find(query, {"_id": 0}).sort("created_at", -1).to_list(200)
    
    return {"applications": applications}

@router.put("/admin/{affiliate_id}/approve")
async def approve_affiliate(affiliate_id: str, admin: dict = Depends(get_admin_user)):
    """Approve affiliate application"""
    result = await db.affiliates.update_one(
        {"id": affiliate_id},
        {"$set": {
            "status": "active",
            "approved_by": admin["id"],
            "approved_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Affiliate nicht gefunden")
    
    return {"success": True}

@router.put("/admin/{affiliate_id}/reject")
async def reject_affiliate(affiliate_id: str, reason: str = None, admin: dict = Depends(get_admin_user)):
    """Reject affiliate application"""
    result = await db.affiliates.update_one(
        {"id": affiliate_id},
        {"$set": {
            "status": "rejected",
            "rejection_reason": reason,
            "rejected_by": admin["id"],
            "rejected_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Affiliate nicht gefunden")
    
    return {"success": True}

@router.get("/admin/payouts")
async def get_pending_payouts(admin: dict = Depends(get_admin_user)):
    """Get pending payout requests"""
    payouts = await db.affiliate_payouts.find(
        {"status": "pending"},
        {"_id": 0}
    ).sort("created_at", 1).to_list(100)
    
    return {"payouts": payouts}

@router.put("/admin/payouts/{payout_id}/process")
async def process_payout(payout_id: str, admin: dict = Depends(get_admin_user)):
    """Mark payout as processed"""
    payout = await db.affiliate_payouts.find_one({"id": payout_id})
    
    if not payout:
        raise HTTPException(status_code=404, detail="Auszahlung nicht gefunden")
    
    # Mark payout as completed
    await db.affiliate_payouts.update_one(
        {"id": payout_id},
        {"$set": {
            "status": "completed",
            "processed_by": admin["id"],
            "processed_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Mark conversions as paid (up to payout amount)
    # This is simplified - in production would track exact conversions
    await db.affiliate_conversions.update_many(
        {"affiliate_id": payout["affiliate_id"], "paid": False},
        {"$set": {"paid": True, "paid_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"success": True}

@router.get("/admin/stats")
async def get_affiliate_stats(admin: dict = Depends(get_admin_user)):
    """Get overall affiliate program statistics"""
    total_affiliates = await db.affiliates.count_documents({"status": "active"})
    pending_applications = await db.affiliates.count_documents({"status": "pending"})
    
    # Total revenue generated
    pipeline = [
        {"$group": {
            "_id": None,
            "total_revenue": {"$sum": "$order_amount"},
            "total_commission": {"$sum": "$commission"}
        }}
    ]
    revenue = await db.affiliate_conversions.aggregate(pipeline).to_list(1)
    
    # Top affiliates
    top_pipeline = [
        {"$group": {
            "_id": "$affiliate_id",
            "revenue": {"$sum": "$order_amount"},
            "conversions": {"$sum": 1}
        }},
        {"$sort": {"revenue": -1}},
        {"$limit": 10}
    ]
    top_affiliates = await db.affiliate_conversions.aggregate(top_pipeline).to_list(10)
    
    return {
        "affiliates": {
            "active": total_affiliates,
            "pending": pending_applications
        },
        "revenue": {
            "total": round(revenue[0]["total_revenue"], 2) if revenue else 0,
            "commission_paid": round(revenue[0]["total_commission"], 2) if revenue else 0
        },
        "top_affiliates": top_affiliates
    }


affiliate_dashboard_router = router
