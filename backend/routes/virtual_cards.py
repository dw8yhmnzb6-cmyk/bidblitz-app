"""
BidBlitz Virtual Cards System
=============================
Einmal-Karten für sicheres Online-Shopping
"""

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from typing import Optional
from bson import ObjectId
from datetime import datetime, timezone, timedelta
from core.database import db
from core.security import get_current_user
from core.config import TEST_MODE
from core.payment_engine import debit_wallet, credit_wallet, TransactionType
import secrets
import random
import hashlib

router = APIRouter(prefix="/api/cards", tags=["virtual-cards"])


def generate_card_number():
    """Generate realistic-looking card number (4532 XXXX XXXX XXXX)"""
    prefix = "4532"  # Visa-like
    rest = ''.join([str(random.randint(0, 9)) for _ in range(12)])
    return f"{prefix}{rest}"


def generate_cvv():
    return ''.join([str(random.randint(0, 9)) for _ in range(3)])


def generate_card_id():
    return f"CARD-{secrets.token_hex(4).upper()}"


def _require_virtual_card_test_mode() -> None:
    if not TEST_MODE:
        raise HTTPException(
            status_code=503,
            detail=(
                "Virtuelle Karten sind noch nicht mit einem verifizierten Karten-Issuer verbunden. "
                "Es werden in Production keine selbst erzeugten PAN/CVV ausgegeben."
            ),
        )


async def _refund_legacy_card_reservation_once(card: dict, amount: float, reason: str) -> bool:
    amount = round(max(0.0, float(amount or 0)), 2)
    if amount <= 0:
        return True
    user_id = str(card.get("user_id") or "")
    if not ObjectId.is_valid(user_id):
        return False
    marker = hashlib.sha256(
        f"virtual-card-refund:{card.get('card_id')}:{reason}".encode("utf-8")
    ).hexdigest()[:24]
    marker_field = f"virtual_card_refund_markers.{marker}"
    wallet_result = await credit_wallet(
        user_id=user_id,
        amount=amount,
        tx_type=TransactionType.REFUND,
        description=f"Virtual Card Reservierung freigegeben ({reason})",
        reference=f"VCREF-{marker[:12].upper()}",
        source="virtual_cards_legacy",
        metadata={"card_id": card.get("card_id"), "reason": reason},
        idempotency_key=f"virtual-card-refund:{marker}",
    )
    if not wallet_result.success:
        return False

    result = await db.users.update_one(
        {
            "_id": ObjectId(user_id),
            marker_field: {"$exists": False},
            "reserved_balance": {"$gte": amount},
        },
        {
            "$inc": {"reserved_balance": -amount},
            "$set": {
                marker_field: {
                    "card_id": card.get("card_id"),
                    "amount": amount,
                    "reason": reason,
                    "wallet_transaction_id": wallet_result.transaction_id,
                    "created_at": datetime.now(timezone.utc).isoformat(),
                }
            },
        },
    )
    if result.modified_count == 1:
        return True
    user = await db.users.find_one(
        {"_id": ObjectId(user_id), marker_field: {"$exists": True}},
        {"_id": 1},
    )
    return bool(user)


class CreateCardRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    limit: float = Field(..., ge=1, le=5000, allow_inf_nan=False)
    single_use: bool = True
    expires_hours: int = Field(default=24, ge=1, le=720)
    idempotency_key: Optional[str] = None


class CardPaymentRequest(BaseModel):
    card_id: str
    amount: float = Field(..., gt=0, le=5000, allow_inf_nan=False)
    merchant: str = Field(..., min_length=1, max_length=180)


@router.get("/capabilities")
async def virtual_card_capabilities():
    """Expose whether a real issuer is available without exposing card secrets."""
    return {
        "live_issuer_connected": False,
        "card_creation_available": bool(TEST_MODE),
        "simulation_available": bool(TEST_MODE),
        "production_message": (
            None if TEST_MODE else
            "Virtuelle Karten werden erst aktiviert, wenn ein verifizierter Karten-Issuer live verbunden ist."
        ),
    }


