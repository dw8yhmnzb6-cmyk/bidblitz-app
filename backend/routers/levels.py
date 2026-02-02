"""Gamification Level System - User progression through tiers"""
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone, timedelta
from typing import Optional
import uuid

from config import db, logger
from dependencies import get_current_user

router = APIRouter(prefix="/levels", tags=["Levels"])

# Level definitions with requirements and perks
LEVELS = {
    "bronze": {
        "name": "Bronze",
        "name_de": "Bronze",
        "min_xp": 0,
        "icon": "🥉",
        "color": "#CD7F32",
        "perks": {
            "wheel_spins_per_day": 1,
            "buy_now_discount": 0,
            "bid_refund_percent": 50,
            "exclusive_auctions": False,
            "priority_support": False,
            "free_shipping_threshold": 500
        },
        "perks_de": [
            "1x Glücksrad pro Tag",
            "50% Gebote-Zurück bei Sofortkauf"
        ]
    },
    "silver": {
        "name": "Silver",
        "name_de": "Silber",
        "min_xp": 500,
        "icon": "🥈",
        "color": "#C0C0C0",
        "perks": {
            "wheel_spins_per_day": 2,
            "buy_now_discount": 5,
            "bid_refund_percent": 60,
            "exclusive_auctions": False,
            "priority_support": False,
            "free_shipping_threshold": 300
        },
        "perks_de": [
            "2x Glücksrad pro Tag",
            "5% Rabatt auf Sofortkauf",
            "60% Gebote-Zurück",
            "Gratis-Versand ab €300 Warenwert"
        ]
    },
    "gold": {
        "name": "Gold",
        "name_de": "Gold",
        "min_xp": 2000,
        "icon": "🥇",
        "color": "#FFD700",
        "perks": {
            "wheel_spins_per_day": 2,
            "buy_now_discount": 10,
            "bid_refund_percent": 75,
            "exclusive_auctions": True,
            "priority_support": False,
            "free_shipping_threshold": 200
        },
        "perks_de": [
            "2x Glücksrad pro Tag",
            "10% Rabatt auf Sofortkauf",
            "75% Gebote-Zurück",
            "Zugang zu Gold-Auktionen",
            "Gratis-Versand ab €200"
        ]
    },
    "platinum": {
        "name": "Platinum",
        "name_de": "Platin",
        "min_xp": 5000,
        "icon": "💠",
        "color": "#E5E4E2",
        "perks": {
            "wheel_spins_per_day": 3,
            "buy_now_discount": 15,
            "bid_refund_percent": 100,
            "exclusive_auctions": True,
            "priority_support": True,
            "free_shipping_threshold": 100
        },
        "perks_de": [
            "3x Glücksrad pro Tag",
            "15% Rabatt auf Sofortkauf",
            "100% Gebote-Zurück!",
            "Zugang zu Platin-Auktionen",
            "Priority Support",
            "Gratis-Versand ab €100"
        ]
    },
    "diamond": {
        "name": "Diamond",
        "name_de": "Diamant",
        "min_xp": 15000,
        "icon": "💎",
        "color": "#B9F2FF",
        "perks": {
            "wheel_spins_per_day": 5,
            "buy_now_discount": 20,
            "bid_refund_percent": 100,
            "exclusive_auctions": True,
            "priority_support": True,
            "free_shipping_threshold": 0,
            "monthly_bonus_bids": 10
        },
        "perks_de": [
            "5x Glücksrad pro Tag",
            "20% Rabatt auf Sofortkauf",
            "100% Gebote-Zurück",
            "Zugang zu ALLEN exklusiven Auktionen",
            "Priority Support",
            "IMMER Gratis-Versand",
            "10 Bonus-Gebote jeden Monat"
        ]
    }
}

# XP earning actions
XP_ACTIONS = {
    "place_bid": 1,
    "win_auction": 50,
    "purchase_bids": 10,  # per €10 spent
    "daily_login": 5,
    "complete_challenge": 25,
    "leave_review": 15,
    "refer_friend": 100,
    "win_streak_3": 30,
    "first_win": 100
}

# ==================== USER ENDPOINTS ====================

