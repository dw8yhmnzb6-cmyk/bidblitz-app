"""
Revenue Features:
1. Sponsored Listings (Händler zahlen für Top-Platzierung)
2. Affiliate Program (User verdienen mit Referral-Links)
"""
from datetime import datetime, timezone, timedelta
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from bson import ObjectId
import secrets
import logging

from core.database import db
from core.security import get_current_user
from core.config import TEST_MODE
from core.payment_engine import debit_wallet, credit_wallet, TransactionType

logger = logging.getLogger("bidblitz.revenue")
router = APIRouter(prefix="/api", tags=["revenue"])


def _oid(s):
    try:
        return ObjectId(s)
    except Exception:
        return s


async def _require_admin(request: Request):
    user = await get_current_user(request)
    if user.get("role") not in ("admin", "super_admin"):
        raise HTTPException(403, "Admin only")
    return user


def _require_revenue_idempotency_key(body_key: Optional[str], request: Request, prefix: str) -> str:
    key = (body_key or request.headers.get("Idempotency-Key") or "").strip()
    if not 8 <= len(key) <= 200:
        raise HTTPException(status_code=400, detail="Idempotency-Key erforderlich")
    return f"{prefix}:{key}"


# ═══════════════════════════════════════════════════════════
# SPONSORED LISTINGS
# ═══════════════════════════════════════════════════════════
SPONSOR_TIERS = {
    "week": {"price_eur": 9.99, "duration_days": 7, "label": "1 Woche"},
    "month": {"price_eur": 29.99, "duration_days": 30, "label": "1 Monat"},
    "quarter": {"price_eur": 69.99, "duration_days": 90, "label": "3 Monate"},
}

SPONSOR_COLLECTIONS = {
    "handwerker": "handwerker",
    "gebrauchtwagen": "gebrauchtwagen",
    "reinigung": "cleaning_services",
    "umzug": "moving_companies",
    "tierbetreuung": "pet_sitters",
    "telemedizin": "telemedicine_doctors",
    "dating": "dating_profiles",
    "fitness": "fitness_gyms",
    "reisen": "travel_trips",
    "ladesaeulen": "ev_charging_stations",
}


class SponsorRequest(BaseModel):
    module_key: str
    item_id: str
    tier: str = "week"
    idempotency_key: Optional[str] = None


@router.get("/sponsor/tiers")
async def sponsor_tiers_list():
    return {"tiers": SPONSOR_TIERS, "modules": list(SPONSOR_COLLECTIONS.keys())}


