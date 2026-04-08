"""
BidBlitz V2 - Real Driver Management System
Handles driver registration, verification, and availability.
"""

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime, timezone
from bson import ObjectId
from core.database import db
from core.security import get_current_user, hash_password
import secrets

router = APIRouter(prefix="/api/drivers", tags=["drivers"])


# ══════════════════════════════════════
# MODELS
# ══════════════════════════════════════

class DriverRegistration(BaseModel):
    email: EmailStr
    password: str
    name: str
    phone: str
    vehicle_model: str
    vehicle_color: str
    vehicle_plate: str
    vehicle_type: str = "standard"  # standard, comfort, xl
    city: str = "berlin"


class DriverStatusUpdate(BaseModel):
    is_online: bool
    location: Optional[dict] = None


class DriverLocation(BaseModel):
    lat: float
    lng: float


# ══════════════════════════════════════
# DRIVER REGISTRATION
# ══════════════════════════════════════

@router.post("/register")
async def register_driver(req: DriverRegistration):
    """Register as a new driver (requires KYC approval)."""
    email = req.email.lower().strip()
    
    # Check if email already exists
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Email bereits registriert")
    
    existing_driver = await db.drivers.find_one({"email": email})
    if existing_driver:
        raise HTTPException(status_code=400, detail="Fahrer bereits registriert")
    
    now = datetime.now(timezone.utc).isoformat()
    driver_id = secrets.token_hex(8)
    
    driver_doc = {
        "driver_id": driver_id,
        "email": email,
        "password_hash": hash_password(req.password),
        "name": req.name,
        "phone": req.phone,
        "vehicle": {
            "model": req.vehicle_model,
            "color": req.vehicle_color,
            "plate": req.vehicle_plate.upper(),
            "type": req.vehicle_type,
        },
        "city": req.city,
        "status": "pending_verification",  # pending_verification, active, suspended, inactive
        "is_online": False,
        "is_verified": False,
        "kyc_status": "pending",  # pending, submitted, approved, rejected
        "rating": 5.0,
        "total_rides": 0,
        "total_earnings": 0.0,
        "current_location": None,
        "current_ride_id": None,
        "photo_url": None,
        "documents": {
            "license": None,
            "insurance": None,
            "registration": None,
        },
        "created_at": now,
        "updated_at": now,
    }
    
    await db.drivers.insert_one(driver_doc)
    
    return {
        "ok": True,
        "driver_id": driver_id,
        "status": "pending_verification",
        "message": "Registrierung erfolgreich. Bitte lade deine Dokumente hoch für die Verifizierung.",
    }


# ══════════════════════════════════════
# DRIVER KYC DOCUMENT UPLOAD
# ══════════════════════════════════════

@router.post("/upload-documents")
async def upload_driver_documents(request: Request):
    """Upload verification documents."""
    body = await request.json()
    driver_id = body.get("driver_id")
    
    driver = await db.drivers.find_one({"driver_id": driver_id})
    if not driver:
        raise HTTPException(status_code=404, detail="Fahrer nicht gefunden")
    
    updates = {"updated_at": datetime.now(timezone.utc).isoformat()}
    
    if body.get("license_url"):
        updates["documents.license"] = body["license_url"]
    if body.get("insurance_url"):
        updates["documents.insurance"] = body["insurance_url"]
    if body.get("registration_url"):
        updates["documents.registration"] = body["registration_url"]
    
    # Check if all documents uploaded
    docs = driver.get("documents", {})
    if body.get("license_url"):
        docs["license"] = body["license_url"]
    if body.get("insurance_url"):
        docs["insurance"] = body["insurance_url"]
    if body.get("registration_url"):
        docs["registration"] = body["registration_url"]
    
    if all([docs.get("license"), docs.get("insurance"), docs.get("registration")]):
        updates["kyc_status"] = "submitted"
    
    await db.drivers.update_one({"driver_id": driver_id}, {"$set": updates})
    
    return {"ok": True, "kyc_status": updates.get("kyc_status", driver.get("kyc_status"))}


# ══════════════════════════════════════
# DRIVER GO ONLINE/OFFLINE
# ══════════════════════════════════════

