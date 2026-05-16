import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent / '.env')

import logging
from logging.handlers import RotatingFileHandler

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from slowapi.errors import RateLimitExceeded

from core.config import APP_ENV, IS_PRODUCTION
from core.database import db, create_indexes, close_connection
from core.rate_limit import limiter
from core.middleware import setup_middleware
from core.router_registry import register_all_routers

# ══════════════════════════════════════════════════════════════════════════════
# LOGGING SETUP
# ══════════════════════════════════════════════════════════════════════════════

LOG_DIR = Path(__file__).parent / "logs"
LOG_DIR.mkdir(exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("bidblitz")

# Error log (rotates at 5MB, keeps 5 files)
err_handler = RotatingFileHandler(LOG_DIR / "error.log", maxBytes=5_000_000, backupCount=5)
err_handler.setLevel(logging.ERROR)
err_handler.setFormatter(logging.Formatter("%(asctime)s [%(levelname)s] %(name)s: %(message)s"))
logger.addHandler(err_handler)

# Access log
access_handler = RotatingFileHandler(LOG_DIR / "access.log", maxBytes=5_000_000, backupCount=3)
access_handler.setLevel(logging.INFO)
access_handler.setFormatter(logging.Formatter("%(asctime)s %(message)s"))
access_logger = logging.getLogger("bidblitz.access")
access_logger.addHandler(access_handler)

# ══════════════════════════════════════════════════════════════════════════════
# FASTAPI APP
# ══════════════════════════════════════════════════════════════════════════════

app = FastAPI(
    title="BidBlitz V2 API",
    version="2.0.0",
    docs_url=None if IS_PRODUCTION else "/docs",
    redoc_url=None if IS_PRODUCTION else "/redoc",
)

# ══════════════════════════════════════════════════════════════════════════════
# RATE LIMITING
# ══════════════════════════════════════════════════════════════════════════════

app.state.limiter = limiter

from fastapi import Request
from fastapi.responses import JSONResponse

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

# ══════════════════════════════════════════════════════════════════════════════
# MIDDLEWARE & ROUTERS
# ══════════════════════════════════════════════════════════════════════════════

# Setup CORS, Logging, Error Handling
setup_middleware(app)

# Auto-register all routers from /routes
register_all_routers(app)

logger.info(f"✓ BidBlitz V2 API started ({APP_ENV} mode)")

# ══════════════════════════════════════════════════════════════════════════════
# STATIC FILES
# ══════════════════════════════════════════════════════════════════════════════

app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")
app.mount("/static", StaticFiles(directory="static"), name="static")

# ══════════════════════════════════════════════════════════════════════════════
# STARTUP & SHUTDOWN
# ══════════════════════════════════════════════════════════════════════════════

@app.on_event("startup")
async def startup_event():
    """Initialize database indexes on startup"""
    logger.info("🚀 Starting BidBlitz V2...")
    await create_indexes()
    logger.info("✓ Database indexes created")

    # Seed demo auctions and start background bot+maintenance loops
    try:
        from routes.auctions import (
            seed_demo_auctions,
            start_auction_maintenance_loop,
            start_bot_loop,
        )
        await seed_demo_auctions()
        start_auction_maintenance_loop()
        start_bot_loop()
        logger.info("✓ Auction maintenance + bot loops started")
    except Exception as e:
        logger.warning(f"Auction loops start failed: {e}")

    # Staff Shift Watchdog (Push-Reminders alle 5min)
    try:
        from routes.staff_shift_watchdog import start_watchdog_loop
        start_watchdog_loop()
        logger.info("✓ Staff shift watchdog loop started")
    except Exception as e:
        logger.warning(f"Staff watchdog start failed: {e}")

    # Optional: Seed demo data if DEMO_SEED=true
    import os
    if os.environ.get("DEMO_SEED", "").lower() == "true":
        try:
            from scripts.seed_demo_data import seed_demo_data
            await seed_demo_data(db)
            logger.info("✓ Demo data seeded")
        except Exception as e:
            logger.warning(f"Demo seed failed: {e}")


@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown"""
    logger.info("Shutting down BidBlitz V2...")
    await close_connection()
    logger.info("✓ Database connection closed")


# ══════════════════════════════════════════════════════════════════════════════
# HEALTH CHECK
# ══════════════════════════════════════════════════════════════════════════════

@app.get("/health")
async def health_check():
    """Simple health check endpoint"""
    return {"status": "healthy", "version": "2.0.0", "environment": APP_ENV}


@app.get("/")
async def root():
    """API root - redirect to docs in dev mode"""
    return {
        "app": "BidBlitz V2 API",
        "version": "2.0.0",
        "docs": "/docs" if not IS_PRODUCTION else None,
    }
