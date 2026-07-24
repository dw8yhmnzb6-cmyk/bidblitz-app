"""
BidBlitz V2 - Tierbetreuung
Hundesitter, Gassi-Service, Tierarzt
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
from core.database import db
from core.security import get_current_user
import secrets

router = APIRouter(prefix="/api/tierbetreuung", tags=["tierbetreuung"])

SEED = [
    {"sitter_id":"pet_001","name":"Marie Tierlieb","service":"hundesitter","rating":4.9,"reviews":178,"price_per_day":35,"city":"Berlin","description":"Erfahrene Hundesitterin mit eigenem Garten. Max. 3 Hunde gleichzeitig. Tägliche Foto-Updates.","animals":["Hund"],"avatar":"https://images.unsplash.com/photo-1765648580890-732fa6d769c5?w=400&q=80","featured":True},
    {"sitter_id":"pet_002","name":"Gassi-König Tom","service":"gassi","rating":4.8,"reviews":234,"price_per_day":15,"city":"München","description":"Professioneller Gassi-Service. 60 Min. pro Runde, kleine Gruppen (max. 4 Hunde). GPS-Tracking.","animals":["Hund"],"avatar":"https://images.unsplash.com/photo-1758519290828-2e62b7699b28?w=400&q=80","featured":True},
    {"sitter_id":"pet_003","name":"Katzenpension Schnurr","service":"katzensitter","rating":4.9,"reviews":145,"price_per_day":25,"city":"Hamburg","description":"Liebevolle Katzenbetreuung bei Ihnen zuhause. Füttern, Spielen, Katzenklo. Auch Medikamentengabe.","animals":["Katze"],"avatar":"https://images.unsplash.com/photo-1765648580528-8d659861d81a?w=400&q=80","featured":False},
    {"sitter_id":"pet_004","name":"Tier-Taxi Express","service":"transport","rating":4.7,"reviews":89,"price_per_day":40,"city":"Köln","description":"Tiertransport zum Tierarzt, Flughafen, oder Tierpension. Klimatisiertes Fahrzeug.","animals":["Hund","Katze","Kleintiere"],"avatar":"https://images.unsplash.com/photo-1758519290828-2e62b7699b28?w=400&q=80","featured":False},
    {"sitter_id":"pet_005","name":"Dr. Pfote Mobil","service":"tierarzt","rating":4.9,"reviews":267,"price_per_day":65,"city":"Frankfurt","description":"Mobiler Tierarzt — Hausbesuche für Impfungen, Check-ups, Notfälle. Stressfrei für Ihr Tier.","animals":["Hund","Katze","Kleintiere"],"avatar":"https://images.unsplash.com/photo-1765648580890-732fa6d769c5?w=400&q=80","featured":True},
]

@router.on_event("startup")
async def seed():
    if await db.pet_sitters.count_documents({}) == 0:
        now = datetime.now(timezone.utc).isoformat()
        for s in SEED:
            s["created_at"] = now
            s["available"] = True
        await db.pet_sitters.insert_many(SEED)

@router.get("/sitters")
async def list_sitters(service: Optional[str]=None, city: Optional[str]=None):
    q = {"available": True}
    if service: q["service"] = service
    if city: q["city"] = {"$regex":city,"$options":"i"}
    sitters = await db.pet_sitters.find(q, {"_id":0}).sort("featured",-1).to_list(50)
    return {"sitters": sitters}

@router.get("/services")
async def get_services():
    return {"services": [
        {"id":"hundesitter","label":"Hundesitter","icon":"Dog"},
        {"id":"gassi","label":"Gassi-Service","icon":"Footprints"},
        {"id":"katzensitter","label":"Katzensitter","icon":"Cat"},
        {"id":"transport","label":"Tier-Taxi","icon":"Car"},
        {"id":"tierarzt","label":"Mobiler Tierarzt","icon":"Stethoscope"},
    ]}

class BookReq(BaseModel):
    sitter_id: str
    start_date: str
    end_date: str = ""
    pet_name: str = ""
    pet_type: str = ""
    notes: str = ""

@router.post("/book")
async def book(req: BookReq, request: Request):
    user = await get_current_user(request)
    sitter = await db.pet_sitters.find_one({"sitter_id":req.sitter_id},{"_id":0})
    if not sitter: raise HTTPException(404, "Nicht gefunden")
    booking = {
        "booking_id": secrets.token_hex(8), "sitter_id": req.sitter_id,
        "sitter_name": sitter["name"], "client_email": user.get("email",""),
        "client_name": user.get("name",""), "start_date": req.start_date,
        "end_date": req.end_date, "pet_name": req.pet_name,
        "pet_type": req.pet_type, "notes": req.notes,
        "price_per_day": sitter["price_per_day"], "status": "confirmed",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.pet_bookings.insert_one(booking)
    booking.pop("_id", None)
    return {"ok": True, "booking": booking}
