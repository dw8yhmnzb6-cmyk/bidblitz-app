# BidBlitz Hotels/Airbnb Booking System
# Full Airbnb-style listings + bookings with Genius Level discounts
# Updated: 2026-03-03

from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone
from typing import Any, Optional, List, Dict

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from config import db
from dependencies import get_current_user
from utils.genius import add_activity

router = APIRouter(prefix="/hotels-airbnb", tags=["Hotels/Airbnb"])

HOTELS_PLATFORM_FEE_PCT = float(os.getenv("HOTELS_PLATFORM_FEE_PCT", "12"))

def _now() -> datetime:
    return datetime.now(timezone.utc)

def _id() -> str:
    return str(int(_now().timestamp() * 1000))

def calc_level(total_bookings: int, total_spent_cents: int) -> Dict[str, int]:
    """Genius Level System"""
    spent_eur = total_spent_cents / 100
    level = 1
    discount_pct = 10
    if total_bookings >= 5 or spent_eur >= 500:
        level = 2
        discount_pct = 15
    if total_bookings >= 15 or spent_eur >= 1500:
        level = 3
        discount_pct = 20
    return {"level": level, "discount_pct": discount_pct}

# -------------------------
# MODELS
# -------------------------

class ListingCreate(BaseModel):
    title: str
    region: str = Field(..., description="z.B. Kosovo / Deutschland / UAE")
    city: str
    address: Optional[str] = None
    description: Optional[str] = None
    price_per_night_cents: int = Field(..., ge=0)
    max_guests: int = Field(1, ge=1)
    photos: List[str] = []
    amenities: List[str] = []
    property_type: str = "apartment"

class ListingOut(BaseModel):
    id: str
    title: str
    region: str
    city: str
    address: Optional[str] = None
    description: Optional[str] = None
    price_per_night_cents: int
    max_guests: int
    photos: List[str]
    host_user_id: str
    created_at: str

class BookingCreate(BaseModel):
    listing_id: str
    checkin: str
    checkout: str
    guests: int = Field(1, ge=1)

class BookingOut(BaseModel):
    id: str
    listing_id: str
    host_user_id: str
    guest_user_id: str
    checkin: str
    checkout: str
    nights: int
    guests: int
    subtotal_cents: int
    discount_pct: int
    discounted_subtotal_cents: int
    platform_fee_pct: float
    platform_fee_cents: int
    host_payout_cents: int
    status: str
    created_at: str

# -------------------------
# SAMPLE DATA
# -------------------------

