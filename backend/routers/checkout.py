"""Checkout router - Payment processing with Stripe and Coinbase"""
from fastapi import APIRouter, HTTPException, Depends, Request
from datetime import datetime, timezone
from typing import Optional
import uuid
import os
import stripe

from config import db, logger, BID_PACKAGES, FRONTEND_URL, coinbase_client
from dependencies import get_current_user
from schemas import CheckoutRequest

router = APIRouter(prefix="/checkout", tags=["Checkout"])

# Stripe configuration
STRIPE_API_KEY = os.environ.get('STRIPE_API_KEY')
if STRIPE_API_KEY:
    stripe.api_key = STRIPE_API_KEY

# Check if crypto payments are available
def is_crypto_available():
    coinbase_key = os.environ.get('COINBASE_COMMERCE_API_KEY', '')
    return bool(coinbase_key and coinbase_key not in ['pennyauction', 'your_key_here', 'test', ''])

# ==================== PAYMENT STATUS ====================

@router.get("/payment-methods")
async def get_payment_methods():
    """Get available payment methods"""
    return {
        "stripe": bool(STRIPE_API_KEY),
        "crypto": is_crypto_available(),
        "paypal": False  # Not yet implemented
    }

# ==================== STRIPE CHECKOUT ====================

@router.post("/create-session")
async def create_checkout_session(request: CheckoutRequest, user: dict = Depends(get_current_user)):
    """Create a Stripe checkout session using direct Stripe API"""
    if not STRIPE_API_KEY:
        raise HTTPException(status_code=503, detail="Payment service unavailable")
    
    package = next((p for p in BID_PACKAGES if p["id"] == request.package_id), None)
    if not package:
        raise HTTPException(status_code=400, detail="Invalid package")
    
    try:
        # Check for HAPPY HOUR bonus
        happy_hour_active = False
        happy_hour_multiplier = 1.0
        try:
            from routers.gamification import get_happy_hour_config, is_happy_hour_active
            hh_config = await get_happy_hour_config()
            hh_status = is_happy_hour_active(hh_config)
            if hh_status.get("active"):
                happy_hour_active = True
                happy_hour_multiplier = hh_status.get("multiplier", 2.0)
        except Exception as e:
            logger.error(f"Error checking happy hour: {e}")
        
        # Calculate total bids with Happy Hour bonus
        base_bids = package["bids"] + package.get("bonus", 0)
        if happy_hour_active:
            total_bids = int(base_bids * happy_hour_multiplier)
            logger.info(f"🎉 HAPPY HOUR: {base_bids} x {happy_hour_multiplier} = {total_bids} bids")
        else:
            total_bids = base_bids
        
        # Create pending transaction
        transaction_id = str(uuid.uuid4())
        
        await db.transactions.insert_one({
            "id": transaction_id,
            "user_id": user["id"],
            "package_id": package["id"],
            "bids": total_bids,
            "base_bids": base_bids,
            "happy_hour_active": happy_hour_active,
            "happy_hour_multiplier": happy_hour_multiplier if happy_hour_active else None,
            "amount": float(package["price"]),
            "status": "pending",
            "payment_method": "stripe",
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        
        # Create product description
        product_desc = f"BidBlitz Gebotspaket mit {package['bids']} Geboten"
        if package.get('bonus'):
            product_desc += f" + {package.get('bonus', 0)} Bonus"
        if happy_hour_active:
            product_desc += f" 🎉 HAPPY HOUR: x{int(happy_hour_multiplier)} = {total_bids} Gebote!"
        
        # Create Stripe session using native Stripe library
        session = stripe.checkout.Session.create(
            payment_method_types=["card"],
            line_items=[{
                "price_data": {
                    "currency": "eur",
                    "unit_amount": int(float(package["price"]) * 100),
                    "product_data": {
                        "name": f"{total_bids} Gebote - {package['name']}" + (" 🎉 HAPPY HOUR!" if happy_hour_active else ""),
                        "description": product_desc
                    }
                },
                "quantity": 1
            }],
            mode="payment",
            success_url=f"{FRONTEND_URL}/payment/success?session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url=f"{FRONTEND_URL}/buy-bids?canceled=true",
            metadata={
                "user_id": user["id"],
                "package_id": package["id"],
                "transaction_id": transaction_id,
                "bids": str(total_bids),
                "package_name": package["name"]
            }
        )
        
        # Update transaction with session ID
        await db.transactions.update_one(
            {"id": transaction_id},
            {"$set": {"stripe_session_id": session.id}}
        )
        
        return {
            "session_id": session.id,
            "url": session.url,
            "transaction_id": transaction_id
        }
        
    except stripe.error.StripeError as e:
        logger.error(f"Stripe checkout error: {e}")
        raise HTTPException(status_code=500, detail=f"Payment error: {str(e)}")
    except Exception as e:
        logger.error(f"Checkout error: {e}")
        raise HTTPException(status_code=500, detail=f"Payment error: {str(e)}")

@router.get("/status/{session_id}")
async def get_checkout_status(session_id: str, user: dict = Depends(get_current_user)):
    """Check the status of a checkout session"""
    if not STRIPE_API_KEY:
        raise HTTPException(status_code=503, detail="Payment service unavailable")
    
    try:
        session = stripe.checkout.Session.retrieve(session_id)
        
        if session.payment_status == "paid":
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
            "status": session.status,
            "payment_status": session.payment_status
        }
        
    except stripe.error.StripeError as e:
        logger.error(f"Stripe status check error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
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
    # Check if Coinbase is properly configured
    coinbase_key = os.environ.get('COINBASE_COMMERCE_API_KEY', '')
    
    # Check for placeholder or invalid keys
    if not coinbase_key or coinbase_key in ['pennyauction', 'your_key_here', 'test', '']:
        raise HTTPException(
            status_code=503, 
            detail="Krypto-Zahlungen sind derzeit nicht verfügbar. Bitte verwenden Sie Kreditkarte oder kontaktieren Sie den Support."
        )
    
    if not coinbase_client:
        raise HTTPException(
            status_code=503, 
            detail="Krypto-Zahlungen sind nicht konfiguriert. Bitte kontaktieren Sie den Administrator."
        )
    
    # Verify package (don't validate bids - just package_id and price)
    package = next((p for p in BID_PACKAGES if p["id"] == package_id), None)
    if not package or float(package["price"]) != float(price):
        raise HTTPException(status_code=400, detail="Invalid package details")
    
    # Calculate total bids including bonus
    total_bids = package["bids"] + package.get("bonus", 0)
    
    try:
        # Create pending transaction
        transaction_id = str(uuid.uuid4())
        await db.transactions.insert_one({
            "id": transaction_id,
            "user_id": user["id"],
            "user_email": user["email"],
            "package_id": package_id,
            "bids": total_bids,
            "amount": float(price),
            "status": "pending",
            "payment_method": "crypto",
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        
        # Create Coinbase charge
        charge = coinbase_client.charge.create(
            name=f"{total_bids} Gebote - BidBlitz",
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
                "bids": str(total_bids)
            },
            redirect_url=f"{FRONTEND_URL}/payment/crypto-success",
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
        error_msg = str(e)
        logger.error(f"Coinbase charge error: {e}")
        
        # Provide user-friendly error messages
        if "No such API key" in error_msg or "invalid" in error_msg.lower():
            raise HTTPException(
                status_code=503, 
                detail="Krypto-Zahlungen sind derzeit nicht verfügbar. Der API-Schlüssel muss aktualisiert werden."
            )
        
        raise HTTPException(status_code=500, detail=f"Krypto-Zahlung fehlgeschlagen: Bitte versuchen Sie es später erneut.")

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
