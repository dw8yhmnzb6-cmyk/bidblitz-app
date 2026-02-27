"""
Device/Scooter Unlock System for BidBlitz
Handles device unlock requests, sessions, and IoT integration
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
from bson import ObjectId
import uuid
import logging

from dependencies import get_current_user, get_admin_user
from config import db

# Import wallet ledger for integrated payments
async def _charge_wallet(user_id, amount_cents, category, description, reference_id=None):
    """Charge user wallet via ledger - returns entry or raises HTTPException"""
    from routers.wallet_ledger import create_ledger_entry
    return await create_ledger_entry(user_id, "debit", amount_cents, category, description, reference_id)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/devices", tags=["Devices & Unlock"])


# ==================== SCHEMAS ====================

class DeviceCreate(BaseModel):
    serial: str
    type: str  # scooter, locker, gate, bike, etc.
    name: Optional[str] = None
    location: Optional[str] = None

class DeviceUpdate(BaseModel):
    status: Optional[str] = None  # available, in_use, maintenance, disabled
    name: Optional[str] = None
    location: Optional[str] = None

class UnlockRequest(BaseModel):
    device_id: str

class SessionEnd(BaseModel):
    notes: Optional[str] = None


# ==================== DEVICE MANAGEMENT (Admin) ====================

@router.post("/admin/create")
async def create_device(data: DeviceCreate, admin: dict = Depends(get_admin_user)):
    """Admin creates a new device"""
    # Check if serial exists
    existing = await db.devices.find_one({"serial": data.serial})
    if existing:
        raise HTTPException(status_code=400, detail="Seriennummer bereits vorhanden")
    
    device_id = str(uuid.uuid4())
    device = {
        "id": device_id,
        "serial": data.serial,
        "type": data.type,
        "name": data.name or f"{data.type.upper()}-{data.serial[-4:]}",
        "location": data.location,
        "status": "available",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "last_seen_at": None,
        "total_sessions": 0,
        "total_revenue_cents": 0
    }
    
    await db.devices.insert_one(device)
    logger.info(f"🛴 Device created: {data.serial} by admin {admin.get('email')}")
    
    return {"success": True, "device": {k: v for k, v in device.items() if k != '_id'}}


@router.get("/admin/list")
async def list_devices(
    status: Optional[str] = None,
    type: Optional[str] = None,
    admin: dict = Depends(get_admin_user)
):
    """Admin lists all devices"""
    query = {}
    if status:
        query["status"] = status
    if type:
        query["type"] = type
    
    devices = await db.devices.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return {"devices": devices, "total": len(devices)}


@router.patch("/admin/{device_id}")
async def update_device(device_id: str, data: DeviceUpdate, admin: dict = Depends(get_admin_user)):
    """Admin updates device status"""
    update_data = {k: v for k, v in data.dict().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="Keine Änderungen angegeben")
    
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.devices.update_one({"id": device_id}, {"": update_data})
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Gerät nicht gefunden")
    
    return {"success": True, "message": "Gerät aktualisiert"}


# ==================== UNLOCK SYSTEM ====================

@router.post("/unlock/request")
async def request_unlock(data: UnlockRequest, user: dict = Depends(get_current_user)):
    """User requests to unlock a device"""
    device = await db.devices.find_one({"id": data.device_id})
    if not device:
        raise HTTPException(status_code=404, detail="Gerät nicht gefunden")
    
    if device["status"] != "available" and device["status"] != "reserved":
        raise HTTPException(status_code=409, detail=f"Geraet nicht verfuegbar (Status: {device['status']})")
    
    # If reserved, check it's reserved by this user
    if device["status"] == "reserved" and device.get("reserved_by") != user["id"]:
        raise HTTPException(status_code=409, detail="Geraet ist fuer einen anderen Nutzer reserviert")
    
    # Check if user has active session
    active_session = await db.unlock_sessions.find_one({
        "user_id": user["id"],
        "status": {"$in": ["requested", "active"]}
    })
    if active_session:
        raise HTTPException(status_code=409, detail="Sie haben bereits eine aktive Sitzung")
    
    # Get pricing from device
    unlock_fee = device.get("unlock_fee_cents", 100)
    per_minute = device.get("per_minute_cents", 25)
    
    # Charge unlock fee from wallet
    try:
        unlock_entry = await _charge_wallet(
            user["id"], unlock_fee, "ride_unlock",
            f"Entsperrgebuehr: {device.get('name', device['serial'])}",
            reference_id=None  # Will update with session_id
        )
    except HTTPException as e:
        if e.status_code == 402:
            raise HTTPException(402, f"Nicht genug Guthaben. Entsperrgebuehr: EUR {unlock_fee/100:.2f}. Bitte Wallet aufladen.")
        raise
    
    # Create unlock session
    session_id = str(uuid.uuid4())
    session = {
        "id": session_id,
        "user_id": user["id"],
        "user_name": user.get("name"),
        "user_email": user.get("email"),
        "device_id": data.device_id,
        "device_serial": device["serial"],
        "device_type": device["type"],
        "status": "requested",
        "requested_at": datetime.now(timezone.utc).isoformat(),
        "started_at": None,
        "ended_at": None,
        "duration_seconds": None,
        "cost_cents": None,
        "failure_reason": None,
        "pricing_snapshot": {
            "unlock_cents": unlock_fee,
            "per_minute_cents": per_minute
        },
        "unlock_ledger_id": unlock_entry["id"]
    }
    
    await db.unlock_sessions.insert_one(session)
    
    # Update device status
    await db.devices.update_one(
        {"id": data.device_id},
        {"": {"status": "in_use", "last_seen_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    # TODO: Call IoT provider API to physically unlock device
    # await iot_provider.unlock(device["serial"])
    
    logger.info(f"🔓 Unlock requested: Device {device['serial']} by user {user.get('email')}")
    
    return {
        "success": True,
        "session_id": session_id,
        "status": "requested",
        "device": {
            "serial": device["serial"],
            "type": device["type"],
            "name": device.get("name")
        },
        "message": "Entsperrung angefordert. Bitte warten..."
    }


@router.post("/unlock/{session_id}/confirm")
async def confirm_unlock(session_id: str, user: dict = Depends(get_current_user)):
    """Confirms that device was successfully unlocked (called by device or system)"""
    session = await db.unlock_sessions.find_one({"id": session_id})
    if not session:
        raise HTTPException(status_code=404, detail="Sitzung nicht gefunden")
    
    if session["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Nicht autorisiert")
    
    if session["status"] != "requested":
        raise HTTPException(status_code=409, detail=f"Ungültiger Status: {session['status']}")
    
    await db.unlock_sessions.update_one(
        {"id": session_id},
        {"": {
            "status": "active",
            "started_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    logger.info(f"✅ Unlock confirmed: Session {session_id}")
    
    return {"success": True, "session_id": session_id, "status": "active", "message": "Gerät entsperrt!"}


@router.post("/unlock/{session_id}/end")
async def end_session(session_id: str, data: Optional[SessionEnd] = None, user: dict = Depends(get_current_user)):
    """End an active unlock session"""
    session = await db.unlock_sessions.find_one({"id": session_id})
    if not session:
        raise HTTPException(status_code=404, detail="Sitzung nicht gefunden")
    
    if session["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Nicht autorisiert")
    
    if session["status"] not in ["requested", "active"]:
        raise HTTPException(status_code=409, detail=f"Sitzung bereits beendet: {session['status']}")
    
    ended_at = datetime.now(timezone.utc)
    started_at = datetime.fromisoformat(session.get("started_at") or session["requested_at"])
    duration_seconds = int((ended_at - started_at).total_seconds())
    
    # Calculate cost based on device pricing
    pricing = session.get("pricing_snapshot", {})
    per_minute_cents = pricing.get("per_minute_cents", 25)
    ride_minutes = max(1, duration_seconds // 60)
    cost_cents = ride_minutes * per_minute_cents
    
    # Charge ride fee from wallet (unlock was already charged)
    try:
        ride_entry = await _charge_wallet(
            user["id"], cost_cents, "ride_fee",
            f"Fahrt: {session.get('device_type', 'scooter')} ({ride_minutes} Min)",
            reference_id=session_id
        )
    except HTTPException:
        # If wallet empty, still end the ride but mark as unpaid
        cost_cents = 0
        ride_entry = None
    
    await db.unlock_sessions.update_one(
        {"id": session_id},
        {"": {
            "status": "ended",
            "ended_at": ended_at.isoformat(),
            "duration_seconds": duration_seconds,
            "cost_cents": cost_cents,
            "notes": data.notes if data else None
        }}
    )
    
    # Update device status back to available
    await db.devices.update_one(
        {"id": session["device_id"]},
        {
            "": {"status": "available"},
            "": {"total_sessions": 1, "total_revenue_cents": cost_cents}
        }
    )
    
    # Total cost = unlock fee + ride fee
    total_cost_cents = pricing.get("unlock_cents", 100) + cost_cents
    
    logger.info(f"Session ended: {session_id}, Duration: {duration_seconds}s, Cost: {total_cost_cents}c")
    
    return {
        "success": True,
        "session_id": session_id,
        "status": "ended",
        "duration_seconds": duration_seconds,
        "duration_formatted": f"{duration_seconds // 60} Min {duration_seconds % 60} Sek",
        "cost_cents": cost_cents,
        "cost_formatted": f"€{cost_cents / 100:.2f}"
    }


@router.get("/my-sessions")
async def get_my_sessions(user: dict = Depends(get_current_user)):
    """Get user's unlock sessions"""
    sessions = await db.unlock_sessions.find(
        {"user_id": user["id"]},
        {"_id": 0}
    ).sort("requested_at", -1).to_list(100)
    
    return {"sessions": sessions}


