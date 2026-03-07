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

# ======================== ADMIN MINER ENDPOINTS ========================

class AdminGiveMinerRequest(BaseModel):
    user_id: str
    miner_type_id: str
    level: int = 1

class AdminMinerActionRequest(BaseModel):
    user_id: str
    miner_id: str

@router.get("/admin/miners/list")
async def admin_list_all_miners(authorization: str = Header(None)):
    """Admin: Get all miners from all users"""
    # In production, verify admin role
    all_miners = list(miners_col.find({}, {"_id": 0}))
    
    enriched_list = []
    for user_data in all_miners:
        user_id = user_data.get("user_id")
        miners = user_data.get("miners", [])
        for miner in miners:
            miner_type = MINER_TYPES.get(miner.get("type_id"))
            if miner_type:
                enriched_list.append({
                    "user_id": user_id,
                    "miner_id": miner.get("id"),
                    "type_id": miner.get("type_id"),
                    "name": miner_type["name"],
                    "level": miner.get("level", 1),
                    "tier": miner_type["tier"],
                    "is_active": miner.get("is_active", True),
                    "daily_reward": miner_type["daily_reward"],
                    "purchased_at": miner.get("purchased_at")
                })
    
    return {
        "miners": enriched_list,
        "total_count": len(enriched_list),
        "total_users": len(all_miners)
    }

@router.post("/admin/miners/give")
async def admin_give_miner(request: AdminGiveMinerRequest, authorization: str = Header(None)):
    """Admin: Give a miner to a user (free)"""
    # In production, verify admin role
    miner_type = MINER_TYPES.get(request.miner_type_id)
    
    if not miner_type:
        raise HTTPException(status_code=400, detail="Ungültiger Miner-Typ")
    
    if request.level < 1 or request.level > 10:
        raise HTTPException(status_code=400, detail="Level muss zwischen 1 und 10 sein")
    
    now = datetime.now(timezone.utc)
    new_miner = {
        "id": str(ObjectId()),
        "type_id": request.miner_type_id,
        "level": request.level,
        "is_active": True,
        "purchased_at": now.isoformat(),
        "last_claim": None,
        "total_mined": 0,
        "admin_granted": True
    }
    
    miners_col.update_one(
        {"user_id": request.user_id},
        {
            "$push": {"miners": new_miner},
            "$setOnInsert": {"created_at": now.isoformat()}
        },
        upsert=True
    )
    
    # Log action
    live_feed_col.insert_one({
        "user_id": "admin",
        "action": f"Gave {miner_type['name']} (Lv.{request.level}) to {request.user_id}",
        "type": "admin_miner_give",
        "timestamp": now.isoformat()
    })
    
    return {
        "success": True,
        "message": f"{miner_type['name']} (Level {request.level}) an {request.user_id} gegeben!",
        "miner": {
            "id": new_miner["id"],
            "name": miner_type["name"],
            "level": request.level,
            "tier": miner_type["tier"]
        }
    }

@router.post("/admin/miners/upgrade")
async def admin_upgrade_miner(request: AdminMinerActionRequest, authorization: str = Header(None)):
    """Admin: Upgrade a user's miner (free)"""
    # In production, verify admin role
    user_data = miners_col.find_one({"user_id": request.user_id})
    if not user_data:
        raise HTTPException(status_code=404, detail="User hat keine Miner")
    
    miners = user_data.get("miners", [])
    target_miner = None
    
    for miner in miners:
        if miner.get("id") == request.miner_id:
            target_miner = miner
            break
    
    if not target_miner:
        raise HTTPException(status_code=404, detail="Miner nicht gefunden")
    
    current_level = target_miner.get("level", 1)
    if current_level >= 10:
        raise HTTPException(status_code=400, detail="Miner ist bereits auf Maximum Level 10")
    
    miners_col.update_one(
        {"user_id": request.user_id, "miners.id": request.miner_id},
        {"$inc": {"miners.$.level": 1}}
    )
    
    miner_type = MINER_TYPES.get(target_miner.get("type_id"))
    
    # Log action
    now = datetime.now(timezone.utc)
    live_feed_col.insert_one({
        "user_id": "admin",
        "action": f"Upgraded {miner_type['name']} to Level {current_level + 1} for {request.user_id}",
        "type": "admin_miner_upgrade",
        "timestamp": now.isoformat()
    })
    
    return {
        "success": True,
        "message": f"Miner auf Level {current_level + 1} aufgewertet!",
        "new_level": current_level + 1
    }

