"""
BidBlitz V2 - BlitzPoints Redemption System
Complete rewards store where users can redeem their coins for real benefits.
"""

import secrets
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, List
from fastapi import APIRouter, HTTPException, Request, Query
from pydantic import BaseModel, Field
from bson import ObjectId

from core.database import db
from core.security import get_current_user

router = APIRouter(prefix="/api/rewards-store", tags=["Rewards Store"])
logger = logging.getLogger("bidblitz.rewards_store")


# ══════════════════════════════════════════════════════════════════════════════
# REWARD TYPES
# ══════════════════════════════════════════════════════════════════════════════

REWARD_TYPES = {
    "discount": {
        "name": "Rabatt",
        "icon": "percent",
        "color": "#00E89D",
        "description": "€ Rabatt auf deine nächste Transaktion",
    },
    "boost": {
        "name": "Boost",
        "icon": "rocket",
        "color": "#A855F7",
        "description": "Kostenloser Marketplace-Boost",
    },
    "vip": {
        "name": "VIP Zugang",
        "icon": "crown",
        "color": "#FFD700",
        "description": "Temporärer VIP-Status",
    },
    "cashback": {
        "name": "Cashback",
        "icon": "wallet",
        "color": "#00C2FF",
        "description": "Direkte Gutschrift ins Wallet",
    },
}

# Daily redemption limits per type
DAILY_LIMITS = {
    "discount": 3,
    "boost": 2,
    "vip": 1,
    "cashback": 5,
}


# ══════════════════════════════════════════════════════════════════════════════
# DEFAULT REWARDS (Seeded on first access)
# ══════════════════════════════════════════════════════════════════════════════

DEFAULT_REWARDS = [
    # Discounts
    {"title": "2€ Rabatt", "description": "2€ Rabatt auf deine nächste Zahlung", "type": "discount", "cost_points": 200, "reward_value": 2.0},
    {"title": "5€ Rabatt", "description": "5€ Rabatt auf deine nächste Zahlung", "type": "discount", "cost_points": 500, "reward_value": 5.0},
    {"title": "10€ Rabatt", "description": "10€ Rabatt auf deine nächste Zahlung", "type": "discount", "cost_points": 900, "reward_value": 10.0},
    {"title": "20€ Rabatt", "description": "20€ Rabatt auf deine nächste Zahlung", "type": "discount", "cost_points": 1600, "reward_value": 20.0},
    
    # Boosts
    {"title": "24h Boost", "description": "Kostenloser 24-Stunden Marketplace-Boost", "type": "boost", "cost_points": 300, "reward_value": 24},
    {"title": "7-Tage Boost", "description": "Kostenloser 7-Tage Marketplace-Boost", "type": "boost", "cost_points": 800, "reward_value": 168},
    
    # VIP
    {"title": "VIP 3 Tage", "description": "3 Tage VIP-Status mit allen Vorteilen", "type": "vip", "cost_points": 600, "reward_value": 3},
    {"title": "VIP 7 Tage", "description": "7 Tage VIP-Status mit allen Vorteilen", "type": "vip", "cost_points": 1200, "reward_value": 7},
    {"title": "VIP 30 Tage", "description": "30 Tage VIP-Status mit allen Vorteilen", "type": "vip", "cost_points": 4000, "reward_value": 30},
    
    # Cashback
    {"title": "1€ Cashback", "description": "1€ direkt ins Wallet", "type": "cashback", "cost_points": 150, "reward_value": 1.0},
    {"title": "3€ Cashback", "description": "3€ direkt ins Wallet", "type": "cashback", "cost_points": 400, "reward_value": 3.0},
    {"title": "5€ Cashback", "description": "5€ direkt ins Wallet", "type": "cashback", "cost_points": 600, "reward_value": 5.0},
]


async def ensure_default_rewards():
    """Seed default rewards if none exist."""
    count = await db.rewards_store.count_documents({})
    if count == 0:
        now = datetime.now(timezone.utc).isoformat()
        for reward in DEFAULT_REWARDS:
            await db.rewards_store.insert_one({
                "id": secrets.token_hex(8),
                "title": reward["title"],
                "description": reward["description"],
                "type": reward["type"],
                "cost_points": reward["cost_points"],
                "reward_value": reward["reward_value"],
                "is_active": True,
                "created_at": now,
            })
        logger.info(f"Seeded {len(DEFAULT_REWARDS)} default rewards")


