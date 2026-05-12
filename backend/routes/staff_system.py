"""
BidBlitz Staff - System Health, Version, Status
================================================
"""
from fastapi import APIRouter, Request
from datetime import datetime, timezone
import os
from motor.motor_asyncio import AsyncIOMotorClient

router = APIRouter(prefix="/api/staff", tags=["staff-system"])
client = AsyncIOMotorClient(os.getenv("MONGO_URL"))
db = client[os.getenv("DB_NAME", "bidblitz")]

STAFF_MODULE_VERSION = "1.0.0"
BUILD_VERSION = os.getenv("BUILD_VERSION", "dev")


@router.get("/health")
async def health():
    try:
        await db.command("ping")
        mongo_ok = True
    except Exception as e:
        mongo_ok = False
    return {
        "status": "ok" if mongo_ok else "degraded",
        "mongo": mongo_ok,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/version")
async def version():
    return {
        "module": "BidBlitz Staff",
        "version": STAFF_MODULE_VERSION,
        "build": BUILD_VERSION,
        "released_at": "2026-05-12",
    }


@router.get("/system-status")
async def system_status(request: Request):
    """Aggregated status used by /staff/system-check page."""
    try:
        await db.command("ping")
        mongo_ok = True
        collection_counts = {
            "members": await db.staff_members.count_documents({}),
            "clock_events": await db.staff_clock_events.count_documents({}),
            "shifts": await db.staff_shifts.count_documents({}),
            "subscriptions": await db.staff_subscriptions.count_documents({}),
            "warnings_open": await db.staff_warnings.count_documents({"resolved": False}),
            "invites_pending": await db.staff_invites.count_documents({"status": "pending"}),
            "notifications_unread": await db.staff_notifications.count_documents({"read": False}),
            "audit_log_entries": await db.staff_audit_log.count_documents({}),
        }
    except Exception:
        mongo_ok = False
        collection_counts = {}

    auth_ok = True
    try:
        from routes.auth import get_current_user as _  # noqa: F401
    except Exception:
        auth_ok = False

    flags = {
        "staff_module_enabled": os.getenv("STAFF_MODULE_ENABLED", "true").lower() == "true",
        "staff_trial_enabled": os.getenv("STAFF_TRIAL_ENABLED", "true").lower() == "true",
        "staff_subscription_required": os.getenv("STAFF_SUBSCRIPTION_REQUIRED", "true").lower() == "true",
        "staff_demo_enabled": os.getenv("STAFF_DEMO_ENABLED", "true").lower() == "true",
        "magic_url_in_body": os.getenv("STAFF_DEV_RETURN_MAGIC_URL", "true").lower() == "true",
    }

    integrations = {
        "stripe_keys_present": bool(os.getenv("STRIPE_API_KEY") or os.getenv("STRIPE_SECRET_KEY")),
        "stripe_live_mode": (os.getenv("STRIPE_API_KEY") or os.getenv("STRIPE_SECRET_KEY") or "").startswith("sk_live_"),
        "resend_configured": bool(os.getenv("RESEND_API_KEY")),
        "twilio_configured": bool(os.getenv("TWILIO_ACCOUNT_SID")),
        "onesignal_configured": bool(os.getenv("ONESIGNAL_APP_ID") and os.getenv("ONESIGNAL_API_KEY")),
        "livekit_configured": bool(os.getenv("LIVEKIT_API_KEY")),
    }

    return {
        "success": True,
        "version": STAFF_MODULE_VERSION,
        "build": BUILD_VERSION,
        "mongo_ok": mongo_ok,
        "auth_ok": auth_ok,
        "collections": collection_counts,
        "feature_flags": flags,
        "integrations": integrations,
        "checked_at": datetime.now(timezone.utc).isoformat(),
    }
