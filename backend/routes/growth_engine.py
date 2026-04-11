"""
BidBlitz V2 - Merchant Growth Engine
Intelligent boost suggestions, quality scores, and growth notifications.
"""

import secrets
import logging
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException, Request
from typing import Optional
from bson import ObjectId

from core.database import db
from core.security import get_current_user

router = APIRouter(prefix="/api/growth", tags=["Growth Engine"])
logger = logging.getLogger("bidblitz.growth")


# ══════════════════════════════════════════════════════════════════════════════
# CONFIGURATION (Admin can modify)
# ══════════════════════════════════════════════════════════════════════════════

DEFAULT_CONFIG = {
    "boost_suggestion_age_hours": 48,  # Suggest boost if listing older than X hours
    "boost_suggestion_min_views": 10,  # Suggest boost if views below this
    "boost_expiry_reminder_hours": 12,  # Remind X hours before boost expires
    "premium_expiry_reminder_days": 3,  # Remind X days before premium expires
    "quality_score_weights": {
        "has_image": 25,
        "title_length": 15,  # min 10 chars
        "description_length": 20,  # min 50 chars
        "has_category": 10,
        "has_price": 10,
        "is_boosted": 10,
        "is_vip": 10,
    },
    "boost_visibility_multiplier": 3.0,  # Boosted listings get 3x estimated views
    "vip_visibility_multiplier": 2.0,
}


async def get_config():
    """Get growth engine config from DB or use defaults."""
    config = await db.growth_config.find_one({"_id": "config"})
    if config:
        config.pop("_id", None)
        return {**DEFAULT_CONFIG, **config}
    return DEFAULT_CONFIG


# ══════════════════════════════════════════════════════════════════════════════
# LISTING QUALITY SCORE
# ══════════════════════════════════════════════════════════════════════════════

def calculate_quality_score(listing: dict, config: dict = None) -> dict:
    """
    Calculate quality score for a listing (0-100).
    Returns score and improvement suggestions.
    """
    if config is None:
        config = DEFAULT_CONFIG
    
    weights = config.get("quality_score_weights", DEFAULT_CONFIG["quality_score_weights"])
    score = 0
    suggestions = []
    breakdown = {}
    
    # Has image
    has_images = listing.get("images") and len(listing.get("images", [])) > 0
    if has_images:
        score += weights["has_image"]
        breakdown["has_image"] = weights["has_image"]
    else:
        suggestions.append({
            "type": "add_image",
            "message": "Füge Bilder hinzu für mehr Aufmerksamkeit",
            "impact": "high",
            "points": weights["has_image"]
        })
        breakdown["has_image"] = 0
    
    # Title length
    title = listing.get("title", "")
    if len(title) >= 10:
        score += weights["title_length"]
        breakdown["title_length"] = weights["title_length"]
    else:
        suggestions.append({
            "type": "improve_title",
            "message": "Verbessere den Titel (min. 10 Zeichen)",
            "impact": "medium",
            "points": weights["title_length"]
        })
        breakdown["title_length"] = 0
    
    # Description length
    description = listing.get("description", "")
    if len(description) >= 50:
        score += weights["description_length"]
        breakdown["description_length"] = weights["description_length"]
    elif len(description) >= 20:
        score += weights["description_length"] // 2
        breakdown["description_length"] = weights["description_length"] // 2
        suggestions.append({
            "type": "improve_description",
            "message": "Erweitere die Beschreibung (min. 50 Zeichen)",
            "impact": "medium",
            "points": weights["description_length"] // 2
        })
    else:
        suggestions.append({
            "type": "add_description",
            "message": "Füge eine ausführliche Beschreibung hinzu",
            "impact": "high",
            "points": weights["description_length"]
        })
        breakdown["description_length"] = 0
    
    # Has category
    if listing.get("category"):
        score += weights["has_category"]
        breakdown["has_category"] = weights["has_category"]
    else:
        suggestions.append({
            "type": "add_category",
            "message": "Wähle eine Kategorie für bessere Auffindbarkeit",
            "impact": "low",
            "points": weights["has_category"]
        })
        breakdown["has_category"] = 0
    
    # Has price
    if listing.get("price") and listing["price"] > 0:
        score += weights["has_price"]
        breakdown["has_price"] = weights["has_price"]
    else:
        breakdown["has_price"] = 0
    
    # Is boosted
    now = datetime.now(timezone.utc).isoformat()
    is_boosted = listing.get("boost") and listing["boost"].get("expires_at", "") > now
    if is_boosted:
        score += weights["is_boosted"]
        breakdown["is_boosted"] = weights["is_boosted"]
    else:
        suggestions.append({
            "type": "boost",
            "message": "Boost deine Anzeige für mehr Sichtbarkeit",
            "impact": "high",
            "points": weights["is_boosted"]
        })
        breakdown["is_boosted"] = 0
    
    # Is VIP
    if listing.get("is_vip"):
        score += weights["is_vip"]
        breakdown["is_vip"] = weights["is_vip"]
    else:
        suggestions.append({
            "type": "vip",
            "message": "VIP-Status für Premium-Platzierung",
            "impact": "medium",
            "points": weights["is_vip"]
        })
        breakdown["is_vip"] = 0
    
    # Sort suggestions by impact
    impact_order = {"high": 0, "medium": 1, "low": 2}
    suggestions.sort(key=lambda x: impact_order.get(x["impact"], 3))
    
    return {
        "score": score,
        "max_score": 100,
        "grade": "A" if score >= 80 else "B" if score >= 60 else "C" if score >= 40 else "D",
        "breakdown": breakdown,
        "suggestions": suggestions[:3],  # Top 3 suggestions
    }


