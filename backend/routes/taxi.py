"""
BidBlitz V2 - Real Taxi/Ride System
Real drivers, real bookings, real payments.
NO FAKE DRIVERS - Only registered verified users.
"""

import secrets
import math
import logging
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from typing import Optional, List
from enum import Enum

from core.database import db
from core.security import get_current_user

router = APIRouter(prefix="/api/taxi", tags=["Taxi"])
logger = logging.getLogger("bidblitz.taxi")

# ══════════════════════════════════════════════════════════════════════════════
# PRICING CONFIGURATION
# ══════════════════════════════════════════════════════════════════════════════

PRICING = {
    "standard": {"base": 2.50, "per_km": 1.20, "per_minute": 0.25, "min_fare": 5.00},
    "premium": {"base": 5.00, "per_km": 2.00, "per_minute": 0.40, "min_fare": 10.00},
    "van": {"base": 4.00, "per_km": 1.50, "per_minute": 0.30, "min_fare": 8.00},
}

DRIVER_COMMISSION = 0.85  # Driver gets 85%
PLATFORM_COMMISSION = 0.15  # Platform gets 15%
CANCELLATION_FEE = 3.00
MIN_WALLET_BALANCE = 10.00


class RideStatus(str, Enum):
    REQUESTED = "requested"
    ACCEPTED = "accepted"
    ARRIVING = "arriving"
    STARTED = "started"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class CarType(str, Enum):
    STANDARD = "standard"
    PREMIUM = "premium"
    VAN = "van"


def haversine_distance(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Calculate distance in km using Haversine formula."""
    R = 6371
    lat1_rad, lat2_rad = math.radians(lat1), math.radians(lat2)
    dlat, dlng = math.radians(lat2 - lat1), math.radians(lng2 - lng1)
    a = math.sin(dlat/2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(dlng/2)**2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))


def calculate_fare(distance_km: float, duration_minutes: float, car_type: str) -> dict:
    """Calculate ride fare based on distance, time, and car type."""
    pricing = PRICING.get(car_type, PRICING["standard"])
    
    distance_cost = distance_km * pricing["per_km"]
    time_cost = duration_minutes * pricing["per_minute"]
    total = pricing["base"] + distance_cost + time_cost
    total = max(total, pricing["min_fare"])
    
    driver_earnings = round(total * DRIVER_COMMISSION, 2)
    platform_fee = round(total * PLATFORM_COMMISSION, 2)
    
    return {
        "base_fare": pricing["base"],
        "distance_cost": round(distance_cost, 2),
        "time_cost": round(time_cost, 2),
        "total": round(total, 2),
        "driver_earnings": driver_earnings,
        "platform_fee": platform_fee,
    }


# ══════════════════════════════════════════════════════════════════════════════
# DRIVER REGISTRATION & MANAGEMENT
# ══════════════════════════════════════════════════════════════════════════════

class DriverRegisterRequest(BaseModel):
    car_brand: str
    car_model: str
    car_year: int = Field(..., ge=2010, le=2030)
    car_color: str
    license_plate: str
    car_type: str = "standard"  # standard, premium, van
    license_number: str


@router.post("/driver/register")
async def register_as_driver(req: DriverRegisterRequest, request: Request):
    """User applies to become a driver."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    # Check if already registered
    existing = await db.drivers.find_one({"user_id": user_id})
    if existing:
        raise HTTPException(status_code=400, detail="Du bist bereits als Fahrer registriert")
    
    # Check car type valid
    if req.car_type not in ["standard", "premium", "van"]:
        req.car_type = "standard"
    
    now = datetime.now(timezone.utc)
    driver_id = secrets.token_hex(8)
    
    driver = {
        "driver_id": driver_id,
        "user_id": user_id,
        "user_email": user.get("email", ""),
        "user_name": user.get("name", ""),
        "phone": user.get("phone", ""),
        "car": {
            "brand": req.car_brand,
            "model": req.car_model,
            "year": req.car_year,
            "color": req.car_color,
            "license_plate": req.license_plate,
            "type": req.car_type,
        },
        "license_number": req.license_number,
        "verified": False,  # Requires admin approval
        "status": "pending",  # pending, approved, rejected, suspended
        "online": False,
        "location": {"lat": 0, "lng": 0},
        "rating": 5.0,
        "total_rides": 0,
        "total_earnings": 0,
        "created_at": now.isoformat(),
    }
    
    await db.drivers.insert_one(driver)
    driver.pop("_id", None)
    
    # Update user role
    await db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {"is_driver": True, "driver_status": "pending"}}
    )
    
    logger.info(f"New driver registration: {user.get('email')}")
    return {
        "ok": True,
        "driver": driver,
        "message": "Registrierung eingereicht. Warte auf Admin-Freigabe.",
    }


