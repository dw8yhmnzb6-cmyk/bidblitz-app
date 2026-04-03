from fastapi import APIRouter, HTTPException, Request
from bson import ObjectId
from datetime import datetime, timezone
from core.database import db
from core.security import get_current_user
from core.config import calculate_fee, FEES
from core.rate_limit import limiter, RATE_PAYMENT
from schemas.models import PaymentRequest, SendRequest
import secrets

router = APIRouter(prefix="/api/payment", tags=["payment"])


def generate_reference():
    return f"BLZ-{secrets.token_hex(4).upper()}"


@router.get("/fee-preview")
async def fee_preview(amount: float, fee_type: str = "payment"):
    """Preview fee breakdown before payment."""
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be positive")
    fee = calculate_fee(amount, fee_type)
    return {
        "gross_amount": round(amount, 2),
        "fee_amount": fee,
        "fee_percent": FEES.get(fee_type, 0.0) * 100,
        "net_amount": round(amount - fee, 2),
        "total_charged": round(amount, 2),
    }


@router.post("/pay")
@limiter.limit(RATE_PAYMENT)
async def pay(req: PaymentRequest, request: Request):
    user = await get_current_user(request)
    user_id = str(user["_id"])
    current_balance = user.get("balance", 0.0)

    if req.amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be positive")

    if current_balance < req.amount:
        raise HTTPException(status_code=400, detail=f"Insufficient balance. Current: EUR {current_balance:.2f}")

    ref = generate_reference()

    # Calculate platform fee
    fee = calculate_fee(req.amount, "payment")
    net_to_merchant = round(req.amount - fee, 2)

    # Find merchant
    merchant = None
    if req.merchant_id and ObjectId.is_valid(req.merchant_id):
        merchant = await db.merchants.find_one({"_id": ObjectId(req.merchant_id)})
    if not merchant and req.merchant_id:
        merchant = await db.merchants.find_one({"user_id": req.merchant_id})
    merchant_name = merchant["business_name"] if merchant else "Unknown Merchant"

    # Deduct full amount from user
    await db.users.update_one(
        {"_id": user["_id"]},
        {"$inc": {"balance": -req.amount}}
    )

    # Credit net amount to merchant, track fees
    if merchant:
        await db.merchants.update_one(
            {"_id": merchant["_id"]},
            {
                "$inc": {
                    "total_earnings": net_to_merchant,
                    "gross_earnings": req.amount,
                    "total_fees": fee,
                    "total_transactions": 1,
                    "available_payout": net_to_merchant,
                }
            }
        )

    now = datetime.now(timezone.utc).isoformat()

    # Customer transaction (debit)
    txn = {
        "id": secrets.token_hex(8),
        "user_id": user_id,
        "type": "payment",
        "amount": -req.amount,
        "gross_amount": req.amount,
        "fee_amount": fee,
        "net_amount": net_to_merchant,
        "description": req.description or f"Payment to {merchant_name}",
        "merchant_name": merchant_name,
        "merchant_id": str(merchant["_id"]) if merchant else "",
        "status": "completed",
        "reference": ref,
        "payment_method": "wallet",
        "category": "payment",
        "created_at": now,
    }
    await db.transactions.insert_one(txn)
    txn.pop("_id", None)

    # Merchant-side transaction (credit)
    if merchant:
        merchant_txn = {
            "id": secrets.token_hex(8),
            "user_id": merchant.get("user_id", ""),
            "type": "merchant_credit",
            "amount": net_to_merchant,
            "gross_amount": req.amount,
            "fee_amount": fee,
            "net_amount": net_to_merchant,
            "description": f"Payment from {user['name']}",
            "merchant_name": merchant_name,
            "customer_name": user["name"],
            "status": "completed",
            "reference": ref,
            "category": "income",
            "created_at": now,
        }
        await db.transactions.insert_one(merchant_txn)

    updated_user = await db.users.find_one({"_id": user["_id"]})

    return {
        "success": True,
        "new_balance": updated_user["balance"],
        "gross_amount": req.amount,
        "fee_amount": fee,
        "fee_percent": FEES["payment"] * 100,
        "net_amount": net_to_merchant,
        "merchant_name": merchant_name,
        "transaction": txn,
    }


@router.post("/send")
async def send_money(req: SendRequest, request: Request):
    user = await get_current_user(request)
    user_id = str(user["_id"])
    current_balance = user.get("balance", 0.0)

    if req.amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be positive")

    # Calculate send fee
    fee = calculate_fee(req.amount, "send")
    total_debit = round(req.amount + fee, 2)

    if current_balance < total_debit:
        raise HTTPException(status_code=400, detail=f"Insufficient balance. Need EUR {total_debit:.2f}, have EUR {current_balance:.2f}")

    recipient = await db.users.find_one({"email": req.recipient_email.lower().strip()})
    if not recipient:
        raise HTTPException(status_code=404, detail="Recipient not found")

    if str(recipient["_id"]) == user_id:
        raise HTTPException(status_code=400, detail="Cannot send money to yourself")

    ref = generate_reference()
    now = datetime.now(timezone.utc).isoformat()

    # Deduct from sender (amount + fee)
    await db.users.update_one({"_id": user["_id"]}, {"$inc": {"balance": -total_debit}})

    # Credit recipient (full amount, no fee on receiving side)
    await db.users.update_one({"_id": recipient["_id"]}, {"$inc": {"balance": req.amount}})

    sender_txn = {
        "id": secrets.token_hex(8),
        "user_id": user_id,
        "type": "send",
        "amount": -total_debit,
        "gross_amount": req.amount,
        "fee_amount": fee,
        "net_amount": req.amount,
        "description": req.description or f"Sent to {recipient['name']}",
        "merchant_name": "",
        "status": "completed",
        "reference": ref,
        "payment_method": "wallet",
        "category": "transfer",
        "created_at": now,
    }

    recipient_txn = {
        "id": secrets.token_hex(8),
        "user_id": str(recipient["_id"]),
        "type": "receive",
        "amount": req.amount,
        "description": f"Received from {user['name']}",
        "merchant_name": "",
        "status": "completed",
        "reference": ref,
        "payment_method": "wallet",
        "category": "transfer",
        "created_at": now,
    }

    await db.transactions.insert_many([sender_txn, recipient_txn])
    sender_txn.pop("_id", None)

    updated_user = await db.users.find_one({"_id": user["_id"]})

    return {
        "success": True,
        "new_balance": updated_user["balance"],
        "fee_amount": fee,
        "transaction": sender_txn,
    }
