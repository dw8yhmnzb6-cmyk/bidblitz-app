"""
BidBlitz Staff - Employee Profile & Mobile API
==============================================
Eigene Daten, PIN ändern, Sprache, Notifications, Mobile-Dashboard.
"""
from fastapi import APIRouter, HTTPException, Request, Depends
from pydantic import BaseModel
from typing import Optional, Literal
from datetime import datetime, timedelta, timezone
from uuid import uuid4
import os, bcrypt
from motor.motor_asyncio import AsyncIOMotorClient

router = APIRouter(prefix="/api/staff/me", tags=["staff-profile"])
client = AsyncIOMotorClient(os.getenv("MONGO_URL"))
db = client[os.getenv("DB_NAME", "bidblitz")]


async def get_staff_from_session(request: Request) -> dict:
    sid = request.cookies.get("staff_session")
    if not sid:
        raise HTTPException(401, "Nicht angemeldet")
    member = await db.staff_members.find_one({"id": sid, "active": True}, {"_id": 0, "pin_hash": 0, "password_hash": 0})
    if not member:
        raise HTTPException(401, "Session ungültig")
    return member


class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    language: Optional[Literal["de", "en", "sq", "tr"]] = None
    notifications_enabled: Optional[bool] = None


class PinChange(BaseModel):
    current_pin: Optional[str] = None
    new_pin: str


@router.get("/profile")
async def get_my_profile(member=Depends(get_staff_from_session)):
    return {"success": True, "profile": member}


@router.patch("/profile")
async def update_my_profile(req: ProfileUpdate, member=Depends(get_staff_from_session)):
    update = {k: v for k, v in req.dict().items() if v is not None}
    if not update:
        raise HTTPException(400, "Keine Änderungen")
    update["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.staff_members.update_one({"id": member["id"]}, {"$set": update})
    updated = await db.staff_members.find_one({"id": member["id"]}, {"_id": 0, "pin_hash": 0, "password_hash": 0})
    return {"success": True, "profile": updated}


@router.post("/change-pin")
async def change_pin(req: PinChange, member=Depends(get_staff_from_session)):
    if not (req.new_pin.isdigit() and 4 <= len(req.new_pin) <= 8):
        raise HTTPException(400, "PIN muss 4-8 Ziffern lang sein")
    # Validate current PIN if previously set
    raw = await db.staff_members.find_one({"id": member["id"]})
    if raw and raw.get("pin_hash"):
        if not req.current_pin or not bcrypt.checkpw(req.current_pin.encode(), raw["pin_hash"].encode()):
            raise HTTPException(401, "Aktuelle PIN ungültig")
    new_hash = bcrypt.hashpw(req.new_pin.encode(), bcrypt.gensalt()).decode()
    await db.staff_members.update_one(
        {"id": member["id"]}, {"$set": {"pin_hash": new_hash, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"success": True, "message": "PIN aktualisiert"}


@router.get("/dashboard")
async def my_mobile_dashboard(member=Depends(get_staff_from_session)):
    """Zentrale Daten für /staff/mobile."""
    mid = member["merchant_id"]
    sid = member["id"]
    now = datetime.now(timezone.utc)
    today_start = datetime(now.year, now.month, now.day, tzinfo=timezone.utc)
    week_start = (now - timedelta(days=now.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)

    # Today events
    today_events = await db.staff_clock_events.find(
        {"merchant_id": mid, "staff_id": sid, "timestamp": {"$gte": today_start.isoformat()}},
        {"_id": 0},
    ).sort("timestamp", 1).to_list(length=50)

    # Determine current status
    status = "off"
    in_t = None
    break_open = False
    for ev in today_events:
        if ev["action"] == "clock_in":
            status = "working"; in_t = ev["timestamp"]; break_open = False
        elif ev["action"] == "clock_out":
            status = "off"; in_t = None; break_open = False
        elif ev["action"] == "break_start":
            status = "break"; break_open = True
        elif ev["action"] == "break_end":
            status = "working"; break_open = False

    # Today worked minutes
    minutes_today = 0
    last_in = None
    for ev in today_events:
        t = datetime.fromisoformat(ev["timestamp"].replace("Z", "+00:00"))
        if ev["action"] == "clock_in": last_in = t
        elif ev["action"] == "clock_out" and last_in:
            minutes_today += int((t - last_in).total_seconds() / 60); last_in = None
    if status == "working" and last_in:
        minutes_today += int((now - last_in).total_seconds() / 60)

    # Week minutes
    week_events = await db.staff_clock_events.find(
        {"merchant_id": mid, "staff_id": sid, "timestamp": {"$gte": week_start.isoformat()}},
        {"_id": 0},
    ).sort("timestamp", 1).to_list(length=500)
    minutes_week = 0
    last_in = None
    for ev in week_events:
        t = datetime.fromisoformat(ev["timestamp"].replace("Z", "+00:00"))
        if ev["action"] == "clock_in": last_in = t
        elif ev["action"] == "clock_out" and last_in:
            minutes_week += int((t - last_in).total_seconds() / 60); last_in = None
    if status == "working" and last_in:
        minutes_week += int((now - last_in).total_seconds() / 60)

    # Next shift
    next_shift = await db.staff_shifts.find_one(
        {"merchant_id": mid, "staff_id": sid, "start_time": {"$gte": now.isoformat()}},
        sort=[("start_time", 1)], projection={"_id": 0},
    )

    # Vacation balance
    vac_yearly = int(member.get("vacation_days_yearly", 24))
    vac_used = int(member.get("vacation_days_used", 0))

    return {
        "success": True,
        "status": status,
        "name": member["name"],
        "today_minutes": minutes_today,
        "today_hours": round(minutes_today / 60.0, 2),
        "week_minutes": minutes_week,
        "week_hours": round(minutes_week / 60.0, 2),
        "next_shift": next_shift,
        "vacation_remaining": max(0, vac_yearly - vac_used),
        "vacation_total": vac_yearly,
        "current_session_started": in_t,
        "break_open": break_open,
    }
