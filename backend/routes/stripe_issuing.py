"""
BidBlitz — Stripe Issuing (Real Virtual Cards)
==============================================
Replaces the mocked `virtual_cards.py` once Stripe Issuing is enabled in the
Dashboard and STRIPE_ISSUING_ENABLED=true is set in the backend .env.

Endpoints:
  POST   /api/issuing/cardholders                -> Create or upgrade cardholder
  GET    /api/issuing/cardholders/me             -> Get authenticated user's cardholder
  POST   /api/issuing/cards                      -> Issue virtual card to current user
  GET    /api/issuing/cards                      -> List current user's cards
  POST   /api/issuing/cards/{id}/ephemeral-key   -> Mint ephemeral key for client
  POST   /api/issuing/cards/{id}/status          -> Activate / deactivate / cancel
  POST   /api/webhooks/stripe-issuing            -> Stripe webhook (auth + tx)

Notes:
- All monetary values are in cents (Stripe convention).
- Cardholder document mirrors the Stripe ID + minimal PII (no PAN/CVC stored).
- Card document mirrors the Stripe ID + non-sensitive metadata.
- Real-time authorization policy is implemented in `_evaluate_authorization`.
"""
from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Optional

import stripe
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, EmailStr, Field

from core.config import (
    STRIPE_API_KEY,
    STRIPE_ISSUING_ENABLED,
    STRIPE_ISSUING_DAILY_LIMIT_CENTS,
    STRIPE_ISSUING_WEBHOOK_SECRET,
)
from core.database import db
from core.security import get_current_user

router = APIRouter(tags=["stripe-issuing"])

# Configure stripe client lazily — only set the global key when Issuing is enabled,
# otherwise we must NOT clobber the existing stripe.api_key used by checkout.
if STRIPE_ISSUING_ENABLED and STRIPE_API_KEY:
    stripe.api_key = STRIPE_API_KEY


# ── Pydantic Models ────────────────────────────────────────────────────────


class BillingAddress(BaseModel):
    line1: str
    city: str
    state: str = ""
    postal_code: str
    country: str = Field(..., min_length=2, max_length=2, description="ISO-3166-1 alpha-2")
    line2: Optional[str] = None


class CreateCardholderRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=24)
    email: Optional[EmailStr] = None
    phone_number: Optional[str] = None
    billing: BillingAddress


class CreateCardRequest(BaseModel):
    currency: str = "eur"
    card_type: str = Field("virtual", pattern="^(virtual|physical)$")


class EphemeralKeyRequest(BaseModel):
    nonce: str


class UpdateCardStatusRequest(BaseModel):
    status: str = Field(..., pattern="^(active|inactive|canceled)$")
    cancellation_reason: Optional[str] = Field(
        None, pattern="^(lost|stolen|fraudulent|expired|design_rejected|return_expired|return_canceled)$"
    )


# ── Helper Guards ──────────────────────────────────────────────────────────


def _require_enabled():
    if not STRIPE_ISSUING_ENABLED:
        raise HTTPException(
            status_code=503,
            detail=(
                "Stripe Issuing nicht aktiviert. Bitte STRIPE_ISSUING_ENABLED=true setzen "
                "und Issuing im Stripe-Dashboard freischalten."
            ),
        )
    if not STRIPE_API_KEY:
        raise HTTPException(status_code=500, detail="STRIPE_API_KEY fehlt")


def _stripe_error(e: Exception) -> HTTPException:
    if isinstance(e, stripe.error.InvalidRequestError):
        return HTTPException(400, str(e))
    if isinstance(e, stripe.error.AuthenticationError):
        return HTTPException(401, "Stripe Auth Fehler")
    if isinstance(e, stripe.error.PermissionError):
        return HTTPException(403, str(e))
    if isinstance(e, stripe.error.RateLimitError):
        return HTTPException(429, "Stripe Rate Limit erreicht")
    if isinstance(e, stripe.error.APIConnectionError):
        return HTTPException(503, "Stripe API nicht erreichbar")
    return HTTPException(500, f"Stripe Fehler: {e}")


# ── Cardholder Endpoints ───────────────────────────────────────────────────


@router.post("/api/issuing/cardholders")
async def create_or_get_cardholder(req: CreateCardholderRequest, request: Request):
    _require_enabled()
    user = await get_current_user(request)
    user_id = str(user["_id"])

    existing = await db.issuing_cardholders.find_one({"user_id": user_id}, {"_id": 0})
    if existing:
        return {"ok": True, "cardholder_id": existing["stripe_cardholder_id"], "status": existing.get("status", "active"), "existing": True}

    try:
        params = {
            "type": "individual",
            "name": req.name,
            "billing": {
                "address": {
                    "line1": req.billing.line1,
                    "city": req.billing.city,
                    "postal_code": req.billing.postal_code,
                    "country": req.billing.country.upper(),
                }
            },
        }
        if req.billing.state:
            params["billing"]["address"]["state"] = req.billing.state
        if req.billing.line2:
            params["billing"]["address"]["line2"] = req.billing.line2
        if req.email:
            params["email"] = req.email
        if req.phone_number:
            params["phone_number"] = req.phone_number

        ch = stripe.issuing.Cardholder.create(**params)
    except Exception as e:
        raise _stripe_error(e)

    doc = {
        "user_id": user_id,
        "stripe_cardholder_id": ch.id,
        "name": ch.name,
        "email": ch.get("email"),
        "status": ch.status,
        "type": ch.type,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "daily_limit_cents": STRIPE_ISSUING_DAILY_LIMIT_CENTS,
    }
    await db.issuing_cardholders.insert_one(doc)
    doc.pop("_id", None)
    return {"ok": True, "cardholder_id": ch.id, "status": ch.status, "existing": False}


