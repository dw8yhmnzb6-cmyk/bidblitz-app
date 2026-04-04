from fastapi import APIRouter, HTTPException, Request
from bson import ObjectId
from datetime import datetime, timezone
from core.database import db
from core.security import get_current_user
from core.config import calculate_fee, FEES
from core.rate_limit import limiter, RATE_PAYMENT
from core.audit import log_audit, AuditEvent, get_client_info
from core.compliance import run_compliance_check, BLOCKED, FLAGGED
from schemas.models import PaymentRequest, SendRequest, MerchantScanPayment
import secrets

router = APIRouter(prefix="/api/payment", tags=["payment"])


def generate_reference():
    return f"BLZ-{secrets.token_hex(4).upper()}"


@router.get("/fee-preview")
async def fee_preview(amount: float, fee_type: str = "payment"):
    """Preview fee breakdown before payment."""
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be positive")
    fee = calculate_fee(amount, fee_type)
    return {
        "gross_amount": round(amount, 2),
        "fee_amount": fee,
        "fee_percent": FEES.get(fee_type, 0.0) * 100,
        "net_amount": round(amount - fee, 2),
        "total_charged": round(amount, 2),
    }


@router.post("/pay")
@limiter.limit(RATE_PAYMENT)
async def pay(req: PaymentRequest, request: Request):
    user = await get_current_user(request)
    user_id = str(user["_id"])
    current_balance = user.get("balance", 0.0)
    ip, ua = get_client_info(request)

    if req.amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be positive")

    # ── Compliance check ──
    compliance = await run_compliance_check(user_id, "payment", req.amount)
    if compliance["outcome"] == BLOCKED:
        await log_audit(AuditEvent.PAYMENT_FAILED, user_id=user_id, email=user["email"],
                        ip=ip, user_agent=ua,
                        details={"reason": "compliance_blocked", "rules": compliance["rules"], "amount": req.amount},
                        severity="warn")
        raise HTTPException(status_code=403, detail=compliance["reason"])
    if compliance["outcome"] == FLAGGED:
        await log_audit(AuditEvent.SUSPICIOUS_ACTIVITY, user_id=user_id, email=user["email"],
                        ip=ip, user_agent=ua,
                        details={"txn_type": "payment", "rules": compliance["rules"], "amount": req.amount},
                        severity="warn")

    if current_balance < req.amount:
        await log_audit(AuditEvent.PAYMENT_FAILED, user_id=user_id, email=user["email"],
                        ip=ip, user_agent=ua,
                        details={"reason": "insufficient_balance", "amount": req.amount, "balance": current_balance},
                        severity="warn")
        raise HTTPException(status_code=400, detail=f"Insufficient balance. Current: EUR {current_balance:.2f}")

    ref = generate_reference()

    # Calculate platform fee
    fee = calculate_fee(req.amount, "payment")
    net_to_merchant = round(req.amount - fee, 2)

    # Find merchant
    merchant = None
    if req.merchant_id and ObjectId.is_valid(req.merchant_id):
        merchant = await db.merchants.find_one({"_id": ObjectId(req.merchant_id)})
    if not merchant and req.merchant_id:
        merchant = await db.merchants.find_one({"user_id": req.merchant_id})
    merchant_name = merchant["business_name"] if merchant else "Unknown Merchant"

    # Deduct full amount from user
    await db.users.update_one(
        {"_id": user["_id"]},
        {"$inc": {"balance": -req.amount}}
    )

    # Credit net amount to merchant, track fees
    if merchant:
        await db.merchants.update_one(
            {"_id": merchant["_id"]},
            {
                "$inc": {
                    "total_earnings": net_to_merchant,
                    "gross_earnings": req.amount,
                    "total_fees": fee,
                    "total_transactions": 1,
                    "available_payout": net_to_merchant,
                }
            }
        )

    now = datetime.now(timezone.utc).isoformat()

    # Customer transaction (debit)
    txn = {
        "id": secrets.token_hex(8),
        "user_id": user_id,
        "type": "payment",
        "amount": -req.amount,
        "gross_amount": req.amount,
        "fee_amount": fee,
        "net_amount": net_to_merchant,
        "description": req.description or f"Payment to {merchant_name}",
        "merchant_name": merchant_name,
        "merchant_id": str(merchant["_id"]) if merchant else "",
        "status": "completed",
        "reference": ref,
        "payment_method": "wallet",
        "category": "payment",
        "created_at": now,
    }
    await db.transactions.insert_one(txn)
    txn.pop("_id", None)

    # Merchant-side transaction (credit)
    if merchant:
        merchant_txn = {
            "id": secrets.token_hex(8),
            "user_id": merchant.get("user_id", ""),
            "type": "merchant_credit",
            "amount": net_to_merchant,
            "gross_amount": req.amount,
            "fee_amount": fee,
            "net_amount": net_to_merchant,
            "description": f"Payment from {user['name']}",
            "merchant_name": merchant_name,
            "customer_name": user["name"],
            "status": "completed",
            "reference": ref,
            "category": "income",
            "created_at": now,
        }
        await db.transactions.insert_one(merchant_txn)

    updated_user = await db.users.find_one({"_id": user["_id"]})

    await log_audit(AuditEvent.PAYMENT_SUCCESS, user_id=user_id, email=user["email"],
                    ip=ip, user_agent=ua,
                    details={"reference": ref, "amount": req.amount, "fee": fee,
                             "merchant": merchant_name, "new_balance": updated_user["balance"]})

    return {
        "success": True,
        "new_balance": updated_user["balance"],
        "gross_amount": req.amount,
        "fee_amount": fee,
        "fee_percent": FEES["payment"] * 100,
        "net_amount": net_to_merchant,
        "merchant_name": merchant_name,
        "transaction": txn,
    }


