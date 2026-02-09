"""Personal Recommendations Router - AI-based product recommendations"""
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone, timedelta
from typing import Optional, List
import uuid
import random

from config import db, logger
from dependencies import get_current_user

router = APIRouter(prefix="/recommendations", tags=["Recommendations"])

# ==================== ENDPOINTS ====================

@router.get("/for-you")
async def get_personalized_recommendations(user: dict = Depends(get_current_user), limit: int = 10):
    """Get personalized auction recommendations based on user behavior"""
    user_id = user["id"]
    
    # Get user's bidding history to understand preferences
    user_bids = await db.bids.find(
        {"user_id": user_id, "is_bot": {"$ne": True}},
        {"_id": 0, "auction_id": 1}
    ).sort("created_at", -1).limit(50).to_list(50)
    
    bid_auction_ids = [b["auction_id"] for b in user_bids]
    
    # Get categories from user's bid history
    preferred_categories = []
    if bid_auction_ids:
        auctions = await db.auctions.find(
            {"id": {"$in": bid_auction_ids}},
            {"_id": 0, "product_category": 1}
        ).to_list(50)
        
        for a in auctions:
            cat = a.get("product_category")
            if cat:
                preferred_categories.append(cat)
    
    # Get user's favorite/watched auctions
    favorites = await db.favorites.find(
        {"user_id": user_id},
        {"_id": 0, "auction_id": 1}
    ).to_list(20)
    
    favorite_ids = [f["auction_id"] for f in favorites]
    
    # Build recommendation query
    query = {
        "status": "active",
        "id": {"$nin": bid_auction_ids + favorite_ids}  # Exclude already engaged auctions
    }
    
    # Prefer user's categories if available
    if preferred_categories:
        # Get most common category
        from collections import Counter
        top_categories = [c[0] for c in Counter(preferred_categories).most_common(3)]
        query["product_category"] = {"$in": top_categories}
    
    # Get recommendations
    recommendations = await db.auctions.find(
        query,
        {"_id": 0}
    ).sort("total_bids", -1).limit(limit).to_list(limit)
    
    # If not enough, get popular auctions
    if len(recommendations) < limit:
        del query["product_category"]
        more = await db.auctions.find(
            query,
            {"_id": 0}
        ).sort("total_bids", -1).limit(limit - len(recommendations)).to_list(limit - len(recommendations))
        
        existing_ids = [r["id"] for r in recommendations]
        for m in more:
            if m["id"] not in existing_ids:
                recommendations.append(m)
    
    # Add recommendation reasons
    for rec in recommendations:
        reasons = []
        if rec.get("product_category") in preferred_categories:
            reasons.append("Basierend auf deinen Interessen")
        if rec.get("total_bids", 0) > 50:
            reasons.append("Beliebt bei anderen Nutzern")
        if rec.get("current_price", 0) < 5:
            reasons.append("Niedriger Preis")
        
        rec["recommendation_reasons"] = reasons or ["Für dich empfohlen"]
    
    return {
        "recommendations": recommendations,
        "based_on_categories": list(set(preferred_categories))[:3] if preferred_categories else []
    }

@router.get("/similar/{auction_id}")
async def get_similar_auctions(auction_id: str, limit: int = 5):
    """Get auctions similar to a specific auction"""
    # Get the reference auction
    auction = await db.auctions.find_one({"id": auction_id}, {"_id": 0})
    if not auction:
        raise HTTPException(status_code=404, detail="Auktion nicht gefunden")
    
    category = auction.get("product_category")
    price_range = auction.get("product_retail_price", 100)
    
    # Find similar auctions
    query = {
        "status": "active",
        "id": {"$ne": auction_id}
    }
    
    if category:
        query["product_category"] = category
    
    # Price range: 50% to 200% of original
    query["product_retail_price"] = {
        "$gte": price_range * 0.5,
        "$lte": price_range * 2
    }
    
    similar = await db.auctions.find(
        query,
        {"_id": 0}
    ).limit(limit).to_list(limit)
    
    # If not enough, relax constraints
    if len(similar) < limit:
        del query["product_retail_price"]
        if category:
            more = await db.auctions.find(
                query,
                {"_id": 0}
            ).limit(limit - len(similar)).to_list(limit - len(similar))
            
            existing_ids = [s["id"] for s in similar]
            for m in more:
                if m["id"] not in existing_ids:
                    similar.append(m)
    
    return {"similar_auctions": similar, "based_on": auction_id}

@router.get("/trending")
async def get_trending_auctions(limit: int = 10):
    """Get trending auctions based on recent activity"""
    # Get auctions with most bids in last hour
    hour_ago = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
    
    pipeline = [
        {"$match": {"created_at": {"$gte": hour_ago}, "is_bot": {"$ne": True}}},
        {"$group": {"_id": "$auction_id", "bid_count": {"$sum": 1}}},
        {"$sort": {"bid_count": -1}},
        {"$limit": limit}
    ]
    
    trending_ids = await db.bids.aggregate(pipeline).to_list(limit)
    
    if not trending_ids:
        # Fallback to most active auctions overall
        auctions = await db.auctions.find(
            {"status": "active"},
            {"_id": 0}
        ).sort("total_bids", -1).limit(limit).to_list(limit)
        return {"trending": auctions, "period": "all_time"}
    
    # Get auction details
    auction_ids = [t["_id"] for t in trending_ids]
    auctions = await db.auctions.find(
        {"id": {"$in": auction_ids}, "status": "active"},
        {"_id": 0}
    ).to_list(limit)
    
    # Add bid count info
    bid_counts = {t["_id"]: t["bid_count"] for t in trending_ids}
    for auction in auctions:
        auction["recent_bids"] = bid_counts.get(auction["id"], 0)
    
    # Sort by recent bids
    auctions.sort(key=lambda x: x.get("recent_bids", 0), reverse=True)
    
    return {"trending": auctions, "period": "last_hour"}

@router.get("/ending-soon")
async def get_ending_soon_auctions(limit: int = 10, minutes: int = 30):
    """Get auctions ending within specified minutes"""
    now = datetime.now(timezone.utc)
    cutoff = now + timedelta(minutes=minutes)
    
    auctions = await db.auctions.find(
        {
            "status": "active",
            "end_time": {
                "$gte": now.isoformat(),
                "$lte": cutoff.isoformat()
            }
        },
        {"_id": 0}
    ).sort("end_time", 1).limit(limit).to_list(limit)
    
    # Add time remaining
    for auction in auctions:
        end_time = datetime.fromisoformat(auction["end_time"].replace('Z', '+00:00'))
        remaining = (end_time - now).total_seconds()
        auction["seconds_remaining"] = max(0, int(remaining))
        auction["minutes_remaining"] = max(0, int(remaining / 60))
    
    return {"ending_soon": auctions, "within_minutes": minutes}

@router.get("/hot-deals")
async def get_hot_deals(limit: int = 10):
    """Get auctions with highest savings potential"""
    auctions = await db.auctions.find(
        {"status": "active", "product_retail_price": {"$gt": 0}},
        {"_id": 0}
    ).to_list(100)
    
    # Calculate savings percentage
    for auction in auctions:
        retail = auction.get("product_retail_price", 1)
        current = auction.get("current_price", 0)
        auction["savings_percent"] = round((1 - current / retail) * 100) if retail > 0 else 0
    
    # Sort by savings
    auctions.sort(key=lambda x: x.get("savings_percent", 0), reverse=True)
    
    return {"hot_deals": auctions[:limit]}


recommendations_router = router
