"""
BidBlitz V2 - Real Taxi/Ride System
Real drivers, real bookings, real payments.
NO FAKE DRIVERS - Only registered verified users.
"""

import secrets
import math
import logging
from urllib.parse import quote
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from typing import Optional, List
from enum import Enum
from bson import ObjectId

from core.database import db
from core.security import get_current_user
from models.taxi import (
    OperatorRegistration,
    FavoriteLocationRequest,
    DriverOnboardRequest,
    AddDriverRequest,
    DriverRegisterRequest,
    PrivateDriverRegistration,
    LocationUpdate,
    BookRideRequest,
    EstimateRequest,
    FlexBookRequest,
    RideActionRequest,
    SavePlaceReq,
    VehicleCreateRequest,
    VehicleUpdateRequest,
    SosRequest,
    TipRequest,
    VehicleType,
    DriverType,
)

router = APIRouter(prefix="/api/taxi", tags=["Taxi"])
logger = logging.getLogger("bidblitz.taxi")

# ══════════════════════════════════════════════════════════════════════════════
# MODULE STATUS - Set to False to hide from users
# ══════════════════════════════════════════════════════════════════════════════
TAXI_MODULE_ENABLED = True  # Now enabled - taxi partners can register


# ══════════════════════════════════════════════════════════════════════════════
# TAXI PARTNER CONFIGURATION
# ══════════════════════════════════════════════════════════════════════════════

TRIAL_MONTHS = 6  # 6 months free trial for taxi operators
COMMISSION_RATE_MIN = 0.05  # 5% minimum commission after trial
COMMISSION_RATE_MAX = 0.10  # 10% maximum commission after trial
COMMISSION_TIERS = [
    {"min_revenue": 0, "max_revenue": 5000, "rate": 0.05},      # €0-5000: 5%
    {"min_revenue": 5000, "max_revenue": 15000, "rate": 0.07},  # €5000-15000: 7%
    {"min_revenue": 15000, "max_revenue": float('inf'), "rate": 0.10},  # €15000+: 10%
]


def get_commission_rate(total_revenue: float) -> float:
    """Get commission rate based on total revenue."""
    for tier in COMMISSION_TIERS:
        if tier["min_revenue"] <= total_revenue < tier["max_revenue"]:
            return tier["rate"]
    return COMMISSION_RATE_MAX


# ══════════════════════════════════════════════════════════════════════════════
# MODULE STATUS ENDPOINT
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/status")
async def get_module_status():
    """Check if taxi module is enabled."""
    # Count approved taxi operators and their online drivers
    operators = await db.taxi_operators.find({"status": "approved"}).to_list(100)
    
    business_drivers = 0
    for op in operators:
        for driver in op.get("drivers", []):
            if driver.get("is_online") and driver.get("status") == "active":
                business_drivers += 1
    
    # Count private drivers (users with is_private_driver flag, online OR active)
    private_drivers = await db.users.count_documents({
        "is_private_driver": True,
        "$or": [
            {"driver_online": True},
            {"driver_active": True},
            {"driver_status": "online"},
        ],
    })
    
    return {
        "module_enabled": TAXI_MODULE_ENABLED,
        "operators_active": len(operators),
        "business_drivers": business_drivers,
        "private_drivers": private_drivers,
        "message": "Taxi-Modul aktiv" if TAXI_MODULE_ENABLED else "Taxi-Modul wird vorbereitet",
    }


