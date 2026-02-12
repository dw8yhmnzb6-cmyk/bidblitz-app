"""Vouchers router - Voucher management with bulk creation and euro values"""
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from datetime import datetime, timezone, timedelta
from typing import List, Optional
from pydantic import BaseModel
import uuid
import random
import string
import base64
import os

from config import db, logger
from dependencies import get_admin_user, get_current_user

router = APIRouter(tags=["Vouchers"])

# ==================== SCHEMAS ====================

class VoucherCreate(BaseModel):
    code: Optional[str] = None  # Auto-generate if empty
    type: str = "bids"  # bids, discount, euro, restaurant
    value: int = 10
    max_uses: int = 1
    expires_days: Optional[int] = 30
    # Restaurant/Partner Voucher fields
    merchant_name: Optional[str] = None  # e.g., "Pizza Roma"
    merchant_url: Optional[str] = None   # e.g., "https://pizzaroma.de"
    merchant_logo: Optional[str] = None  # Logo URL
    merchant_address: Optional[str] = None  # Address
    merchant_category: str = "restaurant"  # restaurant, shop, service, etc.
    description: Optional[str] = None  # Beschreibung des Gutscheins

class BulkVoucherCreate(BaseModel):
    count: int = 10  # How many vouchers to create
    type: str = "bids"  # bids, discount, euro, restaurant
    value: int = 10
    max_uses: int = 1
    expires_days: Optional[int] = 30
    prefix: str = ""  # Optional prefix like "NEUJAHR"
    # Restaurant/Partner fields for bulk
    merchant_name: Optional[str] = None
    merchant_url: Optional[str] = None
    merchant_logo: Optional[str] = None
    merchant_address: Optional[str] = None
    merchant_category: str = "restaurant"
    description: Optional[str] = None

class RestaurantVoucherCreate(BaseModel):
    """Spezielles Schema für Restaurant-Gutscheine"""
    restaurant_name: str
    restaurant_url: Optional[str] = None
    restaurant_logo: Optional[str] = None
    restaurant_address: Optional[str] = None
    voucher_value: int = 25  # Wert in Euro
    discount_percent: Optional[int] = None  # z.B. 20% Rabatt
    description: str = "Genießen Sie ein leckeres Essen"
    valid_days: int = 90
    quantity: int = 1  # Wie viele Gutscheine erstellen

class VoucherRedeemRequest(BaseModel):
    code: str

# ==================== HELPER FUNCTIONS ====================

def generate_voucher_code(prefix: str = "", length: int = 8) -> str:
    """Generate a random voucher code"""
    chars = string.ascii_uppercase + string.digits
    random_part = ''.join(random.choices(chars, k=length))
    if prefix:
        return f"{prefix.upper()}-{random_part}"
    return random_part

# Euro to Bids conversion rate (configurable)
EURO_TO_BIDS_RATE = 5  # 1€ = 5 bids

def euro_to_bids(euro: int) -> int:
    """Convert euro value to bids"""
    return euro * EURO_TO_BIDS_RATE

# ==================== ADMIN ENDPOINTS ====================

@router.post("/admin/vouchers")
async def create_voucher(voucher: VoucherCreate, admin: dict = Depends(get_admin_user)):
    """Create a new voucher (admin only)"""
    # Generate code if not provided
    code = voucher.code.upper() if voucher.code else generate_voucher_code()
    
    # Check if code already exists
    existing = await db.vouchers.find_one({"code": code})
    if existing:
        raise HTTPException(status_code=400, detail="Gutscheincode existiert bereits")
    
    # Calculate bids based on type
    if voucher.type == "euro":
        bids_value = euro_to_bids(voucher.value)
    elif voucher.type == "bids":
        bids_value = voucher.value
    else:
        bids_value = 0  # For discount type
    
    # Calculate expiry date
    expires_at = None
    if voucher.expires_days:
        expires_at = (datetime.now(timezone.utc) + timedelta(days=voucher.expires_days)).isoformat()
    
    voucher_id = str(uuid.uuid4())
    doc = {
        "id": voucher_id,
        "code": code,
        "type": voucher.type,
        "value": voucher.value,
        "bids": bids_value,
        "max_uses": voucher.max_uses,
        "used_count": 0,
        "used_by": [],
        "is_active": True,
        "expires_at": expires_at,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": admin.get("email", "admin"),
        # Restaurant/Partner fields
        "merchant_name": voucher.merchant_name,
        "merchant_url": voucher.merchant_url,
        "merchant_logo": voucher.merchant_logo,
        "merchant_address": voucher.merchant_address,
        "merchant_category": voucher.merchant_category,
        "description": voucher.description
    }
    await db.vouchers.insert_one(doc)
    
    logger.info(f"Voucher {code} created: {voucher.type} = {voucher.value}")
    
    # Return without _id
    doc.pop("_id", None)
    return doc


