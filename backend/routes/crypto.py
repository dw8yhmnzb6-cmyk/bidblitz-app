"""
BidBlitz V2 - Crypto Wallet
Real-time prices via CoinGecko API (free, no key needed)
"""

from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel, Field
from typing import Optional
from core.security import get_current_user
from core.database import db
from core.config import TEST_MODE
from core.payment_engine import debit_wallet, credit_wallet, TransactionType
from datetime import datetime, timezone
import secrets, hashlib, random, httpx, asyncio, logging

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
                    if "eur" not in cg_data and not TEST_MODE:
                        continue
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

    # A previously verified cache is acceptable; fabricated market prices are not.
    if _price_cache:
        return _price_cache
    if TEST_MODE:
        return {sym: {"price_eur": p, "change_24h": 0, "market_cap": 0} for sym, p in FALLBACK_PRICES.items()}
    return {}


def get_live_price(symbol: str) -> float:
    """Get a verified live/cache price. Test mode may use local fallback data."""
    if _price_cache and symbol in _price_cache:
        return float(_price_cache[symbol]["price_eur"])
    if TEST_MODE:
        return float(FALLBACK_PRICES.get(symbol, 1.0))
    raise HTTPException(status_code=503, detail=f"Live-Kurs für {symbol} ist momentan nicht verfügbar")


@router.get("/capabilities")
async def crypto_capabilities():
    return {
        "live_market_data": True,
        "custody_connected": False,
        "exchange_connected": False,
        "trading_available": bool(TEST_MODE),
        "portfolio_is_simulated": bool(TEST_MODE),
        "message": (
            None if TEST_MODE else
            "Krypto-Kurse sind Marktinformation. Custody/Exchange sind noch nicht live verbunden; Käufe und Verkäufe sind deaktiviert."
        ),
    }


@router.get("/prices")
async def get_prices():
    cache = await fetch_coingecko_prices()
    prices = []
    for symbol, info in CRYPTO_ASSETS.items():
        cd = cache.get(symbol)
        if not cd:
            continue
        prices.append({
            "symbol": symbol,
            "name": info["name"],
            "color": info["color"],
            "price_eur": float(cd["price_eur"]),
            "change_24h": float(cd.get("change_24h", 0) or 0),
            "market_cap": float(cd.get("market_cap", 0) or 0),
        })
    if not prices and not TEST_MODE:
        raise HTTPException(status_code=503, detail="Live-Krypto-Marktdaten sind momentan nicht verfügbar")
    source = "coingecko" if _cache_time else "test_fallback"
    return {
        "prices": prices,
        "source": source,
        "trading_available": bool(TEST_MODE),
        "custody_connected": False,
        "exchange_connected": False,
        "updated_at": (_cache_time or datetime.now(timezone.utc)).isoformat(),
    }


@router.get("/portfolio")
async def get_portfolio(request: Request):
    user = await get_current_user(request)
    user_id = str(user["_id"])

    if not TEST_MODE:
        legacy_count = await db.crypto_holdings.count_documents({"user_id": user_id})
        return {
            "portfolio": [],
            "total_value_eur": 0.0,
            "custody_connected": False,
            "exchange_connected": False,
            "legacy_demo_holdings": legacy_count,
        }

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
    amount_eur: float = Field(..., gt=0, le=100000, allow_inf_nan=False)
    side: str  # "buy" or "sell"
    idempotency_key: Optional[str] = None