# ══════════════════════════════════════════════════════════════════════════════
# HELPER FUNCTIONS
# ══════════════════════════════════════════════════════════════════════════════

async def get_user_coins(user_id: str) -> int:
    """Get user's current coin balance."""
    loyalty = await db.user_loyalty.find_one({"user_id": user_id})
    if not loyalty:
        return 0
    return loyalty.get("coins_balance", 0)


async def deduct_coins(user_id: str, amount: int) -> bool:
    """Deduct coins from user's balance."""
    result = await db.user_loyalty.update_one(
        {"user_id": user_id, "coins_balance": {"$gte": amount}},
        {"$inc": {"coins_balance": -amount}}
    )
    return result.modified_count > 0


async def get_today_redemptions(user_id: str, reward_type: str) -> int:
    """Count user's redemptions of a specific type today."""
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    count = await db.rewards_history.count_documents({
        "user_id": user_id,
        "reward_type": reward_type,
        "created_at": {"$gte": today_start},
    })
    return count


async def apply_discount_reward(user_id: str, value: float, reward_id: str):
    """Apply discount credit to user account."""
    now = datetime.now(timezone.utc).isoformat()
    expires = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
    
    await db.user_discounts.insert_one({
        "id": secrets.token_hex(8),
        "user_id": user_id,
        "amount": value,
        "remaining": value,
        "source": "blitzpoints_redemption",
        "source_id": reward_id,
        "expires_at": expires,
        "is_active": True,
        "created_at": now,
    })


async def apply_boost_reward(user_id: str, hours: int, reward_id: str):
    """Grant free boost entitlement to user."""
    now = datetime.now(timezone.utc).isoformat()
    
    await db.user_boost_credits.insert_one({
        "id": secrets.token_hex(8),
        "user_id": user_id,
        "duration_hours": hours,
        "source": "blitzpoints_redemption",
        "source_id": reward_id,
        "is_used": False,
        "created_at": now,
    })


async def apply_vip_reward(user_id: str, days: int, reward_id: str):
    """Activate temporary VIP status."""
    now = datetime.now(timezone.utc)
    expires = now + timedelta(days=days)
    
    # Check existing VIP
    existing = await db.user_vip.find_one({"user_id": user_id})
    
    if existing and existing.get("expires_at", "") > now.isoformat():
        # Extend existing VIP
        current_expires = datetime.fromisoformat(existing["expires_at"].replace("Z", "+00:00"))
        new_expires = current_expires + timedelta(days=days)
        await db.user_vip.update_one(
            {"user_id": user_id},
            {"$set": {"expires_at": new_expires.isoformat(), "updated_at": now.isoformat()}}
        )
    else:
        # Create new VIP
        await db.user_vip.update_one(
            {"user_id": user_id},
            {"$set": {
                "user_id": user_id,
                "is_active": True,
                "source": "blitzpoints_redemption",
                "source_id": reward_id,
                "expires_at": expires.isoformat(),
                "created_at": now.isoformat(),
                "updated_at": now.isoformat(),
            }},
            upsert=True
        )
    
    # Update user role if needed
    await db.users.update_one(
        {"_id": ObjectId(user_id) if ObjectId.is_valid(user_id) else user_id},
        {"$set": {"vip_until": expires.isoformat()}}
    )


async def apply_cashback_reward(user_id: str, amount: float, reward_id: str):
    """Add cashback directly to wallet."""
    now = datetime.now(timezone.utc).isoformat()
    
    # Credit wallet
    await db.users.update_one(
        {"_id": ObjectId(user_id) if ObjectId.is_valid(user_id) else user_id},
        {"$inc": {"balance": amount}}
    )
    
    # Record transaction
    await db.transactions.insert_one({
        "id": secrets.token_hex(8),
        "user_id": user_id,
        "type": "blitzpoints_cashback",
        "amount": amount,
        "description": f"BlitzPoints Einlösung: {amount}€ Cashback",
        "reference": f"BP-{reward_id[:8].upper()}",
        "status": "completed",
        "created_at": now,
    })


