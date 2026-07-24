"""
BidBlitz Staff - Warnings & Auto-Error Detection
================================================
- Mitarbeiter nicht ausgecheckt
- Pause fehlt
- Schicht begonnen, aber niemand eingecheckt
- doppelter Check-in
- Überstunden über Limit
- GPS außerhalb (siehe staff_locations.validate_geofence)
"""
from fastapi import APIRouter, HTTPException, Request
from typing import Optional
from datetime import datetime, timedelta, timezone
from uuid import uuid4
import os
from motor.motor_asyncio import AsyncIOMotorClient

router = APIRouter(prefix="/api/staff/warnings", tags=["staff-warnings"])
client = AsyncIOMotorClient(os.getenv("MONGO_URL"))
db = client[os.getenv("DB_NAME", "bidblitz")]

OVERTIME_LIMIT_HOURS = 10
BREAK_REQUIRED_AFTER_HOURS = 6


async def _merchant_id(request: Request) -> str:
    from routes.auth import get_current_user as auth_user
    user = await auth_user(request)
    if user.get("role") not in ("merchant", "admin"):
        raise HTTPException(403, "Nur für Händler oder Administratoren")
    return str(user.get("user_id") or user.get("id"))


async def _store_warning(doc: dict):
    doc.setdefault("id", str(uuid4()))
    doc.setdefault("created_at", datetime.now(timezone.utc).isoformat())
    doc.setdefault("resolved", False)
    await db.staff_warnings.update_one(
        {
            "merchant_id": doc["merchant_id"],
            "staff_id": doc.get("staff_id"),
            "type": doc["type"],
            "ref_date": doc.get("ref_date"),
        },
        {"$set": doc},
        upsert=True,
    )


async def scan_for_warnings(merchant_id: str) -> dict:
    """Run all detectors for a merchant; returns list of warnings created/updated."""
    now = datetime.now(timezone.utc)
    today_str = now.date().isoformat()
    created: list = []

    # Load today's events
    today_start = datetime(now.year, now.month, now.day, tzinfo=timezone.utc)
    events = await db.staff_clock_events.find(
        {"merchant_id": merchant_id, "timestamp": {"$gte": today_start.isoformat()}},
        {"_id": 0},
    ).sort("timestamp", 1).to_list(length=500)

    # Group by staff
    by_staff: dict = {}
    for ev in events:
        by_staff.setdefault(ev["staff_id"], []).append(ev)

    members = await db.staff_members.find({"merchant_id": merchant_id, "active": True}, {"_id": 0}).to_list(length=200)

    for member in members:
        sid = member["id"]
        evs = by_staff.get(sid, [])

        # Check for not-checked-out (clock_in without clock_out, after 12h)
        ins = [e for e in evs if e["action"] == "clock_in"]
        outs = [e for e in evs if e["action"] == "clock_out"]
        if ins and len(outs) < len(ins):
            last_in = ins[-1]
            tin = datetime.fromisoformat(last_in["timestamp"].replace("Z", "+00:00"))
            if (now - tin).total_seconds() > 12 * 3600:
                w = {
                    "merchant_id": merchant_id, "staff_id": sid, "type": "no_clock_out",
                    "severity": "high", "message": f"{member['name']} hat sich nicht ausgecheckt",
                    "ref_date": today_str, "last_in": last_in["timestamp"],
                }
                await _store_warning(w); created.append(w)

        # Check duplicate clock-in within 5 min
        for i in range(1, len(ins)):
            t1 = datetime.fromisoformat(ins[i - 1]["timestamp"].replace("Z", "+00:00"))
            t2 = datetime.fromisoformat(ins[i]["timestamp"].replace("Z", "+00:00"))
            if (t2 - t1).total_seconds() < 300:
                w = {
                    "merchant_id": merchant_id, "staff_id": sid, "type": "duplicate_clock_in",
                    "severity": "medium", "message": f"Doppelter Check-in: {member['name']}",
                    "ref_date": today_str,
                }
                await _store_warning(w); created.append(w)

        # Overtime detection
        total_min = 0
        last_in_t = None
        for e in evs:
            t = datetime.fromisoformat(e["timestamp"].replace("Z", "+00:00"))
            if e["action"] == "clock_in":
                last_in_t = t
            elif e["action"] == "clock_out" and last_in_t:
                total_min += int((t - last_in_t).total_seconds() / 60)
                last_in_t = None
        hours = total_min / 60.0
        if hours > OVERTIME_LIMIT_HOURS:
            w = {
                "merchant_id": merchant_id, "staff_id": sid, "type": "overtime",
                "severity": "medium", "message": f"{member['name']} hat {hours:.1f}h gearbeitet (Limit {OVERTIME_LIMIT_HOURS}h)",
                "ref_date": today_str, "hours": round(hours, 2),
            }
            await _store_warning(w); created.append(w)

        # Missing break after 6h work without break
        if hours >= BREAK_REQUIRED_AFTER_HOURS:
            breaks = [e for e in evs if e["action"] in ("break_start", "break_end")]
            if not breaks:
                w = {
                    "merchant_id": merchant_id, "staff_id": sid, "type": "missing_break",
                    "severity": "medium",
                    "message": f"{member['name']} hat keine Pause genommen ({hours:.1f}h)",
                    "ref_date": today_str,
                }
                await _store_warning(w); created.append(w)

    # Shifts started but nobody clocked in
    shifts = await db.staff_shifts.find(
        {"merchant_id": merchant_id, "start_time": {"$lte": now.isoformat()}, "end_time": {"$gte": today_start.isoformat()}},
        {"_id": 0},
    ).to_list(length=100)
    for sh in shifts:
        sid = sh.get("staff_id")
        if sid and not any(e["action"] == "clock_in" and e["staff_id"] == sid for e in events):
            w = {
                "merchant_id": merchant_id, "staff_id": sid, "type": "shift_no_checkin",
                "severity": "high", "message": "Schicht begonnen, aber kein Check-in",
                "ref_date": today_str, "shift_id": sh.get("id"),
            }
            await _store_warning(w); created.append(w)

    return {"success": True, "created": len(created), "warnings": created}


@router.post("/scan")
async def trigger_scan(request: Request):
    mid = await _merchant_id(request)
    return await scan_for_warnings(mid)


@router.get("/list")
async def list_warnings(request: Request, resolved: bool = False, limit: int = 100):
    mid = await _merchant_id(request)
    q = {"merchant_id": mid, "resolved": resolved}
    items = await db.staff_warnings.find(q, {"_id": 0}).sort("created_at", -1).to_list(length=limit)
    return {"success": True, "warnings": items, "count": len(items)}


@router.post("/{warning_id}/resolve")
async def resolve_warning(warning_id: str, request: Request):
    mid = await _merchant_id(request)
    res = await db.staff_warnings.update_one(
        {"id": warning_id, "merchant_id": mid},
        {"$set": {"resolved": True, "resolved_at": datetime.now(timezone.utc).isoformat()}},
    )
    if res.matched_count == 0:
        raise HTTPException(404, "Warnung nicht gefunden")
    return {"success": True}
