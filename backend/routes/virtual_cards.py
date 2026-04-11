"""
BidBlitz Virtual Cards System
=============================
Einmal-Karten für sicheres Online-Shopping
"""

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional
from bson import ObjectId
from datetime import datetime, timezone, timedelta
from core.database import db
from core.security import get_current_user
import secrets
import random

router = APIRouter(prefix="/api/cards", tags=["virtual-cards"])


def generate_card_number():
    """Generate realistic-looking card number (4532 XXXX XXXX XXXX)"""
    prefix = "4532"  # Visa-like
    rest = ''.join([str(random.randint(0, 9)) for _ in range(12)])
    return f"{prefix}{rest}"


def generate_cvv():
    return ''.join([str(random.randint(0, 9)) for _ in range(3)])


def generate_card_id():
    return f"CARD-{secrets.token_hex(4).upper()}"


class CreateCardRequest(BaseModel):
    name: str  # "Amazon Einkauf", "Netflix", etc.
    limit: float
    single_use: bool = True
    expires_hours: int = 24  # Auto-expire after X hours


class CardPaymentRequest(BaseModel):
    card_id: str
    amount: float
    merchant: str


@router.post("/create")
async def create_virtual_card(req: CreateCardRequest, request: Request):
    """Create a new virtual card"""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    if req.limit < 1:
        raise HTTPException(status_code=400, detail="Mindestlimit: €1.00")
    
    if req.limit > 5000:
        raise HTTPException(status_code=400, detail="Maximallimit: €5.000")
    
    # Check if user has enough balance
    if user.get("balance", 0) < req.limit:
        raise HTTPException(status_code=400, detail="Nicht genügend Guthaben für das Kartenlimit")
    
    # Reserve the amount from wallet
    await db.users.update_one(
        {"_id": user["_id"]},
        {"$inc": {"balance": -req.limit, "reserved_balance": req.limit}}
    )
    
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(hours=req.expires_hours)
    
    # Generate card details
    card_number = generate_card_number()
    cvv = generate_cvv()
    exp_month = (now.month + 6) % 12 or 12
    exp_year = now.year + (1 if now.month + 6 > 12 else 0)
    
    card = {
        "card_id": generate_card_id(),
        "user_id": user_id,
        "name": req.name,
        "card_number": card_number,
        "card_number_masked": f"•••• •••• •••• {card_number[-4:]}",
        "cvv": cvv,
        "exp_month": str(exp_month).zfill(2),
        "exp_year": str(exp_year)[-2:],
        "limit": req.limit,
        "spent": 0.0,
        "remaining": req.limit,
        "single_use": req.single_use,
        "status": "active",
        "transactions": [],
        "created_at": now.isoformat(),
        "expires_at": expires_at.isoformat(),
    }
    
    await db.virtual_cards.insert_one(card)
    
    return {
        "success": True,
        "card": {
            "card_id": card["card_id"],
            "name": card["name"],
            "card_number": card["card_number"],
            "card_number_masked": card["card_number_masked"],
            "cvv": card["cvv"],
            "exp_month": card["exp_month"],
            "exp_year": card["exp_year"],
            "limit": card["limit"],
            "expires_at": card["expires_at"],
            "single_use": card["single_use"],
        }
    }


@router.get("/my-cards")
async def get_my_cards(request: Request, include_inactive: bool = False):
    """Get all user's virtual cards"""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    query = {"user_id": user_id}
    if not include_inactive:
        query["status"] = "active"
    
    cards = await db.virtual_cards.find(
        query,
        {"_id": 0, "cvv": 0}  # Don't return CVV in list
    ).sort("created_at", -1).to_list(50)
    
    # Check for expired cards
    now = datetime.now(timezone.utc)
    for card in cards:
        if card.get("expires_at"):
            exp = datetime.fromisoformat(card["expires_at"])
            if now > exp and card["status"] == "active":
                # Mark as expired and refund
                await expire_card(card["card_id"], user_id)
                card["status"] = "expired"
    
    return {"cards": cards}


@router.get("/{card_id}")
async def get_card_details(card_id: str, request: Request):
    """Get full card details including CVV"""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    card = await db.virtual_cards.find_one(
        {"card_id": card_id, "user_id": user_id},
        {"_id": 0}
    )
    
    if not card:
        raise HTTPException(status_code=404, detail="Karte nicht gefunden")
    
    return {"card": card}


