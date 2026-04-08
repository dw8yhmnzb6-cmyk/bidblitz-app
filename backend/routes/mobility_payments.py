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


class CommissionUpdate(BaseModel):
    category: str
    commission_rate: float


# ══════════════════════════════════════
# PAYMENT PROCESSING
# ══════════════════════════════════════

async def process_payment(
    user_id: str,
    amount: float,
    payment_type: str,
    reference_id: str,
    reference_type: str,
    description: str = "",
    recipient_id: str = None,
    commission_category: str = None,
) -> dict:
    """
    Process a payment with automatic commission split.
    Returns payment result with breakdown.
    """
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user.get("balance", 0) < amount:
        raise HTTPException(status_code=400, detail=f"Insufficient balance. Need €{amount:.2f}")
    
    now = datetime.now(timezone.utc)
    payment_id = secrets.token_hex(8)
    
    # Calculate commission split
    commission_rate = DEFAULT_COMMISSIONS.get(commission_category, 0.20)
    platform_commission = round(amount * commission_rate, 2)
    recipient_earning = round(amount - platform_commission, 2)
    
    # Deduct from user
    await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$inc": {"balance": -amount}}
    )
    
    # Record payment transaction
    payment_record = {
        "payment_id": payment_id,
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
        "status": "completed",
        "created_at": now.isoformat(),
    }
    
    await db.mobility_payments.insert_one(payment_record)
    
    # Record in transactions for user
    await db.transactions.insert_one({
        "id": payment_id,
        "user_id": user_id,
        "type": "payment",
        "amount": -amount,
        "description": description,
        "status": "completed",
        "reference": f"{reference_type.upper()}-{reference_id[:8].upper()}",
        "category": commission_category or payment_type,
        "created_at": now.isoformat(),
    })
    
    # Credit recipient if specified
    if recipient_id:
        await credit_earning(
            user_id=recipient_id,
            amount=recipient_earning,
            earning_type=f"{commission_category}_earning" if commission_category else "earning",
            source=payment_type,
            reference_id=reference_id,
            hold_hours=PAYOUT_CONFIG["hold_hours"],
        )
    
    # Credit platform commission to admin/system
    await db.platform_revenue.insert_one({
        "revenue_id": secrets.token_hex(8),
        "payment_id": payment_id,
        "amount": platform_commission,
        "category": commission_category or payment_type,
        "created_at": now.isoformat(),
    })
    
    payment_record.pop("_id", None)
    return {
        "ok": True,
        "payment": payment_record,
        "new_balance": user.get("balance", 0) - amount,
    }


async def credit_earning(
    user_id: str,
    amount: float,
    earning_type: str,
    source: str,
    reference_id: str = None,
    hold_hours: int = 0,
) -> dict:
    """Credit earning to user's earning wallet."""
    now = datetime.now(timezone.utc)
    earning_id = secrets.token_hex(8)
    
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
    
    await db.mobility_earnings.insert_one(earning_record)
    
    # Update user's earning balance
    earning_field = f"{earning_type.replace('_earning', '')}_earnings"
    await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$inc": {earning_field: amount, "total_earnings": amount}}
    )
    
    return earning_record


