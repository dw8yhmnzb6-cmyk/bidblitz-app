"""Buy It Now Router - Allow users to buy products with bid credit after losing"""
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone, timedelta
from pydantic import BaseModel
from typing import Optional
import uuid
import stripe
import os

from config import db, logger
from dependencies import get_current_user

router = APIRouter(prefix="/buy-it-now", tags=["Buy It Now"])

stripe.api_key = os.environ.get("STRIPE_API_KEY")

# Configuration
BID_VALUE = 0.50  # Each bid is worth €0.50 as credit
MAX_CREDIT_PERCENT = 100  # Maximum % of price that can be covered by bid credit (100% = full price)
OFFER_VALID_HOURS = 48  # How long the offer is valid after losing

# ==================== SCHEMAS ====================

class BuyItNowRequest(BaseModel):
    auction_id: str
    use_bid_credit: bool = True

# ==================== ENDPOINTS ====================

@router.get("/offers")
async def get_buy_it_now_offers(user: dict = Depends(get_current_user)):
    """Get all available Buy It Now offers for the user"""
    user_id = user["id"]
    
    # Get auctions where user placed bids but didn't win (ended in last 48 hours)
    cutoff_time = (datetime.now(timezone.utc) - timedelta(hours=OFFER_VALID_HOURS)).isoformat()
    
    # Find all ended auctions where user participated
    user_bids = await db.bids.distinct("auction_id", {
        "user_id": user_id,
        "is_bot": {"$ne": True}
    })
    
    if not user_bids:
        return {"offers": [], "message": "Keine verfügbaren Angebote"}
    
    # Get ended auctions where user didn't win
    ended_auctions = await db.auctions.find({
        "id": {"$in": user_bids},
        "status": "ended",
        "winner_id": {"$ne": user_id},
        "ended_at": {"$gte": cutoff_time}
    }, {"_id": 0}).to_list(20)
    
    offers = []
    for auction in ended_auctions:
        # Count user's bids in this auction
        bid_count = await db.bids.count_documents({
            "auction_id": auction["id"],
            "user_id": user_id,
            "is_bot": {"$ne": True}
        })
        
        if bid_count == 0:
            continue
        
        # Calculate bid credit
        bid_credit = round(bid_count * BID_VALUE, 2)
        retail_price = auction.get("product_retail_price", 0)
        
        # Limit credit to max percent of retail price
        max_credit = retail_price * (MAX_CREDIT_PERCENT / 100)
        applied_credit = min(bid_credit, max_credit)
        
        final_price = max(0, retail_price - applied_credit)
        savings_percent = round((applied_credit / retail_price) * 100, 1) if retail_price > 0 else 0
        
        # Check if offer was already used
        existing_purchase = await db.buy_it_now_purchases.find_one({
            "user_id": user_id,
            "auction_id": auction["id"]
        })
        
        if existing_purchase:
            continue
        
        offers.append({
            "auction_id": auction["id"],
            "product_name": auction.get("product_name", "Produkt"),
            "product_image": auction.get("product_image"),
            "retail_price": retail_price,
            "bids_placed": bid_count,
            "bid_credit": bid_credit,
            "applied_credit": applied_credit,
            "final_price": round(final_price, 2),
            "savings_percent": savings_percent,
            "valid_until": (datetime.fromisoformat(auction.get("ended_at", datetime.now(timezone.utc).isoformat()).replace('Z', '+00:00')) + timedelta(hours=OFFER_VALID_HOURS)).isoformat()
        })
    
    return {
        "offers": offers,
        "bid_value": BID_VALUE,
        "message": f"Du hast {len(offers)} Buy It Now Angebot(e)!" if offers else "Keine Angebote verfügbar"
    }

