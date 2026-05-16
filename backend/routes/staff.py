"""
BidBlitz Staff Management API
==============================
Zeiterfassung, Mitarbeiterverwaltung, Schichtplanung für Merchants
+ Self-Service Portal für Mitarbeiter

Collections:
- staff_members
- staff_clock_events
- staff_shifts
- staff_leave_requests
- staff_reports
"""
from fastapi import APIRouter, HTTPException, Depends, Response, Request
from pydantic import BaseModel, Field
from typing import Optional, List, Literal
from datetime import datetime, timedelta, timezone
from uuid import uuid4
import os
import bcrypt

router = APIRouter(prefix="/api/staff", tags=["staff"])

# ═══════════════════════════════════════════════════════════════════════════
# Database Dependency
# ═══════════════════════════════════════════════════════════════════════════
from motor.motor_asyncio import AsyncIOMotorClient

MONGO_URL = os.getenv("MONGO_URL")
client = AsyncIOMotorClient(MONGO_URL)
db = client[os.getenv("DB_NAME", "bidblitz")]

# ═══════════════════════════════════════════════════════════════════════════
# Pydantic Models
# ═══════════════════════════════════════════════════════════════════════════

class StaffMemberCreate(BaseModel):
    name: str
    email: str
    phone: Optional[str] = None
    role: str = "employee"
    hourly_rate: float = 12.0
    vacation_days_yearly: int = 24
    active: bool = True

class StaffMemberUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    role: Optional[str] = None
    hourly_rate: Optional[float] = None
    vacation_days_yearly: Optional[int] = None
    active: Optional[bool] = None

class ClockEvent(BaseModel):
    staff_id: str
    action: Literal["clock_in", "clock_out", "break_start", "break_end"]
    lat: Optional[float] = None
    lng: Optional[float] = None
    note: Optional[str] = None
    source: str = "web"
    device_type: Optional[str] = None
    browser: Optional[str] = None
    platform: Optional[str] = None
    app_version: Optional[str] = None
    # Connecteam-Style Attachments
    customer: Optional[str] = None
    equipment: Optional[str] = None
    kilometers: Optional[float] = None
    photo_url: Optional[str] = None
    project: Optional[str] = None

class ShiftCreate(BaseModel):
    staff_id: str
    title: str
    start_time: datetime
    end_time: datetime
    location: Optional[str] = None

class ShiftUpdate(BaseModel):
    staff_id: Optional[str] = None
    title: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    location: Optional[str] = None

class LeaveRequest(BaseModel):
    staff_id: str
    type: Literal["vacation", "sick", "other"]
    start_date: str
    end_date: str
    reason: Optional[str] = None

class LeaveApproval(BaseModel):
    status: Literal["approved", "rejected"]
    admin_note: Optional[str] = None

class StaffLogin(BaseModel):
    email: str
    password: str

class SelfClockEvent(BaseModel):
    action: Literal["clock_in", "clock_out", "break_start", "break_end"]
    lat: Optional[float] = None
    lng: Optional[float] = None
    note: Optional[str] = None
    customer: Optional[str] = None
    equipment: Optional[str] = None
    kilometers: Optional[float] = None
    photo_url: Optional[str] = None
    project: Optional[str] = None
    source: str = "self_service"
    device_type: Optional[str] = None
    browser: Optional[str] = None
    platform: Optional[str] = None
    app_version: Optional[str] = None

# ═══════════════════════════════════════════════════════════════════════════
# Auth Helper (uses BidBlitz Core Auth)
# ═══════════════════════════════════════════════════════════════════════════
async def get_merchant_id(request: Request) -> str:
    """Resolve merchant_id from authenticated user (merchant or admin)."""
    from routes.auth import get_current_user as auth_user
    user = await auth_user(request)
    if user.get("role") not in ("merchant", "admin"):
        raise HTTPException(403, "Nur für Händler oder Administratoren")
    return str(user.get("user_id") or user.get("id") or user.get("_id"))


async def require_active_subscription(merchant_id: str) -> dict:
    """Ensure merchant has an active or trialing Staff subscription."""
    from routes.staff_subscription import get_subscription_for_merchant
    sub = await get_subscription_for_merchant(merchant_id)
    if not sub:
        raise HTTPException(402, detail={
            "code": "no_subscription",
            "message": "Staff-Modul nicht aktiviert. Bitte Trial starten oder Plan wählen.",
        })
    if not sub.get("enabled", True):
        raise HTTPException(403, detail={
            "code": "module_disabled",
            "message": "Staff-Modul wurde vom Administrator deaktiviert.",
        })
    if sub.get("status") not in ("trialing", "active"):
        raise HTTPException(402, detail={
            "code": "subscription_inactive",
            "message": "Subscription abgelaufen oder gekündigt. Bitte upgraden.",
            "status": sub.get("status"),
        })
    return sub

async def get_staff_from_session(request: Request):
    """Get staff_id from session cookie"""
    session_cookie = request.cookies.get("staff_session")
    if not session_cookie:
        raise HTTPException(401, "Not authenticated")
    
    # Simple session validation (replace with proper session management)
    staff = await db.staff_members.find_one({"id": session_cookie}, {"_id": 0})
    if not staff or not staff.get("active"):
        raise HTTPException(401, "Invalid session or inactive account")
    
    return staff

# ═══════════════════════════════════════════════════════════════════════════
# 0. STAFF AUTH (Self-Service Login)
# ═══════════════════════════════════════════════════════════════════════════

