"""
BidBlitz Games V2 - Pokemon GO Style Coin Hunt + Mini Games
Real-time coin spawning, location-based collection, lucky wheel, scratch cards
"""
from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel
from datetime import datetime, timezone
from pymongo import MongoClient
from typing import List, Optional
import random
import time
import math
import os

router = APIRouter(prefix="/games-v2", tags=["Games V2"])

# MongoDB Connection
mongo_url = os.environ.get("MONGO_URL")
db_name = os.environ.get("DB_NAME", "bidblitz")
client = MongoClient(mongo_url)
db = client[db_name]

# Collections
wallets_col = db["wallets"]
coins_map_col = db["coins_on_map"]
collected_coins_col = db["collected_coins"]
game_plays_col = db["game_plays_v2"]
leaderboard_col = db["leaderboard"]

# Game Config
COIN_SPAWN_INTERVAL = 60  # seconds
COINS_PER_SPAWN = 10
COLLECTION_RADIUS = 0.001  # ~100 meters

# Default spawn location (can be customized)
DEFAULT_LAT = 25.2048  # Dubai
DEFAULT_LNG = 55.2708

# In-memory cache for performance
coins_cache = []
last_spawn_time = 0


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


def distance(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Calculate simple distance between two points"""
    return math.sqrt((lat1 - lat2)**2 + (lng1 - lng2)**2)


def spawn_coins(center_lat: float = DEFAULT_LAT, center_lng: float = DEFAULT_LNG):
    """Spawn new coins on the map"""
    global coins_cache, last_spawn_time
    
    current_time = time.time()
    
    # Only spawn if interval passed
    if current_time - last_spawn_time < COIN_SPAWN_INTERVAL:
        return coins_cache
    
    last_spawn_time = current_time
    now = datetime.now(timezone.utc)
    
    # Generate new coins
    new_coins = []
    for _ in range(COINS_PER_SPAWN):
        coin = {
            "id": f"coin_{random.randint(10000, 99999)}_{int(current_time)}",
            "lat": center_lat + (random.random() - 0.5) / 50,  # ~2km radius
            "lng": center_lng + (random.random() - 0.5) / 50,
            "reward": random.choice([5, 10, 10, 20, 20, 50]),
            "type": random.choice(["gold", "silver", "bronze"]),
            "spawned_at": now.isoformat(),
            "expires_at": (now.replace(hour=23, minute=59)).isoformat()
        }
        new_coins.append(coin)
    
    # Add to cache
    coins_cache.extend(new_coins)
    
    # Limit cache size
    if len(coins_cache) > 100:
        coins_cache = coins_cache[-100:]
    
    # Also save to DB (for persistence)
    if new_coins:
        coins_map_col.insert_many(new_coins)
    
    return coins_cache


# ======================== COIN HUNT (Pokemon GO Style) ========================

@router.get("/coin-hunt/map")
async def get_coins_on_map(lat: float = DEFAULT_LAT, lng: float = DEFAULT_LNG):
    """Get all coins on the map near a location"""
    spawn_coins(lat, lng)
    
    # Filter coins within view distance
    nearby_coins = []
    for coin in coins_cache:
        dist = distance(lat, lng, coin["lat"], coin["lng"])
        if dist < 0.05:  # ~5km view radius
            nearby_coins.append({
                **coin,
                "distance": round(dist * 111000, 1)  # Convert to meters approx
            })
    
    return {
        "coins": nearby_coins,
        "count": len(nearby_coins),
        "center": {"lat": lat, "lng": lng}
    }


class CollectCoinRequest(BaseModel):
    coin_id: str
    lat: float
    lng: float


@router.post("/coin-hunt/collect")
async def collect_coin(request: CollectCoinRequest, authorization: str = Header(None)):
    """Collect a coin from the map"""
    global coins_cache
    user_id = get_user_id_from_token(authorization)
    now = datetime.now(timezone.utc)
    
    # Find coin in cache
    target_coin = None
    for coin in coins_cache:
        if coin["id"] == request.coin_id:
            target_coin = coin
            break
    
    if not target_coin:
        raise HTTPException(status_code=404, detail="Coin nicht gefunden!")
    
    # Check distance
    dist = distance(request.lat, request.lng, target_coin["lat"], target_coin["lng"])
    if dist > COLLECTION_RADIUS:
        raise HTTPException(status_code=400, detail=f"Zu weit entfernt! ({round(dist * 111000)}m)")
    
    # Check if already collected
    already_collected = collected_coins_col.find_one({
        "coin_id": request.coin_id,
        "user_id": user_id
    })
    if already_collected:
        raise HTTPException(status_code=400, detail="Coin bereits gesammelt!")
    
    reward = target_coin["reward"]
    
    # Add to wallet
    wallets_col.update_one(
        {"user_id": user_id},
        {
            "$inc": {"coins": reward, "total_earned": reward},
            "$setOnInsert": {"created_at": now.isoformat()}
        },
        upsert=True
    )
    
    # Record collection
    collected_coins_col.insert_one({
        "user_id": user_id,
        "coin_id": request.coin_id,
        "reward": reward,
        "lat": request.lat,
        "lng": request.lng,
        "collected_at": now.isoformat()
    })
    
    # Remove from cache
    coins_cache = [c for c in coins_cache if c["id"] != request.coin_id]
    
    # Update leaderboard
    leaderboard_col.update_one(
        {"user_id": user_id, "type": "coin_hunt"},
        {
            "$inc": {"coins_collected": 1, "total_coins": reward},
            "$set": {"updated_at": now.isoformat()},
            "$setOnInsert": {"created_at": now.isoformat()}
        },
        upsert=True
    )
    
    wallet = wallets_col.find_one({"user_id": user_id}, {"_id": 0})
    
    return {
        "success": True,
        "reward": reward,
        "coin_type": target_coin["type"],
        "balance": wallet.get("coins", 0),
        "message": f"+{reward} Coins gesammelt! 🪙"
    }


@router.get("/coin-hunt/stats")
async def get_coin_hunt_stats(authorization: str = Header(None)):
    """Get user's coin hunt statistics"""
    user_id = get_user_id_from_token(authorization)
    
    stats = leaderboard_col.find_one(
        {"user_id": user_id, "type": "coin_hunt"},
        {"_id": 0}
    )
    
    # Get top collectors
    top_collectors = list(leaderboard_col.find(
        {"type": "coin_hunt"},
        {"_id": 0, "user_id": 1, "coins_collected": 1, "total_coins": 1}
    ).sort("total_coins", -1).limit(10))
    
    return {
        "your_stats": {
            "coins_collected": stats.get("coins_collected", 0) if stats else 0,
            "total_coins": stats.get("total_coins", 0) if stats else 0
        },
        "leaderboard": top_collectors,
        "coins_on_map": len(coins_cache)
    }


# ======================== LUCKY WHEEL ========================

WHEEL_PRIZES = [5, 10, 10, 20, 20, 50, 50, 100]
WHEEL_DAILY_LIMIT = 5

@router.post("/lucky-wheel/spin")
async def spin_lucky_wheel(authorization: str = Header(None)):
    """Spin the lucky wheel"""
    user_id = get_user_id_from_token(authorization)
    now = datetime.now(timezone.utc)
    
    # Check daily limit
    key = f"{user_id}_wheel_{today()}"
    play_data = game_plays_col.find_one({"key": key})
    plays_today = play_data.get("count", 0) if play_data else 0
    
    if plays_today >= WHEEL_DAILY_LIMIT:
        raise HTTPException(status_code=400, detail=f"Tageslimit erreicht! ({WHEEL_DAILY_LIMIT}/{WHEEL_DAILY_LIMIT})")
    
    # Spin the wheel
    reward = random.choice(WHEEL_PRIZES)
    angle = random.randint(0, 360)  # For animation
    
    # Update play count
    game_plays_col.update_one(
        {"key": key},
        {
            "$inc": {"count": 1},
            "$set": {"updated_at": now.isoformat()},
            "$setOnInsert": {"user_id": user_id, "game": "wheel", "date": today()}
        },
        upsert=True
    )
    
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
        "reward": reward,
        "angle": angle,
        "plays_left": WHEEL_DAILY_LIMIT - plays_today - 1,
        "balance": wallet.get("coins", 0),
        "message": f"🎡 Glückwunsch! +{reward} Coins!"
    }


