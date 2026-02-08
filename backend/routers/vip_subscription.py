"""
VIP Subscription Router - Auto-Renewal VIP
"""
from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime, timezone, timedelta
import os
import stripe
import uuid

from config import db
from dependencies import get_current_user

router = APIRouter(prefix="/vip-subscription", tags=["vip-subscription"])

stripe.api_key = os.environ.get("STRIPE_API_KEY")

# VIP Plans
VIP_PLANS = {
    "monthly": {
        "id": "monthly",
        "name": "VIP Monatlich",
        "name_en": "VIP Monthly",
        "price": 9.99,
        "interval": "month",
        "bids_per_month": 15,
        "features": [
            "Exklusive VIP-Auktionen",
            "Keine Wartezeit beim Bieten", 
            "15 Gratis-Gebote/Monat",
            "VIP-Badge im Profil",
            "Prioritäts-Support"
        ]
    },
    "quarterly": {
        "id": "quarterly",
        "name": "VIP Quartalsweise",
        "name_en": "VIP Quarterly",
        "price": 24.99,
        "interval": "quarter",
        "bids_per_month": 20,
        "features": [
            "Alle monatlichen Vorteile",
            "20 Gratis-Gebote/Monat",
            "10% Rabatt auf Gebote-Käufe",
            "Früher Zugang zu neuen Produkten"
        ],
        "popular": True
    },
    "yearly": {
        "id": "yearly",
        "name": "VIP Jährlich",
        "name_en": "VIP Yearly",
        "price": 79.99,
        "interval": "year",
        "bids_per_month": 30,
        "features": [
            "Alle Quartalsvorteile",
            "30 Gratis-Gebote/Monat",
            "20% Rabatt auf Gebote-Käufe",
            "Exklusive Jahres-Boni",
            "Kostenloser Battle Pass"
        ],
        "best_value": True
    }
}


@router.get("/plans")
async def get_vip_plans(user: dict = Depends(get_current_user)):
    """Get available VIP subscription plans"""
    plans = []
    
    # Check current subscription
    current_sub = await db.vip_subscriptions.find_one(
        {"user_id": user["id"], "status": "active"},
        {"_id": 0}
    )
    
    for plan_id, plan in VIP_PLANS.items():
        plan_data = {**plan}
        if current_sub and current_sub.get("plan_id") == plan_id:
            plan_data["is_current"] = True
            plan_data["renews_at"] = current_sub.get("current_period_end")
        plans.append(plan_data)
    
    return {
        "plans": plans,
        "current_subscription": current_sub
    }


@router.post("/subscribe/{plan_id}")
async def subscribe_to_vip(plan_id: str, user: dict = Depends(get_current_user)):
    """Create VIP subscription"""
    if plan_id not in VIP_PLANS:
        raise HTTPException(status_code=404, detail="Plan nicht gefunden")
    
    plan = VIP_PLANS[plan_id]
    frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:3000")
    
    # Check for existing active subscription
    existing = await db.vip_subscriptions.find_one({
        "user_id": user["id"],
        "status": "active"
    })
    
    if existing:
        raise HTTPException(
            status_code=400, 
            detail="Du hast bereits ein aktives VIP-Abo. Bitte kündige es zuerst."
        )
    
    try:
        # Create Stripe checkout for subscription
        checkout_session = stripe.checkout.Session.create(
            payment_method_types=["card"],
            line_items=[{
                "price_data": {
                    "currency": "eur",
                    "product_data": {
                        "name": plan["name"],
                        "description": f"VIP-Mitgliedschaft mit {plan['bids_per_month']} Gebote/Monat",
                    },
                    "unit_amount": int(plan["price"] * 100),
                    "recurring": {
                        "interval": "month" if plan["interval"] == "month" else 
                                   "month" if plan["interval"] == "quarter" else "year",
                        "interval_count": 3 if plan["interval"] == "quarter" else 1
                    }
                },
                "quantity": 1,
            }],
            mode="subscription",
            success_url=f"{frontend_url}/vip?success=true&plan={plan_id}",
            cancel_url=f"{frontend_url}/vip?canceled=true",
            metadata={
                "user_id": user["id"],
                "plan_id": plan_id,
                "type": "vip_subscription"
            }
        )
        
        return {"checkout_url": checkout_session.url}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/activate/{plan_id}")
