"""
BidBlitz V2 - Taxi Module (Bolt/Uber Style)
Real-time ride booking, driver matching, fare calculation, trip tracking.
Full driver system, live tracking, admin management.
"""

import secrets
import math
import random
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from typing import Optional, List
from bson import ObjectId

from core.database import db
from core.security import get_current_user

router = APIRouter(prefix="/api/taxi", tags=["Taxi"])

# ══════════════════════════════════════
# FARE CONFIGURATION
# ══════════════════════════════════════
BASE_FARE = 2.50
PER_KM_RATE = 1.20
PER_MIN_RATE = 0.25
MIN_FARE = 5.00
SURGE_MULTIPLIER_HIGH = 1.5
SURGE_MULTIPLIER_PEAK = 2.0
CANCELLATION_FEE = 3.00
DRIVER_COMMISSION = 0.80  # Driver gets 80%

VEHICLE_TYPES = {
    "standard": {"name": "Standard", "multiplier": 1.0, "icon": "car", "capacity": 4, "description": "Günstige Alltagsfahrten"},
    "premium": {"name": "Premium", "multiplier": 1.5, "icon": "car-side", "capacity": 4, "description": "Komfort & Stil"},
    "van": {"name": "Van", "multiplier": 1.8, "icon": "van-shuttle", "capacity": 6, "description": "Für Gruppen & Gepäck"},
}

# Status flow
RIDE_STATUSES = ["requested", "accepted", "arriving", "started", "completed", "cancelled"]

# Simulated driver pool for demo
DEMO_DRIVERS = [
    {"name": "Stefan M.", "rating": 4.9, "rides": 2847, "vehicle": "VW Passat", "color": "Schwarz", "plate": "B-SM 4721"},
    {"name": "Anna K.", "rating": 4.8, "rides": 1923, "vehicle": "BMW 3er", "color": "Weiß", "plate": "B-AK 8834"},
    {"name": "Michael B.", "rating": 4.7, "rides": 3156, "vehicle": "Mercedes C-Klasse", "color": "Silber", "plate": "B-MB 2290"},
    {"name": "Sarah L.", "rating": 4.9, "rides": 1547, "vehicle": "Audi A4", "color": "Grau", "plate": "B-SL 6612"},
    {"name": "Thomas H.", "rating": 4.6, "rides": 4231, "vehicle": "Skoda Superb", "color": "Blau", "plate": "B-TH 1199"},
    {"name": "Julia W.", "rating": 4.8, "rides": 987, "vehicle": "Tesla Model 3", "color": "Weiß", "plate": "B-JW 3377"},
]


