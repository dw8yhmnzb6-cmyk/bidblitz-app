"""
BidBlitz V2 - Prediction Markets (Bet on Events)
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from datetime import datetime, timezone
from core.database import db
from core.security import get_current_user
import secrets

router = APIRouter(prefix="/api/predictions", tags=["predictions"])

MARKETS = [
    {"id": "btc_80k", "title": "Bitcoin ueber 80.000 EUR bis Ende 2026?", "category": "Crypto", "yes_odds": 1.65, "no_odds": 2.30, "volume": 45200, "ends": "2026-12-31", "color": "#F7931A"},
    {"id": "eth_5k", "title": "Ethereum ueber 5.000 EUR bis Q3 2026?", "category": "Crypto", "yes_odds": 2.10, "no_odds": 1.75, "volume": 32100, "ends": "2026-09-30", "color": "#627EEA"},
    {"id": "trump_2028", "title": "Republikanischer Praesident 2028?", "category": "Politik", "yes_odds": 1.85, "no_odds": 2.00, "volume": 128500, "ends": "2028-11-05", "color": "#EF4444"},
    {"id": "fcb_cl", "title": "FC Bayern gewinnt Champions League 2026?", "category": "Sport", "yes_odds": 4.50, "no_odds": 1.22, "volume": 67800, "ends": "2026-06-01", "color": "#DC2626"},
    {"id": "ai_agi", "title": "AGI erreicht bis 2027?", "category": "Technologie", "yes_odds": 3.20, "no_odds": 1.35, "volume": 89400, "ends": "2027-12-31", "color": "#8B5CF6"},
    {"id": "tesla_300", "title": "Tesla Aktie ueber 300 USD bis Sommer 2026?", "category": "Aktien", "yes_odds": 1.90, "no_odds": 1.95, "volume": 54300, "ends": "2026-08-31", "color": "#EF4444"},
    {"id": "sol_flip", "title": "Solana ueberholt Ethereum (Marktkapitalisierung)?", "category": "Crypto", "yes_odds": 5.00, "no_odds": 1.18, "volume": 23400, "ends": "2026-12-31", "color": "#9945FF"},
    {"id": "euro2028", "title": "Deutschland gewinnt EM 2028?", "category": "Sport", "yes_odds": 6.00, "no_odds": 1.15, "volume": 98700, "ends": "2028-07-15", "color": "#FBBF24"},
]


class PlaceBet(BaseModel):
    market_id: str
    side: str  # yes / no
    amount_eur: float = Field(..., gt=0, le=5000)


@router.get("/markets")
async def get_markets():
    return {"markets": MARKETS}


@router.post("/bet")
async def place_bet(req: PlaceBet, request: Request):
    user = await get_current_user(request)
    market = next((m for m in MARKETS if m["id"] == req.market_id), None)
    if not market:
        raise HTTPException(404, "Markt nicht gefunden")
    if req.side not in ["yes", "no"]:
        raise HTTPException(400, "Seite muss 'yes' oder 'no' sein")
    odds = market["yes_odds"] if req.side == "yes" else market["no_odds"]
    potential = round(req.amount_eur * odds, 2)
    bet = {
        "bet_id": f"pred_{secrets.token_hex(6)}",
        "user_email": user.get("email", ""),
        "market_id": req.market_id,
        "market_title": market["title"],
        "side": req.side,
        "amount_eur": req.amount_eur,
        "odds": odds,
        "potential_win": potential,
        "status": "open",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.prediction_bets.insert_one(bet)
    return {"ok": True, "bet_id": bet["bet_id"], "odds": odds, "potential_win": potential,
            "message": f"Wette platziert: {req.amount_eur} EUR auf {'JA' if req.side=='yes' else 'NEIN'} (Quote {odds})"}


@router.get("/my-bets")
async def my_bets(request: Request):
    user = await get_current_user(request)
    bets = await db.prediction_bets.find(
        {"user_email": user.get("email", "")}, {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    return {"bets": bets, "count": len(bets)}