@router.get("/available-legacy")
async def get_available_devices(
    type: Optional[str] = None,
    user: dict = Depends(get_current_user)
):
    """Get list of available devices"""
    query = {"status": "available"}
    if type:
        query["type"] = type
    
    devices = await db.devices.find(query, {"_id": 0}).to_list(100)
    return {"devices": devices}


# ==================== LIME-STYLE FEATURES ====================

@router.get("/available")
async def get_available_devices_public(
    lat: Optional[float] = None,
    lng: Optional[float] = None,
    radius_km: float = 5.0,
    type: Optional[str] = None
):
    """Get available devices near a location (public, no auth needed)"""
    query = {"status": "available"}
    if type:
        query["type"] = type
    
    devices = await db.devices.find(query, {"_id": 0}).to_list(200)
    
    # If location provided, filter by distance (simple bounding box)
    if lat is not None and lng is not None:
        from math import radians, cos
        lat_range = radius_km / 111.0  # ~111km per degree latitude
        lng_range = radius_km / (111.0 * cos(radians(lat)))
        devices = [d for d in devices if d.get("lat") and d.get("lng") and
                   abs(d["lat"] - lat) < lat_range and abs(d["lng"] - lng) < lng_range]
    
    return {"devices": devices, "count": len(devices)}


@router.post("/reserve/{device_id}")
async def reserve_device(device_id: str, user: dict = Depends(get_current_user)):
    """Reserve a device for 10 minutes (free)"""
    device = await db.devices.find_one({"id": device_id})
    if not device:
        raise HTTPException(404, "Gerät nicht gefunden")
    if device.get("status") != "available":
        raise HTTPException(409, "Gerät nicht verfügbar")
    
    # Check if user already has a reservation
    existing = await db.device_reservations.find_one({
        "user_id": user["id"],
        "status": "active"
    })
    if existing:
        raise HTTPException(409, "Sie haben bereits eine aktive Reservierung")
    
    now = datetime.now(timezone.utc)
    reservation = {
        "id": str(uuid.uuid4()),
        "device_id": device_id,
        "user_id": user["id"],
        "user_name": user.get("name"),
        "status": "active",
        "expires_at": (now + __import__("datetime").timedelta(minutes=10)).isoformat(),
        "created_at": now.isoformat()
    }
    
    await db.device_reservations.insert_one(reservation)
    await db.devices.update_one({"id": device_id}, {"$set": {"status": "reserved", "reserved_by": user["id"]}})
    
    logger.info(f"🔒 Device {device_id} reserved by {user.get('email')}")
    reservation.pop("_id", None)
    
    return {
        "success": True,
        "reservation": reservation,
        "message": "Gerät für 10 Minuten reserviert. Kostenlos!"
    }


