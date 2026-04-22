"""
BidBlitz V2 - Kids GPS & Safety Zones System
Real-time tracking, location history, safe zones, and danger zones
"""

from datetime import datetime, timezone, timedelta
from typing import Optional, List
import secrets
import math
import random
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from bson import ObjectId

from core.database import db
from core.security import get_current_user

router = APIRouter(prefix="/api/kids/gps", tags=["kids-gps"])


# ═══════════════════════════════════════════════════════════════════════════════
# MODELS
# ═══════════════════════════════════════════════════════════════════════════════

class LocationUpdate(BaseModel):
    child_id: str
    lat: float = Field(..., ge=-90, le=90)
    lng: float = Field(..., ge=-180, le=180)
    accuracy: Optional[float] = None
    battery_level: Optional[int] = Field(None, ge=0, le=100)
    speed: Optional[float] = None  # km/h


class ZoneCreate(BaseModel):
    child_id: str
    name: str = Field(..., min_length=1, max_length=100)
    zone_type: str = Field(..., pattern="^(safe|danger)$")  # safe = green, danger = red
    lat: float = Field(..., ge=-90, le=90)
    lng: float = Field(..., ge=-180, le=180)
    radius: int = Field(..., ge=10, le=5000)  # 10m - 5km
    notify_enter: bool = True
    notify_exit: bool = True
    active: bool = True


class ZoneUpdate(BaseModel):
    name: Optional[str] = None
    radius: Optional[int] = None
    notify_enter: Optional[bool] = None
    notify_exit: Optional[bool] = None
    active: Optional[bool] = None


# ═══════════════════════════════════════════════════════════════════════════════
# HELPER FUNCTIONS
# ═══════════════════════════════════════════════════════════════════════════════

