"""
BidBlitz V2 - Gaming Platform Backend
Handles game logic, scoring, and direct EUR wallet rewards
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

class GameWinRequest(BaseModel):
    points_won: int
    moves: Optional[int] = None  # For memory game


# ══════════════════════════════════════════════════════════════════════════════
# CONSTANTS - Points to EUR conversion
# ══════════════════════════════════════════════════════════════════════════════

# 1000 points = 1 EUR
POINTS_TO_EUR_RATE = 0.001

# Daily limits
MAX_DAILY_WINS_EUR = 10.0  # Max EUR a user can win per day
MAX_DAILY_SPINS = 3  # Free spins per day for wheel


def points_to_eur(points: int) -> float:
    """Convert gaming points to EUR"""
    return round(points * POINTS_TO_EUR_RATE, 2)


async def get_user_daily_stats(user_id: str) -> dict:
    """Get user's gaming stats for today"""
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    
    stats = await db.gaming_daily_stats.find_one({
        "user_id": user_id,
        "date": today_start.isoformat()[:10]
    })
    
    if not stats:
        return {
            "user_id": user_id,
            "date": today_start.isoformat()[:10],
            "total_points_won": 0,
            "total_eur_won": 0.0,
            "wheel_spins_used": 0,
            "games_played": 0
        }
    
    return stats


async def update_daily_stats(user_id: str, points_won: int, eur_won: float, game_type: str) -> dict:
    """Update user's daily gaming stats"""
    today = datetime.now(timezone.utc).isoformat()[:10]
    
    result = await db.gaming_daily_stats.find_one_and_update(
        {"user_id": user_id, "date": today},
        {
            "$inc": {
                "total_points_won": points_won,
                "total_eur_won": eur_won,
                "games_played": 1,
                "wheel_spins_used": 1 if game_type == "wheel" else 0
            },
            "$setOnInsert": {"user_id": user_id, "date": today}
        },
        upsert=True,
        return_document=True
    )
    
    return result


async def record_game_result(user_id: str, game_type: str, points: int, eur: float, metadata: dict = None):
    """Record a game result for history and leaderboard"""
    await db.gaming_history.insert_one({
        "id": secrets.token_hex(8),
        "user_id": user_id,
        "game_type": game_type,
        "points_won": points,
        "eur_won": eur,
        "metadata": metadata or {},
        "created_at": datetime.now(timezone.utc).isoformat()
    })


# ══════════════════════════════════════════════════════════════════════════════
# PROFILE & STATS
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/profile")
async def get_gaming_profile(request: Request):
    """Get user's gaming profile with points, daily stats, and spins remaining"""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    # Get total lifetime points
    total_points_result = await db.gaming_history.aggregate([
        {"$match": {"user_id": user_id}},
        {"$group": {"_id": None, "total": {"$sum": "$points_won"}}}
    ]).to_list(1)
    
    total_points = total_points_result[0]["total"] if total_points_result else 0
    
    # Get daily stats
    daily_stats = await get_user_daily_stats(user_id)
    
    # Calculate remaining spins
    spins_remaining = max(0, MAX_DAILY_SPINS - daily_stats.get("wheel_spins_used", 0))
    
    return {
        "points": total_points,
        "total_eur_won": round(total_points * POINTS_TO_EUR_RATE, 2),
        "daily_spins_remaining": spins_remaining,
        "daily_limit_remaining": round(MAX_DAILY_WINS_EUR - daily_stats.get("total_eur_won", 0), 2),
        "games_played_today": daily_stats.get("games_played", 0),
    }


