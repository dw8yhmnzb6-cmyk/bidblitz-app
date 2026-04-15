"""
BidBlitz V2 - Termin-Buchungssystem
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from datetime import datetime, timezone
from core.database import db
from core.security import get_current_user
import secrets

router = APIRouter(prefix="/api/bookings", tags=["bookings"])

PROVIDERS = [
    {"id": "b1", "name": "Salon Elegance", "type": "Friseur", "city": "Berlin", "rating": 4.8, "reviews": 234, "services": [
        {"name": "Herrenschnitt", "price": 25, "duration": 30}, {"name": "Damenschnitt", "price": 45, "duration": 60},
        {"name": "Faerben", "price": 65, "duration": 90}, {"name": "Bartpflege", "price": 15, "duration": 20},
    ], "color": "#EC4899"},
    {"id": "b2", "name": "Dr. Mueller Praxis", "type": "Arzt", "city": "Berlin", "rating": 4.9, "reviews": 567, "services": [
        {"name": "Erstberatung", "price": 0, "duration": 30}, {"name": "Check-Up", "price": 50, "duration": 45},
        {"name": "Impfung", "price": 30, "duration": 15}, {"name": "Blutabnahme", "price": 20, "duration": 10},
    ], "color": "#3B82F6"},
    {"id": "b3", "name": "Massage Oase", "type": "Wellness", "city": "Muenchen", "rating": 4.7, "reviews": 189, "services": [
        {"name": "Ganzkoerpermassage", "price": 79, "duration": 60}, {"name": "Rueckenmassage", "price": 45, "duration": 30},
        {"name": "Hot Stone", "price": 89, "duration": 75}, {"name": "Fussreflexzonen", "price": 39, "duration": 30},
    ], "color": "#10B981"},
    {"id": "b4", "name": "AutoFit Werkstatt", "type": "KFZ", "city": "Hamburg", "rating": 4.6, "reviews": 312, "services": [
        {"name": "Inspektion", "price": 149, "duration": 120}, {"name": "Oelwechsel", "price": 49, "duration": 30},
        {"name": "Reifenwechsel", "price": 39, "duration": 30}, {"name": "TUeV Vorbereitung", "price": 89, "duration": 60},
    ], "color": "#F59E0B"},
]

class BookAppointment(BaseModel):
    provider_id: str
    service_name: str
    date: str = ""
    time: str = ""

@router.get("/providers")
async def get_providers(city: str = ""):
    if city:
        filtered = [p for p in PROVIDERS if p["city"].lower() == city.lower()]
    else:
        filtered = PROVIDERS
    return {"providers": filtered}

@router.post("/book")
async def book(req: BookAppointment, request: Request):
    user = await get_current_user(request)
    provider = next((p for p in PROVIDERS if p["id"] == req.provider_id), None)
    if not provider:
        raise HTTPException(404, "Anbieter nicht gefunden")
    service = next((s for s in provider["services"] if s["name"] == req.service_name), None)
    if not service:
        raise HTTPException(404, "Service nicht gefunden")
    fee = round(service["price"] * 0.05, 2)
    booking = {
        "booking_id": f"appt_{secrets.token_hex(6)}",
        "user_email": user.get("email", ""),
        "provider_id": req.provider_id,
        "provider_name": provider["name"],
        "provider_type": provider["type"],
        "service": service["name"],
        "price": service["price"],
        "duration_min": service["duration"],
        "platform_fee": fee,
        "date": req.date or "Naechster freier Termin",
        "time": req.time or "Wird bestaetigt",
        "status": "confirmed",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.appointment_bookings.insert_one(booking)
    return {"ok": True, "booking_id": booking["booking_id"], "price": service["price"],
            "message": f"Termin bei {provider['name']} gebucht: {service['name']} ({service['duration']}min, {service['price']} EUR)"}

@router.get("/my-appointments")
async def my_appointments(request: Request):
    user = await get_current_user(request)
    appts = await db.appointment_bookings.find({"user_email": user.get("email", "")}, {"_id": 0}).sort("created_at", -1).to_list(20)
    return {"appointments": appts}
