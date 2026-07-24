"""
BidBlitz V2 - Security, Anti-Fraud & System Protection
Comprehensive security middleware and fraud detection.
"""

import secrets
import hashlib
import time
from datetime import datetime, timezone, timedelta
from collections import defaultdict
from typing import Optional, Dict, Any
from fastapi import Request, HTTPException
from functools import wraps
import asyncio

from core.database import db
from core.config import TEST_MODE

# ══════════════════════════════════════
# RATE LIMITING
# ══════════════════════════════════════

# In-memory rate limit storage (use Redis in production)
rate_limit_store: Dict[str, Dict] = defaultdict(lambda: {"count": 0, "reset_at": 0})

RATE_LIMITS = {
    "login": {"max": 5, "window": 300},           # 5 attempts per 5 min
    "register": {"max": 3, "window": 600},        # 3 per 10 min
    "payment": {"max": 10, "window": 60},         # 10 per min
    "payout": {"max": 3, "window": 3600},         # 3 per hour
    "api": {"max": 100, "window": 60},            # 100 per min (general)
    "password_reset": {"max": 3, "window": 600},  # 3 per 10 min
    "otp": {"max": 5, "window": 300},             # 5 per 5 min
}


def get_client_ip(request: Request) -> str:
    """Extract client IP from request."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def check_rate_limit(key: str, limit_type: str = "api") -> bool:
    """
    Check if rate limit exceeded.
    Returns True if allowed, False if blocked.
    """
    config = RATE_LIMITS.get(limit_type, RATE_LIMITS["api"])
    now = time.time()
    
    entry = rate_limit_store[key]
    
    if now > entry["reset_at"]:
        entry["count"] = 1
        entry["reset_at"] = now + config["window"]
        return True
    
    if entry["count"] >= config["max"]:
        return False
    
    entry["count"] += 1
    return True


async def rate_limit_check(request: Request, limit_type: str = "api", identifier: str = None):
    """Check rate limit and raise exception if exceeded."""
    ip = get_client_ip(request)
    key = f"{limit_type}:{identifier or ip}"
    
    if not check_rate_limit(key, limit_type):
        config = RATE_LIMITS.get(limit_type, RATE_LIMITS["api"])
        await log_security_event(
            event_type="rate_limit_exceeded",
            ip=ip,
            details={"limit_type": limit_type, "key": key}
        )
        raise HTTPException(
            status_code=429,
            detail=f"Zu viele Anfragen. Bitte warte {config['window']} Sekunden."
        )


# ══════════════════════════════════════
# FRAUD DETECTION
# ══════════════════════════════════════

FRAUD_THRESHOLDS = {
    "transactions_per_hour": 20,
    "transactions_per_day": 100,
    "max_single_transaction": 5000.00,
    "failed_payments_trigger": 5,
    "suspicious_velocity_seconds": 10,  # Multiple transactions within 10 sec
}

# Fraud flags
FRAUD_FLAGS = {
    "high_velocity": "Zu viele Transaktionen in kurzer Zeit",
    "large_transaction": "Ungewöhnlich große Transaktion",
    "repeated_failures": "Wiederholte fehlgeschlagene Zahlungen",
    "suspicious_pattern": "Verdächtiges Verhaltensmuster",
    "multiple_ips": "Anmeldung von mehreren IPs",
    "abnormal_activity": "Ungewöhnliche Kontoaktivität",
}


async def check_fraud_signals(user_id: str, transaction_type: str, amount: float) -> Dict[str, Any]:
    """
    Check for fraud signals before processing a transaction.
    Returns dict with 'allowed' bool and 'flags' list.
    """
    flags = []
    now = datetime.now(timezone.utc)
    hour_ago = (now - timedelta(hours=1)).isoformat()
    day_ago = (now - timedelta(days=1)).isoformat()
    
    # Check transaction velocity
    hour_count = await db.transactions.count_documents({
        "user_id": user_id,
        "created_at": {"$gte": hour_ago}
    })
    
    if hour_count >= FRAUD_THRESHOLDS["transactions_per_hour"]:
        flags.append("high_velocity")
    
    # Check daily limit
    day_count = await db.transactions.count_documents({
        "user_id": user_id,
        "created_at": {"$gte": day_ago}
    })
    
    if day_count >= FRAUD_THRESHOLDS["transactions_per_day"]:
        flags.append("high_velocity")
    
    # Check large transaction
    if amount > FRAUD_THRESHOLDS["max_single_transaction"]:
        flags.append("large_transaction")
    
    # Check for rapid successive transactions
    recent_txn = await db.transactions.find_one(
        {"user_id": user_id},
        sort=[("created_at", -1)]
    )
    if recent_txn:
        try:
            last_time = datetime.fromisoformat(recent_txn["created_at"])
            if (now - last_time).total_seconds() < FRAUD_THRESHOLDS["suspicious_velocity_seconds"]:
                flags.append("suspicious_pattern")
        except ValueError:
            pass
    
    # Check failed payments
    failed_count = await db.transactions.count_documents({
        "user_id": user_id,
        "status": "failed",
        "created_at": {"$gte": day_ago}
    })
    
    if failed_count >= FRAUD_THRESHOLDS["failed_payments_trigger"]:
        flags.append("repeated_failures")
    
    # If flags detected, log and potentially block
    if flags:
        await log_security_event(
            event_type="fraud_signals_detected",
            user_id=user_id,
            details={"flags": flags, "amount": amount, "type": transaction_type}
        )
        
        # Auto-flag user if multiple signals
        if len(flags) >= 2:
            await db.users.update_one(
                {"_id": user_id} if isinstance(user_id, str) and len(user_id) == 24 else {"id": user_id},
                {"$set": {
                    "fraud_flagged": True,
                    "fraud_flags": flags,
                    "fraud_flagged_at": now.isoformat(),
                }}
            )
    
    return {
        "allowed": len(flags) < 2,  # Block if 2+ flags
        "flags": flags,
        "messages": [FRAUD_FLAGS.get(f, f) for f in flags],
    }


async def check_wallet_fraud(user_id: str, amount: float, is_debit: bool = True) -> bool:
    """
    Check wallet-specific fraud signals.
    Returns True if transaction should proceed.
    """
    user = await db.users.find_one({"_id": user_id} if isinstance(user_id, str) and len(user_id) == 24 else {"id": user_id})
    if not user:
        return False
    
    # Check if wallet is locked
    if user.get("wallet_locked"):
        return False
    
    # Check if fraud flagged
    if user.get("fraud_flagged"):
        return False
    
    # Prevent negative balance
    if is_debit:
        current_balance = user.get("balance", 0)
        if current_balance < amount:
            return False
    
    return True


# ══════════════════════════════════════
# IDEMPOTENCY (Prevent Duplicate Requests)
# ══════════════════════════════════════

idempotency_store: Dict[str, Dict] = {}


def generate_idempotency_key(user_id: str, action: str, params: str) -> str:
    """Generate idempotency key for a request."""
    data = f"{user_id}:{action}:{params}"
    return hashlib.sha256(data.encode()).hexdigest()[:32]


async def check_idempotency(key: str, ttl_seconds: int = 300) -> bool:
    """
    Check if request is duplicate.
    Returns True if this is a new request, False if duplicate.
    """
    now = time.time()
    
    # Clean old entries
    expired = [k for k, v in idempotency_store.items() if v["expires"] < now]
    for k in expired:
        del idempotency_store[k]
    
    if key in idempotency_store:
        return False  # Duplicate request
    
    idempotency_store[key] = {"expires": now + ttl_seconds}
    return True


async def ensure_idempotent(request: Request, action: str, user_id: str = None):
    """Middleware to check idempotency."""
    # Get idempotency key from header or generate
    idem_key = request.headers.get("X-Idempotency-Key")
    
    if not idem_key:
        # Generate from request data
        body = await request.body()
        idem_key = generate_idempotency_key(
            user_id or get_client_ip(request),
            action,
            body.decode()[:500]
        )
    
    if not await check_idempotency(idem_key):
        raise HTTPException(status_code=409, detail="Duplicate request detected")


# ══════════════════════════════════════
# WALLET SECURITY
# ══════════════════════════════════════

async def lock_wallet(user_id: str, reason: str, locked_by: str = "system"):
    """Lock a user's wallet."""
    from bson import ObjectId
    
    await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {
            "wallet_locked": True,
            "wallet_locked_at": datetime.now(timezone.utc).isoformat(),
            "wallet_lock_reason": reason,
            "wallet_locked_by": locked_by,
        }}
    )
    
    await log_security_event(
        event_type="wallet_locked",
        user_id=user_id,
        details={"reason": reason, "locked_by": locked_by}
    )


