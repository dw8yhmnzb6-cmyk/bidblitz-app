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
    """Seed demo merchant with realistic data (idempotent)."""
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
            "max_staff": 20,
            "features": ["all"],
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

    # Members
    await db.staff_members.delete_many({"merchant_id": DEMO_MERCHANT_ID})
    members = []
    for i, name in enumerate(DEMO_NAMES):
        members.append({
            "id": str(uuid4()), "merchant_id": DEMO_MERCHANT_ID,
            "name": name, "email": f"demo{i+1}@bidblitz-demo.test",
            "role": "employee", "staff_role": DEMO_ROLES[i % len(DEMO_ROLES)].lower().replace(" ", "_"),
            "hourly_rate": round(random.uniform(12, 22), 2),
            "vacation_days_yearly": 24,
            "vacation_days_used": random.randint(0, 12),
            "active": True, "is_demo": True,
            "created_at": now.isoformat(), "updated_at": now.isoformat(),
        })
    await db.staff_members.insert_many(members)

    # Clock events (last 14 days)
    await db.staff_clock_events.delete_many({"merchant_id": DEMO_MERCHANT_ID})
    events = []
    for day in range(14):
        d = now - timedelta(days=day)
        for m in random.sample(members, 7):
            start = d.replace(hour=random.randint(8, 11), minute=random.choice([0, 15, 30]), second=0, microsecond=0)
            end = start + timedelta(hours=random.randint(6, 9))
            for action, t in [("clock_in", start), ("clock_out", end)]:
                events.append({
                    "id": str(uuid4()), "merchant_id": DEMO_MERCHANT_ID,
                    "staff_id": m["id"], "action": action,
                    "timestamp": t.isoformat(),
                    "lat": locations[0]["lat"] + random.uniform(-0.001, 0.001),
                    "lng": locations[0]["lng"] + random.uniform(-0.001, 0.001),
                    "source": random.choice(["mobile", "qr", "web"]),
                    "device_type": "mobile",
                    "is_demo": True,
                    "created_at": t.isoformat(),
                })
    await db.staff_clock_events.insert_many(events)

    # Shifts (next 7 days)
    await db.staff_shifts.delete_many({"merchant_id": DEMO_MERCHANT_ID})
    shifts = []
    for day in range(7):
        d = now + timedelta(days=day)
        for m in random.sample(members, 4):
            start = d.replace(hour=random.choice([9, 14, 17]), minute=0, second=0, microsecond=0)
            shifts.append({
                "id": str(uuid4()), "merchant_id": DEMO_MERCHANT_ID,
                "staff_id": m["id"], "title": random.choice(["Frühschicht", "Mittagsschicht", "Abendschicht"]),
                "start_time": start.isoformat(),
                "end_time": (start + timedelta(hours=8)).isoformat(),
                "location": random.choice(locations)["name"],
                "is_demo": True, "created_at": now.isoformat(),
            })
    await db.staff_shifts.insert_many(shifts)

    # Warnings
    await db.staff_warnings.delete_many({"merchant_id": DEMO_MERCHANT_ID})
    warnings = [
        {"id": str(uuid4()), "merchant_id": DEMO_MERCHANT_ID, "staff_id": members[0]["id"], "type": "overtime", "severity": "medium", "message": f"{members[0]['name']} hat 11.2h gearbeitet", "resolved": False, "is_demo": True, "created_at": now.isoformat()},
        {"id": str(uuid4()), "merchant_id": DEMO_MERCHANT_ID, "staff_id": members[1]["id"], "type": "missing_break", "severity": "medium", "message": f"{members[1]['name']} hat keine Pause genommen", "resolved": False, "is_demo": True, "created_at": now.isoformat()},
        {"id": str(uuid4()), "merchant_id": DEMO_MERCHANT_ID, "staff_id": members[2]["id"], "type": "gps_out_of_range", "severity": "warning", "message": f"{members[2]['name']} Check-in 350m außerhalb", "resolved": False, "is_demo": True, "created_at": now.isoformat()},
    ]
    await db.staff_warnings.insert_many(warnings)

    return {
        "success": True,
        "merchant_id": DEMO_MERCHANT_ID,
        "members": len(members),
        "events": len(events),
        "shifts": len(shifts),
        "warnings": len(warnings),
        "locations": len(locations),
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
