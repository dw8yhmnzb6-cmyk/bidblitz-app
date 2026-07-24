"""
Round-up Savings — Revolut-style.
User enables round-up; after each wallet txn, diff to next euro is moved to savings.
Trigger: hook into payment_engine or poll recent tx (here: REST process endpoint).
"""
import logging
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from typing import Optional, Literal

from core.database import db
from core.security import get_current_user

router = APIRouter(prefix="/api/roundup", tags=["roundup"])
logger = logging.getLogger("bidblitz.roundup")


class RoundupConfigRequest(BaseModel):
    enabled: bool
    round_to: Literal[1, 5, 10] = 1  # round up to nearest 1€, 5€, or 10€
    multiplier: int = Field(default=1, ge=1, le=10)  # 2x, 5x round-up booster
    goal_name: Optional[str] = None
    goal_amount: Optional[float] = None


def _calc_roundup(amount: float, round_to: int, multiplier: int) -> float:
    """Return cents-to-save for a transaction."""
    import math
    rem = amount % round_to
    if rem == 0:
        diff = 0.0
    else:
        diff = round_to - rem
    return round(diff * multiplier, 2)


@router.get("/config")
async def get_config(request: Request):
    user = await get_current_user(request)
    cfg = await db.roundup_config.find_one({"user_id": str(user["_id"])}, {"_id": 0})
    if not cfg:
        return {
            "enabled": False, "round_to": 1, "multiplier": 1,
            "goal_name": None, "goal_amount": None,
            "total_saved": 0.0, "entries_count": 0,
        }
    cfg["total_saved"] = cfg.get("total_saved", 0.0)
    cfg["entries_count"] = cfg.get("entries_count", 0)
    if isinstance(cfg.get("updated_at"), datetime):
        cfg["updated_at"] = cfg["updated_at"].isoformat()
    return cfg


@router.post("/config")
async def set_config(req: RoundupConfigRequest, request: Request):
    user = await get_current_user(request)
    user_id = str(user["_id"])
    now = datetime.now(timezone.utc)
    await db.roundup_config.update_one(
        {"user_id": user_id},
        {
            "$set": {
                "enabled": req.enabled,
                "round_to": req.round_to,
                "multiplier": req.multiplier,
                "goal_name": req.goal_name,
                "goal_amount": req.goal_amount,
                "updated_at": now,
            },
            "$setOnInsert": {
                "user_id": user_id,
                "total_saved": 0.0,
                "entries_count": 0,
                "created_at": now,
            },
        },
        upsert=True,
    )
    return {"ok": True}


@router.post("/process-tx")
async def process_transaction(request: Request, amount: float, tx_id: Optional[str] = None):
    """Called internally after a user transaction. Computes roundup + moves to savings bucket.
    For MVP: idempotent on tx_id, stores entry, increments total_saved.
    Real wallet deduction can be wired via payment_engine.transfer_between_wallets later.
    """
    user = await get_current_user(request)
    user_id = str(user["_id"])
    cfg = await db.roundup_config.find_one({"user_id": user_id})
    if not cfg or not cfg.get("enabled"):
        return {"skipped": "disabled"}

    # Idempotency
    if tx_id:
        existing = await db.roundup_entries.find_one({"user_id": user_id, "tx_id": tx_id})
        if existing:
            return {"idempotent": True, "saved": existing.get("amount_saved", 0)}

    saved = _calc_roundup(amount, cfg.get("round_to", 1), cfg.get("multiplier", 1))
    if saved <= 0:
        return {"saved": 0}

    entry = {
        "user_id": user_id,
        "tx_id": tx_id,
        "source_amount": amount,
        "amount_saved": saved,
        "round_to": cfg.get("round_to", 1),
        "multiplier": cfg.get("multiplier", 1),
        "created_at": datetime.now(timezone.utc),
    }
    await db.roundup_entries.insert_one(entry)
    await db.roundup_config.update_one(
        {"user_id": user_id},
        {"$inc": {"total_saved": saved, "entries_count": 1}},
    )
    return {"ok": True, "saved": saved}


@router.get("/history")
async def history(request: Request, limit: int = 30):
    user = await get_current_user(request)
    user_id = str(user["_id"])
    cursor = db.roundup_entries.find({"user_id": user_id}, {"_id": 0}).sort("created_at", -1).limit(min(limit, 200))
    items = []
    async for e in cursor:
        if isinstance(e.get("created_at"), datetime):
            e["created_at"] = e["created_at"].isoformat()
        items.append(e)
    return {"entries": items}


@router.post("/preview")
async def preview_saving(amount: float, round_to: int = 1, multiplier: int = 1):
    """Stateless preview: given amount + config, show how much would be saved."""
    if round_to not in (1, 5, 10):
        raise HTTPException(400, "round_to must be 1, 5, or 10")
    saved = _calc_roundup(amount, round_to, multiplier)
    return {"amount": amount, "saved": saved, "charged_to_user": amount + saved}
