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
        except (ValueError, KeyError, AttributeError):
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


# ==================== DEVICE & MOBILE ANALYTICS ====================

class DeviceTrackEvent(BaseModel):
    device_type: str  # mobile, tablet, desktop
    os: Optional[str] = None  # iOS, Android, Windows, macOS, Linux
    browser: Optional[str] = None  # Chrome, Safari, Firefox, Edge
    screen_width: Optional[int] = None
    screen_height: Optional[int] = None
    is_touch: Optional[bool] = None
    user_agent: Optional[str] = None


@router.post("/track-device")
async def track_device(
    device: DeviceTrackEvent,
    user: dict = Depends(get_current_user)
):
    """Track device/browser info for analytics"""
    user_id = user.get("id") if user else None
    
    device_doc = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "device_type": device.device_type,
        "os": device.os,
        "browser": device.browser,
        "screen_width": device.screen_width,
        "screen_height": device.screen_height,
        "is_touch": device.is_touch,
        "user_agent": device.user_agent,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    
    await db.device_analytics.insert_one(device_doc)
    return {"success": True}


@router.get("/devices")
async def get_device_analytics(
    days: int = 7,
    user: dict = Depends(get_current_user)
):
    """Get device/mobile analytics (Admin only)"""
    if user.get("role") not in ["admin", "manager"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    start_date = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    
    # Device type breakdown
    device_pipeline = [
        {"$match": {"timestamp": {"$gte": start_date}}},
        {"$group": {"_id": "$device_type", "count": {"$sum": 1}}}
    ]
    device_data = await db.analytics_events.aggregate(device_pipeline).to_list(10)
    
    return {
        "device_breakdown": [{"device": d["_id"], "count": d["count"]} for d in device_data],
        "period_days": days
    }


# ==================== EXTENDED ANALYTICS ====================

@router.get("/extended")
async def get_extended_analytics(
    period: str = Query("week", description="hour, day, week, month, year"),
    compare: bool = Query(False, description="Compare with previous period"),
    user: dict = Depends(get_current_user)
):
    """
    Extended Analytics mit granularen Zeiträumen und Vergleich
    
    Periods:
    - hour: Letzte Stunde (minütliche Daten)
    - day: Letzter Tag (stündliche Daten)
    - week: Letzte Woche (tägliche Daten)
    - month: Letzter Monat (tägliche Daten)
    - year: Letztes Jahr (monatliche Daten)
    """
    if user.get("role") not in ["admin", "manager"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    now = datetime.now(timezone.utc)
    
    # Define period ranges
    period_config = {
        "hour": {"delta": timedelta(hours=1), "group_format": 15, "label": "Letzte Stunde"},
        "day": {"delta": timedelta(days=1), "group_format": 13, "label": "Letzter Tag"},
        "week": {"delta": timedelta(days=7), "group_format": 10, "label": "Letzte 7 Tage"},
        "month": {"delta": timedelta(days=30), "group_format": 10, "label": "Letzte 30 Tage"},
        "year": {"delta": timedelta(days=365), "group_format": 7, "label": "Letztes Jahr"}
    }
    
    config = period_config.get(period, period_config["week"])
    start_date = now - config["delta"]
    prev_start = start_date - config["delta"]
    
    start_iso = start_date.isoformat()
    prev_iso = prev_start.isoformat()
    
    async def get_metrics_for_period(from_date: str, to_date: str):
        """Get metrics for a specific period"""
        
        # Revenue
        revenue_result = await db.payments.aggregate([
            {"$match": {"created_at": {"$gte": from_date, "$lt": to_date}, "status": "completed"}},
            {"$group": {"_id": None, "total": {"$sum": "$amount"}, "count": {"$sum": 1}}}
        ]).to_list(1)
        revenue = revenue_result[0]["total"] if revenue_result else 0
        orders = revenue_result[0]["count"] if revenue_result else 0
        
        # Users
        new_users = await db.users.count_documents({"created_at": {"$gte": from_date, "$lt": to_date}})
        
        # Bids
        total_bids = await db.bids.count_documents({"created_at": {"$gte": from_date, "$lt": to_date}})
        
        # Auctions
        auctions_completed = await db.auctions.count_documents({
            "ended_at": {"$gte": from_date, "$lt": to_date}, "status": "ended"
        })
        
        # Page views
        page_views = await db.analytics_events.count_documents({
            "event_type": "page_view", "timestamp": {"$gte": from_date, "$lt": to_date}
        })
        
        return {
            "revenue": round(revenue, 2),
            "orders": orders,
            "new_users": new_users,
            "bids": total_bids,
            "auctions": auctions_completed,
            "page_views": page_views
        }
    
    # Current period metrics
    current = await get_metrics_for_period(start_iso, now.isoformat())
    
    # Previous period for comparison
    previous = None
    changes = None
    if compare:
        previous = await get_metrics_for_period(prev_iso, start_iso)
        
        def calc_change(curr, prev):
            if prev == 0:
                return 100 if curr > 0 else 0
            return round((curr - prev) / prev * 100, 1)
        
        changes = {
            "revenue": calc_change(current["revenue"], previous["revenue"]),
            "orders": calc_change(current["orders"], previous["orders"]),
            "new_users": calc_change(current["new_users"], previous["new_users"]),
            "bids": calc_change(current["bids"], previous["bids"]),
            "auctions": calc_change(current["auctions"], previous["auctions"]),
            "page_views": calc_change(current["page_views"], previous["page_views"])
        }
    
    # Time series data
    group_len = config["group_format"]
    time_series_pipeline = [
        {"$match": {"created_at": {"$gte": start_iso}, "status": "completed"}},
        {"$group": {
            "_id": {"$substr": ["$created_at", 0, group_len]},
            "revenue": {"$sum": "$amount"},
            "orders": {"$sum": 1}
        }},
        {"$sort": {"_id": 1}}
    ]
    time_series = await db.payments.aggregate(time_series_pipeline).to_list(100)
    
    # Bids time series
    bids_pipeline = [
        {"$match": {"created_at": {"$gte": start_iso}}},
        {"$group": {
            "_id": {"$substr": ["$created_at", 0, group_len]},
            "count": {"$sum": 1}
        }},
        {"$sort": {"_id": 1}}
    ]
    bids_series = await db.bids.aggregate(bids_pipeline).to_list(100)
    
    # Users time series
    users_pipeline = [
        {"$match": {"created_at": {"$gte": start_iso}}},
        {"$group": {
            "_id": {"$substr": ["$created_at", 0, group_len]},
            "count": {"$sum": 1}
        }},
        {"$sort": {"_id": 1}}
    ]
    users_series = await db.users.aggregate(users_pipeline).to_list(100)
    
    # Combine series
    combined_series = {}
    for item in time_series:
        combined_series[item["_id"]] = {
            "date": item["_id"],
            "revenue": round(item["revenue"], 2),
            "orders": item["orders"],
            "bids": 0,
            "users": 0
        }
    
    for item in bids_series:
        if item["_id"] in combined_series:
            combined_series[item["_id"]]["bids"] = item["count"]
        else:
            combined_series[item["_id"]] = {
                "date": item["_id"],
                "revenue": 0,
                "orders": 0,
                "bids": item["count"],
                "users": 0
            }
    
    for item in users_series:
        if item["_id"] in combined_series:
            combined_series[item["_id"]]["users"] = item["count"]
        else:
            combined_series[item["_id"]] = {
                "date": item["_id"],
                "revenue": 0,
                "orders": 0,
                "bids": 0,
                "users": item["count"]
            }
    
    return {
        "period": {
            "type": period,
            "label": config["label"],
            "start": start_iso,
            "end": now.isoformat()
        },
        "current": current,
        "previous": previous,
        "changes": changes,
        "time_series": sorted(combined_series.values(), key=lambda x: x["date"])
    }


@router.get("/export")
async def export_analytics(
    format: str = Query("csv", description="csv or json"),
    period: str = Query("month", description="week, month, year"),
    user: dict = Depends(get_current_user)
):
    """Export analytics data as CSV or JSON"""
    if user.get("role") not in ["admin", "manager"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    from fastapi.responses import Response
    import csv
    import io
    
    now = datetime.now(timezone.utc)
    days = {"week": 7, "month": 30, "year": 365}.get(period, 30)
    start_date = (now - timedelta(days=days)).isoformat()
    
    # Get daily data
    pipeline = [
        {"$match": {"created_at": {"$gte": start_date}, "status": "completed"}},
        {"$group": {
            "_id": {"$substr": ["$created_at", 0, 10]},
            "revenue": {"$sum": "$amount"},
            "orders": {"$sum": 1}
        }},
        {"$sort": {"_id": 1}}
    ]
    daily_data = await db.payments.aggregate(pipeline).to_list(365)
    
    # Add users and bids
    for item in daily_data:
        date = item["_id"]
        next_date = (datetime.fromisoformat(date) + timedelta(days=1)).isoformat()[:10]
        
        item["new_users"] = await db.users.count_documents({
            "created_at": {"$gte": date, "$lt": next_date}
        })
        item["bids"] = await db.bids.count_documents({
            "created_at": {"$gte": date, "$lt": next_date}
        })
    
    if format == "csv":
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["Datum", "Umsatz", "Bestellungen", "Neue Nutzer", "Gebote"])
        for item in daily_data:
            writer.writerow([
                item["_id"],
                f"{item['revenue']:.2f}",
                item["orders"],
                item["new_users"],
                item["bids"]
            ])
        
        csv_content = output.getvalue()
        return Response(
            content=csv_content,
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename=analytics_{period}.csv"}
        )
    else:
        return {
            "period": period,
            "exported_at": now.isoformat(),
            "data": [{
                "date": d["_id"],
                "revenue": round(d["revenue"], 2),
                "orders": d["orders"],
                "new_users": d["new_users"],
                "bids": d["bids"]
            } for d in daily_data]
        }
    ]
    os_breakdown = await db.device_analytics.aggregate(os_pipeline).to_list(length=10)
    
    # Browser breakdown
    browser_pipeline = [
        {"$match": {"timestamp": {"$gte": start_date}, "browser": {"$ne": None}}},
        {"$group": {"_id": "$browser", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]
    browser_breakdown = await db.device_analytics.aggregate(browser_pipeline).to_list(length=10)
    
    # Screen size categories
    screen_pipeline = [
        {"$match": {"timestamp": {"$gte": start_date}, "screen_width": {"$ne": None}}},
        {"$project": {
            "category": {
                "$switch": {
                    "branches": [
                        {"case": {"$lt": ["$screen_width", 576]}, "then": "xs (<576px)"},
                        {"case": {"$lt": ["$screen_width", 768]}, "then": "sm (576-768px)"},
                        {"case": {"$lt": ["$screen_width", 992]}, "then": "md (768-992px)"},
                        {"case": {"$lt": ["$screen_width", 1200]}, "then": "lg (992-1200px)"},
                    ],
                    "default": "xl (>1200px)"
                }
            }
        }},
        {"$group": {"_id": "$category", "count": {"$sum": 1}}},
        {"$sort": {"_id": 1}}
    ]
    screen_breakdown = await db.device_analytics.aggregate(screen_pipeline).to_list(length=10)
    
    # Daily device trends
    daily_pipeline = [
        {"$match": {"timestamp": {"$gte": start_date}}},
        {"$group": {
            "_id": {
                "date": {"$substr": ["$timestamp", 0, 10]},
                "device": "$device_type"
            },
            "count": {"$sum": 1}
        }},
        {"$sort": {"_id.date": 1}}
    ]
    daily_data = await db.device_analytics.aggregate(daily_pipeline).to_list(length=100)
    
    # Process daily data into chart format
    daily_trends = {}
    for item in daily_data:
        date = item["_id"]["date"]
        device = item["_id"]["device"] or "unknown"
        if date not in daily_trends:
            daily_trends[date] = {"date": date, "mobile": 0, "tablet": 0, "desktop": 0}
        daily_trends[date][device] = item["count"]
    
    # Calculate totals and percentages
    total_sessions = sum(d["count"] for d in device_breakdown) if device_breakdown else 0
    mobile_sessions = next((d["count"] for d in device_breakdown if d["_id"] == "mobile"), 0)
    tablet_sessions = next((d["count"] for d in device_breakdown if d["_id"] == "tablet"), 0)
    desktop_sessions = next((d["count"] for d in device_breakdown if d["_id"] == "desktop"), 0)
    
    return {
        "period_days": days,
        "summary": {
            "total_sessions": total_sessions,
            "mobile": {
                "count": mobile_sessions,
                "percentage": round(mobile_sessions / max(1, total_sessions) * 100, 1)
            },
            "tablet": {
                "count": tablet_sessions,
                "percentage": round(tablet_sessions / max(1, total_sessions) * 100, 1)
            },
            "desktop": {
                "count": desktop_sessions,
                "percentage": round(desktop_sessions / max(1, total_sessions) * 100, 1)
            }
        },
        "device_breakdown": [{"device": d["_id"] or "unknown", "count": d["count"]} for d in device_breakdown],
        "os_breakdown": [{"os": o["_id"], "count": o["count"]} for o in os_breakdown],
        "browser_breakdown": [{"browser": b["_id"], "count": b["count"]} for b in browser_breakdown],
        "screen_breakdown": [{"category": s["_id"], "count": s["count"]} for s in screen_breakdown],
        "daily_trends": list(daily_trends.values())
    }


