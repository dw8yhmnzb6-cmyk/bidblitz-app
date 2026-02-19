"""
bidblitz.ae Auction Platform - Main Server
Refactored modular architecture with routers
"""
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from starlette.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import asyncio
import logging
import random
import uuid
import io
from datetime import datetime, timezone, timedelta

# Rate Limiting
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

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
from routers.wholesale_auth import router as wholesale_auth_router
from routers.friends_battle import router as friends_battle_router
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
from routers.loyalty import router as vip_loyalty_router
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
from routers.social_sharing import router as social_sharing_router
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
from routers.phone_verification import router as phone_verification_router
from routers.deal_radar import router as deal_radar_router
from routers.top_bidder import top_bidder_router
from routers.streak_protection import streak_protection_router
from routers.weekly_winners import weekly_winners_router
from routers.excitement import router as excitement_router
from routers.investor import router as investor_router
from routers.voucher_auctions import router as voucher_auctions_router
from routers.merchant_vouchers import router as merchant_vouchers_router
from routers.promo_codes import router as promo_codes_router
from routers.beginner_guarantee import router as beginner_guarantee_router
from routers.whatsapp_notifications import router as whatsapp_router
from routers.countdown_emails import router as countdown_emails_router
from routers.team_auctions import router as team_auctions_router
from routers.ai_bid_recommendations import router as ai_bid_router
from routers.auction_preview import router as auction_preview_router
from routers.social_betting import router as social_betting_router
from routers.personalized_homepage import router as personalized_router
from routers.livestream import router as livestream_router
from routers.crypto_payments import router as crypto_router
from routers.influencer_auctions import router as influencer_auctions_router
from routers.ar_preview import router as ar_preview_router
from routers.voice_debug import router as voice_debug_router
from routers.tournaments import router as tournaments_router
from routers.winner_gallery import router as winner_gallery_router
from routers.referrals import router as referrals_router
from routers.analytics import router as analytics_router
from routers.analytics_reports import router as analytics_reports_router
from routers.restaurant_portal import restaurant_portal_router
from routers.restaurant_reviews import restaurant_reviews_router
from routers.restaurant_discovery import restaurant_discovery_router
from routers.loyalty_program import loyalty_router
from routers.partner_portal import partner_portal_router
from routers.partner_stripe import partner_stripe_router
from routers.partner_verification import partner_verification_router
from routers.wise_payouts import wise_payouts_router
from routers.surveys import router as surveys_router
from routers.maintenance import router as maintenance_router
from routers.push_notifications import router as push_notifications_router
# New feature routers
from routers.live_stream import router as live_stream_router
from routers.team_bidding import router as team_bidding_router
from routers.ai_advisor import router as ai_advisor_router
from routers.duel import router as duel_router
from routers.mystery_box import router as mystery_box_router
from routers.auto_translate import auto_translate_router

# NEW: Partner Marketing Features
from routers.partner_referral import router as partner_referral_router
from routers.partner_ratings import router as partner_ratings_router
from routers.partner_qr import router as partner_qr_router
from routers.partner_flash_sales import router as partner_flash_sales_router
from routers.partner_search import router as partner_search_router
from routers.partner_social import router as partner_social_router
from routers.staff_cards import router as staff_cards_router

# NEW: BidBlitz Pay Security
from routers.security import router as security_router

# NEW: 9 additional features
from routers.bid_alarm import bid_alarm_router
from routers.welcome_bonus import welcome_bonus_router
from routers.activity_feed import activity_feed_router
from routers.tournament import tournament_router
from routers.auction_chat import auction_chat_router
from routers.recommendations import recommendations_router
from routers.watchers import watchers_router
from routers.revenge_bid import revenge_bid_router
from routers.wallet import wallet_router
from routers.bidblitz_pay import bidblitz_pay_router

# NEW: 10 additional features (batch 2)
from routers.email_marketing import email_marketing_router
from routers.winner_media import winner_media_router
from routers.bid_bundles import bid_bundles_router
from routers.vip_plans import vip_plans_router
from routers.transparency import transparency_router
from routers.user_reviews import user_reviews_router
from routers.app_store import app_store_router
from routers.affiliate_dashboard import affiliate_dashboard_router
from routers.social_media_share import social_media_share_router
from routers.user_reports import user_reports_router
from routers.daily_streak import daily_streak_router
# New gamification and revenue routers
from routers.vip_tiers import vip_tiers_router
from routers.coupons import coupons_router
from routers.duels import duels_router
from routers.flash_sales import flash_sales_router
from routers.price_alerts import price_alerts_router
from routers.bid_combo import bid_combo_router
from routers.weekly_challenge import weekly_challenge_router
from routers.birthday import birthday_router
from routers.ab_testing import ab_testing_router
from routers.fraud_detection import fraud_detection_router
from routers.winback import winback_router
from routers.abandoned_cart import abandoned_cart_router
from routers.sustainability import router as sustainability_router
from routers.microsoft_auth import microsoft_auth_router

# NEW: Admin Wallet Top-up
from routers.admin_wallet_topup import router as admin_wallet_topup_router

# NEW: Stripe Checkout for Wallet Top-up
from routers.stripe_checkout import router as stripe_checkout_router

# NEW: Partner Budget System (Freibetrag, Wise Payments)
from routers.partner_budget import router as partner_budget_router

# NEW: Credit System (Kredit-System für BidBlitz Pay)
from routers.credit_system import router as credit_router

# NEW: Cashback System
from routers.cashback_system import router as cashback_router

# NEW: Auto-Bid and Watchlist
from routers.auto_bid import auto_bid_router
from routers.watchlist import watchlist_router

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
    # Background tasks - Bot only bids on auctions < 10 minutes remaining
    asyncio.create_task(bot_last_second_bidder())
    asyncio.create_task(mystery_box_bot_bidder())
    asyncio.create_task(auction_reminder_processor())
    # asyncio.create_task(auction_auto_restart_processor())  # Disabled - auctions have manual end times
    asyncio.create_task(auction_expiry_checker())
    asyncio.create_task(day_night_auction_scheduler())
    asyncio.create_task(abandoned_cart_reminder_task())
    logger.info("BidBlitz.ae server started - Bot only bids when < 10 min remaining. Auto-restart disabled.")
    
    yield
    
    # Shutdown
    bot_task_running = False
    logger.info("bidblitz.ae server shutting down")

# ==================== APP CREATION ====================

# Initialize rate limiter
limiter = Limiter(key_func=get_remote_address)

app = FastAPI(
    title="bidblitz.ae Auction API",
    description="Penny Auction Platform",
    version="2.0.0",
    lifespan=lifespan
)