# ══════════════════════════════════════════════════════════════════════════════
# TAXI OPERATOR REGISTRATION & MANAGEMENT  
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/operator/register")
async def register_taxi_operator(req: OperatorRegistration, request: Request):
    """Register as a taxi operator/company."""
    
    # Check if already registered
    existing = await db.taxi_operators.find_one({"email": req.email.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="Diese E-Mail ist bereits registriert")
    
    now = datetime.now(timezone.utc)
    trial_end = now + timedelta(days=TRIAL_MONTHS * 30)
    operator_id = secrets.token_hex(8)
    
    operator = {
        "operator_id": operator_id,
        "company_name": req.company_name,
        "contact_name": req.contact_name,
        "email": req.email.lower(),
        "phone": req.phone,
        "city": req.city,
        "country": req.country,
        "fleet_size": req.fleet_size,
        "license_number": req.license_number,
        "tax_id": req.tax_id,
        "status": "pending",  # pending, approved, rejected, suspended
        "trial_start": now.isoformat(),
        "trial_end": trial_end.isoformat(),
        "is_trial": True,
        "commission_rate": 0.0,  # 0% during trial
        "total_revenue": 0.0,
        "total_rides": 0,
        "total_commission_paid": 0.0,
        "balance_due": 0.0,
        "drivers": [],
        "created_at": now.isoformat(),
        "updated_at": now.isoformat(),
    }
    
    await db.taxi_operators.insert_one(operator)
    operator.pop("_id", None)
    
    logger.info(f"New taxi operator registered: {req.company_name} ({operator_id})")
    
    return {
        "ok": True,
        "operator_id": operator_id,
        "message": f"Registrierung erfolgreich! Dein Antrag wird geprüft. Testphase: {TRIAL_MONTHS} Monate kostenlos.",
        "trial_months": TRIAL_MONTHS,
        "trial_end": trial_end.isoformat(),
    }


@router.get("/operator/status")


# ══════════════════════════════════════════════════════════════════════════════
# FAVORITE LOCATIONS (User saved addresses)
# ══════════════════════════════════════════════════════════════════════════════
# Favorite Locations APIs

@router.get("/user/favorite-locations")
async def get_favorite_locations(request: Request):
    """Get all favorite locations for authenticated user"""
    user = await get_current_user(request)
    user_id = user.get("email") or user.get("id")
    
    favorites = await db.user_favorite_locations.find(
        {"user_id": user_id}, {"_id": 0}
    ).sort("last_used", -1).to_list(50)
    
    return {"favorites": favorites, "count": len(favorites)}


@router.post("/user/favorite-locations")
async def add_favorite_location(req: FavoriteLocationRequest, request: Request):
    """Add new favorite location"""
    user = await get_current_user(request)
    user_id = user.get("email") or user.get("id")
    now = datetime.now(timezone.utc)
    
    # Check if address already saved
    existing = await db.user_favorite_locations.find_one({
        "user_id": user_id,
        "address": req.address
    })
    
    if existing:
        raise HTTPException(status_code=400, detail="Diese Adresse ist bereits gespeichert")
    
    favorite_id = secrets.token_hex(8)
    favorite = {
        "id": favorite_id,
        "user_id": user_id,
        "name": req.name,
        "address": req.address,
        "latitude": req.latitude,
        "longitude": req.longitude,
        "icon": req.icon,
        "created_at": now.isoformat(),
        "last_used": now.isoformat(),
        "use_count": 0
    }
    
    await db.user_favorite_locations.insert_one(favorite)
    logger.info(f"Favorite location added: {req.name} for user {user_id}")
    
    # Remove MongoDB's _id field before returning (not JSON serializable)
    favorite.pop("_id", None)
    return {"ok": True, "favorite": favorite}


@router.delete("/user/favorite-locations/{favorite_id}")
async def delete_favorite_location(favorite_id: str, request: Request):
    """Remove favorite location"""
    user = await get_current_user(request)
    user_id = user.get("email") or user.get("id")
    
    result = await db.user_favorite_locations.delete_one({
        "id": favorite_id,
        "user_id": user_id
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Favorit nicht gefunden")
    
    return {"ok": True, "message": "Favorit gelöscht"}


@router.put("/user/favorite-locations/{favorite_id}")
async def update_favorite_location(favorite_id: str, req: FavoriteLocationRequest, request: Request):
    """Update favorite location name/icon"""
    user = await get_current_user(request)
    user_id = user.get("email") or user.get("id")
    
    result = await db.user_favorite_locations.update_one(
        {"id": favorite_id, "user_id": user_id},
        {"$set": {"name": req.name, "icon": req.icon}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Favorit nicht gefunden")
    
    return {"ok": True, "message": "Favorit aktualisiert"}


@router.post("/user/favorite-locations/{favorite_id}/use")
async def mark_favorite_used(favorite_id: str, request: Request):
    """Mark favorite as used (increment counter, update last_used)"""
    user = await get_current_user(request)
    user_id = user.get("email") or user.get("id")
    now = datetime.now(timezone.utc)
    
    await db.user_favorite_locations.update_one(
        {"id": favorite_id, "user_id": user_id},
        {
            "$set": {"last_used": now.isoformat()},
            "$inc": {"use_count": 1}
        }
    )
    
    return {"ok": True}

async def get_operator_status(request: Request):
    """Get current operator status and earnings."""
    user = await get_current_user(request)
    email = user.get("email", "").lower()
    
    operator = await db.taxi_operators.find_one({"email": email}, {"_id": 0})
    if not operator:
        return {"is_operator": False}
    
    now = datetime.now(timezone.utc)
    trial_end = datetime.fromisoformat(operator["trial_end"])
    days_left = (trial_end - now).days
    
    # Check if trial has ended
    if operator["is_trial"] and now > trial_end:
        # Trial ended, calculate commission rate
        commission_rate = get_commission_rate(operator["total_revenue"])
        await db.taxi_operators.update_one(
            {"operator_id": operator["operator_id"]},
            {"$set": {"is_trial": False, "commission_rate": commission_rate}}
        )
        operator["is_trial"] = False
        operator["commission_rate"] = commission_rate
    
    return {
        "is_operator": True,
        "operator_id": operator["operator_id"],
        "company_name": operator["company_name"],
        "status": operator["status"],
        "is_trial": operator["is_trial"],
        "trial_days_left": max(0, days_left) if operator["is_trial"] else 0,
        "trial_end": operator["trial_end"],
        "commission_rate": operator["commission_rate"],
        "total_revenue": operator["total_revenue"],
        "total_rides": operator["total_rides"],
        "total_commission_paid": operator["total_commission_paid"],
        "balance_due": operator["balance_due"],
        "fleet_size": operator["fleet_size"],
        "drivers_count": len(operator.get("drivers", [])),
    }


# ══════════════════════════════════════════════════════════════════════════════
# DRIVER ONBOARDING (For "Buchung anfragen" button)
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/driver/onboard")
async def onboard_driver(req: DriverOnboardRequest):
    """
    Driver onboarding form submission.
    Saves driver application to pending queue for admin approval.
    """
    # Check if already registered
    existing = await db.taxi_driver_applications.find_one({"email": req.email.lower()})
    if existing:
        if existing.get("status") == "pending":
            raise HTTPException(status_code=400, detail="Deine Bewerbung wird bereits geprüft")
        elif existing.get("status") == "approved":
            raise HTTPException(status_code=400, detail="Du bist bereits als Fahrer registriert")
    
    now = datetime.now(timezone.utc)
    application_id = secrets.token_hex(8)
    
    application = {
        "application_id": application_id,
        "name": req.name,
        "email": req.email.lower(),
        "phone": req.phone,
        "license_number": req.license_number,
        "vehicle_type": req.vehicle_type,
        "driver_type": req.driver_type,
        "city": req.city or "N/A",
        "message": req.message or "",
        "vehicle_capabilities": {
            "pet_friendly": bool(req.pet_friendly),
            "luggage_class": req.luggage_class or "small",
            "assistance": bool(req.assistance),
        },
        "status": "pending",  # pending, approved, rejected
        "created_at": now.isoformat(),
        "reviewed_at": None,
        "reviewed_by": None,
    }
    
    await db.taxi_driver_applications.insert_one(application)
    logger.info(f"New driver application: {req.name} ({req.driver_type} - {req.vehicle_type})")
    
    return {
        "ok": True,
        "application_id": application_id,
        "message": "Bewerbung erfolgreich eingereicht! Wir prüfen deine Angaben und melden uns innerhalb von 24 Stunden.",
        "status": "pending",
    }


@router.get("/operator/earnings")
async def get_operator_earnings(request: Request, period: str = "month"):
    """Get operator earnings breakdown."""
    user = await get_current_user(request)
    email = user.get("email", "").lower()
    
    operator = await db.taxi_operators.find_one({"email": email})
    if not operator:
        raise HTTPException(status_code=404, detail="Kein Operator-Konto gefunden")
    
    if operator["status"] != "approved":
        raise HTTPException(status_code=403, detail="Operator nicht freigeschaltet")
    
    operator_id = operator["operator_id"]
    now = datetime.now(timezone.utc)
    
    # Calculate date range
    if period == "week":
        start_date = now - timedelta(days=7)
    elif period == "month":
        start_date = now - timedelta(days=30)
    elif period == "year":
        start_date = now - timedelta(days=365)
    else:
        start_date = now - timedelta(days=30)
    
    # Get rides in period
    rides = await db.taxi_rides.find({
        "operator_id": operator_id,
        "status": "completed",
        "completed_at": {"$gte": start_date.isoformat()}
    }).to_list(1000)
    
    total_revenue = sum(r.get("final_fare", 0) for r in rides)
    total_rides = len(rides)
    
    # Calculate commission
    if operator["is_trial"]:
        commission = 0
        commission_rate = 0
    else:
        commission_rate = operator["commission_rate"]
        commission = round(total_revenue * commission_rate, 2)
    
    net_earnings = round(total_revenue - commission, 2)
    
    return {
        "period": period,
        "total_revenue": round(total_revenue, 2),
        "total_rides": total_rides,
        "commission_rate": commission_rate,
        "commission_amount": commission,
        "net_earnings": net_earnings,
        "is_trial": operator["is_trial"],
        "trial_savings": round(total_revenue * get_commission_rate(operator["total_revenue"]), 2) if operator["is_trial"] else 0,
    }


@router.post("/operator/add-driver")
async def add_driver_to_fleet(req: AddDriverRequest, request: Request):
    """Add a driver to the taxi operator's fleet."""
    user = await get_current_user(request)
    email = user.get("email", "").lower()
    
    operator = await db.taxi_operators.find_one({"email": email})
    if not operator:
        raise HTTPException(status_code=404, detail="Kein Operator-Konto gefunden")
    
    if operator["status"] != "approved":
        raise HTTPException(status_code=403, detail="Operator noch nicht freigeschaltet")
    
    # Check driver exists
    from bson import ObjectId
    driver_user = await db.users.find_one({"_id": ObjectId(req.driver_user_id)})
    if not driver_user:
        raise HTTPException(status_code=404, detail="Fahrer-Benutzer nicht gefunden")
    
    # Check fleet size limit
    if len(operator.get("drivers", [])) >= operator["fleet_size"]:
        raise HTTPException(status_code=400, detail=f"Flottengröße ({operator['fleet_size']}) erreicht")
    
    now = datetime.now(timezone.utc)
    driver_id = secrets.token_hex(8)
    
    driver = {
        "driver_id": driver_id,
        "user_id": req.driver_user_id,
        "name": driver_user.get("name", ""),
        "email": driver_user.get("email", ""),
        "phone": driver_user.get("phone", ""),
        "vehicle_plate": req.vehicle_plate.upper(),
        "vehicle_model": req.vehicle_model,
        "car_type": req.car_type,
        "status": "active",
        "is_online": False,
        "total_rides": 0,
        "rating": 5.0,
        "added_at": now.isoformat(),
    }
    
    await db.taxi_operators.update_one(
        {"operator_id": operator["operator_id"]},
        {"$push": {"drivers": driver}}
    )
    
    # Mark user as taxi driver
    await db.users.update_one(
        {"_id": ObjectId(req.driver_user_id)},
        {"$set": {
            "is_taxi_driver": True,
            "taxi_operator_id": operator["operator_id"],
            "taxi_driver_id": driver_id,
        }}
    )
    
    logger.info(f"Driver {driver_id} added to operator {operator['operator_id']}")
    
    return {
        "ok": True,
        "driver_id": driver_id,
        "message": f"Fahrer {driver_user.get('name', '')} wurde hinzugefügt",
    }


# ══════════════════════════════════════════════════════════════════════════════
# OPERATOR DASHBOARD - Full Fleet Management
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/operator/dashboard")
async def get_operator_dashboard(request: Request):
    """Get full dashboard data for taxi operator."""
    user = await get_current_user(request)
    email = user.get("email", "").lower()
    
    operator = await db.taxi_operators.find_one({"email": email})
    if not operator:
        raise HTTPException(status_code=404, detail="Kein Operator-Konto gefunden")
    
    if operator["status"] != "approved":
        raise HTTPException(status_code=403, detail="Operator noch nicht freigeschaltet")
    
    operator_id = operator["operator_id"]
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today_start - timedelta(days=7)
    month_start = today_start - timedelta(days=30)
    
    # Get all drivers with their current status
    drivers = operator.get("drivers", [])
    driver_ids = [d["driver_id"] for d in drivers]
    
    # Get driver locations
    driver_locations = await db.driver_locations.find(
        {"driver_id": {"$in": driver_ids}},
        {"_id": 0}
    ).to_list(100)
    location_map = {loc["driver_id"]: loc for loc in driver_locations}
    
    # Get active rides
    active_rides = await db.taxi_rides.find({
        "operator_id": operator_id,
        "status": {"$in": ["requested", "accepted", "arriving", "started"]}
    }, {"_id": 0}).to_list(100)
    active_ride_map = {r.get("driver_id"): r for r in active_rides if r.get("driver_id")}
    
    # Enrich driver data
    enriched_drivers = []
    online_count = 0
    busy_count = 0
    
    for d in drivers:
        loc = location_map.get(d["driver_id"], {})
        ride = active_ride_map.get(d["driver_id"])
        
        status = "offline"
        if d.get("is_online"):
            online_count += 1
            if ride:
                status = ride["status"]
                busy_count += 1
            else:
                status = "available"
        
        enriched_drivers.append({
            **d,
            "current_status": status,
            "location": {
                "lat": loc.get("lat", 0),
                "lng": loc.get("lng", 0),
                "updated_at": loc.get("updated_at", ""),
            } if loc else None,
            "current_ride": {
                "ride_id": ride["ride_id"],
                "status": ride["status"],
                "pickup_address": ride.get("pickup_address", ""),
                "dropoff_address": ride.get("dropoff_address", ""),
                "customer_name": ride.get("customer_name", ""),
            } if ride else None,
        })
    
    # Get rides statistics
    today_rides = await db.taxi_rides.find({
        "operator_id": operator_id,
        "created_at": {"$gte": today_start.isoformat()}
    }, {"_id": 0}).to_list(500)
    
    week_rides = await db.taxi_rides.find({
        "operator_id": operator_id,
        "status": "completed",
        "completed_at": {"$gte": week_start.isoformat()}
    }, {"_id": 0}).to_list(1000)
    
    month_rides = await db.taxi_rides.find({
        "operator_id": operator_id,
        "status": "completed",
        "completed_at": {"$gte": month_start.isoformat()}
    }, {"_id": 0}).to_list(2000)
    
    # Calculate stats
    today_completed = [r for r in today_rides if r["status"] == "completed"]
    today_revenue = sum(r.get("final_fare", 0) for r in today_completed)
    
    week_revenue = sum(r.get("final_fare", 0) for r in week_rides)
    month_revenue = sum(r.get("final_fare", 0) for r in month_rides)
    
    # Commission calculation
    if operator["is_trial"]:
        commission_rate = 0
        trial_end = datetime.fromisoformat(operator["trial_end"])
        days_left = (trial_end - now).days
    else:
        commission_rate = operator["commission_rate"]
        days_left = 0
    
    today_commission = round(today_revenue * commission_rate, 2)
    week_commission = round(week_revenue * commission_rate, 2)
    month_commission = round(month_revenue * commission_rate, 2)
    
    return {
        "operator": {
            "operator_id": operator_id,
            "company_name": operator["company_name"],
            "is_trial": operator["is_trial"],
            "trial_days_left": max(0, days_left),
            "commission_rate": commission_rate,
            "fleet_size": operator["fleet_size"],
        },
        "fleet": {
            "total_drivers": len(drivers),
            "online": online_count,
            "busy": busy_count,
            "available": online_count - busy_count,
            "offline": len(drivers) - online_count,
            "drivers": enriched_drivers,
        },
        "active_rides": active_rides,
        "stats": {
            "today": {
                "rides": len(today_completed),
                "revenue": round(today_revenue, 2),
                "commission": today_commission,
                "net": round(today_revenue - today_commission, 2),
            },
            "week": {
                "rides": len(week_rides),
                "revenue": round(week_revenue, 2),
                "commission": week_commission,
                "net": round(week_revenue - week_commission, 2),
            },
            "month": {
                "rides": len(month_rides),
                "revenue": round(month_revenue, 2),
                "commission": month_commission,
                "net": round(month_revenue - month_commission, 2),
            },
        },
    }


@router.get("/operator/rides")
async def get_operator_rides(request: Request, status: Optional[str] = None, limit: int = 50, skip: int = 0):
    """Get all rides for the operator."""
    user = await get_current_user(request)
    email = user.get("email", "").lower()
    
    operator = await db.taxi_operators.find_one({"email": email})
    if not operator or operator["status"] != "approved":
        raise HTTPException(status_code=403, detail="Nicht autorisiert")
    
    query = {"operator_id": operator["operator_id"]}
    if status:
        query["status"] = status
    
    rides = await db.taxi_rides.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.taxi_rides.count_documents(query)
    
    return {"rides": rides, "total": total}


@router.get("/operator/payments")
async def get_operator_payments(request: Request, period: str = "month"):
    """Get payment history for operator."""
    user = await get_current_user(request)
    email = user.get("email", "").lower()
    
    operator = await db.taxi_operators.find_one({"email": email})
    if not operator or operator["status"] != "approved":
        raise HTTPException(status_code=403, detail="Nicht autorisiert")
    
    now = datetime.now(timezone.utc)
    if period == "week":
        start_date = now - timedelta(days=7)
    elif period == "month":
        start_date = now - timedelta(days=30)
    elif period == "year":
        start_date = now - timedelta(days=365)
    else:
        start_date = now - timedelta(days=30)
    
    # Get completed rides as payments
    rides = await db.taxi_rides.find({
        "operator_id": operator["operator_id"],
        "status": "completed",
        "completed_at": {"$gte": start_date.isoformat()}
    }, {"_id": 0}).sort("completed_at", -1).to_list(500)
    
    payments = []
    for r in rides:
        driver = next((d for d in operator.get("drivers", []) if d["driver_id"] == r.get("driver_id")), {})
        commission = round(r.get("final_fare", 0) * operator["commission_rate"], 2) if not operator["is_trial"] else 0
        
        payments.append({
            "ride_id": r["ride_id"],
            "driver_name": driver.get("name", "Unbekannt"),
            "driver_id": r.get("driver_id", ""),
            "customer_name": r.get("customer_name", ""),
            "pickup": r.get("pickup_address", ""),
            "dropoff": r.get("dropoff_address", ""),
            "fare": r.get("final_fare", 0),
            "commission": commission,
            "net": round(r.get("final_fare", 0) - commission, 2),
            "payment_method": "wallet",
            "completed_at": r.get("completed_at", ""),
        })
    
    total_revenue = sum(p["fare"] for p in payments)
    total_commission = sum(p["commission"] for p in payments)
    
    return {
        "payments": payments,
        "summary": {
            "total_rides": len(payments),
            "total_revenue": round(total_revenue, 2),
            "total_commission": round(total_commission, 2),
            "total_net": round(total_revenue - total_commission, 2),
        }
    }


@router.post("/operator/driver/{driver_id}/toggle")
async def toggle_driver_status(driver_id: str, request: Request):
    """Enable/disable a driver."""
    user = await get_current_user(request)
    email = user.get("email", "").lower()
    
    operator = await db.taxi_operators.find_one({"email": email})
    if not operator or operator["status"] != "approved":
        raise HTTPException(status_code=403, detail="Nicht autorisiert")
    
    # Find driver
    driver = next((d for d in operator.get("drivers", []) if d["driver_id"] == driver_id), None)
    if not driver:
        raise HTTPException(status_code=404, detail="Fahrer nicht gefunden")
    
    new_status = "inactive" if driver.get("status") == "active" else "active"
    
    await db.taxi_operators.update_one(
        {"operator_id": operator["operator_id"], "drivers.driver_id": driver_id},
        {"$set": {"drivers.$.status": new_status}}
    )
    
    return {"ok": True, "new_status": new_status}


@router.delete("/operator/driver/{driver_id}")
async def remove_driver(driver_id: str, request: Request):
    """Remove a driver from fleet."""
    user = await get_current_user(request)
    email = user.get("email", "").lower()
    
    operator = await db.taxi_operators.find_one({"email": email})
    if not operator or operator["status"] != "approved":
        raise HTTPException(status_code=403, detail="Nicht autorisiert")
    
    # Check if driver has active ride
    active_ride = await db.taxi_rides.find_one({
        "driver_id": driver_id,
        "status": {"$in": ["accepted", "arriving", "started"]}
    })
    if active_ride:
        raise HTTPException(status_code=400, detail="Fahrer hat aktive Fahrt")
    
    # Find driver user_id
    driver = next((d for d in operator.get("drivers", []) if d["driver_id"] == driver_id), None)
    if driver:
        # Remove taxi driver flag from user
        from bson import ObjectId
        await db.users.update_one(
            {"_id": ObjectId(driver["user_id"])},
            {"$unset": {"is_taxi_driver": "", "taxi_operator_id": "", "taxi_driver_id": ""}}
        )
    
    await db.taxi_operators.update_one(
        {"operator_id": operator["operator_id"]},
        {"$pull": {"drivers": {"driver_id": driver_id}}}
    )
    
    return {"ok": True, "message": "Fahrer entfernt"}


# ══════════════════════════════════════════════════════════════════════════════
# PRIVATE DRIVER REGISTRATION
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/private/register")
async def register_private_driver(req: PrivateDriverRegistration, request: Request):
    """Register as a private taxi driver."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    email = user.get("email", "").lower()
    
    # Check if already registered
    if user.get("is_private_driver") or user.get("is_taxi_driver"):
        raise HTTPException(status_code=400, detail="Du bist bereits als Fahrer registriert")
    
    now = datetime.now(timezone.utc)
    trial_end = now + timedelta(days=TRIAL_MONTHS * 30)
    driver_id = secrets.token_hex(8)
    
    # Create private driver profile
    private_driver = {
        "driver_id": driver_id,
        "user_id": user_id,
        "name": user.get("name", ""),
        "email": email,
        "phone": user.get("phone", ""),
        "vehicle_plate": req.vehicle_plate.upper(),
        "vehicle_model": req.vehicle_model,
        "vehicle_year": req.vehicle_year,
        "car_type": req.car_type,
        "license_number": req.license_number,
        "city": req.city,
        "status": "pending",  # pending, approved, rejected, suspended
        "is_trial": True,
        "trial_end": trial_end.isoformat(),
        "commission_rate": 0.0,  # 0% during trial, then 8% for private
        "total_rides": 0,
        "total_revenue": 0.0,
        "rating": 5.0,
        "ratings_count": 0,
        "created_at": now.isoformat(),
    }
    
    await db.private_drivers.insert_one(private_driver)
    
    # Update user
    await db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {
            "is_private_driver": True,
            "private_driver_id": driver_id,
            "driver_status": "pending",
        }}
    )
    
    logger.info(f"New private driver registered: {email} ({driver_id})")
    
    return {
        "ok": True,
        "driver_id": driver_id,
        "message": f"Registrierung erfolgreich! Dein Antrag wird geprüft. Testphase: {TRIAL_MONTHS} Monate kostenlos mit 0% Provision.",
    }


@router.get("/private/status")
async def get_private_driver_status(request: Request):
    """Get private driver status."""
    user = await get_current_user(request)
    
    if not user.get("is_private_driver"):
        return {"is_driver": False}
    
    driver_id = user.get("private_driver_id")
    driver = await db.private_drivers.find_one({"driver_id": driver_id}, {"_id": 0})
    
    if not driver:
        return {"is_driver": False}
    
    now = datetime.now(timezone.utc)
    if driver.get("is_trial") and driver.get("trial_end"):
        trial_end = datetime.fromisoformat(driver["trial_end"])
        days_left = (trial_end - now).days
        
        if now > trial_end:
            # Trial ended
            await db.private_drivers.update_one(
                {"driver_id": driver_id},
                {"$set": {"is_trial": False, "commission_rate": 0.08}}  # 8% for private
            )
            driver["is_trial"] = False
            driver["commission_rate"] = 0.08
            days_left = 0
    else:
        days_left = 0
    
    return {
        "is_driver": True,
        "driver_id": driver_id,
        "status": driver["status"],
        "is_online": user.get("driver_online", False),
        "is_trial": driver.get("is_trial", False),
        "trial_days_left": max(0, days_left),
        "commission_rate": driver.get("commission_rate", 0.08),
        "total_rides": driver.get("total_rides", 0),
        "total_revenue": driver.get("total_revenue", 0),
        "rating": driver.get("rating", 5.0),
        "vehicle": f"{driver['vehicle_model']} ({driver['vehicle_plate']})",
    }


@router.post("/private/online")
async def toggle_private_driver_online(request: Request):
    """Toggle private driver online status."""
    user = await get_current_user(request)
    
    if not user.get("is_private_driver"):
        raise HTTPException(status_code=403, detail="Nicht als Privatfahrer registriert")
    
    driver_id = user.get("private_driver_id")
    driver = await db.private_drivers.find_one({"driver_id": driver_id})
    
    if not driver or driver["status"] != "approved":
        raise HTTPException(status_code=403, detail="Fahrer nicht freigeschaltet")
    
    body = await request.json()
    is_online = body.get("online", False)
    
    await db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {"driver_online": is_online}}
    )
    
    return {"ok": True, "is_online": is_online}


# Admin: Approve private driver
@router.post("/admin/private/{driver_id}/approve")
async def approve_private_driver(driver_id: str, request: Request):
    """Admin: Approve a private driver."""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    
    result = await db.private_drivers.update_one(
        {"driver_id": driver_id},
        {"$set": {"status": "approved"}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Fahrer nicht gefunden")
    
    # Update user status
    driver = await db.private_drivers.find_one({"driver_id": driver_id})
    if driver:
        from bson import ObjectId
        await db.users.update_one(
            {"_id": ObjectId(driver["user_id"])},
            {"$set": {"driver_status": "approved"}}
        )
    
    return {"ok": True, "message": "Privatfahrer freigeschaltet"}


# ══════════════════════════════════════════════════════════════════════════════
# DRIVER LOCATION UPDATES
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/driver/location")
async def update_driver_location(req: LocationUpdate, request: Request):
    """Driver updates their location."""
    user = await get_current_user(request)
    
    if not user.get("is_taxi_driver"):
        raise HTTPException(status_code=403, detail="Nicht als Fahrer registriert")
    
    driver_id = user.get("taxi_driver_id")
    if not driver_id:
        raise HTTPException(status_code=400, detail="Fahrer-ID fehlt")
    
    now = datetime.now(timezone.utc)
    
    await db.driver_locations.update_one(
        {"driver_id": driver_id},
        {"$set": {
            "driver_id": driver_id,
            "user_id": str(user["_id"]),
            "lat": req.lat,
            "lng": req.lng,
            "updated_at": now.isoformat(),
        }},
        upsert=True
    )
    
    return {"ok": True}


@router.post("/driver/online")
async def toggle_driver_online(request: Request):
    """Driver goes online/offline."""
    user = await get_current_user(request)
    
    if not user.get("is_taxi_driver"):
        raise HTTPException(status_code=403, detail="Nicht als Fahrer registriert")
    
    driver_id = user.get("taxi_driver_id")
    operator_id = user.get("taxi_operator_id")
    
    if not driver_id or not operator_id:
        raise HTTPException(status_code=400, detail="Fahrer-Daten fehlen")
    
    body = await request.json()
    is_online = body.get("online", False)
    
    await db.taxi_operators.update_one(
        {"operator_id": operator_id, "drivers.driver_id": driver_id},
        {"$set": {"drivers.$.is_online": is_online}}
    )
    
    return {"ok": True, "is_online": is_online}


# ══════════════════════════════════════════════════════════════════════════════
# ADMIN: OPERATOR MANAGEMENT
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/admin/operators")
async def list_taxi_operators(request: Request, status: Optional[str] = None):
    """Admin: List all taxi operators."""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    
    query = {}
    if status:
        query["status"] = status
    
    operators = await db.taxi_operators.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    
    return {"operators": operators, "total": len(operators)}


@router.post("/admin/operator/{operator_id}/approve")
async def approve_taxi_operator(operator_id: str, request: Request):
    """Admin: Approve a taxi operator."""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    
    result = await db.taxi_operators.update_one(
        {"operator_id": operator_id},
        {"$set": {"status": "approved", "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Operator nicht gefunden")
    
    # Send approval email
    operator = await db.taxi_operators.find_one({"operator_id": operator_id})
    if operator:
        try:
            from core.email import send_email
            send_email(
                operator["email"],
                "BidBlitz Taxi - Freischaltung bestätigt!",
                f"""<div style="font-family:system-ui;background:#0a0a0a;color:#fff;padding:40px;">
                <h1 style="color:#00C2FF;">Willkommen bei BidBlitz Taxi!</h1>
                <p>Hallo {operator['contact_name']},</p>
                <p>Dein Taxiunternehmen <strong>{operator['company_name']}</strong> wurde freigeschaltet!</p>
                <div style="background:#111;padding:20px;border-radius:12px;margin:20px 0;">
                    <p><strong>Testphase:</strong> {TRIAL_MONTHS} Monate kostenlos</p>
                    <p><strong>Danach:</strong> 5-10% Provision basierend auf Umsatz</p>
                </div>
                <p>Du kannst jetzt Fahrer hinzufügen und Fahrten annehmen.</p>
                </div>"""
            )
        except Exception as e:
            logger.warning(f"Email failed: {e}")
    
    logger.info(f"Taxi operator {operator_id} approved by admin {user.get('email')}")
    
    return {"ok": True, "message": "Operator freigeschaltet"}


@router.post("/admin/operator/{operator_id}/reject")
async def reject_taxi_operator(operator_id: str, request: Request, reason: str = ""):
    """Admin: Reject a taxi operator."""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    
    result = await db.taxi_operators.update_one(
        {"operator_id": operator_id},
        {"$set": {
            "status": "rejected",
            "rejection_reason": reason,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Operator nicht gefunden")
    
    return {"ok": True, "message": "Operator abgelehnt"}


@router.post("/admin/operator/{operator_id}/commission")
async def set_operator_commission(operator_id: str, request: Request):
    """Admin: Manually set commission rate for an operator."""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    
    body = await request.json()
    rate = body.get("rate", 0.05)
    
    if not (0 <= rate <= 0.20):
        raise HTTPException(status_code=400, detail="Rate must be between 0 and 20%")
    
    result = await db.taxi_operators.update_one(
        {"operator_id": operator_id},
        {"$set": {"commission_rate": rate, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Operator nicht gefunden")
    
    return {"ok": True, "message": f"Provision auf {rate*100:.0f}% gesetzt"}


# ══════════════════════════════════════════════════════════════════════════════
# PRICING CONFIGURATION — Standortbasiert
# ══════════════════════════════════════════════════════════════════════════════

# Regional pricing: Germany, Kosovo, Dubai, Default
REGIONAL_PRICING = {
    "germany": {
        "standard": {"base": 3.50, "per_km": 1.20, "per_minute": 0.25, "min_fare": 5.00},
        "premium": {"base": 5.00, "per_km": 2.00, "per_minute": 0.40, "min_fare": 10.00},
        "van": {"base": 4.00, "per_km": 1.50, "per_minute": 0.30, "min_fare": 8.00},
        "label": "DE-Tarif",
    },
    "kosovo": {
        "standard": {"base": 2.00, "per_km": 0.70, "per_minute": 0.00, "min_fare": 2.00},
        "premium": {"base": 2.00, "per_km": 1.05, "per_minute": 0.00, "min_fare": 3.00},
        "van": {"base": 2.00, "per_km": 0.90, "per_minute": 0.00, "min_fare": 3.00},
        "label": "Kosovo-Tarif: 2€ Start + Kilometer",
    },
    "dubai": {
        "standard": {"base": 3.00, "per_km": 0.90, "per_minute": 0.15, "min_fare": 5.00},
        "premium": {"base": 5.00, "per_km": 1.50, "per_minute": 0.25, "min_fare": 8.00},
        "van": {"base": 4.00, "per_km": 1.20, "per_minute": 0.20, "min_fare": 7.00},
        "label": "AE-Tarif",
    },
    "default": {
        "standard": {"base": 2.00, "per_km": 0.80, "per_minute": 0.15, "min_fare": 4.00},
        "premium": {"base": 4.00, "per_km": 1.30, "per_minute": 0.25, "min_fare": 7.00},
        "van": {"base": 3.00, "per_km": 1.00, "per_minute": 0.20, "min_fare": 6.00},
        "label": "Standard-Tarif",
    },
}

# Legacy fallback
PRICING = REGIONAL_PRICING["germany"]


def detect_region(lat: float, lng: float) -> str:
    """Detect pricing region from coordinates."""
    if 47 <= lat <= 55.5 and 5 <= lng <= 15.5:
        return "germany"
    if 41.5 <= lat <= 43.5 and 20 <= lng <= 22:
        return "kosovo"
    if 23 <= lat <= 27 and 53 <= lng <= 57:
        return "dubai"
    return "default"

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


class RideMessageRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=400)


def haversine_distance(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Calculate distance in km using Haversine formula."""
    R = 6371
    lat1_rad, lat2_rad = math.radians(lat1), math.radians(lat2)
    dlat, dlng = math.radians(lat2 - lat1), math.radians(lng2 - lng1)
    a = math.sin(dlat/2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(dlng/2)**2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))


def calculate_bearing(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Return visual bearing in degrees for rotating the taxi marker."""
    start_lat = math.radians(lat1)
    start_lng = math.radians(lng1)
    end_lat = math.radians(lat2)
    end_lng = math.radians(lng2)
    d_lng = end_lng - start_lng
    x = math.sin(d_lng) * math.cos(end_lat)
    y = math.cos(start_lat) * math.sin(end_lat) - math.sin(start_lat) * math.cos(end_lat) * math.cos(d_lng)
    bearing = math.degrees(math.atan2(x, y))
    return (bearing + 360) % 360


def calculate_fare(distance_km: float, duration_minutes: float, car_type: str, region: str = "germany") -> dict:
    """Calculate ride fare based on distance, time, car type and region."""
    region_pricing = REGIONAL_PRICING.get(region, REGIONAL_PRICING["default"])
    pricing = region_pricing.get(car_type, region_pricing["standard"])
    
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
        "region": region,
        "region_label": region_pricing.get("label", ""),
    }


async def _get_operator(request: Request):
    user = await get_current_user(request)
    email = (user.get("email") or "").lower().strip()
    operator = await db.taxi_operators.find_one({"email": email})
    if not operator:
        raise HTTPException(status_code=403, detail="Kein Taxi-Operator-Zugang")
    return operator, user


# ══════════════════════════════════════════════════════════════════════════════
# DRIVER REGISTRATION & MANAGEMENT
# ══════════════════════════════════════════════════════════════════════════════

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
        # Throttle: append to driver_path only if moved >= ~20m from last point
        # OR if >= 8 seconds since last sample (Trip-Replay needs ~smooth path).
        path = active_ride.get("driver_path") or []
        should_push = False
        if not path:
            should_push = True
        else:
            last = path[-1]
            try:
                dlat = (last.get("lat", 0) - lat)
                dlng = (last.get("lng", 0) - lng)
                # ~0.0002° latitude ≈ 22m
                if abs(dlat) + abs(dlng) > 0.0002:
                    should_push = True
                else:
                    # time-based fallback (helps trip-replay even when driver waits at red light)
                    try:
                        last_at = datetime.fromisoformat(last["at"].replace("Z", "+00:00"))
                        if (now - last_at).total_seconds() >= 8:
                            should_push = True
                    except Exception:
                        should_push = True
            except Exception:
                should_push = True
        update = {"$set": {"driver_location": {"lat": lat, "lng": lng}}}
        if should_push:
            update["$push"] = {"driver_path": {
                "lat": lat, "lng": lng, "at": now.isoformat(),
                "$slice": -300,  # cap to last 300 points (~25 min @ 5s polling)
            } if False else {"lat": lat, "lng": lng, "at": now.isoformat()}}
        await db.taxi_rides.update_one({"ride_id": active_ride["ride_id"]}, update)
    
    return {"ok": True}


@router.get("/rides/{ride_id}/path")
async def get_ride_path(ride_id: str, request: Request):
    """Return the recorded driver_path for a ride (Trip-Replay).
    Accessible to the ride's customer or driver."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    ride = await db.taxi_rides.find_one({"ride_id": ride_id}, {"_id": 0, "customer_id": 1, "driver_id": 1, "driver_path": 1, "pickup": 1, "dropoff": 1, "status": 1})
    if not ride:
        raise HTTPException(404, "Fahrt nicht gefunden")
    # auth: customer or assigned driver
    if user_id != ride.get("customer_id"):
        drv = await db.drivers.find_one({"user_id": user_id}, {"driver_id": 1, "_id": 0})
        if not drv or drv.get("driver_id") != ride.get("driver_id"):
            raise HTTPException(403, "Keine Berechtigung")
    return {
        "ok": True,
        "ride_id": ride_id,
        "status": ride.get("status"),
        "pickup": ride.get("pickup"),
        "dropoff": ride.get("dropoff"),
        "path": ride.get("driver_path") or [],
    }


# ══════════════════════════════════════════════════════════════════════════════
# CUSTOMER: GET NEARBY DRIVERS
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/drivers/nearby")
async def get_nearby_drivers(
    lat: float = 52.52,
    lng: float = 13.405,
    radius: float = 10.0,
    car_type: Optional[str] = None,
    with_pet: bool = False,
    luggage: Optional[str] = None,
    assistance: bool = False,
):
    """Get online drivers near location (public)."""
    
    query = {"online": True, "verified": True, "status": "approved"}
    if car_type:
        query["car.type"] = car_type
    if with_pet:
        query["car.pet_friendly"] = True
    if luggage == "much_combi":
        query["car.luggage_class"] = {"$in": ["much_combi", "combi", "wagon", "much"]}
    elif luggage == "much":
        query["car.luggage_class"] = {"$in": ["much", "much_combi", "combi", "wagon", "large"]}
    if assistance:
        query["car.assistance"] = True
    
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
@router.post("/estimate")
async def get_ride_estimate(req: EstimateRequest, request: Request = None):
    """Get price estimates for all vehicle types."""
    
    if not TAXI_MODULE_ENABLED:
        return {
            "module_enabled": False,
            "estimates": [],
            "message": "Taxi-Modul wird derzeit vorbereitet.",
        }
    
    p_lat, p_lng, d_lat, d_lng, p_addr, d_addr = req.get_coords()
    
    if not p_lat or not d_lat:
        raise HTTPException(400, "Koordinaten fehlen")
    
    distance_km = haversine_distance(p_lat, p_lng, d_lat, d_lng)
    # Sanity check: City-Taxi sollte nicht Cross-Country buchen können.
    MAX_RIDE_KM = 250
    if distance_km > MAX_RIDE_KM:
        raise HTTPException(
            400,
            f"Diese Strecke ({distance_km:.0f} km) übersteigt unsere maximale Fahrtdistanz von {MAX_RIDE_KM} km. "
            "Bitte buche stattdessen einen Langstreckentransfer.",
        )
    duration_minutes = max(5, (distance_km / 30) * 60)
    
    # Detect pricing region from pickup coordinates
    region = detect_region(p_lat, p_lng)

    # Multi-Tarif: Zone-Match + Time-Multiplier (P2)
    from utils.taxi_zone_pricing import find_matching_zone, compute_time_multiplier, apply_multi_tariff
    matched_zone = await find_matching_zone(p_lat, p_lng)
    time_info = compute_time_multiplier(matched_zone)

    # Optional promo validation
    promo_info = None
    if req.promo_code:
        try:
            from utils.taxi_promo import validate_promo
            user = None
            if request is not None:
                try:
                    user = await get_current_user(request)
                except Exception:
                    user = None
            uid = str(user.get("_id") or user.get("id")) if user else None
            promo_info = await validate_promo(req.promo_code, uid)
        except Exception:
            promo_info = {"valid": False, "code": req.promo_code, "reason": "internal_error"}

    VEHICLE_INFO = {
        "standard": {"name": "Standard", "description": "Komfortabel & günstig", "capacity": 4},
        "premium": {"name": "Premium", "description": "Luxus & Stil", "capacity": 4},
        "van": {"name": "Van / XL", "description": "Mehr Platz, Gepäck", "capacity": 7},
    }
    
    estimates = []
    for vtype in ["standard", "premium", "van"]:
        fare = calculate_fare(distance_km, duration_minutes, vtype, region)
        # Apply zone & time multipliers (P2 multi-tariff)
        fare = apply_multi_tariff(fare, matched_zone, time_info)
        info = VEHICLE_INFO[vtype]
        item = {
            "vehicle_type": vtype,
            "name": info["name"],
            "description": info["description"],
            "capacity": info["capacity"],
            "fare": fare["total"],
            "fare_range": {"min": round(fare["total"] * 0.9, 2), "max": round(fare["total"] * 1.15, 2)},
            "eta_minutes": max(3, round(duration_minutes * 0.05)),
            "distance_km": round(distance_km, 2),
            "duration_minutes": round(duration_minutes),
            "fare_breakdown": fare,
        }
        # Apply promo on top of computed fare (per-vehicle so user sees the impact)
        if promo_info and promo_info.get("valid"):
            from utils.taxi_promo import apply_discount
            disc = apply_discount(fare["total"], promo_info)
            item["fare_original"] = disc["original"]
            item["fare_discount"] = disc["discount"]
            item["fare"] = disc["final"]
        estimates.append(item)
    
    return {
        "module_enabled": True,
        "estimates": estimates,
        "surge": {"active": False, "multiplier": 1.0},
        "region": region,
        "region_label": REGIONAL_PRICING.get(region, {}).get("label", ""),
        "promo": promo_info,
        "tariff_zone": {
            "id": matched_zone.get("id"),
            "name": matched_zone.get("name"),
        } if matched_zone else None,
        "time_tariff": {
            "multiplier": time_info["multiplier"],
            "label": time_info["label"],
            "night": time_info["night"],
            "weekend": time_info["weekend"],
            "holiday": time_info["holiday"],
        },
    }


@router.get("/promo/validate")
async def validate_promo_endpoint(code: str, request: Request):
    """Validate a promo code for the current user (returns label, discount config)."""
    from utils.taxi_promo import validate_promo
    user = None
    try:
        user = await get_current_user(request)
    except Exception:
        user = None
    uid = str(user.get("_id") or user.get("id")) if user else None
    return await validate_promo(code, uid)


@router.get("/promo/active")
async def list_active_promos():
    """Public — returns currently usable promo codes (BUILTIN + active DB), without
    expiry/usage validation (UI shows a banner)."""
    from utils.taxi_promo import BUILTIN
    items = []
    for code, cfg in BUILTIN.items():
        items.append({
            "code": code,
            "label": cfg.get("label") or f"Code {code}",
            "type": cfg.get("type", "percent"),
            "value": cfg.get("value", 0),
            "max_off": cfg.get("max_off"),
            "builtin": True,
        })
    try:
        async for p in db.taxi_promo_codes.find({"active": True}, {"_id": 0}).sort("created_at", -1).limit(20):
            items.append({
                "code": p["code"],
                "label": p.get("label"),
                "type": p.get("type", "percent"),
                "value": p.get("value", 0),
                "max_off": p.get("max_off"),
                "expires_at": p.get("expires_at"),
                "builtin": False,
            })
    except Exception:
        pass
    return {"promos": items, "count": len(items)}


@router.post("/book")
async def book_ride(req: FlexBookRequest, request: Request):
    """Customer books a ride."""
    
    if not TAXI_MODULE_ENABLED:
        raise HTTPException(status_code=503, detail="Taxi-Modul ist derzeit nicht verfügbar")
    
    from core.payment_engine import TransactionType
    
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    balance = user.get("balance", 0)
    if balance < MIN_WALLET_BALANCE:
        raise HTTPException(
            status_code=400,
            detail=f"Mindestguthaben €{MIN_WALLET_BALANCE:.2f} erforderlich. Aktuell: €{balance:.2f}"
        )
    
    active = await db.taxi_rides.find_one({
        "customer_id": user_id,
        "status": {"$in": ["requested", "accepted", "arriving", "started"]}
    })
    if active and not req.scheduled_at:
        raise HTTPException(status_code=400, detail="Du hast bereits eine aktive Fahrt")
    
    p_lat, p_lng, d_lat, d_lng, p_addr, d_addr, car_type = req.get_coords()
    
    # Build the full route: pickup -> stops[] -> dropoff. Total distance sums all legs.
    waypoints = [
        {"lat": s.lat, "lng": s.lng, "address": s.address, "notes": s.notes or ""}
        for s in (req.stops or [])
    ]
    route_pts = [(p_lat, p_lng)] + [(s["lat"], s["lng"]) for s in waypoints] + [(d_lat, d_lng)]
    distance_km = 0.0
    for i in range(len(route_pts) - 1):
        distance_km += haversine_distance(*route_pts[i], *route_pts[i + 1])
    # Sanity check: City-Taxi sollte nicht Cross-Country buchen können.
    MAX_RIDE_KM = 250
    if distance_km > MAX_RIDE_KM:
        raise HTTPException(
            status_code=400,
            detail=f"Diese Strecke ({distance_km:.0f} km) übersteigt die maximale Fahrtdistanz von {MAX_RIDE_KM} km. Bitte buche einen Langstreckentransfer.",
        )
    duration_minutes = max(5, (distance_km / 30) * 60)
    region = detect_region(p_lat, p_lng)
    fare_estimate = calculate_fare(distance_km, duration_minutes, car_type, region)
    fare_total = fare_estimate["total"]

    # Apply promo if provided & valid
    promo_applied = None
    if req.promo_code:
        try:
            from utils.taxi_promo import validate_promo, apply_discount
            promo_info = await validate_promo(req.promo_code, user_id)
            if promo_info.get("valid"):
                disc = apply_discount(fare_total, promo_info)
                fare_total = disc["final"]
                promo_applied = {
                    "code": disc["code"],
                    "label": disc["label"],
                    "original": disc["original"],
                    "discount": disc["discount"],
                    "final": disc["final"],
                }
        except Exception:
            promo_applied = None
    
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
            "lat": p_lat,
            "lng": p_lng,
            "address": p_addr,
            "notes": (req.pickup_notes or "").strip(),
        },
        "dropoff": {
            "lat": d_lat,
            "lng": d_lng,
            "address": d_addr,
            "notes": (req.dropoff_notes or "").strip(),
        },
        "waypoints": waypoints,
        "car_type": car_type,
        "distance_km_estimate": round(distance_km, 2),
        "duration_estimate_minutes": round(duration_minutes),
        "fare_estimate": fare_total,
        "fare_estimate_original": fare_estimate["total"],
        "fare_breakdown": fare_estimate,
        "region": region,
        "region_label": REGIONAL_PRICING.get(region, {}).get("label", ""),
        "promo": promo_applied,
        "status": RideStatus.REQUESTED.value,
        "recipient": {
            "name": (req.recipient_name or "").strip(),
            "phone": (req.recipient_phone or req.rider_phone or "").strip(),
        },
        "options": {
            "language": req.language or "de",
            "with_pet": bool(req.with_pet),
            "luggage": req.luggage or "none",
            "assistance": bool(req.assistance),
            "notes": req.notes or "",
            "booking_mode": req.booking_mode or ("later" if req.scheduled_at else "now"),
            "scheduled_at": req.scheduled_at,  # None = now
        },
        "created_at": now.isoformat(),
        "status_history": [{"status": "requested", "at": now.isoformat()}],
    }
    
    await db.taxi_rides.insert_one(ride)
    ride.pop("_id", None)

    # Promo redemption tracking (idempotent per ride)
    if promo_applied:
        try:
            from utils.taxi_promo import record_redemption
            await record_redemption(user_id, promo_applied["code"], ride_id, promo_applied["discount"])
        except Exception as e:
            logger.warning(f"Failed to record promo redemption: {e}")
    
    # Track recent addresses (pickup + dropoff + any stops) so the search-sheet
    # can show "Letzte Adressen" on the next booking.
    async def _track_recent(addr, lat, lng):
        if not (addr and lat and lng):
            return
        try:
            await db.taxi_recent_addresses.update_one(
                {"user_id": user_id, "address": addr},
                {
                    "$set": {"lat": lat, "lng": lng, "last_used_at": now.isoformat()},
                    "$inc": {"use_count": 1},
                },
                upsert=True,
            )
        except Exception as e:
            logger.warning(f"Failed to track recent address: {e}")
    await _track_recent(p_addr, p_lat, p_lng)
    await _track_recent(d_addr, d_lat, d_lng)
    for s in waypoints:
        await _track_recent(s["address"], s["lat"], s["lng"])
    
    # Find nearby drivers and notify them (in real app, use push notifications).
    # Filter by ride options: vehicle must be pet-friendly if requested, and have
    # sufficient luggage capacity (combi/wagon for 'much_combi', any for 'much', etc.).
    driver_query = {
        "online": True,
        "verified": True,
        "status": "approved",
        "car.type": car_type,
    }
    if req.with_pet:
        driver_query["car.pet_friendly"] = True
    if req.luggage == "much_combi":
        driver_query["car.luggage_class"] = {"$in": ["much_combi", "combi", "wagon", "much"]}
    elif req.luggage == "much":
        driver_query["car.luggage_class"] = {"$in": ["much", "much_combi", "combi", "wagon", "large"]}
    if req.assistance:
        driver_query["car.assistance"] = True
    
    nearby_drivers = await db.drivers.find(driver_query).to_list(50)
    
    # Filter by distance from pickup
    matching_drivers = []
    for d in nearby_drivers:
        loc = d.get("location", {})
        if loc.get("lat"):
            dist = haversine_distance(p_lat, p_lng, loc["lat"], loc["lng"])
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
            "cancellation_reason": req.reason or None,
        },
        "$push": {"status_history": {"status": "cancelled", "at": now.isoformat(), "by": cancelled_by, "reason": req.reason or None}}}
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
    """Customer gets their active ride (with enriched driver data: photo, plate, ETA)."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    ride = await db.taxi_rides.find_one({
        "customer_id": user_id,
        "status": {"$in": ["requested", "accepted", "arriving", "started"]}
    }, {"_id": 0})
    
    if not ride:
        return {"has_active": False, "rides": []}

    ride = await _enrich_ride_with_driver(ride)
    return {"has_active": True, "rides": [ride]}


async def _enrich_ride_with_driver(ride: dict) -> dict:
    """Add ride.driver{...} nested object and live driver_lat/lng + eta_minutes for the frontend."""
    drv_id = ride.get("driver_id")
    if not drv_id:
        return ride
    d = await db.drivers.find_one({"driver_id": drv_id}, {"_id": 0})
    if not d:
        return ride
    loc = d.get("location") or {}
    pickup = ride.get("pickup") or {}
    eta = None
    try:
        if loc.get("lat") is not None and pickup.get("lat") is not None:
            # haversine in km
            from math import radians, sin, cos, asin, sqrt
            lat1, lon1 = radians(loc["lat"]), radians(loc["lng"])
            lat2, lon2 = radians(pickup["lat"]), radians(pickup["lng"])
            dlat = lat2 - lat1
            dlon = lon2 - lon1
            a = sin(dlat / 2) ** 2 + cos(lat1) * cos(lat2) * sin(dlon / 2) ** 2
            km = 2 * asin(sqrt(a)) * 6371
            # rough: 30 km/h avg city → minutes
            eta = max(1, round(km / 30 * 60))
    except Exception:
        eta = None
    car = d.get("car") or {}
    target = ride.get("dropoff") if ride.get("status") == RideStatus.STARTED.value else ride.get("pickup")
    driver_bearing = None
    try:
        if loc.get("lat") is not None and target and target.get("lat") is not None:
            driver_bearing = calculate_bearing(loc["lat"], loc["lng"], target["lat"], target["lng"])
    except Exception:
        driver_bearing = None
    ride["driver"] = {
        "driver_id": d.get("driver_id"),
        "name": d.get("user_name") or ride.get("driver_name") or "",
        "photo_url": d.get("photo_url", ""),
        "phone": d.get("phone", ""),
        "rating": d.get("rating", 5.0),
        "total_rides": d.get("total_rides", 0),
        "eta_minutes": eta,
        "vehicle": {
            "model": f"{car.get('brand','')} {car.get('model','')}".strip() or None,
            "plate": car.get("license_plate"),
            "color": car.get("color"),
            "year": car.get("year"),
            "type": car.get("type"),
        },
    }
    if loc.get("lat") is not None:
        ride["driver_lat"] = loc["lat"]
        ride["driver_lng"] = loc["lng"]
    if driver_bearing is not None:
        ride["driver_bearing"] = round(driver_bearing, 2)
    return ride


async def _get_ride_party_role(ride: dict, user: dict) -> Optional[str]:
    user_id = str(user.get("_id") or user.get("id") or "")
    if ride.get("customer_id") == user_id:
        return "customer"
    driver = await db.drivers.find_one({"user_id": user_id}, {"_id": 0, "driver_id": 1})
    if driver and ride.get("driver_id") == driver.get("driver_id"):
        return "driver"
    if user.get("role") == "admin":
        return "admin"
    return None


def _normalize_ride_messages(ride: dict) -> List[dict]:
    messages = ride.get("ride_messages") or []
    normalized = []
    for message in messages[-50:]:
        normalized.append({
            "message_id": message.get("message_id"),
            "sender_role": message.get("sender_role", "customer"),
            "sender_name": message.get("sender_name", "BidBlitz"),
            "text": message.get("text", ""),
            "sent_at": message.get("sent_at", ""),
        })
    return normalized


@router.get("/rides/{ride_id}/messages")
async def get_ride_messages(ride_id: str, request: Request):
    """Customer or assigned driver gets ride chat messages."""
    user = await get_current_user(request)
    ride = await db.taxi_rides.find_one({"ride_id": ride_id}, {"_id": 0})
    if not ride:
        raise HTTPException(status_code=404, detail="Fahrt nicht gefunden")
    role = await _get_ride_party_role(ride, user)
    if not role:
        raise HTTPException(status_code=403, detail="Keine Berechtigung für diese Fahrt")
    return {"ok": True, "role": role, "messages": _normalize_ride_messages(ride)}


@router.post("/rides/{ride_id}/messages")
async def send_ride_message(ride_id: str, req: RideMessageRequest, request: Request):
    """Customer or assigned driver sends a short ride message."""
    user = await get_current_user(request)
    ride = await db.taxi_rides.find_one({"ride_id": ride_id}, {"_id": 0})
    if not ride:
        raise HTTPException(status_code=404, detail="Fahrt nicht gefunden")
    role = await _get_ride_party_role(ride, user)
    if not role:
        raise HTTPException(status_code=403, detail="Keine Berechtigung für diese Fahrt")

    now = datetime.now(timezone.utc)
    text = (req.text or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="Nachricht darf nicht leer sein")

    sender_name = user.get("name") or ("Fahrer" if role == "driver" else "Kunde")
    message = {
        "message_id": secrets.token_hex(6),
        "sender_role": role,
        "sender_name": sender_name,
        "text": text[:400],
        "sent_at": now.isoformat(),
    }
    await db.taxi_rides.update_one(
        {"ride_id": ride_id},
        {
            "$push": {"ride_messages": {"$each": [message], "$slice": -50}},
            "$set": {"updated_at": now.isoformat()},
        },
    )
    return {"ok": True, "message": message}


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
    """Admin: Approve a driver. Also propagates vehicle_capabilities from
    any matching driver-onboarding application (by email) into drivers.car.*."""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    
    driver = await db.drivers.find_one({"driver_id": driver_id})
    if not driver:
        raise HTTPException(status_code=404, detail="Fahrer nicht gefunden")
    
    # Look up matching onboarding application by driver's user email
    car_patch = {}
    driver_email = (driver.get("user_email") or "").lower()
    if driver_email:
        app = await db.taxi_driver_applications.find_one(
            {"email": driver_email, "status": {"$in": ["pending", "approved"]}}
        )
        if app and app.get("vehicle_capabilities"):
            caps = app["vehicle_capabilities"]
            car_patch = {
                "car.pet_friendly": bool(caps.get("pet_friendly", False)),
                "car.luggage_class": caps.get("luggage_class", "small"),
                "car.assistance": bool(caps.get("assistance", False)),
            }
            # Mark the application as approved if not yet
            if app.get("status") != "approved":
                await db.taxi_driver_applications.update_one(
                    {"application_id": app["application_id"]},
                    {"$set": {
                        "status": "approved",
                        "reviewed_at": datetime.now(timezone.utc).isoformat(),
                        "reviewed_by": str(user["_id"]),
                    }}
                )
    
    update_set = {
        "status": "approved",
        "verified": True,
        "approved_at": datetime.now(timezone.utc).isoformat(),
        "approved_by": str(user["_id"]),
        **car_patch,
    }
    
    await db.drivers.update_one(
        {"driver_id": driver_id},
        {"$set": update_set}
    )
    
    # Update user
    await db.users.update_one(
        {"_id": ObjectId(driver["user_id"])},
        {"$set": {"driver_status": "approved"}}
    )
    
    return {
        "ok": True,
        "message": "Fahrer freigegeben",
        "capabilities_propagated": bool(car_patch),
    }


# ── Driver Application Workflow (admin) ──────────────────────────────────────

@router.get("/admin/applications")
async def list_driver_applications(request: Request, status: Optional[str] = None):
    """Admin: List all driver onboarding applications (filter by status)."""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    query = {}
    if status:
        query["status"] = status
    apps = await db.taxi_driver_applications.find(
        query, {"_id": 0}
    ).sort("created_at", -1).to_list(200)
    return {
        "applications": apps,
        "stats": {
            "total": len(apps),
            "pending": len([a for a in apps if a.get("status") == "pending"]),
            "approved": len([a for a in apps if a.get("status") == "approved"]),
            "rejected": len([a for a in apps if a.get("status") == "rejected"]),
        },
    }


@router.post("/admin/applications/{application_id}/approve")
async def approve_driver_application(application_id: str, request: Request):
    """Admin: Approve an onboarding application. Creates a driver record
    in db.drivers with vehicle_capabilities propagated to car.* fields."""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    
    app = await db.taxi_driver_applications.find_one({"application_id": application_id})
    if not app:
        raise HTTPException(status_code=404, detail="Bewerbung nicht gefunden")
    if app.get("status") == "approved" and app.get("driver_id"):
        return {"ok": True, "message": "Bereits freigeschaltet", "driver_id": app["driver_id"]}
    
    caps = app.get("vehicle_capabilities") or {}
    now = datetime.now(timezone.utc)
    driver_id = secrets.token_hex(8)
    
    # Look up the user (driver may already have an account)
    applicant_user = await db.users.find_one({"email": app["email"].lower()})
    user_id = str(applicant_user["_id"]) if applicant_user else None
    
    driver = {
        "driver_id": driver_id,
        "user_id": user_id,
        "user_email": app["email"],
        "user_name": app["name"],
        "phone": app["phone"],
        "license_number": app["license_number"],
        "driver_type": app.get("driver_type", "private"),
        "car": {
            "type": app.get("vehicle_type", "standard"),
            "pet_friendly": bool(caps.get("pet_friendly", False)),
            "luggage_class": caps.get("luggage_class", "small"),
            "assistance": bool(caps.get("assistance", False)),
        },
        "verified": True,
        "status": "approved",
        "online": False,
        "location": {"lat": 0, "lng": 0},
        "rating": 5.0,
        "total_rides": 0,
        "total_earnings": 0,
        "approved_at": now.isoformat(),
        "approved_by": str(user["_id"]),
        "created_at": now.isoformat(),
    }
    await db.drivers.insert_one(driver)
    driver.pop("_id", None)
    
    # Mark application as approved + linked
    await db.taxi_driver_applications.update_one(
        {"application_id": application_id},
        {"$set": {
            "status": "approved",
            "driver_id": driver_id,
            "reviewed_at": now.isoformat(),
            "reviewed_by": str(user["_id"]),
        }}
    )
    
    # Flag the user as a driver if they have an account
    if applicant_user:
        await db.users.update_one(
            {"_id": applicant_user["_id"]},
            {"$set": {"is_driver": True, "driver_status": "approved", "taxi_driver_id": driver_id}}
        )
    
    return {"ok": True, "message": "Bewerbung freigeschaltet", "driver_id": driver_id, "driver": driver}


@router.post("/admin/applications/{application_id}/reject")
async def reject_driver_application(application_id: str, request: Request):
    """Admin: Reject an onboarding application."""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    res = await db.taxi_driver_applications.update_one(
        {"application_id": application_id},
        {"$set": {
            "status": "rejected",
            "reviewed_at": datetime.now(timezone.utc).isoformat(),
            "reviewed_by": str(user["_id"]),
        }}
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Bewerbung nicht gefunden")
    return {"ok": True, "message": "Bewerbung abgelehnt"}


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


# ══════════════════════════════════════════════════════════════════════════════
# SAVED PLACES (Gespeicherte Orte: Zuhause, Arbeit, etc.)
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/saved-places")
async def get_saved_places(request: Request):
    user = await get_current_user(request)
    places = await db.taxi_saved_places.find(
        {"user_email": user.get("email", "")}, {"_id": 0}
    ).sort("created_at", 1).to_list(20)
    return {"places": places}

@router.post("/saved-places")
async def save_place(req: SavePlaceReq, request: Request):
    user = await get_current_user(request)
    email = user.get("email", "")
    # Check if name already exists, update it
    existing = await db.taxi_saved_places.find_one({"user_email": email, "name": req.name})
    if existing:
        await db.taxi_saved_places.update_one(
            {"user_email": email, "name": req.name},
            {"$set": {"address": req.address, "lat": req.lat, "lng": req.lng, "icon": req.icon}}
        )
    else:
        await db.taxi_saved_places.insert_one({
            "place_id": secrets.token_hex(6),
            "user_email": email,
            "name": req.name,
            "icon": req.icon,
            "address": req.address,
            "lat": req.lat,
            "lng": req.lng,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    return {"ok": True}

@router.delete("/saved-places/{place_id}")
async def delete_saved_place(place_id: str, request: Request):
    user = await get_current_user(request)
    await db.taxi_saved_places.delete_one({"place_id": place_id, "user_email": user.get("email", "")})
    return {"ok": True}


# ── Recent Addresses (auto-tracked on each booking) ──────────────────────────

@router.get("/recent-addresses")
async def list_recent_addresses(request: Request, limit: int = 10):
    """Return the user's most recently used addresses (pickup + dropoff + stops)."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    limit = max(1, min(50, limit))
    cursor = db.taxi_recent_addresses.find(
        {"user_id": user_id},
        {"_id": 0, "user_id": 0},
    ).sort("last_used_at", -1).limit(limit)
    items = await cursor.to_list(limit)
    return {"addresses": items}


@router.delete("/recent-addresses")
async def clear_recent_addresses(request: Request):
    user = await get_current_user(request)
    user_id = str(user["_id"])
    await db.taxi_recent_addresses.delete_many({"user_id": user_id})
    return {"ok": True}


# ── Favorite Routes (Top pickup→dropoff pairs from ride history) ─────────────

@router.get("/favorite-routes")
async def list_favorite_routes(request: Request, limit: int = 5):
    """Return the user's top N most-used pickup→dropoff routes, derived from
    completed rides. Useful for one-tap rebooking on the home screen."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    limit = max(1, min(20, limit))
    pipeline = [
        {"$match": {
            "customer_id": user_id,
            "status": {"$in": ["completed", "started", "arriving", "accepted"]},
            "pickup.address": {"$exists": True, "$ne": ""},
            "dropoff.address": {"$exists": True, "$ne": ""},
        }},
        {"$group": {
            "_id": {
                "pickup_address": "$pickup.address",
                "dropoff_address": "$dropoff.address",
            },
            "use_count": {"$sum": 1},
            "last_used_at": {"$max": "$created_at"},
            "avg_fare": {"$avg": "$fare_estimate"},
            "pickup_lat": {"$last": "$pickup.lat"},
            "pickup_lng": {"$last": "$pickup.lng"},
            "dropoff_lat": {"$last": "$dropoff.lat"},
            "dropoff_lng": {"$last": "$dropoff.lng"},
        }},
        {"$sort": {"use_count": -1, "last_used_at": -1}},
        {"$limit": limit},
        {"$project": {
            "_id": 0,
            "pickup": {
                "address": "$_id.pickup_address",
                "lat": "$pickup_lat",
                "lng": "$pickup_lng",
            },
            "dropoff": {
                "address": "$_id.dropoff_address",
                "lat": "$dropoff_lat",
                "lng": "$dropoff_lng",
            },
            "use_count": 1,
            "last_used_at": 1,
            "avg_fare": {"$round": ["$avg_fare", 2]},
        }},
    ]
    routes = await db.taxi_rides.aggregate(pipeline).to_list(limit)
    return {"routes": routes}


# ── City Defaults (per-pickup-city ride options) ─────────────────────────────

class CityDefaultRequest(BaseModel):
    city: str = Field(..., min_length=1, max_length=120)
    options: dict


@router.get("/city-defaults/{city}")
async def get_city_default(city: str, request: Request):
    """Get saved default ride options for this pickup city."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    doc = await db.taxi_city_defaults.find_one(
        {"user_id": user_id, "city": city.lower().strip()},
        {"_id": 0, "user_id": 0},
    )
    return {"default": doc}


