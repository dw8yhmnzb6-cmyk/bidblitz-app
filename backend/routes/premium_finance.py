"""
BidBlitz V2 - Premium Finance Features
Split Bill, Virtual Cards, Savings Goals, BNPL, Gift Cards
"""
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Request
from core.database import db
from core.security import get_current_user
from core.config import (
    STRIPE_API_KEY,
    STRIPE_ISSUING_ENABLED,
    STRIPE_ISSUING_DAILY_LIMIT_CENTS,
)
import secrets
import random
import string
import logging

logger = logging.getLogger("bidblitz.premium_finance")

# Stripe is optional — only required when STRIPE_ISSUING_ENABLED=true
try:
    import stripe as _stripe
    if STRIPE_ISSUING_ENABLED and STRIPE_API_KEY:
        _stripe.api_key = STRIPE_API_KEY
except ImportError:
    _stripe = None

router = APIRouter(tags=["premium-finance"])


# ══════════════════════════════════════════════════════════════════════════════
# SPLIT BILL
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/api/split-bill/create")
async def create_split_bill(request: Request):
    user = await get_current_user(request)
    body = await request.json()
    now = datetime.now(timezone.utc).isoformat()
    bill = {
        "bill_id": f"SB-{secrets.token_hex(4).upper()}",
        "creator_id": str(user["_id"]),
        "creator_name": user.get("name", ""),
        "title": body.get("title", ""),
        "total": body.get("total", 0),
        "participants": body.get("participants", []),
        "per_person": round(body.get("total", 0) / max(len(body.get("participants", [])), 1), 2),
        "status": "pending",
        "created_at": now,
    }
    await db.split_bills.insert_one(bill)
    bill.pop("_id", None)
    return {"ok": True, "bill": bill}


@router.get("/api/split-bill/my")
async def get_my_splits(request: Request):
    user = await get_current_user(request)
    bills = await db.split_bills.find({"creator_id": str(user["_id"])}, {"_id": 0}).sort("created_at", -1).to_list(50)
    return {"bills": bills}


# ══════════════════════════════════════════════════════════════════════════════
# VIRTUAL CARDS
# ══════════════════════════════════════════════════════════════════════════════
# When STRIPE_ISSUING_ENABLED=true, these endpoints provision REAL Stripe Issuing
# virtual debit cards. Otherwise they fall back to local mock cards (4-prefixed
# random PANs stored in DB) for demo / development.
#
# Frontend (/pages/VirtualCardsPage.jsx) gets a uniform shape:
#   { cards: [{ card_id, label, number, last4, exp_month, exp_year, limit, spent,
#               status, is_stripe: bool }] }
#
# For real Stripe cards `number` is masked ("•••• •••• •••• 4242") because the
# raw PAN can only be displayed inside Stripe-hosted iframes via Stripe.js +
# ephemeral keys (separate endpoint at /api/issuing/cards/{id}/ephemeral-key).


def _serialize_local_card(card: dict) -> dict:
    """Project a mock card document into the API response shape."""
    return {
        "card_id": card.get("card_id"),
        "label": card.get("label", "Virtuelle Karte"),
        "number": card.get("number", ""),
        "last4": (card.get("number", "") or "")[-4:],
        "cvv": card.get("cvv", ""),
        "exp_month": card.get("exp_month", 12),
        "exp_year": card.get("exp_year", 2027),
        "limit": card.get("limit", 0),
        "spent": card.get("spent", 0),
        "status": card.get("status", "active"),
        "is_stripe": False,
        "created_at": card.get("created_at"),
    }


def _serialize_stripe_card(card: dict) -> dict:
    """Project a Stripe Issuing card document into the API response shape."""
    last4 = card.get("last4") or ""
    return {
        "card_id": card.get("stripe_card_id"),
        "label": card.get("label", "BidBlitz Card"),
        "number": f"•••• •••• •••• {last4}" if last4 else "•••• •••• •••• ••••",
        "last4": last4,
        "cvv": "•••",
        "exp_month": card.get("exp_month"),
        "exp_year": card.get("exp_year"),
        "limit": card.get("daily_limit_cents", STRIPE_ISSUING_DAILY_LIMIT_CENTS) / 100.0,
        "spent": card.get("spent_today_cents", 0) / 100.0,
        "status": card.get("status", "active"),
        "is_stripe": True,
        "created_at": card.get("created_at"),
    }


