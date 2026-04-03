import os
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent.parent
load_dotenv(ROOT_DIR / '.env')

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 15
REFRESH_TOKEN_EXPIRE_DAYS = 7
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "admin@bidblitz.com")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "BidBlitz2026!")
MAX_LOGIN_ATTEMPTS = 5
LOCKOUT_MINUTES = 15