@router.post("/{card_id}/freeze")
async def freeze_card(card_id: str, request: Request):
    """Freeze/unfreeze a card"""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    card = await db.virtual_cards.find_one({"card_id": card_id, "user_id": user_id})
    if not card:
        raise HTTPException(status_code=404, detail="Karte nicht gefunden")
    
    new_status = "frozen" if card["status"] == "active" else "active"
    
    await db.virtual_cards.update_one(
        {"card_id": card_id},
        {"$set": {"status": new_status}}
    )
    
    return {"success": True, "status": new_status}


@router.delete("/{card_id}")
async def delete_card(card_id: str, request: Request):
    """Delete card and refund remaining balance"""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    card = await db.virtual_cards.find_one({"card_id": card_id, "user_id": user_id})
    if not card:
        raise HTTPException(status_code=404, detail="Karte nicht gefunden")
    
    remaining = card.get("remaining", 0)
    
    # Refund remaining balance
    if remaining > 0:
        await db.users.update_one(
            {"_id": user["_id"]},
            {"$inc": {"balance": remaining, "reserved_balance": -remaining}}
        )
    
    await db.virtual_cards.update_one(
        {"card_id": card_id},
        {"$set": {"status": "deleted", "remaining": 0}}
    )
    
    return {"success": True, "refunded": remaining}


async def expire_card(card_id: str, user_id: str):
    """Internal: Expire card and refund"""
    card = await db.virtual_cards.find_one({"card_id": card_id})
    if not card or card["status"] != "active":
        return
    
    remaining = card.get("remaining", 0)
    
    if remaining > 0:
        await db.users.update_one(
            {"_id": ObjectId(user_id)},
            {"$inc": {"balance": remaining, "reserved_balance": -remaining}}
        )
    
    await db.virtual_cards.update_one(
        {"card_id": card_id},
        {"$set": {"status": "expired", "remaining": 0}}
    )


# Simulated payment endpoint (in production, this would be a webhook from card processor)
@router.post("/payment")
async def process_card_payment(req: CardPaymentRequest, request: Request):
    """Process a payment on a virtual card (simulation)"""
    card = await db.virtual_cards.find_one({"card_id": req.card_id})
    
    if not card:
        return {"success": False, "error": "Card not found"}
    
    if card["status"] != "active":
        return {"success": False, "error": "Card is not active"}
    
    if req.amount > card["remaining"]:
        return {"success": False, "error": "Insufficient card limit"}
    
    now = datetime.now(timezone.utc)
    
    # Check expiry
    if card.get("expires_at"):
        exp = datetime.fromisoformat(card["expires_at"])
        if now > exp:
            await expire_card(card["card_id"], card["user_id"])
            return {"success": False, "error": "Card expired"}
    
    # Process payment
    new_spent = card["spent"] + req.amount
    new_remaining = card["remaining"] - req.amount
    
    tx = {
        "amount": req.amount,
        "merchant": req.merchant,
        "timestamp": now.isoformat(),
    }
    
    update = {
        "$set": {
            "spent": new_spent,
            "remaining": new_remaining,
        },
        "$push": {"transactions": tx}
    }
    
    # If single-use, deactivate after first use
    if card["single_use"]:
        update["$set"]["status"] = "used"
        # Refund remaining
        if new_remaining > 0:
            await db.users.update_one(
                {"_id": ObjectId(card["user_id"])},
                {"$inc": {"balance": new_remaining, "reserved_balance": -new_remaining}}
            )
            update["$set"]["remaining"] = 0
    
    # Deduct from reserved balance
    await db.users.update_one(
        {"_id": ObjectId(card["user_id"])},
        {"$inc": {"reserved_balance": -req.amount}}
    )
    
    await db.virtual_cards.update_one({"card_id": req.card_id}, update)
    
    # Create transaction record
    await db.transactions.insert_one({
        "id": f"tx_{secrets.token_hex(8)}",
        "user_id": card["user_id"],
        "type": "virtual_card_payment",
        "amount": -req.amount,
        "description": f"Kartenzahlung: {req.merchant}",
        "merchant_name": req.merchant,
        "card_id": req.card_id,
        "status": "completed",
        "created_at": now.isoformat(),
    })
    
    return {
        "success": True,
        "amount": req.amount,
        "remaining": new_remaining if not card["single_use"] else 0,
    }
