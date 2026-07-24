"""
BidBlitz — Referral / Provisions Engine
========================================
Auto-credits referrer wallet when:
  - referee completes signup (one-time bonus, e.g. 5€)
  - referee tops up wallet (lifetime % commission, e.g. 10%)

Endpoints:
  POST /api/referral/apply         — referee applies a code at signup/anytime
  GET  /api/referral/me            — own referral stats (code, count, earnings)
  GET  /api/referral/leaderboard   — top 20 referrers (admin or public)

Hook (called by wallet topup flow):
  award_topup_commission(referee_user_id, topup_amount_eur)
"""
from __future__ import annotations
import secrets
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from core.database import db
from core.security import get_current_user

router = APIRouter(prefix="/api/referrals", tags=["referrals-engine"])

SIGNUP_BONUS_EUR = 5.00
TOPUP_COMMISSION_PCT = 0.10  # 10%
MAX_COMMISSION_PER_TOPUP = 50.00  # cap so a single huge topup doesn't drain


class ApplyCodeRequest(BaseModel):
    code: str = Field(..., min_length=4, max_length=24)


async def _get_or_create_code(user_id: str, email: str) -> str:
    user = await db.users.find_one({"_id": user_id} if not isinstance(user_id, str)
                                    else __import__("bson").objectid.ObjectId(user_id))
    # ensure attribute exists
    if user and user.get("referral_code"):
        return user["referral_code"]
    # generate new
    base = (email.split("@")[0][:6] or "BB").upper()
    code = f"{base}-{secrets.token_hex(2).upper()}"
    await db.users.update_one({"_id": user["_id"]}, {"$set": {"referral_code": code}})
    return code


@router.get("/me")
async def my_referral_stats(request: Request):
    user = await get_current_user(request)
    user_id = str(user["_id"])
    code = await _get_or_create_code(user_id, user.get("email", ""))

    invited = await db.users.count_documents({"referred_by_code": code})

    # Sum all referral_payout transactions
    pipeline = [
        {"$match": {"user_id": user_id, "type": "referral_payout"}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}, "count": {"$sum": 1}}},
    ]
    agg = await db.transactions.aggregate(pipeline).to_list(1)
    total_earned = agg[0]["total"] if agg else 0.0
    payout_count = agg[0]["count"] if agg else 0

    return {
        "code": code,
        "share_url": f"https://bidblitz.ae/?ref={code}",
        "invited_count": invited,
        "total_earned_eur": round(float(total_earned), 2),
        "payout_count": payout_count,
        "signup_bonus_eur": SIGNUP_BONUS_EUR,
        "topup_commission_pct": TOPUP_COMMISSION_PCT,
    }


@router.post("/apply")
async def apply_referral_code(req: ApplyCodeRequest, request: Request):
    user = await get_current_user(request)
    user_id_obj = user["_id"]
    user_id = str(user_id_obj)

    if user.get("referred_by_code"):
        raise HTTPException(status_code=400, detail="Referral-Code bereits verwendet")

    referrer = await db.users.find_one({"referral_code": req.code.upper()})
    if not referrer:
        raise HTTPException(status_code=404, detail="Code nicht gefunden")
    if str(referrer["_id"]) == user_id:
        raise HTTPException(status_code=400, detail="Eigenen Code nicht verwendbar")

    now = datetime.now(timezone.utc).isoformat()
    referrer_id = str(referrer["_id"])

    # 1. Mark referee
    await db.users.update_one(
        {"_id": user_id_obj},
        {"$set": {"referred_by_code": req.code.upper(), "referred_by_user_id": referrer_id, "referred_at": now}},
    )
    # 2. Award SIGNUP_BONUS to referrer wallet
    await db.users.update_one({"_id": referrer["_id"]}, {"$inc": {"balance": SIGNUP_BONUS_EUR}})
    # 3. Log transaction
    await db.transactions.insert_one({
        "user_id": referrer_id,
        "type": "referral_signup_bonus",
        "amount": SIGNUP_BONUS_EUR,
        "currency": "EUR",
        "description": f"Empfehlungsbonus: {user.get('email')} hat sich registriert",
        "metadata": {"referee_user_id": user_id, "code": req.code.upper()},
        "created_at": now,
    })
    return {"ok": True, "bonus_credited_to_referrer": SIGNUP_BONUS_EUR}


@router.get("/leaderboard")
async def leaderboard():
    """Top 20 referrers — public for transparency / gamification."""
    pipeline = [
        {"$match": {"type": "referral_payout"}},
        {"$group": {"_id": "$user_id", "total": {"$sum": "$amount"}, "count": {"$sum": 1}}},
        {"$sort": {"total": -1}},
        {"$limit": 20},
    ]
    rows = await db.transactions.aggregate(pipeline).to_list(20)

    # Hydrate names
    from bson import ObjectId
    out = []
    for r in rows:
        try:
            u = await db.users.find_one({"_id": ObjectId(r["_id"])}, {"_id": 0, "name": 1, "email": 1})
        except Exception:
            u = None
        if not u:
            continue
        # Anonymize email
        email = u.get("email", "")
        anon = email[0] + "***" + email.split("@")[-1] if email else "?"
        out.append({
            "name": u.get("name") or anon,
            "total_earned": round(float(r["total"]), 2),
            "payout_count": r["count"],
        })
    return {"leaderboard": out}


# ─── INTERNAL HOOK — call from wallet topup success path ───────────────────
async def award_topup_commission(referee_user_id: str, topup_amount_eur: float) -> dict:
    """
    Award a one-time commission to the referrer for this topup.
    Returns {"awarded": float, "referrer_id": str|None}
    """
    from bson import ObjectId
    try:
        referee_oid = ObjectId(referee_user_id) if isinstance(referee_user_id, str) else referee_user_id
        referee = await db.users.find_one({"_id": referee_oid}, {"_id": 0, "referred_by_user_id": 1, "email": 1})
    except Exception:
        return {"awarded": 0.0, "referrer_id": None}
    if not referee or not referee.get("referred_by_user_id"):
        return {"awarded": 0.0, "referrer_id": None}

    commission = round(min(topup_amount_eur * TOPUP_COMMISSION_PCT, MAX_COMMISSION_PER_TOPUP), 2)
    if commission <= 0:
        return {"awarded": 0.0, "referrer_id": referee["referred_by_user_id"]}

    referrer_id = referee["referred_by_user_id"]
    now = datetime.now(timezone.utc).isoformat()

    await db.users.update_one({"_id": ObjectId(referrer_id)}, {"$inc": {"balance": commission}})
    await db.transactions.insert_one({
        "user_id": referrer_id,
        "type": "referral_payout",
        "amount": commission,
        "currency": "EUR",
        "description": f"Provision: {referee.get('email')} hat €{topup_amount_eur:.2f} aufgeladen",
        "metadata": {
            "referee_user_id": str(referee_oid),
            "topup_amount": topup_amount_eur,
            "commission_pct": TOPUP_COMMISSION_PCT,
        },
        "created_at": now,
    })
    return {"awarded": commission, "referrer_id": referrer_id}