@router.get("/leaderboard")
async def get_leaderboard(request: Request, period: str = "all"):
    """Get gaming leaderboard - top players by points"""
    
    match_stage = {}
    if period == "today":
        today = datetime.now(timezone.utc).isoformat()[:10]
        match_stage = {"created_at": {"$regex": f"^{today}"}}
    elif period == "week":
        week_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
        match_stage = {"created_at": {"$gte": week_ago}}
    
    pipeline = [
        {"$match": match_stage} if match_stage else {"$match": {}},
        {"$group": {
            "_id": "$user_id",
            "total_points": {"$sum": "$points_won"},
            "games_played": {"$sum": 1}
        }},
        {"$sort": {"total_points": -1}},
        {"$limit": 20}
    ]
    
    results = await db.gaming_history.aggregate(pipeline).to_list(20)
    
    # Enrich with user names
    leaderboard = []
    for i, entry in enumerate(results):
        user = await db.users.find_one({"_id": ObjectId(entry["_id"])}, {"name": 1, "email": 1})
        if user:
            leaderboard.append({
                "rank": i + 1,
                "name": user.get("name", user.get("email", "Unknown")[:15]),
                "points": entry["total_points"],
                "games": entry["games_played"],
                "emoji": ["👑", "🥈", "🥉"][i] if i < 3 else "🎮"
            })
    
    return {"leaderboard": leaderboard, "period": period}


# ══════════════════════════════════════════════════════════════════════════════
# WHEEL OF FORTUNE (Glücksrad)
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/wheel/spin")
async def wheel_spin(req: GameWinRequest, request: Request):
    """Process wheel spin - validates and credits wallet"""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    # Check daily spin limit
    daily_stats = await get_user_daily_stats(user_id)
    if daily_stats.get("wheel_spins_used", 0) >= MAX_DAILY_SPINS:
        raise HTTPException(status_code=400, detail="Tägliches Drehungen-Limit erreicht. Komm morgen wieder!")
    
    # Validate points (max wheel win is 2500)
    points = min(req.points_won, 2500)
    if points < 0:
        points = 0
    
    # Check daily EUR limit
    eur_amount = points_to_eur(points)
    if daily_stats.get("total_eur_won", 0) + eur_amount > MAX_DAILY_WINS_EUR:
        eur_amount = max(0, MAX_DAILY_WINS_EUR - daily_stats.get("total_eur_won", 0))
        points = int(eur_amount / POINTS_TO_EUR_RATE)
    
    # Credit wallet if there's a win
    if eur_amount > 0:
        result = await credit_wallet(
            user_id=user_id,
            amount=eur_amount,
            tx_type=TransactionType.REWARD,
            description=f"Glücksrad Gewinn: {points} Punkte",
            metadata={"game": "wheel", "points": points}
        )
        
        if not result.success:
            raise HTTPException(status_code=500, detail="Wallet-Gutschrift fehlgeschlagen")
    
    # Update stats
    await update_daily_stats(user_id, points, eur_amount, "wheel")
    await record_game_result(user_id, "wheel", points, eur_amount)
    
    return {
        "success": True,
        "points_won": points,
        "eur_won": eur_amount,
        "message": f"+{points} Punkte = €{eur_amount:.2f} auf dein Wallet!"
    }


# ══════════════════════════════════════════════════════════════════════════════
# SCRATCH CARDS (Rubbellose)
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/scratch/win")
async def scratch_win(req: GameWinRequest, request: Request):
    """Process scratch card win"""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    # Validate points (max scratch win is 500)
    points = min(req.points_won, 500)
    if points <= 0:
        return {"success": True, "points_won": 0, "eur_won": 0, "message": "Leider kein Gewinn"}
    
    # Check daily EUR limit
    daily_stats = await get_user_daily_stats(user_id)
    eur_amount = points_to_eur(points)
    
    if daily_stats.get("total_eur_won", 0) + eur_amount > MAX_DAILY_WINS_EUR:
        eur_amount = max(0, MAX_DAILY_WINS_EUR - daily_stats.get("total_eur_won", 0))
        points = int(eur_amount / POINTS_TO_EUR_RATE)
    
    if eur_amount > 0:
        result = await credit_wallet(
            user_id=user_id,
            amount=eur_amount,
            tx_type=TransactionType.REWARD,
            description=f"Rubbellos Gewinn: {points} Punkte",
            metadata={"game": "scratch", "points": points}
        )
        
        if not result.success:
            raise HTTPException(status_code=500, detail="Wallet-Gutschrift fehlgeschlagen")
    
    await update_daily_stats(user_id, points, eur_amount, "scratch")
    await record_game_result(user_id, "scratch", points, eur_amount)
    
    return {
        "success": True,
        "points_won": points,
        "eur_won": eur_amount,
        "message": f"+{points} Punkte = €{eur_amount:.2f}!"
    }


