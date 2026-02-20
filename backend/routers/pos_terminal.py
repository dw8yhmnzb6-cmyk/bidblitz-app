"""
POS Router - Point of Sale endpoints for staff terminals
Handles:
- Customer topups via barcode
- Gift card creation and redemption
- Payment processing
"""
from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone, timedelta
import uuid
import hashlib

from config import db, logger

router = APIRouter(prefix="/api/pos", tags=["POS"])

# ==================== MODELS ====================

class TopupRequest(BaseModel):
    customer_barcode: str
    amount: float
    staff_id: Optional[str] = None
    staff_name: Optional[str] = None
    branch_id: Optional[str] = None
    branch_name: Optional[str] = None

class GiftCardCreateRequest(BaseModel):
    barcode: str
    amount: float
    staff_id: Optional[str] = None
    staff_name: Optional[str] = None
    branch_id: Optional[str] = None
    branch_name: Optional[str] = None

class GiftCardRedeemRequest(BaseModel):
    barcode: str
    customer_barcode: Optional[str] = None
    staff_id: Optional[str] = None
    staff_name: Optional[str] = None
    branch_id: Optional[str] = None

class PaymentRequest(BaseModel):
    customer_barcode: str
    amount: float
    description: Optional[str] = None
    staff_id: Optional[str] = None
    staff_name: Optional[str] = None
    branch_id: Optional[str] = None

# ==================== HELPER FUNCTIONS ====================

def calculate_bonus(amount: float) -> float:
    """Calculate bonus based on amount tiers"""
    if amount >= 200:
        return 12.00
    elif amount >= 100:
        return 5.00
    elif amount >= 50:
        return 2.00
    elif amount >= 20:
        return 0.50
    return 0.00

async def get_or_create_customer(barcode: str) -> dict:
    """Get customer by barcode or create new one"""
    # Check if barcode exists as customer_number or barcode
    customer = await db.users.find_one({
        "$or": [
            {"customer_number": barcode},
            {"barcode": barcode},
            {"id": barcode}
        ]
    })
    
    if customer:
        return customer
    
    # Create new customer with this barcode
    new_customer = {
        "id": str(uuid.uuid4()),
        "customer_number": barcode,
        "barcode": barcode,
        "name": f"Kunde {barcode[-4:]}",
        "balance": 0.0,
        "total_deposits": 0.0,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_via": "pos_barcode"
    }
    await db.users.insert_one(new_customer)
    logger.info(f"Created new customer via POS barcode: {barcode}")
    return new_customer

# ==================== TOPUP ENDPOINTS ====================

