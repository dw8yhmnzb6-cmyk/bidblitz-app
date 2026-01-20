"""VIP Subscription Router - Monthly VIP membership with bonus bids"""
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone, timedelta
from typing import Optional
import uuid
import os
import stripe

from config import db, logger, FRONTEND_URL
from dependencies import get_current_user

router = APIRouter(prefix="/vip", tags=["VIP"])

# Stripe configuration
STRIPE_API_KEY = os.environ.get('STRIPE_API_KEY')
if STRIPE_API_KEY:
    stripe.api_key = STRIPE_API_KEY

# VIP Plans - Reduced monthly bids
VIP_PLANS = [
    {
        "id": "vip_basic",
        "name": "VIP Basic",
        "price_monthly": 9.99,
        "monthly_bids": 10,
        "benefits": [
            "10 Gratis-Gebote pro Monat",
            "5% Rabatt auf Gebotspakete",
            "VIP Badge im Profil"
        ],
        "badge_color": "#C0C0C0"  # Silver
    },
    {
        "id": "vip_gold",
        "name": "VIP Gold",
        "price_monthly": 19.99,
        "monthly_bids": 25,
        "benefits": [
            "25 Gratis-Gebote pro Monat",
            "10% Rabatt auf Gebotspakete",
            "VIP Gold Badge im Profil",
            "Prioritäts-Support"
        ],
        "badge_color": "#FFD700",  # Gold
        "popular": True
    },
    {
        "id": "vip_platinum",
        "name": "VIP Platinum",
        "price_monthly": 39.99,
        "monthly_bids": 50,
        "benefits": [
            "50 Gratis-Gebote pro Monat",
            "15% Rabatt auf Gebotspakete",
            "VIP Platinum Badge im Profil",
            "Prioritäts-Support",
            "Exklusive Auktionen"
        ],
        "badge_color": "#E5E4E2"  # Platinum
    }
]


@router.get("/plans")
async def get_vip_plans():
    """Get all available VIP subscription plans"""
    return VIP_PLANS


@router.get("/status")
async def get_vip_status(user: dict = Depends(get_current_user)):
    """Get current VIP status for user"""
    subscription = await db.vip_subscriptions.find_one(
        {"user_id": user["id"], "status": "active"},
        {"_id": 0}
    )
    
    if not subscription:
        return {
            "is_vip": False,
            "plan": None,
            "expires_at": None,
            "monthly_bids_remaining": 0,
            "next_renewal": None
        }
    
    plan = next((p for p in VIP_PLANS if p["id"] == subscription["plan_id"]), None)
    
    return {
        "is_vip": True,
        "plan": plan,
        "plan_id": subscription["plan_id"],
        "started_at": subscription.get("started_at"),
        "expires_at": subscription.get("current_period_end"),
        "monthly_bids_remaining": subscription.get("monthly_bids_remaining", 0),
        "next_renewal": subscription.get("current_period_end"),
        "badge_color": plan.get("badge_color") if plan else None
    }


@router.post("/subscribe/{plan_id}")
async def create_vip_subscription(plan_id: str, user: dict = Depends(get_current_user)):
    """Create a VIP subscription checkout session"""
    if not STRIPE_API_KEY:
        raise HTTPException(status_code=503, detail="Payment service unavailable")
    
    plan = next((p for p in VIP_PLANS if p["id"] == plan_id), None)
    if not plan:
        raise HTTPException(status_code=400, detail="Invalid VIP plan")
    
    # Check if user already has active subscription
    existing = await db.vip_subscriptions.find_one({
        "user_id": user["id"],
        "status": "active"
    })
    
    if existing:
        raise HTTPException(status_code=400, detail="Sie haben bereits ein aktives VIP-Abo")
    
    try:
        # Create Stripe checkout session with price_data (no need for pre-created products)
        session = stripe.checkout.Session.create(
            payment_method_types=["card"],
            line_items=[{
                "price_data": {
                    "currency": "eur",
                    "unit_amount": int(plan["price_monthly"] * 100),
                    "recurring": {"interval": "month"},
                    "product_data": {
                        "name": plan["name"],
                        "description": f"VIP Mitgliedschaft - {plan['monthly_bids']} Gebote/Monat"
                    }
                },
                "quantity": 1
            }],
            mode="subscription",
            success_url=f"{FRONTEND_URL}/vip/success?session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url=f"{FRONTEND_URL}/vip?canceled=true",
            metadata={
                "user_id": user["id"],
                "plan_id": plan_id,
                "monthly_bids": str(plan["monthly_bids"])
            },
            subscription_data={
                "metadata": {
                    "user_id": user["id"],
                    "plan_id": plan_id
                }
            }
        )
        
        return {
            "session_id": session.id,
            "url": session.url
        }
        
    except stripe.error.StripeError as e:
        logger.error(f"Stripe VIP subscription error: {e}")
        raise HTTPException(status_code=500, detail=f"Payment error: {str(e)}")


