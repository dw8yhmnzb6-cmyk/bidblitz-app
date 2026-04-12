"""
BidBlitz V2 - Merchant Portal / Händler-Dashboard
Umsatz, Bestellungen, Produkte, Mitarbeiter, Finanzen, Bewertungen,
Restaurant-Reservierungen, Hotel-Buchungen, Job-Anzeigen, Events, Termine
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone, timedelta
from core.database import db
from core.security import get_current_user
import secrets

router = APIRouter(prefix="/api/merchant-portal", tags=["merchant-portal"])


class MerchantProfileUpdate(BaseModel):
    business_name: str = ""
    logo_url: str = ""
    description: str = ""
    phone: str = ""
    email: str = ""
    website: str = ""
    address: str = ""
    city: str = ""
    opening_hours: str = ""
    category: str = ""


async def require_merchant(request: Request):
    user = await get_current_user(request)
    if user.get("role") not in ("merchant", "admin"):
        raise HTTPException(status_code=403, detail="Nur für Händler")
    return user


# ─── Dashboard Stats ───

@router.get("/dashboard")
async def get_dashboard(request: Request):
    user = await require_merchant(request)
    uid = str(user["_id"])
    now = datetime.now(timezone.utc)
    today = now.replace(hour=0, minute=0, second=0).isoformat()
    week_ago = (now - timedelta(days=7)).isoformat()
    month_ago = (now - timedelta(days=30)).isoformat()

    # Transactions where merchant received money
    all_txns = await db.transactions.find(
        {"user_id": uid, "amount": {"$gt": 0}}, {"_id": 0, "amount": 1, "created_at": 1, "type": 1}
    ).sort("created_at", -1).limit(500).to_list(500)

    revenue_today = sum(t["amount"] for t in all_txns if t.get("created_at", "") >= today)
    revenue_week = sum(t["amount"] for t in all_txns if t.get("created_at", "") >= week_ago)
    revenue_month = sum(t["amount"] for t in all_txns if t.get("created_at", "") >= month_ago)
    revenue_total = sum(t["amount"] for t in all_txns)

    # Tips received
    tips = await db.tips.find({"staff_id": uid}, {"_id": 0, "amount": 1}).to_list(200)
    tips_total = sum(t["amount"] for t in tips)

    # Counts
    orders_today = len([t for t in all_txns if t.get("created_at", "") >= today])
    orders_month = len([t for t in all_txns if t.get("created_at", "") >= month_ago])

    # Restaurant reservations
    my_restaurants = await db.restaurants.find({"owner_id": uid}, {"_id": 0, "restaurant_id": 1}).to_list(10)
    rest_ids = [r["restaurant_id"] for r in my_restaurants]
    reservations = await db.reservations.count_documents({"restaurant_id": {"$in": rest_ids}, "status": "confirmed"}) if rest_ids else 0

    # Hotel bookings
    my_hotels = await db.properties.find({"owner_id": uid}, {"_id": 0, "property_id": 1}).to_list(10)
    hotel_ids = [h["property_id"] for h in my_hotels]
    hotel_bookings = await db.hotel_bookings.count_documents({"property_id": {"$in": hotel_ids}, "status": "confirmed"}) if hotel_ids else 0

    # Jobs
    my_jobs = await db.jobs.count_documents({"poster_id": uid, "status": "active"})
    job_applications = await db.job_applications.count_documents({"job_id": {"$in": [j["job_id"] for j in await db.jobs.find({"poster_id": uid}, {"_id": 0, "job_id": 1}).to_list(50)]}}) if my_jobs > 0 else 0

    # Events
    my_events = await db.events.count_documents({"organizer_id": uid, "status": "active"})

    # Appointments
    my_providers = await db.appointment_providers.find({"owner_id": uid}, {"_id": 0, "provider_id": 1}).to_list(10)
    prov_ids = [p["provider_id"] for p in my_providers]
    appointments = await db.appointments.count_documents({"provider_id": {"$in": prov_ids}, "status": "confirmed"}) if prov_ids else 0

    # Profile
    profile = await db.merchant_profiles.find_one({"user_id": uid}, {"_id": 0})

    return {
        "revenue": {
            "today": round(revenue_today, 2),
            "week": round(revenue_week, 2),
            "month": round(revenue_month, 2),
            "total": round(revenue_total, 2),
        },
        "orders": {"today": orders_today, "month": orders_month},
        "tips_total": round(tips_total, 2),
        "wallet_balance": round(user.get("balance", 0), 2),
        "reservations": reservations,
        "hotel_bookings": hotel_bookings,
        "active_jobs": my_jobs,
        "job_applications": job_applications,
        "active_events": my_events,
        "appointments": appointments,
        "restaurants": len(my_restaurants),
        "hotels": len(my_hotels),
        "profile": profile,
    }


# ─── Merchant Profile ───

@router.get("/profile")
async def get_merchant_profile(request: Request):
    user = await require_merchant(request)
    profile = await db.merchant_profiles.find_one({"user_id": str(user["_id"])}, {"_id": 0})
    return {"profile": profile or {
        "business_name": user.get("name", ""),
        "email": user.get("email", ""),
    }}


@router.post("/profile")
async def update_merchant_profile(req: MerchantProfileUpdate, request: Request):
    user = await require_merchant(request)
    uid = str(user["_id"])
    now = datetime.now(timezone.utc).isoformat()

    await db.merchant_profiles.update_one(
        {"user_id": uid},
        {"$set": {
            "user_id": uid,
            "business_name": req.business_name,
            "logo_url": req.logo_url,
            "description": req.description,
            "phone": req.phone,
            "email": req.email,
            "website": req.website,
            "address": req.address,
            "city": req.city,
            "opening_hours": req.opening_hours,
            "category": req.category,
            "updated_at": now,
        }},
        upsert=True,
    )
    return {"ok": True}


# ─── Recent Transactions ───

@router.get("/transactions")
async def get_merchant_transactions(request: Request, limit: int = 50):
    user = await require_merchant(request)
    txns = await db.transactions.find(
        {"user_id": str(user["_id"])}, {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    return {"transactions": txns}


# ─── Restaurant Reservations ───

@router.get("/reservations")
async def get_merchant_reservations(request: Request):
    user = await require_merchant(request)
    uid = str(user["_id"])
    my_rests = await db.restaurants.find({"owner_id": uid}, {"_id": 0, "restaurant_id": 1}).to_list(10)
    rest_ids = [r["restaurant_id"] for r in my_rests]
    if not rest_ids:
        return {"reservations": []}
    reservations = await db.reservations.find(
        {"restaurant_id": {"$in": rest_ids}}, {"_id": 0}
    ).sort("date", -1).limit(50).to_list(50)
    return {"reservations": reservations}


# ─── Hotel Bookings ───

@router.get("/hotel-bookings")
async def get_merchant_hotel_bookings(request: Request):
    user = await require_merchant(request)
    uid = str(user["_id"])
    my_hotels = await db.properties.find({"owner_id": uid}, {"_id": 0, "property_id": 1}).to_list(10)
    hotel_ids = [h["property_id"] for h in my_hotels]
    if not hotel_ids:
        return {"bookings": []}
    bookings = await db.hotel_bookings.find(
        {"property_id": {"$in": hotel_ids}}, {"_id": 0}
    ).sort("created_at", -1).limit(50).to_list(50)
    return {"bookings": bookings}


# ─── Appointments ───

@router.get("/appointments")
async def get_merchant_appointments(request: Request):
    user = await require_merchant(request)
    uid = str(user["_id"])
    my_provs = await db.appointment_providers.find({"owner_id": uid}, {"_id": 0, "provider_id": 1}).to_list(10)
    prov_ids = [p["provider_id"] for p in my_provs]
    if not prov_ids:
        return {"appointments": []}
    apts = await db.appointments.find(
        {"provider_id": {"$in": prov_ids}}, {"_id": 0}
    ).sort("date", -1).limit(50).to_list(50)
    return {"appointments": apts}


# ─── Tips Received ───

@router.get("/tips")
async def get_merchant_tips(request: Request, limit: int = 30):
    user = await require_merchant(request)
    tips = await db.tips.find(
        {"staff_id": str(user["_id"])}, {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    total = sum(t.get("amount", 0) for t in tips)
    return {"tips": tips, "total": round(total, 2)}
