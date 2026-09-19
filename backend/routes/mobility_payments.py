"""
BidBlitz V2 - Mobility Payments, Earnings & Payout System
Complete payment processing, commission splits, earnings wallets, and payout management.
"""

import secrets
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from typing import Optional, List
from bson import ObjectId

from core.database import db
from core.security import get_current_user
from core.payment_engine import debit_wallet, credit_wallet, TransactionType

router = APIRouter(prefix="/api/mobility/payments", tags=["Mobility Payments"])

# ══════════════════════════════════════
# COMMISSION CONFIGURATION
# ══════════════════════════════════════
DEFAULT_COMMISSIONS = {
    "taxi": 0.20,       # 20% platform commission
    "scooter": 0.30,    # 30% platform commission
    "food": 0.25,       # 25% platform commission
    "delivery": 0.15,   # 15% platform commission (for delivery drivers)
}

PAYOUT_CONFIG = {
    "min_payout": 10.00,     # Minimum payout amount
    "payout_fee": 0.50,      # Fixed payout fee
    "hold_hours": 24,        # Hold period before payout available
    "max_daily_payout": 1000.00,
}

PAYOUT_RESERVED_STATUSES = {"pending", "approved", "processing", "paid"}


def _require_mobility_idempotency_key(body_key: Optional[str], request: Request, *, prefix: str) -> str:
    key = (body_key or request.headers.get("Idempotency-Key") or "").strip()
    if not 8 <= len(key) <= 200:
        raise HTTPException(status_code=400, detail="Idempotency-Key erforderlich")
    return f"{prefix}:{key}"


async def _committed_payout_total(user_id: str) -> float:
    rows = await db.mobility_payouts.find(
        {"user_id": user_id, "status": {"$in": list(PAYOUT_RESERVED_STATUSES)}},
        {"_id": 0, "amount": 1},
    ).to_list(5000)
    return round(sum(float(row.get("amount") or 0) for row in rows), 2)


PAYMENT_TYPES = [
    "taxi_payment",
    "scooter_payment", 
    "food_payment",
    "merchant_payment",
    "subscription_payment",
    "auction_payment",
    "mining_payment",
    "topup",
    "payout",
    "refund",
    "commission",
    "earning",
]

EARNING_TYPES = [
    "driver_earning",      # Taxi driver earnings
    "delivery_earning",    # Food delivery earnings
    "merchant_earning",    # Restaurant earnings
    "influencer_earning",  # Referral commissions
    "investor_earning",    # Investment returns
]


# ══════════════════════════════════════
# MODELS
# ══════════════════════════════════════

class PaymentRequest(BaseModel):
    amount: float
    payment_type: str
    reference_id: str
    reference_type: str
    description: str = ""


class PayoutRequest(BaseModel):
    amount: float
    earning_type: str
    payout_method: str = "bank_transfer"
    bank_details: Optional[dict] = None
    idempotency_key: Optional[str] = None


class CommissionUpdate(BaseModel):
    category: str
    commission_rate: float


# ══════════════════════════════════════
# PAYMENT PROCESSING
# ══════════════════════════════════════

async def _credit_platform_revenue_once(*, payment_id: str, amount: float, category: str, now: datetime) -> None:
    """Increment daily platform revenue once for one canonical mobility payment."""
    if amount <= 0:
        return
    revenue_date = now.date().isoformat()
    existing = await db.platform_revenue.find_one(
        {"date": revenue_date},
        {"_id": 0, "processed_payment_ids": 1},
    )
    if not existing:
        try:
            await db.platform_revenue.insert_one({
                "revenue_id": secrets.token_hex(8),
                "date": revenue_date,
                "amount": amount,
                "by_category": {category: amount},
                "processed_payment_ids": [payment_id],
                "last_payment_id": payment_id,
                "created_at": now.isoformat(),
                "updated_at": now.isoformat(),
            })
            return
        except Exception:
            pass

    await db.platform_revenue.update_one(
        {"date": revenue_date, "processed_payment_ids": {"$ne": payment_id}},
        {
            "$set": {"updated_at": now.isoformat(), "last_payment_id": payment_id},
            "$inc": {"amount": amount, f"by_category.{category}": amount},
            "$addToSet": {"processed_payment_ids": payment_id},
        },
    )


