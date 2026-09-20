"""
BidBlitz V2 - Unified Payment Engine
Central payment processing with atomic transactions, duplicate prevention,
and full audit logging. ALL money flows must go through this module.
"""

import secrets
import hashlib
import math
from datetime import datetime, timezone
from typing import Optional, Dict, Any, Literal
from enum import Enum
from bson import ObjectId
from pydantic import BaseModel, Field

from core.database import db
from core.merchant_commission import MIN_MERCHANT_COMMISSION_RATE, effective_merchant_rate
from core.canonical_wallet_service import (
    credit_canonical_balance,
    debit_canonical_balance,
    sync_canonical_balance,
    transfer_canonical_balance,
)

# ══════════════════════════════════════════════════════════════════════════════
# CONSTANTS & ENUMS
# ══════════════════════════════════════════════════════════════════════════════

class TransactionStatus(str, Enum):
    PENDING = "pending"
    COMPLETED = "completed"
    FAILED = "failed"
    REVERSED = "reversed"
    RECONCILIATION_REQUIRED = "reconciliation_required"


class TransactionType(str, Enum):
    TOPUP = "topup"
    PAYMENT = "payment"
    TRANSFER = "transfer"
    REFUND = "refund"
    RESALE_PURCHASE = "resale_purchase"
    RESALE_SALE = "resale_sale"
    REWARD = "reward"  # Gaming rewards
    LOYALTY_CASHBACK = "loyalty_cashback"
    AUCTION_BID = "auction_bid"
    AUCTION_WIN = "auction_win"
    MINING_PURCHASE = "mining_purchase"
    MINING_REWARD = "mining_reward"
    TAXI_PAYMENT = "taxi_payment"
    SCOOTER_PAYMENT = "scooter_payment"
    FOOD_PAYMENT = "food_payment"
    KIDS_TRANSFER = "kids_transfer"
    KIDS_PAYMENT = "kids_payment"
    MERCHANT_CREDIT = "merchant_credit"
    MERCHANT_PAYMENT = "merchant_payment"  # M2M: Sender
    MERCHANT_PAYMENT_RECEIVED = "merchant_payment_received"  # M2M: Recipient
    PAYOUT = "payout"
    FEE = "fee"
    STRIPE_TOPUP = "stripe_topup"
    SUBSCRIPTION = "subscription"
    SUBSCRIPTION_RENEWAL = "subscription_renewal"
    ADMIN_CREDIT = "admin_credit"  # Admin sends money without fees
    ADMIN_DEBIT = "admin_debit"
    VOUCHER_REDEMPTION = "voucher_redemption"  # POS Gutschein einlösen
    VOUCHER_CREATION = "voucher_creation"  # Gutschein aus Händler-Wallet erzeugen
    WALLET_TOPUP_POS = "wallet_topup_pos"  # Wallet aufladen am POS
    EV_CHARGING = "ev_charging"  # EV Charging session payment
    EV_CHARGING_REVENUE = "ev_charging_revenue"  # Operator/Merchant revenue from EV charging
    DRIVER_EARNINGS = "driver_earnings"  # Taxi/Food driver payout per ride
    RECONCILIATION_SYNC = "reconciliation_sync"  # Audit-only sync of users.balance to approved target


# Idempotency cache (in-memory for this session, should be Redis in production)
_idempotency_cache: Dict[str, str] = {}


# ══════════════════════════════════════════════════════════════════════════════
# HELPER FUNCTIONS
# ══════════════════════════════════════════════════════════════════════════════

def generate_transaction_id() -> str:
    """Generate unique transaction ID."""
    return f"TXN-{secrets.token_hex(8).upper()}"


def generate_reference(prefix: str = "BLZ") -> str:
    """Generate unique reference code."""
    return f"{prefix}-{secrets.token_hex(4).upper()}"


