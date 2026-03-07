"""
BidBlitz Games System - Lite Version
Wallet, Games, Daily Rewards, Leaderboard
MongoDB-persistent storage (migrated from SQLite)
"""
from fastapi import APIRouter
from datetime import datetime, timezone, timedelta
from pymongo import MongoClient
import random
import os

router = APIRouter(prefix="/bbz-lite", tags=["BBZ Games Lite"])

# MongoDB Connection
mongo_url = os.environ.get("MONGO_URL")
db_name = os.environ.get("DB_NAME", "bidblitz")
client = MongoClient(mongo_url)
db = client[db_name]

# Collections
users_col = db["bbz_lite_users"]
game_portal_col = db["bbz_lite_games"]
daily_rewards_col = db["bbz_lite_daily"]
game_plays_col = db["bbz_lite_plays"]

# Initialize games if collection is empty
def init_games():
    if game_portal_col.count_documents({}) == 0:
        games = [
            {"id": 1, "name": "🧩 Puzzle Blocks", "image": "puzzle", "url": "https://html5.gamedistribution.com/puzzle", "reward": 5},
            {"id": 2, "name": "🚗 Car Jam", "image": "car", "url": "https://html5.gamedistribution.com/car", "reward": 6},
            {"id": 3, "name": "⛏️ Idle Miner", "image": "miner", "url": "https://html5.gamedistribution.com/miner", "reward": 10},
            {"id": 4, "name": "🍓 Fruit Match", "image": "fruit", "url": "https://html5.gamedistribution.com/fruit", "reward": 7},
            {"id": 5, "name": "🚀 Space Battle", "image": "space", "url": "https://html5.gamedistribution.com/space", "reward": 12},
            {"id": 6, "name": "🧟 Zombie Attack", "image": "zombie", "url": "https://html5.gamedistribution.com/zombie", "reward": 9},
            {"id": 7, "name": "🏎️ Speed Racer", "image": "racer", "url": "https://html5.gamedistribution.com/racer", "reward": 8},
            {"id": 8, "name": "💎 Treasure Hunter", "image": "treasure", "url": "https://html5.gamedistribution.com/treasure", "reward": 11},
            {"id": 9, "name": "🐉 Dragon Quest", "image": "dragon", "url": "https://html5.gamedistribution.com/dragon", "reward": 15},
            {"id": 10, "name": "🏙️ City Builder", "image": "city", "url": "https://html5.gamedistribution.com/city", "reward": 13}
        ]
        game_portal_col.insert_many(games)

init_games()


def get_or_create_user(user_id: str) -> dict:
    """Get or create a user with initial coins"""
    user = users_col.find_one({"user_id": user_id}, {"_id": 0})
    if not user:
        user = {"user_id": user_id, "coins": 50}
        users_col.insert_one(user)
    return user


# -------------------------
# WALLET
# -------------------------

@router.post("/wallet/create")
def create_wallet(user_id: str):
    """Create wallet with 50 coins"""
    user = get_or_create_user(user_id)
    return {"user_id": user_id, "coins": user.get("coins", 50)}


@router.get("/wallet")
def wallet(user_id: str):
    """Get wallet balance"""
    user = users_col.find_one({"user_id": user_id}, {"_id": 0})
    return {"coins": user.get("coins", 0) if user else 0}


@router.get("/wallet/balance")
def wallet_balance(user_id: str):
    return wallet(user_id)


@router.post("/wallet/add")
def add_coins(user_id: str, amount: int):
    """Add coins to wallet"""
    get_or_create_user(user_id)
    users_col.update_one(
        {"user_id": user_id},
        {"$inc": {"coins": amount}}
    )
    user = users_col.find_one({"user_id": user_id}, {"_id": 0})
    return {"wallet": user.get("coins", 0)}


# -------------------------
# GAMES (from Database)
# -------------------------

@router.get("/games")
def get_games():
    """Get all games from database"""
    games = list(game_portal_col.find({}, {"_id": 0}))
    return {"games": games}


