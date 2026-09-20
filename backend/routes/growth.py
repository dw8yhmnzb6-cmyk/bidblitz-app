"""
Growth Features Batch:
1. Daily Free-Spin (tägliches Glücksrad ohne Einsatz)
2. Birthday Bonus (€10 + 10 BLZ am Geburtstag)
3. Kleinanzeigen (Local Classifieds mit Boost-Monetarisierung)
4. Push-Trigger Hooks (nutzt existierende notifications-Collection)
"""
from datetime import datetime, timezone, timedelta
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from bson import ObjectId
import random
import secrets
import logging

from core.database import db
from core.config import TEST_MODE
from core.security import get_current_user
from core.payment_engine import credit_wallet, debit_wallet, TransactionType
try:
    from routes.quests import track_event as _quest_track
except Exception:
    async def _quest_track(*a, **kw): pass

logger = logging.getLogger("bidblitz.growth")
router = APIRouter(prefix="/api", tags=["growth"])


def _oid(s):
    try: return ObjectId(s)
    except Exception: return s


async def _notify(user_id: str, title: str, message: str, type_: str = "info"):
    await db.notifications.insert_one({
        "notification_id": secrets.token_hex(8),
        "user_id": user_id, "title": title, "message": message,
        "type": type_, "read": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })


# ══════════════════════════════════════════════════════════════
# 1. DAILY FREE-SPIN
# ══════════════════════════════════════════════════════════════

# Weighted prizes: (prize_type, value, weight)
SPIN_PRIZES = [
    {"type": "blz", "value": 1,   "weight": 30, "label": "1 BLZ"},
    {"type": "blz", "value": 5,   "weight": 25, "label": "5 BLZ"},
    {"type": "blz", "value": 10,  "weight": 18, "label": "10 BLZ"},
    {"type": "blz", "value": 25,  "weight": 12, "label": "25 BLZ"},
    {"type": "blz", "value": 50,  "weight": 8,  "label": "50 BLZ"},
    {"type": "blz", "value": 100, "weight": 4,  "label": "100 BLZ 🎉"},
    {"type": "eur", "value": 1,   "weight": 2,  "label": "1 €"},
    {"type": "eur", "value": 5,   "weight": 1,  "label": "5 € 💎"},
]

PREMIUM_SPINS_PER_DAY = 3
FREE_SPINS_PER_DAY = 1


async def _has_premium(user_id: str) -> bool:
    sub = await db.premium_subscriptions.find_one({"user_id": user_id, "active": True})
    if not sub: return False
    exp = sub.get("expires_at")
    if not exp: return False
    try:
        dt = datetime.fromisoformat(exp.replace("Z", "+00:00"))
        if dt.tzinfo is None: dt = dt.replace(tzinfo=timezone.utc)
        return dt > datetime.now(timezone.utc)
    except Exception:
        return False


@router.get("/spin-wheel/status")
async def spin_status(request: Request):
    await get_current_user(request)
    return {
        "deprecated": True,
        "remaining": 0,
        "limit": 0,
        "prizes": [],
        "value_rewards_enabled": False,
        "canonical_path": "/api/rewards/spin-wheel/status",
    }


@router.post("/spin-wheel/spin")
async def spin_wheel(request: Request):
    await get_current_user(request)
    raise HTTPException(
        status_code=410,
        detail="Legacy-Glücksrad deaktiviert. Verwende /api/rewards/spin-wheel/spin.",
    )


async def _spin_wheel_post_hook(uid: str):
    await _quest_track(uid, "spin_wheel", 1)


