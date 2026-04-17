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

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from core.database import db
from core.security import get_current_user

router = APIRouter(prefix="/api/blitz-mine", tags=["blitz-mine"])

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

LOCKUP_DURATIONS = {
    14:   {"label": "2 Wochen",  "multiplier": 0.10},   # +10%
    180:  {"label": "6 Monate",  "multiplier": 0.30},   # +30%
    365:  {"label": "1 Jahr",    "multiplier": 0.60},   # +60%
    1095: {"label": "3 Jahre",   "multiplier": 1.20},   # +120%
}
LOCKUP_EARLY_RELEASE_PENALTY = 0.25   # 25% penalty on locked amount
LOCKUP_BONUS_CAP = 2.00               # total lockup bonus cannot exceed +200%

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

    total_multiplier = role_mult * (1.0 + circle_bonus + referral_bonus + lockup_bonus)
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
        "total_multiplier": round(total_multiplier, 3),
        "rate_per_hour": round(rate_per_hour, 6),
        "estimated_session_earnings": round(estimated, 4),
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


# ── Endpoints ──
@router.get("/status")
async def status(request: Request):
    user = await get_current_user(request)
    user_id = str(user["_id"])

    profile = await _get_profile(user_id)
    profile = await _promote_role_if_needed(user_id, profile)
    rate = await _compute_rate(user_id, profile)
    session = await _get_active_session(user_id)

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
            "ready_to_claim": ready,
        }

    wallet = await db.wallets.find_one({"user_id": user_id}, {"_id": 0, "balance_blz": 1})
    blz_balance = (wallet or {}).get("balance_blz", 0.0)

    # next role target
    role_idx = ROLE_ORDER.index(profile.get("role", "pioneer"))
    next_role = ROLE_ORDER[role_idx + 1] if role_idx + 1 < len(ROLE_ORDER) else None

    return {
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
    user = await get_current_user(request)
    user_id = str(user["_id"])

    existing = await _get_active_session(user_id)
    if existing:
        raise HTTPException(409, "Du hast bereits eine aktive Mining-Session. Bitte erst beanspruchen.")

    profile = await _get_profile(user_id)
    profile = await _promote_role_if_needed(user_id, profile)
    rate = await _compute_rate(user_id, profile)

    now = _now()
    ends = now + timedelta(hours=SESSION_HOURS)
    session = {
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
    }
    await db.blitz_mine_sessions.insert_one(dict(session))
    session.pop("_id", None)

    if not profile.get("first_session_at"):
        await db.blitz_mine_profile.update_one(
            {"user_id": user_id},
            {"$set": {"first_session_at": now.isoformat()}},
        )

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
    }


@router.post("/claim")
async def claim(request: Request):
    user = await get_current_user(request)
    user_id = str(user["_id"])

    session = await _get_active_session(user_id)
    if not session:
        raise HTTPException(404, "Keine aktive Session gefunden. Tippe erst den Mining-Button.")

    ends_at = datetime.fromisoformat(session["ends_at"].replace("Z", "+00:00"))
    if ends_at > _now():
        remaining = int((ends_at - _now()).total_seconds())
        raise HTTPException(400, f"Session läuft noch {remaining // 3600}h {(remaining % 3600) // 60}m.")

    earnings = float(session.get("estimated_earnings", 0.0))

    # Credit BLZ to wallet
    await db.wallets.update_one(
        {"user_id": user_id},
        {"$inc": {"balance_blz": earnings},
         "$setOnInsert": {"user_id": user_id, "balance": 0.0}},
        upsert=True,
    )

    # Mark session claimed
    await db.blitz_mine_sessions.update_one(
        {"user_id": user_id, "started_at": session["started_at"]},
        {"$set": {"claimed": True, "claimed_at": _now().isoformat(), "final_earnings": earnings}},
    )

    # Update profile: streak, totals
    profile = await _get_profile(user_id)
    last_claim = profile.get("last_claim_date")
    today = _now().date().isoformat()
    yesterday = (_now().date() - timedelta(days=1)).isoformat()
    new_streak = profile.get("streak_days", 0) + 1 if last_claim == yesterday else 1

    await db.blitz_mine_profile.update_one(
        {"user_id": user_id},
        {"$inc": {"total_mined": earnings, "total_sessions": 1},
         "$set": {"last_claim_date": today, "streak_days": new_streak}},
    )

    # Record tx for history
    await db.transactions.insert_one({
        "user_id": user_id,
        "type": "blitz_mine_claim",
        "amount_blz": earnings,
        "amount_eur": 0.0,
        "description": f"BlitzMine Reward ({new_streak}d streak)",
        "created_at": _now().isoformat(),
    })

    return {
        "success": True,
        "amount_blz": round(earnings, 4),
        "streak_days": new_streak,
        "total_mined": round(profile.get("total_mined", 0.0) + earnings, 4),
    }


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
    cur = db.blitz_mine_lockup.find({"user_id": user_id}, {"_id": 0}).sort("started_at", -1)
    items = await cur.to_list(100)
    return {
        "lockups": items,
        "durations": [{"days": d, **info} for d, info in LOCKUP_DURATIONS.items()],
        "cap": LOCKUP_BONUS_CAP,
        "early_release_penalty": LOCKUP_EARLY_RELEASE_PENALTY,
    }


