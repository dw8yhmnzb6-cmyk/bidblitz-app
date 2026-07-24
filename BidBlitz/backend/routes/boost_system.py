"""
BidBlitz V2 - Paid Boost System
Premium visibility for listings and restaurants.
Platform revenue through visibility boosts.
"""

import secrets
import logging
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from typing import Optional
from bson import ObjectId

from core.database import db
from core.security import get_current_user
from core.payment_engine import debit_wallet, TransactionType

router = APIRouter(prefix="/api/boost", tags=["Boost"])
logger = logging.getLogger("bidblitz.boost")


# ══════════════════════════════════════════════════════════════════════════════
# CONFIGURATION
# ══════════════════════════════════════════════════════════════════════════════

DEFAULT_BOOST_PRICES = {
    "top": {"price": 5.00, "duration_days": 7, "priority": 1, "label": "Top-Platzierung"},
    "featured": {"price": 10.00, "duration_days": 7, "priority": 2, "label": "Hervorgehoben"},
    "premium": {"price": 20.00, "duration_days": 14, "priority": 3, "label": "Premium"},
}

BOOST_TYPES = ["listing", "restaurant"]


async def get_boost_config() -> dict:
    """Get boost prices from admin config or use defaults."""
    config = await db.platform_config.find_one({"key": "boost_prices"})
    if config and config.get("prices"):
        return {**DEFAULT_BOOST_PRICES, **config.get("prices", {})}
    return DEFAULT_BOOST_PRICES


# ══════════════════════════════════════════════════════════════════════════════
# SCHEMAS
# ══════════════════════════════════════════════════════════════════════════════

class BuyBoostRequest(BaseModel):
    target_id: str
    target_type: str = Field(..., description="listing or restaurant")
    boost_type: str = Field(..., description="top, featured, or premium")


class AdminPriceUpdateRequest(BaseModel):
    boost_type: str
    price: Optional[float] = None
    duration_days: Optional[int] = None
    enabled: Optional[bool] = None


