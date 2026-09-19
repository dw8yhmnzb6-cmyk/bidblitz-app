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
from core.config import TEST_MODE
from core.payment_engine import debit_wallet, credit_wallet, TransactionType
import secrets
import hashlib
from pymongo.errors import DuplicateKeyError

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
    guests: int = Field(default=1, ge=1, le=50)
    message: str = Field(default="", max_length=1000)
    idempotency_key: Optional[str] = None


class ReviewCreate(BaseModel):
    booking_id: str
    rating: int = Field(..., ge=1, le=5)
    comment: str = ""


def _require_hotel_idempotency_key(body_key: Optional[str], request: Request, *, action: str) -> str:
    key = (body_key or request.headers.get("Idempotency-Key") or "").strip()
    if not 8 <= len(key) <= 200:
        raise HTTPException(status_code=400, detail="Idempotency-Key erforderlich")
    return f"hotel-{action}:{key}"


def _hotel_night_keys(property_id: str, check_in: str, check_out: str) -> list[str]:
    ci = datetime.strptime(check_in, "%Y-%m-%d").date()
    co = datetime.strptime(check_out, "%Y-%m-%d").date()
    keys = []
    day = ci
    while day < co:
        keys.append(f"HN-{hashlib.sha256(f'{property_id}:{day.isoformat()}'.encode('utf-8')).hexdigest()[:24]}")
        day += timedelta(days=1)
    return keys


async def _claim_hotel_nights(property_id: str, check_in: str, check_out: str, booking_id: str) -> list[str]:
    keys = _hotel_night_keys(property_id, check_in, check_out)
    now = datetime.now(timezone.utc).isoformat()
    day = datetime.strptime(check_in, "%Y-%m-%d").date()
    for key in keys:
        try:
            await db.hotel_night_claims.insert_one({
                "_id": key,
                "property_id": property_id,
                "booking_id": booking_id,
                "date": day.isoformat(),
                "created_at": now,
            })
        except DuplicateKeyError:
            existing = await db.hotel_night_claims.find_one({"_id": key}, {"_id": 0, "booking_id": 1})
            if not existing or existing.get("booking_id") != booking_id:
                await db.hotel_night_claims.delete_many({"booking_id": booking_id})
                raise HTTPException(status_code=409, detail="Unterkunft ist in diesem Zeitraum nicht verfügbar")
        day += timedelta(days=1)
    return keys


async def _grant_hotel_cashback(booking: dict) -> object | None:
    cashback = round(float(booking.get("cashback") or 0), 2)
    if cashback <= 0:
        return None
    result = await credit_wallet(
        user_id=booking["guest_id"],
        amount=cashback,
        tx_type=TransactionType.REWARD,
        description=f"Hotel Cashback: {booking.get('property_title', '')}",
        reference=f"HTL-CB-{booking['booking_id'][-12:].upper()}",
        source="hotel_cashback",
        metadata={"booking_id": booking["booking_id"], "property_id": booking["property_id"]},
        idempotency_key=f"hotel-cashback:{booking['booking_id']}",
    )
    if result.success:
        await db.hotel_bookings.update_one(
            {"booking_id": booking["booking_id"]},
            {"$set": {
                "cashback_status": "completed",
                "cashback_transaction_id": result.transaction_id,
                "cashback_paid_at": datetime.now(timezone.utc).isoformat(),
            }},
        )
    else:
        await db.hotel_bookings.update_one(
            {"booking_id": booking["booking_id"]},
            {"$set": {
                "cashback_status": "reconciliation_required",
                "cashback_error": result.error,
            }},
        )
    return result