@router.post("/city-defaults")
async def save_city_default(req: CityDefaultRequest, request: Request):
    user = await get_current_user(request)
    user_id = str(user["_id"])
    now = datetime.now(timezone.utc).isoformat()
    await db.taxi_city_defaults.update_one(
        {"user_id": user_id, "city": req.city.lower().strip()},
        {"$set": {
            "user_id": user_id,
            "city": req.city.lower().strip(),
            "city_label": req.city,
            "options": req.options or {},
            "updated_at": now,
        }},
        upsert=True,
    )
    return {"ok": True}


@router.delete("/city-defaults/{city}")
async def delete_city_default(city: str, request: Request):
    user = await get_current_user(request)
    user_id = str(user["_id"])
    await db.taxi_city_defaults.delete_one(
        {"user_id": user_id, "city": city.lower().strip()}
    )
    return {"ok": True}



# ══════════════════════════════════════════════════════════════════════════════
# TAXI COMPANY VEHICLES (fleet management)
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/operator/vehicles")
async def list_company_vehicles(request: Request):
    op, _ = await _get_operator(request)
    cursor = db.taxi_company_vehicles.find(
        {"company_id": op["operator_id"]}, {"_id": 0}
    ).sort("created_at", -1)
    vehicles = await cursor.to_list(500)
    return {"vehicles": vehicles, "count": len(vehicles)}