# ══════════════════════════════════════════════════════════════════════════════
# BUY BOOST
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/buy")
async def buy_boost(req: BuyBoostRequest, request: Request):
    """
    Purchase a boost for a listing or restaurant.
    Deducts from wallet and creates boost entry.
    """
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    # Validate target type
    if req.target_type not in BOOST_TYPES:
        raise HTTPException(status_code=400, detail=f"Ungültiger Typ. Erlaubt: {', '.join(BOOST_TYPES)}")
    
    # Get boost config
    config = await get_boost_config()
    if req.boost_type not in config:
        raise HTTPException(status_code=400, detail=f"Ungültiger Boost-Typ. Erlaubt: {', '.join(config.keys())}")
    
    boost_info = config[req.boost_type]
    price = boost_info["price"]
    duration = boost_info["duration_days"]
    priority = boost_info["priority"]
    
    # Check if boost type is enabled
    if boost_info.get("enabled") == False:
        raise HTTPException(status_code=400, detail="Dieser Boost-Typ ist derzeit deaktiviert")
    
    # Verify ownership of target
    if req.target_type == "listing":
        target = await db.marketplace_listings.find_one({
            "listing_id": req.target_id,
            "seller_id": user_id
        })
        if not target:
            raise HTTPException(status_code=404, detail="Anzeige nicht gefunden oder nicht deine")
        if target.get("status") != "active":
            raise HTTPException(status_code=400, detail="Nur aktive Anzeigen können geboostet werden")
    elif req.target_type == "restaurant":
        target = await db.food_restaurants.find_one({
            "$or": [
                {"restaurant_id": req.target_id, "owner_id": user_id},
                {"restaurant_id": req.target_id, "user_id": user_id},
            ]
        })
        if not target:
            raise HTTPException(status_code=404, detail="Restaurant nicht gefunden oder nicht deins")
    
    # Check for existing active boost
    existing = await db.boosts.find_one({
        "target_id": req.target_id,
        "target_type": req.target_type,
        "expires_at": {"$gt": datetime.now(timezone.utc).isoformat()},
    })
    if existing:
        # Upgrade or extend?
        if existing["boost_type"] == req.boost_type:
            raise HTTPException(status_code=400, detail="Bereits aktiver Boost. Warte bis er abläuft oder upgrade.")
    
    # Check wallet balance
    balance = user.get("balance", 0)
    if balance < price:
        raise HTTPException(status_code=400, detail=f"Nicht genug Guthaben. Benötigt: €{price:.2f}, Verfügbar: €{balance:.2f}")
    
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(days=duration)
    boost_id = secrets.token_hex(8)
    
    # Deduct payment
    payment_result = await debit_wallet(
        user_id=user_id,
        amount=price,
        tx_type=TransactionType.FEE,
        description=f"Boost: {boost_info['label']} ({duration} Tage)",
        reference=f"BOOST-{boost_id[:8].upper()}",
        metadata={
            "target_id": req.target_id,
            "target_type": req.target_type,
            "boost_type": req.boost_type,
        }
    )
    
    if not payment_result.success:
        raise HTTPException(status_code=400, detail=payment_result.error)
    
    # Create boost entry
    boost = {
        "boost_id": boost_id,
        "user_id": user_id,
        "target_id": req.target_id,
        "target_type": req.target_type,
        "boost_type": req.boost_type,
        "priority": priority,
        "price_paid": price,
        "starts_at": now.isoformat(),
        "expires_at": expires_at.isoformat(),
        "status": "active",
        "views": 0,
        "clicks": 0,
        "created_at": now.isoformat(),
    }
    
    await db.boosts.insert_one(boost)
    boost.pop("_id", None)
    
    # Update target with boost info
    if req.target_type == "listing":
        await db.marketplace_listings.update_one(
            {"listing_id": req.target_id},
            {"$set": {
                "boost": {
                    "type": req.boost_type,
                    "label": boost_info["label"],
                    "priority": priority,
                    "expires_at": expires_at.isoformat(),
                },
                "boosted_at": now.isoformat(),
            }}
        )
    elif req.target_type == "restaurant":
        await db.food_restaurants.update_one(
            {"restaurant_id": req.target_id},
            {"$set": {
                "boost": {
                    "type": req.boost_type,
                    "label": boost_info["label"],
                    "priority": priority,
                    "expires_at": expires_at.isoformat(),
                },
                "boosted_at": now.isoformat(),
            }}
        )
    
    # Record platform revenue
    await db.platform_revenue.update_one(
        {"date": now.strftime("%Y-%m-%d")},
        {"$inc": {"total": price, "by_source.boosts": price}},
        upsert=True
    )
    
    logger.info(f"Boost purchased: {boost_id} - {req.target_type}/{req.target_id} - {req.boost_type} by {user_id}")
    
    return {
        "ok": True,
        "boost": boost,
        "new_balance": payment_result.new_balance,
        "message": f"Boost aktiviert für {duration} Tage!",
    }


# ══════════════════════════════════════════════════════════════════════════════
# GET BOOST PRICES
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/prices")
async def get_boost_prices():
    """Get current boost prices (public)."""
    config = await get_boost_config()
    
    prices = []
    for boost_type, info in config.items():
        if info.get("enabled", True):
            prices.append({
                "type": boost_type,
                "price": info["price"],
                "duration_days": info["duration_days"],
                "label": info["label"],
                "priority": info["priority"],
            })
    
    # Sort by priority
    prices.sort(key=lambda x: x["priority"])
    
    return {"prices": prices}


