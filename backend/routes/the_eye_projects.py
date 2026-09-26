"""The Eye project intelligence and normalized KPI catalog."""

from __future__ import annotations

import secrets
from datetime import datetime, timezone
from typing import Any, Dict, List, Literal, Optional

from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel, Field

from core.database import db
from core.security import get_current_user
from core.the_eye_live import broadcast_the_eye_event


router = APIRouter(prefix="/api/the-eye", tags=["The Eye Project Intelligence"])

ProjectStatus = Literal["healthy", "warning", "degraded", "critical", "offline", "unknown"]


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


async def _require_admin(request: Request) -> dict:
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin required")
    return user


class ProjectRegister(BaseModel):
    project_key: str = Field(..., min_length=2, max_length=80)
    name: str = Field(..., min_length=2, max_length=160)
    category: Optional[str] = Field(default=None, max_length=120)
    owner_team: Optional[str] = Field(default=None, max_length=120)
    currency: str = Field(default="EUR", min_length=3, max_length=3)
    connector_base_url: Optional[str] = Field(default=None, max_length=512)
    scopes: List[str] = Field(default_factory=list, max_length=100)
    metadata: Dict[str, Any] = Field(default_factory=dict)


class ProjectSnapshot(BaseModel):
    status: ProjectStatus = "unknown"
    health_score: Optional[float] = Field(default=None, ge=0, le=100)
    revenue: Optional[float] = None
    cost: Optional[float] = None
    profit: Optional[float] = None
    active_users: Optional[int] = Field(default=None, ge=0)
    primary_actions: Optional[int] = Field(default=None, ge=0)
    errors: Optional[int] = Field(default=None, ge=0)
    error_rate: Optional[float] = Field(default=None, ge=0)
    critical_alerts: Optional[int] = Field(default=None, ge=0)
    open_incidents: Optional[int] = Field(default=None, ge=0)
    uptime_percent: Optional[float] = Field(default=None, ge=0, le=100)
    latency_p50_ms: Optional[float] = Field(default=None, ge=0)
    latency_p95_ms: Optional[float] = Field(default=None, ge=0)
    latency_p99_ms: Optional[float] = Field(default=None, ge=0)
    usage: Optional[float] = Field(default=None, ge=0)
    risk_score: Optional[float] = Field(default=None, ge=0, le=100)
    data_trust_score: Optional[float] = Field(default=None, ge=0, le=100)
    period: str = Field(default="24h", max_length=32)
    source_timestamp: Optional[str] = None
    metrics: Dict[str, Any] = Field(default_factory=dict)


class KpiDefinitionCreate(BaseModel):
    key: str = Field(..., min_length=2, max_length=120)
    name: str = Field(..., min_length=2, max_length=160)
    description: Optional[str] = Field(default=None, max_length=1000)
    formula: Optional[str] = Field(default=None, max_length=2000)
    unit: Optional[str] = Field(default=None, max_length=80)
    source: Optional[str] = Field(default=None, max_length=160)
    refresh_seconds: Optional[int] = Field(default=None, ge=1, le=604800)
    owner: Optional[str] = Field(default=None, max_length=160)
    retention_days: Optional[int] = Field(default=None, ge=1, le=36500)
    formula_version: str = Field(default="1", min_length=1, max_length=32)


@router.post("/admin/projects")
async def register_project(req: ProjectRegister, request: Request):
    admin = await _require_admin(request)
    existing = await db.the_eye_projects.find_one({"project_key": req.project_key}, {"_id": 0, "project_id": 1})
    if existing:
        raise HTTPException(status_code=409, detail="Project key already exists")

    now = _now()
    project_id = "PRJ-" + secrets.token_hex(8).upper()
    doc = {
        "project_id": project_id,
        "project_key": req.project_key,
        "name": req.name,
        "category": req.category,
        "owner_team": req.owner_team,
        "currency": req.currency.upper(),
        "connector_base_url": req.connector_base_url,
        "scopes": list(dict.fromkeys(req.scopes)),
        "metadata": req.metadata,
        "status": "unknown",
        "health_score": None,
        "risk_score": None,
        "data_trust_score": None,
        "last_snapshot_at": None,
        "created_at": now,
        "updated_at": now,
        "created_by": str(admin.get("_id") or admin.get("id") or admin.get("email")),
    }
    await db.the_eye_projects.insert_one(doc)
    doc.pop("_id", None)
    await broadcast_the_eye_event("project.created", doc)
    return {"ok": True, "project": doc}


@router.get("/admin/projects")
async def list_projects(
    request: Request,
    status: Optional[str] = None,
    category: Optional[str] = None,
    limit: int = Query(default=200, ge=1, le=2000),
):
    await _require_admin(request)
    query: Dict[str, Any] = {}
    if status:
        query["status"] = status
    if category:
        query["category"] = category

    rows = await db.the_eye_projects.find(query, {"_id": 0}).sort("name", 1).to_list(limit)
    return {"ok": True, "count": len(rows), "projects": rows}