@router.post("/auth/login")
async def staff_login(data: StaffLogin, response: Response):
    """Mitarbeiter Login für Self-Service Portal"""
    # Find staff member by email
    staff = await db.staff_members.find_one({"email": data.email}, {"_id": 0})
    
    if not staff:
        raise HTTPException(401, "Ungültige E-Mail oder Passwort")
    
    if not staff.get("active"):
        raise HTTPException(403, "Account deaktiviert. Kontaktiere deinen Arbeitgeber.")
    
    # Check password (if exists, otherwise allow login with any password for now)
    if staff.get("password_hash"):
        if not bcrypt.checkpw(data.password.encode(), staff["password_hash"].encode()):
            raise HTTPException(401, "Ungültige E-Mail oder Passwort")
    else:
        # First login - set password
        password_hash = bcrypt.hashpw(data.password.encode(), bcrypt.gensalt()).decode()
        await db.staff_members.update_one(
            {"id": staff["id"]},
            {"$set": {"password_hash": password_hash}}
        )
    
    # Set session cookie (simple implementation - use proper session management in production)
    response.set_cookie(
        key="staff_session",
        value=staff["id"],
        httponly=True,
        max_age=86400 * 30,  # 30 days
        samesite="lax"
    )
    
    return {
        "success": True,
        "staff": {
            "id": staff["id"],
            "name": staff["name"],
            "email": staff["email"],
            "role": staff["role"]
        }
    }

@router.post("/auth/logout")
async def staff_logout(response: Response):
    """Mitarbeiter Logout"""
    response.delete_cookie("staff_session")
    return {"success": True, "message": "Erfolgreich abgemeldet"}


class TerminalPinBody(BaseModel):
    pin: str


@router.post("/auth/terminal-pin")
async def terminal_pin_lookup(data: TerminalPinBody, request: Request):
    """
    Kiosk/Terminal-PIN-Authentifizierung.
    Findet aktiven Mitarbeiter, dessen PIN dem eingegebenen 4-stelligen Code entspricht.

    Sicherheit:
    - PIN min. 4 Ziffern
    - Nur Mitarbeiter desselben Merchants (über Cookie-Session oder fallback global)
    - Rate-Limit über Brute-Force-Lock je IP (TODO: in-memory cache)

    Response: { member: { id, name, email, role } } oder 404
    """
    pin = (data.pin or "").strip()
    if len(pin) < 4 or not pin.isdigit():
        raise HTTPException(400, "PIN muss min. 4 Ziffern sein")

    # Try merchant scoping from session cookie (terminal usually has merchant-session)
    merchant_id = None
    try:
        # Look for any merchant session by sniffing access_token in cookies
        from core.security import get_current_user
        try:
            user = await get_current_user(request)
            if user.get("role") in ("merchant", "admin"):
                merchant_id = str(user.get("_id") or user.get("id") or "")
        except Exception:
            merchant_id = None
    except Exception:
        merchant_id = None

    # Query staff_members with PIN match (active only)
    query = {"pin": pin, "active": {"$ne": False}}
    if merchant_id:
        # If we have merchant context, scope to that merchant
        query["$or"] = [{"merchant_id": merchant_id}, {"merchant_id": {"$exists": False}}]

    member = await db.staff_members.find_one(query, {"_id": 0, "id": 1, "name": 1, "email": 1, "role": 1})

    if not member:
        # Demo fallback: pin "1234" matches first active member in DB (DEMO MODE)
        if pin == "1234":
            member = await db.staff_members.find_one(
                {"active": {"$ne": False}},
                {"_id": 0, "id": 1, "name": 1, "email": 1, "role": 1},
            )
        if not member:
            raise HTTPException(404, "PIN nicht zugeordnet")

    # Log terminal access
    await db.staff_terminal_log.insert_one({
        "staff_id": member.get("id"),
        "pin_attempted": pin[:1] + "***",
        "merchant_id": merchant_id,
        "ip": request.client.host if request.client else None,
        "ts": datetime.now(timezone.utc).isoformat(),
    })

    return {"success": True, "member": member}

@router.get("/auth/me")
async def get_current_staff(staff = Depends(get_staff_from_session)):
    """Aktuell eingeloggter Mitarbeiter"""
    return {"success": True, "staff": staff}

# ═══════════════════════════════════════════════════════════════════════════
# 1. MITARBEITER MANAGEMENT (Merchant Only)
# ═══════════════════════════════════════════════════════════════════════════

