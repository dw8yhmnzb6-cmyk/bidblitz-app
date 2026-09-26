"""
BidBlitz V2 — POS Payment System
- Dynamic barcode per user, refreshes for security
- Merchant scans customer barcode to process instant wallet payment
- NFC payment with tiered fees (wallet lowest, card highest)
- Payment type detection (wallet / card / contactless)
- Receipt generation + PDF export
- Daily revenue summary for terminal
- Ultra-fast mode for small amounts
- Merchant onboarding (free trial)
- Pricing model endpoints
"""
import secrets
import hashlib
import logging
import math
import io
import os
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from typing import Optional
from bson import ObjectId
from fpdf import FPDF
from core.database import db
from core.merchant_commission import MIN_MERCHANT_COMMISSION_RATE, effective_merchant_rate
from core.payment_engine import credit_wallet, debit_wallet, TransactionType
from core.config import STRIPE_API_KEY

router = APIRouter(prefix="/api/payments", tags=["Payments"])
logger = logging.getLogger("bidblitz.payments")

# Default fee structure (overridable by admin via DB)
DEFAULT_FEES = {
    "wallet": MIN_MERCHANT_COMMISSION_RATE,
    "barcode": MIN_MERCHANT_COMMISSION_RATE,
    "nfc_wallet": MIN_MERCHANT_COMMISSION_RATE,
    "nfc_card": 0.025,
    "apple_pay": 0.025,
    "google_pay": 0.025,
    "card": 0.025,
}

ULTRA_FAST_LIMIT = 25.0
PIN_REQUIRED_LIMIT = 50.0
BARCODE_VALIDITY_SECONDS = 120

FEE_LABELS = {
    "wallet": "BidBlitz Wallet",
    "barcode": "Barcode/QR",
    "nfc_wallet": "NFC Wallet",
    "nfc_card": "Contactless Card",
    "apple_pay": "Apple Pay",
    "google_pay": "Google Pay",
    "card": "Card Payment",
}


def payment_method_availability() -> dict:
    """Public capability view. Never advertise an unverified money path as usable."""
    stripe_wallet_ready = bool(STRIPE_API_KEY and os.environ.get("STRIPE_PI_WEBHOOK_SECRET"))
    return {
        "wallet": {"available": True, "reason": None},
        "barcode": {"available": True, "reason": None},
        "nfc_wallet": {"available": True, "reason": None},
        "nfc_card": {"available": False, "reason": "terminal_provider_required"},
        "card": {"available": False, "reason": "terminal_provider_required"},
        "apple_pay": {
            "available": stripe_wallet_ready,
            "reason": None if stripe_wallet_ready else "settlement_webhook_required",
        },
        "google_pay": {
            "available": stripe_wallet_ready,
            "reason": None if stripe_wallet_ready else "settlement_webhook_required",
        },
    }


async def get_current_user(request: Request):
    from routes.auth import get_current_user as auth_user
    return await auth_user(request)


async def get_fee_rates() -> dict:
    """Get fee rates from DB or fallback to defaults."""
    cfg = await db.fee_config.find_one({"_id": "merchant_fees"})
    if cfg:
        return {k: effective_merchant_rate(cfg.get(k), default) for k, default in DEFAULT_FEES.items()}
    return dict(DEFAULT_FEES)


async def _require_merchant_profile(user: dict) -> dict:
    user_id = str(user["_id"])
    profile = await db.merchant_profiles.find_one({"user_id": user_id})
    if not profile:
        staff = await db.merchant_staff.find_one({"user_id": user_id, "status": "active"})
        if staff and ObjectId.is_valid(str(staff.get("merchant_id") or "")):
            profile = await db.merchant_profiles.find_one({"_id": ObjectId(staff["merchant_id"])})
    if not profile:
        raise HTTPException(status_code=403, detail="Aktives Händlerprofil erforderlich")
    return profile


def generate_barcode_token(user_id: str) -> str:
    salt = secrets.token_hex(8)
    raw = f"{user_id}:{salt}:{datetime.now(timezone.utc).isoformat()}"
    token = hashlib.sha256(raw.encode()).hexdigest()[:16].upper()
    return f"BLZ-{token}"


def deterministic_payment_reference(prefix: str, *parts) -> str:
    raw = ":".join(str(part or "") for part in parts)
    digest = hashlib.sha256(raw.encode("utf-8")).hexdigest().upper()[:12]
    return f"{prefix}-{digest}"


async def detect_payment_type(method: str) -> dict:
    """Detect payment type and return fee rate + label."""
    rates = await get_fee_rates()
    rate = rates.get(method, rates.get("card", 0.025))
    label = FEE_LABELS.get(method, FEE_LABELS["card"])
    return {"fee_rate": rate, "label": label, "category": method if method in FEE_LABELS else "card"}


def generate_receipt(txn_id: str, amount: float, fee: float, net: float,
                     payment_type: dict, customer_name: str, merchant_name: str,
                     description: str) -> dict:
    now = datetime.now(timezone.utc)
    return {
        "receipt_id": f"RCP-{secrets.token_hex(6).upper()}",
        "transaction_id": txn_id,
        "timestamp": now.isoformat(),
        "date": now.strftime("%d.%m.%Y"),
        "time": now.strftime("%H:%M:%S"),
        "amount": amount,
        "fee": fee,
        "net": net,
        "currency": "EUR",
        "payment_method": payment_type["label"],
        "payment_category": payment_type["category"],
        "fee_rate": round(payment_type["fee_rate"] * 100, 2),
        "customer_name": customer_name,
        "merchant_name": merchant_name,
        "description": description,
        "status": "completed",
    }


# ══════════════════════════════════════
# USER: Get/Refresh personal barcode
# ══════════════════════════════════════

@router.get("/my-barcode")
async def get_my_barcode(request: Request):
    user = await get_current_user(request)
    uid = str(user["_id"])
    now = datetime.now(timezone.utc)

    existing = await db.payment_barcodes.find_one({"user_id": uid, "active": True})
    if existing:
        expires = datetime.fromisoformat(existing["expires_at"])
        if expires > now:
            seconds_remaining = int((expires - now).total_seconds())
            return {
                "barcode": existing["barcode"],
                "expires_at": existing["expires_at"],
                "seconds_remaining": seconds_remaining,
                "expires_in": seconds_remaining,
                "rotation_seconds": BARCODE_VALIDITY_SECONDS,
                "user_name": user.get("name", ""),
                "name": user.get("name", ""),
                "balance": round(float(user.get("balance", 0) or 0), 2),
            }
        await db.payment_barcodes.update_one({"_id": existing["_id"]}, {"$set": {"active": False}})

    barcode = generate_barcode_token(uid)
    expires_at = (now + timedelta(seconds=BARCODE_VALIDITY_SECONDS)).isoformat()
    await db.payment_barcodes.insert_one({
        "user_id": uid, "barcode": barcode, "active": True,
        "expires_at": expires_at, "created_at": now.isoformat(),
    })
    return {
        "barcode": barcode,
        "expires_at": expires_at,
        "seconds_remaining": BARCODE_VALIDITY_SECONDS,
        "expires_in": BARCODE_VALIDITY_SECONDS,
        "rotation_seconds": BARCODE_VALIDITY_SECONDS,
        "user_name": user.get("name", ""),
        "name": user.get("name", ""),
        "balance": round(float(user.get("balance", 0) or 0), 2),
    }