async def _ensure_stripe_cardholder(user: dict) -> str:
    """Get or auto-create a Stripe cardholder for the user. Returns cardholder ID."""
    user_id = str(user["_id"])
    existing = await db.issuing_cardholders.find_one({"user_id": user_id}, {"_id": 0})
    if existing:
        return existing["stripe_cardholder_id"]

    # Auto-create with minimal data — production usage should call POST
    # /api/issuing/cardholders explicitly with full billing address first.
    name = (user.get("name") or "").strip() or "BidBlitz User"
    # Stripe requires last_name; if only one word, duplicate it
    if " " not in name:
        name = f"{name} {name}"
    name = name[:24]

    try:
        ch = _stripe.issuing.Cardholder.create(
            type="individual",
            name=name,
            email=user.get("email"),
            billing={
                "address": {
                    "line1": "Default Address",
                    "city": "Berlin",
                    "postal_code": "10115",
                    "country": "DE",
                }
            },
        )
    except Exception as e:
        logger.error("Stripe cardholder create failed: %s", e)
        raise HTTPException(
            status_code=502,
            detail=(
                "Cardholder konnte nicht angelegt werden. "
                "Bitte zuerst POST /api/issuing/cardholders mit vollständiger "
                f"Rechnungsadresse aufrufen. Stripe-Fehler: {e}"
            ),
        )

    await db.issuing_cardholders.insert_one({
        "user_id": user_id,
        "stripe_cardholder_id": ch.id,
        "name": ch.name,
        "email": ch.get("email"),
        "status": ch.status,
        "type": ch.type,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "daily_limit_cents": STRIPE_ISSUING_DAILY_LIMIT_CENTS,
    })
    return ch.id


@router.get("/api/virtual-cards")
async def get_virtual_cards(request: Request):
    user = await get_current_user(request)
    user_id = str(user["_id"])

    if STRIPE_ISSUING_ENABLED and _stripe and STRIPE_API_KEY:
        cards = await db.issuing_cards.find({"user_id": user_id}, {"_id": 0}) \
            .sort("created_at", -1).to_list(50)
        return {"cards": [_serialize_stripe_card(c) for c in cards], "is_stripe": True}

    cards = await db.virtual_cards.find({"user_id": user_id}, {"_id": 0}) \
        .sort("created_at", -1).to_list(50)
    return {"cards": [_serialize_local_card(c) for c in cards], "is_stripe": False}


@router.post("/api/virtual-cards")
async def create_virtual_card(request: Request):
    user = await get_current_user(request)
    body = await request.json()
    user_id = str(user["_id"])
    now = datetime.now(timezone.utc).isoformat()

    label = (body.get("label") or "Virtuelle Karte")[:64]
    limit_eur = float(body.get("limit") or 50.0)
    if limit_eur < 1 or limit_eur > 5000:
        raise HTTPException(status_code=400, detail="Limit muss zwischen €1 und €5.000 liegen")

    if STRIPE_ISSUING_ENABLED and _stripe and STRIPE_API_KEY:
        cardholder_id = await _ensure_stripe_cardholder(user)
        try:
            stripe_card = _stripe.issuing.Card.create(
                cardholder=cardholder_id,
                currency="eur",
                type="virtual",
                status="active",
                metadata={"label": label, "user_id": user_id},
            )
        except Exception as e:
            logger.error("Stripe card create failed: %s", e)
            raise HTTPException(status_code=502, detail=f"Stripe Issuing Fehler: {e}")

        doc = {
            "user_id": user_id,
            "stripe_card_id": stripe_card.id,
            "stripe_cardholder_id": cardholder_id,
            "label": label,
            "last4": stripe_card.last4,
            "brand": stripe_card.brand,
            "exp_month": stripe_card.exp_month,
            "exp_year": stripe_card.exp_year,
            "currency": stripe_card.currency,
            "type": stripe_card.type,
            "status": stripe_card.status,
            "daily_limit_cents": int(round(limit_eur * 100)),
            "spent_today_cents": 0,
            "created_at": now,
        }
        await db.issuing_cards.insert_one(doc)
        doc.pop("_id", None)
        return {"ok": True, "card": _serialize_stripe_card(doc), "is_stripe": True}

    # Local mock fallback
    number = "4" + "".join([str(random.randint(0, 9)) for _ in range(15)])
    card = {
        "card_id": f"VC-{secrets.token_hex(4).upper()}",
        "user_id": user_id,
        "label": label,
        "number": number,
        "cvv": "".join([str(random.randint(0, 9)) for _ in range(3)]),
        "exp_month": 12,
        "exp_year": 2027,
        "limit": limit_eur,
        "spent": 0,
        "status": "active",
        "created_at": now,
    }
    await db.virtual_cards.insert_one(card)
    card.pop("_id", None)
    return {"ok": True, "card": _serialize_local_card(card), "is_stripe": False}