async def _settle_hotel_booking(booking_id: str) -> dict:
    booking = await db.hotel_bookings.find_one({"booking_id": booking_id})
    if not booking:
        raise HTTPException(status_code=404, detail="Buchung nicht gefunden")
    if booking.get("settlement_status") == "completed":
        return {"booking": booking, "replayed": True}

    owner_share = round(float(booking.get("total") or 0) * 0.90, 2)
    platform_fee = round(float(booking.get("total") or 0) - owner_share, 2)
    result = await credit_wallet(
        user_id=booking["owner_id"],
        amount=owner_share,
        tx_type=TransactionType.MERCHANT_CREDIT,
        description=f"Hotel-Aufenthalt: {booking.get('property_title', '')}",
        reference=f"HTL-HOST-{booking_id[-10:].upper()}",
        source="hotel_booking",
        metadata={"booking_id": booking_id, "property_id": booking.get("property_id")},
        idempotency_key=f"hotel-settlement:{booking_id}:owner",
    )
    if not result.success:
        await db.hotel_bookings.update_one(
            {"booking_id": booking_id},
            {"$set": {"settlement_status": "reconciliation_required", "settlement_error": result.error}},
        )
        raise HTTPException(status_code=500, detail=result.error or "Vermieter-Auszahlung konnte nicht abgeschlossen werden")

    now = datetime.now(timezone.utc).isoformat()
    transition = await db.hotel_bookings.update_one(
        {"booking_id": booking_id, "settlement_status": {"$ne": "completed"}},
        {"$set": {
            "status": "completed",
            "settlement_status": "completed",
            "owner_share": owner_share,
            "platform_fee": platform_fee,
            "owner_payment_transaction_id": result.transaction_id,
            "completed_at": now,
            "settled_at": now,
        }},
    )
    await db.platform_fees.update_one(
        {"type": "hotel", "booking_id": booking_id},
        {"$setOnInsert": {
            "type": "hotel",
            "booking_id": booking_id,
            "total": float(booking.get("total") or 0),
            "owner_share": owner_share,
            "platform_fee": platform_fee,
            "created_at": now,
        }},
        upsert=True,
    )
    final_booking = await db.hotel_bookings.find_one({"booking_id": booking_id}, {"_id": 0}) or booking
    return {"booking": final_booking, "replayed": transition.modified_count != 1}


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

    claims = await db.hotel_night_claims.find(
        {
            "property_id": property_id,
            "date": {"$gte": today.isoformat(), "$lte": end.isoformat()},
        },
        {"_id": 0, "date": 1},
    ).to_list(1000)
    for claim in claims:
        if claim.get("date"):
            blocked.add(claim["date"])

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
    """Book one property/date range exactly once; guest payment remains in escrow until stay completion."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    idempotency_key = _require_hotel_idempotency_key(req.idempotency_key, request, action="booking")
    key_hash = hashlib.sha256(f"{user_id}:{idempotency_key}".encode("utf-8")).hexdigest()[:20]
    booking_id = f"HTB-{key_hash}"

    existing = await db.hotel_bookings.find_one({"booking_id": booking_id, "guest_id": user_id}, {"_id": 0})
    if existing:
        if existing.get("status") in {"confirmed", "payment_pending", "payment_failed"}:
            if existing.get("status") in {"payment_pending", "payment_failed"}:
                await _claim_hotel_nights(existing["property_id"], existing["check_in"], existing["check_out"], booking_id)
                payment = await debit_wallet(
                    user_id=user_id,
                    amount=float(existing["total"]),
                    tx_type=TransactionType.PAYMENT,
                    description=f"Hotelbuchung: {existing['property_title']}",
                    reference=existing["reference"],
                    metadata={"booking_id": booking_id, "property_id": existing["property_id"], "kind": "hotel_escrow"},
                    idempotency_key=idempotency_key,
                )
                if not payment.success:
                    await db.hotel_night_claims.delete_many({"booking_id": booking_id})
                    raise HTTPException(status_code=400, detail=payment.error or "Zahlung fehlgeschlagen")
                await db.hotel_bookings.update_one(
                    {"booking_id": booking_id},
                    {"$set": {
                        "status": "confirmed",
                        "payment_status": "escrow_held",
                        "payment_transaction_id": payment.transaction_id,
                        "paid_at": datetime.now(timezone.utc).isoformat(),
                    }},
                )
                existing = await db.hotel_bookings.find_one({"booking_id": booking_id}, {"_id": 0}) or existing
            await _grant_hotel_cashback(existing)
            fresh_user = await db.users.find_one({"_id": user["_id"]}, {"balance": 1, "_id": 0}) or {}
            return {
                "ok": True,
                "booking": await db.hotel_bookings.find_one({"booking_id": booking_id}, {"_id": 0}) or existing,
                "new_balance": round(float(fresh_user.get("balance") or 0), 2),
                "replayed": True,
            }
        raise HTTPException(status_code=409, detail="Dieser Buchungsversuch wurde bereits beendet")

    prop = await db.properties.find_one({"property_id": req.property_id, "status": "active"})
    if not prop:
        raise HTTPException(status_code=404, detail="Unterkunft nicht gefunden")
    if prop["owner_id"] == user_id:
        raise HTTPException(status_code=400, detail="Eigene Unterkunft kann nicht gebucht werden")

    try:
        check_in = datetime.strptime(req.check_in, "%Y-%m-%d")
        check_out = datetime.strptime(req.check_out, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail="Datum ungültig (YYYY-MM-DD)")
    if check_out <= check_in:
        raise HTTPException(status_code=400, detail="Check-out muss nach Check-in sein")
    if check_in.date() < datetime.now(timezone.utc).date():
        raise HTTPException(status_code=400, detail="Check-in liegt in der Vergangenheit")
    if req.guests > int(prop.get("max_guests") or 1):
        raise HTTPException(status_code=400, detail=f"Max. {prop.get('max_guests')} Gäste")

    nights = (check_out - check_in).days
    subtotal = round(float(prop["price_per_night"]) * nights, 2)
    cleaning = round(float(prop.get("cleaning_fee") or 0), 2)
    service_pct = float(prop.get("service_fee_pct", 0.10) or 0)
    service_fee = round(subtotal * service_pct, 2)
    total = round(subtotal + cleaning + service_fee, 2)
    cashback = round(total * CASHBACK_RATE, 2)
    ref = f"HTL-{key_hash[:12].upper()}"

    await _claim_hotel_nights(req.property_id, req.check_in, req.check_out, booking_id)
    now = datetime.now(timezone.utc).isoformat()
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
        "price_per_night": float(prop["price_per_night"]),
        "subtotal": subtotal,
        "cleaning_fee": cleaning,
        "service_fee": service_fee,
        "total": total,
        "cashback": cashback,
        "cashback_status": "pending" if cashback > 0 else "not_applicable",
        "cancellation_policy": prop.get("cancellation_policy", "flexible"),
        "message": req.message,
        "status": "payment_pending",
        "payment_status": "pending",
        "settlement_status": "escrow_held",
        "reference": ref,
        "idempotency_key": idempotency_key,
        "created_at": now,
    }
    await db.hotel_bookings.update_one(
        {"booking_id": booking_id, "guest_id": user_id},
        {"$setOnInsert": booking},
        upsert=True,
    )

    payment = await debit_wallet(
        user_id=user_id,
        amount=total,
        tx_type=TransactionType.PAYMENT,
        description=f"Buchung: {prop['title']} ({nights} Nächte)",
        reference=ref,
        metadata={"booking_id": booking_id, "property_id": req.property_id, "kind": "hotel_escrow"},
        idempotency_key=idempotency_key,
    )
    if not payment.success:
        await db.hotel_night_claims.delete_many({"booking_id": booking_id})
        await db.hotel_bookings.update_one(
            {"booking_id": booking_id},
            {"$set": {"status": "payment_failed", "payment_error": payment.error}},
        )
        raise HTTPException(status_code=400, detail=payment.error or "Zahlung fehlgeschlagen")

    paid_at = datetime.now(timezone.utc).isoformat()
    await db.hotel_bookings.update_one(
        {"booking_id": booking_id},
        {"$set": {
            "status": "confirmed",
            "payment_status": "escrow_held",
            "payment_transaction_id": payment.transaction_id,
            "paid_at": paid_at,
        }},
    )
    await db.properties.update_one({"property_id": req.property_id}, {"$inc": {"booking_count": 1}})
    confirmed = await db.hotel_bookings.find_one({"booking_id": booking_id}, {"_id": 0}) or booking
    await _grant_hotel_cashback(confirmed)
    confirmed = await db.hotel_bookings.find_one({"booking_id": booking_id}, {"_id": 0}) or confirmed
    return {"ok": True, "booking": confirmed, "new_balance": payment.new_balance, "replayed": False}


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
    """Cancel a confirmed escrow booking and refund 90% exactly once."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    booking = await db.hotel_bookings.find_one({"booking_id": booking_id, "guest_id": user_id})
    if not booking:
        raise HTTPException(status_code=404, detail="Buchung nicht gefunden")

    if booking.get("status") == "cancelled" and booking.get("refund_status") == "completed":
        release = await db.hotel_bookings.update_one(
            {"booking_id": booking_id, "night_claims_released": {"$ne": True}},
            {"$set": {"night_claims_released": True, "night_claims_released_at": datetime.now(timezone.utc).isoformat()}},
        )
        if release.modified_count == 1:
            await db.hotel_night_claims.delete_many({"booking_id": booking_id})
            await db.properties.update_one(
                {"property_id": booking["property_id"], "booking_count": {"$gt": 0}},
                {"$inc": {"booking_count": -1}},
            )
        fresh_user = await db.users.find_one({"_id": user["_id"]}, {"balance": 1, "_id": 0}) or {}
        return {
            "ok": True,
            "refund": round(float(booking.get("refund") or 0), 2),
            "new_balance": round(float(fresh_user.get("balance") or 0), 2),
            "replayed": True,
        }
    if booking.get("status") not in {"confirmed", "cancelling"}:
        raise HTTPException(status_code=400, detail="Buchung kann nicht storniert werden")

    if booking.get("status") == "confirmed":
        claim = await db.hotel_bookings.update_one(
            {"booking_id": booking_id, "guest_id": user_id, "status": "confirmed"},
            {"$set": {
                "status": "cancelling",
                "refund_status": "processing",
                "cancel_started_at": datetime.now(timezone.utc).isoformat(),
            }},
        )
        if claim.modified_count != 1:
            booking = await db.hotel_bookings.find_one({"booking_id": booking_id}) or booking
            if booking.get("status") != "cancelling":
                raise HTTPException(status_code=409, detail="Buchungsstatus wurde parallel geändert")

    booking = await db.hotel_bookings.find_one({"booking_id": booking_id}) or booking
    refund_amount = round(float(booking["total"]) * 0.90, 2)
    refund = await credit_wallet(
        user_id=user_id,
        amount=refund_amount,
        tx_type=TransactionType.REFUND,
        description=f"Stornierung: {booking['property_title']}",
        reference=f"HTL-REF-{booking_id[-10:].upper()}",
        source="hotel_cancellation",
        metadata={"booking_id": booking_id, "original_transaction": booking.get("payment_transaction_id")},
        idempotency_key=f"hotel-refund:{booking_id}",
    )
    if not refund.success:
        await db.hotel_bookings.update_one(
            {"booking_id": booking_id},
            {"$set": {"refund_status": "reconciliation_required", "refund_error": refund.error}},
        )
        raise HTTPException(status_code=409, detail=refund.error or "Erstattung wird noch verarbeitet")

    cancelled_at = datetime.now(timezone.utc).isoformat()
    await db.hotel_bookings.update_one(
        {"booking_id": booking_id, "status": "cancelling"},
        {"$set": {
            "status": "cancelled",
            "refund": refund_amount,
            "refund_status": "completed",
            "refund_transaction_id": refund.transaction_id,
            "cancelled_at": cancelled_at,
            "settlement_status": "cancelled",
        }},
    )
    release = await db.hotel_bookings.update_one(
        {"booking_id": booking_id, "night_claims_released": {"$ne": True}},
        {"$set": {"night_claims_released": True, "night_claims_released_at": datetime.now(timezone.utc).isoformat()}},
    )
    if release.modified_count == 1:
        await db.hotel_night_claims.delete_many({"booking_id": booking_id})
        await db.properties.update_one(
            {"property_id": booking["property_id"], "booking_count": {"$gt": 0}},
            {"$inc": {"booking_count": -1}},
        )
    return {"ok": True, "refund": refund_amount, "new_balance": refund.new_balance, "replayed": bool(refund.idempotent_replay)}


