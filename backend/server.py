"""
BidBlitz Auction Platform - Main Server
Refactored modular architecture with routers
"""
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends, HTTPException
from fastapi.responses import StreamingResponse
from starlette.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import asyncio
import logging
import random
import uuid
import io
from datetime import datetime, timezone, timedelta

# Config and DB
from config import db, logger, BID_PACKAGES

# Import routers
from routers.auth import router as auth_router
from routers.products import router as products_router
from routers.auctions import router as auctions_router
from routers.checkout import router as checkout_router
from routers.admin import router as admin_router
from routers.affiliate import router as affiliate_router
from routers.user import router as user_router
# users_router removed - consolidated into user_router
from routers.bots import router as bots_router
from routers.vouchers import router as vouchers_router
from routers.staff import router as staff_router
from routers.rewards import router as rewards_router
from routers.invoices import router as invoices_router
from routers.notifications import router as notifications_router
from routers.vip import router as vip_router
from routers.pages import router as pages_router
from routers.influencer import router as influencer_router
from routers.wholesale import router as wholesale_router
from routers.gifts import router as gifts_router
from routers.voice_command import router as voice_command_router
from routers.giftcards import router as giftcards_router
from routers.wheel import router as wheel_router
from routers.leaderboard import router as leaderboard_router
from routers.gamification import router as gamification_router
from routers.telegram import router as telegram_router
from routers.referral import router as referral_router
from routers.challenges import router as challenges_router
from routers.events import router as events_router
from routers.gallery import router as gallery_router
from routers.subscriptions import router as subscriptions_router
from routers.loyalty import router as loyalty_router
from routers.flash_sales import router as flash_sales_router
from routers.wishlist import router as wishlist_router
from routers.user_stats import router as user_stats_router
from routers.abandoned_cart import router as cart_router
from routers.reviews import router as reviews_router
from routers.mystery_box import router as mystery_router
from routers.levels import router as levels_router
from routers.daily_quests import router as daily_quests_router
from routers.power_hour import router as power_hour_router
from routers.price_alerts import router as price_alerts_router
from routers.social_share import router as social_share_router
from routers.battle_pass import router as battle_pass_router
from routers.bundles import bundles_router
from routers.flash_sales_v2 import flash_sales_router as flash_sales_v2_router
from routers.vip_subscription import vip_subscription_router
from routers.last_chance import last_chance_router
from routers.reviews_v2 import reviews_router as reviews_v2_router
from routers.friend_battle import friend_battle_router
from routers.manager import manager_router
from routers.bid_buddy import bid_buddy_router
from routers.buy_it_now import buy_it_now_router
from routers.subscription import subscription_router
from routers.achievements import achievements_router
from routers.testimonials import testimonials_router
from routers.countdown_alarm import countdown_alarm_router
from routers.win_notifications import win_notifications_router
from routers.favorites import favorites_router
from routers.teams import teams_router
from routers.bid_refund import bid_refund_router
from routers.auction_replay import auction_replay_router
from routers.flash_coupons import flash_coupons_router
from routers.vip_lounge import vip_lounge_router
from routers.birthday import birthday_router
from routers.insurance import insurance_router
from routers.wishlist import wishlist_router as product_wishlist_router
from routers.streak_protection import streak_protection_router
from routers.weekly_winners import weekly_winners_router
from routers.excitement import router as excitement_router
from routers.investor import router as investor_router
from routers.voucher_auctions import router as voucher_auctions_router
from routers.promo_codes import router as promo_codes_router

# WebSocket manager
from services.websocket import ws_manager, broadcast_bid_update, broadcast_auction_ended

# Dependencies
from dependencies import get_current_user, get_admin_user

# PDF generation
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import cm
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_RIGHT

# Global flag for bot task
bot_task_running = False

