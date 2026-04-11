"""
BidBlitz V2 - Marketplace System
Like eBay Kleinanzeigen - Users can post, browse, and buy items.
Wallet-based payments with escrow support.
Premium listings with boost functionality.
"""

import secrets
import logging
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from typing import Optional, List
from bson import ObjectId

from core.database import db
from core.security import get_current_user
from core.payment_engine import debit_wallet, credit_wallet, transfer_between_wallets, TransactionType

router = APIRouter(prefix="/api/marketplace", tags=["Marketplace"])
logger = logging.getLogger("bidblitz.marketplace")

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
    shipping_cost: Optional[float] = None


class UpdateListingRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = None
    category: Optional[str] = None
    images: Optional[List[str]] = None
    location: Optional[str] = None
    negotiable: Optional[bool] = None
    shipping_available: Optional[bool] = None
    shipping_cost: Optional[float] = None
    status: Optional[str] = None


class BuyRequest(BaseModel):
    listing_id: str
    use_shipping: bool = False
    message: Optional[str] = None


class ContactSellerRequest(BaseModel):
    listing_id: str
    message: str = Field(..., min_length=5, max_length=1000)


class BoostListingRequest(BaseModel):
    listing_id: str
    boost_type: str = Field(..., description="highlight, top, or premium")


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


@router.get("/{listing_id}")
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
    if req.status and req.status in ["active", "inactive", "sold"]:
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
    
    await db.marketplace_listings.delete_one({"listing_id": listing_id})
    
    return {"ok": True, "deleted": listing_id}


