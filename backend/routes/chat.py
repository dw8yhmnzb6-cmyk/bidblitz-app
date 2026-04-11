"""
BidBlitz V2 - Real-Time Chat System
Supports user-to-user chat across all modules:
- Marketplace (Buyer ↔ Seller)
- Taxi (Rider ↔ Driver)
- Food (Customer ↔ Restaurant)
"""

import secrets
import logging
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from typing import Optional, List
from bson import ObjectId

from core.database import db
from core.security import get_current_user

router = APIRouter(prefix="/api/chat", tags=["Chat"])
logger = logging.getLogger("bidblitz.chat")


# ══════════════════════════════════════════════════════════════════════════════
# SCHEMAS
# ══════════════════════════════════════════════════════════════════════════════

class CreateChatRequest(BaseModel):
    user_id: str
    context: Optional[str] = None  # e.g., "marketplace:listing_id" or "taxi:ride_id"
    context_title: Optional[str] = None


class SendMessageRequest(BaseModel):
    chat_id: str
    message: str = Field(..., min_length=1, max_length=2000)


class MarkReadRequest(BaseModel):
    chat_id: str


# ══════════════════════════════════════════════════════════════════════════════
# CREATE / GET CHAT
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/create")
async def create_chat(req: CreateChatRequest, request: Request):
    """
    Create or get existing chat between two users.
    If chat already exists, returns existing chat.
    """
    user = await get_current_user(request)
    user1_id = str(user["_id"])
    user2_id = req.user_id
    
    # Validate other user exists
    if not ObjectId.is_valid(user2_id):
        raise HTTPException(status_code=400, detail="Ungültige User-ID")
    
    other_user = await db.users.find_one({"_id": ObjectId(user2_id)})
    if not other_user:
        raise HTTPException(status_code=404, detail="Benutzer nicht gefunden")
    
    if user1_id == user2_id:
        raise HTTPException(status_code=400, detail="Du kannst keinen Chat mit dir selbst erstellen")
    
    # Check if chat already exists (in either direction)
    existing = await db.chats.find_one({
        "$or": [
            {"user1_id": user1_id, "user2_id": user2_id},
            {"user1_id": user2_id, "user2_id": user1_id},
        ]
    })
    
    if existing:
        existing.pop("_id", None)
        return {
            "ok": True,
            "chat": existing,
            "created": False,
        }
    
    # Create new chat
    now = datetime.now(timezone.utc)
    chat_id = secrets.token_hex(8)
    
    chat = {
        "chat_id": chat_id,
        "user1_id": user1_id,
        "user1_name": user.get("name", ""),
        "user2_id": user2_id,
        "user2_name": other_user.get("name", ""),
        "context": req.context,
        "context_title": req.context_title,
        "last_message": None,
        "last_message_at": None,
        "created_at": now.isoformat(),
        "updated_at": now.isoformat(),
    }
    
    await db.chats.insert_one(chat)
    chat.pop("_id", None)
    
    logger.info(f"New chat created: {chat_id} between {user1_id} and {user2_id}")
    
    return {
        "ok": True,
        "chat": chat,
        "created": True,
    }


@router.get("/find/{user_id}")
async def find_chat_with_user(user_id: str, request: Request):
    """Find existing chat with specific user."""
    user = await get_current_user(request)
    current_user_id = str(user["_id"])
    
    chat = await db.chats.find_one({
        "$or": [
            {"user1_id": current_user_id, "user2_id": user_id},
            {"user1_id": user_id, "user2_id": current_user_id},
        ]
    }, {"_id": 0})
    
    if not chat:
        return {"exists": False, "chat": None}
    
    return {"exists": True, "chat": chat}


# ══════════════════════════════════════════════════════════════════════════════
# SEND MESSAGE
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/send")
async def send_message(req: SendMessageRequest, request: Request):
    """Send a message in a chat."""
    user = await get_current_user(request)
    sender_id = str(user["_id"])
    
    # Validate chat exists
    chat = await db.chats.find_one({"chat_id": req.chat_id})
    if not chat:
        raise HTTPException(status_code=404, detail="Chat nicht gefunden")
    
    # Validate user is participant
    if sender_id not in [chat["user1_id"], chat["user2_id"]]:
        raise HTTPException(status_code=403, detail="Du bist kein Teilnehmer dieses Chats")
    
    # Determine recipient
    recipient_id = chat["user2_id"] if sender_id == chat["user1_id"] else chat["user1_id"]
    
    now = datetime.now(timezone.utc)
    message_id = secrets.token_hex(8)
    
    message = {
        "message_id": message_id,
        "chat_id": req.chat_id,
        "sender_id": sender_id,
        "sender_name": user.get("name", ""),
        "recipient_id": recipient_id,
        "message": req.message,
        "read": False,
        "created_at": now.isoformat(),
    }
    
    await db.chat_messages.insert_one(message)
    message.pop("_id", None)
    
    # Update chat with last message
    await db.chats.update_one(
        {"chat_id": req.chat_id},
        {"$set": {
            "last_message": req.message[:100],
            "last_message_at": now.isoformat(),
            "last_sender_id": sender_id,
            "updated_at": now.isoformat(),
        }}
    )
    
    # Send notification to recipient
    await db.notifications.insert_one({
        "id": secrets.token_hex(8),
        "user_id": recipient_id,
        "type": "chat_message",
        "title": f"Neue Nachricht von {user.get('name', 'Benutzer')}",
        "message": req.message[:50] + ("..." if len(req.message) > 50 else ""),
        "data": {"chat_id": req.chat_id, "message_id": message_id},
        "read": False,
        "created_at": now.isoformat(),
    })
    
    return {
        "ok": True,
        "message": message,
    }


