"""
BidBlitz V2 — Rewards System / Rewards Center V3
Daily login, streak rewards, comeback bonus, milestones, unified rewards dashboard.
All rewards paid in bid_credits / platform reward systems.
"""
import logging
import random
import secrets
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import Response
from pydantic import BaseModel, Field
from core.database import db
import csv
import io
from bson import ObjectId

router = APIRouter(prefix="/api/rewards", tags=["Rewards"])
logger = logging.getLogger("bidblitz.rewards")

# Streak reward table (day 1-7, then repeats day 7)
STREAK_REWARDS = {1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 7, 7: 10}
COMEBACK_BONUS = 3
COMEBACK_MIN_DAYS = 2
REWARDS_V3_STREAKS = [3, 7, 30, 100]
BADGE_ORDER = ["bronze", "silber", "gold", "platin", "diamant"]
BADGE_THRESHOLDS = {"bronze": 0, "silber": 500, "gold": 1500, "platin": 5000, "diamant": 10000}
DEFAULT_REWARDS_V3_CONFIG = {
    "enabled": True,
    "streak_bonus_3": 3,
    "streak_bonus_7": 8,
    "streak_bonus_30": 30,
    "streak_bonus_100": 120,
    "max_daily_reward_credits": 25,
    "merchant_reward_limit": 1000,
}

DEFAULT_REWARD_HUB_CONFIG = {
    "spin_enabled": True,
    "premium_daily_spins": 3,
    "free_daily_spins": 1,
    "premium_cashback_multiplier": 1.5,
    "plinko_enabled": True,
    "premium_daily_plinko_drops": 2,
    "free_daily_plinko_drops": 0,
    "plinko_energy_cost": 0,
    "plinko_bidcoin_cost": 40,
    "plinko_payouts": [
        {"multiplier": 6.0, "weight": 1, "color": "#FF6B6B", "label": "6x"},
        {"multiplier": 2.5, "weight": 4, "color": "#FF9F43", "label": "2.5x"},
        {"multiplier": 1.4, "weight": 9, "color": "#FFD166", "label": "1.4x"},
        {"multiplier": 1.1, "weight": 12, "color": "#8FE388", "label": "1.1x"},
        {"multiplier": 0.8, "weight": 14, "color": "#56CCF2", "label": "0.8x"},
        {"multiplier": 0.5, "weight": 18, "color": "#6C8CFF", "label": "0.5x"},
        {"multiplier": 0.8, "weight": 14, "color": "#56CCF2", "label": "0.8x"},
        {"multiplier": 1.1, "weight": 12, "color": "#8FE388", "label": "1.1x"},
        {"multiplier": 1.4, "weight": 9, "color": "#FFD166", "label": "1.4x"},
        {"multiplier": 2.5, "weight": 4, "color": "#FF9F43", "label": "2.5x"},
        {"multiplier": 6.0, "weight": 1, "color": "#FF6B6B", "label": "6x"},
    ],
    "mystery_boxes": [
        {
            "box_key": "bronze",
            "name": "Bronze Box",
            "tier": "bronze",
            "price_bidcoins": 35,
            "price_eur": 0.0,
            "premium_free_opens_per_month": 0,
            "color": "#B7794B",
            "gradient": ["#6B4226", "#C48757"],
            "rewards": [
                {"type": "bid_credits", "value": 5, "weight": 32, "label": "+5 Bid Credits"},
                {"type": "cashback", "value": 1.0, "weight": 26, "label": "1% Cashback Boost"},
                {"type": "coupon", "value": 5, "weight": 18, "label": "5€ Coupon"},
                {"type": "bidcoins", "value": 25, "weight": 16, "label": "+25 BidCoins"},
                {"type": "cash_eur", "value": 0.5, "weight": 8, "label": "0.50 € Wallet"},
            ],
        },
        {
            "box_key": "silber",
            "name": "Silber Box",
            "tier": "silber",
            "price_bidcoins": 90,
            "price_eur": 0.0,
            "premium_free_opens_per_month": 1,
            "color": "#B8C2D1",
            "gradient": ["#7A879A", "#E6EDF7"],
            "rewards": [
                {"type": "bid_credits", "value": 10, "weight": 28, "label": "+10 Bid Credits"},
                {"type": "cashback", "value": 2.5, "weight": 24, "label": "2.5% Cashback Boost"},
                {"type": "coupon", "value": 10, "weight": 20, "label": "10€ Coupon"},
                {"type": "bidcoins", "value": 60, "weight": 18, "label": "+60 BidCoins"},
                {"type": "cash_eur", "value": 1.0, "weight": 10, "label": "1 € Wallet"},
            ],
        },
        {
            "box_key": "gold",
            "name": "Gold Box",
            "tier": "gold",
            "price_bidcoins": 180,
            "price_eur": 0.0,
            "premium_free_opens_per_month": 1,
            "color": "#F5B700",
            "gradient": ["#A56A00", "#FFD766"],
            "rewards": [
                {"type": "bid_credits", "value": 25, "weight": 27, "label": "+25 Bid Credits"},
                {"type": "cashback", "value": 5.0, "weight": 25, "label": "5% Cashback Boost"},
                {"type": "coupon", "value": 20, "weight": 18, "label": "20€ Coupon"},
                {"type": "bidcoins", "value": 150, "weight": 15, "label": "+150 BidCoins"},
                {"type": "cash_eur", "value": 2.0, "weight": 10, "label": "2 € Wallet"},
                {"type": "premium_trial", "value": 7, "weight": 5, "label": "7 Tage Premium"},
            ],
        },
        {
            "box_key": "diamond",
            "name": "Diamond Box",
            "tier": "diamond",
            "price_bidcoins": 360,
            "price_eur": 0.0,
            "premium_free_opens_per_month": 2,
            "color": "#65D9FF",
            "gradient": ["#035A83", "#9FF1FF"],
            "rewards": [
                {"type": "bid_credits", "value": 60, "weight": 25, "label": "+60 Bid Credits"},
                {"type": "cashback", "value": 8.0, "weight": 23, "label": "8% Cashback Boost"},
                {"type": "coupon", "value": 35, "weight": 18, "label": "35€ Coupon"},
                {"type": "bidcoins", "value": 350, "weight": 14, "label": "+350 BidCoins"},
                {"type": "cash_eur", "value": 5.0, "weight": 12, "label": "5 € Wallet"},
                {"type": "premium_trial", "value": 30, "weight": 8, "label": "30 Tage Premium"},
            ],
        },
    ],
    "spin_rewards": [
        {"label": "5 BidCoins", "type": "bidcoins", "value": 5, "weight": 28, "color": "#00D26A"},
        {"label": "10 BidCoins", "type": "bidcoins", "value": 10, "weight": 22, "color": "#00C2FF"},
        {"label": "3 Bid Credits", "type": "bid_credits", "value": 3, "weight": 16, "color": "#A855F7"},
        {"label": "1% Cashback", "type": "cashback", "value": 1, "weight": 14, "color": "#FFB800"},
        {"label": "5€ Coupon", "type": "coupon", "value": 5, "weight": 8, "color": "#FF6B9D"},
        {"label": "0.50 € Wallet", "type": "cash_eur", "value": 0.5, "weight": 7, "color": "#FFD700"},
        {"label": "7 Tage Premium", "type": "premium_trial", "value": 7, "weight": 3, "color": "#3B82F6"},
        {"label": "25 Bid Credits", "type": "bid_credits", "value": 25, "weight": 2, "color": "#EF4444"},
    ],
}

