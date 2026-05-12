"""
BidBlitz Staff - GPS Locations & Geofencing
============================================
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, timezone
from uuid import uuid4
import os, math
from motor.motor_asyncio import AsyncIOMotorClient

router = APIRouter(prefix="/api/staff/locations", tags=["staff-locations"])
client = AsyncIOMotorClient(os.getenv("MONGO_URL"))
db = client[os.getenv("DB_NAME", "bidblitz")]


class LocationCreate(BaseModel):
    name: str
    address: Optional[str] = None
    lat: float
    lng: float
    radius_m: int = Field(default=100, ge=10, le=5000)


class LocationUpdate(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    radius_m: Optional[int] = None
    active: Optional[bool] = None


async def _merchant_id(request: Request) -> str:
    from routes.auth import get_current_user as auth_user
    user = await auth_user(request)
    if user.get("role") not in ("merchant", "admin"):
        raise HTTPException(403, "Nur für Händler oder Administratoren")
    return str(user.get("user_id") or user.get("id"))


def _haversine_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    R = 6371000.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * R * math.asin(math.sqrt(a))


async def validate_geofence(merchant_id: str, staff_id: str, lat: Optional[float], lng: Optional[float]):
    """Used by clock event to detect out-of-range check-ins. Returns warning dict or None."""
    if lat is None or lng is None:
        return None
    locs = await db.staff_locations.find(
        {"merchant_id": merchant_id, "active": True}, {"_id": 0}
    ).to_list(length=20)
    if not locs:
        return None
    closest = None
    closest_dist = None
    for loc in locs:
        d = _haversine_m(lat, lng, float(loc["lat"]), float(loc["lng"]))
        if closest_dist is None or d < closest_dist:
            closest_dist = d
            closest = loc
    if closest and closest_dist > closest["radius_m"]:
        warn = {
            "merchant_id": merchant_id,
            "staff_id": staff_id,
            "type": "gps_out_of_range",
            "severity": "warning",
            "location_id": closest["id"],
            "location_name": closest["name"],
            "distance_m": int(closest_dist),
            "radius_m": closest["radius_m"],
            "lat": lat,
            "lng": lng,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "id": str(uuid4()),
        }
        try:
            await db.staff_warnings.insert_one(warn.copy())
        except Exception:
            pass
        return warn
    return None


@router.get("/list")
async def list_locations(request: Request):
    mid = await _merchant_id(request)
    locs = await db.staff_locations.find({"merchant_id": mid}, {"_id": 0}).to_list(length=100)
    return {"success": True, "locations": locs, "count": len(locs)}


@router.post("/create")
async def create_location(req: LocationCreate, request: Request):
    mid = await _merchant_id(request)
    doc = {
        "id": str(uuid4()),
        "merchant_id": mid,
        "name": req.name,
        "address": req.address,
        "lat": req.lat,
        "lng": req.lng,
        "radius_m": req.radius_m,
        "active": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.staff_locations.insert_one(doc)
    doc.pop("_id", None)
    return {"success": True, "location": doc}


@router.patch("/{loc_id}")
async def update_location(loc_id: str, req: LocationUpdate, request: Request):
    mid = await _merchant_id(request)
    update = {k: v for k, v in req.dict().items() if v is not None}
    if not update:
        raise HTTPException(400, "Keine Änderungen")
    update["updated_at"] = datetime.now(timezone.utc).isoformat()
    res = await db.staff_locations.update_one(
        {"id": loc_id, "merchant_id": mid}, {"$set": update}
    )
    if res.matched_count == 0:
        raise HTTPException(404, "Standort nicht gefunden")
    loc = await db.staff_locations.find_one({"id": loc_id}, {"_id": 0})
    return {"success": True, "location": loc}


@router.delete("/{loc_id}")
async def delete_location(loc_id: str, request: Request):
    mid = await _merchant_id(request)
    res = await db.staff_locations.delete_one({"id": loc_id, "merchant_id": mid})
    if res.deleted_count == 0:
        raise HTTPException(404, "Standort nicht gefunden")
    return {"success": True}
