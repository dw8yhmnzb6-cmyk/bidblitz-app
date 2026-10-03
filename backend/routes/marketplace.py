"""
BidBlitz V2 - Marketplace System
Like eBay Kleinanzeigen - Users can post, browse, and buy items.
Wallet-based payments with escrow support.
Premium listings with boost functionality.
"""

import secrets
import logging
import hashlib
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from typing import Optional, List
from bson import ObjectId

from core.database import db
from core.security import get_current_user
from core.config import TEST_MODE
from core.payment_engine import debit_wallet, credit_wallet, transfer_between_wallets, TransactionType

router = APIRouter(prefix="/api/marketplace", tags=["Marketplace"])
logger = logging.getLogger("bidblitz.marketplace")


def _require_marketplace_kyc(user: dict, *, action: str) -> None:
    if TEST_MODE or user.get("role") == "admin":
        return
    if user.get("kyc_status") != "approved":
        raise HTTPException(
            status_code=403,
            detail={
                "error": "kyc_required",
                "message": f"KYC-Verifizierung erforderlich, um im Marketplace {action}.",
                "kyc_status": user.get("kyc_status", "not_started"),
            },
        )

# ══════════════════════════════════════════════════════════════════════════════
# CONFIGURATION
# ══════════════════════════════════════════════════════════════════════════════

CATEGORIES = [
    "electronics", "fashion", "home", "vehicles", "sports", 
    "toys", "books", "music", "garden", "pets", "services", "other"
]

CATEGORY_LABELS = {
    "electronics": "Elektronik",
    "fashion": "Mode & Kleidung",
    "home": "Haus & Garten",
    "vehicles": "Fahrzeuge",
    "sports": "Sport & Freizeit",
    "toys": "Spielzeug & Baby",
    "books": "Bücher & Medien",
    "music": "Musik & Instrumente",
    "garden": "Garten & Pflanzen",
    "pets": "Haustiere & Zubehör",
    "services": "Dienstleistungen",
    "other": "Sonstiges",
}

# Boost pricing - Updated per user request
BOOST_PRICES = {
    "24h": {"price": 2.99, "duration_days": 1, "label": "24 Stunden Boost"},
    "7d": {"price": 9.99, "duration_days": 7, "label": "7 Tage Boost"},
}

# VIP pricing
VIP_PRICE = 4.99

# Platform commission on sales
PLATFORM_COMMISSION = 0.05  # 5%


def _require_marketplace_idempotency_key(body_key: Optional[str], request: Request) -> str:
    key = (body_key or request.headers.get("Idempotency-Key") or "").strip()
    if not 8 <= len(key) <= 200:
        raise HTTPException(status_code=400, detail="Idempotency-Key erforderlich")
    return f"marketplace-buy:{key}"


def _require_marketplace_action_idempotency_key(body_key: Optional[str], request: Request, *, action: str) -> str:
    key = (body_key or request.headers.get("Idempotency-Key") or "").strip()
    if not 8 <= len(key) <= 200:
        raise HTTPException(status_code=400, detail="Idempotency-Key erforderlich")
    return f"marketplace-{action}:{key}"


async def _credit_marketplace_promo_revenue_once(operation_id: str, source: str, amount: float, now: datetime) -> None:
    if amount <= 0:
        return
    day = now.strftime("%Y-%m-%d")
    field = f"by_source.{source}"
    existing = await db.platform_revenue.find_one(
        {"date": day},
        {"_id": 0, "marketplace_promo_ids": 1},
    )
    if not existing:
        try:
            await db.platform_revenue.insert_one({
                "revenue_id": secrets.token_hex(8),
                "date": day,
                "total": amount,
                "by_source": {source: amount},
                "marketplace_promo_ids": [operation_id],
                "created_at": now.isoformat(),
                "updated_at": now.isoformat(),
            })
            return
        except Exception:
            pass

    await db.platform_revenue.update_one(
        {"date": day, "marketplace_promo_ids": {"$ne": operation_id}},
        {
            "$inc": {"total": amount, field: amount},
            "$addToSet": {"marketplace_promo_ids": operation_id},
            "$set": {"updated_at": now.isoformat()},
        },
    )


async def _credit_marketplace_revenue_once(order_id: str, amount: float, now: datetime) -> None:
    if amount <= 0:
        return
    day = now.strftime("%Y-%m-%d")
    existing = await db.platform_revenue.find_one({"date": day}, {"_id": 0, "marketplace_order_ids": 1})
    if not existing:
        try:
            await db.platform_revenue.insert_one({
                "revenue_id": secrets.token_hex(8),
                "date": day,
                "total": amount,
                "by_source": {"marketplace_commission": amount},
                "marketplace_order_ids": [order_id],
                "created_at": now.isoformat(),
                "updated_at": now.isoformat(),
            })
            return
        except Exception:
            pass

    await db.platform_revenue.update_one(
        {"date": day, "marketplace_order_ids": {"$ne": order_id}},
        {
            "$inc": {"total": amount, "by_source.marketplace_commission": amount},
            "$addToSet": {"marketplace_order_ids": order_id},
            "$set": {"updated_at": now.isoformat()},
        },
    )


async def _marketplace_platform_user_id() -> str:
    import os

    email = os.environ.get("PLATFORM_POOL_EMAIL", "admin@bidblitz.ae").strip().lower()
    platform = await db.users.find_one({"email": email}, {"_id": 1})
    if not platform:
        raise HTTPException(
            status_code=503,
            detail="Marketplace-Escrow ist nicht konfiguriert. Es wird kein Käufergeld bewegt.",
        )
    return str(platform["_id"])


# ══════════════════════════════════════════════════════════════════════════════
# SCHEMAS
# ══════════════════════════════════════════════════════════════════════════════

class CreateListingRequest(BaseModel):
    title: str = Field(..., min_length=3, max_length=100)
    description: str = Field(..., min_length=10, max_length=5000)
    price: float = Field(..., gt=0, le=100000)
    category: str
    images: List[str] = Field(default=[])
    location: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    negotiable: bool = False
    shipping_available: bool = False
    shipping_cost: Optional[float] = Field(default=None, ge=0, le=100000)


class UpdateListingRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = Field(default=None, gt=0, le=100000)
    category: Optional[str] = None
    images: Optional[List[str]] = None
    location: Optional[str] = None
    negotiable: Optional[bool] = None
    shipping_available: Optional[bool] = None
    shipping_cost: Optional[float] = Field(default=None, ge=0, le=100000)
    status: Optional[str] = None


class BuyRequest(BaseModel):
    listing_id: str
    use_shipping: bool = False
    message: Optional[str] = None
    idempotency_key: Optional[str] = None


class MarketplaceShipRequest(BaseModel):
    carrier: str = Field(..., min_length=2, max_length=120)
    tracking_number: str = Field(..., min_length=4, max_length=180)
    idempotency_key: Optional[str] = None


class MarketplaceOrderActionRequest(BaseModel):
    idempotency_key: Optional[str] = None
    note: Optional[str] = Field(default=None, max_length=500)


class ContactSellerRequest(BaseModel):
    listing_id: str
    message: str = Field(..., min_length=5, max_length=1000)


class BoostListingRequest(BaseModel):
    listing_id: str
    boost_type: str = Field(..., description="24h or 7d")
    idempotency_key: Optional[str] = None


# ══════════════════════════════════════════════════════════════════════════════
# STATIC ROUTES (MUST BE BEFORE DYNAMIC /{listing_id})
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/boost-options")
async def get_boost_options():
    """Get available boost options."""
    return {
        "options": [
            {"id": k, **v}
            for k, v in BOOST_PRICES.items()
        ],
        "vip_price": VIP_PRICE
    }


@router.get("/categories")
async def get_categories():
    """Get all categories (public)."""
    return {
        "categories": [
            {"id": k, "label": v}
            for k, v in CATEGORY_LABELS.items()
        ]
    }