@router.delete("/reserve/{reservation_id}")
async def cancel_reservation(reservation_id: str, user: dict = Depends(get_current_user)):
    """Cancel a reservation"""
    reservation = await db.device_reservations.find_one({
        "id": reservation_id,
        "user_id": user["id"],
        "status": "active"
    })
    if not reservation:
        raise HTTPException(404, "Reservierung nicht gefunden")
    
    await db.device_reservations.update_one(
        {"id": reservation_id},
        {"$set": {"status": "cancelled"}}
    )
    await db.devices.update_one(
        {"id": reservation["device_id"]},
        {"$set": {"status": "available"}, "$unset": {"reserved_by": ""}}
    )
    
    return {"success": True, "message": "Reservierung storniert"}


@router.post("/ring/{device_id}")
async def ring_device(device_id: str, user: dict = Depends(get_current_user)):
    """Ring/locate a device (play sound)"""
    device = await db.devices.find_one({"id": device_id})
    if not device:
        raise HTTPException(404, "Gerät nicht gefunden")
    
    # In production, this would send a command to the IoT device
    logger.info(f"🔔 Ring request for device {device_id} by {user.get('email')}")
    
    return {
        "success": True,
        "message": "Gerät klingelt jetzt! Folgen Sie dem Sound.",
        "device_id": device_id
    }


