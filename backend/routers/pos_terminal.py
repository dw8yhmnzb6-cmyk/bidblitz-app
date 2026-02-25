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

# Import WebSocket notification function
from services.websocket import notify_payment_received

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
    branch_name: Optional[str] = None

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
    
    # Check if it's a BidBlitz Pay QR code format
    if barcode and barcode.startswith("BIDBLITZ-PAY:"):
        payment_token = barcode.replace("BIDBLITZ-PAY:", "")
        
        # Find the token in database
        token_data = await db.payment_tokens.find_one({"token": payment_token})
        if token_data:
            customer_id = token_data["user_id"]
            customer = await db.users.find_one({"id": customer_id})
            if customer:
                logger.info(f"Found customer via BidBlitz Pay QR: {customer.get('email')} ({customer_id})")
                return customer
        
        raise HTTPException(status_code=400, detail="BidBlitz Pay QR-Code ungültig oder abgelaufen")
    
    # Clean up barcode - remove BID- prefix if present
    clean_barcode = barcode.replace("BID-", "").replace("bid-", "").strip()
    
    # PRIORITY 1: Try to find with BID- prefix first (real customers)
    customer = await db.users.find_one({
        "customer_number": f"BID-{clean_barcode}",
        "email": {"$ne": None}  # Real customers have email
    })
    
    if customer:
        logger.info(f"Found real customer with BID- prefix: {customer.get('customer_number')} ({customer.get('email')})")
        return customer
    
    # PRIORITY 2: Try other search patterns
    customer = await db.users.find_one({
        "$or": [
            {"customer_number": barcode},
            {"customer_number": clean_barcode},
            {"customer_number": f"BID-{clean_barcode}"},
            {"barcode": barcode},
            {"barcode": clean_barcode},
            {"id": barcode},
            {"id": clean_barcode}
        ]
    })
    
    if customer:
        logger.info(f"Found existing customer: {customer.get('customer_number')} for barcode {barcode}")
        return customer
    
    # Create new customer with this barcode (only if not found)
    new_customer = {
        "id": str(uuid.uuid4()),
        "customer_number": f"BID-{clean_barcode}",
        "barcode": clean_barcode,
        "name": f"Kunde {clean_barcode[-4:]}",
        "bidblitz_balance": 0.0,
        "total_deposits": 0.0,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_via": "pos_barcode"
    }
    await db.users.insert_one(new_customer)
    logger.info(f"Created new customer via POS barcode: {barcode}")
    return new_customer

# ==================== CUSTOMER LOOKUP ====================