# ==================== LIFESPAN ====================

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan - startup and shutdown"""
    global bot_task_running
    
    # Startup
    bot_task_running = True
    asyncio.create_task(bot_last_second_bidder())
    asyncio.create_task(auction_reminder_processor())
    asyncio.create_task(auction_auto_restart_processor())
    asyncio.create_task(auction_expiry_checker())
    asyncio.create_task(day_night_auction_scheduler())
    logger.info("BidBlitz server started - Bot bidder, Reminder, Auto-restart & Expiry checker tasks running")
    
    yield
    
    # Shutdown
    bot_task_running = False
    logger.info("BidBlitz server shutting down")

# ==================== APP CREATION ====================

app = FastAPI(
    title="BidBlitz Auction API",
    description="Penny Auction Platform",
    version="2.0.0",
    lifespan=lifespan
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==================== INCLUDE ROUTERS ====================

app.include_router(auth_router, prefix="/api")
app.include_router(products_router, prefix="/api")
app.include_router(auctions_router, prefix="/api")
app.include_router(checkout_router, prefix="/api")
app.include_router(admin_router, prefix="/api")
app.include_router(affiliate_router, prefix="/api")
app.include_router(user_router, prefix="/api")
# users_router removed - consolidated into user_router
app.include_router(bots_router, prefix="/api")
app.include_router(vouchers_router, prefix="/api")
app.include_router(staff_router, prefix="/api")
app.include_router(rewards_router, prefix="/api")
app.include_router(invoices_router, prefix="/api")
app.include_router(notifications_router, prefix="/api")
app.include_router(vip_router, prefix="/api")
app.include_router(pages_router, prefix="/api")
app.include_router(influencer_router, prefix="/api")
app.include_router(wholesale_router, prefix="/api")
app.include_router(gifts_router, prefix="/api")
app.include_router(voice_command_router, prefix="/api")
app.include_router(giftcards_router, prefix="/api")
app.include_router(wheel_router, prefix="/api")
app.include_router(leaderboard_router, prefix="/api")
app.include_router(gamification_router, prefix="/api")
app.include_router(telegram_router, prefix="/api")
app.include_router(referral_router, prefix="/api")
app.include_router(challenges_router, prefix="/api")
app.include_router(events_router, prefix="/api")
app.include_router(gallery_router, prefix="/api")
app.include_router(subscriptions_router, prefix="/api")
app.include_router(loyalty_router, prefix="/api")
app.include_router(flash_sales_router, prefix="/api")
app.include_router(wishlist_router, prefix="/api")
app.include_router(user_stats_router, prefix="/api")
app.include_router(cart_router, prefix="/api")
app.include_router(reviews_router, prefix="/api")
app.include_router(mystery_router, prefix="/api")
app.include_router(levels_router, prefix="/api")
app.include_router(daily_quests_router, prefix="/api")
app.include_router(power_hour_router, prefix="/api")
app.include_router(price_alerts_router, prefix="/api")
app.include_router(social_share_router, prefix="/api")
app.include_router(battle_pass_router, prefix="/api")
app.include_router(bundles_router, prefix="/api")
app.include_router(flash_sales_v2_router, prefix="/api")
app.include_router(vip_subscription_router, prefix="/api")
app.include_router(last_chance_router, prefix="/api")
app.include_router(reviews_v2_router, prefix="/api")
app.include_router(friend_battle_router, prefix="/api")
app.include_router(manager_router, prefix="/api")
app.include_router(bid_buddy_router, prefix="/api")
app.include_router(buy_it_now_router, prefix="/api")
app.include_router(subscription_router, prefix="/api")
app.include_router(achievements_router, prefix="/api")
app.include_router(testimonials_router, prefix="/api")
app.include_router(countdown_alarm_router, prefix="/api")
app.include_router(win_notifications_router, prefix="/api")
app.include_router(favorites_router, prefix="/api")
app.include_router(teams_router, prefix="/api")
app.include_router(bid_refund_router, prefix="/api")
app.include_router(auction_replay_router, prefix="/api")
app.include_router(flash_coupons_router, prefix="/api")
app.include_router(vip_lounge_router, prefix="/api")
app.include_router(birthday_router, prefix="/api")
app.include_router(insurance_router, prefix="/api")
app.include_router(product_wishlist_router, prefix="/api")
app.include_router(streak_protection_router, prefix="/api")
app.include_router(weekly_winners_router, prefix="/api")
app.include_router(excitement_router, prefix="/api")
app.include_router(investor_router, prefix="/api")
app.include_router(voucher_auctions_router, prefix="/api")
app.include_router(promo_codes_router, prefix="/api")

# ==================== HEALTH & BASIC ENDPOINTS ====================

@app.get("/")
async def root():
    return {"status": "BidBlitz API v2.0 - Refactored"}

@app.get("/api/health")
async def health():
    return {"status": "healthy", "timestamp": datetime.now(timezone.utc).isoformat()}

@app.get("/api/bid-packages")
async def get_bid_packages():
    """Get available bid packages"""
    return BID_PACKAGES

# ==================== WEBSOCKET ENDPOINTS ====================

@app.websocket("/api/ws/auction/{auction_id}")
async def websocket_auction(websocket: WebSocket, auction_id: str):
    """WebSocket endpoint for real-time auction updates"""
    await ws_manager.connect(websocket, auction_id)
    try:
        while True:
            # Keep connection alive, handle incoming messages
            data = await websocket.receive_text()
            # Could handle client messages here if needed
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        ws_manager.disconnect(websocket)

@app.websocket("/api/ws/auctions")
async def websocket_all_auctions(websocket: WebSocket):
    """WebSocket for all auction updates"""
    await ws_manager.connect(websocket, "all_auctions")
    try:
        while True:
            data = await websocket.receive_text()
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        ws_manager.disconnect(websocket)

# Also support legacy paths without /api prefix
@app.websocket("/ws/auction/{auction_id}")
async def websocket_auction_legacy(websocket: WebSocket, auction_id: str):
    await websocket_auction(websocket, auction_id)

@app.websocket("/ws/auctions")
async def websocket_all_auctions_legacy(websocket: WebSocket):
    await websocket_all_auctions(websocket)

# ==================== BOT BACKGROUND TASK ====================

async def bot_last_second_bidder():
    """Background task - bots bid continuously until auction price reaches €2-3.
    
    LOGIK:
    1. STANDARD (kein Zielpreis): Bots bieten KONTINUIERLICH bis €2-3
       - Auktionen bleiben nicht bei €0,01 stecken
       - Echte Kunden können ab €2-3 weitermachen
    2. MIT ZIELPREIS: Bots bieten NUR in den letzten 2-3 Sekunden bis zum Zielpreis
       - Das "sperrt" den Endpreis, echte Kunden haben keine Chance mehr
    """
    global bot_task_running
    
    logger.info("Bot bidder started - Kontinuierliches Bieten bis €2-3")
    last_bot_per_auction = {}
    last_bid_time_per_auction = {}
    
    # Default price range for auctions WITHOUT explicit target (2.00 - 3.00 Euro)
    DEFAULT_MIN_PRICE = 2.00
    DEFAULT_MAX_PRICE = 3.00
    
    # Minimum time between bot bids on same auction (slower so customers see each 1 cent increment)
    MIN_BID_INTERVAL = 4.0  # 4 seconds between bids - customers can see each 1 cent step
    
    while bot_task_running:
        try:
            # Get ALL active auctions
            active_auctions = await db.auctions.find({
                "status": "active"
            }, {"_id": 0}).to_list(200)
            
            now = datetime.now(timezone.utc)
            
            for auction in active_auctions:
                try:
                    # NOTE: Bots bid 24/7 - no business hours restriction
                    
                    end_time = datetime.fromisoformat(auction["end_time"].replace("Z", "+00:00"))
                    seconds_left = (end_time - now).total_seconds()
                    
                    # Skip if auction already ended
                    if seconds_left <= 0:
                        continue
                    
                    current_price = auction.get("current_price", 0)
                    auction_id = auction.get("id")
                    bid_increment = auction.get("bid_increment", 0.01)
                    explicit_target = auction.get("bot_target_price", 0)
                    
                    # GUARANTEED WINNER CHECK: Don't bid if a guaranteed winner is active
                    guaranteed_winner_id = auction.get("guaranteed_winner_bidding")
                    if guaranteed_winner_id and auction.get("last_bidder_id") == guaranteed_winner_id:
                        continue
                    
                    # Check if enough time has passed since last bot bid on this auction
                    last_bid_time = last_bid_time_per_auction.get(auction_id, 0)
                    time_since_last_bid = (now.timestamp() - last_bid_time)
                    
                    should_bid = False
                    target_price = 0
                    
                    # Check if explicit target is set for this auction
                    # If set, this is the MAXIMUM price bots will bid to
                    if explicit_target and explicit_target > 0:
                        # Bot-Zielpreis ist gesetzt - Bots bieten kontinuierlich BIS zu diesem Preis
                        if current_price < explicit_target and time_since_last_bid >= MIN_BID_INTERVAL:
                            target_price = explicit_target
                            should_bid = True
                    else:
                        # Kein Zielpreis gesetzt - verwende Standard €2-3 Range
                        hash_val = hash(auction_id) % 100
                        default_target = DEFAULT_MIN_PRICE + (hash_val / 100) * (DEFAULT_MAX_PRICE - DEFAULT_MIN_PRICE)
                        default_target = round(default_target, 2)
                        
                        if current_price < default_target and time_since_last_bid >= MIN_BID_INTERVAL:
                            target_price = default_target
                            should_bid = True
                    
                    if should_bid:
                        # Get bots
                        bots = await db.bots.find({}, {"_id": 0}).to_list(100)
                        if bots:
                            # Choose different bot than last time
                            last_bot_id = last_bot_per_auction.get(auction_id)
                            available = [b for b in bots if b["id"] != last_bot_id] or bots
                            bot = random.choice(available)
                            last_bot_per_auction[auction_id] = bot["id"]
                            last_bid_time_per_auction[auction_id] = now.timestamp()
                            
                            # Place bid
                            new_price = round(current_price + bid_increment, 2)
                            
                            # Timer extension: 10-15 seconds
                            timer_ext = random.randint(10, 15)
                            
                            new_end_time = datetime.now(timezone.utc) + timedelta(seconds=timer_ext)
                            
                            bid_entry = {
                                "user_id": f"bot_{bot['id']}",
                                "user_name": bot["name"],
                                "price": new_price,
                                "timestamp": datetime.now(timezone.utc).isoformat(),
                                "is_bot": True
                            }
                            
                            await db.auctions.update_one(
                                {"id": auction_id, "status": "active"},
                                {
                                    "$set": {
                                        "current_price": new_price,
                                        "end_time": new_end_time.isoformat(),
                                        "last_bidder_id": f"bot_{bot['id']}",
                                        "last_bidder_name": bot["name"]
                                    },
                                    "$inc": {"total_bids": 1, "bid_count": 1},
                                    "$push": {"bid_history": bid_entry}
                                }
                            )
                            
                            # Update bot stats
                            await db.bots.update_one(
                                {"id": bot["id"]},
                                {"$inc": {"total_bids_placed": 1}}
                            )
                            
                            # Broadcast
                            await broadcast_bid_update(auction_id, {
                                "current_price": new_price,
                                "last_bidder_name": bot["name"],
                                "last_bidder_id": f"bot_{bot['id']}",
                                "total_bids": auction.get("total_bids", 0) + 1,
                                "bid_count": auction.get("bid_count", 0) + 1,
                                "end_time": new_end_time.isoformat(),
                                "bidder_message": f"{bot['name']} hat geboten!"
                            })
                            
                            logger.info(f"🤖 Bot '{bot['name']}' bid €{new_price:.2f} (target: €{target_price:.2f})")
                            
                except Exception as e:
                    logger.error(f"Bot bid error for {auction.get('id')}: {e}")
            
            await asyncio.sleep(0.5)
            
        except Exception as e:
            logger.error(f"Bot bidder error: {e}")
            await asyncio.sleep(1)
    
    logger.info("Bot bidder stopped")


async def auction_auto_restart_processor():
    """Background task - automatically restart ALL ended auctions IMMEDIATELY (no delay)"""
    global bot_task_running
    
    # Auto-restart delay: 3 seconds (almost instant restart)
    RESTART_DELAY_SECONDS = 3
    
    logger.info(f"Auction auto-restart processor started - Auktionen starten sofort neu nach {RESTART_DELAY_SECONDS} Sekunden")
    
    while bot_task_running:
        try:
            now_utc = datetime.now(timezone.utc)
            
            # Find ALL ended auctions - restart them almost immediately
            ended_auctions = await db.auctions.find({
                "status": "ended"
            }, {"_id": 0}).to_list(100)
            
            for auction in ended_auctions:
                try:
                    # Check if auction has been ended for at least 3 seconds
                    ended_at = auction.get("ended_at")
                    if ended_at:
                        try:
                            ended_time = datetime.fromisoformat(ended_at.replace("Z", "+00:00"))
                            seconds_since_ended = (now_utc - ended_time).total_seconds()
                            
                            # Wait only 3 seconds before restarting (gives time for UI to show ended state briefly)
                            if seconds_since_ended < RESTART_DELAY_SECONDS:
                                continue  # Skip - not old enough yet
                        except:
                            pass  # If we can't parse ended_at, restart anyway
                    
                    # Get original duration from the auto_restart config
                    # Handle case where auto_restart might be a bool instead of dict
                    auto_restart_raw = auction.get("auto_restart")
                    if isinstance(auto_restart_raw, dict):
                        auto_restart = auto_restart_raw
                    else:
                        auto_restart = {}  # Default to empty dict if bool or None
                    
                    duration_minutes = auto_restart.get("duration_minutes")
                    
                    # If no configured duration, use DEFAULT 10 minutes
                    # Don't try to calculate from times as this can lead to very short durations
                    if not duration_minutes or duration_minutes < 5:
                        duration_minutes = 10  # Default 10 minutes minimum
                    
                    # Keep the same bot target price
                    bot_target = auction.get("bot_target_price") or auto_restart.get("bot_target_price")
                    
                    now = datetime.now(timezone.utc)
                    new_end_time = now + timedelta(minutes=duration_minutes)
                    
                    # Store original times if not already stored (for duration calculation on next restart)
                    original_start_time = auction.get("original_start_time") or auction.get("start_time")
                    original_end_time = auction.get("original_end_time") or auction.get("end_time")
                    
                    # Reset auction to active state with SAME SETTINGS
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
                        "final_price": None,
                        "original_start_time": original_start_time,
                        "original_end_time": original_end_time
                    }
                    
                    # Keep the same bot target price
                    if bot_target and bot_target > 0:
                        update_data["bot_target_price"] = bot_target
                    
                    # Mark as auto-restarted for tracking
                    update_data["auto_restart"] = {
                        "enabled": True,
                        "duration_minutes": duration_minutes,
                        "bot_target_price": bot_target,
                        "last_restart": now.isoformat(),
                        "restart_count": auto_restart.get("restart_count", 0) + 1
                    }
                    
                    await db.auctions.update_one({"id": auction["id"]}, {"$set": update_data})
                    
                    product_name = auction.get("product", {}).get("name", auction["id"][:8])
                    logger.info(f"🔄 Auto-restarted: {product_name} for {duration_minutes} min" + 
                               (f" (Bot: €{bot_target})" if bot_target else ""))
                    
                    # Broadcast auction restart via WebSocket so frontend updates immediately
                    try:
                        from services.websocket import ws_manager
                        restart_message = {
                            "type": "auction_restarted",
                            "auction_id": auction["id"],
                            "data": {
                                "status": "active",
                                "current_price": 0.01,
                                "end_time": new_end_time.isoformat(),
                                "total_bids": 0,
                                "last_bidder_name": None
                            },
                            "timestamp": now.isoformat()
                        }
                        await ws_manager.broadcast_to_auction("all_auctions", restart_message)
                        await ws_manager.broadcast_to_auction(auction["id"], restart_message)
                    except Exception as ws_err:
                        logger.error(f"WebSocket broadcast error on restart: {ws_err}")
                    
                except Exception as e:
                    logger.error(f"Auto-restart error for {auction.get('id')}: {e}")
            
            await asyncio.sleep(10)  # Check every 10 seconds
            
        except Exception as e:
            logger.error(f"Auto-restart processor error: {e}")
            await asyncio.sleep(30)
    
    logger.info("Auto-restart processor stopped")


async def auction_expiry_checker():
    """Background task - automatically end auctions that have expired"""
    global bot_task_running
    
    logger.info("Auction expiry checker started - Will end expired auctions automatically")
    
    while bot_task_running:
        try:
            now = datetime.now(timezone.utc)
            now_iso = now.isoformat()
            
            # Find active auctions that have passed their end time
            expired_auctions = await db.auctions.find({
                "status": "active",
                "end_time": {"$lt": now_iso}
            }, {"_id": 0}).to_list(100)
            
            for auction in expired_auctions:
                try:
                    auction_id = auction["id"]
                    
                    # Determine winner
                    winner_id = auction.get("last_bidder_id")
                    winner_name = auction.get("last_bidder_name")
                    final_price = auction.get("current_price", 0.01)
                    
                    # Update auction to ended status
                    await db.auctions.update_one(
                        {"id": auction_id},
                        {"$set": {
                            "status": "ended",
                            "ended_at": now_iso,
                            "final_price": final_price,
                            "winner_id": winner_id,
                            "winner_name": winner_name
                        }}
                    )
                    
                    # Get product data for email
                    product = await db.products.find_one({"id": auction.get("product_id")}, {"_id": 0})
                    
                    # Create won auction record for user
                    if winner_id:
                        await db.won_auctions.insert_one({
                            "id": str(uuid.uuid4()),
                            "user_id": winner_id,
                            "auction_id": auction_id,
                            "product_id": auction.get("product_id"),
                            "product_name": product.get("name") if product else auction_id[:8],
                            "product_image": product.get("image_url") if product else "",
                            "final_price": final_price,
                            "retail_price": product.get("retail_price") if product else 0,
                            "won_at": now_iso,
                            "status": "pending_payment",  # New status for payment tracking
                            "payment_deadline": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
                            "is_free_auction": auction.get("is_free_auction", False)
                        })
                        
                        # Send winner notification email
                        try:
                            from services.winner_notifications import send_winner_email
                            auction_with_product = {**auction, "product": product}
                            await send_winner_email(winner_id, auction_with_product, product or {})
                        except Exception as email_error:
                            logger.error(f"Failed to send winner email: {email_error}")
                    
                    product_name = product.get("name") if product else auction_id[:8]
                    logger.info(f"⏱️ Expired auction ended: {product_name} | Winner: {winner_name or 'None'} | Final: €{final_price}")
                    
                except Exception as e:
                    logger.error(f"Error ending expired auction {auction.get('id')}: {e}")
            
            await asyncio.sleep(5)  # Check every 5 seconds
            
        except Exception as e:
            logger.error(f"Auction expiry checker error: {e}")
            await asyncio.sleep(10)
    
    logger.info("Auction expiry checker stopped")


async def auction_reminder_processor():
    """Background task - process auction reminders and send push notifications"""
    global bot_task_running
    from routers.notifications import process_auction_reminders
    
    logger.info("Auction reminder processor started")
    
    while bot_task_running:
        try:
            await process_auction_reminders()
            await asyncio.sleep(30)  # Check every 30 seconds
        except Exception as e:
            logger.error(f"Reminder processor error: {e}")
            await asyncio.sleep(60)
    
    logger.info("Reminder processor stopped")


async def day_night_auction_scheduler():
    """Background task - Automatically pause/resume auctions based on day/night schedule
    
    Schedule (Berlin Time):
    - 23:30 (Night Start): Pause day auctions, resume night auctions
    - 06:00 (Day Start): Pause night auctions, resume day auctions
    """
    global bot_task_running
    
    logger.info("🌓 Day/Night auction scheduler started")
    
    last_mode = None  # Track last mode to avoid duplicate switches
    
    while bot_task_running:
        try:
            # Get current Berlin time
            now_berlin = datetime.now(timezone.utc) + timedelta(hours=1)
            current_hour = now_berlin.hour + now_berlin.minute / 60
            
            # Determine if it's night time (23:30 - 06:00)
            is_night_time = current_hour >= 23.5 or current_hour < 6
            current_mode = "night" if is_night_time else "day"
            
            # Only switch if mode changed
            if current_mode != last_mode:
                if is_night_time:
                    # NIGHT MODE: Pause day auctions, resume night auctions
                    logger.info("🌙 Switching to NIGHT MODE - Pausing day auctions, activating night auctions")
                    
                    # Pause all day auctions (not night auctions)
                    day_result = await db.auctions.update_many(
                        {"status": "active", "is_night_auction": {"$ne": True}},
                        {"$set": {"status": "day_paused", "paused_at": datetime.now(timezone.utc).isoformat()}}
                    )
                    
                    # Resume night auctions
                    night_result = await db.auctions.update_many(
                        {"status": "night_paused", "is_night_auction": True},
                        {"$set": {
                            "status": "active",
                            "end_time": (datetime.now(timezone.utc) + timedelta(minutes=10)).isoformat()
                        }}
                    )
                    
                    logger.info(f"🌙 Night mode: Paused {day_result.modified_count} day auctions, Resumed {night_result.modified_count} night auctions")
                    
                else:
                    # DAY MODE: Resume day auctions, pause night auctions
                    logger.info("☀️ Switching to DAY MODE - Resuming day auctions, pausing night auctions")
                    
                    # Pause all night auctions
                    night_result = await db.auctions.update_many(
                        {"status": "active", "is_night_auction": True},
                        {"$set": {"status": "night_paused", "paused_at": datetime.now(timezone.utc).isoformat()}}
                    )
                    
                    # Resume day auctions with fresh timer
                    day_auctions = await db.auctions.find(
                        {"status": "day_paused"},
                        {"_id": 0, "id": 1}
                    ).to_list(500)
                    
                    for auction in day_auctions:
                        await db.auctions.update_one(
                            {"id": auction["id"]},
                            {"$set": {
                                "status": "active",
                                "end_time": (datetime.now(timezone.utc) + timedelta(minutes=10)).isoformat()
                            }}
                        )
                    
                    logger.info(f"☀️ Day mode: Resumed {len(day_auctions)} day auctions, Paused {night_result.modified_count} night auctions")
                
                last_mode = current_mode
            
            await asyncio.sleep(60)  # Check every minute
            
        except Exception as e:
            logger.error(f"Day/Night scheduler error: {e}")
            await asyncio.sleep(60)
    
    logger.info("Day/Night auction scheduler stopped")


# ==================== WINNERS GALLERY ====================

@app.get("/api/winners")
async def get_winners(limit: int = 20):
    """Get recent auction winners"""
    ended = await db.auctions.find(
        {"status": "ended", "winner_id": {"$ne": None}},
        {"_id": 0}
    ).sort("ended_at", -1).to_list(limit)
    
    for auction in ended:
        product = await db.products.find_one({"id": auction.get("product_id")}, {"_id": 0})
        if product:
            auction["product"] = product
    
    return ended

# ==================== BID HISTORY ====================

@app.get("/api/auctions/{auction_id}/bid-history")
async def get_bid_history(auction_id: str, limit: int = 50):
    """Get bid history for auction"""
    auction = await db.auctions.find_one({"id": auction_id}, {"_id": 0, "bid_history": 1})
    if not auction:
        raise HTTPException(status_code=404, detail="Auction not found")
    
    history = auction.get("bid_history", [])
    history = sorted(history, key=lambda x: x.get("timestamp", ""), reverse=True)[:limit]
    return history

# ==================== PDF INVOICE ====================

@app.get("/api/invoice/{transaction_id}")
async def download_invoice(transaction_id: str, user: dict = Depends(get_current_user)):
    """Generate PDF invoice for a transaction"""
    transaction = await db.transactions.find_one({
        "id": transaction_id,
        "user_id": user["id"],
        "status": "completed"
    }, {"_id": 0})
    
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    # Generate PDF
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=2*cm, bottomMargin=2*cm)
    styles = getSampleStyleSheet()
    
    title_style = ParagraphStyle('Title', parent=styles['Heading1'], alignment=TA_CENTER, fontSize=24, spaceAfter=30)
    header_style = ParagraphStyle('Header', parent=styles['Normal'], fontSize=12, spaceAfter=20)
    
    elements = []
    
    # Header
    elements.append(Paragraph("BidBlitz", title_style))
    elements.append(Paragraph("Rechnung", ParagraphStyle('Subtitle', alignment=TA_CENTER, fontSize=16, spaceAfter=20)))
    elements.append(Spacer(1, 20))
    
    # Invoice details
    invoice_date = datetime.fromisoformat(transaction.get("completed_at", transaction.get("created_at")).replace("Z", "+00:00"))
    elements.append(Paragraph(f"Rechnungsnummer: INV-{transaction_id[:8].upper()}", header_style))
    elements.append(Paragraph(f"Datum: {invoice_date.strftime('%d.%m.%Y')}", header_style))
    elements.append(Paragraph(f"Kunde: {user['email']}", header_style))
    elements.append(Spacer(1, 30))
    
    # Table
    data = [
        ["Beschreibung", "Anzahl", "Preis"],
        [f"{transaction['bids']} Gebote", "1", f"€{transaction['amount']:.2f}"],
        ["", "Gesamt:", f"€{transaction['amount']:.2f}"]
    ]
    
    table = Table(data, colWidths=[10*cm, 3*cm, 3*cm])
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (1, 0), (-1, -1), 'RIGHT'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 12),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('GRID', (0, 0), (-1, -1), 1, colors.black)
    ]))
    
    elements.append(table)
    elements.append(Spacer(1, 40))
    elements.append(Paragraph("Vielen Dank für Ihren Einkauf!", ParagraphStyle('Thanks', alignment=TA_CENTER, fontSize=14)))
    
    doc.build(elements)
    buffer.seek(0)
    
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=rechnung_{transaction_id[:8]}.pdf"}
    )

# ==================== BOT SEEDING ====================

@app.post("/api/admin/bots/seed")
async def seed_bots(admin: dict = Depends(get_admin_user)):
    """Create 20 new bots with unique names"""
    first_names = [
        "Max", "Anna", "Leon", "Sophie", "Paul", "Emma", "Luca", "Mia", "Felix", "Hannah",
        "Jonas", "Lea", "Tim", "Laura", "David", "Julia", "Simon", "Sarah", "Niklas", "Lisa",
        "Jan", "Marie", "Tom", "Lena", "Lukas", "Nele", "Ben", "Clara", "Erik", "Amelie",
        "Moritz", "Emily", "Julian", "Johanna", "Finn", "Maja", "Noah", "Alina", "Elias", "Zoe",
        "Bardh", "Arben", "Drita", "Fatmir", "Genta", "Hana", "Ilir", "Kaltrina", "Liridon", "Majlinda",
        "Stefan", "Peter", "Michael", "Thomas", "Andreas", "Matthias", "Jens", "Marco", "Sascha", "Frank"
    ]
    
    last_initials = ["K.", "M.", "S.", "L.", "H.", "B.", "W.", "R.", "F.", "T.", "N.", "P.", "G.", "D.", "J.", "A.", "E.", "V.", "Z.", "C."]
    
    import uuid
    
    created = 0
    for _ in range(20):
        for attempt in range(50):
            name = f"{random.choice(first_names)} {random.choice(last_initials)}"
            existing = await db.bots.find_one({"name": name})
            if not existing:
                bot = {
                    "id": str(uuid.uuid4()),
                    "name": name,
                    "total_bids_placed": 0,
                    "created_at": datetime.now(timezone.utc).isoformat(),
                    "created_by": admin["id"]
                }
                await db.bots.insert_one(bot)
                created += 1
                break
    
    total = await db.bots.count_documents({})
    return {"message": f"{created} neue Bots erstellt", "total": total, "created": created}

# ==================== LEGACY COMPATIBILITY ====================
# These endpoints may still be used by frontend, keeping for compatibility

@app.get("/api/categories")
async def get_categories():
    """Get all product categories"""
    products = await db.products.find({}, {"category": 1}).to_list(1000)
    categories = list(set(p.get("category", "Allgemein") for p in products if p.get("category")))
    return sorted(categories)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
