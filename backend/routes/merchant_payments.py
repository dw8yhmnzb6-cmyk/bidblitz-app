"""
BidBlitz V2 - Merchant-to-Merchant (M2M) Payments
Händler können direkt an andere Händler bezahlen.
Use Cases: Lieferanten bezahlen, B2B Services, Geschäftspartner-Transaktionen.
"""
import hashlib
import secrets
from datetime import datetime, timezone
from typing import Optional
from bson import ObjectId
from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel, Field

from core.database import db
from core.security import get_current_user
from core.rate_limit import limiter
from core.audit import log_audit, AuditEvent, get_client_info
from core.payment_engine import transfer_between_wallets, TransactionType

router = APIRouter(prefix="/api/merchant-payments", tags=["merchant-payments"])


class MerchantPaymentRequest(BaseModel):
    recipient_merchant_id: str = Field(..., description="Empfänger Händler User ID")
    amount: float = Field(..., gt=0, description="Betrag in EUR")
    description: str = Field(..., max_length=200, description="Zahlungsgrund")
    reference: Optional[str] = Field(None, max_length=50, description="Referenznummer (optional)")
    invoice_number: Optional[str] = Field(None, max_length=50, description="Rechnungsnummer (optional)")
    idempotency_key: Optional[str] = Field(None, min_length=8, max_length=120, description="Idempotency Key")


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
            "direction": "debit",
        },
        {"_id": 0, "metadata.recipient_id": 1, "metadata.counterparty_user_id": 1}
    ).sort("created_at", -1).limit(20).to_list(20)
    
    recipient_ids = []
    for tx in recent_txs:
        meta = tx.get("metadata") or {}
        recipient_id = meta.get("recipient_id") or meta.get("counterparty_user_id")
        if recipient_id and recipient_id not in recipient_ids:
            recipient_ids.append(recipient_id)
        if len(recipient_ids) >= 10:
            break
    
    if not recipient_ids:
        return {"merchants": [], "count": 0}
    
    # Hole Händler-Details
    merchants = await db.users.find(
        {"_id": {"$in": [ObjectId(rid) for rid in recipient_ids if ObjectId.is_valid(rid)]}},
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
    
    # Verified merchants only.
    if user.get("kyc_status") != "approved":
        raise HTTPException(status_code=403, detail="KYC-Verifizierung erforderlich")

    # Validierung: Nicht an sich selbst zahlen
    if req.recipient_merchant_id == user_id:
        raise HTTPException(status_code=400, detail="Sie können nicht an sich selbst zahlen")
    if not ObjectId.is_valid(req.recipient_merchant_id):
        raise HTTPException(status_code=400, detail="Ungültige Händler-ID")

    idempotency_key = (req.idempotency_key or request.headers.get("Idempotency-Key") or "").strip()
    if len(idempotency_key) < 8:
        raise HTTPException(status_code=400, detail="Idempotency-Key erforderlich")
    
    # Check Empfänger existiert und ist Merchant
    recipient = await db.users.find_one(
        {"_id": ObjectId(req.recipient_merchant_id)},
        {"_id": 0}
    )
    
    if not recipient:
        raise HTTPException(status_code=404, detail="Empfänger nicht gefunden")
    
    if recipient.get("role") != "merchant" or recipient.get("kyc_status") != "approved":
        raise HTTPException(status_code=400, detail="Empfänger ist kein verifizierter Händler")
    
    # Check Sender Balance
    if user.get("balance", 0) < req.amount:
        raise HTTPException(
            status_code=400,
            detail=f"Unzureichendes Guthaben. Verfügbar: €{user.get('balance', 0):.2f}"
        )
    
    # Stable reference + one canonical exactly-once wallet transfer.
    tx_reference = req.reference or (
        "M2M-" + hashlib.sha256(idempotency_key.encode("utf-8")).hexdigest()[:12].upper()
    )
    transfer_result = await transfer_between_wallets(
        from_user_id=user_id,
        to_user_id=req.recipient_merchant_id,
        amount=req.amount,
        tx_type=TransactionType.MERCHANT_PAYMENT,
        description=f"Händlerzahlung: {req.description}",
        reference=tx_reference,
        metadata={
            "recipient_id": req.recipient_merchant_id,
            "recipient_name": recipient.get("name"),
            "recipient_email": recipient.get("email"),
            "sender_id": user_id,
            "sender_name": user.get("name"),
            "sender_email": user.get("email"),
            "invoice_number": req.invoice_number,
            "kind": "merchant_to_merchant",
            "audit_metadata": {"route": "merchant_payments.pay"},
        },
        idempotency_key=f"merchant-pay:{idempotency_key}",
    )
    if not transfer_result.success:
        await log_audit(
            AuditEvent.MERCHANT_PAYMENT_FAILED,
            user_id=user_id,
            email=user.get("email", ""),
            ip=ip,
            user_agent=ua,
            details={
                "recipient_id": req.recipient_merchant_id,
                "amount": req.amount,
                "error": transfer_result.error,
                "status": transfer_result.status.value,
            },
            severity="error",
        )
        status_code = 503 if transfer_result.status.value in {"pending", "reconciliation_required"} else 400
        raise HTTPException(status_code=status_code, detail=transfer_result.error or "Zahlung fehlgeschlagen")
    
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
    
    # Send notification only once; retries reuse the canonical transfer.
    if not transfer_result.idempotent_replay:
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
        try:
            from routes.web_push import send_push_to_user
            await send_push_to_user(
                user_id=req.recipient_merchant_id,
                title=f"€{req.amount:.2f} erhalten!",
                body=f"Von {user.get('business_name') or user.get('name')}",
                icon="/logo192.png",
                data={"type": "merchant_payment", "reference": tx_reference},
            )
        except Exception:
            pass

    return {
        "success": True,
        "reference": tx_reference,
        "amount": req.amount,
        "recipient": {
            "id": req.recipient_merchant_id,
            "name": recipient.get("name"),
            "business_name": recipient.get("business_name"),
        },
        "new_balance": round(float(transfer_result.new_balance or 0), 2),
        "idempotent_replay": transfer_result.idempotent_replay,
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
            "direction": {"$in": ["debit", None]},
        },
        {"_id": 0}
    ).sort("created_at", -1).limit(50).to_list(50)
    
    # Empfangene Zahlungen
    received = await db.transactions.find(
        {
            "user_id": user_id,
            "$or": [
                {"type": "merchant_payment_received"},
                {"type": "merchant_payment", "direction": "credit"},
            ],
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
        {"user_id": user_id, "type": "merchant_payment", "status": "completed", "direction": {"$in": ["debit", None]}},
        {"_id": 0, "amount": 1}
    ).to_list(1000)
    
    total_sent = sum(abs(float(tx.get("amount", 0) or 0)) for tx in sent_txs)
    
    # Empfangene Zahlungen
    received_txs = await db.transactions.find(
        {
            "user_id": user_id,
            "status": "completed",
            "$or": [
                {"type": "merchant_payment_received"},
                {"type": "merchant_payment", "direction": "credit"},
            ],
        },
        {"_id": 0, "amount": 1}
    ).to_list(1000)
    
    total_received = sum(abs(float(tx.get("amount", 0) or 0)) for tx in received_txs)
    
    return {
        "total_sent": round(total_sent, 2),
        "total_received": round(total_received, 2),
        "net": round(total_received - total_sent, 2),
        "transactions_sent": len(sent_txs),
        "transactions_received": len(received_txs),
    }