# ══════════════════════════════════════════════════════════════════════════════
# SLOTS (Spielautomat)
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/slots/win")
async def slots_win(req: GameWinRequest, request: Request):
    """Process slots win"""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    # Validate points (max slots win is 1000)
    points = min(req.points_won, 1000)
    if points <= 0:
        return {"success": True, "points_won": 0, "eur_won": 0, "message": "Kein Gewinn"}
    
    daily_stats = await get_user_daily_stats(user_id)
    eur_amount = points_to_eur(points)
    
    if daily_stats.get("total_eur_won", 0) + eur_amount > MAX_DAILY_WINS_EUR:
        eur_amount = max(0, MAX_DAILY_WINS_EUR - daily_stats.get("total_eur_won", 0))
        points = int(eur_amount / POINTS_TO_EUR_RATE)
    
    if eur_amount > 0:
        result = await credit_wallet(
            user_id=user_id,
            amount=eur_amount,
            tx_type=TransactionType.REWARD,
            description=f"Slots Jackpot: {points} Punkte",
            metadata={"game": "slots", "points": points}
        )
        
        if not result.success:
            raise HTTPException(status_code=500, detail="Wallet-Gutschrift fehlgeschlagen")
    
    await update_daily_stats(user_id, points, eur_amount, "slots")
    await record_game_result(user_id, "slots", points, eur_amount)
    
    return {
        "success": True,
        "points_won": points,
        "eur_won": eur_amount,
        "message": f"JACKPOT! +{points} Punkte = €{eur_amount:.2f}!"
    }


# ══════════════════════════════════════════════════════════════════════════════
# QUIZ
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/quiz/complete")
async def quiz_complete(req: GameWinRequest, request: Request):
    """Process quiz completion"""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    # Validate points (max quiz win is 100 - 5 questions x 20 points)
    points = min(req.points_won, 100)
    if points <= 0:
        return {"success": True, "points_won": 0, "eur_won": 0, "message": "Quiz beendet ohne Punkte"}
    
    daily_stats = await get_user_daily_stats(user_id)
    eur_amount = points_to_eur(points)
    
    if daily_stats.get("total_eur_won", 0) + eur_amount > MAX_DAILY_WINS_EUR:
        eur_amount = max(0, MAX_DAILY_WINS_EUR - daily_stats.get("total_eur_won", 0))
        points = int(eur_amount / POINTS_TO_EUR_RATE)
    
    if eur_amount > 0:
        result = await credit_wallet(
            user_id=user_id,
            amount=eur_amount,
            tx_type=TransactionType.REWARD,
            description=f"Quiz Gewinn: {points} Punkte",
            metadata={"game": "quiz", "points": points}
        )
        
        if not result.success:
            raise HTTPException(status_code=500, detail="Wallet-Gutschrift fehlgeschlagen")
    
    await update_daily_stats(user_id, points, eur_amount, "quiz")
    await record_game_result(user_id, "quiz", points, eur_amount)
    
    return {
        "success": True,
        "points_won": points,
        "eur_won": eur_amount,
        "message": f"Quiz abgeschlossen! +{points} Punkte = €{eur_amount:.2f}!"
    }


# ══════════════════════════════════════════════════════════════════════════════
# MEMORY
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/memory/complete")
async def memory_complete(req: GameWinRequest, request: Request):
    """Process memory game completion - points based on moves"""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    # Validate points (formula: max(10, 100 - moves*2))
    points = min(req.points_won, 100)
    if points <= 0:
        points = 10  # Minimum reward for completing
    
    daily_stats = await get_user_daily_stats(user_id)
    eur_amount = points_to_eur(points)
    
    if daily_stats.get("total_eur_won", 0) + eur_amount > MAX_DAILY_WINS_EUR:
        eur_amount = max(0, MAX_DAILY_WINS_EUR - daily_stats.get("total_eur_won", 0))
        points = int(eur_amount / POINTS_TO_EUR_RATE)
    
    if eur_amount > 0:
        result = await credit_wallet(
            user_id=user_id,
            amount=eur_amount,
            tx_type=TransactionType.REWARD,
            description=f"Memory Gewinn: {points} Punkte",
            metadata={"game": "memory", "points": points, "moves": req.moves}
        )
        
        if not result.success:
            raise HTTPException(status_code=500, detail="Wallet-Gutschrift fehlgeschlagen")
    
    await update_daily_stats(user_id, points, eur_amount, "memory")
    await record_game_result(user_id, "memory", points, eur_amount, {"moves": req.moves})
    
    return {
        "success": True,
        "points_won": points,
        "eur_won": eur_amount,
        "message": f"Memory geschafft! +{points} Punkte = €{eur_amount:.2f}!"
    }


