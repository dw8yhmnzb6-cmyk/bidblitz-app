"""
BidBlitz V2 - Appointment Booking System
Branchen: Friseur, Arzt, Kosmetik, Fitness, Anwalt, KFZ-Werkstatt, Handwerker
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from typing import Optional, List
from bson import ObjectId
from datetime import datetime, timezone
from core.database import db
from core.security import get_current_user
import secrets

router = APIRouter(prefix="/api/appointments", tags=["appointments"])

CASHBACK_RATE = 0.01

BRANCHES = [
    {"id": "hair", "label": "Friseur", "icon": "scissors"},
    {"id": "doctor", "label": "Arzt", "icon": "stethoscope"},
    {"id": "beauty", "label": "Kosmetik", "icon": "sparkles"},
    {"id": "fitness", "label": "Fitness", "icon": "dumbbell"},
    {"id": "lawyer", "label": "Anwalt", "icon": "scale"},
    {"id": "car_repair", "label": "KFZ-Werkstatt", "icon": "wrench"},
    {"id": "handyman", "label": "Handwerker", "icon": "hammer"},
]


class ProviderCreate(BaseModel):
    name: str
    branch: str
    city: str = ""
    address: str = ""
    description: str = ""
    phone: str = ""
    price_range: str = "mid"
    opening_hours: str = "09:00-18:00"
    services: List[str] = []
    images: List[str] = []


class AppointmentCreate(BaseModel):
    provider_id: str
    service: str = ""
    date: str  # YYYY-MM-DD
    time: str  # HH:MM
    notes: str = ""
    deposit: float = 0


@router.get("/branches")
async def get_branches():
    return {"branches": BRANCHES}


@router.get("/providers")
async def list_providers(branch: str = "", city: str = "", limit: int = 30):
    query = {"status": "active"}
    if branch:
        query["branch"] = branch
    if city:
        query["city"] = {"$regex": city, "$options": "i"}
    providers = await db.appointment_providers.find(query, {"_id": 0}).sort("rating", -1).limit(limit).to_list(limit)
    return {"providers": providers, "count": len(providers)}


@router.get("/providers/{provider_id}")
async def get_provider(provider_id: str):
    p = await db.appointment_providers.find_one({"provider_id": provider_id}, {"_id": 0})
    if not p:
        raise HTTPException(status_code=404, detail="Anbieter nicht gefunden")
    reviews = await db.appointment_reviews.find(
        {"provider_id": provider_id}, {"_id": 0}
    ).sort("created_at", -1).limit(10).to_list(10)
    p["reviews"] = reviews
    return p


@router.post("/providers")
async def create_provider(req: ProviderCreate, request: Request):
    user = await get_current_user(request)
    if user.get("role") not in ("admin", "merchant"):
        raise HTTPException(status_code=403, detail="Nur Händler/Admins")
    now = datetime.now(timezone.utc).isoformat()
    pid = secrets.token_hex(8)
    doc = {
        "provider_id": pid,
        "owner_id": str(user["_id"]),
        "owner_name": user.get("name", ""),
        "name": req.name,
        "branch": req.branch,
        "city": req.city,
        "address": req.address,
        "description": req.description,
        "phone": req.phone,
        "price_range": req.price_range,
        "opening_hours": req.opening_hours,
        "services": req.services,
        "images": req.images,
        "rating": 0,
        "review_count": 0,
        "appointment_count": 0,
        "status": "active",
        "created_at": now,
    }
    await db.appointment_providers.insert_one(doc)
    doc.pop("_id", None)
    return {"ok": True, "provider": doc}


@router.post("/book")
async def book_appointment(req: AppointmentCreate, request: Request):
    user = await get_current_user(request)
    user_id = str(user["_id"])

    provider = await db.appointment_providers.find_one({"provider_id": req.provider_id, "status": "active"})
    if not provider:
        raise HTTPException(status_code=404, detail="Anbieter nicht gefunden")

    # Check for time conflicts
    existing = await db.appointments.find_one({
        "provider_id": req.provider_id, "date": req.date, "time": req.time,
        "status": {"$in": ["confirmed", "pending"]},
    })
    if existing:
        raise HTTPException(status_code=400, detail="Dieser Termin ist bereits vergeben")

    deposit = max(0, req.deposit)
    cashback = 0
    if deposit > 0:
        balance = user.get("balance", 0)
        if balance < deposit:
            raise HTTPException(status_code=400, detail=f"Nicht genug Guthaben für Kaution (€{deposit:.2f})")
        await db.users.update_one({"_id": user["_id"], "balance": {"$gte": deposit}}, {"$inc": {"balance": -deposit}})
        cashback = round(deposit * CASHBACK_RATE, 2)
        if cashback > 0:
            await db.users.update_one({"_id": user["_id"]}, {"$inc": {"balance": cashback}})

    now = datetime.now(timezone.utc).isoformat()
    apt_id = secrets.token_hex(8)
    ref = f"APT-{secrets.token_hex(4).upper()}"

    appointment = {
        "appointment_id": apt_id,
        "provider_id": req.provider_id,
        "provider_name": provider["name"],
        "provider_branch": provider["branch"],
        "provider_city": provider.get("city", ""),
        "user_id": user_id,
        "user_name": user.get("name", ""),
        "user_email": user.get("email", ""),
        "service": req.service,
        "date": req.date,
        "time": req.time,
        "notes": req.notes,
        "deposit": deposit,
        "cashback": cashback,
        "status": "confirmed",
        "reference": ref,
        "created_at": now,
    }
    await db.appointments.insert_one(appointment)
    appointment.pop("_id", None)

    await db.appointment_providers.update_one({"provider_id": req.provider_id}, {"$inc": {"appointment_count": 1}})

    if deposit > 0:
        await db.transactions.insert_one({
            "id": apt_id, "user_id": user_id, "type": "appointment_deposit",
            "amount": -deposit, "description": f"Termin-Kaution: {provider['name']} ({req.date} {req.time})",
            "status": "completed", "reference": ref, "category": "appointment", "created_at": now,
        })

    return {"ok": True, "appointment": appointment}


@router.get("/my-appointments")
async def my_appointments(request: Request):
    user = await get_current_user(request)
    apts = await db.appointments.find(
        {"user_id": str(user["_id"])}, {"_id": 0}
    ).sort("date", -1).to_list(50)
    return {"appointments": apts}


@router.post("/cancel/{appointment_id}")
async def cancel_appointment(appointment_id: str, request: Request):
    user = await get_current_user(request)
    a = await db.appointments.find_one({"appointment_id": appointment_id})
    if not a or a["user_id"] != str(user["_id"]):
        raise HTTPException(status_code=403, detail="Nicht berechtigt")
    if a["status"] != "confirmed":
        raise HTTPException(status_code=400, detail="Termin kann nicht storniert werden")
    if a.get("deposit", 0) > 0:
        await db.users.update_one({"_id": user["_id"]}, {"$inc": {"balance": a["deposit"]}})
    await db.appointments.update_one({"appointment_id": appointment_id}, {"$set": {"status": "cancelled"}})
    return {"ok": True}


@router.post("/review")
async def add_review(request: Request):
    user = await get_current_user(request)
    body = await request.json()
    provider_id = body.get("provider_id", "")
    rating = min(5, max(1, body.get("rating", 5)))
    comment = body.get("comment", "")

    provider = await db.appointment_providers.find_one({"provider_id": provider_id})
    if not provider:
        raise HTTPException(status_code=404, detail="Anbieter nicht gefunden")

    review = {
        "review_id": secrets.token_hex(8),
        "provider_id": provider_id,
        "user_id": str(user["_id"]),
        "user_name": user.get("name", ""),
        "rating": rating,
        "comment": comment,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.appointment_reviews.insert_one(review)

    all_reviews = await db.appointment_reviews.find({"provider_id": provider_id}).to_list(500)
    avg = sum(r["rating"] for r in all_reviews) / len(all_reviews)
    await db.appointment_providers.update_one(
        {"provider_id": provider_id},
        {"$set": {"rating": round(avg, 1), "review_count": len(all_reviews)}},
    )
    return {"ok": True}
