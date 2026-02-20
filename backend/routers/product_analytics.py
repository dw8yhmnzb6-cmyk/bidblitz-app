"""
Product Analytics System - Produkt-Analyse
Trackt Produktansichten und Benutzerinteresse
"""

from fastapi import APIRouter, HTTPException, Header, Request
from datetime import datetime, timezone, timedelta
from typing import Optional, List
from pydantic import BaseModel
import logging

from config import db

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/analytics", tags=["Product Analytics"])


# ==================== DATA MODELS ====================

class ProductViewEvent(BaseModel):
    product_id: str
    auction_id: Optional[str] = None
    source: Optional[str] = "direct"  # direct, search, category, recommendation
    duration_seconds: Optional[int] = 0


class ProductInteractionEvent(BaseModel):
    product_id: str
    auction_id: Optional[str] = None
    interaction_type: str  # view, bid, wishlist, share, buy


# ==================== TRACKING ENDPOINTS ====================

@router.post("/product-view")
async def track_product_view(
    event: ProductViewEvent,
    request: Request,
    authorization: str = Header(None)
):
    """Track when a user views a product."""
    
    # Get user info if logged in
    user_id = None
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ")[1]
        session = await db.sessions.find_one({"token": token}, {"user_id": 1, "_id": 0})
        if session:
            user_id = session.get("user_id")
    
    # Get client info
    client_ip = request.client.host if request.client else "unknown"
    user_agent = request.headers.get("user-agent", "unknown")
    
    # Create view record
    view_record = {
        "product_id": event.product_id,
        "auction_id": event.auction_id,
        "user_id": user_id,
        "source": event.source,
        "duration_seconds": event.duration_seconds,
        "client_ip": client_ip,
        "user_agent": user_agent[:200] if user_agent else None,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "date": datetime.now(timezone.utc).strftime("%Y-%m-%d")
    }
    
    await db.product_views.insert_one(view_record)
    
    # Update product view count
    await db.product_view_stats.update_one(
        {"product_id": event.product_id},
        {
            "$inc": {"total_views": 1, "views_today": 1},
            "$set": {"last_viewed": datetime.now(timezone.utc).isoformat()},
            "$setOnInsert": {"first_viewed": datetime.now(timezone.utc).isoformat()}
        },
        upsert=True
    )
    
    return {"success": True}


@router.post("/product-interaction")
async def track_product_interaction(
    event: ProductInteractionEvent,
    request: Request,
    authorization: str = Header(None)
):
    """Track user interactions with products (bids, wishlist, shares)."""
    
    user_id = None
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ")[1]
        session = await db.sessions.find_one({"token": token}, {"user_id": 1, "_id": 0})
        if session:
            user_id = session.get("user_id")
    
    interaction_record = {
        "product_id": event.product_id,
        "auction_id": event.auction_id,
        "user_id": user_id,
        "interaction_type": event.interaction_type,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "date": datetime.now(timezone.utc).strftime("%Y-%m-%d")
    }
    
    await db.product_interactions.insert_one(interaction_record)
    
    # Update interaction counts
    inc_field = f"interactions.{event.interaction_type}"
    await db.product_view_stats.update_one(
        {"product_id": event.product_id},
        {"$inc": {inc_field: 1}},
        upsert=True
    )
    
    return {"success": True}


# ==================== ANALYTICS ENDPOINTS ====================

