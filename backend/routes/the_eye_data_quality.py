"""The Eye data quality, freshness and trust intelligence."""

from __future__ import annotations

import secrets
from datetime import datetime, timezone
from typing import Any, Dict, Literal, Optional

from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel, Field

from core.database import db
from core.the_eye_data_safety import sanitize_the_eye_payload
from core.security import get_current_user
from core.the_eye_live import broadcast_the_eye_event


router = APIRouter(prefix="/api/the-eye", tags=["The Eye Data Quality"])

TrustStatus = Literal["verified", "live", "delayed", "incomplete", "unreliable", "offline"]
QualityIssueType = Literal[
    "data_delay",
    "data_missing",
    "data_conflict",
    "schema_error",
    "source_offline",
    "unexpected_value",
    "duplicate_data",
    "time_sync_error",
]


def _now_dt() -> datetime:
    return datetime.now(timezone.utc)


def _now() -> str:
    return _now_dt().isoformat()


async def _require_admin(request: Request) -> dict:
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin required")
    return user


class DataSourceCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=160)
    source_type: str = Field(..., min_length=2, max_length=100)
    project: Optional[str] = Field(default=None, max_length=120)
    entity_type: Optional[str] = Field(default=None, max_length=120)
    expected_freshness_seconds: int = Field(default=300, ge=1, le=604800)
    source_of_truth: bool = False
    schema_version: Optional[str] = Field(default=None, max_length=64)
    metadata: Dict[str, Any] = Field(default_factory=dict)


class DataSourceHeartbeat(BaseModel):
    status: TrustStatus = "live"
    completeness_percent: float = Field(default=100, ge=0, le=100)
    consistency_percent: float = Field(default=100, ge=0, le=100)
    availability_percent: float = Field(default=100, ge=0, le=100)
    source_quality_percent: float = Field(default=100, ge=0, le=100)
    last_data_at: Optional[str] = None
    schema_version: Optional[str] = Field(default=None, max_length=64)
    details: Dict[str, Any] = Field(default_factory=dict)


class QualityIssueCreate(BaseModel):
    issue_type: QualityIssueType
    severity: Literal["low", "medium", "high", "critical"] = "medium"
    source_id: Optional[str] = Field(default=None, max_length=128)
    project: Optional[str] = Field(default=None, max_length=120)
    entity_type: Optional[str] = Field(default=None, max_length=120)
    entity_id: Optional[str] = Field(default=None, max_length=160)
    description: str = Field(..., min_length=3, max_length=2000)
    expected_value: Any = None
    observed_value: Any = None
    metadata: Dict[str, Any] = Field(default_factory=dict)


