# BidBlitz - Split Payment System
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timezone
from uuid import uuid4
from core.database import db
from routes.auth import get_current_user

router = APIRouter(prefix="/api/split-payment", tags=["Split Payment"])

class SplitPaymentRequest(BaseModel):
    ride_id: Optional[str] = None
    order_id: Optional[str] = None
    split_with: List[str]  # email addresses
    
class SplitAcceptRequest(BaseModel):
    split_id: str

@router.post("/taxi/create")
async def create_taxi_split(req: SplitPaymentRequest, user=Depends(get_current_user)):
    """Split taxi fare with friends"""
    ride = await db.taxi_rides.find_one({"ride_id": req.ride_id, "user_id": user["user_id"]}, {"_id": 0})
    if not ride:
        raise HTTPException(404, "Ride not found")
    
    if ride["status"] != "completed":
        raise HTTPException(400, "Ride must be completed to split")
    
    total_amount = ride.get("total_cost", 0)
    num_people = len(req.split_with) + 1
    amount_per_person = total_amount / num_people
    
    split_id = str(uuid4())
    split_doc = {
        "split_id": split_id,
        "type": "taxi",
        "ride_id": req.ride_id,
        "initiator_id": user["user_id"],
        "total_amount": total_amount,
        "amount_per_person": amount_per_person,
        "split_with": req.split_with,
        "accepted_by": [],
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    
    await db.split_payments.insert_one(split_doc)
    
    # Send notifications to split participants
    for email in req.split_with:
        recipient = await db.users.find_one({"email": email}, {"_id": 0})
        if recipient:
            await db.notifications.insert_one({
                "notification_id": str(uuid4()),
                "user_id": recipient["user_id"],
                "type": "split_payment_request",
                "title": f"{user['first_name']} wants to split a ride",
                "message": f"Amount: €{amount_per_person:.2f}",
                "data": {"split_id": split_id},
                "read": False,
                "created_at": datetime.now(timezone.utc).isoformat(),
            })
    
    return {"success": True, "split_id": split_id, "amount_per_person": amount_per_person}

@router.post("/food/create")
async def create_food_split(req: SplitPaymentRequest, user=Depends(get_current_user)):
    """Split food order with friends"""
    order = await db.food_orders.find_one({"order_id": req.order_id, "user_id": user["user_id"]}, {"_id": 0})
    if not order:
        raise HTTPException(404, "Order not found")
    
    total_amount = order.get("total_cost", 0)
    num_people = len(req.split_with) + 1
    amount_per_person = total_amount / num_people
    
    split_id = str(uuid4())
    split_doc = {
        "split_id": split_id,
        "type": "food",
        "order_id": req.order_id,
        "initiator_id": user["user_id"],
        "total_amount": total_amount,
        "amount_per_person": amount_per_person,
        "split_with": req.split_with,
        "accepted_by": [],
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    
    await db.split_payments.insert_one(split_doc)
    
    for email in req.split_with:
        recipient = await db.users.find_one({"email": email}, {"_id": 0})
        if recipient:
            await db.notifications.insert_one({
                "notification_id": str(uuid4()),
                "user_id": recipient["user_id"],
                "type": "split_payment_request",
                "title": f"{user['first_name']} wants to split an order",
                "message": f"Amount: €{amount_per_person:.2f}",
                "data": {"split_id": split_id},
                "read": False,
                "created_at": datetime.now(timezone.utc).isoformat(),
            })
    
    return {"success": True, "split_id": split_id, "amount_per_person": amount_per_person}

@router.post("/accept")
async def accept_split(req: SplitAcceptRequest, user=Depends(get_current_user)):
    """Accept split payment request"""
    split = await db.split_payments.find_one({"split_id": req.split_id})
    if not split:
        raise HTTPException(404, "Split request not found")
    
    if user["email"] not in split["split_with"]:
        raise HTTPException(403, "Not authorized")
    
    # Check if user has enough balance
    balance = await db.wallet.find_one({"user_id": user["user_id"]}, {"_id": 0})
    if not balance or balance.get("balance", 0) < split["amount_per_person"]:
        raise HTTPException(400, "Insufficient balance")
    
    # Deduct from user's wallet
    await db.wallet.update_one(
        {"user_id": user["user_id"]},
        {"$inc": {"balance": -split["amount_per_person"]}}
    )
    
    # Update split document
    await db.split_payments.update_one(
        {"split_id": req.split_id},
        {"$push": {"accepted_by": user["user_id"]}}
    )
    
    # Check if all accepted
    updated_split = await db.split_payments.find_one({"split_id": req.split_id})
    if len(updated_split["accepted_by"]) == len(updated_split["split_with"]):
        await db.split_payments.update_one(
            {"split_id": req.split_id},
            {"$set": {"status": "completed"}}
        )
    
    return {"success": True, "message": "Payment accepted"}

@router.get("/my-requests")
async def get_my_split_requests(user=Depends(get_current_user)):
    """Get pending split requests for current user"""
    splits = await db.split_payments.find({
        "split_with": user["email"],
        "status": "pending"
    }, {"_id": 0}).to_list(100)
    
    return {"splits": splits}
