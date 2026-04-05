"""
BidBlitz V2 — Barcode & NFC Payment System
- Dynamic QR/barcode per user, refreshes for security
- Merchant scans customer barcode to process instant wallet payment
- NFC payment support with tiered fees (wallet = lower, card = higher)
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
WALLET_FEE_RATE = 0.005   # 0.5% for wallet payments
CARD_FEE_RATE = 0.025     # 2.5% for card/NFC payments
NFC_WALLET_FEE_RATE = 0.003  # 0.3% for NFC wallet (incentive)

BARCODE_VALIDITY_SECONDS = 120  # 2 minutes


async def get_current_user(request: Request):
    from routes.auth import get_current_user as auth_user
    return await auth_user(request)


def generate_barcode_token(user_id: str) -> str:
    """Generate a time-based dynamic barcode token."""
    salt = secrets.token_hex(8)
    raw = f"{user_id}:{salt}:{datetime.now(timezone.utc).isoformat()}"
    token = hashlib.sha256(raw.encode()).hexdigest()[:16].upper()
    return f"BLZ-{token}"


# ══════════════════════════════════════
# USER: Get/Refresh personal barcode
# ══════════════════════════════════════

@router.get("/my-barcode")
async def get_my_barcode(request: Request):
    """Get user's current dynamic payment barcode. Auto-refreshes if expired."""
    user = await get_current_user(request)
    uid = str(user["_id"])
    now = datetime.now(timezone.utc)

    # Check existing barcode
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
        # Expired — deactivate
        await db.payment_barcodes.update_one({"_id": existing["_id"]}, {"$set": {"active": False}})

    # Generate new barcode
    barcode = generate_barcode_token(uid)
    expires_at = (now + timedelta(seconds=BARCODE_VALIDITY_SECONDS)).isoformat()

    await db.payment_barcodes.insert_one({
        "user_id": uid,
        "barcode": barcode,
        "active": True,
        "expires_at": expires_at,
        "created_at": now.isoformat(),
    })

    return {
        "barcode": barcode,
        "expires_at": expires_at,
        "seconds_remaining": BARCODE_VALIDITY_SECONDS,
        "user_name": user.get("name", ""),
        "balance": user.get("balance", 0),
    }


@router.post("/refresh-barcode")
async def refresh_barcode(request: Request):
    """Force-refresh the barcode."""
    user = await get_current_user(request)
    uid = str(user["_id"])

    # Deactivate all old barcodes
    await db.payment_barcodes.update_many({"user_id": uid}, {"$set": {"active": False}})

    now = datetime.now(timezone.utc)
    barcode = generate_barcode_token(uid)
    expires_at = (now + timedelta(seconds=BARCODE_VALIDITY_SECONDS)).isoformat()

    await db.payment_barcodes.insert_one({
        "user_id": uid,
        "barcode": barcode,
        "active": True,
        "expires_at": expires_at,
        "created_at": now.isoformat(),
    })

    return {
        "barcode": barcode,
        "expires_at": expires_at,
        "seconds_remaining": BARCODE_VALIDITY_SECONDS,
    }


# ══════════════════════════════════════
# MERCHANT: Process barcode payment
# ══════════════════════════════════════

class BarcodePaymentRequest(BaseModel):
    barcode: str
    amount: float = Field(..., gt=0)
    description: Optional[str] = "Payment"


