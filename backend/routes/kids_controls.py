"""
BidBlitz V2 - Kids Parental Controls (innerhalb BidBlitz)
Eltern bestimmen pro Kind:
 - Welche BidBlitz-Module das Kind sehen darf
 - Tägliche Zeitlimits pro Modul
 - Bettzeit (Night-Mode, komplett gesperrt)
 - Aktivitätsprotokoll
"""
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from core.database import db
from core.security import get_current_user

router = APIRouter(prefix="/api/kids/controls", tags=["kids-controls"])


# ─── Available Modules ───────────────────────────────────────────
# Jede Kid-Kategorie, die vom Eltern blockierbar ist
AVAILABLE_MODULES = [
    {"key": "arcade",      "label": "Mini-Spiele (Arcade)",    "icon": "🎮", "default_allowed": True,  "default_minutes": 60,  "age_min": 6},
    {"key": "streaming",   "label": "Streaming & Videos",       "icon": "📺", "default_allowed": True,  "default_minutes": 90,  "age_min": 6},
    {"key": "learn",       "label": "Lern-Kurse (BlitzLearn)",  "icon": "📚", "default_allowed": True,  "default_minutes": 120, "age_min": 6},
    {"key": "quests",      "label": "Tägliche Quests",          "icon": "⭐", "default_allowed": True,  "default_minutes": 30,  "age_min": 6},
    {"key": "shopping",    "label": "Shopping / Marketplace",   "icon": "🛒", "default_allowed": False, "default_minutes": 0,   "age_min": 10},
    {"key": "auctions",    "label": "Auktionen",                "icon": "🔨", "default_allowed": False, "default_minutes": 0,   "age_min": 12},
    {"key": "food",        "label": "Food Delivery",            "icon": "🍕", "default_allowed": True,  "default_minutes": 15,  "age_min": 8},
    {"key": "social",      "label": "Social Feed",              "icon": "💬", "default_allowed": False, "default_minutes": 0,   "age_min": 13},
    {"key": "dating",      "label": "Dating",                   "icon": "❤️", "default_allowed": False, "default_minutes": 0,   "age_min": 18},
    {"key": "chatbot",     "label": "AI-Chatbot",               "icon": "🤖", "default_allowed": True,  "default_minutes": 20,  "age_min": 8},
    {"key": "nft",         "label": "NFT-Shop",                 "icon": "🎨", "default_allowed": False, "default_minutes": 0,   "age_min": 13},
    {"key": "taxi",        "label": "Taxi bestellen",           "icon": "🚕", "default_allowed": False, "default_minutes": 0,   "age_min": 16},
    {"key": "wallet_spend","label": "Geld ausgeben",            "icon": "💳", "default_allowed": False, "default_minutes": 0,   "age_min": 8},
]
MODULE_KEYS = {m["key"] for m in AVAILABLE_MODULES}


# ─── Schemas ─────────────────────────────────────────────────────
class ModuleRule(BaseModel):
    allowed: bool = True
    daily_minutes: int = Field(0, ge=0, le=24 * 60)  # 0 = unbegrenzt wenn allowed
    requires_approval: bool = False  # Kind muss Freigabe anfordern


class ControlSettings(BaseModel):
    modules: Dict[str, ModuleRule] = Field(default_factory=dict)
    bedtime_enabled: bool = True
    bedtime_start: str = "21:00"  # 24h HH:MM
    bedtime_end: str = "07:00"
    weekend_extra_minutes: int = Field(30, ge=0, le=240)  # Sa/So bonus
    lock_all: bool = False  # Master-Off
    notes: str = ""


class ActivityPing(BaseModel):
    module: str
    seconds: int = Field(..., ge=0, le=3600)


# ─── Helpers ─────────────────────────────────────────────────────
async def _get_child_for_parent(parent_id: str, child_id: str) -> dict:
    child = await db.kids_children.find_one({"child_id": child_id, "parent_id": parent_id})
    if not child:
        raise HTTPException(status_code=404, detail="Kind nicht gefunden")
    return child


