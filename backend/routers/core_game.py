"""
BidBlitz Core Game System - Simplified & Unified
Daily Rewards, Missions, Challenges, Weekly Tournament
"""
from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel
from datetime import datetime, timezone, timedelta
from pymongo import MongoClient
from typing import Optional
import random
import os

router = APIRouter(prefix="/core", tags=["Core Game System"])

# MongoDB Connection
mongo_url = os.environ.get("MONGO_URL")
db_name = os.environ.get("DB_NAME", "bidblitz")
client = MongoClient(mongo_url)
db = client[db_name]

# Collections
wallets_col = db["wallets"]
daily_login_col = db["daily_login"]
missions_col = db["user_missions"]
challenges_col = db["user_challenges"]
game_plays_col = db["game_plays"]
leaderboard_col = db["leaderboard"]
tournament_col = db["tournaments"]

# ======================== CONFIG ========================

# Daily Login Rewards (7-day streak)
DAILY_REWARDS = [5, 10, 15, 20, 30, 40, 100]

# Games Config
GAMES = {
    "wheel": {"min": 5, "max": 50, "limit": 3, "name": "Spin Wheel", "icon": "🎡"},
    "scratch": {"min": 10, "max": 40, "limit": 5, "name": "Scratch Card", "icon": "🪙"},
    "reaction": {"min": 3, "max": 10, "limit": 20, "name": "Reaction", "icon": "⚡"},
    "tap": {"min": 3, "max": 20, "limit": 10, "name": "Tap Rush", "icon": "👆"},
    "dice": {"min": 1, "max": 30, "limit": 5, "name": "Dice", "icon": "🎲"},
    "coin_hunt": {"min": 5, "max": 25, "limit": 10, "name": "Coin Hunt", "icon": "💰"}
}

# Missions
MISSIONS = {
    "play_game": {"reward": 20, "name": "Spiel spielen", "icon": "🎮"},
    "open_app": {"reward": 5, "name": "App öffnen", "icon": "📱"},
    "invite_friend": {"reward": 50, "name": "Freund einladen", "icon": "👥"},
    "win_50_coins": {"reward": 30, "name": "50 Coins gewinnen", "icon": "💰"},
    "play_3_games": {"reward": 25, "name": "3 Spiele spielen", "icon": "🎯"}
}

# Challenges
CHALLENGES = {
    "play_3_games": {"reward": 20, "name": "3 Spiele spielen", "icon": "🎮"},
    "earn_50_coins": {"reward": 30, "name": "50 Coins verdienen", "icon": "💰"},
    "invite_friend": {"reward": 100, "name": "Freund einladen", "icon": "👥"},
    "daily_streak_3": {"reward": 50, "name": "3 Tage Login-Streak", "icon": "🔥"},
    "win_tournament": {"reward": 200, "name": "Turnier gewinnen", "icon": "🏆"}
}

# Tournament Prizes
TOURNAMENT_PRIZES = [500, 300, 200, 100, 50]


def get_user_id_from_token(authorization: str) -> str:
    if not authorization:
        return "demo_user"
    try:
        token = authorization.replace("Bearer ", "")
        import jwt
        payload = jwt.decode(token, options={"verify_signature": False})
        return payload.get("user_id", "demo_user")
    except:
        return "demo_user"


def today() -> str:
    return datetime.now(timezone.utc).date().isoformat()


def this_week() -> str:
    now = datetime.now(timezone.utc)
    week_start = now - timedelta(days=now.weekday())
    return week_start.date().isoformat()


# ======================== WALLET ========================

@router.post("/wallet/create")
async def create_wallet(authorization: str = Header(None)):
    """Create wallet for user"""
    user_id = get_user_id_from_token(authorization)
    now = datetime.now(timezone.utc)
    
    wallets_col.update_one(
        {"user_id": user_id},
        {
            "$setOnInsert": {
                "coins": 0,
                "total_earned": 0,
                "total_spent": 0,
                "created_at": now.isoformat()
            }
        },
        upsert=True
    )
    
    wallet = wallets_col.find_one({"user_id": user_id}, {"_id": 0})
    return {"wallet": wallet.get("coins", 0)}


@router.get("/wallet/balance")
async def get_balance(authorization: str = Header(None)):
    """Get wallet balance"""
    user_id = get_user_id_from_token(authorization)
    wallet = wallets_col.find_one({"user_id": user_id}, {"_id": 0})
    return {
        "coins": wallet.get("coins", 0) if wallet else 0,
        "total_earned": wallet.get("total_earned", 0) if wallet else 0
    }


