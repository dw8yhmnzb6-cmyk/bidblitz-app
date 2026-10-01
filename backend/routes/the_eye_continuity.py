"""The Eye disaster recovery, backup health, failover and emergency mode."""

from __future__ import annotations

import secrets
from datetime import datetime, timezone
from typing import Any, Dict, Literal, Optional

from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel, Field

from core.database import db
from core.the_eye_access import require_the_eye_access
from core.the_eye_live import broadcast_the_eye_event


router = APIRouter(prefix="/api/the-eye", tags=["The Eye Continuity"])

BackupTier = Literal["tier1", "tier2", "tier3"]
RecoveryStatus = Literal["healthy", "warning", "degraded", "failed", "unknown"]
EmergencyMode = Literal["normal", "read_only", "lockdown"]


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


async def _require_admin(request: Request) -> dict:
    access = await require_the_eye_access(request, {"super_admin", "admin"})
    return dict(access.user)


async def _require_super_admin(request: Request):
    return await require_the_eye_access(request, {"super_admin"})


class BackupReportCreate(BaseModel):
    service: str = Field(..., min_length=2, max_length=160)
    tier: BackupTier
    status: RecoveryStatus
    backup_type: str = Field(..., min_length=2, max_length=120)
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    size_bytes: Optional[int] = Field(default=None, ge=0)
    storage_target: Optional[str] = Field(default=None, max_length=240)
    checksum: Optional[str] = Field(default=None, max_length=256)
    rpo_minutes: Optional[int] = Field(default=None, ge=0, le=100000)
    rto_minutes: Optional[int] = Field(default=None, ge=0, le=100000)
    restore_tested_at: Optional[str] = None
    details: Dict[str, Any] = Field(default_factory=dict)


class FailoverReportCreate(BaseModel):
    service: str = Field(..., min_length=2, max_length=160)
    primary: str = Field(..., min_length=2, max_length=240)
    secondary: Optional[str] = Field(default=None, max_length=240)
    status: RecoveryStatus = "unknown"
    automatic_failover: bool = False
    last_tested_at: Optional[str] = None
    actual_recovery_seconds: Optional[int] = Field(default=None, ge=0)
    expected_recovery_seconds: Optional[int] = Field(default=None, ge=0)
    details: Dict[str, Any] = Field(default_factory=dict)


class RecoveryDrillCreate(BaseModel):
    drill_type: Literal[
        "database_restore",
        "server_failover",
        "internet_failover",
        "provider_failover",
        "mqtt_failure",
        "power_failure",
        "edge_offline",
        "deployment_rollback",
        "firmware_rollback",
    ]
    service: Optional[str] = Field(default=None, max_length=160)
    status: Literal["passed", "partial", "failed"]
    expected_recovery_seconds: Optional[int] = Field(default=None, ge=0)
    actual_recovery_seconds: Optional[int] = Field(default=None, ge=0)
    data_loss_seconds: Optional[int] = Field(default=None, ge=0)
    notes: Optional[str] = Field(default=None, max_length=4000)


class EmergencyModeUpdate(BaseModel):
    mode: EmergencyMode
    reason: str = Field(..., min_length=3, max_length=2000)


@router.post("/admin/continuity/backups")
async def create_backup_report(req: BackupReportCreate, request: Request):
    admin = await _require_admin(request)
    now = _now()
    backup_id = "BKP-" + secrets.token_hex(8).upper()
    doc = {
        "backup_id": backup_id,
        "service": req.service,
        "tier": req.tier,
        "status": req.status,
        "backup_type": req.backup_type,
        "started_at": req.started_at,
        "completed_at": req.completed_at or now,
        "size_bytes": req.size_bytes,
        "storage_target": req.storage_target,
        "checksum": req.checksum,
        "rpo_minutes": req.rpo_minutes,
        "rto_minutes": req.rto_minutes,
        "restore_tested_at": req.restore_tested_at,
        "details": req.details,
        "created_at": now,
        "created_by": str(admin.get("_id") or admin.get("id") or admin.get("email")),
    }
    await db.the_eye_backups.insert_one(doc)
    doc.pop("_id", None)
    await broadcast_the_eye_event("continuity.backup", doc)
    return {"ok": True, "backup": doc}


@router.get("/admin/continuity/backups")
async def list_backup_reports(
    request: Request,
    tier: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = Query(default=200, ge=1, le=2000),
):
    await _require_admin(request)
    query: Dict[str, Any] = {}
    if tier:
        query["tier"] = tier
    if status:
        query["status"] = status
    rows = await db.the_eye_backups.find(query, {"_id": 0}).sort("completed_at", -1).to_list(limit)
    return {"ok": True, "count": len(rows), "backups": rows}


