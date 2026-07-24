"""
BidBlitz V2 - Premium/VIP Subscription System
€4.99 Basic / €9.99 Pro / €14.99 Elite — Monthly recurring
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from datetime import datetime, timezone, timedelta
from core.database import db
from core.security import get_current_user
import secrets

router = APIRouter(prefix="/api/premium", tags=["premium"])

PLANS = [
    {
        "plan_id": "basic", "name": "Basic", "price": 4.99, "color": "#3B82F6",
        "features": ["Keine P2P-Gebühren", "5% Cashback statt 3%", "5 Gratis Scooter-Minuten/Monat", "Promoted Listings: 1/Monat gratis"],
    },
    {
        "plan_id": "pro", "name": "Pro", "price": 9.99, "color": "#A855F7",
        "features": ["Alles aus Basic", "8% Cashback", "20 Gratis Scooter-Minuten/Monat", "Priority BlitzJobs", "VIP Auktionen", "Sofort-Auszahlung gratis"],
    },
    {
        "plan_id": "elite", "name": "Elite", "price": 14.99, "color": "#FFD700",
        "features": ["Alles aus Pro", "10% Cashback", "Unbegrenzte Scooter-Minuten", "Exklusive Deals & Rabatte", "Premium Support", "Keine Gebühren überall"],
    },
]


class SubscribeRequest(BaseModel):
    plan_id: str


@router.get("/plans")
async def get_plans(request: Request):
    try:
        user = await get_current_user(request)
        sub = await db.premium_subs.find_one(
            {"user_email": user.get("email", ""), "status": "active"}, {"_id": 0}
        )
        return {"plans": PLANS, "current_plan": sub}
    except:
        return {"plans": PLANS, "current_plan": None}


@router.post("/subscribe")
async def subscribe(req: SubscribeRequest, request: Request):
    user = await get_current_user(request)
    email = user.get("email", "")
    
    plan = next((p for p in PLANS if p["plan_id"] == req.plan_id), None)
    if not plan:
        raise HTTPException(400, "Plan nicht gefunden")
    
    # Check balance
    balance = user.get("balance", 0)
    if balance < plan["price"]:
        raise HTTPException(400, f"Nicht genug Guthaben. Benötigt: €{plan['price']:.2f}")
    
    # Cancel existing
    await db.premium_subs.update_many(
        {"user_email": email, "status": "active"},
        {"$set": {"status": "cancelled", "cancelled_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    # Deduct payment
    await db.users.update_one({"email": email}, {"$inc": {"balance": -plan["price"]}})
    
    now = datetime.now(timezone.utc)
    sub = {
        "sub_id": secrets.token_hex(8),
        "user_email": email,
        "plan_id": plan["plan_id"],
        "plan_name": plan["name"],
        "price": plan["price"],
        "status": "active",
        "started_at": now.isoformat(),
        "expires_at": (now + timedelta(days=30)).isoformat(),
        "auto_renew": True,
    }
    await db.premium_subs.insert_one(sub)
    
    # Update user premium status
    await db.users.update_one({"email": email}, {"$set": {"premium_plan": plan["plan_id"], "is_premium": True}})
    
    new_bal = (await db.users.find_one({"email": email})).get("balance", 0)
    
    return {"ok": True, "plan": plan["name"], "price": plan["price"], "new_balance": round(new_bal, 2),
            "message": f"{plan['name']} Abo für €{plan['price']:.2f}/Monat aktiviert!"}


@router.post("/cancel")
async def cancel_subscription(request: Request):
    user = await get_current_user(request)
    email = user.get("email", "")
    
    result = await db.premium_subs.update_one(
        {"user_email": email, "status": "active"},
        {"$set": {"status": "cancelled", "cancelled_at": datetime.now(timezone.utc).isoformat()}}
    )
    if result.modified_count == 0:
        raise HTTPException(400, "Kein aktives Abo")
    
    await db.users.update_one({"email": email}, {"$set": {"premium_plan": None, "is_premium": False}})
    return {"ok": True, "message": "Abo gekündigt"}
