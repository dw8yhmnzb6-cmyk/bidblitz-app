"""
BidBlitz Staff - Erweiterte Reports & Exports
==============================================
Tag / Woche / Monat / Mitarbeiter / Standort / Warnung
"""
from fastapi import APIRouter, HTTPException, Request, Response
from typing import Optional
from datetime import datetime, timedelta, timezone
import os, io, csv
from motor.motor_asyncio import AsyncIOMotorClient

router = APIRouter(prefix="/api/staff/reports", tags=["staff-reports"])
client = AsyncIOMotorClient(os.getenv("MONGO_URL"))
db = client[os.getenv("DB_NAME", "bidblitz")]


async def _merchant_id(request: Request) -> str:
    from routes.auth import get_current_user as auth_user
    user = await auth_user(request)
    if user.get("role") not in ("merchant", "admin"):
        raise HTTPException(403, "Nur für Händler oder Administratoren")
    return str(user.get("user_id") or user.get("id"))


async def _aggregate(merchant_id: str, start: datetime, end: datetime, staff_id: Optional[str] = None):
    q = {
        "merchant_id": merchant_id,
        "timestamp": {"$gte": start.isoformat(), "$lt": end.isoformat()},
    }
    if staff_id:
        q["staff_id"] = staff_id
    events = await db.staff_clock_events.find(q, {"_id": 0}).sort("timestamp", 1).to_list(length=2000)
    members = await db.staff_members.find({"merchant_id": merchant_id}, {"_id": 0}).to_list(length=300)
    name_map = {m["id"]: m["name"] for m in members}
    rate_map = {m["id"]: float(m.get("hourly_rate") or 0) for m in members}

    by_staff: dict = {}
    last_in: dict = {}
    for ev in events:
        sid = ev["staff_id"]
        t = datetime.fromisoformat(ev["timestamp"].replace("Z", "+00:00"))
        if ev["action"] == "clock_in":
            last_in[sid] = t
        elif ev["action"] == "clock_out" and sid in last_in:
            minutes = int((t - last_in[sid]).total_seconds() / 60)
            row = by_staff.setdefault(sid, {"staff_id": sid, "name": name_map.get(sid, "?"), "minutes": 0, "events": 0})
            row["minutes"] += minutes
            row["events"] += 1
            last_in.pop(sid, None)

    rows = []
    total_min = 0
    total_cost = 0.0
    for sid, row in by_staff.items():
        h = round(row["minutes"] / 60.0, 2)
        cost = round(h * rate_map.get(sid, 0), 2)
        rows.append({**row, "hours": h, "estimated_cost_eur": cost, "hourly_rate": rate_map.get(sid, 0)})
        total_min += row["minutes"]
        total_cost += cost

    return {
        "rows": rows,
        "total_hours": round(total_min / 60.0, 2),
        "total_cost_eur": round(total_cost, 2),
        "period_start": start.isoformat(),
        "period_end": end.isoformat(),
        "event_count": len(events),
    }


@router.get("/daily")
async def daily_report(request: Request, date: Optional[str] = None, staff_id: Optional[str] = None):
    mid = await _merchant_id(request)
    d = datetime.fromisoformat(date) if date else datetime.now(timezone.utc).date()
    start = datetime(d.year, d.month, d.day, tzinfo=timezone.utc) if not isinstance(d, datetime) else d
    end = start + timedelta(days=1)
    data = await _aggregate(mid, start, end, staff_id)
    return {"success": True, "type": "daily", **data}


@router.get("/weekly")
async def weekly_report(request: Request, staff_id: Optional[str] = None):
    mid = await _merchant_id(request)
    now = datetime.now(timezone.utc)
    start = (now - timedelta(days=now.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)
    end = start + timedelta(days=7)
    data = await _aggregate(mid, start, end, staff_id)
    return {"success": True, "type": "weekly", **data}


@router.get("/monthly")
async def monthly_report(request: Request, year: Optional[int] = None, month: Optional[int] = None, staff_id: Optional[str] = None):
    mid = await _merchant_id(request)
    now = datetime.now(timezone.utc)
    y, m = year or now.year, month or now.month
    start = datetime(y, m, 1, tzinfo=timezone.utc)
    end = datetime(y + (1 if m == 12 else 0), 1 if m == 12 else m + 1, 1, tzinfo=timezone.utc)
    data = await _aggregate(mid, start, end, staff_id)
    return {"success": True, "type": "monthly", **data}


@router.get("/by-location")
async def location_report(request: Request):
    mid = await _merchant_id(request)
    events = await db.staff_clock_events.find(
        {"merchant_id": mid, "lat": {"$ne": None}}, {"_id": 0}
    ).to_list(length=2000)
    locs = await db.staff_locations.find({"merchant_id": mid}, {"_id": 0}).to_list(length=50)
    counts = {loc["id"]: {"location": loc["name"], "count": 0} for loc in locs}
    for ev in events:
        # naive: assign by nearest location
        if not locs:
            break
        from routes.staff_locations import _haversine_m
        closest = min(locs, key=lambda l: _haversine_m(ev["lat"], ev["lng"], l["lat"], l["lng"]))
        counts[closest["id"]]["count"] += 1
    return {"success": True, "type": "by_location", "rows": list(counts.values())}


@router.get("/warnings")
async def warnings_report(request: Request):
    mid = await _merchant_id(request)
    items = await db.staff_warnings.find({"merchant_id": mid}, {"_id": 0}).sort("created_at", -1).to_list(length=500)
    by_type: dict = {}
    for w in items:
        by_type[w["type"]] = by_type.get(w["type"], 0) + 1
    return {"success": True, "type": "warnings", "total": len(items), "by_type": by_type, "items": items[:100]}


@router.get("/export/csv")
async def export_csv(request: Request, period: str = "monthly"):
    mid = await _merchant_id(request)
    if period == "weekly":
        data = await weekly_report(request)
    elif period == "daily":
        data = await daily_report(request)
    else:
        data = await monthly_report(request)
    buf = io.StringIO()
    w = csv.writer(buf, delimiter=";")
    w.writerow(["Mitarbeiter", "Stunden", "Stundensatz EUR", "Kosten EUR", "Events"])
    for row in data.get("rows", []):
        w.writerow([row["name"], row["hours"], row["hourly_rate"], row["estimated_cost_eur"], row["events"]])
    w.writerow([])
    w.writerow(["Gesamt", data.get("total_hours"), "", data.get("total_cost_eur"), data.get("event_count")])
    return Response(
        content=buf.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="bidblitz_staff_{period}.csv"'},
    )


@router.get("/export/datev")
async def export_datev(request: Request, period: str = "monthly"):
    """DATEV-Lohn Placeholder Export"""
    mid = await _merchant_id(request)
    data = await monthly_report(request) if period == "monthly" else await weekly_report(request)
    buf = io.StringIO()
    w = csv.writer(buf, delimiter=";")
    # Simplified DATEV-Lohn LBN header (placeholder)
    w.writerow(["Personalnummer", "Name", "Lohnart", "Stunden", "Betrag"])
    for row in data.get("rows", []):
        w.writerow([row["staff_id"][:8], row["name"], "100", row["hours"], row["estimated_cost_eur"]])
    return Response(
        content=buf.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="datev_lohn_{period}.csv"'},
    )
