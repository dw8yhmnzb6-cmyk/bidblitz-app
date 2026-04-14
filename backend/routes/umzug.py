"""
BidBlitz V2 - Umzugsservice
Umzugshelfer, Transporter, Preisvergleich
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
from core.database import db
from core.security import get_current_user
import secrets

router = APIRouter(prefix="/api/umzug", tags=["umzug"])

SEED_COMPANIES = [
    {"company_id":"umz_001","name":"BlitzUmzug Berlin","rating":4.8,"reviews":234,"base_price":299,"price_per_km":1.50,"city":"Berlin","description":"Komplettservice: Einpacken, Transport, Aufbau. 3er-Team, LKW 3.5t inkl.","features":["Einpackservice","Möbelmontage","Versicherung","Kartons inkl."],"image":"https://images.unsplash.com/photo-1775138260921-883455954eb0?w=800&q=80","featured":True},
    {"company_id":"umz_002","name":"EasyMove München","rating":4.7,"reviews":189,"base_price":349,"price_per_km":1.80,"city":"München","description":"Premium-Umzug mit Profi-Team. Auch Fernumzüge und Firmenumzüge. Festpreisgarantie.","features":["Festpreis","Fernumzug","Firmenumzug","Klaviertransport"],"image":"https://images.unsplash.com/photo-1762452059456-e4c16c256dd1?w=800&q=80","featured":True},
    {"company_id":"umz_003","name":"StudentenUmzug.de","rating":4.5,"reviews":412,"base_price":149,"price_per_km":1.20,"city":"Hamburg","description":"Günstige Umzugshilfe von Studenten. Flexibel, zuverlässig, günstig. Transporter optional.","features":["Günstig","Flexibel","Kurzfristig","Einzelteile"],"image":"https://images.unsplash.com/photo-1774685110718-c5b4fe026144?w=800&q=80","featured":False},
    {"company_id":"umz_004","name":"GreenMove Köln","rating":4.9,"reviews":156,"base_price":399,"price_per_km":1.60,"city":"Köln","description":"Nachhaltiger Umzug: E-Transporter, wiederverwendbare Boxen, CO2-kompensiert.","features":["E-Transporter","Nachhaltig","Wiederverwendbare Boxen","CO2-neutral"],"image":"https://images.unsplash.com/photo-1757439402101-55d1da381e70?w=800&q=80","featured":False},
]

@router.on_event("startup")
async def seed():
    if await db.umzug_companies.count_documents({}) == 0:
        now = datetime.now(timezone.utc).isoformat()
        for c in SEED_COMPANIES:
            c["created_at"] = now
        await db.umzug_companies.insert_many(SEED_COMPANIES)

@router.get("/companies")
async def list_companies(city: Optional[str]=None):
    q = {}
    if city: q["city"] = {"$regex":city,"$options":"i"}
    companies = await db.umzug_companies.find(q, {"_id":0}).sort("featured",-1).to_list(20)
    return {"companies": companies}

class QuoteReq(BaseModel):
    company_id: str
    from_address: str
    to_address: str
    date: str
    rooms: int = 2
    floor_from: int = 0
    floor_to: int = 0
    notes: str = ""

@router.post("/quote")
async def request_quote(req: QuoteReq, request: Request):
    user = await get_current_user(request)
    company = await db.umzug_companies.find_one({"company_id":req.company_id},{"_id":0})
    if not company: raise HTTPException(404, "Firma nicht gefunden")
    estimate = company["base_price"] + (req.rooms * 80) + (req.floor_from + req.floor_to) * 25
    quote = {
        "quote_id": secrets.token_hex(8), "company_id": req.company_id,
        "company_name": company["name"], "client_email": user.get("email",""),
        "client_name": user.get("name",""), "from_address": req.from_address,
        "to_address": req.to_address, "date": req.date, "rooms": req.rooms,
        "floor_from": req.floor_from, "floor_to": req.floor_to, "notes": req.notes,
        "estimated_price": estimate, "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.umzug_quotes.insert_one(quote)
    quote.pop("_id", None)
    return {"ok": True, "quote": quote}

@router.get("/my-quotes")
async def my_quotes(request: Request):
    user = await get_current_user(request)
    quotes = await db.umzug_quotes.find({"client_email":user.get("email","")},{"_id":0}).sort("created_at",-1).to_list(50)
    return {"quotes": quotes}
