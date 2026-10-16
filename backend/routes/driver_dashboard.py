"""
BidBlitz V2 - Real Driver Dashboard API
Full ride management for verified drivers
"""

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, timezone, timedelta
import secrets
import math

from core.database import db
from core.security import get_current_user

router = APIRouter(prefix="/api/driver-dashboard", tags=["Driver Dashboard"])


# ═══════════════════════════════════════════════════════════════════════════════
# HELPERS
# ═══════════════════════════════════════════════════════════════════════════════

def haversine(lat1, lng1, lat2, lng2):
    """Calculate distance in km."""
    R = 6371
    lat1_r, lat2_r = math.radians(lat1), math.radians(lat2)
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = math.sin(dlat/2)**2 + math.cos(lat1_r)*math.cos(lat2_r)*math.sin(dlng/2)**2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))


async def get_verified_driver(request: Request):
    """Get current user and verify they are an approved driver."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    driver = await db.drivers.find_one({
        "user_id": user_id,
        "$or": [
            {"verified": True, "status": "approved"},
            {"is_verified": True, "status": "active"},
        ],
    })
    
    if not driver:
        raise HTTPException(status_code=403, detail="Kein verifizierter Fahrer")
    
    driver.pop("_id", None)
    return driver, user


async def create_notification(user_id: str, title: str, message: str, type_: str = "info"):
    """Create a notification."""
    await db.notifications.insert_one({
        "notification_id": secrets.token_hex(8),
        "user_id": user_id,
        "title": title,
        "message": message,
        "type": type_,
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    })


def _driver_location(driver: dict) -> dict:
    return driver.get("current_location") or driver.get("location") or {}


def _driver_vehicle_type(driver: dict) -> str:
    vehicle = driver.get("vehicle") or driver.get("car") or {}
    return vehicle.get("type") or vehicle.get("vehicle_type") or "standard"


def _driver_is_verified(driver: dict) -> bool:
    return (
        (driver.get("verified") is True and driver.get("status") == "approved")
        or (driver.get("is_verified") is True and driver.get("status") == "active")
    )


def _driver_vehicle(driver: dict) -> dict:
    return driver.get("vehicle") or driver.get("car") or {}


def _driver_ride_view(ride: dict) -> dict:
    row = dict(ride or {})
    row.pop("_id", None)
    destination = row.get("destination") or row.get("dropoff") or {}
    row["destination"] = destination
    row["dropoff"] = row.get("dropoff") or destination
    if row.get("estimated_fare") is None:
        row["estimated_fare"] = row.get("fare_estimate", 0)
    if row.get("distance_km") is None:
        row["distance_km"] = row.get("distance_km_estimate", 0)
    return row


async def _pending_customer_rides(driver: dict, limit: int = 20) -> List[dict]:
    """Return live customer bookings from the canonical taxi_rides collection."""
    if not (driver.get("is_online") or driver.get("online")):
        return []
    if driver.get("is_busy") or driver.get("active_ride_id"):
        return []

    loc = _driver_location(driver)
    try:
        lat = float(loc.get("lat"))
        lng = float(loc.get("lng"))
    except (TypeError, ValueError):
        return []

    dispatch_cutoff = (datetime.now(timezone.utc) + timedelta(minutes=15)).isoformat()
    rides = await db.taxi_rides.find({
        "status": "requested",
        "car_type": _driver_vehicle_type(driver),
        "rejected_driver_ids": {"$ne": driver["driver_id"]},
        "$or": [
            {"scheduled_at": None},
            {"scheduled_at": {"$lte": dispatch_cutoff}},
            {"scheduled_at": {"$exists": False}, "options.scheduled_at": None},
            {"options.scheduled_at": {"$lte": dispatch_cutoff}},
        ],
    }, {"_id": 0}).sort("created_at", -1).to_list(100)

    rows = []
    for ride in rides:
        pickup = ride.get("pickup") or {}
        try:
            p_lat = float(pickup.get("lat"))
            p_lng = float(pickup.get("lng"))
        except (TypeError, ValueError):
            continue
        distance_to_pickup = haversine(lat, lng, p_lat, p_lng)
        if distance_to_pickup > 10:
            continue
        rows.append({
            "request_id": ride["ride_id"],
            "ride_id": ride["ride_id"],
            "customer_id": ride.get("customer_id"),
            "customer_name": ride.get("customer_name") or "Kunde",
            "pickup": pickup,
            "destination": ride.get("dropoff") or {},
            "dropoff": ride.get("dropoff") or {},
            "distance_km": ride.get("distance_km_estimate", 0),
            "distance_to_pickup_km": round(distance_to_pickup, 2),
            "estimated_fare": ride.get("fare_estimate", 0),
            "eta_minutes": max(1, round(distance_to_pickup * 2.5)),
            "status": "pending",
            "created_at": ride.get("created_at"),
            "scheduled_at": ride.get("scheduled_at") or (ride.get("options") or {}).get("scheduled_at"),
        })

    rows.sort(key=lambda item: item["distance_to_pickup_km"])
    return rows[:limit]


# ═══════════════════════════════════════════════════════════════════════════════
# MODELS
# ═══════════════════════════════════════════════════════════════════════════════

class LocationUpdate(BaseModel):
    lat: float = Field(..., ge=-90, le=90)
    lng: float = Field(..., ge=-180, le=180)


class RideStatusUpdate(BaseModel):
    status: str = Field(..., pattern="^(accepted|arriving|started|completed|canceled|cancelled)$")


# ═══════════════════════════════════════════════════════════════════════════════
# DRIVER STATUS & PROFILE
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/eligibility")
async def driver_eligibility(request: Request):
    """Public (to any logged-in user): whether current user has access to Driver Mode."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    driver = await db.drivers.find_one(
        {"user_id": user_id},
        {"_id": 0, "driver_id": 1, "verified": 1, "is_verified": 1, "status": 1, "name": 1, "user_name": 1}
    )
    if not driver:
        return {"is_driver": False, "is_verified": False, "status": "not_registered"}
    return {
        "is_driver": True,
        "is_verified": _driver_is_verified(driver),
        "status": driver.get("status", "pending"),
        "driver_id": driver.get("driver_id"),
    }