# ======================== SCRATCH CARD ========================

SCRATCH_PRIZES = [0, 0, 5, 5, 10, 10, 20, 50]
SCRATCH_DAILY_LIMIT = 10

@router.post("/scratch/reveal")
async def reveal_scratch_card(authorization: str = Header(None)):
    """Reveal a scratch card"""
    user_id = get_user_id_from_token(authorization)
    now = datetime.now(timezone.utc)
    
    # Check daily limit
    key = f"{user_id}_scratch_{today()}"
    play_data = game_plays_col.find_one({"key": key})
    plays_today = play_data.get("count", 0) if play_data else 0
    
    if plays_today >= SCRATCH_DAILY_LIMIT:
        raise HTTPException(status_code=400, detail=f"Tageslimit erreicht! ({SCRATCH_DAILY_LIMIT}/{SCRATCH_DAILY_LIMIT})")
    
    # Reveal the card
    reward = random.choice(SCRATCH_PRIZES)
    is_winner = reward > 0
    
    # Update play count
    game_plays_col.update_one(
        {"key": key},
        {
            "$inc": {"count": 1},
            "$set": {"updated_at": now.isoformat()},
            "$setOnInsert": {"user_id": user_id, "game": "scratch", "date": today()}
        },
        upsert=True
    )
    
    # Add reward if won
    if reward > 0:
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
        "is_winner": is_winner,
        "reward": reward,
        "plays_left": SCRATCH_DAILY_LIMIT - plays_today - 1,
        "balance": wallet.get("coins", 0),
        "message": f"🪙 +{reward} Coins!" if is_winner else "Leider nichts gewonnen 😢"
    }


