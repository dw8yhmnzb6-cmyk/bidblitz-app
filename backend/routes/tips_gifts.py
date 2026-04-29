# BidBlitz - Tips & Gifts
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
from uuid import uuid4
from core.database import db
from routes.auth import get_current_user

router = APIRouter(prefix="/api/tips", tags=["Tips & Gifts"])

class TipRequest(BaseModel):
    service_type: str  # taxi, food, scooter
    service_id: str
    amount: float
    recipient_id: Optional[str] = None

@router.post("/give")
async def give_tip(req: TipRequest, user=Depends(get_current_user)):
    """Tip driver/delivery person"""
    # Check user balance
    wallet = await db.wallet.find_one({"user_id": user["user_id"]}, {"_id": 0})
    if not wallet or wallet.get("balance", 0) < req.amount:
        raise HTTPException(400, "Insufficient balance")
    
    # Find recipient
    if req.service_type == "taxi":
        ride = await db.taxi_rides.find_one({"ride_id": req.service_id}, {"_id": 0})
        if not ride:
            raise HTTPException(404, "Ride not found")
        recipient_id = ride.get("driver_id")
    elif req.service_type == "food":
        order = await db.food_orders.find_one({"order_id": req.service_id}, {"_id": 0})
        if not order:
            raise HTTPException(404, "Order not found")
        recipient_id = order.get("driver_id")
    else:
        recipient_id = req.recipient_id
    
    if not recipient_id:
        raise HTTPException(400, "Recipient not found")
    
    # Deduct from user
    await db.wallet.update_one(
        {"user_id": user["user_id"]},
        {"$inc": {"balance": -req.amount}}
    )
    
    # Add to recipient
    await db.wallet.update_one(
        {"user_id": recipient_id},
        {"$inc": {"balance": req.amount}},
        upsert=True
    )
    
    # Record tip
    tip_id = str(uuid4())
    await db.tips.insert_one({
        "tip_id": tip_id,
        "from_user_id": user["user_id"],
        "to_user_id": recipient_id,
        "service_type": req.service_type,
        "service_id": req.service_id,
        "amount": req.amount,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })
    
    # Notify recipient
    await db.notifications.insert_one({
        "notification_id": str(uuid4()),
        "user_id": recipient_id,
        "type": "tip_received",
        "title": f"You received a €{req.amount:.2f} tip!",
        "message": f"From {user.get('first_name', 'Customer')}",
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    
    return {"success": True, "tip_id": tip_id}

@router.get("/my-tips")
async def get_my_tips(user=Depends(get_current_user)):
    """Get tips given/received"""
    given = await db.tips.find({"from_user_id": user["user_id"]}, {"_id": 0}).to_list(100)
    received = await db.tips.find({"to_user_id": user["user_id"]}, {"_id": 0}).to_list(100)
    
    return {
        "given": given,
        "received": received,
        "total_given": sum(t["amount"] for t in given),
        "total_received": sum(t["amount"] for t in received),
    }

@router.post("/gift-card/purchase")
async def purchase_gift_card(amount: float, recipient_email: str, user=Depends(get_current_user)):
    """Purchase gift card for someone"""
    if amount < 5 or amount > 500:
        raise HTTPException(400, "Amount must be between €5 and €500")
    
    # Check balance
    wallet = await db.wallet.find_one({"user_id": user["user_id"]}, {"_id": 0})
    if not wallet or wallet.get("balance", 0) < amount:
        raise HTTPException(400, "Insufficient balance")
    
    # Deduct from buyer
    await db.wallet.update_one(
        {"user_id": user["user_id"]},
        {"$inc": {"balance": -amount}}
    )
    
    # Create gift card
    code = str(uuid4())[:12].upper()
    gift_id = str(uuid4())
    
    await db.gift_cards.insert_one({
        "gift_id": gift_id,
        "code": code,
        "amount": amount,
        "from_user_id": user["user_id"],
        "from_name": f"{user.get('first_name', '')} {user.get('last_name', '')}",
        "recipient_email": recipient_email,
        "status": "active",
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    
    # Notify recipient
    recipient = await db.users.find_one({"email": recipient_email}, {"_id": 0})
    if recipient:
        await db.notifications.insert_one({
            "notification_id": str(uuid4()),
            "user_id": recipient["user_id"],
            "type": "gift_card",
            "title": f"You received a €{amount} gift card!",
            "message": f"From {user.get('first_name', '')}. Code: {code}",
            "data": {"code": code},
            "read": False,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    
    return {"success": True, "code": code, "gift_id": gift_id}

@router.post("/gift-card/redeem")
async def redeem_gift_card(code: str, user=Depends(get_current_user)):
    """Redeem gift card"""
    gift = await db.gift_cards.find_one({"code": code.upper()})
    if not gift:
        raise HTTPException(404, "Invalid gift card code")
    
    if gift["status"] != "active":
        raise HTTPException(400, "Gift card already redeemed")
    
    # Add to user's wallet
    await db.wallet.update_one(
        {"user_id": user["user_id"]},
        {"$inc": {"balance": gift["amount"]}},
        upsert=True
    )
    
    # Mark as redeemed
    await db.gift_cards.update_one(
        {"code": code.upper()},
        {
            "$set": {
                "status": "redeemed",
                "redeemed_by": user["user_id"],
                "redeemed_at": datetime.now(timezone.utc).isoformat(),
            }
        }
    )
    
    return {"success": True, "amount": gift["amount"]}