def _default_settings_for_age(age: Optional[int]) -> dict:
    """Altersgerechte Standard-Einstellungen."""
    modules = {}
    for m in AVAILABLE_MODULES:
        allowed = m["default_allowed"]
        if age is not None and age < m["age_min"]:
            allowed = False
        modules[m["key"]] = {
            "allowed": allowed,
            "daily_minutes": m["default_minutes"] if allowed else 0,
            "requires_approval": False,
        }
    return {
        "modules": modules,
        "bedtime_enabled": True,
        "bedtime_start": "21:00",
        "bedtime_end": "07:00",
        "weekend_extra_minutes": 30,
        "lock_all": False,
        "notes": "",
    }


def _is_bedtime_now(settings: dict, now: Optional[datetime] = None) -> bool:
    if not settings.get("bedtime_enabled"):
        return False
    now = now or datetime.now()
    start_h, start_m = map(int, settings.get("bedtime_start", "21:00").split(":"))
    end_h, end_m = map(int, settings.get("bedtime_end", "07:00").split(":"))
    cur = now.hour * 60 + now.minute
    s = start_h * 60 + start_m
    e = end_h * 60 + end_m
    if s <= e:
        return s <= cur < e
    # Overnight (e.g. 21:00 → 07:00)
    return cur >= s or cur < e


# ─── Endpoints (Parent side) ─────────────────────────────────────
@router.get("/modules")
async def list_available_modules():
    """Alle steuerbaren BidBlitz-Module."""
    return {"modules": AVAILABLE_MODULES}


@router.get("/{child_id}/settings")
async def get_settings(child_id: str, request: Request):
    """Eltern liest die Einstellungen eines Kindes."""
    user = await get_current_user(request)
    parent_id = str(user["_id"])
    child = await _get_child_for_parent(parent_id, child_id)

    existing = await db.kids_controls.find_one(
        {"child_id": child_id, "parent_id": parent_id}, {"_id": 0}
    )
    if not existing:
        settings = _default_settings_for_age(child.get("age"))
        settings.update({"child_id": child_id, "parent_id": parent_id,
                         "created_at": datetime.now(timezone.utc).isoformat(),
                         "updated_at": datetime.now(timezone.utc).isoformat()})
        await db.kids_controls.insert_one(dict(settings))
        settings.pop("_id", None)
        return {"settings": settings, "child": {k: v for k, v in child.items() if k != "_id"}}
    return {"settings": existing, "child": {k: v for k, v in child.items() if k != "_id"}}


@router.put("/{child_id}/settings")
async def update_settings(child_id: str, body: ControlSettings, request: Request):
    """Eltern überschreibt die komplette Rule-Konfiguration."""
    user = await get_current_user(request)
    parent_id = str(user["_id"])
    await _get_child_for_parent(parent_id, child_id)

    # Validate module keys
    for k in body.modules.keys():
        if k not in MODULE_KEYS:
            raise HTTPException(status_code=400, detail=f"Unbekanntes Modul: {k}")

    now_iso = datetime.now(timezone.utc).isoformat()
    doc = body.model_dump()
    doc.update({
        "child_id": child_id,
        "parent_id": parent_id,
        "updated_at": now_iso,
    })
    await db.kids_controls.update_one(
        {"child_id": child_id, "parent_id": parent_id},
        {"$set": doc, "$setOnInsert": {"created_at": now_iso}},
        upsert=True,
    )
    saved = await db.kids_controls.find_one(
        {"child_id": child_id, "parent_id": parent_id}, {"_id": 0}
    )
    return {"ok": True, "settings": saved}


