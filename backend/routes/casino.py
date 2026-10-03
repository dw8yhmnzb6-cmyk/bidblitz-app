"""
BidBlitz Casino — BLZ-basierte Social-Casino Games
Rechtlich: BLZ ist In-App-Token, kein Glücksspiel mit Fiat = Social Casino.
"""
import random
import logging
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from bson import ObjectId

from core.database import db
from core.config import TEST_MODE
from core.security import get_current_user

logger = logging.getLogger("bidblitz.casino")
router = APIRouter(prefix="/api/casino", tags=["casino"])

MIN_BET = 1.0   # 1 BLZ
MAX_BET = 500.0 # 500 BLZ pro Spin
HOUSE_EDGE = 0.04


def _require_value_game_test_mode() -> None:
    if not TEST_MODE:
        raise HTTPException(
            status_code=503,
            detail="Wertbasierte Casino-Spiele sind in Production deaktiviert.",
        )


def _oid(s):
    try:
        return ObjectId(s)
    except Exception:
        return s


async def _get_blz_balance(uid: str) -> float:
    user = await db.users.find_one({"_id": _oid(uid)}, {"balance_blz": 1})
    return float((user or {}).get("balance_blz", 0) or 0)


async def _settle_blz_game(uid: str, *, bet: float, payout: float, description: str, ref_prefix: str) -> float:
    """Atomically settle one BLZ game without allowing concurrent over-spend."""
    bet = round(float(bet), 2)
    payout = round(float(payout), 2)
    net = round(payout - bet, 2)
    result = await db.users.update_one(
        {"_id": _oid(uid), "balance_blz": {"$gte": bet}},
        {"$inc": {"balance_blz": net}},
    )
    if result.modified_count != 1:
        raise HTTPException(status_code=400, detail="Nicht genug BLZ")

    now = datetime.now(timezone.utc)
    await db.transactions.insert_one({
        "user_id": uid,
        "type": "game",
        "amount": bet,
        "payout_amount": payout,
        "net_amount": net,
        "currency": "BLZ",
        "status": "completed",
        "description": description,
        "merchant_name": "BidBlitz Casino",
        "category": "casino",
        "reference": f"{ref_prefix}-{now.strftime('%Y%m%d%H%M%S%f')[:18]}",
        "date": now.isoformat(),
        "created_at": now.isoformat(),
    })
    return await _get_blz_balance(uid)


# ═══ SLOTS ═══
SLOT_SYMBOLS = [
    {"id": "cherry", "icon": "🍒", "weight": 30, "payout": 2},
    {"id": "lemon",  "icon": "🍋", "weight": 25, "payout": 3},
    {"id": "grape",  "icon": "🍇", "weight": 20, "payout": 5},
    {"id": "bell",   "icon": "🔔", "weight": 15, "payout": 10},
    {"id": "star",   "icon": "⭐", "weight": 7, "payout": 25},
    {"id": "seven",  "icon": "7️⃣", "weight": 2, "payout": 100},
    {"id": "jackpot","icon": "💎", "weight": 1, "payout": 500},
]


def _spin_reel() -> dict:
    total_w = sum(s["weight"] for s in SLOT_SYMBOLS)
    r = random.uniform(0, total_w)
    cum = 0
    for s in SLOT_SYMBOLS:
        cum += s["weight"]
        if r <= cum:
            return s
    return SLOT_SYMBOLS[0]


class SpinRequest(BaseModel):
    bet: float = Field(gt=0)


@router.post("/slots/spin")
async def slots_spin(req: SpinRequest, request: Request):
    _require_value_game_test_mode()
    user = await get_current_user(request)
    uid = str(user.get("_id") or user.get("id"))
    if req.bet < MIN_BET or req.bet > MAX_BET:
        raise HTTPException(400, f"Einsatz muss zwischen {MIN_BET} und {MAX_BET} BLZ liegen")
    reels = [_spin_reel() for _ in range(3)]
    # Check win: 3-of-a-kind
    payout = 0.0
    win_type = None
    if reels[0]["id"] == reels[1]["id"] == reels[2]["id"]:
        payout = req.bet * reels[0]["payout"]
        win_type = "three_kind"
    elif reels[0]["id"] == reels[1]["id"] or reels[1]["id"] == reels[2]["id"]:
        # 2-of-a-kind on adjacent = small win
        payout = req.bet * 1.5
        win_type = "two_kind"

    # Apply house edge scaling (slight reduction on payouts except jackpot)
    if win_type and reels[0]["id"] != "jackpot":
        payout = round(payout * (1 - HOUSE_EDGE), 2)

    net = round(payout - req.bet, 2)
    new_bal = await _settle_blz_game(
        uid,
        bet=req.bet,
        payout=payout,
        description=f"Slots: {req.bet} BLZ Einsatz, {payout} BLZ Gewinn",
        ref_prefix="SLOTS",
    )
    return {
        "reels": [{"icon": r["icon"], "id": r["id"]} for r in reels],
        "bet": req.bet,
        "payout": payout,
        "net": net,
        "win_type": win_type,
        "new_balance": round(new_bal, 2),
    }


