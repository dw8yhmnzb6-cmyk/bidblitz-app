"""
Apartments Marketplace — Airbnb-clone. Hosts list apartments, guests book.
Collection: apartments, apartment_bookings.
"""
import logging
import secrets
import hashlib
import os
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from typing import List, Optional, Literal

from core.database import db
from core.security import get_current_user
from core.rate_limit import limiter
from core.payment_engine import transfer_between_wallets, TransactionType

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
    notes: Optional[str] = Field(default="", max_length=1000)
    idempotency_key: Optional[str] = Field(default=None, max_length=200)


def _require_apartment_idempotency_key(body_key: Optional[str], request: Request) -> str:
    key = (body_key or request.headers.get("Idempotency-Key") or "").strip()
    if not 8 <= len(key) <= 200:
        raise HTTPException(status_code=400, detail="Idempotency-Key erforderlich")
    return key


async def _apartment_escrow_user_id() -> Optional[str]:
    email = os.environ.get("PLATFORM_POOL_EMAIL", "admin@bidblitz.ae").strip().lower()
    pool = await db.users.find_one({"email": email}, {"_id": 1})
    return str(pool["_id"]) if pool else None


def _apartment_night_keys(apartment_id: str, check_in: datetime, check_out: datetime) -> List[str]:
    start = check_in.date()
    end = check_out.date()
    keys = []
    day = start
    while day < end:
        digest = hashlib.sha256(f"{apartment_id}:{day.isoformat()}".encode("utf-8")).hexdigest()[:24]
        keys.append(f"APTN-{digest}")
        day += timedelta(days=1)
    return keys


async def _claim_apartment_nights(
    apartment_id: str,
    check_in: datetime,
    check_out: datetime,
    booking_id: str,
) -> List[str]:
    keys = _apartment_night_keys(apartment_id, check_in, check_out)
    claimed: List[str] = []
    try:
        for key in keys:
            try:
                await db.apartment_night_claims.insert_one({
                    "_id": key,
                    "apartment_id": apartment_id,
                    "booking_id": booking_id,
                    "created_at": datetime.now(timezone.utc).isoformat(),
                })
                claimed.append(key)
            except Exception:
                existing = await db.apartment_night_claims.find_one({"_id": key}, {"_id": 0, "booking_id": 1})
                if not existing or existing.get("booking_id") != booking_id:
                    raise HTTPException(status_code=409, detail="Apartment ist in diesem Zeitraum nicht verfügbar")
        return keys
    except Exception:
        if claimed:
            await db.apartment_night_claims.delete_many({
                "_id": {"$in": claimed},
                "booking_id": booking_id,
            })
        raise