MILESTONES = {
    "first_topup": {"credits": 5, "check": "has_topup"},
    "first_bid": {"credits": 3, "check": "has_bid"},
    "first_win": {"credits": 10, "check": "has_win"},
    "first_invite": {"credits": 5, "check": "has_invite"},
}


class RewardConfigUpdate(BaseModel):
    enabled: bool | None = None
    streak_bonus_3: int | None = Field(default=None, ge=0)
    streak_bonus_7: int | None = Field(default=None, ge=0)
    streak_bonus_30: int | None = Field(default=None, ge=0)
    streak_bonus_100: int | None = Field(default=None, ge=0)
    max_daily_reward_credits: int | None = Field(default=None, ge=1)
    merchant_reward_limit: int | None = Field(default=None, ge=1)


class MerchantRewardCreate(BaseModel):
    title: str = Field(..., min_length=2, max_length=120)
    description: str = Field("", max_length=500)
    reward_type: str = Field(..., min_length=2, max_length=40)
    cost_bidcoins: int = Field(..., ge=1)
    cashback_amount: float = Field(0, ge=0)
    voucher_code: str = Field("", max_length=64)
    free_product_name: str = Field("", max_length=120)
    is_active: bool = True


class RewardHubConfigUpdate(BaseModel):
    spin_enabled: bool | None = None
    premium_daily_spins: int | None = Field(default=None, ge=1, le=20)
    free_daily_spins: int | None = Field(default=None, ge=0, le=10)
    premium_cashback_multiplier: float | None = Field(default=None, ge=1.0, le=10.0)
    plinko_enabled: bool | None = None
    premium_daily_plinko_drops: int | None = Field(default=None, ge=0, le=20)
    free_daily_plinko_drops: int | None = Field(default=None, ge=0, le=10)
    plinko_energy_cost: int | None = Field(default=None, ge=0, le=50)
    plinko_bidcoin_cost: int | None = Field(default=None, ge=0, le=500)
    plinko_payouts: list[dict] | None = None
    mystery_boxes: list[dict] | None = None
    spin_rewards: list[dict] | None = None


class MysteryBoxOpenRequest(BaseModel):
    box_key: str = Field(..., min_length=2, max_length=40)


class RewardPlinkoDropRequest(BaseModel):
    source: str = Field(default="ticket", pattern="^(ticket|bidcoins|free)$")


def _generate_reward_code(prefix: str = "RW") -> str:
    return f"{prefix}-{secrets.token_hex(4).upper()}-{secrets.token_hex(2).upper()}"


def _oid(value: str):
    try:
        return ObjectId(value)
    except Exception:
        return value


async def get_current_user(request: Request):
    from routes.auth import get_current_user as auth_user
    return await auth_user(request)


def today_str():
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def parse_date(s):
    if not s:
        return None
    try:
        return datetime.strptime(s, "%Y-%m-%d").replace(tzinfo=timezone.utc)
    except Exception:
        return None


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


async def _get_rewards_v3_config() -> dict:
    row = await db.platform_config.find_one({"key": "rewards_v3_config"}, {"_id": 0})
    return {**DEFAULT_REWARDS_V3_CONFIG, **(row.get("settings", {}) if row else {})}


async def _get_reward_hub_config() -> dict:
    row = await db.platform_config.find_one({"key": "reward_hub_config"}, {"_id": 0})
    settings = row.get("settings", {}) if row else {}
    config = {**DEFAULT_REWARD_HUB_CONFIG, **settings}
    config["mystery_boxes"] = settings.get("mystery_boxes") or DEFAULT_REWARD_HUB_CONFIG["mystery_boxes"]
    config["spin_rewards"] = settings.get("spin_rewards") or DEFAULT_REWARD_HUB_CONFIG["spin_rewards"]
    return config


async def _has_active_premium(user_id: str) -> bool:
    if not user_id:
        return False
    if await db.premium_subscriptions.find_one({"user_id": user_id, "active": True}):
        return True
    if await db.premium_subs.find_one({"user_email": {"$exists": True}}):
        user = await db.users.find_one({"_id": _oid(user_id)}, {"_id": 0, "email": 1, "is_premium": 1})
        if user and user.get("is_premium"):
            return True
    user = await db.users.find_one({"_id": _oid(user_id)}, {"_id": 0, "is_premium": 1, "premium_plan": 1})
    return bool(user and (user.get("is_premium") or user.get("premium_plan")))


async def _record_wallet_transaction(user_id: str, tx_type: str, amount: float, description: str, metadata: dict | None = None):
    now = _now_iso()
    payload = {
        "transaction_id": _generate_reward_code("WTX"),
        "user_id": user_id,
        "type": tx_type,
        "amount": round(float(amount or 0), 2),
        "currency": "EUR",
        "description": description,
        "status": "completed",
        "metadata": metadata or {},
        "created_at": now,
    }
    await db.wallet_transactions.insert_one(dict(payload))
    return payload


async def _record_transaction(user_id: str, tx_type: str, amount: float, description: str, category: str, reference: str, currency: str = "EUR"):
    await db.transactions.insert_one({
        "id": _generate_reward_code("TXN"),
        "user_id": user_id,
        "type": tx_type,
        "amount": round(float(amount or 0), 2),
        "currency": currency,
        "description": description,
        "merchant_name": "BidBlitz Rewards",
        "status": "completed",
        "reference": reference,
        "category": category,
        "created_at": _now_iso(),
    })


async def _ensure_user_reward_profile(user_id: str, is_premium: bool):
    now = _now_iso()
    profile = await db.reward_user_profiles.find_one({"user_id": user_id}, {"_id": 0})
    if profile:
        return profile
    doc = {
        "user_id": user_id,
        "cashback_multiplier": 1.0,
        "premium_bonus_active": is_premium,
        "last_spin_date": None,
        "created_at": now,
        "updated_at": now,
    }
    await db.reward_user_profiles.insert_one(doc)
    return doc


async def _get_move_profile(user_id: str) -> dict:
    return await db.move_profiles.find_one({"user_id": user_id}, {"_id": 0}) or {}


def _pick_weighted(items: list[dict]) -> tuple[int, dict]:
    total = sum(max(0, int(item.get("weight", 0) or 0)) for item in items)
    if total <= 0:
        return 0, items[0]
    roll = random.uniform(0, total)
    acc = 0
    chosen_index = 0
    for idx, item in enumerate(items):
        acc += max(0, int(item.get("weight", 0) or 0))
        if roll <= acc:
            chosen_index = idx
            break
    return chosen_index, items[chosen_index]


async def _issue_coupon_reward(user: dict, amount: float, source: str, source_id: str, label: str):
    user_id = str(user["_id"])
    code = _generate_reward_code("CPN")
    now = datetime.now(timezone.utc)
    expires_at = (now + timedelta(days=30)).isoformat()
    coupon = {
        "coupon_id": _generate_reward_code("RCP"),
        "code": code,
        "coupon_type": "reward_coupon",
        "value": round(float(amount or 0), 2),
        "description": label,
        "reward_source": source,
        "reward_source_id": source_id,
        "assigned_user_id": user_id,
        "assigned_user_email": user.get("email", ""),
        "discount_amount": round(float(amount or 0), 2),
        "currency": "EUR",
        "active": True,
        "max_uses": 1,
        "used_count": 0,
        "used_by": [],
        "expires_at": expires_at,
        "created_at": now.isoformat(),
    }
    await db.coupons.insert_one(dict(coupon))
    await db.reward_coupons.insert_one({**coupon, "status": "available"})
    return {"type": "coupon", "code": code, "amount": round(float(amount or 0), 2), "expires_at": expires_at}


