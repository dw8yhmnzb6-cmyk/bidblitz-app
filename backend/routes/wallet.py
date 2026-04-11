from fastapi import APIRouter, HTTPException, Request
from bson import ObjectId
from datetime import datetime, timezone
from core.database import db
from core.security import get_current_user, serialize_user
from core.performance import user_cache, invalidate_user_cache
from schemas.models import TopUpRequest
import secrets

router = APIRouter(prefix="/api/wallet", tags=["wallet"])


def generate_reference():
    return f"BLZ-{secrets.token_hex(4).upper()}"


@router.get("/balance")
async def get_balance(request: Request):
    """Get user's wallet balance - optimized with minimal DB read."""
    user = await get_current_user(request)
    return {
        "balance": round(user.get("balance", 0.0), 2),
        "currency": user.get("currency", "EUR"),
    }


@router.get("/transactions")
async def get_transactions(request: Request, limit: int = 100):
    """Get user's transaction history - optimized with projection."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    # Use projection to only fetch needed fields
    transactions = await db.transactions.find(
        {"user_id": user_id},
        {"_id": 0, "id": 1, "type": 1, "amount": 1, "description": 1, 
         "merchant_name": 1, "status": 1, "reference": 1, "created_at": 1}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    return {"transactions": transactions, "total": len(transactions)}


@router.get("")
async def get_wallet(request: Request):
    """Get full wallet details - combined query optimization."""
    user = await get_current_user(request)
    user_id = str(user["_id"])

    # Get recent transactions with minimal projection
    transactions = await db.transactions.find(
        {"user_id": user_id},
        {"_id": 0, "id": 1, "type": 1, "amount": 1, "description": 1,
         "merchant_name": 1, "status": 1, "reference": 1, "created_at": 1}
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
# Uses centralized Payment Engine for atomic transactions
# ══════════════════════════════════════════════════════════════════════════════
from pydantic import BaseModel
from typing import Optional
from core.payment_engine import transfer_between_wallets, TransactionType

class SendMoneyRequest(BaseModel):
    recipient_email: str
    amount: float
    note: Optional[str] = None


@router.post("/send")
async def send_money(req: SendMoneyRequest, request: Request):
    """P2P transfer between BidBlitz wallet users - atomic & safe"""
    user = await get_current_user(request)
    sender_id = str(user["_id"])
    
    # Validate amount
    if req.amount < 0.01:
        raise HTTPException(status_code=400, detail="Mindestbetrag: €0.01")
    if req.amount > 10000:
        raise HTTPException(status_code=400, detail="Maximalbetrag: €10.000")
    
    # Find recipient
    recipient_email = req.recipient_email.lower().strip()
    recipient = await db.users.find_one({"email": recipient_email})
    if not recipient:
        raise HTTPException(status_code=404, detail="Empfänger nicht gefunden. Bitte E-Mail überprüfen.")
    
    recipient_id = str(recipient["_id"])
    
    # Cannot send to self
    if recipient_id == sender_id:
        raise HTTPException(status_code=400, detail="Du kannst kein Geld an dich selbst senden")
    
    # Use Payment Engine for atomic transfer
    result = await transfer_between_wallets(
        from_user_id=sender_id,
        to_user_id=recipient_id,
        amount=req.amount,
        tx_type=TransactionType.TRANSFER,
        description=f"Transfer to {recipient.get('name', recipient_email)}",
        metadata={"note": req.note, "recipient_email": recipient_email}
    )
    
    if not result.success:
        raise HTTPException(status_code=400, detail=result.error)
    
    return {
        "success": True,
        "message": f"€{req.amount:.2f} an {recipient.get('name', recipient_email)} gesendet",
        "new_balance": result.new_balance,
        "reference": result.reference,
        "transaction_id": result.transaction_id,
    }


# ══════════════════════════════════════════════════════════════════════════════
# ADMIN SEND MONEY - NO FEE/PROVISION (Admin schenkt Geld an Kunden)
# ══════════════════════════════════════════════════════════════════════════════
class AdminSendRequest(BaseModel):
    recipient_email: str
    amount: float
    note: Optional[str] = "Geschenk vom Admin"

@router.post("/admin/send")
async def admin_send_money(req: AdminSendRequest, request: Request):
    """Admin sends money to a user - NO FEES, direct credit to recipient wallet.
    Admin's wallet is NOT debited - this is essentially 'creating' money for users."""
    user = await get_current_user(request)
    
    # ONLY ADMIN CAN USE THIS ENDPOINT
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Nur Admin kann diese Funktion nutzen")
    
    # Validate amount
    if req.amount < 0.01:
        raise HTTPException(status_code=400, detail="Mindestbetrag: €0.01")
    if req.amount > 100000:
        raise HTTPException(status_code=400, detail="Maximalbetrag: €100.000")
    
    # Find recipient
    recipient_email = req.recipient_email.lower().strip()
    recipient = await db.users.find_one({"email": recipient_email})
    if not recipient:
        raise HTTPException(status_code=404, detail="Empfänger nicht gefunden. Bitte E-Mail überprüfen.")
    
    recipient_id = str(recipient["_id"])
    
    # Direct credit to recipient wallet (no debit from admin, no fees)
    from core.payment_engine import credit_wallet, TransactionType
    
    result = await credit_wallet(
        user_id=recipient_id,
        amount=req.amount,
        tx_type=TransactionType.ADMIN_CREDIT,
        description=f"Admin-Geschenk: {req.note or 'Gutschrift'}",
        metadata={
            "admin_id": str(user["_id"]),
            "admin_email": user.get("email"),
            "note": req.note,
            "type": "admin_gift",
            "no_fee": True
        }
    )
    
    if not result.success:
        raise HTTPException(status_code=400, detail=result.error)
    
    return {
        "success": True,
        "message": f"€{req.amount:.2f} an {recipient.get('name', recipient_email)} gesendet (ohne Provision)",
        "recipient_name": recipient.get("name", recipient_email),
        "recipient_new_balance": result.new_balance,
        "reference": result.reference,
        "transaction_id": result.transaction_id,
    }

