"""Gamification Router - Happy Hour, Streak Bonuses, Enhanced Achievements"""
from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime, timedelta, timezone
from typing import Optional
import uuid
from config import db, logger
from dependencies import get_current_user, get_admin_user

router = APIRouter(prefix="/gamification", tags=["gamification"])

# ==================== HAPPY HOUR CONFIGURATION ====================

# Default Happy Hour times (Berlin timezone = UTC+1)
HAPPY_HOUR_DEFAULT = {
    "enabled": True,
    "start_hour": 18,  # 18:00
    "end_hour": 20,    # 20:00
    "multiplier": 2.0,  # 2x bids
    "days": [0, 1, 2, 3, 4, 5, 6]  # All days (0=Monday)
}


async def get_happy_hour_config():
    """Get current happy hour configuration from DB or default"""
    config = await db.settings.find_one({"key": "happy_hour"}, {"_id": 0})
    if config:
        return config.get("value", HAPPY_HOUR_DEFAULT)
    return HAPPY_HOUR_DEFAULT


def is_happy_hour_active(config: dict) -> dict:
    """Check if happy hour is currently active"""
    if not config.get("enabled", False):
        return {"active": False, "reason": "disabled"}
    
    # Get Berlin time (UTC+1)
    now_utc = datetime.now(timezone.utc)
    berlin_offset = timedelta(hours=1)
    now_berlin = now_utc + berlin_offset
    
    current_hour = now_berlin.hour
    current_day = now_berlin.weekday()
    
    # Check if today is a happy hour day
    if current_day not in config.get("days", []):
        return {"active": False, "reason": "not_today"}
    
    # Check time range
    start_hour = config.get("start_hour", 18)
    end_hour = config.get("end_hour", 20)
    
    if start_hour <= current_hour < end_hour:
        # Calculate time remaining
        end_time = now_berlin.replace(hour=end_hour, minute=0, second=0, microsecond=0)
        remaining_seconds = int((end_time - now_berlin).total_seconds())
        
        return {
            "active": True,
            "multiplier": config.get("multiplier", 2.0),
            "end_time": end_time.isoformat(),
            "remaining_seconds": remaining_seconds,
            "message": f"🎉 HAPPY HOUR! {int(config.get('multiplier', 2))}x Gebote bei jedem Kauf!"
        }
    
    # Calculate next happy hour
    if current_hour < start_hour:
        # Today
        next_start = now_berlin.replace(hour=start_hour, minute=0, second=0, microsecond=0)
    else:
        # Tomorrow or next available day
        days_ahead = 1
        for i in range(1, 8):
            next_day = (current_day + i) % 7
            if next_day in config.get("days", []):
                days_ahead = i
                break
        next_start = now_berlin.replace(hour=start_hour, minute=0, second=0, microsecond=0) + timedelta(days=days_ahead)
    
    return {
        "active": False,
        "next_start": next_start.isoformat(),
        "starts_in_seconds": int((next_start - now_berlin).total_seconds())
    }


@router.get("/happy-hour")
async def get_happy_hour_status():
    """Get current happy hour status"""
    config = await get_happy_hour_config()
    status = is_happy_hour_active(config)
    
    return {
        "config": {
            "enabled": config.get("enabled", False),
            "start_hour": config.get("start_hour", 18),
            "end_hour": config.get("end_hour", 20),
            "multiplier": config.get("multiplier", 2.0)
        },
        "status": status
    }


@router.put("/happy-hour/config")
async def update_happy_hour_config(
    enabled: Optional[bool] = None,
    start_hour: Optional[int] = None,
    end_hour: Optional[int] = None,
    multiplier: Optional[float] = None,
    days: Optional[list] = None,
    admin: dict = Depends(get_admin_user)
):
    """Update happy hour configuration (Admin only)"""
    config = await get_happy_hour_config()
    
    if enabled is not None:
        config["enabled"] = enabled
    if start_hour is not None:
        config["start_hour"] = max(0, min(23, start_hour))
    if end_hour is not None:
        config["end_hour"] = max(1, min(24, end_hour))
    if multiplier is not None:
        config["multiplier"] = max(1.0, min(5.0, multiplier))
    if days is not None:
        config["days"] = [d for d in days if 0 <= d <= 6]
    
    await db.settings.update_one(
        {"key": "happy_hour"},
        {"$set": {"key": "happy_hour", "value": config}},
        upsert=True
    )
    
    logger.info(f"Happy Hour config updated: {config}")
    return {"message": "Happy Hour Einstellungen aktualisiert", "config": config}


# ==================== BIDDING STREAK SYSTEM ====================