@router.get("/driver/status")
async def get_driver_status(request: Request):
    """Get current user's driver status."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    driver = await db.drivers.find_one({"user_id": user_id}, {"_id": 0})
    if not driver:
        return {"is_driver": False, "driver": None}
    
    return {
        "is_driver": True,
        "driver": driver,
        "can_go_online": driver.get("verified") and driver.get("status") == "approved",
    }


@router.post("/driver/go-online")
async def driver_go_online(request: Request):
    """Driver goes online to receive ride requests."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    driver = await db.drivers.find_one({"user_id": user_id})
    if not driver:
        raise HTTPException(status_code=404, detail="Du bist kein registrierter Fahrer")
    
    if not driver.get("verified") or driver.get("status") != "approved":
        raise HTTPException(status_code=403, detail="Dein Fahrerkonto ist noch nicht freigegeben")
    
    await db.drivers.update_one(
        {"user_id": user_id},
        {"$set": {
            "online": True,
            "went_online_at": datetime.now(timezone.utc).isoformat(),
        }}
    )
    
    return {"ok": True, "online": True, "message": "Du bist jetzt online!"}


@router.post("/driver/go-offline")
async def driver_go_offline(request: Request):
    """Driver goes offline."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    driver = await db.drivers.find_one({"user_id": user_id})
    if not driver:
        raise HTTPException(status_code=404, detail="Du bist kein registrierter Fahrer")
    
    # Check no active ride
    active_ride = await db.taxi_rides.find_one({
        "driver_id": driver["driver_id"],
        "status": {"$in": ["accepted", "arriving", "started"]}
    })
    if active_ride:
        raise HTTPException(status_code=400, detail="Du hast noch eine aktive Fahrt")
    
    await db.drivers.update_one(
        {"user_id": user_id},
        {"$set": {"online": False}}
    )
    
    return {"ok": True, "online": False, "message": "Du bist jetzt offline"}


@router.post("/driver/update-location")
async def driver_update_location(request: Request):
    """Driver updates their current location."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    body = await request.json()
    lat = body.get("lat")
    lng = body.get("lng")
    
    if lat is None or lng is None:
        raise HTTPException(status_code=400, detail="lat and lng required")
    
    driver = await db.drivers.find_one({"user_id": user_id})
    if not driver:
        raise HTTPException(status_code=404, detail="Nicht als Fahrer registriert")
    
    now = datetime.now(timezone.utc)
    
    await db.drivers.update_one(
        {"user_id": user_id},
        {"$set": {
            "location": {"lat": lat, "lng": lng},
            "last_location_update": now.isoformat(),
        }}
    )
    
    # Also update active ride if any
    active_ride = await db.taxi_rides.find_one({
        "driver_id": driver["driver_id"],
        "status": {"$in": ["accepted", "arriving", "started"]}
    })
    if active_ride:
        await db.taxi_rides.update_one(
            {"ride_id": active_ride["ride_id"]},
            {"$set": {"driver_location": {"lat": lat, "lng": lng}}}
        )
    
    return {"ok": True}


