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
