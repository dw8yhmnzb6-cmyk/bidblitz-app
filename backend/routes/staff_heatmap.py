"""
BidBlitz Staff — Shift-Heatmap (iter122)
==========================================
Aggregiert Clock-Events der letzten N Tage (default 30) zu einer
7×24 Matrix (weekday × hour) mit der durchschnittlichen Anzahl
gleichzeitig aktiver Mitarbeiter pro Stunden-Slot.

Hilft dem Manager, Stoßzeiten und Unter-/Überbesetzung zu erkennen.

Auth: Merchant/Admin.

Endpoint:
  GET /api/staff/heatmap/shifts?days=30&geofence_id=<optional>&under=2&peak=5

Response:
  {
    "days": 30,
    "from": "<iso>", "to": "<iso>",
    "geofence_id": null | string,
    "matrix": [ {weekday:0..6, hour:0..23, avg:float, max:int, total_minutes:int} ],
    "totals": {
      "events": int, "shifts_completed": int, "total_minutes": int,
      "unique_staff": int,
    },
    "under_staffed": [{weekday, hour, avg}],
    "peak": [{weekday, hour, avg}],
    "thresholds": {"under": 2, "peak": 5},
  }
"""
from __future__ import annotations

import math
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Request, Query

from core.database import db
from core.security import get_current_user

router = APIRouter(prefix="/api/staff/heatmap", tags=["staff-heatmap"])


async def _manager(request: Request) -> dict:
    user = await get_current_user(request)
    role = user.get("role")
    if role not in ("merchant", "admin"):
        raise HTTPException(403, "Nur Manager")
    uid = str(user.get("_id") or user.get("id") or "")
    merchant = await db.merchants.find_one({"owner_user_id": uid}, {"_id": 1})
    if not merchant:
        merchant = await db.merchants.find_one({"email": user.get("email")}, {"_id": 1})
    merchant_id = str(merchant["_id"]) if merchant else uid
    return {"id": uid, "merchant_id": merchant_id}


def _parse_iso(s: Optional[str]) -> Optional[datetime]:
    if not s:
        return None
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00"))
    except Exception:
        return None


def _haversine_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2) ** 2
    return 6371000.0 * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


async def _build_shift_intervals(merchant_id: str, t_from: datetime, t_to: datetime,
                                  geofence: Optional[dict]) -> list[tuple[datetime, datetime, str]]:
    """
    Baut (start_dt, end_dt, staff_id) Intervalle aus clock_in/clock_out Paaren.
    Berücksichtigt auch noch laufende Schichten (end = t_to).
    Optionale Geofence-Filterung: wenigstens ein Event im Geofence-Radius.
    """
    # Hole alle Events sortiert (im erweiterten Fenster, damit clock_in vor t_from auch
    # in einem laufenden Shift gefangen wird)
    extended_from = t_from - timedelta(days=2)
    cursor = db.staff_clock_events.find(
        {
            "merchant_id": merchant_id,
            "timestamp": {"$gte": extended_from.isoformat(), "$lte": t_to.isoformat()},
            "action": {"$in": ["clock_in", "clock_out"]},
        },
        {"_id": 0, "staff_id": 1, "action": 1, "timestamp": 1, "lat": 1, "lng": 1},
    ).sort("timestamp", 1)

    by_staff: dict[str, list[dict]] = {}
    async for ev in cursor:
        by_staff.setdefault(ev["staff_id"], []).append(ev)

    intervals: list[tuple[datetime, datetime, str]] = []
    for staff_id, events in by_staff.items():
        current_start: Optional[datetime] = None
        current_in_geofence: bool = True if not geofence else False
        for ev in events:
            t = _parse_iso(ev["timestamp"])
            if not t:
                continue
            if ev["action"] == "clock_in":
                current_start = t
                if geofence and ev.get("lat") is not None and ev.get("lng") is not None:
                    d = _haversine_m(ev["lat"], ev["lng"], geofence["lat"], geofence["lng"])
                    current_in_geofence = d <= (geofence.get("radius_m") or 200)
                else:
                    current_in_geofence = not geofence
            elif ev["action"] == "clock_out" and current_start is not None:
                if current_in_geofence:
                    intervals.append((current_start, t, staff_id))
                current_start = None
                current_in_geofence = True if not geofence else False
        # Noch laufender Shift?
        if current_start is not None and current_in_geofence:
            intervals.append((current_start, t_to, staff_id))
    return intervals


