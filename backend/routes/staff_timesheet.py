"""
BidBlitz Staff - Team Timesheet Overview (Connecteam-style)
============================================================
Ein Endpoint liefert:
- Pro-Mitarbeiter: Regular / Overtime / Break / Absence / Total
- Mit Wochentag-Aufschlüsselung
- Filter: Zeitraum, einzelner MA

Plus Employee Timesheet: eigene Wochen-/Monatsansicht mit Tagen.
"""
from fastapi import APIRouter, HTTPException, Request, Depends
from typing import Optional
from datetime import datetime, timedelta, timezone
from collections import defaultdict
import os
from motor.motor_asyncio import AsyncIOMotorClient

router = APIRouter(prefix="/api/staff/timesheet", tags=["staff-timesheet"])
client = AsyncIOMotorClient(os.getenv("MONGO_URL"))
db = client[os.getenv("DB_NAME", "bidblitz")]

WEEKLY_REGULAR_LIMIT = 40 * 60  # 40h Regular, Rest = Overtime


async def _merchant_id(request: Request) -> str:
    from routes.auth import get_current_user as auth_user
    user = await auth_user(request)
    if user.get("role") not in ("merchant", "admin"):
        raise HTTPException(403, "Nur für Händler oder Administratoren")
    return str(user.get("user_id") or user.get("id"))


async def _staff_session(request: Request) -> dict:
    sid = request.cookies.get("staff_session")
    if not sid:
        raise HTTPException(401, "Nicht angemeldet")
    m = await db.staff_members.find_one({"id": sid, "active": True}, {"_id": 0, "pin_hash": 0})
    if not m:
        raise HTTPException(401, "Session ungültig")
    return m


def _compute_per_day(events: list, leaves_set: set) -> dict:
    """Returns { day_iso: {work_min, break_min, regular_min, overtime_min, absence: bool} }"""
    by_day: dict = defaultdict(lambda: {"work_min": 0, "break_min": 0})
    last_in = None
    break_start = None
    for ev in events:
        t = datetime.fromisoformat(ev["timestamp"].replace("Z", "+00:00"))
        day = t.date().isoformat()
        if ev["action"] == "clock_in":
            last_in = t
        elif ev["action"] == "clock_out" and last_in:
            by_day[day]["work_min"] += int((t - last_in).total_seconds() / 60)
            last_in = None
        elif ev["action"] == "break_start":
            break_start = t
        elif ev["action"] == "break_end" and break_start:
            by_day[day]["break_min"] += int((t - break_start).total_seconds() / 60)
            break_start = None

    # Split regular vs overtime: alles über 8h/Tag = overtime
    for day, d in by_day.items():
        regular = min(d["work_min"], 8 * 60)
        d["regular_min"] = regular
        d["overtime_min"] = max(0, d["work_min"] - regular)
        d["absence"] = day in leaves_set
    return dict(by_day)


