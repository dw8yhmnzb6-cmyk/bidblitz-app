"""
BidBlitz V2 - Streaming / Video-on-Demand
Filme, Serien, Dokumentationen streamen
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
from core.database import db
from core.security import get_current_user
import secrets

router = APIRouter(prefix="/api/streaming", tags=["streaming"])

SEED = [
    {"content_id":"str_001","title":"Der letzte Code","type":"film","genre":"thriller","year":2025,"duration_min":118,"rating":8.4,"description":"Ein Hacker entdeckt eine Verschwörung in der größten Bank Europas. Packender Cyber-Thriller.","image":"https://images.unsplash.com/photo-1758611971270-89ce7ed506e1?w=800&q=80","premium":False,"views":45200},
    {"content_id":"str_002","title":"Berliner Nächte","type":"serie","genre":"drama","year":2026,"duration_min":45,"rating":8.9,"seasons":2,"episodes":16,"description":"Das Leben von fünf Freunden in Berlin zwischen Startup-Wahnsinn, Liebe und Selbstfindung.","image":"https://images.unsplash.com/photo-1762452059456-e4c16c256dd1?w=800&q=80","premium":True,"views":89400},
    {"content_id":"str_003","title":"Alpenglühen","type":"doku","genre":"natur","year":2025,"duration_min":92,"rating":9.1,"description":"Atemberaubende Doku über die Alpen — Tierwelt, Klimawandel, Menschen. 4K HDR.","image":"https://images.unsplash.com/photo-1757439402101-55d1da381e70?w=800&q=80","premium":False,"views":32100},
    {"content_id":"str_004","title":"Quantensprung","type":"film","genre":"sci-fi","year":2026,"duration_min":135,"rating":8.7,"description":"Ein Physiker baut eine Zeitmaschine — doch jede Reise verändert die Gegenwart. Mind-Bending Sci-Fi.","image":"https://images.unsplash.com/photo-1758612214917-81d7956c09de?w=800&q=80","premium":True,"views":67800},
    {"content_id":"str_005","title":"Kochen wie ein Profi","type":"serie","genre":"lifestyle","year":2025,"duration_min":30,"rating":8.2,"seasons":3,"episodes":36,"description":"Sterneköche zeigen einfache Rezepte für zuhause. Jede Folge ein neues Gericht.","image":"https://images.unsplash.com/photo-1758612214848-04e700d192ce?w=800&q=80","premium":False,"views":28900},
    {"content_id":"str_006","title":"Startup Nation","type":"doku","genre":"business","year":2026,"duration_min":105,"rating":8.5,"description":"Die spannendsten Startup-Geschichten aus dem deutschsprachigen Raum. Erfolge, Pleiten, Learnings.","image":"https://images.unsplash.com/photo-1765648580890-732fa6d769c5?w=800&q=80","premium":True,"views":19500},
]

PLANS = [
    {"plan_id":"basic","name":"Basic","price":4.99,"features":["Alle kostenlosen Inhalte","SD-Qualität","1 Gerät","Werbung"]},
    {"plan_id":"premium","name":"Premium","price":9.99,"features":["Alle Inhalte","Full HD","2 Geräte","Werbefrei","Downloads"]},
    {"plan_id":"family","name":"Family","price":14.99,"features":["Alle Inhalte","4K HDR","4 Geräte","Werbefrei","Downloads","Kinderprofile"]},
]

@router.on_event("startup")
async def seed():
    if await db.streaming_content.count_documents({}) == 0:
        now = datetime.now(timezone.utc).isoformat()
        for s in SEED:
            s["created_at"] = now
        await db.streaming_content.insert_many(SEED)

@router.get("/catalog")
async def catalog(type: Optional[str]=None, genre: Optional[str]=None, search: Optional[str]=None):
    q = {}
    if type: q["type"] = type
    if genre: q["genre"] = genre
    if search: q["$or"] = [{"title":{"$regex":search,"$options":"i"}},{"genre":{"$regex":search,"$options":"i"}}]
    items = await db.streaming_content.find(q, {"_id":0}).sort("views",-1).to_list(100)
    return {"catalog": items, "total": len(items)}

@router.get("/content/{content_id}")
async def get_content(content_id: str):
    c = await db.streaming_content.find_one({"content_id": content_id}, {"_id":0})
    if not c: raise HTTPException(404, "Nicht gefunden")
    await db.streaming_content.update_one({"content_id": content_id}, {"$inc":{"views":1}})
    return c

@router.get("/plans")
async def get_plans():
    return {"plans": PLANS}

@router.get("/genres")
async def get_genres():
    return {"genres": [
        {"id":"thriller","label":"Thriller"},{"id":"drama","label":"Drama"},
        {"id":"sci-fi","label":"Sci-Fi"},{"id":"natur","label":"Natur"},
        {"id":"lifestyle","label":"Lifestyle"},{"id":"business","label":"Business"},
        {"id":"komoedie","label":"Komödie"},{"id":"horror","label":"Horror"},
    ]}

class WatchlistReq(BaseModel):
    content_id: str

@router.post("/watchlist/toggle")
async def toggle_watchlist(req: WatchlistReq, request: Request):
    user = await get_current_user(request)
    email = user.get("email","")
    existing = await db.streaming_watchlist.find_one({"user_email":email,"content_id":req.content_id})
    if existing:
        await db.streaming_watchlist.delete_one({"user_email":email,"content_id":req.content_id})
        return {"ok":True,"in_watchlist":False}
    await db.streaming_watchlist.insert_one({"user_email":email,"content_id":req.content_id,"added_at":datetime.now(timezone.utc).isoformat()})
    return {"ok":True,"in_watchlist":True}

@router.get("/watchlist")
async def get_watchlist(request: Request):
    user = await get_current_user(request)
    wl = await db.streaming_watchlist.find({"user_email":user.get("email","")},{"_id":0}).to_list(100)
    ids = [w["content_id"] for w in wl]
    items = await db.streaming_content.find({"content_id":{"$in":ids}},{"_id":0}).to_list(100)
    return {"watchlist": items}
