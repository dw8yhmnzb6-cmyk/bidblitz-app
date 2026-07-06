import hashlib
import json
import math
import os
import random
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from bson import ObjectId
from dotenv import load_dotenv
from emergentintegrations.llm.chat import LlmChat, UserMessage
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from core.database import db
from core.rate_limit import RATE_ADMIN_ACTION, limiter
from core.security import get_current_user


router = APIRouter(tags=["move_earn"])
load_dotenv()


DEFAULT_MOVE_SETTINGS = {
    "enabled": True,
    "daily_step_goal": 10000,
    "max_steps_per_day": 30000,
    "max_sync_increment": 8000,
    "max_step_speed_kmh": 22.0,
    "device_limit_per_day": 2,
    "max_accounts_per_device": 3,
    "sensor_confidence_min": 0.2,
    "premium_multiplier": 1.5,
    "coins_per_1000_steps": 12,
    "energy_per_1000_steps": 2,
    "xp_per_1000_steps": 22,
    "ride_xp": 35,
    "ride_coins": 18,
    "eco_xp": 20,
    "eco_coins": 8,
    "daily_checkin_xp": 18,
    "daily_checkin_energy": 2,
    "daily_checkin_coins": 10,
    "step_claim_slots": [
        {"threshold": 3000, "tier": "bronze", "energy_cost": 2},
        {"threshold": 6000, "tier": "silber", "energy_cost": 3},
        {"threshold": 10000, "tier": "gold", "energy_cost": 4},
        {"threshold": 15000, "tier": "diamond", "energy_cost": 6},
    ],
    "reward_catalog": [
        {"code": "bc1", "label": "1 Bid Credit", "type": "bid_credits", "value": 1, "weight": 28, "min_unlock_steps": 3000, "cost_estimate_eur": 0.08},
        {"code": "bc5", "label": "5 Bid Credits", "type": "bid_credits", "value": 5, "weight": 18, "min_unlock_steps": 6000, "cost_estimate_eur": 0.40},
        {"code": "bc10", "label": "10 Bid Credits", "type": "bid_credits", "value": 10, "weight": 8, "min_unlock_steps": 10000, "cost_estimate_eur": 0.80},
        {"code": "cb10", "label": "0,10 € Cashback Bonus", "type": "cashback", "value": 0.10, "weight": 18, "min_unlock_steps": 3000, "cost_estimate_eur": 0.10},
        {"code": "cb50", "label": "0,50 € Cashback Bonus", "type": "cashback", "value": 0.50, "weight": 6, "min_unlock_steps": 10000, "cost_estimate_eur": 0.50},
        {"code": "cpn", "label": "Händler-Gutschein", "type": "coupon", "value": 5.0, "weight": 10, "min_unlock_steps": 6000, "cost_estimate_eur": 5.00},
        {"code": "mbx", "label": "Mystery Box", "type": "mystery_box_ticket", "value": 1, "weight": 5, "min_unlock_steps": 10000, "cost_estimate_eur": 1.25},
        {"code": "spin", "label": "Spin Wheel Ticket", "type": "spin_ticket", "value": 1, "weight": 5, "min_unlock_steps": 6000, "cost_estimate_eur": 0.65},
        {"code": "plinko", "label": "Plinko Ticket", "type": "plinko_ticket", "value": 1, "weight": 2, "min_unlock_steps": 10000, "cost_estimate_eur": 0.95},
    ],
    "ai_coach_enabled": False,
    "gps_quality_weight": 0.45,
    "sensor_quality_weight": 0.35,
    "behavior_quality_weight": 0.20,
    "gps_min_distance_km": 0.15,
    "coach_model_provider": "openai",
    "coach_model_name": "gpt-5.2",
}

MOVE_COACH_COLLECTION = "move_coach_sessions"

LEVELS = [
    {"id": "bronze", "label": "Bronze", "min_xp": 0, "color": "#C48648"},
    {"id": "silver", "label": "Silber", "min_xp": 500, "color": "#D4E1F5"},
    {"id": "gold", "label": "Gold", "min_xp": 2000, "color": "#FFD766"},
    {"id": "diamond", "label": "Diamond", "min_xp": 6000, "color": "#8BF6FF"},
    {"id": "vip", "label": "VIP", "min_xp": 12000, "color": "#8D5BFF"},
]


class SyncStepsRequest(BaseModel):
    total_steps: int = Field(..., ge=0, le=300000)
    source: str = Field(default="device", min_length=2, max_length=32)
    device_fingerprint: Optional[str] = Field(default=None, max_length=160)
    sensor_confidence: Optional[float] = Field(default=None, ge=0, le=1)
    gps_distance_km: Optional[float] = Field(default=None, ge=0, le=300)
    duration_minutes: Optional[int] = Field(default=None, ge=1, le=1440)
    gps_points: Optional[int] = Field(default=None, ge=0, le=5000)
    route_variance_score: Optional[float] = Field(default=None, ge=0, le=1)
    activity_type: Optional[str] = Field(default="walking", max_length=32)
    background_tracking_minutes: Optional[int] = Field(default=None, ge=0, le=1440)


class ClaimRewardRequest(BaseModel):
    reward_code: str = Field(..., min_length=2, max_length=140)


class MoveSettingsUpdate(BaseModel):
    enabled: Optional[bool] = None
    daily_step_goal: Optional[int] = Field(default=None, ge=1000, le=100000)
    max_steps_per_day: Optional[int] = Field(default=None, ge=2000, le=200000)
    max_sync_increment: Optional[int] = Field(default=None, ge=500, le=50000)
    max_step_speed_kmh: Optional[float] = Field(default=None, ge=4, le=60)
    device_limit_per_day: Optional[int] = Field(default=None, ge=1, le=10)
    max_accounts_per_device: Optional[int] = Field(default=None, ge=1, le=10)
    sensor_confidence_min: Optional[float] = Field(default=None, ge=0, le=1)
    premium_multiplier: Optional[float] = Field(default=None, ge=1, le=5)
    coins_per_1000_steps: Optional[int] = Field(default=None, ge=1, le=100)
    energy_per_1000_steps: Optional[int] = Field(default=None, ge=1, le=20)
    xp_per_1000_steps: Optional[int] = Field(default=None, ge=1, le=200)
    ride_xp: Optional[int] = Field(default=None, ge=0, le=500)
    ride_coins: Optional[int] = Field(default=None, ge=0, le=300)
    eco_xp: Optional[int] = Field(default=None, ge=0, le=500)
    eco_coins: Optional[int] = Field(default=None, ge=0, le=300)
    daily_checkin_xp: Optional[int] = Field(default=None, ge=0, le=200)
    daily_checkin_energy: Optional[int] = Field(default=None, ge=0, le=50)
    daily_checkin_coins: Optional[int] = Field(default=None, ge=0, le=200)


class MoveBlockUserRequest(BaseModel):
    blocked: bool
    reason: Optional[str] = Field(default="", max_length=300)


class CoachPromptRequest(BaseModel):
    focus: str = Field(default="daily_plan", max_length=80)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _iso() -> str:
    return _now().isoformat()


def _today() -> str:
    return _now().date().isoformat()


def _week_key() -> str:
    current = _now().isocalendar()
    return f"{current.year}-W{current.week:02d}"


def _month_key() -> str:
    return _now().strftime("%Y-%m")


def _oid(value: str):
    try:
        return ObjectId(value)
    except Exception:
        return value


def _code(prefix: str) -> str:
    return f"{prefix}-{secrets.token_hex(4).upper()}"


def _to_dt(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    try:
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except Exception:
        return None


def _is_same_day(value: Optional[str], day: str) -> bool:
    dt = _to_dt(value)
    return bool(dt and dt.date().isoformat() == day)


def _fingerprint_from_request(request: Request, provided: Optional[str]) -> str:
    raw = provided or request.headers.get("x-device-fingerprint") or request.headers.get("user-agent") or request.client.host
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:32]


