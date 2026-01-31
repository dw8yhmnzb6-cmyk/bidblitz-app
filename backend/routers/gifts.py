"""Gift Router - Allow users to gift bids to each other using customer numbers"""
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone
from pydantic import BaseModel
from typing import Optional
import uuid
import random
import string

from config import db, logger
from dependencies import get_current_user

router = APIRouter(prefix="/gifts", tags=["Gifts"])

# ==================== SCHEMAS ====================

class GiftBidsRequest(BaseModel):
    recipient_customer_number: str
    amount: int
    message: Optional[str] = None

class PurchaseGiftRequest(BaseModel):
    recipient_customer_number: str
    package_id: str
    message: Optional[str] = None

# ==================== HELPER FUNCTIONS ====================

def generate_customer_number():
    """Generate a unique 8-digit customer number"""
    return ''.join(random.choices(string.digits, k=8))

async def ensure_customer_number(user_id: str) -> str:
    """Ensure user has a customer number, create one if not"""
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "customer_number": 1})
    
    if user and user.get("customer_number"):
        return user["customer_number"]
    
    # Generate unique customer number
    while True:
        customer_number = generate_customer_number()
        existing = await db.users.find_one({"customer_number": customer_number})
        if not existing:
            break
    
    # Update user with customer number
    await db.users.update_one(
        {"id": user_id},
        {"$set": {"customer_number": customer_number}}
    )
    
    return customer_number

# ==================== ENDPOINTS ====================

@router.get("/my-customer-number")
async def get_my_customer_number(user: dict = Depends(get_current_user)):
    """Get or generate customer number for current user"""
    customer_number = await ensure_customer_number(user["id"])
    
    return {
        "customer_number": customer_number,
        "name": user["name"]
    }

@router.get("/lookup/{customer_number}")
async def lookup_customer(customer_number: str, user: dict = Depends(get_current_user)):
    """Look up a user by their customer number (for gifting)"""
    recipient = await db.users.find_one(
        {"customer_number": customer_number},
        {"_id": 0, "id": 1, "name": 1, "customer_number": 1}
    )
    
    if not recipient:
        raise HTTPException(status_code=404, detail="Kundennummer nicht gefunden")
    
    if recipient["id"] == user["id"]:
        raise HTTPException(status_code=400, detail="Sie können sich nicht selbst beschenken")
    
    return {
        "found": True,
        "name": recipient["name"],
        "customer_number": recipient["customer_number"]
    }