@router.post("/create")
async def create_virtual_card(req: CreateCardRequest, request: Request):
    """Legacy virtual-card simulator; unavailable in production until issuer integration exists."""
    _require_virtual_card_test_mode()
    user = await get_current_user(request)
    user_id = str(user["_id"])
    idem = (req.idempotency_key or request.headers.get("Idempotency-Key") or "").strip()
    if not 8 <= len(idem) <= 200:
        raise HTTPException(status_code=400, detail="Idempotency-Key erforderlich")
    marker = hashlib.sha256(f"{user_id}:{idem}".encode("utf-8")).hexdigest()[:24]
    card_id = f"CARD-{marker[:8].upper()}"
    creation_payload = {
        "name": req.name,
        "limit": round(float(req.limit), 2),
        "single_use": bool(req.single_use),
        "expires_hours": int(req.expires_hours),
    }
    existing = await db.virtual_cards.find_one({"card_id": card_id, "user_id": user_id}, {"_id": 0})
    if existing and existing.get("creation_payload") != creation_payload:
        raise HTTPException(status_code=409, detail="Idempotency-Key wurde mit anderen Kartendaten verwendet")
    if existing:
        return {
            "success": True,
            "card": {
                "card_id": existing["card_id"],
                "name": existing["name"],
                "card_number": existing.get("card_number"),
                "card_number_masked": existing.get("card_number_masked"),
                "cvv": existing.get("cvv"),
                "exp_month": existing.get("exp_month"),
                "exp_year": existing.get("exp_year"),
                "limit": existing.get("limit"),
                "expires_at": existing.get("expires_at"),
                "single_use": existing.get("single_use"),
            },
            "replayed": True,
        }

    wallet_result = await debit_wallet(
        user_id=user_id,
        amount=req.limit,
        tx_type=TransactionType.PAYMENT,
        description=f"Virtual Card Limit reserviert: {req.name}",
        reference=f"VCRES-{marker[:12].upper()}",
        metadata={"type": "virtual_card_reservation", "card_id": card_id},
        idempotency_key=f"virtual-card-create:{marker}",
    )
    if not wallet_result.success:
        raise HTTPException(status_code=400, detail=wallet_result.error or "Nicht genügend Guthaben für das Kartenlimit")

    reserve_field = f"virtual_card_reservation_markers.{marker}"
    reserve = await db.users.update_one(
        {"_id": user["_id"], reserve_field: {"$exists": False}},
        {
            "$inc": {"reserved_balance": req.limit},
            "$set": {reserve_field: {
                "card_id": card_id,
                "amount": req.limit,
                "wallet_transaction_id": wallet_result.transaction_id,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }},
        },
    )
    if reserve.modified_count != 1:
        reserved = await db.users.find_one({"_id": user["_id"], reserve_field: {"$exists": True}}, {"_id": 1})
        if not reserved:
            rollback = await credit_wallet(
                user_id=user_id,
                amount=req.limit,
                tx_type=TransactionType.REFUND,
                description="Virtual Card Reservierung zurückgebucht",
                reference=f"VCROLL-{marker[:12].upper()}",
                source="virtual_cards_legacy",
                metadata={"card_id": card_id, "reason": "reservation_marker_failed"},
                idempotency_key=f"virtual-card-create-rollback:{marker}",
            )
            if not rollback.success:
                raise HTTPException(status_code=500, detail="Kartenreservierung benötigt Abstimmung")
            raise HTTPException(status_code=409, detail="Kartenreservierung fehlgeschlagen. Wallet wurde zurückgebucht.")

    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(hours=req.expires_hours)
    
    # Generate card details
    card_number = generate_card_number()
    cvv = generate_cvv()
    exp_month = (now.month + 6) % 12 or 12
    exp_year = now.year + (1 if now.month + 6 > 12 else 0)
    
    card = {
        "card_id": card_id,
        "user_id": user_id,
        "name": req.name,
        "card_number": card_number,
        "card_number_masked": f"•••• •••• •••• {card_number[-4:]}",
        "cvv": cvv,
        "exp_month": str(exp_month).zfill(2),
        "exp_year": str(exp_year)[-2:],
        "limit": req.limit,
        "spent": 0.0,
        "remaining": req.limit,
        "single_use": req.single_use,
        "creation_payload": creation_payload,
        "status": "active",
        "transactions": [],
        "created_at": now.isoformat(),
        "expires_at": expires_at.isoformat(),
    }
    
    try:
        await db.virtual_cards.update_one(
            {"card_id": card_id, "user_id": user_id},
            {"$setOnInsert": card},
            upsert=True,
        )
    except Exception:
        refunded = await _refund_legacy_card_reservation_once(
            {"card_id": card_id, "user_id": user_id},
            req.limit,
            "create_persist_failed",
        )
        if not refunded:
            raise HTTPException(status_code=500, detail="Kartenerstellung fehlgeschlagen; Reservierung benötigt Abstimmung")
        raise HTTPException(status_code=500, detail="Kartenerstellung fehlgeschlagen. Wallet wurde zurückgebucht.")

    persisted = await db.virtual_cards.find_one(
        {"card_id": card_id, "user_id": user_id},
        {"_id": 0},
    )
    if not persisted:
        refunded = await _refund_legacy_card_reservation_once(
            {"card_id": card_id, "user_id": user_id},
            req.limit,
            "create_missing_after_persist",
        )
        if not refunded:
            raise HTTPException(status_code=500, detail="Kartenerstellung benötigt Abstimmung")
        raise HTTPException(status_code=500, detail="Kartenerstellung fehlgeschlagen. Wallet wurde zurückgebucht.")

    return {
        "success": True,
        "card": {
            "card_id": persisted["card_id"],
            "name": persisted["name"],
            "card_number": persisted.get("card_number"),
            "card_number_masked": persisted.get("card_number_masked"),
            "cvv": persisted.get("cvv"),
            "exp_month": persisted.get("exp_month"),
            "exp_year": persisted.get("exp_year"),
            "limit": persisted.get("limit"),
            "expires_at": persisted.get("expires_at"),
            "single_use": persisted.get("single_use"),
        },
        "replayed": bool(wallet_result.replayed),
    }


