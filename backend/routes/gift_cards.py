"""BidBlitz Gift Cards.

Third-party gift-card codes require a verified provider. Production therefore
fails closed until a live provider is integrated. TEST_MODE may use local test
codes so UI/e2e flows can be exercised without charging real providers.
"""
from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from core.config import TEST_MODE
from core.database import db
from core.payment_engine import credit_wallet, debit_wallet, TransactionType
from core.security import get_current_user

router = APIRouter(prefix="/api/gift-cards", tags=["gift-cards"])

GIFT_CARD_CATALOG = {
    "amazon": {"name": "Amazon", "amounts": [10, 25, 50, 100]},
    "netflix": {"name": "Netflix", "amounts": [15, 25, 50]},
    "spotify": {"name": "Spotify", "amounts": [10, 30, 60]},
    "apple": {"name": "Apple", "amounts": [15, 25, 50, 100]},
    "google": {"name": "Google Play", "amounts": [15, 25, 50]},
    "steam": {"name": "Steam", "amounts": [20, 50, 100]},
    "psn": {"name": "PlayStation", "amounts": [20, 50]},
    "xbox": {"name": "Xbox", "amounts": [15, 25, 50]},
}


class GiftCardPurchase(BaseModel):
    type: str = Field(..., min_length=2, max_length=40)
    amount: float = Field(..., gt=0, le=500, allow_inf_nan=False)
    idempotency_key: Optional[str] = Field(default=None, max_length=200)


def _purchase_key(body_key: Optional[str], request: Request) -> str:
    key = (body_key or request.headers.get("Idempotency-Key") or "").strip()
    if not 8 <= len(key) <= 200:
        raise HTTPException(status_code=400, detail="Idempotency-Key erforderlich")
    return key


def _public_card(doc: dict) -> dict:
    card = {
        "card_id": doc.get("card_id") or doc.get("gift_id"),
        "type": doc.get("type") or doc.get("brand"),
        "brand_name": doc.get("brand_name"),
        "amount": round(float(doc.get("amount") or 0), 2),
        "status": doc.get("status"),
        "created_at": doc.get("created_at"),
        "is_demo": bool(doc.get("is_demo", False)),
    }
    if TEST_MODE and doc.get("is_demo"):
        card["code"] = doc.get("code")
    else:
        card["code"] = None
        card["code_masked"] = "Nicht verfügbar"
        if doc.get("is_demo"):
            card["status"] = "legacy_demo"
    return card


@router.get("/capabilities")
async def gift_card_capabilities():
    return {
        "live_provider_connected": False,
        "purchase_available": bool(TEST_MODE),
        "simulation_available": bool(TEST_MODE),
        "catalog": GIFT_CARD_CATALOG,
        "production_message": (
            None
            if TEST_MODE
            else "Geschenkkarten-Käufe werden erst aktiviert, wenn ein verifizierter Gift-Card-Provider live verbunden ist. Es wird kein Wallet-Guthaben belastet."
        ),
    }


@router.get("/my")
async def my_gift_cards(request: Request):
    user = await get_current_user(request)
    user_id = str(user["_id"])
    docs = await db.gift_cards.find(
        {
            "$or": [
                {"purchaser_user_id": user_id},
                {"from_user_id": user_id},
            ]
        },
        {"_id": 0},
    ).sort("created_at", -1).limit(100).to_list(100)
    return {
        "cards": [_public_card(doc) for doc in docs],
        "live_provider_connected": False,
        "purchase_available": bool(TEST_MODE),
    }


@router.post("/purchase")
async def purchase_gift_card(req: GiftCardPurchase, request: Request):
    user = await get_current_user(request)
    user_id = str(user["_id"])

    # No fake Amazon/Apple/etc. codes or wallet debits in production.
    if not TEST_MODE:
        raise HTTPException(
            status_code=503,
            detail=(
                "Gift-Card-Provider ist noch nicht live verbunden. "
                "Es wurde kein Wallet-Guthaben belastet."
            ),
        )

    product = GIFT_CARD_CATALOG.get(req.type)
    if not product:
        raise HTTPException(status_code=400, detail="Unbekannter Geschenkkarten-Typ")

    amount = round(float(req.amount), 2)
    allowed = {round(float(value), 2) for value in product["amounts"]}
    if amount not in allowed:
        raise HTTPException(status_code=400, detail="Betrag ist für diese Geschenkkarte nicht verfügbar")

    idempotency_key = _purchase_key(req.idempotency_key, request)
    key_hash = hashlib.sha256(f"{user_id}:{idempotency_key}".encode("utf-8")).hexdigest()[:20]
    card_id = f"GFT-{key_hash.upper()}"

    existing = await db.gift_cards.find_one(
        {"card_id": card_id, "purchaser_user_id": user_id},
        {"_id": 0},
    )
    if existing:
        if existing.get("type") != req.type or round(float(existing.get("amount") or 0), 2) != amount:
            raise HTTPException(status_code=409, detail="Idempotency-Key wurde bereits für einen anderen Kauf verwendet")
        return {"ok": True, "card": _public_card(existing), "replayed": True}

    payment = await debit_wallet(
        user_id=user_id,
        amount=amount,
        tx_type=TransactionType.PAYMENT,
        description=f"TEST Geschenkkarte: {product['name']}",
        reference=f"TEST-GIFT-{key_hash[:12].upper()}",
        metadata={
            "kind": "gift_card_test_purchase",
            "card_id": card_id,
            "brand": req.type,
            "is_demo": True,
        },
        idempotency_key=f"gift-card:test:{user_id}:{idempotency_key}",
    )
    if not payment.success:
        status = str(getattr(payment.status, "value", payment.status))
        raise HTTPException(
            status_code=409 if status in {"pending", "reconciliation_required"} else 402,
            detail=payment.error or "Test-Geschenkkarten-Zahlung fehlgeschlagen",
        )

    now = datetime.now(timezone.utc).isoformat()
    code = f"TEST-{req.type.upper()}-{secrets.token_hex(6).upper()}"
    doc = {
        "_id": card_id,
        "card_id": card_id,
        "type": req.type,
        "brand_name": product["name"],
        "amount": amount,
        "code": code,
        "purchaser_user_id": user_id,
        "payment_transaction_id": payment.transaction_id,
        "payment_reference": payment.reference,
        "status": "test_active",
        "is_demo": True,
        "created_at": now,
    }

    try:
        await db.gift_cards.update_one(
            {"_id": card_id},
            {"$setOnInsert": doc},
            upsert=True,
        )
        saved = await db.gift_cards.find_one({"_id": card_id}, {"_id": 0}) or doc
    except Exception:
        refund = await credit_wallet(
            user_id=user_id,
            amount=amount,
            tx_type=TransactionType.REFUND,
            description="TEST Geschenkkarten-Kauf Rollback",
            reference=f"TEST-GIFT-RB-{key_hash[:12].upper()}",
            source="gift_card_test_rollback",
            metadata={"card_id": card_id, "is_demo": True},
            idempotency_key=f"gift-card:test-rollback:{card_id}",
        )
        if not refund.success:
            raise HTTPException(
                status_code=500,
                detail="Test-Kauf konnte nicht gespeichert werden; Wallet benötigt Abstimmung",
            )
        raise HTTPException(
            status_code=500,
            detail="Test-Kauf konnte nicht gespeichert werden; Betrag wurde zurückgezahlt",
        )

    return {
        "ok": True,
        "card": _public_card(saved),
        "replayed": bool(payment.idempotent_replay),
    }
