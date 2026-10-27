"""
BidBlitz V2 - BlitzPoints Redemption System
Complete rewards store where users can redeem their coins for real benefits.
"""

import secrets
import logging
import hashlib
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, List
from fastapi import APIRouter, HTTPException, Request, Query
from pydantic import BaseModel, Field
from bson import ObjectId

from core.database import db
from core.payment_engine import credit_wallet, TransactionType
from core.security import get_current_user

router = APIRouter(prefix="/api/rewards-store", tags=["Rewards Store"])
logger = logging.getLogger("bidblitz.rewards_store")


# ══════════════════════════════════════════════════════════════════════════════
# REWARD TYPES
# ══════════════════════════════════════════════════════════════════════════════

REWARD_TYPES = {
    "discount": {
        "name": "Rabatt",
        "icon": "percent",
        "color": "#00E89D",
        "description": "€ Rabatt auf deine nächste Transaktion",
    },
    "boost": {
        "name": "Boost",
        "icon": "rocket",
        "color": "#A855F7",
        "description": "Kostenloser Marketplace-Boost",
    },
    "vip": {
        "name": "VIP Zugang",
        "icon": "crown",
        "color": "#FFD700",
        "description": "Temporärer VIP-Status",
    },
    "cashback": {
        "name": "Cashback",
        "icon": "wallet",
        "color": "#00C2FF",
        "description": "Direkte Gutschrift ins Wallet",
    },
}

# Daily redemption limits per type
DAILY_LIMITS = {
    "discount": 3,
    "boost": 2,
    "vip": 1,
    "cashback": 5,
}


# ══════════════════════════════════════════════════════════════════════════════
# DEFAULT REWARDS (Seeded on first access)
# ══════════════════════════════════════════════════════════════════════════════

DEFAULT_REWARDS = [
    # Discounts
    {"title": "2€ Rabatt", "description": "2€ Rabatt auf deine nächste Zahlung", "type": "discount", "cost_points": 200, "reward_value": 2.0},
    {"title": "5€ Rabatt", "description": "5€ Rabatt auf deine nächste Zahlung", "type": "discount", "cost_points": 500, "reward_value": 5.0},
    {"title": "10€ Rabatt", "description": "10€ Rabatt auf deine nächste Zahlung", "type": "discount", "cost_points": 900, "reward_value": 10.0},
    {"title": "20€ Rabatt", "description": "20€ Rabatt auf deine nächste Zahlung", "type": "discount", "cost_points": 1600, "reward_value": 20.0},
    
    # Boosts
    {"title": "24h Boost", "description": "Kostenloser 24-Stunden Marketplace-Boost", "type": "boost", "cost_points": 300, "reward_value": 24},
    {"title": "7-Tage Boost", "description": "Kostenloser 7-Tage Marketplace-Boost", "type": "boost", "cost_points": 800, "reward_value": 168},
    
    # VIP
    {"title": "VIP 3 Tage", "description": "3 Tage VIP-Status mit allen Vorteilen", "type": "vip", "cost_points": 600, "reward_value": 3},
    {"title": "VIP 7 Tage", "description": "7 Tage VIP-Status mit allen Vorteilen", "type": "vip", "cost_points": 1200, "reward_value": 7},
    {"title": "VIP 30 Tage", "description": "30 Tage VIP-Status mit allen Vorteilen", "type": "vip", "cost_points": 4000, "reward_value": 30},
    
    # Cashback
    {"title": "1€ Cashback", "description": "1€ direkt ins Wallet", "type": "cashback", "cost_points": 150, "reward_value": 1.0},
    {"title": "3€ Cashback", "description": "3€ direkt ins Wallet", "type": "cashback", "cost_points": 400, "reward_value": 3.0},
    {"title": "5€ Cashback", "description": "5€ direkt ins Wallet", "type": "cashback", "cost_points": 600, "reward_value": 5.0},
]


async def ensure_default_rewards():
    """Seed default rewards if none exist."""
    count = await db.rewards_store.count_documents({})
    if count == 0:
        now = datetime.now(timezone.utc).isoformat()
        for reward in DEFAULT_REWARDS:
            await db.rewards_store.insert_one({
                "id": secrets.token_hex(8),
                "title": reward["title"],
                "description": reward["description"],
                "type": reward["type"],
                "cost_points": reward["cost_points"],
                "reward_value": reward["reward_value"],
                "is_active": True,
                "created_at": now,
            })
        logger.info(f"Seeded {len(DEFAULT_REWARDS)} default rewards")