@router.post("/refresh-barcode")
async def refresh_barcode(request: Request):
    user = await get_current_user(request)
    uid = str(user["_id"])
    await db.payment_barcodes.update_many({"user_id": uid}, {"$set": {"active": False}})

    now = datetime.now(timezone.utc)
    barcode = generate_barcode_token(uid)
    expires_at = (now + timedelta(seconds=BARCODE_VALIDITY_SECONDS)).isoformat()
    await db.payment_barcodes.insert_one({
        "user_id": uid, "barcode": barcode, "active": True,
        "expires_at": expires_at, "created_at": now.isoformat(),
    })
    return {
        "barcode": barcode,
        "expires_at": expires_at,
        "seconds_remaining": BARCODE_VALIDITY_SECONDS,
        "expires_in": BARCODE_VALIDITY_SECONDS,
        "rotation_seconds": BARCODE_VALIDITY_SECONDS,
        "user_name": user.get("name", ""),
        "name": user.get("name", ""),
        "balance": round(float(user.get("balance", 0) or 0), 2),
    }


# ══════════════════════════════════════
# MERCHANT: Barcode Lookup
# ══════════════════════════════════════

@router.post("/barcode-lookup")
async def barcode_lookup(request: Request):
    actor = await get_current_user(request)
    await _require_merchant_profile(actor)
    body = await request.json()
    barcode = body.get("barcode", "")

    bc = await db.payment_barcodes.find_one({"barcode": barcode, "active": True})
    if not bc:
        raise HTTPException(status_code=404, detail="Invalid or expired barcode")

    now = datetime.now(timezone.utc)
    expires = datetime.fromisoformat(bc["expires_at"])
    if expires < now:
        await db.payment_barcodes.update_one({"_id": bc["_id"]}, {"$set": {"active": False}})
        raise HTTPException(status_code=400, detail="Barcode expired")

    customer = await db.users.find_one({"_id": ObjectId(bc["user_id"])})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    return {
        "customer_name": customer.get("name", ""),
        "customer_email": (
            customer.get("email", "")[:2] + "***@" + customer.get("email", "").split("@", 1)[1]
            if customer.get("email") and "@" in customer.get("email", "")
            else ""
        ),
        "barcode": barcode, "valid": True,
    }


# ══════════════════════════════════════
# MERCHANT: Process Barcode Payment (Ultra-fast)
# ══════════════════════════════════════

class BarcodePaymentRequest(BaseModel):
    barcode: str
    amount: float = Field(..., gt=0)
    description: Optional[str] = "Payment"
    payment_method: Optional[str] = "barcode"


