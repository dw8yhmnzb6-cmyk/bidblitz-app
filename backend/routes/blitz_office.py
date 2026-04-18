"""
BlitzOffice - Idle Office Tycoon Game
Clone of "Office Life" / "Idle Office Tycoon" with BLZ Token integration.

Mechanics:
- User builds virtual office: hires employees, upgrades rooms/equipment
- Employees generate "cash" per second (offline too, capped at 4h)
- Cash buys upgrades/hires; every 100k cash = 1 BLZ reward (redeemable)
- Prestige: reset office for permanent multipliers
- Leaderboard: top offices by net worth
- Multiplayer stubs: visit other offices (read-only for MVP)
"""
from datetime import datetime, timezone, timedelta
import math
import logging
from typing import Optional
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from core.database import db
from core.security import get_current_user

logger = logging.getLogger("bidblitz.blitz_office")
router = APIRouter(prefix="/api/blitz-office", tags=["blitz-office"])

# ── Game Balance ──
OFFLINE_CAP_HOURS = 4
CASH_TO_BLZ_RATIO = 100_000  # 100k cash = 1 BLZ
DAILY_BLZ_CLAIM = 10  # daily login bonus

DEPARTMENTS = {
    "reception": {
        "name": "Rezeption", "icon": "👋",
        "base_cost": 100, "base_rate": 1.0,
        "unlock_cost": 0,
    },
    "sales": {
        "name": "Vertrieb", "icon": "💼",
        "base_cost": 750, "base_rate": 8.0,
        "unlock_cost": 500,
    },
    "marketing": {
        "name": "Marketing", "icon": "📣",
        "base_cost": 5_000, "base_rate": 60.0,
        "unlock_cost": 2_500,
    },
    "dev": {
        "name": "Entwicklung", "icon": "💻",
        "base_cost": 25_000, "base_rate": 400.0,
        "unlock_cost": 15_000,
    },
    "finance": {
        "name": "Finanzen", "icon": "📊",
        "base_cost": 150_000, "base_rate": 2_800.0,
        "unlock_cost": 100_000,
    },
    "hr": {
        "name": "Personal", "icon": "🧑\u200d💼",
        "base_cost": 800_000, "base_rate": 18_000.0,
        "unlock_cost": 500_000,
    },
    "legal": {
        "name": "Recht", "icon": "⚖️",
        "base_cost": 4_500_000, "base_rate": 120_000.0,
        "unlock_cost": 3_000_000,
    },
    "ceo": {
        "name": "CEO Etage", "icon": "👑",
        "base_cost": 25_000_000, "base_rate": 900_000.0,
        "unlock_cost": 18_000_000,
    },
}

# Cost scales 1.15x per level; rate scales 1.07x per level (classic tycoon curve)
COST_SCALE = 1.15
RATE_SCALE = 1.07


def _cost_for_next_level(dept: str, current_level: int) -> float:
    base = DEPARTMENTS[dept]["base_cost"]
    return round(base * (COST_SCALE ** current_level), 2)


def _rate_for_level(dept: str, level: int) -> float:
    if level <= 0:
        return 0.0
    base = DEPARTMENTS[dept]["base_rate"]
    return round(base * (RATE_SCALE ** (level - 1)) * level, 2)


def _total_rate_per_sec(office: dict) -> float:
    depts = office.get("departments", {})
    total = 0.0
    for dept_id, state in depts.items():
        total += _rate_for_level(dept_id, int(state.get("level", 0)))
    # Apply prestige multiplier
    prestige_mult = 1 + 0.15 * int(office.get("prestige_level", 0))
    return round(total * prestige_mult, 2)


async def _get_or_create_office(user_id: str) -> dict:
    office = await db.office_profiles.find_one({"user_id": user_id})
    if office:
        return office
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "user_id": user_id,
        "office_name": "BlitzOffice",
        "cash": 500.0,  # starter cash
        "total_earned": 0.0,
        "prestige_level": 0,
        "prestige_points": 0,
        "departments": {"reception": {"level": 1}},
        "last_tick": now,
        "last_daily_claim": None,
        "created_at": now,
        "blz_claimed_total": 0.0,
    }
    await db.office_profiles.insert_one(doc)
    doc.pop("_id", None)
    return doc