@router.post("/admin/continuity/failover")
async def create_failover_report(req: FailoverReportCreate, request: Request):
    admin = await _require_admin(request)
    now = _now()
    failover_id = "FOV-" + secrets.token_hex(8).upper()
    doc = {
        "failover_id": failover_id,
        "service": req.service,
        "primary": req.primary,
        "secondary": req.secondary,
        "status": req.status,
        "automatic_failover": req.automatic_failover,
        "last_tested_at": req.last_tested_at,
        "actual_recovery_seconds": req.actual_recovery_seconds,
        "expected_recovery_seconds": req.expected_recovery_seconds,
        "details": req.details,
        "created_at": now,
        "created_by": str(admin.get("_id") or admin.get("id") or admin.get("email")),
    }
    await db.the_eye_failover.insert_one(doc)
    doc.pop("_id", None)
    await broadcast_the_eye_event("continuity.failover", doc)
    return {"ok": True, "failover": doc}


@router.post("/admin/continuity/drills")
async def create_recovery_drill(req: RecoveryDrillCreate, request: Request):
    admin = await _require_admin(request)
    now = _now()
    drill_id = "DRL-" + secrets.token_hex(8).upper()
    doc = {
        "drill_id": drill_id,
        "drill_type": req.drill_type,
        "service": req.service,
        "status": req.status,
        "expected_recovery_seconds": req.expected_recovery_seconds,
        "actual_recovery_seconds": req.actual_recovery_seconds,
        "data_loss_seconds": req.data_loss_seconds,
        "notes": req.notes,
        "created_at": now,
        "created_by": str(admin.get("_id") or admin.get("id") or admin.get("email")),
    }
    await db.the_eye_recovery_drills.insert_one(doc)
    doc.pop("_id", None)
    await broadcast_the_eye_event("continuity.drill", doc)
    return {"ok": True, "drill": doc}


@router.patch("/admin/continuity/emergency-mode")
async def update_emergency_mode(req: EmergencyModeUpdate, request: Request):
    access = await _require_super_admin(request)
    now = _now()
    actor = access.actor_id

    doc = {
        "key": "global",
        "mode": req.mode,
        "reason": req.reason,
        "updated_at": now,
        "updated_by": actor,
    }
    await db.the_eye_continuity_state.update_one(
        {"key": "global"},
        {"$set": doc},
        upsert=True,
    )
    await broadcast_the_eye_event("continuity.emergency_mode", doc)
    return {"ok": True, "state": doc}


@router.get("/admin/continuity/overview")
async def continuity_overview(request: Request):
    await _require_admin(request)

    backups = await db.the_eye_backups.find({}, {"_id": 0}).sort("completed_at", -1).to_list(1000)
    failovers = await db.the_eye_failover.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    drills = await db.the_eye_recovery_drills.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    state = await db.the_eye_continuity_state.find_one({"key": "global"}, {"_id": 0}) or {
        "key": "global",
        "mode": "normal",
        "reason": None,
        "updated_at": None,
        "updated_by": None,
    }

    latest_per_service: Dict[str, dict] = {}
    for backup in backups:
        service = str(backup.get("service") or "unknown")
        if service not in latest_per_service:
            latest_per_service[service] = backup

    latest_backups = list(latest_per_service.values())
    backup_failed = sum(1 for row in latest_backups if row.get("status") == "failed")
    backup_warning = sum(1 for row in latest_backups if row.get("status") in {"warning", "degraded", "unknown"})
    restore_untested = sum(1 for row in latest_backups if not row.get("restore_tested_at"))
    failover_failed = sum(1 for row in failovers if row.get("status") == "failed")
    without_secondary = sum(1 for row in failovers if not row.get("secondary"))
    drill_failed = sum(1 for row in drills[:100] if row.get("status") == "failed")

    score = 100
    score -= backup_failed * 20
    score -= backup_warning * 8
    score -= restore_untested * 5
    score -= failover_failed * 15
    score -= without_secondary * 8
    score -= drill_failed * 10
    score = max(0, min(score, 100))

    if score >= 90:
        health = "healthy"
    elif score >= 70:
        health = "warning"
    elif score >= 40:
        health = "degraded"
    else:
        health = "failed"

    return {
        "ok": True,
        "continuity_score": score,
        "status": health,
        "emergency_mode": state,
        "backup_services": len(latest_backups),
        "backup_failed": backup_failed,
        "backup_warning": backup_warning,
        "restore_untested": restore_untested,
        "failover_records": len(failovers),
        "failover_failed": failover_failed,
        "without_secondary": without_secondary,
        "drills_total": len(drills),
        "drill_failed": drill_failed,
        "backups": latest_backups[:20],
        "failovers": failovers[:20],
        "drills": drills[:20],
    }