@router.post("/barcode-pay")
async def process_barcode_payment(req: BarcodePaymentRequest, request: Request):
    merchant_user = await get_current_user(request)
    merchant_uid = str(merchant_user["_id"])
    mp = await _require_merchant_profile(merchant_user)

    mid = str(mp["_id"]) if mp else ""
    merchant_name = mp.get("business_name", "") if mp else ""
    merchant_owner_id = str(mp.get("user_id") or "") if mp else ""
    if not merchant_owner_id:
        raise HTTPException(status_code=409, detail="Händlerkonto hat keinen abrechenbaren Owner")

    now = datetime.now(timezone.utc)
    bc = await db.payment_barcodes.find_one({"barcode": req.barcode})
    if not bc:
        raise HTTPException(status_code=404, detail="Invalid or expired barcode")

    pt = await detect_payment_type(req.payment_method or "barcode")
    fee = round(req.amount * pt["fee_rate"], 2)
    net = round(req.amount - fee, 2)
    reference = deterministic_payment_reference(
        "BRC", merchant_uid, req.barcode, f"{req.amount:.2f}", pt["category"]
    )

    # One-time authorization: exact completed retries may replay, but the
    # barcode is never reopened after a payment attempt.
    if not bc.get("active", False):
        if bc.get("payment_reference") == reference and bc.get("payment_state") == "completed":
            customer_uid = str(bc.get("user_id") or "")
            customer_oid = ObjectId(customer_uid) if ObjectId.is_valid(customer_uid) else customer_uid
            customer = await db.users.find_one({"_id": customer_oid}) or {}
            tx_id = bc.get("payment_transaction_id") or reference
            return {
                "ok": True,
                "transaction_id": tx_id,
                "amount": req.amount,
                "fee": fee,
                "net": net,
                "customer_id": customer_uid,
                "customer_name": customer.get("name", ""),
                "customer_balance": customer.get("balance", 0),
                "payment_method": pt["category"],
                "payment_type_label": pt["label"],
                "ultra_fast": req.amount <= ULTRA_FAST_LIMIT,
                "receipt": generate_receipt(
                    tx_id, req.amount, fee, net, pt,
                    customer.get("name", ""), merchant_name, req.description or "Payment",
                ),
                "replayed": True,
            }
        if bc.get("payment_reference") == reference and bc.get("payment_state") in {
            "processing", "reconciliation_required"
        }:
            raise HTTPException(status_code=503, detail="Barcode-Zahlung wird verarbeitet oder benötigt Abstimmung")
        raise HTTPException(status_code=409, detail="Barcode wurde bereits verwendet")

    expires = datetime.fromisoformat(bc["expires_at"])
    if expires < now:
        await db.payment_barcodes.update_one(
            {"_id": bc["_id"], "active": True},
            {"$set": {"active": False, "payment_state": "expired", "expired_at": now.isoformat()}},
        )
        raise HTTPException(status_code=400, detail="Barcode expired")

    claimed = await db.payment_barcodes.update_one(
        {"_id": bc["_id"], "active": True},
        {"$set": {
            "active": False,
            "payment_state": "processing",
            "payment_reference": reference,
            "payment_claimed_by": merchant_uid,
            "payment_claimed_at": now.isoformat(),
        }},
    )
    if claimed.modified_count != 1:
        latest = await db.payment_barcodes.find_one({"_id": bc["_id"]}, {"_id": 0}) or {}
        if latest.get("payment_reference") == reference and latest.get("payment_state") == "completed":
            customer_uid = str(latest.get("user_id") or "")
            customer_oid = ObjectId(customer_uid) if ObjectId.is_valid(customer_uid) else customer_uid
            customer = await db.users.find_one({"_id": customer_oid}) or {}
            tx_id = latest.get("payment_transaction_id") or reference
            return {
                "ok": True,
                "transaction_id": tx_id,
                "amount": req.amount,
                "fee": fee,
                "net": net,
                "customer_id": customer_uid,
                "customer_name": customer.get("name", ""),
                "customer_balance": customer.get("balance", 0),
                "payment_method": pt["category"],
                "payment_type_label": pt["label"],
                "ultra_fast": req.amount <= ULTRA_FAST_LIMIT,
                "receipt": generate_receipt(
                    tx_id, req.amount, fee, net, pt,
                    customer.get("name", ""), merchant_name, req.description or "Payment",
                ),
                "replayed": True,
            }
        if latest.get("payment_reference") == reference and latest.get("payment_state") in {
            "processing", "reconciliation_required"
        }:
            raise HTTPException(status_code=503, detail="Barcode-Zahlung wird verarbeitet oder benötigt Abstimmung")
        raise HTTPException(status_code=409, detail="Barcode wurde bereits verwendet")

    customer_uid = str(bc["user_id"])
    customer_oid = ObjectId(customer_uid) if ObjectId.is_valid(customer_uid) else customer_uid
    customer = await db.users.find_one({"_id": customer_oid})
    if not customer:
        await db.payment_barcodes.update_one(
            {"_id": bc["_id"], "payment_reference": reference},
            {"$set": {"payment_state": "failed", "payment_error": "customer_not_found"}},
        )
        raise HTTPException(status_code=404, detail="Customer not found")

    balance = float(customer.get("balance", 0) or 0)
    if balance < req.amount:
        await db.payment_barcodes.update_one(
            {"_id": bc["_id"], "payment_reference": reference},
            {"$set": {"payment_state": "failed", "payment_error": "insufficient_balance"}},
        )
        raise HTTPException(status_code=400, detail="Insufficient balance")

    customer_debit = await debit_wallet(
        user_id=customer_uid,
        amount=req.amount,
        tx_type=TransactionType.PAYMENT,
        description=req.description or "Payment",
        reference=reference,
        merchant_id=mid or None,
        merchant_name=merchant_name,
        metadata={
            "gross_amount": req.amount,
            "fee_amount": fee,
            "net_amount": net,
            "payment_method": pt["category"],
            "audit_metadata": {"route": "pos_payments.barcode_pay"},
        },
        idempotency_key=f"pos-barcode:{merchant_uid}:{req.barcode}:{req.amount:.2f}",
    )
    if not customer_debit.success:
        debit_state = str(getattr(customer_debit.status, "value", customer_debit.status))
        await db.payment_barcodes.update_one(
            {"_id": bc["_id"], "payment_reference": reference},
            {"$set": {
                "payment_state": (
                    "reconciliation_required"
                    if debit_state in {"pending", "reconciliation_required"}
                    else "failed"
                ),
                "payment_error": customer_debit.error or "customer_debit_failed",
                "payment_transaction_id": customer_debit.transaction_id,
            }},
        )
        raise HTTPException(
            status_code=503 if debit_state in {"pending", "reconciliation_required"} else 400,
            detail=customer_debit.error or "Payment failed — balance changed",
        )

    merchant_credit_result = await _credit_merchant_wallet(
        merchant_owner_id,
        net,
        reference=reference,
        source_user_id=customer_uid,
        description=f"POS Zahlung: {req.description or 'Payment'}",
        merchant_name=merchant_name,
        merchant_id=mid,
        gross_amount=req.amount,
        fee_amount=fee,
        payment_method=pt["category"],
        route_name="pos_payments.barcode_pay",
        customer_name=customer.get("name", ""),
        customer_email=customer.get("email", ""),
    )
    if not merchant_credit_result or not merchant_credit_result.success:
        merchant_state = (
            str(getattr(merchant_credit_result.status, "value", merchant_credit_result.status))
            if merchant_credit_result
            else "failed"
        )
        if merchant_state in {"pending", "reconciliation_required"}:
            await db.payment_barcodes.update_one(
                {"_id": bc["_id"], "payment_reference": reference},
                {"$set": {
                    "payment_state": "reconciliation_required",
                    "payment_error": (
                        merchant_credit_result.error
                        if merchant_credit_result
                        else "merchant_credit_uncertain"
                    ),
                    "payment_transaction_id": customer_debit.transaction_id,
                    "merchant_transaction_id": (
                        merchant_credit_result.transaction_id if merchant_credit_result else None
                    ),
                }},
            )
            raise HTTPException(
                status_code=503,
                detail="Händlergutschrift benötigt Abstimmung; keine automatische Rückbuchung ausgelöst.",
            )

        refund = await credit_wallet(
            user_id=customer_uid,
            amount=req.amount,
            tx_type=TransactionType.REFUND,
            description=f"Refund: POS payment failed ({req.description or 'Payment'})",
            reference=f"REF-{reference}",
            source="pos_payments.barcode_pay.rollback",
            metadata={
                "original_reference": reference,
                "audit_metadata": {"route": "pos_payments.barcode_pay.rollback"},
            },
            idempotency_key=f"refund:{customer_debit.transaction_id}",
        )
        refund_state = str(getattr(refund.status, "value", refund.status))
        await db.payment_barcodes.update_one(
            {"_id": bc["_id"], "payment_reference": reference},
            {"$set": {
                "payment_state": "refunded" if refund.success else "reconciliation_required",
                "payment_error": (
                    merchant_credit_result.error
                    if merchant_credit_result
                    else "merchant_settlement_failed"
                ),
                "payment_transaction_id": customer_debit.transaction_id,
                "refund_transaction_id": refund.transaction_id,
            }},
        )
        if not refund.success:
            logger.error("POS barcode rollback requires reconciliation: %s", reference)
            raise HTTPException(
                status_code=503 if refund_state in {"pending", "reconciliation_required"} else 500,
                detail="Händlergutschrift und Rückbuchung benötigen manuelle Abstimmung.",
            )
        raise HTTPException(
            status_code=400,
            detail=(
                merchant_credit_result.error
                if merchant_credit_result
                else "Merchant settlement failed; customer refunded"
            ),
        )

    now_iso = now.isoformat()
    merchant_tx = {
        "merchant_id": mid,
        "branch_id": "",
        "device_id": "barcode",
        "reference": reference,
        "amount": req.amount,
        "fee": fee,
        "net": net,
        "commission_rate": pt["fee_rate"] * 100,
        "description": req.description,
        "customer_ref": customer.get("email", ""),
        "customer_name": customer.get("name", ""),
        "payment_method": pt["category"],
        "payment_type_label": pt["label"],
        "status": "completed",
        "created_at": now_iso,
    }
    write = await db.merchant_transactions.update_one(
        {"reference": reference},
        {"$setOnInsert": merchant_tx},
        upsert=True,
    )
    stats_written = write.upserted_id is not None

    if stats_written:
        await db.merchant_profiles.update_one(
            {"_id": mp["_id"]},
            {"$inc": {"total_revenue": req.amount, "total_fees": fee}},
        )
        await db.merchants.update_one(
            {"user_id": merchant_owner_id},
            {"$inc": {
                "gross_earnings": req.amount,
                "total_earnings": net,
                "total_fees": fee,
                "total_transactions": 1,
                "available_payout": net,
            }},
            upsert=True,
        )

    await db.payment_barcodes.update_one(
        {"_id": bc["_id"], "payment_reference": reference, "payment_state": "processing"},
        {"$set": {
            "payment_state": "completed",
            "payment_transaction_id": customer_debit.transaction_id,
            "merchant_transaction_id": merchant_credit_result.transaction_id,
            "completed_at": datetime.now(timezone.utc).isoformat(),
        }},
    )

    updated_customer = await db.users.find_one({"_id": customer_oid}) or {}
    receipt = generate_receipt(
        customer_debit.transaction_id or secrets.token_hex(8),
        req.amount,
        fee,
        net,
        pt,
        customer.get("name", ""),
        merchant_name,
        req.description or "Payment",
    )

    try:
        from core.email import send_receipt_email
        send_receipt_email(
            to=customer.get("email", ""),
            transaction_id=customer_debit.transaction_id or reference,
            amount=req.amount,
            fee=fee,
            net_amount=net,
            description=req.description or "Payment",
            merchant_name=merchant_name,
            user_name=customer.get("name", ""),
        )
    except Exception:
        pass

    return {
        "ok": True,
        "transaction_id": customer_debit.transaction_id,
        "amount": req.amount,
        "fee": fee,
        "net": net,
        "customer_id": customer_uid,
        "customer_name": customer.get("name", ""),
        "customer_balance": updated_customer.get("balance", 0),
        "payment_method": pt["category"],
        "payment_type_label": pt["label"],
        "ultra_fast": req.amount <= ULTRA_FAST_LIMIT,
        "receipt": receipt,
        "replayed": bool(
            customer_debit.idempotent_replay and merchant_credit_result.idempotent_replay
        ),
    }


