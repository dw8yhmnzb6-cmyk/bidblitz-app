"""BidBlitz V2 - BlitzPay NFC contactless payment system."""
from datetime import datetime, timezone
import hashlib
import secrets

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from core.canonical_wallet_service import request_hash_for
from core.database import db
from core.payment_engine import credit_wallet, debit_wallet, TransactionType
from core.security import get_current_user

router = APIRouter(prefix="/api/blitzpay", tags=["blitzpay-nfc"])


class NFCPayment(BaseModel):
    nfc_token: str
    amount: float = Field(..., gt=0, le=10000)
    merchant_id: str = ""
    description: str = ""
    idempotency_key: str = ""


class GenerateNFCToken(BaseModel):
    pin: str = ""


class MerchantCharge(BaseModel):
    customer_nfc_token: str
    amount: float = Field(..., gt=0, le=10000)
    description: str = ""
    idempotency_key: str = ""


def _intent_key(req, request: Request, operation: str, actor_id: str) -> str:
    supplied = (getattr(req, "idempotency_key", "") or request.headers.get("Idempotency-Key") or "").strip()
    payload = req.model_dump(exclude={"idempotency_key"})
    return supplied or request_hash_for(operation, {"actor_id": actor_id, "payload": payload})


def _tx_id(operation: str, actor_id: str, intent: str) -> str:
    return "nfc_" + request_hash_for(operation, {"actor_id": actor_id, "intent": intent})[:16]


async def _record_token_use(token: str, tx_id: str, amount: float):
    await db.nfc_tokens.update_one(
        {"nfc_token": token, "payment_markers": {"$ne": tx_id}},
        {"$set": {"last_used": datetime.now(timezone.utc).isoformat()},
         "$inc": {"total_payments": 1, "total_spent": amount},
         "$addToSet": {"payment_markers": tx_id}},
    )


@router.post("/generate-token")
async def generate_nfc_token(req: GenerateNFCToken, request: Request):
    user = await get_current_user(request)
    email = user.get("email", "")
    raw = f"{email}:{secrets.token_hex(16)}:{datetime.now(timezone.utc).isoformat()}"
    token = hashlib.sha256(raw.encode()).hexdigest()[:24].upper()
    formatted = f"BPY-{token[:4]}-{token[4:8]}-{token[8:12]}"
    nfc_data = {"user_email": email, "nfc_token": formatted,
                "pin_hash": hashlib.sha256(req.pin.encode()).hexdigest() if req.pin else None,
                "active": True, "created_at": datetime.now(timezone.utc).isoformat(), "last_used": None,
                "total_payments": 0, "total_spent": 0, "payment_markers": []}
    await db.nfc_tokens.update_many({"user_email": email}, {"$set": {"active": False}})
    await db.nfc_tokens.insert_one(nfc_data)
    return {"ok": True, "nfc_token": formatted, "message": "NFC-Token generiert! Halte dein Handy ans Terminal."}


@router.get("/my-token")
async def get_my_token(request: Request):
    user = await get_current_user(request)
    token = await db.nfc_tokens.find_one({"user_email": user.get("email", ""), "active": True}, {"_id": 0})
    if not token: return {"has_token": False, "token": None}
    return {"has_token": True, "token": token["nfc_token"], "total_payments": token.get("total_payments", 0),
            "total_spent": round(token.get("total_spent", 0), 2), "last_used": token.get("last_used")}


@router.post("/pay")
async def nfc_payment(req: NFCPayment, request: Request):
    token_doc = await db.nfc_tokens.find_one({"nfc_token": req.nfc_token, "active": True})
    if not token_doc: raise HTTPException(404, "NFC-Token ungültig")
    user = await db.users.find_one({"email": token_doc["user_email"]})
    if not user: raise HTTPException(404, "User nicht gefunden")
    user_id = str(user["_id"])
    intent = _intent_key(req, request, "blitzpay_payment", user_id)
    tx_id = _tx_id("blitzpay_payment", user_id, intent)
    existing = await db.nfc_transactions.find_one({"_id": tx_id}, {"_id": 0})
    if existing:
        fresh = await db.users.find_one({"_id": user["_id"]}, {"balance": 1}) or {}
        return {"ok": True, "amount": req.amount, "new_balance": float(fresh.get("balance", 0)),
                "tx_id": tx_id, "message": f"€{req.amount:.2f} bezahlt via BlitzPay NFC!", "idempotent_replay": True}
    debit = await debit_wallet(
        user_id=user_id, amount=req.amount, tx_type=TransactionType.PAYMENT,
        description=req.description or "NFC Kontaktlos-Zahlung", reference=tx_id,
        metadata={"merchant_id": req.merchant_id, "nfc_token": req.nfc_token},
        idempotency_key=f"blitzpay:{tx_id}:debit",
    )
    if not debit.success:
        code = 409 if str(getattr(debit.status, "value", debit.status)) in {"pending", "reconciliation_required"} else 400
        raise HTTPException(code, debit.error or "Nicht genug Guthaben")
    await _record_token_use(req.nfc_token, tx_id, req.amount)
    tx = {"_id": tx_id, "tx_id": tx_id, "type": "nfc_payment", "user_email": token_doc["user_email"],
          "merchant_id": req.merchant_id, "amount": req.amount, "description": req.description or "NFC Kontaktlos-Zahlung",
          "nfc_token": req.nfc_token, "wallet_transaction_id": debit.transaction_id,
          "status": "completed", "created_at": datetime.now(timezone.utc).isoformat()}
    await db.nfc_transactions.update_one({"_id": tx_id}, {"$setOnInsert": tx}, upsert=True)
    return {"ok": True, "amount": req.amount, "new_balance": debit.new_balance, "tx_id": tx_id,
            "message": f"€{req.amount:.2f} bezahlt via BlitzPay NFC!", "idempotent_replay": debit.idempotent_replay}