def calculate_distance(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Calculate distance in km using Haversine formula."""
    R = 6371  # Earth radius in km
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlng/2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    return R * c


def calculate_fare(distance_km: float, duration_min: float, vehicle_type: str, surge: float = 1.0) -> dict:
    """Calculate fare based on distance, duration, and vehicle type."""
    vtype = VEHICLE_TYPES.get(vehicle_type, VEHICLE_TYPES["standard"])
    multiplier = vtype["multiplier"]
    
    base = BASE_FARE
    distance_cost = distance_km * PER_KM_RATE
    time_cost = duration_min * PER_MIN_RATE
    
    subtotal = (base + distance_cost + time_cost) * multiplier * surge
    fare = max(subtotal, MIN_FARE)
    
    return {
        "base_fare": round(base, 2),
        "distance_cost": round(distance_cost * multiplier, 2),
        "time_cost": round(time_cost * multiplier, 2),
        "surge_multiplier": surge,
        "vehicle_multiplier": multiplier,
        "subtotal": round(subtotal, 2),
        "total": round(fare, 2),
        "driver_earnings": round(fare * DRIVER_COMMISSION, 2),
        "platform_fee": round(fare * (1 - DRIVER_COMMISSION), 2),
    }


def get_surge_multiplier() -> float:
    """Get current surge multiplier based on time."""
    hour = datetime.now().hour
    if 7 <= hour <= 9 or 17 <= hour <= 19:
        return SURGE_MULTIPLIER_HIGH
    elif 22 <= hour or hour <= 2:
        return SURGE_MULTIPLIER_PEAK
    return 1.0


# ══════════════════════════════════════
# MODELS
# ══════════════════════════════════════

class LocationPoint(BaseModel):
    lat: float
    lng: float
    address: str = ""


class EstimateRequest(BaseModel):
    pickup: LocationPoint
    dropoff: LocationPoint


class RideRequest(BaseModel):
    pickup: LocationPoint
    dropoff: LocationPoint
    vehicle_type: str = "standard"
    payment_method: str = "wallet"
    notes: Optional[str] = ""


class RideAction(BaseModel):
    ride_id: str


class DriverStatusUpdate(BaseModel):
    ride_id: str
    status: str
    location: Optional[LocationPoint] = None


# ══════════════════════════════════════
# RIDER: GET FARE ESTIMATES
# ══════════════════════════════════════

@router.post("/estimate")
async def get_fare_estimate(req: EstimateRequest, request: Request):
    """Get fare estimates for all vehicle types."""
    user = await get_current_user(request)
    
    # Calculate distance
    distance_km = calculate_distance(
        req.pickup.lat, req.pickup.lng,
        req.dropoff.lat, req.dropoff.lng
    )
    distance_km = max(1.0, min(distance_km, 100))
    
    # Estimate duration (avg 25 km/h in city)
    duration_min = (distance_km / 25) * 60
    duration_min = max(5, min(duration_min, 180))
    
    surge = get_surge_multiplier()
    
    estimates = []
    for vtype, vdata in VEHICLE_TYPES.items():
        fare = calculate_fare(distance_km, duration_min, vtype, surge)
        eta = random.randint(3, 12)
        estimates.append({
            "vehicle_type": vtype,
            "name": vdata["name"],
            "description": vdata["description"],
            "icon": vdata["icon"],
            "capacity": vdata["capacity"],
            "eta_minutes": eta,
            "fare": fare["total"],
            "fare_range": {
                "min": round(fare["total"] * 0.9, 2),
                "max": round(fare["total"] * 1.1, 2),
            },
            "fare_breakdown": fare,
        })
    
    return {
        "estimates": sorted(estimates, key=lambda x: x["fare"]),
        "route": {
            "distance_km": round(distance_km, 1),
            "duration_min": round(duration_min),
            "pickup": req.pickup.dict(),
            "dropoff": req.dropoff.dict(),
        },
        "surge": {
            "active": surge > 1.0,
            "multiplier": surge,
            "reason": "Hohe Nachfrage" if surge > 1.0 else None,
        },
    }


# ══════════════════════════════════════
# RIDER: BOOK RIDE
# ══════════════════════════════════════

@router.post("/book")
async def book_ride(req: RideRequest, request: Request):
    """Book a new ride."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    if req.vehicle_type not in VEHICLE_TYPES:
        raise HTTPException(status_code=400, detail="Ungültiger Fahrzeugtyp")
    
    # Check for active ride
    active = await db.taxi_rides.find_one({
        "user_id": user_id,
        "status": {"$in": ["requested", "accepted", "arriving", "started"]}
    })
    if active:
        raise HTTPException(status_code=400, detail="Du hast bereits eine aktive Fahrt")
    
    # Calculate fare
    distance_km = calculate_distance(
        req.pickup.lat, req.pickup.lng,
        req.dropoff.lat, req.dropoff.lng
    )
    distance_km = max(1.0, min(distance_km, 100))
    duration_min = max(5, min((distance_km / 25) * 60, 180))
    surge = get_surge_multiplier()
    fare = calculate_fare(distance_km, duration_min, req.vehicle_type, surge)
    
    # Check wallet balance
    if req.payment_method == "wallet":
        if user.get("balance", 0) < fare["total"]:
            raise HTTPException(status_code=400, detail=f"Nicht genug Guthaben. Benötigt: €{fare['total']:.2f}")
    
    now = datetime.now(timezone.utc)
    ride_id = secrets.token_hex(8)
    
    # Select a demo driver
    demo_driver = random.choice(DEMO_DRIVERS)
    driver = {
        "driver_id": secrets.token_hex(8),
        "name": demo_driver["name"],
        "rating": demo_driver["rating"],
        "total_rides": demo_driver["rides"],
        "vehicle": {
            "model": demo_driver["vehicle"],
            "color": demo_driver["color"],
            "plate": demo_driver["plate"],
            "type": req.vehicle_type,
        },
        "photo_url": f"https://randomuser.me/api/portraits/{'men' if random.random() > 0.4 else 'women'}/{random.randint(1, 99)}.jpg",
        "phone": f"+49 170 {random.randint(1000000, 9999999)}",
        "location": {
            "lat": req.pickup.lat + random.uniform(-0.01, 0.01),
            "lng": req.pickup.lng + random.uniform(-0.01, 0.01),
        },
        "eta_minutes": random.randint(3, 8),
    }
    
    ride = {
        "ride_id": ride_id,
        "user_id": user_id,
        "user_name": user.get("name", ""),
        "user_email": user.get("email", ""),
        "user_phone": user.get("phone", ""),
        "pickup": req.pickup.dict(),
        "dropoff": req.dropoff.dict(),
        "vehicle_type": req.vehicle_type,
        "vehicle_name": VEHICLE_TYPES[req.vehicle_type]["name"],
        "payment_method": req.payment_method,
        "status": "requested",
        "driver": None,
        "fare_estimate": fare["total"],
        "fare_breakdown": fare,
        "distance_km": round(distance_km, 1),
        "duration_min": round(duration_min),
        "surge_multiplier": surge,
        "notes": req.notes,
        "created_at": now.isoformat(),
        "updated_at": now.isoformat(),
        "status_history": [{"status": "requested", "at": now.isoformat()}],
    }
    
    await db.taxi_rides.insert_one(ride)
    ride.pop("_id", None)
    
    # Find nearest available real driver
    from math import radians, cos, sin, sqrt, atan2
    
    def haversine(lat1, lon1, lat2, lon2):
        R = 6371
        dlat = radians(lat2 - lat1)
        dlon = radians(lon2 - lon1)
        a = sin(dlat/2)**2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon/2)**2
        return R * 2 * atan2(sqrt(a), sqrt(1-a))
    
    # Find online, verified drivers with matching vehicle type
    available_drivers = await db.drivers.find({
        "is_online": True,
        "is_verified": True,
        "status": "active",
        "current_ride_id": None,
        "vehicle.type": req.vehicle_type,
        "current_location": {"$ne": None},
    }, {"_id": 0, "password_hash": 0, "documents": 0}).to_list(20)
    
    # Sort by distance to pickup
    for d in available_drivers:
        loc = d.get("current_location", {})
        if loc:
            d["distance_km"] = haversine(req.pickup.lat, req.pickup.lng, loc.get("lat", 0), loc.get("lng", 0))
    
    available_drivers.sort(key=lambda x: x.get("distance_km", 999))
    
    # Return ride - driver assignment happens asynchronously via driver app
    # If no drivers available, ride stays in "requested" status
    if available_drivers:
        ride["nearby_drivers"] = len(available_drivers)
        ride["estimated_wait"] = max(2, int(available_drivers[0].get("distance_km", 5) * 2))
    else:
        ride["nearby_drivers"] = 0
        ride["estimated_wait"] = None
        ride["no_drivers_available"] = True
    
    return {
        "ok": True,
        "ride": ride,
        "message": "Fahrt angefragt. Wir suchen einen Fahrer für dich." if not ride.get("no_drivers_available") else "Keine Fahrer verfügbar. Bitte später erneut versuchen.",
    }


