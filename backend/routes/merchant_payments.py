"""
BidBlitz V2 - Merchant-to-Merchant (M2M) Payments
Händler können direkt an andere Händler bezahlen.
Use Cases: Lieferanten bezahlen, B2B Services, Geschäftspartner-Transaktionen.
"""
import secrets
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel, Field

from core.database import db
from core.security import get_current_user
from core.rate_limit import limiter
from core.audit import log_audit, AuditEvent, get_client_info
from core.payment_engine import debit_wallet, credit_wallet, TransactionType

router = APIRouter(prefix="/api/merchant-payments", tags=["merchant-payments"])


class MerchantPaymentRequest(BaseModel):
    recipient_merchant_id: str = Field(..., description="Empfänger Händler User ID")
    amount: float = Field(..., gt=0, description="Betrag in EUR")
    description: str = Field(..., max_length=200, description="Zahlungsgrund")
    reference: Optional[str] = Field(None, max_length=50, description="Referenznummer (optional)")
    invoice_number: Optional[str] = Field(None, max_length=50, description="Rechnungsnummer (optional)")


class MerchantSearchRequest(BaseModel):
    query: str = Field(..., min_length=2, max_length=100, description="Suchbegriff (Name, Email, Merchant ID)")


@router.get("/merchants/search")
@limiter.limit("30/minute")
async def search_merchants(query: str, request: Request):
    """
    Suche nach Händlern (für Zahlungsempfänger).
    Nur für verifizierte Merchants verfügbar.
    """
    user = await get_current_user(request)
    
    # Nur Merchants können M2M Payments nutzen
    if user.get("role") != "merchant":
        raise HTTPException(
            status_code=403, 
            detail="Nur verifizierte Händler können Händler-Zahlungen durchführen"
        )
    
    # Suche nach Händlern (Name, Email, Merchant ID)
    merchants = await db.users.find(
        {
            "role": "merchant",
            "_id": {"$ne": user["_id"]},  # Nicht sich selbst
            "$or": [
                {"name": {"$regex": query, "$options": "i"}},
                {"email": {"$regex": query, "$options": "i"}},
                {"merchant_id": {"$regex": query, "$options": "i"}},
                {"business_name": {"$regex": query, "$options": "i"}},
            ]
        },
        {
            "_id": 0,
            "id": {"$toString": "$_id"},
            "name": 1,
            "email": 1,
            "business_name": 1,
            "merchant_id": 1,
            "profile_picture": 1,
        }
    ).to_list(20)
    
    return {"merchants": merchants, "count": len(merchants)}


@router.get("/merchants/recent")
async def get_recent_merchant_contacts(request: Request):
    """
    Holt die letzten Händler, an die User Geld gesendet hat.
    """
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    if user.get("role") != "merchant":
        raise HTTPException(status_code=403, detail="Nur für Händler")
    
    # Finde letzte M2M Transaktionen
    recent_txs = await db.transactions.find(
        {
            "user_id": user_id,
            "type": "merchant_payment",
            "status": "completed",
        },
        {"_id": 0, "recipient_id": 1}
    ).sort("created_at", -1).limit(10).to_list(10)
    
    recipient_ids = list(set([tx["recipient_id"] for tx in recent_txs if "recipient_id" in tx]))
    
    if not recipient_ids:
        return {"merchants": [], "count": 0}
    
    # Hole Händler-Details
    merchants = await db.users.find(
        {"_id": {"$in": [db.ObjectId(rid) for rid in recipient_ids]}},
        {
            "_id": 0,
            "id": {"$toString": "$_id"},
            "name": 1,
            "email": 1,
            "business_name": 1,
            "merchant_id": 1,
            "profile_picture": 1,
        }
    ).to_list(10)
    
    return {"merchants": merchants, "count": len(merchants)}


