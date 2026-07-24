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
    m = await db.staff_members.find_one({"id": sid, "active": True}, {"_id": 0, "pin_hash": 0, "password_hash": 0})
    if not m:
        raise HTTPException(401, "Session ungültig")
    return m


# Deutsche bundesweite Feiertage 2026 (statisch, Erweiterung möglich)
DE_HOLIDAYS = {
    "2026-01-01", "2026-04-03", "2026-04-06", "2026-05-01", "2026-05-14",
    "2026-05-25", "2026-10-03", "2026-12-25", "2026-12-26",
    "2027-01-01", "2027-03-26", "2027-03-29", "2027-05-01", "2027-05-06",
    "2027-05-17", "2027-10-03", "2027-12-25", "2027-12-26",
}


def _is_double_day(day_iso: str) -> bool:
    """Sonntag oder Feiertag → 2x Lohn (Connecteam "Double hours")."""
    try:
        d = datetime.fromisoformat(day_iso)
        if d.weekday() == 6:  # Sunday
            return True
    except Exception:
        pass
    return day_iso in DE_HOLIDAYS


def _compute_per_day(events: list, leaves_set: set) -> dict:
    """Returns { day_iso: {work_min, break_min, regular_min, overtime_min, double_min, absence: bool} }"""
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
    # Double-Hours: Sonntag/Feiertag → wird separat ausgewiesen (100% der work_min sind double)
    for day, d in by_day.items():
        regular = min(d["work_min"], 8 * 60)
        d["regular_min"] = regular
        d["overtime_min"] = max(0, d["work_min"] - regular)
        d["double_min"] = d["work_min"] if _is_double_day(day) else 0
        d["absence"] = day in leaves_set
    return dict(by_day)


