"""Daily Quests & Login Calendar - Daily engagement features"""
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone, timedelta
from typing import Optional
import uuid
import random

from config import db, logger
from dependencies import get_current_user

router = APIRouter(prefix="/daily", tags=["Daily"])

# ==================== QUEST DEFINITIONS ====================

QUEST_TEMPLATES = [
    {
        "id": "bid_3_auctions",
        "name_de": "Aktiver Bieter",
        "name_en": "Active Bidder",
        "description_de": "Biete auf 3 verschiedene Auktionen",
        "description_en": "Bid on 3 different auctions",
        "target": 3,
        "type": "bid_auctions",
        "reward_xp": 15,
        "reward_bids": 2,
        "icon": "⚡"
    },
    {
        "id": "place_10_bids",
        "name_de": "Gebot-Marathon",
        "name_en": "Bid Marathon",
        "description_de": "Platziere 10 Gebote",
        "description_en": "Place 10 bids",
        "target": 10,
        "type": "total_bids",
        "reward_xp": 20,
        "reward_bids": 3,
        "icon": "🎯"
    },
    {
        "id": "visit_leaderboard",
        "name_de": "Ranglisten-Check",
        "name_en": "Leaderboard Check",
        "description_de": "Besuche die Rangliste",
        "description_en": "Visit the leaderboard",
        "target": 1,
        "type": "visit_page",
        "page": "leaderboard",
        "reward_xp": 5,
        "reward_bids": 1,
        "icon": "🏆"
    },
    {
        "id": "spin_wheel",
        "name_de": "Glücksritter",
        "name_en": "Lucky Spinner",
        "description_de": "Drehe am Glücksrad",
        "description_en": "Spin the wheel",
        "target": 1,
        "type": "spin_wheel",
        "reward_xp": 10,
        "reward_bids": 1,
        "icon": "🎡"
    },
    {
        "id": "watch_auction",
        "name_de": "Beobachter",
        "name_en": "Watcher",
        "description_de": "Beobachte eine Auktion",
        "description_en": "Watch an auction",
        "target": 1,
        "type": "watch_auction",
        "reward_xp": 5,
        "reward_bids": 1,
        "icon": "👀"
    },
    {
        "id": "bid_5_times",
        "name_de": "Fleißiger Bieter",
        "name_en": "Diligent Bidder",
        "description_de": "Platziere 5 Gebote",
        "description_en": "Place 5 bids",
        "target": 5,
        "type": "total_bids",
        "reward_xp": 10,
        "reward_bids": 2,
        "icon": "💪"
    },
    {
        "id": "visit_gallery",
        "name_de": "Galerie-Besucher",
        "name_en": "Gallery Visitor",
        "description_de": "Besuche die Gewinner-Galerie",
        "description_en": "Visit the winner gallery",
        "target": 1,
        "type": "visit_page",
        "page": "gallery",
        "reward_xp": 5,
        "reward_bids": 1,
        "icon": "🖼️"
    },
    {
        "id": "check_profile",
        "name_de": "Profil-Check",
        "name_en": "Profile Check",
        "description_de": "Besuche dein Profil",
        "description_en": "Visit your profile",
        "target": 1,
        "type": "visit_page",
        "page": "profile",
        "reward_xp": 5,
        "reward_bids": 0,
        "icon": "👤"
    }
]

# ==================== LOGIN CALENDAR REWARDS ====================