# ══════════════════════════════════════════════════════════════════════════════
# CUSTOMER: GET NEARBY DRIVERS
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/drivers/nearby")
async def get_nearby_drivers(lat: float = 52.52, lng: float = 13.405, radius: float = 10.0, car_type: Optional[str] = None):
    """Get online drivers near location (public)."""
    
    query = {"online": True, "verified": True, "status": "approved"}
    if car_type:
        query["car.type"] = car_type
    
    drivers = await db.drivers.find(
        query,
        {"_id": 0, "license_number": 0, "user_email": 0}  # Hide sensitive data
    ).to_list(100)
    
    # Filter by distance
    nearby = []
    for d in drivers:
        loc = d.get("location", {})
        dlat, dlng = loc.get("lat", 0), loc.get("lng", 0)
        if dlat == 0 and dlng == 0:
            continue
        
        dist = haversine_distance(lat, lng, dlat, dlng)
        if dist <= radius:
            d["distance_km"] = round(dist, 2)
            d["eta_minutes"] = max(2, round(dist * 2.5))  # Rough ETA
            nearby.append(d)
    
    nearby.sort(key=lambda x: x["distance_km"])
    
    return {
        "drivers": nearby[:20],
        "total": len(nearby),
        "pricing": PRICING,
    }


# ══════════════════════════════════════════════════════════════════════════════
# CUSTOMER: BOOK RIDE
# ══════════════════════════════════════════════════════════════════════════════

class BookRideRequest(BaseModel):
    pickup_lat: float
    pickup_lng: float
    pickup_address: str = ""
    dropoff_lat: float
    dropoff_lng: float
    dropoff_address: str = ""
    car_type: str = "standard"


@router.post("/estimate")
async def get_ride_estimate(req: BookRideRequest):
    """Get price estimate for a ride (no auth required)."""
    
    distance_km = haversine_distance(req.pickup_lat, req.pickup_lng, req.dropoff_lat, req.dropoff_lng)
    
    # Estimate duration (rough: 30 km/h average in city)
    duration_minutes = (distance_km / 30) * 60
    duration_minutes = max(5, duration_minutes)
    
    fare = calculate_fare(distance_km, duration_minutes, req.car_type)
    
    return {
        "distance_km": round(distance_km, 2),
        "estimated_duration_minutes": round(duration_minutes),
        "fare_estimate": fare["total"],
        "fare_breakdown": fare,
        "car_type": req.car_type,
    }


@router.post("/book")
async def book_ride(req: BookRideRequest, request: Request):
    """Customer books a ride."""
    from core.payment_engine import TransactionType
    
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    # Check wallet balance
    balance = user.get("balance", 0)
    if balance < MIN_WALLET_BALANCE:
        raise HTTPException(
            status_code=400,
            detail=f"Mindestguthaben €{MIN_WALLET_BALANCE:.2f} erforderlich. Aktuell: €{balance:.2f}"
        )
    
    # Check no active ride
    active = await db.taxi_rides.find_one({
        "customer_id": user_id,
        "status": {"$in": ["requested", "accepted", "arriving", "started"]}
    })
    if active:
        raise HTTPException(status_code=400, detail="Du hast bereits eine aktive Fahrt")
    
    # Calculate estimate
    distance_km = haversine_distance(req.pickup_lat, req.pickup_lng, req.dropoff_lat, req.dropoff_lng)
    duration_minutes = max(5, (distance_km / 30) * 60)
    fare_estimate = calculate_fare(distance_km, duration_minutes, req.car_type)
    
    now = datetime.now(timezone.utc)
    ride_id = secrets.token_hex(8)
    
    ride = {
        "ride_id": ride_id,
        "customer_id": user_id,
        "customer_name": user.get("name", ""),
        "customer_phone": user.get("phone", ""),
        "driver_id": None,
        "driver_name": None,
        "pickup": {
            "lat": req.pickup_lat,
            "lng": req.pickup_lng,
            "address": req.pickup_address,
        },
        "dropoff": {
            "lat": req.dropoff_lat,
            "lng": req.dropoff_lng,
            "address": req.dropoff_address,
        },
        "car_type": req.car_type,
        "distance_km_estimate": round(distance_km, 2),
        "duration_estimate_minutes": round(duration_minutes),
        "fare_estimate": fare_estimate["total"],
        "status": RideStatus.REQUESTED.value,
        "created_at": now.isoformat(),
        "status_history": [{"status": "requested", "at": now.isoformat()}],
    }
    
    await db.taxi_rides.insert_one(ride)
    ride.pop("_id", None)
    
    # Find nearby drivers and notify them (in real app, use push notifications)
    nearby_drivers = await db.drivers.find({
        "online": True,
        "verified": True,
        "status": "approved",
        "car.type": req.car_type,
    }).to_list(20)
    
    # Filter by distance from pickup
    matching_drivers = []
    for d in nearby_drivers:
        loc = d.get("location", {})
        if loc.get("lat"):
            dist = haversine_distance(req.pickup_lat, req.pickup_lng, loc["lat"], loc["lng"])
            if dist <= 10:  # Within 10km
                matching_drivers.append({
                    "driver_id": d["driver_id"],
                    "distance_km": round(dist, 2),
                })
    
    return {
        "ok": True,
        "ride": ride,
        "matching_drivers": len(matching_drivers),
        "message": f"Fahrt angefragt. {len(matching_drivers)} Fahrer in der Nähe.",
    }


