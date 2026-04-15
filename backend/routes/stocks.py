"""
BidBlitz V2 - Aktien & ETF Trading
Echte Kurse via Yahoo Finance (kein API Key nötig), Portfolio, Watchlist
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone, timedelta
from core.database import db
from core.security import get_current_user
import secrets, logging, random, asyncio, threading

logger = logging.getLogger("bidblitz.stocks")
router = APIRouter(prefix="/api/stocks", tags=["stocks"])

# Assets with Yahoo Finance tickers
# DE stocks use .DE suffix, ETFs use .DE or .L suffix
ASSETS = [
    {"symbol": "AAPL", "yf": "AAPL", "name": "Apple Inc.", "type": "stock", "sector": "Tech", "currency": "USD"},
    {"symbol": "MSFT", "yf": "MSFT", "name": "Microsoft Corp.", "type": "stock", "sector": "Tech", "currency": "USD"},
    {"symbol": "GOOGL", "yf": "GOOGL", "name": "Alphabet Inc.", "type": "stock", "sector": "Tech", "currency": "USD"},
    {"symbol": "AMZN", "yf": "AMZN", "name": "Amazon.com Inc.", "type": "stock", "sector": "Tech", "currency": "USD"},
    {"symbol": "NVDA", "yf": "NVDA", "name": "NVIDIA Corp.", "type": "stock", "sector": "Tech", "currency": "USD"},
    {"symbol": "TSLA", "yf": "TSLA", "name": "Tesla Inc.", "type": "stock", "sector": "Auto", "currency": "USD"},
    {"symbol": "META", "yf": "META", "name": "Meta Platforms", "type": "stock", "sector": "Tech", "currency": "USD"},
    {"symbol": "JPM", "yf": "JPM", "name": "JPMorgan Chase", "type": "stock", "sector": "Finanzen", "currency": "USD"},
    {"symbol": "V", "yf": "V", "name": "Visa Inc.", "type": "stock", "sector": "Finanzen", "currency": "USD"},
    {"symbol": "JNJ", "yf": "JNJ", "name": "Johnson & Johnson", "type": "stock", "sector": "Gesundheit", "currency": "USD"},
    {"symbol": "WMT", "yf": "WMT", "name": "Walmart Inc.", "type": "stock", "sector": "Einzelhandel", "currency": "USD"},
    {"symbol": "PG", "yf": "PG", "name": "Procter & Gamble", "type": "stock", "sector": "Konsum", "currency": "USD"},
    {"symbol": "SAP", "yf": "SAP", "name": "SAP SE", "type": "stock", "sector": "Tech", "currency": "USD"},
    {"symbol": "SIE", "yf": "SIE.DE", "name": "Siemens AG", "type": "stock", "sector": "Industrie", "currency": "EUR"},
    {"symbol": "ALV", "yf": "ALV.DE", "name": "Allianz SE", "type": "stock", "sector": "Versicherung", "currency": "EUR"},
    {"symbol": "VOW3", "yf": "VOW3.DE", "name": "Volkswagen AG", "type": "stock", "sector": "Auto", "currency": "EUR"},
    {"symbol": "IWDA", "yf": "IWDA.L", "name": "iShares MSCI World", "type": "etf", "sector": "Global", "currency": "USD"},
    {"symbol": "VUSA", "yf": "VUSA.L", "name": "Vanguard S&P 500", "type": "etf", "sector": "USA", "currency": "GBP"},
    {"symbol": "IS3N", "yf": "IS3N.DE", "name": "iShares NASDAQ 100", "type": "etf", "sector": "USA Tech", "currency": "EUR"},
    {"symbol": "EXS1", "yf": "EXS1.DE", "name": "iShares DAX", "type": "etf", "sector": "Deutschland", "currency": "EUR"},
    {"symbol": "EUNL", "yf": "EUNL.DE", "name": "iShares MSCI Europe", "type": "etf", "sector": "Europa", "currency": "EUR"},
    {"symbol": "VWCE", "yf": "VWCE.DE", "name": "Vanguard FTSE All-World", "type": "etf", "sector": "Global", "currency": "EUR"},
    {"symbol": "XDWD", "yf": "XDWD.DE", "name": "Xtrackers MSCI World", "type": "etf", "sector": "Global", "currency": "EUR"},
    {"symbol": "IEEM", "yf": "IEEM.L", "name": "iShares Emerging Markets", "type": "etf", "sector": "Schwellenländer", "currency": "USD"},
]

# Fallback prices (used if Yahoo is down)
FALLBACK = {"AAPL": 198.5, "MSFT": 442.8, "GOOGL": 178.3, "AMZN": 205.6, "NVDA": 124.9, "TSLA": 268.4, "META": 612.3, "JPM": 243.7, "V": 315.2, "JNJ": 156.8, "WMT": 92.4, "PG": 168.9, "SAP": 232.5, "SIE": 198.7, "ALV": 298.4, "VOW3": 104.6, "IWDA": 89.45, "VUSA": 98.2, "IS3N": 871.4, "EXS1": 156.3, "EUNL": 34.8, "VWCE": 117.8, "XDWD": 102.6, "IEEM": 42.3}

# EUR/USD rate fallback
EUR_USD = 1.08

# ═══ YAHOO FINANCE LIVE PRICES ═══
_price_cache = {}
_cache_time = None
CACHE_TTL = 120  # 2 minutes


def _fetch_yahoo_sync():
    """Fetch prices from Yahoo Finance (runs in thread)."""
    try:
        import yfinance as yf
        tickers_str = " ".join(a["yf"] for a in ASSETS)
        data = yf.download(tickers_str, period="2d", interval="1d", progress=False, threads=True, auto_adjust=True)
        
        result = {}
        for asset in ASSETS:
            sym = asset["yf"]
            try:
                if len(ASSETS) == 1:
                    close_vals = data["Close"]
                else:
                    close_vals = data["Close"][sym] if sym in data["Close"].columns else None
                
                if close_vals is not None and len(close_vals) > 0:
                    current = float(close_vals.iloc[-1])
                    prev = float(close_vals.iloc[-2]) if len(close_vals) > 1 else current
                    change_pct = ((current - prev) / prev * 100) if prev > 0 else 0
                    
                    # Convert to EUR if needed
                    price_eur = current
                    if asset["currency"] == "USD":
                        price_eur = current / EUR_USD
                    elif asset["currency"] == "GBP":
                        price_eur = current * 1.17  # approx GBP→EUR
                    
                    result[asset["symbol"]] = {
                        "price": round(current, 2),
                        "price_eur": round(price_eur, 2),
                        "change_pct": round(change_pct, 2),
                        "currency": asset["currency"],
                    }
            except Exception as e:
                logger.debug(f"Yahoo parse error for {sym}: {e}")
                continue
        
        return result
    except Exception as e:
        logger.warning(f"Yahoo Finance fetch failed: {e}")
        return {}


async def fetch_live_prices():
    """Fetch live prices with caching."""
    global _price_cache, _cache_time
    
    if _cache_time and (datetime.now(timezone.utc) - _cache_time).total_seconds() < CACHE_TTL and _price_cache:
        return _price_cache
    
    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(None, _fetch_yahoo_sync)
    
    if result:
        _price_cache = result
        _cache_time = datetime.now(timezone.utc)
        logger.info(f"Yahoo Finance prices updated: {len(result)} assets")
    
    return _price_cache if _price_cache else {}


def get_price(symbol):
    """Get cached price for symbol (EUR)."""
    if _price_cache and symbol in _price_cache:
        return _price_cache[symbol].get("price_eur", FALLBACK.get(symbol, 100))
    return FALLBACK.get(symbol, 100)


def get_change(symbol):
    """Get cached 24h change %."""
    if _price_cache and symbol in _price_cache:
        return _price_cache[symbol].get("change_pct", 0)
    return round((random.random() - 0.45) * 3, 2)


@router.get("/market")
async def get_market(type: Optional[str] = None, sector: Optional[str] = None, search: Optional[str] = None):
    cache = await fetch_live_prices()
    results = []
    for a in ASSETS:
        if type and a["type"] != type:
            continue
        if sector and a["sector"] != sector:
            continue
        if search and search.lower() not in a["name"].lower() and search.lower() not in a["symbol"].lower():
            continue
        cd = cache.get(a["symbol"], {})
        results.append({
            "symbol": a["symbol"],
            "name": a["name"],
            "type": a["type"],
            "sector": a["sector"],
            "currency": a["currency"],
            "price": cd.get("price_eur", FALLBACK.get(a["symbol"], 100)),
            "price_original": cd.get("price", FALLBACK.get(a["symbol"], 100)),
            "change_pct": cd.get("change_pct", 0),
        })
    source = "yahoo_finance" if _cache_time else "fallback"
    return {"assets": results, "total": len(results), "source": source,
            "updated_at": (_cache_time or datetime.now(timezone.utc)).isoformat()}


@router.get("/asset/{symbol}")
async def get_asset(symbol: str):
    symbol = symbol.upper()
    asset = next((a for a in ASSETS if a["symbol"] == symbol), None)
    if not asset:
        raise HTTPException(404, "Asset nicht gefunden")
    
    cache = await fetch_live_prices()
    cd = cache.get(symbol, {})
    price = cd.get("price_eur", FALLBACK.get(symbol, 100))
    change = cd.get("change_pct", 0)
    
    # Generate chart from Yahoo history
    chart = []
    try:
        import yfinance as yf
        ticker = yf.Ticker(asset["yf"])
        hist = ticker.history(period="1mo", interval="1d", auto_adjust=True)
        for idx, row in hist.iterrows():
            p = float(row["Close"])
            if asset["currency"] == "USD":
                p = p / EUR_USD
            elif asset["currency"] == "GBP":
                p = p * 1.17
            chart.append({"day": len(chart) + 1, "price": round(p, 2), "date": idx.strftime("%d.%m")})
    except:
        p = price * 0.95
        for i in range(30):
            p = p * (1 + (random.random() - 0.48) * 0.03)
            chart.append({"day": i + 1, "price": round(p, 2)})
        chart[-1]["price"] = price
    
    # Get real info from yfinance
    info = {}
    try:
        import yfinance as yf
        ticker = yf.Ticker(asset["yf"])
        fi = ticker.info
        info = {
            "volume": fi.get("volume", 0),
            "market_cap": fi.get("marketCap", 0),
            "pe_ratio": fi.get("trailingPE", fi.get("forwardPE")),
            "dividend_yield": round((fi.get("dividendYield", 0) or 0) * 100, 2),
            "high_52w": fi.get("fiftyTwoWeekHigh"),
            "low_52w": fi.get("fiftyTwoWeekLow"),
            "sector_detail": fi.get("sector", asset["sector"]),
            "description": fi.get("longBusinessSummary", "")[:200],
        }
    except:
        info = {"volume": random.randint(1_000_000, 50_000_000), "market_cap": round(price * random.randint(500_000_000, 3_000_000_000)),
                "pe_ratio": round(random.uniform(12, 45), 1), "dividend_yield": round(random.uniform(0, 3.5), 2),
                "high_52w": round(price * 1.15, 2), "low_52w": round(price * 0.78, 2)}
    
    return {
        "symbol": symbol, "name": asset["name"], "type": asset["type"],
        "sector": asset["sector"], "currency": asset["currency"],
        "price": price, "change_pct": change, "chart": chart,
        "source": "yahoo_finance" if _cache_time else "fallback",
        **info,
    }


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