async def _release_apartment_nights(booking_id: str) -> None:
    await db.apartment_night_claims.delete_many({"booking_id": booking_id})


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
    if user.get("role") != "admin" and user.get("kyc_status") != "approved":
        raise HTTPException(
            status_code=403,
            detail={
                "error": "kyc_required",
                "message": "KYC-Verifizierung erforderlich, bevor ein Apartment veröffentlicht werden kann.",
                "kyc_status": user.get("kyc_status", "not_started"),
            },
        )
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
    idempotency_key = _require_apartment_idempotency_key(req.idempotency_key, request)
    key_hash = hashlib.sha256(f"{user_id}:{idempotency_key}".encode("utf-8")).hexdigest()[:20]
    booking_id = f"APTB-{key_hash}"

    existing = await db.apartment_bookings.find_one(
        {"booking_id": booking_id, "guest_user_id": user_id},
        {"_id": 0},
    )
    if existing:
        expected = (
            req.apartment_id,
            req.check_in.isoformat(),
            req.check_out.isoformat(),
            req.guests,
        )
        actual = (
            existing.get("apartment_id"),
            str(existing.get("check_in")),
            str(existing.get("check_out")),
            existing.get("guests"),
        )
        if actual != expected:
            raise HTTPException(status_code=409, detail="Idempotency-Key wurde bereits für eine andere Buchung verwendet")
        return {**_mask(existing), "replayed": True}

    apt = await db.apartments.find_one({"apartment_id": req.apartment_id, "status": "active"})
    if not apt:
        raise HTTPException(404, "Apartment not found")
    if apt.get("host_user_id") == user_id:
        raise HTTPException(400, "Eigene Unterkunft kann nicht gebucht werden")
    if req.guests > int(apt.get("max_guests") or 1):
        raise HTTPException(400, f"Max {apt['max_guests']} guests")
    if req.check_out <= req.check_in:
        raise HTTPException(400, "check_out must be after check_in")
    if req.check_in.date() < datetime.now(timezone.utc).date():
        raise HTTPException(400, "check_in liegt in der Vergangenheit")

    nights = (req.check_out.date() - req.check_in.date()).days
    if nights < 1 or nights > 365:
        raise HTTPException(400, "Ungültige Aufenthaltsdauer")
    total = round(float(apt["price_per_night"]) * nights, 2)

    await _claim_apartment_nights(
        req.apartment_id,
        req.check_in,
        req.check_out,
        booking_id,
    )

    escrow_user_id = await _apartment_escrow_user_id()
    if not escrow_user_id:
        await _release_apartment_nights(booking_id)
        raise HTTPException(503, "Apartment-Escrow-Wallet ist nicht konfiguriert")
    if escrow_user_id == user_id:
        await _release_apartment_nights(booking_id)
        raise HTTPException(409, "Escrow-Wallet darf nicht identisch mit dem Gast-Wallet sein")

    payment = await transfer_between_wallets(
        from_user_id=user_id,
        to_user_id=escrow_user_id,
        amount=total,
        tx_type=TransactionType.PAYMENT,
        description=f"Apartment Escrow: {apt['title'][:40]} · {nights} Nächte",
        reference=f"APT-{booking_id[-12:].upper()}",
        metadata={
            "booking_id": booking_id,
            "apartment_id": req.apartment_id,
            "host_user_id": apt["host_user_id"],
            "nights": nights,
            "kind": "apartment_escrow",
        },
        idempotency_key=f"apartment:book:{idempotency_key}",
    )
    if not payment.success:
        await _release_apartment_nights(booking_id)
        status_code = 409 if payment.status.value in {"pending", "reconciliation_required"} else 402
        raise HTTPException(status_code, payment.error or "Wallet-Zahlung fehlgeschlagen")

    doc = {
        "booking_id": booking_id,
        "apartment_id": req.apartment_id,
        "apartment_title": apt["title"],
        "apartment_city": apt["city"],
        "apartment_image": (apt.get("images") or [None])[0],
        "guest_user_id": user_id,
        "guest_name": user.get("name"),
        "host_user_id": apt["host_user_id"],
        "escrow_user_id": escrow_user_id,
        "check_in": req.check_in,
        "check_out": req.check_out,
        "nights": nights,
        "guests": req.guests,
        "price_per_night": float(apt["price_per_night"]),
        "total": total,
        "status": "confirmed",
        "payment_status": "escrow_held",
        "settlement_status": "escrow_held",
        "payment_transaction_id": payment.transaction_id,
        "idempotency_key": idempotency_key,
        "notes": req.notes or "",
        "booked_at": datetime.now(timezone.utc),
    }
    try:
        write = await db.apartment_bookings.update_one(
            {"booking_id": booking_id, "guest_user_id": user_id},
            {"$setOnInsert": doc},
            upsert=True,
        )
        if write.upserted_id is None:
            persisted = await db.apartment_bookings.find_one(
                {"booking_id": booking_id, "guest_user_id": user_id},
                {"_id": 0},
            )
            if persisted:
                return {**_mask(persisted), "replayed": True}
            raise RuntimeError("Apartment booking persistence conflict")
    except Exception:
        refund = await transfer_between_wallets(
            from_user_id=escrow_user_id,
            to_user_id=user_id,
            amount=total,
            tx_type=TransactionType.REFUND,
            description="Apartment booking rollback",
            reference=f"APT-RB-{booking_id[-12:].upper()}",
            metadata={"booking_id": booking_id, "kind": "apartment_booking_rollback"},
            idempotency_key=f"apartment:rollback:{booking_id}",
        )
        await _release_apartment_nights(booking_id)
        if not refund.success:
            raise HTTPException(status_code=500, detail="Buchungsspeicherung fehlgeschlagen; Escrow benötigt Abstimmung")
        raise HTTPException(status_code=500, detail="Buchung konnte nicht gespeichert werden; Zahlung wurde zurückgezahlt")

    return {**_mask(doc), "replayed": bool(payment.idempotent_replay)}

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