@router.get("/top-products")
async def get_top_viewed_products(
    period: str = "week",  # today, week, month, all
    limit: int = 20,
    category: Optional[str] = None
):
    """Get most viewed products for a given period."""
    
    # Calculate date filter
    now = datetime.now(timezone.utc)
    if period == "today":
        start_date = now.strftime("%Y-%m-%d")
    elif period == "week":
        start_date = (now - timedelta(days=7)).strftime("%Y-%m-%d")
    elif period == "month":
        start_date = (now - timedelta(days=30)).strftime("%Y-%m-%d")
    else:
        start_date = None
    
    # Build aggregation pipeline
    match_stage = {}
    if start_date:
        match_stage["date"] = {"$gte": start_date}
    
    pipeline = [
        {"$match": match_stage} if match_stage else {"$match": {}},
        {"$group": {
            "_id": "$product_id",
            "view_count": {"$sum": 1},
            "unique_users": {"$addToSet": "$user_id"},
            "sources": {"$push": "$source"}
        }},
        {"$project": {
            "_id": 1,
            "view_count": 1,
            "unique_user_count": {"$size": "$unique_users"},
            "source_breakdown": {"$arrayElemAt": ["$sources", 0]}
        }},
        {"$sort": {"view_count": -1}},
        {"$limit": limit}
    ]
    
    results = await db.product_views.aggregate(pipeline).to_list(limit)
    
    # Enrich with product details
    enriched_results = []
    for item in results:
        product = await db.products.find_one(
            {"id": item["_id"]},
            {"_id": 0, "id": 1, "name": 1, "image": 1, "category": 1, "retail_price": 1}
        )
        if product:
            if category and product.get("category") != category:
                continue
            enriched_results.append({
                "product_id": item["_id"],
                "product_name": product.get("name", "Unbekannt"),
                "product_image": product.get("image"),
                "category": product.get("category"),
                "retail_price": product.get("retail_price", 0),
                "view_count": item["view_count"],
                "unique_users": item["unique_user_count"]
            })
    
    return {
        "period": period,
        "products": enriched_results,
        "total": len(enriched_results)
    }


@router.get("/trending")
async def get_trending_products(limit: int = 10):
    """Get trending products based on recent activity spike."""
    
    now = datetime.now(timezone.utc)
    today = now.strftime("%Y-%m-%d")
    yesterday = (now - timedelta(days=1)).strftime("%Y-%m-%d")
    last_week_start = (now - timedelta(days=7)).strftime("%Y-%m-%d")
    
    # Get today's views
    today_pipeline = [
        {"$match": {"date": today}},
        {"$group": {"_id": "$product_id", "today_views": {"$sum": 1}}}
    ]
    today_views = {r["_id"]: r["today_views"] async for r in db.product_views.aggregate(today_pipeline)}
    
    # Get last week's daily average
    week_pipeline = [
        {"$match": {"date": {"$gte": last_week_start, "$lt": today}}},
        {"$group": {"_id": "$product_id", "week_views": {"$sum": 1}}}
    ]
    week_views = {r["_id"]: r["week_views"] / 7 async for r in db.product_views.aggregate(week_pipeline)}
    
    # Calculate trending score
    trending = []
    for product_id, views_today in today_views.items():
        avg_views = week_views.get(product_id, 0.1)  # Avoid division by zero
        trending_score = (views_today - avg_views) / max(avg_views, 1) * 100
        
        if trending_score > 0:
            trending.append({
                "product_id": product_id,
                "views_today": views_today,
                "avg_daily_views": round(avg_views, 1),
                "trending_score": round(trending_score, 1)
            })
    
    # Sort by trending score
    trending.sort(key=lambda x: x["trending_score"], reverse=True)
    trending = trending[:limit]
    
    # Enrich with product details
    for item in trending:
        product = await db.products.find_one(
            {"id": item["product_id"]},
            {"_id": 0, "name": 1, "image": 1, "category": 1}
        )
        if product:
            item["product_name"] = product.get("name", "Unbekannt")
            item["product_image"] = product.get("image")
            item["category"] = product.get("category")
    
    return {
        "trending_products": trending,
        "calculated_at": now.isoformat()
    }


