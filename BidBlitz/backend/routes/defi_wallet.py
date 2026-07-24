"""
BidBlitz V2 - DeFi Wallet (Self-Custody + DApp Browser)
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from datetime import datetime, timezone
from core.database import db
from core.security import get_current_user
import secrets, hashlib

router = APIRouter(prefix="/api/defi-wallet", tags=["defi-wallet"])

DAPPS = [
    {"id": "uniswap", "name": "Uniswap", "category": "DEX", "chain": "Ethereum", "tvl": "4.2B", "icon": "swap", "desc": "Groesster dezentraler Exchange", "color": "#FF007A"},
    {"id": "aave", "name": "Aave", "category": "Lending", "chain": "Ethereum", "tvl": "8.1B", "icon": "bank", "desc": "Leihen & Verleihen ohne Mittelsmann", "color": "#B6509E"},
    {"id": "lido", "name": "Lido", "category": "Staking", "chain": "Ethereum", "tvl": "14.5B", "icon": "layers", "desc": "Liquid Staking fuer ETH", "color": "#00A3FF"},
    {"id": "opensea", "name": "OpenSea", "category": "NFT", "chain": "Multi", "tvl": "N/A", "icon": "image", "desc": "Groesster NFT-Marktplatz", "color": "#2081E2"},
    {"id": "curve", "name": "Curve Finance", "category": "DEX", "chain": "Ethereum", "tvl": "1.8B", "icon": "activity", "desc": "Stablecoin-optimierter DEX", "color": "#A3B1BF"},
    {"id": "pancakeswap", "name": "PancakeSwap", "category": "DEX", "chain": "BSC", "tvl": "1.2B", "icon": "swap", "desc": "Top DEX auf BNB Chain", "color": "#633001"},
    {"id": "raydium", "name": "Raydium", "category": "DEX", "chain": "Solana", "tvl": "680M", "icon": "zap", "desc": "Schnellster DEX auf Solana", "color": "#2BFFF3"},
    {"id": "gmx", "name": "GMX", "category": "Perpetuals", "chain": "Arbitrum", "tvl": "520M", "icon": "trending", "desc": "Dezentrale Perpetual Futures", "color": "#4F67E4"},
]

CHAINS = [
    {"id": "ethereum", "name": "Ethereum", "symbol": "ETH", "color": "#627EEA"},
    {"id": "bsc", "name": "BNB Chain", "symbol": "BNB", "color": "#F3BA2F"},
    {"id": "solana", "name": "Solana", "symbol": "SOL", "color": "#9945FF"},
    {"id": "arbitrum", "name": "Arbitrum", "symbol": "ARB", "color": "#28A0F0"},
    {"id": "polygon", "name": "Polygon", "symbol": "POL", "color": "#8247E5"},
]


class CreateWallet(BaseModel):
    password: str = ""


class SwapTokens(BaseModel):
    from_token: str
    to_token: str
    amount: float = Field(..., gt=0)
    chain: str = "ethereum"


@router.get("/dapps")
async def get_dapps():
    return {"dapps": DAPPS, "chains": CHAINS}


@router.post("/create")
async def create_wallet(req: CreateWallet, request: Request):
    user = await get_current_user(request)
    existing = await db.defi_wallets.find_one({"user_email": user.get("email", "")})
    if existing:
        return {"ok": True, "address": existing.get("address", ""), "message": "Wallet existiert bereits"}
    raw = f"{user.get('email', '')}:{secrets.token_hex(32)}"
    address = "0x" + hashlib.sha256(raw.encode()).hexdigest()[:40]
    seed = " ".join([secrets.token_hex(3) for _ in range(12)])
    wallet = {
        "user_email": user.get("email", ""),
        "address": address,
        "seed_phrase_hash": hashlib.sha256(seed.encode()).hexdigest(),
        "chains": {c["id"]: {"balance": 0} for c in CHAINS},
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.defi_wallets.insert_one(wallet)
    return {"ok": True, "address": address, "seed_phrase": seed,
            "message": "DeFi Wallet erstellt! Speichere deine Seed Phrase sicher!"}


@router.get("/my-wallet")
async def my_wallet(request: Request):
    user = await get_current_user(request)
    w = await db.defi_wallets.find_one({"user_email": user.get("email", "")}, {"_id": 0, "seed_phrase_hash": 0})
    if not w:
        return {"has_wallet": False}
    return {"has_wallet": True, "wallet": w}


@router.post("/swap")
async def swap_tokens(req: SwapTokens, request: Request):
    user = await get_current_user(request)
    fee = round(req.amount * 0.003, 6)
    swap = {
        "swap_id": f"swap_{secrets.token_hex(6)}",
        "user_email": user.get("email", ""),
        "from_token": req.from_token,
        "to_token": req.to_token,
        "amount": req.amount,
        "fee": fee,
        "chain": req.chain,
        "rate": 1.0,
        "status": "completed",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.defi_swaps.insert_one(swap)
    return {"ok": True, "swap_id": swap["swap_id"], "fee": fee,
            "message": f"{req.amount} {req.from_token} -> {req.to_token} getauscht!"}
