"""BidBlitz V2 - BlitzPay NFC contactless payment system."""
from datetime import datetime, timezone
import hashlib
import secrets
import os

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from core.canonical_wallet_service import request_hash_for
from core.database import db
from core.payment_engine import credit_wallet, debit_wallet, transfer_between_wallets, TransactionType
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
    pin: str = Field(default="", max_length=32)
    idempotency_key: str = ""


def _intent_key(req, request: Request, operation: str, actor_id: str) -> str:
    supplied = (getattr(req, "idempotency_key", "") or request.headers.get("Idempotency-Key") or "").strip()
    payload = req.model_dump(exclude={"idempotency_key"})
    return supplied or request_hash_for(operation, {"actor_id": actor_id, "payload": payload})


def _tx_id(operation: str, actor_id: str, intent: str) -> str:
    return "nfc_" + request_hash_for(operation, {"actor_id": actor_id, "intent": intent})[:16]


async def _blitzpay_platform_user_id():
    email = os.environ.get("PLATFORM_POOL_EMAIL", "admin@bidblitz.ae").strip().lower()
    pool = await db.users.find_one({"email": email}, {"_id": 1})
    return str(pool["_id"]) if pool else None


def _verify_token_pin(token_doc: dict, supplied_pin: str) -> None:
    pin_hash = token_doc.get("pin_hash")
    if not pin_hash:
        return
    candidate = hashlib.sha256(str(supplied_pin or "").encode()).hexdigest()
    if not secrets.compare_digest(candidate, str(pin_hash)):
        raise HTTPException(status_code=403, detail="NFC-PIN erforderlich oder ungültig")


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
    """Deprecated unsafe token-only debit path."""
    await get_current_user(request)
    raise HTTPException(
        status_code=410,
        detail="Token-only NFC-Debit ist deaktiviert. Nutze den authentifizierten Händlerpfad /api/blitzpay/merchant-charge.",
    )