@router.post("/send")
async def send_money(req: SendRequest, request: Request):
    user = await get_current_user(request)
    user_id = str(user["_id"])
    current_balance = user.get("balance", 0.0)
    ip, ua = get_client_info(request)

    if req.amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be positive")

    # ── Compliance check ──
    compliance = await run_compliance_check(user_id, "send", req.amount)
    if compliance["outcome"] == BLOCKED:
        await log_audit(AuditEvent.SEND_FAILED, user_id=user_id, email=user["email"],
                        ip=ip, user_agent=ua,
                        details={"reason": "compliance_blocked", "rules": compliance["rules"], "amount": req.amount},
                        severity="warn")
        raise HTTPException(status_code=403, detail=compliance["reason"])
    if compliance["outcome"] == FLAGGED:
        await log_audit(AuditEvent.SUSPICIOUS_ACTIVITY, user_id=user_id, email=user["email"],
                        ip=ip, user_agent=ua,
                        details={"txn_type": "send", "rules": compliance["rules"], "amount": req.amount},
                        severity="warn")

    # Calculate send fee
    fee = calculate_fee(req.amount, "send")
    total_debit = round(req.amount + fee, 2)

    if current_balance < total_debit:
        await log_audit(AuditEvent.SEND_FAILED, user_id=user_id, email=user["email"],
                        ip=ip, user_agent=ua,
                        details={"reason": "insufficient_balance", "amount": req.amount, "balance": current_balance},
                        severity="warn")
        raise HTTPException(status_code=400, detail=f"Insufficient balance. Need EUR {total_debit:.2f}, have EUR {current_balance:.2f}")

    recipient = await db.users.find_one({"email": req.recipient_email.lower().strip()})
    if not recipient:
        raise HTTPException(status_code=404, detail="Recipient not found")

    if str(recipient["_id"]) == user_id:
        raise HTTPException(status_code=400, detail="Cannot send money to yourself")

    ref = generate_reference()
    now = datetime.now(timezone.utc).isoformat()

    # Deduct from sender (amount + fee)
    await db.users.update_one({"_id": user["_id"]}, {"$inc": {"balance": -total_debit}})

    # Credit recipient (full amount, no fee on receiving side)
    await db.users.update_one({"_id": recipient["_id"]}, {"$inc": {"balance": req.amount}})

    sender_txn = {
        "id": secrets.token_hex(8),
        "user_id": user_id,
        "type": "send",
        "amount": -total_debit,
        "gross_amount": req.amount,
        "fee_amount": fee,
        "net_amount": req.amount,
        "description": req.description or f"Sent to {recipient['name']}",
        "merchant_name": "",
        "status": "completed",
        "reference": ref,
        "payment_method": "wallet",
        "category": "transfer",
        "created_at": now,
    }

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

    await log_audit(AuditEvent.SEND_SUCCESS, user_id=user_id, email=user["email"],
                    ip=ip, user_agent=ua,
                    details={"reference": ref, "amount": req.amount, "fee": fee,
                             "recipient_email": req.recipient_email, "new_balance": updated_user["balance"]})

    return {
        "success": True,
        "new_balance": updated_user["balance"],
        "fee_amount": fee,
        "transaction": sender_txn,
    }


