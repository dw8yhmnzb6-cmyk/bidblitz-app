"""
BidBlitz V2 - Subscription System
Premium subscription plans with recurring wallet payments.
Plans: basic, premium, pro with different benefits.
"""

import secrets
import logging
import hashlib
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from typing import Optional, List
from bson import ObjectId

from core.database import db
from core.security import get_current_user
from core.payment_engine import debit_wallet, credit_wallet, TransactionType

router = APIRouter(prefix="/api/subscription", tags=["Subscription"])
logger = logging.getLogger("bidblitz.subscription")


# ══════════════════════════════════════════════════════════════════════════════
# SUBSCRIPTION PLANS CONFIGURATION
# ══════════════════════════════════════════════════════════════════════════════

SUBSCRIPTION_PLANS = {
    "basic": {
        "id": "basic",
        "name": "Basic",
        "price_monthly": 9.99,
        "price_yearly": 99.99,  # ~17% discount
        "features": [
            "Keine Werbung",
            "5% reduzierte Gebühren",
            "Standard Support",
            "Basis Analytics",
        ],
        "benefits": {
            "fee_reduction": 0.05,  # 5% lower fees
            "cashback_bonus": 0.005,  # +0.5% cashback
            "priority_support": False,
            "free_boosts": 0,
            "free_transfers": 5,
            "referral_bonus": 0.01,  # +1% referral bonus
        },
        "badge": "Basic",
        "color": "#3B82F6",  # blue
    },
    "premium": {
        "id": "premium",
        "name": "Premium",
        "price_monthly": 19.99,
        "price_yearly": 199.99,  # ~17% discount
        "features": [
            "Keine Werbung",
            "15% reduzierte Gebühren",
            "Priority Support",
            "Erweiterte Analytics",
            "1 Gratis-Boost/Monat",
            "10 Gratis-Transfers/Monat",
        ],
        "benefits": {
            "fee_reduction": 0.15,  # 15% lower fees
            "cashback_bonus": 0.01,  # +1% cashback
            "priority_support": True,
            "free_boosts": 1,
            "free_transfers": 10,
            "referral_bonus": 0.02,  # +2% referral bonus
        },
        "badge": "Premium",
        "color": "#8B5CF6",  # purple
    },
    "pro": {
        "id": "pro",
        "name": "Pro",
        "price_monthly": 49.99,
        "price_yearly": 499.99,  # ~17% discount
        "features": [
            "Keine Werbung",
            "25% reduzierte Gebühren",
            "VIP Support (24h Antwort)",
            "Vollständige Analytics",
            "3 Gratis-Boosts/Monat",
            "Unbegrenzte Gratis-Transfers",
            "Frühzugang zu neuen Features",
            "Exklusive Händler-Rabatte",
        ],
        "benefits": {
            "fee_reduction": 0.25,  # 25% lower fees
            "cashback_bonus": 0.02,  # +2% cashback
            "priority_support": True,
            "vip_support": True,
            "free_boosts": 3,
            "free_transfers": -1,  # unlimited
            "referral_bonus": 0.03,  # +3% referral bonus
            "early_access": True,
            "merchant_discounts": True,
        },
        "badge": "Pro",
        "color": "#F59E0B",  # gold
    },
}


# ══════════════════════════════════════════════════════════════════════════════
# SCHEMAS
# ══════════════════════════════════════════════════════════════════════════════

class BuySubscriptionRequest(BaseModel):
    plan: str = Field(..., description="basic, premium, or pro")
    billing_cycle: str = Field(default="monthly", description="monthly or yearly")
    auto_renew: bool = Field(default=True)
    idempotency_key: Optional[str] = None


class CancelSubscriptionRequest(BaseModel):
    reason: Optional[str] = None


class ChangeSubscriptionRequest(BaseModel):
    new_plan: str
    immediate: bool = Field(default=True, description="Apply immediately or at end of current period")


# ══════════════════════════════════════════════════════════════════════════════
# HELPER FUNCTIONS
# ══════════════════════════════════════════════════════════════════════════════

def _require_subscription_idempotency_key(body_key: Optional[str], request: Request) -> str:
    key = (body_key or request.headers.get("Idempotency-Key") or "").strip()
    if not 8 <= len(key) <= 200:
        raise HTTPException(status_code=400, detail="Idempotency-Key erforderlich")
    return f"subscription:{key}"


