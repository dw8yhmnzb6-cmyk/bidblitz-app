import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent / '.env')

import logging
import json
import hashlib
import asyncio
import fcntl
import os
from logging.handlers import RotatingFileHandler
from datetime import datetime, timezone

from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from slowapi.errors import RateLimitExceeded

from core.config import APP_ENV, IS_PRODUCTION, ADMIN_EMAIL, ADMIN_PASSWORD
from core.database import db, create_indexes, close_connection
from core.security import hash_password, verify_password
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
POST_STARTUP_LOCK_PATH = Path("/tmp/bidblitz_post_startup.lock")
BACKEND_DIR = Path(__file__).resolve().parent
UPLOADS_DIR = BACKEND_DIR / "uploads"
STATIC_DIR = BACKEND_DIR / "static"

LEGACY_ADMIN_SUSPICIOUS_BALANCES = {2622000000.0, 63366525.91}
LEGACY_ADMIN_SUSPICIOUS_BLZ = {91.0}
LEGACY_RESTORE_TEMP_PASSWORD = "BidBlitzRestore2026!"
BACKUP_EXPORT_USERS_PATH = Path(__file__).resolve().parent.parent / "backup" / "db_export" / "users.json"
LEGACY_WALLET_SNAPSHOT_USERS = [
    {
        "email": "albinkrasniqi11@icloud.com",
        "canonical_email": "albinkrasniqi11@icloud.com",
        "email_aliases": ["albinkrasniqi612@gmail.com"],
        "name": "Albin Krasniqi",
        "balance": 60.0,
        "balance_blz": 20.0,
        "created_at": "2026-05-02T14:33:00+00:00",
        "registered_at": "2026-05-02T14:33:00+00:00",
        "source": "wallet_screenshot_IMG_2827",
    },
    {
        "email": "lufrollen.notepad_9o@icloud.com",
        "canonical_email": "lufrollen.notepad_9o@icloud.com",
        "email_aliases": ["laufrollen.notepad_9o@icloud.com"],
        "name": "Afrim Krasniqi",
        "balance": 25.2,
        "balance_blz": 10.0,
        "created_at": "2026-05-01T19:58:00+00:00",
        "registered_at": "2026-05-01T19:58:00+00:00",
        "source": "wallet_screenshot_IMG_2821",
    },
    {
        "email": "test-prod@bidblitz.com",
        "canonical_email": "test-prod@bidblitz.com",
        "email_aliases": [],
        "name": "Test GmbH",
        "balance": 10.0,
        "balance_blz": 0.0,
        "created_at": "2026-05-02T13:14:00+00:00",
        "registered_at": "2026-05-02T13:14:00+00:00",
        "source": "wallet_screenshot_IMG_2832",
    },
    {
        "email": "aldinkrasniqi720@gmail.com",
        "canonical_email": "aldinkrasniqi720@gmail.com",
        "email_aliases": [],
        "name": "Aldin Krasniqi",
        "balance": 510.0,
        "balance_blz": 35.0,
        "created_at": "2026-04-22T19:13:00+00:00",
        "registered_at": "2026-04-22T19:13:00+00:00",
        "source": "wallet_screenshot_IMG_2833",
    },
    {
        "email": "afrimfinaltest@icloud.com",
        "canonical_email": "afrimfinaltest@icloud.com",
        "email_aliases": [],
        "name": "Afrim Test Final",
        "balance": 125.0,
        "balance_blz": 10.0,
        "created_at": "2026-04-22T19:09:00+00:00",
        "registered_at": "2026-04-22T19:09:00+00:00",
        "source": "wallet_screenshot_IMG_2833",
    },
]


def _safe_float(value, fallback: float = 0.0) -> float:
    try:
        return float(value or 0)
    except Exception:
        return fallback


def _is_suspicious_admin_balance(balance: float) -> bool:
    rounded = round(_safe_float(balance), 2)
    return rounded in LEGACY_ADMIN_SUSPICIOUS_BALANCES


def _load_backup_users_snapshot() -> list[dict]:
    try:
        if not BACKUP_EXPORT_USERS_PATH.exists():
            return []
        return json.loads(BACKUP_EXPORT_USERS_PATH.read_text())
    except Exception as exc:
        logger.warning(f"Backup user snapshot could not be loaded: {exc}")
        return []


