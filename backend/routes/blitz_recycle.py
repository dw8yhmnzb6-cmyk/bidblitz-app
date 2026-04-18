"""
BlitzRecycle — Müll-zu-BLZ Idle Tycoon (Trash Tycoon clone mit Öko-Theme).
Mechanik: 4 Müll-Typen sammeln, komprimieren, am schwankenden Markt verkaufen, BLZ claimen.
"""
from datetime import datetime, timezone, timedelta
import math
import random
import logging
from typing import Optional
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from core.database import db
from core.security import get_current_user

logger = logging.getLogger("bidblitz.blitz_recycle")
router = APIRouter(prefix="/api/blitz-recycle", tags=["blitz-recycle"])

TRASH_TYPES = {
    "plastic": {"name": "Plastik", "icon": "♻️", "base_price": 0.05, "unlock_total": 0},
    "paper":   {"name": "Papier",  "icon": "📄", "base_price": 0.08, "unlock_total": 100},
    "metal":   {"name": "Metall",  "icon": "🔩", "base_price": 0.35, "unlock_total": 1_000},
    "glass":   {"name": "Glas",    "icon": "🍾", "base_price": 0.20, "unlock_total": 5_000},
    "ewaste":  {"name": "E-Schrott","icon": "💻", "base_price": 2.50, "unlock_total": 50_000},
    "gold":    {"name": "Goldreste","icon": "🥇", "base_price": 15.00, "unlock_total": 500_000},
}

UPGRADES = {
    "compactor": {"name": "Kompaktor",  "icon": "📦", "base_cost": 50,      "base_effect": 1.0,
                  "desc": "Verdoppelt Tap-Ertrag"},
    "truck":     {"name": "Sammel-LKW", "icon": "🚛", "base_cost": 500,     "base_effect": 0.5,
                  "desc": "Automatisches Sammeln (+0,5/s je Lvl)"},
    "factory":   {"name": "Fabrik",     "icon": "🏭", "base_cost": 5_000,   "base_effect": 3.0,
                  "desc": "Verarbeitet Müll (+3/s je Lvl)"},
    "lab":       {"name": "Labor",      "icon": "🧪", "base_cost": 50_000,  "base_effect": 20.0,
                  "desc": "Premium-Extraktion (+20/s)"},
}

PRESTIGE_THRESHOLD = 5_000_000
CASH_TO_BLZ = 50_000  # 50k cash = 1 BLZ
DAILY_BLZ = 15

COST_SCALE = 1.15


def _cost(upg_id: str, level: int) -> float:
    base = UPGRADES[upg_id]["base_cost"]
    return round(base * (COST_SCALE ** level), 2)


def _effect(upg_id: str, level: int) -> float:
    if level == 0:
        return 0.0
    base = UPGRADES[upg_id]["base_effect"]
    return round(base * level * (1 + 0.02 * level), 2)


def _tap_multiplier(profile: dict) -> float:
    lvl = profile.get("upgrades", {}).get("compactor", {}).get("level", 0)
    prestige_bonus = 1 + 0.2 * profile.get("prestige_level", 0)
    return round((1 + _effect("compactor", lvl)) * prestige_bonus, 2)


def _auto_rate(profile: dict) -> float:
    """Items per second passive."""
    ups = profile.get("upgrades", {})
    rate = 0.0
    for upg_id in ["truck", "factory", "lab"]:
        rate += _effect(upg_id, ups.get(upg_id, {}).get("level", 0))
    prestige_bonus = 1 + 0.2 * profile.get("prestige_level", 0)
    return round(rate * prestige_bonus, 2)


