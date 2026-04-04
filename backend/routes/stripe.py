"""
BidBlitz V2 - Stripe Checkout Routes
Handles wallet top-up via Stripe Checkout Sessions.
"""

import secrets
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from typing import Optional

from emergentintegrations.payments.stripe.checkout import (
    StripeCheckout,
    CheckoutSessionRequest,
)
from core.config import STRIPE_API_KEY
from core.database import db
from core.security import get_current_user
from core.rate_limit import limiter, RATE_STRIPE
from core.audit import log_audit, AuditEvent, get_client_info
from core.compliance import run_compliance_check, BLOCKED, FLAGGED
from routes.promotions import check_applicable_promotion, apply_promotion

router = APIRouter(prefix="/api/stripe", tags=["stripe"])

# Fixed top-up packages — amounts defined server-side only
TOPUP_PACKAGES = {
    "10": 10.0,
    "25": 25.0,
    "50": 50.0,
    "100": 100.0,
    "250": 250.0,
    "500": 500.0,
}


class CheckoutRequest(BaseModel):
    package_id: str = Field(..., description="Top-up package ID (10, 25, 50, 100, 250, 500)")
    origin_url: str = Field(..., description="Frontend origin URL for redirect")


class CheckoutStatusRequest(BaseModel):
    session_id: str


