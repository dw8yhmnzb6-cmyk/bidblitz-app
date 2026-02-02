"""Weekly Challenges Router - Gamification challenges with rewards"""
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone, timedelta
from typing import Optional, List
import uuid

from config import db, logger
from dependencies import get_current_user, get_admin_user

router = APIRouter(prefix="/challenges", tags=["challenges"])

# ==================== CHALLENGE DEFINITIONS ====================

CHALLENGE_TEMPLATES = {
    "win_3_auctions": {
        "id": "win_3_auctions",
        "name": "Gewinner-Woche",
        "description": "Gewinne 3 Auktionen diese Woche",
        "icon": "🏆",
        "goal": 3,
        "reward_bids": 50,
        "type": "wins",
        "difficulty": "medium"
    },
    "place_50_bids": {
        "id": "place_50_bids",
        "name": "Bieter-Marathon",
        "description": "Platziere 50 Gebote diese Woche",
        "icon": "⚡",
        "goal": 50,
        "reward_bids": 25,
        "type": "bids",
        "difficulty": "easy"
    },
    "win_vip_auction": {
        "id": "win_vip_auction",
        "name": "VIP-Jäger",
        "description": "Gewinne eine VIP-Auktion",
        "icon": "👑",
        "goal": 1,
        "reward_bids": 30,
        "type": "vip_wins",
        "difficulty": "medium"
    },
    "login_streak_7": {
        "id": "login_streak_7",
        "name": "Treuer Besucher",
        "description": "Logge dich 7 Tage hintereinander ein",
        "icon": "📅",
        "goal": 7,
        "reward_bids": 20,
        "type": "login_streak",
        "difficulty": "easy"
    },
    "refer_friend": {
        "id": "refer_friend",
        "name": "Freunde-Finder",
        "description": "Werbe einen Freund der kauft",
        "icon": "👥",
        "goal": 1,
        "reward_bids": 40,
        "type": "referrals",
        "difficulty": "medium"
    },
    "spend_100_bids": {
        "id": "spend_100_bids",
        "name": "Großbieter",
        "description": "Verwende 100 Gebote diese Woche",
        "icon": "🔥",
        "goal": 100,
        "reward_bids": 35,
        "type": "bids_spent",
        "difficulty": "hard"
    },
    "win_under_5_euro": {
        "id": "win_under_5_euro",
        "name": "Schnäppchen-König",
        "description": "Gewinne eine Auktion unter €5",
        "icon": "💰",
        "goal": 1,
        "reward_bids": 25,
        "type": "cheap_wins",
        "difficulty": "medium"
    },
    "first_bid_of_day": {
        "id": "first_bid_of_day",
        "name": "Frühaufsteher",
        "description": "Sei 5x der erste Bieter des Tages",
        "icon": "🌅",
        "goal": 5,
        "reward_bids": 30,
        "type": "first_bids",
        "difficulty": "hard"
    }
}


def get_week_bounds():
    """Get start and end of current week (Monday to Sunday)"""
    now = datetime.now(timezone.utc)
    week_start = now - timedelta(days=now.weekday())
    week_start = week_start.replace(hour=0, minute=0, second=0, microsecond=0)
    week_end = week_start + timedelta(days=7)
    return week_start, week_end


# ==================== USER ENDPOINTS ====================