# ══════════════════════════════════════════════════════════════════════════════
# HELPER FUNCTIONS
# ══════════════════════════════════════════════════════════════════════════════

async def get_user_coins(user_id: str) -> int:
    """Get user's current coin balance."""
    loyalty = await db.user_loyalty.find_one({"user_id": user_id})
    if not loyalty:
        return 0
    return loyalty.get("coins_balance", 0)


async def deduct_coins(user_id: str, amount: int) -> bool:
    """Deduct coins from user's balance."""
    result = await db.user_loyalty.update_one(
        {"user_id": user_id, "coins_balance": {"$gte": amount}},
        {"$inc": {"coins_balance": -amount}}
    )
    return result.modified_count > 0


def _require_reward_idempotency_key(body_key: Optional[str], request: Request) -> str:
    key = (body_key or request.headers.get("Idempotency-Key") or "").strip()
    if not 8 <= len(key) <= 200:
        raise HTTPException(status_code=400, detail="Idempotency-Key erforderlich")
    return key


def _reward_marker_hash(user_id: str, reward_id: str, idempotency_key: str) -> str:
    return hashlib.sha256(
        f"{user_id}:{reward_id}:{idempotency_key}".encode("utf-8")
    ).hexdigest()[:24]


async def get_today_redemptions(user_id: str, reward_type: str) -> int:
    """Count user's redemptions of a specific type today."""
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    count = await db.rewards_history.count_documents({
        "user_id": user_id,
        "reward_type": reward_type,
        "created_at": {"$gte": today_start},
    })
    return count


async def apply_discount_reward(user_id: str, value: float, redemption_id: str):
    """Apply discount credit exactly once."""
    now = datetime.now(timezone.utc).isoformat()
    expires = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
    doc = {
        "_id": f"discount:{redemption_id}",
        "id": f"discount:{redemption_id}",
        "user_id": user_id,
        "amount": float(value),
        "remaining": float(value),
        "source": "blitzpoints_redemption",
        "source_id": redemption_id,
        "expires_at": expires,
        "is_active": True,
        "created_at": now,
    }
    await db.user_discounts.update_one(
        {"_id": doc["_id"]},
        {"$setOnInsert": doc},
        upsert=True,
    )


async def apply_boost_reward(user_id: str, hours: int, redemption_id: str):
    """Grant one boost entitlement exactly once."""
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "_id": f"boost:{redemption_id}",
        "id": f"boost:{redemption_id}",
        "user_id": user_id,
        "duration_hours": int(hours),
        "source": "blitzpoints_redemption",
        "source_id": redemption_id,
        "is_used": False,
        "created_at": now,
    }
    await db.user_boost_credits.update_one(
        {"_id": doc["_id"]},
        {"$setOnInsert": doc},
        upsert=True,
    )


async def apply_vip_reward(user_id: str, days: int, redemption_id: str):
    """Extend temporary VIP exactly once per redemption."""
    now = datetime.now(timezone.utc)
    marker = hashlib.sha256(f"vip:{redemption_id}".encode("utf-8")).hexdigest()[:24]
    marker_field = f"reward_markers.{marker}"
    existing = await db.user_vip.find_one({"user_id": user_id}) or {}
    if (existing.get("reward_markers") or {}).get(marker):
        return

    current_expires = None
    if existing.get("expires_at"):
        try:
            current_expires = datetime.fromisoformat(str(existing["expires_at"]).replace("Z", "+00:00"))
            if current_expires.tzinfo is None:
                current_expires = current_expires.replace(tzinfo=timezone.utc)
        except Exception:
            current_expires = None
    base = current_expires if current_expires and current_expires > now else now
    new_expires = base + timedelta(days=int(days))

    result = await db.user_vip.update_one(
        {"user_id": user_id, marker_field: {"$exists": False}},
        {
            "$set": {
                "user_id": user_id,
                "is_active": True,
                "source": "blitzpoints_redemption",
                "source_id": redemption_id,
                "expires_at": new_expires.isoformat(),
                "updated_at": now.isoformat(),
                marker_field: {
                    "redemption_id": redemption_id,
                    "days": int(days),
                    "created_at": now.isoformat(),
                },
            },
            "$setOnInsert": {"created_at": now.isoformat()},
        },
        upsert=True,
    )
    if result.modified_count == 0 and result.upserted_id is None:
        fresh = await db.user_vip.find_one({"user_id": user_id, marker_field: {"$exists": True}})
        if not fresh:
            raise RuntimeError("VIP reward could not be finalized")

    await db.users.update_one(
        {"_id": ObjectId(user_id) if ObjectId.is_valid(user_id) else user_id},
        {"$max": {"vip_until": new_expires.isoformat()}},
    )