STREAK_REWARDS = {
    5: {"bids": 1, "message": "🔥 5er Streak! +1 Gratis-Gebot!"},
    10: {"bids": 3, "message": "🔥🔥 10er Streak! +3 Gratis-Gebote!"},
    15: {"bids": 5, "message": "🔥🔥🔥 15er Streak! +5 Gratis-Gebote!"},
    25: {"bids": 10, "message": "💎 25er MEGA-Streak! +10 Gratis-Gebote!"},
    50: {"bids": 25, "message": "👑 50er LEGENDARY Streak! +25 Gratis-Gebote!"}
}


async def check_and_award_streak(user_id: str, auction_id: str) -> dict:
    """
    Check user's consecutive bids on an auction and award streak bonuses.
    Returns the reward info if a milestone is reached.
    """
    # Get bid history for this user on this auction
    auction = await db.auctions.find_one({"id": auction_id}, {"_id": 0, "bid_history": 1})
    if not auction:
        return None
    
    bid_history = auction.get("bid_history", [])
    
    # Count consecutive bids from the end
    consecutive_count = 0
    for bid in reversed(bid_history):
        if bid.get("user_id") == user_id:
            consecutive_count += 1
        else:
            break  # Streak broken by another user
    
    # Check if we hit a milestone
    if consecutive_count in STREAK_REWARDS:
        reward = STREAK_REWARDS[consecutive_count]
        
        # Check if already awarded for this streak on this auction
        existing_reward = await db.streak_rewards.find_one({
            "user_id": user_id,
            "auction_id": auction_id,
            "streak_count": consecutive_count
        })
        
        if not existing_reward:
            # Award the bids
            await db.users.update_one(
                {"id": user_id},
                {"$inc": {"bids_balance": reward["bids"]}}
            )
            
            # Record the reward
            await db.streak_rewards.insert_one({
                "id": str(uuid.uuid4()),
                "user_id": user_id,
                "auction_id": auction_id,
                "streak_count": consecutive_count,
                "bids_awarded": reward["bids"],
                "awarded_at": datetime.now(timezone.utc).isoformat()
            })
            
            logger.info(f"🔥 Streak reward: User {user_id} got {reward['bids']} bids for {consecutive_count} streak!")
            
            return {
                "streak_count": consecutive_count,
                "bids_awarded": reward["bids"],
                "message": reward["message"]
            }
    
    return None


@router.get("/streak/{auction_id}")
async def get_user_streak(auction_id: str, user: dict = Depends(get_current_user)):
    """Get user's current streak on an auction"""
    auction = await db.auctions.find_one({"id": auction_id}, {"_id": 0, "bid_history": 1})
    if not auction:
        raise HTTPException(status_code=404, detail="Auktion nicht gefunden")
    
    bid_history = auction.get("bid_history", [])
    
    # Count consecutive bids from the end
    consecutive_count = 0
    for bid in reversed(bid_history):
        if bid.get("user_id") == user["id"]:
            consecutive_count += 1
        else:
            break
    
    # Next milestone
    next_milestone = None
    for milestone in sorted(STREAK_REWARDS.keys()):
        if milestone > consecutive_count:
            next_milestone = milestone
            break
    
    return {
        "current_streak": consecutive_count,
        "next_milestone": next_milestone,
        "bids_until_next": next_milestone - consecutive_count if next_milestone else None,
        "milestones": STREAK_REWARDS
    }


# ==================== ENHANCED ACHIEVEMENTS SYSTEM ====================

