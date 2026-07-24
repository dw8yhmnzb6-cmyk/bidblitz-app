"""
BidBlitz V2 - Unified Payment Engine
Central payment processing with atomic transactions, duplicate prevention,
and full audit logging. ALL money flows must go through this module.
"""

import secrets
import hashlib
from datetime import datetime, timezone
from typing import Optional, Dict, Any, Literal
from enum import Enum
from bson import ObjectId
from pydantic import BaseModel, Field

from core.database import db

# ══════════════════════════════════════════════════════════════════════════════
# CONSTANTS & ENUMS
# ══════════════════════════════════════════════════════════════════════════════

class TransactionStatus(str, Enum):
    PENDING = "pending"
    COMPLETED = "completed"
    FAILED = "failed"
    REVERSED = "reversed"


class TransactionType(str, Enum):
    TOPUP = "topup"
    PAYMENT = "payment"
    TRANSFER = "transfer"
    REFUND = "refund"
    RESALE_PURCHASE = "resale_purchase"
    RESALE_SALE = "resale_sale"
    REWARD = "reward"  # Gaming rewards
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
    
    # 1. Input validation
    if amount <= 0:
        return PaymentResult(
            success=False,
            error="Amount must be positive",
            status=TransactionStatus.FAILED
        )
    
    amount = round(amount, 2)
    
    # 2. Generate or validate idempotency key
    ref = reference or generate_reference()
    if not idempotency_key:
        idempotency_key = compute_idempotency_key(user_id, tx_type.value, amount, ref)
    
    # 3. Check for duplicate transaction
    existing = await check_idempotency(idempotency_key)
    if existing:
        return PaymentResult(
            success=existing.get("status") == "completed",
            transaction_id=existing.get("id"),
            reference=existing.get("reference"),
            new_balance=await get_user_balance(user_id),
            error="Duplicate transaction" if existing.get("status") != "completed" else None,
            status=TransactionStatus(existing.get("status", "completed"))
        )
    
    # 4. Check balance
    try:
        current_balance = await get_user_balance(user_id)
    except ValueError as e:
        return PaymentResult(success=False, error=str(e), status=TransactionStatus.FAILED)
    
    if current_balance < amount:
        # Log failed attempt
        await log_audit(
            action=f"debit_{tx_type.value}_failed",
            user_id=user_id,
            details={"amount": amount, "balance": current_balance, "reason": "insufficient_balance"},
            status="failed"
        )
        return PaymentResult(
            success=False,
            error=f"Insufficient balance. Available: €{current_balance:.2f}, Required: €{amount:.2f}",
            status=TransactionStatus.FAILED
        )
    
    # 5. Create pending transaction first
    tx_id = generate_transaction_id()
    now = datetime.now(timezone.utc).isoformat()
    
    transaction = {
        "id": tx_id,
        "idempotency_key": idempotency_key,
        "user_id": user_id,
        "type": tx_type.value,
        "amount": -amount,  # Negative for debit
        "description": description,
        "merchant_id": merchant_id,
        "merchant_name": merchant_name or "",
        "reference": ref,
        "currency": "EUR",
        "direction": "debit",
        "source": "payment_engine",
        "status": TransactionStatus.PENDING.value,
        "metadata": {
            **build_wallet_ledger_metadata(
                user_id=user_id,
                wallet_id=user_id,
                tx_type=tx_type,
                amount=amount,
                status=TransactionStatus.PENDING,
                source="payment_engine",
                reference_id=ref,
                idempotency_key=idempotency_key,
                direction="debit",
                audit_metadata=(metadata or {}).get("audit_metadata", {}),
            ),
            **(metadata or {}),
        },
        "created_at": now,
        "updated_at": now,
    }
    transaction["metadata"]["transaction_id"] = tx_id
    
    await db.transactions.insert_one(transaction)
    
    # 6. Atomic balance update with optimistic locking
    result = await db.users.update_one(
        {
            "_id": ObjectId(user_id) if ObjectId.is_valid(user_id) else user_id,
            "balance": {"$gte": amount}  # Ensure balance still sufficient
        },
        {"$inc": {"balance": -amount}}
    )
    
    if result.modified_count == 0:
        # Balance changed between check and update - rollback
        await db.transactions.update_one(
            {"id": tx_id},
            {"$set": {"status": TransactionStatus.FAILED.value, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
        await log_audit(
            action=f"debit_{tx_type.value}_rollback",
            user_id=user_id,
            details={"tx_id": tx_id, "amount": amount, "reason": "balance_changed"},
            status="failed"
        )
        return PaymentResult(
            success=False,
            transaction_id=tx_id,
            error="Balance changed during transaction. Please try again.",
            status=TransactionStatus.FAILED
        )
    
    # 7. Mark transaction completed
    await db.transactions.update_one(
        {"id": tx_id},
        {"$set": {
            "status": TransactionStatus.COMPLETED.value,
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "metadata.status": TransactionStatus.COMPLETED.value,
            "metadata.transaction_id": tx_id,
        }}
    )
    
    # 8. Log success
    new_balance = await get_user_balance(user_id)
    await log_audit(
        action=f"debit_{tx_type.value}",
        user_id=user_id,
        details={"tx_id": tx_id, "amount": amount, "new_balance": new_balance},
        status="success"
    )
    
    return PaymentResult(
        success=True,
        transaction_id=tx_id,
        reference=ref,
        new_balance=new_balance,
        status=TransactionStatus.COMPLETED
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
    
    # 1. Input validation
    if amount <= 0:
        return PaymentResult(
            success=False,
            error="Amount must be positive",
            status=TransactionStatus.FAILED
        )
    
    amount = round(amount, 2)
    
    # 2. Generate or validate idempotency key
    ref = reference or generate_reference()
    if not idempotency_key:
        idempotency_key = compute_idempotency_key(user_id, tx_type.value, amount, ref)
    
    # 3. Check for duplicate transaction
    existing = await check_idempotency(idempotency_key)
    if existing:
        return PaymentResult(
            success=existing.get("status") == "completed",
            transaction_id=existing.get("id"),
            reference=existing.get("reference"),
            new_balance=await get_user_balance(user_id),
            error="Duplicate credit" if existing.get("status") != "completed" else None,
            status=TransactionStatus(existing.get("status", "completed"))
        )
    
    # 4. Create pending transaction
    tx_id = generate_transaction_id()
    now = datetime.now(timezone.utc).isoformat()
    
    transaction = {
        "id": tx_id,
        "idempotency_key": idempotency_key,
        "user_id": user_id,
        "type": tx_type.value,
        "amount": amount,  # Positive for credit
        "description": description,
        "source": source or "",
        "reference": ref,
        "currency": "EUR",
        "direction": "credit",
        "status": TransactionStatus.PENDING.value,
        "metadata": {
            **build_wallet_ledger_metadata(
                user_id=user_id,
                wallet_id=user_id,
                tx_type=tx_type,
                amount=amount,
                status=TransactionStatus.PENDING,
                source=source or "payment_engine",
                reference_id=ref,
                idempotency_key=idempotency_key,
                direction="credit",
                audit_metadata=(metadata or {}).get("audit_metadata", {}),
            ),
            **(metadata or {}),
        },
        "created_at": now,
        "updated_at": now,
    }
    transaction["metadata"]["transaction_id"] = tx_id
    
    await db.transactions.insert_one(transaction)
    
    # 5. Atomic balance update on canonical visible source only
    result = await db.users.update_one(
        {"_id": ObjectId(user_id) if ObjectId.is_valid(user_id) else user_id},
        {"$inc": {"balance": amount}}
    )
    
    if result.modified_count == 0:
        # User not found
        await db.transactions.update_one(
            {"id": tx_id},
            {"$set": {"status": TransactionStatus.FAILED.value, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
        return PaymentResult(
            success=False,
            transaction_id=tx_id,
            error="User not found",
            status=TransactionStatus.FAILED
        )
    
    # 6. Mark transaction completed
    await db.transactions.update_one(
        {"id": tx_id},
        {"$set": {
            "status": TransactionStatus.COMPLETED.value,
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "metadata.status": TransactionStatus.COMPLETED.value,
            "metadata.transaction_id": tx_id,
        }}
    )
    
    # 7. Log success
    new_balance = await get_user_balance(user_id)
    await log_audit(
        action=f"credit_{tx_type.value}",
        user_id=user_id,
        details={"tx_id": tx_id, "amount": amount, "new_balance": new_balance, "source": source},
        status="success"
    )
    
    return PaymentResult(
        success=True,
        transaction_id=tx_id,
        reference=ref,
        new_balance=new_balance,
        status=TransactionStatus.COMPLETED
    )


async def transfer_between_wallets(
    from_user_id: str,
    to_user_id: str,
    amount: float,
    tx_type: TransactionType,
    description: str,
    reference: Optional[str] = None,
    metadata: Optional[Dict] = None,
) -> PaymentResult:
    """
    Transfer between two wallets atomically.
    Either both succeed or both fail.
    """
    
    if amount <= 0:
        return PaymentResult(
            success=False,
            error="Amount must be positive",
            status=TransactionStatus.FAILED
        )
    
    amount = round(amount, 2)
    ref = reference or generate_reference("TRF")
    
    # Generate idempotency keys for both legs
    debit_key = compute_idempotency_key(from_user_id, f"{tx_type.value}_out", amount, ref)
    credit_key = compute_idempotency_key(to_user_id, f"{tx_type.value}_in", amount, ref)
    
    # Check if already processed
    existing_debit = await check_idempotency(debit_key)
    if existing_debit and existing_debit.get("status") == "completed":
        return PaymentResult(
            success=True,
            transaction_id=existing_debit.get("id"),
            reference=ref,
            new_balance=await get_user_balance(from_user_id),
            status=TransactionStatus.COMPLETED
        )
    
    # Step 1: Debit sender
    debit_result = await debit_wallet(
        user_id=from_user_id,
        amount=amount,
        tx_type=tx_type,
        description=f"{description} (sent)",
        reference=ref,
        metadata={"to_user_id": to_user_id, **(metadata or {})},
        idempotency_key=debit_key
    )
    
    if not debit_result.success:
        return debit_result
    
    # Step 2: Credit receiver
    credit_result = await credit_wallet(
        user_id=to_user_id,
        amount=amount,
        tx_type=tx_type,
        description=f"{description} (received)",
        reference=ref,
        source=from_user_id,
        metadata={"from_user_id": from_user_id, **(metadata or {})},
        idempotency_key=credit_key
    )
    
    if not credit_result.success:
        # Rollback: refund the sender
        await credit_wallet(
            user_id=from_user_id,
            amount=amount,
            tx_type=TransactionType.REFUND,
            description=f"Refund: {description} (transfer failed)",
            reference=f"REF-{ref}",
            metadata={"original_ref": ref, "reason": "transfer_failed"}
        )
        await log_audit(
            action="transfer_rollback",
            user_id=from_user_id,
            details={"ref": ref, "amount": amount, "to_user": to_user_id, "reason": credit_result.error},
            status="failed"
        )
        return PaymentResult(
            success=False,
            error=f"Transfer failed. Funds refunded. Error: {credit_result.error}",
            status=TransactionStatus.REVERSED
        )
    
    await log_audit(
        action="transfer_complete",
        user_id=from_user_id,
        details={"ref": ref, "amount": amount, "to_user": to_user_id},
        status="success"
    )
    
    return PaymentResult(
        success=True,
        transaction_id=debit_result.transaction_id,
        reference=ref,
        new_balance=debit_result.new_balance,
        status=TransactionStatus.COMPLETED
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

    target_balance = round(float(target_balance or 0), 2)
    ref = reference or generate_reference("SYNC")
    if not idempotency_key:
        idempotency_key = compute_idempotency_key(user_id, TransactionType.RECONCILIATION_SYNC.value, target_balance, ref)

    existing = await check_idempotency(idempotency_key)
    if existing:
        return PaymentResult(
            success=existing.get("status") == "completed",
            transaction_id=existing.get("id"),
            reference=existing.get("reference"),
            new_balance=await get_user_balance(user_id),
            error="Duplicate reconciliation sync" if existing.get("status") != "completed" else None,
            status=TransactionStatus(existing.get("status", "completed")),
        )

    current_balance = await get_user_balance(user_id)
    tx_id = generate_transaction_id()
    now = datetime.now(timezone.utc).isoformat()
    delta = round(target_balance - current_balance, 2)

    transaction = {
        "id": tx_id,
        "idempotency_key": idempotency_key,
        "user_id": user_id,
        "type": TransactionType.RECONCILIATION_SYNC.value,
        "amount": 0.0,
        "description": description,
        "reference": ref,
        "currency": "EUR",
        "direction": "sync",
        "source": "payment_engine_reconciliation",
        "status": TransactionStatus.PENDING.value,
        "metadata": {
            "transaction_id": tx_id,
            "user_id": user_id,
            "wallet_id": user_id,
            "type": TransactionType.RECONCILIATION_SYNC.value,
            "amount": 0.0,
            "currency": "EUR",
            "direction": "sync",
            "status": TransactionStatus.PENDING.value,
            "source": "payment_engine_reconciliation",
            "reference_id": ref,
            "idempotency_key": idempotency_key,
            "created_at": now,
            "before_balance": current_balance,
            "target_balance": target_balance,
            "projection_delta": delta,
            **(metadata or {}),
        },
        "created_at": now,
        "updated_at": now,
    }
    await db.transactions.insert_one(transaction)

    result = await db.users.update_one(
        {"_id": ObjectId(user_id) if ObjectId.is_valid(user_id) else user_id},
        {"$set": {"balance": target_balance}},
    )
    if result.modified_count == 0:
        await db.transactions.update_one(
            {"id": tx_id},
            {"$set": {"status": TransactionStatus.FAILED.value, "updated_at": datetime.now(timezone.utc).isoformat()}},
        )
        return PaymentResult(
            success=False,
            transaction_id=tx_id,
            error="User not found",
            status=TransactionStatus.FAILED,
        )

    await db.transactions.update_one(
        {"id": tx_id},
        {"$set": {
            "status": TransactionStatus.COMPLETED.value,
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "metadata.status": TransactionStatus.COMPLETED.value,
            "metadata.transaction_id": tx_id,
        }},
    )
    await log_audit(
        action="sync_reconciliation_balance",
        user_id=user_id,
        details={"tx_id": tx_id, "before_balance": current_balance, "target_balance": target_balance, "delta": delta},
        status="success",
    )
    return PaymentResult(
        success=True,
        transaction_id=tx_id,
        reference=ref,
        new_balance=target_balance,
        status=TransactionStatus.COMPLETED,
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
    note: Optional[str] = None
) -> PaymentResult:
    """
    Transfer from parent wallet to child wallet.
    """
    
    if amount <= 0:
        return PaymentResult(success=False, error="Amount must be positive", status=TransactionStatus.FAILED)
    
    amount = round(amount, 2)
    ref = generate_reference("KIDS")
    
    # Check parent balance
    try:
        parent_balance = await get_user_balance(parent_id)
    except ValueError:
        return PaymentResult(success=False, error="Parent not found", status=TransactionStatus.FAILED)
    
    if parent_balance < amount:
        return PaymentResult(
            success=False,
            error=f"Insufficient balance. Available: €{parent_balance:.2f}",
            status=TransactionStatus.FAILED
        )
    
    # Check child exists
    child = await db.kids_children.find_one({"child_id": child_id, "parent_id": parent_id})
    if not child:
        return PaymentResult(success=False, error="Child not found", status=TransactionStatus.FAILED)
    
    # Debit parent
    debit_result = await debit_wallet(
        user_id=parent_id,
        amount=amount,
        tx_type=TransactionType.KIDS_TRANSFER,
        description=f"Transfer to {child.get('name', 'child')}",
        reference=ref,
        metadata={"child_id": child_id, "note": note}
    )
    
    if not debit_result.success:
        return debit_result
    
    # Credit child balance in kids_children collection
    await db.kids_children.update_one(
        {"child_id": child_id},
        {"$inc": {"balance": amount}}
    )
    
    # Record child transaction
    await db.kids_transactions.insert_one({
        "id": generate_transaction_id(),
        "child_id": child_id,
        "parent_id": parent_id,
        "type": "allowance",
        "amount": amount,
        "description": note or f"From {(await db.users.find_one({'_id': ObjectId(parent_id)})).get('name', 'Parent')}",
        "reference": ref,
        "status": "completed",
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return PaymentResult(
        success=True,
        transaction_id=debit_result.transaction_id,
        reference=ref,
        new_balance=debit_result.new_balance,
        status=TransactionStatus.COMPLETED
    )


async def process_child_payment(
    child_id: str,
    amount: float,
    merchant_name: Optional[str] = None,
    description: Optional[str] = None
) -> PaymentResult:
    """
    Process payment from child wallet with limit enforcement.
    """
    
    if amount <= 0:
        return PaymentResult(success=False, error="Amount must be positive", status=TransactionStatus.FAILED)
    
    amount = round(amount, 2)
    
    # Get child
    child = await db.kids_children.find_one({"child_id": child_id})
    if not child:
        return PaymentResult(success=False, error="Child not found", status=TransactionStatus.FAILED)
    
    # Check frozen
    if child.get("is_frozen"):
        return PaymentResult(success=False, error="Wallet is frozen", status=TransactionStatus.FAILED)
    
    # Check balance
    balance = child.get("balance", 0)
    if balance < amount:
        return PaymentResult(
            success=False,
            error=f"Insufficient balance. Available: €{balance:.2f}",
            status=TransactionStatus.FAILED
        )
    
    # Check daily limit
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    
    today_txns = await db.kids_transactions.find({
        "child_id": child_id,
        "type": "payment",
        "created_at": {"$gte": today_start}
    }).to_list(100)
    
    today_spent = sum(abs(tx.get("amount", 0)) for tx in today_txns if tx.get("amount", 0) < 0)
    daily_limit = child.get("daily_limit", 20)
    
    if today_spent + amount > daily_limit:
        return PaymentResult(
            success=False,
            error=f"Daily limit exceeded. Spent: €{today_spent:.2f}, Limit: €{daily_limit:.2f}",
            status=TransactionStatus.FAILED
        )
    
    # Process payment
    ref = generate_reference("KIDPAY")
    
    result = await db.kids_children.update_one(
        {"child_id": child_id, "balance": {"$gte": amount}},
        {"$inc": {"balance": -amount, "total_spent": amount}}
    )
    
    if result.modified_count == 0:
        return PaymentResult(
            success=False,
            error="Balance changed. Please try again.",
            status=TransactionStatus.FAILED
        )
    
    # Record transaction
    tx_id = generate_transaction_id()
    await db.kids_transactions.insert_one({
        "id": tx_id,
        "child_id": child_id,
        "parent_id": child.get("parent_id"),
        "type": "payment",
        "amount": -amount,
        "description": description or "Payment",
        "merchant_name": merchant_name or "Shop",
        "reference": ref,
        "status": "completed",
        "created_at": now.isoformat()
    })
    
    updated_child = await db.kids_children.find_one({"child_id": child_id})
    
    return PaymentResult(
        success=True,
        transaction_id=tx_id,
        reference=ref,
        new_balance=updated_child.get("balance", 0),
        status=TransactionStatus.COMPLETED
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
        return config["rates"][payment_type]
    return DEFAULT_COMMISSIONS.get(payment_type, 0.05)


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
    """
    CENTRAL PAYMENT PROCESSOR
    
    Handles ALL payment types with:
    1. Balance validation
    2. Atomic deduction
    3. Commission calculation
    4. Auto-distribution to recipient
    5. Referral rewards
    6. Cashback
    7. Activity tracking
    8. Notifications
    """
    
    user_id = req.user_id
    amount = round(req.amount, 2)
    payment_type = req.payment_type.value
    
    if amount <= 0:
        return CentralPaymentResult(success=False, error="Amount must be positive")
    
    # 1. Get user and validate balance
    try:
        current_balance = await get_user_balance(user_id)
    except ValueError as e:
        return CentralPaymentResult(success=False, error=str(e))
    
    if current_balance < amount:
        return CentralPaymentResult(
            success=False,
            error=f"Insufficient balance. Available: €{current_balance:.2f}, Required: €{amount:.2f}"
        )
    
    now = datetime.now(timezone.utc)
    tx_id = generate_transaction_id()
    ref = generate_reference(payment_type.upper()[:3])
    
    # 2. Calculate commission
    commission_rate = await get_commission_rate(payment_type)
    platform_fee = round(amount * commission_rate, 2)
    recipient_amount = round(amount - platform_fee, 2)
    
    # 3. Debit user wallet (atomic)
    debit_result = await db.users.update_one(
        {
            "_id": ObjectId(user_id) if ObjectId.is_valid(user_id) else user_id,
            "balance": {"$gte": amount}
        },
        {"$inc": {"balance": -amount}}
    )
    
    if debit_result.modified_count == 0:
        return CentralPaymentResult(success=False, error="Balance changed during transaction")
    
    # 4. Create transaction record
    transaction = {
        "id": tx_id,
        "user_id": user_id,
        "type": payment_type,
        "amount": -amount,
        "description": req.description or f"{payment_type.title()} Payment",
        "reference": ref,
        "reference_id": req.reference_id,
        "status": "completed",
        "platform_fee": platform_fee,
        "recipient_id": req.recipient_id,
        "recipient_amount": recipient_amount if req.recipient_id else None,
        "metadata": req.metadata or {},
        "created_at": now.isoformat(),
    }
    await db.transactions.insert_one(transaction)
    
    # 5. Credit recipient if exists (driver, seller, merchant)
    if req.recipient_id:
        await db.users.update_one(
            {"_id": ObjectId(req.recipient_id) if ObjectId.is_valid(req.recipient_id) else req.recipient_id},
            {"$inc": {"balance": recipient_amount}}
        )
        
        # Recipient transaction record
        await db.transactions.insert_one({
            "id": generate_transaction_id(),
            "user_id": req.recipient_id,
            "type": f"{payment_type}_income",
            "amount": recipient_amount,
            "description": f"Einnahme: {req.description or payment_type}",
            "reference": f"INC-{ref}",
            "source_user_id": user_id,
            "status": "completed",
            "created_at": now.isoformat(),
        })
    
    # 6. Record platform revenue
    await db.platform_revenue.update_one(
        {"date": now.strftime("%Y-%m-%d")},
        {"$inc": {
            "total": platform_fee,
            f"by_source.{payment_type}": platform_fee,
            "transaction_count": 1,
        }},
        upsert=True
    )
    
    # 7. Process cashback
    cashback = 0
    cashback_rate = await get_cashback_rate(user_id)
    if cashback_rate > 0:
        cashback = round(amount * cashback_rate, 2)
        if cashback >= 0.01:
            await db.users.update_one(
                {"_id": ObjectId(user_id) if ObjectId.is_valid(user_id) else user_id},
                {"$inc": {"balance": cashback}}
            )
            await db.transactions.insert_one({
                "id": generate_transaction_id(),
                "user_id": user_id,
                "type": "cashback",
                "amount": cashback,
                "description": f"Cashback ({cashback_rate*100:.0f}%)",
                "reference": f"CB-{ref}",
                "source_tx": tx_id,
                "status": "completed",
                "created_at": now.isoformat(),
            })
    
    # 8. Process referral reward
    referral_reward = 0
    referrer_id = await get_referrer(user_id)
    if referrer_id:
        referral_reward = round(amount * REFERRAL_REWARD_RATE, 2)
        if referral_reward >= 0.01:
            await db.users.update_one(
                {"_id": ObjectId(referrer_id) if ObjectId.is_valid(referrer_id) else referrer_id},
                {"$inc": {"balance": referral_reward}}
            )
            await db.transactions.insert_one({
                "id": generate_transaction_id(),
                "user_id": referrer_id,
                "type": "referral_reward",
                "amount": referral_reward,
                "description": f"Empfehlungsbonus ({REFERRAL_REWARD_RATE*100:.0f}%)",
                "reference": f"REF-{ref}",
                "referred_user_id": user_id,
                "status": "completed",
                "created_at": now.isoformat(),
            })
    
    # 9. Track activity
    await track_user_activity(user_id, payment_type, amount)
    
    # 10. Check and apply streaks
    await process_streaks(user_id, payment_type)
    
    # 11. Process loyalty rewards (coins + cashback)
    loyalty_rewards = {"coins_earned": 0, "cashback_earned": 0}
    try:
        from routes.loyalty_system import process_loyalty_rewards
        loyalty_rewards = await process_loyalty_rewards(
            user_id=user_id,
            source_type=payment_type,
            source_id=req.reference_id,
            amount=amount,
            tx_id=tx_id,
        )
    except Exception as e:
        import logging
        logging.getLogger("bidblitz").warning(f"Loyalty reward error: {e}")
    
    # Get new balance (includes cashback if awarded)
    new_balance = await get_user_balance(user_id)
    
    # Log audit
    await log_audit(
        action=f"central_payment_{payment_type}",
        user_id=user_id,
        details={
            "tx_id": tx_id,
            "amount": amount,
            "platform_fee": platform_fee,
            "recipient_id": req.recipient_id,
            "cashback": cashback,
            "referral_reward": referral_reward,
        },
        status="success"
    )
    
    return CentralPaymentResult(
        success=True,
        transaction_id=tx_id,
        reference=ref,
        user_new_balance=new_balance,
        recipient_earnings=recipient_amount if req.recipient_id else None,
        platform_fee=platform_fee,
        cashback_earned=loyalty_rewards.get("cashback_earned") or (cashback if cashback > 0 else None),
        referral_reward=referral_reward if referral_reward > 0 else None,
    )


# ══════════════════════════════════════════════════════════════════════════════
# ACTIVITY TRACKING
# ══════════════════════════════════════════════════════════════════════════════

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
    
    # Give rewards
    for reward in rewards_to_give:
        await db.users.update_one(
            {"_id": ObjectId(user_id) if ObjectId.is_valid(user_id) else user_id},
            {"$inc": {"balance": reward["amount"]}}
        )
        await db.transactions.insert_one({
            "id": generate_transaction_id(),
            "user_id": user_id,
            "type": "streak_reward",
            "amount": reward["amount"],
            "description": f"Streak Bonus: {reward['milestone']} Käufe!",
            "reference": generate_reference("STREAK"),
            "status": "completed",
            "created_at": now.isoformat(),
        })
        await db.user_streaks.update_one(
            {"user_id": user_id},
            {"$push": {"rewarded_milestones": reward["key"]}}
        )
        
        # Notification
        await db.notifications.insert_one({
            "id": secrets.token_hex(8),
            "user_id": user_id,
            "type": "streak_reward",
            "title": "Streak Bonus!",
            "message": f"Du hast {reward['milestone']} Käufe erreicht! €{reward['amount']:.2f} Bonus!",
            "read": False,
            "created_at": now.isoformat(),
        })


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
            await db.users.update_one(
                {"_id": ObjectId(user_id) if ObjectId.is_valid(user_id) else user_id},
                {"$inc": {"balance": reward}}
            )
            await db.transactions.insert_one({
                "id": generate_transaction_id(),
                "user_id": user_id,
                "type": "login_streak_reward",
                "amount": reward,
                "description": f"Login Streak: {days} Tage!",
                "reference": generate_reference("LOGIN"),
                "status": "completed",
                "created_at": now.isoformat(),
            })
            await db.user_streaks.update_one(
                {"user_id": user_id},
                {"$push": {"rewarded_milestones": key}}
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


# ══════════════════════════════════════════════════════════════════════════════
# ADMIN CONFIGURATION
# ══════════════════════════════════════════════════════════════════════════════

async def admin_set_commission_rates(rates: Dict[str, float]):
    """Admin: Set commission rates for all payment types."""
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
    if config:
        return config.get("rates", DEFAULT_COMMISSIONS)
    return DEFAULT_COMMISSIONS


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