# Add rate limiter to app state
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

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
app.include_router(wholesale_auth_router, prefix="/api")
app.include_router(friends_battle_router, prefix="/api")
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
app.include_router(social_sharing_router, prefix="/api")
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
app.include_router(merchant_vouchers_router, prefix="/api")
app.include_router(promo_codes_router, prefix="/api")
app.include_router(phone_verification_router, prefix="/api")
app.include_router(deal_radar_router, prefix="/api")
app.include_router(beginner_guarantee_router, prefix="/api")
app.include_router(whatsapp_router, prefix="/api")
app.include_router(countdown_emails_router, prefix="/api")
app.include_router(team_auctions_router, prefix="/api")
app.include_router(ai_bid_router, prefix="/api")
app.include_router(auction_preview_router, prefix="/api")
app.include_router(social_betting_router, prefix="/api")
app.include_router(personalized_router, prefix="/api")
app.include_router(livestream_router, prefix="/api")
app.include_router(crypto_router, prefix="/api")
app.include_router(influencer_auctions_router, prefix="/api")
app.include_router(ar_preview_router, prefix="/api")
app.include_router(voice_debug_router)
app.include_router(tournaments_router, prefix="/api")
app.include_router(winner_gallery_router, prefix="/api")
app.include_router(referrals_router, prefix="/api")
app.include_router(analytics_router, prefix="/api")
app.include_router(analytics_reports_router)  # Has its own prefix
app.include_router(surveys_router, prefix="/api")
app.include_router(maintenance_router, prefix="/api")
app.include_router(push_notifications_router, prefix="/api")
# New feature routers
app.include_router(live_stream_router, prefix="/api")
app.include_router(team_bidding_router, prefix="/api")
app.include_router(ai_advisor_router, prefix="/api")
app.include_router(duel_router, prefix="/api")
app.include_router(mystery_box_router, prefix="/api")

# NEW: 9 additional features
app.include_router(bid_alarm_router, prefix="/api")
app.include_router(welcome_bonus_router, prefix="/api")
app.include_router(activity_feed_router, prefix="/api")
app.include_router(tournament_router, prefix="/api")
app.include_router(auction_chat_router, prefix="/api")
app.include_router(recommendations_router, prefix="/api")
app.include_router(watchers_router, prefix="/api")
app.include_router(revenge_bid_router, prefix="/api")
app.include_router(wallet_router, prefix="/api")
app.include_router(bidblitz_pay_router, prefix="/api")

# NEW: 10 additional features (batch 2)
app.include_router(email_marketing_router, prefix="/api")
app.include_router(winner_media_router, prefix="/api")
app.include_router(bid_bundles_router, prefix="/api")
app.include_router(vip_plans_router, prefix="/api")
app.include_router(transparency_router, prefix="/api")
app.include_router(user_reviews_router, prefix="/api")
app.include_router(app_store_router, prefix="/api")
app.include_router(affiliate_dashboard_router, prefix="/api")
app.include_router(social_media_share_router, prefix="/api")
app.include_router(user_reports_router, prefix="/api")
app.include_router(daily_streak_router, prefix="/api")
app.include_router(top_bidder_router, prefix="/api")
# New gamification and revenue routers
app.include_router(vip_tiers_router, prefix="/api")
app.include_router(coupons_router, prefix="/api")
app.include_router(duels_router, prefix="/api")
app.include_router(flash_sales_router, prefix="/api")
app.include_router(price_alerts_router, prefix="/api")
app.include_router(bid_combo_router, prefix="/api")
app.include_router(weekly_challenge_router, prefix="/api")
app.include_router(birthday_router, prefix="/api")
app.include_router(ab_testing_router, prefix="/api")
app.include_router(fraud_detection_router, prefix="/api")
app.include_router(winback_router, prefix="/api")
app.include_router(abandoned_cart_router, prefix="/api")
app.include_router(sustainability_router)
app.include_router(auto_translate_router, prefix="/api")
app.include_router(microsoft_auth_router, prefix="/api")
app.include_router(restaurant_portal_router, prefix="/api")
app.include_router(restaurant_reviews_router, prefix="/api")
app.include_router(restaurant_discovery_router, prefix="/api")
app.include_router(loyalty_router, prefix="/api")
app.include_router(partner_portal_router, prefix="/api")
app.include_router(partner_stripe_router, prefix="/api")
app.include_router(partner_verification_router, prefix="/api")
app.include_router(wise_payouts_router, prefix="/api")

# Partner Marketing Features
app.include_router(partner_referral_router, prefix="/api")
app.include_router(partner_ratings_router, prefix="/api")
app.include_router(partner_qr_router, prefix="/api")
app.include_router(partner_flash_sales_router, prefix="/api")
app.include_router(partner_search_router, prefix="/api")
app.include_router(partner_social_router, prefix="/api")
app.include_router(staff_cards_router, prefix="/api")

# BidBlitz Pay Security (Biometric Auth, Fraud Detection)
app.include_router(security_router, prefix="/api")

# Admin Wallet Top-up & Incentives System
app.include_router(admin_wallet_topup_router, prefix="/api/admin/wallet-topup")

# Stripe Checkout for Wallet Top-up
app.include_router(stripe_checkout_router, prefix="/api/stripe")

# Partner Budget System (Freibetrag, Wise Payments, Payouts)
app.include_router(partner_budget_router, prefix="/api")

# Credit System (Kredit-System für BidBlitz Pay)
app.include_router(credit_router, prefix="/api")

# Cashback System
app.include_router(cashback_router, prefix="/api")

# Auto-Bid and Watchlist
app.include_router(auto_bid_router, prefix="/api")
app.include_router(watchlist_router, prefix="/api")

# ==================== HEALTH & BASIC ENDPOINTS ====================

@app.get("/")
async def root():
    return {"status": "bidblitz.ae API v2.0 - Refactored"}

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

# ==================== ABANDONED CART REMINDER TASK ====================

