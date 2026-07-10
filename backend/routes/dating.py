"""
BidBlitz Dating P0
Profiles, reciprocal matching, chat, filters, safety, premium basics
"""
from fastapi import APIRouter, HTTPException, Request, UploadFile, File, Form
from fastapi.responses import StreamingResponse, Response
from pydantic import BaseModel, Field
from typing import Optional, List, Literal
from datetime import datetime, timezone, date, timedelta
from bson import ObjectId
from pymongo.errors import DuplicateKeyError
import secrets
import os
import json
import math
import uuid
import asyncio
import logging
import base64
import hashlib
import mimetypes
import re

from dotenv import load_dotenv
from emergentintegrations.llm.chat import LlmChat, StreamDone, TextDelta, UserMessage, ImageContent
from emergentintegrations.payments.stripe.checkout import StripeCheckout, CheckoutSessionRequest
import requests

from core.database import db, sanitize_doc
from core.security import get_current_user
from core.config import STRIPE_API_KEY

load_dotenv()

logger = logging.getLogger("bidblitz.dating")

router = APIRouter(prefix="/api/dating", tags=["dating"])

STORAGE_URL = "https://integrations.emergentagent.com/objstore/api/v1/storage"
APP_STORAGE_PREFIX = "bidblitz/dating"
VOICE_INTRO_MAX_BYTES = 5 * 1024 * 1024
VOICE_INTRO_MAX_SECONDS = 30
VIDEO_PROFILE_MAX_BYTES = 20 * 1024 * 1024
VIDEO_PROFILE_MAX_SECONDS = 45
ALLOWED_AUDIO_TYPES = {
    "audio/webm": "webm",
    "audio/ogg": "ogg",
    "audio/mpeg": "mp3",
    "audio/mp4": "m4a",
    "audio/x-m4a": "m4a",
    "audio/wav": "wav",
    "audio/x-wav": "wav",
}
ALLOWED_VIDEO_TYPES = {
    "video/webm": "webm",
    "video/mp4": "mp4",
    "video/quicktime": "mov",
}
storage_key = None

DEFAULT_AVATARS = [
    "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=800&q=80",
    "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=800&q=80",
    "https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=800&q=80",
    "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=800&q=80",
    "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=800&q=80",
    "https://images.unsplash.com/photo-1504593811423-6dd665756598?w=800&q=80",
]


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _seed_location(lat: float, lng: float) -> dict:
    return {
        "last_location_lat": lat,
        "last_location_lng": lng,
        "last_location_accuracy_m": 120,
        "last_location_at": now_iso(),
    }

SEED_PROFILES = [
    {
        "profile_id": "DAT-SEED-LINA",
        "user_id": "seed-lina",
        "email": "lina.seed@dating.local",
        "name": "Lina",
        "age": 27,
        "birth_date": None,
        "city": "Berlin",
        "bio": "Ich liebe Reisen, guten Kaffee und ehrliche Gespräche.",
        "interests": ["Reisen", "Kaffee", "Musik"],
        "photos": ["https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=800&q=80"],
        "avatar": "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=800&q=80",
        "verified": True,
        "gender": "woman",
        "seeking": ["men"],
        "relationship_intent": "serious",
        "premium": False,
        "active": True,
        "last_active_at": now_iso(),
        "created_at": now_iso(),
        "likes_count": 0,
        "is_seed": True,
        **_seed_location(52.5200, 13.4050),
    },
    {
        "profile_id": "DAT-SEED-MAYA",
        "user_id": "seed-maya",
        "email": "maya.seed@dating.local",
        "name": "Maya",
        "age": 30,
        "birth_date": None,
        "city": "Hamburg",
        "bio": "Foodie, kreative Seele und Fan von spontanen Wochenendtrips.",
        "interests": ["Kochen", "Kunst", "Reisen"],
        "photos": ["https://images.unsplash.com/photo-1517841905240-472988babdf9?w=800&q=80"],
        "avatar": "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=800&q=80",
        "verified": False,
        "gender": "woman",
        "seeking": ["men", "women"],
        "relationship_intent": "serious",
        "premium": True,
        "active": True,
        "last_active_at": now_iso(),
        "created_at": now_iso(),
        "likes_count": 0,
        "is_seed": True,
        **_seed_location(53.5511, 9.9937),
    },
    {
        "profile_id": "DAT-SEED-NORA",
        "user_id": "seed-nora",
        "email": "nora.seed@dating.local",
        "name": "Nora",
        "age": 25,
        "birth_date": None,
        "city": "München",
        "bio": "Fitness, Bücher und tiefe Gespräche statt Smalltalk.",
        "interests": ["Fitness", "Bücher", "Tech"],
        "photos": ["https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=800&q=80"],
        "avatar": "https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=800&q=80",
        "verified": True,
        "gender": "woman",
        "seeking": ["men"],
        "relationship_intent": "casual",
        "premium": False,
        "active": True,
        "last_active_at": now_iso(),
        "created_at": now_iso(),
        "likes_count": 0,
        "is_seed": True,
        **_seed_location(48.1351, 11.5820),
    },
]

DAILY_FREE_SWIPES = 20
BOOST_DURATION_MINUTES = 30
BOOST_COOLDOWN_HOURS = 12
AI_PROVIDER = "openai"
AI_MODEL = "gpt-5.2"
SAFETY_AI_PROVIDER = "openai"
SAFETY_AI_MODEL = "gpt-5.4"
LOCATION_FRESH_HOURS = 48
NEARBY_DEFAULT_RADIUS_KM = 15.0
CROSSED_PATHS_RADIUS_KM = 0.4
SAFETY_ANALYSIS_VERSION = "dating-safety-v1"
SAFETY_SCAN_TTL_HOURS = 72
IMAGE_FETCH_TIMEOUT_SECONDS = 15
IMAGE_FETCH_MAX_BYTES = 4 * 1024 * 1024

DATING_PREMIUM_PLANS = {
    "plus_30d": {
        "plan_id": "plus_30d",
        "tier": "plus",
        "label": "Dating Plus · 30 Tage",
        "price_eur": 9.99,
        "currency": "eur",
        "duration_days": 30,
        "starter_price_eur": 4.99,
        "starter_eligible_days": 7,
        "features": [
            "Unbegrenzte Likes",
            "5 Rewinds pro Tag",
            "Basis-Filter",
            "Starter-Preis für neue User",
        ],
    },
    "gold_30d": {
        "plan_id": "gold_30d",
        "tier": "gold",
        "label": "Dating Gold · 30 Tage",
        "price_eur": 19.99,
        "currency": "eur",
        "duration_days": 30,
        "starter_price_eur": 9.99,
        "starter_eligible_days": 7,
        "features": [
            "Alles aus Plus",
            "Likes You sehen",
            "1 Boost pro Woche",
            "3 Super Likes pro Woche",
            "Top-Match Highlights",
        ],
    },
    "platinum_30d": {
        "plan_id": "platinum_30d",
        "tier": "platinum",
        "label": "Dating Platinum · 30 Tage",
        "price_eur": 29.99,
        "currency": "eur",
        "duration_days": 30,
        "starter_price_eur": 14.99,
        "starter_eligible_days": 7,
        "features": [
            "Alles aus Gold",
            "Priorisierte Likes",
            "2 Boosts pro Woche",
            "5 Super Likes pro Woche",
            "Höchste Discovery-Priorität",
        ],
    },
    "premium_30d": {
        "plan_id": "premium_30d",
        "label": "Dating Premium · 30 Tage",
        "price_eur": 14.99,
        "currency": "eur",
        "duration_days": 30,
        "tier": "gold",
        "features": [
            "Unbegrenzte Likes",
            "Likes You freischalten",
            "Boost & Spotlight",
            "Rewind ohne Limit",
        ],
    }
}

DATING_CONSUMABLES = {
    "boost_pack_1": {
        "item_id": "boost_pack_1",
        "type": "boost_pack",
        "label": "1 Boost",
        "price_eur": 4.99,
        "currency": "eur",
        "quantity": 1,
        "description": "30 Minuten Spotlight für dein Profil",
    },
    "boost_pack_3": {
        "item_id": "boost_pack_3",
        "type": "boost_pack",
        "label": "3 Boosts",
        "price_eur": 11.99,
        "currency": "eur",
        "quantity": 3,
        "description": "Mehr Sichtbarkeit für intensive Match-Phasen",
    },
    "superlike_pack_5": {
        "item_id": "superlike_pack_5",
        "type": "superlike_pack",
        "label": "5 Super Likes",
        "price_eur": 5.99,
        "currency": "eur",
        "quantity": 5,
        "description": "Mehr Aufmerksamkeit bei Top-Profilen",
    },
    "superlike_pack_15": {
        "item_id": "superlike_pack_15",
        "type": "superlike_pack",
        "label": "15 Super Likes",
        "price_eur": 13.99,
        "currency": "eur",
        "quantity": 15,
        "description": "Günstiger Mehrfach-Pack für Power-User",
    },
    "rewind_pack_10": {
        "item_id": "rewind_pack_10",
        "type": "rewind_pack",
        "label": "10 Rewinds",
        "price_eur": 3.99,
        "currency": "eur",
        "quantity": 10,
        "description": "Verpasste Likes schnell zurückholen",
    },
    "rose_pack_3": {
        "item_id": "rose_pack_3",
        "type": "rose_pack",
        "label": "3 Roses",
        "price_eur": 6.99,
        "currency": "eur",
        "quantity": 3,
        "description": "Premium-Standout-Signal mit Priority Inbox",
    },
    "rose_pack_10": {
        "item_id": "rose_pack_10",
        "type": "rose_pack",
        "label": "10 Roses",
        "price_eur": 17.99,
        "currency": "eur",
        "quantity": 10,
        "description": "Bester Pack für Standouts und Priority Inbox",
    },
}

SCAM_SIGNAL_PATTERNS = [
    (re.compile(r"\b(telegram|whatsapp|snapchat|signal|kik)\b", re.IGNORECASE), 20, "Off-Platform Kontaktwechsel"),
    (re.compile(r"\b(crypto|bitcoin|investment|forex|trading)\b", re.IGNORECASE), 28, "Investment-/Krypto-Bezug"),
    (re.compile(r"\b(gift card|gutschein|apple card|steam card|western union|paypal friends)\b", re.IGNORECASE), 34, "Unübliche Zahlungsaufforderung"),
    (re.compile(r"\b(sugar daddy|sugarbaby|arrangement)\b", re.IGNORECASE), 22, "Finanzielles Arrangement"),
    (re.compile(r"\b(schick mir geld|send me money|hilfe mir finanziell|brauch(e)? dringend geld)\b", re.IGNORECASE), 40, "Direkte Geldforderung"),
    (re.compile(r"\b(nur fans|onlyfans|adult content|escort)\b", re.IGNORECASE), 25, "Kommerzialisierter Profilzweck"),
]

NUDITY_URL_PATTERNS = [
    re.compile(r"\b(nsfw|nude|nudity|explicit|xxx|onlyfans|adult)\b", re.IGNORECASE),
]

CHAT_SCAM_SIGNAL_PATTERNS = [
    (re.compile(r"\b(telegram|whatsapp|snapchat|signal|kik|line)\b", re.IGNORECASE), 18, "Kontaktwechsel auf externe App"),
    (re.compile(r"\b(crypto|bitcoin|forex|investment|trading)\b", re.IGNORECASE), 28, "Investment-/Krypto-Thema"),
    (re.compile(r"\b(send me money|schick mir geld|überweis mir|paypal friends|western union|gift card|gutschein)\b", re.IGNORECASE), 40, "Direkte Geldforderung"),
    (re.compile(r"\b(iban|bank account|kontonummer|wallet address|btc address)\b", re.IGNORECASE), 26, "Zahlungsdaten angefragt"),
    (re.compile(r"\b(code|otp|verifizierungscode|verification code|sms code)\b", re.IGNORECASE), 26, "Code-/OTP-Anfrage"),
    (re.compile(r"\b(dringen[dt]|urgent|sofort|asap)\b", re.IGNORECASE), 12, "Druck-/Dringlichkeitsmuster"),
]


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


