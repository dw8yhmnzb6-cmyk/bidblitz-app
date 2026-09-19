"""
BidBlitz V2 - Restaurant-Reservierung
Tisch reservieren + mit Wallet bezahlen + Trinkgeld
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from typing import Optional, List
from bson import ObjectId
from datetime import datetime, timezone
from core.database import db
from core.security import get_current_user
from core.payment_engine import debit_wallet, credit_wallet, TransactionType
import secrets
import hashlib
from pymongo.errors import DuplicateKeyError

router = APIRouter(prefix="/api/restaurants", tags=["restaurants"])

CASHBACK_RATE = 0.02


class RestaurantCreate(BaseModel):
    name: str
    cuisine: str = ""
    city: str = ""
    address: str = ""
    description: str = ""
    price_range: str = "mid"
    capacity: int = Field(default=40, ge=1, le=1000)
    opening_hours: str = "11:00-23:00"
    images: List[str] = []
    phone: str = ""
    reservation_deposit: float = Field(default=0, ge=0, le=500)


class ReservationCreate(BaseModel):
    restaurant_id: str
    date: str  # YYYY-MM-DD
    time: str  # HH:MM
    guests: int = Field(2, ge=1, le=20)
    special_requests: str = Field(default="", max_length=500)
    deposit: float = 0  # Deprecated: server uses restaurant reservation_deposit.
    idempotency_key: Optional[str] = None


def _require_reservation_idempotency_key(body_key: Optional[str], request: Request) -> str:
    key = (body_key or request.headers.get("Idempotency-Key") or "").strip()
    if not 8 <= len(key) <= 200:
        raise HTTPException(status_code=400, detail="Idempotency-Key erforderlich")
    return f"restaurant-reservation:{key}"


def _reservation_slot_id(restaurant_id: str, date: str, time: str) -> str:
    raw = f"{restaurant_id}:{date}:{time}"
    return "RSLOT-" + hashlib.sha256(raw.encode("utf-8")).hexdigest()[:24]


async def _claim_reservation_seats(rest: dict, date: str, time: str, guests: int) -> str:
    slot_id = _reservation_slot_id(rest["restaurant_id"], date, time)
    capacity = int(rest.get("capacity") or 0)
    if guests > capacity:
        raise HTTPException(status_code=400, detail="Gruppengröße übersteigt Restaurantkapazität")

    try:
        await db.reservation_slots.insert_one({
            "_id": slot_id,
            "restaurant_id": rest["restaurant_id"],
            "date": date,
            "time": time,
            "capacity": capacity,
            "remaining_seats": capacity,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    except DuplicateKeyError:
        pass

    claim = await db.reservation_slots.update_one(
        {"_id": slot_id, "remaining_seats": {"$gte": guests}},
        {
            "$inc": {"remaining_seats": -guests},
            "$set": {"updated_at": datetime.now(timezone.utc).isoformat()},
        },
    )
    if claim.modified_count != 1:
        raise HTTPException(status_code=409, detail="Nicht genügend freie Plätze für diese Uhrzeit")
    return slot_id


async def _release_reservation_seats_once(reservation: dict) -> bool:
    slot_id = reservation.get("slot_id")
    if not slot_id or reservation.get("capacity_released"):
        return False
    released = await db.reservations.update_one(
        {
            "reservation_id": reservation["reservation_id"],
            "capacity_released": {"$ne": True},
        },
        {"$set": {
            "capacity_released": True,
            "capacity_released_at": datetime.now(timezone.utc).isoformat(),
        }},
    )
    if released.modified_count == 1:
        await db.reservation_slots.update_one(
            {"_id": slot_id},
            {
                "$inc": {"remaining_seats": int(reservation.get("guests") or 0)},
                "$set": {"updated_at": datetime.now(timezone.utc).isoformat()},
            },
        )
        return True
    return False


# ─── Restaurants ───

@router.get("/list")
async def list_restaurants(city: str = "", cuisine: str = "", price_range: str = "", limit: int = 30):
    query = {"status": "active"}
    if city:
        query["city"] = {"$regex": city, "$options": "i"}
    if cuisine:
        query["cuisine"] = cuisine
    if price_range:
        query["price_range"] = price_range
    restaurants = await db.restaurants.find(query, {"_id": 0}).sort("rating", -1).limit(limit).to_list(limit)
    return {"restaurants": restaurants, "count": len(restaurants)}


@router.get("/cuisines")
async def get_cuisines():
    return {
        "cuisines": [
            {"id": "italian", "label": "Italienisch"},
            {"id": "asian", "label": "Asiatisch"},
            {"id": "german", "label": "Deutsch"},
            {"id": "turkish", "label": "Türkisch"},
            {"id": "indian", "label": "Indisch"},
            {"id": "mexican", "label": "Mexikanisch"},
            {"id": "japanese", "label": "Japanisch"},
            {"id": "french", "label": "Französisch"},
            {"id": "american", "label": "Amerikanisch"},
            {"id": "mediterranean", "label": "Mediterran"},
        ]
    }


@router.get("/my-restaurants")
async def my_restaurants(request: Request):
    user = await get_current_user(request)
    rests = await db.restaurants.find(
        {"owner_id": str(user["_id"])}, {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    return {"restaurants": rests}


@router.get("/my-reservations")
async def my_reservations(request: Request):
    user = await get_current_user(request)
    reservations = await db.reservations.find(
        {"guest_id": str(user["_id"])}, {"_id": 0}
    ).sort("date", -1).to_list(50)
    return {"reservations": reservations}


@router.get("/{restaurant_id}")
async def get_restaurant(restaurant_id: str):
    r = await db.restaurants.find_one({"restaurant_id": restaurant_id}, {"_id": 0})
    if not r:
        raise HTTPException(status_code=404, detail="Restaurant nicht gefunden")
    reviews = await db.restaurant_reviews.find(
        {"restaurant_id": restaurant_id}, {"_id": 0}
    ).sort("created_at", -1).limit(20).to_list(20)
    r["reviews"] = reviews
    return r


@router.post("/create")
async def create_restaurant(req: RestaurantCreate, request: Request):
    user = await get_current_user(request)
    if user.get("role") not in ("admin", "merchant"):
        raise HTTPException(status_code=403, detail="Nur Händler/Admins")

    now = datetime.now(timezone.utc).isoformat()
    rest_id = secrets.token_hex(8)
    doc = {
        "restaurant_id": rest_id,
        "owner_id": str(user["_id"]),
        "owner_name": user.get("name", ""),
        "name": req.name,
        "cuisine": req.cuisine,
        "city": req.city,
        "address": req.address,
        "description": req.description,
        "price_range": req.price_range,
        "capacity": req.capacity,
        "opening_hours": req.opening_hours,
        "images": req.images,
        "phone": req.phone,
        "reservation_deposit": round(float(req.reservation_deposit or 0), 2),
        "rating": 0,
        "review_count": 0,
        "reservation_count": 0,
        "status": "active",
        "created_at": now,
    }
    await db.restaurants.insert_one(doc)
    doc.pop("_id", None)
    return {"ok": True, "restaurant": doc}


# ─── Reservations ───

@router.post("/reserve")
async def make_reservation(req: ReservationCreate, request: Request):
    """Reserve seats and charge the server-configured deposit exactly once."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    idempotency_key = _require_reservation_idempotency_key(req.idempotency_key, request)
    key_hash = hashlib.sha256(f"{user_id}:{idempotency_key}".encode("utf-8")).hexdigest()[:20]
    res_id = f"RSV-{key_hash}"

    existing = await db.reservations.find_one(
        {"reservation_id": res_id, "guest_id": user_id},
        {"_id": 0},
    )
    if existing:
        if existing.get("status") in {"confirmed", "pending"}:
            fresh_user = await db.users.find_one({"_id": user["_id"]}, {"balance": 1, "_id": 0}) or {}
            return {
                "ok": True,
                "reservation": existing,
                "new_balance": round(float(fresh_user.get("balance") or 0), 2),
                "replayed": True,
            }
        raise HTTPException(status_code=409, detail="Dieser Reservierungsversuch wurde bereits beendet")

    try:
        reservation_date = datetime.strptime(req.date, "%Y-%m-%d").date()
        datetime.strptime(req.time, "%H:%M")
    except ValueError:
        raise HTTPException(status_code=400, detail="Ungültiges Datum oder Uhrzeit")
    if reservation_date < datetime.now(timezone.utc).date():
        raise HTTPException(status_code=400, detail="Reservierungsdatum liegt in der Vergangenheit")

    rest = await db.restaurants.find_one({"restaurant_id": req.restaurant_id, "status": "active"})
    if not rest:
        raise HTTPException(status_code=404, detail="Restaurant nicht gefunden")

    slot_id = await _claim_reservation_seats(rest, req.date, req.time, req.guests)
    deposit = round(float(rest.get("reservation_deposit") or 0), 2)
    now = datetime.now(timezone.utc)
    ref = f"RSV-{key_hash[:12].upper()}"

    payment_result = None
    if deposit > 0:
        payment_result = await debit_wallet(
            user_id=user_id,
            amount=deposit,
            tx_type=TransactionType.FOOD_PAYMENT,
            description=f"Restaurant-Kaution: {rest['name']} ({req.date} {req.time})",
            reference=ref,
            metadata={
                "reservation_id": res_id,
                "restaurant_id": req.restaurant_id,
                "kind": "restaurant_reservation_deposit",
            },
            idempotency_key=idempotency_key,
        )
        if not payment_result.success:
            await db.reservation_slots.update_one(
                {"_id": slot_id},
                {
                    "$inc": {"remaining_seats": req.guests},
                    "$set": {"updated_at": datetime.now(timezone.utc).isoformat()},
                },
            )
            raise HTTPException(status_code=400, detail=payment_result.error or "Kaution konnte nicht bezahlt werden")

    reservation = {
        "reservation_id": res_id,
        "restaurant_id": req.restaurant_id,
        "restaurant_name": rest["name"],
        "restaurant_city": rest.get("city", ""),
        "guest_id": user_id,
        "guest_name": user.get("name", ""),
        "guest_email": user.get("email", ""),
        "date": req.date,
        "time": req.time,
        "guests": req.guests,
        "slot_id": slot_id,
        "special_requests": req.special_requests,
        "deposit": deposit,
        "cashback": 0.0,
        "status": "confirmed",
        "reference": ref,
        "payment_status": "paid" if payment_result else "not_required",
        "payment_transaction_id": payment_result.transaction_id if payment_result else None,
        "idempotency_key": idempotency_key,
        "capacity_released": False,
        "created_at": now.isoformat(),
    }
    try:
        await db.reservations.insert_one(reservation)
    except Exception:
        await db.reservation_slots.update_one(
            {"_id": slot_id},
            {
                "$inc": {"remaining_seats": req.guests},
                "$set": {"updated_at": datetime.now(timezone.utc).isoformat()},
            },
        )
        if payment_result:
            rollback = await credit_wallet(
                user_id=user_id,
                amount=deposit,
                tx_type=TransactionType.REFUND,
                description="Restaurant-Reservierung Rollback",
                reference=f"RSV-ROLLBACK-{key_hash[:10].upper()}",
                source="restaurant_reservation_rollback",
                metadata={"reservation_id": res_id},
                idempotency_key=f"restaurant-reservation-rollback:{idempotency_key}",
            )
            if not rollback.success:
                raise HTTPException(status_code=500, detail="Reservierung benötigt manuelle Zahlungsabstimmung")
        raise HTTPException(status_code=500, detail="Reservierung konnte nicht gespeichert werden")

    reservation.pop("_id", None)
    await db.restaurants.update_one(
        {"restaurant_id": req.restaurant_id},
        {"$inc": {"reservation_count": 1}},
    )
    return {
        "ok": True,
        "reservation": reservation,
        "new_balance": payment_result.new_balance if payment_result else float(user.get("balance") or 0),
        "replayed": False,
    }


