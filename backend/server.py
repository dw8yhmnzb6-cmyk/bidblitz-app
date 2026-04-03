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

from core.config import APP_ENV, IS_PRODUCTION
from core.database import db, create_indexes, close_connection
from core.security import hash_password, verify_password

# ── Structured Logging ──
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("bidblitz")

# ── App ──
app = FastAPI(
    title="BidBlitz V2 API",
    version="2.0.0",
    docs_url=None if IS_PRODUCTION else "/docs",
    redoc_url=None if IS_PRODUCTION else "/redoc",
)

# ── Global Error Handler ──
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled error: {exc}\n{traceback.format_exc()}")
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error" if IS_PRODUCTION else str(exc)},
    )

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

# Stripe webhook at /api/webhook/stripe
from routes.stripe import stripe_webhook as _stripe_wh
app.post("/api/webhook/stripe")(_stripe_wh)


# ── Health Check ──
@app.get("/api")
async def health_check():
    return {
        "service": "BidBlitz V2 API",
        "status": "online",
        "version": "2.0.0",
        "environment": APP_ENV,
    }


# ── Startup ──
@app.on_event("startup")
async def startup():
    await create_indexes()
    await seed_admin()
    logger.info(f"BidBlitz V2 API started [env={APP_ENV}]")


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
