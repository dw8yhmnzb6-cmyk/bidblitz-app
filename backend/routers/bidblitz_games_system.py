"""
BidBlitz Games System - Simplified & Persistent
Wallet, Daily Rewards, Games, Referral, Leaderboard
"""
from fastapi import APIRouter
from pymongo import MongoClient
from datetime import datetime, timezone
import random
import os

router = APIRouter(prefix="/bbz", tags=["BBZ Games System"])

# MongoDB Connection
mongo_url = os.environ.get("MONGO_URL")
db_name = os.environ.get("DB_NAME", "bidblitz")
client = MongoClient(mongo_url)
db = client[db_name]

# Collections
wallets_col = db["bbz_wallets"]
leaderboard_col = db["bbz_leaderboard"]
referrals_col = db["bbz_referrals"]
daily_claims_col = db["bbz_daily_claims"]
game_plays_col = db["bbz_game_plays"]


def add_coins(user_id: str, amount: int):
    """Add coins to user wallet and update leaderboard"""
    now = datetime.now(timezone.utc)
    
    wallets_col.update_one(
        {"user_id": user_id},
        {
            "$inc": {"coins": amount, "total_earned": amount},
            "$set": {"updated_at": now.isoformat()},
            "$setOnInsert": {"created_at": now.isoformat()}
        },
        upsert=True
    )
    
    # Update leaderboard
    wallet = wallets_col.find_one({"user_id": user_id}, {"_id": 0})
    leaderboard_col.update_one(
        {"user_id": user_id},
        {
            "$set": {"coins": wallet.get("coins", 0), "updated_at": now.isoformat()},
            "$setOnInsert": {"created_at": now.isoformat()}
        },
        upsert=True
    )


# -------------------------
# WALLET
# -------------------------

@router.post("/wallet/create")
def create_wallet(user_id: str):
    """Create wallet for user with 50 starting coins"""
    now = datetime.now(timezone.utc)
    
    existing = wallets_col.find_one({"user_id": user_id})
    if existing:
        return {"coins": existing.get("coins", 0), "created": existing.get("created_at")}
    
    wallets_col.insert_one({
        "user_id": user_id,
        "coins": 50,
        "total_earned": 50,
        "created_at": now.isoformat()
    })
    
    return {"coins": 50, "created": now.isoformat()}


@router.get("/wallet/balance")
def wallet_balance(user_id: str):
    """Get user wallet balance"""
    wallet = wallets_col.find_one({"user_id": user_id}, {"_id": 0})
    return wallet if wallet else {"coins": 0}


# -------------------------
# DAILY REWARD
# -------------------------

@router.get("/reward/daily")
def daily_reward(user_id: str):
    """Claim daily reward (once per 24h)"""
    now = datetime.now(timezone.utc)
    today = now.date().isoformat()
    
    # Check if already claimed today
    claim = daily_claims_col.find_one({"user_id": user_id, "date": today})
    if claim:
        return {"error": "already claimed", "next_claim": "tomorrow"}
    
    reward = random.choice([5, 10, 15, 20, 50])
    
    add_coins(user_id, reward)
    
    # Record claim
    daily_claims_col.insert_one({
        "user_id": user_id,
        "date": today,
        "reward": reward,
        "claimed_at": now.isoformat()
    })
    
    wallet = wallets_col.find_one({"user_id": user_id}, {"_id": 0})
    
    return {
        "reward": reward,
        "balance": wallet.get("coins", 0)
    }


# -------------------------
# LUCKY WHEEL
# -------------------------

@router.post("/games/lucky-wheel")
def lucky_wheel(user_id: str):
    """Spin the lucky wheel"""
    now = datetime.now(timezone.utc)
    
    reward = random.choice([5, 10, 20, 50, 100])
    
    add_coins(user_id, reward)
    
    # Record game play
    game_plays_col.insert_one({
        "user_id": user_id,
        "game": "lucky_wheel",
        "reward": reward,
        "played_at": now.isoformat()
    })
    
    wallet = wallets_col.find_one({"user_id": user_id}, {"_id": 0})
    
    return {
        "game": "lucky wheel",
        "reward": reward,
        "balance": wallet.get("coins", 0)
    }


# -------------------------
# SCRATCH CARD
# -------------------------

@router.post("/games/scratch")
def scratch(user_id: str):
    """Scratch a card"""
    now = datetime.now(timezone.utc)
    
    reward = random.choice([0, 5, 10, 20, 100])
    
    if reward > 0:
        add_coins(user_id, reward)
    
    # Record game play
    game_plays_col.insert_one({
        "user_id": user_id,
        "game": "scratch",
        "reward": reward,
        "played_at": now.isoformat()
    })
    
    wallet = wallets_col.find_one({"user_id": user_id}, {"_id": 0})
    
    return {
        "game": "scratch",
        "reward": reward,
        "balance": wallet.get("coins", 0) if wallet else 0
    }


# -------------------------
# REACTION GAME
# -------------------------

@router.post("/games/reaction")
def reaction(user_id: str):
    """Play reaction game"""
    now = datetime.now(timezone.utc)
    
    reward = 5
    
    add_coins(user_id, reward)
    
    # Record game play
    game_plays_col.insert_one({
        "user_id": user_id,
        "game": "reaction",
        "reward": reward,
        "played_at": now.isoformat()
    })
    
    wallet = wallets_col.find_one({"user_id": user_id}, {"_id": 0})
    
    return {
        "game": "reaction",
        "reward": reward,
        "balance": wallet.get("coins", 0)
    }


# -------------------------
# REFERRAL
# -------------------------

@router.post("/referral/use")
def referral(inviter: str, new_user: str):
    """Use referral code"""
    now = datetime.now(timezone.utc)
    
    # Check if new_user already used a referral
    existing = referrals_col.find_one({"new_user": new_user})
    if existing:
        return {"error": "already used"}
    
    # Can't refer yourself
    if inviter == new_user:
        return {"error": "cannot refer yourself"}
    
    # Record referral
    referrals_col.insert_one({
        "inviter": inviter,
        "new_user": new_user,
        "created_at": now.isoformat()
    })
    
    # Reward both users
    add_coins(inviter, 100)
    add_coins(new_user, 50)
    
    return {
        "inviter_reward": 100,
        "new_user_reward": 50
    }


# -------------------------
# LEADERBOARD
# -------------------------

@router.get("/leaderboard")
def get_leaderboard():
    """Get top 10 players"""
    top = list(leaderboard_col.find(
        {},
        {"_id": 0, "user_id": 1, "coins": 1}
    ).sort("coins", -1).limit(10))
    
    return {"leaderboard": top}
