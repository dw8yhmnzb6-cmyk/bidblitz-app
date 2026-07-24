"""
BidBlitz V2 - Session Management Routes
Track active sessions and allow session revocation.
"""

from fastapi import APIRouter, HTTPException, Request
from datetime import datetime, timezone
from core.database import db
from core.security import get_current_user
from core.audit import log_audit, AuditEvent, get_client_info
import secrets

router = APIRouter(prefix="/api/sessions", tags=["sessions"])


async def create_session(user_id: str, email: str, ip: str, user_agent: str) -> str:
    """Create a new session record. Returns session_id."""
    session_id = secrets.token_hex(16)
    await db.sessions.insert_one({
        "session_id": session_id,
        "user_id": user_id,
        "email": email,
        "ip": ip,
        "user_agent": user_agent[:256] if user_agent else "",
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "last_active": datetime.now(timezone.utc).isoformat(),
    })
    return session_id


async def revoke_session(session_id: str):
    """Mark a session as inactive."""
    await db.sessions.update_one(
        {"session_id": session_id},
        {"$set": {"is_active": False, "revoked_at": datetime.now(timezone.utc).isoformat()}},
    )


async def revoke_all_sessions(user_id: str, except_session: str = None):
    """Revoke all sessions for a user, optionally keeping current one."""
    query = {"user_id": user_id, "is_active": True}
    if except_session:
        query["session_id"] = {"$ne": except_session}
    await db.sessions.update_many(
        query,
        {"$set": {"is_active": False, "revoked_at": datetime.now(timezone.utc).isoformat()}},
    )


@router.get("")
async def list_sessions(request: Request):
    """List active sessions for current user."""
    user = await get_current_user(request)
    user_id = str(user["_id"])

    sessions = await db.sessions.find(
        {"user_id": user_id, "is_active": True},
        {"_id": 0, "session_id": 1, "ip": 1, "user_agent": 1, "created_at": 1, "last_active": 1},
    ).sort("last_active", -1).to_list(50)

    return {"sessions": sessions, "count": len(sessions)}


@router.post("/revoke-all")
async def revoke_all(request: Request):
    """Logout from all devices."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    ip, ua = get_client_info(request)

    await revoke_all_sessions(user_id)
    await log_audit(AuditEvent.SESSION_REVOKED, user_id=user_id, email=user["email"], ip=ip, user_agent=ua,
                    details={"action": "revoke_all"})

    return {"success": True, "message": "All sessions revoked"}


@router.post("/revoke/{session_id}")
async def revoke_single(session_id: str, request: Request):
    """Revoke a specific session."""
    user = await get_current_user(request)
    user_id = str(user["_id"])

    session = await db.sessions.find_one({"session_id": session_id, "user_id": user_id})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    await revoke_session(session_id)
    ip, ua = get_client_info(request)
    await log_audit(AuditEvent.SESSION_REVOKED, user_id=user_id, email=user["email"], ip=ip, user_agent=ua,
                    details={"revoked_session": session_id})

    return {"success": True, "message": "Session revoked"}