# ══════════════════════════════════════
# RIDER: GET RIDE STATUS
# ══════════════════════════════════════

@router.get("/ride/{ride_id}")
async def get_ride_status(ride_id: str, request: Request):
    """Get current ride status with live tracking."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    ride = await db.taxi_rides.find_one({"ride_id": ride_id}, {"_id": 0})
    if not ride:
        raise HTTPException(status_code=404, detail="Fahrt nicht gefunden")
    
    # Allow access for rider or driver
    if ride["user_id"] != user_id and ride.get("driver", {}).get("driver_id") != user_id:
        # Check if admin
        if user.get("role") != "admin":
            raise HTTPException(status_code=403, detail="Kein Zugriff")
    
    # Simulate driver movement for demo
    if ride["status"] in ["accepted", "arriving"] and ride.get("driver"):
        driver_loc = ride["driver"].get("location", {})
        pickup = ride["pickup"]
        
        # Move driver towards pickup
        progress = random.uniform(0.1, 0.3)
        new_lat = driver_loc.get("lat", pickup["lat"]) + (pickup["lat"] - driver_loc.get("lat", pickup["lat"])) * progress
        new_lng = driver_loc.get("lng", pickup["lng"]) + (pickup["lng"] - driver_loc.get("lng", pickup["lng"])) * progress
        
        ride["driver"]["location"] = {"lat": new_lat, "lng": new_lng}
        ride["driver"]["eta_minutes"] = max(1, ride["driver"].get("eta_minutes", 5) - 1)
    
    return {"ride": ride}


# ══════════════════════════════════════
# RIDER: CANCEL RIDE
# ══════════════════════════════════════

@router.post("/cancel")
async def cancel_ride(req: RideAction, request: Request):
    """Cancel an active ride."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    ride = await db.taxi_rides.find_one({"ride_id": req.ride_id, "user_id": user_id})
    if not ride:
        raise HTTPException(status_code=404, detail="Fahrt nicht gefunden")
    
    if ride["status"] in ("completed", "cancelled"):
        raise HTTPException(status_code=400, detail="Fahrt bereits beendet")
    
    # Cancellation fee if driver already en route
    cancel_fee = 0
    if ride["status"] in ("accepted", "arriving"):
        cancel_fee = CANCELLATION_FEE
        if user.get("balance", 0) >= cancel_fee:
            await db.users.update_one(
                {"_id": user["_id"]},
                {"$inc": {"balance": -cancel_fee}}
            )
            await db.transactions.insert_one({
                "id": secrets.token_hex(8),
                "user_id": user_id,
                "type": "payment",
                "amount": -cancel_fee,
                "description": "Taxi Stornierungsgebühr",
                "status": "completed",
                "reference": f"TAXI-CANCEL-{req.ride_id[:8].upper()}",
                "category": "taxi",
                "created_at": datetime.now(timezone.utc).isoformat(),
            })
    
    now = datetime.now(timezone.utc)
    status_history = ride.get("status_history", [])
    status_history.append({"status": "cancelled", "at": now.isoformat(), "by": "rider"})
    
    await db.taxi_rides.update_one(
        {"ride_id": req.ride_id},
        {"$set": {
            "status": "cancelled",
            "cancel_fee": cancel_fee,
            "cancelled_at": now.isoformat(),
            "cancelled_by": "rider",
            "status_history": status_history,
            "updated_at": now.isoformat(),
        }}
    )
    
    return {
        "ok": True,
        "cancel_fee": cancel_fee,
        "message": "Fahrt storniert" + (f" (Gebühr: €{cancel_fee:.2f})" if cancel_fee else ""),
    }


