import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent / '.env')

import logging
import traceback
from datetime import datetime, timezone

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.middleware.cors import CORSMiddleware
from slowapi.errors import RateLimitExceeded

from core.config import APP_ENV, IS_PRODUCTION
from core.database import db, create_indexes, close_connection
from core.security import hash_password, verify_password
from core.rate_limit import limiter

# ── Structured Logging ──
from logging.handlers import RotatingFileHandler

LOG_DIR = Path(__file__).parent / "logs"
LOG_DIR.mkdir(exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("bidblitz")

# Error log file (rotates at 5MB, keeps 5 files)
err_handler = RotatingFileHandler(LOG_DIR / "error.log", maxBytes=5_000_000, backupCount=5)
err_handler.setLevel(logging.ERROR)
err_handler.setFormatter(logging.Formatter("%(asctime)s [%(levelname)s] %(name)s: %(message)s"))
logger.addHandler(err_handler)

# Access log file
access_handler = RotatingFileHandler(LOG_DIR / "access.log", maxBytes=5_000_000, backupCount=3)
access_handler.setLevel(logging.INFO)
access_handler.setFormatter(logging.Formatter("%(asctime)s %(message)s"))
access_logger = logging.getLogger("bidblitz.access")
access_logger.addHandler(access_handler)

# ── App ──
app = FastAPI(
    title="BidBlitz V2 API",
    version="2.0.0",
    docs_url=None if IS_PRODUCTION else "/docs",
    redoc_url=None if IS_PRODUCTION else "/redoc",
)

# ── Rate Limiting ──
app.state.limiter = limiter

def rate_limit_exceeded_handler(request: Request, exc: RateLimitExceeded):
    retry = getattr(exc, "retry_after", 60)
    return JSONResponse(
        status_code=429,
        content={
            "error": "rate_limit_exceeded",
            "message": "Too many requests. Please slow down and try again.",
            "retry_after": retry,
        },
        headers={"Retry-After": str(retry)},
    )

app.add_exception_handler(RateLimitExceeded, rate_limit_exceeded_handler)

# ── Global Error Handler ──
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled error: {request.method} {request.url.path} | {exc}\n{traceback.format_exc()}")
    # Alert admins on system errors
    try:
        from core.audit import log_audit, AuditEvent
        await log_audit(
            "system_error",
            details={"path": request.url.path, "method": request.method, "error": str(exc)[:500]},
            severity="error",
        )
    except Exception:
        pass
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error" if IS_PRODUCTION else str(exc)},
    )


# ── Request Logging Middleware ──
import time as _time

# Monitoring metrics recorder
try:
    from routes.monitoring import record_request as _record_req
except Exception:
    _record_req = None

@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = _time.time()
    response = await call_next(request)
    duration = round((_time.time() - start) * 1000)
    if response.status_code >= 400:
        access_logger.info(f"{request.method} {request.url.path} → {response.status_code} ({duration}ms)")
    if response.status_code >= 500:
        logger.error(f"5xx: {request.method} {request.url.path} → {response.status_code} ({duration}ms)")
    # Feed monitoring metrics
    if _record_req and not request.url.path.startswith("/api/admin/monitoring"):
        try:
            _record_req(request.url.path, request.method, response.status_code, duration)
        except Exception:
            pass
    return response

