"""
BidBlitz V2 — Rewards System / Rewards Center V3
Daily login, streak rewards, comeback bonus, milestones, unified rewards dashboard.
All rewards paid in bid_credits / platform reward systems.
"""
import logging
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import Response
from pydantic import BaseModel, Field
from core.database import db
import csv
import io

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
    suspicious = await db.reward_events.aggregate([
        {"$group": {"_id": "$user_id", "count": {"$sum": 1}, "coins": {"$sum": "$bidcoins"}}},
        {"$match": {"$or": [{"coins": {"$gte": 2000}}, {"count": {"$gte": 50}}]}},
        {"$sort": {"coins": -1}},
        {"$limit": 30},
    ]).to_list(30)
    return {"config": config, "suspicious_users": suspicious}


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
