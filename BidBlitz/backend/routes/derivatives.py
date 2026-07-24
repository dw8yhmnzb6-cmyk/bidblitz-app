"""
BidBlitz V2 - Crypto Derivatives (Futures & Options)
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from datetime import datetime, timezone
from core.database import db
from core.security import get_current_user
import secrets, random

router = APIRouter(prefix="/api/derivatives", tags=["derivatives"])

PAIRS = [
    {"pair": "BTC/EUR", "price": 68450.00, "change_24h": 2.3, "funding_rate": 0.01},
    {"pair": "ETH/EUR", "price": 3280.50, "change_24h": -1.1, "funding_rate": 0.008},
    {"pair": "SOL/EUR", "price": 142.80, "change_24h": 5.7, "funding_rate": 0.015},
    {"pair": "XRP/EUR", "price": 0.58, "change_24h": -0.8, "funding_rate": 0.005},
    {"pair": "DOGE/EUR", "price": 0.089, "change_24h": 3.2, "funding_rate": 0.02},
    {"pair": "ADA/EUR", "price": 0.42, "change_24h": 1.9, "funding_rate": 0.007},
]


class OpenPosition(BaseModel):
    pair: str
    direction: str  # long / short
    leverage: int = Field(..., ge=1, le=100)
    margin_eur: float = Field(..., gt=0, le=50000)
    take_profit: float = 0
    stop_loss: float = 0


@router.get("/pairs")
async def get_pairs():
    updated = []
    for p in PAIRS:
        p_copy = dict(p)
        p_copy["price"] = round(p["price"] * (1 + random.uniform(-0.002, 0.002)), 2)
        updated.append(p_copy)
    return {"pairs": updated}


@router.post("/open")
async def open_position(req: OpenPosition, request: Request):
    user = await get_current_user(request)
    pair_data = next((p for p in PAIRS if p["pair"] == req.pair), None)
    if not pair_data:
        raise HTTPException(404, "Paar nicht gefunden")
    if req.direction not in ["long", "short"]:
        raise HTTPException(400, "Richtung muss 'long' oder 'short' sein")
    position = {
        "position_id": f"deriv_{secrets.token_hex(6)}",
        "user_email": user.get("email", ""),
        "pair": req.pair,
        "direction": req.direction,
        "leverage": req.leverage,
        "margin_eur": req.margin_eur,
        "size_eur": round(req.margin_eur * req.leverage, 2),
        "entry_price": pair_data["price"],
        "take_profit": req.take_profit,
        "stop_loss": req.stop_loss,
        "pnl": 0,
        "status": "open",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.derivatives_positions.insert_one(position)
    return {"ok": True, "position_id": position["position_id"], "entry_price": pair_data["price"],
            "message": f"{req.direction.upper()} {req.pair} x{req.leverage} eroeffnet!"}


@router.get("/positions")
async def my_positions(request: Request):
    user = await get_current_user(request)
    positions = await db.derivatives_positions.find(
        {"user_email": user.get("email", "")}, {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    for p in positions:
        pair_data = next((pr for pr in PAIRS if pr["pair"] == p["pair"]), None)
        if pair_data and p["status"] == "open":
            current = pair_data["price"] * (1 + random.uniform(-0.01, 0.01))
            diff = (current - p["entry_price"]) / p["entry_price"]
            if p["direction"] == "short":
                diff = -diff
            p["pnl"] = round(p["margin_eur"] * p["leverage"] * diff, 2)
            p["current_price"] = round(current, 2)
    return {"positions": positions}


@router.post("/close/{position_id}")
async def close_position(position_id: str, request: Request):
    user = await get_current_user(request)
    pos = await db.derivatives_positions.find_one({"position_id": position_id, "user_email": user.get("email", ""), "status": "open"})
    if not pos:
        raise HTTPException(404, "Position nicht gefunden")
    pair_data = next((p for p in PAIRS if p["pair"] == pos["pair"]), None)
    close_price = pair_data["price"] if pair_data else pos["entry_price"]
    diff = (close_price - pos["entry_price"]) / pos["entry_price"]
    if pos["direction"] == "short":
        diff = -diff
    pnl = round(pos["margin_eur"] * pos["leverage"] * diff, 2)
    await db.derivatives_positions.update_one({"position_id": position_id}, {"$set": {
        "status": "closed", "close_price": close_price, "pnl": pnl, "closed_at": datetime.now(timezone.utc).isoformat()
    }})
    return {"ok": True, "pnl": pnl, "close_price": close_price, "message": f"Position geschlossen: {'+'if pnl>=0 else ''}{pnl} EUR"}