@router.post("/merchant-charge")
async def merchant_charge(req: MerchantCharge, request: Request):
    """Authenticated merchant charge through platform escrow, exactly once."""
    merchant = await get_current_user(request)
    if merchant.get("role") not in ["merchant", "admin"]:
        raise HTTPException(403, "Nur Händler können Zahlungen anfordern")
    if merchant.get("role") != "admin" and merchant.get("kyc_status") != "approved":
        raise HTTPException(status_code=403, detail="KYC-Verifizierung für Händler erforderlich")

    token_doc = await db.nfc_tokens.find_one({"nfc_token": req.customer_nfc_token, "active": True})
    if not token_doc:
        raise HTTPException(404, "Kunden-NFC-Token ungültig")
    _verify_token_pin(token_doc, req.pin)

    customer = await db.users.find_one({"email": token_doc["user_email"]})
    merchant_doc = await db.users.find_one({"email": merchant.get("email", "")})
    if not customer:
        raise HTTPException(404, "Kunde nicht gefunden")
    if not merchant_doc:
        raise HTTPException(404, "Händler-Wallet nicht gefunden")

    customer_id = str(customer["_id"])
    merchant_id = str(merchant_doc["_id"])
    if customer_id == merchant_id:
        raise HTTPException(status_code=400, detail="Eigene NFC-Zahlung ist nicht erlaubt")

    intent = _intent_key(req, request, "blitzpay_merchant_charge", merchant_id)
    tx_id = _tx_id("blitzpay_merchant_charge", merchant_id, intent)
    existing = await db.nfc_transactions.find_one({"_id": tx_id}, {"_id": 0})
    if existing:
        return {
            "ok": True,
            "amount": req.amount,
            "fee": existing["fee"],
            "tx_id": tx_id,
            "message": f"€{req.amount:.2f} von Kunde eingezogen!",
            "idempotent_replay": True,
        }

    platform_id = await _blitzpay_platform_user_id()
    if not platform_id:
        raise HTTPException(status_code=503, detail="BlitzPay Settlement-Wallet ist nicht konfiguriert")
    if platform_id == customer_id:
        raise HTTPException(status_code=409, detail="Plattform-Wallet darf nicht Kunden-Wallet sein")

    gross = round(float(req.amount), 2)
    fee = round(gross * 0.03, 2)
    merchant_amount = round(gross - fee, 2)

    escrow = await transfer_between_wallets(
        from_user_id=customer_id,
        to_user_id=platform_id,
        amount=gross,
        tx_type=TransactionType.MERCHANT_PAYMENT,
        description=req.description or "Händler NFC-Zahlung",
        reference=tx_id,
        metadata={
            "kind": "blitzpay_nfc_escrow",
            "merchant_id": merchant_id,
            "customer_id": customer_id,
            "gross_amount": gross,
            "fee_amount": fee,
            "net_amount": merchant_amount,
        },
        idempotency_key=f"blitzpay:{tx_id}:escrow",
    )
    if not escrow.success:
        status = str(getattr(escrow.status, "value", escrow.status))
        raise HTTPException(
            409 if status in {"pending", "reconciliation_required"} else 400,
            escrow.error or "Kunde hat nicht genug Guthaben",
        )

    merchant_credit = None
    if merchant_id != platform_id and merchant_amount > 0:
        merchant_credit = await transfer_between_wallets(
            from_user_id=platform_id,
            to_user_id=merchant_id,
            amount=merchant_amount,
            tx_type=TransactionType.MERCHANT_PAYMENT_RECEIVED,
            description=req.description or "Händler NFC-Zahlung",
            reference=tx_id,
            metadata={
                "kind": "blitzpay_nfc_merchant_settlement",
                "customer_id": customer_id,
                "customer_email": token_doc["user_email"],
                "gross_amount": gross,
                "fee_amount": fee,
                "net_amount": merchant_amount,
            },
            idempotency_key=f"blitzpay:{tx_id}:merchant",
        )
        if not merchant_credit.success:
            await db.nfc_transactions.update_one(
                {"_id": tx_id},
                {"$setOnInsert": {
                    "_id": tx_id,
                    "tx_id": tx_id,
                    "type": "merchant_nfc_charge",
                    "user_email": token_doc["user_email"],
                    "merchant_email": merchant.get("email", ""),
                    "merchant_id": merchant_id,
                    "amount": gross,
                    "fee": fee,
                    "merchant_amount": merchant_amount,
                    "customer_wallet_transaction_id": escrow.transaction_id,
                    "status": "reconciliation_required",
                    "error": merchant_credit.error,
                    "created_at": datetime.now(timezone.utc).isoformat(),
                }},
                upsert=True,
            )
            raise HTTPException(status_code=409, detail=merchant_credit.error or "Händler-Gutschrift wird geprüft")

    await _record_token_use(req.customer_nfc_token, tx_id, gross)
    now = datetime.now(timezone.utc).isoformat()
    tx = {
        "_id": tx_id,
        "tx_id": tx_id,
        "type": "merchant_nfc_charge",
        "user_email": token_doc["user_email"],
        "customer_id": customer_id,
        "merchant_email": merchant.get("email", ""),
        "merchant_id": merchant_id,
        "amount": gross,
        "fee": fee,
        "merchant_amount": merchant_amount,
        "description": req.description or "Händler NFC-Zahlung",
        "customer_wallet_transaction_id": escrow.transaction_id,
        "merchant_wallet_transaction_id": merchant_credit.transaction_id if merchant_credit else None,
        "status": "completed",
        "created_at": now,
    }
    await db.nfc_transactions.update_one({"_id": tx_id}, {"$set": tx}, upsert=True)
    await db.platform_fees.update_one(
        {"_id": f"blitzpay:{tx_id}"},
        {"$setOnInsert": {
            "_id": f"blitzpay:{tx_id}",
            "type": "blitzpay_nfc",
            "tx_id": tx_id,
            "gross": gross,
            "merchant_amount": merchant_amount,
            "platform_fee": fee,
            "created_at": now,
        }},
        upsert=True,
    )
    return {
        "ok": True,
        "amount": gross,
        "fee": fee,
        "tx_id": tx_id,
        "message": f"€{gross:.2f} von Kunde eingezogen!",
        "idempotent_replay": bool(
            escrow.idempotent_replay
            or (merchant_credit and merchant_credit.idempotent_replay)
        ),
    }

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