@router.post("/operator/vehicles")
async def add_company_vehicle(req: VehicleCreateRequest, request: Request):
    op, user = await _get_operator(request)
    # Check duplicate plate within company
    existing = await db.taxi_company_vehicles.find_one({
        "company_id": op["operator_id"],
        "plate_number": req.plate_number.upper().replace(" ", ""),
    })
    if existing:
        raise HTTPException(400, "Kennzeichen bereits registriert")
    now = datetime.now(timezone.utc).isoformat()
    vid = "veh_" + secrets.token_hex(5)
    doc = {
        "vehicle_id": vid,
        "company_id": op["operator_id"],
        "driver_id": req.driver_id,
        "vehicle_type": req.vehicle_type,
        "brand": req.brand,
        "model": req.model,
        "plate_number": req.plate_number.upper().replace(" ", ""),
        "year": req.year,
        "color": req.color,
        "status": "active",
        "created_at": now,
        "updated_at": now,
    }
    await db.taxi_company_vehicles.insert_one(doc)
    doc.pop("_id", None)
    return {"ok": True, "vehicle": doc}


@router.patch("/operator/vehicles/{vehicle_id}")
async def update_company_vehicle(vehicle_id: str, req: VehicleUpdateRequest, request: Request):
    op, _ = await _get_operator(request)
    upd = {k: v for k, v in req.model_dump(exclude_unset=True).items() if v is not None}
    if not upd:
        return {"ok": True}
    upd["updated_at"] = datetime.now(timezone.utc).isoformat()
    result = await db.taxi_company_vehicles.update_one(
        {"vehicle_id": vehicle_id, "company_id": op["operator_id"]},
        {"$set": upd},
    )
    if result.matched_count == 0:
        raise HTTPException(404, "Fahrzeug nicht gefunden")
    return {"ok": True}