LOGIN_CALENDAR = [
    {"day": 1, "reward_type": "bids", "amount": 2, "icon": "🎁"},
    {"day": 2, "reward_type": "bids", "amount": 2, "icon": "🎁"},
    {"day": 3, "reward_type": "bids", "amount": 3, "icon": "🎁"},
    {"day": 4, "reward_type": "bids", "amount": 3, "icon": "🎁"},
    {"day": 5, "reward_type": "bids", "amount": 5, "icon": "⭐"},
    {"day": 6, "reward_type": "bids", "amount": 5, "icon": "⭐"},
    {"day": 7, "reward_type": "bids", "amount": 10, "icon": "🏆"},  # Weekly bonus
    {"day": 8, "reward_type": "bids", "amount": 3, "icon": "🎁"},
    {"day": 9, "reward_type": "bids", "amount": 3, "icon": "🎁"},
    {"day": 10, "reward_type": "bids", "amount": 4, "icon": "🎁"},
    {"day": 11, "reward_type": "bids", "amount": 4, "icon": "🎁"},
    {"day": 12, "reward_type": "bids", "amount": 5, "icon": "⭐"},
    {"day": 13, "reward_type": "bids", "amount": 5, "icon": "⭐"},
    {"day": 14, "reward_type": "bids", "amount": 15, "icon": "👑"},  # 2 week bonus
    {"day": 15, "reward_type": "bids", "amount": 4, "icon": "🎁"},
    {"day": 16, "reward_type": "bids", "amount": 4, "icon": "🎁"},
    {"day": 17, "reward_type": "bids", "amount": 5, "icon": "🎁"},
    {"day": 18, "reward_type": "bids", "amount": 5, "icon": "🎁"},
    {"day": 19, "reward_type": "bids", "amount": 6, "icon": "⭐"},
    {"day": 20, "reward_type": "bids", "amount": 6, "icon": "⭐"},
    {"day": 21, "reward_type": "bids", "amount": 20, "icon": "💎"},  # 3 week bonus
    {"day": 22, "reward_type": "bids", "amount": 5, "icon": "🎁"},
    {"day": 23, "reward_type": "bids", "amount": 5, "icon": "🎁"},
    {"day": 24, "reward_type": "bids", "amount": 6, "icon": "🎁"},
    {"day": 25, "reward_type": "bids", "amount": 6, "icon": "🎁"},
    {"day": 26, "reward_type": "bids", "amount": 7, "icon": "⭐"},
    {"day": 27, "reward_type": "bids", "amount": 7, "icon": "⭐"},
    {"day": 28, "reward_type": "bids", "amount": 25, "icon": "🌟"},  # 4 week MEGA bonus
    {"day": 29, "reward_type": "bids", "amount": 8, "icon": "🎁"},
    {"day": 30, "reward_type": "bids", "amount": 30, "icon": "💎"},  # Month complete!
]

# ==================== DAILY QUESTS ====================