@router.post("/lockup")
async def create_lockup(req: LockupReq, request: Request):
    user = await get_current_user(request)
    user_id = str(user["_id"])

    if req.duration_days not in LOCKUP_DURATIONS:
        raise HTTPException(400, "Ungültige Lockup-Dauer.")
    if req.amount < 1:
        raise HTTPException(400, "Mindestbetrag: 1 BLZ.")

    wallet = await db.wallets.find_one({"user_id": user_id}, {"_id": 0})
    if not wallet or (wallet.get("balance_blz", 0) < req.amount):
        raise HTTPException(400, "Nicht genug BLZ im Wallet.")

    # Deduct from wallet into lockup
    await db.wallets.update_one(
        {"user_id": user_id},
        {"$inc": {"balance_blz": -req.amount}},
    )

    now = _now()
    ends = now + timedelta(days=req.duration_days)
    bonus = _lockup_bonus_for(req.amount, req.duration_days)
    lk = {
        "user_id": user_id,
        "amount": req.amount,
        "duration_days": req.duration_days,
        "bonus_rate": bonus,
        "started_at": now.isoformat(),
        "ends_at": ends.isoformat(),
        "status": "active",
    }
    await db.blitz_mine_lockup.insert_one(dict(lk))
    lk.pop("_id", None)
    return {"success": True, "lockup": lk}


@router.post("/lockup/{lockup_id}/release")
async def release_lockup(lockup_id: str, request: Request):
    user = await get_current_user(request)
    user_id = str(user["_id"])
    from bson import ObjectId
    try:
        oid = ObjectId(lockup_id)
    except Exception:
        raise HTTPException(400, "Ungültige Lockup-ID.")

    lk = await db.blitz_mine_lockup.find_one({"_id": oid, "user_id": user_id})
    if not lk:
        raise HTTPException(404, "Lockup nicht gefunden.")
    if lk.get("status") != "active":
        raise HTTPException(400, "Lockup ist nicht aktiv.")

    ends_at = datetime.fromisoformat(lk["ends_at"].replace("Z", "+00:00"))
    amount = float(lk["amount"])
    if ends_at <= _now():
        # Completed: full refund
        refund = amount
        status = "completed"
        penalty = 0.0
    else:
        # Early release: penalty
        penalty = round(amount * LOCKUP_EARLY_RELEASE_PENALTY, 4)
        refund = round(amount - penalty, 4)
        status = "released"

    await db.blitz_mine_lockup.update_one(
        {"_id": oid}, {"$set": {"status": status, "released_at": _now().isoformat(), "refunded": refund, "penalty": penalty}}
    )
    await db.wallets.update_one(
        {"user_id": user_id},
        {"$inc": {"balance_blz": refund}},
    )
    return {"success": True, "refund_blz": refund, "penalty_blz": penalty, "status": status}


# ── Leaderboard ──
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