async def apply_cashback_reward(user_id: str, amount: float, redemption_id: str):
    """Credit cashback through the canonical wallet ledger exactly once."""
    result = await credit_wallet(
        user_id=user_id,
        amount=round(float(amount), 2),
        tx_type=TransactionType.LOYALTY_CASHBACK,
        description=f"BlitzPoints Einlösung: {float(amount):.2f}€ Cashback",
        reference=f"BP-{redemption_id[-12:].upper()}",
        source="rewards_store",
        metadata={
            "kind": "blitzpoints_cashback",
            "redemption_id": redemption_id,
        },
        idempotency_key=f"rewards-store:cashback:{redemption_id}",
    )
    if not result.success:
        raise RuntimeError(result.error or "Cashback wallet credit failed")
    return result


# ══════════════════════════════════════════════════════════════════════════════
# USER API ENDPOINTS
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/list")
async def list_rewards(
    request: Request,
    type: Optional[str] = None,
    include_inactive: bool = False,
):
    """Get available rewards in the store."""
    await ensure_default_rewards()
    
    query = {}
    if not include_inactive:
        query["is_active"] = True
    if type and type in REWARD_TYPES:
        query["type"] = type
    
    rewards = await db.rewards_store.find(query, {"_id": 0}).sort("cost_points", 1).to_list(50)
    
    # Add type metadata
    for r in rewards:
        r["type_info"] = REWARD_TYPES.get(r["type"], {})
    
    # Get user's coins if authenticated
    user_coins = 0
    try:
        user = await get_current_user(request)
        user_coins = await get_user_coins(str(user["_id"]))
    except:
        pass
    
    return {
        "rewards": rewards,
        "user_coins": user_coins,
        "types": REWARD_TYPES,
    }