@router.post("/activate")
async def activate_vip_subscription(session_id: str, user: dict = Depends(get_current_user)):
    """Activate VIP subscription after successful payment"""
    if not STRIPE_API_KEY:
        raise HTTPException(status_code=503, detail="Payment service unavailable")
    
    try:
        session = stripe.checkout.Session.retrieve(session_id)
        
        if session.payment_status != "paid":
            raise HTTPException(status_code=400, detail="Payment not completed")
        
        plan_id = session.metadata.get("plan_id")
        monthly_bids = int(session.metadata.get("monthly_bids", 0))
        
        plan = next((p for p in VIP_PLANS if p["id"] == plan_id), None)
        if not plan:
            raise HTTPException(status_code=400, detail="Invalid plan")
        
        now = datetime.now(timezone.utc)
        period_end = now + timedelta(days=30)
        
        # Create VIP subscription record
        subscription_id = str(uuid.uuid4())
        await db.vip_subscriptions.insert_one({
            "id": subscription_id,
            "user_id": user["id"],
            "plan_id": plan_id,
            "stripe_subscription_id": session.subscription,
            "status": "active",
            "started_at": now.isoformat(),
            "current_period_start": now.isoformat(),
            "current_period_end": period_end.isoformat(),
            "monthly_bids": monthly_bids,
            "monthly_bids_remaining": monthly_bids,
            "created_at": now.isoformat()
        })
        
        # Credit monthly bids to user
        await db.users.update_one(
            {"id": user["id"]},
            {
                "$inc": {"bids_balance": monthly_bids},
                "$set": {
                    "is_vip": True,
                    "vip_plan": plan_id,
                    "vip_badge_color": plan.get("badge_color"),
                    "vip_expires_at": period_end.isoformat()
                }
            }
        )
        
        logger.info(f"VIP subscription activated: {user['id']} - {plan_id}")
        
        return {
            "message": f"VIP {plan['name']} erfolgreich aktiviert!",
            "monthly_bids_credited": monthly_bids,
            "expires_at": period_end.isoformat()
        }
        
    except stripe.error.StripeError as e:
        logger.error(f"Stripe VIP activation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/cancel")
async def cancel_vip_subscription(user: dict = Depends(get_current_user)):
    """Cancel VIP subscription"""
    subscription = await db.vip_subscriptions.find_one({
        "user_id": user["id"],
        "status": "active"
    })
    
    if not subscription:
        raise HTTPException(status_code=404, detail="Kein aktives VIP-Abo gefunden")
    
    try:
        # Cancel in Stripe
        if subscription.get("stripe_subscription_id"):
            stripe.Subscription.modify(
                subscription["stripe_subscription_id"],
                cancel_at_period_end=True
            )
        
        # Update local record
        await db.vip_subscriptions.update_one(
            {"id": subscription["id"]},
            {"$set": {"cancel_at_period_end": True}}
        )
        
        return {
            "message": "VIP-Abo wird zum Ende der Laufzeit gekündigt",
            "ends_at": subscription.get("current_period_end")
        }
        
    except stripe.error.StripeError as e:
        logger.error(f"Stripe VIP cancellation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Webhook handler for subscription renewals (called by Stripe)
@router.post("/webhook")
async def vip_webhook(request):
    """Handle Stripe webhook events for VIP subscriptions"""
    # This would be implemented to handle subscription renewal events
    # For now, we'll handle renewals manually or via a cron job
    pass


async def process_monthly_vip_renewals():
    """Background task to process monthly VIP renewals and credit bids"""
    now = datetime.now(timezone.utc)
    
    # Find subscriptions that need renewal
    subscriptions = await db.vip_subscriptions.find({
        "status": "active",
        "current_period_end": {"$lte": now.isoformat()},
        "cancel_at_period_end": {"$ne": True}
    }).to_list(100)
    
    for sub in subscriptions:
        try:
            # Check Stripe subscription status
            if sub.get("stripe_subscription_id"):
                stripe_sub = stripe.Subscription.retrieve(sub["stripe_subscription_id"])
                
                if stripe_sub.status == "active":
                    # Credit monthly bids
                    await db.users.update_one(
                        {"id": sub["user_id"]},
                        {"$inc": {"bids_balance": sub["monthly_bids"]}}
                    )
                    
                    # Update period
                    new_period_end = now + timedelta(days=30)
                    await db.vip_subscriptions.update_one(
                        {"id": sub["id"]},
                        {
                            "$set": {
                                "current_period_start": now.isoformat(),
                                "current_period_end": new_period_end.isoformat(),
                                "monthly_bids_remaining": sub["monthly_bids"]
                            }
                        }
                    )
                    
                    logger.info(f"VIP renewed for user {sub['user_id']}")
                    
                elif stripe_sub.status in ["canceled", "unpaid"]:
                    # Deactivate subscription
                    await db.vip_subscriptions.update_one(
                        {"id": sub["id"]},
                        {"$set": {"status": "canceled"}}
                    )
                    
                    await db.users.update_one(
                        {"id": sub["user_id"]},
                        {"$set": {"is_vip": False, "vip_plan": None}}
                    )
                    
                    logger.info(f"VIP canceled for user {sub['user_id']}")
                    
        except Exception as e:
            logger.error(f"VIP renewal error for {sub['id']}: {e}")