async def _record_subscription_revenue_once(subscription_id: str, amount: float, now: datetime) -> None:
    if amount <= 0:
        return
    date_key = now.strftime("%Y-%m-%d")
    existing = await db.platform_revenue.find_one(
        {"date": date_key},
        {"_id": 0, "subscription_ids": 1},
    )
    if existing and subscription_id in (existing.get("subscription_ids") or []):
        return
    if existing:
        await db.platform_revenue.update_one(
            {"date": date_key, "subscription_ids": {"$ne": subscription_id}},
            {
                "$inc": {"total": amount, "by_source.subscriptions": amount},
                "$addToSet": {"subscription_ids": subscription_id},
            },
        )
        return
    try:
        await db.platform_revenue.insert_one({
            "date": date_key,
            "total": amount,
            "by_source": {"subscriptions": amount},
            "subscription_ids": [subscription_id],
            "created_at": now.isoformat(),
        })
    except Exception:
        await db.platform_revenue.update_one(
            {"date": date_key, "subscription_ids": {"$ne": subscription_id}},
            {
                "$inc": {"total": amount, "by_source.subscriptions": amount},
                "$addToSet": {"subscription_ids": subscription_id},
            },
        )


async def get_user_subscription(user_id: str) -> Optional[dict]:
    """Get user's active subscription."""
    now = datetime.now(timezone.utc).isoformat()
    return await db.subscriptions.find_one({
        "user_id": user_id,
        "status": "active",
        "expires_at": {"$gt": now}
    }, {"_id": 0})


async def get_subscription_benefits(user_id: str) -> dict:
    """Get user's subscription benefits (or defaults for free users)."""
    subscription = await get_user_subscription(user_id)
    
    if not subscription:
        return {
            "has_subscription": False,
            "plan": None,
            "fee_reduction": 0,
            "cashback_bonus": 0,
            "priority_support": False,
            "free_boosts": 0,
            "free_transfers": 0,
            "referral_bonus": 0,
        }
    
    plan = SUBSCRIPTION_PLANS.get(subscription.get("plan"), {})
    benefits = plan.get("benefits", {})
    
    return {
        "has_subscription": True,
        "plan": subscription.get("plan"),
        "plan_name": plan.get("name"),
        "badge": plan.get("badge"),
        "color": plan.get("color"),
        "expires_at": subscription.get("expires_at"),
        "auto_renew": subscription.get("auto_renew", True),
        **benefits
    }


async def apply_subscription_to_user(user_id: str, subscription: dict):
    """Apply subscription benefits to user account."""
    plan = SUBSCRIPTION_PLANS.get(subscription.get("plan"), {})
    
    await db.users.update_one(
        {"_id": ObjectId(user_id) if ObjectId.is_valid(user_id) else user_id},
        {"$set": {
            "subscription": {
                "plan": subscription.get("plan"),
                "plan_name": plan.get("name"),
                "badge": plan.get("badge"),
                "color": plan.get("color"),
                "expires_at": subscription.get("expires_at"),
            },
            "is_premium": True,
            "subscription_updated_at": datetime.now(timezone.utc).isoformat(),
        }}
    )


async def remove_subscription_from_user(user_id: str):
    """Remove subscription benefits from user account."""
    await db.users.update_one(
        {"_id": ObjectId(user_id) if ObjectId.is_valid(user_id) else user_id},
        {"$set": {
            "subscription": None,
            "is_premium": False,
            "subscription_updated_at": datetime.now(timezone.utc).isoformat(),
        }}
    )


# ══════════════════════════════════════════════════════════════════════════════
# GET PLANS (PUBLIC)
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/plans")
async def get_subscription_plans():
    """Get all available subscription plans (public)."""
    plans = []
    for plan_id, plan in SUBSCRIPTION_PLANS.items():
        plans.append({
            "id": plan_id,
            "name": plan["name"],
            "price_monthly": plan["price_monthly"],
            "price_yearly": plan["price_yearly"],
            "yearly_savings": round((plan["price_monthly"] * 12) - plan["price_yearly"], 2),
            "features": plan["features"],
            "badge": plan["badge"],
            "color": plan["color"],
        })
    
    return {"plans": plans}