@router.get("/profile")
async def driver_profile(request: Request):
    """Full driver profile (for the Profile tab in Driver Mode)."""
    driver, user = await get_verified_driver(request)
    # Aggregate lifetime stats
    total_rides = await db.taxi_rides.count_documents({
        "driver_id": driver["driver_id"], "status": "completed"
    })
    total_earned = 0.0
    async for r in db.taxi_rides.aggregate([
        {"$match": {"driver_id": driver["driver_id"], "status": "completed"}},
        {"$group": {"_id": None, "sum": {"$sum": "$driver_earnings"}}},
    ]):
        total_earned = float(r.get("sum", 0))
    return {
        "driver_id": driver["driver_id"],
        "name": driver.get("name") or driver.get("user_name") or user.get("name"),
        "email": user.get("email"),
        "phone": driver.get("phone") or user.get("phone"),
        "avatar": user.get("avatar"),
        "vehicle": _driver_vehicle(driver),
        "rating": round(float(driver.get("rating", 5.0)), 2),
        "is_verified": _driver_is_verified(driver),
        "status": driver.get("status"),
        "joined_at": driver.get("created_at") or driver.get("approved_at"),
        "stats": {
            "total_rides": total_rides,
            "total_earned": round(total_earned, 2),
            "wallet_balance": round(float(user.get("balance", 0) or 0), 2),
        },
    }


@router.get("/status")
async def get_driver_status(request: Request):
    """Get driver dashboard status."""
    driver, user = await get_verified_driver(request)
    
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today_start - timedelta(days=today_start.weekday())
    
    # Get earnings
    today_rides = await db.taxi_rides.find({
        "driver_id": driver["driver_id"],
        "status": "completed",
        "completed_at": {"$gte": today_start.isoformat()}
    }).to_list(100)
    
    week_rides = await db.taxi_rides.find({
        "driver_id": driver["driver_id"],
        "status": "completed",
        "completed_at": {"$gte": week_start.isoformat()}
    }).to_list(500)
    
    all_rides = await db.taxi_rides.count_documents({
        "driver_id": driver["driver_id"],
        "status": "completed"
    })
    
    today_earnings = sum(r.get("driver_earnings", 0) for r in today_rides)
    week_earnings = sum(r.get("driver_earnings", 0) for r in week_rides)
    
    # Get current active ride
    active_ride = await db.taxi_rides.find_one({
        "driver_id": driver["driver_id"],
        "status": {"$in": ["accepted", "arriving", "started"]}
    })
    
    if active_ride:
        active_ride = _driver_ride_view(active_ride)
    
    # Get pending customer bookings from canonical taxi_rides.
    pending_requests = await _pending_customer_rides(driver, limit=10)
    
    return {
        "driver_id": driver["driver_id"],
        "name": driver.get("name") or driver.get("user_name") or user.get("name"),
        "is_online": bool(driver.get("is_online") or driver.get("online")),
        "is_busy": active_ride is not None,
        "vehicle": _driver_vehicle(driver),
        "rating": driver.get("rating", 5.0),
        "current_location": _driver_location(driver),
        "earnings": {
            "today": round(today_earnings, 2),
            "today_rides": len(today_rides),
            "week": round(week_earnings, 2),
            "week_rides": len(week_rides),
            "total_rides": all_rides,
        },
        "active_ride": active_ride,
        "pending_requests": pending_requests,
        "balance": round(float(user.get("balance", 0) or 0), 2),
    }


