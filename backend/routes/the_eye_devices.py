"""
The Eye by BidBlitz - Device Hub V1

Safe foundation for registering BidBlitz/AION devices and receiving
authenticated heartbeat, telemetry and location updates.

No external provider calls and no production device actions are triggered here.
"""

from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timezone
from typing import Any, Dict, List, Literal, Optional

from fastapi import APIRouter, Header, HTTPException, Request
from pydantic import BaseModel, Field

from core.database import db
from core.security import get_current_user


router = APIRouter(prefix="/api/the-eye", tags=["The Eye Device Hub"])

DeviceType = Literal[
    "camera",
    "aion_core",
    "aion_tablet",
    "power_station",
    "charger",
    "scooter",
    "vehicle",
    "taxi",
    "drone",
    "gps_tracker",
    "sensor",
    "smart_home",
    "display",
    "other",
]


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


async def _require_admin(request: Request) -> dict:
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin required")
    return user


async def _require_device(device_id: str, x_device_token: Optional[str]) -> dict:
    if not x_device_token:
        raise HTTPException(status_code=401, detail="Missing device token")

    device = await db.the_eye_devices.find_one({"device_id": device_id})
    if not device or device.get("status") == "disabled":
        raise HTTPException(status_code=401, detail="Unknown or disabled device")

    expected_hash = device.get("token_hash")
    if not expected_hash or not secrets.compare_digest(
        expected_hash, _hash_token(x_device_token)
    ):
        raise HTTPException(status_code=401, detail="Invalid device token")
    return device


class DeviceRegisterRequest(BaseModel):
    device_type: DeviceType
    serial_number: str = Field(..., min_length=3, max_length=128)
    name: Optional[str] = Field(default=None, max_length=120)
    country: Optional[str] = Field(default=None, max_length=2)
    city: Optional[str] = Field(default=None, max_length=120)
    owner_id: Optional[str] = Field(default=None, max_length=128)
    group_ids: List[str] = Field(default_factory=list, max_length=50)
    capabilities: List[str] = Field(default_factory=list, max_length=100)
    firmware_version: Optional[str] = Field(default=None, max_length=64)
    metadata: Dict[str, Any] = Field(default_factory=dict)


class DeviceLocationRequest(BaseModel):
    lat: float = Field(..., ge=-90, le=90)
    lng: float = Field(..., ge=-180, le=180)
    accuracy_m: Optional[float] = Field(default=None, ge=0, le=100000)
    altitude_m: Optional[float] = Field(default=None, ge=-1000, le=100000)
    heading_deg: Optional[float] = Field(default=None, ge=0, lt=360)
    speed_kmh: Optional[float] = Field(default=None, ge=0, le=2000)
    recorded_at: Optional[str] = None


class DeviceHeartbeatRequest(BaseModel):
    status: Literal["online", "warning", "maintenance"] = "online"
    firmware_version: Optional[str] = Field(default=None, max_length=64)
    battery_percent: Optional[float] = Field(default=None, ge=0, le=100)
    uptime_seconds: Optional[int] = Field(default=None, ge=0)


class DeviceTelemetryRequest(BaseModel):
    metrics: Dict[str, Any] = Field(default_factory=dict)
    recorded_at: Optional[str] = None


class DeviceStatusRequest(BaseModel):
    status: Literal["active", "maintenance", "disabled"]


@router.get("/health")
async def the_eye_health():
    return {
        "ok": True,
        "service": "the-eye-device-hub",
        "version": "1",
        "time": _now(),
    }


@router.post("/admin/devices")
async def register_device(req: DeviceRegisterRequest, request: Request):
    admin = await _require_admin(request)

    existing = await db.the_eye_devices.find_one(
        {"serial_number": req.serial_number},
        {"_id": 0, "device_id": 1},
    )
    if existing:
        raise HTTPException(status_code=409, detail="Serial number already registered")

    device_id = "BB-" + secrets.token_hex(8).upper()
    device_token = secrets.token_urlsafe(32)
    now = _now()

    doc = {
        "device_id": device_id,
        "device_type": req.device_type,
        "serial_number": req.serial_number,
        "name": req.name or f"{req.device_type}-{req.serial_number}",
        "country": (req.country or "").upper() or None,
        "city": req.city,
        "owner_id": req.owner_id,
        "group_ids": req.group_ids,
        "capabilities": req.capabilities,
        "firmware_version": req.firmware_version,
        "metadata": req.metadata,
        "status": "active",
        "connection_status": "never_seen",
        "token_hash": _hash_token(device_token),
        "created_at": now,
        "updated_at": now,
        "last_seen_at": None,
        "created_by": str(admin.get("_id") or admin.get("id") or admin.get("email")),
    }
    await db.the_eye_devices.insert_one(doc)

    safe = {k: v for k, v in doc.items() if k not in {"_id", "token_hash"}}
    return {
        "ok": True,
        "device": safe,
        "device_token": device_token,
        "token_notice": "Shown once. Store it securely on the device.",
    }