@router.delete("/operator/vehicles/{vehicle_id}")
async def delete_company_vehicle(vehicle_id: str, request: Request):
    op, _ = await _get_operator(request)
    result = await db.taxi_company_vehicles.delete_one({
        "vehicle_id": vehicle_id, "company_id": op["operator_id"]
    })
    if result.deleted_count == 0:
        raise HTTPException(404, "Fahrzeug nicht gefunden")
    return {"ok": True}


# ══════════════════════════════════════════════════════════════════════════════
# NEARBY ENDPOINTS - For Live Maps (Taxi & Driver Mode)
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/nearby")
async def get_nearby_taxis(lat: float = 25.2048, lng: float = 55.2708, radius: float = 5.0):
    """
    Get nearby available taxis (for customer view on NearbyPage).
    Returns online drivers from both taxi operators and private drivers.
    """
    # Get business drivers (from taxi operators)
    operators = await db.taxi_operators.find({"status": "approved"}).to_list(100)
    business_drivers = []
    for op in operators:
        for driver in op.get("drivers", []):
            if driver.get("is_online") and driver.get("status") == "active":
                # Get driver location
                loc = await db.driver_locations.find_one({"driver_id": driver["driver_id"]}, {"_id": 0})
                if loc:
                    dist = haversine_distance(lat, lng, loc["lat"], loc["lng"])
                    if dist <= radius:
                        business_drivers.append({
                            "driver_id": driver["driver_id"],
                            "name": driver.get("name", "Fahrer"),
                            "vehicle": f"{driver.get('vehicle_model', 'Standard')} ({driver.get('vehicle_plate', '')})",
                            "car_type": driver.get("car_type", "standard"),
                            "rating": driver.get("rating", 5.0),
                            "lat": loc["lat"],
                            "lng": loc["lng"],
                            "distance_km": round(dist, 2),
                            "type": "business",
                        })
    
    # Get private drivers
    private_driver_users = await db.users.find({
        "is_private_driver": True,
        "driver_online": True
    }, {"_id": 0, "private_driver_id": 1, "name": 1}).to_list(100)
    
    private_drivers = []
    for user in private_driver_users:
        driver_id = user.get("private_driver_id")
        if not driver_id:
            continue
        driver_doc = await db.private_drivers.find_one({"driver_id": driver_id}, {"_id": 0})
        if driver_doc and driver_doc.get("status") == "approved":
            # Get location from driver_locations
            loc = await db.driver_locations.find_one({"driver_id": driver_id}, {"_id": 0})
            if loc:
                dist = haversine_distance(lat, lng, loc["lat"], loc["lng"])
                if dist <= radius:
                    private_drivers.append({
                        "driver_id": driver_id,
                        "name": user.get("name", "Privatfahrer"),
                        "vehicle": f"{driver_doc.get('vehicle_model', 'Standard')} ({driver_doc.get('vehicle_plate', '')})",
                        "car_type": driver_doc.get("car_type", "standard"),
                        "rating": driver_doc.get("rating", 5.0),
                        "lat": loc["lat"],
                        "lng": loc["lng"],
                        "distance_km": round(dist, 2),
                        "type": "private",
                    })
    
    all_drivers = business_drivers + private_drivers
    all_drivers.sort(key=lambda x: x["distance_km"])
    
    return {
        "drivers": all_drivers[:20],
        "total": len(all_drivers),
    }