# ══════════════════════════════════════════════════════════════════════════════
# CREATE LISTING
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/create")
async def create_listing(req: CreateListingRequest, request: Request):
    """Create a new marketplace listing."""
    user = await get_current_user(request)
    _require_marketplace_kyc(user, action="zu verkaufen")
    user_id = str(user["_id"])
    
    # Validate category
    if req.category not in CATEGORIES:
        raise HTTPException(status_code=400, detail=f"Ungültige Kategorie. Wähle aus: {', '.join(CATEGORIES)}")
    
    # Limit active listings per user
    active_count = await db.marketplace_listings.count_documents({
        "seller_id": user_id,
        "status": "active"
    })
    if active_count >= 50:
        raise HTTPException(status_code=400, detail="Maximale Anzahl aktiver Anzeigen erreicht (50)")
    
    now = datetime.now(timezone.utc)
    listing_id = secrets.token_hex(8)
    
    listing = {
        "listing_id": listing_id,
        "seller_id": user_id,
        "seller_name": user.get("name", ""),
        "seller_email": user.get("email", ""),
        "title": req.title,
        "description": req.description,
        "price": round(req.price, 2),
        "category": req.category,
        "category_label": CATEGORY_LABELS.get(req.category, req.category),
        "images": req.images[:10],  # Max 10 images
        "location": req.location or "",
        "coordinates": {"lat": req.lat, "lng": req.lng} if req.lat and req.lng else None,
        "negotiable": req.negotiable,
        "shipping_available": req.shipping_available,
        "shipping_cost": req.shipping_cost if req.shipping_available else None,
        "status": "active",
        "views": 0,
        "favorites": 0,
        "messages_count": 0,
        "boost": None,
        "created_at": now.isoformat(),
        "updated_at": now.isoformat(),
    }
    
    await db.marketplace_listings.insert_one(listing)
    listing.pop("_id", None)
    
    logger.info(f"New listing created: {listing_id} by {user.get('email')}")
    
    return {
        "ok": True,
        "listing": listing,
        "message": "Anzeige erfolgreich erstellt!",
    }


# ══════════════════════════════════════════════════════════════════════════════
# BROWSE / SEARCH LISTINGS
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/list")
async def list_listings(
    category: Optional[str] = None,
    search: Optional[str] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    sort: str = "newest",  # newest, price_low, price_high
    page: int = 1,
    limit: int = 20,
):
    """
    Browse marketplace listings (public) - OPTIMIZED.
    
    Uses DB-level sorting with indexes for better performance.
    """
    from core.performance import query_cache
    
    query = {"status": "active"}
    
    if category and category in CATEGORIES:
        query["category"] = category
    
    if search:
        # Use text index if available, fallback to regex
        query["$or"] = [
            {"title": {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}},
        ]
    
    if min_price is not None:
        query["price"] = query.get("price", {})
        query["price"]["$gte"] = min_price
    if max_price is not None:
        query["price"] = query.get("price", {})
        query["price"]["$lte"] = max_price
    
    skip = (page - 1) * limit
    
    # Determine sort order
    if sort == "price_low":
        sort_order = [("price", 1), ("created_at", -1)]
    elif sort == "price_high":
        sort_order = [("price", -1), ("created_at", -1)]
    else:  # newest
        sort_order = [("created_at", -1)]
    
    # Use projection to reduce data transfer - exclude large fields
    projection = {
        "_id": 0, 
        "seller_email": 0, 
        "description": 0  # Don't need full description in list view
    }
    
    # Get listings with DB-level pagination (much more efficient)
    listings = await db.marketplace_listings.find(
        query, projection
    ).sort(sort_order).skip(skip).limit(limit).to_list(limit)
    
    # Post-process: sort boosted/VIP to top (lightweight in-memory for small result set)
    now = datetime.now(timezone.utc).isoformat()
    
    def boost_priority(item):
        boost = item.get("boost")
        has_active_boost = boost and boost.get("expires_at", "") > now
        is_vip = item.get("is_vip", False)
        return (not has_active_boost, not is_vip)
    
    listings = sorted(listings, key=boost_priority)
    
    # Cache total count for 60 seconds
    count_cache_key = f"mkt_count:{category or 'all'}:{search or 'none'}:{min_price}:{max_price}"
    total = query_cache.get(count_cache_key)
    if total is None:
        total = await db.marketplace_listings.count_documents(query)
        query_cache.set(count_cache_key, total, 60)
    
    return {
        "listings": listings,
        "total": total,
        "page": page,
        "pages": (total + limit - 1) // limit,
        "categories": [{"id": k, "label": v} for k, v in CATEGORY_LABELS.items()],
    }


@router.get("/catalog/{listing_id}")
async def get_listing(listing_id: str):
    """Get listing details (public)."""
    listing = await db.marketplace_listings.find_one(
        {"listing_id": listing_id},
        {"_id": 0}
    )
    if not listing:
        raise HTTPException(status_code=404, detail="Anzeige nicht gefunden")
    
    # Increment views
    await db.marketplace_listings.update_one(
        {"listing_id": listing_id},
        {"$inc": {"views": 1}}
    )
    
    # Get seller info
    seller = await db.users.find_one(
        {"_id": ObjectId(listing["seller_id"])},
        {"_id": 0, "name": 1, "created_at": 1}
    )
    
    listing["views"] += 1
    listing["seller"] = {
        "name": seller.get("name", "") if seller else listing.get("seller_name", ""),
        "member_since": seller.get("created_at", "") if seller else "",
    }
    
    return listing


# ══════════════════════════════════════════════════════════════════════════════
# UPDATE / DELETE LISTING
# ══════════════════════════════════════════════════════════════════════════════

@router.put("/{listing_id}")
async def update_listing(listing_id: str, req: UpdateListingRequest, request: Request):
    """Update own listing."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    listing = await db.marketplace_listings.find_one({"listing_id": listing_id})
    if not listing:
        raise HTTPException(status_code=404, detail="Anzeige nicht gefunden")
    
    if listing["seller_id"] != user_id:
        raise HTTPException(status_code=403, detail="Nicht autorisiert")
    if listing.get("status") not in {"active", "inactive"}:
        raise HTTPException(
            status_code=409,
            detail="Anzeige ist in einem Kauf-/Verkaufsprozess und kann nicht bearbeitet werden",
        )
    
    update = {"updated_at": datetime.now(timezone.utc).isoformat()}
    
    if req.title:
        update["title"] = req.title
    if req.description:
        update["description"] = req.description
    if req.price is not None:
        update["price"] = round(req.price, 2)
    if req.category and req.category in CATEGORIES:
        update["category"] = req.category
        update["category_label"] = CATEGORY_LABELS.get(req.category, req.category)
    if req.images is not None:
        update["images"] = req.images[:10]
    if req.location is not None:
        update["location"] = req.location
    if req.negotiable is not None:
        update["negotiable"] = req.negotiable
    if req.shipping_available is not None:
        update["shipping_available"] = req.shipping_available
        if not req.shipping_available:
            update["shipping_cost"] = None
    if req.shipping_cost is not None:
        update["shipping_cost"] = req.shipping_cost
    if req.status and req.status in ["active", "inactive"]:
        update["status"] = req.status
    
    await db.marketplace_listings.update_one(
        {"listing_id": listing_id},
        {"$set": update}
    )
    
    updated = await db.marketplace_listings.find_one({"listing_id": listing_id}, {"_id": 0})
    return {"ok": True, "listing": updated}


@router.delete("/{listing_id}")
async def delete_listing(listing_id: str, request: Request):
    """Delete own listing."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    is_admin = user.get("role") == "admin"
    
    listing = await db.marketplace_listings.find_one({"listing_id": listing_id})
    if not listing:
        raise HTTPException(status_code=404, detail="Anzeige nicht gefunden")
    
    if listing["seller_id"] != user_id and not is_admin:
        raise HTTPException(status_code=403, detail="Nicht autorisiert")
    if not is_admin and listing.get("status") not in {"active", "inactive"}:
        raise HTTPException(
            status_code=409,
            detail="Anzeige ist in einem Kauf-/Verkaufsprozess und kann nicht gelöscht werden",
        )
    
    await db.marketplace_listings.delete_one({"listing_id": listing_id})
    
    return {"ok": True, "deleted": listing_id}