@router.post("/status")
async def update_driver_status(req: DriverStatusUpdate, request: Request):
    """Update driver online status and location."""
    body = await request.json()
    driver_id = body.get("driver_id")
    
    driver = await db.drivers.find_one({"driver_id": driver_id})
    if not driver:
        raise HTTPException(status_code=404, detail="Fahrer nicht gefunden")
    
    if not driver.get("is_verified"):
        raise HTTPException(status_code=403, detail="Fahrer noch nicht verifiziert")
    
    if driver.get("status") != "active":
        raise HTTPException(status_code=403, detail="Fahrerkonto nicht aktiv")
    
    updates = {
        "is_online": req.is_online,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    
    if req.location:
        updates["current_location"] = req.location
    
    await db.drivers.update_one({"driver_id": driver_id}, {"$set": updates})
    
    return {"ok": True, "is_online": req.is_online}


# ══════════════════════════════════════
# UPDATE DRIVER LOCATION
# ══════════════════════════════════════

@router.post("/location")
async def update_driver_location(request: Request):
    """Update driver's current location."""
    body = await request.json()
    driver_id = body.get("driver_id")
    lat = body.get("lat")
    lng = body.get("lng")
    
    if not driver_id or lat is None or lng is None:
        raise HTTPException(status_code=400, detail="driver_id, lat, lng erforderlich")
    
    driver = await db.drivers.find_one({"driver_id": driver_id})
    if not driver:
        raise HTTPException(status_code=404, detail="Fahrer nicht gefunden")
    
    await db.drivers.update_one(
        {"driver_id": driver_id},
        {"$set": {
            "current_location": {"lat": lat, "lng": lng},
            "location_updated_at": datetime.now(timezone.utc).isoformat(),
        }}
    )
    
    return {"ok": True}


# ══════════════════════════════════════
# GET AVAILABLE DRIVERS
# ══════════════════════════════════════

@router.get("/available")
async def get_available_drivers(lat: float = 52.52, lng: float = 13.405, vehicle_type: str = "standard", radius_km: float = 10.0):
    """Get available drivers near a location."""
    
    # Find online, verified, active drivers with matching vehicle type
    drivers = await db.drivers.find({
        "is_online": True,
        "is_verified": True,
        "status": "active",
        "current_ride_id": None,
        "vehicle.type": vehicle_type,
        "current_location": {"$ne": None},
    }, {"_id": 0, "password_hash": 0, "documents": 0}).to_list(50)
    
    # Calculate distance and filter by radius
    from math import radians, cos, sin, sqrt, atan2
    
    def haversine(lat1, lon1, lat2, lon2):
        R = 6371
        dlat = radians(lat2 - lat1)
        dlon = radians(lon2 - lon1)
        a = sin(dlat/2)**2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon/2)**2
        return R * 2 * atan2(sqrt(a), sqrt(1-a))
    
    available = []
    for d in drivers:
        loc = d.get("current_location", {})
        if loc:
            dist = haversine(lat, lng, loc.get("lat", 0), loc.get("lng", 0))
            if dist <= radius_km:
                d["distance_km"] = round(dist, 2)
                d["eta_minutes"] = max(2, int(dist * 2))  # Rough ETA estimate
                available.append(d)
    
    # Sort by distance
    available.sort(key=lambda x: x.get("distance_km", 999))
    
    return {"drivers": available[:10], "total": len(available)}


# ══════════════════════════════════════
# DRIVER ACCEPTS RIDE
# ══════════════════════════════════════

@router.post("/accept-ride")
async def driver_accept_ride(request: Request):
    """Driver accepts a ride request."""
    body = await request.json()
    driver_id = body.get("driver_id")
    ride_id = body.get("ride_id")
    
    driver = await db.drivers.find_one({"driver_id": driver_id})
    if not driver:
        raise HTTPException(status_code=404, detail="Fahrer nicht gefunden")
    
    if not driver.get("is_verified") or driver.get("status") != "active":
        raise HTTPException(status_code=403, detail="Fahrer nicht aktiv")
    
    if driver.get("current_ride_id"):
        raise HTTPException(status_code=400, detail="Bereits auf einer Fahrt")
    
    ride = await db.taxi_rides.find_one({"ride_id": ride_id, "status": "requested"})
    if not ride:
        raise HTTPException(status_code=404, detail="Fahrt nicht verfügbar")
    
    now = datetime.now(timezone.utc).isoformat()
    
    # Assign driver to ride
    driver_info = {
        "driver_id": driver["driver_id"],
        "name": driver["name"],
        "rating": driver.get("rating", 5.0),
        "total_rides": driver.get("total_rides", 0),
        "vehicle": driver["vehicle"],
        "photo_url": driver.get("photo_url"),
        "phone": driver.get("phone"),
        "location": driver.get("current_location"),
        "eta_minutes": body.get("eta_minutes", 5),
    }
    
    await db.taxi_rides.update_one(
        {"ride_id": ride_id},
        {"$set": {
            "driver": driver_info,
            "status": "accepted",
            "accepted_at": now,
            "updated_at": now,
        }, "$push": {"status_history": {"status": "accepted", "at": now}}}
    )
    
    await db.drivers.update_one(
        {"driver_id": driver_id},
        {"$set": {"current_ride_id": ride_id, "updated_at": now}}
    )
    
    return {"ok": True, "ride": ride}


