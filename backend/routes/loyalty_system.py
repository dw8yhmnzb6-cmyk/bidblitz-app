"""
BidBlitz V2 - Loyalty & Coins System
Complete cashback, coins, and level system for customer retention.
All rewards based on REAL completed transactions only.
"""

import secrets
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, List
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from bson import ObjectId

from core.database import db
from core.security import get_current_user

router = APIRouter(prefix="/api/loyalty", tags=["Loyalty"])
logger = logging.getLogger("bidblitz.loyalty")


# ══════════════════════════════════════════════════════════════════════════════
# LEVEL DEFINITIONS
# ══════════════════════════════════════════════════════════════════════════════

LEVELS = {
    "bronze": {
        "name": "Bronze",
        "min_spend": 0,
        "min_transactions": 0,
        "min_coins": 0,
        "coin_multiplier": 1.0,
        "cashback_bonus": 0.0,
        "color": "#CD7F32",
        "icon": "medal",
    },
    "silver": {
        "name": "Silver",
        "min_spend": 100,
        "min_transactions": 10,
        "min_coins": 50,
        "coin_multiplier": 1.2,
        "cashback_bonus": 0.005,
        "color": "#C0C0C0",
        "icon": "award",
    },
    "gold": {
        "name": "Gold",
        "min_spend": 500,
        "min_transactions": 50,
        "min_coins": 250,
        "coin_multiplier": 1.5,
        "cashback_bonus": 0.01,
        "color": "#FFD700",
        "icon": "crown",
    },
    "platinum": {
        "name": "Platinum",
        "min_spend": 2000,
        "min_transactions": 200,
        "min_coins": 1000,
        "coin_multiplier": 2.0,
        "cashback_bonus": 0.02,
        "color": "#E5E4E2",
        "icon": "gem",
    },
    "vip": {
        "name": "VIP",
        "min_spend": 10000,
        "min_transactions": 500,
        "min_coins": 5000,
        "coin_multiplier": 3.0,
        "cashback_bonus": 0.05,
        "color": "#8B00FF",
        "icon": "star",
    },
}

LEVEL_ORDER = ["bronze", "silver", "gold", "platinum", "vip"]


# ══════════════════════════════════════════════════════════════════════════════
# DEFAULT REWARD RATES (Admin configurable)
# ══════════════════════════════════════════════════════════════════════════════

DEFAULT_COIN_RATES = {
    "taxi_payment": 2,      # 2 coins per €1
    "scooter_payment": 2,   # 2 coins per €1
    "food_payment": 3,      # 3 coins per €1
    "merchant_payment": 1,  # 1 coin per €1
    "marketplace_payment": 2,
    "auction_payment": 5,   # Higher for auctions
    "mining_payment": 3,
    "subscription_payment": 5,
}

DEFAULT_CASHBACK_RATES = {
    "taxi_payment": 0.02,       # 2%
    "scooter_payment": 0.02,    # 2%
    "food_payment": 0.03,       # 3%
    "merchant_payment": 0.01,   # 1%
    "marketplace_payment": 0.02,
    "auction_payment": 0.01,
    "mining_payment": 0.01,
    "subscription_payment": 0.0,
}


# ══════════════════════════════════════════════════════════════════════════════
# HELPER FUNCTIONS
# ══════════════════════════════════════════════════════════════════════════════

async def get_loyalty_config() -> Dict:
    """Get admin-configured loyalty settings."""
    config = await db.loyalty_config.find_one({"key": "settings"})
    if not config:
        return {
            "coins_enabled": True,
            "cashback_enabled": True,
            "coin_rates": DEFAULT_COIN_RATES,
            "cashback_rates": DEFAULT_CASHBACK_RATES,
            "level_thresholds": {
                level: {
                    "min_spend": data["min_spend"],
                    "min_transactions": data["min_transactions"],
                    "min_coins": data["min_coins"],
                }
                for level, data in LEVELS.items()
            },
        }
    return config


