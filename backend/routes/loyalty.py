# BidBlitz - Loyalty & Rewards System
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from datetime import datetime, timezone
from uuid import uuid4
from core.database import db
from routes.auth import get_current_user

router = APIRouter(prefix="/api/loyalty", tags=["Loyalty"])

# Loyalty levels & benefits
LOYALTY_LEVELS = {
    0: {"name": "Bronze", "points": 0, "discount": 0, "perks": []},
    1: {"name": "Silver", "points": 100, "discount": 5, "perks": ["Free delivery on orders >€20"]},
    2: {"name": "Gold", "points": 500, "discount": 10, "perks": ["Free delivery", "Priority support"]},
    3: {"name": "Platinum", "points": 1000, "discount": 15, "perks": ["Free delivery", "Priority support", "Early access"]},
}

@router.get("/my-points")
async def get_my_points(user=Depends(get_current_user)):
    """Get user's loyalty points and level"""
    loyalty = await db.loyalty.find_one({"user_id": user["user_id"]}, {"_id": 0})
    
    if not loyalty:
        # Initialize loyalty account
        loyalty = {
            "user_id": user["user_id"],
            "points": 0,
            "level": 0,
            "stamps": {"taxi": 0, "scooter": 0, "food": 0},
            "history": [],
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.loyalty.insert_one(loyalty)
    
    # Determine level
    level = 0
    for lvl, data in sorted(LOYALTY_LEVELS.items(), reverse=True):
        if loyalty["points"] >= data["points"]:
            level = lvl
            break
    
    return {
        "points": loyalty.get("points", 0),
        "level": level,
        "level_name": LOYALTY_LEVELS[level]["name"],
        "discount": LOYALTY_LEVELS[level]["discount"],
        "perks": LOYALTY_LEVELS[level]["perks"],
        "stamps": loyalty.get("stamps", {}),
        "next_level": LOYALTY_LEVELS.get(level + 1, None),
    }

@router.get("/levels")
async def get_levels():
    """Public list of loyalty levels and benefits"""
    return {"levels": [{"level": lvl, **data} for lvl, data in sorted(LOYALTY_LEVELS.items())]}

@router.get("/history")
async def get_history(user=Depends(get_current_user)):
    """Get loyalty point history for current user"""
    loyalty = await db.loyalty.find_one({"user_id": user["user_id"]}, {"_id": 0}) or {}
    return {"history": loyalty.get("history", [])}

@router.post("/add-points")
async def add_points(points: int, reason: str, user_id: str, user=Depends(get_current_user)):
    """Internal API to add points - admin/system only"""
    if user.get("role") not in ("admin", "system"):
        raise HTTPException(403, "Admin only")
    loyalty = await db.loyalty.find_one({"user_id": user_id})
    
    if not loyalty:
        loyalty = {
            "user_id": user_id,
            "points": 0,
            "level": 0,
            "stamps": {"taxi": 0, "scooter": 0, "food": 0},
            "history": [],
        }
        await db.loyalty.insert_one(loyalty)
    
    new_points = loyalty.get("points", 0) + points
    
    await db.loyalty.update_one(
        {"user_id": user_id},
        {
            "$set": {"points": new_points},
            "$push": {
                "history": {
                    "points": points,
                    "reason": reason,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                }
            }
        }
    )
    
    # Check level up
    old_level = 0
    new_level = 0
    for lvl, data in sorted(LOYALTY_LEVELS.items(), reverse=True):
        if loyalty.get("points", 0) >= data["points"]:
            old_level = lvl
        if new_points >= data["points"]:
            new_level = lvl
            break
    
    if new_level > old_level:
        # Send level-up notification
        await db.notifications.insert_one({
            "notification_id": str(uuid4()),
            "user_id": user_id,
            "type": "loyalty_level_up",
            "title": f"🎉 Level Up! You're now {LOYALTY_LEVELS[new_level]['name']}",
            "message": f"Unlock {LOYALTY_LEVELS[new_level]['discount']}% discount!",
            "read": False,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    
    return {"success": True, "new_points": new_points, "level": new_level}

@router.post("/stamp")
async def add_stamp(service: str, user=Depends(get_current_user)):
    """Add stamp to user's card (5 stamps = reward)"""
    if service not in ["taxi", "scooter", "food"]:
        raise HTTPException(400, "Invalid service")
    
    loyalty = await db.loyalty.find_one({"user_id": user["user_id"]})
    if not loyalty:
        loyalty = {
            "user_id": user["user_id"],
            "points": 0,
            "stamps": {"taxi": 0, "scooter": 0, "food": 0},
        }
        await db.loyalty.insert_one(loyalty)
    
    current_stamps = loyalty.get("stamps", {}).get(service, 0)
    new_stamps = current_stamps + 1
    
    reward_unlocked = False
    if new_stamps >= 5:
        new_stamps = 0
        reward_unlocked = True
        
        # Add reward (e.g., €5 credit)
        await db.wallet.update_one(
            {"user_id": user["user_id"]},
            {"$inc": {"balance": 5.0}},
            upsert=True
        )
        
        await db.notifications.insert_one({
            "notification_id": str(uuid4()),
            "user_id": user["user_id"],
            "type": "stamp_reward",
            "title": "🎁 Stamp Card Complete!",
            "message": f"You earned €5 credit for {service}!",
            "read": False,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    
    await db.loyalty.update_one(
        {"user_id": user["user_id"]},
        {"$set": {f"stamps.{service}": new_stamps}}
    )
    
    return {
        "success": True,
        "stamps": new_stamps,
        "reward_unlocked": reward_unlocked,
    }

@router.get("/leaderboard")
async def get_leaderboard():
    """Get top loyalty users"""
    top_users = await db.loyalty.find({}, {"_id": 0}).sort("points", -1).limit(10).to_list(10)
    
    leaderboard = []
    for idx, loyalty in enumerate(top_users):
        user_doc = None
        try:
            from bson import ObjectId
            user_doc = await db.users.find_one({"_id": ObjectId(loyalty["user_id"])}, {"_id": 0, "name": 1, "first_name": 1, "last_name": 1})
        except Exception:
            user_doc = await db.users.find_one({"id": loyalty["user_id"]}, {"_id": 0, "name": 1, "first_name": 1, "last_name": 1})
        first = (user_doc or {}).get("first_name") or ((user_doc or {}).get("name", "User").split() or ["User"])[0]
        last = (user_doc or {}).get("last_name") or ""
        last_initial = (last[0] + ".") if last else ""
        points_val = loyalty.get("points", 0)
        applicable = [lvl for lvl, data in LOYALTY_LEVELS.items() if points_val >= data["points"]]
        level_name = LOYALTY_LEVELS[max(applicable) if applicable else 0]["name"]
        leaderboard.append({
            "rank": idx + 1,
            "name": f"{first} {last_initial}".strip(),
            "points": points_val,
            "level": level_name,
        })
    
    return {"leaderboard": leaderboard}
