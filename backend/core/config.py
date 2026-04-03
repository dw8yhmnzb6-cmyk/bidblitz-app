import os
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent.parent
load_dotenv(ROOT_DIR / '.env')

# ── Environment ──
APP_ENV = os.environ.get("APP_ENV", "development")
IS_PRODUCTION = APP_ENV == "production"

# ── Database ──
MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]

# ── Auth ──
JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 15
REFRESH_TOKEN_EXPIRE_DAYS = 7
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "admin@bidblitz.com")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "BidBlitz2026!")
MAX_LOGIN_ATTEMPTS = 5
LOCKOUT_MINUTES = 15

# ── Cookie Security (environment-aware) ──
COOKIE_SECURE = not (APP_ENV == "development" and "localhost" in os.environ.get("FRONTEND_URL", "localhost"))
COOKIE_SAMESITE = "none" if COOKIE_SECURE else "lax"

# ── Stripe ──
STRIPE_API_KEY = os.environ.get("STRIPE_API_KEY", "")

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