async def get_user_loyalty(user_id: str) -> Dict:
    """Get or create user loyalty record."""
    loyalty = await db.user_loyalty.find_one({"user_id": user_id})
    if not loyalty:
        now = datetime.now(timezone.utc).isoformat()
        loyalty = {
            "user_id": user_id,
            "coins_balance": 0,
            "total_coins_earned": 0,
            "total_cashback_earned": 0.0,
            "level": "bronze",
            "total_spend": 0.0,
            "total_transactions": 0,
            "last_coin_activity_at": None,
            "created_at": now,
            "updated_at": now,
        }
        await db.user_loyalty.insert_one(loyalty)
    loyalty.pop("_id", None)
    return loyalty


async def calculate_user_level(user_id: str) -> str:
    """Calculate user level based on activity."""
    loyalty = await get_user_loyalty(user_id)
    config = await get_loyalty_config()
    thresholds = config.get("level_thresholds", {})
    
    total_spend = loyalty.get("total_spend", 0)
    total_transactions = loyalty.get("total_transactions", 0)
    total_coins = loyalty.get("total_coins_earned", 0)
    
    current_level = "bronze"
    
    for level in LEVEL_ORDER:
        level_config = thresholds.get(level, LEVELS[level])
        if (total_spend >= level_config.get("min_spend", 0) and
            total_transactions >= level_config.get("min_transactions", 0) and
            total_coins >= level_config.get("min_coins", 0)):
            current_level = level
    
    return current_level


async def get_next_level_progress(user_id: str) -> Dict:
    """Get progress towards next level."""
    loyalty = await get_user_loyalty(user_id)
    current_level = loyalty.get("level", "bronze")
    
    current_idx = LEVEL_ORDER.index(current_level)
    if current_idx >= len(LEVEL_ORDER) - 1:
        return {
            "current_level": current_level,
            "next_level": None,
            "progress": 100,
            "is_max_level": True,
        }
    
    next_level = LEVEL_ORDER[current_idx + 1]
    next_config = LEVELS[next_level]
    
    # Calculate progress
    spend_progress = min(100, (loyalty.get("total_spend", 0) / max(next_config["min_spend"], 1)) * 100)
    tx_progress = min(100, (loyalty.get("total_transactions", 0) / max(next_config["min_transactions"], 1)) * 100)
    coin_progress = min(100, (loyalty.get("total_coins_earned", 0) / max(next_config["min_coins"], 1)) * 100)
    
    avg_progress = (spend_progress + tx_progress + coin_progress) / 3
    
    return {
        "current_level": current_level,
        "next_level": next_level,
        "progress": round(avg_progress, 1),
        "is_max_level": False,
        "requirements": {
            "spend": {"current": loyalty.get("total_spend", 0), "required": next_config["min_spend"]},
            "transactions": {"current": loyalty.get("total_transactions", 0), "required": next_config["min_transactions"]},
            "coins": {"current": loyalty.get("total_coins_earned", 0), "required": next_config["min_coins"]},
        }
    }


# ══════════════════════════════════════════════════════════════════════════════
# CORE REWARD FUNCTIONS (Called by payment engine)
# ══════════════════════════════════════════════════════════════════════════════

