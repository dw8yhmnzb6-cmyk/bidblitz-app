"""The Eye project intelligence and normalized KPI catalog."""

from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timezone
from typing import Any, Dict, List, Literal, Optional

from fastapi import APIRouter, Header, HTTPException, Query, Request
from pydantic import BaseModel, Field
from pymongo.errors import DuplicateKeyError

from core.database import db
from core.the_eye_access import TheEyeAccess, require_the_eye_access
from core.the_eye_data_safety import sanitize_the_eye_payload
from core.the_eye_live import broadcast_the_eye_event


router = APIRouter(prefix="/api/the-eye", tags=["The Eye Project Intelligence"])

ProjectStatus = Literal["healthy", "warning", "degraded", "critical", "offline", "unknown"]


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


PROJECT_SCOPE_MAP = {"tenant_id": None, "customer_id": None, "site_id": None}


async def _require_admin(request: Request) -> dict:
    access = await require_the_eye_access(request, {"super_admin", "admin"})
    return dict(access.user)


async def _require_project_reader(request: Request) -> TheEyeAccess:
    return await require_the_eye_access(
        request,
        {"super_admin", "admin", "project_admin", "partner"},
    )


async def _require_project_operator(request: Request) -> TheEyeAccess:
    return await require_the_eye_access(
        request,
        {"super_admin", "admin", "project_admin"},
    )


def _project_scope(access: TheEyeAccess, query: Dict[str, Any]) -> Dict[str, Any]:
    return access.scope_query(query, field_map=PROJECT_SCOPE_MAP)


def _hash_connector_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


async def _require_project_connector(project_key: str, token: Optional[str], required_scope: str) -> dict:
    if not token:
        raise HTTPException(status_code=401, detail="Missing connector token")
    connector = await db.the_eye_project_connectors.find_one(
        {
            "project_key": project_key,
            "status": "active",
            "token_hash": _hash_connector_token(token),
        },
        {"_id": 0},
    )
    if not connector:
        raise HTTPException(status_code=401, detail="Invalid connector token")
    scopes = set(connector.get("scopes") or [])
    if required_scope not in scopes and "*" not in scopes:
        raise HTTPException(status_code=403, detail=f"Connector scope required: {required_scope}")
    return connector


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
    snapshot_id: Optional[str] = Field(default=None, max_length=160)
    schema_version: str = Field(default="1", min_length=1, max_length=32)
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


class ConnectorTokenCreate(BaseModel):
    scopes: List[str] = Field(default_factory=lambda: ["status.write", "kpis.write", "events.write"], max_length=100)
    label: Optional[str] = Field(default=None, max_length=160)


class ProjectEventIn(BaseModel):
    event_id: Optional[str] = Field(default=None, max_length=160)
    event_type: str = Field(..., min_length=3, max_length=180)
    timestamp: Optional[str] = None
    severity: Literal["info", "low", "medium", "high", "critical"] = "info"
    tenant_id: Optional[str] = Field(default=None, max_length=160)
    customer_id: Optional[str] = Field(default=None, max_length=160)
    site_id: Optional[str] = Field(default=None, max_length=160)
    device_id: Optional[str] = Field(default=None, max_length=160)
    source: Optional[str] = Field(default=None, max_length=160)
    correlation_id: Optional[str] = Field(default=None, max_length=160)
    schema_version: str = Field(default="1", min_length=1, max_length=32)
    payload: Dict[str, Any] = Field(default_factory=dict)


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
        "metadata": sanitize_the_eye_payload(req.metadata),
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
    access = await _require_project_reader(request)
    query: Dict[str, Any] = {}
    if status:
        query["status"] = status
    if category:
        query["category"] = category
    query = _project_scope(access, query)

    rows = await db.the_eye_projects.find(query, {"_id": 0}).sort("name", 1).to_list(limit)
    return {"ok": True, "count": len(rows), "projects": rows}


@router.post("/admin/projects/{project_key}/connector-token")
async def create_project_connector_token(project_key: str, req: ConnectorTokenCreate, request: Request):
    access = await _require_project_operator(request)
    project_query = _project_scope(access, {"project_key": project_key})
    project = await db.the_eye_projects.find_one(project_query, {"_id": 0})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    token = secrets.token_urlsafe(40)
    connector_id = "CON-" + secrets.token_hex(8).upper()
    now = _now()
    doc = {
        "connector_id": connector_id,
        "project_id": project.get("project_id"),
        "project_key": project_key,
        "label": req.label,
        "scopes": list(dict.fromkeys(req.scopes)),
        "token_hash": _hash_connector_token(token),
        "status": "active",
        "created_at": now,
        "updated_at": now,
        "last_seen_at": None,
        "created_by": access.actor_id,
    }
    await db.the_eye_project_connectors.insert_one(doc)
    await db.the_eye_projects.update_one(
        project_query,
        {"$addToSet": {"connector_ids": connector_id}, "$set": {"updated_at": now}},
    )
    return {
        "ok": True,
        "connector": {k: v for k, v in doc.items() if k not in {"_id", "token_hash"}},
        "connector_token": token,
        "token_notice": "Shown once. Store it securely in the project connector.",
    }



