"""BidBlitz Savings Goals.

Savings goals are planning metadata only. This module never moves wallet money
or promises interest. Automatic transfers require a separate, explicit money
movement product and are intentionally disabled here.
"""
from __future__ import annotations

import hashlib
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from core.database import db
from core.security import get_current_user

router = APIRouter(prefix="/api/savings", tags=["savings"])


class SavingsGoalCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    target_amount: float = Field(..., gt=0, le=10_000_000, allow_inf_nan=False)
    monthly_amount: float = Field(default=0, ge=0, le=1_000_000, allow_inf_nan=False)
    idempotency_key: Optional[str] = Field(default=None, max_length=200)


def _goal_key(body_key: Optional[str], request: Request) -> str:
    key = (body_key or request.headers.get("Idempotency-Key") or "").strip()
    if not 8 <= len(key) <= 200:
        raise HTTPException(status_code=400, detail="Idempotency-Key erforderlich")
    return key


@router.get("/capabilities")
async def savings_capabilities():
    return {
        "planning_only": True,
        "automatic_transfers_enabled": False,
        "interest_product": False,
        "message": "Sparziele sind Planung. Es werden keine Wallet-Beträge automatisch verschoben.",
    }


@router.get("/goals")
async def list_goals(request: Request):
    user = await get_current_user(request)
    user_id = str(user["_id"])
    goals = await db.savings_goals.find(
        {"user_id": user_id, "status": {"$ne": "deleted"}},
        {"_id": 0},
    ).sort("created_at", -1).limit(100).to_list(100)
    return {
        "goals": goals,
        "planning_only": True,
        "automatic_transfers_enabled": False,
    }


@router.post("/goals")
async def create_goal(req: SavingsGoalCreate, request: Request):
    user = await get_current_user(request)
    user_id = str(user["_id"])
    idempotency_key = _goal_key(req.idempotency_key, request)
    digest = hashlib.sha256(f"{user_id}:{idempotency_key}".encode("utf-8")).hexdigest()[:20]
    goal_id = f"SAV-{digest.upper()}"

    existing = await db.savings_goals.find_one(
        {"goal_id": goal_id, "user_id": user_id},
        {"_id": 0},
    )
    if existing:
        expected = (
            req.name.strip(),
            round(float(req.target_amount), 2),
            round(float(req.monthly_amount), 2),
        )
        actual = (
            existing.get("name"),
            round(float(existing.get("target_amount") or 0), 2),
            round(float(existing.get("monthly_amount") or 0), 2),
        )
        if actual != expected:
            raise HTTPException(status_code=409, detail="Idempotency-Key wurde bereits für ein anderes Sparziel verwendet")
        return {"ok": True, "goal": existing, "replayed": True}

    now = datetime.now(timezone.utc).isoformat()
    goal = {
        "_id": goal_id,
        "goal_id": goal_id,
        "user_id": user_id,
        "name": req.name.strip(),
        "target_amount": round(float(req.target_amount), 2),
        "monthly_amount": round(float(req.monthly_amount), 2),
        "current_amount": 0.0,
        "automatic_transfer": False,
        "planning_only": True,
        "status": "active",
        "created_at": now,
        "updated_at": now,
    }
    await db.savings_goals.update_one(
        {"_id": goal_id},
        {"$setOnInsert": goal},
        upsert=True,
    )
    saved = await db.savings_goals.find_one({"_id": goal_id}, {"_id": 0}) or goal
    return {"ok": True, "goal": saved, "replayed": False}