# ══════════════════════════════════════════════════════════════════════════════
# BUY ITEM (Wallet Payment)
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/buy")
async def buy_item(req: BuyRequest, request: Request):
    """
    Buy item with wallet balance.
    
    Flow:
    1. Validate listing available
    2. Check buyer balance
    3. Deduct from buyer
    4. Credit seller (minus commission)
    5. Mark as sold
    """
    user = await get_current_user(request)
    buyer_id = str(user["_id"])
    
    listing = await db.marketplace_listings.find_one({"listing_id": req.listing_id})
    if not listing:
        raise HTTPException(status_code=404, detail="Anzeige nicht gefunden")
    
    if listing["status"] != "active":
        raise HTTPException(status_code=400, detail="Anzeige nicht mehr verfügbar")
    
    seller_id = listing["seller_id"]
    
    if seller_id == buyer_id:
        raise HTTPException(status_code=400, detail="Du kannst deine eigene Anzeige nicht kaufen")
    
    # Calculate total price
    item_price = listing["price"]
    shipping_cost = listing.get("shipping_cost", 0) if req.use_shipping else 0
    total_price = item_price + shipping_cost
    
    # Check buyer balance
    buyer_balance = user.get("balance", 0)
    if buyer_balance < total_price:
        raise HTTPException(
            status_code=400,
            detail=f"Nicht genug Guthaben. Benötigt: €{total_price:.2f}, Verfügbar: €{buyer_balance:.2f}"
        )
    
    now = datetime.now(timezone.utc)
    order_id = secrets.token_hex(8)
    
    # Calculate commission
    commission = round(item_price * PLATFORM_COMMISSION, 2)
    seller_amount = round(item_price - commission, 2)
    
    # Debit buyer
    debit_result = await debit_wallet(
        user_id=buyer_id,
        amount=total_price,
        tx_type=TransactionType.PAYMENT,
        description=f"Marketplace: {listing['title'][:50]}",
        reference=f"MKT-{order_id[:8].upper()}",
        merchant_name=listing.get("seller_name", "Verkäufer"),
        metadata={
            "listing_id": req.listing_id,
            "order_id": order_id,
            "item_price": item_price,
            "shipping_cost": shipping_cost,
        }
    )
    
    if not debit_result.success:
        raise HTTPException(status_code=400, detail=debit_result.error)
    
    # Credit seller (minus commission)
    credit_result = await credit_wallet(
        user_id=seller_id,
        amount=seller_amount,
        tx_type=TransactionType.MERCHANT_CREDIT,
        description=f"Verkauf: {listing['title'][:50]}",
        reference=f"MKT-SELL-{order_id[:8].upper()}",
        source="marketplace",
        metadata={
            "listing_id": req.listing_id,
            "order_id": order_id,
            "original_price": item_price,
            "commission": commission,
        }
    )
    
    # Record order
    order = {
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
        "use_shipping": req.use_shipping,
        "message": req.message,
        "status": "completed",
        "buyer_payment_id": debit_result.transaction_id,
        "seller_payment_id": credit_result.transaction_id if credit_result.success else None,
        "created_at": now.isoformat(),
    }
    await db.marketplace_orders.insert_one(order)
    order.pop("_id", None)
    
    # Mark listing as sold
    await db.marketplace_listings.update_one(
        {"listing_id": req.listing_id},
        {"$set": {
            "status": "sold",
            "sold_at": now.isoformat(),
            "sold_to": buyer_id,
            "order_id": order_id,
        }}
    )
    
    # Record platform revenue
    await db.platform_revenue.update_one(
        {"date": now.strftime("%Y-%m-%d")},
        {"$inc": {"total": commission, "by_source.marketplace_commission": commission}},
        upsert=True
    )
    
    # Send notification to seller
    await db.notifications.insert_one({
        "id": secrets.token_hex(8),
        "user_id": seller_id,
        "type": "marketplace_sale",
        "title": "Artikel verkauft!",
        "message": f"Dein Artikel '{listing['title'][:30]}' wurde für €{item_price:.2f} verkauft.",
        "data": {"order_id": order_id, "listing_id": req.listing_id},
        "read": False,
        "created_at": now.isoformat(),
    })
    
    logger.info(f"Marketplace sale: {order_id} - {listing['title'][:30]} - €{total_price:.2f}")
    
    return {
        "ok": True,
        "order": order,
        "new_balance": debit_result.new_balance,
        "message": f"Kauf erfolgreich! €{total_price:.2f} bezahlt.",
    }


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
    """Pay to boost listing visibility."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    if req.boost_type not in BOOST_PRICES:
        raise HTTPException(status_code=400, detail=f"Ungültiger Boost-Typ. Wähle aus: {', '.join(BOOST_PRICES.keys())}")
    
    listing = await db.marketplace_listings.find_one({"listing_id": req.listing_id})
    if not listing:
        raise HTTPException(status_code=404, detail="Anzeige nicht gefunden")
    
    if listing["seller_id"] != user_id:
        raise HTTPException(status_code=403, detail="Nicht autorisiert")
    
    if listing["status"] != "active":
        raise HTTPException(status_code=400, detail="Nur aktive Anzeigen können geboostet werden")
    
    boost = BOOST_PRICES[req.boost_type]
    price = boost["price"]
    duration = boost["duration_days"]
    
    # Deduct payment
    payment_result = await debit_wallet(
        user_id=user_id,
        amount=price,
        tx_type=TransactionType.FEE,
        description=f"Boost: {boost['label']} für '{listing['title'][:30]}'",
        reference=f"BOOST-{secrets.token_hex(4).upper()}",
        metadata={"listing_id": req.listing_id, "boost_type": req.boost_type}
    )
    
    if not payment_result.success:
        raise HTTPException(status_code=400, detail=payment_result.error)
    
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(days=duration)
    
    # Apply boost
    await db.marketplace_listings.update_one(
        {"listing_id": req.listing_id},
        {"$set": {
            "boost": {
                "type": req.boost_type,
                "label": boost["label"],
                "started_at": now.isoformat(),
                "expires_at": expires_at.isoformat(),
            },
            "updated_at": now.isoformat(),
        }}
    )
    
    # Record platform revenue
    await db.platform_revenue.update_one(
        {"date": now.strftime("%Y-%m-%d")},
        {"$inc": {"total": price, "by_source.marketplace_boosts": price}},
        upsert=True
    )
    
    return {
        "ok": True,
        "boost_type": req.boost_type,
        "expires_at": expires_at.isoformat(),
        "new_balance": payment_result.new_balance,
        "message": f"Boost aktiviert für {duration} Tage!",
    }


# ══════════════════════════════════════════════════════════════════════════════
# VIP UPGRADE
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/vip")
async def upgrade_to_vip(request: Request):
    """
    Pay to upgrade listing to VIP status.
    VIP listings get a gold badge and priority in search.
    Cost: €4.99
    """
    body = await request.json()
    listing_id = body.get("listing_id")
    
    if not listing_id:
        raise HTTPException(status_code=400, detail="listing_id erforderlich")
    
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    listing = await db.marketplace_listings.find_one({"listing_id": listing_id})
    if not listing:
        raise HTTPException(status_code=404, detail="Anzeige nicht gefunden")
    
    if listing["seller_id"] != user_id:
        raise HTTPException(status_code=403, detail="Nicht autorisiert")
    
    if listing["status"] != "active":
        raise HTTPException(status_code=400, detail="Nur aktive Anzeigen können VIP werden")
    
    if listing.get("is_vip"):
        raise HTTPException(status_code=400, detail="Anzeige ist bereits VIP")
    
    # Deduct payment
    payment_result = await debit_wallet(
        user_id=user_id,
        amount=VIP_PRICE,
        tx_type=TransactionType.FEE,
        description=f"VIP Upgrade: '{listing['title'][:30]}'",
        reference=f"VIP-{secrets.token_hex(4).upper()}",
        metadata={"listing_id": listing_id, "type": "vip_upgrade"}
    )
    
    if not payment_result.success:
        raise HTTPException(status_code=400, detail=payment_result.error)
    
    now = datetime.now(timezone.utc)
    
    # Apply VIP status
    await db.marketplace_listings.update_one(
        {"listing_id": listing_id},
        {"$set": {
            "is_vip": True,
            "vip_since": now.isoformat(),
            "updated_at": now.isoformat(),
        }}
    )
    
    # Record platform revenue
    await db.platform_revenue.update_one(
        {"date": now.strftime("%Y-%m-%d")},
        {"$inc": {"total": VIP_PRICE, "by_source.marketplace_vip": VIP_PRICE}},
        upsert=True
    )
    
    return {
        "ok": True,
        "is_vip": True,
        "new_balance": payment_result.new_balance,
        "message": "VIP Status aktiviert!",
    }


# ══════════════════════════════════════════════════════════════════════════════
# USER DASHBOARD
# ══════════════════════════════════════════════════════════════════════════════

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
        "active": len([l for l in listings if l.get("status") == "active"]),
        "sold": len([l for l in listings if l.get("status") == "sold"]),
        "total_views": sum(l.get("views", 0) for l in listings),
    }
    
    return {"listings": listings, "stats": stats}


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


@router.get("/my-sales")
async def get_my_sales(request: Request):
    """Get user's sales history."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    orders = await db.marketplace_orders.find(
        {"seller_id": user_id},
        {"_id": 0}
    ).sort("created_at", -1).limit(50).to_list(50)
    
    total_revenue = sum(o.get("seller_amount", 0) for o in orders)
    
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
    active_listings = [l for l in listings if l.get("status") == "active"]
    boosted_listings = [l for l in active_listings if l.get("boost") and l["boost"].get("expires_at", "") > now]
    vip_listings = [l for l in active_listings if l.get("is_vip")]
    
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
            "sold_listings": len([l for l in listings if l.get("status") == "sold"]),
            "total_views": sum(l.get("views", 0) for l in listings),
            "total_favorites": sum(l.get("favorites", 0) for l in listings),
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
    
    boosted = sum(1 for l in active_listings if l.get("boost") and l["boost"].get("expires_at", "") > now)
    vip = sum(1 for l in active_listings if l.get("is_vip"))
    total_views = sum(l.get("views", 0) for l in active_listings)
    
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
        {"seller_id": user_id},
        {"seller_amount": 1}
    ).to_list(500)
    total_revenue = sum(s.get("seller_amount", 0) for s in sales)
    
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
