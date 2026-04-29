# BidBlitz - Group Orders & Rides
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timezone
from uuid import uuid4
from core.database import db
from routes.auth import get_current_user

router = APIRouter(prefix="/api/group", tags=["Group Orders"])

class CreateGroupRequest(BaseModel):
    service_type: str  # taxi, food
    participants: List[str]  # email addresses
    details: dict  # pickup, destination, restaurant_id, etc.

@router.post("/create")
async def create_group_order(req: CreateGroupRequest, user=Depends(get_current_user)):
    """Create group order/ride"""
    group_id = str(uuid4())
    group = {
        "group_id": group_id,
        "service_type": req.service_type,
        "organizer_id": user["user_id"],
        "organizer_name": f"{user.get('first_name', '')} {user.get('last_name', '')}",
        "participants": req.participants,
        "confirmed_by": [user["user_id"]],
        "details": req.details,
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    
    await db.group_orders.insert_one(group)
    
    # Notify participants
    for email in req.participants:
        participant = await db.users.find_one({"email": email}, {"_id": 0})
        if participant:
            await db.notifications.insert_one({
                "notification_id": str(uuid4()),
                "user_id": participant["user_id"],
                "type": "group_invite",
                "title": f"{user.get('first_name', '')} invited you to a group {req.service_type}",
                "message": "Tap to join",
                "data": {"group_id": group_id},
                "read": False,
                "created_at": datetime.now(timezone.utc).isoformat(),
            })
    
    return {"success": True, "group_id": group_id, "join_url": f"https://bidblitz.ae/group/{group_id}"}

@router.post("/{group_id}/join")
async def join_group(group_id: str, user=Depends(get_current_user)):
    """Join a group order"""
    group = await db.group_orders.find_one({"group_id": group_id})
    if not group:
        raise HTTPException(404, "Group not found")
    
    if user["email"] not in group["participants"]:
        raise HTTPException(403, "Not invited")
    
    # Idempotent: schon dabei = OK
    if user["user_id"] in group.get("confirmed_by", []):
        return {"success": True, "all_confirmed": False, "already_joined": True}
    
    await db.group_orders.update_one(
        {"group_id": group_id},
        {"$push": {"confirmed_by": user["user_id"]}}
    )
    
    # Check if all confirmed (organizer is already in confirmed_by, participants is the invite list)
    updated = await db.group_orders.find_one({"group_id": group_id})
    all_confirmed = len(updated["confirmed_by"]) >= len(updated["participants"]) + 1  # +1 for organizer
    
    if all_confirmed:
        # Execute group order
        if group["service_type"] == "taxi":
            # Book taxi for group
            pass
        elif group["service_type"] == "food":
            # Place food order
            pass
        
        await db.group_orders.update_one(
            {"group_id": group_id},
            {"$set": {"status": "confirmed"}}
        )
    
    return {"success": True, "all_confirmed": all_confirmed}

@router.get("/my-groups")
async def get_my_groups(user=Depends(get_current_user)):
    """Get user's group orders.
    Each group enriched with my_email/my_user_id for One-Click-Confirm logic.
    """
    groups = await db.group_orders.find({
        "$or": [
            {"organizer_id": user["user_id"]},
            {"participants": user["email"]}
        ]
    }, {"_id": 0}).sort("created_at", -1).to_list(50)
    
    for g in groups:
        g["my_email"] = user.get("email", "")
        g["my_user_id"] = user["user_id"]
    
    return {"groups": groups}

@router.post("/{group_id}/add-items")
async def add_items_to_group(group_id: str, items: List[dict], user=Depends(get_current_user)):
    """Add items to group food order"""
    group = await db.group_orders.find_one({"group_id": group_id})
    if not group:
        raise HTTPException(404, "Group not found")
    
    if user["user_id"] not in group["confirmed_by"]:
        raise HTTPException(403, "Not a member")
    
    # Store user's items
    await db.group_orders.update_one(
        {"group_id": group_id},
        {"$push": {f"items.{user['user_id']}": {"$each": items}}}
    )
    
    return {"success": True}
