"""
BidBlitz V2 - Admin Routes
Platform control center: overview, user/merchant management, payout approval, transaction monitoring.
"""

from fastapi import APIRouter, HTTPException, Request, Query
from pydantic import BaseModel
from bson import ObjectId
from datetime import datetime, timezone
from core.database import db
from core.security import get_current_user
from core.config import FEES
from typing import Optional

router = APIRouter(prefix="/api/admin", tags=["admin"])


async def require_admin(request: Request):
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


# ── Platform Overview ──
@router.get("/overview")
async def overview(request: Request):
    await require_admin(request)

    total_users = await db.users.count_documents({})
    total_merchants = await db.merchants.count_documents({})

    # Aggregate payment volume + fees
    pipeline = [
        {"$match": {"type": {"$in": ["payment", "merchant_credit"]}}},
        {"$group": {"_id": None, "volume": {"$sum": {"$abs": "$gross_amount"}}, "fees": {"$sum": "$fee_amount"}}},
    ]
    agg = await db.transactions.aggregate(pipeline).to_list(1)
    stats = agg[0] if agg else {"volume": 0, "fees": 0}

    # Payout stats
    pending_payouts = await db.payouts.count_documents({"status": {"$in": ["pending", "approved"]}})
    pending_amount_agg = await db.payouts.aggregate([
        {"$match": {"status": {"$in": ["pending", "approved"]}}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}},
    ]).to_list(1)
    pending_amount = pending_amount_agg[0]["total"] if pending_amount_agg else 0

    processed_agg = await db.payouts.aggregate([
        {"$match": {"status": "processed"}},
        {"$group": {"_id": None, "total": {"$sum": "$net_amount"}, "count": {"$sum": 1}}},
    ]).to_list(1)
    processed = processed_agg[0] if processed_agg else {"total": 0, "count": 0}

    total_txns = await db.transactions.count_documents({})

    # Today stats
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    today_txns = await db.transactions.count_documents({"created_at": {"$gte": today_start}})
    today_users = await db.users.count_documents({"created_at": {"$gte": today_start}})

    return {
        "total_users": total_users,
        "total_merchants": total_merchants,
        "total_transactions": total_txns,
        "payment_volume": round(stats["volume"], 2),
        "platform_fee_revenue": round(stats["fees"], 2),
        "pending_payouts_count": pending_payouts,
        "pending_payouts_amount": round(pending_amount, 2),
        "processed_payouts_count": processed["count"],
        "processed_payouts_amount": round(processed["total"], 2),
        "today_transactions": today_txns,
        "today_new_users": today_users,
        "fee_config": FEES,
    }


# ── User Management ──
@router.get("/users")
async def list_users(request: Request, search: str = "", limit: int = 50, skip: int = 0):
    await require_admin(request)

    query = {}
    if search:
        query = {"$or": [
            {"name": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}},
        ]}

    users = await db.users.find(query, {"password_hash": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.users.count_documents(query)

    result = []
    for u in users:
        txn_count = await db.transactions.count_documents({"user_id": str(u["_id"])})
        result.append({
            "id": str(u["_id"]),
            "name": u.get("name", ""),
            "email": u.get("email", ""),
            "role": u.get("role", "user"),
            "balance": u.get("balance", 0),
            "transaction_count": txn_count,
            "created_at": u.get("created_at", ""),
        })

    return {"users": result, "total": total}


# ── Merchant Management ──
@router.get("/merchants")
async def list_merchants(request: Request, search: str = "", limit: int = 50, skip: int = 0):
    await require_admin(request)

    query = {}
    if search:
        query = {"business_name": {"$regex": search, "$options": "i"}}

    merchants = await db.merchants.find(query).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.merchants.count_documents(query)

    result = []
    for m in merchants:
        payout_count = await db.payouts.count_documents({"merchant_id": str(m["_id"])})
        result.append({
            "id": str(m["_id"]),
            "user_id": m.get("user_id", ""),
            "business_name": m.get("business_name", ""),
            "gross_earnings": round(m.get("gross_earnings", 0), 2),
            "total_earnings": round(m.get("total_earnings", 0), 2),
            "total_fees": round(m.get("total_fees", 0), 2),
            "available_payout": round(m.get("available_payout", 0), 2),
            "pending_payout": round(m.get("pending_payout", 0), 2),
            "total_transactions": m.get("total_transactions", 0),
            "payout_requests": payout_count,
            "created_at": m.get("created_at", ""),
        })

    return {"merchants": result, "total": total}


# ── Payout Management ──
@router.get("/payouts")
async def list_payouts(request: Request, status: str = "", limit: int = 50, skip: int = 0):
    await require_admin(request)

    query = {}
    if status:
        query["status"] = status

    payouts = await db.payouts.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.payouts.count_documents(query)

    return {"payouts": payouts, "total": total}


class PayoutAction(BaseModel):
    action: str  # approve, process, fail, cancel


@router.post("/payouts/{payout_ref}/action")
async def payout_action(payout_ref: str, req: PayoutAction, request: Request):
    await require_admin(request)

    payout = await db.payouts.find_one({"reference": payout_ref})
    if not payout:
        raise HTTPException(status_code=404, detail="Payout not found")

    now = datetime.now(timezone.utc).isoformat()
    valid_transitions = {
        "approve": (["pending"], "approved"),
        "process": (["approved"], "processed"),
        "fail": (["pending", "approved"], "failed"),
        "cancel": (["pending"], "cancelled"),
    }

    if req.action not in valid_transitions:
        raise HTTPException(status_code=400, detail=f"Invalid action: {req.action}")

    allowed_from, new_status = valid_transitions[req.action]
    if payout["status"] not in allowed_from:
        raise HTTPException(status_code=400, detail=f"Cannot {req.action} payout with status: {payout['status']}")

    update = {"$set": {"status": new_status, "processed_at": now if new_status in ("processed", "failed", "cancelled") else payout.get("processed_at")}}
    await db.payouts.update_one({"reference": payout_ref}, update)

    # If failed or cancelled, return funds to available
    if new_status in ("failed", "cancelled"):
        await db.merchants.update_one(
            {"_id": ObjectId(payout["merchant_id"])} if ObjectId.is_valid(payout["merchant_id"]) else {"user_id": payout["user_id"]},
            {"$inc": {"available_payout": payout["amount"], "pending_payout": -payout["amount"]}},
        )

    # If processed, move from pending_payout to paid_out
    if new_status == "processed":
        await db.merchants.update_one(
            {"_id": ObjectId(payout["merchant_id"])} if ObjectId.is_valid(payout["merchant_id"]) else {"user_id": payout["user_id"]},
            {"$inc": {"pending_payout": -payout["amount"]}},
        )

    return {"success": True, "new_status": new_status, "reference": payout_ref}


# ── Transaction Monitoring ──
@router.get("/transactions")
async def list_transactions(
    request: Request,
    search: str = "",
    txn_type: str = "",
    status: str = "",
    limit: int = 50,
    skip: int = 0,
):
    await require_admin(request)

    query = {}
    if search:
        query["$or"] = [
            {"reference": {"$regex": search, "$options": "i"}},
            {"merchant_name": {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}},
        ]
    if txn_type:
        query["type"] = txn_type
    if status:
        query["status"] = status

    txns = await db.transactions.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.transactions.count_documents(query)

    return {"transactions": txns, "total": total}


# ── Platform Settings (read) ──
@router.get("/settings")
async def get_settings(request: Request):
    await require_admin(request)
    return {
        "fees": FEES,
        "note": "Fee changes require server restart. These are read-only from the API.",
    }