async def process_payment(
    user_id: str,
    amount: float,
    payment_type: str,
    reference_id: str,
    reference_type: str,
    description: str = "",
    recipient_id: str = None,
    commission_category: str = None,
    idempotency_key: str = None,
) -> dict:
    """Process one canonical debit and safely finish its split side effects on retry."""
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be positive")

    idempotency_key = idempotency_key or f"mobility:payment:{payment_type}:{reference_id}:{round(amount, 2):.2f}"
    debit_result = await debit_wallet(
        user_id=user_id,
        amount=amount,
        tx_type=TransactionType.PAYMENT,
        description=description or f"Mobility payment {payment_type}",
        reference=f"{reference_type.upper()}-{reference_id[:8].upper()}",
        metadata={
            "payment_type": payment_type,
            "reference_id": reference_id,
            "reference_type": reference_type,
            "recipient_id": recipient_id,
            "commission_category": commission_category,
        },
        idempotency_key=idempotency_key,
    )
    if not debit_result.success:
        raise HTTPException(status_code=400, detail=debit_result.error or "Payment could not be debited")

    now = datetime.now(timezone.utc)
    existing = await db.mobility_payments.find_one(
        {"user_id": user_id, "reference_id": reference_id, "payment_type": payment_type},
        {"_id": 0},
    )

    payment_id = (existing or {}).get("payment_id") or debit_result.transaction_id or f"MOB-{secrets.token_hex(8)}"
    commission_rate = DEFAULT_COMMISSIONS.get(commission_category, 0.20)
    platform_commission = round(amount * commission_rate, 2)
    recipient_earning = round(amount - platform_commission, 2)

    payment_record = {
        "payment_id": payment_id,
        "wallet_transaction_id": debit_result.transaction_id,
        "wallet_idempotency_key": idempotency_key,
        "user_id": user_id,
        "recipient_id": recipient_id,
        "amount": amount,
        "payment_type": payment_type,
        "reference_id": reference_id,
        "reference_type": reference_type,
        "description": description,
        "commission_category": commission_category,
        "commission_rate": commission_rate,
        "platform_commission": platform_commission,
        "recipient_earning": recipient_earning,
        "status": "processing",
        "created_at": (existing or {}).get("created_at") or now.isoformat(),
    }
    await db.mobility_payments.update_one(
        {"payment_id": payment_id},
        {"$setOnInsert": payment_record},
        upsert=True,
    )

    if recipient_id and recipient_earning > 0:
        await credit_earning(
            user_id=recipient_id,
            amount=recipient_earning,
            earning_type=f"{commission_category}_earning" if commission_category else "earning",
            source=payment_type,
            reference_id=payment_id,
            hold_hours=PAYOUT_CONFIG["hold_hours"],
        )

    revenue_category = commission_category or payment_type
    await _credit_platform_revenue_once(
        payment_id=payment_id,
        amount=platform_commission,
        category=revenue_category,
        now=now,
    )

    completed_at = datetime.now(timezone.utc).isoformat()
    await db.mobility_payments.update_one(
        {"payment_id": payment_id},
        {"$set": {
            "status": "completed",
            "completed_at": completed_at,
            "recipient_earning_settled": bool(recipient_id and recipient_earning > 0),
            "platform_revenue_settled": platform_commission > 0,
        }},
    )
    payment_record = await db.mobility_payments.find_one(
        {"payment_id": payment_id},
        {"_id": 0},
    ) or payment_record

    return {
        "ok": True,
        "reused": bool(debit_result.idempotent_replay),
        "payment": payment_record,
        "new_balance": debit_result.new_balance,
    }