# ── Customer Barcode ──

import re
import hmac
import hashlib
import time

_BARCODE_RE = re.compile(r"^BLZ-[A-F0-9]{12}$")
_DYNAMIC_QR_RE = re.compile(r"^BLZ-[A-F0-9]{12}-[A-F0-9]{8}$")
QR_ROTATION_SECONDS = 300  # 5 minutes


def _generate_qr_token(base_barcode: str, time_slot: int) -> str:
    """Generate a time-based token for the dynamic QR code."""
    payload = f"{base_barcode}:{time_slot}".encode()
    h = hmac.new(b"bidblitz-qr-secret", payload, hashlib.sha256).hexdigest()[:8].upper()
    return h


def _get_current_time_slot():
    return int(time.time()) // QR_ROTATION_SECONDS


@router.get("/my-barcode")
async def get_my_barcode(request: Request):
    """Get or generate a dynamic payment QR code for the current user.
    QR code rotates every 5 minutes for security."""
    user = await get_current_user(request)
    user_id = str(user["_id"])

    barcode = user.get("payment_barcode")
    if not barcode:
        barcode = f"BLZ-{secrets.token_hex(6).upper()}"
        await db.users.update_one({"_id": user["_id"]}, {"$set": {"payment_barcode": barcode}})

    time_slot = _get_current_time_slot()
    token = _generate_qr_token(barcode, time_slot)
    dynamic_qr = f"{barcode}-{token}"

    now = int(time.time())
    expires_in = QR_ROTATION_SECONDS - (now % QR_ROTATION_SECONDS)

    return {
        "barcode": dynamic_qr,
        "user_id": user_id,
        "name": user.get("name", ""),
        "expires_in": expires_in,
        "rotation_seconds": QR_ROTATION_SECONDS,
    }


# ── Merchant-Initiated Scan Payment ──