async def process_loyalty_rewards(
    user_id: str,
    source_type: str,
    source_id: str,
    amount: float,
    tx_id: str,
) -> Dict:
    """
    Process loyalty rewards for a completed transaction.
    Called by payment engine after successful payment.
    
    Returns:
        Dict with coins_earned, cashback_earned, level_up info
    """
    config = await get_loyalty_config()
    
    if not config.get("coins_enabled") and not config.get("cashback_enabled"):
        return {"coins_earned": 0, "cashback_earned": 0, "level_changed": False}
    
    # Prevent duplicate rewards
    existing = await db.coins_transactions.find_one({
        "source_type": source_type,
        "source_id": source_id,
    })
    if existing:
        logger.warning(f"Duplicate reward attempt: {source_type}/{source_id}")
        return {"coins_earned": 0, "cashback_earned": 0, "level_changed": False, "duplicate": True}
    
    loyalty = await get_user_loyalty(user_id)
    old_level = loyalty.get("level", "bronze")
    level_config = LEVELS.get(old_level, LEVELS["bronze"])
    
    now = datetime.now(timezone.utc)
    coins_earned = 0
    cashback_earned = 0.0
    
    # ═══════════════════════════════════════════════════════════════════════════
    # COINS REWARD
    # ═══════════════════════════════════════════════════════════════════════════
    
    if config.get("coins_enabled"):
        coin_rates = config.get("coin_rates", DEFAULT_COIN_RATES)
        base_rate = coin_rates.get(source_type, 1)
        
        # Apply level multiplier
        multiplier = level_config.get("coin_multiplier", 1.0)
        
        # Calculate coins (rate is per €1)
        raw_coins = int(amount * base_rate * multiplier)
        coins_earned = max(1, raw_coins) if amount >= 0.50 else 0  # Min 50 cents for coins
        
        if coins_earned > 0:
            # Record coin transaction
            await db.coins_transactions.insert_one({
                "id": secrets.token_hex(8),
                "user_id": user_id,
                "source_type": source_type,
                "source_id": source_id,
                "tx_id": tx_id,
                "coins_amount": coins_earned,
                "amount_spent": amount,
                "level_at_time": old_level,
                "multiplier": multiplier,
                "created_at": now.isoformat(),
            })
    
    # ═══════════════════════════════════════════════════════════════════════════
    # CASHBACK REWARD
    # ═══════════════════════════════════════════════════════════════════════════
    
    if config.get("cashback_enabled"):
        cashback_rates = config.get("cashback_rates", DEFAULT_CASHBACK_RATES)
        base_cashback = cashback_rates.get(source_type, 0)
        
        # Add level bonus
        level_bonus = level_config.get("cashback_bonus", 0)
        total_rate = base_cashback + level_bonus
        
        cashback_earned = round(amount * total_rate, 2)
        
        if cashback_earned >= 0.01:
            # Credit wallet
            await db.users.update_one(
                {"_id": ObjectId(user_id) if ObjectId.is_valid(user_id) else user_id},
                {"$inc": {"balance": cashback_earned}}
            )
            
            # Record cashback transaction
            await db.transactions.insert_one({
                "id": secrets.token_hex(8),
                "user_id": user_id,
                "type": "loyalty_cashback",
                "amount": cashback_earned,
                "description": f"Cashback ({total_rate*100:.1f}%)",
                "reference": f"CB-{tx_id[:8].upper()}",
                "source_type": source_type,
                "source_tx": tx_id,
                "status": "completed",
                "created_at": now.isoformat(),
            })
    
    # ═══════════════════════════════════════════════════════════════════════════
    # UPDATE USER LOYALTY RECORD
    # ═══════════════════════════════════════════════════════════════════════════
    
    update = {
        "$inc": {
            "coins_balance": coins_earned,
            "total_coins_earned": coins_earned,
            "total_cashback_earned": cashback_earned,
            "total_spend": amount,
            "total_transactions": 1,
        },
        "$set": {
            "last_coin_activity_at": now.isoformat(),
            "updated_at": now.isoformat(),
        }
    }
    
    await db.user_loyalty.update_one({"user_id": user_id}, update)
    
    # ═══════════════════════════════════════════════════════════════════════════
    # CHECK LEVEL UP
    # ═══════════════════════════════════════════════════════════════════════════
    
    new_level = await calculate_user_level(user_id)
    level_changed = new_level != old_level
    
    if level_changed:
        await db.user_loyalty.update_one(
            {"user_id": user_id},
            {"$set": {"level": new_level}}
        )
        
        # Record level up event
        await db.loyalty_events.insert_one({
            "id": secrets.token_hex(8),
            "user_id": user_id,
            "event_type": "level_up",
            "old_level": old_level,
            "new_level": new_level,
            "created_at": now.isoformat(),
        })
        
        # Send notification
        await db.notifications.insert_one({
            "id": secrets.token_hex(8),
            "user_id": user_id,
            "type": "level_up",
            "title": f"Level Up: {LEVELS[new_level]['name']}!",
            "message": f"Glückwunsch! Du hast {LEVELS[new_level]['name']}-Level erreicht. Genieße {LEVELS[new_level]['coin_multiplier']}x Coins und {LEVELS[new_level]['cashback_bonus']*100:.0f}% extra Cashback!",
            "data": {"old_level": old_level, "new_level": new_level},
            "read": False,
            "created_at": now.isoformat(),
        })
        
        logger.info(f"User {user_id} leveled up: {old_level} -> {new_level}")
    
    # ═══════════════════════════════════════════════════════════════════════════
    # SEND REWARD NOTIFICATIONS
    # ═══════════════════════════════════════════════════════════════════════════
    
    if coins_earned > 0 or cashback_earned > 0:
        parts = []
        if coins_earned > 0:
            parts.append(f"{coins_earned} Coins")
        if cashback_earned > 0:
            parts.append(f"€{cashback_earned:.2f} Cashback")
        
        source_names = {
            "taxi_payment": "Taxi-Fahrt",
            "scooter_payment": "Scooter-Fahrt",
            "food_payment": "Essensbestellung",
            "merchant_payment": "Zahlung",
            "marketplace_payment": "Marketplace-Kauf",
            "auction_payment": "Auktion",
            "mining_payment": "Mining",
            "subscription_payment": "Abo",
        }
        
        await db.notifications.insert_one({
            "id": secrets.token_hex(8),
            "user_id": user_id,
            "type": "loyalty_reward",
            "title": "Belohnung erhalten!",
            "message": f"Du hast {' und '.join(parts)} für deine {source_names.get(source_type, 'Transaktion')} erhalten!",
            "data": {"coins": coins_earned, "cashback": cashback_earned, "source": source_type},
            "read": False,
            "created_at": now.isoformat(),
        })
    
    return {
        "coins_earned": coins_earned,
        "cashback_earned": cashback_earned,
        "level_changed": level_changed,
        "new_level": new_level if level_changed else None,
    }


