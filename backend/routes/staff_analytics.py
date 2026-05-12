"""
BidBlitz Staff - Cost Estimation & Analytics
=============================================
Monthly costs, per-location, per-employee, overtime cost.
+ Chart data for /merchant/staff/analytics + Heatmap + Admin Global.
"""
from fastapi import APIRouter, HTTPException, Request
from datetime import datetime, timedelta, timezone
from collections import defaultdict
import os
from motor.motor_asyncio import AsyncIOMotorClient

router = APIRouter(prefix="/api/staff", tags=["staff-analytics-costs"])
client = AsyncIOMotorClient(os.getenv("MONGO_URL"))
db = client[os.getenv("DB_NAME", "bidblitz")]

REGULAR_HOURS_PER_WEEK = 40
OVERTIME_FACTOR = 1.25  # +25 % surcharge


async def _merchant_id(request: Request) -> str:
    from routes.auth import get_current_user as auth_user
    user = await auth_user(request)
    if user.get("role") not in ("merchant", "admin"):
        raise HTTPException(403, "Nur für Händler oder Administratoren")
    return str(user.get("user_id") or user.get("id"))


async def _require_admin(request: Request):
    from routes.auth import get_current_user as auth_user
    user = await auth_user(request)
    if user.get("role") != "admin":
        raise HTTPException(403, "Nur für Administratoren")
    return user


async def _aggregate_minutes(merchant_id: str, start: datetime, end: datetime):
    """Returns (minutes_by_staff, members_map, events_count)."""
    events = await db.staff_clock_events.find(
        {"merchant_id": merchant_id, "timestamp": {"$gte": start.isoformat(), "$lt": end.isoformat()}},
        {"_id": 0, "staff_id": 1, "action": 1, "timestamp": 1, "lat": 1, "lng": 1},
    ).sort("timestamp", 1).to_list(length=10000)
    members = await db.staff_members.find({"merchant_id": merchant_id}, {"_id": 0}).to_list(length=500)
    minutes: dict = defaultdict(int)
    last_in: dict = {}
    for ev in events:
        sid = ev["staff_id"]
        t = datetime.fromisoformat(ev["timestamp"].replace("Z", "+00:00"))
        if ev["action"] == "clock_in":
            last_in[sid] = t
        elif ev["action"] == "clock_out" and sid in last_in:
            minutes[sid] += int((t - last_in[sid]).total_seconds() / 60)
            last_in.pop(sid, None)
    return minutes, {m["id"]: m for m in members}, len(events)


# ───────────────────────────────────────────────────────────────────────
# COSTS
# ───────────────────────────────────────────────────────────────────────
@router.get("/costs/summary")
async def cost_summary(request: Request, days: int = 30):
    mid = await _merchant_id(request)
    now = datetime.now(timezone.utc)
    start = now - timedelta(days=days)
    minutes, members, _ = await _aggregate_minutes(mid, start, now)

    per_employee = []
    regular_minutes_window = REGULAR_HOURS_PER_WEEK * 60 * (days / 7.0)
    total_regular = 0.0
    total_overtime = 0.0
    for sid, mins in minutes.items():
        member = members.get(sid)
        if not member:
            continue
        rate = float(member.get("hourly_rate") or 0)
        regular = min(mins, regular_minutes_window)
        overtime = max(0, mins - regular_minutes_window)
        cost_regular = (regular / 60.0) * rate
        cost_overtime = (overtime / 60.0) * rate * OVERTIME_FACTOR
        total = cost_regular + cost_overtime
        per_employee.append({
            "staff_id": sid,
            "name": member.get("name"),
            "hours": round(mins / 60.0, 2),
            "regular_hours": round(regular / 60.0, 2),
            "overtime_hours": round(overtime / 60.0, 2),
            "hourly_rate": rate,
            "cost_regular_eur": round(cost_regular, 2),
            "cost_overtime_eur": round(cost_overtime, 2),
            "total_eur": round(total, 2),
        })
        total_regular += cost_regular
        total_overtime += cost_overtime

    return {
        "success": True,
        "period_days": days,
        "total_cost_eur": round(total_regular + total_overtime, 2),
        "total_regular_eur": round(total_regular, 2),
        "total_overtime_eur": round(total_overtime, 2),
        "per_employee": sorted(per_employee, key=lambda x: x["total_eur"], reverse=True),
    }


