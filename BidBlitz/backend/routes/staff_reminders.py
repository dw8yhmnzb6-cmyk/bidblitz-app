"""
BidBlitz Staff Reminders — Smart Reminder Engine
==================================================
Evaluiert für den aktuellen Mitarbeiter Smart-Reminder und gibt sie zurück.
Frontend pollt diesen Endpoint alle 60s und zeigt In-App Toasts. Wenn der User
Push aktiviert hat (OneSignal), sendet `/dispatch` zusätzlich eine Push.

Reminder-Typen:
───────────────
- break_overdue      : working > 4h without break
- shift_end_overdue  : worked past scheduled shift_end + 10 min and still clocked in
- shift_starting     : next shift starts in <= 15 min
- arrival_no_checkin : inside geofence but off-shift > 5 min
- long_break         : in pause > 60 min

Endpoints:
───────────
GET  /api/staff/reminders/check     — current reminders for caller (staff)
POST /api/staff/reminders/dispatch  — sends push for given reminder ids (idempotent per day)
"""
from datetime import datetime, timezone, timedelta
from typing import List, Optional
from uuid import uuid4
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from core.database import db

router = APIRouter(prefix="/api/staff/reminders", tags=["staff-reminders"])


async def _staff(request: Request) -> dict:
    sid = request.cookies.get("staff_session")
    if not sid:
        raise HTTPException(401, "Nicht angemeldet")
    m = await db.staff_members.find_one({"id": sid, "active": True}, {"_id": 0})
    if not m:
        raise HTTPException(401, "Session ungültig")
    return m


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _iso(dt: datetime) -> str:
    return dt.isoformat()


@router.get("/check")
async def check_reminders(request: Request):
    staff = await _staff(request)
    staff_id = staff["id"]
    now = _now()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    reminders: List[dict] = []

    # ── most recent clock event ───────────────────────────
    last_clock = await db.staff_clock_events.find_one(
        {"staff_id": staff_id, "timestamp": {"$gte": _iso(today_start - timedelta(days=1))}},
        {"_id": 0},
        sort=[("timestamp", -1)],
    )

    is_working = bool(last_clock and last_clock.get("action") in ("clock_in", "break_end"))
    is_break = bool(last_clock and last_clock.get("action") == "break_start")
    is_off = not (is_working or is_break)

    # Find last clock_in within today
    last_clock_in = await db.staff_clock_events.find_one(
        {"staff_id": staff_id, "action": "clock_in", "timestamp": {"$gte": _iso(today_start)}},
        {"_id": 0}, sort=[("timestamp", -1)],
    )
    last_break_start = await db.staff_clock_events.find_one(
        {"staff_id": staff_id, "action": "break_start", "timestamp": {"$gte": _iso(today_start)}},
        {"_id": 0}, sort=[("timestamp", -1)],
    )

    def _parse(iso_str: Optional[str]) -> Optional[datetime]:
        if not iso_str:
            return None
        try:
            return datetime.fromisoformat(iso_str.replace("Z", "+00:00"))
        except Exception:
            return None

    # ── 1. break_overdue ────────────────────────────────
    if is_working and last_clock_in:
        # had any break today?
        if not last_break_start:
            started = _parse(last_clock_in.get("timestamp"))
            if started and (now - started).total_seconds() > 4 * 3600:
                reminders.append({
                    "id": "break_overdue",
                    "severity": "warning",
                    "title": "Pause nicht vergessen",
                    "body": "Du arbeitest seit über 4h ohne Pause — Zeit für eine kurze Pause.",
                    "icon": "coffee",
                })

    # ── 2. long_break ───────────────────────────────────
    if is_break and last_break_start:
        started = _parse(last_break_start.get("timestamp"))
        if started and (now - started).total_seconds() > 60 * 60:
            mins = int((now - started).total_seconds() / 60)
            reminders.append({
                "id": "long_break",
                "severity": "info",
                "title": "Lange Pause",
                "body": f"Deine Pause läuft seit {mins} Min — alles ok?",
                "icon": "clock",
            })

    # ── 3. shift_starting / shift_end_overdue ─────────────
    shifts = await db.staff_shifts.find(
        {"staff_id": staff_id, "start_time": {"$gte": _iso(today_start - timedelta(days=1)), "$lte": _iso(now + timedelta(hours=24))}},
        {"_id": 0},
    ).sort("start_time", 1).to_list(20)

    for s in shifts:
        start = _parse(s.get("start_time"))
        end = _parse(s.get("end_time"))
        # 3a. starting soon (only if currently off)
        if is_off and start:
            mins_to = (start - now).total_seconds() / 60
            if 0 < mins_to <= 15:
                reminders.append({
                    "id": f"shift_starting:{s.get('id')}",
                    "severity": "info",
                    "title": "Schicht beginnt bald",
                    "body": f"Deine Schicht beginnt in {int(mins_to)} Min" + (f" bei {s.get('location')}" if s.get("location") else ""),
                    "icon": "calendar",
                })
        # 3b. shift end overdue
        if is_working and end and end < now - timedelta(minutes=10):
            mins_over = int((now - end).total_seconds() / 60)
            reminders.append({
                "id": f"shift_end_overdue:{s.get('id')}",
                "severity": "warning",
                "title": "Bitte auschecken",
                "body": f"Deine Schicht endete vor {mins_over} Min — vergiss nicht auszuchecken.",
                "icon": "square",
            })
            break

    # ── 4. arrival_no_checkin (geofence inside, off) ───────
    if is_off:
        latest_geo = await db.staff_geofence_events.find_one(
            {"staff_id": staff_id, "event_type": "entered", "ts": {"$gte": _iso(now - timedelta(minutes=30))}},
            {"_id": 0}, sort=[("ts", -1)],
        )
        if latest_geo:
            entered_at = _parse(latest_geo.get("ts"))
            if entered_at and (now - entered_at).total_seconds() > 5 * 60:
                fence = await db.staff_geofences.find_one({"id": latest_geo["geofence_id"]}, {"_id": 0})
                reminders.append({
                    "id": f"arrival_no_checkin:{latest_geo['geofence_id']}",
                    "severity": "info",
                    "title": "Du bist angekommen",
                    "body": f"Du bist seit ein paar Minuten bei {fence.get('name') if fence else 'deinem Arbeitsplatz'} — Shift starten?",
                    "icon": "map-pin",
                })

    return {"reminders": reminders, "count": len(reminders), "checked_at": _iso(now)}


