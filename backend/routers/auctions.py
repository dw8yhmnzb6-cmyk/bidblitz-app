"""Auctions router - All auction-related endpoints"""
from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from datetime import datetime, timezone, timedelta
from typing import List, Optional
import uuid
import random
import os
import asyncio

from config import db, logger
from dependencies import get_current_user, get_admin_user
from schemas import AuctionCreate, AuctionUpdate, AutobidderCreate
from services.websocket import broadcast_bid_update, broadcast_auction_ended

router = APIRouter(tags=["Auctions"])

# ==================== AUTOBIDDER HELPER FUNCTIONS ====================

async def process_autobid(user_id: str, auction_id: str, current_price: float) -> bool:
    """
    Process autobid for a user who was outbid.
    Returns True if autobid was placed, False otherwise.
    """
    # Get user's autobidder for this auction
    autobidder = await db.autobidders.find_one({
        "user_id": user_id,
        "auction_id": auction_id,
        "is_active": True
    })
    
    if not autobidder:
        return False
    
    # Check if autobidder is paused
    if autobidder.get("is_paused", False):
        return False
    
    # Check if max bids reached
    bids_placed = autobidder.get("bids_placed", 0)
    max_bids = autobidder.get("max_bids", 0)
    
    if bids_placed >= max_bids:
        logger.info(f"Autobidder for {user_id}: Max bids ({max_bids}) reached")
        return False
    
    # Check if max price exceeded
    max_price = autobidder.get("max_price")
    bid_increment = 0.01  # Default increment
    
    auction = await db.auctions.find_one({"id": auction_id}, {"_id": 0})
    if auction:
        bid_increment = auction.get("bid_increment", 0.01)
    
    next_price = current_price + bid_increment
    
    if max_price and next_price > max_price:
        logger.info(f"Autobidder for {user_id}: Max price €{max_price} would be exceeded (€{next_price})")
        return False
    
    # Get user and check bids balance
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user or user.get("bids_balance", 0) < 1:
        logger.info(f"Autobidder for {user_id}: No bids left")
        return False
    
    # Small delay to make it look natural (0.5-2 seconds)
    bid_delay = autobidder.get("bid_in_last_seconds", 5)
    await asyncio.sleep(min(random.uniform(0.5, 2.0), bid_delay))
    
    # Place the autobid
    try:
        # Deduct bid
        await db.users.update_one(
            {"id": user_id},
            {"$inc": {"bids_balance": -1}}
        )
        
        # Update auction
        new_price = current_price + bid_increment
        timer_extension = 10  # seconds
        new_end_time = datetime.now(timezone.utc) + timedelta(seconds=timer_extension)
        
        await db.auctions.update_one(
            {"id": auction_id},
            {
                "$set": {
                    "current_price": new_price,
                    "end_time": new_end_time.isoformat(),
                    "last_bidder_id": user_id,
                    "last_bidder_name": user.get("name", "Autobidder")
                },
                "$inc": {"total_bids": 1},
                "$push": {
                    "bid_history": {
                        "user_id": user_id,
                        "user_name": user.get("name", "Autobidder"),
                        "price": new_price,
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                        "is_autobid": True
                    }
                }
            }
        )
        
        # Update autobidder stats
        await db.autobidders.update_one(
            {"id": autobidder["id"]},
            {"$inc": {"bids_placed": 1}}
        )
        
        # Broadcast via WebSocket
        try:
            await broadcast_bid_update(auction_id, {
                "current_price": new_price,
                "end_time": new_end_time.isoformat(),
                "last_bidder_name": user.get("name", "Autobidder"),
                "bidder_message": f"🤖 {user.get('name', 'Autobidder')} (Auto)"
            })
        except:
            pass
        
        logger.info(f"🤖 Autobid placed: User {user_id} -> €{new_price} (bid {bids_placed + 1}/{max_bids})")
        return True
        
    except Exception as e:
        logger.error(f"Autobid error: {e}")
        return False


