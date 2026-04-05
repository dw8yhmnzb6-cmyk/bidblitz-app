"""
BidBlitz V2 — Rewards System
Daily login, streak rewards, comeback bonus, milestones.
All rewards paid in bid_credits (platform currency).
"""
import logging
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException, Request
from core.database import db

router = APIRouter(prefix="/api/rewards", tags=["Rewards"])
logger = logging.getLogger("bidblitz.rewards")

# Streak reward table (day 1-7, then repeats day 7)
STREAK_REWARDS = {1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 7, 7: 10}
COMEBACK_BONUS = 3
COMEBACK_MIN_DAYS = 2

MILESTONES = {
    "first_topup": {"credits": 5, "check": "has_topup"},
    "first_bid": {"credits": 3, "check": "has_bid"},
    "first_win": {"credits": 10, "check": "has_win"},
    "first_invite": {"credits": 5, "check": "has_invite"},
}


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
    uid = str(user["_id"])
    now = datetime.now(timezone.utc)
    today = today_str()

    last_claim = user.get("reward_last_claim")
    streak = user.get("reward_streak", 0)
    can_claim = last_claim != today

    # Check if streak is still valid
    yesterday = (now - timedelta(days=1)).strftime("%Y-%m-%d")
    streak_active = last_claim in (today, yesterday) if last_claim else False
    if not streak_active:
        streak = 0

    next_reward = STREAK_REWARDS.get(min(streak + 1, 7), STREAK_REWARDS[7]) if can_claim else 0

    # Comeback check
    comeback_available = False
    days_away = 0
    if last_claim:
        last_dt = parse_date(last_claim)
        if last_dt:
            days_away = (now - last_dt).days
            comeback_available = days_away >= COMEBACK_MIN_DAYS and can_claim

    # Milestones
    milestones = await _get_milestones(user, uid)

    # Total earned
    total_reward = user.get("total_reward_credits", 0)

    # Unread notifications count
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
