"""
BidBlitz V2 - Gamification System
Daily Challenges + Achievement/Badge System for user retention & engagement.

Features:
- 5 Daily Challenge types (Login, Auction Bid, Taxi, Referral, Mining)
- 15+ Achievement Badges (unlockable milestones)
- Auto-reset at midnight UTC
- Push + Email notifications on unlock
"""
import secrets
from datetime import datetime, timezone, timedelta
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from bson import ObjectId
import asyncio

from core.database import db
from core.security import get_current_user
from routes.web_push import send_push_to_user

router = APIRouter(prefix="/api/gamification", tags=["gamification"])


# ═══════════════════════════════════════════════════════════════
# DAILY CHALLENGES CONFIGURATION
# ═══════════════════════════════════════════════════════════════

DAILY_CHALLENGES = {
    "login_streak": {
        "id": "login_streak",
        "title": "Täglich einloggen",
        "description": "Logge dich heute ein",
        "reward_blz": 5,
        "reward_eur": 0,
        "icon": "🔥",
        "type": "auto",  # Auto-complete on login
    },
    "auction_bid": {
        "id": "auction_bid",
        "title": "An Auktion teilnehmen",
        "description": "Biete mindestens 1× auf eine Auktion",
        "reward_blz": 10,
        "reward_eur": 0,
        "icon": "🏆",
        "type": "manual",
        "target": 1,
    },
    "taxi_ride": {
        "id": "taxi_ride",
        "title": "Taxi nutzen",
        "description": "Buche eine Taxifahrt",
        "reward_blz": 15,
        "reward_eur": 0,
        "icon": "🚕",
        "type": "manual",
        "target": 1,
    },
    "referral": {
        "id": "referral",
        "title": "Freund einladen",
        "description": "Lade einen Freund über deinen Code ein",
        "reward_blz": 50,
        "reward_eur": 0,
        "icon": "👥",
        "type": "manual",
        "target": 1,
    },
    "mining": {
        "id": "mining",
        "title": "100 Taps im BlitzMine",
        "description": "Tippe 100× im BlitzMine",
        "reward_blz": 20,
        "reward_eur": 0,
        "icon": "⛏️",
        "type": "manual",
        "target": 100,
    },
}


# ═══════════════════════════════════════════════════════════════
# ACHIEVEMENTS CONFIGURATION
# ═══════════════════════════════════════════════════════════════