@router.post("/barcode-pay")
async def process_barcode_payment(req: BarcodePaymentRequest, request: Request):
    """Merchant scans customer barcode and processes wallet payment instantly."""
    merchant_user = await get_current_user(request)
    merchant_uid = str(merchant_user["_id"])

    # Validate merchant
    mp = await db.merchant_profiles.find_one({"user_id": merchant_uid})
    if not mp and merchant_user.get("role") not in ("merchant", "admin"):
        # Check staff
        staff = await db.merchant_staff.find_one({"user_id": merchant_uid, "status": "active"})
        if not staff:
            raise HTTPException(status_code=403, detail="Merchant access required")
        mp = await db.merchant_profiles.find_one({"_id": ObjectId(staff["merchant_id"])})

    # Find barcode
    now = datetime.now(timezone.utc)
    bc = await db.payment_barcodes.find_one({
        "barcode": req.barcode,
        "active": True,
    })
    if not bc:
        raise HTTPException(status_code=404, detail="Invalid or expired barcode")

    # Check expiry
    expires = datetime.fromisoformat(bc["expires_at"])
    if expires < now:
        await db.payment_barcodes.update_one({"_id": bc["_id"]}, {"$set": {"active": False}})
        raise HTTPException(status_code=400, detail="Barcode expired")

    customer_uid = bc["user_id"]
    customer = await db.users.find_one({"_id": ObjectId(customer_uid)})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    # Check balance
    balance = customer.get("balance", 0)
    if balance < req.amount:
        raise HTTPException(status_code=400, detail="Insufficient balance")

    # Calculate fee
    fee = round(req.amount * WALLET_FEE_RATE, 2)
    net = round(req.amount - fee, 2)

    # Process payment atomically
    result = await db.users.update_one(
        {"_id": ObjectId(customer_uid), "balance": {"$gte": req.amount}},
        {"$inc": {"balance": -req.amount}},
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=400, detail="Payment failed — balance changed")

    # Credit merchant
    if mp:
        mid = str(mp["_id"])
        await db.merchant_profiles.update_one(
            {"_id": mp["_id"]},
            {"$inc": {"total_revenue": req.amount, "total_fees": fee}},
        )
    else:
        mid = ""

    # Invalidate barcode after use
    await db.payment_barcodes.update_one({"_id": bc["_id"]}, {"$set": {"active": False}})

    # Create transaction records
    txn_id = secrets.token_hex(8)
    now_iso = now.isoformat()

    # Customer transaction
    await db.transactions.insert_one({
        "id": txn_id,
        "user_id": customer_uid,
        "type": "payment",
        "amount": -req.amount,
        "description": req.description,
        "status": "completed",
        "reference": f"BRC-{secrets.token_hex(4).upper()}",
        "category": "barcode",
        "merchant_id": mid,
        "created_at": now_iso,
    })

    # Merchant transaction (for revenue tracking)
    if mid:
        await db.merchant_transactions.insert_one({
            "merchant_id": mid,
            "branch_id": "",
            "device_id": "barcode",
            "amount": req.amount,
            "fee": fee,
            "net": net,
            "commission_rate": WALLET_FEE_RATE * 100,
            "description": req.description,
            "customer_ref": customer.get("email", ""),
            "customer_name": customer.get("name", ""),
            "payment_method": "barcode",
            "status": "completed",
            "created_at": now_iso,
        })

    updated_customer = await db.users.find_one({"_id": ObjectId(customer_uid)})

    return {
        "ok": True,
        "transaction_id": txn_id,
        "amount": req.amount,
        "fee": fee,
        "net": net,
        "customer_name": customer.get("name", ""),
        "customer_balance": updated_customer.get("balance", 0),
        "payment_method": "barcode_wallet",
    }


# ══════════════════════════════════════
# MERCHANT: Lookup barcode (preview before confirm)
# ══════════════════════════════════════

@router.post("/barcode-lookup")
async def barcode_lookup(request: Request):
    """Look up a barcode to show customer name before confirming payment."""
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
        "barcode": barcode,
        "valid": True,
    }


# ══════════════════════════════════════
# NFC PAYMENT
# ══════════════════════════════════════

class NfcPaymentRequest(BaseModel):
    customer_id: Optional[str] = None
    amount: float = Field(..., gt=0)
    payment_method: str = "wallet"  # "wallet" or "card"
    description: Optional[str] = "NFC Payment"
    device_id: Optional[str] = ""