ACHIEVEMENTS = {
    "first_bid": {
        "name": "Erste Schritte",
        "description": "Erstes Gebot platziert",
        "icon": "🎯",
        "reward_bids": 5,
        "category": "beginner"
    },
    "first_win": {
        "name": "Gewinner!",
        "description": "Erste Auktion gewonnen",
        "icon": "🏆",
        "reward_bids": 10,
        "category": "wins"
    },
    "ten_wins": {
        "name": "Sammler",
        "description": "10 Auktionen gewonnen",
        "icon": "🎁",
        "reward_bids": 25,
        "category": "wins"
    },
    "fifty_wins": {
        "name": "Profi-Bieter",
        "description": "50 Auktionen gewonnen",
        "icon": "💎",
        "reward_bids": 100,
        "category": "wins"
    },
    "hundred_bids": {
        "name": "Fleißiger Bieter",
        "description": "100 Gebote platziert",
        "icon": "⚡",
        "reward_bids": 15,
        "category": "activity"
    },
    "thousand_bids": {
        "name": "Auktions-Veteran",
        "description": "1000 Gebote platziert",
        "icon": "🌟",
        "reward_bids": 50,
        "category": "activity"
    },
    "first_buy_now": {
        "name": "Sofortkäufer",
        "description": "Ersten Artikel mit Sofortkauf erworben",
        "icon": "🛒",
        "reward_bids": 5,
        "category": "shopping"
    },
    "vip_member": {
        "name": "VIP Status",
        "description": "VIP-Mitglied geworden",
        "icon": "👑",
        "reward_bids": 20,
        "category": "status"
    },
    "wheel_jackpot": {
        "name": "Jackpot!",
        "description": "10 Gebote am Glücksrad gewonnen",
        "icon": "🎰",
        "reward_bids": 0,  # Already awarded by wheel
        "category": "luck"
    },
    "streak_master": {
        "name": "Streak-Meister",
        "description": "25er Bieter-Streak erreicht",
        "icon": "🔥",
        "reward_bids": 0,  # Already awarded by streak
        "category": "skill"
    },
    "night_owl": {
        "name": "Nachteule",
        "description": "10 Nachtauktionen gewonnen",
        "icon": "🌙",
        "reward_bids": 15,
        "category": "special"
    },
    "savings_100": {
        "name": "Sparfuchs",
        "description": "100€ gespart (UVP vs. Kaufpreis)",
        "icon": "💰",
        "reward_bids": 20,
        "category": "savings"
    },
    "savings_500": {
        "name": "Schnäppchenjäger",
        "description": "500€ gespart",
        "icon": "💵",
        "reward_bids": 50,
        "category": "savings"
    },
    "referral_first": {
        "name": "Botschafter",
        "description": "Ersten Freund geworben",
        "icon": "🤝",
        "reward_bids": 10,
        "category": "social"
    },
    "daily_login_7": {
        "name": "Stammkunde",
        "description": "7 Tage hintereinander eingeloggt",
        "icon": "📅",
        "reward_bids": 10,
        "category": "loyalty"
    }
}


async def grant_achievement_with_reward(user_id: str, achievement_id: str) -> dict:
    """Grant an achievement and its reward to a user"""
    if achievement_id not in ACHIEVEMENTS:
        return None
    
    # Check if already earned
    existing = await db.achievements.find_one({
        "user_id": user_id,
        "achievement_id": achievement_id
    })
    
    if existing:
        return None  # Already has this achievement
    
    achievement = ACHIEVEMENTS[achievement_id]
    
    # Grant achievement
    await db.achievements.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "achievement_id": achievement_id,
        "name": achievement["name"],
        "description": achievement["description"],
        "icon": achievement["icon"],
        "reward_bids": achievement["reward_bids"],
        "category": achievement["category"],
        "earned_at": datetime.now(timezone.utc).isoformat()
    })
    
    # Award bids if any
    if achievement["reward_bids"] > 0:
        await db.users.update_one(
            {"id": user_id},
            {"$inc": {"bids_balance": achievement["reward_bids"]}}
        )
        
        # Create notification
        await db.notifications.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "type": "achievement",
            "title": f"{achievement['icon']} Achievement freigeschaltet!",
            "message": f"{achievement['name']}: {achievement['description']} (+{achievement['reward_bids']} Gebote)",
            "read": False,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
    
    logger.info(f"🏅 Achievement '{achievement_id}' granted to user {user_id} (+{achievement['reward_bids']} bids)")
    
    return {
        "achievement_id": achievement_id,
        "name": achievement["name"],
        "description": achievement["description"],
        "icon": achievement["icon"],
        "reward_bids": achievement["reward_bids"]
    }


@router.get("/achievements")
async def get_all_achievements(user: dict = Depends(get_current_user)):
    """Get all achievements and user's progress"""
    user_id = user["id"]
    
    # Get user's earned achievements
    earned = await db.achievements.find(
        {"user_id": user_id},
        {"_id": 0}
    ).to_list(100)
    
    earned_ids = set(a["achievement_id"] for a in earned)
    
    # Build response with all achievements
    all_achievements = []
    for aid, achievement in ACHIEVEMENTS.items():
        all_achievements.append({
            "id": aid,
            **achievement,
            "earned": aid in earned_ids,
            "earned_at": next((a["earned_at"] for a in earned if a["achievement_id"] == aid), None)
        })
    
    # Group by category
    by_category = {}
    for a in all_achievements:
        cat = a["category"]
        if cat not in by_category:
            by_category[cat] = []
        by_category[cat].append(a)
    
    # Stats
    total = len(ACHIEVEMENTS)
    earned_count = len(earned_ids)
    total_reward_bids = sum(a.get("reward_bids", 0) for a in earned)
    
    return {
        "achievements": all_achievements,
        "by_category": by_category,
        "stats": {
            "total": total,
            "earned": earned_count,
            "progress_percent": round((earned_count / total) * 100),
            "total_bids_earned": total_reward_bids
        }
    }


