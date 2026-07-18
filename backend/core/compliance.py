"""
BidBlitz V2 - Compliance & Transaction Monitoring
Structured checks for KYC limits, velocity detection, and suspicious activity flagging.
"""

from datetime import datetime, timezone, timedelta
from core.database import db
from core.config import TEST_MODE
from bson import ObjectId
import logging

logger = logging.getLogger("bidblitz.compliance")

# ── Outcome constants ──
PASSED = "passed"
FLAGGED = "flagged"
BLOCKED = "blocked"
REQUIRES_REVIEW = "requires_review"

# ── Transaction limits (per KYC level) ──
KYC_LEVELS = {
    "none":     {"daily_limit": 500,    "monthly_limit": 2000,    "single_max": 250},
    "basic":    {"daily_limit": 5000,   "monthly_limit": 50000,   "single_max": 2500},
    "verified": {"daily_limit": 25000,  "monthly_limit": 250000,  "single_max": 10000},
    "premium":  {"daily_limit": 100000, "monthly_limit": 1000000, "single_max": 50000},
}

# ── Type-specific limits (applied on top of KYC) ──
TYPE_LIMITS = {
    "payment":  {"single_max": 2500, "daily": 5000,  "monthly": 50000},
    "send":     {"single_max": 1000, "daily": 2000,  "monthly": 20000},
    "topup":    {"single_max": 500,  "daily": 10000, "monthly": 50000},
    "payout":   {"single_max": 5000, "daily": 5000,  "monthly": 25000},
}

# ── Velocity thresholds ──
VELOCITY = {
    "max_txns_per_minute": 5,
    "max_txns_per_hour": 30,
    "rapid_window_seconds": 60,
    "hourly_window_seconds": 3600,
}

# ── Payout risk thresholds ──
PAYOUT_RISK = {
    "large_payout_threshold": 500,
    "max_pending_payouts": 3,
}


async def _get_kyc_level(user_id: str) -> dict:
    """Get user's KYC level and limits."""
    if TEST_MODE:
        return {"level": "verified", "limits": KYC_LEVELS["verified"]}
    user = await db.users.find_one({"_id": ObjectId(user_id)}, {"kyc_level": 1})
    level = user.get("kyc_level", "basic") if user else "none"
    return {"level": level, "limits": KYC_LEVELS.get(level, KYC_LEVELS["none"])}


async def _get_daily_volume(user_id: str, txn_type: str) -> float:
    """Sum of today's completed transactions of a given type."""
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    pipeline = [
        {"$match": {"user_id": user_id, "type": txn_type, "status": "completed", "created_at": {"$gte": today_start}}},
        {"$group": {"_id": None, "total": {"$sum": {"$abs": "$amount"}}}},
    ]
    agg = await db.transactions.aggregate(pipeline).to_list(1)
    return agg[0]["total"] if agg else 0


async def _get_monthly_volume(user_id: str, txn_type: str) -> float:
    """Sum of this month's completed transactions of a given type."""
    month_start = datetime.now(timezone.utc).replace(day=1, hour=0, minute=0, second=0, microsecond=0).isoformat()
    pipeline = [
        {"$match": {"user_id": user_id, "type": txn_type, "status": "completed", "created_at": {"$gte": month_start}}},
        {"$group": {"_id": None, "total": {"$sum": {"$abs": "$amount"}}}},
    ]
    agg = await db.transactions.aggregate(pipeline).to_list(1)
    return agg[0]["total"] if agg else 0


async def _check_velocity(user_id: str) -> dict:
    """Detect rapid/unusual transaction frequency."""
    now = datetime.now(timezone.utc)
    minute_ago = (now - timedelta(seconds=VELOCITY["rapid_window_seconds"])).isoformat()
    hour_ago = (now - timedelta(seconds=VELOCITY["hourly_window_seconds"])).isoformat()

    recent_minute = await db.transactions.count_documents({"user_id": user_id, "created_at": {"$gte": minute_ago}})
    recent_hour = await db.transactions.count_documents({"user_id": user_id, "created_at": {"$gte": hour_ago}})

    if recent_minute >= VELOCITY["max_txns_per_minute"]:
        return {"triggered": True, "rule": "rapid_velocity", "detail": f"{recent_minute} txns in last minute"}
    if recent_hour >= VELOCITY["max_txns_per_hour"]:
        return {"triggered": True, "rule": "hourly_velocity", "detail": f"{recent_hour} txns in last hour"}
    return {"triggered": False}


async def _check_payout_risk(user_id: str, merchant_id: str, amount: float) -> dict:
    """Evaluate payout risk signals."""
    issues = []

    if amount >= PAYOUT_RISK["large_payout_threshold"]:
        issues.append({"rule": "large_payout", "detail": f"Amount EUR {amount:.2f} exceeds threshold"})

    pending = await db.payouts.count_documents({"merchant_id": merchant_id, "status": {"$in": ["pending", "approved"]}})
    if pending >= PAYOUT_RISK["max_pending_payouts"]:
        issues.append({"rule": "too_many_pending", "detail": f"{pending} pending payouts"})

    # Check if merchant account is very new (< 7 days) with high payout
    merchant = await db.merchants.find_one({"_id": ObjectId(merchant_id)} if ObjectId.is_valid(merchant_id) else {"user_id": user_id})
    if merchant:
        created = merchant.get("created_at", "")
        if created:
            try:
                age = datetime.now(timezone.utc) - datetime.fromisoformat(created.replace("Z", "+00:00"))
                if age < timedelta(days=7) and amount > 100:
                    issues.append({"rule": "new_merchant_large_payout", "detail": f"Account age: {age.days}d, amount: EUR {amount:.2f}"})
            except (ValueError, TypeError):
                pass

    return {"triggered": len(issues) > 0, "issues": issues}