@router.get("/my-level")
async def get_my_level(user: dict = Depends(get_current_user)):
    """Get user's current level and progress"""
    user_id = user["id"]
    
    # Get or create level record
    level_data = await db.user_levels.find_one({"user_id": user_id}, {"_id": 0})
    
    if not level_data:
        level_data = {
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "current_xp": 0,
            "current_level": "bronze",
            "level_history": [],
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.user_levels.insert_one(level_data)
    
    current_xp = level_data.get("current_xp", 0)
    current_level = level_data.get("current_level", "bronze")
    level_info = LEVELS.get(current_level, LEVELS["bronze"])
    
    # Calculate next level
    next_level = None
    xp_to_next = 0
    progress_percent = 100
    
    level_order = ["bronze", "silver", "gold", "platinum", "diamond"]
    current_index = level_order.index(current_level)
    
    if current_index < len(level_order) - 1:
        next_level_key = level_order[current_index + 1]
        next_level = LEVELS[next_level_key]
        xp_to_next = next_level["min_xp"] - current_xp
        
        current_min = level_info["min_xp"]
        next_min = next_level["min_xp"]
        progress_in_level = current_xp - current_min
        level_range = next_min - current_min
        progress_percent = min(100, int((progress_in_level / level_range) * 100))
    
    return {
        "current_level": current_level,
        "level_info": level_info,
        "current_xp": current_xp,
        "next_level": next_level,
        "xp_to_next_level": max(0, xp_to_next),
        "progress_percent": progress_percent,
        "perks": level_info.get("perks", {}),
        "all_levels": LEVELS
    }

@router.get("/xp-history")
async def get_xp_history(limit: int = 50, user: dict = Depends(get_current_user)):
    """Get user's XP earning history"""
    history = await db.xp_transactions.find(
        {"user_id": user["id"]},
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    return {"history": history}

@router.get("/leaderboard")
async def get_level_leaderboard(limit: int = 20):
    """Get XP leaderboard"""
    leaderboard = await db.user_levels.find(
        {},
        {"_id": 0, "user_id": 1, "current_xp": 1, "current_level": 1}
    ).sort("current_xp", -1).limit(limit).to_list(limit)
    
    # Enrich with user names
    enriched = []
    for i, entry in enumerate(leaderboard):
        user = await db.users.find_one({"id": entry["user_id"]}, {"_id": 0, "name": 1})
        level_info = LEVELS.get(entry.get("current_level", "bronze"), LEVELS["bronze"])
        enriched.append({
            "rank": i + 1,
            "user_name": user.get("name", "Anonym") if user else "Anonym",
            "xp": entry.get("current_xp", 0),
            "level": entry.get("current_level", "bronze"),
            "level_icon": level_info["icon"]
        })
    
    return {"leaderboard": enriched}

@router.get("/perks")
async def get_my_perks(user: dict = Depends(get_current_user)):
    """Get user's current perks based on level"""
    level_data = await db.user_levels.find_one({"user_id": user["id"]}, {"_id": 0})
    current_level = level_data.get("current_level", "bronze") if level_data else "bronze"
    level_info = LEVELS.get(current_level, LEVELS["bronze"])
    
    return {
        "level": current_level,
        "perks": level_info.get("perks", {}),
        "perks_description": level_info.get("perks_de", [])
    }

# ==================== XP AWARDING FUNCTIONS ====================

async def award_xp(user_id: str, action: str, amount: int = None, description: str = None):
    """Award XP to a user for an action"""
    xp_amount = amount if amount is not None else XP_ACTIONS.get(action, 0)
    
    if xp_amount <= 0:
        return
    
    # Update user's XP
    result = await db.user_levels.find_one_and_update(
        {"user_id": user_id},
        {
            "$inc": {"current_xp": xp_amount},
            "$setOnInsert": {
                "id": str(uuid.uuid4()),
                "user_id": user_id,
                "current_level": "bronze",
                "level_history": [],
                "created_at": datetime.now(timezone.utc).isoformat()
            }
        },
        upsert=True,
        return_document=True
    )
    
    new_xp = result.get("current_xp", xp_amount) if result else xp_amount
    current_level = result.get("current_level", "bronze") if result else "bronze"
    
    # Log XP transaction
    await db.xp_transactions.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "action": action,
        "xp": xp_amount,
        "description": description or f"XP für {action}",
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    # Check for level up
    new_level = calculate_level(new_xp)
    if new_level != current_level:
        await handle_level_up(user_id, current_level, new_level, new_xp)
    
    logger.info(f"XP awarded: {user_id} +{xp_amount} XP for {action} (total: {new_xp})")
    return xp_amount

def calculate_level(xp: int) -> str:
    """Calculate level based on XP"""
    if xp >= LEVELS["diamond"]["min_xp"]:
        return "diamond"
    elif xp >= LEVELS["platinum"]["min_xp"]:
        return "platinum"
    elif xp >= LEVELS["gold"]["min_xp"]:
        return "gold"
    elif xp >= LEVELS["silver"]["min_xp"]:
        return "silver"
    else:
        return "bronze"

async def handle_level_up(user_id: str, old_level: str, new_level: str, current_xp: int):
    """Handle user level up"""
    new_level_info = LEVELS[new_level]
    
    # Update level in database
    await db.user_levels.update_one(
        {"user_id": user_id},
        {
            "$set": {"current_level": new_level},
            "$push": {
                "level_history": {
                    "from": old_level,
                    "to": new_level,
                    "xp": current_xp,
                    "date": datetime.now(timezone.utc).isoformat()
                }
            }
        }
    )
    
    # Send notification
    await db.notifications.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "type": "level_up",
        "title": f"{new_level_info['icon']} Level Up!",
        "message": f"Glückwunsch! Du bist jetzt {new_level_info['name_de']}-Mitglied! Entdecke deine neuen Vorteile.",
        "action_url": "/my-stats",
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    # Award bonus bids for leveling up
    bonus_bids = {
        "silver": 5,
        "gold": 15,
        "platinum": 30,
        "diamond": 50
    }.get(new_level, 0)
    
    if bonus_bids > 0:
        await db.users.update_one(
            {"id": user_id},
            {"$inc": {"bids_balance": bonus_bids}}
        )
        
        await db.notifications.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "type": "level_bonus",
            "title": "🎁 Level-Up Bonus!",
            "message": f"Du erhältst {bonus_bids} Gratis-Gebote für deinen Aufstieg zu {new_level_info['name_de']}!",
            "read": False,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
    
    logger.info(f"Level up: {user_id} {old_level} -> {new_level} (+{bonus_bids} bonus bids)")

async def get_user_perks(user_id: str) -> dict:
    """Get user's current perks (for use in other modules)"""
    level_data = await db.user_levels.find_one({"user_id": user_id}, {"_id": 0, "current_level": 1})
    current_level = level_data.get("current_level", "bronze") if level_data else "bronze"
    return LEVELS.get(current_level, LEVELS["bronze"]).get("perks", {})

# Export for use in other modules
__all__ = ['award_xp', 'get_user_perks', 'LEVELS', 'XP_ACTIONS']
