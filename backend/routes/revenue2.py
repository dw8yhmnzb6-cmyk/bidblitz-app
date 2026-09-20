"""
Revenue Features Batch 2:
3. Premium Abo (Monthly, BLZ-based initially, Stripe-ready)
4. Marketplace Fee (2.9% on peer transactions)
5. Lottery (tägliche Verlosung mit BLZ-Losen)
"""
from datetime import datetime, timezone, timedelta
import random
import secrets
import hashlib
import os
from typing import Optional
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from bson import ObjectId
import logging

from core.database import db
from core.security import get_current_user
from core.config import TEST_MODE
from core.payment_engine import debit_wallet, credit_wallet, TransactionType

logger = logging.getLogger("bidblitz.revenue2")
router = APIRouter(prefix="/api", tags=["revenue2"])


def _oid(s):
    try: return ObjectId(s)
    except Exception: return s


def _require_revenue2_idempotency_key(body_key: Optional[str], request: Request, prefix: str) -> str:
    key = (body_key or request.headers.get("Idempotency-Key") or "").strip()
    if not 8 <= len(key) <= 200:
        raise HTTPException(status_code=400, detail="Idempotency-Key erforderlich")
    return f"{prefix}:{key}"


def _require_legacy_marketplace_test_mode() -> None:
    if not TEST_MODE:
        raise HTTPException(
            status_code=503,
            detail="Der alte Marketplace-Transfer ist in Production deaktiviert. Es wird kein Wallet-Geld bewegt.",
        )


def _require_revenue2_lottery_test_mode() -> None:
    if not TEST_MODE:
        raise HTTPException(
            status_code=503,
            detail="Die Legacy-Lotterie ist in Production deaktiviert. Es werden keine BLZ eingesetzt oder ausgeschüttet.",
        )


async def _platform_pool_user_id() -> str:
    email = os.environ.get("PLATFORM_POOL_EMAIL", "admin@bidblitz.ae").strip().lower()
    pool = await db.users.find_one({"email": email}, {"_id": 1})
    if not pool:
        raise HTTPException(status_code=503, detail="BidBlitz Plattform-Wallet ist nicht konfiguriert")
    return str(pool["_id"])


