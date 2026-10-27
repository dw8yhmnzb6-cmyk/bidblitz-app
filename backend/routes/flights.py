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
from core.config import TEST_MODE
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
    """Do not charge users for local flight inventory without a live booking provider."""
    await get_current_user(request)
    raise HTTPException(
        status_code=503,
        detail="Flugbuchungen sind bis zur verifizierten Live-Provider-Anbindung deaktiviert. Es wird kein Wallet-Guthaben belastet.",
    )


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