async def _apply_offline_earnings(office: dict) -> tuple[dict, float]:
    """Add offline earnings since last_tick; returns (updated_office, earned)."""
    now = datetime.now(timezone.utc)
    last = office.get("last_tick")
    if not last:
        return office, 0.0
    try:
        last_dt = datetime.fromisoformat(last)
    except Exception:
        return office, 0.0
    if last_dt.tzinfo is None:
        last_dt = last_dt.replace(tzinfo=timezone.utc)
    seconds = (now - last_dt).total_seconds()
    if seconds < 1:
        return office, 0.0
    # Cap offline earnings
    seconds = min(seconds, OFFLINE_CAP_HOURS * 3600)
    rate = _total_rate_per_sec(office)
    earned = round(rate * seconds, 2)
    office["cash"] = round(office.get("cash", 0) + earned, 2)
    office["total_earned"] = round(office.get("total_earned", 0) + earned, 2)
    office["last_tick"] = now.isoformat()
    return office, earned


def _sanitize(office: dict) -> dict:
    office.pop("_id", None)
    return office


# ── Endpoints ──
@router.get("/state")
async def get_state(request: Request):
    """Get current office state + apply offline earnings."""
    user = await get_current_user(request)
    uid = str(user.get("_id") or user.get("id"))
    office = await _get_or_create_office(uid)
    office, offline_earned = await _apply_offline_earnings(office)
    if offline_earned > 0:
        await db.office_profiles.update_one(
            {"user_id": uid},
            {"$set": {
                "cash": office["cash"],
                "total_earned": office["total_earned"],
                "last_tick": office["last_tick"],
            }},
        )
    # Build dept info with costs/rates
    dept_info = {}
    for dept_id, cfg in DEPARTMENTS.items():
        state = office.get("departments", {}).get(dept_id, {"level": 0})
        level = int(state.get("level", 0))
        dept_info[dept_id] = {
            "id": dept_id,
            "name": cfg["name"],
            "icon": cfg["icon"],
            "level": level,
            "current_rate": _rate_for_level(dept_id, level),
            "next_cost": _cost_for_next_level(dept_id, level),
            "next_rate": _rate_for_level(dept_id, level + 1),
            "unlock_cost": cfg["unlock_cost"],
            "locked": level == 0 and office.get("total_earned", 0) < cfg["unlock_cost"],
        }
    return {
        **_sanitize(office),
        "rate_per_sec": _total_rate_per_sec(office),
        "offline_earned": offline_earned,
        "departments_info": dept_info,
        "cash_to_blz_ratio": CASH_TO_BLZ_RATIO,
        "unclaimed_blz": math.floor(office.get("total_earned", 0) / CASH_TO_BLZ_RATIO) - int(office.get("blz_claimed_total", 0)),
    }


class HireRequest(BaseModel):
    dept_id: str


@router.post("/hire")
async def hire_or_upgrade(req: HireRequest, request: Request):
    """Hire employee or upgrade department level."""
    user = await get_current_user(request)
    uid = str(user.get("_id") or user.get("id"))
    if req.dept_id not in DEPARTMENTS:
        raise HTTPException(400, "Unbekannte Abteilung")
    office = await _get_or_create_office(uid)
    office, _ = await _apply_offline_earnings(office)
    cfg = DEPARTMENTS[req.dept_id]
    state = office.get("departments", {}).get(req.dept_id, {"level": 0})
    level = int(state.get("level", 0))
    # Check unlock
    if level == 0 and office.get("total_earned", 0) < cfg["unlock_cost"]:
        raise HTTPException(400, f"Noch {cfg['unlock_cost']:.0f} Cash nötig zum Freischalten")
    cost = _cost_for_next_level(req.dept_id, level)
    if office.get("cash", 0) < cost:
        raise HTTPException(400, f"Nicht genug Cash (benötigt: {cost:.2f})")
    # Apply
    new_level = level + 1
    office["cash"] = round(office["cash"] - cost, 2)
    office.setdefault("departments", {})[req.dept_id] = {"level": new_level}
    office["last_tick"] = datetime.now(timezone.utc).isoformat()
    await db.office_profiles.update_one(
        {"user_id": uid},
        {"$set": {
            "cash": office["cash"],
            f"departments.{req.dept_id}": {"level": new_level},
            "last_tick": office["last_tick"],
        }},
    )
    return {
        "ok": True,
        "dept_id": req.dept_id,
        "new_level": new_level,
        "cash": office["cash"],
        "rate_per_sec": _total_rate_per_sec(office),
    }