@router.post("/achievements/check")
async def check_achievements(user: dict = Depends(get_current_user)):
    """Check and grant any newly earned achievements"""
    user_id = user["id"]
    user_data = await db.users.find_one({"id": user_id}, {"_id": 0})
    
    newly_earned = []
    
    # Check bid count achievements
    total_bids = user_data.get("total_bids_placed", 0)
    if total_bids >= 1:
        result = await grant_achievement_with_reward(user_id, "first_bid")
        if result:
            newly_earned.append(result)
    if total_bids >= 100:
        result = await grant_achievement_with_reward(user_id, "hundred_bids")
        if result:
            newly_earned.append(result)
    if total_bids >= 1000:
        result = await grant_achievement_with_reward(user_id, "thousand_bids")
        if result:
            newly_earned.append(result)
    
    # Check win count achievements
    won_auctions = user_data.get("won_auctions", [])
    win_count = len(won_auctions) if isinstance(won_auctions, list) else 0
    
    if win_count >= 1:
        result = await grant_achievement_with_reward(user_id, "first_win")
        if result:
            newly_earned.append(result)
    if win_count >= 10:
        result = await grant_achievement_with_reward(user_id, "ten_wins")
        if result:
            newly_earned.append(result)
    if win_count >= 50:
        result = await grant_achievement_with_reward(user_id, "fifty_wins")
        if result:
            newly_earned.append(result)
    
    # Check VIP status
    vip_sub = await db.vip_subscriptions.find_one({"user_id": user_id, "status": "active"})
    if vip_sub:
        result = await grant_achievement_with_reward(user_id, "vip_member")
        if result:
            newly_earned.append(result)
    
    return {
        "checked": True,
        "newly_earned": newly_earned,
        "message": f"{len(newly_earned)} neue Achievements freigeschaltet!" if newly_earned else "Keine neuen Achievements"
    }


# ==================== BEGINNER PROTECTION SYSTEM ====================

@router.get("/beginner-status")
async def get_beginner_status(user: dict = Depends(get_current_user)):
    """Check if user qualifies for beginner-only auctions"""
    user_id = user["id"]
    user_data = await db.users.find_one({"id": user_id}, {"_id": 0})
    
    won_auctions = user_data.get("won_auctions", [])
    win_count = len(won_auctions) if isinstance(won_auctions, list) else 0
    
    # Registration date
    created_at = user_data.get("created_at", "")
    try:
        reg_date = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
        days_since_registration = (datetime.now(timezone.utc) - reg_date).days
    except:
        days_since_registration = 999
    
    # Beginner criteria: Less than 10 wins OR registered within 7 days
    is_beginner = win_count < 10 or days_since_registration <= 7
    
    # Get available beginner auctions
    beginner_auctions = await db.auctions.find({
        "status": "active",
        "is_beginner_only": True
    }, {"_id": 0, "id": 1, "product_id": 1}).to_list(50)
    
    return {
        "is_beginner": is_beginner,
        "wins": win_count,
        "days_since_registration": days_since_registration,
        "beginner_auctions_available": len(beginner_auctions),
        "criteria": {
            "max_wins": 10,
            "max_days": 7
        },
        "message": "Du kannst an Anfänger-Auktionen teilnehmen!" if is_beginner else "Du bist kein Anfänger mehr (10+ Gewinne)"
    }


@router.get("/auctions/beginner")
async def get_beginner_auctions(user: dict = Depends(get_current_user)):
    """Get beginner-only auctions"""
    user_id = user["id"]
    user_data = await db.users.find_one({"id": user_id}, {"_id": 0})
    
    won_auctions = user_data.get("won_auctions", [])
    win_count = len(won_auctions) if isinstance(won_auctions, list) else 0
    
    if win_count >= 10:
        raise HTTPException(
            status_code=403,
            detail="Anfänger-Auktionen sind nur für Nutzer mit weniger als 10 Gewinnen verfügbar."
        )
    
    auctions = await db.auctions.find({
        "status": "active",
        "is_beginner_only": True
    }, {"_id": 0}).to_list(50)
    
    # Enrich with product info
    for auction in auctions:
        product = await db.products.find_one({"id": auction.get("product_id")}, {"_id": 0})
        if product:
            auction["product"] = product
    
    return {"auctions": auctions, "count": len(auctions)}


# Export helpers for use in other modules
__all__ = [
    'get_happy_hour_config', 
    'is_happy_hour_active', 
    'check_and_award_streak',
    'grant_achievement_with_reward',
    'ACHIEVEMENTS',
    'STREAK_REWARDS'
]
