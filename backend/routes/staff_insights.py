"""
BidBlitz Staff - AI Insights (Rule-based)
==========================================
- Häufig verspätete Mitarbeiter
- Hohe Überstunden (Trends)
- Fehlende Check-outs
- Schwache Schichtabdeckung
- Auffällige Muster
- Produktivitäts-Trends
"""
from fastapi import APIRouter, HTTPException, Request
from datetime import datetime, timedelta, timezone
import os
from collections import Counter, defaultdict
from motor.motor_asyncio import AsyncIOMotorClient

router = APIRouter(prefix="/api/staff/insights", tags=["staff-insights"])
client = AsyncIOMotorClient(os.getenv("MONGO_URL"))
db = client[os.getenv("DB_NAME", "bidblitz")]


async def _merchant_id(request: Request) -> str:
    from routes.auth import get_current_user as auth_user
    user = await auth_user(request)
    if user.get("role") not in ("merchant", "admin"):
        raise HTTPException(403, "Nur für Händler oder Administratoren")
    return str(user.get("user_id") or user.get("id"))


async def _hours_in_range(merchant_id: str, start: datetime, end: datetime):
    events = await db.staff_clock_events.find(
        {"merchant_id": merchant_id, "timestamp": {"$gte": start.isoformat(), "$lt": end.isoformat()}},
        {"_id": 0, "staff_id": 1, "action": 1, "timestamp": 1},
    ).sort("timestamp", 1).to_list(length=5000)
    by_staff: dict = defaultdict(int)
    last_in = {}
    for ev in events:
        sid = ev["staff_id"]
        t = datetime.fromisoformat(ev["timestamp"].replace("Z", "+00:00"))
        if ev["action"] == "clock_in":
            last_in[sid] = t
        elif ev["action"] == "clock_out" and sid in last_in:
            by_staff[sid] += int((t - last_in[sid]).total_seconds() / 60)
            last_in.pop(sid, None)
    return by_staff  # minutes per staff