@router.post("/admin/vouchers/restaurant")
async def create_restaurant_voucher(data: RestaurantVoucherCreate, admin: dict = Depends(get_admin_user)):
    """Erstelle Restaurant-Gutscheine mit Link zum Restaurant"""
    created_vouchers = []
    
    for i in range(data.quantity):
        # Generiere einzigartigen Code mit Restaurant-Prefix
        prefix = data.restaurant_name[:4].upper().replace(" ", "")
        code = generate_voucher_code(prefix=prefix, length=6)
        
        # Prüfe ob Code existiert
        while await db.vouchers.find_one({"code": code}):
            code = generate_voucher_code(prefix=prefix, length=6)
        
        # Ablaufdatum berechnen
        expires_at = (datetime.now(timezone.utc) + timedelta(days=data.valid_days)).isoformat()
        
        voucher_id = str(uuid.uuid4())
        doc = {
            "id": voucher_id,
            "code": code,
            "type": "restaurant",
            "value": data.voucher_value,
            "discount_percent": data.discount_percent,
            "bids": 0,  # Restaurant-Gutscheine geben keine Gebote
            "max_uses": 1,
            "used_count": 0,
            "used_by": [],
            "is_active": True,
            "expires_at": expires_at,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "created_by": admin.get("email", "admin"),
            # Restaurant-spezifische Felder
            "merchant_name": data.restaurant_name,
            "merchant_url": data.restaurant_url,
            "merchant_logo": data.restaurant_logo,
            "merchant_address": data.restaurant_address,
            "merchant_category": "restaurant",
            "description": data.description
        }
        await db.vouchers.insert_one(doc)
        doc.pop("_id", None)
        created_vouchers.append(doc)
    
    logger.info(f"🍽️ {len(created_vouchers)} Restaurant-Gutscheine für '{data.restaurant_name}' erstellt")
    
    return {
        "message": f"{len(created_vouchers)} Restaurant-Gutscheine erstellt",
        "restaurant": data.restaurant_name,
        "vouchers": created_vouchers
    }


@router.get("/admin/vouchers/restaurants")
async def get_restaurant_vouchers(admin: dict = Depends(get_admin_user)):
    """Alle Restaurant-Gutscheine abrufen"""
    vouchers = await db.vouchers.find(
        {"type": "restaurant"},
        {"_id": 0}
    ).sort("created_at", -1).to_list(500)
    
    return vouchers


@router.post("/admin/vouchers/bulk")
async def create_bulk_vouchers(bulk: BulkVoucherCreate, admin: dict = Depends(get_admin_user)):
    """Create multiple vouchers at once (admin only)"""
    if bulk.count < 1 or bulk.count > 100:
        raise HTTPException(status_code=400, detail="Anzahl muss zwischen 1 und 100 sein")
    
    # Calculate bids based on type
    if bulk.type == "euro":
        bids_value = euro_to_bids(bulk.value)
    elif bulk.type == "bids":
        bids_value = bulk.value
    else:
        bids_value = 0  # For discount type
    
    # Calculate expiry date
    expires_at = None
    if bulk.expires_days:
        expires_at = (datetime.now(timezone.utc) + timedelta(days=bulk.expires_days)).isoformat()
    
    created_vouchers = []
    created_codes = []
    
    for _ in range(bulk.count):
        # Generate unique code
        attempts = 0
        while attempts < 10:
            code = generate_voucher_code(bulk.prefix)
            existing = await db.vouchers.find_one({"code": code})
            if not existing and code not in created_codes:
                break
            attempts += 1
        
        if attempts >= 10:
            continue  # Skip if can't generate unique code
        
        voucher_id = str(uuid.uuid4())
        doc = {
            "id": voucher_id,
            "code": code,
            "type": bulk.type,
            "value": bulk.value,
            "bids": bids_value,
            "max_uses": bulk.max_uses,
            "used_count": 0,
            "used_by": [],
            "is_active": True,
            "expires_at": expires_at,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "created_by": admin.get("email", "admin")
        }
        
        await db.vouchers.insert_one(doc)
        created_codes.append(code)
        doc.pop("_id", None)
        created_vouchers.append(doc)
    
    logger.info(f"Bulk vouchers created: {len(created_vouchers)} x {bulk.type}={bulk.value}")
    
    return {
        "message": f"{len(created_vouchers)} Gutscheine erstellt!",
        "count": len(created_vouchers),
        "vouchers": created_vouchers,
        "codes": created_codes
    }