async def credit_earning(
    user_id: str,
    amount: float,
    earning_type: str,
    source: str,
    reference_id: str = None,
    hold_hours: int = 0,
) -> dict:
    """Credit one earning exactly once."""
    import hashlib

    now = datetime.now(timezone.utc)
    identity = f"{user_id}:{earning_type}:{source}:{reference_id or ''}:{round(float(amount), 2):.2f}"
    digest = hashlib.sha256(identity.encode("utf-8")).hexdigest()[:20]
    earning_id = f"ERN-{digest}"
    available_at = now + timedelta(hours=hold_hours) if hold_hours > 0 else now

    earning_record = {
        "earning_id": earning_id,
        "user_id": user_id,
        "amount": amount,
        "earning_type": earning_type,
        "source": source,
        "reference_id": reference_id,
        "status": "held" if hold_hours > 0 else "available",
        "available_at": available_at.isoformat(),
        "created_at": now.isoformat(),
    }
    await db.mobility_earnings.update_one(
        {"earning_id": earning_id},
        {"$setOnInsert": earning_record},
        upsert=True,
    )

    marker_field = f"mobility_earning_markers.{digest}"
    earning_field = f"{earning_type.replace('_earning', '')}_earnings"
    await db.users.update_one(
        {"_id": ObjectId(user_id), marker_field: {"$exists": False}},
        {
            "$inc": {earning_field: amount, "total_earnings": amount},
            "$set": {
                marker_field: {
                    "earning_id": earning_id,
                    "amount": amount,
                    "credited_at": datetime.now(timezone.utc).isoformat(),
                }
            },
        },
    )

    return await db.mobility_earnings.find_one(
        {"earning_id": earning_id},
        {"_id": 0},
    ) or earning_record


