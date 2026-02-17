"""
Restaurant Portal - QR Code scanning and voucher redemption system
Allows restaurants to scan vouchers, validate them, and mark as redeemed
"""
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import Response
from datetime import datetime, timezone
from typing import Optional
from pydantic import BaseModel
import hashlib
import qrcode
import io
import base64
import uuid

from config import db, logger

router = APIRouter(prefix="/restaurant-portal", tags=["Restaurant Portal"])

# ==================== SCHEMAS ====================

class RestaurantLogin(BaseModel):
    email: str
    password: str

class RestaurantRegister(BaseModel):
    restaurant_name: str
    email: str
    password: str
    phone: str
    address: str
    iban: Optional[str] = None  # For payouts

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
    
    # Convert to base64
    buffer = io.BytesIO()
    img.save(buffer, format='PNG')
    buffer.seek(0)
    
    return base64.b64encode(buffer.getvalue()).decode()

# ==================== RESTAURANT AUTH ====================

@router.post("/register")
async def register_restaurant(data: RestaurantRegister):
    """Register a new restaurant for the portal"""
    # Check if email already exists
    existing = await db.restaurant_accounts.find_one({"email": data.email.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="E-Mail bereits registriert")
    
    restaurant_id = str(uuid.uuid4())
    
    await db.restaurant_accounts.insert_one({
        "id": restaurant_id,
        "restaurant_name": data.restaurant_name,
        "email": data.email.lower(),
        "password_hash": hash_password(data.password),
        "phone": data.phone,
        "address": data.address,
        "iban": data.iban,
        "is_active": True,
        "is_verified": False,  # Admin must verify
        "total_redeemed": 0,
        "total_payout": 0.0,
        "pending_payout": 0.0,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "redemptions": []
    })
    
    return {
        "success": True,
        "message": "Restaurant registriert! Warten Sie auf Admin-Freigabe.",
        "restaurant_id": restaurant_id
    }

@router.post("/login")
async def login_restaurant(data: RestaurantLogin):
    """Login for restaurant owners"""
    restaurant = await db.restaurant_accounts.find_one(
        {"email": data.email.lower()},
        {"_id": 0}
    )
    
    if not restaurant:
        raise HTTPException(status_code=401, detail="Ungültige Anmeldedaten")
    
    if not verify_password(data.password, restaurant.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Ungültige Anmeldedaten")
    
    if not restaurant.get("is_active"):
        raise HTTPException(status_code=403, detail="Konto deaktiviert")
    
    if not restaurant.get("is_verified"):
        raise HTTPException(status_code=403, detail="Konto noch nicht verifiziert. Bitte warten Sie auf Admin-Freigabe.")
    
    # Generate simple token (in production use JWT)
    import secrets
    token = secrets.token_urlsafe(32)
    
    # Store token
    await db.restaurant_accounts.update_one(
        {"id": restaurant["id"]},
        {"$set": {
            "auth_token": token,
            "last_login": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {
        "success": True,
        "token": token,
        "restaurant": {
            "id": restaurant["id"],
            "name": restaurant["restaurant_name"],
            "email": restaurant["email"],
            "pending_payout": restaurant.get("pending_payout", 0),
            "total_redeemed": restaurant.get("total_redeemed", 0)
        }
    }

async def get_current_restaurant(token: str):
    """Get restaurant from auth token"""
    if not token:
        raise HTTPException(status_code=401, detail="Token erforderlich")
    
    restaurant = await db.restaurant_accounts.find_one(
        {"auth_token": token, "is_active": True},
        {"_id": 0, "password_hash": 0}
    )
    
    if not restaurant:
        raise HTTPException(status_code=401, detail="Ungültiger Token")
    
    return restaurant

# ==================== QR CODE GENERATION ====================

@router.get("/voucher-qr/{voucher_code}")
async def get_voucher_qr(voucher_code: str):
    """Generate QR code for a voucher"""
    voucher = await db.vouchers.find_one(
        {"code": voucher_code.upper()},
        {"_id": 0}
    )
    
    if not voucher:
        raise HTTPException(status_code=404, detail="Gutschein nicht gefunden")
    
    # QR code contains: BIDBLITZ:CODE:VALUE:RESTAURANT
    qr_data = f"BIDBLITZ:{voucher['code']}:{voucher.get('value', 0)}:{voucher.get('merchant_name', 'Unknown')}"
    
    qr_base64 = generate_qr_code(qr_data)
    
    return {
        "voucher_code": voucher["code"],
        "qr_code": f"data:image/png;base64,{qr_base64}",
        "value": voucher.get("value", 0),
        "merchant_name": voucher.get("merchant_name"),
        "is_valid": voucher.get("is_active", False) and voucher.get("used_count", 0) < voucher.get("max_uses", 1)
    }

@router.get("/voucher-qr-image/{voucher_code}")
async def get_voucher_qr_image(voucher_code: str):
    """Get QR code as direct PNG image"""
    voucher = await db.vouchers.find_one(
        {"code": voucher_code.upper()},
        {"_id": 0}
    )
    
    if not voucher:
        raise HTTPException(status_code=404, detail="Gutschein nicht gefunden")
    
    qr_data = f"BIDBLITZ:{voucher['code']}:{voucher.get('value', 0)}:{voucher.get('merchant_name', 'Unknown')}"
    
    qr = qrcode.QRCode(version=1, error_correction=qrcode.constants.ERROR_CORRECT_H, box_size=10, border=2)
    qr.add_data(qr_data)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    
    buffer = io.BytesIO()
    img.save(buffer, format='PNG')
    buffer.seek(0)
    
    return Response(content=buffer.getvalue(), media_type="image/png")

# ==================== VOUCHER VALIDATION & REDEMPTION ====================

@router.get("/validate/{voucher_code}")
async def validate_voucher(voucher_code: str, token: str = None):
    """Validate a voucher without redeeming it"""
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
    
    # Check if expired
    expires_at = voucher.get("expires_at")
    if expires_at:
        try:
            exp_date = datetime.fromisoformat(expires_at.replace('Z', '+00:00'))
            if exp_date < datetime.now(timezone.utc):
                return {
                    "valid": False,
                    "error": "Gutschein abgelaufen",
                    "code": voucher_code.upper(),
                    "expired_at": expires_at
                }
        except:
            pass
    
    # Check if already used
    if voucher.get("used_count", 0) >= voucher.get("max_uses", 1):
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
            "error": "Gutschein deaktiviert",
            "code": voucher_code.upper()
        }
    
    # Valid!
    return {
        "valid": True,
        "code": voucher["code"],
        "value": voucher.get("value", 0),
        "discount_percent": voucher.get("discount_percent", 0),
        "merchant_name": voucher.get("merchant_name", ""),
        "description": voucher.get("description", ""),
        "expires_at": voucher.get("expires_at"),
        "type": voucher.get("type", "restaurant")
    }

@router.post("/redeem")
async def redeem_voucher(data: VoucherRedeemRequest, token: str):
    """Redeem a voucher - marks it as used and credits the restaurant"""
    # Verify restaurant
    restaurant = await get_current_restaurant(token)
    
    voucher_code = data.voucher_code.upper()
    
    # Get voucher
    voucher = await db.vouchers.find_one(
        {"code": voucher_code},
        {"_id": 0}
    )
    
    if not voucher:
        raise HTTPException(status_code=404, detail="Gutschein nicht gefunden")
    
    # Validate
    if voucher.get("used_count", 0) >= voucher.get("max_uses", 1):
        raise HTTPException(status_code=400, detail="Gutschein bereits eingelöst")
    
    if not voucher.get("is_active", True):
        raise HTTPException(status_code=400, detail="Gutschein deaktiviert")
    
    # Check expiry
    expires_at = voucher.get("expires_at")
    if expires_at:
        try:
            exp_date = datetime.fromisoformat(expires_at.replace('Z', '+00:00'))
            if exp_date < datetime.now(timezone.utc):
                raise HTTPException(status_code=400, detail="Gutschein abgelaufen")
        except ValueError:
            pass
    
    voucher_value = voucher.get("value", 0)
    now = datetime.now(timezone.utc).isoformat()
    
    # Mark voucher as redeemed
    await db.vouchers.update_one(
        {"code": voucher_code},
        {"$set": {
            "used_count": voucher.get("used_count", 0) + 1,
            "is_active": False,
            "redeemed_at": now,
            "redeemed_by_restaurant": restaurant["id"],
            "redeemed_by_restaurant_name": restaurant["restaurant_name"]
        }}
    )
    
    # Create redemption record
    redemption_id = str(uuid.uuid4())
    redemption = {
        "id": redemption_id,
        "voucher_code": voucher_code,
        "voucher_value": voucher_value,
        "restaurant_id": restaurant["id"],
        "restaurant_name": restaurant["restaurant_name"],
        "redeemed_at": now,
        "payout_status": "pending",  # pending, paid
        "payout_date": None
    }
    
    await db.voucher_redemptions.insert_one(redemption)
    
    # Update restaurant stats
    await db.restaurant_accounts.update_one(
        {"id": restaurant["id"]},
        {
            "$inc": {
                "total_redeemed": 1,
                "pending_payout": voucher_value
            },
            "$push": {
                "redemptions": {
                    "voucher_code": voucher_code,
                    "value": voucher_value,
                    "date": now
                }
            }
        }
    )
    
    logger.info(f"Voucher {voucher_code} redeemed by restaurant {restaurant['restaurant_name']} for €{voucher_value}")
    
    return {
        "success": True,
        "message": f"Gutschein eingelöst! €{voucher_value} werden Ihrem Konto gutgeschrieben.",
        "redemption": {
            "id": redemption_id,
            "voucher_code": voucher_code,
            "value": voucher_value,
            "restaurant": restaurant["restaurant_name"],
            "date": now
        }
    }

# ==================== RESTAURANT DASHBOARD ====================

@router.get("/dashboard")
async def get_restaurant_dashboard(token: str):
    """Get restaurant dashboard data"""
    restaurant = await get_current_restaurant(token)
    
    # Get recent redemptions
    recent_redemptions = await db.voucher_redemptions.find(
        {"restaurant_id": restaurant["id"]},
        {"_id": 0}
    ).sort("redeemed_at", -1).limit(20).to_list(20)
    
    # Calculate stats
    total_pending = sum(r.get("voucher_value", 0) for r in recent_redemptions if r.get("payout_status") == "pending")
    total_paid = sum(r.get("voucher_value", 0) for r in recent_redemptions if r.get("payout_status") == "paid")
    
    return {
        "restaurant": {
            "id": restaurant["id"],
            "name": restaurant["restaurant_name"],
            "email": restaurant["email"]
        },
        "stats": {
            "total_redeemed": restaurant.get("total_redeemed", 0),
            "pending_payout": total_pending,
            "total_paid": total_paid
        },
        "recent_redemptions": recent_redemptions
    }

@router.get("/redemption-history")
async def get_redemption_history(token: str, limit: int = 50):
    """Get full redemption history for restaurant"""
    restaurant = await get_current_restaurant(token)
    
    redemptions = await db.voucher_redemptions.find(
        {"restaurant_id": restaurant["id"]},
        {"_id": 0}
    ).sort("redeemed_at", -1).limit(limit).to_list(limit)
    
    return {
        "restaurant_id": restaurant["id"],
        "redemptions": redemptions,
        "total": len(redemptions)
    }

# ==================== ADMIN ENDPOINTS ====================

@router.get("/admin/restaurants")
async def admin_list_restaurants():
    """Admin: List all registered restaurants"""
    restaurants = await db.restaurant_accounts.find(
        {},
        {"_id": 0, "password_hash": 0, "auth_token": 0}
    ).to_list(100)
    
    return restaurants

@router.post("/admin/verify/{restaurant_id}")
async def admin_verify_restaurant(restaurant_id: str):
    """Admin: Verify a restaurant account"""
    result = await db.restaurant_accounts.update_one(
        {"id": restaurant_id},
        {"$set": {"is_verified": True, "verified_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Restaurant nicht gefunden")
    
    return {"success": True, "message": "Restaurant verifiziert"}

@router.post("/admin/payout/{restaurant_id}")
async def admin_mark_payout(restaurant_id: str, amount: float):
    """Admin: Mark a payout as completed"""
    now = datetime.now(timezone.utc).isoformat()
    
    # Update pending redemptions to paid
    await db.voucher_redemptions.update_many(
        {"restaurant_id": restaurant_id, "payout_status": "pending"},
        {"$set": {"payout_status": "paid", "payout_date": now}}
    )
    
    # Update restaurant account
    await db.restaurant_accounts.update_one(
        {"id": restaurant_id},
        {
            "$inc": {"total_payout": amount},
            "$set": {"pending_payout": 0, "last_payout_date": now}
        }
    )
    
    return {"success": True, "message": f"Auszahlung von €{amount} markiert"}

# Export router
restaurant_portal_router = router