# ══════════════════════════════════════════════════════════════════════════════
# BUY SUBSCRIPTION
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/buy")
async def buy_subscription(req: BuySubscriptionRequest, request: Request):
    """Purchase or upgrade one subscription exactly once."""
    user = await get_current_user(request)
    user_id = str(user["_id"])

    if req.plan not in SUBSCRIPTION_PLANS:
        raise HTTPException(status_code=400, detail=f"Ungültiger Plan. Verfügbar: {', '.join(SUBSCRIPTION_PLANS.keys())}")
    if req.billing_cycle not in {"monthly", "yearly"}:
        raise HTTPException(status_code=400, detail="Ungültiger Abrechnungszeitraum")

    idempotency_key = _require_subscription_idempotency_key(req.idempotency_key, request)
    key_hash = hashlib.sha256(idempotency_key.encode("utf-8")).hexdigest()[:20]
    subscription_id = f"SUB-{key_hash.upper()}"

    existing_same = await db.subscriptions.find_one(
        {"subscription_id": subscription_id, "user_id": user_id},
        {"_id": 0},
    )
    if existing_same and existing_same.get("status") == "active":
        fresh_user = await db.users.find_one({"_id": user["_id"]}, {"balance": 1, "_id": 0}) or {}
        return {
            "ok": True,
            "subscription": existing_same,
            "new_balance": round(float(fresh_user.get("balance") or 0), 2),
            "message": f"{existing_same.get('plan_name', req.plan)}-Abo bereits aktiviert",
            "replayed": True,
        }

    lock_token = secrets.token_hex(8)
    lock = await db.users.update_one(
        {
            "_id": user["_id"],
            "$or": [
                {"subscription_purchase_lock": {"$exists": False}},
                {"subscription_purchase_lock": None},
                {"subscription_purchase_lock": False},
            ],
        },
        {"$set": {
            "subscription_purchase_lock": lock_token,
            "subscription_purchase_lock_at": datetime.now(timezone.utc).isoformat(),
        }},
    )
    if lock.modified_count != 1:
        raise HTTPException(status_code=409, detail="Eine Abo-Anfrage wird bereits verarbeitet")

    try:
        # Re-check the same idempotent purchase after acquiring the user lock.
        existing_same = await db.subscriptions.find_one(
            {"subscription_id": subscription_id, "user_id": user_id},
            {"_id": 0},
        )
        if existing_same and existing_same.get("status") == "active":
            fresh_user = await db.users.find_one({"_id": user["_id"]}, {"balance": 1, "_id": 0}) or {}
            return {
                "ok": True,
                "subscription": existing_same,
                "new_balance": round(float(fresh_user.get("balance") or 0), 2),
                "message": f"{existing_same.get('plan_name', req.plan)}-Abo bereits aktiviert",
                "replayed": True,
            }

        plan = SUBSCRIPTION_PLANS[req.plan]
        if req.billing_cycle == "yearly":
            price = float(plan["price_yearly"])
            duration_days = 365
        else:
            price = float(plan["price_monthly"])
            duration_days = 30

        existing = await get_user_subscription(user_id)
        if existing and existing.get("subscription_id") != subscription_id:
            current_plan = existing.get("plan")
            plan_order = list(SUBSCRIPTION_PLANS.keys())
            if current_plan not in plan_order or plan_order.index(req.plan) <= plan_order.index(current_plan):
                raise HTTPException(
                    status_code=400,
                    detail=f"Du hast bereits {SUBSCRIPTION_PLANS.get(current_plan, {}).get('name', current_plan)}. Upgrade auf einen höheren Plan möglich.",
                )

            expires = datetime.fromisoformat(existing["expires_at"].replace("Z", "+00:00"))
            now_credit = datetime.now(timezone.utc)
            remaining_days = max(0, (expires - now_credit).days)
            if remaining_days > 0:
                old_price = (
                    SUBSCRIPTION_PLANS[current_plan]["price_yearly"] / 365
                    if existing.get("billing_cycle") == "yearly"
                    else SUBSCRIPTION_PLANS[current_plan]["price_monthly"] / 30
                )
                price = max(0.0, round(price - (old_price * remaining_days), 2))

        now = datetime.now(timezone.utc)
        expires_at = now + timedelta(days=duration_days)

        payment_result = await debit_wallet(
            user_id=user_id,
            amount=price,
            tx_type=TransactionType.SUBSCRIPTION,
            description=f"Subscription: {plan['name']} ({req.billing_cycle})",
            reference=f"SUBPAY-{key_hash[:12].upper()}",
            metadata={
                "subscription_id": subscription_id,
                "plan": req.plan,
                "billing_cycle": req.billing_cycle,
                "duration_days": duration_days,
            },
            idempotency_key=idempotency_key,
        )
        if not payment_result.success:
            raise HTTPException(status_code=400, detail=payment_result.error or "Abo-Zahlung fehlgeschlagen")

        subscription = {
            "subscription_id": subscription_id,
            "user_id": user_id,
            "plan": req.plan,
            "plan_name": plan["name"],
            "billing_cycle": req.billing_cycle,
            "price_paid": price,
            "auto_renew": req.auto_renew,
            "status": "pending_activation",
            "started_at": now.isoformat(),
            "expires_at": expires_at.isoformat(),
            "next_billing_at": expires_at.isoformat() if req.auto_renew else None,
            "benefits": plan["benefits"],
            "transaction_id": payment_result.transaction_id,
            "idempotency_key": idempotency_key,
            "created_at": now.isoformat(),
        }
        await db.subscriptions.update_one(
            {"subscription_id": subscription_id, "user_id": user_id},
            {"$setOnInsert": subscription},
            upsert=True,
        )

        if existing and existing.get("subscription_id") != subscription_id:
            await db.subscriptions.update_one(
                {"subscription_id": existing["subscription_id"], "user_id": user_id, "status": "active"},
                {"$set": {
                    "status": "upgraded",
                    "upgraded_to": subscription_id,
                    "upgraded_at": now.isoformat(),
                }},
            )

        await db.subscriptions.update_one(
            {"subscription_id": subscription_id, "user_id": user_id},
            {"$set": {"status": "active", "activated_at": datetime.now(timezone.utc).isoformat()}},
        )
        active_subscription = await db.subscriptions.find_one(
            {"subscription_id": subscription_id, "user_id": user_id},
            {"_id": 0},
        ) or {**subscription, "status": "active"}

        await apply_subscription_to_user(user_id, active_subscription)

        free_boosts = int(plan["benefits"].get("free_boosts", 0) or 0)
        if free_boosts > 0:
            await db.user_subscription_perks.update_one(
                {"user_id": user_id, "month": now.strftime("%Y-%m")},
                {"$set": {
                    "free_boosts_remaining": free_boosts,
                    "free_transfers_remaining": int(plan["benefits"].get("free_transfers", 0) or 0),
                    "subscription_id": subscription_id,
                    "updated_at": now.isoformat(),
                }},
                upsert=True,
            )

        await _record_subscription_revenue_once(subscription_id, price, now)

        await db.notifications.update_one(
            {"id": f"SUB-ACT-{key_hash}", "user_id": user_id},
            {"$setOnInsert": {
                "id": f"SUB-ACT-{key_hash}",
                "user_id": user_id,
                "type": "subscription_activated",
                "title": f"{plan['name']} aktiviert!",
                "message": f"Dein {plan['name']}-Abo ist jetzt aktiv bis {expires_at.strftime('%d.%m.%Y')}",
                "data": {"subscription_id": subscription_id, "plan": req.plan},
                "read": False,
                "created_at": now.isoformat(),
            }},
            upsert=True,
        )

        logger.info("Subscription purchased: %s - %s (%s) by %s", subscription_id, req.plan, req.billing_cycle, user_id)
        return {
            "ok": True,
            "subscription": active_subscription,
            "new_balance": payment_result.new_balance,
            "message": f"{plan['name']}-Abo erfolgreich aktiviert!",
            "replayed": payment_result.idempotent_replay,
        }
    finally:
        await db.users.update_one(
            {"_id": user["_id"], "subscription_purchase_lock": lock_token},
            {"$set": {
                "subscription_purchase_lock": None,
                "subscription_purchase_lock_released_at": datetime.now(timezone.utc).isoformat(),
            }},
        )


