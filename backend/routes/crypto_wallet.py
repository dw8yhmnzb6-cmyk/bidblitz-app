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
from core.config import TEST_MODE
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
    """Crypto deposits require verified blockchain/provider confirmation."""
    await get_current_user(request)
    if not TEST_MODE:
        raise HTTPException(
            status_code=503,
            detail="Crypto-Einzahlungen sind bis zur verifizierten Blockchain-/Custody-Anbindung deaktiviert.",
        )
    raise HTTPException(
        status_code=503,
        detail="Test-Crypto-Gutschriften über den öffentlichen Deposit-Endpunkt sind deaktiviert.",
    )


class CryptoWithdrawRequest(BaseModel):
    coin: str
    amount: float
    address: str  # Withdrawal address


@router.post("/withdraw")
async def withdraw_crypto(req: CryptoWithdrawRequest, request: Request):
    """Crypto withdrawals fail closed until a real custody/blockchain provider is connected."""
    await get_current_user(request)
    raise HTTPException(
        status_code=503,
        detail="Crypto-Auszahlungen sind bis zur verifizierten Blockchain-/Custody-Anbindung deaktiviert.",
    )


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
