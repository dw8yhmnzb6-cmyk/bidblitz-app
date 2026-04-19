"""
BidBlitz V2 - Taxi Admin Panel API
Admin endpoints for taxi module:
- Fare settings per vehicle type
- Driver management (approve/reject/suspend)
- Rides overview + cancellation
- Revenue & activity logs
"""
from datetime import datetime, timezone, timedelta
from typing import Optional
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from bson import ObjectId
import logging

from core.database import db
from core.security import get_current_user

logger = logging.getLogger("bidblitz.taxi_admin")
router = APIRouter(prefix="/api/admin/taxi", tags=["Admin Taxi"])


# ═══════════════════════════════════════════════════════════
# DEFAULTS & HELPERS
# ═══════════════════════════════════════════════════════════

DEFAULT_FARE_SETTINGS = [
    {"vehicle_type": "standard", "base_fare": 3.50, "price_per_km": 1.80, "price_per_minute": 0.30, "minimum_fare": 6.00, "cancellation_fee": 3.00, "active": True},
    {"vehicle_type": "premium",  "base_fare": 5.50, "price_per_km": 2.80, "price_per_minute": 0.45, "minimum_fare": 9.00, "cancellation_fee": 5.00, "active": True},
    {"vehicle_type": "van",      "base_fare": 6.00, "price_per_km": 2.20, "price_per_minute": 0.35, "minimum_fare": 10.00, "cancellation_fee": 5.00, "active": True},
]


async def _require_admin(request: Request):
    user = await get_current_user(request)
    if user.get("role") not in ("admin", "super_admin"):
        raise HTTPException(status_code=403, detail="Admin only")
    return user


def _oid(s):
    try:
        return ObjectId(s)
    except Exception:
        return s


async def _seed_defaults_if_empty():
    cnt = await db.taxi_fare_settings.count_documents({})
    if cnt == 0:
        now = datetime.now(timezone.utc).isoformat()
        docs = [{**f, "created_at": now, "updated_at": now} for f in DEFAULT_FARE_SETTINGS]
        await db.taxi_fare_settings.insert_many(docs)


# ═══════════════════════════════════════════════════════════
# FARE SETTINGS
# ═══════════════════════════════════════════════════════════

class FareSettingUpdate(BaseModel):
    vehicle_type: str = Field(..., pattern="^(standard|premium|van)$")
    base_fare: float = Field(..., ge=0)
    price_per_km: float = Field(..., ge=0)
    price_per_minute: float = Field(..., ge=0)
    minimum_fare: float = Field(..., ge=0)
    cancellation_fee: float = Field(..., ge=0)
    active: bool = True


@router.get("/fare-settings")
async def get_fare_settings(request: Request):
    await _require_admin(request)
    await _seed_defaults_if_empty()
    settings = await db.taxi_fare_settings.find({}, {"_id": 0}).to_list(50)
    return {"settings": settings}


@router.post("/fare-settings")
async def save_fare_setting(req: FareSettingUpdate, request: Request):
    await _require_admin(request)
    now = datetime.now(timezone.utc).isoformat()
    await db.taxi_fare_settings.update_one(
        {"vehicle_type": req.vehicle_type},
        {"$set": {**req.model_dump(), "updated_at": now},
         "$setOnInsert": {"created_at": now}},
        upsert=True,
    )
    return {"ok": True, "vehicle_type": req.vehicle_type}


# Public endpoint — TaxiPage uses this to render vehicle cards with up-to-date prices
@router.get("/public/fare-settings", include_in_schema=False)
async def public_fare_settings():
    await _seed_defaults_if_empty()
    settings = await db.taxi_fare_settings.find({"active": True}, {"_id": 0}).to_list(20)
    return {"settings": settings}


# ═══════════════════════════════════════════════════════════
# DRIVERS
# ═══════════════════════════════════════════════════════════

@router.get("/drivers")
async def list_all_drivers(request: Request, status: Optional[str] = None, limit: int = 200):
    await _require_admin(request)
    q = {}
    if status:
        q["status"] = status
    cursor = db.drivers.find(q, {"_id": 0}).sort("created_at", -1).limit(limit)
    drivers = await cursor.to_list(limit)
    # Enrich with user info
    for d in drivers:
        try:
            u = await db.users.find_one({"_id": ObjectId(d.get("user_id"))}, {"_id": 0, "email": 1, "name": 1, "balance": 1})
            if u:
                d["user_email"] = u.get("email")
                d["user_name"] = u.get("name")
                d["wallet_balance"] = round(float(u.get("balance", 0) or 0), 2)
        except Exception:
            pass
    return {"drivers": drivers, "count": len(drivers)}