def _parse_iso(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
    except Exception:
        return None


def _freshness_score(last_data_at: Optional[str], expected_seconds: int) -> tuple[float, TrustStatus, Optional[float]]:
    last = _parse_iso(last_data_at)
    if not last:
        return 0.0, "offline", None
    age = max((_now_dt() - last).total_seconds(), 0)
    if age <= expected_seconds:
        return 100.0, "live", age
    if age <= expected_seconds * 2:
        return 70.0, "delayed", age
    if age <= expected_seconds * 6:
        return 35.0, "incomplete", age
    return 0.0, "offline", age


def _trust_score(freshness: float, completeness: float, consistency: float, availability: float, source_quality: float) -> float:
    return round(
        freshness * 0.25
        + completeness * 0.20
        + consistency * 0.20
        + availability * 0.20
        + source_quality * 0.15,
        1,
    )


@router.post("/admin/data-quality/sources")
async def create_source(req: DataSourceCreate, request: Request):
    admin = await _require_admin(request)
    now = _now()
    source_id = "SRC-" + secrets.token_hex(8).upper()
    doc = {
        "source_id": source_id,
        "name": req.name,
        "source_type": req.source_type,
        "project": req.project,
        "entity_type": req.entity_type,
        "expected_freshness_seconds": req.expected_freshness_seconds,
        "source_of_truth": req.source_of_truth,
        "schema_version": req.schema_version,
        "metadata": sanitize_the_eye_payload(req.metadata),
        "status": "offline",
        "trust_score": 0.0,
        "last_data_at": None,
        "last_seen_at": None,
        "created_at": now,
        "updated_at": now,
        "created_by": str(admin.get("_id") or admin.get("id") or admin.get("email")),
    }
    await db.the_eye_data_sources.insert_one(doc)
    doc.pop("_id", None)
    await broadcast_the_eye_event("data_quality.source_created", doc)
    return {"ok": True, "source": doc}


@router.post("/admin/data-quality/sources/{source_id}/heartbeat")
async def source_heartbeat(source_id: str, req: DataSourceHeartbeat, request: Request):
    await _require_admin(request)
    source = await db.the_eye_data_sources.find_one({"source_id": source_id}, {"_id": 0})
    if not source:
        raise HTTPException(status_code=404, detail="Data source not found")

    now = _now()
    last_data_at = req.last_data_at or now
    freshness, derived_status, age_seconds = _freshness_score(
        last_data_at,
        int(source.get("expected_freshness_seconds") or 300),
    )
    status = req.status if req.status in {"unreliable", "offline"} else derived_status
    trust = _trust_score(
        freshness,
        req.completeness_percent,
        req.consistency_percent,
        req.availability_percent,
        req.source_quality_percent,
    )
    assessment = {
        "source_id": source_id,
        "status": status,
        "trust_score": trust,
        "freshness_percent": freshness,
        "completeness_percent": req.completeness_percent,
        "consistency_percent": req.consistency_percent,
        "availability_percent": req.availability_percent,
        "source_quality_percent": req.source_quality_percent,
        "age_seconds": age_seconds,
        "last_data_at": last_data_at,
        "schema_version": req.schema_version or source.get("schema_version"),
        "details": sanitize_the_eye_payload(req.details),
        "recorded_at": now,
    }
    await db.the_eye_data_sources.update_one(
        {"source_id": source_id},
        {"$set": {
            "status": status,
            "trust_score": trust,
            "last_data_at": last_data_at,
            "last_seen_at": now,
            "last_assessment": assessment,
            "updated_at": now,
        }},
    )
    await db.the_eye_data_quality_assessments.insert_one(assessment)
    assessment.pop("_id", None)
    await broadcast_the_eye_event("data_quality.source", assessment)
    return {"ok": True, "assessment": assessment}


@router.post("/admin/data-quality/issues")
async def create_quality_issue(req: QualityIssueCreate, request: Request):
    admin = await _require_admin(request)
    now = _now()
    issue_id = "DQI-" + secrets.token_hex(8).upper()
    doc = {
        "issue_id": issue_id,
        "issue_type": req.issue_type,
        "severity": req.severity,
        "status": "open",
        "source_id": req.source_id,
        "project": req.project,
        "entity_type": req.entity_type,
        "entity_id": req.entity_id,
        "description": req.description,
        "expected_value": req.expected_value,
        "observed_value": req.observed_value,
        "metadata": sanitize_the_eye_payload(req.metadata),
        "created_at": now,
        "updated_at": now,
        "created_by": str(admin.get("_id") or admin.get("id") or admin.get("email")),
    }
    await db.the_eye_data_quality_issues.insert_one(doc)
    doc.pop("_id", None)
    await broadcast_the_eye_event("data_quality.issue_created", doc)
    return {"ok": True, "issue": doc}


@router.patch("/admin/data-quality/issues/{issue_id}/resolve")
async def resolve_quality_issue(issue_id: str, request: Request):
    admin = await _require_admin(request)
    now = _now()
    actor = str(admin.get("_id") or admin.get("id") or admin.get("email"))
    result = await db.the_eye_data_quality_issues.update_one(
        {"issue_id": issue_id, "status": {"$ne": "resolved"}},
        {"$set": {"status": "resolved", "resolved_at": now, "resolved_by": actor, "updated_at": now}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Open data quality issue not found")
    row = await db.the_eye_data_quality_issues.find_one({"issue_id": issue_id}, {"_id": 0})
    await broadcast_the_eye_event("data_quality.issue_resolved", row)
    return {"ok": True, "issue": row}


@router.get("/admin/data-quality/issues")
async def list_quality_issues(
    request: Request,
    status: Optional[str] = None,
    severity: Optional[str] = None,
    issue_type: Optional[str] = None,
    limit: int = Query(default=200, ge=1, le=2000),
):
    await _require_admin(request)
    query: Dict[str, Any] = {}
    if status:
        query["status"] = status
    if severity:
        query["severity"] = severity
    if issue_type:
        query["issue_type"] = issue_type
    rows = await db.the_eye_data_quality_issues.find(query, {"_id": 0}).sort("updated_at", -1).to_list(limit)
    return {"ok": True, "count": len(rows), "issues": rows}


@router.get("/admin/data-quality/overview")
async def data_quality_overview(request: Request):
    await _require_admin(request)

    sources = await db.the_eye_data_sources.find({}, {"_id": 0}).to_list(5000)
    refreshed_sources = []
    for source in sources:
        freshness, derived_status, age_seconds = _freshness_score(
            source.get("last_data_at"),
            int(source.get("expected_freshness_seconds") or 300),
        )
        last = source.get("last_assessment") or {}
        trust = _trust_score(
            freshness,
            float(last.get("completeness_percent", 100)),
            float(last.get("consistency_percent", 100)),
            float(last.get("availability_percent", 100)),
            float(last.get("source_quality_percent", 100)),
        )
        status = source.get("status") if source.get("status") in {"unreliable"} else derived_status
        refreshed_sources.append({
            **source,
            "status": status,
            "trust_score": trust,
            "freshness_percent": freshness,
            "age_seconds": age_seconds,
        })

    open_issues = await db.the_eye_data_quality_issues.find(
        {"status": {"$ne": "resolved"}},
        {"_id": 0},
    ).sort("created_at", -1).to_list(5000)

    scores = [float(row.get("trust_score") or 0) for row in refreshed_sources]
    overall_trust = round(sum(scores) / len(scores), 1) if scores else 100.0
    live_sources = sum(1 for row in refreshed_sources if row.get("status") in {"live", "verified"})
    delayed_sources = sum(1 for row in refreshed_sources if row.get("status") == "delayed")
    offline_sources = sum(1 for row in refreshed_sources if row.get("status") == "offline")
    conflicts = sum(1 for row in open_issues if row.get("issue_type") == "data_conflict")
    schema_errors = sum(1 for row in open_issues if row.get("issue_type") == "schema_error")

    return {
        "ok": True,
        "overall_trust": overall_trust,
        "sources_total": len(refreshed_sources),
        "live_sources": live_sources,
        "delayed_sources": delayed_sources,
        "offline_sources": offline_sources,
        "open_issues": len(open_issues),
        "conflicts": conflicts,
        "schema_errors": schema_errors,
        "sources": sorted(refreshed_sources, key=lambda row: float(row.get("trust_score") or 0))[:20],
        "issues": open_issues[:20],
    }


@router.get("/admin/data-quality/entity/{entity_type}/{entity_id}")
async def entity_trust(entity_type: str, entity_id: str, request: Request):
    await _require_admin(request)

    issues = await db.the_eye_data_quality_issues.find(
        {
            "entity_type": entity_type,
            "entity_id": entity_id,
            "status": {"$ne": "resolved"},
        },
        {"_id": 0},
    ).sort("created_at", -1).to_list(200)

    penalty = 0
    for issue in issues:
        penalty += {
            "low": 3,
            "medium": 8,
            "high": 20,
            "critical": 40,
        }.get(str(issue.get("severity")), 8)
    trust = max(0, 100 - penalty)

    return {
        "ok": True,
        "entity_type": entity_type,
        "entity_id": entity_id,
        "trust_score": trust,
        "open_issues": len(issues),
        "issues": issues,
    }
