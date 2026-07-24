"""
BidBlitz V2 - Reinigungsservice
Wohnungs- und Büroreinigung buchen
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
from core.database import db
from core.security import get_current_user
import secrets

router = APIRouter(prefix="/api/reinigung", tags=["reinigung"])

SERVICES = [
    {"service_id":"rein_001","name":"Standard-Reinigung","description":"Staubsaugen, Wischen, Bad, Küche, Staub wischen. Ideal für regelmäßige Reinigung.","price_per_hour":25,"min_hours":2,"image":"https://images.unsplash.com/photo-1638454795595-0a0abf68614d?w=800&q=80","popular":True},
    {"service_id":"rein_002","name":"Grundreinigung","description":"Intensive Komplettreinigung inkl. Fenster, Backofen, Kühlschrank. Für Umzug oder Frühjahrsputz.","price_per_hour":35,"min_hours":3,"image":"https://images.unsplash.com/photo-1772256019760-a144ae100cc4?w=800&q=80","popular":True},
    {"service_id":"rein_003","name":"Büroreinigung","description":"Professionelle Büroreinigung, Teppichreinigung, Sanitärbereich. Ab 50m².","price_per_hour":30,"min_hours":2,"image":"https://images.unsplash.com/photo-1762452059456-e4c16c256dd1?w=800&q=80","popular":False},
    {"service_id":"rein_004","name":"Fensterreinigung","description":"Innen & Außen, Rahmen, Fensterbänke. Auch für schwer erreichbare Fenster.","price_per_hour":40,"min_hours":1,"image":"https://images.unsplash.com/photo-1775138260921-883455954eb0?w=800&q=80","popular":False},
    {"service_id":"rein_005","name":"Teppich- & Polsterreinigung","description":"Professionelle Nassreinigung von Teppichen, Sofas, Matratzen. Mit Industriegeräten.","price_per_hour":45,"min_hours":1,"image":"https://images.unsplash.com/photo-1638454795595-0a0abf68614d?w=800&q=80","popular":False},
]

@router.on_event("startup")
async def seed():
    if await db.reinigung_services.count_documents({}) == 0:
        now = datetime.now(timezone.utc).isoformat()
        for s in SERVICES:
            s["created_at"] = now
        await db.reinigung_services.insert_many(SERVICES)

@router.get("/services")
async def list_services():
    services = await db.reinigung_services.find({}, {"_id":0}).to_list(20)
    return {"services": services}

class BookReq(BaseModel):
    service_id: str
    date: str
    time: str
    hours: int = 2
    address: str
    notes: str = ""

@router.post("/book")
async def book(req: BookReq, request: Request):
    user = await get_current_user(request)
    svc = await db.reinigung_services.find_one({"service_id":req.service_id},{"_id":0})
    if not svc: raise HTTPException(404, "Service nicht gefunden")
    total = svc["price_per_hour"] * req.hours
    booking = {
        "booking_id": secrets.token_hex(8), "service_id": req.service_id,
        "service_name": svc["name"], "client_email": user.get("email",""),
        "client_name": user.get("name",""), "date": req.date, "time": req.time,
        "hours": req.hours, "address": req.address, "notes": req.notes,
        "total": total, "status": "confirmed",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.reinigung_bookings.insert_one(booking)
    booking.pop("_id", None)
    return {"ok": True, "booking": booking}

@router.get("/my-bookings")
async def my_bookings(request: Request):
    user = await get_current_user(request)
    bookings = await db.reinigung_bookings.find({"client_email":user.get("email","")},{"_id":0}).sort("created_at",-1).to_list(50)
    return {"bookings": bookings}
