"""
BidBlitz V2 - Hotel & Unterkunft Buchung (Eigener Marktplatz)
Vermieter stellen Unterkünfte ein, Kunden buchen & zahlen mit Wallet.
"""
from fastapi import APIRouter, HTTPException, Request, UploadFile, File
from pydantic import BaseModel, Field
from typing import Optional, List
from bson import ObjectId
from datetime import datetime, timezone, timedelta
from core.database import db
from core.security import get_current_user
import secrets

router = APIRouter(prefix="/api/hotels", tags=["hotels"])

CASHBACK_RATE = 0.03  # 3% cashback on hotel bookings


class PropertyCreate(BaseModel):
    title: str
    description: str = ""
    property_type: str = "apartment"  # apartment, house, room, villa, hotel
    city: str = ""
    address: str = ""
    price_per_night: float = Field(..., gt=0)
    max_guests: int = 2
    bedrooms: int = 1
    bathrooms: int = 1
    amenities: List[str] = []
    images: List[str] = []
    rules: str = ""
    cleaning_fee: float = 0          # one-time fee per booking
    service_fee_pct: float = 0.10    # 10% platform service fee
    cancellation_policy: str = "flexible"  # flexible | moderate | strict
    instant_book: bool = True


class BookingCreate(BaseModel):
    property_id: str
    check_in: str  # YYYY-MM-DD
    check_out: str  # YYYY-MM-DD
    guests: int = 1
    message: str = ""


class ReviewCreate(BaseModel):
    booking_id: str
    rating: int = Field(..., ge=1, le=5)
    comment: str = ""


# ─── Property CRUD ───

