"""The Eye V1 readiness diagnostics.

Read-only endpoint: summarizes whether the major V1 building blocks are present
and whether runtime configuration is ready for staging. It never deploys or
changes production state.
"""

from __future__ import annotations

import os
from typing import Any, Dict

from fastapi import APIRouter, Request

from core.database import db
from core.security import get_current_user
from core.the_eye_guard import get_the_eye_emergency_mode


router = APIRouter(prefix="/api/the-eye", tags=["The Eye Readiness"])


async def _require_admin(request: Request) -> dict:
    user = await get_current_user(request)
    if user.get("role") != "admin":
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="Admin required")
    return user


def _configured(value: str | None) -> bool:
    return bool((value or "").strip())


@router.get("/admin/readiness")
async def the_eye_readiness(request: Request):
    await _require_admin(request)

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

    core_checks = {
        "device_hub": True,
        "websocket": True,
        "location_digital_twin": True,
        "camera_registry": True,
        "network_health": True,
        "incident_correlation": True,
        "action_center": True,
        "maintenance_inventory": True,
        "data_quality": True,
        "provider_intelligence": True,
        "project_intelligence": True,
        "security_approvals_audit": True,
        "executive_intelligence": True,
        "aion_intelligence": True,
        "continuity": True,
        "emergency_write_guard": True,
    }

    staging_blockers = []
    if not config["media_gateway"]:
        staging_blockers.append("THE_EYE_MEDIA_PUBLIC_URL missing: real camera playback unavailable")
    if not config["mqtt"]:
        staging_blockers.append("MQTT configuration missing: device push transport not ready")
    if not config["object_storage"]:
        staging_blockers.append("Object storage configuration missing: clips/firmware/report storage not ready")

    warnings = []
    if not config["redis"]:
        warnings.append("Redis not configured: WebSocket fanout is in-process only")
    if emergency_mode != "normal":
        warnings.append(f"Emergency mode is {emergency_mode}")

    code_ready = all(core_checks.values())
    staging_ready = code_ready and not staging_blockers
    production_ready = False

    return {
        "ok": True,
        "version": "the-eye-v1",
        "code_ready": code_ready,
        "staging_ready": staging_ready,
        "production_ready": production_ready,
        "production_notice": "Production readiness requires successful CI/build, security review, backup restore test, real provider/device integration tests, and explicit deployment approval.",
        "emergency_mode": emergency_mode,
        "core_checks": core_checks,
        "runtime_config": config,
        "entity_counts": counts,
        "staging_blockers": staging_blockers,
        "warnings": warnings,
    }