def _level_for_xp(total_xp: int) -> dict:
    current = LEVELS[0]
    for level in LEVELS:
        if total_xp >= level["min_xp"]:
            current = level
    return current


def _next_level(total_xp: int) -> Optional[dict]:
    for level in LEVELS:
        if total_xp < level["min_xp"]:
            return level
    return None


async def _get_settings() -> dict:
    row = await db.move_settings.find_one({"key": "global"}, {"_id": 0})
    return {**DEFAULT_MOVE_SETTINGS, **(row or {})}


async def _notify_user(user: dict, title: str, message: str, action_url: str = "/move", category: str = "promo"):
    await db.notifications.insert_one({
        "notif_id": secrets.token_hex(8),
        "user_email": user.get("email", ""),
        "user_id": str(user["_id"]),
        "category": category,
        "title": title,
        "body": message,
        "message": message,
        "action_url": action_url,
        "read": False,
        "created_at": _iso(),
    })


async def _audit(event: str, user_id: str, details: dict):
    await db.audit_logs.insert_one({
        "timestamp": _iso(),
        "event": event,
        "user_id": user_id,
        "severity": "info",
        "details": details,
    })


async def _fraud_log(user_id: str, fingerprint: str, kind: str, details: dict, severe: bool = False):
    log = {
        "fraud_id": _code("MFR"),
        "user_id": user_id,
        "device_fingerprint": fingerprint,
        "kind": kind,
        "details": details,
        "severe": severe,
        "created_at": _iso(),
    }
    await db.move_fraud_logs.insert_one(log)
    await _audit("move_fraud_flagged", user_id, {"kind": kind, **details})
    if severe:
        await db.move_profiles.update_one({"user_id": user_id}, {"$set": {"is_suspicious": True, "updated_at": _iso()}})


def _mission_key(base: str, scope: str) -> str:
    return f"mission:{base}:{scope}"


async def _is_premium(user: dict) -> bool:
    uid = str(user["_id"])
    if user.get("is_premium") or user.get("premium_plan"):
        return True
    if await db.premium_subscriptions.find_one({"user_id": uid, "active": True}):
        return True
    return False


async def _ensure_profile(user: dict) -> dict:
    uid = str(user["_id"])
    doc = await db.move_profiles.find_one({"user_id": uid}, {"_id": 0})
    if doc:
        return doc
    premium = await _is_premium(user)
    profile = {
        "user_id": uid,
        "user_email": user.get("email", ""),
        "user_name": user.get("name", user.get("email", "Mitglied")),
        "country": user.get("country") or user.get("language") or "DE",
        "total_steps": 0,
        "total_xp": 0,
        "total_move_coins": 0,
        "energy_balance": 0,
        "streak_days": 0,
        "last_checkin_date": None,
        "level": "bronze",
        "is_premium": premium,
        "is_blocked": False,
        "blocked_reason": "",
        "is_suspicious": False,
        "inventory": {"mystery_box_tickets": 0, "spin_wheel_tickets": 0, "plinko_tickets": 0},
        "claimed_mission_keys": [],
        "reward_stats": {"bid_credits": 0, "cashback_eur": 0, "coupons": 0},
        "ride_stats": {"rides_count": 0, "eco_trips": 0, "merchant_challenges": 0, "qr_challenges": 0},
        "ai_coach": {"status": "preparing", "last_recommendation": None},
        "created_at": _iso(),
        "updated_at": _iso(),
    }
    await db.move_profiles.insert_one(dict(profile))
    return profile


async def _ensure_daily(user: dict) -> dict:
    uid = str(user["_id"])
    day = _today()
    doc = await db.move_daily_steps.find_one({"user_id": uid, "date": day}, {"_id": 0})
    if doc:
        return doc
    daily = {
        "user_id": uid,
        "date": day,
        "accepted_steps": 0,
        "latest_device_total": 0,
        "energy_earned": 0,
        "move_coins_earned": 0,
        "xp_earned": 0,
        "ride_xp": 0,
        "ride_coins": 0,
        "eco_xp": 0,
        "eco_coins": 0,
        "merchant_events": 0,
        "qr_events": 0,
        "family_events": 0,
        "daily_checkin_claimed": False,
        "claimed_slot_codes": [],
        "sync_events": [],
        "device_fingerprints": [],
        "suspicious": False,
        "created_at": _iso(),
        "updated_at": _iso(),
    }
    await db.move_daily_steps.insert_one(dict(daily))
    return daily


def _reward_pick(catalog: list[dict]) -> dict:
    weights = [max(1, int(item.get("weight", 1))) for item in catalog]
    return random.choices(catalog, weights=weights, k=1)[0]


async def _record_reward_tx(user_id: str, reward_type: str, amount: float, description: str, metadata: Optional[dict] = None):
    await db.reward_transactions.insert_one({
        "reward_tx_id": _code("MRW"),
        "user_id": user_id,
        "reward_type": reward_type,
        "amount": amount,
        "description": description,
        "metadata": metadata or {},
        "created_at": _iso(),
    })


async def _record_wallet_tx(user_id: str, amount: float, description: str, metadata: Optional[dict] = None):
    await db.wallet_transactions.insert_one({
        "transaction_id": _code("MWT"),
        "user_id": user_id,
        "type": "move_earn_reward",
        "amount": round(float(amount or 0), 2),
        "currency": "EUR",
        "description": description,
        "status": "completed",
        "metadata": metadata or {},
        "created_at": _iso(),
    })


async def _record_reward_event(user_id: str, source_type: str, amount: int, description: str, source_id: Optional[str] = None):
    await db.reward_events.insert_one({
        "event_id": _code("RWD"),
        "user_id": user_id,
        "source_type": source_type,
        "source_id": source_id,
        "bidcoins": amount,
        "description": description,
        "created_at": _iso(),
    })


async def _issue_coupon(user: dict, amount: float, label: str, source_id: str) -> dict:
    code = _code("MOVECPN")
    coupon = {
        "coupon_id": _code("MCP"),
        "code": code,
        "coupon_type": "move_earn_reward",
        "value": round(float(amount or 0), 2),
        "description": label,
        "assigned_user_id": str(user["_id"]),
        "assigned_user_email": user.get("email", ""),
        "discount_amount": round(float(amount or 0), 2),
        "currency": "EUR",
        "active": True,
        "max_uses": 1,
        "used_count": 0,
        "expires_at": (_now() + timedelta(days=30)).isoformat(),
        "created_at": _iso(),
        "source_id": source_id,
    }
    await db.coupons.insert_one(dict(coupon))
    await db.reward_coupons.insert_one({**coupon, "status": "available"})
    return {"code": code, "value": coupon["value"], "expires_at": coupon["expires_at"]}