# ── CORS ──
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Import & Register ALL Routers ──
from routes.auth import router as auth_router
from routes.wallet import router as wallet_router
from routes.payment import router as payment_router
from routes.merchant import router as merchant_router
from routes.transactions import router as transactions_router
from routes.stripe import router as stripe_router
from routes.payout import router as payout_router
from routes.admin import router as admin_router
from routes.monitoring import router as monitoring_router
from routes.merchant_admin import router as merchant_admin_router
from routes.blitz_transfer import router as blitz_transfer_router
from routes.smm_boost import router as smm_boost_router
from routes.export import router as export_router
from routes.profile import router as profile_router
from routes.sessions import router as sessions_router
from routes.referral import router as referral_router
from routes.notifications import router as notifications_router
from routes.promotions import router as promotions_router
from routes.analytics import router as analytics_router
from routes.kids import router as kids_router
from routes.support import router as support_router
from routes.feedback import router as feedback_router
from routes.auctions import router as auctions_router
from routes.merchant_connect import router as merchant_connect_router
from routes.influencer import router as influencer_router
from routes.investor import router as investor_router
from routes.rewards import router as rewards_router
from routes.role_requests import router as role_requests_router
from routes.verification import router as verification_router
from routes.merchant_hierarchy import router as merchant_hierarchy_router
from routes.pos_payments import router as pos_payments_router
from routes.pos_system import router as pos_system_router
from routes.pos_inventory import router as pos_inventory_router
from routes.pos_chat import router as pos_chat_router
from routes.pos_admin_self import router as pos_admin_self_router
from routes.pos_extended import router as pos_extended_router
from routes.pos_advanced import router as pos_advanced_router
from routes.pos_pro import router as pos_pro_router
from routes.pos_vouchers import router as pos_vouchers_router
from routes.pos_kassenmeldung import router as pos_kassenmeldung_router
from routes.pos_features import router as pos_features_router
from routes.pos_public_api import router as pos_public_api_router
from routes.pos_selfcheckout import router as pos_selfcheckout_router

from routes.mining import router as mining_router
from routes.mining_phase2 import router as mining_phase2_router
from routes.blitz_mine import router as blitz_mine_router
from routes.marketplace import router as marketplace_router
from routes.chat import router as chat_router
from routes.applications import router as applications_router
from routes.referral_system import router as referral_system_router
from routes.kids_system import router as kids_system_router
from routes.subscription_system import router as subscription_system_router
from routes.growth_engine import router as growth_engine_router
from routes.boost_system import router as boost_system_router
from routes.loyalty_system import router as loyalty_system_router
from routes.rewards_store import router as rewards_store_router
from routes.p2p_transfer import router as p2p_transfer_router
from routes.split_bill import router as split_bill_router
from routes.virtual_cards import router as virtual_cards_router
from routes.credit_system import router as credit_system_router
from routes.bills import router as bills_router
from routes.nft_generator import router as nft_router
from routes.receipts import router as receipts_router
from routes.legal import router as legal_router, admin_router as legal_admin_router
from routes.admin_wallet import router as admin_wallet_router
from routes.admin_management import router as admin_management_router
from routes.coinbase_commerce import router as coinbase_commerce_router
from routes.casino import router as casino_router
from routes.arcade import router as arcade_router
from routes.reengage import router as reengage_router
from routes.revenue import router as revenue_router
from routes.revenue2 import router as revenue2_router
from routes.taxi_admin import router as taxi_admin_router
from routes.growth import router as growth_router
from routes.quests import router as quests_router
from routes.retention import router as retention_router
from routes.web_push import router as web_push_router
from routes.friends_map import router as friends_map_router
from routes.merchant_payments import router as merchant_payments_router
from routes.gamification import router as gamification_router
from routes.food_tracking import router as food_tracking_router
from routes.friends import router as friends_router
from routes.kyc import router as kyc_router
from routes.push_notifications import router as push_notifications_router
from routes.support_tickets import router as support_tickets_router
from routes.two_factor import router as two_factor_router
from routes.admin_approvals import router as admin_approvals_router
from routes.crypto_wallet import router as crypto_wallet_router
from routes.crypto_prices import router as crypto_prices_router

app.include_router(auth_router)
app.include_router(wallet_router)
app.include_router(payment_router)
app.include_router(merchant_router)
app.include_router(transactions_router)
app.include_router(stripe_router)
app.include_router(payout_router)
app.include_router(admin_router)
app.include_router(admin_approvals_router)
app.include_router(crypto_wallet_router)
app.include_router(crypto_prices_router)
app.include_router(monitoring_router)
app.include_router(merchant_admin_router)
app.include_router(blitz_transfer_router)
app.include_router(smm_boost_router)
app.include_router(export_router)
app.include_router(pos_vouchers_router)
app.include_router(pos_kassenmeldung_router)
app.include_router(pos_features_router)
app.include_router(pos_public_api_router)
app.include_router(pos_selfcheckout_router)

