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
import secrets

router = APIRouter(prefix="/api/restaurants", tags=["restaurants"])

CASHBACK_RATE = 0.02


class RestaurantCreate(BaseModel):
    name: str
    cuisine: str = ""  # italian, asian, german, turkish, indian, etc.
    city: str = ""
    address: str = ""
    description: str = ""
    price_range: str = "mid"  # budget, mid, fine
    capacity: int = 40
    opening_hours: str = "11:00-23:00"
    images: List[str] = []
    phone: str = ""


class ReservationCreate(BaseModel):
    restaurant_id: str
    date: str  # YYYY-MM-DD
    time: str  # HH:MM
    guests: int = Field(2, ge=1, le=20)
    special_requests: str = ""
    deposit: float = 0  # Optional deposit


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
    user = await get_current_user(request)
    user_id = str(user["_id"])

    rest = await db.restaurants.find_one({"restaurant_id": req.restaurant_id, "status": "active"})
    if not rest:
        raise HTTPException(status_code=404, detail="Restaurant nicht gefunden")

    # Check capacity for that time slot
    existing = await db.reservations.count_documents({
        "restaurant_id": req.restaurant_id,
        "date": req.date,
        "time": req.time,
        "status": {"$in": ["confirmed", "pending"]},
    })
    if existing >= rest.get("capacity", 40) // 4:  # ~4 guests per table
        raise HTTPException(status_code=400, detail="Keine Tische mehr für diese Zeit verfügbar")

    # Handle deposit if required
    deposit = max(0, req.deposit)
    cashback = 0
    if deposit > 0:
        balance = user.get("balance", 0)
        if balance < deposit:
            raise HTTPException(status_code=400, detail=f"Nicht genug Guthaben für Kaution (€{deposit:.2f})")
        await db.users.update_one(
            {"_id": user["_id"], "balance": {"$gte": deposit}},
            {"$inc": {"balance": -deposit}},
        )
        cashback = round(deposit * CASHBACK_RATE, 2)
        if cashback > 0:
            await db.users.update_one({"_id": user["_id"]}, {"$inc": {"balance": cashback}})

    now = datetime.now(timezone.utc).isoformat()
    res_id = secrets.token_hex(8)
    ref = f"RSV-{secrets.token_hex(4).upper()}"

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
        "special_requests": req.special_requests,
        "deposit": deposit,
        "cashback": cashback,
        "status": "confirmed",
        "reference": ref,
        "created_at": now,
    }
    await db.reservations.insert_one(reservation)
    reservation.pop("_id", None)

    await db.restaurants.update_one(
        {"restaurant_id": req.restaurant_id}, {"$inc": {"reservation_count": 1}}
    )

    if deposit > 0:
        await db.transactions.insert_one({
            "id": res_id, "user_id": user_id, "type": "restaurant_deposit",
            "amount": -deposit, "description": f"Kaution: {rest['name']} ({req.date} {req.time})",
            "status": "completed", "reference": ref, "category": "restaurant", "created_at": now,
        })

    return {"ok": True, "reservation": reservation}


@router.post("/cancel/{reservation_id}")
async def cancel_reservation(reservation_id: str, request: Request):
    user = await get_current_user(request)
    r = await db.reservations.find_one({"reservation_id": reservation_id})
    if not r or r["guest_id"] != str(user["_id"]):
        raise HTTPException(status_code=403, detail="Nicht berechtigt")
    if r["status"] != "confirmed":
        raise HTTPException(status_code=400, detail="Reservierung kann nicht storniert werden")

    # Refund deposit if any
    if r.get("deposit", 0) > 0:
        await db.users.update_one({"_id": user["_id"]}, {"$inc": {"balance": r["deposit"]}})

    await db.reservations.update_one(
        {"reservation_id": reservation_id}, {"$set": {"status": "cancelled"}}
    )
    return {"ok": True, "refunded_deposit": r.get("deposit", 0)}


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
