"""
BidBlitz Digital Payment API
============================
External API for third-party integrations to connect with BidBlitz payment system.

Features:
- API Key authentication
- Create payments
- Check payment status
- Query balance
- Webhook notifications
- Transaction history

API Documentation available at: /api/digital/docs
"""

from fastapi import APIRouter, HTTPException, Header, Query, Request, BackgroundTasks
from pydantic import BaseModel, Field
from datetime import datetime, timezone, timedelta
from typing import Optional, List
import uuid
import hashlib
import hmac
import httpx
from config import db
from utils.email import send_topup_notification

router = APIRouter(prefix="/digital", tags=["Digital Payment API"])


# ==================== MODELS ====================

class APIKeyCreate(BaseModel):
    name: str = Field(..., description="Name for this API key (e.g., 'Production', 'Testing')")
    webhook_url: Optional[str] = Field(None, description="URL for webhook notifications")
    allowed_ips: Optional[List[str]] = Field(None, description="List of allowed IP addresses")
    # Händler-Provision wird automatisch basierend auf Umsatz berechnet (0-2%)

class APIKeyUpdate(BaseModel):
    name: Optional[str] = Field(None, description="Update API key name")
    webhook_url: Optional[str] = Field(None, description="Update webhook URL")
    is_active: Optional[bool] = Field(None, description="Enable/disable API key")


# Händler-Provisions-Staffeln (basierend auf Monatsumsatz)
MERCHANT_COMMISSION_TIERS = [
    {"min_volume": 10000, "rate": 2.0},   # €10.000+ → 2%
    {"min_volume": 5000, "rate": 1.5},    # €5.000+ → 1.5%
    {"min_volume": 2000, "rate": 1.0},    # €2.000+ → 1%
    {"min_volume": 500, "rate": 0.5},     # €500+ → 0.5%
    {"min_volume": 0, "rate": 0.0},       # Start → 0%
]

def calculate_merchant_commission(monthly_volume: float) -> float:
    """Calculate merchant commission rate based on monthly volume."""
    for tier in MERCHANT_COMMISSION_TIERS:
        if monthly_volume >= tier["min_volume"]:
            return tier["rate"]
    return 0.0


# Kunden-Bonus Staffelung für Aufladungen (je mehr aufgeladen, desto mehr Bonus)
CUSTOMER_BONUS_TIERS = [
    {"min_amount": 200, "bonus": 12.00},  # €200+ → +€12 (6%)
    {"min_amount": 100, "bonus": 5.00},   # €100+ → +€5 (5%)
    {"min_amount": 50, "bonus": 2.00},    # €50+ → +€2 (4%)
    {"min_amount": 20, "bonus": 0.50},    # €20+ → +€0.50 (2.5%)
]

def calculate_customer_bonus(amount: float) -> float:
    """Calculate customer bonus based on top-up amount."""
    for tier in CUSTOMER_BONUS_TIERS:
        if amount >= tier["min_amount"]:
            return tier["bonus"]
    return 0.0


class PaymentRequest(BaseModel):
    amount: float = Field(..., gt=0, description="Payment amount in EUR")
    currency: str = Field("EUR", description="Currency code (currently only EUR supported)")
    reference: str = Field(..., description="Your unique reference/order ID")
    description: Optional[str] = Field(None, description="Payment description")
    customer_id: Optional[str] = Field(None, description="BidBlitz customer ID (BID-XXXXXX)")
    customer_email: Optional[str] = Field(None, description="Customer email for notification")
    return_url: Optional[str] = Field(None, description="URL to redirect after payment")
    webhook_url: Optional[str] = Field(None, description="Override webhook URL for this payment")
    metadata: Optional[dict] = Field(None, description="Additional metadata to store with payment")

class PaymentResponse(BaseModel):
    payment_id: str
    status: str
    amount: float
    currency: str
    reference: str
    checkout_url: Optional[str]
    created_at: str

class RefundRequest(BaseModel):
    payment_id: str = Field(..., description="Original payment ID to refund")
    amount: Optional[float] = Field(None, description="Partial refund amount (full refund if not specified)")
    reason: Optional[str] = Field(None, description="Reason for refund")

class WebhookTest(BaseModel):
    url: str = Field(..., description="Webhook URL to test")


# ==================== HELPER FUNCTIONS ====================

async def verify_api_key(api_key: str, request: Request = None):
    """Verify API key and return the associated partner/merchant"""
    if not api_key or not api_key.startswith("bbz_"):
        raise HTTPException(status_code=401, detail="Invalid API key format")
    
    key_data = await db.api_keys.find_one(
        {"key": api_key, "is_active": True},
        {"_id": 0}
    )
    
    if not key_data:
        raise HTTPException(status_code=401, detail="Invalid or inactive API key")
    
    # Check IP whitelist if configured
    if key_data.get("allowed_ips") and request:
        client_ip = request.client.host
        if client_ip not in key_data["allowed_ips"]:
            raise HTTPException(status_code=403, detail=f"IP {client_ip} not allowed")
    
    # Update last used timestamp
    await db.api_keys.update_one(
        {"key": api_key},
        {"$set": {"last_used": datetime.now(timezone.utc).isoformat()}}
    )
    
    return key_data


def generate_api_key():
    """Generate a secure API key"""
    random_bytes = uuid.uuid4().hex + uuid.uuid4().hex
    return f"bbz_{random_bytes[:48]}"


def generate_secret_key():
    """Generate a secret key for webhook signatures"""
    return f"whsec_{uuid.uuid4().hex}{uuid.uuid4().hex[:16]}"


async def send_webhook(url: str, event: str, data: dict, secret: str):
    """Send webhook notification to external system"""
    timestamp = str(int(datetime.now(timezone.utc).timestamp()))
    payload = {
        "event": event,
        "timestamp": timestamp,
        "data": data
    }
    
    # Create signature
    signature_payload = f"{timestamp}.{str(payload)}"
    signature = hmac.new(
        secret.encode(),
        signature_payload.encode(),
        hashlib.sha256
    ).hexdigest()
    
    headers = {
        "Content-Type": "application/json",
        "X-BidBlitz-Signature": f"t={timestamp},v1={signature}",
        "X-BidBlitz-Event": event
    }
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(url, json=payload, headers=headers, timeout=10)
            return {
                "success": response.status_code == 200,
                "status_code": response.status_code,
                "response": response.text[:500] if response.text else None
            }
    except Exception as e:
        return {"success": False, "error": str(e)}


# ==================== API KEY MANAGEMENT ====================

