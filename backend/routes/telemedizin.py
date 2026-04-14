"""
BidBlitz V2 - Telemedizin / Gesundheit
Ärzte finden, Videosprechstunde buchen, Gesundheitstracker
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
from core.database import db
from core.security import get_current_user
import secrets

router = APIRouter(prefix="/api/telemedizin", tags=["telemedizin"])

SEED = [
    {"doctor_id":"doc_001","name":"Dr. med. Sarah Fischer","specialty":"allgemeinmedizin","rating":4.9,"reviews":342,"price_consultation":35,"city":"Berlin","description":"Hausärztin mit 12 Jahren Erfahrung. Akutsprechstunde, Vorsorge, Krankschreibungen.","languages":["Deutsch","Englisch"],"avatar":"https://images.unsplash.com/photo-1765648580890-732fa6d769c5?w=400&q=80","available":True,"next_slot":"Heute 14:00","featured":True},
    {"doctor_id":"doc_002","name":"Dr. med. Michael Krüger","specialty":"dermatologie","rating":4.8,"reviews":256,"price_consultation":45,"city":"München","description":"Hautarzt — Akne, Ekzeme, Hautkrebs-Screening, Kosmetische Dermatologie.","languages":["Deutsch","Englisch"],"avatar":"https://images.unsplash.com/photo-1758519290828-2e62b7699b28?w=400&q=80","available":True,"next_slot":"Heute 16:30","featured":True},
    {"doctor_id":"doc_003","name":"Dr. med. Anna Lehmann","specialty":"psychologie","rating":4.9,"reviews":189,"price_consultation":55,"city":"Hamburg","description":"Psychologin — Angststörungen, Depression, Burnout. Videotherapie & Erstberatung.","languages":["Deutsch","Englisch","Spanisch"],"avatar":"https://images.unsplash.com/photo-1765648580528-8d659861d81a?w=400&q=80","available":True,"next_slot":"Morgen 10:00","featured":True},
    {"doctor_id":"doc_004","name":"Dr. med. Peter Schulz","specialty":"orthopaedie","rating":4.7,"reviews":178,"price_consultation":40,"city":"Köln","description":"Orthopäde — Rückenschmerzen, Gelenkprobleme, Sportmedizin, Physiotherapie-Verordnung.","languages":["Deutsch"],"avatar":"https://images.unsplash.com/photo-1758519290828-2e62b7699b28?w=400&q=80","available":True,"next_slot":"Morgen 14:00","featured":False},
    {"doctor_id":"doc_005","name":"Dr. med. Julia Braun","specialty":"kinderheilkunde","rating":4.9,"reviews":298,"price_consultation":35,"city":"Frankfurt","description":"Kinderärztin — Erkältungen, Impfberatung, Entwicklungsfragen. Kinderfreundliche Videosprechstunde.","languages":["Deutsch","Englisch"],"avatar":"https://images.unsplash.com/photo-1765648580890-732fa6d769c5?w=400&q=80","available":True,"next_slot":"Heute 18:00","featured":False},
]

SPECIALTIES = [
    {"id":"allgemeinmedizin","label":"Allgemeinmedizin","color":"#3B82F6"},
    {"id":"dermatologie","label":"Dermatologie","color":"#A855F7"},
    {"id":"psychologie","label":"Psychologie","color":"#10B981"},
    {"id":"orthopaedie","label":"Orthopädie","color":"#F59E0B"},
    {"id":"kinderheilkunde","label":"Kinderheilkunde","color":"#EC4899"},
    {"id":"innere","label":"Innere Medizin","color":"#06B6D4"},
]

@router.on_event("startup")
async def seed():
    if await db.doctors.count_documents({}) == 0:
        now = datetime.now(timezone.utc).isoformat()
        for d in SEED:
            d["created_at"] = now
        await db.doctors.insert_many(SEED)

@router.get("/doctors")
async def list_doctors(specialty: Optional[str]=None, search: Optional[str]=None):
    q = {"available": True}
    if specialty: q["specialty"] = specialty
    if search: q["$or"] = [{"name":{"$regex":search,"$options":"i"}},{"specialty":{"$regex":search,"$options":"i"}}]
    docs = await db.doctors.find(q, {"_id":0}).sort("featured",-1).to_list(50)
    return {"doctors": docs}

@router.get("/specialties")
async def get_specialties():
    return {"specialties": SPECIALTIES}

@router.get("/doctor/{doctor_id}")
async def get_doctor(doctor_id: str):
    d = await db.doctors.find_one({"doctor_id":doctor_id},{"_id":0})
    if not d: raise HTTPException(404, "Arzt nicht gefunden")
    return d

class AppointmentReq(BaseModel):
    doctor_id: str
    date: str
    time: str
    reason: str = ""

@router.post("/appointment")
async def book_appointment(req: AppointmentReq, request: Request):
    user = await get_current_user(request)
    doc = await db.doctors.find_one({"doctor_id":req.doctor_id},{"_id":0})
    if not doc: raise HTTPException(404, "Arzt nicht gefunden")
    appt = {
        "appointment_id": secrets.token_hex(8), "doctor_id": req.doctor_id,
        "doctor_name": doc.get("name",""), "specialty": doc.get("specialty",""),
        "patient_email": user.get("email",""), "patient_name": user.get("name",""),
        "date": req.date, "time": req.time, "reason": req.reason,
        "price": doc.get("price_consultation",35), "status": "confirmed",
        "video_link": f"https://meet.bidblitz.com/{secrets.token_hex(6)}",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.telemedizin_appointments.insert_one(appt)
    appt.pop("_id", None)
    return {"ok": True, "appointment": appt}

@router.get("/my-appointments")
async def my_appointments(request: Request):
    user = await get_current_user(request)
    appts = await db.telemedizin_appointments.find({"patient_email":user.get("email","")},{"_id":0}).sort("created_at",-1).to_list(50)
    return {"appointments": appts}