async def _grant_reward(user: dict, profile: dict, reward: dict, source_code: str) -> dict:
    uid = str(user["_id"])
    reward_type = reward["type"]
    value = reward["value"]
    label = reward["label"]
    result: dict[str, Any] = {"reward_type": reward_type, "reward_value": value, "label": label}
    if reward_type == "bid_credits":
        await db.users.update_one({"_id": user["_id"]}, {"$inc": {"bid_credits": int(value), "total_reward_credits": int(value)}})
        await db.move_profiles.update_one({"user_id": uid}, {"$inc": {"reward_stats.bid_credits": int(value)}, "$set": {"updated_at": _iso()}})
        await _record_reward_event(uid, "move_earn", int(value), label, source_code)
        await _record_reward_tx(uid, "bid_credits", int(value), label, {"source": source_code})
    elif reward_type == "cashback":
        eur_value = round(float(value or 0), 2)
        await db.users.update_one({"_id": user["_id"]}, {"$inc": {"balance": eur_value}})
        await db.move_profiles.update_one({"user_id": uid}, {"$inc": {"reward_stats.cashback_eur": eur_value}, "$set": {"updated_at": _iso()}})
        await db.cashback_claims.insert_one({
            "claim_id": _code("MCB"),
            "user_id": uid,
            "user_email": user.get("email", ""),
            "cashback_amount": eur_value,
            "description": label,
            "source": "move_earn",
            "source_id": source_code,
            "created_at": _iso(),
        })
        await _record_wallet_tx(uid, eur_value, label, {"source": source_code})
        await _record_reward_tx(uid, "cashback", eur_value, label, {"source": source_code})
    elif reward_type == "coupon":
        coupon = await _issue_coupon(user, float(value), label, source_code)
        await db.move_profiles.update_one({"user_id": uid}, {"$inc": {"reward_stats.coupons": 1}, "$set": {"updated_at": _iso()}})
        await _record_reward_tx(uid, "coupon", float(value), label, {"source": source_code, "coupon": coupon["code"]})
        result["coupon"] = coupon
    elif reward_type == "mystery_box_ticket":
        await db.move_profiles.update_one({"user_id": uid}, {"$inc": {"inventory.mystery_box_tickets": int(value)}, "$set": {"updated_at": _iso()}})
        await _record_reward_tx(uid, reward_type, int(value), label, {"source": source_code})
    elif reward_type == "spin_ticket":
        await db.move_profiles.update_one({"user_id": uid}, {"$inc": {"inventory.spin_wheel_tickets": int(value)}, "$set": {"updated_at": _iso()}})
        await _record_reward_tx(uid, reward_type, int(value), label, {"source": source_code})
    elif reward_type == "plinko_ticket":
        await db.move_profiles.update_one({"user_id": uid}, {"$inc": {"inventory.plinko_tickets": int(value)}, "$set": {"updated_at": _iso()}})
        await _record_reward_tx(uid, reward_type, int(value), label, {"source": source_code})
    else:
        raise HTTPException(status_code=400, detail="Unbekannter Reward-Typ")
    await db.move_rewards.insert_one({
        "reward_id": _code("MOVR"),
        "user_id": uid,
        "reward_type": reward_type,
        "reward_value": value,
        "label": label,
        "source_code": source_code,
        "cost_estimate_eur": reward.get("cost_estimate_eur", 0),
        "created_at": _iso(),
    })
    await _audit("move_reward_claimed", uid, {"source_code": source_code, "reward_type": reward_type, "reward_value": value})
    return result


async def _sync_external_rewards(user: dict, profile: dict, daily: dict, settings: dict):
    uid = str(user["_id"])
    today = _today()
    premium_multiplier = float(settings.get("premium_multiplier", 1.5)) if profile.get("is_premium") else 1.0

    scooter_rides = await db.scooter_rides.find(
        {"user_id": uid, "status": {"$in": ["active", "completed"]}, "created_at": {"$regex": f"^{today}"}},
        {"_id": 0, "ride_id": 1, "created_at": 1},
    ).to_list(100)
    mobility_rides = await db.mobility_bookings.find(
        {"user_id": uid, "status": {"$in": ["confirmed", "completed"]}, "created_at": {"$regex": f"^{today}"}},
        {"_id": 0, "booking_id": 1, "transport_type": 1},
    ).to_list(100)
    ev_sessions = await db.ev_charging_sessions.find(
        {"user_id": uid, "created_at": {"$regex": f"^{today}"}},
        {"_id": 0, "session_id": 1},
    ).to_list(100)

    ride_refs = [{"grant_type": "ride", "reference_id": row.get("ride_id"), "eco": True} for row in scooter_rides if row.get("ride_id")]
    for row in mobility_rides:
        ride_refs.append({
            "grant_type": "ride",
            "reference_id": row.get("booking_id"),
            "eco": row.get("transport_type") in ["scooter", "bike"],
        })
    for row in ev_sessions:
        if row.get("session_id"):
            ride_refs.append({"grant_type": "eco", "reference_id": row.get("session_id"), "eco": True})

    awarded_rides = 0
    eco_awards = 0
    total_xp = 0
    total_coins = 0
    for ref in ride_refs:
        if not ref.get("reference_id"):
            continue
        existing = await db.move_external_grants.find_one({"user_id": uid, "grant_type": ref["grant_type"], "reference_id": ref["reference_id"]})
        if existing:
            continue
        ride_xp = int(round(settings.get("ride_xp", 35) * premium_multiplier)) if ref["grant_type"] == "ride" else 0
        ride_coins = int(round(settings.get("ride_coins", 18) * premium_multiplier)) if ref["grant_type"] == "ride" else 0
        eco_xp = int(round(settings.get("eco_xp", 20) * premium_multiplier)) if ref.get("eco") else 0
        eco_coins = int(round(settings.get("eco_coins", 8) * premium_multiplier)) if ref.get("eco") else 0
        total_xp += ride_xp + eco_xp
        total_coins += ride_coins + eco_coins
        awarded_rides += 1 if ref["grant_type"] == "ride" else 0
        eco_awards += 1 if ref.get("eco") else 0
        await db.move_external_grants.insert_one({
            "grant_id": _code("MXG"),
            "user_id": uid,
            "grant_type": ref["grant_type"],
            "reference_id": ref["reference_id"],
            "awarded_xp": ride_xp + eco_xp,
            "awarded_coins": ride_coins + eco_coins,
            "date": today,
            "created_at": _iso(),
        })

    if total_xp or total_coins:
        new_total_xp = int(profile.get("total_xp", 0) or 0) + total_xp
        level = _level_for_xp(new_total_xp)
        await db.move_profiles.update_one(
            {"user_id": uid},
            {"$inc": {"total_xp": total_xp, "total_move_coins": total_coins, "ride_stats.rides_count": awarded_rides, "ride_stats.eco_trips": eco_awards}, "$set": {"level": level["id"], "updated_at": _iso()}},
        )
        await db.move_daily_steps.update_one(
            {"user_id": uid, "date": today},
            {"$inc": {"ride_xp": total_xp - int(round(settings.get("eco_xp", 20) * premium_multiplier)) * eco_awards, "ride_coins": total_coins - int(round(settings.get("eco_coins", 8) * premium_multiplier)) * eco_awards, "eco_xp": int(round(settings.get("eco_xp", 20) * premium_multiplier)) * eco_awards, "eco_coins": int(round(settings.get("eco_coins", 8) * premium_multiplier)) * eco_awards}, "$set": {"updated_at": _iso()}},
        )


async def _family_children_count(uid: str) -> int:
    return await db.kids_children.count_documents({"parent_id": uid})


def _clamp_score(value: float) -> int:
    return max(0, min(100, int(round(value))))


def _normalize_gps_quality(req: SyncStepsRequest, settings: dict) -> tuple[int, list[str]]:
    reasons = []
    if req.gps_distance_km is None:
        return 28, ["gps_missing"]
    distance = float(req.gps_distance_km or 0)
    points = int(req.gps_points or 0)
    route_variance = float(req.route_variance_score if req.route_variance_score is not None else 0.45)
    background_minutes = int(req.background_tracking_minutes or req.duration_minutes or 0)
    quality = 35 + min(35, distance * 18) + min(15, points / 4) + (route_variance * 15) + min(10, background_minutes / 12)
    if distance < float(settings.get("gps_min_distance_km", 0.15)):
        reasons.append("gps_low_distance")
    if points < 6:
        reasons.append("gps_sparse_points")
    if route_variance < 0.2:
        reasons.append("route_variance_low")
    return _clamp_score(quality), reasons


