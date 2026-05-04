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
    api_key = os.getenv('LIVEKIT_API_KEY') or 'devkey'
    api_secret = os.getenv('LIVEKIT_API_SECRET') or 'secret'
    
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
        livekit_url = os.getenv('LIVEKIT_URL') or 'ws://localhost:7880'
        api_key = os.getenv('LIVEKIT_API_KEY') or 'devkey'
        api_secret = os.getenv('LIVEKIT_API_SECRET') or 'secret'

        # Skip remote API call if no real LiveKit server configured (dev mode).
        # We still create the room record locally so the frontend list works.
        if api_key != 'devkey' and not livekit_url.startswith('ws://localhost'):
            try:
                livekit = api.LiveKitAPI(livekit_url, api_key, api_secret)
                _ = api.CreateRoomRequest(
                    name=req.room_name,
                    max_participants=req.max_participants,
                    empty_timeout=req.empty_timeout,
                )
                # NOTE: LiveKit Python SDK is sync; in production wrap with asyncio.to_thread()
            except Exception as remote_err:
                log.warning(f"LiveKit remote create_room failed (continuing local-only): {remote_err}")
        
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

        livekit_url = os.getenv('LIVEKIT_URL') or 'ws://localhost:7880'

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


class EgressStartRequest(BaseModel):
    room_name: str
    output_type: str = "file"  # "file" | "s3" | "stream"
    s3_bucket: Optional[str] = None
    s3_key: Optional[str] = None
    layout: Optional[str] = "grid"  # "grid" | "speaker"


@router.post("/rooms/{room_name}/egress/start")
async def start_egress_recording(room_name: str, req: EgressStartRequest, request: Request):
    """Start LiveKit server-side egress (room composite) recording.
    Requires real LiveKit deployment with Egress service running.
    """
    user = await get_current_user(request)
    livekit_url = os.getenv("LIVEKIT_URL") or "ws://localhost:7880"
    api_key = os.getenv("LIVEKIT_API_KEY") or "devkey"
    api_secret = os.getenv("LIVEKIT_API_SECRET") or "secret"
    egress_id = short_id("EGR", 12)

    # Initial DB record
    record = {
        "egress_id": egress_id,
        "room_name": room_name,
        "started_by": str(user["_id"]),
        "output_type": req.output_type,
        "s3_bucket": req.s3_bucket,
        "s3_key": req.s3_key,
        "layout": req.layout,
        "status": "starting",
        "started_at": now_iso(),
        "is_egress": True,
    }

    # Try to start real egress if LiveKit is configured
    egress_real_id = None
    egress_error = None
    if api_key != "devkey" and not livekit_url.startswith("ws://localhost"):
        try:
            # Lazy import — egress only available with real LiveKit
            from livekit import api as lk_api
            client = lk_api.LiveKitAPI(livekit_url, api_key, api_secret)

            file_output = None
            if req.output_type == "s3" and req.s3_bucket:
                file_output = lk_api.EncodedFileOutput(
                    file_type=lk_api.EncodedFileType.MP4,
                    filepath=req.s3_key or f"recordings/{egress_id}.mp4",
                    s3=lk_api.S3Upload(
                        bucket=req.s3_bucket,
                        access_key=os.getenv("S3_ACCESS_KEY", ""),
                        secret=os.getenv("S3_SECRET_KEY", ""),
                        region=os.getenv("S3_REGION", "us-east-1"),
                    ),
                )
            else:
                file_output = lk_api.EncodedFileOutput(
                    file_type=lk_api.EncodedFileType.MP4,
                    filepath=f"/recordings/{egress_id}.mp4",
                )

            req_obj = lk_api.RoomCompositeEgressRequest(
                room_name=room_name,
                layout=req.layout,
                file_outputs=[file_output],
            )
            res = await client.egress.start_room_composite_egress(req_obj)
            egress_real_id = res.egress_id
            record["livekit_egress_id"] = egress_real_id
            record["status"] = "active"
        except Exception as e:
            egress_error = str(e)[:300]
            record["status"] = "failed"
            record["error"] = egress_error
            log.warning(f"LiveKit Egress start failed: {e}")
    else:
        record["status"] = "mock"
        record["note"] = "LIVEKIT_URL/API_KEY not configured — egress mocked"

    await db.livekit_egress.insert_one(record)
    return {
        "egress_id": egress_id,
        "livekit_egress_id": egress_real_id,
        "status": record["status"],
        "error": egress_error,
        "note": record.get("note"),
    }


