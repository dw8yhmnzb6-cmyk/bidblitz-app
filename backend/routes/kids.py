"""
BidBlitz V2 - Kids Subscription Routes
Handles BidBlitz Kids paywall: trial, subscription checkout, status.
"""

from datetime import datetime, timezone, timedelta
from typing import Optional, List
import secrets
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from bson import ObjectId

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


# ═══════════════════════════════════════════════════════════════════════════════
# PARENT NOTIFICATION SYSTEM
# ═══════════════════════════════════════════════════════════════════════════════

async def create_parent_notification(
    parent_id: str,
    child_id: str,
    child_name: str,
    event_type: str,
    title: str,
    message: str,
    amount: Optional[float] = None,
    merchant_name: Optional[str] = None,
    severity: str = "info"  # info, warning, alert
):
    """Create a notification for parent about child activity."""
    notification = {
        "id": secrets.token_hex(8),
        "parent_id": parent_id,
        "child_id": child_id,
        "child_name": child_name,
        "event_type": event_type,
        "title": title,
        "message": message,
        "amount": amount,
        "merchant_name": merchant_name,
        "severity": severity,
        "is_read": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.kids_notifications.insert_one(notification)
    return notification


# ── GET Parent Notifications ──
@router.get("/notifications")
async def get_parent_notifications(request: Request, limit: int = 50, unread_only: bool = False):
    """Get parent notifications about children."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    query = {"parent_id": user_id}
    if unread_only:
        query["is_read"] = False
    
    notifications = await db.kids_notifications.find(
        query, {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    unread_count = await db.kids_notifications.count_documents({
        "parent_id": user_id,
        "is_read": False
    })
    
    return {
        "notifications": notifications,
        "unread_count": unread_count,
        "total": len(notifications)
    }


# ── Mark Notification as Read ──
@router.post("/notifications/{notification_id}/read")
async def mark_notification_read(notification_id: str, request: Request):
    """Mark a notification as read."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    result = await db.kids_notifications.update_one(
        {"id": notification_id, "parent_id": user_id},
        {"$set": {"is_read": True, "read_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Notification nicht gefunden")
    
    return {"ok": True}


# ── Mark All Notifications as Read ──
@router.post("/notifications/read-all")
async def mark_all_notifications_read(request: Request):
    """Mark all notifications as read."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    result = await db.kids_notifications.update_many(
        {"parent_id": user_id, "is_read": False},
        {"$set": {"is_read": True, "read_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"ok": True, "marked_count": result.modified_count}


class KidsCheckoutRequest(BaseModel):
    plan: str = Field(..., description="Plan: monthly or yearly")
    origin_url: str = Field(default="", description="Frontend origin for redirect")


# ── Get Available Plans ──
@router.get("/plans")
async def get_kids_plans():
    """Get available Kids subscription plans."""
    plans = []
    for plan_id, data in KIDS_PLANS.items():
        plans.append({
            "id": plan_id,
            "name": data["label"],
            "price": data["amount"],
            "interval": data["interval"],
            "description": f"BidBlitz Kids {data['label']} - €{data['amount']:.2f}/{data['interval']}"
        })
    return {"plans": plans, "trial_days": TRIAL_DAYS}


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
    birth_year: int = Field(default=None, ge=2005, le=2025)
    avatar_emoji: str = Field(default=None, max_length=4)


class UpdateChildRequest(BaseModel):
    name: str = Field(default=None, min_length=1, max_length=50)
    weekly_limit: float = Field(default=None, ge=0, le=500)
    birth_year: int = Field(default=None, ge=2005, le=2025)
    avatar_emoji: str = Field(default=None, max_length=4)


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
    
    # Calculate age if birth_year provided
    current_year = now.year
    age = current_year - req.birth_year if req.birth_year else None
    
    # Default avatar emoji or first letter
    avatar = req.avatar_emoji if req.avatar_emoji else name[0].upper() if name else "👶"

    doc = {
        "child_id": child_id,
        "parent_id": user_id,
        "name": name,
        "avatar": avatar,
        "birth_year": req.birth_year,
        "age": age,
        "weekly_limit": req.weekly_limit,
        "balance": 0.0,
        "spent": 0.0,
        "status": "active",
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



# ═══════════════════════════════════════════════════
# Cancel Subscription
# ═══════════════════════════════════════════════════

@router.post("/cancel")
async def cancel_kids_subscription(request: Request):
    """Cancel the Kids subscription."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    ip, ua = get_client_info(request)

    sub = await db.kids_subscriptions.find_one({"user_id": user_id})
    if not sub:
        raise HTTPException(status_code=404, detail="No subscription found")
    
    if sub.get("status") not in ("active", "trial"):
        raise HTTPException(status_code=400, detail="Subscription not active")

    now = datetime.now(timezone.utc)
    await db.kids_subscriptions.update_one(
        {"user_id": user_id},
        {"$set": {
            "status": "canceled",
            "canceled_at": now.isoformat(),
        }}
    )

    await log_audit(AuditEvent.ADMIN_ACTION, user_id, user.get("email", ""), ip, ua,
                    "success", "Kids subscription canceled")

    return {"ok": True, "status": "canceled"}


# ═══════════════════════════════════════════════════
# Admin: Manage Kids Subscriptions
# ═══════════════════════════════════════════════════

@router.get("/admin/subscriptions")
async def admin_list_kids_subscriptions(request: Request):
    """Admin: List all Kids subscriptions."""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")

    subs = await db.kids_subscriptions.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    
    stats = {
        "total": len(subs),
        "active": sum(1 for s in subs if s.get("status") == "active"),
        "trial": sum(1 for s in subs if s.get("status") == "trial"),
        "expired": sum(1 for s in subs if s.get("status") == "expired"),
        "canceled": sum(1 for s in subs if s.get("status") == "canceled"),
    }

    return {"subscriptions": subs, "stats": stats}



# ═══════════════════════════════════════════════════════════════════════════════
# CHILD WALLET SYSTEM - Complete Implementation
# ═══════════════════════════════════════════════════════════════════════════════

class TransferToChildRequest(BaseModel):
    child_id: str
    amount: float = Field(..., gt=0, le=500)
    note: Optional[str] = None


class SetLimitRequest(BaseModel):
    daily_limit: Optional[float] = Field(None, ge=0, le=200)
    weekly_limit: Optional[float] = Field(None, ge=0, le=500)


class ChildPaymentRequest(BaseModel):
    child_id: str
    amount: float = Field(..., gt=0, le=100)
    merchant_id: Optional[str] = None
    merchant_name: Optional[str] = "BidBlitz"
    description: Optional[str] = "Payment"


# ── Parent sends money to child ──
@router.post("/children/{child_id}/transfer")
async def transfer_to_child(child_id: str, req: TransferToChildRequest, request: Request):
    """Parent transfers money from their wallet to child's wallet - Uses Payment Engine."""
    from core.payment_engine import debit_wallet, TransactionType
    
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    # Verify child belongs to parent
    child = await db.kids_children.find_one({"child_id": child_id, "parent_id": user_id})
    if not child:
        raise HTTPException(status_code=404, detail="Kind nicht gefunden")
    
    # Check if child is frozen
    if child.get("is_frozen", False):
        raise HTTPException(status_code=400, detail="Kind-Wallet ist gesperrt")
    
    now = datetime.now(timezone.utc)
    ref = f"KIDS-{secrets.token_hex(4).upper()}"
    
    # Use Payment Engine for atomic parent wallet deduction
    result = await debit_wallet(
        user_id=user_id,
        amount=req.amount,
        tx_type=TransactionType.KIDS_TRANSFER,
        description=f"Taschengeld an {child['name']}",
        reference=ref,
        metadata={"child_id": child_id, "child_name": child["name"], "note": req.note}
    )
    
    if not result.success:
        raise HTTPException(status_code=400, detail=result.error)
    
    # Add to child balance
    await db.kids_children.update_one(
        {"child_id": child_id},
        {"$inc": {"balance": req.amount}}
    )
    
    # Record child transaction (incoming)
    await db.kids_transactions.insert_one({
        "id": secrets.token_hex(8),
        "child_id": child_id,
        "parent_id": user_id,
        "type": "allowance",
        "amount": req.amount,
        "description": f"Von {user.get('name', 'Eltern')}",
        "status": "completed",
        "reference": ref,
        "note": req.note,
        "created_at": now.isoformat(),
    })
    
    # Create notification for parent (money received by child)
    await create_parent_notification(
        parent_id=user_id,
        child_id=child_id,
        child_name=child["name"],
        event_type="money_received",
        title=f"{child['name']} hat Geld erhalten",
        message=f"€{req.amount:.2f} Taschengeld gesendet",
        amount=req.amount,
        severity="info"
    )
    
    # Get updated child balance
    updated_child = await db.kids_children.find_one({"child_id": child_id}, {"_id": 0})
    
    return {
        "ok": True,
        "parent_balance": result.new_balance,
        "child_balance": round(updated_child.get("balance", 0), 2),
        "message": f"€{req.amount:.2f} an {child['name']} gesendet",
        "transaction_id": result.transaction_id,
    }


# ── Get child wallet details ──
@router.get("/children/{child_id}/wallet")
async def get_child_wallet(child_id: str, request: Request):
    """Get child's wallet balance and recent transactions."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    child = await db.kids_children.find_one({"child_id": child_id, "parent_id": user_id}, {"_id": 0})
    if not child:
        raise HTTPException(status_code=404, detail="Kind nicht gefunden")
    
    # Get child's transactions
    transactions = await db.kids_transactions.find(
        {"child_id": child_id}
    ).sort("created_at", -1).limit(50).to_list(50)
    
    for tx in transactions:
        tx.pop("_id", None)
    
    # Calculate today's and this week's spending
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today_start - timedelta(days=today_start.weekday())
    
    today_spent = 0
    week_spent = 0
    
    for tx in transactions:
        if tx.get("type") == "payment" and tx.get("amount", 0) < 0:
            tx_time = datetime.fromisoformat(tx["created_at"].replace("Z", "+00:00"))
            if tx_time >= today_start:
                today_spent += abs(tx["amount"])
            if tx_time >= week_start:
                week_spent += abs(tx["amount"])
    
    return {
        "child": child,
        "balance": round(child.get("balance", 0), 2),
        "daily_limit": child.get("daily_limit", 20),
        "weekly_limit": child.get("weekly_limit", 50),
        "today_spent": round(today_spent, 2),
        "week_spent": round(week_spent, 2),
        "is_frozen": child.get("is_frozen", False),
        "transactions": transactions,
    }


# ── Set spending limits ──
@router.post("/children/{child_id}/limits")
async def set_child_limits(child_id: str, req: SetLimitRequest, request: Request):
    """Set daily/weekly spending limits for a child."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    child = await db.kids_children.find_one({"child_id": child_id, "parent_id": user_id})
    if not child:
        raise HTTPException(status_code=404, detail="Kind nicht gefunden")
    
    updates = {}
    if req.daily_limit is not None:
        updates["daily_limit"] = req.daily_limit
    if req.weekly_limit is not None:
        updates["weekly_limit"] = req.weekly_limit
    
    if updates:
        updates["limits_updated_at"] = datetime.now(timezone.utc).isoformat()
        await db.kids_children.update_one(
            {"child_id": child_id},
            {"$set": updates}
        )
    
    updated = await db.kids_children.find_one({"child_id": child_id}, {"_id": 0})
    return {
        "ok": True,
        "child": updated,
        "message": "Limits aktualisiert",
    }


# ── Freeze/Unfreeze child wallet ──
@router.post("/children/{child_id}/freeze")
async def freeze_child_wallet(child_id: str, request: Request):
    """Freeze a child's wallet - disables all payments."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    child = await db.kids_children.find_one({"child_id": child_id, "parent_id": user_id})
    if not child:
        raise HTTPException(status_code=404, detail="Kind nicht gefunden")
    
    is_frozen = child.get("is_frozen", False)
    new_status = not is_frozen
    
    await db.kids_children.update_one(
        {"child_id": child_id},
        {"$set": {
            "is_frozen": new_status,
            "frozen_at": datetime.now(timezone.utc).isoformat() if new_status else None,
        }}
    )
    
    # Create parent notification
    await create_parent_notification(
        parent_id=user_id,
        child_id=child_id,
        child_name=child.get("name"),
        event_type="wallet_locked" if new_status else "wallet_unlocked",
        title=f"{child.get('name')} Wallet {'gesperrt' if new_status else 'entsperrt'}",
        message=f"Wallet wurde {'gesperrt - keine Zahlungen möglich' if new_status else 'entsperrt - Zahlungen wieder möglich'}",
        severity="alert" if new_status else "info"
    )
    
    return {
        "ok": True,
        "is_frozen": new_status,
        "message": "Wallet gesperrt" if new_status else "Wallet entsperrt",
    }


# ── Child makes a payment ──
@router.post("/children/pay")
async def child_payment(req: ChildPaymentRequest, request: Request):
    """Process a payment from a child's wallet."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    # Verify child belongs to parent (for parent-initiated payments)
    # Or verify child is making their own payment
    child = await db.kids_children.find_one({"child_id": req.child_id, "parent_id": user_id})
    if not child:
        raise HTTPException(status_code=404, detail="Kind nicht gefunden")
    
    # Check if frozen
    if child.get("is_frozen", False):
        raise HTTPException(status_code=400, detail="Wallet ist gesperrt. Frage deine Eltern.")
    
    # Check balance
    child_balance = child.get("balance", 0)
    if child_balance < req.amount:
        raise HTTPException(
            status_code=400,
            detail=f"Nicht genug Guthaben. Verfügbar: €{child_balance:.2f}"
        )
    
    # Check daily limit
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    
    today_txns = await db.kids_transactions.find({
        "child_id": req.child_id,
        "type": "payment",
        "created_at": {"$gte": today_start.isoformat()}
    }).to_list(100)
    
    today_spent = sum(abs(tx.get("amount", 0)) for tx in today_txns if tx.get("amount", 0) < 0)
    daily_limit = child.get("daily_limit", 20)
    
    if today_spent + req.amount > daily_limit:
        raise HTTPException(
            status_code=400,
            detail=f"Tageslimit erreicht. Heute bereits €{today_spent:.2f} von €{daily_limit:.2f} ausgegeben."
        )
    
    # Check weekly limit
    week_start = today_start - timedelta(days=today_start.weekday())
    
    week_txns = await db.kids_transactions.find({
        "child_id": req.child_id,
        "type": "payment",
        "created_at": {"$gte": week_start.isoformat()}
    }).to_list(100)
    
    week_spent = sum(abs(tx.get("amount", 0)) for tx in week_txns if tx.get("amount", 0) < 0)
    weekly_limit = child.get("weekly_limit", 50)
    
    if week_spent + req.amount > weekly_limit:
        raise HTTPException(
            status_code=400,
            detail=f"Wochenlimit erreicht. Diese Woche bereits €{week_spent:.2f} von €{weekly_limit:.2f} ausgegeben."
        )
    
    # Process payment
    ref = f"KIDPAY-{secrets.token_hex(4).upper()}"
    
    await db.kids_children.update_one(
        {"child_id": req.child_id},
        {"$inc": {"balance": -req.amount, "total_spent": req.amount}}
    )
    
    # Record transaction
    tx = {
        "id": secrets.token_hex(8),
        "child_id": req.child_id,
        "parent_id": user_id,
        "type": "payment",
        "amount": -req.amount,
        "description": req.description,
        "merchant_id": req.merchant_id,
        "merchant_name": req.merchant_name,
        "status": "completed",
        "reference": ref,
        "created_at": now.isoformat(),
    }
    await db.kids_transactions.insert_one(tx)
    tx.pop("_id", None)
    
    # Credit merchant if provided
    if req.merchant_id:
        merchant = await db.merchant_profiles.find_one({"_id": ObjectId(req.merchant_id)})
        if merchant and merchant.get("user_id"):
            fee = round(req.amount * 0.02, 2)  # 2% fee
            net = req.amount - fee
            await db.users.update_one(
                {"_id": ObjectId(merchant["user_id"])},
                {"$inc": {"balance": net}}
            )
    
    updated_child = await db.kids_children.find_one({"child_id": req.child_id}, {"_id": 0})
    
    return {
        "ok": True,
        "transaction": tx,
        "new_balance": round(updated_child.get("balance", 0), 2),
        "today_spent": round(today_spent + req.amount, 2),
        "daily_limit": daily_limit,
        "message": f"€{req.amount:.2f} bezahlt bei {req.merchant_name}",
    }


# ── Get child activity (for parent dashboard) ──
@router.get("/children/{child_id}/activity")
async def get_child_activity(child_id: str, request: Request, days: int = 30):
    """Get child's activity history for parent monitoring."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    child = await db.kids_children.find_one({"child_id": child_id, "parent_id": user_id}, {"_id": 0})
    if not child:
        raise HTTPException(status_code=404, detail="Kind nicht gefunden")
    
    since = datetime.now(timezone.utc) - timedelta(days=days)
    
    transactions = await db.kids_transactions.find({
        "child_id": child_id,
        "created_at": {"$gte": since.isoformat()}
    }).sort("created_at", -1).to_list(200)
    
    for tx in transactions:
        tx.pop("_id", None)
    
    # Group by date
    by_date = {}
    for tx in transactions:
        date_str = tx["created_at"][:10]
        if date_str not in by_date:
            by_date[date_str] = []
        by_date[date_str].append(tx)
    
    # Calculate stats
    payments = [tx for tx in transactions if tx.get("type") == "payment"]
    allowances = [tx for tx in transactions if tx.get("type") == "allowance"]
    
    stats = {
        "total_spent": round(sum(abs(tx.get("amount", 0)) for tx in payments), 2),
        "total_received": round(sum(tx.get("amount", 0) for tx in allowances), 2),
        "transaction_count": len(transactions),
        "avg_payment": round(sum(abs(tx.get("amount", 0)) for tx in payments) / max(len(payments), 1), 2),
    }
    
    # Top merchants
    merchants = {}
    for tx in payments:
        name = tx.get("merchant_name", "Unknown")
        if name not in merchants:
            merchants[name] = 0
        merchants[name] += abs(tx.get("amount", 0))
    
    top_merchants = sorted(merchants.items(), key=lambda x: x[1], reverse=True)[:5]
    
    return {
        "child": child,
        "transactions": transactions,
        "by_date": by_date,
        "stats": stats,
        "top_merchants": [{"name": m[0], "amount": round(m[1], 2)} for m in top_merchants],
    }


# ── Generate child payment barcode/QR ──
@router.get("/children/{child_id}/barcode")
async def get_child_barcode(child_id: str, request: Request):
    """Generate payment barcode for child."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    child = await db.kids_children.find_one({"child_id": child_id, "parent_id": user_id}, {"_id": 0})
    if not child:
        raise HTTPException(status_code=404, detail="Kind nicht gefunden")
    
    # Generate unique payment code
    payment_code = f"BLZKID{child_id[-8:].upper()}{secrets.token_hex(2).upper()}"
    
    return {
        "child_id": child_id,
        "child_name": child["name"],
        "payment_code": payment_code,
        "balance": round(child.get("balance", 0), 2),
        "is_frozen": child.get("is_frozen", False),
    }



# ═══════════════════════════════════════════════════════════════════════════════
# CHILD ACCESS / LOGIN SYSTEM
# ═══════════════════════════════════════════════════════════════════════════════

class SetChildPinRequest(BaseModel):
    pin: str = Field(..., min_length=4, max_length=6, pattern=r'^\d{4,6}$')


class ChildLoginRequest(BaseModel):
    child_id: str
    pin: str


class ChildPaymentFromChildRequest(BaseModel):
    amount: float = Field(..., gt=0, le=100)
    merchant_id: Optional[str] = None
    merchant_name: Optional[str] = "BidBlitz"
    description: Optional[str] = "Payment"


# ── Parent sets child PIN ──
@router.post("/children/{child_id}/set-pin")
async def set_child_pin(child_id: str, req: SetChildPinRequest, request: Request):
    """Parent sets PIN for child access."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    child = await db.kids_children.find_one({"child_id": child_id, "parent_id": user_id})
    if not child:
        raise HTTPException(status_code=404, detail="Kind nicht gefunden")
    
    # Hash the PIN (simple for kids, not full bcrypt)
    import hashlib
    pin_hash = hashlib.sha256(req.pin.encode()).hexdigest()
    
    await db.kids_children.update_one(
        {"child_id": child_id},
        {"$set": {
            "pin_hash": pin_hash,
            "pin_set_at": datetime.now(timezone.utc).isoformat(),
        }}
    )
    
    return {"ok": True, "message": "PIN gesetzt"}


# ── Child Login ──
@router.post("/child-login")
async def child_login(req: ChildLoginRequest):
    """Child logs in with their PIN to access child mode."""
    child = await db.kids_children.find_one({"child_id": req.child_id})
    if not child:
        raise HTTPException(status_code=404, detail="Kind nicht gefunden")
    
    if not child.get("pin_hash"):
        raise HTTPException(status_code=400, detail="Kein PIN gesetzt. Frage deine Eltern.")
    
    import hashlib
    pin_hash = hashlib.sha256(req.pin.encode()).hexdigest()
    
    if pin_hash != child.get("pin_hash"):
        raise HTTPException(status_code=401, detail="Falscher PIN")
    
    # Check if frozen
    if child.get("is_frozen", False):
        raise HTTPException(status_code=403, detail="Wallet ist gesperrt. Frage deine Eltern.")
    
    # Generate session token for child
    child_token = secrets.token_urlsafe(32)
    
    await db.kids_sessions.update_one(
        {"child_id": req.child_id},
        {"$set": {
            "child_id": req.child_id,
            "token": child_token,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "expires_at": (datetime.now(timezone.utc) + timedelta(hours=24)).isoformat(),
        }},
        upsert=True
    )
    
    return {
        "ok": True,
        "child_token": child_token,
        "child_id": req.child_id,
        "child_name": child.get("name"),
        "balance": round(child.get("balance", 0), 2),
    }


# ── Helper: Get child from token ──
async def get_child_from_token(request: Request):
    """Validate child session token and return child data."""
    auth = request.headers.get("X-Child-Token")
    if not auth:
        raise HTTPException(status_code=401, detail="Kein Child-Token")
    
    session = await db.kids_sessions.find_one({"token": auth})
    if not session:
        raise HTTPException(status_code=401, detail="Ungültige Session")
    
    # Check expiry
    expires = datetime.fromisoformat(session["expires_at"].replace("Z", "+00:00"))
    if datetime.now(timezone.utc) > expires:
        await db.kids_sessions.delete_one({"token": auth})
        raise HTTPException(status_code=401, detail="Session abgelaufen")
    
    child = await db.kids_children.find_one({"child_id": session["child_id"]}, {"_id": 0})
    if not child:
        raise HTTPException(status_code=404, detail="Kind nicht gefunden")
    
    return child


# ── Child Mode: Get own data ──
@router.get("/child-mode/me")
async def child_mode_get_self(request: Request):
    """Child gets their own wallet data in child mode."""
    child = await get_child_from_token(request)
    
    if child.get("is_frozen", False):
        raise HTTPException(status_code=403, detail="Wallet ist gesperrt")
    
    # Calculate spending
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today_start - timedelta(days=today_start.weekday())
    
    transactions = await db.kids_transactions.find({
        "child_id": child["child_id"]
    }).sort("created_at", -1).limit(20).to_list(20)
    
    for tx in transactions:
        tx.pop("_id", None)
    
    today_spent = 0
    week_spent = 0
    
    for tx in transactions:
        if tx.get("type") == "payment" and tx.get("amount", 0) < 0:
            tx_time = datetime.fromisoformat(tx["created_at"].replace("Z", "+00:00"))
            if tx_time >= today_start:
                today_spent += abs(tx["amount"])
            if tx_time >= week_start:
                week_spent += abs(tx["amount"])
    
    daily_limit = child.get("daily_limit", 20)
    weekly_limit = child.get("weekly_limit", 50)
    
    return {
        "child_id": child["child_id"],
        "name": child.get("name"),
        "avatar": child.get("avatar"),
        "color": child.get("color"),
        "balance": round(child.get("balance", 0), 2),
        "today_spent": round(today_spent, 2),
        "week_spent": round(week_spent, 2),
        "daily_limit": daily_limit,
        "weekly_limit": weekly_limit,
        "remaining_today": round(max(0, daily_limit - today_spent), 2),
        "remaining_week": round(max(0, weekly_limit - week_spent), 2),
        "is_frozen": child.get("is_frozen", False),
        "recent_transactions": transactions,
    }


# ── Child Mode: Make payment ──
@router.post("/child-mode/pay")
async def child_mode_pay(req: ChildPaymentFromChildRequest, request: Request):
    """Child makes a payment from their own wallet."""
    child = await get_child_from_token(request)
    child_id = child["child_id"]
    
    # Check if frozen
    if child.get("is_frozen", False):
        raise HTTPException(status_code=403, detail="Wallet ist gesperrt. Frage deine Eltern.")
    
    # Check balance
    balance = child.get("balance", 0)
    if balance < req.amount:
        raise HTTPException(
            status_code=400,
            detail=f"Nicht genug Guthaben. Du hast €{balance:.2f}"
        )
    
    # Check daily limit
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    
    today_txns = await db.kids_transactions.find({
        "child_id": child_id,
        "type": "payment",
        "created_at": {"$gte": today_start.isoformat()}
    }).to_list(100)
    
    today_spent = sum(abs(tx.get("amount", 0)) for tx in today_txns if tx.get("amount", 0) < 0)
    daily_limit = child.get("daily_limit", 20)
    
    if today_spent + req.amount > daily_limit:
        raise HTTPException(
            status_code=400,
            detail=f"Tageslimit erreicht! Heute bereits €{today_spent:.2f} von €{daily_limit:.2f} ausgegeben."
        )
    
    # Check weekly limit
    week_start = today_start - timedelta(days=today_start.weekday())
    
    week_txns = await db.kids_transactions.find({
        "child_id": child_id,
        "type": "payment",
        "created_at": {"$gte": week_start.isoformat()}
    }).to_list(100)
    
    week_spent = sum(abs(tx.get("amount", 0)) for tx in week_txns if tx.get("amount", 0) < 0)
    weekly_limit = child.get("weekly_limit", 50)
    
    if week_spent + req.amount > weekly_limit:
        raise HTTPException(
            status_code=400,
            detail=f"Wochenlimit erreicht! Diese Woche bereits €{week_spent:.2f} von €{weekly_limit:.2f} ausgegeben."
        )
    
    # Process payment
    ref = f"CHILD-{secrets.token_hex(4).upper()}"
    
    await db.kids_children.update_one(
        {"child_id": child_id},
        {"$inc": {"balance": -req.amount, "total_spent": req.amount}}
    )
    
    # Record transaction
    tx = {
        "id": secrets.token_hex(8),
        "child_id": child_id,
        "parent_id": child.get("parent_id"),
        "type": "payment",
        "amount": -req.amount,
        "description": req.description,
        "merchant_id": req.merchant_id,
        "merchant_name": req.merchant_name,
        "status": "completed",
        "reference": ref,
        "from_child_mode": True,
        "created_at": now.isoformat(),
    }
    await db.kids_transactions.insert_one(tx)
    tx.pop("_id", None)
    
    # Credit merchant if provided
    if req.merchant_id:
        try:
            merchant = await db.merchant_profiles.find_one({"_id": ObjectId(req.merchant_id)})
            if merchant and merchant.get("user_id"):
                fee = round(req.amount * 0.02, 2)
                net = req.amount - fee
                await db.users.update_one(
                    {"_id": ObjectId(merchant["user_id"])},
                    {"$inc": {"balance": net}}
                )
        except Exception:
            pass
    
    updated_child = await db.kids_children.find_one({"child_id": child_id}, {"_id": 0})
    
    # Create parent notification for payment
    await create_parent_notification(
        parent_id=child.get("parent_id"),
        child_id=child_id,
        child_name=child.get("name"),
        event_type="child_payment",
        title=f"{child.get('name')} hat bezahlt",
        message=f"€{req.amount:.2f} bei {req.merchant_name or 'Shop'}",
        amount=req.amount,
        merchant_name=req.merchant_name,
        severity="info"
    )
    
    # Check if near limit - send warning
    new_today_spent = today_spent + req.amount
    if new_today_spent >= daily_limit * 0.8:
        await create_parent_notification(
            parent_id=child.get("parent_id"),
            child_id=child_id,
            child_name=child.get("name"),
            event_type="limit_warning",
            title=f"{child.get('name')} nähert sich dem Tageslimit",
            message=f"€{new_today_spent:.2f} von €{daily_limit:.2f} heute ausgegeben",
            amount=new_today_spent,
            severity="warning"
        )
    
    return {
        "ok": True,
        "transaction": tx,
        "new_balance": round(updated_child.get("balance", 0), 2),
        "today_spent": round(today_spent + req.amount, 2),
        "remaining_today": round(max(0, daily_limit - today_spent - req.amount), 2),
        "message": f"€{req.amount:.2f} bezahlt!",
    }


# ── Child Mode: Get payment QR/barcode ──
@router.get("/child-mode/payment-code")
async def child_mode_get_payment_code(request: Request):
    """Child gets their payment code for QR/barcode."""
    child = await get_child_from_token(request)
    
    if child.get("is_frozen", False):
        raise HTTPException(status_code=403, detail="Wallet ist gesperrt")
    
    payment_code = f"BLZKID{child['child_id'][-8:].upper()}"
    
    return {
        "child_id": child["child_id"],
        "name": child.get("name"),
        "payment_code": payment_code,
        "balance": round(child.get("balance", 0), 2),
        "can_pay": not child.get("is_frozen", False),
    }


# ── Child Mode: Logout ──
@router.post("/child-mode/logout")
async def child_mode_logout(request: Request):
    """Child logs out of child mode."""
    auth = request.headers.get("X-Child-Token")
    if auth:
        await db.kids_sessions.delete_one({"token": auth})
    return {"ok": True}
