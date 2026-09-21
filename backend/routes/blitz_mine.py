"""
BlitzMine — Pi-Network inspired tap-to-earn module.

Core mechanics (inspired by minepi.com):
- Daily 24h tap session (manual tap to start, auto claim after 24h).
- Security Circle (max 5 trusted members) → +20% rate per member.
- Role progression: Pioneer → Contributor → Ambassador → Node.
- Referral Team: active direct referrals boost user's rate.
- Lockup: lock BLZ for 14d / 6m / 1y / 3y → base rate multiplier.
- Pays out in BLZ (same token as existing mining, single wallet).
"""

from datetime import datetime, timezone, timedelta
from math import log
from typing import Optional
import random
import hashlib

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from bson import ObjectId
from pymongo import ReturnDocument

from core.database import db
from core.config import TEST_MODE
from core.security import get_current_user

router = APIRouter(prefix="/api/blitz-mine", tags=["blitz-mine"])


def _user_oid(user_id: str):
    try:
        return ObjectId(user_id)
    except Exception:
        return user_id


def _require_blitz_mine_value_mode() -> None:
    if not TEST_MODE:
        raise HTTPException(
            status_code=503,
            detail=(
                "BlitzMine ist in Production nur Preview. "
                "Ohne verifizierten Mining-/Settlement-Provider werden keine BLZ erzeugt, gesperrt oder ausgezahlt."
            ),
        )


def _require_blitz_idempotency_key(body_key: Optional[str], request: Request, prefix: str) -> str:
    key = (body_key or request.headers.get("Idempotency-Key") or "").strip()
    if not 8 <= len(key) <= 200:
        raise HTTPException(status_code=400, detail="Idempotency-Key erforderlich")
    return f"{prefix}:{key}"


async def _mutate_blitz_wallet_once(
    *,
    user_id: str,
    amount: float,
    direction: str,
    idempotency_key: str,
    description: str,
    category: str,
) -> dict:
    amount = round(float(amount or 0), 4)
    if amount <= 0 or direction not in {"credit", "debit"}:
        raise HTTPException(status_code=400, detail="Ungültige BlitzMine-BLZ-Buchung")

    user_oid = _user_oid(user_id)
    user_exists = await db.users.find_one({"_id": user_oid}, {"_id": 1})
    if not user_exists:
        raise HTTPException(status_code=404, detail="User nicht gefunden")

    digest = hashlib.sha256(idempotency_key.encode("utf-8")).hexdigest()[:24]
    marker_field = f"blitz_mine_value_markers.{digest}"
    selector = {"_id": user_oid, marker_field: {"$exists": False}}
    delta = amount if direction == "credit" else -amount
    if direction == "debit":
        selector["balance_blz"] = {"$gte": amount}

    result = await db.users.update_one(
        selector,
        {
            "$inc": {"balance_blz": delta},
            "$set": {
                marker_field: {
                    "direction": direction,
                    "amount": amount,
                    "category": category,
                    "created_at": _now().isoformat(),
                }
            },
        },
    )
    replayed = False
    if result.modified_count != 1:
        existing = await db.users.find_one(
            {"_id": user_oid, marker_field: {"$exists": True}},
            {"_id": 0, "balance_blz": 1},
        )
        if existing:
            replayed = True
        elif direction == "debit":
            raise HTTPException(status_code=400, detail="Nicht genug BLZ im Wallet.")
        else:
            raise HTTPException(status_code=409, detail="BLZ-Buchung konnte nicht atomar angewendet werden")

    tx_id = f"BM-{digest.upper()}"
    await db.transactions.update_one(
        {"_id": tx_id},
        {"$setOnInsert": {
            "_id": tx_id,
            "id": tx_id,
            "user_id": user_id,
            "type": "blitz_mine_value",
            "amount_blz": amount if direction == "credit" else -amount,
            "amount_eur": 0.0,
            "direction": direction,
            "category": category,
            "description": description,
            "status": "completed",
            "idempotency_key": idempotency_key,
            "created_at": _now().isoformat(),
        }},
        upsert=True,
    )
    wallet = await db.users.find_one({"_id": user_oid}, {"_id": 0, "balance_blz": 1}) or {}
    return {
        "transaction_id": tx_id,
        "new_balance_blz": round(float(wallet.get("balance_blz", 0) or 0), 4),
        "replayed": replayed,
    }


def _blitz_mine_capabilities() -> dict:
    return {
        "live_mining_provider_connected": False,
        "value_actions_enabled": bool(TEST_MODE),
        "claim_enabled": bool(TEST_MODE),
        "lockup_enabled": bool(TEST_MODE),
        "production_message": (
            None if TEST_MODE else
            "BlitzMine Preview: Tap/Claim/Bonus/Lockup sind bis zur Live-Provider-Anbindung deaktiviert."
        ),
    }

# ── Economic constants (BLZ-based) ──
BASE_RATE_PER_HOUR = 0.02           # 0.02 BLZ/h → ~0.48 BLZ/day for a pure Pioneer
SESSION_HOURS = 24

ROLE_MULTIPLIER = {
    "pioneer":     1.00,
    "contributor": 1.20,   # 3+ sessions & circle built
    "ambassador":  1.30,   # 5+ active referrals
    "node":        1.50,   # verified KYC + 30+ sessions
}
ROLE_ORDER = ["pioneer", "contributor", "ambassador", "node"]

CIRCLE_MAX = 5
CIRCLE_BONUS_PER_MEMBER = 0.20        # +20% per verified member (max 100%)

REFERRAL_BONUS_PER_ACTIVE = 0.05      # +5% per active direct referral (cap 50%)
REFERRAL_BONUS_CAP = 0.50

# Daily Streak Rewards — Pi-Network-style loyalty milestones
# Each tier awards a BLZ bonus (paid out once) + a permanent streak multiplier.
STREAK_MILESTONES = [
    {"days": 3,   "bonus_blz": 1.0,   "multiplier_bonus": 0.05, "title": "Bronze Streak",  "icon": "flame"},
    {"days": 7,   "bonus_blz": 3.0,   "multiplier_bonus": 0.10, "title": "Silver Streak",  "icon": "flame"},
    {"days": 14,  "bonus_blz": 8.0,   "multiplier_bonus": 0.15, "title": "Gold Streak",    "icon": "trophy"},
    {"days": 30,  "bonus_blz": 20.0,  "multiplier_bonus": 0.25, "title": "Diamond Streak", "icon": "diamond"},
    {"days": 60,  "bonus_blz": 50.0,  "multiplier_bonus": 0.40, "title": "Legend Streak",  "icon": "crown"},
    {"days": 100, "bonus_blz": 120.0, "multiplier_bonus": 0.60, "title": "Mythic Streak",  "icon": "sparkles"},
]
STREAK_MULTIPLIER_CAP = 1.00         # total streak multiplier cannot exceed +100%

LOCKUP_DURATIONS = {
    14:   {"label": "2 Wochen",  "multiplier": 0.10},   # +10%
    180:  {"label": "6 Monate",  "multiplier": 0.30},   # +30%
    365:  {"label": "1 Jahr",    "multiplier": 0.60},   # +60%
    1095: {"label": "3 Jahre",   "multiplier": 1.20},   # +120%
}
LOCKUP_EARLY_RELEASE_PENALTY = 0.25   # 25% penalty on locked amount
LOCKUP_BONUS_CAP = 2.00               # total lockup bonus cannot exceed +200%

