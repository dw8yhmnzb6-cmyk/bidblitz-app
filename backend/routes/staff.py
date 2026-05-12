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

class ShiftCreate(BaseModel):
    staff_id: str
    title: str
    start_time: datetime
    end_time: datetime
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

# ═══════════════════════════════════════════════════════════════════════════
# Auth Helper (Mock - replace with your actual auth)
# ═══════════════════════════════════════════════════════════════════════════
async def get_merchant_id(merchant_id: str = "test-merchant"):
    """Replace with actual auth dependency"""
    return merchant_id

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
    """Mitarbeiter erstellen"""
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
    action: Literal["clock_in", "clock_out", "break_start", "break_end"],
    lat: Optional[float] = None,
    lng: Optional[float] = None,
    note: Optional[str] = None,
    staff = Depends(get_staff_from_session)
):
    """Self Check-in/out für Mitarbeiter"""
    event = {
        "id": str(uuid4()),
        "merchant_id": staff["merchant_id"],
        "staff_id": staff["id"],
        "action": action,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "lat": lat,
        "lng": lng,
        "note": note,
        "source": "self_service",
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
        "source": data.source,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.staff_clock_events.insert_one(event)
    event.pop("_id", None)
    
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

@router.post("/shifts")
async def create_shift(
    data: ShiftCreate,
    merchant_id: str = Depends(get_merchant_id)
):
    """Schicht erstellen"""
    shift = {
        "id": str(uuid4()),
        "merchant_id": merchant_id,
        "staff_id": data.staff_id,
        "title": data.title,
        "start_time": data.start_time.isoformat(),
        "end_time": data.end_time.isoformat(),
        "location": data.location,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.staff_shifts.insert_one(shift)
    shift.pop("_id", None)
    
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
# 6. BONUS FEATURES (QR, Export Placeholders)
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