@router.post("/wallet/add")
async def add_coins(amount: int, authorization: str = Header(None)):
    """Add coins to wallet"""
    user_id = get_user_id_from_token(authorization)
    now = datetime.now(timezone.utc)
    
    wallets_col.update_one(
        {"user_id": user_id},
        {
            "$inc": {"coins": amount, "total_earned": amount},
            "$setOnInsert": {"created_at": now.isoformat()}
        },
        upsert=True
    )
    
    wallet = wallets_col.find_one({"user_id": user_id}, {"_id": 0})
    return {"wallet": wallet.get("coins", 0)}


# ======================== DAILY LOGIN ========================

@router.get("/daily/status")
async def get_daily_status(authorization: str = Header(None)):
    """Get daily login streak status"""
    user_id = get_user_id_from_token(authorization)
    
    login_data = daily_login_col.find_one({"user_id": user_id}, {"_id": 0})
    
    if not login_data:
        return {
            "day": 0,
            "streak": 0,
            "claimed_today": False,
            "next_reward": DAILY_REWARDS[0],
            "rewards": DAILY_REWARDS
        }
    
    claimed_today = login_data.get("last_claim") == today()
    current_day = login_data.get("day", 0)
    next_day = (current_day % 7)
    
    return {
        "day": current_day,
        "streak": login_data.get("streak", 0),
        "claimed_today": claimed_today,
        "next_reward": DAILY_REWARDS[next_day] if not claimed_today else 0,
        "rewards": DAILY_REWARDS
    }


@router.post("/daily/claim")
async def claim_daily_reward(authorization: str = Header(None)):
    """Claim daily login reward"""
    user_id = get_user_id_from_token(authorization)
    now = datetime.now(timezone.utc)
    
    login_data = daily_login_col.find_one({"user_id": user_id})
    
    if login_data and login_data.get("last_claim") == today():
        raise HTTPException(status_code=400, detail="Heute schon abgeholt!")
    
    # Calculate streak
    current_day = 1
    streak = 1
    
    if login_data:
        last_claim = login_data.get("last_claim")
        yesterday = (datetime.now(timezone.utc) - timedelta(days=1)).date().isoformat()
        
        if last_claim == yesterday:
            # Continue streak
            current_day = (login_data.get("day", 0) % 7) + 1
            streak = login_data.get("streak", 0) + 1
        else:
            # Streak broken, reset
            current_day = 1
            streak = 1
    
    reward = DAILY_REWARDS[current_day - 1]
    
    # Update login data
    daily_login_col.update_one(
        {"user_id": user_id},
        {
            "$set": {
                "day": current_day,
                "streak": streak,
                "last_claim": today(),
                "updated_at": now.isoformat()
            },
            "$inc": {"total_claimed": reward},
            "$setOnInsert": {"created_at": now.isoformat()}
        },
        upsert=True
    )
    
    # Add reward to wallet
    wallets_col.update_one(
        {"user_id": user_id},
        {
            "$inc": {"coins": reward, "total_earned": reward},
            "$setOnInsert": {"created_at": now.isoformat()}
        },
        upsert=True
    )
    
    wallet = wallets_col.find_one({"user_id": user_id}, {"_id": 0})
    
    return {
        "success": True,
        "day": current_day,
        "streak": streak,
        "reward": reward,
        "new_balance": wallet.get("coins", 0),
        "message": f"Tag {current_day}: +{reward} Coins! 🎉"
    }


# ======================== GAMES ========================

class PlayGameRequest(BaseModel):
    game: str


@router.get("/games/list")
async def get_games_list(authorization: str = Header(None)):
    """Get all games with today's play counts"""
    user_id = get_user_id_from_token(authorization)
    
    games_list = []
    for game_id, config in GAMES.items():
        # Get today's play count
        key = f"{user_id}_{game_id}_{today()}"
        play_data = game_plays_col.find_one({"key": key})
        plays_today = play_data.get("count", 0) if play_data else 0
        
        games_list.append({
            "id": game_id,
            "name": config["name"],
            "icon": config["icon"],
            "min_reward": config["min"],
            "max_reward": config["max"],
            "daily_limit": config["limit"],
            "plays_today": plays_today,
            "plays_left": config["limit"] - plays_today
        })
    
    return {"games": games_list}