# ══════════════════════════════════════
# NFC PAYMENT (with type detection)
# ══════════════════════════════════════

class NfcPaymentRequest(BaseModel):
    customer_id: Optional[str] = None
    amount: float = Field(..., gt=0, le=100000, allow_inf_nan=False)
    payment_method: str = "nfc_wallet"
    description: Optional[str] = "NFC Payment"
    device_id: Optional[str] = ""
    idempotency_key: Optional[str] = None


async def _credit_merchant_wallet(
    merchant_owner_id: str,
    amount: float,
    *,
    reference: str,
    source_user_id: str,
    description: str,
    merchant_name: str,
    merchant_id: str,
    gross_amount: float,
    fee_amount: float,
    payment_method: str,
    route_name: str,
    customer_name: str = "",
    customer_email: str = "",
):
    if not merchant_owner_id:
        return None
    return await credit_wallet(
        user_id=merchant_owner_id,
        amount=amount,
        tx_type=TransactionType.MERCHANT_CREDIT,
        description=description,
        reference=reference,
        source=source_user_id,
        metadata={
            "gross_amount": gross_amount,
            "fee_amount": fee_amount,
            "net_amount": amount,
            "merchant_name": merchant_name,
            "merchant_id": merchant_id,
            "customer_name": customer_name,
            "customer_email": customer_email,
            "payment_method": payment_method,
            "audit_metadata": {"route": route_name, "kind": "merchant_credit"},
        },
        idempotency_key=f"merchant-credit:{reference}:{merchant_owner_id}",
    )


