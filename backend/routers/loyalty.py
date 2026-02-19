"""
VIP/Loyalty Program - Treueprogramm mit Stufen und Vorteilen
Features: Bronze/Silber/Gold/Platin Stufen, Punkte-System, exklusive Vorteile
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from datetime import datetime, timezone, timedelta
from typing import Optional, List
from pydantic import BaseModel
import uuid

from config import db, logger
from dependencies import get_current_user

router = APIRouter(prefix="/vip-loyalty", tags=["VIP Loyalty Program"])


# ==================== VIP TIERS ====================

VIP_TIERS = {
    "bronze": {
        "name": "Bronze",
        "min_points": 0,
        "color": "#CD7F32",
        "benefits": {
            "cashback_bonus": 0,
            "bid_discount": 0,
            "free_bids_monthly": 0,
            "priority_support": False,
            "exclusive_auctions": False,
            "early_access": False
        },
        "next_tier": "silver",
        "points_to_next": 1000
    },
    "silver": {
        "name": "Silber",
        "min_points": 1000,
        "color": "#C0C0C0",
        "benefits": {
            "cashback_bonus": 1,
            "bid_discount": 5,
            "free_bids_monthly": 10,
            "priority_support": False,
            "exclusive_auctions": False,
            "early_access": False
        },
        "next_tier": "gold",
        "points_to_next": 5000
    },
    "gold": {
        "name": "Gold",
        "min_points": 5000,
        "color": "#FFD700",
        "benefits": {
            "cashback_bonus": 2,
            "bid_discount": 10,
            "free_bids_monthly": 25,
            "priority_support": True,
            "exclusive_auctions": True,
            "early_access": False
        },
        "next_tier": "platinum",
        "points_to_next": 15000
    },
    "platinum": {
        "name": "Platin",
        "min_points": 15000,
        "color": "#E5E4E2",
        "benefits": {
            "cashback_bonus": 3,
            "bid_discount": 15,
            "free_bids_monthly": 50,
            "priority_support": True,
            "exclusive_auctions": True,
            "early_access": True
        },
        "next_tier": None,
        "points_to_next": None
    }
}

POINTS_CONFIG = {
    "bid_placed": 1,
    "auction_won": 100,
    "bid_purchase": 2,
    "deposit": 1,
    "referral_signup": 200,
    "daily_login": 5,
    "profile_complete": 50,
    "review_written": 25
}


def get_tier_for_points(points: int) -> str:
    if points >= 15000:
        return "platinum"
    elif points >= 5000:
        return "gold"
    elif points >= 1000:
        return "silver"
    return "bronze"


async def add_loyalty_points(user_id: str, points: int, reason: str, reference_id: str = None):
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "loyalty_points": 1, "loyalty_tier": 1})
    current_points = user.get("loyalty_points", 0) if user else 0
    new_points = current_points + points
    new_tier = get_tier_for_points(new_points)
    old_tier = user.get("loyalty_tier", "bronze") if user else "bronze"
    
    await db.users.update_one(
        {"id": user_id},
        {"$set": {"loyalty_points": new_points, "loyalty_tier": new_tier, "loyalty_updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    await db.loyalty_transactions.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "points": points,
        "reason": reason,
        "reference_id": reference_id,
        "balance_after": new_points,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    tier_upgraded = new_tier != old_tier and VIP_TIERS[new_tier]["min_points"] > VIP_TIERS[old_tier]["min_points"]
    
    if tier_upgraded:
        await db.notifications.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "type": "tier_upgrade",
            "title": f"Aufstieg zu {VIP_TIERS[new_tier]['name']}!",
            "message": f"Herzlichen Glückwunsch! Du bist jetzt {VIP_TIERS[new_tier]['name']}-Mitglied.",
            "read": False,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
    
    return {"new_points": new_points, "new_tier": new_tier, "tier_upgraded": tier_upgraded}


@router.get("/status")
async def get_loyalty_status(user: dict = Depends(get_current_user)):
    points = user.get("loyalty_points", 0)
    tier_id = user.get("loyalty_tier", get_tier_for_points(points))
    tier = VIP_TIERS.get(tier_id, VIP_TIERS["bronze"])
    
    next_tier_id = tier.get("next_tier")
    progress = None
    
    if next_tier_id:
        next_tier = VIP_TIERS[next_tier_id]
        points_needed = next_tier["min_points"] - points
        progress = {
            "next_tier": next_tier_id,
            "next_tier_name": next_tier["name"],
            "points_needed": points_needed,
            "percentage": min(100, round((points - tier["min_points"]) / max(1, next_tier["min_points"] - tier["min_points"]) * 100, 1))
        }
    
    recent_activity = await db.loyalty_transactions.find(
        {"user_id": user["id"]}, {"_id": 0}
    ).sort("created_at", -1).limit(10).to_list(10)
    
    return {
        "points": points,
        "tier": {"id": tier_id, "name": tier["name"], "color": tier["color"], "benefits": tier["benefits"]},
        "progress": progress,
        "recent_activity": recent_activity,
        "member_since": user.get("created_at")
    }


@router.get("/tiers")
async def get_all_tiers():
    return {
        "tiers": [
            {"id": tid, "name": t["name"], "min_points": t["min_points"], "color": t["color"], "benefits": t["benefits"]}
            for tid, t in VIP_TIERS.items()
        ],
        "points_config": POINTS_CONFIG
    }


@router.post("/claim-daily")
async def claim_daily_bonus(user: dict = Depends(get_current_user)):
    user_id = user["id"]
    today = datetime.now(timezone.utc).date().isoformat()
    
    existing = await db.loyalty_transactions.find_one({
        "user_id": user_id, "reason": "daily_login", "created_at": {"$regex": f"^{today}"}
    })
    
    if existing:
        raise HTTPException(status_code=400, detail="Täglicher Bonus bereits abgeholt")
    
    points = POINTS_CONFIG["daily_login"]
    result = await add_loyalty_points(user_id, points, "daily_login")
    
    return {
        "success": True,
        "points_earned": points,
        "new_total": result["new_points"],
        "tier": result["new_tier"],
        "tier_upgraded": result["tier_upgraded"]
    }


@router.get("/leaderboard")
async def get_leaderboard(period: str = Query("month")):
    if period == "week":
        start_date = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    elif period == "month":
        start_date = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
    else:
        start_date = None
    
    if start_date:
        pipeline = [
            {"$match": {"created_at": {"$gte": start_date}}},
            {"$group": {"_id": "$user_id", "points": {"$sum": "$points"}}},
            {"$sort": {"points": -1}},
            {"$limit": 20}
        ]
        leaders = await db.loyalty_transactions.aggregate(pipeline).to_list(20)
        
        result = []
        for i, leader in enumerate(leaders):
            u = await db.users.find_one({"id": leader["_id"]}, {"_id": 0, "name": 1, "loyalty_tier": 1})
            if u:
                result.append({"rank": i+1, "name": u.get("name", "Anonym")[:20], "points": leader["points"], "tier": u.get("loyalty_tier", "bronze")})
        return {"period": period, "leaderboard": result}
    
    leaders = await db.users.find(
        {"loyalty_points": {"$gt": 0}}, {"_id": 0, "id": 1, "name": 1, "loyalty_points": 1, "loyalty_tier": 1}
    ).sort("loyalty_points", -1).limit(20).to_list(20)
    
    return {
        "period": period,
        "leaderboard": [{"rank": i+1, "name": l.get("name", "Anonym")[:20], "points": l.get("loyalty_points", 0), "tier": l.get("loyalty_tier", "bronze")} for i, l in enumerate(leaders)]
    }


loyalty_router = router