# ══════════════════════════════════════════════════════════════════════════════
# MY BOOSTS
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/my-boosts")
async def get_my_boosts(request: Request, active_only: bool = True):
    """Get user's boost history."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    query = {"user_id": user_id}
    if active_only:
        query["expires_at"] = {"$gt": datetime.now(timezone.utc).isoformat()}
    
    boosts = await db.boosts.find(query, {"_id": 0}).sort("created_at", -1).to_list(50)
    
    # Enrich with target info
    for boost in boosts:
        if boost["target_type"] == "listing":
            listing = await db.marketplace_listings.find_one(
                {"listing_id": boost["target_id"]},
                {"title": 1, "price": 1}
            )
            if listing:
                boost["target_name"] = listing.get("title", "")
                boost["target_price"] = listing.get("price", 0)
        elif boost["target_type"] == "restaurant":
            restaurant = await db.food_restaurants.find_one(
                {"restaurant_id": boost["target_id"]},
                {"name": 1}
            )
            if restaurant:
                boost["target_name"] = restaurant.get("name", "")
    
    return {"boosts": boosts, "total": len(boosts)}


# ══════════════════════════════════════════════════════════════════════════════
# TRACK BOOST ANALYTICS
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/track/view/{target_id}")
async def track_boost_view(target_id: str, target_type: str = "listing"):
    """Track a view on a boosted item."""
    boost = await db.boosts.find_one({
        "target_id": target_id,
        "target_type": target_type,
        "expires_at": {"$gt": datetime.now(timezone.utc).isoformat()},
    })
    
    if boost:
        await db.boosts.update_one(
            {"boost_id": boost["boost_id"]},
            {"$inc": {"views": 1}}
        )
    
    return {"ok": True}


@router.post("/track/click/{target_id}")
async def track_boost_click(target_id: str, target_type: str = "listing"):
    """Track a click on a boosted item."""
    boost = await db.boosts.find_one({
        "target_id": target_id,
        "target_type": target_type,
        "expires_at": {"$gt": datetime.now(timezone.utc).isoformat()},
    })
    
    if boost:
        await db.boosts.update_one(
            {"boost_id": boost["boost_id"]},
            {"$inc": {"clicks": 1}}
        )
    
    return {"ok": True}


@router.get("/analytics/{boost_id}")
async def get_boost_analytics(boost_id: str, request: Request):
    """Get analytics for a specific boost."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    boost = await db.boosts.find_one(
        {"boost_id": boost_id, "user_id": user_id},
        {"_id": 0}
    )
    
    if not boost:
        raise HTTPException(status_code=404, detail="Boost nicht gefunden")
    
    # Calculate CTR
    views = boost.get("views", 0)
    clicks = boost.get("clicks", 0)
    ctr = (clicks / views * 100) if views > 0 else 0
    
    return {
        "boost": boost,
        "analytics": {
            "views": views,
            "clicks": clicks,
            "ctr": round(ctr, 2),
            "cost_per_view": round(boost.get("price_paid", 0) / max(views, 1), 4),
            "cost_per_click": round(boost.get("price_paid", 0) / max(clicks, 1), 2),
        }
    }


# ══════════════════════════════════════════════════════════════════════════════
# CANCEL BOOST (No refund)
# ══════════════════════════════════════════════════════════════════════════════

