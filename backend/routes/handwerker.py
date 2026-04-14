"""
BidBlitz V2 - Handwerker-Vermittlung
Elektriker, Klempner, Maler etc. finden & beauftragen
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
from core.database import db
from core.security import get_current_user
import secrets

router = APIRouter(prefix="/api/handwerker", tags=["handwerker"])

SEED = [
    {"hw_id":"hw_001","name":"Thomas Elektromeister","category":"elektriker","rating":4.9,"reviews":187,"hourly_rate":65,"city":"Berlin","district":"Charlottenburg","description":"Elektroinstallationen, Smart Home, Sicherungskästen. 15 Jahre Erfahrung. Notdienst 24/7.","skills":["Elektroinstallation","Smart Home","Notdienst","E-Check"],"avatar":"https://images.unsplash.com/photo-1758519290828-2e62b7699b28?w=400&q=80","available":True,"featured":True,"response_time":"< 30 Min.","completed_jobs":412},
    {"hw_id":"hw_002","name":"Schmidt Sanitär & Heizung","category":"klempner","rating":4.8,"reviews":234,"hourly_rate":70,"city":"München","district":"Schwabing","description":"Rohrverstopfung, Heizungsreparatur, Bad-Sanierung. Meisterbetrieb seit 2008.","skills":["Rohrreinigung","Heizung","Bad-Sanierung","Notdienst"],"avatar":"https://images.unsplash.com/photo-1758519290828-2e62b7699b28?w=400&q=80","available":True,"featured":True,"response_time":"< 1 Std.","completed_jobs":356},
    {"hw_id":"hw_003","name":"Malerbetrieb Farbenfroh","category":"maler","rating":4.7,"reviews":156,"hourly_rate":55,"city":"Hamburg","district":"Eimsbüttel","description":"Innenanstrich, Fassade, Tapezieren, Lackierarbeiten. Farbberatung inklusive.","skills":["Innenanstrich","Fassade","Tapezieren","Lackieren"],"avatar":"https://images.unsplash.com/photo-1765648580890-732fa6d769c5?w=400&q=80","available":True,"featured":False,"response_time":"< 2 Std.","completed_jobs":278},
    {"hw_id":"hw_004","name":"Schlüsseldienst Blitz","category":"schluessel","rating":4.6,"reviews":89,"hourly_rate":80,"city":"Berlin","district":"Mitte","description":"Türöffnung, Schlossaustausch, Sicherheitsberatung. Festpreise, keine versteckten Kosten.","skills":["Türöffnung","Schlossaustausch","Sicherheitstechnik"],"avatar":"https://images.unsplash.com/photo-1758519290828-2e62b7699b28?w=400&q=80","available":True,"featured":False,"response_time":"< 20 Min.","completed_jobs":534},
    {"hw_id":"hw_005","name":"Gartenbau Weber","category":"garten","rating":4.9,"reviews":112,"hourly_rate":50,"city":"Köln","district":"Lindenthal","description":"Gartenpflege, Rasenmähen, Heckenschnitt, Baumfällung, Terrassenbau.","skills":["Gartenpflege","Heckenschnitt","Terrassenbau","Baumfällung"],"avatar":"https://images.unsplash.com/photo-1765648580528-8d659861d81a?w=400&q=80","available":True,"featured":True,"response_time":"< 4 Std.","completed_jobs":198},
    {"hw_id":"hw_006","name":"Möbelmontage Express","category":"montage","rating":4.8,"reviews":302,"hourly_rate":45,"city":"Frankfurt","district":"Sachsenhausen","description":"IKEA-Montage, Küchenmontage, Regale, TV-Wandhalterung. Schnell und sauber.","skills":["IKEA-Montage","Küchenmontage","TV-Montage","Regale"],"avatar":"https://images.unsplash.com/photo-1758519290828-2e62b7699b28?w=400&q=80","available":True,"featured":False,"response_time":"< 2 Std.","completed_jobs":623},
]

CATEGORIES = [
    {"id":"elektriker","label":"Elektriker","icon":"Zap","color":"#F59E0B"},
    {"id":"klempner","label":"Klempner","icon":"Droplets","color":"#3B82F6"},
    {"id":"maler","label":"Maler","icon":"Paintbrush","color":"#A855F7"},
    {"id":"schluessel","label":"Schlüsseldienst","icon":"Key","color":"#EF4444"},
    {"id":"garten","label":"Gartenbau","icon":"TreePine","color":"#10B981"},
    {"id":"montage","label":"Montage","icon":"Wrench","color":"#F97316"},
]

@router.on_event("startup")
async def seed():
    if await db.handwerker.count_documents({}) == 0:
        now = datetime.now(timezone.utc).isoformat()
        for h in SEED:
            h["created_at"] = now
        await db.handwerker.insert_many(SEED)

@router.get("/list")
async def list_handwerker(category: Optional[str]=None, city: Optional[str]=None):
    q = {"available": True}
    if category: q["category"] = category
    if city: q["city"] = {"$regex": city, "$options": "i"}
    items = await db.handwerker.find(q, {"_id":0}).sort("featured",-1).to_list(100)
    return {"handwerker": items, "total": len(items)}

@router.get("/categories")
async def get_categories():
    return {"categories": CATEGORIES}

@router.get("/detail/{hw_id}")
async def get_detail(hw_id: str):
    h = await db.handwerker.find_one({"hw_id": hw_id}, {"_id":0})
    if not h: raise HTTPException(404, "Nicht gefunden")
    return h

class BookingReq(BaseModel):
    hw_id: str
    description: str
    preferred_date: str = ""
    address: str = ""

@router.post("/book")
async def book(req: BookingReq, request: Request):
    user = await get_current_user(request)
    booking = {
        "booking_id": secrets.token_hex(8), "hw_id": req.hw_id,
        "client_email": user.get("email",""), "client_name": user.get("name",""),
        "description": req.description, "preferred_date": req.preferred_date,
        "address": req.address, "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.handwerker_bookings.insert_one(booking)
    booking.pop("_id", None)
    return {"ok": True, "booking": booking}