ACHIEVEMENTS = {
    # Auction Achievements
    "first_auction_win": {
        "id": "first_auction_win",
        "title": "Erste Auktion gewonnen",
        "description": "Gewinne deine erste Auktion",
        "reward_blz": 25,
        "icon": "🏆",
        "category": "auctions",
        "rarity": "common",
    },
    "auction_veteran": {
        "id": "auction_veteran",
        "title": "Auktions-Veteran",
        "description": "Gewinne 10 Auktionen",
        "reward_blz": 100,
        "icon": "👑",
        "category": "auctions",
        "rarity": "rare",
        "condition": {"type": "count", "field": "auctions_won", "value": 10},
    },
    
    # Wallet Achievements
    "wallet_loaded": {
        "id": "wallet_loaded",
        "title": "Wallet aufgeladen",
        "description": "Lade €100 ins Wallet",
        "reward_blz": 50,
        "icon": "💰",
        "category": "wallet",
        "rarity": "common",
        "condition": {"type": "total_topup", "value": 100},
    },
    "big_spender": {
        "id": "big_spender",
        "title": "Big Spender",
        "description": "Lade €1000 ins Wallet",
        "reward_blz": 200,
        "icon": "💎",
        "category": "wallet",
        "rarity": "epic",
        "condition": {"type": "total_topup", "value": 1000},
    },
    
    # Taxi Achievements
    "first_ride": {
        "id": "first_ride",
        "title": "Erste Taxifahrt",
        "description": "Absolviere deine erste Taxifahrt",
        "reward_blz": 20,
        "icon": "🚕",
        "category": "taxi",
        "rarity": "common",
    },
    "frequent_rider": {
        "id": "frequent_rider",
        "title": "Vielfahrer",
        "description": "Absolviere 10 Taxifahrten",
        "reward_blz": 100,
        "icon": "🚀",
        "category": "taxi",
        "rarity": "rare",
        "condition": {"type": "count", "field": "taxi_rides_completed", "value": 10},
    },
    
    # Social Achievements
    "first_friend": {
        "id": "first_friend",
        "title": "Sozialer Starter",
        "description": "Füge deinen ersten Freund hinzu",
        "reward_blz": 15,
        "icon": "👥",
        "category": "social",
        "rarity": "common",
    },
    "influencer": {
        "id": "influencer",
        "title": "Influencer",
        "description": "Lade 5 Freunde ein",
        "reward_blz": 150,
        "icon": "🌟",
        "category": "social",
        "rarity": "epic",
        "condition": {"type": "referrals", "value": 5},
    },
    
    # Mining Achievements
    "miner_novice": {
        "id": "miner_novice",
        "title": "Mining-Neuling",
        "description": "Mine 10.000 BLZ",
        "reward_blz": 50,
        "icon": "⛏️",
        "category": "mining",
        "rarity": "common",
        "condition": {"type": "total_mined", "value": 10000},
    },
    "miner_expert": {
        "id": "miner_expert",
        "title": "Mining-Experte",
        "description": "Mine 100.000 BLZ",
        "reward_blz": 500,
        "icon": "💎",
        "category": "mining",
        "rarity": "legendary",
        "condition": {"type": "total_mined", "value": 100000},
    },
    
    # Lottery Achievements
    "lottery_winner": {
        "id": "lottery_winner",
        "title": "Glückspilz",
        "description": "Gewinne in der Lotterie",
        "reward_blz": 100,
        "icon": "🎰",
        "category": "lottery",
        "rarity": "rare",
    },
    
    # Premium Achievements
    "premium_member": {
        "id": "premium_member",
        "title": "Premium-Member",
        "description": "Werde Premium-Mitglied",
        "reward_blz": 100,
        "icon": "👑",
        "category": "premium",
        "rarity": "rare",
    },
    
    # Streak Achievements
    "week_warrior": {
        "id": "week_warrior",
        "title": "Wochenkrieger",
        "description": "Logge dich 7 Tage in Folge ein",
        "reward_blz": 50,
        "icon": "🔥",
        "category": "streak",
        "rarity": "common",
        "condition": {"type": "login_streak", "value": 7},
    },
    "month_master": {
        "id": "month_master",
        "title": "Monatsmeister",
        "description": "Logge dich 30 Tage in Folge ein",
        "reward_blz": 300,
        "icon": "🏆",
        "category": "streak",
        "rarity": "legendary",
        "condition": {"type": "login_streak", "value": 30},
    },
    
    # Payment Achievements
    "first_payment": {
        "id": "first_payment",
        "title": "Erste Zahlung",
        "description": "Sende oder empfange deine erste Zahlung",
        "reward_blz": 10,
        "icon": "💸",
        "category": "payments",
        "rarity": "common",
    },
}


# ═══════════════════════════════════════════════════════════════
# DAILY CHALLENGES ENDPOINTS
# ═══════════════════════════════════════════════════════════════