# ======================== REACTION GAME ========================

REACTION_BASE_REWARD = 5
REACTION_DAILY_LIMIT = 20

class ReactionResult(BaseModel):
    reaction_time_ms: int  # Reaction time in milliseconds


@router.post("/reaction/submit")
async def submit_reaction(result: ReactionResult, authorization: str = Header(None)):
    """Submit reaction game result"""
    user_id = get_user_id_from_token(authorization)
    now = datetime.now(timezone.utc)
    
    # Check daily limit
    key = f"{user_id}_reaction_{today()}"
    play_data = game_plays_col.find_one({"key": key})
    plays_today = play_data.get("count", 0) if play_data else 0
    
    if plays_today >= REACTION_DAILY_LIMIT:
        raise HTTPException(status_code=400, detail=f"Tageslimit erreicht! ({REACTION_DAILY_LIMIT}/{REACTION_DAILY_LIMIT})")
    
    # Calculate reward based on reaction time
    # Faster = more reward
    if result.reaction_time_ms < 200:
        reward = 20  # Super fast
    elif result.reaction_time_ms < 300:
        reward = 15
    elif result.reaction_time_ms < 400:
        reward = 10
    elif result.reaction_time_ms < 500:
        reward = REACTION_BASE_REWARD
    else:
        reward = 3  # Slow
    
    # Update play count
    game_plays_col.update_one(
        {"key": key},
        {
            "$inc": {"count": 1},
            "$set": {"updated_at": now.isoformat()},
            "$setOnInsert": {"user_id": user_id, "game": "reaction", "date": today()}
        },
        upsert=True
    )
    
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
    
    # Determine rating
    if result.reaction_time_ms < 200:
        rating = "⚡ BLITZSCHNELL!"
    elif result.reaction_time_ms < 300:
        rating = "🔥 Super schnell!"
    elif result.reaction_time_ms < 400:
        rating = "👍 Gut!"
    else:
        rating = "😅 Nächstes Mal schneller!"
    
    return {
        "success": True,
        "reaction_time_ms": result.reaction_time_ms,
        "reward": reward,
        "rating": rating,
        "plays_left": REACTION_DAILY_LIMIT - plays_today - 1,
        "balance": wallet.get("coins", 0)
    }


# ======================== TAP RUSH ========================

TAP_DAILY_LIMIT = 10

class TapRushResult(BaseModel):
    taps: int
    duration_seconds: int = 10


