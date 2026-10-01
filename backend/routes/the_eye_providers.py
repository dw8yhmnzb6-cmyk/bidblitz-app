"""The Eye provider intelligence, dependency graph and fallback readiness."""

from __future__ import annotations

import secrets
from datetime import datetime, timezone
from typing import Any, Dict, List, Literal, Optional

from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel, Field

from core.database import db
from core.the_eye_access import TheEyeAccess, require_the_eye_access
from core.the_eye_data_safety import sanitize_the_eye_payload
from core.the_eye_live import broadcast_the_eye_event


router = APIRouter(prefix="/api/the-eye", tags=["The Eye Providers"])

ProviderStatus = Literal["healthy", "degraded", "partial_outage", "down"]
RiskLevel = Literal["low", "medium", "high", "critical"]


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


PROVIDER_SCOPE_MAP = {
    "project_id": "project_ids",
    "tenant_id": None,
    "customer_id": None,
    "site_id": None,
}


async def _require_admin(request: Request) -> dict:
    access = await require_the_eye_access(request, {"super_admin", "admin"})
    return dict(access.user)


async def _require_provider_reader(request: Request) -> TheEyeAccess:
    return await require_the_eye_access(
        request,
        {"super_admin", "admin", "project_admin", "partner"},
    )


async def _require_provider_operator(request: Request) -> TheEyeAccess:
    return await require_the_eye_access(
        request,
        {"super_admin", "admin", "project_admin"},
    )


def _provider_scope(access: TheEyeAccess, query: Dict[str, Any]) -> Dict[str, Any]:
    return access.scope_query(query, field_map=PROVIDER_SCOPE_MAP)


class ProviderCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=160)
    provider_type: str = Field(..., min_length=2, max_length=120)
    category: Optional[str] = Field(default=None, max_length=120)
    project_ids: List[str] = Field(default_factory=list, max_length=100)
    projects: List[str] = Field(default_factory=list, max_length=100)
    primary_for: List[str] = Field(default_factory=list, max_length=100)
    fallback_provider_id: Optional[str] = Field(default=None, max_length=128)
    contract_renewal_at: Optional[str] = None
    notice_days: Optional[int] = Field(default=None, ge=0, le=3650)
    sla_percent: Optional[float] = Field(default=None, ge=0, le=100)
    monthly_budget: Optional[float] = Field(default=None, ge=0)
    currency: str = Field(default="EUR", min_length=3, max_length=3)
    metadata: Dict[str, Any] = Field(default_factory=dict)


class ProviderHealthUpdate(BaseModel):
    status: ProviderStatus
    latency_ms: Optional[float] = Field(default=None, ge=0, le=600000)
    error_rate_percent: Optional[float] = Field(default=None, ge=0, le=100)
    availability_percent: Optional[float] = Field(default=None, ge=0, le=100)
    current_cost: Optional[float] = Field(default=None, ge=0)
    affected_projects: List[str] = Field(default_factory=list, max_length=100)
    details: Dict[str, Any] = Field(default_factory=dict)


class ProviderFallbackUpdate(BaseModel):
    fallback_provider_id: Optional[str] = Field(default=None, max_length=128)
    fallback_mode: Optional[str] = Field(default=None, max_length=120)
    automatic_failover: bool = False
    tested_at: Optional[str] = None


def _risk_score(status: str, fallback_ready: bool, availability: Optional[float], over_budget: bool) -> tuple[int, RiskLevel]:
    score = 0
    score += {
        "healthy": 0,
        "degraded": 25,
        "partial_outage": 50,
        "down": 80,
    }.get(status, 20)
    if not fallback_ready:
        score += 15
    if availability is not None and availability < 99:
        score += 10
    if over_budget:
        score += 10
    score = min(score, 100)
    if score >= 75:
        level: RiskLevel = "critical"
    elif score >= 50:
        level = "high"
    elif score >= 25:
        level = "medium"
    else:
        level = "low"
    return score, level



@router.post("/admin/providers")
async def create_provider(req: ProviderCreate, request: Request):
    access = await _require_provider_operator(request)
    now = _now()
    provider_id = "PRV-" + secrets.token_hex(8).upper()
    doc = {
        "provider_id": provider_id,
        "name": req.name,
        "provider_type": req.provider_type,
        "category": req.category,
        "project_ids": list(dict.fromkeys(req.project_ids)),
        "projects": list(dict.fromkeys(req.projects)),
        "primary_for": list(dict.fromkeys(req.primary_for)),
        "fallback_provider_id": req.fallback_provider_id,
        "fallback_mode": None,
        "automatic_failover": False,
        "fallback_tested_at": None,
        "contract_renewal_at": req.contract_renewal_at,
        "notice_days": req.notice_days,
        "sla_percent": req.sla_percent,
        "monthly_budget": req.monthly_budget,
        "currency": req.currency.upper(),
        "metadata": sanitize_the_eye_payload(req.metadata),
        "status": "healthy",
        "latency_ms": None,
        "error_rate_percent": None,
        "availability_percent": None,
        "current_cost": 0.0,
        "risk_score": 0,
        "risk_level": "low",
        "created_at": now,
        "updated_at": now,
        "created_by": access.actor_id,
    }
    access.assert_document(doc, field_map=PROVIDER_SCOPE_MAP)
    await db.the_eye_providers.insert_one(doc)
    doc.pop("_id", None)
    await broadcast_the_eye_event("provider.created", doc)
    return {"ok": True, "provider": doc}