app.include_router(profile_router)
app.include_router(sessions_router)
app.include_router(referral_router)
app.include_router(notifications_router)
app.include_router(promotions_router)
app.include_router(analytics_router)
app.include_router(kids_router)
app.include_router(support_router)
app.include_router(feedback_router)
app.include_router(auctions_router)

from routes.auction_push import router as auction_push_router
app.include_router(auction_push_router)
app.include_router(merchant_connect_router)
app.include_router(influencer_router)
app.include_router(investor_router)
app.include_router(rewards_router)
app.include_router(role_requests_router)
app.include_router(verification_router)
app.include_router(merchant_hierarchy_router)
app.include_router(pos_payments_router)
app.include_router(pos_system_router)
app.include_router(pos_inventory_router)
app.include_router(pos_chat_router)
app.include_router(pos_admin_self_router)
app.include_router(pos_extended_router)
app.include_router(pos_advanced_router)
app.include_router(pos_pro_router)
app.include_router(mining_router)
app.include_router(mining_phase2_router)
app.include_router(blitz_mine_router)
app.include_router(legal_router)
app.include_router(legal_admin_router)
app.include_router(admin_wallet_router)
app.include_router(admin_management_router)
app.include_router(coinbase_commerce_router)
app.include_router(casino_router)
app.include_router(arcade_router)
app.include_router(reengage_router)
app.include_router(revenue_router)
app.include_router(revenue2_router)
app.include_router(taxi_admin_router)
app.include_router(growth_router)
app.include_router(quests_router)
app.include_router(retention_router)
app.include_router(web_push_router)
app.include_router(friends_map_router)
app.include_router(merchant_payments_router)
app.include_router(marketplace_router)
app.include_router(chat_router)
app.include_router(gamification_router)
app.include_router(food_tracking_router)
app.include_router(friends_router)
app.include_router(kyc_router)
app.include_router(support_tickets_router)
app.include_router(two_factor_router)
app.include_router(applications_router)
app.include_router(referral_system_router)
app.include_router(kids_system_router)
app.include_router(subscription_system_router)
app.include_router(growth_engine_router)
app.include_router(boost_system_router)
app.include_router(loyalty_system_router)
app.include_router(rewards_store_router)
app.include_router(p2p_transfer_router)
app.include_router(split_bill_router)
app.include_router(virtual_cards_router)
app.include_router(credit_system_router)
app.include_router(bills_router)
app.include_router(nft_router)
app.include_router(receipts_router)

# Real Map & Nearby System
from routes.nearby import router as nearby_router
from routes.nearby_osm import router as nearby_osm_router
from routes.admin_map import router as admin_map_router
app.include_router(nearby_router)
app.include_router(nearby_osm_router)
app.include_router(admin_map_router)

# Mobility & Delivery Modules
from routes.taxi import router as taxi_router
from routes.scooter import router as scooter_router
from routes.food import router as food_router
from routes.drivers import router as drivers_router
from routes.mobility_notifications import router as mobility_notif_router
from routes.mobility_payments import router as mobility_payments_router
from routes.mobility_admin import router as mobility_admin_router
from routes.launch_control import router as launch_router
from routes.readiness import router as readiness_router
from routes.driver_dashboard import router as driver_dashboard_router
from routes.restaurant_dashboard import router as restaurant_dashboard_router

app.include_router(taxi_router)
app.include_router(scooter_router)
app.include_router(food_router)
app.include_router(drivers_router)
app.include_router(mobility_notif_router)
app.include_router(mobility_payments_router)
app.include_router(mobility_admin_router)
app.include_router(launch_router)
app.include_router(readiness_router)
app.include_router(driver_dashboard_router)
app.include_router(restaurant_dashboard_router)

