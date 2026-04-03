"""
BidBlitz V2 - Payout Routes
Handles merchant payout requests, history, and settlement.
"""

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from bson import ObjectId
from datetime import datetime, timezone
from core.database import db
from core.security import get_current_user
from core.config import FEES, calculate_payout_fee
import secrets

router = APIRouter(prefix="/api/payout", tags=["payout"])


class PayoutRequest(BaseModel):
    amount: float = Field(..., gt=0, description="Payout amount")
    notes: str = Field("", description="Optional notes")


def payout_ref():
    return f"PO-{secrets.token_hex(4).upper()}"


# ── Request Payout ──
@router.post("/request")
async def request_payout(req: PayoutRequest, request: Request):
    user = await get_current_user(request)
    user_id = str(user["_id"])

    merchant = await db.merchants.find_one({"user_id": user_id})
    if not merchant:
        raise HTTPException(status_code=404, detail="No merchant profile found")

    available = merchant.get("available_payout", 0.0)
    min_payout = FEES["min_payout"]

    if req.amount < min_payout:
        raise HTTPException(status_code=400, detail=f"Minimum payout is EUR {min_payout:.2f}")

    if req.amount > available:
        raise HTTPException(status_code=400, detail=f"Insufficient available balance. Available: EUR {available:.2f}")

    # Check for existing pending payout (prevent duplicates)
    existing = await db.payouts.find_one({
        "merchant_id": str(merchant["_id"]),
        "status": {"$in": ["pending", "approved"]},
    })
    if existing:
        raise HTTPException(status_code=409, detail="A payout request is already pending. Please wait for it to be processed.")

    # Calculate payout fee
    fee = calculate_payout_fee(req.amount)
    net_payout = round(req.amount - fee, 2)

    now = datetime.now(timezone.utc).isoformat()
    ref = payout_ref()

    payout_doc = {
        "id": ref,
        "merchant_id": str(merchant["_id"]),
        "user_id": user_id,
        "merchant_name": merchant.get("business_name", ""),
        "amount": req.amount,
        "fee": fee,
        "net_amount": net_payout,
        "currency": "EUR",
        "status": "pending",
        "reference": ref,
        "notes": req.notes,
        "created_at": now,
        "processed_at": None,
    }
    await db.payouts.insert_one(payout_doc)
    payout_doc.pop("_id", None)

    # Deduct from available balance immediately to prevent double-spend
    await db.merchants.update_one(
        {"_id": merchant["_id"]},
        {"$inc": {"available_payout": -req.amount, "pending_payout": req.amount}},
    )

    return {
        "success": True,
        "payout": payout_doc,
        "message": f"Payout of EUR {net_payout:.2f} (after EUR {fee:.2f} fee) has been requested.",
    }


# ── Payout History ──
@router.get("/history")
async def payout_history(request: Request, limit: int = 20, skip: int = 0):
    user = await get_current_user(request)
    user_id = str(user["_id"])

    merchant = await db.merchants.find_one({"user_id": user_id})
    if not merchant:
        return {"payouts": [], "total": 0}

    payouts = await db.payouts.find(
        {"merchant_id": str(merchant["_id"])},
        {"_id": 0},
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)

    total = await db.payouts.count_documents({"merchant_id": str(merchant["_id"])})

    return {"payouts": payouts, "total": total}


# ── Cancel Payout ──
@router.post("/cancel/{payout_ref}")
async def cancel_payout(payout_ref: str, request: Request):
    user = await get_current_user(request)
    user_id = str(user["_id"])

    payout = await db.payouts.find_one({"reference": payout_ref, "user_id": user_id})
    if not payout:
        raise HTTPException(status_code=404, detail="Payout not found")

    if payout["status"] not in ("pending",):
        raise HTTPException(status_code=400, detail=f"Cannot cancel payout with status: {payout['status']}")

    now = datetime.now(timezone.utc).isoformat()

    # Cancel and return to available
    await db.payouts.update_one(
        {"reference": payout_ref},
        {"$set": {"status": "cancelled", "processed_at": now}},
    )
    await db.merchants.update_one(
        {"user_id": user_id},
        {"$inc": {"available_payout": payout["amount"], "pending_payout": -payout["amount"]}},
    )

    return {"success": True, "message": "Payout cancelled. Funds returned to available balance."}


# ── Merchant Balance Summary ──
@router.get("/balance")
async def payout_balance(request: Request):
    user = await get_current_user(request)
    user_id = str(user["_id"])

    merchant = await db.merchants.find_one({"user_id": user_id}, {"_id": 0})
    if not merchant:
        return {
            "available": 0.0,
            "pending_payout": 0.0,
            "total_paid_out": 0.0,
            "total_earnings": 0.0,
            "total_fees": 0.0,
            "min_payout": FEES["min_payout"],
            "payout_flat_fee": FEES["payout_flat"],
        }

    # Calculate total paid out from completed payouts
    paid_out_cursor = db.payouts.find(
        {"merchant_id": merchant.get("user_id", user_id), "status": "processed"},
        {"net_amount": 1, "_id": 0},
    )
    paid_out_list = await paid_out_cursor.to_list(1000)
    total_paid_out = sum(p.get("net_amount", 0) for p in paid_out_list)

    return {
        "available": merchant.get("available_payout", 0.0),
        "pending_payout": merchant.get("pending_payout", 0.0),
        "total_paid_out": total_paid_out,
        "total_earnings": merchant.get("total_earnings", 0.0),
        "gross_earnings": merchant.get("gross_earnings", 0.0),
        "total_fees": merchant.get("total_fees", 0.0),
        "min_payout": FEES["min_payout"],
        "payout_flat_fee": FEES["payout_flat"],
    }