# ══════════════════════════════════════════════════════════════════════════════
# USER API ENDPOINTS
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/list")
async def list_rewards(
    request: Request,
    type: Optional[str] = None,
    include_inactive: bool = False,
):
    """Get available rewards in the store."""
    await ensure_default_rewards()
    
    query = {}
    if not include_inactive:
        query["is_active"] = True
    if type and type in REWARD_TYPES:
        query["type"] = type
    
    rewards = await db.rewards_store.find(query, {"_id": 0}).sort("cost_points", 1).to_list(50)
    
    # Add type metadata
    for r in rewards:
        r["type_info"] = REWARD_TYPES.get(r["type"], {})
    
    # Get user's coins if authenticated
    user_coins = 0
    try:
        user = await get_current_user(request)
        user_coins = await get_user_coins(str(user["_id"]))
    except:
        pass
    
    return {
        "rewards": rewards,
        "user_coins": user_coins,
        "types": REWARD_TYPES,
    }


@router.get("/my-balance")
async def get_my_balance(request: Request):
    """Get user's BlitzPoints balance and stats."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    loyalty = await db.user_loyalty.find_one({"user_id": user_id})
    
    # Get active discounts
    discounts = await db.user_discounts.find(
        {"user_id": user_id, "is_active": True, "remaining": {"$gt": 0}},
        {"_id": 0}
    ).to_list(10)
    
    # Get unused boost credits
    boosts = await db.user_boost_credits.find(
        {"user_id": user_id, "is_used": False},
        {"_id": 0}
    ).to_list(10)
    
    # Get VIP status
    vip = await db.user_vip.find_one({"user_id": user_id}, {"_id": 0})
    vip_active = False
    vip_expires = None
    if vip:
        vip_expires = vip.get("expires_at")
        if vip_expires and vip_expires > datetime.now(timezone.utc).isoformat():
            vip_active = True
    
    return {
        "coins_balance": loyalty.get("coins_balance", 0) if loyalty else 0,
        "total_earned": loyalty.get("total_coins_earned", 0) if loyalty else 0,
        "level": loyalty.get("level", "bronze") if loyalty else "bronze",
        "active_discounts": discounts,
        "boost_credits": boosts,
        "vip_active": vip_active,
        "vip_expires": vip_expires,
    }


@router.post("/redeem")
async def redeem_reward(request: Request):
    """Redeem a reward with BlitzPoints."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    body = await request.json()
    reward_id = body.get("reward_id")
    
    if not reward_id:
        raise HTTPException(status_code=400, detail="reward_id required")
    
    # Get reward
    reward = await db.rewards_store.find_one({"id": reward_id, "is_active": True})
    if not reward:
        raise HTTPException(status_code=404, detail="Reward not found or inactive")
    
    cost = reward["cost_points"]
    reward_type = reward["type"]
    reward_value = reward["reward_value"]
    
    # Check daily limit
    today_count = await get_today_redemptions(user_id, reward_type)
    daily_limit = DAILY_LIMITS.get(reward_type, 5)
    
    if today_count >= daily_limit:
        raise HTTPException(
            status_code=429, 
            detail=f"Tageslimit erreicht ({daily_limit}x {REWARD_TYPES[reward_type]['name']} pro Tag)"
        )
    
    # Check balance
    current_coins = await get_user_coins(user_id)
    if current_coins < cost:
        raise HTTPException(
            status_code=400, 
            detail=f"Nicht genug BlitzPoints. Du hast {current_coins}, brauchst aber {cost}."
        )
    
    # Deduct coins
    if not await deduct_coins(user_id, cost):
        raise HTTPException(status_code=400, detail="Konnte Punkte nicht abziehen. Bitte erneut versuchen.")
    
    now = datetime.now(timezone.utc).isoformat()
    redemption_id = secrets.token_hex(8)
    
    # Apply reward based on type
    try:
        if reward_type == "discount":
            await apply_discount_reward(user_id, reward_value, redemption_id)
        elif reward_type == "boost":
            await apply_boost_reward(user_id, int(reward_value), redemption_id)
        elif reward_type == "vip":
            await apply_vip_reward(user_id, int(reward_value), redemption_id)
        elif reward_type == "cashback":
            await apply_cashback_reward(user_id, reward_value, redemption_id)
        else:
            # Refund if unknown type
            await db.user_loyalty.update_one(
                {"user_id": user_id},
                {"$inc": {"coins_balance": cost}}
            )
            raise HTTPException(status_code=400, detail="Unknown reward type")
    except HTTPException:
        raise
    except Exception as e:
        # Refund on error
        await db.user_loyalty.update_one(
            {"user_id": user_id},
            {"$inc": {"coins_balance": cost}}
        )
        logger.error(f"Redemption error: {e}")
        raise HTTPException(status_code=500, detail="Fehler bei der Einlösung. Punkte wurden zurückerstattet.")
    
    # Record redemption
    await db.rewards_history.insert_one({
        "id": redemption_id,
        "user_id": user_id,
        "reward_id": reward_id,
        "reward_title": reward["title"],
        "reward_type": reward_type,
        "points_spent": cost,
        "reward_value": reward_value,
        "created_at": now,
    })
    
    # Send notification
    await db.notifications.insert_one({
        "id": secrets.token_hex(8),
        "user_id": user_id,
        "type": "reward_redeemed",
        "title": f"{reward['title']} eingelöst!",
        "message": f"Du hast {cost} BlitzPoints für '{reward['title']}' eingelöst.",
        "data": {"reward_id": reward_id, "reward_type": reward_type, "value": reward_value},
        "read": False,
        "created_at": now,
    })
    
    # Get updated balance
    new_balance = await get_user_coins(user_id)
    
    logger.info(f"User {user_id} redeemed {reward['title']} for {cost} points")
    
    return {
        "success": True,
        "message": f"{reward['title']} erfolgreich eingelöst!",
        "points_spent": cost,
        "new_balance": new_balance,
        "reward": {
            "type": reward_type,
            "value": reward_value,
            "title": reward["title"],
        },
    }


