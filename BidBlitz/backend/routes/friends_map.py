"""
BidBlitz V2 - Friends in Your Area Map
Opt-in location sharing to see friends nearby on a map.
Privacy-first: Users must explicitly enable location sharing.
"""
import secrets
from datetime import datetime, timezone, timedelta
from typing import Optional, List
from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel, Field

from core.database import db
from core.security import get_current_user
from core.rate_limit import limiter

router = APIRouter(prefix="/api/friends-map", tags=["friends-map"])


class LocationUpdate(BaseModel):
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    accuracy: Optional[float] = None


class LocationSettings(BaseModel):
    enabled: bool
    visibility: str = Field(default="friends", pattern="^(friends|public|private)$")
    auto_expire_hours: int = Field(default=24, ge=1, le=168)  # 1 hour to 7 days


@router.post("/settings")
async def update_location_settings(settings: LocationSettings, request: Request):
    """Enable/disable location sharing and set visibility preferences."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    await db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {
            "location_sharing_enabled": settings.enabled,
            "location_visibility": settings.visibility,
            "location_auto_expire_hours": settings.auto_expire_hours,
            "location_settings_updated_at": datetime.now(timezone.utc).isoformat(),
        }},
    )
    
    # If disabled, clear current location
    if not settings.enabled:
        await db.user_locations.delete_many({"user_id": user_id})
    
    return {
        "ok": True,
        "enabled": settings.enabled,
        "visibility": settings.visibility,
    }


@router.get("/settings")
async def get_location_settings(request: Request):
    """Get current location sharing settings."""
    user = await get_current_user(request)
    
    return {
        "enabled": user.get("location_sharing_enabled", False),
        "visibility": user.get("location_visibility", "friends"),
        "auto_expire_hours": user.get("location_auto_expire_hours", 24),
    }


@router.post("/update-location")
@limiter.limit("30/minute")
async def update_location(location: LocationUpdate, request: Request):
    """Update user's current location (if sharing enabled)."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    if not user.get("location_sharing_enabled", False):
        raise HTTPException(
            status_code=403,
            detail="Standort-Sharing ist deaktiviert. Bitte aktivieren Sie es zuerst."
        )
    
    # Calculate expiry time
    expire_hours = user.get("location_auto_expire_hours", 24)
    expires_at = datetime.now(timezone.utc) + timedelta(hours=expire_hours)
    
    # Upsert location
    location_doc = {
        "user_id": user_id,
        "name": user.get("name", ""),
        "email": user.get("email", ""),
        "profile_picture": user.get("profile_picture", ""),
        "latitude": location.latitude,
        "longitude": location.longitude,
        "accuracy": location.accuracy,
        "visibility": user.get("location_visibility", "friends"),
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "expires_at": expires_at.isoformat(),
    }
    
    await db.user_locations.update_one(
        {"user_id": user_id},
        {"$set": location_doc},
        upsert=True,
    )
    
    # Create geospatial index if not exists
    try:
        await db.user_locations.create_index([("latitude", 1), ("longitude", 1)])
    except Exception:
        pass
    
    return {
        "ok": True,
        "message": "Standort aktualisiert",
        "expires_at": expires_at.isoformat(),
    }