def haversine_distance(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Calculate distance between two coordinates in meters."""
    R = 6371000  # Earth radius in meters
    
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lng2 - lng1)
    
    a = math.sin(delta_phi/2)**2 + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda/2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    
    return R * c


async def check_zones_for_child(parent_id: str, child_id: str, child_name: str, lat: float, lng: float):
    """Check if child entered or exited any zones and create notifications."""
    from routes.kids import create_parent_notification
    
    zones = await db.kids_zones.find({
        "parent_id": parent_id,
        "child_id": child_id,
        "active": True
    }).to_list(100)
    
    for zone in zones:
        distance = haversine_distance(lat, lng, zone["lat"], zone["lng"])
        is_inside = distance <= zone["radius"]
        was_inside = zone.get("child_is_inside", False)
        
        zone_type = zone.get("zone_type", "safe")
        zone_name = zone.get("name", "Zone")
        
        # Child entered zone
        if is_inside and not was_inside:
            await db.kids_zones.update_one(
                {"zone_id": zone["zone_id"]},
                {"$set": {"child_is_inside": True, "last_entered": datetime.now(timezone.utc).isoformat()}}
            )
            
            if zone.get("notify_enter", True):
                if zone_type == "safe":
                    # Safe zone - good news
                    await create_parent_notification(
                        parent_id, child_id, child_name,
                        "zone_enter_safe",
                        f"✅ {child_name} ist angekommen",
                        f"{child_name} hat die sichere Zone '{zone_name}' betreten.",
                        severity="info"
                    )
                else:
                    # Danger zone - alert!
                    await create_parent_notification(
                        parent_id, child_id, child_name,
                        "zone_enter_danger",
                        f"⚠️ ACHTUNG: {child_name} in Gefahrenzone!",
                        f"{child_name} hat die Gefahrenzone '{zone_name}' betreten!",
                        severity="alert"
                    )
        
        # Child exited zone
        elif not is_inside and was_inside:
            await db.kids_zones.update_one(
                {"zone_id": zone["zone_id"]},
                {"$set": {"child_is_inside": False, "last_exited": datetime.now(timezone.utc).isoformat()}}
            )
            
            if zone.get("notify_exit", True):
                if zone_type == "safe":
                    # Left safe zone - warning
                    await create_parent_notification(
                        parent_id, child_id, child_name,
                        "zone_exit_safe",
                        f"📍 {child_name} hat Zone verlassen",
                        f"{child_name} hat die sichere Zone '{zone_name}' verlassen.",
                        severity="warning"
                    )
                else:
                    # Left danger zone - good
                    await create_parent_notification(
                        parent_id, child_id, child_name,
                        "zone_exit_danger",
                        f"✅ {child_name} hat Gefahrenzone verlassen",
                        f"{child_name} hat die Gefahrenzone '{zone_name}' verlassen.",
                        severity="info"
                    )


async def verify_parent_child_access(parent_id: str, child_id: str):
    """Verify parent has access to this child."""
    child = await db.kids_children.find_one({
        "child_id": child_id,
        "parent_id": parent_id
    })
    if not child:
        raise HTTPException(status_code=403, detail="Kein Zugriff auf dieses Kind")
    return child


# ═══════════════════════════════════════════════════════════════════════════════
# LOCATION ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/location")
async def update_child_location(loc: LocationUpdate, request: Request):
    """Update child's current location (called by child's device)."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    # Get child record
    child = await db.kids_children.find_one({"child_id": loc.child_id})
    if not child:
        raise HTTPException(status_code=404, detail="Kind nicht gefunden")
    
    parent_id = child["parent_id"]
    now = datetime.now(timezone.utc)
    
    # Update current location
    await db.kids_children.update_one(
        {"child_id": loc.child_id},
        {"$set": {
            "current_lat": loc.lat,
            "current_lng": loc.lng,
            "location_accuracy": loc.accuracy,
            "battery_level": loc.battery_level,
            "speed": loc.speed,
            "last_location_update": now.isoformat(),
        }}
    )
    
    # Store in location history
    history_entry = {
        "history_id": secrets.token_hex(8),
        "parent_id": parent_id,
        "child_id": loc.child_id,
        "lat": loc.lat,
        "lng": loc.lng,
        "accuracy": loc.accuracy,
        "battery_level": loc.battery_level,
        "speed": loc.speed,
        "timestamp": now.isoformat(),
    }
    await db.kids_location_history.insert_one(history_entry)
    
    # Check zones
    await check_zones_for_child(parent_id, loc.child_id, child.get("name", "Kind"), loc.lat, loc.lng)
    
    # Broadcast to WebSocket clients (if any connected)
    try:
        from routes.kids_gps_websocket import notify_location_update
        await notify_location_update(parent_id, loc.child_id, {
            "name": child.get("name"),
            "lat": loc.lat,
            "lng": loc.lng,
            "battery_level": loc.battery_level,
            "speed": loc.speed,
            "last_update": now.isoformat(),
        })
    except:
        pass  # WebSocket notification is optional
    
    return {"ok": True, "timestamp": now.isoformat()}


@router.get("/location/{child_id}")
async def get_child_location(child_id: str, request: Request):
    """Get child's current location with precise address via reverse geocoding."""
    user = await get_current_user(request)
    parent_id = str(user["_id"])
    
    child = await verify_parent_child_access(parent_id, child_id)
    
    lat = child.get("current_lat")
    lng = child.get("current_lng")
    address = child.get("address", "")
    
    # Try reverse geocoding for precise street address
    if lat and lng and not _has_street_number(address):
        try:
            precise = await _reverse_geocode(lat, lng)
            if precise:
                address = precise
                # Cache in DB
                await db.kids_children.update_one(
                    {"child_id": child_id},
                    {"$set": {"address": precise}}
                )
        except:
            pass
    
    return {
        "child_id": child_id,
        "name": child.get("name"),
        "lat": lat,
        "lng": lng,
        "accuracy": child.get("location_accuracy"),
        "battery_level": child.get("battery_level"),
        "speed": child.get("speed"),
        "last_update": child.get("last_location_update"),
        "is_online": _is_recently_updated(child.get("last_location_update")),
        "address": address,
    }


