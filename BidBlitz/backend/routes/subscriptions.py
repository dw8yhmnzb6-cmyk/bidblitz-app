# BidBlitz - Subscription Plans
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from datetime import datetime, timezone, timedelta
from uuid import uuid4
from core.database import db
from routes.auth import get_current_user

router = APIRouter(prefix="/api/subscriptions", tags=["Subscriptions"])

# Subscription plans
PLANS = {
    "scooter_pass": {
        "name": "Scooter Pass",
        "price": 6.0,
        "duration_days": 30,
        "benefits": ["Free unlocks", "30-min reservations", "10% off per-minute rate"],
    },
    "food_pass": {
        "name": "Food Pass",
        "price": 9.99,
        "duration_days": 30,
        "benefits": ["Free delivery on all orders", "Priority support", "Exclusive deals"],
    },
    "taxi_pass": {
        "name": "Taxi Pass",
        "price": 14.99,
        "duration_days": 30,
        "benefits": ["15% off all rides", "Priority matching", "No surge pricing"],
    },
    "premium_all": {
        "name": "Premium All-Access",
        "price": 24.99,
        "duration_days": 30,
        "benefits": ["All benefits from Scooter, Food, and Taxi Pass", "VIP support", "Early access to features"],
    },
}

@router.get("/plans")
async def get_plans():
    """Get available subscription plans"""
    return {"plans": PLANS}

@router.post("/subscribe")
async def subscribe(plan_id: str, user=Depends(get_current_user)):
    """Subscribe to a plan"""
    if plan_id not in PLANS:
        raise HTTPException(404, "Plan not found")
    
    plan = PLANS[plan_id]
    
    # Check user balance
    wallet = await db.wallet.find_one({"user_id": user["user_id"]}, {"_id": 0})
    if not wallet or wallet.get("balance", 0) < plan["price"]:
        raise HTTPException(400, "Insufficient balance")
    
    # Deduct from wallet
    await db.wallet.update_one(
        {"user_id": user["user_id"]},
        {"$inc": {"balance": -plan["price"]}}
    )
    
    # Create subscription
    start_date = datetime.now(timezone.utc)
    end_date = start_date + timedelta(days=plan["duration_days"])
    
    sub_id = str(uuid4())
    subscription = {
        "subscription_id": sub_id,
        "user_id": user["user_id"],
        "plan_id": plan_id,
        "plan_name": plan["name"],
        "price": plan["price"],
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat(),
        "status": "active",
        "auto_renew": True,
        "created_at": start_date.isoformat(),
    }
    
    await db.subscriptions.insert_one(subscription)
    
    return {"success": True, "subscription": subscription}

@router.get("/my-subscriptions")
async def get_my_subscriptions(user=Depends(get_current_user)):
    """Get user's active subscriptions"""
    subs = await db.subscriptions.find({
        "user_id": user["user_id"],
        "status": "active",
    }, {"_id": 0}).to_list(10)
    
    return {"subscriptions": subs}

@router.post("/{subscription_id}/cancel")
async def cancel_subscription(subscription_id: str, user=Depends(get_current_user)):
    """Cancel auto-renewal"""
    sub = await db.subscriptions.find_one({
        "subscription_id": subscription_id,
        "user_id": user["user_id"],
    })
    
    if not sub:
        raise HTTPException(404, "Subscription not found")
    
    await db.subscriptions.update_one(
        {"subscription_id": subscription_id},
        {"$set": {"auto_renew": False}}
    )
    
    return {"success": True, "message": "Auto-renewal cancelled"}

@router.get("/check-benefits")
async def check_benefits(service: str, user=Depends(get_current_user)):
    """Check if user has active subscription for service"""
    subs = await db.subscriptions.find({
        "user_id": user["user_id"],
        "status": "active",
        "end_date": {"$gt": datetime.now(timezone.utc).isoformat()},
    }, {"_id": 0}).to_list(10)
    
    benefits = []
    for sub in subs:
        if service in sub["plan_id"] or "all" in sub["plan_id"]:
            benefits.extend(PLANS[sub["plan_id"]]["benefits"])
    
    return {
        "has_subscription": len(benefits) > 0,
        "benefits": benefits,
    }