@router.post("/topup")
async def process_topup(data: TopupRequest, authorization: Optional[str] = Header(None)):
    """Process customer topup via barcode scan"""
    try:
        # Validate amount
        if data.amount < 5:
            raise HTTPException(status_code=400, detail="Mindestbetrag: €5")
        if data.amount > 500:
            raise HTTPException(status_code=400, detail="Maximalbetrag: €500")
        
        # Get or create customer
        customer = await get_or_create_customer(data.customer_barcode)
        
        # Calculate bonus
        bonus = calculate_bonus(data.amount)
        total_credit = data.amount + bonus
        
        # Update customer balance
        new_balance = customer.get("balance", 0.0) + total_credit
        await db.users.update_one(
            {"id": customer["id"]},
            {
                "$set": {"balance": new_balance},
                "$inc": {"total_deposits": data.amount}
            }
        )
        
        # Create transaction record
        transaction = {
            "id": str(uuid.uuid4()),
            "type": "topup",
            "customer_id": customer["id"],
            "customer_barcode": data.customer_barcode,
            "customer_name": customer.get("name", "Kunde"),
            "amount": data.amount,
            "bonus": bonus,
            "total_credited": total_credit,
            "new_balance": new_balance,
            "staff_id": data.staff_id,
            "staff_name": data.staff_name,
            "branch_id": data.branch_id,
            "branch_name": data.branch_name,
            "status": "completed",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.pos_transactions.insert_one(transaction)
        
        logger.info(f"POS Topup: €{data.amount} + €{bonus} bonus for customer {data.customer_barcode}")
        
        return {
            "success": True,
            "transaction_id": transaction["id"],
            "customer_name": customer.get("name"),
            "amount": data.amount,
            "bonus": bonus,
            "total_credited": total_credit,
            "new_balance": new_balance
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"POS Topup error: {e}")
        raise HTTPException(status_code=500, detail="Fehler bei der Aufladung")

# ==================== GIFT CARD ENDPOINTS ====================

@router.post("/giftcard/create")
async def create_gift_card(data: GiftCardCreateRequest, authorization: Optional[str] = Header(None)):
    """Create a new gift card"""
    try:
        # Validate amount
        if data.amount < 10:
            raise HTTPException(status_code=400, detail="Mindestbetrag: €10")
        if data.amount > 500:
            raise HTTPException(status_code=400, detail="Maximalbetrag: €500")
        
        # Check if barcode already exists
        existing = await db.gift_cards.find_one({"barcode": data.barcode})
        if existing:
            raise HTTPException(status_code=400, detail="Barcode bereits vergeben")
        
        # Create gift card
        gift_card = {
            "id": str(uuid.uuid4()),
            "barcode": data.barcode,
            "amount": data.amount,
            "original_amount": data.amount,
            "status": "active",  # active, redeemed, expired
            "created_by_staff": data.staff_id,
            "created_by_name": data.staff_name,
            "branch_id": data.branch_id,
            "branch_name": data.branch_name,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "expires_at": (datetime.now(timezone.utc) + timedelta(days=365)).isoformat(),
            "redeemed_at": None,
            "redeemed_by_customer": None
        }
        await db.gift_cards.insert_one(gift_card)
        
        logger.info(f"Gift card created: {data.barcode} for €{data.amount}")
        
        return {
            "success": True,
            "gift_card_id": gift_card["id"],
            "barcode": data.barcode,
            "amount": data.amount,
            "expires_at": gift_card["expires_at"]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Gift card creation error: {e}")
        raise HTTPException(status_code=500, detail="Fehler beim Erstellen der Gutscheinkarte")

@router.post("/giftcard/redeem")
async def redeem_gift_card(data: GiftCardRedeemRequest, authorization: Optional[str] = Header(None)):
    """Redeem a gift card by barcode"""
    try:
        # Find gift card
        gift_card = await db.gift_cards.find_one({"barcode": data.barcode})
        
        if not gift_card:
            raise HTTPException(status_code=404, detail="Gutschein nicht gefunden")
        
        if gift_card.get("status") == "redeemed":
            raise HTTPException(status_code=400, detail="Gutschein wurde bereits eingelöst")
        
        if gift_card.get("status") == "expired":
            raise HTTPException(status_code=400, detail="Gutschein ist abgelaufen")
        
        # Check expiration
        expires_at = datetime.fromisoformat(gift_card["expires_at"].replace("Z", "+00:00"))
        if expires_at < datetime.now(timezone.utc):
            await db.gift_cards.update_one(
                {"barcode": data.barcode},
                {"$set": {"status": "expired"}}
            )
            raise HTTPException(status_code=400, detail="Gutschein ist abgelaufen")
        
        # Get or create customer if barcode provided
        customer = None
        new_balance = gift_card["amount"]
        
        if data.customer_barcode:
            customer = await get_or_create_customer(data.customer_barcode)
            new_balance = customer.get("balance", 0.0) + gift_card["amount"]
            
            # Credit to customer account
            await db.users.update_one(
                {"id": customer["id"]},
                {"$set": {"balance": new_balance}}
            )
        
        # Mark gift card as redeemed
        await db.gift_cards.update_one(
            {"barcode": data.barcode},
            {
                "$set": {
                    "status": "redeemed",
                    "redeemed_at": datetime.now(timezone.utc).isoformat(),
                    "redeemed_by_customer": data.customer_barcode,
                    "redeemed_by_staff": data.staff_id,
                    "redeemed_at_branch": data.branch_id
                }
            }
        )
        
        # Create transaction record
        transaction = {
            "id": str(uuid.uuid4()),
            "type": "gift_card_redemption",
            "gift_card_barcode": data.barcode,
            "gift_card_id": gift_card["id"],
            "customer_barcode": data.customer_barcode,
            "amount": gift_card["amount"],
            "new_balance": new_balance,
            "staff_id": data.staff_id,
            "staff_name": data.staff_name,
            "branch_id": data.branch_id,
            "status": "completed",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.pos_transactions.insert_one(transaction)
        
        logger.info(f"Gift card redeemed: {data.barcode} for €{gift_card['amount']}")
        
        return {
            "success": True,
            "amount": gift_card["amount"],
            "customer_name": customer.get("name") if customer else "Bargeld-Auszahlung",
            "new_balance": new_balance
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Gift card redemption error: {e}")
        raise HTTPException(status_code=500, detail="Fehler beim Einlösen des Gutscheins")

@router.get("/giftcard/{barcode}")
async def get_gift_card_info(barcode: str):
    """Get gift card information by barcode"""
    gift_card = await db.gift_cards.find_one(
        {"barcode": barcode},
        {"_id": 0}
    )
    
    if not gift_card:
        raise HTTPException(status_code=404, detail="Gutschein nicht gefunden")
    
    return gift_card

# ==================== PAYMENT ENDPOINTS ====================

@router.post("/payment")
async def process_payment(data: PaymentRequest, authorization: Optional[str] = Header(None)):
    """Process payment from customer balance"""
    try:
        # Find customer
        customer = await db.users.find_one({
            "$or": [
                {"customer_number": data.customer_barcode},
                {"barcode": data.customer_barcode},
                {"id": data.customer_barcode}
            ]
        })
        
        if not customer:
            raise HTTPException(status_code=404, detail="Kunde nicht gefunden")
        
        current_balance = customer.get("balance", 0.0)
        
        if current_balance < data.amount:
            raise HTTPException(
                status_code=400, 
                detail=f"Nicht genügend Guthaben. Verfügbar: €{current_balance:.2f}"
            )
        
        # Deduct from balance
        new_balance = current_balance - data.amount
        await db.users.update_one(
            {"id": customer["id"]},
            {"$set": {"balance": new_balance}}
        )
        
        # Create transaction
        transaction = {
            "id": str(uuid.uuid4()),
            "type": "payment",
            "customer_id": customer["id"],
            "customer_barcode": data.customer_barcode,
            "customer_name": customer.get("name"),
            "amount": data.amount,
            "description": data.description,
            "previous_balance": current_balance,
            "new_balance": new_balance,
            "staff_id": data.staff_id,
            "staff_name": data.staff_name,
            "branch_id": data.branch_id,
            "status": "completed",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.pos_transactions.insert_one(transaction)
        
        logger.info(f"POS Payment: €{data.amount} from customer {data.customer_barcode}")
        
        return {
            "success": True,
            "transaction_id": transaction["id"],
            "customer_name": customer.get("name"),
            "amount": data.amount,
            "new_balance": new_balance
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Payment error: {e}")
        raise HTTPException(status_code=500, detail="Fehler bei der Zahlung")

# ==================== HISTORY ENDPOINTS ====================

@router.get("/transactions")
async def get_transactions(
    branch_id: Optional[str] = None,
    staff_id: Optional[str] = None,
    limit: int = 50,
    authorization: Optional[str] = Header(None)
):
    """Get POS transaction history"""
    query = {}
    if branch_id:
        query["branch_id"] = branch_id
    if staff_id:
        query["staff_id"] = staff_id
    
    transactions = await db.pos_transactions.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    return {"transactions": transactions}