@router.get("/spin-wheel/leaderboard")
async def spin_leaderboard(request: Request, limit: int = 10):
    """Top spinners today (UTC) — by total prize value."""
    await get_current_user(request)
    today = datetime.now(timezone.utc).date().isoformat()

    pipeline = [
        {"$match": {"date": today}},
        {"$group": {
            "_id": "$user_id",
            "total_spins": {"$sum": 1},
            "total_blz": {"$sum": {"$cond": [{"$eq": ["$prize_type", "blz"]}, "$prize_value", 0]}},
            "total_eur": {"$sum": {"$cond": [{"$eq": ["$prize_type", "eur"]}, "$prize_value", 0]}},
            "best_label": {"$last": "$prize_label"},
        }},
        {"$sort": {"total_blz": -1, "total_spins": -1}},
        {"$limit": min(max(limit, 1), 50)},
    ]
    rows = await db.spin_wheel_log.aggregate(pipeline).to_list(50)

    # Resolve user names
    leaderboard = []
    for i, r in enumerate(rows):
        try:
            u = await db.users.find_one({"_id": _oid(r["_id"])}, {"_id": 0, "name": 1, "username": 1})
        except Exception:
            u = None
        name = (u or {}).get("username") or (u or {}).get("name") or "Anonym"
        # Anonymize for privacy: only show first name + last initial
        parts = name.split(" ", 1)
        display = parts[0] + (" " + parts[1][0] + "." if len(parts) > 1 and parts[1] else "")
        leaderboard.append({
            "rank": i + 1,
            "name": display,
            "spins": r["total_spins"],
            "blz_won": int(r["total_blz"] or 0),
            "eur_won": round(float(r["total_eur"] or 0), 2),
            "best_prize": r.get("best_label", ""),
        })
    return {"date": today, "leaderboard": leaderboard, "total_players": len(rows)}



async def spin_history(request: Request, limit: int = 20):
    """Return user's recent spin history with prize, value, and date."""
    user = await get_current_user(request)
    uid = str(user.get("_id") or user.get("id"))
    cursor = db.spin_wheel_log.find(
        {"user_id": uid},
        {"_id": 0, "prize_label": 1, "prize_type": 1, "prize_value": 1, "prize_index": 1, "created_at": 1, "date": 1},
    ).sort("created_at", -1).limit(min(max(limit, 1), 50))
    items = await cursor.to_list(50)

    # Aggregate stats
    total_spins = await db.spin_wheel_log.count_documents({"user_id": uid})
    total_blz = 0
    total_eur = 0.0
    async for s in db.spin_wheel_log.find({"user_id": uid}, {"_id": 0, "prize_type": 1, "prize_value": 1}):
        if s.get("prize_type") == "blz":
            total_blz += int(s.get("prize_value") or 0)
        else:
            total_eur += float(s.get("prize_value") or 0)

    return {
        "items": items,
        "stats": {
            "total_spins": total_spins,
            "total_blz_won": total_blz,
            "total_eur_won": round(total_eur, 2),
        },
    }


# ══════════════════════════════════════════════════════════════
# 2. BIRTHDAY BONUS
# ══════════════════════════════════════════════════════════════

BIRTHDAY_EUR = 10.0
BIRTHDAY_BLZ = 20


class BirthdateUpdate(BaseModel):
    birthdate: str = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$")


