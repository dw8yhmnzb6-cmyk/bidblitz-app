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


class DeviceCommandCreate(BaseModel):
    command: str = Field(..., min_length=1, max_length=128)
    payload: Dict[str, Any] = Field(default_factory=dict)
    expires_in_seconds: int = Field(default=300, ge=5, le=86400)


class DeviceCommandAck(BaseModel):
    command_id: str = Field(..., min_length=8, max_length=128)
    status: Literal["accepted", "completed", "failed"]
    result: Dict[str, Any] = Field(default_factory=dict)


class DeviceGroupCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=120)
    description: Optional[str] = Field(default=None, max_length=500)
    device_ids: List[str] = Field(default_factory=list, max_length=5000)


class FirmwareReleaseCreate(BaseModel):
    device_type: DeviceType
    version: str = Field(..., min_length=1, max_length=64)
    download_url: str = Field(..., min_length=8, max_length=2048)
    sha256: str = Field(..., min_length=64, max_length=64)
    notes: Optional[str] = Field(default=None, max_length=1000)
    rollout_percent: int = Field(default=0, ge=0, le=100)


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


@router.post("/admin/devices/{device_id}/commands")
async def create_device_command(
    device_id: str,
    req: DeviceCommandCreate,
    request: Request,
):
    admin = await _require_admin(request)
    device = await db.the_eye_devices.find_one(
        {"device_id": device_id, "status": {"$ne": "disabled"}},
        {"_id": 0, "device_id": 1},
    )
    if not device:
        raise HTTPException(status_code=404, detail="Device not found or disabled")

    now = datetime.now(timezone.utc)
    expires_at = datetime.fromtimestamp(
        now.timestamp() + req.expires_in_seconds,
        tz=timezone.utc,
    ).isoformat()
    command_id = "CMD-" + secrets.token_hex(8).upper()
    doc = {
        "command_id": command_id,
        "device_id": device_id,
        "command": req.command,
        "payload": req.payload,
        "status": "queued",
        "created_at": now.isoformat(),
        "expires_at": expires_at,
        "created_by": str(admin.get("_id") or admin.get("id") or admin.get("email")),
        "acknowledged_at": None,
        "completed_at": None,
        "result": None,
    }
    await db.the_eye_device_commands.insert_one(doc)
    doc.pop("_id", None)
    return {"ok": True, "command": doc}


@router.get("/devices/{device_id}/commands")
async def poll_device_commands(
    device_id: str,
    x_device_token: Optional[str] = Header(default=None),
    limit: int = 25,
):
    await _require_device(device_id, x_device_token)
    limit = max(1, min(limit, 100))
    now = _now()

    rows = await db.the_eye_device_commands.find(
        {
            "device_id": device_id,
            "status": "queued",
            "expires_at": {"$gt": now},
        },
        {"_id": 0},
    ).sort("created_at", 1).to_list(limit)

    if rows:
        ids = [r["command_id"] for r in rows]
        await db.the_eye_device_commands.update_many(
            {"command_id": {"$in": ids}, "status": "queued"},
            {"$set": {"status": "delivered", "delivered_at": now}},
        )
        for row in rows:
            row["status"] = "delivered"
            row["delivered_at"] = now

    return {"ok": True, "count": len(rows), "commands": rows, "server_time": now}


