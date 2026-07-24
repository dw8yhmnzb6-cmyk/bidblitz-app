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
        "is_verified": True,
        "status": "active"
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


# ═══════════════════════════════════════════════════════════════════════════════
# MODELS
# ═══════════════════════════════════════════════════════════════════════════════

class LocationUpdate(BaseModel):
    lat: float = Field(..., ge=-90, le=90)
    lng: float = Field(..., ge=-180, le=180)


class RideStatusUpdate(BaseModel):
    status: str = Field(..., pattern="^(accepted|arriving|started|completed|canceled)$")


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
        {"_id": 0, "driver_id": 1, "is_verified": 1, "status": 1, "name": 1}
    )
    if not driver:
        return {"is_driver": False, "is_verified": False, "status": "not_registered"}
    return {
        "is_driver": True,
        "is_verified": bool(driver.get("is_verified")) and driver.get("status") == "active",
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
        "name": driver.get("name") or user.get("name"),
        "email": user.get("email"),
        "phone": driver.get("phone") or user.get("phone"),
        "avatar": user.get("avatar"),
        "vehicle": driver.get("vehicle", {}),
        "rating": round(float(driver.get("rating", 5.0)), 2),
        "is_verified": bool(driver.get("is_verified")),
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
        active_ride.pop("_id", None)
    
    # Get pending ride requests
    pending_requests = await db.taxi_ride_requests.find({
        "driver_id": driver["driver_id"],
        "status": "pending"
    }).sort("created_at", -1).to_list(10)
    
    for p in pending_requests:
        p.pop("_id", None)
    
    return {
        "driver_id": driver["driver_id"],
        "name": driver.get("name") or user.get("name"),
        "is_online": driver.get("is_online", False),
        "is_busy": active_ride is not None,
        "vehicle": driver.get("vehicle", {}),
        "rating": driver.get("rating", 5.0),
        "current_location": driver.get("current_location"),
        "earnings": {
            "today": round(today_earnings, 2),
            "today_rides": len(today_rides),
            "week": round(week_earnings, 2),
            "week_rides": len(week_rides),
            "total_rides": all_rides,
        },
        "active_ride": active_ride,
        "pending_requests": pending_requests,
        "balance": round(driver.get("balance", 0), 2),
    }


@router.post("/go-online")
async def go_online(location: LocationUpdate, request: Request):
    """Set driver status to online."""
    driver, _ = await get_verified_driver(request)
    
    await db.drivers.update_one(
        {"driver_id": driver["driver_id"]},
        {"$set": {
            "is_online": True,
            "current_location": {
                "lat": location.lat,
                "lng": location.lng,
                "updated_at": datetime.now(timezone.utc).isoformat()
            },
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
            }
        }}
    )
    
    return {"ok": True}


# ═══════════════════════════════════════════════════════════════════════════════
# RIDE REQUESTS
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/ride-requests")
async def get_ride_requests(request: Request):
    """Get pending ride requests for this driver."""
    driver, _ = await get_verified_driver(request)
    
    requests = await db.taxi_ride_requests.find({
        "driver_id": driver["driver_id"],
        "status": "pending"
    }).sort("created_at", -1).to_list(20)
    
    for r in requests:
        r.pop("_id", None)
    
    return {"requests": requests, "total": len(requests)}