@router.post("/tap-rush/submit")
async def submit_tap_rush(result: TapRushResult, authorization: str = Header(None)):
    """Submit tap rush game result"""
    user_id = get_user_id_from_token(authorization)
    now = datetime.now(timezone.utc)
    
    # Check daily limit
    key = f"{user_id}_tap_{today()}"
    play_data = game_plays_col.find_one({"key": key})
    plays_today = play_data.get("count", 0) if play_data else 0
    
    if plays_today >= TAP_DAILY_LIMIT:
        raise HTTPException(status_code=400, detail=f"Tageslimit erreicht! ({TAP_DAILY_LIMIT}/{TAP_DAILY_LIMIT})")
    
    # Calculate reward based on taps per second
    tps = result.taps / result.duration_seconds if result.duration_seconds > 0 else 0
    
    if tps > 8:
        reward = 50  # Insane
    elif tps > 6:
        reward = 30
    elif tps > 4:
        reward = 20
    elif tps > 2:
        reward = 10
    else:
        reward = 5
    
    # Update play count
    game_plays_col.update_one(
        {"key": key},
        {
            "$inc": {"count": 1},
            "$set": {"updated_at": now.isoformat()},
            "$setOnInsert": {"user_id": user_id, "game": "tap", "date": today()}
        },
        upsert=True
    )
    
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
        "taps": result.taps,
        "tps": round(tps, 2),
        "reward": reward,
        "plays_left": TAP_DAILY_LIMIT - plays_today - 1,
        "balance": wallet.get("coins", 0),
        "message": f"👆 {result.taps} Taps = +{reward} Coins!"
    }


# ======================== DICE GAME ========================

DICE_DAILY_LIMIT = 10

class DiceRollRequest(BaseModel):
    bet_high: bool = True  # True = bet on 4-6, False = bet on 1-3


@router.post("/dice/roll")
async def roll_dice(request: DiceRollRequest, authorization: str = Header(None)):
    """Roll the dice"""
    user_id = get_user_id_from_token(authorization)
    now = datetime.now(timezone.utc)
    
    # Check daily limit
    key = f"{user_id}_dice_{today()}"
    play_data = game_plays_col.find_one({"key": key})
    plays_today = play_data.get("count", 0) if play_data else 0
    
    if plays_today >= DICE_DAILY_LIMIT:
        raise HTTPException(status_code=400, detail=f"Tageslimit erreicht! ({DICE_DAILY_LIMIT}/{DICE_DAILY_LIMIT})")
    
    # Roll the dice
    dice_result = random.randint(1, 6)
    is_high = dice_result >= 4
    
    # Check if won
    won = (is_high and request.bet_high) or (not is_high and not request.bet_high)
    reward = random.randint(10, 30) if won else 0
    
    # Update play count
    game_plays_col.update_one(
        {"key": key},
        {
            "$inc": {"count": 1},
            "$set": {"updated_at": now.isoformat()},
            "$setOnInsert": {"user_id": user_id, "game": "dice", "date": today()}
        },
        upsert=True
    )
    
    # Add reward if won
    if reward > 0:
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
        "dice": dice_result,
        "bet": "high (4-6)" if request.bet_high else "low (1-3)",
        "won": won,
        "reward": reward,
        "plays_left": DICE_DAILY_LIMIT - plays_today - 1,
        "balance": wallet.get("coins", 0),
        "message": f"🎲 {dice_result}! {'Gewonnen! +' + str(reward) + ' Coins' if won else 'Verloren!'}"
    }


# ======================== GAME STATUS ========================

@router.get("/status")
async def get_games_status(authorization: str = Header(None)):
    """Get status of all games for today"""
    user_id = get_user_id_from_token(authorization)
    
    games = {
        "wheel": {"limit": WHEEL_DAILY_LIMIT, "name": "Lucky Wheel", "icon": "🎡"},
        "scratch": {"limit": SCRATCH_DAILY_LIMIT, "name": "Scratch Card", "icon": "🪙"},
        "reaction": {"limit": REACTION_DAILY_LIMIT, "name": "Reaction", "icon": "⚡"},
        "tap": {"limit": TAP_DAILY_LIMIT, "name": "Tap Rush", "icon": "👆"},
        "dice": {"limit": DICE_DAILY_LIMIT, "name": "Dice", "icon": "🎲"}
    }
    
    status = []
    for game_id, config in games.items():
        key = f"{user_id}_{game_id}_{today()}"
        play_data = game_plays_col.find_one({"key": key})
        plays = play_data.get("count", 0) if play_data else 0
        
        status.append({
            "id": game_id,
            "name": config["name"],
            "icon": config["icon"],
            "plays_today": plays,
            "limit": config["limit"],
            "plays_left": config["limit"] - plays
        })
    
    return {
        "games": status,
        "date": today(),
        "coins_on_map": len(coins_cache)
    }