# Kids GPS & Safety System
from routes.kids_gps import router as kids_gps_router
from routes.kids_gps_websocket import router as kids_gps_ws_router
app.include_router(kids_gps_router)
app.include_router(kids_gps_ws_router)

# Gaming Platform
from routes.gaming import router as gaming_router
app.include_router(gaming_router)

# Car Rental Module
from modules.car_rental import car_rental_router
app.include_router(car_rental_router)

# Premium Finance Features
from routes.premium_finance import router as premium_finance_router
app.include_router(premium_finance_router)

from routes.ai_assistant import router as ai_assistant_router
app.include_router(ai_assistant_router)

from routes.crypto import router as crypto_router
app.include_router(crypto_router)

from routes.budget import router as budget_router
app.include_router(budget_router)


from routes.admin_grants import router as admin_grants_router
app.include_router(admin_grants_router)


from routes.notification_center import router as notification_center_router
app.include_router(notification_center_router)

from routes.contacts import router as contacts_router
app.include_router(contacts_router)

from routes.user_stats import router as user_stats_router
app.include_router(user_stats_router)

from routes.currency import router as currency_router
app.include_router(currency_router)

from routes.tips import router as tips_router
app.include_router(tips_router)

from routes.hotels import router as hotels_router
app.include_router(hotels_router)

from routes.events import router as events_router
app.include_router(events_router)

from routes.restaurants import router as restaurants_router
app.include_router(restaurants_router)

from routes.insurance import router as insurance_router
app.include_router(insurance_router)

from routes.appointments import router as appointments_router
app.include_router(appointments_router)

from routes.social import router as social_router
app.include_router(social_router)

from routes.jobs import router as jobs_router
app.include_router(jobs_router)

from routes.flights import router as flights_router
app.include_router(flights_router)

from routes.sabre import router as sabre_router
app.include_router(sabre_router)

from routes.kids_controls import router as kids_controls_router
app.include_router(kids_controls_router)

from routes.admin_auction_images import router as admin_auction_images_router
app.include_router(admin_auction_images_router)

from routes.parcels import router as parcels_router
app.include_router(parcels_router)

from routes.recommendations import router as recommendations_router
app.include_router(recommendations_router)

from routes.cv_builder import router as cv_router
app.include_router(cv_router)

from routes.nearby_places import router as nearby_places_router
app.include_router(nearby_places_router)

from routes.merchant_portal import router as merchant_portal_router
app.include_router(merchant_portal_router)

from routes.kids_app import router as kids_app_router
app.include_router(kids_app_router)



# AI Chatbot
from routes.ai_chatbot import router as ai_chatbot_router
app.include_router(ai_chatbot_router, prefix="/api/chatbot", tags=["chatbot"])

from routes.email_marketing import router as email_marketing_router
app.include_router(email_marketing_router)

from routes.real_estate import router as real_estate_router
app.include_router(real_estate_router)

from routes.freelancer import router as freelancer_router
app.include_router(freelancer_router)

from routes.elearning import router as elearning_router
app.include_router(elearning_router)

from routes.handwerker import router as handwerker_router
app.include_router(handwerker_router)

from routes.streaming import router as streaming_router
app.include_router(streaming_router)

from routes.telemedizin import router as telemedizin_router
app.include_router(telemedizin_router)
from routes.testimonials import router as testimonials_router
app.include_router(testimonials_router)
from routes.pay_sdk import router as pay_sdk_router
app.include_router(pay_sdk_router)
from routes.pay_merchant_requests import router as pay_merchant_requests_router
app.include_router(pay_merchant_requests_router)
from routes.stripe_issuing import router as stripe_issuing_router
app.include_router(stripe_issuing_router)
from routes.cards_lifecycle import router as cards_lifecycle_router
app.include_router(cards_lifecycle_router)
from routes.referral_engine import router as referral_engine_router
app.include_router(referral_engine_router)
from routes.bot_personalization import router as bot_personalization_router
app.include_router(bot_personalization_router)
from routes.admin_viewers import router as admin_viewers_router
app.include_router(admin_viewers_router)

