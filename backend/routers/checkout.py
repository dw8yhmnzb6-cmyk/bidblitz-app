"""Checkout router - Payment processing with Stripe and Coinbase"""
from fastapi import APIRouter, HTTPException, Depends, Request
from datetime import datetime, timezone
from typing import Optional
from pydantic import BaseModel
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

async def process_referral_reward_checkout(user_id: str, amount: float, is_subscription: bool = False):
    """Process referral rewards when user makes a deposit - calls the central referral system"""
    from routers.referral import process_referral_reward as central_referral_reward
    
    # Call the central referral reward system
    await central_referral_reward(user_id, is_subscription=is_subscription)
    
    logger.info(f"Referral check for user {user_id}, amount €{amount}, subscription={is_subscription}")

# Keep old function name for backwards compatibility
async def process_referral_reward(user_id: str, amount: float):
    """Wrapper for backwards compatibility"""
    await process_referral_reward_checkout(user_id, amount, is_subscription=False)


# ==================== WON AUCTION CHECKOUT ====================

class ShippingAddress(BaseModel):
    name: str
    street: str
    city: str
    postal_code: str
    country: str = "Deutschland"
    phone: Optional[str] = None

class WonAuctionCheckout(BaseModel):
    auction_id: str
    shipping_address: Optional[ShippingAddress] = None