def build_media_id() -> str:
    return f"DMED-{secrets.token_hex(6).upper()}"


def swipe_reset_key() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def parse_iso_datetime(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return parsed.astimezone(timezone.utc)
    except Exception:
        return None


def _init_storage_sync(force_refresh: bool = False) -> str:
    global storage_key
    if storage_key and not force_refresh:
        return storage_key
    emergent_key = os.getenv("EMERGENT_LLM_KEY")
    if not emergent_key:
        raise RuntimeError("EMERGENT_LLM_KEY fehlt")
    response = requests.post(
        f"{STORAGE_URL}/init",
        json={"emergent_key": emergent_key},
        timeout=30,
    )
    response.raise_for_status()
    storage_key = response.json()["storage_key"]
    return storage_key


def _put_object_sync(path: str, data: bytes, content_type: str) -> dict:
    global storage_key
    for attempt in range(2):
        key = _init_storage_sync(force_refresh=attempt == 1)
        response = requests.put(
            f"{STORAGE_URL}/objects/{path}",
            headers={"X-Storage-Key": key, "Content-Type": content_type},
            data=data,
            timeout=120,
        )
        if response.status_code == 403 and attempt == 0:
            storage_key = None
            continue
        response.raise_for_status()
        return response.json()
    raise RuntimeError("Objekt konnte nicht hochgeladen werden")


def _get_object_sync(path: str) -> tuple[bytes, str]:
    global storage_key
    for attempt in range(2):
        key = _init_storage_sync(force_refresh=attempt == 1)
        response = requests.get(
            f"{STORAGE_URL}/objects/{path}",
            headers={"X-Storage-Key": key},
            timeout=60,
        )
        if response.status_code == 403 and attempt == 0:
            storage_key = None
            continue
        response.raise_for_status()
        return response.content, response.headers.get("Content-Type", "application/octet-stream")
    raise RuntimeError("Objekt konnte nicht geladen werden")


def resolve_audio_extension(filename: Optional[str], content_type: str) -> str:
    if content_type in ALLOWED_AUDIO_TYPES:
        return ALLOWED_AUDIO_TYPES[content_type]
    if filename and "." in filename:
        return filename.rsplit(".", 1)[-1].lower()
    return "webm"


def resolve_video_extension(filename: Optional[str], content_type: str) -> str:
    if content_type in ALLOWED_VIDEO_TYPES:
        return ALLOWED_VIDEO_TYPES[content_type]
    if filename and "." in filename:
        return filename.rsplit(".", 1)[-1].lower()
    return "webm"


def get_boost_state(profile: dict) -> dict:
    now = datetime.now(timezone.utc)
    active_until_dt = parse_iso_datetime(profile.get("boost_active_until"))
    last_activated_dt = parse_iso_datetime(profile.get("boost_activated_at"))
    is_active = bool(active_until_dt and active_until_dt > now)
    cooldown_until_dt = last_activated_dt + timedelta(hours=BOOST_COOLDOWN_HOURS) if last_activated_dt else None
    cooldown_remaining_seconds = 0
    if cooldown_until_dt and cooldown_until_dt > now and not is_active:
        cooldown_remaining_seconds = int((cooldown_until_dt - now).total_seconds())
    return {
        "is_active": is_active,
        "active_until": active_until_dt.isoformat() if active_until_dt else None,
        "seconds_left": max(0, int((active_until_dt - now).total_seconds())) if is_active else 0,
        "cooldown_until": cooldown_until_dt.isoformat() if cooldown_until_dt else None,
        "cooldown_remaining_seconds": cooldown_remaining_seconds,
        "duration_minutes": BOOST_DURATION_MINUTES,
        "cooldown_hours": BOOST_COOLDOWN_HOURS,
    }


async def ensure_indexes():
    await db.dating_profiles.create_index("profile_id", unique=True)
    await db.dating_profiles.create_index(
        "user_id",
        unique=True,
        partialFilterExpression={"user_id": {"$type": "string"}},
    )
    await db.dating_profiles.create_index([("active", 1), ("gender", 1), ("city", 1)])
    await db.dating_profiles.create_index([("boost_active_until", -1), ("last_active_at", -1)])
    await db.dating_profiles.create_index([("last_location_at", -1), ("last_location_lat", 1), ("last_location_lng", 1)])
    await db.dating_swipes.create_index([("from_user_id", 1), ("to_profile_id", 1)], unique=True)
    await db.dating_swipes.create_index([("from_user_id", 1), ("created_at", -1)])
    await db.dating_matches.create_index("match_id", unique=True)
    await db.dating_matches.create_index([("participant_ids", 1), ("matched_at", -1)])
    await db.dating_messages.create_index("message_id", unique=True)
    await db.dating_messages.create_index([("match_id", 1), ("created_at", 1)])
    await db.dating_reports.create_index([("reporter_user_id", 1), ("created_at", -1)])
    await db.dating_blocks.create_index([("blocker_user_id", 1), ("blocked_user_id", 1)], unique=True)
    await db.dating_crossed_paths.create_index("pair_key", unique=True)
    await db.dating_crossed_paths.create_index([("participant_ids", 1), ("last_crossed_at", -1)])


async def ensure_seed_profiles():
    for seed in SEED_PROFILES:
        seed_payload = dict(seed)
        seed_payload.pop("profile_id", None)
        seed_payload.pop("user_id", None)
        await db.dating_profiles.update_one(
            {"profile_id": seed["profile_id"]},
            {"$set": seed_payload, "$setOnInsert": {"profile_id": seed["profile_id"], "user_id": seed["user_id"]}},
            upsert=True,
        )


@router.on_event("startup")
async def dating_startup():
    await ensure_indexes()
    await ensure_seed_profiles()
    try:
        await asyncio.to_thread(_init_storage_sync)
    except Exception as exc:
        logger.warning(f"Dating storage init fehlgeschlagen: {exc}")


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
        "occupation": user.get("occupation") or "",
        "profile_prompt": user.get("profile_prompt") or "",
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
    await db.dating_profiles.update_one(
        {"user_id": str(user["_id"])},
        {"$setOnInsert": profile_doc},
        upsert=True,
    )
    fresh = await db.dating_profiles.find_one({"user_id": str(user["_id"])}, {"_id": 0})
    return fresh


async def maybe_seed_demo_like(my_profile: dict):
    if await db.dating_swipes.find_one({"to_user_id": my_profile["user_id"], "from_user_id": "seed-lina"}):
        return
    await db.dating_swipes.update_one(
        {"from_user_id": "seed-lina", "to_profile_id": my_profile["profile_id"]},
        {
            "$setOnInsert": {
                "from_user_id": "seed-lina",
                "to_user_id": my_profile["user_id"],
                "from_profile_id": "DAT-SEED-LINA",
                "to_profile_id": my_profile["profile_id"],
                "type": "like",
                "created_at": now_iso(),
                "swipe_reset_key": swipe_reset_key(),
                "is_seed": True,
            }
        },
        upsert=True,
    )


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
    occupation: str = Field(default="", max_length=80)
    profile_prompt: str = Field(default="", max_length=220)
    interests: List[str] = Field(default_factory=list, max_length=12)
    gender: Literal["man", "woman", "nonbinary", "unspecified"] = "unspecified"
    seeking: List[Literal["men", "women", "nonbinary"]] = Field(default_factory=list)
    relationship_intent: Literal["serious", "casual", "friends", "open"] = "serious"
    photos: List[str] = Field(default_factory=list, max_length=6)


class SwipeReq(BaseModel):
    profile_id: str
    super_like: bool = False
    opener_text: Optional[str] = Field(default=None, max_length=180)
    use_rose: bool = False


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


class VerifyReq(BaseModel):
    selfie_url: str = Field(min_length=8, max_length=500)


class DatingAiPromptReq(BaseModel):
    prompt: Optional[str] = Field(default="", max_length=300)
    match_id: Optional[str] = Field(default=None, max_length=80)


class DatingLocationUpdateReq(BaseModel):
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)
    accuracy_m: Optional[float] = Field(default=50, ge=0, le=50000)


class VoiceIntroDeleteReq(BaseModel):
    media_id: Optional[str] = None


class DatingSafetyScanReq(BaseModel):
    profile_id: Optional[str] = None
    force: bool = False


class DatingPremiumCheckoutReq(BaseModel):
    plan_id: str = Field(default="premium_30d")
    origin_url: str = Field(min_length=8, max_length=500)


class DatingPremiumStatusReq(BaseModel):
    session_id: str = Field(min_length=8, max_length=200)


class DatingChatSafetyReq(BaseModel):
    match_id: str = Field(min_length=4, max_length=80)
    force: bool = False


class DatingConsumableCheckoutReq(BaseModel):
    item_id: str = Field(min_length=4, max_length=80)
    origin_url: str = Field(min_length=8, max_length=500)


class DatingOfferClaimReq(BaseModel):
    offer_id: str = Field(min_length=4, max_length=80)


def _build_profile_context(profile: dict) -> str:
    interests = ", ".join(profile.get("interests") or []) or "keine besonderen Interessen angegeben"
    return (
        f"Name: {profile.get('name') or 'Unbekannt'}\n"
        f"Alter: {profile.get('age') or 'unbekannt'}\n"
        f"Stadt: {profile.get('city') or 'unbekannt'}\n"
        f"Bio: {profile.get('bio') or 'leer'}\n"
        f"Beruf: {profile.get('occupation') or 'leer'}\n"
        f"Profil-Prompt: {profile.get('profile_prompt') or 'leer'}\n"
        f"Interessen: {interests}\n"
        f"Absicht: {profile.get('relationship_intent') or 'unbekannt'}"
    )