@router.get("/offer/{auction_id}")
async def get_single_offer(auction_id: str, user: dict = Depends(get_current_user)):
    """Get Buy It Now offer for a specific auction"""
    user_id = user["id"]
    
    # Get auction
    auction = await db.auctions.find_one({"id": auction_id}, {"_id": 0})
    if not auction:
        raise HTTPException(status_code=404, detail="Auktion nicht gefunden")
    
    if auction.get("status") != "ended":
        raise HTTPException(status_code=400, detail="Auktion ist noch aktiv")
    
    if auction.get("winner_id") == user_id:
        raise HTTPException(status_code=400, detail="Du hast diese Auktion gewonnen!")
    
    # Count user's bids
    bid_count = await db.bids.count_documents({
        "auction_id": auction_id,
        "user_id": user_id,
        "is_bot": {"$ne": True}
    })
    
    if bid_count == 0:
        raise HTTPException(status_code=400, detail="Du hast nicht an dieser Auktion teilgenommen")
    
    # Calculate credit
    bid_credit = round(bid_count * BID_VALUE, 2)
    retail_price = auction.get("product_retail_price", 0)
    
    max_credit = retail_price * (MAX_CREDIT_PERCENT / 100)
    applied_credit = min(bid_credit, max_credit)
    final_price = max(0, retail_price - applied_credit)
    
    return {
        "offer": {
            "auction_id": auction_id,
            "product_name": auction.get("product_name"),
            "product_image": auction.get("product_image"),
            "retail_price": retail_price,
            "bids_placed": bid_count,
            "bid_credit": bid_credit,
            "applied_credit": applied_credit,
            "final_price": round(final_price, 2),
            "savings_percent": round((applied_credit / retail_price) * 100, 1) if retail_price > 0 else 0
        }
    }

@router.post("/purchase")
async def purchase_buy_it_now(data: BuyItNowRequest, user: dict = Depends(get_current_user)):
    """Purchase a product using Buy It Now"""
    user_id = user["id"]
    
    # Get auction
    auction = await db.auctions.find_one({"id": data.auction_id}, {"_id": 0})
    if not auction:
        raise HTTPException(status_code=404, detail="Auktion nicht gefunden")
    
    if auction.get("status") != "ended":
        raise HTTPException(status_code=400, detail="Auktion ist noch aktiv")
    
    # Check if already purchased
    existing = await db.buy_it_now_purchases.find_one({
        "user_id": user_id,
        "auction_id": data.auction_id
    })
    if existing:
        raise HTTPException(status_code=400, detail="Du hast dieses Produkt bereits gekauft")
    
    # Calculate final price
    retail_price = auction.get("product_retail_price", 0)
    
    if data.use_bid_credit:
        bid_count = await db.bids.count_documents({
            "auction_id": data.auction_id,
            "user_id": user_id,
            "is_bot": {"$ne": True}
        })
        bid_credit = round(bid_count * BID_VALUE, 2)
        max_credit = retail_price * (MAX_CREDIT_PERCENT / 100)
        applied_credit = min(bid_credit, max_credit)
        final_price = max(0, retail_price - applied_credit)
    else:
        bid_count = 0
        applied_credit = 0
        final_price = retail_price
    
    # Create Stripe checkout session
    try:
        user_data = await db.users.find_one({"id": user_id})
        
        session = stripe.checkout.Session.create(
            payment_method_types=['card'],
            line_items=[{
                'price_data': {
                    'currency': 'eur',
                    'product_data': {
                        'name': f"Buy It Now: {auction.get('product_name', 'Produkt')}",
                        'description': f"Mit €{applied_credit:.2f} Gebot-Guthaben Rabatt",
                    },
                    'unit_amount': int(final_price * 100),
                },
                'quantity': 1,
            }],
            mode='payment',
            success_url=f"{os.environ.get('FRONTEND_URL', 'https://bidblitz.de')}/buy-it-now/success?session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url=f"{os.environ.get('FRONTEND_URL', 'https://bidblitz.de')}/buy-it-now/offers",
            customer_email=user_data.get("email") if user_data else None,
            metadata={
                'user_id': user_id,
                'auction_id': data.auction_id,
                'type': 'buy_it_now',
                'bid_credit_applied': str(applied_credit)
            }
        )
        
        # Store pending purchase
        purchase = {
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "auction_id": data.auction_id,
            "product_name": auction.get("product_name"),
            "retail_price": retail_price,
            "bid_credit_applied": applied_credit,
            "final_price": final_price,
            "bids_used": bid_count,
            "stripe_session_id": session.id,
            "status": "pending",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.buy_it_now_purchases.insert_one(purchase)
        
        logger.info(f"Buy It Now checkout: {user_data.get('username') if user_data else user_id} - {auction.get('product_name')} - €{final_price}")
        
        return {
            "success": True,
            "checkout_url": session.url,
            "session_id": session.id,
            "final_price": final_price,
            "bid_credit_applied": applied_credit
        }
        
    except Exception as e:
        logger.error(f"Buy It Now Stripe error: {e}")
        raise HTTPException(status_code=500, detail=f"Zahlungsfehler: {str(e)}")

@router.get("/purchases")
async def get_my_purchases(user: dict = Depends(get_current_user)):
    """Get user's Buy It Now purchase history"""
    purchases = await db.buy_it_now_purchases.find(
        {"user_id": user["id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    
    return {"purchases": purchases}


buy_it_now_router = router
