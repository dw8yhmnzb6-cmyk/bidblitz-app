"""
BidBlitz V2 - Promotions & Campaigns Engine
Admin-configurable campaigns, bonus top-ups, reduced fees.
"""

from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Request, Query
from pydantic import BaseModel, Field
from typing import Optional
from core.database import db
from core.security import get_current_user

router = APIRouter(prefix="/api/promotions", tags=["promotions"])


class CreatePromotionRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    type: str = Field(..., description="bonus_topup, reduced_fee, cashback, signup_bonus")
    description: str = Field("", max_length=500)
    value: float = Field(..., gt=0, description="Bonus amount, fee discount %, or cashback %")
    min_amount: float = Field(0, ge=0, description="Minimum transaction amount to qualify")
    max_uses: int = Field(0, ge=0, description="0 = unlimited")
    starts_at: str = Field(...)
    expires_at: str = Field(...)
    target: str = Field("all", description="all, new_users, merchants")
    active: bool = Field(True)


@router.post("/admin/create")
async def create_promotion(req: CreatePromotionRequest, request: Request):
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    promo = {
        "name": req.name,
        "type": req.type,
        "description": req.description,
        "value": req.value,
        "min_amount": req.min_amount,
        "max_uses": req.max_uses,
        "current_uses": 0,
        "starts_at": req.starts_at,
        "expires_at": req.expires_at,
        "target": req.target,
        "active": req.active,
        "created_by": str(user["_id"]),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    result = await db.promotions.insert_one(promo)

    return {"success": True, "promotion_id": str(result.inserted_id), "name": req.name}


@router.get("/active")
async def get_active_promotions(request: Request):
    user = await get_current_user(request)
    now = datetime.now(timezone.utc).isoformat()

    query = {
        "active": True,
        "starts_at": {"$lte": now},
        "expires_at": {"$gte": now},
    }

    promos = await db.promotions.find(query, {"_id": 0, "created_by": 0}).sort("created_at", -1).to_list(20)
    return {"promotions": promos}


@router.get("/admin/all")
async def get_all_promotions(request: Request):
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    promos = await db.promotions.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return {"promotions": promos}


@router.put("/admin/toggle/{promo_name}")
async def toggle_promotion(promo_name: str, request: Request):
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    promo = await db.promotions.find_one({"name": promo_name})
    if not promo:
        raise HTTPException(status_code=404, detail="Promotion not found")

    new_status = not promo.get("active", False)
    await db.promotions.update_one({"name": promo_name}, {"$set": {"active": new_status}})

    return {"success": True, "name": promo_name, "active": new_status}


async def check_applicable_promotion(user_id: str, txn_type: str, amount: float):
    """Check if any active promotion applies to this transaction. Returns bonus info or None."""
    now = datetime.now(timezone.utc).isoformat()

    type_map = {
        "topup": "bonus_topup",
        "payment": "cashback",
        "send": "reduced_fee",
    }
    promo_type = type_map.get(txn_type)
    if not promo_type:
        return None

    query = {
        "active": True,
        "type": promo_type,
        "starts_at": {"$lte": now},
        "expires_at": {"$gte": now},
        "min_amount": {"$lte": amount},
    }
    promo = await db.promotions.find_one(query)
    if not promo:
        return None

    # Check max uses
    if promo.get("max_uses", 0) > 0 and promo.get("current_uses", 0) >= promo["max_uses"]:
        return None

    # Check per-user usage
    user_used = await db.promo_usage.find_one({"user_id": user_id, "promo_name": promo["name"]})
    if user_used:
        return None

    return {
        "name": promo["name"],
        "type": promo["type"],
        "value": promo["value"],
        "description": promo.get("description", ""),
    }


async def apply_promotion(user_id: str, promo_name: str, amount: float):
    """Apply one promotion exactly once per user and respect the global usage cap."""
    now = datetime.now(timezone.utc).isoformat()
    usage_id = f"promo:{promo_name}:{user_id}"

    existing = await db.promo_usage.find_one({"_id": usage_id}, {"_id": 0})
    if existing:
        return {"applied": True, "replayed": True, "usage": existing}

    promo = await db.promotions.find_one({"name": promo_name, "active": True})
    if not promo:
        return {"applied": False, "reason": "promotion_not_active"}

    starts_at = str(promo.get("starts_at") or "")
    expires_at = str(promo.get("expires_at") or "")
    if starts_at and starts_at > now:
        return {"applied": False, "reason": "promotion_not_started"}
    if expires_at and expires_at < now:
        return {"applied": False, "reason": "promotion_expired"}

    usage = {
        "_id": usage_id,
        "user_id": user_id,
        "promo_name": promo_name,
        "amount": amount,
        "applied_at": now,
    }
    try:
        await db.promo_usage.insert_one(usage)
    except Exception:
        existing = await db.promo_usage.find_one({"_id": usage_id}, {"_id": 0})
        if existing:
            return {"applied": True, "replayed": True, "usage": existing}
        raise

    max_uses = int(promo.get("max_uses") or 0)
    claim_query = {
        "_id": promo["_id"],
        "active": True,
    }
    if max_uses > 0:
        claim_query["current_uses"] = {"$lt": max_uses}

    claimed = await db.promotions.update_one(
        claim_query,
        {"$inc": {"current_uses": 1}, "$set": {"updated_at": now}},
    )
    if claimed.modified_count != 1:
        await db.promo_usage.delete_one({"_id": usage_id})
        return {"applied": False, "reason": "usage_limit_reached"}

    usage.pop("_id", None)
    return {"applied": True, "replayed": False, "usage": usage}