async def unlock_wallet(user_id: str, unlocked_by: str):
    """Unlock a user's wallet (admin only)."""
    from bson import ObjectId
    
    await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {
            "$set": {"wallet_locked": False},
            "$unset": {"wallet_locked_at": "", "wallet_lock_reason": "", "wallet_locked_by": ""}
        }
    )
    
    await log_security_event(
        event_type="wallet_unlocked",
        user_id=user_id,
        details={"unlocked_by": unlocked_by}
    )


async def validate_wallet_transaction(user_id: str, amount: float) -> Dict[str, Any]:
    """Validate a wallet transaction before processing."""
    from bson import ObjectId
    
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        return {"valid": False, "error": "User not found"}
    
    if user.get("wallet_locked"):
        return {"valid": False, "error": "Wallet gesperrt. Kontaktiere den Support."}
    
    if user.get("fraud_flagged"):
        return {"valid": False, "error": "Konto unter Überprüfung"}
    
    current_balance = user.get("balance", 0)
    if current_balance < amount:
        return {"valid": False, "error": f"Nicht genug Guthaben (€{current_balance:.2f})"}
    
    return {"valid": True, "current_balance": current_balance}


# ══════════════════════════════════════
# SESSION MANAGEMENT
# ══════════════════════════════════════

async def create_session(user_id: str, request: Request) -> str:
    """Create a new session for user."""
    session_id = secrets.token_hex(32)
    ip = get_client_ip(request)
    user_agent = request.headers.get("user-agent", "")[:500]
    
    session = {
        "session_id": session_id,
        "user_id": user_id,
        "ip": ip,
        "user_agent": user_agent,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "last_active": datetime.now(timezone.utc).isoformat(),
        "is_active": True,
    }
    
    await db.user_sessions.insert_one(session)
    
    return session_id


