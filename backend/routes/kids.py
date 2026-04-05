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



# ═══════════════════════════════════════════════════
# Child Account Management
# ═══════════════════════════════════════════════════

class CreateChildRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=50)
    weekly_limit: float = Field(default=15.0, ge=0, le=500)


class UpdateChildRequest(BaseModel):
    name: str = Field(default=None, min_length=1, max_length=50)
    weekly_limit: float = Field(default=None, ge=0, le=500)


@router.get("/children")
async def list_children(request: Request):
    """List all children for the current parent."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    children = await db.kids_children.find(
        {"parent_id": user_id}, {"_id": 0}
    ).sort("created_at", 1).to_list(20)
    return {"children": children}


@router.post("/children")
async def create_child(req: CreateChildRequest, request: Request):
    """Create a child account under the current parent."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    ip, ua = get_client_info(request)

    # Limit to 6 children per parent
    count = await db.kids_children.count_documents({"parent_id": user_id})
    if count >= 6:
        raise HTTPException(status_code=400, detail="Maximum 6 children per account")

    name = req.name.strip()
    now = datetime.now(timezone.utc)
    colors = ["#00C2FF", "#A855F7", "#00D26A", "#FFB800", "#FF6B6B", "#E91E63"]
    import uuid
    child_id = f"child_{uuid.uuid4().hex[:12]}"

    doc = {
        "child_id": child_id,
        "parent_id": user_id,
        "name": name,
        "avatar": name[0].upper() if name else "?",
        "weekly_limit": req.weekly_limit,
        "spent": 0.0,
        "color": colors[count % len(colors)],
        "created_at": now.isoformat(),
    }
    await db.kids_children.insert_one(doc)

    await log_audit(AuditEvent.ADMIN_ACTION, user_id, user.get("email", ""), ip, ua,
                    "success", f"Child account created: {name}")

    # Return without _id
    doc.pop("_id", None)
    return doc


@router.put("/children/{child_id}")
async def update_child(child_id: str, req: UpdateChildRequest, request: Request):
    """Update a child's name or weekly limit."""
    user = await get_current_user(request)
    user_id = str(user["_id"])

    child = await db.kids_children.find_one({"child_id": child_id, "parent_id": user_id})
    if not child:
        raise HTTPException(status_code=404, detail="Child not found")

    updates = {}
    if req.name is not None:
        updates["name"] = req.name.strip()
        updates["avatar"] = req.name.strip()[0].upper() if req.name.strip() else child.get("avatar", "?")
    if req.weekly_limit is not None:
        updates["weekly_limit"] = req.weekly_limit

    if updates:
        await db.kids_children.update_one(
            {"child_id": child_id, "parent_id": user_id},
            {"$set": updates}
        )

    updated = await db.kids_children.find_one(
        {"child_id": child_id, "parent_id": user_id}, {"_id": 0}
    )
    return updated


@router.delete("/children/{child_id}")
async def delete_child(child_id: str, request: Request):
    """Remove a child account."""
    user = await get_current_user(request)
    user_id = str(user["_id"])

    result = await db.kids_children.delete_one({"child_id": child_id, "parent_id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Child not found")

    return {"ok": True}
