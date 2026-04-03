from fastapi import APIRouter, HTTPException, Request
from bson import ObjectId
from datetime import datetime, timezone
from core.database import db
from core.security import get_current_user
from schemas.models import PaymentRequest, SendRequest
import secrets

router = APIRouter(prefix="/api/payment", tags=["payment"])


def generate_reference():
    return f"BLZ-{secrets.token_hex(4).upper()}"


@router.post("/pay")
async def pay(req: PaymentRequest, request: Request):
    user = await get_current_user(request)
    user_id = str(user["_id"])
    current_balance = user.get("balance", 0.0)

    if current_balance < req.amount:
        raise HTTPException(status_code=400, detail=f"Insufficient balance. Current: EUR {current_balance:.2f}")

    ref = generate_reference()

    # Find merchant
    merchant = await db.merchants.find_one({"_id": ObjectId(req.merchant_id)}) if ObjectId.is_valid(req.merchant_id) else None
    merchant_name = merchant["business_name"] if merchant else "Unknown Merchant"

    # Deduct from user balance
    await db.users.update_one(
        {"_id": user["_id"]},
        {"$inc": {"balance": -req.amount}}
    )

    # Add to merchant earnings
    if merchant:
        await db.merchants.update_one(
            {"_id": merchant["_id"]},
            {"$inc": {"total_earnings": req.amount, "total_transactions": 1}}
        )

    # Create transaction record
    txn = {
        "id": secrets.token_hex(8),
        "user_id": user_id,
        "type": "payment",
        "amount": -req.amount,
        "description": req.description or f"Payment to {merchant_name}",
        "merchant_name": merchant_name,
        "status": "completed",
        "reference": ref,
        "payment_method": "wallet",
        "category": "payment",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.transactions.insert_one(txn)
    txn.pop("_id", None)

    updated_user = await db.users.find_one({"_id": user["_id"]})

    return {
        "success": True,
        "new_balance": updated_user["balance"],
        "transaction": txn,
    }


@router.post("/send")
async def send_money(req: SendRequest, request: Request):
    user = await get_current_user(request)
    user_id = str(user["_id"])
    current_balance = user.get("balance", 0.0)

    if current_balance < req.amount:
        raise HTTPException(status_code=400, detail=f"Insufficient balance. Current: EUR {current_balance:.2f}")

    # Find recipient
    recipient = await db.users.find_one({"email": req.recipient_email.lower().strip()})
    if not recipient:
        raise HTTPException(status_code=404, detail="Recipient not found")

    if str(recipient["_id"]) == user_id:
        raise HTTPException(status_code=400, detail="Cannot send money to yourself")

    ref = generate_reference()

    # Deduct from sender
    await db.users.update_one(
        {"_id": user["_id"]},
        {"$inc": {"balance": -req.amount}}
    )

    # Add to recipient
    await db.users.update_one(
        {"_id": recipient["_id"]},
        {"$inc": {"balance": req.amount}}
    )

    now = datetime.now(timezone.utc).isoformat()

    # Sender transaction
    sender_txn = {
        "id": secrets.token_hex(8),
        "user_id": user_id,
        "type": "send",
        "amount": -req.amount,
        "description": req.description or f"Sent to {recipient['name']}",
        "merchant_name": "",
        "status": "completed",
        "reference": ref,
        "payment_method": "wallet",
        "category": "transfer",
        "created_at": now,
    }

    # Recipient transaction
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
        "transaction": sender_txn,
    }