@router.delete("/{boost_id}")
async def cancel_boost(boost_id: str, request: Request):
    """Cancel a boost (no refund)."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    boost = await db.boosts.find_one({"boost_id": boost_id, "user_id": user_id})
    if not boost:
        raise HTTPException(status_code=404, detail="Boost nicht gefunden")
    
    if boost.get("status") != "active":
        raise HTTPException(status_code=400, detail="Boost ist nicht aktiv")
    
    now = datetime.now(timezone.utc)
    
    # Mark as cancelled
    await db.boosts.update_one(
        {"boost_id": boost_id},
        {"$set": {
            "status": "cancelled",
            "cancelled_at": now.isoformat(),
        }}
    )
    
    # Remove boost from target
    if boost["target_type"] == "listing":
        await db.marketplace_listings.update_one(
            {"listing_id": boost["target_id"]},
            {"$unset": {"boost": "", "boosted_at": ""}}
        )
    elif boost["target_type"] == "restaurant":
        await db.food_restaurants.update_one(
            {"restaurant_id": boost["target_id"]},
            {"$unset": {"boost": "", "boosted_at": ""}}
        )
    
    return {"ok": True, "message": "Boost wurde abgebrochen (keine Erstattung)"}


# ══════════════════════════════════════════════════════════════════════════════
# ADMIN ENDPOINTS
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/admin/stats")
async def admin_boost_stats(request: Request):
    """Admin: Get boost statistics."""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Nur Admin")
    
    now = datetime.now(timezone.utc)
    today = now.replace(hour=0, minute=0, second=0, microsecond=0)
    this_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    
    # Active boosts
    active_boosts = await db.boosts.count_documents({
        "expires_at": {"$gt": now.isoformat()}
    })
    
    # Boosts today
    boosts_today = await db.boosts.count_documents({
        "created_at": {"$gte": today.isoformat()}
    })
    
    # Revenue from boosts this month
    monthly_boosts = await db.boosts.find({
        "created_at": {"$gte": this_month.isoformat()}
    }).to_list(1000)
    monthly_revenue = sum(b.get("price_paid", 0) for b in monthly_boosts)
    
    # By type
    by_type = {}
    for boost in monthly_boosts:
        bt = boost.get("boost_type", "unknown")
        by_type[bt] = by_type.get(bt, 0) + 1
    
    # By target type
    by_target = {}
    for boost in monthly_boosts:
        tt = boost.get("target_type", "unknown")
        by_target[tt] = by_target.get(tt, 0) + 1
    
    return {
        "active_boosts": active_boosts,
        "boosts_today": boosts_today,
        "monthly_revenue": round(monthly_revenue, 2),
        "monthly_count": len(monthly_boosts),
        "by_boost_type": by_type,
        "by_target_type": by_target,
    }


@router.post("/admin/prices")
async def admin_update_prices(req: AdminPriceUpdateRequest, request: Request):
    """Admin: Update boost prices."""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Nur Admin")
    
    if req.boost_type not in DEFAULT_BOOST_PRICES:
        raise HTTPException(status_code=400, detail="Ungültiger Boost-Typ")
    
    updates = {}
    if req.price is not None:
        updates[f"prices.{req.boost_type}.price"] = req.price
    if req.duration_days is not None:
        updates[f"prices.{req.boost_type}.duration_days"] = req.duration_days
    if req.enabled is not None:
        updates[f"prices.{req.boost_type}.enabled"] = req.enabled
    
    if updates:
        await db.platform_config.update_one(
            {"key": "boost_prices"},
            {"$set": updates},
            upsert=True
        )
    
    config = await get_boost_config()
    return {"ok": True, "prices": config}


@router.get("/admin/all")
async def admin_get_all_boosts(request: Request, status: str = None, limit: int = 50):
    """Admin: Get all boosts."""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Nur Admin")
    
    query = {}
    if status == "active":
        query["expires_at"] = {"$gt": datetime.now(timezone.utc).isoformat()}
    elif status == "expired":
        query["expires_at"] = {"$lte": datetime.now(timezone.utc).isoformat()}
    
    boosts = await db.boosts.find(query, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    
    return {"boosts": boosts, "total": len(boosts)}


# ══════════════════════════════════════════════════════════════════════════════
# AUTO-EXPIRE BOOSTS (Called by background job)
# ══════════════════════════════════════════════════════════════════════════════

async def cleanup_expired_boosts():
    """Remove expired boosts from targets. Called periodically."""
    now = datetime.now(timezone.utc)
    
    # Find expired boosts that are still marked active
    expired = await db.boosts.find({
        "status": "active",
        "expires_at": {"$lte": now.isoformat()}
    }).to_list(100)
    
    for boost in expired:
        # Update boost status
        await db.boosts.update_one(
            {"boost_id": boost["boost_id"]},
            {"$set": {"status": "expired"}}
        )
        
        # Remove from target
        if boost["target_type"] == "listing":
            await db.marketplace_listings.update_one(
                {"listing_id": boost["target_id"]},
                {"$unset": {"boost": "", "boosted_at": ""}}
            )
        elif boost["target_type"] == "restaurant":
            await db.food_restaurants.update_one(
                {"restaurant_id": boost["target_id"]},
                {"$unset": {"boost": "", "boosted_at": ""}}
            )
    
    return len(expired)


# Endpoint to manually trigger cleanup (for testing)
@router.post("/admin/cleanup-expired")
async def admin_cleanup_expired(request: Request):
    """Admin: Manually cleanup expired boosts."""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Nur Admin")
    
    count = await cleanup_expired_boosts()
    return {"ok": True, "expired_count": count}
