"""
Partner Portal - Multi-Business Type Registration, QR Code scanning and voucher redemption
Supports: Restaurants, Bars, Gas Stations, Cinemas, Retail, Wellness, Fitness, etc.
"""
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from fastapi.responses import Response
from datetime import datetime, timezone
from typing import Optional, List
from pydantic import BaseModel
import hashlib
import qrcode
import io
import base64
import uuid

from config import db, logger
from utils.email import send_email
from utils.partner_emails import (
    send_partner_application_received,
    send_partner_approved,
    send_partner_rejected,
    send_partner_payout_confirmation
)

router = APIRouter(prefix="/partner-portal", tags=["Partner Portal"])

# ==================== BUSINESS TYPES ====================

BUSINESS_TYPES = [
    {"id": "restaurant", "name": "Restaurant", "name_en": "Restaurant", "icon": "🍕", "commission": 10},
    {"id": "bar", "name": "Bar & Club", "name_en": "Bar & Club", "icon": "🍺", "commission": 10},
    {"id": "cafe", "name": "Café", "name_en": "Café", "icon": "☕", "commission": 10},
    {"id": "gas_station", "name": "Tankstelle", "name_en": "Gas Station", "icon": "⛽", "commission": 8},
    {"id": "cinema", "name": "Kino", "name_en": "Cinema", "icon": "🎬", "commission": 12},
    {"id": "retail", "name": "Einzelhandel", "name_en": "Retail", "icon": "🛒", "commission": 10},
    {"id": "wellness", "name": "Wellness & Spa", "name_en": "Wellness & Spa", "icon": "💆", "commission": 12},
    {"id": "fitness", "name": "Fitness-Studio", "name_en": "Fitness Studio", "icon": "🏋️", "commission": 10},
    {"id": "beauty", "name": "Friseur & Beauty", "name_en": "Hair & Beauty", "icon": "💇", "commission": 10},
    {"id": "hotel", "name": "Hotel & Unterkunft", "name_en": "Hotel & Accommodation", "icon": "🏨", "commission": 12},
    {"id": "entertainment", "name": "Unterhaltung", "name_en": "Entertainment", "icon": "🎯", "commission": 10},
    {"id": "supermarket", "name": "Supermarkt", "name_en": "Supermarket", "icon": "🛍️", "commission": 8},
    {"id": "pharmacy", "name": "Apotheke", "name_en": "Pharmacy", "icon": "💊", "commission": 8},
    {"id": "other", "name": "Sonstiges", "name_en": "Other", "icon": "🏪", "commission": 10},
]

# ==================== SCHEMAS ====================

class PartnerLogin(BaseModel):
    email: str
    password: str

class PartnerApplication(BaseModel):
    business_name: str
    business_type: str  # One of BUSINESS_TYPES
    email: str
    password: str
    phone: str
    address: str
    city: str
    postal_code: str
    country: str = "Deutschland"
    description: Optional[str] = None
    website: Optional[str] = None
    tax_id: Optional[str] = None  # Steuernummer
    iban: Optional[str] = None  # For payouts
    contact_person: Optional[str] = None
    logo_url: Optional[str] = None
    categories: Optional[List[str]] = []  # Sub-categories

class VoucherCreate(BaseModel):
    name: str
    description: Optional[str] = None
    value: float  # Voucher value in EUR
    discount_percent: Optional[float] = None  # Alternative: percentage discount
    price: float  # Selling price on BidBlitz (value - commission)
    quantity: int = 1
    valid_until: Optional[str] = None
    terms: Optional[str] = None

class VoucherRedeemRequest(BaseModel):
    voucher_code: str
    
# ==================== HELPER FUNCTIONS ====================

def hash_password(password: str) -> str:
    """Hash password using SHA256"""
    return hashlib.sha256(password.encode()).hexdigest()

def verify_password(password: str, hashed: str) -> bool:
    """Verify password against hash"""
    return hash_password(password) == hashed