# ══════════════════════════════════════════════════════════════════════════════
# DRIVER: INCOMING REQUESTS
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/driver/requests")
async def get_driver_requests(request: Request):
    """Driver gets available ride requests near them."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    driver = await db.drivers.find_one({"user_id": user_id})
    if not driver:
        raise HTTPException(status_code=404, detail="Nicht als Fahrer registriert")
    
    if not driver.get("online"):
        return {"requests": [], "message": "Du bist offline"}
    
    loc = driver.get("location", {})
    if not loc.get("lat"):
        return {"requests": [], "message": "Standort nicht verfügbar"}
    
    # Find requested rides for driver's car type
    rides = await db.taxi_rides.find({
        "status": RideStatus.REQUESTED.value,
        "car_type": driver.get("car", {}).get("type", "standard"),
    }, {"_id": 0}).sort("created_at", -1).to_list(20)
    
    # Filter by distance
    nearby_requests = []
    for ride in rides:
        pickup = ride.get("pickup", {})
        if pickup.get("lat"):
            dist = haversine_distance(loc["lat"], loc["lng"], pickup["lat"], pickup["lng"])
            if dist <= 10:
                ride["distance_to_pickup_km"] = round(dist, 2)
                ride["eta_to_pickup_minutes"] = max(2, round(dist * 2.5))
                nearby_requests.append(ride)
    
    nearby_requests.sort(key=lambda x: x["distance_to_pickup_km"])
    
    return {"requests": nearby_requests[:10], "total": len(nearby_requests)}


@router.get("/driver/active")
async def get_driver_active_ride(request: Request):
    """Driver gets their current active ride."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    driver = await db.drivers.find_one({"user_id": user_id})
    if not driver:
        raise HTTPException(status_code=404, detail="Nicht als Fahrer registriert")
    
    ride = await db.taxi_rides.find_one({
        "driver_id": driver["driver_id"],
        "status": {"$in": ["accepted", "arriving", "started"]}
    }, {"_id": 0})
    
    if not ride:
        return {"has_active": False, "ride": None}
    
    return {"has_active": True, "ride": ride}


# ══════════════════════════════════════════════════════════════════════════════
# DRIVER: ACCEPT / REJECT RIDE
# ══════════════════════════════════════════════════════════════════════════════

class RideActionRequest(BaseModel):
    ride_id: str