@router.post("/sponsor/purchase")
async def purchase_sponsor(req: SponsorRequest, request: Request):
    """Purchase a sponsored placement through the canonical wallet engine."""
    user = await get_current_user(request)
    uid = str(user.get("_id") or user.get("id"))
    if not TEST_MODE and user.get("role") != "admin" and user.get("kyc_status") != "approved":
        raise HTTPException(
            status_code=403,
            detail={"error": "kyc_required", "message": "KYC-Verifizierung erforderlich."},
        )
    if req.module_key not in SPONSOR_COLLECTIONS:
        raise HTTPException(400, "Unbekanntes Modul")
    if req.tier not in SPONSOR_TIERS:
        raise HTTPException(400, "Ungültiger Tier")

    key = _require_revenue_idempotency_key(req.idempotency_key, request, "sponsor")
    key_hash = hashlib.sha256(f"{uid}:{key}".encode("utf-8")).hexdigest()[:24]
    purchase_id = f"SPONSOR-{key_hash.upper()}"
    tier_cfg = SPONSOR_TIERS[req.tier]
    price = float(tier_cfg["price_eur"])
    coll_name = SPONSOR_COLLECTIONS[req.module_key]

    item_query = {"$or": [{"id": req.item_id}]}
    try:
        item_query["$or"].append({"_id": ObjectId(req.item_id)})
    except Exception:
        pass
    item = await db[coll_name].find_one(item_query)
    if not item:
        raise HTTPException(status_code=404, detail="Eintrag nicht gefunden")

    owner_candidates = {
        str(item.get("user_id") or ""),
        str(item.get("owner_id") or ""),
        str(item.get("merchant_user_id") or ""),
    }
    owner_candidates.discard("")
    if owner_candidates and uid not in owner_candidates and user.get("role") not in {"admin", "super_admin"}:
        raise HTTPException(status_code=403, detail="Du kannst nur eigene Einträge bewerben")

    payload = {
        "user_id": uid,
        "module_key": req.module_key,
        "item_id": req.item_id,
        "tier": req.tier,
        "price": price,
    }
    existing = await db.sponsor_purchases.find_one({"_id": purchase_id}, {"_id": 0})
    if existing:
        if existing.get("payload") != payload:
            raise HTTPException(status_code=409, detail="Idempotency-Key wurde mit anderen Daten verwendet")
        if existing.get("status") == "completed":
            fresh = await db.users.find_one({"_id": user["_id"]}, {"balance": 1, "_id": 0}) or {}
            return {
                "ok": True,
                "expires_at": existing["expires_at"],
                "price": price,
                "new_balance": round(float(fresh.get("balance") or 0), 2),
                "replayed": True,
            }

    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(days=int(tier_cfg["duration_days"]))
    await db.sponsor_purchases.update_one(
        {"_id": purchase_id},
        {"$setOnInsert": {
            "_id": purchase_id,
            "payload": payload,
            "status": "pending",
            "created_at": now.isoformat(),
            "expires_at": expires_at.isoformat(),
        }},
        upsert=True,
    )
    purchase = await db.sponsor_purchases.find_one({"_id": purchase_id}, {"_id": 0}) or {}
    expires_at_iso = str(purchase.get("expires_at") or expires_at.isoformat())

    payment = await debit_wallet(
        user_id=uid,
        amount=price,
        tx_type=TransactionType.PAYMENT,
        description=f"Sponsored Listing: {req.module_key} ({tier_cfg['label']})",
        reference=purchase_id,
        metadata={
            "category": "sponsor",
            "module_key": req.module_key,
            "item_id": req.item_id,
            "tier": req.tier,
        },
        idempotency_key=f"revenue:{key}",
    )
    if not payment.success:
        status_code = 409 if payment.status.value in {"pending", "reconciliation_required"} else 400
        raise HTTPException(status_code=status_code, detail=payment.error or "Zahlung fehlgeschlagen")

    update = await db[coll_name].update_one(
        item_query,
        {"$set": {
            "sponsored": True,
            "sponsored_by": uid,
            "sponsored_tier": req.tier,
            "sponsored_expires_at": expires_at_iso,
            "sponsored_purchased_at": str(purchase.get("created_at") or now.isoformat()),
            "sponsor_purchase_id": purchase_id,
        }},
    )
    if update.matched_count != 1:
        rollback = await credit_wallet(
            user_id=uid,
            amount=price,
            tx_type=TransactionType.REFUND,
            description="Sponsored Listing Rollback",
            reference=f"{purchase_id}-REF",
            source="sponsor_purchase_rollback",
            metadata={"purchase_id": purchase_id, "item_id": req.item_id},
            idempotency_key=f"revenue:{key}:rollback",
        )
        await db.sponsor_purchases.update_one(
            {"_id": purchase_id},
            {"$set": {
                "status": "failed",
                "refund_transaction_id": rollback.transaction_id if rollback and rollback.success else None,
                "failed_at": datetime.now(timezone.utc).isoformat(),
            }},
        )
        if not rollback or not rollback.success:
            raise HTTPException(status_code=500, detail="Sponsored-Zahlung benötigt manuelle Abstimmung")
        raise HTTPException(status_code=409, detail="Eintrag änderte sich; Zahlung wurde zurückgebucht")

    await db.sponsor_purchases.update_one(
        {"_id": purchase_id},
        {"$set": {
            "status": "completed",
            "payment_transaction_id": payment.transaction_id,
            "completed_at": datetime.now(timezone.utc).isoformat(),
        }},
    )
    return {
        "ok": True,
        "expires_at": expires_at_iso,
        "price": price,
        "new_balance": payment.new_balance,
        "replayed": bool(payment.idempotent_replay),
    }