@router.post("/games/play")
async def play_game(request: PlayGameRequest, authorization: str = Header(None)):
    """Play a game and get reward"""
    user_id = get_user_id_from_token(authorization)
    now = datetime.now(timezone.utc)
    
    if request.game not in GAMES:
        raise HTTPException(status_code=404, detail="Spiel nicht gefunden")
    
    game = GAMES[request.game]
    key = f"{user_id}_{request.game}_{today()}"
    
    # Check daily limit
    play_data = game_plays_col.find_one({"key": key})
    plays_today = play_data.get("count", 0) if play_data else 0
    
    if plays_today >= game["limit"]:
        raise HTTPException(
            status_code=400, 
            detail=f"Tageslimit erreicht! ({game['limit']}/{game['limit']})"
        )
    
    # Calculate reward
    reward = random.randint(game["min"], game["max"])
    
    # Update play count
    game_plays_col.update_one(
        {"key": key},
        {
            "$inc": {"count": 1},
            "$set": {"updated_at": now.isoformat()},
            "$setOnInsert": {"user_id": user_id, "game": request.game, "date": today()}
        },
        upsert=True
    )
    
    # Add to wallet
    wallets_col.update_one(
        {"user_id": user_id},
        {
            "$inc": {"coins": reward, "total_earned": reward},
            "$setOnInsert": {"created_at": now.isoformat()}
        },
        upsert=True
    )
    
    # Update leaderboard
    week = this_week()
    leaderboard_col.update_one(
        {"user_id": user_id, "week": week},
        {
            "$inc": {"score": reward, "games_played": 1},
            "$set": {"updated_at": now.isoformat()},
            "$setOnInsert": {"created_at": now.isoformat()}
        },
        upsert=True
    )
    
    wallet = wallets_col.find_one({"user_id": user_id}, {"_id": 0})
    
    return {
        "success": True,
        "game": request.game,
        "reward": reward,
        "plays_left": game["limit"] - plays_today - 1,
        "new_balance": wallet.get("coins", 0),
        "message": f"+{reward} Coins! 🎉"
    }


@router.get("/games/leaderboard")
async def get_leaderboard():
    """Get weekly leaderboard"""
    week = this_week()
    
    top_players = list(leaderboard_col.find(
        {"week": week},
        {"_id": 0, "user_id": 1, "score": 1, "games_played": 1}
    ).sort("score", -1).limit(10))
    
    return {
        "week": week,
        "leaderboard": top_players,
        "prizes": TOURNAMENT_PRIZES[:len(top_players)]
    }


# ======================== MISSIONS ========================

@router.get("/missions/list")
async def get_missions(authorization: str = Header(None)):
    """Get today's missions"""
    user_id = get_user_id_from_token(authorization)
    
    missions_list = []
    for mission_id, config in MISSIONS.items():
        key = f"{user_id}_{mission_id}_{today()}"
        done = missions_col.find_one({"key": key})
        
        missions_list.append({
            "id": mission_id,
            "name": config["name"],
            "icon": config["icon"],
            "reward": config["reward"],
            "completed": done is not None
        })
    
    return {"missions": missions_list, "date": today()}


class CompleteMissionRequest(BaseModel):
    mission: str


@router.post("/missions/complete")
async def complete_mission(request: CompleteMissionRequest, authorization: str = Header(None)):
    """Complete a mission"""
    user_id = get_user_id_from_token(authorization)
    now = datetime.now(timezone.utc)
    
    if request.mission not in MISSIONS:
        raise HTTPException(status_code=404, detail="Mission nicht gefunden")
    
    key = f"{user_id}_{request.mission}_{today()}"
    
    # Check if already done
    if missions_col.find_one({"key": key}):
        raise HTTPException(status_code=400, detail="Mission heute schon abgeschlossen!")
    
    mission = MISSIONS[request.mission]
    reward = mission["reward"]
    
    # Mark as complete
    missions_col.insert_one({
        "key": key,
        "user_id": user_id,
        "mission": request.mission,
        "reward": reward,
        "completed_at": now.isoformat()
    })
    
    # Add reward
    wallets_col.update_one(
        {"user_id": user_id},
        {
            "$inc": {"coins": reward, "total_earned": reward},
            "$setOnInsert": {"created_at": now.isoformat()}
        },
        upsert=True
    )
    
    wallet = wallets_col.find_one({"user_id": user_id}, {"_id": 0})
    
    return {
        "success": True,
        "mission": request.mission,
        "reward": reward,
        "new_balance": wallet.get("coins", 0),
        "message": f"Mission abgeschlossen! +{reward} Coins 🎯"
    }


# ======================== CHALLENGES ========================

@router.get("/challenges/list")
async def get_challenges(authorization: str = Header(None)):
    """Get active challenges"""
    user_id = get_user_id_from_token(authorization)
    
    challenges_list = []
    for challenge_id, config in CHALLENGES.items():
        done = challenges_col.find_one({"user_id": user_id, "challenge": challenge_id})
        
        challenges_list.append({
            "id": challenge_id,
            "name": config["name"],
            "icon": config["icon"],
            "reward": config["reward"],
            "completed": done is not None
        })
    
    return {"challenges": challenges_list}


class CompleteChallengeRequest(BaseModel):
    challenge: str