@router.get("/my-balance")
async def get_my_balance(request: Request):
    """Get user's BlitzPoints balance and stats."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    loyalty = await db.user_loyalty.find_one({"user_id": user_id})
    
    # Get active discounts
    discounts = await db.user_discounts.find(
        {"user_id": user_id, "is_active": True, "remaining": {"$gt": 0}},
        {"_id": 0}
    ).to_list(10)
    
    # Get unused boost credits
    boosts = await db.user_boost_credits.find(
        {"user_id": user_id, "is_used": False},
        {"_id": 0}
    ).to_list(10)
    
    # Get VIP status
    vip = await db.user_vip.find_one({"user_id": user_id}, {"_id": 0})
    vip_active = False
    vip_expires = None
    if vip:
        vip_expires = vip.get("expires_at")
        if vip_expires and vip_expires > datetime.now(timezone.utc).isoformat():
            vip_active = True
    
    return {
        "coins_balance": loyalty.get("coins_balance", 0) if loyalty else 0,
        "total_earned": loyalty.get("total_coins_earned", 0) if loyalty else 0,
        "level": loyalty.get("level", "bronze") if loyalty else "bronze",
        "active_discounts": discounts,
        "boost_credits": boosts,
        "vip_active": vip_active,
        "vip_expires": vip_expires,
    }


@router.post("/redeem")
async def redeem_reward(request: Request):
    """Redeem BlitzPoints exactly once, including wallet-backed cashback."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    body = await request.json()
    reward_id = str(body.get("reward_id") or "").strip()
    if not reward_id:
        raise HTTPException(status_code=400, detail="reward_id required")

    idempotency_key = _require_reward_idempotency_key(body.get("idempotency_key"), request)
    marker_hash = _reward_marker_hash(user_id, reward_id, idempotency_key)
    marker_field = f"redemption_markers.{marker_hash}"
    redemption_id = f"RWD-{marker_hash.upper()}"

    previous = await db.rewards_history.find_one(
        {"id": redemption_id, "user_id": user_id},
        {"_id": 0},
    )
    if previous:
        return {
            "success": True,
            "message": f"{previous.get('reward_title', 'Reward')} erfolgreich eingelöst!",
            "points_spent": previous.get("points_spent", 0),
            "new_balance": await get_user_coins(user_id),
            "reward": {
                "type": previous.get("reward_type"),
                "value": previous.get("reward_value"),
                "title": previous.get("reward_title"),
            },
            "replayed": True,
        }

    reward = await db.rewards_store.find_one({"id": reward_id, "is_active": True})
    if not reward:
        raise HTTPException(status_code=404, detail="Reward not found or inactive")

    cost = int(reward["cost_points"])
    reward_type = str(reward["type"])
    reward_value = reward["reward_value"]

    today_count = await get_today_redemptions(user_id, reward_type)
    daily_limit = DAILY_LIMITS.get(reward_type, 5)
    if today_count >= daily_limit:
        raise HTTPException(
            status_code=429,
            detail=f"Tageslimit erreicht ({daily_limit}x {REWARD_TYPES[reward_type]['name']} pro Tag)",
        )

    day_key = datetime.now(timezone.utc).strftime("%Y%m%d")
    daily_field = f"daily_redemption_limits.{day_key}.{reward_type}"

    loyalty = await db.user_loyalty.find_one(
        {"user_id": user_id, marker_field: {"$exists": True}},
        {"_id": 0, "coins_balance": 1, marker_field: 1},
    )
    replay_reservation = bool(loyalty)
    if not replay_reservation:
        reserve = await db.user_loyalty.update_one(
            {
                "user_id": user_id,
                "coins_balance": {"$gte": cost},
                marker_field: {"$exists": False},
                "$expr": {
                    "$lt": [
                        {"$ifNull": [f"${daily_field}", 0]},
                        daily_limit,
                    ]
                },
            },
            {
                "$inc": {"coins_balance": -cost, daily_field: 1},
                "$set": {
                    marker_field: {
                        "redemption_id": redemption_id,
                        "reward_id": reward_id,
                        "cost": cost,
                        "status": "reserved",
                        "reserved_at": datetime.now(timezone.utc).isoformat(),
                    }
                },
            },
        )
        if reserve.modified_count != 1:
            current_doc = await db.user_loyalty.find_one(
                {"user_id": user_id},
                {"_id": 0, "coins_balance": 1, "daily_redemption_limits": 1, marker_field: 1},
            ) or {}
            marker_root = current_doc.get("redemption_markers") or {}
            if marker_hash in marker_root:
                raise HTTPException(status_code=409, detail="Einlösung wird bereits verarbeitet")
            current_daily = int(
                (((current_doc.get("daily_redemption_limits") or {}).get(day_key) or {}).get(reward_type, 0)) or 0
            )
            if current_daily >= daily_limit:
                raise HTTPException(
                    status_code=429,
                    detail=f"Tageslimit erreicht ({daily_limit}x {REWARD_TYPES[reward_type]['name']} pro Tag)",
                )
            current = int(current_doc.get("coins_balance") or 0)
            raise HTTPException(
                status_code=400,
                detail=f"Nicht genug BlitzPoints. Du hast {current}, brauchst aber {cost}.",
            )

    now = datetime.now(timezone.utc).isoformat()
    try:
        if reward_type == "discount":
            await apply_discount_reward(user_id, reward_value, redemption_id)
        elif reward_type == "boost":
            await apply_boost_reward(user_id, int(reward_value), redemption_id)
        elif reward_type == "vip":
            await apply_vip_reward(user_id, int(reward_value), redemption_id)
        elif reward_type == "cashback":
            await apply_cashback_reward(user_id, float(reward_value), redemption_id)
        else:
            raise HTTPException(status_code=400, detail="Unknown reward type")
    except HTTPException:
        if not replay_reservation:
            await db.user_loyalty.update_one(
                {"user_id": user_id, f"{marker_field}.status": "reserved"},
                {
                    "$inc": {"coins_balance": cost, daily_field: -1},
                    "$unset": {marker_field: ""},
                },
            )
        raise
    except Exception as exc:
        # Cashback may already have reached the canonical wallet. Keep the marker
        # for retry/reconciliation rather than blindly refunding points.
        if reward_type == "cashback":
            await db.user_loyalty.update_one(
                {"user_id": user_id, marker_field: {"$exists": True}},
                {"$set": {
                    f"{marker_field}.status": "reconciliation_required",
                    f"{marker_field}.error": str(exc)[:300],
                }},
            )
            raise HTTPException(status_code=500, detail="Cashback-Einlösung benötigt Abstimmung")

        await db.user_loyalty.update_one(
            {"user_id": user_id, f"{marker_field}.status": "reserved"},
            {
                "$inc": {"coins_balance": cost, daily_field: -1},
                "$unset": {marker_field: ""},
            },
        )
        logger.error("Redemption error: %s", exc)
        raise HTTPException(status_code=500, detail="Fehler bei der Einlösung. Punkte wurden zurückerstattet.")

    history = {
        "_id": redemption_id,
        "id": redemption_id,
        "user_id": user_id,
        "reward_id": reward_id,
        "reward_title": reward["title"],
        "reward_type": reward_type,
        "points_spent": cost,
        "reward_value": reward_value,
        "idempotency_key": idempotency_key,
        "created_at": now,
    }
    await db.rewards_history.update_one(
        {"_id": redemption_id},
        {"$setOnInsert": history},
        upsert=True,
    )
    await db.user_loyalty.update_one(
        {"user_id": user_id, marker_field: {"$exists": True}},
        {"$set": {
            f"{marker_field}.status": "completed",
            f"{marker_field}.completed_at": now,
        }},
    )
    await db.notifications.update_one(
        {"_id": f"reward:{redemption_id}"},
        {"$setOnInsert": {
            "_id": f"reward:{redemption_id}",
            "user_id": user_id,
            "type": "reward_redeemed",
            "title": f"{reward['title']} eingelöst!",
            "message": f"Du hast {cost} BlitzPoints für '{reward['title']}' eingelöst.",
            "data": {"reward_id": reward_id, "reward_type": reward_type, "value": reward_value},
            "read": False,
            "created_at": now,
        }},
        upsert=True,
    )

    return {
        "success": True,
        "message": f"{reward['title']} erfolgreich eingelöst!",
        "points_spent": cost,
        "new_balance": await get_user_coins(user_id),
        "reward": {
            "type": reward_type,
            "value": reward_value,
            "title": reward["title"],
        },
        "replayed": replay_reservation,
    }