async def _run_dating_ai(user_id: str, task: str, prompt: str) -> str:
    api_key = os.getenv("EMERGENT_LLM_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="AI service nicht konfiguriert")
    chat = LlmChat(
        api_key=api_key,
        session_id=f"dating-ai-{task}-{user_id}",
        system_message=(
            "Du bist BidBlitz Dating AI. Antworte auf Deutsch, konkret, charmant und sicher. "
            "Keine langen Einleitungen, keine Emojis-Spam, keine leeren Floskeln. "
            "Liefere nur den angeforderten Inhalt."
        ),
    ).with_model(AI_PROVIDER, AI_MODEL)
    chunks = []
    async for event in chat.stream_message(UserMessage(text=prompt)):
        if isinstance(event, TextDelta):
            chunks.append(event.content)
        elif isinstance(event, StreamDone):
            break
    result = "".join(chunks).strip()
    if not result:
        raise HTTPException(status_code=502, detail="AI hat keinen Inhalt zurückgegeben")
    return result


def calc_profile_completion(profile: dict) -> int:
    checks = [
        bool(profile.get("name")),
        bool(profile.get("age")),
        bool(profile.get("city")),
        bool(profile.get("bio")),
        bool(profile.get("occupation")),
        bool(profile.get("profile_prompt")),
        bool(profile.get("photos")),
        len(profile.get("interests") or []) >= 2,
        bool(profile.get("seeking")),
    ]
    return round((sum(1 for item in checks if item) / len(checks)) * 100)


def calc_discover_rank(profile: dict) -> int:
    boost = get_boost_state(profile)
    rank = profile.get("compatibility_score", 0)
    if boost["is_active"]:
        rank += 40
    if profile.get("verified"):
        rank += 8
    if profile.get("premium"):
        rank += 4
    if profile.get("is_recently_active"):
        rank += 3
    if profile.get("distance_km") is not None and profile.get("distance_km") <= 5:
        rank += 6
    completion = int(profile.get("profile_completion") or 0)
    rank += min(completion // 12, 8)
    if profile.get("voice_intro"):
        rank += 3
    if profile.get("video_profile"):
        rank += 4
    if completion < 45:
        rank -= 6
    safety = profile.get("safety_summary") or {}
    rank -= min(int(safety.get("total_score") or 0) // 4, 18)
    if safety.get("scam_level") == "high":
        rank -= 10
    if safety.get("nudity_level") == "high":
        rank -= 8
    return rank


def _truncate_text(value: Optional[str], max_len: int) -> str:
    return (value or "").strip()[:max_len]


def _compute_profile_text_fingerprint(profile: dict) -> str:
    payload = "||".join([
        _truncate_text(profile.get("name"), 120),
        _truncate_text(profile.get("bio"), 600),
        _truncate_text(profile.get("occupation"), 120),
        _truncate_text(profile.get("profile_prompt"), 400),
        "|".join((profile.get("interests") or [])[:12]),
    ])
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def _estimate_scam_signals(profile: dict) -> tuple[int, list[str]]:
    text_blob = "\n".join([
        _truncate_text(profile.get("bio"), 600),
        _truncate_text(profile.get("occupation"), 120),
        _truncate_text(profile.get("profile_prompt"), 400),
        " ".join(profile.get("interests") or []),
    ])
    score = 0
    flags = []
    for pattern, weight, label in SCAM_SIGNAL_PATTERNS:
        if pattern.search(text_blob):
            score += weight
            flags.append(label)
    if len(re.findall(r"https?://", text_blob, re.IGNORECASE)) >= 1:
        score += 12
        flags.append("Externer Link im Profiltext")
    if len(re.findall(r"\+\d{6,}", text_blob)) >= 1:
        score += 14
        flags.append("Telefonnummer im Profiltext")
    if re.search(r"@\w+", text_blob):
        score += 10
        flags.append("Handle/Kontakt im Profiltext")
    return min(score, 100), flags[:6]


def _scam_level(score: int) -> str:
    if score >= 70:
        return "high"
    if score >= 35:
        return "medium"
    return "low"


def _nudity_level(score: int) -> str:
    if score >= 75:
        return "high"
    if score >= 40:
        return "medium"
    return "low"


def _is_safety_scan_fresh(scan: Optional[dict]) -> bool:
    if not scan:
        return False
    scanned_at = parse_iso_datetime(scan.get("scanned_at"))
    if not scanned_at:
        return False
    return scanned_at >= datetime.now(timezone.utc) - timedelta(hours=SAFETY_SCAN_TTL_HOURS)


def _readable_safety_summary(scan: Optional[dict]) -> dict:
    data = scan or {}
    scam = data.get("scam") or {}
    nudity = data.get("nudity") or {}
    total_score = min(100, int((scam.get("score") or 0) * 0.6 + (nudity.get("score") or 0) * 0.4))
    return {
        "scam_level": scam.get("level") or "low",
        "scam_score": int(scam.get("score") or 0),
        "scam_flags": (scam.get("flags") or [])[:4],
        "nudity_level": nudity.get("level") or "low",
        "nudity_score": int(nudity.get("score") or 0),
        "nudity_flags": (nudity.get("flags") or [])[:4],
        "status": data.get("status") or "clear",
        "total_score": total_score,
        "scanned_at": data.get("scanned_at"),
        "version": data.get("version") or SAFETY_ANALYSIS_VERSION,
    }


def _build_lightweight_safety_scan(profile: dict) -> dict:
    scam_score, scam_flags = _estimate_scam_signals(profile)
    photo_url = _get_primary_photo_url(profile) or ""
    nudity_score = 76 if any(pattern.search(photo_url) for pattern in NUDITY_URL_PATTERNS) else 0
    nudity_flags = ["Verdächtiger Bildpfad"] if nudity_score else []
    status = "clear"
    if scam_score >= 70 or nudity_score >= 75:
        status = "warning"
    elif scam_score >= 35 or nudity_score >= 40:
        status = "review"
    return {
        "version": f"{SAFETY_ANALYSIS_VERSION}-light",
        "scanned_at": now_iso(),
        "status": status,
        "text_fingerprint": _compute_profile_text_fingerprint(profile),
        "photo_fingerprint": hashlib.sha256(photo_url.encode("utf-8")).hexdigest() if photo_url else "",
        "scam": {"score": scam_score, "level": _scam_level(scam_score), "flags": scam_flags},
        "nudity": {"score": nudity_score, "level": _nudity_level(nudity_score), "flags": nudity_flags, "reason": "Heuristische Schnellprüfung"},
    }


def _analyze_chat_text_safety(text: str) -> dict:
    message = (text or "").strip()
    if not message:
        return {
            "score": 0,
            "level": "low",
            "flags": [],
            "safe_to_send": True,
            "warning": "",
        }

    score = 0
    flags = []
    for pattern, weight, label in CHAT_SCAM_SIGNAL_PATTERNS:
        if pattern.search(message):
            score += weight
            flags.append(label)
    if len(re.findall(r"https?://", message, re.IGNORECASE)) >= 1:
        score += 18
        flags.append("Externer Link im Chat")
    if len(re.findall(r"\+\d{6,}", message)) >= 1:
        score += 18
        flags.append("Telefonnummer im Chat")
    if re.search(r"@\w+", message):
        score += 10
        flags.append("Handle im Chat")

    score = min(score, 100)
    level = _scam_level(score)
    warning = ""
    safe_to_send = True
    if level == "high":
        safe_to_send = False
        warning = "Diese Nachricht wirkt riskant. Bitte teile keine Geld-, Code- oder Zahlungsdaten im Chat."
    elif level == "medium":
        warning = "Vorsicht: Diese Nachricht enthält Muster, die häufig in Dating-Scams vorkommen."

    return {
        "score": score,
        "level": level,
        "flags": flags[:5],
        "safe_to_send": safe_to_send,
        "warning": warning,
    }


async def _build_chat_safety_summary(match_id: str) -> dict:
    messages = await db.dating_messages.find({"match_id": match_id}, {"_id": 0, "text": 1, "sender_user_id": 1, "created_at": 1}).sort("created_at", -1).to_list(40)
    highest = {"score": 0, "level": "low", "flags": [], "warning": "", "message_preview": "", "sender_user_id": ""}
    flagged_messages = []
    for row in messages:
        analysis = _analyze_chat_text_safety(row.get("text") or "")
        if analysis["score"] <= 0:
            continue
        entry = {
            "score": analysis["score"],
            "level": analysis["level"],
            "flags": analysis["flags"],
            "warning": analysis["warning"],
            "message_preview": (row.get("text") or "")[:120],
            "sender_user_id": row.get("sender_user_id"),
            "created_at": row.get("created_at"),
        }
        flagged_messages.append(entry)
        if analysis["score"] > highest["score"]:
            highest = entry

    if highest["score"] == 0:
        return {
            "score": 0,
            "level": "low",
            "flags": [],
            "warning": "",
            "status": "clear",
            "flagged_count": 0,
            "latest_flagged_message": None,
            "updated_at": now_iso(),
        }

    return {
        "score": highest["score"],
        "level": highest["level"],
        "flags": highest["flags"],
        "warning": highest["warning"],
        "status": "warning" if highest["level"] == "high" else "review",
        "flagged_count": len(flagged_messages),
        "latest_flagged_message": flagged_messages[0],
        "updated_at": now_iso(),
    }


async def refresh_match_chat_safety(match_id: str) -> dict:
    summary = await _build_chat_safety_summary(match_id)
    await db.dating_matches.update_one({"match_id": match_id}, {"$set": {"chat_safety_summary": summary}})
    return summary


def _get_primary_photo_url(profile: dict) -> Optional[str]:
    photos = profile.get("photos") or []
    if photos and photos[0]:
        return photos[0]
    avatar = profile.get("avatar")
    return avatar or None


def _guess_mime_from_response(content_type: Optional[str], url: str) -> str:
    if content_type:
        clean = content_type.split(";")[0].strip().lower()
        if clean in {"image/jpeg", "image/png", "image/webp"}:
            return clean
    guessed = mimetypes.guess_type(url)[0]
    if guessed in {"image/jpeg", "image/png", "image/webp"}:
        return guessed
    return "image/jpeg"


def _fetch_image_as_base64(url: str) -> tuple[str, str]:
    response = requests.get(url, timeout=IMAGE_FETCH_TIMEOUT_SECONDS, stream=True)
    response.raise_for_status()
    chunks = []
    size = 0
    for chunk in response.iter_content(chunk_size=65536):
        if not chunk:
            continue
        size += len(chunk)
        if size > IMAGE_FETCH_MAX_BYTES:
            raise ValueError("Bild zu groß für Safety-Scan")
        chunks.append(chunk)
    raw = b"".join(chunks)
    if not raw:
        raise ValueError("Bild leer")
    content_type = _guess_mime_from_response(response.headers.get("Content-Type"), url)
    return base64.b64encode(raw).decode("utf-8"), content_type


async def _run_safety_vision_check(image_url: str) -> dict:
    api_key = os.getenv("EMERGENT_LLM_KEY")
    if not api_key:
        raise RuntimeError("EMERGENT_LLM_KEY fehlt")

    image_b64, mime = await asyncio.to_thread(_fetch_image_as_base64, image_url)
    chat = LlmChat(
        api_key=api_key,
        session_id=f"dating-safety-vision-{uuid.uuid4().hex[:12]}",
        system_message=(
            "Du bist ein strenger Safety-Klassifizierer für eine Dating-App. "
            "Analysiere nur Sicherheitsrisiken. Gib exakt JSON zurück ohne Markdown."
        ),
    ).with_model(SAFETY_AI_PROVIDER, SAFETY_AI_MODEL)

    prompt = (
        "Analysiere dieses Profilbild nur auf Nacktheit/sexuell explizite Wirkung für eine Dating-App. "
        "Antwortformat exakt als JSON mit Schlüsseln: "
        "nudity_score (0-100 Zahl), nudity_level (low|medium|high), flags (Array aus kurzen Strings), reason (kurzer String)."
    )
    chunks = []
    async for event in chat.stream_message(UserMessage(
        text=prompt,
        file_contents=[ImageContent(image_base64=f"data:{mime};base64,{image_b64}")],
    )):
        if isinstance(event, TextDelta):
            chunks.append(event.content)
        elif isinstance(event, StreamDone):
            break
    raw = "".join(chunks).strip()
    if not raw:
        raise RuntimeError("Safety-Vision lieferte keine Antwort")
    try:
        parsed = json.loads(raw)
    except Exception as exc:
        raise RuntimeError(f"Safety-Vision JSON ungültig: {exc}")
    score = max(0, min(100, int(parsed.get("nudity_score") or 0)))
    level = parsed.get("nudity_level") or _nudity_level(score)
    flags = [str(item).strip() for item in (parsed.get("flags") or []) if str(item).strip()][:4]
    reason = str(parsed.get("reason") or "").strip()
    return {
        "score": score,
        "level": level if level in {"low", "medium", "high"} else _nudity_level(score),
        "flags": flags,
        "reason": reason,
    }


async def analyze_profile_safety(profile: dict, force: bool = False) -> dict:
    current_scan = profile.get("safety_scan") or {}
    text_fingerprint = _compute_profile_text_fingerprint(profile)
    photo_url = _get_primary_photo_url(profile)
    photo_fingerprint = hashlib.sha256((photo_url or "").encode("utf-8")).hexdigest() if photo_url else ""
    if (
        not force
        and _is_safety_scan_fresh(current_scan)
        and current_scan.get("text_fingerprint") == text_fingerprint
        and current_scan.get("photo_fingerprint") == photo_fingerprint
    ):
        return current_scan

    scam_score, scam_flags = _estimate_scam_signals(profile)
    nudity = {
        "score": 0,
        "level": "low",
        "flags": [],
        "reason": "Kein Bild-Scan erforderlich",
    }

    if photo_url:
        if any(pattern.search(photo_url) for pattern in NUDITY_URL_PATTERNS):
            nudity = {
                "score": 76,
                "level": "high",
                "flags": ["Verdächtiger Bildpfad"],
                "reason": "Bild-URL enthält explizite Schlüsselwörter",
            }
        else:
            try:
                nudity = await _run_safety_vision_check(photo_url)
            except Exception as exc:
                logger.warning(f"Dating Safety Vision Fallback aktiv: {exc}")
                nudity = {
                    "score": 0,
                    "level": "low",
                    "flags": ["Vision-Scan nicht verfügbar"],
                    "reason": "Bildanalyse konnte nicht abgeschlossen werden",
                }

    status = "clear"
    if scam_score >= 70 or nudity.get("score", 0) >= 75:
        status = "warning"
    elif scam_score >= 35 or nudity.get("score", 0) >= 40:
        status = "review"

    scan = {
        "version": SAFETY_ANALYSIS_VERSION,
        "scanned_at": now_iso(),
        "status": status,
        "text_fingerprint": text_fingerprint,
        "photo_fingerprint": photo_fingerprint,
        "scam": {
            "score": scam_score,
            "level": _scam_level(scam_score),
            "flags": scam_flags,
        },
        "nudity": nudity,
    }
    await db.dating_profiles.update_one(
        {"profile_id": profile["profile_id"]},
        {"$set": {"safety_scan": scan}},
    )
    return scan


async def ensure_profile_safety(profile: dict, force: bool = False) -> dict:
    scan = await analyze_profile_safety(profile, force=force)
    profile["safety_scan"] = scan
    profile["safety_summary"] = _readable_safety_summary(scan)
    return profile


async def maybe_attach_safety(profile: dict, include_scan: bool = False) -> dict:
    if not profile:
        return profile
    scan = profile.get("safety_scan") or _build_lightweight_safety_scan(profile)
    profile["safety_scan"] = scan
    profile["safety_summary"] = _readable_safety_summary(scan)
    if not include_scan:
        profile.pop("safety_scan", None)
    return profile


def _premium_until(days: int) -> str:
    return (datetime.now(timezone.utc) + timedelta(days=days)).isoformat()


async def _activate_dating_premium_from_transaction(txn: dict) -> bool:
    metadata = txn.get("metadata") or {}
    if metadata.get("type") not in {"dating_premium", "dating_consumable"}:
        return False
    if txn.get("credited"):
        return False
    user_id = metadata.get("user_id") or txn.get("user_id")
    if not user_id:
        return False

    if metadata.get("type") == "dating_consumable":
        item_id = metadata.get("item_id")
        if not item_id:
            return False
        applied = await _apply_dating_consumable(user_id, item_id)
        if not applied:
            return False
        await db.payment_transactions.update_one(
            {"session_id": txn.get("session_id")},
            {"$set": {"credited": True, "credited_at": now_iso(), "status": "completed", "payment_status": "paid"}},
        )
        return True

    plan_id = metadata.get("plan_id")
    plan = DATING_PREMIUM_PLANS.get(plan_id or "")
    if not plan:
        return False

    valid_until = _premium_until(plan["duration_days"])
    await db.users.update_one(
        {"_id": ObjectId(user_id) if ObjectId.is_valid(user_id) else user_id},
        {"$set": {
            "dating_premium": True,
            "dating_premium_plan": plan_id,
            "dating_premium_valid_until": valid_until,
            "dating_starter_offer_claimed": True,
        }},
    )
    await db.dating_profiles.update_one(
        {"user_id": user_id},
        {"$set": {
            "premium": True,
            "premium_plan": plan_id,
            "premium_valid_until": valid_until,
            "premium_activated_at": now_iso(),
            "starter_offer_claimed": True,
        }},
    )
    if plan.get("tier") == "gold":
        await db.dating_profiles.update_one({"user_id": user_id}, {"$inc": {"credits.boosts": 1, "credits.superlikes": 3}})
    if plan.get("tier") == "platinum":
        await db.dating_profiles.update_one({"user_id": user_id}, {"$inc": {"credits.boosts": 2, "credits.superlikes": 5}})
    await db.payment_transactions.update_one(
        {"session_id": txn.get("session_id")},
        {"$set": {"credited": True, "credited_at": now_iso(), "status": "completed", "payment_status": "paid"}},
    )
    existing = await db.transactions.find_one({"stripe_session_id": txn.get("session_id"), "category": "dating_premium"}, {"_id": 0})
    if not existing:
        await db.transactions.insert_one({
            "id": secrets.token_hex(8),
            "user_id": user_id,
            "type": "subscription",
            "amount": txn.get("amount", 0),
            "description": f"Dating Premium aktiviert ({plan['label']})",
            "merchant_name": "BidBlitz Dating",
            "status": "completed",
            "reference": f"DATE-{str(txn.get('session_id', ''))[:12].upper()}",
            "payment_method": "stripe",
            "category": "dating_premium",
            "stripe_session_id": txn.get("session_id"),
            "created_at": now_iso(),
        })
    return True


async def _refresh_dating_premium_status(session_id: str, user_id: str, request: Request) -> dict:
    txn = await db.payment_transactions.find_one({"session_id": session_id, "user_id": user_id}, {"_id": 0})
    if not txn:
        raise HTTPException(status_code=404, detail="Payment-Session nicht gefunden")
    host_url = str(request.base_url).rstrip("/")
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=f"{host_url}/api/webhook/stripe")
    checkout_status = await stripe_checkout.get_checkout_status(session_id)
    new_status = "completed" if checkout_status.payment_status == "paid" else checkout_status.status
    await db.payment_transactions.update_one(
        {"session_id": session_id},
        {"$set": {
            "status": new_status,
            "payment_status": checkout_status.payment_status,
            "updated_at": now_iso(),
        }},
    )
    refreshed = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0}) or txn
    activated = False
    if checkout_status.payment_status == "paid":
        activated = await _activate_dating_premium_from_transaction(refreshed)
        refreshed = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0}) or refreshed
    return {
        "status": refreshed.get("status"),
        "payment_status": refreshed.get("payment_status"),
        "premium_activated": activated or bool(refreshed.get("credited")),
        "session_id": session_id,
        "plan_id": (refreshed.get("metadata") or {}).get("plan_id"),
    }