async def abandoned_cart_reminder_task():
    """Background task to send abandoned cart reminder emails every hour"""
    from utils.email import send_abandoned_cart_reminder
    
    logger.info("Abandoned cart reminder task started")
    
    while bot_task_running:
        try:
            # Check every hour
            await asyncio.sleep(3600)  # 1 hour
            
            now = datetime.now(timezone.utc)
            # Find carts abandoned more than 1 hour ago but less than 24 hours
            cutoff_start = (now - timedelta(hours=24)).isoformat()
            cutoff_end = (now - timedelta(hours=1)).isoformat()
            
            abandoned_carts = await db.shopping_carts.find({
                "status": "active",
                "updated_at": {"$gte": cutoff_start, "$lt": cutoff_end},
                "reminder_sent": False
            }).to_list(50)
            
            sent_count = 0
            for cart in abandoned_carts:
                try:
                    user = await db.users.find_one(
                        {"id": cart["user_id"]},
                        {"email": 1, "username": 1, "first_name": 1}
                    )
                    
                    if not user or not user.get("email"):
                        continue
                    
                    user_name = user.get("first_name") or user.get("username") or "Kunde"
                    
                    # Send reminder email
                    await send_abandoned_cart_reminder(
                        to_email=user["email"],
                        user_name=user_name,
                        cart_items=cart.get("items", []),
                        cart_total=cart.get("total", 0)
                    )
                    
                    # Mark as sent
                    await db.shopping_carts.update_one(
                        {"id": cart["id"]},
                        {"$set": {
                            "reminder_sent": True,
                            "reminder_sent_at": now.isoformat()
                        }}
                    )
                    sent_count += 1
                    
                except Exception as e:
                    logger.error(f"Failed to send cart reminder: {e}")
            
            if sent_count > 0:
                logger.info(f"Sent {sent_count} abandoned cart reminders")
                
        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.error(f"Abandoned cart task error: {e}")
            await asyncio.sleep(60)  # Wait 1 minute on error

# ==================== BOT BIDDING ====================

