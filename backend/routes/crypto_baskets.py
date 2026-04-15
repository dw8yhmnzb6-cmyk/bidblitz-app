"""
BidBlitz V2 - Crypto Baskets (Thematic Portfolios)
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from datetime import datetime, timezone
from core.database import db
from core.security import get_current_user
import secrets

router = APIRouter(prefix="/api/crypto-baskets", tags=["crypto-baskets"])

BASKETS = [
    {"id": "top5", "name": "Top 5 Coins", "desc": "BTC, ETH, SOL, XRP, ADA", "fee": 1.5, "coins": [
        {"coin": "BTC", "weight": 40}, {"coin": "ETH", "weight": 25}, {"coin": "SOL", "weight": 15}, {"coin": "XRP", "weight": 12}, {"coin": "ADA", "weight": 8}
    ], "perf_7d": 4.2, "perf_30d": 12.8, "color": "#F7931A"},
    {"id": "defi", "name": "DeFi Power", "desc": "AAVE, UNI, LINK, MKR, SNX", "fee": 2.0, "coins": [
        {"coin": "AAVE", "weight": 25}, {"coin": "UNI", "weight": 25}, {"coin": "LINK", "weight": 20}, {"coin": "MKR", "weight": 15}, {"coin": "SNX", "weight": 15}
    ], "perf_7d": -1.5, "perf_30d": 8.3, "color": "#1FC7D4"},
    {"id": "gaming", "name": "Gaming & Metaverse", "desc": "AXS, SAND, MANA, GALA, IMX", "fee": 2.0, "coins": [
        {"coin": "AXS", "weight": 25}, {"coin": "SAND", "weight": 20}, {"coin": "MANA", "weight": 20}, {"coin": "GALA", "weight": 20}, {"coin": "IMX", "weight": 15}
    ], "perf_7d": 6.8, "perf_30d": 22.1, "color": "#9945FF"},
    {"id": "layer2", "name": "Layer 2 Bundle", "desc": "MATIC, ARB, OP, BASE, ZK", "fee": 1.8, "coins": [
        {"coin": "MATIC", "weight": 30}, {"coin": "ARB", "weight": 25}, {"coin": "OP", "weight": 20}, {"coin": "BASE", "weight": 15}, {"coin": "ZK", "weight": 10}
    ], "perf_7d": 3.1, "perf_30d": 15.6, "color": "#627EEA"},
    {"id": "meme", "name": "Meme Coins", "desc": "DOGE, SHIB, PEPE, FLOKI, BONK", "fee": 2.5, "coins": [
        {"coin": "DOGE", "weight": 30}, {"coin": "SHIB", "weight": 25}, {"coin": "PEPE", "weight": 20}, {"coin": "FLOKI", "weight": 15}, {"coin": "BONK", "weight": 10}
    ], "perf_7d": 11.4, "perf_30d": -5.2, "color": "#E4A73A"},
    {"id": "stable", "name": "Stablecoin Yield", "desc": "USDT, USDC, DAI, FRAX", "fee": 0.5, "coins": [
        {"coin": "USDT", "weight": 35}, {"coin": "USDC", "weight": 35}, {"coin": "DAI", "weight": 20}, {"coin": "FRAX", "weight": 10}
    ], "perf_7d": 0.1, "perf_30d": 0.3, "color": "#26A17B"},
]


class BuyBasket(BaseModel):
    basket_id: str
    amount_eur: float = Field(..., gt=0, le=50000)


@router.get("/list")
async def list_baskets():
    return {"baskets": BASKETS}


@router.post("/buy")
async def buy_basket(req: BuyBasket, request: Request):
    user = await get_current_user(request)
    basket = next((b for b in BASKETS if b["id"] == req.basket_id), None)
    if not basket:
        raise HTTPException(404, "Basket nicht gefunden")
    fee = round(req.amount_eur * basket["fee"] / 100, 2)
    purchase = {
        "purchase_id": f"bsk_{secrets.token_hex(6)}",
        "user_email": user.get("email", ""),
        "basket_id": req.basket_id,
        "basket_name": basket["name"],
        "amount_eur": req.amount_eur,
        "fee": fee,
        "coins": basket["coins"],
        "status": "active",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.crypto_baskets_purchases.insert_one(purchase)
    return {"ok": True, "purchase_id": purchase["purchase_id"], "fee": fee, "message": f"{basket['name']} fuer {req.amount_eur} EUR gekauft!"}


@router.get("/my-baskets")
async def my_baskets(request: Request):
    user = await get_current_user(request)
    purchases = await db.crypto_baskets_purchases.find(
        {"user_email": user.get("email", "")}, {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    return {"purchases": purchases, "count": len(purchases)}
