"""
BidBlitz Staff - Demo Mode / Sales Demo
========================================
Generates demo data isolated by demo_merchant_id flag.
Toggleable via env STAFF_DEMO_ENABLED.
"""
from fastapi import APIRouter, HTTPException, Request
from datetime import datetime, timedelta, timezone
from uuid import uuid4
import os, random
from motor.motor_asyncio import AsyncIOMotorClient

router = APIRouter(prefix="/api/staff/demo", tags=["staff-demo"])
client = AsyncIOMotorClient(os.getenv("MONGO_URL"))
db = client[os.getenv("DB_NAME", "bidblitz")]

DEMO_MERCHANT_ID = "demo-merchant-bidblitz"
DEMO_NAMES = [
    "Anna Müller", "Max Schmidt", "Lisa Bauer", "Tim Wagner", "Sarah Klein",
    "Tom Becker", "Julia Hoffmann", "David Fischer", "Lena Schulz", "Felix Weber",
]
DEMO_ROLES = ["Kellner", "Koch", "Barkeeper", "Aushilfe", "Schichtleiter"]


async def _is_enabled():
    return os.getenv("STAFF_DEMO_ENABLED", "true").lower() == "true"


def _is_demo_request(request: Request) -> bool:
    return request.headers.get("x-staff-demo") == "1" or request.query_params.get("demo") == "1"


@router.get("/status")
async def demo_status():
    enabled = await _is_enabled()
    count = await db.staff_members.count_documents({"merchant_id": DEMO_MERCHANT_ID})
    sub = await db.staff_subscriptions.find_one({"merchant_id": DEMO_MERCHANT_ID}, {"_id": 0})
    return {
        "success": True,
        "enabled": enabled,
        "demo_merchant_id": DEMO_MERCHANT_ID,
        "demo_members_count": count,
        "demo_subscription": sub,
    }


