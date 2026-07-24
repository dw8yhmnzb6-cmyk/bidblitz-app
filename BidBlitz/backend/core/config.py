import os
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent.parent
load_dotenv(ROOT_DIR / '.env')

# ── Environment ──
APP_ENV = os.environ.get("APP_ENV", "development")
IS_PRODUCTION = APP_ENV == "production"
DEBUG = os.environ.get("DEBUG", "true").lower() == "true" and not IS_PRODUCTION
TEST_MODE = os.environ.get("TEST_MODE", "false").lower() == "true"

# ── Database ──
MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]

# ── Auth ──
JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 if IS_PRODUCTION else 60
REFRESH_TOKEN_EXPIRE_DAYS = 30
ADMIN_EMAIL = os.environ["ADMIN_EMAIL"]
ADMIN_PASSWORD = os.environ["ADMIN_PASSWORD"]
MAX_LOGIN_ATTEMPTS = 5
LOCKOUT_MINUTES = 15 if IS_PRODUCTION else 5

# ── Cookie Security (production-ready) ──
# Force secure cookies for preview server (HTTPS)
COOKIE_SECURE = os.environ.get("COOKIE_SECURE", "true").lower() == "true"
COOKIE_SAMESITE = os.environ.get("COOKIE_SAMESITE", "none" if COOKIE_SECURE else "lax")
COOKIE_HTTPONLY = True

# ── Stripe ──
STRIPE_API_KEY = os.environ.get("STRIPE_API_KEY", "")
STRIPE_WEBHOOK_SECRET = os.environ.get("STRIPE_WEBHOOK_SECRET", "")
STRIPE_ISSUING_WEBHOOK_SECRET = os.environ.get("STRIPE_ISSUING_WEBHOOK_SECRET", "")
# Master switch: only set to "true" once Stripe Issuing is approved & funded in your Dashboard
STRIPE_ISSUING_ENABLED = os.environ.get("STRIPE_ISSUING_ENABLED", "false").lower() == "true"
# Per-cardholder default daily spending limit (cents)
STRIPE_ISSUING_DAILY_LIMIT_CENTS = int(os.environ.get("STRIPE_ISSUING_DAILY_LIMIT_CENTS", "50000"))

# ── URLs ──
FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:3000")
BACKEND_URL = os.environ.get("BACKEND_URL", "http://localhost:8001")

# ── CORS ──
_raw_cors_origins = [origin.strip() for origin in os.environ.get("CORS_ORIGINS", "").split(",") if origin.strip()]
if _raw_cors_origins:
    CORS_ORIGINS = _raw_cors_origins
elif FRONTEND_URL:
    CORS_ORIGINS = [FRONTEND_URL]
else:
    CORS_ORIGINS = []

# ── Rewards & Growth ──
REWARDS = {
    "signup_bonus": 0.0,
    "referral_bonus": 5.0,
    "first_payment_bonus": 2.0,
    "first_topup_bonus": 1.0,
    "merchant_onboarding_bonus": 10.0,
}

# ── Platform Fee Configuration ──
# All percentages as decimals (0.025 = 2.5%)
FEES = {
    "payment": 0.025,       # 2.5% on merchant payments
    "send": 0.005,          # 0.5% on peer transfers
    "topup": 0.0,           # 0% on wallet top-ups (free)
    "payout_flat": 0.50,    # €0.50 flat fee per payout
    "payout_percent": 0.0,  # 0% percentage fee on payouts
    "min_payout": 5.0,      # Minimum payout amount €5
    "settlement_delay_hours": 0,  # Hours before pending → available (0 = instant)
}

def calculate_fee(amount, fee_type):
    """Calculate platform fee for a given amount and type."""
    pct = FEES.get(fee_type, 0.0)
    fee = round(amount * pct, 2)
    return fee

def calculate_payout_fee(amount):
    """Calculate payout fee (flat + percentage)."""
    flat = FEES["payout_flat"]
    pct_fee = round(amount * FEES["payout_percent"], 2)
    return round(flat + pct_fee, 2)