# ══════════════════════════════════════════════════════════════════════════════
# BUY ITEM (Wallet Payment)
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/buy")
async def buy_item(req: BuyRequest, request: Request):
    """Fund one marketplace order into platform escrow exactly once."""
    user = await get_current_user(request)
    _require_marketplace_kyc(user, action="zu kaufen")
    buyer_id = str(user["_id"])
    idempotency_key = _require_marketplace_idempotency_key(req.idempotency_key, request)
    purchase_payload = {
        "listing_id": req.listing_id,
        "use_shipping": bool(req.use_shipping),
        "message": (req.message or "").strip() or None,
    }

    existing_order = await db.marketplace_orders.find_one(
        {"buyer_id": buyer_id, "idempotency_key": idempotency_key},
        {"_id": 0},
    )
    if existing_order:
        if existing_order.get("purchase_payload") and existing_order.get("purchase_payload") != purchase_payload:
            raise HTTPException(status_code=409, detail="Idempotency-Key wurde mit anderen Kaufdaten verwendet")
        order_id = existing_order["order_id"]
        status = str(existing_order.get("status") or "")
        if status in {
            "awaiting_shipment", "awaiting_pickup", "shipped", "ready_for_pickup",
            "settling", "completed",
        }:
            fresh_user = await db.users.find_one({"_id": user["_id"]}, {"balance": 1, "_id": 0}) or {}
            return {
                "ok": True,
                "order": existing_order,
                "new_balance": round(float(fresh_user.get("balance") or 0), 2),
                "message": "Kauf bereits im Escrow verarbeitet.",
                "replayed": True,
            }
        if status in {"refunded", "cancelled"}:
            raise HTTPException(status_code=409, detail="Dieser Kaufversuch wurde storniert. Bitte starte einen neuen Kauf.")
        if status == "reconciliation_required":
            raise HTTPException(status_code=409, detail="Dieser Kauf benötigt manuelle Abstimmung.")
    else:
        key_hash = hashlib.sha256(f"{buyer_id}:{idempotency_key}".encode("utf-8")).hexdigest()[:20]
        order_id = f"MKO-{key_hash}"

    listing = await db.marketplace_listings.find_one({"listing_id": req.listing_id})
    if not listing:
        raise HTTPException(status_code=404, detail="Anzeige nicht gefunden")
    if listing.get("seller_id") == buyer_id:
        raise HTTPException(status_code=400, detail="Du kannst deine eigene Anzeige nicht kaufen")
    if req.use_shipping and not listing.get("shipping_available"):
        raise HTTPException(status_code=400, detail="Versand ist für diese Anzeige nicht verfügbar")

    key_hash = hashlib.sha256(f"{buyer_id}:{idempotency_key}".encode("utf-8")).hexdigest()[:20]
    if existing_order:
        expected_price = round(float(existing_order.get("item_price") or 0), 2)
        expected_shipping = round(float(existing_order.get("shipping_cost") or 0), 2)
        current_shipping = (
            round(float(listing.get("shipping_cost") or 0), 2)
            if req.use_shipping and listing.get("shipping_available")
            else 0.0
        )
        if round(float(listing.get("price") or 0), 2) != expected_price or current_shipping != expected_shipping:
            raise HTTPException(status_code=409, detail="Preis oder Versandkosten haben sich geändert. Bitte starte einen neuen Kauf.")

    listing_is_owned_by_attempt = (
        listing.get("status") == "processing"
        and listing.get("purchase_claim_key") == key_hash
        and listing.get("purchase_claim_buyer_id") == buyer_id
    )
    listing_is_sold_to_attempt = (
        listing.get("status") == "sold"
        and listing.get("order_id") == order_id
        and listing.get("sold_to") == buyer_id
    )
    if not listing_is_owned_by_attempt and not listing_is_sold_to_attempt:
        claim = await db.marketplace_listings.update_one(
            {"listing_id": req.listing_id, "status": "active"},
            {"$set": {
                "status": "processing",
                "purchase_claim_key": key_hash,
                "purchase_claim_buyer_id": buyer_id,
                "purchase_claimed_at": datetime.now(timezone.utc).isoformat(),
            }},
        )
        if claim.modified_count != 1:
            current = await db.marketplace_listings.find_one({"listing_id": req.listing_id}, {"_id": 0}) or {}
            if not (
                current.get("status") == "sold"
                and current.get("order_id") == order_id
                and current.get("sold_to") == buyer_id
            ):
                raise HTTPException(status_code=409, detail="Anzeige wird gerade gekauft oder ist nicht mehr verfügbar")
        listing = await db.marketplace_listings.find_one({"listing_id": req.listing_id}, {"_id": 0}) or listing

    seller_id = str(listing["seller_id"])
    item_price = round(float(listing["price"]), 2)
    shipping_cost = (
        round(float(listing.get("shipping_cost") or 0), 2)
        if req.use_shipping and listing.get("shipping_available")
        else 0.0
    )
    total_price = round(item_price + shipping_cost, 2)
    commission = round(item_price * PLATFORM_COMMISSION, 2)
    seller_amount = round(item_price - commission + shipping_cost, 2)
    now = datetime.now(timezone.utc)

    order = existing_order or {
        "order_id": order_id,
        "listing_id": req.listing_id,
        "buyer_id": buyer_id,
        "buyer_name": user.get("name", ""),
        "seller_id": seller_id,
        "seller_name": listing.get("seller_name", ""),
        "item_title": listing["title"],
        "item_price": item_price,
        "shipping_cost": shipping_cost,
        "total_price": total_price,
        "commission": commission,
        "seller_amount": seller_amount,
        "use_shipping": bool(req.use_shipping),
        "message": purchase_payload["message"],
        "purchase_payload": purchase_payload,
        "status": "escrow_pending",
        "payment_status": "pending",
        "escrow_status": "pending",
        "idempotency_key": idempotency_key,
        "created_at": now.isoformat(),
    }
    await db.marketplace_orders.update_one(
        {"order_id": order_id, "buyer_id": buyer_id},
        {"$setOnInsert": order},
        upsert=True,
    )

    platform_user_id = await _marketplace_platform_user_id()
    escrow_result = await transfer_between_wallets(
        from_user_id=buyer_id,
        to_user_id=platform_user_id,
        amount=total_price,
        tx_type=TransactionType.PAYMENT,
        description=f"Marketplace Escrow: {listing['title'][:50]}",
        reference=f"MKT-ESC-{order_id[-12:]}",
        metadata={
            "listing_id": req.listing_id,
            "order_id": order_id,
            "item_price": item_price,
            "shipping_cost": shipping_cost,
            "escrow": True,
        },
        idempotency_key=f"marketplace-escrow:{order_id}",
    )
    if not escrow_result.success:
        await db.marketplace_orders.update_one(
            {"order_id": order_id},
            {"$set": {
                "status": "payment_failed",
                "payment_status": str(getattr(escrow_result.status, "value", escrow_result.status)),
                "failure_reason": escrow_result.error,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }},
        )
        await db.marketplace_listings.update_one(
            {"listing_id": req.listing_id, "purchase_claim_key": key_hash, "status": "processing"},
            {"$set": {"status": "active"}, "$unset": {
                "purchase_claim_key": "",
                "purchase_claim_buyer_id": "",
                "purchase_claimed_at": "",
            }},
        )
        raise HTTPException(status_code=400, detail=escrow_result.error or "Escrow-Zahlung fehlgeschlagen")

    funded_at = datetime.now(timezone.utc).isoformat()
    next_status = "awaiting_shipment" if req.use_shipping else "awaiting_pickup"
    order_update = await db.marketplace_orders.update_one(
        {
            "order_id": order_id,
            "buyer_id": buyer_id,
            "status": {"$in": ["escrow_pending", "payment_failed"]},
        },
        {"$set": {
            "status": next_status,
            "payment_status": "paid",
            "escrow_status": "funded",
            "escrow_transaction_id": escrow_result.transaction_id,
            "escrow_platform_user_id": platform_user_id,
            "funded_at": funded_at,
            "updated_at": funded_at,
        }},
    )
    current_order = await db.marketplace_orders.find_one({"order_id": order_id}, {"_id": 0}) or order
    if order_update.modified_count != 1 and current_order.get("escrow_status") != "funded":
        await db.marketplace_orders.update_one(
            {"order_id": order_id},
            {"$set": {
                "status": "reconciliation_required",
                "escrow_transaction_id": escrow_result.transaction_id,
                "updated_at": funded_at,
            }},
        )
        raise HTTPException(status_code=500, detail="Escrow finanziert; Bestellstatus benötigt Abstimmung")

    listing_update = await db.marketplace_listings.update_one(
        {
            "listing_id": req.listing_id,
            "status": "processing",
            "purchase_claim_key": key_hash,
        },
        {
            "$set": {
                "status": "sold",
                "sold_at": funded_at,
                "sold_to": buyer_id,
                "order_id": order_id,
            },
            "$unset": {
                "purchase_claim_key": "",
                "purchase_claim_buyer_id": "",
                "purchase_claimed_at": "",
            },
        },
    )
    if listing_update.modified_count != 1:
        current_listing = await db.marketplace_listings.find_one({"listing_id": req.listing_id}, {"_id": 0}) or {}
        if not (
            current_listing.get("status") == "sold"
            and current_listing.get("order_id") == order_id
            and current_listing.get("sold_to") == buyer_id
        ):
            await db.marketplace_orders.update_one(
                {"order_id": order_id},
                {"$set": {"status": "reconciliation_required", "failure_reason": "listing_finalize_failed"}},
            )
            raise HTTPException(status_code=500, detail="Escrow finanziert; Listing-Abschluss benötigt Abstimmung")

    notification_id = f"MKT-SALE-{order_id}"
    await db.notifications.update_one(
        {"id": notification_id},
        {"$setOnInsert": {
            "id": notification_id,
            "user_id": seller_id,
            "type": "marketplace_sale",
            "title": "Artikel verkauft – Auszahlung im Escrow",
            "message": (
                f"'{listing['title'][:30]}' wurde verkauft. "
                + ("Bitte versenden; Auszahlung folgt nach Empfangsbestätigung." if req.use_shipping
                   else "Bitte Übergabe vorbereiten; Auszahlung folgt nach Abholbestätigung.")
            ),
            "data": {"order_id": order_id, "listing_id": req.listing_id},
            "read": False,
            "created_at": funded_at,
        }},
        upsert=True,
    )

    final_order = await db.marketplace_orders.find_one({"order_id": order_id}, {"_id": 0}) or current_order
    return {
        "ok": True,
        "order": final_order,
        "new_balance": escrow_result.new_balance,
        "message": (
            f"€{total_price:.2f} sicher im Escrow. "
            + ("Verkäufer muss den Versand bestätigen." if req.use_shipping else "Warte auf die Abholfreigabe des Verkäufers.")
        ),
        "replayed": bool(escrow_result.idempotent_replay),
    }


