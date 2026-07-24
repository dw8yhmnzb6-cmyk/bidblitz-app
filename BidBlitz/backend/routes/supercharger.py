"""
BidBlitz V2 - Supercharger (Deposit BlitzCoin, Earn Rewards)
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from datetime import datetime, timezone
from core.database import db
from core.security import get_current_user
import secrets

router = APIRouter(prefix="/api/supercharger", tags=["supercharger"])

POOLS = [
    {"id": "btc_pool", "reward_coin": "BTC", "accept_coin": "BLZ", "total_pool": 2.5, "apy_est": 15, "participants": 1284, "ends_in_days": 14, "status": "active"},
    {"id": "eth_pool", "reward_coin": "ETH", "accept_coin": "BLZ", "total_pool": 40, "apy_est": 12, "participants": 892, "ends_in_days": 21, "status": "active"},
    {"id": "sol_pool", "reward_coin": "SOL", "accept_coin": "BLZ", "total_pool": 500, "apy_est": 18, "participants": 2103, "ends_in_days": 7, "status": "active"},
    {"id": "usdt_pool", "reward_coin": "USDT", "accept_coin": "BLZ", "total_pool": 50000, "apy_est": 8, "participants": 3456, "ends_in_days": 30, "status": "active"},
]


class DepositSupercharger(BaseModel):
    pool_id: str
    amount: float = Field(..., gt=0)


@router.get("/pools")
async def get_pools():
    return {"pools": POOLS}


@router.post("/deposit")
async def deposit(req: DepositSupercharger, request: Request):
    user = await get_current_user(request)
    pool = next((p for p in POOLS if p["id"] == req.pool_id), None)
    if not pool:
        raise HTTPException(404, "Pool nicht gefunden")
    dep = {
        "deposit_id": f"sc_{secrets.token_hex(6)}",
        "user_email": user.get("email", ""),
        "pool_id": req.pool_id,
        "reward_coin": pool["reward_coin"],
        "amount_blz": req.amount,
        "estimated_reward": round(req.amount * pool["apy_est"] / 100 / 12, 4),
        "status": "staked",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.supercharger_deposits.insert_one(dep)
    return {"ok": True, "deposit_id": dep["deposit_id"], "estimated_reward": dep["estimated_reward"],
            "message": f"{req.amount} BLZ gestaked! Geschaetzte Belohnung: {dep['estimated_reward']} {pool['reward_coin']}"}


@router.get("/my-stakes")
async def my_stakes(request: Request):
    user = await get_current_user(request)
    stakes = await db.supercharger_deposits.find(
        {"user_email": user.get("email", "")}, {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    return {"stakes": stakes, "count": len(stakes)}