@router.get("/quests")
async def get_daily_quests(user: dict = Depends(get_current_user)):
    """Get today's daily quests for user"""
    user_id = user["id"]
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    # Check if quests already generated for today
    daily_record = await db.daily_quests.find_one({
        "user_id": user_id,
        "date": today
    }, {"_id": 0})
    
    if not daily_record:
        # Generate 3 random quests for today
        selected_quests = random.sample(QUEST_TEMPLATES, 3)
        
        quests = []
        for quest in selected_quests:
            quests.append({
                "id": str(uuid.uuid4()),
                "quest_id": quest["id"],
                "name": quest["name_de"],
                "description": quest["description_de"],
                "icon": quest["icon"],
                "target": quest["target"],
                "progress": 0,
                "completed": False,
                "claimed": False,
                "reward_xp": quest["reward_xp"],
                "reward_bids": quest["reward_bids"],
                "type": quest["type"],
                "page": quest.get("page")
            })
        
        daily_record = {
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "date": today,
            "quests": quests,
            "all_completed_bonus_claimed": False,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.daily_quests.insert_one(daily_record)
    
    # Calculate time until reset (midnight UTC)
    now = datetime.now(timezone.utc)
    tomorrow = (now + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
    seconds_until_reset = int((tomorrow - now).total_seconds())
    
    return {
        "quests": daily_record.get("quests", []),
        "date": today,
        "seconds_until_reset": seconds_until_reset,
        "all_completed": all(q.get("completed") for q in daily_record.get("quests", [])),
        "all_completed_bonus_claimed": daily_record.get("all_completed_bonus_claimed", False),
        "all_completed_bonus": {"xp": 50, "bids": 5}  # Bonus for completing all 3
    }

@router.post("/quests/claim/{quest_id}")
async def claim_quest_reward(quest_id: str, user: dict = Depends(get_current_user)):
    """Claim reward for completed quest"""
    user_id = user["id"]
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    daily_record = await db.daily_quests.find_one({
        "user_id": user_id,
        "date": today
    })
    
    if not daily_record:
        raise HTTPException(status_code=404, detail="Keine Quests für heute")
    
    quest = None
    quest_index = -1
    for i, q in enumerate(daily_record.get("quests", [])):
        if q["id"] == quest_id:
            quest = q
            quest_index = i
            break
    
    if not quest:
        raise HTTPException(status_code=404, detail="Quest nicht gefunden")
    
    if not quest.get("completed"):
        raise HTTPException(status_code=400, detail="Quest noch nicht abgeschlossen")
    
    if quest.get("claimed"):
        raise HTTPException(status_code=400, detail="Belohnung bereits abgeholt")
    
    # Award rewards
    reward_bids = quest.get("reward_bids", 0)
    reward_xp = quest.get("reward_xp", 0)
    
    if reward_bids > 0:
        await db.users.update_one(
            {"id": user_id},
            {"$inc": {"bids_balance": reward_bids}}
        )
    
    if reward_xp > 0:
        try:
            from routers.levels import award_xp
            await award_xp(user_id, "daily_quest", reward_xp, f"Daily Quest: {quest['name']}")
        except:
            pass
    
    # Mark as claimed
    daily_record["quests"][quest_index]["claimed"] = True
    await db.daily_quests.update_one(
        {"id": daily_record["id"]},
        {"$set": {"quests": daily_record["quests"]}}
    )
    
    logger.info(f"Daily quest claimed: {user_id} - {quest['name']} (+{reward_bids} bids, +{reward_xp} XP)")
    
    return {
        "message": "Belohnung erhalten!",
        "bids_earned": reward_bids,
        "xp_earned": reward_xp
    }

@router.post("/quests/claim-all-bonus")
async def claim_all_completed_bonus(user: dict = Depends(get_current_user)):
    """Claim bonus for completing all daily quests"""
    user_id = user["id"]
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    daily_record = await db.daily_quests.find_one({
        "user_id": user_id,
        "date": today
    })
    
    if not daily_record:
        raise HTTPException(status_code=404, detail="Keine Quests für heute")
    
    if daily_record.get("all_completed_bonus_claimed"):
        raise HTTPException(status_code=400, detail="Bonus bereits abgeholt")
    
    # Check all completed
    all_completed = all(q.get("completed") for q in daily_record.get("quests", []))
    if not all_completed:
        raise HTTPException(status_code=400, detail="Noch nicht alle Quests abgeschlossen")
    
    # Award bonus
    bonus_bids = 5
    bonus_xp = 50
    
    await db.users.update_one(
        {"id": user_id},
        {"$inc": {"bids_balance": bonus_bids}}
    )
    
    try:
        from routers.levels import award_xp
        await award_xp(user_id, "daily_all_quests", bonus_xp, "Alle täglichen Quests abgeschlossen!")
    except:
        pass
    
    await db.daily_quests.update_one(
        {"id": daily_record["id"]},
        {"$set": {"all_completed_bonus_claimed": True}}
    )
    
    return {
        "message": "🎉 Bonus für alle Quests erhalten!",
        "bids_earned": bonus_bids,
        "xp_earned": bonus_xp
    }

# ==================== LOGIN CALENDAR ====================

@router.get("/login-calendar")
async def get_login_calendar(user: dict = Depends(get_current_user)):
    """Get user's login calendar status"""
    user_id = user["id"]
    
    # Get or create calendar record
    calendar = await db.login_calendar.find_one({"user_id": user_id}, {"_id": 0})
    
    if not calendar:
        calendar = {
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "current_day": 0,
            "last_claim_date": None,
            "total_claimed": 0,
            "streak_start": None,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.login_calendar.insert_one(calendar)
    
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    last_claim = calendar.get("last_claim_date")
    can_claim = last_claim != today
    
    current_day = calendar.get("current_day", 0)
    next_reward = LOGIN_CALENDAR[current_day] if current_day < len(LOGIN_CALENDAR) else None
    
    return {
        "current_day": current_day,
        "can_claim_today": can_claim,
        "last_claim_date": last_claim,
        "next_reward": next_reward,
        "calendar": LOGIN_CALENDAR,
        "total_claimed": calendar.get("total_claimed", 0)
    }

@router.post("/login-calendar/claim")
async def claim_login_reward(user: dict = Depends(get_current_user)):
    """Claim today's login reward"""
    user_id = user["id"]
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    calendar = await db.login_calendar.find_one({"user_id": user_id})
    
    if not calendar:
        calendar = {
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "current_day": 0,
            "last_claim_date": None,
            "total_claimed": 0,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.login_calendar.insert_one(calendar)
    
    if calendar.get("last_claim_date") == today:
        raise HTTPException(status_code=400, detail="Heute bereits abgeholt!")
    
    current_day = calendar.get("current_day", 0)
    
    # Check streak - if missed a day, reset to day 1
    last_claim = calendar.get("last_claim_date")
    if last_claim:
        last_date = datetime.strptime(last_claim, "%Y-%m-%d")
        today_date = datetime.strptime(today, "%Y-%m-%d")
        days_diff = (today_date - last_date).days
        
        if days_diff > 1:
            # Streak broken, reset to day 0
            current_day = 0
    
    # Get reward for current day
    if current_day >= len(LOGIN_CALENDAR):
        current_day = 0  # Reset after 30 days
    
    reward = LOGIN_CALENDAR[current_day]
    reward_amount = reward["amount"]
    
    # Award reward
    await db.users.update_one(
        {"id": user_id},
        {"$inc": {"bids_balance": reward_amount}}
    )
    
    # Update calendar
    new_day = current_day + 1
    await db.login_calendar.update_one(
        {"user_id": user_id},
        {"$set": {
            "current_day": new_day,
            "last_claim_date": today,
            "total_claimed": calendar.get("total_claimed", 0) + reward_amount
        }}
    )
    
    # Award XP for daily login
    try:
        from routers.levels import award_xp
        await award_xp(user_id, "daily_login", 5, "Täglicher Login-Bonus")
    except:
        pass
    
    logger.info(f"Login calendar claimed: {user_id} - Day {current_day + 1} (+{reward_amount} bids)")
    
    return {
        "message": f"Tag {current_day + 1} Bonus erhalten!",
        "day": current_day + 1,
        "bids_earned": reward_amount,
        "icon": reward["icon"],
        "next_day": new_day if new_day < len(LOGIN_CALENDAR) else 0
    }

# ==================== QUEST PROGRESS TRACKING ====================

async def track_quest_progress(user_id: str, action_type: str, data: dict = None):
    """Track progress for daily quests"""
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    daily_record = await db.daily_quests.find_one({
        "user_id": user_id,
        "date": today
    })
    
    if not daily_record:
        return
    
    updated = False
    quests = daily_record.get("quests", [])
    
    for i, quest in enumerate(quests):
        if quest.get("completed"):
            continue
        
        quest_type = quest.get("type")
        
        # Check if this action matches the quest
        if quest_type == "total_bids" and action_type == "bid":
            quests[i]["progress"] = quest.get("progress", 0) + 1
            updated = True
        
        elif quest_type == "bid_auctions" and action_type == "bid":
            # Track unique auctions
            auction_id = data.get("auction_id") if data else None
            if auction_id:
                bid_auctions = quest.get("bid_auctions", [])
                if auction_id not in bid_auctions:
                    bid_auctions.append(auction_id)
                    quests[i]["bid_auctions"] = bid_auctions
                    quests[i]["progress"] = len(bid_auctions)
                    updated = True
        
        elif quest_type == "spin_wheel" and action_type == "spin_wheel":
            quests[i]["progress"] = 1
            updated = True
        
        elif quest_type == "watch_auction" and action_type == "watch_auction":
            quests[i]["progress"] = 1
            updated = True
        
        elif quest_type == "visit_page" and action_type == "visit_page":
            if quest.get("page") == data.get("page"):
                quests[i]["progress"] = 1
                updated = True
        
        # Check if quest completed
        if quests[i].get("progress", 0) >= quest.get("target", 1):
            quests[i]["completed"] = True
    
    if updated:
        await db.daily_quests.update_one(
            {"id": daily_record["id"]},
            {"$set": {"quests": quests}}
        )

@router.post("/track/{action_type}")
async def track_action(action_type: str, page: Optional[str] = None, user: dict = Depends(get_current_user)):
    """Track user action for quest progress"""
    data = {"page": page} if page else {}
    await track_quest_progress(user["id"], action_type, data)
    return {"tracked": True}

# Export
__all__ = ['track_quest_progress', 'LOGIN_CALENDAR']
