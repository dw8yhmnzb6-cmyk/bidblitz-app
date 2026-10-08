"""The Eye camera registry, health and safe stream-session API."""

from __future__ import annotations

import os
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Literal, Optional

from fastapi import APIRouter, Header, HTTPException, Query, Request
from pydantic import BaseModel, Field

from core.database import db
from core.the_eye_access import TheEyeAccess, require_the_eye_access
from core.the_eye_data_safety import safe_the_eye_document, sanitize_the_eye_payload
from core.the_eye_live import broadcast_the_eye_event


router = APIRouter(prefix="/api/the-eye", tags=["The Eye Cameras"])

CameraMode = Literal["live_only", "record_events", "continuous_recording"]
CameraStatus = Literal["online", "warning", "offline", "maintenance"]


def _now_dt() -> datetime:
    return datetime.now(timezone.utc)


def _now() -> str:
    return _now_dt().isoformat()


async def _require_admin(request: Request) -> dict:
    access = await require_the_eye_access(request, {"super_admin", "admin"})
    return dict(access.user)


async def _require_reader(request: Request) -> TheEyeAccess:
    return await require_the_eye_access(
        request,
        {
            "super_admin", "admin", "project_admin", "site_manager",
            "technician", "customer", "partner",
        },
    )


async def _require_operator(request: Request) -> TheEyeAccess:
    return await require_the_eye_access(
        request,
        {"super_admin", "admin", "project_admin", "site_manager"},
    )


class CameraCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=160)
    device_id: Optional[str] = Field(default=None, max_length=128)
    location_id: Optional[str] = Field(default=None, max_length=128)
    project_id: Optional[str] = Field(default=None, max_length=128)
    tenant_id: Optional[str] = Field(default=None, max_length=128)
    customer_id: Optional[str] = Field(default=None, max_length=128)
    site_id: Optional[str] = Field(default=None, max_length=128)
    camera_type: Literal["bullet", "dome", "ptz", "panoramic", "low_light", "thermal", "other"] = "other"
    mode: CameraMode = "live_only"
    stream_path: Optional[str] = Field(default=None, max_length=512)
    onvif_enabled: bool = False
    ptz_enabled: bool = False
    privacy_masks: List[Dict[str, Any]] = Field(default_factory=list, max_length=50)
    metadata: Dict[str, Any] = Field(default_factory=dict)


class CameraUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=2, max_length=160)
    location_id: Optional[str] = Field(default=None, max_length=128)
    site_id: Optional[str] = Field(default=None, max_length=128)
    mode: Optional[CameraMode] = None
    stream_path: Optional[str] = Field(default=None, max_length=512)
    onvif_enabled: Optional[bool] = None
    ptz_enabled: Optional[bool] = None
    privacy_masks: Optional[List[Dict[str, Any]]] = None
    metadata: Optional[Dict[str, Any]] = None
    status: Optional[Literal["active", "maintenance", "disabled"]] = None


class CameraHealthRequest(BaseModel):
    status: CameraStatus = "online"
    fps: Optional[float] = Field(default=None, ge=0, le=240)
    resolution: Optional[str] = Field(default=None, max_length=64)
    packet_loss_percent: Optional[float] = Field(default=None, ge=0, le=100)
    latency_ms: Optional[float] = Field(default=None, ge=0, le=600000)
    temperature_c: Optional[float] = Field(default=None, ge=-100, le=250)
    bitrate_kbps: Optional[float] = Field(default=None, ge=0)
    storage_free_gb: Optional[float] = Field(default=None, ge=0)
    details: Dict[str, Any] = Field(default_factory=dict)


class CameraEventRequest(BaseModel):
    event_type: Literal[
        "motion",
        "tamper",
        "stream_lost",
        "stream_restored",
        "temperature",
        "recording",
        "privacy_mask",
        "other",
    ]
    severity: Literal["info", "low", "medium", "high", "critical"] = "info"
    payload: Dict[str, Any] = Field(default_factory=dict)
    recorded_at: Optional[str] = None


async def _validate_location(location_id: Optional[str]) -> Optional[dict]:
    if not location_id:
        return None
    location = await db.the_eye_locations.find_one(
        {"location_id": location_id, "status": {"$ne": "deleted"}},
        {"_id": 0},
    )
    if not location:
        raise HTTPException(status_code=400, detail="Location not found")
    return location


async def _validate_device(device_id: Optional[str]) -> Optional[dict]:
    if not device_id:
        return None
    device = await db.the_eye_devices.find_one(
        {"device_id": device_id, "status": {"$ne": "disabled"}},
        {"_id": 0, "token_hash": 0},
    )
    if not device:
        raise HTTPException(status_code=400, detail="Device not found or disabled")
    if device.get("device_type") != "camera":
        raise HTTPException(status_code=400, detail="Linked device must be a camera")
    return device


def _safe_camera(row: dict) -> dict:
    hidden = {"_id", "rtsp_url", "username", "password", "credentials", "metadata"}
    return safe_the_eye_document(row, drop_keys=tuple(hidden))


