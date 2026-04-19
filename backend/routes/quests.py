"""
Daily Quests System — 3 zufällige Aufgaben pro Tag
Fortschritt wird event-basiert getrackt (taxi_ride, spin_wheel, classified_create, login, referral, etc.)
"""
from datetime import datetime, timezone, timedelta
from typing import Optional
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from bson import ObjectId
import random
import secrets

from core.database import db
from core.security import get_current_user

router = APIRouter(prefix="/api/quests", tags=["quests"])


# ═══════════════════════════════════════════════════════════
# QUEST DEFINITIONS
# ═══════════════════════════════════════════════════════════

# trigger_event = welches Event den Fortschritt hochzählt (in metadata.log_event)
QUEST_TEMPLATES = [
    {"id": "daily_login",     "title": "Einloggen",             "desc": "Öffne die App heute",                      "reward_blz": 5,  "target": 1, "event": "login"},
    {"id": "daily_spin",      "title": "Glücksrad drehen",      "desc": "Drehe heute einmal das Glücksrad",         "reward_blz": 10, "target": 1, "event": "spin_wheel"},
    {"id": "daily_classified","title": "Kleinanzeige posten",   "desc": "Erstelle eine Kleinanzeige",               "reward_blz": 25, "target": 1, "event": "classified_create"},
    {"id": "daily_referral",  "title": "Freund einladen",       "desc": "Teile deinen Empfehlungs-Link",            "reward_blz": 15, "target": 1, "event": "referral_share"},
    {"id": "daily_shop",      "title": "Marketplace erkunden",  "desc": "Schaue dir 3 Marketplace-Angebote an",      "reward_blz": 8,  "target": 3, "event": "marketplace_view"},
    {"id": "daily_taxi",      "title": "Taxi-Preis prüfen",     "desc": "Berechne 1× einen Taxi-Preis",             "reward_blz": 12, "target": 1, "event": "taxi_estimate"},
    {"id": "daily_mine",      "title": "5× BLZ minen",          "desc": "Tippe 5× im BlitzMine-Modul",              "reward_blz": 10, "target": 5, "event": "mine_tap"},
    {"id": "daily_notif",     "title": "Benachrichtigung lesen","desc": "Öffne deine Benachrichtigungen",           "reward_blz": 3,  "target": 1, "event": "notification_read"},
    {"id": "daily_auction",   "title": "Auktion ansehen",       "desc": "Schaue dir eine Auktion an",               "reward_blz": 8,  "target": 1, "event": "auction_view"},
    {"id": "daily_profile",   "title": "Profil aktualisieren",  "desc": "Aktualisiere dein Profil oder Einstellungen","reward_blz": 5,  "target": 1, "event": "profile_update"},
]


def _today():
    return datetime.now(timezone.utc).date().isoformat()


def _oid(s):
    try: return ObjectId(s)
    except Exception: return s


