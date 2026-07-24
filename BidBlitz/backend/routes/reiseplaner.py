"""
BidBlitz V2 - Reiseplaner
Urlaubspakete (Flug + Hotel + Aktivitäten), Reisebuchung
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
from core.database import db
from core.security import get_current_user
import secrets

router = APIRouter(prefix="/api/reiseplaner", tags=["reiseplaner"])

SEED_TRIPS = [
    {"trip_id":"trip_001","title":"Barcelona Städtetrip","destination":"Barcelona","country":"Spanien","duration_days":5,"price_per_person":599,"rating":4.8,"reviews":432,"description":"5 Tage Barcelona: Flug + 4* Hotel + Sagrada Familia Tour + Tapas-Abend. Direktflug ab Berlin.","includes":["Hin- & Rückflug","4* Hotel zentral","Sagrada Familia","Tapas-Tour","Flughafentransfer"],"image":"https://images.unsplash.com/photo-1757439402101-55d1da381e70?w=800&q=80","category":"staedtetrip","featured":True,"available_dates":["2026-03-15","2026-04-10","2026-05-20"]},
    {"trip_id":"trip_002","title":"Malediven Traumurlaub","destination":"Malediven","country":"Malediven","duration_days":10,"price_per_person":2499,"rating":4.9,"reviews":189,"description":"10 Tage Malediven: Overwater Villa, All-Inclusive, Schnorchel-Ausflüge, Sunset Cruise.","includes":["Flug","Overwater Villa","All-Inclusive","Schnorcheln","Sunset Cruise","Spa-Gutschein"],"image":"https://images.unsplash.com/photo-1622015663381-d2e05ae91b72?w=800&q=80","category":"strandurlaub","featured":True,"available_dates":["2026-04-01","2026-06-15","2026-09-01"]},
    {"trip_id":"trip_003","title":"Alpen Wanderwoche","destination":"Tirol","country":"Österreich","duration_days":7,"price_per_person":799,"rating":4.7,"reviews":267,"description":"7 Tage Wandern in Tirol: 3* Berghotel, geführte Touren, Halbpension, Wellness.","includes":["Anreise","3* Berghotel","Halbpension","3 geführte Touren","Wellness-Bereich"],"image":"https://images.unsplash.com/photo-1757439402101-55d1da381e70?w=800&q=80","category":"aktivurlaub","featured":False,"available_dates":["2026-06-01","2026-07-15","2026-08-20"]},
    {"trip_id":"trip_004","title":"New York Shopping Weekend","destination":"New York","country":"USA","duration_days":4,"price_per_person":1299,"rating":4.6,"reviews":178,"description":"4 Tage NYC: Flug, 4* Hotel Manhattan, Empire State, Times Square Walking Tour.","includes":["Direktflug","4* Hotel Manhattan","Empire State Ticket","Walking Tour","Metro-Pass"],"image":"https://images.unsplash.com/photo-1772256019760-a144ae100cc4?w=800&q=80","category":"staedtetrip","featured":True,"available_dates":["2026-03-20","2026-05-10","2026-11-25"]},
    {"trip_id":"trip_005","title":"Toskana Genussreise","destination":"Toskana","country":"Italien","duration_days":6,"price_per_person":899,"rating":4.8,"reviews":312,"description":"6 Tage Toskana: Weingut, Kochkurs, Florenz, Siena, Truffle-Hunting. Mietwagen inkl.","includes":["Flug","Landhotel","Mietwagen","Kochkurs","Weinprobe","Florenz-Tour"],"image":"https://images.unsplash.com/photo-1622015663319-e97e697503ee?w=800&q=80","category":"genussreise","featured":False,"available_dates":["2026-04-20","2026-06-10","2026-09-15"]},
]

@router.on_event("startup")
async def seed():
    if await db.travel_trips.count_documents({}) == 0:
        now = datetime.now(timezone.utc).isoformat()
        for t in SEED_TRIPS:
            t["created_at"] = now
            t["bookings_count"] = 0
        await db.travel_trips.insert_many(SEED_TRIPS)

@router.get("/trips")
async def list_trips(category: Optional[str]=None, search: Optional[str]=None, max_price: Optional[float]=None):
    q = {}
    if category: q["category"] = category
    if max_price: q["price_per_person"] = {"$lte": max_price}
    if search: q["$or"] = [{"title":{"$regex":search,"$options":"i"}},{"destination":{"$regex":search,"$options":"i"}},{"country":{"$regex":search,"$options":"i"}}]
    trips = await db.travel_trips.find(q, {"_id":0}).sort("featured",-1).to_list(50)
    return {"trips": trips, "total": len(trips)}

@router.get("/trip/{trip_id}")
async def get_trip(trip_id: str):
    t = await db.travel_trips.find_one({"trip_id":trip_id},{"_id":0})
    if not t: raise HTTPException(404, "Reise nicht gefunden")
    return t

@router.get("/categories")
async def get_categories():
    return {"categories": [
        {"id":"staedtetrip","label":"Städtetrip"},
        {"id":"strandurlaub","label":"Strandurlaub"},
        {"id":"aktivurlaub","label":"Aktivurlaub"},
        {"id":"genussreise","label":"Genussreise"},
        {"id":"kreuzfahrt","label":"Kreuzfahrt"},
        {"id":"fernreise","label":"Fernreise"},
    ]}

class BookReq(BaseModel):
    trip_id: str
    date: str
    travelers: int = 1
    notes: str = ""

@router.post("/book")
async def book_trip(req: BookReq, request: Request):
    user = await get_current_user(request)
    trip = await db.travel_trips.find_one({"trip_id":req.trip_id},{"_id":0})
    if not trip: raise HTTPException(404, "Reise nicht gefunden")
    total = trip["price_per_person"] * req.travelers
    booking = {
        "booking_id": secrets.token_hex(8), "trip_id": req.trip_id,
        "trip_title": trip["title"], "destination": trip["destination"],
        "client_email": user.get("email",""), "client_name": user.get("name",""),
        "date": req.date, "travelers": req.travelers, "total": total,
        "status": "confirmed", "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.travel_bookings.insert_one(booking)
    booking.pop("_id", None)
    await db.travel_trips.update_one({"trip_id":req.trip_id},{"$inc":{"bookings_count":1}})
    return {"ok": True, "booking": booking}

@router.get("/my-bookings")
async def my_bookings(request: Request):
    user = await get_current_user(request)
    bookings = await db.travel_bookings.find({"client_email":user.get("email","")},{"_id":0}).sort("created_at",-1).to_list(50)
    return {"bookings": bookings}