@router.post("/admin/cameras")
async def create_camera(req: CameraCreate, request: Request):
    admin = await _require_admin(request)
    device = await _validate_device(req.device_id)
    location = await _validate_location(req.location_id)

    if req.device_id:
        exists = await db.the_eye_cameras.find_one(
            {"device_id": req.device_id, "status": {"$ne": "disabled"}},
            {"_id": 0, "camera_id": 1},
        )
        if exists:
            raise HTTPException(status_code=409, detail="Camera device already linked")

    camera_id = "CAM-" + secrets.token_hex(8).upper()
    now = _now()
    doc = {
        "camera_id": camera_id,
        "name": req.name,
        "device_id": req.device_id,
        "location_id": req.location_id,
        "project_id": req.project_id or (device or {}).get("project_id"),
        "tenant_id": req.tenant_id or (device or {}).get("tenant_id"),
        "customer_id": req.customer_id or (device or {}).get("customer_id"),
        "site_id": req.site_id or (location or {}).get("code") or (device or {}).get("site_id"),
        "camera_type": req.camera_type,
        "mode": req.mode,
        "stream_path": req.stream_path,
        "onvif_enabled": req.onvif_enabled,
        "ptz_enabled": req.ptz_enabled,
        "privacy_masks": sanitize_the_eye_payload(req.privacy_masks),
        "metadata": sanitize_the_eye_payload(req.metadata),
        "status": "active",
        "connection_status": (device or {}).get("connection_status") or "never_seen",
        "last_health": None,
        "last_seen_at": (device or {}).get("last_seen_at"),
        "created_at": now,
        "updated_at": now,
        "created_by": str(admin.get("_id") or admin.get("id") or admin.get("email")),
    }
    await db.the_eye_cameras.insert_one(doc)
    safe = _safe_camera(doc)
    await broadcast_the_eye_event("camera.created", safe)
    return {"ok": True, "camera": safe}


@router.get("/admin/cameras")
async def list_cameras(
    request: Request,
    location_id: Optional[str] = None,
    site_id: Optional[str] = None,
    connection_status: Optional[str] = None,
    limit: int = Query(default=250, ge=1, le=2000),
):
    access = await _require_reader(request)
    query: Dict[str, Any] = {"status": {"$ne": "disabled"}}
    if location_id:
        query["location_id"] = location_id
    if site_id:
        query["site_id"] = site_id
    if connection_status:
        query["connection_status"] = connection_status
    query = access.scope_query(query)

    rows = await db.the_eye_cameras.find(query).sort("updated_at", -1).to_list(limit)
    return {"ok": True, "count": len(rows), "cameras": [_safe_camera(row) for row in rows]}


@router.get("/admin/cameras/{camera_id}")
async def get_camera(camera_id: str, request: Request):
    access = await _require_reader(request)
    query = access.scope_query(
        {"camera_id": camera_id, "status": {"$ne": "disabled"}}
    )
    row = await db.the_eye_cameras.find_one(query)
    if not row:
        raise HTTPException(status_code=404, detail="Camera not found")
    return {"ok": True, "camera": _safe_camera(row)}


@router.patch("/admin/cameras/{camera_id}")
async def update_camera(camera_id: str, req: CameraUpdate, request: Request):
    await _require_admin(request)
    current = await db.the_eye_cameras.find_one(
        {"camera_id": camera_id, "status": {"$ne": "disabled"}},
        {"_id": 0},
    )
    if not current:
        raise HTTPException(status_code=404, detail="Camera not found")

    update = req.model_dump(exclude_unset=True)
    if "location_id" in update:
        await _validate_location(update.get("location_id"))
    update["updated_at"] = _now()

    await db.the_eye_cameras.update_one({"camera_id": camera_id}, {"$set": update})
    fresh = await db.the_eye_cameras.find_one({"camera_id": camera_id})
    safe = _safe_camera(fresh)
    await broadcast_the_eye_event("camera.updated", safe)
    return {"ok": True, "camera": safe}


@router.post("/admin/cameras/{camera_id}/health")
async def update_camera_health(camera_id: str, req: CameraHealthRequest, request: Request):
    access = await _require_operator(request)
    camera_query = access.scope_query(
        {"camera_id": camera_id, "status": {"$ne": "disabled"}}
    )
    camera = await db.the_eye_cameras.find_one(
        camera_query,
        {"_id": 0},
    )
    if not camera:
        raise HTTPException(status_code=404, detail="Camera not found")

    now = _now()
    health = {
        "status": req.status,
        "fps": req.fps,
        "resolution": req.resolution,
        "packet_loss_percent": req.packet_loss_percent,
        "latency_ms": req.latency_ms,
        "temperature_c": req.temperature_c,
        "bitrate_kbps": req.bitrate_kbps,
        "storage_free_gb": req.storage_free_gb,
        "details": sanitize_the_eye_payload(req.details),
        "recorded_at": now,
    }
    await db.the_eye_cameras.update_one(
        camera_query,
        {"$set": {
            "connection_status": req.status,
            "last_health": health,
            "last_seen_at": now,
            "updated_at": now,
        }},
    )
    scope = {
        "project_id": camera.get("project_id"),
        "tenant_id": camera.get("tenant_id"),
        "customer_id": camera.get("customer_id"),
        "site_id": camera.get("site_id"),
    }
    await db.the_eye_camera_health.insert_one(
        {"camera_id": camera_id, **scope, **health}
    )
    await broadcast_the_eye_event(
        "camera.health",
        {
            "camera_id": camera_id,
            **scope,
            "connection_status": req.status,
            "last_health": health,
            "last_seen_at": now,
        },
    )
    return {"ok": True, "camera_id": camera_id, "health": health}