@router.post("/profile/birthdate")
async def set_birthdate(req: BirthdateUpdate, request: Request):
    user = await get_current_user(request)
    uid = str(user.get("_id") or user.get("id"))
    # Validate
    try:
        datetime.strptime(req.birthdate, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(400, "Ungültiges Datum (YYYY-MM-DD)")
    await db.users.update_one(
        {"_id": _oid(uid)},
        {"$set": {"birthdate": req.birthdate, "birthdate_set_at": datetime.now(timezone.utc).isoformat()}},
    )
    return {"ok": True}


@router.post("/birthday/claim")
async def claim_birthday_bonus(request: Request):
    """Credit the annual birthday reward exactly once after verified DOB matching."""
    user = await get_current_user(request)
    uid = str(user.get("_id") or user.get("id"))
    bd = user.get("birthdate")
    if not bd:
        raise HTTPException(400, "Bitte Geburtsdatum im Profil hinterlegen")

    if not TEST_MODE:
        extracted_dob = str(user.get("kyc_extracted_dob") or "").strip()
        if user.get("kyc_status") != "approved" or not extracted_dob or extracted_dob != bd:
            raise HTTPException(
                status_code=403,
                detail="Geburtstags-Bonus erfordert ein durch KYC verifiziertes Geburtsdatum.",
            )

    now = datetime.now(timezone.utc)
    today_md = f"{now.month:02d}-{now.day:02d}"
    try:
        bd_md = bd[5:10]
    except Exception:
        raise HTTPException(400, "Ungültiges Geburtsdatum")
    if today_md != bd_md:
        raise HTTPException(400, "Heute ist nicht dein Geburtstag 🎂")

    claim_id = f"birthday:{uid}:{now.year}"
    year_key = f"{now.year}-{bd_md}"

    # Preserve prior claims created by the legacy year_key scheme.
    legacy = await db.birthday_claims.find_one(
        {"user_id": uid, "year_key": year_key, "_id": {"$ne": claim_id}}
    )
    if legacy:
        await db.birthday_claims.update_one(
            {"_id": claim_id},
            {"$setOnInsert": {
                "_id": claim_id,
                "user_id": uid,
                "year_key": year_key,
                "status": "completed",
                "migrated_from_legacy": True,
                "claimed_at": legacy.get("claimed_at") or now.isoformat(),
            }},
            upsert=True,
        )
        raise HTTPException(400, "Geburtstags-Bonus dieses Jahr bereits erhalten 🎉")

    reserve = await db.birthday_claims.update_one(
        {"_id": claim_id},
        {"$setOnInsert": {
            "_id": claim_id,
            "user_id": uid,
            "year_key": year_key,
            "eur": BIRTHDAY_EUR,
            "blz": BIRTHDAY_BLZ,
            "status": "reserved",
            "reserved_at": now.isoformat(),
        }},
        upsert=True,
    )
    existing = await db.birthday_claims.find_one({"_id": claim_id}, {"_id": 0}) or {}
    if reserve.upserted_id is None and existing.get("status") == "completed":
        return {
            "ok": True,
            "eur": float(existing.get("eur") or BIRTHDAY_EUR),
            "blz": int(existing.get("blz") or BIRTHDAY_BLZ),
            "replayed": True,
        }

    wallet_result = await credit_wallet(
        user_id=uid,
        amount=BIRTHDAY_EUR,
        tx_type=TransactionType.REWARD,
        description=f"Geburtstags-Bonus {now.year}",
        reference=f"BDAY-{uid[-8:]}-{now.year}",
        metadata={"kind": "birthday_bonus", "year": now.year},
        idempotency_key=f"birthday:{uid}:{now.year}:eur",
    )
    if not wallet_result.success:
        await db.birthday_claims.update_one(
            {"_id": claim_id},
            {"$set": {
                "status": "reconciliation_required",
                "wallet_error": (wallet_result.error or "wallet_credit_failed")[:300],
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }},
        )
        raise HTTPException(status_code=500, detail="Geburtstags-Wallet-Gutschrift benötigt Abstimmung")

    blz_marker = f"birthday_reward_markers.y{now.year}"
    blz_result = await db.users.update_one(
        {"_id": _oid(uid), blz_marker: {"$exists": False}},
        {
            "$inc": {"balance_blz": BIRTHDAY_BLZ},
            "$set": {blz_marker: {
                "amount": BIRTHDAY_BLZ,
                "claim_id": claim_id,
                "created_at": now.isoformat(),
            }},
        },
    )
    if blz_result.modified_count != 1:
        marker_exists = await db.users.find_one(
            {"_id": _oid(uid), blz_marker: {"$exists": True}},
            {"_id": 1},
        )
        if not marker_exists:
            await db.birthday_claims.update_one(
                {"_id": claim_id},
                {"$set": {
                    "status": "reconciliation_required",
                    "wallet_transaction_id": wallet_result.transaction_id,
                    "blz_error": "birthday_blz_credit_failed",
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }},
            )
            raise HTTPException(
                status_code=500,
                detail="EUR wurde gutgeschrieben, BLZ-Gutschrift benötigt Abstimmung",
            )

    await db.transactions.update_one(
        {"_id": f"{claim_id}:blz"},
        {"$setOnInsert": {
            "_id": f"{claim_id}:blz",
            "id": f"{claim_id}:blz",
            "user_id": uid,
            "type": "bonus",
            "amount": BIRTHDAY_BLZ,
            "currency": "BLZ",
            "status": "completed",
            "description": f"Geburtstags-Bonus {now.year}",
            "merchant_name": "BidBlitz",
            "category": "birthday",
            "reference": f"BDAY-BLZ-{now.year}-{uid[-8:]}",
            "date": now.isoformat(),
            "created_at": now.isoformat(),
        }},
        upsert=True,
    )

    await db.birthday_claims.update_one(
        {"_id": claim_id},
        {"$set": {
            "status": "completed",
            "wallet_transaction_id": wallet_result.transaction_id,
            "claimed_at": datetime.now(timezone.utc).isoformat(),
        }, "$unset": {"wallet_error": "", "blz_error": ""}},
    )
    await db.notifications.update_one(
        {"_id": f"birthday:{uid}:{now.year}:notification"},
        {"$setOnInsert": {
            "_id": f"birthday:{uid}:{now.year}:notification",
            "notification_id": f"birthday-{uid[-8:]}-{now.year}",
            "user_id": uid,
            "title": "🎂 Happy Birthday!",
            "message": f"Wir schenken dir €{BIRTHDAY_EUR} + {BIRTHDAY_BLZ} BLZ. Feier schön!",
            "type": "birthday",
            "read": False,
            "created_at": now.isoformat(),
        }},
        upsert=True,
    )
    return {
        "ok": True,
        "eur": BIRTHDAY_EUR,
        "blz": BIRTHDAY_BLZ,
        "replayed": bool(wallet_result.idempotent_replay),
    }


@router.get("/birthday/status")
async def birthday_status(request: Request):
    user = await get_current_user(request)
    uid = str(user.get("_id") or user.get("id"))
    bd = user.get("birthdate")
    now = datetime.now(timezone.utc)
    if not bd:
        return {
            "birthdate_set": False,
            "is_birthday": False,
            "already_claimed": False,
            "claim_available": False,
        }
    try:
        today_md = f"{now.month:02d}-{now.day:02d}"
        is_birthday = bd[5:10] == today_md
    except Exception:
        return {
            "birthdate_set": False,
            "is_birthday": False,
            "already_claimed": False,
            "claim_available": False,
        }

    claim_id = f"birthday:{uid}:{now.year}"
    year_key = f"{now.year}-{bd[5:10]}" if len(bd) >= 10 else ""
    existing = await db.birthday_claims.find_one({"_id": claim_id})
    if not existing and year_key:
        existing = await db.birthday_claims.find_one({"user_id": uid, "year_key": year_key})

    dob_verified = bool(
        TEST_MODE
        or (
            user.get("kyc_status") == "approved"
            and str(user.get("kyc_extracted_dob") or "").strip() == bd
        )
    )
    return {
        "birthdate_set": True,
        "birthdate": bd,
        "is_birthday": is_birthday,
        "already_claimed": bool(existing and existing.get("status", "completed") == "completed"),
        "claim_available": bool(is_birthday and dob_verified and not existing),
        "dob_verified": dob_verified,
        "eur": BIRTHDAY_EUR if dob_verified else 0,
        "blz": BIRTHDAY_BLZ if dob_verified else 0,
    }


# ══════════════════════════════════════════════════════════════
# 3. KLEINANZEIGEN (Local Classifieds)
# ══════════════════════════════════════════════════════════════

CLASSIFIED_CATEGORIES = [
    {"id": "elektronik", "label": "Elektronik", "icon": "📱"},
    {"id": "moebel",     "label": "Möbel & Wohnen", "icon": "🛋️"},
    {"id": "mode",       "label": "Mode & Accessoires", "icon": "👟"},
    {"id": "auto",       "label": "Auto & Teile", "icon": "🚗"},
    {"id": "sport",      "label": "Sport & Freizeit", "icon": "⚽"},
    {"id": "haushalt",   "label": "Haushalt & Garten", "icon": "🏡"},
    {"id": "baby",       "label": "Baby & Kind", "icon": "🧸"},
    {"id": "bueche",     "label": "Bücher & Medien", "icon": "📚"},
    {"id": "dienst",     "label": "Dienstleistung", "icon": "🔧"},
    {"id": "sonstige",   "label": "Sonstiges", "icon": "📦"},
]

CLASSIFIED_COUNTRIES = [
    {"code": "DE", "name": "Deutschland", "flag": "🇩🇪"},
    {"code": "XK", "name": "Kosovo", "flag": "🇽🇰"},
    {"code": "AE", "name": "VAE", "flag": "🇦🇪"},
]

BOOST_TIERS = {
    "top_7d":  {"eur": 2.99, "days": 7,  "label": "Top-Anzeige 7 Tage"},
    "top_30d": {"eur": 9.99, "days": 30, "label": "Top-Anzeige 30 Tage"},
    "highlight_7d": {"eur": 0.99, "days": 7, "label": "Hervorheben 7 Tage"},
}


class ClassifiedCreate(BaseModel):
    title: str = Field(..., min_length=3, max_length=120)
    description: str = Field(..., min_length=10, max_length=4000)
    category: str
    price: float = Field(..., ge=0)
    is_free: bool = False
    city: str = Field(..., min_length=2, max_length=80)
    country: str = "DE"  # DE, XK, AE
    plz: Optional[str] = None
    image_urls: List[str] = Field(default_factory=list)
    condition: Optional[str] = Field(None, pattern="^(neu|wie_neu|gut|gebraucht|defekt)$")


@router.get("/classifieds/categories")
async def classified_categories():
    return {"categories": CLASSIFIED_CATEGORIES, "boost_tiers": BOOST_TIERS, "countries": CLASSIFIED_COUNTRIES}


@router.get("/classifieds/list")
async def list_classifieds(category: Optional[str] = None, city: Optional[str] = None,
                           country: Optional[str] = None, search: Optional[str] = None, 
                           limit: int = 40, skip: int = 0):
    q = {"status": "active"}
    if category: q["category"] = category
    if country: q["country"] = country
    if city: q["city"] = {"$regex": f"^{city}", "$options": "i"}
    if search: q["$or"] = [{"title": {"$regex": search, "$options": "i"}},
                           {"description": {"$regex": search, "$options": "i"}}]
    # Sort: boosted first, then newest
    cursor = db.classifieds.find(q, {"_id": 0, "description": 0}).sort(
        [("boost_until", -1), ("created_at", -1)]
    ).skip(skip).limit(limit)
    items = await cursor.to_list(limit)
    now = datetime.now(timezone.utc).isoformat()
    for i in items:
        i["is_boosted"] = bool(i.get("boost_until") and i["boost_until"] > now)
        i["is_highlighted"] = bool(i.get("highlight_until") and i["highlight_until"] > now)
    return {"items": items, "count": len(items)}


@router.get("/classifieds/{classified_id}")
async def get_classified(classified_id: str):
    item = await db.classifieds.find_one({"classified_id": classified_id}, {"_id": 0})
    if not item:
        raise HTTPException(404, "Anzeige nicht gefunden")
    # Increment views
    await db.classifieds.update_one({"classified_id": classified_id}, {"$inc": {"views": 1}})
    # Enrich seller
    try:
        seller = await db.users.find_one({"_id": _oid(item["user_id"])}, {"name": 1, "created_at": 1, "_id": 0})
        item["seller_name"] = (seller or {}).get("name", "Anonym")
    except Exception:
        item["seller_name"] = "Anonym"
    return item


@router.post("/classifieds/create")
async def create_classified(req: ClassifiedCreate, request: Request):
    user = await get_current_user(request)
    uid = str(user.get("_id") or user.get("id"))
    if req.category not in [c["id"] for c in CLASSIFIED_CATEGORIES]:
        raise HTTPException(400, "Unbekannte Kategorie")
    now = datetime.now(timezone.utc).isoformat()
    cid = "ad_" + secrets.token_hex(6)
    doc = {
        "classified_id": cid,
        "user_id": uid,
        "title": req.title.strip(),
        "description": req.description.strip(),
        "category": req.category,
        "price": float(req.price) if not req.is_free else 0,
        "is_free": req.is_free,
        "city": req.city.strip(),
        "country": req.country,  # NEW: Multi-country support
        "plz": (req.plz or "").strip(),
        "image_urls": req.image_urls[:8],  # max 8 images
        "condition": req.condition,
        "status": "active",
        "views": 0,
        "contact_count": 0,
        "boost_until": None,
        "highlight_until": None,
        "created_at": now,
        "updated_at": now,
    }
    await db.classifieds.insert_one(doc)
    doc.pop("_id", None)
    try: await _quest_track(uid, "classified_create", 1)
    except Exception: pass
    return {"ok": True, "classified_id": cid, "item": doc}


@router.delete("/classifieds/{classified_id}")
async def delete_classified(classified_id: str, request: Request):
    user = await get_current_user(request)
    uid = str(user.get("_id") or user.get("id"))
    item = await db.classifieds.find_one({"classified_id": classified_id})
    if not item: raise HTTPException(404, "Anzeige nicht gefunden")
    if item["user_id"] != uid and user.get("role") not in ("admin", "super_admin"):
        raise HTTPException(403, "Nur der Ersteller darf löschen")
    await db.classifieds.delete_one({"classified_id": classified_id})
    return {"ok": True}


@router.get("/classifieds/me/list")
async def my_classifieds(request: Request):
    user = await get_current_user(request)
    uid = str(user.get("_id") or user.get("id"))
    cursor = db.classifieds.find({"user_id": uid}, {"_id": 0}).sort("created_at", -1).limit(100)
    items = await cursor.to_list(100)
    return {"items": items, "count": len(items)}


class BoostRequest(BaseModel):
    tier: str = Field(..., pattern="^(top_7d|top_30d|highlight_7d)$")
    idempotency_key: Optional[str] = Field(None, max_length=200)


@router.post("/classifieds/{classified_id}/boost")
async def boost_classified(classified_id: str, req: BoostRequest, request: Request):
    user = await get_current_user(request)
    uid = str(user.get("_id") or user.get("id"))
    raw_key = (req.idempotency_key or request.headers.get("Idempotency-Key") or "").strip()
    if not 8 <= len(raw_key) <= 200:
        raise HTTPException(status_code=400, detail="Idempotency-Key erforderlich")

    item = await db.classifieds.find_one({"classified_id": classified_id})
    if not item:
        raise HTTPException(404, "Anzeige nicht gefunden")
    if item["user_id"] != uid:
        raise HTTPException(403, "Nur der Ersteller darf boosten")

    tier = BOOST_TIERS[req.tier]
    idem_key = f"classified-boost:{uid}:{classified_id}:{req.tier}:{raw_key}"
    previous = item.get("last_boost_purchase") or {}
    if previous.get("idempotency_key") == idem_key:
        return {
            "ok": True,
            "until": previous.get("until"),
            "tier": req.tier,
            "transaction_id": previous.get("transaction_id"),
            "replayed": True,
        }

    now_dt = datetime.now(timezone.utc)
    now_iso = now_dt.isoformat()
    field = "highlight_until" if req.tier.startswith("highlight") else "boost_until"
    active_until = item.get(field)
    if active_until and str(active_until) > now_iso:
        raise HTTPException(status_code=409, detail="Dieser Boost ist bereits aktiv")

    claimed = await db.classifieds.update_one(
        {
            "classified_id": classified_id,
            "user_id": uid,
            "$and": [
                {"$or": [{field: {"$exists": False}}, {field: None}, {field: {"$lte": now_iso}}]},
                {"$or": [
                    {"boost_payment_pending": {"$exists": False}},
                    {"boost_payment_pending.idempotency_key": idem_key},
                ]},
            ],
        },
        {"$set": {
            "boost_payment_pending": {
                "idempotency_key": idem_key,
                "tier": req.tier,
                "amount": tier["eur"],
                "reserved_at": now_iso,
            }
        }},
    )
    if claimed.modified_count != 1:
        current = await db.classifieds.find_one({"classified_id": classified_id}) or {}
        previous = current.get("last_boost_purchase") or {}
        if previous.get("idempotency_key") == idem_key:
            return {
                "ok": True,
                "until": previous.get("until"),
                "tier": req.tier,
                "transaction_id": previous.get("transaction_id"),
                "replayed": True,
            }
        pending = current.get("boost_payment_pending") or {}
        if pending.get("idempotency_key") != idem_key:
            raise HTTPException(status_code=409, detail="Ein anderer Boost wird bereits verarbeitet")

    payment = await debit_wallet(
        user_id=uid,
        amount=tier["eur"],
        tx_type=TransactionType.PAYMENT,
        description=f"Kleinanzeige Boost: {tier['label']}",
        reference=f"BOOST-{classified_id[:12]}-{req.tier}",
        metadata={"classified_id": classified_id, "tier": req.tier},
        idempotency_key=idem_key,
    )
    if not payment.success:
        await db.classifieds.update_one(
            {"classified_id": classified_id, "boost_payment_pending.idempotency_key": idem_key},
            {"$unset": {"boost_payment_pending": ""}},
        )
        raise HTTPException(status_code=400, detail=payment.error or "Boost-Zahlung fehlgeschlagen")

    until = (now_dt + timedelta(days=tier["days"])).isoformat()
    finalized = await db.classifieds.update_one(
        {"classified_id": classified_id, "boost_payment_pending.idempotency_key": idem_key},
        {
            "$set": {
                field: until,
                "last_boost_purchase": {
                    "idempotency_key": idem_key,
                    "tier": req.tier,
                    "amount": tier["eur"],
                    "until": until,
                    "transaction_id": payment.transaction_id,
                    "completed_at": datetime.now(timezone.utc).isoformat(),
                },
            },
            "$unset": {"boost_payment_pending": ""},
        },
    )
    if finalized.modified_count != 1:
        current = await db.classifieds.find_one({"classified_id": classified_id}) or {}
        previous = current.get("last_boost_purchase") or {}
        if previous.get("idempotency_key") != idem_key:
            raise HTTPException(status_code=500, detail="Boost bezahlt; Aktivierung benötigt Abstimmung")

    return {
        "ok": True,
        "until": until,
        "tier": req.tier,
        "transaction_id": payment.transaction_id,
        "replayed": bool(payment.idempotent_replay),
    }


# ══════════════════════════════════════════════════════════════
# 4. CLASSIFIEDS CONTACT (messaging-like simple)
# ══════════════════════════════════════════════════════════════

class ContactSellerRequest(BaseModel):
    message: str = Field(..., min_length=5, max_length=1000)


@router.post("/classifieds/{classified_id}/contact")
async def contact_seller(classified_id: str, req: ContactSellerRequest, request: Request):
    user = await get_current_user(request)
    uid = str(user.get("_id") or user.get("id"))
    item = await db.classifieds.find_one({"classified_id": classified_id})
    if not item: raise HTTPException(404, "Anzeige nicht gefunden")
    if item["user_id"] == uid: raise HTTPException(400, "Kann nicht dir selbst schreiben")

    now = datetime.now(timezone.utc).isoformat()
    await db.classified_messages.insert_one({
        "message_id": secrets.token_hex(6),
        "classified_id": classified_id,
        "from_user_id": uid,
        "to_user_id": item["user_id"],
        "from_name": user.get("name"),
        "from_email": user.get("email"),
        "message": req.message.strip(),
        "read": False,
        "created_at": now,
    })
    await db.classifieds.update_one({"classified_id": classified_id}, {"$inc": {"contact_count": 1}})
    # Notify seller
    await _notify(item["user_id"], f"Neue Anfrage: {item['title'][:40]}",
                  f"{user.get('name') or 'Jemand'} schreibt: {req.message[:80]}...",
                  "classified_message")
    return {"ok": True}
