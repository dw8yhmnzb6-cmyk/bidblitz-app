"""
Apple Pay & Google Pay via Stripe Payment Intent API.
Uses real JWT auth, verifies webhook signature, credits wallet atomically on success.
"""
import os
import stripe
import logging
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from typing import Optional

from core.database import db
from core.security import get_current_user
from core.rate_limit import limiter
from core.payment_engine import credit_wallet, TransactionType
from core.audit import log_audit, AuditEvent, get_client_info

router = APIRouter(prefix="/api/payments", tags=["payments"])
logger = logging.getLogger("bidblitz.payments")

stripe.api_key = os.environ.get("STRIPE_API_KEY", "")
STRIPE_WEBHOOK_SECRET = os.environ.get("STRIPE_PI_WEBHOOK_SECRET", "")

# Abuse limits for Apple/Google Pay — server-defined, never trust frontend amounts blindly
MIN_AMOUNT_EUR = 1.00
MAX_AMOUNT_EUR = 500.00  # matches wallet-topup cap in PRD


class CreatePaymentIntentRequest(BaseModel):
    amount: float = Field(..., gt=0, le=MAX_AMOUNT_EUR)
    currency: str = Field(default="eur", pattern="^(eur|usd|gbp|chf)$")
    description: Optional[str] = "BidBlitz Wallet Top-Up"
    metadata: Optional[dict] = None


class PaymentIntentResponse(BaseModel):
    client_secret: str
    payment_intent_id: str


@router.post("/create-payment-intent", response_model=PaymentIntentResponse)
@limiter.limit("10/minute")
async def create_payment_intent(req: CreatePaymentIntentRequest, request: Request):
    """Create Stripe Payment Intent for Apple Pay / Google Pay / Card.
    Requires authenticated user. Metadata carries user_id for webhook credit.
    """
    if not stripe.api_key:
        raise HTTPException(503, "Stripe not configured")
    if req.amount < MIN_AMOUNT_EUR:
        raise HTTPException(400, f"Minimum amount is €{MIN_AMOUNT_EUR:.2f}")

    user = await get_current_user(request)
    user_id = str(user["_id"])
    user_email = user.get("email", "")

    amount_cents = int(round(req.amount * 100))

    try:
        intent = stripe.PaymentIntent.create(
            amount=amount_cents,
            currency=req.currency.lower(),
            description=req.description,
            metadata={
                "user_id": user_id,
                "user_email": user_email,
                "kind": "wallet_topup_pay",
                **(req.metadata or {}),
            },
            automatic_payment_methods={"enabled": True},
        )
    except stripe.error.StripeError as e:
        raise HTTPException(400, f"Stripe error: {str(e)}")

    ip, ua = get_client_info(request)
    await log_audit(
        AuditEvent.PAYMENT_INITIATED,
        user_id=user_id,
        email=user_email,
        ip=ip,
        user_agent=ua,
        details={"provider": "stripe_pi", "amount": req.amount, "currency": req.currency, "pi_id": intent.id},
    )

    return PaymentIntentResponse(client_secret=intent.client_secret, payment_intent_id=intent.id)


@router.get("/payment-intent/{payment_intent_id}")
async def get_payment_intent_status(payment_intent_id: str, request: Request):
    """Return PI status for UI polling. Only visible to owner."""
    user = await get_current_user(request)
    user_id = str(user["_id"])

    try:
        intent = stripe.PaymentIntent.retrieve(payment_intent_id)
    except stripe.error.StripeError as e:
        raise HTTPException(400, f"Stripe error: {str(e)}")

    if (intent.metadata or {}).get("user_id") != user_id:
        raise HTTPException(403, "Not owner")

    return {
        "payment_intent_id": intent.id,
        "status": intent.status,
        "amount": intent.amount / 100,
        "currency": intent.currency,
    }


@router.post("/webhook/stripe-payment")
async def stripe_payment_intent_webhook(request: Request):
    """Stripe webhook for Payment-Intent based Apple/Google Pay flows.
    Credits user wallet atomically when payment_intent.succeeded.
    Configure URL in Stripe Dashboard and set STRIPE_PI_WEBHOOK_SECRET.
    """
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")

    if not STRIPE_WEBHOOK_SECRET:
        # Fail-closed in production, log-only in dev
        logger.warning("STRIPE_PI_WEBHOOK_SECRET not set — rejecting webhook")
        raise HTTPException(503, "Webhook secret not configured")

    try:
        event = stripe.Webhook.construct_event(payload, sig_header, STRIPE_WEBHOOK_SECRET)
    except stripe.error.SignatureVerificationError:
        raise HTTPException(400, "Invalid webhook signature")
    except Exception as e:
        raise HTTPException(400, f"Webhook error: {e}")

    etype = event.get("type")
    data = (event.get("data") or {}).get("object") or {}

    if etype == "payment_intent.succeeded":
        pi_id = data.get("id")
        amount = (data.get("amount") or 0) / 100.0
        currency = data.get("currency", "eur")
        meta = data.get("metadata") or {}
        user_id = meta.get("user_id")

        if not user_id:
            return {"ok": True, "skipped": "no user_id"}

        # Idempotency: skip if already processed
        existing = await db.transactions.find_one({"reference": pi_id})
        if existing:
            return {"ok": True, "idempotent": True}

        # Credit wallet atomically
        try:
            result = await credit_wallet(
                user_id=user_id,
                amount=amount,
                tx_type=TransactionType.STRIPE_TOPUP,
                description=f"Apple/Google Pay — €{amount:.2f}",
                reference=pi_id,
                source="stripe_pi",
                metadata={"currency": currency, "provider": "apple_google_pay"},
                idempotency_key=f"pi:{pi_id}",
            )
            if not result.success:
                raise Exception(result.error or "credit failed")
        except Exception as e:
            logger.error(f"credit_wallet failed for PI {pi_id}: {e}")
            raise HTTPException(500, "Credit failed")

        await log_audit(
            AuditEvent.PAYMENT_SUCCESS,
            user_id=user_id,
            details={"provider": "stripe_pi", "pi_id": pi_id, "amount": amount},
        )
        return {"ok": True, "credited": amount, "currency": currency}

    # Other events acknowledged but not processed
    return {"ok": True, "ignored": etype}
