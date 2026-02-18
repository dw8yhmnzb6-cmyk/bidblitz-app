"""
Merchant Vouchers System - Händler-Gutscheine
Admin erstellt Gutscheine für Partner, Nutzer bieten darauf, Gewinner löst beim Partner ein
"""
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone, timedelta
from typing import Optional, List
from pydantic import BaseModel
import uuid

from config import db, logger
from dependencies import get_current_user

router = APIRouter(prefix="/merchant-vouchers", tags=["Merchant Vouchers"])


class CreateMerchantVoucher(BaseModel):
    partner_id: str
    name: str
    description: Optional[str] = None
    voucher_value: float  # Der Wert des Gutscheins in Euro
    start_price: float = 0.01  # Startpreis der Auktion
    duration_hours: int = 24  # Auktionsdauer in Stunden
    quantity: int = 1  # Anzahl der Gutscheine


class RedeemVoucher(BaseModel):
    voucher_code: str
    partner_id: str


@router.get("/merchants")
async def get_merchants_with_vouchers():
    """Alle Partner/Händler mit aktiven Gutschein-Auktionen abrufen"""
    # Get all active partners
    partners = await db.partner_accounts.find(
        {"is_active": True, "is_locked": {"$ne": True}},
        {"_id": 0, "password_hash": 0, "auth_token": 0}
    ).to_list(100)
    
    # Also check restaurant_accounts
    restaurants = await db.restaurant_accounts.find(
        {"is_active": True, "is_locked": {"$ne": True}},
        {"_id": 0, "password_hash": 0, "auth_token": 0}
    ).to_list(100)
    
    # Combine and format
    all_merchants = []
    
    for p in partners:
        # Count active voucher auctions for this partner
        voucher_count = await db.merchant_voucher_auctions.count_documents({
            "partner_id": p["id"],
            "status": "active"
        })
        
        all_merchants.append({
            "id": p["id"],
            "business_name": p.get("business_name", p.get("restaurant_name", "Partner")),
            "business_type": p.get("business_type", "other"),
            "city": p.get("city", ""),
            "address": p.get("address", ""),
            "phone": p.get("phone", ""),
            "website": p.get("website", ""),
            "logo_url": p.get("logo_url", ""),
            "photos": p.get("photos", []),
            "description": p.get("description", ""),
            "opening_hours": p.get("opening_hours", {}),
            "voucher_count": voucher_count,
            "is_verified": p.get("is_verified", False),
            "is_premium": p.get("is_premium", False),
            "premium_until": p.get("premium_until"),
            "rating": p.get("rating", 0),
            "review_count": p.get("review_count", 0)
        })
    
    for r in restaurants:
        voucher_count = await db.merchant_voucher_auctions.count_documents({
            "partner_id": r["id"],
            "status": "active"
        })
        
        all_merchants.append({
            "id": r["id"],
            "business_name": r.get("restaurant_name", r.get("business_name", "Restaurant")),
            "business_type": "restaurant",
            "city": r.get("city", ""),
            "address": r.get("address", ""),
            "phone": r.get("phone", ""),
            "website": r.get("website", ""),
            "logo_url": r.get("logo_url", ""),
            "photos": r.get("photos", []),
            "description": r.get("description", ""),
            "opening_hours": r.get("opening_hours", {}),
            "voucher_count": voucher_count,
            "is_verified": r.get("is_verified", False),
            "is_premium": r.get("is_premium", False),
            "premium_until": r.get("premium_until"),
            "rating": r.get("rating", 0),
            "review_count": r.get("review_count", 0)
        })
    
    # Sort: Premium first, then by voucher count
    all_merchants.sort(key=lambda x: (-int(x.get("is_premium", False)), -x["voucher_count"]))
    
    return {
        "merchants": all_merchants,
        "total": len(all_merchants)
    }