@router.post("/merchant-scan")
@limiter.limit(RATE_PAYMENT)
async def merchant_scan_payment(req: MerchantScanPayment, request: Request):
    """
    Merchant scans customer barcode to initiate a payment.
    Idempotent: if idempotency_key is provided and already processed, returns cached result.
    Uses atomic balance update to prevent double-charge.
    """
    merchant_user = await get_current_user(request)
    merchant_user_id = str(merchant_user["_id"])
    ip, ua = get_client_info(request)

    # ── 1. Dynamic QR code validation ──
    raw_code = req.customer_barcode.strip().upper()

    # Support both old static format (BLZ-XXXXXXXXXXXX) and new dynamic (BLZ-XXXXXXXXXXXX-XXXXXXXX)
    if _DYNAMIC_QR_RE.match(raw_code):
        base_barcode = raw_code[:16]  # BLZ-XXXXXXXXXXXX
        submitted_token = raw_code[17:]  # XXXXXXXX

        # Validate against current and previous time slot (grace period)
        current_slot = _get_current_time_slot()
        valid_token = False
        for slot in [current_slot, current_slot - 1]:
            expected = _generate_qr_token(base_barcode, slot)
            if submitted_token == expected:
                valid_token = True
                break

        if not valid_token:
            raise HTTPException(status_code=400, detail="scan.qr_expired")

        barcode = base_barcode
    elif _BARCODE_RE.match(raw_code):
        barcode = raw_code
    else:
        raise HTTPException(status_code=400, detail="scan.invalid_barcode_format")

    # ── 2. Idempotency check ──
    idem_key = req.idempotency_key
    if idem_key:
        existing = await db.transactions.find_one(
            {"idempotency_key": idem_key, "payment_method": "barcode_scan"},
            {"_id": 0}
        )
        if existing:
            # Already processed — return cached success
            return {
                "success": True,
                "reference": existing["reference"],
                "amount": existing.get("gross_amount", abs(existing.get("amount", 0))),
                "fee": existing.get("fee_amount", 0),
                "net_to_merchant": existing.get("net_amount", 0),
                "customer_name": existing.get("description", "").replace("Payment to ", ""),
                "customer_new_balance": 0,  # Not re-fetched for cached
                "merchant_name": existing.get("merchant_name", ""),
                "transaction": existing,
                "duplicate": True,
            }

    # ── 3. Merchant profile ──
    merchant = await db.merchants.find_one({"user_id": merchant_user_id})
    if not merchant:
        raise HTTPException(status_code=403, detail="No merchant profile found")

    merchant_name = merchant.get("business_name", "Unknown Merchant")

    # ── 4. Find customer by barcode ──
    customer = await db.users.find_one({"payment_barcode": barcode})
    if not customer:
        await log_audit(AuditEvent.PAYMENT_FAILED, user_id=merchant_user_id, email=merchant_user["email"],
                        ip=ip, user_agent=ua,
                        details={"reason": "invalid_barcode", "barcode": barcode[:8] + "***"},
                        severity="warn")
        raise HTTPException(status_code=404, detail="scan.barcode_not_found")

    customer_id = str(customer["_id"])

    if customer_id == merchant_user_id:
        raise HTTPException(status_code=400, detail="Cannot charge yourself")

    # ── 5. Compliance check ──
    compliance = await run_compliance_check(customer_id, "payment", req.amount)
    if compliance["outcome"] == BLOCKED:
        await log_audit(AuditEvent.PAYMENT_FAILED, user_id=customer_id, email=customer["email"],
                        ip=ip, user_agent=ua,
                        details={"reason": "compliance_blocked", "rules": compliance["rules"], "amount": req.amount,
                                 "initiated_by": "merchant", "merchant_id": merchant_user_id},
                        severity="warn")
        raise HTTPException(status_code=403, detail=compliance["reason"])

    # ── 6. Atomic balance deduction (prevents double-charge via race condition) ──
    ref = generate_reference()
    fee = calculate_fee(req.amount, "payment")
    net_to_merchant = round(req.amount - fee, 2)
    now = datetime.now(timezone.utc).isoformat()

    deduct_result = await db.users.update_one(
        {"_id": customer["_id"], "balance": {"$gte": req.amount}},
        {"$inc": {"balance": -req.amount}},
    )

    if deduct_result.modified_count == 0:
        # Balance was insufficient (or changed between check and deduct)
        await log_audit(AuditEvent.PAYMENT_FAILED, user_id=customer_id, email=customer["email"],
                        ip=ip, user_agent=ua,
                        details={"reason": "insufficient_balance", "amount": req.amount, "initiated_by": "merchant"},
                        severity="warn")
        raise HTTPException(status_code=400, detail="scan.insufficient")

    # ── 7. Credit merchant (only after successful deduction) ──
    await db.merchants.update_one(
        {"_id": merchant["_id"]},
        {"$inc": {
            "total_earnings": net_to_merchant,
            "gross_earnings": req.amount,
            "total_fees": fee,
            "total_transactions": 1,
            "available_payout": net_to_merchant,
        }}
    )

    # ── 8. Create transaction records ──
    base_txn = {
        "reference": ref,
        "gross_amount": req.amount,
        "fee_amount": fee,
        "net_amount": net_to_merchant,
        "merchant_name": merchant_name,
        "merchant_id": str(merchant["_id"]),
        "status": "completed",
        "payment_method": "barcode_scan",
        "created_at": now,
    }
    if idem_key:
        base_txn["idempotency_key"] = idem_key

    customer_txn = {
        **base_txn,
        "id": secrets.token_hex(8),
        "user_id": customer_id,
        "type": "payment",
        "amount": -req.amount,
        "description": req.description or f"Payment to {merchant_name}",
        "category": "payment",
    }
    await db.transactions.insert_one(customer_txn)
    customer_txn.pop("_id", None)

    merchant_txn = {
        **base_txn,
        "id": secrets.token_hex(8),
        "user_id": merchant_user_id,
        "type": "merchant_credit",
        "amount": net_to_merchant,
        "description": f"Barcode payment from {customer.get('name', 'Customer')}",
        "category": "income",
    }
    await db.transactions.insert_one(merchant_txn)

    # ── 9. Fetch updated balance ──
    updated_customer = await db.users.find_one({"_id": customer["_id"]})

    # ── 10. Audit log ──
    await log_audit(AuditEvent.PAYMENT_SUCCESS, user_id=customer_id, email=customer["email"],
                    ip=ip, user_agent=ua,
                    details={"reference": ref, "amount": req.amount, "fee": fee,
                             "merchant": merchant_name, "initiated_by": "merchant_scan",
                             "merchant_user_id": merchant_user_id,
                             "idempotency_key": idem_key or "none"})

    return {
        "success": True,
        "reference": ref,
        "amount": req.amount,
        "fee": fee,
        "net_to_merchant": net_to_merchant,
        "customer_name": customer.get("name", "Customer"),
        "customer_new_balance": updated_customer["balance"],
        "merchant_name": merchant_name,
        "transaction": customer_txn,
    }