async def _apply_reward_payload(user: dict, reward: dict, source: str, source_id: str):
    user_id = str(user["_id"])
    reward_type = reward.get("type")
    value = reward.get("value", 0)
    label = reward.get("label") or f"{reward_type}:{value}"
    result = {
        "reward_type": reward_type,
        "reward_value": value,
        "label": label,
        "transaction_effect": {},
    }

    if reward_type == "bidcoins":
        await _credit_bidcoins(user_id, int(value), source, label, source_id)
        result["transaction_effect"] = {"bidcoins": int(value)}
    elif reward_type == "bid_credits":
        await db.users.update_one({"_id": user["_id"]}, {"$inc": {"bid_credits": int(value), "total_reward_credits": int(value)}})
        await _record_transaction(user_id, "reward_credit", float(value), f"{label} ({source})", source, source_id, currency="BIDCREDITS")
        await db.reward_events.insert_one({
            "event_id": _generate_reward_code("RWD"),
            "user_id": user_id,
            "source_type": source,
            "source_id": source_id,
            "bidcoins": int(value),
            "reward_currency": "bid_credits",
            "description": label,
            "created_at": _now_iso(),
        })
        result["transaction_effect"] = {"bid_credits": int(value)}
    elif reward_type == "cash_eur":
        eur_value = round(float(value or 0), 2)
        await db.users.update_one({"_id": user["_id"]}, {"$inc": {"balance": eur_value}})
        await _record_transaction(user_id, "reward_wallet_credit", eur_value, f"{label} ({source})", source, source_id)
        await _record_wallet_transaction(user_id, source, eur_value, label, {"source_id": source_id})
        result["transaction_effect"] = {"wallet_eur": eur_value}
    elif reward_type == "cashback":
        cashback_amount = round(float(value or 0), 2)
        profile = await _ensure_user_reward_profile(user_id, await _has_active_premium(user_id))
        multiplier = float(profile.get("cashback_multiplier", 1.0) or 1.0)
        await db.cashback_claims.insert_one({
            "claim_id": _generate_reward_code("CBK"),
            "user_id": user_id,
            "user_email": user.get("email", ""),
            "cashback_amount": cashback_amount,
            "cashback_multiplier": multiplier,
            "description": label,
            "source": source,
            "source_id": source_id,
            "created_at": _now_iso(),
        })
        await db.reward_events.insert_one({
            "event_id": _generate_reward_code("RWD"),
            "user_id": user_id,
            "source_type": source,
            "source_id": source_id,
            "bidcoins": int(cashback_amount),
            "reward_currency": "cashback",
            "description": label,
            "created_at": _now_iso(),
        })
        result["transaction_effect"] = {"cashback_percent": cashback_amount, "cashback_multiplier": multiplier}
    elif reward_type == "coupon":
        result["coupon"] = await _issue_coupon_reward(user, value, source, source_id, label)
        result["transaction_effect"] = {"coupon_amount": round(float(value or 0), 2)}
    elif reward_type == "premium_trial":
        days = int(value or 0)
        expires_at = (datetime.now(timezone.utc) + timedelta(days=days)).isoformat()
        await db.premium_subscriptions.update_one(
            {"user_id": user_id, "reward_source_id": source_id},
            {"$set": {"active": True, "plan": "premium", "started_at": _now_iso(), "expires_at": expires_at, "reward_source_id": source_id}},
            upsert=True,
        )
        await db.users.update_one({"_id": user["_id"]}, {"$set": {"is_premium": True, "premium_plan": "premium"}})
        result["transaction_effect"] = {"premium_days": days, "expires_at": expires_at}
    else:
        raise HTTPException(status_code=400, detail=f"Unsupported reward type: {reward_type}")

    await db.audit_logs.insert_one({
        "timestamp": _now_iso(),
        "event": f"reward_{source}_granted",
        "user_id": user_id,
        "severity": "info",
        "details": {"source_id": source_id, "reward_type": reward_type, "reward_value": value, "label": label},
    })
    return result


async def _get_spin_status(user: dict, config: dict):
    uid = str(user["_id"])
    today = datetime.now(timezone.utc).date().isoformat()
    is_premium = await _has_active_premium(uid)
    limit = int(config.get("premium_daily_spins", 3) if is_premium else config.get("free_daily_spins", 1))
    spins_today = await db.spin_wheel_log.count_documents({"user_id": uid, "date": today})
    remaining = max(0, limit - spins_today)
    next_reset = (datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(days=1)).isoformat()
    return {
        "spins_today": spins_today,
        "limit": limit,
        "remaining": remaining,
        "is_premium": is_premium,
        "next_reset": next_reset,
        "prizes": config.get("spin_rewards", []),
    }


async def _build_mystery_boxes_payload(user: dict, config: dict):
    uid = str(user["_id"])
    is_premium = await _has_active_premium(uid)
    loyalty = await _ensure_user_loyalty(uid)
    history = await db.reward_box_openings.find({"user_id": uid}, {"_id": 0}).sort("created_at", -1).limit(20).to_list(20)
    month_key = datetime.now(timezone.utc).strftime("%Y-%m")
    monthly_free = await db.reward_box_openings.count_documents({"user_id": uid, "month_key": month_key, "payment_type": "premium_free"})
    boxes = []
    for box in config.get("mystery_boxes", []):
        boxes.append({
            **box,
            "can_open_with_bidcoins": int(loyalty.get("coins_balance", 0) or 0) >= int(box.get("price_bidcoins", 0) or 0),
            "premium_can_open_free": bool(is_premium and monthly_free < int(box.get("premium_free_opens_per_month", 0) or 0)),
        })
    return {
        "boxes": boxes,
        "history": history,
        "bidcoins_balance": int(loyalty.get("coins_balance", 0) or 0),
        "premium_free_used_this_month": monthly_free,
        "is_premium": is_premium,
    }


async def _build_reward_coupons(user_id: str):
    coupons = await db.reward_coupons.find({"assigned_user_id": user_id}, {"_id": 0}).sort("created_at", -1).limit(20).to_list(20)
    return coupons


