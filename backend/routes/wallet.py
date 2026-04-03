from fastapi import APIRouter, HTTPException, Request
from bson import ObjectId
from datetime import datetime, timezone
from core.database import db
from core.security import get_current_user, serialize_user
from schemas.models import TopUpRequest
import secrets

router = APIRouter(prefix="/api/wallet", tags=["wallet"])


def generate_reference():
    return f"BLZ-{secrets.token_hex(4).upper()}"


@router.get("")
async def get_wallet(request: Request):
    user = await get_current_user(request)
    user_id = str(user["_id"])

    # Get recent transactions
    transactions = await db.transactions.find(
        {"user_id": user_id}, {"_id": 0}
    ).sort("created_at", -1).limit(20).to_list(20)

    return {
        "balance": user.get("balance", 0.0),
        "currency": user.get("currency", "EUR"),
        "card_number": user.get("card_number", ""),
        "card_expiry": user.get("card_expiry", ""),
        "card_holder": user.get("name", ""),
        "transactions": transactions,
    }


@router.post("/topup")
async def topup(req: TopUpRequest, request: Request):
    user = await get_current_user(request)
    user_id = str(user["_id"])
    ref = generate_reference()

    # Update balance
    await db.users.update_one(
        {"_id": user["_id"]},
        {"$inc": {"balance": req.amount}}
    )

    # Create transaction
    txn = {
        "id": secrets.token_hex(8),
        "user_id": user_id,
        "type": "topup",
        "amount": req.amount,
        "description": f"Top-up via {req.payment_method}",
        "merchant_name": "",
        "status": "completed",
        "reference": ref,
        "payment_method": req.payment_method,
        "category": "topup",
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