def compute_idempotency_key(user_id: str, tx_type: str, amount: float, reference: str) -> str:
    """Compute idempotency key to prevent duplicate transactions."""
    data = f"{user_id}:{tx_type}:{amount}:{reference}"
    return hashlib.sha256(data.encode()).hexdigest()[:32]


async def check_idempotency(idempotency_key: str) -> Optional[Dict]:
    """Check if transaction with this idempotency key already exists."""
    existing = await db.transactions.find_one(
        {"idempotency_key": idempotency_key},
        {"_id": 0}
    )
    return existing


async def get_user_balance(user_id: str) -> float:
    """Get current user balance."""
    if ObjectId.is_valid(user_id):
        user = await db.users.find_one({"_id": ObjectId(user_id)})
    else:
        user = await db.users.find_one({"_id": user_id})
    
    if not user:
        raise ValueError(f"User not found: {user_id}")
    
    return round(user.get("balance", 0.0), 2)


async def log_audit(
    action: str,
    user_id: str,
    details: Dict[str, Any],
    status: str = "success",
    ip: str = None
):
    """Log action to audit trail."""
    await db.audit_log.insert_one({
        "id": secrets.token_hex(8),
        "action": action,
        "user_id": user_id,
        "details": details,
        "status": status,
        "ip_address": ip,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })


# ══════════════════════════════════════════════════════════════════════════════
# CORE PAYMENT ENGINE
# ══════════════════════════════════════════════════════════════════════════════

class PaymentResult(BaseModel):
    """Result of a payment operation."""
    success: bool
    transaction_id: Optional[str] = None
    reference: Optional[str] = None
    new_balance: Optional[float] = None
    error: Optional[str] = None
    status: TransactionStatus = TransactionStatus.PENDING
    idempotent_replay: bool = False