@router.post("/drivers/{driver_id}/approve")
async def approve_driver(driver_id: str, request: Request):
    admin = await _require_admin(request)
    now = datetime.now(timezone.utc).isoformat()
    result = await db.drivers.update_one(
        {"driver_id": driver_id},
        {"$set": {
            "is_verified": True,
            "is_approved": True,
            "status": "active",
            "approved_at": now,
            "approved_by": admin.get("email"),
            "updated_at": now,
        }},
    )
    if result.matched_count == 0:
        raise HTTPException(404, "Fahrer nicht gefunden")
    # Log activity
    await db.taxi_activity_logs.insert_one({
        "user_id": str(admin.get("_id") or admin.get("id")),
        "role": "admin", "action": "driver_approved",
        "driver_id": driver_id, "created_at": now,
    })
    return {"ok": True}


@router.post("/drivers/{driver_id}/reject")
async def reject_driver(driver_id: str, request: Request, reason: Optional[str] = ""):
    admin = await _require_admin(request)
    now = datetime.now(timezone.utc).isoformat()
    result = await db.drivers.update_one(
        {"driver_id": driver_id},
        {"$set": {
            "is_verified": False,
            "is_approved": False,
            "status": "rejected",
            "rejected_at": now,
            "rejected_by": admin.get("email"),
            "rejection_reason": reason,
            "updated_at": now,
        }},
    )
    if result.matched_count == 0:
        raise HTTPException(404, "Fahrer nicht gefunden")
    await db.taxi_activity_logs.insert_one({
        "user_id": str(admin.get("_id") or admin.get("id")),
        "role": "admin", "action": "driver_rejected",
        "driver_id": driver_id, "metadata": {"reason": reason},
        "created_at": now,
    })
    return {"ok": True}


@router.post("/drivers/{driver_id}/suspend")
async def suspend_driver(driver_id: str, request: Request, reason: Optional[str] = ""):
    admin = await _require_admin(request)
    now = datetime.now(timezone.utc).isoformat()
    result = await db.drivers.update_one(
        {"driver_id": driver_id},
        {"$set": {
            "status": "suspended",
            "is_online": False,
            "suspended_at": now,
            "suspended_by": admin.get("email"),
            "suspension_reason": reason,
            "updated_at": now,
        }},
    )
    if result.matched_count == 0:
        raise HTTPException(404, "Fahrer nicht gefunden")
    await db.taxi_activity_logs.insert_one({
        "user_id": str(admin.get("_id") or admin.get("id")),
        "role": "admin", "action": "driver_suspended",
        "driver_id": driver_id, "metadata": {"reason": reason},
        "created_at": now,
    })
    return {"ok": True}


@router.post("/drivers/{driver_id}/reactivate")
async def reactivate_driver(driver_id: str, request: Request):
    admin = await _require_admin(request)
    now = datetime.now(timezone.utc).isoformat()
    result = await db.drivers.update_one(
        {"driver_id": driver_id},
        {"$set": {
            "status": "active",
            "is_verified": True,
            "suspension_reason": None,
            "updated_at": now,
        }},
    )
    if result.matched_count == 0:
        raise HTTPException(404, "Fahrer nicht gefunden")
    await db.taxi_activity_logs.insert_one({
        "user_id": str(admin.get("_id") or admin.get("id")),
        "role": "admin", "action": "driver_reactivated",
        "driver_id": driver_id, "created_at": now,
    })
    return {"ok": True}


# ═══════════════════════════════════════════════════════════
# RIDES
# ═══════════════════════════════════════════════════════════

@router.get("/rides")
async def list_all_rides(request: Request, status: Optional[str] = None, limit: int = 100):
    await _require_admin(request)
    q = {}
    if status:
        q["status"] = status
    cursor = db.taxi_rides.find(q, {"_id": 0}).sort("created_at", -1).limit(limit)
    rides = await cursor.to_list(limit)
    # Enrich
    for r in rides:
        try:
            if r.get("customer_id"):
                u = await db.users.find_one({"_id": ObjectId(r["customer_id"])}, {"_id": 0, "email": 1, "name": 1})
                if u:
                    r["customer_email"] = u.get("email")
                    r["customer_name"] = r.get("customer_name") or u.get("name")
        except Exception:
            pass
    return {"rides": rides, "count": len(rides)}