async def bot_last_second_bidder():
    """Background task - bots bid with REALISTIC human-like patterns.
    
    LOGIK:
    1. STANDARD (normale Auktionen): Bots bieten bis €20
    2. GUTSCHEIN-AUKTIONEN: Bots bieten bis 30% des Gutscheinwertes
       - z.B. €100 Gutschein = Mindestpreis €30
    3. MIT ZIELPREIS: Bots bieten bis zum höheren Wert
    
    VERHALTEN:
    - Verschiedene Bieter pro Auktion (nicht immer derselbe Bot)
    - Zufällige Intervalle zwischen 15-90 Sekunden (realistisch)
    - Gestaffelte Gebote (nicht alle Auktionen gleichzeitig)
    - Pause-Perioden (manchmal 1-3 Minuten ohne Gebot)
    """
    global bot_task_running
    
    logger.info("Bot bidder started - Mindestpreis: €20 oder 30% bei Gutscheinen (REALISTIC MODE)")
    
    # Track last bot and bid time per auction
    last_bot_per_auction = {}
    last_bid_time_per_auction = {}
    next_bid_time_per_auction = {}  # When to place next bid
    
    # Track which bots have bid on which auctions (for rotation)
    auction_bot_history = {}  # auction_id -> list of last 5 bot IDs
    auction_start_offset = {}  # auction_id -> random offset in seconds (0-60)
    
    # Products cache - refreshed every 5 minutes
    products_cache = {}
    products_cache_time = 0
    CACHE_TTL = 300  # 5 minutes
    
    # MINIMUM price for NORMAL auctions - €25 (für echte Einnahmen)
    MINIMUM_AUCTION_PRICE = 25.00
    
    # GUTSCHEIN-AUKTIONEN: 30% des Retail-Preises
    VOUCHER_MIN_PERCENTAGE = 0.30  # 30%
    
    # Default price range for normal auctions (25.00 - 35.00 Euro)
    DEFAULT_MIN_PRICE = 25.00
    DEFAULT_MAX_PRICE = 35.00
    
    # REALISTIC timing - vary between auctions
    MIN_BID_INTERVAL = 15.0   # Minimum 15 seconds between bids
    MAX_BID_INTERVAL = 90.0   # Maximum 1.5 minutes between bids
    PAUSE_CHANCE = 0.15       # 15% chance of longer pause (2-4 minutes)
    
    # VARIABILITY FACTORS - make each auction unique
    auction_variability = {}  # auction_id -> {phase1_target, final_target_offset, bid_speed}
    
    def get_auction_variability(auction_id, retail_price):
        """Generate unique variability for each auction to avoid predictable patterns"""
        if auction_id not in auction_variability:
            # Use auction_id hash for consistent but unique values
            hash_val = hash(auction_id)
            
            # Phase 1 target: varies between €2.50 - €4.50 (not always €3.00)
            phase1_base = 3.00
            phase1_offset = ((hash_val % 200) - 100) / 100.0  # -1.00 to +1.00
            phase1_target = max(2.50, min(4.50, phase1_base + phase1_offset))
            
            # Final target offset: -15% to +25% variation
            final_offset_pct = ((hash_val % 40) - 15) / 100.0  # -0.15 to +0.25
            
            # Bid speed factor: 0.7x to 1.5x (some auctions are faster)
            speed_factor = 0.7 + ((hash_val % 80) / 100.0)  # 0.7 to 1.5
            
            # Time extension variation: 8-18 seconds (not always 10-15)
            time_ext_min = 8 + (hash_val % 5)  # 8-12
            time_ext_max = 13 + (hash_val % 6)  # 13-18
            
            auction_variability[auction_id] = {
                'phase1_target': round(phase1_target, 2),
                'final_offset_pct': final_offset_pct,
                'speed_factor': speed_factor,
                'time_ext_min': time_ext_min,
                'time_ext_max': time_ext_max
            }
        return auction_variability[auction_id]
    
    while bot_task_running:
        try:
            now = datetime.now(timezone.utc)
            now_ts = now.timestamp()
            
            # Refresh products cache every 5 minutes
            if now_ts - products_cache_time > CACHE_TTL:
                all_products = await db.products.find({}, {"_id": 0, "id": 1, "retail_price": 1, "name": 1, "category": 1}).to_list(500)
                products_cache = {p["id"]: p for p in all_products}
                products_cache_time = now_ts
                logger.info(f"Products cache refreshed: {len(products_cache)} products")
            
            # Get ALL active auctions
            active_auctions = await db.auctions.find({
                "status": "active"
            }, {"_id": 0}).to_list(200)
            
            # Initialize random offsets for new auctions (to desync bot bidding)
            for auction in active_auctions:
                aid = auction.get("id")
                if aid and aid not in auction_start_offset:
                    # Each auction gets a random offset so bots don't bid simultaneously
                    auction_start_offset[aid] = random.uniform(0, 90)
            
            # PRIORITIZE auctions ending soon - ALWAYS process these first!
            # This is CRITICAL to prevent auctions ending at €0.02
            # NOTE: Only consider auctions ending within 10 minutes
            urgent_auctions = []
            super_urgent_auctions = []
            
            for a in active_auctions:
                try:
                    end_time = datetime.fromisoformat(a["end_time"].replace("Z", "+00:00"))
                    seconds_left = (end_time - now).total_seconds()
                    current_price = float(a.get("current_price", 0))
                    
                    # Skip auctions that are more than 10 minutes away
                    if seconds_left > 600:
                        continue
                    
                    # SUPER URGENT: < 15 seconds AND price < €25
                    if seconds_left < 15 and current_price < 25:
                        super_urgent_auctions.append(a)
                        logger.warning(f"🚨🚨 SUPER URGENT AUCTION: {a.get('title', 'Unknown')[:30]} - €{current_price:.2f} - {seconds_left:.0f}s left!")
                    # URGENT: < 60 seconds AND price < €20
                    elif seconds_left < 60 and current_price < 20:
                        urgent_auctions.append(a)
                        logger.warning(f"🚨 URGENT AUCTION: {a.get('title', 'Unknown')[:30]} - €{current_price:.2f} - {seconds_left:.0f}s left!")
                    # MODERATE URGENT: < 120 seconds AND price < €10
                    elif seconds_left < 120 and current_price < 10:
                        urgent_auctions.append(a)
                except:
                    pass
            
            # Then shuffle and take some non-urgent ones
            non_urgent = [a for a in active_auctions if a not in urgent_auctions and a not in super_urgent_auctions]
            random.shuffle(non_urgent)
            
            # Process ALL super-urgent FIRST, then urgent, then up to 5 non-urgent
            auctions_to_process = super_urgent_auctions + urgent_auctions + non_urgent[:5]
            
            for auction in auctions_to_process:
                try:
                    auction_id = auction.get("id")
                    
                    # IMPORTANT: Re-check if auction is still active in DB
                    # This prevents bidding on auctions that were just ended
                    current_auction = await db.auctions.find_one(
                        {"id": auction_id, "status": "active"},
                        {"_id": 0, "end_time": 1, "current_price": 1, "bid_increment": 1, "is_fixed_end": 1, "total_bids": 1, "bid_count": 1}
                    )
                    
                    if not current_auction:
                        # Auction no longer active, skip
                        continue
                    
                    # Use fresh data from DB - recalculate time
                    end_time = datetime.fromisoformat(current_auction["end_time"].replace("Z", "+00:00"))
                    now = datetime.now(timezone.utc)  # Refresh now timestamp
                    seconds_left = (end_time - now).total_seconds()
                    
                    if seconds_left <= 0:
                        continue
                    
                    # IMPORTANT: Skip auctions that are more than 10 minutes away
                    # This allows auctions with long end times (2-3 days) to run their natural course
                    if seconds_left > 600:  # More than 10 minutes
                        continue
                    
                    # Use fresh data from current_auction
                    current_price = current_auction.get("current_price", 0)
                    bid_increment = current_auction.get("bid_increment", 0.01)
                    
                    # CRITICAL: Check if this is SUPER URGENT (< 15 seconds) and price < €25
                    # If so, BID IMMEDIATELY without any other checks!
                    is_emergency = seconds_left < 15 and current_price < 25
                    
                    if is_emergency:
                        # EMERGENCY BID - No other checks, just bid NOW!
                        # Get a random bot from the bots list
                        if not bots:
                            logger.error("No bots available for emergency bid!")
                            continue
                        random_bot = random.choice(bots)
                        new_price = round(current_price + bid_increment, 2)
                        
                        # Extend timer by 10-15 seconds
                        timer_extension = random.randint(10, 15)
                        new_end_time = now + timedelta(seconds=timer_extension)
                        
                        await db.auctions.update_one(
                            {"id": auction_id, "status": "active"},
                            {"$set": {
                                "current_price": new_price,
                                "last_bidder": random_bot["name"],
                                "last_bidder_id": f"bot_{random_bot['id']}",
                                "end_time": new_end_time.isoformat(),
                                "last_bid_time": now.isoformat()
                            }, "$inc": {"bid_count": 1, "total_bids": 1}}
                        )
                        
                        logger.warning(f"🚨🚨 EMERGENCY BID! Bot '{random_bot['name']}' saved auction {auction_id[:8]} at €{new_price:.2f} with only {seconds_left:.0f}s left!")
                        
                        # Broadcast update
                        await broadcast_bid_update(auction_id, {
                            "current_price": new_price,
                            "last_bidder": random_bot["name"],
                            "end_time": new_end_time.isoformat(),
                            "bid_count": current_auction.get("bid_count", 0) + 1,
                            "bidder_message": f"🚨 {random_bot['name']} hat geboten!"
                        })
                        continue  # Move to next auction
                    
                    # These can still come from the original auction object (less critical)
                    explicit_target = auction.get("bot_target_price", 0)
                    retail_price = auction.get("retail_price", 0)
                    is_free_auction = auction.get("is_free_auction", False)
                    
                    # ============================================
                    # GEWINNER-KONTROLLE SYSTEM
                    # - guaranteed_winner_bidding: Manuell vom Admin gesetzter Gewinner
                    # - let_customer_win: Automatisch - dieser Kunde soll gewinnen (10%)
                    # - Wenn keins gesetzt: Bots gewinnen (90%)
                    # ============================================
                    
                    guaranteed_winner_id = auction.get("guaranteed_winner_bidding")
                    let_customer_win_id = auction.get("let_customer_win")
                    
                    # Wenn ein garantierter Gewinner gesetzt ist und dieser gerade führt -> nicht bieten
                    if guaranteed_winner_id:
                        if auction.get("last_bidder_id") == guaranteed_winner_id:
                            # Gewinner führt bereits - Bots stoppen
                            continue
                        # Gewinner führt nicht - Bots bieten NICHT, warten dass Gewinner bietet
                        # Aber nur in den letzten 30 Sekunden stoppen
                        if seconds_left < 30:
                            continue
                    
                    # Wenn ein Kunde gewinnen soll (automatisch 10%)
                    if let_customer_win_id:
                        if auction.get("last_bidder_id") == let_customer_win_id:
                            # Kunde führt - Bots stoppen
                            continue
                        # In letzten 30 Sekunden nicht mehr bieten wenn Kunde gewinnen soll
                        if seconds_left < 30:
                            continue
                    
                    # Check if it's time for next bid on this auction
                    next_bid_at = next_bid_time_per_auction.get(auction_id, 0)
                    
                    # Apply per-auction offset to desync bidding
                    auction_offset = auction_start_offset.get(auction_id, 0)
                    
                    # ============================================
                    # NEUE BOT-LOGIK: 2-Phasen-System (REALISTISCH)
                    # Phase 1: Früh bieten bis €3-3,50 (variiert pro Bot)
                    # Pause: Zwischen €3,50 und letzten 2-3 Minuten
                    # Phase 2: Endspurt - letzte 2-3 Minuten bis €25
                    # WICHTIG: Wenn Zeit knapp wird, IMMER bieten!
                    # ============================================
                    
                    # Get product info first for variability calculation
                    product_id = auction.get("product_id")
                    product = products_cache.get(product_id) if product_id else None
                    retail_price = product.get("retail_price", 0) if product else 0
                    
                    # RESTAURANT-AUKTIONEN: Prüfe eingebettetes Produkt
                    if not retail_price and auction.get("product"):
                        embedded_product = auction.get("product", {})
                        retail_price = embedded_product.get("retail_price", 0)
                    
                    # Get auction-specific variability for natural behavior
                    var = get_auction_variability(auction_id, retail_price)
                    
                    # Phase 1 Target: Now varies per auction (€2.50 - €4.50)
                    PHASE1_TARGET = var['phase1_target']
                    
                    # Endspurt Zeit: varies between 100 and 200 seconds
                    base_endspurt = 150
                    ENDSPURT_TIME = int(base_endspurt * var['speed_factor'])
                    ENDSPURT_TIME = max(100, min(200, ENDSPURT_TIME))
                    
                    # ============================================
                    # KURZE AUKTIONEN: Wenn Gesamtdauer < 15 Min, sofort aggressiv bieten!
                    # ============================================
                    auction_duration = auction.get("duration_seconds", 0)
                    is_short_auction = auction_duration > 0 and auction_duration < 900  # < 15 Minuten
                    
                    if is_short_auction:
                        # Bei kurzen Auktionen: Keine Pause-Phase, sofort bis Target bieten
                        PHASE1_TARGET = 0  # Überspringen Phase 1
                        ENDSPURT_TIME = auction_duration  # Immer im "Endspurt"
                        logger.debug(f"🚀 Short auction detected ({auction_duration}s): Aggressive bidding mode for {auction_id[:8]}")
                    
                    # FALLBACK: Nutze bot_target_price wenn gesetzt
                    explicit_target = auction.get("bot_target_price")
                    
                    # Berechne Target basierend auf UVP mit VARIABILITÄT
                    # Faustregel: ~3-8% des UVP als Mindest-Endpreis
                    # PLUS auction-specific offset für natürliche Variation
                    if retail_price >= 2000:
                        # Premium: €2000+ UVP → €100-150 Target
                        base_target = max(100, retail_price * 0.05)  # 5% von UVP
                    elif retail_price >= 1000:
                        # High-End: €1000-2000 UVP → €60-100 Target
                        base_target = max(60, retail_price * 0.05)  # 5% von UVP
                    elif retail_price >= 500:
                        # Mid-Range: €500-1000 UVP → €35-60 Target
                        base_target = max(35, retail_price * 0.06)  # 6% von UVP
                    elif retail_price >= 200:
                        # Budget: €200-500 UVP → €20-35 Target
                        base_target = max(20, retail_price * 0.07)  # 7% von UVP
                    elif retail_price >= 100:
                        # Low: €100-200 UVP → €15-20 Target
                        base_target = max(15, retail_price * 0.08)  # 8% von UVP
                    else:
                        # Günstig: < €100 UVP → €10-15 Target
                        base_target = max(10, retail_price * 0.10)  # 10% von UVP
                    
                    # Apply auction-specific variation (-15% to +25%)
                    FINAL_TARGET = base_target * (1 + var['final_offset_pct'])
                    
                    # Minimum €10, Maximum €200
                    FINAL_TARGET = max(10.0, min(200.0, FINAL_TARGET))
                    FINAL_TARGET = round(FINAL_TARGET, 2)
                    
                    # Determine which phase we're in
                    in_phase1 = current_price < PHASE1_TARGET
                    in_endspurt = seconds_left <= ENDSPURT_TIME
                    
                    # CRITICAL: Wenn Zeit knapp wird, SOFORT bieten!
                    # < 60 Sekunden und Preis unter Ziel = URGENT
                    is_urgent = seconds_left < 60 and current_price < FINAL_TARGET
                    # < 15 Sekunden = SUPER URGENT
                    is_super_urgent = seconds_left < 15 and current_price < FINAL_TARGET
                    
                    # Skip if not time yet (unless urgent) - apply offset
                    effective_next_bid = next_bid_at + (auction_offset if next_bid_at == 0 else 0)
                    if now_ts < effective_next_bid and not is_urgent and not is_super_urgent:
                        continue
                    
                    should_bid = False
                    target_price = FINAL_TARGET  # Default target ist immer €25
                    
                    # SUPER URGENT: Wenn weniger als 15 Sekunden, SOFORT bieten!
                    if is_super_urgent:
                        should_bid = True
                        target_price = max(FINAL_TARGET, 25.0)  # Mindestens €25
                        logger.warning(f"🚨 SUPER URGENT: Auction {auction_id[:8]} at €{current_price:.2f} with only {seconds_left:.0f}s left! BIDDING NOW!")
                    
                    # URGENT: Wenn weniger als 60 Sekunden und Preis zu niedrig
                    elif is_urgent:
                        should_bid = True
                        target_price = max(FINAL_TARGET, 20.0)  # Mindestens €20
                        logger.warning(f"🚨 URGENT: Auction {auction_id[:8]} at €{current_price:.2f} with {seconds_left:.0f}s left! BIDDING!")
                    
                    # PHASE 1: Früh bieten bis €3-3,50
                    elif in_phase1 and not in_endspurt:
                        # Bots bieten langsam bis Phase 1 Target
                        target_price = PHASE1_TARGET
                        should_bid = True
                    
                    # PAUSE PHASE: Zwischen €3-3,50 und Endspurt - NICHT bieten
                    # Hier sollen echte Nutzer bieten
                    # ABER: Wenn weniger als 300 Sek (5 Min) übrig sind, trotzdem bieten!
                    elif current_price >= PHASE1_TARGET and not in_endspurt:
                        # Wenn weniger als 5 Minuten übrig, trotzdem bieten um Auktion nicht zu verlieren
                        if seconds_left < 300:
                            should_bid = True
                            target_price = FINAL_TARGET
                        else:
                            # Warten auf Endspurt - echte Nutzer sollen bieten
                            should_bid = False
                    
                    # PHASE 2: Endspurt - letzte 2-3 Minuten
                    elif in_endspurt and current_price < FINAL_TARGET:
                        # Aggressiv bieten bis €25
                        target_price = FINAL_TARGET
                        should_bid = True
                    
                    # SAFETY NET: Verhindert zu niedrige Endpreise
                    # AGGRESSIV: Wenn Preis unter €5 und Zeit knapp wird
                    if current_price < 5.00 and seconds_left < 120:
                        should_bid = True
                        target_price = FINAL_TARGET
                        logger.warning(f"⚠️ SAFETY BID (€5): Auction {auction_id[:8]} at €{current_price:.2f} with {seconds_left:.0f}s left!")
                    
                    # EXTRA SAFETY: Wenn Zeit < 60 Sek und Preis < €10, IMMER bieten!
                    if seconds_left < 60 and current_price < 10.00:
                        should_bid = True
                        target_price = FINAL_TARGET
                        logger.warning(f"⚠️ SAFETY BID (€10): Auction {auction_id[:8]} at €{current_price:.2f} with {seconds_left:.0f}s left!")
                    
                    # KRITISCH: Wenn Zeit < 30 Sek und Preis < FINAL_TARGET, SOFORT bieten!
                    if seconds_left < 30 and current_price < FINAL_TARGET:
                        should_bid = True
                        target_price = FINAL_TARGET
                        logger.warning(f"🚨 CRITICAL BID: Auction {auction_id[:8]} at €{current_price:.2f} with only {seconds_left:.0f}s left! Target: €{FINAL_TARGET:.2f}")
                    
                    # Override mit explicit_target wenn höher
                    if explicit_target and explicit_target > target_price:
                        target_price = explicit_target
                        if current_price < target_price and in_endspurt:
                            should_bid = True
                    
                    if should_bid:
                        bots = await db.bots.find({}, {"_id": 0}).to_list(100)
                        if bots:
                            # Get history of bots that already bid on this auction
                            history = auction_bot_history.get(auction_id, [])
                            last_bot_id = last_bot_per_auction.get(auction_id)
                            
                            # Exclude bots that bid recently on this auction
                            available = [b for b in bots if b["id"] not in history[-3:] and b["id"] != last_bot_id]
                            if not available:
                                available = [b for b in bots if b["id"] != last_bot_id]
                            if not available:
                                available = bots
                            
                            bot = random.choice(available)
                            
                            # Update tracking
                            last_bot_per_auction[auction_id] = bot["id"]
                            last_bid_time_per_auction[auction_id] = now_ts
                            
                            # Update bot history for this auction
                            if auction_id not in auction_bot_history:
                                auction_bot_history[auction_id] = []
                            auction_bot_history[auction_id].append(bot["id"])
                            if len(auction_bot_history[auction_id]) > 10:
                                auction_bot_history[auction_id] = auction_bot_history[auction_id][-10:]
                            
                            # Calculate NEXT bid time (REALISTISCHES Intervall)
                            # Verschiedene Bot-Persönlichkeiten
                            bot_personality = hash(bot["id"]) % 3  # 0=schnell, 1=normal, 2=langsam
                            
                            # SUPER URGENT: Wenn < 30 Sekunden, SEHR schnell bieten
                            if seconds_left < 30:
                                next_interval = random.uniform(2, 5)  # Sehr schnell!
                            # URGENT: Wenn < 60 Sekunden, schnell bieten
                            elif seconds_left < 60:
                                next_interval = random.uniform(3, 10)  # Schnell!
                            # Im Endspurt generell schneller
                            elif in_endspurt and seconds_left < 120:
                                next_interval = random.uniform(5, 20)  # Letzte 2 Minuten
                            elif random.random() < PAUSE_CHANCE:
                                # Längere Pause (1-4 Minuten) - wie echte Nutzer
                                next_interval = random.uniform(60, 240)
                            else:
                                # Bot-Persönlichkeit bestimmt Biet-Geschwindigkeit
                                if bot_personality == 0:  # Schneller Bieter
                                    base_interval = random.uniform(15, 60)
                                elif bot_personality == 1:  # Normaler Bieter
                                    base_interval = random.uniform(30, 120)
                                else:  # Langsamer/Vorsichtiger Bieter
                                    base_interval = random.uniform(60, 180)
                                
                                # Apply auction-specific speed factor for variability
                                next_interval = base_interval * var['speed_factor']
                                # Add additional randomness
                                next_interval *= random.uniform(0.8, 1.3)
                            
                            next_bid_time_per_auction[auction_id] = now_ts + next_interval
                            
                            new_price = round(current_price + bid_increment, 2)
                            
                            # CHECK: Is this a FIXED END auction?
                            is_fixed_end = current_auction.get("is_fixed_end", False)
                            
                            if is_fixed_end:
                                # FIXED END: Endzeit bleibt unverändert
                                new_end_time = end_time
                            else:
                                # Normal: Timer reset with VARIABLE extension (8-18 seconds)
                                timer_ext = random.randint(var['time_ext_min'], var['time_ext_max'])
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
                            
                            # Determine phase for logging
                            if is_super_urgent or is_urgent:
                                phase_name = f"⚠️ URGENT ({seconds_left:.0f}s left!)"
                            elif current_price < PHASE1_TARGET:
                                phase_name = f"Phase1 (bis €{PHASE1_TARGET:.2f})"
                            else:
                                phase_name = f"Endspurt (bis €{FINAL_TARGET:.0f})"
                            
                            # Log mit UVP-Info wenn verfügbar - zeige immer FINAL_TARGET
                            uvp_info = f", UVP €{retail_price:.0f}" if retail_price > 0 else ""
                            logger.info(f"🤖 Bot '{bot['name']}' bid €{new_price:.2f} [{phase_name}] (target: €{FINAL_TARGET:.2f}{uvp_info}, {seconds_left:.0f}s left, next in {next_interval:.0f}s)")
                            
                except Exception as e:
                    logger.error(f"Bot bid error for {auction.get('id')}: {e}")
            
            # Small sleep between cycles
            await asyncio.sleep(2)
            
        except Exception as e:
            logger.error(f"Bot bidder error: {e}")
            await asyncio.sleep(5)
    
    logger.info("Bot bidder stopped")


