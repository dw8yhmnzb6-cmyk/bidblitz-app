"""Gift Cards Router - Buy and redeem gift cards"""
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone
from typing import Optional, List
from pydantic import BaseModel, EmailStr
import uuid
import os
import string
import random
import stripe

from config import db, logger, FRONTEND_URL
from dependencies import get_current_user

router = APIRouter(prefix="/giftcards", tags=["Gift Cards"])

# Stripe configuration
STRIPE_API_KEY = os.environ.get('STRIPE_API_KEY')
if STRIPE_API_KEY:
    stripe.api_key = STRIPE_API_KEY

# ==================== MODELS ====================

class GiftCardPurchase(BaseModel):
    amount: float  # Euro amount
    recipient_email: Optional[EmailStr] = None
    recipient_name: Optional[str] = None
    sender_name: Optional[str] = None
    message: Optional[str] = None
    send_now: bool = True  # Send email immediately after purchase

class GiftCardRedeem(BaseModel):
    code: str
    redeem_as: str = "bids"  # "bids" or "balance"

# ==================== FIXED PACKAGES ====================

GIFTCARD_PACKAGES = [
    {"id": "gc_10", "amount": 10, "bids_value": 20, "label": "€10 Geschenkkarte"},
    {"id": "gc_25", "amount": 25, "bids_value": 55, "label": "€25 Geschenkkarte"},
    {"id": "gc_50", "amount": 50, "bids_value": 120, "label": "€50 Geschenkkarte"},
    {"id": "gc_100", "amount": 100, "bids_value": 260, "label": "€100 Geschenkkarte"},
]

def generate_giftcard_code():
    """Generate unique 16-character gift card code"""
    chars = string.ascii_uppercase + string.digits
    # Format: XXXX-XXXX-XXXX-XXXX
    segments = [''.join(random.choices(chars, k=4)) for _ in range(4)]
    return '-'.join(segments)

def calculate_bids_from_amount(amount: float) -> int:
    """Calculate bids value from euro amount (2 bids per €1)"""
    return int(amount * 2)

# ==================== ENDPOINTS ====================

@router.get("/packages")
async def get_giftcard_packages():
    """Get available gift card packages"""
    return {
        "fixed_packages": GIFTCARD_PACKAGES,
        "custom": {
            "min_amount": 5,
            "max_amount": 500,
            "bids_per_euro": 2
        }
    }

