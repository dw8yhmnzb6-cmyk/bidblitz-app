from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel
from datetime import datetime, timezone
from pymongo import MongoClient
import os

router = APIRouter(prefix="/shop", tags=["Shop"])

# MongoDB Connection
mongo_url = os.environ.get("MONGO_URL")
db_name = os.environ.get("DB_NAME", "bidblitz")
client = MongoClient(mongo_url)
db = client[db_name]

wallets_col = db["wallets"]
purchases_col = db["purchases"]

# Coin Packages
COIN_PACKAGES = {
    "small": {"coins": 100, "price": 1, "name": "Starter Pack", "icon": "🪙"},
    "medium": {"coins": 1000, "price": 8, "name": "Value Pack", "icon": "💰"},
    "large": {"coins": 5000, "price": 30, "name": "Mega Pack", "icon": "💎"},
    "vip_pack": {"coins": 10000, "price": 50, "name": "VIP Pack", "icon": "👑"}
}


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


@router.get("/packages")
async def get_packages():
    """Get all available coin packages"""
    return {
        "packages": COIN_PACKAGES,
        "currency": "EUR"
    }


class BuyPackageRequest(BaseModel):
    package: str


@router.post("/buy")
async def buy_package(request: BuyPackageRequest, authorization: str = Header(None)):
    """Buy a coin package"""
    user_id = get_user_id_from_token(authorization)
    now = datetime.now(timezone.utc)
    
    if request.package not in COIN_PACKAGES:
        raise HTTPException(status_code=404, detail="Paket nicht gefunden")
    
    package = COIN_PACKAGES[request.package]
    coins = package["coins"]
    
    # Add coins to wallet
    wallets_col.update_one(
        {"user_id": user_id},
        {
            "$inc": {"coins": coins, "total_earned": coins},
            "$setOnInsert": {"created_at": now.isoformat()}
        },
        upsert=True
    )
    
    # Record purchase
    purchases_col.insert_one({
        "user_id": user_id,
        "type": "coin_package",
        "package": request.package,
        "coins": coins,
        "price": package["price"],
        "purchased_at": now.isoformat()
    })
    
    # Get updated wallet
    wallet = wallets_col.find_one({"user_id": user_id}, {"_id": 0})
    
    return {
        "success": True,
        "coins_added": coins,
        "wallet": wallet.get("coins", 0),
        "message": f"+{coins} Coins hinzugefügt!"
    }


@router.get("/history")
async def get_purchase_history(authorization: str = Header(None)):
    """Get user's purchase history"""
    user_id = get_user_id_from_token(authorization)
    
    history = list(purchases_col.find(
        {"user_id": user_id},
        {"_id": 0}
    ).sort("purchased_at", -1).limit(20))
    
    return {
        "history": history,
        "count": len(history)
    }