@router.get("/games/play")
def play_game(game_id: int, user_id: str = None):
    """Get game info and play URL"""
    game = game_portal_col.find_one({"id": game_id}, {"_id": 0})
    
    if not game:
        return {"error": "game not found"}
    
    # If user_id provided, add reward
    if user_id:
        now = datetime.now(timezone.utc)
        reward = random.randint(max(1, game["reward"] - 3), game["reward"] + 3)
        
        # Ensure user exists
        get_or_create_user(user_id)
        
        # Add coins
        users_col.update_one(
            {"user_id": user_id},
            {"$inc": {"coins": reward}}
        )
        
        # Log game play
        game_plays_col.insert_one({
            "user_id": user_id,
            "game_id": game_id,
            "reward": reward,
            "played_at": now.isoformat()
        })
        
        user = users_col.find_one({"user_id": user_id}, {"_id": 0})
        
        return {
            "game": game["name"],
            "image": game.get("image"),
            "play_url": game.get("url"),
            "reward": reward,
            "balance": user.get("coins", 0)
        }
    
    return {
        "game": game["name"],
        "image": game.get("image"),
        "play_url": game.get("url"),
        "reward": game["reward"]
    }


# -------------------------
# DAILY REWARD
# -------------------------

@router.get("/reward/daily")
def daily_reward(user_id: str):
    """Claim daily reward"""
    now = datetime.now(timezone.utc)
    today = now.date().isoformat()
    
    # Ensure user exists
    get_or_create_user(user_id)
    
    # Check if already claimed today
    last_claim = daily_rewards_col.find_one({"user_id": user_id}, {"_id": 0})
    
    if last_claim:
        try:
            last_claim_date = last_claim.get("last_claim_date", "")
            if last_claim_date == today:
                return {"error": "already claimed", "wait": 86400}
        except:
            pass
    
    reward = random.choice([10, 15, 20, 25, 50])
    
    # Add reward
    users_col.update_one(
        {"user_id": user_id},
        {"$inc": {"coins": reward}}
    )
    
    # Update last claim
    daily_rewards_col.update_one(
        {"user_id": user_id},
        {"$set": {"last_claim": now.isoformat(), "last_claim_date": today}},
        upsert=True
    )
    
    user = users_col.find_one({"user_id": user_id}, {"_id": 0})
    
    return {"reward": reward, "balance": user.get("coins", 0)}


# -------------------------
# LEADERBOARD
# -------------------------

@router.get("/leaderboard")
def leaderboard():
    """Get top 10 players"""
    users = list(users_col.find({}, {"_id": 0}).sort("coins", -1).limit(10))
    return {
        "leaderboard": [{"user_id": u["user_id"], "coins": u.get("coins", 0)} for u in users]
    }


@router.get("/games/leaderboard")
def games_leaderboard():
    """Alias: Get top 10 players"""
    users = list(users_col.find({}, {"_id": 0}).sort("coins", -1).limit(10))
    return [[u["user_id"], u.get("coins", 0)] for u in users]


# -------------------------
# STATS
# -------------------------

@router.get("/stats")
def stats(user_id: str):
    """Get user stats"""
    user = users_col.find_one({"user_id": user_id}, {"_id": 0})
    
    if not user:
        return {"error": "user not found"}
    
    games_played = game_plays_col.count_documents({"user_id": user_id})
    
    return {
        "user_id": user_id,
        "coins": user.get("coins", 0),
        "games_played": games_played
    }


# -------------------------
# ADMIN: Add Game
# -------------------------

@router.post("/admin/games/add")
def add_game(name: str, image: str, url: str, reward: int):
    """Admin: Add a new game"""
    # Get next ID
    last_game = game_portal_col.find_one(sort=[("id", -1)])
    next_id = (last_game["id"] + 1) if last_game else 1
    
    game_portal_col.insert_one({
        "id": next_id,
        "name": name,
        "image": image,
        "url": url,
        "reward": reward
    })
    
    return {"success": True, "message": f"Game '{name}' added"}
