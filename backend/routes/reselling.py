"""
BidBlitz V2 - Reselling Marketplace
Buy & sell sneakers, clothes, gaming gear — 8% platform commission
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime, timezone
from core.database import db
from core.security import get_current_user
from core.payment_engine import transfer_between_wallets, TransactionType
import secrets
import hashlib
import os

router = APIRouter(prefix="/api/resell", tags=["reselling"])

PLATFORM_FEE = 0.08  # 8%


async def _resell_platform_user_id() -> Optional[str]:
    email = os.environ.get("PLATFORM_POOL_EMAIL", "admin@bidblitz.ae").strip().lower()
    pool = await db.users.find_one({"email": email}, {"_id": 1})
    return str(pool["_id"]) if pool else None


def _resell_idempotency_key(body_key: Optional[str], request: Request) -> str:
    key = (body_key or request.headers.get("Idempotency-Key") or "").strip()
    if not 8 <= len(key) <= 200:
        raise HTTPException(status_code=400, detail="Idempotency-Key erforderlich")
    return key


CATEGORIES = ["Sneakers", "Streetwear", "Gaming", "Elektronik", "Accessoires", "Sammlerstücke"]


class ListingCreate(BaseModel):
    title: str = Field(..., min_length=2, max_length=120)
    description: str = ""
    category: str = "Sneakers"
    price: float = Field(..., gt=0, le=50000)
    condition: str = "Neu"  # Neu, Wie neu, Gut, Akzeptabel
    images: list = []
    brand: str = ""
    size: str = ""


class BuyRequest(BaseModel):
    listing_id: str
    idempotency_key: Optional[str] = Field(default=None, max_length=200)


@router.get("/listings")
async def get_listings(category: Optional[str] = None, search: Optional[str] = None,
                       sort: str = "newest", min_price: float = 0, max_price: float = 99999):
    query = {"status": "active"}
    if category:
        query["category"] = category
    if search:
        query["$or"] = [
            {"title": {"$regex": search, "$options": "i"}},
            {"brand": {"$regex": search, "$options": "i"}},
        ]
    if min_price > 0:
        query["price"] = {"$gte": min_price}
    if max_price < 99999:
        query.setdefault("price", {})["$lte"] = max_price

    sort_key = {"newest": ("created_at", -1), "cheapest": ("price", 1),
                "expensive": ("price", -1), "popular": ("views", -1)}.get(sort, ("created_at", -1))

    listings = await db.resell_listings.find(query, {"_id": 0}).sort(*sort_key).to_list(50)
    return {"listings": listings, "total": len(listings)}


@router.get("/listings/{listing_id}")
async def get_listing(listing_id: str):
    listing = await db.resell_listings.find_one({"listing_id": listing_id}, {"_id": 0})
    if not listing:
        raise HTTPException(404, "Listing nicht gefunden")
    await db.resell_listings.update_one({"listing_id": listing_id}, {"$inc": {"views": 1}})
    return listing


@router.post("/listings")
async def create_listing(req: ListingCreate, request: Request):
    user = await get_current_user(request)
    if user.get("role") != "admin" and user.get("kyc_status") != "approved":
        raise HTTPException(
            status_code=403,
            detail={
                "error": "kyc_required",
                "message": "KYC-Verifizierung erforderlich, bevor du Artikel verkaufen kannst.",
                "kyc_status": user.get("kyc_status", "not_started"),
            },
        )
    if req.category not in CATEGORIES:
        raise HTTPException(status_code=400, detail="Ungültige Kategorie")
    listing = {
        "listing_id": f"rl_{secrets.token_hex(8)}",
        "seller_email": user.get("email", ""),
        "seller_name": user.get("name", ""),
        "title": req.title,
        "description": req.description,
        "category": req.category,
        "price": round(req.price, 2),
        "condition": req.condition,
        "brand": req.brand,
        "size": req.size,
        "images": req.images,
        "status": "active",
        "views": 0,
        "likes": 0,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.resell_listings.insert_one(listing)
    listing.pop("_id", None)
    return {"ok": True, "listing": listing}


@router.post("/buy")
async def buy_listing(req: BuyRequest, request: Request):
    """Claim a listing once, escrow the gross amount, then settle seller + platform fee."""
    user = await get_current_user(request)
    buyer_email = str(user.get("email") or "").strip().lower()
    buyer_id = str(user.get("_id"))
    idem = _resell_idempotency_key(req.idempotency_key, request)
    marker = hashlib.sha256(
        f"{buyer_id}:{req.listing_id}:{idem}".encode("utf-8")
    ).hexdigest()[:20]
    purchase_id = f"RSL-{marker.upper()}"

    previous = await db.resell_transactions.find_one(
        {"purchase_id": purchase_id, "buyer_id": buyer_id},
        {"_id": 0},
    )
    if previous:
        return {
            "ok": True,
            "message": f"{previous.get('title', 'Artikel')} bereits gekauft.",
            "fee": previous.get("fee", 0),
            "purchase_id": purchase_id,
            "replayed": True,
        }

    listing = await db.resell_listings.find_one({"listing_id": req.listing_id})
    if not listing:
        raise HTTPException(404, "Listing nicht gefunden")
    if str(listing.get("seller_email") or "").strip().lower() == buyer_email:
        raise HTTPException(400, "Eigenes Listing kann nicht gekauft werden")

    if listing.get("status") == "sold":
        if listing.get("purchase_id") == purchase_id and listing.get("buyer_id") == buyer_id:
            return {
                "ok": True,
                "message": f"{listing['title']} bereits gekauft.",
                "fee": listing.get("platform_fee", 0),
                "purchase_id": purchase_id,
                "replayed": True,
            }
        raise HTTPException(status_code=409, detail="Listing wurde bereits verkauft")

    if listing.get("status") == "processing":
        if listing.get("purchase_id") != purchase_id or listing.get("buyer_id") != buyer_id:
            raise HTTPException(status_code=409, detail="Listing wird gerade von einem anderen Käufer gekauft")
    else:
        claim = await db.resell_listings.update_one(
            {"listing_id": req.listing_id, "status": "active"},
            {"$set": {
                "status": "processing",
                "purchase_id": purchase_id,
                "buyer_id": buyer_id,
                "buyer_email": buyer_email,
                "purchase_started_at": datetime.now(timezone.utc).isoformat(),
            }},
        )
        if claim.modified_count != 1:
            fresh = await db.resell_listings.find_one({"listing_id": req.listing_id}) or {}
            if fresh.get("purchase_id") != purchase_id or fresh.get("buyer_id") != buyer_id:
                raise HTTPException(status_code=409, detail="Listing wurde gerade von einem anderen Käufer reserviert")
            listing = fresh

    listing = await db.resell_listings.find_one(
        {"listing_id": req.listing_id, "purchase_id": purchase_id, "buyer_id": buyer_id}
    ) or listing

    price = round(float(listing.get("price") or 0), 2)
    if price <= 0:
        raise HTTPException(status_code=400, detail="Ungültiger Listing-Preis")
    fee = round(price * PLATFORM_FEE, 2)
    seller_payout = round(price - fee, 2)

    seller = await db.users.find_one({"email": listing["seller_email"]})
    if not seller:
        await db.resell_listings.update_one(
            {"listing_id": req.listing_id, "purchase_id": purchase_id, "status": "processing"},
            {"$set": {"status": "active"}, "$unset": {
                "purchase_id": "", "buyer_id": "", "buyer_email": "", "purchase_started_at": "",
            }},
        )
        raise HTTPException(404, "Verkäufer nicht gefunden")

    platform_id = await _resell_platform_user_id()
    if not platform_id:
        await db.resell_listings.update_one(
            {"listing_id": req.listing_id, "purchase_id": purchase_id, "status": "processing"},
            {"$set": {"status": "active"}, "$unset": {
                "purchase_id": "", "buyer_id": "", "buyer_email": "", "purchase_started_at": "",
            }},
        )
        raise HTTPException(status_code=503, detail="Resell-Settlement-Wallet ist nicht konfiguriert")
    if platform_id == buyer_id:
        raise HTTPException(status_code=409, detail="Plattform-Wallet darf nicht Käufer-Wallet sein")

    payment = await transfer_between_wallets(
        from_user_id=buyer_id,
        to_user_id=platform_id,
        amount=price,
        tx_type=TransactionType.RESALE_PURCHASE,
        description=f"Resell purchase: {listing['title']}",
        reference=f"RESALE-{purchase_id[-12:]}",
        metadata={
            "kind": "resell_escrow",
            "purchase_id": purchase_id,
            "listing_id": req.listing_id,
            "seller_id": str(seller["_id"]),
            "gross_amount": price,
            "fee_amount": fee,
            "net_amount": seller_payout,
        },
        idempotency_key=f"resell:escrow:{purchase_id}",
    )
    if not payment.success:
        status = str(getattr(payment.status, "value", payment.status))
        if status in {"pending", "reconciliation_required"}:
            await db.resell_listings.update_one(
                {"listing_id": req.listing_id, "purchase_id": purchase_id},
                {"$set": {
                    "settlement_status": "reconciliation_required",
                    "settlement_error": payment.error,
                }},
            )
        else:
            await db.resell_listings.update_one(
                {"listing_id": req.listing_id, "purchase_id": purchase_id, "status": "processing"},
                {"$set": {"status": "active"}, "$unset": {
                    "purchase_id": "", "buyer_id": "", "buyer_email": "", "purchase_started_at": "",
                }},
            )
        raise HTTPException(
            status_code=409 if status in {"pending", "reconciliation_required"} else 402,
            detail=payment.error or "Kauf fehlgeschlagen",
        )

    seller_credit = None
    seller_id = str(seller["_id"])
    if seller_id != platform_id and seller_payout > 0:
        seller_credit = await transfer_between_wallets(
            from_user_id=platform_id,
            to_user_id=seller_id,
            amount=seller_payout,
            tx_type=TransactionType.RESALE_SALE,
            description=f"Resell sale: {listing['title']}",
            reference=f"RESALE-SELL-{purchase_id[-10:]}",
            metadata={
                "kind": "resell_seller_settlement",
                "purchase_id": purchase_id,
                "listing_id": req.listing_id,
                "buyer_id": buyer_id,
                "gross_amount": price,
                "fee_amount": fee,
                "net_amount": seller_payout,
            },
            idempotency_key=f"resell:seller:{purchase_id}",
        )
        if not seller_credit.success:
            await db.resell_listings.update_one(
                {"listing_id": req.listing_id, "purchase_id": purchase_id},
                {"$set": {
                    "settlement_status": "reconciliation_required",
                    "settlement_error": seller_credit.error,
                    "buyer_payment_transaction_id": payment.transaction_id,
                }},
            )
            raise HTTPException(status_code=409, detail=seller_credit.error or "Verkäufer-Auszahlung benötigt Abstimmung")

    now = datetime.now(timezone.utc).isoformat()
    final = await db.resell_listings.update_one(
        {
            "listing_id": req.listing_id,
            "purchase_id": purchase_id,
            "buyer_id": buyer_id,
            "status": "processing",
        },
        {"$set": {
            "status": "sold",
            "sold_at": now,
            "platform_fee": fee,
            "seller_payout": seller_payout,
            "settlement_status": "completed",
            "buyer_payment_transaction_id": payment.transaction_id,
            "seller_payment_transaction_id": seller_credit.transaction_id if seller_credit else None,
        }},
    )
    if final.modified_count != 1:
        fresh = await db.resell_listings.find_one({"listing_id": req.listing_id}) or {}
        if fresh.get("status") != "sold" or fresh.get("purchase_id") != purchase_id:
            raise HTTPException(status_code=500, detail="Zahlung erfolgt; Listing-Abschluss benötigt Abstimmung")

    tx = {
        "_id": purchase_id,
        "purchase_id": purchase_id,
        "listing_id": req.listing_id,
        "title": listing["title"],
        "price": price,
        "fee": fee,
        "seller_payout": seller_payout,
        "seller_id": seller_id,
        "seller_email": listing["seller_email"],
        "buyer_id": buyer_id,
        "buyer_email": buyer_email,
        "payment_transaction_id": payment.transaction_id,
        "seller_transaction_id": seller_credit.transaction_id if seller_credit else None,
        "created_at": now,
    }
    await db.resell_transactions.update_one(
        {"_id": purchase_id},
        {"$setOnInsert": tx},
        upsert=True,
    )
    await db.platform_fees.update_one(
        {"_id": f"resell:{purchase_id}"},
        {"$setOnInsert": {
            "_id": f"resell:{purchase_id}",
            "type": "resell",
            "purchase_id": purchase_id,
            "listing_id": req.listing_id,
            "gross": price,
            "seller_payout": seller_payout,
            "platform_fee": fee,
            "created_at": now,
        }},
        upsert=True,
    )

    return {
        "ok": True,
        "message": f"{listing['title']} gekauft für €{price:.2f}!",
        "fee": fee,
        "purchase_id": purchase_id,
        "replayed": bool(
            payment.idempotent_replay
            or (seller_credit and seller_credit.idempotent_replay)
        ),
    }

@router.get("/my-listings")
async def my_listings(request: Request):
    user = await get_current_user(request)
    listings = await db.resell_listings.find(
        {"seller_email": user.get("email", "")}, {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    return {"listings": listings}


@router.get("/categories")
async def get_categories():
    return {"categories": CATEGORIES}


@router.get("/stats")
async def marketplace_stats():
    total = await db.resell_listings.count_documents({"status": "active"})
    sold = await db.resell_listings.count_documents({"status": "sold"})
    return {"active_listings": total, "total_sold": sold, "platform_fee_pct": PLATFORM_FEE * 100}
