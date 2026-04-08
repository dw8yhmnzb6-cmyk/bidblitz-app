"""
BidBlitz V2 - Scooter Sharing Module
Electric scooter rental with real-time availability, unlocking, and billing.
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

router = APIRouter(prefix="/api/scooter", tags=["Scooter"])

# ══════════════════════════════════════
# PRICING CONFIGURATION
# ══════════════════════════════════════
UNLOCK_FEE = 1.00
PER_MINUTE_RATE = 0.19
MAX_DAILY_CAP = 15.00
PAUSE_RATE = 0.05  # Per minute while paused
RESERVATION_FEE = 0.50
RESERVATION_MINUTES = 10

# Scooter models
SCOOTER_MODELS = [
    {"model": "BidBlitz S1", "max_speed": 20, "range_km": 25},
    {"model": "BidBlitz S2 Pro", "max_speed": 25, "range_km": 40},
    {"model": "BidBlitz X1", "max_speed": 20, "range_km": 30},
]

# Major German cities with coordinates for scooter placement
CITY_ZONES = {
    "berlin": {"lat": 52.52, "lng": 13.405, "name": "Berlin"},
    "munich": {"lat": 48.137, "lng": 11.576, "name": "München"},
    "hamburg": {"lat": 53.551, "lng": 9.993, "name": "Hamburg"},
    "cologne": {"lat": 50.937, "lng": 6.960, "name": "Köln"},
    "frankfurt": {"lat": 50.110, "lng": 8.682, "name": "Frankfurt"},
}


def generate_scooter(city: str = "berlin") -> dict:
    """Generate a simulated scooter."""
    zone = CITY_ZONES.get(city, CITY_ZONES["berlin"])
    model = random.choice(SCOOTER_MODELS)
    
    # Random position within city
    lat = zone["lat"] + random.uniform(-0.05, 0.05)
    lng = zone["lng"] + random.uniform(-0.05, 0.05)
    
    return {
        "scooter_id": f"SC-{secrets.token_hex(4).upper()}",
        "model": model["model"],
        "max_speed": model["max_speed"],
        "range_km": model["range_km"],
        "battery_percent": random.randint(20, 100),
        "location": {"lat": lat, "lng": lng},
        "status": "available",
        "city": city,
        "last_maintained": (datetime.now(timezone.utc) - timedelta(days=random.randint(1, 30))).isoformat(),
    }


# ══════════════════════════════════════
# MODELS
# ══════════════════════════════════════

class ScooterAction(BaseModel):
    scooter_id: str


class EndRideRequest(BaseModel):
    scooter_id: str
    end_location: Optional[dict] = None


# ══════════════════════════════════════
# GET NEARBY SCOOTERS
# ══════════════════════════════════════

@router.get("/nearby")
async def get_nearby_scooters(request: Request, lat: float = 52.52, lng: float = 13.405, radius: float = 2.0):
    """Get available scooters near a location."""
    user = await get_current_user(request)
    
    # Find city based on coordinates
    city = "berlin"
    min_dist = float("inf")
    for city_id, zone in CITY_ZONES.items():
        dist = math.sqrt((zone["lat"] - lat)**2 + (zone["lng"] - lng)**2)
        if dist < min_dist:
            min_dist = dist
            city = city_id
    
    # Get scooters from DB only - no auto-generation
    scooters = await db.scooters.find(
        {"city": city, "status": "available"},
        {"_id": 0}
    ).to_list(50)
    
    # Filter by radius
    nearby = []
    for s in scooters:
        loc = s.get("location", {})
        dist = math.sqrt((loc.get("lat", 0) - lat)**2 + (loc.get("lng", 0) - lng)**2) * 111
        if dist <= radius:
            s["distance_km"] = round(dist, 2)
            s["walk_minutes"] = round(dist * 12)  # ~5 km/h walking
            nearby.append(s)
    
    nearby.sort(key=lambda x: x["distance_km"])
    
    return {
        "scooters": nearby[:20],
        "total": len(nearby),
        "city": CITY_ZONES[city]["name"],
        "pricing": {
            "unlock_fee": UNLOCK_FEE,
            "per_minute": PER_MINUTE_RATE,
            "daily_cap": MAX_DAILY_CAP,
        }
    }


# ══════════════════════════════════════
# RESERVE SCOOTER
# ══════════════════════════════════════

@router.post("/reserve")
async def reserve_scooter(req: ScooterAction, request: Request):
    """Reserve a scooter for 10 minutes."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    # Check for existing active rental
    active = await db.scooter_rentals.find_one({
        "user_id": user_id,
        "status": {"$in": ["reserved", "active", "paused"]}
    })
    if active:
        raise HTTPException(status_code=400, detail="Du hast bereits eine aktive Miete")
    
    scooter = await db.scooters.find_one({"scooter_id": req.scooter_id, "status": "available"})
    if not scooter:
        raise HTTPException(status_code=404, detail="Scooter nicht verfügbar")
    
    # WALLET-ONLY: Check balance (BidBlitz closed ecosystem)
    current_balance = user.get("balance", 0)
    if current_balance < UNLOCK_FEE:
        raise HTTPException(
            status_code=400, 
            detail=f"Nicht genug Guthaben. Mindestens €{UNLOCK_FEE:.2f} erforderlich, du hast €{current_balance:.2f}. Bitte lade dein Wallet auf."
        )
    
    now = datetime.now(timezone.utc)
    expires = now + timedelta(minutes=RESERVATION_MINUTES)
    
    rental = {
        "rental_id": secrets.token_hex(8),
        "user_id": user_id,
        "user_name": user.get("name", ""),
        "scooter_id": req.scooter_id,
        "scooter_model": scooter.get("model", ""),
        "status": "reserved",
        "start_location": scooter.get("location"),
        "reserved_at": now.isoformat(),
        "reservation_expires": expires.isoformat(),
        "created_at": now.isoformat(),
    }
    
    await db.scooter_rentals.insert_one(rental)
    await db.scooters.update_one(
        {"scooter_id": req.scooter_id},
        {"$set": {"status": "reserved", "reserved_by": user_id}}
    )
    
    rental.pop("_id", None)
    
    return {
        "ok": True,
        "rental": rental,
        "expires_in_minutes": RESERVATION_MINUTES,
        "message": f"Scooter für {RESERVATION_MINUTES} Minuten reserviert",
    }


