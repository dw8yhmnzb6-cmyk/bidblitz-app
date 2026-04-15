"""
BidBlitz V2 - Crypto Earn & Staking
Users lock crypto to earn interest (3-12% APY)
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from datetime import datetime, timezone
from core.database import db
from core.security import get_current_user
import secrets

router = APIRouter(prefix="/api/crypto-earn", tags=["crypto-earn"])

EARN_PRODUCTS = [
    {"id": "btc_flex", "coin": "BTC", "name": "Bitcoin Flex", "apy": 3.0, "term": "Flexibel", "min": 0.001, "lock_days": 0, "icon": "bitcoin"},
    {"id": "eth_flex", "coin": "ETH", "name": "Ethereum Flex", "apy": 2.5, "term": "Flexibel", "min": 0.01, "lock_days": 0, "icon": "ethereum"},
    {"id": "btc_30", "coin": "BTC", "name": "Bitcoin 30 Tage", "apy": 6.5, "term": "30 Tage", "min": 0.001, "lock_days": 30, "icon": "bitcoin"},
    {"id": "eth_30", "coin": "ETH", "name": "Ethereum 30 Tage", "apy": 5.5, "term": "30 Tage", "min": 0.01, "lock_days": 30, "icon": "ethereum"},
    {"id": "btc_90", "coin": "BTC", "name": "Bitcoin 90 Tage", "apy": 10.0, "term": "90 Tage", "min": 0.005, "lock_days": 90, "icon": "bitcoin"},
    {"id": "eth_90", "coin": "ETH", "name": "Ethereum 90 Tage", "apy": 8.5, "term": "90 Tage", "min": 0.05, "lock_days": 90, "icon": "ethereum"},
    {"id": "usdt_flex", "coin": "USDT", "name": "Tether Flex", "apy": 4.0, "term": "Flexibel", "min": 10, "lock_days": 0, "icon": "tether"},
    {"id": "usdt_90", "coin": "USDT", "name": "Tether 90 Tage", "apy": 12.0, "term": "90 Tage", "min": 50, "lock_days": 90, "icon": "tether"},
    {"id": "sol_30", "coin": "SOL", "name": "Solana 30 Tage", "apy": 7.0, "term": "30 Tage", "min": 0.5, "lock_days": 30, "icon": "solana"},
    {"id": "bnb_flex", "coin": "BNB", "name": "BNB Flex", "apy": 3.5, "term": "Flexibel", "min": 0.1, "lock_days": 0, "icon": "bnb"},
]


class EarnDeposit(BaseModel):
    product_id: str
    amount: float = Field(..., gt=0)


@router.get("/products")
async def get_earn_products():
    return {"products": EARN_PRODUCTS}


@router.post("/deposit")
async def create_deposit(req: EarnDeposit, request: Request):
    user = await get_current_user(request)
    product = next((p for p in EARN_PRODUCTS if p["id"] == req.product_id), None)
    if not product:
        raise HTTPException(404, "Produkt nicht gefunden")
    if req.amount < product["min"]:
        raise HTTPException(400, f"Mindestbetrag: {product['min']} {product['coin']}")

    deposit = {
        "deposit_id": f"earn_{secrets.token_hex(6)}",
        "user_email": user.get("email", ""),
        "product_id": req.product_id,
        "coin": product["coin"],
        "amount": req.amount,
        "apy": product["apy"],
        "term": product["term"],
        "lock_days": product["lock_days"],
        "earned": 0,
        "status": "active",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.crypto_earn_deposits.insert_one(deposit)
    return {"ok": True, "deposit_id": deposit["deposit_id"], "message": f"{req.amount} {product['coin']} angelegt mit {product['apy']}% APY!"}


@router.get("/my-deposits")
async def my_deposits(request: Request):
    user = await get_current_user(request)
    deps = await db.crypto_earn_deposits.find(
        {"user_email": user.get("email", "")}, {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    total_earned = sum(d.get("earned", 0) for d in deps)
    return {"deposits": deps, "total_earned": round(total_earned, 6), "count": len(deps)}


@router.post("/withdraw/{deposit_id}")
async def withdraw_deposit(deposit_id: str, request: Request):
    user = await get_current_user(request)
    dep = await db.crypto_earn_deposits.find_one({"deposit_id": deposit_id, "user_email": user.get("email", ""), "status": "active"})
    if not dep:
        raise HTTPException(404, "Einlage nicht gefunden")
    await db.crypto_earn_deposits.update_one({"deposit_id": deposit_id}, {"$set": {"status": "withdrawn", "withdrawn_at": datetime.now(timezone.utc).isoformat()}})
    return {"ok": True, "message": f"{dep['amount']} {dep['coin']} + {dep.get('earned', 0)} Zinsen ausgezahlt!"}