QUICK_BONUS_INTERVAL_HOURS = 6
QUICK_BONUS_REWARDS = [0.15, 0.25, 0.4, 0.6, 0.85, 1.25, 2.0]
BOOST_TAP_TARGET = 12
BOOST_TAP_MAX_ROUNDS = 3
BOOST_ROUND_REWARD_BLZ = 0.08

DEFAULT_REMINDER_SETTINGS = {
    "claim_ready_enabled": True,
    "quick_bonus_enabled": True,
    "leaderboard_enabled": False,
}

# ── Helpers ──
def _now():
    return datetime.now(timezone.utc)


async def _get_profile(user_id: str) -> dict:
    prof = await db.blitz_mine_profile.find_one({"user_id": user_id}, {"_id": 0})
    if prof:
        return prof
    now = _now()
    prof = {
        "user_id": user_id,
        "role": "pioneer",
        "total_mined": 0.0,
        "total_sessions": 0,
        "streak_days": 0,
        "last_claim_date": None,
        "first_session_at": None,
        "created_at": now.isoformat(),
    }
    await db.blitz_mine_profile.insert_one(dict(prof))
    # blitz_mine_profile may have added _id on insert – strip it defensively
    prof.pop("_id", None)
    return prof


async def _get_active_session(user_id: str) -> Optional[dict]:
    s = await db.blitz_mine_sessions.find_one(
        {"user_id": user_id, "claimed": False},
        {"_id": 0},
        sort=[("started_at", -1)],
    )
    return s


async def _count_active_circle(user_id: str) -> int:
    doc = await db.blitz_mine_circle.find_one({"user_id": user_id}, {"_id": 0})
    if not doc:
        return 0
    return len(doc.get("members", []))


async def _count_active_referrals(user_id: str) -> int:
    # An "active" referral = user who has mined in the last 7 days
    cutoff = (_now() - timedelta(days=7)).isoformat()
    refs = await db.users.find({"referred_by": user_id}, {"id": 1, "_id": 1}).to_list(500)
    if not refs:
        return 0
    ref_ids = [str(r.get("_id") or r.get("id")) for r in refs]
    active = await db.blitz_mine_sessions.count_documents({
        "user_id": {"$in": ref_ids},
        "started_at": {"$gt": cutoff},
    })
    return min(active, len(ref_ids))


async def _get_active_lockup_bonus(user_id: str) -> float:
    now = _now()
    cur = db.blitz_mine_lockup.find({
        "user_id": user_id,
        "status": "active",
        "ends_at": {"$gt": now.isoformat()},
    }, {"_id": 0})
    total = 0.0
    async for lk in cur:
        total += float(lk.get("bonus_rate", 0.0))
    return min(total, LOCKUP_BONUS_CAP)


def _streak_multiplier(streak: int) -> float:
    """Sum of all milestone bonuses the user has unlocked (capped)."""
    total = 0.0
    for m in STREAK_MILESTONES:
        if streak >= m["days"]:
            total += m["multiplier_bonus"]
    return min(total, STREAK_MULTIPLIER_CAP)


def _next_milestone(streak: int) -> Optional[dict]:
    for m in STREAK_MILESTONES:
        if streak < m["days"]:
            return m
    return None


def _lockup_bonus_for(amount: float, duration_days: int) -> float:
    """Bonus rate based on amount (log-scaled) × duration multiplier."""
    mult = LOCKUP_DURATIONS.get(duration_days, {}).get("multiplier", 0.0)
    if amount <= 0 or mult <= 0:
        return 0.0
    # log10(amount+1) gives a diminishing curve; 100 BLZ ≈ 1.0
    scale = min(log(amount + 1, 10) / 2.0, 1.0)  # 0..1
    return round(mult * scale, 4)


async def _promote_role_if_needed(user_id: str, profile: dict):
    sessions = profile.get("total_sessions", 0)
    role = profile.get("role", "pioneer")
    circle = await _count_active_circle(user_id)
    refs = await _count_active_referrals(user_id)
    new_role = role
    if sessions >= 30 and refs >= 5 and circle >= 3:
        new_role = "node"
    elif refs >= 5:
        new_role = "ambassador"
    elif sessions >= 3 and circle >= 1:
        new_role = "contributor"
    else:
        new_role = "pioneer"
    if new_role != role:
        await db.blitz_mine_profile.update_one(
            {"user_id": user_id},
            {"$set": {"role": new_role}},
        )
        profile["role"] = new_role
    return profile


async def _compute_rate(user_id: str, profile: dict) -> dict:
    role = profile.get("role", "pioneer")
    role_mult = ROLE_MULTIPLIER.get(role, 1.0)

    circle_count = await _count_active_circle(user_id)
    circle_bonus = min(circle_count * CIRCLE_BONUS_PER_MEMBER, 1.0)  # cap +100%

    refs_active = await _count_active_referrals(user_id)
    referral_bonus = min(refs_active * REFERRAL_BONUS_PER_ACTIVE, REFERRAL_BONUS_CAP)

    lockup_bonus = await _get_active_lockup_bonus(user_id)
    streak = int(profile.get("streak_days", 0))
    streak_bonus = _streak_multiplier(streak)

    total_multiplier = role_mult * (1.0 + circle_bonus + referral_bonus + lockup_bonus + streak_bonus)
    rate_per_hour = BASE_RATE_PER_HOUR * total_multiplier
    estimated = rate_per_hour * SESSION_HOURS

    return {
        "base_rate_per_hour": BASE_RATE_PER_HOUR,
        "role": role,
        "role_multiplier": round(role_mult, 3),
        "circle_count": circle_count,
        "circle_bonus": round(circle_bonus, 3),
        "referrals_active": refs_active,
        "referral_bonus": round(referral_bonus, 3),
        "lockup_bonus": round(lockup_bonus, 3),
        "streak_days": streak,
        "streak_bonus": round(streak_bonus, 3),
        "total_multiplier": round(total_multiplier, 3),
        "rate_per_hour": round(rate_per_hour, 6),
        "estimated_session_earnings": round(estimated, 4),
    }


async def _get_quick_bonus_state(user_id: str) -> dict:
    doc = await db.blitz_mine_quick_bonus.find_one({"user_id": user_id}, {"_id": 0}) or {"user_id": user_id}
    now = _now()
    next_claim_at = doc.get("next_claim_at")
    available = True
    remaining_seconds = 0
    if next_claim_at:
        try:
            next_dt = datetime.fromisoformat(next_claim_at.replace("Z", "+00:00"))
            remaining_seconds = max(0, int((next_dt - now).total_seconds()))
            available = remaining_seconds == 0
        except Exception:
            available = True
            remaining_seconds = 0
    return {
        "available": available,
        "remaining_seconds": remaining_seconds,
        "interval_hours": QUICK_BONUS_INTERVAL_HOURS,
        "reward_min": min(QUICK_BONUS_REWARDS),
        "reward_max": max(QUICK_BONUS_REWARDS),
        "last_reward_blz": round(float(doc.get("last_reward_blz", 0.0) or 0.0), 4),
        "total_claims": int(doc.get("total_claims", 0) or 0),
        "next_claim_at": next_claim_at,
    }


