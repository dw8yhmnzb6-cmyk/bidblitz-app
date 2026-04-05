"""
BidBlitz V2 — POS Payment System
- Dynamic barcode per user, refreshes for security
- Merchant scans customer barcode to process instant wallet payment
- NFC payment with tiered fees (wallet lowest, card highest)
- Payment type detection (wallet / card / contactless)
- Receipt generation
- Daily revenue summary for terminal
- Ultra-fast mode for small amounts
- Merchant onboarding (free trial)
- Pricing model endpoints
"""
import secrets
import hashlib
import logging
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from typing import Optional
from bson import ObjectId
from core.database import db

router = APIRouter(prefix="/api/payments", tags=["Payments"])
logger = logging.getLogger("bidblitz.payments")

# Fee structure
WALLET_FEE_RATE = 0.005       # 0.5% for wallet/barcode
CARD_FEE_RATE = 0.025         # 2.5% for card/NFC
NFC_WALLET_FEE_RATE = 0.003   # 0.3% for NFC wallet (incentive)
ULTRA_FAST_LIMIT = 25.0       # EUR — no extra confirmation needed
PIN_REQUIRED_LIMIT = 50.0     # EUR — PIN required above this

BARCODE_VALIDITY_SECONDS = 120


async def get_current_user(request: Request):
    from routes.auth import get_current_user as auth_user
    return await auth_user(request)


def generate_barcode_token(user_id: str) -> str:
    salt = secrets.token_hex(8)
    raw = f"{user_id}:{salt}:{datetime.now(timezone.utc).isoformat()}"
    token = hashlib.sha256(raw.encode()).hexdigest()[:16].upper()
    return f"BLZ-{token}"


def detect_payment_type(method: str) -> dict:
    """Detect payment type and return fee rate + label."""
    types = {
        "wallet": {"fee_rate": WALLET_FEE_RATE, "label": "BidBlitz Wallet", "category": "wallet"},
        "barcode": {"fee_rate": WALLET_FEE_RATE, "label": "Barcode/QR", "category": "barcode"},
        "nfc_wallet": {"fee_rate": NFC_WALLET_FEE_RATE, "label": "NFC Wallet", "category": "nfc_wallet"},
        "nfc_card": {"fee_rate": CARD_FEE_RATE, "label": "Contactless Card", "category": "nfc_card"},
        "apple_pay": {"fee_rate": CARD_FEE_RATE, "label": "Apple Pay", "category": "apple_pay"},
        "google_pay": {"fee_rate": CARD_FEE_RATE, "label": "Google Pay", "category": "google_pay"},
        "card": {"fee_rate": CARD_FEE_RATE, "label": "Card Payment", "category": "card"},
    }
    return types.get(method, types["card"])


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
    merchant_user = await get_current_user(request)
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

    pt = detect_payment_type(req.payment_method or "barcode")
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

    if mp:
        await db.merchant_profiles.update_one(
            {"_id": mp["_id"]}, {"$inc": {"total_revenue": req.amount, "total_fees": fee}},
        )

    await db.payment_barcodes.update_one({"_id": bc["_id"]}, {"$set": {"active": False}})

    txn_id = secrets.token_hex(8)
    now_iso = now.isoformat()

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

    return {
        "ok": True, "transaction_id": txn_id,
        "amount": req.amount, "fee": fee, "net": net,
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

    pt = detect_payment_type(req.payment_method)
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

    if mid:
        await db.merchant_profiles.update_one(
            {"_id": mp["_id"]}, {"$inc": {"total_revenue": req.amount, "total_fees": fee}},
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

    receipt = generate_receipt(
        txn_id, req.amount, fee, net, pt,
        customer_name, merchant_name, req.description or "NFC Payment",
    )

    return {
        "ok": True, "transaction_id": txn_id,
        "amount": req.amount, "fee": fee, "net": net,
        "fee_rate": round(pt["fee_rate"] * 100, 2),
        "payment_method": pt["category"],
        "payment_type_label": pt["label"],
        "customer_name": customer_name,
        "ultra_fast": req.amount <= ULTRA_FAST_LIMIT,
        "receipt": receipt,
    }


# ══════════════════════════════════════
# FEE INFO
# ══════════════════════════════════════

@router.get("/fee-info")
async def get_fee_info(request: Request):
    return {
        "methods": [
            {"method": "nfc_wallet", "fee_rate": NFC_WALLET_FEE_RATE * 100, "label": "NFC Wallet", "description": "Lowest fees — 0.3%"},
            {"method": "barcode_wallet", "fee_rate": WALLET_FEE_RATE * 100, "label": "Barcode/QR", "description": "Low fees — 0.5%"},
            {"method": "nfc_card", "fee_rate": CARD_FEE_RATE * 100, "label": "Contactless Card", "description": "Standard — 2.5%"},
            {"method": "apple_pay", "fee_rate": CARD_FEE_RATE * 100, "label": "Apple Pay", "description": "Standard — 2.5%"},
            {"method": "google_pay", "fee_rate": CARD_FEE_RATE * 100, "label": "Google Pay", "description": "Standard — 2.5%"},
        ],
        "ultra_fast_limit": ULTRA_FAST_LIMIT,
        "pin_required_limit": PIN_REQUIRED_LIMIT,
    }


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
# RECEIPT: Get receipt by transaction ID
# ══════════════════════════════════════

@router.get("/receipt/{txn_id}")
async def get_receipt(txn_id: str, request: Request):
    txn = await db.merchant_transactions.find_one({"_id": ObjectId(txn_id)}, {"_id": 0})
    if not txn:
        txn = await db.merchant_transactions.find_one({"transaction_id": txn_id}, {"_id": 0})
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")

    pt = detect_payment_type(txn.get("payment_method", "card"))
    mp = None
    if txn.get("merchant_id"):
        mp = await db.merchant_profiles.find_one({"_id": ObjectId(txn["merchant_id"])})

    return generate_receipt(
        txn_id, txn.get("amount", 0), txn.get("fee", 0), txn.get("net", 0), pt,
        txn.get("customer_name", ""), mp.get("business_name", "") if mp else "",
        txn.get("description", "Payment"),
    )


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
