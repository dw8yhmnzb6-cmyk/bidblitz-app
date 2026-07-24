"""
BidBlitz V2 - Immobilien-Marktplatz (Real Estate Marketplace)
Kaufen, Mieten, WG — mit Bildern, Filtern, Favoriten, Kontaktanfrage
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
from core.database import db
from core.security import get_current_user
import secrets

router = APIRouter(prefix="/api/real-estate", tags=["real-estate"])


# ═══ SEED DATA ═══

SEED_LISTINGS = [
    {
        "listing_id": "re_001",
        "title": "Moderne 3-Zimmer-Wohnung Berlin-Mitte",
        "type": "miete",
        "property_type": "wohnung",
        "price": 1450,
        "price_unit": "monat",
        "rooms": 3,
        "area_sqm": 85,
        "address": "Friedrichstraße 42, 10117 Berlin",
        "city": "Berlin",
        "district": "Mitte",
        "description": "Helle, renovierte 3-Zimmer-Wohnung mit Balkon und Einbauküche. Fußbodenheizung, Aufzug, Tiefgarage optional. 5 Min. zur U-Bahn.",
        "features": ["Balkon", "Einbauküche", "Fußbodenheizung", "Aufzug", "Keller"],
        "images": [
            "https://images.unsplash.com/photo-1638454795595-0a0abf68614d?w=800&q=80",
            "https://images.unsplash.com/photo-1772256019760-a144ae100cc4?w=800&q=80"
        ],
        "contact_name": "Müller Immobilien GmbH",
        "contact_phone": "+49 30 12345678",
        "available_from": "2026-03-01",
        "energy_class": "B",
        "floor": 3,
        "total_floors": 5,
        "year_built": 2019,
        "featured": True,
        "views": 342,
    },
    {
        "listing_id": "re_002",
        "title": "Luxus-Penthouse Hamburg HafenCity",
        "type": "kauf",
        "property_type": "wohnung",
        "price": 895000,
        "price_unit": "einmalig",
        "rooms": 4,
        "area_sqm": 145,
        "address": "Am Sandtorkai 18, 20457 Hamburg",
        "city": "Hamburg",
        "district": "HafenCity",
        "description": "Exklusives Penthouse mit Elbblick, Dachterrasse (40m²), Smart-Home-System, 2 Bäder, offene Küche. Tiefgaragenstellplatz inkl.",
        "features": ["Dachterrasse", "Elbblick", "Smart Home", "2 Bäder", "Tiefgarage", "Sauna"],
        "images": [
            "https://images.unsplash.com/photo-1762452059456-e4c16c256dd1?w=800&q=80",
            "https://images.unsplash.com/photo-1775138260921-883455954eb0?w=800&q=80"
        ],
        "contact_name": "Premium Estates Hamburg",
        "contact_phone": "+49 40 98765432",
        "available_from": "sofort",
        "energy_class": "A+",
        "floor": 6,
        "total_floors": 6,
        "year_built": 2023,
        "featured": True,
        "views": 891,
    },
    {
        "listing_id": "re_003",
        "title": "Einfamilienhaus mit Garten — München Süd",
        "type": "kauf",
        "property_type": "haus",
        "price": 1250000,
        "price_unit": "einmalig",
        "rooms": 6,
        "area_sqm": 210,
        "address": "Blumenweg 8, 81539 München",
        "city": "München",
        "district": "Giesing",
        "description": "Großzügiges Einfamilienhaus mit Garten (400m²), Garage, Kaminofen, Fußbodenheizung, Photovoltaikanlage. Ruhige Lage, S-Bahn 8 Min.",
        "features": ["Garten", "Garage", "Kamin", "Photovoltaik", "Fußbodenheizung"],
        "images": [
            "https://images.unsplash.com/photo-1622015663381-d2e05ae91b72?w=800&q=80",
            "https://images.unsplash.com/photo-1622015663319-e97e697503ee?w=800&q=80"
        ],
        "contact_name": "Bayerische Immobilien AG",
        "contact_phone": "+49 89 55443322",
        "available_from": "2026-06-01",
        "energy_class": "A",
        "floor": 0,
        "total_floors": 2,
        "year_built": 2021,
        "featured": False,
        "views": 567,
    },
    {
        "listing_id": "re_004",
        "title": "WG-Zimmer in Kreuzberg-Altbau",
        "type": "miete",
        "property_type": "wg",
        "price": 580,
        "price_unit": "monat",
        "rooms": 1,
        "area_sqm": 22,
        "address": "Oranienstraße 155, 10969 Berlin",
        "city": "Berlin",
        "district": "Kreuzberg",
        "description": "Gemütliches WG-Zimmer in 3er-WG, Altbau mit hohen Decken. Gemeinsames Bad und Küche. Waschmaschine vorhanden. Ideal für Studenten.",
        "features": ["Altbau", "Gemeinschaftsküche", "Waschmaschine", "Fahrradkeller"],
        "images": [
            "https://images.unsplash.com/photo-1638454795595-0a0abf68614d?w=800&q=80"
        ],
        "contact_name": "Lisa & Max",
        "contact_phone": "+49 176 44332211",
        "available_from": "2026-04-01",
        "energy_class": "D",
        "floor": 4,
        "total_floors": 5,
        "year_built": 1905,
        "featured": False,
        "views": 234,
    },
    {
        "listing_id": "re_005",
        "title": "Gewerbeimmobilie — Büro am Kurfürstendamm",
        "type": "miete",
        "property_type": "gewerbe",
        "price": 3200,
        "price_unit": "monat",
        "rooms": 8,
        "area_sqm": 180,
        "address": "Kurfürstendamm 123, 10711 Berlin",
        "city": "Berlin",
        "district": "Charlottenburg",
        "description": "Repräsentatives Büro am Ku'damm. Open Space + 3 Einzelbüros, Küche, 2 WC, Glasfaser 1Gbit. Perfekt für Startups oder Agenturen.",
        "features": ["Glasfaser", "Klimaanlage", "Open Space", "Aufzug", "Küche"],
        "images": [
            "https://images.unsplash.com/photo-1772256019760-a144ae100cc4?w=800&q=80"
        ],
        "contact_name": "CommerzReal Berlin",
        "contact_phone": "+49 30 99887766",
        "available_from": "sofort",
        "energy_class": "C",
        "floor": 2,
        "total_floors": 7,
        "year_built": 2015,
        "featured": True,
        "views": 189,
    },
    {
        "listing_id": "re_006",
        "title": "Ferienwohnung Sylt — Meerblick",
        "type": "miete",
        "property_type": "ferienhaus",
        "price": 2100,
        "price_unit": "monat",
        "rooms": 2,
        "area_sqm": 65,
        "address": "Strandweg 5, 25980 Sylt",
        "city": "Sylt",
        "district": "Westerland",
        "description": "Traumhafte Ferienwohnung mit direktem Meerblick. Möbliert, Terrasse, Strandkorb inkl. Ideal für Langzeiturlaub oder Remote Work.",
        "features": ["Meerblick", "Möbliert", "Terrasse", "Strandkorb", "WLAN"],
        "images": [
            "https://images.unsplash.com/photo-1757439402101-55d1da381e70?w=800&q=80"
        ],
        "contact_name": "Sylt Premium Ferien",
        "contact_phone": "+49 4651 112233",
        "available_from": "2026-05-01",
        "energy_class": "B",
        "floor": 1,
        "total_floors": 2,
        "year_built": 2020,
        "featured": True,
        "views": 723,
    },
    {
        "listing_id": "re_007",
        "title": "Neubau-Wohnung Frankfurt Europaviertel",
        "type": "kauf",
        "property_type": "wohnung",
        "price": 520000,
        "price_unit": "einmalig",
        "rooms": 3,
        "area_sqm": 92,
        "address": "Europa-Allee 88, 60327 Frankfurt",
        "city": "Frankfurt",
        "district": "Europaviertel",
        "description": "Erstbezug! Moderne 3-Zimmer mit Loggia, Parkett, Fußbodenheizung, Gäste-WC. Nahe Skyline Plaza und S-Bahn.",
        "features": ["Neubau", "Loggia", "Parkett", "Gäste-WC", "Tiefgarage"],
        "images": [
            "https://images.unsplash.com/photo-1774685110718-c5b4fe026144?w=800&q=80",
            "https://images.unsplash.com/photo-1775138260921-883455954eb0?w=800&q=80"
        ],
        "contact_name": "Frankfurter Wohnbau GmbH",
        "contact_phone": "+49 69 77665544",
        "available_from": "2026-08-01",
        "energy_class": "A",
        "floor": 4,
        "total_floors": 8,
        "year_built": 2026,
        "featured": False,
        "views": 412,
    },
]


@router.on_event("startup")
async def seed_real_estate():
    count = await db.real_estate.count_documents({})
    if count == 0:
        now = datetime.now(timezone.utc).isoformat()
        for listing in SEED_LISTINGS:
            listing["created_at"] = now
            listing["status"] = "active"
            listing["favorites_count"] = 0
        await db.real_estate.insert_many(SEED_LISTINGS)


# ═══ PUBLIC ENDPOINTS ═══

@router.get("/listings")
async def get_listings(
    type: Optional[str] = None,
    property_type: Optional[str] = None,
    city: Optional[str] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    min_rooms: Optional[int] = None,
    min_area: Optional[int] = None,
):
    query = {"status": "active"}
    if type:
        query["type"] = type
    if property_type:
        query["property_type"] = property_type
    if city:
        query["city"] = {"$regex": city, "$options": "i"}
    if min_price is not None:
        query.setdefault("price", {})["$gte"] = min_price
    if max_price is not None:
        query.setdefault("price", {})["$lte"] = max_price
    if min_rooms:
        query["rooms"] = {"$gte": min_rooms}
    if min_area:
        query["area_sqm"] = {"$gte": min_area}

    listings = await db.real_estate.find(query, {"_id": 0}).sort("featured", -1).to_list(100)
    return {"listings": listings, "total": len(listings)}


@router.get("/listing/{listing_id}")
async def get_listing(listing_id: str):
    listing = await db.real_estate.find_one({"listing_id": listing_id}, {"_id": 0})
    if not listing:
        raise HTTPException(status_code=404, detail="Inserat nicht gefunden")
    await db.real_estate.update_one({"listing_id": listing_id}, {"$inc": {"views": 1}})
    return listing


@router.get("/cities")
async def get_cities():
    cities = await db.real_estate.distinct("city")
    return {"cities": sorted(cities)}


# ═══ AUTHENTICATED ENDPOINTS ═══

class ContactRequest(BaseModel):
    listing_id: str
    message: str = ""
    phone: str = ""

@router.post("/contact")
async def send_contact_request(req: ContactRequest, request: Request):
    user = await get_current_user(request)
    listing = await db.real_estate.find_one({"listing_id": req.listing_id}, {"_id": 0})
    if not listing:
        raise HTTPException(status_code=404, detail="Inserat nicht gefunden")

    contact = {
        "contact_id": secrets.token_hex(8),
        "listing_id": req.listing_id,
        "listing_title": listing.get("title", ""),
        "user_email": user.get("email", ""),
        "user_name": user.get("name", ""),
        "message": req.message,
        "phone": req.phone,
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.real_estate_contacts.insert_one(contact)
    contact.pop("_id", None)
    return {"ok": True, "contact": contact}


class ToggleFavorite(BaseModel):
    listing_id: str

@router.post("/favorite")
async def toggle_favorite(req: ToggleFavorite, request: Request):
    user = await get_current_user(request)
    user_email = user.get("email", "")

    existing = await db.real_estate_favorites.find_one({"user_email": user_email, "listing_id": req.listing_id})
    if existing:
        await db.real_estate_favorites.delete_one({"user_email": user_email, "listing_id": req.listing_id})
        await db.real_estate.update_one({"listing_id": req.listing_id}, {"$inc": {"favorites_count": -1}})
        return {"ok": True, "favorited": False}
    else:
        await db.real_estate_favorites.insert_one({
            "user_email": user_email,
            "listing_id": req.listing_id,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        await db.real_estate.update_one({"listing_id": req.listing_id}, {"$inc": {"favorites_count": 1}})
        return {"ok": True, "favorited": True}


@router.get("/favorites")
async def get_favorites(request: Request):
    user = await get_current_user(request)
    favs = await db.real_estate_favorites.find({"user_email": user.get("email", "")}, {"_id": 0}).to_list(100)
    fav_ids = [f["listing_id"] for f in favs]
    listings = await db.real_estate.find({"listing_id": {"$in": fav_ids}}, {"_id": 0}).to_list(100)
    return {"favorites": listings}


@router.get("/stats")
async def get_stats():
    total = await db.real_estate.count_documents({"status": "active"})
    miete = await db.real_estate.count_documents({"status": "active", "type": "miete"})
    kauf = await db.real_estate.count_documents({"status": "active", "type": "kauf"})
    cities = await db.real_estate.distinct("city")
    return {"total": total, "miete": miete, "kauf": kauf, "cities": len(cities)}
