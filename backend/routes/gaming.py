"""
BidBlitz V2 - Gaming Platform Backend
Coin-based gaming: Cashback earns Coins, Coins used to play, Winnings in Coins.
Coins can be converted to EUR.
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone, timedelta
from bson import ObjectId
import secrets
import random

from core.database import db
from core.security import get_current_user
from core.payment_engine import credit_wallet, TransactionType

router = APIRouter(prefix="/api/gaming", tags=["gaming"])


# ══════════════════════════════════════════════════════════════════════════════
# SCHEMAS
# ══════════════════════════════════════════════════════════════════════════════

class GamePlayRequest(BaseModel):
    bet: int = 10  # Coins to bet
    points_won: int = 0
    moves: Optional[int] = None


class RedeemRequest(BaseModel):
    coins: int


# ══════════════════════════════════════════════════════════════════════════════
# CONSTANTS
# ══════════════════════════════════════════════════════════════════════════════

COINS_TO_EUR_RATE = 0.001  # 1000 Coins = €1.00
CASHBACK_COIN_RATE = 10  # 1 EUR transaction = 10 Coins cashback
MIN_BET = 5
MAX_BET = 500
MAX_DAILY_WINS_COINS = 10000
MAX_DAILY_SPINS = 50  # Per game type
MIN_REDEEM = 500  # Minimum coins to convert to EUR

# Game-specific max win multipliers
GAME_CONFIG = {
    "slots":    {"max_win": 1000, "name": "Lucky Slots"},
    "wheel":    {"max_win": 2500, "name": "Glücksrad"},
    "scratch":  {"max_win": 500,  "name": "Rubbellos"},
    "quiz":     {"max_win": 100,  "name": "Quiz"},
    "memory":   {"max_win": 100,  "name": "Memory"},
    "dice":     {"max_win": 500,  "name": "Würfelglück"},
    "coinflip": {"max_win": 1000, "name": "Münzwurf"},
    "highlow":  {"max_win": 500,  "name": "Höher/Tiefer"},
    "mines":    {"max_win": 2000, "name": "Minenfeld"},
    "crash":    {"max_win": 5000, "name": "Crash"},
    "plinko":   {"max_win": 1500, "name": "Plinko"},
}


def coins_to_eur(coins: int) -> float:
    return round(coins * COINS_TO_EUR_RATE, 2)


# ══════════════════════════════════════════════════════════════════════════════
# HELPERS
# ══════════════════════════════════════════════════════════════════════════════

async def get_user_coins(user_id: str) -> int:
    """Get user's current coin balance from users collection."""
    user = await db.users.find_one({"_id": ObjectId(user_id)}, {"gaming_coins": 1})
    return user.get("gaming_coins", 0) if user else 0


async def add_coins(user_id: str, amount: int, reason: str, game: str = None):
    """Add coins to user balance."""
    await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$inc": {"gaming_coins": amount}}
    )
    await db.gaming_coin_log.insert_one({
        "user_id": user_id,
        "amount": amount,
        "reason": reason,
        "game": game,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })


