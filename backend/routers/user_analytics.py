"""
User Analytics System - Benutzer-Analyse
Trackt Benutzeraktivität, Retention, und Verhalten
"""

from fastapi import APIRouter, HTTPException
from datetime import datetime, timezone, timedelta
from typing import Optional
import logging

from config import db

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/analytics/users", tags=["User Analytics"])


@router.get("/overview")
async def get_user_analytics_overview():
    """Get overall user analytics overview."""
    
    now = datetime.now(timezone.utc)
    today = now.strftime("%Y-%m-%d")
    yesterday = (now - timedelta(days=1)).strftime("%Y-%m-%d")
    week_ago = (now - timedelta(days=7)).strftime("%Y-%m-%d")
    month_ago = (now - timedelta(days=30)).strftime("%Y-%m-%d")
    
    # Total users
    total_users = await db.users.count_documents({})
    
    # New users today
    new_today = await db.users.count_documents({
        "created_at": {"$regex": f"^{today}"}
    })
    new_yesterday = await db.users.count_documents({
        "created_at": {"$regex": f"^{yesterday}"}
    })
    
    # New users this week
    new_this_week = await db.users.count_documents({
        "created_at": {"$gte": f"{week_ago}T00:00:00"}
    })
    
    # New users this month
    new_this_month = await db.users.count_documents({
        "created_at": {"$gte": f"{month_ago}T00:00:00"}
    })
    
    # Active users (users who placed bids)
    active_today_pipeline = [
        {"$match": {"created_at": {"$regex": f"^{today}"}}},
        {"$group": {"_id": "$user_id"}}
    ]
    active_today = len(await db.bids.aggregate(active_today_pipeline).to_list(10000))
    
    active_week_pipeline = [
        {"$match": {"created_at": {"$gte": f"{week_ago}T00:00:00"}}},
        {"$group": {"_id": "$user_id"}}
    ]
    active_this_week = len(await db.bids.aggregate(active_week_pipeline).to_list(10000))
    
    # Users with bids balance > 0
    users_with_bids = await db.users.count_documents({"bids_balance": {"$gt": 0}})
    
    # Premium/VIP users
    vip_users = await db.users.count_documents({"vip_status": True})
    
    # Calculate changes
    day_change = ((new_today - new_yesterday) / max(new_yesterday, 1)) * 100
    
    return {
        "total_users": total_users,
        "new_users_today": new_today,
        "new_users_yesterday": new_yesterday,
        "day_change_percent": round(day_change, 1),
        "new_users_this_week": new_this_week,
        "new_users_this_month": new_this_month,
        "active_users_today": active_today,
        "active_users_this_week": active_this_week,
        "users_with_bids": users_with_bids,
        "vip_users": vip_users,
        "timestamp": now.isoformat()
    }


@router.get("/registrations")
async def get_registration_stats(period: str = "month"):
    """Get user registration statistics over time."""
    
    now = datetime.now(timezone.utc)
    
    if period == "week":
        days = 7
    elif period == "month":
        days = 30
    else:
        days = 90
    
    # Get registrations per day
    daily_stats = []
    for i in range(days):
        date = (now - timedelta(days=i)).strftime("%Y-%m-%d")
        count = await db.users.count_documents({
            "created_at": {"$regex": f"^{date}"}
        })
        daily_stats.append({"date": date, "registrations": count})
    
    daily_stats.reverse()
    
    # Calculate average
    total = sum(d["registrations"] for d in daily_stats)
    avg = total / days if days > 0 else 0
    
    return {
        "period": period,
        "daily_registrations": daily_stats,
        "total_registrations": total,
        "daily_average": round(avg, 1)
    }