@router.post("/{child_id}/quick-toggle")
async def quick_toggle(child_id: str, body: dict, request: Request):
    """Schnelles Umschalten eines einzelnen Moduls. Body: {module: 'arcade', allowed: false}"""
    user = await get_current_user(request)
    parent_id = str(user["_id"])
    await _get_child_for_parent(parent_id, child_id)

    mod = body.get("module")
    if mod not in MODULE_KEYS:
        raise HTTPException(status_code=400, detail="Unbekanntes Modul")
    allowed = bool(body.get("allowed"))
    daily_minutes = body.get("daily_minutes")

    existing = await db.kids_controls.find_one({"child_id": child_id, "parent_id": parent_id}) or {}
    modules = existing.get("modules") or {}
    current = modules.get(mod) or {"allowed": True, "daily_minutes": 0, "requires_approval": False}
    current["allowed"] = allowed
    if daily_minutes is not None:
        current["daily_minutes"] = int(daily_minutes)

    await db.kids_controls.update_one(
        {"child_id": child_id, "parent_id": parent_id},
        {"$set": {f"modules.{mod}": current,
                  "updated_at": datetime.now(timezone.utc).isoformat()},
         "$setOnInsert": {"child_id": child_id, "parent_id": parent_id,
                          "created_at": datetime.now(timezone.utc).isoformat(),
                          "bedtime_enabled": True, "bedtime_start": "21:00", "bedtime_end": "07:00",
                          "weekend_extra_minutes": 30, "lock_all": False, "notes": ""}},
        upsert=True,
    )
    return {"ok": True, "module": mod, "allowed": allowed}


@router.post("/{child_id}/master-lock")
async def master_lock(child_id: str, body: dict, request: Request):
    """Alles sperren / entsperren. Body: {lock: true/false}"""
    user = await get_current_user(request)
    parent_id = str(user["_id"])
    await _get_child_for_parent(parent_id, child_id)

    lock = bool(body.get("lock"))
    now_iso = datetime.now(timezone.utc).isoformat()
    await db.kids_controls.update_one(
        {"child_id": child_id, "parent_id": parent_id},
        {"$set": {"lock_all": lock, "updated_at": now_iso},
         "$setOnInsert": {"child_id": child_id, "parent_id": parent_id,
                          "created_at": now_iso,
                          "bedtime_enabled": True, "bedtime_start": "21:00", "bedtime_end": "07:00",
                          "weekend_extra_minutes": 30, "notes": "", "modules": {}}},
        upsert=True,
    )
    # Audit
    await db.kids_activity.insert_one({
        "child_id": child_id, "parent_id": parent_id,
        "event": "master_lock", "payload": {"lock": lock},
        "timestamp": now_iso,
    })
    return {"ok": True, "lock_all": lock}


# ─── Activity Tracking & Reports ─────────────────────────────────
@router.post("/{child_id}/ping")
async def ping_activity(child_id: str, body: ActivityPing, request: Request):
    """Kind-Device pingt regelmäßig (z. B. alle 30 s) mit Nutzungsdauer."""
    user = await get_current_user(request)
    # Kind ODER Eltern dürfen pingen (Kind-Konto ist technisch auch User)
    uid = str(user["_id"])
    child = await db.kids_children.find_one({"child_id": child_id})
    if not child:
        raise HTTPException(status_code=404, detail="Kind nicht gefunden")
    if child.get("parent_id") != uid and child.get("user_id") != uid:
        # Only parent or child themselves
        raise HTTPException(status_code=403, detail="Kein Zugriff")

    if body.module not in MODULE_KEYS:
        raise HTTPException(status_code=400, detail="Unbekanntes Modul")

    now = datetime.now(timezone.utc)
    day_key = now.strftime("%Y-%m-%d")
    await db.kids_usage.update_one(
        {"child_id": child_id, "day": day_key, "module": body.module},
        {"$inc": {"seconds": body.seconds},
         "$set": {"updated_at": now.isoformat()},
         "$setOnInsert": {"created_at": now.isoformat()}},
        upsert=True,
    )
    return {"ok": True}


