"""
Social Sharing Rewards Router
Rewards users for sharing BidBlitz on social media
"""
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone, timedelta
from typing import Optional
from pydantic import BaseModel
import uuid

from config import db, logger
from dependencies import get_current_user

router = APIRouter(prefix="/social-rewards", tags=["Social Sharing Rewards"])

# ==================== SCHEMAS ====================

class TrackShareRequest(BaseModel):
    platform: str  # twitter, facebook, whatsapp, telegram

# ==================== CONSTANTS ====================

BIDS_PER_SHARE = 3
WEEKLY_BONUS_THRESHOLD = 10
WEEKLY_BONUS_BIDS = 50
STREAK_BONUS_DAYS = 7
STREAK_BONUS_BIDS = 100
COOLDOWN_MINUTES = 60  # Minimum time between shares on same platform


# ==================== ENDPOINTS ====================

@router.get("/stats")
async def get_social_stats(user: dict = Depends(get_current_user)):
    """Get user's social sharing statistics"""
    
    user_id = user["id"]
    
    # Total shares
    total_shares = await db.social_shares.count_documents({"user_id": user_id})
    
    # Total rewards earned
    pipeline = [
        {"$match": {"user_id": user_id}},
        {"$group": {"_id": None, "total": {"$sum": "$bids_earned"}}}
    ]
    total_result = await db.social_shares.aggregate(pipeline).to_list(1)
    total_rewards = total_result[0]["total"] if total_result else 0
    
    # Shares this week
    week_start = datetime.now(timezone.utc) - timedelta(days=7)
    shares_this_week = await db.social_shares.count_documents({
        "user_id": user_id,
        "created_at": {"$gte": week_start.isoformat()}
    })
    
    # Current streak
    streak_data = await db.user_streaks.find_one({"user_id": user_id, "type": "social_share"})
    current_streak = streak_data.get("current_streak", 0) if streak_data else 0
    
    return {
        "total_shares": total_shares,
        "total_rewards": total_rewards,
        "shares_this_week": shares_this_week,
        "current_streak": current_streak,
        "weekly_bonus_progress": min(shares_this_week, WEEKLY_BONUS_THRESHOLD),
        "weekly_bonus_threshold": WEEKLY_BONUS_THRESHOLD,
        "streak_bonus_progress": current_streak,
        "streak_bonus_threshold": STREAK_BONUS_DAYS
    }


