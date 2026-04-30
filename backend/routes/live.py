"""
Live Shopping Streams — real DB-backed framework for seller-hosted streams.
Video transport is provider-agnostic (plug Agora / Mux / LiveKit / Twitch RTMP later).
This module manages: stream metadata, viewer counts, chat hook, product overlay, auction tie-in.

Complements the older /api/live-shopping mock in live_shopping.py (demo cards).
"""
import logging
import secrets
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from typing import List, Optional, Literal

from core.database import db
from core.security import get_current_user
from core.rate_limit import limiter
from core.audit import log_audit, get_client_info

router = APIRouter(prefix="/api/live", tags=["live"])
logger = logging.getLogger("bidblitz.live")


class StreamCreateRequest(BaseModel):
    title: str = Field(..., min_length=3, max_length=120)
    description: Optional[str] = Field(default="", max_length=500)
    category: Literal["marketplace", "auction", "food", "kids", "general"] = "marketplace"
    product_ids: List[str] = Field(default_factory=list, max_length=20)
    auction_ids: List[str] = Field(default_factory=list, max_length=10)
    cover_image: Optional[str] = None
    scheduled_start: Optional[datetime] = None


class PinProductRequest(BaseModel):
    product_id: str


def _mask_doc(d: dict) -> dict:
    d = dict(d or {})
    d.pop("_id", None)
    for k in ("scheduled_start", "started_at", "ended_at", "created_at", "featured_pinned_at"):
        if isinstance(d.get(k), datetime):
            d[k] = d[k].isoformat()
    return d


@router.post("/create")
@limiter.limit("10/hour")
async def create_stream(req: StreamCreateRequest, request: Request):
    user = await get_current_user(request)
    user_id = str(user["_id"])
    stream_id = secrets.token_urlsafe(10)
    room_key = secrets.token_urlsafe(16)

    doc = {
        "stream_id": stream_id,
        "host_user_id": user_id,
        "host_name": user.get("name"),
        "host_handle": user.get("handle"),
        "title": req.title,
        "description": req.description,
        "category": req.category,
        "product_ids": req.product_ids,
        "auction_ids": req.auction_ids,
        "featured_product_id": (req.product_ids or [None])[0],
        "cover_image": req.cover_image,
        "status": "idle",
        "viewer_count": 0,
        "peak_viewers": 0,
        "total_messages": 0,
        "total_reactions": 0,
        "room_key": room_key,
        "scheduled_start": req.scheduled_start,
        "created_at": datetime.now(timezone.utc),
    }
    await db.live_streams.insert_one(doc)

    ip, ua = get_client_info(request)
    await log_audit("live_stream_created", user_id=user_id, email=user.get("email", ""),
                    ip=ip, user_agent=ua, details={"stream_id": stream_id, "title": req.title})

    return _mask_doc(doc)


@router.post("/start/{stream_id}")
async def start_stream(stream_id: str, request: Request):
    user = await get_current_user(request)
    s = await db.live_streams.find_one({"stream_id": stream_id})
    if not s:
        raise HTTPException(404, "Stream not found")
    if s["host_user_id"] != str(user["_id"]):
        raise HTTPException(403, "Not the host")
    if s.get("status") == "ended":
        raise HTTPException(400, "Stream already ended")

    await db.live_streams.update_one(
        {"stream_id": stream_id},
        {"$set": {"status": "live", "started_at": datetime.now(timezone.utc)}},
    )
    return {"ok": True, "stream_id": stream_id, "room_key": s["room_key"], "status": "live"}


@router.post("/end/{stream_id}")
async def end_stream(stream_id: str, request: Request):
    user = await get_current_user(request)
    s = await db.live_streams.find_one({"stream_id": stream_id})
    if not s:
        raise HTTPException(404, "Stream not found")
    if s["host_user_id"] != str(user["_id"]):
        raise HTTPException(403, "Not the host")

    await db.live_streams.update_one(
        {"stream_id": stream_id},
        {"$set": {"status": "ended", "ended_at": datetime.now(timezone.utc), "viewer_count": 0}},
    )
    return {"ok": True, "stream_id": stream_id, "status": "ended"}


