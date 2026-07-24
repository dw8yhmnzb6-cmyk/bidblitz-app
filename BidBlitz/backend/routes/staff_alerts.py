"""
BidBlitz Staff - Smart Alert Engine
====================================
Live Alerts (delegiert auf staff_warnings + ergänzt Real-Time Checks).
"""
from fastapi import APIRouter, HTTPException, Request
from datetime import datetime, timedelta, timezone
import os
from motor.motor_asyncio import AsyncIOMotorClient

router = APIRouter(prefix="/api/staff/alerts", tags=["staff-alerts"])
client = AsyncIOMotorClient(os.getenv("MONGO_URL"))
db = client[os.getenv("DB_NAME", "bidblitz")]


async def _merchant_id(request: Request) -> str:
    from routes.auth import get_current_user as auth_user
    user = await auth_user(request)
    if user.get("role") not in ("merchant", "admin"):
        raise HTTPException(403, "Nur für Händler oder Administratoren")
    return str(user.get("user_id") or user.get("id"))


@router.post("/scan")
async def run_alert_scan(request: Request):
    """Vollständiger Scan (delegiert an warnings.scan_for_warnings)."""
    mid = await _merchant_id(request)
    from routes.staff_warnings import scan_for_warnings
    return await scan_for_warnings(mid)


@router.get("/live")
async def live_alerts(request: Request):
    """Sofort-Check ohne in DB zu schreiben — für Dashboard-Tile."""
    mid = await _merchant_id(request)
    now = datetime.now(timezone.utc)
    today_start = datetime(now.year, now.month, now.day, tzinfo=timezone.utc)

    # Open clock-ins (ohne check-out)
    events = await db.staff_clock_events.find(
        {"merchant_id": mid, "timestamp": {"$gte": today_start.isoformat()}},
        {"_id": 0},
    ).sort("timestamp", 1).to_list(length=500)

    open_sessions: dict = {}
    for ev in events:
        sid = ev["staff_id"]
        if ev["action"] == "clock_in":
            open_sessions[sid] = ev["timestamp"]
        elif ev["action"] == "clock_out":
            open_sessions.pop(sid, None)

    long_sessions = []
    for sid, t in open_sessions.items():
        try:
            tin = datetime.fromisoformat(t.replace("Z", "+00:00"))
            hours = (now - tin).total_seconds() / 3600
            if hours > 8:
                long_sessions.append({"staff_id": sid, "hours": round(hours, 1)})
        except Exception:
            pass

    # Shifts running but no check-in
    running_shifts = await db.staff_shifts.find(
        {"merchant_id": mid, "start_time": {"$lte": now.isoformat()}, "end_time": {"$gte": now.isoformat()}},
        {"_id": 0},
    ).to_list(length=100)
    no_show = []
    for sh in running_shifts:
        sid = sh.get("staff_id")
        if sid and sid not in open_sessions:
            no_show.append({"shift_id": sh["id"], "staff_id": sid, "started_at": sh["start_time"]})

    open_warns = await db.staff_warnings.count_documents({"merchant_id": mid, "resolved": False})

    severity = "ok"
    if no_show or long_sessions:
        severity = "high"
    elif open_warns > 0:
        severity = "medium"

    return {
        "success": True,
        "severity": severity,
        "open_sessions": len(open_sessions),
        "long_running_sessions": long_sessions,
        "shifts_no_show": no_show,
        "open_warnings_count": open_warns,
    }


@router.get("/list")
async def list_alerts(request: Request):
    """Vereinheitlichte Liste der offenen Warnungen (alias auf warnings/list)."""
    mid = await _merchant_id(request)
    items = await db.staff_warnings.find({"merchant_id": mid, "resolved": False}, {"_id": 0}).sort("created_at", -1).to_list(length=200)
    return {"success": True, "alerts": items, "count": len(items)}