SAMPLE_LISTINGS = [
    {
        "id": "listing-1",
        "title": "Luxus-Apartment mit Burj Khalifa Blick",
        "region": "UAE",
        "city": "Dubai",
        "address": "Downtown Dubai, Sheikh Mohammed Blvd",
        "description": "Atemberaubende Aussicht auf den Burj Khalifa. Modernes 2-Zimmer-Apartment mit Pool und Fitnessstudio.",
        "price_per_night_cents": 35000,
        "max_guests": 4,
        "photos": ["https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800", "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800"],
        "amenities": ["WiFi", "Pool", "Gym", "Parkplatz", "Klimaanlage"],
        "property_type": "apartment",
        "host_user_id": "host-dubai-1",
        "host_name": "Mohammed",
        "rating": 4.9,
        "reviews": 127,
        "created_at": "2026-01-15T10:00:00Z"
    },
    {
        "id": "listing-2",
        "title": "Palm Jumeirah Villa mit Privatstrand",
        "region": "UAE",
        "city": "Dubai",
        "address": "Palm Jumeirah, Frond M",
        "description": "Exklusive 5-Zimmer-Villa direkt am Strand. Privater Pool, Garten und atemberaubender Meerblick.",
        "price_per_night_cents": 150000,
        "max_guests": 10,
        "photos": ["https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=800", "https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=800"],
        "amenities": ["Privatstrand", "Pool", "Garten", "WiFi", "Klimaanlage", "Butler-Service"],
        "property_type": "villa",
        "host_user_id": "host-dubai-2",
        "host_name": "Sara",
        "rating": 5.0,
        "reviews": 43,
        "created_at": "2026-01-20T10:00:00Z"
    },
    {
        "id": "listing-3",
        "title": "Marina Studio mit Meerblick",
        "region": "UAE",
        "city": "Dubai",
        "address": "Dubai Marina, JBR Walk",
        "description": "Gemütliches Studio in bester Lage. Fußweg zum Strand und zur Marina Mall.",
        "price_per_night_cents": 18000,
        "max_guests": 2,
        "photos": ["https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800"],
        "amenities": ["WiFi", "Klimaanlage", "Küche", "Waschmaschine"],
        "property_type": "studio",
        "host_user_id": "host-dubai-3",
        "host_name": "Ahmed",
        "rating": 4.7,
        "reviews": 89,
        "created_at": "2026-02-01T10:00:00Z"
    },
    {
        "id": "listing-4",
        "title": "Modernes Apartment in Prishtina Zentrum",
        "region": "Kosovo",
        "city": "Prishtina",
        "address": "Bulevardi Nëna Terezë",
        "description": "Zentral gelegenes Apartment nahe der Hauptstraße. Perfekt für Geschäftsreisende.",
        "price_per_night_cents": 6500,
        "max_guests": 3,
        "photos": ["https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=800"],
        "amenities": ["WiFi", "Klimaanlage", "Küche", "Balkon"],
        "property_type": "apartment",
        "host_user_id": "host-kosovo-1",
        "host_name": "Besnik",
        "rating": 4.8,
        "reviews": 156,
        "created_at": "2026-01-10T10:00:00Z"
    },
    {
        "id": "listing-5",
        "title": "Traditionelles Steinhaus in Prizren",
        "region": "Kosovo",
        "city": "Prizren",
        "address": "Altstadt, Shadervan",
        "description": "Authentisches osmanisches Steinhaus mit modernem Komfort. Blick auf die Festung.",
        "price_per_night_cents": 8500,
        "max_guests": 6,
        "photos": ["https://images.unsplash.com/photo-1518780664697-55e3ad937233?w=800"],
        "amenities": ["WiFi", "Terrasse", "Historisches Ambiente", "Küche"],
        "property_type": "house",
        "host_user_id": "host-kosovo-2",
        "host_name": "Arta",
        "rating": 4.9,
        "reviews": 78,
        "created_at": "2026-01-25T10:00:00Z"
    },
    {
        "id": "listing-6",
        "title": "Berliner Loft in Kreuzberg",
        "region": "Deutschland",
        "city": "Berlin",
        "address": "Kreuzberg, Bergmannstraße",
        "description": "Stylisches Loft im Herzen von Kreuzberg. Cafés, Bars und Kultur direkt vor der Tür.",
        "price_per_night_cents": 12000,
        "max_guests": 4,
        "photos": ["https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800"],
        "amenities": ["WiFi", "Küche", "Waschmaschine", "Fahrräder"],
        "property_type": "loft",
        "host_user_id": "host-de-1",
        "host_name": "Max",
        "rating": 4.6,
        "reviews": 234,
        "created_at": "2026-02-05T10:00:00Z"
    },
    {
        "id": "listing-7",
        "title": "Münchner Altbau nahe Marienplatz",
        "region": "Deutschland",
        "city": "München",
        "address": "Altstadt, Sendlinger Tor",
        "description": "Charmanter Altbau mit hohen Decken. 5 Minuten zum Marienplatz.",
        "price_per_night_cents": 15000,
        "max_guests": 3,
        "photos": ["https://images.unsplash.com/photo-1484154218962-a197022b5858?w=800"],
        "amenities": ["WiFi", "Küche", "Historischer Charme"],
        "property_type": "apartment",
        "host_user_id": "host-de-2",
        "host_name": "Lisa",
        "rating": 4.8,
        "reviews": 167,
        "created_at": "2026-02-10T10:00:00Z"
    },
    {
        "id": "listing-8",
        "title": "Abu Dhabi Luxus-Suite",
        "region": "UAE",
        "city": "Abu Dhabi",
        "address": "Corniche Road",
        "description": "Elegante Suite mit Blick auf die Corniche. Nahe der Sheikh Zayed Moschee.",
        "price_per_night_cents": 28000,
        "max_guests": 2,
        "photos": ["https://images.unsplash.com/photo-1618773928121-c32242e63f39?w=800"],
        "amenities": ["WiFi", "Pool", "Gym", "Concierge", "Frühstück"],
        "property_type": "suite",
        "host_user_id": "host-abudhabi-1",
        "host_name": "Fatima",
        "rating": 4.9,
        "reviews": 56,
        "created_at": "2026-02-15T10:00:00Z"
    }
]