@router.post("/click")
async def manual_click(request: Request):
    """Tap-to-earn: each click = 1 second of passive income (caps at 50/sec prevent abuse)."""
    user = await get_current_user(request)
    uid = str(user.get("_id") or user.get("id"))
    office = await _get_or_create_office(uid)
    office, _ = await _apply_offline_earnings(office)
    rate = _total_rate_per_sec(office)
    gain = max(rate, 1.0)
    # Rate limit: max 5 clicks/sec via server timestamp check
    now = datetime.now(timezone.utc)
    last_click = office.get("last_click_at")
    if last_click:
        try:
            last_dt = datetime.fromisoformat(last_click)
            if last_dt.tzinfo is None:
                last_dt = last_dt.replace(tzinfo=timezone.utc)
            if (now - last_dt).total_seconds() < 0.18:
                raise HTTPException(429, "Zu schnell")
        except (ValueError, TypeError):
            pass
    office["cash"] = round(office.get("cash", 0) + gain, 2)
    office["total_earned"] = round(office.get("total_earned", 0) + gain, 2)
    office["last_click_at"] = now.isoformat()
    await db.office_profiles.update_one(
        {"user_id": uid},
        {"$set": {
            "cash": office["cash"],
            "total_earned": office["total_earned"],
            "last_click_at": office["last_click_at"],
        }},
    )
    return {"ok": True, "gained": gain, "cash": office["cash"]}