async def process_refund(
    user_id: str,
    amount: float,
    payment_id: str,
    reason: str = "",
) -> dict:
    """Refund one mobility payment exactly once through the canonical wallet."""
    payment = await db.mobility_payments.find_one(
        {"payment_id": payment_id, "user_id": user_id},
        {"_id": 0},
    )
    if not payment:
        raise HTTPException(status_code=404, detail="Original payment not found")

    original_amount = round(float(payment.get("amount") or 0), 2)
    amount = round(float(amount or 0), 2)
    if amount <= 0 or amount > original_amount:
        raise HTTPException(status_code=400, detail="Invalid refund amount")

    existing = await db.mobility_refunds.find_one(
        {"original_payment_id": payment_id, "user_id": user_id, "status": "completed"},
        {"_id": 0},
    )
    if existing:
        fresh_user = await db.users.find_one({"_id": ObjectId(user_id)}, {"balance": 1, "_id": 0}) or {}
        return {
            "ok": True,
            "refund_id": existing["refund_id"],
            "amount": existing["amount"],
            "new_balance": round(float(fresh_user.get("balance") or 0), 2),
            "replayed": True,
        }

    refund_key = f"mobility-refund:{payment_id}"
    result = await credit_wallet(
        user_id=user_id,
        amount=amount,
        tx_type=TransactionType.REFUND,
        description=f"Rückerstattung: {reason}" if reason else "Mobility Rückerstattung",
        reference=f"REFUND-{payment_id[:8].upper()}",
        source="mobility_refund",
        metadata={"original_payment_id": payment_id, "reason": reason},
        idempotency_key=refund_key,
    )
    if not result.success:
        raise HTTPException(status_code=400, detail=result.error or "Refund failed")

    refund_id = f"MRF-{payment_id[:16]}"
    refund_record = {
        "refund_id": refund_id,
        "user_id": user_id,
        "amount": amount,
        "original_payment_id": payment_id,
        "reason": reason,
        "status": "completed",
        "wallet_transaction_id": result.transaction_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.mobility_refunds.update_one(
        {"original_payment_id": payment_id, "user_id": user_id},
        {"$setOnInsert": refund_record},
        upsert=True,
    )
    await db.mobility_payments.update_one(
        {"payment_id": payment_id, "user_id": user_id},
        {"$set": {"refund_status": "refunded", "refunded_amount": amount, "refunded_at": datetime.now(timezone.utc).isoformat()}},
    )

    return {
        "ok": True,
        "refund_id": refund_id,
        "amount": amount,
        "new_balance": result.new_balance,
        "replayed": result.idempotent_replay,
    }


# ══════════════════════════════════════
# EARNINGS & BALANCE
# ══════════════════════════════════════

@router.get("/earnings")
async def get_earnings(request: Request):
    """Get user's earnings breakdown."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    # Get all earnings
    earnings = await db.mobility_earnings.find(
        {"user_id": user_id},
        {"_id": 0}
    ).sort("created_at", -1).limit(100).to_list(100)
    
    # Calculate totals
    now = datetime.now(timezone.utc)
    total_earned = sum(e["amount"] for e in earnings)
    available = sum(
        e["amount"] for e in earnings 
        if e["status"] == "available" or datetime.fromisoformat(e["available_at"]) <= now
    )
    held = total_earned - available
    
    # Earnings by type
    by_type = {}
    for e in earnings:
        etype = e["earning_type"]
        if etype not in by_type:
            by_type[etype] = 0
        by_type[etype] += e["amount"]
    
    committed_amount = await _committed_payout_total(user_id)
    active_payouts = await db.mobility_payouts.find(
        {"user_id": user_id, "status": {"$in": ["pending", "approved", "processing"]}},
        {"_id": 0, "amount": 1},
    ).to_list(1000)
    pending_amount = sum(float(p.get("amount") or 0) for p in active_payouts)
    
    return {
        "total_earned": round(total_earned, 2),
        "available_balance": round(max(0.0, available - committed_amount), 2),
        "held_balance": round(held, 2),
        "pending_payout": round(pending_amount, 2),
        "by_type": {k: round(v, 2) for k, v in by_type.items()},
        "recent_earnings": earnings[:20],
    }


@router.get("/earnings/history")
async def get_earnings_history(request: Request, earning_type: str = "", limit: int = 50):
    """Get detailed earnings history."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    query = {"user_id": user_id}
    if earning_type:
        query["earning_type"] = earning_type
    
    earnings = await db.mobility_earnings.find(
        query, {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    return {"earnings": earnings}


# ══════════════════════════════════════
# PAYOUT SYSTEM
# ══════════════════════════════════════

@router.post("/payout/request")
async def request_payout(req: PayoutRequest, request: Request):
    """Request a payout once and reserve the earnings immediately."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    idempotency_key = _require_mobility_idempotency_key(req.idempotency_key, request, prefix="mobility-payout")

    existing_same = await db.mobility_payouts.find_one(
        {"user_id": user_id, "idempotency_key": idempotency_key},
        {"_id": 0},
    )
    if existing_same:
        return {"ok": True, "payout": existing_same, "message": f"Auszahlung von €{existing_same['net_amount']:.2f} beantragt", "replayed": True}

    if req.amount < PAYOUT_CONFIG["min_payout"]:
        raise HTTPException(status_code=400, detail=f"Mindestbetrag: €{PAYOUT_CONFIG['min_payout']:.2f}")

    lock_token = secrets.token_hex(8)
    lock = await db.users.update_one(
        {
            "_id": user["_id"],
            "$or": [
                {"mobility_payout_lock": {"$exists": False}},
                {"mobility_payout_lock": None},
                {"mobility_payout_lock": False},
            ],
        },
        {"$set": {"mobility_payout_lock": lock_token, "mobility_payout_lock_at": datetime.now(timezone.utc).isoformat()}},
    )
    if lock.modified_count != 1:
        raise HTTPException(status_code=409, detail="Eine Auszahlungsanfrage wird bereits verarbeitet")

    try:
        earnings = await db.mobility_earnings.find({"user_id": user_id}).to_list(5000)
        now = datetime.now(timezone.utc)
        available = sum(
            float(e.get("amount") or 0) for e in earnings
            if e.get("status") == "available" or (
                e.get("available_at") and datetime.fromisoformat(e["available_at"]) <= now
            )
        )
        committed_amount = await _committed_payout_total(user_id)
        available_for_payout = max(0.0, available - committed_amount)
        if req.amount > available_for_payout:
            raise HTTPException(status_code=400, detail=f"Verfügbar: €{available_for_payout:.2f}")

        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        today_payouts = await db.mobility_payouts.find({
            "user_id": user_id,
            "status": {"$in": ["pending", "approved", "processing", "paid"]},
            "created_at": {"$gte": today_start.isoformat()},
        }).to_list(1000)
        today_total = sum(float(p.get("amount") or 0) for p in today_payouts)
        if today_total + req.amount > PAYOUT_CONFIG["max_daily_payout"]:
            raise HTTPException(status_code=400, detail=f"Tageslimit: €{PAYOUT_CONFIG['max_daily_payout']:.2f}")

        net_amount = round(req.amount - PAYOUT_CONFIG["payout_fee"], 2)
        if net_amount <= 0:
            raise HTTPException(status_code=400, detail="Auszahlungsbetrag liegt unter der Gebühr")

        payout_id = f"MPO-{secrets.token_hex(8)}"
        payout = {
            "payout_id": payout_id,
            "user_id": user_id,
            "user_name": user.get("name", ""),
            "user_email": user.get("email", ""),
            "amount": round(float(req.amount), 2),
            "fee": PAYOUT_CONFIG["payout_fee"],
            "net_amount": net_amount,
            "earning_type": req.earning_type,
            "payout_method": req.payout_method,
            "bank_details": req.bank_details,
            "status": "pending",
            "idempotency_key": idempotency_key,
            "created_at": now.isoformat(),
        }
        await db.mobility_payouts.insert_one(payout)
        payout.pop("_id", None)
        return {"ok": True, "payout": payout, "message": f"Auszahlung von €{net_amount:.2f} beantragt", "replayed": False}
    finally:
        await db.users.update_one(
            {"_id": user["_id"], "mobility_payout_lock": lock_token},
            {"$set": {"mobility_payout_lock": None, "mobility_payout_lock_released_at": datetime.now(timezone.utc).isoformat()}},
        )


@router.get("/payout/history")
async def get_payout_history(request: Request, status: str = "", limit: int = 50):
    """Get payout history."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    query = {"user_id": user_id}
    if status:
        query["status"] = status
    
    payouts = await db.mobility_payouts.find(
        query, {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    return {"payouts": payouts}


@router.post("/payout/cancel")
async def cancel_payout(request: Request):
    """Cancel a pending payout."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    body = await request.json()
    
    payout_id = body.get("payout_id")
    
    payout = await db.mobility_payouts.find_one({
        "payout_id": payout_id,
        "user_id": user_id,
        "status": "pending"
    })
    
    if not payout:
        raise HTTPException(status_code=404, detail="Auszahlung nicht gefunden oder bereits bearbeitet")
    
    await db.mobility_payouts.update_one(
        {"payout_id": payout_id},
        {"$set": {
            "status": "cancelled",
            "cancelled_at": datetime.now(timezone.utc).isoformat(),
        }}
    )
    
    return {"ok": True, "message": "Auszahlung storniert"}


# ══════════════════════════════════════
# ADMIN ENDPOINTS
# ══════════════════════════════════════

@router.get("/admin/payouts")
async def admin_list_payouts(request: Request, status: str = "", limit: int = 100):
    """Admin: List all payout requests."""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    
    query = {}
    if status:
        query["status"] = status
    
    payouts = await db.mobility_payouts.find(
        query, {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    # Stats
    stats = {
        "pending": await db.mobility_payouts.count_documents({"status": "pending"}),
        "approved": await db.mobility_payouts.count_documents({"status": "approved"}),
        "paid": await db.mobility_payouts.count_documents({"status": "paid"}),
        "rejected": await db.mobility_payouts.count_documents({"status": "rejected"}),
    }
    
    pending_amount = sum(p["amount"] for p in payouts if p["status"] == "pending")
    
    return {
        "payouts": payouts,
        "stats": stats,
        "pending_amount": round(pending_amount, 2),
    }


@router.post("/admin/payout/approve")
async def admin_approve_payout(request: Request):
    """Admin: Approve a payout request."""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    
    body = await request.json()
    payout_id = body.get("payout_id")
    
    payout = await db.mobility_payouts.find_one({"payout_id": payout_id, "status": "pending"})
    if not payout:
        raise HTTPException(status_code=404, detail="Payout not found")
    
    now = datetime.now(timezone.utc)
    
    transition = await db.mobility_payouts.update_one(
        {"payout_id": payout_id, "status": "pending"},
        {"$set": {
            "status": "approved",
            "approved_at": now.isoformat(),
            "approved_by": str(user["_id"]),
        }}
    )
    if transition.modified_count != 1:
        raise HTTPException(status_code=409, detail="Payout wurde parallel geändert")
    
    return {"ok": True, "message": "Auszahlung genehmigt"}


@router.post("/admin/payout/reject")
async def admin_reject_payout(request: Request):
    """Admin: Reject a payout request."""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    
    body = await request.json()
    payout_id = body.get("payout_id")
    reason = body.get("reason", "")
    
    payout = await db.mobility_payouts.find_one({"payout_id": payout_id, "status": "pending"})
    if not payout:
        raise HTTPException(status_code=404, detail="Payout not found")
    
    transition = await db.mobility_payouts.update_one(
        {"payout_id": payout_id, "status": "pending"},
        {"$set": {
            "status": "rejected",
            "rejected_at": datetime.now(timezone.utc).isoformat(),
            "rejected_by": str(user["_id"]),
            "rejection_reason": reason,
        }}
    )
    if transition.modified_count != 1:
        raise HTTPException(status_code=409, detail="Payout wurde parallel geändert")
    
    return {"ok": True, "message": "Auszahlung abgelehnt"}


@router.post("/admin/payout/mark-paid")
async def admin_mark_payout_paid(request: Request):
    """Admin: mark an approved payout paid exactly once."""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")

    body = await request.json()
    payout_id = body.get("payout_id")
    transaction_ref = (body.get("transaction_ref") or "").strip()
    if not transaction_ref:
        raise HTTPException(status_code=400, detail="Bank-/Provider-Referenz erforderlich")

    payout = await db.mobility_payouts.find_one({"payout_id": payout_id}, {"_id": 0})
    if not payout:
        raise HTTPException(status_code=404, detail="Payout not found")
    if payout.get("status") == "paid":
        return {"ok": True, "message": "Auszahlung war bereits als bezahlt markiert", "replayed": True}
    if payout.get("status") != "approved":
        raise HTTPException(status_code=409, detail=f"Payout muss zuerst genehmigt werden (Status: {payout.get('status')})")

    now = datetime.now(timezone.utc)
    transition = await db.mobility_payouts.update_one(
        {"payout_id": payout_id, "status": "approved"},
        {"$set": {
            "status": "paid",
            "paid_at": now.isoformat(),
            "paid_by": str(user["_id"]),
            "transaction_ref": transaction_ref,
        }},
    )
    if transition.modified_count != 1:
        fresh = await db.mobility_payouts.find_one({"payout_id": payout_id}, {"_id": 0})
        if fresh and fresh.get("status") == "paid":
            return {"ok": True, "message": "Auszahlung war bereits als bezahlt markiert", "replayed": True}
        raise HTTPException(status_code=409, detail="Payout wurde parallel geändert")

    await db.users.update_one(
        {"_id": ObjectId(payout["user_id"])},
        {"$inc": {"total_earnings": -float(payout["amount"])}, "$set": {"last_earnings_payout_at": now.isoformat()}},
    )

    payout_tx = {
        "id": payout_id,
        "user_id": payout["user_id"],
        "type": "payout",
        "amount": -float(payout["amount"]),
        "description": f"Auszahlung (Netto: €{float(payout['net_amount']):.2f})",
        "status": "completed",
        "reference": f"PAYOUT-{payout_id[:8].upper()}",
        "category": "payout",
        "provider_reference": transaction_ref,
        "created_at": now.isoformat(),
    }
    await db.transactions.update_one(
        {"id": payout_id, "user_id": payout["user_id"], "type": "payout"},
        {"$setOnInsert": payout_tx},
        upsert=True,
    )

    return {"ok": True, "message": "Auszahlung als bezahlt markiert", "replayed": False}


@router.get("/admin/revenue")
async def admin_get_revenue(request: Request, days: int = 30):
    """Admin: Get platform revenue report."""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    
    now = datetime.now(timezone.utc)
    start_date = (now - timedelta(days=days)).isoformat()
    
    # Get revenue
    revenue = await db.platform_revenue.find(
        {"created_at": {"$gte": start_date}},
        {"_id": 0}
    ).to_list(10000)
    
    total_revenue = sum(r["amount"] for r in revenue)
    
    # By category
    by_category = {}
    for r in revenue:
        cat = r.get("category", "other")
        if cat not in by_category:
            by_category[cat] = 0
        by_category[cat] += r["amount"]
    
    # By day
    by_day = {}
    for r in revenue:
        day = r["created_at"][:10]
        if day not in by_day:
            by_day[day] = 0
        by_day[day] += r["amount"]
    
    return {
        "total_revenue": round(total_revenue, 2),
        "by_category": {k: round(v, 2) for k, v in by_category.items()},
        "by_day": {k: round(v, 2) for k, v in sorted(by_day.items())},
        "days": days,
    }


@router.post("/admin/commission/update")
async def admin_update_commission(req: CommissionUpdate, request: Request):
    """Admin: Update commission rate for a category."""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    
    if not 0 <= req.commission_rate <= 1:
        raise HTTPException(status_code=400, detail="Commission must be between 0 and 1")
    
    # Store in config collection
    await db.mobility_config.update_one(
        {"key": f"commission_{req.category}"},
        {"$set": {
            "key": f"commission_{req.category}",
            "value": req.commission_rate,
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "updated_by": str(user["_id"]),
        }},
        upsert=True
    )
    
    # Update in-memory config
    DEFAULT_COMMISSIONS[req.category] = req.commission_rate
    
    return {"ok": True, "message": f"Commission for {req.category} set to {req.commission_rate * 100}%"}


@router.get("/admin/commissions")
async def admin_get_commissions(request: Request):
    """Admin: Get current commission rates."""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    
    return {"commissions": DEFAULT_COMMISSIONS}


# ══════════════════════════════════════
# TRANSACTION HISTORY
# ══════════════════════════════════════

@router.get("/transactions")
async def get_payment_transactions(
    request: Request,
    payment_type: str = "",
    limit: int = 50
):
    """Get user's payment transactions."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    query = {"user_id": user_id}
    if payment_type:
        query["payment_type"] = payment_type
    
    payments = await db.mobility_payments.find(
        query, {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    return {"payments": payments}


# ══════════════════════════════════════
# PRICING INFO
# ══════════════════════════════════════

@router.get("/config")
async def get_payment_config():
    """Get payment configuration."""
    return {
        "commissions": DEFAULT_COMMISSIONS,
        "payout": PAYOUT_CONFIG,
        "payment_types": PAYMENT_TYPES,
    }