def _build_boost_state(session: Optional[dict]) -> dict:
    if not session:
        return {
            "unlocked": False,
            "target_taps": BOOST_TAP_TARGET,
            "max_rounds": BOOST_TAP_MAX_ROUNDS,
            "reward_per_round_blz": BOOST_ROUND_REWARD_BLZ,
            "completed_rounds": 0,
            "current_round_taps": 0,
            "remaining_taps": BOOST_TAP_TARGET,
            "session_bonus_blz": 0.0,
            "can_tap": False,
        }

    boost_tap_count = int(session.get("boost_tap_count", 0) or 0)
    completed_rounds = int(session.get("boost_rounds_claimed", 0) or 0)
    session_bonus_blz = round(float(session.get("boost_bonus_blz", 0.0) or 0.0), 4)
    current_round_taps = boost_tap_count - (completed_rounds * BOOST_TAP_TARGET)
    if completed_rounds >= BOOST_TAP_MAX_ROUNDS:
        current_round_taps = BOOST_TAP_TARGET
    current_round_taps = max(0, min(current_round_taps, BOOST_TAP_TARGET))
    remaining_taps = 0 if completed_rounds >= BOOST_TAP_MAX_ROUNDS else max(0, BOOST_TAP_TARGET - current_round_taps)
    return {
        "unlocked": True,
        "target_taps": BOOST_TAP_TARGET,
        "max_rounds": BOOST_TAP_MAX_ROUNDS,
        "reward_per_round_blz": BOOST_ROUND_REWARD_BLZ,
        "completed_rounds": completed_rounds,
        "current_round_taps": current_round_taps,
        "remaining_taps": remaining_taps,
        "session_bonus_blz": session_bonus_blz,
        "can_tap": completed_rounds < BOOST_TAP_MAX_ROUNDS,
    }


async def _get_competition_snapshot(user_id: str, profile: dict) -> dict:
    total_mined = float(profile.get("total_mined", 0.0) or 0.0)
    total_players = await db.blitz_mine_profile.count_documents({})
    rank = await db.blitz_mine_profile.count_documents({"total_mined": {"$gt": total_mined}}) + 1
    above = await db.blitz_mine_profile.find_one(
        {"total_mined": {"$gt": total_mined}},
        {"_id": 0, "user_id": 1, "total_mined": 1},
        sort=[("total_mined", 1)],
    )
    gap_to_next = 0.0
    if above:
        gap_to_next = max(0.0, round(float(above.get("total_mined", 0.0) or 0.0) - total_mined, 4))
    percentile = 100 if total_players <= 1 else max(1, round(((total_players - rank + 1) / total_players) * 100))
    return {
        "rank": rank,
        "total_players": total_players,
        "gap_to_next_rank_blz": gap_to_next,
        "percentile": percentile,
    }


async def _get_reminder_settings(user_id: str) -> dict:
    doc = await db.blitz_mine_reminder_settings.find_one({"user_id": user_id}, {"_id": 0}) or {}
    merged = {"user_id": user_id, **DEFAULT_REMINDER_SETTINGS, **doc}
    return {
        "claim_ready_enabled": bool(merged.get("claim_ready_enabled", True)),
        "quick_bonus_enabled": bool(merged.get("quick_bonus_enabled", True)),
        "leaderboard_enabled": bool(merged.get("leaderboard_enabled", False)),
    }


async def _user_lookup(query: str) -> Optional[dict]:
    """Find a user by username, email or referral code."""
    q = query.strip()
    if not q:
        return None
    or_filters = [{"email": q.lower()}, {"username": q}, {"referral_code": q.upper()}]
    u = await db.users.find_one({"$or": or_filters}, {"password": 0})
    return u


# ── Schemas ──
class AddCircleReq(BaseModel):
    identifier: str = Field(..., description="Email, username or referral code")


class LockupReq(BaseModel):
    amount: float = Field(..., gt=0)
    duration_days: int
    idempotency_key: Optional[str] = None


class ReminderSettingsReq(BaseModel):
    claim_ready_enabled: bool = True
    quick_bonus_enabled: bool = True
    leaderboard_enabled: bool = False


class ReminderTestReq(BaseModel):
    kind: str = Field(default="claim_ready", pattern="^(claim_ready|quick_bonus|leaderboard)$")


# ── Endpoints ──
@router.get("/capabilities")
async def blitz_mine_capabilities():
    return _blitz_mine_capabilities()


@router.get("/status")
async def status(request: Request):
    user = await get_current_user(request)
    user_id = str(user["_id"])

    profile = await _get_profile(user_id)
    profile = await _promote_role_if_needed(user_id, profile)
    rate = await _compute_rate(user_id, profile)
    session = await _get_active_session(user_id)
    quick_bonus = await _get_quick_bonus_state(user_id)
    competition = await _get_competition_snapshot(user_id, profile)
    reminders = await _get_reminder_settings(user_id)

    # Auto-claim if expired and still unclaimed (delayed claim next /status)
    ready = False
    session_info = None
    if session:
        ends_at = datetime.fromisoformat(session["ends_at"].replace("Z", "+00:00"))
        remaining = max((ends_at - _now()).total_seconds(), 0)
        ready = remaining == 0
        session_info = {
            "started_at": session["started_at"],
            "ends_at": session["ends_at"],
            "remaining_seconds": int(remaining),
            "earnings": session.get("estimated_earnings", 0),
            "boost": _build_boost_state(session),
            "estimated_total_earnings": round(float(session.get("estimated_earnings", 0.0) or 0.0) + float(session.get("boost_bonus_blz", 0.0) or 0.0), 4),
            "ready_to_claim": ready,
        }

    wallet = await db.users.find_one({"_id": _user_oid(user_id)}, {"_id": 0, "balance_blz": 1})
    blz_balance = (wallet or {}).get("balance_blz", 0.0)

    # next role target
    role_idx = ROLE_ORDER.index(profile.get("role", "pioneer"))
    next_role = ROLE_ORDER[role_idx + 1] if role_idx + 1 < len(ROLE_ORDER) else None

    if not TEST_MODE:
        session_info = None
        blz_balance = 0.0
        rate = {**rate, "rate_per_hour": 0.0, "estimated_session_earnings": 0.0}

    return {
        "capabilities": _blitz_mine_capabilities(),
        "profile": {
            "user_id": user_id,
            "role": profile["role"],
            "role_multiplier": rate["role_multiplier"],
            "next_role": next_role,
            "total_mined": round(profile.get("total_mined", 0.0), 4),
            "total_sessions": profile.get("total_sessions", 0),
            "streak_days": profile.get("streak_days", 0),
        },
        "rate": rate,
        "session": session_info,
        "quick_bonus": quick_bonus,
        "competition": competition,
        "reminders": reminders,
        "balance_blz": round(blz_balance, 4),
        "constants": {
            "session_hours": SESSION_HOURS,
            "circle_max": CIRCLE_MAX,
            "circle_bonus_per_member": CIRCLE_BONUS_PER_MEMBER,
            "referral_bonus_per_active": REFERRAL_BONUS_PER_ACTIVE,
            "referral_bonus_cap": REFERRAL_BONUS_CAP,
            "lockup_durations": [
                {"days": d, **info} for d, info in LOCKUP_DURATIONS.items()
            ],
        },
    }


