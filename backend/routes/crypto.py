"""
BidBlitz V2 - Crypto Wallet
Real-time prices via CoinGecko API (free, no key needed)
"""

from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel
from core.security import get_current_user
from core.database import db
from datetime import datetime, timezone
import secrets, random, httpx, asyncio, logging

logger = logging.getLogger("bidblitz.crypto")
router = APIRouter(prefix="/api/crypto", tags=["crypto"])

CRYPTO_ASSETS = {
    "BTC": {"name": "Bitcoin", "symbol": "BTC", "color": "#F7931A", "cg_id": "bitcoin"},
    "ETH": {"name": "Ethereum", "symbol": "ETH", "color": "#627EEA", "cg_id": "ethereum"},
    "USDT": {"name": "Tether", "symbol": "USDT", "color": "#26A17B", "cg_id": "tether"},
    "BNB": {"name": "BNB", "symbol": "BNB", "color": "#F3BA2F", "cg_id": "binancecoin"},
    "SOL": {"name": "Solana", "symbol": "SOL", "color": "#00FFA3", "cg_id": "solana"},
    "XRP": {"name": "Ripple", "symbol": "XRP", "color": "#00AAE4", "cg_id": "ripple"},
    "ADA": {"name": "Cardano", "symbol": "ADA", "color": "#0033AD", "cg_id": "cardano"},
    "DOGE": {"name": "Dogecoin", "symbol": "DOGE", "color": "#C2A633", "cg_id": "dogecoin"},
    "DOT": {"name": "Polkadot", "symbol": "DOT", "color": "#E6007A", "cg_id": "polkadot"},
    "AVAX": {"name": "Avalanche", "symbol": "AVAX", "color": "#E84142", "cg_id": "avalanche-2"},
}

# Fallback base prices if CoinGecko is down
FALLBACK_PRICES = {"BTC": 97500, "ETH": 3850, "USDT": 1.0, "BNB": 710, "SOL": 195, "XRP": 2.45, "ADA": 0.75, "DOGE": 0.32, "DOT": 7.5, "AVAX": 38.0}

# Cache for CoinGecko prices (refreshed every 60s)
_price_cache = {}
_cache_time = None
CACHE_TTL = 60  # seconds


async def fetch_coingecko_prices():
    """Fetch real prices from CoinGecko free API."""
    global _price_cache, _cache_time
    
    # Return cache if fresh
    if _cache_time and (datetime.now(timezone.utc) - _cache_time).total_seconds() < CACHE_TTL and _price_cache:
        return _price_cache

    cg_ids = ",".join(info["cg_id"] for info in CRYPTO_ASSETS.values())
    url = f"https://api.coingecko.com/api/v3/simple/price?ids={cg_ids}&vs_currencies=eur&include_24hr_change=true&include_market_cap=true"

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(url, timeout=8)
            if resp.status_code == 200:
                data = resp.json()
                new_cache = {}
                for symbol, info in CRYPTO_ASSETS.items():
                    cg_data = data.get(info["cg_id"], {})
                    new_cache[symbol] = {
                        "price_eur": cg_data.get("eur", FALLBACK_PRICES.get(symbol, 1)),
                        "change_24h": round(cg_data.get("eur_24h_change", 0), 2),
                        "market_cap": cg_data.get("eur_market_cap", 0),
                    }
                _price_cache = new_cache
                _cache_time = datetime.now(timezone.utc)
                logger.info(f"CoinGecko prices updated: {len(new_cache)} coins")
                return _price_cache
            else:
                logger.warning(f"CoinGecko HTTP {resp.status_code}")
    except Exception as e:
        logger.warning(f"CoinGecko fetch failed: {e}")

    # Fallback to cached or base prices
    if _price_cache:
        return _price_cache
    return {sym: {"price_eur": p, "change_24h": 0, "market_cap": 0} for sym, p in FALLBACK_PRICES.items()}


def get_live_price(symbol: str) -> float:
    """Get cached live price for a symbol."""
    if _price_cache and symbol in _price_cache:
        return _price_cache[symbol]["price_eur"]
    return FALLBACK_PRICES.get(symbol, 1.0)


@router.get("/prices")
async def get_prices():
    cache = await fetch_coingecko_prices()
    prices = []
    for symbol, info in CRYPTO_ASSETS.items():
        cd = cache.get(symbol, {})
        prices.append({
            "symbol": symbol,
            "name": info["name"],
            "color": info["color"],
            "price_eur": cd.get("price_eur", FALLBACK_PRICES.get(symbol, 0)),
            "change_24h": cd.get("change_24h", 0),
            "market_cap": cd.get("market_cap", 0),
        })
    source = "coingecko" if _cache_time else "fallback"
    return {"prices": prices, "source": source, "updated_at": (_cache_time or datetime.now(timezone.utc)).isoformat()}


