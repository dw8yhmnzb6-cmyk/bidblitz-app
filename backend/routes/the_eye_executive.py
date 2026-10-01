"""The Eye executive intelligence and saved daily/weekly briefs."""

from __future__ import annotations

import secrets
from datetime import datetime, timezone
from typing import Any, Dict, Literal, Optional

from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel, Field

from core.database import db
from core.the_eye_access import TheEyeAccess, require_the_eye_access
from core.the_eye_live import broadcast_the_eye_event


router = APIRouter(prefix="/api/the-eye", tags=["The Eye Executive Intelligence"])

BriefPeriod = Literal["daily", "weekly", "monthly", "quarterly", "yearly"]


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


async def _require_admin(request: Request) -> TheEyeAccess:
    return await require_the_eye_access(request, {"super_admin", "admin"})


async def _require_reader(request: Request) -> TheEyeAccess:
    return await require_the_eye_access(
        request,
        {"super_admin", "admin", "project_admin"},
    )


PROJECT_SCOPE_MAP = {"tenant_id": None, "customer_id": None, "site_id": None}
PROVIDER_SCOPE_MAP = {"project_id": "project_ids", "tenant_id": None, "customer_id": None, "site_id": None}


class ExecutiveBriefCreate(BaseModel):
    period: BriefPeriod = "daily"
    title: Optional[str] = Field(default=None, max_length=240)
    notes: Optional[str] = Field(default=None, max_length=4000)


async def _project_totals(access: TheEyeAccess) -> dict:
    project_query = access.scope_query({}, field_map=PROJECT_SCOPE_MAP)
    projects = await db.the_eye_projects.find(project_query, {"_id": 0}).to_list(2000)
    revenue = cost = profit = 0.0
    active_users = critical_alerts = open_incidents = 0
    healthy = 0

    project_rows = []
    for project in projects:
        snap = project.get("last_snapshot") or {}
        row = {
            "project_id": project.get("project_id"),
            "project_key": project.get("project_key"),
            "name": project.get("name"),
            "status": project.get("status"),
            "health_score": project.get("health_score"),
            "risk_score": project.get("risk_score"),
            "data_trust_score": project.get("data_trust_score"),
            "revenue": float(snap.get("revenue") or 0),
            "cost": float(snap.get("cost") or 0),
            "profit": float(snap.get("profit") or 0),
            "active_users": int(snap.get("active_users") or 0),
            "critical_alerts": int(snap.get("critical_alerts") or 0),
            "open_incidents": int(snap.get("open_incidents") or 0),
        }
        revenue += row["revenue"]
        cost += row["cost"]
        profit += row["profit"]
        active_users += row["active_users"]
        critical_alerts += row["critical_alerts"]
        open_incidents += row["open_incidents"]
        if project.get("status") == "healthy":
            healthy += 1
        project_rows.append(row)

    project_rows.sort(key=lambda x: (
        0 if x.get("status") in {"critical", "offline"} else 1,
        -(float(x.get("risk_score") or 0)),
        x.get("name") or "",
    ))
    return {
        "projects_total": len(projects),
        "projects_healthy": healthy,
        "revenue": round(revenue, 2),
        "cost": round(cost, 2),
        "profit": round(profit, 2),
        "active_users": active_users,
        "critical_alerts": critical_alerts,
        "project_open_incidents": open_incidents,
        "projects": project_rows[:20],
    }


async def _operations_totals(access: TheEyeAccess) -> dict:
    open_incidents = await db.the_eye_incidents.count_documents(
        access.scope_query({"status": {"$nin": ["resolved", "closed"]}})
    )
    critical_incidents = await db.the_eye_incidents.count_documents(
        access.scope_query({"status": {"$nin": ["resolved", "closed"]}, "severity": "critical"})
    )
    open_actions = await db.the_eye_actions.count_documents(
        access.scope_query({"status": {"$nin": ["done", "cancelled"]}})
    )
    open_tickets = await db.the_eye_tickets.count_documents(
        access.scope_query({"status": {"$nin": ["resolved", "closed", "cancelled"]}})
    )
    open_work_orders = await db.the_eye_work_orders.count_documents(
        access.scope_query({"status": {"$nin": ["completed", "cancelled"]}})
    )
    waiting_parts = await db.the_eye_work_orders.count_documents(
        access.scope_query({"status": "waiting_parts"})
    )
    return {
        "open_incidents": open_incidents,
        "critical_incidents": critical_incidents,
        "open_actions": open_actions,
        "open_tickets": open_tickets,
        "open_work_orders": open_work_orders,
        "waiting_parts": waiting_parts,
    }


async def _risk_totals(access: TheEyeAccess) -> dict:
    security_open = await db.the_eye_security_events.count_documents(
        access.scope_query({"status": {"$ne": "resolved"}})
    )
    security_critical = await db.the_eye_security_events.count_documents(
        access.scope_query({"status": {"$ne": "resolved"}, "severity": "critical"})
    )
    pending_approvals = await db.the_eye_approvals.count_documents(
        access.scope_query({"status": "pending"})
    )
    provider_high_risk = await db.the_eye_providers.count_documents(
        access.scope_query(
            {"risk_level": {"$in": ["high", "critical"]}},
            field_map=PROVIDER_SCOPE_MAP,
        )
    )
    provider_down = await db.the_eye_providers.count_documents(
        access.scope_query(
            {"status": {"$in": ["partial_outage", "down"]}},
            field_map=PROVIDER_SCOPE_MAP,
        )
    )
    quality_issues = await db.the_eye_data_quality_issues.count_documents(
        access.scope_query({"status": {"$ne": "resolved"}})
    )
    return {
        "security_open": security_open,
        "security_critical": security_critical,
        "pending_approvals": pending_approvals,
        "provider_high_risk": provider_high_risk,
        "provider_down": provider_down,
        "data_quality_issues": quality_issues,
    }