def _normalize_sensor_quality(req: SyncStepsRequest, settings: dict) -> tuple[int, list[str]]:
    reasons = []
    confidence = float(req.sensor_confidence if req.sensor_confidence is not None else settings.get("sensor_confidence_min", 0.2))
    duration = int(req.duration_minutes or 0)
    quality = 25 + (confidence * 60) + min(15, duration / 6)
    if req.sensor_confidence is None:
        reasons.append("sensor_confidence_missing")
    elif confidence < float(settings.get("sensor_confidence_min", 0.2)):
        reasons.append("sensor_confidence_low")
    if duration < 8:
        reasons.append("duration_short")
    return _clamp_score(quality), reasons


def _behavior_quality(raw_delta: int, req: SyncStepsRequest, suspicious_reasons: list[str]) -> tuple[int, list[str]]:
    reasons = []
    duration = max(1, int(req.duration_minutes or 1))
    steps_per_minute = raw_delta / duration
    quality = 88
    if steps_per_minute > 145:
        quality -= 28
        reasons.append("pace_high")
    if steps_per_minute < 15 and raw_delta > 1200:
        quality -= 20
        reasons.append("pace_low_for_delta")
    if suspicious_reasons:
        quality -= min(45, 12 * len(suspicious_reasons))
        reasons.extend([f"suspicious_{reason}" for reason in suspicious_reasons])
    activity = (req.activity_type or "walking").lower()
    if activity in {"cycling", "scooter", "car", "vehicle"}:
        quality -= 15
        reasons.append("activity_type_non_walk")
    return _clamp_score(quality), reasons


def _compute_scoring(raw_delta: int, req: SyncStepsRequest, settings: dict, suspicious_reasons: list[str]) -> dict:
    gps_score, gps_reasons = _normalize_gps_quality(req, settings)
    sensor_score, sensor_reasons = _normalize_sensor_quality(req, settings)
    behavior_score, behavior_reasons = _behavior_quality(raw_delta, req, suspicious_reasons)
    weighted = (
        gps_score * float(settings.get("gps_quality_weight", 0.45))
        + sensor_score * float(settings.get("sensor_quality_weight", 0.35))
        + behavior_score * float(settings.get("behavior_quality_weight", 0.20))
    )
    return {
        "trust_score": _clamp_score(weighted),
        "gps_score": gps_score,
        "sensor_score": sensor_score,
        "behavior_score": behavior_score,
        "flags": gps_reasons + sensor_reasons + behavior_reasons,
    }


def _coach_rule_fallback(context: dict) -> dict:
    trust = int(context.get("trust_score") or 0)
    streak = int(context.get("streak_days") or 0)
    steps = int(context.get("today_steps") or 0)
    goal = int(context.get("goal") or 0)
    eco = int(context.get("eco_trips") or 0)
    gap = max(0, goal - steps)
    if trust < 55:
        headline = "Heute zuerst saubere Bewegung sichern"
        plan = [
            "Starte eine 12–18 Minuten Gehstrecke mit aktivem GPS.",
            "Behalte das Telefon konstant bei dir und vermeide kurze Stop-and-Go-Syncs.",
            f"Hole zuerst {min(gap or 1200, 2200)} glaubwürdige Schritte.",
        ]
    elif gap > 2500:
        headline = "Heute steckt noch viel XP im Tag"
        plan = [
            f"Plane zwei Sessions, um noch {gap} Schritte sauber zu sammeln.",
            "Kombiniere die zweite Session mit QR- oder Merchant-Check-ins.",
            "Wenn möglich: ergänze einen Eco-Ride für Zusatz-XP.",
        ]
    else:
        headline = "Du bist nah am Daily Goal"
        plan = [
            f"Noch {gap} Schritte bis zum Ziel.",
            "Sichere danach den Reward-Slot und den Daily Check-in.",
            "Optional: kurzer Bonus-Walk für Streak- und Trust-Stabilität.",
        ]
    return {
        "headline": headline,
        "summary": f"Trust {trust}/100 · Streak {streak} · Eco {eco}. Fokus: Routine, glaubwürdige Route, saubere Rewards.",
        "next_hint": plan[0],
        "action_plan": plan,
        "coach_source": "rules-fallback",
    }


async def _generate_ai_coach(uid: str, context: dict, settings: dict) -> dict:
    fallback = _coach_rule_fallback(context)
    api_key = os.getenv("EMERGENT_LLM_KEY")
    if not settings.get("ai_coach_enabled") or not api_key:
        return fallback
    provider = settings.get("coach_model_provider", "openai")
    model = settings.get("coach_model_name", "gpt-5.2")
    prompt = (
        "Du bist der BidBlitz Move & Earn Coach. Antworte nur als kompaktes JSON mit den Keys "
        "headline, summary, next_hint, action_plan. action_plan muss exakt 3 kurze Strings enthalten. "
        "Schreibe auf Deutsch, datenbasiert, ohne Halluzinationen. DATEN: "
        f"{context}"
    )
    try:
        chat = LlmChat(
            api_key=api_key,
            session_id=f"move-coach-{uid}-{_today()}",
            system_message="You are a precise movement coach. Output compact valid JSON only.",
        ).with_model(provider, model)
        reply = await chat.send_message(UserMessage(text=prompt))
        text = reply if isinstance(reply, str) else getattr(reply, "text", str(reply))
        start = text.find("{")
        end = text.rfind("}")
        if start == -1 or end == -1:
            raise ValueError("No JSON returned")
        parsed = json.loads(text[start:end + 1])
        action_plan = parsed.get("action_plan") if isinstance(parsed.get("action_plan"), list) else []
        return {
            "headline": str(parsed.get("headline") or fallback["headline"]),
            "summary": str(parsed.get("summary") or fallback["summary"]),
            "next_hint": str(parsed.get("next_hint") or fallback["next_hint"]),
            "action_plan": [str(item) for item in action_plan[:3]] or fallback["action_plan"],
            "coach_source": f"{provider}:{model}",
        }
    except Exception:
        return fallback


async def _coach_payload(user: dict, profile: dict, daily: dict, settings: dict, counts: dict) -> dict:
    uid = str(user["_id"])
    since = (_now() - timedelta(days=6)).date().isoformat()
    docs = await db.move_daily_steps.find({"user_id": uid, "date": {"$gte": since}}, {"_id": 0, "accepted_steps": 1, "date": 1, "scoring": 1}).sort("date", 1).to_list(10)
    values = [int(doc.get("accepted_steps", 0) or 0) for doc in docs]
    avg = int(sum(values) / len(values)) if values else 0
    best = max(values) if values else 0
    suggested = max(int(settings.get("daily_step_goal", 10000)), min(20000, avg + 1500)) if avg else int(settings.get("daily_step_goal", 10000))
    trust_values = [int((doc.get("scoring") or {}).get("trust_score", 0) or 0) for doc in docs if (doc.get("scoring") or {}).get("trust_score") is not None]
    trust_avg = int(sum(trust_values) / len(trust_values)) if trust_values else 0
    scoring = daily.get("scoring") or {}
    context = {
        "today_steps": int(daily.get("accepted_steps", 0) or 0),
        "goal": int(settings.get("daily_step_goal", 10000)),
        "streak_days": int(profile.get("streak_days", 0) or 0),
        "trust_score": int(scoring.get("trust_score", 0) or 0),
        "gps_score": int(scoring.get("gps_score", 0) or 0),
        "sensor_score": int(scoring.get("sensor_score", 0) or 0),
        "behavior_score": int(scoring.get("behavior_score", 0) or 0),
        "quality_flags": scoring.get("flags", []),
        "eco_trips": counts.get("eco_events", 0),
        "merchant_events": counts.get("merchant_events", 0),
        "qr_events": counts.get("qr_events", 0),
        "average_steps_last_7d": avg,
        "best_day_steps": best,
    }
    generated = await _generate_ai_coach(uid, context, settings)
    coach_doc = {
        "user_id": uid,
        "date": _today(),
        "context": context,
        "headline": generated["headline"],
        "summary": generated["summary"],
        "next_hint": generated["next_hint"],
        "action_plan": generated["action_plan"],
        "coach_source": generated["coach_source"],
        "updated_at": _iso(),
    }
    await db[MOVE_COACH_COLLECTION].update_one(
        {"user_id": uid, "date": _today()},
        {"$set": coach_doc, "$setOnInsert": {"created_at": _iso()}},
        upsert=True,
    )
    return {
        "status": "active" if settings.get("ai_coach_enabled") else "preparing",
        "average_steps_last_7d": avg,
        "best_day_steps": best,
        "suggested_goal": suggested,
        "trust_score_today": int(scoring.get("trust_score", 0) or 0),
        "trust_score_avg_7d": trust_avg,
        "gps_score": int(scoring.get("gps_score", 0) or 0),
        "sensor_score": int(scoring.get("sensor_score", 0) or 0),
        "behavior_score": int(scoring.get("behavior_score", 0) or 0),
        "next_hint": generated["next_hint"],
        "headline": generated["headline"],
        "summary": generated["summary"],
        "action_plan": generated["action_plan"],
        "coach_source": generated["coach_source"],
    }


