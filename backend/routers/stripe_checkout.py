"""
Stripe Checkout Integration for BidBlitz Pay Wallet Top-up
Allows users to top up their wallet using credit card payments
"""
import os
import logging
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, HTTPException, Request, Depends
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

# Import Stripe integration
from emergentintegrations.payments.stripe.checkout import (
    StripeCheckout, 
    CheckoutSessionResponse, 
    CheckoutStatusResponse, 
    CheckoutSessionRequest
)

# Database from config
from config import db

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Stripe Checkout"])

# Fixed top-up packages (amounts in EUR)
TOP_UP_PACKAGES = {
    "10": 10.00,
    "25": 25.00,
    "50": 50.00,
    "100": 100.00,
    "200": 200.00,
    "500": 500.00,
    "custom": None  # For custom amounts within limits
}

MIN_TOPUP = 5.00
MAX_TOPUP = 500.00


class TopUpRequest(BaseModel):
    """Request model for creating a top-up checkout session"""
    package_id: Optional[str] = None  # e.g., "10", "25", "50", "100", "custom"
    custom_amount: Optional[float] = None  # Only used when package_id is "custom"
    origin_url: str  # Frontend URL for success/cancel redirects


class TopUpResponse(BaseModel):
    """Response model for checkout session creation"""
    checkout_url: str
    session_id: str


class PaymentStatusResponse(BaseModel):
    """Response model for payment status check"""
    status: str
    payment_status: str
    amount: float
    currency: str
    wallet_credited: bool
    message: str