@router.get("/history")
async def get_redemption_history(request: Request, limit: int = Query(30, le=100)):
    """Get user's redemption history."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    history = await db.rewards_history.find(
        {"user_id": user_id},
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    # Add type info
    for h in history:
        h["type_info"] = REWARD_TYPES.get(h.get("reward_type"), {})
    
    # Stats
    total_spent = sum(h.get("points_spent", 0) for h in history)
    total_redeemed = len(history)
    
    return {
        "history": history,
        "total_points_spent": total_spent,
        "total_redemptions": total_redeemed,
    }


@router.get("/active-benefits")
async def get_active_benefits(request: Request):
    """Get user's currently active benefits from redemptions."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    now = datetime.now(timezone.utc).isoformat()
    
    benefits = []
    
    # Active discounts
    discounts = await db.user_discounts.find(
        {"user_id": user_id, "is_active": True, "remaining": {"$gt": 0}},
        {"_id": 0}
    ).to_list(20)
    
    for d in discounts:
        benefits.append({
            "type": "discount",
            "title": f"€{d['remaining']:.2f} Rabatt",
            "remaining_value": d["remaining"],
            "expires_at": d.get("expires_at"),
            "id": d["id"],
        })
    
    # Unused boost credits
    boosts = await db.user_boost_credits.find(
        {"user_id": user_id, "is_used": False},
        {"_id": 0}
    ).to_list(20)
    
    for b in boosts:
        benefits.append({
            "type": "boost",
            "title": f"{b['duration_hours']}h Boost",
            "duration_hours": b["duration_hours"],
            "id": b["id"],
        })
    
    # VIP status
    vip = await db.user_vip.find_one({"user_id": user_id}, {"_id": 0})
    if vip and vip.get("expires_at", "") > now:
        benefits.append({
            "type": "vip",
            "title": "VIP Status",
            "expires_at": vip["expires_at"],
            "is_active": True,
        })
    
    return {"benefits": benefits}


# ══════════════════════════════════════════════════════════════════════════════
# ADMIN ENDPOINTS
# ══════════════════════════════════════════════════════════════════════════════

class CreateRewardRequest(BaseModel):
    title: str
    description: str
    type: str
    cost_points: int = Field(ge=1)
    reward_value: float = Field(ge=0)
    is_active: bool = True


@router.get("/admin/list")
async def admin_list_rewards(request: Request):
    """Admin: List all rewards including inactive."""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    
    await ensure_default_rewards()
    
    rewards = await db.rewards_store.find({}, {"_id": 0}).sort("type", 1).to_list(100)
    
    # Add stats
    for r in rewards:
        r["redemption_count"] = await db.rewards_history.count_documents({"reward_id": r["id"]})
        r["type_info"] = REWARD_TYPES.get(r["type"], {})
    
    return {"rewards": rewards, "types": REWARD_TYPES}