# ══════════════════════════════════════
# UNLOCK/START RIDE
# ══════════════════════════════════════

@router.post("/unlock")
async def unlock_scooter(req: ScooterAction, request: Request):
    """Unlock and start riding a scooter."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    # WALLET-ONLY: Check balance (BidBlitz closed ecosystem)
    current_balance = user.get("balance", 0)
    if current_balance < UNLOCK_FEE:
        raise HTTPException(
            status_code=400, 
            detail=f"Nicht genug Guthaben. Mindestens €{UNLOCK_FEE:.2f} erforderlich, du hast €{current_balance:.2f}. Bitte lade dein Wallet auf."
        )
    
    # Check for reservation or direct unlock
    rental = await db.scooter_rentals.find_one({
        "user_id": user_id,
        "scooter_id": req.scooter_id,
        "status": "reserved"
    })
    
    now = datetime.now(timezone.utc)
    
    if not rental:
        # Direct unlock - check if available
        scooter = await db.scooters.find_one({"scooter_id": req.scooter_id, "status": "available"})
        if not scooter:
            raise HTTPException(status_code=404, detail="Scooter nicht verfügbar")
        
        rental = {
            "rental_id": secrets.token_hex(8),
            "user_id": user_id,
            "user_name": user.get("name", ""),
            "scooter_id": req.scooter_id,
            "scooter_model": scooter.get("model", ""),
            "status": "active",
            "start_location": scooter.get("location"),
            "started_at": now.isoformat(),
            "created_at": now.isoformat(),
        }
        await db.scooter_rentals.insert_one(rental)
    else:
        # Upgrade reservation to active
        await db.scooter_rentals.update_one(
            {"rental_id": rental["rental_id"]},
            {"$set": {"status": "active", "started_at": now.isoformat()}}
        )
        rental["status"] = "active"
        rental["started_at"] = now.isoformat()
    
    # Charge unlock fee
    await db.users.update_one(
        {"_id": user["_id"]},
        {"$inc": {"balance": -UNLOCK_FEE}}
    )
    
    await db.transactions.insert_one({
        "id": secrets.token_hex(8),
        "user_id": user_id,
        "type": "payment",
        "amount": -UNLOCK_FEE,
        "description": f"Scooter Entsperrgebühr ({req.scooter_id})",
        "status": "completed",
        "reference": f"SCOOTER-UNLOCK-{rental.get('rental_id', '')[:8].upper()}",
        "category": "scooter",
        "created_at": now.isoformat(),
    })
    
    await db.scooters.update_one(
        {"scooter_id": req.scooter_id},
        {"$set": {"status": "in_use", "current_user": user_id}}
    )
    
    rental.pop("_id", None)
    scooter = await db.scooters.find_one({"scooter_id": req.scooter_id}, {"_id": 0})
    
    return {
        "ok": True,
        "rental": rental,
        "scooter": scooter,
        "unlock_fee": UNLOCK_FEE,
        "per_minute_rate": PER_MINUTE_RATE,
        "message": "Scooter entsperrt! Gute Fahrt!",
    }


# ══════════════════════════════════════
# PAUSE RIDE
# ══════════════════════════════════════

@router.post("/pause")
async def pause_ride(req: ScooterAction, request: Request):
    """Pause the current ride (reduced rate)."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    rental = await db.scooter_rentals.find_one({
        "user_id": user_id,
        "scooter_id": req.scooter_id,
        "status": "active"
    })
    
    if not rental:
        raise HTTPException(status_code=404, detail="Keine aktive Fahrt gefunden")
    
    now = datetime.now(timezone.utc)
    await db.scooter_rentals.update_one(
        {"rental_id": rental["rental_id"]},
        {"$set": {"status": "paused", "paused_at": now.isoformat()}}
    )
    
    return {
        "ok": True,
        "pause_rate": PAUSE_RATE,
        "message": f"Fahrt pausiert (€{PAUSE_RATE:.2f}/Min)",
    }