@router.get("/history")
async def get_share_history(
    limit: int = 50,
    user: dict = Depends(get_current_user)
):
    """Get user's share history"""
    
    shares = await db.social_shares.find(
        {"user_id": user["id"]},
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    return {"shares": shares}


@router.post("/track-share")
async def track_social_share(
    data: TrackShareRequest,
    user: dict = Depends(get_current_user)
):
    """Track a social media share and reward the user"""
    
    user_id = user["id"]
    platform = data.platform.lower()
    
    if platform not in ["twitter", "facebook", "whatsapp", "telegram", "instagram"]:
        raise HTTPException(status_code=400, detail="Ungültige Plattform")
    
    # Check cooldown (prevent spam)
    cooldown_time = datetime.now(timezone.utc) - timedelta(minutes=COOLDOWN_MINUTES)
    recent_share = await db.social_shares.find_one({
        "user_id": user_id,
        "platform": platform,
        "created_at": {"$gte": cooldown_time.isoformat()}
    })
    
    if recent_share:
        minutes_left = COOLDOWN_MINUTES - int(
            (datetime.now(timezone.utc) - datetime.fromisoformat(recent_share["created_at"].replace("Z", "+00:00"))).total_seconds() / 60
        )
        raise HTTPException(
            status_code=429, 
            detail=f"Du kannst in {minutes_left} Minuten erneut auf {platform} teilen"
        )
    
    # Calculate base reward
    bids_earned = BIDS_PER_SHARE
    bonus_type = None
    
    # Check for weekly bonus
    week_start = datetime.now(timezone.utc) - timedelta(days=7)
    shares_this_week = await db.social_shares.count_documents({
        "user_id": user_id,
        "created_at": {"$gte": week_start.isoformat()}
    })
    
    if shares_this_week + 1 == WEEKLY_BONUS_THRESHOLD:
        bids_earned += WEEKLY_BONUS_BIDS
        bonus_type = "weekly"
    
    # Update streak
    today = datetime.now(timezone.utc).date().isoformat()
    streak_data = await db.user_streaks.find_one({"user_id": user_id, "type": "social_share"})
    
    if streak_data:
        last_share_date = streak_data.get("last_date")
        yesterday = (datetime.now(timezone.utc) - timedelta(days=1)).date().isoformat()
        
        if last_share_date == today:
            # Already shared today, don't update streak
            current_streak = streak_data.get("current_streak", 1)
        elif last_share_date == yesterday:
            # Continue streak
            current_streak = streak_data.get("current_streak", 0) + 1
            await db.user_streaks.update_one(
                {"user_id": user_id, "type": "social_share"},
                {"$set": {"current_streak": current_streak, "last_date": today}}
            )
            
            # Check for streak bonus
            if current_streak == STREAK_BONUS_DAYS:
                bids_earned += STREAK_BONUS_BIDS
                bonus_type = "streak" if not bonus_type else "both"
        else:
            # Reset streak
            current_streak = 1
            await db.user_streaks.update_one(
                {"user_id": user_id, "type": "social_share"},
                {"$set": {"current_streak": 1, "last_date": today}}
            )
    else:
        # Create streak record
        current_streak = 1
        await db.user_streaks.insert_one({
            "user_id": user_id,
            "type": "social_share",
            "current_streak": 1,
            "last_date": today,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
    
    # Record the share
    share_record = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "platform": platform,
        "bids_earned": bids_earned,
        "bonus_type": bonus_type,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.social_shares.insert_one(share_record)
    
    # Add bids to user
    await db.users.update_one(
        {"id": user_id},
        {"$inc": {"bids": bids_earned, "bids_balance": bids_earned}}
    )
    
    # Log the share
    logger.info(f"📱 Social share: {user.get('username')} shared on {platform}, earned {bids_earned} bids")
    
    response = {
        "success": True,
        "bids_earned": bids_earned,
        "platform": platform,
        "message": f"+{bids_earned} Gebote für das Teilen auf {platform}!"
    }
    
    if bonus_type == "weekly":
        response["bonus_message"] = f"🎉 Wöchentlicher Bonus! +{WEEKLY_BONUS_BIDS} Extra-Gebote!"
    elif bonus_type == "streak":
        response["bonus_message"] = f"🔥 Streak Bonus! {STREAK_BONUS_DAYS} Tage in Folge! +{STREAK_BONUS_BIDS} Extra-Gebote!"
    elif bonus_type == "both":
        response["bonus_message"] = f"🎊 Doppelter Bonus! Wöchentlich + Streak = +{WEEKLY_BONUS_BIDS + STREAK_BONUS_BIDS} Extra-Gebote!"
    
    return response


@router.get("/leaderboard")
async def get_sharing_leaderboard():
    """Get top social sharers this week"""
    
    week_start = datetime.now(timezone.utc) - timedelta(days=7)
    
    pipeline = [
        {"$match": {"created_at": {"$gte": week_start.isoformat()}}},
        {"$group": {
            "_id": "$user_id", 
            "shares": {"$sum": 1},
            "bids_earned": {"$sum": "$bids_earned"}
        }},
        {"$sort": {"shares": -1}},
        {"$limit": 10}
    ]
    
    leaders = []
    async for doc in db.social_shares.aggregate(pipeline):
        user = await db.users.find_one({"id": doc["_id"]})
        if user:
            leaders.append({
                "username": user.get("username"),
                "avatar_url": user.get("avatar_url"),
                "shares": doc["shares"],
                "bids_earned": doc["bids_earned"]
            })
    
    return {"leaderboard": leaders}
