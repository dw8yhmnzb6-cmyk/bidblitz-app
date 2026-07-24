"""
BidBlitz V2 - Self-Service Advertising Platform
Businesses können Anzeigen schalten (Banner, Sponsored Listings, Push Notifications)
"""
from fastapi import APIRouter, HTTPException, Request, UploadFile, File
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, timezone, timedelta
from core.database import db
from core.security import get_current_user
import secrets

router = APIRouter(prefix="/api/ads", tags=["advertising"])

# ══════════════════════════════════════════════════════════════════════════════
# PRICING & MODELS
# ══════════════════════════════════════════════════════════════════════════════

AD_TYPES = {
    "banner": {
        "name": "Banner-Anzeige",
        "price_per_day": 10.00,
        "max_impressions": 10000,
        "placements": ["home", "auctions", "directory", "taxi"]
    },
    "sponsored_listing": {
        "name": "Sponsored Listing",
        "price_per_day": 5.00,
        "max_impressions": 5000,
        "placements": ["search_results", "directory", "auctions"]
    },
    "push_notification": {
        "name": "Push-Benachrichtigung",
        "price_per_send": 0.05,
        "max_recipients": 50000,
    },
    "featured_placement": {
        "name": "Featured Placement",
        "price_per_month": 99.00,
        "description": "Oben in Suchergebnissen"
    }
}

class AdCampaignCreate(BaseModel):
    campaign_name: str = Field(..., min_length=3, max_length=100)
    ad_type: str  # banner, sponsored_listing, push_notification, featured_placement
    title: str = Field(..., max_length=100)
    description: str = Field("", max_length=500)
    cta_text: str = Field("Mehr erfahren", max_length=30)  # Call-to-Action
    cta_url: str = ""  # Landing page
    targeting: dict = {}  # {countries: [], cities: [], categories: [], age_min: 18, age_max: 65}
    budget_total: float = Field(..., ge=10)
    budget_daily: float = Field(..., ge=5)
    start_date: str
    end_date: str
    placements: List[str] = []

class AdCampaignUpdate(BaseModel):
    status: Optional[str] = None  # active, paused, completed
    budget_total: Optional[float] = None
    budget_daily: Optional[float] = None