# ══════════════════════════════════════════════════════════════════════════════
# GET CHAT LIST
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/list")
async def get_chat_list(request: Request):
    """Get all chats for current user with last message and unread count."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    # Find all chats where user is participant
    chats = await db.chats.find({
        "$or": [
            {"user1_id": user_id},
            {"user2_id": user_id},
        ]
    }, {"_id": 0}).sort("last_message_at", -1).to_list(100)
    
    # Enrich with unread counts and other user info
    result = []
    for chat in chats:
        # Determine the other user
        if chat["user1_id"] == user_id:
            other_user_id = chat["user2_id"]
            other_user_name = chat.get("user2_name", "")
        else:
            other_user_id = chat["user1_id"]
            other_user_name = chat.get("user1_name", "")
        
        # Get unread count
        unread_count = await db.chat_messages.count_documents({
            "chat_id": chat["chat_id"],
            "recipient_id": user_id,
            "read": False,
        })
        
        result.append({
            **chat,
            "other_user_id": other_user_id,
            "other_user_name": other_user_name,
            "unread_count": unread_count,
        })
    
    # Total unread across all chats
    total_unread = sum(c["unread_count"] for c in result)
    
    return {
        "chats": result,
        "total": len(result),
        "total_unread": total_unread,
    }


# ══════════════════════════════════════════════════════════════════════════════
# GET MESSAGES
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/{chat_id}")
async def get_chat_messages(chat_id: str, request: Request, limit: int = 50, before: Optional[str] = None):
    """
    Get messages in a chat.
    Automatically marks messages as read.
    """
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    # Validate chat exists and user is participant
    chat = await db.chats.find_one({"chat_id": chat_id}, {"_id": 0})
    if not chat:
        raise HTTPException(status_code=404, detail="Chat nicht gefunden")
    
    if user_id not in [chat["user1_id"], chat["user2_id"]]:
        raise HTTPException(status_code=403, detail="Du bist kein Teilnehmer dieses Chats")
    
    # Build query
    query = {"chat_id": chat_id}
    if before:
        query["created_at"] = {"$lt": before}
    
    # Get messages (newest first)
    messages = await db.chat_messages.find(
        query, {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    # Reverse to show oldest first in UI
    messages.reverse()
    
    # Mark all received messages as read
    await db.chat_messages.update_many(
        {"chat_id": chat_id, "recipient_id": user_id, "read": False},
        {"$set": {"read": True, "read_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    # Determine other user info
    if chat["user1_id"] == user_id:
        other_user_id = chat["user2_id"]
        other_user_name = chat.get("user2_name", "")
    else:
        other_user_id = chat["user1_id"]
        other_user_name = chat.get("user1_name", "")
    
    return {
        "chat": chat,
        "messages": messages,
        "other_user": {
            "user_id": other_user_id,
            "name": other_user_name,
        },
        "total": len(messages),
        "has_more": len(messages) == limit,
    }


# ══════════════════════════════════════════════════════════════════════════════
# MARK AS READ
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/mark-read")
async def mark_chat_read(req: MarkReadRequest, request: Request):
    """Mark all messages in a chat as read."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    # Validate chat exists and user is participant
    chat = await db.chats.find_one({"chat_id": req.chat_id})
    if not chat:
        raise HTTPException(status_code=404, detail="Chat nicht gefunden")
    
    if user_id not in [chat["user1_id"], chat["user2_id"]]:
        raise HTTPException(status_code=403, detail="Nicht autorisiert")
    
    # Mark all messages to this user as read
    result = await db.chat_messages.update_many(
        {"chat_id": req.chat_id, "recipient_id": user_id, "read": False},
        {"$set": {"read": True, "read_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {
        "ok": True,
        "marked_read": result.modified_count,
    }


# ══════════════════════════════════════════════════════════════════════════════
# POLLING ENDPOINT (Light real-time)
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/poll")
async def poll_new_messages(request: Request, since: Optional[str] = None):
    """
    Poll for new messages since a timestamp.
    Frontend calls this every 3-5 seconds.
    """
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    # Get unread messages
    query = {"recipient_id": user_id, "read": False}
    if since:
        query["created_at"] = {"$gt": since}
    
    new_messages = await db.chat_messages.find(
        query, {"_id": 0}
    ).sort("created_at", -1).limit(50).to_list(50)
    
    # Get total unread count
    unread_count = await db.chat_messages.count_documents({
        "recipient_id": user_id,
        "read": False,
    })
    
    return {
        "new_messages": new_messages,
        "unread_count": unread_count,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


# ══════════════════════════════════════════════════════════════════════════════
# DELETE CHAT
# ══════════════════════════════════════════════════════════════════════════════

@router.delete("/{chat_id}")
async def delete_chat(chat_id: str, request: Request):
    """Delete a chat (only for participants)."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    chat = await db.chats.find_one({"chat_id": chat_id})
    if not chat:
        raise HTTPException(status_code=404, detail="Chat nicht gefunden")
    
    if user_id not in [chat["user1_id"], chat["user2_id"]]:
        raise HTTPException(status_code=403, detail="Nicht autorisiert")
    
    # Delete chat and all messages
    await db.chats.delete_one({"chat_id": chat_id})
    await db.chat_messages.delete_many({"chat_id": chat_id})
    
    return {"ok": True, "deleted": chat_id}


# ══════════════════════════════════════════════════════════════════════════════
# UNREAD COUNT
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/unread-count")
async def get_unread_count(request: Request):
    """Get total unread message count for badge display."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    count = await db.chat_messages.count_documents({
        "recipient_id": user_id,
        "read": False,
    })
    
    return {"unread_count": count}
