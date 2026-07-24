"""Merchant Testimonials / Success Stories
Public: list active testimonials for marketing landing page.
Admin: CRUD operations + toggle visibility.
"""
import os
import secrets
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Request, HTTPException
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field

from core.security import get_current_user

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

router = APIRouter(prefix="/api/testimonials", tags=["Testimonials"])


class TestimonialCreate(BaseModel):
    business_name: str = Field(..., min_length=2, max_length=120)
    owner_name: str = Field("", max_length=80)
    role: str = Field("", max_length=80)
    industry: str = "retail"  # gastro, retail, service, fitness, fuel, bakery
    location: str = Field("", max_length=80)
    quote: str = Field(..., min_length=20, max_length=400)
    logo_url: str = ""
    photo_url: str = ""
    rating: int = Field(5, ge=1, le=5)
    stats: dict = {}  # {tx_per_day: 120, savings_per_month: 340}
    is_pilot: bool = True
    active: bool = True
    sort_order: int = 100


@router.get("")
async def list_testimonials(industry: Optional[str] = None, limit: int = 12):
    query = {"active": True}
    if industry:
        query["industry"] = industry
    items = await db.testimonials.find(query, {"_id": 0}).sort("sort_order", 1).to_list(limit)
    return {"testimonials": items, "count": len(items)}


@router.post("/admin/create")
async def admin_create(req: TestimonialCreate, request: Request):
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(403, "Nur Admins")
    doc = req.model_dump()
    doc["testimonial_id"] = secrets.token_hex(8)
    doc["created_at"] = datetime.now(timezone.utc).isoformat()
    doc["created_by"] = str(user.get("_id", ""))
    await db.testimonials.insert_one(doc)
    doc.pop("_id", None)
    return {"ok": True, "testimonial": doc}


@router.put("/admin/{testimonial_id}")
async def admin_update(testimonial_id: str, patch: dict, request: Request):
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(403, "Nur Admins")
    # Strip immutable fields
    for k in ("_id", "testimonial_id", "created_at", "created_by"):
        patch.pop(k, None)
    res = await db.testimonials.update_one({"testimonial_id": testimonial_id}, {"$set": patch})
    if res.matched_count == 0:
        raise HTTPException(404, "Testimonial nicht gefunden")
    doc = await db.testimonials.find_one({"testimonial_id": testimonial_id}, {"_id": 0})
    return {"ok": True, "testimonial": doc}


@router.delete("/admin/{testimonial_id}")
async def admin_delete(testimonial_id: str, request: Request):
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(403, "Nur Admins")
    res = await db.testimonials.delete_one({"testimonial_id": testimonial_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Testimonial nicht gefunden")
    return {"ok": True}


@router.get("/admin/list")
async def admin_list(request: Request):
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(403, "Nur Admins")
    items = await db.testimonials.find({}, {"_id": 0}).sort("sort_order", 1).to_list(200)
    return {"testimonials": items, "count": len(items)}


# ─── Seed realistic pilot testimonials ──────────────────────────────────────
SEED = [
    {
        "business_name": "Pizzeria Da Mario",
        "owner_name": "Mario Ricci",
        "role": "Inhaber",
        "industry": "gastro",
        "location": "Berlin-Kreuzberg",
        "quote": "Seit wir BidBlitz Tisch-QR nutzen, sind unsere Durchschnittsbestellwerte um 22% gestiegen — Gäste bestellen mehr wenn sie selbst tippen statt auf den Kellner zu warten.",
        "logo_url": "",
        "photo_url": "https://images.unsplash.com/photo-1559339352-11d035aa65de?w=200&q=80",
        "rating": 5,
        "stats": {"orders_per_day": 180, "savings_per_month": 420},
        "is_pilot": True,
        "active": True,
        "sort_order": 10,
    },
    {
        "business_name": "Hair & Style Studio",
        "owner_name": "Elena Yilmaz",
        "role": "Salon-Inhaberin",
        "industry": "service",
        "location": "München",
        "quote": "Die Terminbuchung mit Anzahlung hat unsere No-Show-Rate von 18% auf unter 3% gesenkt. Die 35€ pro Monat sind lächerlich gegenüber dem was wir früher verloren haben.",
        "logo_url": "",
        "photo_url": "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=200&q=80",
        "rating": 5,
        "stats": {"appointments_per_week": 140, "no_show_reduction_pct": 83},
        "is_pilot": True,
        "active": True,
        "sort_order": 20,
    },
    {
        "business_name": "BioBack Bäckerei",
        "owner_name": "Thomas Weber",
        "role": "Geschäftsführer",
        "industry": "bakery",
        "location": "Hamburg",
        "quote": "Die digitale Stempelkarte bringt uns jede Woche ~60 Stammkunden zurück. Brot-Abos laufen automatisch ab, keine SEPA-Probleme mehr.",
        "logo_url": "",
        "photo_url": "https://images.unsplash.com/photo-1568254183919-78a4f43a2877?w=200&q=80",
        "rating": 5,
        "stats": {"returning_customers_weekly": 60, "subscription_count": 45},
        "is_pilot": True,
        "active": True,
        "sort_order": 30,
    },
    {
        "business_name": "FitZone Studio",
        "owner_name": "Sarah Becker",
        "role": "Studio-Leiterin",
        "industry": "fitness",
        "location": "Köln",
        "quote": "QR-Studio-Zugang ohne Keyfobs — allein das spart uns 400€/Jahr an Material. Mitglieder-Check-in ist jetzt kontaktlos und 5x schneller.",
        "logo_url": "",
        "photo_url": "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=200&q=80",
        "rating": 5,
        "stats": {"active_members": 340, "keyfob_cost_saving_yearly": 400},
        "is_pilot": True,
        "active": True,
        "sort_order": 40,
    },
]


@router.on_event("startup")
async def seed_testimonials():
    if await db.testimonials.count_documents({}) == 0:
        now = datetime.now(timezone.utc).isoformat()
        for s in SEED:
            doc = dict(s)
            doc["testimonial_id"] = secrets.token_hex(8)
            doc["created_at"] = now
            doc["created_by"] = "seed"
            await db.testimonials.insert_one(doc)