# ══════════════════════════════════════════════════════════════════════════════
# BOOST SUGGESTIONS
# ══════════════════════════════════════════════════════════════════════════════

async def get_boost_suggestions(user_id: str, config: dict = None) -> list:
    """
    Get boost suggestions for user's listings based on performance.
    """
    if config is None:
        config = await get_config()
    
    now = datetime.now(timezone.utc)
    suggestions = []
    
    # Get user's active listings
    listings = await db.marketplace_listings.find({
        "seller_id": user_id,
        "status": "active"
    }).to_list(100)
    
    age_threshold = now - timedelta(hours=config["boost_suggestion_age_hours"])
    min_views = config["boost_suggestion_min_views"]
    
    for listing in listings:
        # Skip if already boosted
        boost = listing.get("boost")
        if boost and boost.get("expires_at", "") > now.isoformat():
            continue
        
        # Check listing age
        created_at = listing.get("created_at", "")
        if isinstance(created_at, str):
            try:
                created = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
            except:
                created = now
        else:
            created = created_at or now
        
        listing_age_hours = (now - created).total_seconds() / 3600 if created else 0
        views = listing.get("views", 0)
        
        # Generate suggestion reason
        reasons = []
        priority = 0
        
        if listing_age_hours > config["boost_suggestion_age_hours"]:
            reasons.append("Anzeige älter als 48 Stunden")
            priority += 2
        
        if views < min_views:
            reasons.append(f"Nur {views} Views")
            priority += 3
        
        if listing_age_hours > 24 and views < 5:
            reasons.append("Niedrige Sichtbarkeit")
            priority += 4
        
        if reasons:
            suggestions.append({
                "listing_id": listing.get("listing_id"),
                "title": listing.get("title", "")[:40],
                "image": listing.get("images", [None])[0],
                "price": listing.get("price", 0),
                "views": views,
                "age_hours": round(listing_age_hours),
                "reasons": reasons,
                "priority": priority,
                "suggestion": "Boost empfohlen",
                "cta": "Jetzt boosten",
                "estimated_boost": f"+{int(views * config['boost_visibility_multiplier'])} Views",
            })
    
    # Sort by priority (highest first)
    suggestions.sort(key=lambda x: x["priority"], reverse=True)
    
    return suggestions[:5]  # Return top 5


# ══════════════════════════════════════════════════════════════════════════════
# GROWTH NOTIFICATIONS
# ══════════════════════════════════════════════════════════════════════════════

async def create_growth_notification(
    user_id: str,
    notification_type: str,
    title: str,
    message: str,
    data: dict = None
):
    """Create a growth-related notification."""
    now = datetime.now(timezone.utc)
    
    # Check if similar notification was sent recently (24h)
    recent = await db.notifications.find_one({
        "user_id": user_id,
        "type": notification_type,
        "created_at": {"$gte": (now - timedelta(hours=24)).isoformat()}
    })
    
    if recent:
        return None  # Don't spam
    
    notification = {
        "id": secrets.token_hex(8),
        "user_id": user_id,
        "type": notification_type,
        "title": title,
        "message": message,
        "data": data or {},
        "read": False,
        "created_at": now.isoformat(),
    }
    
    await db.notifications.insert_one(notification)
    notification.pop("_id", None)
    
    return notification