@router.post("/egress/{egress_id}/stop")
async def stop_egress_recording(egress_id: str, request: Request):
    """Stop a running egress."""
    user = await get_current_user(request)
    livekit_url = os.getenv("LIVEKIT_URL") or "ws://localhost:7880"
    api_key = os.getenv("LIVEKIT_API_KEY") or "devkey"
    api_secret = os.getenv("LIVEKIT_API_SECRET") or "secret"

    record = await db.livekit_egress.find_one({"egress_id": egress_id})
    if not record:
        raise HTTPException(status_code=404, detail="Egress not found")

    is_admin = user.get("role") == "admin" or user.get("is_admin")
    if record.get("started_by") != str(user["_id"]) and not is_admin:
        raise HTTPException(status_code=403, detail="Not authorized")

    error = None
    if record.get("livekit_egress_id") and api_key != "devkey":
        try:
            from livekit import api as lk_api
            client = lk_api.LiveKitAPI(livekit_url, api_key, api_secret)
            await client.egress.stop_egress(lk_api.StopEgressRequest(egress_id=record["livekit_egress_id"]))
        except Exception as e:
            error = str(e)[:300]
            log.warning(f"LiveKit Egress stop failed: {e}")

    await db.livekit_egress.update_one(
        {"egress_id": egress_id},
        {"$set": {"status": "stopped", "stopped_at": now_iso(), "stop_error": error}},
    )
    return {"ok": True, "egress_id": egress_id, "error": error}


@router.get("/egress")
async def list_egress(request: Request, room_name: Optional[str] = None):
    """List server-side egress recordings."""
    user = await get_current_user(request)

    query = {}
    if room_name:
        query["room_name"] = room_name
    if user.get("role") != "admin" and not user.get("is_admin"):
        query["started_by"] = str(user["_id"])

    items = await db.livekit_egress.find(
        query, {"_id": 0}
    ).sort("started_at", -1).to_list(200)

    return {"egress": items, "total": len(items)}


@router.get("/recordings")
async def list_recordings(request: Request, room_name: Optional[str] = None):
    """List all recordings, optional filter by room_name."""
    user = await get_current_user(request)

    query = {}
    if room_name:
        query["room_name"] = room_name
    if user.get("role") != "admin" and not user.get("is_admin"):
        # Non-admins only see their own recordings
        query["started_by"] = str(user["_id"])

    recordings = await db.livekit_recordings.find(
        query, {"_id": 0}
    ).sort("started_at", -1).to_list(200)

    return {"recordings": recordings, "total": len(recordings)}


@router.post("/rooms/{room_name}/recording/upload")
async def upload_recording_blob(room_name: str, recording_id: str, request: Request):
    """Client-side MediaRecorder uploads recorded blob.
    Stores raw bytes in MongoDB GridFS for later download.
    """
    from motor.motor_asyncio import AsyncIOMotorGridFSBucket
    user = await get_current_user(request)

    body = await request.body()
    if not body:
        raise HTTPException(status_code=400, detail="Empty body")

    fs = AsyncIOMotorGridFSBucket(db)
    file_id = await fs.upload_from_stream(
        f"{recording_id}.webm",
        body,
        metadata={
            "recording_id": recording_id,
            "room_name": room_name,
            "uploaded_by": str(user["_id"]),
            "uploaded_at": now_iso(),
            "size_bytes": len(body),
        },
    )

    await db.livekit_recordings.update_one(
        {"recording_id": recording_id, "room_name": room_name},
        {"$set": {
            "gridfs_file_id": str(file_id),
            "size_bytes": len(body),
            "uploaded_at": now_iso(),
            "status": "uploaded",
        }},
        upsert=True,
    )

    return {"ok": True, "recording_id": recording_id, "size_bytes": len(body), "file_id": str(file_id)}


@router.get("/recordings/{recording_id}/download")
async def download_recording(recording_id: str, request: Request):
    """Stream recording blob from GridFS."""
    from motor.motor_asyncio import AsyncIOMotorGridFSBucket
    from fastapi.responses import StreamingResponse
    user = await get_current_user(request)

    rec = await db.livekit_recordings.find_one({"recording_id": recording_id}, {"_id": 0})
    if not rec:
        raise HTTPException(status_code=404, detail="Recording not found")

    is_admin = user.get("role") == "admin" or user.get("is_admin")
    if rec.get("started_by") != str(user["_id"]) and not is_admin:
        raise HTTPException(status_code=403, detail="Not authorized")

    file_id = rec.get("gridfs_file_id")
    if not file_id:
        raise HTTPException(status_code=404, detail="Blob not uploaded yet")

    from bson import ObjectId
    fs = AsyncIOMotorGridFSBucket(db)

    async def iter_blob():
        stream = await fs.open_download_stream(ObjectId(file_id))
        while True:
            chunk = await stream.readchunk()
            if not chunk:
                break
            yield chunk

    return StreamingResponse(
        iter_blob(),
        media_type="video/webm",
        headers={
            "Content-Disposition": f'attachment; filename="{recording_id}.webm"',
        },
    )


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
        "livekit_url": os.getenv('LIVEKIT_URL') or 'ws://localhost:7880',
    }