@router.get("/costs/by-location")
async def cost_by_location(request: Request, days: int = 30):
    mid = await _merchant_id(request)
    now = datetime.now(timezone.utc)
    start = now - timedelta(days=days)
    events = await db.staff_clock_events.find(
        {"merchant_id": mid, "timestamp": {"$gte": start.isoformat()}, "lat": {"$ne": None}},
        {"_id": 0},
    ).to_list(length=10000)
    locations = await db.staff_locations.find({"merchant_id": mid}, {"_id": 0}).to_list(length=100)
    members = await db.staff_members.find({"merchant_id": mid}, {"_id": 0}).to_list(length=500)
    member_map = {m["id"]: m for m in members}

    if not locations:
        return {"success": True, "rows": []}

    from routes.staff_locations import _haversine_m
    # Pair clock_in→clock_out, attribute total minutes to nearest location of clock_in
    by_staff: dict = defaultdict(list)
    for ev in events:
        by_staff[ev["staff_id"]].append(ev)
    rows: dict = {l["id"]: {"location_id": l["id"], "name": l["name"], "hours": 0.0, "cost_eur": 0.0} for l in locations}
    for sid, evs in by_staff.items():
        evs.sort(key=lambda e: e["timestamp"])
        rate = float(member_map.get(sid, {}).get("hourly_rate") or 0)
        last_in = None
        last_loc = None
        for ev in evs:
            t = datetime.fromisoformat(ev["timestamp"].replace("Z", "+00:00"))
            if ev["action"] == "clock_in":
                last_in = t
                closest = min(locations, key=lambda l: _haversine_m(ev["lat"], ev["lng"], l["lat"], l["lng"]))
                last_loc = closest["id"]
            elif ev["action"] == "clock_out" and last_in and last_loc:
                mins = (t - last_in).total_seconds() / 60.0
                h = mins / 60.0
                rows[last_loc]["hours"] = round(rows[last_loc]["hours"] + h, 2)
                rows[last_loc]["cost_eur"] = round(rows[last_loc]["cost_eur"] + h * rate, 2)
                last_in = None; last_loc = None

    return {"success": True, "period_days": days, "rows": list(rows.values())}


# ───────────────────────────────────────────────────────────────────────
# ANALYTICS (Charts)
# ───────────────────────────────────────────────────────────────────────
@router.get("/analytics/hours-by-day")
async def hours_by_day(request: Request, days: int = 14):
    mid = await _merchant_id(request)
    now = datetime.now(timezone.utc)
    start = (now - timedelta(days=days)).replace(hour=0, minute=0, second=0, microsecond=0)
    minutes, _, _ = await _aggregate_minutes(mid, start, now)  # total only

    # Per-day aggregation: re-fetch events for daily buckets
    events = await db.staff_clock_events.find(
        {"merchant_id": mid, "timestamp": {"$gte": start.isoformat()}},
        {"_id": 0, "staff_id": 1, "action": 1, "timestamp": 1},
    ).sort("timestamp", 1).to_list(length=10000)
    buckets: dict = defaultdict(float)
    last_in: dict = {}
    for ev in events:
        sid = ev["staff_id"]
        t = datetime.fromisoformat(ev["timestamp"].replace("Z", "+00:00"))
        if ev["action"] == "clock_in":
            last_in[sid] = t
        elif ev["action"] == "clock_out" and sid in last_in:
            day = t.date().isoformat()
            buckets[day] += (t - last_in[sid]).total_seconds() / 3600.0
            last_in.pop(sid, None)

    rows = []
    for i in range(days):
        d = (now - timedelta(days=days - 1 - i)).date().isoformat()
        rows.append({"date": d, "hours": round(buckets.get(d, 0.0), 2)})
    return {"success": True, "rows": rows, "period_days": days}


@router.get("/analytics/attendance")
async def attendance(request: Request, days: int = 14):
    mid = await _merchant_id(request)
    now = datetime.now(timezone.utc)
    start = (now - timedelta(days=days)).replace(hour=0, minute=0, second=0, microsecond=0)
    members_count = await db.staff_members.count_documents({"merchant_id": mid, "active": True})

    events = await db.staff_clock_events.find(
        {"merchant_id": mid, "action": "clock_in", "timestamp": {"$gte": start.isoformat()}},
        {"_id": 0, "staff_id": 1, "timestamp": 1},
    ).to_list(length=10000)
    by_day: dict = defaultdict(set)
    for ev in events:
        d = ev["timestamp"][:10]
        by_day[d].add(ev["staff_id"])

    rows = []
    for i in range(days):
        d = (now - timedelta(days=days - 1 - i)).date().isoformat()
        present = len(by_day.get(d, set()))
        rows.append({
            "date": d,
            "present": present,
            "absent": max(0, members_count - present),
            "rate_pct": round((present / members_count * 100) if members_count else 0, 1),
        })
    return {"success": True, "rows": rows, "total_active_staff": members_count}