# Serve pay.js SDK publicly at /pay.js (and /api/pay.js for ingress-prefix access)
from pathlib import Path as _PayPath
_PAY_JS = _PayPath(__file__).parent / "static" / "pay.js"
from fastapi.responses import FileResponse as _PayFR

@app.get("/pay.js", include_in_schema=False)
@app.get("/api/pay.js", include_in_schema=False)
async def _serve_pay_js():
    return _PayFR(_PAY_JS, media_type="application/javascript", headers={"Cache-Control": "public, max-age=300"})

from routes.dating import router as dating_router
app.include_router(dating_router)

from routes.gebrauchtwagen import router as gebrauchtwagen_router
app.include_router(gebrauchtwagen_router)

from routes.reinigung import router as reinigung_router
app.include_router(reinigung_router)

from routes.umzug import router as umzug_router
app.include_router(umzug_router)

from routes.tierbetreuung import router as tierbetreuung_router
app.include_router(tierbetreuung_router)

from routes.fitness import router as fitness_router
app.include_router(fitness_router)

from routes.reiseplaner import router as reiseplaner_router
app.include_router(reiseplaner_router)

from routes.ladesaeulen import router as ladesaeulen_router
app.include_router(ladesaeulen_router)

from routes.stocks import router as stocks_router
app.include_router(stocks_router)

from routes.reselling import router as reselling_router
app.include_router(reselling_router)

from routes.blitzjobs import router as blitzjobs_router
app.include_router(blitzjobs_router)

from routes.cashback import router as cashback_router
app.include_router(cashback_router)

from routes.premium import router as premium_router
app.include_router(premium_router)

from routes.monetization import router as monetization_router
app.include_router(monetization_router)

from routes.stories import router as stories_router
app.include_router(stories_router)

from routes.live_auctions import router as live_auctions_router
app.include_router(live_auctions_router)

from routes.social_features import router as social_features_router
app.include_router(social_features_router)

from routes.ratings import router as ratings_router
app.include_router(ratings_router)

from routes.blitzlearn import router as blitzlearn_router
app.include_router(blitzlearn_router)

from routes.collectibles import router as collectibles_router
app.include_router(collectibles_router)

from routes.blitz_features import router as blitz_features_router
app.include_router(blitz_features_router)

from routes.pro_features import router as pro_features_router
app.include_router(pro_features_router)

from routes.extras import router as extras_router
app.include_router(extras_router)

from routes.city_services import router as city_services_router
app.include_router(city_services_router)

from routes.blitzpay import router as blitzpay_router
app.include_router(blitzpay_router)

from routes.crypto_earn import router as crypto_earn_router
app.include_router(crypto_earn_router)
app.include_router(crypto_wallet_router)
# crypto_prices_router already included above

from routes.crypto_baskets import router as crypto_baskets_router
app.include_router(crypto_baskets_router)

from routes.derivatives import router as derivatives_router
app.include_router(derivatives_router)

from routes.levelup import router as levelup_router
app.include_router(levelup_router)

from routes.predictions import router as predictions_router
app.include_router(predictions_router)

from routes.blitzcard import router as blitzcard_router
app.include_router(blitzcard_router)

from routes.supercharger import router as supercharger_router
app.include_router(supercharger_router)

from routes.defi_wallet import router as defi_wallet_router
app.include_router(defi_wallet_router)

from routes.crypto_loans import router as crypto_loans_router
app.include_router(crypto_loans_router)

from routes.p2p_lending import router as p2p_lending_router
app.include_router(p2p_lending_router)

from routes.trading_bot import router as trading_bot_router
app.include_router(trading_bot_router)