def build_wallet_ledger_metadata(
    *,
    user_id: str,
    wallet_id: Optional[str],
    tx_type: TransactionType,
    amount: float,
    status: TransactionStatus,
    source: str,
    reference_id: str,
    idempotency_key: str,
    direction: Literal["credit", "debit"],
    audit_metadata: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    return {
        "transaction_id": "",
        "user_id": user_id,
        "wallet_id": wallet_id or user_id,
        "type": tx_type.value,
        "amount": round(float(amount or 0), 2),
        "currency": "EUR",
        "direction": direction,
        "status": status.value,
        "source": source,
        "reference_id": reference_id,
        "idempotency_key": idempotency_key,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "audit_metadata": audit_metadata or {},
    }


async def debit_wallet(
    user_id: str,
    amount: float,
    tx_type: TransactionType,
    description: str,
    reference: Optional[str] = None,
    merchant_id: Optional[str] = None,
    merchant_name: Optional[str] = None,
    metadata: Optional[Dict] = None,
    idempotency_key: Optional[str] = None,
) -> PaymentResult:
    """
    DEBIT (subtract) from user wallet with full safety.
    
    - Validates positive amount
    - Checks sufficient balance
    - Prevents double spending via idempotency
    - Atomic balance update
    - Full audit logging
    """
    
    # With an explicit key, canonical recovery owns the persisted reference.
    # Generating a fresh one here turns a valid retry into a payload conflict.
    ref = reference if idempotency_key else (reference or generate_reference())
    if not idempotency_key:
        idempotency_key = compute_idempotency_key(user_id, tx_type.value, amount, ref)
    result = await debit_canonical_balance(
        user_id=user_id,
        amount_major=amount,
        tx_type=tx_type.value,
        description=description,
        reference=ref,
        metadata=metadata,
        idempotency_key=idempotency_key,
        source="payment_engine",
        merchant_id=merchant_id,
        merchant_name=merchant_name,
    )
    return PaymentResult(
        success=result.success,
        transaction_id=result.transaction_id,
        reference=result.reference,
        new_balance=result.new_balance,
        error=result.error,
        status=TransactionStatus(result.status),
        idempotent_replay=getattr(result, "idempotent_replay", False),
    )


async def credit_wallet(
    user_id: str,
    amount: float,
    tx_type: TransactionType,
    description: str,
    reference: Optional[str] = None,
    source: Optional[str] = None,
    metadata: Optional[Dict] = None,
    idempotency_key: Optional[str] = None,
) -> PaymentResult:
    """
    CREDIT (add) to user wallet with full safety.
    
    - Validates positive amount
    - Prevents duplicate credits via idempotency
    - Atomic balance update
    - Full audit logging
    """
    
    ref = reference if idempotency_key else (reference or generate_reference())
    if not idempotency_key:
        idempotency_key = compute_idempotency_key(user_id, tx_type.value, amount, ref)
    result = await credit_canonical_balance(
        user_id=user_id,
        amount_major=amount,
        tx_type=tx_type.value,
        description=description,
        reference=ref,
        source=source or "payment_engine",
        metadata=metadata,
        idempotency_key=idempotency_key,
    )
    return PaymentResult(
        success=result.success,
        transaction_id=result.transaction_id,
        reference=result.reference,
        new_balance=result.new_balance,
        error=result.error,
        status=TransactionStatus(result.status),
        idempotent_replay=getattr(result, "idempotent_replay", False),
    )


async def transfer_between_wallets(
    from_user_id: str,
    to_user_id: str,
    amount: float,
    tx_type: TransactionType,
    description: str,
    reference: Optional[str] = None,
    metadata: Optional[Dict] = None,
    idempotency_key: Optional[str] = None,
) -> PaymentResult:
    """
    Transfer between two wallets atomically.
    Either both succeed or both fail.
    """
    
    ref = reference if idempotency_key else (reference or generate_reference("TRF"))
    idem = idempotency_key or compute_idempotency_key(from_user_id, f"{tx_type.value}_transfer", amount, ref)
    result = await transfer_canonical_balance(
        from_user_id=from_user_id,
        to_user_id=to_user_id,
        amount_major=amount,
        tx_type=tx_type.value,
        description=description,
        reference=ref,
        metadata=metadata,
        idempotency_key=idem,
    )
    return PaymentResult(
        success=result.success,
        transaction_id=result.transaction_id,
        reference=result.reference,
        new_balance=result.new_balance,
        error=result.error,
        status=TransactionStatus(result.status),
        idempotent_replay=getattr(result, "idempotent_replay", False),
    )


async def sync_wallet_balance(
    user_id: str,
    target_balance: float,
    description: str,
    reference: Optional[str] = None,
    metadata: Optional[Dict] = None,
    idempotency_key: Optional[str] = None,
) -> PaymentResult:
    """
    Repair helper for reconciliation-approved balance projection syncs.
    Does not represent a new money movement, so ledger amount stays 0.
    """

    ref = reference or generate_reference("SYNC")
    if not idempotency_key:
        idempotency_key = compute_idempotency_key(user_id, TransactionType.RECONCILIATION_SYNC.value, target_balance, ref)
    result = await sync_canonical_balance(
        user_id=user_id,
        target_balance_major=target_balance,
        description=description,
        reference=ref,
        metadata=metadata,
        idempotency_key=idempotency_key,
    )
    return PaymentResult(
        success=result.success,
        transaction_id=result.transaction_id,
        reference=result.reference,
        new_balance=result.new_balance,
        error=result.error,
        status=TransactionStatus(result.status),
    )


# ══════════════════════════════════════════════════════════════════════════════
# STRIPE WEBHOOK SAFETY
# ══════════════════════════════════════════════════════════════════════════════

async def process_stripe_payment(
    session_id: str,
    user_id: str,
    amount: float,
    payment_intent_id: Optional[str] = None
) -> PaymentResult:
    """
    Process Stripe payment with full duplicate protection.
    Uses session_id as idempotency key.
    """
    
    # Use session_id as idempotency key
    idempotency_key = f"stripe_{session_id}"
    
    # Check if already processed
    existing = await db.transactions.find_one(
        {"idempotency_key": idempotency_key},
        {"_id": 0}
    )
    
    if existing:
        if existing.get("status") == "completed":
            return PaymentResult(
                success=True,
                transaction_id=existing.get("id"),
                reference=existing.get("reference"),
                new_balance=await get_user_balance(user_id),
                status=TransactionStatus.COMPLETED
            )
        elif existing.get("status") == "pending":
            # Transaction in progress
            return PaymentResult(
                success=False,
                error="Payment already processing",
                status=TransactionStatus.PENDING
            )
    
    # Check payment_transactions table too (legacy)
    legacy_check = await db.payment_transactions.find_one(
        {"session_id": session_id, "status": "completed"}
    )
    if legacy_check:
        return PaymentResult(
            success=True,
            transaction_id=legacy_check.get("id", session_id),
            reference=session_id,
            new_balance=await get_user_balance(user_id),
            status=TransactionStatus.COMPLETED
        )
    
    # Process the credit
    result = await credit_wallet(
        user_id=user_id,
        amount=amount,
        tx_type=TransactionType.STRIPE_TOPUP,
        description="Stripe Top-Up",
        reference=session_id,
        source="stripe",
        metadata={
            "session_id": session_id,
            "payment_intent_id": payment_intent_id,
        },
        idempotency_key=idempotency_key
    )
    
    # Update legacy payment_transactions table
    await db.payment_transactions.update_one(
        {"session_id": session_id},
        {"$set": {
            "status": "completed" if result.success else "failed",
            "processed_at": datetime.now(timezone.utc).isoformat(),
            "transaction_id": result.transaction_id
        }}
    )
    
    return result


# ══════════════════════════════════════════════════════════════════════════════
# CHILD WALLET OPERATIONS
# ══════════════════════════════════════════════════════════════════════════════

async def transfer_to_child(
    parent_id: str,
    child_id: str,
    amount: float,
    note: Optional[str] = None,
) -> PaymentResult:
    """Legacy helper disabled; canonical Kids transfers live in routes.kids."""
    return PaymentResult(
        success=False,
        error="Legacy Kids transfer helper is disabled. Use the canonical Kids transfer route.",
        status=TransactionStatus.FAILED,
    )


async def process_child_payment(
    child_id: str,
    amount: float,
    merchant_name: Optional[str] = None,
    description: Optional[str] = None,
) -> PaymentResult:
    """Legacy helper disabled; canonical Kids payments live in routes.kids."""
    return PaymentResult(
        success=False,
        error="Legacy Kids payment helper is disabled. Use the canonical Kids payment route.",
        status=TransactionStatus.FAILED,
    )


# ══════════════════════════════════════════════════════════════════════════════
# CENTRAL PAYMENT SYSTEM - All modules use this
# ══════════════════════════════════════════════════════════════════════════════

# Default Commission Rates (can be overridden by admin config)
DEFAULT_COMMISSIONS = {
    "taxi": 0.20,        # 20%
    "scooter": 0.15,     # 15%
    "food": 0.10,        # 10%
    "marketplace": 0.05, # 5%
    "auction": 0.10,     # 10%
    "mining": 0.05,      # 5%
    "subscription": 0.0, # 0%
    "merchant": 0.025,   # 2.5%
}

# Cashback rates
DEFAULT_CASHBACK = {
    "standard": 0.01,    # 1%
    "premium": 0.03,     # 3%
    "vip": 0.05,         # 5%
}

# Referral reward rates
REFERRAL_REWARD_RATE = 0.02  # 2% of transaction


class PaymentType(str, Enum):
    TAXI = "taxi"
    SCOOTER = "scooter"
    FOOD = "food"
    MARKETPLACE = "marketplace"
    AUCTION = "auction"
    MINING = "mining"
    SUBSCRIPTION = "subscription"
    MERCHANT = "merchant"


class CentralPaymentRequest(BaseModel):
    """Central payment request model."""
    user_id: str
    amount: float
    payment_type: PaymentType
    reference_id: str
    description: Optional[str] = None
    recipient_id: Optional[str] = None  # For payments to sellers/drivers
    metadata: Optional[Dict] = None


class CentralPaymentResult(BaseModel):
    """Central payment result model."""
    success: bool
    transaction_id: Optional[str] = None
    reference: Optional[str] = None
    user_new_balance: Optional[float] = None
    recipient_earnings: Optional[float] = None
    platform_fee: Optional[float] = None
    cashback_earned: Optional[float] = None
    referral_reward: Optional[float] = None
    error: Optional[str] = None


async def get_commission_rate(payment_type: str) -> float:
    """Get commission rate from admin config or use default."""
    config = await db.platform_config.find_one({"key": "commissions"})
    if config and config.get("rates", {}).get(payment_type) is not None:
        rate = config["rates"][payment_type]
    else:
        rate = DEFAULT_COMMISSIONS.get(payment_type, 0.05)
    if payment_type == "merchant":
        return effective_merchant_rate(rate, DEFAULT_COMMISSIONS["merchant"])
    return rate


async def get_cashback_rate(user_id: str) -> float:
    """Get user's cashback rate based on their tier."""
    if ObjectId.is_valid(user_id):
        user = await db.users.find_one({"_id": ObjectId(user_id)})
    else:
        user = await db.users.find_one({"_id": user_id})
    
    if not user:
        return 0
    
    tier = user.get("tier", "standard")
    is_premium = user.get("is_premium", False)
    
    if is_premium or tier == "vip":
        return DEFAULT_CASHBACK["vip"]
    elif tier == "premium":
        return DEFAULT_CASHBACK["premium"]
    return DEFAULT_CASHBACK["standard"]


async def get_referrer(user_id: str) -> Optional[str]:
    """Get user's referrer ID if exists."""
    if ObjectId.is_valid(user_id):
        user = await db.users.find_one({"_id": ObjectId(user_id)})
    else:
        user = await db.users.find_one({"_id": user_id})
    
    if user:
        return user.get("referred_by")
    return None


async def process_central_payment(req: CentralPaymentRequest) -> CentralPaymentResult:
    """Legacy processor retained only as a fail-closed compatibility boundary.

    Active money flows must use debit_wallet, credit_wallet, or
    transfer_between_wallets so idempotency, recovery, and canonical ledgers
    remain authoritative.
    """
    return CentralPaymentResult(
        success=False,
        error="Legacy central payment processor is disabled. Use canonical wallet operations.",
    )


async def track_user_activity(user_id: str, activity_type: str, amount: float):
    """Track user spending and engagement."""
    now = datetime.now(timezone.utc)
    today = now.strftime("%Y-%m-%d")
    
    # Update daily activity
    await db.user_activity.update_one(
        {"user_id": user_id, "date": today},
        {
            "$inc": {
                "total_spent": amount,
                f"by_type.{activity_type}": amount,
                "transaction_count": 1,
            },
            "$set": {"last_activity": now.isoformat()},
            "$setOnInsert": {"created_at": now.isoformat()},
        },
        upsert=True
    )
    
    # Update user lifetime stats
    await db.users.update_one(
        {"_id": ObjectId(user_id) if ObjectId.is_valid(user_id) else user_id},
        {
            "$inc": {
                "lifetime_spent": amount,
                "total_transactions": 1,
            },
            "$set": {"last_transaction_at": now.isoformat()},
        }
    )


# ══════════════════════════════════════════════════════════════════════════════
# STREAK SYSTEM
# ══════════════════════════════════════════════════════════════════════════════

STREAK_REWARDS = {
    3: 0.50,   # 3 days: €0.50
    7: 2.00,   # 7 days: €2.00
    14: 5.00,  # 14 days: €5.00
    30: 15.00, # 30 days: €15.00
}

PURCHASE_STREAK_REWARDS = {
    5: 1.00,   # 5 purchases: €1.00
    10: 3.00,  # 10 purchases: €3.00
    25: 10.00, # 25 purchases: €10.00
    50: 25.00, # 50 purchases: €25.00
}


async def process_streaks(user_id: str, activity_type: str):
    """Check and reward user streaks."""
    now = datetime.now(timezone.utc)
    today = now.strftime("%Y-%m-%d")
    
    # Get or create streak record
    streak = await db.user_streaks.find_one({"user_id": user_id})
    
    if not streak:
        streak = {
            "user_id": user_id,
            "login_streak": 0,
            "purchase_streak": 0,
            "last_login_date": None,
            "last_purchase_date": None,
            "total_purchases": 0,
            "rewarded_milestones": [],
            "created_at": now.isoformat(),
        }
        await db.user_streaks.insert_one(streak)
    
    updates = {}
    rewards_to_give = []
    
    # Purchase streak
    last_purchase = streak.get("last_purchase_date")
    if last_purchase != today:
        updates["last_purchase_date"] = today
        updates["total_purchases"] = streak.get("total_purchases", 0) + 1
        
        # Check consecutive days
        if last_purchase:
            from datetime import timedelta
            last_date = datetime.strptime(last_purchase, "%Y-%m-%d")
            today_date = datetime.strptime(today, "%Y-%m-%d")
            diff = (today_date - last_date).days
            
            if diff == 1:
                updates["purchase_streak"] = streak.get("purchase_streak", 0) + 1
            elif diff > 1:
                updates["purchase_streak"] = 1
        else:
            updates["purchase_streak"] = 1
    
    # Check milestones
    total_purchases = updates.get("total_purchases", streak.get("total_purchases", 0))
    rewarded = streak.get("rewarded_milestones", [])
    
    for milestone, reward in PURCHASE_STREAK_REWARDS.items():
        milestone_key = f"purchases_{milestone}"
        if total_purchases >= milestone and milestone_key not in rewarded:
            rewards_to_give.append({
                "type": "purchase_milestone",
                "milestone": milestone,
                "amount": reward,
                "key": milestone_key,
            })
    
    # Apply updates
    if updates:
        await db.user_streaks.update_one(
            {"user_id": user_id},
            {"$set": updates}
        )
    
    # Give rewards through the canonical wallet path exactly once per milestone.
    for reward in rewards_to_give:
        milestone_key = reward["key"]
        result = await credit_wallet(
            user_id=user_id,
            amount=reward["amount"],
            tx_type=TransactionType.REWARD,
            description=f"Streak Bonus: {reward['milestone']} Käufe!",
            reference=f"PURCHASE-STREAK-{user_id}-{reward['milestone']}",
            source="purchase_streak",
            metadata={"milestone": reward["milestone"], "milestone_key": milestone_key},
            idempotency_key=f"purchase-streak:{user_id}:{milestone_key}",
        )
        if not result.success:
            return {"success": False, "status": result.status.value, "error": result.error}

        await db.user_streaks.update_one(
            {"user_id": user_id, "rewarded_milestones": {"$ne": milestone_key}},
            {"$addToSet": {"rewarded_milestones": milestone_key}},
        )
        
        # Notification is deterministic so a retry cannot duplicate it.
        await db.notifications.update_one(
            {"_id": f"purchase-streak:{user_id}:{milestone_key}"},
            {"$setOnInsert": {
                "_id": f"purchase-streak:{user_id}:{milestone_key}",
                "id": f"purchase-streak-{user_id}-{milestone_key}",
                "user_id": user_id,
                "type": "streak_reward",
                "title": "Streak Bonus!",
                "message": f"Du hast {reward['milestone']} Käufe erreicht! €{reward['amount']:.2f} Bonus!",
                "read": False,
                "created_at": now.isoformat(),
            }},
            upsert=True,
        )


async def process_login_streak(user_id: str):
    """Process daily login streak."""
    now = datetime.now(timezone.utc)
    today = now.strftime("%Y-%m-%d")
    
    streak = await db.user_streaks.find_one({"user_id": user_id})
    
    if not streak:
        await db.user_streaks.insert_one({
            "user_id": user_id,
            "login_streak": 1,
            "last_login_date": today,
            "rewarded_milestones": [],
            "created_at": now.isoformat(),
        })
        return
    
    last_login = streak.get("last_login_date")
    if last_login == today:
        return  # Already logged in today
    
    new_streak = 1
    if last_login:
        from datetime import timedelta
        last_date = datetime.strptime(last_login, "%Y-%m-%d")
        today_date = datetime.strptime(today, "%Y-%m-%d")
        diff = (today_date - last_date).days
        
        if diff == 1:
            new_streak = streak.get("login_streak", 0) + 1
    
    await db.user_streaks.update_one(
        {"user_id": user_id},
        {"$set": {
            "login_streak": new_streak,
            "last_login_date": today,
        }}
    )
    
    # Check for rewards
    rewarded = streak.get("rewarded_milestones", [])
    for days, reward in STREAK_REWARDS.items():
        key = f"login_{days}"
        if new_streak >= days and key not in rewarded:
            # Login rewards are real EUR and must use the canonical wallet path.
            # The milestone key is stable so retries after a process interruption
            # cannot create a second credit.
            result = await credit_wallet(
                user_id=user_id,
                amount=reward,
                tx_type=TransactionType.REWARD,
                description=f"Login Streak: {days} Tage!",
                reference=f"LOGIN-STREAK-{user_id}-{days}",
                source="login_streak",
                idempotency_key=f"login-streak:{user_id}:{days}",
            )
            if not result.success:
                return {"success": False, "status": result.status.value, "error": result.error}
            await db.user_streaks.update_one(
                {"user_id": user_id, "rewarded_milestones": {"$ne": key}},
                {"$addToSet": {"rewarded_milestones": key}}
            )
            await db.notifications.insert_one({
                "id": secrets.token_hex(8),
                "user_id": user_id,
                "type": "login_streak",
                "title": f"{days}-Tage Streak!",
                "message": f"Du hast {days} Tage in Folge eingeloggt! €{reward:.2f} Bonus!",
                "read": False,
                "created_at": now.isoformat(),
            })
            break  # Only one reward per login
    return {"success": True, "streak": new_streak}


# ══════════════════════════════════════════════════════════════════════════════
# ADMIN CONFIGURATION
# ══════════════════════════════════════════════════════════════════════════════

async def admin_set_commission_rates(rates: Dict[str, float]):
    """Admin: Set commission rates for all payment types."""
    if "merchant" in rates:
        from fastapi import HTTPException
        try:
            rate = float(rates["merchant"])
        except (TypeError, ValueError):
            raise HTTPException(status_code=400, detail="Invalid merchant commission")
        if not math.isfinite(rate) or rate < MIN_MERCHANT_COMMISSION_RATE:
            raise HTTPException(status_code=400, detail="Merchant commission must be at least 1.5%")
    await db.platform_config.update_one(
        {"key": "commissions"},
        {"$set": {
            "rates": rates,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }},
        upsert=True
    )


async def admin_get_commission_rates() -> Dict[str, float]:
    """Admin: Get current commission rates."""
    config = await db.platform_config.find_one({"key": "commissions"})
    rates = {**DEFAULT_COMMISSIONS, **((config or {}).get("rates") or {})}
    rates["merchant"] = effective_merchant_rate(rates["merchant"], DEFAULT_COMMISSIONS["merchant"])
    return rates


async def admin_get_revenue_stats(days: int = 30) -> Dict:
    """Admin: Get platform revenue statistics."""
    from datetime import timedelta
    
    now = datetime.now(timezone.utc)
    start_date = (now - timedelta(days=days)).strftime("%Y-%m-%d")
    
    revenues = await db.platform_revenue.find(
        {"date": {"$gte": start_date}},
        {"_id": 0}
    ).to_list(days + 1)
    
    total = sum(r.get("total", 0) for r in revenues)
    by_source = {}
    for r in revenues:
        for source, amount in r.get("by_source", {}).items():
            by_source[source] = by_source.get(source, 0) + amount
    
    return {
        "total_revenue": round(total, 2),
        "by_source": {k: round(v, 2) for k, v in by_source.items()},
        "period_days": days,
        "daily_average": round(total / max(len(revenues), 1), 2),
        "daily_breakdown": revenues,
    }


# ══════════════════════════════════════════════════════════════════════════════
# CONVENIENCE WRAPPERS FOR EACH MODULE
# ══════════════════════════════════════════════════════════════════════════════

async def process_taxi_payment(
    user_id: str,
    amount: float,
    ride_id: str,
    driver_id: str,
    description: str = None
) -> CentralPaymentResult:
    """Process taxi ride payment."""
    return await process_central_payment(CentralPaymentRequest(
        user_id=user_id,
        amount=amount,
        payment_type=PaymentType.TAXI,
        reference_id=ride_id,
        recipient_id=driver_id,
        description=description or f"Taxi Ride {ride_id[:8]}",
    ))


async def process_scooter_payment(
    user_id: str,
    amount: float,
    ride_id: str,
    description: str = None
) -> CentralPaymentResult:
    """Process scooter ride payment."""
    return await process_central_payment(CentralPaymentRequest(
        user_id=user_id,
        amount=amount,
        payment_type=PaymentType.SCOOTER,
        reference_id=ride_id,
        description=description or f"Scooter Ride {ride_id[:8]}",
    ))


async def process_food_payment(
    user_id: str,
    amount: float,
    order_id: str,
    restaurant_id: str,
    description: str = None
) -> CentralPaymentResult:
    """Process food order payment."""
    return await process_central_payment(CentralPaymentRequest(
        user_id=user_id,
        amount=amount,
        payment_type=PaymentType.FOOD,
        reference_id=order_id,
        recipient_id=restaurant_id,
        description=description or f"Food Order {order_id[:8]}",
    ))


async def process_marketplace_payment(
    user_id: str,
    amount: float,
    listing_id: str,
    seller_id: str,
    description: str = None
) -> CentralPaymentResult:
    """Process marketplace purchase."""
    return await process_central_payment(CentralPaymentRequest(
        user_id=user_id,
        amount=amount,
        payment_type=PaymentType.MARKETPLACE,
        reference_id=listing_id,
        recipient_id=seller_id,
        description=description or "Marketplace Purchase",
    ))


async def process_auction_payment(
    user_id: str,
    amount: float,
    auction_id: str,
    description: str = None
) -> CentralPaymentResult:
    """Process auction bid/win payment."""
    return await process_central_payment(CentralPaymentRequest(
        user_id=user_id,
        amount=amount,
        payment_type=PaymentType.AUCTION,
        reference_id=auction_id,
        description=description or f"Auction {auction_id[:8]}",
    ))


async def process_merchant_payment(
    user_id: str,
    amount: float,
    merchant_id: str,
    reference: str,
    description: str = None
) -> CentralPaymentResult:
    """Process merchant POS payment."""
    return await process_central_payment(CentralPaymentRequest(
        user_id=user_id,
        amount=amount,
        payment_type=PaymentType.MERCHANT,
        reference_id=reference,
        recipient_id=merchant_id,
        description=description or "Merchant Payment",
    ))