@router.post("/admin/cameras/{camera_id}/events")
async def create_camera_event(camera_id: str, req: CameraEventRequest, request: Request):
    access = await _require_operator(request)
    camera_query = access.scope_query(
        {"camera_id": camera_id, "status": {"$ne": "disabled"}}
    )
    camera = await db.the_eye_cameras.find_one(camera_query, {"_id": 0})
    if not camera:
        raise HTTPException(status_code=404, detail="Camera not found")

    doc = {
        "event_id": "CEV-" + secrets.token_hex(8).upper(),
        "camera_id": camera_id,
        "project_id": camera.get("project_id"),
        "tenant_id": camera.get("tenant_id"),
        "customer_id": camera.get("customer_id"),
        "site_id": camera.get("site_id"),
        "event_type": req.event_type,
        "severity": req.severity,
        "payload": sanitize_the_eye_payload(req.payload),
        "recorded_at": req.recorded_at or _now(),
        "received_at": _now(),
        "created_by": access.actor_id,
    }
    await db.the_eye_camera_events.insert_one(doc)
    doc.pop("_id", None)
    await broadcast_the_eye_event("camera.event", doc)
    return {"ok": True, "event": doc}


@router.get("/admin/cameras/{camera_id}/events")
async def list_camera_events(
    camera_id: str,
    request: Request,
    limit: int = Query(default=100, ge=1, le=1000),
):
    access = await _require_reader(request)
    camera_query = access.scope_query(
        {"camera_id": camera_id, "status": {"$ne": "disabled"}}
    )
    if not await db.the_eye_cameras.find_one(camera_query, {"_id": 1}):
        raise HTTPException(status_code=404, detail="Camera not found")
    rows = await db.the_eye_camera_events.find(
        {"camera_id": camera_id},
        {"_id": 0},
    ).sort("recorded_at", -1).to_list(limit)
    return {"ok": True, "count": len(rows), "events": rows}


@router.post("/admin/cameras/{camera_id}/stream-session")
async def create_camera_stream_session(camera_id: str, request: Request):
    access = await _require_reader(request)
    camera_query = access.scope_query(
        {"camera_id": camera_id, "status": {"$ne": "disabled"}}
    )
    camera = await db.the_eye_cameras.find_one(camera_query, {"_id": 0})
    if not camera:
        raise HTTPException(status_code=404, detail="Camera not found")
    if camera.get("connection_status") not in {"online", "warning"}:
        raise HTTPException(status_code=409, detail="Camera has no active connection")

    gateway = (os.getenv("THE_EYE_MEDIA_PUBLIC_URL") or "").rstrip("/")
    stream_path = (camera.get("stream_path") or "").strip("/")
    expires = _now_dt() + timedelta(minutes=5)
    session_id = "CSES-" + secrets.token_hex(12).upper()
    session_token = secrets.token_urlsafe(24)

    doc = {
        "session_id": session_id,
        "camera_id": camera_id,
        "project_id": camera.get("project_id"),
        "tenant_id": camera.get("tenant_id"),
        "customer_id": camera.get("customer_id"),
        "site_id": camera.get("site_id"),
        "user_id": access.actor_id,
        "token_hash": __import__("hashlib").sha256(session_token.encode("utf-8")).hexdigest(),
        "created_at": _now(),
        "expires_at": expires.isoformat(),
        "status": "active",
    }
    await db.the_eye_camera_sessions.insert_one(doc)

    playback_url = None
    protocol = None
    if gateway and stream_path:
        playback_url = f"{gateway}/{stream_path}/index.m3u8"
        protocol = "hls"

    await broadcast_the_eye_event(
        "camera.stream_session",
        {
            "camera_id": camera_id,
            "project_id": camera.get("project_id"),
            "tenant_id": camera.get("tenant_id"),
            "customer_id": camera.get("customer_id"),
            "site_id": camera.get("site_id"),
            "session_id": session_id,
            "expires_at": expires.isoformat(),
        },
    )

    return {
        "ok": True,
        "session_id": session_id,
        "camera_id": camera_id,
        "expires_at": expires.isoformat(),
        "playback_url": playback_url,
        "protocol": protocol,
        "configured": bool(playback_url),
        "notice": None if playback_url else "Media gateway is not configured yet; camera credentials are never exposed to the browser.",
    }
