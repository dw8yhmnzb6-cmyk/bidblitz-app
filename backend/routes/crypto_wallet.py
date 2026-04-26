"""
BidBlitz V2 - Crypto Wallet System
REAL crypto balances for each user
Supports BTC, ETH, USDT, SOL, BNB, etc.
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from datetime import datetime, timezone
from core.database import db
from core.security import get_current_user
import secrets

router = APIRouter(prefix="/api/crypto-wallet", tags=["crypto-wallet"])

SUPPORTED_COINS = ["BTC", "ETH", "USDT", "SOL", "BNB", "USDC", "ADA", "DOT", "MATIC"]


@router.get("/balance")
async def get_crypto_balances(request: Request):
    """Get user's REAL crypto wallet balances."""
    user = await get_current_user(request)
    user_id = str(user.get("_id"))
    
    # Get all crypto wallets for this user
    wallets = await db.crypto_wallets.find(
        {"user_id": user_id},
        {"_id": 0}
    ).to_list(100)
    
    # If no wallets exist, create default ones
    if not wallets:
        for coin in SUPPORTED_COINS:
            await db.crypto_wallets.insert_one({
                "user_id": user_id,
                "coin": coin,
                "balance": 0.0,
                "locked_balance": 0.0,  # Locked in Crypto Earn
                "total_earned": 0.0,     # Total interest earned
                "created_at": datetime.now(timezone.utc).isoformat(),
            })
        
        wallets = await db.crypto_wallets.find(
            {"user_id": user_id},
            {"_id": 0}
        ).to_list(100)
    
    return {
        "wallets": wallets,
        "total_coins": len(wallets),
    }


@router.get("/balance/{coin}")
async def get_coin_balance(coin: str, request: Request):
    """Get balance for specific coin."""
    user = await get_current_user(request)
    user_id = str(user.get("_id"))
    
    coin = coin.upper()
    if coin not in SUPPORTED_COINS:
        raise HTTPException(400, f"Coin {coin} not supported")
    
    wallet = await db.crypto_wallets.find_one(
        {"user_id": user_id, "coin": coin},
        {"_id": 0}
    )
    
    if not wallet:
        # Create wallet if doesn't exist
        wallet = {
            "user_id": user_id,
            "coin": coin,
            "balance": 0.0,
            "locked_balance": 0.0,
            "total_earned": 0.0,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.crypto_wallets.insert_one(wallet)
    
    return wallet


class CryptoDepositRequest(BaseModel):
    coin: str
    amount: float
    txn_hash: str = ""  # Optional blockchain transaction hash


@router.post("/deposit")
async def deposit_crypto(req: CryptoDepositRequest, request: Request):
    """
    Deposit REAL crypto to wallet.
    In production, this would verify blockchain transaction.
    """
    user = await get_current_user(request)
    user_id = str(user.get("_id"))
    
    coin = req.coin.upper()
    if coin not in SUPPORTED_COINS:
        raise HTTPException(400, f"Coin {coin} not supported")
    
    if req.amount <= 0:
        raise HTTPException(400, "Amount must be > 0")
    
    # Update wallet balance
    await db.crypto_wallets.update_one(
        {"user_id": user_id, "coin": coin},
        {
            "$inc": {"balance": req.amount},
            "$setOnInsert": {
                "user_id": user_id,
                "coin": coin,
                "locked_balance": 0.0,
                "total_earned": 0.0,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
        },
        upsert=True
    )
    
    # Log transaction
    await db.crypto_transactions.insert_one({
        "transaction_id": f"ctxn_{secrets.token_hex(8)}",
        "user_id": user_id,
        "type": "deposit",
        "coin": coin,
        "amount": req.amount,
        "txn_hash": req.txn_hash,
        "status": "completed",
        "description": f"Crypto Deposit: {req.amount} {coin}",
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    
    return {
        "ok": True,
        "message": f"✅ {req.amount} {coin} deposited!",
        "coin": coin,
        "amount": req.amount,
    }


class CryptoWithdrawRequest(BaseModel):
    coin: str
    amount: float
    address: str  # Withdrawal address


@router.post("/withdraw")
async def withdraw_crypto(req: CryptoWithdrawRequest, request: Request):
    """
    Withdraw REAL crypto from wallet.
    In production, this would send to blockchain.
    """
    user = await get_current_user(request)
    user_id = str(user.get("_id"))
    
    coin = req.coin.upper()
    if coin not in SUPPORTED_COINS:
        raise HTTPException(400, f"Coin {coin} not supported")
    
    if req.amount <= 0:
        raise HTTPException(400, "Amount must be > 0")
    
    # Check balance
    wallet = await db.crypto_wallets.find_one(
        {"user_id": user_id, "coin": coin}
    )
    
    if not wallet or wallet.get("balance", 0) < req.amount:
        available = wallet.get("balance", 0) if wallet else 0
        raise HTTPException(
            400,
            f"❌ Not enough {coin}! Available: {available:.8f} {coin}"
        )
    
    # Deduct from wallet
    await db.crypto_wallets.update_one(
        {"user_id": user_id, "coin": coin},
        {"$inc": {"balance": -req.amount}}
    )
    
    # Log transaction
    await db.crypto_transactions.insert_one({
        "transaction_id": f"ctxn_{secrets.token_hex(8)}",
        "user_id": user_id,
        "type": "withdrawal",
        "coin": coin,
        "amount": req.amount,
        "address": req.address,
        "status": "pending",  # Would be "completed" after blockchain confirmation
        "description": f"Crypto Withdrawal: {req.amount} {coin} to {req.address[:10]}...",
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    
    return {
        "ok": True,
        "message": f"✅ Withdrawal initiated: {req.amount} {coin}",
        "coin": coin,
        "amount": req.amount,
        "address": req.address,
    }


@router.get("/transactions")
async def get_crypto_transactions(request: Request, limit: int = 50):
    """Get user's crypto transaction history."""
    user = await get_current_user(request)
    user_id = str(user.get("_id"))
    
    txns = await db.crypto_transactions.find(
        {"user_id": user_id},
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    return {"transactions": txns, "total": len(txns)}