async def handle_dating_premium_webhook(session_id: str) -> bool:
    txn = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
    if not txn:
        return False
    return await _activate_dating_premium_from_transaction(txn)


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    radius = 6371.0
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lambda = math.radians(lng2 - lng1)
    a = math.sin(d_phi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(d_lambda / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return radius * c


def is_location_fresh(profile: dict) -> bool:
    last_location_at = parse_iso_datetime(profile.get("last_location_at"))
    if not last_location_at:
        return False
    return last_location_at >= datetime.now(timezone.utc) - timedelta(hours=LOCATION_FRESH_HOURS)


def extract_distance_km(source_profile: dict, target_profile: dict) -> Optional[float]:
    if source_profile.get("last_location_lat") is None or source_profile.get("last_location_lng") is None:
        return None
    if target_profile.get("last_location_lat") is None or target_profile.get("last_location_lng") is None:
        return None
    return round(
        haversine_km(
            float(source_profile["last_location_lat"]),
            float(source_profile["last_location_lng"]),
            float(target_profile["last_location_lat"]),
            float(target_profile["last_location_lng"]),
        ),
        2,
    )


async def upsert_crossed_path(my_profile: dict, other_profile: dict, distance_km: float):
    key = pair_key(my_profile["user_id"], other_profile["user_id"])
    await db.dating_crossed_paths.update_one(
        {"pair_key": key},
        {
            "$set": {
                "participant_ids": [my_profile["user_id"], other_profile["user_id"]],
                "participant_profiles": [my_profile["profile_id"], other_profile["profile_id"]],
                "last_crossed_at": now_iso(),
                "last_distance_km": round(distance_km, 3),
            },
            "$inc": {"cross_count": 1},
            "$setOnInsert": {"created_at": now_iso()},
        },
        upsert=True,
    )


def calc_compatibility_score(me: dict, other: dict, filters: dict) -> int:
    score = 55
    shared = len(set(me.get("interests") or []).intersection(set(other.get("interests") or [])))
    score += min(shared * 8, 24)
    if me.get("city") and other.get("city") and me.get("city") == other.get("city"):
        score += 8
    if filters.get("relationship_intent") and other.get("relationship_intent") == filters.get("relationship_intent"):
        score += 6
    if other.get("verified"):
        score += 4
    if other.get("premium"):
        score += 2
    return min(score, 99)


def build_match_reasons(me: dict, other: dict, filters: dict) -> list[str]:
    reasons = []
    shared_interests = sorted(set(me.get("interests") or []).intersection(set(other.get("interests") or [])))
    if shared_interests:
        preview = ", ".join(shared_interests[:2])
        reasons.append(f"Gemeinsame Interessen: {preview}")
    if me.get("city") and other.get("city") and me.get("city") == other.get("city"):
        reasons.append(f"Gleiche Stadt: {other.get('city')}")
    if filters.get("relationship_intent") and other.get("relationship_intent") == filters.get("relationship_intent"):
        reasons.append("Gleiche Beziehungsabsicht")
    if other.get("verified"):
        reasons.append("Verifiziertes Profil")
    if other.get("voice_intro"):
        reasons.append("Hat Voice Intro")
    if other.get("video_profile"):
        reasons.append("Hat Video-Profil")
    if other.get("distance_km") is not None and other.get("distance_km") <= 5:
        reasons.append("In deiner Nähe")
    if other.get("profile_completion") and other.get("profile_completion") >= 70:
        reasons.append("Vollständiges Profil")
    return reasons[:4]


def _curation_score(me: dict, other: dict, filters: dict) -> int:
    score = calc_compatibility_score(me, other, filters)
    score += min(int(calc_profile_completion(other) / 10), 10)
    if other.get("verified"):
        score += 8
    if other.get("voice_intro"):
        score += 4
    if other.get("video_profile"):
        score += 5
    if other.get("premium"):
        score += 3
    safety = _readable_safety_summary(other.get("safety_scan"))
    score -= min(int(safety.get("total_score") or 0) // 4, 20)
    return score


def _standout_score(me: dict, other: dict, filters: dict) -> int:
    score = _curation_score(me, other, filters)
    if other.get("profile_prompt"):
        score += 4
    if len(other.get("interests") or []) >= 3:
        score += 3
    return score


def _rotation_seed_key(me: dict) -> str:
    return f"{me['user_id']}::{datetime.now(timezone.utc).date().isoformat()}"


def _stable_rotation_rank(seed_key: str, profile_id: str) -> int:
    return int(hashlib.sha256(f"{seed_key}::{profile_id}".encode("utf-8")).hexdigest()[:8], 16)


async def _build_curated_pool(me: dict, filters: dict) -> list[dict]:
    blocked_by_me = await db.dating_blocks.find({"blocker_user_id": me["user_id"]}, {"_id": 0, "blocked_user_id": 1}).to_list(500)
    blockers = await db.dating_blocks.find({"blocked_user_id": me["user_id"]}, {"_id": 0, "blocker_user_id": 1}).to_list(500)
    blocked_ids = [item["blocked_user_id"] for item in blocked_by_me]
    blocker_ids = [item["blocker_user_id"] for item in blockers]
    query = {
        "active": True,
        "user_id": {"$ne": me["user_id"], "$nin": blocked_ids + blocker_ids},
    }
    if filters.get("seeking"):
        query["gender"] = {"$in": filters["seeking"]}
    profiles = await db.dating_profiles.find(query, {"_id": 0}).to_list(60)
    enriched = []
    for profile in profiles:
        profile["distance_km"] = extract_distance_km(me, profile)
        profile["compatibility_score"] = calc_compatibility_score(me, profile, filters)
        profile["profile_completion"] = calc_profile_completion(profile)
        profile["boost"] = get_boost_state(profile)
        profile["spotlight"] = bool(profile["boost"]["is_active"])
        await maybe_attach_safety(profile)
        profile["match_reasons"] = build_match_reasons(me, profile, filters)
        profile["discover_rank"] = calc_discover_rank(profile)
        profile["rotation_rank"] = _stable_rotation_rank(_rotation_seed_key(me), profile["profile_id"])
        enriched.append(profile)
    return enriched


async def sync_profile_from_registration(user: dict, profile: dict) -> dict:
    if not profile:
        return profile
    user_name = user.get("name") or user.get("full_name") or user.get("email", "User").split("@")[0]
    user_birth_date = user.get("birth_date")
    user_age = years_old(user_birth_date)
    user_city = user.get("city") or ""
    user_avatar = user.get("profile_image") or user.get("avatar") or DEFAULT_AVATARS[0]

    updates = {}
    if not profile.get("name") and user_name:
        updates["name"] = user_name
    if not profile.get("birth_date") and user_birth_date:
        updates["birth_date"] = user_birth_date
    if not profile.get("age") and user_age:
        updates["age"] = user_age
    if not profile.get("city") and user_city:
        updates["city"] = user_city
    if not profile.get("avatar") and user_avatar:
        updates["avatar"] = user_avatar
    photos = profile.get("photos") or []
    if (not photos or not photos[0]) and user_avatar:
        updates["photos"] = [user_avatar]
    if user.get("interests") and not profile.get("interests"):
        updates["interests"] = (user.get("interests") or [])[:12]

    if updates:
        await db.dating_profiles.update_one({"profile_id": profile["profile_id"]}, {"$set": updates})
        profile = {**profile, **updates}
    return profile


def _get_dating_entitlements(profile: dict) -> dict:
    credits = profile.get("credits") or {}
    tier = profile.get("premium_plan") or ("premium_30d" if profile.get("premium") else None)
    is_plus = tier in {"plus_30d"}
    is_gold = tier in {"gold_30d", "premium_30d"}
    is_platinum = tier in {"platinum_30d"}
    return {
        "plan_id": tier,
        "is_plus": is_plus,
        "is_gold": is_gold,
        "is_platinum": is_platinum,
        "can_see_likes_you": bool(is_gold or is_platinum or profile.get("premium")),
        "priority_likes": bool(is_platinum),
        "boost_credits": int(credits.get("boosts", 0)),
        "superlike_credits": int(credits.get("superlikes", 0)),
        "rewind_credits": int(credits.get("rewinds", 0)),
        "rose_credits": int(credits.get("roses", 0)),
        "daily_rewind_limit": None if is_gold or is_platinum or profile.get("premium") else (5 if is_plus else 0),
        "starter_offer_claimed": bool(profile.get("starter_offer_claimed")),
        "priority_inbox": bool(is_platinum),
    }


def _starter_offer_for_profile(profile: dict) -> Optional[dict]:
    created_at = parse_iso_datetime(profile.get("created_at"))
    if not created_at:
        return None
    age_days = (datetime.now(timezone.utc) - created_at).days
    if age_days > 7 or profile.get("premium") or profile.get("starter_offer_claimed"):
        return None
    base_plan = DATING_PREMIUM_PLANS["gold_30d"]
    return {
        "offer_id": "starter_gold_7d",
        "title": "Starter Deal",
        "subtitle": "Erste Woche mit Gold-Vorteilen günstiger freischalten",
        "plan_id": "gold_30d",
        "offer_price_eur": base_plan.get("starter_price_eur", 9.99),
        "regular_price_eur": base_plan["price_eur"],
        "days_left": max(0, 7 - age_days),
        "features": base_plan["features"],
    }


def _pricing_payload_for_profile(profile: dict) -> dict:
    starter = _starter_offer_for_profile(profile)
    plans = []
    for key in ["plus_30d", "gold_30d", "platinum_30d"]:
        item = dict(DATING_PREMIUM_PLANS[key])
        if starter and starter["plan_id"] == item["plan_id"]:
            item["starter_offer"] = {
                "offer_id": starter["offer_id"],
                "offer_price_eur": starter["offer_price_eur"],
                "days_left": starter["days_left"],
            }
        plans.append(item)
    return {
        "plans": plans,
        "consumables": list(DATING_CONSUMABLES.values()),
        "starter_offer": starter,
    }


async def _apply_dating_consumable(user_id: str, item_id: str) -> bool:
    item = DATING_CONSUMABLES.get(item_id)
    if not item:
        return False
    if item["type"] == "boost_pack":
        field = "credits.boosts"
    elif item["type"] == "superlike_pack":
        field = "credits.superlikes"
    elif item["type"] == "rewind_pack":
        field = "credits.rewinds"
    elif item["type"] == "rose_pack":
        field = "credits.roses"
    else:
        return False
    await db.dating_profiles.update_one({"user_id": user_id}, {"$inc": {field: int(item["quantity"]), "lifetime_value_cents": int(round(item["price_eur"] * 100))}})
    return True


@router.get("/profile/me")
async def my_profile(request: Request):
    user = await get_me(request)
    profile = await get_or_create_my_profile(user)
    profile = await sync_profile_from_registration(user, profile)
    await maybe_seed_demo_like(profile)
    profile = await ensure_profile_safety(profile)
    filters = user.get("dating_filters") or {
        "age_min": 18,
        "age_max": 99,
        "city": "",
        "seeking": [],
        "relationship_intent": None,
    }
    profile["profile_completion"] = calc_profile_completion(profile)
    profile["boost"] = get_boost_state(profile)
    if profile.get("voice_intro"):
        profile["voice_intro"]["stream_url"] = f"/api/dating/voice-intro/{profile['voice_intro']['media_id']}"
    if profile.get("video_profile"):
        profile["video_profile"]["stream_url"] = f"/api/dating/video-profile/{profile['video_profile']['media_id']}"
    return {"profile": profile, "filters": filters}


@router.put("/profile/me")
async def update_my_profile(payload: DatingProfileUpdate, request: Request):
    user = await get_me(request)
    existing = await get_or_create_my_profile(user)
    existing = await sync_profile_from_registration(user, existing)
    photos = payload.photos[:6] if payload.photos else existing.get("photos") or [existing.get("avatar") or DEFAULT_AVATARS[0]]
    avatar = photos[0]
    update = {
        "name": payload.name,
        "age": payload.age,
        "city": payload.city,
        "bio": payload.bio,
        "occupation": payload.occupation,
        "profile_prompt": payload.profile_prompt,
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
    fresh = await ensure_profile_safety(fresh, force=True)
    fresh["profile_completion"] = calc_profile_completion(fresh)
    fresh["boost"] = get_boost_state(fresh)
    if fresh.get("voice_intro"):
        fresh["voice_intro"]["stream_url"] = f"/api/dating/voice-intro/{fresh['voice_intro']['media_id']}"
    if fresh.get("video_profile"):
        fresh["video_profile"]["stream_url"] = f"/api/dating/video-profile/{fresh['video_profile']['media_id']}"
    return {"ok": True, "profile": fresh}


@router.post("/premium/demo-upgrade")
async def premium_demo_upgrade(request: Request):
    user = await get_me(request)
    await db.users.update_one({"_id": user["_id"]}, {"$set": {"dating_premium": True}})
    await db.dating_profiles.update_one(
        {"user_id": str(user["_id"])},
        {"$set": {"premium": True}},
    )
    return {"ok": True, "premium": True}


@router.get("/premium/plans")
async def dating_premium_plans(request: Request):
    user = await get_me(request)
    profile = await get_or_create_my_profile(user)
    return _pricing_payload_for_profile(profile)


@router.post("/premium/checkout")
async def dating_premium_checkout(payload: DatingPremiumCheckoutReq, request: Request):
    user = await get_me(request)
    if not STRIPE_API_KEY:
        raise HTTPException(status_code=503, detail="Stripe nicht konfiguriert")
    profile = await get_or_create_my_profile(user)
    plan = DATING_PREMIUM_PLANS.get(payload.plan_id)
    if not plan:
        raise HTTPException(status_code=400, detail="Ungültiger Premium-Plan")

    starter = _starter_offer_for_profile(profile)
    effective_price = float(plan["price_eur"])
    offer_id = None
    if starter and starter["plan_id"] == plan["plan_id"]:
        effective_price = float(starter["offer_price_eur"])
        offer_id = starter["offer_id"]

    origin = payload.origin_url.rstrip("/")
    success_url = f"{origin}/dating?premium_session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{origin}/dating?premium_cancelled=true"
    metadata = {
        "type": "dating_premium",
        "plan_id": plan["plan_id"],
        "user_id": str(user["_id"]),
        "user_email": user.get("email", ""),
        "offer_id": offer_id or "",
    }
    host_url = str(request.base_url).rstrip("/")
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=f"{host_url}/api/webhook/stripe")
    checkout_req = CheckoutSessionRequest(
        amount=effective_price,
        currency=plan["currency"],
        success_url=success_url,
        cancel_url=cancel_url,
        metadata=metadata,
        payment_methods=["card"],
    )
    session = await stripe_checkout.create_checkout_session(checkout_req)
    tx_doc = {
        "session_id": session.session_id,
        "user_id": str(user["_id"]),
        "user_email": user.get("email", ""),
        "amount": effective_price,
        "currency": plan["currency"].upper(),
        "type": "dating_premium",
        "status": "initiated",
        "payment_status": "pending",
        "credited": False,
        "plan_id": plan["plan_id"],
        "metadata": metadata,
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    try:
        await db.payment_transactions.insert_one(tx_doc)
    except DuplicateKeyError:
        await db.payment_transactions.update_one(
            {"session_id": session.session_id},
            {"$set": tx_doc},
        )
    return {"ok": True, "checkout_url": session.url, "session_id": session.session_id, "plan": plan, "effective_price_eur": effective_price, "offer_id": offer_id}


@router.get("/premium/status/{session_id}")
async def dating_premium_checkout_status(session_id: str, request: Request):
    user = await get_me(request)
    return await _refresh_dating_premium_status(session_id, str(user["_id"]), request)


@router.post("/consumables/checkout")
async def dating_consumable_checkout(payload: DatingConsumableCheckoutReq, request: Request):
    user = await get_me(request)
    if not STRIPE_API_KEY:
        raise HTTPException(status_code=503, detail="Stripe nicht konfiguriert")
    item = DATING_CONSUMABLES.get(payload.item_id)
    if not item:
        raise HTTPException(status_code=400, detail="Ungültiges Produkt")

    origin = payload.origin_url.rstrip("/")
    success_url = f"{origin}/dating?premium_session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{origin}/dating?premium_cancelled=true"
    metadata = {
        "type": "dating_consumable",
        "item_id": item["item_id"],
        "user_id": str(user["_id"]),
        "user_email": user.get("email", ""),
    }
    host_url = str(request.base_url).rstrip("/")
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=f"{host_url}/api/webhook/stripe")
    checkout_req = CheckoutSessionRequest(
        amount=float(item["price_eur"]),
        currency=item["currency"],
        success_url=success_url,
        cancel_url=cancel_url,
        metadata=metadata,
        payment_methods=["card"],
    )
    session = await stripe_checkout.create_checkout_session(checkout_req)
    tx_doc = {
        "session_id": session.session_id,
        "user_id": str(user["_id"]),
        "user_email": user.get("email", ""),
        "amount": float(item["price_eur"]),
        "currency": item["currency"].upper(),
        "type": "dating_consumable",
        "status": "initiated",
        "payment_status": "pending",
        "credited": False,
        "item_id": item["item_id"],
        "metadata": metadata,
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    try:
        await db.payment_transactions.insert_one(tx_doc)
    except DuplicateKeyError:
        await db.payment_transactions.update_one({"session_id": session.session_id}, {"$set": tx_doc})
    return {"ok": True, "checkout_url": session.url, "session_id": session.session_id, "item": item}


@router.get("/monetization")
async def dating_monetization(request: Request):
    user = await get_me(request)
    profile = await get_or_create_my_profile(user)
    profile = await sync_profile_from_registration(user, profile)
    entitlements = _get_dating_entitlements(profile)
    payload = _pricing_payload_for_profile(profile)
    return {
        **payload,
        "entitlements": entitlements,
        "likes_you_count": await db.dating_swipes.count_documents({"to_user_id": profile["user_id"], "type": {"$in": ["like", "superlike"]}}),
        "profile_completion": calc_profile_completion(profile),
    }


@router.get("/top-picks")
async def dating_top_picks(request: Request):
    user = await get_me(request)
    me = await get_or_create_my_profile(user)
    filters = user.get("dating_filters") or {}
    pool = await _build_curated_pool(me, filters)
    pool.sort(key=lambda item: (_curation_score(me, item, filters), -item.get("rotation_rank", 0), item.get("discover_rank", 0)), reverse=True)
    entitlements = _get_dating_entitlements(me)
    items = []
    for index, profile in enumerate(pool[:8]):
        profile["pick_type"] = "top_pick"
        profile["headline"] = "Top Pick des Tages"
        profile["locked"] = index >= 1 and not (entitlements["is_gold"] or entitlements["is_platinum"] or me.get("premium"))
        profile["rotation_key"] = _rotation_seed_key(me)
        items.append(profile)
    return {"profiles": items, "free_visible": 1, "locked_count": max(0, len(items) - 1)}


@router.get("/standouts")
async def dating_standouts(request: Request):
    user = await get_me(request)
    me = await get_or_create_my_profile(user)
    filters = user.get("dating_filters") or {}
    pool = await _build_curated_pool(me, filters)
    pool.sort(key=lambda item: (_standout_score(me, item, filters), -item.get("rotation_rank", 0), item.get("compatibility_score", 0)), reverse=True)
    entitlements = _get_dating_entitlements(me)
    items = []
    for index, profile in enumerate(pool[:6]):
        profile["pick_type"] = "standout"
        profile["headline"] = "Standout"
        profile["locked"] = index >= 1 and not (entitlements["is_gold"] or entitlements["is_platinum"] or me.get("premium"))
        profile["requires_superlike"] = True
        profile["requires_rose"] = True
        profile["rotation_key"] = _rotation_seed_key(me)
        items.append(profile)
    return {"profiles": items, "free_visible": 1, "locked_count": max(0, len(items) - 1)}


@router.post("/safety/scan")
async def dating_safety_scan(payload: DatingSafetyScanReq, request: Request):
    user = await get_me(request)
    me = await get_or_create_my_profile(user)
    target_profile = me
    if payload.profile_id and payload.profile_id != me.get("profile_id"):
        target_profile = await db.dating_profiles.find_one({"profile_id": payload.profile_id}, {"_id": 0})
        if not target_profile:
            raise HTTPException(status_code=404, detail="Profil nicht gefunden")
    target_profile = await ensure_profile_safety(target_profile, force=payload.force)
    return {
        "ok": True,
        "profile_id": target_profile["profile_id"],
        "safety": target_profile.get("safety_summary") or _readable_safety_summary(target_profile.get("safety_scan")),
    }


@router.post("/verify/demo")
async def verify_demo(payload: VerifyReq, request: Request):
    user = await get_me(request)
    await db.users.update_one({"_id": user["_id"]}, {"$set": {"kyc_verified": True, "verified": True}})
    await db.dating_profiles.update_one(
        {"user_id": str(user["_id"])},
        {"$set": {"verified": True, "verification_selfie_url": payload.selfie_url, "verified_at": now_iso()}},
    )
    return {"ok": True, "verified": True}


@router.get("/swipes-left")
async def swipes_left(request: Request):
    user = await get_me(request)
    profile = await get_or_create_my_profile(user)
    entitlements = _get_dating_entitlements(profile)
    if profile.get("premium") or entitlements["is_plus"] or entitlements["is_gold"] or entitlements["is_platinum"]:
        return {"swipes_left": 999999, "premium": True, "entitlements": entitlements}
    used = await get_swipes_used_today(str(user["_id"]))
    return {"swipes_left": max(0, DAILY_FREE_SWIPES - used), "premium": False, "entitlements": entitlements}


@router.post("/boost/activate")
async def activate_boost(request: Request):
    user = await get_me(request)
    profile = await get_or_create_my_profile(user)
    entitlements = _get_dating_entitlements(profile)
    has_subscription_boost = bool(profile.get("premium") or entitlements["is_gold"] or entitlements["is_platinum"])
    if not has_subscription_boost and entitlements["boost_credits"] <= 0:
        raise HTTPException(status_code=403, detail="Boost braucht Gold/Platinum oder einen Boost-Pack")

    boost_state = get_boost_state(profile)
    if boost_state["is_active"]:
        return {"ok": True, "boost": boost_state, "already_active": True}
    if boost_state["cooldown_remaining_seconds"] > 0:
        raise HTTPException(status_code=400, detail="Boost ist gerade im Cooldown")

    now = datetime.now(timezone.utc)
    active_until = now + timedelta(minutes=BOOST_DURATION_MINUTES)
    updates = {
        "boost_activated_at": now.isoformat(),
        "boost_last_used_at": now.isoformat(),
        "boost_active_until": active_until.isoformat(),
    }
    if not has_subscription_boost:
        await db.dating_profiles.update_one({"user_id": str(user["_id"])}, {"$inc": {"credits.boosts": -1}, "$set": updates})
    else:
        await db.dating_profiles.update_one({"user_id": str(user["_id"])}, {"$set": updates})
    fresh = await db.dating_profiles.find_one({"user_id": str(user["_id"])}, {"_id": 0})
    return {
        "ok": True,
        "boost": get_boost_state(fresh),
        "message": f"Boost für {BOOST_DURATION_MINUTES} Minuten aktiviert",
        "credits": (fresh.get("credits") or {}),
    }


@router.post("/ai/bio")
async def generate_ai_bio(payload: DatingAiPromptReq, request: Request):
    user = await get_me(request)
    profile = await get_or_create_my_profile(user)
    context = _build_profile_context(profile)
    extra = payload.prompt.strip() if payload.prompt else ""
    prompt = (
        "Erstelle 3 kurze, starke Dating-Bios auf Deutsch. Jede Variante maximal 220 Zeichen. "
        "Klar, sympathisch, marktstark, natürlich. Keine Nummerierung mit langen Sätzen.\n\n"
        f"Profilkontext:\n{context}\n\n"
        f"Zusatzwunsch: {extra or 'Kein Zusatzwunsch.'}"
    )
    result = await _run_dating_ai(str(user["_id"]), "bio", prompt)
    suggestions = [line.strip("-• ").strip() for line in result.splitlines() if line.strip()]
    return {"ok": True, "suggestions": suggestions[:3], "text": result}


@router.post("/ai/profile-coach")
async def generate_profile_coach(payload: DatingAiPromptReq, request: Request):
    user = await get_me(request)
    profile = await get_or_create_my_profile(user)
    context = _build_profile_context(profile)
    extra = payload.prompt.strip() if payload.prompt else ""
    prompt = (
        "Analysiere dieses Dating-Profil wie ein Top-Profile-Coach. "
        "Liefere genau 5 konkrete Verbesserungen auf Deutsch. Jede Empfehlung kurz, direkt und umsetzbar.\n\n"
        f"Profilkontext:\n{context}\n\n"
        f"Zusatzfokus: {extra or 'Mehr Matches und bessere Qualität.'}"
    )
    result = await _run_dating_ai(str(user["_id"]), "coach", prompt)
    tips = [line.strip("-• ").strip() for line in result.splitlines() if line.strip()]
    return {"ok": True, "tips": tips[:5], "text": result}


@router.post("/ai/icebreakers")
async def generate_icebreakers(payload: DatingAiPromptReq, request: Request):
    user = await get_me(request)
    my_profile = await get_or_create_my_profile(user)
    if not payload.match_id:
        raise HTTPException(status_code=400, detail="match_id fehlt")
    match = await db.dating_matches.find_one({"match_id": payload.match_id, "participant_ids": str(user["_id"])}, {"_id": 0})
    if not match:
        raise HTTPException(status_code=404, detail="Match nicht gefunden")
    other_profile_id = next((pid for pid in match.get("participant_profiles", []) if pid != my_profile["profile_id"]), None)
    other_profile = await db.dating_profiles.find_one({"profile_id": other_profile_id}, {"_id": 0}) if other_profile_id else None
    if not other_profile:
        raise HTTPException(status_code=404, detail="Gegenprofil nicht gefunden")
    prompt = (
        "Erstelle 5 starke erste Nachrichten auf Deutsch für ein Dating-Match. "
        "Nicht cringe, nicht generisch, locker und respektvoll. Jede Nachricht nur 1 Satz.\n\n"
        f"Mein Profil:\n{_build_profile_context(my_profile)}\n\n"
        f"Match-Profil:\n{_build_profile_context(other_profile)}\n\n"
        f"Zusatzwunsch: {payload.prompt.strip() if payload.prompt else 'Natürlich und charmant.'}"
    )
    result = await _run_dating_ai(str(user["_id"]), "icebreakers", prompt)
    icebreakers = [line.strip("-• ").strip() for line in result.splitlines() if line.strip()]
    return {"ok": True, "icebreakers": icebreakers[:5], "text": result}


@router.post("/voice-intro")
async def upload_voice_intro(request: Request, file: UploadFile = File(...), duration_seconds: int = Form(...)):
    user = await get_me(request)
    profile = await get_or_create_my_profile(user)
    content_type = file.content_type or "application/octet-stream"
    if content_type not in ALLOWED_AUDIO_TYPES:
        raise HTTPException(status_code=400, detail="Audioformat nicht unterstützt")
    if duration_seconds < 1 or duration_seconds > VOICE_INTRO_MAX_SECONDS:
        raise HTTPException(status_code=400, detail=f"Voice Intro muss zwischen 1 und {VOICE_INTRO_MAX_SECONDS} Sekunden liegen")

    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="Leere Audiodatei")
    if len(raw) > VOICE_INTRO_MAX_BYTES:
        raise HTTPException(status_code=400, detail="Audiodatei zu groß")

    ext = resolve_audio_extension(file.filename, content_type)
    media_id = build_media_id()
    path = f"{APP_STORAGE_PREFIX}/voice-intros/{profile['user_id']}/{uuid.uuid4()}.{ext}"
    try:
        result = await asyncio.to_thread(_put_object_sync, path, raw, content_type)
    except Exception as exc:
        logger.error(f"Voice intro upload fehlgeschlagen: {exc}")
        raise HTTPException(status_code=502, detail="Voice Intro Upload fehlgeschlagen")

    voice_intro = {
        "media_id": media_id,
        "storage_path": result["path"],
        "content_type": content_type,
        "original_filename": file.filename or f"voice-intro.{ext}",
        "size_bytes": len(raw),
        "duration_seconds": duration_seconds,
        "created_at": now_iso(),
        "is_deleted": False,
    }
    await db.dating_media.update_one(
        {"owner_user_id": profile["user_id"], "kind": "voice_intro", "is_deleted": False},
        {"$set": {"is_deleted": True, "replaced_at": now_iso()}},
    )
    await db.dating_media.insert_one({
        "media_id": media_id,
        "owner_user_id": profile["user_id"],
        "profile_id": profile["profile_id"],
        "kind": "voice_intro",
        **voice_intro,
    })
    await db.dating_profiles.update_one(
        {"user_id": profile["user_id"]},
        {"$set": {"voice_intro": {k: v for k, v in voice_intro.items() if k != "storage_path"}}},
    )
    return {"ok": True, "voice_intro": {k: v for k, v in voice_intro.items() if k != "storage_path"}}


@router.delete("/voice-intro")
async def delete_voice_intro(payload: VoiceIntroDeleteReq, request: Request):
    user = await get_me(request)
    profile = await get_or_create_my_profile(user)
    query = {"owner_user_id": profile["user_id"], "kind": "voice_intro", "is_deleted": False}
    if payload.media_id:
        query["media_id"] = payload.media_id
    media = await db.dating_media.find_one(query, {"_id": 0})
    if not media:
        raise HTTPException(status_code=404, detail="Voice Intro nicht gefunden")
    await db.dating_media.update_one({"media_id": media["media_id"]}, {"$set": {"is_deleted": True, "deleted_at": now_iso()}})
    await db.dating_profiles.update_one({"user_id": profile["user_id"]}, {"$unset": {"voice_intro": ""}})
    return {"ok": True}


@router.get("/voice-intro/{media_id}")
async def stream_voice_intro(media_id: str, request: Request):
    await get_me(request)
    media = await db.dating_media.find_one({"media_id": media_id, "kind": "voice_intro", "is_deleted": False}, {"_id": 0})
    if not media:
        raise HTTPException(status_code=404, detail="Voice Intro nicht gefunden")
    try:
        blob, content_type = await asyncio.to_thread(_get_object_sync, media["storage_path"])
    except Exception as exc:
        logger.error(f"Voice intro download fehlgeschlagen: {exc}")
        raise HTTPException(status_code=502, detail="Voice Intro konnte nicht geladen werden")
    return Response(content=blob, media_type=media.get("content_type") or content_type)


@router.post("/video-profile")
async def upload_video_profile(request: Request, file: UploadFile = File(...), duration_seconds: int = Form(...)):
    user = await get_me(request)
    profile = await get_or_create_my_profile(user)
    content_type = file.content_type or "application/octet-stream"
    if content_type not in ALLOWED_VIDEO_TYPES:
        raise HTTPException(status_code=400, detail="Videoformat nicht unterstützt")
    if duration_seconds < 1 or duration_seconds > VIDEO_PROFILE_MAX_SECONDS:
        raise HTTPException(status_code=400, detail=f"Video-Profil muss zwischen 1 und {VIDEO_PROFILE_MAX_SECONDS} Sekunden liegen")

    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="Leere Videodatei")
    if len(raw) > VIDEO_PROFILE_MAX_BYTES:
        raise HTTPException(status_code=400, detail="Videodatei zu groß")

    ext = resolve_video_extension(file.filename, content_type)
    media_id = build_media_id()
    path = f"{APP_STORAGE_PREFIX}/video-profiles/{profile['user_id']}/{uuid.uuid4()}.{ext}"
    try:
        result = await asyncio.to_thread(_put_object_sync, path, raw, content_type)
    except Exception as exc:
        logger.error(f"Video profile upload fehlgeschlagen: {exc}")
        raise HTTPException(status_code=502, detail="Video-Profil Upload fehlgeschlagen")

    video_profile = {
        "media_id": media_id,
        "storage_path": result["path"],
        "content_type": content_type,
        "original_filename": file.filename or f"video-profile.{ext}",
        "size_bytes": len(raw),
        "duration_seconds": duration_seconds,
        "created_at": now_iso(),
        "is_deleted": False,
    }
    await db.dating_media.update_one(
        {"owner_user_id": profile["user_id"], "kind": "video_profile", "is_deleted": False},
        {"$set": {"is_deleted": True, "replaced_at": now_iso()}},
    )
    await db.dating_media.insert_one({
        "media_id": media_id,
        "owner_user_id": profile["user_id"],
        "profile_id": profile["profile_id"],
        "kind": "video_profile",
        **video_profile,
    })
    await db.dating_profiles.update_one(
        {"user_id": profile["user_id"]},
        {"$set": {"video_profile": {k: v for k, v in video_profile.items() if k != "storage_path"}}},
    )
    return {"ok": True, "video_profile": {k: v for k, v in video_profile.items() if k != "storage_path"}}


@router.delete("/video-profile")
async def delete_video_profile(payload: VoiceIntroDeleteReq, request: Request):
    user = await get_me(request)
    profile = await get_or_create_my_profile(user)
    query = {"owner_user_id": profile["user_id"], "kind": "video_profile", "is_deleted": False}
    if payload.media_id:
        query["media_id"] = payload.media_id
    media = await db.dating_media.find_one(query, {"_id": 0})
    if not media:
        raise HTTPException(status_code=404, detail="Video-Profil nicht gefunden")
    await db.dating_media.update_one({"media_id": media["media_id"]}, {"$set": {"is_deleted": True, "deleted_at": now_iso()}})
    await db.dating_profiles.update_one({"user_id": profile["user_id"]}, {"$unset": {"video_profile": ""}})
    return {"ok": True}


@router.get("/video-profile/{media_id}")
async def stream_video_profile(media_id: str, request: Request):
    await get_me(request)
    media = await db.dating_media.find_one({"media_id": media_id, "kind": "video_profile", "is_deleted": False}, {"_id": 0})
    if not media:
        raise HTTPException(status_code=404, detail="Video-Profil nicht gefunden")
    try:
        blob, content_type = await asyncio.to_thread(_get_object_sync, media["storage_path"])
    except Exception as exc:
        logger.error(f"Video profile download fehlgeschlagen: {exc}")
        raise HTTPException(status_code=502, detail="Video-Profil konnte nicht geladen werden")
    return Response(content=blob, media_type=media.get("content_type") or content_type)


@router.post("/location")
async def update_my_location(payload: DatingLocationUpdateReq, request: Request):
    user = await get_me(request)
    my_profile = await get_or_create_my_profile(user)
    now = now_iso()
    await db.dating_profiles.update_one(
        {"user_id": str(user["_id"])},
        {
            "$set": {
                "last_location_lat": payload.lat,
                "last_location_lng": payload.lng,
                "last_location_accuracy_m": payload.accuracy_m,
                "last_location_at": now,
                "last_active_at": now,
            }
        },
    )
    others = await db.dating_profiles.find(
        {
            "active": True,
            "user_id": {"$ne": my_profile["user_id"]},
            "last_location_at": {"$exists": True},
        },
        {"_id": 0},
    ).to_list(120)
    crossed_updates = 0
    for other in others:
        distance_km = extract_distance_km({**my_profile, "last_location_lat": payload.lat, "last_location_lng": payload.lng}, other)
        if distance_km is not None and distance_km <= CROSSED_PATHS_RADIUS_KM:
            await upsert_crossed_path(my_profile, other, distance_km)
            crossed_updates += 1
    return {"ok": True, "location_updated": True, "crossed_updates": crossed_updates}


@router.get("/nearby")
async def get_nearby_profiles(request: Request, radius_km: float = NEARBY_DEFAULT_RADIUS_KM):
    user = await get_me(request)
    my_profile = await get_or_create_my_profile(user)
    if not is_location_fresh(my_profile):
        return {"nearby_enabled": False, "profiles": [], "radius_km": radius_km, "message": "Standort fehlt oder ist veraltet"}
    blocked_by_me = await db.dating_blocks.find({"blocker_user_id": my_profile["user_id"]}, {"_id": 0, "blocked_user_id": 1}).to_list(500)
    blockers = await db.dating_blocks.find({"blocked_user_id": my_profile["user_id"]}, {"_id": 0, "blocker_user_id": 1}).to_list(500)
    blocked_ids = [item["blocked_user_id"] for item in blocked_by_me]
    blocker_ids = [item["blocker_user_id"] for item in blockers]
    candidates = await db.dating_profiles.find(
        {
            "active": True,
            "user_id": {"$ne": my_profile["user_id"], "$nin": blocked_ids + blocker_ids},
            "last_location_at": {"$exists": True},
        },
        {"_id": 0},
    ).to_list(100)
    results = []
    for profile in candidates:
        if not is_location_fresh(profile):
            continue
        distance_km = extract_distance_km(my_profile, profile)
        if distance_km is None or distance_km > radius_km:
            continue
        profile["distance_km"] = distance_km
        profile["compatibility_score"] = calc_compatibility_score(my_profile, profile, user.get("dating_filters") or {})
        profile["profile_completion"] = calc_profile_completion(profile)
        profile["boost"] = get_boost_state(profile)
        profile["spotlight"] = bool(profile["boost"]["is_active"])
        await maybe_attach_safety(profile)
        profile["match_reasons"] = build_match_reasons(my_profile, profile, user.get("dating_filters") or {})
        profile["discover_rank"] = calc_discover_rank(profile)
        results.append(profile)
    results.sort(key=lambda item: (item.get("distance_km", 999), -item.get("compatibility_score", 0)))
    return {"nearby_enabled": True, "profiles": results[:24], "radius_km": radius_km}


@router.get("/crossed-paths")
async def get_crossed_paths(request: Request):
    user = await get_me(request)
    my_profile = await get_or_create_my_profile(user)
    rows = await db.dating_crossed_paths.find({"participant_ids": my_profile["user_id"]}, {"_id": 0}).sort("last_crossed_at", -1).to_list(40)
    items = []
    for row in rows:
        other_profile_id = next((pid for pid in row.get("participant_profiles", []) if pid != my_profile["profile_id"]), None)
        if not other_profile_id:
            continue
        profile = await db.dating_profiles.find_one({"profile_id": other_profile_id}, {"_id": 0})
        if not profile:
            continue
        profile["cross_count"] = row.get("cross_count", 1)
        profile["last_crossed_at"] = row.get("last_crossed_at")
        profile["last_distance_km"] = row.get("last_distance_km")
        profile["boost"] = get_boost_state(profile)
        profile["spotlight"] = bool(profile["boost"]["is_active"])
        await maybe_attach_safety(profile)
        profile["match_reasons"] = build_match_reasons(my_profile, profile, user.get("dating_filters") or {})
        items.append(profile)
    return {"profiles": items}


@router.get("/discover")
async def discover(request: Request):
    user = await get_me(request)
    my_profile = await get_or_create_my_profile(user)
    await db.dating_profiles.update_one({"user_id": my_profile["user_id"]}, {"$set": {"last_active_at": now_iso()}})
    await maybe_seed_demo_like(my_profile)
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
    if not profiles:
        fallback_query = {
            "active": True,
            "profile_id": {"$nin": seen_ids},
            "user_id": {"$ne": my_user_id, "$nin": blocked_ids + blocker_ids},
        }
        if my_filters.get("seeking"):
            fallback_query["gender"] = {"$in": my_filters["seeking"]}
        profiles = await db.dating_profiles.find(fallback_query, {"_id": 0}).sort("last_active_at", -1).to_list(40)
    for profile in profiles:
        profile["distance_km"] = extract_distance_km(my_profile, profile)
        profile["compatibility_score"] = calc_compatibility_score(my_profile, profile, my_filters)
        profile["profile_completion"] = calc_profile_completion(profile)
        profile["is_recently_active"] = True
        profile["boost"] = get_boost_state(profile)
        profile["spotlight"] = bool(profile["boost"]["is_active"])
        await maybe_attach_safety(profile)
        profile["match_reasons"] = build_match_reasons(my_profile, profile, my_filters)
        profile["discover_rank"] = calc_discover_rank(profile)
        if profile.get("voice_intro"):
            profile["voice_intro"]["stream_url"] = f"/api/dating/voice-intro/{profile['voice_intro']['media_id']}"
        if profile.get("video_profile"):
            profile["video_profile"]["stream_url"] = f"/api/dating/video-profile/{profile['video_profile']['media_id']}"
    profiles.sort(
        key=lambda item: (
            item.get("discover_rank", 0),
            item.get("compatibility_score", 0),
            item.get("verified", False),
            item.get("last_active_at", ""),
        ),
        reverse=True,
    )
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
    entitlements = _get_dating_entitlements(my_profile)
    if req.use_rose and entitlements["rose_credits"] <= 0:
        raise HTTPException(status_code=402, detail="Rose braucht ein Rose-Pack oder Platinum-Credits")
    if req.super_like and not my_profile.get("premium") and entitlements["superlike_credits"] <= 0:
        raise HTTPException(status_code=402, detail="Super Like braucht Gold/Platinum oder ein Super-Like-Pack")
    if not my_profile.get("premium") and not entitlements["is_plus"] and not entitlements["is_gold"] and not entitlements["is_platinum"]:
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
    if req.use_rose:
        swipe_doc["type"] = "rose"
        swipe_doc["priority_inbox"] = True
    if req.opener_text and req.opener_text.strip():
        if not entitlements["is_platinum"]:
            raise HTTPException(status_code=403, detail="Message-before-match ist nur für Platinum verfügbar")
        swipe_doc["opener_text"] = req.opener_text.strip()
    await db.dating_swipes.insert_one(swipe_doc)
    if req.use_rose and entitlements["rose_credits"] > 0:
        await db.dating_profiles.update_one({"user_id": my_user_id}, {"$inc": {"credits.roses": -1}})
    if req.super_like and not my_profile.get("premium") and entitlements["superlike_credits"] > 0:
        await db.dating_profiles.update_one({"user_id": my_user_id}, {"$inc": {"credits.superlikes": -1}})
    await db.dating_profiles.update_one({"profile_id": req.profile_id}, {"$inc": {"likes_count": 1}})

    if target.get("is_seed"):
        reciprocal = {
            "from_user_id": target["user_id"],
            "to_user_id": my_user_id,
            "from_profile_id": target["profile_id"],
            "to_profile_id": my_profile["profile_id"],
            "type": "like",
            "created_at": now_iso(),
            "swipe_reset_key": swipe_reset_key(),
            "is_seed": True,
        }
        await db.dating_swipes.update_one(
            {"from_user_id": target["user_id"], "to_user_id": my_user_id},
            {"$setOnInsert": reciprocal},
            upsert=True,
        )

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
                "priority_match": bool(entitlements["priority_likes"] or req.super_like or req.use_rose),
                "opener_text": swipe_doc.get("opener_text", ""),
                "priority_inbox": bool(req.use_rose),
            }
            await db.dating_matches.insert_one(match_doc)
            if swipe_doc.get("opener_text"):
                opener_message = {
                    "message_id": build_message_id(),
                    "match_id": match_doc["match_id"],
                    "sender_user_id": my_user_id,
                    "sender_profile_id": my_profile["profile_id"],
                    "text": swipe_doc["opener_text"],
                    "created_at": now_iso(),
                    "auto_seeded_opener": True,
                    "safety": _analyze_chat_text_safety(swipe_doc["opener_text"]),
                }
                await db.dating_messages.insert_one(opener_message)
                match_doc["last_message"] = opener_message["text"]
                match_doc["last_message_at"] = opener_message["created_at"]
                match_doc["unread"] = {my_user_id: 0, target["user_id"]: 1}
                await db.dating_matches.update_one(
                    {"match_id": match_doc["match_id"]},
                    {"$set": {"last_message": opener_message["text"], "last_message_at": opener_message["created_at"], f"unread.{target['user_id']}": 1}},
                )
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


@router.post("/rewind")
async def rewind_last_swipe(request: Request):
    user = await get_me(request)
    my_profile = await get_or_create_my_profile(user)
    my_user_id = my_profile["user_id"]
    entitlements = _get_dating_entitlements(my_profile)
    if not my_profile.get("premium") and entitlements["daily_rewind_limit"] == 0 and entitlements["rewind_credits"] <= 0:
        raise HTTPException(status_code=402, detail="Rewind braucht Plus/Gold/Platinum oder ein Rewind-Pack")
    last_swipe = await db.dating_swipes.find({"from_user_id": my_user_id}, {"_id": 0}).sort("created_at", -1).limit(1).to_list(1)
    if not last_swipe:
        raise HTTPException(status_code=404, detail="Kein Swipe zum Zurücknehmen")
    swipe = last_swipe[0]
    target = await db.dating_profiles.find_one({"profile_id": swipe["to_profile_id"]}, {"_id": 0})
    await db.dating_swipes.delete_one({"from_user_id": my_user_id, "to_profile_id": swipe["to_profile_id"]})
    if not my_profile.get("premium") and entitlements["daily_rewind_limit"] == 0 and entitlements["rewind_credits"] > 0:
        await db.dating_profiles.update_one({"user_id": my_user_id}, {"$inc": {"credits.rewinds": -1}})
    if target:
        key = pair_key(my_user_id, target["user_id"])
        match = await db.dating_matches.find_one({"pair_key": key}, {"_id": 0})
        if match:
            await db.dating_matches.delete_one({"pair_key": key})
            await db.dating_messages.delete_many({"match_id": match["match_id"]})
        if target.get("is_seed"):
            await db.dating_swipes.delete_many({"from_user_id": target["user_id"], "to_user_id": my_user_id, "is_seed": True})
        target["compatibility_score"] = calc_compatibility_score(my_profile, target, user.get("dating_filters") or {})
        target["profile_completion"] = calc_profile_completion(target)
        target["boost"] = get_boost_state(target)
        target["spotlight"] = bool(target["boost"]["is_active"])
        return {"ok": True, "profile": target}
    raise HTTPException(status_code=404, detail="Profil nicht gefunden")


@router.get("/matches")
async def get_matches(request: Request):
    user = await get_me(request)
    my_profile = await get_or_create_my_profile(user)
    my_user_id = str(user["_id"])
    matches = await db.dating_matches.find({"participant_ids": my_user_id, "blocked": {"$ne": True}}, {"_id": 0}).sort("matched_at", -1).to_list(100)
    result = []
    for match in matches:
        other_profile_id = next((pid for pid in match.get("participant_profiles", []) if pid != my_profile["profile_id"]), None)
        if not other_profile_id:
            continue
        profile = await db.dating_profiles.find_one({"profile_id": other_profile_id}, {"_id": 0})
        if not profile:
            continue
        profile["match_id"] = match["match_id"]
        profile["last_message"] = match.get("last_message", "")
        profile["last_message_at"] = match.get("last_message_at")
        profile["unread_count"] = (match.get("unread") or {}).get(my_user_id, 0)
        profile["chat_safety_summary"] = match.get("chat_safety_summary") or {
            "score": 0,
            "level": "low",
            "flags": [],
            "warning": "",
            "status": "clear",
            "flagged_count": 0,
            "latest_flagged_message": None,
        }
        profile["boost"] = get_boost_state(profile)
        profile["spotlight"] = bool(profile["boost"]["is_active"])
        await maybe_attach_safety(profile)
        profile["match_reasons"] = build_match_reasons(my_profile, profile, user.get("dating_filters") or {})
        if profile.get("voice_intro"):
            profile["voice_intro"]["stream_url"] = f"/api/dating/voice-intro/{profile['voice_intro']['media_id']}"
        if profile.get("video_profile"):
            profile["video_profile"]["stream_url"] = f"/api/dating/video-profile/{profile['video_profile']['media_id']}"
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
    summary = match.get("chat_safety_summary") or await refresh_match_chat_safety(match_id)
    return {"messages": messages, "match": match, "read_at": now_iso(), "chat_safety_summary": summary}


@router.post("/matches/{match_id}/messages")
async def send_message(match_id: str, payload: ChatMessageReq, request: Request):
    user = await get_me(request)
    my_user_id = str(user["_id"])
    my_profile = await get_or_create_my_profile(user)
    match = await db.dating_matches.find_one({"match_id": match_id, "participant_ids": my_user_id, "blocked": {"$ne": True}})
    if not match:
        raise HTTPException(status_code=404, detail="Match nicht gefunden")
    other_user_id = next(uid for uid in match["participant_ids"] if uid != my_user_id)
    preflight = _analyze_chat_text_safety(payload.text)
    if not preflight["safe_to_send"]:
        raise HTTPException(status_code=400, detail=preflight["warning"] or "Nachricht blockiert")
    message = {
        "message_id": build_message_id(),
        "match_id": match_id,
        "sender_user_id": my_user_id,
        "sender_profile_id": my_profile["profile_id"],
        "text": payload.text.strip(),
        "created_at": now_iso(),
        "safety": {k: v for k, v in preflight.items() if k != "safe_to_send"},
    }
    await db.dating_messages.insert_one(message)
    post_summary = await refresh_match_chat_safety(match_id)
    await db.dating_matches.update_one(
        {"match_id": match_id},
        {
            "$set": {"last_message": message["text"], "last_message_at": message["created_at"], "last_message_sender_user_id": my_user_id, "chat_safety_summary": post_summary},
            "$inc": {f"unread.{other_user_id}": 1},
        },
    )
    return {"ok": True, "message": sanitize_doc(message), "chat_safety_preflight": preflight, "chat_safety_summary": post_summary}


@router.post("/matches/{match_id}/chat-safety")
async def get_chat_safety(match_id: str, payload: DatingChatSafetyReq, request: Request):
    user = await get_me(request)
    my_user_id = str(user["_id"])
    if payload.match_id != match_id:
        raise HTTPException(status_code=400, detail="match_id passt nicht")
    match = await db.dating_matches.find_one({"match_id": match_id, "participant_ids": my_user_id}, {"_id": 0})
    if not match:
        raise HTTPException(status_code=404, detail="Match nicht gefunden")
    summary = await refresh_match_chat_safety(match_id) if payload.force or not match.get("chat_safety_summary") else match.get("chat_safety_summary")
    return {"ok": True, "match_id": match_id, "chat_safety_summary": summary}


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
    inbound = await db.dating_swipes.find({"to_user_id": me["user_id"], "type": {"$in": ["like", "superlike"]}}, {"_id": 0, "from_profile_id": 1, "type": 1, "created_at": 1}).sort("created_at", -1).to_list(100)
    count = len(inbound)
    entitlements = _get_dating_entitlements(me)
    if not me.get("premium") and not entitlements["can_see_likes_you"]:
        return {"locked": True, "profiles": [], "count": count}
    profile_ids = [item["from_profile_id"] for item in inbound]
    profiles = await db.dating_profiles.find({"profile_id": {"$in": profile_ids}}, {"_id": 0}).to_list(100)
    meta_by_id = {item["from_profile_id"]: item for item in inbound}
    for profile in profiles:
        meta = meta_by_id.get(profile["profile_id"], {})
        profile["incoming_type"] = meta.get("type", "like")
        profile["incoming_at"] = meta.get("created_at")
        profile["priority_inbox"] = bool(meta.get("priority_inbox") or meta.get("type") == "rose")
        profile["profile_completion"] = calc_profile_completion(profile)
        profile["boost"] = get_boost_state(profile)
        profile["spotlight"] = bool(profile["boost"]["is_active"])
        await maybe_attach_safety(profile)
        profile["match_reasons"] = build_match_reasons(me, profile, user.get("dating_filters") or {})
        if profile.get("voice_intro"):
            profile["voice_intro"]["stream_url"] = f"/api/dating/voice-intro/{profile['voice_intro']['media_id']}"
        if profile.get("video_profile"):
            profile["video_profile"]["stream_url"] = f"/api/dating/video-profile/{profile['video_profile']['media_id']}"
    profiles.sort(key=lambda item: (item.get("priority_inbox", False), item.get("incoming_at", "")), reverse=True)
    return {"locked": False, "profiles": profiles, "count": count}