@router.get("/sponsor/my-active")
async def my_active_sponsors(request: Request):
    """Alle meine aktiven Sponsored-Einträge."""
    user = await get_current_user(request)
    uid = str(user.get("_id") or user.get("id"))
    now = datetime.now(timezone.utc).isoformat()
    results = []
    for mod_key, coll_name in SPONSOR_COLLECTIONS.items():
        cursor = db[coll_name].find(
            {"sponsored_by": uid, "sponsored_expires_at": {"$gt": now}},
            {"_id": 0, "sponsored_by": 0},
        )
        async for item in cursor:
            results.append({"module": mod_key, **item})
    return {"sponsored": results, "count": len(results)}


# ═══════════════════════════════════════════════════════════
# AFFILIATE PROGRAM
# ═══════════════════════════════════════════════════════════
AFFILIATE_SIGNUP_BONUS = 5.0  # €5 for referrer when referee signs up
AFFILIATE_FIRST_PURCHASE_PCT = 0.10  # 10% of referee's first purchase
AFFILIATE_RECURRING_PCT = 0.02  # 2% of all subsequent purchases (first 90 days)

TIER_THRESHOLDS = {
    "bronze": {"min_refs": 0, "bonus_mult": 1.0, "label": "Bronze"},
    "silver": {"min_refs": 5, "bonus_mult": 1.2, "label": "Silber"},
    "gold": {"min_refs": 20, "bonus_mult": 1.5, "label": "Gold"},
    "diamond": {"min_refs": 100, "bonus_mult": 2.0, "label": "Diamant"},
}


def _tier_for(refs: int) -> dict:
    current = TIER_THRESHOLDS["bronze"]
    for tier in ["bronze", "silver", "gold", "diamond"]:
        if refs >= TIER_THRESHOLDS[tier]["min_refs"]:
            current = {**TIER_THRESHOLDS[tier], "id": tier}
    return current


@router.get("/affiliate/me")
async def my_affiliate(request: Request):
    """Mein Affiliate-Profil mit Link, Stats, Einnahmen."""
    user = await get_current_user(request)
    uid = str(user.get("_id") or user.get("id"))

    # Ensure affiliate code exists
    profile = await db.affiliate_profiles.find_one({"user_id": uid})
    if not profile:
        code = secrets.token_urlsafe(6).replace("_", "").replace("-", "")[:8].upper()
        while await db.affiliate_profiles.find_one({"code": code}):
            code = secrets.token_urlsafe(6).replace("_", "").replace("-", "")[:8].upper()
        profile = {
            "user_id": uid,
            "code": code,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "total_earned": 0.0,
            "total_refs": 0,
            "clicks": 0,
        }
        await db.affiliate_profiles.insert_one(profile)
        profile.pop("_id", None)

    # Count actual referrals
    refs_count = await db.users.count_documents({"referred_by": profile["code"]})
    paid_refs = await db.affiliate_earnings.count_documents({"referrer_user_id": uid, "type": "signup"})
    total_earned = 0.0
    async for e in db.affiliate_earnings.aggregate([
        {"$match": {"referrer_user_id": uid}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}},
    ]):
        total_earned = float(e.get("total", 0))

    tier = _tier_for(refs_count)
    return {
        "code": profile["code"],
        "link": f"https://bidblitz.ae/?ref={profile['code']}",
        "short_link": f"https://bidblitz.ae/?ref={profile['code']}",
        "total_refs": refs_count,
        "paid_refs": paid_refs,
        "total_earned": round(total_earned, 2),
        "clicks": profile.get("clicks", 0),
        "tier": tier,
        "signup_bonus": AFFILIATE_SIGNUP_BONUS,
        "purchase_pct": AFFILIATE_FIRST_PURCHASE_PCT,
    }