@router.post("/report/{device_id}")
async def report_device_problem(device_id: str, user: dict = Depends(get_current_user)):
    """Report a problem with a device"""
    device = await db.devices.find_one({"id": device_id})
    if not device:
        raise HTTPException(404, "Gerät nicht gefunden")
    
    report = {
        "id": str(uuid.uuid4()),
        "device_id": device_id,
        "device_serial": device.get("serial"),
        "user_id": user["id"],
        "user_name": user.get("name"),
        "status": "open",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.device_reports.insert_one(report)
    logger.info(f"⚠️ Problem reported for device {device_id} by {user.get('email')}")
    report.pop("_id", None)
    
    return {
        "success": True,
        "report": report,
        "message": "Problem gemeldet. Danke für Ihre Hilfe!"
    }


@router.get("/my-reservations")
async def get_my_reservations(user: dict = Depends(get_current_user)):
    """Get user's active reservations"""
    reservations = await db.device_reservations.find(
        {"user_id": user["id"], "status": "active"},
        {"_id": 0}
    ).sort("created_at", -1).to_list(10)
    
    return {"reservations": reservations}


# ==================== ROLE MANAGEMENT (Admin) ====================

@router.post("/admin/set-partner/{user_id}")
async def set_user_as_partner(user_id: str, organization_id: str = None, admin: dict = Depends(get_admin_user)):
    """Admin: Promote user to partner_admin role"""
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(404, "Benutzer nicht gefunden")
    
    update = {"role": "partner_admin"}
    if organization_id:
        update["organization_id"] = organization_id
    
    await db.users.update_one({"id": user_id}, {"$set": update})
    logger.info(f"User {user_id} promoted to partner_admin")
    
    return {
        "success": True,
        "message": f"{user.get('name')} ist jetzt Partner-Admin",
        "role": "partner_admin"
    }


@router.post("/admin/remove-partner/{user_id}")
async def remove_partner_role(user_id: str, admin: dict = Depends(get_admin_user)):
    """Admin: Remove partner_admin role from user"""
    await db.users.update_one(
        {"id": user_id},
        {"$set": {"role": "user"}, "$unset": {"organization_id": ""}}
    )
    return {"success": True, "message": "Partner-Rolle entfernt"}


@router.get("/admin/partners")
async def list_partner_admins(admin: dict = Depends(get_admin_user)):
    """Admin: List all users with partner_admin role"""
    partners = await db.users.find(
        {"role": "partner_admin"},
        {"_id": 0, "password": 0}
    ).to_list(100)
    return {"partners": partners}


# ==================== PARTNER ENDPOINTS ====================

@router.get("/partner/my-devices")
async def partner_get_my_devices(user: dict = Depends(get_current_user)):
    """Partner: Get devices assigned to their organization"""
    if user.get("role") != "partner_admin" and not user.get("is_admin"):
        raise HTTPException(403, "Nur fuer Partner-Admins")
    
    org_id = user.get("organization_id")
    if not org_id and not user.get("is_admin"):
        raise HTTPException(404, "Keine Organisation zugewiesen")
    
    query = {}
    if org_id and not user.get("is_admin"):
        query["organization_id"] = org_id
    
    devices = await db.devices.find(query, {"_id": 0}).to_list(500)
    return {"devices": devices, "count": len(devices)}


@router.get("/partner/my-rides")
async def partner_get_rides(user: dict = Depends(get_current_user)):
    """Partner: Get ride sessions for their devices"""
    if user.get("role") != "partner_admin" and not user.get("is_admin"):
        raise HTTPException(403, "Nur fuer Partner-Admins")
    
    org_id = user.get("organization_id")
    
    # Get org device IDs
    query = {}
    if org_id and not user.get("is_admin"):
        org_devices = await db.devices.find({"organization_id": org_id}, {"id": 1}).to_list(500)
        device_ids = [d["id"] for d in org_devices]
        query["device_id"] = {"$in": device_ids}
    
    sessions = await db.unlock_sessions.find(query, {"_id": 0}).sort("requested_at", -1).to_list(100)
    
    total_revenue = sum(s.get("cost_cents", 0) for s in sessions if s.get("status") == "ended")
    
    return {
        "sessions": sessions,
        "count": len(sessions),
        "total_revenue_cents": total_revenue,
        "total_revenue_eur": round(total_revenue / 100, 2)
    }