@router.get("/challenges/today")
async def get_daily_challenges(request: Request):
    """Get today's daily challenges with completion status."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    # Get user's progress for today
    progress = await db.daily_challenge_progress.find_one({
        "user_id": user_id,
        "date": today_str,
    })
    
    if not progress:
        # Create fresh progress for today
        progress = {
            "user_id": user_id,
            "date": today_str,
            "challenges": {cid: {"completed": False, "progress": 0} for cid in DAILY_CHALLENGES.keys()},
            "total_rewards_blz": 0,
            "total_rewards_eur": 0,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.daily_challenge_progress.insert_one(progress)
    
    # Build response with full challenge data + progress
    challenges_data = []
    for cid, config in DAILY_CHALLENGES.items():
        user_progress = progress["challenges"].get(cid, {"completed": False, "progress": 0})
        challenges_data.append({
            **config,
            "completed": user_progress.get("completed", False),
            "progress": user_progress.get("progress", 0),
            "target": config.get("target", 1),
        })
    
    return {
        "date": today_str,
        "challenges": challenges_data,
        "total_rewards_earned_today": {
            "blz": progress.get("total_rewards_blz", 0),
            "eur": progress.get("total_rewards_eur", 0),
        },
        "all_completed": all(c["completed"] for c in challenges_data),
    }


@router.post("/challenges/complete/{challenge_id}")
async def complete_challenge(challenge_id: str, request: Request):
    """Manually complete a challenge (called by other routes)."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    if challenge_id not in DAILY_CHALLENGES:
        raise HTTPException(status_code=404, detail="Challenge not found")
    
    challenge = DAILY_CHALLENGES[challenge_id]
    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    # Get or create progress
    progress = await db.daily_challenge_progress.find_one({
        "user_id": user_id,
        "date": today_str,
    })
    
    if not progress:
        progress = {
            "user_id": user_id,
            "date": today_str,
            "challenges": {cid: {"completed": False, "progress": 0} for cid in DAILY_CHALLENGES.keys()},
            "total_rewards_blz": 0,
            "total_rewards_eur": 0,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.daily_challenge_progress.insert_one(progress)
    
    # Check if already completed
    if progress["challenges"].get(challenge_id, {}).get("completed"):
        return {"ok": False, "message": "Already completed today"}
    
    # Mark as completed
    await db.daily_challenge_progress.update_one(
        {"user_id": user_id, "date": today_str},
        {
            "$set": {
                f"challenges.{challenge_id}.completed": True,
                f"challenges.{challenge_id}.progress": challenge.get("target", 1),
                f"challenges.{challenge_id}.completed_at": datetime.now(timezone.utc).isoformat(),
            },
            "$inc": {
                "total_rewards_blz": challenge["reward_blz"],
                "total_rewards_eur": challenge["reward_eur"],
            },
        },
    )
    
    # Award rewards to user
    if challenge["reward_blz"] > 0:
        await db.users.update_one(
            {"_id": user["_id"]},
            {"$inc": {"balance_blz": challenge["reward_blz"]}},
        )
    if challenge["reward_eur"] > 0:
        await db.users.update_one(
            {"_id": user["_id"]},
            {"$inc": {"balance": challenge["reward_eur"]}},
        )
    
    # Send push notification
    try:
        asyncio.create_task(send_push_to_user(
            user_id,
            title=f"{challenge['icon']} Challenge abgeschlossen!",
            body=f"{challenge['title']} — +{challenge['reward_blz']} BLZ",
            data={"type": "challenge_complete", "challenge_id": challenge_id},
        ))
    except Exception:
        pass
    
    return {
        "ok": True,
        "challenge": challenge,
        "rewards": {
            "blz": challenge["reward_blz"],
            "eur": challenge["reward_eur"],
        },
    }


# Helper function for other routes to trigger challenge progress
async def track_challenge_progress(user_id: str, challenge_id: str, increment: int = 1):
    """
    Track progress for a challenge. Auto-complete when target reached.
    Call this from other routes (e.g., auctions.py, taxi.py, mining.py).
    """
    if challenge_id not in DAILY_CHALLENGES:
        return
    
    challenge = DAILY_CHALLENGES[challenge_id]
    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    # Get progress
    progress = await db.daily_challenge_progress.find_one({
        "user_id": user_id,
        "date": today_str,
    })
    
    if not progress:
        progress = {
            "user_id": user_id,
            "date": today_str,
            "challenges": {cid: {"completed": False, "progress": 0} for cid in DAILY_CHALLENGES.keys()},
            "total_rewards_blz": 0,
            "total_rewards_eur": 0,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.daily_challenge_progress.insert_one(progress)
    
    # Check if already completed
    if progress["challenges"].get(challenge_id, {}).get("completed"):
        return
    
    # Update progress
    current_progress = progress["challenges"].get(challenge_id, {}).get("progress", 0)
    new_progress = current_progress + increment
    target = challenge.get("target", 1)
    
    if new_progress >= target:
        # Auto-complete
        await db.daily_challenge_progress.update_one(
            {"user_id": user_id, "date": today_str},
            {
                "$set": {
                    f"challenges.{challenge_id}.completed": True,
                    f"challenges.{challenge_id}.progress": target,
                    f"challenges.{challenge_id}.completed_at": datetime.now(timezone.utc).isoformat(),
                },
                "$inc": {
                    "total_rewards_blz": challenge["reward_blz"],
                    "total_rewards_eur": challenge["reward_eur"],
                },
            },
        )
        
        # Award rewards
        if challenge["reward_blz"] > 0:
            await db.users.update_one(
                {"_id": ObjectId(user_id)},
                {"$inc": {"balance_blz": challenge["reward_blz"]}},
            )
        if challenge["reward_eur"] > 0:
            await db.users.update_one(
                {"_id": ObjectId(user_id)},
                {"$inc": {"balance": challenge["reward_eur"]}},
            )
        
        # Send push notification
        try:
            asyncio.create_task(send_push_to_user(
                user_id,
                title=f"{challenge['icon']} Challenge abgeschlossen!",
                body=f"{challenge['title']} — +{challenge['reward_blz']} BLZ",
                data={"type": "challenge_complete", "challenge_id": challenge_id},
            ))
        except Exception:
            pass
    else:
        # Just update progress
        await db.daily_challenge_progress.update_one(
            {"user_id": user_id, "date": today_str},
            {"$set": {f"challenges.{challenge_id}.progress": new_progress}},
        )


# ═══════════════════════════════════════════════════════════════
# ACHIEVEMENTS ENDPOINTS
# ═══════════════════════════════════════════════════════════════

@router.get("/achievements")
async def get_achievements(request: Request):
    """Get all achievements with unlock status."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    # Get user's unlocked achievements
    unlocked = await db.user_achievements.find(
        {"user_id": user_id},
        {"_id": 0},
    ).to_list(100)
    
    unlocked_ids = {a["achievement_id"] for a in unlocked}
    
    # Build response
    achievements_data = []
    for aid, config in ACHIEVEMENTS.items():
        achievements_data.append({
            **config,
            "unlocked": aid in unlocked_ids,
            "unlocked_at": next((a["unlocked_at"] for a in unlocked if a["achievement_id"] == aid), None),
        })
    
    # Sort: unlocked first, then by rarity
    rarity_order = {"legendary": 0, "epic": 1, "rare": 2, "common": 3}
    achievements_data.sort(key=lambda x: (not x["unlocked"], rarity_order.get(x.get("rarity", "common"), 99)))
    
    total_unlocked = len(unlocked_ids)
    total_achievements = len(ACHIEVEMENTS)
    total_rewards_earned = sum(a["reward_blz"] for a in unlocked)
    
    return {
        "achievements": achievements_data,
        "stats": {
            "total_unlocked": total_unlocked,
            "total_available": total_achievements,
            "completion_pct": round((total_unlocked / total_achievements) * 100, 1) if total_achievements > 0 else 0,
            "total_rewards_earned_blz": total_rewards_earned,
        },
    }


@router.post("/achievements/unlock/{achievement_id}")
async def unlock_achievement(achievement_id: str, request: Request):
    """Manually unlock an achievement (called by other routes)."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    if achievement_id not in ACHIEVEMENTS:
        raise HTTPException(status_code=404, detail="Achievement not found")
    
    achievement = ACHIEVEMENTS[achievement_id]
    
    # Check if already unlocked
    existing = await db.user_achievements.find_one({
        "user_id": user_id,
        "achievement_id": achievement_id,
    })
    
    if existing:
        return {"ok": False, "message": "Already unlocked"}
    
    # Unlock achievement
    now = datetime.now(timezone.utc).isoformat()
    await db.user_achievements.insert_one({
        "user_id": user_id,
        "achievement_id": achievement_id,
        "unlocked_at": now,
    })
    
    # Award reward
    if achievement["reward_blz"] > 0:
        await db.users.update_one(
            {"_id": user["_id"]},
            {"$inc": {"balance_blz": achievement["reward_blz"]}},
        )
    
    # Send push notification
    try:
        asyncio.create_task(send_push_to_user(
            user_id,
            title=f"{achievement['icon']} Achievement freigeschaltet!",
            body=f"{achievement['title']} — +{achievement['reward_blz']} BLZ",
            data={"type": "achievement_unlock", "achievement_id": achievement_id},
        ))
    except Exception:
        pass
    
    return {
        "ok": True,
        "achievement": achievement,
        "reward_blz": achievement["reward_blz"],
    }


# Helper function for other routes to trigger achievement checks
async def check_and_unlock_achievement(user_id: str, achievement_id: str):
    """
    Check and unlock an achievement if not already unlocked.
    Call this from other routes when a milestone is reached.
    """
    if achievement_id not in ACHIEVEMENTS:
        return False
    
    # Check if already unlocked
    existing = await db.user_achievements.find_one({
        "user_id": user_id,
        "achievement_id": achievement_id,
    })
    
    if existing:
        return False
    
    achievement = ACHIEVEMENTS[achievement_id]
    
    # Unlock
    now = datetime.now(timezone.utc).isoformat()
    await db.user_achievements.insert_one({
        "user_id": user_id,
        "achievement_id": achievement_id,
        "unlocked_at": now,
    })
    
    # Award reward
    if achievement["reward_blz"] > 0:
        await db.users.update_one(
            {"_id": ObjectId(user_id)},
            {"$inc": {"balance_blz": achievement["reward_blz"]}},
        )
    
    # Send push notification
    try:
        asyncio.create_task(send_push_to_user(
            user_id,
            title=f"{achievement['icon']} Achievement freigeschaltet!",
            body=f"{achievement['title']} — +{achievement['reward_blz']} BLZ",
            data={"type": "achievement_unlock", "achievement_id": achievement_id},
        ))
    except Exception:
        pass
    
    return True


# ═══════════════════════════════════════════════════════════════
# STATS & LEADERBOARD
# ═══════════════════════════════════════════════════════════════

@router.get("/stats")
async def get_gamification_stats(request: Request):
    """Get user's overall gamification statistics."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    # Achievements stats
    total_achievements = await db.user_achievements.count_documents({"user_id": user_id})
    total_rewards = 0
    achievements = await db.user_achievements.find({"user_id": user_id}).to_list(100)
    for ach in achievements:
        aid = ach.get("achievement_id")
        if aid in ACHIEVEMENTS:
            total_rewards += ACHIEVEMENTS[aid]["reward_blz"]
    
    # Daily challenges stats (last 30 days)
    thirty_days_ago = (datetime.now(timezone.utc) - timedelta(days=30)).strftime("%Y-%m-%d")
    challenge_history = await db.daily_challenge_progress.find({
        "user_id": user_id,
        "date": {"$gte": thirty_days_ago},
    }).to_list(30)
    
    days_completed = sum(1 for day in challenge_history 
                        if all(c.get("completed", False) for c in day["challenges"].values()))
    
    total_challenge_rewards = sum(day.get("total_rewards_blz", 0) for day in challenge_history)
    
    return {
        "achievements": {
            "total_unlocked": total_achievements,
            "total_available": len(ACHIEVEMENTS),
            "total_rewards_blz": total_rewards,
        },
        "challenges": {
            "days_all_completed_last_30": days_completed,
            "total_rewards_blz_last_30": total_challenge_rewards,
        },
        "total_gamification_rewards_blz": total_rewards + total_challenge_rewards,
    }
