"""Gift Card System - Vollständiges Geschenkkarten-System für BidBlitz"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone, timedelta
from motor.motor_asyncio import AsyncIOMotorClient
import os
import uuid
import random
import string
import qrcode
import io
import base64

# Database
MONGO_URL = os.environ.get("MONGO_URL")
DB_NAME = os.environ.get("DB_NAME", "bidblitz")
client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

router = APIRouter(prefix="/gift-cards", tags=["Gift Cards"])

# ==================== MODELS ====================

class GiftCardCreate(BaseModel):
    amount: float
    quantity: int = 1
    type: str = "digital"  # digital, physical, qr
    expires_in_days: int = 365
    description: Optional[str] = None
    recipient_email: Optional[str] = None
    recipient_name: Optional[str] = None
    sender_name: Optional[str] = None
    message: Optional[str] = None

class GiftCardRedeem(BaseModel):
    code: str

class GiftCardPurchase(BaseModel):
    amount: float
    type: str = "digital"
    recipient_email: Optional[str] = None
    recipient_name: Optional[str] = None
    message: Optional[str] = None
    payment_method: str = "balance"  # balance, stripe

# ==================== HELPERS ====================

def generate_gift_code(prefix: str = "BB") -> str:
    """Generiert einen einzigartigen Gift Card Code: BB-XXXX-XXXX-XXXX"""
    chars = string.ascii_uppercase + string.digits
    parts = [''.join(random.choices(chars, k=4)) for _ in range(3)]
    return f"{prefix}-{'-'.join(parts)}"

def generate_qr_code(data: str) -> str:
    """Generiert einen QR-Code als Base64 String"""
    qr = qrcode.QRCode(version=1, box_size=10, border=4)
    qr.add_data(data)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    
    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    buffer.seek(0)
    
    return base64.b64encode(buffer.getvalue()).decode()

async def get_current_user(authorization: str = None):
    """Einfache Auth-Funktion"""
    if not authorization:
        raise HTTPException(status_code=401, detail="Nicht autorisiert")
    
    token = authorization.replace("Bearer ", "")
    user = await db.users.find_one({"token": token}, {"_id": 0})
    if not user:
        # Try session token
        session = await db.sessions.find_one({"token": token}, {"_id": 0})
        if session:
            user = await db.users.find_one({"id": session["user_id"]}, {"_id": 0})
    
    if not user:
        raise HTTPException(status_code=401, detail="Ungültiger Token")
    return user

async def get_admin_user(authorization: str = None):
    """Admin Auth"""
    user = await get_current_user(authorization)
    if user.get("role") not in ["admin", "superadmin"]:
        raise HTTPException(status_code=403, detail="Admin-Rechte erforderlich")
    return user

# ==================== PUBLIC ENDPOINTS ====================

@router.post("/redeem")
async def redeem_gift_card(data: GiftCardRedeem, authorization: str = None):
    """Gift Card einlösen und Guthaben aufladen"""
    from fastapi import Header
    
    # Get user from header
    if not authorization:
        raise HTTPException(status_code=401, detail="Bitte einloggen")
    
    token = authorization.replace("Bearer ", "")
    user = await db.users.find_one({"token": token}, {"_id": 0})
    if not user:
        session = await db.sessions.find_one({"token": token}, {"_id": 0})
        if session:
            user = await db.users.find_one({"id": session["user_id"]}, {"_id": 0})
    
    if not user:
        raise HTTPException(status_code=401, detail="Ungültiger Token")
    
    user_id = user["id"]
    code = data.code.upper().strip()
    
    # Find gift card
    gift_card = await db.gift_cards.find_one({"code": code}, {"_id": 0})
    
    if not gift_card:
        raise HTTPException(status_code=404, detail="Gift Card nicht gefunden")
    
    if gift_card["status"] != "active":
        if gift_card["status"] == "redeemed":
            raise HTTPException(status_code=400, detail="Gift Card wurde bereits eingelöst")
        elif gift_card["status"] == "expired":
            raise HTTPException(status_code=400, detail="Gift Card ist abgelaufen")
        else:
            raise HTTPException(status_code=400, detail=f"Gift Card ist {gift_card['status']}")
    
    # Check expiry
    expires_at = datetime.fromisoformat(gift_card["expires_at"].replace("Z", "+00:00"))
    if datetime.now(timezone.utc) > expires_at:
        await db.gift_cards.update_one({"code": code}, {"$set": {"status": "expired"}})
        raise HTTPException(status_code=400, detail="Gift Card ist abgelaufen")
    
    amount = gift_card["amount"]
    
    # Add to user balance
    await db.users.update_one(
        {"id": user_id},
        {"$inc": {"bidblitz_balance": amount}}
    )
    
    # Update gift card
    await db.gift_cards.update_one(
        {"code": code},
        {
            "$set": {
                "status": "redeemed",
                "redeemed_by": user_id,
                "redeemed_by_name": user.get("name", ""),
                "redeemed_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    # Create transaction record
    await db.transactions.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "type": "gift_card_redeem",
        "amount": amount,
        "gift_card_code": code,
        "description": f"Gift Card eingelöst: {code}",
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    # Get new balance
    updated_user = await db.users.find_one({"id": user_id}, {"_id": 0, "bidblitz_balance": 1})
    new_balance = updated_user.get("bidblitz_balance", 0)
    
    return {
        "success": True,
        "message": f"€{amount:.2f} wurde Ihrem Guthaben hinzugefügt!",
        "amount": amount,
        "new_balance": new_balance
    }

@router.get("/check/{code}")
async def check_gift_card(code: str):
    """Gift Card Status prüfen (ohne einzulösen)"""
    code = code.upper().strip()
    
    gift_card = await db.gift_cards.find_one({"code": code}, {"_id": 0})
    
    if not gift_card:
        raise HTTPException(status_code=404, detail="Gift Card nicht gefunden")
    
    # Check expiry
    expires_at = datetime.fromisoformat(gift_card["expires_at"].replace("Z", "+00:00"))
    is_expired = datetime.now(timezone.utc) > expires_at
    
    return {
        "code": code,
        "amount": gift_card["amount"],
        "status": "expired" if is_expired else gift_card["status"],
        "type": gift_card.get("type", "digital"),
        "expires_at": gift_card["expires_at"],
        "is_valid": gift_card["status"] == "active" and not is_expired
    }

@router.post("/purchase")
async def purchase_gift_card(data: GiftCardPurchase, authorization: str = None):
    """Gift Card kaufen"""
    if not authorization:
        raise HTTPException(status_code=401, detail="Bitte einloggen")
    
    token = authorization.replace("Bearer ", "")
    user = await db.users.find_one({"token": token}, {"_id": 0})
    if not user:
        session = await db.sessions.find_one({"token": token}, {"_id": 0})
        if session:
            user = await db.users.find_one({"id": session["user_id"]}, {"_id": 0})
    
    if not user:
        raise HTTPException(status_code=401, detail="Ungültiger Token")
    
    user_id = user["id"]
    amount = data.amount
    
    # Validate amount
    if amount < 5 or amount > 500:
        raise HTTPException(status_code=400, detail="Betrag muss zwischen €5 und €500 liegen")
    
    # Check balance if paying with balance
    if data.payment_method == "balance":
        balance = user.get("bidblitz_balance", 0)
        if balance < amount:
            raise HTTPException(status_code=400, detail="Nicht genug Guthaben")
        
        # Deduct from balance
        await db.users.update_one(
            {"id": user_id},
            {"$inc": {"bidblitz_balance": -amount}}
        )
    
    # Generate gift card
    now = datetime.now(timezone.utc)
    code = generate_gift_code()
    
    # Ensure unique code
    while await db.gift_cards.find_one({"code": code}):
        code = generate_gift_code()
    
    # Generate QR code
    qr_data = f"https://bidblitz.ae/redeem?code={code}"
    qr_code_base64 = generate_qr_code(qr_data)
    
    gift_card = {
        "id": str(uuid.uuid4()),
        "code": code,
        "amount": amount,
        "type": data.type,
        "status": "active",
        "created_by": user_id,
        "created_by_name": user.get("name", ""),
        "recipient_email": data.recipient_email,
        "recipient_name": data.recipient_name,
        "message": data.message,
        "qr_code": qr_code_base64,
        "expires_at": (now + timedelta(days=365)).isoformat(),
        "created_at": now.isoformat()
    }
    
    await db.gift_cards.insert_one(gift_card)
    
    # Create transaction
    await db.transactions.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "type": "gift_card_purchase",
        "amount": -amount,
        "gift_card_code": code,
        "description": f"Gift Card gekauft: €{amount:.2f}",
        "created_at": now.isoformat()
    })
    
    # TODO: Send email to recipient if provided
    
    return {
        "success": True,
        "message": f"Gift Card über €{amount:.2f} wurde erstellt!",
        "gift_card": {
            "code": code,
            "amount": amount,
            "type": data.type,
            "qr_code": qr_code_base64,
            "expires_at": gift_card["expires_at"]
        }
    }

@router.get("/my-cards")
async def get_my_gift_cards(authorization: str = None):
    """Eigene Gift Cards (gekauft und erhalten)"""
    if not authorization:
        raise HTTPException(status_code=401, detail="Bitte einloggen")
    
    token = authorization.replace("Bearer ", "")
    user = await db.users.find_one({"token": token}, {"_id": 0})
    if not user:
        session = await db.sessions.find_one({"token": token}, {"_id": 0})
        if session:
            user = await db.users.find_one({"id": session["user_id"]}, {"_id": 0})
    
    if not user:
        raise HTTPException(status_code=401, detail="Ungültiger Token")
    
    user_id = user["id"]
    
    # Get purchased cards
    purchased = await db.gift_cards.find(
        {"created_by": user_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    
    # Get redeemed cards
    redeemed = await db.gift_cards.find(
        {"redeemed_by": user_id},
        {"_id": 0}
    ).sort("redeemed_at", -1).to_list(50)
    
    return {
        "purchased": purchased,
        "redeemed": redeemed
    }

# ==================== ADMIN ENDPOINTS ====================

@router.post("/admin/create")
async def admin_create_gift_cards(data: GiftCardCreate, authorization: str = None):
    """Admin: Gift Cards erstellen"""
    admin = await get_admin_user(authorization)
    
    if data.amount < 1 or data.amount > 10000:
        raise HTTPException(status_code=400, detail="Betrag muss zwischen €1 und €10.000 liegen")
    
    if data.quantity < 1 or data.quantity > 100:
        raise HTTPException(status_code=400, detail="Anzahl muss zwischen 1 und 100 liegen")
    
    now = datetime.now(timezone.utc)
    expires_at = (now + timedelta(days=data.expires_in_days)).isoformat()
    
    created_cards = []
    
    for _ in range(data.quantity):
        code = generate_gift_code()
        
        # Ensure unique
        while await db.gift_cards.find_one({"code": code}):
            code = generate_gift_code()
        
        # Generate QR
        qr_data = f"https://bidblitz.ae/redeem?code={code}"
        qr_code_base64 = generate_qr_code(qr_data)
        
        gift_card = {
            "id": str(uuid.uuid4()),
            "code": code,
            "amount": data.amount,
            "type": data.type,
            "status": "active",
            "created_by": admin["id"],
            "created_by_name": admin.get("name", "Admin"),
            "created_by_role": "admin",
            "recipient_email": data.recipient_email,
            "recipient_name": data.recipient_name,
            "sender_name": data.sender_name or "BidBlitz",
            "message": data.message,
            "description": data.description,
            "qr_code": qr_code_base64,
            "expires_at": expires_at,
            "created_at": now.isoformat()
        }
        
        await db.gift_cards.insert_one(gift_card)
        created_cards.append({
            "code": code,
            "amount": data.amount,
            "qr_code": qr_code_base64
        })
    
    return {
        "success": True,
        "message": f"{data.quantity} Gift Card(s) über €{data.amount:.2f} erstellt",
        "cards": created_cards
    }

@router.get("/admin/list")
async def admin_list_gift_cards(
    status: Optional[str] = None,
    limit: int = 50,
    skip: int = 0,
    authorization: str = None
):
    """Admin: Alle Gift Cards auflisten"""
    await get_admin_user(authorization)
    
    query = {}
    if status:
        query["status"] = status
    
    cards = await db.gift_cards.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.gift_cards.count_documents(query)
    
    # Stats
    stats = {
        "total": await db.gift_cards.count_documents({}),
        "active": await db.gift_cards.count_documents({"status": "active"}),
        "redeemed": await db.gift_cards.count_documents({"status": "redeemed"}),
        "expired": await db.gift_cards.count_documents({"status": "expired"}),
        "total_value_active": 0,
        "total_value_redeemed": 0
    }
    
    # Calculate values
    active_cards = await db.gift_cards.find({"status": "active"}, {"amount": 1}).to_list(1000)
    stats["total_value_active"] = sum(c.get("amount", 0) for c in active_cards)
    
    redeemed_cards = await db.gift_cards.find({"status": "redeemed"}, {"amount": 1}).to_list(1000)
    stats["total_value_redeemed"] = sum(c.get("amount", 0) for c in redeemed_cards)
    
    return {
        "cards": cards,
        "total": total,
        "stats": stats
    }

@router.delete("/admin/{card_id}")
async def admin_delete_gift_card(card_id: str, authorization: str = None):
    """Admin: Gift Card deaktivieren"""
    await get_admin_user(authorization)
    
    card = await db.gift_cards.find_one({"id": card_id}, {"_id": 0})
    if not card:
        raise HTTPException(status_code=404, detail="Gift Card nicht gefunden")
    
    if card["status"] == "redeemed":
        raise HTTPException(status_code=400, detail="Eingelöste Gift Cards können nicht deaktiviert werden")
    
    await db.gift_cards.update_one(
        {"id": card_id},
        {"$set": {"status": "deactivated", "deactivated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"success": True, "message": "Gift Card deaktiviert"}

# ==================== PARTNER ENDPOINTS ====================

@router.post("/partner/sell")
async def partner_sell_gift_card(data: GiftCardCreate, authorization: str = None):
    """Partner/Händler: Gift Card verkaufen (physisch)"""
    if not authorization:
        raise HTTPException(status_code=401, detail="Bitte einloggen")
    
    token = authorization.replace("Bearer ", "")
    
    # Check if partner
    partner = await db.enterprise_partners.find_one({"api_key": token}, {"_id": 0})
    if not partner:
        # Try staff login
        staff = await db.staff_accounts.find_one({"token": token}, {"_id": 0})
        if staff:
            partner = await db.enterprise_partners.find_one({"id": staff["partner_id"]}, {"_id": 0})
    
    if not partner:
        raise HTTPException(status_code=403, detail="Partner-Berechtigung erforderlich")
    
    if data.amount < 5 or data.amount > 500:
        raise HTTPException(status_code=400, detail="Betrag muss zwischen €5 und €500 liegen")
    
    now = datetime.now(timezone.utc)
    code = generate_gift_code("BP")  # BP = BidBlitz Partner
    
    while await db.gift_cards.find_one({"code": code}):
        code = generate_gift_code("BP")
    
    qr_data = f"https://bidblitz.ae/redeem?code={code}"
    qr_code_base64 = generate_qr_code(qr_data)
    
    gift_card = {
        "id": str(uuid.uuid4()),
        "code": code,
        "amount": data.amount,
        "type": "physical",
        "status": "active",
        "sold_by_partner_id": partner["id"],
        "sold_by_partner_name": partner.get("name", ""),
        "created_by_role": "partner",
        "qr_code": qr_code_base64,
        "expires_at": (now + timedelta(days=365)).isoformat(),
        "created_at": now.isoformat()
    }
    
    await db.gift_cards.insert_one(gift_card)
    
    # Track partner sale
    await db.partner_gift_card_sales.insert_one({
        "id": str(uuid.uuid4()),
        "partner_id": partner["id"],
        "gift_card_id": gift_card["id"],
        "gift_card_code": code,
        "amount": data.amount,
        "commission": data.amount * 0.05,  # 5% Provision
        "created_at": now.isoformat()
    })
    
    return {
        "success": True,
        "message": f"Gift Card über €{data.amount:.2f} erstellt",
        "gift_card": {
            "code": code,
            "amount": data.amount,
            "qr_code": qr_code_base64,
            "expires_at": gift_card["expires_at"]
        }
    }

# ==================== CHECKOUT INTEGRATION ====================

@router.post("/apply-to-checkout")
async def apply_gift_card_to_checkout(code: str, checkout_id: str, authorization: str = None):
    """Gift Card bei Checkout anwenden"""
    if not authorization:
        raise HTTPException(status_code=401, detail="Bitte einloggen")
    
    token = authorization.replace("Bearer ", "")
    user = await db.users.find_one({"token": token}, {"_id": 0})
    if not user:
        session = await db.sessions.find_one({"token": token}, {"_id": 0})
        if session:
            user = await db.users.find_one({"id": session["user_id"]}, {"_id": 0})
    
    if not user:
        raise HTTPException(status_code=401, detail="Ungültiger Token")
    
    code = code.upper().strip()
    
    # Find gift card
    gift_card = await db.gift_cards.find_one({"code": code}, {"_id": 0})
    
    if not gift_card:
        raise HTTPException(status_code=404, detail="Gift Card nicht gefunden")
    
    if gift_card["status"] != "active":
        raise HTTPException(status_code=400, detail=f"Gift Card ist {gift_card['status']}")
    
    # Check expiry
    expires_at = datetime.fromisoformat(gift_card["expires_at"].replace("Z", "+00:00"))
    if datetime.now(timezone.utc) > expires_at:
        raise HTTPException(status_code=400, detail="Gift Card ist abgelaufen")
    
    # Get checkout
    checkout = await db.checkouts.find_one({"id": checkout_id}, {"_id": 0})
    if not checkout:
        raise HTTPException(status_code=404, detail="Checkout nicht gefunden")
    
    if checkout.get("user_id") != user["id"]:
        raise HTTPException(status_code=403, detail="Nicht autorisiert")
    
    # Apply gift card
    original_total = checkout.get("total", 0)
    gift_card_amount = min(gift_card["amount"], original_total)  # Can't exceed total
    new_total = max(0, original_total - gift_card_amount)
    
    await db.checkouts.update_one(
        {"id": checkout_id},
        {
            "$set": {
                "gift_card_code": code,
                "gift_card_amount": gift_card_amount,
                "gift_card_id": gift_card["id"],
                "total_after_gift_card": new_total,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    return {
        "success": True,
        "message": f"Gift Card angewendet: -€{gift_card_amount:.2f}",
        "gift_card_amount": gift_card_amount,
        "original_total": original_total,
        "new_total": new_total,
        "remaining_on_card": gift_card["amount"] - gift_card_amount
    }

# ==================== FIXED AMOUNTS ====================

@router.get("/fixed-amounts")
async def get_fixed_amounts():
    """Verfügbare feste Gift Card Beträge"""
    return {
        "amounts": [10, 25, 50, 100, 150, 200, 250, 500],
        "min_custom": 5,
        "max_custom": 500,
        "currency": "EUR"
    }
