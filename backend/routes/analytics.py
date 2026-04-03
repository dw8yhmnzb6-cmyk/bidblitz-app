"""
BidBlitz V2 - Growth Analytics
Referral tracking, conversion funnel, retention metrics, campaign performance.
"""

from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException, Request, Query
from core.database import db
from core.security import get_current_user

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


async def require_admin(request: Request):
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


@router.get("/growth/overview")
async def growth_overview(request: Request):
    await require_admin(request)

    now = datetime.now(timezone.utc)
    today = now.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    week_ago = (now - timedelta(days=7)).isoformat()
    month_ago = (now - timedelta(days=30)).isoformat()

    # User growth
    total_users = await db.users.count_documents({})
    new_users_week = await db.users.count_documents({"created_at": {"$gte": week_ago}})
    new_users_month = await db.users.count_documents({"created_at": {"$gte": month_ago}})

    # Merchant growth
    total_merchants = await db.merchants.count_documents({})
    new_merchants_week = await db.merchants.count_documents({"created_at": {"$gte": week_ago}})

    # Referral stats
    total_referrals = await db.referrals.count_documents({})
    successful_referrals = await db.referrals.count_documents({"reward_given": True})

    # Active promotions
    active_promos = await db.promotions.count_documents({
        "active": True, "starts_at": {"$lte": now.isoformat()}, "expires_at": {"$gte": now.isoformat()},
    })

    return {
        "users": {
            "total": total_users,
            "new_this_week": new_users_week,
            "new_this_month": new_users_month,
        },
        "merchants": {
            "total": total_merchants,
            "new_this_week": new_merchants_week,
        },
        "referrals": {
            "total": total_referrals,
            "rewarded": successful_referrals,
            "conversion_rate": round(successful_referrals / max(total_referrals, 1) * 100, 1),
        },
        "promotions": {
            "active": active_promos,
        },
    }


@router.get("/growth/funnel")
async def conversion_funnel(request: Request):
    """Signup → Top-up → Payment conversion funnel."""
    await require_admin(request)

    total_users = await db.users.count_documents({})

    # Users who topped up
    topup_users_pipeline = [
        {"$match": {"type": "topup", "status": "completed"}},
        {"$group": {"_id": "$user_id"}},
        {"$count": "total"},
    ]
    topup_result = await db.transactions.aggregate(topup_users_pipeline).to_list(1)
    users_topped_up = topup_result[0]["total"] if topup_result else 0

    # Users who made a payment
    payment_users_pipeline = [
        {"$match": {"type": {"$in": ["payment", "send"]}, "status": "completed"}},
        {"$group": {"_id": "$user_id"}},
        {"$count": "total"},
    ]
    payment_result = await db.transactions.aggregate(payment_users_pipeline).to_list(1)
    users_paid = payment_result[0]["total"] if payment_result else 0

    # Users who referred someone
    referrer_pipeline = [
        {"$group": {"_id": "$referrer_id"}},
        {"$count": "total"},
    ]
    ref_result = await db.referrals.aggregate(referrer_pipeline).to_list(1)
    users_referred = ref_result[0]["total"] if ref_result else 0

    return {
        "funnel": [
            {"stage": "signup", "count": total_users, "rate": 100},
            {"stage": "topup", "count": users_topped_up, "rate": round(users_topped_up / max(total_users, 1) * 100, 1)},
            {"stage": "payment", "count": users_paid, "rate": round(users_paid / max(total_users, 1) * 100, 1)},
            {"stage": "referral", "count": users_referred, "rate": round(users_referred / max(total_users, 1) * 100, 1)},
        ]
    }


@router.get("/growth/retention")
async def retention_metrics(request: Request):
    """User retention by cohort (simplified)."""
    await require_admin(request)

    now = datetime.now(timezone.utc)

    # Active users (transaction in last 7 days)
    week_ago = (now - timedelta(days=7)).isoformat()
    active_pipeline = [
        {"$match": {"created_at": {"$gte": week_ago}}},
        {"$group": {"_id": "$user_id"}},
        {"$count": "total"},
    ]
    active_result = await db.transactions.aggregate(active_pipeline).to_list(1)
    active_week = active_result[0]["total"] if active_result else 0

    # Active users (transaction in last 30 days)
    month_ago = (now - timedelta(days=30)).isoformat()
    monthly_pipeline = [
        {"$match": {"created_at": {"$gte": month_ago}}},
        {"$group": {"_id": "$user_id"}},
        {"$count": "total"},
    ]
    monthly_result = await db.transactions.aggregate(monthly_pipeline).to_list(1)
    active_month = monthly_result[0]["total"] if monthly_result else 0

    total_users = await db.users.count_documents({})

    return {
        "total_users": total_users,
        "active_7d": active_week,
        "active_30d": active_month,
        "retention_7d": round(active_week / max(total_users, 1) * 100, 1),
        "retention_30d": round(active_month / max(total_users, 1) * 100, 1),
    }


@router.get("/growth/campaigns")
async def campaign_performance(request: Request):
    """Performance of active and past promotions."""
    await require_admin(request)

    promos = await db.promotions.find({}, {"_id": 0}).sort("created_at", -1).to_list(50)

    results = []
    for p in promos:
        usage_count = await db.promo_usage.count_documents({"promo_name": p["name"]})
        results.append({
            "name": p["name"],
            "type": p["type"],
            "value": p["value"],
            "active": p.get("active", False),
            "total_uses": usage_count,
            "max_uses": p.get("max_uses", 0),
            "starts_at": p.get("starts_at"),
            "expires_at": p.get("expires_at"),
        })

    return {"campaigns": results}