@router.post("/tap")
async def tap(request: Request):
    _require_blitz_mine_value_mode()
    user = await get_current_user(request)
    user_id = str(user["_id"])
    idem = _require_blitz_idempotency_key(None, request, "blitz-session-start")
    digest = hashlib.sha256(f"{user_id}:{idem}".encode("utf-8")).hexdigest()[:24]
    session_id = f"BMS-{digest.upper()}"

    prior = await db.blitz_mine_sessions.find_one({"session_id": session_id}, {"_id": 0})
    if prior:
        if prior.get("claimed"):
            raise HTTPException(status_code=409, detail="Dieser Session-Start-Key wurde bereits abgeschlossen.")
        remaining = max(
            0,
            int((datetime.fromisoformat(prior["ends_at"].replace("Z", "+00:00")) - _now()).total_seconds()),
        )
        return {
            "success": True,
            "message": "Mining-Session läuft bereits.",
            "session": {
                "started_at": prior["started_at"],
                "ends_at": prior["ends_at"],
                "remaining_seconds": remaining,
                "earnings": prior.get("estimated_earnings", 0),
                "ready_to_claim": remaining == 0,
            },
            "replayed": True,
        }

    existing = await _get_active_session(user_id)
    if existing:
        raise HTTPException(409, "Du hast bereits eine aktive Mining-Session. Bitte erst beanspruchen.")

    profile = await _get_profile(user_id)
    profile = await _promote_role_if_needed(user_id, profile)
    rate = await _compute_rate(user_id, profile)

    now = _now()
    ends = now + timedelta(hours=SESSION_HOURS)
    session = {
        "session_id": session_id,
        "active_slot": user_id,
        "start_idempotency_key": idem,
        "user_id": user_id,
        "started_at": now.isoformat(),
        "ends_at": ends.isoformat(),
        "claimed": False,
        "rate_per_hour": rate["rate_per_hour"],
        "role_multiplier": rate["role_multiplier"],
        "circle_bonus": rate["circle_bonus"],
        "referral_bonus": rate["referral_bonus"],
        "lockup_bonus": rate["lockup_bonus"],
        "estimated_earnings": rate["estimated_session_earnings"],
        "boost_tap_count": 0,
        "boost_rounds_claimed": 0,
        "boost_bonus_blz": 0.0,
    }
    try:
        await db.blitz_mine_sessions.insert_one(dict(session))
    except Exception as exc:
        current = await _get_active_session(user_id)
        if current and current.get("session_id") == session_id:
            remaining = max(
                0,
                int((datetime.fromisoformat(current["ends_at"].replace("Z", "+00:00")) - _now()).total_seconds()),
            )
            return {
                "success": True,
                "message": "Mining-Session läuft bereits.",
                "session": {
                    "started_at": current["started_at"],
                    "ends_at": current["ends_at"],
                    "remaining_seconds": remaining,
                    "earnings": current.get("estimated_earnings", 0),
                    "ready_to_claim": remaining == 0,
                },
                "replayed": True,
            }
        if current:
            raise HTTPException(status_code=409, detail="Eine andere Mining-Session wurde bereits gestartet.") from exc
        raise HTTPException(status_code=503, detail="Mining-Session konnte nicht atomar gestartet werden.") from exc

    if not profile.get("first_session_at"):
        await db.blitz_mine_profile.update_one(
            {"user_id": user_id},
            {"$set": {"first_session_at": now.isoformat()}},
        )

    try:
        from routes.quests import track_event
        await track_event(user_id, "mine_tap", 1)
    except Exception:
        pass

    return {
        "success": True,
        "message": "Mining-Session gestartet! Komm in 24h wieder.",
        "session": {
            "started_at": session["started_at"],
            "ends_at": session["ends_at"],
            "remaining_seconds": SESSION_HOURS * 3600,
            "earnings": session["estimated_earnings"],
            "ready_to_claim": False,
        },
        "replayed": False,
    }


@router.post("/claim")
async def claim(request: Request):
    _require_blitz_mine_value_mode()
    user = await get_current_user(request)
    user_id = str(user["_id"])
    idem = _require_blitz_idempotency_key(None, request, "blitz-session-claim")
    claim_id = hashlib.sha256(f"{user_id}:{idem}".encode("utf-8")).hexdigest()[:24]

    prior = await db.blitz_mine_sessions.find_one(
        {"user_id": user_id, "claim_id": claim_id, "claimed": True},
        {"_id": 0, "claim_result": 1},
    )
    if prior and prior.get("claim_result"):
        return {**prior["claim_result"], "replayed": True}

    session = await _get_active_session(user_id)
    if not session:
        raise HTTPException(404, "Keine aktive Session gefunden. Tippe erst den Mining-Button.")

    ends_at = datetime.fromisoformat(session["ends_at"].replace("Z", "+00:00"))
    if ends_at > _now():
        remaining = int((ends_at - _now()).total_seconds())
        raise HTTPException(400, f"Session läuft noch {remaining // 3600}h {(remaining % 3600) // 60}m.")

    now = _now()
    now_iso = now.isoformat()
    lock_until = (now + timedelta(minutes=5)).isoformat()
    acquired = await db.blitz_mine_sessions.update_one(
        {
            "user_id": user_id,
            "started_at": session["started_at"],
            "claimed": False,
            "$or": [
                {"claim_lock_until": {"$exists": False}},
                {"claim_lock_until": {"$lt": now_iso}},
            ],
        },
        {"$set": {
            "claim_state": "processing",
            "claim_id": claim_id,
            "claim_started_at": now_iso,
            "claim_lock_until": lock_until,
        }},
    )
    if acquired.modified_count != 1:
        current = await db.blitz_mine_sessions.find_one(
            {"user_id": user_id, "started_at": session["started_at"]},
            {"_id": 0},
        ) or {}
        if current.get("claimed") and current.get("claim_id") == claim_id and current.get("claim_result"):
            return {**current["claim_result"], "replayed": True}
        raise HTTPException(status_code=409, detail="Mining-Claim wird bereits verarbeitet.")

    earnings = round(
        float(session.get("estimated_earnings", 0.0))
        + float(session.get("boost_bonus_blz", 0.0) or 0.0),
        4,
    )
    profile = await _get_profile(user_id)
    profile_marker = f"claim_markers.{claim_id}"
    marker = (profile.get("claim_markers") or {}).get(claim_id)

    if marker:
        new_streak = int(marker.get("streak_days", 1) or 1)
        milestone_bonus = round(float(marker.get("milestone_bonus_blz", 0.0) or 0.0), 4)
        milestone_hit = marker.get("milestone_hit")
    else:
        last_claim = profile.get("last_claim_date")
        today = now.date().isoformat()
        yesterday = (now.date() - timedelta(days=1)).isoformat()
        prev_streak = int(profile.get("streak_days", 0) or 0)
        new_streak = prev_streak + 1 if last_claim == yesterday else 1

        claimed_milestones = set(profile.get("claimed_milestones", []))
        milestone_bonus = 0.0
        milestone_hit = None
        for milestone in STREAK_MILESTONES:
            if new_streak >= milestone["days"] and milestone["days"] not in claimed_milestones:
                milestone_bonus += milestone["bonus_blz"]
                claimed_milestones.add(milestone["days"])
                milestone_hit = milestone
        milestone_bonus = round(milestone_bonus, 4)
        marker_value = {
            "earnings_blz": earnings,
            "milestone_bonus_blz": milestone_bonus,
            "milestone_hit": milestone_hit,
            "streak_days": new_streak,
            "created_at": now_iso,
        }
        profile_update = await db.blitz_mine_profile.update_one(
            {"user_id": user_id, profile_marker: {"$exists": False}},
            {
                "$inc": {
                    "total_mined": earnings + milestone_bonus,
                    "total_sessions": 1,
                },
                "$set": {
                    "last_claim_date": today,
                    "streak_days": new_streak,
                    "claimed_milestones": list(sorted(claimed_milestones)),
                    profile_marker: marker_value,
                },
            },
        )
        if profile_update.modified_count != 1:
            fresh_profile = await db.blitz_mine_profile.find_one(
                {"user_id": user_id, profile_marker: {"$exists": True}},
                {"_id": 0, "claim_markers": 1},
            ) or {}
            marker = (fresh_profile.get("claim_markers") or {}).get(claim_id)
            if not marker:
                await db.blitz_mine_sessions.update_one(
                    {"user_id": user_id, "started_at": session["started_at"], "claim_id": claim_id},
                    {"$set": {"claim_state": "reconciliation_required"}},
                )
                raise HTTPException(status_code=500, detail="Mining-Profil benötigt Abstimmung")
            new_streak = int(marker.get("streak_days", 1) or 1)
            milestone_bonus = round(float(marker.get("milestone_bonus_blz", 0.0) or 0.0), 4)
            milestone_hit = marker.get("milestone_hit")

    earning_tx = None
    if earnings > 0:
        earning_tx = await _mutate_blitz_wallet_once(
            user_id=user_id,
            amount=earnings,
            direction="credit",
            idempotency_key=f"blitz-session-claim:{claim_id}:earnings",
            description=f"BlitzMine Reward ({new_streak}d streak)",
            category="blitz_mine_claim",
        )

    milestone_tx = None
    if milestone_bonus > 0:
        milestone_tx = await _mutate_blitz_wallet_once(
            user_id=user_id,
            amount=milestone_bonus,
            direction="credit",
            idempotency_key=f"blitz-session-claim:{claim_id}:milestone",
            description=f"BlitzMine Streak-Bonus ({new_streak} Tage)",
            category="blitz_mine_streak_bonus",
        )

    fresh_profile = await db.blitz_mine_profile.find_one(
        {"user_id": user_id},
        {"_id": 0, "total_mined": 1},
    ) or {}
    claim_result = {
        "success": True,
        "amount_blz": earnings,
        "streak_days": new_streak,
        "total_mined": round(float(fresh_profile.get("total_mined", 0.0) or 0.0), 4),
        "milestone_bonus_blz": milestone_bonus,
        "milestone_hit": milestone_hit,
        "earning_transaction_id": earning_tx["transaction_id"] if earning_tx else None,
        "milestone_transaction_id": milestone_tx["transaction_id"] if milestone_tx else None,
    }
    finalized = await db.blitz_mine_sessions.update_one(
        {
            "user_id": user_id,
            "started_at": session["started_at"],
            "claimed": False,
            "claim_state": "processing",
            "claim_id": claim_id,
        },
        {
            "$set": {
                "claimed": True,
                "claim_state": "completed",
                "claimed_at": _now().isoformat(),
                "final_earnings": earnings,
                "claim_result": claim_result,
            },
            "$unset": {"claim_lock_until": "", "active_slot": ""},
        },
    )
    if finalized.modified_count != 1:
        current = await db.blitz_mine_sessions.find_one(
            {"user_id": user_id, "started_at": session["started_at"]},
            {"_id": 0, "claimed": 1, "claim_id": 1, "claim_result": 1},
        ) or {}
        if current.get("claimed") and current.get("claim_id") == claim_id and current.get("claim_result"):
            return {**current["claim_result"], "replayed": True}
        raise HTTPException(status_code=500, detail="BLZ wurden gutgeschrieben, Session-Abschluss benötigt Abstimmung")

    return {**claim_result, "replayed": bool(
        (earning_tx and earning_tx["replayed"]) or (milestone_tx and milestone_tx["replayed"])
    )}