def _market_price(trash_id: str) -> float:
    """Market price = base_price × random factor 0.7-1.5, seeded by 15-min slot."""
    base = TRASH_TYPES[trash_id]["base_price"]
    now = datetime.now(timezone.utc)
    slot = int(now.timestamp() // 900)  # 15-min slots
    seed = hash(f"{trash_id}:{slot}") % 10000
    random.seed(seed)
    factor = 0.7 + random.random() * 0.8
    return round(base * factor, 4)


async def _get_profile(uid: str) -> dict:
    profile = await db.recycle_profiles.find_one({"user_id": uid})
    if profile:
        return profile
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "user_id": uid,
        "cash": 0.0,
        "total_earned": 0.0,
        "inventory": {"plastic": 0, "paper": 0, "metal": 0, "glass": 0, "ewaste": 0, "gold": 0},
        "upgrades": {"compactor": {"level": 0}, "truck": {"level": 0}, "factory": {"level": 0}, "lab": {"level": 0}},
        "prestige_level": 0,
        "blz_claimed_total": 0.0,
        "city_cleanliness": 0,
        "last_tick": now,
        "last_daily_claim": None,
        "created_at": now,
    }
    await db.recycle_profiles.insert_one(doc)
    doc.pop("_id", None)
    return doc


async def _tick_offline(profile: dict) -> tuple[dict, dict]:
    """Apply offline auto-collection. Returns (profile, earned_map)."""
    now = datetime.now(timezone.utc)
    last = profile.get("last_tick")
    if not last:
        return profile, {}
    try:
        last_dt = datetime.fromisoformat(last)
        if last_dt.tzinfo is None:
            last_dt = last_dt.replace(tzinfo=timezone.utc)
    except Exception:
        return profile, {}
    seconds = (now - last_dt).total_seconds()
    if seconds < 1:
        return profile, {}
    seconds = min(seconds, 4 * 3600)  # cap 4h
    rate = _auto_rate(profile)
    total_qty = round(rate * seconds, 2)
    if total_qty <= 0:
        return profile, {}

    # Distribute across unlocked trash types (weighted by rarity reciprocal)
    unlocked = [tid for tid, cfg in TRASH_TYPES.items() if profile.get("total_earned", 0) >= cfg["unlock_total"]]
    weights = {tid: 1.0 / (TRASH_TYPES[tid]["base_price"] + 0.1) for tid in unlocked}
    total_w = sum(weights.values())
    earned = {}
    for tid, w in weights.items():
        q = round(total_qty * (w / total_w), 2)
        profile["inventory"][tid] = round(profile["inventory"].get(tid, 0) + q, 2)
        earned[tid] = q
    profile["last_tick"] = now.isoformat()
    return profile, earned


def _sanitize(p: dict) -> dict:
    p.pop("_id", None)
    return p


# ── Endpoints ──
@router.get("/state")
async def get_state(request: Request):
    user = await get_current_user(request)
    uid = str(user.get("_id") or user.get("id"))
    profile = await _get_profile(uid)
    profile, offline_earned = await _tick_offline(profile)
    if offline_earned:
        await db.recycle_profiles.update_one(
            {"user_id": uid},
            {"$set": {"inventory": profile["inventory"], "last_tick": profile["last_tick"]}},
        )

    # Build display info
    trash_info = {}
    for tid, cfg in TRASH_TYPES.items():
        trash_info[tid] = {
            "id": tid, "name": cfg["name"], "icon": cfg["icon"],
            "base_price": cfg["base_price"],
            "market_price": _market_price(tid),
            "inventory": profile["inventory"].get(tid, 0),
            "unlocked": profile.get("total_earned", 0) >= cfg["unlock_total"],
            "unlock_total": cfg["unlock_total"],
        }
    upgrade_info = {}
    for uid_key, cfg in UPGRADES.items():
        lvl = profile["upgrades"].get(uid_key, {}).get("level", 0)
        upgrade_info[uid_key] = {
            "id": uid_key, "name": cfg["name"], "icon": cfg["icon"], "desc": cfg["desc"],
            "level": lvl,
            "next_cost": _cost(uid_key, lvl),
            "current_effect": _effect(uid_key, lvl),
            "next_effect": _effect(uid_key, lvl + 1),
        }

    unclaimed_blz = math.floor(profile.get("total_earned", 0) / CASH_TO_BLZ) - int(profile.get("blz_claimed_total", 0))

    return {
        **_sanitize(profile),
        "trash_types": trash_info,
        "upgrades_info": upgrade_info,
        "tap_value": _tap_multiplier(profile),
        "auto_rate": _auto_rate(profile),
        "offline_earned": offline_earned,
        "cash_to_blz_ratio": CASH_TO_BLZ,
        "unclaimed_blz": max(unclaimed_blz, 0),
    }