@router.get("/my-cards")
async def get_my_cards(request: Request, include_inactive: bool = False):
    """Get all user's virtual cards"""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    query = {"user_id": user_id}
    if not include_inactive:
        query["status"] = "active"
    
    cards = await db.virtual_cards.find(
        query,
        {"_id": 0, "cvv": 0, "card_number": 0}  # List is always masked
    ).sort("created_at", -1).to_list(50)
    
    # Check for expired cards
    now = datetime.now(timezone.utc)
    for card in cards:
        if card.get("expires_at"):
            exp = datetime.fromisoformat(card["expires_at"])
            if now > exp and card["status"] == "active":
                # Mark as expired and refund
                await expire_card(card["card_id"], user_id)
                card["status"] = "expired"
    
    return {
        "cards": cards,
        "live_issuer_connected": False,
        "card_creation_available": bool(TEST_MODE),
    }


@router.get("/{card_id}")
async def get_card_details(card_id: str, request: Request):
    """Return simulator PAN/CVV only in test mode."""
    _require_virtual_card_test_mode()
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    card = await db.virtual_cards.find_one(
        {"card_id": card_id, "user_id": user_id},
        {"_id": 0}
    )
    
    if not card:
        raise HTTPException(status_code=404, detail="Karte nicht gefunden")
    
    return {"card": card}


@router.post("/{card_id}/freeze")
async def freeze_card(card_id: str, request: Request):
    """[DEPRECATED] Freeze a card. Use /api/cards/{id}/freeze (cards_lifecycle.py)."""
    from routes.cards_lifecycle import freeze_card as _new_freeze
    return await _new_freeze(card_id, request)


@router.delete("/{card_id}")
async def delete_card(card_id: str, request: Request):
    """Delete a legacy simulated card and release its reserved wallet amount exactly once."""
    user = await get_current_user(request)
    user_id = str(user["_id"])

    card = await db.virtual_cards.find_one({"card_id": card_id, "user_id": user_id})
    if not card:
        raise HTTPException(status_code=404, detail="Karte nicht gefunden")
    if card.get("status") == "deleted":
        return {"success": True, "refunded": float(card.get("refunded_amount") or 0), "replayed": True}

    claim = await db.virtual_cards.find_one_and_update(
        {
            "card_id": card_id,
            "user_id": user_id,
            "status": {"$nin": ["deleted", "deleting"]},
        },
        {"$set": {
            "status": "deleting",
            "delete_started_at": datetime.now(timezone.utc).isoformat(),
        }},
        return_document=True,
    )
    card = claim or await db.virtual_cards.find_one({"card_id": card_id, "user_id": user_id}) or card
    remaining = round(max(0.0, float(card.get("remaining") or 0)), 2)

    if remaining > 0:
        if not await _refund_legacy_card_reservation_once(card, remaining, "delete"):
            raise HTTPException(status_code=409, detail="Kartenreservierung benötigt Abstimmung")

    await db.virtual_cards.update_one(
        {"card_id": card_id, "user_id": user_id, "status": "deleting"},
        {"$set": {
            "status": "deleted",
            "remaining": 0.0,
            "refunded_amount": remaining,
            "deleted_at": datetime.now(timezone.utc).isoformat(),
        }},
    )
    return {"success": True, "refunded": remaining, "replayed": claim is None}