@router.post("/keys/create")
async def create_api_key(
    data: APIKeyCreate,
    x_admin_key: str = Header(..., description="Admin authentication key")
):
    """
    Create a new API key for external system integration.
    
    Requires admin authentication.
    Returns the API key and secret (only shown once!).
    """
    # Verify admin key
    if x_admin_key != "bidblitz-admin-2026":
        raise HTTPException(status_code=403, detail="Invalid admin key")
    
    api_key = generate_api_key()
    secret_key = generate_secret_key()
    
    key_doc = {
        "id": str(uuid.uuid4()),
        "key": api_key,
        "secret": secret_key,
        "name": data.name,
        "webhook_url": data.webhook_url,
        "allowed_ips": data.allowed_ips,
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "last_used": None,
        "total_requests": 0,
        "total_volume": 0,
        "monthly_volume": 0  # Für Provisions-Berechnung
    }
    
    await db.api_keys.insert_one(key_doc)
    
    return {
        "success": True,
        "api_key": api_key,
        "secret_key": secret_key,
        "webhook_url": data.webhook_url,
        "commission_info": "Provision wird automatisch basierend auf Umsatz berechnet (0-2%)",
        "message": "⚠️ Save these keys now! The secret key will not be shown again."
    }


@router.get("/keys/list")
async def list_api_keys(
    x_admin_key: str = Header(..., description="Admin authentication key")
):
    """List all API keys (admin only)"""
    if x_admin_key != "bidblitz-admin-2026":
        raise HTTPException(status_code=403, detail="Invalid admin key")
    
    keys = await db.api_keys.find(
        {},
        {"_id": 0, "secret": 0}  # Don't expose secrets
    ).to_list(100)
    
    return {"keys": keys}


@router.patch("/keys/{key_id}")
async def update_api_key(
    key_id: str,
    data: APIKeyUpdate,
    x_admin_key: str = Header(..., description="Admin authentication key")
):
    """
    Update API key settings including merchant commission.
    
    - merchant_commission: 1% - 10% (goes TO the merchant for processing top-ups)
    """
    if x_admin_key != "bidblitz-admin-2026":
        raise HTTPException(status_code=403, detail="Invalid admin key")
    
    update_data = {}
    if data.name is not None:
        update_data["name"] = data.name
    if data.webhook_url is not None:
        update_data["webhook_url"] = data.webhook_url
    if data.is_active is not None:
        update_data["is_active"] = data.is_active
    if data.merchant_commission is not None:
        update_data["merchant_commission"] = data.merchant_commission
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No update data provided")
    
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.api_keys.update_one(
        {"id": key_id},
        {"$set": update_data}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="API key not found")
    
    # Get updated key
    updated_key = await db.api_keys.find_one(
        {"id": key_id},
        {"_id": 0, "secret": 0}
    )
    
    return {
        "success": True,
        "message": "API key updated",
        "key": updated_key
    }


