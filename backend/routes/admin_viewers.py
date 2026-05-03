"""
BidBlitz — Admin Viewer Endpoints
==================================
Centralized read-only endpoints for the admin panel:
  - audit log search / filter
  - fraud alerts list
  - referral leaderboard

All endpoints require role=admin.
"""
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Request, Query

from core.database import db
from core.security import get_current_user

router = APIRouter(prefix="/api/admin", tags=["admin-viewers"])


async def _require_admin(request: Request):
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    return user


@router.get("/audit/list")
async def list_audit_logs(
    request: Request,
    event: Optional[str] = None,
    user_id: Optional[str] = None,
    days: int = Query(7, ge=1, le=365),
    limit: int = Query(100, ge=1, le=1000),
):
    await _require_admin(request)
    since = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    q = {"timestamp": {"$gte": since}}
    if event:
        q["event"] = event
    if user_id:
        q["user_id"] = user_id
    logs = await db.audit_logs.find(q, {"_id": 0}).sort("timestamp", -1).limit(limit).to_list(limit)
    return {"logs": logs, "count": len(logs), "filter": {"event": event, "user_id": user_id, "days": days}}


@router.get("/audit/event-types")
async def audit_event_types(request: Request):
    await _require_admin(request)
    pipeline = [
        {"$group": {"_id": "$event", "count": {"$sum": 1}, "last": {"$max": "$timestamp"}}},
        {"$sort": {"count": -1}},
    ]
    rows = await db.audit_logs.aggregate(pipeline).to_list(50)
    return {"events": [{"event": r["_id"], "count": r["count"], "last_seen": r["last"]} for r in rows]}


@router.get("/fraud/alerts")
async def list_fraud_alerts(
    request: Request,
    days: int = Query(7, ge=1, le=90),
    limit: int = Query(100, ge=1, le=1000),
):
    await _require_admin(request)
    since = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    alerts = await db.fraud_alerts.find(
        {"created_at": {"$gte": since}}, {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    return {"alerts": alerts, "count": len(alerts)}


@router.get("/fraud/stats")
async def fraud_stats(request: Request, days: int = 30):
    await _require_admin(request)
    since = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    pipeline = [
        {"$match": {"created_at": {"$gte": since}}},
        {"$group": {"_id": "$rule", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
    ]
    rows = await db.fraud_alerts.aggregate(pipeline).to_list(50)
    return {"by_rule": [{"rule": r["_id"], "count": r["count"]} for r in rows], "days": days}


@router.get("/referrals/top")
async def top_referrers(request: Request, limit: int = 50):
    await _require_admin(request)
    pipeline = [
        {"$match": {"type": {"$in": ["referral_payout", "referral_signup_bonus"]}}},
        {"$group": {"_id": "$user_id",
                    "earnings": {"$sum": "$amount"},
                    "events": {"$sum": 1}}},
        {"$sort": {"earnings": -1}},
        {"$limit": limit},
    ]
    rows = await db.transactions.aggregate(pipeline).to_list(limit)
    from bson import ObjectId
    out = []
    for r in rows:
        try:
            u = await db.users.find_one({"_id": ObjectId(r["_id"])}, {"_id": 0, "name": 1, "email": 1, "referral_code": 1})
        except Exception:
            u = None
        if not u:
            continue
        invited = await db.users.count_documents({"referred_by_code": u.get("referral_code")})
        out.append({
            "name": u.get("name"),
            "email": u.get("email"),
            "code": u.get("referral_code"),
            "earnings_eur": round(float(r["earnings"]), 2),
            "events": r["events"],
            "invited": invited,
        })
    return {"top_referrers": out}