@router.post("/complete/{booking_id}")
async def complete_booking(booking_id: str, request: Request):
    """Host/admin settles escrow after checkout."""
    user = await get_current_user(request)
    booking = await db.hotel_bookings.find_one({"booking_id": booking_id})
    if not booking:
        raise HTTPException(status_code=404, detail="Buchung nicht gefunden")
    is_host = booking.get("owner_id") == str(user["_id"])
    is_admin = user.get("role") in {"admin", "super_admin"}
    if not (is_host or is_admin):
        raise HTTPException(status_code=403, detail="Nicht berechtigt")
    if booking.get("status") == "completed" and booking.get("settlement_status") == "completed":
        return {"ok": True, "booking": booking, "replayed": True}
    if booking.get("status") != "confirmed":
        raise HTTPException(status_code=400, detail="Nur bestätigte Buchungen können abgeschlossen werden")
    try:
        checkout_date = datetime.strptime(booking["check_out"], "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Ungültiges Check-out-Datum")
    if datetime.now(timezone.utc).date() < checkout_date and not is_admin:
        raise HTTPException(status_code=400, detail="Aufenthalt ist noch nicht beendet")

    result = await _settle_hotel_booking(booking_id)
    return {"ok": True, "booking": result["booking"], "replayed": result["replayed"]}


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
    """Sabre demo search; production fails closed until a live provider is connected."""
    if not TEST_MODE:
        raise HTTPException(status_code=503, detail="Sabre-Liveprovider ist noch nicht verbunden. Keine Demo-Hotels in Production.")
    from datetime import datetime as dt

    check_in_dt = dt.fromisoformat(req.check_in)
    check_out_dt = dt.fromisoformat(req.check_out)
    nights = (check_out_dt - check_in_dt).days
    if nights <= 0:
        raise HTTPException(400, "Check-out muss nach Check-in liegen")
    if req.guests < 1:
        raise HTTPException(400, "Mindestens 1 Gast erforderlich")

    hotels = MOCK_CHAIN_HOTELS.copy()
    
    if req.city:
        hotels = [h for h in hotels if req.city.lower() in h["city"].lower()]
    
    if req.min_stars:
        hotels = [h for h in hotels if h["stars"] >= req.min_stars]
    
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
    """Sabre demo booking; never persist mock bookings in production."""
    if not TEST_MODE:
        raise HTTPException(status_code=503, detail="Sabre-Livebuchung ist noch nicht verbunden.")
    user = await get_current_user(request)
    
    hotel = next((h for h in MOCK_CHAIN_HOTELS if h["id"] == req.hotel_id), None)
    if not hotel:
        raise HTTPException(404, "Hotel nicht gefunden")
    
    from datetime import datetime as dt
    check_in_dt = dt.fromisoformat(req.check_in)
    check_out_dt = dt.fromisoformat(req.check_out)
    nights = (check_out_dt - check_in_dt).days
    if nights <= 0:
        raise HTTPException(400, "Check-out muss nach Check-in liegen")
    if req.guests < 1:
        raise HTTPException(400, "Mindestens 1 Gast erforderlich")
    if not req.guest_name.strip() or not req.guest_email.strip():
        raise HTTPException(400, "Name und E-Mail sind erforderlich")
    
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



