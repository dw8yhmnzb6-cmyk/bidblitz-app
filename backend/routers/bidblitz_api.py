"""
BidBlitz Coins & Leaderboard API
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
import os

router = APIRouter(prefix="/api/bbz", tags=["bidblitz"])

# In-memory storage (replace with MongoDB in production)
coins_db = {}
leaderboard_db = []
transactions_db = {}

class CoinUpdate(BaseModel):
    user_id: str
    amount: int
    source: str

class LeaderboardEntry(BaseModel):
    user_id: str
    name: str
    score: int

# ═══════════════════════════════════
# COINS API
# ═══════════════════════════════════

@router.get("/coins/{user_id}")
async def get_coins(user_id: str):
    """Get user's coin balance"""
    return {"user_id": user_id, "coins": coins_db.get(user_id, 0)}

@router.post("/coins/earn")
async def earn_coins(data: CoinUpdate):
    """Add coins (from games, mining, rewards)"""
    current = coins_db.get(data.user_id, 0)
    coins_db[data.user_id] = current + data.amount
    
    # Log transaction
    if data.user_id not in transactions_db:
        transactions_db[data.user_id] = []
    transactions_db[data.user_id].append({
        "type": "earn",
        "amount": data.amount,
        "source": data.source,
        "time": datetime.now().isoformat()
    })
    
    return {"success": True, "new_balance": coins_db[data.user_id]}

@router.post("/coins/spend")
async def spend_coins(data: CoinUpdate):
    """Spend coins (taxi, scooter, purchases)"""
    current = coins_db.get(data.user_id, 0)
    
    if current < data.amount:
        raise HTTPException(status_code=400, detail="Not enough coins")
    
    coins_db[data.user_id] = current - data.amount
    
    # Log transaction
    if data.user_id not in transactions_db:
        transactions_db[data.user_id] = []
    transactions_db[data.user_id].append({
        "type": "spend",
        "amount": data.amount,
        "source": data.source,
        "time": datetime.now().isoformat()
    })
    
    return {"success": True, "new_balance": coins_db[data.user_id]}

@router.get("/coins/transactions/{user_id}")
async def get_transactions(user_id: str):
    """Get user's transaction history"""
    return {"transactions": transactions_db.get(user_id, [])[-50:]}

# ═══════════════════════════════════
# LEADERBOARD API
# ═══════════════════════════════════

@router.get("/leaderboard")
async def get_leaderboard(limit: int = 10):
    """Get top players"""
    sorted_lb = sorted(leaderboard_db, key=lambda x: x["score"], reverse=True)
    return {"leaderboard": sorted_lb[:limit]}

@router.post("/leaderboard/update")
async def update_leaderboard(entry: LeaderboardEntry):
    """Update or add leaderboard entry"""
    existing = next((e for e in leaderboard_db if e["user_id"] == entry.user_id), None)
    
    if existing:
        if entry.score > existing["score"]:
            existing["score"] = entry.score
    else:
        leaderboard_db.append({
            "user_id": entry.user_id,
            "name": entry.name,
            "score": entry.score
        })
    
    return {"success": True}

# ═══════════════════════════════════
# GAME REWARDS API
# ═══════════════════════════════════

GAME_REWARDS = {
    "candy_match": 10,
    "lucky_wheel": 20,
    "reaction": 5,
    "snake": 15,
    "puzzle": 25,
    "coinflip": 20
}

@router.post("/games/reward")
async def claim_game_reward(user_id: str, game: str, won: bool):
    """Claim reward for winning a game"""
    if not won:
        return {"success": False, "message": "No reward for losing"}
    
    reward = GAME_REWARDS.get(game, 10)
    current = coins_db.get(user_id, 0)
    coins_db[user_id] = current + reward
    
    return {"success": True, "reward": reward, "new_balance": coins_db[user_id]}

# ═══════════════════════════════════
# RIDE PAYMENTS API
# ═══════════════════════════════════

RIDE_COSTS = {
    "taxi": 50,
    "scooter": 20,
    "bike": 10
}

@router.post("/rides/pay")
async def pay_for_ride(user_id: str, ride_type: str):
    """Pay for a ride"""
    cost = RIDE_COSTS.get(ride_type)
    if not cost:
        raise HTTPException(status_code=400, detail="Invalid ride type")
    
    current = coins_db.get(user_id, 0)
    if current < cost:
        raise HTTPException(status_code=400, detail="Not enough coins")
    
    coins_db[user_id] = current - cost
    
    return {"success": True, "cost": cost, "new_balance": coins_db[user_id]}
