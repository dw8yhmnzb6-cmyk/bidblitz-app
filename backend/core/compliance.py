"""
BidBlitz V2 - Compliance & Transaction Limits
Placeholder structures for KYC, limits, and suspicious activity detection.
"""

from datetime import datetime, timezone, timedelta
from core.database import db

# Transaction limits (daily/monthly per user)
TRANSACTION_LIMITS = {
    "daily_payment_limit": 5000.0,
    "daily_send_limit": 2000.0,
    "monthly_payment_limit": 50000.0,
    "monthly_send_limit": 20000.0,
    "single_payment_max": 2500.0,
    "single_send_max": 1000.0,
    "daily_topup_limit": 10000.0,
}

# KYC verification levels
KYC_LEVELS = {
    "none": {"daily_limit": 500, "monthly_limit": 2000},
    "basic": {"daily_limit": 5000, "monthly_limit": 50000},
    "verified": {"daily_limit": 25000, "monthly_limit": 250000},
    "premium": {"daily_limit": 100000, "monthly_limit": 1000000},
}


async def check_transaction_limit(user_id: str, txn_type: str, amount: float) -> dict:
    """
    Check if a transaction is within allowed limits.
    Returns {"allowed": True/False, "reason": str}
    """
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0).isoformat()

    # Check single transaction max
    if txn_type == "payment" and amount > TRANSACTION_LIMITS["single_payment_max"]:
        return {"allowed": False, "reason": f"Single payment cannot exceed EUR {TRANSACTION_LIMITS['single_payment_max']:.2f}"}
    if txn_type == "send" and amount > TRANSACTION_LIMITS["single_send_max"]:
        return {"allowed": False, "reason": f"Single transfer cannot exceed EUR {TRANSACTION_LIMITS['single_send_max']:.2f}"}

    # Check daily volume
    daily_key = f"daily_{txn_type}_limit"
    if daily_key in TRANSACTION_LIMITS:
        pipeline = [
            {"$match": {
                "user_id": user_id,
                "type": txn_type,
                "status": "completed",
                "created_at": {"$gte": today_start},
            }},
            {"$group": {"_id": None, "total": {"$sum": {"$abs": "$amount"}}}},
        ]
        agg = await db.transactions.aggregate(pipeline).to_list(1)
        daily_total = agg[0]["total"] if agg else 0

        if daily_total + amount > TRANSACTION_LIMITS[daily_key]:
            remaining = max(0, TRANSACTION_LIMITS[daily_key] - daily_total)
            return {"allowed": False, "reason": f"Daily {txn_type} limit reached. Remaining: EUR {remaining:.2f}"}

    # Check monthly volume
    monthly_key = f"monthly_{txn_type}_limit"
    if monthly_key in TRANSACTION_LIMITS:
        pipeline = [
            {"$match": {
                "user_id": user_id,
                "type": txn_type,
                "status": "completed",
                "created_at": {"$gte": month_start},
            }},
            {"$group": {"_id": None, "total": {"$sum": {"$abs": "$amount"}}}},
        ]
        agg = await db.transactions.aggregate(pipeline).to_list(1)
        monthly_total = agg[0]["total"] if agg else 0

        if monthly_total + amount > TRANSACTION_LIMITS[monthly_key]:
            return {"allowed": False, "reason": f"Monthly {txn_type} limit reached."}

    return {"allowed": True, "reason": ""}


async def flag_suspicious_activity(user_id: str, reason: str, details: dict = None):
    """Flag a user account for suspicious activity."""
    await db.suspicious_flags.insert_one({
        "user_id": user_id,
        "reason": reason,
        "details": details or {},
        "status": "open",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "resolved_at": None,
    })


async def get_user_kyc_status(user_id: str) -> dict:
    """Get KYC verification status for a user."""
    user = await db.users.find_one({"_id": __import__("bson").ObjectId(user_id)})
    if not user:
        return {"level": "none", "verified": False}
    kyc_level = user.get("kyc_level", "basic")
    return {
        "level": kyc_level,
        "verified": kyc_level in ("verified", "premium"),
        "limits": KYC_LEVELS.get(kyc_level, KYC_LEVELS["none"]),
    }