class RideCancelRequest(BaseModel):
    reason: str = Field(..., min_length=3)


@router.post("/rides/{ride_id}/cancel")
async def admin_cancel_ride(ride_id: str, req: RideCancelRequest, request: Request):
    admin = await _require_admin(request)
    ride = await db.taxi_rides.find_one({"ride_id": ride_id})
    if not ride:
        raise HTTPException(404, "Fahrt nicht gefunden")
    if ride.get("status") == "completed":
        raise HTTPException(400, "Abgeschlossene Fahrt kann nicht storniert werden")
    now = datetime.now(timezone.utc).isoformat()
    await db.taxi_rides.update_one(
        {"ride_id": ride_id},
        {"$set": {
            "status": "cancelled_by_system",
            "cancelled_at": now,
            "cancellation_reason": req.reason,
            "cancelled_by_admin": admin.get("email"),
        }},
    )
    # Free up driver
    if ride.get("driver_id"):
        await db.drivers.update_one({"driver_id": ride["driver_id"]}, {"$set": {"is_busy": False}})
    await db.taxi_activity_logs.insert_one({
        "user_id": str(admin.get("_id") or admin.get("id")),
        "role": "admin", "action": "ride_cancelled",
        "ride_id": ride_id, "metadata": {"reason": req.reason},
        "created_at": now,
    })
    return {"ok": True}


# ═══════════════════════════════════════════════════════════
# OVERVIEW / STATS
# ═══════════════════════════════════════════════════════════

@router.get("/overview")
async def taxi_overview(request: Request):
    await _require_admin(request)
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today_start - timedelta(days=today_start.weekday())
    month_start = today_start.replace(day=1)

    # Driver stats
    total_drivers = await db.drivers.count_documents({})
    active_drivers = await db.drivers.count_documents({"status": "active", "is_verified": True})
    online_drivers = await db.drivers.count_documents({"is_online": True})
    busy_drivers = await db.drivers.count_documents({"is_busy": True})
    pending_approval = await db.drivers.count_documents({"status": {"$in": ["pending", "pending_approval"]}})

    # Ride stats
    total_rides = await db.taxi_rides.count_documents({})
    today_rides = await db.taxi_rides.count_documents({"created_at": {"$gte": today_start.isoformat()}})
    active_rides = await db.taxi_rides.count_documents({"status": {"$in": ["accepted", "arriving", "started"]}})
    completed_today = await db.taxi_rides.count_documents({
        "status": "completed",
        "completed_at": {"$gte": today_start.isoformat()}
    })

    # Revenue (platform commission)
    async def sum_platform_fee(date_from):
        total = 0.0
        async for row in db.taxi_rides.aggregate([
            {"$match": {"status": "completed", "completed_at": {"$gte": date_from.isoformat()}}},
            {"$group": {"_id": None,
                        "gross": {"$sum": "$final_fare"},
                        "driver": {"$sum": "$driver_earnings"}}},
        ]):
            gross = float(row.get("gross", 0) or 0)
            drv = float(row.get("driver", 0) or 0)
            total = round(gross - drv, 2)
        return total

    revenue_today = await sum_platform_fee(today_start)
    revenue_week = await sum_platform_fee(week_start)
    revenue_month = await sum_platform_fee(month_start)

    return {
        "drivers": {
            "total": total_drivers, "active": active_drivers,
            "online": online_drivers, "busy": busy_drivers,
            "pending_approval": pending_approval,
        },
        "rides": {
            "total": total_rides, "today": today_rides,
            "active": active_rides, "completed_today": completed_today,
        },
        "revenue": {
            "today": revenue_today, "week": revenue_week, "month": revenue_month,
        },
    }


@router.get("/activity-logs")
async def get_activity_logs(request: Request, limit: int = 100):
    await _require_admin(request)
    cursor = db.taxi_activity_logs.find({}, {"_id": 0}).sort("created_at", -1).limit(limit)
    logs = await cursor.to_list(limit)
    return {"logs": logs, "count": len(logs)}