@router.get("/admin/providers")
async def list_providers(
    request: Request,
    status: Optional[str] = None,
    category: Optional[str] = None,
    project: Optional[str] = None,
    limit: int = Query(default=250, ge=1, le=2000),
):
    access = await _require_provider_reader(request)
    query: Dict[str, Any] = {}
    if status:
        query["status"] = status
    if category:
        query["category"] = category
    if project:
        query["projects"] = project
    query = _provider_scope(access, query)
    rows = await db.the_eye_providers.find(query, {"_id": 0}).sort("risk_score", -1).to_list(limit)
    return {"ok": True, "count": len(rows), "providers": rows}


@router.patch("/admin/providers/{provider_id}/health")
async def update_provider_health(provider_id: str, req: ProviderHealthUpdate, request: Request):
    access = await _require_provider_operator(request)
    provider_query = _provider_scope(access, {"provider_id": provider_id})
    provider = await db.the_eye_providers.find_one(provider_query, {"_id": 0})
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")

    fallback_ready = bool(provider.get("fallback_provider_id")) and bool(provider.get("fallback_tested_at"))
    current_cost = req.current_cost if req.current_cost is not None else float(provider.get("current_cost") or 0)
    budget = provider.get("monthly_budget")
    over_budget = bool(budget is not None and current_cost > float(budget))
    risk_score, risk_level = _risk_score(
        req.status,
        fallback_ready,
        req.availability_percent,
        over_budget,
    )

    now = _now()
    update = {
        "status": req.status,
        "latency_ms": req.latency_ms,
        "error_rate_percent": req.error_rate_percent,
        "availability_percent": req.availability_percent,
        "current_cost": current_cost,
        "affected_projects": req.affected_projects,
        "details": sanitize_the_eye_payload(req.details),
        "risk_score": risk_score,
        "risk_level": risk_level,
        "last_seen_at": now,
        "updated_at": now,
    }
    await db.the_eye_providers.update_one(provider_query, {"$set": update})
    await db.the_eye_provider_health.insert_one(
        {
            "provider_id": provider_id,
            "project_ids": provider.get("project_ids") or [],
            **update,
            "recorded_at": now,
        }
    )
    fresh = await db.the_eye_providers.find_one(provider_query, {"_id": 0})
    await broadcast_the_eye_event("provider.health", fresh)
    return {"ok": True, "provider": fresh}


@router.patch("/admin/providers/{provider_id}/fallback")
async def update_provider_fallback(provider_id: str, req: ProviderFallbackUpdate, request: Request):
    access = await _require_provider_operator(request)
    provider_query = _provider_scope(access, {"provider_id": provider_id})
    provider = await db.the_eye_providers.find_one(provider_query, {"_id": 0})
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")

    if req.fallback_provider_id:
        fallback_query = _provider_scope(access, {"provider_id": req.fallback_provider_id})
        fallback = await db.the_eye_providers.find_one(
            fallback_query,
            {"_id": 0, "provider_id": 1},
        )
        if not fallback:
            raise HTTPException(status_code=400, detail="Fallback provider not found")
        if req.fallback_provider_id == provider_id:
            raise HTTPException(status_code=400, detail="Provider cannot fallback to itself")

    now = _now()
    await db.the_eye_providers.update_one(
        provider_query,
        {"$set": {
            "fallback_provider_id": req.fallback_provider_id,
            "fallback_mode": req.fallback_mode,
            "automatic_failover": req.automatic_failover,
            "fallback_tested_at": req.tested_at,
            "updated_at": now,
        }},
    )
    fresh = await db.the_eye_providers.find_one(provider_query, {"_id": 0})
    await broadcast_the_eye_event("provider.updated", fresh)
    return {"ok": True, "provider": fresh}


@router.get("/admin/providers/dependencies")
async def provider_dependencies(request: Request):
    access = await _require_provider_reader(request)
    provider_query = _provider_scope(access, {})
    providers = await db.the_eye_providers.find(provider_query, {"_id": 0}).to_list(2000)

    project_map: Dict[str, List[dict]] = {}
    for provider in providers:
        for project in provider.get("projects") or []:
            project_map.setdefault(project, []).append({
                "provider_id": provider.get("provider_id"),
                "name": provider.get("name"),
                "status": provider.get("status"),
                "risk_score": provider.get("risk_score"),
                "fallback_provider_id": provider.get("fallback_provider_id"),
            })

    single_points = []
    for project, rows in project_map.items():
        if len(rows) == 1 and not rows[0].get("fallback_provider_id"):
            single_points.append({
                "project": project,
                "provider_id": rows[0].get("provider_id"),
                "provider_name": rows[0].get("name"),
                "reason": "single_provider_without_fallback",
            })

    return {
        "ok": True,
        "projects": project_map,
        "single_points_of_failure": single_points,
    }

@router.get("/admin/providers/overview")
async def provider_overview(request: Request):
    access = await _require_provider_reader(request)
    provider_query = _provider_scope(access, {})
    providers = await db.the_eye_providers.find(provider_query, {"_id": 0}).to_list(2000)
    total = len(providers)
    healthy = sum(1 for p in providers if p.get("status") == "healthy")
    degraded = sum(1 for p in providers if p.get("status") == "degraded")
    down = sum(1 for p in providers if p.get("status") in {"partial_outage", "down"})
    high_risk = sum(1 for p in providers if p.get("risk_level") in {"high", "critical"})
    no_fallback = sum(1 for p in providers if not p.get("fallback_provider_id"))
    monthly_cost = round(sum(float(p.get("current_cost") or 0) for p in providers), 2)

    risky = sorted(
        providers,
        key=lambda p: (int(p.get("risk_score") or 0), float(p.get("current_cost") or 0)),
        reverse=True,
    )[:20]

    return {
        "ok": True,
        "providers_total": total,
        "healthy": healthy,
        "degraded": degraded,
        "down_or_partial": down,
        "high_risk": high_risk,
        "without_fallback": no_fallback,
        "monthly_cost": monthly_cost,
        "providers": risky,
    }
