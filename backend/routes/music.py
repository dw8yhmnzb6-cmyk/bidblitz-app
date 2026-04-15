"""BidBlitz V2 - Musik-Streaming & Podcast Premium"""
from fastapi import APIRouter, Request
from pydantic import BaseModel
from datetime import datetime, timezone
from core.database import db
from core.security import get_current_user
import secrets

router = APIRouter(prefix="/api/music", tags=["music"])

PLAYLISTS = [
    {"id": "chill", "name": "Chill Vibes", "tracks": 42, "duration": "2h 15m", "genre": "Lo-Fi", "color": "#06B6D4"},
    {"id": "workout", "name": "Beast Mode", "tracks": 35, "duration": "1h 50m", "genre": "EDM/Rap", "color": "#EF4444"},
    {"id": "focus", "name": "Deep Focus", "tracks": 28, "duration": "3h 20m", "genre": "Ambient", "color": "#8B5CF6"},
    {"id": "party", "name": "Party Hits 2026", "tracks": 50, "duration": "2h 45m", "genre": "Pop/Dance", "color": "#EC4899"},
    {"id": "crypto", "name": "Crypto Trading Beats", "tracks": 20, "duration": "1h 30m", "genre": "Electronic", "color": "#F7931A"},
]

PODCASTS = [
    {"id": "pod1", "name": "Crypto Daily DE", "host": "Max Krypto", "episodes": 234, "category": "Finanzen", "premium": False},
    {"id": "pod2", "name": "StartUp Stories", "host": "Lena Business", "episodes": 89, "category": "Business", "premium": True},
    {"id": "pod3", "name": "Tech Talk Deutschland", "host": "Tim Tech", "episodes": 156, "category": "Technologie", "premium": False},
    {"id": "pod4", "name": "Mindset Mastery", "host": "Coach Sarah", "episodes": 67, "category": "Motivation", "premium": True},
    {"id": "pod5", "name": "Gaming Weekly", "host": "ProGamer Crew", "episodes": 312, "category": "Gaming", "premium": False},
]

class MusicSubscribe(BaseModel):
    plan: str = "premium"

@router.get("/playlists")
async def get_playlists():
    return {"playlists": PLAYLISTS}

@router.get("/podcasts")
async def get_podcasts():
    return {"podcasts": PODCASTS}

@router.post("/subscribe")
async def subscribe_music(req: MusicSubscribe, request: Request):
    user = await get_current_user(request)
    sub = {"sub_id": f"mus_{secrets.token_hex(6)}", "user_email": user.get("email",""), "plan": req.plan, "price": 4.99,
           "status": "active", "created_at": datetime.now(timezone.utc).isoformat()}
    await db.music_subscriptions.insert_one(sub)
    return {"ok": True, "message": "BlitzMusic Premium aktiviert fuer 4.99 EUR/Mo!"}