@router.get("/friends-nearby")
async def get_friends_nearby(
    request: Request,
    radius_km: float = 50.0,
):
    """
    Get friends' locations within a radius.
    Only returns friends who have enabled location sharing with visibility='friends' or 'public'.
    """
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    # Get user's current location
    my_location = await db.user_locations.find_one({"user_id": user_id}, {"_id": 0})
    if not my_location:
        raise HTTPException(
            status_code=404,
            detail="Sie haben noch keinen Standort geteilt. Bitte aktivieren Sie Standort-Sharing."
        )
    
    my_lat = my_location["latitude"]
    my_lon = my_location["longitude"]
    
    # Get user's friends
    friends = await db.friends.find(
        {
            "$or": [
                {"user_id": user_id, "status": "accepted"},
                {"friend_id": user_id, "status": "accepted"},
            ]
        },
        {"_id": 0},
    ).to_list(1000)
    
    # Extract friend IDs
    friend_ids = []
    for f in friends:
        if f["user_id"] == user_id:
            friend_ids.append(f["friend_id"])
        else:
            friend_ids.append(f["user_id"])
    
    if not friend_ids:
        return {"friends": [], "count": 0}
    
    # Get friends' locations (only if they enabled sharing)
    now = datetime.now(timezone.utc).isoformat()
    friend_locations = await db.user_locations.find(
        {
            "user_id": {"$in": friend_ids},
            "visibility": {"$in": ["friends", "public"]},
            "expires_at": {"$gte": now},
        },
        {"_id": 0},
    ).to_list(500)
    
    # Calculate distance and filter by radius
    nearby_friends = []
    for loc in friend_locations:
        distance_km = _haversine_distance(
            my_lat, my_lon,
            loc["latitude"], loc["longitude"]
        )
        
        if distance_km <= radius_km:
            nearby_friends.append({
                "user_id": loc["user_id"],
                "name": loc["name"],
                "profile_picture": loc.get("profile_picture", ""),
                "latitude": loc["latitude"],
                "longitude": loc["longitude"],
                "distance_km": round(distance_km, 2),
                "updated_at": loc["updated_at"],
            })
    
    # Sort by distance
    nearby_friends.sort(key=lambda x: x["distance_km"])
    
    return {
        "friends": nearby_friends,
        "count": len(nearby_friends),
        "your_location": {
            "latitude": my_lat,
            "longitude": my_lon,
        },
    }


@router.get("/public-nearby")
async def get_public_nearby(
    request: Request,
    radius_km: float = 10.0,
):
    """
    Get all users with public location sharing within a radius.
    Useful for discovering new people nearby.
    """
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    # Get user's current location
    my_location = await db.user_locations.find_one({"user_id": user_id}, {"_id": 0})
    if not my_location:
        raise HTTPException(
            status_code=404,
            detail="Sie haben noch keinen Standort geteilt."
        )
    
    my_lat = my_location["latitude"]
    my_lon = my_location["longitude"]
    
    # Get public locations (exclude self)
    now = datetime.now(timezone.utc).isoformat()
    public_locations = await db.user_locations.find(
        {
            "user_id": {"$ne": user_id},
            "visibility": "public",
            "expires_at": {"$gte": now},
        },
        {"_id": 0},
    ).to_list(200)
    
    # Calculate distance and filter
    nearby_users = []
    for loc in public_locations:
        distance_km = _haversine_distance(
            my_lat, my_lon,
            loc["latitude"], loc["longitude"]
        )
        
        if distance_km <= radius_km:
            nearby_users.append({
                "user_id": loc["user_id"],
                "name": loc["name"],
                "profile_picture": loc.get("profile_picture", ""),
                "latitude": loc["latitude"],
                "longitude": loc["longitude"],
                "distance_km": round(distance_km, 2),
            })
    
    # Sort by distance
    nearby_users.sort(key=lambda x: x["distance_km"])
    
    return {
        "users": nearby_users,
        "count": len(nearby_users),
    }


@router.delete("/clear-location")
async def clear_location(request: Request):
    """Immediately clear user's shared location."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    result = await db.user_locations.delete_many({"user_id": user_id})
    
    return {
        "ok": True,
        "message": "Standort gelöscht",
        "deleted_count": result.deleted_count,
    }


# ══════════════════════════════════════════════════════════════
# Helper: Haversine Distance
# ══════════════════════════════════════════════════════════════

import math

def _haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculate distance between two GPS coordinates in kilometers.
    Uses Haversine formula.
    """
    R = 6371.0  # Earth radius in km
    
    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    delta_lat = math.radians(lat2 - lat1)
    delta_lon = math.radians(lon2 - lon1)
    
    a = (
        math.sin(delta_lat / 2) ** 2 +
        math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lon / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    
    distance = R * c
    return distance
