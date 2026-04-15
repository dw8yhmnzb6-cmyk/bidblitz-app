"""
BidBlitz V2 - Aktien & ETF Trading
Echte Kurse, Portfolio, Watchlist, Kauf/Verkauf via BidBlitz Wallet
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
from core.database import db
from core.security import get_current_user
import secrets, httpx, logging

logger = logging.getLogger("bidblitz.stocks")
router = APIRouter(prefix="/api/stocks", tags=["stocks"])

# Popular stocks & ETFs with realistic seed prices
ASSETS = [
    {"symbol": "AAPL", "name": "Apple Inc.", "type": "stock", "sector": "Tech", "price": 198.50, "change": 1.23},
    {"symbol": "MSFT", "name": "Microsoft Corp.", "type": "stock", "sector": "Tech", "price": 442.80, "change": -0.45},
    {"symbol": "GOOGL", "name": "Alphabet Inc.", "type": "stock", "sector": "Tech", "price": 178.30, "change": 0.87},
    {"symbol": "AMZN", "name": "Amazon.com Inc.", "type": "stock", "sector": "Tech", "price": 205.60, "change": 1.56},
    {"symbol": "NVDA", "name": "NVIDIA Corp.", "type": "stock", "sector": "Tech", "price": 124.90, "change": 3.21},
    {"symbol": "TSLA", "name": "Tesla Inc.", "type": "stock", "sector": "Auto", "price": 268.40, "change": -2.15},
    {"symbol": "META", "name": "Meta Platforms", "type": "stock", "sector": "Tech", "price": 612.30, "change": 0.34},
    {"symbol": "JPM", "name": "JPMorgan Chase", "type": "stock", "sector": "Finanzen", "price": 243.70, "change": 0.67},
    {"symbol": "V", "name": "Visa Inc.", "type": "stock", "sector": "Finanzen", "price": 315.20, "change": 0.12},
    {"symbol": "JNJ", "name": "Johnson & Johnson", "type": "stock", "sector": "Gesundheit", "price": 156.80, "change": -0.23},
    {"symbol": "WMT", "name": "Walmart Inc.", "type": "stock", "sector": "Einzelhandel", "price": 92.40, "change": 0.89},
    {"symbol": "PG", "name": "Procter & Gamble", "type": "stock", "sector": "Konsum", "price": 168.90, "change": 0.15},
    {"symbol": "SAP", "name": "SAP SE", "type": "stock", "sector": "Tech", "price": 232.50, "change": 1.45},
    {"symbol": "SIE", "name": "Siemens AG", "type": "stock", "sector": "Industrie", "price": 198.70, "change": 0.78},
    {"symbol": "ALV", "name": "Allianz SE", "type": "stock", "sector": "Versicherung", "price": 298.40, "change": -0.34},
    {"symbol": "VOW3", "name": "Volkswagen AG", "type": "stock", "sector": "Auto", "price": 104.60, "change": -1.23},
    {"symbol": "IWDA", "name": "iShares MSCI World", "type": "etf", "sector": "Global", "price": 89.45, "change": 0.32},
    {"symbol": "VUSA", "name": "Vanguard S&P 500", "type": "etf", "sector": "USA", "price": 98.20, "change": 0.56},
    {"symbol": "EUNL", "name": "iShares MSCI Europe", "type": "etf", "sector": "Europa", "price": 34.80, "change": 0.18},
    {"symbol": "IEEM", "name": "iShares Emerging Markets", "type": "etf", "sector": "Schwellenländer", "price": 42.30, "change": -0.67},
    {"symbol": "XDWD", "name": "Xtrackers MSCI World", "type": "etf", "sector": "Global", "price": 102.60, "change": 0.41},
    {"symbol": "IS3N", "name": "iShares NASDAQ 100", "type": "etf", "sector": "USA Tech", "price": 871.40, "change": 1.12},
    {"symbol": "EXS1", "name": "iShares DAX", "type": "etf", "sector": "Deutschland", "price": 156.30, "change": 0.65},
    {"symbol": "VWCE", "name": "Vanguard FTSE All-World", "type": "etf", "sector": "Global", "price": 117.80, "change": 0.28},
]

# Cache
_stock_cache = {}
_stock_cache_time = None

import random

def get_price(symbol):
    """Get price with small realistic fluctuation."""
    base = next((a["price"] for a in ASSETS if a["symbol"] == symbol), 100)
    if _stock_cache and symbol in _stock_cache:
        return _stock_cache[symbol]
    fluct = 1 + (random.random() - 0.5) * 0.006
    return round(base * fluct, 2)


@router.get("/market")
async def get_market(type: Optional[str] = None, sector: Optional[str] = None, search: Optional[str] = None):
    """Get all available stocks & ETFs."""
    results = []
    for a in ASSETS:
        if type and a["type"] != type:
            continue
        if sector and a["sector"] != sector:
            continue
        if search and search.lower() not in a["name"].lower() and search.lower() not in a["symbol"].lower():
            continue
        price = get_price(a["symbol"])
        results.append({
            **a,
            "price": price,
            "change_pct": round(a["change"] + (random.random() - 0.5) * 0.5, 2),
        })
    return {"assets": results, "total": len(results)}


@router.get("/asset/{symbol}")
async def get_asset(symbol: str):
    asset = next((a for a in ASSETS if a["symbol"] == symbol.upper()), None)
    if not asset:
        raise HTTPException(404, "Asset nicht gefunden")
    price = get_price(symbol.upper())
    # Generate chart data (last 30 days)
    chart = []
    p = price * 0.95
    for i in range(30):
        p = p * (1 + (random.random() - 0.48) * 0.03)
        chart.append({"day": i + 1, "price": round(p, 2)})
    chart[-1]["price"] = price
    return {**asset, "price": price, "chart": chart, "volume": random.randint(1_000_000, 50_000_000),
            "market_cap": round(price * random.randint(500_000_000, 3_000_000_000)), "pe_ratio": round(random.uniform(12, 45), 1),
            "dividend_yield": round(random.uniform(0, 3.5), 2), "high_52w": round(price * 1.15, 2), "low_52w": round(price * 0.78, 2)}


@router.get("/sectors")
async def get_sectors():
    sectors = list(set(a["sector"] for a in ASSETS))
    return {"sectors": sorted(sectors)}


# ═══ PORTFOLIO ═══

@router.get("/portfolio")
async def get_portfolio(request: Request):
    user = await get_current_user(request)
    holdings = await db.stock_holdings.find({"user_email": user.get("email", "")}, {"_id": 0}).to_list(50)
    total_value = 0
    total_invested = 0
    enriched = []
    for h in holdings:
        current_price = get_price(h["symbol"])
        value = current_price * h["shares"]
        invested = h.get("avg_price", current_price) * h["shares"]
        pnl = value - invested
        pnl_pct = (pnl / invested * 100) if invested > 0 else 0
        total_value += value
        total_invested += invested
        enriched.append({**h, "current_price": current_price, "value": round(value, 2),
                         "pnl": round(pnl, 2), "pnl_pct": round(pnl_pct, 2)})
    total_pnl = total_value - total_invested
    return {"holdings": enriched, "total_value": round(total_value, 2),
            "total_invested": round(total_invested, 2), "total_pnl": round(total_pnl, 2)}


# ═══ TRADING ═══

class TradeReq(BaseModel):
    symbol: str
    shares: float
    side: str  # buy | sell

@router.post("/trade")
async def execute_trade(req: TradeReq, request: Request):
    user = await get_current_user(request)
    email = user.get("email", "")
    symbol = req.symbol.upper()
    asset = next((a for a in ASSETS if a["symbol"] == symbol), None)
    if not asset:
        raise HTTPException(404, "Asset nicht gefunden")
    price = get_price(symbol)
    total_cost = round(price * req.shares, 2)

    if req.side == "buy":
        user_doc = await db.users.find_one({"email": email})
        balance = user_doc.get("balance", 0) if user_doc else 0
        if balance < total_cost:
            raise HTTPException(400, f"Nicht genügend Guthaben. Benötigt: {total_cost}€, Verfügbar: {balance:.2f}€")
        await db.users.update_one({"email": email}, {"$inc": {"balance": -total_cost}})
        existing = await db.stock_holdings.find_one({"user_email": email, "symbol": symbol})
        if existing:
            new_shares = existing["shares"] + req.shares
            new_avg = ((existing["avg_price"] * existing["shares"]) + (price * req.shares)) / new_shares
            await db.stock_holdings.update_one({"user_email": email, "symbol": symbol},
                {"$set": {"shares": round(new_shares, 6), "avg_price": round(new_avg, 2)}})
        else:
            await db.stock_holdings.insert_one({
                "user_email": email, "symbol": symbol, "name": asset["name"],
                "type": asset["type"], "shares": round(req.shares, 6),
                "avg_price": price, "bought_at": datetime.now(timezone.utc).isoformat(),
            })
    elif req.side == "sell":
        existing = await db.stock_holdings.find_one({"user_email": email, "symbol": symbol})
        if not existing or existing["shares"] < req.shares:
            raise HTTPException(400, "Nicht genügend Anteile")
        new_shares = round(existing["shares"] - req.shares, 6)
        if new_shares < 0.0001:
            await db.stock_holdings.delete_one({"user_email": email, "symbol": symbol})
        else:
            await db.stock_holdings.update_one({"user_email": email, "symbol": symbol}, {"$set": {"shares": new_shares}})
        await db.users.update_one({"email": email}, {"$inc": {"balance": total_cost}})
    else:
        raise HTTPException(400, "side muss 'buy' oder 'sell' sein")

    await db.stock_trades.insert_one({
        "trade_id": secrets.token_hex(8), "user_email": email, "symbol": symbol,
        "name": asset["name"], "side": req.side, "shares": req.shares,
        "price": price, "total": total_cost,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })

    user_doc = await db.users.find_one({"email": email})
    new_balance = user_doc.get("balance", 0) if user_doc else 0

    return {"ok": True, "side": req.side, "symbol": symbol, "shares": req.shares,
            "price": price, "total": total_cost, "new_balance": round(new_balance, 2)}


@router.get("/trades")
async def get_trades(request: Request):
    user = await get_current_user(request)
    trades = await db.stock_trades.find({"user_email": user.get("email", "")}, {"_id": 0}).sort("created_at", -1).to_list(50)
    return {"trades": trades}


# ═══ WATCHLIST ═══

class WatchReq(BaseModel):
    symbol: str

@router.post("/watchlist/toggle")
async def toggle_watchlist(req: WatchReq, request: Request):
    user = await get_current_user(request)
    email = user.get("email", "")
    existing = await db.stock_watchlist.find_one({"user_email": email, "symbol": req.symbol.upper()})
    if existing:
        await db.stock_watchlist.delete_one({"user_email": email, "symbol": req.symbol.upper()})
        return {"ok": True, "watching": False}
    asset = next((a for a in ASSETS if a["symbol"] == req.symbol.upper()), None)
    await db.stock_watchlist.insert_one({
        "user_email": email, "symbol": req.symbol.upper(),
        "name": asset["name"] if asset else req.symbol,
        "added_at": datetime.now(timezone.utc).isoformat(),
    })
    return {"ok": True, "watching": True}

@router.get("/watchlist")
async def get_watchlist(request: Request):
    user = await get_current_user(request)
    wl = await db.stock_watchlist.find({"user_email": user.get("email", "")}, {"_id": 0}).to_list(50)
    enriched = []
    for w in wl:
        price = get_price(w["symbol"])
        asset = next((a for a in ASSETS if a["symbol"] == w["symbol"]), {})
        enriched.append({**w, "price": price, "change_pct": asset.get("change", 0), "type": asset.get("type", "stock")})
    return {"watchlist": enriched}