@router.post("/tap")
async def tap(request: Request):
    """Collect trash by tapping — gets a random unlocked type."""
    user = await get_current_user(request)
    uid = str(user.get("_id") or user.get("id"))
    profile = await _get_profile(uid)
    profile, _ = await _tick_offline(profile)

    # Rate limit
    now = datetime.now(timezone.utc)
    last_tap = profile.get("last_tap_at")
    if last_tap:
        try:
            last_dt = datetime.fromisoformat(last_tap)
            if last_dt.tzinfo is None:
                last_dt = last_dt.replace(tzinfo=timezone.utc)
            if (now - last_dt).total_seconds() < 0.15:
                raise HTTPException(429, "Zu schnell")
        except (ValueError, TypeError):
            pass

    # Tap gets a random unlocked type weighted by rarity
    unlocked = [tid for tid, cfg in TRASH_TYPES.items() if profile.get("total_earned", 0) >= cfg["unlock_total"]]
    weights = [1.0 / (TRASH_TYPES[tid]["base_price"] + 0.1) for tid in unlocked]
    chosen = random.choices(unlocked, weights=weights, k=1)[0]
    gain = _tap_multiplier(profile)
    profile["inventory"][chosen] = round(profile["inventory"].get(chosen, 0) + gain, 2)
    profile["last_tap_at"] = now.isoformat()
    await db.recycle_profiles.update_one(
        {"user_id": uid},
        {"$set": {
            f"inventory.{chosen}": profile["inventory"][chosen],
            "last_tap_at": now.isoformat(),
        }},
    )
    return {"ok": True, "trash_type": chosen, "gained": gain,
            "icon": TRASH_TYPES[chosen]["icon"]}


class SellRequest(BaseModel):
    trash_type: str
    quantity: Optional[float] = None  # None = sell all


@router.post("/sell")
async def sell(req: SellRequest, request: Request):
    """Verkaufe Müll zum aktuellen Marktpreis."""
    user = await get_current_user(request)
    uid = str(user.get("_id") or user.get("id"))
    if req.trash_type not in TRASH_TYPES:
        raise HTTPException(400, "Unbekannter Müll-Typ")
    profile = await _get_profile(uid)
    profile, _ = await _tick_offline(profile)
    have = profile["inventory"].get(req.trash_type, 0)
    qty = req.quantity if req.quantity is not None and req.quantity > 0 else have
    qty = min(qty, have)
    if qty <= 0:
        raise HTTPException(400, "Kein Bestand")
    price = _market_price(req.trash_type)
    revenue = round(qty * price, 2)
    profile["inventory"][req.trash_type] = round(have - qty, 2)
    profile["cash"] = round(profile.get("cash", 0) + revenue, 2)
    profile["total_earned"] = round(profile.get("total_earned", 0) + revenue, 2)
    profile["city_cleanliness"] = min(100, profile.get("city_cleanliness", 0) + 1)
    await db.recycle_profiles.update_one(
        {"user_id": uid},
        {"$set": {
            f"inventory.{req.trash_type}": profile["inventory"][req.trash_type],
            "cash": profile["cash"],
            "total_earned": profile["total_earned"],
            "city_cleanliness": profile["city_cleanliness"],
        }},
    )
    return {"ok": True, "sold_quantity": qty, "revenue": revenue, "unit_price": price, "cash": profile["cash"]}