@router.get("/driver/nearby")
async def get_nearby_drivers_for_map(lat: float = 25.2048, lng: float = 55.2708, radius: float = 5.0):
    """
    Same as /nearby but aliased for driver dashboard maps.
    Returns online drivers for visualization.
    """
    return await get_nearby_taxis(lat, lng, radius)


# ══════════════════════════════════════════════════════════════════════════════
# SOS / EMERGENCY  (P0 — Safety Feature)
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/sos")
async def trigger_sos(req: SosRequest, request: Request):
    """
    Customer or driver triggers SOS during a ride.
    Stores the alert and notifies admin/operator. Frontend can additionally
    open the native phone dialer to local emergency services (e.g. 112).
    """
    user = await get_current_user(request)
    user_id = str(user["_id"])
    now = datetime.now(timezone.utc).isoformat()

    ride = None
    if req.ride_id:
        ride = await db.taxi_rides.find_one({"ride_id": req.ride_id}, {"_id": 0})

    alert = {
        "alert_id": secrets.token_hex(8),
        "type": "sos",
        "user_id": user_id,
        "user_name": user.get("name", ""),
        "user_phone": user.get("phone", ""),
        "ride_id": req.ride_id,
        "driver_id": ride.get("driver_id") if ride else None,
        "lat": req.lat,
        "lng": req.lng,
        "note": req.note or "",
        "status": "open",
        "created_at": now,
    }
    await db.taxi_sos_alerts.insert_one(alert)
    alert.pop("_id", None)

    # Notify admin via in-app notification
    await db.notifications.insert_one({
        "id": secrets.token_hex(8),
        "user_id": "admin",
        "type": "sos_alert",
        "title": "🚨 SOS Alert",
        "message": f"{user.get('name', 'User')} hat SOS ausgelöst (Ride {req.ride_id or '-'})",
        "data": {"alert_id": alert["alert_id"], "lat": req.lat, "lng": req.lng},
        "read": False,
        "created_at": now,
    })

    return {
        "ok": True,
        "alert_id": alert["alert_id"],
        "emergency_numbers": {"de": "112", "at": "112", "ch": "112", "ks": "112", "ae": "999"},
        "message": "Notruf registriert. Wähle 112 für sofortige Hilfe.",
    }


