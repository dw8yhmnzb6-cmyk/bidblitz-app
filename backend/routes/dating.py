"""
BidBlitz Dating P0
Profiles, reciprocal matching, chat, filters, safety, premium basics
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from typing import Optional, List, Literal
from datetime import datetime, timezone, date
from bson import ObjectId
import secrets

from core.database import db, sanitize_doc
from core.security import get_current_user

router = APIRouter(prefix="/api/dating", tags=["dating"])

DEFAULT_AVATARS = [
    "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=800&q=80",
    "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=800&q=80",
    "https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=800&q=80",
    "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=800&q=80",
    "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=800&q=80",
    "https://images.unsplash.com/photo-1504593811423-6dd665756598?w=800&q=80",
]

DAILY_FREE_SWIPES = 20


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def years_old(date_str: Optional[str]) -> Optional[int]:
    if not date_str:
        return None
    try:
        born = date.fromisoformat(date_str)
        today = date.today()
        return today.year - born.year - ((today.month, today.day) < (born.month, born.day))
    except Exception:
        return None


def build_profile_id() -> str:
    return f"DAT-{secrets.token_hex(5).upper()}"


def build_match_id() -> str:
    return f"MAT-{secrets.token_hex(6).upper()}"


def build_message_id() -> str:
    return f"DMSG-{secrets.token_hex(6).upper()}"


def swipe_reset_key() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


async def ensure_indexes():
    await db.dating_profiles.create_index("profile_id", unique=True)
    await db.dating_profiles.create_index(
        "user_id",
        unique=True,
        partialFilterExpression={"user_id": {"$type": "string"}},
    )
    await db.dating_profiles.create_index([("active", 1), ("gender", 1), ("city", 1)])
    await db.dating_swipes.create_index([("from_user_id", 1), ("to_profile_id", 1)], unique=True)
    await db.dating_swipes.create_index([("from_user_id", 1), ("created_at", -1)])
    await db.dating_matches.create_index("match_id", unique=True)
    await db.dating_matches.create_index([("participant_ids", 1), ("matched_at", -1)])
    await db.dating_messages.create_index("message_id", unique=True)
    await db.dating_messages.create_index([("match_id", 1), ("created_at", 1)])
    await db.dating_reports.create_index([("reporter_user_id", 1), ("created_at", -1)])
    await db.dating_blocks.create_index([("blocker_user_id", 1), ("blocked_user_id", 1)], unique=True)


@router.on_event("startup")
async def dating_startup():
    await ensure_indexes()


async def get_me(request: Request) -> dict:
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Nicht eingeloggt")
    return user


async def get_or_create_my_profile(user: dict) -> dict:
    profile = await db.dating_profiles.find_one({"user_id": str(user["_id"])})
    if profile:
        return sanitize_doc(profile)

    gender = user.get("gender") or "unspecified"
    avatar = user.get("profile_image") or user.get("avatar") or DEFAULT_AVATARS[0]
    profile_doc = {
        "profile_id": build_profile_id(),
        "user_id": str(user["_id"]),
        "email": user.get("email", ""),
        "name": user.get("name") or user.get("full_name") or user.get("email", "User").split("@")[0],
        "age": years_old(user.get("birth_date")),
        "birth_date": user.get("birth_date"),
        "city": user.get("city") or "",
        "bio": user.get("bio") or "",
        "interests": user.get("interests") or [],
        "photos": [avatar],
        "avatar": avatar,
        "verified": bool(user.get("kyc_verified") or user.get("verified")),
        "gender": gender,
        "seeking": user.get("dating_seeking") or ["women", "men", "nonbinary"],
        "relationship_intent": user.get("relationship_intent") or "serious",
        "premium": bool(user.get("dating_premium") or user.get("premium") or False),
        "active": True,
        "last_active_at": now_iso(),
        "created_at": now_iso(),
        "likes_count": 0,
    }
    await db.dating_profiles.insert_one(profile_doc)
    return sanitize_doc(profile_doc)


async def get_profile_or_404(profile_id: str) -> dict:
    profile = await db.dating_profiles.find_one({"profile_id": profile_id})
    if not profile:
        raise HTTPException(status_code=404, detail="Profil nicht gefunden")
    return profile


async def get_swipes_used_today(user_id: str) -> int:
    return await db.dating_swipes.count_documents({
        "from_user_id": user_id,
        "type": {"$in": ["like", "superlike"]},
        "swipe_reset_key": swipe_reset_key(),
    })


def pair_key(a: str, b: str) -> str:
    return "::".join(sorted([a, b]))


class DatingProfileUpdate(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    age: Optional[int] = Field(default=None, ge=18, le=99)
    city: str = Field(default="", max_length=80)
    bio: str = Field(default="", max_length=400)
    interests: List[str] = Field(default_factory=list, max_length=12)
    gender: Literal["man", "woman", "nonbinary", "unspecified"] = "unspecified"
    seeking: List[Literal["men", "women", "nonbinary"]] = Field(default_factory=list)
    relationship_intent: Literal["serious", "casual", "friends", "open"] = "serious"
    photos: List[str] = Field(default_factory=list, max_length=6)


class SwipeReq(BaseModel):
    profile_id: str
    super_like: bool = False


class ChatMessageReq(BaseModel):
    text: str = Field(min_length=1, max_length=2000)


class FilterUpdateReq(BaseModel):
    age_min: int = Field(default=18, ge=18, le=99)
    age_max: int = Field(default=99, ge=18, le=99)
    city: str = Field(default="", max_length=80)
    seeking: List[Literal["men", "women", "nonbinary"]] = Field(default_factory=list)
    relationship_intent: Optional[Literal["serious", "casual", "friends", "open"]] = None


class ReportReq(BaseModel):
    profile_id: str
    reason: str = Field(min_length=3, max_length=300)


@router.get("/profile/me")
async def my_profile(request: Request):
    user = await get_me(request)
    profile = await get_or_create_my_profile(user)
    filters = user.get("dating_filters") or {
        "age_min": 18,
        "age_max": 99,
        "city": "",
        "seeking": [],
        "relationship_intent": None,
    }
    return {"profile": profile, "filters": filters}


@router.put("/profile/me")
async def update_my_profile(payload: DatingProfileUpdate, request: Request):
    user = await get_me(request)
    existing = await get_or_create_my_profile(user)
    photos = payload.photos[:6] if payload.photos else existing.get("photos") or [existing.get("avatar") or DEFAULT_AVATARS[0]]
    avatar = photos[0]
    update = {
        "name": payload.name,
        "age": payload.age,
        "city": payload.city,
        "bio": payload.bio,
        "interests": payload.interests[:12],
        "gender": payload.gender,
        "seeking": payload.seeking,
        "relationship_intent": payload.relationship_intent,
        "photos": photos,
        "avatar": avatar,
        "last_active_at": now_iso(),
    }
    await db.dating_profiles.update_one({"user_id": str(user["_id"])}, {"$set": update})
    fresh = await db.dating_profiles.find_one({"user_id": str(user["_id"])}, {"_id": 0})
    return {"ok": True, "profile": fresh}


@router.get("/swipes-left")
async def swipes_left(request: Request):
    user = await get_me(request)
    profile = await get_or_create_my_profile(user)
    if profile.get("premium"):
        return {"swipes_left": 999999, "premium": True}
    used = await get_swipes_used_today(str(user["_id"]))
    return {"swipes_left": max(0, DAILY_FREE_SWIPES - used), "premium": False}


@router.get("/discover")
async def discover(request: Request):
    user = await get_me(request)
    my_profile = await get_or_create_my_profile(user)
    my_user_id = my_profile["user_id"]
    my_filters = user.get("dating_filters") or {}

    seen = await db.dating_swipes.find({"from_user_id": my_user_id}, {"_id": 0, "to_profile_id": 1}).to_list(1000)
    seen_ids = [item["to_profile_id"] for item in seen]

    blocked_by_me = await db.dating_blocks.find({"blocker_user_id": my_user_id}, {"_id": 0, "blocked_user_id": 1}).to_list(500)
    blocked_ids = [item["blocked_user_id"] for item in blocked_by_me]
    blockers = await db.dating_blocks.find({"blocked_user_id": my_user_id}, {"_id": 0, "blocker_user_id": 1}).to_list(500)
    blocker_ids = [item["blocker_user_id"] for item in blockers]

    query = {
        "active": True,
        "profile_id": {"$nin": seen_ids},
        "user_id": {"$ne": my_user_id, "$nin": blocked_ids + blocker_ids},
    }

    if my_filters.get("city"):
        query["city"] = my_filters["city"]
    if my_filters.get("seeking"):
        query["gender"] = {"$in": my_filters["seeking"]}
    if my_filters.get("relationship_intent"):
        query["relationship_intent"] = my_filters["relationship_intent"]
    query["age"] = {
        "$gte": int(my_filters.get("age_min", 18)),
        "$lte": int(my_filters.get("age_max", 99)),
    }

    profiles = await db.dating_profiles.find(query, {"_id": 0}).sort("last_active_at", -1).to_list(40)
    return {"profiles": profiles}


@router.post("/filters")
async def update_filters(payload: FilterUpdateReq, request: Request):
    user = await get_me(request)
    if payload.age_min > payload.age_max:
        raise HTTPException(status_code=400, detail="Altersfilter ungültig")
    filters = {
        "age_min": payload.age_min,
        "age_max": payload.age_max,
        "city": payload.city,
        "seeking": payload.seeking,
        "relationship_intent": payload.relationship_intent,
    }
    await db.users.update_one({"_id": user["_id"]}, {"$set": {"dating_filters": filters}})
    return {"ok": True, "filters": filters}


@router.post("/like")
async def like_profile(req: SwipeReq, request: Request):
    user = await get_me(request)
    my_profile = await get_or_create_my_profile(user)
    if req.profile_id == my_profile["profile_id"]:
        raise HTTPException(status_code=400, detail="Eigenes Profil kann nicht geliked werden")

    target = await get_profile_or_404(req.profile_id)
    my_user_id = my_profile["user_id"]
    if not my_profile.get("premium"):
        used = await get_swipes_used_today(my_user_id)
        if used >= DAILY_FREE_SWIPES:
            raise HTTPException(status_code=402, detail="Swipe-Limit erreicht")

    existing = await db.dating_swipes.find_one({"from_user_id": my_user_id, "to_profile_id": req.profile_id})
    if existing:
        return {"ok": True, "match": False, "already_swiped": True}

    swipe_doc = {
        "from_user_id": my_user_id,
        "to_user_id": target["user_id"],
        "from_profile_id": my_profile["profile_id"],
        "to_profile_id": req.profile_id,
        "type": "superlike" if req.super_like else "like",
        "created_at": now_iso(),
        "swipe_reset_key": swipe_reset_key(),
    }
    await db.dating_swipes.insert_one(swipe_doc)
    await db.dating_profiles.update_one({"profile_id": req.profile_id}, {"$inc": {"likes_count": 1}})

    reciprocal = await db.dating_swipes.find_one({
        "from_user_id": target["user_id"],
        "to_user_id": my_user_id,
        "type": {"$in": ["like", "superlike"]},
    })

    if reciprocal:
        key = pair_key(my_user_id, target["user_id"])
        existing_match = await db.dating_matches.find_one({"pair_key": key}, {"_id": 0})
        if not existing_match:
            match_doc = {
                "match_id": build_match_id(),
                "pair_key": key,
                "participant_ids": [my_user_id, target["user_id"]],
                "participant_profiles": [my_profile["profile_id"], target["profile_id"]],
                "matched_at": now_iso(),
                "last_message_at": None,
                "last_message": "",
                "unread": {my_user_id: 0, target["user_id"]: 0},
                "blocked": False,
            }
            await db.dating_matches.insert_one(match_doc)
            existing_match = sanitize_doc(match_doc)
        return {"ok": True, "match": True, "match_data": existing_match}

    return {"ok": True, "match": False}


@router.post("/pass")
async def pass_profile(req: SwipeReq, request: Request):
    user = await get_me(request)
    my_profile = await get_or_create_my_profile(user)
    existing = await db.dating_swipes.find_one({"from_user_id": my_profile["user_id"], "to_profile_id": req.profile_id})
    if existing:
        return {"ok": True, "already_swiped": True}
    await db.dating_swipes.insert_one({
        "from_user_id": my_profile["user_id"],
        "from_profile_id": my_profile["profile_id"],
        "to_profile_id": req.profile_id,
        "type": "pass",
        "created_at": now_iso(),
        "swipe_reset_key": swipe_reset_key(),
    })
    return {"ok": True}


@router.get("/matches")
async def get_matches(request: Request):
    user = await get_me(request)
    my_user_id = str(user["_id"])
    matches = await db.dating_matches.find({"participant_ids": my_user_id, "blocked": {"$ne": True}}, {"_id": 0}).sort("matched_at", -1).to_list(100)
    result = []
    for match in matches:
        other_profile_id = next((pid for pid in match.get("participant_profiles", []) if pid != (await get_or_create_my_profile(user))["profile_id"]), None)
        if not other_profile_id:
            continue
        profile = await db.dating_profiles.find_one({"profile_id": other_profile_id}, {"_id": 0})
        if not profile:
            continue
        profile["match_id"] = match["match_id"]
        profile["last_message"] = match.get("last_message", "")
        profile["last_message_at"] = match.get("last_message_at")
        profile["unread_count"] = (match.get("unread") or {}).get(my_user_id, 0)
        result.append(profile)
    return {"matches": result}


@router.get("/matches/{match_id}/messages")
async def get_match_messages(match_id: str, request: Request):
    user = await get_me(request)
    my_user_id = str(user["_id"])
    match = await db.dating_matches.find_one({"match_id": match_id, "participant_ids": my_user_id}, {"_id": 0})
    if not match:
        raise HTTPException(status_code=404, detail="Match nicht gefunden")
    messages = await db.dating_messages.find({"match_id": match_id}, {"_id": 0}).sort("created_at", 1).to_list(500)
    await db.dating_matches.update_one({"match_id": match_id}, {"$set": {f"unread.{my_user_id}": 0}})
    return {"messages": messages, "match": match}


@router.post("/matches/{match_id}/messages")
async def send_message(match_id: str, payload: ChatMessageReq, request: Request):
    user = await get_me(request)
    my_user_id = str(user["_id"])
    my_profile = await get_or_create_my_profile(user)
    match = await db.dating_matches.find_one({"match_id": match_id, "participant_ids": my_user_id, "blocked": {"$ne": True}})
    if not match:
        raise HTTPException(status_code=404, detail="Match nicht gefunden")
    other_user_id = next(uid for uid in match["participant_ids"] if uid != my_user_id)
    message = {
        "message_id": build_message_id(),
        "match_id": match_id,
        "sender_user_id": my_user_id,
        "sender_profile_id": my_profile["profile_id"],
        "text": payload.text.strip(),
        "created_at": now_iso(),
    }
    await db.dating_messages.insert_one(message)
    await db.dating_matches.update_one(
        {"match_id": match_id},
        {
            "$set": {"last_message": message["text"], "last_message_at": message["created_at"]},
            "$inc": {f"unread.{other_user_id}": 1},
        },
    )
    return {"ok": True, "message": sanitize_doc(message)}


@router.post("/unmatch/{match_id}")
async def unmatch(match_id: str, request: Request):
    user = await get_me(request)
    my_user_id = str(user["_id"])
    match = await db.dating_matches.find_one({"match_id": match_id, "participant_ids": my_user_id})
    if not match:
        raise HTTPException(status_code=404, detail="Match nicht gefunden")
    await db.dating_matches.delete_one({"match_id": match_id})
    await db.dating_messages.delete_many({"match_id": match_id})
    return {"ok": True}


@router.post("/block")
async def block_profile(payload: ReportReq, request: Request):
    user = await get_me(request)
    me = await get_or_create_my_profile(user)
    target = await get_profile_or_404(payload.profile_id)
    if target["user_id"] == me["user_id"]:
        raise HTTPException(status_code=400, detail="Eigenes Profil kann nicht blockiert werden")
    await db.dating_blocks.update_one(
        {"blocker_user_id": me["user_id"], "blocked_user_id": target["user_id"]},
        {"$set": {"created_at": now_iso(), "reason": payload.reason}},
        upsert=True,
    )
    await db.dating_matches.update_many(
        {"participant_ids": {"$all": [me["user_id"], target["user_id"]]}},
        {"$set": {"blocked": True, "blocked_by": me["user_id"]}},
    )
    return {"ok": True}


@router.post("/report")
async def report_profile(payload: ReportReq, request: Request):
    user = await get_me(request)
    me = await get_or_create_my_profile(user)
    target = await get_profile_or_404(payload.profile_id)
    report_doc = {
        "reporter_user_id": me["user_id"],
        "reported_user_id": target["user_id"],
        "reported_profile_id": payload.profile_id,
        "reason": payload.reason,
        "created_at": now_iso(),
        "status": "open",
    }
    await db.dating_reports.insert_one(report_doc)
    return {"ok": True}


@router.get("/likes-you")
async def likes_you(request: Request):
    user = await get_me(request)
    me = await get_or_create_my_profile(user)
    if not me.get("premium"):
        return {"locked": True, "profiles": []}
    inbound = await db.dating_swipes.find({"to_user_id": me["user_id"], "type": {"$in": ["like", "superlike"]}}, {"_id": 0, "from_profile_id": 1}).sort("created_at", -1).to_list(100)
    profile_ids = [item["from_profile_id"] for item in inbound]
    profiles = await db.dating_profiles.find({"profile_id": {"$in": profile_ids}}, {"_id": 0}).to_list(100)
    return {"locked": False, "profiles": profiles}