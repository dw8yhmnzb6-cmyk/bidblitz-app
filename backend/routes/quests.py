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
import hashlib

from core.database import db
from core.config import TEST_MODE
from core.security import get_current_user

router = APIRouter(prefix="/api/quests", tags=["quests"])


async def _credit_quest_blz_once(
    user_id: str,
    amount: float,
    reward_key: str,
    description: str,
    category: str,
) -> dict:
    amount = round(float(amount or 0), 4)
    if amount <= 0:
        return {"transaction_id": None, "replayed": True}

    digest = hashlib.sha256(reward_key.encode("utf-8")).hexdigest()[:24]
    marker_field = f"quest_reward_markers.{digest}"
    result = await db.users.update_one(
        {"_id": _oid(user_id), marker_field: {"$exists": False}},
        {
            "$inc": {"balance_blz": amount},
            "$set": {
                marker_field: {
                    "amount": amount,
                    "category": category,
                    "created_at": datetime.now(timezone.utc).isoformat(),
                }
            },
        },
    )
    replayed = False
    if result.modified_count != 1:
        existing = await db.users.find_one(
            {"_id": _oid(user_id), marker_field: {"$exists": True}},
            {"_id": 1},
        )
        if not existing:
            raise HTTPException(status_code=409, detail="Quest-BLZ konnte nicht atomar gutgeschrieben werden")
        replayed = True

    tx_id = f"QUEST-{digest.upper()}"
    await db.transactions.update_one(
        {"_id": tx_id},
        {"$setOnInsert": {
            "_id": tx_id,
            "id": tx_id,
            "user_id": user_id,
            "type": "bonus",
            "amount_blz": amount,
            "amount_eur": 0.0,
            "currency": "BLZ",
            "status": "completed",
            "description": description,
            "merchant_name": "BidBlitz",
            "category": category,
            "reference": tx_id,
            "idempotency_key": reward_key,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }},
        upsert=True,
    )
    return {"transaction_id": tx_id, "replayed": replayed}


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
    if not TEST_MODE:
        raise HTTPException(
            status_code=503,
            detail="BLZ-Quest-Belohnungen sind in Production deaktiviert.",
        )
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

    reward = int(q.get("reward_blz", 0) or 0)
    now = datetime.now(timezone.utc).isoformat()
    reward_key = f"quest:{uid}:{day}:{quest_id}:reward"

    # Claim the quest state atomically. Concurrent/retried requests then converge
    # on the same deterministic wallet marker instead of double-crediting BLZ.
    claimed = await db.user_quests.update_one(
        {
            "_id": doc["_id"],
            "quests": {
                "$elemMatch": {
                    "id": quest_id,
                    "completed": True,
                    "claimed": {"$ne": True},
                }
            },
        },
        {
            "$set": {
                "quests.$.claimed": True,
                "quests.$.claimed_at": now,
            }
        },
    )
    if claimed.modified_count != 1:
        current = await db.user_quests.find_one({"_id": doc["_id"]}, {"_id": 0}) or {}
        current_q = next((x for x in current.get("quests", []) if x.get("id") == quest_id), None)
        if not current_q or not current_q.get("claimed"):
            raise HTTPException(status_code=409, detail="Quest-Claim wird bereits verarbeitet")
        reward_tx = await _credit_quest_blz_once(
            user_id=uid,
            amount=reward,
            reward_key=reward_key,
            description=f"Quest: {q['title']}",
            category="quest",
        )
        fresh = current
        all_claimed = all(qq.get("claimed") for qq in fresh.get("quests", []))
        bonus = 20 if all_claimed else 0
        if bonus:
            await _credit_quest_blz_once(
                user_id=uid,
                amount=bonus,
                reward_key=f"quest:{uid}:{day}:all-claimed",
                description="Alle Quests erledigt (Bonus)",
                category="quest_bonus",
            )
        return {
            "ok": True,
            "reward": reward,
            "all_claimed_bonus": bonus,
            "replayed": True,
            "transaction_id": reward_tx["transaction_id"],
        }

    reward_tx = await _credit_quest_blz_once(
        user_id=uid,
        amount=reward,
        reward_key=reward_key,
        description=f"Quest: {q['title']}",
        category="quest",
    )

    fresh = await db.user_quests.find_one({"_id": doc["_id"]}, {"_id": 0}) or {}
    all_claimed = bool(fresh.get("quests")) and all(qq.get("claimed") for qq in fresh.get("quests", []))
    bonus = 0
    if all_claimed:
        bonus = 20
        await db.user_quests.update_one(
            {"_id": doc["_id"], "all_claimed": {"$ne": True}},
            {"$set": {"all_claimed": True, "all_claimed_at": now}},
        )
        await _credit_quest_blz_once(
            user_id=uid,
            amount=bonus,
            reward_key=f"quest:{uid}:{day}:all-claimed",
            description="Alle Quests erledigt (Bonus)",
            category="quest_bonus",
        )

    return {
        "ok": True,
        "reward": reward,
        "all_claimed_bonus": bonus,
        "replayed": bool(reward_tx["replayed"]),
        "transaction_id": reward_tx["transaction_id"],
    }
