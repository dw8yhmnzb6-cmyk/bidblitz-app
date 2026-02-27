"""
Geofencing, Scooter Tracking & Availability Alerts
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
import uuid, math

from dependencies import get_current_user, get_admin_user
from config import db

router = APIRouter(prefix="/geofencing", tags=["Geofencing & Tracking"])


class GeoZone(BaseModel):
    name: str
    type: str  # parking, no_parking, speed_limit, service_area
    center_lat: float
    center_lng: float
    radius_meters: float
    speed_limit_kmh: Optional[int] = None
    description: Optional[str] = None

class LocationUpdate(BaseModel):
    lat: float
    lng: float
    speed_kmh: Optional[float] = None
    battery_percent: Optional[int] = None

class AvailabilityAlert(BaseModel):
    lat: float
    lng: float
    radius_meters: float = 500
    device_type: Optional[str] = None  # scooter, bike, any


def haversine(lat1, lng1, lat2, lng2):
    """Distance in meters between two GPS points"""
    R = 6371000
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lng2 - lng1)
    a = math.sin(dp/2)**2 + math.cos(p1) * math.cos(p2) * math.sin(dl/2)**2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))


# ==================== GEOFENCE ZONES ====================

@router.post("/zones")
async def create_zone(data: GeoZone, admin: dict = Depends(get_admin_user)):
    """Admin: Create a geofence zone"""
    zone = {
        "id": str(uuid.uuid4()),
        "name": data.name,
        "type": data.type,
        "center_lat": data.center_lat,
        "center_lng": data.center_lng,
        "radius_meters": data.radius_meters,
        "speed_limit_kmh": data.speed_limit_kmh,
        "description": data.description,
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.geofence_zones.insert_one(zone)
    zone.pop("_id", None)
    return {"success": True, "zone": zone}


@router.get("/zones")
async def get_zones():
    """Get all active geofence zones (public for map display)"""
    zones = await db.geofence_zones.find(
        {"is_active": True}, {"_id": 0}
    ).to_list(200)
    return {"zones": zones}


@router.delete("/zones/{zone_id}")
async def delete_zone(zone_id: str, admin: dict = Depends(get_admin_user)):
    """Admin: Delete a zone"""
    await db.geofence_zones.update_one({"id": zone_id}, {"$set": {"is_active": False}})
    return {"success": True}


@router.post("/check-location")
async def check_location(data: LocationUpdate, user: dict = Depends(get_current_user)):
    """Check if a location is within any geofence zone"""
    zones = await db.geofence_zones.find({"is_active": True}, {"_id": 0}).to_list(200)
    
    violations = []
    in_zones = []
    
    for zone in zones:
        dist = haversine(data.lat, data.lng, zone["center_lat"], zone["center_lng"])
        if dist <= zone["radius_meters"]:
            in_zones.append(zone)
            if zone["type"] == "no_parking":
                violations.append({"zone": zone["name"], "type": "no_parking", "message": "Parken hier nicht erlaubt"})
            if zone["type"] == "speed_limit" and data.speed_kmh and data.speed_kmh > (zone.get("speed_limit_kmh") or 20):
                violations.append({"zone": zone["name"], "type": "speed_limit", "message": f"Geschwindigkeit reduzieren auf {zone['speed_limit_kmh']} km/h"})
    
    return {
        "lat": data.lat, "lng": data.lng,
        "in_zones": [{"name": z["name"], "type": z["type"]} for z in in_zones],
        "violations": violations,
        "can_park": not any(z["type"] == "no_parking" for z in in_zones)
    }


# ==================== SCOOTER TRACKING ====================

@router.post("/track/{session_id}")
async def update_ride_location(session_id: str, data: LocationUpdate, user: dict = Depends(get_current_user)):
    """Update ride location during active session"""
    session = await db.unlock_sessions.find_one({"id": session_id, "user_id": user["id"]})
    if not session or session["status"] not in ["requested", "active"]:
        raise HTTPException(404, "Keine aktive Fahrt")
    
    point = {
        "lat": data.lat, "lng": data.lng,
        "speed_kmh": data.speed_kmh,
        "battery_percent": data.battery_percent,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    
    await db.ride_tracking.update_one(
        {"session_id": session_id},
        {"$push": {"points": point}, "$set": {"last_location": point}},
        upsert=True
    )
    
    # Check geofence
    zones = await db.geofence_zones.find({"is_active": True}, {"_id": 0}).to_list(200)
    warnings = []
    for zone in zones:
        dist = haversine(data.lat, data.lng, zone["center_lat"], zone["center_lng"])
        if dist <= zone["radius_meters"]:
            if zone["type"] == "speed_limit" and data.speed_kmh and data.speed_kmh > (zone.get("speed_limit_kmh") or 20):
                warnings.append(f"Geschwindigkeit reduzieren: {zone['name']}")
    
    return {"success": True, "warnings": warnings}


@router.get("/track/{session_id}")
async def get_ride_track(session_id: str, user: dict = Depends(get_current_user)):
    """Get tracking data for a ride"""
    track = await db.ride_tracking.find_one({"session_id": session_id}, {"_id": 0})
    return {"track": track}


# ==================== AVAILABILITY ALERTS ====================

@router.post("/alerts/subscribe")
async def subscribe_availability_alert(data: AvailabilityAlert, user: dict = Depends(get_current_user)):
    """Subscribe to be notified when a scooter becomes available nearby"""
    alert = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "user_name": user.get("name"),
        "lat": data.lat,
        "lng": data.lng,
        "radius_meters": data.radius_meters,
        "device_type": data.device_type or "any",
        "status": "active",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "notified_at": None
    }
    await db.availability_alerts.insert_one(alert)
    alert.pop("_id", None)
    return {
        "success": True,
        "alert": alert,
        "message": "Alarm gesetzt! Sie werden benachrichtigt wenn ein Scooter verfuegbar wird."
    }


@router.get("/alerts/my")
async def get_my_alerts(user: dict = Depends(get_current_user)):
    """Get user's active availability alerts"""
    alerts = await db.availability_alerts.find(
        {"user_id": user["id"], "status": "active"}, {"_id": 0}
    ).to_list(20)
    return {"alerts": alerts}


@router.delete("/alerts/{alert_id}")
async def cancel_alert(alert_id: str, user: dict = Depends(get_current_user)):
    """Cancel an availability alert"""
    await db.availability_alerts.update_one(
        {"id": alert_id, "user_id": user["id"]},
        {"$set": {"status": "cancelled"}}
    )
    return {"success": True}