async def _mutate_blz_once(
    *,
    user_id: str,
    amount: int,
    direction: str,
    idempotency_key: str,
    description: str,
    category: str,
) -> dict:
    """Exactly-once mutation for internal BLZ points with deterministic audit row."""
    amount = int(amount)
    if amount <= 0 or direction not in {"debit", "credit"}:
        raise HTTPException(status_code=400, detail="Ungültige BLZ-Buchung")

    digest = hashlib.sha256(idempotency_key.encode("utf-8")).hexdigest()[:24]
    marker_field = f"revenue2_blz_markers.{digest}"
    selector = {"_id": _oid(user_id), marker_field: {"$exists": False}}
    delta = amount if direction == "credit" else -amount
    if direction == "debit":
        selector["balance_blz"] = {"$gte": amount}

    marker = {
        "direction": direction,
        "amount": amount,
        "category": category,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    result = await db.users.update_one(
        selector,
        {
            "$inc": {"balance_blz": delta},
            "$set": {marker_field: marker},
        },
    )
    replayed = False
    if result.modified_count != 1:
        existing = await db.users.find_one(
            {"_id": _oid(user_id), marker_field: {"$exists": True}},
            {"_id": 0, "balance_blz": 1},
        )
        if existing:
            replayed = True
        else:
            fresh = await db.users.find_one({"_id": _oid(user_id)}, {"_id": 0, "balance_blz": 1})
            if not fresh:
                raise HTTPException(status_code=404, detail="Wallet-Nutzer nicht gefunden")
            if direction == "debit":
                raise HTTPException(
                    status_code=400,
                    detail=f"Nicht genug BLZ (verfügbar: {int(float(fresh.get('balance_blz', 0) or 0))})",
                )
            raise HTTPException(status_code=409, detail="BLZ-Buchung konnte nicht atomar angewendet werden")

    tx_id = f"BLZ-{digest.upper()}"
    await db.transactions.update_one(
        {"id": tx_id},
        {"$setOnInsert": {
            "id": tx_id,
            "user_id": user_id,
            "type": "payment" if direction == "debit" else "reward",
            "amount": -amount if direction == "debit" else amount,
            "currency": "BLZ",
            "direction": direction,
            "status": "completed",
            "description": description,
            "category": category,
            "reference": tx_id,
            "idempotency_key": idempotency_key,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }},
        upsert=True,
    )
    fresh = await db.users.find_one({"_id": _oid(user_id)}, {"_id": 0, "balance_blz": 1}) or {}
    return {
        "transaction_id": tx_id,
        "new_balance_blz": int(float(fresh.get("balance_blz", 0) or 0)),
        "replayed": replayed,
    }


# ═══════════════════════════════════════════════════════════
# 3. PREMIUM ABO
# ═══════════════════════════════════════════════════════════
PREMIUM_PRICE_EUR = 4.99
PREMIUM_PRICE_BLZ = 499  # Alternative: 499 BLZ = 1 Monat
PREMIUM_BENEFITS = {
    "no_auction_fees": True,
    "mining_multiplier": 2.0,
    "monthly_blz_bonus": 50,
    "cashback_pct": 0.05,
    "priority_support": True,
    "premium_badge": True,
}

# Launch-Event: 50% Rabatt bis 7 Tage nach Launch
PREMIUM_LAUNCH_START = datetime(2026, 4, 19, tzinfo=timezone.utc)
PREMIUM_LAUNCH_DURATION_DAYS = 7
PREMIUM_LAUNCH_DISCOUNT = 0.50  # 50% off


def _launch_info():
    """Return launch-event state + effective prices."""
    now = datetime.now(timezone.utc)
    ends_at = PREMIUM_LAUNCH_START + timedelta(days=PREMIUM_LAUNCH_DURATION_DAYS)
    active = PREMIUM_LAUNCH_START <= now < ends_at
    if active:
        eur = round(PREMIUM_PRICE_EUR * (1 - PREMIUM_LAUNCH_DISCOUNT), 2)
        blz = int(round(PREMIUM_PRICE_BLZ * (1 - PREMIUM_LAUNCH_DISCOUNT)))
    else:
        eur, blz = PREMIUM_PRICE_EUR, PREMIUM_PRICE_BLZ
    return {
        "launch_active": active,
        "discount_pct": int(PREMIUM_LAUNCH_DISCOUNT * 100) if active else 0,
        "launch_ends_at": ends_at.isoformat(),
        "price_eur": eur,
        "price_blz": blz,
        "original_price_eur": PREMIUM_PRICE_EUR,
        "original_price_blz": PREMIUM_PRICE_BLZ,
    }


@router.get("/premium/status")
async def premium_status(request: Request):
    user = await get_current_user(request)
    uid = str(user.get("_id") or user.get("id"))
    info = _launch_info()
    balance_eur = round(float(user.get("balance", 0) or 0), 2)
    balance_blz = int(float(user.get("balance_blz", 0) or 0))
    sub = await db.premium_subscriptions.find_one({"user_id": uid, "active": True})
    if not sub:
        return {
            "active": False, "benefits": PREMIUM_BENEFITS,
            "balance_eur": balance_eur, "balance_blz": balance_blz,
            **info,
        }
    sub.pop("_id", None)
    now = datetime.now(timezone.utc)
    expires_at = sub.get("expires_at")
    expired = False
    if expires_at:
        try:
            exp_dt = datetime.fromisoformat(expires_at.replace("Z", "+00:00"))
            if exp_dt.tzinfo is None:
                exp_dt = exp_dt.replace(tzinfo=timezone.utc)
            if exp_dt < now:
                expired = True
                await db.premium_subscriptions.update_one({"user_id": uid}, {"$set": {"active": False}})
        except Exception:
            pass
    return {
        "active": not expired,
        "subscription": sub,
        "benefits": PREMIUM_BENEFITS,
        "balance_eur": balance_eur,
        "balance_blz": balance_blz,
        **info,
    }


class PremiumPurchaseRequest(BaseModel):
    payment_method: str = Field(..., pattern="^(eur|blz)$")
    idempotency_key: Optional[str] = None


@router.post("/premium/purchase")
async def purchase_premium(req: PremiumPurchaseRequest, request: Request):
    user = await get_current_user(request)
    uid = str(user.get("_id") or user.get("id"))
    key = _require_revenue2_idempotency_key(req.idempotency_key, request, "premium")
    purchase_id = "PREM-" + hashlib.sha256(f"{uid}:{key}".encode("utf-8")).hexdigest()[:20].upper()
    info = _launch_info()
    price_eur = float(info["price_eur"])
    price_blz = int(info["price_blz"])

    payload = {
        "user_id": uid,
        "payment_method": req.payment_method,
        "price_eur": price_eur,
        "price_blz": price_blz,
    }
    attempt = await db.premium_purchase_attempts.find_one({"_id": purchase_id}, {"_id": 0})
    if attempt and attempt.get("payload") != payload:
        raise HTTPException(status_code=409, detail="Idempotency-Key wurde mit anderen Daten verwendet")
    if attempt and attempt.get("status") == "completed":
        return {
            "ok": True,
            "expires_at": attempt["expires_at"],
            "bonus_blz": PREMIUM_BENEFITS["monthly_blz_bonus"],
            "launch_discount": info["launch_active"],
            "replayed": True,
        }

    # One active purchase processor per user. Same idempotent retry may resume it.
    lock = await db.users.update_one(
        {
            "_id": _oid(uid),
            "$or": [
                {"premium_purchase_lock": {"$exists": False}},
                {"premium_purchase_lock": None},
                {"premium_purchase_lock": purchase_id},
            ],
        },
        {"$set": {"premium_purchase_lock": purchase_id}},
    )
    if lock.matched_count != 1:
        raise HTTPException(status_code=409, detail="Ein Premium-Kauf wird bereits verarbeitet")

    try:
        now = datetime.now(timezone.utc)
        if not attempt:
            existing = await db.premium_subscriptions.find_one({"user_id": uid, "active": True}, {"_id": 0})
            base = now
            current_expires = (existing or {}).get("expires_at")
            if current_expires:
                try:
                    exp_dt = datetime.fromisoformat(str(current_expires).replace("Z", "+00:00"))
                    if exp_dt.tzinfo is None:
                        exp_dt = exp_dt.replace(tzinfo=timezone.utc)
                    if exp_dt > now:
                        base = exp_dt
                except Exception:
                    pass
            expires_at = (base + timedelta(days=30)).isoformat()
            await db.premium_purchase_attempts.update_one(
                {"_id": purchase_id},
                {"$setOnInsert": {
                    "_id": purchase_id,
                    "payload": payload,
                    "expires_at": expires_at,
                    "status": "pending",
                    "created_at": now.isoformat(),
                }},
                upsert=True,
            )
            attempt = await db.premium_purchase_attempts.find_one({"_id": purchase_id}, {"_id": 0}) or {}
        expires_at = str(attempt.get("expires_at"))

        if req.payment_method == "eur":
            payment = await debit_wallet(
                user_id=uid,
                amount=price_eur,
                tx_type=TransactionType.SUBSCRIPTION,
                description="BidBlitz Premium (30 Tage)",
                reference=purchase_id,
                metadata={"purchase_id": purchase_id, "category": "premium"},
                idempotency_key=f"revenue2-premium:{purchase_id}:eur",
            )
            if not payment.success:
                status_code = 409 if payment.status.value in {"pending", "reconciliation_required"} else 400
                raise HTTPException(status_code=status_code, detail=payment.error or "Premium-Zahlung fehlgeschlagen")
            payment_transaction_id = payment.transaction_id
            payment_replayed = bool(payment.idempotent_replay)
        else:
            payment = await _mutate_blz_once(
                user_id=uid,
                amount=price_blz,
                direction="debit",
                idempotency_key=f"revenue2-premium:{purchase_id}:blz",
                description="BidBlitz Premium (30 Tage)",
                category="premium",
            )
            payment_transaction_id = payment["transaction_id"]
            payment_replayed = bool(payment["replayed"])

        bonus = await _mutate_blz_once(
            user_id=uid,
            amount=int(PREMIUM_BENEFITS["monthly_blz_bonus"]),
            direction="credit",
            idempotency_key=f"revenue2-premium:{purchase_id}:bonus",
            description="BidBlitz Premium Monatsbonus",
            category="premium_bonus",
        )

        await db.premium_subscriptions.update_one(
            {"user_id": uid},
            {"$set": {
                "active": True,
                "expires_at": expires_at,
                "last_renewed_at": now.isoformat(),
                "last_purchase_id": purchase_id,
                "payment_method": req.payment_method,
                "payment_transaction_id": payment_transaction_id,
                "auto_renew": True,
            },
             "$setOnInsert": {"started_at": now.isoformat()}},
            upsert=True,
        )
        await db.premium_purchase_attempts.update_one(
            {"_id": purchase_id},
            {"$set": {
                "status": "completed",
                "payment_transaction_id": payment_transaction_id,
                "bonus_transaction_id": bonus["transaction_id"],
                "completed_at": datetime.now(timezone.utc).isoformat(),
            }},
        )

        return {
            "ok": True,
            "expires_at": expires_at,
            "bonus_blz": PREMIUM_BENEFITS["monthly_blz_bonus"],
            "launch_discount": info["launch_active"],
            "payment_transaction_id": payment_transaction_id,
            "replayed": payment_replayed or bool(bonus["replayed"]),
        }
    finally:
        await db.users.update_one(
            {"_id": _oid(uid), "premium_purchase_lock": purchase_id},
            {"$unset": {"premium_purchase_lock": ""}},
        )


@router.post("/premium/cancel")
async def cancel_premium(request: Request):
    user = await get_current_user(request)
    uid = str(user.get("_id") or user.get("id"))
    result = await db.premium_subscriptions.update_one(
        {"user_id": uid, "active": True},
        {"$set": {"auto_renew": False, "canceled_at": datetime.now(timezone.utc).isoformat()}},
    )
    return {"ok": True, "canceled": result.matched_count > 0}


# ═══════════════════════════════════════════════════════════
# 4. MARKETPLACE FEE (2.9% + 0.30€)
# ═══════════════════════════════════════════════════════════
MARKETPLACE_FEE_PCT = 0.029
MARKETPLACE_FEE_FIXED = 0.30


def calc_marketplace_fee(amount: float) -> dict:
    fee = round(amount * MARKETPLACE_FEE_PCT + MARKETPLACE_FEE_FIXED, 2)
    return {"fee": fee, "net": round(amount - fee, 2), "pct": MARKETPLACE_FEE_PCT, "fixed": MARKETPLACE_FEE_FIXED}


@router.get("/marketplace/fee-info")
async def fee_info():
    return {
        "fee_pct": MARKETPLACE_FEE_PCT,
        "fee_fixed": MARKETPLACE_FEE_FIXED,
        "example_100": calc_marketplace_fee(100),
        "example_500": calc_marketplace_fee(500),
    }


class MarketplaceTransferRequest(BaseModel):
    recipient_email: str
    amount: float = Field(gt=0)
    note: Optional[str] = ""


@router.post("/marketplace/transfer")
async def marketplace_transfer(req: MarketplaceTransferRequest, request: Request):
    """Legacy marketplace transfer is permanently disabled; use canonical marketplace/P2P settlement."""
    await get_current_user(request)
    raise HTTPException(
        status_code=410,
        detail="Dieser Legacy-Marketplace-Transfer ist deaktiviert. Verwende den kanonischen Marketplace-/P2P-Zahlungsweg.",
    )


# ═══════════════════════════════════════════════════════════
# 5. LOTTERIE
# ═══════════════════════════════════════════════════════════
LOTTERY_TICKET_PRICE_BLZ = 10  # 10 BLZ pro Los

# Echte Sachpreise pro Tier (Bilder via Unsplash CDN, Wert in EUR)
LOTTERY_PRIZE_POOL = {
    "grand": {
        "blz": 5000,
        "count_per_draw": 1,
        "label_de": "Hauptpreis",
        "label_en": "Grand Prize",
        "items": [
            {
                "name": "iPhone 17 Pro 256GB",
                "value_eur": 1499,
                "image": "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=600&q=80",
                "description": "Brandneues iPhone 17 Pro in Titanium-Schwarz",
            },
            {
                "name": "MacBook Air M4",
                "value_eur": 1299,
                "image": "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=600&q=80",
                "description": "MacBook Air mit M4-Chip, 13 Zoll, 256GB",
            },
        ],
    },
    "big": {
        "blz": 500,
        "count_per_draw": 5,
        "label_de": "Großer Preis",
        "label_en": "Big Prize",
        "items": [
            {
                "name": "AirPods Pro 3",
                "value_eur": 279,
                "image": "https://images.unsplash.com/photo-1606220588913-b3aacb4d2f46?w=600&q=80",
                "description": "AirPods Pro mit Active Noise Cancelling",
            },
            {
                "name": "Apple Watch SE",
                "value_eur": 299,
                "image": "https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=600&q=80",
                "description": "Apple Watch SE 44mm GPS",
            },
            {
                "name": "Amazon Gutschein 250€",
                "value_eur": 250,
                "image": "https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=600&q=80",
                "description": "Amazon.de Gutschein im Wert von 250€",
            },
        ],
    },
    "small": {
        "blz": 50,
        "count_per_draw": 20,
        "label_de": "Kleiner Preis",
        "label_en": "Small Prize",
        "items": [
            {
                "name": "Restaurant-Gutschein 50€",
                "value_eur": 50,
                "image": "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=600&q=80",
                "description": "Gutschein für Partner-Restaurants",
            },
            {
                "name": "Lieferando Gutschein 50€",
                "value_eur": 50,
                "image": "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=600&q=80",
                "description": "Lieferando Bestellgutschein",
            },
            {
                "name": "Netflix 3 Monate",
                "value_eur": 45,
                "image": "https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=600&q=80",
                "description": "Netflix Premium 3 Monate",
            },
        ],
    },
    "mini": {
        "blz": 15,
        "count_per_draw": 100,
        "label_de": "Mini-Preis",
        "label_en": "Mini Prize",
        "items": [
            {
                "name": "Kaffee-Gutschein 15€",
                "value_eur": 15,
                "image": "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=600&q=80",
                "description": "Starbucks / lokaler Coffee-Shop",
            },
            {
                "name": "Spotify Premium 1 Monat",
                "value_eur": 11,
                "image": "https://images.unsplash.com/photo-1611339555312-e607c8352fd7?w=600&q=80",
                "description": "1 Monat Spotify Premium",
            },
            {
                "name": "BLZ Bonus-Token",
                "value_eur": 15,
                "image": "https://images.unsplash.com/photo-1621416894569-0f39ed31d247?w=600&q=80",
                "description": "Direkt aufgeladen ins BidBlitz Wallet",
            },
        ],
    },
}


async def _current_lottery_draw():
    """Get or create today's draw."""
    today = datetime.now(timezone.utc).date().isoformat()
    draw = await db.lottery_draws.find_one({"draw_date": today})
    if not draw:
        await db.lottery_draws.insert_one({
            "draw_date": today,
            "started_at": datetime.now(timezone.utc).isoformat(),
            "status": "open",
            "tickets": [],
            "winners": None,
            "drawn_at": None,
        })
        draw = await db.lottery_draws.find_one({"draw_date": today})
    draw.pop("_id", None)
    return draw


@router.get("/lottery/current")
async def lottery_current(request: Request):
    await get_current_user(request)  # require auth
    _require_revenue2_lottery_test_mode()
    draw = await _current_lottery_draw()
    # Don't send full ticket list to avoid huge payload
    ticket_count = len(draw.get("tickets", []))
    draw["ticket_count"] = ticket_count
    draw.pop("tickets", None)
    return {
        "draw": draw,
        "ticket_price_blz": LOTTERY_TICKET_PRICE_BLZ,
        "prize_pool": LOTTERY_PRIZE_POOL,
    }


class BuyTicketRequest(BaseModel):
    quantity: int = Field(ge=1, le=100)
    idempotency_key: Optional[str] = None


@router.post("/lottery/buy-tickets")
async def lottery_buy(req: BuyTicketRequest, request: Request):
    user = await get_current_user(request)
    _require_revenue2_lottery_test_mode()
    uid = str(user.get("_id") or user.get("id"))
    draw = await _current_lottery_draw()
    if draw.get("status") != "open":
        raise HTTPException(400, "Keine offene Ziehung")

    key = _require_revenue2_idempotency_key(req.idempotency_key, request, "lottery-buy")
    cost = LOTTERY_TICKET_PRICE_BLZ * req.quantity
    purchase_id = "LOTBUY-" + hashlib.sha256(
        f"{uid}:{draw['draw_date']}:{key}".encode("utf-8")
    ).hexdigest()[:20].upper()
    payload = {
        "user_id": uid,
        "draw_date": draw["draw_date"],
        "quantity": req.quantity,
        "cost": cost,
    }

    existing = await db.lottery_ticket_purchases.find_one({"_id": purchase_id}, {"_id": 0})
    if existing and existing.get("payload") != payload:
        raise HTTPException(status_code=409, detail="Idempotency-Key wurde mit anderen Ticketdaten verwendet")
    if existing and existing.get("status") == "completed":
        return {
            "ok": True,
            "tickets_bought": req.quantity,
            "tickets": existing.get("tickets", []),
            "cost": cost,
            "replayed": True,
        }

    await db.lottery_ticket_purchases.update_one(
        {"_id": purchase_id},
        {"$setOnInsert": {
            "_id": purchase_id,
            "payload": payload,
            "status": "pending",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }},
        upsert=True,
    )
    claimed = await db.lottery_ticket_purchases.update_one(
        {"_id": purchase_id, "status": "pending"},
        {"$set": {"status": "processing", "processing_at": datetime.now(timezone.utc).isoformat()}},
    )
    if claimed.modified_count != 1:
        current = await db.lottery_ticket_purchases.find_one({"_id": purchase_id}, {"_id": 0}) or {}
        if current.get("status") == "completed":
            return {
                "ok": True,
                "tickets_bought": req.quantity,
                "tickets": current.get("tickets", []),
                "cost": cost,
                "replayed": True,
            }
        raise HTTPException(status_code=409, detail="Ticketkauf wird bereits verarbeitet")

    ticket_numbers = [{
        "user_id": uid,
        "number": hashlib.sha256(f"{purchase_id}:{idx}".encode("utf-8")).hexdigest()[:8].upper(),
        "bought_at": datetime.now(timezone.utc).isoformat(),
        "purchase_id": purchase_id,
    } for idx in range(req.quantity)]

    debit = await _mutate_blz_once(
        user_id=uid,
        amount=cost,
        direction="debit",
        idempotency_key=f"lottery:{purchase_id}:debit",
        description=f"Lotterie: {req.quantity} Los(e)",
        category="lottery",
    )

    attached = await db.lottery_draws.update_one(
        {
            "draw_date": draw["draw_date"],
            "status": "open",
            "purchase_ids": {"$ne": purchase_id},
        },
        {
            "$push": {"tickets": {"$each": ticket_numbers}},
            "$addToSet": {"purchase_ids": purchase_id},
        },
    )
    if attached.modified_count != 1:
        attached_draw = await db.lottery_draws.find_one(
            {"draw_date": draw["draw_date"], "purchase_ids": purchase_id},
            {"_id": 1},
        )
        if not attached_draw:
            await _mutate_blz_once(
                user_id=uid,
                amount=cost,
                direction="credit",
                idempotency_key=f"lottery:{purchase_id}:refund",
                description="Lotterie-Ticketkauf zurückgebucht",
                category="lottery_refund",
            )
            await db.lottery_ticket_purchases.update_one(
                {"_id": purchase_id},
                {"$set": {
                    "status": "failed_refunded",
                    "failed_at": datetime.now(timezone.utc).isoformat(),
                    "reason": "draw_not_open_or_ticket_attach_failed",
                }},
            )
            raise HTTPException(status_code=409, detail="Ziehung nicht mehr offen. BLZ wurden zurückgebucht.")

    await db.lottery_ticket_purchases.update_one(
        {"_id": purchase_id, "status": "processing"},
        {"$set": {
            "status": "completed",
            "tickets": [t["number"] for t in ticket_numbers],
            "debit_transaction_id": debit["transaction_id"],
            "completed_at": datetime.now(timezone.utc).isoformat(),
        }},
    )
    return {
        "ok": True,
        "tickets_bought": req.quantity,
        "tickets": [t["number"] for t in ticket_numbers],
        "cost": cost,
        "replayed": bool(debit["replayed"]),
    }


@router.get("/lottery/my-tickets")
async def my_tickets(request: Request, draw_date: Optional[str] = None):
    user = await get_current_user(request)
    _require_revenue2_lottery_test_mode()
    uid = str(user.get("_id") or user.get("id"))
    query = {"draw_date": draw_date} if draw_date else {}
    cursor = db.lottery_draws.find(query, {"_id": 0}).sort("draw_date", -1).limit(30)
    results = []
    async for draw in cursor:
        my_in_draw = [t for t in draw.get("tickets", []) if t.get("user_id") == uid]
        if my_in_draw:
            my_wins = []
            for w in (draw.get("winners") or []):
                if w.get("user_id") == uid:
                    my_wins.append(w)
            results.append({
                "draw_date": draw["draw_date"],
                "status": draw.get("status"),
                "my_tickets": len(my_in_draw),
                "winners": my_wins,
                "drawn_at": draw.get("drawn_at"),
            })
    return {"draws": results}


@router.post("/lottery/draw")
async def lottery_draw_now(request: Request):
    """Admin: Force-ziehung für heute (normalerweise via Cron)."""
    admin = await get_current_user(request)
    _require_revenue2_lottery_test_mode()
    if admin.get("role") not in ("admin", "super_admin"):
        raise HTTPException(403, "Admin only")

    draw = await _current_lottery_draw()
    if draw.get("status") != "open":
        raise HTTPException(400, "Ziehung bereits durchgeführt")

    tickets = draw.get("tickets", [])
    if not tickets:
        raise HTTPException(400, "Keine Tickets — keine Ziehung")

    draw_lock = await db.lottery_draws.update_one(
        {"draw_date": draw["draw_date"], "status": "open"},
        {"$set": {"status": "drawing", "draw_started_at": datetime.now(timezone.utc).isoformat()}},
    )
    if draw_lock.modified_count != 1:
        raise HTTPException(status_code=409, detail="Ziehung wird bereits verarbeitet")

    # Shuffle and draw
    random.shuffle(tickets)
    winners = []
    i = 0
    for tier_name, tier_cfg in LOTTERY_PRIZE_POOL.items():
        for _ in range(tier_cfg["count_per_draw"]):
            if i >= len(tickets):
                break
            t = tickets[i]
            winners.append({
                "user_id": t["user_id"],
                "ticket_number": t["number"],
                "tier": tier_name,
                "prize_blz": tier_cfg["blz"],
            })
            payout = await _mutate_blz_once(
                user_id=t["user_id"],
                amount=int(tier_cfg["blz"]),
                direction="credit",
                idempotency_key=f"lottery-win:{draw['draw_date']}:{t['number']}:{tier_name}",
                description=f"Lotterie-Gewinn ({tier_name}): {tier_cfg['blz']} BLZ",
                category="lottery_win",
            )
            winners[-1]["payout_transaction_id"] = payout["transaction_id"]
            i += 1

    await db.lottery_draws.update_one(
        {"draw_date": draw["draw_date"], "status": "drawing"},
        {"$set": {
            "status": "closed",
            "winners": winners,
            "drawn_at": datetime.now(timezone.utc).isoformat(),
        }},
    )
    return {"ok": True, "winners_count": len(winners), "tickets_sold": len(tickets)}