def _has_street_number(addr: str) -> bool:
    """Check if address already contains a street number."""
    if not addr:
        return False
    import re
    return bool(re.search(r'\d', addr))


async def _reverse_geocode(lat: float, lng: float) -> Optional[str]:
    """Get precise street address from Mapbox reverse geocoding."""
    import os
    token = os.environ.get("MAPBOX_TOKEN", "")
    if not token:
        # Try frontend token from env
        try:
            with open("/app/frontend/.env") as f:
                for line in f:
                    if line.startswith("REACT_APP_MAPBOX_TOKEN="):
                        token = line.strip().split("=", 1)[1]
                        break
        except:
            pass
    if not token:
        return None
    
    import httpx
    url = f"https://api.mapbox.com/geocoding/v5/mapbox.places/{lng},{lat}.json?access_token={token}&language=de&types=address&limit=1"
    async with httpx.AsyncClient(timeout=5) as client:
        resp = await client.get(url)
        if resp.status_code == 200:
            data = resp.json()
            features = data.get("features", [])
            if features:
                return features[0].get("place_name", "")
    return None


@router.get("/location/{child_id}/history")
async def get_location_history(
    child_id: str,
    request: Request,
    days: int = 1,
    limit: int = 1000
):
    """Get child's location history for the past N days."""
    user = await get_current_user(request)
    parent_id = str(user["_id"])
    
    await verify_parent_child_access(parent_id, child_id)
    
    # Max 30 days history
    days = min(days, 30)
    since = datetime.now(timezone.utc) - timedelta(days=days)
    
    history = await db.kids_location_history.find({
        "parent_id": parent_id,
        "child_id": child_id,
        "timestamp": {"$gte": since.isoformat()}
    }, {"_id": 0}).sort("timestamp", -1).limit(limit).to_list(limit)
    
    return {
        "child_id": child_id,
        "days": days,
        "count": len(history),
        "locations": history
    }


def _is_recently_updated(last_update: Optional[str], threshold_minutes: int = 15) -> bool:
    """Check if location was updated recently."""
    if not last_update:
        return False
    try:
        last = datetime.fromisoformat(last_update.replace("Z", "+00:00"))
        return (datetime.now(timezone.utc) - last).total_seconds() < threshold_minutes * 60
    except:
        return False


# ═══════════════════════════════════════════════════════════════════════════════
# ZONES ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/zones/{child_id}")
async def get_child_zones(child_id: str, request: Request):
    """Get all zones for a child."""
    user = await get_current_user(request)
    parent_id = str(user["_id"])
    
    await verify_parent_child_access(parent_id, child_id)
    
    zones = await db.kids_zones.find({
        "parent_id": parent_id,
        "child_id": child_id
    }, {"_id": 0}).to_list(100)
    
    return {"child_id": child_id, "zones": zones}


@router.post("/zones")
async def create_zone(zone: ZoneCreate, request: Request):
    """Create a new safety zone."""
    user = await get_current_user(request)
    parent_id = str(user["_id"])
    
    child = await verify_parent_child_access(parent_id, zone.child_id)
    
    zone_id = secrets.token_hex(8)
    now = datetime.now(timezone.utc)
    
    zone_data = {
        "zone_id": zone_id,
        "parent_id": parent_id,
        "child_id": zone.child_id,
        "name": zone.name,
        "zone_type": zone.zone_type,
        "lat": zone.lat,
        "lng": zone.lng,
        "radius": zone.radius,
        "notify_enter": zone.notify_enter,
        "notify_exit": zone.notify_exit,
        "active": zone.active,
        "child_is_inside": False,
        "created_at": now.isoformat(),
    }
    
    await db.kids_zones.insert_one(zone_data)
    zone_data.pop("_id", None)
    
    return {
        "ok": True,
        "message": f"Zone '{zone.name}' erstellt",
        "zone": zone_data
    }


