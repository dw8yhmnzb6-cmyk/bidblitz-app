"""Read-only aggregate snapshot for AION Multi-Project Intelligence."""
from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone
from hmac import compare_digest

from fastapi import APIRouter, Header, HTTPException

from core.database import db

router = APIRouter(prefix="/api/aion", tags=["aion-project-intelligence"])

AION_PROJECT_SECRET_ENV = "AION_PROJECT_INTELLIGENCE_SECRET"


def _require_aion_service(supplied: str | None) -> None:
    expected = str(os.environ.get(AION_PROJECT_SECRET_ENV) or "").strip()
    if len(expected) < 32:
        raise HTTPException(status_code=503, detail="AION_PROJECT_INTELLIGENCE_NOT_CONFIGURED")
    if not supplied or not compare_digest(supplied, expected):
        raise HTTPException(status_code=401, detail="AION_PROJECT_INTELLIGENCE_AUTH_INVALID")


async def _transaction_volume_by_currency(since_iso: str) -> list[dict]:
    pipeline = [
        {
            "$match": {
                "created_at": {"$gte": since_iso},
                "status": "completed",
            }
        },
        {
            "$group": {
                "_id": {"$ifNull": ["$currency", "EUR"]},
                "amount": {"$sum": {"$abs": {"$ifNull": ["$amount", 0]}}},
                "count": {"$sum": 1},
            }
        },
        {"$sort": {"_id": 1}},
    ]
    rows = await db.transactions.aggregate(pipeline).to_list(50)
    return [
        {
            "currency": str(row.get("_id") or "EUR").upper(),
            "amount": round(float(row.get("amount") or 0), 2),
            "count": int(row.get("count") or 0),
        }
        for row in rows
    ]


@router.get("/intelligence-snapshot")
async def aion_intelligence_snapshot(
    x_service_key: str | None = Header(default=None, alias="X-AION-Project-Key"),
):
    _require_aion_service(x_service_key)

    now = datetime.now(timezone.utc)
    since_30d = (now - timedelta(days=30)).isoformat()

    total_users = await db.users.count_documents({"role": {"$ne": "disabled"}})
    total_merchants = await db.users.count_documents({"role": "merchant"})
    completed_transactions_30d = await db.transactions.count_documents(
        {"created_at": {"$gte": since_30d}, "status": "completed"}
    )
    active_auctions = await db.auctions.count_documents(
        {"status": {"$in": ["active", "live", "running"]}}
    )
    open_taxi_rides = await db.taxi_rides.count_documents(
        {"status": {"$in": ["requested", "accepted", "arriving", "in_progress"]}}
    )
    active_ev_sessions = await db.ev_sessions.count_documents(
        {"status": {"$in": ["active", "charging", "in_progress"]}}
    )
    open_support = await db.support_tickets.count_documents(
        {"status": {"$nin": ["closed", "resolved"]}}
    )
    fraud_alerts = await db.fraud_alerts.count_documents(
        {"status": {"$nin": ["closed", "resolved", "dismissed"]}}
    )
    volume_by_currency = await _transaction_volume_by_currency(since_30d)

    alerts: list[str] = []
    risks: list[str] = []
    if fraud_alerts > 0:
        alerts.append(f"{fraud_alerts} unresolved fraud/risk alerts.")
    if open_support > 50:
        alerts.append(f"{open_support} support tickets are still open.")

    metrics = [
        {"key": "users", "label": "Users", "value": total_users, "unit": "users", "trend": "unknown"},
        {"key": "merchants", "label": "Merchants", "value": total_merchants, "unit": "merchants", "trend": "unknown"},
        {"key": "transactions_30d", "label": "Completed transactions (30d)", "value": completed_transactions_30d, "unit": "transactions", "trend": "unknown"},
        {"key": "active_auctions", "label": "Active auctions", "value": active_auctions, "unit": "auctions", "trend": "unknown"},
        {"key": "open_taxi_rides", "label": "Open taxi rides", "value": open_taxi_rides, "unit": "rides", "trend": "unknown"},
        {"key": "active_ev_sessions", "label": "Active EV sessions", "value": active_ev_sessions, "unit": "sessions", "trend": "unknown"},
        {"key": "open_support", "label": "Open support tickets", "value": open_support, "unit": "tickets", "trend": "unknown"},
        {"key": "fraud_alerts", "label": "Open fraud alerts", "value": fraud_alerts, "unit": "alerts", "trend": "unknown"},
    ]
    for row in volume_by_currency:
        metrics.append({
            "key": f"volume_30d_{row['currency'].lower()}",
            "label": f"Transaction volume 30d ({row['currency']})",
            "value": row["amount"],
            "unit": row["currency"],
            "trend": "unknown",
        })

    return {
        "project_key": "bidblitz-super-app",
        "health": "attention" if alerts else "healthy",
        "connector_state": "connected",
        "metrics": metrics,
        "alerts": alerts,
        "blockers": [],
        "risks": risks,
        "open_tasks": open_support + fraud_alerts,
        "source_revision": "bidblitz-project-intelligence-v1",
        "source_type": "bidblitz_api",
        "observed_at": now.isoformat(),
        "metadata": {
            "privacy_scope": "aggregate_only",
            "transaction_volume_by_currency": volume_by_currency,
            "write_actions_enabled": False,
            "payment_actions_enabled": False,
            "production_changes_enabled": False,
        },
    }