@router.post("/connectors/{project_key}/snapshot")
async def connector_snapshot(
    project_key: str,
    req: ProjectSnapshot,
    x_the_eye_connector_token: Optional[str] = Header(default=None),
):
    connector = await _require_project_connector(
        project_key,
        x_the_eye_connector_token,
        "kpis.write",
    )
    project = await db.the_eye_projects.find_one({"project_key": project_key}, {"_id": 0})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    now = _now()
    snapshot_id = req.snapshot_id or ("KPI-" + secrets.token_hex(8).upper())
    profit = req.profit
    if profit is None and req.revenue is not None and req.cost is not None:
        profit = req.revenue - req.cost

    snapshot = {
        "snapshot_id": snapshot_id,
        "schema_version": req.schema_version,
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
        "connector_id": connector.get("connector_id"),
        "metrics": sanitize_the_eye_payload(req.metrics),
    }
    try:
        await db.the_eye_project_snapshots.insert_one(snapshot)
    except DuplicateKeyError:
        return {
            "ok": True,
            "duplicate": True,
            "snapshot_id": snapshot_id,
        }

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
    await db.the_eye_project_connectors.update_one(
        {"connector_id": connector.get("connector_id")},
        {"$set": {"last_seen_at": now, "updated_at": now}},
    )
    await broadcast_the_eye_event("project.snapshot", snapshot)
    return {"ok": True, "duplicate": False, "snapshot": snapshot}


@router.post("/connectors/{project_key}/events")
async def connector_event(
    project_key: str,
    req: ProjectEventIn,
    x_the_eye_connector_token: Optional[str] = Header(default=None),
):
    connector = await _require_project_connector(
        project_key,
        x_the_eye_connector_token,
        "events.write",
    )
    project = await db.the_eye_projects.find_one(
        {"project_key": project_key},
        {"_id": 0, "project_id": 1},
    )
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    now = _now()
    event_id = req.event_id or ("EVT-" + secrets.token_hex(10).upper())
    doc = {
        "event_id": event_id,
        "project_id": project.get("project_id"),
        "project_key": project_key,
        "event_type": req.event_type,
        "timestamp": req.timestamp or now,
        "severity": req.severity,
        "tenant_id": req.tenant_id,
        "customer_id": req.customer_id,
        "site_id": req.site_id,
        "device_id": req.device_id,
        "source": req.source or project_key,
        "correlation_id": req.correlation_id,
        "schema_version": req.schema_version,
        "payload": sanitize_the_eye_payload(req.payload),
        "connector_id": connector.get("connector_id"),
        "received_at": now,
    }
    try:
        await db.the_eye_project_events.insert_one(doc)
    except DuplicateKeyError:
        return {
            "ok": True,
            "duplicate": True,
            "event_id": event_id,
        }

    doc.pop("_id", None)
    await db.the_eye_project_connectors.update_one(
        {"connector_id": connector.get("connector_id")},
        {"$set": {"last_seen_at": now, "updated_at": now}},
    )
    await broadcast_the_eye_event("project.event", doc)
    return {"ok": True, "duplicate": False, "event": doc}


@router.post("/admin/projects/{project_key}/snapshot")
async def ingest_project_snapshot(project_key: str, req: ProjectSnapshot, request: Request):
    access = await _require_project_operator(request)
    project_query = _project_scope(access, {"project_key": project_key})
    project = await db.the_eye_projects.find_one(project_query, {"_id": 0})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    now = _now()
    snapshot_id = req.snapshot_id or ("KPI-" + secrets.token_hex(8).upper())
    profit = req.profit
    if profit is None and req.revenue is not None and req.cost is not None:
        profit = req.revenue - req.cost

    snapshot = {
        "snapshot_id": snapshot_id,
        "schema_version": req.schema_version,
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
        "metrics": sanitize_the_eye_payload(req.metrics),
    }
    try:
        await db.the_eye_project_snapshots.insert_one(snapshot)
    except DuplicateKeyError:
        return {
            "ok": True,
            "duplicate": True,
            "snapshot_id": snapshot_id,
        }

    snapshot.pop("_id", None)
    await db.the_eye_projects.update_one(
        project_query,
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
    return {"ok": True, "duplicate": False, "snapshot": snapshot}

@router.get("/admin/projects/{project_key}")
async def get_project(project_key: str, request: Request):
    access = await _require_project_reader(request)
    project_query = _project_scope(access, {"project_key": project_key})
    project = await db.the_eye_projects.find_one(project_query, {"_id": 0})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    history = await db.the_eye_project_snapshots.find(
        {"project_id": project.get("project_id")},
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
    access = await _require_project_reader(request)
    project_query = _project_scope(access, {})
    projects = await db.the_eye_projects.find(project_query, {"_id": 0}).to_list(2000)

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