@router.post("/nfc-pay")
async def process_nfc_payment(req: NfcPaymentRequest, request: Request):
    merchant_user = await get_current_user(request)
    merchant_uid = str(merchant_user["_id"])
    mp = await _require_merchant_profile(merchant_user)

    if req.payment_method not in ("nfc_wallet", "wallet"):
        raise HTTPException(
            status_code=503,
            detail="Externe Karten-/NFC-Zahlung ist in diesem Endpoint nicht provider-verifiziert. Nutze BidBlitz Wallet oder einen zertifizierten Terminal-Provider.",
        )
    if not req.customer_id:
        raise HTTPException(status_code=400, detail="Customer ID required for wallet payment")

    raw_key = str(req.idempotency_key or request.headers.get("Idempotency-Key") or "").strip()
    if not 8 <= len(raw_key) <= 200:
        raise HTTPException(status_code=400, detail="Idempotency-Key erforderlich")
    key_hash = hashlib.sha256(f"{merchant_uid}:{raw_key}".encode("utf-8")).hexdigest()[:24]

    mid = str(mp["_id"]) if mp else ""
    merchant_name = mp.get("business_name", "") if mp else ""
    merchant_owner_id = str(mp.get("user_id") or "") if mp else ""
    if not merchant_owner_id:
        raise HTTPException(status_code=409, detail="Händlerkonto hat keinen abrechenbaren Owner")

    now = datetime.now(timezone.utc)
    now_iso = now.isoformat()
    pt = await detect_payment_type(req.payment_method)
    fee = round(req.amount * pt["fee_rate"], 2)
    net = round(req.amount - fee, 2)
    reference = deterministic_payment_reference("NFC", merchant_uid, key_hash)

    customer_oid = ObjectId(req.customer_id) if ObjectId.is_valid(req.customer_id) else req.customer_id
    customer_doc = await db.users.find_one({"_id": customer_oid})
    if not customer_doc:
        raise HTTPException(status_code=404, detail="Customer not found")
    if float(customer_doc.get("balance", 0) or 0) < req.amount:
        raise HTTPException(status_code=400, detail="Insufficient balance")
    customer_name = customer_doc.get("name", "")

    customer_debit = await debit_wallet(
        user_id=req.customer_id,
        amount=req.amount,
        tx_type=TransactionType.PAYMENT,
        description=req.description or "NFC Payment",
        reference=reference,
        merchant_id=mid or None,
        merchant_name=merchant_name,
        metadata={
            "gross_amount": req.amount,
            "fee_amount": fee,
            "net_amount": net,
            "payment_method": pt["category"],
            "device_id": req.device_id or "default",
            "client_idempotency_hash": key_hash,
            "audit_metadata": {"route": "pos_payments.nfc_pay"},
        },
        idempotency_key=f"pos-nfc:{merchant_uid}:{key_hash}",
    )
    if not customer_debit.success:
        debit_state = str(getattr(customer_debit.status, "value", customer_debit.status))
        raise HTTPException(
            status_code=503 if debit_state in {"pending", "reconciliation_required"} else 400,
            detail=customer_debit.error or "Payment failed",
        )

    merchant_credit_result = await _credit_merchant_wallet(
        merchant_owner_id,
        net,
        reference=reference,
        source_user_id=req.customer_id,
        description=f"NFC Zahlung: {req.description or 'Payment'}",
        merchant_name=merchant_name,
        merchant_id=mid,
        gross_amount=req.amount,
        fee_amount=fee,
        payment_method=pt["category"],
        route_name="pos_payments.nfc_pay",
        customer_name=customer_name,
        customer_email=customer_doc.get("email", ""),
    )
    if not merchant_credit_result or not merchant_credit_result.success:
        merchant_state = (
            str(getattr(merchant_credit_result.status, "value", merchant_credit_result.status))
            if merchant_credit_result
            else "failed"
        )
        if merchant_state in {"pending", "reconciliation_required"}:
            await db.pos_payment_reconciliation.update_one(
                {"reference": reference},
                {"$set": {
                    "reference": reference,
                    "kind": "nfc_merchant_credit",
                    "status": "reconciliation_required",
                    "customer_id": req.customer_id,
                    "merchant_owner_id": merchant_owner_id,
                    "customer_transaction_id": customer_debit.transaction_id,
                    "merchant_transaction_id": (
                        merchant_credit_result.transaction_id if merchant_credit_result else None
                    ),
                    "error": (
                        merchant_credit_result.error
                        if merchant_credit_result
                        else "merchant_credit_uncertain"
                    ),
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }, "$setOnInsert": {"created_at": now_iso}},
                upsert=True,
            )
            raise HTTPException(
                status_code=503,
                detail="Händlergutschrift benötigt Abstimmung; keine automatische Rückbuchung ausgelöst.",
            )

        refund = await credit_wallet(
            user_id=req.customer_id,
            amount=req.amount,
            tx_type=TransactionType.REFUND,
            description=f"Refund: NFC payment failed ({req.description or 'Payment'})",
            reference=f"REF-{reference}",
            source="pos_payments.nfc_pay.rollback",
            metadata={
                "original_reference": reference,
                "client_idempotency_hash": key_hash,
                "audit_metadata": {"route": "pos_payments.nfc_pay.rollback"},
            },
            idempotency_key=f"refund:{customer_debit.transaction_id}",
        )
        if not refund.success:
            refund_state = str(getattr(refund.status, "value", refund.status))
            await db.pos_payment_reconciliation.update_one(
                {"reference": reference},
                {"$set": {
                    "reference": reference,
                    "kind": "nfc_refund",
                    "status": "reconciliation_required",
                    "customer_id": req.customer_id,
                    "merchant_owner_id": merchant_owner_id,
                    "customer_transaction_id": customer_debit.transaction_id,
                    "refund_transaction_id": refund.transaction_id,
                    "error": refund.error or "refund_uncertain",
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }, "$setOnInsert": {"created_at": now_iso}},
                upsert=True,
            )
            logger.error("POS NFC rollback requires reconciliation: %s", reference)
            raise HTTPException(
                status_code=503 if refund_state in {"pending", "reconciliation_required"} else 500,
                detail="Händlergutschrift und Rückbuchung benötigen manuelle Abstimmung.",
            )
        raise HTTPException(
            status_code=400,
            detail=(
                merchant_credit_result.error
                if merchant_credit_result
                else "Merchant settlement failed; customer refunded"
            ),
        )

    merchant_tx = {
        "merchant_id": mid,
        "branch_id": "",
        "device_id": req.device_id or "nfc",
        "reference": reference,
        "amount": req.amount,
        "fee": fee,
        "net": net,
        "commission_rate": pt["fee_rate"] * 100,
        "description": req.description,
        "customer_ref": req.customer_id,
        "customer_name": customer_name,
        "payment_method": pt["category"],
        "payment_type_label": pt["label"],
        "status": "completed",
        "created_at": now_iso,
        "client_idempotency_hash": key_hash,
    }
    write = await db.merchant_transactions.update_one(
        {"reference": reference},
        {"$setOnInsert": merchant_tx},
        upsert=True,
    )
    if write.upserted_id is not None:
        await db.merchant_profiles.update_one(
            {"_id": mp["_id"]},
            {"$inc": {"total_revenue": req.amount, "total_fees": fee}},
        )
        await db.merchants.update_one(
            {"user_id": merchant_owner_id},
            {"$inc": {
                "gross_earnings": req.amount,
                "total_earnings": net,
                "total_fees": fee,
                "total_transactions": 1,
                "available_payout": net,
            }},
            upsert=True,
        )

    tx_id = customer_debit.transaction_id or reference
    receipt = generate_receipt(
        tx_id,
        req.amount,
        fee,
        net,
        pt,
        customer_name,
        merchant_name,
        req.description or "NFC Payment",
    )

    replayed = bool(customer_debit.idempotent_replay and merchant_credit_result.idempotent_replay)
    if not replayed:
        try:
            from core.email import send_receipt_email
            send_receipt_email(
                to=customer_doc.get("email", ""),
                transaction_id=tx_id,
                amount=req.amount,
                fee=fee,
                net_amount=net,
                description=req.description or "NFC Payment",
                merchant_name=merchant_name,
                user_name=customer_name,
            )
        except Exception:
            pass

    return {
        "ok": True,
        "transaction_id": tx_id,
        "amount": req.amount,
        "fee": fee,
        "net": net,
        "fee_rate": round(pt["fee_rate"] * 100, 2),
        "payment_method": pt["category"],
        "payment_type_label": pt["label"],
        "customer_id": req.customer_id,
        "customer_name": customer_name,
        "ultra_fast": req.amount <= ULTRA_FAST_LIMIT,
        "receipt": receipt,
        "replayed": replayed,
    }


# ══════════════════════════════════════
# FEE INFO
# ══════════════════════════════════════

@router.get("/fee-info")
async def get_fee_info(request: Request):
    rates = await get_fee_rates()
    availability = payment_method_availability()
    methods = []
    for method, rate in rates.items():
        state = availability.get(method, {"available": False, "reason": "not_verified"})
        methods.append({
            "method": method,
            "fee_rate": round(rate * 100, 2),
            "label": FEE_LABELS.get(method, method),
            "available": bool(state["available"]),
            "unavailable_reason": state["reason"],
        })
    return {
        "methods": sorted(methods, key=lambda x: x["fee_rate"]),
        "ultra_fast_limit": ULTRA_FAST_LIMIT,
        "pin_required_limit": PIN_REQUIRED_LIMIT,
    }


# ══════════════════════════════════════
# ADMIN: Fee Configuration
# ══════════════════════════════════════

@router.get("/admin/fees")
async def get_admin_fees(request: Request):
    user = await get_current_user(request)
    if user.get("role") not in ("admin", "super_admin"):
        raise HTTPException(status_code=403, detail="Admin only")
    rates = await get_fee_rates()
    availability = payment_method_availability()
    return {"fees": {k: round(v * 100, 4) for k, v in rates.items()}}


