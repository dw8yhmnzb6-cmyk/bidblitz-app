"""Auction Chat Router - Live chat during auctions"""
from fastapi import APIRouter, HTTPException, Depends, WebSocket, WebSocketDisconnect
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict
from pydantic import BaseModel
import uuid
import asyncio
import json

from config import db, logger
from dependencies import get_current_user

router = APIRouter(prefix="/auction-chat", tags=["Auction Chat"])

# WebSocket connections per auction
auction_connections: Dict[str, List[WebSocket]] = {}

# Reaction types
REACTIONS = ["🔥", "😱", "👏", "💪", "🎉", "😅", "💰", "🏆"]

# ==================== SCHEMAS ====================

class ChatMessage(BaseModel):
    auction_id: str
    message: str

class Reaction(BaseModel):
    auction_id: str
    reaction: str

# ==================== ENDPOINTS ====================

@router.get("/{auction_id}/messages")
async def get_chat_messages(auction_id: str, limit: int = 50):
    """Get recent chat messages for an auction"""
    messages = await db.auction_chat.find(
        {"auction_id": auction_id},
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    # Reverse to get chronological order
    messages.reverse()
    
    return {"messages": messages, "auction_id": auction_id}

@router.post("/send")
async def send_chat_message(data: ChatMessage, user: dict = Depends(get_current_user)):
    """Send a chat message to an auction"""
    # Validate auction exists and is active
    auction = await db.auctions.find_one({"id": data.auction_id}, {"_id": 0})
    if not auction:
        raise HTTPException(status_code=404, detail="Auktion nicht gefunden")
    
    if auction.get("status") != "active":
        raise HTTPException(status_code=400, detail="Auktion ist nicht mehr aktiv")
    
    # Rate limit: max 1 message per 3 seconds per user
    recent = await db.auction_chat.find_one({
        "auction_id": data.auction_id,
        "user_id": user["id"],
        "created_at": {"$gte": (datetime.now(timezone.utc) - timedelta(seconds=3)).isoformat()}
    })
    
    if recent:
        raise HTTPException(status_code=429, detail="Bitte warte einen Moment")
    
    # Sanitize message (max 100 chars, no links)
    message = data.message[:100].strip()
    if not message:
        raise HTTPException(status_code=400, detail="Nachricht darf nicht leer sein")
    
    # Check for spam/inappropriate content (basic filter)
    blocked_words = ["spam", "scam", "http", "www.", ".com", ".de"]
    message_lower = message.lower()
    for word in blocked_words:
        if word in message_lower:
            raise HTTPException(status_code=400, detail="Nachricht enthält nicht erlaubte Inhalte")
    
    # Create message
    chat_message = {
        "id": str(uuid.uuid4()),
        "auction_id": data.auction_id,
        "user_id": user["id"],
        "user_name": user.get("name", user.get("username", "Anonym"))[:15],
        "message": message,
        "type": "message",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.auction_chat.insert_one(chat_message)
    
    # Broadcast to WebSocket clients
    await broadcast_to_auction(data.auction_id, {
        "type": "chat_message",
        "data": {k: v for k, v in chat_message.items() if k != "_id"}
    })
    
    return {"success": True, "message_id": chat_message["id"]}

@router.post("/react")
async def send_reaction(data: Reaction, user: dict = Depends(get_current_user)):
    """Send a reaction emoji to an auction"""
    if data.reaction not in REACTIONS:
        raise HTTPException(status_code=400, detail="Ungültige Reaktion")
    
    # Rate limit reactions
    recent = await db.auction_reactions.find_one({
        "auction_id": data.auction_id,
        "user_id": user["id"],
        "created_at": {"$gte": (datetime.now(timezone.utc) - timedelta(seconds=1)).isoformat()}
    })
    
    if recent:
        raise HTTPException(status_code=429, detail="Zu schnell!")
    
    # Save reaction
    reaction = {
        "id": str(uuid.uuid4()),
        "auction_id": data.auction_id,
        "user_id": user["id"],
        "reaction": data.reaction,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.auction_reactions.insert_one(reaction)
    
    # Broadcast to WebSocket clients
    await broadcast_to_auction(data.auction_id, {
        "type": "reaction",
        "data": {
            "reaction": data.reaction,
            "user_name": user.get("name", "")[:10]
        }
    })
    
    return {"success": True}

@router.get("/{auction_id}/viewers")
async def get_auction_viewers(auction_id: str):
    """Get current viewer count for an auction"""
    count = len(auction_connections.get(auction_id, []))
    
    # Also count from recent activity
    recent_activity = await db.auction_activity.count_documents({
        "auction_id": auction_id,
        "last_seen": {"$gte": (datetime.now(timezone.utc) - timedelta(minutes=5)).isoformat()}
    })
    
    return {
        "viewers": max(count, recent_activity),
        "auction_id": auction_id
    }

@router.get("/reactions")
async def get_available_reactions():
    """Get list of available reaction emojis"""
    return {"reactions": REACTIONS}

@router.websocket("/ws/{auction_id}")
async def auction_chat_websocket(websocket: WebSocket, auction_id: str):
    """WebSocket endpoint for real-time auction chat"""
    await websocket.accept()
    
    # Add to auction's connection list
    if auction_id not in auction_connections:
        auction_connections[auction_id] = []
    auction_connections[auction_id].append(websocket)
    
    # Broadcast updated viewer count
    await broadcast_to_auction(auction_id, {
        "type": "viewer_update",
        "data": {"viewers": len(auction_connections[auction_id])}
    })
    
    try:
        while True:
            data = await websocket.receive_text()
            # Could handle client ping/pong here
    except WebSocketDisconnect:
        auction_connections[auction_id].remove(websocket)
        if not auction_connections[auction_id]:
            del auction_connections[auction_id]
        else:
            await broadcast_to_auction(auction_id, {
                "type": "viewer_update",
                "data": {"viewers": len(auction_connections[auction_id])}
            })

async def broadcast_to_auction(auction_id: str, message: dict):
    """Broadcast message to all WebSocket clients watching an auction"""
    connections = auction_connections.get(auction_id, [])
    for connection in connections:
        try:
            await connection.send_json(message)
        except:
            pass


auction_chat_router = router
