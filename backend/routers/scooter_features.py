"""
Scooter Subscriptions (Abo), Group Rides, and Device Ratings
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone, timedelta
import uuid

from dependencies import get_current_user
from config import db

router = APIRouter(prefix="/scooter-features", tags=["Scooter Features"])

# ==================== ABO / SUBSCRIPTION PLANS ====================

PLANS = {
    "basic": {
        "name": "Basic",
        "price_cents": 2900,
        "description": "Unbegrenzt Entsperren - nur Minutenpreis",
        "free_unlocks": True,
        "free_minutes_per_day": 0,
        "flatrate": False,
    },
    "plus": {
        "name": "Plus",
        "price_cents": 4900,
        "description": "Unbegrenzt Entsperren + 30 Min/Tag gratis",
        "free_unlocks": True,
        "free_minutes_per_day": 30,
        "flatrate": False,
    },
    "unlimited": {
        "name": "Unlimited",
        "price_cents": 9900,
        "description": "Komplett-Flatrate - alles inklusive",
        "free_unlocks": True,
        "free_minutes_per_day": 9999,
        "flatrate": True,
    }
}


class SubscribeRequest(BaseModel):
    plan_id: str  # basic, plus, unlimited


@router.get("/plans")
async def get_subscription_plans():
    """Get available subscription plans"""
    plans = []
    for pid, plan in PLANS.items():
        plans.append({
            "id": pid,
            **plan,
            "price_eur": round(plan["price_cents"] / 100, 2),
            "price_display": f"{plan['price_cents'] / 100:.2f} EUR/Monat"
        })
    return {"plans": plans}


@router.get("/my-subscription")
async def get_my_subscription(user: dict = Depends(get_current_user)):
    """Get user's active subscription"""
    sub = await db.scooter_subscriptions.find_one(
        {"user_id": user["id"], "status": "active"},
        {"_id": 0}
    )
    return {"subscription": sub}


@router.post("/subscribe")
async def subscribe(data: SubscribeRequest, user: dict = Depends(get_current_user)):
    """Subscribe to a scooter plan"""
    if data.plan_id not in PLANS:
        raise HTTPException(400, "Ungueltiger Plan")

    # Check existing subscription
    existing = await db.scooter_subscriptions.find_one(
        {"user_id": user["id"], "status": "active"}
    )
    if existing:
        raise HTTPException(409, "Sie haben bereits ein aktives Abo")

    plan = PLANS[data.plan_id]

    # Charge from wallet
    balance = user.get("wallet_balance_cents", 0)
    if balance < plan["price_cents"]:
        raise HTTPException(402, f"Nicht genug Guthaben. Benoetigt: {plan['price_cents']/100:.2f} EUR")

    # Deduct from wallet
    await db.users.update_one(
        {"id": user["id"]},
        {"$inc": {"wallet_balance_cents": -plan["price_cents"]}}
    )

    # Create ledger entry
    now = datetime.now(timezone.utc)
    await db.wallet_ledger.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "type": "debit",
        "amount_cents": plan["price_cents"],
        "category": "subscription",
        "description": f"Scooter-Abo: {plan['name']} (Monatlich)",
        "created_at": now.isoformat()
    })

    sub_id = str(uuid.uuid4())
    subscription = {
        "id": sub_id,
        "user_id": user["id"],
        "plan_id": data.plan_id,
        "plan_name": plan["name"],
        "price_cents": plan["price_cents"],
        "free_unlocks": plan["free_unlocks"],
        "free_minutes_per_day": plan["free_minutes_per_day"],
        "flatrate": plan["flatrate"],
        "status": "active",
        "started_at": now.isoformat(),
        "expires_at": (now + timedelta(days=30)).isoformat(),
        "auto_renew": True,
        "created_at": now.isoformat()
    }

    await db.scooter_subscriptions.insert_one(subscription)
    subscription.pop("_id", None)

    return {
        "success": True,
        "subscription": subscription,
        "message": f"Abo '{plan['name']}' aktiviert! Gueltig bis {(now + timedelta(days=30)).strftime('%d.%m.%Y')}"
    }


@router.post("/cancel-subscription")
async def cancel_subscription(user: dict = Depends(get_current_user)):
    """Cancel active subscription"""
    result = await db.scooter_subscriptions.update_one(
        {"user_id": user["id"], "status": "active"},
        {"$set": {"status": "cancelled", "auto_renew": False, "cancelled_at": datetime.now(timezone.utc).isoformat()}}
    )
    if result.modified_count == 0:
        raise HTTPException(404, "Kein aktives Abo gefunden")
    return {"success": True, "message": "Abo gekuendigt. Laeuft bis zum Ablaufdatum weiter."}


# ==================== GROUP RIDES ====================

class GroupCreate(BaseModel):
    name: Optional[str] = None
    max_riders: int = 5
    payment_mode: str = "leader_pays"  # leader_pays, split

class GroupJoin(BaseModel):
    group_code: str