@router.get("/customer/lookup")
async def lookup_customer_by_barcode(barcode: str, authorization: Optional[str] = Header(None)):
    """
    Look up customer by barcode/customer_number to show balance before topup.
    Returns customer info including current balance.
    """
    try:
        # Normalize barcode
        barcode = barcode.strip().upper()
        
        # Try to find by customer_number or qr_code
        customer = await db.users.find_one(
            {"$or": [
                {"customer_number": barcode},
                {"qr_code": barcode},
                {"customer_number": {"$regex": barcode, "$options": "i"}}
            ]},
            {"_id": 0, "password": 0}
        )
        
        if not customer:
            raise HTTPException(status_code=404, detail="Kunde nicht gefunden")
        
        # Get balance from bidblitz_balance field
        main_balance = customer.get("balance", 0.0)
        bidblitz_balance = customer.get("bidblitz_balance", 0.0)
        
        # Also check bidblitz_wallets for wallet balance
        wallet = await db.bidblitz_wallets.find_one(
            {"user_id": customer.get("id")},
            {"_id": 0}
        )
        wallet_balance = wallet.get("universal_balance", 0.0) if wallet else 0.0
        
        return {
            "found": True,
            "customer_number": customer.get("customer_number"),
            "name": customer.get("name", "Kunde"),
            "email": customer.get("email", "")[:3] + "***" if customer.get("email") else None,
            "balance": main_balance,
            "bidblitz_balance": bidblitz_balance,
            "wallet_balance": wallet_balance,
            "total_balance": main_balance + bidblitz_balance + wallet_balance,
            "total_deposits": customer.get("total_deposits", 0),
            "created_at": customer.get("created_at")
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Customer lookup error: {e}")
        raise HTTPException(status_code=500, detail="Fehler bei der Kundensuche")

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
        
        # Get current balance from bidblitz_balance field
        current_balance = customer.get("bidblitz_balance", 0.0)
        new_balance = current_balance + total_credit
        
        # Update customer bidblitz_balance in users collection
        update_result = await db.users.update_one(
            {"id": customer["id"]},
            {
                "$set": {"bidblitz_balance": new_balance},
                "$inc": {"total_deposits": data.amount}
            }
        )
        logger.info(f"Update result: matched={update_result.matched_count}, modified={update_result.modified_count}")
        
        if update_result.matched_count == 0:
            # Try with customer_number instead
            update_result = await db.users.update_one(
                {"customer_number": customer.get("customer_number")},
                {
                    "$set": {"bidblitz_balance": new_balance},
                    "$inc": {"total_deposits": data.amount}
                }
            )
            logger.info(f"Fallback update result: matched={update_result.matched_count}, modified={update_result.modified_count}")
        
        # Also update bidblitz_wallets collection (universal_balance)
        await db.bidblitz_wallets.update_one(
            {"user_id": customer["id"]},
            {
                "$inc": {"universal_balance": total_credit},
                "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}
            },
            upsert=True
        )
        
        logger.info(f"POS Topup: €{data.amount} + €{bonus} bonus for {customer.get('customer_number')} - New balance: €{new_balance}")
        
        # Create transaction record in pos_transactions
        transaction_id = str(uuid.uuid4())
        transaction = {
            "id": transaction_id,
            "type": "pos_topup",
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
        
        # Also create in bidblitz_pay_transactions for user's payment history
        await db.bidblitz_pay_transactions.insert_one({
            "id": transaction_id,
            "user_id": customer["id"],
            "type": "pos_topup",
            "amount": total_credit,  # Amount including bonus
            "original_amount": data.amount,
            "bonus": bonus,
            "description": f"Bareinzahlung bei {data.branch_name or 'Filiale'}" + (f" (+€{bonus:.2f} Bonus)" if bonus > 0 else ""),
            "staff_name": data.staff_name,
            "branch_name": data.branch_name,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        
        logger.info(f"POS Topup: €{data.amount} + €{bonus} bonus for customer {data.customer_barcode}")
        
        # ==================== REAL-TIME NOTIFICATION ====================
        # Send WebSocket notification to customer's device about topup
        try:
            await notify_payment_received(
                user_id=customer["id"],
                amount=total_credit,  # Total amount including bonus
                new_balance=new_balance,
                merchant_name=data.branch_name or "Filiale",
                transaction_id=transaction_id,
                is_topup=True,  # Flag to indicate this is a topup, not payment
                bonus_amount=bonus
            )
            logger.info(f"WebSocket notification sent for topup to user {customer['id']}")
        except Exception as ws_error:
            # Don't fail the topup if notification fails
            logger.warning(f"Could not send topup notification: {ws_error}")
        
        return {
            "success": True,
            "transaction_id": transaction_id,
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
        customer = None
        barcode = data.customer_barcode.strip() if data.customer_barcode else ""
        
        # ==================== QR-CODE FORMAT ERKENNUNG ====================
        # Format 1: BIDBLITZ-PAY:{token} (alte Version)
        if barcode.startswith("BIDBLITZ-PAY:"):
            payment_token = barcode.replace("BIDBLITZ-PAY:", "")
            
            # Find the token in database
            token_data = await db.payment_tokens.find_one({"token": payment_token})
            if not token_data:
                raise HTTPException(status_code=400, detail="QR-Code ungültig oder abgelaufen")
            
            if token_data.get("used"):
                raise HTTPException(status_code=400, detail="QR-Code bereits verwendet")
            
            # Get customer from token
            customer_id = token_data["user_id"]
            customer = await db.users.find_one({"id": customer_id})
            
            if customer:
                # Mark token as used
                await db.payment_tokens.update_one(
                    {"token": payment_token},
                    {"$set": {"used": True, "used_at": datetime.now(timezone.utc).isoformat()}}
                )
                logger.info(f"BidBlitz Pay QR (v1) recognized for customer {customer_id}")
        
        # Format 2: BIDBLITZ:2.0:{token}:{customer_number}:{timestamp} (neue Version)
        elif barcode.startswith("BIDBLITZ:2.0:"):
            parts = barcode.split(":")
            if len(parts) >= 3:
                payment_token = parts[2]  # cpt_xxxxx
                
                # Find the token in customer_payment_tokens collection
                token_data = await db.customer_payment_tokens.find_one({"token": payment_token})
                if not token_data:
                    raise HTTPException(status_code=400, detail="QR-Code ungültig oder abgelaufen")
                
                if token_data.get("used"):
                    raise HTTPException(status_code=400, detail="QR-Code bereits verwendet")
                
                # Check expiration
                expires_at_str = token_data.get("expires_at", "")
                if expires_at_str:
                    try:
                        expires_at = datetime.fromisoformat(expires_at_str.replace("Z", "+00:00"))
                        if expires_at < datetime.now(timezone.utc):
                            raise HTTPException(status_code=400, detail="QR-Code abgelaufen")
                    except:
                        pass
                
                # Get customer from token
                customer_id = token_data["user_id"]
                customer = await db.users.find_one({"id": customer_id})
                
                if customer:
                    # Mark token as used
                    await db.customer_payment_tokens.update_one(
                        {"token": payment_token},
                        {"$set": {"used": True, "used_at": datetime.now(timezone.utc).isoformat()}}
                    )
                    logger.info(f"BidBlitz Pay QR (v2.0) recognized for customer {customer_id}")
        
        # Format 3: Direkter Token (cpt_xxxxx) - ohne Präfix
        elif barcode.startswith("cpt_"):
            token_data = await db.customer_payment_tokens.find_one({"token": barcode})
            if token_data and not token_data.get("used"):
                customer_id = token_data["user_id"]
                customer = await db.users.find_one({"id": customer_id})
                if customer:
                    await db.customer_payment_tokens.update_one(
                        {"token": barcode},
                        {"$set": {"used": True, "used_at": datetime.now(timezone.utc).isoformat()}}
                    )
                    logger.info(f"Direct token recognized for customer {customer_id}")
        
        # ==================== FALLBACK: Reguläre Barcode-Suche ====================
        if not customer:
            customer = await db.users.find_one({
                "$or": [
                    {"customer_number": data.customer_barcode},
                    {"barcode": data.customer_barcode},
                    {"id": data.customer_barcode}
                ]
            })
        
        if not customer:
            raise HTTPException(status_code=404, detail="Kunde nicht gefunden")
        
        # ==================== RABATT-BERECHNUNG ====================
        # Berechne automatisch Rabatte basierend auf aktiven Rabattkarten
        discount_amount = 0.0
        discount_card = None
        now = datetime.now(timezone.utc).isoformat()
        
        # Finde alle aktiven Rabattkarten für diesen Kunden
        discount_query = {
            "is_active": True,
            "$or": [
                {"applies_to_all": True},
                {"specific_customers": customer["id"]}
            ]
        }
        
        discount_cards = await db.discount_cards.find(discount_query, {"_id": 0}).to_list(50)
        
        # Auch persönlich zugewiesene Karten prüfen
        assigned_cards = await db.customer_discount_cards.find({
            "customer_id": customer["id"],
            "is_active": True
        }).to_list(50)
        
        if assigned_cards:
            assigned_card_ids = [a["discount_card_id"] for a in assigned_cards]
            extra_cards = await db.discount_cards.find({
                "id": {"$in": assigned_card_ids},
                "is_active": True
            }, {"_id": 0}).to_list(50)
            discount_cards.extend(extra_cards)
        
        # Finde den besten Rabatt
        best_discount = 0.0
        best_card = None
        
        for card in discount_cards:
            # Prüfe Gültigkeit
            if card.get("valid_from") and card["valid_from"] > now:
                continue
            if card.get("valid_until") and card["valid_until"] < now:
                continue
            
            # Prüfe Mindestbestellwert
            if card.get("min_purchase", 0) > data.amount:
                continue
            
            # Prüfe Filiale
            if card.get("specific_branches") and data.branch_id:
                if data.branch_id not in card["specific_branches"]:
                    continue
            
            # Berechne Rabatt
            if card["discount_type"] == "percentage":
                calc_discount = data.amount * (card["discount_value"] / 100)
            else:  # fixed
                calc_discount = card["discount_value"]
            
            # Maximalen Rabatt begrenzen
            if card.get("max_discount"):
                calc_discount = min(calc_discount, card["max_discount"])
            
            # Rabatt kann nicht höher sein als der Betrag
            calc_discount = min(calc_discount, data.amount)
            
            if calc_discount > best_discount:
                best_discount = calc_discount
                best_card = card
        
        discount_amount = round(best_discount, 2)
        discount_card = best_card
        
        # Berechne finalen Betrag nach Rabatt
        final_amount = round(data.amount - discount_amount, 2)
        
        if discount_card:
            logger.info(f"Rabatt angewendet: €{discount_amount:.2f} ({discount_card['name']}) für Kunde {customer['id']}")
        
        # ==================== GUTHABEN PRÜFEN ====================
        # Use bidblitz_balance field (same as BidBlitz Pay wallet)
        current_balance = customer.get("bidblitz_balance", 0.0)
        
        if current_balance < final_amount:
            raise HTTPException(
                status_code=400, 
                detail=f"Nicht genügend Guthaben. Verfügbar: €{current_balance:.2f}, Benötigt: €{final_amount:.2f}"
            )
        
        # Deduct final amount (nach Rabatt) from bidblitz_balance
        new_balance = current_balance - final_amount
        await db.users.update_one(
            {"id": customer["id"]},
            {"$set": {"bidblitz_balance": new_balance}}
        )
        
        # Also update bidblitz_wallets collection if exists
        await db.bidblitz_wallets.update_one(
            {"user_id": customer["id"]},
            {"$inc": {"universal_balance": -final_amount}},
            upsert=False
        )
        
        # ==================== RABATT-NUTZUNG PROTOKOLLIEREN ====================
        if discount_card:
            # Aktualisiere Statistiken der Rabattkarte
            await db.discount_cards.update_one(
                {"id": discount_card["id"]},
                {
                    "$inc": {
                        "usage_count": 1,
                        "total_discount_given": discount_amount
                    }
                }
            )
            
            # Protokolliere Nutzung
            discount_usage = {
                "id": str(uuid.uuid4()),
                "customer_id": customer["id"],
                "card_id": discount_card["id"],
                "card_name": discount_card["name"],
                "original_amount": data.amount,
                "discount_amount": discount_amount,
                "final_amount": final_amount,
                "used_at": datetime.now(timezone.utc).isoformat()
            }
            await db.discount_card_usage.insert_one(discount_usage)
        
        # Create transaction in pos_transactions
        transaction = {
            "id": str(uuid.uuid4()),
            "type": "payment",
            "customer_id": customer["id"],
            "customer_barcode": data.customer_barcode,
            "customer_name": customer.get("name"),
            "original_amount": data.amount,
            "discount_amount": discount_amount,
            "discount_card_id": discount_card["id"] if discount_card else None,
            "discount_card_name": discount_card["name"] if discount_card else None,
            "amount": final_amount,  # Finaler Betrag nach Rabatt
            "description": data.description or "POS Zahlung",
            "previous_balance": current_balance,
            "new_balance": new_balance,
            "staff_id": data.staff_id,
            "staff_name": data.staff_name,
            "branch_id": data.branch_id,
            "status": "completed",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.pos_transactions.insert_one(transaction)
        
        # Also create transaction in bidblitz_pay_transactions (for BidBlitz Pay Verlauf)
        discount_info = f" (Rabatt: €{discount_amount:.2f})" if discount_amount > 0 else ""
        bidblitz_transaction = {
            "id": transaction["id"],
            "user_id": customer["id"],
            "type": "pos_payment",
            "amount": -final_amount,  # Negative because it's a payment
            "original_amount": data.amount,
            "discount_amount": discount_amount,
            "description": (data.description or f"POS Zahlung bei {data.branch_name or 'Partner'}") + discount_info,
            "balance_after": new_balance,
            "status": "completed",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "metadata": {
                "staff_id": data.staff_id,
                "staff_name": data.staff_name,
                "branch_id": data.branch_id,
                "branch_name": data.branch_name,
                "discount_card": discount_card["name"] if discount_card else None
            }
        }
        await db.bidblitz_pay_transactions.insert_one(bidblitz_transaction)
        
        logger.info(f"POS Payment: €{final_amount:.2f} (Original: €{data.amount:.2f}, Rabatt: €{discount_amount:.2f}) from customer {customer.get('name')} ({customer['id']}) - New balance: €{new_balance:.2f}")
        
        # ==================== REAL-TIME NOTIFICATION ====================
        # Send WebSocket notification to customer's device
        try:
            await notify_payment_received(
                user_id=customer["id"],
                amount=final_amount,
                new_balance=new_balance,
                merchant_name=data.branch_name,
                transaction_id=transaction["id"],
                discount_amount=discount_amount,
                discount_card_name=discount_card["name"] if discount_card else None
            )
        except Exception as ws_error:
            # Don't fail the payment if notification fails
            logger.warning(f"Could not send payment notification: {ws_error}")
        
        return {
            "success": True,
            "transaction_id": transaction["id"],
            "customer_name": customer.get("name"),
            "original_amount": data.amount,
            "discount_amount": discount_amount,
            "discount_card_name": discount_card["name"] if discount_card else None,
            "final_amount": final_amount,
            "amount": final_amount,
            "new_balance": new_balance,
            "has_discount": discount_amount > 0
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