async def _build_reward_hub_dashboard(user: dict):
    uid = str(user["_id"])
    config = await _get_reward_hub_config()
    await _ensure_user_loyalty(uid)
    reward_status = await get_reward_status_payload(user)
    loyalty = await db.user_loyalty.find_one({"user_id": uid}, {"_id": 0}) or {}
    spin_status = await _get_spin_status(user, config)
    plinko_status = await _get_plinko_status(user, config)
    spin_history = await get_spin_history(request=None, user=user, limit=10)
    plinko_history = await get_plinko_history(request=None, user=user, limit=10)
    box_data = await _build_mystery_boxes_payload(user, config)
    coupons = await _build_reward_coupons(uid)
    cashback_claims = await db.cashback_claims.find({"user_id": uid}, {"_id": 0, "cashback_amount": 1}).to_list(500)
    cashback_total = round(sum(float(row.get("cashback_amount", 0) or 0) for row in cashback_claims), 2)
    recent_activity = await db.reward_events.find({"user_id": uid}, {"_id": 0}).sort("created_at", -1).limit(20).to_list(20)
    open_count = await db.reward_box_openings.count_documents({"user_id": uid})
    return {
        "overview": {
            "bidcoins_balance": int(loyalty.get("coins_balance", 0) or 0),
            "bid_credits": int(user.get("bid_credits", 0) or 0),
            "cashback_total": cashback_total,
            "wallet_balance": round(float(user.get("balance", 0) or 0), 2),
            "active_streak": reward_status.get("streak", 0),
            "boxes_opened": open_count,
            "is_premium": await _has_active_premium(uid),
        },
        "spin": {**spin_status, "history": spin_history.get("items", []), "stats": spin_history.get("stats", {})},
        "plinko": {**plinko_status, "history": plinko_history.get("items", []), "stats": plinko_history.get("stats", {})},
        "mystery_boxes": box_data,
        "coupons": coupons,
        "recent_activity": recent_activity,
        "reward_status": reward_status,
        "config": {
            "spin_enabled": config.get("spin_enabled", True),
            "premium_cashback_multiplier": config.get("premium_cashback_multiplier", 1.5),
        },
    }


def _badge_for_points(points: int) -> str:
    badge = "bronze"
    for name, threshold in BADGE_THRESHOLDS.items():
        if points >= threshold:
            badge = name
    return badge


async def _ensure_user_loyalty(user_id: str):
    existing = await db.user_loyalty.find_one({"user_id": user_id})
    if existing:
        return existing
    doc = {"user_id": user_id, "coins_balance": 0, "total_coins_earned": 0, "level": "bronze", "created_at": _now_iso()}
    await db.user_loyalty.insert_one(doc)
    return doc


async def _credit_bidcoins(user_id: str, amount: int, source_type: str, description: str, source_id: str | None = None):
    if amount <= 0:
        return
    loyalty = await _ensure_user_loyalty(user_id)
    new_total = int(loyalty.get("total_coins_earned", 0) or 0) + amount
    new_badge = _badge_for_points(new_total)
    await db.user_loyalty.update_one(
        {"user_id": user_id},
        {"$inc": {"coins_balance": amount, "total_coins_earned": amount}, "$set": {"level": new_badge, "updated_at": _now_iso()}},
        upsert=True,
    )
    await db.reward_events.insert_one({
        "event_id": f"RWD-{source_type[:3].upper()}-{datetime.now(timezone.utc).strftime('%H%M%S%f')}",
        "user_id": user_id,
        "source_type": source_type,
        "source_id": source_id,
        "bidcoins": amount,
        "description": description,
        "created_at": _now_iso(),
    })


async def _build_rewards_history(uid: str, reward_type: str | None = None, limit: int = 100):
    q = {"user_id": uid}
    if reward_type:
        q["source_type"] = reward_type
    return await db.reward_events.find(q, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)


async def get_reward_status_payload(user: dict):
    uid = str(user["_id"])
    now = datetime.now(timezone.utc)
    today = today_str()

    last_claim = user.get("reward_last_claim")
    streak = user.get("reward_streak", 0)
    can_claim = last_claim != today
    yesterday = (now - timedelta(days=1)).strftime("%Y-%m-%d")
    streak_active = last_claim in (today, yesterday) if last_claim else False
    if not streak_active:
        streak = 0

    next_reward = STREAK_REWARDS.get(min(streak + 1, 7), STREAK_REWARDS[7]) if can_claim else 0
    comeback_available = False
    days_away = 0
    if last_claim:
        last_dt = parse_date(last_claim)
        if last_dt:
            days_away = (now - last_dt).days
            comeback_available = days_away >= COMEBACK_MIN_DAYS and can_claim

    milestones = await _get_milestones(user, uid)
    total_reward = user.get("total_reward_credits", 0)
    unread = await db.reward_notifications.count_documents({"user_id": uid, "read": False})

    return {
        "can_claim": can_claim,
        "streak": streak,
        "streak_active": streak_active,
        "next_reward": next_reward,
        "streak_rewards": STREAK_REWARDS,
        "comeback_available": comeback_available,
        "comeback_bonus": COMEBACK_BONUS if comeback_available else 0,
        "days_away": days_away,
        "milestones": milestones,
        "total_reward_credits": total_reward,
        "total_credits": user.get("bid_credits", 0),
        "unread_notifications": unread,
    }


async def _build_rewards_dashboard(user: dict):
    uid = str(user["_id"])
    await _ensure_user_loyalty(uid)
    loyalty = await db.user_loyalty.find_one({"user_id": uid}, {"_id": 0}) or {}
    reward_status = await get_reward_status_payload(user)
    cashback_claims = await db.cashback_claims.find({"user_id": uid}, {"_id": 0, "cashback_amount": 1}).to_list(2000)
    total_cashback = round(sum(float(row.get("cashback_amount", 0) or 0) for row in cashback_claims), 2)
    last_reward = await db.reward_events.find_one({"user_id": uid}, {"_id": 0}, sort=[("created_at", -1)])
    history = await _build_rewards_history(uid, limit=100)
    challenges = []
    quests = await db.daily_quests.find({"user_id": uid}, {"_id": 0}).sort("date", -1).limit(1).to_list(1)
    if quests:
        for q in quests[0].get("quests", []):
            challenges.append({"title": q.get("title") or q.get("id"), "description": q.get("desc"), "progress": q.get("progress", 0), "target": q.get("target", 1), "reward_bidcoins": q.get("reward_blz", 0), "challenge_type": "daily"})
    merchant_rewards = await db.merchant_rewards.find({"is_active": True}, {"_id": 0}).sort("created_at", -1).limit(50).to_list(50)
    active_badge = loyalty.get("level") or _badge_for_points(int(loyalty.get("total_coins_earned", 0) or 0))
    return {
        "available_bidcoins": int(loyalty.get("coins_balance", 0) or 0),
        "cashback_balance": total_cashback,
        "active_streak": reward_status["streak"],
        "current_challenges": challenges[:8],
        "last_reward": last_reward,
        "reward_types": ["walk_earn", "referral", "merchant_loyalty", "cashback", "daily_login", "promotion_rewards"],
        "streak_milestones": REWARDS_V3_STREAKS,
        "badges": BADGE_ORDER,
        "active_badge": active_badge,
        "badge_progress": {"current": active_badge, "total_points": int(loyalty.get("total_coins_earned", 0) or 0)},
        "history": history,
        "merchant_rewards": merchant_rewards,
        "reward_status": reward_status,
        "reward_hub": await _build_reward_hub_dashboard(user),
    }


# ══════════════════════════════════════
# Daily Login + Streak
# ══════════════════════════════════════