@router.get("/dashboard")
async def insights_dashboard(request: Request):
    """All actionable insights as cards."""
    mid = await _merchant_id(request)
    now = datetime.now(timezone.utc)

    members = await db.staff_members.find({"merchant_id": mid, "active": True}, {"_id": 0}).to_list(length=300)
    name_map = {m["id"]: m["name"] for m in members}

    # Window: last 30 days
    window_start = now - timedelta(days=30)
    week_start = (now - timedelta(days=now.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)
    prev_week_start = week_start - timedelta(days=7)

    insights = []

    # 1) Frequently late (≥3 shifts started but clock_in within 10 min late or after)
    shifts = await db.staff_shifts.find(
        {"merchant_id": mid, "start_time": {"$gte": window_start.isoformat()}},
        {"_id": 0},
    ).to_list(length=1000)
    events = await db.staff_clock_events.find(
        {"merchant_id": mid, "timestamp": {"$gte": window_start.isoformat()}, "action": "clock_in"},
        {"_id": 0},
    ).to_list(length=5000)
    events_by_staff: dict = defaultdict(list)
    for ev in events:
        events_by_staff[ev["staff_id"]].append(datetime.fromisoformat(ev["timestamp"].replace("Z", "+00:00")))
    for evs in events_by_staff.values():
        evs.sort()

    late_count: Counter = Counter()
    for sh in shifts:
        sid = sh.get("staff_id")
        try:
            st = datetime.fromisoformat(sh["start_time"].replace("Z", "+00:00"))
        except Exception:
            continue
        ins = events_by_staff.get(sid, [])
        nearest = min((abs((t - st).total_seconds()), t) for t in ins) if ins else None
        if not nearest:
            continue
        diff_sec, t_actual = nearest
        if t_actual > st and diff_sec > 600:  # >10 min late
            late_count[sid] += 1

    freq_late = [(sid, c) for sid, c in late_count.items() if c >= 3]
    if freq_late:
        insights.append({
            "id": "frequent_late",
            "severity": "warning",
            "title": f"Achtung: {len(freq_late)} Mitarbeiter häufig verspätet",
            "body": ", ".join([f"{name_map.get(sid,'?')} ({c}x)" for sid, c in freq_late[:5]]),
            "value": len(freq_late),
            "details": [{"staff_id": s, "name": name_map.get(s), "late_count": c} for s, c in freq_late],
        })

    # 2) Overtime trend: this week vs previous week
    cur_minutes = await _hours_in_range(mid, week_start, now)
    prev_minutes = await _hours_in_range(mid, prev_week_start, week_start)
    cur_total = sum(cur_minutes.values()) / 60.0
    prev_total = sum(prev_minutes.values()) / 60.0
    if prev_total > 0:
        delta_pct = round((cur_total - prev_total) / prev_total * 100, 1)
        if delta_pct >= 10:
            insights.append({
                "id": "overtime_trend",
                "severity": "info",
                "title": f"Überstunden diese Woche +{delta_pct}%",
                "body": f"{cur_total:.1f}h vs {prev_total:.1f}h Vorwoche",
                "value": delta_pct,
            })

    # 3) High individual overtime (>50h/week)
    high_ot = [(sid, m / 60.0) for sid, m in cur_minutes.items() if m / 60.0 > 50]
    if high_ot:
        insights.append({
            "id": "high_overtime_individuals",
            "severity": "warning",
            "title": f"Hohe Überstunden bei {len(high_ot)} Mitarbeiter(n)",
            "body": ", ".join([f"{name_map.get(s,'?')}: {h:.1f}h" for s, h in high_ot[:5]]),
            "details": [{"staff_id": s, "name": name_map.get(s), "hours": round(h, 1)} for s, h in high_ot],
        })

    # 4) Missing clock-outs (last 7 days)
    week_ago = now - timedelta(days=7)
    ins_count = await db.staff_clock_events.count_documents(
        {"merchant_id": mid, "action": "clock_in", "timestamp": {"$gte": week_ago.isoformat()}}
    )
    out_count = await db.staff_clock_events.count_documents(
        {"merchant_id": mid, "action": "clock_out", "timestamp": {"$gte": week_ago.isoformat()}}
    )
    missing = ins_count - out_count
    if missing > 2:
        insights.append({
            "id": "missing_checkouts",
            "severity": "warning",
            "title": f"Fehlende Check-outs: {missing}",
            "body": f"{missing} Check-ins ohne passendes Check-out in den letzten 7 Tagen",
            "value": missing,
        })

    # 5) Weak shift coverage: identify weekday+hour windows with <1 person on average
    coverage: dict = defaultdict(int)
    coverage_days: dict = defaultdict(set)
    for sh in shifts:
        try:
            st = datetime.fromisoformat(sh["start_time"].replace("Z", "+00:00"))
            et = datetime.fromisoformat(sh["end_time"].replace("Z", "+00:00"))
        except Exception:
            continue
        d = st.weekday()
        for hour in range(st.hour, min(et.hour + 1, 24)):
            coverage[(d, hour)] += 1
            coverage_days[(d, hour)].add(st.date())

    weak_slots = []
    weekdays = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"]
    for (d, h), cnt in coverage.items():
        days_count = max(1, len(coverage_days[(d, h)]))
        avg = cnt / days_count
        if h >= 17 and avg < 2 and days_count >= 2:
            weak_slots.append({"weekday": weekdays[d], "hour": h, "avg_staff": round(avg, 1)})
    weak_slots = sorted(weak_slots, key=lambda x: x["avg_staff"])[:3]
    if weak_slots:
        ws = weak_slots[0]
        insights.append({
            "id": "weak_coverage",
            "severity": "warning",
            "title": f"{ws['weekday']} Abend unterbesetzt",
            "body": f"Nur {ws['avg_staff']} Person(en) durchschnittlich um {ws['hour']}:00 Uhr",
            "details": weak_slots,
        })

    # 6) Productivity trend (hours/active employee, last 4 weeks)
    weekly_trend = []
    for i in range(4):
        ws_ = week_start - timedelta(days=7 * i)
        we_ = ws_ + timedelta(days=7)
        wm = await _hours_in_range(mid, ws_, we_)
        weekly_trend.append({
            "week_start": ws_.date().isoformat(),
            "total_hours": round(sum(wm.values()) / 60.0, 1),
            "active_staff": len(wm),
        })
    weekly_trend.reverse()

    return {
        "success": True,
        "generated_at": now.isoformat(),
        "insights": insights,
        "productivity_trend_4w": weekly_trend,
        "summary": {
            "total_active_staff": len(members),
            "this_week_hours": round(cur_total, 1),
            "prev_week_hours": round(prev_total, 1),
        },
    }
