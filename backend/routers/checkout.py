"""Checkout router - Payment processing with Stripe and Coinbase"""
from fastapi import APIRouter, HTTPException, Depends, Request
from datetime import datetime, timezone
from typing import Optional
import uuid
import os

from config import db, logger, BID_PACKAGES, FRONTEND_URL, coinbase_client
from dependencies import get_current_user
from schemas import CheckoutRequest

router = APIRouter(prefix="/checkout", tags=["Checkout"])

# Stripe checkout using emergent integration
try:
    from emergentintegrations.payments.stripe.checkout import (
        StripeCheckout, CheckoutSessionResponse, CheckoutStatusResponse, CheckoutSessionRequest
    )
    STRIPE_API_KEY = os.environ.get('STRIPE_API_KEY')
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY) if STRIPE_API_KEY else None
except ImportError:
    stripe_checkout = None
    logger.warning("Stripe integration not available")

# ==================== STRIPE CHECKOUT ====================

@router.post("/create-session")
async def create_checkout_session(request: CheckoutRequest, user: dict = Depends(get_current_user)):
    """Create a Stripe checkout session"""
    if not stripe_checkout:
        raise HTTPException(status_code=503, detail="Payment service unavailable")
    
    package = next((p for p in BID_PACKAGES if p["id"] == request.package_id), None)
    if not package:
        raise HTTPException(status_code=400, detail="Invalid package")
    
    try:
        # Create pending transaction
        transaction_id = str(uuid.uuid4())
        await db.transactions.insert_one({
            "id": transaction_id,
            "user_id": user["id"],
            "package_id": package["id"],
            "bids": package["bids"],
            "amount": package["price"],
            "status": "pending",
            "payment_method": "stripe",
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        
        # Create Stripe session
        checkout_request = CheckoutSessionRequest(
            line_items=[{
                "price_data": {
                    "currency": "eur",
                    "unit_amount": int(package["price"] * 100),
                    "product_data": {
                        "name": f"{package['bids']} Gebote - {package['name']}",
                        "description": f"BidBlitz Gebotspaket"
                    }
                },
                "quantity": 1
            }],
            success_url=f"{FRONTEND_URL}/checkout/success?session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url=f"{FRONTEND_URL}/buy-bids?canceled=true",
            mode="payment",
            metadata={
                "user_id": user["id"],
                "package_id": package["id"],
                "transaction_id": transaction_id
            },
            payment_method_types=["card", "klarna", "sepa_debit"]
        )
        
        session = await stripe_checkout.create_checkout_session(checkout_request)
        
        # Update transaction with session ID
        await db.transactions.update_one(
            {"id": transaction_id},
            {"$set": {"stripe_session_id": session.session_id}}
        )
        
        return {
            "session_id": session.session_id,
            "url": session.url,
            "transaction_id": transaction_id
        }
        
    except Exception as e:
        logger.error(f"Stripe checkout error: {e}")
        raise HTTPException(status_code=500, detail=f"Payment error: {str(e)}")

@router.get("/status/{session_id}")
async def get_checkout_status(session_id: str, user: dict = Depends(get_current_user)):
    """Check the status of a checkout session"""
    if not stripe_checkout:
        raise HTTPException(status_code=503, detail="Payment service unavailable")
    
    try:
        status = await stripe_checkout.get_checkout_status(session_id)
        
        if status.payment_status == "paid":
            # Find and complete transaction
            transaction = await db.transactions.find_one({
                "stripe_session_id": session_id,
                "status": "pending"
            })
            
            if transaction:
                # Credit bids to user
                await db.users.update_one(
                    {"id": transaction["user_id"]},
                    {
                        "$inc": {"bids_balance": transaction["bids"], "total_deposits": transaction["amount"]},
                        "$set": {"last_purchase_at": datetime.now(timezone.utc).isoformat()}
                    }
                )
                
                # Mark transaction complete
                await db.transactions.update_one(
                    {"id": transaction["id"]},
                    {"$set": {"status": "completed", "completed_at": datetime.now(timezone.utc).isoformat()}}
                )
                
                # Handle referral rewards
                await process_referral_reward(transaction["user_id"], transaction["amount"])
                
                logger.info(f"Payment completed: {transaction['bids']} bids for user {transaction['user_id']}")
        
        return {
            "status": status.status,
            "payment_status": status.payment_status
        }
        
    except Exception as e:
        logger.error(f"Status check error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ==================== COINBASE CRYPTO CHECKOUT ====================

@router.post("/create-crypto-charge")
async def create_crypto_charge(
    package_id: str,
    bids: int,
    price: float,
    user: dict = Depends(get_current_user)
):
    """Create a Coinbase Commerce charge for crypto payment"""
    if not coinbase_client:
        raise HTTPException(status_code=503, detail="Crypto payments not configured")
    
    # Verify package
    package = next((p for p in BID_PACKAGES if p["id"] == package_id), None)
    if not package or package["price"] != price or package["bids"] != bids:
        raise HTTPException(status_code=400, detail="Invalid package details")
    
    try:
        # Create pending transaction
        transaction_id = str(uuid.uuid4())
        await db.transactions.insert_one({
            "id": transaction_id,
            "user_id": user["id"],
            "user_email": user["email"],
            "package_id": package_id,
            "bids": bids,
            "amount": price,
            "status": "pending",
            "payment_method": "crypto",
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        
        # Create Coinbase charge
        charge = coinbase_client.charge.create(
            name=f"{bids} Gebote - BidBlitz",
            description=f"Gebotspaket für {user['email']}",
            pricing_type="fixed_price",
            local_price={
                "amount": str(price),
                "currency": "EUR"
            },
            metadata={
                "user_id": user["id"],
                "transaction_id": transaction_id,
                "package_id": package_id,
                "bids": str(bids)
            },
            redirect_url=f"{FRONTEND_URL}/checkout/crypto-success",
            cancel_url=f"{FRONTEND_URL}/buy-bids?canceled=true"
        )
        
        # Update transaction with charge ID
        await db.transactions.update_one(
            {"id": transaction_id},
            {"$set": {"coinbase_charge_id": charge.id, "coinbase_code": charge.code}}
        )
        
        return {
            "charge_id": charge.id,
            "hosted_url": charge.hosted_url,
            "code": charge.code,
            "transaction_id": transaction_id
        }
        
    except Exception as e:
        logger.error(f"Coinbase charge error: {e}")
        raise HTTPException(status_code=500, detail=f"Crypto payment error: {str(e)}")

@router.post("/webhook/coinbase")
async def coinbase_webhook(request: Request):
    """Handle Coinbase Commerce webhooks"""
    try:
        body = await request.json()
        event = body.get("event", {})
        event_type = event.get("type")
        data = event.get("data", {})
        
        logger.info(f"Coinbase webhook: {event_type}")
        
        if event_type == "charge:confirmed":
            metadata = data.get("metadata", {})
            user_id = metadata.get("user_id")
            transaction_id = metadata.get("transaction_id")
            bids = int(metadata.get("bids", 0))
            
            if user_id and transaction_id and bids:
                # Check if already processed
                transaction = await db.transactions.find_one({
                    "id": transaction_id,
                    "status": "pending"
                })
                
                if transaction:
                    # Credit bids
                    await db.users.update_one(
                        {"id": user_id},
                        {
                            "$inc": {"bids_balance": bids, "total_deposits": transaction["amount"]},
                            "$set": {"last_purchase_at": datetime.now(timezone.utc).isoformat()}
                        }
                    )
                    
                    # Mark complete
                    await db.transactions.update_one(
                        {"id": transaction_id},
                        {"$set": {"status": "completed", "completed_at": datetime.now(timezone.utc).isoformat()}}
                    )
                    
                    # Handle referral
                    await process_referral_reward(user_id, transaction["amount"])
                    
                    logger.info(f"Crypto payment completed: {bids} bids for user {user_id}")
        
        return {"status": "ok"}
        
    except Exception as e:
        logger.error(f"Coinbase webhook error: {e}")
        return {"status": "error", "message": str(e)}

# ==================== HELPER FUNCTIONS ====================

async def process_referral_reward(user_id: str, amount: float):
    """Process referral rewards when user makes a deposit"""
    from config import REFERRAL_MIN_DEPOSIT, REFERRAL_REWARD_BIDS
    
    user = await db.users.find_one({"id": user_id})
    if not user:
        return
    
    # Check if referral reward pending and deposit threshold met
    if user.get("referral_reward_pending") and amount >= REFERRAL_MIN_DEPOSIT:
        referred_by = user.get("referred_by")
        if referred_by:
            # Reward referee
            await db.users.update_one(
                {"id": user_id},
                {
                    "$inc": {"bids_balance": REFERRAL_REWARD_BIDS},
                    "$set": {"referral_reward_pending": False}
                }
            )
            
            # Reward referrer
            await db.users.update_one(
                {"id": referred_by},
                {"$inc": {"bids_balance": REFERRAL_REWARD_BIDS, "referral_rewards_earned": REFERRAL_REWARD_BIDS}}
            )
            
            logger.info(f"Referral rewards granted: {REFERRAL_REWARD_BIDS} bids each to {user_id} and {referred_by}")