async def get_user_sessions(user_id: str) -> list:
    """Get all active sessions for a user."""
    sessions = await db.user_sessions.find(
        {"user_id": user_id, "is_active": True},
        {"_id": 0}
    ).sort("last_active", -1).to_list(50)
    
    return sessions


async def revoke_session(user_id: str, session_id: str):
    """Revoke a specific session."""
    await db.user_sessions.update_one(
        {"user_id": user_id, "session_id": session_id},
        {"$set": {"is_active": False, "revoked_at": datetime.now(timezone.utc).isoformat()}}
    )


async def revoke_all_sessions(user_id: str, except_current: str = None):
    """Revoke all sessions for a user."""
    query = {"user_id": user_id, "is_active": True}
    if except_current:
        query["session_id"] = {"$ne": except_current}
    
    await db.user_sessions.update_many(
        query,
        {"$set": {"is_active": False, "revoked_at": datetime.now(timezone.utc).isoformat()}}
    )


# ══════════════════════════════════════
# 2FA - EMAIL OTP
# ══════════════════════════════════════

OTP_EXPIRY_MINUTES = 10


async def generate_otp(user_id: str, purpose: str = "login") -> str:
    """Generate and store OTP for user."""
    otp = str(secrets.randbelow(900000) + 100000)  # 6-digit code
    
    await db.user_otps.insert_one({
        "user_id": user_id,
        "otp": hashlib.sha256(otp.encode()).hexdigest(),
        "purpose": purpose,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "expires_at": (datetime.now(timezone.utc) + timedelta(minutes=OTP_EXPIRY_MINUTES)).isoformat(),
        "used": False,
    })
    
    return otp


