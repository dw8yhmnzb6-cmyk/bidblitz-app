"""
Staff Management Extended — Urlaub/Krankmeldung + GPS-Tracking
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone, timedelta
from core.database import db
from core.security import get_current_user
from uuid import uuid4

router = APIRouter(prefix="/api/staff", tags=["Staff Management"])


def _now():
    return datetime.now(timezone.utc).isoformat()


# ═══════════════════════════════════════════════════════════
# URLAUB & KRANKMELDUNG
# ═══════════════════════════════════════════════════════════
class TimeOffRequest(BaseModel):
    type: str  # "vacation", "sick", "personal"
    start_date: str  # ISO date
    end_date: str
    reason: Optional[str] = None
    notes: Optional[str] = None


@router.post("/time-off/request")
async def request_time_off(req: TimeOffRequest, request: Request):
    """Mitarbeiter beantragt Urlaub/Krankmeldung."""
    user = await get_current_user(request)
    
    # Check if staff member
    staff = await db.staff.find_one({"user_id": str(user["_id"])})
    if not staff:
        raise HTTPException(403, "Nur für Mitarbeiter")
    
    time_off = {
        "id": str(uuid4()),
        "staff_id": staff["staff_id"],
        "user_id": str(user["_id"]),
        "merchant_id": staff["merchant_id"],
        "type": req.type,
        "start_date": req.start_date,
        "end_date": req.end_date,
        "reason": req.reason,
        "notes": req.notes,
        "status": "pending",  # pending, approved, rejected
        "requested_at": _now(),
    }
    await db.staff_time_off.insert_one(time_off)
    time_off.pop("_id", None)
    
    return {"ok": True, "time_off": time_off}


@router.get("/time-off/my-requests")
async def my_time_off_requests(request: Request, limit: int = 50):
    """Eigene Urlaubs-/Krankmeldungen."""
    user = await get_current_user(request)
    requests = await db.staff_time_off.find(
        {"user_id": str(user["_id"])},
        {"_id": 0}
    ).sort("requested_at", -1).limit(limit).to_list(limit)
    return {"requests": requests}


@router.get("/time-off/pending")
async def pending_time_off_requests(request: Request, merchant_id: Optional[str] = None):
    """Admin/Manager sieht offene Anträge."""
    user = await get_current_user(request)
    
    # Check if admin or merchant owner
    if user.get("role") not in ("admin", "superadmin"):
        merchant = await db.pos_merchants.find_one({"owner_id": str(user["_id"])})
        if not merchant:
            raise HTTPException(403, "Keine Berechtigung")
        merchant_id = merchant["merchant_id"]
    
    query = {"status": "pending"}
    if merchant_id:
        query["merchant_id"] = merchant_id
    
    requests = await db.staff_time_off.find(query, {"_id": 0}) \
        .sort("requested_at", -1) \
        .to_list(200)
    
    return {"requests": requests}


class ApproveTimeOff(BaseModel):
    time_off_id: str
    status: str  # approved, rejected
    admin_notes: Optional[str] = None


@router.post("/time-off/review")
async def review_time_off(req: ApproveTimeOff, request: Request):
    """Admin/Manager genehmigt oder lehnt Urlaub ab."""
    user = await get_current_user(request)
    
    time_off = await db.staff_time_off.find_one({"id": req.time_off_id})
    if not time_off:
        raise HTTPException(404, "Antrag nicht gefunden")
    
    # Authorization check
    if user.get("role") not in ("admin", "superadmin"):
        merchant = await db.pos_merchants.find_one({
            "owner_id": str(user["_id"]),
            "merchant_id": time_off["merchant_id"]
        })
        if not merchant:
            raise HTTPException(403, "Keine Berechtigung")
    
    await db.staff_time_off.update_one(
        {"id": req.time_off_id},
        {"$set": {
            "status": req.status,
            "reviewed_by": str(user["_id"]),
            "reviewed_at": _now(),
            "admin_notes": req.admin_notes,
        }}
    )
    
    return {"ok": True, "status": req.status}


# ═══════════════════════════════════════════════════════════
# GPS-TRACKING (Live-Standort)
# ═══════════════════════════════════════════════════════════
class GPSLocation(BaseModel):
    lat: float
    lng: float
    accuracy: Optional[float] = None  # meters
    heading: Optional[float] = None  # degrees
    speed: Optional[float] = None  # m/s


@router.post("/gps/update")
async def update_gps_location(loc: GPSLocation, request: Request):
    """Mitarbeiter sendet GPS-Position."""
    user = await get_current_user(request)
    
    staff = await db.staff.find_one({"user_id": str(user["_id"])})
    if not staff:
        raise HTTPException(403, "Nur für Mitarbeiter")
    
    # Update staff record with last known location
    await db.staff.update_one(
        {"staff_id": staff["staff_id"]},
        {"$set": {
            "last_location": {
                "lat": loc.lat,
                "lng": loc.lng,
                "accuracy": loc.accuracy,
                "heading": loc.heading,
                "speed": loc.speed,
                "updated_at": _now(),
            }
        }}
    )
    
    # Store in location history (optional, for tracking over time)
    await db.staff_location_history.insert_one({
        "staff_id": staff["staff_id"],
        "merchant_id": staff["merchant_id"],
        "lat": loc.lat,
        "lng": loc.lng,
        "accuracy": loc.accuracy,
        "heading": loc.heading,
        "speed": loc.speed,
        "timestamp": _now(),
    })
    
    return {"ok": True}


@router.get("/gps/staff-locations")
async def get_staff_locations(request: Request, merchant_id: Optional[str] = None):
    """Admin/Manager sieht Live-Standorte aller Mitarbeiter."""
    user = await get_current_user(request)
    
    if user.get("role") not in ("admin", "superadmin"):
        merchant = await db.pos_merchants.find_one({"owner_id": str(user["_id"])})
        if not merchant:
            raise HTTPException(403, "Keine Berechtigung")
        merchant_id = merchant["merchant_id"]
    
    query = {}
    if merchant_id:
        query["merchant_id"] = merchant_id
    
    # Only return staff with recent location updates (within last 10 minutes)
    ten_min_ago = (datetime.now(timezone.utc) - timedelta(minutes=10)).isoformat()
    query["last_location.updated_at"] = {"$gte": ten_min_ago}
    
    staff_list = await db.staff.find(query, {"_id": 0}).to_list(500)
    
    # Enrich with user names
    user_ids = [s["user_id"] for s in staff_list if s.get("user_id")]
    users = await db.users.find(
        {"_id": {"$in": user_ids}},
        {"_id": 1, "name": 1, "email": 1}
    ).to_list(len(user_ids))
    user_map = {str(u["_id"]): u for u in users}
    
    for s in staff_list:
        uid = s.get("user_id")
        if uid and uid in user_map:
            s["user_name"] = user_map[uid].get("name", "Unknown")
            s["user_email"] = user_map[uid].get("email", "")
    
    return {"staff_locations": staff_list}


@router.get("/gps/location-history/{staff_id}")
async def get_location_history(
    staff_id: str,
    request: Request,
    hours: int = 8
):
    """GPS-Verlauf eines Mitarbeiters (letzte X Stunden)."""
    user = await get_current_user(request)
    
    staff = await db.staff.find_one({"staff_id": staff_id})
    if not staff:
        raise HTTPException(404, "Mitarbeiter nicht gefunden")
    
    # Authorization
    if user.get("role") not in ("admin", "superadmin"):
        merchant = await db.pos_merchants.find_one({
            "owner_id": str(user["_id"]),
            "merchant_id": staff["merchant_id"]
        })
        if not merchant:
            raise HTTPException(403, "Keine Berechtigung")
    
    since = (datetime.now(timezone.utc) - timedelta(hours=hours)).isoformat()
    
    history = await db.staff_location_history.find(
        {"staff_id": staff_id, "timestamp": {"$gte": since}},
        {"_id": 0}
    ).sort("timestamp", 1).to_list(5000)
    
    return {"staff_id": staff_id, "history": history, "hours": hours}


@router.post("/gps/toggle-tracking")
async def toggle_gps_tracking(request: Request, enabled: bool = True):
    """Mitarbeiter aktiviert/deaktiviert GPS-Tracking."""
    user = await get_current_user(request)
    
    staff = await db.staff.find_one({"user_id": str(user["_id"])})
    if not staff:
        raise HTTPException(403, "Nur für Mitarbeiter")
    
    await db.staff.update_one(
        {"staff_id": staff["staff_id"]},
        {"$set": {"gps_tracking_enabled": enabled, "gps_tracking_updated_at": _now()}}
    )
    
    return {"ok": True, "gps_tracking_enabled": enabled}