async def _ensure_today_quests(user_id: str) -> dict:
    """Erstellt (wenn nicht vorhanden) 3 Quests für heute."""
    day = _today()
    existing = await db.user_quests.find_one({"user_id": user_id, "date": day})
    if existing:
        existing.pop("_id", None)
        return existing

    # Pick 3 random quests (always include daily_login as first)
    pool = [q for q in QUEST_TEMPLATES if q["id"] != "daily_login"]
    picked = [QUEST_TEMPLATES[0]] + random.sample(pool, k=2)
    quests = [{
        **q,
        "progress": 0,
        "completed": False,
        "claimed": False,
        "started_at": datetime.now(timezone.utc).isoformat(),
    } for q in picked]

    doc = {
        "user_id": user_id,
        "date": day,
        "quests": quests,
        "all_claimed": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.user_quests.insert_one(doc)
    doc.pop("_id", None)
    return doc


# Public helper to be called from other modules
async def track_event(user_id: str, event: str, amount: int = 1):
    """Advance progress on any active quest matching this event."""
    if not user_id:
        return
    day = _today()
    doc = await db.user_quests.find_one({"user_id": user_id, "date": day})
    if not doc:
        return
    dirty = False
    for q in doc["quests"]:
        if q.get("event") == event and not q.get("completed"):
            q["progress"] = min(q.get("target", 1), q.get("progress", 0) + amount)
            if q["progress"] >= q.get("target", 1):
                q["completed"] = True
                q["completed_at"] = datetime.now(timezone.utc).isoformat()
            dirty = True
    if dirty:
        await db.user_quests.update_one(
            {"_id": doc["_id"]},
            {"$set": {"quests": doc["quests"]}},
        )


# ═══════════════════════════════════════════════════════════
# ROUTES
# ═══════════════════════════════════════════════════════════

@router.get("/today")
async def get_today_quests(request: Request):
    user = await get_current_user(request)
    uid = str(user.get("_id") or user.get("id"))
    doc = await _ensure_today_quests(uid)
    # Auto-track login event (first time opening today)
    await track_event(uid, "login", 1)
    # Reload after tracking
    doc = await db.user_quests.find_one({"user_id": uid, "date": _today()}, {"_id": 0})
    # Calculate total rewards
    total_blz = sum(q.get("reward_blz", 0) for q in doc["quests"])
    claimed_blz = sum(q.get("reward_blz", 0) for q in doc["quests"] if q.get("claimed"))
    completed_count = sum(1 for q in doc["quests"] if q.get("completed"))
    # Next reset
    now = datetime.now(timezone.utc)
    next_reset = (now.replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(days=1)).isoformat()
    return {
        **doc,
        "total_reward_blz": total_blz,
        "claimed_blz": claimed_blz,
        "completed_count": completed_count,
        "next_reset": next_reset,
    }


class TrackRequest(BaseModel):
    event: str
    amount: int = 1


@router.post("/track")
async def track(req: TrackRequest, request: Request):
    """Client-side tracking endpoint (for events that have no server hook yet)."""
    user = await get_current_user(request)
    uid = str(user.get("_id") or user.get("id"))
    await track_event(uid, req.event, req.amount)
    return {"ok": True}


@router.post("/claim/{quest_id}")
async def claim_quest(quest_id: str, request: Request):
    user = await get_current_user(request)
    uid = str(user.get("_id") or user.get("id"))
    day = _today()
    doc = await db.user_quests.find_one({"user_id": uid, "date": day})
    if not doc:
        raise HTTPException(404, "Keine Quests heute")
    q = next((x for x in doc["quests"] if x["id"] == quest_id), None)
    if not q:
        raise HTTPException(404, "Quest nicht gefunden")
    if not q.get("completed"):
        raise HTTPException(400, "Quest noch nicht erledigt")
    if q.get("claimed"):
        raise HTTPException(400, "Belohnung bereits abgeholt")

    reward = int(q.get("reward_blz", 0) or 0)
    q["claimed"] = True
    q["claimed_at"] = datetime.now(timezone.utc).isoformat()
    await db.users.update_one({"_id": _oid(uid)}, {"$inc": {"balance_blz": reward}})
    await db.user_quests.update_one({"_id": doc["_id"]}, {"$set": {"quests": doc["quests"]}})

    now = datetime.now(timezone.utc).isoformat()
    await db.transactions.insert_one({
        "user_id": uid, "type": "bonus",
        "amount": reward, "currency": "BLZ",
        "status": "completed", "description": f"Quest: {q['title']}",
        "merchant_name": "BidBlitz", "category": "quest",
        "reference": f"QUEST-{quest_id}-{day}",
        "date": now, "created_at": now,
    })

    # Check all_claimed bonus (+20 BLZ extra for completing all 3)
    all_claimed = all(qq.get("claimed") for qq in doc["quests"])
    bonus = 0
    if all_claimed and not doc.get("all_claimed"):
        bonus = 20
        await db.users.update_one({"_id": _oid(uid)}, {"$inc": {"balance_blz": bonus}})
        await db.user_quests.update_one({"_id": doc["_id"]}, {"$set": {"all_claimed": True, "all_claimed_at": now}})
        await db.transactions.insert_one({
            "user_id": uid, "type": "bonus", "amount": bonus, "currency": "BLZ",
            "status": "completed", "description": "🏆 Alle Quests erledigt (Bonus)",
            "merchant_name": "BidBlitz", "category": "quest_bonus",
            "reference": f"QUEST-ALL-{day}",
            "date": now, "created_at": now,
        })

    return {"ok": True, "reward": reward, "all_claimed_bonus": bonus}