@router.post("/nfc-pay")
async def process_nfc_payment(req: NfcPaymentRequest, request: Request):
    """Process NFC payment. Wallet payments have lower fees than card."""
    merchant_user = await get_current_user(request)
    merchant_uid = str(merchant_user["_id"])

    mp = await db.merchant_profiles.find_one({"user_id": merchant_uid})
    if not mp and merchant_user.get("role") not in ("merchant", "admin"):
        staff = await db.merchant_staff.find_one({"user_id": merchant_uid, "status": "active"})
        if not staff:
            raise HTTPException(status_code=403, detail="Merchant access required")
        mp = await db.merchant_profiles.find_one({"_id": ObjectId(staff["merchant_id"])})

    mid = str(mp["_id"]) if mp else ""
    now_iso = datetime.now(timezone.utc).isoformat()

    if req.payment_method == "wallet":
        # Wallet NFC — lowest fees
        if not req.customer_id:
            raise HTTPException(status_code=400, detail="Customer ID required for wallet payment")

        customer = await db.users.find_one({"_id": ObjectId(req.customer_id)})
        if not customer:
            raise HTTPException(status_code=404, detail="Customer not found")

        balance = customer.get("balance", 0)
        if balance < req.amount:
            raise HTTPException(status_code=400, detail="Insufficient balance")

        fee_rate = NFC_WALLET_FEE_RATE
        fee = round(req.amount * fee_rate, 2)
        net = round(req.amount - fee, 2)

        # Deduct
        result = await db.users.update_one(
            {"_id": ObjectId(req.customer_id), "balance": {"$gte": req.amount}},
            {"$inc": {"balance": -req.amount}},
        )
        if result.modified_count == 0:
            raise HTTPException(status_code=400, detail="Payment failed")

        # Customer transaction
        await db.transactions.insert_one({
            "id": secrets.token_hex(8),
            "user_id": req.customer_id,
            "type": "payment",
            "amount": -req.amount,
            "description": req.description,
            "status": "completed",
            "reference": f"NFC-{secrets.token_hex(4).upper()}",
            "category": "nfc_wallet",
            "merchant_id": mid,
            "created_at": now_iso,
        })

    else:
        # Card NFC — higher fees (processed externally, we just log)
        fee_rate = CARD_FEE_RATE
        fee = round(req.amount * fee_rate, 2)
        net = round(req.amount - fee, 2)

    # Merchant revenue
    if mid:
        await db.merchant_profiles.update_one(
            {"_id": mp["_id"]},
            {"$inc": {"total_revenue": req.amount, "total_fees": fee}},
        )
        await db.merchant_transactions.insert_one({
            "merchant_id": mid,
            "branch_id": "",
            "device_id": req.device_id or "nfc",
            "amount": req.amount,
            "fee": fee,
            "net": net,
            "commission_rate": fee_rate * 100,
            "description": req.description,
            "customer_ref": req.customer_id or "card",
            "payment_method": f"nfc_{req.payment_method}",
            "status": "completed",
            "created_at": now_iso,
        })

    return {
        "ok": True,
        "amount": req.amount,
        "fee": fee,
        "fee_rate": round(fee_rate * 100, 2),
        "net": net,
        "payment_method": f"nfc_{req.payment_method}",
        "fee_info": "Wallet: 0.3% | Card: 2.5%",
    }


# ══════════════════════════════════════
# FEE INFO
# ══════════════════════════════════════

@router.get("/fee-info")
async def get_fee_info(request: Request):
    """Return current fee structure for payment methods."""
    return {
        "methods": [
            {"method": "nfc_wallet", "fee_rate": NFC_WALLET_FEE_RATE * 100, "label": "NFC Wallet", "description": "Lowest fees"},
            {"method": "barcode_wallet", "fee_rate": WALLET_FEE_RATE * 100, "label": "Barcode/QR", "description": "Low fees"},
            {"method": "nfc_card", "fee_rate": CARD_FEE_RATE * 100, "label": "NFC Card", "description": "Standard fees"},
        ],
    }
