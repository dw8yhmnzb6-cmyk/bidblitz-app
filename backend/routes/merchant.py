from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from bson import ObjectId
from datetime import datetime, timezone
from core.database import db
from core.security import get_current_user
from core.config import FEES
import secrets

router = APIRouter(prefix="/api/merchant", tags=["merchant"])


class QRRequest(BaseModel):
    amount: float = Field(0, ge=0, description="Fixed amount (0 = open amount)")


# ── Dashboard ──
@router.get("/dashboard")
async def get_dashboard(request: Request):
    user = await get_current_user(request)
    user_id = str(user["_id"])

    merchant = await db.merchants.find_one({"user_id": user_id}, {"_id": 0})
    if not merchant:
        return {
            "merchant_id": user_id,
            "business_name": f"{user.get('name', 'User')}'s Store",
            "gross_earnings": 0.0,
            "total_earnings": 0.0,
            "total_fees": 0.0,
            "total_transactions": 0,
            "available_payout": 0.0,
            "today_earnings": 0.0,
            "today_transactions": 0,
            "fee_percent": FEES["payment"] * 100,
            "recent_payments": [],
        }

    merchant_id = merchant.get("user_id", user_id)
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    today_start_str = today_start.isoformat()

    # Get recent merchant transactions from merchant_transactions collection
    recent = await db.merchant_transactions.find(
        {"merchant_id": merchant_id},
        {"_id": 0}
    ).sort("created_at", -1).limit(10).to_list(10)

    # Fallback to old transactions collection
    if not recent:
        recent = await db.transactions.find(
            {"user_id": user_id, "type": {"$in": ["merchant_credit", "payment"]}},
            {"_id": 0}
        ).sort("created_at", -1).limit(10).to_list(10)

    # Calculate today's revenue - check both string and datetime comparisons
    all_merchant_txns = await db.merchant_transactions.find(
        {"merchant_id": merchant_id},
        {"_id": 0}
    ).to_list(1000)
    
    today_earnings = 0
    today_count = 0
    for t in all_merchant_txns:
        if t.get("status") != "completed":
            continue
        created = t.get("created_at", "")
        if isinstance(created, str) and created >= today_start_str:
            today_earnings += abs(t.get("net", t.get("amount", 0)))
            today_count += 1
        elif isinstance(created, datetime) and created >= today_start:
            today_earnings += abs(t.get("net", t.get("amount", 0)))
            today_count += 1

    # Fallback to transactions collection if no merchant_transactions
    if not all_merchant_txns:
        all_txns = await db.transactions.find(
            {"user_id": user_id, "type": {"$in": ["merchant_credit", "payment"]}},
            {"_id": 0}
        ).to_list(1000)
        for t in all_txns:
            if t.get("status") != "completed":
                continue
            created = t.get("created_at", "")
            if isinstance(created, str) and created >= today_start_str:
                today_earnings += abs(t.get("amount", 0))
                today_count += 1

    # Get total from merchant profile or calculate from transactions
    total_earnings = merchant.get("total_earnings", 0.0)
    if total_earnings == 0 and all_merchant_txns:
        total_earnings = sum(abs(t.get("net", 0)) for t in all_merchant_txns if t.get("status") == "completed")

    return {
        "merchant_id": merchant_id,
        "business_name": merchant.get("business_name", ""),
        "gross_earnings": merchant.get("gross_earnings", total_earnings),
        "total_earnings": round(total_earnings, 2),
        "total_fees": merchant.get("total_fees", 0.0),
        "total_transactions": merchant.get("total_transactions", len(all_merchant_txns) if all_merchant_txns else len(recent)),
        "available_payout": merchant.get("available_payout", 0.0),
        "today_earnings": round(today_earnings, 2),
        "today_transactions": today_count,
        "fee_percent": FEES["payment"] * 100,
        "recent_payments": recent,
    }


# ── Generate QR Payment Data ──
@router.post("/qr")
async def generate_qr(req: QRRequest, request: Request):
    user = await get_current_user(request)
    user_id = str(user["_id"])

    # Look up merchant profile
    merchant = await db.merchants.find_one({"user_id": user_id})
    if not merchant:
        # Auto-create merchant profile
        merchant_doc = {
            "user_id": user_id,
            "business_name": f"{user.get('name', 'User')}'s Store",
            "total_earnings": 0.0,
            "gross_earnings": 0.0,
            "total_fees": 0.0,
            "total_transactions": 0,
            "available_payout": 0.0,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        result = await db.merchants.insert_one(merchant_doc)
        merchant_id = str(result.inserted_id)
        business_name = merchant_doc["business_name"]
    else:
        merchant_id = str(merchant["_id"])
        business_name = merchant.get("business_name", "")

    # Generate QR payload
    qr_ref = f"QR-{secrets.token_hex(4).upper()}"
    qr_payload = {
        "type": "bidblitz_pay",
        "merchant_id": merchant_id,
        "merchant_name": business_name,
        "amount": req.amount if req.amount > 0 else None,
        "reference": qr_ref,
        "currency": "EUR",
        "fee_percent": FEES["payment"] * 100,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    return {
        "qr_data": qr_payload,
        "qr_string": f"bidblitz://pay?mid={merchant_id}&name={business_name}&amt={req.amount}&ref={qr_ref}&cur=EUR",
        "merchant_id": merchant_id,
        "merchant_name": business_name,
        "reference": qr_ref,
    }


# ── Fee Schedule ──
@router.get("/fees")
async def get_fees():
    return {
        "payment_fee_percent": FEES["payment"] * 100,
        "send_fee_percent": FEES["send"] * 100,
        "topup_fee_percent": FEES["topup"] * 100,
        "payout_flat_fee": FEES["payout_flat"],
        "min_payout": FEES["min_payout"],
    }