# ── Create Checkout Session ──
@router.post("/checkout")
@limiter.limit(RATE_STRIPE)
async def create_checkout(req: CheckoutRequest, request: Request):
    user = await get_current_user(request)
    user_id = str(user["_id"])
    ip, ua = get_client_info(request)

    # Validate package
    if req.package_id not in TOPUP_PACKAGES:
        raise HTTPException(status_code=400, detail=f"Invalid package. Choose from: {', '.join(TOPUP_PACKAGES.keys())}")

    amount = TOPUP_PACKAGES[req.package_id]

    # ── Compliance check ──
    compliance = await run_compliance_check(user_id, "topup", amount)
    if compliance["outcome"] == BLOCKED:
        await log_audit(AuditEvent.TOPUP_FAILED, user_id=user_id, email=user["email"],
                        ip=ip, user_agent=ua,
                        details={"reason": "compliance_blocked", "rules": compliance["rules"], "amount": amount},
                        severity="warn")
        raise HTTPException(status_code=403, detail=compliance["reason"])
    if compliance["outcome"] == FLAGGED:
        await log_audit(AuditEvent.SUSPICIOUS_ACTIVITY, user_id=user_id, email=user["email"],
                        ip=ip, user_agent=ua,
                        details={"txn_type": "topup", "rules": compliance["rules"], "amount": amount},
                        severity="warn")

    # Build redirect URLs from frontend origin
    origin = req.origin_url.rstrip("/")
    success_url = f"{origin}/wallet?stripe_session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{origin}/wallet?stripe_cancelled=true"

    # Init Stripe
    host_url = str(request.base_url).rstrip("/")
    webhook_url = f"{host_url}/api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)

    # Create checkout session
    checkout_req = CheckoutSessionRequest(
        amount=float(amount),
        currency="eur",
        success_url=success_url,
        cancel_url=cancel_url,
        metadata={
            "user_id": user_id,
            "user_email": user["email"],
            "package_id": req.package_id,
            "amount": str(amount),
            "type": "wallet_topup",
        },
    )

    session = await stripe_checkout.create_checkout_session(checkout_req)

    # Record pending transaction in payment_transactions collection
    payment_record = {
        "session_id": session.session_id,
        "user_id": user_id,
        "user_email": user["email"],
        "amount": amount,
        "currency": "EUR",
        "package_id": req.package_id,
        "type": "wallet_topup",
        "payment_status": "pending",
        "status": "initiated",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.payment_transactions.insert_one(payment_record)
    payment_record.pop("_id", None)

    await log_audit(AuditEvent.TOPUP_INITIATED, user_id=user_id, email=user["email"],
                    ip=ip, user_agent=ua,
                    details={"session_id": session.session_id, "amount": amount,
                             "package_id": req.package_id})

    return {
        "checkout_url": session.url,
        "session_id": session.session_id,
    }


# ── Check Payment Status ──
@router.get("/checkout/status/{session_id}")
async def checkout_status(session_id: str, request: Request):
    user = await get_current_user(request)
    user_id = str(user["_id"])
    ip, ua = get_client_info(request)

    # Find the payment record
    payment = await db.payment_transactions.find_one(
        {"session_id": session_id, "user_id": user_id},
        {"_id": 0},
    )
    if not payment:
        raise HTTPException(status_code=404, detail="Payment session not found")

    # If already processed, return cached status
    if payment["status"] in ("completed", "credited"):
        return {
            "status": payment["status"],
            "payment_status": payment["payment_status"],
            "amount": payment["amount"],
            "currency": payment["currency"],
            "credited": True,
        }

    # Poll Stripe for current status
    host_url = str(request.base_url).rstrip("/")
    webhook_url = f"{host_url}/api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)

    stripe_status = await stripe_checkout.get_checkout_status(session_id)

    # Update payment record
    new_status = "completed" if stripe_status.payment_status == "paid" else stripe_status.status
    new_payment_status = stripe_status.payment_status

    await db.payment_transactions.update_one(
        {"session_id": session_id},
        {"$set": {
            "status": new_status,
            "payment_status": new_payment_status,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }},
    )

    credited = False
    topup_promo = None

    # If paid, credit the wallet (only once)
    if stripe_status.payment_status == "paid" and payment["status"] not in ("completed", "credited"):
        # Atomic update — use findOneAndUpdate with status check to prevent double credit
        result = await db.payment_transactions.find_one_and_update(
            {"session_id": session_id, "status": {"$nin": ["completed", "credited"]}},
            {"$set": {"status": "credited", "updated_at": datetime.now(timezone.utc).isoformat()}},
        )

        if result:
            # Credit wallet
            await db.users.update_one(
                {"_id": user["_id"]},
                {"$inc": {"balance": payment["amount"]}},
            )

            # Create transaction record
            txn = {
                "id": secrets.token_hex(8),
                "user_id": user_id,
                "type": "topup",
                "amount": payment["amount"],
                "description": f"Stripe top-up (EUR {payment['amount']:.2f})",
                "merchant_name": "Stripe",
                "status": "completed",
                "reference": f"STRIPE-{session_id[:12].upper()}",
                "payment_method": "stripe",
                "category": "topup",
                "stripe_session_id": session_id,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
            await db.transactions.insert_one(txn)
            txn.pop("_id", None)

            credited = True

            await log_audit(AuditEvent.TOPUP_SUCCESS, user_id=user_id, email=user.get("email", ""),
                            ip=ip, user_agent=ua,
                            details={"session_id": session_id, "amount": payment["amount"],
                                     "reference": txn["reference"]})

            # ── Check for bonus_topup promotions ──
            topup_promo = None
            try:
                promo = await check_applicable_promotion(user_id, "topup", payment["amount"])
                if promo:
                    bonus = round(payment["amount"] * promo["value"] / 100, 2)
                    if bonus > 0:
                        await db.users.update_one({"_id": user["_id"]}, {"$inc": {"balance": bonus}})
                        await db.transactions.insert_one({
                            "id": secrets.token_hex(8),
                            "user_id": user_id,
                            "type": "reward",
                            "amount": bonus,
                            "description": f"Top-up bonus: {promo['name']} ({promo['value']}%)",
                            "status": "completed",
                            "reference": f"PROMO-{secrets.token_hex(4).upper()}",
                            "category": "promotion",
                            "created_at": datetime.now(timezone.utc).isoformat(),
                        })
                        await apply_promotion(user_id, promo["name"], payment["amount"])
                        topup_promo = {"name": promo["name"], "bonus": bonus, "value": promo["value"]}
            except Exception:
                pass

    if stripe_status.payment_status != "paid" and payment["status"] not in ("completed", "credited"):
        await log_audit(AuditEvent.TOPUP_FAILED, user_id=user_id, email=user.get("email", ""),
                        ip=ip, user_agent=ua,
                        details={"session_id": session_id, "stripe_status": stripe_status.status,
                                 "payment_status": stripe_status.payment_status},
                        severity="warn")

    resp = {
        "status": new_status if not credited else "credited",
        "payment_status": new_payment_status,
        "amount": payment["amount"],
        "currency": payment["currency"],
        "credited": credited,
    }
    if credited and topup_promo:
        resp["promotion"] = topup_promo
    return resp


# ── Webhook ──
@router.post("/webhook")
async def stripe_webhook(request: Request):
    body = await request.body()
    signature = request.headers.get("Stripe-Signature", "")

    try:
        host_url = str(request.base_url).rstrip("/")
        webhook_url = f"{host_url}/api/webhook/stripe"
        stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
        event = await stripe_checkout.handle_webhook(body, signature)

        if event.payment_status == "paid" and event.session_id:
            # Find and credit if not already done
            payment = await db.payment_transactions.find_one({"session_id": event.session_id})
            if payment and payment["status"] not in ("completed", "credited"):
                result = await db.payment_transactions.find_one_and_update(
                    {"session_id": event.session_id, "status": {"$nin": ["completed", "credited"]}},
                    {"$set": {"status": "credited", "payment_status": "paid", "updated_at": datetime.now(timezone.utc).isoformat()}},
                )
                if result:
                    await db.users.update_one(
                        {"_id": {"$eq": result["user_id"]}},
                        {"$inc": {"balance": result["amount"]}},
                    )
                    txn = {
                        "id": secrets.token_hex(8),
                        "user_id": result["user_id"],
                        "type": "topup",
                        "amount": result["amount"],
                        "description": f"Stripe top-up (EUR {result['amount']:.2f})",
                        "merchant_name": "Stripe",
                        "status": "completed",
                        "reference": f"STRIPE-{event.session_id[:12].upper()}",
                        "payment_method": "stripe",
                        "category": "topup",
                        "stripe_session_id": event.session_id,
                        "created_at": datetime.now(timezone.utc).isoformat(),
                    }
                    await db.transactions.insert_one(txn)

        return {"received": True}
    except Exception:
        return {"received": True}


# ── Get available packages ──
@router.get("/packages")
async def get_packages():
    return {
        "packages": [
            {"id": k, "amount": v, "currency": "EUR", "label": f"EUR {v:.2f}"}
            for k, v in sorted(TOPUP_PACKAGES.items(), key=lambda x: x[1])
        ]
    }
