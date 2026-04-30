"""
Apple Pay & Google Pay Integration via Stripe Payment Request API
Backend: Payment Intents für Wallet-Payments
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
import stripe
import os
from datetime import datetime

router = APIRouter(prefix="/api/payments", tags=["payments"])

# Stripe API Key (bereits vorhanden)
stripe.api_key = os.getenv("STRIPE_API_KEY", "sk_test_emergent")

# ─── Models ───
class CreatePaymentIntentRequest(BaseModel):
    amount: float  # in EUR
    currency: str = "eur"
    description: Optional[str] = "BidBlitz Payment"
    metadata: Optional[dict] = {}

class PaymentIntentResponse(BaseModel):
    client_secret: str
    payment_intent_id: str

# ─── Create Payment Intent ───
@router.post("/create-payment-intent")
async def create_payment_intent(
    req: CreatePaymentIntentRequest,
    user=Depends(lambda: {"user_id": "demo_user", "email": "demo@bidblitz.com"})
):
    """
    Create Stripe Payment Intent for Apple Pay / Google Pay / Card
    Frontend uses this client_secret with Payment Request API
    """
    try:
        # Validate amount
        if req.amount <= 0:
            raise HTTPException(400, "Amount must be greater than 0")
        
        # Convert EUR to cents (Stripe requires smallest currency unit)
        amount_cents = int(req.amount * 100)
        
        # Create Payment Intent
        intent = stripe.PaymentIntent.create(
            amount=amount_cents,
            currency=req.currency.lower(),
            description=req.description,
            metadata={
                "user_id": user["user_id"],
                "user_email": user["email"],
                **req.metadata,
            },
            # Enable automatic payment methods (Apple Pay, Google Pay, Cards)
            automatic_payment_methods={
                "enabled": True,
            },
        )
        
        return PaymentIntentResponse(
            client_secret=intent.client_secret,
            payment_intent_id=intent.id
        )
    
    except stripe.error.StripeError as e:
        raise HTTPException(400, f"Stripe error: {str(e)}")
    except Exception as e:
        raise HTTPException(500, f"Internal error: {str(e)}")

# ─── Confirm Payment Status ───
@router.get("/payment-intent/{payment_intent_id}")
async def get_payment_intent_status(payment_intent_id: str):
    """Check payment intent status"""
    try:
        intent = stripe.PaymentIntent.retrieve(payment_intent_id)
        
        return {
            "payment_intent_id": intent.id,
            "status": intent.status,  # succeeded, processing, requires_action, canceled
            "amount": intent.amount / 100,
            "currency": intent.currency,
            "payment_method": intent.payment_method,
            "metadata": intent.metadata,
        }
    
    except stripe.error.StripeError as e:
        raise HTTPException(400, f"Stripe error: {str(e)}")

# ─── Webhook Handler (for async payment confirmations) ───
@router.post("/webhook/stripe-payment")
async def stripe_webhook(request):
    """
    Handle Stripe webhooks for payment confirmations
    Configure webhook URL in Stripe Dashboard
    """
    # TODO: Implement webhook signature verification
    # TODO: Handle payment_intent.succeeded events
    # TODO: Update user balance/credits in database
    pass