@router.delete("/keys/{key_id}")
async def revoke_api_key(
    key_id: str,
    x_admin_key: str = Header(..., description="Admin authentication key")
):
    """Revoke/deactivate an API key"""
    if x_admin_key != "bidblitz-admin-2026":
        raise HTTPException(status_code=403, detail="Invalid admin key")
    
    result = await db.api_keys.update_one(
        {"id": key_id},
        {"$set": {"is_active": False, "revoked_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="API key not found")
    
    return {"success": True, "message": "API key revoked"}


# ==================== COMMISSION DASHBOARD ====================

@router.get("/commissions/stats")
async def get_commission_stats(
    x_admin_key: str = Header(..., description="Admin authentication key"),
    days: int = Query(30, ge=1, le=365, description="Number of days to analyze")
):
    """
    Get commission statistics for the admin dashboard.
    
    Returns total commissions, breakdown by merchant, and daily stats.
    """
    if x_admin_key != "bidblitz-admin-2026":
        raise HTTPException(status_code=403, detail="Invalid admin key")
    
    now = datetime.now(timezone.utc)
    start_date = (now - timedelta(days=days)).isoformat()
    
    # Get all commissions in the period
    commissions = await db.platform_commissions.find(
        {"created_at": {"$gte": start_date}},
        {"_id": 0}
    ).to_list(10000)
    
    # Get all payments with commission data
    payments = await db.digital_payments.find(
        {"created_at": {"$gte": start_date}, "platform_fee": {"$exists": True}},
        {"_id": 0}
    ).to_list(10000)
    
    # Calculate totals
    total_commission = sum(c.get("commission_amount", 0) for c in commissions)
    total_cashback = sum(p.get("customer_cashback", 0) for p in payments)
    total_volume = sum(p.get("amount", 0) for p in payments)
    total_transactions = len(payments)
    
    # Group by merchant
    merchant_stats = {}
    for c in commissions:
        key_name = c.get("api_key_name", "Unbekannt")
        if key_name not in merchant_stats:
            merchant_stats[key_name] = {
                "name": key_name,
                "api_key_id": c.get("api_key_id"),
                "commission_total": 0,
                "transaction_count": 0,
                "volume": 0
            }
        merchant_stats[key_name]["commission_total"] += c.get("commission_amount", 0)
        merchant_stats[key_name]["transaction_count"] += 1
        merchant_stats[key_name]["volume"] += c.get("payment_amount", 0)
    
    # Sort by commission total
    merchants = sorted(merchant_stats.values(), key=lambda x: x["commission_total"], reverse=True)
    
    # Daily breakdown
    daily_stats = {}
    for c in commissions:
        date = c.get("created_at", "")[:10]  # YYYY-MM-DD
        if date not in daily_stats:
            daily_stats[date] = {"date": date, "commission": 0, "transactions": 0}
        daily_stats[date]["commission"] += c.get("commission_amount", 0)
        daily_stats[date]["transactions"] += 1
    
    # Sort by date
    daily = sorted(daily_stats.values(), key=lambda x: x["date"], reverse=True)
    
    # This month vs last month
    this_month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    last_month_start = (this_month_start - timedelta(days=1)).replace(day=1)
    
    this_month_commission = sum(
        c.get("commission_amount", 0) for c in commissions 
        if c.get("created_at", "") >= this_month_start.isoformat()
    )
    last_month_commission = sum(
        c.get("commission_amount", 0) for c in commissions 
        if last_month_start.isoformat() <= c.get("created_at", "") < this_month_start.isoformat()
    )
    
    # Growth calculation
    growth = 0
    if last_month_commission > 0:
        growth = ((this_month_commission - last_month_commission) / last_month_commission) * 100
    
    return {
        "period_days": days,
        "totals": {
            "commission": round(total_commission, 2),
            "cashback_given": round(total_cashback, 2),
            "volume": round(total_volume, 2),
            "transactions": total_transactions,
            "avg_commission_rate": round((total_commission / total_volume * 100) if total_volume > 0 else 0, 2)
        },
        "comparison": {
            "this_month": round(this_month_commission, 2),
            "last_month": round(last_month_commission, 2),
            "growth_percent": round(growth, 1)
        },
        "by_merchant": merchants[:20],  # Top 20
        "daily": daily[:30]  # Last 30 days
    }


@router.get("/commissions/export")
async def export_commissions(
    x_admin_key: str = Header(..., description="Admin authentication key"),
    days: int = Query(30, ge=1, le=365),
    format: str = Query("json", description="Export format: json or csv")
):
    """Export commission data for accounting."""
    if x_admin_key != "bidblitz-admin-2026":
        raise HTTPException(status_code=403, detail="Invalid admin key")
    
    start_date = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    
    commissions = await db.platform_commissions.find(
        {"created_at": {"$gte": start_date}},
        {"_id": 0}
    ).sort("created_at", -1).to_list(10000)
    
    if format == "csv":
        import csv
        import io
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["Datum", "Händler", "Zahlungsbetrag", "Provision %", "Provision €"])
        for c in commissions:
            writer.writerow([
                c.get("created_at", "")[:19],
                c.get("api_key_name", ""),
                c.get("payment_amount", 0),
                c.get("commission_rate", 0),
                c.get("commission_amount", 0)
            ])
        return {"csv": output.getvalue(), "rows": len(commissions)}
    
    return {"commissions": commissions, "count": len(commissions)}


# ==================== PAYMENT ENDPOINTS ====================

@router.post("/payments/create")
async def create_payment(
    data: PaymentRequest,
    request: Request,
    x_api_key: str = Header(..., description="Your API key")
):
    """
    Create a new payment request.
    
    Returns a payment ID and checkout URL for the customer.
    The customer completes payment on BidBlitz, then is redirected to your return_url.
    """
    key_data = await verify_api_key(x_api_key, request)
    
    # Check for duplicate reference
    existing = await db.digital_payments.find_one({"reference": data.reference, "api_key_id": key_data["id"]})
    if existing:
        raise HTTPException(status_code=400, detail="Payment with this reference already exists")
    
    payment_id = f"pay_{uuid.uuid4().hex[:24]}"
    now = datetime.now(timezone.utc)
    
    payment_doc = {
        "id": payment_id,
        "api_key_id": key_data["id"],
        "api_key_name": key_data["name"],
        "amount": data.amount,
        "currency": data.currency,
        "reference": data.reference,
        "description": data.description,
        "customer_id": data.customer_id,
        "customer_email": data.customer_email,
        "return_url": data.return_url,
        "webhook_url": data.webhook_url or key_data.get("webhook_url"),
        "metadata": data.metadata,
        "status": "pending",
        "created_at": now.isoformat(),
        "expires_at": (now + timedelta(hours=24)).isoformat(),
        "paid_at": None,
        "refunded_at": None
    }
    
    await db.digital_payments.insert_one(payment_doc)
    
    # Update API key stats
    await db.api_keys.update_one(
        {"id": key_data["id"]},
        {"$inc": {"total_requests": 1}}
    )
    
    # Generate checkout URL
    checkout_url = f"https://bidblitz.ae/checkout/{payment_id}"
    
    return PaymentResponse(
        payment_id=payment_id,
        status="pending",
        amount=data.amount,
        currency=data.currency,
        reference=data.reference,
        checkout_url=checkout_url,
        created_at=now.isoformat()
    )


@router.get("/payments/{payment_id}")
async def get_payment(
    payment_id: str,
    request: Request,
    x_api_key: str = Header(..., description="Your API key")
):
    """
    Get payment details and status.
    
    Status can be: pending, processing, completed, failed, refunded, expired
    """
    key_data = await verify_api_key(x_api_key, request)
    
    payment = await db.digital_payments.find_one(
        {"id": payment_id, "api_key_id": key_data["id"]},
        {"_id": 0}
    )
    
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    
    # Check expiration
    if payment["status"] == "pending":
        expires_at = datetime.fromisoformat(payment["expires_at"].replace("Z", "+00:00"))
        if datetime.now(timezone.utc) > expires_at:
            await db.digital_payments.update_one(
                {"id": payment_id},
                {"$set": {"status": "expired"}}
            )
            payment["status"] = "expired"
    
    return payment


@router.get("/payments")
async def list_payments(
    request: Request,
    x_api_key: str = Header(..., description="Your API key"),
    status: Optional[str] = Query(None, description="Filter by status"),
    from_date: Optional[str] = Query(None, description="From date (ISO format)"),
    to_date: Optional[str] = Query(None, description="To date (ISO format)"),
    limit: int = Query(50, le=100, description="Max results"),
    offset: int = Query(0, description="Offset for pagination")
):
    """
    List all payments for your API key.
    
    Supports filtering by status and date range.
    """
    key_data = await verify_api_key(x_api_key, request)
    
    query = {"api_key_id": key_data["id"]}
    
    if status:
        query["status"] = status
    
    if from_date:
        query["created_at"] = {"$gte": from_date}
    
    if to_date:
        if "created_at" in query:
            query["created_at"]["$lte"] = to_date
        else:
            query["created_at"] = {"$lte": to_date}
    
    payments = await db.digital_payments.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).skip(offset).limit(limit).to_list(limit)
    
    total = await db.digital_payments.count_documents(query)
    
    return {
        "payments": payments,
        "total": total,
        "limit": limit,
        "offset": offset
    }


@router.post("/payments/{payment_id}/complete")
async def complete_payment(
    payment_id: str,
    request: Request,
    x_api_key: str = Header(..., description="Your API key")
):
    """
    Mark a payment as completed (internal use for testing).
    
    In production, payments are completed when the customer pays on BidBlitz.
    """
    key_data = await verify_api_key(x_api_key, request)
    
    payment = await db.digital_payments.find_one(
        {"id": payment_id, "api_key_id": key_data["id"]},
        {"_id": 0}
    )
    
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    
    if payment["status"] != "pending":
        raise HTTPException(status_code=400, detail=f"Payment cannot be completed (status: {payment['status']})")
    
    now = datetime.now(timezone.utc)
    
    await db.digital_payments.update_one(
        {"id": payment_id},
        {"$set": {
            "status": "completed",
            "paid_at": now.isoformat()
        }}
    )
    
    # Update API key volume
    await db.api_keys.update_one(
        {"id": key_data["id"]},
        {"$inc": {"total_volume": payment["amount"]}}
    )
    
    # Send webhook
    webhook_url = payment.get("webhook_url")
    if webhook_url:
        webhook_result = await send_webhook(
            url=webhook_url,
            event="payment.completed",
            data={
                "payment_id": payment_id,
                "reference": payment["reference"],
                "amount": payment["amount"],
                "currency": payment["currency"],
                "paid_at": now.isoformat()
            },
            secret=key_data.get("secret", "")
        )
    
    return {
        "success": True,
        "payment_id": payment_id,
        "status": "completed",
        "paid_at": now.isoformat()
    }


@router.post("/payments/{payment_id}/refund")
async def refund_payment(
    payment_id: str,
    data: RefundRequest,
    request: Request,
    x_api_key: str = Header(..., description="Your API key")
):
    """
    Refund a completed payment (full or partial).
    """
    key_data = await verify_api_key(x_api_key, request)
    
    payment = await db.digital_payments.find_one(
        {"id": payment_id, "api_key_id": key_data["id"]},
        {"_id": 0}
    )
    
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    
    if payment["status"] != "completed":
        raise HTTPException(status_code=400, detail="Only completed payments can be refunded")
    
    refund_amount = data.amount or payment["amount"]
    if refund_amount > payment["amount"]:
        raise HTTPException(status_code=400, detail="Refund amount exceeds payment amount")
    
    now = datetime.now(timezone.utc)
    refund_id = f"ref_{uuid.uuid4().hex[:24]}"
    
    # Create refund record
    refund_doc = {
        "id": refund_id,
        "payment_id": payment_id,
        "amount": refund_amount,
        "reason": data.reason,
        "created_at": now.isoformat()
    }
    
    await db.digital_refunds.insert_one(refund_doc)
    
    # Update payment status
    new_status = "refunded" if refund_amount == payment["amount"] else "partially_refunded"
    await db.digital_payments.update_one(
        {"id": payment_id},
        {
            "$set": {
                "status": new_status,
                "refunded_at": now.isoformat(),
                "refund_amount": refund_amount
            }
        }
    )
    
    # Send webhook
    webhook_url = payment.get("webhook_url")
    if webhook_url:
        await send_webhook(
            url=webhook_url,
            event="payment.refunded",
            data={
                "payment_id": payment_id,
                "refund_id": refund_id,
                "reference": payment["reference"],
                "refund_amount": refund_amount,
                "refunded_at": now.isoformat()
            },
            secret=key_data.get("secret", "")
        )
    
    return {
        "success": True,
        "refund_id": refund_id,
        "payment_id": payment_id,
        "refund_amount": refund_amount,
        "status": new_status
    }


# ==================== BALANCE & ACCOUNT ====================

@router.get("/balance")
async def get_balance(
    request: Request,
    x_api_key: str = Header(..., description="Your API key"),
    customer_id: Optional[str] = Query(None, description="Customer ID to check balance")
):
    """
    Get account balance information.
    
    If customer_id is provided, returns that customer's balance.
    Otherwise returns aggregated statistics for your API key.
    """
    key_data = await verify_api_key(x_api_key, request)
    
    if customer_id:
        # Get specific customer balance
        user = await db.users.find_one(
            {"customer_number": customer_id},
            {"_id": 0, "balance": 1, "bidblitz_balance": 1, "bids_balance": 1, "name": 1}
        )
        
        if not user:
            raise HTTPException(status_code=404, detail="Customer not found")
        
        return {
            "customer_id": customer_id,
            "balance": user.get("bidblitz_balance", user.get("balance", 0)),
            "bids_balance": user.get("bids_balance", 0),
            "name": user.get("name")
        }
    
    # Aggregated stats for API key
    pipeline = [
        {"$match": {"api_key_id": key_data["id"]}},
        {"$group": {
            "_id": "$status",
            "count": {"$sum": 1},
            "total_amount": {"$sum": "$amount"}
        }}
    ]
    
    stats = await db.digital_payments.aggregate(pipeline).to_list(10)
    
    stats_dict = {s["_id"]: {"count": s["count"], "amount": s["total_amount"]} for s in stats}
    
    return {
        "api_key_name": key_data["name"],
        "merchant_commission": key_data.get("merchant_commission", 2.0),
        "total_requests": key_data.get("total_requests", 0),
        "total_volume": key_data.get("total_volume", 0),
        "statistics": stats_dict
    }


# ==================== WEBHOOKS ====================

@router.post("/webhooks/test")
async def test_webhook(
    data: WebhookTest,
    request: Request,
    x_api_key: str = Header(..., description="Your API key")
):
    """
    Test your webhook endpoint.
    
    Sends a test event to verify your webhook is working correctly.
    """
    key_data = await verify_api_key(x_api_key, request)
    
    result = await send_webhook(
        url=data.url,
        event="webhook.test",
        data={
            "message": "This is a test webhook from BidBlitz",
            "api_key_name": key_data["name"],
            "timestamp": datetime.now(timezone.utc).isoformat()
        },
        secret=key_data.get("secret", "")
    )
    
    return {
        "success": result.get("success", False),
        "webhook_url": data.url,
        "status_code": result.get("status_code"),
        "response": result.get("response"),
        "error": result.get("error")
    }


@router.put("/webhooks/update")
async def update_webhook_url(
    webhook_url: str,
    request: Request,
    x_api_key: str = Header(..., description="Your API key")
):
    """Update the default webhook URL for your API key"""
    key_data = await verify_api_key(x_api_key, request)
    
    await db.api_keys.update_one(
        {"id": key_data["id"]},
        {"$set": {"webhook_url": webhook_url}}
    )
    
    return {"success": True, "webhook_url": webhook_url}


# ==================== API DOCUMENTATION ====================

@router.get("/docs")
async def api_documentation():
    """
    Get API documentation and examples.
    """
    return {
        "name": "BidBlitz Digital Payment API",
        "version": "1.0.0",
        "base_url": "https://bidblitz.ae/api/digital",
        "authentication": {
            "type": "API Key",
            "header": "X-API-Key",
            "format": "bbz_xxxxxxxxxxxx"
        },
        "endpoints": {
            "create_payment": {
                "method": "POST",
                "path": "/payments/create",
                "description": "Create a new payment request"
            },
            "get_payment": {
                "method": "GET",
                "path": "/payments/{payment_id}",
                "description": "Get payment details and status"
            },
            "list_payments": {
                "method": "GET",
                "path": "/payments",
                "description": "List all payments with filtering"
            },
            "refund_payment": {
                "method": "POST",
                "path": "/payments/{payment_id}/refund",
                "description": "Refund a completed payment"
            },
            "get_balance": {
                "method": "GET",
                "path": "/balance",
                "description": "Get account balance and statistics"
            },
            "test_webhook": {
                "method": "POST",
                "path": "/webhooks/test",
                "description": "Test your webhook endpoint"
            }
        },
        "webhook_events": [
            "payment.completed",
            "payment.failed",
            "payment.refunded",
            "payment.expired",
            "webhook.test"
        ],
        "example_request": {
            "url": "POST /api/digital/payments/create",
            "headers": {
                "Content-Type": "application/json",
                "X-API-Key": "bbz_your_api_key_here"
            },
            "body": {
                "amount": 50.00,
                "currency": "EUR",
                "reference": "ORDER-12345",
                "description": "Purchase of premium package",
                "customer_email": "customer@example.com",
                "return_url": "https://yoursite.com/payment/success",
                "metadata": {
                    "order_id": "12345",
                    "product": "Premium Package"
                }
            }
        },
        "webhook_signature": {
            "description": "Webhooks are signed using HMAC-SHA256",
            "header": "X-BidBlitz-Signature",
            "format": "t=timestamp,v1=signature",
            "verification": "Create HMAC-SHA256 of 'timestamp.payload' using your secret key"
        }
    }


# ==================== CUSTOMER CHECKOUT (App-side) ====================

@router.get("/checkout/{payment_id}")
async def get_checkout_details(payment_id: str):
    """
    Get payment details for customer checkout page (public endpoint).
    
    This is called when a customer opens the checkout URL in their BidBlitz app.
    """
    payment = await db.digital_payments.find_one(
        {"id": payment_id},
        {"_id": 0, "webhook_url": 0, "api_key_id": 0}
    )
    
    if not payment:
        raise HTTPException(status_code=404, detail="Zahlung nicht gefunden")
    
    # Check if expired
    if payment.get("status") == "pending":
        expires_at = datetime.fromisoformat(payment["expires_at"].replace("Z", "+00:00"))
        if datetime.now(timezone.utc) > expires_at:
            await db.digital_payments.update_one(
                {"id": payment_id},
                {"$set": {"status": "expired"}}
            )
            payment["status"] = "expired"
    
    # Get merchant info
    api_key = await db.api_keys.find_one(
        {"id": payment.get("api_key_id")},
        {"_id": 0, "name": 1}
    )
    
    return {
        "payment_id": payment_id,
        "merchant_name": payment.get("api_key_name", api_key.get("name") if api_key else "Händler"),
        "amount": payment.get("amount"),
        "currency": payment.get("currency", "EUR"),
        "description": payment.get("description"),
        "reference": payment.get("reference"),
        "status": payment.get("status"),
        "created_at": payment.get("created_at"),
        "expires_at": payment.get("expires_at")
    }


class CheckoutConfirmRequest(BaseModel):
    user_id: Optional[str] = Field(None, description="Customer user ID or customer number (BID-XXXXXX)")
    pin: Optional[str] = Field(None, description="Optional PIN for additional security")


@router.post("/checkout/{payment_id}/confirm")
async def confirm_checkout_payment(
    payment_id: str,
    data: CheckoutConfirmRequest = None
):
    """
    Customer confirms payment from their BidBlitz wallet.
    
    This deducts from the customer's BidBlitz Pay balance.
    In production, this would require user authentication.
    """
    user_id = data.user_id if data else None
    
    # Get payment
    payment = await db.digital_payments.find_one(
        {"id": payment_id},
        {"_id": 0}
    )
    
    if not payment:
        raise HTTPException(status_code=404, detail="Zahlung nicht gefunden")
    
    if payment.get("status") != "pending":
        raise HTTPException(status_code=400, detail=f"Zahlung kann nicht abgeschlossen werden (Status: {payment['status']})")
    
    # Check expiry
    expires_at = datetime.fromisoformat(payment["expires_at"].replace("Z", "+00:00"))
    if datetime.now(timezone.utc) > expires_at:
        await db.digital_payments.update_one(
            {"id": payment_id},
            {"$set": {"status": "expired"}}
        )
        raise HTTPException(status_code=400, detail="Zahlung ist abgelaufen")
    
    amount = payment.get("amount", 0)
    
    # If customer_id is set, verify and use their balance
    customer_id = payment.get("customer_id") or user_id
    
    if customer_id:
        # Find customer by customer_number (BID-XXXXXX) or user_id
        if customer_id.startswith("BID-"):
            user = await db.users.find_one(
                {"customer_number": customer_id},
                {"_id": 0, "id": 1, "bidblitz_balance": 1, "balance": 1, "name": 1}
            )
        else:
            user = await db.users.find_one(
                {"id": customer_id},
                {"_id": 0, "id": 1, "bidblitz_balance": 1, "balance": 1, "name": 1}
            )
        
        if not user:
            raise HTTPException(status_code=404, detail="Kunde nicht gefunden")
        
        # Check balance
        user_balance = user.get("bidblitz_balance", user.get("balance", 0))
        if user_balance < amount:
            raise HTTPException(
                status_code=400, 
                detail=f"Nicht genug Guthaben. Verfügbar: €{user_balance:.2f}, Benötigt: €{amount:.2f}"
            )
        
        # Deduct from user balance
        await db.users.update_one(
            {"id": user["id"]},
            {"$inc": {"bidblitz_balance": -amount, "balance": -amount}}
        )
        
        # Also update wallet
        await db.bidblitz_wallets.update_one(
            {"user_id": user["id"]},
            {"$inc": {"universal_balance": -amount}},
            upsert=True
        )
    
    now = datetime.now(timezone.utc)
    
    # Mark payment as completed
    await db.digital_payments.update_one(
        {"id": payment_id},
        {"$set": {
            "status": "completed",
            "paid_at": now.isoformat(),
            "paid_by": customer_id
        }}
    )
    
    # Get API key for webhook and stats
    api_key = await db.api_keys.find_one(
        {"id": payment.get("api_key_id")},
        {"_id": 0}
    )
    
    if api_key:
        # Update API key volume
        await db.api_keys.update_one(
            {"id": api_key["id"]},
            {"$inc": {"total_volume": amount}}
        )
        
        # Send webhook
        webhook_url = payment.get("webhook_url") or api_key.get("webhook_url")
        if webhook_url:
            await send_webhook(
                url=webhook_url,
                event="payment.completed",
                data={
                    "payment_id": payment_id,
                    "reference": payment.get("reference"),
                    "amount": amount,
                    "currency": payment.get("currency", "EUR"),
                    "paid_at": now.isoformat(),
                    "paid_by": customer_id
                },
                secret=api_key.get("secret", "")
            )
    
    return {
        "success": True,
        "payment_id": payment_id,
        "amount": amount,
        "status": "completed",
        "paid_at": now.isoformat(),
        "message": f"Zahlung von €{amount:.2f} erfolgreich!"
    }



# ==================== CUSTOMER QR CODE GENERATION ====================

class CustomerQRRequest(BaseModel):
    expires_in_minutes: int = Field(5, ge=1, le=30, description="QR code validity in minutes")


@router.post("/customer/generate-qr")
async def generate_customer_payment_qr(
    authorization: str = Header(None, alias="Authorization")
):
    """
    Generate a payment QR code for a customer to use at POS terminals.
    
    This creates a temporary token that can be scanned by merchants.
    The customer shows this QR at checkout.
    """
    import jwt
    import os
    
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authorization required")
    
    token = authorization.replace("Bearer ", "")
    
    # Decode JWT token
    try:
        secret = os.environ.get("JWT_SECRET", "bidblitz-secret-key-2026")
        payload = jwt.decode(token, secret, algorithms=["HS256"])
        user_id = payload.get("user_id")
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token payload")
    
    # Get user from database
    user = await db.users.find_one(
        {"id": user_id},
        {"_id": 0, "id": 1, "customer_number": 1, "name": 1, "bidblitz_balance": 1, "balance": 1}
    )
    
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    
    # Generate payment token
    payment_token = f"cpt_{uuid.uuid4().hex}"
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=5)
    expires_timestamp = int(expires_at.timestamp())
    
    # Store token in database
    await db.customer_payment_tokens.insert_one({
        "token": payment_token,
        "user_id": user["id"],
        "customer_number": user.get("customer_number"),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "expires_at": expires_at.isoformat(),
        "used": False
    })
    
    customer_number = user.get("customer_number", "")
    
    # JSON format for modern systems
    qr_data_json = {
        "type": "bidblitz_pay",
        "version": "2.0",
        "token": payment_token,
        "customer_id": user["id"],
        "customer_number": customer_number,
        "expires": expires_at.isoformat()
    }
    
    # Compact format for simple scanners: BIDBLITZ:version:token:customer:timestamp
    qr_data_compact = f"BIDBLITZ:2.0:{payment_token}:{customer_number}:{expires_timestamp}"
    
    return {
        "payment_token": payment_token,
        "user_id": user["id"],
        "customer_number": customer_number,
        "expires_at": expires_at.isoformat(),
        "valid_for_minutes": 5,
        # QR code content options
        "qr_data_json": qr_data_json,
        "qr_data_compact": qr_data_compact
    }