# ══════════════════════════════════════════════════════════════════════════════
# CAMPAIGN MANAGEMENT
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/campaigns")
async def create_ad_campaign(req: AdCampaignCreate, request: Request):
    """
    Create new advertising campaign (authenticated users/businesses)
    Payment deducted from wallet
    """
    user = await get_current_user(request)
    
    # Validate ad type
    if req.ad_type not in AD_TYPES:
        raise HTTPException(400, "Ungültiger Anzeigentyp")
    
    # Check budget
    if req.budget_total < 10:
        raise HTTPException(400, "Mindestbudget: €10")
    
    # Check wallet balance
    balance = user.get("balance", 0)
    if balance < req.budget_total:
        raise HTTPException(400, f"Nicht genug Guthaben. Benötigt: €{req.budget_total:.2f}")
    
    # Deduct budget from wallet
    await db.users.update_one(
        {"email": user.get("email")},
        {"$inc": {"balance": -req.budget_total}}
    )
    
    # Create campaign
    campaign = {
        "campaign_id": f"camp_{secrets.token_hex(8)}",
        "user_email": user.get("email"),
        "campaign_name": req.campaign_name,
        "ad_type": req.ad_type,
        "title": req.title,
        "description": req.description,
        "cta_text": req.cta_text,
        "cta_url": req.cta_url,
        "targeting": req.targeting,
        "budget_total": req.budget_total,
        "budget_daily": req.budget_daily,
        "budget_spent": 0.0,
        "start_date": req.start_date,
        "end_date": req.end_date,
        "placements": req.placements,
        "status": "active",
        "impressions": 0,
        "clicks": 0,
        "conversions": 0,
        "ctr": 0.0,  # Click-through rate
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    
    await db.ad_campaigns.insert_one(campaign)
    campaign.pop("_id", None)
    
    # Record transaction
    await db.ad_transactions.insert_one({
        "tx_id": f"adtx_{secrets.token_hex(8)}",
        "campaign_id": campaign["campaign_id"],
        "user_email": user.get("email"),
        "amount": req.budget_total,
        "type": "campaign_creation",
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    
    return {"ok": True, "campaign": campaign, "message": f"Kampagne '{req.campaign_name}' erstellt!"}

@router.get("/campaigns")
async def get_my_campaigns(request: Request):
    """Get all campaigns for current user"""
    user = await get_current_user(request)
    
    campaigns = await db.ad_campaigns.find(
        {"user_email": user.get("email")},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    return {"campaigns": campaigns}

@router.get("/campaigns/{campaign_id}")
async def get_campaign(campaign_id: str, request: Request):
    """Get single campaign with analytics"""
    user = await get_current_user(request)
    
    campaign = await db.ad_campaigns.find_one({"campaign_id": campaign_id}, {"_id": 0})
    if not campaign:
        raise HTTPException(404, "Kampagne nicht gefunden")
    
    if campaign["user_email"] != user.get("email") and user.get("role") != "admin":
        raise HTTPException(403, "Keine Berechtigung")
    
    # Get analytics data
    analytics = await db.ad_analytics.find(
        {"campaign_id": campaign_id},
        {"_id": 0}
    ).sort("timestamp", -1).limit(100).to_list(100)
    
    campaign["analytics"] = analytics
    
    return campaign

@router.patch("/campaigns/{campaign_id}")
async def update_campaign(campaign_id: str, req: AdCampaignUpdate, request: Request):
    """Update campaign status or budget"""
    user = await get_current_user(request)
    
    campaign = await db.ad_campaigns.find_one({"campaign_id": campaign_id})
    if not campaign:
        raise HTTPException(404, "Kampagne nicht gefunden")
    
    if campaign["user_email"] != user.get("email") and user.get("role") != "admin":
        raise HTTPException(403, "Keine Berechtigung")
    
    update_data = {k: v for k, v in req.dict(exclude_unset=True).items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.ad_campaigns.update_one(
        {"campaign_id": campaign_id},
        {"$set": update_data}
    )
    
    return {"ok": True, "message": "Kampagne aktualisiert"}

# ══════════════════════════════════════════════════════════════════════════════
# AD SERVING (Public endpoints for app to fetch ads)
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/serve")
async def serve_ad(
    placement: str,  # home, auctions, directory, etc.
    user_country: Optional[str] = None,
    user_city: Optional[str] = None,
    category: Optional[str] = None,
):
    """
    Serve an ad for specific placement
    Returns best matching ad based on targeting and budget
    """
    query = {
        "status": "active",
        "placements": placement,
        "start_date": {"$lte": datetime.now(timezone.utc).isoformat()},
        "end_date": {"$gte": datetime.now(timezone.utc).isoformat()},
        "$expr": {"$lt": ["$budget_spent", "$budget_total"]}
    }
    
    # Targeting filters
    if user_country:
        query["$or"] = [
            {"targeting.countries": {"$in": [user_country]}},
            {"targeting.countries": {"$size": 0}}
        ]
    
    # Get active campaigns
    campaigns = await db.ad_campaigns.find(query, {"_id": 0}).to_list(10)
    
    if not campaigns:
        return {"ad": None}
    
    # Select campaign (weighted by budget remaining)
    import random
    campaign = random.choice(campaigns)
    
    # Increment impressions
    await db.ad_campaigns.update_one(
        {"campaign_id": campaign["campaign_id"]},
        {
            "$inc": {"impressions": 1},
            "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}
        }
    )
    
    # Log impression
    await db.ad_analytics.insert_one({
        "analytics_id": f"ana_{secrets.token_hex(8)}",
        "campaign_id": campaign["campaign_id"],
        "event_type": "impression",
        "placement": placement,
        "user_country": user_country,
        "user_city": user_city,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })
    
    return {
        "ad": {
            "campaign_id": campaign["campaign_id"],
            "title": campaign["title"],
            "description": campaign["description"],
            "cta_text": campaign["cta_text"],
            "cta_url": campaign["cta_url"],
            "ad_type": campaign["ad_type"],
        }
    }

@router.post("/track/click")
async def track_ad_click(campaign_id: str, placement: str):
    """Track ad click"""
    campaign = await db.ad_campaigns.find_one({"campaign_id": campaign_id})
    if not campaign:
        return {"ok": False}
    
    # Increment clicks
    await db.ad_campaigns.update_one(
        {"campaign_id": campaign_id},
        {
            "$inc": {"clicks": 1, "budget_spent": 0.10},  # €0.10 per click
            "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}
        }
    )
    
    # Update CTR
    updated = await db.ad_campaigns.find_one({"campaign_id": campaign_id})
    if updated and updated["impressions"] > 0:
        ctr = (updated["clicks"] / updated["impressions"]) * 100
        await db.ad_campaigns.update_one(
            {"campaign_id": campaign_id},
            {"$set": {"ctr": round(ctr, 2)}}
        )
    
    # Log click
    await db.ad_analytics.insert_one({
        "analytics_id": f"ana_{secrets.token_hex(8)}",
        "campaign_id": campaign_id,
        "event_type": "click",
        "placement": placement,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })
    
    return {"ok": True}

# ══════════════════════════════════════════════════════════════════════════════
# ADMIN ENDPOINTS
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/admin/campaigns")
async def admin_get_all_campaigns(request: Request):
    """Get all campaigns (admin only)"""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(403, "Nur für Admins")
    
    campaigns = await db.ad_campaigns.find({}, {"_id": 0})\
        .sort("created_at", -1).limit(100).to_list(100)
    
    return {"campaigns": campaigns}

@router.get("/admin/stats")
async def admin_ad_stats(request: Request):
    """Get advertising platform stats (admin only)"""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(403, "Nur für Admins")
    
    total_campaigns = await db.ad_campaigns.count_documents({})
    active_campaigns = await db.ad_campaigns.count_documents({"status": "active"})
    
    # Calculate revenue
    pipeline = [
        {"$group": {
            "_id": None,
            "total_revenue": {"$sum": "$budget_total"},
            "total_spent": {"$sum": "$budget_spent"}
        }}
    ]
    revenue_data = await db.ad_campaigns.aggregate(pipeline).to_list(1)
    total_revenue = revenue_data[0]["total_revenue"] if revenue_data else 0
    total_spent = revenue_data[0]["total_spent"] if revenue_data else 0
    
    # Total impressions & clicks
    impressions_pipeline = [
        {"$group": {
            "_id": None,
            "total_impressions": {"$sum": "$impressions"},
            "total_clicks": {"$sum": "$clicks"}
        }}
    ]
    metrics_data = await db.ad_campaigns.aggregate(impressions_pipeline).to_list(1)
    total_impressions = metrics_data[0]["total_impressions"] if metrics_data else 0
    total_clicks = metrics_data[0]["total_clicks"] if metrics_data else 0
    
    avg_ctr = (total_clicks / total_impressions * 100) if total_impressions > 0 else 0
    
    return {
        "total_campaigns": total_campaigns,
        "active_campaigns": active_campaigns,
        "total_revenue": round(total_revenue, 2),
        "total_spent": round(total_spent, 2),
        "revenue_remaining": round(total_revenue - total_spent, 2),
        "total_impressions": total_impressions,
        "total_clicks": total_clicks,
        "avg_ctr": round(avg_ctr, 2),
    }