async def process_boost_expiry_reminders():
    """
    Background job: Send reminders for expiring boosts.
    Call this periodically (e.g., every hour).
    """
    config = await get_config()
    now = datetime.now(timezone.utc)
    reminder_window = now + timedelta(hours=config["boost_expiry_reminder_hours"])
    
    # Find boosts expiring soon
    expiring = await db.marketplace_listings.find({
        "status": "active",
        "boost.expires_at": {
            "$gte": now.isoformat(),
            "$lte": reminder_window.isoformat()
        }
    }).to_list(100)
    
    count = 0
    for listing in expiring:
        # Check if reminder already sent
        existing = await db.notifications.find_one({
            "user_id": listing["seller_id"],
            "type": "boost_expiring",
            "data.listing_id": listing["listing_id"],
            "created_at": {"$gte": (now - timedelta(hours=12)).isoformat()}
        })
        
        if not existing:
            await create_growth_notification(
                user_id=listing["seller_id"],
                notification_type="boost_expiring",
                title="Boost läuft bald ab",
                message=f"Dein Boost für '{listing['title'][:30]}' läuft bald ab. Verlängere jetzt!",
                data={
                    "listing_id": listing["listing_id"],
                    "expires_at": listing["boost"]["expires_at"],
                    "cta": "extend_boost"
                }
            )
            count += 1
    
    return count


async def process_premium_expiry_reminders():
    """
    Background job: Send reminders for expiring merchant premium plans.
    """
    config = await get_config()
    now = datetime.now(timezone.utc)
    reminder_window = now + timedelta(days=config["premium_expiry_reminder_days"])
    
    # Find merchants with expiring plans
    expiring = await db.merchants.find({
        "plan": "pro",
        "plan_expires_at": {
            "$gte": now.isoformat(),
            "$lte": reminder_window.isoformat()
        }
    }).to_list(100)
    
    count = 0
    for merchant in expiring:
        await create_growth_notification(
            user_id=merchant["user_id"],
            notification_type="premium_expiring",
            title="Pro-Plan läuft ab",
            message=f"Dein Pro-Plan läuft in {config['premium_expiry_reminder_days']} Tagen ab. Verlängere jetzt!",
            data={
                "merchant_id": merchant["merchant_id"],
                "expires_at": merchant["plan_expires_at"],
                "cta": "renew_premium"
            }
        )
        count += 1
    
    return count


async def process_low_visibility_alerts():
    """
    Background job: Alert merchants about listings with low visibility.
    """
    config = await get_config()
    now = datetime.now(timezone.utc)
    age_threshold = (now - timedelta(hours=72)).isoformat()
    
    # Find old listings with low views that aren't boosted
    low_visibility = await db.marketplace_listings.find({
        "status": "active",
        "created_at": {"$lte": age_threshold},
        "views": {"$lt": config["boost_suggestion_min_views"]},
        "$or": [
            {"boost": None},
            {"boost.expires_at": {"$lt": now.isoformat()}}
        ]
    }).to_list(100)
    
    count = 0
    for listing in low_visibility:
        await create_growth_notification(
            user_id=listing["seller_id"],
            notification_type="low_visibility",
            title="Anzeige verliert Sichtbarkeit",
            message=f"'{listing['title'][:30]}' hat wenige Views. Boost jetzt für mehr Reichweite!",
            data={
                "listing_id": listing["listing_id"],
                "views": listing.get("views", 0),
                "cta": "boost_listing"
            }
        )
        count += 1
    
    return count