@router.get("/team-overview")
async def team_overview(request: Request, days: int = 7):
    """Connecteam-Style: alle Mitarbeiter mit Stunden-Aufschlüsselung."""
    mid = await _merchant_id(request)
    now = datetime.now(timezone.utc)
    start = (now - timedelta(days=days - 1)).replace(hour=0, minute=0, second=0, microsecond=0)

    members = await db.staff_members.find({"merchant_id": mid, "active": True}, {"_id": 0, "pin_hash": 0}).to_list(length=500)
    if not members:
        return {"success": True, "rows": [], "totals": {"work": 0, "break": 0, "regular": 0, "overtime": 0, "absence_days": 0}, "period_days": days}

    events = await db.staff_clock_events.find(
        {"merchant_id": mid, "timestamp": {"$gte": start.isoformat()}},
        {"_id": 0, "staff_id": 1, "action": 1, "timestamp": 1},
    ).sort("timestamp", 1).to_list(length=20000)

    leaves = await db.staff_leave_requests.find(
        {"merchant_id": mid, "status": "approved", "start_date": {"$gte": start.date().isoformat()}},
        {"_id": 0},
    ).to_list(length=1000)
    leave_set = {(l["staff_id"], l.get("start_date", "")) for l in leaves}

    by_staff: dict = defaultdict(list)
    for ev in events:
        by_staff[ev["staff_id"]].append(ev)

    rows = []
    totals = {"work": 0, "break": 0, "regular": 0, "overtime": 0, "absence_days": 0}
    for m in members:
        sid = m["id"]
        days_data = _compute_per_day(by_staff.get(sid, []), {d for s, d in leave_set if s == sid})
        work = sum(d["work_min"] for d in days_data.values())
        brk = sum(d["break_min"] for d in days_data.values())
        reg = sum(d["regular_min"] for d in days_data.values())
        ot = sum(d["overtime_min"] for d in days_data.values())
        absences = sum(1 for d in days_data.values() if d["absence"])
        rate = float(m.get("hourly_rate") or 0)
        rows.append({
            "staff_id": sid,
            "name": m["name"],
            "staff_role": m.get("staff_role"),
            "hourly_rate": rate,
            "work_minutes": work,
            "break_minutes": brk,
            "regular_minutes": reg,
            "overtime_minutes": ot,
            "absence_days": absences,
            "total_hours": round(work / 60.0, 2),
            "regular_hours": round(reg / 60.0, 2),
            "overtime_hours": round(ot / 60.0, 2),
            "break_hours": round(brk / 60.0, 2),
            "cost_eur": round((reg / 60.0) * rate + (ot / 60.0) * rate * 1.25, 2),
        })
        totals["work"] += work
        totals["break"] += brk
        totals["regular"] += reg
        totals["overtime"] += ot
        totals["absence_days"] += absences

    return {
        "success": True,
        "rows": sorted(rows, key=lambda r: r["total_hours"], reverse=True),
        "totals": {
            "work_hours": round(totals["work"] / 60.0, 2),
            "break_hours": round(totals["break"] / 60.0, 2),
            "regular_hours": round(totals["regular"] / 60.0, 2),
            "overtime_hours": round(totals["overtime"] / 60.0, 2),
            "absence_days": totals["absence_days"],
            "active_staff": len(members),
        },
        "period_days": days,
        "period_start": start.date().isoformat(),
        "period_end": now.date().isoformat(),
    }


@router.get("/me/weekly")
async def my_weekly(request: Request, weeks_back: int = 0, member=Depends(_staff_session)):
    """Connecteam-Style Employee Wochen-Timesheet."""
    now = datetime.now(timezone.utc)
    monday = (now - timedelta(days=now.weekday() + 7 * weeks_back)).replace(hour=0, minute=0, second=0, microsecond=0)
    sunday_end = monday + timedelta(days=7)

    events = await db.staff_clock_events.find(
        {"merchant_id": member["merchant_id"], "staff_id": member["id"],
         "timestamp": {"$gte": monday.isoformat(), "$lt": sunday_end.isoformat()}},
        {"_id": 0},
    ).sort("timestamp", 1).to_list(length=500)

    leaves = await db.staff_leave_requests.find(
        {"merchant_id": member["merchant_id"], "staff_id": member["id"], "status": "approved",
         "start_date": {"$gte": monday.date().isoformat()}},
        {"_id": 0},
    ).to_list(length=50)
    leave_set = {l["start_date"] for l in leaves}

    days_data = _compute_per_day(events, leave_set)

    days_list = []
    weekdays = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"]
    for i in range(7):
        day_date = (monday + timedelta(days=i)).date().isoformat()
        d = days_data.get(day_date, {"work_min": 0, "break_min": 0, "regular_min": 0, "overtime_min": 0, "absence": False})
        days_list.append({
            "date": day_date,
            "weekday": weekdays[i],
            "regular_hours": round(d["regular_min"] / 60.0, 2),
            "overtime_hours": round(d["overtime_min"] / 60.0, 2),
            "break_hours": round(d["break_min"] / 60.0, 2),
            "total_hours": round(d["work_min"] / 60.0, 2),
            "absence": d["absence"],
        })

    total_work = sum(d["work_min"] for d in days_data.values())
    return {
        "success": True,
        "week_start": monday.date().isoformat(),
        "week_end": (sunday_end - timedelta(seconds=1)).date().isoformat(),
        "days": days_list,
        "totals": {
            "regular_hours": round(sum(d["regular_min"] for d in days_data.values()) / 60.0, 2),
            "overtime_hours": round(sum(d["overtime_min"] for d in days_data.values()) / 60.0, 2),
            "break_hours": round(sum(d["break_min"] for d in days_data.values()) / 60.0, 2),
            "total_hours": round(total_work / 60.0, 2),
            "absence_days": sum(1 for d in days_data.values() if d["absence"]),
        },
    }