async def verify_otp(user_id: str, otp: str, purpose: str = "login") -> bool:
    """Verify OTP for user."""
    otp_hash = hashlib.sha256(otp.encode()).hexdigest()
    now = datetime.now(timezone.utc)
    
    record = await db.user_otps.find_one({
        "user_id": user_id,
        "otp": otp_hash,
        "purpose": purpose,
        "used": False,
        "expires_at": {"$gte": now.isoformat()}
    })
    
    if not record:
        return False
    
    # Mark as used
    await db.user_otps.update_one(
        {"_id": record["_id"]},
        {"$set": {"used": True, "used_at": now.isoformat()}}
    )
    
    return True


# ══════════════════════════════════════
# KYC ENFORCEMENT
# ══════════════════════════════════════

KYC_LIMITS = {
    "unverified_max_transaction": 500.00,
    "unverified_max_payout": 100.00,
    "unverified_daily_limit": 1000.00,
}


async def check_kyc_requirement(user_id: str, amount: float, transaction_type: str) -> Dict[str, Any]:
    """Check if KYC is required for transaction."""
    if TEST_MODE:
        return {"allowed": True, "kyc_verified": True, "test_mode": True}
    from bson import ObjectId
    
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        return {"allowed": False, "error": "User not found"}
    
    is_verified = user.get("verification_status") == "approved"
    
    if is_verified:
        return {"allowed": True, "kyc_verified": True}
    
    # Check limits for unverified users
    if transaction_type == "payout":
        if amount > KYC_LIMITS["unverified_max_payout"]:
            return {
                "allowed": False,
                "kyc_required": True,
                "error": f"KYC erforderlich für Auszahlungen über €{KYC_LIMITS['unverified_max_payout']:.2f}"
            }
    
    if amount > KYC_LIMITS["unverified_max_transaction"]:
        return {
            "allowed": False,
            "kyc_required": True,
            "error": f"KYC erforderlich für Transaktionen über €{KYC_LIMITS['unverified_max_transaction']:.2f}"
        }
    
    # Check daily limit
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    daily_total = await db.transactions.aggregate([
        {"$match": {"user_id": user_id, "created_at": {"$gte": today_start.isoformat()}, "amount": {"$lt": 0}}},
        {"$group": {"_id": None, "total": {"$sum": {"$abs": "$amount"}}}}
    ]).to_list(1)
    
    current_daily = daily_total[0]["total"] if daily_total else 0
    
    if current_daily + amount > KYC_LIMITS["unverified_daily_limit"]:
        return {
            "allowed": False,
            "kyc_required": True,
            "error": f"Tageslimit €{KYC_LIMITS['unverified_daily_limit']:.2f} erreicht. KYC erforderlich."
        }
    
    return {"allowed": True, "kyc_verified": False}


# ══════════════════════════════════════
# AUDIT LOGGING
# ══════════════════════════════════════

AUDIT_EVENTS = [
    "login", "logout", "register", "password_change", "password_reset",
    "payment", "payout", "refund", "wallet_lock", "wallet_unlock",
    "kyc_submit", "kyc_approve", "kyc_reject",
    "admin_action", "role_change", "fraud_flag", "fraud_clear",
    "session_create", "session_revoke",
    "rate_limit_exceeded", "fraud_signals_detected",
]


