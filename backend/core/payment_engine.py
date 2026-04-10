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
    PAYOUT = "payout"
    FEE = "fee"
    STRIPE_TOPUP = "stripe_topup"


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
        "status": TransactionStatus.PENDING.value,
        "metadata": metadata or {},
        "created_at": now,
        "updated_at": now,
    }
    
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
        {"$set": {"status": TransactionStatus.COMPLETED.value, "updated_at": datetime.now(timezone.utc).isoformat()}}
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
        "status": TransactionStatus.PENDING.value,
        "metadata": metadata or {},
        "created_at": now,
        "updated_at": now,
    }
    
    await db.transactions.insert_one(transaction)
    
    # 5. Atomic balance update
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
        {"$set": {"status": TransactionStatus.COMPLETED.value, "updated_at": datetime.now(timezone.utc).isoformat()}}
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