@router.post("/daily-claim")
async def claim_daily_reward(request: Request):
    """Claim daily login reward with streak tracking."""
    user = await get_current_user(request)
    uid = user["_id"]
    now = datetime.now(timezone.utc)
    today = today_str()

    last_claim = user.get("reward_last_claim")
    streak = user.get("reward_streak", 0)

    # Already claimed today?
    if last_claim == today:
        raise HTTPException(status_code=400, detail="Already claimed today")

    yesterday = (now - timedelta(days=1)).strftime("%Y-%m-%d")

    if last_claim == yesterday:
        # Consecutive day
        streak = min(streak + 1, 7)
    else:
        # Streak broken or first claim
        streak = 1

    reward = STREAK_REWARDS.get(streak, STREAK_REWARDS[7])

    # Check comeback bonus
    comeback = 0
    comeback_message = None
    if last_claim:
        last_dt = parse_date(last_claim)
        if last_dt:
            days_away = (now - last_dt).days
            if days_away >= COMEBACK_MIN_DAYS:
                comeback = COMEBACK_BONUS
                comeback_message = f"Welcome back! +{COMEBACK_BONUS} bonus credits"

    total_add = reward + comeback

    await db.users.update_one(
        {"_id": uid},
        {
            "$inc": {"bid_credits": total_add, "total_reward_credits": total_add},
            "$set": {
                "reward_last_claim": today,
                "reward_streak": streak,
                "last_active_date": today,
            },
        },
    )
    await _credit_bidcoins(str(uid), total_add, "daily_login", f"Daily Login Reward ({streak} Tage)")
    if streak in REWARDS_V3_STREAKS:
        cfg = await _get_rewards_v3_config()
        streak_bonus = int(cfg.get(f"streak_bonus_{streak}", 0) or 0)
        already = await db.reward_events.find_one({"user_id": str(uid), "source_type": f"streak_{streak}"})
        if streak_bonus > 0 and not already:
            await _credit_bidcoins(str(uid), streak_bonus, f"streak_{streak}", f"Streak Bonus {streak} Tage")

    # Create reward notification
    await db.reward_notifications.insert_one({
        "user_id": str(uid),
        "type": "daily_reward",
        "credits": reward,
        "streak_day": streak,
        "comeback_bonus": comeback,
        "read": False,
        "created_at": now.isoformat(),
    })

    updated = await db.users.find_one({"_id": uid})
    return {
        "credits_awarded": reward,
        "streak_day": streak,
        "comeback_bonus": comeback,
        "comeback_message": comeback_message,
        "total_credits": updated.get("bid_credits", 0),
        "total_reward_credits": updated.get("total_reward_credits", 0),
    }


@router.get("/status")
async def get_reward_status(request: Request):
    """Get current reward status: streak, daily availability, milestones."""
    user = await get_current_user(request)
    return await get_reward_status_payload(user)


async def _get_milestones(user, uid):
    claimed = user.get("milestones_claimed", {})
    milestones = []

    # First top-up
    has_topup = await db.transactions.find_one({"user_id": uid, "type": "topup"}) is not None
    milestones.append({
        "id": "first_topup",
        "completed": has_topup,
        "claimed": claimed.get("first_topup", False),
        "credits": MILESTONES["first_topup"]["credits"],
    })

    # First bid
    has_bid = await db.auction_bids.find_one({"user_id": uid}) is not None
    milestones.append({
        "id": "first_bid",
        "completed": has_bid,
        "claimed": claimed.get("first_bid", False),
        "credits": MILESTONES["first_bid"]["credits"],
    })

    # First win
    has_win = await db.auctions.find_one({"winner_id": uid, "status": "ended"}) is not None
    milestones.append({
        "id": "first_win",
        "completed": has_win,
        "claimed": claimed.get("first_win", False),
        "credits": MILESTONES["first_win"]["credits"],
    })

    # First invite
    has_invite = await db.users.find_one({"referred_by": uid}) is not None
    milestones.append({
        "id": "first_invite",
        "completed": has_invite,
        "claimed": claimed.get("first_invite", False),
        "credits": MILESTONES["first_invite"]["credits"],
    })

    return milestones


@router.post("/milestone/{milestone_id}")
async def claim_milestone(milestone_id: str, request: Request):
    """Claim a completed milestone reward."""
    user = await get_current_user(request)
    uid = str(user["_id"])

    if milestone_id not in MILESTONES:
        raise HTTPException(status_code=400, detail="Invalid milestone")

    claimed = user.get("milestones_claimed", {})
    if claimed.get(milestone_id):
        raise HTTPException(status_code=400, detail="Already claimed")

    milestones = await _get_milestones(user, uid)
    ms = next((m for m in milestones if m["id"] == milestone_id), None)
    if not ms or not ms["completed"]:
        raise HTTPException(status_code=400, detail="Milestone not completed yet")

    credits = MILESTONES[milestone_id]["credits"]
    await db.users.update_one(
        {"_id": user["_id"]},
        {
            "$inc": {"bid_credits": credits, "total_reward_credits": credits},
            "$set": {f"milestones_claimed.{milestone_id}": True},
        },
    )

    await db.reward_notifications.insert_one({
        "user_id": uid,
        "type": "milestone",
        "milestone_id": milestone_id,
        "credits": credits,
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })

    updated = await db.users.find_one({"_id": user["_id"]})
    return {
        "credits_awarded": credits,
        "milestone_id": milestone_id,
        "total_credits": updated.get("bid_credits", 0),
    }


# ══════════════════════════════════════
# Notifications
# ══════════════════════════════════════

@router.get("/notifications")
async def get_reward_notifications(request: Request):
    """Get reward notifications."""
    user = await get_current_user(request)
    uid = str(user["_id"])
    notifs = await db.reward_notifications.find(
        {"user_id": uid}, {"_id": 0}
    ).sort("created_at", -1).to_list(30)
    unread = sum(1 for n in notifs if not n.get("read"))
    return {"notifications": notifs, "unread_count": unread}


@router.post("/notifications/read")
async def mark_notifications_read(request: Request):
    """Mark all reward notifications as read."""
    user = await get_current_user(request)
    uid = str(user["_id"])
    await db.reward_notifications.update_many(
        {"user_id": uid, "read": False},
        {"$set": {"read": True}},
    )
    return {"ok": True}


@router.get("/dashboard-v3")
async def get_rewards_dashboard_v3(request: Request):
    user = await get_current_user(request)
    return await _build_rewards_dashboard(user)


@router.get("/hub")
async def get_reward_hub(request: Request):
    user = await get_current_user(request)
    return await _build_reward_hub_dashboard(user)


@router.get("/mystery-boxes")
async def get_mystery_boxes(request: Request):
    user = await get_current_user(request)
    return await _build_mystery_boxes_payload(user, await _get_reward_hub_config())


