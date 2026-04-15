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
import secrets

router = APIRouter(prefix="/api/resell", tags=["reselling"])

PLATFORM_FEE = 0.08  # 8%
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
    user = await get_current_user(request)
    buyer_email = user.get("email", "")

    listing = await db.resell_listings.find_one({"listing_id": req.listing_id, "status": "active"})
    if not listing:
        raise HTTPException(404, "Listing nicht verfügbar")
    if listing["seller_email"] == buyer_email:
        raise HTTPException(400, "Eigenes Listing kann nicht gekauft werden")

    price = listing["price"]
    fee = round(price * PLATFORM_FEE, 2)
    seller_payout = round(price - fee, 2)

    buyer = await db.users.find_one({"email": buyer_email})
    if not buyer or buyer.get("balance", 0) < price:
        raise HTTPException(400, f"Nicht genug Guthaben. Benötigt: €{price:.2f}")

    # Deduct from buyer
    await db.users.update_one({"email": buyer_email}, {"$inc": {"balance": -price}})
    # Pay seller
    await db.users.update_one({"email": listing["seller_email"]}, {"$inc": {"balance": seller_payout}})

    # Mark sold
    await db.resell_listings.update_one(
        {"listing_id": req.listing_id},
        {"$set": {"status": "sold", "buyer_email": buyer_email,
                  "sold_at": datetime.now(timezone.utc).isoformat(),
                  "platform_fee": fee, "seller_payout": seller_payout}}
    )

    # Record transaction
    await db.resell_transactions.insert_one({
        "tx_id": secrets.token_hex(8),
        "listing_id": req.listing_id,
        "title": listing["title"],
        "price": price,
        "fee": fee,
        "seller_email": listing["seller_email"],
        "buyer_email": buyer_email,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })

    return {"ok": True, "message": f"{listing['title']} gekauft für €{price:.2f}!", "fee": fee}


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