@router.get("/admin/devices")
async def list_devices(
    request: Request,
    device_type: Optional[str] = None,
    connection_status: Optional[str] = None,
    limit: int = 250,
):
    await _require_admin(request)
    limit = max(1, min(limit, 1000))

    query: Dict[str, Any] = {}
    if device_type:
        query["device_type"] = device_type
    if connection_status:
        query["connection_status"] = connection_status

    rows = await db.the_eye_devices.find(
        query,
        {"_id": 0, "token_hash": 0},
    ).sort("updated_at", -1).to_list(limit)

    return {"ok": True, "count": len(rows), "devices": rows}


@router.patch("/admin/devices/{device_id}/status")
async def set_device_status(
    device_id: str,
    req: DeviceStatusRequest,
    request: Request,
):
    await _require_admin(request)
    result = await db.the_eye_devices.update_one(
        {"device_id": device_id},
        {"$set": {"status": req.status, "updated_at": _now()}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Device not found")
    return {"ok": True, "device_id": device_id, "status": req.status}


@router.post("/devices/{device_id}/heartbeat")
async def device_heartbeat(
    device_id: str,
    req: DeviceHeartbeatRequest,
    x_device_token: Optional[str] = Header(default=None),
):
    await _require_device(device_id, x_device_token)
    now = _now()

    update: Dict[str, Any] = {
        "connection_status": req.status,
        "last_seen_at": now,
        "updated_at": now,
    }
    if req.firmware_version is not None:
        update["firmware_version"] = req.firmware_version
    if req.battery_percent is not None:
        update["battery_percent"] = req.battery_percent
    if req.uptime_seconds is not None:
        update["uptime_seconds"] = req.uptime_seconds

    await db.the_eye_devices.update_one({"device_id": device_id}, {"$set": update})
    return {"ok": True, "device_id": device_id, "server_time": now}


@router.post("/devices/{device_id}/location")
async def device_location(
    device_id: str,
    req: DeviceLocationRequest,
    x_device_token: Optional[str] = Header(default=None),
):
    await _require_device(device_id, x_device_token)
    now = _now()
    recorded_at = req.recorded_at or now

    location = {
        "lat": req.lat,
        "lng": req.lng,
        "accuracy_m": req.accuracy_m,
        "altitude_m": req.altitude_m,
        "heading_deg": req.heading_deg,
        "speed_kmh": req.speed_kmh,
        "recorded_at": recorded_at,
    }

    await db.the_eye_devices.update_one(
        {"device_id": device_id},
        {"$set": {
            "location": location,
            "last_seen_at": now,
            "connection_status": "online",
            "updated_at": now,
        }},
    )
    await db.the_eye_device_locations.insert_one(
        {"device_id": device_id, **location, "received_at": now}
    )
    return {"ok": True, "device_id": device_id, "server_time": now}


@router.post("/devices/{device_id}/telemetry")
async def device_telemetry(
    device_id: str,
    req: DeviceTelemetryRequest,
    x_device_token: Optional[str] = Header(default=None),
):
    await _require_device(device_id, x_device_token)
    now = _now()

    await db.the_eye_device_telemetry.insert_one({
        "device_id": device_id,
        "metrics": req.metrics,
        "recorded_at": req.recorded_at or now,
        "received_at": now,
    })
    await db.the_eye_devices.update_one(
        {"device_id": device_id},
        {"$set": {
            "last_seen_at": now,
            "connection_status": "online",
            "updated_at": now,
            "last_telemetry": req.metrics,
        }},
    )
    return {"ok": True, "device_id": device_id, "server_time": now}


@router.get("/admin/map/devices")
async def map_devices(request: Request, limit: int = 2000):
    await _require_admin(request)
    limit = max(1, min(limit, 5000))

    rows = await db.the_eye_devices.find(
        {
            "status": {"$ne": "disabled"},
            "location.lat": {"$exists": True},
            "location.lng": {"$exists": True},
        },
        {
            "_id": 0,
            "token_hash": 0,
            "metadata": 0,
            "last_telemetry": 0,
        },
    ).to_list(limit)

    return {"ok": True, "count": len(rows), "devices": rows}