# -------------------------
# LISTINGS ENDPOINTS
# -------------------------

@router.get("/listings")
async def search_listings(
    region: Optional[str] = None,
    city: Optional[str] = None,
    q: Optional[str] = None,
    guests: Optional[int] = Query(None, ge=1),
    max_price_cents: Optional[int] = Query(None, ge=0),
    min_price_cents: Optional[int] = Query(None, ge=0),
    property_type: Optional[str] = None,
    limit: int = Query(50, ge=1, le=200),
):
    """Search listings with filters"""
    # First check DB
    query: Dict[str, Any] = {}
    if region:
        query["region"] = {"$regex": region, "$options": "i"}
    if city:
        query["city"] = {"$regex": city, "$options": "i"}
    if guests:
        query["max_guests"] = {"$gte": guests}
    if max_price_cents is not None:
        query["price_per_night_cents"] = {"$lte": max_price_cents}
    if property_type:
        query["property_type"] = property_type
    if q:
        query["$or"] = [
            {"title": {"$regex": q, "$options": "i"}},
            {"description": {"$regex": q, "$options": "i"}},
            {"city": {"$regex": q, "$options": "i"}},
        ]

    listings = []
    cursor = db.hotel_listings.find(query).sort("created_at", -1).limit(limit)
    async for doc in cursor:
        doc["_id"] = str(doc["_id"])
        listings.append(doc)
    
    # If no DB results, use sample data
    if not listings:
        listings = SAMPLE_LISTINGS.copy()
        
        # Apply filters to sample data
        if region:
            listings = [l for l in listings if region.lower() in l["region"].lower()]
        if city:
            listings = [l for l in listings if city.lower() in l["city"].lower()]
        if guests:
            listings = [l for l in listings if l["max_guests"] >= guests]
        if max_price_cents:
            listings = [l for l in listings if l["price_per_night_cents"] <= max_price_cents]
        if min_price_cents:
            listings = [l for l in listings if l["price_per_night_cents"] >= min_price_cents]
        if property_type:
            listings = [l for l in listings if l.get("property_type") == property_type]
        if q:
            q_lower = q.lower()
            listings = [l for l in listings if q_lower in l["title"].lower() or q_lower in l.get("description", "").lower() or q_lower in l["city"].lower()]
    
    return {"listings": listings[:limit], "total": len(listings)}

@router.get("/listings/{listing_id}")
async def get_listing(listing_id: str):
    """Get single listing details"""
    doc = await db.hotel_listings.find_one({"id": listing_id})
    if doc:
        doc["_id"] = str(doc["_id"])
        return doc
    
    # Check sample data
    for listing in SAMPLE_LISTINGS:
        if listing["id"] == listing_id:
            return listing
    
    raise HTTPException(404, "Listing not found")