async def _daily_external_counts(uid: str) -> dict:
    today = _today()
    merchant_events = await db.transactions.count_documents({"user_id": uid, "merchant_name": {"$exists": True, "$ne": ""}, "created_at": {"$regex": f"^{today}"}})
    qr_events = await db.transactions.count_documents({"user_id": uid, "$or": [{"reference": {"$regex": "QR|TABLE|SELF", "$options": "i"}}, {"description": {"$regex": "QR|Tisch|Barcode", "$options": "i"}}], "created_at": {"$regex": f"^{today}"}})
    ride_events = await db.move_external_grants.count_documents({"user_id": uid, "date": today, "grant_type": "ride"})
    eco_events = await db.move_external_grants.count_documents({"user_id": uid, "date": today, "$or": [{"grant_type": "eco"}, {"grant_type": "ride"}]})
    return {
        "merchant_events": merchant_events,
        "qr_events": qr_events,
        "ride_events": ride_events,
        "eco_events": eco_events,
    }


async def _weekly_active_days(uid: str) -> int:
    since = (_now() - timedelta(days=6)).date().isoformat()
    docs = await db.move_daily_steps.find({"user_id": uid, "date": {"$gte": since}, "accepted_steps": {"$gt": 0}}, {"_id": 0, "date": 1}).to_list(20)
    return len({doc["date"] for doc in docs})


async def _monthly_steps(uid: str) -> int:
    since = (_now() - timedelta(days=29)).date().isoformat()
    docs = await db.move_daily_steps.find({"user_id": uid, "date": {"$gte": since}}, {"_id": 0, "accepted_steps": 1}).to_list(50)
    return int(sum(int(doc.get("accepted_steps", 0) or 0) for doc in docs))


async def _build_missions(user: dict, profile: dict, daily: dict, settings: dict) -> list[dict]:
    uid = str(user["_id"])
    counts = await _daily_external_counts(uid)
    family_count = await _family_children_count(uid)
    weekly_days = await _weekly_active_days(uid)
    month_steps = await _monthly_steps(uid)
    daily_scope = _today()
    weekly_scope = _week_key()
    monthly_scope = _month_key()
    claimed_keys = set(profile.get("claimed_mission_keys", []))

    missions = [
        {
            "mission_id": "daily_steps",
            "title": "Daily Goal",
            "scope": "daily",
            "progress": int(daily.get("accepted_steps", 0) or 0),
            "target": int(settings.get("daily_step_goal", 10000)),
            "reward": {"type": "bid_credits", "value": 1, "label": "1 Bid Credit"},
            "scope_key": daily_scope,
        },
        {
            "mission_id": "ride_earn",
            "title": "Ride & Earn",
            "scope": "daily",
            "progress": counts["ride_events"],
            "target": 1,
            "reward": {"type": "spin_ticket", "value": 1, "label": "Spin Wheel Ticket"},
            "scope_key": daily_scope,
        },
        {
            "mission_id": "eco_rewards",
            "title": "Eco Rewards",
            "scope": "daily",
            "progress": counts["eco_events"],
            "target": 1,
            "reward": {"type": "cashback", "value": 0.10, "label": "0,10 € Cashback Bonus"},
            "scope_key": daily_scope,
        },
        {
            "mission_id": "merchant_challenge",
            "title": "Merchant Challenge",
            "scope": "daily",
            "progress": counts["merchant_events"],
            "target": 1,
            "reward": {"type": "coupon", "value": 5.0, "label": "Händler-Gutschein"},
            "scope_key": daily_scope,
        },
        {
            "mission_id": "qr_challenge",
            "title": "QR Challenge",
            "scope": "daily",
            "progress": counts["qr_events"],
            "target": 1,
            "reward": {"type": "plinko_ticket", "value": 1, "label": "Plinko Ticket"},
            "scope_key": daily_scope,
        },
        {
            "mission_id": "family_challenge",
            "title": "Family Challenge",
            "scope": "daily",
            "progress": family_count if daily.get("daily_checkin_claimed") else 0,
            "target": 1 if family_count else 999,
            "reward": {"type": "mystery_box_ticket", "value": 1, "label": "Mystery Box"},
            "scope_key": daily_scope,
        },
        {
            "mission_id": "weekly_consistency",
            "title": "Wochenserie",
            "scope": "weekly",
            "progress": weekly_days,
            "target": 5,
            "reward": {"type": "bid_credits", "value": 5, "label": "5 Bid Credits"},
            "scope_key": weekly_scope,
        },
        {
            "mission_id": "monthly_distance",
            "title": "Monatsstrecke",
            "scope": "monthly",
            "progress": month_steps,
            "target": 120000,
            "reward": {"type": "bid_credits", "value": 10, "label": "10 Bid Credits"},
            "scope_key": monthly_scope,
        },
    ]

    out = []
    for mission in missions:
        key = _mission_key(mission["mission_id"], mission["scope_key"])
        completed = mission["progress"] >= mission["target"]
        out.append({
            **mission,
            "claim_code": key,
            "completed": completed,
            "claimed": key in claimed_keys,
        })
    return out