@router.post("/seed")
async def seed_demo(request: Request):
    """Seed demo merchant with realistic 30-day data (idempotent). Investor-grade."""
    if not await _is_enabled():
        raise HTTPException(403, "Demo mode disabled")
    from routes.auth import get_current_user as auth_user
    user = await auth_user(request)
    if user.get("role") not in ("admin", "merchant"):
        raise HTTPException(403, "Nur Admin oder Merchant")

    now = datetime.now(timezone.utc)

    # Subscription
    await db.staff_subscriptions.update_one(
        {"merchant_id": DEMO_MERCHANT_ID},
        {"$set": {
            "id": "demo-sub", "merchant_id": DEMO_MERCHANT_ID, "plan": "pro",
            "status": "active", "enabled": True,
            "current_period_start": now.isoformat(),
            "current_period_end": (now + timedelta(days=365)).isoformat(),
            "max_staff": 20, "features": ["all"],
            "is_demo": True, "updated_at": now.isoformat(),
        }},
        upsert=True,
    )

    # Locations
    await db.staff_locations.delete_many({"merchant_id": DEMO_MERCHANT_ID})
    locations = [
        {"id": str(uuid4()), "merchant_id": DEMO_MERCHANT_ID, "name": "Café Mitte", "address": "Berlin Mitte", "lat": 52.520, "lng": 13.405, "radius_m": 100, "active": True, "is_demo": True, "created_at": now.isoformat()},
        {"id": str(uuid4()), "merchant_id": DEMO_MERCHANT_ID, "name": "Café Prenzlauer Berg", "address": "Berlin P-Berg", "lat": 52.540, "lng": 13.430, "radius_m": 100, "active": True, "is_demo": True, "created_at": now.isoformat()},
    ]
    await db.staff_locations.insert_many(locations)

    # Members (with realistic patterns)
    await db.staff_members.delete_many({"merchant_id": DEMO_MERCHANT_ID})
    members = []
    archetypes = [
        ("Anna Müller",     "schichtleiter", 22.50, 14, "morning"),
        ("Max Schmidt",     "koch",          19.80, 8,  "morning"),
        ("Lisa Bauer",      "kellner",       15.00, 6,  "evening"),
        ("Tim Wagner",      "barkeeper",     17.20, 4,  "evening"),
        ("Sarah Klein",     "kellner",       14.50, 12, "morning"),
        ("Tom Becker",      "aushilfe",      12.50, 2,  "weekend"),
        ("Julia Hoffmann",  "schichtleiter", 23.00, 10, "evening"),
        ("David Fischer",   "koch",          20.00, 7,  "morning"),
        ("Lena Schulz",     "kellner",       15.50, 5,  "weekend"),
        ("Felix Weber",     "aushilfe",      13.00, 1,  "evening"),
    ]
    for i, (name, role, rate, vac_used, _pattern) in enumerate(archetypes):
        members.append({
            "id": str(uuid4()), "merchant_id": DEMO_MERCHANT_ID,
            "name": name, "email": f"demo{i+1}@bidblitz-demo.test",
            "role": "employee", "staff_role": role,
            "hourly_rate": rate, "vacation_days_yearly": 24, "vacation_days_used": vac_used,
            "active": True, "is_demo": True, "_pattern": _pattern,
            "created_at": (now - timedelta(days=180 - i*7)).isoformat(),
            "updated_at": now.isoformat(),
        })
    await db.staff_members.insert_many([{k: v for k, v in m.items() if not k.startswith("_")} for m in members])

    # Clock events — 30 days, realistic patterns
    await db.staff_clock_events.delete_many({"merchant_id": DEMO_MERCHANT_ID})
    events = []
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    for day_offset in range(30):
        day = today_start - timedelta(days=day_offset)
        weekday = day.weekday()  # 0=Mon, 6=Sun
        is_weekend = weekday >= 5
        # who works today?
        roster = []
        for m in members:
            p = m["_pattern"]
            if p == "weekend" and not is_weekend: continue
            if p == "morning" and is_weekend and random.random() < 0.4: continue
            roster.append(m)
        if not roster: continue
        for m in random.sample(roster, min(len(roster), random.randint(5, 8))):
            # determine shift window
            p = m["_pattern"]
            if p == "morning":  base_h = random.choice([7, 8, 9])
            elif p == "evening": base_h = random.choice([14, 15, 16])
            else: base_h = random.choice([10, 11, 12])
            start = day.replace(hour=base_h, minute=random.choice([0, 15, 30]))
            shift_hours = random.choice([6, 7, 8, 8, 8, 9, 10])  # weighted to 8h
            end = start + timedelta(hours=shift_hours)
            loc = random.choice(locations)
            # clock_in
            events.append({"id": str(uuid4()), "merchant_id": DEMO_MERCHANT_ID, "staff_id": m["id"],
                "action": "clock_in", "timestamp": start.isoformat(),
                "lat": loc["lat"] + random.uniform(-0.0008, 0.0008),
                "lng": loc["lng"] + random.uniform(-0.0008, 0.0008),
                "source": random.choice(["mobile", "qr", "terminal", "web"]),
                "device_type": "mobile", "is_demo": True, "created_at": start.isoformat()})
            # break (60-70% of the time)
            if random.random() < 0.65:
                br_start = start + timedelta(hours=random.uniform(3, 4.5))
                br_end = br_start + timedelta(minutes=random.choice([30, 45, 60]))
                events.append({"id": str(uuid4()), "merchant_id": DEMO_MERCHANT_ID, "staff_id": m["id"],
                    "action": "break_start", "timestamp": br_start.isoformat(),
                    "source": "mobile", "is_demo": True, "created_at": br_start.isoformat()})
                events.append({"id": str(uuid4()), "merchant_id": DEMO_MERCHANT_ID, "staff_id": m["id"],
                    "action": "break_end", "timestamp": br_end.isoformat(),
                    "source": "mobile", "is_demo": True, "created_at": br_end.isoformat()})
            # clock_out (skip on today for a few to keep "live working" status)
            if day_offset == 0 and random.random() < 0.4:
                pass  # leave open → currently working
            else:
                events.append({"id": str(uuid4()), "merchant_id": DEMO_MERCHANT_ID, "staff_id": m["id"],
                    "action": "clock_out", "timestamp": end.isoformat(),
                    "lat": loc["lat"], "lng": loc["lng"],
                    "source": random.choice(["mobile", "terminal"]),
                    "device_type": "mobile", "is_demo": True, "created_at": end.isoformat()})
    await db.staff_clock_events.insert_many(events)

    # Shifts (next 14 days)
    await db.staff_shifts.delete_many({"merchant_id": DEMO_MERCHANT_ID})
    shifts = []
    titles = [("Frühschicht", 7), ("Mittagsschicht", 11), ("Abendschicht", 16), ("Spätschicht", 18)]
    for day in range(14):
        d = today_start + timedelta(days=day)
        # 3-4 shifts per day across team
        for _ in range(random.randint(3, 5)):
            m = random.choice(members)
            title, base_h = random.choice(titles)
            start = d.replace(hour=base_h, minute=0)
            shifts.append({
                "id": str(uuid4()), "merchant_id": DEMO_MERCHANT_ID,
                "staff_id": m["id"], "title": title,
                "start_time": start.isoformat(),
                "end_time": (start + timedelta(hours=8)).isoformat(),
                "location": random.choice(locations)["name"],
                "status": "scheduled",
                "is_demo": True, "created_at": now.isoformat(),
            })
    await db.staff_shifts.insert_many(shifts)

    # Tasks (15 open + 35 done)
    await db.staff_tasks.delete_many({"merchant_id": DEMO_MERCHANT_ID})
    task_titles = [
        "Kassenabschluss prüfen", "Lieferschein scannen", "Hygiene-Check Küche",
        "Inventur Getränke", "Espresso-Maschine reinigen", "Toilettenkontrolle",
        "Müll rausbringen", "Tagesumsatz dokumentieren", "Wechselgeld holen",
        "Schicht-Übergabe Notizen", "Schaufenster wischen", "Kühlhaus-Temperatur",
    ]
    tasks = []
    for i in range(15):
        m = random.choice(members)
        due = now + timedelta(days=random.choice([-1, 0, 0, 1, 1, 2, 3, 5]))
        tasks.append({"id": str(uuid4()), "merchant_id": DEMO_MERCHANT_ID,
            "staff_id": m["id"], "title": random.choice(task_titles),
            "description": "Demo Aufgabe", "due_date": due.isoformat(),
            "status": "open", "is_demo": True,
            "created_at": (now - timedelta(hours=random.randint(1, 48))).isoformat(),
            "completed_at": None})
    for i in range(35):
        m = random.choice(members)
        created = now - timedelta(days=random.randint(1, 25))
        tasks.append({"id": str(uuid4()), "merchant_id": DEMO_MERCHANT_ID,
            "staff_id": m["id"], "title": random.choice(task_titles),
            "description": "Erledigt", "due_date": None,
            "status": "done", "is_demo": True,
            "created_at": created.isoformat(),
            "completed_at": (created + timedelta(hours=random.randint(1, 24))).isoformat()})
    await db.staff_tasks.insert_many(tasks)

    # Wallet bonus events (50 entries)
    await db.staff_bonus_events.delete_many({"merchant_id": DEMO_MERCHANT_ID})
    bonus_events = []
    reasons_bonus = ["Monatsbonus", "Top-Performer", "Verkaufsziel", "Geburtstagsbonus"]
    reasons_tip   = ["Trinkgeld Pool Wochenende", "Trinkgeld Pool Werktag", "Direkt-Tip"]
    for _ in range(50):
        m = random.choice(members)
        kind = random.choice(["bonus", "tip", "tip", "tip"])
        amount = round(random.uniform(5, 80), 2) if kind == "tip" else round(random.uniform(20, 250), 2)
        days_ago = random.randint(0, 28)
        ts = (now - timedelta(days=days_ago, hours=random.randint(0, 23))).isoformat()
        bonus_events.append({
            "id": str(uuid4()), "merchant_id": DEMO_MERCHANT_ID, "staff_id": m["id"],
            "type": kind, "kind": kind,
            "amount_eur": amount, "amount": amount,
            "reason": random.choice(reasons_tip if kind == "tip" else reasons_bonus),
            "wallet_paid": True, "is_demo": True,
            "created_at": ts,
        })
    await db.staff_bonus_events.insert_many(bonus_events)

    # Notifications (10)
    await db.staff_notifications.delete_many({"merchant_id": DEMO_MERCHANT_ID})
    notif_templates = [
        ("shift_assigned", "Neue Schicht für dich", "Morgen 09:00 Frühschicht im Café Mitte"),
        ("task_assigned", "Neue Aufgabe", "Kassenabschluss prüfen — heute 18:00"),
        ("bonus_received", "🎉 Bonus erhalten", "Monatsbonus 150€ wurde gutgeschrieben"),
        ("warning_overtime", "Überstunden-Hinweis", "Du hast diese Woche 48h gearbeitet"),
        ("leave_approved", "Urlaub genehmigt", "Dein Urlaub 15.-22.06. wurde bestätigt"),
    ]
    for i in range(10):
        m = random.choice(members)
        kind, title, body = random.choice(notif_templates)
        await db.staff_notifications.insert_one({
            "id": str(uuid4()), "merchant_id": DEMO_MERCHANT_ID, "staff_id": m["id"],
            "type": kind, "title": title, "body": body,
            "read": random.random() < 0.4, "is_demo": True,
            "created_at": (now - timedelta(hours=random.randint(0, 96))).isoformat(),
        })

    # Warnings
    await db.staff_warnings.delete_many({"merchant_id": DEMO_MERCHANT_ID})
    warnings = [
        {"id": str(uuid4()), "merchant_id": DEMO_MERCHANT_ID, "staff_id": members[0]["id"], "type": "overtime", "severity": "medium", "message": f"{members[0]['name']} hat 11.2h gearbeitet", "resolved": False, "is_demo": True, "created_at": now.isoformat()},
        {"id": str(uuid4()), "merchant_id": DEMO_MERCHANT_ID, "staff_id": members[1]["id"], "type": "missing_break", "severity": "medium", "message": f"{members[1]['name']} hat keine Pause genommen", "resolved": False, "is_demo": True, "created_at": now.isoformat()},
        {"id": str(uuid4()), "merchant_id": DEMO_MERCHANT_ID, "staff_id": members[2]["id"], "type": "gps_out_of_range", "severity": "warning", "message": f"{members[2]['name']} Check-in 350m außerhalb", "resolved": False, "is_demo": True, "created_at": now.isoformat()},
        {"id": str(uuid4()), "merchant_id": DEMO_MERCHANT_ID, "staff_id": members[3]["id"], "type": "late_arrival", "severity": "low", "message": f"{members[3]['name']} 12 Min. zu spät", "resolved": False, "is_demo": True, "created_at": (now - timedelta(hours=8)).isoformat()},
    ]
    await db.staff_warnings.insert_many(warnings)

    return {
        "success": True,
        "merchant_id": DEMO_MERCHANT_ID,
        "members": len(members),
        "events": len(events),
        "shifts": len(shifts),
        "tasks": len(tasks),
        "bonus_events": len(bonus_events),
        "warnings": len(warnings),
        "locations": len(locations),
        "notifications": 10,
    }