@router.post("/bookings/{booking_id}/cancel")
async def cancel_apartment_booking(booking_id: str, request: Request):
    user = await get_current_user(request)
    user_id = str(user["_id"])
    booking = await db.apartment_bookings.find_one({
        "booking_id": booking_id,
        "guest_user_id": user_id,
    })
    if not booking:
        raise HTTPException(404, "Booking not found")
    if booking.get("status") == "cancelled" and booking.get("refund_status") == "completed":
        return {"ok": True, "refund": float(booking.get("refund_amount") or 0), "replayed": True}
    if booking.get("status") != "confirmed":
        raise HTTPException(409, "Buchung kann nicht storniert werden")
    if datetime.now(timezone.utc) >= booking["check_in"]:
        raise HTTPException(409, "Stornierung nach Check-in muss über Support erfolgen")

    claim = await db.apartment_bookings.update_one(
        {"booking_id": booking_id, "guest_user_id": user_id, "status": "confirmed"},
        {"$set": {"status": "cancelling", "refund_status": "processing", "cancel_started_at": datetime.now(timezone.utc)}},
    )
    if claim.modified_count != 1:
        fresh = await db.apartment_bookings.find_one({"booking_id": booking_id}) or {}
        if fresh.get("status") != "cancelling":
            raise HTTPException(409, "Buchungsstatus wurde parallel geändert")
        booking = fresh

    refund = await transfer_between_wallets(
        from_user_id=str(booking["escrow_user_id"]),
        to_user_id=user_id,
        amount=round(float(booking["total"]), 2),
        tx_type=TransactionType.REFUND,
        description=f"Apartment-Stornierung: {booking.get('apartment_title', '')}",
        reference=f"APT-REF-{booking_id[-12:].upper()}",
        metadata={"booking_id": booking_id, "kind": "apartment_cancellation"},
        idempotency_key=f"apartment:refund:{booking_id}",
    )
    if not refund.success:
        await db.apartment_bookings.update_one(
            {"booking_id": booking_id},
            {"$set": {"refund_status": "reconciliation_required", "refund_error": refund.error}},
        )
        raise HTTPException(409, refund.error or "Rückerstattung wird noch verarbeitet")

    await db.apartment_bookings.update_one(
        {"booking_id": booking_id, "status": "cancelling"},
        {"$set": {
            "status": "cancelled",
            "payment_status": "refunded",
            "settlement_status": "cancelled",
            "refund_status": "completed",
            "refund_amount": round(float(booking["total"]), 2),
            "refund_transaction_id": refund.transaction_id,
            "cancelled_at": datetime.now(timezone.utc),
        }},
    )
    await _release_apartment_nights(booking_id)
    return {"ok": True, "refund": round(float(booking["total"]), 2), "replayed": bool(refund.idempotent_replay)}


@router.post("/hosting/bookings/{booking_id}/complete")
async def complete_apartment_booking(booking_id: str, request: Request):
    user = await get_current_user(request)
    user_id = str(user["_id"])
    booking = await db.apartment_bookings.find_one({
        "booking_id": booking_id,
        "host_user_id": user_id,
    })
    if not booking:
        raise HTTPException(404, "Booking not found")
    if booking.get("status") == "completed" and booking.get("settlement_status") == "completed":
        return {"ok": True, "booking": _mask(booking), "replayed": True}
    if booking.get("status") != "confirmed":
        raise HTTPException(409, "Nur bestätigte Buchungen können abgeschlossen werden")
    if datetime.now(timezone.utc) < booking["check_out"]:
        raise HTTPException(409, "Aufenthalt ist noch nicht beendet")

    total = round(float(booking["total"]), 2)
    escrow_user_id = str(booking.get("escrow_user_id") or "")
    if not escrow_user_id:
        raise HTTPException(500, "Escrow-Wallet fehlt")

    payout = None
    if escrow_user_id != user_id and total > 0:
        payout = await transfer_between_wallets(
            from_user_id=escrow_user_id,
            to_user_id=user_id,
            amount=total,
            tx_type=TransactionType.MERCHANT_CREDIT,
            description=f"Apartment-Auszahlung: {booking.get('apartment_title', '')}",
            reference=f"APT-HOST-{booking_id[-12:].upper()}",
            metadata={"booking_id": booking_id, "kind": "apartment_host_settlement"},
            idempotency_key=f"apartment:settlement:{booking_id}",
        )
        if not payout.success:
            await db.apartment_bookings.update_one(
                {"booking_id": booking_id},
                {"$set": {"settlement_status": "reconciliation_required", "settlement_error": payout.error}},
            )
            raise HTTPException(409, payout.error or "Host-Auszahlung wird abgestimmt")

    await db.apartment_bookings.update_one(
        {"booking_id": booking_id, "status": "confirmed"},
        {"$set": {
            "status": "completed",
            "settlement_status": "completed",
            "host_payment_transaction_id": payout.transaction_id if payout else None,
            "completed_at": datetime.now(timezone.utc),
        }},
    )
    final = await db.apartment_bookings.find_one({"booking_id": booking_id}, {"_id": 0}) or booking
    return {"ok": True, "booking": _mask(final), "replayed": bool(payout.idempotent_replay) if payout else False}


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