@router.post("/join/{stream_id}")
async def join_stream(stream_id: str, request: Request):
    user = await get_current_user(request)
    s = await db.live_streams.find_one({"stream_id": stream_id})
    if not s:
        raise HTTPException(404, "Stream not found")
    if s.get("status") != "live":
        raise HTTPException(400, "Stream is not live")

    result = await db.live_streams.find_one_and_update(
        {"stream_id": stream_id},
        {
            "$inc": {"viewer_count": 1},
            "$max": {"peak_viewers": (s.get("viewer_count", 0) + 1)},
            "$addToSet": {"viewer_ids": str(user["_id"])},
        },
        return_document=True,
        projection={"_id": 0, "viewer_ids": 0},
    )
    return _mask_doc(result or {})


@router.post("/leave/{stream_id}")
async def leave_stream(stream_id: str, request: Request):
    user = await get_current_user(request)
    await db.live_streams.update_one(
        {"stream_id": stream_id, "status": "live", "viewer_count": {"$gt": 0}},
        {"$inc": {"viewer_count": -1}, "$pull": {"viewer_ids": str(user["_id"])}},
    )
    return {"ok": True}


@router.get("/active")
async def list_active(category: Optional[str] = None, limit: int = 20):
    q = {"status": "live"}
    if category:
        q["category"] = category
    items = []
    cursor = db.live_streams.find(q, {"_id": 0, "viewer_ids": 0, "room_key": 0}) \
        .sort("viewer_count", -1).limit(min(limit, 50))
    async for s in cursor:
        items.append(_mask_doc(s))
    return {"streams": items, "count": len(items)}


@router.get("/upcoming")
async def list_upcoming(limit: int = 10):
    now = datetime.now(timezone.utc)
    items = []
    cursor = db.live_streams.find(
        {"status": "idle", "scheduled_start": {"$gte": now}},
        {"_id": 0, "viewer_ids": 0, "room_key": 0},
    ).sort("scheduled_start", 1).limit(min(limit, 30))
    async for s in cursor:
        items.append(_mask_doc(s))
    return {"streams": items, "count": len(items)}


@router.get("/my-streams")
async def my_streams(request: Request):
    user = await get_current_user(request)
    items = []
    cursor = db.live_streams.find({"host_user_id": str(user["_id"])}, {"_id": 0, "viewer_ids": 0}) \
        .sort("created_at", -1).limit(50)
    async for s in cursor:
        items.append(_mask_doc(s))
    return {"streams": items}


@router.get("/{stream_id}")
async def get_stream(stream_id: str, request: Request):
    user = await get_current_user(request)
    s = await db.live_streams.find_one({"stream_id": stream_id}, {"viewer_ids": 0})
    if not s:
        raise HTTPException(404, "Stream not found")
    is_host = s["host_user_id"] == str(user["_id"])
    out = _mask_doc(s)
    if not is_host:
        out.pop("room_key", None)
    else:
        out["is_host"] = True
    return out


@router.post("/{stream_id}/pin")
async def pin_product(stream_id: str, req: PinProductRequest, request: Request):
    user = await get_current_user(request)
    s = await db.live_streams.find_one({"stream_id": stream_id}, {"host_user_id": 1, "product_ids": 1})
    if not s:
        raise HTTPException(404, "Stream not found")
    if s["host_user_id"] != str(user["_id"]):
        raise HTTPException(403, "Not the host")
    if req.product_id not in (s.get("product_ids") or []):
        raise HTTPException(400, "Product not in stream product list")

    await db.live_streams.update_one(
        {"stream_id": stream_id},
        {"$set": {"featured_product_id": req.product_id, "featured_pinned_at": datetime.now(timezone.utc)}},
    )
    return {"ok": True, "featured_product_id": req.product_id}


@router.post("/{stream_id}/react")
@limiter.limit("60/minute")
async def react(stream_id: str, request: Request):
    await get_current_user(request)
    r = await db.live_streams.update_one(
        {"stream_id": stream_id, "status": "live"},
        {"$inc": {"total_reactions": 1}},
    )
    if r.modified_count == 0:
        raise HTTPException(404, "Stream not live")
    return {"ok": True}