@router.post("/claim-blz")
async def claim_blz(request: Request):
    """Convert earned cash into BLZ tokens (100k cash = 1 BLZ, minimum 1 BLZ)."""
    user = await get_current_user(request)
    uid = str(user.get("_id") or user.get("id"))
    office = await _get_or_create_office(uid)
    total_earned = office.get("total_earned", 0)
    claimed = int(office.get("blz_claimed_total", 0))
    claimable = math.floor(total_earned / CASH_TO_BLZ_RATIO) - claimed
    if claimable < 1:
        raise HTTPException(400, f"Noch nicht genug verdient. Brauchst {CASH_TO_BLZ_RATIO} Cash pro BLZ.")
    # Credit BLZ to user wallet
    await db.users.update_one(
        {"_id": _oid(uid)},
        {"$inc": {"balance_blz": claimable}},
    )
    await db.office_profiles.update_one(
        {"user_id": uid},
        {"$inc": {"blz_claimed_total": claimable}},
    )
    # Transaction log
    await db.transactions.insert_one({
        "user_id": uid,
        "type": "reward",
        "amount": claimable,
        "currency": "BLZ",
        "status": "completed",
        "description": f"BlitzOffice Belohnung: {claimable} BLZ",
        "merchant_name": "BlitzOffice",
        "category": "game_reward",
        "reference": f"OFFICE-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}",
        "date": datetime.now(timezone.utc).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return {"ok": True, "blz_claimed": claimable}


@router.post("/claim-daily")
async def claim_daily(request: Request):
    """Daily BLZ claim (10 BLZ per 24h)."""
    user = await get_current_user(request)
    uid = str(user.get("_id") or user.get("id"))
    office = await _get_or_create_office(uid)
    now = datetime.now(timezone.utc)
    last_claim = office.get("last_daily_claim")
    if last_claim:
        try:
            last_dt = datetime.fromisoformat(last_claim)
            if last_dt.tzinfo is None:
                last_dt = last_dt.replace(tzinfo=timezone.utc)
            if (now - last_dt) < timedelta(hours=22):
                hours_left = 22 - (now - last_dt).total_seconds() / 3600
                raise HTTPException(400, f"Noch {hours_left:.1f}h bis zum nächsten Daily")
        except (ValueError, TypeError):
            pass
    await db.users.update_one(
        {"_id": _oid(uid)},
        {"$inc": {"balance_blz": DAILY_BLZ_CLAIM}},
    )
    await db.office_profiles.update_one(
        {"user_id": uid},
        {"$set": {"last_daily_claim": now.isoformat()}},
    )
    return {"ok": True, "blz": DAILY_BLZ_CLAIM, "next_claim_at": (now + timedelta(hours=22)).isoformat()}


@router.post("/prestige")
async def prestige(request: Request):
    """Reset office but gain permanent +15% income multiplier per prestige level.
    Requires 10M total_earned."""
    user = await get_current_user(request)
    uid = str(user.get("_id") or user.get("id"))
    office = await _get_or_create_office(uid)
    if office.get("total_earned", 0) < 10_000_000:
        raise HTTPException(400, "Prestige benötigt 10.000.000 Cash Gesamtverdienst")
    new_prestige = int(office.get("prestige_level", 0)) + 1
    now = datetime.now(timezone.utc).isoformat()
    await db.office_profiles.update_one(
        {"user_id": uid},
        {"$set": {
            "cash": 500.0,
            "total_earned": 0.0,
            "departments": {"reception": {"level": 1}},
            "prestige_level": new_prestige,
            "prestige_points": int(office.get("prestige_points", 0)) + 1,
            "last_tick": now,
            "blz_claimed_total": 0.0,
        }},
    )
    # Bonus BLZ
    bonus_blz = 25 * new_prestige
    await db.users.update_one({"_id": _oid(uid)}, {"$inc": {"balance_blz": bonus_blz}})
    return {"ok": True, "new_prestige": new_prestige, "bonus_blz": bonus_blz}


@router.get("/leaderboard")
async def leaderboard(limit: int = 20):
    """Top offices by total earned (supports prestige_level tie-break)."""
    cursor = db.office_profiles.find(
        {},
        {"_id": 0, "user_id": 1, "office_name": 1, "total_earned": 1, "prestige_level": 1}
    ).sort([("prestige_level", -1), ("total_earned", -1)]).limit(limit)
    entries = []
    async for o in cursor:
        user = await db.users.find_one({"_id": _oid(o["user_id"])}, {"name": 1, "email": 1, "_id": 0})
        name = (user or {}).get("name") or ((user or {}).get("email", "").split("@")[0]) or "Unbekannt"
        entries.append({
            "rank": len(entries) + 1,
            "user_id": o["user_id"],
            "display_name": name[:20],
            "office_name": o.get("office_name", "BlitzOffice"),
            "total_earned": o.get("total_earned", 0),
            "prestige_level": o.get("prestige_level", 0),
        })
    return {"leaderboard": entries}


@router.get("/visit/{target_user_id}")
async def visit_office(target_user_id: str, request: Request):
    """Visit another player's office (read-only)."""
    await get_current_user(request)  # auth required
    office = await db.office_profiles.find_one({"user_id": target_user_id}, {"_id": 0, "last_click_at": 0})
    if not office:
        raise HTTPException(404, "Büro nicht gefunden")
    user = await db.users.find_one({"_id": _oid(target_user_id)}, {"name": 1, "email": 1, "_id": 0})
    return {
        "office": office,
        "owner_name": (user or {}).get("name") or (user or {}).get("email", "").split("@")[0] or "Unbekannt",
        "rate_per_sec": _total_rate_per_sec(office),
    }


class RenameRequest(BaseModel):
    office_name: str = Field(..., min_length=2, max_length=30)


@router.post("/rename")
async def rename_office(req: RenameRequest, request: Request):
    user = await get_current_user(request)
    uid = str(user.get("_id") or user.get("id"))
    await db.office_profiles.update_one(
        {"user_id": uid},
        {"$set": {"office_name": req.office_name.strip()}},
        upsert=True,
    )
    return {"ok": True, "office_name": req.office_name.strip()}


def _oid(s):
    try:
        from bson import ObjectId
        return ObjectId(s)
    except Exception:
        return s
