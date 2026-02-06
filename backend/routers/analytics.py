"""
Analytics & Insights Router
Real-time user behavior tracking, conversion funnels, and business metrics
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from datetime import datetime, timezone, timedelta
from typing import Optional, List
from pydantic import BaseModel
import uuid

from config import db, logger
from dependencies import get_current_user

router = APIRouter(prefix="/analytics", tags=["Analytics"])


# ==================== TRACKING EVENTS ====================

class TrackEvent(BaseModel):
    event_type: str  # page_view, click, auction_view, bid, purchase, etc.
    page: Optional[str] = None
    element: Optional[str] = None
    auction_id: Optional[str] = None
    product_id: Optional[str] = None
    value: Optional[float] = None
    metadata: Optional[dict] = None


@router.post("/track")
async def track_event(
    event: TrackEvent,
    user: dict = Depends(get_current_user)
):
    """Track user behavior event"""
    user_id = user.get("id") if user else None
    
    event_doc = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "event_type": event.event_type,
        "page": event.page,
        "element": event.element,
        "auction_id": event.auction_id,
        "product_id": event.product_id,
        "value": event.value,
        "metadata": event.metadata or {},
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "session_id": event.metadata.get("session_id") if event.metadata else None
    }
    
    await db.analytics_events.insert_one(event_doc)
    return {"success": True}


@router.post("/track-anonymous")
async def track_anonymous_event(event: TrackEvent):
    """Track anonymous user event (no auth required)"""
    event_doc = {
        "id": str(uuid.uuid4()),
        "user_id": None,
        "event_type": event.event_type,
        "page": event.page,
        "element": event.element,
        "auction_id": event.auction_id,
        "product_id": event.product_id,
        "value": event.value,
        "metadata": event.metadata or {},
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "session_id": event.metadata.get("session_id") if event.metadata else None
    }
    
    await db.analytics_events.insert_one(event_doc)
    return {"success": True}


# ==================== DASHBOARD METRICS ====================

@router.get("/dashboard")
async def get_analytics_dashboard(
    days: int = 7,
    user: dict = Depends(get_current_user)
):
    """Get comprehensive analytics dashboard (Admin only)"""
    if user.get("role") not in ["admin", "manager"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    now = datetime.now(timezone.utc)
    start_date = now - timedelta(days=days)
    start_iso = start_date.isoformat()
    
    # User metrics
    total_users = await db.users.count_documents({})
    new_users = await db.users.count_documents({
        "created_at": {"$gte": start_iso}
    })
    active_users = await db.analytics_events.distinct(
        "user_id",
        {"timestamp": {"$gte": start_iso}, "user_id": {"$ne": None}}
    )
    
    # Revenue metrics
    revenue_pipeline = [
        {"$match": {"created_at": {"$gte": start_iso}, "status": "completed"}},
        {"$group": {
            "_id": None,
            "total": {"$sum": "$amount"},
            "count": {"$sum": 1}
        }}
    ]
    revenue_result = await db.payments.aggregate(revenue_pipeline).to_list(length=1)
    total_revenue = revenue_result[0]["total"] if revenue_result else 0
    total_orders = revenue_result[0]["count"] if revenue_result else 0
    
    # Auction metrics
    auctions_created = await db.auctions.count_documents({
        "created_at": {"$gte": start_iso}
    })
    auctions_completed = await db.auctions.count_documents({
        "ended_at": {"$gte": start_iso},
        "status": "ended"
    })
    total_bids = await db.bids.count_documents({
        "created_at": {"$gte": start_iso}
    })
    
    # Conversion funnel
    page_views = await db.analytics_events.count_documents({
        "event_type": "page_view",
        "timestamp": {"$gte": start_iso}
    })
    registrations = new_users
    first_bids = await db.analytics_events.count_documents({
        "event_type": "first_bid",
        "timestamp": {"$gte": start_iso}
    })
    purchases = total_orders
    
    # Daily breakdown
    daily_pipeline = [
        {"$match": {"created_at": {"$gte": start_iso}, "status": "completed"}},
        {"$group": {
            "_id": {"$substr": ["$created_at", 0, 10]},
            "revenue": {"$sum": "$amount"},
            "orders": {"$sum": 1}
        }},
        {"$sort": {"_id": 1}}
    ]
    daily_revenue = await db.payments.aggregate(daily_pipeline).to_list(length=days)
    
    # Top pages
    top_pages_pipeline = [
        {"$match": {"event_type": "page_view", "timestamp": {"$gte": start_iso}}},
        {"$group": {"_id": "$page", "views": {"$sum": 1}}},
        {"$sort": {"views": -1}},
        {"$limit": 10}
    ]
    top_pages = await db.analytics_events.aggregate(top_pages_pipeline).to_list(length=10)
    
    # Bounce rate (simplified)
    single_page_sessions = await db.analytics_events.aggregate([
        {"$match": {"event_type": "page_view", "timestamp": {"$gte": start_iso}}},
        {"$group": {"_id": "$session_id", "pages": {"$sum": 1}}},
        {"$match": {"pages": 1}},
        {"$count": "bounced"}
    ]).to_list(length=1)
    
    total_sessions = await db.analytics_events.distinct(
        "session_id",
        {"timestamp": {"$gte": start_iso}, "session_id": {"$ne": None}}
    )
    
    bounce_rate = 0
    if total_sessions:
        bounced = single_page_sessions[0]["bounced"] if single_page_sessions else 0
        bounce_rate = round(bounced / len(total_sessions) * 100, 1)
    
    return {
        "period": {"days": days, "start": start_iso, "end": now.isoformat()},
        "users": {
            "total": total_users,
            "new": new_users,
            "active": len(active_users),
            "growth_rate": round(new_users / max(1, total_users - new_users) * 100, 1)
        },
        "revenue": {
            "total": round(total_revenue, 2),
            "orders": total_orders,
            "avg_order_value": round(total_revenue / max(1, total_orders), 2),
            "daily": [{"date": d["_id"], "revenue": d["revenue"], "orders": d["orders"]} for d in daily_revenue]
        },
        "auctions": {
            "created": auctions_created,
            "completed": auctions_completed,
            "total_bids": total_bids,
            "avg_bids_per_auction": round(total_bids / max(1, auctions_completed), 1)
        },
        "funnel": {
            "page_views": page_views,
            "registrations": registrations,
            "first_bids": first_bids,
            "purchases": purchases,
            "conversion_rate": round(purchases / max(1, page_views) * 100, 2)
        },
        "engagement": {
            "bounce_rate": bounce_rate,
            "sessions": len(total_sessions),
            "top_pages": [{"page": p["_id"], "views": p["views"]} for p in top_pages]
        }
    }


@router.get("/realtime")
async def get_realtime_metrics(user: dict = Depends(get_current_user)):
    """Get real-time metrics (last 5 minutes)"""
    if user.get("role") not in ["admin", "manager"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    now = datetime.now(timezone.utc)
    five_min_ago = (now - timedelta(minutes=5)).isoformat()
    
    # Active users
    active_users = await db.analytics_events.distinct(
        "user_id",
        {"timestamp": {"$gte": five_min_ago}, "user_id": {"$ne": None}}
    )
    
    # Recent events
    recent_events = await db.analytics_events.find(
        {"timestamp": {"$gte": five_min_ago}},
        {"_id": 0}
    ).sort("timestamp", -1).limit(20).to_list(length=20)
    
    # Live auctions
    live_auctions = await db.auctions.count_documents({"status": "active"})
    
    # Recent bids
    recent_bids = await db.bids.count_documents({
        "created_at": {"$gte": five_min_ago}
    })
    
    return {
        "timestamp": now.isoformat(),
        "active_users": len(active_users),
        "live_auctions": live_auctions,
        "recent_bids": recent_bids,
        "recent_events": recent_events
    }


# ==================== USER BEHAVIOR ====================

@router.get("/user/{user_id}/behavior")
async def get_user_behavior(
    user_id: str,
    days: int = 30,
    admin: dict = Depends(get_current_user)
):
    """Get detailed user behavior analysis (Admin only)"""
    if admin.get("role") not in ["admin", "manager"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    start_date = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    
    # User info
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Event history
    events = await db.analytics_events.find(
        {"user_id": user_id, "timestamp": {"$gte": start_date}},
        {"_id": 0}
    ).sort("timestamp", -1).limit(100).to_list(length=100)
    
    # Purchase history
    purchases = await db.payments.find(
        {"user_id": user_id},
        {"_id": 0}
    ).sort("created_at", -1).limit(20).to_list(length=20)
    
    # Bidding patterns
    bids = await db.bids.find(
        {"user_id": user_id, "created_at": {"$gte": start_date}},
        {"_id": 0}
    ).to_list(length=500)
    
    # Analyze bidding times
    bid_hours = {}
    for bid in bids:
        try:
            hour = datetime.fromisoformat(bid["created_at"].replace("Z", "+00:00")).hour
            bid_hours[hour] = bid_hours.get(hour, 0) + 1
        except:
            continue
    
    # Won auctions
    wins = await db.won_auctions.find(
        {"user_id": user_id},
        {"_id": 0}
    ).to_list(length=50)
    
    # Calculate metrics
    total_spent = sum(p.get("amount", 0) for p in purchases)
    total_bids = len(bids)
    total_wins = len(wins)
    
    return {
        "user": user,
        "metrics": {
            "total_spent": round(total_spent, 2),
            "total_bids": total_bids,
            "total_wins": total_wins,
            "win_rate": round(total_wins / max(1, total_bids) * 100, 1),
            "avg_purchase": round(total_spent / max(1, len(purchases)), 2),
            "favorite_bid_hours": sorted(bid_hours.items(), key=lambda x: x[1], reverse=True)[:3]
        },
        "recent_events": events[:20],
        "purchases": purchases,
        "bidding_pattern": bid_hours
    }


# ==================== CONVERSION TRACKING ====================

@router.get("/conversions")
async def get_conversion_metrics(
    days: int = 7,
    user: dict = Depends(get_current_user)
):
    """Get detailed conversion metrics"""
    if user.get("role") not in ["admin", "manager"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    start_date = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    
    # Funnel stages
    stages = {
        "visitors": await db.analytics_events.distinct(
            "session_id",
            {"event_type": "page_view", "timestamp": {"$gte": start_date}}
        ),
        "registered": await db.users.count_documents({
            "created_at": {"$gte": start_date}
        }),
        "first_deposit": await db.payments.count_documents({
            "created_at": {"$gte": start_date},
            "metadata.is_first_purchase": True
        }),
        "first_bid": await db.analytics_events.count_documents({
            "event_type": "first_bid",
            "timestamp": {"$gte": start_date}
        }),
        "first_win": await db.analytics_events.count_documents({
            "event_type": "first_win",
            "timestamp": {"$gte": start_date}
        })
    }
    
    visitors_count = len(stages["visitors"]) if isinstance(stages["visitors"], list) else stages["visitors"]
    
    funnel = [
        {"stage": "Besucher", "count": visitors_count, "rate": 100},
        {"stage": "Registriert", "count": stages["registered"], 
         "rate": round(stages["registered"] / max(1, visitors_count) * 100, 1)},
        {"stage": "Erster Kauf", "count": stages["first_deposit"],
         "rate": round(stages["first_deposit"] / max(1, stages["registered"]) * 100, 1)},
        {"stage": "Erstes Gebot", "count": stages["first_bid"],
         "rate": round(stages["first_bid"] / max(1, stages["first_deposit"]) * 100, 1)},
        {"stage": "Erster Gewinn", "count": stages["first_win"],
         "rate": round(stages["first_win"] / max(1, stages["first_bid"]) * 100, 1)}
    ]
    
    return {
        "period_days": days,
        "funnel": funnel,
        "overall_conversion": round(stages["first_deposit"] / max(1, visitors_count) * 100, 2)
    }


# ==================== HEATMAP DATA ====================

@router.get("/heatmap/{page}")
async def get_heatmap_data(
    page: str,
    days: int = 7,
    user: dict = Depends(get_current_user)
):
    """Get click heatmap data for a page"""
    if user.get("role") not in ["admin", "manager"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    start_date = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    
    clicks = await db.analytics_events.find(
        {
            "event_type": "click",
            "page": page,
            "timestamp": {"$gte": start_date},
            "metadata.x": {"$exists": True},
            "metadata.y": {"$exists": True}
        },
        {"_id": 0, "metadata.x": 1, "metadata.y": 1, "element": 1}
    ).to_list(length=10000)
    
    # Aggregate by element
    element_clicks = {}
    for click in clicks:
        element = click.get("element", "unknown")
        element_clicks[element] = element_clicks.get(element, 0) + 1
    
    return {
        "page": page,
        "total_clicks": len(clicks),
        "click_points": [{"x": c["metadata"]["x"], "y": c["metadata"]["y"]} for c in clicks if "metadata" in c],
        "top_elements": sorted(element_clicks.items(), key=lambda x: x[1], reverse=True)[:20]
    }
