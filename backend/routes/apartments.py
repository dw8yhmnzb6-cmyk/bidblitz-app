"""
Apartments Marketplace — Airbnb-clone. Hosts list apartments, guests book.
Collection: apartments, apartment_bookings.
"""
import logging
import secrets
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from typing import List, Optional, Literal

from core.database import db
from core.security import get_current_user
from core.rate_limit import limiter
from core.payment_engine import debit_wallet, TransactionType

router = APIRouter(prefix="/api/apartments", tags=["apartments"])
logger = logging.getLogger("bidblitz.apartments")


class ApartmentCreateRequest(BaseModel):
    title: str = Field(..., min_length=5, max_length=120)
    description: str = Field(default="", max_length=2000)
    city: str = Field(..., min_length=2, max_length=60)
    country: str = Field(default="DE", min_length=2, max_length=2)
    address: Optional[str] = None
    price_per_night: float = Field(..., gt=0, le=10000)
    max_guests: int = Field(default=2, ge=1, le=20)
    bedrooms: int = Field(default=1, ge=0, le=20)
    bathrooms: int = Field(default=1, ge=0, le=20)
    amenities: List[str] = Field(default_factory=list)  # wifi, kitchen, parking, etc.
    images: List[str] = Field(default_factory=list, max_length=20)
    property_type: Literal["apartment", "house", "loft", "studio", "villa", "room"] = "apartment"
    lat: Optional[float] = None
    lng: Optional[float] = None


class BookingRequest(BaseModel):
    apartment_id: str
    check_in: datetime
    check_out: datetime
    guests: int = Field(ge=1, le=20)
    notes: Optional[str] = ""


def _mask(d: dict) -> dict:
    d = dict(d or {})
    d.pop("_id", None)
    for k in ("created_at", "check_in", "check_out", "booked_at"):
        if isinstance(d.get(k), datetime):
            d[k] = d[k].isoformat()
    return d


@router.post("/create")
@limiter.limit("20/hour")
async def create_apartment(req: ApartmentCreateRequest, request: Request):
    user = await get_current_user(request)
    apt_id = secrets.token_urlsafe(10)
    doc = {
        "apartment_id": apt_id,
        "host_user_id": str(user["_id"]),
        "host_name": user.get("name"),
        "host_handle": user.get("handle"),
        "host_avatar": user.get("avatar"),
        "title": req.title,
        "description": req.description,
        "city": req.city,
        "country": req.country,
        "address": req.address,
        "price_per_night": req.price_per_night,
        "max_guests": req.max_guests,
        "bedrooms": req.bedrooms,
        "bathrooms": req.bathrooms,
        "amenities": req.amenities,
        "images": req.images,
        "property_type": req.property_type,
        "lat": req.lat,
        "lng": req.lng,
        "rating_avg": 0.0,
        "rating_count": 0,
        "status": "active",
        "created_at": datetime.now(timezone.utc),
    }
    await db.apartments.insert_one(doc)
    return _mask(doc)


@router.get("/search")
async def search(
    city: Optional[str] = None,
    country: Optional[str] = None,
    max_price: Optional[float] = None,
    min_guests: Optional[int] = None,
    property_type: Optional[str] = None,
    limit: int = 50,
):
    q = {"status": "active"}
    if city:
        q["city"] = {"$regex": f"^{city}", "$options": "i"}
    if country:
        q["country"] = country.upper()
    if max_price:
        q["price_per_night"] = {"$lte": max_price}
    if min_guests:
        q["max_guests"] = {"$gte": min_guests}
    if property_type:
        q["property_type"] = property_type
    items = []
    cursor = db.apartments.find(q, {"_id": 0}).sort("created_at", -1).limit(min(limit, 200))
    async for a in cursor:
        items.append(_mask(a))
    return {"apartments": items, "count": len(items)}


@router.get("/{apartment_id}")
async def get_apartment(apartment_id: str):
    a = await db.apartments.find_one({"apartment_id": apartment_id, "status": "active"}, {"_id": 0})
    if not a:
        raise HTTPException(404, "Apartment not found")
    return _mask(a)


@router.post("/book")
async def book(req: BookingRequest, request: Request):
    user = await get_current_user(request)
    user_id = str(user["_id"])
    apt = await db.apartments.find_one({"apartment_id": req.apartment_id, "status": "active"})
    if not apt:
        raise HTTPException(404, "Apartment not found")
    if req.guests > apt["max_guests"]:
        raise HTTPException(400, f"Max {apt['max_guests']} guests")
    if req.check_out <= req.check_in:
        raise HTTPException(400, "check_out must be after check_in")

    nights = max(1, (req.check_out - req.check_in).days)
    total = round(apt["price_per_night"] * nights, 2)

    booking_id = secrets.token_urlsafe(10)
    # Atomically debit guest's wallet into escrow (admin account). For MVP: just debit + record.
    try:
        result = await debit_wallet(
            user_id=user_id,
            amount=total,
            tx_type=TransactionType.TRANSFER,
            description=f"Apartment booking: {apt['title'][:40]} · {nights}n",
            reference=f"APT-{booking_id}",
            metadata={"apartment_id": req.apartment_id, "host_user_id": apt["host_user_id"], "nights": nights, "kind": "apartment_booking"},
        )
        if not result.success:
            raise HTTPException(402, result.error or "Wallet insufficient")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Apartment debit failed: {e}")
        raise HTTPException(500, "Wallet debit failed")

    doc = {
        "booking_id": booking_id,
        "apartment_id": req.apartment_id,
        "apartment_title": apt["title"],
        "apartment_city": apt["city"],
        "apartment_image": (apt.get("images") or [None])[0],
        "guest_user_id": user_id,
        "guest_name": user.get("name"),
        "host_user_id": apt["host_user_id"],
        "check_in": req.check_in,
        "check_out": req.check_out,
        "nights": nights,
        "guests": req.guests,
        "price_per_night": apt["price_per_night"],
        "total": total,
        "status": "confirmed",
        "notes": req.notes or "",
        "booked_at": datetime.now(timezone.utc),
    }
    await db.apartment_bookings.insert_one(doc)
    return _mask(doc)


@router.get("/bookings/my")
async def my_bookings(request: Request):
    user = await get_current_user(request)
    items = []
    cursor = db.apartment_bookings.find(
        {"guest_user_id": str(user["_id"])},
        {"_id": 0},
    ).sort("booked_at", -1).limit(100)
    async for b in cursor:
        items.append(_mask(b))
    return {"bookings": items}


@router.get("/hosting/my")
async def my_hosting(request: Request):
    """Host-view: list own apartments + recent bookings."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    apts = []
    async for a in db.apartments.find({"host_user_id": user_id}, {"_id": 0}).sort("created_at", -1).limit(50):
        apts.append(_mask(a))
    recent = []
    async for b in db.apartment_bookings.find({"host_user_id": user_id}, {"_id": 0}).sort("booked_at", -1).limit(20):
        recent.append(_mask(b))
    return {"apartments": apts, "recent_bookings": recent}