@router.post("/cancel/{reservation_id}")
async def cancel_reservation(reservation_id: str, request: Request):
    """Cancel once, refund the deposit once, and release seats once."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    reservation = await db.reservations.find_one(
        {"reservation_id": reservation_id, "guest_id": user_id},
    )
    if not reservation:
        raise HTTPException(status_code=404, detail="Reservierung nicht gefunden")

    if reservation.get("status") == "cancelled" and reservation.get("refund_status") in {"completed", "not_required"}:
        released = await _release_reservation_seats_once(reservation)
        if released:
            await db.restaurants.update_one(
                {"restaurant_id": reservation["restaurant_id"], "reservation_count": {"$gt": 0}},
                {"$inc": {"reservation_count": -1}},
            )
        fresh_user = await db.users.find_one({"_id": user["_id"]}, {"balance": 1, "_id": 0}) or {}
        return {
            "ok": True,
            "refunded_deposit": round(float(reservation.get("deposit") or 0), 2),
            "new_balance": round(float(fresh_user.get("balance") or 0), 2),
            "replayed": True,
        }
    if reservation.get("status") not in {"confirmed", "cancelling"}:
        raise HTTPException(status_code=400, detail="Reservierung kann nicht storniert werden")

    if reservation.get("status") == "confirmed":
        claim = await db.reservations.update_one(
            {"reservation_id": reservation_id, "guest_id": user_id, "status": "confirmed"},
            {"$set": {
                "status": "cancelling",
                "cancel_started_at": datetime.now(timezone.utc).isoformat(),
            }},
        )
        if claim.modified_count != 1:
            reservation = await db.reservations.find_one({"reservation_id": reservation_id}) or reservation
            if reservation.get("status") != "cancelling":
                raise HTTPException(status_code=409, detail="Reservierungsstatus wurde parallel geändert")

    reservation = await db.reservations.find_one({"reservation_id": reservation_id}) or reservation
    deposit = round(float(reservation.get("deposit") or 0), 2)
    refund = None
    if deposit > 0:
        refund = await credit_wallet(
            user_id=user_id,
            amount=deposit,
            tx_type=TransactionType.REFUND,
            description=f"Stornierung Restaurant-Kaution: {reservation.get('restaurant_name', '')}",
            reference=f"RSV-REFUND-{reservation_id[-12:].upper()}",
            source="restaurant_reservation_cancel",
            metadata={
                "reservation_id": reservation_id,
                "original_transaction": reservation.get("payment_transaction_id"),
            },
            idempotency_key=f"restaurant-reservation-refund:{reservation_id}",
        )
        if not refund.success:
            await db.reservations.update_one(
                {"reservation_id": reservation_id},
                {"$set": {
                    "refund_status": "reconciliation_required",
                    "refund_error": refund.error,
                }},
            )
            raise HTTPException(status_code=409, detail=refund.error or "Erstattung wird noch verarbeitet")

    cancelled_at = datetime.now(timezone.utc).isoformat()
    await db.reservations.update_one(
        {"reservation_id": reservation_id, "status": "cancelling"},
        {"$set": {
            "status": "cancelled",
            "cancelled_at": cancelled_at,
            "refund_status": "completed" if refund else "not_required",
            "refund_transaction_id": refund.transaction_id if refund else None,
        }},
    )
    final_reservation = await db.reservations.find_one({"reservation_id": reservation_id}) or reservation
    released = await _release_reservation_seats_once(final_reservation)
    if released:
        await db.restaurants.update_one(
            {"restaurant_id": reservation["restaurant_id"], "reservation_count": {"$gt": 0}},
            {"$inc": {"reservation_count": -1}},
        )

    return {
        "ok": True,
        "refunded_deposit": deposit,
        "new_balance": refund.new_balance if refund else float(user.get("balance") or 0),
        "replayed": bool(refund.idempotent_replay) if refund else False,
    }


# ─── Reviews ───

@router.post("/review")
async def add_review(request: Request):
    user = await get_current_user(request)
    body = await request.json()
    restaurant_id = body.get("restaurant_id", "")
    rating = body.get("rating", 5)
    comment = body.get("comment", "")

    rest = await db.restaurants.find_one({"restaurant_id": restaurant_id})
    if not rest:
        raise HTTPException(status_code=404, detail="Restaurant nicht gefunden")

    review = {
        "review_id": secrets.token_hex(8),
        "restaurant_id": restaurant_id,
        "guest_id": str(user["_id"]),
        "guest_name": user.get("name", ""),
        "rating": min(5, max(1, rating)),
        "comment": comment,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.restaurant_reviews.insert_one(review)

    all_reviews = await db.restaurant_reviews.find({"restaurant_id": restaurant_id}).to_list(500)
    avg = sum(r["rating"] for r in all_reviews) / len(all_reviews)
    await db.restaurants.update_one(
        {"restaurant_id": restaurant_id},
        {"$set": {"rating": round(avg, 1), "review_count": len(all_reviews)}},
    )
    return {"ok": True}