@router.post("/sell-all")
async def sell_all(request: Request):
    """Verkaufe ALLEN Müll auf einmal."""
    user = await get_current_user(request)
    uid = str(user.get("_id") or user.get("id"))
    profile = await _get_profile(uid)
    profile, _ = await _tick_offline(profile)
    total_rev = 0.0
    sold_items = {}
    inv_updates = {}
    for tid, qty in list(profile["inventory"].items()):
        if qty <= 0:
            continue
        price = _market_price(tid)
        rev = round(qty * price, 2)
        total_rev += rev
        sold_items[tid] = {"qty": qty, "revenue": rev, "price": price}
        profile["inventory"][tid] = 0
        inv_updates[f"inventory.{tid}"] = 0
    if total_rev <= 0:
        raise HTTPException(400, "Nichts zu verkaufen")
    profile["cash"] = round(profile.get("cash", 0) + total_rev, 2)
    profile["total_earned"] = round(profile.get("total_earned", 0) + total_rev, 2)
    profile["city_cleanliness"] = min(100, profile.get("city_cleanliness", 0) + len(sold_items))
    inv_updates["cash"] = profile["cash"]
    inv_updates["total_earned"] = profile["total_earned"]
    inv_updates["city_cleanliness"] = profile["city_cleanliness"]
    await db.recycle_profiles.update_one({"user_id": uid}, {"$set": inv_updates})
    return {"ok": True, "total_revenue": total_rev, "sold_items": sold_items, "cash": profile["cash"]}


class UpgradeRequest(BaseModel):
    upgrade_id: str


@router.post("/upgrade")
async def upgrade(req: UpgradeRequest, request: Request):
    user = await get_current_user(request)
    uid = str(user.get("_id") or user.get("id"))
    if req.upgrade_id not in UPGRADES:
        raise HTTPException(400, "Unbekanntes Upgrade")
    profile = await _get_profile(uid)
    profile, _ = await _tick_offline(profile)
    lvl = profile["upgrades"].get(req.upgrade_id, {}).get("level", 0)
    cost = _cost(req.upgrade_id, lvl)
    if profile.get("cash", 0) < cost:
        raise HTTPException(400, f"Nicht genug Cash (braucht €{cost:.2f})")
    new_lvl = lvl + 1
    profile["cash"] = round(profile["cash"] - cost, 2)
    profile["upgrades"][req.upgrade_id] = {"level": new_lvl}
    await db.recycle_profiles.update_one(
        {"user_id": uid},
        {"$set": {
            "cash": profile["cash"],
            f"upgrades.{req.upgrade_id}": {"level": new_lvl},
        }},
    )
    return {"ok": True, "new_level": new_lvl, "cash": profile["cash"]}


