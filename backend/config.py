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
REFERRER_REWARD_BIDS = 10    # Bids given to referrer (inviter)
REFEREE_REWARD_BIDS = 5      # Bids given to referee (new user) as welcome gift

# Bid packages - Updated pricing with bonus bids
BID_PACKAGES = [
    {"id": "mini", "name": "Mini", "bids": 10, "bonus": 0, "price": 5.00, "popular": False, "per_bid": 0.50},
    {"id": "starter", "name": "Starter", "bids": 20, "bonus": 2, "price": 10.00, "popular": False, "per_bid": 0.45},
    {"id": "basic", "name": "Basic", "bids": 40, "bonus": 5, "price": 20.00, "popular": True, "per_bid": 0.44},
    {"id": "pro", "name": "Pro", "bids": 100, "bonus": 15, "price": 50.00, "popular": False, "per_bid": 0.43},
    {"id": "ultimate", "name": "Ultimate", "bids": 200, "bonus": 30, "price": 100.00, "popular": False, "per_bid": 0.43}
]

# Frontend URL for redirects
FRONTEND_URL = os.environ.get('FRONTEND_URL', 'https://bidblitz-penny-2.preview.emergentagent.com')