@router.post("/driver/accept")
async def driver_accept_ride(req: RideActionRequest, request: Request):
    """Driver accepts a ride request."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    driver = await db.drivers.find_one({"user_id": user_id})
    if not driver:
        raise HTTPException(status_code=404, detail="Nicht als Fahrer registriert")
    
    if not driver.get("online"):
        raise HTTPException(status_code=400, detail="Du musst online sein")
    
    # Check driver doesn't have active ride
    active = await db.taxi_rides.find_one({
        "driver_id": driver["driver_id"],
        "status": {"$in": ["accepted", "arriving", "started"]}
    })
    if active:
        raise HTTPException(status_code=400, detail="Du hast bereits eine aktive Fahrt")
    
    # Get ride
    ride = await db.taxi_rides.find_one({"ride_id": req.ride_id})
    if not ride:
        raise HTTPException(status_code=404, detail="Fahrt nicht gefunden")
    
    if ride["status"] != RideStatus.REQUESTED.value:
        raise HTTPException(status_code=400, detail="Fahrt bereits vergeben oder abgesagt")
    
    now = datetime.now(timezone.utc)
    
    # Update ride
    await db.taxi_rides.update_one(
        {"ride_id": req.ride_id},
        {"$set": {
            "driver_id": driver["driver_id"],
            "driver_name": driver.get("user_name", ""),
            "driver_phone": driver.get("phone", ""),
            "driver_car": driver.get("car", {}),
            "driver_rating": driver.get("rating", 5.0),
            "driver_location": driver.get("location", {}),
            "status": RideStatus.ACCEPTED.value,
            "accepted_at": now.isoformat(),
        },
        "$push": {"status_history": {"status": "accepted", "at": now.isoformat()}}}
    )
    
    updated_ride = await db.taxi_rides.find_one({"ride_id": req.ride_id}, {"_id": 0})
    
    return {
        "ok": True,
        "ride": updated_ride,
        "message": "Fahrt angenommen!",
    }


@router.post("/driver/arriving")
async def driver_arriving(req: RideActionRequest, request: Request):
    """Driver signals they are arriving at pickup."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    driver = await db.drivers.find_one({"user_id": user_id})
    if not driver:
        raise HTTPException(status_code=404, detail="Nicht als Fahrer registriert")
    
    ride = await db.taxi_rides.find_one({"ride_id": req.ride_id, "driver_id": driver["driver_id"]})
    if not ride:
        raise HTTPException(status_code=404, detail="Fahrt nicht gefunden")
    
    if ride["status"] != RideStatus.ACCEPTED.value:
        raise HTTPException(status_code=400, detail="Ungültiger Status")
    
    now = datetime.now(timezone.utc)
    
    await db.taxi_rides.update_one(
        {"ride_id": req.ride_id},
        {"$set": {
            "status": RideStatus.ARRIVING.value,
            "arriving_at": now.isoformat(),
        },
        "$push": {"status_history": {"status": "arriving", "at": now.isoformat()}}}
    )
    
    return {"ok": True, "status": "arriving", "message": "Kunde wird benachrichtigt"}