async def expire_card(card_id: str, user_id: str):
    """Expire a legacy simulated card and release reserved funds exactly once."""
    card = await db.virtual_cards.find_one({"card_id": card_id, "user_id": user_id})
    if not card or card.get("status") in {"expired", "deleted"}:
        return

    claimed = await db.virtual_cards.find_one_and_update(
        {
            "card_id": card_id,
            "user_id": user_id,
            "status": {"$in": ["active", "frozen", "used", "expiring"]},
        },
        {"$set": {
            "status": "expiring",
            "expire_started_at": datetime.now(timezone.utc).isoformat(),
        }},
        return_document=True,
    )
    card = claimed or card
    remaining = round(max(0.0, float(card.get("remaining") or 0)), 2)
    if remaining > 0 and not await _refund_legacy_card_reservation_once(card, remaining, "expiry"):
        raise RuntimeError(f"Virtual card {card_id} reservation requires reconciliation")

    await db.virtual_cards.update_one(
        {"card_id": card_id, "user_id": user_id, "status": "expiring"},
        {"$set": {
            "status": "expired",
            "remaining": 0.0,
            "refunded_amount": remaining,
            "expired_at": datetime.now(timezone.utc).isoformat(),
        }},
    )

# Simulated payment endpoint (in production, this would be a webhook from card processor)
@router.post("/payment")
async def process_card_payment(req: CardPaymentRequest, request: Request):
    """Legacy simulator: never represents a real card-processor payment in production."""
    user = await get_current_user(request)
    if not TEST_MODE:
        raise HTTPException(
            status_code=503,
            detail="Legacy-Kartensimulation ist in Production deaktiviert. Kartenumsätze müssen vom verifizierten Kartenprovider kommen.",
        )
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Nur Admin im Testmodus")

    card = await db.virtual_cards.find_one({"card_id": req.card_id})
    
    if not card:
        return {"success": False, "error": "Card not found"}
    
    if card["status"] != "active":
        return {"success": False, "error": "Card is not active"}
    
    if req.amount > card["remaining"]:
        return {"success": False, "error": "Insufficient card limit"}
    
    now = datetime.now(timezone.utc)
    
    # Check expiry
    if card.get("expires_at"):
        exp = datetime.fromisoformat(card["expires_at"])
        if now > exp:
            await expire_card(card["card_id"], card["user_id"])
            return {"success": False, "error": "Card expired"}
    
    # Process payment
    new_spent = card["spent"] + req.amount
    new_remaining = card["remaining"] - req.amount
    
    tx = {
        "amount": req.amount,
        "merchant": req.merchant,
        "timestamp": now.isoformat(),
    }
    
    update = {
        "$set": {
            "spent": new_spent,
            "remaining": new_remaining,
        },
        "$push": {"transactions": tx}
    }
    
    # If single-use, deactivate after first use
    if card["single_use"]:
        update["$set"]["status"] = "used"
        # Refund remaining
        if new_remaining > 0:
            if not await _refund_legacy_card_reservation_once(card, new_remaining, "single_use_payment"):
                raise HTTPException(status_code=409, detail="Kartenrestbetrag benötigt Abstimmung")
            update["$set"]["remaining"] = 0
    
    # Deduct from reserved balance
    await db.users.update_one(
        {"_id": ObjectId(card["user_id"])},
        {"$inc": {"reserved_balance": -req.amount}}
    )
    
    await db.virtual_cards.update_one({"card_id": req.card_id}, update)
    
    # Create transaction record
    await db.transactions.insert_one({
        "id": f"tx_{secrets.token_hex(8)}",
        "user_id": card["user_id"],
        "type": "virtual_card_payment",
        "amount": -req.amount,
        "description": f"Kartenzahlung: {req.merchant}",
        "merchant_name": req.merchant,
        "card_id": req.card_id,
        "status": "completed",
        "created_at": now.isoformat(),
    })
    
    return {
        "success": True,
        "amount": req.amount,
        "remaining": new_remaining if not card["single_use"] else 0,
    }
