"""
BidBlitz Staff - Subscription & Paywall Management
===================================================
Trial Logic, Plan Management, Stripe Checkout Placeholder, Admin Controls

Collection: staff_subscriptions
Fields:
  id, merchant_id, plan, status, trial_start, trial_end,
  current_period_start, current_period_end, max_staff, features,
  created_at, updated_at

Status: trialing | active | expired | cancelled
Plans:  basic | pro | enterprise
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional, Literal
from datetime import datetime, timedelta, timezone
from uuid import uuid4
import os
import logging

router = APIRouter(prefix="/api/staff/subscription", tags=["staff-subscription"])
logger = logging.getLogger("bidblitz.staff_subscription")

from motor.motor_asyncio import AsyncIOMotorClient
MONGO_URL = os.getenv("MONGO_URL")
client = AsyncIOMotorClient(MONGO_URL)
db = client[os.getenv("DB_NAME", "bidblitz")]

# ───────────────────────────────────────────────────────────────────────────
# Plans Configuration
# ───────────────────────────────────────────────────────────────────────────
STAFF_PLANS = {
    "basic": {
        "name": "Basic",
        "price_eur": 4.99,
        "max_staff": 5,
        "features": ["time_tracking", "shifts", "leave_management", "basic_reports"],
    },
    "pro": {
        "name": "Pro",
        "price_eur": 9.99,
        "max_staff": 20,
        "features": [
            "time_tracking", "shifts", "leave_management", "basic_reports",
            "qr_checkin", "gps_geofencing", "advanced_reports", "payroll_export",
            "manager_approval",
        ],
    },
    "enterprise": {
        "name": "Enterprise",
        "price_eur": None,  # On request
        "max_staff": 9999,
        "features": ["all"],
    },
}

TRIAL_DAYS = 30


# ───────────────────────────────────────────────────────────────────────────
# Auth Helpers
# ───────────────────────────────────────────────────────────────────────────
async def get_current_user(request: Request):
    from routes.auth import get_current_user as auth_user
    return await auth_user(request)


async def require_merchant_or_admin(request: Request) -> dict:
    user = await get_current_user(request)
    if user.get("role") not in ("merchant", "admin"):
        raise HTTPException(403, "Nur für Händler oder Administratoren")
    return user


async def require_admin(request: Request) -> dict:
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(403, "Nur für Administratoren")
    return user


def _merchant_id_from_user(user: dict) -> str:
    return str(user.get("user_id") or user.get("id") or user.get("_id"))


# ───────────────────────────────────────────────────────────────────────────
# Models
# ───────────────────────────────────────────────────────────────────────────
class StartTrialReq(BaseModel):
    pass


class CheckoutReq(BaseModel):
    plan: Literal["basic", "pro", "enterprise"]
    success_url: Optional[str] = None
    cancel_url: Optional[str] = None


class AdminOverrideReq(BaseModel):
    merchant_id: str
    plan: Optional[Literal["basic", "pro", "enterprise"]] = None
    status: Optional[Literal["trialing", "active", "expired", "cancelled"]] = None
    extend_trial_days: Optional[int] = None
    max_staff_override: Optional[int] = None
    enabled: Optional[bool] = None


class AdminModuleToggleReq(BaseModel):
    merchant_id: str
    enabled: bool


# ───────────────────────────────────────────────────────────────────────────
# Core Logic
# ───────────────────────────────────────────────────────────────────────────
def _serialize(doc: dict) -> dict:
    if not doc:
        return doc
    doc.pop("_id", None)
    return doc


async def _refresh_status(sub: dict) -> dict:
    """Auto-expire trial if past trial_end."""
    if not sub:
        return sub
    if sub.get("status") == "trialing" and sub.get("trial_end"):
        try:
            te = datetime.fromisoformat(sub["trial_end"].replace("Z", "+00:00"))
            if datetime.now(timezone.utc) > te:
                sub["status"] = "expired"
                await db.staff_subscriptions.update_one(
                    {"id": sub["id"]},
                    {"$set": {"status": "expired", "updated_at": datetime.now(timezone.utc).isoformat()}}
                )
        except Exception as e:
            logger.warning(f"Trial expiry parse failed: {e}")
    if sub.get("status") == "active" and sub.get("current_period_end"):
        try:
            cpe = datetime.fromisoformat(sub["current_period_end"].replace("Z", "+00:00"))
            if datetime.now(timezone.utc) > cpe:
                sub["status"] = "expired"
                await db.staff_subscriptions.update_one(
                    {"id": sub["id"]},
                    {"$set": {"status": "expired", "updated_at": datetime.now(timezone.utc).isoformat()}}
                )
        except Exception:
            pass
    return sub


async def get_subscription_for_merchant(merchant_id: str) -> Optional[dict]:
    sub = await db.staff_subscriptions.find_one({"merchant_id": merchant_id}, {"_id": 0})
    if sub:
        sub = await _refresh_status(sub)
    return sub


async def is_module_active(merchant_id: str) -> bool:
    """Returns True if merchant currently has access (trialing or active)."""
    sub = await get_subscription_for_merchant(merchant_id)
    if not sub:
        return False
    if not sub.get("enabled", True):
        return False
    return sub.get("status") in ("trialing", "active")


async def get_max_staff(merchant_id: str) -> int:
    sub = await get_subscription_for_merchant(merchant_id)
    if not sub:
        return 0
    if sub.get("max_staff_override"):
        return int(sub["max_staff_override"])
    return int(sub.get("max_staff", 0))


# ───────────────────────────────────────────────────────────────────────────
# Endpoints – Merchant
# ───────────────────────────────────────────────────────────────────────────
@router.get("/status")
async def get_subscription_status(request: Request):
    """Aktueller Subscription-Status für eingeloggten Merchant."""
    user = await require_merchant_or_admin(request)
    merchant_id = _merchant_id_from_user(user)
    sub = await get_subscription_for_merchant(merchant_id)

    if not sub:
        return {
            "success": True,
            "has_subscription": False,
            "active": False,
            "plan": None,
            "status": None,
            "trial_available": True,
            "message": "Staff-Modul noch nicht aktiviert",
        }

    # Count current staff
    staff_count = await db.staff_members.count_documents({"merchant_id": merchant_id, "active": True})

    max_staff = sub.get("max_staff_override") or sub.get("max_staff", 0)
    days_left = None
    if sub.get("status") == "trialing" and sub.get("trial_end"):
        try:
            te = datetime.fromisoformat(sub["trial_end"].replace("Z", "+00:00"))
            delta = te - datetime.now(timezone.utc)
            days_left = max(0, delta.days)
        except Exception:
            pass

    return {
        "success": True,
        "has_subscription": True,
        "active": sub.get("status") in ("trialing", "active") and sub.get("enabled", True),
        "subscription": sub,
        "plan": sub.get("plan"),
        "status": sub.get("status"),
        "enabled": sub.get("enabled", True),
        "max_staff": max_staff,
        "current_staff_count": staff_count,
        "remaining_slots": max(0, max_staff - staff_count),
        "trial_days_left": days_left,
        "trial_available": False,
    }


@router.post("/start-trial")
async def start_trial(request: Request, _body: Optional[StartTrialReq] = None):
    """30-Tage Free Trial starten (Pro Features)."""
    user = await require_merchant_or_admin(request)
    merchant_id = _merchant_id_from_user(user)

    existing = await db.staff_subscriptions.find_one({"merchant_id": merchant_id})
    if existing:
        existing = _serialize(existing)
        if existing.get("status") in ("trialing", "active"):
            raise HTTPException(400, "Es existiert bereits eine aktive Subscription oder Trial")
        if existing.get("trial_start"):
            raise HTTPException(400, "Trial wurde bereits einmal genutzt. Bitte ein Abo wählen.")

    now = datetime.now(timezone.utc)
    trial_end = now + timedelta(days=TRIAL_DAYS)
    pro_plan = STAFF_PLANS["pro"]

    sub_doc = {
        "id": str(uuid4()),
        "merchant_id": merchant_id,
        "plan": "pro",  # Trial gives Pro features
        "status": "trialing",
        "enabled": True,
        "trial_start": now.isoformat(),
        "trial_end": trial_end.isoformat(),
        "current_period_start": now.isoformat(),
        "current_period_end": trial_end.isoformat(),
        "max_staff": pro_plan["max_staff"],
        "features": pro_plan["features"],
        "stripe_subscription_id": None,
        "stripe_customer_id": None,
        "created_at": now.isoformat(),
        "updated_at": now.isoformat(),
    }

    if existing:
        await db.staff_subscriptions.update_one(
            {"merchant_id": merchant_id}, {"$set": sub_doc}
        )
    else:
        await db.staff_subscriptions.insert_one(sub_doc)
        sub_doc.pop("_id", None)

    logger.info(f"Trial started for merchant {merchant_id}")
    return {
        "success": True,
        "message": f"30-Tage Free Trial gestartet! Pro-Features bis {trial_end.date().isoformat()}.",
        "subscription": sub_doc,
    }


@router.post("/create-checkout")
async def create_checkout_session(req: CheckoutReq, request: Request):
    """
    Stripe Checkout Session erstellen (PLACEHOLDER).
    Echte Stripe-Integration kommt in Phase 2 mit Production Keys.
    """
    user = await require_merchant_or_admin(request)
    merchant_id = _merchant_id_from_user(user)

    plan_info = STAFF_PLANS.get(req.plan)
    if not plan_info:
        raise HTTPException(400, "Ungültiger Plan")

    if req.plan == "enterprise":
        return {
            "success": True,
            "checkout_url": None,
            "contact_required": True,
            "message": "Enterprise-Plan: Bitte kontaktiere unser Sales-Team unter sales@bidblitz.com",
        }

    # PLACEHOLDER: In production, create real Stripe Checkout Session
    # Currently we activate directly for testing without real billing
    stripe_secret = os.getenv("STRIPE_SECRET_KEY", "")
    if stripe_secret.startswith("sk_live_"):
        # Production Stripe keys present → would create real session here
        logger.warning("Stripe live key detected but checkout logic is placeholder")

    # Simulate successful checkout (DEV MODE):
    now = datetime.now(timezone.utc)
    sub_update = {
        "plan": req.plan,
        "status": "active",
        "enabled": True,
        "current_period_start": now.isoformat(),
        "current_period_end": (now + timedelta(days=30)).isoformat(),
        "max_staff": plan_info["max_staff"],
        "features": plan_info["features"],
        "stripe_subscription_id": f"sub_placeholder_{uuid4().hex[:12]}",
        "updated_at": now.isoformat(),
    }

    existing = await db.staff_subscriptions.find_one({"merchant_id": merchant_id})
    if existing:
        await db.staff_subscriptions.update_one(
            {"merchant_id": merchant_id}, {"$set": sub_update}
        )
    else:
        sub_doc = {
            "id": str(uuid4()),
            "merchant_id": merchant_id,
            "trial_start": None,
            "trial_end": None,
            "created_at": now.isoformat(),
            **sub_update,
        }
        await db.staff_subscriptions.insert_one(sub_doc)

    return {
        "success": True,
        "checkout_url": None,  # In production: stripe.checkout.Session.create(...).url
        "placeholder": True,
        "message": f"Plan '{plan_info['name']}' aktiviert (Stripe Placeholder Mode).",
        "plan": req.plan,
    }


@router.post("/cancel")
async def cancel_subscription(request: Request):
    """Subscription kündigen (läuft bis current_period_end)."""
    user = await require_merchant_or_admin(request)
    merchant_id = _merchant_id_from_user(user)

    sub = await db.staff_subscriptions.find_one({"merchant_id": merchant_id})
    if not sub:
        raise HTTPException(404, "Keine Subscription gefunden")

    await db.staff_subscriptions.update_one(
        {"merchant_id": merchant_id},
        {"$set": {"status": "cancelled", "updated_at": datetime.now(timezone.utc).isoformat()}},
    )
    return {"success": True, "message": "Subscription wurde gekündigt"}


@router.get("/plans")
async def list_plans():
    """Alle verfügbaren Pläne."""
    return {
        "success": True,
        "plans": [
            {"id": pid, **pinfo}
            for pid, pinfo in STAFF_PLANS.items()
        ],
        "trial_days": TRIAL_DAYS,
    }


# ───────────────────────────────────────────────────────────────────────────
# Admin Controls
# ───────────────────────────────────────────────────────────────────────────
@router.get("/admin/list")
async def admin_list_subscriptions(request: Request):
    """Admin: Liste aller Staff-Subscriptions."""
    await require_admin(request)
    subs = await db.staff_subscriptions.find({}, {"_id": 0}).to_list(length=500)
    return {"success": True, "subscriptions": subs, "count": len(subs)}


@router.post("/admin/override")
async def admin_override_subscription(req: AdminOverrideReq, request: Request):
    """Admin: Plan, Status, Trial verlängern, Limits überschreiben."""
    await require_admin(request)

    sub = await db.staff_subscriptions.find_one({"merchant_id": req.merchant_id})
    now = datetime.now(timezone.utc)

    update: dict = {"updated_at": now.isoformat()}

    if req.plan:
        plan_info = STAFF_PLANS.get(req.plan)
        update["plan"] = req.plan
        update["max_staff"] = plan_info["max_staff"]
        update["features"] = plan_info["features"]

    if req.status:
        update["status"] = req.status

    if req.max_staff_override is not None:
        update["max_staff_override"] = req.max_staff_override

    if req.enabled is not None:
        update["enabled"] = req.enabled

    if req.extend_trial_days:
        if sub and sub.get("trial_end"):
            try:
                te = datetime.fromisoformat(sub["trial_end"].replace("Z", "+00:00"))
            except Exception:
                te = now
        else:
            te = now
        new_te = max(te, now) + timedelta(days=req.extend_trial_days)
        update["trial_end"] = new_te.isoformat()
        update["current_period_end"] = new_te.isoformat()
        update["status"] = "trialing"

    # Edge-case: status=trialing without an existing trial_end → set default trial window
    if req.status == "trialing" and not (sub and sub.get("trial_end")) and "trial_end" not in update:
        new_te = now + timedelta(days=TRIAL_DAYS)
        update["trial_end"] = new_te.isoformat()
        update["current_period_end"] = new_te.isoformat()
        update["trial_start"] = now.isoformat()

    if not sub:
        # Create new subscription via admin
        if not req.plan:
            raise HTTPException(400, "Bei neuer Subscription muss ein Plan angegeben werden")
        plan_info = STAFF_PLANS[req.plan]
        sub_doc = {
            "id": str(uuid4()),
            "merchant_id": req.merchant_id,
            "plan": req.plan,
            "status": req.status or "active",
            "enabled": req.enabled if req.enabled is not None else True,
            "trial_start": None,
            "trial_end": None,
            "current_period_start": now.isoformat(),
            "current_period_end": (now + timedelta(days=365)).isoformat(),
            "max_staff": plan_info["max_staff"],
            "max_staff_override": req.max_staff_override,
            "features": plan_info["features"],
            "stripe_subscription_id": None,
            "stripe_customer_id": None,
            "admin_overridden": True,
            "created_at": now.isoformat(),
            "updated_at": now.isoformat(),
        }
        await db.staff_subscriptions.insert_one(sub_doc)
        sub_doc.pop("_id", None)
        return {"success": True, "subscription": sub_doc, "message": "Subscription via Admin angelegt"}

    update["admin_overridden"] = True
    await db.staff_subscriptions.update_one(
        {"merchant_id": req.merchant_id}, {"$set": update}
    )
    updated = await db.staff_subscriptions.find_one({"merchant_id": req.merchant_id}, {"_id": 0})
    return {"success": True, "subscription": updated, "message": "Override angewendet"}


@router.post("/admin/toggle-module")
async def admin_toggle_module(req: AdminModuleToggleReq, request: Request):
    """Admin: Staff-Modul pro Händler aktivieren/deaktivieren."""
    await require_admin(request)

    sub = await db.staff_subscriptions.find_one({"merchant_id": req.merchant_id})
    if not sub:
        raise HTTPException(404, "Keine Subscription für diesen Händler gefunden")

    await db.staff_subscriptions.update_one(
        {"merchant_id": req.merchant_id},
        {"$set": {"enabled": req.enabled, "updated_at": datetime.now(timezone.utc).isoformat()}},
    )
    return {
        "success": True,
        "enabled": req.enabled,
        "message": f"Staff-Modul {'aktiviert' if req.enabled else 'deaktiviert'} für Händler {req.merchant_id}",
    }


# ───────────────────────────────────────────────────────────────────────────
# Feature Flags
# ───────────────────────────────────────────────────────────────────────────
@router.get("/feature-flags")
async def get_feature_flags():
    """Globale Feature Flags für Staff-Modul."""
    return {
        "success": True,
        "flags": {
            "staff_module_enabled": os.getenv("STAFF_MODULE_ENABLED", "true").lower() == "true",
            "staff_trial_enabled": os.getenv("STAFF_TRIAL_ENABLED", "true").lower() == "true",
            "staff_subscription_required": os.getenv("STAFF_SUBSCRIPTION_REQUIRED", "true").lower() == "true",
            "trial_days": TRIAL_DAYS,
        },
    }