# ══════════════════════════════════════
# RIDER: COMPLETE RIDE (Simulation/Demo)
# ══════════════════════════════════════

@router.post("/complete")
async def complete_ride(request: Request):
    """Complete an active ride (for demo/simulation purposes)."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    body = await request.json()
    
    ride_id = body.get("ride_id")
    if not ride_id:
        raise HTTPException(status_code=400, detail="ride_id erforderlich")
    
    ride = await db.taxi_rides.find_one({"ride_id": ride_id, "user_id": user_id})
    if not ride:
        raise HTTPException(status_code=404, detail="Fahrt nicht gefunden")
    
    if ride["status"] in ("completed", "cancelled"):
        raise HTTPException(status_code=400, detail="Fahrt bereits beendet")
    
    now = datetime.now(timezone.utc)
    fare = ride.get("fare_estimate", 10.0)
    
    # Deduct fare from wallet
    current_balance = user.get("balance", 0)
    if current_balance < fare:
        raise HTTPException(status_code=400, detail=f"Nicht genug Guthaben. Benötigt: €{fare:.2f}")
    
    await db.users.update_one(
        {"_id": user["_id"]},
        {"$inc": {"balance": -fare}}
    )
    
    # Create transaction
    await db.transactions.insert_one({
        "id": secrets.token_hex(8),
        "user_id": user_id,
        "type": "payment",
        "amount": -fare,
        "description": f"Taxi: {ride.get('pickup', {}).get('address', '?')} → {ride.get('dropoff', {}).get('address', '?')}",
        "status": "completed",
        "reference": f"TAXI-{ride_id[:8].upper()}",
        "category": "taxi",
        "created_at": now.isoformat(),
    })
    
    # Update ride status
    status_history = ride.get("status_history", [])
    status_history.append({"status": "completed", "at": now.isoformat()})
    
    await db.taxi_rides.update_one(
        {"ride_id": ride_id},
        {"$set": {
            "status": "completed",
            "final_fare": fare,
            "completed_at": now.isoformat(),
            "status_history": status_history,
            "updated_at": now.isoformat(),
        }}
    )
    
    new_balance = current_balance - fare
    
    return {
        "ok": True,
        "final_fare": fare,
        "new_balance": round(new_balance, 2),
        "message": f"Fahrt abgeschlossen. €{fare:.2f} abgebucht.",
    }


# ══════════════════════════════════════
# RIDER: GET ACTIVE RIDE
# ══════════════════════════════════════

@router.get("/active")
async def get_active_ride(request: Request):
    """Get user's current active ride."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    ride = await db.taxi_rides.find_one(
        {"user_id": user_id, "status": {"$in": ["requested", "accepted", "arriving", "started"]}},
        {"_id": 0}
    )
    
    return {"has_active_ride": ride is not None, "ride": ride}