@router.get("/portfolio")
async def get_portfolio(request: Request):
    user = await get_current_user(request)
    user_id = str(user["_id"])
    

    holdings = await db.crypto_holdings.find(
        {"user_id": user_id}, {"_id": 0}
    ).to_list(100)
    
    total_value = 0
    portfolio = []
    for h in holdings:
        price = get_live_price(h["symbol"])
        value = h["amount"] * price
        total_value += value
        info = CRYPTO_ASSETS.get(h["symbol"], {})
        portfolio.append({
            "symbol": h["symbol"],
            "name": info.get("name", h["symbol"]),
            "color": info.get("color", "#888"),
            "amount": h["amount"],
            "avg_buy_price": h.get("avg_buy_price", 0),
            "current_price": price,
            "value_eur": round(value, 2),
            "pnl": round(value - (h["amount"] * h.get("avg_buy_price", price)), 2),
            "change_24h": _price_cache.get(h["symbol"], {}).get("change_24h", 0),
        })
    
    return {"portfolio": portfolio, "total_value_eur": round(total_value, 2)}


class TradeRequest(BaseModel):
    symbol: str
    amount_eur: float
    side: str  # "buy" or "sell"


@router.post("/trade")
async def trade(req: TradeRequest, request: Request):
    user = await get_current_user(request)
    user_id = str(user["_id"])
    

    symbol = req.symbol.upper()
    if symbol not in CRYPTO_ASSETS:
        raise HTTPException(400, "Unbekannte Kryptowährung")
    if req.amount_eur <= 0:
        raise HTTPException(400, "Betrag muss positiv sein")
    
    price = get_live_price(symbol)
    crypto_amount = req.amount_eur / price
    
    if req.side == "buy":
        if user.get("balance", 0) < req.amount_eur:
            raise HTTPException(400, "Nicht genug Guthaben")
        
        # Deduct from wallet
        await db.users.update_one({"_id": user["_id"]}, {"$inc": {"balance": -req.amount_eur}})
        
        # Add to holdings
        existing = await db.crypto_holdings.find_one({"user_id": user_id, "symbol": symbol})
        if existing:
            new_amount = existing["amount"] + crypto_amount
            new_avg = ((existing["amount"] * existing.get("avg_buy_price", price)) + (crypto_amount * price)) / new_amount
            await db.crypto_holdings.update_one(
                {"user_id": user_id, "symbol": symbol},
                {"$set": {"amount": new_amount, "avg_buy_price": round(new_avg, 2)}}
            )
        else:
            await db.crypto_holdings.insert_one({
                "user_id": user_id, "symbol": symbol,
                "amount": crypto_amount, "avg_buy_price": price,
                "created_at": datetime.now(timezone.utc).isoformat(),
            })
    
    elif req.side == "sell":
        existing = await db.crypto_holdings.find_one({"user_id": user_id, "symbol": symbol})
        if not existing or existing["amount"] < crypto_amount:
            raise HTTPException(400, f"Nicht genug {symbol}")
        
        new_amount = existing["amount"] - crypto_amount
        if new_amount < 0.00000001:
            await db.crypto_holdings.delete_one({"user_id": user_id, "symbol": symbol})
        else:
            await db.crypto_holdings.update_one(
                {"user_id": user_id, "symbol": symbol},
                {"$set": {"amount": new_amount}}
            )
        
        # Add to wallet
        await db.users.update_one({"_id": user["_id"]}, {"$inc": {"balance": req.amount_eur}})
    else:
        raise HTTPException(400, "side muss 'buy' oder 'sell' sein")
    
    # Record transaction
    await db.crypto_transactions.insert_one({
        "id": secrets.token_hex(8),
        "user_id": user_id,
        "symbol": symbol,
        "side": req.side,
        "crypto_amount": round(crypto_amount, 8),
        "eur_amount": req.amount_eur,
        "price": price,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    
    updated = await db.users.find_one({"_id": user["_id"]})
    return {
        "success": True,
        "side": req.side,
        "symbol": symbol,
        "crypto_amount": round(crypto_amount, 8),
        "eur_amount": req.amount_eur,
        "price": price,
        "new_balance": round(updated.get("balance", 0), 2),
    }


@router.get("/transactions")
async def get_crypto_transactions(request: Request):
    user = await get_current_user(request)
    user_id = str(user["_id"])
    

    txns = await db.crypto_transactions.find(
        {"user_id": user_id}, {"_id": 0}
    ).sort("created_at", -1).limit(50).to_list(50)
    
    return {"transactions": txns}