@router.get("/history")
async def get_redemption_history(request: Request, limit: int = Query(30, le=100)):
    """Get user's redemption history."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    history = await db.rewards_history.find(
        {"user_id": user_id},
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    # Add type info
    for h in history:
        h["type_info"] = REWARD_TYPES.get(h.get("reward_type"), {})
    
    # Stats
    total_spent = sum(h.get("points_spent", 0) for h in history)
    total_redeemed = len(history)
    
    return {
        "history": history,
        "total_points_spent": total_spent,
        "total_redemptions": total_redeemed,
    }


@router.get("/active-benefits")
async def get_active_benefits(request: Request):
    """Get user's currently active benefits from redemptions."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    now = datetime.now(timezone.utc).isoformat()
    
    benefits = []
    
    # Active discounts
    discounts = await db.user_discounts.find(
        {"user_id": user_id, "is_active": True, "remaining": {"$gt": 0}},
        {"_id": 0}
    ).to_list(20)
    
    for d in discounts:
        benefits.append({
            "type": "discount",
            "title": f"€{d['remaining']:.2f} Rabatt",
            "remaining_value": d["remaining"],
            "expires_at": d.get("expires_at"),
            "id": d["id"],
        })
    
    # Unused boost credits
    boosts = await db.user_boost_credits.find(
        {"user_id": user_id, "is_used": False},
        {"_id": 0}
    ).to_list(20)
    
    for b in boosts:
        benefits.append({
            "type": "boost",
            "title": f"{b['duration_hours']}h Boost",
            "duration_hours": b["duration_hours"],
            "id": b["id"],
        })
    
    # VIP status
    vip = await db.user_vip.find_one({"user_id": user_id}, {"_id": 0})
    if vip and vip.get("expires_at", "") > now:
        benefits.append({
            "type": "vip",
            "title": "VIP Status",
            "expires_at": vip["expires_at"],
            "is_active": True,
        })
    
    return {"benefits": benefits}


# ══════════════════════════════════════════════════════════════════════════════
# ADMIN ENDPOINTS
# ══════════════════════════════════════════════════════════════════════════════

class CreateRewardRequest(BaseModel):
    title: str
    description: str
    type: str
    cost_points: int = Field(ge=1)
    reward_value: float = Field(ge=0)
    is_active: bool = True


@router.get("/admin/list")
async def admin_list_rewards(request: Request):
    """Admin: List all rewards including inactive."""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    
    await ensure_default_rewards()
    
    rewards = await db.rewards_store.find({}, {"_id": 0}).sort("type", 1).to_list(100)
    
    # Add stats
    for r in rewards:
        r["redemption_count"] = await db.rewards_history.count_documents({"reward_id": r["id"]})
        r["type_info"] = REWARD_TYPES.get(r["type"], {})
    
    return {"rewards": rewards, "types": REWARD_TYPES}