# ==================== CUSTOMER LOOKUP (for POS verification) ====================

@router.get("/customer/lookup")
async def lookup_customer(
    customer_number: str = Query(None, description="Customer number (BID-XXXXXX)"),
    email: str = Query(None, description="Customer email"),
    x_api_key: str = Header(None, alias="X-API-Key")
):
    """
    Look up customer information for verification before payment.
    
    Merchants can verify customer details and check available balance
    before processing a payment.
    """
    # Verify API key
    if not x_api_key:
        raise HTTPException(status_code=401, detail="API key required")
    
    api_key = await db.api_keys.find_one(
        {"key": x_api_key, "is_active": True},
        {"_id": 0}
    )
    
    if not api_key:
        raise HTTPException(status_code=401, detail="Invalid or inactive API key")
    
    if not customer_number and not email:
        raise HTTPException(status_code=400, detail="customer_number or email required")
    
    # Find customer
    query = {}
    if customer_number:
        query["customer_number"] = customer_number.upper()
    elif email:
        query["email"] = email.lower()
    
    user = await db.users.find_one(
        query,
        {"_id": 0, "id": 1, "name": 1, "customer_number": 1, "bidblitz_balance": 1, "balance": 1, "email": 1}
    )
    
    if not user:
        raise HTTPException(status_code=404, detail="Kunde nicht gefunden")
    
    balance = user.get("bidblitz_balance", user.get("balance", 0))
    
    return {
        "found": True,
        "customer_number": user.get("customer_number"),
        "name": user.get("name", "Unbekannt"),
        "email_masked": user.get("email", "")[:3] + "***" + user.get("email", "")[-10:] if user.get("email") else None,
        "balance": balance,
        "can_pay": balance > 0
    }