def _compute_matrix(intervals: list[tuple[datetime, datetime, str]],
                    t_from: datetime, t_to: datetime) -> dict:
    """
    Iteriert minute-by-minute über alle Intervalle und aggregiert pro (weekday, hour)
    Slot die Anzahl gleichzeitiger Mitarbeiter sowie die Gesamt-Minuten.
    """
    # cell key = (weekday 0..6, hour 0..23)
    # collect: per cell → list of (date, minute-count, distinct staff)
    # For avg "concurrent", count per (date, hour) the distinct staff active in that hour,
    # then aggregate by weekday-hour as average across dates observed.
    per_date_cell: dict[tuple[str, int, int], set] = {}  # (yyyy-mm-dd, weekday, hour) → set(staff)
    minute_counts: dict[tuple[int, int], int] = {}

    for start, end, staff_id in intervals:
        # Clip to window
        s = max(start, t_from)
        e = min(end, t_to)
        if s >= e:
            continue
        # Walk in hour-steps, distinct staff per (date, hour)
        cur = s.replace(minute=0, second=0, microsecond=0)
        while cur < e:
            nxt = cur + timedelta(hours=1)
            hour_start = max(cur, s)
            hour_end = min(nxt, e)
            if hour_end > hour_start:
                d = cur.date().isoformat()
                w = cur.weekday()
                h = cur.hour
                per_date_cell.setdefault((d, w, h), set()).add(staff_id)
                minute_counts[(w, h)] = minute_counts.get((w, h), 0) + int(
                    (hour_end - hour_start).total_seconds() // 60
                )
            cur = nxt

    # Average concurrent: per (w,h) = sum(distinct count per observed date) / # observed dates
    cells: dict[tuple[int, int], dict] = {}
    for (date_iso, w, h), staff_set in per_date_cell.items():
        c = cells.setdefault((w, h), {"sum": 0, "dates": 0, "max": 0})
        c["sum"] += len(staff_set)
        c["dates"] += 1
        c["max"] = max(c["max"], len(staff_set))

    matrix = []
    for w in range(7):
        for h in range(24):
            cell = cells.get((w, h), {"sum": 0, "dates": 0, "max": 0})
            avg = cell["sum"] / cell["dates"] if cell["dates"] > 0 else 0.0
            matrix.append({
                "weekday": w,
                "hour": h,
                "avg": round(avg, 2),
                "max": cell["max"],
                "total_minutes": minute_counts.get((w, h), 0),
                "samples": cell["dates"],
            })
    return {"matrix": matrix}


@router.get("/shifts")
async def shift_heatmap(
    request: Request,
    days: int = Query(30, ge=1, le=180),
    geofence_id: Optional[str] = Query(None),
    under: float = Query(2.0, ge=0.0, le=50.0),
    peak: float = Query(5.0, ge=0.5, le=100.0),
):
    """7×24 Heatmap mit durchschnittlich aktiver Mitarbeiterzahl pro Stunden-Slot."""
    mgr = await _manager(request)
    merchant_id = mgr["merchant_id"]
    t_to = datetime.now(timezone.utc)
    t_from = t_to - timedelta(days=days)

    # Optional: Geofence laden
    geofence = None
    if geofence_id:
        g = await db.staff_geofences.find_one(
            {"id": geofence_id, "merchant_id": merchant_id},
            {"_id": 0, "id": 1, "name": 1, "lat": 1, "lng": 1, "radius_m": 1},
        )
        if not g:
            raise HTTPException(404, "Geofence nicht gefunden")
        geofence = g

    intervals = await _build_shift_intervals(merchant_id, t_from, t_to, geofence)
    res = _compute_matrix(intervals, t_from, t_to)
    matrix = res["matrix"]

    # Totals
    total_minutes = sum(c["total_minutes"] for c in matrix)
    unique_staff = len({i[2] for i in intervals})
    shifts_completed = sum(1 for s, e, _ in intervals if e < t_to)

    under_cells = sorted(
        [c for c in matrix if c["samples"] > 0 and c["avg"] < under],
        key=lambda c: c["avg"],
    )[:20]
    peak_cells = sorted(
        [c for c in matrix if c["avg"] >= peak],
        key=lambda c: -c["avg"],
    )[:20]

    # Geofence-Liste für FE-Filter
    geofences = []
    async for g in db.staff_geofences.find(
        {"merchant_id": merchant_id, "active": {"$ne": False}},
        {"_id": 0, "id": 1, "name": 1},
    ):
        geofences.append(g)

    return {
        "days": days,
        "from": t_from.isoformat(),
        "to": t_to.isoformat(),
        "geofence_id": geofence_id,
        "geofences": geofences,
        "matrix": matrix,
        "totals": {
            "events": len(intervals) * 2,  # rough estimate (in + out)
            "shifts_completed": shifts_completed,
            "total_minutes": total_minutes,
            "total_hours": round(total_minutes / 60, 1),
            "unique_staff": unique_staff,
        },
        "under_staffed": under_cells,
        "peak": peak_cells,
        "thresholds": {"under": under, "peak": peak},
    }