# ══════════════════════════════════════
# RIDER: RIDE HISTORY
# ══════════════════════════════════════

@router.get("/history")
async def get_ride_history(request: Request, limit: int = 20):
    """Get user's ride history."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    rides = await db.taxi_rides.find(
        {"user_id": user_id},
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    stats = {
        "total_rides": len(rides),
        "total_spent": sum(r.get("final_fare", r.get("fare_estimate", 0)) for r in rides if r["status"] == "completed"),
        "total_distance": sum(r.get("distance_km", 0) for r in rides if r["status"] == "completed"),
    }
    
    return {"rides": rides, "stats": stats}


# ══════════════════════════════════════
# RIDER: RATE RIDE
# ══════════════════════════════════════

@router.post("/rate")
async def rate_ride(request: Request):
    """Rate a completed ride."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    body = await request.json()
    
    ride_id = body.get("ride_id")
    rating = body.get("rating", 5)
    comment = body.get("comment", "")
    tip = body.get("tip", 0)
    
    if not 1 <= rating <= 5:
        raise HTTPException(status_code=400, detail="Bewertung muss 1-5 sein")
    
    ride = await db.taxi_rides.find_one({"ride_id": ride_id, "user_id": user_id})
    if not ride:
        raise HTTPException(status_code=404, detail="Fahrt nicht gefunden")
    
    if ride["status"] != "completed":
        raise HTTPException(status_code=400, detail="Nur abgeschlossene Fahrten bewerten")
    
    # Process tip
    if tip > 0:
        if user.get("balance", 0) >= tip:
            await db.users.update_one(
                {"_id": user["_id"]},
                {"$inc": {"balance": -tip}}
            )
            await db.transactions.insert_one({
                "id": secrets.token_hex(8),
                "user_id": user_id,
                "type": "payment",
                "amount": -tip,
                "description": f"Trinkgeld für {ride['driver']['name']}",
                "status": "completed",
                "reference": f"TAXI-TIP-{ride_id[:8].upper()}",
                "category": "taxi",
                "created_at": datetime.now(timezone.utc).isoformat(),
            })
    
    await db.taxi_rides.update_one(
        {"ride_id": ride_id},
        {"$set": {
            "user_rating": rating,
            "user_comment": comment,
            "tip": tip,
            "rated_at": datetime.now(timezone.utc).isoformat(),
        }}
    )
    
    return {"ok": True, "message": "Bewertung gespeichert"}


# ══════════════════════════════════════
# DRIVER: UPDATE STATUS
# ══════════════════════════════════════