# ══════════════════════════════════════════════════════════════════════════════
# API ENDPOINTS
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/dashboard")
async def get_growth_dashboard(request: Request):
    """
    Get complete growth dashboard for merchant.
    Includes suggestions, quality scores, and growth metrics.
    """
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    config = await get_config()
    now = datetime.now(timezone.utc).isoformat()
    
    # Get merchant info
    merchant = await db.merchants.find_one({"user_id": user_id}, {"_id": 0})
    is_premium = merchant and merchant.get("plan") == "pro"
    
    # Get listings
    listings = await db.marketplace_listings.find(
        {"seller_id": user_id, "status": "active"},
        {"_id": 0}
    ).to_list(100)
    
    # Calculate quality scores
    listings_with_scores = []
    total_score = 0
    for listing in listings:
        quality = calculate_quality_score(listing, config)
        total_score += quality["score"]
        listings_with_scores.append({
            **listing,
            "quality": quality,
        })
    
    avg_quality = round(total_score / len(listings)) if listings else 0
    
    # Get boost suggestions
    boost_suggestions = await get_boost_suggestions(user_id, config)
    
    # Get active boosts
    active_boosts = [l for l in listings if l.get("boost") and l["boost"].get("expires_at", "") > now]
    
    # Calculate stats
    total_views = sum(l.get("views", 0) for l in listings)
    total_favorites = sum(l.get("favorites", 0) for l in listings)
    
    # Get boost spending
    boost_txns = await db.transactions.find({
        "user_id": user_id,
        "$or": [
            {"reference": {"$regex": "^BOOST-"}},
            {"reference": {"$regex": "^VIP-"}}
        ]
    }).to_list(200)
    total_spent = sum(abs(t.get("amount", 0)) for t in boost_txns)
    
    # Growth suggestions
    growth_suggestions = []
    
    if not is_premium:
        growth_suggestions.append({
            "type": "upgrade_premium",
            "title": "Upgrade auf Pro",
            "message": "Unbegrenzte Anzeigen, weniger Gebühren, VIP-Badge",
            "impact": "high",
            "cta": "Jetzt upgraden",
            "price": 29.99,
        })
    
    if len(active_boosts) == 0 and len(listings) > 0:
        growth_suggestions.append({
            "type": "boost_first",
            "title": "Erste Anzeige boosten",
            "message": "Erreiche bis zu 3x mehr potentielle Käufer",
            "impact": "high",
            "cta": "Boost starten",
        })
    
    if avg_quality < 60:
        growth_suggestions.append({
            "type": "improve_quality",
            "title": "Qualität verbessern",
            "message": f"Durchschnittliche Qualität: {avg_quality}/100. Verbessere deine Anzeigen!",
            "impact": "medium",
            "cta": "Tipps ansehen",
        })
    
    # Get unread growth notifications
    notifications = await db.notifications.find({
        "user_id": user_id,
        "type": {"$in": ["boost_expiring", "premium_expiring", "low_visibility", "boost_suggestion"]},
        "read": False
    }, {"_id": 0}).sort("created_at", -1).limit(5).to_list(5)
    
    return {
        "stats": {
            "total_listings": len(listings),
            "active_boosts": len(active_boosts),
            "total_views": total_views,
            "total_favorites": total_favorites,
            "avg_quality_score": avg_quality,
            "total_spent_on_promotion": round(total_spent, 2),
        },
        "is_premium": is_premium,
        "premium_expires_at": merchant.get("plan_expires_at") if is_premium else None,
        "boost_suggestions": boost_suggestions,
        "growth_suggestions": growth_suggestions,
        "listings_with_scores": listings_with_scores[:10],  # Top 10
        "notifications": notifications,
        "config": {
            "boost_visibility_multiplier": config["boost_visibility_multiplier"],
            "vip_visibility_multiplier": config["vip_visibility_multiplier"],
        }
    }


@router.get("/listing/{listing_id}/quality")
async def get_listing_quality(listing_id: str, request: Request):
    """Get quality score for a specific listing."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    listing = await db.marketplace_listings.find_one(
        {"listing_id": listing_id, "seller_id": user_id},
        {"_id": 0}
    )
    
    if not listing:
        raise HTTPException(status_code=404, detail="Anzeige nicht gefunden")
    
    config = await get_config()
    quality = calculate_quality_score(listing, config)
    
    return {
        "listing_id": listing_id,
        "quality": quality,
    }


@router.get("/suggestions")
async def get_all_suggestions(request: Request):
    """Get all growth suggestions for user."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    config = await get_config()
    boost_suggestions = await get_boost_suggestions(user_id, config)
    
    return {
        "boost_suggestions": boost_suggestions,
        "total": len(boost_suggestions),
    }


@router.post("/dismiss-notification/{notification_id}")
async def dismiss_growth_notification(notification_id: str, request: Request):
    """Mark a growth notification as read."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    result = await db.notifications.update_one(
        {"id": notification_id, "user_id": user_id},
        {"$set": {"read": True}}
    )
    
    return {"ok": result.modified_count > 0}


# ══════════════════════════════════════════════════════════════════════════════
# ADMIN CONFIG
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/admin/config")
async def admin_get_config(request: Request):
    """Admin: Get growth engine configuration."""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    
    config = await get_config()
    return {"config": config}


@router.post("/admin/config")
async def admin_update_config(request: Request):
    """Admin: Update growth engine configuration."""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    
    body = await request.json()
    
    # Validate and merge with defaults
    allowed_keys = set(DEFAULT_CONFIG.keys())
    updates = {k: v for k, v in body.items() if k in allowed_keys}
    
    if updates:
        await db.growth_config.update_one(
            {"_id": "config"},
            {"$set": updates},
            upsert=True
        )
    
    return {"ok": True, "updated": list(updates.keys())}


@router.post("/admin/process-reminders")
async def admin_process_reminders(request: Request):
    """Admin: Manually trigger reminder processing."""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    
    boost_reminders = await process_boost_expiry_reminders()
    premium_reminders = await process_premium_expiry_reminders()
    low_visibility = await process_low_visibility_alerts()
    
    return {
        "ok": True,
        "boost_expiry_reminders": boost_reminders,
        "premium_expiry_reminders": premium_reminders,
        "low_visibility_alerts": low_visibility,
    }
