"""
BidBlitz - Card Lifecycle Extensions
====================================
Extends the existing virtual cards system with freeze/unfreeze and
transaction listing. Works against BOTH Stripe Issuing cards (when
STRIPE_ISSUING_ENABLED=true) and local mock cards.

Endpoints:
  POST /api/cards/{card_id}/freeze
  POST /api/cards/{card_id}/unfreeze
  GET  /api/cards/{card_id}/transactions
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Request

from core.config import STRIPE_API_KEY, STRIPE_ISSUING_ENABLED
from core.database import db
from core.security import get_current_user

logger = logging.getLogger("bidblitz.cards_extra")

try:
    import stripe as _stripe
    if STRIPE_ISSUING_ENABLED and STRIPE_API_KEY:
        _stripe.api_key = STRIPE_API_KEY
except ImportError:
    _stripe = None

router = APIRouter(tags=["cards-extra"])


async def _resolve_card(card_id: str, user_id: str) -> tuple[dict, str]:
    """Find a card by either Stripe ID or local card_id. Returns (doc, kind)."""
    if STRIPE_ISSUING_ENABLED and _stripe:
        doc = await db.issuing_cards.find_one(
            {"stripe_card_id": card_id, "user_id": user_id}, {"_id": 0}
        )
        if doc:
            return doc, "stripe"
    doc = await db.virtual_cards.find_one(
        {"card_id": card_id, "user_id": user_id}, {"_id": 0}
    )
    if doc:
        return doc, "local"
    raise HTTPException(status_code=404, detail="Karte nicht gefunden")


async def _set_status(card_id: str, user_id: str, new_status: str, stripe_status: Optional[str] = None) -> dict:
    doc, kind = await _resolve_card(card_id, user_id)

    if kind == "stripe":
        try:
            updated = _stripe.issuing.Card.modify(card_id, status=stripe_status or new_status)
        except Exception as e:
            logger.error("Stripe Card.modify failed: %s", e)
            raise HTTPException(status_code=502, detail=f"Stripe Fehler: {e}")
        await db.issuing_cards.update_one(
            {"stripe_card_id": card_id, "user_id": user_id},
            {"$set": {"status": updated.status, "updated_at": datetime.now(timezone.utc).isoformat()}},
        )
        return {"ok": True, "status": updated.status, "kind": "stripe"}

    # Local mock
    await db.virtual_cards.update_one(
        {"card_id": card_id, "user_id": user_id},
        {"$set": {"status": new_status, "updated_at": datetime.now(timezone.utc).isoformat()}},
    )
    return {"ok": True, "status": new_status, "kind": "local"}


@router.post("/api/cards/{card_id}/freeze")
async def freeze_card(card_id: str, request: Request):
    user = await get_current_user(request)
    user_id = str(user["_id"])
    # Stripe equivalent: 'inactive' (re-activatable). 'canceled' is permanent — not used here.
    return await _set_status(card_id, user_id, new_status="frozen", stripe_status="inactive")


@router.post("/api/cards/{card_id}/unfreeze")
async def unfreeze_card(card_id: str, request: Request):
    user = await get_current_user(request)
    user_id = str(user["_id"])
    return await _set_status(card_id, user_id, new_status="active", stripe_status="active")


@router.get("/api/cards/{card_id}/transactions")
async def list_card_transactions(card_id: str, request: Request, limit: int = 50):
    user = await get_current_user(request)
    user_id = str(user["_id"])
    # Validate ownership
    doc, kind = await _resolve_card(card_id, user_id)

    limit = max(1, min(int(limit), 200))

    if kind == "stripe":
        # Use unified card_transactions collection (populated by issuing webhook)
        # AND fall back to issuing_transactions (raw)
        txs = await db.issuing_transactions.find(
            {"card_id": card_id}, {"_id": 0}
        ).sort("received_at", -1).to_list(limit)
        norm = [{
            "transaction_id": t.get("stripe_transaction_id"),
            "card_id": card_id,
            "amount": (t.get("amount") or 0) / 100.0,  # cents → EUR
            "currency": t.get("currency", "eur"),
            "merchant_name": (t.get("merchant") or {}).get("name") or "Unknown",
            "status": "completed",
            "type": t.get("type", "capture"),
            "created_at": t.get("received_at"),
        } for t in txs]
        return {"transactions": norm, "count": len(norm), "kind": "stripe"}

    # Local mock
    txs = await db.card_transactions.find(
        {"card_id": card_id, "user_id": user_id}, {"_id": 0}
    ).sort("created_at", -1).to_list(limit)
    return {"transactions": txs, "count": len(txs), "kind": "local"}