# ══════════════════════════════════════════════════════════════════════════════
# TRIP RECEIPT  (P0 — Post-Ride Receipt)
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/rides/{ride_id}/receipt.pdf")
async def get_ride_receipt_pdf(ride_id: str, request: Request):
    """PDF-Quittung für eine abgeschlossene Fahrt (DE 7% USt-konform)."""
    from fastapi.responses import Response
    user = await get_current_user(request)
    user_id = str(user["_id"])
    ride = await db.taxi_rides.find_one({"ride_id": ride_id}, {"_id": 0})
    if not ride:
        raise HTTPException(status_code=404, detail="Fahrt nicht gefunden")
    if ride.get("customer_id") != user_id and ride.get("driver_id") != user_id and user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Nicht berechtigt")
    if ride.get("status") not in ("completed", "cancelled"):
        raise HTTPException(status_code=400, detail="Fahrt noch nicht abgeschlossen")
    # Normalisiere ride dict für PDF
    pdf_ride = {
        **ride,
        "fare": ride.get("final_fare") or ride.get("estimated_fare") or 0,
        "distance_km": ride.get("distance_km", 0),
        "duration_min": ride.get("duration_minutes", 0),
        "vehicle_type": ride.get("car_type", "standard"),
    }
    corporate = None
    if ride.get("corporate_account_id"):
        corporate = await db.taxi_corporate_accounts.find_one(
            {"id": ride["corporate_account_id"]}, {"_id": 0},
        )
    try:
        from utils.taxi_receipt_pdf import generate_receipt_pdf
        pdf = generate_receipt_pdf(pdf_ride, user=user, corporate_account=corporate)
    except Exception as e:
        raise HTTPException(500, f"PDF-Generierung fehlgeschlagen: {e}")
    return Response(content=pdf, media_type="application/pdf",
                    headers={"Content-Disposition": f'attachment; filename="quittung-{ride_id[:8]}.pdf"'})