# ══════════════════════════════════════════════════════════════════════════════
# SAVINGS GOALS
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/api/savings/goals")
async def get_savings_goals(request: Request):
    user = await get_current_user(request)
    goals = await db.savings_goals.find({"user_id": str(user["_id"])}, {"_id": 0}).sort("created_at", -1).to_list(50)
    return {"goals": goals}


@router.post("/api/savings/goals")
async def create_savings_goal(request: Request):
    user = await get_current_user(request)
    body = await request.json()
    now = datetime.now(timezone.utc).isoformat()
    goal = {
        "goal_id": f"SG-{secrets.token_hex(4).upper()}",
        "user_id": str(user["_id"]),
        "name": body.get("name", ""),
        "target_amount": body.get("target_amount", 0),
        "current_amount": 0,
        "monthly_amount": body.get("monthly_amount", 0),
        "status": "active",
        "created_at": now,
    }
    await db.savings_goals.insert_one(goal)
    goal.pop("_id", None)
    return {"ok": True, "goal": goal}


# ══════════════════════════════════════════════════════════════════════════════
# BUY NOW PAY LATER
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/api/bnpl/orders")
async def get_bnpl_orders(request: Request):
    user = await get_current_user(request)
    orders = await db.bnpl_orders.find({"user_id": str(user["_id"])}, {"_id": 0}).sort("created_at", -1).to_list(50)
    return {"orders": orders}


# ══════════════════════════════════════════════════════════════════════════════
# GIFT CARDS
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/api/gift-cards/my")
async def get_my_gift_cards(request: Request):
    user = await get_current_user(request)
    cards = await db.gift_cards.find({"user_id": str(user["_id"])}, {"_id": 0}).sort("created_at", -1).to_list(50)
    return {"cards": cards}


@router.post("/api/gift-cards/purchase")
async def purchase_gift_card(request: Request):
    user = await get_current_user(request)
    body = await request.json()
    card_type = body.get("type", "")
    amount = body.get("amount", 0)

    if amount <= 0:
        raise HTTPException(status_code=400, detail="Ungültiger Betrag")

    # Check wallet balance
    user_doc = await db.users.find_one({"_id": user["_id"]})
    balance = user_doc.get("balance", 0)
    if balance < amount:
        raise HTTPException(status_code=400, detail="Nicht genug Guthaben")

    # Deduct from wallet
    await db.users.update_one({"_id": user["_id"]}, {"$inc": {"balance": -amount}})

    now = datetime.now(timezone.utc).isoformat()
    code = "".join(random.choices(string.ascii_uppercase + string.digits, k=16))
    code = f"{code[:4]}-{code[4:8]}-{code[8:12]}-{code[12:16]}"

    card = {
        "card_id": f"GC-{secrets.token_hex(4).upper()}",
        "user_id": str(user["_id"]),
        "type": card_type,
        "amount": amount,
        "code": code,
        "status": "active",
        "redeemed": False,
        "created_at": now,
    }
    await db.gift_cards.insert_one(card)

    # Transaction
    await db.transactions.insert_one({
        "id": secrets.token_hex(8),
        "user_id": str(user["_id"]),
        "type": "purchase",
        "amount": -amount,
        "description": f"Geschenkkarte {card_type} €{amount}",
        "status": "completed",
        "category": "gift_card",
        "created_at": now,
    })

    card.pop("_id", None)
    return {"ok": True, "card": card}
