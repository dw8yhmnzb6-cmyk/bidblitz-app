from fastapi import APIRouter, Header, HTTPException, Query
from pydantic import BaseModel
from datetime import datetime, timezone
from pymongo import MongoClient
import os

router = APIRouter(prefix="/admin", tags=["Admin"])

# MongoDB Connection
mongo_url = os.environ.get("MONGO_URL")
db_name = os.environ.get("DB_NAME", "bidblitz")
client = MongoClient(mongo_url)
db = client[db_name]

wallets_col = db["wallets"]
users_col = db["users"]
miners_col = db["miners"]
games_col = db["game_plays"]
purchases_col = db["purchases"]
live_feed_col = db["live_feed"]

# Admin Configuration
ADMIN_KEY = os.environ.get("ADMIN_KEY", "admin123")


def verify_admin(admin_key: str):
    """Verify admin key"""
    if admin_key != ADMIN_KEY:
        raise HTTPException(status_code=401, detail="Unauthorized")


def get_user_id_from_token(authorization: str) -> str:
    """Extract user_id from token"""
    if not authorization:
        return None
    try:
        token = authorization.replace("Bearer ", "")
        import jwt
        payload = jwt.decode(token, options={"verify_signature": False})
        return payload.get("user_id")
    except:
        return None


@router.get("/users")
async def list_users(admin_key: str = Query(...)):
    """List all users with wallet info"""
    verify_admin(admin_key)
    
    users = list(users_col.find({}, {"_id": 0, "password": 0}))
    wallets = {w["user_id"]: w.get("coins", 0) for w in wallets_col.find({}, {"_id": 0})}
    
    for user in users:
        user_id = user.get("user_id")
        user["coins"] = wallets.get(user_id, 0)
    
    return {
        "total_users": len(users),
        "users": users
    }


class AddCoinsRequest(BaseModel):
    user_id: str
    amount: int


@router.post("/add-coins")
async def add_coins(request: AddCoinsRequest, admin_key: str = Query(...)):
    """Add coins to a user's wallet"""
    verify_admin(admin_key)
    now = datetime.now(timezone.utc)
    
    if request.amount <= 0:
        raise HTTPException(status_code=400, detail="Betrag muss positiv sein")
    
    wallets_col.update_one(
        {"user_id": request.user_id},
        {
            "$inc": {"coins": request.amount, "total_earned": request.amount},
            "$setOnInsert": {"created_at": now.isoformat()}
        },
        upsert=True
    )
    
    # Log action
    live_feed_col.insert_one({
        "user_id": "admin",
        "action": f"Added {request.amount} coins to {request.user_id}",
        "type": "admin_action",
        "timestamp": now.isoformat()
    })
    
    wallet = wallets_col.find_one({"user_id": request.user_id}, {"_id": 0})
    
    return {
        "success": True,
        "user": request.user_id,
        "wallet": wallet.get("coins", 0),
        "message": f"+{request.amount} Coins hinzugefügt"
    }


@router.post("/remove-coins")
async def remove_coins(request: AddCoinsRequest, admin_key: str = Query(...)):
    """Remove coins from a user's wallet"""
    verify_admin(admin_key)
    now = datetime.now(timezone.utc)
    
    if request.amount <= 0:
        raise HTTPException(status_code=400, detail="Betrag muss positiv sein")
    
    wallet = wallets_col.find_one({"user_id": request.user_id})
    current_coins = wallet.get("coins", 0) if wallet else 0
    
    new_balance = max(0, current_coins - request.amount)
    
    wallets_col.update_one(
        {"user_id": request.user_id},
        {
            "$set": {"coins": new_balance},
            "$setOnInsert": {"created_at": now.isoformat()}
        },
        upsert=True
    )
    
    # Log action
    live_feed_col.insert_one({
        "user_id": "admin",
        "action": f"Removed {request.amount} coins from {request.user_id}",
        "type": "admin_action",
        "timestamp": now.isoformat()
    })
    
    return {
        "success": True,
        "user": request.user_id,
        "wallet": new_balance,
        "message": f"-{request.amount} Coins entfernt"
    }


@router.get("/stats")
async def get_system_stats(admin_key: str = Query(...)):
    """Get system-wide statistics"""
    verify_admin(admin_key)
    
    total_users = users_col.count_documents({})
    total_wallets = wallets_col.count_documents({})
    total_miners = miners_col.count_documents({})
    total_games = games_col.count_documents({})
    total_purchases = purchases_col.count_documents({})
    
    # Calculate total coins
    pipeline = [{"$group": {"_id": None, "total": {"$sum": "$coins"}}}]
    total_coins_result = list(wallets_col.aggregate(pipeline))
    total_coins = total_coins_result[0]["total"] if total_coins_result else 0
    
    # Calculate total spent
    spent_pipeline = [{"$group": {"_id": None, "total": {"$sum": "$total_spent"}}}]
    spent_result = list(wallets_col.aggregate(spent_pipeline))
    total_spent = spent_result[0]["total"] if spent_result else 0
    
    # Recent activity
    recent_activity = list(live_feed_col.find(
        {},
        {"_id": 0}
    ).sort("timestamp", -1).limit(20))
    
    return {
        "users": total_users,
        "wallets": total_wallets,
        "miners": total_miners,
        "games_played": total_games,
        "purchases": total_purchases,
        "total_coins_in_circulation": total_coins,
        "total_coins_spent": total_spent,
        "recent_activity": recent_activity
    }


@router.get("/wallets")
async def get_all_wallets(admin_key: str = Query(...)):
    """Get all wallets"""
    verify_admin(admin_key)
    
    wallets = list(wallets_col.find({}, {"_id": 0}))
    
    return {
        "total": len(wallets),
        "wallets": wallets
    }


class BanUserRequest(BaseModel):
    user_id: str
    reason: str = "Violation of terms"


@router.post("/ban-user")
async def ban_user(request: BanUserRequest, admin_key: str = Query(...)):
    """Ban a user"""
    verify_admin(admin_key)
    now = datetime.now(timezone.utc)
    
    users_col.update_one(
        {"user_id": request.user_id},
        {
            "$set": {
                "banned": True,
                "ban_reason": request.reason,
                "banned_at": now.isoformat()
            }
        }
    )
    
    live_feed_col.insert_one({
        "user_id": "admin",
        "action": f"Banned user {request.user_id}: {request.reason}",
        "type": "admin_action",
        "timestamp": now.isoformat()
    })
    
    return {
        "success": True,
        "message": f"User {request.user_id} wurde gebannt"
    }


@router.post("/unban-user")
async def unban_user(user_id: str, admin_key: str = Query(...)):
    """Unban a user"""
    verify_admin(admin_key)
    now = datetime.now(timezone.utc)
    
    users_col.update_one(
        {"user_id": user_id},
        {
            "$set": {"banned": False},
            "$unset": {"ban_reason": "", "banned_at": ""}
        }
    )
    
    live_feed_col.insert_one({
        "user_id": "admin",
        "action": f"Unbanned user {user_id}",
        "type": "admin_action",
        "timestamp": now.isoformat()
    })
    
    return {
        "success": True,
        "message": f"User {user_id} wurde entsperrt"
    }


@router.get("/activity")
async def get_activity_feed(admin_key: str = Query(...), limit: int = 50):
    """Get recent activity feed"""
    verify_admin(admin_key)
    
    activities = list(live_feed_col.find(
        {},
        {"_id": 0}
    ).sort("timestamp", -1).limit(limit))
    
    return {
        "activities": activities,
        "count": len(activities)
    }