async def activate_vip_subscription(plan_id: str, user: dict = Depends(get_current_user)):
    """Activate VIP subscription after payment"""
    if plan_id not in VIP_PLANS:
        raise HTTPException(status_code=404, detail="Plan nicht gefunden")
    
    plan = VIP_PLANS[plan_id]
    now = datetime.now(timezone.utc)
    
    # Calculate period end
    if plan["interval"] == "month":
        period_end = now + timedelta(days=30)
    elif plan["interval"] == "quarter":
        period_end = now + timedelta(days=90)
    else:  # yearly
        period_end = now + timedelta(days=365)
    
    # Create subscription record
    subscription = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "plan_id": plan_id,
        "status": "active",
        "current_period_start": now.isoformat(),
        "current_period_end": period_end.isoformat(),
        "bids_per_month": plan["bids_per_month"],
        "created_at": now.isoformat()
    }
    
    await db.vip_subscriptions.insert_one(subscription)
    
    # Update user
    await db.users.update_one(
        {"id": user["id"]},
        {
            "$set": {
                "is_vip": True,
                "vip_status": "subscriber",
                "vip_expires_at": period_end.isoformat(),
                "vip_subscription_id": subscription["id"]
            },
            "$inc": {
                "bids_balance": plan["bids_per_month"]
            }
        }
    )
    
    # Grant Battle Pass for yearly
    if plan_id == "yearly":
        await db.user_battle_pass.update_one(
            {"user_id": user["id"]},
            {"$set": {"has_premium": True}},
            upsert=True
        )
    
    return {
        "success": True,
        "message": f"{plan['name']} aktiviert!",
        "bids_added": plan["bids_per_month"],
        "expires_at": period_end.isoformat()
    }


@router.post("/cancel")
async def cancel_vip_subscription(user: dict = Depends(get_current_user)):
    """Cancel VIP subscription"""
    subscription = await db.vip_subscriptions.find_one({
        "user_id": user["id"],
        "status": "active"
    })
    
    if not subscription:
        raise HTTPException(status_code=404, detail="Kein aktives Abo gefunden")
    
    # Cancel at period end (don't revoke immediately)
    await db.vip_subscriptions.update_one(
        {"id": subscription["id"]},
        {
            "$set": {
                "status": "canceled",
                "canceled_at": datetime.now(timezone.utc).isoformat(),
                "cancel_at_period_end": True
            }
        }
    )
    
    return {
        "success": True,
        "message": "Abo wird zum Ende der Laufzeit gekündigt",
        "active_until": subscription.get("current_period_end")
    }


@router.get("/status")
async def get_subscription_status(user: dict = Depends(get_current_user)):
    """Get current VIP subscription status"""
    subscription = await db.vip_subscriptions.find_one(
        {"user_id": user["id"], "status": {"$in": ["active", "canceled"]}},
        {"_id": 0}
    )
    
    if subscription:
        plan = VIP_PLANS.get(subscription.get("plan_id"), {})
        subscription["plan_details"] = plan
    
    # Manager and Influencer get FREE VIP access
    is_manager = user.get("is_manager", False) or user.get("role") == "manager"
    is_influencer = user.get("is_influencer", False)
    is_admin = user.get("is_admin", False)
    
    # Grant VIP status to admins, managers, and influencers
    has_vip = user.get("is_vip", False) or is_admin or is_manager or is_influencer
    
    return {
        "has_subscription": subscription is not None,
        "subscription": subscription,
        "is_vip": has_vip,
        "is_admin": is_admin,
        "is_manager": is_manager,
        "is_influencer": is_influencer,
        "plan": {
            "name": "VIP (Admin)" if is_admin else "VIP (Manager)" if is_manager else "VIP (Influencer)" if is_influencer else subscription.get("plan_details", {}).get("name") if subscription else None
        } if has_vip else None,
        "monthly_bids_remaining": subscription.get("monthly_bids_remaining", 0) if subscription else (999 if is_admin or is_manager or is_influencer else 0),
        "next_renewal": subscription.get("next_renewal") if subscription else None,
        "badge_color": "#FFD700"
    }


vip_subscription_router = router