async def deduct_coins(user_id: str, amount: int, reason: str, game: str = None):
    """Deduct coins from user balance. Returns False if insufficient."""
    user = await db.users.find_one({"_id": ObjectId(user_id)}, {"gaming_coins": 1})
    current = user.get("gaming_coins", 0) if user else 0
    if current < amount:
        return False
    await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$inc": {"gaming_coins": -amount}}
    )
    await db.gaming_coin_log.insert_one({
        "user_id": user_id,
        "amount": -amount,
        "reason": reason,
        "game": game,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return True


async def get_user_daily_stats(user_id: str) -> dict:
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    stats = await db.gaming_daily_stats.find_one(
        {"user_id": user_id, "date": today}, {"_id": 0}
    )
    if not stats:
        stats = {"user_id": user_id, "date": today, "total_coins_won": 0, "total_coins_bet": 0, "games_played": 0}
    return stats


async def get_user_achievement_stats(user_id: str) -> dict:
    unlocked = await db.user_achievements.find({"user_id": user_id}, {"_id": 0, "reward_blz": 1}).to_list(200)
    return {
        "total_unlocked": len(unlocked),
        "reward_blz": sum(item.get("reward_blz", 0) for item in unlocked),
    }


async def update_daily_stats(user_id: str, coins_won: int, coins_bet: int, game_type: str):
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    await db.gaming_daily_stats.update_one(
        {"user_id": user_id, "date": today},
        {
            "$inc": {
                "total_coins_won": coins_won,
                "total_coins_bet": coins_bet,
                "games_played": 1,
                f"{game_type}_played": 1,
            },
            "$setOnInsert": {"user_id": user_id, "date": today},
        },
        upsert=True,
    )


async def record_game_result(user_id: str, game_type: str, coins_won: int, coins_bet: int, metadata: dict = None):
    record = {
        "user_id": user_id,
        "game_type": game_type,
        "coins_won": coins_won,
        "coins_bet": coins_bet,
        "net": coins_won - coins_bet,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    if metadata:
        record["metadata"] = metadata
    await db.gaming_history.insert_one(record)


# ══════════════════════════════════════════════════════════════════════════════
# PROFILE & COINS BALANCE
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/profile")
async def get_gaming_profile(request: Request):
    """Get user's gaming profile with coin balance and stats."""
    user = await get_current_user(request)
    user_id = str(user["_id"])

    coins = await get_user_coins(user_id)
    daily_stats = await get_user_daily_stats(user_id)

    # Lifetime stats
    lifetime = await db.gaming_history.aggregate([
        {"$match": {"user_id": user_id}},
        {"$group": {
            "_id": None,
            "total_won": {"$sum": "$coins_won"},
            "total_bet": {"$sum": "$coins_bet"},
            "games": {"$sum": 1},
        }}
    ]).to_list(1)

    lt = lifetime[0] if lifetime else {"total_won": 0, "total_bet": 0, "games": 0}

    return {
        "coins": coins,
        "coins_eur_value": coins_to_eur(coins),
        "total_coins_won": lt["total_won"],
        "total_coins_bet": lt["total_bet"],
        "net_profit": lt["total_won"] - lt["total_bet"],
        "games_played": lt["games"],
        "daily_coins_won": daily_stats.get("total_coins_won", 0),
        "daily_games_played": daily_stats.get("games_played", 0),
        "daily_limit": MAX_DAILY_WINS_COINS,
        "min_bet": MIN_BET,
        "max_bet": MAX_BET,
        "coins_to_eur_rate": COINS_TO_EUR_RATE,
    }


@router.get("/game-center-overview")
async def get_game_center_overview(request: Request):
    user = await get_current_user(request)
    user_id = str(user["_id"])
    now = datetime.now(timezone.utc)
    season_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    next_month = (season_start + timedelta(days=32)).replace(day=1)
    season_name = season_start.strftime("Season %m/%Y")

    profile = await get_gaming_profile(request)
    achievement_stats = await get_user_achievement_stats(user_id)
    active_subscription = await db.subscriptions.find_one({
        "user_id": user_id,
        "status": "active",
        "expires_at": {"$gt": now.isoformat()},
    }, {"_id": 0, "plan": 1, "plan_name": 1, "expires_at": 1, "auto_renew": 1})

    season_results = await db.gaming_history.aggregate([
        {"$match": {"created_at": {"$gte": season_start.isoformat()}}},
        {"$group": {
            "_id": "$user_id",
            "season_points": {"$sum": {"$max": ["$net", 0]}},
            "games": {"$sum": 1},
        }},
        {"$sort": {"season_points": -1, "games": 1}},
        {"$limit": 25},
    ]).to_list(25)

    user_rank = None
    user_points = 0
    podium = []
    for idx, entry in enumerate(season_results, start=1):
        user_doc = await db.users.find_one({"_id": ObjectId(entry["_id"])}, {"name": 1}) if ObjectId.is_valid(entry["_id"]) else None
        player = {
            "rank": idx,
            "name": user_doc.get("name", "Anonym") if user_doc else ("Du" if entry["_id"] == user_id else "Anonym"),
            "points": int(entry.get("season_points") or 0),
            "games": int(entry.get("games") or 0),
            "is_current_user": entry["_id"] == user_id,
        }
        if idx <= 3:
            podium.append(player)
        if entry["_id"] == user_id:
            user_rank = idx
            user_points = player["points"]

    if user_rank is None:
        user_points = max(0, int(profile.get("daily_coins_won") or 0) + int(profile.get("games_played") or 0) * 8)
        user_rank = len(season_results) + 1

    challenges_today = await db.daily_challenge_progress.find_one({
        "user_id": user_id,
        "date": now.strftime("%Y-%m-%d"),
    }, {"_id": 0, "challenges": 1})
    completed_challenges = 0
    total_challenges = 0
    if challenges_today and isinstance(challenges_today.get("challenges"), dict):
        total_challenges = len(challenges_today["challenges"])
        completed_challenges = sum(1 for value in challenges_today["challenges"].values() if value.get("completed"))

    target_points = max(3000, ((user_points // 500) + 1) * 500)

    return {
        "profile": profile,
        "season": {
            "season_id": season_start.strftime("%Y-%m"),
            "name": season_name,
            "days_left": max(1, (next_month - now).days),
            "user_rank": user_rank,
            "user_points": user_points,
            "target_points": target_points,
            "progress_pct": min(100, round((user_points / target_points) * 100)) if target_points else 0,
            "podium": podium,
            "milestones": [
                {"points": 500, "reward": "VIP Spin"},
                {"points": 1500, "reward": "Legendary Badge"},
                {"points": 3000, "reward": "Season Chest"},
            ],
        },
        "achievements": {
            "total_unlocked": achievement_stats["total_unlocked"],
            "reward_blz": achievement_stats["reward_blz"],
            "completed_today": completed_challenges,
            "total_today": total_challenges,
        },
        "vip_club": {
            "active": bool(active_subscription),
            "plan_name": active_subscription.get("plan_name") if active_subscription else "Kein VIP Plan aktiv",
            "expires_at": active_subscription.get("expires_at") if active_subscription else None,
            "auto_renew": active_subscription.get("auto_renew") if active_subscription else False,
            "perks": [
                "VIP Multipliers in Events",
                "Exklusive Season Drops",
                "Priority Support im Game Center",
            ],
        },
    }


# ══════════════════════════════════════════════════════════════════════════════
# CASHBACK → COINS
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/earn-cashback")
async def earn_cashback_coins(request: Request):
    """Award coins from cashback (called after transactions)."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    body = await request.json()
    amount_eur = body.get("amount", 0)

    if amount_eur <= 0:
        raise HTTPException(status_code=400, detail="Invalid amount")

    coins = int(amount_eur * CASHBACK_COIN_RATE)
    if coins < 1:
        coins = 1

    await add_coins(user_id, coins, f"Cashback: €{amount_eur:.2f} → {coins} Coins")

    new_balance = await get_user_coins(user_id)
    return {"ok": True, "coins_earned": coins, "new_balance": new_balance}


@router.post("/buy-coins")
async def buy_coins_with_wallet(request: Request):
    """Buy coins using wallet balance. 1 EUR = 1000 Coins."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    body = await request.json()
    eur_amount = body.get("amount", 0)

    if eur_amount < 1 or eur_amount > 100:
        raise HTTPException(status_code=400, detail="Betrag: €1-€100")

    eur_amount = round(eur_amount, 2)
    coins = int(eur_amount / COINS_TO_EUR_RATE)

    # Deduct from wallet
    from core.payment_engine import debit_wallet
    result = await debit_wallet(
        user_id=user_id,
        amount=eur_amount,
        tx_type=TransactionType.REWARD,
        description=f"Gaming Coins gekauft: {coins} Coins",
        metadata={"type": "buy_coins", "coins": coins},
    )

    if not result.success:
        raise HTTPException(status_code=400, detail="Nicht genug Guthaben")

    await add_coins(user_id, coins, f"Coins gekauft: €{eur_amount:.2f} → {coins} Coins")

    new_balance = await get_user_coins(user_id)
    return {"ok": True, "coins_added": coins, "eur_spent": eur_amount, "new_balance": new_balance}


# ══════════════════════════════════════════════════════════════════════════════
# LEADERBOARD
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/leaderboard")
async def get_leaderboard(request: Request, period: str = "all"):
    match_stage = {"$match": {}}
    if period == "today":
        start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0).isoformat()
        match_stage = {"$match": {"created_at": {"$gte": start}}}
    elif period == "week":
        start = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
        match_stage = {"$match": {"created_at": {"$gte": start}}}

    pipeline = [
        match_stage,
        {"$group": {
            "_id": "$user_id",
            "total_coins": {"$sum": "$coins_won"},
            "games": {"$sum": 1},
        }},
        {"$sort": {"total_coins": -1}},
        {"$limit": 20},
    ]

    results = await db.gaming_history.aggregate(pipeline).to_list(20)
    entries = []
    for i, entry in enumerate(results):
        user = await db.users.find_one({"_id": ObjectId(entry["_id"])}, {"name": 1})
        entries.append({
            "rank": i + 1,
            "name": user.get("name", "Anonym") if user else "Anonym",
            "coins": entry["total_coins"],
            "games": entry["games"],
        })

    return {"leaderboard": entries, "period": period}


# ══════════════════════════════════════════════════════════════════════════════
# UNIVERSAL GAME PLAY HANDLER
# ══════════════════════════════════════════════════════════════════════════════

async def play_game(user_id: str, game_type: str, bet: int, coins_won: int, metadata: dict = None):
    """Universal game logic: deduct bet, validate win, credit winnings, record."""
    config = GAME_CONFIG.get(game_type)
    if not config:
        raise HTTPException(status_code=400, detail="Unbekanntes Spiel")

    # Validate bet
    bet = max(MIN_BET, min(bet, MAX_BET))

    # Deduct bet
    success = await deduct_coins(user_id, bet, f"Einsatz: {config['name']}", game_type)
    if not success:
        raise HTTPException(status_code=400, detail="Nicht genug Coins! Kaufe Coins oder verdiene Cashback.")

    # Validate win (cap at max)
    coins_won = max(0, min(coins_won, config["max_win"]))

    # Check daily limit
    daily = await get_user_daily_stats(user_id)
    if daily.get("total_coins_won", 0) + coins_won > MAX_DAILY_WINS_COINS:
        coins_won = max(0, MAX_DAILY_WINS_COINS - daily.get("total_coins_won", 0))

    # Credit winnings
    if coins_won > 0:
        await add_coins(user_id, coins_won, f"Gewinn: {config['name']} ({coins_won} Coins)", game_type)

    # Stats
    await update_daily_stats(user_id, coins_won, bet, game_type)
    await record_game_result(user_id, game_type, coins_won, bet, metadata)

    new_balance = await get_user_coins(user_id)
    net = coins_won - bet

    return {
        "success": True,
        "coins_bet": bet,
        "coins_won": coins_won,
        "net": net,
        "new_balance": new_balance,
        "message": f"+{coins_won} Coins!" if coins_won > 0 else "Kein Gewinn",
    }


# ══════════════════════════════════════════════════════════════════════════════
# GAME ENDPOINTS
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/wheel/spin")
async def wheel_spin(req: GamePlayRequest, request: Request):
    user = await get_current_user(request)
    return await play_game(str(user["_id"]), "wheel", req.bet, req.points_won)


@router.post("/scratch/win")
async def scratch_win(req: GamePlayRequest, request: Request):
    user = await get_current_user(request)
    return await play_game(str(user["_id"]), "scratch", req.bet, req.points_won)


@router.post("/slots/win")
async def slots_win(req: GamePlayRequest, request: Request):
    user = await get_current_user(request)
    return await play_game(str(user["_id"]), "slots", req.bet, req.points_won)


@router.post("/quiz/complete")
async def quiz_complete(req: GamePlayRequest, request: Request):
    user = await get_current_user(request)
    return await play_game(str(user["_id"]), "quiz", req.bet, req.points_won)


@router.post("/memory/complete")
async def memory_complete(req: GamePlayRequest, request: Request):
    user = await get_current_user(request)
    return await play_game(str(user["_id"]), "memory", req.bet, req.points_won, {"moves": req.moves})


@router.post("/dice/win")
async def dice_win(req: GamePlayRequest, request: Request):
    user = await get_current_user(request)
    return await play_game(str(user["_id"]), "dice", req.bet, req.points_won)


# ══════════════════════════════════════════════════════════════════════════════
# REDEEM COINS → EUR
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/redeem")
async def redeem_coins(req: RedeemRequest, request: Request):
    """Convert coins to EUR wallet balance."""
    user = await get_current_user(request)
    user_id = str(user["_id"])

    if req.coins < MIN_REDEEM:
        raise HTTPException(status_code=400, detail=f"Mindestens {MIN_REDEEM} Coins zum Einlösen")

    current = await get_user_coins(user_id)
    if req.coins > current:
        raise HTTPException(status_code=400, detail=f"Nicht genug Coins. Verfügbar: {current}")

    eur_amount = coins_to_eur(req.coins)

    # Deduct coins
    await deduct_coins(user_id, req.coins, f"Eingelöst: {req.coins} Coins → €{eur_amount:.2f}")

    # Credit wallet
    result = await credit_wallet(
        user_id=user_id,
        amount=eur_amount,
        tx_type=TransactionType.REWARD,
        description=f"Gaming Coins eingelöst: {req.coins} Coins",
        metadata={"type": "coin_redemption", "coins": req.coins},
    )

    if not result.success:
        # Refund coins if wallet credit fails
        await add_coins(user_id, req.coins, "Rückerstattung: Einlösung fehlgeschlagen")
        raise HTTPException(status_code=500, detail="Einlösung fehlgeschlagen")

    new_balance = await get_user_coins(user_id)
    return {
        "success": True,
        "coins_redeemed": req.coins,
        "eur_credited": eur_amount,
        "remaining_coins": new_balance,
        "message": f"{req.coins} Coins → €{eur_amount:.2f} auf dein Wallet!",
    }


# ══════════════════════════════════════════════════════════════════════════════
# COIN HISTORY
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/coin-history")
async def get_coin_history(request: Request, limit: int = 50):
    """Get user's coin transaction history."""
    user = await get_current_user(request)
    user_id = str(user["_id"])

    history = await db.gaming_coin_log.find(
        {"user_id": user_id}, {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)

    return {"history": history}