@router.post("/ride-requests/{request_id}/accept")
async def accept_ride_request(request_id: str, request: Request):
    """Accept a ride request."""
    driver, _ = await get_verified_driver(request)
    
    # Find the request
    ride_req = await db.taxi_ride_requests.find_one({
        "request_id": request_id,
        "driver_id": driver["driver_id"],
        "status": "pending"
    })
    
    if not ride_req:
        raise HTTPException(status_code=404, detail="Anfrage nicht gefunden oder abgelaufen")
    
    now = datetime.now(timezone.utc)
    
    # Create the ride
    ride = {
        "ride_id": secrets.token_hex(8),
        "customer_id": ride_req["customer_id"],
        "driver_id": driver["driver_id"],
        "pickup": ride_req["pickup"],
        "destination": ride_req["destination"],
        "distance_km": ride_req.get("distance_km", 0),
        "estimated_fare": ride_req.get("estimated_fare", 0),
        "final_fare": None,
        "driver_earnings": None,
        "status": "accepted",
        "accepted_at": now.isoformat(),
        "arriving_at": None,
        "started_at": None,
        "completed_at": None,
        "canceled_at": None,
        "created_at": now.isoformat(),
    }
    
    await db.taxi_rides.insert_one(ride)
    
    # Update request status
    await db.taxi_ride_requests.update_one(
        {"request_id": request_id},
        {"$set": {"status": "accepted", "ride_id": ride["ride_id"]}}
    )
    
    # Set driver as busy
    await db.drivers.update_one(
        {"driver_id": driver["driver_id"]},
        {"$set": {"is_busy": True}}
    )
    
    # Notify customer
    await create_notification(
        ride_req["customer_id"],
        "Fahrer gefunden!",
        f"Dein Fahrer ist unterwegs. Geschätzte Ankunft: {ride_req.get('eta_minutes', 5)} Min.",
        "ride_accepted"
    )
    
    ride.pop("_id", None)
    return {"ok": True, "ride": ride, "message": "Fahrt angenommen!"}