@router.post("/sabre/bookings/{booking_id}/cancel")
async def sabre_cancel_booking_endpoint(booking_id: str, request: Request):
    """Sabre demo cancellation; production requires the live provider."""
    if not TEST_MODE:
        raise HTTPException(status_code=503, detail="Sabre-Livestorno ist noch nicht verbunden.")
    user = await get_current_user(request)
    
    booking = await db.hotel_bookings_sabre.find_one({
        "booking_id": booking_id,
        "user_id": str(user["_id"])
    })
    if not booking:
        raise HTTPException(404, "Buchung nicht gefunden")
    
    if booking["status"] in ("checked_in", "checked_out", "cancelled"):
        raise HTTPException(400, f"Stornierung nicht möglich (Status: {booking['status']})")
    
    from datetime import datetime as dt
    check_in_dt = dt.fromisoformat(booking["check_in"])
    hours_until = (check_in_dt - dt.now(timezone.utc)).total_seconds() / 3600
    
    if hours_until >= 48:
        refund_pct = 100
    elif hours_until >= 24:
        refund_pct = 75
    elif hours_until >= 12:
        refund_pct = 50
    else:
        refund_pct = 0
    
    refund = round(booking["total_price"] * refund_pct / 100, 2)
    
    await db.hotel_bookings_sabre.update_one(
        {"booking_id": booking_id},
        {"$set": {
            "status": "cancelled",
            "cancelled_at": datetime.now(timezone.utc).isoformat(),
            "refund_percent": refund_pct,
            "refund_amount": refund,
        }}
    )
    
    return {"ok": True, "refund_percent": refund_pct, "refund_amount": refund}