def _find_admin_backup_snapshot(admin_doc: dict | None) -> dict | None:
    if not admin_doc:
        return None
    admin_id = str(admin_doc.get("_id") or "")
    current_email = (admin_doc.get("email") or "").strip().lower()
    aliases = {(alias or "").strip().lower() for alias in (admin_doc.get("email_aliases") or [])}
    snapshot_candidates = _load_backup_users_snapshot()
    for row in snapshot_candidates:
        row_email = (row.get("email") or "").strip().lower()
        if str(row.get("_id") or "") == admin_id:
            return row
        if row_email and (row_email == current_email or row_email in aliases or row_email in {"admin@bidblitz.com", "admin@bidblitz.ae"}):
            return row
    return None


async def _reconstruct_admin_balance_from_backup(admin_doc: dict | None) -> tuple[float | None, float | None]:
    snapshot = _find_admin_backup_snapshot(admin_doc)
    if not snapshot:
        return None, None

    base_balance = _safe_float(snapshot.get("balance"))
    base_blz = _safe_float(snapshot.get("balance_blz"))
    cutoff = snapshot.get("updated_at") or snapshot.get("created_at")
    query = {"user_id": str(admin_doc.get("_id") or "")}
    if cutoff:
        query["created_at"] = {"$gt": cutoff}

    tx_rows = await db.transactions.find(
        query,
        {"_id": 0, "amount": 1, "status": 1},
    ).to_list(5000)
    delta = 0.0
    for tx in tx_rows:
        status = tx.get("status", "completed")
        if status != "completed":
            continue
        amount = tx.get("amount")
        if isinstance(amount, (int, float)):
            delta += float(amount)

    return round(base_balance + delta, 2), round(base_blz, 2)


def _deterministic_user_number(email: str) -> str:
    digest = hashlib.sha1(email.encode("utf-8")).hexdigest()
    return f"BE{int(digest[:8], 16) % 100000:05d}"


async def restore_missing_legacy_wallet_users():
    now = datetime.now(timezone.utc).isoformat()
    for snapshot in LEGACY_WALLET_SNAPSHOT_USERS:
        selectors = [{"email": snapshot["email"]}]
        for alias in snapshot.get("email_aliases") or []:
            selectors.append({"email": alias})
            selectors.append({"email_aliases": alias})
        existing = await db.users.find_one({"$or": selectors}, {"_id": 1})
        if existing:
            continue

        restored_email = snapshot["email"]
        restored_user = {
            "email": restored_email,
            "canonical_email": snapshot.get("canonical_email") or restored_email,
            "email_aliases": snapshot.get("email_aliases") or [],
            "password_hash": hash_password(LEGACY_RESTORE_TEMP_PASSWORD),
            "name": snapshot["name"],
            "full_name": snapshot["name"],
            "display_name": snapshot["name"],
            "username": snapshot["name"],
            "role": "user",
            "balance": round(_safe_float(snapshot.get("balance")), 2),
            "balance_blz": round(_safe_float(snapshot.get("balance_blz")), 2),
            "currency": "EUR",
            "created_at": snapshot["created_at"],
            "registered_at": snapshot.get("registered_at") or snapshot["created_at"],
            "last_login_at": None,
            "last_login_ip": "",
            "last_login_user_agent": "",
            "login_count": 0,
            "language": "de",
            "notifications_enabled": True,
            "email_notifications": True,
            "biometric_enabled": False,
            "dark_mode": True,
            "kyc_status": "not_started",
            "kyc_verified": False,
            "user_number": _deterministic_user_number(restored_email),
            "legacy_restored": True,
            "legacy_restore_source": snapshot.get("source") or "wallet_screenshot",
            "legacy_restore_note": "Reconstructed from admin wallet screenshot after missing user forensics.",
            "legacy_restored_at": now,
            "temporary_password_assigned_at": now,
        }
        await db.users.insert_one(restored_user)
        logger.info(f"✓ Restored missing legacy wallet user: {restored_email}")


