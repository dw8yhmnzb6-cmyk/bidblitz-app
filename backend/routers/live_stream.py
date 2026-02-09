"""
Live Stream Auctions Router - TikTok-style live auctions
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
from bson import ObjectId
import random

router = APIRouter(prefix="/live-stream", tags=["Live Stream"])

# In-memory store for active streams (in production, use Redis)
active_streams = {}

class CreateStreamRequest(BaseModel):
    auction_id: str
    title: str
    description: Optional[str] = None

class StreamChatMessage(BaseModel):
    message: str

class StreamReaction(BaseModel):
    reaction_type: str  # "fire", "heart", "wow", "bid"

@router.get("/active")
async def get_active_streams():
    """Get all currently active live streams"""
    from server import db
    
    streams = await db.live_streams.find({
        "status": "live",
        "ended_at": None
    }).to_list(20)
    
    for stream in streams:
        stream["id"] = str(stream.pop("_id"))
        stream["viewer_count"] = active_streams.get(stream["id"], {}).get("viewers", random.randint(50, 500))
    
    return streams

@router.get("/{stream_id}")
async def get_stream(stream_id: str):
    """Get stream details"""
    from server import db
    
    stream = await db.live_streams.find_one({"_id": ObjectId(stream_id)})
    if not stream:
        raise HTTPException(status_code=404, detail="Stream nicht gefunden")
    
    stream["id"] = str(stream.pop("_id"))
    
    # Get associated auction
    if stream.get("auction_id"):
        auction = await db.auctions.find_one({"_id": ObjectId(stream["auction_id"])})
        if auction:
            auction["id"] = str(auction.pop("_id"))
            stream["auction"] = auction
    
    # Get chat messages
    messages = await db.stream_chat.find({
        "stream_id": stream_id
    }).sort("created_at", -1).limit(50).to_list(50)
    
    for msg in messages:
        msg["id"] = str(msg.pop("_id"))
    
    stream["chat_messages"] = list(reversed(messages))
    stream["viewer_count"] = active_streams.get(stream_id, {}).get("viewers", random.randint(50, 500))
    
    return stream

@router.post("/{stream_id}/join")
async def join_stream(stream_id: str):
    """Join a live stream as viewer"""
    if stream_id not in active_streams:
        active_streams[stream_id] = {"viewers": 0}
    
    active_streams[stream_id]["viewers"] += 1
    
    return {
        "success": True,
        "viewer_count": active_streams[stream_id]["viewers"]
    }

@router.post("/{stream_id}/leave")
async def leave_stream(stream_id: str):
    """Leave a live stream"""
    if stream_id in active_streams:
        active_streams[stream_id]["viewers"] = max(0, active_streams[stream_id]["viewers"] - 1)
    
    return {"success": True}

@router.post("/{stream_id}/chat")
async def send_chat_message(stream_id: str, data: StreamChatMessage):
    """Send a chat message in the stream"""
    from server import db, get_current_user_optional
    
    # For demo, create anonymous message
    message = {
        "stream_id": stream_id,
        "user_name": f"Gast_{random.randint(1000, 9999)}",
        "message": data.message,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    result = await db.stream_chat.insert_one(message)
    message["id"] = str(result.inserted_id)
    if "_id" in message:
        del message["_id"]
    
    return message

@router.post("/{stream_id}/reaction")
async def send_reaction(stream_id: str, data: StreamReaction):
    """Send a reaction (heart, fire, etc.)"""
    from server import db
    
    # Track reactions
    await db.stream_reactions.insert_one({
        "stream_id": stream_id,
        "reaction_type": data.reaction_type,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {"success": True, "reaction": data.reaction_type}

@router.get("/{stream_id}/stats")
async def get_stream_stats(stream_id: str):
    """Get stream statistics"""
    from server import db
    
    # Count reactions
    reactions = await db.stream_reactions.aggregate([
        {"$match": {"stream_id": stream_id}},
        {"$group": {"_id": "$reaction_type", "count": {"$sum": 1}}}
    ]).to_list(10)
    
    reaction_counts = {r["_id"]: r["count"] for r in reactions}
    
    # Count bids during stream
    stream = await db.live_streams.find_one({"_id": ObjectId(stream_id)})
    bid_count = 0
    if stream and stream.get("auction_id"):
        bid_count = await db.bids.count_documents({
            "auction_id": stream["auction_id"]
        })
    
    return {
        "viewer_count": active_streams.get(stream_id, {}).get("viewers", 0),
        "reactions": reaction_counts,
        "total_bids": bid_count
    }
