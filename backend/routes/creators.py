"""
BidBlitz V2 - Creator Monetarisierung (Bezahl-Content, Abos, Tips)
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from datetime import datetime, timezone
from core.database import db
from core.security import get_current_user
import secrets

router = APIRouter(prefix="/api/creators", tags=["creators"])

FEATURED_CREATORS = [
    {"id": "c1", "name": "TechTim", "category": "Tech", "subscribers": 12400, "monthly_price": 4.99, "posts": 89, "rating": 4.9, "bio": "Taegliche Tech-Reviews & Deals"},
    {"id": "c2", "name": "FitnessMia", "category": "Fitness", "subscribers": 8900, "monthly_price": 9.99, "posts": 156, "rating": 4.8, "bio": "Workout-Plaene & Ernaehrungstipps"},
    {"id": "c3", "name": "CryptoKarl", "category": "Crypto", "subscribers": 21300, "monthly_price": 14.99, "posts": 234, "rating": 4.7, "bio": "Trading-Signale & Marktanalysen"},
    {"id": "c4", "name": "KochAnna", "category": "Kochen", "subscribers": 5600, "monthly_price": 3.99, "posts": 67, "rating": 4.9, "bio": "Schnelle Rezepte unter 15 Minuten"},
    {"id": "c5", "name": "DesignLukas", "category": "Design", "subscribers": 3200, "monthly_price": 7.99, "posts": 45, "rating": 4.6, "bio": "UI/UX Tutorials & Ressourcen"},
    {"id": "c6", "name": "MusikSophie", "category": "Musik", "subscribers": 15800, "monthly_price": 2.99, "posts": 312, "rating": 4.8, "bio": "Exklusive Tracks & Behind-the-Scenes"},
]

class SubscribeCreator(BaseModel):
    creator_id: str

class TipCreator(BaseModel):
    creator_id: str
    amount_eur: float = Field(..., gt=0, le=500)
    message: str = ""

@router.get("/featured")
async def get_featured():
    return {"creators": FEATURED_CREATORS}

@router.post("/subscribe")
async def subscribe_creator(req: SubscribeCreator, request: Request):
    user = await get_current_user(request)
    creator = next((c for c in FEATURED_CREATORS if c["id"] == req.creator_id), None)
    if not creator:
        raise HTTPException(404, "Creator nicht gefunden")
    sub = {
        "sub_id": f"csub_{secrets.token_hex(6)}",
        "user_email": user.get("email", ""),
        "creator_id": req.creator_id,
        "creator_name": creator["name"],
        "monthly_price": creator["monthly_price"],
        "status": "active",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.creator_subscriptions.insert_one(sub)
    return {"ok": True, "message": f"{creator['name']} abonniert fuer {creator['monthly_price']} EUR/Mo!"}

@router.post("/tip")
async def tip_creator(req: TipCreator, request: Request):
    user = await get_current_user(request)
    creator = next((c for c in FEATURED_CREATORS if c["id"] == req.creator_id), None)
    if not creator:
        raise HTTPException(404, "Creator nicht gefunden")
    tip = {
        "tip_id": f"tip_{secrets.token_hex(6)}",
        "from_email": user.get("email", ""),
        "creator_id": req.creator_id,
        "creator_name": creator["name"],
        "amount_eur": req.amount_eur,
        "message": req.message,
        "platform_fee": round(req.amount_eur * 0.20, 2),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.creator_tips.insert_one(tip)
    return {"ok": True, "message": f"{req.amount_eur} EUR Trinkgeld an {creator['name']} gesendet!"}

@router.get("/my-subs")
async def my_subscriptions(request: Request):
    user = await get_current_user(request)
    subs = await db.creator_subscriptions.find({"user_email": user.get("email", ""), "status": "active"}, {"_id": 0}).to_list(20)
    return {"subscriptions": subs}