@router.post("/mystery-boxes/open")
async def open_mystery_box(req: MysteryBoxOpenRequest, request: Request):
    user = await get_current_user(request)
    uid = str(user["_id"])
    config = await _get_reward_hub_config()
    box = next((item for item in config.get("mystery_boxes", []) if item.get("box_key") == req.box_key), None)
    if not box:
        raise HTTPException(status_code=404, detail="Mystery Box nicht gefunden")

    is_premium = await _has_active_premium(uid)
    loyalty = await _ensure_user_loyalty(uid)
    month_key = datetime.now(timezone.utc).strftime("%Y-%m")
    monthly_free_used = await db.reward_box_openings.count_documents({"user_id": uid, "month_key": month_key, "payment_type": "premium_free"})
    free_limit = int(box.get("premium_free_opens_per_month", 0) or 0)

    payment_type = "bidcoins"
    if is_premium and monthly_free_used < free_limit:
        payment_type = "premium_free"
    else:
        price_bidcoins = int(box.get("price_bidcoins", 0) or 0)
        if int(loyalty.get("coins_balance", 0) or 0) < price_bidcoins:
            raise HTTPException(status_code=400, detail="Nicht genug BidCoins für diese Box")
        await db.user_loyalty.update_one({"user_id": uid}, {"$inc": {"coins_balance": -price_bidcoins}, "$set": {"updated_at": _now_iso()}})
        await db.transactions.insert_one({
            "id": _generate_reward_code("BOXPAY"),
            "user_id": uid,
            "type": "reward_box_purchase",
            "amount": -float(price_bidcoins),
            "currency": "BIDCOINS",
            "description": f"Mystery Box gekauft: {box.get('name')}",
            "merchant_name": "BidBlitz Rewards",
            "status": "completed",
            "reference": _generate_reward_code("BOX"),
            "category": "mystery_box",
            "created_at": _now_iso(),
        })

    reward_index, reward = _pick_weighted(box.get("rewards", []))
    opening_id = _generate_reward_code("MBX")
    grant_result = await _apply_reward_payload(user, reward, "mystery_box", opening_id)
    open_doc = {
        "opening_id": opening_id,
        "user_id": uid,
        "box_key": box.get("box_key"),
        "box_name": box.get("name"),
        "box_tier": box.get("tier"),
        "payment_type": payment_type,
        "reward_index": reward_index,
        "reward": reward,
        "reward_result": grant_result,
        "month_key": month_key,
        "created_at": _now_iso(),
    }
    await db.reward_box_openings.insert_one(dict(open_doc))
    await db.audit_logs.insert_one({
        "timestamp": _now_iso(),
        "event": "mystery_box_opened",
        "user_id": uid,
        "severity": "info",
        "details": {"opening_id": opening_id, "box_key": box.get("box_key"), "payment_type": payment_type, "reward": reward},
    })
    return {
        "ok": True,
        "opening_id": opening_id,
        "box": {"box_key": box.get("box_key"), "name": box.get("name"), "tier": box.get("tier"), "color": box.get("color")},
        "reward": grant_result,
        "payment_type": payment_type,
    }


@router.get("/spin-wheel/status")
async def reward_spin_status(request: Request):
    user = await get_current_user(request)
    return await _get_spin_status(user, await _get_reward_hub_config())


async def get_spin_history(request: Request | None = None, user: dict | None = None, limit: int = 20):
    current_user = user or await get_current_user(request)
    uid = str(current_user["_id"])
    items = await db.spin_wheel_log.find(
        {"user_id": uid},
        {"_id": 0, "spin_id": 1, "prize_label": 1, "prize_type": 1, "prize_value": 1, "prize_index": 1, "created_at": 1, "date": 1},
    ).sort("created_at", -1).limit(min(max(limit, 1), 50)).to_list(50)
    total_spins = await db.spin_wheel_log.count_documents({"user_id": uid})
    totals = {"total_spins": total_spins, "total_bidcoins_won": 0, "total_bid_credits_won": 0, "total_cashback_won": 0, "total_eur_won": 0.0}
    for item in items:
        prize_type = item.get("prize_type")
        prize_value = float(item.get("prize_value", 0) or 0)
        if prize_type == "bidcoins":
            totals["total_bidcoins_won"] += int(prize_value)
        elif prize_type == "bid_credits":
            totals["total_bid_credits_won"] += int(prize_value)
        elif prize_type == "cashback":
            totals["total_cashback_won"] += prize_value
        elif prize_type == "cash_eur":
            totals["total_eur_won"] += prize_value
    totals["total_eur_won"] = round(totals["total_eur_won"], 2)
    totals["total_cashback_won"] = round(totals["total_cashback_won"], 2)
    return {"items": items, "stats": totals}


async def _get_plinko_status(user: dict, config: dict):
    uid = str(user["_id"])
    today = datetime.now(timezone.utc).date().isoformat()
    is_premium = await _has_active_premium(uid)
    reward_profile = await _ensure_user_reward_profile(uid, is_premium)
    move_profile = await _get_move_profile(uid)
    free_limit = int(config.get("premium_daily_plinko_drops", 2) if is_premium else config.get("free_daily_plinko_drops", 0))
    free_used = await db.reward_plinko_drops.count_documents({"user_id": uid, "date": today, "source": "free"})
    next_reset = (datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(days=1)).isoformat()
    inventory = move_profile.get("inventory", {}) if move_profile else {}
    tickets = int(inventory.get("plinko_tickets", 0) or 0)
    premium_multiplier = float(config.get("premium_cashback_multiplier", 1.5) or 1.5) if is_premium else 1.0
    last_drop = reward_profile.get("last_plinko_drop_at")
    return {
        "enabled": bool(config.get("plinko_enabled", True)),
        "is_premium": is_premium,
        "free_limit": free_limit,
        "free_remaining": max(0, free_limit - free_used),
        "ticket_balance": tickets,
        "bidcoin_cost": int(config.get("plinko_bidcoin_cost", 40) or 0),
        "premium_multiplier": premium_multiplier,
        "energy_cost": int(config.get("plinko_energy_cost", 0) or 0),
        "next_reset": next_reset,
        "payouts": config.get("plinko_payouts", DEFAULT_REWARD_HUB_CONFIG["plinko_payouts"]),
        "last_drop_at": last_drop,
    }


async def get_plinko_history(request: Request | None = None, user: dict | None = None, limit: int = 20):
    current_user = user or await get_current_user(request)
    uid = str(current_user["_id"])
    items = await db.reward_plinko_drops.find(
        {"user_id": uid},
        {"_id": 0, "drop_id": 1, "slot_index": 1, "multiplier": 1, "payout_bidcoins": 1, "net_bidcoins": 1, "source": 1, "created_at": 1, "path": 1},
    ).sort("created_at", -1).limit(min(max(limit, 1), 50)).to_list(50)
    total_drops = await db.reward_plinko_drops.count_documents({"user_id": uid})
    totals = {"total_drops": total_drops, "total_bidcoins_won": 0, "total_net_bidcoins": 0, "best_multiplier": 0}
    for item in items:
        payout = int(round(float(item.get("payout_bidcoins", 0) or 0)))
        net = int(round(float(item.get("net_bidcoins", 0) or 0)))
        multiplier = float(item.get("multiplier", 0) or 0)
        totals["total_bidcoins_won"] += payout
        totals["total_net_bidcoins"] += net
        totals["best_multiplier"] = max(totals["best_multiplier"], multiplier)
    totals["best_multiplier"] = round(float(totals["best_multiplier"] or 0), 2)
    return {"items": items, "stats": totals}


def _plinko_pick_slot(payouts: list[dict]) -> tuple[int, dict]:
    weights = [max(1, int(item.get("weight", 1) or 1)) for item in payouts]
    indices = list(range(len(payouts)))
    slot_index = random.choices(indices, weights=weights, k=1)[0]
    return slot_index, payouts[slot_index]


def _plinko_path_for_slot(slot_index: int, rows: int = 10) -> list[int]:
    rights = max(0, min(rows, slot_index))
    path = [1] * rights + [-1] * (rows - rights)
    random.shuffle(path)
    return path


@router.get("/spin-wheel/history")
async def reward_spin_history(request: Request, limit: int = 20):
    return await get_spin_history(request=request, limit=limit)


@router.get("/plinko/status")
async def reward_plinko_status(request: Request):
    user = await get_current_user(request)
    return await _get_plinko_status(user, await _get_reward_hub_config())


@router.get("/plinko/history")
async def reward_plinko_history(request: Request, limit: int = 20):
    return await get_plinko_history(request=request, limit=limit)