# ==================== CARD TOP-UP (Händler lädt Kunden-Karte auf) ====================

class TopUpRequest(BaseModel):
    amount: float = Field(..., ge=5, le=500, description="Aufladebetrag in EUR (5-500€)")
    customer_number: str = Field(..., description="Kundennummer (BID-XXXXXX)")
    payment_token: Optional[str] = Field(None, description="Optional: Payment token from QR")
    qr_data: Optional[str] = Field(None, description="Optional: Raw QR code data")


@router.post("/topup")
async def topup_customer_card(
    data: TopUpRequest,
    x_api_key: str = Header(None, alias="X-API-Key")
):
    """
    Top up a customer's BidBlitz card at a merchant location.
    
    Flow:
    1. Customer pays cash at merchant (e.g., Edeka)
    2. Merchant scans customer QR or enters customer number
    3. Customer receives: amount + bonus (based on tier)
    4. Merchant earns commission
    
    Bonus tiers:
    - €100+ → +€5 bonus
    - €50+ → +€2 bonus  
    - €20+ → +€0.50 bonus
    """
    # Verify API key
    if not x_api_key:
        raise HTTPException(status_code=401, detail="API key required")
    
    api_key = await db.api_keys.find_one(
        {"key": x_api_key, "is_active": True},
        {"_id": 0}
    )
    
    if not api_key:
        raise HTTPException(status_code=401, detail="Invalid or inactive API key")
    
    # Parse QR code if provided
    customer_number = data.customer_number.upper()
    if data.qr_data:
        qr_info = parse_qr_code(data.qr_data)
        customer_number = qr_info.get("customer_number", customer_number).upper()
    
    # Find customer
    user = await db.users.find_one(
        {"customer_number": customer_number},
        {"_id": 0, "id": 1, "name": 1, "customer_number": 1, "bidblitz_balance": 1, "balance": 1, "email": 1}
    )
    
    if not user:
        raise HTTPException(status_code=404, detail=f"Kunde {customer_number} nicht gefunden")
    
    # Calculate bonus
    customer_bonus = calculate_customer_bonus(data.amount)
    total_credit = data.amount + customer_bonus
    
    # Get merchant's monthly volume for commission calculation
    monthly_volume = api_key.get("monthly_volume", 0) + api_key.get("total_volume", 0)
    
    # Calculate merchant commission based on their volume tier (0-2%)
    merchant_commission_rate = calculate_merchant_commission(monthly_volume)
    merchant_commission = round(data.amount * (merchant_commission_rate / 100), 2)
    
    # Update merchant's total volume
    await db.api_keys.update_one(
        {"id": api_key["id"]},
        {"$inc": {"total_volume": data.amount, "total_requests": 1}}
    )
    
    # Credit customer account
    await db.users.update_one(
        {"id": user["id"]},
        {"$inc": {"bidblitz_balance": total_credit, "balance": total_credit}}
    )
    
    # Update wallet
    await db.bidblitz_wallets.update_one(
        {"user_id": user["id"]},
        {"$inc": {"universal_balance": total_credit}},
        upsert=True
    )
    
    now = datetime.now(timezone.utc)
    topup_id = f"topup_{uuid.uuid4().hex[:16]}"
    
    # Record the top-up transaction
    await db.digital_payments.insert_one({
        "id": topup_id,
        "type": "topup",
        "api_key_id": api_key["id"],
        "api_key_name": api_key["name"],
        "amount": data.amount,
        "customer_bonus": customer_bonus,
        "total_credited": total_credit,
        "merchant_commission": merchant_commission,
        "merchant_commission_rate": merchant_commission_rate,
        "merchant_volume_at_time": monthly_volume + data.amount,
        "currency": "EUR",
        "reference": f"TOPUP-{now.strftime('%Y%m%d%H%M%S')}",
        "customer_id": user["id"],
        "customer_number": user.get("customer_number"),
        "customer_name": user.get("name"),
        "status": "completed",
        "created_at": now.isoformat()
    })
    
    # Record merchant commission (they earn this)
    if merchant_commission > 0:
        await db.merchant_commissions.insert_one({
            "id": f"mcomm_{uuid.uuid4().hex[:16]}",
            "type": "topup",
            "api_key_id": api_key["id"],
            "api_key_name": api_key["name"],
            "topup_amount": data.amount,
            "commission_rate": merchant_commission_rate,
            "commission_amount": merchant_commission,
            "merchant_volume": monthly_volume + data.amount,
            "created_at": now.isoformat()
        })
    
    # Get new balance
    updated_user = await db.users.find_one(
        {"id": user["id"]},
        {"_id": 0, "bidblitz_balance": 1, "balance": 1}
    )
    new_balance = updated_user.get("bidblitz_balance", updated_user.get("balance", 0))
    
    # Send webhook if configured
    webhook_url = api_key.get("webhook_url")
    if webhook_url:
        await send_webhook(
            url=webhook_url,
            event="topup.completed",
            data={
                "topup_id": topup_id,
                "amount": data.amount,
                "bonus": customer_bonus,
                "total_credited": total_credit,
                "merchant_commission": merchant_commission,
                "customer_number": user.get("customer_number"),
                "created_at": now.isoformat()
            },
            secret=api_key.get("secret", "")
        )
    
    # Calculate next tier info
    new_volume = monthly_volume + data.amount
    next_tier = None
    for tier in MERCHANT_COMMISSION_TIERS:
        if new_volume < tier["min_volume"]:
            next_tier = tier
            break
    
    return {
        "success": True,
        "topup_id": topup_id,
        "amount": data.amount,
        "bonus": customer_bonus,
        "total_credited": total_credit,
        "merchant_commission": merchant_commission,
        "merchant_commission_rate": merchant_commission_rate,
        "merchant_volume": new_volume,
        "next_tier": {
            "volume_needed": next_tier["min_volume"] - new_volume if next_tier else 0,
            "next_rate": next_tier["rate"] if next_tier else merchant_commission_rate
        } if next_tier and next_tier["min_volume"] > new_volume else None,
        "customer_name": user.get("name"),
        "customer_number": user.get("customer_number"),
        "new_balance": new_balance,
        "message": f"✅ {user.get('name')} hat {total_credit:.2f}€ erhalten ({data.amount:.2f}€ + {customer_bonus:.2f}€ Bonus)!"
    }