from routes.live_shopping import router as live_shopping_router
app.include_router(live_shopping_router)

from routes.creators import router as creators_router
app.include_router(creators_router)

from routes.skills import router as skills_router
app.include_router(skills_router)

from routes.invoicing import router as invoicing_router
app.include_router(invoicing_router)

from routes.qr_menu import router as qr_menu_router
app.include_router(qr_menu_router)

from routes.bookings import router as bookings_router, admin_router as bookings_admin_router
app.include_router(bookings_router)
app.include_router(bookings_admin_router)

from routes.contracts import router as contracts_router
app.include_router(contracts_router)

from routes.abo_boxes import router as abo_boxes_router
app.include_router(abo_boxes_router)

from routes.music import router as music_router
app.include_router(music_router)

from routes.surveys import router as surveys_router
app.include_router(surveys_router)

from routes.card_compare import router as card_compare_router
app.include_router(card_compare_router)

from routes.micro_tasks import router as micro_tasks_router
app.include_router(micro_tasks_router)

from routes.utilities import router as utilities_router
app.include_router(utilities_router)

from routes.daily_spin import router as daily_spin_router
app.include_router(daily_spin_router)

from routes.quiz import router as quiz_router
app.include_router(quiz_router)

from routes.engage import router as engage_router
app.include_router(engage_router)

from routes.viral import router as viral_router
app.include_router(viral_router)

# Push Notifications
app.include_router(push_notifications_router)

# Directory (Lokales Telefonbuch)
from routes.directory import router as directory_router
app.include_router(directory_router)

# Advertising Platform
from routes.advertising import router as advertising_router
app.include_router(advertising_router)

# AI Tools (Chatbot, Content Generator, Smart Recommendations)
from routes.ai_chat import router as ai_router
app.include_router(ai_router)

# Watchlist (Auktionen merken)
from routes.watchlist import router as watchlist_router
app.include_router(watchlist_router)

# Kids Premium Features (Chores, AI Tutor, Gifts, Badges, Approvals, Allowance, Charity, Insights, School Mode, Sibling Transfer, Courses, Mini-Games)
from routes.kids_premium import router as kids_premium_router
app.include_router(kids_premium_router)

# Instant Credit (Sofort-Kredit bis 100€, 3 Min, 0% Zinsen)
from routes.instant_credit import router as instant_credit_router
app.include_router(instant_credit_router)

# NEW FEATURES - Konkurrenz Features
from routes.split_payment import router as split_payment_router
app.include_router(split_payment_router)

from routes.loyalty import router as loyalty_router
app.include_router(loyalty_router)

from routes.reviews import router as reviews_router
from routes.apple_google_pay import router as apple_google_pay_router
from routes.influencer import router as influencer_router
app.include_router(reviews_router)
app.include_router(apple_google_pay_router)
app.include_router(influencer_router)

from routes.scheduled import router as scheduled_router
app.include_router(scheduled_router)

from routes.subscriptions import router as subscriptions_router
app.include_router(subscriptions_router)

from routes.safety import router as safety_router
app.include_router(safety_router)

from routes.promo import router as promo_router
app.include_router(promo_router)

from routes.filters import router as filters_router
app.include_router(filters_router)

# P2 Features - Nice to Have
from routes.group_orders import router as group_orders_router
app.include_router(group_orders_router)

# Super-App Revolut-killer additions (P2P handle, Debit Card waitlist, Live Shopping framework)
from routes.p2p import router as p2p_router
app.include_router(p2p_router)

from routes.card import router as card_router
app.include_router(card_router)

from routes.live import router as live_router
app.include_router(live_router)

# WeChat-style features (Gruppenchat, Round-up Sparen, Apartments)
from routes.groupchat import router as groupchat_router
app.include_router(groupchat_router)

from routes.roundup import router as roundup_router
app.include_router(roundup_router)

from routes.apartments import router as apartments_router
app.include_router(apartments_router)

from routes.quick_actions import router as quick_actions_router
app.include_router(quick_actions_router)