@router.post("/affiliate/track-click/{code}")
async def track_click(code: str):
    """Incrementiert Click-Counter (Public)."""
    await db.affiliate_profiles.update_one({"code": code.upper()}, {"$inc": {"clicks": 1}})
    return {"ok": True}


@router.get("/affiliate/earnings")
async def my_earnings(request: Request, limit: int = 50):
    user = await get_current_user(request)
    uid = str(user.get("_id") or user.get("id"))
    cursor = db.affiliate_earnings.find(
        {"referrer_user_id": uid}, {"_id": 0},
    ).sort("created_at", -1).limit(limit)
    earnings = await cursor.to_list(length=limit)
    return {"earnings": earnings, "count": len(earnings)}


@router.get("/affiliate/leaderboard")
async def affiliate_leaderboard(limit: int = 20):
    pipeline = [
        {"$group": {"_id": "$referrer_user_id", "total": {"$sum": "$amount"}, "count": {"$sum": 1}}},
        {"$sort": {"total": -1}},
        {"$limit": limit},
    ]
    results = []
    async for row in db.affiliate_earnings.aggregate(pipeline):
        uid = row["_id"]
        u = await db.users.find_one({"_id": _oid(uid)}, {"name": 1, "email": 1, "_id": 0})
        name = (u or {}).get("name") or (u or {}).get("email", "").split("@")[0] or "?"
        results.append({
            "rank": len(results) + 1,
            "display_name": name[:16],
            "total_earned": round(float(row["total"]), 2),
            "referrals": row["count"],
        })
    return {"leaderboard": results}


class ClaimReferralRequest(BaseModel):
    code: str


@router.post("/affiliate/claim-signup-bonus")
async def claim_signup_bonus_internal(req: ClaimReferralRequest, request: Request):
    """Wird bei Signup auto-getriggert wenn ?ref= im Link war."""
    user = await get_current_user(request)
    uid = str(user.get("_id") or user.get("id"))

    # User must be brand new (< 10 minutes old)
    created_at = user.get("created_at", "")
    try:
        if datetime.fromisoformat(created_at.replace("Z", "+00:00")) < datetime.now(timezone.utc) - timedelta(minutes=30):
            raise HTTPException(400, "Registrierung zu alt für Referral-Bonus")
    except Exception:
        pass

    if user.get("referred_by"):
        raise HTTPException(400, "Referral bereits genutzt")

    profile = await db.affiliate_profiles.find_one({"code": req.code.upper()})
    if not profile:
        raise HTTPException(404, "Partner-Code nicht gefunden")
    if profile["user_id"] == uid:
        raise HTTPException(400, "Du kannst dich nicht selbst referieren")

    await db.users.update_one({"_id": _oid(uid)}, {"$set": {"referred_by": req.code.upper()}})

    # Credit referrer
    tier = _tier_for(await db.users.count_documents({"referred_by": req.code.upper()}))
    bonus = AFFILIATE_SIGNUP_BONUS * tier["bonus_mult"]
    await db.users.update_one({"_id": _oid(profile["user_id"])}, {"$inc": {"balance": bonus}})
    now = datetime.now(timezone.utc).isoformat()
    await db.affiliate_earnings.insert_one({
        "referrer_user_id": profile["user_id"],
        "referee_user_id": uid,
        "amount": bonus,
        "currency": "EUR",
        "type": "signup",
        "tier": tier["id"],
        "created_at": now,
    })
    await db.transactions.insert_one({
        "user_id": profile["user_id"],
        "type": "bonus",
        "amount": bonus,
        "currency": "EUR",
        "status": "completed",
        "description": f"Affiliate: Neuer Partner ({tier['label']})",
        "merchant_name": "BidBlitz",
        "category": "affiliate",
        "reference": f"AFF-SIGNUP-{now.replace('-','').replace(':','').replace('.','')[:18]}",
        "date": now,
        "created_at": now,
    })
    return {"ok": True, "credited_to_referrer": bonus}