# ══════════════════════════════════════
# DRIVER COMPLETES RIDE
# ══════════════════════════════════════

@router.post("/complete-ride")
async def driver_complete_ride(request: Request):
    """Driver marks ride as completed."""
    body = await request.json()
    driver_id = body.get("driver_id")
    ride_id = body.get("ride_id")
    
    driver = await db.drivers.find_one({"driver_id": driver_id})
    if not driver:
        raise HTTPException(status_code=404, detail="Fahrer nicht gefunden")
    
    ride = await db.taxi_rides.find_one({"ride_id": ride_id, "driver.driver_id": driver_id})
    if not ride:
        raise HTTPException(status_code=404, detail="Fahrt nicht gefunden")
    
    if ride["status"] not in ("started", "arriving", "accepted"):
        raise HTTPException(status_code=400, detail="Fahrt kann nicht abgeschlossen werden")
    
    now = datetime.now(timezone.utc).isoformat()
    fare = ride.get("fare_estimate", 0)
    
    # Calculate driver earnings (80% of fare)
    driver_earnings = round(fare * 0.80, 2)
    platform_fee = round(fare * 0.20, 2)
    
    # Charge user wallet
    user = await db.users.find_one({"_id": ObjectId(ride["user_id"])})
    if user:
        await db.users.update_one(
            {"_id": user["_id"]},
            {"$inc": {"balance": -fare}}
        )
        
        await db.transactions.insert_one({
            "id": secrets.token_hex(8),
            "user_id": ride["user_id"],
            "type": "payment",
            "amount": -fare,
            "description": f"Taxi: {ride.get('pickup', {}).get('address', '?')} → {ride.get('dropoff', {}).get('address', '?')}",
            "status": "completed",
            "reference": f"TAXI-{ride_id[:8].upper()}",
            "category": "taxi",
            "created_at": now,
        })
    
    # Update ride
    await db.taxi_rides.update_one(
        {"ride_id": ride_id},
        {"$set": {
            "status": "completed",
            "final_fare": fare,
            "driver_earnings": driver_earnings,
            "platform_fee": platform_fee,
            "completed_at": now,
            "updated_at": now,
        }, "$push": {"status_history": {"status": "completed", "at": now}}}
    )
    
    # Update driver stats and clear current ride
    await db.drivers.update_one(
        {"driver_id": driver_id},
        {"$set": {"current_ride_id": None, "updated_at": now},
         "$inc": {"total_rides": 1, "total_earnings": driver_earnings}}
    )
    
    return {
        "ok": True,
        "final_fare": fare,
        "driver_earnings": driver_earnings,
        "platform_fee": platform_fee,
    }


# ══════════════════════════════════════
# ADMIN: VERIFY DRIVER
# ══════════════════════════════════════

@router.post("/admin/verify")
async def admin_verify_driver(request: Request):
    """Admin approves or rejects driver KYC."""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Nur Admin")
    
    body = await request.json()
    driver_id = body.get("driver_id")
    approved = body.get("approved", False)
    reason = body.get("reason", "")
    
    driver = await db.drivers.find_one({"driver_id": driver_id})
    if not driver:
        raise HTTPException(status_code=404, detail="Fahrer nicht gefunden")
    
    now = datetime.now(timezone.utc).isoformat()
    
    if approved:
        await db.drivers.update_one(
            {"driver_id": driver_id},
            {"$set": {
                "is_verified": True,
                "kyc_status": "approved",
                "status": "active",
                "verified_at": now,
                "verified_by": str(user["_id"]),
                "updated_at": now,
            }}
        )
    else:
        await db.drivers.update_one(
            {"driver_id": driver_id},
            {"$set": {
                "kyc_status": "rejected",
                "kyc_rejection_reason": reason,
                "updated_at": now,
            }}
        )
    
    return {"ok": True, "status": "approved" if approved else "rejected"}


# ══════════════════════════════════════
# ADMIN: LIST DRIVERS
# ══════════════════════════════════════

@router.get("/admin/list")
async def admin_list_drivers(request: Request, status: str = None, limit: int = 50):
    """Admin lists all drivers."""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Nur Admin")
    
    query = {}
    if status:
        query["status"] = status
    
    drivers = await db.drivers.find(query, {"_id": 0, "password_hash": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    
    return {"drivers": drivers, "total": len(drivers)}


# ══════════════════════════════════════
# ADMIN: PENDING KYC
# ══════════════════════════════════════

@router.get("/admin/pending-kyc")
async def admin_pending_kyc(request: Request):
    """Get drivers pending KYC approval."""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Nur Admin")
    
    drivers = await db.drivers.find(
        {"kyc_status": "submitted"},
        {"_id": 0, "password_hash": 0}
    ).to_list(50)
    
    return {"drivers": drivers, "total": len(drivers)}
