from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel
from datetime import datetime, timezone, timedelta
from pymongo import MongoClient
import os

router = APIRouter(prefix="/vip", tags=["VIP"])

# MongoDB Connection
mongo_url = os.environ.get("MONGO_URL")
db_name = os.environ.get("DB_NAME", "bidblitz")
client = MongoClient(mongo_url)
db = client[db_name]

wallets_col = db["wallets"]
vip_col = db["vip"]

# VIP Configuration
VIP_TIERS = {
    "bronze": {
        "level": 1,
        "price": 200,
        "duration_days": 30,
        "benefits": ["+5% Mining Bonus", "Bronze Badge", "Priority Support"],
        "icon": "🥉"
    },
    "silver": {
        "level": 2,
        "price": 500,
        "duration_days": 30,
        "benefits": ["+10% Mining Bonus", "Silver Badge", "-5% Marketplace Fees", "Exclusive Games"],
        "icon": "🥈"
    },
    "gold": {
        "level": 3,
        "price": 1000,
        "duration_days": 30,
        "benefits": ["+20% Mining Bonus", "Gold Badge", "-10% Marketplace Fees", "All Games", "VIP Chat"],
        "icon": "🥇"
    },
    "platinum": {
        "level": 4,
        "price": 2500,
        "duration_days": 30,
        "benefits": ["+30% Mining Bonus", "Platinum Badge", "-15% Fees", "All Features", "Personal Support"],
        "icon": "💎"
    }
}

VIP_GAME_PASS_PRICE = 9.99
VIP_DURATION_DAYS = 30


def get_user_id_from_token(authorization: str) -> str:
    """Extract user_id from token or return demo_user"""
    if not authorization:
        return "demo_user"
    try:
        token = authorization.replace("Bearer ", "")
        import jwt
        payload = jwt.decode(token, options={"verify_signature": False})
        return payload.get("user_id", "demo_user")
    except:
        return "demo_user"


@router.get("/tiers")
async def get_vip_tiers():
    """Get all VIP tiers and benefits"""
    return {
        "tiers": VIP_TIERS,
        "game_pass_price": VIP_GAME_PASS_PRICE
    }


class BuyVIPRequest(BaseModel):
    tier: str = "bronze"


@router.post("/buy")
async def buy_vip(request: BuyVIPRequest, authorization: str = Header(None)):
    """Buy VIP membership"""
    user_id = get_user_id_from_token(authorization)
    now = datetime.now(timezone.utc)
    
    if request.tier not in VIP_TIERS:
        raise HTTPException(status_code=404, detail="VIP Tier nicht gefunden")
    
    tier = VIP_TIERS[request.tier]
    price = tier["price"]
    
    # Check wallet
    wallet = wallets_col.find_one({"user_id": user_id})
    current_coins = wallet.get("coins", 0) if wallet else 0
    
    if current_coins < price:
        raise HTTPException(status_code=400, detail=f"Nicht genug Coins! ({price} benötigt)")
    
    # Deduct coins
    wallets_col.update_one(
        {"user_id": user_id},
        {"$inc": {"coins": -price, "total_spent": price}}
    )
    
    # Set VIP status
    expires = now + timedelta(days=tier["duration_days"])
    
    vip_col.update_one(
        {"user_id": user_id},
        {
            "$set": {
                "active": True,
                "tier": request.tier,
                "level": tier["level"],
                "expires": expires.isoformat(),
                "updated_at": now.isoformat()
            },
            "$setOnInsert": {"created_at": now.isoformat()}
        },
        upsert=True
    )
    
    return {
        "success": True,
        "vip": True,
        "tier": request.tier,
        "level": tier["level"],
        "expires": expires.isoformat(),
        "new_balance": current_coins - price,
        "message": f"VIP {request.tier.capitalize()} aktiviert!"
    }


@router.get("/status")
async def get_vip_status(authorization: str = Header(None)):
    """Get user's VIP status"""
    user_id = get_user_id_from_token(authorization)
    
    vip = vip_col.find_one({"user_id": user_id}, {"_id": 0})
    
    if not vip:
        return {
            "vip": False,
            "tier": None,
            "level": 0
        }
    
    # Check if expired
    expires = vip.get("expires")
    if expires:
        expire_date = datetime.fromisoformat(expires.replace("Z", "+00:00"))
        if expire_date < datetime.now(timezone.utc):
            return {
                "vip": False,
                "tier": None,
                "level": 0,
                "expired": True
            }
    
    return {
        "vip": vip.get("active", False),
        "tier": vip.get("tier"),
        "level": vip.get("level", 0),
        "expires": vip.get("expires"),
        "benefits": VIP_TIERS.get(vip.get("tier"), {}).get("benefits", [])
    }


@router.get("/benefits")
async def get_vip_benefits(authorization: str = Header(None)):
    """Get current user's VIP benefits"""
    user_id = get_user_id_from_token(authorization)
    
    vip = vip_col.find_one({"user_id": user_id}, {"_id": 0})
    
    if not vip or not vip.get("active"):
        return {
            "mining_bonus": 0,
            "marketplace_discount": 0,
            "exclusive_games": False,
            "vip_chat": False
        }
    
    tier = vip.get("tier", "bronze")
    level = vip.get("level", 1)
    
    return {
        "mining_bonus": level * 5,  # 5%, 10%, 15%, 20%
        "marketplace_discount": max(0, (level - 1) * 5),  # 0%, 5%, 10%, 15%
        "exclusive_games": level >= 2,
        "vip_chat": level >= 3,
        "personal_support": level >= 4
    }
