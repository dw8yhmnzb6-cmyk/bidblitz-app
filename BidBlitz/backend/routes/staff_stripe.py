"""
BidBlitz Staff - Stripe Webhook & Real Checkout
=================================================
Echte Stripe Subscription Integration via emergentintegrations.
- POST /api/staff/subscription/checkout-real → echte Stripe Checkout Session
- GET  /api/staff/subscription/checkout-status/{session_id}
- POST /api/webhook/stripe-staff → Webhook für customer.subscription.*

ENV:
  STRIPE_API_KEY (vorhanden, sk_test_emergent)
  STRIPE_STAFF_PRICE_BASIC, STRIPE_STAFF_PRICE_PRO  (optional, sonst custom amount)
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional, Literal
from datetime import datetime, timedelta, timezone
from uuid import uuid4
import os, logging
from motor.motor_asyncio import AsyncIOMotorClient

router = APIRouter(prefix="/api/staff/subscription", tags=["staff-stripe"])
client = AsyncIOMotorClient(os.getenv("MONGO_URL"))
db = client[os.getenv("DB_NAME", "bidblitz")]
log = logging.getLogger("bidblitz.staff_stripe")

STRIPE_API_KEY = os.getenv("STRIPE_API_KEY", "")
PRICE_MAP = {
    "basic": float(os.getenv("STAFF_PRICE_BASIC_EUR", "4.99")),
    "pro": float(os.getenv("STAFF_PRICE_PRO_EUR", "9.99")),
}
PLAN_LIMITS = {"basic": 5, "pro": 20, "enterprise": 9999}
PLAN_FEATURES = {
    "basic": ["time_tracking", "shifts", "leave_management", "basic_reports"],
    "pro": ["time_tracking", "shifts", "leave_management", "basic_reports",
            "qr_checkin", "gps_geofencing", "advanced_reports", "payroll_export", "manager_approval"],
    "enterprise": ["all"],
}


class CheckoutRealReq(BaseModel):
    plan: Literal["basic", "pro"]
    origin_url: str  # window.location.origin from frontend


async def get_current_user(request: Request):
    from routes.auth import get_current_user as auth_user
    return await auth_user(request)


def _stripe_available() -> bool:
    if not STRIPE_API_KEY:
        return False
    try:
        from emergentintegrations.payments.stripe.checkout import StripeCheckout  # noqa
        return True
    except Exception as e:
        log.warning(f"emergentintegrations not available: {e}")
        return False


@router.post("/checkout-real")
async def create_real_checkout(req: CheckoutRealReq, request: Request):
    """Echte Stripe Checkout Session erstellen (Subscription Mode via Custom Amount)."""
    user = await get_current_user(request)
    if user.get("role") not in ("merchant", "admin"):
        raise HTTPException(403, "Nur für Händler oder Administratoren")
    merchant_id = str(user.get("user_id") or user.get("id"))

    if not _stripe_available():
        raise HTTPException(503, "Stripe ist aktuell nicht verfügbar. Bitte Placeholder-Checkout nutzen.")

    from emergentintegrations.payments.stripe.checkout import StripeCheckout, CheckoutSessionRequest
    amount = PRICE_MAP[req.plan]
    origin = req.origin_url.rstrip("/")
    success_url = f"{origin}/merchant/staff?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{origin}/merchant/staff/upgrade"

    host_url = str(request.base_url).rstrip("/")
    webhook_url = f"{host_url}/api/webhook/stripe-staff"
    sc = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)

    session_req = CheckoutSessionRequest(
        amount=amount,
        currency="eur",
        success_url=success_url,
        cancel_url=cancel_url,
        metadata={
            "merchant_id": merchant_id,
            "plan": req.plan,
            "kind": "staff_subscription",
            "source": "bidblitz_staff",
        },
    )
    session = await sc.create_checkout_session(session_req)

    # MANDATORY: create payment_transactions entry BEFORE redirect
    await db.payment_transactions.insert_one({
        "id": str(uuid4()),
        "session_id": session.session_id,
        "merchant_id": merchant_id,
        "amount": amount,
        "currency": "eur",
        "metadata": {"plan": req.plan, "kind": "staff_subscription"},
        "payment_status": "pending",
        "status": "initiated",
        "created_at": datetime.now(timezone.utc).isoformat(),
    })

    return {
        "success": True,
        "checkout_url": session.url,
        "session_id": session.session_id,
        "amount": amount,
        "plan": req.plan,
    }


@router.get("/checkout-status/{session_id}")
async def get_checkout_status(session_id: str, request: Request):
    """Frontend ruft das nach Redirect auf, um Status zu pollen."""
    user = await get_current_user(request)
    merchant_id = str(user.get("user_id") or user.get("id"))

    txn = await db.payment_transactions.find_one({"session_id": session_id, "merchant_id": merchant_id}, {"_id": 0})
    if not txn:
        raise HTTPException(404, "Session nicht gefunden")

    # Already processed? avoid double-activation
    if txn.get("payment_status") == "paid" and txn.get("processed"):
        return {"success": True, "payment_status": "paid", "already_processed": True}

    if not _stripe_available():
        return {"success": False, "payment_status": txn.get("payment_status", "unknown"), "stripe_unavailable": True}

    from emergentintegrations.payments.stripe.checkout import StripeCheckout
    host_url = str(request.base_url).rstrip("/")
    sc = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=f"{host_url}/api/webhook/stripe-staff")
    status = await sc.get_checkout_status(session_id)

    new_payment_status = status.payment_status
    await db.payment_transactions.update_one(
        {"session_id": session_id},
        {"$set": {
            "payment_status": new_payment_status,
            "status": status.status,
            "amount_total": status.amount_total,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }},
    )

    if new_payment_status == "paid" and not txn.get("processed"):
        # Activate Staff subscription
        plan = (status.metadata or {}).get("plan") or txn.get("metadata", {}).get("plan", "pro")
        await _activate_subscription(merchant_id, plan, session_id=session_id)
        await db.payment_transactions.update_one(
            {"session_id": session_id},
            {"$set": {"processed": True, "processed_at": datetime.now(timezone.utc).isoformat()}},
        )

    return {
        "success": True,
        "payment_status": new_payment_status,
        "status": status.status,
        "amount_total": status.amount_total,
        "currency": status.currency,
    }


async def _activate_subscription(merchant_id: str, plan: str, session_id: Optional[str] = None,
                                 stripe_subscription_id: Optional[str] = None,
                                 stripe_customer_id: Optional[str] = None):
    """Aktiviert Plan in staff_subscriptions Collection."""
    now = datetime.now(timezone.utc)
    end = now + timedelta(days=30)
    update = {
        "merchant_id": merchant_id,
        "plan": plan,
        "status": "active",
        "enabled": True,
        "current_period_start": now.isoformat(),
        "current_period_end": end.isoformat(),
        "max_staff": PLAN_LIMITS.get(plan, 5),
        "features": PLAN_FEATURES.get(plan, []),
        "updated_at": now.isoformat(),
    }
    if session_id:
        update["last_checkout_session_id"] = session_id
    if stripe_subscription_id:
        update["stripe_subscription_id"] = stripe_subscription_id
    if stripe_customer_id:
        update["stripe_customer_id"] = stripe_customer_id
    existing = await db.staff_subscriptions.find_one({"merchant_id": merchant_id})
    if existing:
        await db.staff_subscriptions.update_one({"merchant_id": merchant_id}, {"$set": update})
    else:
        update["id"] = str(uuid4())
        update["created_at"] = now.isoformat()
        await db.staff_subscriptions.insert_one(update)
    log.info(f"Activated staff subscription: merchant={merchant_id} plan={plan}")


# ────────────────────────────────────────────────────────────────
# Webhook
# ────────────────────────────────────────────────────────────────
webhook_router = APIRouter(prefix="/api/webhook", tags=["staff-stripe-webhook"])


@webhook_router.post("/stripe-staff")
async def stripe_webhook(request: Request):
    """Stripe sendet Events hierher. Verifiziert Signature via emergentintegrations."""
    if not _stripe_available():
        raise HTTPException(503, "Stripe not configured")
    from emergentintegrations.payments.stripe.checkout import StripeCheckout
    body = await request.body()
    sig = request.headers.get("Stripe-Signature", "")
    host_url = str(request.base_url).rstrip("/")
    sc = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=f"{host_url}/api/webhook/stripe-staff")
    try:
        evt = await sc.handle_webhook(body, sig)
    except Exception as e:
        log.warning(f"Webhook verification failed: {e}")
        raise HTTPException(400, "Invalid signature")

    event_type = evt.event_type
    session_id = evt.session_id
    metadata = evt.metadata or {}
    merchant_id = metadata.get("merchant_id")
    plan = metadata.get("plan")
    kind = metadata.get("kind")

    log.info(f"Stripe webhook: type={event_type} session={session_id} merchant={merchant_id} plan={plan}")

    if kind != "staff_subscription":
        return {"success": True, "ignored": True, "reason": "not_staff_subscription"}

    # Update payment_transactions
    if session_id:
        await db.payment_transactions.update_one(
            {"session_id": session_id},
            {"$set": {
                "payment_status": evt.payment_status,
                "webhook_event_type": event_type,
                "webhook_event_id": evt.event_id,
                "webhook_received_at": datetime.now(timezone.utc).isoformat(),
            }},
        )
        txn = await db.payment_transactions.find_one({"session_id": session_id})
        if evt.payment_status == "paid" and txn and not txn.get("processed") and merchant_id and plan:
            await _activate_subscription(merchant_id, plan, session_id=session_id)
            await db.payment_transactions.update_one(
                {"session_id": session_id},
                {"$set": {"processed": True, "processed_at": datetime.now(timezone.utc).isoformat()}},
            )

    # Handle subscription lifecycle events (for future Stripe Subscription products)
    if event_type in ("customer.subscription.deleted", "customer.subscription.canceled"):
        if merchant_id:
            await db.staff_subscriptions.update_one(
                {"merchant_id": merchant_id},
                {"$set": {"status": "cancelled", "updated_at": datetime.now(timezone.utc).isoformat()}},
            )

    return {"success": True, "event_type": event_type}