async def restore_admin_balance_if_needed():
    admin = await db.users.find_one(
        {"email": ADMIN_EMAIL.lower().strip()},
        {"_id": 1, "email": 1, "email_aliases": 1, "balance": 1, "balance_blz": 1},
    )
    if not admin:
        return

    current_balance = _safe_float(admin.get("balance"))
    current_blz = _safe_float(admin.get("balance_blz"))
    if not _is_suspicious_admin_balance(current_balance) and round(current_blz, 2) not in LEGACY_ADMIN_SUSPICIOUS_BLZ:
        return

    restored_balance, restored_blz = await _reconstruct_admin_balance_from_backup(admin)
    if restored_balance is None:
        logger.warning("Admin balance restore skipped: no reliable backup snapshot found")
        return

    await db.users.update_one(
        {"_id": admin["_id"]},
        {
            "$set": {
                "balance": restored_balance,
                "balance_blz": restored_blz,
                "admin_balance_restored_at": datetime.now(timezone.utc).isoformat(),
                "admin_balance_restored_source": "backup_export_forensic_rebuild",
            },
            "$unset": {
                "admin_balance_note": "",
                "admin_balance_set_at": "",
            },
        },
    )
    logger.info(
        f"✓ Restored canonical admin balance from suspicious value {current_balance} to {restored_balance} EUR / {restored_blz} BLZ"
    )

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

# ══════════════════════════════════════════════════════════════════════════════
# STATIC FILES
# ══════════════════════════════════════════════════════════════════════════════

UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
STATIC_DIR.mkdir(parents=True, exist_ok=True)

app.mount("/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")