@router.post("/members")
async def create_staff_member(
    data: StaffMemberCreate,
    merchant_id: str = Depends(get_merchant_id)
):
    """Mitarbeiter erstellen (mit Plan-Limit-Check)"""
    # Subscription check
    sub = await require_active_subscription(merchant_id)
    max_staff = sub.get("max_staff_override") or sub.get("max_staff", 0)
    current_count = await db.staff_members.count_documents({"merchant_id": merchant_id, "active": True})
    if current_count >= max_staff:
        raise HTTPException(403, detail={
            "code": "limit_reached",
            "message": f"Mitarbeiter-Limit erreicht ({current_count}/{max_staff}). Bitte Plan upgraden.",
            "current_count": current_count,
            "max_staff": max_staff,
            "plan": sub.get("plan"),
        })

    member = {
        "id": str(uuid4()),
        "merchant_id": merchant_id,
        "name": data.name,
        "email": data.email,
        "phone": data.phone,
        "role": data.role,
        "hourly_rate": data.hourly_rate,
        "vacation_days_yearly": data.vacation_days_yearly,
        "vacation_days_used": 0,
        "active": data.active,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    await db.staff_members.insert_one(member)
    member.pop("_id", None)
    return {"success": True, "member": member}

@router.get("/members")
async def list_staff_members(
    active_only: bool = True,
    merchant_id: str = Depends(get_merchant_id)
):
    """Mitarbeiter listen"""
    query = {"merchant_id": merchant_id}
    if active_only:
        query["active"] = True
    
    members = await db.staff_members.find(query, {"_id": 0}).to_list(1000)
    return {"success": True, "members": members, "count": len(members)}

@router.get("/members/{staff_id}")
async def get_staff_member(
    staff_id: str,
    merchant_id: str = Depends(get_merchant_id)
):
    """Einzelner Mitarbeiter"""
    member = await db.staff_members.find_one(
        {"id": staff_id, "merchant_id": merchant_id},
        {"_id": 0}
    )
    if not member:
        raise HTTPException(404, "Mitarbeiter nicht gefunden")
    return {"success": True, "member": member}

@router.patch("/members/{staff_id}")
async def update_staff_member(
    staff_id: str,
    data: StaffMemberUpdate,
    merchant_id: str = Depends(get_merchant_id)
):
    """Mitarbeiter aktualisieren"""
    update_data = {k: v for k, v in data.dict(exclude_unset=True).items()}
    if not update_data:
        raise HTTPException(400, "Keine Daten zum Aktualisieren")
    
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.staff_members.update_one(
        {"id": staff_id, "merchant_id": merchant_id},
        {"$set": update_data}
    )
    if result.matched_count == 0:
        raise HTTPException(404, "Mitarbeiter nicht gefunden")
    
    return {"success": True, "updated": True}

@router.delete("/members/{staff_id}")
async def delete_staff_member(
    staff_id: str,
    merchant_id: str = Depends(get_merchant_id)
):
    """Mitarbeiter deaktivieren (soft delete)"""
    result = await db.staff_members.update_one(
        {"id": staff_id, "merchant_id": merchant_id},
        {"$set": {"active": False, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    if result.matched_count == 0:
        raise HTTPException(404, "Mitarbeiter nicht gefunden")
    
    return {"success": True, "deleted": True}

# ═══════════════════════════════════════════════════════════════════════════
# 2. ZEITERFASSUNG (Clock-in/out, Pausen)
# ═══════════════════════════════════════════════════════════════════════════

@router.post("/clock/self")
async def self_clock_event(
    data: Optional[SelfClockEvent] = None,
    action: Optional[Literal["clock_in", "clock_out", "break_start", "break_end"]] = None,
    lat: Optional[float] = None,
    lng: Optional[float] = None,
    note: Optional[str] = None,
    customer: Optional[str] = None,
    equipment: Optional[str] = None,
    kilometers: Optional[float] = None,
    photo_url: Optional[str] = None,
    project: Optional[str] = None,
    staff = Depends(get_staff_from_session)
):
    """Self Check-in/out für Mitarbeiter inkl. Attachments (Kunde, Gerät, KM, Foto, Notiz).
    Akzeptiert JSON-Body (bevorzugt) oder Query-Parameter (legacy)."""
    if data is None:
        if not action:
            raise HTTPException(422, "action erforderlich (Body oder Query)")
        data = SelfClockEvent(
            action=action, lat=lat, lng=lng, note=note,
            customer=customer, equipment=equipment, kilometers=kilometers,
            photo_url=photo_url, project=project,
        )
    event = {
        "id": str(uuid4()),
        "merchant_id": staff["merchant_id"],
        "staff_id": staff["id"],
        "action": data.action,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "lat": data.lat,
        "lng": data.lng,
        "note": data.note,
        "customer": data.customer,
        "equipment": data.equipment,
        "kilometers": data.kilometers,
        "photo_url": data.photo_url,
        "project": data.project,
        "source": data.source or "self_service",
        "device_type": data.device_type,
        "browser": data.browser,
        "platform": data.platform,
        "app_version": data.app_version,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.staff_clock_events.insert_one(event)
    event.pop("_id", None)
    return {"success": True, "event": event}

@router.post("/clock")
async def clock_event(
    data: ClockEvent,
    merchant_id: str = Depends(get_merchant_id)
):
    """Check-in/out oder Pause Start/Ende"""
    # Validierung: Mitarbeiter existiert
    member = await db.staff_members.find_one(
        {"id": data.staff_id, "merchant_id": merchant_id, "active": True}
    )
    if not member:
        raise HTTPException(404, "Mitarbeiter nicht gefunden oder inaktiv")
    
    event = {
        "id": str(uuid4()),
        "merchant_id": merchant_id,
        "staff_id": data.staff_id,
        "action": data.action,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "lat": data.lat,
        "lng": data.lng,
        "note": data.note,
        "customer": data.customer,
        "equipment": data.equipment,
        "kilometers": data.kilometers,
        "photo_url": data.photo_url,
        "project": data.project,
        "source": data.source,
        "device_type": data.device_type,
        "browser": data.browser,
        "platform": data.platform,
        "app_version": data.app_version,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.staff_clock_events.insert_one(event)
    event.pop("_id", None)

    # Audit log + Geofence validation (best-effort)
    try:
        from routes.staff_locations import validate_geofence
        warn = await validate_geofence(merchant_id, data.staff_id, data.lat, data.lng)
        if warn:
            event["geofence_warning"] = warn
    except Exception:
        pass
    # P1: GPS Anomaly / Mock Detection (best-effort)
    try:
        from utils.clock_anomaly import check_anomaly
        anomaly = await check_anomaly(
            staff_id=data.staff_id,
            merchant_id=merchant_id,
            event_id=event["id"],
            lat=data.lat,
            lng=data.lng,
            timestamp_iso=event["timestamp"],
        )
        if anomaly:
            event["is_mock_suspected"] = True
            event["anomaly"] = anomaly
    except Exception:
        pass
    try:
        await db.staff_audit_log.insert_one({
            "id": str(uuid4()),
            "merchant_id": merchant_id,
            "staff_id": data.staff_id,
            "type": "clock_event",
            "action": data.action,
            "device_type": data.device_type,
            "browser": data.browser,
            "platform": data.platform,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })
    except Exception:
        pass

    return {"success": True, "event": event}

@router.get("/clock/today")
async def get_today_events(
    staff_id: Optional[str] = None,
    merchant_id: str = Depends(get_merchant_id)
):
    """Heutige Zeitbuchungen"""
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    
    query = {
        "merchant_id": merchant_id,
        "timestamp": {"$gte": today_start}
    }
    if staff_id:
        query["staff_id"] = staff_id
    
    events = await db.staff_clock_events.find(query, {"_id": 0}).sort("timestamp", 1).to_list(1000)
    return {"success": True, "events": events, "count": len(events)}

@router.get("/clock/history")
async def get_clock_history(
    staff_id: str,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    merchant_id: str = Depends(get_merchant_id)
):
    """Zeitbuchungen Verlauf"""
    query = {"merchant_id": merchant_id, "staff_id": staff_id}
    
    if start_date:
        query["timestamp"] = query.get("timestamp", {})
        query["timestamp"]["$gte"] = start_date
    if end_date:
        query["timestamp"] = query.get("timestamp", {})
        query["timestamp"]["$lte"] = end_date
    
    events = await db.staff_clock_events.find(query, {"_id": 0}).sort("timestamp", -1).to_list(1000)
    return {"success": True, "events": events, "count": len(events)}

# ═══════════════════════════════════════════════════════════════════════════
# 3. SCHICHTPLANUNG
# ═══════════════════════════════════════════════════════════════════════════

async def _find_shift_overlaps(merchant_id: str, staff_id: str, start_iso: str, end_iso: str, exclude_id: Optional[str] = None) -> list:
    """Return list of existing shifts that overlap with [start, end] for same staff.
    Overlap: existing.start < new.end AND existing.end > new.start.
    """
    q = {
        "merchant_id": merchant_id,
        "staff_id": staff_id,
        "start_time": {"$lt": end_iso},
        "end_time": {"$gt": start_iso},
    }
    if exclude_id:
        q["id"] = {"$ne": exclude_id}
    return await db.staff_shifts.find(q, {"_id": 0}).to_list(20)


@router.post("/shifts")
async def create_shift(
    data: ShiftCreate,
    force: bool = False,
    merchant_id: str = Depends(get_merchant_id)
):
    """Schicht erstellen. ?force=true überspringt Overlap-Check."""
    start_iso = data.start_time.isoformat()
    end_iso = data.end_time.isoformat()
    if data.end_time <= data.start_time:
        raise HTTPException(400, "Endzeit muss nach Startzeit liegen")

    if not force:
        conflicts = await _find_shift_overlaps(merchant_id, data.staff_id, start_iso, end_iso)
        if conflicts:
            raise HTTPException(
                status_code=409,
                detail={
                    "code": "shift_conflict",
                    "message": f"{len(conflicts)} überschneidende Schicht(en) für diesen Mitarbeiter.",
                    "conflicts": conflicts,
                },
            )

    shift = {
        "id": str(uuid4()),
        "merchant_id": merchant_id,
        "staff_id": data.staff_id,
        "title": data.title,
        "start_time": start_iso,
        "end_time": end_iso,
        "location": data.location,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.staff_shifts.insert_one(shift)
    shift.pop("_id", None)

    # Auto-Notification: new_shift
    try:
        from routes.staff_notifications import create_notification
        await create_notification(
            merchant_id, data.staff_id, "new_shift",
            title=f"Neue Schicht: {data.title}",
            body=f"{data.start_time.strftime('%d.%m.%Y %H:%M')} – {data.end_time.strftime('%H:%M')}",
            meta={"shift_id": shift["id"]},
        )
    except Exception:
        pass

    return {"success": True, "shift": shift}

@router.get("/shifts")
async def list_shifts(
    staff_id: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    merchant_id: str = Depends(get_merchant_id)
):
    """Schichten anzeigen"""
    query = {"merchant_id": merchant_id}
    if staff_id:
        query["staff_id"] = staff_id
    if start_date:
        query["start_time"] = {"$gte": start_date}
    if end_date:
        query["end_time"] = query.get("end_time", {})
        query["end_time"]["$lte"] = end_date
    
    shifts = await db.staff_shifts.find(query, {"_id": 0}).sort("start_time", 1).to_list(1000)
    return {"success": True, "shifts": shifts, "count": len(shifts)}

@router.delete("/shifts/{shift_id}")
async def delete_shift(
    shift_id: str,
    merchant_id: str = Depends(get_merchant_id)
):
    """Schicht löschen"""
    result = await db.staff_shifts.delete_one({"id": shift_id, "merchant_id": merchant_id})
    if result.deleted_count == 0:
        raise HTTPException(404, "Schicht nicht gefunden")
    
    return {"success": True, "deleted": True}


@router.patch("/shifts/{shift_id}")
async def update_shift(
    shift_id: str,
    data: ShiftUpdate,
    force: bool = False,
    merchant_id: str = Depends(get_merchant_id)
):
    """Schicht aktualisieren (für Drag&Drop Schedule-Editor: Verschieben/Neu-Zuweisen).
    ?force=true überspringt Overlap-Check.
    """
    existing = await db.staff_shifts.find_one({"id": shift_id, "merchant_id": merchant_id}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Schicht nicht gefunden")

    update: dict = {}
    raw = data.model_dump(exclude_none=True)
    if "staff_id" in raw:
        update["staff_id"] = raw["staff_id"]
    if "title" in raw:
        update["title"] = raw["title"]
    if "location" in raw:
        update["location"] = raw["location"]
    if "start_time" in raw:
        update["start_time"] = raw["start_time"].isoformat() if hasattr(raw["start_time"], "isoformat") else raw["start_time"]
    if "end_time" in raw:
        update["end_time"] = raw["end_time"].isoformat() if hasattr(raw["end_time"], "isoformat") else raw["end_time"]
    if not update:
        return {"success": True, "no_change": True}

    # Validate time order
    new_start = update.get("start_time", existing["start_time"])
    new_end = update.get("end_time", existing["end_time"])
    if new_end <= new_start:
        raise HTTPException(400, "Endzeit muss nach Startzeit liegen")

    # Overlap check
    if not force:
        check_staff = update.get("staff_id", existing["staff_id"])
        conflicts = await _find_shift_overlaps(
            merchant_id, check_staff, new_start, new_end, exclude_id=shift_id,
        )
        if conflicts:
            raise HTTPException(
                status_code=409,
                detail={
                    "code": "shift_conflict",
                    "message": f"{len(conflicts)} überschneidende Schicht(en).",
                    "conflicts": conflicts,
                },
            )

    update["updated_at"] = datetime.now(timezone.utc).isoformat()

    await db.staff_shifts.update_one(
        {"id": shift_id, "merchant_id": merchant_id}, {"$set": update},
    )
    shift = await db.staff_shifts.find_one({"id": shift_id}, {"_id": 0})
    return {"success": True, "shift": shift}


class ShiftRepeatBody(BaseModel):
    week_start: str  # ISO date YYYY-MM-DD (Monday)
    weeks: int = Field(1, ge=1, le=12)
    staff_id: Optional[str] = None  # if set, only repeat shifts of this staff
    skip_conflicts: bool = True  # if True, conflicts are skipped silently; else 409


@router.post("/shifts/repeat")
async def repeat_week(
    body: ShiftRepeatBody,
    merchant_id: str = Depends(get_merchant_id)
):
    """Klone alle Schichten einer Quellwoche um N Wochen nach vorn.
    week_start = Montag YYYY-MM-DD. Erzeugt für jede der `weeks` Folgewochen einen Schichten-Klon.
    """
    try:
        src_start = datetime.fromisoformat(f"{body.week_start}T00:00:00").replace(tzinfo=timezone.utc)
    except Exception:
        raise HTTPException(400, "week_start muss YYYY-MM-DD sein")
    src_end = src_start.replace() 
    from datetime import timedelta as _td
    src_end = src_start + _td(days=7)

    q = {
        "merchant_id": merchant_id,
        "start_time": {"$gte": src_start.isoformat(), "$lt": src_end.isoformat()},
    }
    if body.staff_id:
        q["staff_id"] = body.staff_id
    src_shifts = await db.staff_shifts.find(q, {"_id": 0}).to_list(2000)
    if not src_shifts:
        return {"success": True, "created": 0, "skipped": 0, "message": "Keine Schichten in der Quellwoche"}

    created = 0
    skipped = 0
    skip_details = []
    now = datetime.now(timezone.utc).isoformat()
    for week_offset in range(1, body.weeks + 1):
        for s in src_shifts:
            try:
                st = datetime.fromisoformat(s["start_time"].replace("Z", "+00:00"))
                en = datetime.fromisoformat(s["end_time"].replace("Z", "+00:00"))
            except Exception:
                continue
            new_st = (st + _td(days=7 * week_offset)).isoformat()
            new_en = (en + _td(days=7 * week_offset)).isoformat()
            # Conflict check
            conflicts = await _find_shift_overlaps(merchant_id, s["staff_id"], new_st, new_en)
            if conflicts:
                if body.skip_conflicts:
                    skipped += 1
                    skip_details.append({"start_time": new_st, "staff_id": s["staff_id"], "title": s.get("title")})
                    continue
                raise HTTPException(409, detail={"code": "shift_conflict", "message": "Konflikt beim Wiederholen", "conflicts": conflicts})
            doc = {
                "id": str(uuid4()),
                "merchant_id": merchant_id,
                "staff_id": s["staff_id"],
                "title": s.get("title") or "Schicht",
                "start_time": new_st,
                "end_time": new_en,
                "location": s.get("location"),
                "created_at": now,
                "updated_at": now,
            }
            await db.staff_shifts.insert_one(doc)
            created += 1

    return {"success": True, "created": created, "skipped": skipped, "skip_details": skip_details[:50]}

# ═══════════════════════════════════════════════════════════════════════════
# 4. URLAUB / KRANKHEIT
# ═══════════════════════════════════════════════════════════════════════════

@router.post("/leave/self")
async def self_create_leave_request(
    type: Literal["vacation", "sick", "other"],
    start_date: str,
    end_date: str,
    reason: Optional[str] = None,
    staff = Depends(get_staff_from_session)
):
    """Self-Service Urlaubsantrag für Mitarbeiter"""
    request = {
        "id": str(uuid4()),
        "merchant_id": staff["merchant_id"],
        "staff_id": staff["id"],
        "type": type,
        "start_date": start_date,
        "end_date": end_date,
        "reason": reason,
        "status": "pending",
        "admin_note": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.staff_leave_requests.insert_one(request)
    request.pop("_id", None)
    
    return {"success": True, "request": request}

@router.get("/leave/self")
async def get_my_leave_requests(staff = Depends(get_staff_from_session)):
    """Meine Urlaubsanträge"""
    requests = await db.staff_leave_requests.find(
        {"staff_id": staff["id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    return {"success": True, "requests": requests, "count": len(requests)}

@router.post("/leave")
async def create_leave_request(
    data: LeaveRequest,
    merchant_id: str = Depends(get_merchant_id)
):
    """Urlaub/Krankheit beantragen"""
    request = {
        "id": str(uuid4()),
        "merchant_id": merchant_id,
        "staff_id": data.staff_id,
        "type": data.type,
        "start_date": data.start_date,
        "end_date": data.end_date,
        "reason": data.reason,
        "status": "pending",
        "admin_note": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.staff_leave_requests.insert_one(request)
    request.pop("_id", None)
    
    return {"success": True, "request": request}

@router.get("/leave")
async def list_leave_requests(
    staff_id: Optional[str] = None,
    status: Optional[str] = None,
    merchant_id: str = Depends(get_merchant_id)
):
    """Urlaubsanträge anzeigen"""
    query = {"merchant_id": merchant_id}
    if staff_id:
        query["staff_id"] = staff_id
    if status:
        query["status"] = status
    
    requests = await db.staff_leave_requests.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return {"success": True, "requests": requests, "count": len(requests)}

@router.get("/leave/counts")
async def leave_counts(merchant_id: str = Depends(get_merchant_id)):
    """Zähler für Merchant-Header: pending / approved / rejected."""
    pipe = [
        {"$match": {"merchant_id": merchant_id}},
        {"$group": {"_id": "$status", "count": {"$sum": 1}}},
    ]
    rows = await db.staff_leave_requests.aggregate(pipe).to_list(length=10)
    counts = {r["_id"]: r["count"] for r in rows}
    return {
        "success": True,
        "pending": counts.get("pending", 0),
        "approved": counts.get("approved", 0),
        "rejected": counts.get("rejected", 0),
        "total": sum(counts.values()),
    }


@router.patch("/leave/{request_id}")
async def approve_leave_request(
    request_id: str,
    data: LeaveApproval,
    merchant_id: str = Depends(get_merchant_id)
):
    """Urlaubsantrag genehmigen/ablehnen"""
    update_data = {
        "status": data.status,
        "admin_note": data.admin_note,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    result = await db.staff_leave_requests.update_one(
        {"id": request_id, "merchant_id": merchant_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(404, "Antrag nicht gefunden")
    
    # Update vacation_days_used wenn approved
    if data.status == "approved":
        req = await db.staff_leave_requests.find_one({"id": request_id})
        if req and req.get("type") == "vacation":
            # Berechne Tage (simplified)
            days = 1  # TODO: proper date calculation
            await db.staff_members.update_one(
                {"id": req["staff_id"], "merchant_id": merchant_id},
                {"$inc": {"vacation_days_used": days}}
            )

    # Auto-Notification: leave_approved / leave_rejected
    try:
        leave = await db.staff_leave_requests.find_one({"id": request_id}, {"_id": 0})
        if leave:
            from routes.staff_notifications import create_notification
            await create_notification(
                merchant_id, leave["staff_id"],
                "leave_approved" if data.status == "approved" else "leave_rejected",
                title="Urlaub genehmigt" if data.status == "approved" else "Urlaub abgelehnt",
                body=data.admin_note or "",
                meta={"leave_id": request_id},
            )
    except Exception:
        pass

    return {"success": True, "approved": data.status == "approved"}

# ═══════════════════════════════════════════════════════════════════════════
# 5. REPORTS (Arbeitszeit, Überstunden)
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/reports/hours/self")
async def get_my_work_hours(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    staff = Depends(get_staff_from_session)
):
    """Meine Arbeitsstunden (Self-Service)"""
    # Default: aktuelle Woche
    if not start_date:
        now = datetime.now(timezone.utc)
        start_date = (now - timedelta(days=now.weekday())).replace(hour=0, minute=0, second=0).isoformat()
    if not end_date:
        end_date = datetime.now(timezone.utc).isoformat()
    
    # Alle Events in Zeitraum holen
    events = await db.staff_clock_events.find({
        "staff_id": staff["id"],
        "timestamp": {"$gte": start_date, "$lte": end_date}
    }, {"_id": 0}).sort("timestamp", 1).to_list(10000)
    
    # Berechnung (same logic as merchant report)
    total_hours = 0.0
    break_hours = 0.0
    current_shift_start = None
    current_break_start = None
    
    for event in events:
        ts = datetime.fromisoformat(event["timestamp"])
        
        if event["action"] == "clock_in":
            current_shift_start = ts
        elif event["action"] == "clock_out" and current_shift_start:
            shift_duration = (ts - current_shift_start).total_seconds() / 3600
            total_hours += shift_duration
            current_shift_start = None
        elif event["action"] == "break_start":
            current_break_start = ts
        elif event["action"] == "break_end" and current_break_start:
            break_duration = (ts - current_break_start).total_seconds() / 3600
            break_hours += break_duration
            current_break_start = None
    
    net_hours = max(0, total_hours - break_hours)
    days_in_period = (datetime.fromisoformat(end_date) - datetime.fromisoformat(start_date)).days + 1
    expected_hours = (days_in_period / 7) * 40
    overtime_hours = max(0, net_hours - expected_hours)
    
    return {
        "success": True,
        "period": {"start": start_date, "end": end_date},
        "total_hours": round(total_hours, 2),
        "break_hours": round(break_hours, 2),
        "net_hours": round(net_hours, 2),
        "expected_hours": round(expected_hours, 2),
        "overtime_hours": round(overtime_hours, 2),
        "events_count": len(events),
        "events": events
    }

@router.get("/shifts/self")
async def get_my_shifts(staff = Depends(get_staff_from_session)):
    """Meine Schichten (Self-Service)"""
    now = datetime.now(timezone.utc).isoformat()
    
    shifts = await db.staff_shifts.find({
        "staff_id": staff["id"],
        "start_time": {"$gte": now}
    }, {"_id": 0}).sort("start_time", 1).to_list(100)
    
    return {"success": True, "shifts": shifts, "count": len(shifts)}

@router.get("/reports/hours")
async def calculate_work_hours(
    staff_id: str,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    merchant_id: str = Depends(get_merchant_id)
):
    """Arbeitsstunden berechnen"""
    # Default: aktuelle Woche
    if not start_date:
        now = datetime.now(timezone.utc)
        start_date = (now - timedelta(days=now.weekday())).replace(hour=0, minute=0, second=0).isoformat()
    if not end_date:
        end_date = datetime.now(timezone.utc).isoformat()
    
    # Alle Events in Zeitraum holen
    events = await db.staff_clock_events.find({
        "merchant_id": merchant_id,
        "staff_id": staff_id,
        "timestamp": {"$gte": start_date, "$lte": end_date}
    }, {"_id": 0}).sort("timestamp", 1).to_list(10000)
    
    # Berechnung
    total_hours = 0.0
    break_hours = 0.0
    current_shift_start = None
    current_break_start = None
    
    for event in events:
        ts = datetime.fromisoformat(event["timestamp"])
        
        if event["action"] == "clock_in":
            current_shift_start = ts
        elif event["action"] == "clock_out" and current_shift_start:
            shift_duration = (ts - current_shift_start).total_seconds() / 3600
            total_hours += shift_duration
            current_shift_start = None
        elif event["action"] == "break_start":
            current_break_start = ts
        elif event["action"] == "break_end" and current_break_start:
            break_duration = (ts - current_break_start).total_seconds() / 3600
            break_hours += break_duration
            current_break_start = None
    
    # Net work hours (excluding breaks)
    net_hours = max(0, total_hours - break_hours)
    
    # Überstunden (assuming 40h/week standard)
    days_in_period = (datetime.fromisoformat(end_date) - datetime.fromisoformat(start_date)).days + 1
    expected_hours = (days_in_period / 7) * 40
    overtime_hours = max(0, net_hours - expected_hours)
    
    return {
        "success": True,
        "staff_id": staff_id,
        "period": {"start": start_date, "end": end_date},
        "total_hours": round(total_hours, 2),
        "break_hours": round(break_hours, 2),
        "net_hours": round(net_hours, 2),
        "expected_hours": round(expected_hours, 2),
        "overtime_hours": round(overtime_hours, 2),
        "events_count": len(events)
    }

@router.get("/reports/summary")
async def get_staff_summary(
    merchant_id: str = Depends(get_merchant_id)
):
    """Dashboard Summary für Admin"""
    # Count active members
    active_members = await db.staff_members.count_documents({
        "merchant_id": merchant_id,
        "active": True
    })
    
    # Today's check-ins
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    today_checkins = await db.staff_clock_events.count_documents({
        "merchant_id": merchant_id,
        "action": "clock_in",
        "timestamp": {"$gte": today_start}
    })
    
    # Pending leave requests
    pending_leave = await db.staff_leave_requests.count_documents({
        "merchant_id": merchant_id,
        "status": "pending"
    })
    
    # Scheduled shifts today
    today_end = (now + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    today_shifts = await db.staff_shifts.count_documents({
        "merchant_id": merchant_id,
        "start_time": {"$gte": today_start, "$lt": today_end}
    })
    
    return {
        "success": True,
        "active_members": active_members,
        "today_checkins": today_checkins,
        "pending_leave": pending_leave,
        "today_shifts": today_shifts
    }

# ═══════════════════════════════════════════════════════════════════════════
# 6. QR CHECK-IN (Full Implementation)
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/qr/generate/{staff_id}")
async def generate_qr_checkin(
    staff_id: str,
    merchant_id: str = Depends(get_merchant_id)
):
    """QR Check-in Code generieren (Merchant)"""
    # Verify staff belongs to merchant
    staff = await db.staff_members.find_one({
        "id": staff_id,
        "merchant_id": merchant_id,
        "active": True
    })
    if not staff:
        raise HTTPException(404, "Mitarbeiter nicht gefunden")
    
    # Generate unique token (valid for 5 minutes)
    token = f"qr-{staff_id}-{datetime.now(timezone.utc).timestamp()}"
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=5)
    
    # Store token in DB
    await db.staff_qr_tokens.insert_one({
        "token": token,
        "staff_id": staff_id,
        "merchant_id": merchant_id,
        "expires_at": expires_at.isoformat(),
        "used": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {
        "success": True,
        "token": token,
        "qr_url": f"/staff/qr-scan?token={token}",
        "expires_in": 300,
        "staff_name": staff["name"]
    }

@router.post("/qr/scan")
async def qr_checkin_scan(
    token: str,
    action: Literal["clock_in", "clock_out", "break_start", "break_end"],
    lat: Optional[float] = None,
    lng: Optional[float] = None
):
    """QR Code scannen und automatisch ein-/auschecken"""
    # Validate token
    token_doc = await db.staff_qr_tokens.find_one({"token": token})
    
    if not token_doc:
        raise HTTPException(404, "Ungültiger QR Code")
    
    if token_doc.get("used"):
        raise HTTPException(410, "QR Code bereits verwendet")
    
    # Check expiry
    expires_at = datetime.fromisoformat(token_doc["expires_at"])
    if datetime.now(timezone.utc) > expires_at:
        raise HTTPException(410, "QR Code abgelaufen")
    
    # Create clock event
    event = {
        "id": str(uuid4()),
        "merchant_id": token_doc["merchant_id"],
        "staff_id": token_doc["staff_id"],
        "action": action,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "lat": lat,
        "lng": lng,
        "note": "QR Check-in",
        "source": "qr_scan",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.staff_clock_events.insert_one(event)
    
    # Mark token as used
    await db.staff_qr_tokens.update_one(
        {"token": token},
        {"$set": {"used": True, "used_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    event.pop("_id", None)
    
    # Get staff info
    staff = await db.staff_members.find_one({"id": token_doc["staff_id"]}, {"_id": 0, "name": 1})
    
    return {
        "success": True,
        "event": event,
        "staff_name": staff.get("name", "Unknown") if staff else "Unknown",
        "message": f"{getActionLabel(action)} erfolgreich"
    }

def getActionLabel(action):
    labels = {
        "clock_in": "Eingecheckt",
        "clock_out": "Ausgecheckt",
        "break_start": "Pause gestartet",
        "break_end": "Pause beendet"
    }
    return labels.get(action, action)

# ═══════════════════════════════════════════════════════════════════════════
# 7. BONUS FEATURES (QR, Export Placeholders) - LEGACY
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/qr/{staff_id}")
async def generate_qr_token(
    staff_id: str,
    merchant_id: str = Depends(get_merchant_id)
):
    """QR Check-in Token generieren (Placeholder)"""
    # TODO: Implement QR token generation with expiry
    token = f"qr-{staff_id}-{datetime.now(timezone.utc).timestamp()}"
    return {
        "success": True,
        "token": token,
        "qr_url": f"/staff/qr-checkin/{token}",
        "expires_in": 300  # 5 minutes
    }

@router.get("/export/pdf/{staff_id}")
async def export_pdf_payslip(
    staff_id: str,
    start_date: str,
    end_date: str,
    merchant_id: str = Depends(get_merchant_id)
):
    """PDF Lohnzettel Export"""
    from utils.pdf_generator import generate_payslip_pdf
    from fastapi.responses import StreamingResponse
    
    # Get staff member
    staff = await db.staff_members.find_one(
        {"id": staff_id, "merchant_id": merchant_id},
        {"_id": 0}
    )
    if not staff:
        raise HTTPException(404, "Mitarbeiter nicht gefunden")
    
    # Calculate work hours
    events = await db.staff_clock_events.find({
        "staff_id": staff_id,
        "timestamp": {"$gte": start_date, "$lte": end_date}
    }, {"_id": 0}).sort("timestamp", 1).to_list(10000)
    
    # Calculate hours (same logic as reports/hours)
    total_hours = 0.0
    break_hours = 0.0
    current_shift_start = None
    current_break_start = None
    
    for event in events:
        ts = datetime.fromisoformat(event["timestamp"])
        
        if event["action"] == "clock_in":
            current_shift_start = ts
        elif event["action"] == "clock_out" and current_shift_start:
            shift_duration = (ts - current_shift_start).total_seconds() / 3600
            total_hours += shift_duration
            current_shift_start = None
        elif event["action"] == "break_start":
            current_break_start = ts
        elif event["action"] == "break_end" and current_break_start:
            break_duration = (ts - current_break_start).total_seconds() / 3600
            break_hours += break_duration
            current_break_start = None
    
    net_hours = max(0, total_hours - break_hours)
    days_in_period = (datetime.fromisoformat(end_date) - datetime.fromisoformat(start_date)).days + 1
    expected_hours = (days_in_period / 7) * 40
    overtime_hours = max(0, net_hours - expected_hours)
    
    work_hours_data = {
        "total_hours": total_hours,
        "break_hours": break_hours,
        "net_hours": net_hours,
        "overtime_hours": overtime_hours
    }
    
    # Generate PDF
    pdf_buffer = generate_payslip_pdf(
        staff=staff,
        period_start=start_date,
        period_end=end_date,
        work_hours_data=work_hours_data,
        hourly_rate=staff.get("hourly_rate", 12.0)
    )
    
    filename = f"lohnzettel_{staff['name'].replace(' ', '_')}_{start_date}_{end_date}.pdf"
    
    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

# Geofencing GPS Validation
@router.post("/geofence/validate")
async def validate_geofence(
    lat: float,
    lng: float,
    merchant_id: str = Depends(get_merchant_id)
):
    """Validiere ob GPS-Koordinaten innerhalb erlaubter Bereiche liegen"""
    # Get merchant locations
    merchant = await db.users.find_one({"id": merchant_id}, {"_id": 0, "business_locations": 1})
    
    if not merchant or not merchant.get("business_locations"):
        # No geofencing configured - allow all
        return {"success": True, "valid": True, "message": "Kein Geofencing konfiguriert"}
    
    # Check if coordinates are within any allowed location (radius check)
    from math import radians, cos, sin, asin, sqrt
    
    def haversine(lon1, lat1, lon2, lat2):
        """Calculate distance between two points in km"""
        lon1, lat1, lon2, lat2 = map(radians, [lon1, lat1, lon2, lat2])
        dlon = lon2 - lon1
        dlat = lat2 - lat1
        a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
        c = 2 * asin(sqrt(a))
        km = 6371 * c
        return km
    
    for location in merchant["business_locations"]:
        loc_lat = location.get("lat")
        loc_lng = location.get("lng")
        radius_km = location.get("radius_km", 0.1)  # Default 100m
        
        if loc_lat and loc_lng:
            distance = haversine(lng, lat, loc_lng, loc_lat)
            if distance <= radius_km:
                return {
                    "success": True,
                    "valid": True,
                    "message": f"Standort OK ({location.get('name', 'Unbekannt')})",
                    "distance_km": round(distance, 3)
                }
    
    return {
        "success": True,
        "valid": False,
        "message": "Außerhalb erlaubter Standorte",
        "nearest_location": None
    }

@router.get("/export/datev")
async def export_datev(
    start_date: str,
    end_date: str,
    merchant_id: str = Depends(get_merchant_id)
):
    """DATEV Export (Placeholder)"""
    # TODO: Implement DATEV-compliant CSV export
    return {
        "success": True,
        "message": "DATEV Export coming soon",
        "format": "CSV",
        "period": {"start": start_date, "end": end_date}
    }

@router.get("/export/pdf")
async def export_pdf_report(
    staff_id: str,
    start_date: str,
    end_date: str,
    merchant_id: str = Depends(get_merchant_id)
):
    """PDF Report Export (Placeholder)"""
    # TODO: Implement PDF generation
    return {
        "success": True,
        "message": "PDF Export coming soon",
        "staff_id": staff_id,
        "period": {"start": start_date, "end": end_date}
    }
