# BidBlitz - Buy Now Pay Later (Klarna-style)
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone, timedelta
from uuid import uuid4
from core.database import db
from routes.auth import get_current_user

router = APIRouter(prefix="/api/bnpl", tags=["Buy Now Pay Later"])

# BNPL Plans
BNPL_PLANS = {
    "pay_in_3": {
        "name": "Pay in 3",
        "installments": 3,
        "interval_days": 30,
        "interest_rate": 0.0,
        "min_amount": 30,
        "max_amount": 1000,
    },
    "pay_in_30": {
        "name": "Pay in 30 days",
        "installments": 1,
        "interval_days": 30,
        "interest_rate": 0.0,
        "min_amount": 10,
        "max_amount": 2000,
    },
}

@router.get("/plans")
async def get_bnpl_plans():
    """Get available BNPL plans"""
    return {"plans": BNPL_PLANS}

@router.post("/check-eligibility")
async def check_bnpl_eligibility(amount: float, user=Depends(get_current_user)):
    """Check if user eligible for BNPL"""
    # Simple eligibility check (in production: credit score, payment history, etc.)
    user_doc = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0})
    
    # Check account age
    account_age_days = (datetime.now(timezone.utc) - datetime.fromisoformat(user_doc["created_at"])).days
    if account_age_days < 30:
        return {"eligible": False, "reason": "Account too new"}
    
    # Check outstanding BNPL debt
    outstanding = await db.bnpl_orders.find({
        "user_id": user["user_id"],
        "status": {"$in": ["active", "overdue"]},
    }).to_list(100)
    
    total_outstanding = sum(o.get("remaining_amount", 0) for o in outstanding)
    
    if total_outstanding > 500:
        return {"eligible": False, "reason": "Outstanding balance too high"}
    
    # Check amount limits
    if amount < 10:
        return {"eligible": False, "reason": "Amount too low (min €10)"}
    if amount > 2000:
        return {"eligible": False, "reason": "Amount too high (max €2000)"}
    
    # Determine available plans
    available_plans = []
    for plan_id, plan in BNPL_PLANS.items():
        if plan["min_amount"] <= amount <= plan["max_amount"]:
            available_plans.append({
                "plan_id": plan_id,
                **plan,
                "installment_amount": amount / plan["installments"],
            })
    
    return {
        "eligible": True,
        "available_plans": available_plans,
        "credit_limit": 2000 - total_outstanding,
    }

@router.post("/create")
async def create_bnpl_order(
    amount: float,
    plan_id: str,
    order_id: str,
    service_type: str,
    user=Depends(get_current_user)
):
    """Create BNPL order"""
    plan = BNPL_PLANS.get(plan_id)
    if not plan:
        raise HTTPException(404, "Plan not found")
    
    if amount < plan["min_amount"] or amount > plan["max_amount"]:
        raise HTTPException(400, "Amount out of plan range")
    
    # Check eligibility
    eligibility = await check_bnpl_eligibility(amount, user)
    if not eligibility["eligible"]:
        raise HTTPException(400, f"Not eligible: {eligibility['reason']}")
    
    # Create BNPL order
    bnpl_id = str(uuid4())
    installment_amount = amount / plan["installments"]
    
    # Generate payment schedule
    schedule = []
    for i in range(plan["installments"]):
        due_date = datetime.now(timezone.utc) + timedelta(days=(i + 1) * plan["interval_days"])
        schedule.append({
            "installment_number": i + 1,
            "amount": installment_amount,
            "due_date": due_date.isoformat(),
            "status": "pending",
        })
    
    bnpl_order = {
        "bnpl_id": bnpl_id,
        "user_id": user["user_id"],
        "order_id": order_id,
        "service_type": service_type,
        "total_amount": amount,
        "plan_id": plan_id,
        "installments": schedule,
        "remaining_amount": amount,
        "status": "active",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    
    await db.bnpl_orders.insert_one(bnpl_order)
    
    return {"success": True, "bnpl_id": bnpl_id, "schedule": schedule}

@router.post("/{bnpl_id}/pay-installment")
async def pay_installment(bnpl_id: str, installment_number: int, user=Depends(get_current_user)):
    """Pay an installment"""
    bnpl = await db.bnpl_orders.find_one({"bnpl_id": bnpl_id, "user_id": user["user_id"]})
    if not bnpl:
        raise HTTPException(404, "BNPL order not found")
    
    installment = next((i for i in bnpl["installments"] if i["installment_number"] == installment_number), None)
    if not installment:
        raise HTTPException(404, "Installment not found")
    
    if installment["status"] == "paid":
        raise HTTPException(400, "Already paid")
    
    # Check user balance
    wallet = await db.wallet.find_one({"user_id": user["user_id"]}, {"_id": 0})
    if not wallet or wallet.get("balance", 0) < installment["amount"]:
        raise HTTPException(400, "Insufficient balance")
    
    # Deduct from wallet
    await db.wallet.update_one(
        {"user_id": user["user_id"]},
        {"$inc": {"balance": -installment["amount"]}}
    )
    
    # Mark installment as paid
    await db.bnpl_orders.update_one(
        {"bnpl_id": bnpl_id, "installments.installment_number": installment_number},
        {
            "$set": {
                "installments.$.status": "paid",
                "installments.$.paid_at": datetime.now(timezone.utc).isoformat(),
            },
            "$inc": {"remaining_amount": -installment["amount"]}
        }
    )
    
    # Check if all paid
    updated_bnpl = await db.bnpl_orders.find_one({"bnpl_id": bnpl_id})
    all_paid = all(i["status"] == "paid" for i in updated_bnpl["installments"])
    
    if all_paid:
        await db.bnpl_orders.update_one(
            {"bnpl_id": bnpl_id},
            {"$set": {"status": "completed", "completed_at": datetime.now(timezone.utc).isoformat()}}
        )
    
    return {"success": True, "all_paid": all_paid}

@router.get("/my-orders")
async def get_my_bnpl_orders(user=Depends(get_current_user)):
    """Get user's BNPL orders"""
    orders = await db.bnpl_orders.find(
        {"user_id": user["user_id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    
    return {"orders": orders}