@router.post("/driver/start")
async def driver_start_ride(req: RideActionRequest, request: Request):
    """Driver starts the ride (customer is in the car)."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    driver = await db.drivers.find_one({"user_id": user_id})
    if not driver:
        raise HTTPException(status_code=404, detail="Nicht als Fahrer registriert")
    
    ride = await db.taxi_rides.find_one({"ride_id": req.ride_id, "driver_id": driver["driver_id"]})
    if not ride:
        raise HTTPException(status_code=404, detail="Fahrt nicht gefunden")
    
    if ride["status"] not in [RideStatus.ACCEPTED.value, RideStatus.ARRIVING.value]:
        raise HTTPException(status_code=400, detail="Ungültiger Status")
    
    now = datetime.now(timezone.utc)
    
    await db.taxi_rides.update_one(
        {"ride_id": req.ride_id},
        {"$set": {
            "status": RideStatus.STARTED.value,
            "started_at": now.isoformat(),
            "start_location": driver.get("location", ride.get("pickup", {})),
        },
        "$push": {"status_history": {"status": "started", "at": now.isoformat()}}}
    )
    
    return {"ok": True, "status": "started", "message": "Fahrt gestartet"}


# ══════════════════════════════════════════════════════════════════════════════
# DRIVER: END RIDE & PAYMENT
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/driver/end")
async def driver_end_ride(req: RideActionRequest, request: Request):
    """Driver ends the ride and triggers payment."""
    from core.payment_engine import debit_wallet, credit_wallet, TransactionType
    
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    driver = await db.drivers.find_one({"user_id": user_id})
    if not driver:
        raise HTTPException(status_code=404, detail="Nicht als Fahrer registriert")
    
    ride = await db.taxi_rides.find_one({"ride_id": req.ride_id, "driver_id": driver["driver_id"]})
    if not ride:
        raise HTTPException(status_code=404, detail="Fahrt nicht gefunden")
    
    if ride["status"] != RideStatus.STARTED.value:
        raise HTTPException(status_code=400, detail="Fahrt noch nicht gestartet")
    
    now = datetime.now(timezone.utc)
    started_at = datetime.fromisoformat(ride["started_at"])
    
    # Calculate actual duration
    duration_seconds = (now - started_at).total_seconds()
    duration_minutes = max(1, duration_seconds / 60)
    
    # Calculate actual distance (from start to current driver location)
    start_loc = ride.get("start_location", ride.get("pickup", {}))
    end_loc = driver.get("location", ride.get("dropoff", {}))
    
    distance_km = ride.get("distance_km_estimate", 5)
    if start_loc.get("lat") and end_loc.get("lat"):
        distance_km = haversine_distance(
            start_loc["lat"], start_loc["lng"],
            end_loc["lat"], end_loc["lng"]
        )
        # Use at least the estimate if actual is much less (short route taken)
        distance_km = max(distance_km, ride.get("distance_km_estimate", 0) * 0.8)
    
    # Calculate final fare
    fare = calculate_fare(distance_km, duration_minutes, ride.get("car_type", "standard"))
    
    # Deduct from customer wallet
    customer_payment = await debit_wallet(
        user_id=ride["customer_id"],
        amount=fare["total"],
        tx_type=TransactionType.TAXI_PAYMENT,
        description=f"Taxi: {ride.get('pickup', {}).get('address', 'Abholung')} → {ride.get('dropoff', {}).get('address', 'Ziel')}",
        reference=f"TAXI-{req.ride_id[:8].upper()}",
        metadata={"ride_id": req.ride_id, "driver_id": driver["driver_id"]}
    )
    
    if not customer_payment.success:
        raise HTTPException(status_code=400, detail=f"Zahlung fehlgeschlagen: {customer_payment.error}")
    
    # Credit driver wallet
    driver_credit = await credit_wallet(
        user_id=driver["user_id"],
        amount=fare["driver_earnings"],
        tx_type=TransactionType.DRIVER_EARNINGS,
        description=f"Fahrt-Verdienst: {req.ride_id[:8].upper()}",
        reference=f"TAXI-EARN-{req.ride_id[:8].upper()}",
        source="taxi_ride",
        metadata={"ride_id": req.ride_id, "total_fare": fare["total"]}
    )
    
    # Update ride
    await db.taxi_rides.update_one(
        {"ride_id": req.ride_id},
        {"$set": {
            "status": RideStatus.COMPLETED.value,
            "ended_at": now.isoformat(),
            "end_location": end_loc,
            "actual_distance_km": round(distance_km, 2),
            "actual_duration_minutes": round(duration_minutes),
            "final_fare": fare["total"],
            "driver_earnings": fare["driver_earnings"],
            "platform_fee": fare["platform_fee"],
            "customer_payment_id": customer_payment.transaction_id,
            "driver_payment_id": driver_credit.transaction_id if driver_credit.success else None,
        },
        "$push": {"status_history": {"status": "completed", "at": now.isoformat()}}}
    )
    
    # Update driver stats
    await db.drivers.update_one(
        {"driver_id": driver["driver_id"]},
        {"$inc": {
            "total_rides": 1,
            "total_earnings": fare["driver_earnings"],
        }}
    )
    
    # Record platform revenue
    await db.platform_revenue.update_one(
        {"date": now.strftime("%Y-%m-%d")},
        {"$inc": {"total": fare["platform_fee"], "by_source.taxi_fees": fare["platform_fee"]}},
        upsert=True
    )
    
    return {
        "ok": True,
        "ride_summary": {
            "ride_id": req.ride_id,
            "distance_km": round(distance_km, 2),
            "duration_minutes": round(duration_minutes),
            "fare": fare,
        },
        "driver_earnings": fare["driver_earnings"],
        "message": f"Fahrt abgeschlossen! Verdienst: €{fare['driver_earnings']:.2f}",
    }


# ══════════════════════════════════════════════════════════════════════════════
# CUSTOMER: CANCEL RIDE
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/cancel")
async def cancel_ride(req: RideActionRequest, request: Request):
    """Customer or driver cancels a ride."""
    from core.payment_engine import debit_wallet, credit_wallet, TransactionType
    
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    ride = await db.taxi_rides.find_one({"ride_id": req.ride_id})
    if not ride:
        raise HTTPException(status_code=404, detail="Fahrt nicht gefunden")
    
    # Check if user is customer or driver
    is_customer = ride["customer_id"] == user_id
    driver = await db.drivers.find_one({"user_id": user_id})
    is_driver = driver and ride.get("driver_id") == driver.get("driver_id")
    
    if not is_customer and not is_driver:
        raise HTTPException(status_code=403, detail="Nicht autorisiert")
    
    if ride["status"] in [RideStatus.COMPLETED.value, RideStatus.CANCELLED.value]:
        raise HTTPException(status_code=400, detail="Fahrt bereits beendet")
    
    now = datetime.now(timezone.utc)
    cancelled_by = "customer" if is_customer else "driver"
    
    # Cancellation fee if ride was already accepted
    cancel_fee = 0
    if ride["status"] in [RideStatus.ACCEPTED.value, RideStatus.ARRIVING.value] and is_customer:
        cancel_fee = CANCELLATION_FEE
        # Charge customer
        await debit_wallet(
            user_id=ride["customer_id"],
            amount=cancel_fee,
            tx_type=TransactionType.TAXI_PAYMENT,
            description="Stornierungsgebühr",
            reference=f"TAXI-CANCEL-{req.ride_id[:8].upper()}",
            metadata={"ride_id": req.ride_id}
        )
        # Pay driver compensation (half of cancel fee)
        if ride.get("driver_id"):
            driver_user_id = (await db.drivers.find_one({"driver_id": ride["driver_id"]}))["user_id"]
            await credit_wallet(
                user_id=driver_user_id,
                amount=cancel_fee * 0.5,
                tx_type=TransactionType.DRIVER_EARNINGS,
                description="Stornierungsentschädigung",
                reference=f"TAXI-COMP-{req.ride_id[:8].upper()}",
                source="cancellation",
            )
    
    await db.taxi_rides.update_one(
        {"ride_id": req.ride_id},
        {"$set": {
            "status": RideStatus.CANCELLED.value,
            "cancelled_at": now.isoformat(),
            "cancelled_by": cancelled_by,
            "cancellation_fee": cancel_fee,
        },
        "$push": {"status_history": {"status": "cancelled", "at": now.isoformat(), "by": cancelled_by}}}
    )
    
    return {
        "ok": True,
        "status": "cancelled",
        "cancellation_fee": cancel_fee,
        "message": "Fahrt storniert" + (f" (Gebühr: €{cancel_fee:.2f})" if cancel_fee else ""),
    }


# ══════════════════════════════════════════════════════════════════════════════
# CUSTOMER: RIDE STATUS & HISTORY
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/rides/active")
async def get_customer_active_ride(request: Request):
    """Customer gets their active ride."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    ride = await db.taxi_rides.find_one({
        "customer_id": user_id,
        "status": {"$in": ["requested", "accepted", "arriving", "started"]}
    }, {"_id": 0})
    
    if not ride:
        return {"has_active": False, "rides": []}
    
    return {"has_active": True, "rides": [ride]}


