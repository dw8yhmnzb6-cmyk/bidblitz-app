"""
BidBlitz V2 - Dating / Kontakte
Profile, Matching, Likes, Nachrichten
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
from core.database import db
from core.security import get_current_user
import secrets, random

router = APIRouter(prefix="/api/dating", tags=["dating"])

SEED_PROFILES = [
    {"profile_id":"dat_001","name":"Laura, 28","age":28,"city":"Berlin","bio":"Kaffee-Süchtige, Yoga-Liebhaberin, Startup-Gründerin. Suche jemanden für tiefe Gespräche und spontane Abenteuer.","interests":["Yoga","Startups","Reisen","Kaffee","Kunst"],"avatar":"https://images.unsplash.com/photo-1765648580890-732fa6d769c5?w=400&q=80","verified":True},
    {"profile_id":"dat_002","name":"Maximilian, 31","age":31,"city":"München","bio":"Ingenieur mit Leidenschaft für Berge, Craft Beer und Filmabende. Hund = Bonuspunkte.","interests":["Wandern","Craft Beer","Filme","Kochen","Hunde"],"avatar":"https://images.unsplash.com/photo-1758519290828-2e62b7699b28?w=400&q=80","verified":True},
    {"profile_id":"dat_003","name":"Sophie, 26","age":26,"city":"Hamburg","bio":"UX Designerin, Vinyl-Sammlerin, Pasta-Expertin. Zeig mir deinen Musikgeschmack!","interests":["Design","Musik","Vinyl","Kochen","Fotografie"],"avatar":"https://images.unsplash.com/photo-1765648580528-8d659861d81a?w=400&q=80","verified":False},
    {"profile_id":"dat_004","name":"Niklas, 29","age":29,"city":"Köln","bio":"Arzt, Hobby-Surfer, Reisenerd. War schon in 34 Ländern. Nächstes Ziel: Japan.","interests":["Reisen","Surfen","Medizin","Fotografie","Japan"],"avatar":"https://images.unsplash.com/photo-1758519290828-2e62b7699b28?w=400&q=80","verified":True},
    {"profile_id":"dat_005","name":"Mia, 24","age":24,"city":"Frankfurt","bio":"Studentin, Bücherwurm, Salsa-Tänzerin. Introvertiert, aber mit den richtigen Leuten extrovertiert.","interests":["Bücher","Salsa","Studium","Kino","Tiere"],"avatar":"https://images.unsplash.com/photo-1765648580890-732fa6d769c5?w=400&q=80","verified":False},
    {"profile_id":"dat_006","name":"Felix, 33","age":33,"city":"Berlin","bio":"Fotograf, Gründer, Kochbegeistert. Bester Risotto der Stadt — Challenge accepted?","interests":["Fotografie","Kochen","Startups","Kunst","Wein"],"avatar":"https://images.unsplash.com/photo-1758519290828-2e62b7699b28?w=400&q=80","verified":True},
]

@router.on_event("startup")
async def seed():
    if await db.dating_profiles.count_documents({}) == 0:
        now = datetime.now(timezone.utc).isoformat()
        for p in SEED_PROFILES:
            p["created_at"] = now
            p["likes_count"] = random.randint(12, 89)
        await db.dating_profiles.insert_many(SEED_PROFILES)

@router.get("/discover")
async def discover(request: Request):
    try:
        user = await get_current_user(request)
        email = user.get("email","")
        liked = await db.dating_likes.find({"from_email":email},{"_id":0,"to_profile":1}).to_list(200)
        liked_ids = [l["to_profile"] for l in liked]
        profiles = await db.dating_profiles.find({"profile_id":{"$nin":liked_ids}},{"_id":0}).to_list(20)
    except Exception:
        profiles = await db.dating_profiles.find({},{"_id":0}).to_list(20)
    random.shuffle(profiles)
    return {"profiles": profiles}

@router.get("/profile/{profile_id}")
async def get_profile(profile_id: str):
    p = await db.dating_profiles.find_one({"profile_id":profile_id},{"_id":0})
    if not p: raise HTTPException(404, "Profil nicht gefunden")
    return p

class LikeReq(BaseModel):
    profile_id: str
    super_like: bool = False

@router.post("/like")
async def like_profile(req: LikeReq, request: Request):
    user = await get_current_user(request)
    email = user.get("email","")
    like = {
        "from_email": email, "to_profile": req.profile_id,
        "super_like": req.super_like,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.dating_likes.insert_one(like)
    await db.dating_profiles.update_one({"profile_id":req.profile_id},{"$inc":{"likes_count":1}})
    is_match = random.random() < 0.3
    if is_match:
        await db.dating_matches.insert_one({"user_email":email,"profile_id":req.profile_id,"matched_at":datetime.now(timezone.utc).isoformat()})
    return {"ok":True,"match":is_match}

@router.post("/pass")
async def pass_profile(req: LikeReq, request: Request):
    user = await get_current_user(request)
    await db.dating_likes.insert_one({"from_email":user.get("email",""),"to_profile":req.profile_id,"passed":True,"created_at":datetime.now(timezone.utc).isoformat()})
    return {"ok":True}

@router.get("/matches")
async def get_matches(request: Request):
    user = await get_current_user(request)
    matches = await db.dating_matches.find({"user_email":user.get("email","")},{"_id":0}).sort("matched_at",-1).to_list(50)
    profile_ids = [m["profile_id"] for m in matches]
    profiles = await db.dating_profiles.find({"profile_id":{"$in":profile_ids}},{"_id":0}).to_list(50)
    return {"matches": profiles}