async def _status_payload(user: dict) -> dict:
    settings = await _get_settings()
    if not settings.get("enabled", True):
        raise HTTPException(status_code=403, detail="Move & Earn ist derzeit deaktiviert")
    profile = await _ensure_profile(user)
    if profile.get("is_blocked"):
        raise HTTPException(status_code=403, detail=profile.get("blocked_reason") or "Move & Earn gesperrt")
    daily = await _ensure_daily(user)
    await _sync_external_rewards(user, profile, daily, settings)
    profile = await db.move_profiles.find_one({"user_id": str(user["_id"])}, {"_id": 0}) or profile
    daily = await db.move_daily_steps.find_one({"user_id": str(user["_id"]), "date": _today()}, {"_id": 0}) or daily
    counts = await _daily_external_counts(str(user["_id"]))
    await db.move_daily_steps.update_one(
        {"user_id": str(user["_id"]), "date": _today()},
        {"$set": {"merchant_events": counts["merchant_events"], "qr_events": counts["qr_events"], "family_events": await _family_children_count(str(user["_id"])), "updated_at": _iso()}},
    )
    missions = await _build_missions(user, profile, daily, settings)
    level = _level_for_xp(int(profile.get("total_xp", 0) or 0))
    next_level = _next_level(int(profile.get("total_xp", 0) or 0))
    ai_coach = await _coach_payload(user, profile, daily, settings, counts)
    leaderboard_rows = await db.move_profiles.find(
        {},
        {"_id": 0, "user_name": 1, "total_xp": 1, "total_steps": 1, "level": 1, "ride_stats": 1},
    ).sort("total_xp", -1).limit(10).to_list(10)
    history_preview = await db.move_rewards.find({"user_id": str(user["_id"])}, {"_id": 0}).sort("created_at", -1).limit(10).to_list(10)

    claim_cards = []
    claimed_codes = set(daily.get("claimed_slot_codes", []))
    for slot in settings.get("step_claim_slots", []):
        threshold = int(slot.get("threshold", 0) or 0)
        code = f"slot:{threshold}"
        claim_cards.append({
            "reward_code": code,
            "tier": slot.get("tier"),
            "title": f"{slot.get('tier', 'reward').title()} Reward",
            "unlock_steps": threshold,
            "energy_cost": int(slot.get("energy_cost", 0) or 0),
            "unlocked": int(daily.get("accepted_steps", 0) or 0) >= threshold,
            "claimed": code in claimed_codes,
        })

    progress_pct = min(100, int(round((int(daily.get("accepted_steps", 0) or 0) / max(1, int(settings.get("daily_step_goal", 10000)))) * 100)))
    return {
        "profile": {
            "level": level,
            "next_level": next_level,
            "total_xp": int(profile.get("total_xp", 0) or 0),
            "total_steps": int(profile.get("total_steps", 0) or 0),
            "total_move_coins": int(profile.get("total_move_coins", 0) or 0),
            "energy_balance": int(profile.get("energy_balance", 0) or 0),
            "streak_days": int(profile.get("streak_days", 0) or 0),
            "is_premium": bool(profile.get("is_premium")),
            "is_suspicious": bool(profile.get("is_suspicious")),
            "coach_opt_in": bool(profile.get("coach_opt_in", True)),
            "inventory": profile.get("inventory", {}),
            "reward_stats": profile.get("reward_stats", {}),
        },
        "daily": {
            "date": _today(),
            "accepted_steps": int(daily.get("accepted_steps", 0) or 0),
            "latest_device_total": int(daily.get("latest_device_total", 0) or 0),
            "goal": int(settings.get("daily_step_goal", 10000)),
            "progress_pct": progress_pct,
            "energy_earned": int(daily.get("energy_earned", 0) or 0),
            "move_coins_earned": int(daily.get("move_coins_earned", 0) or 0),
            "xp_earned": int(daily.get("xp_earned", 0) or 0),
            "ride_xp": int(daily.get("ride_xp", 0) or 0),
            "eco_xp": int(daily.get("eco_xp", 0) or 0),
            "daily_checkin_claimed": bool(daily.get("daily_checkin_claimed")),
            "remaining_steps_capacity": max(0, int(settings.get("max_steps_per_day", 30000)) - int(daily.get("accepted_steps", 0) or 0)),
            "scoring": daily.get("scoring", {}),
        },
        "claim_cards": claim_cards,
        "daily_checkin": {
            "reward_code": "checkin",
            "claimable": not daily.get("daily_checkin_claimed"),
            "streak_days": int(profile.get("streak_days", 0) or 0),
        },
        "ride_earn": {
            "today_rides": counts["ride_events"],
            "eco_trips": counts["eco_events"],
            "merchant_events": counts["merchant_events"],
            "qr_events": counts["qr_events"],
            "linked_children": await _family_children_count(str(user["_id"])),
        },
        "missions": missions,
        "leaderboard_preview": leaderboard_rows,
        "history_preview": history_preview,
        "ai_coach": ai_coach,
        "settings": {
            "max_steps_per_day": int(settings.get("max_steps_per_day", 30000)),
            "premium_multiplier": float(settings.get("premium_multiplier", 1.5)),
            "gps_quality_weight": float(settings.get("gps_quality_weight", 0.45)),
            "sensor_quality_weight": float(settings.get("sensor_quality_weight", 0.35)),
            "behavior_quality_weight": float(settings.get("behavior_quality_weight", 0.20)),
        },
    }


@router.get("/api/move/status")
async def get_move_status(request: Request):
    user = await get_current_user(request)
    return await _status_payload(user)


@router.post("/api/move/sync-steps")
@limiter.limit("20/minute")
async def sync_move_steps(request: Request, req: SyncStepsRequest):
    user = await get_current_user(request)
    settings = await _get_settings()
    if not settings.get("enabled", True):
        raise HTTPException(status_code=403, detail="Move & Earn ist deaktiviert")
    profile = await _ensure_profile(user)
    if profile.get("is_blocked"):
        raise HTTPException(status_code=403, detail=profile.get("blocked_reason") or "Move & Earn gesperrt")
    daily = await _ensure_daily(user)
    uid = str(user["_id"])
    fingerprint = _fingerprint_from_request(request, req.device_fingerprint)
    suspicious_reasons = []

    today_devices = set(daily.get("device_fingerprints", []))
    if fingerprint not in today_devices and len(today_devices) >= int(settings.get("device_limit_per_day", 2)):
        await _fraud_log(uid, fingerprint, "device_limit", {"existing_devices": list(today_devices)}, severe=True)
        raise HTTPException(status_code=429, detail="Zu viele Geräte für Move & Earn heute")

    device_users = await db.move_daily_steps.count_documents({"date": _today(), "device_fingerprints": fingerprint})
    if device_users >= int(settings.get("max_accounts_per_device", 3)):
        suspicious_reasons.append("device_account_limit")
        await _fraud_log(uid, fingerprint, "device_account_limit", {"device_users": device_users + 1}, severe=True)

    previous_total = int(daily.get("latest_device_total", 0) or 0)
    accepted_steps = int(daily.get("accepted_steps", 0) or 0)
    if req.total_steps < previous_total:
        suspicious_reasons.append("decreasing_total")
        await _fraud_log(uid, fingerprint, "decreasing_total", {"previous_total": previous_total, "new_total": req.total_steps})
        req_total = previous_total
    else:
        req_total = req.total_steps

    raw_delta = max(0, req_total - previous_total)
    max_increment = int(settings.get("max_sync_increment", 8000))
    step_delta = min(raw_delta, max_increment)
    if raw_delta > max_increment:
        suspicious_reasons.append("too_large_increment")
        await _fraud_log(uid, fingerprint, "too_large_increment", {"raw_delta": raw_delta, "accepted": step_delta})

    max_day = int(settings.get("max_steps_per_day", 30000))
    remaining = max(0, max_day - accepted_steps)
    if step_delta > remaining:
        suspicious_reasons.append("day_limit")
        step_delta = remaining
        await _fraud_log(uid, fingerprint, "day_limit", {"remaining": remaining, "requested_delta": raw_delta})

    if req.duration_minutes:
        estimated_km = (raw_delta * 0.00078)
        speed = (estimated_km / max(req.duration_minutes / 60, 0.01))
        if speed > float(settings.get("max_step_speed_kmh", 22.0)):
            suspicious_reasons.append("speed_check")
            await _fraud_log(uid, fingerprint, "speed_check", {"speed_kmh": round(speed, 2), "steps": raw_delta, "minutes": req.duration_minutes}, severe=True)
    if req.sensor_confidence is not None and req.sensor_confidence < float(settings.get("sensor_confidence_min", 0.2)):
        suspicious_reasons.append("low_sensor_confidence")
        await _fraud_log(uid, fingerprint, "low_sensor_confidence", {"sensor_confidence": req.sensor_confidence})

    premium_multiplier = float(settings.get("premium_multiplier", 1.5)) if profile.get("is_premium") else 1.0
    coins_gain = int(math.floor((step_delta / 1000) * int(settings.get("coins_per_1000_steps", 12)) * premium_multiplier))
    energy_gain = int(math.floor((step_delta / 1000) * int(settings.get("energy_per_1000_steps", 2)) * premium_multiplier))
    xp_gain = int(math.floor((step_delta / 1000) * int(settings.get("xp_per_1000_steps", 22)) * premium_multiplier))
    scoring = _compute_scoring(raw_delta, req, settings, suspicious_reasons)
    trust_multiplier = max(0.4, min(1.0, scoring["trust_score"] / 100))
    coins_gain = int(math.floor(coins_gain * trust_multiplier))
    energy_gain = int(math.floor(energy_gain * max(0.5, trust_multiplier)))
    xp_gain = int(math.floor(xp_gain * trust_multiplier))
    new_total_xp = int(profile.get("total_xp", 0) or 0) + xp_gain
    level = _level_for_xp(new_total_xp)

    sync_event = {
        "sync_id": _code("MS"),
        "raw_total_steps": req.total_steps,
        "accepted_delta": step_delta,
        "source": req.source,
        "device_fingerprint": fingerprint,
        "sensor_confidence": req.sensor_confidence,
        "gps_distance_km": req.gps_distance_km,
        "gps_points": req.gps_points,
        "route_variance_score": req.route_variance_score,
        "activity_type": req.activity_type,
        "background_tracking_minutes": req.background_tracking_minutes,
        "duration_minutes": req.duration_minutes,
        "suspicious_reasons": suspicious_reasons,
        "scoring": scoring,
        "created_at": _iso(),
    }

    if fingerprint not in today_devices:
        today_devices.add(fingerprint)
    await db.move_daily_steps.update_one(
        {"user_id": uid, "date": _today()},
        {
            "$inc": {"accepted_steps": step_delta, "energy_earned": energy_gain, "move_coins_earned": coins_gain, "xp_earned": xp_gain},
            "$set": {"latest_device_total": req_total, "updated_at": _iso(), "device_fingerprints": list(today_devices), "suspicious": bool(suspicious_reasons) or bool(daily.get("suspicious")), "scoring": scoring},
            "$push": {"sync_events": {"$each": [sync_event], "$slice": -50}},
        },
    )
    await db.move_profiles.update_one(
        {"user_id": uid},
        {
            "$inc": {"total_steps": step_delta, "total_move_coins": coins_gain, "energy_balance": energy_gain, "total_xp": xp_gain},
            "$set": {"level": level["id"], "updated_at": _iso(), "last_synced_at": _iso(), "is_suspicious": bool(profile.get("is_suspicious")) or bool(suspicious_reasons), "last_sync_scoring": scoring, "coach_opt_in": True},
        },
    )
    await _audit("move_steps_synced", uid, {"accepted_delta": step_delta, "source": req.source, "suspicious_reasons": suspicious_reasons})
    if step_delta > 0:
        await _notify_user(user, "Move & Earn aktualisiert", f"+{step_delta} Schritte · +{xp_gain} XP · +{energy_gain} Energy", "/move", "system")
    return {
        "ok": True,
        "accepted_delta": step_delta,
        "coins_gain": coins_gain,
        "energy_gain": energy_gain,
        "xp_gain": xp_gain,
        "suspicious_reasons": suspicious_reasons,
        "scoring": scoring,
        "status": await _status_payload(user),
    }