async def _provider_cost(access: TheEyeAccess) -> float:
    query = access.scope_query({}, field_map=PROVIDER_SCOPE_MAP)
    rows = await db.the_eye_providers.find(
        query,
        {"_id": 0, "current_cost": 1},
    ).to_list(2000)
    return round(sum(float(row.get("current_cost") or 0) for row in rows), 2)


async def _data_trust(access: TheEyeAccess) -> Optional[float]:
    rows = await db.the_eye_data_sources.find(
        access.scope_query({}),
        {"_id": 0, "trust_score": 1},
    ).to_list(5000)
    scores = [float(row.get("trust_score") or 0) for row in rows]
    return round(sum(scores) / len(scores), 1) if scores else None


async def _executive_snapshot(access: TheEyeAccess) -> dict:
    projects = await _project_totals(access)
    operations = await _operations_totals(access)
    risk = await _risk_totals(access)
    provider_cost = await _provider_cost(access)
    data_trust = await _data_trust(access)

    priorities = []
    if operations["critical_incidents"]:
        priorities.append({
            "type": "incident",
            "severity": "critical",
            "title": f"{operations['critical_incidents']} kritische Incidents offen",
        })
    if risk["security_critical"]:
        priorities.append({
            "type": "security",
            "severity": "critical",
            "title": f"{risk['security_critical']} kritische Security Events offen",
        })
    if risk["provider_down"]:
        priorities.append({
            "type": "provider",
            "severity": "high",
            "title": f"{risk['provider_down']} Provider mit Ausfall/Teil-Ausfall",
        })
    if risk["pending_approvals"]:
        priorities.append({
            "type": "approval",
            "severity": "high",
            "title": f"{risk['pending_approvals']} Freigaben warten auf Entscheidung",
        })
    if operations["waiting_parts"]:
        priorities.append({
            "type": "maintenance",
            "severity": "medium",
            "title": f"{operations['waiting_parts']} Work Orders warten auf Teile",
        })

    return {
        "generated_at": _now(),
        **projects,
        **operations,
        **risk,
        "provider_monthly_cost": provider_cost,
        "data_trust_score": data_trust,
        "data_trust_state": "unknown" if data_trust is None else "measured",
        "priorities": priorities[:10],
    }


@router.get("/admin/executive/overview")
async def executive_overview(request: Request):
    access = await _require_reader(request)
    snapshot = await _executive_snapshot(access)

    recent = await db.the_eye_executive_briefs.find(
        {},
        {"_id": 0, "snapshot.projects": 0},
    ).sort("created_at", -1).to_list(10)

    return {
        "ok": True,
        "snapshot": snapshot,
        "recent_briefs": recent,
    }


@router.post("/admin/executive/briefs")
async def create_executive_brief(req: ExecutiveBriefCreate, request: Request):
    access = await _require_admin(request)
    snapshot = await _executive_snapshot(access)
    now = _now()
    brief_id = "BRF-" + secrets.token_hex(8).upper()

    title = req.title or {
        "daily": "Daily Executive Brief",
        "weekly": "Weekly Executive Brief",
        "monthly": "Monthly Executive Brief",
        "quarterly": "Quarterly Executive Brief",
        "yearly": "Yearly Executive Brief",
    }[req.period]

    facts = [
        f"Projects: {snapshot['projects_total']}",
        f"Revenue: {snapshot['revenue']:.2f}",
        f"Cost: {snapshot['cost']:.2f}",
        f"Profit: {snapshot['profit']:.2f}",
        f"Open incidents: {snapshot['open_incidents']}",
        f"Security events: {snapshot['security_open']}",
        f"Provider monthly cost: {snapshot['provider_monthly_cost']:.2f}",
        (
            f"Data trust: {snapshot['data_trust_score']:.1f}"
            if snapshot["data_trust_score"] is not None
            else "Data trust: UNKNOWN"
        ),
    ]

    doc = {
        "brief_id": brief_id,
        "period": req.period,
        "title": title,
        "notes": req.notes,
        "facts": facts,
        "priorities": snapshot.get("priorities") or [],
        "snapshot": snapshot,
        "created_at": now,
        "created_by": access.actor_id,
    }
    await db.the_eye_executive_briefs.insert_one(doc)
    doc.pop("_id", None)
    await broadcast_the_eye_event("executive.brief_created", doc)
    return {"ok": True, "brief": doc}


@router.get("/admin/executive/briefs")
async def list_executive_briefs(
    request: Request,
    period: Optional[str] = None,
    limit: int = Query(default=100, ge=1, le=1000),
):
    await _require_admin(request)
    query: Dict[str, Any] = {}
    if period:
        query["period"] = period
    rows = await db.the_eye_executive_briefs.find(
        query,
        {"_id": 0},
    ).sort("created_at", -1).to_list(limit)
    return {"ok": True, "count": len(rows), "briefs": rows}


@router.get("/admin/executive/briefs/{brief_id}")
async def get_executive_brief(brief_id: str, request: Request):
    await _require_admin(request)
    row = await db.the_eye_executive_briefs.find_one(
        {"brief_id": brief_id},
        {"_id": 0},
    )
    if not row:
        raise HTTPException(status_code=404, detail="Brief not found")
    return {"ok": True, "brief": row}
