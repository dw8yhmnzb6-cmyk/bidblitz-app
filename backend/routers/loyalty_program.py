"""
Restaurant Loyalty Program
- Earn stamps for restaurant visits
- Complete challenges for bonus bids
- Track progress and rewards
"""
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone, timedelta
from typing import Optional, List
from pydantic import BaseModel
import uuid

from config import db, logger
from dependencies import get_current_user

router = APIRouter(prefix="/loyalty", tags=["Loyalty Program"])

# ==================== LOYALTY CONFIG ====================

LOYALTY_LEVELS = [
    {"level": 1, "name": "Starter", "name_de": "Anfänger", "required_stamps": 0, "bonus_percent": 0, "icon": "🌟"},
    {"level": 2, "name": "Regular", "name_de": "Stammgast", "required_stamps": 5, "bonus_percent": 5, "icon": "⭐"},
    {"level": 3, "name": "VIP", "name_de": "VIP", "required_stamps": 15, "bonus_percent": 10, "icon": "💫"},
    {"level": 4, "name": "Gold", "name_de": "Gold", "required_stamps": 30, "bonus_percent": 15, "icon": "🏆"},
    {"level": 5, "name": "Platinum", "name_de": "Platin", "required_stamps": 50, "bonus_percent": 20, "icon": "💎"},
]

CHALLENGES = [
    {
        "id": "first_restaurant",
        "name": "Erster Besuch",
        "name_en": "First Visit",
        "description": "Besuche dein erstes Restaurant",
        "description_en": "Visit your first restaurant",
        "reward_bids": 5,
        "type": "single",
        "requirement": 1,
        "category": None
    },
    {
        "id": "three_restaurants",
        "name": "Restaurant-Entdecker",
        "name_en": "Restaurant Explorer",
        "description": "Besuche 3 verschiedene Restaurants",
        "description_en": "Visit 3 different restaurants",
        "reward_bids": 10,
        "type": "unique_restaurants",
        "requirement": 3,
        "category": None
    },
    {
        "id": "five_restaurants",
        "name": "Gourmet",
        "name_en": "Gourmet",
        "description": "Besuche 5 verschiedene Restaurants",
        "description_en": "Visit 5 different restaurants",
        "reward_bids": 20,
        "type": "unique_restaurants",
        "requirement": 5,
        "category": None
    },
    {
        "id": "italian_lover",
        "name": "Italien-Liebhaber",
        "name_en": "Italian Lover",
        "description": "Besuche 3 italienische Restaurants",
        "description_en": "Visit 3 Italian restaurants",
        "reward_bids": 15,
        "type": "category_visits",
        "requirement": 3,
        "category": "italian"
    },
    {
        "id": "review_master",
        "name": "Bewertungs-Meister",
        "name_en": "Review Master",
        "description": "Schreibe 5 Restaurant-Bewertungen",
        "description_en": "Write 5 restaurant reviews",
        "reward_bids": 25,
        "type": "reviews",
        "requirement": 5,
        "category": None
    },
    {
        "id": "photo_expert",
        "name": "Foto-Experte",
        "name_en": "Photo Expert",
        "description": "Lade 10 Fotos in Bewertungen hoch",
        "description_en": "Upload 10 photos in reviews",
        "reward_bids": 30,
        "type": "photos",
        "requirement": 10,
        "category": None
    },
    {
        "id": "weekly_regular",
        "name": "Wöchentlicher Stammgast",
        "name_en": "Weekly Regular",
        "description": "Besuche 4 Wochen in Folge ein Restaurant",
        "description_en": "Visit a restaurant 4 weeks in a row",
        "reward_bids": 40,
        "type": "weekly_streak",
        "requirement": 4,
        "category": None
    },
    {
        "id": "big_spender",
        "name": "Großverdiener",
        "name_en": "Big Spender",
        "description": "Löse Gutscheine im Wert von €100 ein",
        "description_en": "Redeem vouchers worth €100",
        "reward_bids": 50,
        "type": "total_value",
        "requirement": 100,
        "category": None
    }
]

# ==================== ENDPOINTS ====================