@router.get("/activity")
async def get_user_activity_stats(period: str = "week"):
    """Get user activity statistics (bids, logins, etc.)."""
    
    now = datetime.now(timezone.utc)
    
    if period == "today":
        start_date = now.strftime("%Y-%m-%d")
    elif period == "week":
        start_date = (now - timedelta(days=7)).strftime("%Y-%m-%d")
    else:
        start_date = (now - timedelta(days=30)).strftime("%Y-%m-%d")
    
    # Bids per user
    bids_pipeline = [
        {"$match": {"created_at": {"$gte": f"{start_date}T00:00:00"}}},
        {"$group": {
            "_id": "$user_id",
            "bid_count": {"$sum": 1}
        }},
        {"$sort": {"bid_count": -1}},
        {"$limit": 20}
    ]
    top_bidders = await db.bids.aggregate(bids_pipeline).to_list(20)
    
    # Enrich with user names
    for bidder in top_bidders:
        user = await db.users.find_one(
            {"id": bidder["_id"]},
            {"_id": 0, "name": 1, "email": 1, "avatar": 1}
        )
        if user:
            bidder["user_name"] = user.get("name", "Unbekannt")
            bidder["email"] = user.get("email", "")
            bidder["avatar"] = user.get("avatar")
    
    # Total bids in period
    total_bids = await db.bids.count_documents({
        "created_at": {"$gte": f"{start_date}T00:00:00"}
    })
    
    # Unique active users
    unique_users_pipeline = [
        {"$match": {"created_at": {"$gte": f"{start_date}T00:00:00"}}},
        {"$group": {"_id": "$user_id"}}
    ]
    unique_active = len(await db.bids.aggregate(unique_users_pipeline).to_list(100000))
    
    return {
        "period": period,
        "total_bids": total_bids,
        "unique_active_users": unique_active,
        "avg_bids_per_user": round(total_bids / max(unique_active, 1), 1),
        "top_bidders": top_bidders
    }


@router.get("/retention")
async def get_user_retention_stats():
    """Calculate user retention rates."""
    
    now = datetime.now(timezone.utc)
    
    # Users registered in the last 30 days who are still active
    retention_data = []
    
    for days_ago in [7, 14, 30, 60, 90]:
        cohort_start = (now - timedelta(days=days_ago + 7)).strftime("%Y-%m-%d")
        cohort_end = (now - timedelta(days=days_ago)).strftime("%Y-%m-%d")
        
        # Users registered in this cohort
        cohort_users = await db.users.find({
            "created_at": {"$gte": f"{cohort_start}T00:00:00", "$lt": f"{cohort_end}T00:00:00"}
        }, {"id": 1, "_id": 0}).to_list(10000)
        
        cohort_user_ids = [u["id"] for u in cohort_users]
        cohort_size = len(cohort_user_ids)
        
        if cohort_size == 0:
            continue
        
        # Check who is still active (placed bid in last 7 days)
        recent_start = (now - timedelta(days=7)).strftime("%Y-%m-%d")
        active_pipeline = [
            {"$match": {
                "user_id": {"$in": cohort_user_ids},
                "created_at": {"$gte": f"{recent_start}T00:00:00"}
            }},
            {"$group": {"_id": "$user_id"}}
        ]
        active_users = len(await db.bids.aggregate(active_pipeline).to_list(10000))
        
        retention_rate = (active_users / cohort_size) * 100
        
        retention_data.append({
            "cohort": f"Vor {days_ago}-{days_ago+7} Tagen",
            "cohort_size": cohort_size,
            "still_active": active_users,
            "retention_rate": round(retention_rate, 1)
        })
    
    return {
        "retention_cohorts": retention_data,
        "calculated_at": now.isoformat()
    }