@router.get("/{child_id}/status")
async def child_status(child_id: str, request: Request):
    """
    Was das Kind-Device abfragt: Welche Module sind jetzt erlaubt?
    Berücksichtigt: lock_all, bedtime, daily_minutes, bereits verbrauchte Zeit.
    """
    user = await get_current_user(request)
    uid = str(user["_id"])
    child = await db.kids_children.find_one({"child_id": child_id})
    if not child:
        raise HTTPException(status_code=404, detail="Kind nicht gefunden")
    if child.get("parent_id") != uid and child.get("user_id") != uid:
        raise HTTPException(status_code=403, detail="Kein Zugriff")

    settings = await db.kids_controls.find_one(
        {"child_id": child_id}, {"_id": 0}
    ) or _default_settings_for_age(child.get("age"))

    now = datetime.now()
    bedtime_now = _is_bedtime_now(settings, now)
    day_key = now.strftime("%Y-%m-%d")
    is_weekend = now.weekday() >= 5
    weekend_bonus = int(settings.get("weekend_extra_minutes") or 0) if is_weekend else 0

    # Load today's usage
    usage_docs = await db.kids_usage.find(
        {"child_id": child_id, "day": day_key}, {"_id": 0}
    ).to_list(100)
    used_by_module = {d["module"]: int(d.get("seconds", 0)) for d in usage_docs}

    lock_all = bool(settings.get("lock_all"))
    modules_settings = settings.get("modules") or {}
    modules_out = []
    for m in AVAILABLE_MODULES:
        rule = modules_settings.get(m["key"]) or {"allowed": m["default_allowed"],
                                                   "daily_minutes": m["default_minutes"]}
        allowed = bool(rule.get("allowed", True))
        daily_minutes = int(rule.get("daily_minutes") or 0)
        daily_minutes_effective = daily_minutes + (weekend_bonus if allowed and daily_minutes else 0)
        used_seconds = used_by_module.get(m["key"], 0)
        used_minutes = used_seconds // 60
        limit_reached = daily_minutes_effective > 0 and used_minutes >= daily_minutes_effective

        effectively_allowed = allowed and not lock_all and not bedtime_now and not limit_reached
        modules_out.append({
            **m,
            "allowed": allowed,
            "effectively_allowed": effectively_allowed,
            "daily_minutes": daily_minutes,
            "daily_minutes_effective": daily_minutes_effective,
            "used_minutes": used_minutes,
            "limit_reached": limit_reached,
            "blocked_reason": (
                "lock_all" if lock_all
                else "bedtime" if bedtime_now
                else "limit" if limit_reached
                else "off" if not allowed
                else None
            ),
        })

    return {
        "child_id": child_id,
        "name": child.get("name"),
        "avatar": child.get("avatar"),
        "lock_all": lock_all,
        "bedtime_now": bedtime_now,
        "bedtime_start": settings.get("bedtime_start"),
        "bedtime_end": settings.get("bedtime_end"),
        "is_weekend": is_weekend,
        "weekend_bonus_minutes": weekend_bonus,
        "modules": modules_out,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/{child_id}/activity")
async def activity_report(child_id: str, days: int = 7, request: Request = None):
    """Eltern-Report: letzte N Tage Nutzung pro Modul."""
    user = await get_current_user(request)
    parent_id = str(user["_id"])
    await _get_child_for_parent(parent_id, child_id)
    days = max(1, min(30, days))

    cutoff = (datetime.now() - timedelta(days=days - 1)).strftime("%Y-%m-%d")
    docs = await db.kids_usage.find(
        {"child_id": child_id, "day": {"$gte": cutoff}}, {"_id": 0}
    ).sort("day", 1).to_list(1000)

    # Aggregate per day + per module
    per_day: Dict[str, Dict[str, int]] = {}
    per_module: Dict[str, int] = {}
    total_seconds = 0
    for d in docs:
        day = d["day"]
        mod = d["module"]
        secs = int(d.get("seconds", 0))
        per_day.setdefault(day, {})[mod] = secs
        per_module[mod] = per_module.get(mod, 0) + secs
        total_seconds += secs

    return {
        "child_id": child_id,
        "days": days,
        "total_minutes": total_seconds // 60,
        "per_day": per_day,
        "per_module": {k: v // 60 for k, v in per_module.items()},
    }


@router.post("/{child_id}/reset-usage")
async def reset_usage(child_id: str, request: Request):
    """Eltern kann verbrauchte Zeit heute zurücksetzen (z. B. Belohnung)."""
    user = await get_current_user(request)
    parent_id = str(user["_id"])
    await _get_child_for_parent(parent_id, child_id)
    day_key = datetime.now().strftime("%Y-%m-%d")
    r = await db.kids_usage.delete_many({"child_id": child_id, "day": day_key})
    return {"ok": True, "deleted": r.deleted_count}