@router.get("/active")
async def get_active_challenges(user: dict = Depends(get_current_user)):
    """Get this week's active challenges for the user"""
    user_id = user["id"]
    week_start, week_end = get_week_bounds()
    
    # Get or create user's weekly challenges
    user_challenges = await db.user_challenges.find_one({
        "user_id": user_id,
        "week_start": week_start.isoformat()
    })
    
    if not user_challenges:
        # Assign 3 random challenges for this week
        import random
        selected = random.sample(list(CHALLENGE_TEMPLATES.keys()), min(3, len(CHALLENGE_TEMPLATES)))
        
        challenges = []
        for challenge_id in selected:
            template = CHALLENGE_TEMPLATES[challenge_id]
            challenges.append({
                "challenge_id": challenge_id,
                "name": template["name"],
                "description": template["description"],
                "icon": template["icon"],
                "goal": template["goal"],
                "progress": 0,
                "reward_bids": template["reward_bids"],
                "type": template["type"],
                "difficulty": template["difficulty"],
                "completed": False,
                "claimed": False
            })
        
        user_challenges = {
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "week_start": week_start.isoformat(),
            "week_end": week_end.isoformat(),
            "challenges": challenges,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.user_challenges.insert_one(user_challenges)
    
    # Update progress for each challenge
    challenges = user_challenges.get("challenges", [])
    for challenge in challenges:
        if not challenge.get("completed"):
            progress = await calculate_challenge_progress(user_id, challenge, week_start, week_end)
            challenge["progress"] = progress
            if progress >= challenge["goal"]:
                challenge["completed"] = True
    
    # Save updated progress
    await db.user_challenges.update_one(
        {"id": user_challenges["id"]},
        {"$set": {"challenges": challenges}}
    )
    
    return {
        "week_start": week_start.isoformat(),
        "week_end": week_end.isoformat(),
        "challenges": challenges,
        "days_remaining": (week_end - datetime.now(timezone.utc)).days
    }


async def calculate_challenge_progress(user_id: str, challenge: dict, week_start: datetime, week_end: datetime) -> int:
    """Calculate progress for a specific challenge"""
    challenge_type = challenge.get("type")
    
    if challenge_type == "wins":
        # Count auction wins this week
        wins = await db.auctions.count_documents({
            "winner_id": user_id,
            "end_time": {"$gte": week_start.isoformat(), "$lt": week_end.isoformat()}
        })
        return wins
    
    elif challenge_type == "bids" or challenge_type == "bids_spent":
        # Count bids placed this week
        pipeline = [
            {"$match": {"id": {"$exists": True}}},
            {"$unwind": "$bid_history"},
            {"$match": {
                "bid_history.user_id": user_id,
                "bid_history.timestamp": {"$gte": week_start.isoformat(), "$lt": week_end.isoformat()}
            }},
            {"$count": "total"}
        ]
        result = await db.auctions.aggregate(pipeline).to_list(1)
        return result[0]["total"] if result else 0
    
    elif challenge_type == "vip_wins":
        # Count VIP auction wins
        wins = await db.auctions.count_documents({
            "winner_id": user_id,
            "is_vip_only": True,
            "end_time": {"$gte": week_start.isoformat(), "$lt": week_end.isoformat()}
        })
        return wins
    
    elif challenge_type == "login_streak":
        # Get login streak
        user_data = await db.users.find_one({"id": user_id}, {"_id": 0, "login_streak": 1})
        return user_data.get("login_streak", 0) if user_data else 0
    
    elif challenge_type == "referrals":
        # Count successful referrals this week
        refs = await db.referrals.count_documents({
            "referrer_id": user_id,
            "has_purchased": True,
            "rewarded_at": {"$gte": week_start.isoformat(), "$lt": week_end.isoformat()}
        })
        return refs
    
    elif challenge_type == "cheap_wins":
        # Count wins under €5
        wins = await db.auctions.count_documents({
            "winner_id": user_id,
            "current_price": {"$lt": 5.0},
            "end_time": {"$gte": week_start.isoformat(), "$lt": week_end.isoformat()}
        })
        return wins
    
    return 0


@router.post("/claim/{challenge_id}")
async def claim_challenge_reward(challenge_id: str, user: dict = Depends(get_current_user)):
    """Claim reward for a completed challenge"""
    user_id = user["id"]
    week_start, _ = get_week_bounds()
    
    user_challenges = await db.user_challenges.find_one({
        "user_id": user_id,
        "week_start": week_start.isoformat()
    })
    
    if not user_challenges:
        raise HTTPException(status_code=404, detail="Keine Challenges gefunden")
    
    challenges = user_challenges.get("challenges", [])
    target_challenge = None
    
    for i, challenge in enumerate(challenges):
        if challenge["challenge_id"] == challenge_id:
            target_challenge = challenge
            challenge_index = i
            break
    
    if not target_challenge:
        raise HTTPException(status_code=404, detail="Challenge nicht gefunden")
    
    if not target_challenge.get("completed"):
        raise HTTPException(status_code=400, detail="Challenge noch nicht abgeschlossen")
    
    if target_challenge.get("claimed"):
        raise HTTPException(status_code=400, detail="Belohnung bereits abgeholt")
    
    # Award bids
    reward_bids = target_challenge.get("reward_bids", 0)
    await db.users.update_one(
        {"id": user_id},
        {"$inc": {"bids_balance": reward_bids}}
    )
    
    # Mark as claimed
    challenges[challenge_index]["claimed"] = True
    await db.user_challenges.update_one(
        {"id": user_challenges["id"]},
        {"$set": {"challenges": challenges}}
    )
    
    # Create notification
    await db.notifications.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "type": "challenge_complete",
        "title": f"{target_challenge['icon']} Challenge abgeschlossen!",
        "message": f"{target_challenge['name']}: +{reward_bids} Gratis-Gebote!",
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    logger.info(f"Challenge claimed: {user_id} completed '{challenge_id}' for {reward_bids} bids")
    
    return {
        "message": f"🎉 {reward_bids} Gebote gutgeschrieben!",
        "bids_awarded": reward_bids,
        "challenge": target_challenge
    }


@router.get("/history")
async def get_challenge_history(user: dict = Depends(get_current_user)):
    """Get user's challenge history"""
    user_id = user["id"]
    
    history = await db.user_challenges.find(
        {"user_id": user_id},
        {"_id": 0}
    ).sort("week_start", -1).limit(10).to_list(10)
    
    return {"history": history}


# ==================== ADMIN ENDPOINTS ====================

@router.get("/admin/stats")
async def get_challenge_stats(admin: dict = Depends(get_admin_user)):
    """Get challenge system statistics"""
    week_start, _ = get_week_bounds()
    
    # Count active participants
    active_users = await db.user_challenges.count_documents({
        "week_start": week_start.isoformat()
    })
    
    # Count completed challenges
    pipeline = [
        {"$match": {"week_start": week_start.isoformat()}},
        {"$unwind": "$challenges"},
        {"$match": {"challenges.completed": True}},
        {"$count": "completed"}
    ]
    completed = await db.user_challenges.aggregate(pipeline).to_list(1)
    completed_count = completed[0]["completed"] if completed else 0
    
    # Count claimed rewards
    pipeline = [
        {"$match": {"week_start": week_start.isoformat()}},
        {"$unwind": "$challenges"},
        {"$match": {"challenges.claimed": True}},
        {"$group": {"_id": None, "total_bids": {"$sum": "$challenges.reward_bids"}}}
    ]
    claimed = await db.user_challenges.aggregate(pipeline).to_list(1)
    total_bids_awarded = claimed[0]["total_bids"] if claimed else 0
    
    return {
        "week_start": week_start.isoformat(),
        "active_participants": active_users,
        "challenges_completed": completed_count,
        "total_bids_awarded": total_bids_awarded
    }