@router.get("/team-overview")
async def team_overview(request: Request, days: int = 7,
                        start_date: Optional[str] = None, end_date: Optional[str] = None):
    """Connecteam-Style: alle Mitarbeiter mit Stunden-Aufschlüsselung.
    Entweder `days` (rolling) ODER `start_date`+`end_date` (YYYY-MM-DD inclusive)."""
    mid = await _merchant_id(request)
    now = datetime.now(timezone.utc)
    if start_date and end_date:
        try:
            start = datetime.fromisoformat(start_date).replace(tzinfo=timezone.utc, hour=0, minute=0, second=0, microsecond=0)
            end = (datetime.fromisoformat(end_date).replace(tzinfo=timezone.utc) + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
        except Exception:
            raise HTTPException(400, "Ungültige Datumsangaben")
        period_days = (end - start).days
    else:
        start = (now - timedelta(days=days - 1)).replace(hour=0, minute=0, second=0, microsecond=0)
        end = now + timedelta(days=1)
        period_days = days

    members = await db.staff_members.find({"merchant_id": mid, "active": True}, {"_id": 0, "pin_hash": 0, "password_hash": 0}).to_list(length=500)
    if not members:
        return {"success": True, "rows": [], "totals": {"work": 0, "break": 0, "regular": 0, "overtime": 0, "double": 0, "absence_days": 0, "active_staff": 0, "regular_hours": 0, "overtime_hours": 0, "double_hours": 0, "break_hours": 0}, "period_days": period_days, "period_start": start.date().isoformat(), "period_end": (end - timedelta(days=1)).date().isoformat()}

    events = await db.staff_clock_events.find(
        {"merchant_id": mid, "timestamp": {"$gte": start.isoformat(), "$lt": end.isoformat()}},
        {"_id": 0, "staff_id": 1, "action": 1, "timestamp": 1},
    ).sort("timestamp", 1).to_list(length=20000)

    leaves = await db.staff_leave_requests.find(
        {"merchant_id": mid, "status": "approved", "start_date": {"$gte": start.date().isoformat()}},
        {"_id": 0},
    ).to_list(length=1000)
    leave_set = {(lv["staff_id"], lv.get("start_date", "")) for lv in leaves}

    by_staff: dict = defaultdict(list)
    for ev in events:
        by_staff[ev["staff_id"]].append(ev)

    rows = []
    totals = {"work": 0, "break": 0, "regular": 0, "overtime": 0, "double": 0, "absence_days": 0}
    for m in members:
        sid = m["id"]
        days_data = _compute_per_day(by_staff.get(sid, []), {d for s, d in leave_set if s == sid})
        work = sum(d["work_min"] for d in days_data.values())
        brk = sum(d["break_min"] for d in days_data.values())
        reg = sum(d["regular_min"] for d in days_data.values())
        ot = sum(d["overtime_min"] for d in days_data.values())
        dbl = sum(d.get("double_min", 0) for d in days_data.values())
        absences = sum(1 for d in days_data.values() if d["absence"])
        rate = float(m.get("hourly_rate") or 0)
        # Kosten: regular + ot*1.25 + double*2 (zusätzlich auf die normalen Stunden)
        cost = (reg / 60.0) * rate + (ot / 60.0) * rate * 1.25 + (dbl / 60.0) * rate
        rows.append({
            "staff_id": sid,
            "name": m["name"],
            "staff_role": m.get("staff_role"),
            "hourly_rate": rate,
            "work_minutes": work,
            "break_minutes": brk,
            "regular_minutes": reg,
            "overtime_minutes": ot,
            "double_minutes": dbl,
            "absence_days": absences,
            "total_hours": round(work / 60.0, 2),
            "regular_hours": round(reg / 60.0, 2),
            "overtime_hours": round(ot / 60.0, 2),
            "double_hours": round(dbl / 60.0, 2),
            "break_hours": round(brk / 60.0, 2),
            "cost_eur": round(cost, 2),
        })
        totals["work"] += work
        totals["break"] += brk
        totals["regular"] += reg
        totals["overtime"] += ot
        totals["double"] += dbl
        totals["absence_days"] += absences

    return {
        "success": True,
        "rows": sorted(rows, key=lambda r: r["total_hours"], reverse=True),
        "totals": {
            "work_hours": round(totals["work"] / 60.0, 2),
            "break_hours": round(totals["break"] / 60.0, 2),
            "regular_hours": round(totals["regular"] / 60.0, 2),
            "overtime_hours": round(totals["overtime"] / 60.0, 2),
            "double_hours": round(totals["double"] / 60.0, 2),
            "absence_days": totals["absence_days"],
            "active_staff": len(members),
        },
        "period_days": period_days,
        "period_start": start.date().isoformat(),
        "period_end": (end - timedelta(days=1)).date().isoformat(),
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
    leave_set = {lv["start_date"] for lv in leaves}

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



@router.get("/me/day")
async def my_day_detail(date: str, member=Depends(_staff_session)):
    """Connecteam-Style: alle Events eines Tages für eigenen MA (mit Attachments)."""
    try:
        d = datetime.fromisoformat(date).replace(tzinfo=timezone.utc)
    except Exception:
        raise HTTPException(400, "Ungültiges Datum (YYYY-MM-DD)")
    start = d.replace(hour=0, minute=0, second=0, microsecond=0)
    end = start + timedelta(days=1)
    events = await db.staff_clock_events.find(
        {"merchant_id": member["merchant_id"], "staff_id": member["id"],
         "timestamp": {"$gte": start.isoformat(), "$lt": end.isoformat()}},
        {"_id": 0},
    ).sort("timestamp", 1).to_list(length=500)

    summary = _compute_per_day(events, set()).get(start.date().isoformat(), {
        "work_min": 0, "break_min": 0, "regular_min": 0, "overtime_min": 0
    })
    return {
        "success": True,
        "date": start.date().isoformat(),
        "events": events,
        "summary": {
            "total_hours": round(summary["work_min"] / 60.0, 2),
            "regular_hours": round(summary.get("regular_min", 0) / 60.0, 2),
            "overtime_hours": round(summary.get("overtime_min", 0) / 60.0, 2),
            "break_hours": round(summary["break_min"] / 60.0, 2),
            "event_count": len(events),
        },
    }


@router.get("/manager/day-detail")
async def manager_day_detail(staff_id: str, date: str, request: Request):
    """Manager Day-Detail: alle Events eines MA an einem Tag."""
    mid = await _merchant_id(request)
    member = await db.staff_members.find_one(
        {"id": staff_id, "merchant_id": mid}, {"_id": 0, "pin_hash": 0, "password_hash": 0}
    )
    if not member:
        raise HTTPException(404, "Mitarbeiter nicht gefunden")
    try:
        d = datetime.fromisoformat(date).replace(tzinfo=timezone.utc)
    except Exception:
        raise HTTPException(400, "Ungültiges Datum (YYYY-MM-DD)")
    start = d.replace(hour=0, minute=0, second=0, microsecond=0)
    end = start + timedelta(days=1)
    events = await db.staff_clock_events.find(
        {"merchant_id": mid, "staff_id": staff_id,
         "timestamp": {"$gte": start.isoformat(), "$lt": end.isoformat()}},
        {"_id": 0},
    ).sort("timestamp", 1).to_list(length=500)
    summary = _compute_per_day(events, set()).get(start.date().isoformat(), {
        "work_min": 0, "break_min": 0, "regular_min": 0, "overtime_min": 0
    })
    return {
        "success": True,
        "member": member,
        "date": start.date().isoformat(),
        "events": events,
        "summary": {
            "total_hours": round(summary["work_min"] / 60.0, 2),
            "regular_hours": round(summary.get("regular_min", 0) / 60.0, 2),
            "overtime_hours": round(summary.get("overtime_min", 0) / 60.0, 2),
            "break_hours": round(summary["break_min"] / 60.0, 2),
        },
    }


@router.get("/team-overview.csv")
async def team_overview_csv(request: Request, days: int = 7):
    """CSV Export Team-Übersicht für Buchhaltung/Lohn."""
    from fastapi.responses import PlainTextResponse
    data = await team_overview(request, days)
    rows = data["rows"]
    lines = [
        "Name;Rolle;Stundensatz;Regulär (h);Überstunden (h);Pause (h);Gesamt (h);Abwesenheiten;Kosten EUR"
    ]
    for r in rows:
        lines.append(
            f"{r['name']};{r.get('staff_role') or ''};{r['hourly_rate']:.2f};"
            f"{r['regular_hours']:.2f};{r['overtime_hours']:.2f};{r['break_hours']:.2f};"
            f"{r['total_hours']:.2f};{r['absence_days']};{r['cost_eur']:.2f}"
        )
    csv = "\n".join(lines)
    return PlainTextResponse(csv, media_type="text/csv; charset=utf-8")


@router.get("/me/month")
async def my_month(month: Optional[str] = None, member=Depends(_staff_session)):
    """Monats-Timesheet (Tag für Tag) für eigenen MA."""
    if month:
        try:
            anchor = datetime.fromisoformat(month + "-01").replace(tzinfo=timezone.utc)
        except Exception:
            raise HTTPException(400, "Ungültiger Monat (YYYY-MM)")
    else:
        anchor = datetime.now(timezone.utc).replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    if anchor.month == 12:
        next_month = anchor.replace(year=anchor.year + 1, month=1)
    else:
        next_month = anchor.replace(month=anchor.month + 1)

    events = await db.staff_clock_events.find(
        {"merchant_id": member["merchant_id"], "staff_id": member["id"],
         "timestamp": {"$gte": anchor.isoformat(), "$lt": next_month.isoformat()}},
        {"_id": 0, "action": 1, "timestamp": 1},
    ).sort("timestamp", 1).to_list(length=5000)

    leaves = await db.staff_leave_requests.find(
        {"merchant_id": member["merchant_id"], "staff_id": member["id"], "status": "approved"},
        {"_id": 0, "start_date": 1},
    ).to_list(length=100)
    leave_set = {lv["start_date"] for lv in leaves}

    days_data = _compute_per_day(events, leave_set)

    day_count = (next_month - anchor).days
    days_list = []
    weekdays = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"]
    for i in range(day_count):
        dt = (anchor + timedelta(days=i))
        day_iso = dt.date().isoformat()
        d = days_data.get(day_iso, {"work_min": 0, "break_min": 0, "regular_min": 0, "overtime_min": 0, "absence": False})
        days_list.append({
            "date": day_iso,
            "weekday": weekdays[dt.weekday()],
            "total_hours": round(d["work_min"] / 60.0, 2),
            "regular_hours": round(d.get("regular_min", 0) / 60.0, 2),
            "overtime_hours": round(d.get("overtime_min", 0) / 60.0, 2),
            "break_hours": round(d["break_min"] / 60.0, 2),
            "absence": d.get("absence", False),
        })
    total = sum(d["work_min"] for d in days_data.values())
    return {
        "success": True,
        "month": anchor.strftime("%Y-%m"),
        "days": days_list,
        "totals": {
            "total_hours": round(total / 60.0, 2),
            "regular_hours": round(sum(d["regular_min"] for d in days_data.values()) / 60.0, 2),
            "overtime_hours": round(sum(d["overtime_min"] for d in days_data.values()) / 60.0, 2),
            "break_hours": round(sum(d["break_min"] for d in days_data.values()) / 60.0, 2),
            "absence_days": sum(1 for d in days_data.values() if d.get("absence")),
        },
    }