from routes.tips_gifts import router as tips_gifts_router
app.include_router(tips_gifts_router)

from routes.delivery_options import router as delivery_options_router
app.include_router(delivery_options_router)

from routes.bnpl import router as bnpl_router
app.include_router(bnpl_router)
from routes.pos_extras import router as pos_extras_router
app.include_router(pos_extras_router)
from routes.chat_ws import router as chat_ws_router
app.include_router(chat_ws_router)
from routes.voice import router as voice_router
app.include_router(voice_router)

# Static file serving for uploads
from fastapi.staticfiles import StaticFiles
UPLOAD_DIR = Path(__file__).parent / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)
(UPLOAD_DIR / "car_rental").mkdir(exist_ok=True)
app.mount("/api/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")

# Stripe webhook at /api/webhook/stripe
from routes.stripe import stripe_webhook as _stripe_wh
app.post("/api/webhook/stripe")(_stripe_wh)


# ── Health Check ──
@app.get("/api")
async def health_check():
    import os
    # Check MongoDB
    db_ok = False
    try:
        await db.command("ping")
        db_ok = True
    except Exception:
        pass

    # Check backup status
    backup_dir = "/app/backups"
    backups = sorted(
        [f for f in os.listdir(backup_dir) if f.endswith(".tar.gz")] if os.path.isdir(backup_dir) else [],
        reverse=True,
    )
    latest_backup = backups[0] if backups else None

    status = "online" if db_ok else "degraded"

    return {
        "service": "BidBlitz V2 API",
        "status": status,
        "version": "2.0.0",
        "environment": APP_ENV,
        "database": "connected" if db_ok else "disconnected",
        "uptime_check": datetime.now(timezone.utc).isoformat(),
        "backup": {
            "latest": latest_backup,
            "count": len(backups),
        },
    }


# ── Performance Monitoring (Admin) ──
@app.get("/api/admin/performance")
async def admin_performance_stats(request: Request):
    """Admin: Get system performance statistics."""
    from core.security import get_current_user
    from core.performance import get_performance_stats
    
    user = await get_current_user(request)
    if user.get("role") != "admin":
        return {"error": "Admin only"}
    
    stats = get_performance_stats()
    
    # Add database stats
    try:
        db_stats = await db.command("dbStats")
        stats["database"] = {
            "collections": db_stats.get("collections", 0),
            "objects": db_stats.get("objects", 0),
            "avgObjSize": db_stats.get("avgObjSize", 0),
            "dataSize": db_stats.get("dataSize", 0),
            "indexSize": db_stats.get("indexSize", 0),
        }
    except Exception:
        stats["database"] = {"error": "Could not fetch db stats"}
    
    return stats


# ── Public Feature Flags (for frontend) ──
@app.get("/api/feature-flags")
async def public_feature_flags():
    from core.feature_flags import get_all_flags
    flags = await get_all_flags()
    # Return simplified version for frontend
    result = {}
    for k, v in flags.items():
        result[k] = {"enabled": v.get("enabled", False), "access": v.get("access", "all")}
    return {"flags": result}


# ── Mining Auto-Reward Background Loop ──
import asyncio as _asyncio_loop

def start_auto_reward_loop():
    """Start background loop that processes auto mining rewards every 60 seconds."""
    from routes.mining import process_auto_rewards

    async def _auto_reward_loop():
        while True:
            try:
                await _asyncio_loop.sleep(60)
                rewarded = await process_auto_rewards()
                if rewarded > 0:
                    logger.info(f"Auto-rewards processed: {rewarded} users")
            except Exception as e:
                logger.error(f"Auto-reward loop error: {e}")
                await _asyncio_loop.sleep(10)

    _asyncio_loop.get_event_loop().create_task(_auto_reward_loop())