async def log_audit(
    event: str,
    user_id: str = None,
    admin_id: str = None,
    ip: str = None,
    user_agent: str = None,
    details: dict = None,
    request: Request = None,
):
    """Log an audit event."""
    if request:
        ip = ip or get_client_ip(request)
        user_agent = user_agent or request.headers.get("user-agent", "")[:500]
    
    audit_log = {
        "audit_id": secrets.token_hex(8),
        "event": event,
        "user_id": user_id,
        "admin_id": admin_id,
        "ip": ip,
        "user_agent": user_agent,
        "details": details or {},
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    
    await db.audit_logs.insert_one(audit_log)
    
    # Alert admin for critical events
    if event in ["fraud_signals_detected", "wallet_lock", "rate_limit_exceeded"]:
        await create_admin_alert(event, user_id, details)
    
    return audit_log


async def log_security_event(
    event_type: str,
    user_id: str = None,
    ip: str = None,
    details: dict = None,
):
    """Log a security-specific event."""
    await log_audit(
        event=event_type,
        user_id=user_id,
        ip=ip,
        details=details
    )


# ══════════════════════════════════════
# ADMIN ALERTS
# ══════════════════════════════════════

async def create_admin_alert(event_type: str, user_id: str = None, details: dict = None):
    """Create an alert for admin dashboard."""
    alert = {
        "alert_id": secrets.token_hex(8),
        "type": event_type,
        "user_id": user_id,
        "details": details or {},
        "severity": "high" if "fraud" in event_type else "medium",
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    
    await db.admin_alerts.insert_one(alert)


async def get_admin_alerts(limit: int = 50, unread_only: bool = False) -> list:
    """Get admin alerts."""
    query = {}
    if unread_only:
        query["read"] = False
    
    alerts = await db.admin_alerts.find(query, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    return alerts


async def mark_alert_read(alert_id: str):
    """Mark alert as read."""
    await db.admin_alerts.update_one(
        {"alert_id": alert_id},
        {"$set": {"read": True, "read_at": datetime.now(timezone.utc).isoformat()}}
    )


# ══════════════════════════════════════
# INPUT VALIDATION
# ══════════════════════════════════════

import re

def validate_email(email: str) -> bool:
    """Validate email format."""
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return bool(re.match(pattern, email))


def validate_password(password: str) -> Dict[str, Any]:
    """Validate password strength."""
    errors = []
    
    if len(password) < 8:
        errors.append("Mindestens 8 Zeichen")
    if not re.search(r'[A-Z]', password):
        errors.append("Mindestens ein Großbuchstabe")
    if not re.search(r'[a-z]', password):
        errors.append("Mindestens ein Kleinbuchstabe")
    if not re.search(r'[0-9]', password):
        errors.append("Mindestens eine Zahl")
    
    return {"valid": len(errors) == 0, "errors": errors}


def sanitize_input(text: str, max_length: int = 1000) -> str:
    """Sanitize user input."""
    if not text:
        return ""
    # Remove control characters
    text = re.sub(r'[\x00-\x1f\x7f-\x9f]', '', text)
    # Limit length
    return text[:max_length].strip()


# ══════════════════════════════════════
# SECURITY MIDDLEWARE
# ══════════════════════════════════════

async def security_check_middleware(request: Request, user_id: str = None):
    """
    Comprehensive security check to run before sensitive operations.
    """
    ip = get_client_ip(request)
    
    # Check IP-based rate limit
    await rate_limit_check(request, "api", ip)
    
    # Check if IP is banned
    banned = await db.banned_ips.find_one({"ip": ip, "active": True})
    if banned:
        raise HTTPException(status_code=403, detail="Zugriff verweigert")
    
    # If user authenticated, check user-specific limits
    if user_id:
        user_key = f"user:{user_id}"
        await rate_limit_check(request, "api", user_key)
        
        # Check if user is banned
        from bson import ObjectId
        user = await db.users.find_one({"_id": ObjectId(user_id)})
        if user and user.get("banned"):
            raise HTTPException(status_code=403, detail="Konto gesperrt")