@router.post("/plinko/drop")
async def reward_plinko_drop(req: RewardPlinkoDropRequest, request: Request):
    user = await get_current_user(request)
    uid = str(user["_id"])
    config = await _get_reward_hub_config()
    if not config.get("plinko_enabled", True):
        raise HTTPException(status_code=400, detail="Plinko ist derzeit deaktiviert")

    reward_profile = await _ensure_user_reward_profile(uid, await _has_active_premium(uid))
    last_drop_at = reward_profile.get("last_plinko_drop_at")
    if last_drop_at:
        try:
            last_dt = datetime.fromisoformat(last_drop_at)
            if (datetime.now(timezone.utc) - last_dt).total_seconds() < 2:
                raise HTTPException(status_code=429, detail="Bitte kurz warten, bevor du erneut droppst")
        except ValueError:
            pass

    status = await _get_plinko_status(user, config)
    if req.source == "free":
        if status["free_remaining"] <= 0:
            raise HTTPException(status_code=400, detail="Heute kein Gratis-Drop mehr verfügbar")
        entry_cost = 0
    elif req.source == "ticket":
        if status["ticket_balance"] <= 0:
            raise HTTPException(status_code=400, detail="Kein Plinko Ticket verfügbar")
        entry_cost = 0
        await db.move_profiles.update_one({"user_id": uid}, {"$inc": {"inventory.plinko_tickets": -1}, "$set": {"updated_at": _now_iso()}})
    else:
        entry_cost = int(config.get("plinko_bidcoin_cost", 40) or 0)
        loyalty = await _ensure_user_loyalty(uid)
        if int(loyalty.get("coins_balance", 0) or 0) < entry_cost:
            raise HTTPException(status_code=400, detail="Nicht genug BidCoins für Plinko")
        await db.user_loyalty.update_one({"user_id": uid}, {"$inc": {"coins_balance": -entry_cost}, "$set": {"updated_at": _now_iso()}})
        await db.transactions.insert_one({
            "id": _generate_reward_code("PLPAY"),
            "user_id": uid,
            "type": "reward_plinko_entry",
            "amount": -float(entry_cost),
            "currency": "BIDCOINS",
            "description": "Reward Plinko Einsatz",
            "merchant_name": "BidBlitz Rewards",
            "status": "completed",
            "reference": _generate_reward_code("PLINKO"),
            "category": "reward_plinko",
            "created_at": _now_iso(),
        })

    payouts = config.get("plinko_payouts", DEFAULT_REWARD_HUB_CONFIG["plinko_payouts"])
    slot_index, slot = _plinko_pick_slot(payouts)
    multiplier = round(float(slot.get("multiplier", 0) or 0), 2)
    if req.source == "free":
        reward_amount = max(1, int(round(multiplier * 10)))
    elif req.source == "ticket":
        reward_amount = max(1, int(round(multiplier * 14)))
    else:
        reward_amount = max(1, int(round(entry_cost * multiplier)))
    premium_multiplier = float(status.get("premium_multiplier", 1.0) or 1.0)
    if premium_multiplier > 1 and multiplier >= 1:
        reward_amount = int(round(reward_amount * premium_multiplier))
    net_bidcoins = reward_amount - entry_cost
    path = _plinko_path_for_slot(slot_index)
    drop_id = _generate_reward_code("PLK")
    await _credit_bidcoins(uid, reward_amount, "reward_plinko", f"Reward Plinko {multiplier}x", drop_id)
    drop_doc = {
        "drop_id": drop_id,
        "user_id": uid,
        "date": datetime.now(timezone.utc).date().isoformat(),
        "source": req.source,
        "entry_bidcoins": entry_cost,
        "slot_index": slot_index,
        "multiplier": multiplier,
        "payout_bidcoins": reward_amount,
        "net_bidcoins": net_bidcoins,
        "path": path,
        "created_at": _now_iso(),
    }
    await db.reward_plinko_drops.insert_one(dict(drop_doc))
    await db.reward_user_profiles.update_one({"user_id": uid}, {"$set": {"last_plinko_drop_at": _now_iso(), "updated_at": _now_iso()}}, upsert=True)
    await db.audit_logs.insert_one({
        "timestamp": _now_iso(),
        "event": "reward_plinko_drop_completed",
        "user_id": uid,
        "severity": "info",
        "details": {"drop_id": drop_id, "source": req.source, "slot_index": slot_index, "multiplier": multiplier, "payout_bidcoins": reward_amount},
    })
    updated_status = await _get_plinko_status(user, config)
    return {
        "ok": True,
        "drop_id": drop_id,
        "source": req.source,
        "path": path,
        "slot_index": slot_index,
        "multiplier": multiplier,
        "payout_bidcoins": reward_amount,
        "net_bidcoins": net_bidcoins,
        "free_remaining": updated_status.get("free_remaining", 0),
        "ticket_balance": updated_status.get("ticket_balance", 0),
    }


@router.post("/spin-wheel/spin")
async def reward_spin(request: Request):
    user = await get_current_user(request)
    uid = str(user["_id"])
    config = await _get_reward_hub_config()
    if not config.get("spin_enabled", True):
        raise HTTPException(status_code=400, detail="Glücksrad ist derzeit deaktiviert")
    status = await _get_spin_status(user, config)
    if status["remaining"] <= 0:
        raise HTTPException(status_code=400, detail="Heute keine Freispiele mehr verfügbar")
    rewards = config.get("spin_rewards", [])
    prize_index, prize = _pick_weighted(rewards)
    spin_id = _generate_reward_code("SPN")
    reward_result = await _apply_reward_payload(user, prize, "spin_wheel", spin_id)
    await db.spin_wheel_log.insert_one({
        "spin_id": spin_id,
        "user_id": uid,
        "date": datetime.now(timezone.utc).date().isoformat(),
        "prize_type": prize.get("type"),
        "prize_value": prize.get("value"),
        "prize_label": prize.get("label"),
        "prize_index": prize_index,
        "created_at": _now_iso(),
    })
    await db.audit_logs.insert_one({
        "timestamp": _now_iso(),
        "event": "reward_spin_completed",
        "user_id": uid,
        "severity": "info",
        "details": {"spin_id": spin_id, "prize": prize, "prize_index": prize_index},
    })
    updated_status = await _get_spin_status(user, config)
    return {
        "ok": True,
        "spin_id": spin_id,
        "prize_index": prize_index,
        "prize": {**prize, **reward_result},
        "remaining": updated_status["remaining"],
    }