@router.post("/admin/projects/{project_key}/snapshot")
async def ingest_project_snapshot(project_key: str, req: ProjectSnapshot, request: Request):
    await _require_admin(request)
    project = await db.the_eye_projects.find_one({"project_key": project_key}, {"_id": 0})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    now = _now()
    profit = req.profit
    if profit is None and req.revenue is not None and req.cost is not None:
        profit = req.revenue - req.cost

    snapshot = {
        "snapshot_id": "KPI-" + secrets.token_hex(8).upper(),
        "project_id": project.get("project_id"),
        "project_key": project_key,
        "status": req.status,
        "health_score": req.health_score,
        "revenue": req.revenue,
        "cost": req.cost,
        "profit": profit,
        "active_users": req.active_users,
        "primary_actions": req.primary_actions,
        "errors": req.errors,
        "error_rate": req.error_rate,
        "critical_alerts": req.critical_alerts,
        "open_incidents": req.open_incidents,
        "uptime_percent": req.uptime_percent,
        "latency_p50_ms": req.latency_p50_ms,
        "latency_p95_ms": req.latency_p95_ms,
        "latency_p99_ms": req.latency_p99_ms,
        "usage": req.usage,
        "risk_score": req.risk_score,
        "data_trust_score": req.data_trust_score,
        "period": req.period,
        "source_timestamp": req.source_timestamp,
        "received_at": now,
        "metrics": req.metrics,
    }
    await db.the_eye_project_snapshots.insert_one(snapshot)
    snapshot.pop("_id", None)

    await db.the_eye_projects.update_one(
        {"project_key": project_key},
        {"$set": {
            "status": req.status,
            "health_score": req.health_score,
            "risk_score": req.risk_score,
            "data_trust_score": req.data_trust_score,
            "last_snapshot": snapshot,
            "last_snapshot_at": now,
            "updated_at": now,
        }},
    )

    await broadcast_the_eye_event("project.snapshot", snapshot)
    return {"ok": True, "snapshot": snapshot}


@router.get("/admin/projects/{project_key}")
async def get_project(project_key: str, request: Request):
    await _require_admin(request)
    project = await db.the_eye_projects.find_one({"project_key": project_key}, {"_id": 0})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    history = await db.the_eye_project_snapshots.find(
        {"project_key": project_key},
        {"_id": 0, "metrics": 0},
    ).sort("received_at", -1).to_list(100)

    return {"ok": True, "project": project, "history": history}


@router.post("/admin/kpis")
async def create_kpi_definition(req: KpiDefinitionCreate, request: Request):
    admin = await _require_admin(request)
    existing = await db.the_eye_kpi_catalog.find_one(
        {"key": req.key, "formula_version": req.formula_version},
        {"_id": 0, "kpi_id": 1},
    )
    if existing:
        raise HTTPException(status_code=409, detail="KPI definition version already exists")

    now = _now()
    kpi_id = "KDEF-" + secrets.token_hex(8).upper()
    doc = {
        "kpi_id": kpi_id,
        "key": req.key,
        "name": req.name,
        "description": req.description,
        "formula": req.formula,
        "unit": req.unit,
        "source": req.source,
        "refresh_seconds": req.refresh_seconds,
        "owner": req.owner,
        "retention_days": req.retention_days,
        "formula_version": req.formula_version,
        "created_at": now,
        "updated_at": now,
        "created_by": str(admin.get("_id") or admin.get("id") or admin.get("email")),
    }
    await db.the_eye_kpi_catalog.insert_one(doc)
    doc.pop("_id", None)
    return {"ok": True, "kpi": doc}


@router.get("/admin/kpis")
async def list_kpis(request: Request, limit: int = Query(default=500, ge=1, le=5000)):
    await _require_admin(request)
    rows = await db.the_eye_kpi_catalog.find({}, {"_id": 0}).sort([("key", 1), ("formula_version", -1)]).to_list(limit)
    return {"ok": True, "count": len(rows), "kpis": rows}


@router.get("/admin/project-intelligence/overview")
async def project_intelligence_overview(request: Request):
    await _require_admin(request)
    projects = await db.the_eye_projects.find({}, {"_id": 0}).to_list(2000)

    total_revenue = 0.0
    total_cost = 0.0
    total_profit = 0.0
    active_users = 0
    critical_alerts = 0
    open_incidents = 0
    healthy = 0
    warning_or_worse = 0

    rows = []
    for project in projects:
        snap = project.get("last_snapshot") or {}
        revenue = float(snap.get("revenue") or 0)
        cost = float(snap.get("cost") or 0)
        profit = float(snap.get("profit") or 0)
        users = int(snap.get("active_users") or 0)
        alerts = int(snap.get("critical_alerts") or 0)
        incidents = int(snap.get("open_incidents") or 0)

        total_revenue += revenue
        total_cost += cost
        total_profit += profit
        active_users += users
        critical_alerts += alerts
        open_incidents += incidents

        if project.get("status") == "healthy":
            healthy += 1
        else:
            warning_or_worse += 1

        rows.append({
            "project_id": project.get("project_id"),
            "project_key": project.get("project_key"),
            "name": project.get("name"),
            "status": project.get("status"),
            "health_score": project.get("health_score"),
            "risk_score": project.get("risk_score"),
            "data_trust_score": project.get("data_trust_score"),
            "revenue": revenue,
            "cost": cost,
            "profit": profit,
            "active_users": users,
            "critical_alerts": alerts,
            "open_incidents": incidents,
            "uptime_percent": snap.get("uptime_percent"),
            "latency_p95_ms": snap.get("latency_p95_ms"),
            "last_snapshot_at": project.get("last_snapshot_at"),
        })

    rows.sort(key=lambda row: (
        0 if row.get("status") in {"critical", "offline"} else 1,
        -(float(row.get("risk_score") or 0)),
        row.get("name") or "",
    ))

    return {
        "ok": True,
        "projects_total": len(projects),
        "healthy": healthy,
        "warning_or_worse": warning_or_worse,
        "revenue": round(total_revenue, 2),
        "cost": round(total_cost, 2),
        "profit": round(total_profit, 2),
        "active_users": active_users,
        "critical_alerts": critical_alerts,
        "open_incidents": open_incidents,
        "projects": rows,
    }