@router.get("/product/{product_id}/stats")
async def get_product_analytics(product_id: str):
    """Get detailed analytics for a specific product."""
    
    # Get product info
    product = await db.products.find_one(
        {"id": product_id},
        {"_id": 0, "id": 1, "name": 1, "image": 1, "category": 1, "retail_price": 1}
    )
    
    if not product:
        raise HTTPException(status_code=404, detail="Produkt nicht gefunden")
    
    # Get view stats
    stats = await db.product_view_stats.find_one(
        {"product_id": product_id},
        {"_id": 0}
    )
    
    now = datetime.now(timezone.utc)
    
    # Get views per day for last 30 days
    thirty_days_ago = (now - timedelta(days=30)).strftime("%Y-%m-%d")
    daily_pipeline = [
        {"$match": {"product_id": product_id, "date": {"$gte": thirty_days_ago}}},
        {"$group": {"_id": "$date", "views": {"$sum": 1}}},
        {"$sort": {"_id": 1}}
    ]
    daily_views = await db.product_views.aggregate(daily_pipeline).to_list(30)
    
    # Get source breakdown
    source_pipeline = [
        {"$match": {"product_id": product_id}},
        {"$group": {"_id": "$source", "count": {"$sum": 1}}}
    ]
    source_breakdown = await db.product_views.aggregate(source_pipeline).to_list(10)
    
    # Get interaction breakdown
    interaction_pipeline = [
        {"$match": {"product_id": product_id}},
        {"$group": {"_id": "$interaction_type", "count": {"$sum": 1}}}
    ]
    interactions = await db.product_interactions.aggregate(interaction_pipeline).to_list(10)
    
    # Get unique visitors
    unique_pipeline = [
        {"$match": {"product_id": product_id, "user_id": {"$ne": None}}},
        {"$group": {"_id": "$user_id"}}
    ]
    unique_users = len(await db.product_views.aggregate(unique_pipeline).to_list(10000))
    
    return {
        "product": product,
        "total_views": stats.get("total_views", 0) if stats else 0,
        "unique_visitors": unique_users,
        "last_viewed": stats.get("last_viewed") if stats else None,
        "first_viewed": stats.get("first_viewed") if stats else None,
        "daily_views": [{"date": d["_id"], "views": d["views"]} for d in daily_views],
        "source_breakdown": {s["_id"]: s["count"] for s in source_breakdown},
        "interactions": {i["_id"]: i["count"] for i in interactions if i["_id"]}
    }


@router.get("/category-stats")
async def get_category_analytics(period: str = "month"):
    """Get analytics grouped by category."""
    
    now = datetime.now(timezone.utc)
    if period == "today":
        start_date = now.strftime("%Y-%m-%d")
    elif period == "week":
        start_date = (now - timedelta(days=7)).strftime("%Y-%m-%d")
    else:
        start_date = (now - timedelta(days=30)).strftime("%Y-%m-%d")
    
    # Get views per product
    pipeline = [
        {"$match": {"date": {"$gte": start_date}}},
        {"$group": {"_id": "$product_id", "views": {"$sum": 1}}}
    ]
    product_views = {r["_id"]: r["views"] async for r in db.product_views.aggregate(pipeline)}
    
    # Group by category
    category_stats = {}
    for product_id, views in product_views.items():
        product = await db.products.find_one(
            {"id": product_id},
            {"category": 1, "_id": 0}
        )
        if product:
            cat = product.get("category", "Sonstige")
            if cat not in category_stats:
                category_stats[cat] = {"views": 0, "products": 0}
            category_stats[cat]["views"] += views
            category_stats[cat]["products"] += 1
    
    # Sort by views
    sorted_cats = sorted(
        [{"category": k, **v} for k, v in category_stats.items()],
        key=lambda x: x["views"],
        reverse=True
    )
    
    return {
        "period": period,
        "categories": sorted_cats,
        "total_categories": len(sorted_cats)
    }