@router.get("/api/issuing/cardholders/me")
async def get_my_cardholder(request: Request):
    user = await get_current_user(request)
    user_id = str(user["_id"])
    ch = await db.issuing_cardholders.find_one({"user_id": user_id}, {"_id": 0})
    if not ch:
        raise HTTPException(404, "Kein Cardholder vorhanden — bitte zuerst anlegen")
    return ch


# ── Card Endpoints ─────────────────────────────────────────────────────────


@router.post("/api/issuing/cards")
async def issue_card(req: CreateCardRequest, request: Request):
    _require_enabled()
    user = await get_current_user(request)
    user_id = str(user["_id"])

    ch = await db.issuing_cardholders.find_one({"user_id": user_id}, {"_id": 0})
    if not ch:
        raise HTTPException(400, "Bitte zuerst Cardholder anlegen (POST /api/issuing/cardholders)")
    if ch.get("status") != "active":
        raise HTTPException(400, f"Cardholder ist {ch.get('status')} — keine Karten möglich")

    try:
        card = stripe.issuing.Card.create(
            cardholder=ch["stripe_cardholder_id"],
            currency=req.currency.lower(),
            type=req.card_type,
            status="active" if req.card_type == "virtual" else "inactive",
        )
    except Exception as e:
        raise _stripe_error(e)

    doc = {
        "user_id": user_id,
        "stripe_card_id": card.id,
        "stripe_cardholder_id": ch["stripe_cardholder_id"],
        "last4": card.last4,
        "brand": card.brand,
        "exp_month": card.exp_month,
        "exp_year": card.exp_year,
        "currency": card.currency,
        "type": card.type,
        "status": card.status,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.issuing_cards.insert_one(doc)
    doc.pop("_id", None)
    return {"ok": True, "card": doc}


@router.get("/api/issuing/cards")
async def list_my_cards(request: Request):
    user = await get_current_user(request)
    user_id = str(user["_id"])
    cards = await db.issuing_cards.find({"user_id": user_id}, {"_id": 0}).to_list(50)
    return {"cards": cards, "count": len(cards)}


@router.post("/api/issuing/cards/{card_id}/ephemeral-key")
async def create_card_ephemeral_key(card_id: str, req: EphemeralKeyRequest, request: Request):
    """
    Returns a short-lived ephemeral key (15 min) the React frontend uses with
    Stripe Issuing Elements to render PAN/CVC/expiry inside Stripe-hosted iframes.
    The PAN never touches our servers.
    """
    _require_enabled()
    user = await get_current_user(request)
    user_id = str(user["_id"])

    card_doc = await db.issuing_cards.find_one({"stripe_card_id": card_id, "user_id": user_id}, {"_id": 0})
    if not card_doc:
        raise HTTPException(404, "Karte nicht gefunden oder gehört nicht dir")

    try:
        ek = stripe.EphemeralKey.create(
            nonce=req.nonce,
            issuing_card=card_id,
            stripe_version="2024-06-20",
        )
    except Exception as e:
        raise _stripe_error(e)

    return {"ephemeralKeySecret": ek.secret, "expires_at": ek.expires}


@router.post("/api/issuing/cards/{card_id}/status")
async def update_card_status(card_id: str, req: UpdateCardStatusRequest, request: Request):
    _require_enabled()
    user = await get_current_user(request)
    user_id = str(user["_id"])

    card_doc = await db.issuing_cards.find_one({"stripe_card_id": card_id, "user_id": user_id}, {"_id": 0})
    if not card_doc:
        raise HTTPException(404, "Karte nicht gefunden")

    try:
        params = {"status": req.status}
        if req.status == "canceled":
            if not req.cancellation_reason:
                raise HTTPException(400, "cancellation_reason required when canceling")
            params["cancellation_reason"] = req.cancellation_reason
        card = stripe.issuing.Card.modify(card_id, **params)
    except HTTPException:
        raise
    except Exception as e:
        raise _stripe_error(e)

    await db.issuing_cards.update_one(
        {"stripe_card_id": card_id, "user_id": user_id},
        {"$set": {"status": card.status, "updated_at": datetime.now(timezone.utc).isoformat()}},
    )
    return {"ok": True, "status": card.status}


# ── Authorization Webhook ──────────────────────────────────────────────────


async def _evaluate_authorization(auth_obj: dict) -> tuple[bool, str]:
    """
    Real-time authorization policy. Returns (approved, reason).

    Policy:
      1. Card must exist in our DB and be active.
      2. Cardholder daily spending limit (per cardholder doc, cents).
      3. Wallet balance must cover the authorization amount.
    """
    try:
        card_id = (auth_obj.get("card") or {}).get("id") or auth_obj.get("card")
        amount_cents = int(auth_obj.get("amount") or 0)
        if amount_cents <= 0:
            return False, "Invalid amount"

        card_doc = await db.issuing_cards.find_one({"stripe_card_id": card_id}, {"_id": 0})
        if not card_doc:
            return False, "Card unknown"
        if card_doc.get("status") != "active":
            return False, f"Card status is {card_doc.get('status')}"

        # Cardholder daily limit
        ch_doc = await db.issuing_cardholders.find_one(
            {"stripe_cardholder_id": card_doc["stripe_cardholder_id"]}, {"_id": 0}
        )
        daily_limit = int((ch_doc or {}).get("daily_limit_cents") or STRIPE_ISSUING_DAILY_LIMIT_CENTS)
        if amount_cents > daily_limit:
            return False, f"Exceeds daily limit ({daily_limit} cents)"

        # Wallet check
        from bson import ObjectId  # local import to avoid circular
        try:
            user_oid = ObjectId(card_doc["user_id"])
        except Exception:
            return False, "Invalid user binding"
        user = await db.users.find_one({"_id": user_oid}, {"_id": 0, "balance": 1})
        balance_eur = float((user or {}).get("balance") or 0.0)
        balance_cents = int(round(balance_eur * 100))
        if balance_cents < amount_cents:
            return False, "Insufficient wallet balance"

        return True, "ok"
    except Exception as e:
        # Fail closed on errors to protect the user's wallet
        return False, f"Internal error: {e}"


@router.post("/api/webhooks/stripe-issuing")
async def stripe_issuing_webhook(request: Request):
    """
    Receives:
      - issuing_authorization.request   (synchronous, must respond with approved bool)
      - issuing_authorization.created
      - issuing_authorization.updated
      - issuing_transaction.created
      - issuing_card.updated / issuing_cardholder.updated
    """
    payload = await request.body()
    sig = request.headers.get("stripe-signature", "")
    if not STRIPE_ISSUING_WEBHOOK_SECRET:
        raise HTTPException(500, "STRIPE_ISSUING_WEBHOOK_SECRET nicht konfiguriert")
    try:
        event = stripe.Webhook.construct_event(payload, sig, STRIPE_ISSUING_WEBHOOK_SECRET)
    except Exception as e:
        raise HTTPException(400, f"Webhook verification failed: {e}")

    et = event.get("type", "")
    obj = (event.get("data") or {}).get("object") or {}

    if et == "issuing_authorization.request":
        approved, reason = await _evaluate_authorization(obj)
        await db.issuing_authorizations.insert_one({
            "stripe_authorization_id": obj.get("id"),
            "card_id": (obj.get("card") or {}).get("id"),
            "amount": obj.get("amount"),
            "currency": obj.get("currency"),
            "merchant": obj.get("merchant_data"),
            "approved": approved,
            "reason": reason,
            "received_at": datetime.now(timezone.utc).isoformat(),
        })
        return JSONResponse(
            content={"approved": approved, "metadata": {"reason": reason}},
            status_code=200,
        )

    if et == "issuing_transaction.created":
        # Settle the transaction against user wallet
        amount_cents = int(obj.get("amount") or 0)  # negative for purchases
        card_id = (obj.get("card") or {}).get("id")
        if card_id:
            card_doc = await db.issuing_cards.find_one({"stripe_card_id": card_id}, {"_id": 0})
            if card_doc and amount_cents != 0:
                from bson import ObjectId
                try:
                    user_oid = ObjectId(card_doc["user_id"])
                    delta_eur = amount_cents / 100.0  # purchases are negative -> reduces balance
                    await db.users.update_one({"_id": user_oid}, {"$inc": {"balance": delta_eur}})
                except Exception:
                    pass
        await db.issuing_transactions.insert_one({
            "stripe_transaction_id": obj.get("id"),
            "card_id": card_id,
            "amount": amount_cents,
            "currency": obj.get("currency"),
            "merchant": obj.get("merchant_data"),
            "type": obj.get("type"),
            "received_at": datetime.now(timezone.utc).isoformat(),
        })
        return {"received": True}

    if et in ("issuing_card.updated", "issuing_cardholder.updated"):
        coll = "issuing_cards" if et.startswith("issuing_card.") else "issuing_cardholders"
        key_field = "stripe_card_id" if coll == "issuing_cards" else "stripe_cardholder_id"
        await db[coll].update_one(
            {key_field: obj.get("id")},
            {"$set": {"status": obj.get("status"), "updated_at": datetime.now(timezone.utc).isoformat()}},
        )
        return {"received": True}

    # Catch-all log
    await db.issuing_events_log.insert_one({
        "type": et,
        "payload": json.loads(payload.decode("utf-8")) if payload else None,
        "received_at": datetime.now(timezone.utc).isoformat(),
    })
    return {"received": True}