@router.get("/spin-wheel/leaderboard")
async def reward_spin_leaderboard(request: Request, limit: int = 20):
    await get_current_user(request)
    pipeline = [
        {"$group": {"_id": "$user_id", "spins": {"$sum": 1}, "wallet_eur": {"$sum": {"$cond": [{"$eq": ["$prize_type", "cash_eur"]}, "$prize_value", 0]}}, "bidcoins": {"$sum": {"$cond": [{"$eq": ["$prize_type", "bidcoins"]}, "$prize_value", 0]}}, "bid_credits": {"$sum": {"$cond": [{"$eq": ["$prize_type", "bid_credits"]}, "$prize_value", 0]}}}},
        {"$sort": {"bid_credits": -1, "bidcoins": -1, "wallet_eur": -1, "spins": -1}},
        {"$limit": min(max(limit, 1), 50)},
    ]
    rows = await db.spin_wheel_log.aggregate(pipeline).to_list(50)
    leaderboard = []
    for idx, row in enumerate(rows):
        user = await db.users.find_one({"_id": _oid(row.get("_id"))}, {"_id": 0, "name": 1, "email": 1}) or {}
        raw_name = user.get("name") or user.get("email", "Anonym")
        parts = raw_name.split(" ", 1)
        masked = parts[0] + (f" {parts[1][0]}." if len(parts) > 1 and parts[1] else "")
        leaderboard.append({
            "rank": idx + 1,
            "name": masked,
            "spins": int(row.get("spins", 0) or 0),
            "bidcoins": int(row.get("bidcoins", 0) or 0),
            "bid_credits": int(row.get("bid_credits", 0) or 0),
            "wallet_eur": round(float(row.get("wallet_eur", 0) or 0), 2),
        })
    return {"leaderboard": leaderboard, "total": len(leaderboard)}


@router.get("/coupons")
async def get_my_reward_coupons(request: Request):
    user = await get_current_user(request)
    return {"coupons": await _build_reward_coupons(str(user["_id"]))}


@router.get("/history")
async def get_rewards_history_v3(request: Request, reward_type: str | None = None, limit: int = 100):
    user = await get_current_user(request)
    uid = str(user["_id"])
    history = await _build_rewards_history(uid, reward_type=reward_type, limit=min(limit, 500))
    return {"history": history, "total": len(history)}


@router.get("/history/export.csv")
async def export_rewards_history_csv(request: Request, reward_type: str | None = None):
    user = await get_current_user(request)
    uid = str(user["_id"])
    history = await _build_rewards_history(uid, reward_type=reward_type, limit=1000)
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(["created_at", "source_type", "bidcoins", "description", "source_id"])
    for row in history:
        writer.writerow([row.get("created_at"), row.get("source_type"), row.get("bidcoins"), row.get("description"), row.get("source_id")])
    return Response(content=buffer.getvalue(), media_type="text/csv", headers={"Content-Disposition": "attachment; filename=rewards_history.csv"})


@router.get("/history/export.pdf")
async def export_rewards_history_pdf(request: Request, reward_type: str | None = None):
    from reportlab.lib.pagesizes import A4
    from reportlab.pdfgen import canvas

    user = await get_current_user(request)
    uid = str(user["_id"])
    history = await _build_rewards_history(uid, reward_type=reward_type, limit=150)
    buffer = io.BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4
    y = height - 40
    pdf.setFont("Helvetica-Bold", 14)
    pdf.drawString(40, y, "BidBlitz Rewards History")
    y -= 24
    pdf.setFont("Helvetica", 9)
    for item in history:
        line = f"{item.get('created_at', '')[:19]} | {item.get('source_type', '')} | {item.get('bidcoins', 0)} BC | {item.get('description', '')[:70]}"
        pdf.drawString(40, y, line)
        y -= 14
        if y < 50:
            pdf.showPage()
            pdf.setFont("Helvetica", 9)
            y = height - 40
    pdf.save()
    buffer.seek(0)
    return Response(content=buffer.read(), media_type="application/pdf", headers={"Content-Disposition": "attachment; filename=rewards_history.pdf"})


@router.get("/merchant-rewards")
async def get_merchant_rewards():
    rewards = await db.merchant_rewards.find({"is_active": True}, {"_id": 0}).sort("created_at", -1).limit(100).to_list(100)
    return {"merchant_rewards": rewards}


@router.post("/merchant-rewards")
async def create_merchant_reward(req: MerchantRewardCreate, request: Request):
    user = await get_current_user(request)
    if user.get("role") not in {"merchant", "admin"}:
        raise HTTPException(status_code=403, detail="Nur für Händler/Admin")
    uid = str(user["_id"])
    row = {
        "reward_id": f"MRW-{datetime.now(timezone.utc).strftime('%H%M%S%f')}",
        "merchant_user_id": uid,
        "merchant_name": user.get("name", ""),
        "title": req.title,
        "description": req.description,
        "reward_type": req.reward_type,
        "cost_bidcoins": req.cost_bidcoins,
        "cashback_amount": round(float(req.cashback_amount or 0), 2),
        "voucher_code": req.voucher_code,
        "free_product_name": req.free_product_name,
        "is_active": req.is_active,
        "created_at": _now_iso(),
    }
    stored = dict(row)
    await db.merchant_rewards.insert_one(stored)
    await db.audit_logs.insert_one({"timestamp": _now_iso(), "event": "merchant_reward_created", "user_id": uid, "severity": "info", "details": {"reward_id": row["reward_id"], "title": row["title"], "type": row["reward_type"]}})
    return {"ok": True, "reward": row}


@router.get("/admin/config")
async def get_rewards_admin_config(request: Request):
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Nur Admin")
    config = await _get_rewards_v3_config()
    reward_hub_config = await _get_reward_hub_config()
    suspicious = await db.reward_events.aggregate([
        {"$group": {"_id": "$user_id", "count": {"$sum": 1}, "coins": {"$sum": "$bidcoins"}}},
        {"$match": {"$or": [{"coins": {"$gte": 2000}}, {"count": {"$gte": 50}}]}},
        {"$sort": {"coins": -1}},
        {"$limit": 30},
    ]).to_list(30)
    spin_count = await db.spin_wheel_log.count_documents({})
    box_count = await db.reward_box_openings.count_documents({})
    coupon_count = await db.reward_coupons.count_documents({})
    recent_audits = await db.audit_logs.find(
        {"event": {"$regex": "reward|spin|box", "$options": "i"}},
        {"_id": 0},
    ).sort("timestamp", -1).limit(25).to_list(25)
    return {
        "config": config,
        "reward_hub_config": reward_hub_config,
        "suspicious_users": suspicious,
        "stats": {
            "spin_count": spin_count,
            "box_open_count": box_count,
            "coupon_count": coupon_count,
        },
        "recent_audits": recent_audits,
    }


@router.post("/admin/config")
async def update_rewards_admin_config(req: RewardConfigUpdate, request: Request):
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Nur Admin")
    updates = {k: v for k, v in req.dict(exclude_none=True).items()}
    if updates:
        current = await _get_rewards_v3_config()
        await db.platform_config.update_one({"key": "rewards_v3_config"}, {"$set": {"settings": {**current, **updates}}}, upsert=True)
        await db.audit_logs.insert_one({"timestamp": _now_iso(), "event": "rewards_v3_config_updated", "user_id": str(user["_id"]), "severity": "info", "details": updates})
    return {"ok": True, "config": await _get_rewards_v3_config()}


@router.post("/admin/reward-hub-config")
async def update_reward_hub_config(req: RewardHubConfigUpdate, request: Request):
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Nur Admin")
    updates = {k: v for k, v in req.dict(exclude_none=True).items()}
    if updates:
        current = await _get_reward_hub_config()
        merged = {**current, **updates}
        await db.platform_config.update_one({"key": "reward_hub_config"}, {"$set": {"settings": merged}}, upsert=True)
        await db.audit_logs.insert_one({
            "timestamp": _now_iso(),
            "event": "reward_hub_config_updated",
            "user_id": str(user["_id"]),
            "severity": "info",
            "details": {"updated_keys": list(updates.keys())},
        })
    return {"ok": True, "reward_hub_config": await _get_reward_hub_config()}