@router.get("/rides/{ride_id}/receipt")
async def get_ride_receipt(ride_id: str, request: Request):
    """Itemised receipt for a completed ride."""
    user = await get_current_user(request)
    user_id = str(user["_id"])

    ride = await db.taxi_rides.find_one({"ride_id": ride_id}, {"_id": 0})
    if not ride:
        raise HTTPException(status_code=404, detail="Fahrt nicht gefunden")
    if ride.get("customer_id") != user_id and ride.get("driver_id") != user_id:
        raise HTTPException(status_code=403, detail="Nicht berechtigt")
    if ride.get("status") not in ("completed", "cancelled"):
        raise HTTPException(status_code=400, detail="Fahrt noch nicht abgeschlossen")

    fare = float(ride.get("final_fare") or ride.get("estimated_fare") or 0)
    distance_km = float(ride.get("distance_km") or ride.get("distance_km_estimate") or 0)
    duration_min = float(ride.get("duration_minutes") or ride.get("duration_estimate_minutes") or 0)
    car_type = ride.get("car_type", "standard")
    region = ride.get("region", "germany")
    pricing = REGIONAL_PRICING.get(region, REGIONAL_PRICING["default"]).get(car_type, {})
    tip = float(ride.get("tip", 0) or 0)

    breakdown = [
        {"label": "Grundpreis", "amount": pricing.get("base", 0)},
        {"label": f"Distanz ({distance_km:.1f} km)", "amount": round(distance_km * pricing.get("per_km", 0), 2)},
        {"label": f"Zeit ({duration_min:.0f} min)", "amount": round(duration_min * pricing.get("per_minute", 0), 2)},
    ]
    if tip > 0:
        breakdown.append({"label": "Trinkgeld", "amount": tip})

    return {
        "ride_id": ride_id,
        "reference": ride.get("reference") or f"RIDE-{ride_id[:6].upper()}",
        "status": ride.get("status"),
        "from": ride.get("pickup_address") or ride.get("pickup", {}).get("address"),
        "to": ride.get("dropoff_address") or ride.get("dropoff", {}).get("address"),
        "distance_km": distance_km,
        "duration_minutes": duration_min,
        "car_type": car_type,
        "region": region,
        "pricing_label": REGIONAL_PRICING.get(region, REGIONAL_PRICING["default"]).get("label", ""),
        "breakdown": breakdown,
        "subtotal": round(fare - tip, 2),
        "tip": tip,
        "total": round(fare, 2),
        "currency": "EUR",
        "driver_name": ride.get("driver_name", ""),
        "vehicle": ride.get("vehicle", ""),
        "created_at": ride.get("created_at"),
        "completed_at": ride.get("completed_at"),
    }


# ══════════════════════════════════════════════════════════════════════════════
# ADD TIP AFTER RIDE  (P0)
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/rides/tip")
async def add_ride_tip(req: TipRequest, request: Request):
    """Add a tip to a completed ride. Charges customer wallet, credits driver."""
    from core.payment_engine import debit_wallet, TransactionType

    user = await get_current_user(request)
    user_id = str(user["_id"])

    ride = await db.taxi_rides.find_one({"ride_id": req.ride_id})
    if not ride or ride.get("customer_id") != user_id:
        raise HTTPException(status_code=403, detail="Nicht berechtigt")
    if ride.get("status") != "completed":
        raise HTTPException(status_code=400, detail="Fahrt nicht abgeschlossen")
    if ride.get("tip", 0) > 0:
        raise HTTPException(status_code=400, detail="Trinkgeld bereits hinzugefügt")
    if req.amount <= 0:
        raise HTTPException(status_code=400, detail="Betrag muss > 0 sein")

    # Charge customer
    pay = await debit_wallet(
        user_id=user_id,
        amount=req.amount,
        tx_type=TransactionType.TAXI_PAYMENT,
        description=f"Trinkgeld Fahrt {req.ride_id[:6].upper()}",
        reference=f"TIP-{req.ride_id[:6].upper()}",
    )
    if not pay.success:
        raise HTTPException(status_code=400, detail=pay.error)

    # Credit driver
    if ride.get("driver_id"):
        try:
            await db.users.update_one(
                {"_id": ObjectId(ride["driver_id"])},
                {"$inc": {"balance": req.amount, "earnings": req.amount}},
            )
        except Exception:
            pass

    await db.taxi_rides.update_one(
        {"ride_id": req.ride_id},
        {"$set": {"tip": req.amount, "tip_at": datetime.now(timezone.utc).isoformat()}}
    )

    return {"ok": True, "tip": req.amount}



# ══════════════════════════════════════════════════════════════════════════════
# Mapbox Geocoding Proxy — falls Frontend-Bundle keinen REACT_APP_MAPBOX_TOKEN hat
# (z.B. wenn auf Production der GitHub-Secret nicht gesetzt wurde), kann das
# Frontend auf diesen Backend-Proxy zurückfallen. Backend nutzt MAPBOX_TOKEN
# aus seiner .env.
# ══════════════════════════════════════════════════════════════════════════════

def _server_mapbox_token() -> str:
    import os
    return (
        os.environ.get("MAPBOX_TOKEN")
        or os.environ.get("REACT_APP_MAPBOX_TOKEN")
        or ""
    )


@router.get("/geocode")
async def taxi_geocode(
    q: str,
    lng: Optional[float] = None,
    lat: Optional[float] = None,
    lang: str = "de",
    limit: int = 8,
    country: Optional[str] = None,
):
    """
    Forward-geocode (autocomplete) Endpoint. Frontend nutzt diesen Proxy,
    wenn `REACT_APP_MAPBOX_TOKEN` build-time fehlt. Optional `lng,lat` für
    Proximity-Bias (näher gelegene Vorschläge zuerst).
    """
    q = (q or "").strip()
    if len(q) < 1:
        return {"features": []}

    token = _server_mapbox_token()
    if not token:
        raise HTTPException(503, "Geocoding not configured (MAPBOX_TOKEN missing on server).")

    import httpx
    params = {
        "access_token": token,
        "language": lang,
        "limit": str(max(1, min(limit, 10))),
        "types": "address,poi,place,locality,neighborhood,postcode,district",
        "autocomplete": "true",
    }
    if country:
        params["country"] = country
    if lng is not None and lat is not None:
        params["proximity"] = f"{lng},{lat}"
        params["bbox"] = f"{lng - 1.4},{lat - 1.4},{lng + 1.4},{lat + 1.4}"

    try:
        async with httpx.AsyncClient(timeout=4.0) as client:
            r = await client.get(
                f"https://api.mapbox.com/geocoding/v5/mapbox.places/{quote(q)}.json",
                params=params,
            )
            if r.status_code != 200:
                return {"features": [], "upstream_status": r.status_code}
            data = r.json()
    except Exception as e:
        logger.warning(f"geocode proxy error: {e}")
        return {"features": [], "error": "upstream_timeout"}

    # Minimal, frontend-friendly shape (matches what Mapbox returns natively,
    # so existing useTaxiGeocoder.parseFeature works 1:1)
    return {"features": data.get("features", [])}


@router.get("/geocode/reverse")
async def taxi_reverse_geocode(lng: float, lat: float, lang: str = "de"):
    """Reverse-geocode (coords → human address). For pickup-pin labels."""
    token = _server_mapbox_token()
    if not token:
        raise HTTPException(503, "Geocoding not configured (MAPBOX_TOKEN missing on server).")
    import httpx
    try:
        async with httpx.AsyncClient(timeout=4.0) as client:
            r = await client.get(
                f"https://api.mapbox.com/geocoding/v5/mapbox.places/{lng},{lat}.json",
                params={"access_token": token, "language": lang, "limit": 1},
            )
            if r.status_code != 200:
                return {"address": "", "upstream_status": r.status_code}
            data = r.json()
    except Exception as e:
        logger.warning(f"reverse geocode error: {e}")
        return {"address": "", "error": "upstream_timeout"}
    f = (data.get("features") or [{}])[0]
    return {
        "address": f.get("place_name", ""),
        "name": f.get("text", ""),
        "lat": (f.get("center") or [None, None])[1],
        "lng": (f.get("center") or [None, None])[0],
    }
