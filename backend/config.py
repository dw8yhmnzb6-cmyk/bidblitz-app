"""Database and core configuration - shared across all modules"""
import os
import logging
from pathlib import Path
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
import resend
from coinbase_commerce.client import Client as CoinbaseClient

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Config
JWT_SECRET = os.environ.get('JWT_SECRET', 'bidblitz_secret')
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24

# Email Config (Resend)
RESEND_API_KEY = os.environ.get('RESEND_API_KEY', '')
SENDER_EMAIL = os.environ.get('SENDER_EMAIL', 'onboarding@resend.dev')
if RESEND_API_KEY:
    resend.api_key = RESEND_API_KEY

# Stripe Config
STRIPE_API_KEY = os.environ.get('STRIPE_API_KEY')

# Coinbase Commerce Config
COINBASE_COMMERCE_API_KEY = os.environ.get('COINBASE_COMMERCE_API_KEY', '')
coinbase_client = None
if COINBASE_COMMERCE_API_KEY:
    coinbase_client = CoinbaseClient(api_key=COINBASE_COMMERCE_API_KEY)

# Referral config
REFERRAL_MIN_DEPOSIT = 5.00  # €5 minimum deposit for referral reward
REFERRAL_REWARD_BIDS = 10    # Bids given to both referrer and referee

# Bid packages
BID_PACKAGES = [
    {"id": "starter", "name": "Starter", "bids": 50, "price": 15.00, "popular": False},
    {"id": "basic", "name": "Basic", "bids": 100, "price": 25.00, "popular": True},
    {"id": "pro", "name": "Pro", "bids": 250, "price": 50.00, "popular": False},
    {"id": "ultimate", "name": "Ultimate", "bids": 500, "price": 89.00, "popular": False}
]

# Frontend URL for redirects
FRONTEND_URL = os.environ.get('FRONTEND_URL', 'https://bidracer.preview.emergentagent.com')