@router.post("/go-online")
async def go_online(location: LocationUpdate, request: Request):
    """Set driver status to online."""
    driver, _ = await get_verified_driver(request)
    
    await db.drivers.update_one(
        {"driver_id": driver["driver_id"]},
        {"$set": {
            "is_online": True,
            "online": True,
            "current_location": {
                "lat": location.lat,
                "lng": location.lng,
                "updated_at": datetime.now(timezone.utc).isoformat()
            },
            "location": {"lat": location.lat, "lng": location.lng},
            "went_online_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"ok": True, "message": "Du bist jetzt online", "is_online": True}


@router.post("/go-offline")
async def go_offline(request: Request):
    """Set driver status to offline."""
    driver, _ = await get_verified_driver(request)
    
    # Check for active rides
    active = await db.taxi_rides.find_one({
        "driver_id": driver["driver_id"],
        "status": {"$in": ["accepted", "arriving", "started"]}
    })
    
    if active:
        raise HTTPException(status_code=400, detail="Du hast noch eine aktive Fahrt")
    
    await db.drivers.update_one(
        {"driver_id": driver["driver_id"]},
        {"$set": {
            "is_online": False,
            "online": False,
            "went_offline_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"ok": True, "message": "Du bist jetzt offline", "is_online": False}


@router.post("/update-location")
async def update_location(location: LocationUpdate, request: Request):
    """Update driver's current location."""
    driver, _ = await get_verified_driver(request)
    
    await db.drivers.update_one(
        {"driver_id": driver["driver_id"]},
        {"$set": {
            "current_location": {
                "lat": location.lat,
                "lng": location.lng,
                "updated_at": datetime.now(timezone.utc).isoformat()
            },
            "location": {"lat": location.lat, "lng": location.lng}
        }}
    )
    
    return {"ok": True}


# ═══════════════════════════════════════════════════════════════════════════════
# RIDE REQUESTS
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/ride-requests")
async def get_ride_requests(request: Request):
    """Get canonical pending taxi rides available to this driver."""
    driver, _ = await get_verified_driver(request)
    requests = await _pending_customer_rides(driver, limit=20)
    return {"requests": requests, "total": len(requests)}


@router.post("/ride-requests/{request_id}/accept")
async def accept_ride_request(request_id: str, request: Request):
    """Accept through the single canonical Taxi assignment lifecycle."""
    await get_verified_driver(request)
    from models.taxi import RideActionRequest
    from routes.taxi import driver_accept_ride

    return await driver_accept_ride(RideActionRequest(ride_id=request_id), request)


@router.post("/ride-requests/{request_id}/reject")
async def reject_ride_request(request_id: str, request: Request):
    """Reject a ride request."""
    driver, _ = await get_verified_driver(request)

    canonical = await db.taxi_rides.find_one({
        "ride_id": request_id,
        "status": "requested",
    }, {"_id": 0, "ride_id": 1})
    if canonical:
        now = datetime.now(timezone.utc).isoformat()
        await db.taxi_rides.update_one(
            {"ride_id": request_id, "status": "requested"},
            {
                "$addToSet": {"rejected_driver_ids": driver["driver_id"]},
                "$push": {"dispatch_history": {
                    "driver_id": driver["driver_id"],
                    "action": "rejected",
                    "at": now,
                }},
            },
        )
        return {"ok": True, "message": "Anfrage abgelehnt"}
    
    raise HTTPException(status_code=404, detail="Kanonische Taxi-Anfrage nicht gefunden oder nicht mehr verfügbar")


# ═══════════════════════════════════════════════════════════════════════════════
# RIDE MANAGEMENT
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/active-ride")
async def get_active_ride(request: Request):
    """Get current active ride."""
    driver, _ = await get_verified_driver(request)
    
    ride = await db.taxi_rides.find_one({
        "driver_id": driver["driver_id"],
        "status": {"$in": ["accepted", "arriving", "started"]}
    })
    
    if not ride:
        return {"ride": None}
    
    ride = _driver_ride_view(ride)
    
    # Get customer info
    from bson import ObjectId
    try:
        customer = await db.users.find_one({"_id": ObjectId(ride["customer_id"])})
        if customer:
            ride["customer_name"] = customer.get("name", "Kunde")
            ride["customer_phone"] = customer.get("phone")
    except:
        ride["customer_name"] = "Kunde"
    
    return {"ride": ride}


@router.post("/rides/{ride_id}/status")
async def update_ride_status(ride_id: str, update: RideStatusUpdate, request: Request):
    """Update ride status through the canonical Taxi lifecycle."""
    driver, _ = await get_verified_driver(request)
    ride = await db.taxi_rides.find_one({
        "ride_id": ride_id,
        "driver_id": driver["driver_id"],
    }, {"_id": 0})
    if not ride:
        raise HTTPException(status_code=404, detail="Fahrt nicht gefunden")

    normalized = "cancelled" if update.status == "canceled" else update.status

    from models.taxi import RideActionRequest
    from routes.taxi import driver_arriving, driver_start_ride, driver_end_ride, cancel_ride

    action = RideActionRequest(ride_id=ride_id)

    if normalized == "arriving":
        result = await driver_arriving(action, request)
        await create_notification(
            ride["customer_id"],
            "Fahrer kommt an",
            "Dein Fahrer ist gleich da!",
            "driver_arriving",
        )
    elif normalized == "started":
        result = await driver_start_ride(action, request)
        await create_notification(
            ride["customer_id"],
            "Fahrt gestartet",
            "Gute Fahrt!",
            "ride_started",
        )
    elif normalized == "completed":
        result = await driver_end_ride(action, request)
        await db.drivers.update_one(
            {"driver_id": driver["driver_id"]},
            {"$set": {"is_busy": False}},
        )
        fare = (result.get("ride_summary") or {}).get("fare") or {}
        await create_notification(
            ride["customer_id"],
            "Fahrt beendet",
            f"Vielen Dank! Fahrpreis: €{float(fare.get('total') or 0):.2f}",
            "ride_completed",
        )
    elif normalized == "cancelled":
        if ride.get("status") == "started":
            raise HTTPException(
                status_code=400,
                detail="Eine gestartete Fahrt kann nicht normal storniert werden. Bitte nutze Support/SOS.",
            )
        result = await cancel_ride(action, request)
        await db.drivers.update_one(
            {"driver_id": driver["driver_id"]},
            {"$set": {"is_busy": False}},
        )
        await create_notification(
            ride["customer_id"],
            "Fahrt storniert",
            "Die Fahrt wurde storniert. Eine reservierte Zahlung wird automatisch freigegeben.",
            "ride_canceled",
        )
    elif normalized == "accepted":
        # Acceptance happens atomically through /ride-requests/{id}/accept.
        if ride.get("status") != "accepted":
            raise HTTPException(status_code=400, detail="Fahrt muss über die Anfrage angenommen werden")
        result = {"ok": True, "status": "accepted"}
    else:
        raise HTTPException(status_code=400, detail="Ungültiger Status")

    return {"ok": True, "status": normalized, "result": result}

# ═══════════════════════════════════════════════════════════════════════════════
# RIDE HISTORY
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/history")
async def get_ride_history(request: Request, limit: int = 50):
    """Get driver's ride history."""
    driver, _ = await get_verified_driver(request)
    
    rides = await db.taxi_rides.find({
        "driver_id": driver["driver_id"]
    }).sort("created_at", -1).limit(limit).to_list(limit)
    
    rides = [_driver_ride_view(r) for r in rides]
    
    total_earned = sum(r.get("driver_earnings", 0) for r in rides if r.get("status") == "completed")
    
    return {
        "rides": rides,
        "total": len(rides),
        "total_earned": round(total_earned, 2)
    }


# ═══════════════════════════════════════════════════════════════════════════════
# CUSTOMER RIDE REQUEST (called from customer side)
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/request-ride")
async def customer_request_ride(request: Request):
    """Deprecated customer-side taxi entry point.

    Customer bookings must use the canonical Taxi estimate/book lifecycle so
    pricing, quote locking, idempotency, wallet reservation, and driver
    assignment cannot diverge across two booking systems.
    """
    await get_current_user(request)
    raise HTTPException(
        status_code=410,
        detail="Dieser alte Taxi-Buchungspfad ist deaktiviert. Bitte die aktuelle Taxi-Buchung verwenden.",
    )

