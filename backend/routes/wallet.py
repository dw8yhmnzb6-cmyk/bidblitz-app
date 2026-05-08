from fastapi import APIRouter, HTTPException, Request
from bson import ObjectId
from datetime import datetime, timezone
from core.database import db
from core.security import get_current_user, serialize_user
from core.performance import user_cache, invalidate_user_cache
from schemas.models import TopUpRequest
import secrets

router = APIRouter(prefix="/api/wallet", tags=["wallet"])

# ═══════════════════════════════════════════════════════════════════════════════
# REALISTIC LIMITS - NO FAKE NUMBERS!
# ═══════════════════════════════════════════════════════════════════════════════
MAX_TOPUP_AMOUNT = 10000.0       # Max 10.000 EUR per top-up (realistic for retail)
DAILY_TOPUP_LIMIT = 25000.0      # Max 25.000 EUR per day
ADMIN_APPROVAL_AMOUNT = 5000.0   # Require admin approval for > 5.000 EUR


def generate_reference():
    return f"BLZ-{secrets.token_hex(4).upper()}"


def _ensure_kyc(user: dict):
    """Block wallet writes until KYC is approved (admins exempt)."""
    if user.get("role") == "admin":
        return
    if user.get("kyc_status") != "approved":
        raise HTTPException(
            status_code=403,
            detail={
                "error": "kyc_required",
                "message": "Bitte verifiziere zuerst deinen Ausweis, um Wallet-Aktionen durchzuführen.",
                "kyc_status": user.get("kyc_status", "not_started"),
            },
        )


@router.get("/balance")
async def get_balance(request: Request):
    """Get user's wallet balance - optimized with minimal DB read."""
    user = await get_current_user(request)
    return {
        "balance": round(user.get("balance", 0.0), 2),
        "currency": user.get("currency", "EUR"),
    }


