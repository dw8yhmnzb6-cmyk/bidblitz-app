"""
BidBlitz V2 - Admin Map Entity Management
Create, edit, approve map entities (scooters, drivers, restaurants)
"""

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, timezone
import secrets
from core.database import db
from core.security import get_current_user

router = APIRouter(prefix="/api/admin/map", tags=["Admin Map"])


async def require_admin(request: Request):
    """Require admin role."""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin erforderlich")
    return user


# ═══════════════════════════════════════════════════════════════════════════════
# SCOOTER MANAGEMENT
# ═══════════════════════════════════════════════════════════════════════════════

class ScooterCreate(BaseModel):
    name: str = Field(default="Scooter")
    lat: float = Field(..., ge=-90, le=90)
    lng: float = Field(..., ge=-180, le=180)
    battery: int = Field(default=100, ge=0, le=100)
    unlock_fee: float = Field(default=1.00, ge=0)
    price_per_minute: float = Field(default=0.20, ge=0)


class ScooterUpdate(BaseModel):
    name: Optional[str] = None
    lat: Optional[float] = Field(None, ge=-90, le=90)
    lng: Optional[float] = Field(None, ge=-180, le=180)
    battery: Optional[int] = Field(None, ge=0, le=100)
    status: Optional[str] = None
    unlock_fee: Optional[float] = Field(None, ge=0)
    price_per_minute: Optional[float] = Field(None, ge=0)


@router.get("/scooters")
async def admin_list_scooters(request: Request):
    """List all scooters for admin."""
    await require_admin(request)
    
    scooters = await db.scooters.find({}).sort("created_at", -1).to_list(500)
    
    for s in scooters:
        s.pop("_id", None)
    
    # Count by status
    stats = {
        "available": sum(1 for s in scooters if s.get("status") == "available"),
        "in_use": sum(1 for s in scooters if s.get("status") == "in_use"),
        "offline": sum(1 for s in scooters if s.get("status") == "offline"),
        "maintenance": sum(1 for s in scooters if s.get("status") == "maintenance"),
        "low_battery": sum(1 for s in scooters if s.get("battery", 100) < 20),
        "invalid_coords": sum(1 for s in scooters if not s.get("lat") or not s.get("lng")),
    }
    
    return {
        "scooters": scooters,
        "total": len(scooters),
        "stats": stats,
    }


@router.post("/scooters")
async def admin_create_scooter(req: ScooterCreate, request: Request):
    """Create a new scooter."""
    await require_admin(request)
    
    now = datetime.now(timezone.utc)
    scooter = {
        "scooter_id": secrets.token_hex(8),
        "name": req.name,
        "lat": req.lat,
        "lng": req.lng,
        "battery": req.battery,
        "status": "available",
        "unlock_fee": req.unlock_fee,
        "price_per_minute": req.price_per_minute,
        "total_rides": 0,
        "total_revenue": 0.0,
        "last_ride_at": None,
        "device_id": None,  # For IoT integration
        "created_at": now.isoformat(),
        "updated_at": now.isoformat(),
    }
    
    await db.scooters.insert_one(scooter)
    scooter.pop("_id", None)
    
    return {"ok": True, "scooter": scooter}


