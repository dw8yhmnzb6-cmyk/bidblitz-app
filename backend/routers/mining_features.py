"""
Mining Features Router - BidBlitz Crypto Mining Simulation
GoMining-style mining game with miners, rewards, and VIP levels
"""
from fastapi import APIRouter, HTTPException, Depends, Header
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
from bson import ObjectId
import os

# Database
from pymongo import MongoClient

MONGO_URL = os.environ.get("MONGO_URL")
client = MongoClient(MONGO_URL)
db = client[os.environ.get("DB_NAME", "bidblitz")]

# Collections
miners_col = db["app_miners"]
wallets_col = db["app_wallets"]
mining_history_col = db["mining_history"]
miner_market_col = db["miner_market"]

router = APIRouter(prefix="/api/app", tags=["mining"])

# ======================== MODELS ========================

class MinerType(BaseModel):
    id: str
    name: str
    hashrate: float  # TH/s
    power: int  # Watts
    daily_reward: float  # Coins per day
    price: int  # In coins
    image: str
    tier: str  # bronze, silver, gold, platinum, diamond

class BuyMinerRequest(BaseModel):
    miner_type_id: str

class UpgradeMinerRequest(BaseModel):
    miner_id: str

# ======================== MINER CATALOG ========================

MINER_TYPES = {
    "starter_1": {
        "id": "starter_1",
        "name": "Nano Miner S1",
        "hashrate": 0.5,
        "power": 50,
        "daily_reward": 5,
        "price": 100,
        "image": "https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=200",
        "tier": "bronze"
    },
    "basic_1": {
        "id": "basic_1",
        "name": "Basic Miner B1",
        "hashrate": 1.5,
        "power": 120,
        "daily_reward": 15,
        "price": 500,
        "image": "https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=200",
        "tier": "silver"
    },
    "pro_1": {
        "id": "pro_1",
        "name": "Pro Miner P1",
        "hashrate": 5.0,
        "power": 350,
        "daily_reward": 50,
        "price": 2000,
        "image": "https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=200",
        "tier": "gold"
    },
    "elite_1": {
        "id": "elite_1",
        "name": "Elite Miner E1",
        "hashrate": 15.0,
        "power": 800,
        "daily_reward": 150,
        "price": 8000,
        "image": "https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=200",
        "tier": "platinum"
    },
    "ultra_1": {
        "id": "ultra_1",
        "name": "Ultra Miner U1",
        "hashrate": 50.0,
        "power": 2000,
        "daily_reward": 500,
        "price": 25000,
        "image": "https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=200",
        "tier": "diamond"
    }
}

# ======================== HELPER FUNCTIONS ========================

def get_user_id_from_token(authorization: str = Header(None)) -> str:
    """Extract user_id from token - simplified for demo"""
    if not authorization:
        return "demo_user"
    # In production, decode JWT token
    return authorization.replace("Bearer ", "")[:24] if authorization else "demo_user"

def calculate_total_stats(miners: List[dict]) -> dict:
    """Calculate total hashrate, power, and daily rewards"""
    total_hashrate = 0
    total_power = 0
    total_daily = 0
    
    for miner in miners:
        miner_type = MINER_TYPES.get(miner.get("type_id"))
        if miner_type:
            level = miner.get("level", 1)
            multiplier = 1 + (level - 1) * 0.1  # 10% boost per level
            total_hashrate += miner_type["hashrate"] * multiplier
            total_power += miner_type["power"]
            total_daily += miner_type["daily_reward"] * multiplier
    
    return {
        "total_hashrate": round(total_hashrate, 2),
        "total_power": total_power,
        "total_daily_reward": round(total_daily, 2)
    }

# ======================== WALLET ENDPOINTS ========================

