"""
BidBlitz V2 - Aktien & ETF Trading
Echte Kurse via Yahoo Finance (kein API Key nötig), Portfolio, Watchlist
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime, timezone, timedelta
from core.database import db
from core.config import TEST_MODE
from core.security import get_current_user
from core.payment_engine import debit_wallet, credit_wallet, TransactionType
import secrets, hashlib, logging, random, asyncio, threading

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
        import math
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
                    
                    # Skip NaN/Inf values
                    if math.isnan(current) or math.isinf(current):
                        continue
                    if math.isnan(prev) or math.isinf(prev):
                        prev = current
                    
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


@router.get("/capabilities")
async def stock_capabilities():
    return {
        "live_market_data": True,
        "broker_connected": False,
        "trading_available": bool(TEST_MODE),
        "portfolio_is_simulated": bool(TEST_MODE),
        "message": (
            None if TEST_MODE else
            "Aktienkurse sind nur Marktinformation. Ein verifizierter Broker ist noch nicht verbunden; echte Orders sind deaktiviert."
        ),
    }


@router.get("/market")
async def get_market(type: Optional[str] = None, sector: Optional[str] = None, search: Optional[str] = None):
    import math
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
        if not cd and not TEST_MODE:
            continue
        price = cd.get("price_eur", FALLBACK.get(a["symbol"], 100))
        price_orig = cd.get("price", FALLBACK.get(a["symbol"], 100))
        change = cd.get("change_pct", 0)
        # Guard NaN/Inf. Production omits unavailable live quotes.
        if math.isnan(price) or math.isinf(price):
            if not TEST_MODE:
                continue
            price = FALLBACK.get(a["symbol"], 100)
        if math.isnan(price_orig) or math.isinf(price_orig):
            if not TEST_MODE:
                continue
            price_orig = price
        if math.isnan(change) or math.isinf(change): change = 0
        results.append({
            "symbol": a["symbol"],
            "name": a["name"],
            "type": a["type"],
            "sector": a["sector"],
            "currency": a["currency"],
            "price": round(price, 2),
            "price_original": round(price_orig, 2),
            "change_pct": round(change, 2),
        })
    if not results and not TEST_MODE:
        raise HTTPException(status_code=503, detail="Live-Marktdaten sind momentan nicht verfügbar")
    source = "yahoo_finance" if _cache_time else "test_fallback"
    return {
        "assets": results,
        "total": len(results),
        "source": source,
        "trading_available": bool(TEST_MODE),
        "broker_connected": False,
        "updated_at": (_cache_time or datetime.now(timezone.utc)).isoformat(),
    }


@router.get("/asset/{symbol}")
async def get_asset(symbol: str):
    import math as _math
    symbol = symbol.upper()
    asset = next((a for a in ASSETS if a["symbol"] == symbol), None)
    if not asset:
        raise HTTPException(404, "Asset nicht gefunden")
    
    cache = await fetch_live_prices()
    cd = cache.get(symbol, {})
    if not cd and not TEST_MODE:
        raise HTTPException(status_code=503, detail="Live-Kurs für dieses Asset ist momentan nicht verfügbar")
    price = cd.get("price_eur", FALLBACK.get(symbol, 100))
    change = cd.get("change_pct", 0)
    if _math.isnan(price) or _math.isinf(price):
        if not TEST_MODE:
            raise HTTPException(status_code=503, detail="Live-Kurs ist ungültig")
        price = FALLBACK.get(symbol, 100)
    if _math.isnan(change) or _math.isinf(change): change = 0
    
    def safe_float(v, default=0):
        if v is None: return default
        try:
            f = float(v)
            return default if (_math.isnan(f) or _math.isinf(f)) else f
        except: return default
    
    # Generate chart from Yahoo history
    chart = []
    try:
        import yfinance as yf
        ticker = yf.Ticker(asset["yf"])
        hist = ticker.history(period="1mo", interval="1d", auto_adjust=True)
        for idx, row in hist.iterrows():
            p = safe_float(row["Close"])
            if p == 0: continue
            if asset["currency"] == "USD":
                p = p / EUR_USD
            elif asset["currency"] == "GBP":
                p = p * 1.17
            chart.append({"day": len(chart) + 1, "price": round(p, 2), "date": idx.strftime("%d.%m")})
    except Exception:
        if TEST_MODE:
            p = price * 0.95
            for i in range(30):
                p = p * (1 + (random.random() - 0.48) * 0.03)
                chart.append({"day": i + 1, "price": round(p, 2)})
            if chart:
                chart[-1]["price"] = round(price, 2)
    
    # Get real info from yfinance
    info = {}
    try:
        import yfinance as yf
        ticker = yf.Ticker(asset["yf"])
        fi = ticker.info
        info = {
            "volume": safe_float(fi.get("volume", 0)),
            "market_cap": safe_float(fi.get("marketCap", 0)),
            "pe_ratio": safe_float(fi.get("trailingPE", fi.get("forwardPE")), None),
            "dividend_yield": round(safe_float(fi.get("dividendYield", 0)) * 100, 2),
            "high_52w": safe_float(fi.get("fiftyTwoWeekHigh"), None),
            "low_52w": safe_float(fi.get("fiftyTwoWeekLow"), None),
            "sector_detail": fi.get("sector", asset["sector"]),
            "description": (fi.get("longBusinessSummary", "") or "")[:200],
        }
    except Exception:
        info = (
            {
                "volume": random.randint(1_000_000, 50_000_000),
                "market_cap": round(price * random.randint(500_000_000, 3_000_000_000)),
                "pe_ratio": round(random.uniform(12, 45), 1),
                "dividend_yield": round(random.uniform(0, 3.5), 2),
                "high_52w": round(price * 1.15, 2),
                "low_52w": round(price * 0.78, 2),
            }
            if TEST_MODE else {}
        )
    
    return {
        "symbol": symbol, "name": asset["name"], "type": asset["type"],
        "sector": asset["sector"], "currency": asset["currency"],
        "price": price, "change_pct": change, "chart": chart,
        "source": "yahoo_finance" if _cache_time else "test_fallback",
        "trading_available": bool(TEST_MODE),
        "broker_connected": False,
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
    if not TEST_MODE:
        legacy_count = await db.stock_holdings.count_documents({"user_email": user.get("email", "")})
        return {
            "holdings": [],
            "total_value": 0,
            "total_invested": 0,
            "total_pnl": 0,
            "broker_connected": False,
            "legacy_demo_holdings": legacy_count,
        }
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
    shares: float = Field(..., gt=0, le=100000, allow_inf_nan=False)
    side: str  # buy | sell
    idempotency_key: Optional[str] = None

@router.post("/trade")
async def execute_trade(req: TradeReq, request: Request):
    user = await get_current_user(request)
    if not TEST_MODE:
        raise HTTPException(
            status_code=503,
            detail="Echter Aktienhandel ist deaktiviert, bis ein verifizierter Broker live verbunden ist. Das Wallet wurde nicht belastet.",
        )

    user_id = str(user["_id"])
    email = user.get("email", "")
    symbol = req.symbol.upper()
    side = req.side.lower().strip()
    if side not in {"buy", "sell"}:
        raise HTTPException(400, "side muss 'buy' oder 'sell' sein")

    asset = next((a for a in ASSETS if a["symbol"] == symbol), None)
    if not asset:
        raise HTTPException(404, "Asset nicht gefunden")

    raw_key = (req.idempotency_key or request.headers.get("Idempotency-Key") or "").strip()
    if not 8 <= len(raw_key) <= 200:
        raise HTTPException(status_code=400, detail="Idempotency-Key erforderlich")
    key_hash = hashlib.sha256(f"{user_id}:{raw_key}".encode("utf-8")).hexdigest()[:24]
    trade_id = f"STK-{key_hash.upper()}"
    payload = {
        "user_id": user_id,
        "symbol": symbol,
        "shares": round(float(req.shares), 6),
        "side": side,
    }

    existing_op = await db.stock_trade_ops.find_one({"_id": trade_id}, {"_id": 0})
    if existing_op and existing_op.get("payload") != payload:
        raise HTTPException(status_code=409, detail="Idempotency-Key wurde mit anderen Trade-Daten verwendet")
    if existing_op and existing_op.get("status") == "completed":
        return {**existing_op["response"], "replayed": True}
    if existing_op and existing_op.get("status") in {"processing", "reconciliation_required"}:
        raise HTTPException(status_code=409, detail="Trade wird bereits verarbeitet oder benötigt Abstimmung")
    if existing_op and existing_op.get("status") == "failed":
        raise HTTPException(status_code=409, detail="Fehlgeschlagener Trade benötigt einen neuen Idempotency-Key")

    price = round(float(get_price(symbol)), 2)
    total_cost = round(price * float(req.shares), 2)
    await db.stock_trade_ops.update_one(
        {"_id": trade_id},
        {"$setOnInsert": {
            "_id": trade_id,
            "payload": payload,
            "price": price,
            "total": total_cost,
            "status": "pending",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }},
        upsert=True,
    )
    claimed = await db.stock_trade_ops.update_one(
        {"_id": trade_id, "status": "pending"},
        {"$set": {"status": "processing", "processing_at": datetime.now(timezone.utc).isoformat()}},
    )
    if claimed.modified_count != 1:
        current = await db.stock_trade_ops.find_one({"_id": trade_id}, {"_id": 0}) or {}
        if current.get("status") == "completed":
            return {**current["response"], "replayed": True}
        raise HTTPException(status_code=409, detail="Trade wird bereits verarbeitet")

    marker_field = f"trade_markers.{trade_id}"
    try:
        if side == "buy":
            payment = await debit_wallet(
                user_id=user_id,
                amount=total_cost,
                tx_type=TransactionType.PAYMENT,
                description=f"Stock Preview Kauf: {symbol}",
                reference=trade_id,
                metadata={"symbol": symbol, "shares": req.shares, "preview": True},
                idempotency_key=f"stock-trade:{trade_id}:wallet",
            )
            if not payment.success:
                await db.stock_trade_ops.update_one(
                    {"_id": trade_id},
                    {"$set": {"status": "failed", "error": payment.error or "wallet_debit_failed"}},
                )
                raise HTTPException(status_code=400, detail=payment.error or "Wallet-Abbuchung fehlgeschlagen")

            holding_update = await db.stock_holdings.update_one(
                {"user_email": email, "symbol": symbol, marker_field: {"$exists": False}},
                {
                    "$inc": {
                        "shares": round(float(req.shares), 6),
                        "cost_basis_total": total_cost,
                    },
                    "$set": {
                        marker_field: {
                            "trade_id": trade_id,
                            "side": "buy",
                            "shares": round(float(req.shares), 6),
                            "total": total_cost,
                            "created_at": datetime.now(timezone.utc).isoformat(),
                        },
                        "name": asset["name"],
                        "type": asset["type"],
                    },
                    "$setOnInsert": {
                        "user_email": email,
                        "symbol": symbol,
                        "bought_at": datetime.now(timezone.utc).isoformat(),
                    },
                },
                upsert=True,
            )
            if holding_update.modified_count != 1 and holding_update.upserted_id is None:
                already = await db.stock_holdings.find_one(
                    {"user_email": email, "symbol": symbol, marker_field: {"$exists": True}},
                    {"_id": 1},
                )
                if not already:
                    rollback = await credit_wallet(
                        user_id=user_id,
                        amount=total_cost,
                        tx_type=TransactionType.REFUND,
                        description=f"Stock Preview Kauf Rückbuchung: {symbol}",
                        reference=f"{trade_id}-ROLLBACK",
                        source="stock_preview_rollback",
                        metadata={"trade_id": trade_id, "symbol": symbol},
                        idempotency_key=f"stock-trade:{trade_id}:rollback",
                    )
                    await db.stock_trade_ops.update_one(
                        {"_id": trade_id},
                        {"$set": {
                            "status": "failed" if rollback.success else "reconciliation_required",
                            "error": "holding_update_failed",
                            "rollback_transaction_id": rollback.transaction_id,
                        }},
                    )
                    if not rollback.success:
                        raise HTTPException(status_code=500, detail="Trade benötigt Abstimmung")
                    raise HTTPException(status_code=409, detail="Trade fehlgeschlagen. Wallet wurde zurückgebucht")
            new_balance = payment.new_balance
            wallet_tx_id = payment.transaction_id

        else:
            holding = await db.stock_holdings.find_one({"user_email": email, "symbol": symbol}) or {}
            current_shares = round(float(holding.get("shares") or 0), 6)
            if current_shares < float(req.shares):
                await db.stock_trade_ops.update_one(
                    {"_id": trade_id},
                    {"$set": {"status": "failed", "error": "insufficient_shares"}},
                )
                raise HTTPException(400, "Nicht genügend Anteile")
            cost_basis_total = float(holding.get("cost_basis_total") or (float(holding.get("avg_price") or price) * current_shares))
            avg_cost = (cost_basis_total / current_shares) if current_shares > 0 else 0
            cost_basis_delta = round(avg_cost * float(req.shares), 2)

            holding_update = await db.stock_holdings.update_one(
                {
                    "user_email": email,
                    "symbol": symbol,
                    "shares": {"$gte": round(float(req.shares), 6)},
                    marker_field: {"$exists": False},
                },
                {
                    "$inc": {
                        "shares": -round(float(req.shares), 6),
                        "cost_basis_total": -cost_basis_delta,
                    },
                    "$set": {
                        marker_field: {
                            "trade_id": trade_id,
                            "side": "sell",
                            "shares": round(float(req.shares), 6),
                            "total": total_cost,
                            "created_at": datetime.now(timezone.utc).isoformat(),
                        }
                    },
                },
            )
            if holding_update.modified_count != 1:
                await db.stock_trade_ops.update_one(
                    {"_id": trade_id},
                    {"$set": {"status": "failed", "error": "holding_debit_failed"}},
                )
                raise HTTPException(409, "Anteile wurden bereits verkauft oder reichen nicht aus")

            payment = await credit_wallet(
                user_id=user_id,
                amount=total_cost,
                tx_type=TransactionType.REWARD,
                description=f"Stock Preview Verkauf: {symbol}",
                reference=trade_id,
                source="stock_preview",
                metadata={"symbol": symbol, "shares": req.shares, "preview": True},
                idempotency_key=f"stock-trade:{trade_id}:wallet",
            )
            if not payment.success:
                rollback = await db.stock_holdings.update_one(
                    {"user_email": email, "symbol": symbol, marker_field: {"$exists": True}},
                    {
                        "$inc": {
                            "shares": round(float(req.shares), 6),
                            "cost_basis_total": cost_basis_delta,
                        },
                        "$unset": {marker_field: ""},
                    },
                )
                await db.stock_trade_ops.update_one(
                    {"_id": trade_id},
                    {"$set": {
                        "status": "failed" if rollback.modified_count == 1 else "reconciliation_required",
                        "error": payment.error or "wallet_credit_failed",
                    }},
                )
                if rollback.modified_count != 1:
                    raise HTTPException(status_code=500, detail="Trade benötigt Abstimmung")
                raise HTTPException(status_code=400, detail=payment.error or "Wallet-Gutschrift fehlgeschlagen")
            new_balance = payment.new_balance
            wallet_tx_id = payment.transaction_id

        fresh_holding = await db.stock_holdings.find_one({"user_email": email, "symbol": symbol}, {"_id": 0}) or {}
        shares_after = max(0.0, round(float(fresh_holding.get("shares") or 0), 6))
        cost_basis_after = max(0.0, round(float(fresh_holding.get("cost_basis_total") or 0), 2))
        avg_price_after = round(cost_basis_after / shares_after, 2) if shares_after > 0 else 0.0
        await db.stock_holdings.update_one(
            {"user_email": email, "symbol": symbol},
            {"$set": {"avg_price": avg_price_after}},
        )

        trade_doc = {
            "_id": trade_id,
            "trade_id": trade_id,
            "user_id": user_id,
            "user_email": email,
            "symbol": symbol,
            "name": asset["name"],
            "side": side,
            "shares": round(float(req.shares), 6),
            "price": price,
            "total": total_cost,
            "wallet_transaction_id": wallet_tx_id,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.stock_trades.update_one({"_id": trade_id}, {"$setOnInsert": trade_doc}, upsert=True)
        response = {
            "ok": True,
            "side": side,
            "symbol": symbol,
            "shares": round(float(req.shares), 6),
            "price": price,
            "total": total_cost,
            "new_balance": round(float(new_balance or 0), 2),
        }
        await db.stock_trade_ops.update_one(
            {"_id": trade_id, "status": "processing"},
            {"$set": {
                "status": "completed",
                "response": response,
                "completed_at": datetime.now(timezone.utc).isoformat(),
            }},
        )
        return {**response, "replayed": bool(payment.idempotent_replay)}
    except HTTPException:
        raise
    except Exception as exc:
        await db.stock_trade_ops.update_one(
            {"_id": trade_id, "status": "processing"},
            {"$set": {
                "status": "reconciliation_required",
                "error": str(exc)[:300],
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }},
        )
        raise HTTPException(status_code=500, detail="Trade benötigt Abstimmung")



@router.get("/trades")
async def get_trades(request: Request):
    user = await get_current_user(request)
    if not TEST_MODE:
        legacy_count = await db.stock_trades.count_documents({"user_email": user.get("email", "")})
        return {"trades": [], "broker_connected": False, "legacy_demo_trades": legacy_count}
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