@router.get("/interest-score")
async def get_product_interest_scores(limit: int = 20):
    """Calculate interest score based on views, bids, and interactions."""
    
    # Weight factors for interest calculation
    WEIGHTS = {
        "view": 1,
        "bid": 10,
        "wishlist": 5,
        "share": 3,
        "buy": 15
    }
    
    # Get all product stats
    stats = await db.product_view_stats.find({}, {"_id": 0}).to_list(1000)
    
    scores = []
    for stat in stats:
        product_id = stat.get("product_id")
        total_views = stat.get("total_views", 0)
        interactions = stat.get("interactions", {})
        
        # Calculate weighted score
        score = total_views * WEIGHTS["view"]
        for interaction_type, count in interactions.items():
            score += count * WEIGHTS.get(interaction_type, 1)
        
        if score > 0:
            scores.append({
                "product_id": product_id,
                "interest_score": round(score, 1),
                "views": total_views,
                "bids": interactions.get("bid", 0),
                "wishlist_adds": interactions.get("wishlist", 0),
                "shares": interactions.get("share", 0)
            })
    
    # Sort by score
    scores.sort(key=lambda x: x["interest_score"], reverse=True)
    scores = scores[:limit]
    
    # Enrich with product details
    for item in scores:
        product = await db.products.find_one(
            {"id": item["product_id"]},
            {"_id": 0, "name": 1, "image": 1, "category": 1, "retail_price": 1}
        )
        if product:
            item["product_name"] = product.get("name", "Unbekannt")
            item["product_image"] = product.get("image")
            item["category"] = product.get("category")
            item["retail_price"] = product.get("retail_price", 0)
    
    return {
        "products": scores,
        "total": len(scores),
        "weights_used": WEIGHTS
    }


@router.get("/overview")
async def get_analytics_overview():
    """Get overall analytics overview for the admin dashboard."""
    
    now = datetime.now(timezone.utc)
    today = now.strftime("%Y-%m-%d")
    yesterday = (now - timedelta(days=1)).strftime("%Y-%m-%d")
    week_ago = (now - timedelta(days=7)).strftime("%Y-%m-%d")
    month_ago = (now - timedelta(days=30)).strftime("%Y-%m-%d")
    
    # Today's views
    views_today = await db.product_views.count_documents({"date": today})
    views_yesterday = await db.product_views.count_documents({"date": yesterday})
    
    # This week vs last week
    views_this_week = await db.product_views.count_documents({"date": {"$gte": week_ago}})
    two_weeks_ago = (now - timedelta(days=14)).strftime("%Y-%m-%d")
    views_last_week = await db.product_views.count_documents({
        "date": {"$gte": two_weeks_ago, "$lt": week_ago}
    })
    
    # Total views
    total_views = await db.product_views.count_documents({})
    
    # Unique products viewed today
    unique_today = len(await db.product_views.distinct("product_id", {"date": today}))
    
    # Top category today
    top_cat_pipeline = [
        {"$match": {"date": today}},
        {"$group": {"_id": "$product_id", "views": {"$sum": 1}}}
    ]
    product_views_today = {r["_id"]: r["views"] async for r in db.product_views.aggregate(top_cat_pipeline)}
    
    category_views = {}
    for pid, views in product_views_today.items():
        product = await db.products.find_one({"id": pid}, {"category": 1, "_id": 0})
        if product:
            cat = product.get("category", "Sonstige")
            category_views[cat] = category_views.get(cat, 0) + views
    
    top_category = max(category_views, key=category_views.get) if category_views else "Keine Daten"
    
    # Calculate changes
    day_change = ((views_today - views_yesterday) / max(views_yesterday, 1)) * 100
    week_change = ((views_this_week - views_last_week) / max(views_last_week, 1)) * 100
    
    return {
        "views_today": views_today,
        "views_yesterday": views_yesterday,
        "day_change_percent": round(day_change, 1),
        "views_this_week": views_this_week,
        "views_last_week": views_last_week,
        "week_change_percent": round(week_change, 1),
        "total_views": total_views,
        "unique_products_viewed_today": unique_today,
        "top_category_today": top_category,
        "timestamp": now.isoformat()
    }


# ==================== CLEANUP ====================

@router.delete("/cleanup-old-data")
async def cleanup_old_analytics_data(days: int = 90):
    """Delete analytics data older than specified days."""
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).strftime("%Y-%m-%d")
    
    views_deleted = await db.product_views.delete_many({"date": {"$lt": cutoff}})
    interactions_deleted = await db.product_interactions.delete_many({"date": {"$lt": cutoff}})
    
    return {
        "success": True,
        "views_deleted": views_deleted.deleted_count,
        "interactions_deleted": interactions_deleted.deleted_count
    }