async def process_refund(
    user_id: str,
    amount: float,
    payment_id: str,
    reason: str = "",
) -> dict:
    """Process a refund back to user's wallet."""
    now = datetime.now(timezone.utc)
    refund_id = secrets.token_hex(8)
    
    # Credit user
    await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$inc": {"balance": amount}}
    )
    
    # Record refund
    refund_record = {
        "refund_id": refund_id,
        "user_id": user_id,
        "amount": amount,
        "original_payment_id": payment_id,
        "reason": reason,
        "status": "completed",
        "created_at": now.isoformat(),
    }
    
    await db.mobility_refunds.insert_one(refund_record)
    
    # Record in transactions
    await db.transactions.insert_one({
        "id": refund_id,
        "user_id": user_id,
        "type": "refund",
        "amount": amount,
        "description": f"Rückerstattung: {reason}" if reason else "Rückerstattung",
        "status": "completed",
        "reference": f"REFUND-{refund_id[:8].upper()}",
        "category": "refund",
        "created_at": now.isoformat(),
    })
    
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    
    return {
        "ok": True,
        "refund_id": refund_id,
        "amount": amount,
        "new_balance": user.get("balance", 0),
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
    
    # Get pending payouts
    pending_payouts = await db.mobility_payouts.find(
        {"user_id": user_id, "status": "pending"}
    ).to_list(100)
    pending_amount = sum(p["amount"] for p in pending_payouts)
    
    return {
        "total_earned": round(total_earned, 2),
        "available_balance": round(available - pending_amount, 2),
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
    """Request a payout from earnings."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    # Validate amount
    if req.amount < PAYOUT_CONFIG["min_payout"]:
        raise HTTPException(
            status_code=400, 
            detail=f"Mindestbetrag: €{PAYOUT_CONFIG['min_payout']:.2f}"
        )
    
    # Check available balance
    earnings = await db.mobility_earnings.find({"user_id": user_id}).to_list(1000)
    now = datetime.now(timezone.utc)
    available = sum(
        e["amount"] for e in earnings 
        if e["status"] == "available" or datetime.fromisoformat(e["available_at"]) <= now
    )
    
    # Subtract pending payouts
    pending = await db.mobility_payouts.find(
        {"user_id": user_id, "status": "pending"}
    ).to_list(100)
    pending_amount = sum(p["amount"] for p in pending)
    
    available_for_payout = available - pending_amount
    
    if req.amount > available_for_payout:
        raise HTTPException(
            status_code=400,
            detail=f"Verfügbar: €{available_for_payout:.2f}"
        )
    
    # Check daily limit
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    today_payouts = await db.mobility_payouts.find({
        "user_id": user_id,
        "status": {"$in": ["pending", "approved", "paid"]},
        "created_at": {"$gte": today_start.isoformat()}
    }).to_list(100)
    today_total = sum(p["amount"] for p in today_payouts)
    
    if today_total + req.amount > PAYOUT_CONFIG["max_daily_payout"]:
        raise HTTPException(
            status_code=400,
            detail=f"Tageslimit: €{PAYOUT_CONFIG['max_daily_payout']:.2f}"
        )
    
    # Calculate net amount after fee
    net_amount = req.amount - PAYOUT_CONFIG["payout_fee"]
    
    payout_id = secrets.token_hex(8)
    payout = {
        "payout_id": payout_id,
        "user_id": user_id,
        "user_name": user.get("name", ""),
        "user_email": user.get("email", ""),
        "amount": req.amount,
        "fee": PAYOUT_CONFIG["payout_fee"],
        "net_amount": net_amount,
        "earning_type": req.earning_type,
        "payout_method": req.payout_method,
        "bank_details": req.bank_details,
        "status": "pending",
        "created_at": now.isoformat(),
    }
    
    await db.mobility_payouts.insert_one(payout)
    payout.pop("_id", None)
    
    return {
        "ok": True,
        "payout": payout,
        "message": f"Auszahlung von €{net_amount:.2f} beantragt",
    }


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
    
    await db.mobility_payouts.update_one(
        {"payout_id": payout_id},
        {"$set": {
            "status": "approved",
            "approved_at": now.isoformat(),
            "approved_by": str(user["_id"]),
        }}
    )
    
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
    
    await db.mobility_payouts.update_one(
        {"payout_id": payout_id},
        {"$set": {
            "status": "rejected",
            "rejected_at": datetime.now(timezone.utc).isoformat(),
            "rejected_by": str(user["_id"]),
            "rejection_reason": reason,
        }}
    )
    
    return {"ok": True, "message": "Auszahlung abgelehnt"}


@router.post("/admin/payout/mark-paid")
async def admin_mark_payout_paid(request: Request):
    """Admin: Mark payout as paid."""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    
    body = await request.json()
    payout_id = body.get("payout_id")
    transaction_ref = body.get("transaction_ref", "")
    
    payout = await db.mobility_payouts.find_one({
        "payout_id": payout_id,
        "status": {"$in": ["pending", "approved"]}
    })
    if not payout:
        raise HTTPException(status_code=404, detail="Payout not found")
    
    now = datetime.now(timezone.utc)
    
    # Deduct from user's earnings
    await db.users.update_one(
        {"_id": ObjectId(payout["user_id"])},
        {"$inc": {"total_earnings": -payout["amount"]}}
    )
    
    await db.mobility_payouts.update_one(
        {"payout_id": payout_id},
        {"$set": {
            "status": "paid",
            "paid_at": now.isoformat(),
            "paid_by": str(user["_id"]),
            "transaction_ref": transaction_ref,
        }}
    )
    
    # Record payout transaction
    await db.transactions.insert_one({
        "id": payout_id,
        "user_id": payout["user_id"],
        "type": "payout",
        "amount": -payout["amount"],
        "description": f"Auszahlung (Netto: €{payout['net_amount']:.2f})",
        "status": "completed",
        "reference": f"PAYOUT-{payout_id[:8].upper()}",
        "category": "payout",
        "created_at": now.isoformat(),
    })
    
    return {"ok": True, "message": "Auszahlung als bezahlt markiert"}


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