async def mystery_box_bot_bidder():
    """Background task - bots bid on mystery boxes to make them interesting.
    
    Mystery Boxes need bot activity to:
    1. Keep the auctions active and interesting
    2. Ensure prices reach reasonable levels
    3. Create competition for real users
    """
    global bot_task_running
    
    logger.info("🎁 Mystery Box Bot bidder started")
    
    # Track last bot and bid time per mystery box
    last_bot_per_box = {}
    last_bid_time_per_box = {}
    next_bid_time_per_box = {}
    
    # Price targets based on tier
    TIER_TARGETS = {
        "bronze": 15.00,   # Bronze: Target €15
        "silver": 25.00,   # Silver: Target €25
        "gold": 40.00,     # Gold: Target €40
        "diamond": 60.00   # Diamond: Target €60
    }
    
    while bot_task_running:
        try:
            now = datetime.now(timezone.utc)
            now_ts = now.timestamp()
            
            # Get all active mystery boxes
            active_boxes = await db.mystery_boxes.find({
                "status": "active"
            }).to_list(50)
            
            if not active_boxes:
                await asyncio.sleep(10)
                continue
            
            # Get available bots
            bots = await db.bots.find({}, {"_id": 0}).to_list(100)
            if not bots:
                await asyncio.sleep(10)
                continue
            
            for box in active_boxes:
                try:
                    box_id = str(box.get("_id"))
                    tier = box.get("tier", "bronze")
                    target_price = TIER_TARGETS.get(tier, 15.00)
                    current_price = float(box.get("current_price", 0))
                    
                    # Parse end time
                    end_time_str = box.get("end_time")
                    if not end_time_str:
                        continue
                    
                    end_time = datetime.fromisoformat(end_time_str.replace("Z", "+00:00"))
                    seconds_left = (end_time - now).total_seconds()
                    
                    if seconds_left <= 0:
                        continue  # Auction ended
                    
                    # Decide if bot should bid
                    should_bid = False
                    
                    # Check if it's time for next bid
                    next_bid_time = next_bid_time_per_box.get(box_id, 0)
                    if now_ts < next_bid_time:
                        continue  # Not yet time for next bid
                    
                    # EMERGENCY: Very low time and low price
                    if seconds_left < 30 and current_price < target_price:
                        should_bid = True
                        logger.warning(f"🎁🚨 MYSTERY EMERGENCY: {tier} Box at €{current_price:.2f} with only {seconds_left:.0f}s left!")
                    
                    # URGENT: Low time and price below target
                    elif seconds_left < 120 and current_price < target_price * 0.5:
                        should_bid = True
                    
                    # NORMAL: Price below target and random chance
                    elif current_price < target_price and random.random() < 0.3:
                        should_bid = True
                    
                    # Price already at target - only bid if urgent
                    elif current_price >= target_price:
                        if seconds_left < 60 and random.random() < 0.15:
                            should_bid = True  # Small chance to continue bidding
                    
                    if should_bid:
                        # Select bot (different from last one)
                        last_bot_id = last_bot_per_box.get(box_id)
                        available_bots = [b for b in bots if b["id"] != last_bot_id]
                        if not available_bots:
                            available_bots = bots
                        
                        bot = random.choice(available_bots)
                        
                        # Calculate new price
                        bid_increment = 0.01
                        new_price = round(current_price + bid_increment, 2)
                        
                        # Extend timer
                        timer_extension = random.randint(10, 20)
                        new_end_time = now + timedelta(seconds=seconds_left + timer_extension)
                        
                        # Update mystery box
                        from bson import ObjectId
                        await db.mystery_boxes.update_one(
                            {"_id": ObjectId(box_id)},
                            {
                                "$set": {
                                    "current_price": new_price,
                                    "last_bidder": bot["name"],
                                    "last_bidder_id": f"bot_{bot['id']}",
                                    "end_time": new_end_time.isoformat(),
                                    "last_bid_time": now.isoformat()
                                },
                                "$inc": {"total_bids": 1},
                                "$push": {
                                    "bids": {
                                        "id": str(uuid.uuid4()),
                                        "bidder_name": bot["name"],
                                        "bidder_id": f"bot_{bot['id']}",
                                        "price": new_price,
                                        "created_at": now.isoformat()
                                    }
                                }
                            }
                        )
                        
                        # Track bot
                        last_bot_per_box[box_id] = bot["id"]
                        last_bid_time_per_box[box_id] = now_ts
                        
                        # Calculate next bid time
                        if seconds_left < 60:
                            next_interval = random.uniform(3, 10)  # Fast bidding
                        elif seconds_left < 180:
                            next_interval = random.uniform(10, 30)  # Medium pace
                        else:
                            next_interval = random.uniform(30, 90)  # Slow pace
                        
                        next_bid_time_per_box[box_id] = now_ts + next_interval
                        
                        logger.info(f"🎁 Bot '{bot['name']}' bid €{new_price:.2f} on {tier} Mystery Box (target: €{target_price:.2f}, {seconds_left:.0f}s left)")
                
                except Exception as e:
                    logger.error(f"Mystery box bot error for {box.get('_id')}: {e}")
            
            # Sleep between cycles
            await asyncio.sleep(5)
            
        except Exception as e:
            logger.error(f"Mystery box bot bidder error: {e}")
            await asyncio.sleep(10)
    
    logger.info("🎁 Mystery Box Bot bidder stopped")


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
                    # Check if auto_restart is enabled
                    auto_restart_raw = auction.get("auto_restart")
                    
                    # Handle different formats: bool, dict, or None
                    auto_restart_enabled = False
                    if isinstance(auto_restart_raw, bool):
                        auto_restart_enabled = auto_restart_raw
                    elif isinstance(auto_restart_raw, dict):
                        auto_restart_enabled = auto_restart_raw.get("enabled", True)
                    else:
                        # Default: ONLY restart if auto_restart is explicitly enabled
                        # This prevents creating new auctions with wrong times
                        auto_restart_enabled = False
                    
                    # Skip if auto_restart is not explicitly enabled
                    if auto_restart_enabled is False or auto_restart_enabled is None:
                        continue
                    
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
                    
                    # Get original duration from the auto_restart config or restaurant auction settings
                    if isinstance(auto_restart_raw, dict):
                        auto_restart = auto_restart_raw
                    else:
                        auto_restart = {}
                    
                    # For restaurant auctions, use auto_restart_duration (in hours)
                    duration_hours = auction.get("auto_restart_duration") or auction.get("original_duration_hours")
                    if duration_hours:
                        duration_minutes = duration_hours * 60
                    else:
                        duration_minutes = auto_restart.get("duration_minutes")
                    
                    # MINIMUM 10 HOURS (600 minutes) for auto-restart
                    MIN_DURATION_MINUTES = 600  # 10 hours
                    if not duration_minutes or duration_minutes < MIN_DURATION_MINUTES:
                        duration_minutes = MIN_DURATION_MINUTES
                    
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
                    
                    # SAVE TO AUCTION HISTORY before restarting (for "Ende" tab)
                    history_entry = {
                        "id": str(uuid.uuid4()),
                        "auction_id": auction["id"],
                        "product_id": auction.get("product_id"),
                        "product": auction.get("product"),
                        "winner_id": auction.get("winner_id"),
                        "winner_name": auction.get("winner_name"),
                        "final_price": auction.get("final_price") or auction.get("current_price"),
                        "total_bids": auction.get("total_bids", 0),
                        "ended_at": auction.get("ended_at") or now.isoformat(),
                        "started_at": auction.get("start_time"),
                        "is_night_auction": auction.get("is_night_auction", False),
                        "is_beginner_auction": auction.get("is_beginner_auction", False),
                        "is_voucher_auction": auction.get("is_voucher_auction", False),
                        "is_vip_only": auction.get("is_vip_only", False),
                    }
                    await db.auction_history.insert_one(history_entry)
                    
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
                    
                    # Check if winner is a bot
                    is_bot_winner = False
                    if winner_id:
                        if winner_id.startswith("bot_"):
                            is_bot_winner = True
                        else:
                            winner_user = await db.users.find_one({"id": winner_id}, {"_id": 0, "is_bot": 1})
                            is_bot_winner = winner_user.get("is_bot", False) if winner_user else False
                    
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
                        
                        # Send partner notification if product is a voucher and winner is NOT a bot
                        if product and product.get("partner_id") and not is_bot_winner:
                            try:
                                from services.winner_notifications import send_partner_voucher_sold_notification
                                await send_partner_voucher_sold_notification(product, winner_name or "Kunde", final_price)
                            except Exception as partner_email_error:
                                logger.error(f"Failed to send partner notification: {partner_email_error}")
                    
                    product_name = product.get("name") if product else auction_id[:8]
                    logger.info(f"⏱️ Expired auction ended: {product_name} | Winner: {winner_name or 'None'} | Final: €{final_price}")
                    
                    # Broadcast auction ended via WebSocket
                    try:
                        from services.websocket import broadcast_auction_ended
                        await broadcast_auction_ended(auction_id, winner_name or "Kein Gewinner", final_price)
                    except Exception as ws_error:
                        logger.error(f"Failed to broadcast auction ended: {ws_error}")
                    
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



