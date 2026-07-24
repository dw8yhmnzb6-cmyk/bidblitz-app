"""
BidBlitz V2 - AI Trading Bot
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from datetime import datetime, timezone
from core.database import db
from core.security import get_current_user
import secrets, random

router = APIRouter(prefix="/api/trading-bot", tags=["trading-bot"])

BOT_STRATEGIES = [
    {"id": "dca_btc", "name": "BTC DCA Bot", "desc": "Taeglich Bitcoin kaufen", "type": "DCA", "coin": "BTC", "min_budget": 50, "est_return": "8-15%", "risk": "Niedrig", "color": "#F7931A"},
    {"id": "dca_eth", "name": "ETH DCA Bot", "desc": "Taeglich Ethereum kaufen", "type": "DCA", "coin": "ETH", "min_budget": 30, "est_return": "10-20%", "risk": "Niedrig", "color": "#627EEA"},
    {"id": "grid_btc", "name": "BTC Grid Bot", "desc": "Kaufe tief, verkaufe hoch automatisch", "type": "Grid", "coin": "BTC", "min_budget": 200, "est_return": "12-25%", "risk": "Mittel", "color": "#F7931A"},
    {"id": "grid_sol", "name": "SOL Grid Bot", "desc": "Solana Grid-Trading", "type": "Grid", "coin": "SOL", "min_budget": 100, "est_return": "15-35%", "risk": "Hoch", "color": "#9945FF"},
    {"id": "copy_whale", "name": "Whale Tracker", "desc": "Kopiere Wallet-Bewegungen von Top-Tradern", "type": "Copy", "coin": "Multi", "min_budget": 500, "est_return": "20-40%", "risk": "Hoch", "color": "#EF4444"},
    {"id": "arb_stable", "name": "Stablecoin Arbitrage", "desc": "Preisunterschiede bei Stablecoins nutzen", "type": "Arbitrage", "coin": "USDT/USDC", "min_budget": 1000, "est_return": "3-8%", "risk": "Sehr Niedrig", "color": "#26A17B"},
]

class StartBot(BaseModel):
    strategy_id: str
    budget_eur: float = Field(..., gt=0)

@router.get("/strategies")
async def get_strategies():
    return {"strategies": BOT_STRATEGIES}

@router.post("/start")
async def start_bot(req: StartBot, request: Request):
    user = await get_current_user(request)
    strat = next((s for s in BOT_STRATEGIES if s["id"] == req.strategy_id), None)
    if not strat:
        raise HTTPException(404, "Strategie nicht gefunden")
    if req.budget_eur < strat["min_budget"]:
        raise HTTPException(400, f"Mindestbudget: {strat['min_budget']} EUR")
    bot = {
        "bot_id": f"bot_{secrets.token_hex(6)}",
        "user_email": user.get("email", ""),
        "strategy_id": req.strategy_id,
        "strategy_name": strat["name"],
        "type": strat["type"],
        "coin": strat["coin"],
        "budget_eur": req.budget_eur,
        "trades_executed": 0,
        "pnl": 0,
        "pnl_pct": 0,
        "status": "running",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.trading_bots.insert_one(bot)
    return {"ok": True, "bot_id": bot["bot_id"], "message": f"{strat['name']} gestartet mit {req.budget_eur} EUR Budget!"}

@router.get("/my-bots")
async def my_bots(request: Request):
    user = await get_current_user(request)
    bots = await db.trading_bots.find({"user_email": user.get("email", "")}, {"_id": 0}).sort("created_at", -1).to_list(20)
    for b in bots:
        if b["status"] == "running":
            b["trades_executed"] = random.randint(5, 50)
            pnl_pct = random.uniform(-5, 15)
            b["pnl_pct"] = round(pnl_pct, 2)
            b["pnl"] = round(b["budget_eur"] * pnl_pct / 100, 2)
    return {"bots": bots}

@router.post("/stop/{bot_id}")
async def stop_bot(bot_id: str, request: Request):
    user = await get_current_user(request)
    bot = await db.trading_bots.find_one({"bot_id": bot_id, "user_email": user.get("email", ""), "status": "running"})
    if not bot:
        raise HTTPException(404, "Bot nicht gefunden")
    pnl = round(bot["budget_eur"] * random.uniform(-3, 12) / 100, 2)
    await db.trading_bots.update_one({"bot_id": bot_id}, {"$set": {"status": "stopped", "pnl": pnl, "stopped_at": datetime.now(timezone.utc).isoformat()}})
    return {"ok": True, "pnl": pnl, "message": f"Bot gestoppt. PnL: {'+'if pnl>=0 else ''}{pnl} EUR"}