@router.post("/trade")
async def trade(req: TradeRequest, request: Request):
    user = await get_current_user(request)
    user_id = str(user["_id"])
    if not TEST_MODE:
        raise HTTPException(
            status_code=503,
            detail="Krypto-Handel ist deaktiviert, bis ein verifizierter Custody-/Exchange-Provider live verbunden ist. Das EUR-Wallet wurde nicht belastet.",
        )

    symbol = req.symbol.upper()
    side = req.side.lower().strip()
    if symbol not in CRYPTO_ASSETS:
        raise HTTPException(400, "Unbekannte Kryptowährung")
    if side not in {"buy", "sell"}:
        raise HTTPException(400, "side muss 'buy' oder 'sell' sein")

    raw_key = (req.idempotency_key or request.headers.get("Idempotency-Key") or "").strip()
    if not 8 <= len(raw_key) <= 200:
        raise HTTPException(status_code=400, detail="Idempotency-Key erforderlich")
    key_hash = hashlib.sha256(f"{user_id}:{raw_key}".encode("utf-8")).hexdigest()[:24]
    trade_id = f"CRY-{key_hash.upper()}"
    payload = {
        "user_id": user_id,
        "symbol": symbol,
        "amount_eur": round(float(req.amount_eur), 2),
        "side": side,
    }

    existing_op = await db.crypto_trade_ops.find_one({"_id": trade_id}, {"_id": 0})
    if existing_op and existing_op.get("payload") != payload:
        raise HTTPException(status_code=409, detail="Idempotency-Key wurde mit anderen Trade-Daten verwendet")
    if existing_op and existing_op.get("status") == "completed":
        return {**existing_op["response"], "replayed": True}
    if existing_op and existing_op.get("status") in {"processing", "reconciliation_required"}:
        raise HTTPException(status_code=409, detail="Trade wird bereits verarbeitet oder benötigt Abstimmung")
    if existing_op and existing_op.get("status") == "failed":
        raise HTTPException(status_code=409, detail="Fehlgeschlagener Trade benötigt einen neuen Idempotency-Key")

    price = round(float(existing_op.get("price") if existing_op else get_live_price(symbol)), 8)
    crypto_amount = round(float(req.amount_eur) / price, 8)
    await db.crypto_trade_ops.update_one(
        {"_id": trade_id},
        {"$setOnInsert": {
            "_id": trade_id,
            "payload": payload,
            "price": price,
            "crypto_amount": crypto_amount,
            "status": "pending",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }},
        upsert=True,
    )
    claimed = await db.crypto_trade_ops.update_one(
        {"_id": trade_id, "status": "pending"},
        {"$set": {"status": "processing", "processing_at": datetime.now(timezone.utc).isoformat()}},
    )
    if claimed.modified_count != 1:
        current = await db.crypto_trade_ops.find_one({"_id": trade_id}, {"_id": 0}) or {}
        if current.get("status") == "completed":
            return {**current["response"], "replayed": True}
        raise HTTPException(status_code=409, detail="Trade wird bereits verarbeitet")

    marker_field = f"trade_markers.{trade_id}"
    try:
        if side == "buy":
            payment = await debit_wallet(
                user_id=user_id,
                amount=req.amount_eur,
                tx_type=TransactionType.PAYMENT,
                description=f"Crypto Preview Kauf: {symbol}",
                reference=trade_id,
                metadata={"symbol": symbol, "crypto_amount": crypto_amount, "preview": True},
                idempotency_key=f"crypto-trade:{trade_id}:wallet",
            )
            if not payment.success:
                await db.crypto_trade_ops.update_one(
                    {"_id": trade_id},
                    {"$set": {"status": "failed", "error": payment.error or "wallet_debit_failed"}},
                )
                raise HTTPException(status_code=400, detail=payment.error or "Wallet-Abbuchung fehlgeschlagen")

            holding_update = await db.crypto_holdings.update_one(
                {"user_id": user_id, "symbol": symbol, marker_field: {"$exists": False}},
                {
                    "$inc": {
                        "amount": crypto_amount,
                        "cost_basis_eur": round(float(req.amount_eur), 2),
                    },
                    "$set": {
                        marker_field: {
                            "trade_id": trade_id,
                            "side": "buy",
                            "crypto_amount": crypto_amount,
                            "eur_amount": round(float(req.amount_eur), 2),
                            "created_at": datetime.now(timezone.utc).isoformat(),
                        }
                    },
                    "$setOnInsert": {
                        "user_id": user_id,
                        "symbol": symbol,
                        "created_at": datetime.now(timezone.utc).isoformat(),
                    },
                },
                upsert=True,
            )
            if holding_update.modified_count != 1 and holding_update.upserted_id is None:
                already = await db.crypto_holdings.find_one(
                    {"user_id": user_id, "symbol": symbol, marker_field: {"$exists": True}},
                    {"_id": 1},
                )
                if not already:
                    rollback = await credit_wallet(
                        user_id=user_id,
                        amount=req.amount_eur,
                        tx_type=TransactionType.REFUND,
                        description=f"Crypto Preview Kauf Rückbuchung: {symbol}",
                        reference=f"{trade_id}-ROLLBACK",
                        source="crypto_preview_rollback",
                        metadata={"trade_id": trade_id, "symbol": symbol},
                        idempotency_key=f"crypto-trade:{trade_id}:rollback",
                    )
                    await db.crypto_trade_ops.update_one(
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
            holding = await db.crypto_holdings.find_one({"user_id": user_id, "symbol": symbol}) or {}
            current_amount = float(holding.get("amount") or 0)
            if current_amount + 1e-12 < crypto_amount:
                await db.crypto_trade_ops.update_one(
                    {"_id": trade_id},
                    {"$set": {"status": "failed", "error": "insufficient_crypto"}},
                )
                raise HTTPException(400, f"Nicht genug {symbol}")
            cost_basis_total = float(
                holding.get("cost_basis_eur")
                or (current_amount * float(holding.get("avg_buy_price") or price))
            )
            avg_cost = (cost_basis_total / current_amount) if current_amount > 0 else 0
            basis_delta = round(avg_cost * crypto_amount, 2)

            holding_update = await db.crypto_holdings.update_one(
                {
                    "user_id": user_id,
                    "symbol": symbol,
                    "amount": {"$gte": crypto_amount},
                    marker_field: {"$exists": False},
                },
                {
                    "$inc": {
                        "amount": -crypto_amount,
                        "cost_basis_eur": -basis_delta,
                    },
                    "$set": {
                        marker_field: {
                            "trade_id": trade_id,
                            "side": "sell",
                            "crypto_amount": crypto_amount,
                            "eur_amount": round(float(req.amount_eur), 2),
                            "created_at": datetime.now(timezone.utc).isoformat(),
                        }
                    },
                },
            )
            if holding_update.modified_count != 1:
                await db.crypto_trade_ops.update_one(
                    {"_id": trade_id},
                    {"$set": {"status": "failed", "error": "holding_debit_failed"}},
                )
                raise HTTPException(status_code=409, detail=f"{symbol}-Bestand wurde bereits verändert oder reicht nicht aus")

            payment = await credit_wallet(
                user_id=user_id,
                amount=req.amount_eur,
                tx_type=TransactionType.REWARD,
                description=f"Crypto Preview Verkauf: {symbol}",
                reference=trade_id,
                source="crypto_preview",
                metadata={"symbol": symbol, "crypto_amount": crypto_amount, "preview": True},
                idempotency_key=f"crypto-trade:{trade_id}:wallet",
            )
            if not payment.success:
                rollback = await db.crypto_holdings.update_one(
                    {"user_id": user_id, "symbol": symbol, marker_field: {"$exists": True}},
                    {
                        "$inc": {"amount": crypto_amount, "cost_basis_eur": basis_delta},
                        "$unset": {marker_field: ""},
                    },
                )
                await db.crypto_trade_ops.update_one(
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

        fresh_holding = await db.crypto_holdings.find_one({"user_id": user_id, "symbol": symbol}, {"_id": 0}) or {}
        amount_after = max(0.0, float(fresh_holding.get("amount") or 0))
        basis_after = max(0.0, float(fresh_holding.get("cost_basis_eur") or 0))
        avg_after = round(basis_after / amount_after, 2) if amount_after > 1e-12 else 0.0
        await db.crypto_holdings.update_one(
            {"user_id": user_id, "symbol": symbol},
            {"$set": {"avg_buy_price": avg_after}},
        )

        tx_doc = {
            "_id": trade_id,
            "id": trade_id,
            "user_id": user_id,
            "symbol": symbol,
            "side": side,
            "crypto_amount": crypto_amount,
            "eur_amount": round(float(req.amount_eur), 2),
            "price": price,
            "wallet_transaction_id": wallet_tx_id,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.crypto_transactions.update_one({"_id": trade_id}, {"$setOnInsert": tx_doc}, upsert=True)
        response = {
            "success": True,
            "side": side,
            "symbol": symbol,
            "crypto_amount": crypto_amount,
            "eur_amount": round(float(req.amount_eur), 2),
            "price": price,
            "new_balance": round(float(new_balance or 0), 2),
        }
        await db.crypto_trade_ops.update_one(
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
        await db.crypto_trade_ops.update_one(
            {"_id": trade_id, "status": "processing"},
            {"$set": {
                "status": "reconciliation_required",
                "error": str(exc)[:300],
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }},
        )
        raise HTTPException(status_code=500, detail="Trade benötigt Abstimmung")



@router.get("/transactions")
async def get_crypto_transactions(request: Request):
    user = await get_current_user(request)
    user_id = str(user["_id"])

    if not TEST_MODE:
        legacy_count = await db.crypto_transactions.count_documents({"user_id": user_id})
        return {
            "transactions": [],
            "custody_connected": False,
            "exchange_connected": False,
            "legacy_demo_transactions": legacy_count,
        }

    txns = await db.crypto_transactions.find(
        {"user_id": user_id}, {"_id": 0}
    ).sort("created_at", -1).limit(50).to_list(50)
    
    return {"transactions": txns}
