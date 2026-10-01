"""Shared safety guards for The Eye state-changing actions."""

from __future__ import annotations

import re
from typing import Literal

from fastapi import HTTPException

from core.database import db


TheEyeWriteClass = Literal["read", "observation", "recovery", "control"]

_WRITE_METHODS = frozenset({"POST", "PUT", "PATCH", "DELETE"})
_RECOVERY_PATHS = frozenset({
    "/api/the-eye/admin/continuity/emergency-mode",
})

_OBSERVATION_PATTERNS = (
    re.compile(r"^/api/the-eye/devices/[^/]+/(heartbeat|location|telemetry|commands/ack)$"),
    re.compile(r"^/api/the-eye/admin/cameras/[^/]+/(health|events|stream-session)$"),
    re.compile(r"^/api/the-eye/admin/aion/query$"),
    re.compile(r"^/api/the-eye/admin/network/nodes/[^/]+/(health|ports)$"),
    re.compile(r"^/api/the-eye/admin/data-quality/sources/[^/]+/heartbeat$"),
    re.compile(r"^/api/the-eye/admin/data-quality/issues$"),
    re.compile(r"^/api/the-eye/connectors/[^/]+/(snapshot|events)$"),
    re.compile(r"^/api/the-eye/admin/security/events$"),
    re.compile(r"^/api/the-eye/admin/continuity/(backups|failover|drills)$"),
)


def classify_the_eye_write(path: str, method: str) -> TheEyeWriteClass:
    normalized_method = str(method or "").upper()
    normalized_path = str(path or "").rstrip("/") or "/"
    if normalized_method not in _WRITE_METHODS:
        return "read"
    if normalized_path in _RECOVERY_PATHS:
        return "recovery"
    if any(pattern.match(normalized_path) for pattern in _OBSERVATION_PATTERNS):
        return "observation"
    return "control"


async def get_the_eye_emergency_mode() -> str:
    state = await db.the_eye_continuity_state.find_one(
        {"key": "global"},
        {"_id": 0, "mode": 1},
    )
    return str((state or {}).get("mode") or "normal")


async def require_the_eye_writes_allowed(
    action: str,
    *,
    allow_in_read_only: bool = False,
) -> str:
    mode = await get_the_eye_emergency_mode()
    if mode == "lockdown":
        raise HTTPException(
            status_code=423,
            detail=f"The Eye is in LOCKDOWN; action blocked: {action}",
        )
    if mode == "read_only" and not allow_in_read_only:
        raise HTTPException(
            status_code=423,
            detail=f"The Eye is READ_ONLY; action blocked: {action}",
        )
    return mode
