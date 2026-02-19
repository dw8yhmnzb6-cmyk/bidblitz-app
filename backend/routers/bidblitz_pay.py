"""
BidBlitz Pay - Digital Payment System for Vouchers
Like AliPay - Users can pay at partner shops with their won vouchers
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from datetime import datetime, timezone, timedelta
from typing import Optional, List
from pydantic import BaseModel
import uuid
import qrcode
import io
import base64

from config import db, logger
from dependencies import get_current_user

router = APIRouter(prefix="/bidblitz-pay", tags=["BidBlitz Pay"])

# ==================== MODELS ====================

class PaymentRequest(BaseModel):
    amount: float
    customer_qr_token: str
    description: Optional[str] = None

class TransferRequest(BaseModel):
    to_user_id: str
    amount: float
    voucher_ids: Optional[List[str]] = None


class CustomerCreditRequest(BaseModel):
    customer_number: str  # e.g., "BID-123456"
    amount: float
    description: Optional[str] = None
    reference: Optional[str] = None  # External reference (bank transfer ID)


# ==================== CUSTOMER NUMBER ENDPOINTS ====================

@router.get("/my-customer-number")
async def get_my_customer_number(user: dict = Depends(get_current_user)):
    """Get current user's customer number"""
    customer_number = user.get("customer_number")
    
    # If user doesn't have a customer number yet, generate one
    if not customer_number:
        import random
        while True:
            number = random.randint(100000, 999999)
            customer_number = f"BID-{number}"
            existing = await db.users.find_one({"customer_number": customer_number})
            if not existing:
                break
        
        await db.users.update_one(
            {"id": user["id"]},
            {"$set": {"customer_number": customer_number}}
        )
    
    return {
        "customer_number": customer_number,
        "name": user.get("name", ""),
        "email": user.get("email", ""),
        "info": "Verwenden Sie diese Kundennummer für Überweisungen und Gutschriften"
    }


@router.get("/lookup/{customer_number}")
async def lookup_customer(customer_number: str):
    """Public: Look up customer by number (returns limited info for verification)"""
    customer_number = customer_number.upper().strip()
    
    user = await db.users.find_one(
        {"customer_number": customer_number},
        {"_id": 0, "customer_number": 1, "name": 1}
    )
    
    if not user:
        raise HTTPException(status_code=404, detail="Kundennummer nicht gefunden")
    
    # Return only name (masked for privacy) and confirmation
    name = user.get("name", "")
    if len(name) > 2:
        masked_name = name[0] + "*" * (len(name) - 2) + name[-1]
    else:
        masked_name = name
    
    return {
        "customer_number": customer_number,
        "name_masked": masked_name,
        "valid": True
    }


# ==================== USER WALLET ENDPOINTS ====================

@router.get("/wallet")
async def get_user_wallet(user: dict = Depends(get_current_user)):
    """Get user's digital wallet with vouchers and balance"""
    user_id = user["id"]
    
    # Get user's won vouchers (not fully redeemed)
    vouchers = await db.user_vouchers.find(
        {
            "user_id": user_id,
            "status": {"$in": ["active", "partial"]}
        },
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    # Get universal BidBlitz balance
    user_data = await db.users.find_one({"id": user_id}, {"_id": 0, "bidblitz_balance": 1})
    universal_balance = user_data.get("bidblitz_balance", 0) if user_data else 0
    
    # Calculate totals
    partner_vouchers = [v for v in vouchers if v.get("partner_id")]
    universal_vouchers = [v for v in vouchers if not v.get("partner_id")]
    
    total_partner_value = sum(v.get("remaining_value", v.get("value", 0)) for v in partner_vouchers)
    total_universal_value = sum(v.get("remaining_value", v.get("value", 0)) for v in universal_vouchers)
    
    return {
        "wallet": {
            "universal_balance": universal_balance + total_universal_value,
            "partner_vouchers_value": total_partner_value,
            "total_value": universal_balance + total_universal_value + total_partner_value,
            "voucher_count": len(vouchers)
        },
        "vouchers": vouchers,
        "partner_vouchers": partner_vouchers,
        "universal_vouchers": universal_vouchers
    }

@router.get("/payment-qr")
async def generate_payment_qr(user: dict = Depends(get_current_user)):
    """Generate QR code for customer to show at partner for payment"""
    user_id = user["id"]
    
    # Create a payment token (valid for 5 minutes)
    token = str(uuid.uuid4())
    expires_at = datetime.now(timezone.utc).isoformat()
    
    # Store token
    await db.payment_tokens.insert_one({
        "token": token,
        "user_id": user_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "expires_at": expires_at,
        "used": False
    })
    
    # Generate QR code with token
    qr_data = f"BIDBLITZ-PAY:{token}"
    
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_H,
        box_size=10,
        border=2,
    )
    qr.add_data(qr_data)
    qr.make(fit=True)
    
    img = qr.make_image(fill_color="black", back_color="white")
    buffer = io.BytesIO()
    img.save(buffer, format='PNG')
    qr_base64 = base64.b64encode(buffer.getvalue()).decode()
    
    # Get wallet summary for display
    wallet = await get_user_wallet(user)
    
    return {
        "qr_code": f"data:image/png;base64,{qr_base64}",
        "token": token,
        "expires_in_seconds": 300,
        "wallet_summary": wallet["wallet"]
    }