@router.post("/listings")
async def create_listing(payload: ListingCreate, user=Depends(get_current_user)):
    """Create new listing (host)"""
    listing = {
        "id": _id(),
        "title": payload.title,
        "region": payload.region,
        "city": payload.city,
        "address": payload.address,
        "description": payload.description,
        "price_per_night_cents": payload.price_per_night_cents,
        "max_guests": payload.max_guests,
        "photos": payload.photos,
        "amenities": payload.amenities,
        "property_type": payload.property_type,
        "host_user_id": str(user["id"]),
        "host_name": user.get("name", "Host"),
        "rating": 0,
        "reviews": 0,
        "created_at": _now().isoformat(),
    }
    await db.hotel_listings.insert_one(listing)
    listing.pop("_id", None)
    return {"success": True, "listing": listing}

# -------------------------
# BOOKING ENDPOINTS
# -------------------------

def _parse_date(s: str) -> datetime:
    try:
        dt = datetime.fromisoformat(s)
    except Exception:
        dt = datetime.fromisoformat(s + "T00:00:00")
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)

@router.post("/bookings")
async def create_booking(payload: BookingCreate, user=Depends(get_current_user)):
    """Create booking with automatic Genius Level discount"""
    guest_user_id = str(user["id"])

    # Find listing
    listing = await db.hotel_listings.find_one({"id": payload.listing_id})
    if not listing:
        # Check sample data
        listing = next((l for l in SAMPLE_LISTINGS if l["id"] == payload.listing_id), None)
    
    if not listing:
        raise HTTPException(404, "Listing not found")

    if payload.guests > int(listing.get("max_guests", 1)):
        raise HTTPException(400, "Too many guests for this listing")

    checkin = _parse_date(payload.checkin)
    checkout = _parse_date(payload.checkout)
    if checkout <= checkin:
        raise HTTPException(400, "Checkout must be after checkin")

    nights = int((checkout - checkin).days)
    if nights <= 0:
        raise HTTPException(400, "Invalid number of nights")

    # Get user's Genius level from genius collection
    genius_doc = await db.genius.find_one({"user_id": guest_user_id})
    if genius_doc:
        total_bookings = genius_doc.get("total_bookings", 0)
        total_spent_cents = genius_doc.get("total_spent_cents", 0)
    else:
        total_bookings = 0
        total_spent_cents = 0

    level_info = calc_level(total_bookings, total_spent_cents)
    discount_pct = int(level_info["discount_pct"])
    level = level_info["level"]

    # Calculate prices
    price_per_night_cents = int(listing["price_per_night_cents"])
    subtotal_cents = price_per_night_cents * nights
    discount_cents = int(round(subtotal_cents * (discount_pct / 100)))
    discounted_subtotal_cents = subtotal_cents - discount_cents

    platform_fee_cents = int(round(discounted_subtotal_cents * (HOTELS_PLATFORM_FEE_PCT / 100.0)))
    host_payout_cents = max(0, discounted_subtotal_cents - platform_fee_cents)

    # Create booking
    booking_id = _id()
    booking = {
        "id": booking_id,
        "listing_id": payload.listing_id,
        "listing_title": listing.get("title", ""),
        "listing_photo": listing.get("photos", [""])[0] if listing.get("photos") else "",
        "host_user_id": str(listing.get("host_user_id", "")),
        "host_name": listing.get("host_name", "Host"),
        "guest_user_id": guest_user_id,
        "guest_name": user.get("name", "Guest"),
        "checkin": checkin.date().isoformat(),
        "checkout": checkout.date().isoformat(),
        "nights": nights,
        "guests": payload.guests,
        "price_per_night_cents": price_per_night_cents,
        "subtotal_cents": subtotal_cents,
        "discount_pct": discount_pct,
        "discount_cents": discount_cents,
        "discounted_subtotal_cents": discounted_subtotal_cents,
        "platform_fee_pct": HOTELS_PLATFORM_FEE_PCT,
        "platform_fee_cents": platform_fee_cents,
        "host_payout_cents": host_payout_cents,
        "user_level": level,
        "status": "confirmed",
        "payout_status": "pending",
        "created_at": _now().isoformat(),
    }
    await db.hotel_bookings.insert_one(booking)

    # Update Genius stats
    await add_activity(
        db,
        guest_user_id,
        spend_cents=discounted_subtotal_cents,
        booking_inc=1,
        reason="airbnb_booking",
        meta={"booking_id": booking_id, "listing_id": payload.listing_id}
    )

    # Check for level up
    new_genius = await db.genius.find_one({"user_id": guest_user_id})
    new_level_info = calc_level(
        new_genius.get("total_bookings", 0),
        new_genius.get("total_spent_cents", 0)
    )
    level_up = new_level_info["level"] > level

    return {
        "success": True,
        "booking": {
            "id": booking_id,
            "listing": listing.get("title", ""),
            "city": listing.get("city", ""),
            "checkin": checkin.date().isoformat(),
            "checkout": checkout.date().isoformat(),
            "nights": nights,
            "guests": payload.guests,
            "price_per_night": f"{price_per_night_cents / 100:.2f} EUR",
            "subtotal": f"{subtotal_cents / 100:.2f} EUR",
            "genius_discount": f"-{discount_pct}% ({discount_cents / 100:.2f} EUR)",
            "final_price": f"{discounted_subtotal_cents / 100:.2f} EUR",
        },
        "genius_level": {
            "level": level,
            "discount_applied": f"{discount_pct}%",
            "level_name": ["Starter", "Gold", "Platinum"][level - 1]
        },
        "level_up": {
            "happened": level_up,
            "new_level": new_level_info["level"] if level_up else None,
            "new_discount": f"{new_level_info['discount_pct']}%" if level_up else None,
            "message": f"🎉 Glückwunsch! Sie sind jetzt Genius Level {new_level_info['level']}!" if level_up else None
        }
    }