def generate_qr_code(data: str, size: int = 200) -> str:
    """Generate QR code and return as base64 PNG"""
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_H,
        box_size=10,
        border=2,
    )
    qr.add_data(data)
    qr.make(fit=True)
    
    img = qr.make_image(fill_color="black", back_color="white")
    
    buffer = io.BytesIO()
    img.save(buffer, format='PNG')
    buffer.seek(0)
    
    return base64.b64encode(buffer.getvalue()).decode()

def get_commission_rate(business_type: str) -> float:
    """Get commission rate for business type"""
    for bt in BUSINESS_TYPES:
        if bt["id"] == business_type:
            return bt["commission"]
    return 10  # Default 10%

# ==================== BUSINESS TYPES ENDPOINT ====================

@router.get("/business-types")
async def get_business_types():
    """Get all available business types"""
    return BUSINESS_TYPES

# ==================== PARTNER AUTH ====================

@router.post("/apply")
async def apply_as_partner(data: PartnerApplication):
    """Submit application to become a partner"""
    # Check if email already exists
    existing = await db.partner_accounts.find_one({"email": data.email.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="E-Mail bereits registriert")
    
    # Also check old restaurant_accounts for migration
    existing_restaurant = await db.restaurant_accounts.find_one({"email": data.email.lower()})
    if existing_restaurant:
        raise HTTPException(status_code=400, detail="E-Mail bereits registriert")
    
    # Validate business type
    valid_types = [bt["id"] for bt in BUSINESS_TYPES]
    if data.business_type not in valid_types:
        raise HTTPException(status_code=400, detail="Ungültiger Geschäftstyp")
    
    partner_id = str(uuid.uuid4())
    commission_rate = get_commission_rate(data.business_type)
    
    application = {
        "id": partner_id,
        "business_name": data.business_name,
        "business_type": data.business_type,
        "email": data.email.lower(),
        "password_hash": hash_password(data.password),
        "phone": data.phone,
        "address": data.address,
        "city": data.city,
        "postal_code": data.postal_code,
        "country": data.country,
        "description": data.description,
        "website": data.website,
        "tax_id": data.tax_id,
        "iban": data.iban,
        "contact_person": data.contact_person,
        "logo_url": data.logo_url,
        "categories": data.categories or [],
        
        # Status
        "status": "pending",  # pending, approved, rejected
        "is_active": False,
        "is_verified": False,
        
        # Commission & Stats
        "commission_rate": commission_rate,
        "total_sales": 0.0,
        "total_commission": 0.0,
        "total_redeemed": 0,
        "pending_payout": 0.0,
        "total_payout": 0.0,
        
        # Timestamps
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "approved_at": None,
        "rejected_at": None,
        "rejection_reason": None
    }
    
    await db.partner_accounts.insert_one(application)
    
    logger.info(f"New partner application: {data.business_name} ({data.business_type})")
    
    # Send confirmation email
    try:
        await send_partner_application_received(
            send_email,
            to_email=data.email,
            business_name=data.business_name,
            business_type=data.business_type
        )
    except Exception as e:
        logger.error(f"Failed to send application email: {e}")
    
    return {
        "success": True,
        "message": "Bewerbung erfolgreich eingereicht! Sie erhalten eine E-Mail, sobald Ihre Bewerbung geprüft wurde.",
        "partner_id": partner_id,
        "application_status": "pending"
    }

@router.post("/login")
async def login_partner(data: PartnerLogin):
    """Login for partners"""
    # Check partner_accounts first
    partner = await db.partner_accounts.find_one(
        {"email": data.email.lower()},
        {"_id": 0}
    )
    
    # Fallback to old restaurant_accounts for migration
    if not partner:
        partner = await db.restaurant_accounts.find_one(
            {"email": data.email.lower()},
            {"_id": 0}
        )
        if partner:
            # Map old restaurant fields to partner fields
            partner["business_name"] = partner.get("restaurant_name", partner.get("business_name"))
            partner["business_type"] = partner.get("business_type", "restaurant")
    
    if not partner:
        raise HTTPException(status_code=401, detail="Ungültige Anmeldedaten")
    
    if not verify_password(data.password, partner.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Ungültige Anmeldedaten")
    
    if partner.get("status") == "rejected":
        raise HTTPException(status_code=403, detail=f"Bewerbung abgelehnt: {partner.get('rejection_reason', 'Keine Angabe')}")
    
    if partner.get("status") == "pending" or not partner.get("is_verified"):
        raise HTTPException(status_code=403, detail="Ihre Bewerbung wird noch geprüft. Bitte warten Sie auf die Freigabe.")
    
    if not partner.get("is_active"):
        raise HTTPException(status_code=403, detail="Konto deaktiviert")
    
    # Generate token
    import secrets
    token = secrets.token_urlsafe(32)
    
    # Store token
    collection = db.partner_accounts if await db.partner_accounts.find_one({"id": partner["id"]}) else db.restaurant_accounts
    await collection.update_one(
        {"id": partner["id"]},
        {"$set": {
            "auth_token": token,
            "last_login": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Get business type info
    business_type_info = next((bt for bt in BUSINESS_TYPES if bt["id"] == partner.get("business_type", "restaurant")), BUSINESS_TYPES[0])
    
    return {
        "success": True,
        "token": token,
        "partner": {
            "id": partner["id"],
            "name": partner.get("business_name", partner.get("restaurant_name")),
            "email": partner["email"],
            "business_type": partner.get("business_type", "restaurant"),
            "business_type_info": business_type_info,
            "pending_payout": partner.get("pending_payout", 0),
            "total_redeemed": partner.get("total_redeemed", 0),
            "commission_rate": partner.get("commission_rate", 10),
            "logo_url": partner.get("logo_url")
        }
    }

async def get_current_partner(token: str):
    """Get partner from auth token"""
    if not token:
        raise HTTPException(status_code=401, detail="Token erforderlich")
    
    # Check partner_accounts first
    partner = await db.partner_accounts.find_one(
        {"auth_token": token, "is_active": True},
        {"_id": 0, "password_hash": 0}
    )
    
    # Fallback to restaurant_accounts
    if not partner:
        partner = await db.restaurant_accounts.find_one(
            {"auth_token": token, "is_active": True},
            {"_id": 0, "password_hash": 0}
        )
    
    if not partner:
        raise HTTPException(status_code=401, detail="Ungültiger Token")
    
    return partner

# ==================== APPLICATION STATUS ====================

@router.get("/application-status/{email}")
async def check_application_status(email: str):
    """Check status of a partner application"""
    partner = await db.partner_accounts.find_one(
        {"email": email.lower()},
        {"_id": 0, "password_hash": 0, "auth_token": 0}
    )
    
    if not partner:
        raise HTTPException(status_code=404, detail="Bewerbung nicht gefunden")
    
    return {
        "status": partner.get("status", "pending"),
        "business_name": partner.get("business_name"),
        "submitted_at": partner.get("created_at"),
        "approved_at": partner.get("approved_at"),
        "rejected_at": partner.get("rejected_at"),
        "rejection_reason": partner.get("rejection_reason")
    }

# ==================== VOUCHER MANAGEMENT ====================

@router.post("/vouchers/create")
async def create_voucher(voucher: VoucherCreate, token: str):
    """Create a new voucher/gift card to sell on BidBlitz"""
    partner = await get_current_partner(token)
    
    commission_rate = partner.get("commission_rate", 10)
    
    for i in range(voucher.quantity):
        voucher_code = f"BLZ-{str(uuid.uuid4())[:8].upper()}"
        
        voucher_doc = {
            "id": str(uuid.uuid4()),
            "code": voucher_code,
            "name": voucher.name,
            "description": voucher.description,
            "value": voucher.value,
            "discount_percent": voucher.discount_percent,
            "price": voucher.price,
            "terms": voucher.terms,
            "valid_until": voucher.valid_until,
            
            # Partner info
            "partner_id": partner["id"],
            "partner_name": partner.get("business_name", partner.get("restaurant_name")),
            "business_type": partner.get("business_type", "restaurant"),
            
            # Commission
            "commission_rate": commission_rate,
            "commission_amount": voucher.price * (commission_rate / 100),
            "partner_payout": voucher.price * (1 - commission_rate / 100),
            
            # Status
            "is_active": True,
            "is_sold": False,
            "is_redeemed": False,
            "used_count": 0,
            "max_uses": 1,
            
            # Timestamps
            "created_at": datetime.now(timezone.utc).isoformat(),
            "sold_at": None,
            "redeemed_at": None,
            "sold_to_user_id": None
        }
        
        await db.partner_vouchers.insert_one(voucher_doc)
    
    logger.info(f"Partner {partner['id']} created {voucher.quantity} voucher(s)")
    
    return {
        "success": True,
        "message": f"{voucher.quantity} Gutschein(e) erstellt!",
        "commission_rate": commission_rate,
        "estimated_payout_per_voucher": voucher.price * (1 - commission_rate / 100)
    }

@router.get("/vouchers")
async def get_partner_vouchers(token: str, status: str = None):
    """Get all vouchers for a partner"""
    partner = await get_current_partner(token)
    
    query = {"partner_id": partner["id"]}
    
    if status == "available":
        query["is_sold"] = False
        query["is_active"] = True
    elif status == "sold":
        query["is_sold"] = True
        query["is_redeemed"] = False
    elif status == "redeemed":
        query["is_redeemed"] = True
    
    vouchers = await db.partner_vouchers.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    return {
        "vouchers": vouchers,
        "total": len(vouchers)
    }

# ==================== QR CODE & VALIDATION ====================

@router.get("/voucher-qr/{voucher_code}")
async def get_voucher_qr(voucher_code: str):
    """Generate QR code for a voucher"""
    # Check both collections
    voucher = await db.partner_vouchers.find_one(
        {"code": voucher_code.upper()},
        {"_id": 0}
    )
    
    if not voucher:
        voucher = await db.vouchers.find_one(
            {"code": voucher_code.upper()},
            {"_id": 0}
        )
    
    if not voucher:
        raise HTTPException(status_code=404, detail="Gutschein nicht gefunden")
    
    qr_data = f"BIDBLITZ:{voucher['code']}:{voucher.get('value', 0)}:{voucher.get('partner_name', voucher.get('merchant_name', 'Unknown'))}"
    qr_base64 = generate_qr_code(qr_data)
    
    return {
        "voucher_code": voucher["code"],
        "qr_code": f"data:image/png;base64,{qr_base64}",
        "value": voucher.get("value", 0),
        "partner_name": voucher.get("partner_name", voucher.get("merchant_name")),
        "is_valid": voucher.get("is_active", False) and not voucher.get("is_redeemed", False)
    }

@router.get("/validate/{voucher_code}")
async def validate_voucher(voucher_code: str, token: str):
    """Validate a voucher code"""
    partner = await get_current_partner(token)
    
    # Check both collections
    voucher = await db.partner_vouchers.find_one(
        {"code": voucher_code.upper()},
        {"_id": 0}
    )
    
    if not voucher:
        voucher = await db.vouchers.find_one(
            {"code": voucher_code.upper()},
            {"_id": 0}
        )
    
    if not voucher:
        return {
            "valid": False,
            "error": "Gutschein nicht gefunden",
            "code": voucher_code.upper()
        }
    
    # Check if voucher belongs to this partner
    voucher_partner_id = voucher.get("partner_id", voucher.get("merchant_id"))
    if voucher_partner_id and voucher_partner_id != partner["id"]:
        return {
            "valid": False,
            "error": "Dieser Gutschein gehört zu einem anderen Partner",
            "code": voucher_code.upper()
        }
    
    # Check if already redeemed
    if voucher.get("is_redeemed") or voucher.get("used_count", 0) >= voucher.get("max_uses", 1):
        return {
            "valid": False,
            "error": "Gutschein bereits eingelöst",
            "code": voucher_code.upper(),
            "redeemed_at": voucher.get("redeemed_at")
        }
    
    # Check if active
    if not voucher.get("is_active", True):
        return {
            "valid": False,
            "error": "Gutschein nicht aktiv",
            "code": voucher_code.upper()
        }
    
    # Check expiration
    if voucher.get("valid_until"):
        try:
            expiry = datetime.fromisoformat(voucher["valid_until"].replace("Z", "+00:00"))
            if datetime.now(timezone.utc) > expiry:
                return {
                    "valid": False,
                    "error": "Gutschein abgelaufen",
                    "code": voucher_code.upper(),
                    "expired_at": voucher["valid_until"]
                }
        except:
            pass
    
    return {
        "valid": True,
        "code": voucher["code"],
        "name": voucher.get("name", "Gutschein"),
        "value": voucher.get("value", 0),
        "discount_percent": voucher.get("discount_percent"),
        "description": voucher.get("description"),
        "terms": voucher.get("terms"),
        "partner_name": voucher.get("partner_name", voucher.get("merchant_name")),
        "business_type": voucher.get("business_type", "restaurant")
    }

@router.post("/redeem")
async def redeem_voucher(request: VoucherRedeemRequest, token: str):
    """Redeem a voucher"""
    partner = await get_current_partner(token)
    
    # Check both collections
    voucher = await db.partner_vouchers.find_one(
        {"code": request.voucher_code.upper()},
        {"_id": 0}
    )
    collection = db.partner_vouchers
    
    if not voucher:
        voucher = await db.vouchers.find_one(
            {"code": request.voucher_code.upper()},
            {"_id": 0}
        )
        collection = db.vouchers
    
    if not voucher:
        raise HTTPException(status_code=404, detail="Gutschein nicht gefunden")
    
    # Validate before redeeming
    if voucher.get("is_redeemed") or voucher.get("used_count", 0) >= voucher.get("max_uses", 1):
        raise HTTPException(status_code=400, detail="Gutschein bereits eingelöst")
    
    now = datetime.now(timezone.utc).isoformat()
    value = voucher.get("value", 0)
    commission_rate = partner.get("commission_rate", 10)
    payout_amount = value * (1 - commission_rate / 100)
    
    # Update voucher
    await collection.update_one(
        {"code": request.voucher_code.upper()},
        {"$set": {
            "is_redeemed": True,
            "used_count": 1,
            "redeemed_at": now,
            "redeemed_by_partner_id": partner["id"]
        }}
    )
    
    # Update partner stats
    partner_collection = db.partner_accounts if await db.partner_accounts.find_one({"id": partner["id"]}) else db.restaurant_accounts
    await partner_collection.update_one(
        {"id": partner["id"]},
        {
            "$inc": {
                "total_redeemed": 1,
                "pending_payout": payout_amount,
                "total_sales": value
            },
            "$push": {
                "redemptions": {
                    "voucher_code": voucher["code"],
                    "value": value,
                    "payout_amount": payout_amount,
                    "commission": value * (commission_rate / 100),
                    "redeemed_at": now
                }
            }
        }
    )
    
    logger.info(f"Partner {partner['id']} redeemed voucher {voucher['code']} (€{value})")
    
    return {
        "success": True,
        "message": f"Gutschein erfolgreich eingelöst!",
        "voucher_code": voucher["code"],
        "value": value,
        "commission_rate": commission_rate,
        "payout_amount": payout_amount,
        "redeemed_at": now
    }

# ==================== DASHBOARD ====================

@router.get("/dashboard")
async def get_dashboard(token: str):
    """Get partner dashboard data"""
    partner = await get_current_partner(token)
    
    # Get voucher stats
    total_vouchers = await db.partner_vouchers.count_documents({"partner_id": partner["id"]})
    available_vouchers = await db.partner_vouchers.count_documents({
        "partner_id": partner["id"],
        "is_sold": False,
        "is_active": True
    })
    sold_vouchers = await db.partner_vouchers.count_documents({
        "partner_id": partner["id"],
        "is_sold": True
    })
    redeemed_vouchers = await db.partner_vouchers.count_documents({
        "partner_id": partner["id"],
        "is_redeemed": True
    })
    
    # Get recent redemptions
    recent_redemptions = partner.get("redemptions", [])[-10:]
    recent_redemptions.reverse()
    
    business_type_info = next((bt for bt in BUSINESS_TYPES if bt["id"] == partner.get("business_type", "restaurant")), BUSINESS_TYPES[0])
    
    return {
        "partner": {
            "id": partner["id"],
            "name": partner.get("business_name", partner.get("restaurant_name")),
            "email": partner["email"],
            "business_type": partner.get("business_type", "restaurant"),
            "business_type_info": business_type_info,
            "logo_url": partner.get("logo_url"),
            "commission_rate": partner.get("commission_rate", 10)
        },
        "stats": {
            "total_sales": partner.get("total_sales", 0),
            "total_commission": partner.get("total_commission", 0),
            "pending_payout": partner.get("pending_payout", 0),
            "total_payout": partner.get("total_payout", 0),
            "total_redeemed": partner.get("total_redeemed", 0)
        },
        "vouchers": {
            "total": total_vouchers,
            "available": available_vouchers,
            "sold": sold_vouchers,
            "redeemed": redeemed_vouchers
        },
        "recent_redemptions": recent_redemptions
    }

@router.get("/redemption-history")
async def get_redemption_history(token: str, limit: int = 50):
    """Get redemption history for a partner"""
    partner = await get_current_partner(token)
    
    redemptions = partner.get("redemptions", [])
    redemptions.reverse()
    
    return {
        "redemptions": redemptions[:limit],
        "total": len(redemptions)
    }

# ==================== ADMIN ENDPOINTS ====================

@router.get("/admin/pending-applications")
async def get_pending_applications():
    """Get all pending partner applications (Admin only)"""
    applications = await db.partner_accounts.find(
        {"status": "pending"},
        {"_id": 0, "password_hash": 0, "auth_token": 0}
    ).sort("created_at", -1).to_list(100)
    
    return {
        "applications": applications,
        "total": len(applications)
    }

@router.post("/admin/approve/{partner_id}")
async def approve_application(partner_id: str):
    """Approve a partner application (Admin only)"""
    partner = await db.partner_accounts.find_one({"id": partner_id})
    
    if not partner:
        raise HTTPException(status_code=404, detail="Bewerbung nicht gefunden")
    
    if partner.get("status") != "pending":
        raise HTTPException(status_code=400, detail="Bewerbung ist nicht ausstehend")
    
    await db.partner_accounts.update_one(
        {"id": partner_id},
        {"$set": {
            "status": "approved",
            "is_active": True,
            "is_verified": True,
            "approved_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    logger.info(f"Partner application {partner_id} approved")
    
    # Send approval email
    try:
        await send_partner_approved(
            to_email=partner["email"],
            business_name=partner["business_name"],
            business_type=partner.get("business_type", "other"),
            commission_rate=partner.get("commission_rate", 10)
        )
    except Exception as e:
        logger.error(f"Failed to send approval email: {e}")
    
    return {
        "success": True,
        "message": "Bewerbung genehmigt!",
        "partner_id": partner_id
    }

@router.post("/admin/reject/{partner_id}")
async def reject_application(partner_id: str, reason: str = "Nicht erfüllt die Anforderungen"):
    """Reject a partner application (Admin only)"""
    partner = await db.partner_accounts.find_one({"id": partner_id})
    
    if not partner:
        raise HTTPException(status_code=404, detail="Bewerbung nicht gefunden")
    
    await db.partner_accounts.update_one(
        {"id": partner_id},
        {"$set": {
            "status": "rejected",
            "is_active": False,
            "rejected_at": datetime.now(timezone.utc).isoformat(),
            "rejection_reason": reason,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    logger.info(f"Partner application {partner_id} rejected: {reason}")
    
    # Send rejection email
    try:
        await send_partner_rejected(
            to_email=partner["email"],
            business_name=partner["business_name"],
            reason=reason
        )
    except Exception as e:
        logger.error(f"Failed to send rejection email: {e}")
    
    return {
        "success": True,
        "message": "Bewerbung abgelehnt",
        "partner_id": partner_id,
        "reason": reason
    }

@router.get("/admin/all-partners")
async def get_all_partners():
    """Get all partners (Admin only)"""
    partners = await db.partner_accounts.find(
        {},
        {"_id": 0, "password_hash": 0, "auth_token": 0}
    ).sort("created_at", -1).to_list(500)
    
    # Also get old restaurant accounts
    restaurants = await db.restaurant_accounts.find(
        {},
        {"_id": 0, "password_hash": 0, "auth_token": 0}
    ).to_list(500)
    
    # Mark restaurants as restaurant type
    for r in restaurants:
        r["business_type"] = "restaurant"
        r["business_name"] = r.get("restaurant_name", r.get("business_name"))
    
    all_partners = partners + restaurants
    
    return {
        "partners": all_partners,
        "total": len(all_partners)
    }

# ==================== PAYOUT SYSTEM ====================

class PayoutRequest(BaseModel):
    amount: Optional[float] = None  # If None, request full pending amount

@router.post("/request-payout")
async def request_payout(request: PayoutRequest, token: str):
    """Request a payout of pending earnings"""
    partner = await get_current_partner(token)
    
    pending = partner.get("pending_payout", 0)
    min_payout = 50.0  # Minimum payout amount
    
    amount = request.amount or pending
    
    if amount > pending:
        raise HTTPException(status_code=400, detail=f"Maximaler Betrag: €{pending:.2f}")
    
    if amount < min_payout:
        raise HTTPException(status_code=400, detail=f"Mindestbetrag für Auszahlung: €{min_payout:.2f}")
    
    if not partner.get("iban"):
        raise HTTPException(status_code=400, detail="Bitte hinterlegen Sie zuerst Ihre IBAN")
    
    payout_id = f"PAY-{str(uuid.uuid4())[:8].upper()}"
    now = datetime.now(timezone.utc).isoformat()
    
    payout_record = {
        "id": payout_id,
        "partner_id": partner["id"],
        "amount": amount,
        "status": "pending",
        "iban": partner.get("iban"),
        "requested_at": now,
        "processed_at": None,
        "completed_at": None,
        "notes": None
    }
    
    await db.partner_payouts.insert_one(payout_record)
    
    partner_collection = db.partner_accounts if await db.partner_accounts.find_one({"id": partner["id"]}) else db.restaurant_accounts
    await partner_collection.update_one(
        {"id": partner["id"]},
        {
            "$inc": {"pending_payout": -amount},
            "$push": {
                "payout_requests": {
                    "id": payout_id,
                    "amount": amount,
                    "status": "pending",
                    "requested_at": now
                }
            }
        }
    )
    
    try:
        await send_partner_payout_confirmation(
            to_email=partner["email"],
            business_name=partner.get("business_name", partner.get("restaurant_name")),
            payout_amount=amount,
            payout_id=payout_id
        )
    except Exception as e:
        logger.error(f"Failed to send payout email: {e}")
    
    logger.info(f"Partner {partner['id']} requested payout: €{amount}")
    
    return {
        "success": True,
        "message": f"Auszahlung von €{amount:.2f} beantragt!",
        "payout_id": payout_id,
        "amount": amount,
        "remaining_balance": pending - amount
    }

@router.get("/payout-history")
async def get_payout_history(token: str):
    """Get payout history for a partner"""
    partner = await get_current_partner(token)
    
    payouts = await db.partner_payouts.find(
        {"partner_id": partner["id"]},
        {"_id": 0}
    ).sort("requested_at", -1).to_list(100)
    
    return {
        "payouts": payouts,
        "total": len(payouts),
        "pending_payout": partner.get("pending_payout", 0),
        "total_paid_out": partner.get("total_payout", 0)
    }

@router.get("/statistics")
async def get_partner_statistics(token: str, period: str = "month"):
    """Get detailed statistics for a partner"""
    partner = await get_current_partner(token)
    
    vouchers = await db.partner_vouchers.find(
        {"partner_id": partner["id"]},
        {"_id": 0}
    ).to_list(1000)
    
    total_created = len(vouchers)
    total_sold = len([v for v in vouchers if v.get("is_sold")])
    total_redeemed = len([v for v in vouchers if v.get("is_redeemed")])
    
    redemptions = partner.get("redemptions", [])
    
    from collections import defaultdict
    daily_data = defaultdict(lambda: {"count": 0, "value": 0})
    
    for r in redemptions:
        date_str = r.get("redeemed_at", "")[:10]
        if date_str:
            daily_data[date_str]["count"] += 1
            daily_data[date_str]["value"] += r.get("payout_amount", 0)
    
    chart_data = [
        {"date": date, "count": data["count"], "value": round(data["value"], 2)}
        for date, data in sorted(daily_data.items())
    ][-30:]
    
    voucher_performance = {}
    for v in vouchers:
        name = v.get("name", "Unbenannt")
        if name not in voucher_performance:
            voucher_performance[name] = {"sold": 0, "redeemed": 0, "revenue": 0}
        if v.get("is_sold"):
            voucher_performance[name]["sold"] += 1
            voucher_performance[name]["revenue"] += v.get("price", 0)
        if v.get("is_redeemed"):
            voucher_performance[name]["redeemed"] += 1
    
    top_vouchers = sorted(
        [{"name": k, **v} for k, v in voucher_performance.items()],
        key=lambda x: x["revenue"],
        reverse=True
    )[:5]
    
    return {
        "overview": {
            "total_created": total_created,
            "total_sold": total_sold,
            "total_redeemed": total_redeemed,
            "conversion_rate": round((total_sold / total_created * 100) if total_created > 0 else 0, 1),
            "redemption_rate": round((total_redeemed / total_sold * 100) if total_sold > 0 else 0, 1)
        },
        "financials": {
            "total_sales": round(partner.get("total_sales", 0), 2),
            "total_commission": round(partner.get("total_commission", 0), 2),
            "pending_payout": round(partner.get("pending_payout", 0), 2),
            "total_paid_out": round(partner.get("total_payout", 0), 2),
            "commission_rate": partner.get("commission_rate", 10)
        },
        "chart_data": chart_data,
        "top_vouchers": top_vouchers
    }

@router.put("/profile")
async def update_profile(token: str, description: str = None, website: str = None, 
                         phone: str = None, address: str = None, opening_hours: str = None):
    """Update partner profile information"""
    partner = await get_current_partner(token)
    
    update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
    
    if description is not None:
        update_data["description"] = description
    if website is not None:
        update_data["website"] = website
    if phone is not None:
        update_data["phone"] = phone
    if address is not None:
        update_data["address"] = address
    if opening_hours is not None:
        update_data["opening_hours"] = opening_hours
    
    partner_collection = db.partner_accounts if await db.partner_accounts.find_one({"id": partner["id"]}) else db.restaurant_accounts
    await partner_collection.update_one(
        {"id": partner["id"]},
        {"$set": update_data}
    )
    
    return {"success": True, "message": "Profil aktualisiert"}

@router.post("/upload-logo")
async def upload_logo(token: str, logo: UploadFile = File(...)):
    """Upload partner logo"""
    partner = await get_current_partner(token)
    
    allowed_types = ["image/jpeg", "image/png", "image/webp", "image/gif"]
    if logo.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Nur JPEG, PNG, WebP oder GIF erlaubt")
    
    contents = await logo.read()
    if len(contents) > 2 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Maximale Dateigröße: 2MB")
    
    logo_base64 = base64.b64encode(contents).decode()
    logo_url = f"data:{logo.content_type};base64,{logo_base64}"
    
    partner_collection = db.partner_accounts if await db.partner_accounts.find_one({"id": partner["id"]}) else db.restaurant_accounts
    await partner_collection.update_one(
        {"id": partner["id"]},
        {"$set": {
            "logo_url": logo_url,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    logger.info(f"Partner {partner['id']} uploaded logo")
    
    return {
        "success": True,
        "message": "Logo hochgeladen!",
        "logo_url": logo_url
    }

@router.put("/update-iban")
async def update_iban(token: str, iban: str, tax_id: str = None):
    """Update partner banking details"""
    partner = await get_current_partner(token)
    
    iban_clean = iban.replace(" ", "").upper()
    if len(iban_clean) < 15 or not iban_clean[:2].isalpha():
        raise HTTPException(status_code=400, detail="Ungültige IBAN")
    
    update_data = {
        "iban": iban_clean,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    if tax_id:
        update_data["tax_id"] = tax_id
    
    partner_collection = db.partner_accounts if await db.partner_accounts.find_one({"id": partner["id"]}) else db.restaurant_accounts
    await partner_collection.update_one(
        {"id": partner["id"]},
        {"$set": update_data}
    )
    
    return {"success": True, "message": "Bankdaten aktualisiert"}

partner_portal_router = router