@router.post("/won-auction")
async def create_won_auction_checkout(data: WonAuctionCheckout, user: dict = Depends(get_current_user)):
    """Create Stripe checkout session for a won auction"""
    if not STRIPE_API_KEY:
        raise HTTPException(status_code=503, detail="Zahlungsservice nicht verfügbar")
    
    # Find the won auction
    auction = await db.auctions.find_one({
        "id": data.auction_id,
        "winner_id": user["id"],
        "status": "ended"
    }, {"_id": 0})
    
    if not auction:
        raise HTTPException(status_code=404, detail="Gewonnene Auktion nicht gefunden oder bereits bezahlt")
    
    # Check if already paid
    existing_payment = await db.auction_payments.find_one({
        "auction_id": data.auction_id,
        "status": "paid"
    })
    if existing_payment:
        raise HTTPException(status_code=400, detail="Auktion bereits bezahlt")
    
    # Get product info
    product = await db.products.find_one({"id": auction.get("product_id")}, {"_id": 0})
    product_name = product.get("name", "Auktionsgewinn") if product else "Auktionsgewinn"
    product_image = product.get("image_url") if product else None
    
    # Calculate prices
    final_price = auction.get("final_price") or auction.get("current_price", 0)
    shipping_cost = 4.99  # Fixed shipping cost
    total_amount = final_price + shipping_cost
    
    try:
        # Create payment record
        payment_id = str(uuid.uuid4())
        
        # Save shipping address if provided
        shipping_data = None
        if data.shipping_address:
            shipping_data = data.shipping_address.dict()
        
        await db.auction_payments.insert_one({
            "id": payment_id,
            "auction_id": data.auction_id,
            "user_id": user["id"],
            "user_email": user.get("email"),
            "product_name": product_name,
            "product_id": auction.get("product_id"),
            "final_price": final_price,
            "shipping_cost": shipping_cost,
            "total_amount": total_amount,
            "shipping_address": shipping_data,
            "status": "pending",
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        
        # Prepare line items for Stripe
        line_items = [
            {
                "price_data": {
                    "currency": "eur",
                    "unit_amount": int(final_price * 100),
                    "product_data": {
                        "name": product_name,
                        "description": f"Auktionsgewinn - Endpreis €{final_price:.2f}",
                        "images": [product_image] if product_image else []
                    }
                },
                "quantity": 1
            },
            {
                "price_data": {
                    "currency": "eur",
                    "unit_amount": int(shipping_cost * 100),
                    "product_data": {
                        "name": "Versandkosten",
                        "description": "Standardversand innerhalb Deutschlands"
                    }
                },
                "quantity": 1
            }
        ]
        
        # Create Stripe session
        session = stripe.checkout.Session.create(
            payment_method_types=["card"],
            line_items=line_items,
            mode="payment",
            success_url=f"{FRONTEND_URL}/won-auction/{data.auction_id}/success?session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url=f"{FRONTEND_URL}/won-auction/{data.auction_id}?canceled=true",
            customer_email=user.get("email"),
            shipping_address_collection={
                "allowed_countries": ["DE", "AT", "CH"]
            } if not data.shipping_address else None,
            metadata={
                "type": "auction_win",
                "auction_id": data.auction_id,
                "user_id": user["id"],
                "payment_id": payment_id,
                "product_name": product_name
            }
        )
        
        # Update payment with session ID
        await db.auction_payments.update_one(
            {"id": payment_id},
            {"$set": {"stripe_session_id": session.id}}
        )
        
        logger.info(f"Won auction checkout created: {data.auction_id} for user {user['id']}, total €{total_amount:.2f}")
        
        return {
            "session_id": session.id,
            "url": session.url,
            "payment_id": payment_id,
            "final_price": final_price,
            "shipping_cost": shipping_cost,
            "total_amount": total_amount
        }
        
    except stripe.error.StripeError as e:
        logger.error(f"Stripe won auction checkout error: {e}")
        raise HTTPException(status_code=500, detail=f"Zahlungsfehler: {str(e)}")
    except Exception as e:
        logger.error(f"Won auction checkout error: {e}")
        raise HTTPException(status_code=500, detail=f"Fehler: {str(e)}")


@router.get("/won-auction/{auction_id}/status")
async def get_won_auction_payment_status(auction_id: str, session_id: str, user: dict = Depends(get_current_user)):
    """Check payment status for won auction and complete if paid"""
    if not STRIPE_API_KEY:
        raise HTTPException(status_code=503, detail="Zahlungsservice nicht verfügbar")
    
    try:
        # Get Stripe session
        session = stripe.checkout.Session.retrieve(session_id)
        
        if session.payment_status == "paid":
            # Find pending payment
            payment = await db.auction_payments.find_one({
                "auction_id": auction_id,
                "stripe_session_id": session_id,
                "status": "pending"
            })
            
            if payment:
                now = datetime.now(timezone.utc).isoformat()
                
                # Get shipping address from Stripe if collected
                shipping_address = None
                if session.shipping_details:
                    shipping_address = {
                        "name": session.shipping_details.name,
                        "street": session.shipping_details.address.line1,
                        "city": session.shipping_details.address.city,
                        "postal_code": session.shipping_details.address.postal_code,
                        "country": session.shipping_details.address.country
                    }
                
                # Mark payment as complete
                await db.auction_payments.update_one(
                    {"id": payment["id"]},
                    {"$set": {
                        "status": "paid",
                        "paid_at": now,
                        "stripe_payment_intent": session.payment_intent,
                        "shipping_address": shipping_address or payment.get("shipping_address")
                    }}
                )
                
                # Update auction status
                await db.auctions.update_one(
                    {"id": auction_id},
                    {"$set": {
                        "payment_status": "paid",
                        "paid_at": now
                    }}
                )
                
                # Create invoice record
                invoice_number = f"WIN-{auction_id[:8].upper()}"
                await db.invoices.insert_one({
                    "id": str(uuid.uuid4()),
                    "invoice_number": invoice_number,
                    "type": "auction_win",
                    "user_id": user["id"],
                    "auction_id": auction_id,
                    "payment_id": payment["id"],
                    "product_name": payment.get("product_name"),
                    "final_price": payment.get("final_price"),
                    "shipping_cost": payment.get("shipping_cost"),
                    "total_amount": payment.get("total_amount"),
                    "shipping_address": shipping_address or payment.get("shipping_address"),
                    "status": "paid",
                    "created_at": now
                })
                
                logger.info(f"Won auction payment completed: {auction_id}, total €{payment.get('total_amount'):.2f}")
        
        return {
            "status": session.status,
            "payment_status": session.payment_status,
            "auction_id": auction_id
        }
        
    except stripe.error.StripeError as e:
        logger.error(f"Stripe status check error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/won-auction/{auction_id}/payment")
async def get_won_auction_payment(auction_id: str, user: dict = Depends(get_current_user)):
    """Get payment info for a won auction"""
    # Get auction
    auction = await db.auctions.find_one({
        "id": auction_id,
        "winner_id": user["id"]
    }, {"_id": 0})
    
    if not auction:
        raise HTTPException(status_code=404, detail="Gewonnene Auktion nicht gefunden")
    
    # Get payment if exists
    payment = await db.auction_payments.find_one({
        "auction_id": auction_id,
        "user_id": user["id"]
    }, {"_id": 0})
    
    # Get product
    product = await db.products.find_one({"id": auction.get("product_id")}, {"_id": 0})
    
    final_price = auction.get("final_price") or auction.get("current_price", 0)
    shipping_cost = 4.99
    
    return {
        "auction_id": auction_id,
        "product_name": product.get("name") if product else "Produkt",
        "product_image": product.get("image_url") if product else None,
        "retail_price": product.get("retail_price", 0) if product else 0,
        "final_price": final_price,
        "shipping_cost": shipping_cost,
        "total_amount": final_price + shipping_cost,
        "payment_status": payment.get("status") if payment else "unpaid",
        "paid_at": payment.get("paid_at") if payment else None,
        "shipping_address": payment.get("shipping_address") if payment else None,
        "invoice_available": payment.get("status") == "paid" if payment else False
    }