@router.get("/bookings/my")
async def get_my_bookings(user=Depends(get_current_user)):
    """Get user's booking history"""
    bookings = []
    cursor = db.hotel_bookings.find({"guest_user_id": user["id"]}).sort("created_at", -1)
    async for booking in cursor:
        booking["_id"] = str(booking["_id"])
        bookings.append(booking)
    
    return {"bookings": bookings, "total": len(bookings)}

@router.get("/user/level")
async def get_user_genius_level(user=Depends(get_current_user)):
    """Get user's Genius level for hotels"""
    genius_doc = await db.genius.find_one({"user_id": user["id"]})
    
    if genius_doc:
        total_bookings = genius_doc.get("total_bookings", 0)
        total_spent_cents = genius_doc.get("total_spent_cents", 0)
    else:
        total_bookings = 0
        total_spent_cents = 0
    
    level_info = calc_level(total_bookings, total_spent_cents)
    
    return {
        "user": user.get("name", "Guest"),
        "level": level_info["level"],
        "level_name": ["Starter", "Gold", "Platinum"][level_info["level"] - 1],
        "discount": f"{level_info['discount_pct']}%",
        "stats": {
            "total_bookings": total_bookings,
            "total_spent": f"{total_spent_cents / 100:.2f} EUR"
        }
    }

@router.get("/regions")
async def get_regions():
    """Get available regions"""
    return {
        "regions": [
            {"id": "UAE", "name": "Vereinigte Arabische Emirate", "flag": "🇦🇪", "cities": ["Dubai", "Abu Dhabi"]},
            {"id": "Kosovo", "name": "Kosovo", "flag": "🇽🇰", "cities": ["Prishtina", "Prizren", "Peja"]},
            {"id": "Deutschland", "name": "Deutschland", "flag": "🇩🇪", "cities": ["Berlin", "München", "Hamburg", "Frankfurt"]},
            {"id": "Österreich", "name": "Österreich", "flag": "🇦🇹", "cities": ["Wien", "Salzburg", "Innsbruck"]},
            {"id": "Schweiz", "name": "Schweiz", "flag": "🇨🇭", "cities": ["Zürich", "Genf", "Basel"]},
        ]
    }