@router.get("/analytics/absence")
async def absence(request: Request, days: int = 30):
    mid = await _merchant_id(request)
    now = datetime.now(timezone.utc)
    start = now - timedelta(days=days)
    reqs = await db.staff_leave_requests.find(
        {"merchant_id": mid, "start_date": {"$gte": start.date().isoformat()}},
        {"_id": 0},
    ).to_list(length=500)
    by_type: dict = defaultdict(int)
    by_status: dict = defaultdict(int)
    for r in reqs:
        by_type[r.get("type", "other")] += 1
        by_status[r.get("status", "pending")] += 1
    return {
        "success": True,
        "by_type": [{"type": k, "count": v} for k, v in by_type.items()],
        "by_status": [{"status": k, "count": v} for k, v in by_status.items()],
        "total": len(reqs),
    }


@router.get("/analytics/heatmap")
async def heatmap(request: Request, days: int = 30):
    """Weekday × Hour grid of clock_in counts."""
    mid = await _merchant_id(request)
    now = datetime.now(timezone.utc)
    start = now - timedelta(days=days)
    events = await db.staff_clock_events.find(
        {"merchant_id": mid, "action": "clock_in", "timestamp": {"$gte": start.isoformat()}},
        {"_id": 0, "timestamp": 1},
    ).to_list(length=10000)
    grid: dict = defaultdict(int)
    for ev in events:
        t = datetime.fromisoformat(ev["timestamp"].replace("Z", "+00:00"))
        grid[(t.weekday(), t.hour)] += 1
    rows = []
    for d in range(7):
        for h in range(24):
            rows.append({"weekday": d, "hour": h, "value": grid.get((d, h), 0)})
    return {"success": True, "grid": rows, "period_days": days}


@router.get("/analytics/by-location")
async def analytics_by_location(request: Request, days: int = 30):
    return await cost_by_location(request, days)


# ───────────────────────────────────────────────────────────────────────
# ADMIN GLOBAL ANALYTICS
# ───────────────────────────────────────────────────────────────────────
@router.get("/analytics/admin/global")
async def admin_global(request: Request):
    await _require_admin(request)
    now = datetime.now(timezone.utc)
    today_start = datetime(now.year, now.month, now.day, tzinfo=timezone.utc)
    week_start = now - timedelta(days=7)

    subs = await db.staff_subscriptions.find({}, {"_id": 0}).to_list(length=5000)
    active_merchants = len({s["merchant_id"] for s in subs if s.get("status") in ("trialing", "active")})
    trials = len([s for s in subs if s.get("status") == "trialing"])
    active_subs = len([s for s in subs if s.get("status") == "active"])
    cancelled = len([s for s in subs if s.get("status") == "cancelled"])

    active_staff_total = await db.staff_members.count_documents({"active": True})
    checkins_today = await db.staff_clock_events.count_documents({"action": "clock_in", "timestamp": {"$gte": today_start.isoformat()}})
    checkins_week = await db.staff_clock_events.count_documents({"action": "clock_in", "timestamp": {"$gte": week_start.isoformat()}})

    avg_staff = round(active_staff_total / max(1, active_merchants), 1) if active_merchants else 0
    conversion = round((active_subs / max(1, active_subs + cancelled + trials)) * 100, 1)

    prices = {"basic": 4.99, "pro": 9.99, "enterprise": 0}
    mrr = round(sum(prices.get(s.get("plan"), 0) for s in subs if s.get("status") == "active"), 2)

    return {
        "success": True,
        "active_merchants": active_merchants,
        "trials": trials,
        "active_subs": active_subs,
        "cancelled": cancelled,
        "active_staff_total": active_staff_total,
        "avg_staff_per_merchant": avg_staff,
        "checkins_today": checkins_today,
        "checkins_week": checkins_week,
        "trial_conversion_pct_placeholder": conversion,
        "mrr_eur_placeholder": mrr,
    }