@router.get("/properties")
async def list_properties(
    city: str = "", property_type: str = "", min_price: float = 0,
    max_price: float = 99999, guests: int = 1, limit: int = 30
):
    query = {"status": "active"}
    if city:
        query["city"] = {"$regex": city, "$options": "i"}
    if property_type:
        query["property_type"] = property_type
    if min_price > 0 or max_price < 99999:
        query["price_per_night"] = {"$gte": min_price, "$lte": max_price}
    if guests > 1:
        query["max_guests"] = {"$gte": guests}

    props = await db.properties.find(query, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    return {"properties": props, "count": len(props)}


@router.get("/properties/{property_id}")
async def get_property(property_id: str):
    p = await db.properties.find_one({"property_id": property_id}, {"_id": 0})
    if not p:
        raise HTTPException(status_code=404, detail="Unterkunft nicht gefunden")
    reviews = await db.property_reviews.find(
        {"property_id": property_id}, {"_id": 0}
    ).sort("created_at", -1).limit(20).to_list(20)
    p["reviews"] = reviews
    return p


@router.get("/{property_id}/availability")
async def get_availability(property_id: str, days: int = 90):
    """Return list of booked date ranges so frontend can disable them in calendar."""
    prop = await db.properties.find_one({"property_id": property_id}, {"_id": 0})
    if not prop:
        raise HTTPException(status_code=404, detail="Unterkunft nicht gefunden")

    today = datetime.now(timezone.utc).date()
    end = today + timedelta(days=days)

    bookings = await db.hotel_bookings.find({
        "property_id": property_id,
        "status": {"$in": ["confirmed", "pending"]},
        "check_out": {"$gte": today.isoformat()},
        "check_in": {"$lte": end.isoformat()},
    }, {"_id": 0, "check_in": 1, "check_out": 1}).to_list(200)

    # Build flat list of unavailable dates (exclusive of check_out per hotel convention)
    blocked = set()
    for b in bookings:
        try:
            ci = datetime.strptime(b["check_in"], "%Y-%m-%d").date()
            co = datetime.strptime(b["check_out"], "%Y-%m-%d").date()
            d = ci
            while d < co:
                blocked.add(d.isoformat())
                d += timedelta(days=1)
        except (ValueError, KeyError):
            continue

    return {
        "property_id": property_id,
        "blocked_dates": sorted(blocked),
        "ranges": [{"check_in": b["check_in"], "check_out": b["check_out"]} for b in bookings],
        "horizon_days": days,
    }


@router.get("/{property_id}/quote")
async def get_price_quote(property_id: str, check_in: str, check_out: str, guests: int = 1):
    """Itemized price quote with breakdown (nights × rate, cleaning, service fee, total)."""
    prop = await db.properties.find_one({"property_id": property_id, "status": "active"}, {"_id": 0})
    if not prop:
        raise HTTPException(status_code=404, detail="Unterkunft nicht gefunden")

    try:
        ci = datetime.strptime(check_in, "%Y-%m-%d")
        co = datetime.strptime(check_out, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail="Datum ungültig (YYYY-MM-DD)")
    if co <= ci:
        raise HTTPException(status_code=400, detail="Check-out muss nach Check-in sein")

    nights = (co - ci).days
    if guests > prop.get("max_guests", 2):
        raise HTTPException(status_code=400, detail=f"Max. {prop.get('max_guests')} Gäste")

    rate = float(prop["price_per_night"])
    subtotal = round(rate * nights, 2)
    cleaning = float(prop.get("cleaning_fee", 0) or 0)
    service_pct = float(prop.get("service_fee_pct", 0.10) or 0)
    service_fee = round(subtotal * service_pct, 2)
    total = round(subtotal + cleaning + service_fee, 2)
    cashback = round(total * CASHBACK_RATE, 2)

    return {
        "property_id": property_id,
        "check_in": check_in,
        "check_out": check_out,
        "nights": nights,
        "guests": guests,
        "rate_per_night": rate,
        "breakdown": [
            {"label": f"€{rate:.2f} × {nights} Nächte", "amount": subtotal},
            {"label": "Reinigungsgebühr", "amount": cleaning},
            {"label": f"Service-Gebühr ({int(service_pct * 100)}%)", "amount": service_fee},
        ],
        "subtotal": subtotal,
        "cleaning_fee": cleaning,
        "service_fee": service_fee,
        "total": total,
        "cashback": cashback,
        "cancellation_policy": prop.get("cancellation_policy", "flexible"),
        "instant_book": prop.get("instant_book", True),
    }


@router.post("/properties")
async def create_property(req: PropertyCreate, request: Request):
    user = await get_current_user(request)
    user_id = str(user["_id"])
    now = datetime.now(timezone.utc).isoformat()
    prop_id = secrets.token_hex(8)

    doc = {
        "property_id": prop_id,
        "owner_id": user_id,
        "owner_name": user.get("name", ""),
        "owner_email": user.get("email", ""),
        "title": req.title,
        "description": req.description,
        "property_type": req.property_type,
        "city": req.city,
        "address": req.address,
        "price_per_night": req.price_per_night,
        "max_guests": req.max_guests,
        "bedrooms": req.bedrooms,
        "bathrooms": req.bathrooms,
        "amenities": req.amenities,
        "images": req.images,
        "rules": req.rules,
        "cleaning_fee": req.cleaning_fee,
        "service_fee_pct": req.service_fee_pct,
        "cancellation_policy": req.cancellation_policy,
        "instant_book": req.instant_book,
        "rating": 0,
        "review_count": 0,
        "booking_count": 0,
        "status": "active",
        "created_at": now,
    }
    await db.properties.insert_one(doc)
    doc.pop("_id", None)
    return {"ok": True, "property": doc}


@router.get("/my-properties")
async def my_properties(request: Request):
    user = await get_current_user(request)
    props = await db.properties.find(
        {"owner_id": str(user["_id"])}, {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    return {"properties": props}


@router.delete("/properties/{property_id}")
async def delete_property(property_id: str, request: Request):
    user = await get_current_user(request)
    p = await db.properties.find_one({"property_id": property_id})
    if not p or p["owner_id"] != str(user["_id"]):
        raise HTTPException(status_code=403, detail="Nicht berechtigt")
    await db.properties.update_one({"property_id": property_id}, {"$set": {"status": "deleted"}})
    return {"ok": True}


# ─── Bookings ───

@router.post("/book")
async def book_property(req: BookingCreate, request: Request):
    user = await get_current_user(request)
    user_id = str(user["_id"])

    prop = await db.properties.find_one({"property_id": req.property_id, "status": "active"})
    if not prop:
        raise HTTPException(status_code=404, detail="Unterkunft nicht gefunden")

    if prop["owner_id"] == user_id:
        raise HTTPException(status_code=400, detail="Eigene Unterkunft kann nicht gebucht werden")

    check_in = datetime.strptime(req.check_in, "%Y-%m-%d")
    check_out = datetime.strptime(req.check_out, "%Y-%m-%d")
    if check_out <= check_in:
        raise HTTPException(status_code=400, detail="Check-out muss nach Check-in sein")

    nights = (check_out - check_in).days
    subtotal = round(prop["price_per_night"] * nights, 2)
    cleaning = float(prop.get("cleaning_fee", 0) or 0)
    service_pct = float(prop.get("service_fee_pct", 0.10) or 0)
    service_fee = round(subtotal * service_pct, 2)
    total = round(subtotal + cleaning + service_fee, 2)

    # Check wallet balance
    balance = user.get("balance", 0)
    if balance < total:
        raise HTTPException(status_code=400, detail=f"Nicht genug Guthaben. Benötigt: €{total:.2f}")

    # Check availability (no overlapping bookings)
    overlap = await db.hotel_bookings.find_one({
        "property_id": req.property_id,
        "status": {"$in": ["confirmed", "pending"]},
        "$or": [
            {"check_in": {"$lt": req.check_out}, "check_out": {"$gt": req.check_in}},
        ],
    })
    if overlap:
        raise HTTPException(status_code=400, detail="Unterkunft ist in diesem Zeitraum nicht verfügbar")

    # Charge customer
    result = await db.users.update_one(
        {"_id": user["_id"], "balance": {"$gte": total}},
        {"$inc": {"balance": -total}},
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=400, detail="Zahlung fehlgeschlagen")

    # Credit owner
    await db.users.update_one(
        {"_id": ObjectId(prop["owner_id"])},
        {"$inc": {"balance": total * 0.9}},  # 10% platform fee
    )

    # Cashback
    cashback = round(total * CASHBACK_RATE, 2)
    if cashback > 0:
        await db.users.update_one({"_id": user["_id"]}, {"$inc": {"balance": cashback}})

    now = datetime.now(timezone.utc).isoformat()
    booking_id = secrets.token_hex(8)
    ref = f"HTL-{secrets.token_hex(4).upper()}"

    booking = {
        "booking_id": booking_id,
        "property_id": req.property_id,
        "property_title": prop["title"],
        "property_city": prop.get("city", ""),
        "guest_id": user_id,
        "guest_name": user.get("name", ""),
        "guest_email": user.get("email", ""),
        "owner_id": prop["owner_id"],
        "check_in": req.check_in,
        "check_out": req.check_out,
        "nights": nights,
        "guests": req.guests,
        "price_per_night": prop["price_per_night"],
        "subtotal": subtotal,
        "cleaning_fee": cleaning,
        "service_fee": service_fee,
        "total": total,
        "platform_fee": round(total * 0.1, 2),
        "cashback": cashback,
        "message": req.message,
        "status": "confirmed",
        "reference": ref,
        "created_at": now,
    }
    await db.hotel_bookings.insert_one(booking)
    booking.pop("_id", None)

    await db.properties.update_one({"property_id": req.property_id}, {"$inc": {"booking_count": 1}})

    # Transaction records
    await db.transactions.insert_one({
        "id": booking_id, "user_id": user_id, "type": "hotel_booking",
        "amount": -total, "description": f"Buchung: {prop['title']} ({nights} Nächte)",
        "status": "completed", "reference": ref, "category": "hotel", "created_at": now,
    })

    return {"ok": True, "booking": booking}


@router.get("/my-bookings")
async def my_bookings(request: Request):
    user = await get_current_user(request)
    bookings = await db.hotel_bookings.find(
        {"guest_id": str(user["_id"])}, {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    return {"bookings": bookings}


@router.get("/host-bookings")
async def host_bookings(request: Request):
    user = await get_current_user(request)
    bookings = await db.hotel_bookings.find(
        {"owner_id": str(user["_id"])}, {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    return {"bookings": bookings}


@router.post("/cancel/{booking_id}")
async def cancel_booking(booking_id: str, request: Request):
    user = await get_current_user(request)
    b = await db.hotel_bookings.find_one({"booking_id": booking_id})
    if not b or b["guest_id"] != str(user["_id"]):
        raise HTTPException(status_code=403, detail="Nicht berechtigt")
    if b["status"] != "confirmed":
        raise HTTPException(status_code=400, detail="Buchung kann nicht storniert werden")

    # Refund (minus 10% cancellation fee)
    refund = round(b["total"] * 0.9, 2)
    await db.users.update_one({"_id": user["_id"]}, {"$inc": {"balance": refund}})
    await db.hotel_bookings.update_one(
        {"booking_id": booking_id}, {"$set": {"status": "cancelled", "refund": refund}}
    )
    now = datetime.now(timezone.utc).isoformat()
    await db.transactions.insert_one({
        "id": secrets.token_hex(8), "user_id": str(user["_id"]), "type": "hotel_refund",
        "amount": refund, "description": f"Stornierung: {b['property_title']}",
        "status": "completed", "reference": b["reference"], "category": "hotel", "created_at": now,
    })
    return {"ok": True, "refund": refund}


# ─── Reviews ───

@router.post("/review")
async def add_review(req: ReviewCreate, request: Request):
    user = await get_current_user(request)
    b = await db.hotel_bookings.find_one({"booking_id": req.booking_id})
    if not b or b["guest_id"] != str(user["_id"]):
        raise HTTPException(status_code=403, detail="Nur Gäste können bewerten")

    now = datetime.now(timezone.utc).isoformat()
    review = {
        "review_id": secrets.token_hex(8),
        "booking_id": req.booking_id,
        "property_id": b["property_id"],
        "guest_id": str(user["_id"]),
        "guest_name": user.get("name", ""),
        "rating": req.rating,
        "comment": req.comment,
        "created_at": now,
    }
    await db.property_reviews.insert_one(review)

    # Update property average rating
    all_reviews = await db.property_reviews.find({"property_id": b["property_id"]}).to_list(500)
    avg = sum(r["rating"] for r in all_reviews) / len(all_reviews)
    await db.properties.update_one(
        {"property_id": b["property_id"]},
        {"$set": {"rating": round(avg, 1), "review_count": len(all_reviews)}},
    )
    return {"ok": True}



# ═══════════════════════════════════════════════════════════
# SABRE INTEGRATION — Zimmersuche & erweiterte Features
# ═══════════════════════════════════════════════════════════
import random

MOCK_CHAIN_HOTELS = [
    {"id": "SABRE-BER-001", "name": "Hilton Berlin", "city": "Berlin", "stars": 5, "lat": 52.5200, "lng": 13.4050, "chain": "Hilton"},
    {"id": "SABRE-MUC-001", "name": "Marriott München", "city": "München", "stars": 4, "lat": 48.1351, "lng": 11.5820, "chain": "Marriott"},
    {"id": "SABRE-HAM-001", "name": "Hyatt Hamburg", "city": "Hamburg", "stars": 5, "lat": 53.5511, "lng": 9.9937, "chain": "Hyatt"},
]

ROOM_TYPES_SABRE = [
    {"type": "standard", "name": "Standard", "capacity": 2, "size_sqm": 25},
    {"type": "deluxe", "name": "Deluxe", "capacity": 2, "size_sqm": 35},
    {"type": "suite", "name": "Suite", "capacity": 4, "size_sqm": 60},
]


class SabreSearchRequest(BaseModel):
    city: Optional[str] = None
    check_in: str
    check_out: str
    guests: int = 1
    min_stars: Optional[int] = None


@router.post("/sabre/search")
async def sabre_search_hotels(req: SabreSearchRequest, request: Request):
    """Sabre-Hotelsuche (Mock)."""
    hotels = MOCK_CHAIN_HOTELS.copy()
    
    if req.city:
        hotels = [h for h in hotels if req.city.lower() in h["city"].lower()]
    
    if req.min_stars:
        hotels = [h for h in hotels if h["stars"] >= req.min_stars]
    
    from datetime import datetime as dt
    check_in_dt = dt.fromisoformat(req.check_in)
    check_out_dt = dt.fromisoformat(req.check_out)
    nights = (check_out_dt - check_in_dt).days
    
    results = []
    for hotel in hotels:
        available_rooms = []
        for room_type in ROOM_TYPES_SABRE:
            if room_type["capacity"] >= req.guests:
                base_price = {
                    "standard": 120 + hotel["stars"] * 20,
                    "deluxe": 180 + hotel["stars"] * 30,
                    "suite": 350 + hotel["stars"] * 50,
                }[room_type["type"]]
                
                available = random.randint(1, 8)
                available_rooms.append({
                    **room_type,
                    "available_count": available,
                    "price_per_night": base_price,
                    "total_price": round(base_price * nights, 2),
                })
        
        results.append({
            **hotel,
            "available_rooms": available_rooms,
            "nights": nights,
        })
    
    return {"hotels": results, "count": len(results)}


class SabreBookingRequest(BaseModel):
    hotel_id: str
    room_type: str
    check_in: str
    check_out: str
    guests: int
    guest_name: str
    guest_email: str


@router.post("/sabre/book")
async def sabre_create_booking(req: SabreBookingRequest, request: Request):
    """Sabre-Buchung."""
    user = await get_current_user(request)
    
    hotel = next((h for h in MOCK_CHAIN_HOTELS if h["id"] == req.hotel_id), None)
    if not hotel:
        raise HTTPException(404, "Hotel nicht gefunden")
    
    from datetime import datetime as dt
    check_in_dt = dt.fromisoformat(req.check_in)
    check_out_dt = dt.fromisoformat(req.check_out)
    nights = (check_out_dt - check_in_dt).days
    
    base_price = {
        "standard": 120 + hotel["stars"] * 20,
        "deluxe": 180 + hotel["stars"] * 30,
        "suite": 350 + hotel["stars"] * 50,
    }.get(req.room_type, 150)
    
    total = round(base_price * nights, 2)
    
    booking = {
        "booking_id": f"SABRE-{secrets.token_hex(5).upper()}",
        "user_id": str(user["_id"]),
        "hotel_id": req.hotel_id,
        "hotel_name": hotel["name"],
        "hotel_city": hotel["city"],
        "room_type": req.room_type,
        "check_in": req.check_in,
        "check_out": req.check_out,
        "nights": nights,
        "guests": req.guests,
        "guest_name": req.guest_name,
        "guest_email": req.guest_email,
        "total_price": total,
        "status": "confirmed",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.hotel_bookings_sabre.insert_one(booking)
    booking.pop("_id", None)
    
    return {"ok": True, "booking": booking}


@router.get("/sabre/bookings")
async def my_sabre_bookings(request: Request):
    """Eigene Sabre-Buchungen."""
    user = await get_current_user(request)
    bookings = await db.hotel_bookings_sabre.find(
        {"user_id": str(user["_id"])},
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    return {"bookings": bookings}
