"""
BidBlitz V2 - Audit Logging Module
Structured internal logging for security-sensitive actions.
Includes admin alert system for critical events.
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
    PROFILE_UPDATE = "profile_update"
    PAYMENT_INITIATED = "payment_initiated"
    PAYMENT_SUCCESS = "payment_success"
    PAYMENT_FAILED = "payment_failed"
    SEND_SUCCESS = "send_success"
    SEND_FAILED = "send_failed"
    TOPUP_INITIATED = "topup_initiated"
    TOPUP_SUCCESS = "topup_success"
    TOPUP_FAILED = "topup_failed"
    PAYOUT_REQUESTED = "payout_requested"
    PAYOUT_CANCELLED = "payout_cancelled"
    PAYOUT_ACTION = "payout_action"
    MERCHANT_PAYMENT_SUCCESS = "merchant_payment_success"
    MERCHANT_PAYMENT_FAILED = "merchant_payment_failed"
    ADMIN_ACTION = "admin_action"
    SESSION_CREATED = "session_created"
    SESSION_REVOKED = "session_revoked"
    SUSPICIOUS_ACTIVITY = "suspicious_activity"


# Events that trigger admin alerts
_ALERT_EVENTS = {
    AuditEvent.PAYMENT_FAILED: "Payment Failed",
    AuditEvent.SEND_FAILED: "Send Failed",
    AuditEvent.TOPUP_FAILED: "Top-up Failed",
    AuditEvent.PAYOUT_CANCELLED: "Payout Cancelled",
    AuditEvent.SUSPICIOUS_ACTIVITY: "Suspicious Activity",
    AuditEvent.LOGIN_LOCKED: "Account Locked",
    "system_error": "System Error",
}


async def _notify_admins(event: str, email: str, details: dict, severity: str):
    """Send in-app notification to all admin users for critical events."""
    title = _ALERT_EVENTS.get(event)
    if not title:
        return
    try:
        reason = details.get("reason", "")
        amount = details.get("amount", "")
        parts = [f"[{severity.upper()}] {title}"]
        if email:
            parts.append(f"User: {email}")
        if amount:
            parts.append(f"Amount: EUR {amount}")
        if reason:
            parts.append(f"Reason: {reason}")
        message = " | ".join(parts)

        admins = await db.users.find({"role": "admin"}, {"_id": 1}).to_list(50)
        if not admins:
            return
        now = datetime.now(timezone.utc).isoformat()
        notifications = [
            {
                "user_id": str(a["_id"]),
                "type": "admin_alert",
                "title": f"Alert: {title}",
                "message": message,
                "read": False,
                "created_at": now,
            }
            for a in admins
        ]
        await db.notifications.insert_many(notifications)
    except Exception as e:
        logger.error(f"Admin alert failed: {e}")


async def log_audit(
    event: str,
    user_id: str = "",
    email: str = "",
    ip: str = "",
    user_agent: str = "",
    details: dict = None,
    severity: str = "info",
):
    """Write a structured audit log entry and alert admins on critical events."""
    details = details or {}
    entry = {
        "event": event,
        "user_id": user_id,
        "email": email,
        "ip": ip,
        "user_agent": user_agent[:256] if user_agent else "",
        "details": details,
        "severity": severity,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    try:
        await db.audit_logs.insert_one(entry)
    except Exception as e:
        logger.error(f"Audit log write failed: {e}")
    # Also log to stdout for container log aggregation
    logger.info(f"AUDIT [{severity.upper()}] {event} user={user_id or email} ip={ip}")

    # Fire admin alerts for critical events
    if event in _ALERT_EVENTS:
        await _notify_admins(event, email, details, severity)


def get_client_info(request):
    """Extract IP and user-agent from request."""
    ip = request.client.host if request.client else "unknown"
    ua = request.headers.get("user-agent", "")
    return ip, ua
