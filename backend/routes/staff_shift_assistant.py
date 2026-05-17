"""
BidBlitz Staff — AI-Schichtplan-Assistent (P3)
==============================================
Heuristik-basierte Schichtplan-Empfehlungen aus der Heatmap-Matrix.
Keine LLM-Calls — schnell, deterministisch, kostenfrei.

Logik:
  1. Hole 7×24 Heatmap-Matrix der letzten N Tage
  2. Pro Wochentag: identifiziere zusammenhängende Hoch-Demand-Stunden
  3. Schlage 4-8h Schichten vor, deren Personalbedarf = ceil(avg_demand * coverage_factor)
  4. Markiere Under-Staffed-Slots als rote Warnung
  5. Optional: Vorschlag für Off-Peak Pausen-Slots

Endpoint:
  GET /api/staff/shift-assistant/suggestions?days=30&coverage=1.1

Response:
  {
    "days": 30,
    "coverage_factor": 1.1,
    "suggestions": [
      { "weekday": 0, "weekday_label": "Mo",
        "start_hour": 8, "end_hour": 14, "duration_h": 6,
        "needed_staff": 4, "avg_demand": 3.6, "peak_demand": 5,
        "confidence": "high", "reason": "Tagesstoßzeit Mo 08–14 mit ø 3.6 / max 5" }
    ],
    "warnings": [
      { "weekday": 5, "hour": 18, "avg": 0.5,
        "message": "Sa 18 Uhr: Unterbesetzt (ø 0.5)" }
    ],
    "totals": {"shifts": 14, "warnings": 3}
  }
"""
from __future__ import annotations

import math
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Request, Query

from core.database import db
from core.security import get_current_user
from routes.staff_heatmap import _build_shift_intervals, _compute_matrix  # reuse

router = APIRouter(prefix="/api/staff/shift-assistant", tags=["staff-shift-assistant"])

WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"]


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


def _build_shifts_for_weekday(
    weekday: int,
    hours_matrix: list[dict],
    coverage_factor: float,
    min_demand: float,
    min_shift_h: int = 4,
    max_shift_h: int = 8,
) -> list[dict]:
    """Greift zusammenhängende Hoch-Demand-Slots ab und schneidet sie in 4-8h Schichten."""
    # hours_matrix: 24 cells for this weekday, sorted by hour
    busy_flags = [c["avg"] >= min_demand for c in hours_matrix]
    shifts: list[dict] = []
    i = 0
    while i < 24:
        if not busy_flags[i]:
            i += 1
            continue
        j = i
        while j < 24 and busy_flags[j]:
            j += 1
        # busy block [i..j-1]
        # Split into chunks max_shift_h, but combine short tails into prior
        start = i
        while start < j:
            chunk = min(max_shift_h, j - start)
            if chunk < min_shift_h and shifts and shifts[-1]["weekday"] == weekday:
                # extend previous
                prev = shifts[-1]
                if prev["end_hour"] == start:
                    prev["end_hour"] = start + chunk
                    prev["duration_h"] = prev["end_hour"] - prev["start_hour"]
                    sub_cells = hours_matrix[prev["start_hour"]:prev["end_hour"]]
                    if sub_cells:
                        prev["avg_demand"] = round(sum(c["avg"] for c in sub_cells) / len(sub_cells), 2)
                        prev["peak_demand"] = max(c["max"] for c in sub_cells)
                        prev["needed_staff"] = max(1, math.ceil(prev["avg_demand"] * coverage_factor))
                start += chunk
                continue
            sub = hours_matrix[start:start + chunk]
            avg_d = round(sum(c["avg"] for c in sub) / len(sub), 2) if sub else 0
            peak = max((c["max"] for c in sub), default=0)
            needed = max(1, math.ceil(avg_d * coverage_factor))
            confidence = "high" if all(c["samples"] >= 3 for c in sub) else "low"
            shifts.append({
                "weekday": weekday,
                "weekday_label": WEEKDAYS[weekday],
                "start_hour": start,
                "end_hour": start + chunk,
                "duration_h": chunk,
                "avg_demand": avg_d,
                "peak_demand": peak,
                "needed_staff": needed,
                "confidence": confidence,
                "reason": f"{WEEKDAYS[weekday]} {start:02d}–{start+chunk:02d} Uhr · ø {avg_d:.1f}, max {peak}",
            })
            start += chunk
        i = j
    return shifts


@router.get("/suggestions")
async def shift_suggestions(
    request: Request,
    days: int = Query(30, ge=7, le=90),
    coverage: float = Query(1.1, ge=1.0, le=2.0),
    min_demand: float = Query(1.5, ge=0.5, le=20.0),
):
    """AI-Schichtplan: Empfiehlt Schichten basierend auf historischer Personalbedarf-Heatmap."""
    mgr = await _manager(request)
    merchant_id = mgr["merchant_id"]
    t_to = datetime.now(timezone.utc)
    t_from = t_to - timedelta(days=days)

    intervals = await _build_shift_intervals(merchant_id, t_from, t_to, None)
    res = _compute_matrix(intervals, t_from, t_to)
    matrix = res["matrix"]  # list of 168 cells

    # group by weekday → 24 cells each
    by_wd: dict[int, list[dict]] = {w: [None] * 24 for w in range(7)}
    for c in matrix:
        by_wd[c["weekday"]][c["hour"]] = c

    all_shifts: list[dict] = []
    warnings: list[dict] = []
    for w in range(7):
        wd_cells = by_wd[w]
        shifts = _build_shifts_for_weekday(w, wd_cells, coverage, min_demand)
        all_shifts.extend(shifts)
        # Warnings: cells with samples >= 3 but avg < min_demand AND historical max >= 2
        for c in wd_cells:
            if c["samples"] >= 3 and c["avg"] < min_demand and c["max"] >= 2:
                warnings.append({
                    "weekday": w,
                    "weekday_label": WEEKDAYS[w],
                    "hour": c["hour"],
                    "avg": c["avg"],
                    "max": c["max"],
                    "message": f"{WEEKDAYS[w]} {c['hour']:02d} Uhr: Unterbesetzung (ø {c['avg']:.1f}, max {c['max']})",
                })

    # Sort shifts by weekday, start
    all_shifts.sort(key=lambda s: (s["weekday"], s["start_hour"]))

    # Total recommended weekly staff-hours
    total_staff_hours = sum(s["needed_staff"] * s["duration_h"] for s in all_shifts)

    return {
        "days": days,
        "coverage_factor": coverage,
        "min_demand_threshold": min_demand,
        "from": t_from.isoformat(),
        "to": t_to.isoformat(),
        "suggestions": all_shifts,
        "warnings": warnings[:30],
        "totals": {
            "shifts": len(all_shifts),
            "warnings": len(warnings),
            "weekly_staff_hours": total_staff_hours,
        },
    }
