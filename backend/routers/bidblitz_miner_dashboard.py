"""
BidBlitz Miner Dashboard
Buy miners, view info, claim rewards
"""
from fastapi import APIRouter
import time

router = APIRouter(prefix="/miner", tags=["Miner Dashboard"])

miners = {}
wallets = {}

miner_types = {
    "free": {"power": 0.5, "reward": 1, "price": 0},
    "starter": {"price": 500, "power": 5, "reward": 10},
    "pro": {"price": 2000, "power": 20, "reward": 50},
    "ultra": {"price": 5000, "power": 50, "reward": 200}
}


# Miner-Typen anzeigen
@router.get("/types")
def get_miner_types():
    return miner_types


# Miner kaufen
@router.post("/buy")
def buy_miner(user_id: str, miner_type: str):
    miner = miner_types.get(miner_type)
    
    if not miner:
        return {"error": "miner not found"}
    
    price = miner.get("price", 0)
    
    if wallets.get(user_id, 0) < price:
        return {"error": "not enough coins", "need": price, "have": wallets.get(user_id, 0)}
    
    wallets[user_id] = wallets.get(user_id, 0) - price
    
    miners[user_id] = {
        "type": miner_type,
        "power": miner["power"],
        "reward": miner["reward"],
        "last_claim": time.time()
    }
    
    return {"success": True, "miner": miners[user_id]}


# Miner anzeigen
@router.get("/info")
def miner_info(user_id: str):
    miner = miners.get(user_id)
    
    if not miner:
        return {"error": "no miner", "message": "Buy a miner first"}
    
    # Berechne verfügbaren Reward
    elapsed = time.time() - miner["last_claim"]
    hours = elapsed / 3600
    pending_reward = int(hours * miner["reward"])
    
    return {
        "type": miner["type"],
        "power": miner["power"],
        "reward_per_hour": miner["reward"],
        "pending_reward": pending_reward,
        "last_claim": miner["last_claim"]
    }


# Reward holen
@router.get("/claim")
def claim_reward(user_id: str):
    miner = miners.get(user_id)
    
    if not miner:
        return {"error": "no miner"}
    
    # Berechne Reward basierend auf Zeit
    elapsed = time.time() - miner["last_claim"]
    hours = elapsed / 3600
    reward = int(hours * miner["reward"])
    
    if reward < 1:
        return {"error": "nothing to claim", "wait_minutes": int((1 - hours * miner["reward"]) * 60 / miner["reward"])}
    
    wallets[user_id] = wallets.get(user_id, 0) + reward
    miner["last_claim"] = time.time()
    
    return {
        "reward": reward,
        "wallet": wallets[user_id]
    }


# Wallet für Miner
@router.get("/wallet")
def miner_wallet(user_id: str):
    return {"coins": wallets.get(user_id, 0)}


# Coins hinzufügen (für Tests)
@router.post("/wallet/add")
def add_to_wallet(user_id: str, amount: int):
    wallets[user_id] = wallets.get(user_id, 0) + amount
    return {"coins": wallets[user_id]}


# Dashboard-Übersicht
@router.get("/dashboard")
def miner_dashboard(user_id: str):
    miner = miners.get(user_id)
    
    if not miner:
        return {
            "has_miner": False,
            "wallet": wallets.get(user_id, 0),
            "available_miners": miner_types
        }
    
    elapsed = time.time() - miner["last_claim"]
    hours = elapsed / 3600
    pending = int(hours * miner["reward"])
    
    return {
        "has_miner": True,
        "miner": {
            "type": miner["type"],
            "power": miner["power"],
            "reward_per_hour": miner["reward"]
        },
        "pending_reward": pending,
        "wallet": wallets.get(user_id, 0)
    }
