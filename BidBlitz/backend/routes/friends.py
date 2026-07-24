"""
BidBlitz V2 - Friends System
Social networking features: send/accept/decline friend requests, friends list, activity feed.
Integrates with existing chat system for friend-to-friend messaging.
"""
import secrets
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from bson import ObjectId
import asyncio

from core.database import db
from core.security import get_current_user
from routes.web_push import send_push_to_user

router = APIRouter(prefix="/api/friends", tags=["friends"])


# ═══════════════════════════════════════════════════════════════
# SCHEMAS
# ═══════════════════════════════════════════════════════════════

class SendFriendRequestModel(BaseModel):
    friend_id: str


class RespondToRequestModel(BaseModel):
    request_id: str


# ═══════════════════════════════════════════════════════════════
# SEND FRIEND REQUEST
# ═══════════════════════════════════════════════════════════════

@router.post("/send-request")
async def send_friend_request(req: SendFriendRequestModel, request: Request):
    """Send a friend request to another user."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    friend_id = req.friend_id
    
    if user_id == friend_id:
        raise HTTPException(status_code=400, detail="Du kannst dich nicht selbst als Freund hinzufügen")
    
    # Check if friend exists
    if not ObjectId.is_valid(friend_id):
        raise HTTPException(status_code=400, detail="Ungültige Benutzer-ID")
    
    friend = await db.users.find_one({"_id": ObjectId(friend_id)})
    if not friend:
        raise HTTPException(status_code=404, detail="Benutzer nicht gefunden")
    
    # Check if already friends
    existing_friendship = await db.friendships.find_one({
        "$or": [
            {"user1_id": user_id, "user2_id": friend_id, "status": "accepted"},
            {"user1_id": friend_id, "user2_id": user_id, "status": "accepted"},
        ]
    })
    if existing_friendship:
        raise HTTPException(status_code=400, detail="Ihr seid bereits befreundet")
    
    # Check if request already exists (pending)
    existing_request = await db.friend_requests.find_one({
        "$or": [
            {"from_user_id": user_id, "to_user_id": friend_id, "status": "pending"},
            {"from_user_id": friend_id, "to_user_id": user_id, "status": "pending"},
        ]
    })
    if existing_request:
        raise HTTPException(status_code=400, detail="Anfrage existiert bereits")
    
    # Create friend request
    now = datetime.now(timezone.utc)
    request_id = secrets.token_hex(8)
    
    await db.friend_requests.insert_one({
        "request_id": request_id,
        "from_user_id": user_id,
        "from_user_name": user.get("name", ""),
        "to_user_id": friend_id,
        "to_user_name": friend.get("name", ""),
        "status": "pending",
        "created_at": now.isoformat(),
    })
    
    # Send push notification
    try:
        asyncio.create_task(send_push_to_user(
            friend_id,
            title="👥 Neue Freundschaftsanfrage",
            body=f"{user.get('name', 'Jemand')} möchte dein Freund sein",
            data={"type": "friend_request", "request_id": request_id, "from_user_id": user_id},
        ))
    except Exception:
        pass
    
    # Check for "first_friend" achievement
    from routes.gamification import check_and_unlock_achievement
    asyncio.create_task(check_and_unlock_achievement(user_id, "first_friend"))
    
    return {
        "ok": True,
        "request_id": request_id,
        "message": "Freundschaftsanfrage gesendet",
    }


# ═══════════════════════════════════════════════════════════════
# ACCEPT/DECLINE FRIEND REQUEST
# ═══════════════════════════════════════════════════════════════

@router.post("/accept")
async def accept_friend_request(req: RespondToRequestModel, request: Request):
    """Accept a friend request."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    # Find request
    friend_request = await db.friend_requests.find_one({"request_id": req.request_id})
    if not friend_request:
        raise HTTPException(status_code=404, detail="Anfrage nicht gefunden")
    
    # Verify user is the recipient
    if friend_request.get("to_user_id") != user_id:
        raise HTTPException(status_code=403, detail="Nicht autorisiert")
    
    if friend_request.get("status") != "pending":
        raise HTTPException(status_code=400, detail="Anfrage ist nicht mehr ausstehend")
    
    # Update request status
    await db.friend_requests.update_one(
        {"request_id": req.request_id},
        {"$set": {"status": "accepted", "updated_at": datetime.now(timezone.utc).isoformat()}},
    )
    
    # Create friendship
    now = datetime.now(timezone.utc)
    friendship_id = secrets.token_hex(8)
    
    await db.friendships.insert_one({
        "friendship_id": friendship_id,
        "user1_id": friend_request["from_user_id"],
        "user1_name": friend_request["from_user_name"],
        "user2_id": user_id,
        "user2_name": user.get("name", ""),
        "status": "accepted",
        "created_at": now.isoformat(),
    })
    
    # Send push to requester
    try:
        asyncio.create_task(send_push_to_user(
            friend_request["from_user_id"],
            title="✅ Freundschaftsanfrage akzeptiert",
            body=f"{user.get('name', 'Jemand')} hat deine Anfrage akzeptiert",
            data={"type": "friend_accepted", "friend_id": user_id},
        ))
    except Exception:
        pass
    
    # Check achievements
    from routes.gamification import check_and_unlock_achievement
    asyncio.create_task(check_and_unlock_achievement(user_id, "first_friend"))
    asyncio.create_task(check_and_unlock_achievement(friend_request["from_user_id"], "first_friend"))
    
    return {
        "ok": True,
        "friendship_id": friendship_id,
        "message": "Freundschaftsanfrage akzeptiert",
    }


