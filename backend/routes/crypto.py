"""
BidBlitz V2 - Crypto Wallet
Simulated crypto portfolio using CoinGecko-style pricing
"""

from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel
from core.security import get_current_user
from core.database import db
from datetime import datetime, timezone
import secrets, random

router = APIRouter(prefix="/api/crypto", tags=["crypto"])

# Live-simulated prices (updated periodically via background task)
CRYPTO_ASSETS = {
    "BTC": {"name": "Bitcoin", "symbol": "BTC", "color": "#F7931A"},
    "ETH": {"name": "Ethereum", "symbol": "ETH", "color": "#627EEA"},
    "USDT": {"name": "Tether", "symbol": "USDT", "color": "#26A17B"},
    "BNB": {"name": "BNB", "symbol": "BNB", "color": "#F3BA2F"},
    "SOL": {"name": "Solana", "symbol": "SOL", "color": "#00FFA3"},
    "XRP": {"name": "Ripple", "symbol": "XRP", "color": "#00AAE4"},
}

# Base prices (will fluctuate)
BASE_PRICES = {"BTC": 97500, "ETH": 3850, "USDT": 1.0, "BNB": 710, "SOL": 195, "XRP": 2.45}


def get_live_price(symbol: str) -> float:
    base = BASE_PRICES.get(symbol, 1.0)
    # Small random fluctuation (±2%)
    fluctuation = 1 + (random.random() - 0.5) * 0.04
    return round(base * fluctuation, 2)


def get_24h_change(symbol: str) -> float:
    return round((random.random() - 0.45) * 8, 2)  # -3.6% to +4.4%


@router.get("/prices")
async def get_prices():
    prices = []
    for symbol, info in CRYPTO_ASSETS.items():
        price = get_live_price(symbol)
        change = get_24h_change(symbol)
        prices.append({
            "symbol": symbol,
            "name": info["name"],
            "color": info["color"],
            "price_eur": price,
            "change_24h": change,
            "market_cap": round(price * random.randint(100_000, 20_000_000)),
        })
    return {"prices": prices, "updated_at": datetime.now(timezone.utc).isoformat()}


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
            "change_24h": get_24h_change(h["symbol"]),
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