@router.get("/topup/bonus-info")
async def get_bonus_info():
    """Get information about the current bonus and commission tiers."""
    return {
        "customer_bonus_tiers": [
            {"min_amount": 200, "bonus": 12.00, "description": "€200+ aufladen → +€12 Bonus (6%)"},
            {"min_amount": 100, "bonus": 5.00, "description": "€100+ aufladen → +€5 Bonus (5%)"},
            {"min_amount": 50, "bonus": 2.00, "description": "€50+ aufladen → +€2 Bonus (4%)"},
            {"min_amount": 20, "bonus": 0.50, "description": "€20+ aufladen → +€0,50 Bonus (2.5%)"},
        ],
        "merchant_commission_tiers": [
            {"min_volume": 10000, "rate": 2.0, "description": "€10.000+ Umsatz → 2% Provision"},
            {"min_volume": 5000, "rate": 1.5, "description": "€5.000+ Umsatz → 1.5% Provision"},
            {"min_volume": 2000, "rate": 1.0, "description": "€2.000+ Umsatz → 1% Provision"},
            {"min_volume": 500, "rate": 0.5, "description": "€500+ Umsatz → 0.5% Provision"},
            {"min_volume": 0, "rate": 0.0, "description": "Start → 0% Provision"},
        ],
        "min_topup": 5,
        "max_topup": 500
    }