@router.get("/balance/total")
async def get_total_balance(request: Request):
    """
    Get user's COMPLETE REAL balance:
    - EUR wallet balance
    - Crypto wallet balances (in EUR)
    - Crypto Earn deposits (in EUR)
    = TOTAL REAL BALANCE (wie auf bidblitz.ae angezeigt!)
    """
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    # 1. EUR Wallet Balance
    eur_balance = user.get("balance", 0.0)
    
    # 2. Crypto Wallet Balances (convert to EUR)
    from routes.crypto_prices import get_eur_value
    
    crypto_wallets = await db.crypto_wallets.find(
        {"user_id": user_id},
        {"_id": 0, "coin": 1, "balance": 1, "locked_balance": 1}
    ).to_list(100)
    
    crypto_total_eur = 0.0
    crypto_breakdown = []
    
    for wallet in crypto_wallets:
        coin = wallet.get("coin")
        balance = wallet.get("balance", 0)
        locked = wallet.get("locked_balance", 0)
        total_crypto = balance + locked
        
        if total_crypto > 0:
            eur_value = get_eur_value(coin, total_crypto)
            crypto_total_eur += eur_value
            
            crypto_breakdown.append({
                "coin": coin,
                "amount": total_crypto,
                "available": balance,
                "locked_in_earn": locked,
                "value_eur": round(eur_value, 2)
            })
    
    # 3. Crypto Earn Active Deposits (calculate earned interest)
    earn_deposits = await db.crypto_earn_deposits.find(
        {"user_id": user_id, "status": "active"},
        {"_id": 0, "coin": 1, "amount": 1, "earned": 1, "apy": 1, "created_at": 1}
    ).to_list(100)
    
    earn_breakdown = []
    
    for dep in earn_deposits:
        # Calculate current earned interest
        from datetime import datetime, timezone
        days_elapsed = (datetime.now(timezone.utc) - datetime.fromisoformat(dep["created_at"])).days
        if days_elapsed < 1:
            days_elapsed = (datetime.now(timezone.utc) - datetime.fromisoformat(dep["created_at"])).total_seconds() / 86400
        
        daily_rate = dep.get("apy", 0) / 100 / 365
        earned = dep.get("amount", 0) * daily_rate * days_elapsed
        
        earn_breakdown.append({
            "coin": dep.get("coin"),
            "principal": dep.get("amount", 0),
            "earned": round(earned, 8),
            "apy": dep.get("apy", 0),
            "days": round(days_elapsed, 1)
        })
    
    # TOTAL BALANCE (EUR + Crypto in EUR)
    total_balance = eur_balance + crypto_total_eur
    
    return {
        "eur_balance": round(eur_balance, 2),
        "crypto_balance_eur": round(crypto_total_eur, 2),
        "total_balance_eur": round(total_balance, 2),
        "crypto_breakdown": crypto_breakdown,
        "earn_breakdown": earn_breakdown,
        "currency": "EUR",
        "note": "Total includes EUR wallet + crypto wallets (converted to EUR at current rates)"
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


@router.get("/balance")
async def get_wallet_balance(request: Request):
    """Get just the wallet balance - fast endpoint."""
    user = await get_current_user(request)
    return {
        "balance": round(user.get("balance", 0.0), 2),
        "currency": user.get("currency", "EUR"),
    }


@router.post("/topup")
async def topup(req: TopUpRequest, request: Request):
    user = await get_current_user(request)
    _ensure_kyc(user)
    user_id = str(user["_id"])
    ref = generate_reference()

    # ═══════════════════════════════════════════════════════════════════════════════
    # REALISTIC VALIDATION - NO FAKE NUMBERS!
    # ═══════════════════════════════════════════════════════════════════════════════
    
    # 1. Check maximum amount (NO MORE 1.3M EUR!)
    if req.amount > MAX_TOPUP_AMOUNT:
        raise HTTPException(
            400, 
            f"⚠️ Maximalbetrag überschritten! Max pro Aufladung: EUR {MAX_TOPUP_AMOUNT:,.2f}. "
            f"Für größere Beträge kontaktiere bitte den Support."
        )
    
    # 2. Check daily limit
    from datetime import timedelta
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    today_topups = await db.transactions.find({
        "user_id": user_id,
        "type": "topup",
        "status": "completed",
        "created_at": {"$gte": today_start.isoformat()}
    }).to_list(100)
    
    total_today = sum(t.get("amount", 0) for t in today_topups)
    if (total_today + req.amount) > DAILY_TOPUP_LIMIT:
        raise HTTPException(
            400,
            f"⚠️ Tageslimit erreicht! Heute bereits EUR {total_today:,.2f} aufgeladen. "
            f"Maximales Tageslimit: EUR {DAILY_TOPUP_LIMIT:,.2f}"
        )
    
    # 3. Check if needs admin approval
    needs_approval = req.amount > ADMIN_APPROVAL_AMOUNT
    
    if needs_approval:
        # Create pending transaction
        txn = {
            "id": secrets.token_hex(8),
            "user_id": user_id,
            "type": "topup",
            "amount": req.amount,
            "description": f"Top-up via {req.payment_method} (Pending Approval)",
            "merchant_name": "",
            "status": "pending_approval",
            "reference": ref,
            "payment_method": req.payment_method,
            "category": "topup",
            "needs_admin_approval": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.transactions.insert_one(txn)
        
        # Notify admins
        await db.notifications.insert_one({
            "user_id": "admin",
            "type": "admin_action_required",
            "title": f"🔔 Top-Up Approval: EUR {req.amount:,.2f}",
            "message": f"User {user.get('email')} möchte EUR {req.amount:,.2f} aufladen. Approval erforderlich.",
            "data": {"transaction_id": txn["id"], "user_email": user.get("email")},
            "read": False,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        
        return {
            "ok": True,
            "message": f"⏳ Aufladung von EUR {req.amount:,.2f} wartet auf Admin-Freigabe. Du wirst benachrichtigt!",
            "pending_approval": True,
            "transaction": txn
        }

    # Update balance (only if no approval needed)
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
    _ensure_kyc(user)
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




# ═══════════════════════════════════════════════════════════════════════════════
# SAVED RECIPIENTS (Gespeicherte Empfänger)
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/saved-recipients")
async def get_saved_recipients(request: Request):
    """Get all saved recipients for current user"""
    user = await get_current_user(request)
    user_id = user.get("email")
    
    recipients = await db.saved_recipients.find(
        {"user_id": user_id}, {"_id": 0}
    ).sort("last_used", -1).to_list(100)
    
    return {"recipients": recipients, "count": len(recipients)}


@router.post("/saved-recipients")
async def add_saved_recipient(request: Request):
    """Add new saved recipient"""
    user = await get_current_user(request)
    user_id = user.get("email")
    body = await request.json()
    
    recipient_number = body.get("recipient_number")
    nickname = body.get("nickname", "")
    icon = body.get("icon", "user")
    
    if not recipient_number:
        raise HTTPException(status_code=400, detail="Empfänger-Nummer fehlt")
    
    # Find recipient by number
    recipient_user = await db.users.find_one(
        {"user_number": recipient_number}, {"_id": 0}
    )
    
    if not recipient_user:
        raise HTTPException(status_code=404, detail="Empfänger nicht gefunden")
    
    if recipient_user.get("email") == user_id:
        raise HTTPException(status_code=400, detail="Du kannst dich nicht selbst speichern")
    
    # Check if already saved
    existing = await db.saved_recipients.find_one({
        "user_id": user_id,
        "recipient_id": recipient_user.get("email")
    })
    
    if existing:
        raise HTTPException(status_code=400, detail="Empfänger bereits gespeichert")
    
    now = datetime.now(timezone.utc)
    saved_id = secrets.token_hex(8)
    
    saved_recipient = {
        "id": saved_id,
        "user_id": user_id,
        "recipient_id": recipient_user.get("email"),
        "recipient_name": recipient_user.get("name") or recipient_user.get("email"),
        "recipient_number": recipient_number,
        "nickname": nickname or recipient_user.get("name"),
        "icon": icon,
        "created_at": now.isoformat(),
        "last_used": now.isoformat(),
        "transfer_count": 0,
        "total_amount_sent": 0.0
    }
    
    await db.saved_recipients.insert_one(saved_recipient)
    
    return {"ok": True, "recipient": saved_recipient}


@router.delete("/saved-recipients/{recipient_id}")
async def delete_saved_recipient(recipient_id: str, request: Request):
    """Delete saved recipient"""
    user = await get_current_user(request)
    user_id = user.get("email")
    
    result = await db.saved_recipients.delete_one({
        "id": recipient_id,
        "user_id": user_id
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Empfänger nicht gefunden")
    
    return {"ok": True}


@router.post("/transfer-by-number")
async def transfer_by_number(request: Request):
    """Transfer money by recipient number"""
    user = await get_current_user(request)
    _ensure_kyc(user)
    
    body = await request.json()
    recipient_number = body.get("recipient_number")
    amount = float(body.get("amount", 0))
    
    if not recipient_number:
        raise HTTPException(status_code=400, detail="Empfänger-Nummer fehlt")
    
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Ungültiger Betrag")
    
    if user.get("balance", 0) < amount:
        raise HTTPException(status_code=400, detail="Unzureichendes Guthaben")
    
    # Find recipient
    recipient = await db.users.find_one(
        {"user_number": recipient_number}, {"_id": 0}
    )
    
    if not recipient:
        raise HTTPException(status_code=404, detail="Empfänger nicht gefunden")
    
    sender_email = user.get("email")
    recipient_email = recipient.get("email")
    
    if sender_email == recipient_email:
        raise HTTPException(status_code=400, detail="Selbstüberweisung nicht möglich")
    
    # Execute transfer
    await db.users.update_one(
        {"email": sender_email},
        {"$inc": {"balance": -amount}}
    )
    
    await db.users.update_one(
        {"email": recipient_email},
        {"$inc": {"balance": amount}}
    )
    
    # Create transaction record
    now = datetime.now(timezone.utc)
    transaction_id = secrets.token_hex(8)
    
    transaction = {
        "transaction_id": transaction_id,
        "type": "transfer",
        "from": sender_email,
        "to": recipient_email,
        "amount": amount,
        "currency": "EUR",
        "status": "completed",
        "created_at": now.isoformat(),
        "method": "user_number"
    }
    
    await db.transactions.insert_one(transaction)
    
    # Update saved recipient stats if exists
    await db.saved_recipients.update_one(
        {"user_id": sender_email, "recipient_id": recipient_email},
        {
            "$set": {"last_used": now.isoformat()},
            "$inc": {"transfer_count": 1, "total_amount_sent": amount}
        }
    )
    
    # Invalidate caches
    invalidate_user_cache(sender_email)
    invalidate_user_cache(recipient_email)
    
    return {
        "ok": True,
        "transaction_id": transaction_id,
        "new_balance": round(user.get("balance", 0) - amount, 2),
        "recipient_name": recipient.get("name") or recipient_email
    }