@router.post("/driver/status")
async def driver_update_status(req: DriverStatusUpdate, request: Request):
    """Driver updates ride status."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    ride = await db.taxi_rides.find_one({"ride_id": req.ride_id})
    if not ride:
        raise HTTPException(status_code=404, detail="Fahrt nicht gefunden")
    
    # Validate status transition
    current = ride["status"]
    valid_transitions = {
        "accepted": ["arriving", "cancelled"],
        "arriving": ["started", "cancelled"],
        "started": ["completed"],
    }
    
    if req.status not in valid_transitions.get(current, []):
        raise HTTPException(status_code=400, detail=f"Ungültiger Statuswechsel: {current} → {req.status}")
    
    now = datetime.now(timezone.utc)
    update = {
        "status": req.status,
        "updated_at": now.isoformat(),
    }
    
    status_history = ride.get("status_history", [])
    status_history.append({"status": req.status, "at": now.isoformat()})
    update["status_history"] = status_history
    
    if req.location:
        update["driver.location"] = req.location.dict()
    
    if req.status == "arriving":
        update["arriving_at"] = now.isoformat()
    elif req.status == "started":
        update["started_at"] = now.isoformat()
    elif req.status == "completed":
        update["completed_at"] = now.isoformat()
        
        # Calculate final fare
        started = datetime.fromisoformat(ride["started_at"]) if ride.get("started_at") else now
        actual_duration = (now - started).total_seconds() / 60
        
        fare = calculate_fare(
            ride["distance_km"],
            actual_duration,
            ride["vehicle_type"],
            ride.get("surge_multiplier", 1.0)
        )
        update["final_fare"] = fare["total"]
        update["actual_duration_min"] = round(actual_duration)
        
        # Charge rider
        if ride["payment_method"] == "wallet":
            rider = await db.users.find_one({"_id": ObjectId(ride["user_id"])})
            if rider:
                await db.users.update_one(
                    {"_id": ObjectId(ride["user_id"])},
                    {"$inc": {"balance": -fare["total"]}}
                )
                await db.transactions.insert_one({
                    "id": secrets.token_hex(8),
                    "user_id": ride["user_id"],
                    "type": "payment",
                    "amount": -fare["total"],
                    "description": f"Taxi: {ride['pickup'].get('address', '')[:20]} → {ride['dropoff'].get('address', '')[:20]}",
                    "status": "completed",
                    "reference": f"TAXI-{req.ride_id[:8].upper()}",
                    "category": "taxi",
                    "merchant_name": f"Taxi ({ride['driver']['name']})",
                    "created_at": now.isoformat(),
                })
    elif req.status == "cancelled":
        update["cancelled_at"] = now.isoformat()
        update["cancelled_by"] = "driver"
    
    await db.taxi_rides.update_one({"ride_id": req.ride_id}, {"$set": update})
    
    updated_ride = await db.taxi_rides.find_one({"ride_id": req.ride_id}, {"_id": 0})
    
    return {"ok": True, "ride": updated_ride}


# ══════════════════════════════════════
# DRIVER: GET ASSIGNED RIDES
# ══════════════════════════════════════

@router.get("/driver/rides")
async def get_driver_rides(request: Request, status: str = ""):
    """Get rides assigned to driver."""
    user = await get_current_user(request)
    
    # For demo, show all non-completed rides
    query = {"status": {"$in": ["requested", "accepted", "arriving", "started"]}}
    if status:
        query["status"] = status
    
    rides = await db.taxi_rides.find(query, {"_id": 0}).sort("created_at", -1).limit(20).to_list(20)
    
    return {"rides": rides}


# ══════════════════════════════════════
# DRIVER: ACCEPT RIDE
# ══════════════════════════════════════

@router.post("/driver/accept")
async def driver_accept_ride(req: RideAction, request: Request):
    """Driver accepts a ride request."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    ride = await db.taxi_rides.find_one({"ride_id": req.ride_id, "status": "requested"})
    if not ride:
        raise HTTPException(status_code=404, detail="Fahrt nicht verfügbar")
    
    now = datetime.now(timezone.utc)
    
    driver = {
        "driver_id": user_id,
        "name": user.get("name", "Fahrer"),
        "rating": user.get("driver_rating", 4.8),
        "total_rides": user.get("driver_rides", 0),
        "vehicle": user.get("driver_vehicle", {
            "model": "Unbekannt",
            "color": "Unbekannt",
            "plate": "Unbekannt",
            "type": ride["vehicle_type"],
        }),
        "photo_url": user.get("photo_url", ""),
        "phone": user.get("phone", ""),
        "location": {"lat": ride["pickup"]["lat"], "lng": ride["pickup"]["lng"]},
        "eta_minutes": random.randint(3, 8),
    }
    
    status_history = ride.get("status_history", [])
    status_history.append({"status": "accepted", "at": now.isoformat()})
    
    await db.taxi_rides.update_one(
        {"ride_id": req.ride_id},
        {"$set": {
            "driver": driver,
            "status": "accepted",
            "accepted_at": now.isoformat(),
            "status_history": status_history,
            "updated_at": now.isoformat(),
        }}
    )
    
    updated_ride = await db.taxi_rides.find_one({"ride_id": req.ride_id}, {"_id": 0})
    
    return {"ok": True, "ride": updated_ride}