@router.get("/rides/history")
async def get_ride_history(request: Request, limit: int = 20):
    """Customer gets ride history."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    rides = await db.taxi_rides.find(
        {"customer_id": user_id, "status": {"$in": ["completed", "cancelled"]}},
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    total_spent = sum(r.get("final_fare", 0) for r in rides if r.get("status") == "completed")
    
    return {
        "rides": rides,
        "total": len(rides),
        "stats": {"total_spent": round(total_spent, 2)},
    }


# ══════════════════════════════════════════════════════════════════════════════
# DRIVER: EARNINGS & HISTORY
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/driver/earnings")
async def get_driver_earnings(request: Request):
    """Driver gets their earnings summary."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    driver = await db.drivers.find_one({"user_id": user_id})
    if not driver:
        raise HTTPException(status_code=404, detail="Nicht als Fahrer registriert")
    
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = now - timedelta(days=7)
    
    # Get completed rides
    rides = await db.taxi_rides.find({
        "driver_id": driver["driver_id"],
        "status": "completed"
    }).to_list(500)
    
    today_earnings = sum(r.get("driver_earnings", 0) for r in rides 
                         if r.get("ended_at") and r["ended_at"] >= today_start.isoformat())
    week_earnings = sum(r.get("driver_earnings", 0) for r in rides 
                        if r.get("ended_at") and r["ended_at"] >= week_start.isoformat())
    
    return {
        "driver": {
            "driver_id": driver["driver_id"],
            "rating": driver.get("rating", 5.0),
            "total_rides": driver.get("total_rides", 0),
            "total_earnings": round(driver.get("total_earnings", 0), 2),
        },
        "earnings": {
            "today": round(today_earnings, 2),
            "this_week": round(week_earnings, 2),
            "total": round(driver.get("total_earnings", 0), 2),
        },
        "commission_rate": f"{DRIVER_COMMISSION * 100:.0f}%",
    }