@router.post("/admin/fees")
async def set_admin_fees(request: Request):
    user = await get_current_user(request)
    if user.get("role") not in ("admin", "super_admin"):
        raise HTTPException(status_code=403, detail="Admin only")
    body = await request.json()
    fees = body.get("fees", {})
    update = {}
    for k in DEFAULT_FEES:
        if k in fees:
            try:
                val = float(fees[k]) / 100  # Input is percentage, store as decimal
            except (TypeError, ValueError):
                raise HTTPException(status_code=400, detail=f"Invalid fee for {k}")
            if not math.isfinite(val) or not MIN_MERCHANT_COMMISSION_RATE <= val <= 0.5:
                raise HTTPException(status_code=400, detail=f"Fee for {k} must be between 1.5% and 50%")
            update[k] = val
    if update:
        await db.fee_config.update_one(
            {"_id": "merchant_fees"}, {"$set": update}, upsert=True,
        )
    return {"ok": True, "fees": {k: round(v * 100, 4) for k, v in (await get_fee_rates()).items()}}


# ══════════════════════════════════════
# TERMINAL: Daily Revenue Summary
# ══════════════════════════════════════

@router.get("/terminal-summary")
async def get_terminal_summary(request: Request):
    """Get today's revenue summary for the terminal display."""
    user = await get_current_user(request)
    uid = str(user["_id"])

    mp = await db.merchant_profiles.find_one({"user_id": uid})
    if not mp and user.get("role") not in ("merchant", "admin", "super_admin"):
        staff = await db.merchant_staff.find_one({"user_id": uid, "status": "active"})
        if not staff:
            raise HTTPException(status_code=403, detail="No access")
        mp = await db.merchant_profiles.find_one({"_id": ObjectId(staff["merchant_id"])})

    mid = str(mp["_id"]) if mp else ""
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()

    query = {"merchant_id": mid, "created_at": {"$gte": today_start}}
    txns = await db.merchant_transactions.find(query, {"_id": 0}).sort("created_at", -1).to_list(200)

    total_amount = sum(t.get("amount", 0) for t in txns)
    total_fees = sum(t.get("fee", 0) for t in txns)
    total_net = total_amount - total_fees

    # Payment method breakdown
    method_breakdown = {}
    for t in txns:
        m = t.get("payment_method", "unknown")
        if m not in method_breakdown:
            method_breakdown[m] = {"count": 0, "amount": 0, "fees": 0}
        method_breakdown[m]["count"] += 1
        method_breakdown[m]["amount"] += t.get("amount", 0)
        method_breakdown[m]["fees"] += t.get("fee", 0)

    for k in method_breakdown:
        method_breakdown[k]["amount"] = round(method_breakdown[k]["amount"], 2)
        method_breakdown[k]["fees"] = round(method_breakdown[k]["fees"], 2)

    return {
        "date": now.strftime("%d.%m.%Y"),
        "total_transactions": len(txns),
        "total_amount": round(total_amount, 2),
        "total_fees": round(total_fees, 2),
        "total_net": round(total_net, 2),
        "method_breakdown": method_breakdown,
        "recent_transactions": txns[:10],
        "merchant_name": mp.get("business_name", "") if mp else "",
    }


# ══════════════════════════════════════
# MERCHANT ONBOARDING (Free Trial)
# ══════════════════════════════════════

class OnboardingRequest(BaseModel):
    business_name: str
    contact_name: str
    email: str
    phone: Optional[str] = ""
    business_type: Optional[str] = ""
    plan: Optional[str] = "starter"


@router.post("/onboarding/request-trial")
async def request_merchant_trial(req: OnboardingRequest, request: Request):
    existing = await db.merchant_trials.find_one({"email": req.email.lower().strip()})
    if existing:
        return {"ok": True, "status": "already_registered", "message": "You already have a trial request."}

    now = datetime.now(timezone.utc)
    doc = {
        "business_name": req.business_name,
        "contact_name": req.contact_name,
        "email": req.email.lower().strip(),
        "phone": req.phone,
        "business_type": req.business_type,
        "plan": req.plan,
        "status": "pending",
        "created_at": now.isoformat(),
        "trial_ends": (now + timedelta(days=30)).isoformat(),
    }
    await db.merchant_trials.insert_one(doc)
    doc.pop("_id", None)
    return {"ok": True, "status": "submitted", "trial": doc}


# ══════════════════════════════════════
# PRICING INFO (public)
# ══════════════════════════════════════

@router.get("/pricing")
async def get_pricing():
    rates = await get_fee_rates()
    return {
        "plans": [
            {
                "id": "starter",
                "name": "Starter",
                "price": 0,
                "price_label": "Free",
                "description": "Perfect for small businesses getting started",
                "features": [
                    f"BidBlitz Wallet payments ({rates['wallet'] * 100:g}% fee)",
                    "Barcode/QR payments",
                    "1 branch, 2 registers",
                    "Basic daily reports",
                    "Email support",
                ],
                "limits": {"branches": 1, "registers": 2},
                "popular": False,
            },
            {
                "id": "professional",
                "name": "Professional",
                "price": 29,
                "price_label": "29/mo",
                "description": "For growing businesses",
                "features": [
                    "All Starter features",
                    f"NFC Wallet payments ({rates['nfc_wallet'] * 100:g}% fee)",
                    "External card/contactless — provider connection required",
                    "5 branches, 20 registers",
                    "Shift & monthly reports",
                    "Staff management",
                    "API access",
                    "Priority support",
                ],
                "limits": {"branches": 5, "registers": 20},
                "popular": True,
            },
            {
                "id": "enterprise",
                "name": "Enterprise",
                "price": 99,
                "price_label": "99/mo",
                "description": "Full-scale merchant operations",
                "features": [
                    "All Professional features",
                    "Unlimited branches & registers",
                    "Custom fee rates",
                    "Dedicated terminal hardware",
                    "NFC + Scanner included",
                    "Developer SDK & plugins",
                    "Dedicated account manager",
                    "SLA guarantee",
                ],
                "limits": {"branches": -1, "registers": -1},
                "popular": False,
            },
        ],
        "terminal_options": [
            {"id": "tablet_stand", "name": "Tablet Stand Kit", "price": 149, "description": "iPad/Android stand + barcode scanner", "monthly": 0},
            {"id": "terminal_rental", "name": "BidBlitz Terminal (Rental)", "price": 0, "description": "Dedicated terminal with NFC + scanner", "monthly": 19},
            {"id": "terminal_purchase", "name": "BidBlitz Terminal (Purchase)", "price": 399, "description": "Own your terminal — NFC + scanner built-in", "monthly": 0},
        ],
        "fee_structure": {
            "wallet": {"rate": round(rates["wallet"] * 100, 4), "label": "BidBlitz Wallet"},
            "nfc_wallet": {"rate": round(rates["nfc_wallet"] * 100, 4), "label": "NFC Wallet"},
            "barcode": {"rate": round(rates["barcode"] * 100, 4), "label": "Barcode/QR"},
            "card": {
                "rate": round(rates["card"] * 100, 4),
                "label": "Card/Contactless",
                **availability["card"],
            },
            "apple_pay": {
                "rate": round(rates["apple_pay"] * 100, 4),
                "label": "Apple Pay",
                **availability["apple_pay"],
            },
            "google_pay": {
                "rate": round(rates["google_pay"] * 100, 4),
                "label": "Google Pay",
                **availability["google_pay"],
            },
        },
    }



