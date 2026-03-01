"""
BidBlitz Marketplace - Kleinanzeigen für Kosovo/Dubai/Abu Dhabi/Deutschland
Kategorien: Immobilien, Autos, Elektronik, Dienstleistungen, Jobs
+ Bezahlte Werbung (Admin revenue)
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
import uuid

from dependencies import get_current_user, get_admin_user
from config import db

router = APIRouter(prefix="/marketplace", tags=["Marketplace"])

CATEGORIES = ["Immobilien", "Autos", "Elektronik", "Mode", "Dienstleistungen", "Jobs", "Möbel", "Sonstiges"]
REGIONS = ["Kosovo", "Dubai", "Abu Dhabi", "Deutschland"]
AD_PRICES = {"basic": 0, "highlight": 500, "top": 1500, "premium": 3000}  # cents


class ListingCreate(BaseModel):
    title: str
    description: str
    category: str
    region: str
    price_eur: Optional[float] = None
    images: Optional[List[str]] = None
    contact_phone: Optional[str] = None
    contact_email: Optional[str] = None
    ad_type: str = "basic"  # basic, highlight, top, premium


@router.get("/categories")
async def get_categories():
    return {"categories": CATEGORIES, "regions": REGIONS, "ad_types": [
        {"id": "basic", "name": "Kostenlos", "price_cents": 0, "features": ["30 Tage sichtbar"]},
        {"id": "highlight", "name": "Highlight", "price_cents": 500, "features": ["30 Tage", "Farbige Hervorhebung"]},
        {"id": "top", "name": "Top-Anzeige", "price_cents": 1500, "features": ["30 Tage", "Oben in der Liste", "Hervorhebung"]},
        {"id": "premium", "name": "Premium", "price_cents": 3000, "features": ["60 Tage", "Ganz oben", "Badge", "Mehr Sichtbarkeit"]},
    ]}


@router.get("/listings")
async def get_listings(category: str = None, region: str = None, search: str = None, limit: int = 50):
    query = {"status": "active"}
    if category: query["category"] = category
    if region: query["region"] = region
    if search: query["title"] = {"$regex": search, "$options": "i"}

    listings = await db.marketplace_listings.find(query, {"_id": 0}).sort([("ad_type_rank", -1), ("created_at", -1)]).to_list(limit)
    return {"listings": listings, "count": len(listings)}


@router.post("/listings")
async def create_listing(data: ListingCreate, user: dict = Depends(get_current_user)):
    if data.category not in CATEGORIES:
        raise HTTPException(400, f"Kategorie muss eine von: {CATEGORIES}")
    if data.region not in REGIONS:
        raise HTTPException(400, f"Region muss eine von: {REGIONS}")

    ad_cost = AD_PRICES.get(data.ad_type, 0)
    if ad_cost > 0:
        balance = user.get("wallet_balance_cents", 0)
        if balance < ad_cost:
            raise HTTPException(402, f"Nicht genug Guthaben für {data.ad_type} Anzeige ({ad_cost/100:.2f} EUR)")
        await db.users.update_one({"id": user["id"]}, {"$inc": {"wallet_balance_cents": -ad_cost}})
        # Platform revenue
        platform = await db.users.find_one({"email": "platform@bidblitz.ae"})
        if platform:
            await db.users.update_one({"id": platform["id"]}, {"$inc": {"wallet_balance_cents": ad_cost}})

    rank = {"basic": 0, "highlight": 1, "top": 2, "premium": 3}.get(data.ad_type, 0)
    listing = {
        "id": str(uuid.uuid4()), "user_id": user["id"], "user_name": user.get("name"),
        "title": data.title, "description": data.description,
        "category": data.category, "region": data.region,
        "price_eur": data.price_eur, "images": data.images or [],
        "contact_phone": data.contact_phone, "contact_email": data.contact_email or user.get("email"),
        "ad_type": data.ad_type, "ad_type_rank": rank, "ad_cost_cents": ad_cost,
        "status": "active", "views": 0,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.marketplace_listings.insert_one(listing)
    listing.pop("_id", None)
    return {"success": True, "listing": listing}


@router.get("/listings/{listing_id}")
async def get_listing(listing_id: str):
    l = await db.marketplace_listings.find_one({"id": listing_id}, {"_id": 0})
    if not l: raise HTTPException(404, "Nicht gefunden")
    await db.marketplace_listings.update_one({"id": listing_id}, {"$inc": {"views": 1}})
    return {"listing": l}


@router.delete("/listings/{listing_id}")
async def delete_listing(listing_id: str, user: dict = Depends(get_current_user)):
    r = await db.marketplace_listings.update_one({"id": listing_id, "user_id": user["id"]}, {"$set": {"status": "deleted"}})
    if r.matched_count == 0: raise HTTPException(404, "Nicht gefunden")
    return {"success": True}


@router.get("/my")
async def my_listings(user: dict = Depends(get_current_user)):
    listings = await db.marketplace_listings.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(50)
    return {"listings": listings}


# Admin
@router.get("/admin/stats")
async def admin_stats(admin: dict = Depends(get_admin_user)):
    total = await db.marketplace_listings.count_documents({})
    active = await db.marketplace_listings.count_documents({"status": "active"})
    pipeline = [{"$match": {"ad_cost_cents": {"$gt": 0}}}, {"$group": {"_id": None, "revenue": {"$sum": "$ad_cost_cents"}, "count": {"$sum": 1}}}]
    rev = await db.marketplace_listings.aggregate(pipeline).to_list(1)
    return {"total": total, "active": active, "ad_revenue_cents": rev[0]["revenue"] if rev else 0, "paid_ads": rev[0]["count"] if rev else 0}


@router.post("/admin/remove/{listing_id}")
async def admin_remove(listing_id: str, admin: dict = Depends(get_admin_user)):
    await db.marketplace_listings.update_one({"id": listing_id}, {"$set": {"status": "removed_by_admin"}})
    return {"success": True}
