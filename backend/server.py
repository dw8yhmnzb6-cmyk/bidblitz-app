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

@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = _time.time()
    response = await call_next(request)
    duration = round((_time.time() - start) * 1000)
    if response.status_code >= 400:
        access_logger.info(f"{request.method} {request.url.path} → {response.status_code} ({duration}ms)")
    if response.status_code >= 500:
        logger.error(f"5xx: {request.method} {request.url.path} → {response.status_code} ({duration}ms)")
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
from routes.mining import router as mining_router
from routes.mining_phase2 import router as mining_phase2_router
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

app.include_router(auth_router)
app.include_router(wallet_router)
app.include_router(payment_router)
app.include_router(merchant_router)
app.include_router(transactions_router)
app.include_router(stripe_router)
app.include_router(payout_router)
app.include_router(admin_router)
app.include_router(export_router)
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
app.include_router(merchant_connect_router)
app.include_router(influencer_router)
app.include_router(investor_router)
app.include_router(rewards_router)
app.include_router(role_requests_router)
app.include_router(verification_router)
app.include_router(merchant_hierarchy_router)
app.include_router(pos_payments_router)
app.include_router(mining_router)
app.include_router(mining_phase2_router)
app.include_router(marketplace_router)
app.include_router(chat_router)
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
from routes.admin_map import router as admin_map_router
app.include_router(nearby_router)
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
app.include_router(kids_gps_router)

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


# ── Startup ──
@app.on_event("startup")
async def startup():
    await create_indexes()
    await seed_admin()
    # NO DEMO SEEDING - Only real auctions created by admin
    # Start bot bidding background loop (Admin-controlled bots)
    from routes.auctions import start_bot_loop
    start_bot_loop()
    # Start mining auto-reward background loop
    start_auto_reward_loop()
    # Start subscription renewal background loop
    start_subscription_renewal_loop()
    start_credit_autopay_loop()
    logger.info(f"BidBlitz V2 API started [env={APP_ENV}] — Bot loop + Auto-rewards + Subscriptions active (NO DEMO DATA)")


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