@router.get("/merchant/{partner_id}")
async def get_merchant_details(partner_id: str):
    """Details eines einzelnen Händlers abrufen"""
    # Check partner_accounts first
    merchant = await db.partner_accounts.find_one(
        {"id": partner_id},
        {"_id": 0, "password_hash": 0, "auth_token": 0}
    )
    
    # If not found, check restaurant_accounts
    if not merchant:
        merchant = await db.restaurant_accounts.find_one(
            {"id": partner_id},
            {"_id": 0, "password_hash": 0, "auth_token": 0}
        )
    
    if not merchant:
        raise HTTPException(status_code=404, detail="Händler nicht gefunden")
    
    return {
        "merchant": {
            "id": merchant["id"],
            "business_name": merchant.get("business_name", merchant.get("restaurant_name", "Partner")),
            "business_type": merchant.get("business_type", "other"),
            "city": merchant.get("city", ""),
            "address": merchant.get("address", ""),
            "phone": merchant.get("phone", ""),
            "website": merchant.get("website", ""),
            "email": merchant.get("email", ""),
            "logo_url": merchant.get("logo_url", ""),
            "photos": merchant.get("photos", []),
            "description": merchant.get("description", ""),
            "opening_hours": merchant.get("opening_hours", {}),
            "is_verified": merchant.get("is_verified", False),
            "is_premium": merchant.get("is_premium", False),
            "premium_until": merchant.get("premium_until"),
            "rating": merchant.get("rating", 0),
            "review_count": merchant.get("review_count", 0),
            "social_media": merchant.get("social_media", {}),
            "specialties": merchant.get("specialties", []),
            "payment_methods": merchant.get("payment_methods", [])
        }
    }


class UpdateMerchantProfile(BaseModel):
    logo_url: Optional[str] = None
    photos: Optional[List[str]] = None
    description: Optional[str] = None
    website: Optional[str] = None
    phone: Optional[str] = None
    opening_hours: Optional[dict] = None
    social_media: Optional[dict] = None
    specialties: Optional[List[str]] = None
    payment_methods: Optional[List[str]] = None


@router.put("/merchant/{partner_id}/profile")
async def update_merchant_profile(partner_id: str, data: UpdateMerchantProfile):
    """Händler-Profil aktualisieren (Logo, Fotos, Öffnungszeiten etc.)"""
    # Find merchant
    partner = await db.partner_accounts.find_one({"id": partner_id})
    collection = db.partner_accounts
    
    if not partner:
        partner = await db.restaurant_accounts.find_one({"id": partner_id})
        collection = db.restaurant_accounts
    
    if not partner:
        raise HTTPException(status_code=404, detail="Händler nicht gefunden")
    
    # Build update dict
    update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
    
    if data.logo_url is not None:
        update_data["logo_url"] = data.logo_url
    if data.photos is not None:
        update_data["photos"] = data.photos
    if data.description is not None:
        update_data["description"] = data.description
    if data.website is not None:
        update_data["website"] = data.website
    if data.phone is not None:
        update_data["phone"] = data.phone
    if data.opening_hours is not None:
        update_data["opening_hours"] = data.opening_hours
    if data.social_media is not None:
        update_data["social_media"] = data.social_media
    if data.specialties is not None:
        update_data["specialties"] = data.specialties
    if data.payment_methods is not None:
        update_data["payment_methods"] = data.payment_methods
    
    await collection.update_one(
        {"id": partner_id},
        {"$set": update_data}
    )
    
    logger.info(f"Merchant profile updated: {partner_id}")
    
    return {"success": True, "message": "Profil aktualisiert"}


class SetPremiumRequest(BaseModel):
    partner_id: str
    months: int = 1  # Premium duration in months
    price: float = 10.0  # Premium price in EUR (5-20€)
    