@router.get("/api/move/coach-session")
async def get_move_coach_session(request: Request):
    user = await get_current_user(request)
    settings = await _get_settings()
    profile = await _ensure_profile(user)
    daily = await _ensure_daily(user)
    counts = await _daily_external_counts(str(user["_id"]))
    return {"coach": await _coach_payload(user, profile, daily, settings, counts)}


@router.post("/api/move/coach-session")
@limiter.limit("10/minute")
async def refresh_move_coach_session(request: Request, req: CoachPromptRequest):
    user = await get_current_user(request)
    settings = await _get_settings()
    profile = await _ensure_profile(user)
    daily = await _ensure_daily(user)
    counts = await _daily_external_counts(str(user["_id"]))
    coach = await _coach_payload(user, profile, daily, settings, counts)
    coach["focus"] = req.focus
    return {"ok": True, "coach": coach}


@router.post("/api/move/claim-reward")
@limiter.limit("20/minute")
async def claim_move_reward(request: Request, req: ClaimRewardRequest):
    user = await get_current_user(request)
    settings = await _get_settings()
    profile = await _ensure_profile(user)
    daily = await _ensure_daily(user)
    uid = str(user["_id"])
    if profile.get("is_blocked"):
        raise HTTPException(status_code=403, detail=profile.get("blocked_reason") or "Move & Earn gesperrt")

    reward_code = req.reward_code.strip()
    result: dict[str, Any]

    if reward_code == "checkin":
        if daily.get("daily_checkin_claimed"):
            raise HTTPException(status_code=400, detail="Daily Check-in bereits beansprucht")
        streak = int(profile.get("streak_days", 0) or 0)
        last_checkin = profile.get("last_checkin_date")
        yesterday = (_now() - timedelta(days=1)).date().isoformat()
        if last_checkin == yesterday:
            streak += 1
        elif last_checkin == _today():
            raise HTTPException(status_code=400, detail="Heute bereits eingecheckt")
        else:
            streak = 1
        xp = int(settings.get("daily_checkin_xp", 18))
        coins = int(settings.get("daily_checkin_coins", 10))
        energy = int(settings.get("daily_checkin_energy", 2))
        total_xp = int(profile.get("total_xp", 0) or 0) + xp
        level = _level_for_xp(total_xp)
        await db.move_daily_steps.update_one({"user_id": uid, "date": _today()}, {"$set": {"daily_checkin_claimed": True, "updated_at": _iso()}})
        await db.move_profiles.update_one({"user_id": uid}, {"$inc": {"total_xp": xp, "energy_balance": energy, "total_move_coins": coins}, "$set": {"streak_days": streak, "last_checkin_date": _today(), "level": level["id"], "updated_at": _iso()}})
        result = {"reward_type": "checkin", "reward_value": {"xp": xp, "coins": coins, "energy": energy}, "label": "Daily Check-in"}
        await db.move_rewards.insert_one({"reward_id": _code("MCHK"), "user_id": uid, "reward_type": "checkin", "reward_value": xp, "label": "Daily Check-in", "source_code": reward_code, "cost_estimate_eur": 0, "created_at": _iso()})
        await _record_reward_tx(uid, "checkin", xp, "Daily Check-in", {"coins": coins, "energy": energy})
        await _notify_user(user, "Daily Check-in geschafft", f"+{xp} XP · +{coins} Coins · +{energy} Energy", "/move", "promo")
        await _audit("move_checkin_claimed", uid, {"streak_days": streak, "xp": xp, "coins": coins, "energy": energy})
    elif reward_code.startswith("slot:"):
        if reward_code in set(daily.get("claimed_slot_codes", [])):
            raise HTTPException(status_code=400, detail="Dieser Reward wurde heute bereits beansprucht")
        threshold = int(reward_code.split(":", 1)[1])
        slot = next((item for item in settings.get("step_claim_slots", []) if int(item.get("threshold", 0)) == threshold), None)
        if not slot:
            raise HTTPException(status_code=404, detail="Reward-Slot nicht gefunden")
        if int(daily.get("accepted_steps", 0) or 0) < threshold:
            raise HTTPException(status_code=400, detail="Schrittziel für diesen Slot noch nicht erreicht")
        if int(profile.get("energy_balance", 0) or 0) < int(slot.get("energy_cost", 0) or 0):
            raise HTTPException(status_code=400, detail="Nicht genug Energy verfügbar")
        eligible = [item for item in settings.get("reward_catalog", []) if int(item.get("min_unlock_steps", 0) or 0) <= threshold]
        if not eligible:
            raise HTTPException(status_code=400, detail="Keine Rewards für diesen Slot konfiguriert")
        reward = _reward_pick(eligible)
        await db.move_profiles.update_one({"user_id": uid}, {"$inc": {"energy_balance": -int(slot.get("energy_cost", 0) or 0)}, "$set": {"updated_at": _iso()}})
        await db.move_daily_steps.update_one({"user_id": uid, "date": _today()}, {"$push": {"claimed_slot_codes": reward_code}, "$set": {"updated_at": _iso()}})
        result = await _grant_reward(user, profile, reward, reward_code)
        await _notify_user(user, "Move Reward erhalten", result["label"], "/move", "promo")
    elif reward_code.startswith("mission:"):
        missions = await _build_missions(user, profile, daily, settings)
        mission = next((item for item in missions if item["claim_code"] == reward_code), None)
        if not mission:
            raise HTTPException(status_code=404, detail="Mission nicht gefunden")
        if not mission.get("completed"):
            raise HTTPException(status_code=400, detail="Mission noch nicht abgeschlossen")
        if mission.get("claimed"):
            raise HTTPException(status_code=400, detail="Mission bereits beansprucht")
        result = await _grant_reward(user, profile, mission["reward"], reward_code)
        await db.move_profiles.update_one({"user_id": uid}, {"$addToSet": {"claimed_mission_keys": reward_code}, "$set": {"updated_at": _iso()}})
        await _notify_user(user, "Mission abgeschlossen", result["label"], "/move", "promo")
    else:
        raise HTTPException(status_code=400, detail="Unbekannter Reward-Code")

    return {"ok": True, "reward": result, "status": await _status_payload(user)}