@router.post("/merchant-charge")
async def merchant_charge(req: MerchantCharge, request: Request):
    merchant = await get_current_user(request)
    if merchant.get("role") not in ["merchant", "admin"]: raise HTTPException(403, "Nur Händler können Zahlungen anfordern")
    token_doc = await db.nfc_tokens.find_one({"nfc_token": req.customer_nfc_token, "active": True})
    if not token_doc: raise HTTPException(404, "Kunden-NFC-Token ungültig")
    customer = await db.users.find_one({"email": token_doc["user_email"]})
    merchant_doc = await db.users.find_one({"email": merchant.get("email", "")})
    if not customer: raise HTTPException(404, "Kunde nicht gefunden")
    if not merchant_doc: raise HTTPException(404, "Händler-Wallet nicht gefunden")
    customer_id, merchant_id = str(customer["_id"]), str(merchant_doc["_id"])
    intent = _intent_key(req, request, "blitzpay_merchant_charge", merchant_id)
    tx_id = _tx_id("blitzpay_merchant_charge", merchant_id, intent)
    existing = await db.nfc_transactions.find_one({"_id": tx_id}, {"_id": 0})
    if existing:
        return {"ok": True, "amount": req.amount, "fee": existing["fee"], "tx_id": tx_id,
                "message": f"€{req.amount:.2f} von Kunde eingezogen!", "idempotent_replay": True}
    debit = await debit_wallet(
        user_id=customer_id, amount=req.amount, tx_type=TransactionType.MERCHANT_PAYMENT,
        description=req.description or "Händler NFC-Zahlung", reference=tx_id,
        metadata={"merchant_id": merchant_id, "merchant_email": merchant.get("email", "")},
        idempotency_key=f"blitzpay:{tx_id}:debit",
    )
    if not debit.success:
        code = 409 if str(getattr(debit.status, "value", debit.status)) in {"pending", "reconciliation_required"} else 400
        raise HTTPException(code, debit.error or "Kunde hat nicht genug Guthaben")
    merchant_amount = round(req.amount * 0.97, 2)
    credit = await credit_wallet(
        user_id=merchant_id, amount=merchant_amount, tx_type=TransactionType.MERCHANT_PAYMENT_RECEIVED,
        description=req.description or "Händler NFC-Zahlung", reference=tx_id,
        metadata={"customer_id": customer_id, "customer_email": token_doc["user_email"]},
        idempotency_key=f"blitzpay:{tx_id}:credit",
    )
    if not credit.success:
        status = str(getattr(credit.status, "value", credit.status))
        if status in {"pending", "reconciliation_required"}:
            raise HTTPException(409, credit.error or "Händler-Gutschrift wird geprüft")
        refund = await credit_wallet(
            user_id=customer_id, amount=req.amount, tx_type=TransactionType.REFUND,
            description="BlitzPay Händlergutschrift fehlgeschlagen", reference=tx_id,
            metadata={"merchant_id": merchant_id}, idempotency_key=f"blitzpay:{tx_id}:refund",
        )
        raise HTTPException(409, "Zahlung konnte nicht abgeschlossen werden" if refund.success else "Zahlung benötigt manuelle Abstimmung")
    await _record_token_use(req.customer_nfc_token, tx_id, req.amount)
    fee = round(req.amount - merchant_amount, 2)
    tx = {"_id": tx_id, "tx_id": tx_id, "type": "merchant_nfc_charge", "user_email": token_doc["user_email"],
          "merchant_email": merchant.get("email", ""), "amount": req.amount, "fee": fee,
          "merchant_amount": merchant_amount, "description": req.description or "Händler NFC-Zahlung",
          "customer_wallet_transaction_id": debit.transaction_id, "merchant_wallet_transaction_id": credit.transaction_id,
          "status": "completed", "created_at": datetime.now(timezone.utc).isoformat()}
    await db.nfc_transactions.update_one({"_id": tx_id}, {"$setOnInsert": tx}, upsert=True)
    return {"ok": True, "amount": req.amount, "fee": fee, "tx_id": tx_id,
            "message": f"€{req.amount:.2f} von Kunde eingezogen!", "idempotent_replay": debit.idempotent_replay or credit.idempotent_replay}


@router.get("/history")
async def nfc_history(request: Request):
    user = await get_current_user(request)
    email = user.get("email", "")
    txs = await db.nfc_transactions.find({"$or": [{"user_email": email}, {"merchant_email": email}]}, {"_id": 0}).sort("created_at", -1).to_list(30)
    total = sum(t["amount"] for t in txs if t.get("user_email") == email)
    return {"transactions": txs, "total_spent": round(total, 2), "count": len(txs)}


@router.post("/deactivate")
async def deactivate_token(request: Request):
    user = await get_current_user(request)
    result = await db.nfc_tokens.update_many({"user_email": user.get("email", ""), "active": True},
                                             {"$set": {"active": False, "deactivated_at": datetime.now(timezone.utc).isoformat()}})
    return {"ok": True, "deactivated": result.modified_count, "message": "NFC-Token deaktiviert!"}