@router.post("/purchase")
async def purchase_giftcard(data: GiftCardPurchase, user: dict = Depends(get_current_user)):
    """Purchase a gift card via Stripe"""
    if not STRIPE_API_KEY:
        raise HTTPException(status_code=503, detail="Zahlungsdienst nicht verfügbar")
    
    # Validate amount
    if data.amount < 5 or data.amount > 500:
        raise HTTPException(status_code=400, detail="Betrag muss zwischen €5 und €500 liegen")
    
    try:
        # Generate unique code
        code = generate_giftcard_code()
        
        # Ensure code is unique
        while await db.giftcards.find_one({"code": code}):
            code = generate_giftcard_code()
        
        # Calculate bids value
        bids_value = calculate_bids_from_amount(data.amount)
        
        # Create giftcard record (pending)
        giftcard_id = str(uuid.uuid4())
        giftcard = {
            "id": giftcard_id,
            "code": code,
            "amount": data.amount,
            "bids_value": bids_value,
            "purchaser_id": user["id"],
            "purchaser_name": user.get("name", "Anonym"),
            "purchaser_email": user.get("email"),
            "recipient_email": data.recipient_email,
            "recipient_name": data.recipient_name,
            "sender_name": data.sender_name or user.get("name", "Ein Freund"),
            "message": data.message,
            "send_email": data.send_now,
            "status": "pending",  # pending -> active -> redeemed
            "redeemed_by": None,
            "redeemed_at": None,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.giftcards.insert_one(giftcard)
        
        # Create Stripe session
        session = stripe.checkout.Session.create(
            payment_method_types=["card"],
            line_items=[{
                "price_data": {
                    "currency": "eur",
                    "unit_amount": int(data.amount * 100),
                    "product_data": {
                        "name": f"bidblitz.ae Geschenkkarte €{data.amount:.0f}",
                        "description": f"Geschenkkarte im Wert von {bids_value} Geboten" + (f" für {data.recipient_name}" if data.recipient_name else "")
                    }
                },
                "quantity": 1
            }],
            mode="payment",
            success_url=f"{FRONTEND_URL}/giftcards/success?session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url=f"{FRONTEND_URL}/giftcards?canceled=true",
            metadata={
                "type": "giftcard",
                "giftcard_id": giftcard_id,
                "user_id": user["id"],
                "amount": str(data.amount),
                "code": code
            }
        )
        
        # Update giftcard with session ID
        await db.giftcards.update_one(
            {"id": giftcard_id},
            {"$set": {"stripe_session_id": session.id}}
        )
        
        return {
            "success": True,
            "session_id": session.id,
            "url": session.url,
            "giftcard_id": giftcard_id
        }
        
    except stripe.error.StripeError as e:
        logger.error(f"Stripe giftcard error: {e}")
        raise HTTPException(status_code=500, detail=f"Zahlungsfehler: {str(e)}")
    except Exception as e:
        logger.error(f"Giftcard purchase error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/purchase/status/{session_id}")
async def get_giftcard_status(session_id: str, user: dict = Depends(get_current_user)):
    """Check giftcard purchase status and activate if paid"""
    if not STRIPE_API_KEY:
        raise HTTPException(status_code=503, detail="Zahlungsdienst nicht verfügbar")
    
    try:
        session = stripe.checkout.Session.retrieve(session_id)
        
        if session.payment_status == "paid":
            # Find and activate giftcard
            giftcard = await db.giftcards.find_one({
                "stripe_session_id": session_id,
                "status": "pending"
            })
            
            if giftcard:
                # Activate giftcard
                await db.giftcards.update_one(
                    {"id": giftcard["id"]},
                    {"$set": {
                        "status": "active",
                        "activated_at": datetime.now(timezone.utc).isoformat()
                    }}
                )
                
                logger.info(f"Gift card activated: {giftcard['code']} (€{giftcard['amount']})")
                
                # Send email if requested
                if giftcard.get("send_email") and giftcard.get("recipient_email"):
                    await send_giftcard_email(giftcard)
                
                # Return giftcard details
                return {
                    "status": "completed",
                    "giftcard": {
                        "code": giftcard["code"],
                        "amount": giftcard["amount"],
                        "bids_value": giftcard["bids_value"],
                        "recipient_name": giftcard.get("recipient_name"),
                        "recipient_email": giftcard.get("recipient_email")
                    }
                }
        
        return {
            "status": session.status,
            "payment_status": session.payment_status
        }
        
    except stripe.error.StripeError as e:
        logger.error(f"Stripe status check error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/redeem")
async def redeem_giftcard(data: GiftCardRedeem, user: dict = Depends(get_current_user)):
    """Redeem a gift card code"""
    code = data.code.upper().strip()
    
    # Find giftcard
    giftcard = await db.giftcards.find_one({"code": code})
    
    if not giftcard:
        raise HTTPException(status_code=404, detail="Ungültiger Geschenkkarten-Code")
    
    if giftcard["status"] == "pending":
        raise HTTPException(status_code=400, detail="Diese Geschenkkarte wurde noch nicht bezahlt")
    
    if giftcard["status"] == "redeemed":
        raise HTTPException(status_code=400, detail="Diese Geschenkkarte wurde bereits eingelöst")
    
    # Redeem based on type
    if data.redeem_as == "bids":
        # Add bids to user balance
        await db.users.update_one(
            {"id": user["id"]},
            {"$inc": {"bids_balance": giftcard["bids_value"]}}
        )
        credit_message = f"{giftcard['bids_value']} Gebote"
    else:
        # Add euro balance (for buying bids later)
        await db.users.update_one(
            {"id": user["id"]},
            {"$inc": {"giftcard_balance": giftcard["amount"]}}
        )
        credit_message = f"€{giftcard['amount']:.2f} Guthaben"
    
    # Mark as redeemed
    await db.giftcards.update_one(
        {"id": giftcard["id"]},
        {"$set": {
            "status": "redeemed",
            "redeemed_by": user["id"],
            "redeemed_by_name": user.get("name"),
            "redeemed_at": datetime.now(timezone.utc).isoformat(),
            "redeemed_as": data.redeem_as
        }}
    )
    
    logger.info(f"Gift card redeemed: {code} by {user['id']} as {data.redeem_as}")
    
    return {
        "success": True,
        "message": f"Geschenkkarte eingelöst! {credit_message} wurde Ihrem Konto gutgeschrieben.",
        "credited": {
            "type": data.redeem_as,
            "amount": giftcard["bids_value"] if data.redeem_as == "bids" else giftcard["amount"]
        }
    }

@router.get("/my-purchased")
async def get_my_purchased_giftcards(user: dict = Depends(get_current_user)):
    """Get gift cards purchased by the current user"""
    giftcards = await db.giftcards.find(
        {"purchaser_id": user["id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    
    return giftcards

@router.get("/my-balance")
async def get_my_giftcard_balance(user: dict = Depends(get_current_user)):
    """Get user's gift card balance"""
    user_data = await db.users.find_one({"id": user["id"]}, {"_id": 0, "giftcard_balance": 1})
    return {
        "balance": user_data.get("giftcard_balance", 0)
    }

@router.get("/validate/{code}")
async def validate_giftcard_code(code: str):
    """Validate a gift card code (public endpoint for checking)"""
    code = code.upper().strip()
    
    giftcard = await db.giftcards.find_one({"code": code}, {"_id": 0, "code": 1, "status": 1, "amount": 1, "bids_value": 1})
    
    if not giftcard:
        return {"valid": False, "message": "Code nicht gefunden"}
    
    if giftcard["status"] == "pending":
        return {"valid": False, "message": "Zahlung ausstehend"}
    
    if giftcard["status"] == "redeemed":
        return {"valid": False, "message": "Bereits eingelöst"}
    
    return {
        "valid": True,
        "amount": giftcard["amount"],
        "bids_value": giftcard["bids_value"],
        "message": f"Geschenkkarte gültig: €{giftcard['amount']:.0f} ({giftcard['bids_value']} Gebote)"
    }

# ==================== EMAIL ====================

async def send_giftcard_email(giftcard: dict):
    """Send gift card email to recipient"""
    try:
        from utils.email import send_email
        
        html_content = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px; border-radius: 20px;">
            <div style="background: white; padding: 40px; border-radius: 16px; text-align: center;">
                <h1 style="color: #7C3AED; margin-bottom: 10px;">🎁 Sie haben eine Geschenkkarte erhalten!</h1>
                <p style="color: #666; font-size: 18px;">Von: <strong>{giftcard.get('sender_name', 'Ein Freund')}</strong></p>
                
                {f'<p style="color: #333; font-style: italic; padding: 20px; background: #f8f9fa; border-radius: 8px; margin: 20px 0;">"{giftcard.get("message")}"</p>' if giftcard.get('message') else ''}
                
                <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 30px; border-radius: 12px; margin: 30px 0;">
                    <p style="color: white; margin: 0 0 10px 0; font-size: 14px;">Ihr Geschenkkarten-Code:</p>
                    <p style="font-family: monospace; font-size: 28px; font-weight: bold; color: white; letter-spacing: 3px; margin: 0;">
                        {giftcard['code']}
                    </p>
                </div>
                
                <div style="display: flex; justify-content: center; gap: 20px; margin: 20px 0;">
                    <div style="text-align: center; padding: 15px 30px; background: #f0fdf4; border-radius: 8px;">
                        <p style="color: #16a34a; font-size: 24px; font-weight: bold; margin: 0;">€{giftcard['amount']:.0f}</p>
                        <p style="color: #666; font-size: 12px; margin: 5px 0 0 0;">Wert</p>
                    </div>
                    <div style="text-align: center; padding: 15px 30px; background: #fef3c7; border-radius: 8px;">
                        <p style="color: #d97706; font-size: 24px; font-weight: bold; margin: 0;">{giftcard['bids_value']}</p>
                        <p style="color: #666; font-size: 12px; margin: 5px 0 0 0;">Gebote</p>
                    </div>
                </div>
                
                <a href="{FRONTEND_URL}/giftcards/redeem?code={giftcard['code']}" 
                   style="display: inline-block; background: linear-gradient(135deg, #7C3AED 0%, #6D28D9 100%); color: white; padding: 15px 40px; border-radius: 30px; text-decoration: none; font-weight: bold; font-size: 16px; margin-top: 20px;">
                    Jetzt einlösen
                </a>
                
                <p style="color: #999; font-size: 12px; margin-top: 30px;">
                    Lösen Sie Ihre Geschenkkarte auf bidblitz.ae ein und starten Sie mit dem Bieten!
                </p>
            </div>
        </div>
        """
        
        await send_email(
            to_email=giftcard["recipient_email"],
            subject=f"🎁 {giftcard.get('sender_name', 'Jemand')} hat Ihnen eine bidblitz.ae Geschenkkarte geschenkt!",
            html_content=html_content
        )
        
        logger.info(f"Gift card email sent to {giftcard['recipient_email']}")
        
    except Exception as e:
        logger.error(f"Failed to send giftcard email: {e}")

# ==================== ADMIN ENDPOINTS ====================

@router.get("/admin/all")
async def get_all_giftcards(user: dict = Depends(get_current_user)):
    """Get all gift cards (admin only)"""
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    
    giftcards = await db.giftcards.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    
    # Stats
    total = len(giftcards)
    active = len([g for g in giftcards if g["status"] == "active"])
    redeemed = len([g for g in giftcards if g["status"] == "redeemed"])
    total_value = sum(g["amount"] for g in giftcards if g["status"] in ["active", "redeemed"])
    
    return {
        "giftcards": giftcards,
        "stats": {
            "total": total,
            "active": active,
            "redeemed": redeemed,
            "pending": total - active - redeemed,
            "total_value": total_value
        }
    }

# ==================== QR CODE ====================

@router.get("/qr/{code}")
async def get_giftcard_qr(code: str):
    """Generate QR code for gift card"""
    import qrcode
    import io
    import base64
    
    code = code.upper().strip()
    
    # Verify card exists
    giftcard = await db.giftcards.find_one({"code": code})
    if not giftcard:
        raise HTTPException(status_code=404, detail="Gift Card nicht gefunden")
    
    # Generate QR code
    qr = qrcode.QRCode(version=1, box_size=10, border=4)
    qr_data = f"{FRONTEND_URL}/giftcards/redeem?code={code}"
    qr.add_data(qr_data)
    qr.make(fit=True)
    
    img = qr.make_image(fill_color="black", back_color="white")
    
    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    buffer.seek(0)
    
    qr_base64 = base64.b64encode(buffer.getvalue()).decode()
    
    return {
        "code": code,
        "qr_code": qr_base64,
        "qr_url": qr_data,
        "amount": giftcard["amount"],
        "status": giftcard["status"]
    }

# ==================== ADMIN CREATE ====================

@router.post("/admin/create")
async def admin_create_giftcards(
    amount: float,
    quantity: int = 1,
    expires_days: int = 365,
    description: str = None,
    user: dict = Depends(get_current_user)
):
    """Admin: Create gift cards directly (no payment)"""
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    
    if amount < 1 or amount > 10000:
        raise HTTPException(status_code=400, detail="Betrag: €1 - €10.000")
    
    if quantity < 1 or quantity > 100:
        raise HTTPException(status_code=400, detail="Anzahl: 1 - 100")
    
    created_cards = []
    now = datetime.now(timezone.utc)
    bids_value = calculate_bids_from_amount(amount)
    
    for _ in range(quantity):
        code = generate_giftcard_code()
        while await db.giftcards.find_one({"code": code}):
            code = generate_giftcard_code()
        
        giftcard = {
            "id": str(uuid.uuid4()),
            "code": code,
            "amount": amount,
            "bids_value": bids_value,
            "status": "active",
            "type": "admin_created",
            "created_by_admin": user["id"],
            "created_by_name": user.get("name", "Admin"),
            "description": description,
            "expires_at": (now + timezone.timedelta(days=expires_days)).isoformat() if hasattr(timezone, 'timedelta') else None,
            "created_at": now.isoformat()
        }
        
        await db.giftcards.insert_one(giftcard)
        created_cards.append({
            "code": code,
            "amount": amount,
            "bids_value": bids_value
        })
    
    logger.info(f"Admin {user['id']} created {quantity} gift cards x €{amount}")
    
    return {
        "success": True,
        "message": f"{quantity} Gift Card(s) über €{amount:.2f} erstellt",
        "cards": created_cards
    }

# ==================== PARTNER SALES ====================

@router.post("/partner/sell")
async def partner_sell_giftcard(
    amount: float,
    customer_name: str = None,
    authorization: str = None
):
    """Partner: Sell physical gift card at POS"""
    if not authorization:
        raise HTTPException(status_code=401, detail="Partner-Login erforderlich")
    
    token = authorization.replace("Bearer ", "")
    
    # Check partner or staff
    partner = None
    staff = await db.staff_accounts.find_one({"token": token}, {"_id": 0})
    if staff:
        partner = await db.enterprise_partners.find_one({"id": staff["partner_id"]}, {"_id": 0})
    
    if not partner:
        partner = await db.enterprise_partners.find_one({"api_key": token}, {"_id": 0})
    
    if not partner:
        raise HTTPException(status_code=403, detail="Partner-Berechtigung erforderlich")
    
    if amount < 5 or amount > 500:
        raise HTTPException(status_code=400, detail="Betrag: €5 - €500")
    
    code = generate_giftcard_code()
    while await db.giftcards.find_one({"code": code}):
        code = generate_giftcard_code()
    
    bids_value = calculate_bids_from_amount(amount)
    now = datetime.now(timezone.utc)
    
    giftcard = {
        "id": str(uuid.uuid4()),
        "code": code,
        "amount": amount,
        "bids_value": bids_value,
        "status": "active",
        "type": "partner_sold",
        "sold_by_partner_id": partner["id"],
        "sold_by_partner_name": partner.get("name", ""),
        "sold_by_staff": staff["id"] if staff else None,
        "customer_name": customer_name,
        "created_at": now.isoformat()
    }
    
    await db.giftcards.insert_one(giftcard)
    
    # Track partner commission (5%)
    commission = amount * 0.05
    await db.partner_transactions.insert_one({
        "id": str(uuid.uuid4()),
        "partner_id": partner["id"],
        "type": "giftcard_commission",
        "amount": commission,
        "giftcard_code": code,
        "created_at": now.isoformat()
    })
    
    # Generate QR
    import qrcode
    import io
    import base64
    
    qr = qrcode.QRCode(version=1, box_size=10, border=4)
    qr.add_data(f"{FRONTEND_URL}/giftcards/redeem?code={code}")
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    qr_base64 = base64.b64encode(buffer.getvalue()).decode()
    
    logger.info(f"Partner {partner['id']} sold gift card: {code} (€{amount})")
    
    return {
        "success": True,
        "message": f"Gift Card €{amount:.2f} verkauft!",
        "giftcard": {
            "code": code,
            "amount": amount,
            "bids_value": bids_value,
            "qr_code": qr_base64
        },
        "commission": commission
    }

# ==================== REDEEM AS BIDBLITZ BALANCE ====================

@router.post("/redeem-balance")
async def redeem_as_bidblitz_balance(data: GiftCardRedeem, user: dict = Depends(get_current_user)):
    """Redeem gift card directly to BidBlitz Pay balance"""
    code = data.code.upper().strip()
    
    giftcard = await db.giftcards.find_one({"code": code})
    
    if not giftcard:
        raise HTTPException(status_code=404, detail="Ungültiger Code")
    
    if giftcard["status"] != "active":
        if giftcard["status"] == "redeemed":
            raise HTTPException(status_code=400, detail="Bereits eingelöst")
        raise HTTPException(status_code=400, detail=f"Status: {giftcard['status']}")
    
    # Add to BidBlitz balance
    await db.users.update_one(
        {"id": user["id"]},
        {"$inc": {"bidblitz_balance": giftcard["amount"]}}
    )
    
    # Mark as redeemed
    await db.giftcards.update_one(
        {"id": giftcard["id"]},
        {"$set": {
            "status": "redeemed",
            "redeemed_by": user["id"],
            "redeemed_by_name": user.get("name"),
            "redeemed_at": datetime.now(timezone.utc).isoformat(),
            "redeemed_as": "bidblitz_balance"
        }}
    )
    
    # Get new balance
    updated_user = await db.users.find_one({"id": user["id"]}, {"_id": 0, "bidblitz_balance": 1})
    
    logger.info(f"Gift card {code} redeemed to balance by {user['id']}")
    
    return {
        "success": True,
        "message": f"€{giftcard['amount']:.2f} wurde Ihrem BidBlitz Guthaben hinzugefügt!",
        "amount": giftcard["amount"],
        "new_balance": updated_user.get("bidblitz_balance", 0)
    }

# ==================== CHECKOUT APPLY ====================

@router.post("/apply-checkout")
async def apply_to_checkout(code: str, checkout_total: float, user: dict = Depends(get_current_user)):
    """Apply gift card to checkout (partial or full payment)"""
    code = code.upper().strip()
    
    giftcard = await db.giftcards.find_one({"code": code})
    
    if not giftcard:
        raise HTTPException(status_code=404, detail="Ungültiger Code")
    
    if giftcard["status"] != "active":
        raise HTTPException(status_code=400, detail=f"Gift Card ist {giftcard['status']}")
    
    gc_amount = giftcard["amount"]
    applied = min(gc_amount, checkout_total)
    remaining = max(0, checkout_total - applied)
    gc_remaining = max(0, gc_amount - applied)
    
    return {
        "valid": True,
        "code": code,
        "gift_card_amount": gc_amount,
        "applied_amount": applied,
        "checkout_remaining": remaining,
        "gift_card_remaining": gc_remaining,
        "message": f"€{applied:.2f} wird abgezogen" + (f", €{remaining:.2f} verbleibend" if remaining > 0 else "")
    }

# ==================== STATS ====================

@router.get("/admin/stats")
async def get_giftcard_stats(user: dict = Depends(get_current_user)):
    """Get gift card statistics"""
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    
    stats = {
        "total": await db.giftcards.count_documents({}),
        "active": await db.giftcards.count_documents({"status": "active"}),
        "redeemed": await db.giftcards.count_documents({"status": "redeemed"}),
        "pending": await db.giftcards.count_documents({"status": "pending"}),
        "partner_sold": await db.giftcards.count_documents({"type": "partner_sold"}),
        "admin_created": await db.giftcards.count_documents({"type": "admin_created"})
    }
    
    # Value stats
    all_cards = await db.giftcards.find({}, {"amount": 1, "status": 1}).to_list(10000)
    stats["total_value"] = sum(c["amount"] for c in all_cards)
    stats["active_value"] = sum(c["amount"] for c in all_cards if c["status"] == "active")
    stats["redeemed_value"] = sum(c["amount"] for c in all_cards if c["status"] == "redeemed")
    
    return stats