# ═══ CRASH ═══
class CrashBetRequest(BaseModel):
    bet: float = Field(gt=0)
    cashout_multiplier: float = Field(gt=1.0, le=100.0, description="Auto-cashout bei Multiplikator")


@router.post("/crash/play")
async def crash_play(req: CrashBetRequest, request: Request):
    _require_value_game_test_mode()
    """Crash: User wählt Ziel-Multiplier. Wenn crashed davor, verloren. Sonst gewonnen."""
    user = await get_current_user(request)
    uid = str(user.get("_id") or user.get("id"))
    if req.bet < MIN_BET or req.bet > MAX_BET:
        raise HTTPException(400, f"Einsatz {MIN_BET}-{MAX_BET} BLZ")
    # Generate crash point: exponential distribution with house edge
    # 3% instant crash (house edge), else crash_point = 1 / random(0, 0.97)
    r = random.random()
    if r < HOUSE_EDGE:
        crash_point = 1.0
    else:
        crash_point = round(0.97 / (1 - r), 2)
        crash_point = min(crash_point, 100.0)

    won = crash_point >= req.cashout_multiplier
    payout = round(req.bet * req.cashout_multiplier, 2) if won else 0.0
    net = round(payout - req.bet, 2)
    new_bal = await _settle_blz_game(
        uid,
        bet=req.bet,
        payout=payout,
        description=f"Crash: {req.cashout_multiplier}x, crashed@{crash_point}x",
        ref_prefix="CRASH",
    )
    return {
        "bet": req.bet,
        "cashout_multiplier": req.cashout_multiplier,
        "crash_point": crash_point,
        "won": won,
        "payout": payout,
        "net": net,
        "new_balance": round(new_bal, 2),
    }


# ═══ PLINKO ═══
# 9 rows, 10 slots, payouts inspired by Stake
PLINKO_PAYOUTS = [8.0, 3.0, 1.4, 1.1, 1.0, 0.5, 1.0, 1.1, 1.4, 3.0, 8.0]


class PlinkoBetRequest(BaseModel):
    bet: float = Field(gt=0)


@router.post("/plinko/drop")
async def plinko_drop(req: PlinkoBetRequest, request: Request):
    _require_value_game_test_mode()
    """Plinko: Kugel fällt durch 9 Reihen, landet in einem von 11 Slots."""
    user = await get_current_user(request)
    uid = str(user.get("_id") or user.get("id"))
    if req.bet < MIN_BET or req.bet > MAX_BET:
        raise HTTPException(400, f"Einsatz {MIN_BET}-{MAX_BET} BLZ")
    # Simulate 9 bounces, each left/right. Final position determines slot.
    path = [random.choice([-1, 1]) for _ in range(9)]
    right_count = sum(1 for p in path if p == 1)
    # right_count 0-9 → slot 0-10 (binomial distribution)
    # Apply small house edge via shifted distribution
    slot_index = right_count + random.choice([0, 0, 0, 0, 0, 0, 0, 0, 0, -1 if right_count > 0 else 0])
    slot_index = max(0, min(10, slot_index))

    multiplier = PLINKO_PAYOUTS[slot_index]
    # Apply house edge on big wins
    if multiplier > 1.0:
        multiplier = round(multiplier * (1 - HOUSE_EDGE), 2)
    payout = round(req.bet * multiplier, 2)
    net = round(payout - req.bet, 2)
    new_bal = await _settle_blz_game(
        uid,
        bet=req.bet,
        payout=payout,
        description=f"Plinko: {multiplier}x Multiplikator",
        ref_prefix="PLINKO",
    )
    return {
        "bet": req.bet,
        "path": path,
        "slot_index": slot_index,
        "multiplier": multiplier,
        "payout": payout,
        "net": net,
        "new_balance": round(new_bal, 2),
    }


@router.get("/slots/symbols")
async def slots_symbols():
    return {
        "symbols": SLOT_SYMBOLS if TEST_MODE else [],
        "min_bet": MIN_BET,
        "max_bet": MAX_BET,
        "wagering_enabled": bool(TEST_MODE),
    }


@router.get("/plinko/config")
async def plinko_config():
    return {
        "payouts": PLINKO_PAYOUTS if TEST_MODE else [],
        "min_bet": MIN_BET,
        "max_bet": MAX_BET,
        "wagering_enabled": bool(TEST_MODE),
    }


@router.get("/history")
async def casino_history(request: Request, limit: int = 20):
    user = await get_current_user(request)
    uid = str(user.get("_id") or user.get("id"))
    cursor = db.transactions.find(
        {"user_id": uid, "category": "casino"},
        {"_id": 0}
    ).sort("created_at", -1).limit(limit)
    txs = await cursor.to_list(length=limit)
    return {"history": txs}


@router.get("/balance")
async def casino_balance(request: Request):
    user = await get_current_user(request)
    uid = str(user.get("_id") or user.get("id"))
    return {"blz_balance": await _get_blz_balance(uid)}
