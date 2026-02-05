# Daily Missions & Challenges System
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timedelta
from typing import Optional, List
from pydantic import BaseModel
import os

router = APIRouter(prefix="/api/missions", tags=["Missions"])

# Mission Types
DAILY_MISSIONS = [
    {"id": "bid_5", "title": "Fleißiger Bieter", "description": "Gib 5 Gebote ab", "target": 5, "reward": 3, "type": "bids"},
    {"id": "bid_10", "title": "Bieter-Profi", "description": "Gib 10 Gebote ab", "target": 10, "reward": 7, "type": "bids"},
    {"id": "bid_25", "title": "Bieter-Meister", "description": "Gib 25 Gebote ab", "target": 25, "reward": 15, "type": "bids"},
    {"id": "watch_3", "title": "Beobachter", "description": "Beobachte 3 Auktionen", "target": 3, "reward": 2, "type": "watch"},
    {"id": "login_streak", "title": "Treuer Nutzer", "description": "Logge dich ein", "target": 1, "reward": 5, "type": "login"},
    {"id": "win_1", "title": "Gewinner", "description": "Gewinne eine Auktion", "target": 1, "reward": 20, "type": "win"},
    {"id": "referral", "title": "Freunde werben", "description": "Werbe einen Freund", "target": 1, "reward": 50, "type": "referral"},
]

WEEKLY_CHALLENGES = [
    {"id": "weekly_bid_50", "title": "Wochen-Bieter", "description": "Gib 50 Gebote diese Woche ab", "target": 50, "reward": 30, "type": "bids"},
    {"id": "weekly_win_3", "title": "Seriengewinner", "description": "Gewinne 3 Auktionen diese Woche", "target": 3, "reward": 100, "type": "win"},
    {"id": "weekly_login_7", "title": "Perfekte Woche", "description": "Logge dich 7 Tage ein", "target": 7, "reward": 50, "type": "login"},
    {"id": "weekly_spend", "title": "Investor", "description": "Kaufe ein Gebote-Paket", "target": 1, "reward": 25, "type": "purchase"},
]

class MissionProgress(BaseModel):
    mission_id: str
    progress: int
    completed: bool
    claimed: bool
    
class ClaimRewardRequest(BaseModel):
    mission_id: str
    mission_type: str  # daily or weekly

@router.get("/daily")
async def get_daily_missions(user_id: Optional[str] = None):
    """Get today's daily missions with progress"""
    today = datetime.utcnow().strftime("%Y-%m-%d")
    
    missions_with_progress = []
    for mission in DAILY_MISSIONS:
        # Simulate progress (in production, fetch from DB)
        import random
        progress = random.randint(0, mission["target"])
        missions_with_progress.append({
            **mission,
            "progress": min(progress, mission["target"]),
            "completed": progress >= mission["target"],
            "claimed": False,
            "expires_at": (datetime.utcnow().replace(hour=23, minute=59, second=59)).isoformat()
        })
    
    return {
        "date": today,
        "missions": missions_with_progress,
        "total_rewards_available": sum(m["reward"] for m in DAILY_MISSIONS),
        "completed_count": sum(1 for m in missions_with_progress if m["completed"])
    }

@router.get("/weekly")
async def get_weekly_challenges(user_id: Optional[str] = None):
    """Get this week's challenges with progress"""
    # Get start of week (Monday)
    today = datetime.utcnow()
    start_of_week = today - timedelta(days=today.weekday())
    end_of_week = start_of_week + timedelta(days=6, hours=23, minutes=59, seconds=59)
    
    challenges_with_progress = []
    for challenge in WEEKLY_CHALLENGES:
        import random
        progress = random.randint(0, challenge["target"])
        challenges_with_progress.append({
            **challenge,
            "progress": min(progress, challenge["target"]),
            "completed": progress >= challenge["target"],
            "claimed": False,
            "expires_at": end_of_week.isoformat()
        })
    
    return {
        "week_start": start_of_week.strftime("%Y-%m-%d"),
        "week_end": end_of_week.strftime("%Y-%m-%d"),
        "challenges": challenges_with_progress,
        "total_rewards_available": sum(c["reward"] for c in WEEKLY_CHALLENGES),
        "days_remaining": (end_of_week - today).days
    }

@router.post("/claim")
async def claim_mission_reward(request: ClaimRewardRequest):
    """Claim reward for completed mission"""
    missions = DAILY_MISSIONS if request.mission_type == "daily" else WEEKLY_CHALLENGES
    
    mission = next((m for m in missions if m["id"] == request.mission_id), None)
    if not mission:
        raise HTTPException(status_code=404, detail="Mission nicht gefunden")
    
    # In production: Check if mission is completed and not already claimed
    # Then add bids to user balance
    
    return {
        "success": True,
        "reward": mission["reward"],
        "message": f"Du hast {mission['reward']} Gratis-Gebote erhalten!",
        "mission_id": request.mission_id
    }

@router.get("/streak")
async def get_login_streak(user_id: Optional[str] = None):
    """Get user's login streak and rewards"""
    # Streak rewards
    streak_rewards = {
        1: 2,
        2: 3,
        3: 5,
        4: 7,
        5: 10,
        6: 15,
        7: 25,  # Weekly bonus
        14: 50,  # 2 weeks
        30: 100, # Monthly bonus
    }
    
    # Simulate streak (in production, fetch from DB)
    import random
    current_streak = random.randint(1, 15)
    
    return {
        "current_streak": current_streak,
        "longest_streak": max(current_streak, random.randint(current_streak, 30)),
        "today_claimed": False,
        "today_reward": streak_rewards.get(current_streak, 2),
        "next_milestone": next((k for k in sorted(streak_rewards.keys()) if k > current_streak), 30),
        "next_milestone_reward": streak_rewards.get(next((k for k in sorted(streak_rewards.keys()) if k > current_streak), 30), 100),
        "streak_rewards": streak_rewards
    }

@router.post("/streak/claim")
async def claim_streak_reward(user_id: Optional[str] = None):
    """Claim daily login streak reward"""
    # In production: Check last claim date, update streak, add reward
    import random
    streak = random.randint(1, 15)
    reward = {1: 2, 2: 3, 3: 5, 4: 7, 5: 10, 6: 15, 7: 25}.get(streak, 2)
    
    return {
        "success": True,
        "streak": streak,
        "reward": reward,
        "message": f"Tag {streak} Streak! Du erhältst {reward} Gratis-Gebote!"
    }