@router.get("/wallet/balance")
async def get_wallet_balance(authorization: str = Header(None)):
    """Get user's coin balance"""
    user_id = get_user_id_from_token(authorization)
    
    wallet = wallets_col.find_one({"user_id": user_id}, {"_id": 0})
    if not wallet:
        # Create new wallet with starting coins
        wallet = {
            "user_id": user_id,
            "coins": 1000,  # Starting balance
            "total_earned": 0,
            "total_spent": 0,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        wallets_col.insert_one(wallet)
    
    return {"coins": wallet.get("coins", 0), "total_earned": wallet.get("total_earned", 0)}

@router.post("/wallet/add-coins")
async def add_coins(amount: int = 1000, authorization: str = Header(None)):
    """Add coins to wallet (for testing)"""
    user_id = get_user_id_from_token(authorization)
    
    result = wallets_col.update_one(
        {"user_id": user_id},
        {
            "$inc": {"coins": amount},
            "$setOnInsert": {"created_at": datetime.now(timezone.utc).isoformat()}
        },
        upsert=True
    )
    
    wallet = wallets_col.find_one({"user_id": user_id}, {"_id": 0})
    return {"success": True, "new_balance": wallet.get("coins", 0)}

# ======================== MINER ENDPOINTS ========================

@router.get("/miners/catalog")
async def get_miner_catalog():
    """Get all available miner types"""
    return {"miners": list(MINER_TYPES.values())}

@router.get("/miners/my")
async def get_my_miners(authorization: str = Header(None)):
    """Get user's owned miners"""
    user_id = get_user_id_from_token(authorization)
    
    user_data = miners_col.find_one({"user_id": user_id}, {"_id": 0})
    miners = user_data.get("miners", []) if user_data else []
    
    # Enrich with miner type info
    enriched_miners = []
    for miner in miners:
        miner_type = MINER_TYPES.get(miner.get("type_id"))
        if miner_type:
            level = miner.get("level", 1)
            multiplier = 1 + (level - 1) * 0.1
            enriched_miners.append({
                **miner,
                "name": miner_type["name"],
                "hashrate": round(miner_type["hashrate"] * multiplier, 2),
                "power": miner_type["power"],
                "daily_reward": round(miner_type["daily_reward"] * multiplier, 2),
                "image": miner_type["image"],
                "tier": miner_type["tier"],
                "base_price": miner_type["price"]
            })
    
    stats = calculate_total_stats(miners)
    
    return {
        "miners": enriched_miners,
        "count": len(enriched_miners),
        "stats": stats
    }

@router.post("/miner/buy")
async def buy_miner(request: BuyMinerRequest, authorization: str = Header(None)):
    """Purchase a new miner"""
    user_id = get_user_id_from_token(authorization)
    miner_type = MINER_TYPES.get(request.miner_type_id)
    
    if not miner_type:
        raise HTTPException(status_code=400, detail="Ungültiger Miner-Typ")
    
    # Check wallet balance
    wallet = wallets_col.find_one({"user_id": user_id})
    current_coins = wallet.get("coins", 0) if wallet else 0
    
    if current_coins < miner_type["price"]:
        raise HTTPException(
            status_code=400, 
            detail=f"Nicht genug Coins. Benötigt: {miner_type['price']}, Vorhanden: {current_coins}"
        )
    
    # Deduct coins
    wallets_col.update_one(
        {"user_id": user_id},
        {
            "$inc": {"coins": -miner_type["price"], "total_spent": miner_type["price"]}
        }
    )
    
    # Create new miner
    new_miner = {
        "id": str(ObjectId()),
        "type_id": request.miner_type_id,
        "level": 1,
        "is_active": True,
        "purchased_at": datetime.now(timezone.utc).isoformat(),
        "last_claim": None,
        "total_mined": 0
    }
    
    # Add miner to user's collection
    miners_col.update_one(
        {"user_id": user_id},
        {
            "$push": {"miners": new_miner},
            "$setOnInsert": {"created_at": datetime.now(timezone.utc).isoformat()}
        },
        upsert=True
    )
    
    # Get updated balance
    wallet = wallets_col.find_one({"user_id": user_id}, {"_id": 0})
    
    return {
        "success": True,
        "message": f"{miner_type['name']} erfolgreich gekauft!",
        "miner": {**new_miner, **miner_type},
        "new_balance": wallet.get("coins", 0)
    }

@router.post("/miner/upgrade")
async def upgrade_miner(request: UpgradeMinerRequest, authorization: str = Header(None)):
    """Upgrade a miner to the next level"""
    user_id = get_user_id_from_token(authorization)
    
    user_data = miners_col.find_one({"user_id": user_id})
    if not user_data:
        raise HTTPException(status_code=404, detail="Keine Miner gefunden")
    
    miners = user_data.get("miners", [])
    miner_idx = None
    target_miner = None
    
    for i, m in enumerate(miners):
        if m.get("id") == request.miner_id:
            miner_idx = i
            target_miner = m
            break
    
    if target_miner is None:
        raise HTTPException(status_code=404, detail="Miner nicht gefunden")
    
    current_level = target_miner.get("level", 1)
    if current_level >= 10:
        raise HTTPException(status_code=400, detail="Maximales Level erreicht")
    
    # Upgrade cost: base_price * level * 0.5
    miner_type = MINER_TYPES.get(target_miner.get("type_id"))
    upgrade_cost = int(miner_type["price"] * current_level * 0.5)
    
    wallet = wallets_col.find_one({"user_id": user_id})
    current_coins = wallet.get("coins", 0) if wallet else 0
    
    if current_coins < upgrade_cost:
        raise HTTPException(
            status_code=400,
            detail=f"Nicht genug Coins für Upgrade. Benötigt: {upgrade_cost}"
        )
    
    # Deduct coins and upgrade
    wallets_col.update_one(
        {"user_id": user_id},
        {"$inc": {"coins": -upgrade_cost, "total_spent": upgrade_cost}}
    )
    
    miners_col.update_one(
        {"user_id": user_id, "miners.id": request.miner_id},
        {"$inc": {"miners.$.level": 1}}
    )
    
    return {
        "success": True,
        "message": f"Miner auf Level {current_level + 1} aufgewertet!",
        "new_level": current_level + 1,
        "cost": upgrade_cost
    }

@router.get("/miner/claim")
async def claim_rewards(authorization: str = Header(None)):
    """Claim mining rewards (once per day per miner)"""
    user_id = get_user_id_from_token(authorization)
    
    user_data = miners_col.find_one({"user_id": user_id})
    if not user_data:
        raise HTTPException(status_code=404, detail="Keine Miner gefunden")
    
    miners = user_data.get("miners", [])
    now = datetime.now(timezone.utc)
    total_claimed = 0
    claims_made = 0
    
    for i, miner in enumerate(miners):
        last_claim = miner.get("last_claim")
        can_claim = True
        
        if last_claim:
            last_claim_dt = datetime.fromisoformat(last_claim.replace('Z', '+00:00'))
            hours_since = (now - last_claim_dt).total_seconds() / 3600
            can_claim = hours_since >= 24
        
        if can_claim and miner.get("is_active", True):
            miner_type = MINER_TYPES.get(miner.get("type_id"))
            if miner_type:
                level = miner.get("level", 1)
                multiplier = 1 + (level - 1) * 0.1
                reward = int(miner_type["daily_reward"] * multiplier)
                total_claimed += reward
                claims_made += 1
                
                # Update last_claim
                miners_col.update_one(
                    {"user_id": user_id, "miners.id": miner["id"]},
                    {
                        "$set": {"miners.$.last_claim": now.isoformat()},
                        "$inc": {"miners.$.total_mined": reward}
                    }
                )
    
    if claims_made > 0:
        # Add to wallet
        wallets_col.update_one(
            {"user_id": user_id},
            {
                "$inc": {"coins": total_claimed, "total_earned": total_claimed},
                "$setOnInsert": {"created_at": now.isoformat()}
            },
            upsert=True
        )
        
        # Log history
        mining_history_col.insert_one({
            "user_id": user_id,
            "amount": total_claimed,
            "miners_claimed": claims_made,
            "claimed_at": now.isoformat()
        })
    
    wallet = wallets_col.find_one({"user_id": user_id}, {"_id": 0})
    
    return {
        "success": True,
        "claimed": total_claimed,
        "miners_claimed": claims_made,
        "new_balance": wallet.get("coins", 0) if wallet else total_claimed,
        "message": f"{total_claimed} Coins von {claims_made} Miner(n) gesammelt!" if claims_made > 0 else "Keine Belohnungen verfügbar. Warte 24 Stunden."
    }

@router.get("/mining/stats")
async def get_mining_stats(authorization: str = Header(None)):
    """Get detailed mining statistics"""
    user_id = get_user_id_from_token(authorization)
    
    user_data = miners_col.find_one({"user_id": user_id}, {"_id": 0})
    wallet = wallets_col.find_one({"user_id": user_id}, {"_id": 0})
    
    miners = user_data.get("miners", []) if user_data else []
    stats = calculate_total_stats(miners)
    
    # Calculate VIP level based on total hashrate
    vip_level = 0
    if stats["total_hashrate"] >= 100:
        vip_level = 5
    elif stats["total_hashrate"] >= 50:
        vip_level = 4
    elif stats["total_hashrate"] >= 20:
        vip_level = 3
    elif stats["total_hashrate"] >= 5:
        vip_level = 2
    elif stats["total_hashrate"] >= 1:
        vip_level = 1
    
    return {
        "coins": wallet.get("coins", 0) if wallet else 0,
        "total_earned": wallet.get("total_earned", 0) if wallet else 0,
        "total_spent": wallet.get("total_spent", 0) if wallet else 0,
        "miner_count": len(miners),
        "total_hashrate": stats["total_hashrate"],
        "total_power": stats["total_power"],
        "daily_reward": stats["total_daily_reward"],
        "vip_level": vip_level,
        "vip_bonus": vip_level * 5  # 5% bonus per VIP level
    }

@router.get("/mining/history")
async def get_mining_history(limit: int = 20, authorization: str = Header(None)):
    """Get mining claim history"""
    user_id = get_user_id_from_token(authorization)
    
    history = list(mining_history_col.find(
        {"user_id": user_id},
        {"_id": 0}
    ).sort("claimed_at", -1).limit(limit))
    
    return {"history": history}

# ======================== MARKET ENDPOINTS ========================

@router.get("/market/miners")
async def get_market_miners():
    """Get miners available in the market (for purchase)"""
    miners = list(MINER_TYPES.values())
    
    # Add availability and discount info
    for miner in miners:
        miner["available"] = True
        miner["discount"] = 0
        if miner["tier"] == "diamond":
            miner["limited"] = True
            miner["stock"] = 10
    
    return {"miners": miners, "featured": miners[2] if len(miners) > 2 else miners[0]}

@router.get("/market/deals")
async def get_market_deals():
    """Get special deals and bundles"""
    deals = [
        {
            "id": "starter_pack",
            "name": "Starter Pack",
            "description": "2x Nano Miner + 500 Bonus Coins",
            "original_price": 700,
            "sale_price": 500,
            "discount": 29,
            "contents": ["starter_1", "starter_1", "500_coins"]
        },
        {
            "id": "pro_bundle",
            "name": "Pro Bundle",
            "description": "1x Pro Miner + 1x Basic Miner",
            "original_price": 2500,
            "sale_price": 2000,
            "discount": 20,
            "contents": ["pro_1", "basic_1"]
        }
    ]
    return {"deals": deals}

# ======================== GAMES ENDPOINTS ========================

# Collections for games
games_history_col = db["games_history"]
daily_rewards_col = db["daily_rewards"]
live_feed_col = db["live_feed"]

import random

class PlayGameRequest(BaseModel):
    game_type: str = "quick_play"

@router.post("/games/play")
async def play_game(request: PlayGameRequest, authorization: str = Header(None)):
    """Play a game and win coins"""
    user_id = get_user_id_from_token(authorization)
    now = datetime.now(timezone.utc)
    
    # Random reward between 10-50 coins
    reward = random.randint(10, 50)
    
    # Add to wallet
    wallets_col.update_one(
        {"user_id": user_id},
        {
            "$inc": {"coins": reward, "total_earned": reward},
            "$setOnInsert": {"created_at": now.isoformat()}
        },
        upsert=True
    )
    
    # Log game history
    games_history_col.insert_one({
        "user_id": user_id,
        "game_type": request.game_type,
        "reward": reward,
        "played_at": now.isoformat()
    })
    
    # Add to live feed
    live_feed_col.insert_one({
        "user_id": user_id,
        "action": f"User won {reward} Coins",
        "type": "game_win",
        "timestamp": now.isoformat()
    })
    
    wallet = wallets_col.find_one({"user_id": user_id}, {"_id": 0})
    
    return {
        "success": True,
        "reward": reward,
        "message": f"Du hast {reward} Coins gewonnen!",
        "new_balance": wallet.get("coins", 0) if wallet else reward
    }

@router.get("/games/history")
async def get_games_history(limit: int = 20, authorization: str = Header(None)):
    """Get game play history"""
    user_id = get_user_id_from_token(authorization)
    
    history = list(games_history_col.find(
        {"user_id": user_id},
        {"_id": 0}
    ).sort("played_at", -1).limit(limit))
    
    return {"history": history}

# ======================== DAILY REWARDS ========================

DAILY_REWARDS = [
    {"day": 1, "coins": 10, "bonus": None},
    {"day": 2, "coins": 15, "bonus": None},
    {"day": 3, "coins": 20, "bonus": None},
    {"day": 4, "coins": 30, "bonus": None},
    {"day": 5, "coins": 50, "bonus": None},
    {"day": 6, "coins": 75, "bonus": None},
    {"day": 7, "coins": 100, "bonus": "mystery_box"},
]

@router.get("/daily-reward/status")
async def get_daily_reward_status(authorization: str = Header(None)):
    """Get daily reward status"""
    user_id = get_user_id_from_token(authorization)
    now = datetime.now(timezone.utc)
    today = now.strftime("%Y-%m-%d")
    
    user_rewards = daily_rewards_col.find_one({"user_id": user_id})
    
    if not user_rewards:
        return {
            "streak": 0,
            "can_claim": True,
            "next_reward": DAILY_REWARDS[0],
            "last_claim": None,
            "rewards": DAILY_REWARDS
        }
    
    last_claim = user_rewards.get("last_claim_date")
    streak = user_rewards.get("streak", 0)
    
    # Check if already claimed today
    can_claim = last_claim != today
    
    # Check if streak broken (missed a day)
    if last_claim:
        from datetime import timedelta
        yesterday = (now - timedelta(days=1)).strftime("%Y-%m-%d")
        if last_claim != yesterday and last_claim != today:
            streak = 0  # Reset streak
    
    # Get next reward (cycle through week)
    next_day = (streak % 7) + 1
    next_reward = DAILY_REWARDS[next_day - 1]
    
    return {
        "streak": streak,
        "can_claim": can_claim,
        "next_reward": next_reward,
        "last_claim": last_claim,
        "rewards": DAILY_REWARDS
    }

@router.post("/daily-reward/claim")
async def claim_daily_reward(authorization: str = Header(None)):
    """Claim daily reward"""
    user_id = get_user_id_from_token(authorization)
    now = datetime.now(timezone.utc)
    today = now.strftime("%Y-%m-%d")
    
    user_rewards = daily_rewards_col.find_one({"user_id": user_id})
    
    # Check if already claimed
    if user_rewards and user_rewards.get("last_claim_date") == today:
        raise HTTPException(status_code=400, detail="Bereits heute abgeholt!")
    
    # Calculate streak
    streak = 0
    if user_rewards:
        from datetime import timedelta
        yesterday = (now - timedelta(days=1)).strftime("%Y-%m-%d")
        last_claim = user_rewards.get("last_claim_date")
        if last_claim == yesterday:
            streak = user_rewards.get("streak", 0) + 1
        else:
            streak = 1
    else:
        streak = 1
    
    # Get reward for current day
    reward_day = ((streak - 1) % 7) + 1
    reward = DAILY_REWARDS[reward_day - 1]
    coins = reward["coins"]
    
    # Update daily rewards record
    daily_rewards_col.update_one(
        {"user_id": user_id},
        {
            "$set": {
                "last_claim_date": today,
                "streak": streak,
                "updated_at": now.isoformat()
            },
            "$inc": {"total_claimed": coins},
            "$setOnInsert": {"created_at": now.isoformat()}
        },
        upsert=True
    )
    
    # Add coins to wallet
    wallets_col.update_one(
        {"user_id": user_id},
        {
            "$inc": {"coins": coins, "total_earned": coins},
            "$setOnInsert": {"created_at": now.isoformat()}
        },
        upsert=True
    )
    
    # Add to live feed
    live_feed_col.insert_one({
        "user_id": user_id,
        "action": f"Daily Reward: +{coins} Coins (Tag {reward_day})",
        "type": "daily_reward",
        "timestamp": now.isoformat()
    })
    
    wallet = wallets_col.find_one({"user_id": user_id}, {"_id": 0})
    
    return {
        "success": True,
        "coins": coins,
        "streak": streak,
        "day": reward_day,
        "bonus": reward.get("bonus"),
        "message": f"Tag {reward_day}: +{coins} Coins!",
        "new_balance": wallet.get("coins", 0) if wallet else coins
    }

# ======================== LIVE FEED ========================

@router.get("/live-feed")
async def get_live_feed(limit: int = 20):
    """Get live activity feed"""
    feed = list(live_feed_col.find(
        {},
        {"_id": 0}
    ).sort("timestamp", -1).limit(limit))
    
    # If empty, return some mock data
    if not feed:
        feed = [
            {"action": "User bought Miner", "type": "purchase", "timestamp": datetime.now(timezone.utc).isoformat()},
            {"action": "User won 50 Coins", "type": "game_win", "timestamp": datetime.now(timezone.utc).isoformat()},
            {"action": "User joined Auction", "type": "auction", "timestamp": datetime.now(timezone.utc).isoformat()},
            {"action": "User opened Treasure Box", "type": "treasure", "timestamp": datetime.now(timezone.utc).isoformat()},
        ]
    
    return {"feed": feed}

# ======================== PROFIT CHART DATA ========================

@router.get("/mining/chart-data")
async def get_mining_chart_data(days: int = 7, authorization: str = Header(None)):
    """Get mining profit chart data"""
    user_id = get_user_id_from_token(authorization)
    
    # Get mining history for chart
    from datetime import timedelta
    now = datetime.now(timezone.utc)
    
    # Generate labels for last N days
    labels = []
    data = []
    weekdays = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"]
    
    for i in range(days - 1, -1, -1):
        day = now - timedelta(days=i)
        labels.append(weekdays[day.weekday()])
        
        # Get earnings for that day from history
        day_start = day.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
        day_end = day.replace(hour=23, minute=59, second=59, microsecond=999999).isoformat()
        
        earnings = mining_history_col.aggregate([
            {
                "$match": {
                    "user_id": user_id,
                    "claimed_at": {"$gte": day_start, "$lte": day_end}
                }
            },
            {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
        ])
        
        total = 0
        for e in earnings:
            total = e.get("total", 0)
        
        # Add some mock data if no real data
        if total == 0:
            total = random.randint(5, 50)
        
        data.append(total)
    
    return {
        "labels": labels,
        "data": data,
        "total_week": sum(data)
    }