@router.post("/send")
async def send_gift_bids(data: GiftBidsRequest, user: dict = Depends(get_current_user)):
    """Send bids as a gift to another user"""
    
    if data.amount < 1:
        raise HTTPException(status_code=400, detail="Mindestens 1 Gebot erforderlich")
    
    if data.amount > 1000:
        raise HTTPException(status_code=400, detail="Maximal 1000 Gebote pro Geschenk")
    
    # Check sender's balance
    if user.get("bids_balance", 0) < data.amount:
        raise HTTPException(status_code=400, detail="Nicht genügend Gebote vorhanden")
    
    # Find recipient
    recipient = await db.users.find_one(
        {"customer_number": data.recipient_customer_number},
        {"_id": 0}
    )
    
    if not recipient:
        raise HTTPException(status_code=404, detail="Kundennummer nicht gefunden")
    
    if recipient["id"] == user["id"]:
        raise HTTPException(status_code=400, detail="Sie können sich nicht selbst beschenken")
    
    # Ensure sender has customer number
    sender_customer_number = await ensure_customer_number(user["id"])
    
    # Create gift record
    gift_id = str(uuid.uuid4())
    gift = {
        "id": gift_id,
        "sender_id": user["id"],
        "sender_name": user["name"],
        "sender_customer_number": sender_customer_number,
        "recipient_id": recipient["id"],
        "recipient_name": recipient["name"],
        "recipient_customer_number": data.recipient_customer_number,
        "amount": data.amount,
        "message": data.message,
        "type": "direct_gift",
        "status": "completed",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.bid_gifts.insert_one(gift)
    
    # Transfer bids
    await db.users.update_one(
        {"id": user["id"]},
        {"$inc": {"bids_balance": -data.amount}}
    )
    
    await db.users.update_one(
        {"id": recipient["id"]},
        {"$inc": {"bids_balance": data.amount}}
    )
    
    # Create notification for recipient
    notification = {
        "id": str(uuid.uuid4()),
        "user_id": recipient["id"],
        "type": "gift_received",
        "title": "🎁 Geschenk erhalten!",
        "message": f"{user['name']} hat Ihnen {data.amount} Gebote geschenkt!" + (f" Nachricht: {data.message}" if data.message else ""),
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.notifications.insert_one(notification)
    
    logger.info(f"🎁 Gift sent: {user['name']} -> {recipient['name']}: {data.amount} bids")
    
    return {
        "success": True,
        "message": f"{data.amount} Gebote erfolgreich an {recipient['name']} gesendet!",
        "gift_id": gift_id,
        "new_balance": user["bids_balance"] - data.amount
    }

@router.get("/sent")
async def get_sent_gifts(user: dict = Depends(get_current_user)):
    """Get all gifts sent by current user"""
    gifts = await db.bid_gifts.find(
        {"sender_id": user["id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    
    return gifts

@router.get("/received")
async def get_received_gifts(user: dict = Depends(get_current_user)):
    """Get all gifts received by current user"""
    gifts = await db.bid_gifts.find(
        {"recipient_id": user["id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    
    return gifts

@router.get("/history")
async def get_gift_history(user: dict = Depends(get_current_user)):
    """Get complete gift history (sent and received)"""
    sent = await db.bid_gifts.find(
        {"sender_id": user["id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(25)
    
    received = await db.bid_gifts.find(
        {"recipient_id": user["id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(25)
    
    # Calculate totals
    total_sent = sum(g.get("amount", 0) for g in sent)
    total_received = sum(g.get("amount", 0) for g in received)
    
    return {
        "sent": sent,
        "received": received,
        "total_sent": total_sent,
        "total_received": total_received,
        "customer_number": user.get("customer_number")
    }

# ==================== GIFT PACKAGES (Buy as Gift) ====================

@router.post("/purchase")
async def purchase_gift_package(data: PurchaseGiftRequest, user: dict = Depends(get_current_user)):
    """Purchase a bid package as a gift for someone else"""
    
    # Get bid packages
    packages = await db.bid_packages.find({}, {"_id": 0}).to_list(20)
    if not packages:
        # Default packages
        packages = [
            {"id": "starter", "name": "Starter", "bids": 50, "price": 29.99, "bonus": 0},
            {"id": "popular", "name": "Beliebt", "bids": 100, "price": 49.99, "bonus": 10},
            {"id": "value", "name": "Sparpaket", "bids": 200, "price": 89.99, "bonus": 30},
            {"id": "premium", "name": "Premium", "bids": 500, "price": 199.99, "bonus": 100}
        ]
    
    package = next((p for p in packages if p["id"] == data.package_id), None)
    if not package:
        raise HTTPException(status_code=404, detail="Paket nicht gefunden")
    
    # Find recipient
    recipient = await db.users.find_one(
        {"customer_number": data.recipient_customer_number},
        {"_id": 0}
    )
    
    if not recipient:
        raise HTTPException(status_code=404, detail="Kundennummer nicht gefunden")
    
    if recipient["id"] == user["id"]:
        raise HTTPException(status_code=400, detail="Kaufen Sie das Paket direkt für sich selbst")
    
    # For now, return info to proceed with Stripe checkout
    # The actual purchase will be handled by the checkout router
    return {
        "success": True,
        "package": package,
        "recipient": {
            "name": recipient["name"],
            "customer_number": recipient["customer_number"]
        },
        "message": "Weiterleitung zur Zahlung...",
        "redirect_to_checkout": True,
        "checkout_params": {
            "package_id": data.package_id,
            "gift_to": data.recipient_customer_number,
            "gift_message": data.message
        }
    }
