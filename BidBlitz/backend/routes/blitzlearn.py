"""
BidBlitz V2 - BlitzLearn (Skill-Trading / Nachhilfe)
Jugendliche bieten Skills an: Mathe, Gaming-Coaching, TikTok — 20% Provision
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime, timezone
from core.database import db
from core.security import get_current_user
import secrets

router = APIRouter(prefix="/api/blitzlearn", tags=["blitzlearn"])

SERVICE_FEE = 0.20
CATEGORIES = [
    {"id": "math", "name": "Mathe", "icon": "📐", "color": "#3B82F6"},
    {"id": "english", "name": "Englisch", "icon": "🇬🇧", "color": "#10B981"},
    {"id": "german", "name": "Deutsch", "icon": "🇩🇪", "color": "#F59E0B"},
    {"id": "science", "name": "Naturwissenschaften", "icon": "🔬", "color": "#8B5CF6"},
    {"id": "coding", "name": "Programmieren", "icon": "💻", "color": "#06B6D4"},
    {"id": "design", "name": "Design/Photoshop", "icon": "🎨", "color": "#EC4899"},
    {"id": "video", "name": "Video/TikTok", "icon": "🎬", "color": "#EF4444"},
    {"id": "gaming", "name": "Gaming-Coaching", "icon": "🎮", "color": "#F97316"},
    {"id": "music", "name": "Musik", "icon": "🎵", "color": "#A855F7"},
    {"id": "fitness", "name": "Fitness/Sport", "icon": "💪", "color": "#22C55E"},
]

class OfferCreate(BaseModel):
    title: str = Field(..., min_length=3, max_length=100)
    description: str = ""
    category: str = "coding"
    price_per_hour: float = Field(..., gt=0, le=100)
    online: bool = True
    level: str = "Alle"

class BookSession(BaseModel):
    offer_id: str
    hours: float = Field(1, ge=0.5, le=5)
    message: str = ""

@router.get("/offers")
async def get_offers(category: Optional[str] = None, search: Optional[str] = None):
    query = {"status": "active"}
    if category: query["category"] = category
    if search: query["$or"] = [{"title": {"$regex": search, "$options": "i"}}, {"description": {"$regex": search, "$options": "i"}}]
    offers = await db.blitzlearn_offers.find(query, {"_id": 0}).sort("created_at", -1).to_list(50)
    return {"offers": offers, "total": len(offers)}

@router.post("/offers")
async def create_offer(req: OfferCreate, request: Request):
    user = await get_current_user(request)
    offer = {
        "offer_id": f"bl_{secrets.token_hex(6)}", "tutor_email": user.get("email", ""), "tutor_name": user.get("name", ""),
        "title": req.title, "description": req.description, "category": req.category,
        "price_per_hour": req.price_per_hour, "online": req.online, "level": req.level,
        "rating": 0, "sessions_count": 0, "status": "active",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.blitzlearn_offers.insert_one(offer)
    offer.pop("_id", None)
    return {"ok": True, "offer": offer}

@router.post("/book")
async def book_session(req: BookSession, request: Request):
    user = await get_current_user(request)
    email = user.get("email", "")
    offer = await db.blitzlearn_offers.find_one({"offer_id": req.offer_id, "status": "active"})
    if not offer: raise HTTPException(404, "Angebot nicht gefunden")
    if offer["tutor_email"] == email: raise HTTPException(400, "Eigenes Angebot")
    total = round(offer["price_per_hour"] * req.hours, 2)
    balance = user.get("balance", 0)
    if balance < total: raise HTTPException(400, f"Nicht genug Guthaben. Benötigt: €{total:.2f}")
    fee = round(total * SERVICE_FEE, 2)
    tutor_payout = round(total - fee, 2)
    await db.users.update_one({"email": email}, {"$inc": {"balance": -total}})
    await db.users.update_one({"email": offer["tutor_email"]}, {"$inc": {"balance": tutor_payout}})
    await db.blitzlearn_offers.update_one({"offer_id": req.offer_id}, {"$inc": {"sessions_count": 1}})
    session = {
        "session_id": secrets.token_hex(6), "offer_id": req.offer_id, "student_email": email,
        "tutor_email": offer["tutor_email"], "title": offer["title"], "hours": req.hours,
        "total": total, "fee": fee, "tutor_payout": tutor_payout,
        "status": "booked", "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.blitzlearn_sessions.insert_one(session)
    return {"ok": True, "total": total, "fee": fee, "message": f"Session gebucht für €{total:.2f}!"}

@router.get("/categories")
async def get_categories():
    return {"categories": CATEGORIES}
