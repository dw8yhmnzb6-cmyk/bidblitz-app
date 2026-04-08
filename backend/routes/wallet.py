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
        "balance": round(user.get("balance", 0.0), 2),
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
        "new_balance": round(updated_user["balance"], 2),
        "transaction": txn,
    }


# ══════════════════════════════════════════════════════════════════════════════
# P2P WALLET TRANSFER - Send money to another BidBlitz user
# ══════════════════════════════════════════════════════════════════════════════
from pydantic import BaseModel
from typing import Optional

class SendMoneyRequest(BaseModel):
    recipient_email: str
    amount: float
    note: Optional[str] = None


@router.post("/send")
async def send_money(req: SendMoneyRequest, request: Request):
    """P2P transfer between BidBlitz wallet users"""
    user = await get_current_user(request)
    sender_id = str(user["_id"])
    
    # Validate amount
    if req.amount < 0.01:
        raise HTTPException(status_code=400, detail="Mindestbetrag: €0.01")
    if req.amount > 10000:
        raise HTTPException(status_code=400, detail="Maximalbetrag: €10.000")
    
    # Check sender balance
    sender_balance = user.get("balance", 0)
    if sender_balance < req.amount:
        raise HTTPException(
            status_code=400, 
            detail=f"Nicht genug Guthaben. Verfügbar: €{sender_balance:.2f}, Benötigt: €{req.amount:.2f}"
        )
    
    # Find recipient
    recipient_email = req.recipient_email.lower().strip()
    recipient = await db.users.find_one({"email": recipient_email})
    if not recipient:
        raise HTTPException(status_code=404, detail="Empfänger nicht gefunden. Bitte E-Mail überprüfen.")
    
    recipient_id = str(recipient["_id"])
    
    # Cannot send to self
    if recipient_id == sender_id:
        raise HTTPException(status_code=400, detail="Du kannst kein Geld an dich selbst senden")
    
    now = datetime.now(timezone.utc)
    ref = generate_reference()
    
    # Deduct from sender
    await db.users.update_one(
        {"_id": user["_id"]},
        {"$inc": {"balance": -req.amount}}
    )
    
    # Credit to recipient
    await db.users.update_one(
        {"_id": recipient["_id"]},
        {"$inc": {"balance": req.amount}}
    )
    
    # Create sender transaction (outgoing)
    sender_txn = {
        "id": secrets.token_hex(8),
        "user_id": sender_id,
        "type": "transfer_out",
        "amount": -req.amount,
        "description": f"Gesendet an {recipient.get('name', recipient_email)}",
        "merchant_name": recipient.get("name", ""),
        "status": "completed",
        "reference": ref,
        "category": "transfer",
        "note": req.note,
        "recipient_id": recipient_id,
        "created_at": now.isoformat(),
    }
    await db.transactions.insert_one(sender_txn)
    sender_txn.pop("_id", None)
    
    # Create recipient transaction (incoming)
    recipient_txn = {
        "id": secrets.token_hex(8),
        "user_id": recipient_id,
        "type": "transfer_in",
        "amount": req.amount,
        "description": f"Empfangen von {user.get('name', user.get('email', ''))}",
        "merchant_name": user.get("name", ""),
        "status": "completed",
        "reference": ref,
        "category": "transfer",
        "note": req.note,
        "sender_id": sender_id,
        "created_at": now.isoformat(),
    }
    await db.transactions.insert_one(recipient_txn)
    
    # Get updated sender balance
    updated_sender = await db.users.find_one({"_id": user["_id"]})
    
    return {
        "success": True,
        "transaction_id": sender_txn["id"],
        "recipient_name": recipient.get("name", recipient_email),
        "amount": req.amount,
        "new_balance": round(updated_sender.get("balance", 0), 2),
    }
