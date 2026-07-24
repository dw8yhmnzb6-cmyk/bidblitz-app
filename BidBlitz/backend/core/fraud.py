"""
BidBlitz V2 - Fraud Detection & Prevention
Basic checks for duplicate payments, rapid requests, suspicious patterns
"""

import hashlib
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, Tuple
from core.database import db

logger = logging.getLogger("bidblitz.fraud")

# ── Fraud Thresholds ──
MAX_PAYMENTS_PER_MINUTE = 5
MAX_PAYMENTS_PER_HOUR = 30
MAX_TOPUPS_PER_HOUR = 5
MAX_FAILED_PAYMENTS_PER_HOUR = 10
DUPLICATE_WINDOW_SECONDS = 60
SUSPICIOUS_AMOUNT_THRESHOLD = 5000  # EUR


async def check_duplicate_payment(
    user_id: str,
    amount: float,
    payment_type: str,
    recipient_id: Optional[str] = None
) -> Tuple[bool, str]:
    """
    Check for duplicate payment within time window.
    Returns (is_duplicate, reason)
    """
    window_start = datetime.now(timezone.utc) - timedelta(seconds=DUPLICATE_WINDOW_SECONDS)
    
    query = {
        "user_id": user_id,
        "amount": amount,
        "type": payment_type,
        "created_at": {"$gte": window_start.isoformat()}
    }
    if recipient_id:
        query["recipient_id"] = recipient_id
    
    existing = await db.transactions.find_one(query)
    if existing:
        logger.warning(f"FRAUD: Duplicate payment detected user={user_id} amount={amount} type={payment_type}")
        return True, "Duplicate payment detected. Please wait before retrying."
    
    return False, ""


async def check_rapid_requests(
    user_id: str,
    request_type: str
) -> Tuple[bool, str]:
    """
    Check for rapid/excessive requests.
    Returns (is_blocked, reason)
    """
    now = datetime.now(timezone.utc)
    minute_ago = now - timedelta(minutes=1)
    hour_ago = now - timedelta(hours=1)
    
    if request_type in ("payment", "send", "purchase"):
        # Check per-minute limit
        minute_count = await db.transactions.count_documents({
            "user_id": user_id,
            "created_at": {"$gte": minute_ago.isoformat()}
        })
        if minute_count >= MAX_PAYMENTS_PER_MINUTE:
            logger.warning(f"FRAUD: Rapid payments user={user_id} count={minute_count}/min")
            return True, "Too many transactions. Please wait a moment."
        
        # Check per-hour limit
        hour_count = await db.transactions.count_documents({
            "user_id": user_id,
            "created_at": {"$gte": hour_ago.isoformat()}
        })
        if hour_count >= MAX_PAYMENTS_PER_HOUR:
            logger.warning(f"FRAUD: Excessive payments user={user_id} count={hour_count}/hr")
            return True, "Transaction limit reached. Please try again later."
    
    elif request_type == "topup":
        hour_count = await db.payment_transactions.count_documents({
            "user_id": user_id,
            "type": "topup",
            "created_at": {"$gte": hour_ago.isoformat()}
        })
        if hour_count >= MAX_TOPUPS_PER_HOUR:
            logger.warning(f"FRAUD: Excessive topups user={user_id} count={hour_count}/hr")
            return True, "Top-up limit reached. Please try again later."
    
    return False, ""


async def check_failed_payments(user_id: str) -> Tuple[bool, str]:
    """
    Check for excessive failed payment attempts (card testing).
    Returns (is_blocked, reason)
    """
    hour_ago = datetime.now(timezone.utc) - timedelta(hours=1)
    
    failed_count = await db.payment_transactions.count_documents({
        "user_id": user_id,
        "status": {"$in": ["failed", "declined", "error"]},
        "created_at": {"$gte": hour_ago.isoformat()}
    })
    
    if failed_count >= MAX_FAILED_PAYMENTS_PER_HOUR:
        logger.warning(f"FRAUD: Card testing detected user={user_id} failed={failed_count}/hr")
        return True, "Too many failed attempts. Account temporarily restricted."
    
    return False, ""


async def check_suspicious_amount(
    user_id: str,
    amount: float,
    user_balance: float
) -> Tuple[bool, str]:
    """
    Check for suspicious transaction amounts.
    Returns (is_suspicious, reason)
    """
    # Flag very large transactions
    if amount >= SUSPICIOUS_AMOUNT_THRESHOLD:
        logger.info(f"FRAUD: Large transaction flagged user={user_id} amount={amount}")
        # Log for review but don't block
        await db.fraud_alerts.insert_one({
            "user_id": user_id,
            "type": "large_transaction",
            "amount": amount,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "status": "pending_review"
        })
    
    # Block if amount exceeds balance by a lot (potential exploit)
    if amount > user_balance * 1.5 and amount > 100:
        logger.warning(f"FRAUD: Amount exceeds balance user={user_id} amount={amount} balance={user_balance}")
        return True, "Transaction amount exceeds available balance."
    
    return False, ""


async def log_fraud_event(
    user_id: str,
    event_type: str,
    details: dict,
    ip_address: str = "",
    severity: str = "medium"
):
    """Log a fraud event for analysis."""
    await db.fraud_logs.insert_one({
        "user_id": user_id,
        "event_type": event_type,
        "details": details,
        "ip_address": ip_address,
        "severity": severity,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "reviewed": False
    })


async def run_fraud_checks(
    user_id: str,
    amount: float,
    payment_type: str,
    user_balance: float,
    recipient_id: Optional[str] = None
) -> Tuple[bool, str]:
    """
    Run all fraud checks for a transaction.
    Returns (is_allowed, error_message)
    """
    # Check duplicate
    is_dup, msg = await check_duplicate_payment(user_id, amount, payment_type, recipient_id)
    if is_dup:
        return False, msg
    
    # Check rapid requests
    is_rapid, msg = await check_rapid_requests(user_id, payment_type)
    if is_rapid:
        return False, msg
    
    # Check failed payments
    is_blocked, msg = await check_failed_payments(user_id)
    if is_blocked:
        return False, msg
    
    # Check suspicious amount
    is_sus, msg = await check_suspicious_amount(user_id, amount, user_balance)
    if is_sus:
        return False, msg
    
    return True, ""


def generate_idempotency_key(user_id: str, amount: float, payment_type: str, extra: str = "") -> str:
    """Generate unique key to prevent duplicate processing."""
    data = f"{user_id}:{amount}:{payment_type}:{extra}:{datetime.now(timezone.utc).strftime('%Y%m%d%H%M')}"
    return hashlib.sha256(data.encode()).hexdigest()[:32]