@router.get("/transactions")
async def get_payment_transactions(
    user: dict = Depends(get_current_user),
    limit: int = Query(default=20, le=100)
):
    """Get user's payment transaction history"""
    user_id = user["id"]
    
    transactions = await db.bidblitz_pay_transactions.find(
        {"$or": [{"user_id": user_id}, {"partner_id": user_id}]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(limit)
    
    return {"transactions": transactions, "total": len(transactions)}

class TopUpRequest(BaseModel):
    amount: float

@router.post("/topup")
async def topup_wallet(request: TopUpRequest, user: dict = Depends(get_current_user)):
    """Transfer money from main account balance to BidBlitz Pay wallet"""
    user_id = user["id"]
    amount = request.amount
    
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Betrag muss größer als 0 sein")
    
    # Get user's main account balance
    user_data = await db.users.find_one({"id": user_id}, {"_id": 0, "credits": 1, "bidblitz_balance": 1})
    if not user_data:
        raise HTTPException(status_code=404, detail="Benutzer nicht gefunden")
    
    main_balance = user_data.get("credits", 0)
    
    if main_balance < amount:
        raise HTTPException(status_code=400, detail=f"Nicht genug Guthaben. Verfügbar: €{main_balance:.2f}")
    
    # Transfer: Subtract from main credits, add to BidBlitz balance
    await db.users.update_one(
        {"id": user_id},
        {
            "$inc": {
                "credits": -amount,
                "bidblitz_balance": amount
            }
        }
    )
    
    # Record transaction
    transaction_id = str(uuid.uuid4())
    await db.bidblitz_pay_transactions.insert_one({
        "id": transaction_id,
        "user_id": user_id,
        "type": "topup",
        "amount": amount,
        "description": "Guthaben auf BidBlitz Pay übertragen",
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    # Get updated balances
    updated_user = await db.users.find_one({"id": user_id}, {"_id": 0, "credits": 1, "bidblitz_balance": 1})
    
    return {
        "success": True,
        "message": f"€{amount:.2f} erfolgreich auf BidBlitz Pay übertragen",
        "new_main_balance": updated_user.get("credits", 0),
        "new_bidblitz_balance": updated_user.get("bidblitz_balance", 0)
    }

@router.get("/main-balance")
async def get_main_balance(user: dict = Depends(get_current_user)):
    """Get user's main account balance (credits) for transfer"""
    user_id = user["id"]
    
    user_data = await db.users.find_one({"id": user_id}, {"_id": 0, "credits": 1, "bidblitz_balance": 1, "name": 1, "email": 1})
    if not user_data:
        raise HTTPException(status_code=404, detail="Benutzer nicht gefunden")
    
    return {
        "main_balance": user_data.get("credits", 0),
        "bidblitz_balance": user_data.get("bidblitz_balance", 0),
        "name": user_data.get("name", ""),
        "email": user_data.get("email", "")
    }


@router.post("/transfer-to-main")
async def transfer_to_main(request: TopUpRequest, user: dict = Depends(get_current_user)):
    """Transfer money from BidBlitz Pay wallet to main account (credits)"""
    user_id = user["id"]
    amount = request.amount
    
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Betrag muss größer als 0 sein")
    
    # Get user's BidBlitz Pay balance
    user_data = await db.users.find_one({"id": user_id}, {"_id": 0, "credits": 1, "bidblitz_balance": 1})
    if not user_data:
        raise HTTPException(status_code=404, detail="Benutzer nicht gefunden")
    
    bidblitz_balance = user_data.get("bidblitz_balance", 0)
    
    if bidblitz_balance < amount:
        raise HTTPException(status_code=400, detail=f"Nicht genug BidBlitz Pay Guthaben. Verfügbar: €{bidblitz_balance:.2f}")
    
    # Transfer: Subtract from BidBlitz balance, add to main credits
    await db.users.update_one(
        {"id": user_id},
        {
            "$inc": {
                "bidblitz_balance": -amount,
                "credits": amount
            }
        }
    )
    
    # Record transaction
    transaction_id = str(uuid.uuid4())
    await db.bidblitz_pay_transactions.insert_one({
        "id": transaction_id,
        "user_id": user_id,
        "type": "transfer_to_main",
        "amount": -amount,  # Negative because it's going out of BidBlitz Pay
        "description": "Guthaben vom BidBlitz Pay auf Hauptkonto übertragen",
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    # Get updated balances
    updated_user = await db.users.find_one({"id": user_id}, {"_id": 0, "credits": 1, "bidblitz_balance": 1})
    
    logger.info(f"Transfer to main: €{amount} for user {user_id}")
    
    return {
        "success": True,
        "message": f"€{amount:.2f} erfolgreich auf Hauptkonto übertragen",
        "new_main_balance": updated_user.get("credits", 0),
        "new_bidblitz_balance": updated_user.get("bidblitz_balance", 0)
    }


# ==================== DIRECT TOP UP ====================

class DirectTopUpRequest(BaseModel):
    amount: float
    payment_method: str = "card"  # card, paypal, etc.

@router.post("/direct-topup")
async def direct_topup(data: DirectTopUpRequest, user: dict = Depends(get_current_user)):
    """Direct top up of BidBlitz Pay balance (simulated payment)"""
    user_id = user["id"]
    amount = data.amount
    
    if amount < 5:
        raise HTTPException(status_code=400, detail="Mindestbetrag: €5")
    if amount > 500:
        raise HTTPException(status_code=400, detail="Maximalbetrag: €500")
    
    # In production, this would integrate with Stripe/PayPal
    # For now, we simulate successful payment and add balance
    
    # Add to BidBlitz Pay balance
    await db.users.update_one(
        {"id": user_id},
        {"$inc": {"bidblitz_balance": amount}}
    )
    
    # Create transaction record
    transaction_id = str(uuid.uuid4())
    await db.bidblitz_pay_transactions.insert_one({
        "id": transaction_id,
        "user_id": user_id,
        "type": "direct_topup",
        "amount": amount,
        "payment_method": data.payment_method,
        "description": f"Direkte Aufladung via {data.payment_method}",
        "status": "completed",
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    # Get updated balance
    updated_user = await db.users.find_one({"id": user_id}, {"_id": 0, "bidblitz_balance": 1})
    
    logger.info(f"💳 Direct top-up: {user_id} +€{amount} via {data.payment_method}")
    
    return {
        "success": True,
        "message": f"€{amount:.2f} erfolgreich aufgeladen",
        "amount": amount,
        "new_balance": updated_user.get("bidblitz_balance", 0),
        "transaction_id": transaction_id
    }

# ==================== PEER-TO-PEER TRANSFER ====================

class P2PTransferRequest(BaseModel):
    recipient_email: str  # Can be email or user ID (customer number)
    amount: float
    message: Optional[str] = None

@router.post("/send-money")
async def send_money_to_user(data: P2PTransferRequest, user: dict = Depends(get_current_user)):
    """Send BidBlitz balance to another user by email or customer ID"""
    sender_id = user["id"]
    
    if data.amount <= 0:
        raise HTTPException(status_code=400, detail="Betrag muss größer als 0 sein")
    
    if data.amount < 1:
        raise HTTPException(status_code=400, detail="Mindestbetrag: €1")
    
    # Find recipient by email OR by customer number (BID-XXXXXX)
    recipient_input = data.recipient_email.strip()
    recipient = None
    
    # First try to find by email
    if "@" in recipient_input:
        recipient = await db.users.find_one(
            {"email": recipient_input.lower()},
            {"_id": 0, "id": 1, "name": 1, "email": 1}
        )
    
    # If not found by email, try to find by customer_number (BID-XXXXXX format)
    if not recipient and recipient_input.upper().startswith("BID-"):
        recipient = await db.users.find_one(
            {"customer_number": recipient_input.upper()},
            {"_id": 0, "id": 1, "name": 1, "email": 1}
        )
    
    # If still not found, try to find by user ID (legacy support)
    if not recipient:
        recipient = await db.users.find_one(
            {"id": recipient_input},
            {"_id": 0, "id": 1, "name": 1, "email": 1}
        )
    
    # Also try case-insensitive ID search
    if not recipient:
        recipient = await db.users.find_one(
            {"id": {"$regex": f"^{recipient_input}$", "$options": "i"}},
            {"_id": 0, "id": 1, "name": 1, "email": 1}
        )
    
    if not recipient:
        raise HTTPException(status_code=404, detail="Empfänger nicht gefunden. Bitte Kundennummer oder E-Mail überprüfen.")
    
    if recipient["id"] == sender_id:
        raise HTTPException(status_code=400, detail="Sie können nicht an sich selbst senden")
    
    # Check sender balance
    sender_data = await db.users.find_one({"id": sender_id}, {"_id": 0, "bidblitz_balance": 1, "name": 1})
    sender_balance = sender_data.get("bidblitz_balance", 0) if sender_data else 0
    
    if sender_balance < data.amount:
        raise HTTPException(status_code=400, detail="Nicht genug Guthaben")
    
    # Deduct from sender
    await db.users.update_one(
        {"id": sender_id},
        {"$inc": {"bidblitz_balance": -data.amount}}
    )
    
    # Add to recipient
    await db.users.update_one(
        {"id": recipient["id"]},
        {"$inc": {"bidblitz_balance": data.amount}}
    )
    
    # Create transfer record
    transfer_id = str(uuid.uuid4())
    transfer_doc = {
        "id": transfer_id,
        "sender_id": sender_id,
        "sender_name": sender_data.get("name", ""),
        "recipient_id": recipient["id"],
        "recipient_name": recipient.get("name", ""),
        "recipient_email": recipient["email"],
        "amount": data.amount,
        "message": data.message,
        "type": "p2p_transfer",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.wallet_transfers.insert_one(transfer_doc)
    
    logger.info(f"💸 P2P Transfer: {sender_id} -> {recipient['id']}: €{data.amount}")
    
    return {
        "success": True,
        "transfer_id": transfer_id,
        "amount": data.amount,
        "recipient": recipient.get("name", recipient["email"]),
        "new_balance": sender_balance - data.amount,
        "message": f"€{data.amount:.2f} an {recipient.get('name', recipient['email'])} gesendet"
    }

@router.get("/transfer-history")
async def get_transfer_history(user: dict = Depends(get_current_user), limit: int = 50):
    """Get user's P2P transfer history (sent and received)"""
    user_id = user["id"]
    
    # Get sent transfers
    sent = await db.wallet_transfers.find(
        {"sender_id": user_id, "type": "p2p_transfer"},
        {"_id": 0}
    ).sort("created_at", -1).to_list(limit)
    
    # Get received transfers
    received = await db.wallet_transfers.find(
        {"recipient_id": user_id, "type": "p2p_transfer"},
        {"_id": 0}
    ).sort("created_at", -1).to_list(limit)
    
    # Combine and sort
    all_transfers = []
    for t in sent:
        t["direction"] = "sent"
        all_transfers.append(t)
    for t in received:
        t["direction"] = "received"
        all_transfers.append(t)
    
    all_transfers.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    
    return {
        "transfers": all_transfers[:limit],
        "total_sent": sum(t["amount"] for t in sent),
        "total_received": sum(t["amount"] for t in received)
    }

# ==================== SAVED RECIPIENTS / CONTACTS ====================

class SavedRecipientCreate(BaseModel):
    recipient_identifier: str  # Email or customer number (BID-XXXXXX)
    nickname: str  # Custom name like "Mein Sohn", "Meine Tochter"

class SavedRecipientUpdate(BaseModel):
    nickname: str


@router.get("/saved-recipients")
async def get_saved_recipients(user: dict = Depends(get_current_user)):
    """Get all saved recipients for the current user"""
    user_id = user["id"]
    
    recipients = await db.saved_recipients.find(
        {"user_id": user_id},
        {"_id": 0}
    ).sort("nickname", 1).to_list(100)
    
    return {"recipients": recipients}


@router.post("/saved-recipients")
async def save_recipient(data: SavedRecipientCreate, user: dict = Depends(get_current_user)):
    """Save a new recipient with a custom nickname"""
    user_id = user["id"]
    recipient_input = data.recipient_identifier.strip()
    
    # Validate and find the recipient
    recipient = None
    
    # Check by email
    if "@" in recipient_input:
        recipient = await db.users.find_one(
            {"email": recipient_input.lower()},
            {"_id": 0, "id": 1, "name": 1, "email": 1, "customer_number": 1}
        )
    
    # Check by customer number
    if not recipient and recipient_input.upper().startswith("BID-"):
        recipient = await db.users.find_one(
            {"customer_number": recipient_input.upper()},
            {"_id": 0, "id": 1, "name": 1, "email": 1, "customer_number": 1}
        )
    
    if not recipient:
        raise HTTPException(status_code=404, detail="Empfänger nicht gefunden")
    
    if recipient["id"] == user_id:
        raise HTTPException(status_code=400, detail="Sie können sich nicht selbst speichern")
    
    # Check if already saved
    existing = await db.saved_recipients.find_one({
        "user_id": user_id,
        "recipient_id": recipient["id"]
    })
    
    if existing:
        # Update nickname instead
        await db.saved_recipients.update_one(
            {"user_id": user_id, "recipient_id": recipient["id"]},
            {"$set": {"nickname": data.nickname, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
        return {"success": True, "message": "Empfänger aktualisiert", "updated": True}
    
    # Create new saved recipient
    saved_recipient = {
        "id": str(uuid.uuid4())[:8].upper(),
        "user_id": user_id,
        "recipient_id": recipient["id"],
        "recipient_email": recipient.get("email", ""),
        "recipient_name": recipient.get("name", ""),
        "recipient_customer_number": recipient.get("customer_number", ""),
        "nickname": data.nickname,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.saved_recipients.insert_one(saved_recipient)
    
    return {
        "success": True,
        "message": f"'{data.nickname}' wurde gespeichert",
        "recipient": {
            "id": saved_recipient["id"],
            "nickname": data.nickname,
            "email": recipient.get("email", ""),
            "customer_number": recipient.get("customer_number", ""),
            "name": recipient.get("name", "")
        }
    }


@router.put("/saved-recipients/{recipient_id}")
async def update_saved_recipient(recipient_id: str, data: SavedRecipientUpdate, user: dict = Depends(get_current_user)):
    """Update a saved recipient's nickname"""
    user_id = user["id"]
    
    result = await db.saved_recipients.update_one(
        {"id": recipient_id, "user_id": user_id},
        {"$set": {"nickname": data.nickname, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Empfänger nicht gefunden")
    
    return {"success": True, "message": "Name aktualisiert"}


@router.delete("/saved-recipients/{recipient_id}")
async def delete_saved_recipient(recipient_id: str, user: dict = Depends(get_current_user)):
    """Delete a saved recipient"""
    user_id = user["id"]
    
    result = await db.saved_recipients.delete_one({"id": recipient_id, "user_id": user_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Empfänger nicht gefunden")
    
    return {"success": True, "message": "Empfänger gelöscht"}


# ==================== REQUEST MONEY ====================

class PaymentRequestCreate(BaseModel):
    amount: float
    description: Optional[str] = None
    expires_minutes: int = 60

@router.post("/request-money")
async def create_payment_request(data: PaymentRequestCreate, user: dict = Depends(get_current_user)):
    """Create a payment request that others can pay via QR code"""
    user_id = user["id"]
    
    if data.amount <= 0:
        raise HTTPException(status_code=400, detail="Betrag muss größer als 0 sein")
    
    # Get user name
    user_data = await db.users.find_one({"id": user_id}, {"_id": 0, "name": 1, "email": 1})
    
    # Create request
    request_id = str(uuid.uuid4())[:8].upper()
    request_doc = {
        "id": request_id,
        "requester_id": user_id,
        "requester_name": user_data.get("name", user_data.get("email", "")),
        "amount": data.amount,
        "description": data.description,
        "status": "pending",  # pending, paid, expired, cancelled
        "created_at": datetime.now(timezone.utc).isoformat(),
        "expires_at": (datetime.now(timezone.utc) + timedelta(minutes=data.expires_minutes)).isoformat(),
        "paid_by": None,
        "paid_at": None
    }
    await db.payment_requests.insert_one(request_doc)
    
    # Generate QR data
    qr_data = f"BIDBLITZ-REQ:{request_id}"
    
    # Generate QR code image
    qr = qrcode.QRCode(version=1, box_size=10, border=4)
    qr.add_data(qr_data)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    
    buffer = io.BytesIO()
    img.save(buffer, format='PNG')
    qr_base64 = base64.b64encode(buffer.getvalue()).decode()
    
    return {
        "request_id": request_id,
        "amount": data.amount,
        "description": data.description,
        "qr_code": f"data:image/png;base64,{qr_base64}",
        "qr_data": qr_data,
        "expires_at": request_doc["expires_at"],
        "status": "pending"
    }

@router.get("/request-money/{request_id}")
async def get_payment_request(request_id: str, user: dict = Depends(get_current_user)):
    """Get details of a payment request"""
    request = await db.payment_requests.find_one({"id": request_id}, {"_id": 0})
    if not request:
        raise HTTPException(status_code=404, detail="Zahlungsanforderung nicht gefunden")
    
    # Check if expired
    if request["status"] == "pending":
        expires_at = datetime.fromisoformat(request["expires_at"].replace("Z", "+00:00"))
        if datetime.now(timezone.utc) > expires_at:
            await db.payment_requests.update_one({"id": request_id}, {"$set": {"status": "expired"}})
            request["status"] = "expired"
    
    return request

@router.post("/pay-request/{request_id}")
async def pay_payment_request(request_id: str, user: dict = Depends(get_current_user)):
    """Pay a payment request"""
    payer_id = user["id"]
    
    # Get request
    request = await db.payment_requests.find_one({"id": request_id}, {"_id": 0})
    if not request:
        raise HTTPException(status_code=404, detail="Zahlungsanforderung nicht gefunden")
    
    # Check status
    if request["status"] != "pending":
        raise HTTPException(status_code=400, detail=f"Zahlungsanforderung ist bereits {request['status']}")
    
    # Check expiry
    expires_at = datetime.fromisoformat(request["expires_at"].replace("Z", "+00:00"))
    if datetime.now(timezone.utc) > expires_at:
        await db.payment_requests.update_one({"id": request_id}, {"$set": {"status": "expired"}})
        raise HTTPException(status_code=400, detail="Zahlungsanforderung ist abgelaufen")
    
    # Check not paying yourself
    if payer_id == request["requester_id"]:
        raise HTTPException(status_code=400, detail="Sie können nicht Ihre eigene Anforderung bezahlen")
    
    # Check payer balance
    payer_data = await db.users.find_one({"id": payer_id}, {"_id": 0, "bidblitz_balance": 1, "name": 1})
    payer_balance = payer_data.get("bidblitz_balance", 0) if payer_data else 0
    
    if payer_balance < request["amount"]:
        raise HTTPException(status_code=400, detail="Nicht genug Guthaben")
    
    # Process payment
    # Deduct from payer
    await db.users.update_one(
        {"id": payer_id},
        {"$inc": {"bidblitz_balance": -request["amount"]}}
    )
    
    # Add to requester
    await db.users.update_one(
        {"id": request["requester_id"]},
        {"$inc": {"bidblitz_balance": request["amount"]}}
    )
    
    # Update request status
    await db.payment_requests.update_one(
        {"id": request_id},
        {
            "$set": {
                "status": "paid",
                "paid_by": payer_id,
                "paid_by_name": payer_data.get("name", ""),
                "paid_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    # Create transfer record
    transfer_doc = {
        "id": str(uuid.uuid4()),
        "sender_id": payer_id,
        "sender_name": payer_data.get("name", ""),
        "recipient_id": request["requester_id"],
        "recipient_name": request["requester_name"],
        "amount": request["amount"],
        "message": f"Zahlung für: {request.get('description', 'Zahlungsanforderung')}",
        "type": "payment_request",
        "request_id": request_id,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.wallet_transfers.insert_one(transfer_doc)
    
    logger.info(f"💰 Payment request {request_id} paid: {payer_id} -> {request['requester_id']}: €{request['amount']}")
    
    return {
        "success": True,
        "amount": request["amount"],
        "paid_to": request["requester_name"],
        "new_balance": payer_balance - request["amount"],
        "message": f"€{request['amount']:.2f} an {request['requester_name']} bezahlt"
    }

@router.get("/my-payment-requests")
async def get_my_payment_requests(user: dict = Depends(get_current_user), limit: int = 20):
    """Get user's payment requests (sent requests)"""
    user_id = user["id"]
    
    requests = await db.payment_requests.find(
        {"requester_id": user_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(limit)
    
    # Update expired statuses
    now = datetime.now(timezone.utc)
    for req in requests:
        if req["status"] == "pending":
            expires_at = datetime.fromisoformat(req["expires_at"].replace("Z", "+00:00"))
            if now > expires_at:
                req["status"] = "expired"
    
    return {"requests": requests}

# ==================== CASHBACK SYSTEM ====================

@router.get("/cashback-balance")
async def get_cashback_balance(user: dict = Depends(get_current_user)):
    """Get user's accumulated cashback"""
    user_id = user["id"]
    
    user_data = await db.users.find_one(
        {"id": user_id},
        {"_id": 0, "cashback_balance": 1, "cashback_history": 1}
    )
    
    return {
        "cashback_balance": user_data.get("cashback_balance", 0) if user_data else 0,
        "pending_cashback": 0  # Future: pending cashback from recent transactions
    }

@router.post("/redeem-cashback")
async def redeem_cashback(user: dict = Depends(get_current_user)):
    """Convert cashback to BidBlitz balance"""
    user_id = user["id"]
    
    user_data = await db.users.find_one({"id": user_id}, {"_id": 0, "cashback_balance": 1})
    cashback = user_data.get("cashback_balance", 0) if user_data else 0
    
    if cashback < 5:
        raise HTTPException(status_code=400, detail="Mindestens €5 Cashback erforderlich")
    
    # Transfer cashback to BidBlitz balance
    await db.users.update_one(
        {"id": user_id},
        {
            "$inc": {"bidblitz_balance": cashback},
            "$set": {"cashback_balance": 0}
        }
    )
    
    # Log redemption
    redemption_doc = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "amount": cashback,
        "type": "cashback_redemption",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.cashback_redemptions.insert_one(redemption_doc)
    
    return {
        "success": True,
        "redeemed_amount": cashback,
        "message": f"€{cashback:.2f} Cashback in BidBlitz Guthaben umgewandelt"
    }

# ==================== PARTNER PAYMENT ENDPOINTS ====================

async def get_current_partner(token: str):
    """Get partner from token"""
    partner = await db.partner_accounts.find_one(
        {"auth_token": token, "is_active": True},
        {"_id": 0, "password_hash": 0}
    )
    if not partner:
        partner = await db.restaurant_accounts.find_one(
            {"auth_token": token, "is_active": True},
            {"_id": 0, "password_hash": 0}
        )
    if not partner:
        raise HTTPException(status_code=401, detail="Ungültiger Partner-Token")
    return partner

@router.get("/scan-customer")
async def scan_customer_qr(qr_data: str, token: str = Query(...)):
    """Partner scans customer QR to initiate payment"""
    partner = await get_current_partner(token)
    partner_id = partner["id"]
    
    # Parse QR code
    if not qr_data.startswith("BIDBLITZ-PAY:"):
        raise HTTPException(status_code=400, detail="Ungültiger QR-Code")
    
    payment_token = qr_data.replace("BIDBLITZ-PAY:", "")
    
    # Validate token
    token_data = await db.payment_tokens.find_one({"token": payment_token})
    if not token_data:
        raise HTTPException(status_code=400, detail="QR-Code ungültig oder abgelaufen")
    
    if token_data.get("used"):
        raise HTTPException(status_code=400, detail="QR-Code bereits verwendet")
    
    customer_id = token_data["user_id"]
    
    # Get customer info
    customer = await db.users.find_one({"id": customer_id}, {"_id": 0, "name": 1, "email": 1, "id": 1})
    if not customer:
        raise HTTPException(status_code=404, detail="Kunde nicht gefunden")
    
    # Get customer's available vouchers for this partner + universal
    partner_vouchers = await db.user_vouchers.find(
        {
            "user_id": customer_id,
            "partner_id": partner_id,
            "status": {"$in": ["active", "partial"]}
        },
        {"_id": 0}
    ).to_list(50)
    
    universal_vouchers = await db.user_vouchers.find(
        {
            "user_id": customer_id,
            "partner_id": None,
            "status": {"$in": ["active", "partial"]}
        },
        {"_id": 0}
    ).to_list(50)
    
    # Get universal balance
    user_data = await db.users.find_one({"id": customer_id}, {"_id": 0, "bidblitz_balance": 1})
    universal_balance = user_data.get("bidblitz_balance", 0) if user_data else 0
    
    # Calculate available amounts
    partner_total = sum(v.get("remaining_value", v.get("value", 0)) for v in partner_vouchers)
    universal_total = sum(v.get("remaining_value", v.get("value", 0)) for v in universal_vouchers) + universal_balance
    
    return {
        "customer": {
            "id": customer["id"],
            "name": customer.get("name", "Kunde"),
            "email": customer.get("email", "")[:3] + "***"  # Partial email for privacy
        },
        "payment_token": payment_token,
        "available_balance": {
            "partner_specific": partner_total,
            "universal": universal_total,
            "total": partner_total + universal_total
        },
        "partner_vouchers": partner_vouchers,
        "universal_vouchers": universal_vouchers,
        "universal_balance": universal_balance
    }

@router.post("/process-payment")
async def process_payment(
    payment_token: str,
    amount: float,
    use_partner_vouchers: bool = True,
    use_universal: bool = True,
    description: Optional[str] = None,
    token: str = Query(...)
):
    """Partner processes payment after scanning customer QR"""
    partner = await get_current_partner(token)
    partner_id = partner["id"]
    partner_name = partner.get("business_name", partner.get("restaurant_name", "Partner"))
    commission_rate = partner.get("commission_rate", 10)
    
    # Validate payment token
    token_data = await db.payment_tokens.find_one({"token": payment_token})
    if not token_data:
        raise HTTPException(status_code=400, detail="Zahlungs-Token ungültig")
    
    if token_data.get("used"):
        raise HTTPException(status_code=400, detail="Zahlung bereits verarbeitet")
    
    customer_id = token_data["user_id"]
    
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Betrag muss größer als 0 sein")
    
    # Collect available funds
    remaining_amount = amount
    used_vouchers = []
    used_universal = 0
    
    # 1. First use partner-specific vouchers
    if use_partner_vouchers and remaining_amount > 0:
        partner_vouchers = await db.user_vouchers.find(
            {
                "user_id": customer_id,
                "partner_id": partner_id,
                "status": {"$in": ["active", "partial"]}
            },
            {"_id": 0}
        ).sort("remaining_value", 1).to_list(50)  # Use smallest first
        
        for voucher in partner_vouchers:
            if remaining_amount <= 0:
                break
                
            voucher_value = voucher.get("remaining_value", voucher.get("value", 0))
            use_amount = min(voucher_value, remaining_amount)
            
            new_remaining = voucher_value - use_amount
            new_status = "redeemed" if new_remaining <= 0 else "partial"
            
            await db.user_vouchers.update_one(
                {"id": voucher["id"]},
                {"$set": {
                    "remaining_value": new_remaining,
                    "status": new_status,
                    "last_used_at": datetime.now(timezone.utc).isoformat()
                }}
            )
            
            used_vouchers.append({
                "voucher_id": voucher["id"],
                "voucher_name": voucher.get("name", "Gutschein"),
                "amount_used": use_amount,
                "type": "partner_specific"
            })
            
            remaining_amount -= use_amount
    
    # 2. Then use universal vouchers
    if use_universal and remaining_amount > 0:
        universal_vouchers = await db.user_vouchers.find(
            {
                "user_id": customer_id,
                "partner_id": None,
                "status": {"$in": ["active", "partial"]}
            },
            {"_id": 0}
        ).sort("remaining_value", 1).to_list(50)
        
        for voucher in universal_vouchers:
            if remaining_amount <= 0:
                break
                
            voucher_value = voucher.get("remaining_value", voucher.get("value", 0))
            use_amount = min(voucher_value, remaining_amount)
            
            new_remaining = voucher_value - use_amount
            new_status = "redeemed" if new_remaining <= 0 else "partial"
            
            await db.user_vouchers.update_one(
                {"id": voucher["id"]},
                {"$set": {
                    "remaining_value": new_remaining,
                    "status": new_status,
                    "last_used_at": datetime.now(timezone.utc).isoformat()
                }}
            )
            
            used_vouchers.append({
                "voucher_id": voucher["id"],
                "voucher_name": voucher.get("name", "BidBlitz Guthaben"),
                "amount_used": use_amount,
                "type": "universal"
            })
            
            remaining_amount -= use_amount
    
    # 3. Finally use universal balance
    if use_universal and remaining_amount > 0:
        user_data = await db.users.find_one({"id": customer_id}, {"_id": 0, "bidblitz_balance": 1})
        balance = user_data.get("bidblitz_balance", 0) if user_data else 0
        
        if balance > 0:
            use_amount = min(balance, remaining_amount)
            
            await db.users.update_one(
                {"id": customer_id},
                {"$inc": {"bidblitz_balance": -use_amount}}
            )
            
            used_universal = use_amount
            remaining_amount -= use_amount
    
    # Check if payment complete
    if remaining_amount > 0:
        # Rollback changes (simplified - in production use transactions)
        raise HTTPException(
            status_code=400, 
            detail=f"Nicht genug Guthaben. Es fehlen €{remaining_amount:.2f}"
        )
    
    # Calculate partner payout (after commission)
    partner_payout = amount * (1 - commission_rate / 100)
    
    # Create transaction record
    transaction_id = str(uuid.uuid4())[:12].upper()
    transaction = {
        "id": transaction_id,
        "type": "payment",
        "user_id": customer_id,
        "partner_id": partner_id,
        "partner_name": partner_name,
        "amount": amount,
        "partner_payout": partner_payout,
        "commission_rate": commission_rate,
        "commission_amount": amount - partner_payout,
        "used_vouchers": used_vouchers,
        "used_universal_balance": used_universal,
        "description": description or f"Zahlung bei {partner_name}",
        "status": "completed",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.bidblitz_pay_transactions.insert_one(transaction)
    
    # Update partner's pending payout
    await db.partner_accounts.update_one(
        {"id": partner_id},
        {
            "$inc": {"pending_payout": partner_payout},
            "$push": {
                "transactions": {
                    "id": transaction_id,
                    "type": "payment_received",
                    "amount": partner_payout,
                    "gross_amount": amount,
                    "customer_id": customer_id,
                    "date": datetime.now(timezone.utc).isoformat()
                }
            }
        }
    )
    
    # Also check restaurant_accounts
    await db.restaurant_accounts.update_one(
        {"id": partner_id},
        {
            "$inc": {"pending_payout": partner_payout},
            "$push": {
                "transactions": {
                    "id": transaction_id,
                    "type": "payment_received",
                    "amount": partner_payout,
                    "gross_amount": amount,
                    "customer_id": customer_id,
                    "date": datetime.now(timezone.utc).isoformat()
                }
            }
        }
    )
    
    # Mark payment token as used
    await db.payment_tokens.update_one(
        {"token": payment_token},
        {"$set": {"used": True, "used_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    logger.info(f"💳 BidBlitz Pay: €{amount:.2f} from {customer_id} to {partner_id}")
    
    return {
        "success": True,
        "transaction_id": transaction_id,
        "amount": amount,
        "partner_receives": partner_payout,
        "commission": amount - partner_payout,
        "used_vouchers": used_vouchers,
        "used_universal_balance": used_universal,
        "message": f"Zahlung von €{amount:.2f} erfolgreich!"
    }

# ==================== VOUCHER MANAGEMENT ====================

@router.post("/add-voucher-to-wallet")
async def add_voucher_to_wallet(
    voucher_code: str,
    user: dict = Depends(get_current_user)
):
    """Add a won voucher to user's wallet"""
    user_id = user["id"]
    
    # Check if voucher exists and belongs to user
    voucher = await db.vouchers.find_one({
        "code": voucher_code,
        "winner_id": user_id,
        "status": "won"
    }, {"_id": 0})
    
    if not voucher:
        # Also check won auctions for voucher products
        won_auction = await db.auctions.find_one({
            "winner_id": user_id,
            "status": "ended",
            "$or": [
                {"product.type": "voucher"},
                {"product.is_voucher": True}
            ]
        }, {"_id": 0})
        
        if won_auction:
            voucher = {
                "id": won_auction["id"],
                "name": won_auction.get("product_name", "Gutschein"),
                "value": won_auction.get("product", {}).get("value", won_auction.get("product_retail_price", 0)),
                "partner_id": won_auction.get("product", {}).get("partner_id"),
                "partner_name": won_auction.get("product", {}).get("partner_name")
            }
        else:
            raise HTTPException(status_code=404, detail="Gutschein nicht gefunden")
    
    # Check if already in wallet
    existing = await db.user_vouchers.find_one({
        "user_id": user_id,
        "source_id": voucher.get("id", voucher_code)
    })
    
    if existing:
        raise HTTPException(status_code=400, detail="Gutschein bereits in Wallet")
    
    # Add to wallet
    wallet_voucher = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "source_id": voucher.get("id", voucher_code),
        "name": voucher.get("name", "Gutschein"),
        "value": voucher.get("value", 0),
        "remaining_value": voucher.get("value", 0),
        "partner_id": voucher.get("partner_id"),
        "partner_name": voucher.get("partner_name"),
        "status": "active",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.user_vouchers.insert_one(wallet_voucher)
    
    # Mark original voucher as added to wallet
    await db.vouchers.update_one(
        {"code": voucher_code},
        {"$set": {"status": "in_wallet", "wallet_id": wallet_voucher["id"]}}
    )
    
    logger.info(f"Voucher added to wallet: {wallet_voucher['id']} for user {user_id}")
    
    return {
        "success": True,
        "message": "Gutschein zur Wallet hinzugefügt",
        "voucher": {k: v for k, v in wallet_voucher.items() if k != "_id"}
    }

@router.get("/voucher/{voucher_id}")
async def get_voucher_details(voucher_id: str, user: dict = Depends(get_current_user)):
    """Get details of a specific voucher in wallet"""
    voucher = await db.user_vouchers.find_one(
        {"id": voucher_id, "user_id": user["id"]},
        {"_id": 0}
    )
    
    if not voucher:
        raise HTTPException(status_code=404, detail="Gutschein nicht gefunden")
    
    # Get transaction history for this voucher
    transactions = await db.bidblitz_pay_transactions.find(
        {"used_vouchers.voucher_id": voucher_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(20)
    
    return {
        "voucher": voucher,
        "transactions": transactions
    }

# ==================== ADMIN ENDPOINTS ====================

@router.get("/admin/transactions")
async def admin_get_all_transactions(
    limit: int = Query(default=50, le=200),
    partner_id: Optional[str] = None
):
    """Admin: Get all BidBlitz Pay transactions"""
    query = {}
    if partner_id:
        query["partner_id"] = partner_id
    
    transactions = await db.bidblitz_pay_transactions.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).to_list(limit)
    
    # Calculate totals
    total_volume = sum(t.get("amount", 0) for t in transactions)
    total_commission = sum(t.get("commission_amount", 0) for t in transactions)
    
    return {
        "transactions": transactions,
        "total_count": len(transactions),
        "total_volume": total_volume,
        "total_commission": total_commission
    }

@router.post("/admin/add-balance")
async def admin_add_user_balance(
    user_id: str,
    amount: float,
    reason: str = "Admin-Gutschrift"
):
    """Admin: Add universal balance to user account"""
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Betrag muss positiv sein")
    
    result = await db.users.update_one(
        {"id": user_id},
        {
            "$inc": {"bidblitz_balance": amount},
            "$push": {
                "balance_history": {
                    "amount": amount,
                    "type": "admin_credit",
                    "reason": reason,
                    "date": datetime.now(timezone.utc).isoformat()
                }
            }
        }
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Benutzer nicht gefunden")
    
    logger.info(f"Admin added €{amount:.2f} balance to user {user_id}: {reason}")
    
    return {
        "success": True,
        "message": f"€{amount:.2f} zum Guthaben hinzugefügt",
        "user_id": user_id,
        "amount": amount
    }


@router.post("/admin/credit-by-customer-number")
async def admin_credit_by_customer_number(data: CustomerCreditRequest):
    """
    Admin: Gutschrift per Kundennummer (für Überweisungen)
    
    - customer_number: z.B. "BID-123456"
    - amount: Betrag in Euro
    - description: Beschreibung (optional)
    - reference: Externe Referenz wie Bank-Überweisungs-ID (optional)
    """
    customer_number = data.customer_number.upper().strip()
    
    if data.amount <= 0:
        raise HTTPException(status_code=400, detail="Betrag muss positiv sein")
    
    # Find user by customer number
    user = await db.users.find_one(
        {"customer_number": customer_number},
        {"_id": 0, "id": 1, "name": 1, "email": 1, "customer_number": 1}
    )
    
    if not user:
        raise HTTPException(status_code=404, detail=f"Kundennummer {customer_number} nicht gefunden")
    
    # Add balance
    description = data.description or "Überweisung"
    await db.users.update_one(
        {"id": user["id"]},
        {
            "$inc": {"bidblitz_balance": data.amount},
            "$push": {
                "balance_history": {
                    "id": str(uuid.uuid4()),
                    "amount": data.amount,
                    "type": "bank_transfer",
                    "description": description,
                    "reference": data.reference,
                    "customer_number": customer_number,
                    "date": datetime.now(timezone.utc).isoformat()
                }
            }
        }
    )
    
    # Also update wallets collection for consistency
    await db.wallets.update_one(
        {"user_id": user["id"]},
        {"$inc": {"balance": data.amount}},
        upsert=True
    )
    
    # Create transaction record
    await db.wallet_transactions.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "type": "bank_transfer_credit",
        "amount": data.amount,
        "description": description,
        "reference": data.reference,
        "customer_number": customer_number,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    logger.info(f"Admin credited €{data.amount:.2f} to {customer_number} ({user['email']}): {description}")
    
    return {
        "success": True,
        "message": f"€{data.amount:.2f} gutgeschrieben an {customer_number}",
        "customer_number": customer_number,
        "customer_name": user.get("name", ""),
        "amount": data.amount,
        "reference": data.reference
    }


@router.get("/admin/search-customer")
async def admin_search_customer(q: str = Query(..., min_length=3)):
    """Admin: Search customer by number, email, or name"""
    query = q.upper().strip()
    
    # Search by customer_number, email, or name
    users = await db.users.find(
        {
            "$or": [
                {"customer_number": {"$regex": query, "$options": "i"}},
                {"email": {"$regex": query, "$options": "i"}},
                {"name": {"$regex": query, "$options": "i"}}
            ]
        },
        {"_id": 0, "id": 1, "customer_number": 1, "name": 1, "email": 1, "bidblitz_balance": 1}
    ).limit(20).to_list(20)
    
    return {
        "results": users,
        "count": len(users)
    }


# ==================== TRANSACTION HISTORY ====================

@router.get("/transaction-history")
async def get_transaction_history(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    type: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    min_amount: Optional[float] = None,
    max_amount: Optional[float] = None,
    search: Optional[str] = None,
    user: dict = Depends(get_current_user)
):
    """Get user's transaction history with filters"""
    user_id = user["id"]
    
    # Build query
    query = {"user_id": user_id}
    
    # Type filter
    type_mapping = {
        "deposit": ["topup", "deposit", "bank_transfer_credit", "credit_disbursement"],
        "withdrawal": ["withdrawal", "payout", "credit_repayment"],
        "credit": ["credit_disbursement", "credit_repayment"],
        "cashback": ["cashback", "cashback_payout", "cashback_earning"],
        "transfer": ["transfer_in", "transfer_out", "bank_transfer_credit"]
    }
    
    if type and type != "all" and type in type_mapping:
        query["type"] = {"$in": type_mapping[type]}
    
    # Date filters
    if date_from:
        query["created_at"] = {"$gte": date_from}
    if date_to:
        if "created_at" in query:
            query["created_at"]["$lte"] = date_to + "T23:59:59"
        else:
            query["created_at"] = {"$lte": date_to + "T23:59:59"}
    
    # Amount filters
    if min_amount is not None:
        query["$or"] = [
            {"amount": {"$gte": min_amount}},
            {"amount": {"$lte": -min_amount}}
        ]
    if max_amount is not None:
        if "$or" not in query:
            query["$and"] = [
                {"$or": [
                    {"amount": {"$lte": max_amount}},
                    {"amount": {"$gte": -max_amount}}
                ]}
            ]
    
    # Search in description
    if search:
        query["description"] = {"$regex": search, "$options": "i"}
    
    # Count total
    total = await db.wallet_transactions.count_documents(query)
    
    # Get transactions
    skip = (page - 1) * limit
    transactions = await db.wallet_transactions.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    # Also get from balance_history in users collection
    user_data = await db.users.find_one({"id": user_id}, {"_id": 0, "balance_history": 1})
    balance_history = user_data.get("balance_history", []) if user_data else []
    
    # Merge and sort
    all_transactions = transactions + [
        {**h, "type": h.get("type", "balance_change")} 
        for h in balance_history 
        if not date_from or h.get("date", "") >= date_from
    ]
    
    # Sort by date
    all_transactions.sort(key=lambda x: x.get("created_at") or x.get("date", ""), reverse=True)
    
    # Paginate
    paginated = all_transactions[skip:skip + limit]
    
    return {
        "transactions": paginated,
        "total": max(total, len(all_transactions)),
        "page": page,
        "limit": limit,
        "total_pages": (max(total, len(all_transactions)) + limit - 1) // limit
    }


@router.get("/export-transactions")
async def export_transactions(
    format: str = Query("csv"),
    type: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    user: dict = Depends(get_current_user)
):
    """Export user's transactions as CSV"""
    from fastapi.responses import Response
    import csv
    import io
    
    user_id = user["id"]
    
    # Build query
    query = {"user_id": user_id}
    if type and type != "all":
        type_mapping = {
            "deposit": ["topup", "deposit", "bank_transfer_credit"],
            "withdrawal": ["withdrawal", "payout"],
            "credit": ["credit_disbursement", "credit_repayment"],
            "cashback": ["cashback", "cashback_payout"],
            "transfer": ["transfer_in", "transfer_out"]
        }
        if type in type_mapping:
            query["type"] = {"$in": type_mapping[type]}
    
    if date_from:
        query["created_at"] = {"$gte": date_from}
    if date_to:
        if "created_at" in query:
            query["created_at"]["$lte"] = date_to + "T23:59:59"
        else:
            query["created_at"] = {"$lte": date_to + "T23:59:59"}
    
    # Get all transactions
    transactions = await db.wallet_transactions.find(
        query, {"_id": 0}
    ).sort("created_at", -1).to_list(1000)
    
    if format == "csv":
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["Datum", "Typ", "Beschreibung", "Betrag", "Referenz", "Status"])
        
        for tx in transactions:
            writer.writerow([
                tx.get("created_at", "")[:19].replace("T", " "),
                tx.get("type", ""),
                tx.get("description", ""),
                f"{tx.get('amount', 0):.2f}",
                tx.get("reference", ""),
                tx.get("status", "completed")
            ])
        
        csv_content = output.getvalue()
        return Response(
            content=csv_content,
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=transactions.csv"}
        )
    
    return {"transactions": transactions}


bidblitz_pay_router = router