@router.post("/orders/{order_id}/ship")
async def ship_marketplace_order(order_id: str, req: MarketplaceShipRequest, request: Request):
    seller = await get_current_user(request)
    _require_marketplace_kyc(seller, action="zu versenden")
    seller_id = str(seller["_id"])
    order = await db.marketplace_orders.find_one({"order_id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Bestellung nicht gefunden")
    if order.get("seller_id") != seller_id:
        raise HTTPException(status_code=403, detail="Nicht deine Bestellung")
    if not order.get("use_shipping"):
        raise HTTPException(status_code=409, detail="Diese Bestellung ist zur Abholung vorgesehen")

    carrier = req.carrier.strip()
    tracking_number = req.tracking_number.strip()
    action_key = _require_marketplace_action_idempotency_key(
        req.idempotency_key,
        request,
        action="ship",
    )
    if order.get("status") == "shipped":
        if order.get("carrier") == carrier and order.get("tracking_number") == tracking_number:
            return {"ok": True, "order": order, "replayed": True}
        raise HTTPException(status_code=409, detail="Bestellung wurde bereits mit anderen Versanddaten versendet")
    if order.get("status") != "awaiting_shipment" or order.get("escrow_status") != "funded":
        raise HTTPException(status_code=409, detail="Bestellung ist nicht versandbereit")

    now = datetime.now(timezone.utc).isoformat()
    changed = await db.marketplace_orders.update_one(
        {
            "order_id": order_id,
            "seller_id": seller_id,
            "status": "awaiting_shipment",
            "escrow_status": "funded",
        },
        {"$set": {
            "status": "shipped",
            "carrier": carrier,
            "tracking_number": tracking_number,
            "shipping_action_key_hash": hashlib.sha256(action_key.encode("utf-8")).hexdigest()[:20],
            "shipped_at": now,
            "updated_at": now,
        }},
    )
    if changed.modified_count != 1:
        raise HTTPException(status_code=409, detail="Versandstatus wurde parallel geändert")

    await db.notifications.update_one(
        {"id": f"MKT-SHIPPED-{order_id}"},
        {"$setOnInsert": {
            "id": f"MKT-SHIPPED-{order_id}",
            "user_id": order.get("buyer_id"),
            "type": "marketplace_shipped",
            "title": "Marketplace-Bestellung versendet",
            "message": f"Carrier: {carrier} · Tracking: {tracking_number}",
            "data": {"order_id": order_id, "carrier": carrier, "tracking_number": tracking_number},
            "read": False,
            "created_at": now,
        }},
        upsert=True,
    )
    fresh = await db.marketplace_orders.find_one({"order_id": order_id}, {"_id": 0}) or order
    return {"ok": True, "order": fresh, "replayed": False}


@router.post("/orders/{order_id}/ready-pickup")
async def ready_marketplace_pickup(order_id: str, req: MarketplaceOrderActionRequest, request: Request):
    seller = await get_current_user(request)
    _require_marketplace_kyc(seller, action="zur Abholung freizugeben")
    seller_id = str(seller["_id"])
    order = await db.marketplace_orders.find_one({"order_id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Bestellung nicht gefunden")
    if order.get("seller_id") != seller_id:
        raise HTTPException(status_code=403, detail="Nicht deine Bestellung")
    if order.get("use_shipping"):
        raise HTTPException(status_code=409, detail="Diese Bestellung ist für Versand vorgesehen")
    if order.get("status") == "ready_for_pickup":
        return {"ok": True, "order": order, "replayed": True}
    if order.get("status") != "awaiting_pickup" or order.get("escrow_status") != "funded":
        raise HTTPException(status_code=409, detail="Bestellung ist nicht für Abholung bereit")

    action_key = _require_marketplace_action_idempotency_key(
        req.idempotency_key,
        request,
        action="ready-pickup",
    )
    now = datetime.now(timezone.utc).isoformat()
    changed = await db.marketplace_orders.update_one(
        {
            "order_id": order_id,
            "seller_id": seller_id,
            "status": "awaiting_pickup",
            "escrow_status": "funded",
        },
        {"$set": {
            "status": "ready_for_pickup",
            "pickup_action_key_hash": hashlib.sha256(action_key.encode("utf-8")).hexdigest()[:20],
            "ready_for_pickup_at": now,
            "updated_at": now,
        }},
    )
    if changed.modified_count != 1:
        raise HTTPException(status_code=409, detail="Abholstatus wurde parallel geändert")

    await db.notifications.update_one(
        {"id": f"MKT-PICKUP-{order_id}"},
        {"$setOnInsert": {
            "id": f"MKT-PICKUP-{order_id}",
            "user_id": order.get("buyer_id"),
            "type": "marketplace_ready_pickup",
            "title": "Marketplace-Abholung bereit",
            "message": "Der Verkäufer hat den Artikel zur Abholung freigegeben.",
            "data": {"order_id": order_id},
            "read": False,
            "created_at": now,
        }},
        upsert=True,
    )
    fresh = await db.marketplace_orders.find_one({"order_id": order_id}, {"_id": 0}) or order
    return {"ok": True, "order": fresh, "replayed": False}


@router.post("/orders/{order_id}/confirm-received")
async def confirm_marketplace_received(order_id: str, req: MarketplaceOrderActionRequest, request: Request):
    buyer = await get_current_user(request)
    _require_marketplace_kyc(buyer, action="den Empfang zu bestätigen")
    buyer_id = str(buyer["_id"])
    order = await db.marketplace_orders.find_one({"order_id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Bestellung nicht gefunden")
    if order.get("buyer_id") != buyer_id:
        raise HTTPException(status_code=403, detail="Nicht deine Bestellung")
    if order.get("status") == "completed" and order.get("escrow_status") == "released":
        return {"ok": True, "order": order, "replayed": True}
    expected = "shipped" if order.get("use_shipping") else "ready_for_pickup"
    if order.get("status") != expected or order.get("escrow_status") != "funded":
        raise HTTPException(status_code=409, detail="Bestellung kann noch nicht als erhalten bestätigt werden")

    action_key = _require_marketplace_action_idempotency_key(
        req.idempotency_key,
        request,
        action="confirm-received",
    )
    claim = await db.marketplace_orders.update_one(
        {
            "order_id": order_id,
            "buyer_id": buyer_id,
            "status": expected,
            "escrow_status": "funded",
        },
        {"$set": {
            "status": "settling",
            "settlement_action_key_hash": hashlib.sha256(action_key.encode("utf-8")).hexdigest()[:20],
            "settlement_started_at": datetime.now(timezone.utc).isoformat(),
        }},
    )
    if claim.modified_count != 1:
        current = await db.marketplace_orders.find_one({"order_id": order_id}, {"_id": 0}) or {}
        if current.get("status") == "completed" and current.get("escrow_status") == "released":
            return {"ok": True, "order": current, "replayed": True}
        raise HTTPException(status_code=409, detail="Escrow-Auszahlung wird bereits verarbeitet")

    platform_user_id = order.get("escrow_platform_user_id") or await _marketplace_platform_user_id()
    payout = await transfer_between_wallets(
        from_user_id=str(platform_user_id),
        to_user_id=str(order["seller_id"]),
        amount=round(float(order["seller_amount"]), 2),
        tx_type=TransactionType.MERCHANT_CREDIT,
        description=f"Marketplace Auszahlung: {order['item_title'][:50]}",
        reference=f"MKT-PAYOUT-{order_id[-12:]}",
        metadata={"order_id": order_id, "listing_id": order.get("listing_id"), "escrow_release": True},
        idempotency_key=f"marketplace-order:{order_id}:seller-payout",
    )
    if not payout.success:
        await db.marketplace_orders.update_one(
            {"order_id": order_id, "status": "settling"},
            {"$set": {
                "status": "reconciliation_required",
                "settlement_error": payout.error,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }},
        )
        raise HTTPException(status_code=500, detail=payout.error or "Verkäuferauszahlung benötigt Abstimmung")

    completed_at = datetime.now(timezone.utc).isoformat()
    finalized = await db.marketplace_orders.update_one(
        {"order_id": order_id, "status": "settling", "escrow_status": "funded"},
        {"$set": {
            "status": "completed",
            "escrow_status": "released",
            "seller_payment_id": payout.transaction_id,
            "received_confirmed_at": completed_at,
            "completed_at": completed_at,
            "updated_at": completed_at,
        }},
    )
    if finalized.modified_count != 1:
        await db.marketplace_orders.update_one(
            {"order_id": order_id},
            {"$set": {
                "status": "reconciliation_required",
                "seller_payment_id": payout.transaction_id,
                "updated_at": completed_at,
            }},
        )
        raise HTTPException(status_code=500, detail="Verkäufer bezahlt; Bestellabschluss benötigt Abstimmung")

    await _credit_marketplace_revenue_once(
        order_id,
        float(order.get("commission") or 0),
        datetime.fromisoformat(order["created_at"]),
    )
    try:
        from routes.loyalty_system import process_loyalty_rewards
        await process_loyalty_rewards(
            user_id=buyer_id,
            source_type="marketplace",
            source_id=order_id,
            amount=float(order.get("total_price") or 0),
            tx_id=order.get("escrow_transaction_id") or order_id,
        )
    except Exception:
        pass

    await db.notifications.update_one(
        {"id": f"MKT-COMPLETE-{order_id}"},
        {"$setOnInsert": {
            "id": f"MKT-COMPLETE-{order_id}",
            "user_id": order.get("seller_id"),
            "type": "marketplace_completed",
            "title": "Marketplace-Auszahlung freigegeben",
            "message": f"€{float(order.get('seller_amount') or 0):.2f} wurden nach Empfangsbestätigung ausgezahlt.",
            "data": {"order_id": order_id, "listing_id": order.get("listing_id")},
            "read": False,
            "created_at": completed_at,
        }},
        upsert=True,
    )
    fresh = await db.marketplace_orders.find_one({"order_id": order_id}, {"_id": 0}) or order
    return {"ok": True, "order": fresh, "replayed": bool(payout.idempotent_replay)}


@router.post("/orders/{order_id}/cancel")
async def cancel_marketplace_order(order_id: str, req: MarketplaceOrderActionRequest, request: Request):
    actor = await get_current_user(request)
    actor_id = str(actor["_id"])
    order = await db.marketplace_orders.find_one({"order_id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Bestellung nicht gefunden")
    if actor_id not in {str(order.get("buyer_id")), str(order.get("seller_id"))}:
        raise HTTPException(status_code=403, detail="Nicht deine Bestellung")
    if order.get("status") == "refunded" and order.get("escrow_status") == "refunded":
        return {"ok": True, "order": order, "replayed": True}
    if order.get("status") not in {"awaiting_shipment", "awaiting_pickup"} or order.get("escrow_status") != "funded":
        raise HTTPException(status_code=409, detail="Bestellung kann nach Übergabe/Versand nicht mehr storniert werden")

    action_key = _require_marketplace_action_idempotency_key(
        req.idempotency_key,
        request,
        action="cancel-order",
    )
    claimed = await db.marketplace_orders.update_one(
        {
            "order_id": order_id,
            "status": {"$in": ["awaiting_shipment", "awaiting_pickup"]},
            "escrow_status": "funded",
        },
        {"$set": {
            "status": "refunding",
            "cancelled_by": actor_id,
            "cancel_note": (req.note or "").strip() or None,
            "cancel_action_key_hash": hashlib.sha256(action_key.encode("utf-8")).hexdigest()[:20],
            "refund_started_at": datetime.now(timezone.utc).isoformat(),
        }},
    )
    if claimed.modified_count != 1:
        raise HTTPException(status_code=409, detail="Stornierung wird bereits verarbeitet")

    platform_user_id = order.get("escrow_platform_user_id") or await _marketplace_platform_user_id()
    refund = await transfer_between_wallets(
        from_user_id=str(platform_user_id),
        to_user_id=str(order["buyer_id"]),
        amount=round(float(order["total_price"]), 2),
        tx_type=TransactionType.REFUND,
        description=f"Marketplace Escrow Rückzahlung: {order['item_title'][:50]}",
        reference=f"MKT-REF-{order_id[-12:]}",
        metadata={"order_id": order_id, "listing_id": order.get("listing_id"), "escrow_refund": True},
        idempotency_key=f"marketplace-order:{order_id}:refund",
    )
    if not refund.success:
        await db.marketplace_orders.update_one(
            {"order_id": order_id, "status": "refunding"},
            {"$set": {
                "status": "reconciliation_required",
                "refund_error": refund.error,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }},
        )
        raise HTTPException(status_code=500, detail=refund.error or "Marketplace-Rückzahlung benötigt Abstimmung")

    refunded_at = datetime.now(timezone.utc).isoformat()
    await db.marketplace_orders.update_one(
        {"order_id": order_id, "status": "refunding"},
        {"$set": {
            "status": "refunded",
            "escrow_status": "refunded",
            "refund_transaction_id": refund.transaction_id,
            "refunded_at": refunded_at,
            "updated_at": refunded_at,
        }},
    )
    reactivated = await db.marketplace_listings.update_one(
        {
            "listing_id": order.get("listing_id"),
            "status": "sold",
            "order_id": order_id,
            "sold_to": order.get("buyer_id"),
        },
        {
            "$set": {"status": "active", "updated_at": refunded_at},
            "$unset": {"sold_at": "", "sold_to": "", "order_id": ""},
        },
    )
    if reactivated.modified_count != 1:
        current_listing = await db.marketplace_listings.find_one(
            {"listing_id": order.get("listing_id")},
            {"_id": 0, "status": 1, "order_id": 1},
        ) or {}
        if current_listing.get("status") != "active":
            await db.marketplace_orders.update_one(
                {"order_id": order_id},
                {"$set": {
                    "listing_reactivation_required": True,
                    "listing_reactivation_error": "post_refund_listing_state_mismatch",
                    "updated_at": refunded_at,
                }},
            )
    other_user_id = order.get("seller_id") if actor_id == str(order.get("buyer_id")) else order.get("buyer_id")
    await db.notifications.update_one(
        {"id": f"MKT-CANCEL-{order_id}"},
        {"$setOnInsert": {
            "id": f"MKT-CANCEL-{order_id}",
            "user_id": other_user_id,
            "type": "marketplace_cancelled",
            "title": "Marketplace-Bestellung storniert",
            "message": "Die Bestellung wurde vor Versand/Übergabe storniert und der Käuferbetrag zurückgezahlt.",
            "data": {"order_id": order_id, "listing_id": order.get("listing_id")},
            "read": False,
            "created_at": refunded_at,
        }},
        upsert=True,
    )
    fresh = await db.marketplace_orders.find_one({"order_id": order_id}, {"_id": 0}) or order
    return {"ok": True, "order": fresh, "replayed": bool(refund.idempotent_replay)}


# ══════════════════════════════════════════════════════════════════════════════
# CONTACT SELLER
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/contact")
async def contact_seller(req: ContactSellerRequest, request: Request):
    """Send message to seller."""
    user = await get_current_user(request)
    sender_id = str(user["_id"])
    
    listing = await db.marketplace_listings.find_one({"listing_id": req.listing_id})
    if not listing:
        raise HTTPException(status_code=404, detail="Anzeige nicht gefunden")
    
    seller_id = listing["seller_id"]
    
    if seller_id == sender_id:
        raise HTTPException(status_code=400, detail="Du kannst dir nicht selbst schreiben")
    
    now = datetime.now(timezone.utc)
    message_id = secrets.token_hex(8)
    
    message = {
        "message_id": message_id,
        "listing_id": req.listing_id,
        "listing_title": listing["title"],
        "sender_id": sender_id,
        "sender_name": user.get("name", ""),
        "sender_email": user.get("email", ""),
        "recipient_id": seller_id,
        "message": req.message,
        "read": False,
        "created_at": now.isoformat(),
    }
    
    await db.marketplace_messages.insert_one(message)
    message.pop("_id", None)
    
    # Update listing message count
    await db.marketplace_listings.update_one(
        {"listing_id": req.listing_id},
        {"$inc": {"messages_count": 1}}
    )
    
    # Send notification
    await db.notifications.insert_one({
        "id": secrets.token_hex(8),
        "user_id": seller_id,
        "type": "marketplace_message",
        "title": "Neue Nachricht",
        "message": f"Anfrage zu '{listing['title'][:30]}'",
        "data": {"message_id": message_id, "listing_id": req.listing_id},
        "read": False,
        "created_at": now.isoformat(),
    })
    
    return {
        "ok": True,
        "message_id": message_id,
        "message": "Nachricht gesendet!",
    }


@router.get("/messages")
async def get_messages(request: Request):
    """Get all messages for current user (received as seller)."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    received = await db.marketplace_messages.find(
        {"recipient_id": user_id},
        {"_id": 0}
    ).sort("created_at", -1).limit(50).to_list(50)
    
    sent = await db.marketplace_messages.find(
        {"sender_id": user_id},
        {"_id": 0}
    ).sort("created_at", -1).limit(50).to_list(50)
    
    return {
        "received": received,
        "sent": sent,
        "unread_count": len([m for m in received if not m.get("read")]),
    }


# ══════════════════════════════════════════════════════════════════════════════
# BOOST LISTING (Premium Feature)
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/boost")
async def boost_listing(req: BoostListingRequest, request: Request):
    """Pay to boost listing visibility exactly once per client attempt."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    if req.boost_type not in BOOST_PRICES:
        raise HTTPException(status_code=400, detail=f"Ungültiger Boost-Typ. Wähle aus: {', '.join(BOOST_PRICES.keys())}")

    idempotency_key = _require_marketplace_action_idempotency_key(
        req.idempotency_key,
        request,
        action="boost",
    )
    operation_id = hashlib.sha256(idempotency_key.encode("utf-8")).hexdigest()[:20]
    operation_field = f"promotion_operations.{operation_id}"

    listing = await db.marketplace_listings.find_one({"listing_id": req.listing_id})
    if not listing:
        raise HTTPException(status_code=404, detail="Anzeige nicht gefunden")
    if listing["seller_id"] != user_id:
        raise HTTPException(status_code=403, detail="Nicht autorisiert")
    if listing["status"] != "active":
        raise HTTPException(status_code=400, detail="Nur aktive Anzeigen können geboostet werden")

    existing_operation = (listing.get("promotion_operations") or {}).get(operation_id)
    if existing_operation:
        fresh_user = await db.users.find_one({"_id": user["_id"]}, {"balance": 1, "_id": 0}) or {}
        return {
            "ok": True,
            "boost_type": existing_operation.get("boost_type"),
            "expires_at": existing_operation.get("expires_at"),
            "new_balance": round(float(fresh_user.get("balance") or 0), 2),
            "message": "Boost bereits aktiviert.",
            "replayed": True,
        }

    boost = BOOST_PRICES[req.boost_type]
    price = float(boost["price"])
    duration = int(boost["duration_days"])
    payment_result = await debit_wallet(
        user_id=user_id,
        amount=price,
        tx_type=TransactionType.FEE,
        description=f"Boost: {boost['label']} für '{listing['title'][:30]}'",
        reference=f"BOOST-{operation_id[:12].upper()}",
        metadata={"listing_id": req.listing_id, "boost_type": req.boost_type, "operation_id": operation_id},
        idempotency_key=idempotency_key,
    )
    if not payment_result.success:
        raise HTTPException(status_code=400, detail=payment_result.error or "Boost-Zahlung fehlgeschlagen")

    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(days=duration)
    operation = {
        "type": "boost",
        "boost_type": req.boost_type,
        "price": price,
        "started_at": now.isoformat(),
        "expires_at": expires_at.isoformat(),
        "payment_transaction_id": payment_result.transaction_id,
    }
    applied = await db.marketplace_listings.update_one(
        {
            "listing_id": req.listing_id,
            "seller_id": user_id,
            "status": "active",
            operation_field: {"$exists": False},
        },
        {
            "$set": {
                "boost": {
                    "type": req.boost_type,
                    "label": boost["label"],
                    "started_at": now.isoformat(),
                    "expires_at": expires_at.isoformat(),
                },
                operation_field: operation,
                "updated_at": now.isoformat(),
            }
        },
    )
    if applied.modified_count != 1:
        fresh_listing = await db.marketplace_listings.find_one({"listing_id": req.listing_id}) or {}
        existing_operation = (fresh_listing.get("promotion_operations") or {}).get(operation_id)
        if not existing_operation:
            refund = await credit_wallet(
                user_id=user_id,
                amount=price,
                tx_type=TransactionType.REFUND,
                description="Marketplace Boost Rollback",
                reference=f"BOOST-ROLLBACK-{operation_id[:10].upper()}",
                source="marketplace_boost_rollback",
                metadata={"listing_id": req.listing_id, "operation_id": operation_id},
                idempotency_key=f"marketplace-boost-rollback:{idempotency_key}",
            )
            if not refund.success:
                raise HTTPException(status_code=500, detail="Boost-Zahlung benötigt manuelle Abstimmung")
            raise HTTPException(status_code=409, detail="Boost konnte nicht aktiviert werden. Betrag wurde zurückgebucht.")
        operation = existing_operation

    await _credit_marketplace_promo_revenue_once(
        operation_id,
        "marketplace_boosts",
        price,
        now,
    )
    return {
        "ok": True,
        "boost_type": operation.get("boost_type", req.boost_type),
        "expires_at": operation.get("expires_at", expires_at.isoformat()),
        "new_balance": payment_result.new_balance,
        "message": f"Boost aktiviert für {duration} Tage!",
        "replayed": payment_result.idempotent_replay,
    }


# ══════════════════════════════════════════════════════════════════════════════
# VIP UPGRADE
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/vip")
async def upgrade_to_vip(request: Request):
    """Upgrade one listing to VIP exactly once."""
    body = await request.json()
    listing_id = body.get("listing_id")
    if not listing_id:
        raise HTTPException(status_code=400, detail="listing_id erforderlich")

    user = await get_current_user(request)
    user_id = str(user["_id"])
    idempotency_key = _require_marketplace_action_idempotency_key(
        body.get("idempotency_key"),
        request,
        action="vip",
    )
    operation_id = hashlib.sha256(idempotency_key.encode("utf-8")).hexdigest()[:20]
    operation_field = f"promotion_operations.{operation_id}"

    listing = await db.marketplace_listings.find_one({"listing_id": listing_id})
    if not listing:
        raise HTTPException(status_code=404, detail="Anzeige nicht gefunden")
    if listing["seller_id"] != user_id:
        raise HTTPException(status_code=403, detail="Nicht autorisiert")
    if listing["status"] != "active":
        raise HTTPException(status_code=400, detail="Nur aktive Anzeigen können VIP werden")

    existing_operation = (listing.get("promotion_operations") or {}).get(operation_id)
    if existing_operation:
        fresh_user = await db.users.find_one({"_id": user["_id"]}, {"balance": 1, "_id": 0}) or {}
        return {
            "ok": True,
            "is_vip": True,
            "new_balance": round(float(fresh_user.get("balance") or 0), 2),
            "message": "VIP bereits aktiviert.",
            "replayed": True,
        }
    if listing.get("is_vip"):
        raise HTTPException(status_code=400, detail="Anzeige ist bereits VIP")

    payment_result = await debit_wallet(
        user_id=user_id,
        amount=VIP_PRICE,
        tx_type=TransactionType.FEE,
        description=f"VIP Upgrade: '{listing['title'][:30]}'",
        reference=f"VIP-{operation_id[:12].upper()}",
        metadata={"listing_id": listing_id, "type": "vip_upgrade", "operation_id": operation_id},
        idempotency_key=idempotency_key,
    )
    if not payment_result.success:
        raise HTTPException(status_code=400, detail=payment_result.error or "VIP-Zahlung fehlgeschlagen")

    now = datetime.now(timezone.utc)
    operation = {
        "type": "vip",
        "price": VIP_PRICE,
        "started_at": now.isoformat(),
        "payment_transaction_id": payment_result.transaction_id,
    }
    applied = await db.marketplace_listings.update_one(
        {
            "listing_id": listing_id,
            "seller_id": user_id,
            "status": "active",
            "is_vip": {"$ne": True},
            operation_field: {"$exists": False},
        },
        {
            "$set": {
                "is_vip": True,
                "vip_since": now.isoformat(),
                operation_field: operation,
                "updated_at": now.isoformat(),
            }
        },
    )
    if applied.modified_count != 1:
        fresh_listing = await db.marketplace_listings.find_one({"listing_id": listing_id}) or {}
        existing_operation = (fresh_listing.get("promotion_operations") or {}).get(operation_id)
        if not existing_operation and not fresh_listing.get("is_vip"):
            refund = await credit_wallet(
                user_id=user_id,
                amount=VIP_PRICE,
                tx_type=TransactionType.REFUND,
                description="Marketplace VIP Rollback",
                reference=f"VIP-ROLLBACK-{operation_id[:10].upper()}",
                source="marketplace_vip_rollback",
                metadata={"listing_id": listing_id, "operation_id": operation_id},
                idempotency_key=f"marketplace-vip-rollback:{idempotency_key}",
            )
            if not refund.success:
                raise HTTPException(status_code=500, detail="VIP-Zahlung benötigt manuelle Abstimmung")
            raise HTTPException(status_code=409, detail="VIP konnte nicht aktiviert werden. Betrag wurde zurückgebucht.")

    await _credit_marketplace_promo_revenue_once(
        operation_id,
        "marketplace_vip",
        VIP_PRICE,
        now,
    )
    return {
        "ok": True,
        "is_vip": True,
        "new_balance": payment_result.new_balance,
        "message": "VIP Status aktiviert!",
        "replayed": payment_result.idempotent_replay,
    }


# ══════════════════════════════════════════════════════════════════════════════
# USER DASHBOARD
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/dashboard/my-listings")
@router.get("/my-listings")
async def get_my_listings(request: Request):
    """Get user's own listings."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    listings = await db.marketplace_listings.find(
        {"seller_id": user_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    stats = {
        "total": len(listings),
        "active": len([listing for listing in listings if listing.get("status") == "active"]),
        "sold": len([listing for listing in listings if listing.get("status") == "sold"]),
        "total_views": sum(listing.get("views", 0) for listing in listings),
    }
    
    return {"listings": listings, "stats": stats}


@router.get("/orders/purchases")
@router.get("/my-purchases")
async def get_my_purchases(request: Request):
    """Get user's purchase history."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    orders = await db.marketplace_orders.find(
        {"buyer_id": user_id},
        {"_id": 0}
    ).sort("created_at", -1).limit(50).to_list(50)
    
    return {"orders": orders, "total": len(orders)}


@router.get("/orders/sales")
@router.get("/my-sales")
async def get_my_sales(request: Request):
    """Get user's sales history."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    orders = await db.marketplace_orders.find(
        {"seller_id": user_id},
        {"_id": 0}
    ).sort("created_at", -1).limit(50).to_list(50)
    
    total_revenue = sum(
        float(o.get("seller_amount") or 0)
        for o in orders
        if o.get("status") == "completed"
        and o.get("escrow_status") in {None, "released"}
    )
    
    return {
        "orders": orders,
        "total": len(orders),
        "total_revenue": round(total_revenue, 2),
    }


# ══════════════════════════════════════════════════════════════════════════════
# FAVORITES
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/{listing_id}/favorite")
async def toggle_favorite(listing_id: str, request: Request):
    """Add or remove listing from favorites."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    listing = await db.marketplace_listings.find_one({"listing_id": listing_id})
    if not listing:
        raise HTTPException(status_code=404, detail="Anzeige nicht gefunden")
    
    existing = await db.marketplace_favorites.find_one({
        "user_id": user_id,
        "listing_id": listing_id
    })
    
    if existing:
        await db.marketplace_favorites.delete_one({"_id": existing["_id"]})
        await db.marketplace_listings.update_one(
            {"listing_id": listing_id},
            {"$inc": {"favorites": -1}}
        )
        return {"ok": True, "favorited": False}
    else:
        await db.marketplace_favorites.insert_one({
            "user_id": user_id,
            "listing_id": listing_id,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        await db.marketplace_listings.update_one(
            {"listing_id": listing_id},
            {"$inc": {"favorites": 1}}
        )
        return {"ok": True, "favorited": True}


@router.get("/meta/favorites")
@router.get("/favorites")
async def get_favorites(request: Request):
    """Get user's favorite listings."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    favorites = await db.marketplace_favorites.find(
        {"user_id": user_id}
    ).to_list(100)
    
    listing_ids = [f["listing_id"] for f in favorites]
    
    listings = await db.marketplace_listings.find(
        {"listing_id": {"$in": listing_ids}},
        {"_id": 0, "seller_email": 0}
    ).to_list(100)
    
    return {"favorites": listings}


# ══════════════════════════════════════════════════════════════════════════════
# ADMIN
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/admin/listings")
async def admin_list_all(request: Request, status: Optional[str] = None, limit: int = 50):
    """Admin: List all listings."""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    
    query = {}
    if status:
        query["status"] = status
    
    listings = await db.marketplace_listings.find(
        query, {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    stats = {
        "total": await db.marketplace_listings.count_documents({}),
        "active": await db.marketplace_listings.count_documents({"status": "active"}),
        "sold": await db.marketplace_listings.count_documents({"status": "sold"}),
    }
    
    return {"listings": listings, "stats": stats}


@router.delete("/admin/{listing_id}")
async def admin_delete_listing(listing_id: str, request: Request):
    """Admin: Delete any listing."""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    
    result = await db.marketplace_listings.delete_one({"listing_id": listing_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Anzeige nicht gefunden")
    
    return {"ok": True, "deleted": listing_id}


# ══════════════════════════════════════════════════════════════════════════════
# MERCHANT DASHBOARD - STATS
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/dashboard/my")
@router.get("/my")
async def get_my_dashboard(request: Request):
    """Get user's marketplace dashboard with listings and stats."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    # Get all user listings
    listings = await db.marketplace_listings.find(
        {"seller_id": user_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    now = datetime.now(timezone.utc).isoformat()
    
    # Calculate stats
    active_listings = [listing for listing in listings if listing.get("status") == "active"]
    boosted_listings = [listing for listing in active_listings if listing.get("boost") and listing["boost"].get("expires_at", "") > now]
    vip_listings = [listing for listing in active_listings if listing.get("is_vip")]
    
    # Get boost/VIP transactions to calculate spent
    boost_txns = await db.transactions.find({
        "user_id": user_id,
        "$or": [
            {"reference": {"$regex": "^BOOST-"}},
            {"reference": {"$regex": "^VIP-"}}
        ]
    }).to_list(200)
    
    total_spent = sum(abs(t.get("amount", 0)) for t in boost_txns)
    
    return {
        "listings": listings,
        "stats": {
            "total_listings": len(listings),
            "active_listings": len(active_listings),
            "boosted_listings": len(boosted_listings),
            "vip_listings": len(vip_listings),
            "sold_listings": len([listing for listing in listings if listing.get("status") == "sold"]),
            "total_views": sum(listing.get("views", 0) for listing in listings),
            "total_favorites": sum(listing.get("favorites", 0) for listing in listings),
            "total_spent_on_boost": round(total_spent, 2),
        }
    }


@router.get("/stats")
async def get_my_stats(request: Request):
    """Get user's marketplace statistics."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    now = datetime.now(timezone.utc).isoformat()
    
    # Count listings
    total = await db.marketplace_listings.count_documents({"seller_id": user_id})
    active = await db.marketplace_listings.count_documents({"seller_id": user_id, "status": "active"})
    sold = await db.marketplace_listings.count_documents({"seller_id": user_id, "status": "sold"})
    
    # Get active boosted listings
    active_listings = await db.marketplace_listings.find(
        {"seller_id": user_id, "status": "active"},
        {"boost": 1, "is_vip": 1, "views": 1, "favorites": 1}
    ).to_list(100)
    
    boosted = sum(1 for listing in active_listings if listing.get("boost") and listing["boost"].get("expires_at", "") > now)
    vip = sum(1 for listing in active_listings if listing.get("is_vip"))
    total_views = sum(listing.get("views", 0) for listing in active_listings)
    
    # Get total spent on promotions
    boost_txns = await db.transactions.find({
        "user_id": user_id,
        "$or": [
            {"reference": {"$regex": "^BOOST-"}},
            {"reference": {"$regex": "^VIP-"}}
        ]
    }).to_list(200)
    
    total_spent = sum(abs(t.get("amount", 0)) for t in boost_txns)
    
    # Get sales revenue
    sales = await db.marketplace_orders.find(
        {
            "seller_id": user_id,
            "status": "completed",
            "$or": [
                {"escrow_status": "released"},
                {"escrow_status": {"$exists": False}},
            ],
        },
        {"seller_amount": 1, "escrow_status": 1, "status": 1},
    ).to_list(500)
    total_revenue = sum(float(s.get("seller_amount") or 0) for s in sales)
    
    return {
        "total_listings": total,
        "active_listings": active,
        "boosted_listings": boosted,
        "vip_listings": vip,
        "sold_listings": sold,
        "total_views": total_views,
        "total_spent_on_boost": round(total_spent, 2),
        "total_sales_revenue": round(total_revenue, 2),
    }


# ══════════════════════════════════════════════════════════════════════════════
# ADMIN REVENUE TRACKING
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/admin/revenue")
async def admin_marketplace_revenue(request: Request, days: int = 30):
    """Admin: Get marketplace revenue statistics."""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    
    now = datetime.now(timezone.utc)
    today = now.strftime("%Y-%m-%d")
    start_date = (now - timedelta(days=days)).isoformat()
    
    # Get all boost transactions
    boost_txns = await db.transactions.find({
        "reference": {"$regex": "^BOOST-"},
        "created_at": {"$gte": start_date}
    }, {"_id": 0}).sort("created_at", -1).to_list(500)
    
    # Get all VIP transactions
    vip_txns = await db.transactions.find({
        "reference": {"$regex": "^VIP-"},
        "created_at": {"$gte": start_date}
    }, {"_id": 0}).sort("created_at", -1).to_list(500)
    
    # Get marketplace sales commissions
    commission_txns = await db.marketplace_orders.find({
        "created_at": {"$gte": start_date}
    }, {"_id": 0, "commission": 1, "created_at": 1}).to_list(500)
    
    total_boost_revenue = sum(abs(t.get("amount", 0)) for t in boost_txns)
    total_vip_revenue = sum(abs(t.get("amount", 0)) for t in vip_txns)
    total_commission = sum(o.get("commission", 0) for o in commission_txns)
    
    # Today's revenue from platform_revenue collection
    today_revenue_doc = await db.platform_revenue.find_one({"date": today})
    today_revenue = today_revenue_doc.get("total", 0) if today_revenue_doc else 0
    today_boost = today_revenue_doc.get("by_source", {}).get("marketplace_boosts", 0) if today_revenue_doc else 0
    today_vip = today_revenue_doc.get("by_source", {}).get("marketplace_vip", 0) if today_revenue_doc else 0
    
    # Daily breakdown
    daily_revenue = {}
    for i in range(min(days, 14)):
        date = (now - timedelta(days=i)).strftime("%Y-%m-%d")
        rev_doc = await db.platform_revenue.find_one({"date": date})
        if rev_doc:
            daily_revenue[date] = {
                "total": rev_doc.get("total", 0),
                "boost": rev_doc.get("by_source", {}).get("marketplace_boosts", 0),
                "vip": rev_doc.get("by_source", {}).get("marketplace_vip", 0),
                "commission": rev_doc.get("by_source", {}).get("marketplace_commission", 0),
            }
    
    # All transactions combined
    all_txns = []
    for t in boost_txns:
        all_txns.append({
            "type": "boost",
            "amount": abs(t.get("amount", 0)),
            "description": t.get("description", ""),
            "created_at": t.get("created_at", ""),
        })
    for t in vip_txns:
        all_txns.append({
            "type": "vip",
            "amount": abs(t.get("amount", 0)),
            "description": t.get("description", ""),
            "created_at": t.get("created_at", ""),
        })
    
    # Sort by date
    all_txns.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    
    return {
        "period_days": days,
        "total_boost_revenue": round(total_boost_revenue, 2),
        "total_vip_revenue": round(total_vip_revenue, 2),
        "total_commission_revenue": round(total_commission, 2),
        "total_marketplace_revenue": round(total_boost_revenue + total_vip_revenue + total_commission, 2),
        "today": {
            "date": today,
            "total": round(today_revenue, 2),
            "boost": round(today_boost, 2),
            "vip": round(today_vip, 2),
        },
        "daily_breakdown": daily_revenue,
        "transactions": all_txns[:50],  # Last 50 transactions
        "transaction_counts": {
            "boosts": len(boost_txns),
            "vip_upgrades": len(vip_txns),
        }
    }

# Dynamic public listing alias must remain after every static GET route.
@router.get("/{listing_id}")
async def get_listing_public_alias(listing_id: str):
    return await get_listing(listing_id)