@router.post("/admin/miners/remove")
async def admin_remove_miner(request: AdminMinerActionRequest, authorization: str = Header(None)):
    """Admin: Remove a miner from a user"""
    # In production, verify admin role
    result = miners_col.update_one(
        {"user_id": request.user_id},
        {"$pull": {"miners": {"id": request.miner_id}}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Miner nicht gefunden")
    
    # Log action
    now = datetime.now(timezone.utc)
    live_feed_col.insert_one({
        "user_id": "admin",
        "action": f"Removed miner {request.miner_id} from {request.user_id}",
        "type": "admin_miner_remove",
        "timestamp": now.isoformat()
    })
    
    return {
        "success": True,
        "message": "Miner wurde entfernt!"
    }

@router.post("/admin/miners/set-level")
async def admin_set_miner_level(user_id: str, miner_id: str, level: int, authorization: str = Header(None)):
    """Admin: Set a miner's level directly"""
    if level < 1 or level > 10:
        raise HTTPException(status_code=400, detail="Level muss zwischen 1 und 10 sein")
    
    result = miners_col.update_one(
        {"user_id": user_id, "miners.id": miner_id},
        {"$set": {"miners.$.level": level}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Miner nicht gefunden")
    
    return {
        "success": True,
        "message": f"Miner Level auf {level} gesetzt!"
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

# ======================== SPIN WHEEL ========================

spin_history_col = db["spin_history"]

@router.get("/spin/status")
async def get_spin_status(authorization: str = Header(None)):
    """Check if user can spin today"""
    user_id = get_user_id_from_token(authorization)
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    last_spin = spin_history_col.find_one(
        {"user_id": user_id, "date": today}
    )
    
    return {
        "can_spin": last_spin is None,
        "last_spin": last_spin.get("timestamp") if last_spin else None
    }

@router.post("/spin/claim")
async def claim_spin_prize(coins: int = 0, authorization: str = Header(None)):
    """Claim spin wheel prize"""
    user_id = get_user_id_from_token(authorization)
    now = datetime.now(timezone.utc)
    today = now.strftime("%Y-%m-%d")
    
    # Check if already spun today
    existing = spin_history_col.find_one({"user_id": user_id, "date": today})
    if existing:
        raise HTTPException(status_code=400, detail="Bereits heute gedreht!")
    
    # Record spin
    spin_history_col.insert_one({
        "user_id": user_id,
        "date": today,
        "coins": coins,
        "timestamp": now.isoformat()
    })
    
    # Add coins if won
    if coins > 0:
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
            "action": f"Glücksrad: +{coins} Coins",
            "type": "spin_win",
            "timestamp": now.isoformat()
        })
    
    wallet = wallets_col.find_one({"user_id": user_id}, {"_id": 0})
    
    return {
        "success": True,
        "coins": coins,
        "message": f"+{coins} Coins gewonnen!" if coins > 0 else "Leider nichts gewonnen",
        "new_balance": wallet.get("coins", 0) if wallet else coins
    }

# ======================== JACKPOT SYSTEM ========================

jackpot_col = db["jackpot"]
jackpot_entries_col = db["jackpot_entries"]

@router.get("/jackpot/current")
async def get_current_jackpot():
    """Get current jackpot amount"""
    jackpot = jackpot_col.find_one({"active": True})
    
    if not jackpot:
        # Create new jackpot
        jackpot_col.insert_one({
            "amount": 200,
            "participants": 0,
            "active": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        return {"amount": 200, "participants": 0}
    
    return {
        "amount": jackpot.get("amount", 200),
        "participants": jackpot.get("participants", 0)
    }

@router.post("/jackpot/join")
async def join_jackpot(authorization: str = Header(None)):
    """Join the jackpot (costs 5 coins)"""
    user_id = get_user_id_from_token(authorization)
    now = datetime.now(timezone.utc)
    entry_cost = 5
    
    # Check wallet
    wallet = wallets_col.find_one({"user_id": user_id})
    if not wallet or wallet.get("coins", 0) < entry_cost:
        raise HTTPException(status_code=400, detail="Nicht genug Coins (5 benötigt)")
    
    # Deduct coins
    wallets_col.update_one(
        {"user_id": user_id},
        {"$inc": {"coins": -entry_cost, "total_spent": entry_cost}}
    )
    
    # Add to jackpot
    jackpot_col.update_one(
        {"active": True},
        {
            "$inc": {"amount": entry_cost, "participants": 1},
            "$setOnInsert": {"created_at": now.isoformat()}
        },
        upsert=True
    )
    
    # Record entry
    jackpot_entries_col.insert_one({
        "user_id": user_id,
        "timestamp": now.isoformat()
    })
    
    # Add to live feed
    live_feed_col.insert_one({
        "user_id": user_id,
        "action": "User joined Jackpot",
        "type": "jackpot",
        "timestamp": now.isoformat()
    })
    
    jackpot = jackpot_col.find_one({"active": True})
    wallet = wallets_col.find_one({"user_id": user_id}, {"_id": 0})
    
    return {
        "success": True,
        "message": "Jackpot beigetreten!",
        "jackpot_amount": jackpot.get("amount", 200),
        "participants": jackpot.get("participants", 0),
        "new_balance": wallet.get("coins", 0)
    }

# ======================== VIP LEVEL SYSTEM ========================

vip_col = db["vip_levels"]

VIP_LEVELS = [
    {"level": 1, "name": "Bronze", "min_points": 0, "bonus": 0},
    {"level": 2, "name": "Silver", "min_points": 100, "bonus": 5},
    {"level": 3, "name": "Gold", "min_points": 300, "bonus": 10},
    {"level": 4, "name": "Platinum", "min_points": 700, "bonus": 15},
    {"level": 5, "name": "Diamond", "min_points": 1500, "bonus": 25},
]

@router.get("/vip/status")
async def get_vip_status(authorization: str = Header(None)):
    """Get user's VIP status"""
    user_id = get_user_id_from_token(authorization)
    
    vip_data = vip_col.find_one({"user_id": user_id})
    
    if not vip_data:
        return {
            "level": 1,
            "name": "Bronze",
            "points": 0,
            "bonus": 0,
            "next_level": VIP_LEVELS[1] if len(VIP_LEVELS) > 1 else None,
            "levels": VIP_LEVELS
        }
    
    points = vip_data.get("points", 0)
    
    # Determine current level
    current_level = VIP_LEVELS[0]
    next_level = None
    for i, level in enumerate(VIP_LEVELS):
        if points >= level["min_points"]:
            current_level = level
            next_level = VIP_LEVELS[i + 1] if i + 1 < len(VIP_LEVELS) else None
    
    return {
        "level": current_level["level"],
        "name": current_level["name"],
        "points": points,
        "bonus": current_level["bonus"],
        "next_level": next_level,
        "levels": VIP_LEVELS
    }

@router.post("/vip/add-points")
async def add_vip_points(points: int = 10, authorization: str = Header(None)):
    """Add VIP points (called after actions)"""
    user_id = get_user_id_from_token(authorization)
    now = datetime.now(timezone.utc)
    
    vip_col.update_one(
        {"user_id": user_id},
        {
            "$inc": {"points": points},
            "$set": {"updated_at": now.isoformat()},
            "$setOnInsert": {"created_at": now.isoformat()}
        },
        upsert=True
    )
    
    # Get updated status
    vip_data = vip_col.find_one({"user_id": user_id}, {"_id": 0})
    total_points = vip_data.get("points", 0)
    
    # Determine level
    current_level = VIP_LEVELS[0]
    for level in VIP_LEVELS:
        if total_points >= level["min_points"]:
            current_level = level
    
    return {
        "success": True,
        "points_added": points,
        "total_points": total_points,
        "level": current_level["level"],
        "name": current_level["name"],
        "bonus": current_level["bonus"]
    }


@router.post("/vip/add-xp")
async def add_vip_xp(xp: int = 10, authorization: str = Header(None)):
    """Add XP points for leveling"""
    user_id = get_user_id_from_token(authorization)
    now = datetime.now(timezone.utc)
    
    # Get current XP and Level
    vip_data = vip_col.find_one({"user_id": user_id})
    current_xp = vip_data.get("xp", 0) if vip_data else 0
    current_level = vip_data.get("level", 1) if vip_data else 1
    
    new_xp = current_xp + xp
    new_level = current_level
    leveled_up = False
    
    # Level up at 100 XP
    while new_xp >= 100:
        new_level += 1
        new_xp -= 100
        leveled_up = True
    
    vip_col.update_one(
        {"user_id": user_id},
        {
            "$set": {
                "xp": new_xp,
                "level": new_level,
                "updated_at": now.isoformat()
            },
            "$setOnInsert": {"created_at": now.isoformat()}
        },
        upsert=True
    )
    
    return {
        "success": True,
        "xp": new_xp,
        "level": new_level,
        "leveled_up": leveled_up,
        "xp_to_next": 100 - new_xp
    }

@router.get("/vip/xp-status")
async def get_vip_xp_status(authorization: str = Header(None)):
    """Get XP and Level status"""
    user_id = get_user_id_from_token(authorization)
    
    vip_data = vip_col.find_one({"user_id": user_id}, {"_id": 0})
    
    return {
        "xp": vip_data.get("xp", 0) if vip_data else 0,
        "level": vip_data.get("level", 1) if vip_data else 1,
        "xp_to_next": 100 - (vip_data.get("xp", 0) if vip_data else 0)
    }


# ======================== REFERRAL SYSTEM ========================

referral_col = db["referrals"]

@router.get("/referral/my-code")
async def get_my_referral_code(authorization: str = Header(None)):
    """Get or create user's referral code"""
    user_id = get_user_id_from_token(authorization)
    
    referral = referral_col.find_one({"user_id": user_id})
    
    if not referral:
        # Generate unique code
        code = f"BB{random.randint(10000, 99999)}"
        referral_col.insert_one({
            "user_id": user_id,
            "code": code,
            "referrals": [],
            "total_earnings": 0,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        return {"code": code, "referrals": 0, "earnings": 0}
    
    return {
        "code": referral.get("code"),
        "referrals": len(referral.get("referrals", [])),
        "earnings": referral.get("total_earnings", 0)
    }

@router.post("/referral/use-code")
async def use_referral_code(code: str, authorization: str = Header(None)):
    """Use a referral code to join"""
    user_id = get_user_id_from_token(authorization)
    now = datetime.now(timezone.utc)
    
    # Check if already used a code
    existing = referral_col.find_one({"referrals": user_id})
    if existing:
        raise HTTPException(status_code=400, detail="Du hast bereits einen Code verwendet")
    
    # Find referrer
    referrer = referral_col.find_one({"code": code.upper()})
    if not referrer:
        raise HTTPException(status_code=404, detail="Code nicht gefunden")
    
    if referrer.get("user_id") == user_id:
        raise HTTPException(status_code=400, detail="Du kannst deinen eigenen Code nicht verwenden")
    
    # Add to referrer's list and give bonus
    referral_bonus = 100
    
    referral_col.update_one(
        {"code": code.upper()},
        {
            "$push": {"referrals": user_id},
            "$inc": {"total_earnings": referral_bonus}
        }
    )
    
    # Give coins to referrer
    wallets_col.update_one(
        {"user_id": referrer.get("user_id")},
        {
            "$inc": {"coins": referral_bonus, "total_earned": referral_bonus},
            "$setOnInsert": {"created_at": now.isoformat()}
        },
        upsert=True
    )
    
    # Give bonus to new user too
    new_user_bonus = 50
    wallets_col.update_one(
        {"user_id": user_id},
        {
            "$inc": {"coins": new_user_bonus, "total_earned": new_user_bonus},
            "$setOnInsert": {"created_at": now.isoformat()}
        },
        upsert=True
    )
    
    # Add to live feed
    live_feed_col.insert_one({
        "user_id": user_id,
        "action": f"New user joined via referral!",
        "type": "referral",
        "timestamp": now.isoformat()
    })
    
    wallet = wallets_col.find_one({"user_id": user_id}, {"_id": 0})
    
    return {
        "success": True,
        "message": f"Du hast {new_user_bonus} Coins erhalten!",
        "bonus": new_user_bonus,
        "new_balance": wallet.get("coins", 0) if wallet else new_user_bonus
    }

# ======================== MINING POOL STATS ========================

@router.get("/pool/stats")
async def get_pool_stats():
    """Get global mining pool statistics"""
    
    # Calculate total hashrate from all miners
    pipeline = [
        {"$unwind": "$miners"},
        {"$group": {
            "_id": None,
            "total_miners": {"$sum": 1},
            "total_users": {"$addToSet": "$user_id"}
        }}
    ]
    
    result = list(miners_col.aggregate(pipeline))
    
    total_miners = 0
    total_users = 0
    
    if result:
        total_miners = result[0].get("total_miners", 0)
        total_users = len(result[0].get("total_users", []))
    
    # Calculate estimated total hashrate
    all_miners_data = list(miners_col.find({}, {"miners": 1}))
    total_hashrate = 0
    for user_data in all_miners_data:
        for miner in user_data.get("miners", []):
            miner_type = MINER_TYPES.get(miner.get("type_id"))
            if miner_type:
                level = miner.get("level", 1)
                multiplier = 1 + (level - 1) * 0.1
                total_hashrate += miner_type["hashrate"] * multiplier
    
    # Simulate block info
    block_height = 850000 + random.randint(0, 1000)
    next_block_reward = round(3.125 + random.random() * 0.5, 4)
    pool_luck = random.randint(90, 110)
    
    return {
        "total_hashrate": round(total_hashrate, 2),
        "total_miners": total_miners,
        "total_users": total_users,
        "block_height": block_height,
        "next_block_reward": next_block_reward,
        "pool_luck": pool_luck,
        "pool_fee": 1.0,
        "estimated_daily_btc": round(total_hashrate * 0.00000001, 8)
    }


# ======================== LEADERBOARD ========================

@router.get("/leaderboard/miners")
async def get_top_miners(limit: int = 10):
    """Get top miners by hashrate"""
    
    # Get all users with their total hashrate
    all_users = list(miners_col.find({}, {"_id": 0, "user_id": 1, "miners": 1}))
    
    leaderboard = []
    for user_data in all_users:
        user_id = user_data.get("user_id", "Unknown")
        total_hashrate = 0
        
        for miner in user_data.get("miners", []):
            miner_type = MINER_TYPES.get(miner.get("type_id"))
            if miner_type:
                level = miner.get("level", 1)
                multiplier = 1 + (level - 1) * 0.1
                total_hashrate += miner_type["hashrate"] * multiplier
        
        if total_hashrate > 0:
            leaderboard.append({
                "name": f"User_{user_id[:6]}",
                "hashrate": round(total_hashrate, 2),
                "miners": len(user_data.get("miners", []))
            })
    
    # Add mock data if empty
    if len(leaderboard) < 4:
        mock_data = [
            {"name": "Alex", "hashrate": 500, "miners": 12},
            {"name": "Maria", "hashrate": 420, "miners": 10},
            {"name": "Leon", "hashrate": 390, "miners": 9},
            {"name": "Sara", "hashrate": 350, "miners": 8},
        ]
        for m in mock_data:
            if len(leaderboard) < limit:
                leaderboard.append(m)
    
    # Sort by hashrate
    leaderboard.sort(key=lambda x: x["hashrate"], reverse=True)
    
    return {"leaderboard": leaderboard[:limit]}

@router.get("/leaderboard/players")
async def get_top_players(limit: int = 10):
    """Get top players by coins"""
    
    # Get all wallets
    all_wallets = list(wallets_col.find({}, {"_id": 0, "user_id": 1, "coins": 1, "total_earned": 1}))
    
    leaderboard = []
    for wallet in all_wallets:
        user_id = wallet.get("user_id", "Unknown")
        coins = wallet.get("coins", 0)
        
        if coins > 0:
            leaderboard.append({
                "name": f"User_{user_id[:6]}",
                "coins": coins,
                "total_earned": wallet.get("total_earned", 0)
            })
    
    # Add mock data if empty
    if len(leaderboard) < 4:
        mock_data = [
            {"name": "Max", "coins": 12000, "total_earned": 15000},
            {"name": "Anna", "coins": 10400, "total_earned": 13000},
            {"name": "David", "coins": 9800, "total_earned": 12500},
            {"name": "Lisa", "coins": 9200, "total_earned": 11000},
        ]
        for m in mock_data:
            if len(leaderboard) < limit:
                leaderboard.append(m)
    
    # Sort by coins
    leaderboard.sort(key=lambda x: x["coins"], reverse=True)
    
    return {"leaderboard": leaderboard[:limit]}

@router.get("/leaderboard/referrals")
async def get_top_referrals(limit: int = 10):
    """Get top referrers by friend count"""
    
    # Get all referrals
    all_referrals = list(referral_col.find({}, {"_id": 0, "user_id": 1, "referrals": 1, "total_earnings": 1}))
    
    leaderboard = []
    for ref in all_referrals:
        user_id = ref.get("user_id", "Unknown")
        friends = len(ref.get("referrals", []))
        
        if friends > 0:
            leaderboard.append({
                "name": f"User_{user_id[:6]}",
                "friends": friends,
                "earnings": ref.get("total_earnings", 0)
            })
    
    # Add mock data if empty
    if len(leaderboard) < 4:
        mock_data = [
            {"name": "Chris", "friends": 85, "earnings": 8500},
            {"name": "Julia", "friends": 70, "earnings": 7000},
            {"name": "Amir", "friends": 55, "earnings": 5500},
            {"name": "Tom", "friends": 40, "earnings": 4000},
        ]
        for m in mock_data:
            if len(leaderboard) < limit:
                leaderboard.append(m)
    
    # Sort by friends
    leaderboard.sort(key=lambda x: x["friends"], reverse=True)
    
    return {"leaderboard": leaderboard[:limit]}



# ======================== ADMIN ENDPOINTS ========================

class AdminCoinsRequest(BaseModel):
    user_id: str
    amount: int
    action: str = "add"  # add or remove

@router.get("/admin/stats")
async def get_admin_stats(authorization: str = Header(None)):
    """Get admin statistics"""
    # In production, verify admin role
    
    # Total users (unique wallets)
    total_users = wallets_col.count_documents({})
    
    # Total miners
    miners_data = list(miners_col.find({}, {"miners": 1}))
    total_miners = sum(len(m.get("miners", [])) for m in miners_data)
    
    # Total coins in circulation
    total_coins_data = wallets_col.aggregate([
        {"$group": {"_id": None, "total": {"$sum": "$coins"}}}
    ])
    total_coins = 0
    for c in total_coins_data:
        total_coins = c.get("total", 0)
    
    # Games played today
    from datetime import timedelta
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    games_today = games_history_col.count_documents({
        "played_at": {"$regex": f"^{today}"}
    })
    
    return {
        "total_users": total_users,
        "total_miners": total_miners,
        "total_coins": total_coins,
        "games_today": games_today
    }

@router.post("/admin/coins")
async def admin_modify_coins(request: AdminCoinsRequest, authorization: str = Header(None)):
    """Admin endpoint to add or remove coins from a user"""
    # In production, verify admin role from token
    
    user_id = request.user_id
    amount = request.amount
    now = datetime.now(timezone.utc)
    
    # Check if user exists
    wallet = wallets_col.find_one({"user_id": user_id})
    
    if not wallet and amount < 0:
        raise HTTPException(status_code=404, detail="User nicht gefunden")
    
    # Update or create wallet
    if amount > 0:
        wallets_col.update_one(
            {"user_id": user_id},
            {
                "$inc": {"coins": amount, "total_earned": amount},
                "$setOnInsert": {"created_at": now.isoformat()}
            },
            upsert=True
        )
    else:
        # For negative amounts, ensure balance doesn't go below 0
        current_coins = wallet.get("coins", 0) if wallet else 0
        new_balance = max(0, current_coins + amount)
        actual_deduction = current_coins - new_balance
        
        wallets_col.update_one(
            {"user_id": user_id},
            {
                "$set": {"coins": new_balance},
                "$inc": {"total_spent": actual_deduction}
            }
        )
    
    # Get updated balance
    updated_wallet = wallets_col.find_one({"user_id": user_id}, {"_id": 0})
    new_balance = updated_wallet.get("coins", 0) if updated_wallet else 0
    
    action_text = "hinzugefügt" if amount > 0 else "abgezogen"
    
    return {
        "success": True,
        "message": f"{abs(amount)} Coins {action_text}. Neues Guthaben: {new_balance}",
        "new_balance": new_balance,
        "user_id": user_id
    }

@router.get("/admin/user/{user_id}")
async def get_user_details(user_id: str, authorization: str = Header(None)):
    """Get detailed information about a specific user"""
    
    wallet = wallets_col.find_one({"user_id": user_id}, {"_id": 0})
    miners_data = miners_col.find_one({"user_id": user_id}, {"_id": 0})
    referral_data = referral_col.find_one({"user_id": user_id}, {"_id": 0})
    vip_data = vip_col.find_one({"user_id": user_id}, {"_id": 0})
    
    if not wallet and not miners_data:
        raise HTTPException(status_code=404, detail="User nicht gefunden")
    
    return {
        "user_id": user_id,
        "wallet": wallet or {"coins": 0, "total_earned": 0, "total_spent": 0},
        "miners": miners_data.get("miners", []) if miners_data else [],
        "miner_count": len(miners_data.get("miners", [])) if miners_data else 0,
        "referral_code": referral_data.get("code") if referral_data else None,
        "referral_count": len(referral_data.get("referrals", [])) if referral_data else 0,
        "vip_points": vip_data.get("points", 0) if vip_data else 0
    }



# ======================== PLATFORM STATS ========================

@router.get("/platform/stats")
async def get_platform_stats():
    """Get platform-wide statistics"""
    
    # Count users
    total_users = wallets_col.count_documents({})
    
    # Simulate online users (10-30% of total)
    online_users = max(1, int(total_users * (0.1 + random.random() * 0.2)))
    
    # Total coins in circulation
    total_coins_data = wallets_col.aggregate([
        {"$group": {"_id": None, "total": {"$sum": "$coins"}}}
    ])
    total_coins = 0
    for c in total_coins_data:
        total_coins = c.get("total", 0)
    
    # Total mining power
    miners_data = list(miners_col.find({}, {"miners": 1}))
    total_power = sum(
        sum(m.get("hashrate", 0) for m in doc.get("miners", []))
        for doc in miners_data
    )
    
    # Games played
    games_played = games_history_col.count_documents({})
    
    # Market volume (simulate)
    market_volume = total_coins * 0.2  # 20% of total coins traded
    
    return {
        "total_users": total_users + 1500,  # Base users
        "online_users": online_users + 200,
        "total_coins": total_coins + 450000,
        "mining_power": total_power + 1800,
        "games_played": games_played + 24000,
        "market_volume": int(market_volume + 90000)
    }

# ======================== TAXI BOOKING ========================

class TaxiBookingRequest(BaseModel):
    pickup: str
    destination: str
    cost: int

@router.post("/taxi/book")
async def book_taxi(request: TaxiBookingRequest, authorization: str = Header(None)):
    """Book a taxi ride"""
    user_id = get_user_id_from_token(authorization)
    
    # Check balance
    wallet = wallets_col.find_one({"user_id": user_id})
    current_coins = wallet.get("coins", 0) if wallet else 0
    
    if current_coins < request.cost:
        raise HTTPException(status_code=400, detail="Nicht genug Coins")
    
    # Deduct coins
    wallets_col.update_one(
        {"user_id": user_id},
        {"$inc": {"coins": -request.cost, "total_spent": request.cost}}
    )
    
    # Generate booking
    booking_id = f"TX{random.randint(10000, 99999)}"
    drivers = ["Max M.", "Anna K.", "Tom B.", "Lisa S."]
    cars = ["BMW 3er", "Mercedes C", "VW Passat", "Audi A4"]
    
    return {
        "booking_id": booking_id,
        "driver": random.choice(drivers),
        "car": random.choice(cars),
        "plate": f"B-TX {random.randint(100, 999)}",
        "eta": f"{random.randint(2, 8)} Min",
        "new_balance": current_coins - request.cost
    }

# ======================== SCOOTER RENTAL ========================

class ScooterRentRequest(BaseModel):
    scooter_id: str
    price: int

@router.post("/scooter/rent")
async def rent_scooter(request: ScooterRentRequest, authorization: str = Header(None)):
    """Rent an e-scooter"""
    user_id = get_user_id_from_token(authorization)
    
    # Check balance
    wallet = wallets_col.find_one({"user_id": user_id})
    current_coins = wallet.get("coins", 0) if wallet else 0
    
    if current_coins < request.price:
        raise HTTPException(status_code=400, detail="Nicht genug Coins")
    
    # Deduct unlock fee
    wallets_col.update_one(
        {"user_id": user_id},
        {"$inc": {"coins": -request.price, "total_spent": request.price}}
    )
    
    return {
        "success": True,
        "scooter_id": request.scooter_id,
        "new_balance": current_coins - request.price
    }

@router.post("/scooter/end")
async def end_scooter_ride(cost: int = 0, authorization: str = Header(None)):
    """End a scooter ride"""
    user_id = get_user_id_from_token(authorization)
    
    if cost > 0:
        wallets_col.update_one(
            {"user_id": user_id},
            {"$inc": {"coins": -cost, "total_spent": cost}}
        )
    
    wallet = wallets_col.find_one({"user_id": user_id}, {"_id": 0, "coins": 1})
    
    return {
        "success": True,
        "cost": cost,
        "new_balance": wallet.get("coins", 0) if wallet else 0
    }



# ======================== CHAT SYSTEM ========================

# In-memory chat messages (for demo - would use MongoDB in production)
chat_messages = []

class ChatMessageRequest(BaseModel):
    message: str

@router.get("/chat/messages")
async def get_chat_messages():
    """Get recent chat messages"""
    global chat_messages
    
    # Return last 50 messages
    return {
        "messages": chat_messages[-50:],
        "online_users": random.randint(30, 80)
    }

@router.post("/chat/send")
async def send_chat_message(request: ChatMessageRequest, authorization: str = Header(None)):
    """Send a chat message"""
    global chat_messages
    
    user_id = get_user_id_from_token(authorization)
    username = user_id.replace("user_", "").replace("_", " ").title()[:10]
    
    message = {
        "id": len(chat_messages) + 1,
        "user": username,
        "message": request.message[:200],  # Limit message length
        "time": datetime.now(timezone.utc).strftime("%H:%M"),
        "isSystem": False
    }
    
    chat_messages.append(message)
    
    # Keep only last 100 messages
    if len(chat_messages) > 100:
        chat_messages = chat_messages[-100:]
    
    return {"success": True, "message_id": message["id"]}

# ======================== NOTIFICATIONS ========================

@router.get("/notifications")
async def get_notifications(authorization: str = Header(None)):
    """Get user notifications"""
    user_id = get_user_id_from_token(authorization)
    
    # Generate contextual notifications based on user state
    notifications = []
    
    # Check mining status
    miners_data = miners_col.find_one({"user_id": user_id})
    if miners_data and len(miners_data.get("miners", [])) > 0:
        notifications.append({
            "id": 1,
            "type": "mining",
            "title": "⛏️ Mining Reward bereit!",
            "message": "Dein täglicher Mining-Reward wartet auf dich.",
            "time": "2 Min",
            "read": False
        })
    
    # Add system notifications
    notifications.extend([
        {"id": 2, "type": "game", "title": "🎰 Jackpot Update", "message": "Der Jackpot ist auf 5.000 Coins gestiegen!", "time": "15 Min", "read": False},
        {"id": 3, "type": "system", "title": "🎁 Täglicher Bonus", "message": "Vergiss nicht, deinen täglichen Bonus abzuholen!", "time": "1 Std", "read": True},
    ])
    
    unread_count = len([n for n in notifications if not n["read"]])
    
    return {
        "notifications": notifications,
        "unread_count": unread_count
    }

@router.post("/notifications/read/{notification_id}")
async def mark_notification_read(notification_id: int, authorization: str = Header(None)):
    """Mark a notification as read"""
    return {"success": True, "notification_id": notification_id}

@router.post("/notifications/read-all")
async def mark_all_notifications_read(authorization: str = Header(None)):
    """Mark all notifications as read"""
    return {"success": True}

# ======================== MARKETPLACE ========================

# In-memory listings (for demo)
marketplace_listings = [
    {"id": 1, "seller": "Max", "seller_id": "user_max", "type": "miner", "name": "Gold Miner Lv.5", "price": 2500, "originalPrice": 3000},
    {"id": 2, "seller": "Anna", "seller_id": "user_anna", "type": "miner", "name": "Silver Miner Lv.3", "price": 800, "originalPrice": 1000},
    {"id": 3, "seller": "Tom", "seller_id": "user_tom", "type": "boost", "name": "2x Mining Boost (24h)", "price": 500, "originalPrice": 500},
    {"id": 4, "seller": "Lisa", "seller_id": "user_lisa", "type": "miner", "name": "Platinum Miner Lv.2", "price": 5000, "originalPrice": 6500},
]

@router.get("/marketplace/listings")
async def get_marketplace_listings(authorization: str = Header(None)):
    """Get marketplace listings"""
    user_id = get_user_id_from_token(authorization) if authorization else None
    
    # Filter out user's own listings
    listings = [l for l in marketplace_listings if l.get("seller_id") != user_id]
    my_listings = [l for l in marketplace_listings if l.get("seller_id") == user_id]
    
    return {
        "listings": listings,
        "my_listings": my_listings
    }

class MarketplaceBuyRequest(BaseModel):
    listing_id: int
    price: int

@router.post("/marketplace/buy")
async def buy_marketplace_item(request: MarketplaceBuyRequest, authorization: str = Header(None)):
    """Buy an item from marketplace"""
    global marketplace_listings
    
    user_id = get_user_id_from_token(authorization)
    
    # Find listing
    listing = next((l for l in marketplace_listings if l["id"] == request.listing_id), None)
    if not listing:
        raise HTTPException(status_code=404, detail="Angebot nicht gefunden")
    
    # Check balance
    wallet = wallets_col.find_one({"user_id": user_id})
    current_coins = wallet.get("coins", 0) if wallet else 0
    
    if current_coins < request.price:
        raise HTTPException(status_code=400, detail="Nicht genug Coins")
    
    # Deduct coins from buyer
    wallets_col.update_one(
        {"user_id": user_id},
        {"$inc": {"coins": -request.price, "total_spent": request.price}}
    )
    
    # Add coins to seller (minus 5% fee)
    seller_amount = int(request.price * 0.95)
    wallets_col.update_one(
        {"user_id": listing["seller_id"]},
        {"$inc": {"coins": seller_amount, "total_earned": seller_amount}},
        upsert=True
    )
    
    # Remove listing
    marketplace_listings = [l for l in marketplace_listings if l["id"] != request.listing_id]
    
    return {
        "success": True,
        "item": listing["name"],
        "new_balance": current_coins - request.price
    }

class MarketplaceListRequest(BaseModel):
    item_type: str
    item_name: str
    price: int

@router.post("/marketplace/list")
async def list_marketplace_item(request: MarketplaceListRequest, authorization: str = Header(None)):
    """List an item for sale"""
    global marketplace_listings
    
    user_id = get_user_id_from_token(authorization)
    username = user_id.replace("user_", "").replace("_", " ").title()[:10]
    
    new_listing = {
        "id": len(marketplace_listings) + 100,
        "seller": username,
        "seller_id": user_id,
        "type": request.item_type,
        "name": request.item_name,
        "price": request.price,
        "originalPrice": request.price
    }
    
    marketplace_listings.append(new_listing)
    
    return {"success": True, "listing_id": new_listing["id"]}



# ======================== ANALYTICS ========================

@router.get("/analytics/weekly")
async def get_weekly_analytics(authorization: str = Header(None)):
    """Get weekly analytics data"""
    user_id = get_user_id_from_token(authorization) if authorization else None
    
    # Generate sample weekly data
    # In production, this would aggregate from games_history_col
    base_coins = random.randint(800, 1500)
    
    coins_data = [base_coins + i * random.randint(100, 400) for i in range(7)]
    mining_data = [random.randint(30, 100) + i * 20 for i in range(7)]
    games_data = [random.randint(5, 20) + i * 3 for i in range(7)]
    
    return {
        "coins": coins_data,
        "mining": mining_data,
        "games": games_data
    }

# ======================== WITHDRAW ========================

class WithdrawRequest(BaseModel):
    address: str
    amount: int

@router.post("/withdraw/request")
async def request_withdrawal(request: WithdrawRequest, authorization: str = Header(None)):
    """Request a coin withdrawal"""
    user_id = get_user_id_from_token(authorization)
    
    # Validate
    if request.amount < 100:
        raise HTTPException(status_code=400, detail="Mindestbetrag: 100 Coins")
    
    # Check balance
    wallet = wallets_col.find_one({"user_id": user_id})
    current_coins = wallet.get("coins", 0) if wallet else 0
    
    if current_coins < request.amount:
        raise HTTPException(status_code=400, detail="Nicht genug Coins")
    
    # Calculate fee (2%, min 10)
    fee = max(10, int(request.amount * 0.02))
    total_deduction = request.amount
    
    # Deduct coins
    wallets_col.update_one(
        {"user_id": user_id},
        {"$inc": {"coins": -total_deduction, "total_withdrawn": request.amount - fee}}
    )
    
    # Store withdrawal request (in production, would store in separate collection)
    withdrawal_id = f"WD{random.randint(10000, 99999)}"
    
    return {
        "success": True,
        "withdrawal_id": withdrawal_id,
        "amount": request.amount,
        "fee": fee,
        "net_amount": request.amount - fee,
        "new_balance": current_coins - total_deduction,
        "status": "pending"
    }

@router.get("/withdraw/history")
async def get_withdrawal_history(authorization: str = Header(None)):
    """Get withdrawal history"""
    user_id = get_user_id_from_token(authorization)
    
    # Sample history
    history = [
        {"id": 1, "amount": 500, "address": "DE89...1234", "status": "completed", "date": "03.03.2026"},
        {"id": 2, "amount": 1000, "address": "0x1234...abcd", "status": "pending", "date": "05.03.2026"},
    ]
    
    return {"history": history}



# ======================== FRIENDS SYSTEM ========================

friends_col = db["friends"]

class SendCoinsRequest(BaseModel):
    to: str
    amount: int

class AddFriendRequest(BaseModel):
    friend_name: str

@router.get("/friends/list")
async def get_friends(authorization: str = Header(None)):
    """Get user's friends list"""
    user_id = get_user_id_from_token(authorization)
    
    friends_data = friends_col.find_one({"user_id": user_id})
    friends = friends_data.get("friends", []) if friends_data else []
    
    return {
        "friends": friends,
        "count": len(friends)
    }

@router.post("/friends/add")
async def add_friend(request: AddFriendRequest, authorization: str = Header(None)):
    """Add a new friend"""
    user_id = get_user_id_from_token(authorization)
    now = datetime.now(timezone.utc)
    
    new_friend = {
        "id": str(ObjectId()),
        "name": request.friend_name,
        "level": 1,
        "coins": 0,
        "online": False,
        "added_at": now.isoformat()
    }
    
    friends_col.update_one(
        {"user_id": user_id},
        {
            "$push": {"friends": new_friend},
            "$setOnInsert": {"created_at": now.isoformat()}
        },
        upsert=True
    )
    
    return {
        "success": True,
        "message": f"{request.friend_name} wurde hinzugefügt!",
        "friend": new_friend
    }

@router.post("/friends/send-coins")
async def send_coins_to_friend(request: SendCoinsRequest, authorization: str = Header(None)):
    """Send coins to a friend"""
    user_id = get_user_id_from_token(authorization)
    now = datetime.now(timezone.utc)
    
    # Check wallet balance
    wallet = wallets_col.find_one({"user_id": user_id})
    current_coins = wallet.get("coins", 0) if wallet else 0
    
    if current_coins < request.amount:
        raise HTTPException(status_code=400, detail="Nicht genug Coins!")
    
    if request.amount <= 0:
        raise HTTPException(status_code=400, detail="Ungültiger Betrag")
    
    # Deduct from sender
    wallets_col.update_one(
        {"user_id": user_id},
        {"$inc": {"coins": -request.amount, "total_spent": request.amount}}
    )
    
    # Add to live feed
    live_feed_col.insert_one({
        "user_id": user_id,
        "action": f"Sent {request.amount} Coins to {request.to}",
        "type": "friend_transfer",
        "timestamp": now.isoformat()
    })
    
    new_balance = current_coins - request.amount
    
    return {
        "success": True,
        "message": f"{request.amount} Coins an {request.to} gesendet!",
        "new_balance": new_balance
    }

# ======================== EVENTS SYSTEM ========================

events_col = db["events"]
user_events_col = db["user_events"]

@router.get("/events/list")
async def get_events():
    """Get active events"""
    events = [
        {"id": 1, "name": "Coin Hunt Weekend", "icon": "🗺️", "reward": "+50% Coins", "ends_in": "2 Tage"},
        {"id": 2, "name": "Auction Night", "icon": "🔥", "reward": "Exklusive Items", "ends_in": "8 Stunden"},
        {"id": 3, "name": "Mystery Box Festival", "icon": "🎁", "reward": "3x Chance", "ends_in": "1 Tag"},
        {"id": 4, "name": "VIP Double Coins", "icon": "👑", "reward": "2x Mining", "ends_in": "3 Tage"},
        {"id": 5, "name": "Referral Bonus Week", "icon": "👥", "reward": "+100 Coins", "ends_in": "5 Tage"},
    ]
    return {"events": events}

class JoinEventRequest(BaseModel):
    event_id: int

@router.post("/events/join")
async def join_event(request: JoinEventRequest, authorization: str = Header(None)):
    """Join an event"""
    user_id = get_user_id_from_token(authorization)
    now = datetime.now(timezone.utc)
    
    user_events_col.update_one(
        {"user_id": user_id},
        {
            "$addToSet": {"joined_events": request.event_id},
            "$set": {"updated_at": now.isoformat()},
            "$setOnInsert": {"created_at": now.isoformat()}
        },
        upsert=True
    )
    
    # Add to live feed
    live_feed_col.insert_one({
        "user_id": user_id,
        "action": f"Joined Event #{request.event_id}",
        "type": "event_join",
        "timestamp": now.isoformat()
    })
    
    return {
        "success": True,
        "message": f"Event #{request.event_id} beigetreten!",
        "event_id": request.event_id
    }

# ======================== STORE SYSTEM ========================

purchases_col = db["purchases"]
inventory_col = db["inventory"]

class StoreBuyRequest(BaseModel):
    item_id: str
    price: int

@router.post("/store/buy")
async def buy_store_item(request: StoreBuyRequest, authorization: str = Header(None)):
    """Buy an item from the store"""
    user_id = get_user_id_from_token(authorization)
    now = datetime.now(timezone.utc)
    
    # Check wallet
    wallet = wallets_col.find_one({"user_id": user_id})
    current_coins = wallet.get("coins", 0) if wallet else 0
    
    if current_coins < request.price:
        raise HTTPException(status_code=400, detail="Nicht genug Coins!")
    
    # Deduct coins
    wallets_col.update_one(
        {"user_id": user_id},
        {"$inc": {"coins": -request.price, "total_spent": request.price}}
    )
    
    # Add to inventory
    inventory_col.update_one(
        {"user_id": user_id},
        {
            "$push": {"items": {
                "item_id": request.item_id,
                "purchased_at": now.isoformat()
            }},
            "$setOnInsert": {"created_at": now.isoformat()}
        },
        upsert=True
    )
    
    # Record purchase
    purchases_col.insert_one({
        "user_id": user_id,
        "item_id": request.item_id,
        "price": request.price,
        "purchased_at": now.isoformat()
    })
    
    # Add to live feed
    live_feed_col.insert_one({
        "user_id": user_id,
        "action": f"Bought {request.item_id} for {request.price} Coins",
        "type": "store_purchase",
        "timestamp": now.isoformat()
    })
    
    new_balance = current_coins - request.price
    
    return {
        "success": True,
        "message": f"{request.item_id} gekauft!",
        "new_balance": new_balance
    }

# ======================== LOAN SYSTEM ========================

loans_col = db["loans"]

class LoanRequest(BaseModel):
    amount: int
    interest_rate: int = 10

class RepayLoanRequest(BaseModel):
    loan_id: int

@router.post("/loans/request")
async def request_loan(request: LoanRequest, authorization: str = Header(None)):
    """Request a loan"""
    user_id = get_user_id_from_token(authorization)
    now = datetime.now(timezone.utc)
    
    if request.amount <= 0 or request.amount > 10000:
        raise HTTPException(status_code=400, detail="Ungültiger Betrag (max. 10.000)")
    
    # Check for existing active loan
    existing_loan = loans_col.find_one({"user_id": user_id, "status": "active"})
    if existing_loan:
        raise HTTPException(status_code=400, detail="Du hast bereits einen aktiven Kredit!")
    
    # Calculate repay amount
    repay_amount = int(request.amount * (1 + request.interest_rate / 100))
    
    # Create loan
    loan = {
        "user_id": user_id,
        "amount": request.amount,
        "repay_amount": repay_amount,
        "interest_rate": request.interest_rate,
        "status": "active",
        "created_at": now.isoformat()
    }
    result = loans_col.insert_one(loan)
    
    # Add coins to wallet
    wallets_col.update_one(
        {"user_id": user_id},
        {
            "$inc": {"coins": request.amount},
            "$setOnInsert": {"created_at": now.isoformat()}
        },
        upsert=True
    )
    
    # Add to live feed
    live_feed_col.insert_one({
        "user_id": user_id,
        "action": f"Loan of {request.amount} Coins approved",
        "type": "loan",
        "timestamp": now.isoformat()
    })
    
    wallet = wallets_col.find_one({"user_id": user_id}, {"_id": 0})
    
    return {
        "success": True,
        "message": f"Kredit von {request.amount} Coins genehmigt!",
        "loan_id": str(result.inserted_id),
        "amount": request.amount,
        "repay_amount": repay_amount,
        "new_balance": wallet.get("coins", 0)
    }

@router.post("/loans/repay")
async def repay_loan(request: RepayLoanRequest, authorization: str = Header(None)):
    """Repay a loan"""
    user_id = get_user_id_from_token(authorization)
    now = datetime.now(timezone.utc)
    
    # Find active loan
    loan = loans_col.find_one({"user_id": user_id, "status": "active"})
    if not loan:
        raise HTTPException(status_code=404, detail="Kein aktiver Kredit gefunden")
    
    repay_amount = loan.get("repay_amount", 0)
    
    # Check balance
    wallet = wallets_col.find_one({"user_id": user_id})
    current_coins = wallet.get("coins", 0) if wallet else 0
    
    if current_coins < repay_amount:
        raise HTTPException(status_code=400, detail=f"Nicht genug Coins ({repay_amount} benötigt)")
    
    # Deduct coins
    wallets_col.update_one(
        {"user_id": user_id},
        {"$inc": {"coins": -repay_amount, "total_spent": repay_amount}}
    )
    
    # Update loan status
    loans_col.update_one(
        {"_id": loan["_id"]},
        {"$set": {"status": "repaid", "repaid_at": now.isoformat()}}
    )
    
    new_balance = current_coins - repay_amount
    
    return {
        "success": True,
        "message": "Kredit zurückgezahlt!",
        "new_balance": new_balance
    }

@router.get("/loans/active")
async def get_active_loan(authorization: str = Header(None)):
    """Get user's active loan"""
    user_id = get_user_id_from_token(authorization)
    
    loan = loans_col.find_one({"user_id": user_id, "status": "active"}, {"_id": 0})
    
    return {
        "has_active_loan": loan is not None,
        "loan": loan
    }

# ======================== MERCHANT SYSTEM ========================

merchants_col = db["merchants"]
merchant_transactions_col = db["merchant_transactions"]

class MerchantReceiveRequest(BaseModel):
    amount: int

@router.post("/merchant/register")
async def register_merchant(name: str, authorization: str = Header(None)):
    """Register as a merchant"""
    user_id = get_user_id_from_token(authorization)
    now = datetime.now(timezone.utc)
    
    merchants_col.update_one(
        {"user_id": user_id},
        {
            "$set": {
                "business_name": name,
                "is_active": True,
                "updated_at": now.isoformat()
            },
            "$setOnInsert": {"created_at": now.isoformat(), "total_received": 0}
        },
        upsert=True
    )
    
    return {
        "success": True,
        "message": f"Händler '{name}' registriert!",
        "business_name": name
    }

@router.post("/merchant/receive")
async def receive_merchant_payment(request: MerchantReceiveRequest, authorization: str = Header(None)):
    """Receive a payment as merchant"""
    user_id = get_user_id_from_token(authorization)
    now = datetime.now(timezone.utc)
    
    if request.amount <= 0:
        raise HTTPException(status_code=400, detail="Ungültiger Betrag")
    
    # Add coins to wallet
    wallets_col.update_one(
        {"user_id": user_id},
        {
            "$inc": {"coins": request.amount, "total_earned": request.amount},
            "$setOnInsert": {"created_at": now.isoformat()}
        },
        upsert=True
    )
    
    # Update merchant total
    merchants_col.update_one(
        {"user_id": user_id},
        {"$inc": {"total_received": request.amount}}
    )
    
    # Record transaction
    merchant_transactions_col.insert_one({
        "user_id": user_id,
        "amount": request.amount,
        "type": "incoming",
        "timestamp": now.isoformat()
    })
    
    wallet = wallets_col.find_one({"user_id": user_id}, {"_id": 0})
    
    return {
        "success": True,
        "message": f"+{request.amount} Coins empfangen!",
        "new_balance": wallet.get("coins", 0)
    }

@router.get("/merchant/status")
async def get_merchant_status(authorization: str = Header(None)):
    """Get merchant status and transactions"""
    user_id = get_user_id_from_token(authorization)
    
    merchant = merchants_col.find_one({"user_id": user_id}, {"_id": 0})
    transactions = list(merchant_transactions_col.find(
        {"user_id": user_id},
        {"_id": 0}
    ).sort("timestamp", -1).limit(20))
    
    return {
        "is_registered": merchant is not None,
        "merchant": merchant,
        "transactions": transactions
    }

# ======================== AUCTION SYSTEM ========================

auctions_col = db["auctions"]
auction_bids_col = db["auction_bids"]

class AuctionBidRequest(BaseModel):
    item_id: int
    bid_amount: int

@router.post("/auction/bid")
async def place_auction_bid(request: AuctionBidRequest, authorization: str = Header(None)):
    """Place a bid in an auction"""
    user_id = get_user_id_from_token(authorization)
    now = datetime.now(timezone.utc)
    
    # Each bid costs 1 coin
    bid_cost = 1
    
    # Check wallet
    wallet = wallets_col.find_one({"user_id": user_id})
    current_coins = wallet.get("coins", 0) if wallet else 0
    
    if current_coins < bid_cost:
        raise HTTPException(status_code=400, detail="Nicht genug Coins!")
    
    # Deduct bid cost
    wallets_col.update_one(
        {"user_id": user_id},
        {"$inc": {"coins": -bid_cost, "total_spent": bid_cost}}
    )
    
    # Record bid
    auction_bids_col.insert_one({
        "user_id": user_id,
        "item_id": request.item_id,
        "bid_amount": request.bid_amount,
        "timestamp": now.isoformat()
    })
    
    # Add to live feed
    live_feed_col.insert_one({
        "user_id": user_id,
        "action": f"Bid {request.bid_amount} on Item #{request.item_id}",
        "type": "auction_bid",
        "timestamp": now.isoformat()
    })
    
    return {
        "success": True,
        "message": f"Gebot von {request.bid_amount} platziert!",
        "new_balance": current_coins - bid_cost
    }

@router.get("/auction/active")
async def get_active_auctions():
    """Get active auctions"""
    auctions = [
        {"id": 1, "name": "AirPods Pro", "image": "🎧", "current_bid": 10, "ends_in": 20},
        {"id": 2, "name": "PlayStation 5", "image": "🎮", "current_bid": 50, "ends_in": 45},
        {"id": 3, "name": "iPhone 15", "image": "📱", "current_bid": 100, "ends_in": 120},
    ]
    return {"auctions": auctions}

# ======================== VIP UPGRADE ========================

class VIPUpgradeRequest(BaseModel):
    level: int
    price: int

@router.post("/vip/upgrade")
async def upgrade_vip(request: VIPUpgradeRequest, authorization: str = Header(None)):
    """Upgrade VIP level"""
    user_id = get_user_id_from_token(authorization)
    now = datetime.now(timezone.utc)
    
    # Check wallet
    wallet = wallets_col.find_one({"user_id": user_id})
    current_coins = wallet.get("coins", 0) if wallet else 0
    
    if current_coins < request.price:
        raise HTTPException(status_code=400, detail="Nicht genug Coins!")
    
    # Deduct coins
    wallets_col.update_one(
        {"user_id": user_id},
        {"$inc": {"coins": -request.price, "total_spent": request.price}}
    )
    
    # Update VIP level
    vip_col.update_one(
        {"user_id": user_id},
        {
            "$set": {
                "level": request.level,
                "upgraded_at": now.isoformat()
            },
            "$setOnInsert": {"created_at": now.isoformat()}
        },
        upsert=True
    )
    
    # Add to live feed
    live_feed_col.insert_one({
        "user_id": user_id,
        "action": f"Upgraded to VIP Level {request.level}",
        "type": "vip_upgrade",
        "timestamp": now.isoformat()
    })
    
    return {
        "success": True,
        "message": f"VIP Level {request.level} aktiviert!",
        "new_balance": current_coins - request.price,
        "level": request.level
    }

# ======================== COIN HUNT (MAP) ========================

coin_hunt_col = db["coin_hunt"]

class CollectCoinRequest(BaseModel):
    coin_id: str
    value: int

@router.post("/coins/collect")
async def collect_coin(request: CollectCoinRequest, authorization: str = Header(None)):
    """Collect a coin from the map"""
    user_id = get_user_id_from_token(authorization)
    now = datetime.now(timezone.utc)
    
    # Check if already collected
    existing = coin_hunt_col.find_one({
        "user_id": user_id,
        "coin_id": request.coin_id
    })
    
    if existing:
        raise HTTPException(status_code=400, detail="Coin bereits gesammelt!")
    
    # Record collection
    coin_hunt_col.insert_one({
        "user_id": user_id,
        "coin_id": request.coin_id,
        "value": request.value,
        "collected_at": now.isoformat()
    })
    
    # Add to wallet
    wallets_col.update_one(
        {"user_id": user_id},
        {
            "$inc": {"coins": request.value, "total_earned": request.value},
            "$setOnInsert": {"created_at": now.isoformat()}
        },
        upsert=True
    )
    
    # Add to live feed
    live_feed_col.insert_one({
        "user_id": user_id,
        "action": f"Found {request.value} Coins on Map!",
        "type": "coin_hunt",
        "timestamp": now.isoformat()
    })
    
    wallet = wallets_col.find_one({"user_id": user_id}, {"_id": 0})
    
    return {
        "success": True,
        "message": f"+{request.value} Coins gesammelt!",
        "new_balance": wallet.get("coins", 0)
    }

@router.get("/coins/collected")
async def get_collected_coins(authorization: str = Header(None)):
    """Get user's collected coins from map"""
    user_id = get_user_id_from_token(authorization)
    
    collected = list(coin_hunt_col.find(
        {"user_id": user_id},
        {"_id": 0}
    ))
    
    total_value = sum(c.get("value", 0) for c in collected)
    
    return {
        "collected": [c.get("coin_id") for c in collected],
        "total_value": total_value,
        "count": len(collected)
    }

# ======================== MARKETPLACE EXTENDED ========================

class MarketplaceCreateRequest(BaseModel):
    title: str
    price: int

@router.post("/marketplace/create")
async def create_marketplace_listing(request: MarketplaceCreateRequest, authorization: str = Header(None)):
    """Create a new marketplace listing"""
    user_id = get_user_id_from_token(authorization)
    now = datetime.now(timezone.utc)
    
    if request.price <= 0:
        raise HTTPException(status_code=400, detail="Ungültiger Preis")
    
    listing_id = random.randint(1000, 9999)
    
    # Store in database (would need a marketplace_listings_col)
    live_feed_col.insert_one({
        "user_id": user_id,
        "action": f"Listed '{request.title}' for {request.price} Coins",
        "type": "marketplace_listing",
        "timestamp": now.isoformat()
    })
    
    return {
        "success": True,
        "message": f"'{request.title}' gelistet!",
        "listing_id": listing_id
    }
