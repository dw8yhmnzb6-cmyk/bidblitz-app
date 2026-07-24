"""BidBlitz V2 - Umfragen & Belohnungen"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from datetime import datetime, timezone
from core.database import db
from core.security import get_current_user
import secrets

router = APIRouter(prefix="/api/surveys", tags=["surveys"])

SURVEYS = [
    {"id": "s1", "title": "Shopping-Gewohnheiten 2026", "sponsor": "MediaMarkt", "questions": 8, "reward_eur": 2.50, "time_min": 5, "category": "Shopping"},
    {"id": "s2", "title": "Lieblings-Streaming-Dienst", "sponsor": "Netflix", "questions": 6, "reward_eur": 1.50, "time_min": 3, "category": "Entertainment"},
    {"id": "s3", "title": "Krypto-Nutzung in Deutschland", "sponsor": "Bitpanda", "questions": 12, "reward_eur": 5.00, "time_min": 8, "category": "Finanzen"},
    {"id": "s4", "title": "Fitness & Ernaehrung", "sponsor": "MyProtein", "questions": 10, "reward_eur": 3.00, "time_min": 6, "category": "Gesundheit"},
    {"id": "s5", "title": "Smartphone-Nutzung", "sponsor": "Samsung", "questions": 7, "reward_eur": 2.00, "time_min": 4, "category": "Tech"},
    {"id": "s6", "title": "Reiseverhalten Post-Covid", "sponsor": "Booking.com", "questions": 9, "reward_eur": 4.00, "time_min": 7, "category": "Reisen"},
]

class CompleteSurvey(BaseModel):
    survey_id: str

@router.get("/available")
async def available_surveys(request: Request):
    user = await get_current_user(request)
    completed = await db.survey_completions.find({"user_email": user.get("email","")}, {"survey_id": 1, "_id": 0}).to_list(100)
    done_ids = {c["survey_id"] for c in completed}
    available = [s for s in SURVEYS if s["id"] not in done_ids]
    return {"surveys": available, "completed_count": len(done_ids), "total_earned": len(done_ids) * 3}

@router.post("/complete")
async def complete_survey(req: CompleteSurvey, request: Request):
    user = await get_current_user(request)
    survey = next((s for s in SURVEYS if s["id"] == req.survey_id), None)
    if not survey: raise HTTPException(404, "Umfrage nicht gefunden")
    existing = await db.survey_completions.find_one({"user_email": user.get("email",""), "survey_id": req.survey_id})
    if existing: raise HTTPException(400, "Bereits abgeschlossen")
    await db.survey_completions.insert_one({"user_email": user.get("email",""), "survey_id": req.survey_id, "reward": survey["reward_eur"], "created_at": datetime.now(timezone.utc).isoformat()})
    await db.users.update_one({"email": user.get("email","")}, {"$inc": {"balance": survey["reward_eur"]}})
    return {"ok": True, "reward": survey["reward_eur"], "message": f"+{survey['reward_eur']} EUR verdient! Danke fuer die Teilnahme."}
