import sys
from pathlib import Path

# Ensure backend root is in Python path
sys.path.insert(0, str(Path(__file__).parent))

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent / '.env')

from fastapi import FastAPI
from starlette.middleware.cors import CORSMiddleware
import os
import logging

from core.database import db, create_indexes, close_connection
from core.security import hash_password, verify_password
from routes.auth import router as auth_router
from routes.wallet import router as wallet_router
from routes.payment import router as payment_router
from routes.merchant import router as merchant_router
from routes.transactions import router as transactions_router
from routes.stripe import router as stripe_router

app = FastAPI(title="BidBlitz V2 API", version="1.0.0")

# CORS
frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:3000")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth_router)
app.include_router(wallet_router)
app.include_router(payment_router)
app.include_router(merchant_router)
app.include_router(transactions_router)
app.include_router(stripe_router)

# Stripe webhook needs to be at /api/webhook/stripe
from routes.stripe import stripe_webhook as _stripe_wh
app.post("/api/webhook/stripe")(_stripe_wh)

# Health check
@app.get("/api")
async def root():
    return {"message": "BidBlitz V2 API", "status": "online"}


@app.on_event("startup")
async def startup():
    await create_indexes()
    await seed_admin()
    logger.info("BidBlitz V2 API started")


@app.on_event("shutdown")
async def shutdown():
    await close_connection()


async def seed_admin():
    from datetime import datetime, timezone
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
        # Create merchant profile for admin
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


logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)
