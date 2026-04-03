"""
BidBlitz V2 - Kids Subscription Routes
Handles BidBlitz Kids paywall: trial, subscription checkout, status.
"""

from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from emergentintegrations.payments.stripe.checkout import (
    StripeCheckout,
    CheckoutSessionRequest,
)
from core.config import STRIPE_API_KEY
from core.database import db
from core.security import get_current_user
from core.audit import log_audit, AuditEvent, get_client_info

router = APIRouter(prefix="/api/kids", tags=["kids"])

KIDS_PLANS = {
    "monthly": {"amount": 4.99, "label": "Monthly", "interval": "month"},
    "yearly": {"amount": 49.99, "label": "Yearly", "interval": "year"},
}

TRIAL_DAYS = 7


class KidsCheckoutRequest(BaseModel):
    plan: str = Field(..., description="Plan: monthly or yearly")
    origin_url: str = Field(default="", description="Frontend origin for redirect")


# ── Get Kids Subscription Status ──
@router.get("/subscription")
async def get_kids_subscription(request: Request):
    user = await get_current_user(request)
    user_id = str(user["_id"])

    sub = await db.kids_subscriptions.find_one({"user_id": user_id}, {"_id": 0})
    if not sub:
        return {"status": "none", "plan": None, "trial_available": True}

    # Check expiry
    now = datetime.now(timezone.utc)
    expires_at = sub.get("expires_at")
    if expires_at:
        exp = datetime.fromisoformat(expires_at) if isinstance(expires_at, str) else expires_at
        if exp.tzinfo is None:
            from datetime import timezone as tz
            exp = exp.replace(tzinfo=tz.utc)
        if now > exp:
            await db.kids_subscriptions.update_one(
                {"user_id": user_id}, {"$set": {"status": "expired"}}
            )
            return {"status": "expired", "plan": sub.get("plan"), "trial_available": False, "expires_at": expires_at}

    return {
        "status": sub.get("status", "none"),
        "plan": sub.get("plan"),
        "trial_available": False,
        "expires_at": sub.get("expires_at"),
        "started_at": sub.get("started_at"),
    }


# ── Start Free Trial ──
@router.post("/start-trial")
async def start_trial(request: Request):
    user = await get_current_user(request)
    user_id = str(user["_id"])
    ip, ua = get_client_info(request)

    existing = await db.kids_subscriptions.find_one({"user_id": user_id})
    if existing:
        raise HTTPException(status_code=400, detail="Trial already used or subscription active")

    now = datetime.now(timezone.utc)
    expires = now + timedelta(days=TRIAL_DAYS)

    await db.kids_subscriptions.insert_one({
        "user_id": user_id,
        "status": "trial",
        "plan": "trial",
        "started_at": now.isoformat(),
        "expires_at": expires.isoformat(),
        "created_at": now.isoformat(),
    })

    await log_audit(AuditEvent.ADMIN_ACTION, user_id, user.get("email", ""), ip, ua,
                    "success", "Kids trial started")

    return {"status": "trial", "expires_at": expires.isoformat()}


# ── Create Checkout for Kids Subscription ──
@router.post("/create-checkout")
async def create_kids_checkout(req: KidsCheckoutRequest, request: Request):
    user = await get_current_user(request)
    user_id = str(user["_id"])
    ip, ua = get_client_info(request)

    if req.plan not in KIDS_PLANS:
        raise HTTPException(status_code=400, detail="Invalid plan. Choose monthly or yearly.")

    plan = KIDS_PLANS[req.plan]
    origin = req.origin_url.rstrip("/") if req.origin_url else str(request.base_url).rstrip("/")
    success_url = f"{origin}/?kids_sub=success&session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{origin}/?kids_sub=cancelled"

    host_url = str(request.base_url).rstrip("/")
    webhook_url = f"{host_url}/api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)

    checkout_req = CheckoutSessionRequest(
        amount=float(plan["amount"]),
        currency="eur",
        success_url=success_url,
        cancel_url=cancel_url,
        metadata={
            "user_id": user_id,
            "type": "kids_subscription",
            "plan": req.plan,
        },
    )

    session = await stripe_checkout.create_checkout_session(checkout_req)

    await db.kids_checkout_sessions.insert_one({
        "session_id": session.session_id,
        "user_id": user_id,
        "plan": req.plan,
        "amount": plan["amount"],
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
    })

    await log_audit(AuditEvent.ADMIN_ACTION, user_id, user.get("email", ""), ip, ua,
                    "success", f"Kids checkout created: {req.plan}")

    return {"checkout_url": session.url, "session_id": session.session_id}


# ── Verify Kids Checkout ──
@router.get("/verify-checkout/{session_id}")
async def verify_kids_checkout(session_id: str, request: Request):
    user = await get_current_user(request)
    user_id = str(user["_id"])

    checkout = await db.kids_checkout_sessions.find_one(
        {"session_id": session_id, "user_id": user_id}
    )
    if not checkout:
        raise HTTPException(status_code=404, detail="Checkout session not found")

    if checkout["status"] == "completed":
        return {"status": "active", "plan": checkout["plan"]}

    host_url = str(request.base_url).rstrip("/")
    webhook_url = f"{host_url}/api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
    stripe_status = await stripe_checkout.get_checkout_status(session_id)

    if stripe_status.payment_status == "paid":
        now = datetime.now(timezone.utc)
        plan = checkout["plan"]
        if plan == "yearly":
            expires = now + timedelta(days=365)
        else:
            expires = now + timedelta(days=30)

        await db.kids_checkout_sessions.update_one(
            {"session_id": session_id},
            {"$set": {"status": "completed"}}
        )

        await db.kids_subscriptions.update_one(
            {"user_id": user_id},
            {"$set": {
                "status": "active",
                "plan": plan,
                "started_at": now.isoformat(),
                "expires_at": expires.isoformat(),
                "stripe_session_id": session_id,
            }},
            upsert=True,
        )

        return {"status": "active", "plan": plan, "expires_at": expires.isoformat()}

    return {"status": "pending", "payment_status": stripe_status.payment_status}