@router.post("/claim-blz")
async def claim_blz(request: Request):
    user = await get_current_user(request)
    uid = str(user.get("_id") or user.get("id"))
    profile = await _get_profile(uid)
    total = profile.get("total_earned", 0)
    claimed = int(profile.get("blz_claimed_total", 0))
    claimable = math.floor(total / CASH_TO_BLZ) - claimed
    if claimable < 1:
        raise HTTPException(400, f"Du brauchst {CASH_TO_BLZ} Cash pro BLZ. Verdiene mehr.")
    from bson import ObjectId
    try:
        oid = ObjectId(uid)
    except Exception:
        oid = uid
    await db.users.update_one({"_id": oid}, {"$inc": {"balance_blz": claimable}})
    await db.recycle_profiles.update_one({"user_id": uid}, {"$inc": {"blz_claimed_total": claimable}})
    await db.transactions.insert_one({
        "user_id": uid,
        "type": "reward",
        "amount": claimable,
        "currency": "BLZ",
        "status": "completed",
        "description": f"BlitzRecycle: +{claimable} BLZ",
        "merchant_name": "BlitzRecycle",
        "category": "game_reward",
        "reference": f"RECYCLE-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}",
        "date": datetime.now(timezone.utc).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return {"ok": True, "blz_claimed": claimable}


@router.post("/claim-daily")
async def claim_daily(request: Request):
    user = await get_current_user(request)
    uid = str(user.get("_id") or user.get("id"))
    profile = await _get_profile(uid)
    now = datetime.now(timezone.utc)
    last = profile.get("last_daily_claim")
    if last:
        try:
            last_dt = datetime.fromisoformat(last)
            if last_dt.tzinfo is None:
                last_dt = last_dt.replace(tzinfo=timezone.utc)
            if (now - last_dt) < timedelta(hours=22):
                hours_left = 22 - (now - last_dt).total_seconds() / 3600
                raise HTTPException(400, f"Noch {hours_left:.1f}h warten")
        except (ValueError, TypeError):
            pass
    from bson import ObjectId
    try:
        oid = ObjectId(uid)
    except Exception:
        oid = uid
    await db.users.update_one({"_id": oid}, {"$inc": {"balance_blz": DAILY_BLZ}})
    await db.recycle_profiles.update_one({"user_id": uid}, {"$set": {"last_daily_claim": now.isoformat()}})
    return {"ok": True, "blz": DAILY_BLZ}


@router.post("/prestige")
async def prestige(request: Request):
    user = await get_current_user(request)
    uid = str(user.get("_id") or user.get("id"))
    profile = await _get_profile(uid)
    if profile.get("total_earned", 0) < PRESTIGE_THRESHOLD:
        raise HTTPException(400, f"Prestige benötigt €{PRESTIGE_THRESHOLD:,.0f} Gesamtverdienst")
    new_prestige = int(profile.get("prestige_level", 0)) + 1
    now = datetime.now(timezone.utc).isoformat()
    await db.recycle_profiles.update_one(
        {"user_id": uid},
        {"$set": {
            "cash": 0.0, "total_earned": 0.0,
            "inventory": {"plastic": 0, "paper": 0, "metal": 0, "glass": 0, "ewaste": 0, "gold": 0},
            "upgrades": {"compactor": {"level": 0}, "truck": {"level": 0}, "factory": {"level": 0}, "lab": {"level": 0}},
            "prestige_level": new_prestige,
            "last_tick": now,
            "blz_claimed_total": 0.0,
            "city_cleanliness": 0,
        }},
    )
    bonus_blz = 50 * new_prestige
    from bson import ObjectId
    try:
        oid = ObjectId(uid)
    except Exception:
        oid = uid
    await db.users.update_one({"_id": oid}, {"$inc": {"balance_blz": bonus_blz}})
    return {"ok": True, "new_prestige": new_prestige, "bonus_blz": bonus_blz}


@router.get("/leaderboard")
async def leaderboard(limit: int = 20):
    cursor = db.recycle_profiles.find(
        {},
        {"_id": 0, "user_id": 1, "total_earned": 1, "prestige_level": 1, "city_cleanliness": 1}
    ).sort([("prestige_level", -1), ("total_earned", -1)]).limit(limit)
    entries = []
    async for p in cursor:
        from bson import ObjectId
        try:
            oid = ObjectId(p["user_id"])
        except Exception:
            oid = p["user_id"]
        u = await db.users.find_one({"_id": oid}, {"name": 1, "email": 1, "_id": 0})
        name = (u or {}).get("name") or (u or {}).get("email", "").split("@")[0] or "Unbekannt"
        entries.append({
            "rank": len(entries) + 1,
            "display_name": name[:20],
            "total_earned": p.get("total_earned", 0),
            "prestige_level": p.get("prestige_level", 0),
            "city_cleanliness": p.get("city_cleanliness", 0),
        })
    return {"leaderboard": entries}