@router.post("/admin/create")
async def admin_create_reward(req: CreateRewardRequest, request: Request):
    """Admin: Create a new reward."""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    
    if req.type not in REWARD_TYPES:
        raise HTTPException(status_code=400, detail=f"Invalid type. Must be one of: {list(REWARD_TYPES.keys())}")
    
    now = datetime.now(timezone.utc).isoformat()
    reward_id = secrets.token_hex(8)
    
    await db.rewards_store.insert_one({
        "id": reward_id,
        "title": req.title,
        "description": req.description,
        "type": req.type,
        "cost_points": req.cost_points,
        "reward_value": req.reward_value,
        "is_active": req.is_active,
        "created_at": now,
        "created_by": str(user["_id"]),
    })
    
    logger.info(f"Admin {user.get('email')} created reward: {req.title}")
    
    return {"ok": True, "reward_id": reward_id}


@router.put("/admin/{reward_id}")
async def admin_update_reward(reward_id: str, request: Request):
    """Admin: Update a reward."""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    
    body = await request.json()
    
    update = {"$set": {"updated_at": datetime.now(timezone.utc).isoformat()}}
    
    allowed_fields = ["title", "description", "cost_points", "reward_value", "is_active"]
    for field in allowed_fields:
        if field in body:
            update["$set"][field] = body[field]
    
    result = await db.rewards_store.update_one({"id": reward_id}, update)
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Reward not found")
    
    return {"ok": True}


@router.delete("/admin/{reward_id}")
async def admin_delete_reward(reward_id: str, request: Request):
    """Admin: Delete a reward (or deactivate)."""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    
    # Check if reward has redemptions
    has_redemptions = await db.rewards_history.count_documents({"reward_id": reward_id}) > 0
    
    if has_redemptions:
        # Just deactivate instead of deleting
        await db.rewards_store.update_one(
            {"id": reward_id},
            {"$set": {"is_active": False, "deleted_at": datetime.now(timezone.utc).isoformat()}}
        )
        return {"ok": True, "message": "Reward deactivated (has redemption history)"}
    else:
        await db.rewards_store.delete_one({"id": reward_id})
        return {"ok": True, "message": "Reward deleted"}


@router.get("/admin/analytics")
async def admin_rewards_analytics(request: Request, days: int = Query(30, le=365)):
    """Admin: Get rewards redemption analytics."""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    
    start_date = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    
    # Total redemptions
    total_redemptions = await db.rewards_history.count_documents({"created_at": {"$gte": start_date}})
    
    # Total points spent
    pipeline = [
        {"$match": {"created_at": {"$gte": start_date}}},
        {"$group": {
            "_id": None,
            "total_points": {"$sum": "$points_spent"},
            "total_value": {"$sum": "$reward_value"},
        }},
    ]
    result = await db.rewards_history.aggregate(pipeline).to_list(1)
    totals = result[0] if result else {"total_points": 0, "total_value": 0}
    
    # By type
    type_pipeline = [
        {"$match": {"created_at": {"$gte": start_date}}},
        {"$group": {
            "_id": "$reward_type",
            "count": {"$sum": 1},
            "points": {"$sum": "$points_spent"},
            "value": {"$sum": "$reward_value"},
        }},
    ]
    by_type = await db.rewards_history.aggregate(type_pipeline).to_list(10)
    
    # Top rewards
    top_pipeline = [
        {"$match": {"created_at": {"$gte": start_date}}},
        {"$group": {
            "_id": "$reward_id",
            "title": {"$first": "$reward_title"},
            "count": {"$sum": 1},
            "points": {"$sum": "$points_spent"},
        }},
        {"$sort": {"count": -1}},
        {"$limit": 10},
    ]
    top_rewards = await db.rewards_history.aggregate(top_pipeline).to_list(10)
    
    return {
        "period_days": days,
        "total_redemptions": total_redemptions,
        "total_points_spent": totals.get("total_points", 0),
        "total_reward_value": round(totals.get("total_value", 0), 2),
        "by_type": {r["_id"]: {"count": r["count"], "points": r["points"], "value": round(r["value"], 2)} for r in by_type},
        "top_rewards": top_rewards,
    }
