"""Evidence-based readiness diagnostics for The Eye V1.

Readiness is fail-closed: code/staging status is derived from explicit test
evidence and runtime configuration, never from hard-coded True flags.
"""

from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Any, Dict, Literal, Optional

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from core.database import db
from core.the_eye_access import require_the_eye_access
from core.the_eye_data_safety import sanitize_the_eye_payload
from core.the_eye_guard import get_the_eye_emergency_mode


router = APIRouter(prefix="/api/the-eye", tags=["The Eye Readiness"])

EvidenceStatus = Literal["passed", "failed", "pending"]

CODE_EVIDENCE_KEYS = (
    "backend_ci",
    "frontend_lint",
    "frontend_build",
    "rbac_scope",
    "tenant_isolation",
    "secret_redaction",
    "command_lifecycle",
    "incident_state_machine",
    "approval_four_eyes",
    "emergency_modes",
    "database_constraints",
)

STAGING_EVIDENCE_KEYS = (
    "camera_live",
    "mqtt_integration",
    "object_storage_integration",
    "backup_restore",
    "failover_drill",
    "integration_tests",
    "e2e",
    "security_review",
)


class ReadinessEvidenceUpdate(BaseModel):
    key: str = Field(..., min_length=2, max_length=120)
    status: EvidenceStatus
    source: str = Field(..., min_length=2, max_length=160)
    reference: Optional[str] = Field(default=None, max_length=500)
    tested_at: Optional[str] = None
    expires_at: Optional[str] = None
    details: Dict[str, Any] = Field(default_factory=dict)


async def _require_reader(request: Request):
    return await require_the_eye_access(request, {"super_admin", "admin"})


async def _require_super_admin(request: Request):
    return await require_the_eye_access(request, {"super_admin"})


def _configured(value: str | None) -> bool:
    return bool((value or "").strip())


def _now_dt() -> datetime:
    return datetime.now(timezone.utc)


def _now() -> str:
    return _now_dt().isoformat()


def _parse_time(value: Any) -> Optional[datetime]:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return parsed.astimezone(timezone.utc)
    except (TypeError, ValueError):
        return None


def _evidence_state(row: Optional[dict], now: datetime) -> str:
    if not row:
        return "missing"
    if row.get("status") != "passed":
        return str(row.get("status") or "pending")
    expires_at = _parse_time(row.get("expires_at"))
    if expires_at and expires_at <= now:
        return "expired"
    return "passed"


async def _load_evidence() -> Dict[str, dict]:
    rows = await db.the_eye_readiness_evidence.find({}, {"_id": 0}).to_list(500)
    return {str(row.get("key")): row for row in rows if row.get("key")}


def _evidence_checks(
    evidence: Dict[str, dict],
    keys: tuple[str, ...],
    now: datetime,
) -> Dict[str, dict]:
    checks: Dict[str, dict] = {}
    for key in keys:
        row = evidence.get(key)
        state = _evidence_state(row, now)
        checks[key] = {
            "passed": state == "passed",
            "state": state,
            "source": (row or {}).get("source"),
            "reference": (row or {}).get("reference"),
            "tested_at": (row or {}).get("tested_at"),
            "expires_at": (row or {}).get("expires_at"),
        }
    return checks


@router.post("/admin/readiness/evidence")
async def record_readiness_evidence(req: ReadinessEvidenceUpdate, request: Request):
    access = await _require_super_admin(request)
    allowed = set(CODE_EVIDENCE_KEYS) | set(STAGING_EVIDENCE_KEYS)
    if req.key not in allowed:
        raise HTTPException(status_code=400, detail="Unknown readiness evidence key")

    now = _now()
    tested_at = req.tested_at or now
    doc = {
        "key": req.key,
        "status": req.status,
        "source": req.source,
        "reference": req.reference,
        "tested_at": tested_at,
        "expires_at": req.expires_at,
        "details": sanitize_the_eye_payload(req.details),
        "updated_at": now,
        "updated_by": access.actor_id,
    }
    await db.the_eye_readiness_evidence.update_one(
        {"key": req.key},
        {"$set": doc},
        upsert=True,
    )
    await db.the_eye_readiness_evidence_history.insert_one({
        **doc,
        "recorded_at": now,
    })
    return {"ok": True, "evidence": doc}