@router.post("/devices/{device_id}/commands/ack")
async def acknowledge_device_command(
    device_id: str,
    req: DeviceCommandAck,
    x_device_token: Optional[str] = Header(default=None),
):
    await _require_device(device_id, x_device_token)
    now = _now()
    update = {
        "status": req.status,
        "acknowledged_at": now,
        "result": req.result,
    }
    if req.status in {"completed", "failed"}:
        update["completed_at"] = now

    result = await db.the_eye_device_commands.update_one(
        {
            "command_id": req.command_id,
            "device_id": device_id,
            "status": {"$in": ["queued", "delivered", "accepted"]},
        },
        {"$set": update},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Command not found or already final")
    return {"ok": True, "command_id": req.command_id, "status": req.status}


@router.post("/admin/groups")
async def create_device_group(req: DeviceGroupCreate, request: Request):
    admin = await _require_admin(request)
    now = _now()
    group_id = "GRP-" + secrets.token_hex(6).upper()
    unique_device_ids = list(dict.fromkeys(req.device_ids))

    if unique_device_ids:
        found = await db.the_eye_devices.count_documents(
            {"device_id": {"$in": unique_device_ids}}
        )
        if found != len(unique_device_ids):
            raise HTTPException(status_code=400, detail="One or more devices do not exist")

    doc = {
        "group_id": group_id,
        "name": req.name,
        "description": req.description,
        "device_ids": unique_device_ids,
        "created_at": now,
        "updated_at": now,
        "created_by": str(admin.get("_id") or admin.get("id") or admin.get("email")),
    }
    await db.the_eye_device_groups.insert_one(doc)

    if unique_device_ids:
        await db.the_eye_devices.update_many(
            {"device_id": {"$in": unique_device_ids}},
            {"$addToSet": {"group_ids": group_id}, "$set": {"updated_at": now}},
        )

    doc.pop("_id", None)
    return {"ok": True, "group": doc}


@router.get("/admin/groups")
async def list_device_groups(request: Request, limit: int = 250):
    await _require_admin(request)
    limit = max(1, min(limit, 1000))
    rows = await db.the_eye_device_groups.find({}, {"_id": 0}).sort(
        "created_at", -1
    ).to_list(limit)
    return {"ok": True, "count": len(rows), "groups": rows}


@router.post("/admin/firmware")
async def create_firmware_release(req: FirmwareReleaseCreate, request: Request):
    admin = await _require_admin(request)
    normalized_hash = req.sha256.lower()
    if any(ch not in "0123456789abcdef" for ch in normalized_hash):
        raise HTTPException(status_code=400, detail="sha256 must be hexadecimal")

    existing = await db.the_eye_firmware_releases.find_one(
        {"device_type": req.device_type, "version": req.version},
        {"_id": 0, "release_id": 1},
    )
    if existing:
        raise HTTPException(status_code=409, detail="Firmware version already exists")

    now = _now()
    release_id = "FW-" + secrets.token_hex(6).upper()
    doc = {
        "release_id": release_id,
        "device_type": req.device_type,
        "version": req.version,
        "download_url": req.download_url,
        "sha256": normalized_hash,
        "notes": req.notes,
        "rollout_percent": req.rollout_percent,
        "status": "draft" if req.rollout_percent == 0 else "active",
        "created_at": now,
        "updated_at": now,
        "created_by": str(admin.get("_id") or admin.get("id") or admin.get("email")),
    }
    await db.the_eye_firmware_releases.insert_one(doc)
    doc.pop("_id", None)
    return {"ok": True, "release": doc}


@router.get("/devices/{device_id}/firmware")
async def get_device_firmware(
    device_id: str,
    x_device_token: Optional[str] = Header(default=None),
):
    device = await _require_device(device_id, x_device_token)
    release = await db.the_eye_firmware_releases.find_one(
        {
            "device_type": device.get("device_type"),
            "status": "active",
            "rollout_percent": {"$gt": 0},
        },
        {"_id": 0, "created_by": 0},
        sort=[("created_at", -1)],
    )
    if not release:
        return {"ok": True, "update_available": False}

    bucket = int(hashlib.sha256(device_id.encode("utf-8")).hexdigest()[:8], 16) % 100
    eligible = bucket < int(release.get("rollout_percent", 0))
    current_version = device.get("firmware_version")
    update_available = eligible and current_version != release.get("version")

    return {
        "ok": True,
        "update_available": update_available,
        "release": release if update_available else None,
    }