@router.put("/zones/{zone_id}")
async def update_zone(zone_id: str, update: ZoneUpdate, request: Request):
    """Update a zone."""
    user = await get_current_user(request)
    parent_id = str(user["_id"])
    
    zone = await db.kids_zones.find_one({
        "zone_id": zone_id,
        "parent_id": parent_id
    })
    
    if not zone:
        raise HTTPException(status_code=404, detail="Zone nicht gefunden")
    
    update_data = {k: v for k, v in update.dict().items() if v is not None}
    if update_data:
        await db.kids_zones.update_one(
            {"zone_id": zone_id},
            {"$set": update_data}
        )
    
    return {"ok": True, "message": "Zone aktualisiert"}


@router.delete("/zones/{zone_id}")
async def delete_zone(zone_id: str, request: Request):
    """Delete a zone."""
    user = await get_current_user(request)
    parent_id = str(user["_id"])
    
    result = await db.kids_zones.delete_one({
        "zone_id": zone_id,
        "parent_id": parent_id
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Zone nicht gefunden")
    
    return {"ok": True, "message": "Zone gelöscht"}


# ═══════════════════════════════════════════════════════════════════════════════
# ALL CHILDREN LOCATIONS (for parent overview)
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/all-locations")
async def get_all_children_locations(request: Request):
    """Get current locations of all children."""
    user = await get_current_user(request)
    parent_id = str(user["_id"])
    
    children = await db.kids_children.find(
        {"parent_id": parent_id},
        {"_id": 0, "child_id": 1, "name": 1, "emoji": 1, "current_lat": 1, "current_lng": 1,
         "battery_level": 1, "speed": 1, "last_location_update": 1, "is_frozen": 1}
    ).to_list(20)
    
    # Add online status
    for child in children:
        child["is_online"] = _is_recently_updated(child.get("last_location_update"))
    
    return {"children": children}


# ═══════════════════════════════════════════════════════════════════════════════
# SIMULATE LOCATION (for testing)
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/simulate/{child_id}")
async def simulate_location(child_id: str, request: Request, lat: float = 52.52, lng: float = 13.405):
    """Simulate a child's location (for testing). Reverse geocodes address."""
    user = await get_current_user(request)
    parent_id = str(user["_id"])
    
    child = await verify_parent_child_access(parent_id, child_id)
    
    # Reverse geocode for address
    import os, httpx
    address = ""
    mapbox_token = os.environ.get("MAPBOX_TOKEN", os.environ.get("REACT_APP_MAPBOX_TOKEN", ""))
    if not mapbox_token:
        # Try reading from frontend .env
        try:
            with open("/app/frontend/.env") as f:
                for line in f:
                    if "REACT_APP_MAPBOX_TOKEN" in line:
                        mapbox_token = line.split("=", 1)[1].strip()
                        break
        except: pass
    
    if mapbox_token:
        try:
            async with httpx.AsyncClient() as client:
                r = await client.get(f"https://api.mapbox.com/geocoding/v5/mapbox.places/{lng},{lat}.json?access_token={mapbox_token}&language=de&limit=1", timeout=5)
                if r.status_code == 200:
                    data = r.json()
                    features = data.get("features", [])
                    if features:
                        address = features[0].get("place_name", "")
        except:
            pass
    
    now = datetime.now(timezone.utc)
    
    await db.kids_children.update_one(
        {"child_id": child_id},
        {"$set": {
            "current_lat": lat,
            "current_lng": lng,
            "location_accuracy": 10.0,
            "battery_level": random.randint(40, 95),
            "speed": round(random.uniform(0, 5), 1),
            "last_location_update": now.isoformat(),
            "address": address,
            "is_online": True,
        }}
    )
    
    # Save to history
    await db.kids_location_history.insert_one({
        "child_id": child_id,
        "lat": lat, "lng": lng,
        "accuracy": 10.0,
        "speed": round(random.uniform(0, 5), 1),
        "address": address,
        "timestamp": now.isoformat(),
    })
    
    await check_zones_for_child(parent_id, child_id, child.get("name", "Kind"), lat, lng)
    
    return {
        "ok": True,
        "message": f"Standort aktualisiert für {child.get('name')}",
        "lat": lat,
        "lng": lng,
        "address": address,
    }