# ══════════════════════════════════════════════════════════════════════════════
# GET MY SUBSCRIPTION
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/my")
async def get_my_subscription(request: Request):
    """Get current user's subscription status."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    subscription = await get_user_subscription(user_id)
    
    if not subscription:
        return {
            "has_subscription": False,
            "subscription": None,
            "benefits": await get_subscription_benefits(user_id),
        }
    
    # Get perks status for this month
    now = datetime.now(timezone.utc)
    perks = await db.user_subscription_perks.find_one({
        "user_id": user_id,
        "month": now.strftime("%Y-%m")
    }, {"_id": 0})
    
    # Calculate days remaining
    expires = datetime.fromisoformat(subscription["expires_at"].replace("Z", "+00:00"))
    days_remaining = max(0, (expires - now).days)
    
    plan = SUBSCRIPTION_PLANS.get(subscription.get("plan"), {})
    
    return {
        "has_subscription": True,
        "subscription": {
            **subscription,
            "days_remaining": days_remaining,
            "features": plan.get("features", []),
        },
        "benefits": await get_subscription_benefits(user_id),
        "perks": perks or {
            "free_boosts_remaining": plan.get("benefits", {}).get("free_boosts", 0),
            "free_transfers_remaining": plan.get("benefits", {}).get("free_transfers", 0),
        },
    }


# ══════════════════════════════════════════════════════════════════════════════
# CANCEL SUBSCRIPTION
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/cancel")
async def cancel_subscription(req: CancelSubscriptionRequest, request: Request):
    """
    Cancel subscription.
    Benefits remain until expiry, but auto-renew is disabled.
    """
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    subscription = await get_user_subscription(user_id)
    if not subscription:
        raise HTTPException(status_code=404, detail="Kein aktives Abo gefunden")
    
    now = datetime.now(timezone.utc)
    
    # Disable auto-renew
    await db.subscriptions.update_one(
        {"subscription_id": subscription["subscription_id"]},
        {"$set": {
            "auto_renew": False,
            "cancelled_at": now.isoformat(),
            "cancellation_reason": req.reason,
        }}
    )
    
    # Notification
    await db.notifications.insert_one({
        "id": secrets.token_hex(8),
        "user_id": user_id,
        "type": "subscription_cancelled",
        "title": "Abo gekündigt",
        "message": f"Dein Abo läuft am {subscription['expires_at'][:10]} aus. Du kannst jederzeit wieder aktivieren.",
        "data": {"subscription_id": subscription["subscription_id"]},
        "read": False,
        "created_at": now.isoformat(),
    })

    
    logger.info(f"Subscription cancelled: {subscription['subscription_id']} by {user_id}")
    
    return {
        "ok": True,
        "message": f"Abo gekündigt. Vorteile aktiv bis {subscription['expires_at'][:10]}",
        "expires_at": subscription["expires_at"],
    }


# ══════════════════════════════════════════════════════════════════════════════
# TOGGLE AUTO-RENEW
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/toggle-auto-renew")
async def toggle_auto_renew(request: Request):
    """Toggle auto-renew on/off."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    subscription = await get_user_subscription(user_id)
    if not subscription:
        raise HTTPException(status_code=404, detail="Kein aktives Abo gefunden")
    
    new_state = not subscription.get("auto_renew", True)
    
    await db.subscriptions.update_one(
        {"subscription_id": subscription["subscription_id"]},
        {"$set": {"auto_renew": new_state}}
    )

    return {
        "ok": True,
        "auto_renew": new_state,
        "message": "Automatische Verlängerung " + ("aktiviert" if new_state else "deaktiviert"),
    }