@router.post("/admin/set-premium")
async def admin_set_premium_merchant(data: SetPremiumRequest):
    """Admin: Händler als Premium markieren mit Preis"""
    partner = await db.partner_accounts.find_one({"id": data.partner_id})
    collection = db.partner_accounts
    
    if not partner:
        partner = await db.restaurant_accounts.find_one({"id": data.partner_id})
        collection = db.restaurant_accounts
    
    if not partner:
        raise HTTPException(status_code=404, detail="Händler nicht gefunden")
    
    from datetime import timedelta
    premium_until = datetime.now(timezone.utc) + timedelta(days=30 * data.months)
    
    await collection.update_one(
        {"id": data.partner_id},
        {
            "$set": {
                "is_premium": True,
                "premium_until": premium_until.isoformat(),
                "premium_started": datetime.now(timezone.utc).isoformat(),
                "premium_price": data.price,
                "premium_months": data.months,
                "premium_total_paid": data.price * data.months,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    # Log premium purchase
    await db.premium_purchases.insert_one({
        "id": str(uuid.uuid4()),
        "partner_id": data.partner_id,
        "partner_name": partner.get("business_name", partner.get("restaurant_name")),
        "months": data.months,
        "price_per_month": data.price,
        "total_price": data.price * data.months,
        "premium_until": premium_until.isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    logger.info(f"Partner {data.partner_id} set as Premium for {data.months} months at €{data.price}/month")
    
    return {
        "success": True,
        "message": f"Partner ist jetzt Premium bis {premium_until.strftime('%d.%m.%Y')} (€{data.price * data.months} total)",
        "premium_until": premium_until.isoformat(),
        "total_price": data.price * data.months
    }


@router.post("/admin/remove-premium/{partner_id}")
async def admin_remove_premium(partner_id: str):
    """Admin: Premium-Status entfernen"""
    partner = await db.partner_accounts.find_one({"id": partner_id})
    collection = db.partner_accounts
    
    if not partner:
        partner = await db.restaurant_accounts.find_one({"id": partner_id})
        collection = db.restaurant_accounts
    
    if not partner:
        raise HTTPException(status_code=404, detail="Händler nicht gefunden")
    
    await collection.update_one(
        {"id": partner_id},
        {
            "$set": {
                "is_premium": False,
                "premium_until": None,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    return {"success": True, "message": "Premium-Status entfernt"}


@router.get("/merchant/{partner_id}/vouchers")
async def get_merchant_vouchers(partner_id: str):
    """Alle aktiven Gutschein-Auktionen eines Händlers abrufen"""
    vouchers = await db.merchant_voucher_auctions.find(
        {"partner_id": partner_id, "status": "active"},
        {"_id": 0}
    ).sort("end_time", 1).to_list(50)
    
    return {
        "vouchers": vouchers,
        "count": len(vouchers)
    }


@router.post("/admin/create")
async def admin_create_merchant_voucher(voucher: CreateMerchantVoucher):
    """Admin erstellt einen Gutschein für einen Händler (erstellt Auktion)"""
    # Verify partner exists
    partner = await db.partner_accounts.find_one({"id": voucher.partner_id})
    if not partner:
        partner = await db.restaurant_accounts.find_one({"id": voucher.partner_id})
    
    if not partner:
        raise HTTPException(status_code=404, detail="Partner nicht gefunden")
    
    # Create voucher auction
    voucher_id = str(uuid.uuid4())
    auction_id = f"mv-{voucher_id[:8]}"
    
    now = datetime.now(timezone.utc)
    end_time = now + timedelta(hours=voucher.duration_hours)
    
    voucher_auction = {
        "id": voucher_id,
        "auction_id": auction_id,
        "partner_id": voucher.partner_id,
        "partner_name": partner.get("business_name", partner.get("restaurant_name", "Partner")),
        "name": voucher.name,
        "description": voucher.description,
        "voucher_value": voucher.voucher_value,
        "start_price": voucher.start_price,
        "current_price": voucher.start_price,
        "total_bids": 0,
        "status": "active",
        "created_at": now.isoformat(),
        "end_time": end_time.isoformat(),
        "quantity": voucher.quantity,
        "winner_id": None,
        "winner_name": None,
        "redeemed": False,
        "voucher_code": None,  # Generated when won
        "auction_type": "merchant_voucher"
    }
    
    await db.merchant_voucher_auctions.insert_one(voucher_auction)
    
    # Also create a regular auction entry for the bidding system
    auction_entry = {
        "id": auction_id,
        "product_id": voucher_id,
        "product_name": f"{voucher.name} (€{voucher.voucher_value} Gutschein)",
        "auction_type": "merchant_voucher",
        "is_voucher": True,
        "voucher_value": voucher.voucher_value,
        "merchant_voucher_id": voucher_id,
        "partner_id": voucher.partner_id,
        "partner_name": partner.get("business_name", partner.get("restaurant_name", "Partner")),
        "start_price": voucher.start_price,
        "current_price": voucher.start_price,
        "total_bids": 0,
        "bid_history": [],
        "status": "active",
        "created_at": now.isoformat(),
        "end_time": end_time.isoformat(),
        "category": "merchant_voucher",
        "restaurant_info": {
            "name": partner.get("business_name", partner.get("restaurant_name")),
            "voucher_value": voucher.voucher_value,
            "category": partner.get("business_type", "other")
        }
    }
    
    await db.auctions.insert_one(auction_entry)
    
    logger.info(f"Admin created merchant voucher: {voucher.name} (€{voucher.voucher_value}) for {partner.get('business_name')}")
    
    return {
        "success": True,
        "message": f"Gutschein-Auktion erstellt: {voucher.name}",
        "voucher_id": voucher_id,
        "auction_id": auction_id,
        "end_time": end_time.isoformat()
    }


@router.get("/admin/all")
async def admin_get_all_merchant_vouchers():
    """Admin: Alle Händler-Gutschein-Auktionen abrufen"""
    vouchers = await db.merchant_voucher_auctions.find(
        {},
        {"_id": 0}
    ).sort("created_at", -1).to_list(200)
    
    return {
        "vouchers": vouchers,
        "total": len(vouchers)
    }


@router.post("/redeem")
async def redeem_merchant_voucher(data: RedeemVoucher, user: dict = Depends(get_current_user)):
    """Gewinner löst den Gutschein beim Händler ein"""
    # Find the voucher by code
    voucher = await db.merchant_voucher_auctions.find_one({
        "voucher_code": data.voucher_code,
        "partner_id": data.partner_id,
        "status": "won",
        "redeemed": False
    })
    
    if not voucher:
        raise HTTPException(status_code=404, detail="Gutschein nicht gefunden oder bereits eingelöst")
    
    # Verify user is the winner
    if voucher.get("winner_id") != user["id"]:
        raise HTTPException(status_code=403, detail="Dieser Gutschein gehört nicht Ihnen")
    
    # Mark as redeemed
    await db.merchant_voucher_auctions.update_one(
        {"id": voucher["id"]},
        {
            "$set": {
                "redeemed": True,
                "redeemed_at": datetime.now(timezone.utc).isoformat(),
                "redeemed_by_partner": data.partner_id
            }
        }
    )
    
    logger.info(f"Voucher {data.voucher_code} redeemed by user {user['id']} at partner {data.partner_id}")
    
    return {
        "success": True,
        "message": "Gutschein erfolgreich eingelöst!",
        "voucher_value": voucher["voucher_value"],
        "partner_name": voucher["partner_name"]
    }


@router.get("/my-vouchers")
async def get_my_won_vouchers(user: dict = Depends(get_current_user)):
    """Gewonnene Gutscheine des Nutzers abrufen"""
    vouchers = await db.merchant_voucher_auctions.find(
        {"winner_id": user["id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    
    return {
        "vouchers": vouchers,
        "count": len(vouchers)
    }


@router.post("/partner/verify-code")
async def partner_verify_voucher_code(voucher_code: str, partner_id: str):
    """Partner prüft einen Gutschein-Code vor der Einlösung"""
    voucher = await db.merchant_voucher_auctions.find_one({
        "voucher_code": voucher_code,
        "partner_id": partner_id
    }, {"_id": 0})
    
    if not voucher:
        return {
            "valid": False,
            "message": "Gutschein nicht gefunden"
        }
    
    if voucher.get("redeemed"):
        return {
            "valid": False,
            "message": "Gutschein bereits eingelöst",
            "redeemed_at": voucher.get("redeemed_at")
        }
    
    if voucher.get("status") != "won":
        return {
            "valid": False,
            "message": "Gutschein wurde noch nicht gewonnen"
        }
    
    return {
        "valid": True,
        "voucher_value": voucher["voucher_value"],
        "voucher_name": voucher["name"],
        "winner_name": voucher.get("winner_name", "Gewinner"),
        "won_at": voucher.get("won_at"),
        "message": "Gutschein gültig - kann eingelöst werden"
    }
