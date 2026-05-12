"""
BidBlitz Staff - Admin SaaS Metrics
====================================
"""
from fastapi import APIRouter, HTTPException, Request
from datetime import datetime, timedelta, timezone
import os
from motor.motor_asyncio import AsyncIOMotorClient

router = APIRouter(prefix="/api/staff/metrics", tags=["staff-metrics"])
client = AsyncIOMotorClient(os.getenv("MONGO_URL"))
db = client[os.getenv("DB_NAME", "bidblitz")]

# Same plan prices as staff_subscription.STAFF_PLANS
PLAN_PRICES = {"basic": 4.99, "pro": 9.99, "enterprise": 0}


async def _require_admin(request: Request):
    from routes.auth import get_current_user as auth_user
    user = await auth_user(request)
    if user.get("role") != "admin":
        raise HTTPException(403, "Nur für Administratoren")
    return user


@router.get("/overview")
async def saas_overview(request: Request):
    await _require_admin(request)
    subs = await db.staff_subscriptions.find({}, {"_id": 0}).to_list(length=2000)

    trials = [s for s in subs if s.get("status") == "trialing"]
    active = [s for s in subs if s.get("status") == "active"]
    expired = [s for s in subs if s.get("status") == "expired"]
    cancelled = [s for s in subs if s.get("status") == "cancelled"]

    mrr = 0.0
    for s in active:
        mrr += PLAN_PRICES.get(s.get("plan"), 0)

    # Avg staff per merchant
    merchants = list({s["merchant_id"] for s in subs})
    avg_staff = 0
    if merchants:
        counts = []
        for mid in merchants:
            counts.append(await db.staff_members.count_documents({"merchant_id": mid, "active": True}))
        avg_staff = round(sum(counts) / len(counts), 1) if counts else 0

    # Churn risk: active merchants with <2 staff or 0 clock events in last 14 days
    now = datetime.now(timezone.utc)
    cutoff = (now - timedelta(days=14)).isoformat()
    churn_at_risk: list = []
    for s in active + trials:
        mid = s["merchant_id"]
        staff_count = await db.staff_members.count_documents({"merchant_id": mid, "active": True})
        recent_events = await db.staff_clock_events.count_documents({"merchant_id": mid, "timestamp": {"$gte": cutoff}})
        if staff_count < 2 or recent_events == 0:
            churn_at_risk.append({
                "merchant_id": mid, "plan": s.get("plan"), "status": s.get("status"),
                "staff_count": staff_count, "recent_events_14d": recent_events,
            })

    # Open warnings
    open_warnings = await db.staff_warnings.count_documents({"resolved": False})

    return {
        "success": True,
        "subscriptions": {
            "trials": len(trials),
            "active": len(active),
            "expired": len(expired),
            "cancelled": len(cancelled),
            "total": len(subs),
        },
        "mrr_eur_placeholder": round(mrr, 2),
        "arr_eur_placeholder": round(mrr * 12, 2),
        "avg_staff_per_merchant": avg_staff,
        "churn_at_risk_count": len(churn_at_risk),
        "churn_at_risk": churn_at_risk[:20],
        "open_warnings_total": open_warnings,
    }


@router.get("/by-plan")
async def metrics_by_plan(request: Request):
    await _require_admin(request)
    subs = await db.staff_subscriptions.find({"status": "active"}, {"_id": 0}).to_list(length=1000)
    by_plan: dict = {}
    for s in subs:
        p = s.get("plan", "unknown")
        b = by_plan.setdefault(p, {"plan": p, "count": 0, "mrr_eur": 0.0})
        b["count"] += 1
        b["mrr_eur"] = round(b["mrr_eur"] + PLAN_PRICES.get(p, 0), 2)
    return {"success": True, "rows": list(by_plan.values())}