# ══════════════════════════════════════════════════════════════════════════════
# SUBSCRIPTION HISTORY
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/history")
async def get_subscription_history(request: Request, limit: int = 20):
    """Get user's subscription history."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    history = await db.subscriptions.find(
        {"user_id": user_id},
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    return {"history": history, "total": len(history)}


# ══════════════════════════════════════════════════════════════════════════════
# USE FREE BOOST (Subscription Perk)
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/use-free-boost")
async def use_free_boost(request: Request):
    """Use a free boost from subscription perks."""
    body = await request.json()
    target_id = body.get("target_id")
    target_type = body.get("target_type", "listing")
    
    if not target_id:
        raise HTTPException(status_code=400, detail="target_id erforderlich")
    
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    # Check subscription
    subscription = await get_user_subscription(user_id)
    if not subscription:
        raise HTTPException(status_code=403, detail="Kein aktives Abo")
    
    now = datetime.now(timezone.utc)
    month = now.strftime("%Y-%m")
    
    # Check remaining free boosts
    perks = await db.user_subscription_perks.find_one({
        "user_id": user_id,
        "month": month
    })
    
    if not perks or perks.get("free_boosts_remaining", 0) <= 0:
        raise HTTPException(status_code=400, detail="Keine Gratis-Boosts mehr diesen Monat")
    
    # Create boost
    boost_id = secrets.token_hex(8)
    expires_at = now + timedelta(days=7)
    
    boost = {
        "boost_id": boost_id,
        "user_id": user_id,
        "target_id": target_id,
        "target_type": target_type,
        "boost_type": "featured",  # Standard free boost is "featured"
        "priority": 2,
        "price_paid": 0,
        "is_free": True,
        "subscription_id": subscription["subscription_id"],
        "starts_at": now.isoformat(),
        "expires_at": expires_at.isoformat(),
        "status": "active",
        "views": 0,
        "clicks": 0,
        "created_at": now.isoformat(),
    }
    
    await db.boosts.insert_one(boost)
    
    # Decrement free boosts
    await db.user_subscription_perks.update_one(
        {"user_id": user_id, "month": month},
        {"$inc": {"free_boosts_remaining": -1}}
    )
    
    boost.pop("_id", None)
    
    updated_perks = await db.user_subscription_perks.find_one({
        "user_id": user_id,
        "month": month
    }, {"_id": 0})
    
    return {
        "ok": True,
        "boost": boost,
        "free_boosts_remaining": updated_perks.get("free_boosts_remaining", 0),
        "message": "Gratis-Boost aktiviert!",
    }


# ══════════════════════════════════════════════════════════════════════════════
# ADMIN ENDPOINTS
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/admin/stats")
async def admin_subscription_stats(request: Request):
    """Admin: Get subscription statistics."""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Nur Admin")
    
    now = datetime.now(timezone.utc)
    this_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    
    # Active subscriptions count
    active_count = await db.subscriptions.count_documents({
        "status": "active",
        "expires_at": {"$gt": now.isoformat()}
    })
    
    # By plan
    by_plan = {}
    for plan_id in SUBSCRIPTION_PLANS.keys():
        count = await db.subscriptions.count_documents({
            "plan": plan_id,
            "status": "active",
            "expires_at": {"$gt": now.isoformat()}
        })
        by_plan[plan_id] = count
    
    # Revenue this month
    monthly_subs = await db.subscriptions.find({
        "created_at": {"$gte": this_month.isoformat()}
    }).to_list(1000)
    monthly_revenue = sum(s.get("price_paid", 0) for s in monthly_subs)
    
    # Cancellations this month
    cancelled = await db.subscriptions.count_documents({
        "cancelled_at": {"$gte": this_month.isoformat()}
    })
    
    # MRR (Monthly Recurring Revenue)
    active_monthly = await db.subscriptions.find({
        "status": "active",
        "billing_cycle": "monthly",
        "auto_renew": True,
        "expires_at": {"$gt": now.isoformat()}
    }).to_list(1000)
    
    active_yearly = await db.subscriptions.find({
        "status": "active",
        "billing_cycle": "yearly",
        "auto_renew": True,
        "expires_at": {"$gt": now.isoformat()}
    }).to_list(1000)
    
    mrr = sum(s.get("price_paid", 0) for s in active_monthly)
    mrr += sum(s.get("price_paid", 0) / 12 for s in active_yearly)
    
    return {
        "active_subscriptions": active_count,
        "by_plan": by_plan,
        "monthly_revenue": round(monthly_revenue, 2),
        "new_this_month": len(monthly_subs),
        "cancelled_this_month": cancelled,
        "mrr": round(mrr, 2),
        "arr": round(mrr * 12, 2),
    }


@router.get("/admin/all")
async def admin_get_all_subscriptions(
    request: Request, 
    status: str = None, 
    plan: str = None,
    limit: int = 50
):
    """Admin: Get all subscriptions."""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Nur Admin")
    
    query = {}
    if status == "active":
        query["status"] = "active"
        query["expires_at"] = {"$gt": datetime.now(timezone.utc).isoformat()}
    elif status == "expired":
        query["$or"] = [
            {"status": {"$ne": "active"}},
            {"expires_at": {"$lte": datetime.now(timezone.utc).isoformat()}}
        ]
    
    if plan and plan in SUBSCRIPTION_PLANS:
        query["plan"] = plan
    
    subs = await db.subscriptions.find(query, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    
    # Enrich with user info
    for sub in subs:
        user_info = await db.users.find_one(
            {"_id": ObjectId(sub["user_id"]) if ObjectId.is_valid(sub["user_id"]) else sub["user_id"]},
            {"email": 1, "name": 1}
        )
        if user_info:
            sub["user_email"] = user_info.get("email")
            sub["user_name"] = user_info.get("name")
    
    return {"subscriptions": subs, "total": len(subs)}


@router.post("/admin/grant")
async def admin_grant_subscription(request: Request):
    """Admin: Grant free subscription to user."""
    body = await request.json()
    target_user_id = body.get("user_id")
    plan = body.get("plan", "premium")
    duration_days = body.get("duration_days", 30)
    
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Nur Admin")
    
    if not target_user_id:
        raise HTTPException(status_code=400, detail="user_id erforderlich")
    
    if plan not in SUBSCRIPTION_PLANS:
        raise HTTPException(status_code=400, detail="Ungültiger Plan")
    
    plan_info = SUBSCRIPTION_PLANS[plan]
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(days=duration_days)
    subscription_id = secrets.token_hex(8)
    
    subscription = {
        "subscription_id": subscription_id,
        "user_id": target_user_id,
        "plan": plan,
        "plan_name": plan_info["name"],
        "billing_cycle": "granted",
        "price_paid": 0,
        "auto_renew": False,
        "status": "active",
        "granted_by": str(user["_id"]),
        "started_at": now.isoformat(),
        "expires_at": expires_at.isoformat(),
        "benefits": plan_info["benefits"],
        "created_at": now.isoformat(),
    }
    
    await db.subscriptions.insert_one(subscription)
    await apply_subscription_to_user(target_user_id, subscription)
    
    subscription.pop("_id", None)
    
    # Notify user
    await db.notifications.insert_one({
        "id": secrets.token_hex(8),
        "user_id": target_user_id,
        "type": "subscription_granted",
        "title": f"{plan_info['name']}-Abo geschenkt!",
        "message": f"Du hast ein kostenloses {plan_info['name']}-Abo für {duration_days} Tage erhalten!",
        "data": {"subscription_id": subscription_id},
        "read": False,
        "created_at": now.isoformat(),
    })
    
    return {"ok": True, "subscription": subscription}


@router.post("/admin/revoke/{subscription_id}")
async def admin_revoke_subscription(subscription_id: str, request: Request):
    """Admin: Revoke a subscription."""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Nur Admin")
    
    sub = await db.subscriptions.find_one({"subscription_id": subscription_id})
    if not sub:
        raise HTTPException(status_code=404, detail="Abo nicht gefunden")
    
    now = datetime.now(timezone.utc)
    
    await db.subscriptions.update_one(
        {"subscription_id": subscription_id},
        {"$set": {
            "status": "revoked",
            "revoked_by": str(user["_id"]),
            "revoked_at": now.isoformat(),
        }}
    )
    
    await remove_subscription_from_user(sub["user_id"])
    
    return {"ok": True, "message": "Abo widerrufen"}


# ══════════════════════════════════════════════════════════════════════════════
# AUTO-RENEW PROCESSING (Called by background job)
# ══════════════════════════════════════════════════════════════════════════════

async def process_subscription_renewals():
    """
    Process auto-renewals for expiring subscriptions.
    Called by background task every hour.
    Returns count of successful renewals.
    """
    now = datetime.now(timezone.utc)
    renewal_window = now + timedelta(hours=24)  # Process renewals due in next 24h
    
    # Find subscriptions due for renewal
    due_renewals = await db.subscriptions.find({
        "status": "active",
        "auto_renew": True,
        "expires_at": {"$lte": renewal_window.isoformat()},
    }).to_list(100)
    
    renewed_count = 0
    failed_count = 0
    
    for sub in due_renewals:
        user_id = sub["user_id"]
        plan = SUBSCRIPTION_PLANS.get(sub["plan"])
        
        if not plan:
            continue
        
        # Determine renewal price
        if sub.get("billing_cycle") == "yearly":
            price = plan["price_yearly"]
            duration_days = 365
        else:
            price = plan["price_monthly"]
            duration_days = 30
        
        # Check user balance
        user = await db.users.find_one(
            {"_id": ObjectId(user_id) if ObjectId.is_valid(user_id) else user_id}
        )
        
        if not user or user.get("balance", 0) < price:
            # Insufficient balance - notify user
            await db.notifications.insert_one({
                "id": secrets.token_hex(8),
                "user_id": user_id,
                "type": "subscription_renewal_failed",
                "title": "Abo-Verlängerung fehlgeschlagen",
                "message": f"Nicht genug Guthaben (€{price:.2f} benötigt). Bitte aufladen!",
                "data": {"subscription_id": sub["subscription_id"]},
                "read": False,
                "created_at": now.isoformat(),
            })
            failed_count += 1
            continue
        
        # Bind one renewal payment to the subscription's current expiry period.
        old_expires = sub["expires_at"]
        renewal_key = hashlib.sha256(
            f"{sub['subscription_id']}:{old_expires}".encode("utf-8")
        ).hexdigest()[:24]
        payment_result = await debit_wallet(
            user_id=user_id,
            amount=price,
            tx_type=TransactionType.SUBSCRIPTION_RENEWAL,
            description=f"Abo-Verlängerung: {plan['name']}",
            reference=f"RENEWAL-{sub['subscription_id'][:8].upper()}-{renewal_key[:8].upper()}",
            metadata={
                "subscription_id": sub["subscription_id"],
                "renewal": True,
                "renewal_key": renewal_key,
                "old_expires_at": old_expires,
            },
            idempotency_key=f"subscription-renewal:{renewal_key}",
        )
        
        if not payment_result.success:
            failed_count += 1
            continue
        
        # Extend exactly once from the expiry that was actually paid for.
        new_expires = datetime.fromisoformat(old_expires.replace("Z", "+00:00")) + timedelta(days=duration_days)
        extended = await db.subscriptions.update_one(
            {
                "subscription_id": sub["subscription_id"],
                "status": "active",
                "expires_at": old_expires,
                "last_renewal_key": {"$ne": renewal_key},
            },
            {"$set": {
                "expires_at": new_expires.isoformat(),
                "next_billing_at": new_expires.isoformat(),
                "last_renewed_at": now.isoformat(),
                "renewed_for_period": now.strftime("%Y-%m"),
                "last_renewal_key": renewal_key,
                "last_renewal_transaction_id": payment_result.transaction_id,
            }, "$inc": {"renewal_count": 1}}
        )
        if extended.modified_count != 1:
            current = await db.subscriptions.find_one(
                {"subscription_id": sub["subscription_id"]},
                {"_id": 0, "last_renewal_key": 1, "expires_at": 1},
            ) or {}
            if current.get("last_renewal_key") != renewal_key:
                logger.error(
                    "Subscription renewal payment completed but extension needs reconciliation: %s",
                    sub["subscription_id"],
                )
                failed_count += 1
                continue
        
        # Update user subscription info
        await apply_subscription_to_user(user_id, {
            **sub,
            "expires_at": new_expires.isoformat()
        })
        
        # Reset monthly perks
        await db.user_subscription_perks.update_one(
            {"user_id": user_id, "month": now.strftime("%Y-%m")},
            {"$set": {
                "free_boosts_remaining": plan["benefits"].get("free_boosts", 0),
                "free_transfers_remaining": plan["benefits"].get("free_transfers", 0),
                "updated_at": now.isoformat(),
            }},
            upsert=True
        )
        
        # Record each paid renewal exactly once.
        await _record_subscription_revenue_once(
            f"renewal:{sub['subscription_id']}:{renewal_key}",
            price,
            now,
        )
        
        # Notify user exactly once for this renewal period.
        await db.notifications.update_one(
            {"_id": f"subscription-renewed:{sub['subscription_id']}:{renewal_key}"},
            {"$setOnInsert": {
                "_id": f"subscription-renewed:{sub['subscription_id']}:{renewal_key}",
                "id": f"subscription-renewed-{renewal_key}",
                "user_id": user_id,
                "type": "subscription_renewed",
                "title": "Abo verlängert!",
                "message": f"Dein {plan['name']}-Abo wurde bis {new_expires.strftime('%d.%m.%Y')} verlängert",
                "data": {"subscription_id": sub["subscription_id"], "renewal_key": renewal_key},
                "read": False,
                "created_at": now.isoformat(),
            }},
            upsert=True,
        )
        
        renewed_count += 1
        logger.info(f"Subscription renewed: {sub['subscription_id']} for {user_id}")
    
    return {"renewed": renewed_count, "failed": failed_count}


async def expire_subscriptions():
    """
    Mark expired subscriptions and remove benefits.
    Called by background task.
    """
    now = datetime.now(timezone.utc)
    
    # Find expired but still marked active
    expired = await db.subscriptions.find({
        "status": "active",
        "expires_at": {"$lte": now.isoformat()},
        "auto_renew": False
    }).to_list(100)
    
    expired_count = 0
    
    for sub in expired:
        await db.subscriptions.update_one(
            {"subscription_id": sub["subscription_id"]},
            {"$set": {"status": "expired", "expired_at": now.isoformat()}}
        )
        
        await remove_subscription_from_user(sub["user_id"])
        
        # Notify user
        await db.notifications.insert_one({
            "id": secrets.token_hex(8),
            "user_id": sub["user_id"],
            "type": "subscription_expired",
            "title": "Abo abgelaufen",
            "message": f"Dein {sub.get('plan_name', 'Premium')}-Abo ist abgelaufen. Jetzt wieder aktivieren!",
            "data": {"subscription_id": sub["subscription_id"]},
            "read": False,
            "created_at": now.isoformat(),
        })
        
        expired_count += 1
        logger.info(f"Subscription expired: {sub['subscription_id']} for {sub['user_id']}")
    
    return expired_count


# Admin endpoint to manually trigger renewals/expiry
@router.post("/admin/process-renewals")
async def admin_process_renewals(request: Request):
    """Admin: Manually process subscription renewals."""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Nur Admin")
    
    renewal_result = await process_subscription_renewals()
    expired_count = await expire_subscriptions()
    
    return {
        "ok": True,
        "renewals": renewal_result,
        "expired": expired_count,
    }