@router.post("/boost-tap")
async def boost_tap(request: Request):
    _require_blitz_mine_value_mode()
    user = await get_current_user(request)
    user_id = str(user["_id"])
    idem = _require_blitz_idempotency_key(None, request, "blitz-boost-tap")
    digest = hashlib.sha256(f"{user_id}:{idem}".encode("utf-8")).hexdigest()[:24]
    marker_field = f"boost_tap_markers.{digest}"

    session = await _get_active_session(user_id)
    if not session:
        raise HTTPException(404, "Starte zuerst deine Mining-Session.")

    ends_at = datetime.fromisoformat(session["ends_at"].replace("Z", "+00:00"))
    if ends_at <= _now():
        raise HTTPException(400, "Session ist fertig. Bitte jetzt claimen.")

    existing_marker = (session.get("boost_tap_markers") or {}).get(digest)
    if existing_marker:
        count = int(session.get("boost_tap_count", 0) or 0)
        completed_rounds = min(count // BOOST_TAP_TARGET, BOOST_TAP_MAX_ROUNDS)
        bonus_blz = round(completed_rounds * BOOST_ROUND_REWARD_BLZ, 4)
        await db.blitz_mine_sessions.update_one(
            {"user_id": user_id, "started_at": session["started_at"]},
            {"$max": {
                "boost_rounds_claimed": completed_rounds,
                "boost_bonus_blz": bonus_blz,
            }},
        )
        state = _build_boost_state({
            **session,
            "boost_rounds_claimed": max(int(session.get("boost_rounds_claimed", 0) or 0), completed_rounds),
            "boost_bonus_blz": max(float(session.get("boost_bonus_blz", 0.0) or 0.0), bonus_blz),
        })
        return {
            "success": True,
            "unlocked_round": bool(existing_marker.get("unlocked_round", False)),
            "boost": state,
            "message": "Turbo-Tap bereits verarbeitet.",
            "replayed": True,
        }

    updated = await db.blitz_mine_sessions.find_one_and_update(
        {
            "user_id": user_id,
            "started_at": session["started_at"],
            "claimed": False,
            marker_field: {"$exists": False},
            "boost_tap_count": {"$lt": BOOST_TAP_TARGET * BOOST_TAP_MAX_ROUNDS},
        },
        {
            "$inc": {"boost_tap_count": 1},
            "$set": {
                marker_field: {
                    "idempotency_key": idem,
                    "created_at": _now().isoformat(),
                }
            },
        },
        return_document=ReturnDocument.AFTER,
    )
    if not updated:
        current = await db.blitz_mine_sessions.find_one(
            {"user_id": user_id, "started_at": session["started_at"]},
            {"_id": 0},
        ) or {}
        marker = (current.get("boost_tap_markers") or {}).get(digest)
        if marker:
            state = _build_boost_state(current)
            return {
                "success": True,
                "unlocked_round": bool(marker.get("unlocked_round", False)),
                "boost": state,
                "message": "Turbo-Tap bereits verarbeitet.",
                "replayed": True,
            }
        if int(current.get("boost_rounds_claimed", 0) or 0) >= BOOST_TAP_MAX_ROUNDS:
            raise HTTPException(400, "Turbo-Maximum für diese Session erreicht.")
        raise HTTPException(status_code=409, detail="Turbo-Tap konnte nicht atomar reserviert werden.")

    boost_tap_count = int(updated.get("boost_tap_count", 0) or 0)
    completed_rounds = min(boost_tap_count // BOOST_TAP_TARGET, BOOST_TAP_MAX_ROUNDS)
    bonus_blz = round(completed_rounds * BOOST_ROUND_REWARD_BLZ, 4)
    unlocked_round = boost_tap_count > 0 and boost_tap_count % BOOST_TAP_TARGET == 0

    await db.blitz_mine_sessions.update_one(
        {"user_id": user_id, "started_at": session["started_at"], marker_field: {"$exists": True}},
        {
            "$max": {
                "boost_rounds_claimed": completed_rounds,
                "boost_bonus_blz": bonus_blz,
            },
            "$set": {
                f"{marker_field}.tap_count_after": boost_tap_count,
                f"{marker_field}.unlocked_round": unlocked_round,
            },
        },
    )

    try:
        from routes.quests import track_event
        await track_event(user_id, "mine_tap", 1)
    except Exception:
        pass

    state = _build_boost_state({
        **updated,
        "boost_rounds_claimed": max(int(updated.get("boost_rounds_claimed", 0) or 0), completed_rounds),
        "boost_bonus_blz": max(float(updated.get("boost_bonus_blz", 0.0) or 0.0), bonus_blz),
    })
    return {
        "success": True,
        "unlocked_round": unlocked_round,
        "boost": state,
        "message": "Turbo gespeichert!" if unlocked_round else "Turbo-Tap gezählt.",
        "replayed": False,
    }


@router.post("/quick-bonus/claim")
async def claim_quick_bonus(request: Request):
    _require_blitz_mine_value_mode()
    user = await get_current_user(request)
    user_id = str(user["_id"])
    idem = _require_blitz_idempotency_key(None, request, "blitz-quick-bonus")
    claim_id = hashlib.sha256(f"{user_id}:{idem}".encode("utf-8")).hexdigest()[:24]
    now = _now()
    now_iso = now.isoformat()

    await db.blitz_mine_quick_bonus.update_one(
        {"user_id": user_id},
        {"$setOnInsert": {
            "user_id": user_id,
            "total_claims": 0,
            "claim_state": "idle",
            "created_at": now_iso,
        }},
        upsert=True,
    )
    current = await db.blitz_mine_quick_bonus.find_one({"user_id": user_id}, {"_id": 0}) or {}
    if current.get("last_claim_id") == claim_id:
        return {
            "success": True,
            "reward_blz": round(float(current.get("last_reward_blz", 0.0) or 0.0), 4),
            "next_claim_at": current.get("next_claim_at"),
            "remaining_seconds": max(
                0,
                int(
                    (
                        datetime.fromisoformat(str(current.get("next_claim_at")).replace("Z", "+00:00")) - now
                    ).total_seconds()
                ),
            ) if current.get("next_claim_at") else 0,
            "replayed": True,
        }

    next_claim_at = current.get("next_claim_at")
    if next_claim_at:
        try:
            next_dt = datetime.fromisoformat(str(next_claim_at).replace("Z", "+00:00"))
            if next_dt > now:
                raise HTTPException(status_code=400, detail="Quick Bonus ist noch nicht bereit.")
        except ValueError:
            pass

    reward = (
        float(current.get("pending_reward_blz"))
        if current.get("pending_claim_id") == claim_id and current.get("pending_reward_blz") is not None
        else float(random.choice(QUICK_BONUS_REWARDS))
    )
    lock_until = (now + timedelta(minutes=5)).isoformat()
    claimed = await db.blitz_mine_quick_bonus.update_one(
        {
            "user_id": user_id,
            "$and": [
                {
                    "$or": [
                        {"next_claim_at": {"$exists": False}},
                        {"next_claim_at": None},
                        {"next_claim_at": {"$lte": now_iso}},
                    ]
                },
                {
                    "$or": [
                        {"claim_state": {"$ne": "processing"}},
                        {"claim_lock_until": {"$lt": now_iso}},
                    ]
                },
            ],
        },
        {"$set": {
            "claim_state": "processing",
            "pending_claim_id": claim_id,
            "pending_reward_blz": reward,
            "claim_lock_until": lock_until,
            "claim_started_at": now_iso,
        }},
    )
    if claimed.modified_count != 1:
        current = await db.blitz_mine_quick_bonus.find_one({"user_id": user_id}, {"_id": 0}) or {}
        if current.get("last_claim_id") == claim_id:
            return {
                "success": True,
                "reward_blz": round(float(current.get("last_reward_blz", 0.0) or 0.0), 4),
                "next_claim_at": current.get("next_claim_at"),
                "remaining_seconds": 0,
                "replayed": True,
            }
        raise HTTPException(status_code=409, detail="Quick Bonus wird bereits verarbeitet.")

    payout = await _mutate_blitz_wallet_once(
        user_id=user_id,
        amount=reward,
        direction="credit",
        idempotency_key=f"blitz-quick-bonus:{claim_id}",
        description="BlitzMine Quick Bonus",
        category="blitz_mine_quick_bonus",
    )
    next_claim_at = (now + timedelta(hours=QUICK_BONUS_INTERVAL_HOURS)).isoformat()
    finalized = await db.blitz_mine_quick_bonus.update_one(
        {"user_id": user_id, "claim_state": "processing", "pending_claim_id": claim_id},
        {
            "$set": {
                "claim_state": "completed",
                "last_claim_id": claim_id,
                "last_reward_blz": reward,
                "last_claimed_at": now_iso,
                "next_claim_at": next_claim_at,
                "wallet_transaction_id": payout["transaction_id"],
            },
            "$inc": {"total_claims": 1},
            "$unset": {
                "pending_claim_id": "",
                "pending_reward_blz": "",
                "claim_lock_until": "",
            },
        },
    )
    if finalized.modified_count != 1:
        raise HTTPException(status_code=500, detail="Quick-Bonus wurde gutgeschrieben, Abschluss benötigt Abstimmung")

    return {
        "success": True,
        "reward_blz": round(reward, 4),
        "next_claim_at": next_claim_at,
        "remaining_seconds": QUICK_BONUS_INTERVAL_HOURS * 3600,
        "replayed": bool(payout["replayed"]),
    }


# ── Streak info (for UI rendering of progress) ──
@router.get("/streak")
async def streak_info(request: Request):
    user = await get_current_user(request)
    user_id = str(user["_id"])
    profile = await _get_profile(user_id)
    streak = int(profile.get("streak_days", 0))
    claimed = set(profile.get("claimed_milestones", []))
    nxt = _next_milestone(streak)
    milestones = []
    for m in STREAK_MILESTONES:
        milestones.append({
            **m,
            "reached": streak >= m["days"],
            "claimed": m["days"] in claimed,
        })
    return {
        "current_streak": streak,
        "streak_bonus": round(_streak_multiplier(streak), 3),
        "next_milestone": nxt,
        "days_to_next": (nxt["days"] - streak) if nxt else 0,
        "milestones": milestones,
        "cap": STREAK_MULTIPLIER_CAP,
    }


@router.get("/reminders")
async def get_reminders(request: Request):
    user = await get_current_user(request)
    user_id = str(user["_id"])
    settings = await _get_reminder_settings(user_id)
    has_push = await db.push_subscriptions.count_documents({"user_id": user_id, "active": True}) > 0
    return {**settings, "push_connected": has_push}


@router.post("/reminders")
async def save_reminders(req: ReminderSettingsReq, request: Request):
    user = await get_current_user(request)
    user_id = str(user["_id"])
    payload = req.model_dump()
    await db.blitz_mine_reminder_settings.update_one(
        {"user_id": user_id},
        {"$set": {"user_id": user_id, **payload, "updated_at": _now().isoformat()}},
        upsert=True,
    )
    return {"success": True, **payload}


@router.post("/reminders/test")
async def test_reminder(req: ReminderTestReq, request: Request):
    if not TEST_MODE:
        raise HTTPException(status_code=503, detail="BlitzMine Test-Push ist außerhalb TEST_MODE deaktiviert.")
    user = await get_current_user(request)
    user_id = str(user["_id"])
    has_push = await db.push_subscriptions.count_documents({"user_id": user_id, "active": True})
    if not has_push:
        raise HTTPException(400, "Bitte zuerst Push-Benachrichtigungen aktivieren.")

    messages = {
        "claim_ready": ("⚡ BlitzMine Claim", "Deine Session ist bereit – hol dir jetzt deine BLZ."),
        "quick_bonus": ("🎁 Quick Bonus bereit", "Dein BlitzMine Bonus wartet. Jetzt öffnen und abholen."),
        "leaderboard": ("🏆 Leaderboard Push", "Du kannst heute im BlitzMine-Ranking weiter nach oben klettern."),
    }
    title, body = messages[req.kind]
    from routes.web_push import send_push_to_user
    await send_push_to_user(user_id, title, body, data={"url": "/blitz-mine", "type": f"blitz_mine_{req.kind}"})
    return {"success": True, "sent": has_push, "kind": req.kind}


# ── Security Circle ──
@router.get("/circle")
async def get_circle(request: Request):
    user = await get_current_user(request)
    user_id = str(user["_id"])
    doc = await db.blitz_mine_circle.find_one({"user_id": user_id}, {"_id": 0})
    members = (doc or {}).get("members", [])
    return {
        "members": members,
        "max": CIRCLE_MAX,
        "bonus_per_member": CIRCLE_BONUS_PER_MEMBER,
        "current_bonus": round(len(members) * CIRCLE_BONUS_PER_MEMBER, 3),
    }


@router.post("/circle/add")
async def add_circle(req: AddCircleReq, request: Request):
    user = await get_current_user(request)
    user_id = str(user["_id"])

    target = await _user_lookup(req.identifier)
    if not target:
        raise HTTPException(404, "Nutzer nicht gefunden.")
    target_id = str(target["_id"])
    if target_id == user_id:
        raise HTTPException(400, "Du kannst dich nicht selbst hinzufügen.")

    doc = await db.blitz_mine_circle.find_one({"user_id": user_id}, {"_id": 0}) or {
        "user_id": user_id, "members": []
    }
    members = doc.get("members", [])
    if any(m["user_id"] == target_id for m in members):
        raise HTTPException(409, "Dieser Nutzer ist bereits in deinem Security Circle.")
    if len(members) >= CIRCLE_MAX:
        raise HTTPException(400, f"Maximal {CIRCLE_MAX} Mitglieder erlaubt.")

    members.append({
        "user_id": target_id,
        "username": target.get("username") or target.get("email", "").split("@")[0],
        "added_at": _now().isoformat(),
    })
    await db.blitz_mine_circle.update_one(
        {"user_id": user_id},
        {"$set": {"members": members, "user_id": user_id}},
        upsert=True,
    )
    return {"success": True, "members": members}


@router.delete("/circle/{member_id}")
async def remove_circle(member_id: str, request: Request):
    user = await get_current_user(request)
    user_id = str(user["_id"])
    doc = await db.blitz_mine_circle.find_one({"user_id": user_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Kein Security Circle vorhanden.")
    members = [m for m in doc.get("members", []) if m["user_id"] != member_id]
    await db.blitz_mine_circle.update_one(
        {"user_id": user_id}, {"$set": {"members": members}}
    )
    return {"success": True, "members": members}


# ── Lockup ──
@router.get("/lockup")
async def get_lockups(request: Request):
    user = await get_current_user(request)
    user_id = str(user["_id"])
    cur = db.blitz_mine_lockup.find({"user_id": user_id}).sort("started_at", -1)
    raw_items = await cur.to_list(100)
    items = []
    for row in raw_items:
        item = {**row}
        item["id"] = item.get("lockup_id") or str(item.get("_id"))
        item.pop("_id", None)
        items.append(item)
    return {
        "lockups": items,
        "durations": [{"days": d, **info} for d, info in LOCKUP_DURATIONS.items()],
        "cap": LOCKUP_BONUS_CAP,
        "early_release_penalty": LOCKUP_EARLY_RELEASE_PENALTY,
    }


@router.post("/lockup")
async def create_lockup(req: LockupReq, request: Request):
    _require_blitz_mine_value_mode()
    user = await get_current_user(request)
    user_id = str(user["_id"])

    if req.duration_days not in LOCKUP_DURATIONS:
        raise HTTPException(400, "Ungültige Lockup-Dauer.")
    if req.amount < 1:
        raise HTTPException(400, "Mindestbetrag: 1 BLZ.")

    idem = _require_blitz_idempotency_key(req.idempotency_key, request, "blitz-lockup")
    digest = hashlib.sha256(f"{user_id}:{idem}".encode("utf-8")).hexdigest()[:24]
    lockup_key = f"BLK-{digest.upper()}"
    payload = {
        "amount": round(float(req.amount), 4),
        "duration_days": int(req.duration_days),
    }
    existing = await db.blitz_mine_lockup.find_one(
        {"lockup_id": lockup_key, "user_id": user_id},
        {"_id": 0},
    )
    if existing and existing.get("request_payload") != payload:
        raise HTTPException(status_code=409, detail="Idempotency-Key wurde mit anderen Lockup-Daten verwendet")
    if existing:
        return {"success": True, "lockup": {**existing, "id": lockup_key}, "replayed": True}

    debit = await _mutate_blitz_wallet_once(
        user_id=user_id,
        amount=req.amount,
        direction="debit",
        idempotency_key=f"blitz-lockup-create:{lockup_key}:debit",
        description=f"BlitzMine Lockup {req.duration_days} Tage",
        category="blitz_mine_lockup",
    )

    now = _now()
    ends = now + timedelta(days=req.duration_days)
    bonus = _lockup_bonus_for(req.amount, req.duration_days)
    lk = {
        "lockup_id": lockup_key,
        "user_id": user_id,
        "amount": round(float(req.amount), 4),
        "duration_days": req.duration_days,
        "bonus_rate": bonus,
        "request_payload": payload,
        "debit_transaction_id": debit["transaction_id"],
        "started_at": now.isoformat(),
        "ends_at": ends.isoformat(),
        "status": "active",
    }
    try:
        await db.blitz_mine_lockup.update_one(
            {"lockup_id": lockup_key, "user_id": user_id},
            {"$setOnInsert": lk},
            upsert=True,
        )
    except Exception as exc:
        await _mutate_blitz_wallet_once(
            user_id=user_id,
            amount=req.amount,
            direction="credit",
            idempotency_key=f"blitz-lockup-create:{lockup_key}:rollback",
            description="BlitzMine Lockup Rollback",
            category="blitz_mine_lockup_rollback",
        )
        raise HTTPException(status_code=500, detail="Lockup konnte nicht sicher gespeichert werden") from exc

    stored = await db.blitz_mine_lockup.find_one(
        {"lockup_id": lockup_key, "user_id": user_id},
        {"_id": 0},
    ) or lk
    if stored.get("request_payload") != payload:
        raise HTTPException(status_code=409, detail="Idempotency-Key wurde mit anderen Lockup-Daten verwendet")
    return {"success": True, "lockup": {**stored, "id": lockup_key}, "replayed": bool(debit["replayed"])}


@router.post("/lockup/{lockup_id}/release")
async def release_lockup(lockup_id: str, request: Request):
    _require_blitz_mine_value_mode()
    user = await get_current_user(request)
    user_id = str(user["_id"])

    selectors = [{"lockup_id": lockup_id}]
    if ObjectId.is_valid(lockup_id):
        selectors.append({"_id": ObjectId(lockup_id)})
    query = {"user_id": user_id, "$or": selectors}
    lk = await db.blitz_mine_lockup.find_one(query)
    if not lk:
        raise HTTPException(404, "Lockup nicht gefunden.")
    if lk.get("status") in {"completed", "released"}:
        return {
            "success": True,
            "refund_blz": round(float(lk.get("refunded") or 0), 4),
            "penalty_blz": round(float(lk.get("penalty") or 0), 4),
            "status": lk.get("status"),
            "replayed": True,
        }
    if lk.get("status") == "reconciliation_required":
        raise HTTPException(status_code=503, detail="Lockup-Freigabe benötigt Abstimmung; keine erneute BLZ-Gutschrift wird ausgeführt")

    stable_id = str(lk.get("lockup_id") or lk.get("_id"))
    if lk.get("status") == "active":
        ends_at = datetime.fromisoformat(lk["ends_at"].replace("Z", "+00:00"))
        amount = float(lk["amount"])
        if ends_at <= _now():
            refund = amount
            final_status = "completed"
            penalty = 0.0
        else:
            penalty = round(amount * LOCKUP_EARLY_RELEASE_PENALTY, 4)
            refund = round(amount - penalty, 4)
            final_status = "released"

        claimed = await db.blitz_mine_lockup.update_one(
            {"_id": lk["_id"], "user_id": user_id, "status": "active"},
            {"$set": {
                "status": "releasing",
                "release_target_status": final_status,
                "refunded": refund,
                "penalty": penalty,
                "release_started_at": _now().isoformat(),
            }},
        )
        if claimed.modified_count != 1:
            lk = await db.blitz_mine_lockup.find_one({"_id": lk["_id"], "user_id": user_id}) or {}
        else:
            lk = {
                **lk,
                "status": "releasing",
                "release_target_status": final_status,
                "refunded": refund,
                "penalty": penalty,
            }

    if lk.get("status") in {"completed", "released"}:
        return {
            "success": True,
            "refund_blz": round(float(lk.get("refunded") or 0), 4),
            "penalty_blz": round(float(lk.get("penalty") or 0), 4),
            "status": lk.get("status"),
            "replayed": True,
        }
    if lk.get("status") != "releasing":
        raise HTTPException(status_code=409, detail="Lockup kann in diesem Zustand nicht freigegeben werden.")

    refund = round(float(lk.get("refunded") or 0), 4)
    penalty = round(float(lk.get("penalty") or 0), 4)
    final_status = lk.get("release_target_status")
    if final_status not in {"completed", "released"} or refund <= 0:
        await db.blitz_mine_lockup.update_one(
            {"_id": lk["_id"], "user_id": user_id, "status": "releasing"},
            {"$set": {
                "status": "reconciliation_required",
                "release_error": "invalid_persisted_release_state",
                "reconciliation_required_at": _now().isoformat(),
            }},
        )
        raise HTTPException(status_code=503, detail="Lockup-Freigabezustand unklar; Abstimmung erforderlich")

    payout = await _mutate_blitz_wallet_once(
        user_id=user_id,
        amount=refund,
        direction="credit",
        idempotency_key=f"blitz-lockup-release:{stable_id}",
        description=f"BlitzMine Lockup Freigabe ({final_status})",
        category="blitz_mine_lockup_release",
    )
    finalized = await db.blitz_mine_lockup.update_one(
        {"_id": lk["_id"], "user_id": user_id, "status": "releasing"},
        {"$set": {
            "status": final_status,
            "released_at": _now().isoformat(),
            "refund_transaction_id": payout["transaction_id"],
        }, "$unset": {"release_target_status": ""}},
    )
    if finalized.modified_count != 1:
        current = await db.blitz_mine_lockup.find_one({"_id": lk["_id"], "user_id": user_id}) or {}
        if current.get("status") in {"completed", "released"}:
            return {
                "success": True,
                "refund_blz": round(float(current.get("refunded") or refund), 4),
                "penalty_blz": round(float(current.get("penalty") or penalty), 4),
                "status": current.get("status"),
                "replayed": True,
            }
        await db.blitz_mine_lockup.update_one(
            {"_id": lk["_id"], "user_id": user_id},
            {"$set": {
                "status": "reconciliation_required",
                "release_error": "payout_applied_finalize_not_confirmed",
                "refund_transaction_id": payout["transaction_id"],
                "reconciliation_required_at": _now().isoformat(),
            }},
        )
        raise HTTPException(status_code=503, detail="BLZ wurden genau einmal gutgeschrieben; Lockup-Abschluss benötigt Abstimmung")
    return {
        "success": True,
        "refund_blz": refund,
        "penalty_blz": penalty,
        "status": final_status,
        "replayed": bool(payout["replayed"]),
    }


@router.get("/leaderboard")
async def leaderboard(request: Request):
    await get_current_user(request)
    pipeline = [
        {"$sort": {"total_mined": -1}},
        {"$limit": 20},
        {"$project": {"_id": 0, "user_id": 1, "total_mined": 1, "total_sessions": 1, "role": 1, "streak_days": 1}},
    ]
    top = await db.blitz_mine_profile.aggregate(pipeline).to_list(20)
    # enrich with usernames
    ids = [t["user_id"] for t in top]
    users = {}
    if ids:
        from bson import ObjectId
        obj_ids = []
        for i in ids:
            try:
                obj_ids.append(ObjectId(i))
            except Exception:
                pass
        cur = db.users.find({"_id": {"$in": obj_ids}}, {"username": 1, "email": 1})
        async for u in cur:
            users[str(u["_id"])] = u.get("username") or (u.get("email", "").split("@")[0])
    for t in top:
        t["username"] = users.get(t["user_id"], "Pioneer")
    return {"leaderboard": top}


# ── Referrals summary for this module ──
@router.get("/referrals")
async def referrals(request: Request):
    user = await get_current_user(request)
    user_id = str(user["_id"])
    refs = await db.users.find({"referred_by": user_id}, {"username": 1, "email": 1, "_id": 1, "created_at": 1}).to_list(200)
    out = []
    cutoff = (_now() - timedelta(days=7)).isoformat()
    for r in refs:
        rid = str(r.get("_id"))
        active = await db.blitz_mine_sessions.count_documents({
            "user_id": rid, "started_at": {"$gt": cutoff}
        })
        out.append({
            "user_id": rid,
            "username": r.get("username") or r.get("email", "").split("@")[0],
            "joined_at": r.get("created_at"),
            "active_last_7d": active > 0,
        })
    active_count = sum(1 for o in out if o["active_last_7d"])
    return {
        "total": len(out),
        "active_last_7d": active_count,
        "bonus_per_active": REFERRAL_BONUS_PER_ACTIVE,
        "current_bonus": min(active_count * REFERRAL_BONUS_PER_ACTIVE, REFERRAL_BONUS_CAP),
        "cap": REFERRAL_BONUS_CAP,
        "team": out,
    }