# ==================== SCAN & PAY (Merchant scans customer QR) ====================

class ScanPayRequest(BaseModel):
    amount: float = Field(..., gt=0, description="Amount to charge")
    payment_token: str = Field(None, description="Customer's payment token from QR")
    qr_data: Optional[str] = Field(None, description="Raw QR code data (JSON or compact format)")
    customer_id: Optional[str] = Field(None, description="Customer user ID")
    customer_number: Optional[str] = Field(None, description="Customer number (BID-XXXXXX)")


def parse_qr_code(qr_data: str) -> dict:
    """
    Parse QR code data in either JSON or compact format.
    
    JSON format: {"type": "bidblitz_pay", "token": "cpt_xxx", ...}
    Compact format: BIDBLITZ:2.0:cpt_xxx:BID-123456:timestamp
    """
    import json
    
    # Try JSON format first
    if qr_data.startswith("{"):
        try:
            data = json.loads(qr_data)
            return {
                "token": data.get("token"),
                "customer_number": data.get("customer_number"),
                "customer_id": data.get("customer_id"),
                "version": data.get("version", "1.0")
            }
        except json.JSONDecodeError:
            pass
    
    # Try compact format: BIDBLITZ:version:token:customer_number:timestamp
    if qr_data.startswith("BIDBLITZ:"):
        parts = qr_data.split(":")
        if len(parts) >= 4:
            return {
                "token": parts[2],
                "customer_number": parts[3] if len(parts) > 3 else None,
                "expires_timestamp": int(parts[4]) if len(parts) > 4 else None,
                "version": parts[1]
            }
    
    # Assume it's just a raw token
    return {"token": qr_data}