@router.post("/challenges/complete")
async def complete_challenge(request: CompleteChallengeRequest, authorization: str = Header(None)):
    """Complete a challenge"""
    user_id = get_user_id_from_token(authorization)
    now = datetime.now(timezone.utc)
    
    if request.challenge not in CHALLENGES:
        raise HTTPException(status_code=404, detail="Challenge nicht gefunden")
    
    # Check if already done
    if challenges_col.find_one({"user_id": user_id, "challenge": request.challenge}):
        raise HTTPException(status_code=400, detail="Challenge bereits abgeschlossen!")
    
    challenge = CHALLENGES[request.challenge]
    reward = challenge["reward"]
    
    # Mark as complete
    challenges_col.insert_one({
        "user_id": user_id,
        "challenge": request.challenge,
        "reward": reward,
        "completed_at": now.isoformat()
    })
    
    # Add reward
    wallets_col.update_one(
        {"user_id": user_id},
        {
            "$inc": {"coins": reward, "total_earned": reward},
            "$setOnInsert": {"created_at": now.isoformat()}
        },
        upsert=True
    )
    
    wallet = wallets_col.find_one({"user_id": user_id}, {"_id": 0})
    
    return {
        "success": True,
        "challenge": request.challenge,
        "reward": reward,
        "new_balance": wallet.get("coins", 0),
        "message": f"Challenge geschafft! +{reward} Coins 🏆"
    }


# ======================== WEEKLY TOURNAMENT ========================

@router.get("/tournament/status")
async def get_tournament_status(authorization: str = Header(None)):
    """Get current tournament status"""
    user_id = get_user_id_from_token(authorization)
    week = this_week()
    
    # Get user's ranking
    user_score = leaderboard_col.find_one(
        {"user_id": user_id, "week": week},
        {"_id": 0}
    )
    
    # Calculate rank
    if user_score:
        higher_count = leaderboard_col.count_documents({
            "week": week,
            "score": {"$gt": user_score.get("score", 0)}
        })
        rank = higher_count + 1
    else:
        rank = None
    
    # Get top 10
    top_players = list(leaderboard_col.find(
        {"week": week},
        {"_id": 0, "user_id": 1, "score": 1}
    ).sort("score", -1).limit(10))
    
    # Calculate days left
    week_start = datetime.fromisoformat(week)
    week_end = week_start + timedelta(days=7)
    days_left = (week_end - datetime.now(timezone.utc).replace(tzinfo=None)).days
    
    return {
        "week": week,
        "your_score": user_score.get("score", 0) if user_score else 0,
        "your_rank": rank,
        "days_left": max(0, days_left),
        "top_10": top_players,
        "prizes": TOURNAMENT_PRIZES
    }


@router.post("/tournament/end-week")
async def end_tournament():
    """End current week's tournament and distribute prizes (Admin only)"""
    week = this_week()
    now = datetime.now(timezone.utc)
    
    # Get top players
    top_players = list(leaderboard_col.find(
        {"week": week},
        {"_id": 0, "user_id": 1, "score": 1}
    ).sort("score", -1).limit(5))
    
    winners = []
    for i, player in enumerate(top_players):
        if i < len(TOURNAMENT_PRIZES):
            prize = TOURNAMENT_PRIZES[i]
            
            # Award prize
            wallets_col.update_one(
                {"user_id": player["user_id"]},
                {"$inc": {"coins": prize, "total_earned": prize}}
            )
            
            winners.append({
                "rank": i + 1,
                "user_id": player["user_id"],
                "score": player["score"],
                "prize": prize
            })
    
    # Record tournament results
    tournament_col.insert_one({
        "week": week,
        "winners": winners,
        "ended_at": now.isoformat()
    })
    
    return {
        "success": True,
        "week": week,
        "winners": winners,
        "message": "Turnier beendet! Preise wurden verteilt."
    }


# ======================== QUICK STATS ========================

@router.get("/stats/overview")
async def get_overview(authorization: str = Header(None)):
    """Get user's complete overview"""
    user_id = get_user_id_from_token(authorization)
    week = this_week()
    
    wallet = wallets_col.find_one({"user_id": user_id}, {"_id": 0})
    daily = daily_login_col.find_one({"user_id": user_id}, {"_id": 0})
    weekly_score = leaderboard_col.find_one({"user_id": user_id, "week": week}, {"_id": 0})
    
    # Count completed missions today
    missions_done = missions_col.count_documents({
        "user_id": user_id,
        "completed_at": {"$regex": f"^{today()}"}
    })
    
    # Count completed challenges
    challenges_done = challenges_col.count_documents({"user_id": user_id})
    
    return {
        "coins": wallet.get("coins", 0) if wallet else 0,
        "total_earned": wallet.get("total_earned", 0) if wallet else 0,
        "daily_streak": daily.get("streak", 0) if daily else 0,
        "claimed_today": daily.get("last_claim") == today() if daily else False,
        "weekly_score": weekly_score.get("score", 0) if weekly_score else 0,
        "missions_done_today": missions_done,
        "total_missions": len(MISSIONS),
        "challenges_done": challenges_done,
        "total_challenges": len(CHALLENGES)
    }
