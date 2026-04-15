"""
BidBlitz V2 - Skills Marketplace (1-zu-1 Video-Sessions)
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from datetime import datetime, timezone
from core.database import db
from core.security import get_current_user
import secrets

router = APIRouter(prefix="/api/skills", tags=["skills"])

SKILL_CATEGORIES = [
    {"id": "coding", "name": "Programmieren", "icon": "code", "color": "#3B82F6"},
    {"id": "design", "name": "Design & UI/UX", "icon": "palette", "color": "#EC4899"},
    {"id": "music", "name": "Musikunterricht", "icon": "music", "color": "#8B5CF6"},
    {"id": "language", "name": "Sprachkurse", "icon": "globe", "color": "#10B981"},
    {"id": "business", "name": "Business & Marketing", "icon": "briefcase", "color": "#F59E0B"},
    {"id": "fitness", "name": "Personal Training", "icon": "dumbbell", "color": "#EF4444"},
]

SEED_SESSIONS = [
    {"id": "sk1", "tutor": "MaxCode", "category": "coding", "title": "Python fuer Anfaenger", "price_30min": 25, "price_60min": 40, "rating": 4.9, "sessions_done": 234, "desc": "Lerne Python von Null auf Profi"},
    {"id": "sk2", "tutor": "DesignSara", "category": "design", "title": "Figma Masterclass", "price_30min": 30, "price_60min": 50, "rating": 4.8, "sessions_done": 156, "desc": "UI/UX Design mit Figma lernen"},
    {"id": "sk3", "tutor": "GuitarJan", "category": "music", "title": "Gitarre fuer Einsteiger", "price_30min": 20, "price_60min": 35, "rating": 5.0, "sessions_done": 89, "desc": "Akustik & E-Gitarre lernen"},
    {"id": "sk4", "tutor": "EnglishPro", "category": "language", "title": "Business English", "price_30min": 22, "price_60min": 38, "rating": 4.7, "sessions_done": 412, "desc": "Fluessig Englisch fuer den Beruf"},
    {"id": "sk5", "tutor": "StartupLena", "category": "business", "title": "Social Media Marketing", "price_30min": 35, "price_60min": 60, "rating": 4.8, "sessions_done": 67, "desc": "Instagram, TikTok & LinkedIn Wachstum"},
    {"id": "sk6", "tutor": "CoachMike", "category": "fitness", "title": "Home Workout Plan", "price_30min": 18, "price_60min": 30, "rating": 4.9, "sessions_done": 523, "desc": "Individueller Trainingsplan"},
]

class BookSession(BaseModel):
    session_id: str
    duration: int = Field(default=30, ge=30, le=60)

@router.get("/categories")
async def get_categories():
    return {"categories": SKILL_CATEGORIES}

@router.get("/sessions")
async def get_sessions(category: str = ""):
    if category:
        filtered = [s for s in SEED_SESSIONS if s["category"] == category]
    else:
        filtered = SEED_SESSIONS
    return {"sessions": filtered}

@router.post("/book")
async def book_session(req: BookSession, request: Request):
    user = await get_current_user(request)
    session = next((s for s in SEED_SESSIONS if s["id"] == req.session_id), None)
    if not session:
        raise HTTPException(404, "Session nicht gefunden")
    price = session["price_30min"] if req.duration == 30 else session["price_60min"]
    fee = round(price * 0.15, 2)
    booking = {
        "booking_id": f"skill_{secrets.token_hex(6)}",
        "user_email": user.get("email", ""),
        "session_id": req.session_id,
        "tutor": session["tutor"],
        "title": session["title"],
        "duration": req.duration,
        "price": price,
        "platform_fee": fee,
        "status": "confirmed",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.skill_bookings.insert_one(booking)
    return {"ok": True, "booking_id": booking["booking_id"], "price": price, "message": f"{req.duration}min Session mit {session['tutor']} gebucht fuer {price} EUR!"}

@router.get("/my-bookings")
async def my_bookings(request: Request):
    user = await get_current_user(request)
    bookings = await db.skill_bookings.find({"user_email": user.get("email", "")}, {"_id": 0}).sort("created_at", -1).to_list(20)
    return {"bookings": bookings}
