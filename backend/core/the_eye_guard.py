"""Shared safety guards for The Eye operator state-changing actions."""

from fastapi import HTTPException

from core.database import db


async def get_the_eye_emergency_mode() -> str:
    state = await db.the_eye_continuity_state.find_one(
        {"key": "global"},
        {"_id": 0, "mode": 1},
    )
    return str((state or {}).get("mode") or "normal")


async def require_the_eye_writes_allowed(action: str, *, allow_in_read_only: bool = False) -> str:
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