# ══════════════════════════════════════════════════════════════════════════════
# USER API ENDPOINTS
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/status")
async def get_loyalty_status(request: Request):
    """Get user's complete loyalty status."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    loyalty = await get_user_loyalty(user_id)
    progress = await get_next_level_progress(user_id)
    
    level = loyalty.get("level", "bronze")
    level_info = LEVELS.get(level, LEVELS["bronze"])
    
    return {
        "coins_balance": loyalty.get("coins_balance", 0),
        "total_coins_earned": loyalty.get("total_coins_earned", 0),
        "total_cashback_earned": round(loyalty.get("total_cashback_earned", 0), 2),
        "total_spend": round(loyalty.get("total_spend", 0), 2),
        "total_transactions": loyalty.get("total_transactions", 0),
        "level": level,
        "level_name": level_info["name"],
        "level_color": level_info["color"],
        "level_icon": level_info["icon"],
        "coin_multiplier": level_info["coin_multiplier"],
        "cashback_bonus": level_info["cashback_bonus"],
        "progress": progress,
        "last_activity": loyalty.get("last_coin_activity_at"),
    }


@router.get("/history")
async def get_reward_history(request: Request, limit: int = 50):
    """Get user's reward history."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    # Get coin transactions
    coin_txns = await db.coins_transactions.find(
        {"user_id": user_id},
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    # Get cashback transactions
    cashback_txns = await db.transactions.find(
        {"user_id": user_id, "type": "loyalty_cashback"},
        {"_id": 0, "id": 1, "amount": 1, "description": 1, "source_type": 1, "created_at": 1}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    # Get level events
    level_events = await db.loyalty_events.find(
        {"user_id": user_id},
        {"_id": 0}
    ).sort("created_at", -1).limit(20).to_list(20)
    
    return {
        "coins": coin_txns,
        "cashback": cashback_txns,
        "level_events": level_events,
    }


@router.get("/stats")
async def get_loyalty_stats(request: Request):
    """Get user's loyalty statistics by module."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    # Aggregate coins by source type
    pipeline = [
        {"$match": {"user_id": user_id}},
        {"$group": {
            "_id": "$source_type",
            "total_coins": {"$sum": "$coins_amount"},
            "total_spent": {"$sum": "$amount_spent"},
            "count": {"$sum": 1},
        }},
    ]
    
    stats = await db.coins_transactions.aggregate(pipeline).to_list(20)
    
    by_module = {}
    for s in stats:
        by_module[s["_id"]] = {
            "coins": s["total_coins"],
            "spent": round(s["total_spent"], 2),
            "transactions": s["count"],
        }
    
    # Get total cashback
    cashback_pipeline = [
        {"$match": {"user_id": user_id, "type": "loyalty_cashback"}},
        {"$group": {
            "_id": "$source_type",
            "total": {"$sum": "$amount"},
        }},
    ]
    
    cashback_stats = await db.transactions.aggregate(cashback_pipeline).to_list(20)
    
    for s in cashback_stats:
        if s["_id"] in by_module:
            by_module[s["_id"]]["cashback"] = round(s["total"], 2)
    
    return {"by_module": by_module}


@router.get("/levels")
async def get_all_levels():
    """Get all level information."""
    return {
        "levels": [
            {
                "id": level,
                **data,
                "order": idx,
            }
            for idx, (level, data) in enumerate(LEVELS.items())
        ]
    }


@router.get("/rates")
async def get_reward_rates():
    """Get current reward rates (public)."""
    config = await get_loyalty_config()
    
    return {
        "coins_enabled": config.get("coins_enabled", True),
        "cashback_enabled": config.get("cashback_enabled", True),
        "coin_rates": config.get("coin_rates", DEFAULT_COIN_RATES),
        "cashback_rates": {
            k: f"{v*100:.1f}%" 
            for k, v in config.get("cashback_rates", DEFAULT_CASHBACK_RATES).items()
        },
    }


# ══════════════════════════════════════════════════════════════════════════════
# ADMIN ENDPOINTS
# ══════════════════════════════════════════════════════════════════════════════

class UpdateLoyaltyConfigRequest(BaseModel):
    coins_enabled: Optional[bool] = None
    cashback_enabled: Optional[bool] = None
    coin_rates: Optional[Dict[str, int]] = None
    cashback_rates: Optional[Dict[str, float]] = None
    level_thresholds: Optional[Dict] = None


@router.get("/admin/config")
async def admin_get_config(request: Request):
    """Admin: Get loyalty configuration."""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    
    config = await get_loyalty_config()
    return config


@router.put("/admin/config")
async def admin_update_config(req: UpdateLoyaltyConfigRequest, request: Request):
    """Admin: Update loyalty configuration."""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    
    now = datetime.now(timezone.utc).isoformat()
    
    update = {"$set": {"updated_at": now, "updated_by": str(user["_id"])}}
    
    if req.coins_enabled is not None:
        update["$set"]["coins_enabled"] = req.coins_enabled
    if req.cashback_enabled is not None:
        update["$set"]["cashback_enabled"] = req.cashback_enabled
    if req.coin_rates:
        update["$set"]["coin_rates"] = req.coin_rates
    if req.cashback_rates:
        update["$set"]["cashback_rates"] = req.cashback_rates
    if req.level_thresholds:
        update["$set"]["level_thresholds"] = req.level_thresholds
    
    await db.loyalty_config.update_one(
        {"key": "settings"},
        update,
        upsert=True
    )
    
    logger.info(f"Admin {user.get('email')} updated loyalty config")
    
    return {"ok": True, "message": "Konfiguration aktualisiert"}


@router.get("/admin/analytics")
async def admin_loyalty_analytics(request: Request, days: int = 30):
    """Admin: Get loyalty system analytics."""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    
    now = datetime.now(timezone.utc)
    start_date = (now - timedelta(days=days)).isoformat()
    
    # Total coins distributed
    coins_pipeline = [
        {"$match": {"created_at": {"$gte": start_date}}},
        {"$group": {
            "_id": None,
            "total_coins": {"$sum": "$coins_amount"},
            "total_transactions": {"$sum": 1},
        }},
    ]
    
    coins_result = await db.coins_transactions.aggregate(coins_pipeline).to_list(1)
    coins_stats = coins_result[0] if coins_result else {"total_coins": 0, "total_transactions": 0}
    
    # Total cashback paid
    cashback_pipeline = [
        {"$match": {"type": "loyalty_cashback", "created_at": {"$gte": start_date}}},
        {"$group": {
            "_id": None,
            "total_cashback": {"$sum": "$amount"},
            "count": {"$sum": 1},
        }},
    ]
    
    cashback_result = await db.transactions.aggregate(cashback_pipeline).to_list(1)
    cashback_stats = cashback_result[0] if cashback_result else {"total_cashback": 0, "count": 0}
    
    # Users by level
    level_pipeline = [
        {"$group": {
            "_id": "$level",
            "count": {"$sum": 1},
        }},
    ]
    
    level_result = await db.user_loyalty.aggregate(level_pipeline).to_list(10)
    users_by_level = {r["_id"]: r["count"] for r in level_result}
    
    # Level ups in period
    level_ups = await db.loyalty_events.count_documents({
        "event_type": "level_up",
        "created_at": {"$gte": start_date}
    })
    
    # Top earners
    top_pipeline = [
        {"$sort": {"total_coins_earned": -1}},
        {"$limit": 10},
        {"$lookup": {
            "from": "users",
            "let": {"uid": {"$toObjectId": "$user_id"}},
            "pipeline": [
                {"$match": {"$expr": {"$eq": ["$_id", "$$uid"]}}},
                {"$project": {"name": 1, "email": 1}}
            ],
            "as": "user_info"
        }},
        {"$project": {
            "_id": 0,
            "user_id": 1,
            "coins_balance": 1,
            "total_coins_earned": 1,
            "level": 1,
            "user": {"$arrayElemAt": ["$user_info", 0]}
        }}
    ]
    
    top_earners = await db.user_loyalty.aggregate(top_pipeline).to_list(10)
    
    # Coins by module
    module_pipeline = [
        {"$match": {"created_at": {"$gte": start_date}}},
        {"$group": {
            "_id": "$source_type",
            "coins": {"$sum": "$coins_amount"},
            "count": {"$sum": 1},
        }},
    ]
    
    by_module = await db.coins_transactions.aggregate(module_pipeline).to_list(20)
    
    return {
        "period_days": days,
        "total_coins_distributed": coins_stats.get("total_coins", 0),
        "total_coin_transactions": coins_stats.get("total_transactions", 0),
        "total_cashback_paid": round(cashback_stats.get("total_cashback", 0), 2),
        "total_cashback_transactions": cashback_stats.get("count", 0),
        "users_by_level": users_by_level,
        "level_ups_in_period": level_ups,
        "top_earners": top_earners,
        "coins_by_module": {r["_id"]: r["coins"] for r in by_module},
        "transactions_by_module": {r["_id"]: r["count"] for r in by_module},
    }


@router.post("/admin/grant-coins")
async def admin_grant_coins(request: Request):
    """Admin: Manually grant coins to a user."""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    
    body = await request.json()
    target_user_id = body.get("user_id")
    amount = body.get("amount", 0)
    reason = body.get("reason", "Admin grant")
    
    if not target_user_id or amount <= 0:
        raise HTTPException(status_code=400, detail="user_id and positive amount required")
    
    now = datetime.now(timezone.utc).isoformat()
    
    # Ensure loyalty record exists
    await get_user_loyalty(target_user_id)
    
    # Add coins
    await db.user_loyalty.update_one(
        {"user_id": target_user_id},
        {"$inc": {"coins_balance": amount, "total_coins_earned": amount}}
    )
    
    # Record transaction
    await db.coins_transactions.insert_one({
        "id": secrets.token_hex(8),
        "user_id": target_user_id,
        "source_type": "admin_grant",
        "source_id": f"admin_{user['_id']}",
        "coins_amount": amount,
        "amount_spent": 0,
        "level_at_time": "admin",
        "reason": reason,
        "granted_by": str(user["_id"]),
        "created_at": now,
    })
    
    # Notify user
    await db.notifications.insert_one({
        "id": secrets.token_hex(8),
        "user_id": target_user_id,
        "type": "admin_coins",
        "title": f"+{amount} Coins erhalten!",
        "message": reason,
        "read": False,
        "created_at": now,
    })
    
    logger.info(f"Admin {user.get('email')} granted {amount} coins to {target_user_id}")
    
    return {"ok": True, "granted": amount}