@router.get("/admin/readiness/evidence")
async def list_readiness_evidence(request: Request):
    await _require_reader(request)
    rows = await db.the_eye_readiness_evidence.find(
        {},
        {"_id": 0},
    ).sort("key", 1).to_list(500)
    return {"ok": True, "count": len(rows), "evidence": rows}


@router.get("/admin/readiness")
async def the_eye_readiness(request: Request):
    await _require_reader(request)
    now_dt = _now_dt()
    emergency_mode = await get_the_eye_emergency_mode()

    counts = {
        "devices": await db.the_eye_devices.count_documents({}),
        "cameras": await db.the_eye_cameras.count_documents({}),
        "locations": await db.the_eye_locations.count_documents({"status": {"$ne": "deleted"}}),
        "network_nodes": await db.the_eye_network_nodes.count_documents({"status": {"$ne": "disabled"}}),
        "incidents": await db.the_eye_incidents.count_documents({}),
        "projects": await db.the_eye_projects.count_documents({}),
        "providers": await db.the_eye_providers.count_documents({}),
        "data_sources": await db.the_eye_data_sources.count_documents({}),
        "inventory_items": await db.the_eye_inventory.count_documents({}),
        "audit_logs": await db.the_eye_audit_logs.count_documents({}),
    }

    config = {
        "media_gateway": _configured(os.getenv("THE_EYE_MEDIA_PUBLIC_URL")),
        "livekit": _configured(os.getenv("LIVEKIT_URL")) and _configured(os.getenv("LIVEKIT_API_KEY")),
        "redis": _configured(os.getenv("REDIS_URL")),
        "mqtt": _configured(os.getenv("MQTT_URL")) or _configured(os.getenv("THE_EYE_MQTT_URL")),
        "object_storage": (
            _configured(os.getenv("S3_BUCKET"))
            or _configured(os.getenv("AWS_S3_BUCKET"))
            or _configured(os.getenv("OBJECT_STORAGE_BUCKET"))
        ),
    }

    evidence = await _load_evidence()
    code_checks = _evidence_checks(evidence, CODE_EVIDENCE_KEYS, now_dt)
    staging_checks = _evidence_checks(evidence, STAGING_EVIDENCE_KEYS, now_dt)

    code_ready = all(item["passed"] for item in code_checks.values())
    staging_evidence_ready = all(item["passed"] for item in staging_checks.values())

    staging_blockers = []
    for key, item in code_checks.items():
        if not item["passed"]:
            staging_blockers.append(f"Code evidence {key}: {item['state']}")
    for key, item in staging_checks.items():
        if not item["passed"]:
            staging_blockers.append(f"Staging evidence {key}: {item['state']}")

    if not config["media_gateway"]:
        staging_blockers.append("THE_EYE_MEDIA_PUBLIC_URL missing: real camera playback unavailable")
    if not config["mqtt"]:
        staging_blockers.append("MQTT configuration missing: device push transport not ready")
    if not config["object_storage"]:
        staging_blockers.append("Object storage configuration missing: clips/firmware/report storage not ready")
    if emergency_mode != "normal":
        staging_blockers.append(f"Emergency mode must be normal, current: {emergency_mode}")

    warnings = []
    if not config["redis"]:
        warnings.append("Redis not configured: WebSocket fanout is in-process only")
    if not config["livekit"]:
        warnings.append("LiveKit is not configured; media gateway may use another supported backend")

    staging_ready = (
        code_ready
        and staging_evidence_ready
        and config["media_gateway"]
        and config["mqtt"]
        and config["object_storage"]
        and emergency_mode == "normal"
    )
    production_ready = False

    return {
        "ok": True,
        "version": "the-eye-v1",
        "code_ready": code_ready,
        "staging_ready": staging_ready,
        "production_ready": production_ready,
        "production_notice": (
            "Production remains fail-closed until successful CI/build evidence, "
            "security review, restore/failover drills, real integrations, hardware "
            "pilot, rollback test, staging sign-off and explicit production approval "
            "are complete."
        ),
        "emergency_mode": emergency_mode,
        "core_checks": {key: item["passed"] for key, item in code_checks.items()},
        "code_checks": code_checks,
        "staging_checks": staging_checks,
        "runtime_config": config,
        "entity_counts": counts,
        "staging_blockers": staging_blockers,
        "warnings": warnings,
    }
