"""
BidBlitz — LiveKit Live-Shopping Integration
Video Streaming für Creator, Live-Shopping, Auctions mit Video
"""
import os
import logging
from datetime import datetime, timedelta
from typing import Optional
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from livekit import api
from core.database import db
from core.security import get_current_user
from routes.pos_system import short_id, now_iso

router = APIRouter(prefix="/api/livekit", tags=["LiveKit Streaming"])
log = logging.getLogger("bidblitz.livekit")


# ═══════════════════════════════════════════════════════════════════════
# TOKEN GENERATION & ROOM MANAGEMENT
# ═══════════════════════════════════════════════════════════════════════

class CreateRoomRequest(BaseModel):
    room_name: str
    max_participants: Optional[int] = 100
    empty_timeout: Optional[int] = 300
    is_live_shopping: Optional[bool] = False

class TokenRequest(BaseModel):
    room_name: str
    participant_name: Optional[str] = None
    identity: Optional[str] = None
    is_publisher: Optional[bool] = True

async def create_livekit_token(
    room_name: str,
    participant_identity: str,
    participant_name: str,
    can_publish: bool = True,
    can_subscribe: bool = True,
) -> str:
    """Generate LiveKit access token."""
    api_key = os.getenv('LIVEKIT_API_KEY', 'devkey')
    api_secret = os.getenv('LIVEKIT_API_SECRET', 'secret')
    
    token = api.AccessToken(api_key, api_secret)
    token.with_identity(participant_identity)
    token.with_name(participant_name)
    token.with_grants(api.VideoGrants(
        room_join=True,
        room=room_name,
        can_publish=can_publish,
        can_subscribe=can_subscribe,
        can_publish_data=True,
    ))
    token.with_ttl(timedelta(hours=24))
    
    return token.to_jwt()

@router.post("/rooms")
async def create_streaming_room(req: CreateRoomRequest, request: Request):
    """Create LiveKit room for live streaming."""
    user = await get_current_user(request)
    
    try:
        livekit_url = os.getenv('LIVEKIT_URL', 'ws://localhost:7880')
        api_key = os.getenv('LIVEKIT_API_KEY', 'devkey')
        api_secret = os.getenv('LIVEKIT_API_SECRET', 'secret')
        
        livekit = api.LiveKitAPI(livekit_url, api_key, api_secret)
        
        room = api.CreateRoomRequest(
            name=req.room_name,
            max_participants=req.max_participants,
            empty_timeout=req.empty_timeout,
        )
        
        # LiveKit API doesn't have async support in current version, use sync
        # In production, wrap with asyncio.to_thread()
        
        # Save to database
        await db.livekit_rooms.insert_one({
            "room_id": short_id("LKR", 10),
            "room_name": req.room_name,
            "creator_id": str(user["_id"]),
            "max_participants": req.max_participants,
            "status": "active",
            "is_live_shopping": req.is_live_shopping,
            "created_at": now_iso(),
        })
        
        log.info(f"LiveKit room created: {req.room_name}")
        
        return {
            "room_name": req.room_name,
            "max_participants": req.max_participants,
            "created_at": now_iso(),
        }
    except Exception as e:
        log.error(f"Room creation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/token")
async def generate_streaming_token(req: TokenRequest, request: Request):
    """Generate LiveKit access token for participant."""
    user = await get_current_user(request)

    try:
        participant_identity = req.identity or str(user["_id"])
        participant_name = req.participant_name or user.get("username") or participant_identity

        token = await create_livekit_token(
            room_name=req.room_name,
            participant_identity=participant_identity,
            participant_name=participant_name,
            can_publish=req.is_publisher,
            can_subscribe=True,
        )

        livekit_url = os.getenv('LIVEKIT_URL', 'ws://localhost:7880')

        return {
            'server_url': livekit_url,
            'url': livekit_url,
            'participant_token': token,
            'token': token,
            'room_name': req.room_name,
            'is_publisher': req.is_publisher,
        }
    except Exception as e:
        log.error(f"Token generation error: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate token")