@router.delete("/clear")
async def clear_demo(request: Request):
    from routes.auth import get_current_user as auth_user
    user = await auth_user(request)
    if user.get("role") != "admin":
        raise HTTPException(403, "Nur Admin")
    for coll in ["staff_members", "staff_clock_events", "staff_shifts", "staff_warnings",
                 "staff_subscriptions", "staff_locations", "staff_notifications",
                 "staff_invites", "staff_magic_tokens"]:
        await db[coll].delete_many({"merchant_id": DEMO_MERCHANT_ID})
    return {"success": True, "cleared": True}


@router.get("/dashboard")
async def demo_dashboard():
    """Public read-only demo data for /merchant/staff/demo landing."""
    if not await _is_enabled():
        raise HTTPException(403, "Demo mode disabled")
    members = await db.staff_members.find({"merchant_id": DEMO_MERCHANT_ID, "active": True}, {"_id": 0, "pin_hash": 0, "password_hash": 0}).to_list(length=50)
    shifts = await db.staff_shifts.find({"merchant_id": DEMO_MERCHANT_ID}, {"_id": 0}).sort("start_time", 1).to_list(length=30)
    warnings = await db.staff_warnings.find({"merchant_id": DEMO_MERCHANT_ID, "resolved": False}, {"_id": 0}).to_list(length=20)
    locs = await db.staff_locations.find({"merchant_id": DEMO_MERCHANT_ID}, {"_id": 0}).to_list(length=20)
    return {
        "success": True,
        "is_demo": True,
        "kpis": {
            "active_staff": len(members),
            "shifts_upcoming": len([s for s in shifts if s["start_time"] > datetime.now(timezone.utc).isoformat()]),
            "open_warnings": len(warnings),
            "locations": len(locs),
            "monthly_cost_estimate_eur": 4280.0,
        },
        "members_preview": members[:8],
        "next_shifts": shifts[:8],
        "warnings": warnings[:5],
        "locations": locs,
    }