@router.post("/ride-requests/{request_id}/reject")
async def reject_ride_request(request_id: str, request: Request):
    """Reject a ride request."""
    driver, _ = await get_verified_driver(request)
    
    result = await db.taxi_ride_requests.update_one(
        {"request_id": request_id, "driver_id": driver["driver_id"], "status": "pending"},
        {"$set": {"status": "rejected", "rejected_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Anfrage nicht gefunden")
    
    # TODO: Reassign to next driver
    
    return {"ok": True, "message": "Anfrage abgelehnt"}


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
    
    ride.pop("_id", None)
    
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
    """Update ride status."""
    driver, _ = await get_verified_driver(request)
    
    ride = await db.taxi_rides.find_one({
        "ride_id": ride_id,
        "driver_id": driver["driver_id"]
    })
    
    if not ride:
        raise HTTPException(status_code=404, detail="Fahrt nicht gefunden")
    
    now = datetime.now(timezone.utc)
    update_data = {"status": update.status}
    
    if update.status == "arriving":
        update_data["arriving_at"] = now.isoformat()
        await create_notification(
            ride["customer_id"],
            "Fahrer kommt an",
            "Dein Fahrer ist gleich da!",
            "driver_arriving"
        )
    
    elif update.status == "started":
        update_data["started_at"] = now.isoformat()
        await create_notification(
            ride["customer_id"],
            "Fahrt gestartet",
            "Gute Fahrt!",
            "ride_started"
        )
    
    elif update.status == "completed":
        update_data["completed_at"] = now.isoformat()
        
        # Calculate final fare (use estimated or actual)
        final_fare = ride.get("estimated_fare", 10.0)
        driver_earnings = round(final_fare * 0.80, 2)  # Driver gets 80%
        
        update_data["final_fare"] = final_fare
        update_data["driver_earnings"] = driver_earnings
        
        # Credit driver earnings to their WALLET (users.balance) — not driver-only field
        from bson import ObjectId
        driver_user_id = driver.get("user_id")
        if driver_user_id:
            try:
                await db.users.update_one(
                    {"_id": ObjectId(driver_user_id)},
                    {"$inc": {"balance": driver_earnings}}
                )
            except Exception:
                pass
            # Log driver earnings transaction in wallet
            await db.transactions.insert_one({
                "tx_id": secrets.token_hex(8),
                "user_id": driver_user_id,
                "type": "TAXI_EARNING",
                "amount": driver_earnings,
                "currency": "EUR",
                "status": "completed",
                "description": f"Taxi-Verdienst Fahrt #{ride_id[:8]}",
                "merchant_name": "BidBlitz Taxi",
                "category": "taxi",
                "reference": ride_id,
                "date": now.isoformat(),
                "created_at": now.isoformat()
            })
        
        # Update driver stats (cumulative counter + no longer busy)
        await db.drivers.update_one(
            {"driver_id": driver["driver_id"]},
            {
                "$inc": {"balance": driver_earnings, "total_rides": 1},
                "$set": {"is_busy": False}
            }
        )
        
        # Deduct from customer wallet
        try:
            await db.users.update_one(
                {"_id": ObjectId(ride["customer_id"])},
                {"$inc": {"balance": -final_fare}}
            )
        except Exception:
            pass
        
        # Create customer transaction
        await db.transactions.insert_one({
            "tx_id": secrets.token_hex(8),
            "user_id": ride["customer_id"],
            "type": "TAXI_RIDE",
            "amount": -final_fare,
            "currency": "EUR",
            "status": "completed",
            "description": f"Taxi Fahrt #{ride_id[:8]}",
            "merchant_name": "BidBlitz Taxi",
            "category": "taxi",
            "reference": ride_id,
            "date": now.isoformat(),
            "created_at": now.isoformat()
        })
        
        await create_notification(
            ride["customer_id"],
            "Fahrt beendet",
            f"Vielen Dank! Fahrpreis: €{final_fare:.2f}",
            "ride_completed"
        )
    
    elif update.status == "canceled":
        update_data["canceled_at"] = now.isoformat()
        await db.drivers.update_one(
            {"driver_id": driver["driver_id"]},
            {"$set": {"is_busy": False}}
        )
        await create_notification(
            ride["customer_id"],
            "Fahrt storniert",
            "Die Fahrt wurde storniert.",
            "ride_canceled"
        )
    
    await db.taxi_rides.update_one(
        {"ride_id": ride_id},
        {"$set": update_data}
    )
    
    return {"ok": True, "status": update.status}


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
    
    for r in rides:
        r.pop("_id", None)
    
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
    """Customer requests a ride - finds nearest driver."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    body = await request.json()
    pickup = body.get("pickup", {})
    destination = body.get("destination", {})
    
    if not pickup.get("lat") or not pickup.get("lng"):
        raise HTTPException(status_code=400, detail="Pickup location required")
    if not destination.get("lat") or not destination.get("lng"):
        raise HTTPException(status_code=400, detail="Destination required")
    
    # Calculate distance and fare
    distance = haversine(
        pickup["lat"], pickup["lng"],
        destination["lat"], destination["lng"]
    )
    base_fare = 3.50
    per_km = 1.80
    estimated_fare = round(base_fare + (distance * per_km), 2)
    
    # Check customer balance
    if user.get("balance", 0) < estimated_fare:
        raise HTTPException(status_code=400, detail="Nicht genug Guthaben")
    
    # Find nearest online drivers
    online_drivers = await db.drivers.find({
        "is_verified": True,
        "is_online": True,
        "is_busy": {"$ne": True},
        "status": "active",
        "current_location.lat": {"$exists": True}
    }).to_list(50)
    
    if not online_drivers:
        raise HTTPException(status_code=404, detail="Keine Fahrer verfügbar")
    
    # Sort by distance
    for d in online_drivers:
        loc = d.get("current_location", {})
        d["distance"] = haversine(
            pickup["lat"], pickup["lng"],
            loc.get("lat", 0), loc.get("lng", 0)
        )
    
    online_drivers.sort(key=lambda x: x.get("distance", 999))
    nearest = online_drivers[0]
    
    now = datetime.now(timezone.utc)
    eta = max(1, int(nearest["distance"] * 3))
    
    # Create ride request
    ride_request = {
        "request_id": secrets.token_hex(8),
        "customer_id": user_id,
        "driver_id": nearest["driver_id"],
        "pickup": pickup,
        "destination": destination,
        "distance_km": round(distance, 2),
        "estimated_fare": estimated_fare,
        "eta_minutes": eta,
        "status": "pending",
        "created_at": now.isoformat(),
        "expires_at": (now + timedelta(seconds=60)).isoformat()
    }
    
    await db.taxi_ride_requests.insert_one(ride_request)
    
    # Notify driver
    await create_notification(
        nearest.get("user_id", nearest["driver_id"]),
        "Neue Fahrtanfrage!",
        f"Entfernung: {nearest['distance']:.1f}km | Fahrpreis: €{estimated_fare:.2f}",
        "new_ride_request"
    )
    
    ride_request.pop("_id", None)
    
    return {
        "ok": True,
        "request": ride_request,
        "driver": {
            "name": nearest.get("name"),
            "vehicle": nearest.get("vehicle"),
            "rating": nearest.get("rating", 5.0),
            "eta_minutes": eta
        },
        "message": "Fahrer wird gesucht..."
    }
