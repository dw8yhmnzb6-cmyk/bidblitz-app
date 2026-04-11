"""
BidBlitz V2 - Unified Nearby API
Real database queries for scooters, drivers, restaurants, kids
NO FAKE DATA - Only returns real DB records
"""

from fastapi import APIRouter, HTTPException, Request
from typing import Optional
from datetime import datetime, timezone
import math
from core.database import db
from core.security import get_current_user

router = APIRouter(prefix="/api/nearby", tags=["Nearby"])


def haversine_distance(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Calculate distance between two coordinates in km."""
    R = 6371  # Earth's radius in km
    
    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    delta_lat = math.radians(lat2 - lat1)
    delta_lng = math.radians(lng2 - lng1)
    
    a = math.sin(delta_lat / 2) ** 2 + \
        math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lng / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    
    return R * c


def is_valid_coord(lat, lng) -> bool:
    """Validate coordinates."""
    try:
        lat = float(lat) if lat else None
        lng = float(lng) if lng else None
        return lat is not None and lng is not None and \
               -90 <= lat <= 90 and -180 <= lng <= 180
    except (TypeError, ValueError):
        return False


# ═══════════════════════════════════════════════════════════════════════════════
# SCOOTERS - REAL DB ONLY
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/scooters")
async def get_nearby_scooters(
    lat: float,
    lng: float,
    radius_km: float = 5.0,
    limit: int = 50
):
    """
    Get nearby scooters from REAL database.
    Returns only: available, battery > 0, valid coordinates.
    """
    if not is_valid_coord(lat, lng):
        raise HTTPException(status_code=400, detail="Invalid coordinates")
    
    # Query real scooters from DB
    all_scooters = await db.scooters.find({
        "status": {"$in": ["available", "locked"]},
        "battery": {"$gt": 0},
        "lat": {"$exists": True, "$ne": None},
        "lng": {"$exists": True, "$ne": None},
    }).to_list(500)
    
    nearby = []
    for scooter in all_scooters:
        s_lat = scooter.get("lat")
        s_lng = scooter.get("lng")
        
        if not is_valid_coord(s_lat, s_lng):
            continue
        
        distance = haversine_distance(lat, lng, s_lat, s_lng)
        
        if distance <= radius_km:
            scooter.pop("_id", None)
            scooter["distance_km"] = round(distance, 2)
            nearby.append(scooter)
    
    # Sort by distance
    nearby.sort(key=lambda x: x.get("distance_km", 999))
    
    return {
        "scooters": nearby[:limit],
        "total": len(nearby),
        "radius_km": radius_km,
        "center": {"lat": lat, "lng": lng},
        "message": "Keine Scooter verfügbar" if len(nearby) == 0 else None,
    }


# ═══════════════════════════════════════════════════════════════════════════════
# DRIVERS - REAL DB ONLY
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/drivers")
async def get_nearby_drivers(
    lat: float,
    lng: float,
    radius_km: float = 10.0,
    vehicle_type: Optional[str] = None,
    limit: int = 20
):
    """
    Get nearby drivers from REAL database.
    Returns only: verified, online, valid coordinates.
    """
    if not is_valid_coord(lat, lng):
        raise HTTPException(status_code=400, detail="Invalid coordinates")
    
    # Build query for real drivers
    query = {
        "is_verified": True,
        "is_online": True,
        "status": "active",
        "current_location.lat": {"$exists": True, "$ne": None},
        "current_location.lng": {"$exists": True, "$ne": None},
    }
    
    if vehicle_type:
        query["vehicle.type"] = vehicle_type
    
    all_drivers = await db.drivers.find(query).to_list(200)
    
    nearby = []
    for driver in all_drivers:
        loc = driver.get("current_location", {})
        d_lat = loc.get("lat")
        d_lng = loc.get("lng")
        
        if not is_valid_coord(d_lat, d_lng):
            continue
        
        distance = haversine_distance(lat, lng, d_lat, d_lng)
        
        if distance <= radius_km:
            # Clean sensitive data
            driver.pop("_id", None)
            driver.pop("password_hash", None)
            driver.pop("documents", None)
            
            driver["lat"] = d_lat
            driver["lng"] = d_lng
            driver["distance_km"] = round(distance, 2)
            driver["eta_minutes"] = max(1, int(distance * 3))  # Rough ETA
            nearby.append(driver)
    
    # Sort by distance
    nearby.sort(key=lambda x: x.get("distance_km", 999))
    
    return {
        "drivers": nearby[:limit],
        "total": len(nearby),
        "radius_km": radius_km,
        "center": {"lat": lat, "lng": lng},
        "message": "Keine Fahrer online" if len(nearby) == 0 else None,
    }


# ═══════════════════════════════════════════════════════════════════════════════
# RESTAURANTS - REAL DB ONLY
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/restaurants")
async def get_nearby_restaurants(
    lat: float,
    lng: float,
    radius_km: float = 10.0,
    category: Optional[str] = None,
    limit: int = 50
):
    """
    Get nearby restaurants from REAL database.
    Returns only: approved, valid coordinates.
    """
    if not is_valid_coord(lat, lng):
        raise HTTPException(status_code=400, detail="Invalid coordinates")
    
    # Build query for real restaurants
    query = {
        "is_approved": True,
        "lat": {"$exists": True, "$ne": None},
        "lng": {"$exists": True, "$ne": None},
    }
    
    if category:
        query["category"] = category
    
    all_restaurants = await db.restaurants.find(query).to_list(500)
    
    nearby = []
    for restaurant in all_restaurants:
        r_lat = restaurant.get("lat")
        r_lng = restaurant.get("lng")
        
        if not is_valid_coord(r_lat, r_lng):
            continue
        
        distance = haversine_distance(lat, lng, r_lat, r_lng)
        
        if distance <= radius_km:
            restaurant.pop("_id", None)
            restaurant["distance_km"] = round(distance, 2)
            nearby.append(restaurant)
    
    # Sort by distance
    nearby.sort(key=lambda x: x.get("distance_km", 999))
    
    return {
        "restaurants": nearby[:limit],
        "total": len(nearby),
        "radius_km": radius_km,
        "center": {"lat": lat, "lng": lng},
        "message": "Keine Restaurants in deiner Nähe" if len(nearby) == 0 else None,
    }


# ═══════════════════════════════════════════════════════════════════════════════
# KIDS LOCATIONS - REAL DB ONLY
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/kids")
async def get_kids_locations(request: Request):
    """
    Get real-time locations of parent's kids.
    Returns only real saved locations from DB.
    """
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    # Get parent's children
    children = await db.kids_children.find({
        "parent_id": user_id,
        "location.lat": {"$exists": True, "$ne": None},
        "location.lng": {"$exists": True, "$ne": None},
    }).to_list(20)
    
    kids_locations = []
    for child in children:
        loc = child.get("location", {})
        if is_valid_coord(loc.get("lat"), loc.get("lng")):
            kids_locations.append({
                "child_id": child.get("child_id"),
                "name": child.get("name"),
                "avatar": child.get("avatar"),
                "lat": loc.get("lat"),
                "lng": loc.get("lng"),
                "last_updated": loc.get("updated_at"),
                "battery": child.get("device_battery"),
            })
    
    return {
        "kids": kids_locations,
        "total": len(kids_locations),
        "message": "Keine Standortdaten verfügbar" if len(kids_locations) == 0 else None,
    }


# ═══════════════════════════════════════════════════════════════════════════════
# MARKETPLACE LISTINGS - REAL DB ONLY
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/listings")
async def get_nearby_listings(
    lat: float,
    lng: float,
    radius_km: float = 50.0,
    category: Optional[str] = None,
    limit: int = 50
):
    """
    Get nearby marketplace listings from REAL database.
    """
    if not is_valid_coord(lat, lng):
        raise HTTPException(status_code=400, detail="Invalid coordinates")
    
    query = {
        "status": "active",
        "lat": {"$exists": True, "$ne": None},
        "lng": {"$exists": True, "$ne": None},
    }
    
    if category:
        query["category"] = category
    
    all_listings = await db.marketplace_listings.find(query).to_list(500)
    
    nearby = []
    for listing in all_listings:
        l_lat = listing.get("lat")
        l_lng = listing.get("lng")
        
        if not is_valid_coord(l_lat, l_lng):
            continue
        
        distance = haversine_distance(lat, lng, l_lat, l_lng)
        
        if distance <= radius_km:
            listing.pop("_id", None)
            listing["distance_km"] = round(distance, 2)
            nearby.append(listing)
    
    # Sort by boost status, then distance
    nearby.sort(key=lambda x: (not x.get("is_boosted", False), x.get("distance_km", 999)))
    
    return {
        "listings": nearby[:limit],
        "total": len(nearby),
        "radius_km": radius_km,
        "center": {"lat": lat, "lng": lng},
    }


# ═══════════════════════════════════════════════════════════════════════════════
# ALL NEARBY - COMBINED VIEW
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/all")
async def get_all_nearby(
    lat: float,
    lng: float,
    radius_km: float = 5.0
):
    """
    Get all nearby entities in one call.
    Useful for unified map view.
    """
    if not is_valid_coord(lat, lng):
        raise HTTPException(status_code=400, detail="Invalid coordinates")
    
    # Get all entity types
    scooters_res = await get_nearby_scooters(lat, lng, radius_km, 20)
    drivers_res = await get_nearby_drivers(lat, lng, radius_km * 2, None, 10)
    restaurants_res = await get_nearby_restaurants(lat, lng, radius_km * 2, None, 20)
    
    return {
        "scooters": scooters_res.get("scooters", []),
        "drivers": drivers_res.get("drivers", []),
        "restaurants": restaurants_res.get("restaurants", []),
        "counts": {
            "scooters": scooters_res.get("total", 0),
            "drivers": drivers_res.get("total", 0),
            "restaurants": restaurants_res.get("total", 0),
        },
        "center": {"lat": lat, "lng": lng},
        "radius_km": radius_km,
    }