# ══════════════════════════════════════
# VEHICLE TYPES
# ══════════════════════════════════════

@router.get("/vehicle-types")
async def get_vehicle_types():
    """Get available vehicle types."""
    types = []
    for vtype, data in VEHICLE_TYPES.items():
        types.append({
            "id": vtype,
            "name": data["name"],
            "description": data["description"],
            "icon": data["icon"],
            "capacity": data["capacity"],
            "multiplier": data["multiplier"],
        })
    return {"vehicle_types": types}


# ══════════════════════════════════════
# ADMIN: LIST ALL RIDES
# ══════════════════════════════════════

@router.get("/admin/rides")
async def admin_list_rides(request: Request, status: str = "", limit: int = 50):
    """Admin: List all rides."""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    
    query = {}
    if status:
        query["status"] = status
    
    rides = await db.taxi_rides.find(query, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    
    # Stats
    total = await db.taxi_rides.count_documents({})
    active = await db.taxi_rides.count_documents({"status": {"$in": ["requested", "accepted", "arriving", "started"]}})
    completed = await db.taxi_rides.count_documents({"status": "completed"})
    cancelled = await db.taxi_rides.count_documents({"status": "cancelled"})
    
    return {
        "rides": rides,
        "stats": {
            "total": total,
            "active": active,
            "completed": completed,
            "cancelled": cancelled,
        }
    }


# ══════════════════════════════════════
# ADMIN: CANCEL RIDE
# ══════════════════════════════════════

@router.post("/admin/cancel")
async def admin_cancel_ride(req: RideAction, request: Request):
    """Admin: Force cancel a ride."""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    
    ride = await db.taxi_rides.find_one({"ride_id": req.ride_id})
    if not ride:
        raise HTTPException(status_code=404, detail="Fahrt nicht gefunden")
    
    if ride["status"] in ("completed", "cancelled"):
        raise HTTPException(status_code=400, detail="Fahrt bereits beendet")
    
    now = datetime.now(timezone.utc)
    status_history = ride.get("status_history", [])
    status_history.append({"status": "cancelled", "at": now.isoformat(), "by": "admin"})
    
    await db.taxi_rides.update_one(
        {"ride_id": req.ride_id},
        {"$set": {
            "status": "cancelled",
            "cancelled_at": now.isoformat(),
            "cancelled_by": "admin",
            "status_history": status_history,
            "updated_at": now.isoformat(),
        }}
    )
    
    return {"ok": True, "message": "Fahrt storniert"}


# ══════════════════════════════════════
# ADMIN: MANAGE DRIVERS (placeholder)
# ══════════════════════════════════════

@router.get("/admin/drivers")
async def admin_list_drivers(request: Request):
    """Admin: List registered drivers."""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    
    # In production, this would query actual driver records
    drivers = await db.users.find(
        {"is_driver": True},
        {"_id": 0, "password_hash": 0}
    ).limit(50).to_list(50)
    
    # For demo, return sample drivers
    if not drivers:
        drivers = [
            {**d, "driver_id": secrets.token_hex(8), "status": "online", "current_ride": None}
            for d in DEMO_DRIVERS
        ]
    
    return {"drivers": drivers}


# ══════════════════════════════════════
# PRICING INFO
# ══════════════════════════════════════

@router.get("/pricing")
async def get_pricing():
    """Get taxi pricing information."""
    return {
        "base_fare": BASE_FARE,
        "per_km": PER_KM_RATE,
        "per_min": PER_MIN_RATE,
        "min_fare": MIN_FARE,
        "cancellation_fee": CANCELLATION_FEE,
        "surge": {
            "high": SURGE_MULTIPLIER_HIGH,
            "peak": SURGE_MULTIPLIER_PEAK,
            "current": get_surge_multiplier(),
        },
        "vehicle_types": VEHICLE_TYPES,
    }