# ══════════════════════════════════════════════════════════════════════════════
# ADMIN: DRIVER MANAGEMENT
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/admin/drivers")
async def admin_list_drivers(request: Request):
    """Admin: List all drivers."""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    
    drivers = await db.drivers.find({}, {"_id": 0}).to_list(200)
    
    stats = {
        "total": len(drivers),
        "pending": len([d for d in drivers if d.get("status") == "pending"]),
        "approved": len([d for d in drivers if d.get("status") == "approved"]),
        "online": len([d for d in drivers if d.get("online")]),
    }
    
    return {"drivers": drivers, "stats": stats}


@router.post("/admin/drivers/{driver_id}/approve")
async def admin_approve_driver(driver_id: str, request: Request):
    """Admin: Approve a driver."""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    
    driver = await db.drivers.find_one({"driver_id": driver_id})
    if not driver:
        raise HTTPException(status_code=404, detail="Fahrer nicht gefunden")
    
    await db.drivers.update_one(
        {"driver_id": driver_id},
        {"$set": {
            "status": "approved",
            "verified": True,
            "approved_at": datetime.now(timezone.utc).isoformat(),
            "approved_by": str(user["_id"]),
        }}
    )
    
    # Update user
    await db.users.update_one(
        {"_id": ObjectId(driver["user_id"])},
        {"$set": {"driver_status": "approved"}}
    )
    
    return {"ok": True, "message": "Fahrer freigegeben"}


@router.post("/admin/drivers/{driver_id}/suspend")
async def admin_suspend_driver(driver_id: str, request: Request):
    """Admin: Suspend a driver."""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    
    await db.drivers.update_one(
        {"driver_id": driver_id},
        {"$set": {"status": "suspended", "online": False}}
    )
    
    return {"ok": True, "message": "Fahrer gesperrt"}


@router.get("/pricing")
async def get_pricing():
    """Get current pricing (public)."""
    return {
        "pricing": PRICING,
        "commission": {
            "driver_percent": DRIVER_COMMISSION * 100,
            "platform_percent": PLATFORM_COMMISSION * 100,
        },
        "cancellation_fee": CANCELLATION_FEE,
        "min_wallet_balance": MIN_WALLET_BALANCE,
    }