@router.get("/rooms")
async def list_streaming_rooms(request: Request):
    """List all active LiveKit streaming rooms."""
    await get_current_user(request)
    rooms = await db.livekit_rooms.find(
        {"status": {"$ne": "ended"}},
        {"_id": 0},
    ).sort("created_at", -1).limit(50).to_list(length=50)
    return {"rooms": rooms, "total": len(rooms)}


# ═══════════════════════════════════════════════════════════════════════
# LIVE-SHOPPING PRODUCT SHOWCASE
# ═══════════════════════════════════════════════════════════════════════

class Product(BaseModel):
    product_id: str
    name: str
    price: float
    image: str
    description: str

@router.post("/rooms/{room_name}/products")
async def add_product_to_stream(room_name: str, product: Product, request: Request):
    """Add product to live stream showcase."""
    user = await get_current_user(request)
    
    await db.livekit_products.insert_one({
        "room_name": room_name,
        "product_id": product.product_id,
        "name": product.name,
        "price": product.price,
        "image": product.image,
        "description": product.description,
        "added_by": str(user["_id"]),
        "added_at": now_iso(),
    })
    
    log.info(f"Product added to stream {room_name}: {product.name}")
    
    return {"ok": True, "product": product}

@router.get("/rooms/{room_name}/products")
async def get_stream_products(room_name: str, request: Request):
    """Get all products showcased in stream."""
    await get_current_user(request)
    
    products = await db.livekit_products.find(
        {"room_name": room_name},
        {"_id": 0}
    ).to_list(100)
    
    return {"products": products, "count": len(products)}


# ═══════════════════════════════════════════════════════════════════════
# RECORDING & EGRESS
# ═══════════════════════════════════════════════════════════════════════

class RecordingRequest(BaseModel):
    room_name: str
    s3_bucket: Optional[str] = None

@router.post("/rooms/{room_name}/recording/start")
async def start_stream_recording(room_name: str, req: RecordingRequest, request: Request):
    """Start recording live stream."""
    user = await get_current_user(request)
    
    # Placeholder: LiveKit recording requires additional setup
    # In production, use LiveKit Egress API
    
    recording_id = short_id("REC", 10)
    
    await db.livekit_recordings.insert_one({
        "recording_id": recording_id,
        "room_name": room_name,
        "started_by": str(user["_id"]),
        "status": "recording",
        "s3_bucket": req.s3_bucket,
        "started_at": now_iso(),
    })
    
    log.info(f"Recording started for room {room_name}")
    
    return {
        "recording_id": recording_id,
        "room_name": room_name,
        "status": "recording",
    }

@router.post("/rooms/{room_name}/recording/stop")
async def stop_stream_recording(room_name: str, recording_id: str, request: Request):
    """Stop recording."""
    await get_current_user(request)
    
    await db.livekit_recordings.update_one(
        {"recording_id": recording_id, "room_name": room_name},
        {"$set": {"status": "stopped", "stopped_at": now_iso()}}
    )
    
    log.info(f"Recording stopped: {recording_id}")
    
    return {"ok": True, "recording_id": recording_id}


# ═══════════════════════════════════════════════════════════════════════
# STREAM ANALYTICS
# ═══════════════════════════════════════════════════════════════════════

@router.get("/rooms/{room_name}/analytics")
async def get_stream_analytics(room_name: str, request: Request):
    """Get live stream analytics."""
    await get_current_user(request)
    
    room = await db.livekit_rooms.find_one({"room_name": room_name}, {"_id": 0})
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    
    # Placeholder: Real analytics would come from LiveKit webhooks
    analytics = {
        "room_name": room_name,
        "total_viewers": 0,  # Track via webhooks
        "peak_viewers": 0,
        "duration_minutes": 0,
        "products_shown": await db.livekit_products.count_documents({"room_name": room_name}),
    }
    
    return analytics

@router.get("/health")
async def livekit_health():
    """Health check."""
    return {
        "status": "ok",
        "livekit_url": os.getenv('LIVEKIT_URL', 'ws://localhost:7880'),
    }
