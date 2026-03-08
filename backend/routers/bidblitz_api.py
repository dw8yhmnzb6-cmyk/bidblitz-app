"""
BidBlitz Coins & Leaderboard API
With MongoDB Persistence
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timezone
import uuid

from config import db, logger
from dependencies import get_current_user

router = APIRouter(prefix="/api/bbz", tags=["BidBlitz Economy"])

# ═══════════════════════════════════
# MODELS
# ═══════════════════════════════════

class CoinUpdate(BaseModel):
    user_id: str
    amount: int
    source: str

class LeaderboardEntry(BaseModel):
    user_id: str
    name: str
    score: int
    game: Optional[str] = None

class GameRewardRequest(BaseModel):
    user_id: str
    game: str
    won: bool
    score: Optional[int] = 0

class RidePaymentRequest(BaseModel):
    user_id: str
    ride_type: str

# ═══════════════════════════════════
# GAME CONFIGURATIONS
# ═══════════════════════════════════

GAME_REWARDS = {
    "candy_match": {"base": 10, "max": 50},
    "lucky_wheel": {"base": 5, "max": 100},
    "reaction": {"base": 5, "max": 25},
    "snake": {"base": 10, "max": 75},
    "puzzle": {"base": 15, "max": 100},
    "coinflip": {"base": 10, "max": 50},
    "dice": {"base": 5, "max": 30},
    "slots": {"base": 5, "max": 200},
    "treasure_hunt": {"base": 20, "max": 150},
    "daily_bonus": {"base": 50, "max": 50},
    "match3": {"base": 10, "max": 60},
    "memory": {"base": 15, "max": 80},
}

RIDE_COSTS = {
    "taxi": 50,
    "scooter": 20,
    "bike": 10,
    "premium_taxi": 100
}

# ═══════════════════════════════════
# COINS API
# ═══════════════════════════════════

@router.get("/coins/{user_id}")
async def get_coins(user_id: str):
    """Get user's coin balance"""
    wallet = await db.bbz_wallets.find_one({"user_id": user_id}, {"_id": 0})
    
    if not wallet:
        # Initialize wallet for new user
        wallet = {
            "user_id": user_id,
            "coins": 100,  # Starting bonus
            "total_earned": 100,
            "total_spent": 0,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.bbz_wallets.insert_one(wallet)
    
    return {
        "user_id": user_id, 
        "coins": wallet.get("coins", 0),
        "total_earned": wallet.get("total_earned", 0),
        "total_spent": wallet.get("total_spent", 0)
    }

@router.post("/coins/earn")
async def earn_coins(data: CoinUpdate):
    """Add coins (from games, mining, rewards)"""
    wallet = await db.bbz_wallets.find_one({"user_id": data.user_id})
    
    if not wallet:
        # Create new wallet
        wallet = {
            "user_id": data.user_id,
            "coins": 0,
            "total_earned": 0,
            "total_spent": 0,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.bbz_wallets.insert_one(wallet)
    
    new_balance = wallet.get("coins", 0) + data.amount
    new_total_earned = wallet.get("total_earned", 0) + data.amount
    
    await db.bbz_wallets.update_one(
        {"user_id": data.user_id},
        {"$set": {
            "coins": new_balance,
            "total_earned": new_total_earned,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Log transaction
    await db.bbz_transactions.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": data.user_id,
        "type": "earn",
        "amount": data.amount,
        "source": data.source,
        "balance_after": new_balance,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    logger.info(f"💰 User {data.user_id} earned {data.amount} coins from {data.source}")
    
    return {"success": True, "new_balance": new_balance, "earned": data.amount}

@router.post("/coins/spend")
async def spend_coins(data: CoinUpdate):
    """Spend coins (taxi, scooter, purchases)"""
    wallet = await db.bbz_wallets.find_one({"user_id": data.user_id})
    
    if not wallet:
        raise HTTPException(status_code=404, detail="Wallet not found")
    
    current = wallet.get("coins", 0)
    
    if current < data.amount:
        raise HTTPException(status_code=400, detail=f"Not enough coins. Have: {current}, Need: {data.amount}")
    
    new_balance = current - data.amount
    new_total_spent = wallet.get("total_spent", 0) + data.amount
    
    await db.bbz_wallets.update_one(
        {"user_id": data.user_id},
        {"$set": {
            "coins": new_balance,
            "total_spent": new_total_spent,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Log transaction
    await db.bbz_transactions.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": data.user_id,
        "type": "spend",
        "amount": data.amount,
        "source": data.source,
        "balance_after": new_balance,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    logger.info(f"💸 User {data.user_id} spent {data.amount} coins on {data.source}")
    
    return {"success": True, "new_balance": new_balance, "spent": data.amount}

@router.get("/coins/transactions/{user_id}")
async def get_transactions(user_id: str, limit: int = 50):
    """Get user's transaction history"""
    transactions = await db.bbz_transactions.find(
        {"user_id": user_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(limit)
    
    return {"transactions": transactions, "count": len(transactions)}

# ═══════════════════════════════════
# LEADERBOARD API
# ═══════════════════════════════════

@router.get("/leaderboard")
async def get_leaderboard(limit: int = 20, game: Optional[str] = None):
    """Get top players - overall or by game"""
    query = {}
    if game:
        query["game"] = game
    
    entries = await db.bbz_leaderboard.find(
        query,
        {"_id": 0}
    ).sort("score", -1).to_list(limit)
    
    # Add rank
    for i, entry in enumerate(entries):
        entry["rank"] = i + 1
    
    return {"leaderboard": entries, "count": len(entries)}

@router.post("/leaderboard/update")
async def update_leaderboard(entry: LeaderboardEntry):
    """Update or add leaderboard entry"""
    existing = await db.bbz_leaderboard.find_one({
        "user_id": entry.user_id,
        "game": entry.game or "overall"
    })
    
    if existing:
        if entry.score > existing.get("score", 0):
            await db.bbz_leaderboard.update_one(
                {"user_id": entry.user_id, "game": entry.game or "overall"},
                {"$set": {
                    "score": entry.score,
                    "name": entry.name,
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }}
            )
            return {"success": True, "message": "Score updated", "new_high_score": True}
        return {"success": True, "message": "Score not higher than current"}
    else:
        await db.bbz_leaderboard.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": entry.user_id,
            "name": entry.name,
            "score": entry.score,
            "game": entry.game or "overall",
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        return {"success": True, "message": "New entry added"}

@router.get("/leaderboard/user/{user_id}")
async def get_user_rank(user_id: str, game: Optional[str] = None):
    """Get user's rank on leaderboard"""
    query = {"game": game or "overall"}
    
    # Get all entries sorted by score
    all_entries = await db.bbz_leaderboard.find(
        query,
        {"_id": 0}
    ).sort("score", -1).to_list(1000)
    
    # Find user's position
    for i, entry in enumerate(all_entries):
        if entry["user_id"] == user_id:
            return {
                "user_id": user_id,
                "rank": i + 1,
                "score": entry["score"],
                "total_players": len(all_entries)
            }
    
    return {"user_id": user_id, "rank": None, "message": "User not on leaderboard"}

# ═══════════════════════════════════
# GAME REWARDS API
# ═══════════════════════════════════

@router.post("/games/reward")
async def claim_game_reward(request: GameRewardRequest):
    """Claim reward for winning a game"""
    if not request.won:
        return {"success": False, "message": "No reward for losing", "reward": 0}
    
    game_config = GAME_REWARDS.get(request.game)
    if not game_config:
        game_config = {"base": 10, "max": 50}
    
    # Calculate reward based on score
    base_reward = game_config["base"]
    max_reward = game_config["max"]
    
    # Higher scores = better rewards (capped at max)
    score_bonus = min(request.score // 10, max_reward - base_reward) if request.score else 0
    reward = base_reward + score_bonus
    
    # Add coins to wallet
    wallet = await db.bbz_wallets.find_one({"user_id": request.user_id})
    
    if not wallet:
        wallet = {
            "user_id": request.user_id,
            "coins": 0,
            "total_earned": 0,
            "total_spent": 0,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.bbz_wallets.insert_one(wallet)
    
    new_balance = wallet.get("coins", 0) + reward
    
    await db.bbz_wallets.update_one(
        {"user_id": request.user_id},
        {"$set": {
            "coins": new_balance,
            "total_earned": wallet.get("total_earned", 0) + reward,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Log game transaction
    await db.bbz_transactions.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": request.user_id,
        "type": "game_reward",
        "amount": reward,
        "source": f"game:{request.game}",
        "score": request.score,
        "balance_after": new_balance,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    # Update leaderboard
    await update_leaderboard(LeaderboardEntry(
        user_id=request.user_id,
        name=request.user_id[:8],
        score=request.score or reward,
        game=request.game
    ))
    
    logger.info(f"🎮 User {request.user_id} won {reward} coins from {request.game}")
    
    return {
        "success": True, 
        "reward": reward, 
        "new_balance": new_balance,
        "game": request.game,
        "score": request.score
    }

@router.get("/games/stats/{user_id}")
async def get_game_stats(user_id: str):
    """Get user's game statistics"""
    # Get game transactions
    game_txs = await db.bbz_transactions.find(
        {"user_id": user_id, "type": "game_reward"},
        {"_id": 0}
    ).to_list(1000)
    
    # Calculate stats per game
    stats = {}
    total_earned = 0
    total_games = len(game_txs)
    
    for tx in game_txs:
        game = tx.get("source", "unknown").replace("game:", "")
        if game not in stats:
            stats[game] = {"plays": 0, "earned": 0, "best_score": 0}
        stats[game]["plays"] += 1
        stats[game]["earned"] += tx.get("amount", 0)
        stats[game]["best_score"] = max(stats[game]["best_score"], tx.get("score", 0))
        total_earned += tx.get("amount", 0)
    
    return {
        "user_id": user_id,
        "total_games": total_games,
        "total_earned": total_earned,
        "games": stats
    }

# ═══════════════════════════════════
# RIDE PAYMENTS API
# ═══════════════════════════════════

@router.post("/rides/pay")
async def pay_for_ride(request: RidePaymentRequest):
    """Pay for a ride with coins"""
    cost = RIDE_COSTS.get(request.ride_type)
    if not cost:
        raise HTTPException(status_code=400, detail=f"Invalid ride type: {request.ride_type}")
    
    wallet = await db.bbz_wallets.find_one({"user_id": request.user_id})
    
    if not wallet:
        raise HTTPException(status_code=404, detail="Wallet not found. Play some games first!")
    
    current = wallet.get("coins", 0)
    if current < cost:
        raise HTTPException(
            status_code=400, 
            detail=f"Not enough coins. Have: {current}, Need: {cost}"
        )
    
    new_balance = current - cost
    
    await db.bbz_wallets.update_one(
        {"user_id": request.user_id},
        {"$set": {
            "coins": new_balance,
            "total_spent": wallet.get("total_spent", 0) + cost,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Log ride transaction
    ride_id = str(uuid.uuid4())
    await db.bbz_transactions.insert_one({
        "id": ride_id,
        "user_id": request.user_id,
        "type": "ride_payment",
        "amount": cost,
        "source": f"ride:{request.ride_type}",
        "balance_after": new_balance,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    # Create ride record
    await db.bbz_rides.insert_one({
        "id": ride_id,
        "user_id": request.user_id,
        "ride_type": request.ride_type,
        "cost": cost,
        "status": "paid",
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    logger.info(f"🚕 User {request.user_id} paid {cost} coins for {request.ride_type}")
    
    return {
        "success": True, 
        "ride_id": ride_id,
        "cost": cost, 
        "new_balance": new_balance,
        "ride_type": request.ride_type
    }

@router.get("/rides/history/{user_id}")
async def get_ride_history(user_id: str, limit: int = 20):
    """Get user's ride history"""
    rides = await db.bbz_rides.find(
        {"user_id": user_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(limit)
    
    return {"rides": rides, "count": len(rides)}

@router.get("/rides/prices")
async def get_ride_prices():
    """Get current ride prices"""
    return {"prices": RIDE_COSTS}

# ═══════════════════════════════════
# DAILY BONUS API
# ═══════════════════════════════════

@router.post("/daily-bonus/{user_id}")
async def claim_daily_bonus(user_id: str):
    """Claim daily login bonus"""
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    # Check if already claimed today
    existing = await db.bbz_daily_claims.find_one({
        "user_id": user_id,
        "date": today
    })
    
    if existing:
        return {
            "success": False, 
            "message": "Already claimed today",
            "next_claim": "tomorrow"
        }
    
    # Calculate streak bonus
    yesterday = (datetime.now(timezone.utc) - timedelta(days=1)).strftime("%Y-%m-%d")
    yesterday_claim = await db.bbz_daily_claims.find_one({
        "user_id": user_id,
        "date": yesterday
    })
    
    streak = (yesterday_claim.get("streak", 0) + 1) if yesterday_claim else 1
    
    # Bonus increases with streak (max 7 days = 100 coins)
    base_bonus = 20
    streak_bonus = min(streak - 1, 6) * 10  # +10 per day, max +60
    total_bonus = base_bonus + streak_bonus + (50 if streak == 7 else 0)  # Day 7 = extra 50
    
    # Reset streak after day 7
    if streak > 7:
        streak = 1
        total_bonus = base_bonus
    
    # Add coins
    wallet = await db.bbz_wallets.find_one({"user_id": user_id})
    if not wallet:
        wallet = {"coins": 0, "total_earned": 0, "total_spent": 0}
        await db.bbz_wallets.insert_one({
            "user_id": user_id,
            **wallet,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
    
    new_balance = wallet.get("coins", 0) + total_bonus
    
    await db.bbz_wallets.update_one(
        {"user_id": user_id},
        {"$set": {
            "coins": new_balance,
            "total_earned": wallet.get("total_earned", 0) + total_bonus,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Record claim
    await db.bbz_daily_claims.insert_one({
        "user_id": user_id,
        "date": today,
        "streak": streak,
        "bonus": total_bonus,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    # Log transaction
    await db.bbz_transactions.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "type": "daily_bonus",
        "amount": total_bonus,
        "source": f"daily_bonus:day_{streak}",
        "balance_after": new_balance,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    logger.info(f"🎁 User {user_id} claimed daily bonus: {total_bonus} coins (Day {streak})")
    
    return {
        "success": True,
        "bonus": total_bonus,
        "streak": streak,
        "new_balance": new_balance,
        "message": f"Day {streak} bonus claimed!"
    }

@router.get("/daily-bonus/status/{user_id}")
async def get_daily_bonus_status(user_id: str):
    """Check daily bonus status"""
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    claim = await db.bbz_daily_claims.find_one({
        "user_id": user_id,
        "date": today
    })
    
    if claim:
        return {
            "claimed_today": True,
            "streak": claim.get("streak", 1),
            "bonus_claimed": claim.get("bonus", 0)
        }
    
    # Get yesterday's streak
    yesterday = (datetime.now(timezone.utc) - timedelta(days=1)).strftime("%Y-%m-%d")
    yesterday_claim = await db.bbz_daily_claims.find_one({
        "user_id": user_id,
        "date": yesterday
    })
    
    current_streak = (yesterday_claim.get("streak", 0) + 1) if yesterday_claim else 1
    if current_streak > 7:
        current_streak = 1
    
    # Calculate potential bonus
    base_bonus = 20
    streak_bonus = min(current_streak - 1, 6) * 10
    potential_bonus = base_bonus + streak_bonus + (50 if current_streak == 7 else 0)
    
    return {
        "claimed_today": False,
        "current_streak": current_streak,
        "potential_bonus": potential_bonus,
        "message": f"Claim your Day {current_streak} bonus!"
    }

# Import missing
from datetime import timedelta

# ═══════════════════════════════════
# MINING API
# ═══════════════════════════════════

# Miner Types Configuration
MINER_TYPES = {
    "basic": {"name": "Basic Miner B1", "base_hashrate": 1.5, "price": 100, "tier": "bronze"},
    "nano": {"name": "Nano Miner S1", "base_hashrate": 0.65, "price": 50, "tier": "bronze"},
    "pro": {"name": "Pro Miner P1", "base_hashrate": 5.5, "price": 300, "tier": "silver"},
    "elite": {"name": "Elite Miner E1", "base_hashrate": 15.0, "price": 800, "tier": "gold"},
    "ultra": {"name": "Ultra Miner U1", "base_hashrate": 50.0, "price": 2000, "tier": "platinum"},
    "bonus": {"name": "Bonus Miner", "base_hashrate": 16.0, "price": 0, "tier": "gold"},
}

class MinerCreate(BaseModel):
    user_id: str
    miner_type: str

class MinerUpgrade(BaseModel):
    user_id: str
    miner_id: str

class MinerSell(BaseModel):
    user_id: str
    miner_id: str

@router.get("/miners/{user_id}")
async def get_user_miners(user_id: str):
    """Get all miners owned by user"""
    miners = await db.bbz_miners.find(
        {"user_id": user_id, "active": True},
        {"_id": 0}
    ).to_list(100)
    
    # Calculate totals
    total_hashrate = sum(m.get("hashrate", 0) for m in miners)
    daily_btc = total_hashrate * 0.00000001 * 24  # Simplified calculation
    
    return {
        "miners": miners,
        "count": len(miners),
        "total_hashrate": round(total_hashrate, 2),
        "daily_btc": f"{daily_btc:.8f}",
        "estimated_daily_coins": int(total_hashrate * 10)
    }

@router.post("/miners/create")
async def create_miner(data: MinerCreate):
    """Buy a new miner"""
    miner_config = MINER_TYPES.get(data.miner_type)
    if not miner_config:
        raise HTTPException(status_code=400, detail="Invalid miner type")
    
    # Check wallet
    wallet = await db.bbz_wallets.find_one({"user_id": data.user_id})
    if not wallet:
        raise HTTPException(status_code=404, detail="Wallet not found")
    
    price = miner_config["price"]
    if wallet.get("coins", 0) < price:
        raise HTTPException(status_code=400, detail=f"Not enough coins. Need {price}, have {wallet.get('coins', 0)}")
    
    # Deduct coins
    new_balance = wallet.get("coins", 0) - price
    await db.bbz_wallets.update_one(
        {"user_id": data.user_id},
        {"$set": {
            "coins": new_balance,
            "total_spent": wallet.get("total_spent", 0) + price,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Create miner
    miner_id = str(uuid.uuid4())[:8]
    miner = {
        "id": miner_id,
        "user_id": data.user_id,
        "type": data.miner_type,
        "name": miner_config["name"],
        "hashrate": miner_config["base_hashrate"],
        "tier": miner_config["tier"],
        "level": 1,
        "efficiency": 15,  # W/TH
        "active": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.bbz_miners.insert_one(miner)
    
    # Log transaction
    await db.bbz_transactions.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": data.user_id,
        "type": "miner_purchase",
        "amount": price,
        "source": f"miner:{data.miner_type}",
        "balance_after": new_balance,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    logger.info(f"⛏️ User {data.user_id} bought {miner_config['name']} for {price} coins")
    
    return {
        "success": True,
        "miner": {k: v for k, v in miner.items() if k != "_id"},
        "new_balance": new_balance,
        "cost": price
    }

@router.post("/miners/upgrade")
async def upgrade_miner(data: MinerUpgrade):
    """Upgrade a miner to next level"""
    # Find miner
    miner = await db.bbz_miners.find_one({
        "id": data.miner_id,
        "user_id": data.user_id,
        "active": True
    })
    
    if not miner:
        raise HTTPException(status_code=404, detail="Miner not found")
    
    current_level = miner.get("level", 1)
    if current_level >= 10:
        raise HTTPException(status_code=400, detail="Miner already at max level")
    
    # Calculate upgrade cost (increases per level)
    upgrade_cost = current_level * 50  # 50, 100, 150, 200...
    
    # Check wallet
    wallet = await db.bbz_wallets.find_one({"user_id": data.user_id})
    if not wallet or wallet.get("coins", 0) < upgrade_cost:
        raise HTTPException(
            status_code=400, 
            detail=f"Not enough coins. Need {upgrade_cost}, have {wallet.get('coins', 0) if wallet else 0}"
        )
    
    # Deduct coins
    new_balance = wallet.get("coins", 0) - upgrade_cost
    await db.bbz_wallets.update_one(
        {"user_id": data.user_id},
        {"$set": {
            "coins": new_balance,
            "total_spent": wallet.get("total_spent", 0) + upgrade_cost,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Upgrade miner (hashrate increases by 15% per level)
    new_level = current_level + 1
    new_hashrate = round(miner.get("hashrate", 1) * 1.15, 2)
    
    await db.bbz_miners.update_one(
        {"id": data.miner_id},
        {"$set": {
            "level": new_level,
            "hashrate": new_hashrate,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Log transaction
    await db.bbz_transactions.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": data.user_id,
        "type": "miner_upgrade",
        "amount": upgrade_cost,
        "source": f"upgrade:miner_{data.miner_id}:lv{new_level}",
        "balance_after": new_balance,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    logger.info(f"⬆️ User {data.user_id} upgraded miner {data.miner_id} to Lv.{new_level}")
    
    return {
        "success": True,
        "miner_id": data.miner_id,
        "new_level": new_level,
        "new_hashrate": new_hashrate,
        "cost": upgrade_cost,
        "new_balance": new_balance
    }

@router.post("/miners/sell")
async def sell_miner(data: MinerSell):
    """Sell a miner back for coins"""
    # Find miner
    miner = await db.bbz_miners.find_one({
        "id": data.miner_id,
        "user_id": data.user_id,
        "active": True
    })
    
    if not miner:
        raise HTTPException(status_code=404, detail="Miner not found")
    
    # Calculate sell value (50% of base price + level bonus)
    miner_type = miner.get("type", "basic")
    base_price = MINER_TYPES.get(miner_type, {}).get("price", 100)
    level_bonus = (miner.get("level", 1) - 1) * 25
    sell_value = int(base_price * 0.5) + level_bonus
    
    # Add coins to wallet
    wallet = await db.bbz_wallets.find_one({"user_id": data.user_id})
    if not wallet:
        wallet = {"coins": 0, "total_earned": 0}
    
    new_balance = wallet.get("coins", 0) + sell_value
    await db.bbz_wallets.update_one(
        {"user_id": data.user_id},
        {"$set": {
            "coins": new_balance,
            "total_earned": wallet.get("total_earned", 0) + sell_value,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }},
        upsert=True
    )
    
    # Deactivate miner
    await db.bbz_miners.update_one(
        {"id": data.miner_id},
        {"$set": {
            "active": False,
            "sold_at": datetime.now(timezone.utc).isoformat(),
            "sell_value": sell_value
        }}
    )
    
    # Log transaction
    await db.bbz_transactions.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": data.user_id,
        "type": "miner_sold",
        "amount": sell_value,
        "source": f"sell:miner_{data.miner_id}",
        "balance_after": new_balance,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    logger.info(f"💰 User {data.user_id} sold miner {data.miner_id} for {sell_value} coins")
    
    return {
        "success": True,
        "miner_id": data.miner_id,
        "sell_value": sell_value,
        "new_balance": new_balance
    }

@router.post("/miners/claim-rewards/{user_id}")
async def claim_mining_rewards(user_id: str):
    """Claim accumulated mining rewards"""
    miners = await db.bbz_miners.find(
        {"user_id": user_id, "active": True}
    ).to_list(100)
    
    if not miners:
        raise HTTPException(status_code=404, detail="No active miners found")
    
    # Calculate rewards based on hashrate and time since last claim
    total_hashrate = sum(m.get("hashrate", 0) for m in miners)
    
    # Check last claim time
    last_claim = await db.bbz_mining_claims.find_one(
        {"user_id": user_id},
        sort=[("created_at", -1)]
    )
    
    if last_claim:
        last_claim_time = datetime.fromisoformat(last_claim.get("created_at", "2020-01-01"))
        hours_since = (datetime.now(timezone.utc) - last_claim_time).total_seconds() / 3600
        if hours_since < 1:
            raise HTTPException(status_code=400, detail=f"Wait {int(60 - hours_since * 60)} more minutes")
    else:
        hours_since = 1
    
    # Calculate reward (coins per hour per TH)
    reward = int(total_hashrate * hours_since * 2)  # 2 coins per TH per hour
    if reward < 1:
        reward = 1
    
    # Add to wallet
    wallet = await db.bbz_wallets.find_one({"user_id": user_id})
    if not wallet:
        wallet = {"coins": 0, "total_earned": 0}
    
    new_balance = wallet.get("coins", 0) + reward
    await db.bbz_wallets.update_one(
        {"user_id": user_id},
        {"$set": {
            "coins": new_balance,
            "total_earned": wallet.get("total_earned", 0) + reward,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }},
        upsert=True
    )
    
    # Record claim
    await db.bbz_mining_claims.insert_one({
        "user_id": user_id,
        "reward": reward,
        "hashrate": total_hashrate,
        "hours": round(hours_since, 2),
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    logger.info(f"⛏️ User {user_id} claimed {reward} mining coins")
    
    return {
        "success": True,
        "reward": reward,
        "new_balance": new_balance,
        "hashrate": total_hashrate
    }

@router.get("/miners/shop")
async def get_miner_shop():
    """Get available miners for purchase"""
    return {
        "miners": [
            {
                "type": k,
                "name": v["name"],
                "price": v["price"],
                "hashrate": v["base_hashrate"],
                "tier": v["tier"]
            }
            for k, v in MINER_TYPES.items()
            if v["price"] > 0  # Exclude free bonus miner
        ]
    }

@router.get("/miners/pool-stats")
async def get_pool_stats():
    """Get global mining pool statistics"""
    # Get total active miners across all users
    total_miners = await db.bbz_miners.count_documents({"active": True})
    
    # Get total hashrate
    pipeline = [
        {"$match": {"active": True}},
        {"$group": {"_id": None, "total": {"$sum": "$hashrate"}}}
    ]
    result = await db.bbz_miners.aggregate(pipeline).to_list(1)
    total_hashrate = result[0]["total"] if result else 0
    
    return {
        "total_hashrate": round(total_hashrate, 2),
        "total_miners": total_miners,
        "block_height": 832145 + random.randint(0, 1000),
        "next_block_reward": 6.25,
        "pool_luck": random.randint(85, 115),
        "estimated_daily_btc": f"{total_hashrate * 0.00000001 * 24:.8f}"
    }

@router.post("/miners/give-bonus/{user_id}")
async def give_bonus_miner(user_id: str):
    """Give a free bonus miner to new user (once only)"""
    # Check if already received
    existing = await db.bbz_miners.find_one({
        "user_id": user_id,
        "type": "bonus"
    })
    
    if existing:
        raise HTTPException(status_code=400, detail="Bonus miner already claimed")
    
    # Create bonus miner
    bonus_config = MINER_TYPES["bonus"]
    miner_id = f"BONUS-{str(uuid.uuid4())[:4].upper()}"
    
    miner = {
        "id": miner_id,
        "user_id": user_id,
        "type": "bonus",
        "name": bonus_config["name"],
        "hashrate": bonus_config["base_hashrate"],
        "tier": bonus_config["tier"],
        "level": 1,
        "efficiency": 15,
        "active": True,
        "is_bonus": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.bbz_miners.insert_one(miner)
    
    logger.info(f"🎁 User {user_id} received bonus miner")
    
    return {
        "success": True,
        "miner": {k: v for k, v in miner.items() if k != "_id"},
        "message": "Bonus miner activated!"
    }