# ══════════════════════════════════════
# RESUME RIDE
# ══════════════════════════════════════

@router.post("/resume")
async def resume_ride(req: ScooterAction, request: Request):
    """Resume a paused ride."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    rental = await db.scooter_rentals.find_one({
        "user_id": user_id,
        "scooter_id": req.scooter_id,
        "status": "paused"
    })
    
    if not rental:
        raise HTTPException(status_code=404, detail="Keine pausierte Fahrt gefunden")
    
    # Calculate pause duration and cost
    paused_at = datetime.fromisoformat(rental["paused_at"])
    now = datetime.now(timezone.utc)
    pause_minutes = (now - paused_at).total_seconds() / 60
    pause_cost = round(pause_minutes * PAUSE_RATE, 2)
    
    await db.scooter_rentals.update_one(
        {"rental_id": rental["rental_id"]},
        {
            "$set": {"status": "active"},
            "$inc": {"pause_cost": pause_cost, "total_pause_minutes": pause_minutes},
            "$unset": {"paused_at": ""}
        }
    )
    
    return {
        "ok": True,
        "pause_duration_min": round(pause_minutes),
        "pause_cost": pause_cost,
        "message": "Fahrt fortgesetzt",
    }


# ══════════════════════════════════════
# END RIDE
# ══════════════════════════════════════

@router.post("/end")
async def end_ride(req: EndRideRequest, request: Request):
    """End the ride and process final payment."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    rental = await db.scooter_rentals.find_one({
        "user_id": user_id,
        "scooter_id": req.scooter_id,
        "status": {"$in": ["active", "paused"]}
    })
    
    if not rental:
        raise HTTPException(status_code=404, detail="Keine aktive Fahrt gefunden")
    
    now = datetime.now(timezone.utc)
    started_at = datetime.fromisoformat(rental["started_at"])
    
    # Calculate ride duration
    total_seconds = (now - started_at).total_seconds()
    total_minutes = total_seconds / 60
    
    # If paused, add remaining pause time
    pause_cost = rental.get("pause_cost", 0)
    if rental["status"] == "paused":
        paused_at = datetime.fromisoformat(rental["paused_at"])
        extra_pause = (now - paused_at).total_seconds() / 60
        pause_cost += round(extra_pause * PAUSE_RATE, 2)
    
    # Calculate ride cost (excluding pause time)
    active_minutes = total_minutes - rental.get("total_pause_minutes", 0)
    ride_cost = round(active_minutes * PER_MINUTE_RATE, 2)
    
    # Total (unlock already charged)
    total_cost = ride_cost + pause_cost
    total_cost = min(total_cost, MAX_DAILY_CAP - UNLOCK_FEE)  # Apply daily cap
    total_cost = max(0, total_cost)
    
    # Charge remaining
    if total_cost > 0:
        if user.get("balance", 0) < total_cost:
            # Allow negative balance for rides (will need top-up)
            pass
        
        await db.users.update_one(
            {"_id": user["_id"]},
            {"$inc": {"balance": -total_cost}}
        )
        
        await db.transactions.insert_one({
            "id": secrets.token_hex(8),
            "user_id": user_id,
            "type": "payment",
            "amount": -total_cost,
            "description": f"Scooter Fahrt ({round(total_minutes)} Min)",
            "status": "completed",
            "reference": f"SCOOTER-{rental['rental_id'][:8].upper()}",
            "category": "scooter",
            "created_at": now.isoformat(),
        })
    
    # Update rental
    end_location = req.end_location or rental.get("start_location", {})
    final_total = UNLOCK_FEE + total_cost
    
    await db.scooter_rentals.update_one(
        {"rental_id": rental["rental_id"]},
        {"$set": {
            "status": "completed",
            "ended_at": now.isoformat(),
            "end_location": end_location,
            "total_minutes": round(total_minutes),
            "active_minutes": round(active_minutes),
            "ride_cost": ride_cost,
            "pause_cost": pause_cost,
            "total_cost": final_total,
        }}
    )
    
    # Record platform revenue (100% platform-owned scooters)
    await db.platform_fees.insert_one({
        "type": "scooter",
        "rental_id": rental["rental_id"],
        "unlock_fee": UNLOCK_FEE,
        "ride_cost": ride_cost,
        "pause_cost": pause_cost,
        "total_revenue": final_total,
        "created_at": now.isoformat(),
    })
    
    # Make scooter available again
    await db.scooters.update_one(
        {"scooter_id": req.scooter_id},
        {"$set": {
            "status": "available",
            "location": end_location,
            "current_user": None,
            "reserved_by": None,
        }}
    )
    
    # Update user stats
    await db.users.update_one(
        {"_id": user["_id"]},
        {"$inc": {"scooter_rides_count": 1, "scooter_total_spent": UNLOCK_FEE + total_cost}}
    )
    
    updated_user = await db.users.find_one({"_id": user["_id"]})
    
    return {
        "ok": True,
        "summary": {
            "total_minutes": round(total_minutes),
            "active_minutes": round(active_minutes),
            "unlock_fee": UNLOCK_FEE,
            "ride_cost": ride_cost,
            "pause_cost": pause_cost,
            "total_cost": round(UNLOCK_FEE + total_cost, 2),
        },
        "new_balance": updated_user.get("balance", 0),
        "message": f"Fahrt beendet. Gesamt: €{UNLOCK_FEE + total_cost:.2f}",
    }