@router.get("/admin/vouchers")
async def get_vouchers(admin: dict = Depends(get_admin_user)):
    """Get all vouchers (admin only)"""
    vouchers = await db.vouchers.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return vouchers


@router.put("/admin/vouchers/{voucher_id}/toggle")
async def toggle_voucher(voucher_id: str, admin: dict = Depends(get_admin_user)):
    """Toggle voucher active status (admin only)"""
    voucher = await db.vouchers.find_one({"id": voucher_id})
    if not voucher:
        raise HTTPException(status_code=404, detail="Gutschein nicht gefunden")
    
    new_status = not voucher.get("is_active", True)
    await db.vouchers.update_one(
        {"id": voucher_id},
        {"$set": {"is_active": new_status}}
    )
    
    return {"message": "Status geändert", "is_active": new_status}


@router.delete("/admin/vouchers/{voucher_id}")
async def delete_voucher(voucher_id: str, admin: dict = Depends(get_admin_user)):
    """Delete a voucher (admin only)"""
    result = await db.vouchers.delete_one({"id": voucher_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Gutschein nicht gefunden")
    return {"message": "Gutschein gelöscht"}


@router.delete("/admin/vouchers/bulk/unused")
async def delete_unused_vouchers(admin: dict = Depends(get_admin_user)):
    """Delete all unused vouchers (admin only)"""
    result = await db.vouchers.delete_many({"used_count": 0})
    return {"message": f"{result.deleted_count} unbenutzte Gutscheine gelöscht"}


# ==================== USER ENDPOINTS ====================

@router.post("/vouchers/redeem")
async def redeem_voucher(request: VoucherRedeemRequest, user: dict = Depends(get_current_user)):
    """Redeem a voucher code"""
    code = request.code.upper().strip()
    voucher = await db.vouchers.find_one({"code": code}, {"_id": 0})
    
    if not voucher:
        raise HTTPException(status_code=404, detail="Ungültiger Gutscheincode")
    
    # Check if active
    if not voucher.get("is_active", True):
        raise HTTPException(status_code=400, detail="Gutschein ist deaktiviert")
    
    # Check if already used by this user
    if user["id"] in voucher.get("used_by", []):
        raise HTTPException(status_code=400, detail="Gutschein bereits eingelöst")
    
    # Check max uses
    if voucher.get("used_count", 0) >= voucher.get("max_uses", 1):
        raise HTTPException(status_code=400, detail="Gutschein ist ausgeschöpft")
    
    # Check expiry
    if voucher.get("expires_at"):
        try:
            expires = datetime.fromisoformat(voucher["expires_at"].replace("Z", "+00:00"))
            if datetime.now(timezone.utc) > expires:
                raise HTTPException(status_code=400, detail="Gutschein ist abgelaufen")
        except ValueError:
            pass
    
    # Process based on type
    voucher_type = voucher.get("type", "bids")
    value = voucher.get("value", 0)
    bids = voucher.get("bids", value)
    
    result_message = ""
    
    if voucher_type == "bids" or voucher_type == "euro":
        # Credit bids
        await db.users.update_one(
            {"id": user["id"]},
            {"$inc": {"bids_balance": bids}}
        )
        if voucher_type == "euro":
            result_message = f"€{value} Gutschein eingelöst! {bids} Gebote gutgeschrieben!"
        else:
            result_message = f"{bids} Gebote gutgeschrieben!"
    
    elif voucher_type == "discount":
        # Store discount for next purchase
        discount_code = f"VDISC{user['id'][:8].upper()}{random.randint(100, 999)}"
        await db.discount_codes.insert_one({
            "code": discount_code,
            "user_id": user["id"],
            "discount_percent": value,
            "valid_until": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
            "used": False,
            "from_voucher": voucher["code"],
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        result_message = f"{value}% Rabatt aktiviert! Code: {discount_code}"
    
    # Update voucher usage
    await db.vouchers.update_one(
        {"id": voucher["id"]},
        {
            "$inc": {"used_count": 1},
            "$push": {"used_by": user["id"]}
        }
    )
    
    logger.info(f"User {user['email']} redeemed voucher {code} ({voucher_type}={value})")
    
    return {
        "message": result_message,
        "type": voucher_type,
        "value": value,
        "bids_added": bids if voucher_type in ["bids", "euro"] else 0
    }


# ==================== PUBLIC RESTAURANT VOUCHERS ====================

@router.get("/vouchers/restaurants")
async def get_public_restaurant_vouchers():
    """Öffentliche Liste aller verfügbaren Restaurant-Gutscheine"""
    vouchers = await db.vouchers.find(
        {
            "type": "restaurant",
            "is_active": True,
            "used_count": {"$lt": 1}  # Nur ungenutzte
        },
        {"_id": 0, "used_by": 0, "created_by": 0}
    ).sort("created_at", -1).to_list(100)
    
    # Gruppiere nach Restaurant für bessere Anzeige
    restaurants = {}
    for v in vouchers:
        name = v.get("merchant_name", "Unbekannt")
        if name not in restaurants:
            restaurants[name] = {
                "name": name,
                "url": v.get("merchant_url"),
                "logo": v.get("merchant_logo"),
                "address": v.get("merchant_address"),
                "vouchers": []
            }
        restaurants[name]["vouchers"].append({
            "id": v.get("id"),
            "code": v.get("code"),
            "value": v.get("value"),
            "discount_percent": v.get("discount_percent"),
            "description": v.get("description"),
            "expires_at": v.get("expires_at")
        })
    
    return {
        "restaurants": list(restaurants.values()),
        "total_vouchers": len(vouchers)
    }


@router.get("/vouchers/restaurant/{restaurant_name}")
async def get_restaurant_voucher_details(restaurant_name: str):
    """Details zu einem bestimmten Restaurant und seinen Gutscheinen"""
    vouchers = await db.vouchers.find(
        {
            "type": "restaurant",
            "merchant_name": {"$regex": restaurant_name, "$options": "i"},
            "is_active": True
        },
        {"_id": 0, "used_by": 0, "created_by": 0}
    ).to_list(50)
    
    if not vouchers:
        raise HTTPException(status_code=404, detail="Restaurant nicht gefunden")
    
    # Nehme Restaurant-Info vom ersten Gutschein
    first = vouchers[0]
    return {
        "restaurant": {
            "name": first.get("merchant_name"),
            "url": first.get("merchant_url"),
            "logo": first.get("merchant_logo"),
            "address": first.get("merchant_address")
        },
        "vouchers": [{
            "id": v.get("id"),
            "code": v.get("code"),
            "value": v.get("value"),
            "discount_percent": v.get("discount_percent"),
            "description": v.get("description"),
            "expires_at": v.get("expires_at"),
            "is_available": v.get("used_count", 0) < v.get("max_uses", 1)
        } for v in vouchers]
    }


# ==================== RESTAURANT PARTNER APPLICATIONS ====================

class RestaurantPartnerApplication(BaseModel):
    """Schema für Restaurant-Partner Bewerbung"""
    restaurant_name: str
    contact_name: str
    email: str
    phone: Optional[str] = None
    website: Optional[str] = None
    address: str
    city: str
    description: str  # Was macht das Restaurant besonders?
    voucher_type: str = "discount"  # discount oder euro
    voucher_value: int = 10  # Prozent oder Euro-Wert
    message: Optional[str] = None  # Zusätzliche Nachricht


@router.post("/vouchers/restaurant-partner/apply")
async def apply_as_restaurant_partner(application: RestaurantPartnerApplication):
    """Öffentlicher Endpoint für Restaurant-Partner Bewerbungen"""
    
    # Prüfe ob bereits eine Bewerbung mit dieser E-Mail existiert
    existing = await db.restaurant_applications.find_one({
        "email": application.email.lower(),
        "status": {"$in": ["pending", "approved"]}
    })
    
    if existing:
        raise HTTPException(
            status_code=400, 
            detail="Eine Bewerbung mit dieser E-Mail-Adresse existiert bereits"
        )
    
    application_id = str(uuid.uuid4())
    doc = {
        "id": application_id,
        "restaurant_name": application.restaurant_name,
        "contact_name": application.contact_name,
        "email": application.email.lower(),
        "phone": application.phone,
        "website": application.website,
        "address": application.address,
        "city": application.city,
        "description": application.description,
        "voucher_type": application.voucher_type,
        "voucher_value": application.voucher_value,
        "message": application.message,
        "status": "pending",  # pending, approved, rejected
        "created_at": datetime.now(timezone.utc).isoformat(),
        "reviewed_at": None,
        "reviewed_by": None,
        "admin_notes": None
    }
    
    await db.restaurant_applications.insert_one(doc)
    doc.pop("_id", None)
    
    logger.info(f"🍽️ Neue Restaurant-Partner Bewerbung: {application.restaurant_name} ({application.email})")
    
    return {
        "success": True,
        "message": "Ihre Bewerbung wurde erfolgreich eingereicht! Wir melden uns in Kürze bei Ihnen.",
        "application_id": application_id
    }


@router.get("/admin/restaurant-applications")
async def get_restaurant_applications(
    status: Optional[str] = None,
    admin: dict = Depends(get_admin_user)
):
    """Alle Restaurant-Partner Bewerbungen abrufen (Admin)"""
    query = {}
    if status:
        query["status"] = status
    
    applications = await db.restaurant_applications.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).to_list(200)
    
    # Statistiken
    stats = {
        "total": await db.restaurant_applications.count_documents({}),
        "pending": await db.restaurant_applications.count_documents({"status": "pending"}),
        "approved": await db.restaurant_applications.count_documents({"status": "approved"}),
        "rejected": await db.restaurant_applications.count_documents({"status": "rejected"})
    }
    
    return {
        "applications": applications,
        "stats": stats
    }


@router.put("/admin/restaurant-applications/{application_id}/review")
async def review_restaurant_application(
    application_id: str,
    action: str,  # approve oder reject
    admin_notes: Optional[str] = None,
    admin: dict = Depends(get_admin_user)
):
    """Restaurant-Partner Bewerbung genehmigen oder ablehnen"""
    
    if action not in ["approve", "reject"]:
        raise HTTPException(status_code=400, detail="Aktion muss 'approve' oder 'reject' sein")
    
    application = await db.restaurant_applications.find_one({"id": application_id})
    if not application:
        raise HTTPException(status_code=404, detail="Bewerbung nicht gefunden")
    
    new_status = "approved" if action == "approve" else "rejected"
    
    await db.restaurant_applications.update_one(
        {"id": application_id},
        {
            "$set": {
                "status": new_status,
                "reviewed_at": datetime.now(timezone.utc).isoformat(),
                "reviewed_by": admin.get("email", "admin"),
                "admin_notes": admin_notes
            }
        }
    )
    
    # Wenn genehmigt, automatisch Gutscheine erstellen
    if action == "approve":
        # Erstelle 5 Gutscheine für den neuen Partner
        prefix = application["restaurant_name"][:4].upper().replace(" ", "")
        for i in range(5):
            code = generate_voucher_code(prefix=prefix, length=6)
            while await db.vouchers.find_one({"code": code}):
                code = generate_voucher_code(prefix=prefix, length=6)
            
            voucher_doc = {
                "id": str(uuid.uuid4()),
                "code": code,
                "type": "restaurant",
                "value": application["voucher_value"] if application["voucher_type"] == "euro" else 0,
                "discount_percent": application["voucher_value"] if application["voucher_type"] == "discount" else None,
                "bids": 0,
                "max_uses": 1,
                "used_count": 0,
                "used_by": [],
                "is_active": True,
                "expires_at": (datetime.now(timezone.utc) + timedelta(days=90)).isoformat(),
                "created_at": datetime.now(timezone.utc).isoformat(),
                "created_by": "system",
                "merchant_name": application["restaurant_name"],
                "merchant_url": application.get("website"),
                "merchant_address": f"{application['address']}, {application['city']}",
                "merchant_category": "restaurant",
                "description": application.get("description", "Genießen Sie ein leckeres Essen")
            }
            await db.vouchers.insert_one(voucher_doc)
        
        logger.info(f"✅ Restaurant-Partner '{application['restaurant_name']}' genehmigt - 5 Gutscheine erstellt")
    
    return {
        "success": True,
        "message": f"Bewerbung wurde {'genehmigt' if action == 'approve' else 'abgelehnt'}",
        "status": new_status
    }


@router.delete("/admin/restaurant-applications/{application_id}")
async def delete_restaurant_application(
    application_id: str,
    admin: dict = Depends(get_admin_user)
):
    """Restaurant-Partner Bewerbung löschen"""
    result = await db.restaurant_applications.delete_one({"id": application_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Bewerbung nicht gefunden")
    return {"message": "Bewerbung gelöscht"}


# ==================== RESTAURANT VOUCHER AUCTIONS ====================

class CreateRestaurantAuctionRequest(BaseModel):
    """Schema für Restaurant-Gutschein-Auktion"""
    restaurant_name: str
    restaurant_url: Optional[str] = None
    restaurant_logo: Optional[str] = None
    restaurant_address: str
    restaurant_images: Optional[list] = []  # Liste von Restaurant-Fotos
    voucher_value: int = 25  # Euro-Wert des Gutscheins (NUR Euro, keine Prozente)
    description: str = "Genießen Sie ein leckeres Essen!"
    duration_hours: int = 24
    start_price: float = 0.01
    bot_target_price: Optional[float] = None  # Min-Preis für Bots


@router.post("/admin/restaurant-auctions/create")
async def create_restaurant_voucher_auction(
    data: CreateRestaurantAuctionRequest,
    admin: dict = Depends(get_admin_user)
):
    """Erstellt eine Auktion für einen Restaurant-Gutschein (Admin) - NUR Euro-Wert"""
    
    now = datetime.now(timezone.utc)
    end_time = now + timedelta(hours=data.duration_hours)
    auction_id = str(uuid.uuid4())
    
    # Titel erstellen - NUR Euro-Wert
    title = f"🍽️ {data.voucher_value}€ Gutschein bei {data.restaurant_name}"
    display_value = f"{data.voucher_value}€"
    
    # Gutschein-Code generieren
    prefix = data.restaurant_name[:4].upper().replace(" ", "")
    voucher_code = generate_voucher_code(prefix=prefix, length=6)
    while await db.vouchers.find_one({"code": voucher_code}):
        voucher_code = generate_voucher_code(prefix=prefix, length=6)
    
    # Standard-Bild falls keine Bilder
    images = data.restaurant_images if data.restaurant_images else []
    main_image = images[0] if images else "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=400"
    
    # Erstelle den Gutschein in der DB
    voucher_doc = {
        "id": str(uuid.uuid4()),
        "code": voucher_code,
        "type": "restaurant_auction",
        "value": data.voucher_value,
        "discount_percent": None,  # Keine Prozente mehr
        "bids": 0,
        "max_uses": 1,
        "used_count": 0,
        "used_by": [],
        "is_active": False,  # Wird erst aktiv, wenn Auktion gewonnen
        "auction_id": auction_id,
        "expires_at": (now + timedelta(days=90)).isoformat(),
        "created_at": now.isoformat(),
        "created_by": admin.get("email", "admin"),
        "merchant_name": data.restaurant_name,
        "merchant_url": data.restaurant_url,
        "merchant_address": data.restaurant_address,
        "merchant_logo": data.restaurant_logo,
        "merchant_images": images,
        "description": data.description
    }
    await db.vouchers.insert_one(voucher_doc)
    
    # Erstelle die Auktion
    auction_doc = {
        "id": auction_id,
        "title": title,
        "product_id": voucher_doc["id"],
        "product": {
            "id": voucher_doc["id"],
            "name": title,
            "description": data.description,
            "retail_price": data.voucher_value,
            "category": "restaurant_voucher",
            "image_url": main_image,
            "images": images,  # Alle Restaurant-Fotos
            "specifications": {
                "restaurant": data.restaurant_name,
                "address": data.restaurant_address,
                "website": data.restaurant_url,
                "value": display_value,
                "voucher_code": voucher_code
            }
        },
        "category": "restaurant_voucher",
        "auction_type": "restaurant_voucher",
        "status": "active",
        "start_time": now.isoformat(),
        "end_time": end_time.isoformat(),
        "current_price": data.start_price,
        "bid_increment": 0.01,
        "total_bids": 0,
        "bid_count": 0,
        "last_bidder": None,
        "last_bidder_id": None,
        "winner_id": None,
        "winner_name": None,
        "bid_history": [],
        "created_at": now.isoformat(),
        "created_by": admin.get("email", "admin"),
        "bot_target_price": data.bot_target_price or (data.voucher_value * 0.3),
        "voucher_code": voucher_code,
        "restaurant_info": {
            "name": data.restaurant_name,
            "address": data.restaurant_address,
            "url": data.restaurant_url,
            "logo": data.restaurant_logo,
            "images": images
        },
        "auto_restart": True  # Kann neu gestartet werden
    }
    
    await db.auctions.insert_one(auction_doc)
    auction_doc.pop("_id", None)
    
    logger.info(f"🍽️ Restaurant-Gutschein-Auktion erstellt: {title} (Code: {voucher_code})")
    
    return {
        "success": True,
        "auction": auction_doc,
        "voucher_code": voucher_code,
        "message": f"Restaurant-Gutschein-Auktion für {data.restaurant_name} erstellt!"
    }


@router.get("/admin/restaurant-auctions")
async def get_restaurant_auctions(
    status: Optional[str] = None,
    admin: dict = Depends(get_admin_user)
):
    """Alle Restaurant-Gutschein-Auktionen abrufen (Admin)"""
    query = {"auction_type": "restaurant_voucher"}
    if status:
        query["status"] = status
    
    auctions = await db.auctions.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    
    stats = {
        "total": await db.auctions.count_documents({"auction_type": "restaurant_voucher"}),
        "active": await db.auctions.count_documents({"auction_type": "restaurant_voucher", "status": "active"}),
        "ended": await db.auctions.count_documents({"auction_type": "restaurant_voucher", "status": "ended"})
    }
    
    return {
        "auctions": auctions,
        "stats": stats
    }


@router.get("/restaurant-auctions/active")
async def get_active_restaurant_auctions():
    """Öffentlicher Endpoint: Alle aktiven Restaurant-Gutschein-Auktionen"""
    
    auctions = await db.auctions.find(
        {
            "auction_type": "restaurant_voucher",
            "status": "active"
        },
        {"_id": 0}
    ).sort("end_time", 1).to_list(50)
    
    return auctions



# ==================== BILD UPLOAD ====================

@router.post("/admin/upload-image")
async def upload_image(
    file: UploadFile = File(...),
    admin: dict = Depends(get_admin_user)
):
    """
    Lädt ein Bild hoch und gibt einen Base64-String oder URL zurück.
    Unterstützt: JPEG, PNG, WebP, GIF
    Max Größe: 5MB
    """
    # Prüfe Dateityp
    allowed_types = ["image/jpeg", "image/png", "image/webp", "image/gif"]
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=400, 
            detail=f"Ungültiger Dateityp. Erlaubt: {', '.join(allowed_types)}"
        )
    
    # Lese Datei
    contents = await file.read()
    
    # Prüfe Größe (max 5MB)
    max_size = 5 * 1024 * 1024  # 5MB
    if len(contents) > max_size:
        raise HTTPException(
            status_code=400,
            detail="Datei ist zu groß (max. 5MB)"
        )
    
    # Konvertiere zu Base64
    base64_image = base64.b64encode(contents).decode('utf-8')
    
    # Erstelle Data-URL
    data_url = f"data:{file.content_type};base64,{base64_image}"
    
    # Speichere in Datenbank für spätere Verwendung
    image_id = str(uuid.uuid4())
    image_doc = {
        "id": image_id,
        "filename": file.filename,
        "content_type": file.content_type,
        "size": len(contents),
        "data_url": data_url,
        "uploaded_by": admin.get("email", "admin"),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.uploaded_images.insert_one(image_doc)
    image_doc.pop("_id", None)
    
    logger.info(f"Image uploaded: {file.filename} ({len(contents)} bytes)")
    
    return {
        "success": True,
        "image_id": image_id,
        "image_url": data_url,
        "filename": file.filename,
        "size": len(contents),
        "message": "Bild erfolgreich hochgeladen!"
    }


@router.post("/admin/upload-images")
async def upload_multiple_images(
    files: List[UploadFile] = File(...),
    admin: dict = Depends(get_admin_user)
):
    """
    Lädt mehrere Bilder hoch (max. 5 gleichzeitig).
    """
    if len(files) > 5:
        raise HTTPException(status_code=400, detail="Maximal 5 Bilder gleichzeitig erlaubt")
    
    uploaded = []
    allowed_types = ["image/jpeg", "image/png", "image/webp", "image/gif"]
    max_size = 5 * 1024 * 1024
    
    for file in files:
        # Prüfe Dateityp
        if file.content_type not in allowed_types:
            continue
        
        # Lese Datei
        contents = await file.read()
        
        # Prüfe Größe
        if len(contents) > max_size:
            continue
        
        # Konvertiere zu Base64
        base64_image = base64.b64encode(contents).decode('utf-8')
        data_url = f"data:{file.content_type};base64,{base64_image}"
        
        # Speichere
        image_id = str(uuid.uuid4())
        image_doc = {
            "id": image_id,
            "filename": file.filename,
            "content_type": file.content_type,
            "size": len(contents),
            "data_url": data_url,
            "uploaded_by": admin.get("email", "admin"),
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.uploaded_images.insert_one(image_doc)
        
        uploaded.append({
            "image_id": image_id,
            "image_url": data_url,
            "filename": file.filename
        })
    
    logger.info(f"Multiple images uploaded: {len(uploaded)} files")
    
    return {
        "success": True,
        "count": len(uploaded),
        "images": uploaded,
        "message": f"{len(uploaded)} Bilder hochgeladen!"
    }


# ==================== RESTAURANT AUKTION BEARBEITEN ====================

class RestaurantAuctionUpdate(BaseModel):
    """Schema für Restaurant-Auktion Update"""
    restaurant_name: Optional[str] = None
    restaurant_url: Optional[str] = None
    restaurant_logo: Optional[str] = None
    restaurant_address: Optional[str] = None
    restaurant_images: Optional[List[str]] = None
    voucher_value: Optional[int] = None
    description: Optional[str] = None
    bot_target_price: Optional[float] = None


@router.put("/admin/restaurant-auctions/{auction_id}")
async def update_restaurant_auction(
    auction_id: str,
    data: RestaurantAuctionUpdate,
    admin: dict = Depends(get_admin_user)
):
    """Restaurant-Gutschein-Auktion bearbeiten (Admin)"""
    
    # Finde die Auktion
    auction = await db.auctions.find_one({"id": auction_id, "auction_type": "restaurant_voucher"})
    if not auction:
        raise HTTPException(status_code=404, detail="Restaurant-Auktion nicht gefunden")
    
    # Baue Update-Dict
    update_fields = {}
    
    if data.restaurant_name:
        update_fields["title"] = f"🍽️ {data.restaurant_name} - €{data.voucher_value or auction.get('restaurant_info', {}).get('voucher_value', 25)} Gutschein"
        if "restaurant_info" not in update_fields:
            update_fields["restaurant_info"] = auction.get("restaurant_info", {})
        update_fields["restaurant_info"]["name"] = data.restaurant_name
    
    if data.restaurant_url is not None:
        if "restaurant_info" not in update_fields:
            update_fields["restaurant_info"] = auction.get("restaurant_info", {})
        update_fields["restaurant_info"]["url"] = data.restaurant_url
    
    if data.restaurant_logo is not None:
        if "restaurant_info" not in update_fields:
            update_fields["restaurant_info"] = auction.get("restaurant_info", {})
        update_fields["restaurant_info"]["logo"] = data.restaurant_logo
    
    if data.restaurant_address is not None:
        if "restaurant_info" not in update_fields:
            update_fields["restaurant_info"] = auction.get("restaurant_info", {})
        update_fields["restaurant_info"]["address"] = data.restaurant_address
    
    if data.restaurant_images is not None:
        if "restaurant_info" not in update_fields:
            update_fields["restaurant_info"] = auction.get("restaurant_info", {})
        update_fields["restaurant_info"]["images"] = data.restaurant_images
        # Auch das Hauptbild aktualisieren, wenn Bilder vorhanden
        if data.restaurant_images:
            update_fields["image_url"] = data.restaurant_images[0]
    
    if data.voucher_value is not None:
        if "restaurant_info" not in update_fields:
            update_fields["restaurant_info"] = auction.get("restaurant_info", {})
        update_fields["restaurant_info"]["voucher_value"] = data.voucher_value
        # Auch Titel aktualisieren
        name = data.restaurant_name or auction.get("restaurant_info", {}).get("name", "Restaurant")
        update_fields["title"] = f"🍽️ {name} - €{data.voucher_value} Gutschein"
    
    if data.description is not None:
        update_fields["description"] = data.description
    
    if data.bot_target_price is not None:
        update_fields["bot_target_price"] = data.bot_target_price
    
    if not update_fields:
        return {"success": False, "message": "Keine Änderungen"}
    
    # Aktualisierung durchführen
    update_fields["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.auctions.update_one(
        {"id": auction_id},
        {"$set": update_fields}
    )
    
    # Aktualisierte Auktion zurückgeben
    updated = await db.auctions.find_one({"id": auction_id}, {"_id": 0})
    
    logger.info(f"Restaurant auction updated: {auction_id}")
    
    return {
        "success": True,
        "auction": updated,
        "message": "Restaurant-Auktion aktualisiert!"
    }


@router.delete("/admin/restaurant-auctions/{auction_id}")
async def delete_restaurant_auction(
    auction_id: str,
    admin: dict = Depends(get_admin_user)
):
    """Restaurant-Gutschein-Auktion löschen (Admin)"""
    
    result = await db.auctions.delete_one({"id": auction_id, "auction_type": "restaurant_voucher"})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Restaurant-Auktion nicht gefunden")
    
    logger.info(f"Restaurant auction deleted: {auction_id}")
    
    return {
        "success": True,
        "message": "Restaurant-Auktion gelöscht!"
    }