@router.put("/scooters/{scooter_id}")
async def admin_update_scooter(scooter_id: str, req: ScooterUpdate, request: Request):
    """Update scooter details."""
    await require_admin(request)
    
    update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
    
    if req.name is not None:
        update_data["name"] = req.name
    if req.lat is not None:
        update_data["lat"] = req.lat
    if req.lng is not None:
        update_data["lng"] = req.lng
    if req.battery is not None:
        update_data["battery"] = req.battery
    if req.status is not None:
        update_data["status"] = req.status
    if req.unlock_fee is not None:
        update_data["unlock_fee"] = req.unlock_fee
    if req.price_per_minute is not None:
        update_data["price_per_minute"] = req.price_per_minute
    
    result = await db.scooters.update_one(
        {"scooter_id": scooter_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Scooter nicht gefunden")
    
    return {"ok": True, "message": "Scooter aktualisiert"}


@router.delete("/scooters/{scooter_id}")
async def admin_delete_scooter(scooter_id: str, request: Request):
    """Delete a scooter."""
    await require_admin(request)
    
    result = await db.scooters.delete_one({"scooter_id": scooter_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Scooter nicht gefunden")
    
    return {"ok": True, "message": "Scooter gelöscht"}


# ═══════════════════════════════════════════════════════════════════════════════
# DRIVER MANAGEMENT
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/drivers")
async def admin_list_drivers(request: Request):
    """List all drivers for admin."""
    await require_admin(request)
    
    drivers = await db.drivers.find({}).sort("created_at", -1).to_list(500)
    
    for d in drivers:
        d.pop("_id", None)
        d.pop("password_hash", None)
    
    stats = {
        "pending": sum(1 for d in drivers if d.get("kyc_status") == "pending"),
        "verified": sum(1 for d in drivers if d.get("is_verified")),
        "online": sum(1 for d in drivers if d.get("is_online")),
        "suspended": sum(1 for d in drivers if d.get("status") == "suspended"),
        "invalid_coords": sum(1 for d in drivers if not d.get("current_location", {}).get("lat")),
    }
    
    return {
        "drivers": drivers,
        "total": len(drivers),
        "stats": stats,
    }


@router.post("/drivers/{driver_id}/verify")
async def admin_verify_driver(driver_id: str, request: Request):
    """Approve/verify a driver."""
    await require_admin(request)
    
    result = await db.drivers.update_one(
        {"driver_id": driver_id},
        {"$set": {
            "is_verified": True,
            "kyc_status": "approved",
            "status": "active",
            "verified_at": datetime.now(timezone.utc).isoformat(),
        }}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Fahrer nicht gefunden")
    
    return {"ok": True, "message": "Fahrer verifiziert"}


@router.post("/drivers/{driver_id}/suspend")
async def admin_suspend_driver(driver_id: str, request: Request):
    """Suspend a driver."""
    await require_admin(request)
    
    result = await db.drivers.update_one(
        {"driver_id": driver_id},
        {"$set": {
            "status": "suspended",
            "is_online": False,
            "suspended_at": datetime.now(timezone.utc).isoformat(),
        }}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Fahrer nicht gefunden")
    
    return {"ok": True, "message": "Fahrer suspendiert"}


@router.put("/drivers/{driver_id}/location")
async def admin_set_driver_location(driver_id: str, lat: float, lng: float, request: Request):
    """Manually set driver location (for testing)."""
    await require_admin(request)
    
    result = await db.drivers.update_one(
        {"driver_id": driver_id},
        {"$set": {
            "current_location": {
                "lat": lat,
                "lng": lng,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }
        }}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Fahrer nicht gefunden")
    
    return {"ok": True, "message": "Standort aktualisiert"}


# ═══════════════════════════════════════════════════════════════════════════════
# RESTAURANT MANAGEMENT
# ═══════════════════════════════════════════════════════════════════════════════

class RestaurantCreate(BaseModel):
    name: str
    category: str
    lat: float = Field(..., ge=-90, le=90)
    lng: float = Field(..., ge=-180, le=180)
    address: Optional[str] = None
    phone: Optional[str] = None
    image_url: Optional[str] = None
    delivery_time: str = "30-45"
    price_level: int = Field(default=2, ge=1, le=4)


class RestaurantUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    lat: Optional[float] = Field(None, ge=-90, le=90)
    lng: Optional[float] = Field(None, ge=-180, le=180)
    address: Optional[str] = None
    is_open: Optional[bool] = None
    is_approved: Optional[bool] = None


@router.get("/restaurants")
async def admin_list_restaurants(request: Request):
    """List all restaurants for admin."""
    await require_admin(request)
    
    restaurants = await db.restaurants.find({}).sort("created_at", -1).to_list(500)
    
    for r in restaurants:
        r.pop("_id", None)
    
    stats = {
        "pending": sum(1 for r in restaurants if not r.get("is_approved")),
        "approved": sum(1 for r in restaurants if r.get("is_approved")),
        "open": sum(1 for r in restaurants if r.get("is_open")),
        "invalid_coords": sum(1 for r in restaurants if not r.get("lat") or not r.get("lng")),
    }
    
    return {
        "restaurants": restaurants,
        "total": len(restaurants),
        "stats": stats,
    }


@router.post("/restaurants")
async def admin_create_restaurant(req: RestaurantCreate, request: Request):
    """Create a new restaurant."""
    await require_admin(request)
    
    now = datetime.now(timezone.utc)
    restaurant = {
        "restaurant_id": secrets.token_hex(8),
        "name": req.name,
        "category": req.category,
        "lat": req.lat,
        "lng": req.lng,
        "address": req.address,
        "phone": req.phone,
        "image_url": req.image_url,
        "delivery_time": req.delivery_time,
        "price_level": req.price_level,
        "rating": 4.5,
        "is_open": True,
        "is_approved": True,  # Admin-created = auto-approved
        "menu": [],
        "total_orders": 0,
        "created_at": now.isoformat(),
        "updated_at": now.isoformat(),
    }
    
    await db.restaurants.insert_one(restaurant)
    restaurant.pop("_id", None)
    
    return {"ok": True, "restaurant": restaurant}


@router.post("/restaurants/{restaurant_id}/approve")
async def admin_approve_restaurant(restaurant_id: str, request: Request):
    """Approve a restaurant."""
    await require_admin(request)
    
    result = await db.restaurants.update_one(
        {"restaurant_id": restaurant_id},
        {"$set": {
            "is_approved": True,
            "approved_at": datetime.now(timezone.utc).isoformat(),
        }}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Restaurant nicht gefunden")
    
    return {"ok": True, "message": "Restaurant genehmigt"}


@router.put("/restaurants/{restaurant_id}")
async def admin_update_restaurant(restaurant_id: str, req: RestaurantUpdate, request: Request):
    """Update restaurant details."""
    await require_admin(request)
    
    update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
    
    if req.name is not None:
        update_data["name"] = req.name
    if req.category is not None:
        update_data["category"] = req.category
    if req.lat is not None:
        update_data["lat"] = req.lat
    if req.lng is not None:
        update_data["lng"] = req.lng
    if req.address is not None:
        update_data["address"] = req.address
    if req.is_open is not None:
        update_data["is_open"] = req.is_open
    if req.is_approved is not None:
        update_data["is_approved"] = req.is_approved
    
    result = await db.restaurants.update_one(
        {"restaurant_id": restaurant_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Restaurant nicht gefunden")
    
    return {"ok": True, "message": "Restaurant aktualisiert"}


@router.delete("/restaurants/{restaurant_id}")
async def admin_delete_restaurant(restaurant_id: str, request: Request):
    """Delete a restaurant."""
    await require_admin(request)
    
    result = await db.restaurants.delete_one({"restaurant_id": restaurant_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Restaurant nicht gefunden")
    
    return {"ok": True, "message": "Restaurant gelöscht"}


# ═══════════════════════════════════════════════════════════════════════════════
# MAP OVERVIEW
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/overview")
async def admin_map_overview(request: Request):
    """Get overview of all map entities for admin dashboard."""
    await require_admin(request)
    
    scooter_count = await db.scooters.count_documents({})
    driver_count = await db.drivers.count_documents({})
    restaurant_count = await db.restaurants.count_documents({})
    
    # Recent activity
    recent_rides = await db.scooter_rides.find({}).sort("created_at", -1).limit(10).to_list(10)
    recent_orders = await db.food_orders.find({}).sort("created_at", -1).limit(10).to_list(10)
    
    for r in recent_rides:
        r.pop("_id", None)
    for o in recent_orders:
        o.pop("_id", None)
    
    return {
        "counts": {
            "scooters": scooter_count,
            "drivers": driver_count,
            "restaurants": restaurant_count,
        },
        "recent_rides": recent_rides,
        "recent_orders": recent_orders,
    }