@router.get("/api/move/history")
async def get_move_history(request: Request, limit: int = 50):
    user = await get_current_user(request)
    uid = str(user["_id"])
    rewards = await db.move_rewards.find({"user_id": uid}, {"_id": 0}).sort("created_at", -1).limit(min(max(limit, 1), 100)).to_list(100)
    sync_days = await db.move_daily_steps.find({"user_id": uid}, {"_id": 0, "date": 1, "accepted_steps": 1, "energy_earned": 1, "move_coins_earned": 1, "xp_earned": 1, "daily_checkin_claimed": 1}).sort("date", -1).limit(30).to_list(30)
    reward_txs = await db.reward_transactions.find({"user_id": uid}, {"_id": 0}).sort("created_at", -1).limit(80).to_list(80)
    return {"rewards": rewards, "days": sync_days, "reward_transactions": reward_txs}


@router.get("/api/move/leaderboard")
async def get_move_leaderboard(request: Request, limit: int = 20):
    user = await get_current_user(request)
    uid = str(user["_id"])
    rows = await db.move_profiles.find({}, {"_id": 0, "user_id": 1, "user_name": 1, "level": 1, "total_xp": 1, "total_steps": 1, "ride_stats": 1}).sort("total_xp", -1).limit(min(max(limit, 1), 50)).to_list(50)
    leaderboard = []
    me = None
    for index, row in enumerate(rows):
        item = {
            "rank": index + 1,
            "user_id": row.get("user_id"),
            "user_name": row.get("user_name") or "Mitglied",
            "level": row.get("level", "bronze"),
            "total_xp": int(row.get("total_xp", 0) or 0),
            "total_steps": int(row.get("total_steps", 0) or 0),
            "eco_trips": int((row.get("ride_stats") or {}).get("eco_trips", 0) or 0),
        }
        leaderboard.append(item)
        if row.get("user_id") == uid:
            me = item
    return {"leaderboard": leaderboard, "me": me}


@router.get("/api/admin/move/settings")
async def get_move_settings_admin(request: Request):
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Nur Admin")
    return {"settings": await _get_settings()}


@router.put("/api/admin/move/settings")
@limiter.limit(RATE_ADMIN_ACTION)
async def update_move_settings_admin(request: Request, req: MoveSettingsUpdate):
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Nur Admin")
    updates = {key: value for key, value in req.dict(exclude_none=True).items()}
    current = await _get_settings()
    merged = {**current, **updates, "key": "global"}
    await db.move_settings.update_one({"key": "global"}, {"$set": merged}, upsert=True)
    await _audit("move_settings_updated", str(user["_id"]), {"updated_keys": list(updates.keys())})
    return {"ok": True, "settings": await _get_settings()}


@router.get("/api/admin/move/stats")
async def get_move_stats_admin(request: Request):
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Nur Admin")
    today = _today()
    profiles_count = await db.move_profiles.count_documents({})
    active_today = await db.move_daily_steps.count_documents({"date": today, "accepted_steps": {"$gt": 0}})
    suspicious_profiles = await db.move_profiles.count_documents({"is_suspicious": True})
    blocked_users = await db.move_profiles.count_documents({"is_blocked": True})
    fraud_today = await db.move_fraud_logs.count_documents({"created_at": {"$regex": f"^{today}"}})
    rewards = await db.move_rewards.find({}, {"_id": 0, "cost_estimate_eur": 1, "reward_type": 1}).to_list(5000)
    total_cost = round(sum(float(item.get("cost_estimate_eur", 0) or 0) for item in rewards), 2)
    top_users = await db.move_profiles.find({}, {"_id": 0, "user_id": 1, "user_name": 1, "level": 1, "total_xp": 1, "total_steps": 1, "is_blocked": 1, "is_suspicious": 1}).sort("total_xp", -1).limit(15).to_list(15)
    fraud_logs = await db.move_fraud_logs.find({}, {"_id": 0}).sort("created_at", -1).limit(30).to_list(30)
    daily_rows = await db.move_daily_steps.find({"date": today}, {"_id": 0, "accepted_steps": 1, "move_coins_earned": 1, "energy_earned": 1, "ride_xp": 1, "eco_xp": 1, "merchant_events": 1, "qr_events": 1}).to_list(500)
    return {
        "summary": {
            "profiles_count": profiles_count,
            "active_today": active_today,
            "suspicious_profiles": suspicious_profiles,
            "blocked_users": blocked_users,
            "fraud_today": fraud_today,
            "total_reward_cost_eur": total_cost,
            "total_steps_today": int(sum(int(row.get("accepted_steps", 0) or 0) for row in daily_rows)),
            "total_move_coins_today": int(sum(int(row.get("move_coins_earned", 0) or 0) for row in daily_rows)),
            "total_energy_today": int(sum(int(row.get("energy_earned", 0) or 0) for row in daily_rows)),
        },
        "top_users": top_users,
        "fraud_logs": fraud_logs,
        "activity": {
            "ride_xp": int(sum(int(row.get("ride_xp", 0) or 0) for row in daily_rows)),
            "eco_xp": int(sum(int(row.get("eco_xp", 0) or 0) for row in daily_rows)),
            "merchant_events": int(sum(int(row.get("merchant_events", 0) or 0) for row in daily_rows)),
            "qr_events": int(sum(int(row.get("qr_events", 0) or 0) for row in daily_rows)),
        },
    }


@router.post("/api/admin/move/users/{user_id}/block")
@limiter.limit(RATE_ADMIN_ACTION)
async def block_move_user_admin(user_id: str, request: Request, req: MoveBlockUserRequest):
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Nur Admin")
    result = await db.move_profiles.update_one(
        {"user_id": user_id},
        {"$set": {"is_blocked": req.blocked, "blocked_reason": req.reason or "", "updated_at": _iso()}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Move-Profil nicht gefunden")
    target = await db.users.find_one({"_id": _oid(user_id)}, {"_id": 0, "email": 1, "name": 1}) or {}
    if target.get("email"):
        await _notify_user({"_id": user_id, "email": target.get("email"), "name": target.get("name")}, "Move & Earn Status", "Dein Move-&-Earn-Zugang wurde aktualisiert.", "/move", "system")
    await _audit("move_user_block_updated", str(user["_id"]), {"target_user_id": user_id, "blocked": req.blocked, "reason": req.reason})
    return {"ok": True, "user_id": user_id, "blocked": req.blocked}