# ══════════════════════════════════════════════════════════════════════════════
# DICE (Würfelglück)
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/dice/win")
async def dice_win(req: GameWinRequest, request: Request):
    """Process dice game win"""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    # Validate points (max dice win is 60 = 10 base * 6x multiplier for doubles)
    points = min(req.points_won, 60)
    if points <= 0:
        return {"success": True, "points_won": 0, "eur_won": 0, "message": "Leider verloren"}
    
    daily_stats = await get_user_daily_stats(user_id)
    eur_amount = points_to_eur(points)
    
    if daily_stats.get("total_eur_won", 0) + eur_amount > MAX_DAILY_WINS_EUR:
        eur_amount = max(0, MAX_DAILY_WINS_EUR - daily_stats.get("total_eur_won", 0))
        points = int(eur_amount / POINTS_TO_EUR_RATE)
    
    if eur_amount > 0:
        result = await credit_wallet(
            user_id=user_id,
            amount=eur_amount,
            tx_type=TransactionType.REWARD,
            description=f"Würfelglück Gewinn: {points} Punkte",
            metadata={"game": "dice", "points": points}
        )
        
        if not result.success:
            raise HTTPException(status_code=500, detail="Wallet-Gutschrift fehlgeschlagen")
    
    await update_daily_stats(user_id, points, eur_amount, "dice")
    await record_game_result(user_id, "dice", points, eur_amount)
    
    return {
        "success": True,
        "points_won": points,
        "eur_won": eur_amount,
        "message": f"Gewonnen! +{points} Punkte = €{eur_amount:.2f}!"
    }


# ══════════════════════════════════════════════════════════════════════════════
# REDEEM POINTS TO EUR
# ══════════════════════════════════════════════════════════════════════════════

class RedeemRequest(BaseModel):
    points: int


@router.post("/redeem")
async def redeem_points(req: RedeemRequest, request: Request):
    """Redeem accumulated points for EUR wallet credit"""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    if req.points < 500:
        raise HTTPException(status_code=400, detail="Mindestens 500 Punkte zum Einlösen erforderlich")
    
    # Get user's total points
    total_result = await db.gaming_history.aggregate([
        {"$match": {"user_id": user_id}},
        {"$group": {"_id": None, "total": {"$sum": "$points_won"}}}
    ]).to_list(1)
    
    total_points = total_result[0]["total"] if total_result else 0
    
    # Get already redeemed points
    redeemed_result = await db.gaming_redemptions.aggregate([
        {"$match": {"user_id": user_id}},
        {"$group": {"_id": None, "total": {"$sum": "$points_redeemed"}}}
    ]).to_list(1)
    
    redeemed_points = redeemed_result[0]["total"] if redeemed_result else 0
    available_points = total_points - redeemed_points
    
    if req.points > available_points:
        raise HTTPException(status_code=400, detail=f"Nicht genug Punkte. Verfügbar: {available_points}")
    
    eur_amount = points_to_eur(req.points)
    
    # Credit wallet
    result = await credit_wallet(
        user_id=user_id,
        amount=eur_amount,
        tx_type=TransactionType.REWARD,
        description=f"Punkte eingelöst: {req.points} Punkte",
        metadata={"type": "redemption", "points": req.points}
    )
    
    if not result.success:
        raise HTTPException(status_code=500, detail="Einlösung fehlgeschlagen")
    
    # Record redemption
    await db.gaming_redemptions.insert_one({
        "user_id": user_id,
        "points_redeemed": req.points,
        "eur_credited": eur_amount,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {
        "success": True,
        "points_redeemed": req.points,
        "eur_credited": eur_amount,
        "remaining_points": available_points - req.points,
        "message": f"{req.points} Punkte für €{eur_amount:.2f} eingelöst!"
    }