@router.post("/decline")
async def decline_friend_request(req: RespondToRequestModel, request: Request):
    """Decline a friend request."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    # Find request
    friend_request = await db.friend_requests.find_one({"request_id": req.request_id})
    if not friend_request:
        raise HTTPException(status_code=404, detail="Anfrage nicht gefunden")
    
    # Verify user is the recipient
    if friend_request.get("to_user_id") != user_id:
        raise HTTPException(status_code=403, detail="Nicht autorisiert")
    
    # Update request status
    await db.friend_requests.update_one(
        {"request_id": req.request_id},
        {"$set": {"status": "declined", "updated_at": datetime.now(timezone.utc).isoformat()}},
    )
    
    return {"ok": True, "message": "Freundschaftsanfrage abgelehnt"}


# ═══════════════════════════════════════════════════════════════
# GET FRIENDS LIST & REQUESTS
# ═══════════════════════════════════════════════════════════════

@router.get("/list")
async def get_friends_list(request: Request):
    """Get list of all accepted friends."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    # Get all friendships where user is either user1 or user2
    friendships = await db.friendships.find({
        "$or": [
            {"user1_id": user_id, "status": "accepted"},
            {"user2_id": user_id, "status": "accepted"},
        ]
    }, {"_id": 0}).to_list(1000)
    
    # Extract friend IDs and names
    friends = []
    for friendship in friendships:
        if friendship["user1_id"] == user_id:
            friend_id = friendship["user2_id"]
            friend_name = friendship["user2_name"]
        else:
            friend_id = friendship["user1_id"]
            friend_name = friendship["user1_name"]
        
        # Get friend's profile photo (if exists)
        friend_user = await db.users.find_one({"_id": ObjectId(friend_id)}, {"_id": 0, "photo_url": 1, "email": 1})
        
        friends.append({
            "id": friend_id,
            "name": friend_name,
            "photo_url": friend_user.get("photo_url") if friend_user else None,
            "email": friend_user.get("email") if friend_user else None,
            "friendship_id": friendship["friendship_id"],
            "since": friendship["created_at"],
        })
    
    return {
        "friends": friends,
        "total": len(friends),
    }


@router.get("/requests")
async def get_friend_requests(request: Request):
    """Get pending friend requests (received and sent)."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    # Received requests (to_user_id == user_id)
    received = await db.friend_requests.find({
        "to_user_id": user_id,
        "status": "pending",
    }, {"_id": 0}).to_list(100)
    
    # Sent requests (from_user_id == user_id)
    sent = await db.friend_requests.find({
        "from_user_id": user_id,
        "status": "pending",
    }, {"_id": 0}).to_list(100)
    
    return {
        "received": received,
        "sent": sent,
        "total_received": len(received),
        "total_sent": len(sent),
    }


# ═══════════════════════════════════════════════════════════════
# REMOVE FRIEND
# ═══════════════════════════════════════════════════════════════

@router.delete("/remove/{friend_id}")
async def remove_friend(friend_id: str, request: Request):
    """Remove a friend (unfriend)."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    # Find friendship
    friendship = await db.friendships.find_one({
        "$or": [
            {"user1_id": user_id, "user2_id": friend_id},
            {"user1_id": friend_id, "user2_id": user_id},
        ],
        "status": "accepted",
    })
    
    if not friendship:
        raise HTTPException(status_code=404, detail="Freundschaft nicht gefunden")
    
    # Delete friendship
    await db.friendships.delete_one({"friendship_id": friendship["friendship_id"]})
    
    return {"ok": True, "message": "Freund entfernt"}


# ═══════════════════════════════════════════════════════════════
# SEARCH USERS (to send friend request)
# ═══════════════════════════════════════════════════════════════

@router.get("/search")
async def search_users(q: str, request: Request):
    """Search users by name or email to send friend request."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    if len(q) < 2:
        return {"users": []}
    
    # Search by name or email
    users = await db.users.find({
        "$or": [
            {"name": {"$regex": q, "$options": "i"}},
            {"email": {"$regex": q, "$options": "i"}},
        ]
    }, {"_id": 1, "name": 1, "email": 1, "photo_url": 1}).to_list(20)
    
    # Filter out self and existing friends/requests
    result = []
    for u in users:
        uid = str(u["_id"])
        if uid == user_id:
            continue
        
        # Check if already friends
        existing = await db.friendships.find_one({
            "$or": [
                {"user1_id": user_id, "user2_id": uid, "status": "accepted"},
                {"user1_id": uid, "user2_id": user_id, "status": "accepted"},
            ]
        })
        if existing:
            continue
        
        # Check if pending request
        pending = await db.friend_requests.find_one({
            "$or": [
                {"from_user_id": user_id, "to_user_id": uid, "status": "pending"},
                {"from_user_id": uid, "to_user_id": user_id, "status": "pending"},
            ]
        })
        
        result.append({
            "id": uid,
            "name": u.get("name", ""),
            "email": u.get("email", ""),
            "photo_url": u.get("photo_url"),
            "request_pending": bool(pending),
        })
    
    return {"users": result}