# ══════════════════════════════════════
# PDF Receipt Generation
# ══════════════════════════════════════

class ReceiptPDF(FPDF):
    def header(self):
        self.set_font("Helvetica", "B", 16)
        self.set_text_color(0, 194, 255)
        self.cell(0, 10, "BidBlitz", align="C", new_x="LMARGIN", new_y="NEXT")
        self.set_font("Helvetica", "", 8)
        self.set_text_color(100, 100, 100)
        self.cell(0, 5, "Payment Receipt", align="C", new_x="LMARGIN", new_y="NEXT")
        self.ln(5)

    def footer(self):
        self.set_y(-20)
        self.set_font("Helvetica", "I", 7)
        self.set_text_color(150, 150, 150)
        self.cell(0, 5, "Thank you for using BidBlitz!", align="C", new_x="LMARGIN", new_y="NEXT")
        self.cell(0, 5, "support@bidblitz.com | www.bidblitz.com", align="C")


def create_receipt_pdf(txn: dict) -> bytes:
    """Generate PDF receipt from transaction data."""
    pdf = ReceiptPDF()
    pdf.add_page()
    pdf.set_auto_page_break(auto=True, margin=25)

    # Receipt ID & Date
    pdf.set_font("Helvetica", "B", 10)
    pdf.set_text_color(40, 40, 40)
    pdf.cell(95, 8, f"Receipt: {txn.get('reference', txn.get('id', 'N/A'))}")
    pdf.set_font("Helvetica", "", 10)
    created = txn.get("created_at", "")
    if created:
        try:
            dt = datetime.fromisoformat(created.replace("Z", "+00:00"))
            date_str = dt.strftime("%d.%m.%Y %H:%M")
        except ValueError:
            date_str = created[:16]
    else:
        date_str = datetime.now().strftime("%d.%m.%Y %H:%M")
    pdf.cell(95, 8, date_str, align="R", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(3)

    # Divider
    pdf.set_draw_color(220, 220, 220)
    pdf.line(10, pdf.get_y(), 200, pdf.get_y())
    pdf.ln(5)

    # Transaction Details
    pdf.set_font("Helvetica", "B", 9)
    pdf.set_text_color(100, 100, 100)
    pdf.cell(0, 6, "TRANSACTION DETAILS", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(2)

    details = [
        ("Type", txn.get("type", "payment").replace("_", " ").title()),
        ("Status", txn.get("status", "completed").title()),
        ("Payment Method", txn.get("payment_method", "Wallet").replace("_", " ").title()),
        ("Merchant", txn.get("merchant_name", "-")),
        ("Description", txn.get("description", "-")),
    ]

    pdf.set_font("Helvetica", "", 10)
    pdf.set_text_color(60, 60, 60)
    for label, value in details:
        pdf.cell(50, 7, label + ":")
        pdf.set_font("Helvetica", "B", 10)
        pdf.cell(0, 7, str(value)[:50], new_x="LMARGIN", new_y="NEXT")
        pdf.set_font("Helvetica", "", 10)

    pdf.ln(5)
    pdf.line(10, pdf.get_y(), 200, pdf.get_y())
    pdf.ln(5)

    # Amount Section
    pdf.set_font("Helvetica", "B", 9)
    pdf.set_text_color(100, 100, 100)
    pdf.cell(0, 6, "AMOUNT", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(2)

    amount = abs(txn.get("amount", 0))
    fee = abs(txn.get("fee", 0))
    net = abs(txn.get("net_amount", amount - fee))

    pdf.set_font("Helvetica", "", 11)
    pdf.set_text_color(60, 60, 60)
    pdf.cell(120, 8, "Subtotal:")
    pdf.cell(0, 8, f"EUR {amount:.2f}", align="R", new_x="LMARGIN", new_y="NEXT")

    if fee > 0:
        pdf.cell(120, 8, "Fee:")
        pdf.cell(0, 8, f"EUR {fee:.2f}", align="R", new_x="LMARGIN", new_y="NEXT")

    pdf.ln(2)
    pdf.set_draw_color(0, 194, 255)
    pdf.set_line_width(0.5)
    pdf.line(10, pdf.get_y(), 200, pdf.get_y())
    pdf.ln(3)

    pdf.set_font("Helvetica", "B", 14)
    pdf.set_text_color(0, 150, 50)
    pdf.cell(120, 10, "Total:")
    pdf.cell(0, 10, f"EUR {net:.2f}", align="R", new_x="LMARGIN", new_y="NEXT")

    pdf.ln(8)

    # Reference box
    pdf.set_fill_color(245, 245, 245)
    pdf.set_font("Helvetica", "", 8)
    pdf.set_text_color(100, 100, 100)
    ref = txn.get("reference", txn.get("id", ""))
    if ref:
        pdf.cell(0, 8, f"Reference: {ref}", align="C", fill=True, new_x="LMARGIN", new_y="NEXT")

    return pdf.output()


@router.get("/receipt/{transaction_id}/pdf")
async def get_receipt_pdf(transaction_id: str, request: Request):
    """Download PDF receipt for a transaction."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    is_admin = user.get("role") in ("admin", "super_admin")

    # Find transaction by id field (not _id)
    txn = await db.transactions.find_one({"id": transaction_id}, {"_id": 0})
    if not txn:
        txn = await db.transactions.find_one({"reference": transaction_id}, {"_id": 0})
    if not txn:
        # Try by user_id + partial match
        txn = await db.transactions.find_one(
            {"user_id": user_id, "id": {"$regex": f"^{transaction_id[:8]}"}},
            {"_id": 0}
        )
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")

    # Authorization check
    if not is_admin and txn.get("user_id") != user_id and txn.get("merchant_id") != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")

    pdf_bytes = create_receipt_pdf(txn)
    ref = txn.get("reference", transaction_id)[:20]

    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="BidBlitz_Receipt_{ref}.pdf"'}
    )


@router.get("/receipt/{transaction_id}")
async def get_receipt_data(transaction_id: str, request: Request):
    """Get receipt data for a transaction (JSON for frontend display/print)."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    is_admin = user.get("role") in ("admin", "super_admin")

    txn = await db.transactions.find_one({"id": transaction_id}, {"_id": 0})
    if not txn:
        txn = await db.transactions.find_one({"reference": transaction_id}, {"_id": 0})
    if not txn:
        txn = await db.transactions.find_one(
            {"user_id": user_id, "id": {"$regex": f"^{transaction_id[:8]}"}},
            {"_id": 0}
        )
    if not txn:
        return {"error": "Transaction not found", "transaction_id": transaction_id}

    if not is_admin and txn.get("user_id") != user_id and txn.get("merchant_id") != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")

    created = txn.get("created_at", "")
    try:
        dt = datetime.fromisoformat(created.replace("Z", "+00:00"))
        date_str = dt.strftime("%d.%m.%Y")
        time_str = dt.strftime("%H:%M:%S")
    except ValueError:
        date_str = created[:10] if created else ""
        time_str = created[11:19] if len(created) > 18 else ""

    return {
        "receipt_id": txn.get("reference", txn.get("id", "")),
        "transaction_id": txn.get("id", transaction_id),
        "date": date_str,
        "time": time_str,
        "timestamp": created,
        "type": txn.get("type", "payment"),
        "amount": abs(txn.get("amount", 0)),
        "fee": abs(txn.get("fee", 0)),
        "net": abs(txn.get("net_amount", txn.get("amount", 0))),
        "currency": "EUR",
        "status": txn.get("status", "completed"),
        "payment_method": txn.get("payment_method", "wallet"),
        "merchant_name": txn.get("merchant_name", ""),
        "description": txn.get("description", ""),
        "reference": txn.get("reference", ""),
    }



# ══════════════════════════════════════════════════════════════════════════════
# GUTSCHEIN / VOUCHER SYSTEM
# ══════════════════════════════════════════════════════════════════════════════

class CreateVoucherRequest(BaseModel):
    amount: float = Field(..., gt=0, le=1000, description="Gutscheinwert in EUR")
    description: Optional[str] = "BidBlitz Gutschein"
    valid_days: int = Field(365, ge=1, le=730, description="Gültigkeit in Tagen")
    single_use: bool = True
    recipient_email: Optional[str] = None  # Optional: direkt an Kunde senden


class RedeemVoucherRequest(BaseModel):
    voucher_code: str


# ── MERCHANT: Create Voucher ──
@router.post("/voucher/create")
async def create_voucher(req: CreateVoucherRequest, request: Request):
    """Legacy voucher value route; canonical POS voucher issuance lives in routes.pos_vouchers."""
    await get_current_user(request)
    raise HTTPException(
        status_code=410,
        detail="Legacy-Gutschein-Erstellung deaktiviert. Verwende /api/pos/vouchers/create.",
    )


# ── MERCHANT: List Vouchers ──
@router.get("/voucher/list")
async def list_merchant_vouchers(request: Request, status: str = ""):
    """Liste aller Gutscheine des Händlers."""
    merchant_user = await get_current_user(request)
    merchant_uid = str(merchant_user["_id"])
    
    query = {"merchant_id": merchant_uid}
    if status:
        query["status"] = status
    
    vouchers = await db.vouchers.find(query, {"_id": 0}).sort("created_at", -1).limit(100).to_list(100)
    
    stats = {
        "total": len(vouchers),
        "active": len([v for v in vouchers if v["status"] == "active"]),
        "redeemed": len([v for v in vouchers if v["status"] == "redeemed"]),
        "total_value": sum(v["original_amount"] for v in vouchers),
        "redeemed_value": sum(v["original_amount"] for v in vouchers if v["status"] == "redeemed"),
    }
    
    return {"vouchers": vouchers, "stats": stats}


# ── CUSTOMER: Check Voucher ──
@router.get("/voucher/check/{voucher_code}")
async def check_voucher(voucher_code: str, request: Request):
    """Kunde prüft Gutschein-Gültigkeit."""
    await get_current_user(request)
    
    voucher = await db.vouchers.find_one({"voucher_code": voucher_code.upper()}, {"_id": 0})
    if not voucher:
        raise HTTPException(status_code=404, detail="Gutschein nicht gefunden")
    
    now = datetime.now(timezone.utc)
    expires = datetime.fromisoformat(voucher["expires_at"])
    
    if voucher["status"] == "redeemed":
        return {"valid": False, "reason": "Gutschein bereits eingelöst", "voucher": voucher}
    if voucher["status"] == "cancelled":
        return {"valid": False, "reason": "Gutschein storniert", "voucher": voucher}
    if expires < now:
        return {"valid": False, "reason": "Gutschein abgelaufen", "voucher": voucher}
    
    return {
        "valid": True,
        "voucher": voucher,
        "message": f"Gutschein gültig: €{voucher['amount']:.2f}",
    }


# ── CUSTOMER: Redeem Voucher ──
@router.post("/voucher/redeem")
async def redeem_voucher(req: RedeemVoucherRequest, request: Request):
    """Legacy voucher redemption; canonical wallet redemption lives in routes.pos_vouchers."""
    await get_current_user(request)
    raise HTTPException(
        status_code=410,
        detail="Legacy-Gutschein-Einlösung deaktiviert. Verwende /api/pos/vouchers/redeem/{voucher_code}.",
    )


# ── MERCHANT: Cancel Voucher ──
@router.post("/voucher/cancel/{voucher_code}")
async def cancel_voucher(voucher_code: str, request: Request):
    """Legacy voucher cancellation is retired with the legacy issuance flow."""
    await get_current_user(request)
    raise HTTPException(
        status_code=410,
        detail="Legacy-Gutschein-Storno deaktiviert. Verwende den kanonischen POS-Gutscheinpfad.",
    )


# ── MERCHANT: Voucher Stats ──
@router.get("/voucher/stats")
async def get_voucher_stats(request: Request):
    """Gutschein-Statistiken für Händler."""
    merchant_user = await get_current_user(request)
    merchant_uid = str(merchant_user["_id"])
    
    all_vouchers = await db.vouchers.find({"merchant_id": merchant_uid}).to_list(1000)
    
    stats = {
        "total_created": len(all_vouchers),
        "total_value_created": sum(v["original_amount"] for v in all_vouchers),
        "active": {
            "count": len([v for v in all_vouchers if v["status"] == "active"]),
            "value": sum(v["amount"] for v in all_vouchers if v["status"] == "active"),
        },
        "redeemed": {
            "count": len([v for v in all_vouchers if v["status"] == "redeemed"]),
            "value": sum(v["original_amount"] for v in all_vouchers if v["status"] == "redeemed"),
        },
        "cancelled": {
            "count": len([v for v in all_vouchers if v["status"] == "cancelled"]),
            "value": sum(v["original_amount"] for v in all_vouchers if v["status"] == "cancelled"),
        },
        "expired": {
            "count": len([v for v in all_vouchers if v["status"] == "expired"]),
            "value": sum(v["original_amount"] for v in all_vouchers if v["status"] == "expired"),
        },
    }
    
    return {"stats": stats}