@router.post("/admin/create")
async def admin_create_reward(req: CreateRewardRequest, request: Request):
    """Admin: Create a new reward."""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    
    if req.type not in REWARD_TYPES:
        raise HTTPException(status_code=400, detail=f"Invalid type. Must be one of: {list(REWARD_TYPES.keys())}")
    
    now = datetime.now(timezone.utc).isoformat()
    reward_id = secrets.token_hex(8)
    
    await db.rewards_store.insert_one({
        "id": reward_id,
        "title": req.title,
        "description": req.description,
        "type": req.type,
        "cost_points": req.cost_points,
        "reward_value": req.reward_value,
        "is_active": req.is_active,
        "created_at": now,
        "created_by": str(user["_id"]),
    })
    
    logger.info(f"Admin {user.get('email')} created reward: {req.title}")
    
    return {"ok": True, "reward_id": reward_id}


@router.put("/admin/{reward_id}")
async def admin_update_reward(reward_id: str, request: Request):
    """Admin: Update a reward."""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    
    body = await request.json()
    
    update = {"$set": {"updated_at": datetime.now(timezone.utc).isoformat()}}
    
    allowed_fields = ["title", "description", "cost_points", "reward_value", "is_active"]
    for field in allowed_fields:
        if field in body:
            update["$set"][field] = body[field]
    
    result = await db.rewards_store.update_one({"id": reward_id}, update)
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Reward not found")
    
    return {"ok": True}


@router.delete("/admin/{reward_id}")
async def admin_delete_reward(reward_id: str, request: Request):
    """Admin: Delete a reward (or deactivate)."""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    
    # Check if reward has redemptions
    has_redemptions = await db.rewards_history.count_documents({"reward_id": reward_id}) > 0
    
    if has_redemptions:
        # Just deactivate instead of deleting
        await db.rewards_store.update_one(
            {"id": reward_id},
            {"$set": {"is_active": False, "deleted_at": datetime.now(timezone.utc).isoformat()}}
        )
        return {"ok": True, "message": "Reward deactivated (has redemption history)"}
    else:
        await db.rewards_store.delete_one({"id": reward_id})
        return {"ok": True, "message": "Reward deleted"}


@router.get("/admin/analytics")
async def admin_rewards_analytics(request: Request, days: int = Query(30, le=365)):
    """Admin: Get rewards redemption analytics."""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    
    start_date = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    
    # Total redemptions
    total_redemptions = await db.rewards_history.count_documents({"created_at": {"$gte": start_date}})
    
    # Total points spent
    pipeline = [
        {"$match": {"created_at": {"$gte": start_date}}},
        {"$group": {
            "_id": None,
            "total_points": {"$sum": "$points_spent"},
            "total_value": {"$sum": "$reward_value"},
        }},
    ]
    result = await db.rewards_history.aggregate(pipeline).to_list(1)
    totals = result[0] if result else {"total_points": 0, "total_value": 0}
    
    # By type
    type_pipeline = [
        {"$match": {"created_at": {"$gte": start_date}}},
        {"$group": {
            "_id": "$reward_type",
            "count": {"$sum": 1},
            "points": {"$sum": "$points_spent"},
            "value": {"$sum": "$reward_value"},
        }},
    ]
    by_type = await db.rewards_history.aggregate(type_pipeline).to_list(10)
    
    # Top rewards
    top_pipeline = [
        {"$match": {"created_at": {"$gte": start_date}}},
        {"$group": {
            "_id": "$reward_id",
            "title": {"$first": "$reward_title"},
            "count": {"$sum": 1},
            "points": {"$sum": "$points_spent"},
        }},
        {"$sort": {"count": -1}},
        {"$limit": 10},
    ]
    top_rewards = await db.rewards_history.aggregate(top_pipeline).to_list(10)
    
    return {
        "period_days": days,
        "total_redemptions": total_redemptions,
        "total_points_spent": totals.get("total_points", 0),
        "total_reward_value": round(totals.get("total_value", 0), 2),
        "by_type": {r["_id"]: {"count": r["count"], "points": r["points"], "value": round(r["value"], 2)} for r in by_type},
        "top_rewards": top_rewards,
    }
