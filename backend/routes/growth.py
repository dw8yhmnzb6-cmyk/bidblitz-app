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
from core.security import get_current_user

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
    user = await get_current_user(request)
    uid = str(user.get("_id") or user.get("id"))
    today = datetime.now(timezone.utc).date().isoformat()
    spins_today = await db.spin_wheel_log.count_documents({"user_id": uid, "date": today})
    is_premium = await _has_premium(uid)
    limit = PREMIUM_SPINS_PER_DAY if is_premium else FREE_SPINS_PER_DAY
    remaining = max(0, limit - spins_today)
    # Next reset at UTC midnight
    now = datetime.now(timezone.utc)
    next_reset = (now.replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(days=1)).isoformat()
    return {
        "spins_today": spins_today,
        "limit": limit,
        "remaining": remaining,
        "is_premium": is_premium,
        "next_reset": next_reset,
        "prizes": [{"label": p["label"], "type": p["type"], "value": p["value"]} for p in SPIN_PRIZES],
    }


@router.post("/spin-wheel/spin")
async def spin_wheel(request: Request):
    user = await get_current_user(request)
    uid = str(user.get("_id") or user.get("id"))
    today = datetime.now(timezone.utc).date().isoformat()
    spins_today = await db.spin_wheel_log.count_documents({"user_id": uid, "date": today})
    is_premium = await _has_premium(uid)
    limit = PREMIUM_SPINS_PER_DAY if is_premium else FREE_SPINS_PER_DAY
    if spins_today >= limit:
        raise HTTPException(400, f"Kein Spin mehr heute (Limit: {limit}). Komm morgen wieder!")

    # Weighted random
    total = sum(p["weight"] for p in SPIN_PRIZES)
    roll = random.uniform(0, total)
    acc = 0
    prize_idx = 0
    for i, p in enumerate(SPIN_PRIZES):
        acc += p["weight"]
        if roll <= acc:
            prize_idx = i
            break
    prize = SPIN_PRIZES[prize_idx]

    now = datetime.now(timezone.utc)
    # Credit prize
    if prize["type"] == "blz":
        await db.users.update_one({"_id": _oid(uid)}, {"$inc": {"balance_blz": prize["value"]}})
        currency = "BLZ"
    else:
        await db.users.update_one({"_id": _oid(uid)}, {"$inc": {"balance": prize["value"]}})
        currency = "EUR"

    # Log spin
    await db.spin_wheel_log.insert_one({
        "user_id": uid, "date": today,
        "prize_type": prize["type"], "prize_value": prize["value"], "prize_label": prize["label"],
        "prize_index": prize_idx,
        "created_at": now.isoformat(),
    })
    # Transaction log
    await db.transactions.insert_one({
        "user_id": uid, "type": "bonus",
        "amount": prize["value"], "currency": currency,
        "status": "completed", "description": f"Glücksrad: {prize['label']}",
        "merchant_name": "BidBlitz", "category": "spin_wheel",
        "reference": f"SPIN-{now.strftime('%Y%m%d%H%M%S')}",
        "date": now.isoformat(), "created_at": now.isoformat(),
    })
    return {
        "ok": True,
        "prize_index": prize_idx,
        "prize": {"label": prize["label"], "type": prize["type"], "value": prize["value"]},
        "remaining": max(0, limit - spins_today - 1),
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
    """User claims today's birthday bonus (once per year)."""
    user = await get_current_user(request)
    uid = str(user.get("_id") or user.get("id"))
    bd = user.get("birthdate")
    if not bd:
        raise HTTPException(400, "Bitte Geburtsdatum im Profil hinterlegen")
    now = datetime.now(timezone.utc)
    today_md = f"{now.month:02d}-{now.day:02d}"
    try:
        bd_md = bd[5:10]  # MM-DD
    except Exception:
        raise HTTPException(400, "Ungültiges Geburtsdatum")
    if today_md != bd_md:
        raise HTTPException(400, "Heute ist nicht dein Geburtstag 🎂")
    # Check if already claimed this year
    year_key = f"{now.year}-{bd_md}"
    existing = await db.birthday_claims.find_one({"user_id": uid, "year_key": year_key})
    if existing:
        raise HTTPException(400, "Geburtstags-Bonus dieses Jahr bereits erhalten 🎉")

    await db.users.update_one({"_id": _oid(uid)}, {"$inc": {"balance": BIRTHDAY_EUR, "balance_blz": BIRTHDAY_BLZ}})
    await db.birthday_claims.insert_one({
        "user_id": uid, "year_key": year_key,
        "eur": BIRTHDAY_EUR, "blz": BIRTHDAY_BLZ,
        "claimed_at": now.isoformat(),
    })
    await db.transactions.insert_one({
        "user_id": uid, "type": "bonus", "amount": BIRTHDAY_EUR, "currency": "EUR",
        "status": "completed", "description": f"🎂 Geburtstags-Bonus {now.year}",
        "merchant_name": "BidBlitz", "category": "birthday",
        "reference": f"BDAY-{now.strftime('%Y%m%d')}",
        "date": now.isoformat(), "created_at": now.isoformat(),
    })
    await _notify(uid, "🎂 Happy Birthday!", f"Wir schenken dir €{BIRTHDAY_EUR} + {BIRTHDAY_BLZ} BLZ. Feier schön!", "birthday")
    return {"ok": True, "eur": BIRTHDAY_EUR, "blz": BIRTHDAY_BLZ}


@router.get("/birthday/status")
async def birthday_status(request: Request):
    user = await get_current_user(request)
    uid = str(user.get("_id") or user.get("id"))
    bd = user.get("birthdate")
    now = datetime.now(timezone.utc)
    if not bd:
        return {"birthdate_set": False, "is_birthday": False, "already_claimed": False}
    try:
        today_md = f"{now.month:02d}-{now.day:02d}"
        is_birthday = bd[5:10] == today_md
    except Exception:
        return {"birthdate_set": False, "is_birthday": False}
    year_key = f"{now.year}-{bd[5:10]}" if len(bd) >= 10 else ""
    already = False
    if year_key:
        already = bool(await db.birthday_claims.find_one({"user_id": uid, "year_key": year_key}))
    return {
        "birthdate_set": True, "birthdate": bd,
        "is_birthday": is_birthday, "already_claimed": already,
        "eur": BIRTHDAY_EUR, "blz": BIRTHDAY_BLZ,
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
    plz: Optional[str] = None
    image_urls: List[str] = Field(default_factory=list)
    condition: Optional[str] = Field(None, pattern="^(neu|wie_neu|gut|gebraucht|defekt)$")


@router.get("/classifieds/categories")
async def classified_categories():
    return {"categories": CLASSIFIED_CATEGORIES, "boost_tiers": BOOST_TIERS}


@router.get("/classifieds/list")
async def list_classifieds(category: Optional[str] = None, city: Optional[str] = None,
                           search: Optional[str] = None, limit: int = 40, skip: int = 0):
    q = {"status": "active"}
    if category: q["category"] = category
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


@router.post("/classifieds/{classified_id}/boost")
async def boost_classified(classified_id: str, req: BoostRequest, request: Request):
    user = await get_current_user(request)
    uid = str(user.get("_id") or user.get("id"))
    item = await db.classifieds.find_one({"classified_id": classified_id})
    if not item: raise HTTPException(404, "Anzeige nicht gefunden")
    if item["user_id"] != uid:
        raise HTTPException(403, "Nur der Ersteller darf boosten")

    tier = BOOST_TIERS[req.tier]
    bal = float(user.get("balance", 0) or 0)
    if bal < tier["eur"]:
        raise HTTPException(400, f"Nicht genug Guthaben (brauchst €{tier['eur']})")

    await db.users.update_one({"_id": _oid(uid)}, {"$inc": {"balance": -tier["eur"]}})
    until = (datetime.now(timezone.utc) + timedelta(days=tier["days"])).isoformat()
    field = "highlight_until" if req.tier.startswith("highlight") else "boost_until"
    await db.classifieds.update_one({"classified_id": classified_id}, {"$set": {field: until}})

    now = datetime.now(timezone.utc).isoformat()
    await db.transactions.insert_one({
        "user_id": uid, "type": "payment", "amount": tier["eur"], "currency": "EUR",
        "status": "completed", "description": f"Kleinanzeige Boost: {tier['label']}",
        "merchant_name": "BidBlitz", "category": "classified_boost",
        "reference": f"BOOST-{classified_id}-{req.tier}",
        "date": now, "created_at": now,
    })
    return {"ok": True, "until": until, "tier": req.tier}


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
