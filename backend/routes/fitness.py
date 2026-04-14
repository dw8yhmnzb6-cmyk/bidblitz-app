"""
BidBlitz V2 - Fitness & Gym-Finder
Fitnessstudios, Personal Trainer, Mitgliedschaften
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
from core.database import db
from core.security import get_current_user
import secrets

router = APIRouter(prefix="/api/fitness", tags=["fitness"])

SEED_GYMS = [
    {"gym_id":"gym_001","name":"FitFactory Berlin","type":"fitnessstudio","rating":4.7,"reviews":456,"monthly_price":29.99,"city":"Berlin","district":"Mitte","description":"24/7 geöffnet, 2000m² Trainingsfläche, Sauna, Pool, 50+ Kurse/Woche.","features":["24/7","Sauna","Pool","Kurse","Personal Trainer"],"image":"https://images.unsplash.com/photo-1758611971270-89ce7ed506e1?w=800&q=80","featured":True},
    {"gym_id":"gym_002","name":"CrossFit Box Hamburg","type":"crossfit","rating":4.9,"reviews":189,"monthly_price":79.99,"city":"Hamburg","district":"Altona","description":"Functional Fitness, WODs, Olympic Lifting. Community-driven, max. 15 Teilnehmer pro Klasse.","features":["CrossFit","Community","Personal Coaching","Open Gym"],"image":"https://images.unsplash.com/photo-1758612214848-04e700d192ce?w=800&q=80","featured":True},
    {"gym_id":"gym_003","name":"YogaLoft München","type":"yoga","rating":4.8,"reviews":312,"monthly_price":49.99,"city":"München","district":"Schwabing","description":"Hatha, Vinyasa, Yin Yoga. Dachterrasse mit Alpenblick. Meditation & Atemkurse.","features":["Yoga","Meditation","Dachterrasse","Workshops"],"image":"https://images.unsplash.com/photo-1757439402101-55d1da381e70?w=800&q=80","featured":False},
    {"gym_id":"gym_004","name":"PowerHouse Köln","type":"fitnessstudio","rating":4.6,"reviews":278,"monthly_price":19.99,"city":"Köln","district":"Ehrenfeld","description":"Budget-Gym mit Top-Ausstattung. Geräte von Technogym, kostenlose Getränke.","features":["Günstig","Technogym","Getränke-Flat","App-Zugang"],"image":"https://images.unsplash.com/photo-1758612214917-81d7956c09de?w=800&q=80","featured":False},
    {"gym_id":"gym_005","name":"Personal Training Studio","type":"personal","rating":5.0,"reviews":67,"monthly_price":199.99,"city":"Frankfurt","district":"Westend","description":"1:1 Personal Training, individuelle Pläne, Ernährungsberatung. Nur nach Terminbuchung.","features":["1:1 Training","Ernährungsplan","Körperanalyse","Flexibel"],"image":"https://images.unsplash.com/photo-1758519290828-2e62b7699b28?w=800&q=80","featured":True},
]

@router.on_event("startup")
async def seed():
    if await db.gyms.count_documents({}) == 0:
        now = datetime.now(timezone.utc).isoformat()
        for g in SEED_GYMS:
            g["created_at"] = now
        await db.gyms.insert_many(SEED_GYMS)

@router.get("/gyms")
async def list_gyms(type: Optional[str]=None, city: Optional[str]=None):
    q = {}
    if type: q["type"] = type
    if city: q["city"] = {"$regex":city,"$options":"i"}
    gyms = await db.gyms.find(q, {"_id":0}).sort("featured",-1).to_list(50)
    return {"gyms": gyms}

@router.get("/gym/{gym_id}")
async def get_gym(gym_id: str):
    g = await db.gyms.find_one({"gym_id":gym_id},{"_id":0})
    if not g: raise HTTPException(404, "Gym nicht gefunden")
    return g

@router.get("/types")
async def get_types():
    return {"types": [
        {"id":"fitnessstudio","label":"Fitnessstudio"},
        {"id":"crossfit","label":"CrossFit"},
        {"id":"yoga","label":"Yoga & Pilates"},
        {"id":"personal","label":"Personal Training"},
        {"id":"schwimmen","label":"Schwimmbad"},
        {"id":"kampfsport","label":"Kampfsport"},
    ]}

class MembershipReq(BaseModel):
    gym_id: str
    plan: str = "monthly"

@router.post("/membership")
async def join_gym(req: MembershipReq, request: Request):
    user = await get_current_user(request)
    gym = await db.gyms.find_one({"gym_id":req.gym_id},{"_id":0})
    if not gym: raise HTTPException(404, "Gym nicht gefunden")
    membership = {
        "membership_id": secrets.token_hex(8), "gym_id": req.gym_id,
        "gym_name": gym["name"], "user_email": user.get("email",""),
        "user_name": user.get("name",""), "plan": req.plan,
        "monthly_price": gym["monthly_price"], "status": "active",
        "started_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.gym_memberships.insert_one(membership)
    membership.pop("_id", None)
    return {"ok": True, "membership": membership}