@router.post("/pay")
@limiter.limit("10/minute")
async def pay_merchant(req: MerchantPaymentRequest, request: Request):
    """
    Sende Geld von einem Händler an einen anderen Händler.
    Direkte Wallet-to-Wallet Überweisung.
    """
    user = await get_current_user(request)
    user_id = str(user["_id"])
    ip, ua = get_client_info(request)
    
    # Nur Merchants
    if user.get("role") != "merchant":
        raise HTTPException(
            status_code=403,
            detail="Nur verifizierte Händler können M2M Zahlungen durchführen"
        )
    
    # Validierung: Nicht an sich selbst zahlen
    if req.recipient_merchant_id == user_id:
        raise HTTPException(status_code=400, detail="Sie können nicht an sich selbst zahlen")
    
    # Check Empfänger existiert und ist Merchant
    recipient = await db.users.find_one(
        {"_id": db.ObjectId(req.recipient_merchant_id)},
        {"_id": 0}
    )
    
    if not recipient:
        raise HTTPException(status_code=404, detail="Empfänger nicht gefunden")
    
    if recipient.get("role") != "merchant":
        raise HTTPException(status_code=400, detail="Empfänger ist kein verifizierter Händler")
    
    # Check Sender Balance
    if user.get("balance", 0) < req.amount:
        raise HTTPException(
            status_code=400,
            detail=f"Unzureichendes Guthaben. Verfügbar: €{user.get('balance', 0):.2f}"
        )
    
    # Generiere Transaction Reference
    tx_reference = req.reference or f"M2M-{secrets.token_hex(6).upper()}"
    
    # ── Atomic Transaction: Debit Sender + Credit Recipient ──
    try:
        # 1. Debit Sender
        debit_result = await debit_wallet(
            user_id=user_id,
            amount=req.amount,
            transaction_type=TransactionType.MERCHANT_PAYMENT,
            description=f"Zahlung an {recipient.get('business_name') or recipient.get('name')}: {req.description}",
            reference=tx_reference,
            metadata={
                "recipient_id": req.recipient_merchant_id,
                "recipient_name": recipient.get("name"),
                "recipient_email": recipient.get("email"),
                "invoice_number": req.invoice_number,
            }
        )
        
        if not debit_result["success"]:
            raise HTTPException(status_code=400, detail=debit_result["error"])
        
        # 2. Credit Recipient
        credit_result = await credit_wallet(
            user_id=req.recipient_merchant_id,
            amount=req.amount,
            transaction_type=TransactionType.MERCHANT_PAYMENT_RECEIVED,
            description=f"Zahlung von {user.get('business_name') or user.get('name')}: {req.description}",
            reference=tx_reference,
            metadata={
                "sender_id": user_id,
                "sender_name": user.get("name"),
                "sender_email": user.get("email"),
                "invoice_number": req.invoice_number,
            }
        )
        
        if not credit_result["success"]:
            # Rollback: Credit sender back
            await credit_wallet(
                user_id=user_id,
                amount=req.amount,
                transaction_type=TransactionType.REFUND,
                description=f"Rückerstattung: M2M Zahlung fehlgeschlagen",
                reference=f"ROLLBACK-{tx_reference}",
            )
            raise HTTPException(status_code=500, detail="Zahlung fehlgeschlagen - wurde rückgängig gemacht")
        
    except Exception as e:
        await log_audit(
            AuditEvent.MERCHANT_PAYMENT_FAILED,
            user_id=user_id,
            email=user.get("email", ""),
            ip=ip,
            user_agent=ua,
            details={
                "recipient_id": req.recipient_merchant_id,
                "amount": req.amount,
                "error": str(e),
            },
            severity="error"
        )
        raise HTTPException(status_code=500, detail="Zahlung fehlgeschlagen")
    
    # Audit Log
    await log_audit(
        AuditEvent.MERCHANT_PAYMENT_SUCCESS,
        user_id=user_id,
        email=user.get("email", ""),
        ip=ip,
        user_agent=ua,
        details={
            "recipient_id": req.recipient_merchant_id,
            "recipient_email": recipient.get("email"),
            "amount": req.amount,
            "reference": tx_reference,
            "description": req.description,
        }
    )
    
    # Send notification to recipient
    await db.notifications.insert_one({
        "id": secrets.token_hex(8),
        "user_id": req.recipient_merchant_id,
        "type": "merchant_payment_received",
        "title": f"€{req.amount:.2f} erhalten!",
        "message": f"Von {user.get('business_name') or user.get('name')}: {req.description}",
        "data": {
            "amount": req.amount,
            "sender_id": user_id,
            "sender_name": user.get("name"),
            "reference": tx_reference,
        },
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    
    # Optional: Send Push Notification
    try:
        from routes.web_push import send_push_to_user
        await send_push_to_user(
            user_id=req.recipient_merchant_id,
            title=f"€{req.amount:.2f} erhalten!",
            body=f"Von {user.get('business_name') or user.get('name')}",
            icon="/logo192.png",
            data={"type": "merchant_payment", "reference": tx_reference}
        )
    except Exception:
        pass  # Non-critical
    
    return {
        "success": True,
        "reference": tx_reference,
        "amount": req.amount,
        "recipient": {
            "id": req.recipient_merchant_id,
            "name": recipient.get("name"),
            "business_name": recipient.get("business_name"),
        },
        "new_balance": user.get("balance", 0) - req.amount,
    }


@router.get("/history")
async def get_merchant_payment_history(request: Request):
    """
    Holt M2M Payment History (gesendete + empfangene Zahlungen).
    """
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    if user.get("role") != "merchant":
        raise HTTPException(status_code=403, detail="Nur für Händler")
    
    # Gesendete Zahlungen
    sent = await db.transactions.find(
        {
            "user_id": user_id,
            "type": "merchant_payment",
        },
        {"_id": 0}
    ).sort("created_at", -1).limit(50).to_list(50)
    
    # Empfangene Zahlungen
    received = await db.transactions.find(
        {
            "user_id": user_id,
            "type": "merchant_payment_received",
        },
        {"_id": 0}
    ).sort("created_at", -1).limit(50).to_list(50)
    
    return {
        "sent": sent,
        "received": received,
        "total_sent": len(sent),
        "total_received": len(received),
    }


@router.get("/stats")
async def get_merchant_payment_stats(request: Request):
    """
    Statistiken zu M2M Zahlungen (gesendeter/empfangener Betrag).
    """
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    if user.get("role") != "merchant":
        raise HTTPException(status_code=403, detail="Nur für Händler")
    
    # Gesendete Zahlungen
    sent_txs = await db.transactions.find(
        {"user_id": user_id, "type": "merchant_payment", "status": "completed"},
        {"_id": 0, "amount": 1}
    ).to_list(1000)
    
    total_sent = sum(tx.get("amount", 0) for tx in sent_txs)
    
    # Empfangene Zahlungen
    received_txs = await db.transactions.find(
        {"user_id": user_id, "type": "merchant_payment_received", "status": "completed"},
        {"_id": 0, "amount": 1}
    ).to_list(1000)
    
    total_received = sum(tx.get("amount", 0) for tx in received_txs)
    
    return {
        "total_sent": round(total_sent, 2),
        "total_received": round(total_received, 2),
        "net": round(total_received - total_sent, 2),
        "transactions_sent": len(sent_txs),
        "transactions_received": len(received_txs),
    }