# ══════════════════════════════════════
# ACTIVE RENTAL
# ══════════════════════════════════════

@router.get("/active")
async def get_active_rental(request: Request):
    """Get user's current active scooter rental."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    rental = await db.scooter_rentals.find_one(
        {"user_id": user_id, "status": {"$in": ["reserved", "active", "paused"]}},
        {"_id": 0}
    )
    
    if rental and rental.get("started_at"):
        started = datetime.fromisoformat(rental["started_at"])
        now = datetime.now(timezone.utc)
        minutes = (now - started).total_seconds() / 60
        rental["current_duration_min"] = round(minutes)
        rental["current_cost_estimate"] = round(UNLOCK_FEE + minutes * PER_MINUTE_RATE, 2)
    
    scooter = None
    if rental:
        scooter = await db.scooters.find_one({"scooter_id": rental["scooter_id"]}, {"_id": 0})
    
    return {"has_active_rental": rental is not None, "rental": rental, "scooter": scooter}


# ══════════════════════════════════════
# RENTAL HISTORY
# ══════════════════════════════════════

@router.get("/history")
async def get_rental_history(request: Request, limit: int = 20):
    """Get user's scooter rental history."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    rentals = await db.scooter_rentals.find(
        {"user_id": user_id, "status": "completed"},
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    return {"rentals": rentals, "total": len(rentals)}


