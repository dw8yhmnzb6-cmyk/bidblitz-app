"""
BidBlitz V2 - Audit Logging Module
Structured internal logging for security-sensitive actions.
"""

from datetime import datetime, timezone
from core.database import db
import logging

logger = logging.getLogger("bidblitz.audit")

# Audit event types
class AuditEvent:
    LOGIN_SUCCESS = "login_success"
    LOGIN_FAILED = "login_failed"
    LOGIN_LOCKED = "login_locked"
    REGISTER = "register"
    LOGOUT = "logout"
    PASSWORD_CHANGE = "password_change"
    PAYMENT_INITIATED = "payment_initiated"
    PAYMENT_SUCCESS = "payment_success"
    PAYMENT_FAILED = "payment_failed"
    SEND_SUCCESS = "send_success"
    SEND_FAILED = "send_failed"
    TOPUP_INITIATED = "topup_initiated"
    TOPUP_SUCCESS = "topup_success"
    PAYOUT_REQUESTED = "payout_requested"
    PAYOUT_CANCELLED = "payout_cancelled"
    PAYOUT_ACTION = "payout_action"
    ADMIN_ACTION = "admin_action"
    SESSION_CREATED = "session_created"
    SESSION_REVOKED = "session_revoked"
    SUSPICIOUS_ACTIVITY = "suspicious_activity"


async def log_audit(
    event: str,
    user_id: str = "",
    email: str = "",
    ip: str = "",
    user_agent: str = "",
    details: dict = None,
    severity: str = "info",
):
    """Write a structured audit log entry."""
    entry = {
        "event": event,
        "user_id": user_id,
        "email": email,
        "ip": ip,
        "user_agent": user_agent[:256] if user_agent else "",
        "details": details or {},
        "severity": severity,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    try:
        await db.audit_logs.insert_one(entry)
    except Exception as e:
        logger.error(f"Audit log write failed: {e}")
    # Also log to stdout for container log aggregation
    logger.info(f"AUDIT [{severity.upper()}] {event} user={user_id or email} ip={ip}")


def get_client_info(request):
    """Extract IP and user-agent from request."""
    ip = request.client.host if request.client else "unknown"
    ua = request.headers.get("user-agent", "")
    return ip, ua