@router.post("/groups/create")
async def create_group_ride(data: GroupCreate, user: dict = Depends(get_current_user)):
    """Create a group ride"""
    # Check no active group
    existing = await db.ride_groups.find_one(
        {"leader_id": user["id"], "status": "active"}
    )
    if existing:
        raise HTTPException(409, "Sie haben bereits eine aktive Gruppe")

    group_id = str(uuid.uuid4())
    code = group_id[:6].upper()
    now = datetime.now(timezone.utc)

    group = {
        "id": group_id,
        "code": code,
        "name": data.name or f"Gruppe von {user.get('name', 'Anonym')}",
        "leader_id": user["id"],
        "leader_name": user.get("name"),
        "max_riders": min(data.max_riders, 5),
        "payment_mode": data.payment_mode,
        "members": [{
            "user_id": user["id"],
            "name": user.get("name"),
            "role": "leader",
            "joined_at": now.isoformat(),
            "session_id": None
        }],
        "status": "active",
        "created_at": now.isoformat()
    }

    await db.ride_groups.insert_one(group)
    group.pop("_id", None)

    return {
        "success": True,
        "group": group,
        "invite_code": code,
        "message": f"Gruppe erstellt! Code: {code} - Teile ihn mit deinen Freunden."
    }


@router.post("/groups/join")
async def join_group_ride(data: GroupJoin, user: dict = Depends(get_current_user)):
    """Join a group ride with code"""
    group = await db.ride_groups.find_one(
        {"code": data.group_code.upper(), "status": "active"}
    )
    if not group:
        raise HTTPException(404, "Gruppe nicht gefunden oder abgelaufen")

    if len(group.get("members", [])) >= group.get("max_riders", 5):
        raise HTTPException(409, "Gruppe ist voll")

    if any(m["user_id"] == user["id"] for m in group.get("members", [])):
        raise HTTPException(409, "Du bist bereits in dieser Gruppe")

    await db.ride_groups.update_one(
        {"id": group["id"]},
        {"$push": {"members": {
            "user_id": user["id"],
            "name": user.get("name"),
            "role": "member",
            "joined_at": datetime.now(timezone.utc).isoformat(),
            "session_id": None
        }}}
    )

    return {
        "success": True,
        "group_name": group["name"],
        "leader": group["leader_name"],
        "members_count": len(group["members"]) + 1,
        "message": f"Du bist der Gruppe '{group['name']}' beigetreten!"
    }


@router.get("/groups/my-group")
async def get_my_group(user: dict = Depends(get_current_user)):
    """Get user's active group"""
    group = await db.ride_groups.find_one(
        {"members.user_id": user["id"], "status": "active"},
        {"_id": 0}
    )
    return {"group": group}


@router.post("/groups/{group_id}/leave")
async def leave_group(group_id: str, user: dict = Depends(get_current_user)):
    """Leave a group"""
    group = await db.ride_groups.find_one({"id": group_id})
    if not group:
        raise HTTPException(404, "Gruppe nicht gefunden")

    if group["leader_id"] == user["id"]:
        # Leader leaves = disband
        await db.ride_groups.update_one({"id": group_id}, {"$set": {"status": "disbanded"}})
        return {"success": True, "message": "Gruppe aufgeloest"}

    await db.ride_groups.update_one(
        {"id": group_id},
        {"$pull": {"members": {"user_id": user["id"]}}}
    )
    return {"success": True, "message": "Gruppe verlassen"}


# ==================== SCOOTER RATINGS ====================

class RatingCreate(BaseModel):
    device_id: str
    session_id: Optional[str] = None
    overall: int  # 1-5
    cleanliness: Optional[int] = None  # 1-5
    battery_condition: Optional[int] = None  # 1-5
    brakes: Optional[int] = None  # 1-5
    comment: Optional[str] = None


@router.post("/ratings")
async def rate_scooter(data: RatingCreate, user: dict = Depends(get_current_user)):
    """Rate a scooter after a ride"""
    if not 1 <= data.overall <= 5:
        raise HTTPException(400, "Bewertung muss 1-5 sein")

    # Check device exists
    device = await db.devices.find_one({"id": data.device_id})
    if not device:
        raise HTTPException(404, "Geraet nicht gefunden")

    # Check if already rated this session
    if data.session_id:
        existing = await db.device_ratings.find_one({
            "user_id": user["id"],
            "session_id": data.session_id
        })
        if existing:
            raise HTTPException(409, "Diese Fahrt wurde bereits bewertet")

    rating_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)

    rating = {
        "id": rating_id,
        "device_id": data.device_id,
        "device_serial": device.get("serial"),
        "session_id": data.session_id,
        "user_id": user["id"],
        "user_name": user.get("name"),
        "overall": data.overall,
        "cleanliness": data.cleanliness,
        "battery_condition": data.battery_condition,
        "brakes": data.brakes,
        "comment": data.comment,
        "created_at": now.isoformat()
    }

    await db.device_ratings.insert_one(rating)

    # Update device average rating
    pipeline = [
        {"$match": {"device_id": data.device_id}},
        {"$group": {"_id": None, "avg": {"$avg": "$overall"}, "count": {"$sum": 1}}}
    ]
    result = await db.device_ratings.aggregate(pipeline).to_list(1)
    if result:
        await db.devices.update_one(
            {"id": data.device_id},
            {"$set": {"avg_rating": round(result[0]["avg"], 1), "rating_count": result[0]["count"]}}
        )

    rating.pop("_id", None)
    return {
        "success": True,
        "rating": rating,
        "message": "Danke fuer deine Bewertung!"
    }


@router.get("/ratings/{device_id}")
async def get_device_ratings(device_id: str, limit: int = 20):
    """Get ratings for a device"""
    ratings = await db.device_ratings.find(
        {"device_id": device_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(limit)

    # Get average
    device = await db.devices.find_one({"id": device_id}, {"_id": 0, "avg_rating": 1, "rating_count": 1})

    return {
        "ratings": ratings,
        "avg_rating": device.get("avg_rating", 0) if device else 0,
        "total_ratings": device.get("rating_count", 0) if device else 0
    }