async def send_night_auction_notifications(night_auctions: list):
    """Send notifications to users who have bid on night auctions that are now active"""
    try:
        now = datetime.now(timezone.utc).isoformat()
        auction_ids = [a["id"] for a in night_auctions]
        
        # Find users who have bid on these auctions and want notifications
        bidders = await db.bids.aggregate([
            {"$match": {"auction_id": {"$in": auction_ids}}},
            {"$group": {"_id": "$user_id", "auctions": {"$addToSet": "$auction_id"}}}
        ]).to_list(1000)
        
        if not bidders:
            logger.info("🌙 No bidders to notify for night auctions")
            return
        
        # Get user preferences
        user_ids = [b["_id"] for b in bidders]
        prefs = await db.notification_preferences.find(
            {"user_id": {"$in": user_ids}},
            {"_id": 0, "user_id": 1, "night_auction_start": 1}
        ).to_list(1000)
        
        # Create a set of users who want night notifications (default is True)
        pref_map = {p["user_id"]: p.get("night_auction_start", True) for p in prefs}
        
        # Create notifications for each bidder
        notifications = []
        for bidder in bidders:
            user_id = bidder["_id"]
            
            # Skip if user has disabled night notifications
            if not pref_map.get(user_id, True):
                continue
            
            # Skip bots
            user = await db.users.find_one({"id": user_id}, {"_id": 0, "is_bot": 1})
            if user and user.get("is_bot"):
                continue
            
            auction_count = len(bidder["auctions"])
            
            # Create notification
            notification = {
                "id": str(uuid.uuid4()),
                "user_id": user_id,
                "title": "🌙 Deine Nacht-Auktionen sind jetzt aktiv!",
                "message": f"{auction_count} Auktion(en), auf die du geboten hast, {'ist' if auction_count == 1 else 'sind'} jetzt live. Viel Erfolg!",
                "type": "auction",
                "link": "/auctions?filter=nacht",
                "read": False,
                "created_at": now
            }
            notifications.append(notification)
        
        if notifications:
            await db.notifications.insert_many(notifications)
            logger.info(f"🌙 Sent {len(notifications)} night auction notifications")
        
    except Exception as e:
        logger.error(f"Error sending night auction notifications: {e}")


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
                    
                    # Resume night auctions - extend end_time by remaining paused time or minimum 2 hours
                    # This preserves the auction's intended duration rather than resetting to 10 minutes
                    night_auctions = await db.auctions.find(
                        {"status": "night_paused", "is_night_auction": True},
                        {"_id": 0, "id": 1, "paused_at": 1, "end_time": 1}
                    ).to_list(500)
                    
                    for auction in night_auctions:
                        # Calculate how much time was remaining when paused
                        paused_at = auction.get("paused_at")
                        original_end = auction.get("end_time")
                        
                        # Default: extend by 2 hours minimum
                        new_end_time = datetime.now(timezone.utc) + timedelta(hours=2)
                        
                        if paused_at and original_end:
                            try:
                                paused_time = datetime.fromisoformat(paused_at.replace("Z", "+00:00"))
                                end_time = datetime.fromisoformat(original_end.replace("Z", "+00:00"))
                                remaining_time = (end_time - paused_time).total_seconds()
                                
                                # If auction was supposed to run longer, preserve that
                                if remaining_time > 7200:  # More than 2 hours
                                    new_end_time = datetime.now(timezone.utc) + timedelta(seconds=remaining_time)
                            except:
                                pass
                        
                        await db.auctions.update_one(
                            {"id": auction["id"]},
                            {"$set": {
                                "status": "active",
                                "end_time": new_end_time.isoformat()
                            }}
                        )
                    
                    logger.info(f"🌙 Night mode: Paused {day_result.modified_count} day auctions, Resumed {len(night_auctions)} night auctions")
                    
                else:
                    # DAY MODE: Resume day auctions, pause night auctions
                    logger.info("☀️ Switching to DAY MODE - Resuming day auctions, pausing night auctions")
                    
                    # Pause all night auctions
                    night_result = await db.auctions.update_many(
                        {"status": "active", "is_night_auction": True},
                        {"$set": {"status": "night_paused", "paused_at": datetime.now(timezone.utc).isoformat()}}
                    )
                    
                    # Resume day auctions with preserved timer (or minimum 2 hours)
                    day_auctions = await db.auctions.find(
                        {"status": "day_paused"},
                        {"_id": 0, "id": 1, "paused_at": 1, "end_time": 1}
                    ).to_list(500)
                    
                    for auction in day_auctions:
                        # Calculate how much time was remaining when paused
                        paused_at = auction.get("paused_at")
                        original_end = auction.get("end_time")
                        
                        # Default: extend by 2 hours minimum
                        new_end_time = datetime.now(timezone.utc) + timedelta(hours=2)
                        
                        if paused_at and original_end:
                            try:
                                paused_time = datetime.fromisoformat(paused_at.replace("Z", "+00:00"))
                                end_time = datetime.fromisoformat(original_end.replace("Z", "+00:00"))
                                remaining_time = (end_time - paused_time).total_seconds()
                                
                                # If auction was supposed to run longer, preserve that
                                if remaining_time > 7200:  # More than 2 hours
                                    new_end_time = datetime.now(timezone.utc) + timedelta(seconds=remaining_time)
                            except:
                                pass
                        
                        await db.auctions.update_one(
                            {"id": auction["id"]},
                            {"$set": {
                                "status": "active",
                                "end_time": new_end_time.isoformat()
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
    elements.append(Paragraph("bidblitz.ae", title_style))
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