@router.get("/status")
async def get_loyalty_status(user = Depends(get_current_user)):
    """Get user's loyalty status and progress"""
    
    # Get or create loyalty profile
    loyalty = await db.loyalty_profiles.find_one({"user_id": user["id"]})
    
    if not loyalty:
        loyalty = {
            "user_id": user["id"],
            "total_stamps": 0,
            "level": 1,
            "total_visits": 0,
            "unique_restaurants": [],
            "total_value_redeemed": 0,
            "completed_challenges": [],
            "current_streak": 0,
            "last_visit_week": None,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.loyalty_profiles.insert_one(loyalty)
    
    # Calculate current level
    current_level = LOYALTY_LEVELS[0]
    next_level = LOYALTY_LEVELS[1] if len(LOYALTY_LEVELS) > 1 else None
    
    for i, level in enumerate(LOYALTY_LEVELS):
        if loyalty["total_stamps"] >= level["required_stamps"]:
            current_level = level
            next_level = LOYALTY_LEVELS[i + 1] if i + 1 < len(LOYALTY_LEVELS) else None
    
    # Calculate progress to next level
    progress = 0
    stamps_needed = 0
    if next_level:
        stamps_needed = next_level["required_stamps"] - loyalty["total_stamps"]
        progress = ((loyalty["total_stamps"] - current_level["required_stamps"]) / 
                   (next_level["required_stamps"] - current_level["required_stamps"])) * 100
    
    return {
        "user_id": user["id"],
        "total_stamps": loyalty["total_stamps"],
        "current_level": current_level,
        "next_level": next_level,
        "stamps_to_next_level": stamps_needed,
        "progress_percent": round(progress, 1),
        "total_visits": loyalty["total_visits"],
        "unique_restaurants_count": len(loyalty.get("unique_restaurants", [])),
        "bonus_percent": current_level["bonus_percent"],
        "current_streak": loyalty.get("current_streak", 0)
    }

@router.get("/challenges")
async def get_challenges(user = Depends(get_current_user)):
    """Get all challenges with user's progress"""
    
    loyalty = await db.loyalty_profiles.find_one({"user_id": user["id"]})
    completed = loyalty.get("completed_challenges", []) if loyalty else []
    
    challenges_with_progress = []
    
    for challenge in CHALLENGES:
        progress = await calculate_challenge_progress(user["id"], challenge, loyalty)
        
        challenges_with_progress.append({
            **challenge,
            "completed": challenge["id"] in completed,
            "progress": progress,
            "progress_percent": min(100, (progress / challenge["requirement"]) * 100)
        })
    
    return {
        "challenges": challenges_with_progress,
        "completed_count": len(completed),
        "total_count": len(CHALLENGES)
    }

async def calculate_challenge_progress(user_id: str, challenge: dict, loyalty: dict) -> int:
    """Calculate progress for a specific challenge"""
    
    if not loyalty:
        return 0
    
    challenge_type = challenge["type"]
    
    if challenge_type == "single":
        return min(1, loyalty.get("total_visits", 0))
    
    elif challenge_type == "unique_restaurants":
        return len(loyalty.get("unique_restaurants", []))
    
    elif challenge_type == "category_visits":
        # Count visits to specific category
        category = challenge["category"]
        visits = await db.voucher_redemptions.count_documents({
            "user_id": user_id,
            "restaurant_category": category
        })
        return visits
    
    elif challenge_type == "reviews":
        return await db.restaurant_reviews.count_documents({"user_id": user_id})
    
    elif challenge_type == "photos":
        # Count photos in reviews
        reviews = await db.restaurant_reviews.find(
            {"user_id": user_id},
            {"photos": 1}
        ).to_list(100)
        return sum(len(r.get("photos", [])) for r in reviews)
    
    elif challenge_type == "weekly_streak":
        return loyalty.get("current_streak", 0)
    
    elif challenge_type == "total_value":
        return int(loyalty.get("total_value_redeemed", 0))
    
    return 0

@router.post("/record-visit")
async def record_restaurant_visit(
    restaurant_id: str,
    voucher_code: str,
    voucher_value: float,
    user = Depends(get_current_user)
):
    """Record a restaurant visit (called after voucher redemption)"""
    
    now = datetime.now(timezone.utc)
    current_week = now.isocalendar()[1]
    
    # Get or create loyalty profile
    loyalty = await db.loyalty_profiles.find_one({"user_id": user["id"]})
    
    if not loyalty:
        loyalty = {
            "user_id": user["id"],
            "total_stamps": 0,
            "level": 1,
            "total_visits": 0,
            "unique_restaurants": [],
            "total_value_redeemed": 0,
            "completed_challenges": [],
            "current_streak": 0,
            "last_visit_week": None,
            "created_at": now.isoformat()
        }
    
    # Update stats
    is_new_restaurant = restaurant_id not in loyalty.get("unique_restaurants", [])
    
    # Calculate streak
    last_week = loyalty.get("last_visit_week")
    if last_week:
        if current_week == last_week + 1:
            loyalty["current_streak"] = loyalty.get("current_streak", 0) + 1
        elif current_week != last_week:
            loyalty["current_streak"] = 1
    else:
        loyalty["current_streak"] = 1
    
    # Update loyalty profile
    update = {
        "$inc": {
            "total_stamps": 1,
            "total_visits": 1,
            "total_value_redeemed": voucher_value
        },
        "$set": {
            "last_visit_week": current_week,
            "current_streak": loyalty["current_streak"],
            "last_visit": now.isoformat()
        }
    }
    
    if is_new_restaurant:
        update["$addToSet"] = {"unique_restaurants": restaurant_id}
    
    await db.loyalty_profiles.update_one(
        {"user_id": user["id"]},
        update,
        upsert=True
    )
    
    # Check for completed challenges
    rewards = await check_and_award_challenges(user["id"])
    
    return {
        "success": True,
        "stamps_earned": 1,
        "is_new_restaurant": is_new_restaurant,
        "current_streak": loyalty["current_streak"],
        "challenges_completed": rewards
    }

async def check_and_award_challenges(user_id: str) -> List[dict]:
    """Check and award completed challenges"""
    
    loyalty = await db.loyalty_profiles.find_one({"user_id": user_id})
    if not loyalty:
        return []
    
    completed = loyalty.get("completed_challenges", [])
    new_completions = []
    
    for challenge in CHALLENGES:
        if challenge["id"] in completed:
            continue
        
        progress = await calculate_challenge_progress(user_id, challenge, loyalty)
        
        if progress >= challenge["requirement"]:
            # Award challenge!
            await db.loyalty_profiles.update_one(
                {"user_id": user_id},
                {"$addToSet": {"completed_challenges": challenge["id"]}}
            )
            
            # Award bonus bids
            await db.users.update_one(
                {"id": user_id},
                {
                    "$inc": {"bids_balance": challenge["reward_bids"]},
                    "$push": {
                        "bid_history": {
                            "type": "challenge_reward",
                            "amount": challenge["reward_bids"],
                            "description": f"Challenge: {challenge['name']}",
                            "date": datetime.now(timezone.utc).isoformat()
                        }
                    }
                }
            )
            
            new_completions.append({
                "challenge_id": challenge["id"],
                "name": challenge["name"],
                "reward_bids": challenge["reward_bids"]
            })
            
            logger.info(f"User {user_id} completed challenge {challenge['id']}, awarded {challenge['reward_bids']} bids")
    
    return new_completions

@router.get("/leaderboard")
async def get_loyalty_leaderboard(limit: int = 20):
    """Get top loyalty members"""
    
    top_users = await db.loyalty_profiles.find(
        {},
        {"_id": 0, "user_id": 1, "total_stamps": 1, "total_visits": 1}
    ).sort("total_stamps", -1).limit(limit).to_list(limit)
    
    # Add user info
    for entry in top_users:
        user = await db.users.find_one(
            {"id": entry["user_id"]},
            {"username": 1, "avatar_url": 1}
        )
        if user:
            entry["username"] = user.get("username", "Anonym")
            entry["avatar_url"] = user.get("avatar_url")
        
        # Get level
        for level in LOYALTY_LEVELS:
            if entry["total_stamps"] >= level["required_stamps"]:
                entry["level"] = level
    
    return top_users

@router.get("/levels")
async def get_loyalty_levels():
    """Get all loyalty levels and their benefits"""
    return LOYALTY_LEVELS

loyalty_router = router
