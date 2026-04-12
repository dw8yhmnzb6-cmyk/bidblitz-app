"""
BidBlitz V2 - Flugsuche & Buchung
Realistische Flugrouten, Wallet-Zahlung, Cashback
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from typing import Optional, List
from bson import ObjectId
from datetime import datetime, timezone
from core.database import db
from core.security import get_current_user
import secrets

router = APIRouter(prefix="/api/flights", tags=["flights"])

CASHBACK_RATE = 0.03


class FlightSearch(BaseModel):
    origin: str
    destination: str
    date: str = ""
    passengers: int = 1
    travel_class: str = "economy"


class FlightBooking(BaseModel):
    flight_id: str
    passengers: int = 1
    travel_class: str = "economy"


@router.get("/search")
async def search_flights(origin: str = "", destination: str = "", date: str = "", travel_class: str = "economy", limit: int = 20):
    query = {"status": "active"}
    if origin:
        query["origin_code"] = {"$regex": origin, "$options": "i"}
    if destination:
        query["destination_code"] = {"$regex": destination, "$options": "i"}
    if date:
        query["departure_date"] = date

    flights = await db.flights.find(query, {"_id": 0}).sort("price_economy", 1).limit(limit).to_list(limit)
    return {"flights": flights, "count": len(flights)}


@router.get("/popular")
async def popular_routes(limit: int = 10):
    flights = await db.flights.find({"status": "active"}, {"_id": 0}).sort("booking_count", -1).limit(limit).to_list(limit)
    return {"flights": flights}


@router.get("/detail/{flight_id}")
async def get_flight(flight_id: str):
    f = await db.flights.find_one({"flight_id": flight_id}, {"_id": 0})
    if not f:
        raise HTTPException(status_code=404, detail="Flug nicht gefunden")
    return f


@router.post("/book")
async def book_flight(req: FlightBooking, request: Request):
    user = await get_current_user(request)
    user_id = str(user["_id"])

    flight = await db.flights.find_one({"flight_id": req.flight_id, "status": "active"})
    if not flight:
        raise HTTPException(status_code=404, detail="Flug nicht gefunden")

    price_key = f"price_{req.travel_class}"
    price_per = flight.get(price_key, flight.get("price_economy", 0))
    total = round(price_per * req.passengers, 2)

    balance = user.get("balance", 0)
    if balance < total:
        raise HTTPException(status_code=400, detail=f"Nicht genug Guthaben. Benötigt: €{total:.2f}")

    result = await db.users.update_one(
        {"_id": user["_id"], "balance": {"$gte": total}},
        {"$inc": {"balance": -total}},
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=400, detail="Zahlung fehlgeschlagen")

    cashback = round(total * CASHBACK_RATE, 2)
    if cashback > 0:
        await db.users.update_one({"_id": user["_id"]}, {"$inc": {"balance": cashback}})

    now = datetime.now(timezone.utc).isoformat()
    booking_id = secrets.token_hex(8)
    ref = f"FLT-{secrets.token_hex(4).upper()}"
    pnr = f"BLZ{secrets.token_hex(3).upper()}"

    booking = {
        "booking_id": booking_id,
        "flight_id": req.flight_id,
        "airline": flight.get("airline", ""),
        "flight_number": flight.get("flight_number", ""),
        "origin": flight.get("origin", ""),
        "origin_code": flight.get("origin_code", ""),
        "destination": flight.get("destination", ""),
        "destination_code": flight.get("destination_code", ""),
        "departure_date": flight.get("departure_date", ""),
        "departure_time": flight.get("departure_time", ""),
        "arrival_time": flight.get("arrival_time", ""),
        "duration": flight.get("duration", ""),
        "travel_class": req.travel_class,
        "passengers": req.passengers,
        "price_per_person": price_per,
        "total": total,
        "cashback": cashback,
        "pnr": pnr,
        "user_id": user_id,
        "user_name": user.get("name", ""),
        "user_email": user.get("email", ""),
        "status": "confirmed",
        "reference": ref,
        "created_at": now,
    }
    await db.flight_bookings.insert_one(booking)
    booking.pop("_id", None)

    await db.flights.update_one({"flight_id": req.flight_id}, {"$inc": {"booking_count": req.passengers}})

    await db.transactions.insert_one({
        "id": booking_id, "user_id": user_id, "type": "flight_booking",
        "amount": -total, "description": f"Flug: {flight['origin_code']}-{flight['destination_code']} ({req.passengers} Pax)",
        "status": "completed", "reference": ref, "category": "flight", "created_at": now,
    })

    return {"ok": True, "booking": booking}


@router.get("/my-bookings")
async def my_bookings(request: Request):
    user = await get_current_user(request)
    bookings = await db.flight_bookings.find(
        {"user_id": str(user["_id"])}, {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    return {"bookings": bookings}


@router.get("/airports")
async def get_airports():
    return {"airports": [
        {"code": "DXB", "city": "Dubai", "country": "AE"},
        {"code": "BER", "city": "Berlin", "country": "DE"},
        {"code": "MUC", "city": "München", "country": "DE"},
        {"code": "IST", "city": "Istanbul", "country": "TR"},
        {"code": "VIE", "city": "Wien", "country": "AT"},
        {"code": "ZRH", "city": "Zürich", "country": "CH"},
        {"code": "AYT", "city": "Antalya", "country": "TR"},
        {"code": "FRA", "city": "Frankfurt", "country": "DE"},
        {"code": "HAM", "city": "Hamburg", "country": "DE"},
        {"code": "LHR", "city": "London", "country": "GB"},
        {"code": "CDG", "city": "Paris", "country": "FR"},
        {"code": "BCN", "city": "Barcelona", "country": "ES"},
    ]}