# ══════════════════════════════════════
# PRICING INFO
# ══════════════════════════════════════

@router.get("/pricing")
async def get_pricing():
    """Get scooter pricing information."""
    return {
        "unlock_fee": UNLOCK_FEE,
        "per_minute": PER_MINUTE_RATE,
        "pause_rate": PAUSE_RATE,
        "daily_cap": MAX_DAILY_CAP,
        "reservation_fee": RESERVATION_FEE,
        "reservation_minutes": RESERVATION_MINUTES,
    }



# ══════════════════════════════════════
# ADMIN: MANAGE SCOOTERS
# ══════════════════════════════════════

@router.post("/admin/add")
async def admin_add_scooter(request: Request):
    """Admin adds a new scooter to the fleet."""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Nur Admin")
    
    body = await request.json()
    
    scooter = {
        "scooter_id": f"SC-{secrets.token_hex(4).upper()}",
        "model": body.get("model", "BidBlitz E1"),
        "max_speed": body.get("max_speed", 20),
        "range_km": body.get("range_km", 45),
        "battery_percent": body.get("battery_percent", 100),
        "location": body.get("location", {"lat": 52.52, "lng": 13.405}),
        "status": "available",
        "city": body.get("city", "berlin"),
        "last_maintained": datetime.now(timezone.utc).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    
    await db.scooters.insert_one(scooter)
    scooter.pop("_id", None)
    
    return {"ok": True, "scooter": scooter}


@router.post("/admin/bulk-add")
async def admin_bulk_add_scooters(request: Request):
    """Admin adds multiple scooters."""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Nur Admin")
    
    body = await request.json()
    count = body.get("count", 10)
    city = body.get("city", "berlin")
    
    zone = CITY_ZONES.get(city, CITY_ZONES["berlin"])
    scooters = []
    
    for _ in range(min(count, 100)):
        model = random.choice(SCOOTER_MODELS)
        scooter = {
            "scooter_id": f"SC-{secrets.token_hex(4).upper()}",
            "model": model["model"],
            "max_speed": model["max_speed"],
            "range_km": model["range_km"],
            "battery_percent": random.randint(60, 100),
            "location": {
                "lat": zone["lat"] + random.uniform(-0.03, 0.03),
                "lng": zone["lng"] + random.uniform(-0.03, 0.03),
            },
            "status": "available",
            "city": city,
            "last_maintained": datetime.now(timezone.utc).isoformat(),
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        scooters.append(scooter)
    
    if scooters:
        await db.scooters.insert_many(scooters)
    
    return {"ok": True, "added": len(scooters)}


@router.get("/admin/list")
async def admin_list_scooters(request: Request, city: str = None, status: str = None):
    """Admin lists all scooters."""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Nur Admin")
    
    query = {}
    if city:
        query["city"] = city
    if status:
        query["status"] = status
    
    scooters = await db.scooters.find(query, {"_id": 0}).to_list(500)
    
    return {"scooters": scooters, "total": len(scooters)}


@router.post("/admin/update-status")
async def admin_update_scooter_status(request: Request):
    """Admin updates scooter status."""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Nur Admin")
    
    body = await request.json()
    scooter_id = body.get("scooter_id")
    new_status = body.get("status")
    
    if new_status not in ["available", "maintenance", "reserved", "in_use", "disabled"]:
        raise HTTPException(status_code=400, detail="Ungültiger Status")
    
    result = await db.scooters.update_one(
        {"scooter_id": scooter_id},
        {"$set": {"status": new_status, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Scooter nicht gefunden")
    
    return {"ok": True}