@router.post("/create-topup-session")
async def create_topup_session(
    request: Request,
    topup_request: TopUpRequest
) -> TopUpResponse:
    """
    Create a Stripe Checkout session for wallet top-up.
    Amount is determined server-side from fixed packages for security.
    """
    db = get_database()
    
    # Get user from token (if authenticated)
    token = request.query_params.get("token")
    user_id = None
    user_email = None
    
    if token:
        user = await db.users.find_one({"auth_token": token})
        if user:
            user_id = user.get("id")
            user_email = user.get("email")
    
    if not user_id:
        raise HTTPException(status_code=401, detail="Nicht autorisiert")
    
    # Determine amount from package (SECURITY: Never accept amount from frontend)
    if topup_request.package_id == "custom":
        if not topup_request.custom_amount:
            raise HTTPException(status_code=400, detail="Bitte Betrag eingeben")
        
        amount = float(topup_request.custom_amount)
        
        if amount < MIN_TOPUP:
            raise HTTPException(status_code=400, detail=f"Mindestbetrag: €{MIN_TOPUP}")
        if amount > MAX_TOPUP:
            raise HTTPException(status_code=400, detail=f"Maximalbetrag: €{MAX_TOPUP}")
    else:
        if topup_request.package_id not in TOP_UP_PACKAGES:
            raise HTTPException(status_code=400, detail="Ungültiges Paket")
        
        amount = TOP_UP_PACKAGES[topup_request.package_id]
    
    # Build success/cancel URLs from frontend origin
    origin_url = topup_request.origin_url.rstrip("/")
    success_url = f"{origin_url}/bidblitz-pay?payment=success&session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{origin_url}/bidblitz-pay?payment=cancelled"
    
    # Initialize Stripe Checkout
    api_key = os.environ.get("STRIPE_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="Stripe nicht konfiguriert")
    
    host_url = str(request.base_url).rstrip("/")
    webhook_url = f"{host_url}/api/stripe/webhook"
    
    stripe_checkout = StripeCheckout(api_key=api_key, webhook_url=webhook_url)
    
    # Create metadata for tracking
    metadata = {
        "user_id": user_id,
        "user_email": user_email or "",
        "type": "wallet_topup",
        "package_id": topup_request.package_id or "custom"
    }
    
    try:
        # Create checkout session
        checkout_request = CheckoutSessionRequest(
            amount=amount,
            currency="eur",
            success_url=success_url,
            cancel_url=cancel_url,
            metadata=metadata
        )
        
        session: CheckoutSessionResponse = await stripe_checkout.create_checkout_session(checkout_request)
        
        # Create payment transaction record BEFORE redirect
        transaction = {
            "session_id": session.session_id,
            "user_id": user_id,
            "user_email": user_email,
            "amount": amount,
            "currency": "eur",
            "type": "wallet_topup",
            "package_id": topup_request.package_id or "custom",
            "status": "pending",
            "payment_status": "initiated",
            "wallet_credited": False,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
            "metadata": metadata
        }
        
        await db.payment_transactions.insert_one(transaction)
        
        logger.info(f"Created checkout session {session.session_id} for user {user_id}, amount €{amount}")
        
        return TopUpResponse(
            checkout_url=session.url,
            session_id=session.session_id
        )
        
    except Exception as e:
        logger.error(f"Stripe checkout error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Zahlung konnte nicht erstellt werden: {str(e)}")


@router.get("/payment-status/{session_id}")
async def get_payment_status(
    request: Request,
    session_id: str
) -> PaymentStatusResponse:
    """
    Check the status of a payment and credit wallet if successful.
    This endpoint is polled by the frontend after returning from Stripe.
    """
    db = get_database()
    
    # Find the transaction
    transaction = await db.payment_transactions.find_one({"session_id": session_id})
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaktion nicht gefunden")
    
    # If already credited, return cached status
    if transaction.get("wallet_credited"):
        return PaymentStatusResponse(
            status="complete",
            payment_status="paid",
            amount=transaction["amount"],
            currency=transaction["currency"],
            wallet_credited=True,
            message="Guthaben wurde bereits gutgeschrieben"
        )
    
    # Check status with Stripe
    api_key = os.environ.get("STRIPE_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="Stripe nicht konfiguriert")
    
    host_url = str(request.base_url).rstrip("/")
    webhook_url = f"{host_url}/api/stripe/webhook"
    
    stripe_checkout = StripeCheckout(api_key=api_key, webhook_url=webhook_url)
    
    try:
        status: CheckoutStatusResponse = await stripe_checkout.get_checkout_status(session_id)
        
        # Update transaction status
        update_data = {
            "status": status.status,
            "payment_status": status.payment_status,
            "updated_at": datetime.now(timezone.utc)
        }
        
        # Credit wallet if payment is successful and not already credited
        wallet_credited = False
        message = "Zahlung wird verarbeitet..."
        
        if status.payment_status == "paid" and not transaction.get("wallet_credited"):
            # Credit the user's wallet
            user_id = transaction.get("user_id")
            amount = transaction["amount"]
            
            # Get current wallet balance
            wallet = await db.bidblitz_wallets.find_one({"user_id": user_id})
            
            if wallet:
                # Update existing wallet
                new_balance = wallet.get("universal_balance", 0) + amount
                await db.bidblitz_wallets.update_one(
                    {"user_id": user_id},
                    {
                        "$set": {
                            "universal_balance": new_balance,
                            "updated_at": datetime.now(timezone.utc)
                        }
                    }
                )
            else:
                # Create new wallet
                await db.bidblitz_wallets.insert_one({
                    "user_id": user_id,
                    "universal_balance": amount,
                    "partner_balances": {},
                    "created_at": datetime.now(timezone.utc),
                    "updated_at": datetime.now(timezone.utc)
                })
            
            # Record the top-up transaction in wallet history
            await db.bidblitz_pay_transactions.insert_one({
                "user_id": user_id,
                "type": "stripe_topup",
                "amount": amount,
                "direction": "credit",
                "description": f"Aufladung via Karte (€{amount:.2f})",
                "stripe_session_id": session_id,
                "created_at": datetime.now(timezone.utc)
            })
            
            update_data["wallet_credited"] = True
            wallet_credited = True
            message = f"€{amount:.2f} erfolgreich gutgeschrieben!"
            
            logger.info(f"Wallet credited for user {user_id}: €{amount}")
        
        elif status.status == "expired":
            message = "Zahlung abgelaufen. Bitte erneut versuchen."
        
        elif status.payment_status == "unpaid":
            message = "Zahlung wird verarbeitet..."
        
        # Update transaction in database
        await db.payment_transactions.update_one(
            {"session_id": session_id},
            {"$set": update_data}
        )
        
        return PaymentStatusResponse(
            status=status.status,
            payment_status=status.payment_status,
            amount=transaction["amount"],
            currency=transaction["currency"],
            wallet_credited=wallet_credited,
            message=message
        )
        
    except Exception as e:
        logger.error(f"Payment status error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Status konnte nicht abgerufen werden: {str(e)}")


@router.post("/webhook")
async def stripe_webhook(request: Request):
    """
    Handle Stripe webhook events for payment updates.
    """
    db = get_database()
    
    api_key = os.environ.get("STRIPE_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="Stripe nicht konfiguriert")
    
    host_url = str(request.base_url).rstrip("/")
    webhook_url = f"{host_url}/api/stripe/webhook"
    
    stripe_checkout = StripeCheckout(api_key=api_key, webhook_url=webhook_url)
    
    try:
        body = await request.body()
        signature = request.headers.get("Stripe-Signature")
        
        webhook_response = await stripe_checkout.handle_webhook(body, signature)
        
        if webhook_response and webhook_response.session_id:
            # Update transaction based on webhook event
            session_id = webhook_response.session_id
            
            await db.payment_transactions.update_one(
                {"session_id": session_id},
                {
                    "$set": {
                        "status": webhook_response.event_type,
                        "payment_status": webhook_response.payment_status,
                        "updated_at": datetime.now(timezone.utc)
                    }
                }
            )
            
            logger.info(f"Webhook received for session {session_id}: {webhook_response.event_type}")
        
        return {"status": "ok"}
        
    except Exception as e:
        logger.error(f"Webhook error: {str(e)}")
        return {"status": "error", "message": str(e)}
