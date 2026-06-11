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
import io
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from typing import Optional
from bson import ObjectId
from fpdf import FPDF
from core.database import db

router = APIRouter(prefix="/api/payments", tags=["Payments"])
logger = logging.getLogger("bidblitz.payments")

# Default fee structure (overridable by admin via DB)
DEFAULT_FEES = {
    "wallet": 0.005,
    "barcode": 0.005,
    "nfc_wallet": 0.003,
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


async def get_current_user(request: Request):
    from routes.auth import get_current_user as auth_user
    return await auth_user(request)


async def get_fee_rates() -> dict:
    """Get fee rates from DB or fallback to defaults."""
    cfg = await db.fee_config.find_one({"_id": "merchant_fees"})
    if cfg:
        return {k: cfg.get(k, DEFAULT_FEES.get(k, 0.025)) for k in DEFAULT_FEES}
    return dict(DEFAULT_FEES)


def generate_barcode_token(user_id: str) -> str:
    salt = secrets.token_hex(8)
    raw = f"{user_id}:{salt}:{datetime.now(timezone.utc).isoformat()}"
    token = hashlib.sha256(raw.encode()).hexdigest()[:16].upper()
    return f"BLZ-{token}"


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
            return {
                "barcode": existing["barcode"],
                "expires_at": existing["expires_at"],
                "seconds_remaining": int((expires - now).total_seconds()),
                "user_name": user.get("name", ""),
                "balance": user.get("balance", 0),
            }
        await db.payment_barcodes.update_one({"_id": existing["_id"]}, {"$set": {"active": False}})

    barcode = generate_barcode_token(uid)
    expires_at = (now + timedelta(seconds=BARCODE_VALIDITY_SECONDS)).isoformat()
    await db.payment_barcodes.insert_one({
        "user_id": uid, "barcode": barcode, "active": True,
        "expires_at": expires_at, "created_at": now.isoformat(),
    })
    return {
        "barcode": barcode, "expires_at": expires_at,
        "seconds_remaining": BARCODE_VALIDITY_SECONDS,
        "user_name": user.get("name", ""), "balance": user.get("balance", 0),
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
    return {"barcode": barcode, "expires_at": expires_at, "seconds_remaining": BARCODE_VALIDITY_SECONDS}


# ══════════════════════════════════════
# MERCHANT: Barcode Lookup
# ══════════════════════════════════════

@router.post("/barcode-lookup")
async def barcode_lookup(request: Request):
    await get_current_user(request)
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
        "customer_email": customer.get("email", ""),
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

    mp = await db.merchant_profiles.find_one({"user_id": merchant_uid})
    if not mp and merchant_user.get("role") not in ("merchant", "admin"):
        staff = await db.merchant_staff.find_one({"user_id": merchant_uid, "status": "active"})
        if not staff:
            raise HTTPException(status_code=403, detail="Merchant access required")
        mp = await db.merchant_profiles.find_one({"_id": ObjectId(staff["merchant_id"])})

    now = datetime.now(timezone.utc)
    bc = await db.payment_barcodes.find_one({"barcode": req.barcode, "active": True})
    if not bc:
        raise HTTPException(status_code=404, detail="Invalid or expired barcode")

    expires = datetime.fromisoformat(bc["expires_at"])
    if expires < now:
        await db.payment_barcodes.update_one({"_id": bc["_id"]}, {"$set": {"active": False}})
        raise HTTPException(status_code=400, detail="Barcode expired")

    customer_uid = bc["user_id"]
    customer = await db.users.find_one({"_id": ObjectId(customer_uid)})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    balance = customer.get("balance", 0)
    if balance < req.amount:
        raise HTTPException(status_code=400, detail="Insufficient balance")

    pt = await detect_payment_type(req.payment_method or "barcode")
    fee = round(req.amount * pt["fee_rate"], 2)
    net = round(req.amount - fee, 2)

    result = await db.users.update_one(
        {"_id": ObjectId(customer_uid), "balance": {"$gte": req.amount}},
        {"$inc": {"balance": -req.amount}},
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=400, detail="Payment failed — balance changed")

    mid = str(mp["_id"]) if mp else ""
    merchant_name = mp.get("business_name", "") if mp else ""
    merchant_owner_id = mp.get("user_id", "") if mp else ""

    # Generate transaction ID early
    txn_id = secrets.token_hex(8)
    now_iso = now.isoformat()

    if mp:
        await db.merchant_profiles.update_one(
            {"_id": mp["_id"]}, {"$inc": {"total_revenue": req.amount, "total_fees": fee}},
        )
        if merchant_owner_id:
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
        
        # WALLET-ONLY ECOSYSTEM: Credit merchant wallet directly
        if merchant_owner_id:
            await db.users.update_one(
                {"_id": ObjectId(merchant_owner_id)},
                {"$inc": {"balance": net}}
            )
            await db.transactions.insert_one({
                "id": secrets.token_hex(8),
                "user_id": merchant_owner_id,
                "type": "merchant_earning",
                "amount": net,
                "description": f"POS Zahlung: {req.description or 'Payment'}",
                "status": "completed",
                "reference": f"MERCH-{txn_id[:8].upper()}",
                "category": "merchant_earning",
                "fee_deducted": fee,
                "gross_amount": req.amount,
                "created_at": now_iso,
            })

    await db.payment_barcodes.update_one({"_id": bc["_id"]}, {"$set": {"active": False}})

    await db.transactions.insert_one({
        "id": txn_id, "user_id": customer_uid, "type": "payment",
        "amount": -req.amount, "description": req.description,
        "status": "completed", "reference": f"BRC-{secrets.token_hex(4).upper()}",
        "category": pt["category"], "merchant_id": mid, "created_at": now_iso,
    })

    if mid:
        await db.merchant_transactions.insert_one({
            "merchant_id": mid, "branch_id": "", "device_id": "barcode",
            "amount": req.amount, "fee": fee, "net": net,
            "commission_rate": pt["fee_rate"] * 100,
            "description": req.description,
            "customer_ref": customer.get("email", ""),
            "customer_name": customer.get("name", ""),
            "payment_method": pt["category"],
            "payment_type_label": pt["label"],
            "status": "completed", "created_at": now_iso,
        })

    updated_customer = await db.users.find_one({"_id": ObjectId(customer_uid)})

    receipt = generate_receipt(
        txn_id, req.amount, fee, net, pt,
        customer.get("name", ""), merchant_name, req.description or "Payment",
    )

    # Send receipt email to customer
    try:
        from core.email import send_receipt_email
        send_receipt_email(
            to=customer.get("email", ""),
            transaction_id=txn_id,
            amount=req.amount,
            fee=fee,
            net_amount=net,
            description=req.description or "Payment",
            merchant_name=merchant_name,
            user_name=customer.get("name", "")
        )
    except Exception:
        pass  # Non-critical

    return {
        "ok": True, "transaction_id": txn_id,
        "amount": req.amount, "fee": fee, "net": net,
        "customer_id": customer_uid,
        "customer_name": customer.get("name", ""),
        "customer_balance": updated_customer.get("balance", 0),
        "payment_method": pt["category"],
        "payment_type_label": pt["label"],
        "ultra_fast": req.amount <= ULTRA_FAST_LIMIT,
        "receipt": receipt,
    }


# ══════════════════════════════════════
# NFC PAYMENT (with type detection)
# ══════════════════════════════════════

class NfcPaymentRequest(BaseModel):
    customer_id: Optional[str] = None
    amount: float = Field(..., gt=0)
    payment_method: str = "nfc_wallet"
    description: Optional[str] = "NFC Payment"
    device_id: Optional[str] = ""


@router.post("/nfc-pay")
async def process_nfc_payment(req: NfcPaymentRequest, request: Request):
    merchant_user = await get_current_user(request)
    merchant_uid = str(merchant_user["_id"])

    mp = await db.merchant_profiles.find_one({"user_id": merchant_uid})
    if not mp and merchant_user.get("role") not in ("merchant", "admin"):
        staff = await db.merchant_staff.find_one({"user_id": merchant_uid, "status": "active"})
        if not staff:
            raise HTTPException(status_code=403, detail="Merchant access required")
        mp = await db.merchant_profiles.find_one({"_id": ObjectId(staff["merchant_id"])})

    mid = str(mp["_id"]) if mp else ""
    merchant_name = mp.get("business_name", "") if mp else ""
    now = datetime.now(timezone.utc)
    now_iso = now.isoformat()

    pt = await detect_payment_type(req.payment_method)
    fee = round(req.amount * pt["fee_rate"], 2)
    net = round(req.amount - fee, 2)
    customer_name = ""

    if req.payment_method in ("nfc_wallet", "wallet"):
        if not req.customer_id:
            raise HTTPException(status_code=400, detail="Customer ID required for wallet payment")
        customer = await db.users.find_one({"_id": ObjectId(req.customer_id)})
        if not customer:
            raise HTTPException(status_code=404, detail="Customer not found")
        if customer.get("balance", 0) < req.amount:
            raise HTTPException(status_code=400, detail="Insufficient balance")

        result = await db.users.update_one(
            {"_id": ObjectId(req.customer_id), "balance": {"$gte": req.amount}},
            {"$inc": {"balance": -req.amount}},
        )
        if result.modified_count == 0:
            raise HTTPException(status_code=400, detail="Payment failed")

        customer_name = customer.get("name", "")
        await db.transactions.insert_one({
            "id": secrets.token_hex(8), "user_id": req.customer_id,
            "type": "payment", "amount": -req.amount,
            "description": req.description, "status": "completed",
            "reference": f"NFC-{secrets.token_hex(4).upper()}",
            "category": pt["category"], "merchant_id": mid, "created_at": now_iso,
        })

    txn_id = secrets.token_hex(8)
    merchant_owner_id = mp.get("user_id", "") if mp else ""

    if mid:
        await db.merchant_profiles.update_one(
            {"_id": mp["_id"]}, {"$inc": {"total_revenue": req.amount, "total_fees": fee}},
        )
        if merchant_owner_id:
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
        await db.merchant_transactions.insert_one({
            "merchant_id": mid, "branch_id": "", "device_id": req.device_id or "nfc",
            "amount": req.amount, "fee": fee, "net": net,
            "commission_rate": pt["fee_rate"] * 100,
            "description": req.description,
            "customer_ref": req.customer_id or "card",
            "customer_name": customer_name,
            "payment_method": pt["category"],
            "payment_type_label": pt["label"],
            "status": "completed", "created_at": now_iso,
        })
        
        # WALLET-ONLY ECOSYSTEM: Credit merchant wallet directly
        if merchant_owner_id:
            await db.users.update_one(
                {"_id": ObjectId(merchant_owner_id)},
                {"$inc": {"balance": net}}
            )
            await db.transactions.insert_one({
                "id": secrets.token_hex(8),
                "user_id": merchant_owner_id,
                "type": "merchant_earning",
                "amount": net,
                "description": f"NFC Zahlung: {req.description or 'Payment'}",
                "status": "completed",
                "reference": f"MERCH-{txn_id[:8].upper()}",
                "category": "merchant_earning",
                "fee_deducted": fee,
                "gross_amount": req.amount,
                "created_at": now_iso,
            })

    receipt = generate_receipt(
        txn_id, req.amount, fee, net, pt,
        customer_name, merchant_name, req.description or "NFC Payment",
    )

    # Send receipt email to customer (if wallet payment with customer_id)
    if customer_name and req.customer_id:
        try:
            from core.email import send_receipt_email
            customer_doc = await db.users.find_one({"_id": ObjectId(req.customer_id)})
            if customer_doc:
                send_receipt_email(
                    to=customer_doc.get("email", ""),
                    transaction_id=txn_id,
                    amount=req.amount,
                    fee=fee,
                    net_amount=net,
                    description=req.description or "NFC Payment",
                    merchant_name=merchant_name,
                    user_name=customer_name
                )
        except Exception:
            pass  # Non-critical

    return {
        "ok": True, "transaction_id": txn_id,
        "amount": req.amount, "fee": fee, "net": net,
        "fee_rate": round(pt["fee_rate"] * 100, 2),
        "payment_method": pt["category"],
        "payment_type_label": pt["label"],
        "customer_id": req.customer_id or "",
        "customer_name": customer_name,
        "ultra_fast": req.amount <= ULTRA_FAST_LIMIT,
        "receipt": receipt,
    }


# ══════════════════════════════════════
# FEE INFO
# ══════════════════════════════════════

@router.get("/fee-info")
async def get_fee_info(request: Request):
    rates = await get_fee_rates()
    methods = []
    for method, rate in rates.items():
        methods.append({
            "method": method,
            "fee_rate": round(rate * 100, 2),
            "label": FEE_LABELS.get(method, method),
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
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    rates = await get_fee_rates()
    return {"fees": {k: round(v * 100, 4) for k, v in rates.items()}}


@router.post("/admin/fees")
async def set_admin_fees(request: Request):
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    body = await request.json()
    fees = body.get("fees", {})
    update = {}
    for k in DEFAULT_FEES:
        if k in fees:
            val = float(fees[k]) / 100  # Input is percentage, store as decimal
            if val < 0 or val > 0.5:
                raise HTTPException(status_code=400, detail=f"Fee for {k} must be between 0% and 50%")
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
    if not mp and user.get("role") not in ("merchant", "admin"):
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
    return {
        "plans": [
            {
                "id": "starter",
                "name": "Starter",
                "price": 0,
                "price_label": "Free",
                "description": "Perfect for small businesses getting started",
                "features": [
                    "BidBlitz Wallet payments (0.5% fee)",
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
                    "NFC Wallet payments (0.3% fee)",
                    "Card/contactless (2.5% fee)",
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
            "wallet": {"rate": 0.5, "label": "BidBlitz Wallet"},
            "nfc_wallet": {"rate": 0.3, "label": "NFC Wallet"},
            "barcode": {"rate": 0.5, "label": "Barcode/QR"},
            "card": {"rate": 2.5, "label": "Card/Contactless"},
            "apple_pay": {"rate": 2.5, "label": "Apple Pay"},
            "google_pay": {"rate": 2.5, "label": "Google Pay"},
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
    is_admin = user.get("role") == "admin"

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
    is_admin = user.get("role") == "admin"

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
    """Händler erstellt einen Gutschein (wird vom Händler-Wallet abgezogen)."""
    merchant_user = await get_current_user(request)
    merchant_uid = str(merchant_user["_id"])
    
    # Check merchant role
    if merchant_user.get("role") not in ("merchant", "admin"):
        mp = await db.merchant_profiles.find_one({"user_id": merchant_uid})
        if not mp:
            raise HTTPException(status_code=403, detail="Nur Händler können Gutscheine erstellen")
    
    # WALLET-ONLY: Check merchant balance
    merchant_balance = merchant_user.get("balance", 0)
    if merchant_balance < req.amount:
        raise HTTPException(
            status_code=400, 
            detail=f"Nicht genug Guthaben. Verfügbar: €{merchant_balance:.2f}, Benötigt: €{req.amount:.2f}"
        )
    
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(days=req.valid_days)
    
    # Generate unique voucher code
    voucher_code = f"BLZ-{secrets.token_hex(4).upper()}-{secrets.token_hex(2).upper()}"
    
    # Deduct from merchant wallet
    await db.users.update_one(
        {"_id": merchant_user["_id"]},
        {"$inc": {"balance": -req.amount}}
    )
    
    # Record transaction
    await db.transactions.insert_one({
        "id": secrets.token_hex(8),
        "user_id": merchant_uid,
        "type": "voucher_created",
        "amount": -req.amount,
        "description": f"Gutschein erstellt: {voucher_code}",
        "status": "completed",
        "reference": voucher_code,
        "category": "voucher",
        "created_at": now.isoformat(),
    })
    
    # Create voucher record
    voucher = {
        "voucher_code": voucher_code,
        "merchant_id": merchant_uid,
        "merchant_name": merchant_user.get("name", ""),
        "amount": req.amount,
        "original_amount": req.amount,
        "description": req.description,
        "single_use": req.single_use,
        "status": "active",  # active, redeemed, expired, cancelled
        "created_at": now.isoformat(),
        "expires_at": expires_at.isoformat(),
        "redeemed_by": None,
        "redeemed_at": None,
    }
    await db.vouchers.insert_one(voucher)
    voucher.pop("_id", None)
    
    # Optional: Send to recipient
    if req.recipient_email:
        voucher["sent_to"] = req.recipient_email
        # TODO: Send email with voucher code
    
    return {
        "ok": True,
        "voucher": voucher,
        "message": f"Gutschein {voucher_code} über €{req.amount:.2f} erstellt",
    }


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
    """Kunde löst Gutschein ein - Betrag wird auf Wallet gutgeschrieben."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    voucher = await db.vouchers.find_one({"voucher_code": req.voucher_code.upper()})
    if not voucher:
        raise HTTPException(status_code=404, detail="Gutschein nicht gefunden")
    
    now = datetime.now(timezone.utc)
    expires = datetime.fromisoformat(voucher["expires_at"])
    
    if voucher["status"] == "redeemed":
        raise HTTPException(status_code=400, detail="Gutschein bereits eingelöst")
    if voucher["status"] == "cancelled":
        raise HTTPException(status_code=400, detail="Gutschein storniert")
    if expires < now:
        await db.vouchers.update_one({"_id": voucher["_id"]}, {"$set": {"status": "expired"}})
        raise HTTPException(status_code=400, detail="Gutschein abgelaufen")
    
    amount = voucher["amount"]
    
    # Credit to customer wallet
    await db.users.update_one(
        {"_id": user["_id"]},
        {"$inc": {"balance": amount}}
    )
    
    # Record transaction
    await db.transactions.insert_one({
        "id": secrets.token_hex(8),
        "user_id": user_id,
        "type": "voucher_redeemed",
        "amount": amount,
        "description": f"Gutschein eingelöst: {req.voucher_code.upper()}",
        "status": "completed",
        "reference": req.voucher_code.upper(),
        "category": "voucher",
        "merchant_name": voucher.get("merchant_name", ""),
        "created_at": now.isoformat(),
    })
    
    # Update voucher status
    await db.vouchers.update_one(
        {"_id": voucher["_id"]},
        {"$set": {
            "status": "redeemed",
            "redeemed_by": user_id,
            "redeemed_by_name": user.get("name", ""),
            "redeemed_at": now.isoformat(),
        }}
    )
    
    updated_user = await db.users.find_one({"_id": user["_id"]})
    
    return {
        "ok": True,
        "amount": amount,
        "new_balance": round(updated_user.get("balance", 0), 2),
        "message": f"€{amount:.2f} auf dein Wallet gutgeschrieben!",
    }


# ── MERCHANT: Cancel Voucher ──
@router.post("/voucher/cancel/{voucher_code}")
async def cancel_voucher(voucher_code: str, request: Request):
    """Händler storniert einen nicht eingelösten Gutschein - Betrag zurück auf Wallet."""
    merchant_user = await get_current_user(request)
    merchant_uid = str(merchant_user["_id"])
    
    voucher = await db.vouchers.find_one({
        "voucher_code": voucher_code.upper(),
        "merchant_id": merchant_uid
    })
    
    if not voucher:
        raise HTTPException(status_code=404, detail="Gutschein nicht gefunden")
    
    if voucher["status"] == "redeemed":
        raise HTTPException(status_code=400, detail="Eingelöster Gutschein kann nicht storniert werden")
    if voucher["status"] == "cancelled":
        raise HTTPException(status_code=400, detail="Gutschein bereits storniert")
    
    now = datetime.now(timezone.utc)
    amount = voucher["amount"]
    
    # Refund to merchant wallet
    await db.users.update_one(
        {"_id": merchant_user["_id"]},
        {"$inc": {"balance": amount}}
    )
    
    # Record refund transaction
    await db.transactions.insert_one({
        "id": secrets.token_hex(8),
        "user_id": merchant_uid,
        "type": "voucher_cancelled",
        "amount": amount,
        "description": f"Gutschein storniert: {voucher_code.upper()}",
        "status": "completed",
        "reference": voucher_code.upper(),
        "category": "voucher",
        "created_at": now.isoformat(),
    })
    
    # Update voucher status
    await db.vouchers.update_one(
        {"_id": voucher["_id"]},
        {"$set": {"status": "cancelled", "cancelled_at": now.isoformat()}}
    )
    
    return {
        "ok": True,
        "refunded": amount,
        "message": f"Gutschein storniert. €{amount:.2f} zurück auf dein Wallet.",
    }


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