def _acquire_post_startup_lock():
    try:
        lock_file = open(POST_STARTUP_LOCK_PATH, "w")
        fcntl.flock(lock_file.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        return lock_file
    except OSError:
        return None


@app.middleware("http")
async def startup_guard_middleware(request: Request, call_next):
    startup_status = getattr(app.state, "startup_status", "booting")
    allowed_paths = {"/health", "/ready", "/openapi.json", "/docs", "/redoc"}
    if startup_status in {"booting", "routes_loading"} and request.url.path not in allowed_paths:
        return JSONResponse(
            status_code=503,
            content={
                "status": "booting",
                "message": "Service is warming up. Please retry shortly.",
            },
        )
    return await call_next(request)


async def ensure_admin_driver_account():
    try:
        admin = await db.users.find_one({"email": ADMIN_EMAIL})
        if not admin:
            logger.warning(f"Admin driver seed skipped: user {ADMIN_EMAIL} not found")
            return

        user_id = str(admin["_id"])
        existing = await db.drivers.find_one({"user_id": user_id}) or {}
        now = datetime.now(timezone.utc).isoformat()
        driver_id = existing.get("driver_id") or f"drv_admin_{user_id[-8:]}"
        vehicle = existing.get("vehicle") or {
            "brand": "Mercedes",
            "model": "E-Klasse",
            "plate": "BB-DRIVER-1",
            "type": "premium",
            "color": "black",
        }

        await db.drivers.update_one(
            {"user_id": user_id},
            {
                "$set": {
                    "driver_id": driver_id,
                    "user_id": user_id,
                    "user_email": admin.get("email", ""),
                    "user_name": admin.get("name", "Admin Driver"),
                    "name": existing.get("name") or admin.get("name", "Admin Driver"),
                    "phone": existing.get("phone") or admin.get("phone", ""),
                    "vehicle": vehicle,
                    "car": existing.get("car") or vehicle,
                    "rating": existing.get("rating", 5.0),
                    "balance": existing.get("balance", 0),
                    "is_verified": True,
                    "verified": True,
                    "status": "active",
                    "is_online": existing.get("is_online", False),
                    "online": existing.get("online", False),
                    "is_busy": existing.get("is_busy", False),
                    "current_location": existing.get("current_location") or {"lat": 52.52, "lng": 13.405, "updated_at": now},
                    "approved_at": existing.get("approved_at") or now,
                    "created_at": existing.get("created_at") or now,
                }
            },
            upsert=True,
        )

        await db.users.update_one(
            {"_id": admin["_id"]},
            {
                "$set": {
                    "is_driver": True,
                    "driver_status": "approved",
                    "taxi_driver_id": driver_id,
                }
            },
        )
        logger.info(f"✓ Verified driver test account ensured for {ADMIN_EMAIL}")
    except Exception as e:
        logger.warning(f"Admin driver seed failed: {e}")


async def seed_admin():
    try:
        import random

        admin_email = ADMIN_EMAIL.lower().strip()
        now = datetime.now(timezone.utc).isoformat()
        legacy_email = "admin@bidblitz.com"
        admin_aliases = ["admin@bid-blitz.ae"]
        existing = await db.users.find_one({"email": admin_email})
        legacy = await db.users.find_one({"email": legacy_email}) if admin_email != legacy_email else None
        restored_balance, restored_blz = await _reconstruct_admin_balance_from_backup(existing or legacy)
        canonical_balance_eur = restored_balance if restored_balance is not None else _safe_float((existing or legacy or {}).get("balance"), 0.0)
        canonical_balance_blz = restored_blz if restored_blz is not None else _safe_float((existing or legacy or {}).get("balance_blz"), 0.0)

        if existing is None and legacy is not None:
            await db.users.update_one(
                {"_id": legacy["_id"]},
                {
                    "$set": {
                        "email": admin_email,
                        "role": "admin",
                        "kyc_status": "approved",
                        "kyc_verified": True,
                        "email_aliases": admin_aliases,
                        "balance": canonical_balance_eur,
                        "balance_blz": canonical_balance_blz,
                    },
                    "$unset": {"password": ""},
                },
            )
            existing = await db.users.find_one({"_id": legacy["_id"]})
            logger.info(f"✓ Legacy admin migrated from {legacy_email} to {admin_email}")
        elif existing is not None and legacy is not None and str(existing["_id"]) != str(legacy["_id"]):
            await db.users.update_one(
                {"_id": existing["_id"]},
                {
                    "$set": {
                        "role": "admin",
                        "kyc_status": "approved",
                        "kyc_verified": True,
                        "email_aliases": admin_aliases,
                        "balance": canonical_balance_eur,
                        "balance_blz": canonical_balance_blz,
                    },
                    "$unset": {"password": ""},
                },
            )
            await db.users.update_one(
                {"_id": legacy["_id"]},
                {
                    "$set": {
                        "email": f"disabled-admin-{legacy['_id']}@bidblitz.local",
                        "role": "disabled",
                        "disabled_at": now,
                        "disabled_reason": "admin_migrated_to_bidblitz_ae",
                        "email_aliases": [],
                    }
                },
            )
            logger.info(f"✓ Duplicate legacy admin disabled: {legacy_email}")

        if existing is None:
            existing = await db.users.find_one({"email": admin_email})
            if existing:
                restored_balance, restored_blz = await _reconstruct_admin_balance_from_backup(existing)
                if restored_balance is not None:
                    canonical_balance_eur = restored_balance
                if restored_blz is not None:
                    canonical_balance_blz = restored_blz

        if existing is None:
            hashed = hash_password(ADMIN_PASSWORD)
            result = await db.users.insert_one({
                "email": admin_email,
                "email_aliases": admin_aliases,
                "password_hash": hashed,
                "name": "Admin",
                "role": "admin",
                "kyc_status": "approved",
                "kyc_verified": True,
                "balance": canonical_balance_eur,
                "balance_blz": canonical_balance_blz,
                "currency": "EUR",
                "card_number": f"{random.randint(4000,4999)} {random.randint(1000,9999)} {random.randint(1000,9999)} {random.randint(1000,9999)}",
                "card_expiry": "09/28",
                "created_at": now,
                "registered_at": now,
                "last_login_at": None,
                "last_login_ip": "",
                "last_login_user_agent": "",
                "login_count": 0,
            })
            await db.merchants.update_one(
                {"user_id": str(result.inserted_id)},
                {"$setOnInsert": {
                    "user_id": str(result.inserted_id),
                    "business_name": "BidBlitz HQ",
                    "total_earnings": 0.0,
                    "total_transactions": 0,
                    "created_at": now,
                }},
                upsert=True,
            )
            logger.info(f"✓ Admin user seeded: {admin_email}")
            return

        updates = {
            "role": "admin",
            "kyc_status": "approved",
            "kyc_verified": True,
            "email": admin_email,
            "email_aliases": admin_aliases,
            "balance": canonical_balance_eur,
            "balance_blz": canonical_balance_blz,
        }
        password_hash = existing.get("password_hash") or existing.get("password") or ""
        password_needs_update = True
        if password_hash:
            try:
                password_needs_update = not verify_password(ADMIN_PASSWORD, password_hash)
            except Exception:
                password_needs_update = True
        if password_needs_update:
            updates["password_hash"] = hash_password(ADMIN_PASSWORD)
            logger.info("✓ Admin password hash refreshed from environment")

        await db.users.update_one(
            {"_id": existing["_id"]},
            {
                "$set": {
                    **updates,
                    "name": "BidBlitz Admin",
                    "full_name": "BidBlitz Admin",
                    "display_name": "BidBlitz Admin",
                    "business_name": "BidBlitz Admin",
                    "merchant_business_name": "BidBlitz Admin",
                },
                "$unset": {
                    "password": "",
                    "admin_balance_note": "",
                    "admin_balance_set_at": "",
                },
            },
        )
        logger.info(f"✓ Admin seed verified: {admin_email}")
    except Exception as e:
        logger.warning(f"Admin seed failed: {e}")


async def cleanup_legacy_admin_artifacts():
    try:
        admin = await db.users.find_one({"email": ADMIN_EMAIL.lower().strip()}, {"_id": 1})
        if not admin:
            logger.warning("Legacy admin cleanup skipped: canonical admin not found")
            return

        uid = str(admin["_id"])
        canonical_email = ADMIN_EMAIL.lower().strip()
        canonical_name = "BidBlitz Admin"
        legacy_emails = ["admin@bidblitz.com", "admin-legacy-alias@bidblitz.local"]
        legacy_names = ["Admin Updated", "Admin BidBlitz", "Pizzeria Admin"]

        update_specs = [
            ("notifications", {"user_email": {"$in": legacy_emails}}, {"$set": {"user_email": canonical_email}}),
            ("affiliate_codes", {"user_email": {"$in": legacy_emails}}, {"$set": {"user_email": canonical_email}}),
            ("bookings", {"$or": [{"user_email": {"$in": legacy_emails}}, {"contact_email": {"$in": legacy_emails}}]}, {"$set": {"user_email": canonical_email, "contact_email": canonical_email}}),
            ("cashback_claims", {"user_id": uid}, {"$set": {"user_email": canonical_email}}),
            ("insurance_policies", {"user_id": uid}, {"$set": {"user_email": canonical_email, "user_name": canonical_name}}),
            ("invoices", {"user_email": {"$in": legacy_emails}}, {"$set": {"user_email": canonical_email}}),
            ("trading_bots", {"user_email": {"$in": legacy_emails}}, {"$set": {"user_email": canonical_email}}),
            ("move_profiles", {"user_id": uid}, {"$set": {"user_email": canonical_email, "user_name": canonical_name}}),
            ("ad_campaigns", {"user_email": {"$in": legacy_emails}}, {"$set": {"user_email": canonical_email}}),
            ("cashouts", {"user_email": {"$in": legacy_emails}}, {"$set": {"user_email": canonical_email}}),
            ("smm_orders", {"user_id": uid}, {"$set": {"user_email": canonical_email}}),
            ("levelup_subscriptions", {"user_email": {"$in": legacy_emails}}, {"$set": {"user_email": canonical_email}}),
            ("tax_reports", {"user_email": {"$in": legacy_emails}}, {"$set": {"user_email": canonical_email}}),
            ("food_orders", {"user_id": uid}, {"$set": {"user_email": canonical_email, "user_name": canonical_name}}),
            ("pay_sessions", {"merchant_email": {"$in": legacy_emails}}, {"$set": {"merchant_email": canonical_email, "merchant_name": canonical_name}}),
            ("ev_sessions", {"$or": [{"user_email": {"$in": legacy_emails}}, {"user_name": {"$in": legacy_names}}]}, {"$set": {"user_email": canonical_email, "user_name": canonical_name}}),
            ("taxi_saved_places", {"user_email": {"$in": legacy_emails}}, {"$set": {"user_email": canonical_email}}),
            ("stock_holdings", {"user_email": {"$in": legacy_emails}}, {"$set": {"user_email": canonical_email}}),
            ("crypto_baskets_purchases", {"user_email": {"$in": legacy_emails}}, {"$set": {"user_email": canonical_email}}),
            ("premium_subs", {"user_email": {"$in": legacy_emails}}, {"$set": {"user_email": canonical_email}}),
            ("support_tickets", {"user_id": uid}, {"$set": {"user_email": canonical_email, "user_name": canonical_name}}),
            ("appointment_bookings", {"user_email": {"$in": legacy_emails}}, {"$set": {"user_email": canonical_email}}),
            ("food_stamps", {"user_email": {"$in": legacy_emails}}, {"$set": {"user_email": canonical_email}}),
            ("flash_deals", {"merchant_email": {"$in": legacy_emails}}, {"$set": {"merchant_email": canonical_email, "merchant_name": canonical_name}}),
            ("ev_charging_sessions", {"user_id": uid}, {"$set": {"user_email": canonical_email}}),
            ("payment_transactions", {"user_id": uid}, {"$set": {"user_email": canonical_email}}),
            ("stock_trades", {"user_email": {"$in": legacy_emails}}, {"$set": {"user_email": canonical_email}}),
            ("booking_providers", {"user_email": {"$in": legacy_emails}}, {"$set": {"user_email": canonical_email}}),
            ("pay_merchant_keys", {"merchant_email": {"$in": legacy_emails}}, {"$set": {"merchant_email": canonical_email, "merchant_name": canonical_name}}),
            ("taxi_rides", {"user_id": uid}, {"$set": {"user_email": canonical_email, "user_name": canonical_name}}),
            ("prediction_bets", {"user_email": {"$in": legacy_emails}}, {"$set": {"user_email": canonical_email}}),
            ("user_cvs", {"$or": [{"user_id": uid}, {"email": {"$in": legacy_emails}}]}, {"$set": {"email": canonical_email}}),
            ("vouchers", {"merchant_id": uid}, {"$set": {"merchant_name": canonical_name}}),
            ("drivers", {"user_id": uid}, {"$set": {"name": canonical_name, "user_email": canonical_email, "user_name": canonical_name}}),
            ("scooter_rides", {"user_id": uid}, {"$set": {"user_name": canonical_name}}),
            ("transactions", {"user_email": {"$in": legacy_emails}}, {"$set": {"user_email": canonical_email}}),
            ("transactions", {"merchant_name": {"$in": legacy_names}}, {"$set": {"merchant_name": canonical_name}}),
        ]

        for coll_name, selector, update in update_specs:
            try:
                await db[coll_name].update_many(selector, update)
            except Exception as inner_exc:
                logger.warning(f"Legacy admin cleanup skipped for {coll_name}: {inner_exc}")

        try:
            await db.audit_logs.update_many(
                {"$or": [{"email": {"$in": legacy_emails}}, {"user_email": {"$in": legacy_emails}}]},
                {"$set": {"email": canonical_email, "user_email": canonical_email}},
            )
        except Exception as inner_exc:
            logger.warning(f"Legacy admin cleanup skipped for audit_logs: {inner_exc}")

        try:
            await db.audit_log.update_many(
                {"$or": [{"email": {"$in": legacy_emails}}, {"user_email": {"$in": legacy_emails}}]},
                {"$set": {"email": canonical_email, "user_email": canonical_email}},
            )
        except Exception as inner_exc:
            logger.warning(f"Legacy admin cleanup skipped for audit_log: {inner_exc}")

        try:
            await db.users.update_many(
                {"email": {"$regex": r"^disabled-admin-", "$options": "i"}},
                {"$set": {"role": "admin_legacy_disabled", "merged_into_email": canonical_email}},
            )
        except Exception as inner_exc:
            logger.warning(f"Legacy admin disabled-user cleanup skipped: {inner_exc}")

        logger.info("✓ Legacy admin artifacts cleanup completed")
    except Exception as e:
        logger.warning(f"Legacy admin cleanup failed: {e}")


@app.get("/pay.js", include_in_schema=False)
@app.get("/api/pay.js", include_in_schema=False)
async def serve_bidblitz_pay_sdk():
    return FileResponse("static/pay.js", media_type="application/javascript", filename="pay.js")

# ══════════════════════════════════════════════════════════════════════════════
# STARTUP & SHUTDOWN
# ══════════════════════════════════════════════════════════════════════════════

async def _run_post_startup_initialization():
    """Heavy startup work runs after routers are loaded and health is already available."""
    try:
        app.state.startup_status = "initializing"
        await create_indexes()
        logger.info("✓ Database indexes created")
        await seed_admin()
        await restore_admin_balance_if_needed()
        await restore_missing_legacy_wallet_users()
        await cleanup_legacy_admin_artifacts()
        await ensure_admin_driver_account()

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

        # Taxi Pre-Booking / Recurring Watchdog (iter123)
        try:
            from routes.taxi_scheduled import start_taxi_scheduled_loop
            start_taxi_scheduled_loop()
            logger.info("✓ Taxi scheduled/recurring watchdog started")
        except Exception as e:
            logger.warning(f"Taxi scheduled watchdog start failed: {e}")

        # Customer Radar Automation Scheduler
        try:
            from routes.admin_customer_intelligence import start_radar_scheduler_loop
            start_radar_scheduler_loop()
            logger.info("✓ Customer radar automation scheduler started")
        except Exception as e:
            logger.warning(f"Customer radar scheduler start failed: {e}")

        # Optional: Seed demo data if DEMO_SEED=true
        if os.environ.get("DEMO_SEED", "").lower() == "true":
            try:
                from scripts.seed_demo_data import seed_demo_data
                await seed_demo_data(db)
                logger.info("✓ Demo data seeded")
            except Exception as e:
                logger.warning(f"Demo seed failed: {e}")

        app.state.startup_status = "ready"
    except Exception as e:
        app.state.startup_status = "error"
        logger.exception(f"Post-startup initialization failed: {e}")


async def _load_routers_for_worker():
    if getattr(app.state, "routes_loaded", False):
        return
    app.state.startup_status = "routes_loading"
    register_all_routers(app)
    app.state.routes_loaded = True
    logger.info(f"✓ BidBlitz V2 API routers loaded ({APP_ENV} mode)")


async def _bootstrap_worker_routes_and_tasks():
    try:
        await asyncio.sleep(0.1)
        await _load_routers_for_worker()
        if getattr(app.state, "post_startup_lock", None) is None:
            app.state.startup_status = "ready"
            return
        await _run_post_startup_initialization()
    except Exception as e:
        app.state.startup_status = "error"
        logger.exception(f"Worker bootstrap failed: {e}")


@app.on_event("startup")
async def startup_event():
    """Return health immediately; run heavy initialization in the background."""
    app.state.startup_status = "booting"
    app.state.routes_loaded = False
    lock_file = _acquire_post_startup_lock()
    app.state.post_startup_lock = lock_file
    if lock_file is None:
        logger.info("Post-startup initialization already owned by another worker; warming routes in background")
    else:
        logger.info("🚀 Starting BidBlitz V2...")
    app.state.post_startup_task = asyncio.create_task(_bootstrap_worker_routes_and_tasks())
    logger.info("Background bootstrap scheduled")


@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown"""
    logger.info("Shutting down BidBlitz V2...")
    task = getattr(app.state, "post_startup_task", None)
    if task and not task.done():
        task.cancel()
    lock_file = getattr(app.state, "post_startup_lock", None)
    if lock_file:
        try:
            fcntl.flock(lock_file.fileno(), fcntl.LOCK_UN)
            lock_file.close()
        except Exception:
            pass
    await close_connection()
    logger.info("✓ Database connection closed")


# ══════════════════════════════════════════════════════════════════════════════
# HEALTH CHECK
# ══════════════════════════════════════════════════════════════════════════════

@app.get("/health")
async def health_check():
    """Simple health check endpoint"""
    return {
        "status": "healthy",
        "version": "2.0.0",
        "environment": APP_ENV,
        "startup_status": getattr(app.state, "startup_status", "booting"),
    }


@app.get("/ready")
async def readiness_check():
    startup_status = getattr(app.state, "startup_status", "booting")
    is_ready = startup_status == "ready"
    payload = {
        "status": "ready" if is_ready else "warming",
        "version": "2.0.0",
        "environment": APP_ENV,
        "startup_status": startup_status,
    }
    if is_ready:
        return payload
    return JSONResponse(status_code=503, content=payload)


@app.get("/")
async def root():
    """API root - redirect to docs in dev mode"""
    return {
        "app": "BidBlitz V2 API",
        "version": "2.0.0",
        "docs": "/docs" if not IS_PRODUCTION else None,
    }