class DispatchBody(BaseModel):
    reminder_ids: List[str]


@router.post("/dispatch")
async def dispatch_push(body: DispatchBody, request: Request):
    """Sends push for the given reminder ids (idempotent per (staff, reminder_id, day))."""
    staff = await _staff(request)
    today = _now().strftime("%Y-%m-%d")
    sent: List[dict] = []
    skipped: List[dict] = []

    try:
        from utils.onesignal_push import send_to_staff, is_configured
    except Exception:
        return {"sent": [], "skipped": [], "reason": "push_module_missing"}

    if not is_configured():
        return {"sent": [], "skipped": [{"reason": "not_configured"}]}

    # Re-evaluate current reminders to ensure validity
    current = await check_reminders(request)
    valid = {r["id"]: r for r in current.get("reminders", [])}

    for rid in body.reminder_ids:
        r = valid.get(rid)
        if not r:
            skipped.append({"id": rid, "reason": "expired"})
            continue
        # idempotency check
        exists = await db.staff_reminder_log.find_one({
            "staff_id": staff["id"], "reminder_id": rid, "day": today
        }, {"_id": 0})
        if exists:
            skipped.append({"id": rid, "reason": "already_sent"})
            continue
        try:
            await send_to_staff(staff["id"], r["title"], r["body"])
            await db.staff_reminder_log.insert_one({
                "id": str(uuid4()),
                "staff_id": staff["id"],
                "merchant_id": staff["merchant_id"],
                "reminder_id": rid,
                "day": today,
                "sent_at": _iso(_now()),
            })
            sent.append({"id": rid, "title": r["title"]})
        except Exception as e:
            skipped.append({"id": rid, "reason": f"send_failed: {e}"})

    return {"sent": sent, "skipped": skipped}