@router.post("/scan-pay")
async def scan_and_pay(
    data: ScanPayRequest,
    x_api_key: str = Header(None, alias="X-API-Key")
):
    """
    Process payment by scanning customer's QR code.
    
    Merchant scans the customer's QR code displayed in their BidBlitz app.
    Amount is deducted from customer's wallet instantly.
    
    Supports both:
    - JSON format: {"type": "bidblitz_pay", "token": "cpt_xxx", ...}
    - Compact format: BIDBLITZ:2.0:cpt_xxx:BID-123456:timestamp
    """
    # Verify API key
    if not x_api_key:
        raise HTTPException(status_code=401, detail="API key required")
    
    api_key = await db.api_keys.find_one(
        {"key": x_api_key, "is_active": True},
        {"_id": 0}
    )
    
    if not api_key:
        raise HTTPException(status_code=401, detail="Invalid or inactive API key")
    
    # Parse QR code data if provided
    payment_token = data.payment_token
    customer_number = data.customer_number
    
    if data.qr_data:
        qr_info = parse_qr_code(data.qr_data)
        payment_token = qr_info.get("token") or payment_token
        customer_number = qr_info.get("customer_number") or customer_number
    
    if not payment_token:
        raise HTTPException(status_code=400, detail="payment_token oder qr_data erforderlich")
    
    # Verify payment token
    token_doc = await db.customer_payment_tokens.find_one(
        {"token": payment_token, "used": False},
        {"_id": 0}
    )
    
    if not token_doc:
        raise HTTPException(status_code=400, detail="Ungültiger oder bereits verwendeter QR-Code")
    
    # Check expiry
    expires_at = datetime.fromisoformat(token_doc["expires_at"].replace("Z", "+00:00"))
    if datetime.now(timezone.utc) > expires_at:
        raise HTTPException(status_code=400, detail="QR-Code abgelaufen")
    
    # Get customer
    user_id = token_doc.get("user_id") or data.customer_id
    user = await db.users.find_one(
        {"id": user_id},
        {"_id": 0, "id": 1, "name": 1, "email": 1, "bidblitz_balance": 1, "balance": 1, "customer_number": 1}
    )
    
    if not user:
        raise HTTPException(status_code=404, detail="Kunde nicht gefunden")
    
    # Check balance
    user_balance = user.get("bidblitz_balance", user.get("balance", 0))
    if user_balance < data.amount:
        raise HTTPException(
            status_code=400,
            detail=f"Nicht genug Guthaben. Verfügbar: €{user_balance:.2f}"
        )
    
    # Mark token as used
    await db.customer_payment_tokens.update_one(
        {"token": payment_token},
        {"$set": {"used": True, "used_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    # Calculate commissions
    platform_commission_rate = api_key.get("platform_commission", 0.5)  # Default 0.5%
    customer_cashback_rate = api_key.get("customer_cashback", 0.0)  # Default 0%
    
    platform_fee = round(data.amount * (platform_commission_rate / 100), 2)
    customer_cashback = round(data.amount * (customer_cashback_rate / 100), 2)
    
    # Net amount to merchant = amount - platform_fee
    merchant_net = data.amount - platform_fee
    
    # Deduct from user balance
    await db.users.update_one(
        {"id": user["id"]},
        {"$inc": {"bidblitz_balance": -data.amount, "balance": -data.amount}}
    )
    
    # Update wallet
    await db.bidblitz_wallets.update_one(
        {"user_id": user["id"]},
        {"$inc": {"universal_balance": -data.amount}},
        upsert=True
    )
    
    # Give customer cashback if configured
    if customer_cashback > 0:
        await db.users.update_one(
            {"id": user["id"]},
            {"$inc": {"bidblitz_balance": customer_cashback, "balance": customer_cashback}}
        )
        await db.bidblitz_wallets.update_one(
            {"user_id": user["id"]},
            {"$inc": {"universal_balance": customer_cashback}},
            upsert=True
        )
    
    # Record platform commission
    if platform_fee > 0:
        await db.platform_commissions.insert_one({
            "id": f"comm_{uuid.uuid4().hex[:16]}",
            "type": "scan_pay",
            "api_key_id": api_key["id"],
            "api_key_name": api_key["name"],
            "payment_amount": data.amount,
            "commission_rate": platform_commission_rate,
            "commission_amount": platform_fee,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
    
    now = datetime.now(timezone.utc)
    payment_id = f"scan_{uuid.uuid4().hex[:16]}"
    
    # Record the payment with commission details
    await db.digital_payments.insert_one({
        "id": payment_id,
        "type": "scan_pay",
        "api_key_id": api_key["id"],
        "api_key_name": api_key["name"],
        "amount": data.amount,
        "platform_fee": platform_fee,
        "merchant_net": merchant_net,
        "customer_cashback": customer_cashback,
        "currency": "EUR",
        "reference": f"SCAN-{now.strftime('%Y%m%d%H%M%S')}",
        "customer_id": user["id"],
        "customer_number": user.get("customer_number"),
        "customer_name": user.get("name"),
        "status": "completed",
        "created_at": now.isoformat(),
        "paid_at": now.isoformat()
    })
    
    # Update API key stats
    await db.api_keys.update_one(
        {"id": api_key["id"]},
        {
            "$inc": {"total_requests": 1, "total_volume": data.amount},
            "$set": {"last_used": now.isoformat()}
        }
    )
    
    # Send webhook if configured
    webhook_url = api_key.get("webhook_url")
    if webhook_url:
        await send_webhook(
            url=webhook_url,
            event="payment.completed",
            data={
                "payment_id": payment_id,
                "type": "scan_pay",
                "amount": data.amount,
                "platform_fee": platform_fee,
                "merchant_net": merchant_net,
                "currency": "EUR",
                "customer_number": user.get("customer_number"),
                "paid_at": now.isoformat()
            },
            secret=api_key.get("secret", "")
        )
    
    # Calculate new balance (after deduction and cashback)
    new_balance = user_balance - data.amount + customer_cashback
    
    return {
        "success": True,
        "payment_id": payment_id,
        "amount": data.amount,
        "platform_fee": platform_fee,
        "merchant_net": merchant_net,
        "customer_cashback": customer_cashback,
        "customer_name": user.get("name"),
        "customer_number": user.get("customer_number"),
        "new_balance": new_balance,
        "message": f"Zahlung von €{data.amount:.2f} erfolgreich!" + (f" +€{customer_cashback:.2f} Cashback!" if customer_cashback > 0 else "")
    }



# ==================== CUSTOMER PAYMENT HISTORY ====================

@router.get("/customer/payments")
async def get_customer_payments(
    authorization: str = Header(None, alias="Authorization"),
    limit: int = 50,
    offset: int = 0
):
    """
    Get payment history for a customer.
    
    Returns all digital payments made by the customer (POS, QR scan, checkout).
    """
    import jwt
    import os
    
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authorization required")
    
    token = authorization.replace("Bearer ", "")
    
    # Decode JWT token
    try:
        secret = os.environ.get("JWT_SECRET", "bidblitz-secret-key-2026")
        payload = jwt.decode(token, secret, algorithms=["HS256"])
        user_id = payload.get("user_id")
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token payload")
    
    # Get user's customer number
    user = await db.users.find_one(
        {"id": user_id},
        {"_id": 0, "id": 1, "customer_number": 1}
    )
    
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    
    customer_number = user.get("customer_number")
    
    # Query payments where user is the payer
    query = {
        "$or": [
            {"customer_id": user_id},
            {"paid_by": user_id},
            {"customer_number": customer_number} if customer_number else {"_id": None}
        ]
    }
    
    # Get total count
    total = await db.digital_payments.count_documents(query)
    
    # Get payments
    cursor = db.digital_payments.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).skip(offset).limit(limit)
    
    payments = await cursor.to_list(length=limit)
    
    return {
        "payments": payments,
        "total": total,
        "limit": limit,
        "offset": offset
    }