async def send_outbid_email(user_id: str, auction_id: str, current_price: float, outbidder_name: str):
    """Send email notification when user is outbid"""
    try:
        import httpx
        
        RESEND_API_KEY = os.environ.get("RESEND_API_KEY")
        SENDER_EMAIL = os.environ.get("SENDER_EMAIL", "noreply@bidblitz.de")
        
        if not RESEND_API_KEY:
            return
        
        # Get user email
        user = await db.users.find_one({"id": user_id}, {"_id": 0, "email": 1, "name": 1})
        if not user or not user.get("email"):
            return
        
        # Get auction and product info
        auction = await db.auctions.find_one({"id": auction_id}, {"_id": 0})
        if not auction:
            return
        
        product = await db.products.find_one({"id": auction.get("product_id")}, {"_id": 0})
        product_name = product.get("name", "Auktion") if product else "Auktion"
        product_image = product.get("image_url", "") if product else ""
        
        # Check user email preferences (skip if disabled)
        prefs = await db.user_preferences.find_one({"user_id": user_id})
        if prefs and not prefs.get("email_outbid", True):
            return
        
        # Build email HTML
        email_html = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <style>
                body {{ font-family: Arial, sans-serif; background: #0A0A0F; color: white; padding: 20px; }}
                .container {{ max-width: 600px; margin: 0 auto; background: #1A1A2E; border-radius: 16px; padding: 30px; }}
                .header {{ text-align: center; margin-bottom: 20px; }}
                .logo {{ color: #7C3AED; font-size: 28px; font-weight: bold; }}
                .alert {{ background: linear-gradient(135deg, #EF4444, #F97316); padding: 15px; border-radius: 12px; text-align: center; margin-bottom: 20px; }}
                .alert h2 {{ margin: 0; color: white; }}
                .product {{ display: flex; align-items: center; gap: 15px; background: #252540; padding: 15px; border-radius: 12px; margin-bottom: 20px; }}
                .product img {{ width: 80px; height: 80px; object-fit: contain; border-radius: 8px; background: white; }}
                .product-info h3 {{ margin: 0 0 5px 0; color: white; }}
                .price {{ color: #10B981; font-size: 24px; font-weight: bold; }}
                .btn {{ display: inline-block; background: linear-gradient(135deg, #7C3AED, #EC4899); color: white; padding: 15px 30px; border-radius: 25px; text-decoration: none; font-weight: bold; }}
                .btn:hover {{ opacity: 0.9; }}
                .footer {{ text-align: center; color: #666; font-size: 12px; margin-top: 20px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <div class="logo">BidBlitz</div>
                </div>
                <div class="alert">
                    <h2>⚡ Du wurdest überboten!</h2>
                </div>
                <p>Hallo {user.get('name', 'Bieter')},</p>
                <p><strong>{outbidder_name}</strong> hat dich bei folgender Auktion überboten:</p>
                <div class="product">
                    <img src="{product_image}" alt="{product_name}">
                    <div class="product-info">
                        <h3>{product_name}</h3>
                        <div class="price">€{current_price:.2f}</div>
                    </div>
                </div>
                <p style="text-align: center;">
                    <a href="https://bidblitz.de/auctions/{auction_id}" class="btn">🔥 Jetzt zurückbieten!</a>
                </p>
                <p style="color: #94A3B8; font-size: 14px;">
                    💡 <strong>Tipp:</strong> Aktiviere den Autobidder und wir bieten automatisch für dich!
                </p>
                <div class="footer">
                    <p>BidBlitz - Deutschlands beste Penny-Auktionen</p>
                    <p><a href="https://bidblitz.de/profile" style="color: #666;">E-Mail Einstellungen ändern</a></p>
                </div>
            </div>
        </body>
        </html>
        """
        
        # Send via Resend API
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.resend.com/emails",
                headers={
                    "Authorization": f"Bearer {RESEND_API_KEY}",
                    "Content-Type": "application/json"
                },
                json={
                    "from": SENDER_EMAIL,
                    "to": user["email"],
                    "subject": f"⚡ Überboten: {product_name} - Jetzt zurückbieten!",
                    "html": email_html
                },
                timeout=10.0
            )
            
            if response.status_code in [200, 201]:
                logger.info(f"📧 Outbid email sent to {user['email']}")
            else:
                logger.error(f"Resend error: {response.status_code} - {response.text}")
                
    except Exception as e:
        logger.error(f"Error sending outbid email: {e}")

# Business hours configuration (Berlin timezone = UTC+1 in winter, UTC+2 in summer)
BUSINESS_START_HOUR = 0   # 0:00 - Always open for development
BUSINESS_END_HOUR = 24    # Midnight (24:00)

def is_within_business_hours():
    """Check if current time is within business hours (9:00 - 24:00 Berlin time)"""
    now = datetime.now(timezone.utc)
    # Approximate Berlin time (UTC+1)
    berlin_hour = (now.hour + 1) % 24
    return BUSINESS_START_HOUR <= berlin_hour < BUSINESS_END_HOUR

def get_next_business_opening():
    """Get the next time auctions will open (9:00 Berlin time)"""
    now = datetime.now(timezone.utc)
    berlin_hour = (now.hour + 1) % 24
    
    if berlin_hour >= BUSINESS_END_HOUR or berlin_hour < BUSINESS_START_HOUR:
        # Outside business hours - calculate next 9:00 AM
        hours_until_opening = (BUSINESS_START_HOUR - berlin_hour) % 24
        if hours_until_opening == 0:
            hours_until_opening = 24
        next_opening = now + timedelta(hours=hours_until_opening)
        return next_opening.replace(minute=0, second=0, microsecond=0)
    return None

# ==================== PUBLIC ENDPOINTS ====================

@router.get("/auctions/business-hours")
async def get_business_hours():
    """Get business hours status"""
    is_open = is_within_business_hours()
    next_opening = get_next_business_opening() if not is_open else None
    
    return {
        "is_open": is_open,
        "business_start": f"{BUSINESS_START_HOUR:02d}:00",
        "business_end": f"{BUSINESS_END_HOUR:02d}:00",
        "next_opening": next_opening.isoformat() if next_opening else None,
        "timezone": "Europe/Berlin"
    }

@router.get("/auctions/featured")
async def get_featured_auction():
    """Get the featured/VIP auction to display prominently"""
    # First try to find a VIP-marked auction
    featured = await db.auctions.find_one(
        {"status": "active", "is_featured": True},
        {"_id": 0}
    )
    
    # If no featured auction, get the auction with highest retail price that's active
    if not featured:
        auctions = await db.auctions.find(
            {"status": "active"},
            {"_id": 0}
        ).to_list(100)
        
        if auctions:
            # Find auction with highest value product
            best = None
            best_value = 0
            
            for auction in auctions:
                product = await db.products.find_one({"id": auction.get("product_id")}, {"_id": 0})
                if product:
                    value = product.get("retail_price", 0)
                    if value > best_value:
                        best_value = value
                        best = auction
                        best["product"] = product
            
            featured = best
    
    if featured and "product" not in featured:
        product = await db.products.find_one({"id": featured.get("product_id")}, {"_id": 0})
        if product:
            featured["product"] = product
    
    return featured

@router.get("/auctions")
async def get_auctions():
    """Get all auctions with product details"""
    # Include active, day_paused, and night_paused auctions
    auctions = await db.auctions.find(
        {"status": {"$in": ["active", "day_paused", "night_paused", "ended", "scheduled"]}},
        {"_id": 0}
    ).sort("created_at", -1).to_list(500)
    
    # Check if currently night time (Berlin Time)
    now_berlin = datetime.now(timezone.utc) + timedelta(hours=1)
    current_hour = now_berlin.hour + now_berlin.minute / 60
    is_night_time = current_hour >= 23.5 or current_hour < 6
    
    # Attach product info and pause status
    for auction in auctions:
        product = await db.products.find_one({"id": auction.get("product_id")}, {"_id": 0})
        if product:
            auction["product"] = product
        
        # Mark paused auctions with appropriate message
        if auction.get("status") == "day_paused":
            auction["is_paused"] = True
            auction["pause_message"] = "☀️ Aktiv ab 06:00 Uhr"
            auction["pause_type"] = "night_only"
        elif auction.get("status") == "night_paused":
            auction["is_paused"] = True
            auction["pause_message"] = "🌙 Aktiv ab 23:30 Uhr"
            auction["pause_type"] = "day_only"
        elif auction.get("is_night_auction") and not is_night_time:
            # Legacy support for auctions marked as night but not properly paused
            auction["is_night_paused"] = True
            auction["night_message"] = "🌙 Nur 23:30-06:00 Uhr"
    
    return auctions

@router.get("/auctions/vip-only")
async def get_vip_only_auctions():
    """Get VIP-only auctions"""
    auctions = await db.auctions.find(
        {"status": "active", "is_vip_only": True},
        {"_id": 0}
    ).sort("end_time", 1).to_list(100)
    
    for auction in auctions:
        product = await db.products.find_one({"id": auction.get("product_id")}, {"_id": 0})
        if product:
            auction["product"] = product
    
    return auctions

@router.get("/auctions/active")
async def get_active_auctions():
    """Get only active auctions"""
    now = datetime.now(timezone.utc).isoformat()
    auctions = await db.auctions.find(
        {"status": "active"},
        {"_id": 0}
    ).sort("end_time", 1).to_list(100)
    
    for auction in auctions:
        product = await db.products.find_one({"id": auction.get("product_id")}, {"_id": 0})
        if product:
            auction["product"] = product
    
    return auctions

@router.get("/auctions/{auction_id}")
async def get_auction(auction_id: str):
    """Get single auction by ID with product details"""
    auction = await db.auctions.find_one({"id": auction_id}, {"_id": 0})
    if not auction:
        raise HTTPException(status_code=404, detail="Auction not found")
    
    product = await db.products.find_one({"id": auction.get("product_id")}, {"_id": 0})
    if product:
        auction["product"] = product
    
    return auction

# ==================== BIDDING ====================

@router.post("/auctions/{auction_id}/bid")
async def place_bid(auction_id: str, user: dict = Depends(get_current_user)):
    """Place a bid on an auction"""
    
    # CHECK BUSINESS HOURS - No bidding outside 9:00-24:00 Berlin time
    if not is_within_business_hours():
        next_opening = get_next_business_opening()
        raise HTTPException(
            status_code=403, 
            detail=f"Auktionen sind pausiert. Öffnungszeiten: 09:00 - 24:00 Uhr. Nächste Öffnung: {next_opening.strftime('%d.%m.%Y %H:%M') if next_opening else '09:00'} Uhr"
        )
    
    auction = await db.auctions.find_one({"id": auction_id}, {"_id": 0})
    if not auction:
        raise HTTPException(status_code=404, detail="Auktion nicht gefunden")
    
    if auction["status"] != "active":
        raise HTTPException(status_code=400, detail="Auktion ist nicht mehr aktiv")
    
    # Check VIP-ONLY AUCTION restriction
    if auction.get("is_vip_only"):
        # Check user's VIP status
        vip_sub = await db.vip_subscriptions.find_one({"user_id": user["id"]}, {"_id": 0})
        is_user_vip = False
        if vip_sub:
            expiry = datetime.fromisoformat(vip_sub.get("next_renewal", "2000-01-01").replace('Z', '+00:00'))
            is_user_vip = vip_sub.get("status") == "active" and expiry > datetime.now(timezone.utc)
        
        if not is_user_vip:
            raise HTTPException(
                status_code=403, 
                detail="Diese Auktion ist nur für VIP-Mitglieder. Werden Sie jetzt VIP, um mitzubieten!"
            )
    
    # Check if auction has ended
    end_time = datetime.fromisoformat(auction["end_time"].replace('Z', '+00:00'))
    if datetime.now(timezone.utc) > end_time:
        raise HTTPException(status_code=400, detail="Auction has ended")
    
    # Check BEGINNER AUCTION restriction
    if auction.get("is_beginner_only"):
        won_auctions = user.get("won_auctions", [])
        if len(won_auctions) >= 10:
            raise HTTPException(
                status_code=403, 
                detail="Diese Auktion ist nur für Anfänger (max. 10 gewonnene Auktionen). Sie haben bereits zu viele Auktionen gewonnen."
            )
    
    # FREE AUCTION - no bid deduction required
    is_free_auction = auction.get("is_free_auction", False)
    is_night_auction = auction.get("is_night_auction", False)
    
    # Check if currently night time (23:30 - 06:00) for half-price bids
    now_berlin = datetime.now(timezone.utc) + timedelta(hours=1)  # Berlin is UTC+1
    current_hour = now_berlin.hour + now_berlin.minute / 60  # e.g., 23:30 = 23.5
    is_night_time = current_hour >= 23.5 or current_hour < 6
    
    # Night auctions can ONLY be bid on during night hours (23:30 - 06:00)
    if is_night_auction and not is_night_time:
        raise HTTPException(
            status_code=403, 
            detail="🌙 Diese Nachtauktion ist nur zwischen 23:30 und 06:00 Uhr verfügbar. Bitte kommen Sie heute Nacht wieder!"
        )
    
    # Night auctions have half bid cost during night hours
    bid_cost = 1
    if is_night_auction and is_night_time:
        bid_cost = 0.5  # Half price during night hours
    
    if not is_free_auction:
        # Check user's bid balance for regular auctions
        if user["bids_balance"] < bid_cost:
            raise HTTPException(status_code=400, detail="Nicht genügend Gebote. Bitte kaufen Sie mehr Gebote.")
        
        # Deduct bid from user (half for night auctions during night time)
        await db.users.update_one(
            {"id": user["id"]},
            {"$inc": {"bids_balance": -bid_cost, "total_bids_placed": 1}}
        )
    else:
        # Free auction - just track participation
        await db.users.update_one(
            {"id": user["id"]},
            {"$inc": {"total_bids_placed": 1, "free_bids_placed": 1}}
        )
    
    # Check if user is a guaranteed winner
    is_guaranteed_winner = user.get("is_guaranteed_winner", False)
    
    # Update auction - extend timer to 9-11 seconds on last-second bids
    new_price = round(auction["current_price"] + auction.get("bid_increment", 0.01), 2)
    current_end_time = datetime.fromisoformat(auction["end_time"].replace('Z', '+00:00'))
    now = datetime.now(timezone.utc)
    
    # Reset timer to 10-15 seconds when remaining time is low
    time_remaining = (current_end_time - now).total_seconds()
    timer_extension = random.randint(10, 15)
    
    # GUARANTEED WINNER: Set timer to only 3 seconds so they win quickly
    if is_guaranteed_winner:
        timer_extension = 3
        logger.info(f"🏆 Guaranteed winner bid: {user['name']} on auction {auction_id[:8]}...")
    
    if time_remaining < 15:
        # Last-second bid: reset timer to 10-15 seconds (or 3 for guaranteed winner)
        new_end_time = now + timedelta(seconds=timer_extension)
    elif time_remaining < 60:
        # Under 1 minute: add time
        new_end_time = now + timedelta(seconds=timer_extension)
    else:
        new_end_time = current_end_time
    
    # Mark auction to block bots if guaranteed winner is bidding
    update_data = {
        "$set": {
            "current_price": new_price,
            "end_time": new_end_time.isoformat(),
            "last_bidder_id": user["id"],
            "last_bidder_name": user["name"]
        },
        "$inc": {"total_bids": 1},
        "$push": {
            "bid_history": {
                "user_id": user["id"],
                "user_name": user["name"],
                "price": new_price,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "is_autobid": False
            }
        }
    }
    
    # If guaranteed winner, mark auction to block bot bids
    if is_guaranteed_winner:
        update_data["$set"]["guaranteed_winner_bidding"] = user["id"]
    
    await db.auctions.update_one({"id": auction_id}, update_data)
    
    # Broadcast bid update via WebSocket
    try:
        await broadcast_bid_update(auction_id, {
            "current_price": new_price,
            "end_time": new_end_time.isoformat(),
            "last_bidder_name": user["name"],
            "total_bids": auction.get("total_bids", 0) + 1,
            "bidder_message": f"{user['name']} hat geboten!"
        })
    except Exception as e:
        logger.error(f"WebSocket broadcast error: {e}")
    
    # Send OUTBID notification to previous bidder (if different user)
    previous_bidder_id = auction.get("last_bidder_id")
    if previous_bidder_id and previous_bidder_id != user["id"]:
        try:
            # Get product info for notification
            product = await db.products.find_one({"id": auction.get("product_id")}, {"_id": 0})
            product_name = product.get("name", "Auktion") if product else "Auktion"
            
            # Import notification functions
            from routers.notifications import send_push_to_user, create_notification
            
            # Send push notification
            await send_push_to_user(
                previous_bidder_id,
                f"⚡ Überboten: {product_name}",
                f"Sie wurden überboten! Neuer Preis: €{new_price:.2f}. Jetzt bieten um zu gewinnen!",
                {"url": f"/auctions/{auction_id}", "auction_id": auction_id, "type": "outbid"}
            )
            
            # Create in-app notification
            await create_notification(
                previous_bidder_id,
                f"⚡ Überboten: {product_name}",
                f"Sie wurden von {user['name']} überboten! Aktueller Preis: €{new_price:.2f}",
                "auction",
                f"/auctions/{auction_id}"
            )
            
            logger.info(f"Outbid notification sent to {previous_bidder_id}")
        except Exception as e:
            logger.error(f"Error sending outbid notification: {e}")
        
        # Send EMAIL notification when outbid
        try:
            await send_outbid_email(previous_bidder_id, auction_id, new_price, user["name"])
        except Exception as e:
            logger.error(f"Error sending outbid email: {e}")
        
        # Send TELEGRAM notification when outbid
        try:
            from routers.telegram import send_auction_alert
            product = await db.products.find_one({"id": auction.get("product_id")}, {"_id": 0})
            await send_auction_alert(previous_bidder_id, "outbid", {
                "product_name": product.get("name", "Auktion") if product else "Auktion",
                "current_price": new_price,
                "new_bidder": user["name"],
                "url": f"https://bidblitz.de/auctions/{auction_id}"
            })
        except Exception as e:
            logger.error(f"Error sending Telegram outbid alert: {e}")
        
        # Check if previous bidder has AUTOBIDDER active
        try:
            autobid_result = await process_autobid(previous_bidder_id, auction_id, new_price)
            if autobid_result:
                logger.info(f"🤖 Autobidder triggered for user {previous_bidder_id}")
        except Exception as e:
            logger.error(f"Error processing autobid: {e}")
    
    # Check for STREAK BONUS
    streak_reward = None
    try:
        from routers.gamification import check_and_award_streak
        streak_reward = await check_and_award_streak(user["id"], auction_id)
        if streak_reward:
            logger.info(f"🔥 Streak bonus awarded: {streak_reward}")
    except Exception as e:
        logger.error(f"Error checking streak: {e}")
    
    # Award XP for bidding
    try:
        from routers.levels import award_xp
        await award_xp(user["id"], "place_bid", description="Gebot platziert")
    except Exception as e:
        logger.error(f"Error awarding XP: {e}")
    
    # Award Loyalty Points for bidding
    try:
        from routers.loyalty import award_bid_points
        await award_bid_points(user["id"], 1)
    except Exception as e:
        logger.error(f"Error awarding loyalty points: {e}")
    
    response = {
        "message": "Bid placed successfully",
        "new_price": new_price,
        "new_end_time": new_end_time.isoformat(),
        "bids_remaining": user["bids_balance"] - 1
    }
    
    if streak_reward:
        response["streak_reward"] = streak_reward
    
    return response

# ==================== AUCTION WISHLIST ====================

@router.post("/auction-wishlist/{auction_id}")
async def add_to_wishlist(auction_id: str, user: dict = Depends(get_current_user)):
    """Add auction to user's wishlist"""
    auction = await db.auctions.find_one({"id": auction_id}, {"_id": 0})
    if not auction:
        raise HTTPException(status_code=404, detail="Auction not found")
    
    # Check if already in wishlist
    existing = await db.wishlist.find_one({
        "user_id": user["id"],
        "auction_id": auction_id
    })
    
    if existing:
        raise HTTPException(status_code=400, detail="Already in wishlist")
    
    # Add to wishlist
    wishlist_item = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "auction_id": auction_id,
        "product_id": auction.get("product_id"),
        "added_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.wishlist.insert_one(wishlist_item)
    
    return {"message": "Added to wishlist", "id": wishlist_item["id"]}


@router.delete("/auction-wishlist/{auction_id}")
async def remove_from_wishlist(auction_id: str, user: dict = Depends(get_current_user)):
    """Remove auction from user's wishlist"""
    result = await db.wishlist.delete_one({
        "user_id": user["id"],
        "auction_id": auction_id
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Not in wishlist")
    
    return {"message": "Removed from wishlist"}


@router.get("/wishlist")
async def get_wishlist(user: dict = Depends(get_current_user)):
    """Get user's wishlist with auction details"""
    wishlist = await db.wishlist.find(
        {"user_id": user["id"]},
        {"_id": 0}
    ).sort("added_at", -1).to_list(100)
    
    # Enrich with auction and product info
    for item in wishlist:
        auction = await db.auctions.find_one({"id": item["auction_id"]}, {"_id": 0})
        if auction:
            product = await db.products.find_one({"id": auction.get("product_id")}, {"_id": 0})
            item["auction"] = auction
            item["product"] = product
    
    return {"wishlist": wishlist, "count": len(wishlist)}


@router.get("/wishlist/check/{auction_id}")
async def check_wishlist(auction_id: str, user: dict = Depends(get_current_user)):
    """Check if auction is in user's wishlist"""
    item = await db.wishlist.find_one({
        "user_id": user["id"],
        "auction_id": auction_id
    })
    
    return {"in_wishlist": item is not None}


# ==================== AUCTION OF THE DAY ====================

@router.get("/auction-of-the-day")
async def get_auction_of_the_day():
    """Get the featured 'Auction of the Day'"""
    now = datetime.now(timezone.utc)
    
    # First check if there's a manually set AOTD
    today = now.strftime("%Y-%m-%d")
    aotd = await db.auction_of_the_day.find_one({"date": today}, {"_id": 0})
    
    if aotd:
        auction = await db.auctions.find_one({"id": aotd["auction_id"]}, {"_id": 0})
        if auction and auction.get("status") == "active":
            # Check if auction's end_time is still in the future
            end_time_str = auction.get("end_time", "")
            try:
                end_time = datetime.fromisoformat(end_time_str.replace("Z", "+00:00"))
                if end_time > now:
                    product = await db.products.find_one({"id": auction.get("product_id")}, {"_id": 0})
                    auction["product"] = product
                    auction["is_aotd"] = True
                    # Normalize last_bidder field name
                    if auction.get("last_bidder") and not auction.get("last_bidder_name"):
                        auction["last_bidder_name"] = auction["last_bidder"]
                    return auction
            except:
                pass
    
    # Otherwise, automatically select the highest-value active auction with valid time
    active_auctions = await db.auctions.find(
        {"status": "active"},
        {"_id": 0}
    ).to_list(100)
    
    if not active_auctions:
        return None
    
    # Get product values and find highest (only consider auctions with time left)
    best_auction = None
    highest_value = 0
    
    for auction in active_auctions:
        # Skip auctions that have expired
        end_time_str = auction.get("end_time", "")
        try:
            end_time = datetime.fromisoformat(end_time_str.replace("Z", "+00:00"))
            if end_time <= now:
                continue  # Skip expired auctions
        except:
            continue
        
        product = await db.products.find_one({"id": auction.get("product_id")}, {"_id": 0})
        if product:
            value = product.get("retail_price", 0)
            if value > highest_value:
                highest_value = value
                best_auction = auction
                best_auction["product"] = product
    
    if best_auction:
        best_auction["is_aotd"] = True
        best_auction["auto_selected"] = True
        # Normalize last_bidder field name
        if best_auction.get("last_bidder") and not best_auction.get("last_bidder_name"):
            best_auction["last_bidder_name"] = best_auction["last_bidder"]
    
    return best_auction


@router.post("/admin/auction-of-the-day/{auction_id}")
async def set_auction_of_the_day(auction_id: str, admin: dict = Depends(get_admin_user)):
    """Set the Auction of the Day (Admin only)"""
    auction = await db.auctions.find_one({"id": auction_id}, {"_id": 0})
    if not auction:
        raise HTTPException(status_code=404, detail="Auction not found")
    
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    await db.auction_of_the_day.update_one(
        {"date": today},
        {
            "$set": {
                "date": today,
                "auction_id": auction_id,
                "set_at": datetime.now(timezone.utc).isoformat(),
                "set_by": admin["id"]
            }
        },
        upsert=True
    )
    
    return {"message": "Auction of the Day set", "date": today, "auction_id": auction_id}


# ==================== AUTOBIDDER ====================

@router.post("/autobidder")
async def create_autobidder(config: AutobidderCreate, user: dict = Depends(get_current_user)):
    """Create or update autobidder for an auction"""
    auction = await db.auctions.find_one({"id": config.auction_id}, {"_id": 0})
    if not auction:
        raise HTTPException(status_code=404, detail="Auction not found")
    
    if auction["status"] != "active":
        raise HTTPException(status_code=400, detail="Auction is not active")
    
    if user["bids_balance"] < config.max_bids:
        raise HTTPException(status_code=400, detail=f"Not enough bids. You have {user['bids_balance']}, need {config.max_bids}")
    
    # Check for existing autobidder
    existing = await db.autobidders.find_one({
        "user_id": user["id"],
        "auction_id": config.auction_id,
        "is_active": True
    })
    
    if existing:
        # Update existing
        await db.autobidders.update_one(
            {"id": existing["id"]},
            {"$set": {
                "max_bids": config.max_bids,
                "max_price": config.max_price,
                "bid_in_last_seconds": config.bid_in_last_seconds
            }}
        )
        return {"message": "Autobidder updated", "id": existing["id"]}
    
    # Create new autobidder
    autobidder = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "user_name": user["name"],
        "auction_id": config.auction_id,
        "max_bids": config.max_bids,
        "max_price": config.max_price,
        "bid_in_last_seconds": config.bid_in_last_seconds,
        "bids_placed": 0,
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.autobidders.insert_one(autobidder)
    return {"message": "Autobidder created", "id": autobidder["id"]}

@router.get("/autobidder/{auction_id}")
async def get_autobidder(auction_id: str, user: dict = Depends(get_current_user)):
    """Get user's autobidder for an auction"""
    autobidder = await db.autobidders.find_one({
        "user_id": user["id"],
        "auction_id": auction_id,
        "is_active": True
    }, {"_id": 0})
    
    return autobidder

@router.delete("/autobidder/{auction_id}")
async def delete_autobidder(auction_id: str, user: dict = Depends(get_current_user)):
    """Deactivate autobidder for an auction"""
    result = await db.autobidders.update_one(
        {"user_id": user["id"], "auction_id": auction_id, "is_active": True},
        {"$set": {"is_active": False}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="No active autobidder found")
    
    return {"message": "Autobidder deactivated"}

@router.get("/autobidders/all")
async def get_all_user_autobidders(user: dict = Depends(get_current_user)):
    """Get all autobidders for a user"""
    autobidders = await db.autobidders.find(
        {"user_id": user["id"], "is_active": True},
        {"_id": 0}
    ).to_list(100)
    
    # Enrich with auction info
    for ab in autobidders:
        auction = await db.auctions.find_one({"id": ab["auction_id"]}, {"_id": 0})
        if auction:
            product = await db.products.find_one({"id": auction.get("product_id")}, {"_id": 0})
            ab["auction"] = {
                "id": auction["id"],
                "current_price": auction.get("current_price"),
                "status": auction.get("status"),
                "end_time": auction.get("end_time"),
                "product_name": product.get("name") if product else "Unknown",
                "product_image": product.get("image_url") if product else ""
            }
    
    return autobidders

@router.get("/autobidder/my")
async def get_my_autobidders(user: dict = Depends(get_current_user)):
    """Get all autobidders for the current user (alias for frontend)"""
    autobidders = await db.autobidders.find(
        {"user_id": user["id"]},
        {"_id": 0}
    ).to_list(100)
    
    # Enrich with auction info
    for ab in autobidders:
        auction = await db.auctions.find_one({"id": ab["auction_id"]}, {"_id": 0})
        if auction:
            product = await db.products.find_one({"id": auction.get("product_id")}, {"_id": 0})
            ab["auction"] = {
                "id": auction["id"],
                "current_price": auction.get("current_price"),
                "status": auction.get("status"),
                "end_time": auction.get("end_time"),
                "product_name": product.get("name") if product else "Unknown",
                "product_image": product.get("image_url") if product else ""
            }
    
    return autobidders if autobidders else []

@router.put("/autobidder/{auction_id}/settings")
async def update_autobidder_settings(
    auction_id: str, 
    max_bids: Optional[int] = None,
    max_price: Optional[float] = None,
    bid_in_last_seconds: Optional[int] = None,
    pause: Optional[bool] = None,
    user: dict = Depends(get_current_user)
):
    """Update autobidder settings"""
    autobidder = await db.autobidders.find_one({
        "user_id": user["id"],
        "auction_id": auction_id,
        "is_active": True
    })
    
    if not autobidder:
        raise HTTPException(status_code=404, detail="Autobidder nicht gefunden")
    
    updates = {}
    if max_bids is not None:
        if user["bids_balance"] < max_bids:
            raise HTTPException(status_code=400, detail=f"Nicht genug Gebote. Du hast {user['bids_balance']}")
        updates["max_bids"] = max_bids
    if max_price is not None:
        updates["max_price"] = max_price
    if bid_in_last_seconds is not None:
        updates["bid_in_last_seconds"] = max(5, min(60, bid_in_last_seconds))  # 5-60 seconds
    if pause is not None:
        updates["is_paused"] = pause
    
    if updates:
        await db.autobidders.update_one({"id": autobidder["id"]}, {"$set": updates})
    
    updated = await db.autobidders.find_one({"id": autobidder["id"]}, {"_id": 0})
    return {"message": "Einstellungen aktualisiert", "autobidder": updated}

@router.get("/autobidder/{auction_id}/stats")
async def get_autobidder_stats(auction_id: str, user: dict = Depends(get_current_user)):
    """Get autobidder statistics for an auction"""
    autobidder = await db.autobidders.find_one({
        "user_id": user["id"],
        "auction_id": auction_id
    }, {"_id": 0})
    
    if not autobidder:
        return {"active": False, "stats": None}
    
    auction = await db.auctions.find_one({"id": auction_id}, {"_id": 0})
    
    return {
        "active": autobidder.get("is_active", False),
        "paused": autobidder.get("is_paused", False),
        "stats": {
            "bids_placed": autobidder.get("bids_placed", 0),
            "max_bids": autobidder.get("max_bids", 0),
            "remaining_bids": autobidder.get("max_bids", 0) - autobidder.get("bids_placed", 0),
            "max_price": autobidder.get("max_price"),
            "current_price": auction.get("current_price") if auction else None,
            "will_continue": (
                autobidder.get("is_active", False) and
                not autobidder.get("is_paused", False) and
                autobidder.get("bids_placed", 0) < autobidder.get("max_bids", 0) and
                (autobidder.get("max_price") is None or 
                 (auction and auction.get("current_price", 0) < autobidder.get("max_price", float('inf'))))
            )
        }
    }

@router.put("/autobidder/{autobidder_id}/toggle")
async def toggle_autobidder(autobidder_id: str, user: dict = Depends(get_current_user)):
    """Toggle autobidder active/paused state"""
    # Find autobidder by ID
    autobidder = await db.autobidders.find_one({
        "id": autobidder_id,
        "user_id": user["id"]
    })
    
    if not autobidder:
        raise HTTPException(status_code=404, detail="Autobidder nicht gefunden")
    
    # Toggle the paused state
    new_paused = not autobidder.get("is_paused", False)
    
    await db.autobidders.update_one(
        {"id": autobidder_id},
        {"$set": {"is_paused": new_paused}}
    )
    
    status_msg = "pausiert" if new_paused else "aktiviert"
    return {
        "message": f"Autobidder {status_msg}",
        "is_paused": new_paused,
        "is_active": autobidder.get("is_active", True)
    }

# ==================== BUY IT NOW (SOFORT KAUFEN) ====================

# Constants for Buy It Now pricing
BID_VALUE_EURO = 0.15  # Each bid costs €0.15

@router.get("/auctions/{auction_id}/buy-now-price")
async def get_buy_now_price(auction_id: str, user: dict = Depends(get_current_user)):
    """
    Calculate the Buy It Now price for a user.
    Formula: RRP - (user_bids_on_this_auction * BID_VALUE)
    Minimum price is 50% of RRP.
    """
    auction = await db.auctions.find_one({"id": auction_id}, {"_id": 0})
    if not auction:
        raise HTTPException(status_code=404, detail="Auction not found")
    
    if auction["status"] != "active":
        raise HTTPException(status_code=400, detail="Auction is not active")
    
    product = await db.products.find_one({"id": auction.get("product_id")}, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    rrp = product.get("retail_price", 0)
    
    # Count user's bids on this auction
    bid_history = auction.get("bid_history", [])
    user_bids = sum(1 for bid in bid_history if bid.get("user_id") == user["id"])
    
    # Calculate discount from bids
    bid_discount = user_bids * BID_VALUE_EURO
    
    # Calculate final price (minimum 50% of RRP)
    min_price = rrp * 0.5
    final_price = max(min_price, rrp - bid_discount)
    
    # Calculate savings
    savings = rrp - final_price
    savings_percent = round((savings / rrp) * 100) if rrp > 0 else 0
    
    return {
        "auction_id": auction_id,
        "product_name": product.get("name"),
        "rrp": rrp,
        "user_bids": user_bids,
        "bid_discount": round(bid_discount, 2),
        "min_price": round(min_price, 2),
        "final_price": round(final_price, 2),
        "savings": round(savings, 2),
        "savings_percent": savings_percent,
        "buy_now_available": True
    }


@router.post("/auctions/{auction_id}/buy-now")
async def buy_now(auction_id: str, user: dict = Depends(get_current_user)):
    """
    Execute Buy It Now purchase.
    This ends the auction and assigns the product to the user.
    BONUS: User gets ALL their bids back! (Bid-Back Guarantee)
    """
    auction = await db.auctions.find_one({"id": auction_id}, {"_id": 0})
    if not auction:
        raise HTTPException(status_code=404, detail="Auction not found")
    
    if auction["status"] != "active":
        raise HTTPException(status_code=400, detail="Auction is not active")
    
    product = await db.products.find_one({"id": auction.get("product_id")}, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    rrp = product.get("retail_price", 0)
    
    # Calculate price (same logic as get_buy_now_price)
    bid_history = auction.get("bid_history", [])
    user_bids = sum(1 for bid in bid_history if bid.get("user_id") == user["id"])
    bid_discount = user_bids * BID_VALUE_EURO
    min_price = rrp * 0.5
    final_price = round(max(min_price, rrp - bid_discount), 2)
    
    # BID-BACK GUARANTEE: Return ALL bids used in this auction to the user!
    bids_refunded = user_bids
    if bids_refunded > 0:
        await db.users.update_one(
            {"id": user["id"]},
            {"$inc": {"bids_balance": bids_refunded}}
        )
        logger.info(f"💰 Bid-Back Guarantee: Refunded {bids_refunded} bids to user {user['id']}")
    
    # Create buy-now order
    order_id = str(uuid.uuid4())
    order = {
        "id": order_id,
        "user_id": user["id"],
        "auction_id": auction_id,
        "product_id": product.get("id"),
        "product_name": product.get("name"),
        "type": "buy_now",
        "rrp": rrp,
        "user_bids_used": user_bids,
        "bids_refunded": bids_refunded,  # Track refunded bids
        "bid_discount": round(bid_discount, 2),
        "final_price": final_price,
        "status": "pending_payment",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.orders.insert_one(order)
    
    # End the auction (user wins via Buy Now)
    await db.auctions.update_one(
        {"id": auction_id},
        {
            "$set": {
                "status": "ended",
                "ended_at": datetime.now(timezone.utc).isoformat(),
                "winner_id": user["id"],
                "winner_name": user["name"],
                "final_price": final_price,
                "won_via": "buy_now"
            }
        }
    )
    
    # Add to user's won auctions
    await db.users.update_one(
        {"id": user["id"]},
        {
            "$push": {"won_auctions": {
                "auction_id": auction_id,
                "product_name": product.get("name"),
                "price": final_price,
                "won_at": datetime.now(timezone.utc).isoformat(),
                "won_via": "buy_now"
            }}
        }
    )
    
    # Broadcast auction ended via WebSocket
    try:
        await broadcast_auction_ended(auction_id, {
            "winner_name": user["name"],
            "final_price": final_price,
            "won_via": "buy_now"
        })
    except Exception as e:
        logger.error(f"WebSocket broadcast error: {e}")
    
    logger.info(f"Buy Now completed: User {user['id']} bought {product.get('name')} for €{final_price}")
    
    return {
        "success": True,
        "order_id": order_id,
        "product_name": product.get("name"),
        "final_price": final_price,
        "savings": round(rrp - final_price, 2),
        "message": f"Herzlichen Glückwunsch! Sie haben {product.get('name')} für €{final_price} gekauft!"
    }


@router.get("/orders/my")
async def get_my_orders(user: dict = Depends(get_current_user)):
    """Get user's orders (Buy Now and auction wins)"""
    orders = await db.orders.find(
        {"user_id": user["id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    return {"orders": orders, "count": len(orders)}



@router.post("/admin/auctions")
async def create_auction(auction: AuctionCreate, admin: dict = Depends(get_admin_user)):
    """Create a new auction (admin only)"""
    product = await db.products.find_one({"id": auction.product_id}, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    now = datetime.now(timezone.utc)
    
    # Determine start_time and end_time
    if auction.start_time and auction.end_time:
        start_time = datetime.fromisoformat(auction.start_time.replace('Z', '+00:00'))
        end_time = datetime.fromisoformat(auction.end_time.replace('Z', '+00:00'))
        status = "scheduled" if start_time > now else "active"
    elif auction.duration_seconds:
        start_time = now
        end_time = now + timedelta(seconds=auction.duration_seconds)
        status = "active"
    else:
        start_time = now
        end_time = now + timedelta(hours=24)  # Default 24 hours
        status = "active"
    
    auction_id = str(uuid.uuid4())
    
    # Determine status based on auction type and current time
    now_berlin = datetime.now(timezone.utc) + timedelta(hours=1)
    current_hour = now_berlin.hour + now_berlin.minute / 60
    is_night_time = current_hour >= 23.5 or current_hour < 6
    
    # Adjust status based on auction type
    if auction.is_night_auction and not is_night_time:
        status = "night_paused"  # Night auction during day
    elif not auction.is_night_auction and is_night_time:
        status = "day_paused"  # Day auction during night
    # else keep the status from above (active or scheduled)
    
    doc = {
        "id": auction_id,
        "product_id": auction.product_id,
        "starting_price": auction.starting_price,
        "current_price": auction.starting_price,
        "bid_increment": auction.bid_increment,
        "start_time": start_time.isoformat(),
        "end_time": end_time.isoformat(),
        "status": status,
        "total_bids": 0,
        "bid_count": 0,
        "last_bidder_id": None,
        "last_bidder_name": None,
        "winner_id": None,
        "winner_name": None,
        "bid_history": [],
        "bot_target_price": auction.bot_target_price,
        "buy_now_price": auction.buy_now_price,
        "is_night_auction": auction.is_night_auction or False,
        "is_vip_only": auction.is_vip_only or False,
        "is_beginner_auction": auction.is_beginner_auction or False,
        "is_gift_auction": auction.is_gift_auction or False,
        "auction_type": auction.auction_type or "normal",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.auctions.insert_one(doc)
    
    # Remove _id added by MongoDB before returning
    doc.pop("_id", None)
    
    # Add product info to response
    doc["product"] = product
    
    return doc

@router.put("/admin/auctions/{auction_id}")
async def update_auction(auction_id: str, auction: AuctionUpdate, admin: dict = Depends(get_admin_user)):
    """Update an auction (admin only)"""
    existing = await db.auctions.find_one({"id": auction_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Auction not found")
    
    updates = {}
    
    if auction.status:
        updates["status"] = auction.status
    
    if auction.duration_seconds:
        new_end_time = datetime.now(timezone.utc) + timedelta(seconds=auction.duration_seconds)
        updates["end_time"] = new_end_time.isoformat()
    
    if auction.end_time:
        updates["end_time"] = auction.end_time
    
    if auction.start_time:
        updates["start_time"] = auction.start_time
    
    if updates:
        await db.auctions.update_one({"id": auction_id}, {"$set": updates})
    
    updated = await db.auctions.find_one({"id": auction_id}, {"_id": 0})
    return updated

@router.post("/admin/auctions/{auction_id}/end")
async def end_auction(auction_id: str, admin: dict = Depends(get_admin_user)):
    """Manually end an auction (admin only)"""
    auction = await db.auctions.find_one({"id": auction_id}, {"_id": 0})
    if not auction:
        raise HTTPException(status_code=404, detail="Auction not found")
    
    if auction["status"] == "ended":
        raise HTTPException(status_code=400, detail="Auction already ended")
    
    winner_id = auction.get("last_bidder_id")
    winner_name = auction.get("last_bidder_name")
    final_price = auction.get("current_price")
    
    await db.auctions.update_one(
        {"id": auction_id},
        {"$set": {
            "status": "ended",
            "ended_at": datetime.now(timezone.utc).isoformat(),
            "winner_id": winner_id,
            "winner_name": winner_name,
            "final_price": final_price
        }}
    )
    
    # Notify winner
    if winner_id and not winner_id.startswith("bot_"):
        await db.users.update_one(
            {"id": winner_id},
            {"$push": {"won_auctions": auction_id}}
        )
    
    # Broadcast auction ended
    try:
        await broadcast_auction_ended(auction_id, winner_name or "Kein Gewinner", final_price)
    except Exception as e:
        logger.error(f"Failed to broadcast auction end: {e}")
    
    return {
        "message": "Auction ended",
        "winner_name": winner_name,
        "final_price": final_price
    }

@router.delete("/admin/auctions/{auction_id}")
async def delete_auction(auction_id: str, admin: dict = Depends(get_admin_user)):
    """Delete an auction (admin only)"""
    result = await db.auctions.delete_one({"id": auction_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Auction not found")
    return {"message": "Auction deleted"}

@router.put("/admin/auctions/{auction_id}/featured")
async def set_featured_auction(auction_id: str, is_featured: bool = True, admin: dict = Depends(get_admin_user)):
    """Set an auction as the featured/VIP auction (admin only)"""
    auction = await db.auctions.find_one({"id": auction_id})
    if not auction:
        raise HTTPException(status_code=404, detail="Auktion nicht gefunden")
    
    # If setting as featured, unfeature all other auctions first
    if is_featured:
        await db.auctions.update_many({}, {"$set": {"is_featured": False}})
    
    # Update this auction
    await db.auctions.update_one(
        {"id": auction_id},
        {"$set": {"is_featured": is_featured}}
    )
    
    return {
        "message": f"Auktion {'als VIP markiert' if is_featured else 'VIP-Status entfernt'}",
        "auction_id": auction_id,
        "is_featured": is_featured
    }

@router.put("/admin/auctions/{auction_id}/vip-only")
async def set_vip_only_auction(auction_id: str, is_vip_only: bool = True, admin: dict = Depends(get_admin_user)):
    """Set an auction as VIP-only (only VIP members can bid)"""
    auction = await db.auctions.find_one({"id": auction_id})
    if not auction:
        raise HTTPException(status_code=404, detail="Auktion nicht gefunden")
    
    await db.auctions.update_one(
        {"id": auction_id},
        {"$set": {"is_vip_only": is_vip_only}}
    )
    
    return {
        "message": f"Auktion {'als VIP-Only markiert' if is_vip_only else 'VIP-Only Status entfernt'}",
        "auction_id": auction_id,
        "is_vip_only": is_vip_only
    }

@router.post("/admin/auctions/{auction_id}/restart")
async def restart_auction(
    auction_id: str, 
    duration_seconds: int = 600,
    bot_target_price: Optional[float] = None,
    admin: dict = Depends(get_admin_user)
):
    """Restart an ended auction with a new end time"""
    auction = await db.auctions.find_one({"id": auction_id})
    if not auction:
        raise HTTPException(status_code=404, detail="Auktion nicht gefunden")
    
    now = datetime.now(timezone.utc)
    new_end_time = now + timedelta(seconds=duration_seconds)
    
    # Reset auction to active state
    update_data = {
        "status": "active",
        "start_time": now.isoformat(),
        "end_time": new_end_time.isoformat(),
        "current_price": 0.01,
        "total_bids": 0,
        "last_bidder_id": None,
        "last_bidder_name": None,
        "winner_id": None,
        "winner_name": None,
        "bid_history": [],
        "ended_at": None,
        "final_price": None
    }
    
    # Set bot target price if provided
    if bot_target_price is not None:
        update_data["bot_target_price"] = bot_target_price
    
    await db.auctions.update_one({"id": auction_id}, {"$set": update_data})
    
    # Get product info
    product = await db.products.find_one({"id": auction.get("product_id")}, {"_id": 0})
    
    response_data = {
        "message": "Auktion neu gestartet",
        "auction_id": auction_id,
        "new_end_time": new_end_time.isoformat(),
        "bot_target_price": bot_target_price
    }
    
    return response_data

@router.put("/admin/auctions/{auction_id}/auto-restart")
async def set_auto_restart(
    auction_id: str,
    duration_minutes: int = 10,
    bot_target_price: float = 0,
    admin: dict = Depends(get_admin_user)
):
    """Set auto-restart configuration for an auction"""
    auction = await db.auctions.find_one({"id": auction_id})
    if not auction:
        raise HTTPException(status_code=404, detail="Auktion nicht gefunden")
    
    # Store auto-restart configuration
    auto_restart_config = None
    if duration_minutes > 0:
        auto_restart_config = {
            "enabled": True,
            "duration_minutes": duration_minutes,
            "bot_target_price": bot_target_price if bot_target_price > 0 else None
        }
    
    await db.auctions.update_one(
        {"id": auction_id},
        {"$set": {"auto_restart": auto_restart_config}}
    )
    
    return {
        "message": f"Auto-Neustart {'aktiviert' if duration_minutes > 0 else 'deaktiviert'}",
        "auction_id": auction_id,
        "auto_restart": auto_restart_config
    }

@router.post("/admin/auctions/batch")
async def create_batch_auctions(
    count: int = 100,
    duration_minutes: int = 30,
    bot_target_percentage: int = 20,
    immediate_percent: int = 50,
    admin: dict = Depends(get_admin_user)
):
    """Create multiple auctions at once for testing (admin only)
    
    Args:
        count: Number of auctions to create
        duration_minutes: Base duration for each auction
        bot_target_percentage: Bot target price as percentage of retail price
        immediate_percent: Percentage of auctions to start immediately (0-100)
    """
    import random
    
    products = await db.products.find({}, {"_id": 0}).to_list(1000)
    if not products:
        raise HTTPException(status_code=400, detail="No products available")
    
    now = datetime.now(timezone.utc)
    created_auctions = []
    immediate_count = int(count * (immediate_percent / 100))
    
    for i in range(count):
        product = random.choice(products)
        
        # First 'immediate_count' auctions start immediately, rest are scheduled
        if i < immediate_count:
            start_time = now
            status = "active"
        else:
            # Randomize start times over the next hours for variety
            start_offset = random.randint(5, 120)  # 5-120 minutes
            start_time = now + timedelta(minutes=start_offset)
            status = "scheduled"
        
        end_time = start_time + timedelta(minutes=duration_minutes + random.randint(0, 30))
        
        # Calculate bot target price (percentage of retail price)
        retail_price = product.get("retail_price", 100)
        bot_target = round(retail_price * (bot_target_percentage / 100), 2)
        
        # Buy now price at 70-90% of retail
        buy_now_price = round(retail_price * random.uniform(0.7, 0.9), 2)
        
        auction_id = str(uuid.uuid4())
        doc = {
            "id": auction_id,
            "product_id": product["id"],
            "starting_price": 0.01,
            "current_price": 0.01,
            "bid_increment": 0.01,
            "start_time": start_time.isoformat(),
            "end_time": end_time.isoformat(),
            "status": status,
            "total_bids": 0,
            "last_bidder_id": None,
            "last_bidder_name": None,
            "winner_id": None,
            "winner_name": None,
            "bid_history": [],
            "bot_target_price": bot_target,
            "buy_now_price": buy_now_price,
            "created_at": now.isoformat()
        }
        
        await db.auctions.insert_one(doc)
        created_auctions.append({
            "id": auction_id,
            "product": product["name"],
            "status": status,
            "bot_target": bot_target,
            "buy_now_price": buy_now_price
        })
    
    return {
        "message": f"{count} Auktionen erstellt",
        "active": len([a for a in created_auctions if a["status"] == "active"]),
        "scheduled": len([a for a in created_auctions if a["status"] == "scheduled"]),
        "auctions": created_auctions[:10]  # Return first 10 as sample
    }

# ==================== BUY IT NOW ====================

@router.post("/auctions/{auction_id}/buy-now")
async def buy_now(auction_id: str, user: dict = Depends(get_current_user)):
    """Buy the item immediately at the buy-now price"""
    auction = await db.auctions.find_one({"id": auction_id}, {"_id": 0})
    if not auction:
        raise HTTPException(status_code=404, detail="Auction not found")
    
    if auction["status"] != "active":
        raise HTTPException(status_code=400, detail="Auktion ist nicht aktiv")
    
    buy_now_price = auction.get("buy_now_price")
    if not buy_now_price:
        raise HTTPException(status_code=400, detail="Sofortkauf nicht verfügbar")
    
    # Get product info
    product = await db.products.find_one({"id": auction.get("product_id")}, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    # Create purchase record
    purchase_id = str(uuid.uuid4())
    purchase = {
        "id": purchase_id,
        "user_id": user["id"],
        "user_email": user["email"],
        "auction_id": auction_id,
        "product_id": auction["product_id"],
        "product_name": product.get("name", "Unknown"),
        "product_image": product.get("image_url", ""),
        "purchase_type": "buy_now",
        "price": buy_now_price,
        "status": "pending_payment",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.purchases.insert_one(purchase)
    
    # End the auction
    await db.auctions.update_one(
        {"id": auction_id},
        {"$set": {
            "status": "ended",
            "ended_at": datetime.now(timezone.utc).isoformat(),
            "winner_id": user["id"],
            "winner_name": user.get("name", user["email"]),
            "final_price": buy_now_price,
            "buy_now_used": True
        }}
    )
    
    # Add to user's won auctions
    await db.users.update_one(
        {"id": user["id"]},
        {"$push": {"won_auctions": auction_id}}
    )
    
    # Grant achievement
    await grant_achievement(user["id"], "first_buy_now", "Sofortkäufer", "Ersten Artikel mit Sofortkauf erworben")
    
    # Broadcast auction ended
    try:
        await broadcast_auction_ended(auction_id, user.get("name", user["email"]), buy_now_price)
    except Exception as e:
        logger.error(f"Failed to broadcast: {e}")
    
    return {
        "message": "Sofortkauf erfolgreich!",
        "purchase_id": purchase_id,
        "product": product.get("name"),
        "price": buy_now_price,
        "status": "pending_payment"
    }

@router.get("/auctions/{auction_id}/buy-now-price")
async def get_buy_now_price(auction_id: str):
    """Get the buy-now price for an auction"""
    auction = await db.auctions.find_one({"id": auction_id}, {"_id": 0, "buy_now_price": 1, "status": 1})
    if not auction:
        raise HTTPException(status_code=404, detail="Auction not found")
    
    return {
        "auction_id": auction_id,
        "buy_now_price": auction.get("buy_now_price"),
        "available": auction.get("status") == "active" and auction.get("buy_now_price") is not None
    }

# ==================== ACHIEVEMENTS HELPER ====================

async def grant_achievement(user_id: str, achievement_id: str, name: str, description: str):
    """Grant an achievement to a user"""
    existing = await db.achievements.find_one({
        "user_id": user_id,
        "achievement_id": achievement_id
    })
    
    if not existing:
        await db.achievements.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "achievement_id": achievement_id,
            "name": name,
            "description": description,
            "earned_at": datetime.now(timezone.utc).isoformat()
        })
        return True
    return False