def start_subscription_renewal_loop():
    """Start background loop that processes subscription renewals every hour."""
    from routes.subscription_system import process_subscription_renewals, expire_subscriptions

    async def _subscription_loop():
        while True:
            try:
                await _asyncio_loop.sleep(3600)  # Every hour
                renewals = await process_subscription_renewals()
                expired = await expire_subscriptions()
                if renewals.get("renewed", 0) > 0 or expired > 0:
                    logger.info(f"Subscriptions processed: {renewals.get('renewed', 0)} renewed, {expired} expired")
            except Exception as e:
                logger.error(f"Subscription loop error: {e}")
                await _asyncio_loop.sleep(60)

    _asyncio_loop.get_event_loop().create_task(_subscription_loop())


def start_credit_autopay_loop():
    """Start background loop that processes automatic credit payments every hour."""
    from routes.credit_system import process_auto_credit_payments

    async def _credit_loop():
        while True:
            try:
                await _asyncio_loop.sleep(3600)  # Every hour
                result = await process_auto_credit_payments()
                if result.get("processed", 0) > 0 or result.get("failed", 0) > 0:
                    logger.info(f"Credit auto-pay: {result['processed']} paid, {result['failed']} failed")
            except Exception as e:
                logger.error(f"Credit auto-pay error: {e}")
                await _asyncio_loop.sleep(60)

    _asyncio_loop.get_event_loop().create_task(_credit_loop())



# ── Static Files for NFT Images ──
import os
static_dir = Path(__file__).parent / "static"
static_dir.mkdir(exist_ok=True)
app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")


# ── Startup ──
@app.on_event("startup")
async def startup():
    await create_indexes()
    await seed_admin()
    # Seed 30 product auctions if none exist
    from routes.auctions import seed_demo_auctions, start_bot_loop, start_auction_maintenance_loop
    await seed_demo_auctions()
    # Start bot bidding background loop (Admin-controlled bots)
    start_bot_loop()
    # Start auction maintenance: ends expired, auto-restarts to keep 30 active, fluctuates viewers
    start_auction_maintenance_loop()
    # Start kids allowance auto-pay loop
    from routes.kids_premium import start_allowance_loop
    start_allowance_loop()
    # Start instant credit payout + overdue loops
    from routes.instant_credit import start_instant_credit_loops
    start_instant_credit_loops()
    # Start mining auto-reward background loop
    start_auto_reward_loop()
    # Start subscription renewal background loop
    start_subscription_renewal_loop()
    start_credit_autopay_loop()
    logger.info(f"BidBlitz V2 API started [env={APP_ENV}] — Bot loop + Auto-rewards + Subscriptions + 30 Auto-Restart Auctions + Viewer Tracking active")


@app.on_event("shutdown")
async def shutdown():
    await close_connection()
    logger.info("BidBlitz V2 API shutdown")


# ── Admin Seeder ──
async def seed_admin():
    from core.config import ADMIN_EMAIL, ADMIN_PASSWORD
    import random

    admin_email = ADMIN_EMAIL.lower().strip()
    existing = await db.users.find_one({"email": admin_email})

    if existing is None:
        hashed = hash_password(ADMIN_PASSWORD)
        result = await db.users.insert_one({
            "email": admin_email,
            "password_hash": hashed,
            "name": "Admin",
            "role": "admin",
            "balance": 1500.00,
            "currency": "EUR",
            "card_number": f"{random.randint(4000,4999)} {random.randint(1000,9999)} {random.randint(1000,9999)} {random.randint(1000,9999)}",
            "card_expiry": "09/28",
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        await db.merchants.insert_one({
            "user_id": str(result.inserted_id),
            "business_name": "BidBlitz HQ",
            "total_earnings": 0.0,
            "total_transactions": 0,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        logger.info(f"Admin user seeded: {admin_email}")
    elif not verify_password(ADMIN_PASSWORD, existing["password_hash"]):
        await db.users.update_one(
            {"email": admin_email},
            {"$set": {"password_hash": hash_password(ADMIN_PASSWORD)}}
        )
        logger.info("Admin password updated")