@router.get("/segments")
async def get_user_segments():
    """Get user segmentation data."""
    
    now = datetime.now(timezone.utc)
    week_ago = (now - timedelta(days=7)).strftime("%Y-%m-%d")
    month_ago = (now - timedelta(days=30)).strftime("%Y-%m-%d")
    
    # Segment by bid balance
    segments = {
        "no_bids": await db.users.count_documents({"bids_balance": {"$lte": 0}}),
        "low_bids": await db.users.count_documents({"bids_balance": {"$gt": 0, "$lte": 50}}),
        "medium_bids": await db.users.count_documents({"bids_balance": {"$gt": 50, "$lte": 200}}),
        "high_bids": await db.users.count_documents({"bids_balance": {"$gt": 200}})
    }
    
    # Segment by activity
    # Get all users who bid in last week
    active_week_pipeline = [
        {"$match": {"created_at": {"$gte": f"{week_ago}T00:00:00"}}},
        {"$group": {"_id": "$user_id"}}
    ]
    active_week_result = await db.bids.aggregate(active_week_pipeline).to_list(100000)
    active_week_ids = set(u["_id"] for u in active_week_result)
    
    # Get all users who bid in last month (but not last week)
    active_month_pipeline = [
        {"$match": {
            "created_at": {"$gte": f"{month_ago}T00:00:00", "$lt": f"{week_ago}T00:00:00"}
        }},
        {"$group": {"_id": "$user_id"}}
    ]
    active_month_result = await db.bids.aggregate(active_month_pipeline).to_list(100000)
    active_month_ids = set(u["_id"] for u in active_month_result)
    
    activity_segments = {
        "active_this_week": len(active_week_ids),
        "active_this_month": len(active_month_ids - active_week_ids),
        "inactive": await db.users.count_documents({}) - len(active_week_ids) - len(active_month_ids - active_week_ids)
    }
    
    # VIP vs Regular
    vip_segments = {
        "vip_users": await db.users.count_documents({"vip_status": True}),
        "regular_users": await db.users.count_documents({"$or": [{"vip_status": False}, {"vip_status": {"$exists": False}}]})
    }
    
    return {
        "by_bid_balance": segments,
        "by_activity": activity_segments,
        "by_vip_status": vip_segments,
        "timestamp": now.isoformat()
    }


@router.get("/top-winners")
async def get_top_winners(limit: int = 10):
    """Get users who won the most auctions."""
    
    pipeline = [
        {"$match": {"status": "ended", "winner_id": {"$ne": None}}},
        {"$group": {
            "_id": "$winner_id",
            "wins": {"$sum": 1},
            "total_value": {"$sum": "$current_price"}
        }},
        {"$sort": {"wins": -1}},
        {"$limit": limit}
    ]
    
    winners = await db.auctions.aggregate(pipeline).to_list(limit)
    
    # Enrich with user details
    for winner in winners:
        user = await db.users.find_one(
            {"id": winner["_id"]},
            {"_id": 0, "name": 1, "email": 1, "avatar": 1}
        )
        if user:
            winner["user_name"] = user.get("name", "Unbekannt")
            winner["avatar"] = user.get("avatar")
    
    return {
        "top_winners": winners,
        "total_winners_count": len(winners)
    }


@router.get("/geographic")
async def get_geographic_distribution():
    """Get user distribution by country/language preference."""
    
    # By language preference
    language_pipeline = [
        {"$group": {
            "_id": "$language",
            "count": {"$sum": 1}
        }},
        {"$sort": {"count": -1}}
    ]
    
    languages = await db.users.aggregate(language_pipeline).to_list(50)
    
    # Map language codes to names
    lang_names = {
        "de": "Deutsch", "en": "English", "tr": "Türkçe", "sq": "Shqip",
        "ar": "العربية", "fr": "Français", "es": "Español", "it": "Italiano",
        "nl": "Nederlands", "pl": "Polski", "ru": "Русский", "uk": "Українська",
        "sr": "Српски", "hr": "Hrvatski", "bs": "Bosanski", "mk": "Македонски",
        "el": "Ελληνικά", "ro": "Română"
    }
    
    language_stats = []
    for lang in languages:
        code = lang["_id"] or "de"
        language_stats.append({
            "code": code,
            "name": lang_names.get(code, code),
            "users": lang["count"]
        })
    
    return {
        "by_language": language_stats,
        "total_languages": len(language_stats)
    }