async def record_compliance_check(
    user_id: str,
    txn_type: str,
    amount: float,
    outcome: str,
    rules_triggered: list = None,
    details: dict = None,
):
    """Store compliance check result for audit trail."""
    entry = {
        "user_id": user_id,
        "txn_type": txn_type,
        "amount": amount,
        "outcome": outcome,
        "rules_triggered": rules_triggered or [],
        "details": details or {},
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    try:
        await db.compliance_checks.insert_one(entry)
    except Exception as e:
        logger.error(f"Compliance record write failed: {e}")


async def flag_suspicious_activity(user_id: str, reason: str, txn_type: str = "", amount: float = 0, details: dict = None):
    """Flag a user/transaction for admin review."""
    try:
        await db.compliance_flags.insert_one({
            "user_id": user_id,
            "reason": reason,
            "txn_type": txn_type,
            "amount": amount,
            "details": details or {},
            "status": "open",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "resolved_at": None,
            "resolved_by": None,
        })
    except Exception as e:
        logger.error(f"Compliance flag write failed: {e}")


async def run_compliance_check(user_id: str, txn_type: str, amount: float) -> dict:
    """
    Unified compliance gate. Returns:
    {
        "outcome": "passed" | "flagged" | "blocked",
        "reason": "" | "human-safe message",
        "rules": []  # internal rule names triggered
    }
    Fails safely — returns passed on internal errors.
    """
    try:
        rules_triggered = []
        type_limits = TYPE_LIMITS.get(txn_type, {})

        # ── 1. Single transaction max ──
        single_max = type_limits.get("single_max", 999999)
        if amount > single_max:
            rules_triggered.append("single_max_exceeded")
            await record_compliance_check(user_id, txn_type, amount, BLOCKED, rules_triggered)
            return {"outcome": BLOCKED, "reason": f"compliance.single_max|{single_max}", "rules": rules_triggered}

        # ── 2. KYC-aware daily limit ──
        kyc = await _get_kyc_level(user_id)
        kyc_daily = kyc["limits"]["daily_limit"]
        type_daily = type_limits.get("daily", kyc_daily)
        effective_daily = min(kyc_daily, type_daily)

        daily_vol = await _get_daily_volume(user_id, txn_type)
        if daily_vol + amount > effective_daily:
            remaining = max(0, effective_daily - daily_vol)
            rules_triggered.append("daily_limit_exceeded")
            await record_compliance_check(user_id, txn_type, amount, BLOCKED, rules_triggered)
            return {"outcome": BLOCKED, "reason": f"compliance.daily_limit|{remaining:.2f}", "rules": rules_triggered}

        # ── 3. Monthly limit ──
        type_monthly = type_limits.get("monthly", kyc["limits"]["monthly_limit"])
        monthly_vol = await _get_monthly_volume(user_id, txn_type)
        if monthly_vol + amount > type_monthly:
            rules_triggered.append("monthly_limit_exceeded")
            await record_compliance_check(user_id, txn_type, amount, BLOCKED, rules_triggered)
            return {"outcome": BLOCKED, "reason": "compliance.monthly_limit", "rules": rules_triggered}

        # ── 4. Velocity check ──
        velocity = await _check_velocity(user_id)
        if velocity["triggered"]:
            rules_triggered.append(velocity["rule"])
            await flag_suspicious_activity(user_id, velocity["rule"], txn_type, amount, velocity)
            await record_compliance_check(user_id, txn_type, amount, FLAGGED, rules_triggered)
            return {"outcome": FLAGGED, "reason": "compliance.velocity", "rules": rules_triggered}

        # ── 5. Payout-specific risk ──
        if txn_type == "payout":
            # merchant_id is embedded in details, but we can look it up
            merchant = await db.merchants.find_one({"user_id": user_id})
            if merchant:
                payout_risk = await _check_payout_risk(user_id, str(merchant["_id"]), amount)
                if payout_risk["triggered"]:
                    for issue in payout_risk["issues"]:
                        rules_triggered.append(issue["rule"])
                    if any(i["rule"] == "too_many_pending" for i in payout_risk["issues"]):
                        await record_compliance_check(user_id, txn_type, amount, BLOCKED, rules_triggered)
                        return {"outcome": BLOCKED, "reason": "compliance.payout_pending_limit", "rules": rules_triggered}
                    # Flag but allow for large/new merchant payouts
                    await flag_suspicious_activity(user_id, "payout_risk", txn_type, amount,
                                                   {"issues": [i["detail"] for i in payout_risk["issues"]]})
                    await record_compliance_check(user_id, txn_type, amount, FLAGGED, rules_triggered)
                    return {"outcome": FLAGGED, "reason": "", "rules": rules_triggered}

        # ── All checks passed ──
        await record_compliance_check(user_id, txn_type, amount, PASSED)
        return {"outcome": PASSED, "reason": "", "rules": []}

    except Exception as e:
        # Fail open — compliance errors must not block legitimate transactions
        logger.error(f"Compliance check failed: {e}")
        try:
            await record_compliance_check(user_id, txn_type, amount, PASSED, ["error_failopen"], {"error": str(e)})
        except Exception:
            pass
        return {"outcome": PASSED, "reason": "", "rules": ["error_failopen"]}
