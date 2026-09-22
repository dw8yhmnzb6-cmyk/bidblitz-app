"""
BidBlitz V2 - Penny Auction System
Users buy bid credits, each bid costs 1 credit, increases price by €0.01, extends timer.
"""

import secrets
import asyncio
import random
import hashlib
import math
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel, Field
from typing import Optional
from bson import ObjectId
from core.database import db
from core.config import TEST_MODE
from core.security import get_current_user
from core.audit import log_audit, AuditEvent, get_client_info

router = APIRouter(prefix="/api/auctions", tags=["auctions"])

PRICE_INCREMENT = 0.01
TIMER_EXTENSION_SECONDS = 20   # Bid resets live countdown to 20s max
FINAL_BATTLE_THRESHOLD = 60    # Final battle activates in last 60 seconds
PROFIT_GUARD_EXTENSION_SECONDS = 600  # transparent reserve extension while real paid target is not met
DEFAULT_DURATION_SECONDS = 172800  # Fallback 48 hours
MAX_AUCTION_REMAINING_SECONDS = 72 * 3600

PUBLIC_AUCTION_PRIVATE_FIELDS = {
    "revenue_target_eur",
    "product_cost_eur",
    "shipping_cost_eur",
    "other_costs_eur",
    "target_net_profit_eur",
    "real_paid_bids",
    "real_bid_revenue_eur",
    "estimated_real_bids_remaining",
    "profit_guard_extensions",
    "profit_guard_last_extended_at",
    "profit_guard",
}

def _public_auction_view(auction: dict) -> dict:
    public = dict(auction or {})
    minimum_active = bool(
        float(public.get("target_net_profit_eur") or 0) > 0
        and not public.get("bot_only")
    )
    public["minimum_target_active"] = minimum_active
    public["minimum_target_reached"] = (
        bool(public.get("minimum_target_reached")) if minimum_active else True
    )
    public["minimum_target_status"] = (
        "reached"
        if public["minimum_target_reached"]
        else "not_reached"
    ) if minimum_active else "not_enabled"
    for field in PUBLIC_AUCTION_PRIVATE_FIELDS:
        public.pop(field, None)
    public.pop("profit_guard_status", None)
    return public

CREDIT_PACKAGES = {
    "10": {"credits": 10, "price": 5.00},      # 0.50/bid (base)
    "25": {"credits": 25, "price": 10.00},      # 0.40/bid (20% off)
    "50": {"credits": 50, "price": 17.50},      # 0.35/bid (30% off)
    "100": {"credits": 100, "price": 29.00},    # 0.29/bid (42% off)
    "250": {"credits": 250, "price": 62.50},    # 0.25/bid (50% off)
}

def _credit_bucket_cents(cash_value_eur: float, credits: int) -> int:
    if credits <= 0:
        return 0
    return max(0, int(round((max(0.0, float(cash_value_eur)) / credits) * 100)))


def _credit_bucket_field(cents: int) -> str:
    return f"bid_credit_value_buckets.c{max(0, int(cents))}"


def _known_credit_bucket_cents() -> list[int]:
    paid = {
        _credit_bucket_cents(float(pkg["price"]), int(pkg["credits"]))
        for pkg in CREDIT_PACKAGES.values()
    }
    return [0] + sorted(x for x in paid if x > 0)


def _minimum_paid_credit_value_eur() -> float:
    paid = [c for c in _known_credit_bucket_cents() if c > 0]
    return (min(paid) / 100.0) if paid else 0.0

def _require_auction_idempotency_key(body_key: Optional[str], request: Request, *, prefix: str) -> str:
    key = (body_key or request.headers.get("Idempotency-Key") or "").strip()
    if not 8 <= len(key) <= 200:
        raise HTTPException(status_code=400, detail="Idempotency-Key erforderlich")
    return f"{prefix}:{key}"


def _auction_grant_field(kind: str, key: str) -> str:
    digest = hashlib.sha256(f"{kind}:{key}".encode("utf-8")).hexdigest()[:32]
    return f"auction_credit_grants.{digest}"


async def _grant_bid_credits_once(
    user_object_id,
    *,
    credits: int,
    grant_key: str,
    source: str,
    metadata: Optional[dict] = None,
    cash_value_eur: float = 0.0,
) -> tuple[bool, bool]:
    field = _auction_grant_field(source, grant_key)
    bucket_cents = _credit_bucket_cents(cash_value_eur, int(credits))
    bucket_field = _credit_bucket_field(bucket_cents)
    marker = {
        "credits": int(credits),
        "source": source,
        "cash_value_eur": round(max(0.0, float(cash_value_eur)), 2),
        "per_credit_cash_value_eur": round(bucket_cents / 100.0, 2),
        "credit_value_bucket_cents": bucket_cents,
        "grant_key_hash": hashlib.sha256(grant_key.encode("utf-8")).hexdigest()[:16],
        "metadata": metadata or {},
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    result = await db.users.update_one(
        {"_id": user_object_id, field: {"$exists": False}},
        {
            "$inc": {
                "bid_credits": int(credits),
                bucket_field: int(credits),
            },
            "$set": {field: marker},
        },
    )
    if result.modified_count == 1:
        return True, True
    existing = await db.users.find_one({"_id": user_object_id, field: {"$exists": True}}, {"_id": 1})
    return False, bool(existing)


async def _grant_first_purchase_bonus_once(user_object_id, *, eligible: bool) -> int:
    if not eligible:
        return 0
    result = await db.users.update_one(
        {"_id": user_object_id, "auction_first_purchase_bonus_awarded": {"$ne": True}},
        {
            "$inc": {"bid_credits": 5, "bid_credit_value_buckets.c0": 5},
            "$set": {
                "auction_first_purchase_bonus_awarded": True,
                "auction_first_purchase_bonus_awarded_at": datetime.now(timezone.utc).isoformat(),
            },
        },
    )
    return 5 if result.modified_count == 1 else 0


async def _has_previous_credit_purchase(user_id: str) -> bool:
    previous = await db.transactions.find_one({
        "user_id": user_id,
        "$or": [
            {"category": "auction", "type": "purchase"},
            {"type": "auction_bid", "metadata.purchase_kind": "bid_credits"},
        ],
    }, {"_id": 1})
    return bool(previous)

def _bid_operation_hash(user_id: str, auction_id: str, idempotency_key: str) -> str:
    return hashlib.sha256(f"{user_id}:{auction_id}:{idempotency_key}".encode("utf-8")).hexdigest()[:20]


async def _reserve_bid_credit_once(user_object_id, op_hash: str, auction_id: str) -> str:
    reservation_field = f"auction_bid_reservations.{op_hash}"
    spent_field = f"auction_bid_spent.{op_hash}"

    if await db.users.find_one({"_id": user_object_id, spent_field: {"$exists": True}}, {"_id": 1}):
        return "spent"
    if await db.users.find_one({"_id": user_object_id, reservation_field: {"$exists": True}}, {"_id": 1}):
        return "reserved"

    # Consume free credits first, then the lowest-paid credit bucket. This is
    # intentionally conservative for minimum-profit accounting.
    for bucket_cents in _known_credit_bucket_cents():
        bucket_field = _credit_bucket_field(bucket_cents)
        result = await db.users.update_one(
            {
                "_id": user_object_id,
                "bid_credits": {"$gte": 1},
                bucket_field: {"$gte": 1},
                reservation_field: {"$exists": False},
                spent_field: {"$exists": False},
            },
            {
                "$inc": {
                    "bid_credits": -1,
                    bucket_field: -1,
                },
                "$set": {
                    reservation_field: {
                        "auction_id": auction_id,
                        "cash_value_eur": round(bucket_cents / 100.0, 2),
                        "credit_value_bucket_cents": bucket_cents,
                        "reserved_at": datetime.now(timezone.utc).isoformat(),
                    }
                },
            },
        )
        if result.modified_count == 1:
            return "reserved"

    # Legacy/untracked credits are still usable, but count as €0 revenue.
    result = await db.users.update_one(
        {
            "_id": user_object_id,
            "bid_credits": {"$gte": 1},
            reservation_field: {"$exists": False},
            spent_field: {"$exists": False},
        },
        {
            "$inc": {"bid_credits": -1},
            "$set": {
                reservation_field: {
                    "auction_id": auction_id,
                    "cash_value_eur": 0.0,
                    "credit_value_bucket_cents": None,
                    "legacy_untracked": True,
                    "reserved_at": datetime.now(timezone.utc).isoformat(),
                }
            },
        },
    )
    if result.modified_count == 1:
        return "reserved"

    if await db.users.find_one({"_id": user_object_id, spent_field: {"$exists": True}}, {"_id": 1}):
        return "spent"
    if await db.users.find_one({"_id": user_object_id, reservation_field: {"$exists": True}}, {"_id": 1}):
        return "reserved"
    return "insufficient"


async def _credit_cash_value_for_operation(user_object_id, op_hash: str) -> float:
    user = await db.users.find_one(
        {"_id": user_object_id},
        {
            f"auction_bid_reservations.{op_hash}": 1,
            f"auction_bid_spent.{op_hash}": 1,
            "_id": 0,
        },
    ) or {}
    reservation = (user.get("auction_bid_reservations") or {}).get(op_hash) or {}
    spent = (user.get("auction_bid_spent") or {}).get(op_hash) or {}
    marker = reservation or spent
    return round(max(0.0, float(marker.get("cash_value_eur") or 0.0)), 2)


async def _mark_bid_credit_spent(user_object_id, op_hash: str, auction_id: str, bid_price: float) -> bool:
    reservation_field = f"auction_bid_reservations.{op_hash}"
    spent_field = f"auction_bid_spent.{op_hash}"
    user = await db.users.find_one(
        {"_id": user_object_id, reservation_field: {"$exists": True}},
        {reservation_field: 1, "_id": 0},
    ) or {}
    reservation = (user.get("auction_bid_reservations") or {}).get(op_hash) or {}
    result = await db.users.update_one(
        {"_id": user_object_id, reservation_field: {"$exists": True}},
        {
            "$unset": {reservation_field: ""},
            "$set": {
                spent_field: {
                    "auction_id": auction_id,
                    "bid_price": bid_price,
                    "cash_value_eur": round(max(0.0, float(reservation.get("cash_value_eur") or 0.0)), 2),
                    "credit_value_bucket_cents": reservation.get("credit_value_bucket_cents"),
                    "spent_at": datetime.now(timezone.utc).isoformat(),
                }
            },
        },
    )
    if result.modified_count == 1:
        return True
    return bool(await db.users.find_one({"_id": user_object_id, spent_field: {"$exists": True}}, {"_id": 1}))


async def _refund_reserved_bid_credit(user_object_id, op_hash: str, auction_id: str, reason: str) -> bool:
    reservation_field = f"auction_bid_reservations.{op_hash}"
    refund_field = f"auction_bid_refunds.{op_hash}"
    user = await db.users.find_one(
        {"_id": user_object_id, reservation_field: {"$exists": True}},
        {reservation_field: 1, "_id": 0},
    ) or {}
    reservation = (user.get("auction_bid_reservations") or {}).get(op_hash) or {}
    inc = {"bid_credits": 1}
    bucket_cents = reservation.get("credit_value_bucket_cents")
    if bucket_cents is not None:
        inc[_credit_bucket_field(int(bucket_cents))] = 1
    result = await db.users.update_one(
        {
            "_id": user_object_id,
            reservation_field: {"$exists": True},
            refund_field: {"$exists": False},
        },
        {
            "$inc": inc,
            "$unset": {reservation_field: ""},
            "$set": {
                refund_field: {
                    "auction_id": auction_id,
                    "reason": reason,
                    "cash_value_eur": round(max(0.0, float(reservation.get("cash_value_eur") or 0.0)), 2),
                    "credit_value_bucket_cents": bucket_cents,
                    "refunded_at": datetime.now(timezone.utc).isoformat(),
                }
            },
        },
    )
    if result.modified_count == 1:
        return True
    return bool(await db.users.find_one({"_id": user_object_id, refund_field: {"$exists": True}}, {"_id": 1}))


def _read_bid_operation_result(auction: dict, op_hash: str) -> Optional[dict]:
    return (auction.get("bid_operation_results") or {}).get(op_hash)


def _profit_guard_snapshot(auction: dict, real_paid_bids: int) -> dict:
    """Calculate minimum-profit status from actually paid credit value, never nominal list value."""
    increment = max(0.01, float(auction.get("price_increment") or PRICE_INCREMENT))
    current_price = max(0.0, float(auction.get("current_price") or 0.0))
    product_cost = max(0.0, float(auction.get("product_cost_eur") or 0.0))
    shipping_cost = max(0.0, float(auction.get("shipping_cost_eur") or 0.0))
    other_costs = max(0.0, float(auction.get("other_costs_eur") or 0.0))
    target_net_profit = max(0.0, float(auction.get("target_net_profit_eur") or 0.0))
    costs = product_cost + shipping_cost + other_costs
    real_bid_revenue = max(0.0, float(auction.get("real_bid_revenue_eur") or 0.0))
    gross_revenue = real_bid_revenue + current_price
    net_profit = gross_revenue - costs
    enabled = bool(target_net_profit > 0 and not auction.get("bot_only"))
    reached = (not enabled) or net_profit >= target_net_profit
    missing_net = max(0.0, target_net_profit - net_profit) if enabled else 0.0
    minimum_paid_credit_value = _minimum_paid_credit_value_eur()
    contribution_per_next_bid = minimum_paid_credit_value + increment
    bids_remaining = (
        int(math.ceil(missing_net / contribution_per_next_bid))
        if enabled and missing_net > 0
        else 0
    )
    return {
        "enabled": enabled,
        "reached": reached,
        "real_paid_bids": max(0, int(real_paid_bids)),
        "real_bid_revenue_eur": round(real_bid_revenue, 2),
        "minimum_paid_credit_value_eur": round(minimum_paid_credit_value, 2),
        "current_sale_price_eur": round(current_price, 2),
        "gross_revenue_eur": round(gross_revenue, 2),
        "costs_eur": round(costs, 2),
        "net_profit_eur": round(net_profit, 2),
        "target_net_profit_eur": round(target_net_profit, 2),
        "missing_net_profit_eur": round(missing_net, 2),
        "estimated_real_bids_remaining": bids_remaining,
    }


async def _finalize_auction_once(auction_id: str, *, now: Optional[datetime] = None) -> tuple[Optional[dict], bool]:
    """Atomically end an expired auction and publish the winner event once."""
    now_dt = now or datetime.now(timezone.utc)
    now_iso = now_dt.isoformat()
    auction = await db.auctions.find_one({"auction_id": auction_id})
    if not auction:
        return None, False

    if auction.get("status") == "active":
        ends_at = str(auction.get("ends_at") or "")
        if not ends_at or ends_at > now_iso:
            return auction, False

        stored_real_bids = auction.get("real_paid_bids")
        if stored_real_bids is None:
            stored_real_bids = await db.auction_bids.count_documents({
                "auction_id": auction_id,
                "is_bot": {"$ne": True},
            })
        guard = _profit_guard_snapshot(auction, int(stored_real_bids or 0))
        if guard["enabled"] and not guard["reached"]:
            extended_until = now_dt + timedelta(seconds=PROFIT_GUARD_EXTENSION_SECONDS)
            hold = await db.auctions.update_one(
                {
                    "auction_id": auction_id,
                    "status": "active",
                    "ends_at": auction.get("ends_at"),
                },
                {
                    "$set": {
                        "ends_at": extended_until.isoformat(),
                        "minimum_target_reached": False,
                        "profit_guard_status": "target_not_met",
                        "profit_guard_last_extended_at": now_iso,
                        "real_paid_bids": guard["real_paid_bids"],
                        "estimated_real_bids_remaining": guard["estimated_real_bids_remaining"],
                    },
                    "$inc": {"profit_guard_extensions": 1},
                },
            )
            fresh = await db.auctions.find_one({"auction_id": auction_id}) or auction
            if hold.modified_count == 1:
                return fresh, False
            return fresh, False

        raw_winner_id = auction.get("last_bidder_id")
        raw_winner_name = auction.get("last_bidder_name")
        bot_last_bidder = str(raw_winner_id or "").startswith("bot_")
        winner_id = None if bot_last_bidder else raw_winner_id
        winner_name = None if bot_last_bidder else raw_winner_name
        needs_review = bool(bot_last_bidder and not auction.get("bot_only"))
        claim = await db.auctions.update_one(
            {
                "auction_id": auction_id,
                "status": "active",
                "ends_at": auction.get("ends_at"),
                "last_bidder_id": auction.get("last_bidder_id"),
            },
            {"$set": {
                "status": "ended",
                "winner_id": winner_id,
                "winner_name": winner_name,
                "ended_at": now_iso,
                "requires_manual_review": needs_review,
                "end_reason": (
                    "bot_last_bidder_requires_review"
                    if needs_review
                    else ("bot_only_demo_complete" if bot_last_bidder else "timer_expired")
                ),
                "minimum_target_reached": True,
                "profit_guard_status": "target_reached" if guard["enabled"] else "not_enabled",
                "real_paid_bids": guard["real_paid_bids"],
                "estimated_real_bids_remaining": 0,
            }},
        )
        auction = await db.auctions.find_one({"auction_id": auction_id}) or auction
        if claim.modified_count != 1 and auction.get("status") != "ended":
            return auction, False

    if auction.get("status") != "ended":
        return auction, False

    winner_id = auction.get("winner_id")
    if not winner_id:
        return auction, False

    notification_id = f"auction-win:{auction_id}:{winner_id}"
    notification_write = await db.auction_notifications.update_one(
        {"_id": notification_id},
        {"$setOnInsert": {
            "_id": notification_id,
            "user_id": winner_id,
            "type": "won",
            "auction_id": auction_id,
            "message": f"You won {auction.get('title', 'Auction')} for just €{float(auction.get('current_price') or 0):.2f}!",
            "read": False,
            "created_at": auction.get("ended_at") or now_iso,
        }},
        upsert=True,
    )
    published_now = notification_write.upserted_id is not None

    if published_now:
        try:
            from routes.web_push import send_push_to_user
            asyncio.create_task(send_push_to_user(
                user_id=winner_id,
                title="🎉 Du hast gewonnen!",
                body=f"{auction.get('title', 'Auktion')} für €{float(auction.get('current_price') or 0):.2f}",
                data={"url": f"/auction/{auction_id}", "type": "auction_won", "auction_id": auction_id},
            ))
        except Exception:
            pass
        try:
            from routes.email_service import notify_win
            winner_user = await db.users.find_one({"_id": ObjectId(winner_id)})
            if winner_user and winner_user.get("email"):
                asyncio.create_task(notify_win(
                    winner_user["email"],
                    winner_user.get("name", "User"),
                    auction.get("title", "Auction"),
                    float(auction.get("current_price") or 0),
                ))
        except Exception:
            pass

    return auction, published_now


class AuctionWinnerCheckoutRequest(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=120)
    address_line1: str = Field(..., min_length=3, max_length=200)
    address_line2: Optional[str] = Field(default=None, max_length=200)
    city: str = Field(..., min_length=2, max_length=120)
    postal_code: str = Field(..., min_length=2, max_length=30)
    country: str = Field(..., min_length=2, max_length=80)
    phone: Optional[str] = Field(default=None, max_length=40)
    idempotency_key: Optional[str] = None


async def _auction_platform_user_id() -> str:
    import os
    email = os.environ.get("PLATFORM_POOL_EMAIL", "admin@bidblitz.ae").strip().lower()
    platform = await db.users.find_one({"email": email}, {"_id": 1})
    if not platform:
        raise HTTPException(
            status_code=503,
            detail="BidBlitz Plattform-Wallet ist für Gewinnerzahlungen nicht konfiguriert.",
        )
    return str(platform["_id"])


def _winner_order_id(auction_id: str, winner_id: str) -> str:
    digest = hashlib.sha256(f"{auction_id}:{winner_id}".encode("utf-8")).hexdigest()[:20]
    return f"AORD-{digest.upper()}"


def _winner_checkout_payload(auction: dict, order: Optional[dict]) -> dict:
    final_price = round(float(auction.get("current_price") or 0), 2)
    return {
        "auction_id": auction.get("auction_id"),
        "title": auction.get("title"),
        "image_url": auction.get("image_url"),
        "winner_id": auction.get("winner_id"),
        "final_price": final_price,
        "shipping_fee": 0.0,
        "total_due": final_price,
        "free_shipping": True,
        "order_id": (order or {}).get("order_id") or (order or {}).get("_id"),
        "order_status": (order or {}).get("status") or "not_started",
        "payment_status": (order or {}).get("payment_status") or "unpaid",
        "shipping_address": (order or {}).get("shipping_address"),
        "fulfillment_status": (order or {}).get("fulfillment_status") or "not_started",
        "carrier": (order or {}).get("carrier"),
        "tracking_number": (order or {}).get("tracking_number"),
        "shipped_at": (order or {}).get("shipped_at"),
        "delivered_at": (order or {}).get("delivered_at"),
    }


async def _reconcile_winner_checkout_side_effects(auction: dict, order: dict) -> None:
    """Repair derived winner/order state after a paid order is replayed."""
    if not auction or not order or order.get("payment_status") != "paid":
        return

    order_id = str(order.get("order_id") or order.get("_id") or "")
    auction_id = str(order.get("auction_id") or auction.get("auction_id") or "")
    winner_id = str(order.get("winner_id") or auction.get("winner_id") or "")
    if not order_id or not auction_id or not winner_id:
        return

    paid_at = str(order.get("paid_at") or order.get("updated_at") or datetime.now(timezone.utc).isoformat())
    await db.auctions.update_one(
        {"auction_id": auction_id, "status": "ended", "winner_id": winner_id},
        {"$set": {
            "winner_order_id": order_id,
            "winner_payment_status": "paid",
            "winner_checkout_completed_at": paid_at,
        }},
    )
    await db.auction_notifications.update_one(
        {"_id": f"auction-order-paid:{order_id}"},
        {"$setOnInsert": {
            "_id": f"auction-order-paid:{order_id}",
            "user_id": winner_id,
            "type": "winner_order_paid",
            "auction_id": auction_id,
            "order_id": order_id,
            "message": f"Bestellung bestätigt: {auction.get('title', 'Auktionsgewinn')}. Versand ist kostenlos.",
            "read": False,
            "created_at": paid_at,
        }},
        upsert=True,
    )


@router.get("/{auction_id}/winner-checkout")
async def get_winner_checkout(auction_id: str, request: Request):
    user = await get_current_user(request)
    user_id = str(user["_id"])
    auction, _ = await _finalize_auction_once(auction_id)
    if not auction:
        raise HTTPException(status_code=404, detail="Auktion nicht gefunden")
    if auction.get("status") != "ended":
        raise HTTPException(status_code=409, detail="Auktion ist noch nicht beendet")
    if auction.get("requires_manual_review"):
        raise HTTPException(status_code=409, detail="Auktion benötigt vor dem Checkout eine manuelle Prüfung")
    if str(auction.get("winner_id") or "") != user_id:
        raise HTTPException(status_code=403, detail="Nur der Gewinner kann diesen Checkout öffnen")

    order_id = _winner_order_id(auction_id, user_id)
    order = await db.auction_orders.find_one({"_id": order_id}, {"_id": 0})
    return _winner_checkout_payload(auction, order)


@router.post("/{auction_id}/winner-checkout/pay")
async def pay_winner_checkout(auction_id: str, req: AuctionWinnerCheckoutRequest, request: Request):
    from core.payment_engine import transfer_between_wallets, TransactionType

    user = await get_current_user(request)
    user_id = str(user["_id"])
    auction, _ = await _finalize_auction_once(auction_id)
    if not auction:
        raise HTTPException(status_code=404, detail="Auktion nicht gefunden")
    if auction.get("status") != "ended":
        raise HTTPException(status_code=409, detail="Auktion ist noch nicht beendet")
    if auction.get("requires_manual_review"):
        raise HTTPException(status_code=409, detail="Auktion benötigt vor der Zahlung eine manuelle Prüfung")
    if str(auction.get("winner_id") or "") != user_id:
        raise HTTPException(status_code=403, detail="Nur der Gewinner kann den Endpreis bezahlen")

    final_price = round(float(auction.get("current_price") or 0), 2)
    if final_price <= 0:
        raise HTTPException(status_code=409, detail="Ungültiger Auktions-Endpreis")

    client_key = _require_auction_idempotency_key(
        req.idempotency_key,
        request,
        prefix="auction-winner-checkout",
    )
    order_id = _winner_order_id(auction_id, user_id)
    shipping_address = {
        "full_name": req.full_name.strip(),
        "address_line1": req.address_line1.strip(),
        "address_line2": (req.address_line2 or "").strip() or None,
        "city": req.city.strip(),
        "postal_code": req.postal_code.strip(),
        "country": req.country.strip(),
        "phone": (req.phone or "").strip() or None,
    }
    request_payload = {
        "auction_id": auction_id,
        "winner_id": user_id,
        "final_price": final_price,
        "shipping_address": shipping_address,
    }

    existing = await db.auction_orders.find_one({"_id": order_id}, {"_id": 0})
    if existing and existing.get("request_payload") != request_payload:
        if existing.get("payment_status") == "paid":
            raise HTTPException(status_code=409, detail="Bestellung wurde bereits mit einer anderen Versandadresse bezahlt")
        raise HTTPException(status_code=409, detail="Gewinner-Checkout wurde bereits mit anderen Daten begonnen")
    if existing and existing.get("payment_status") == "paid":
        await _reconcile_winner_checkout_side_effects(auction, existing)
        snapshot = _winner_checkout_payload(auction, existing)
        return {**snapshot, "success": True, "replayed": True}

    now = datetime.now(timezone.utc).isoformat()
    await db.auction_orders.update_one(
        {"_id": order_id},
        {"$setOnInsert": {
            "_id": order_id,
            "order_id": order_id,
            "auction_id": auction_id,
            "winner_id": user_id,
            "winner_email": user.get("email"),
            "product_title": auction.get("title"),
            "image_url": auction.get("image_url"),
            "final_price": final_price,
            "shipping_fee": 0.0,
            "total_due": final_price,
            "currency": "EUR",
            "free_shipping": True,
            "shipping_address": shipping_address,
            "request_payload": request_payload,
            "status": "pending_payment",
            "payment_status": "unpaid",
            "fulfillment_status": "not_started",
            "created_at": now,
        }},
        upsert=True,
    )

    requested_attempt_hash = hashlib.sha256(client_key.encode("utf-8")).hexdigest()[:20]
    current_order = await db.auction_orders.find_one({"_id": order_id}, {"_id": 0}) or {}
    recoverable_status = current_order.get("status") in {"processing_payment", "reconciliation_required"}
    payment_attempt_hash = (
        str(current_order.get("payment_attempt_key_hash") or requested_attempt_hash)
        if recoverable_status
        else requested_attempt_hash
    )
    claimed = await db.auction_orders.update_one(
        {
            "_id": order_id,
            "payment_status": {"$ne": "paid"},
            "$or": [
                {"status": {"$in": ["pending_payment", "payment_failed"]}},
                {
                    "status": {"$in": ["processing_payment", "reconciliation_required"]},
                    "payment_attempt_key_hash": payment_attempt_hash,
                },
            ],
        },
        {"$set": {
            "status": "processing_payment",
            "payment_attempt_key_hash": payment_attempt_hash,
            "payment_started_at": now,
            "payment_recovered": bool(recoverable_status),
        }},
    )
    if claimed.modified_count != 1:
        current = await db.auction_orders.find_one({"_id": order_id}, {"_id": 0}) or {}
        if current.get("payment_status") == "paid":
            await _reconcile_winner_checkout_side_effects(auction, current)
            return {**_winner_checkout_payload(auction, current), "success": True, "replayed": True}
        raise HTTPException(status_code=409, detail="Gewinner-Zahlung wird bereits verarbeitet")

    platform_user_id = await _auction_platform_user_id()
    payment = await transfer_between_wallets(
        from_user_id=user_id,
        to_user_id=platform_user_id,
        amount=final_price,
        tx_type=TransactionType.AUCTION_WIN,
        description=f"Auktionsgewinn: {auction.get('title', auction_id)}",
        reference=order_id,
        metadata={
            "auction_id": auction_id,
            "order_id": order_id,
            "shipping_fee": 0.0,
            "free_shipping": True,
        },
        idempotency_key=f"auction-winner-order:{order_id}:payment:{payment_attempt_hash}",
    )
    if not payment.success:
        payment_state = str(getattr(payment.status, "value", payment.status))
        order_status = (
            "reconciliation_required"
            if payment_state in {"pending", "reconciliation_required"}
            else "payment_failed"
        )
        await db.auction_orders.update_one(
            {"_id": order_id, "status": "processing_payment"},
            {"$set": {
                "status": order_status,
                "payment_status": payment_state or "failed",
                "payment_error": (payment.error or "payment_failed")[:300],
                "payment_attempt_key_hash": payment_attempt_hash,
                "payment_updated_at": datetime.now(timezone.utc).isoformat(),
            }},
        )
        raise HTTPException(
            status_code=503 if order_status == "reconciliation_required" else 400,
            detail=payment.error or "Gewinner-Zahlung fehlgeschlagen",
        )

    paid_at = datetime.now(timezone.utc).isoformat()
    finalized = await db.auction_orders.update_one(
        {"_id": order_id, "status": "processing_payment", "payment_status": {"$ne": "paid"}},
        {"$set": {
            "status": "paid_pending_fulfillment",
            "payment_status": "paid",
            "fulfillment_status": "pending",
            "payment_transaction_id": payment.transaction_id,
            "paid_at": paid_at,
            "updated_at": paid_at,
        }},
    )
    if finalized.modified_count != 1:
        current = await db.auction_orders.find_one({"_id": order_id}, {"_id": 0}) or {}
        if current.get("payment_status") != "paid":
            await db.auction_orders.update_one(
                {"_id": order_id},
                {"$set": {"status": "reconciliation_required", "payment_transaction_id": payment.transaction_id}},
            )
            raise HTTPException(status_code=500, detail="Zahlung erfolgt; Bestellabschluss benötigt Abstimmung")

    order = await db.auction_orders.find_one({"_id": order_id}, {"_id": 0}) or {}
    await _reconcile_winner_checkout_side_effects(auction, order)
    return {**_winner_checkout_payload(auction, order), "success": True, "replayed": bool(payment.idempotent_replay)}


class AuctionOrderFulfillmentRequest(BaseModel):
    status: str = Field(..., pattern="^(processing|shipped|delivered)$")
    carrier: Optional[str] = Field(default=None, max_length=120)
    tracking_number: Optional[str] = Field(default=None, max_length=180)
    note: Optional[str] = Field(default=None, max_length=500)


@router.get("/admin/orders")
async def admin_auction_orders(request: Request, status: Optional[str] = None):
    user = await get_current_user(request)
    if user.get("role") not in {"admin", "super_admin"}:
        raise HTTPException(status_code=403, detail="Admin only")
    query = {"payment_status": "paid"}
    if status:
        if status not in {"pending", "processing", "shipped", "delivered"}:
            raise HTTPException(status_code=400, detail="Ungültiger Fulfillment-Status")
        query["fulfillment_status"] = status
    orders = await db.auction_orders.find(query, {"_id": 0}).sort("paid_at", -1).limit(200).to_list(200)
    return {"orders": orders, "count": len(orders)}


@router.post("/admin/orders/{order_id}/fulfillment")
async def update_auction_order_fulfillment(order_id: str, req: AuctionOrderFulfillmentRequest, request: Request):
    admin = await get_current_user(request)
    if admin.get("role") not in {"admin", "super_admin"}:
        raise HTTPException(status_code=403, detail="Admin only")

    order = await db.auction_orders.find_one({"_id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Bestellung nicht gefunden")
    if order.get("payment_status") != "paid":
        raise HTTPException(status_code=409, detail="Nur bezahlte Bestellungen können versendet werden")

    current = order.get("fulfillment_status") or "pending"
    carrier = (req.carrier or "").strip() or None
    tracking_number = (req.tracking_number or "").strip() or None
    if req.status == "shipped":
        if not carrier or len(carrier) < 2:
            raise HTTPException(status_code=400, detail="Echter Versanddienstleister erforderlich")
        if not tracking_number or len(tracking_number) < 4:
            raise HTTPException(status_code=400, detail="Echte Tracking-/Sendungsnummer erforderlich")
    if req.status == "delivered" and current != "shipped":
        raise HTTPException(status_code=409, detail="Bestellung muss vor 'delivered' zuerst 'shipped' sein")

    allowed_from = {
        "processing": {"pending", "not_started"},
        "shipped": {"processing"},
        "delivered": {"shipped"},
    }
    if current == req.status:
        same_tracking = (
            req.status != "shipped"
            or (order.get("carrier") == carrier and order.get("tracking_number") == tracking_number)
        )
        if same_tracking:
            return {"ok": True, "order": order, "replayed": True}
        raise HTTPException(status_code=409, detail="Status existiert bereits mit anderen Versanddaten")
    if current not in allowed_from[req.status]:
        raise HTTPException(status_code=409, detail=f"Ungültiger Statuswechsel: {current} → {req.status}")

    now = datetime.now(timezone.utc).isoformat()
    updates = {
        "fulfillment_status": req.status,
        "fulfillment_updated_at": now,
        "fulfillment_updated_by": str(admin["_id"]),
        "fulfillment_note": (req.note or "").strip() or None,
    }
    if req.status == "processing":
        updates["processing_at"] = now
    elif req.status == "shipped":
        updates["carrier"] = carrier
        updates["tracking_number"] = tracking_number
        updates["shipped_at"] = now
    elif req.status == "delivered":
        updates["delivered_at"] = now

    changed = await db.auction_orders.update_one(
        {
            "_id": order_id,
            "payment_status": "paid",
            "fulfillment_status": current,
        },
        {"$set": updates},
    )
    if changed.modified_count != 1:
        fresh = await db.auction_orders.find_one({"_id": order_id}, {"_id": 0}) or {}
        if fresh.get("fulfillment_status") == req.status:
            return {"ok": True, "order": fresh, "replayed": True}
        raise HTTPException(status_code=409, detail="Fulfillment wurde parallel geändert")

    await db.auctions.update_one(
        {"auction_id": order.get("auction_id"), "winner_order_id": order_id},
        {"$set": {"winner_fulfillment_status": req.status}},
    )
    notification_id = f"auction-order:{order_id}:{req.status}"
    status_message = {
        "processing": "Dein Auktionsgewinn wird für den Versand vorbereitet.",
        "shipped": f"Dein Auktionsgewinn wurde versendet. Carrier: {carrier}, Tracking: {tracking_number}",
        "delivered": "Dein Auktionsgewinn wurde als zugestellt markiert.",
    }[req.status]
    await db.auction_notifications.update_one(
        {"_id": notification_id},
        {"$setOnInsert": {
            "_id": notification_id,
            "user_id": order.get("winner_id"),
            "type": f"winner_order_{req.status}",
            "auction_id": order.get("auction_id"),
            "order_id": order_id,
            "message": status_message,
            "read": False,
            "created_at": now,
        }},
        upsert=True,
    )
    fresh = await db.auction_orders.find_one({"_id": order_id}, {"_id": 0}) or {}
    return {"ok": True, "order": fresh, "replayed": False}


# ── List auctions ──
@router.get("")
async def list_auctions(request: Request, response: Response):
    """List active and upcoming auctions."""
    now = datetime.now(timezone.utc).isoformat()

    # Auto-end expired auctions through one atomic finalizer.
    expired = await db.auctions.find(
        {"status": "active", "ends_at": {"$lt": now}},
        {"_id": 0, "auction_id": 1},
    ).limit(100).to_list(100)
    for auc in expired:
        await _finalize_auction_once(auc["auction_id"])

    auctions = await db.auctions.find(
        {"status": {"$in": ["active", "upcoming", "ended"]}},
        {"_id": 0},
    ).sort("created_at", -1).limit(100).to_list(100)

    # Enrich with final_battle info
    now_dt = datetime.now(timezone.utc)
    for a in auctions:
        a["image_url"] = resolve_product_image(a.get("title", ""), a.get("image_url") or "")
        a["image_urls"] = resolve_product_gallery(
            a.get("title", ""),
            a.get("image_urls") or [],
            a.get("image_url") or "",
        )
        enrich_auction_visual_image_data(a)
        if a.get("status") == "active" and a.get("ends_at"):
            try:
                ends = datetime.fromisoformat(a["ends_at"])
                remaining = (ends - now_dt).total_seconds()
                a["remaining_seconds"] = max(0, remaining)
                a["final_battle"] = 0 < remaining <= FINAL_BATTLE_THRESHOLD
            except Exception:
                a["remaining_seconds"] = 0
                a["final_battle"] = False
        else:
            a["remaining_seconds"] = 0
            a["final_battle"] = False

    # Set cache headers - NO CACHE for real-time data
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"

    auctions = [_public_auction_view(a) for a in auctions]
    return {"auctions": auctions}


@router.get("/active")
async def get_active_auctions():
    """Get only currently live auctions and finalize stale active rows first."""
    now = datetime.now(timezone.utc)
    now_iso = now.isoformat()

    expired = await db.auctions.find(
        {"status": "active", "ends_at": {"$lte": now_iso}},
        {"_id": 0, "auction_id": 1},
    ).limit(100).to_list(100)
    for auc in expired:
        await _finalize_auction_once(auc["auction_id"])
    
    auctions = await db.auctions.find(
        {"status": "active", "ends_at": {"$gt": now_iso}},
        {"_id": 0},
    ).sort("ends_at", 1).to_list(100)
    
    for a in auctions:
        a["image_url"] = resolve_product_image(a.get("title", ""), a.get("image_url") or "")
        a["image_urls"] = resolve_product_gallery(
            a.get("title", ""),
            a.get("image_urls") or [],
            a.get("image_url") or "",
        )
        enrich_auction_visual_image_data(a)
        if a.get("ends_at"):
            try:
                ends = datetime.fromisoformat(a["ends_at"])
                remaining = (ends - now).total_seconds()
                a["remaining_seconds"] = max(0, remaining)
                a["final_battle"] = 0 < remaining <= FINAL_BATTLE_THRESHOLD
            except Exception:
                a["remaining_seconds"] = 0
                a["final_battle"] = False
    
    auctions = [_public_auction_view(a) for a in auctions]
    return {"auctions": auctions, "count": len(auctions)}


@router.get("/list")
async def list_all_auctions(status: str = None, limit: int = 100):
    """List auctions with optional status filter."""
    query = {}
    if status and status in ["active", "upcoming", "ended"]:
        query["status"] = status
    
    auctions = await db.auctions.find(
        query,
        {"_id": 0},
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    now = datetime.now(timezone.utc)
    for a in auctions:
        a["image_url"] = resolve_product_image(a.get("title", ""), a.get("image_url") or "")
        a["image_urls"] = resolve_product_gallery(
            a.get("title", ""),
            a.get("image_urls") or [],
            a.get("image_url") or "",
        )
        enrich_auction_visual_image_data(a)
        if a.get("status") == "active" and a.get("ends_at"):
            try:
                ends = datetime.fromisoformat(a["ends_at"])
                remaining = (ends - now).total_seconds()
                a["remaining_seconds"] = max(0, remaining)
                a["final_battle"] = 0 < remaining <= FINAL_BATTLE_THRESHOLD
            except Exception:
                a["remaining_seconds"] = 0
                a["final_battle"] = False
    
    auctions = [_public_auction_view(a) for a in auctions]
    return {"auctions": auctions, "total": len(auctions)}




# ── Feed alias (same as /list) ──
@router.get("/feed")
async def auctions_feed(request: Request, status: str = None, limit: int = 50):
    """Alias for /list endpoint (used by frontend)."""
    return await list_all_auctions(status, limit)

# ── Get user's credit balance ──
@router.get("/credits/balance")
async def get_credits(request: Request):
    """Get user's current bid credit balance."""
    user = await get_current_user(request)
    return {"bid_credits": user.get("bid_credits", 0)}


@router.get("/credits")
async def get_credits_alias(request: Request):
    """Alias for /credits/balance."""
    user = await get_current_user(request)
    return {"credits": user.get("bid_credits", 0), "bid_credits": user.get("bid_credits", 0)}


# ── Credit Packages ──
@router.get("/credits/packages")
async def get_credit_packages(request: Request):
    """Get available credit packages for purchase."""
    packages = []
    for pkg_id, data in CREDIT_PACKAGES.items():
        packages.append({
            "id": pkg_id,
            "credits": data["credits"],
            "price": data["price"],
            "price_per_credit": round(data["price"] / data["credits"], 2),
        })
    packages.sort(key=lambda x: x["credits"])
    return {"packages": packages}


# ── Buy Credits ──
@router.post("/credits/buy")
async def buy_credits(request: Request):
    """Backward-compatible alias for the canonical wallet credit purchase."""
    body = await request.json()
    req = BuyCreditsRequest(
        package_id=body.get("package_id", ""),
        idempotency_key=body.get("idempotency_key"),
    )
    return await buy_credits_direct(req, request)


# ── Daily Reward ──
DAILY_REWARD_CREDITS = 3

@router.post("/daily-reward")
async def claim_daily_reward(request: Request):
    """Claim daily free bid credits exactly once per 24h window."""
    user = await get_current_user(request)
    now = datetime.now(timezone.utc)
    cutoff = (now - timedelta(hours=24)).isoformat()

    result = await db.users.update_one(
        {
            "_id": user["_id"],
            "$or": [
                {"last_daily_claim": {"$exists": False}},
                {"last_daily_claim": None},
                {"last_daily_claim": {"$lte": cutoff}},
            ],
        },
        {
            "$inc": {
                "bid_credits": DAILY_REWARD_CREDITS,
                "bid_credit_value_buckets.c0": DAILY_REWARD_CREDITS,
            },
            "$set": {"last_daily_claim": now.isoformat()},
        },
    )
    if result.modified_count != 1:
        fresh = await db.users.find_one({"_id": user["_id"]}, {"last_daily_claim": 1, "_id": 0}) or {}
        last_claim = fresh.get("last_daily_claim")
        remaining_secs = 86400
        if last_claim:
            try:
                elapsed = (now - datetime.fromisoformat(last_claim)).total_seconds()
                remaining_secs = max(1, int(86400 - elapsed))
            except Exception:
                pass
        raise HTTPException(status_code=400, detail=f"Already claimed. Next in {remaining_secs}s")

    updated = await db.users.find_one({"_id": user["_id"]})
    return {"credits_awarded": DAILY_REWARD_CREDITS, "total_credits": updated.get("bid_credits", 0)}


@router.get("/daily-reward")
async def check_daily_reward(request: Request):
    """Check if daily reward is available."""
    user = await get_current_user(request)
    now = datetime.now(timezone.utc)
    last_claim = user.get("last_daily_claim")
    if not last_claim:
        return {"available": True, "remaining_seconds": 0}
    last_dt = datetime.fromisoformat(last_claim)
    elapsed = (now - last_dt).total_seconds()
    if elapsed >= 86400:
        return {"available": True, "remaining_seconds": 0}
    return {"available": False, "remaining_seconds": int(86400 - elapsed)}


# ── First purchase bonus check ──
@router.get("/first-purchase-check")
async def check_first_purchase(request: Request):
    """Check if user qualifies for first-purchase bonus."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    has_purchased = await _has_previous_credit_purchase(user_id)
    bonus_already_awarded = bool(user.get("auction_first_purchase_bonus_awarded"))
    return {"is_first_purchase": not has_purchased and not bonus_already_awarded, "bonus_credits": 5}


# ── Referral Leaderboard ──
@router.get("/referral-leaderboard")
async def referral_leaderboard(request: Request):
    """Get top referrers."""
    pipeline = [
        {"$match": {"referred_by": {"$exists": True, "$ne": None}}},
        {"$group": {"_id": "$referred_by", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 10},
    ]
    results = await db.users.aggregate(pipeline).to_list(10)
    leaders = []
    for r in results:
        referrer = await db.users.find_one({"_id": ObjectId(r["_id"])}, {"_id": 0, "name": 1})
        if referrer:
            name = referrer.get("name", "User")
            display = name[:2] + "***" if len(name) > 2 else name
            leaders.append({"name": display, "referrals": r["count"], "bonus": r["count"] * 5})
    return {"leaderboard": leaders}


# ── Get saved payment method (for auction checkout) ──
@router.get("/saved-method")
async def get_saved_method_auction(request: Request):
    """Return user's saved card details for auction checkout."""
    user = await get_current_user(request)
    pm_id = user.get("stripe_pm_id")
    if not pm_id:
        return {"has_saved_method": False}
    return {
        "has_saved_method": True,
        "card_brand": user.get("stripe_card_brand", ""),
        "card_last4": user.get("stripe_card_last4", ""),
        "card_exp_month": user.get("stripe_card_exp_month", 0),
        "card_exp_year": user.get("stripe_card_exp_year", 0),
    }


# ── User Watchlist ──
@router.get("/user/watchlist")
async def get_watchlist(request: Request):
    """Get user's watchlist auction IDs."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    items = await db.watchlist.find({"user_id": user_id}, {"_id": 0, "auction_id": 1}).to_list(100)
    return {"watchlist": [i["auction_id"] for i in items]}


# ── Bid Streak ──
@router.get("/user/streak")
async def get_streak(request: Request):
    """Get user's current bid streak info."""
    user = await get_current_user(request)
    streak = user.get("bid_streak", 0)
    last_bid_date = user.get("last_bid_date", "")
    if last_bid_date:
        try:
            last_dt = datetime.fromisoformat(last_bid_date)
            elapsed = (datetime.now(timezone.utc) - last_dt).total_seconds()
            if elapsed > 86400:
                streak = 0
        except Exception:
            streak = 0
    return {"streak": streak, "last_bid_date": last_bid_date}


# ── Auction Notifications ──
@router.get("/user/notifications")
async def get_auction_notifications(request: Request):
    """Get user's auction-related notifications."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    notifs = await db.auction_notifications.find(
        {"user_id": user_id},
        {"_id": 0},
    ).sort("created_at", -1).to_list(20)
    return {"notifications": notifs}


@router.post("/user/notifications/read")
async def mark_auction_notifications_read(request: Request):
    """Mark all auction notifications as read."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    await db.auction_notifications.update_many(
        {"user_id": user_id, "read": False},
        {"$set": {"read": True}},
    )
    return {"ok": True}


# ── Referral Code (auction context) ──
@router.get("/user/referral")
async def get_auction_referral(request: Request):
    """Get user's referral code and stats for auction sharing."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    ref_code = user.get("referral_code")
    if not ref_code:
        ref_code = secrets.token_hex(4).upper()
        await db.users.update_one({"_id": user["_id"]}, {"$set": {"referral_code": ref_code}})
    referral_count = await db.users.count_documents({"referred_by": user_id})
    return {"referral_code": ref_code, "referral_count": referral_count, "bonus_per_referral": 5}


@router.post("/user/apply-referral")
async def apply_auction_referral(request: Request):
    """Apply an auction referral exactly once and recover safely after partial retries."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    body = await request.json()
    code = str(body.get("code") or "").strip().upper()
    if not code:
        raise HTTPException(status_code=400, detail="No code provided")

    referrer = await db.users.find_one({"referral_code": code})
    if not referrer:
        raise HTTPException(status_code=404, detail="Invalid referral code")
    referrer_id = str(referrer["_id"])
    if referrer_id == user_id:
        raise HTTPException(status_code=400, detail="Cannot use your own code")

    current_referrer = str(user.get("referred_by") or "")
    replayed = False
    if current_referrer:
        if current_referrer != referrer_id:
            raise HTTPException(status_code=400, detail="Already used a referral code")
        replayed = True
    else:
        claim = await db.users.update_one(
            {
                "_id": user["_id"],
                "$or": [
                    {"referred_by": {"$exists": False}},
                    {"referred_by": None},
                    {"referred_by": ""},
                ],
            },
            {"$set": {
                "referred_by": referrer_id,
                "referred_at": datetime.now(timezone.utc).isoformat(),
            }},
        )
        if claim.modified_count != 1:
            fresh = await db.users.find_one({"_id": user["_id"]}, {"referred_by": 1}) or {}
            if str(fresh.get("referred_by") or "") != referrer_id:
                raise HTTPException(status_code=409, detail="Referral code was already claimed")
            replayed = True

    grant_scope = f"auction-referral:{user_id}:{referrer_id}"
    invitee_new, invitee_ok = await _grant_bid_credits_once(
        user["_id"],
        credits=5,
        grant_key=f"{grant_scope}:invitee",
        source="referral_invitee",
        metadata={"referrer_id": referrer_id, "code": code},
    )
    referrer_new, referrer_ok = await _grant_bid_credits_once(
        referrer["_id"],
        credits=5,
        grant_key=f"{grant_scope}:referrer",
        source="referral_referrer",
        metadata={"invitee_id": user_id, "code": code},
    )
    if not invitee_ok or not referrer_ok:
        raise HTTPException(status_code=500, detail="Referral bonus requires reconciliation")

    notification_id = f"auction-referral:{user_id}:{referrer_id}"
    await db.auction_notifications.update_one(
        {"_id": notification_id},
        {"$setOnInsert": {
            "_id": notification_id,
            "user_id": referrer_id,
            "type": "referral",
            "message": f"{user.get('name', 'Someone')} joined using your code! +5 credits",
            "read": False,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }},
        upsert=True,
    )

    updated = await db.users.find_one({"_id": user["_id"]}, {"bid_credits": 1, "_id": 0}) or {}
    return {
        "credits_awarded": 5,
        "total_credits": updated.get("bid_credits", 0),
        "replayed": replayed or not invitee_new or not referrer_new,
    }


# ── Get single auction with bids ──
@router.get("/{auction_id}")
async def get_auction(auction_id: str, request: Request):
    """Get auction details with recent bid history."""
    now = datetime.now(timezone.utc).isoformat()

    auction = await db.auctions.find_one(
        {"auction_id": auction_id}, {"_id": 0}
    )
    if not auction:
        raise HTTPException(status_code=404, detail="Auction not found")

    # Auto-end if expired through the same atomic finalizer used by listings.
    if auction["status"] == "active" and auction["ends_at"] < now:
        finalized, _ = await _finalize_auction_once(auction_id)
        if finalized:
            auction = {k: v for k, v in finalized.items() if k != "_id"}

    # Get recent bids (last 30)
    bids = await db.auction_bids.find(
        {"auction_id": auction_id}, {"_id": 0}
    ).sort("created_at", -1).to_list(30)

    # Count unique bidders
    unique_bidders = await db.auction_bids.distinct("user_id", {"auction_id": auction_id})

    auction["image_url"] = resolve_product_image(auction.get("title", ""), auction.get("image_url") or "")
    auction["image_urls"] = resolve_product_gallery(
        auction.get("title", ""),
        auction.get("image_urls") or [],
        auction.get("image_url") or "",
    )
    enrich_auction_visual_image_data(auction)

    if auction.get("status") == "active" and auction.get("ends_at"):
        try:
            ends = datetime.fromisoformat(auction["ends_at"])
            remaining = (ends - datetime.now(timezone.utc)).total_seconds()
            auction["remaining_seconds"] = max(0, remaining)
            auction["final_battle"] = 0 < remaining <= FINAL_BATTLE_THRESHOLD
        except Exception:
            auction["remaining_seconds"] = 0
            auction["final_battle"] = False
    else:
        auction["remaining_seconds"] = 0
        auction["final_battle"] = False

    auction = _public_auction_view(auction)
    return {"auction": auction, "bids": bids, "unique_bidders": len(unique_bidders)}


# ── Place a bid ──
class BidRequest(BaseModel):
    auction_id: str
    idempotency_key: Optional[str] = None


@router.post("/bid")
async def place_bid(req: BidRequest, request: Request):
    """Place one idempotent bid: exactly one credit -> exactly one €0.01 increment."""
    user = await get_current_user(request)
    if not TEST_MODE and user.get("role") not in {"admin", "super_admin"} and user.get("kyc_status") != "approved":
        raise HTTPException(
            status_code=403,
            detail={
                "error": "kyc_required",
                "message": "Bitte verifiziere zuerst deinen Ausweis, um an Auktionen teilzunehmen.",
                "kyc_status": user.get("kyc_status", "not_started"),
            },
        )

    user_id = str(user["_id"])
    idempotency_key = _require_auction_idempotency_key(
        req.idempotency_key,
        request,
        prefix="auction-bid",
    )
    op_hash = _bid_operation_hash(user_id, req.auction_id, idempotency_key)
    bid_doc_id = f"AUBID-{op_hash}"

    existing_bid = await db.auction_bids.find_one({"_id": bid_doc_id}, {"_id": 0})
    if existing_bid:
        fresh_user = await db.users.find_one({"_id": user["_id"]}, {"bid_credits": 1, "_id": 0}) or {}
        return {
            "bid": existing_bid,
            "new_price": existing_bid.get("bid_price"),
            "ends_at": existing_bid.get("ends_at_after"),
            "total_bids": existing_bid.get("total_bids_after"),
            "remaining_credits": fresh_user.get("bid_credits", 0),
            "replayed": True,
        }

    auction = await db.auctions.find_one({"auction_id": req.auction_id})
    if not auction:
        raise HTTPException(status_code=404, detail="Auction not found")
    now = datetime.now(timezone.utc)
    now_iso = now.isoformat()
    if auction.get("status") != "active":
        raise HTTPException(status_code=400, detail="Auction is not active")
    if auction.get("ends_at", "") <= now_iso:
        raise HTTPException(status_code=400, detail="Auction has ended")
    if auction.get("bot_only"):
        raise HTTPException(
            status_code=403,
            detail={
                "error": "bot_only_auction",
                "message": "Diese Auktion ist nur für Bots — menschliche Gebote sind nicht erlaubt.",
            },
        )

    credit_state = await _reserve_bid_credit_once(user["_id"], op_hash, req.auction_id)
    if credit_state == "insufficient":
        raise HTTPException(status_code=400, detail="Not enough bid credits")
    credit_cash_value = await _credit_cash_value_for_operation(user["_id"], op_hash)

    # If a retry arrives after the price update but before the response was delivered,
    # recover from the result stored atomically on the auction document.
    fresh_auction = await db.auctions.find_one({"auction_id": req.auction_id}) or {}
    recovered = _read_bid_operation_result(fresh_auction, op_hash)
    if recovered:
        await _mark_bid_credit_spent(user["_id"], op_hash, req.auction_id, float(recovered["p"]))
        bid_record = {
            "bid_id": f"BID-{op_hash.upper()}",
            "auction_id": req.auction_id,
            "user_id": user_id,
            "user_name": user.get("name", "Anonymous"),
            "bid_price": float(recovered["p"]),
            "created_at": recovered["t"],
            "ends_at_after": recovered["e"],
            "total_bids_after": int(recovered["n"]),
            "paid_credit_value_eur": round(max(0.0, float(recovered.get("v") or 0.0)), 2),
            "operation_key": op_hash,
        }
        await db.auction_bids.update_one(
            {"_id": bid_doc_id},
            {"$setOnInsert": bid_record},
            upsert=True,
        )
        fresh_user = await db.users.find_one({"_id": user["_id"]}, {"bid_credits": 1, "_id": 0}) or {}
        return {
            "bid": bid_record,
            "new_price": bid_record["bid_price"],
            "ends_at": bid_record["ends_at_after"],
            "total_bids": bid_record["total_bids_after"],
            "remaining_credits": fresh_user.get("bid_credits", 0),
            "replayed": True,
        }

    applied_snapshot = None
    applied_result = None

    for _ in range(8):
        snapshot = await db.auctions.find_one({"auction_id": req.auction_id})
        if not snapshot:
            await _refund_reserved_bid_credit(user["_id"], op_hash, req.auction_id, "auction_missing")
            raise HTTPException(status_code=404, detail="Auction not found")

        now = datetime.now(timezone.utc)
        now_iso = now.isoformat()
        if snapshot.get("status") != "active" or snapshot.get("ends_at", "") <= now_iso:
            await _refund_reserved_bid_credit(user["_id"], op_hash, req.auction_id, "auction_ended")
            raise HTTPException(status_code=400, detail="Auction has ended")
        if snapshot.get("bot_only"):
            await _refund_reserved_bid_credit(user["_id"], op_hash, req.auction_id, "bot_only")
            raise HTTPException(status_code=403, detail="Diese Auktion ist nur für Bots")

        existing_result = _read_bid_operation_result(snapshot, op_hash)
        if existing_result:
            applied_snapshot = snapshot
            applied_result = existing_result
            break

        current_price = float(snapshot.get("current_price") or 0)
        auction_increment = max(0.01, round(float(snapshot.get("price_increment") or PRICE_INCREMENT), 2))
        new_price = round(current_price + auction_increment, 2)
        current_ends = datetime.fromisoformat(snapshot["ends_at"])
        remaining = (current_ends - now).total_seconds()
        new_ends = now + timedelta(seconds=TIMER_EXTENSION_SECONDS) if remaining <= FINAL_BATTLE_THRESHOLD else current_ends
        new_ends_iso = new_ends.isoformat()
        total_after = int(snapshot.get("total_bids") or 0) + 1
        base_real_paid = snapshot.get("real_paid_bids")
        if base_real_paid is None:
            base_real_paid = await db.auction_bids.count_documents({
                "auction_id": req.auction_id,
                "is_bot": {"$ne": True},
            })
        real_paid_after = int(base_real_paid or 0) + 1
        real_revenue_after = round(
            max(0.0, float(snapshot.get("real_bid_revenue_eur") or 0.0)) + credit_cash_value,
            2,
        )
        guard_after = _profit_guard_snapshot(
            {
                **snapshot,
                "current_price": new_price,
                "real_bid_revenue_eur": real_revenue_after,
            },
            real_paid_after,
        )
        result_field = f"bid_operation_results.{op_hash}"
        op_result = {
            "p": new_price,
            "e": new_ends_iso,
            "n": total_after,
            "t": now_iso,
            "v": credit_cash_value,
        }

        update = await db.auctions.update_one(
            {
                "auction_id": req.auction_id,
                "status": "active",
                "current_price": snapshot.get("current_price"),
                "ends_at": snapshot.get("ends_at"),
                result_field: {"$exists": False},
            },
            {
                "$set": {
                    "current_price": new_price,
                    "ends_at": new_ends_iso,
                    "last_bidder_id": user_id,
                    "last_bidder_name": user.get("name", "Anonymous"),
                    "real_paid_bids": real_paid_after,
                    "minimum_target_reached": guard_after["reached"],
                    "profit_guard_status": (
                        "target_reached"
                        if guard_after["enabled"] and guard_after["reached"]
                        else ("target_not_met" if guard_after["enabled"] else "not_enabled")
                    ),
                    "estimated_real_bids_remaining": guard_after["estimated_real_bids_remaining"],
                    result_field: op_result,
                },
                "$inc": {
                    "total_bids": 1,
                    "real_bid_revenue_eur": credit_cash_value,
                },
            },
        )
        if update.modified_count == 1:
            applied_snapshot = snapshot
            applied_result = op_result
            break

    if not applied_result:
        latest = await db.auctions.find_one({"auction_id": req.auction_id}) or {}
        applied_result = _read_bid_operation_result(latest, op_hash)
        if not applied_result:
            await _refund_reserved_bid_credit(user["_id"], op_hash, req.auction_id, "contention")
            raise HTTPException(status_code=409, detail="Gebot konnte wegen gleichzeitiger Gebote nicht sicher gesetzt werden. Credit wurde zurückgegeben.")

    spent_ok = await _mark_bid_credit_spent(
        user["_id"],
        op_hash,
        req.auction_id,
        float(applied_result["p"]),
    )
    if not spent_ok:
        raise HTTPException(status_code=500, detail="Gebot gesetzt, Credit-Abrechnung muss geprüft werden.")

    bid_record = {
        "bid_id": f"BID-{op_hash.upper()}",
        "auction_id": req.auction_id,
        "user_id": user_id,
        "user_name": user.get("name", "Anonymous"),
        "bid_price": float(applied_result["p"]),
        "created_at": applied_result["t"],
        "ends_at_after": applied_result["e"],
        "total_bids_after": int(applied_result["n"]),
        "paid_credit_value_eur": round(max(0.0, float(applied_result.get("v") or 0.0)), 2),
        "operation_key": op_hash,
    }
    await db.auction_bids.update_one(
        {"_id": bid_doc_id},
        {"$setOnInsert": bid_record},
        upsert=True,
    )

    # Streak metadata only after the financial bid is safely committed.
    fresh_before_streak = await db.users.find_one({"_id": user["_id"]}, {"last_bid_date": 1, "bid_streak": 1}) or {}
    previous_last = fresh_before_streak.get("last_bid_date")
    streak_update = {"last_bid_date": applied_result["t"]}
    if previous_last:
        try:
            previous_dt = datetime.fromisoformat(previous_last)
            if previous_dt.strftime("%Y-%m-%d") != datetime.fromisoformat(applied_result["t"]).strftime("%Y-%m-%d"):
                streak_update["bid_streak"] = int(fresh_before_streak.get("bid_streak") or 0) + 1
        except Exception:
            streak_update["bid_streak"] = max(1, int(fresh_before_streak.get("bid_streak") or 0))
    else:
        streak_update["bid_streak"] = 1
    await db.users.update_one({"_id": user["_id"]}, {"$set": streak_update})

    previous_bidder_id = (applied_snapshot or {}).get("last_bidder_id")
    previous_title = (applied_snapshot or {}).get("title", "Auktion")
    if previous_bidder_id and previous_bidder_id != user_id:
        await db.auction_notifications.insert_one({
            "user_id": previous_bidder_id,
            "type": "outbid",
            "auction_id": req.auction_id,
            "message": f"You were outbid on {previous_title}!",
            "read": False,
            "created_at": applied_result["t"],
        })
        try:
            from routes.web_push import send_push_to_user
            asyncio.create_task(send_push_to_user(
                user_id=previous_bidder_id,
                title="🔥 Du wurdest überboten!",
                body=f"{previous_title} — jetzt €{float(applied_result['p']):.2f}. Schnell, biete weiter!",
                icon="/logo192.png",
                data={"url": f"/auction/{req.auction_id}", "type": "outbid", "auction_id": req.auction_id},
            ))
        except Exception:
            pass

    fresh_user = await db.users.find_one({"_id": user["_id"]}, {"bid_credits": 1, "_id": 0}) or {}

    try:
        await process_auto_bids(req.auction_id, user_id)
    except Exception:
        pass

    return {
        "bid": bid_record,
        "new_price": bid_record["bid_price"],
        "ends_at": bid_record["ends_at_after"],
        "total_bids": bid_record["total_bids_after"],
        "remaining_credits": fresh_user.get("bid_credits", 0),
        "replayed": False,
    }


# ── Process auto-bids after a manual bid ──
async def process_auto_bids(auction_id: str, last_bidder_id: str):
    """Place at most one race-safe auto-bid in response to a committed bid."""
    auto_bids = await db.auto_bids.find(
        {"auction_id": auction_id, "active": True, "user_id": {"$ne": last_bidder_id}}
    ).sort("updated_at", 1).to_list(50)

    for ab in auto_bids:
        now = datetime.now(timezone.utc)
        now_iso = now.isoformat()
        max_bids = int(ab.get("max_bids") or 0)
        placed = int(ab.get("bids_placed") or 0)
        processing_until = ab.get("processing_until")
        processing_slot = ab.get("processing_slot")

        if ab.get("processing") and processing_until and processing_until > now_iso:
            continue

        resume_slot = None
        if ab.get("processing") and processing_slot is not None:
            try:
                candidate_slot = int(processing_slot)
                if candidate_slot >= 1:
                    resume_slot = candidate_slot
            except (TypeError, ValueError):
                resume_slot = None

        if placed >= max_bids and resume_slot is None:
            await db.auto_bids.update_one(
                {"_id": ab["_id"]},
                {"$set": {"active": False, "processing": False, "processing_until": None}, "$unset": {"processing_slot": ""}},
            )
            continue

        lock_until = (now + timedelta(seconds=30)).isoformat()
        if resume_slot is not None:
            next_slot = resume_slot
            claimed = await db.auto_bids.update_one(
                {
                    "_id": ab["_id"],
                    "active": True,
                    "processing": True,
                    "processing_slot": next_slot,
                    "$or": [
                        {"processing_until": {"$lte": now_iso}},
                        {"processing_until": None},
                    ],
                },
                {"$set": {
                    "processing_until": lock_until,
                    "processing_started_at": now_iso,
                    "processing_recovered_at": now_iso,
                }},
            )
        else:
            next_slot = placed + 1
            claimed = await db.auto_bids.update_one(
                {
                    "_id": ab["_id"],
                    "active": True,
                    "bids_placed": placed,
                    "$or": [
                        {"processing": {"$ne": True}},
                        {"processing_until": {"$lte": now_iso}},
                        {"processing_until": None},
                    ],
                },
                {
                    "$set": {
                        "processing": True,
                        "processing_slot": next_slot,
                        "processing_until": lock_until,
                        "processing_started_at": now_iso,
                    },
                    "$inc": {"bids_placed": 1},
                },
            )
        if claimed.modified_count != 1:
            continue

        user = await db.users.find_one({"_id": ObjectId(ab["user_id"])})
        if not user:
            await db.auto_bids.update_one(
                {"_id": ab["_id"]},
                {"$set": {"active": False, "processing": False, "processing_until": None}},
            )
            continue

        if not TEST_MODE and user.get("role") not in {"admin", "super_admin"} and user.get("kyc_status") != "approved":
            await db.auto_bids.update_one(
                {"_id": ab["_id"]},
                {
                    "$inc": {"bids_placed": -1},
                    "$set": {"active": False, "processing": False, "processing_until": None, "disabled_reason": "kyc_required"},
                },
            )
            continue

        op_hash = hashlib.sha256(f"auto:{auction_id}:{str(ab['_id'])}:{next_slot}".encode("utf-8")).hexdigest()[:20]
        bid_doc_id = f"AUBID-{op_hash}"
        credit_state = await _reserve_bid_credit_once(user["_id"], op_hash, auction_id)
        if credit_state == "insufficient":
            await db.auto_bids.update_one(
                {"_id": ab["_id"]},
                {
                    "$inc": {"bids_placed": -1},
                    "$set": {"active": False, "processing": False, "processing_until": None, "disabled_reason": "no_credits"},
                },
            )
            continue

        credit_cash_value = await _credit_cash_value_for_operation(user["_id"], op_hash)
        applied_result = None
        for _ in range(8):
            snapshot = await db.auctions.find_one({"auction_id": auction_id})
            now = datetime.now(timezone.utc)
            now_iso = now.isoformat()
            if not snapshot or snapshot.get("status") != "active" or snapshot.get("ends_at", "") <= now_iso:
                await _refund_reserved_bid_credit(user["_id"], op_hash, auction_id, "auction_ended")
                await db.auto_bids.update_one(
                    {"_id": ab["_id"]},
                    {
                        "$inc": {"bids_placed": -1},
                        "$set": {"active": False, "processing": False, "processing_until": None},
                    },
                )
                return

            existing_result = _read_bid_operation_result(snapshot, op_hash)
            if existing_result:
                applied_result = existing_result
                break

            current_price = float(snapshot.get("current_price") or 0)
            new_price = round(current_price + PRICE_INCREMENT, 2)
            current_ends = datetime.fromisoformat(snapshot["ends_at"])
            remaining = (current_ends - now).total_seconds()
            new_ends = now + timedelta(seconds=TIMER_EXTENSION_SECONDS) if remaining <= FINAL_BATTLE_THRESHOLD else current_ends
            new_ends_iso = new_ends.isoformat()
            total_after = int(snapshot.get("total_bids") or 0) + 1
            base_real_paid = snapshot.get("real_paid_bids")
            if base_real_paid is None:
                base_real_paid = await db.auction_bids.count_documents({
                    "auction_id": auction_id,
                    "is_bot": {"$ne": True},
                })
            real_paid_after = int(base_real_paid or 0) + 1
            real_revenue_after = round(
                max(0.0, float(snapshot.get("real_bid_revenue_eur") or 0.0)) + credit_cash_value,
                2,
            )
            guard_after = _profit_guard_snapshot(
                {
                    **snapshot,
                    "current_price": new_price,
                    "real_bid_revenue_eur": real_revenue_after,
                },
                real_paid_after,
            )
            result_field = f"bid_operation_results.{op_hash}"
            op_result = {
                "p": new_price,
                "e": new_ends_iso,
                "n": total_after,
                "t": now_iso,
                "v": credit_cash_value,
            }

            updated = await db.auctions.update_one(
                {
                    "auction_id": auction_id,
                    "status": "active",
                    "current_price": snapshot.get("current_price"),
                    "ends_at": snapshot.get("ends_at"),
                    result_field: {"$exists": False},
                },
                {
                    "$set": {
                        "current_price": new_price,
                        "ends_at": new_ends_iso,
                        "last_bidder_id": ab["user_id"],
                        "last_bidder_name": user.get("name", "Anonymous"),
                        "real_paid_bids": real_paid_after,
                        "minimum_target_reached": guard_after["reached"],
                        "profit_guard_status": (
                            "target_reached"
                            if guard_after["enabled"] and guard_after["reached"]
                            else ("target_not_met" if guard_after["enabled"] else "not_enabled")
                        ),
                        "estimated_real_bids_remaining": guard_after["estimated_real_bids_remaining"],
                        result_field: op_result,
                    },
                    "$inc": {
                        "total_bids": 1,
                        "real_bid_revenue_eur": credit_cash_value,
                    },
                },
            )
            if updated.modified_count == 1:
                applied_result = op_result
                break

        if not applied_result:
            latest = await db.auctions.find_one({"auction_id": auction_id}) or {}
            applied_result = _read_bid_operation_result(latest, op_hash)

        if not applied_result:
            await _refund_reserved_bid_credit(user["_id"], op_hash, auction_id, "contention")
            await db.auto_bids.update_one(
                {"_id": ab["_id"]},
                {
                    "$inc": {"bids_placed": -1},
                    "$set": {"processing": False, "processing_until": None},
                },
            )
            continue

        spent_ok = await _mark_bid_credit_spent(
            user["_id"],
            op_hash,
            auction_id,
            float(applied_result["p"]),
        )
        if not spent_ok:
            await db.auto_bids.update_one(
                {"_id": ab["_id"]},
                {"$set": {"processing": False, "processing_until": None, "disabled_reason": "credit_reconciliation"}},
            )
            return

        bid_record = {
            "bid_id": f"BID-{op_hash.upper()}",
            "auction_id": auction_id,
            "user_id": ab["user_id"],
            "user_name": user.get("name", "Anonymous"),
            "bid_price": float(applied_result["p"]),
            "created_at": applied_result["t"],
            "ends_at_after": applied_result["e"],
            "total_bids_after": int(applied_result["n"]),
            "paid_credit_value_eur": round(max(0.0, float(applied_result.get("v") or 0.0)), 2),
            "operation_key": op_hash,
            "is_auto": True,
        }
        await db.auction_bids.update_one(
            {"_id": bid_doc_id},
            {"$setOnInsert": bid_record},
            upsert=True,
        )

        await db.auto_bids.update_one(
            {"_id": ab["_id"]},
            {
                "$set": {
                    "processing": False,
                    "processing_until": None,
                    "last_bid_at": applied_result["t"],
                    "active": next_slot < max_bids,
                },
                "$unset": {"processing_slot": ""},
            },
        )
        break


# ── Set Auto-Bid ──
class AutoBidRequest(BaseModel):
    auction_id: str
    max_bids: int = Field(..., ge=1, le=500)


@router.post("/auto-bid")
async def set_auto_bid(req: AutoBidRequest, request: Request):
    """Set auto-bid for an auction."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    if not TEST_MODE and user.get("role") not in {"admin", "super_admin"} and user.get("kyc_status") != "approved":
        raise HTTPException(
            status_code=403,
            detail={
                "error": "kyc_required",
                "message": "Bitte verifiziere zuerst deinen Ausweis, um Auto-Bid zu aktivieren.",
                "kyc_status": user.get("kyc_status", "not_started"),
            },
        )

    auction = await db.auctions.find_one({"auction_id": req.auction_id})
    if not auction or auction["status"] != "active":
        raise HTTPException(status_code=400, detail="Auction not active")

    credits = user.get("bid_credits", 0)
    if credits < 1:
        raise HTTPException(status_code=400, detail="Not enough bid credits")

    # Upsert auto-bid
    await db.auto_bids.update_one(
        {"user_id": user_id, "auction_id": req.auction_id},
        {"$set": {"active": True, "max_bids": req.max_bids, "updated_at": datetime.now(timezone.utc).isoformat()},
         "$setOnInsert": {"bids_placed": 0, "created_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True,
    )
    return {"ok": True, "max_bids": req.max_bids}


@router.delete("/auto-bid/{auction_id}")
async def cancel_auto_bid(auction_id: str, request: Request):
    """Cancel auto-bid for an auction."""
    user = await get_current_user(request)
    await db.auto_bids.update_one(
        {"user_id": str(user["_id"]), "auction_id": auction_id},
        {"$set": {"active": False}},
    )
    return {"ok": True}


@router.get("/auto-bid/{auction_id}")
async def get_auto_bid(auction_id: str, request: Request):
    """Get auto-bid status for an auction."""
    user = await get_current_user(request)
    ab = await db.auto_bids.find_one(
        {"user_id": str(user["_id"]), "auction_id": auction_id},
        {"_id": 0},
    )
    if not ab or not ab.get("active"):
        return {"active": False}
    return {"active": True, "max_bids": ab.get("max_bids", 0), "bids_placed": ab.get("bids_placed", 0)}


# ── Buy bid credits ──
class BuyCreditsRequest(BaseModel):
    package_id: str
    idempotency_key: Optional[str] = None


@router.post("/buy-credits")
async def buy_credits_direct(req: BuyCreditsRequest, request: Request):
    """Buy bid credits from the canonical wallet with exactly-once credit grants."""
    from core.payment_engine import debit_wallet, TransactionType

    user = await get_current_user(request)
    user_id = str(user["_id"])
    idempotency_key = _require_auction_idempotency_key(req.idempotency_key, request, prefix="auction-wallet")

    if req.package_id not in CREDIT_PACKAGES:
        raise HTTPException(status_code=400, detail="Invalid package")

    pkg = CREDIT_PACKAGES[req.package_id]
    price = float(pkg["price"])
    credits = int(pkg["credits"])
    had_previous_purchase = await _has_previous_credit_purchase(user_id)

    ref_hash = hashlib.sha256(idempotency_key.encode("utf-8")).hexdigest()[:16].upper()
    result = await debit_wallet(
        user_id=user_id,
        amount=price,
        tx_type=TransactionType.AUCTION_BID,
        description=f"Auction Credits: {credits} credits",
        reference=f"BIDS-W-{ref_hash}",
        metadata={
            "purchase_kind": "bid_credits",
            "category": "auction",
            "package_id": req.package_id,
            "credits": credits,
        },
        idempotency_key=idempotency_key,
    )
    if not result.success:
        payment_state = str(getattr(result.status, "value", result.status))
        status_code = 503 if payment_state in {"pending", "reconciliation_required"} else 400
        raise HTTPException(status_code=status_code, detail=result.error or "Credit purchase failed")

    _, grant_ok = await _grant_bid_credits_once(
        user["_id"],
        credits=credits,
        grant_key=idempotency_key,
        source="wallet_purchase",
        metadata={"package_id": req.package_id, "payment_transaction_id": result.transaction_id},
        cash_value_eur=price,
    )
    if not grant_ok:
        raise HTTPException(status_code=500, detail="Credit-Gutschrift konnte nicht bestätigt werden. Manuelle Prüfung erforderlich.")

    bonus = await _grant_first_purchase_bonus_once(user["_id"], eligible=not had_previous_purchase)
    updated_user = await db.users.find_one({"_id": user["_id"]})

    try:
        from routes.influencer import process_commission
        asyncio.create_task(process_commission(user_id, price, result.reference or f"BIDS-W-{ref_hash}"))
    except Exception:
        pass

    return {
        "credits_added": credits,
        "bonus_credits": bonus,
        "total_credits": updated_user.get("bid_credits", 0),
        "new_balance": updated_user.get("balance", 0),
        "is_first_purchase": bool(bonus),
        "transaction_id": result.transaction_id,
        "reference": result.reference,
    }


# ── Buy bid credits directly with saved Stripe card ──
class BuyCreditsDirectRequest(BaseModel):
    package_id: str
    idempotency_key: Optional[str] = None


@router.post("/buy-credits-direct")
async def buy_credits_direct_checkout(req: BuyCreditsDirectRequest, request: Request):
    """Buy bid credits with a saved Stripe card, idempotently."""
    import stripe as stripe_mod
    from core.config import STRIPE_API_KEY
    stripe_mod.api_key = STRIPE_API_KEY

    user = await get_current_user(request)
    user_id = str(user["_id"])
    idempotency_key = _require_auction_idempotency_key(req.idempotency_key, request, prefix="auction-card")

    if req.package_id not in CREDIT_PACKAGES:
        raise HTTPException(status_code=400, detail="Invalid package")

    pkg = CREDIT_PACKAGES[req.package_id]
    price = float(pkg["price"])
    credits = int(pkg["credits"])
    had_previous_purchase = await _has_previous_credit_purchase(user_id)

    cust_id = user.get("stripe_customer_id")
    pm_id = user.get("stripe_pm_id")
    if not cust_id or not pm_id:
        raise HTTPException(status_code=400, detail="No saved payment method")

    stripe_idempotency = f"bidcredits-{hashlib.sha256(idempotency_key.encode('utf-8')).hexdigest()[:32]}"
    try:
        intent = stripe_mod.PaymentIntent.create(
            amount=int(round(price * 100)),
            currency="eur",
            customer=cust_id,
            payment_method=pm_id,
            off_session=True,
            confirm=True,
            metadata={
                "user_id": user_id,
                "type": "bid_credits_direct",
                "package_id": req.package_id,
                "credits": str(credits),
                "client_idempotency_hash": hashlib.sha256(idempotency_key.encode("utf-8")).hexdigest()[:16],
            },
            idempotency_key=stripe_idempotency,
        )
    except stripe_mod.error.CardError:
        await db.users.update_one(
            {"_id": user["_id"]},
            {"$unset": {
                "stripe_pm_id": "", "stripe_card_brand": "", "stripe_card_last4": "",
                "stripe_card_exp_month": "", "stripe_card_exp_year": "", "stripe_pm_saved_at": "",
            }},
        )
        raise HTTPException(status_code=402, detail="Card declined. Please use another payment method.")
    except Exception:
        raise HTTPException(status_code=500, detail="Payment failed")

    if intent.status != "succeeded":
        raise HTTPException(status_code=402, detail=f"Payment not completed: {intent.status}")

    _, grant_ok = await _grant_bid_credits_once(
        user["_id"],
        credits=credits,
        grant_key=idempotency_key,
        source="saved_card_purchase",
        metadata={"package_id": req.package_id, "stripe_pi_id": intent.id},
        cash_value_eur=price,
    )
    if not grant_ok:
        raise HTTPException(status_code=500, detail="Kartenzahlung erfolgreich, Credit-Gutschrift muss manuell geprüft werden.")

    bonus = await _grant_first_purchase_bonus_once(user["_id"], eligible=not had_previous_purchase)
    ref_hash = hashlib.sha256(idempotency_key.encode("utf-8")).hexdigest()[:16].upper()
    ref = f"BIDS-D-{ref_hash}"
    txn = {
        "id": f"AUC-CARD-{hashlib.sha256(intent.id.encode('utf-8')).hexdigest()[:20]}",
        "user_id": user_id,
        "type": "purchase",
        "amount": -price,
        "description": f"Bid Credits ({credits}x) — Card" + (f" + {bonus} Bonus" if bonus else ""),
        "status": "completed",
        "reference": ref,
        "payment_method": "saved_card",
        "category": "auction",
        "stripe_pi_id": intent.id,
        "idempotency_key": idempotency_key,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.transactions.update_one(
        {"user_id": user_id, "stripe_pi_id": intent.id, "type": "purchase"},
        {"$setOnInsert": txn},
        upsert=True,
    )

    updated_user = await db.users.find_one({"_id": user["_id"]})
    return {
        "credits_added": credits,
        "bonus_credits": bonus,
        "total_credits": updated_user.get("bid_credits", 0),
        "new_balance": updated_user.get("balance", 0),
        "method": "card",
        "reference": ref,
        "stripe_pi_id": intent.id,
    }


# ── Buy bid credits via Stripe Checkout (new card) ──
class BuyCreditsStripeRequest(BaseModel):
    package_id: str
    idempotency_key: Optional[str] = None


@router.post("/buy-credits-stripe")
async def buy_credits_stripe(req: BuyCreditsStripeRequest, request: Request):
    """Create Stripe Checkout Session for buying bid credits with a new card."""
    from emergentintegrations.payments.stripe.checkout import StripeCheckout, CheckoutSessionRequest
    from core.config import STRIPE_API_KEY

    user = await get_current_user(request)
    user_id = str(user["_id"])
    idempotency_key = _require_auction_idempotency_key(req.idempotency_key, request, prefix="auction-stripe")

    if req.package_id not in CREDIT_PACKAGES:
        raise HTTPException(status_code=400, detail="Invalid package")

    pkg = CREDIT_PACKAGES[req.package_id]
    price = float(pkg["price"])
    credits_amount = pkg["credits"]

    # One local pending purchase per client attempt.
    pending_hash = hashlib.sha256(idempotency_key.encode("utf-8")).hexdigest()[:20]
    pending_id = f"ACP-{pending_hash}"
    existing_pending = await db.pending_credit_purchases.find_one(
        {"pending_id": pending_id, "user_id": user_id},
        {"_id": 0},
    )
    if existing_pending and existing_pending.get("session_id") and existing_pending.get("checkout_url"):
        return {
            "checkout_url": existing_pending["checkout_url"],
            "session_id": existing_pending["session_id"],
            "pending_id": pending_id,
        }
    await db.pending_credit_purchases.update_one(
        {"pending_id": pending_id, "user_id": user_id},
        {"$setOnInsert": {
            "pending_id": pending_id,
            "user_id": user_id,
            "package_id": req.package_id,
            "credits": credits_amount,
            "price": price,
            "status": "pending",
            "idempotency_key": idempotency_key,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }},
        upsert=True,
    )

    # Build success/cancel URLs from frontend origin (security: never trust client amount)
    origin = request.headers.get("origin") or request.headers.get("referer") or "https://bidblitz.ae"
    origin = origin.rstrip("/")
    success_url = f"{origin}/auctions?credit_purchase={pending_id}&status=success&session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{origin}/auctions?credit_purchase={pending_id}&status=cancel"

    host_url = str(request.base_url).rstrip("/")
    webhook_url = f"{host_url}/api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)

    checkout_req = CheckoutSessionRequest(
        amount=price,
        currency="eur",
        success_url=success_url,
        cancel_url=cancel_url,
        metadata={
            "type": "bid_credits",
            "user_id": user_id,
            "pending_id": pending_id,
            "package_id": req.package_id,
            "credits": str(credits_amount),
        },
    )
    try:
        session = await stripe_checkout.create_checkout_session(checkout_req)
    except Exception as e:
        import logging as _logging
        _logging.getLogger("bidblitz.auctions").error(f"Stripe checkout creation failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Stripe-Fehler: {str(e)[:200]}")

    # Persist payment_transactions row (mandatory per playbook)
    await db.payment_transactions.update_one(
        {"session_id": session.session_id, "user_id": user_id},
        {"$setOnInsert": {
        "session_id": session.session_id,
        "pending_id": pending_id,
        "user_id": user_id,
        "amount": price,
        "currency": "eur",
        "metadata": {
            "type": "bid_credits",
            "pending_id": pending_id,
            "package_id": req.package_id,
            "credits": str(credits_amount),
            "idempotency_key": idempotency_key,
        },
        "payment_status": "initiated",
        "created_at": datetime.now(timezone.utc).isoformat(),
        }},
        upsert=True,
    )
    await db.pending_credit_purchases.update_one(
        {"pending_id": pending_id, "user_id": user_id},
        {"$set": {"session_id": session.session_id, "checkout_url": session.url}},
    )

    return {"checkout_url": session.url, "session_id": session.session_id, "pending_id": pending_id}


@router.post("/buy-credits-confirm/{pending_id}")
async def confirm_credit_purchase(pending_id: str, request: Request):
    """Compatibility endpoint: never grants credits without a verified Stripe settlement."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    pending = await db.pending_credit_purchases.find_one(
        {"pending_id": pending_id, "user_id": user_id},
        {"_id": 0},
    )
    if not pending:
        raise HTTPException(status_code=404, detail="Purchase not found")

    txn = await db.payment_transactions.find_one(
        {"pending_id": pending_id, "user_id": user_id},
        {"_id": 0},
    )
    if not txn or txn.get("payment_status") != "credited":
        raise HTTPException(
            status_code=409,
            detail="Stripe-Zahlung ist noch nicht verifiziert. Bitte Zahlungsstatus erneut prüfen.",
        )

    await db.pending_credit_purchases.update_one(
        {"pending_id": pending_id, "user_id": user_id},
        {"$set": {"status": "completed", "completed_at": datetime.now(timezone.utc).isoformat()}},
    )
    updated_user = await db.users.find_one({"_id": user["_id"]})
    return {
        "credits_added": int(pending.get("credits") or 0),
        "total_credits": updated_user.get("bid_credits", 0),
        "new_balance": updated_user.get("balance", 0),
        "verified": True,
    }


@router.get("/credits-purchase-status/{session_id}")
async def get_credits_purchase_status(session_id: str, request: Request):
    """Poll endpoint for frontend to check if a Stripe Checkout completed.
    Verifies payment status via Stripe + falls back to local DB state.
    """
    from emergentintegrations.payments.stripe.checkout import StripeCheckout
    from core.config import STRIPE_API_KEY

    user = await get_current_user(request)
    user_id = str(user["_id"])

    txn = await db.payment_transactions.find_one({"session_id": session_id, "user_id": user_id})
    if not txn:
        raise HTTPException(status_code=404, detail="Transaktion nicht gefunden")

    # Already credited locally → return success without hitting Stripe
    if txn.get("payment_status") == "credited":
        return {
            "status": "completed",
            "payment_status": "paid",
            "credits_added": int(txn.get("metadata", {}).get("credits", 0)) + int(txn.get("bonus_credits") or 0),
            "amount": txn.get("amount", 0),
        }

    # Otherwise check Stripe live to avoid waiting for webhook
    try:
        host_url = str(request.base_url).rstrip("/")
        webhook_url = f"{host_url}/api/webhook/stripe"
        stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
        status = await stripe_checkout.get_checkout_status(session_id)

        # Credit only after Stripe confirms paid. Credit grant is exactly-once and
        # the payment row is marked credited only after that grant is confirmed.
        if status.payment_status == "paid":
            fresh_txn = await db.payment_transactions.find_one(
                {"session_id": session_id, "user_id": user_id},
                {"_id": 0},
            ) or txn
            m = fresh_txn.get("metadata", {}) or {}
            credits_to_add = int(m.get("credits", 0))
            grant_key = f"stripe-session:{session_id}"
            _, grant_ok = await _grant_bid_credits_once(
                user["_id"],
                credits=credits_to_add,
                grant_key=grant_key,
                source="stripe_checkout_purchase",
                metadata={"session_id": session_id, "package_id": m.get("package_id")},
                cash_value_eur=float(CREDIT_PACKAGES.get(str(m.get("package_id")), {}).get("price") or 0.0),
            )
            if not grant_ok:
                await db.payment_transactions.update_one(
                    {"session_id": session_id, "user_id": user_id},
                    {"$set": {"payment_status": "reconciliation_required", "reconciliation_required_at": datetime.now(timezone.utc).isoformat()}},
                )
                raise HTTPException(status_code=500, detail="Stripe bezahlt, Credit-Gutschrift muss manuell geprüft werden.")

            had_previous_purchase = await _has_previous_credit_purchase(user_id)
            bonus = await _grant_first_purchase_bonus_once(user["_id"], eligible=not had_previous_purchase)
            now_completed = datetime.now(timezone.utc).isoformat()
            await db.payment_transactions.update_one(
                {"session_id": session_id, "user_id": user_id},
                {"$set": {
                    "payment_status": "credited",
                    "completed_at": now_completed,
                    "bonus_credits": bonus,
                }},
            )
            pending_id = fresh_txn.get("pending_id") or m.get("pending_id")
            if pending_id:
                await db.pending_credit_purchases.update_one(
                    {"pending_id": pending_id, "user_id": user_id},
                    {"$set": {"status": "completed", "completed_at": now_completed}},
                )

            purchase_ref = f"BIDS-S-{hashlib.sha256(session_id.encode('utf-8')).hexdigest()[:16].upper()}"
            purchase_doc = {
                "id": f"AUC-STRIPE-{hashlib.sha256(session_id.encode('utf-8')).hexdigest()[:20]}",
                "user_id": user_id,
                "type": "purchase",
                "amount": -float(fresh_txn.get("amount") or 0),
                "description": f"Bid Credits ({credits_to_add}x) — Stripe" + (f" + {bonus} Bonus" if bonus else ""),
                "status": "completed",
                "reference": purchase_ref,
                "payment_method": "stripe_checkout",
                "category": "auction",
                "stripe_session_id": session_id,
                "created_at": now_completed,
            }
            await db.transactions.update_one(
                {"user_id": user_id, "stripe_session_id": session_id, "type": "purchase"},
                {"$setOnInsert": purchase_doc},
                upsert=True,
            )

        return {
            "status": "completed" if status.payment_status == "paid" else "pending",
            "payment_status": status.payment_status,
            "credits_added": (
                int(txn.get("metadata", {}).get("credits", 0))
                + int((await db.payment_transactions.find_one({"session_id": session_id, "user_id": user_id}, {"bonus_credits": 1, "_id": 0}) or {}).get("bonus_credits") or 0)
            ) if status.payment_status == "paid" else 0,
            "amount": txn.get("amount", 0),
        }
    except Exception as e:
        import logging as _logging
        _logging.getLogger("bidblitz.auctions").error(f"Status check failed: {e}")
        return {"status": "pending", "payment_status": "unknown", "error": str(e)[:200]}


# ── Admin: Create auction ──
class CreateAuctionRequest(BaseModel):
    title: str = Field(..., min_length=2, max_length=200)
    description: Optional[str] = ""
    image_url: Optional[str] = ""
    retail_price: float = Field(..., gt=0, le=2000, description="Max €2000 retail price")
    duration_seconds: int = Field(default=172800, ge=172800, le=259200)
    start_now: bool = True
    bid_value_eur: float = Field(default=0.50, ge=0.01, le=10.0)
    price_increment: float = Field(default=0.01, ge=0.01, le=1.0)
    revenue_target_eur: float = Field(default=0.0, ge=0.0, le=100000.0)
    product_cost_eur: float = Field(default=0.0, ge=0.0, le=100000.0)
    shipping_cost_eur: float = Field(default=0.0, ge=0.0, le=10000.0)
    other_costs_eur: float = Field(default=0.0, ge=0.0, le=10000.0)
    target_net_profit_eur: float = Field(default=0.0, ge=0.0, le=100000.0)


@router.post("/admin/create")
async def create_auction(req: CreateAuctionRequest, request: Request):
    """Admin creates a new auction."""
    user = await get_current_user(request)
    if user.get("role") not in {"admin", "super_admin"}:
        raise HTTPException(status_code=403, detail="Admin only")

    now = datetime.now(timezone.utc)
    auction_id = secrets.token_hex(8)
    ends_at = (now + timedelta(seconds=req.duration_seconds)).isoformat()

    auction = {
        "auction_id": auction_id,
        "title": req.title.strip(),
        "description": (req.description or "").strip(),
        "image_url": req.image_url or "",
        "retail_price": req.retail_price,
        "starting_price": 0.01,
        "current_price": 0.01,
        "price_increment": round(float(req.price_increment), 2),
        "bid_value_eur": round(float(req.bid_value_eur), 2),
        "revenue_target_eur": round(float(req.revenue_target_eur), 2),
        "product_cost_eur": round(float(req.product_cost_eur), 2),
        "shipping_cost_eur": round(float(req.shipping_cost_eur), 2),
        "other_costs_eur": round(float(req.other_costs_eur), 2),
        "target_net_profit_eur": round(float(req.target_net_profit_eur), 2),
        "real_paid_bids": 0,
        "real_bid_revenue_eur": 0.0,
        "minimum_target_reached": req.target_net_profit_eur <= 0,
        "profit_guard_status": "target_not_met" if req.target_net_profit_eur > 0 else "not_enabled",
        "profit_guard_extensions": 0,
        "timer_extension": TIMER_EXTENSION_SECONDS,
        "duration_seconds": req.duration_seconds,
        "ends_at": ends_at if req.start_now else "",
        "status": "active" if req.start_now else "upcoming",
        "winner_id": None,
        "winner_name": None,
        "last_bidder_id": None,
        "last_bidder_name": None,
        "total_bids": 0,
        "created_by": str(user["_id"]),
        "created_at": now.isoformat(),
    }
    await db.auctions.insert_one(auction)
    auction.pop("_id", None)

    return {"auction": auction}


# ══════════════════════════════════════════════════════
# Product Catalog — Easy to update by admin
# Keep this list current with trending, high-demand items
# Last updated: April 2026
# ══════════════════════════════════════════════════════

# Product images mapped by title
PRODUCT_IMAGES = {
    "Samsung Galaxy S26 Ultra": "https://images.unsplash.com/photo-1773414422164-eefdc240da58?w=600&h=400&fit=crop&q=80",
    "iPhone 17 Pro Max": "https://images.unsplash.com/photo-1769594362058-d561f024a235?w=600&h=400&fit=crop&q=80",
    "Google Pixel 10 Pro": "https://images.unsplash.com/photo-1639885339994-59a8ffd15bdb?w=600&h=400&fit=crop&q=80",
    "Nintendo Switch 2": "https://images.unsplash.com/photo-1761395013766-8416415b0207?w=600&h=400&fit=crop&q=80",
    "PlayStation 5 Pro": "https://images.unsplash.com/photo-1693929291343-f38cb7519d5d?w=600&h=400&fit=crop&q=80",
    "AirPods Pro 3": "https://images.unsplash.com/photo-1677346414290-d337cbc682a6?w=600&h=400&fit=crop&q=80",
    "Sony WH-1000XM6": "https://images.unsplash.com/photo-1748792321323-25d97044ba2c?w=600&h=400&fit=crop&q=80",
    "Apple Watch Ultra 3": "https://images.unsplash.com/photo-1585823339274-26b392cefe45?w=600&h=400&fit=crop&q=80",
    "Samsung Galaxy Ring 2": "https://images.unsplash.com/photo-1760088348194-a5ac70a8aa9f?w=600&h=400&fit=crop&q=80",
    "MacBook Pro 16\" M5 Pro": "https://images.unsplash.com/photo-1627766556564-5d89b3765c46?w=600&h=400&fit=crop&q=80",
    "iPad Pro 13\" M5": "https://images.unsplash.com/photo-1622849030045-1f2c32ae3099?w=600&h=400&fit=crop&q=80",
    "Meta Quest 4": "https://images.unsplash.com/photo-1758523670318-f1b79559e1d1?w=600&h=400&fit=crop&q=80",
    "Dyson Airstrait Pro": "https://images.unsplash.com/photo-1629397683830-9805395892e8?w=600&h=400&fit=crop&q=80",
    "Roborock S9 MaxV Ultra": "https://images.unsplash.com/photo-1762859731349-c9ff2808b672?w=600&h=400&fit=crop&q=80",
    "Apple HomePod 3": "https://images.unsplash.com/photo-1617722694908-9be1092d1bc2?w=600&h=400&fit=crop&q=80",
    # NEW Premium Products - April 2026 (alle ≤ 3000€)
    "Razer Huntsman V3 Pro": "https://images.unsplash.com/photo-1645802106095-765b7e86f5bb?w=600&h=400&fit=crop&q=80",
    "Corsair K100 RGB": "https://images.unsplash.com/photo-1628089700970-0012c5718efc?w=600&h=400&fit=crop&q=80",
    "DJI Mavic 4 Pro": "https://images.unsplash.com/photo-1668836733970-9ed7e53cd2ca?w=600&h=400&fit=crop&q=80",
    "DJI Mini 4 Pro": "https://images.unsplash.com/photo-1773750923584-5c684563e0d9?w=600&h=400&fit=crop&q=80",
    "Segway Ninebot Max G3": "https://images.unsplash.com/photo-1737636255601-179dc7535116?w=600&h=400&fit=crop&q=80",
    "Xiaomi Electric Scooter 5": "https://images.unsplash.com/photo-1583322319396-08178ea4f8b3?w=600&h=400&fit=crop&q=80",
    "De'Longhi La Specialista": "https://images.unsplash.com/photo-1741113937337-1d0273bf941d?w=600&h=400&fit=crop&q=80",
    "Breville Barista Touch": "https://images.unsplash.com/photo-1635749269192-489bdda05932?w=600&h=400&fit=crop&q=80",
    "Sony A7 IV": "https://images.unsplash.com/photo-1637270871981-4b579f127c0c?w=600&h=400&fit=crop&q=80",
    "VanMoof S5": "https://images.unsplash.com/photo-1753092604434-8c0e6c3b50f0?w=600&h=400&fit=crop&q=80",
    "Cowboy 5": "https://images.unsplash.com/photo-1666360058702-a3aa07227c53?w=600&h=400&fit=crop&q=80",
    "Secretlab Titan Evo 2024": "https://images.unsplash.com/photo-1770195555068-37103df33bf8?w=600&h=400&fit=crop&q=80",
    "Herman Miller Embody Gaming": "https://images.unsplash.com/photo-1577239458058-b179bc7479bf?w=600&h=400&fit=crop&q=80",
    "Google Nest Audio": "https://images.unsplash.com/photo-1655976796910-b239b1a1a41c?w=600&h=400&fit=crop&q=80",
    "Sonos Era 300": "https://images.unsplash.com/photo-1655976797987-0fdbab9e7419?w=600&h=400&fit=crop&q=80",
    "Evolve GTR 2": "https://images.unsplash.com/photo-1611172016558-17e0da981759?w=600&h=400&fit=crop&q=80",
    "Boosted Board Mini X": "https://images.unsplash.com/photo-1659337162301-37d9e1289eac?w=600&h=400&fit=crop&q=80",
    "Samsung Odyssey G9 49\"": "https://images.unsplash.com/photo-1632064824547-e77c36851495?w=600&h=400&fit=crop&q=80",
    "LG UltraGear 45GR95QE": "https://images.unsplash.com/photo-1582736317407-371893d9e146?w=600&h=400&fit=crop&q=80",
    "XGIMI Horizon Ultra": "https://images.unsplash.com/photo-1620764701841-b584378ee8fd?w=600&h=400&fit=crop&q=80",
    "Samsung Freestyle 2": "https://images.unsplash.com/photo-1750994700257-133c7fdb0c7a?w=600&h=400&fit=crop&q=80",
    "Theragun Pro Plus": "https://images.unsplash.com/photo-1746278925416-9d6c71f55c2d?w=600&h=400&fit=crop&q=80",
    "Hyperice Hypervolt 2 Pro": "https://images.unsplash.com/photo-1611908200005-b898ddde09cf?w=600&h=400&fit=crop&q=80",
    # 8 NEW Premium-Products (April 2026)
    "Bose QuietComfort Ultra": "https://images.unsplash.com/photo-1545127398-14699f92334b?w=600&h=400&fit=crop&q=80",
    "GoPro Hero 13 Black": "https://images.unsplash.com/photo-1606857521015-7f9fcf423740?w=600&h=400&fit=crop&q=80",
    "Kindle Scribe 2": "https://images.unsplash.com/photo-1592434134753-a70baf7979d5?w=600&h=400&fit=crop&q=80",
    "Lego Star Wars Millennium Falcon UCS": "https://images.unsplash.com/photo-1577375727119-be4eea3e6a40?w=600&h=400&fit=crop&q=80",
    "Bose Soundbar Ultra": "https://images.unsplash.com/photo-1545454675-3531b543be5d?w=600&h=400&fit=crop&q=80",
    "Apple Vision Pro": "https://images.unsplash.com/photo-1707347988076-6e62b54e7e1d?w=600&h=400&fit=crop&q=80",
    "Samsung Galaxy Tab S10 Ultra": "https://images.unsplash.com/photo-1561154464-82e9adf32764?w=600&h=400&fit=crop&q=80",
    "iRobot Roomba j7+ Combo": "https://images.unsplash.com/photo-1558317374-067fb5f30001?w=600&h=400&fit=crop&q=80",
}


def resolve_product_image(title: str, current: str = "") -> str:
    text = (title or "").lower()
    explicit_map = [
        (["iphone 17 pro max"], SMARTPHONE_GALLERY[0]),
        (["samsung galaxy s26 ultra"], SMARTPHONE_GALLERY[1]),
        (["google pixel 10 pro"], SMARTPHONE_GALLERY[2]),
        (["xiaomi 16 ultra"], SMARTPHONE_GALLERY[3]),
        (["macbook pro m6 max"], LAPTOP_GALLERY[0]),
        (["dell xps 17"], LAPTOP_GALLERY[1]),
        (["lenovo yoga pro 9i"], LAPTOP_GALLERY[2]),
        (["asus rog zephyrus"], LAPTOP_GALLERY[3]),
    ]
    for keywords, image in explicit_map:
        if any(keyword in text for keyword in keywords):
            return image
    if current and str(current).strip():
        return current
    if title in PRODUCT_IMAGES:
        return PRODUCT_IMAGES[title]
    if any(k in text for k in ["iphone", "galaxy", "pixel", "phone", "smartphone", "xiaomi", "oneplus", "honor", "watch", "ipad", "tablet", "kindle"]):
        if any(k in text for k in ["watch", "fenix", "garmin"]):
            return "https://images.unsplash.com/photo-1638095562082-449d8c5a47b4?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1NzR8MHwxfHNlYXJjaHwxfHxzbWFydHdhdGNoJTIwcHJvZHVjdCUyMHN0dWRpb3xlbnwwfHx8fDE3NzkyNzAwOTB8MA&ixlib=rb-4.1.0&q=85"
        return "https://images.unsplash.com/photo-1697636979311-511164585ca9?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA3MDB8MHwxfHNlYXJjaHwxfHxzbWFydHBob25lJTIwcHJvZHVjdCUyMHN0dWRpb3xlbnwwfHx8fDE3NzkyMjE2NzR8MA&ixlib=rb-4.1.0&q=85"
    if any(k in text for k in ["switch", "playstation", "xbox", "console"]):
        return "https://images.pexels.com/photos/15822009/pexels-photo-15822009.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940"
    if any(k in text for k in ["louis vuitton", "chanel", "gucci", "prada", "dior", "bag", "neverfull", "flap", "marmont", "galleria", "lady d-joy"]):
        return "https://images.unsplash.com/photo-1575403538007-acb790100421?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDk1ODF8MHwxfHNlYXJjaHwxfHxsdXh1cnklMjBoYW5kYmFnJTIwcHJvZHVjdHxlbnwwfHx8fDE3NzkyNzAwOTB8MA&ixlib=rb-4.1.0&q=85"
    if any(k in text for k in ["nike", "adidas", "yeezy", "jordan", "sneaker", "shoe"]):
        return "https://images.pexels.com/photos/12628400/pexels-photo-12628400.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940"
    if any(k in text for k in ["dyson", "ghd", "airwrap", "styler", "beauty"]):
        return "https://images.pexels.com/photos/3993449/pexels-photo-3993449.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940"
    if any(k in text for k in ["quest", "vision pro", "xr", "vr"]):
        return "https://images.pexels.com/photos/4523094/pexels-photo-4523094.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940"
    if any(k in text for k in ["airpods", "bose", "sony", "headphone", "soundbar", "earbud"]):
        return "https://images.unsplash.com/photo-1557315360-6a350ab4eccd?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1OTN8MHwxfHNlYXJjaHwxfHxoZWFkcGhvbmVzJTIwcHJvZHVjdCUyMHN0dWRpb3xlbnwwfHx8fDE3NzkyMjE2NzN8MA&ixlib=rb-4.1.0&q=85"
    if any(k in text for k in ["macbook", "laptop", "notebook", "monitor"]):
        return "https://images.pexels.com/photos/129205/pexels-photo-129205.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940"
    if any(k in text for k in ["scooter", "segway", "ninebot", "boosted", "board"]):
        return "https://images.unsplash.com/photo-1597260491619-bab87197869f?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjY2NzV8MHwxfHNlYXJjaHwxfHxlbGVjdHJpYyUyMHNjb290ZXIlMjBwcm9kdWN0fGVufDB8fHx8MTc3OTIyMTY3NHww&ixlib=rb-4.1.0&q=85"
    if any(k in text for k in ["camera", "gopro", "sony a7"]):
        return "https://images.unsplash.com/photo-1581017232414-4bb1668e8349?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NTYxNzV8MHwxfHNlYXJjaHwxfHxjYW1lcmElMjBwcm9kdWN0JTIwc3R1ZGlvfGVufDB8fHx8MTc3OTIyMTY3NHww&ixlib=rb-4.1.0&q=85"
    if any(k in text for k in ["coffee", "barista", "espresso", "delonghi", "breville"]):
        return "https://images.pexels.com/photos/30298107/pexels-photo-30298107.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940"
    if any(k in text for k in ["roborock", "irobot", "roomba", "vacuum"]):
        return "https://images.unsplash.com/photo-1765970101376-4d5153f56e81?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1NTJ8MHwxfHNlYXJjaHwxfHxyb2JvdCUyMHZhY3V1bSUyMHByb2R1Y3R8ZW58MHx8fHwxNzc5MjcwMDkwfDA&ixlib=rb-4.1.0&q=85"
    if any(k in text for k in ["speaker", "homepod", "sonos", "nest", "audio"]):
        return "https://images.pexels.com/photos/14309814/pexels-photo-14309814.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940"
    if any(k in text for k in ["chair", "secretlab", "herman miller"]):
        return "https://images.unsplash.com/photo-1770195483917-b3bb444b7a29?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2Njl8MHwxfHNlYXJjaHwxfHxnYW1pbmclMjBjaGFpciUyMHByb2R1Y3QlMjBzdHVkaW98ZW58MHx8fHwxNzc5MjIxNjg5fDA&ixlib=rb-4.1.0&q=85"
    if any(k in text for k in ["drone", "dji", "mavic", "mini 4"]):
        return "https://images.unsplash.com/photo-1649857114280-0df8879c9034?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1NzR8MHwxfHNlYXJjaHwxfHxkcm9uZSUyMHByb2R1Y3QlMjBzdHVkaW98ZW58MHx8fHwxNzc5MjIxNjg4fDA&ixlib=rb-4.1.0&q=85"
    if any(k in text for k in ["boat", "boot", "yacht", "marine", "jetski", "jet ski", "tender", "kayak", "sup", "wake"]):
        return "https://images.unsplash.com/photo-1500375592092-40eb2168fd21?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NzY2MXwwfDF8c2VhcmNofDF8fGJvYXQlMjBvbiUyMHdhdGVyfGVufDB8fHx8MTc0ODI2MjQwMHww&ixlib=rb-4.1.0&q=85"
    if any(k in text for k in ["bike", "vanmoof", "cowboy"]):
        return "https://images.unsplash.com/photo-1666360058702-a3aa07227c53?w=600&h=400&fit=crop&q=80"
    if current:
        return current
    return "https://images.pexels.com/photos/5412270/pexels-photo-5412270.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940"


def resolve_product_gallery(title: str, image_urls: list | None = None, image_url: str = "") -> list[str]:
    title_text = (title or "").lower()
    explicit_gallery_map = [
        (["iphone 17 pro max"], SMARTPHONE_GALLERY),
        (["samsung galaxy s26 ultra"], list(reversed(SMARTPHONE_GALLERY))),
        (["google pixel 10 pro"], SMARTPHONE_GALLERY[2:] + SMARTPHONE_GALLERY[:2]),
        (["xiaomi 16 ultra"], SMARTPHONE_GALLERY[3:] + SMARTPHONE_GALLERY[:3]),
        (["macbook pro m6 max"], LAPTOP_GALLERY),
        (["dell xps 17"], LAPTOP_GALLERY[1:] + LAPTOP_GALLERY[:1]),
        (["lenovo yoga pro 9i"], LAPTOP_GALLERY[2:] + LAPTOP_GALLERY[:2]),
        (["asus rog zephyrus"], LAPTOP_GALLERY[3:] + LAPTOP_GALLERY[:3]),
    ]
    for keywords, gallery in explicit_gallery_map:
        if any(keyword in title_text for keyword in keywords):
            primary = resolve_product_image(title, image_url or "")
            ordered = [primary] + [img for img in gallery if img != primary]
            return ordered[:4]

    candidates = []
    for img in (image_urls or []):
        resolved = resolve_product_image(title, img or "")
        if resolved and resolved not in candidates:
            candidates.append(resolved)

    curated_map = [
        (["iphone", "galaxy", "pixel", "xiaomi", "oneplus", "smartphone", "phone"], SMARTPHONE_GALLERY),
        (["macbook", "laptop", "notebook", "xps", "zephyrus", "yoga"], LAPTOP_GALLERY),
        (["ipad", "tablet", "surface", "pad"], TABLET_GALLERY),
        (["quest", "vision", "xr", "vive", "headset", "vr"], VR_GALLERY),
        (["drone", "mavic", "autel", "skydio", "karma"], DRONE_GALLERY),
        (["vanmoof", "cowboy", "stromer", "e-bike", "ebike", "bike"], EBIKE_GALLERY),
        (["scooter", "segway", "xiaomi scooter"], ESCOOTER_GALLERY),
        (["monitor", "odyssey", "ultragear"], MONITOR_GALLERY),
        (["roborock", "irobot", "roomba", "robot"], ROBOT_GALLERY),
    ]
    for keywords, gallery in curated_map:
        if any(keyword in title_text for keyword in keywords):
            for img in gallery:
                if img and img not in candidates:
                    candidates.append(img)
            break

    primary = resolve_product_image(title, image_url or "")
    if primary:
        if primary in candidates:
            candidates.remove(primary)
        candidates.insert(0, primary)
    return candidates[:4]


def infer_product_image_profile(title: str = "", category: str = "") -> str:
    text = f"{title} {category}".lower()
    if any(token in text for token in ["e-bike", "ebike", "vanmoof", "cowboy", "stromer", "bike"]):
        return "e-bike"
    if any(token in text for token in ["macbook", "laptop", "notebook", "xps", "surface"]):
        return "laptop"
    if any(token in text for token in ["roborock", "roomba", "robot", "vacuum"]):
        return "robot-vacuum"
    if any(token in text for token in ["iphone", "galaxy", "pixel", "smartphone", "phone"]):
        return "smartphone"
    if any(token in text for token in ["tv", "television", "oled", "monitor"]):
        return "television"
    if any(token in text for token in ["playstation", "xbox", "switch", "console"]):
        return "gaming-console"
    if any(token in text for token in ["coffee", "appliance", "washer", "dryer"]):
        return "household-appliance"
    return (category or "general").lower()


def classify_image_reference(value: str = "") -> str:
    text = (value or "").lower()
    if any(token in text for token in ["motorcycle", "motorbike", "harley", "yamaha", "honda"]):
        return "motorcycle"
    if any(token in text for token in ["bike", "bicycle", "ebike", "e-bike", "vanmoof", "cowboy", "stromer"]):
        return "e-bike"
    if any(token in text for token in ["macbook", "laptop", "notebook", "surface", "xps"]):
        return "laptop"
    if any(token in text for token in ["roborock", "roomba", "robot", "vacuum"]):
        return "robot-vacuum"
    if any(token in text for token in ["iphone", "galaxy", "pixel", "smartphone", "phone"]):
        return "smartphone"
    if any(token in text for token in ["television", "tv", "oled", "monitor"]):
        return "television"
    if any(token in text for token in ["playstation", "xbox", "switch", "console"]):
        return "gaming-console"
    if any(token in text for token in ["coffee", "appliance", "washer", "dryer"]):
        return "household-appliance"
    return "product"


def get_verified_gallery_for_profile(profile: str) -> list[str]:
    galleries = {
        "e-bike": EBIKE_GALLERY,
        "laptop": LAPTOP_GALLERY,
        "robot-vacuum": ROBOT_GALLERY,
        "smartphone": SMARTPHONE_GALLERY,
        "television": MONITOR_GALLERY,
        "gaming-console": [],
        "household-appliance": [],
    }
    return galleries.get(profile, [])


def enrich_auction_visual_image_data(auction: dict) -> dict:
    title = auction.get("title", "")
    profile = infer_product_image_profile(title, auction.get("category", ""))
    verified_gallery = get_verified_gallery_for_profile(profile)
    raw_gallery = [auction.get("image_url", ""), *(auction.get("image_urls") or [])]
    gallery = [url for url in raw_gallery if url]
    visible_urls: list[str] = []
    removed_urls: list[str] = []
    manual_review_required = False

    for url in gallery:
        detected = classify_image_reference(f"{title} {url}")
        forbidden_high_confidence = profile == "e-bike" and detected == "motorcycle"
        if forbidden_high_confidence:
            removed_urls.append(url)
            continue
        if profile in {"e-bike", "laptop", "robot-vacuum", "smartphone", "television", "gaming-console", "household-appliance"} and detected not in {"product", profile}:
            manual_review_required = True
        if url not in visible_urls:
            visible_urls.append(url)

    for fallback_url in verified_gallery:
        if len(visible_urls) >= 4:
            break
        if fallback_url and fallback_url not in visible_urls:
            visible_urls.append(fallback_url)

    visible_urls = visible_urls[:4]
    primary_url = visible_urls[0] if visible_urls else auction.get("image_url", "")
    primary_verified = primary_url in verified_gallery if primary_url else False
    primary_confidence = 0.99 if primary_verified else (0.78 if manual_review_required else 0.91)

    gallery_meta = []
    for url in visible_urls:
        verified = url in verified_gallery if verified_gallery else not manual_review_required
        confidence = 0.99 if verified else (0.74 if manual_review_required else 0.9)
        gallery_meta.append({
            "productId": auction.get("auction_id") or auction.get("id") or "unknown",
            "productTitle": title,
            "productCategory": profile,
            "imageCategory": classify_image_reference(f"{title} {url}"),
            "imageUrl": url,
            "verified": verified,
            "confidence": confidence,
        })

    auction["image_url"] = primary_url
    auction["image_urls"] = visible_urls
    auction["product_id"] = auction.get("auction_id") or auction.get("id") or "unknown"
    auction["product_title"] = title
    auction["product_category"] = profile
    auction["image_category"] = classify_image_reference(f"{title} {primary_url}")
    auction["image_source"] = "verified-gallery" if primary_verified else "catalog"
    auction["image_verified"] = primary_verified
    auction["image_confidence"] = primary_confidence
    auction["image_manual_review_required"] = manual_review_required
    auction["image_removed_urls"] = removed_urls
    auction["image_gallery_meta"] = gallery_meta
    return auction

import json
import os
from pathlib import Path

# Load product catalog from JSON file
_catalog_path = Path(__file__).parent.parent / "data" / "product_catalog.json"
with open(_catalog_path, 'r', encoding='utf-8') as f:
    PRODUCT_CATALOG = json.load(f)

# Enforce €2000 retail-price cap globally — no bot/seed/listing may exceed this.
PRODUCT_CATALOG = [p for p in PRODUCT_CATALOG if (p.get("retail_price") or 0) <= 2000]

# Curated 2026-only premium tech lineup (exactly 30 products for active penny auctions)
SMARTPHONE_GALLERY = [
    "https://images.unsplash.com/photo-1517777298614-cb6eefb19fad?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDQ2MzR8MHwxfHNlYXJjaHw0fHxmbGFnc2hpcCUyMHNtYXJ0cGhvbmV8ZW58MHx8fHwxNzgzNzQ0MTUzfDA&ixlib=rb-4.1.0&q=85",
    "https://images.unsplash.com/photo-1544866092-1935c5ef2a8f?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDQ2MzR8MHwxfHNlYXJjaHwyfHxmbGFnc2hpcCUyMHNtYXJ0cGhvbmV8ZW58MHx8fHwxNzgzNzQ0MTUzfDA&ixlib=rb-4.1.0&q=85",
    "https://images.unsplash.com/photo-1480694313141-fce5e697ee25?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDQ2MzR8MHwxfHNlYXJjaHwxfHxmbGFnc2hpcCUyMHNtYXJ0cGhvbmV8ZW58MHx8fHwxNzgzNzQ0MTUzfDA&ixlib=rb-4.1.0&q=85",
    "https://images.unsplash.com/photo-1617696992381-16b65f34b3b1?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDQ2MzR8MHwxfHNlYXJjaHwzfHxmbGFnc2hpcCUyMHNtYXJ0cGhvbmV8ZW58MHx8fHwxNzgzNzQ0MTUzfDA&ixlib=rb-4.1.0&q=85",
]

LAPTOP_GALLERY = [
    "https://images.unsplash.com/photo-1511385348-a52b4a160dc2?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1OTN8MHwxfHNlYXJjaHw0fHxwcmVtaXVtJTIwbGFwdG9wfGVufDB8fHx8MTc4Mzc0NDE1M3ww&ixlib=rb-4.1.0&q=85",
    "https://images.unsplash.com/photo-1593642702821-c8da6771f0c6?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1OTN8MHwxfHNlYXJjaHwzfHxwcmVtaXVtJTIwbGFwdG9wfGVufDB8fHx8MTc4Mzc0NDE1M3ww&ixlib=rb-4.1.0&q=85",
    "https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1OTN8MHwxfHNlYXJjaHwyfHxwcmVtaXVtJTIwbGFwdG9wfGVufDB8fHx8MTc4Mzc0NDE1M3ww&ixlib=rb-4.1.0&q=85",
    "https://images.unsplash.com/photo-1541807084-5c52b6b3adef?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1OTN8MHwxfHNlYXJjaHwxfHxwcmVtaXVtJTIwbGFwdG9wfGVufDB8fHx8MTc4Mzc0NDE1M3ww&ixlib=rb-4.1.0&q=85",
]

DRONE_GALLERY = [
    "https://images.unsplash.com/photo-1527977966376-1c8408f9f108?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2Njd8MHwxfHNlYXJjaHw0fHxjYW1lcmElMjBkcm9uZXxlbnwwfHx8fDE3ODM3NDQxNTN8MA&ixlib=rb-4.1.0&q=85",
    "https://images.unsplash.com/photo-1521405924368-64c5b84bec60?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2Njd8MHwxfHNlYXJjaHwyfHxjYW1lcmElMjBkcm9uZXxlbnwwfHx8fDE3ODM3NDQxNTN8MA&ixlib=rb-4.1.0&q=85",
    "https://images.unsplash.com/photo-1473968512647-3e447244af8f?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2Njd8MHwxfHNlYXJjaHwxfHxjYW1lcmElMjBkcm9uZXxlbnwwfHx8fDE3ODM3NDQxNTN8MA&ixlib=rb-4.1.0&q=85",
    "https://images.unsplash.com/photo-1507582020474-9a35b7d455d9?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2Njd8MHwxfHNlYXJjaHwzfHxjYW1lcmElMjBkcm9uZXxlbnwwfHx8fDE3ODM3NDQxNTN8MA&ixlib=rb-4.1.0&q=85",
]

VR_GALLERY = [
    "https://images.unsplash.com/photo-1593508512255-86ab42a8e620?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NTYxODd8MHwxfHNlYXJjaHwxfHx2ciUyMGhlYWRzZXR8ZW58MHx8fHwxNzgzNzQ0MTUzfDA&ixlib=rb-4.1.0&q=85",
    "https://images.unsplash.com/photo-1576633587382-13ddf37b1fc1?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NTYxODd8MHwxfHNlYXJjaHwzfHx2ciUyMGhlYWRzZXR8ZW58MHx8fHwxNzgzNzQ0MTUzfDA&ixlib=rb-4.1.0&q=85",
    "https://images.unsplash.com/photo-1653158861306-e5b3804f6115?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NTYxODd8MHwxfHNlYXJjaHw0fHx2ciUyMGhlYWRzZXR8ZW58MHx8fHwxNzgzNzQ0MTUzfDA&ixlib=rb-4.1.0&q=85",
    "https://images.unsplash.com/photo-1622979135225-d2ba269cf1ac?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NTYxODd8MHwxfHNlYXJjaHwyfHx2ciUyMGhlYWRzZXR8ZW58MHx8fHwxNzgzNzQ0MTUzfDA&ixlib=rb-4.1.0&q=85",
]

EBIKE_GALLERY = [
    "https://images.unsplash.com/photo-1558981403-c5f9899a28bc?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1ODh8MHwxfHNlYXJjaHwxfHxlbGVjdHJpYyUyMGJpa2V8ZW58MHx8fHwxNzgzNzQ0MTUzfDA&ixlib=rb-4.1.0&q=85",
    "https://images.unsplash.com/photo-1621394445346-c7b502f07206?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1ODh8MHwxfHNlYXJjaHw0fHxlbGVjdHJpYyUyMGJpa2V8ZW58MHx8fHwxNzgzNzQ0MTUzfDA&ixlib=rb-4.1.0&q=85",
    "https://images.unsplash.com/photo-1620802051782-725fa33db067?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1ODh8MHwxfHNlYXJjaHwyfHxlbGVjdHJpYyUyMGJpa2V8ZW58MHx8fHwxNzgzNzQ0MTUzfDA&ixlib=rb-4.1.0&q=85",
    "https://images.unsplash.com/photo-1624243519828-52a0f2c88af3?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1ODh8MHwxfHNlYXJjaHwzfHxlbGVjdHJpYyUyMGJpa2V8ZW58MHx8fHwxNzgzNzQ0MTUzfDA&ixlib=rb-4.1.0&q=85",
]

MONITOR_GALLERY = [
    "https://images.unsplash.com/photo-1626218174358-7769486c4b79?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzMjd8MHwxfHNlYXJjaHwzfHxnYW1pbmclMjBtb25pdG9yfGVufDB8fHx8MTc4Mzc0NDE1M3ww&ixlib=rb-4.1.0&q=85",
    "https://images.unsplash.com/photo-1593305841991-05c297ba4575?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzMjd8MHwxfHNlYXJjaHwyfHxnYW1pbmclMjBtb25pdG9yfGVufDB8fHx8MTc4Mzc0NDE1M3ww&ixlib=rb-4.1.0&q=85",
    "https://images.unsplash.com/photo-1534423861386-85a16f5d13fd?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzMjd8MHwxfHNlYXJjaHwxfHxnYW1pbmclMjBtb25pdG9yfGVufDB8fHx8MTc4Mzc0NDE1M3ww&ixlib=rb-4.1.0&q=85",
    "https://images.unsplash.com/photo-1614179924047-e1ab49a0a0cf?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzMjd8MHwxfHNlYXJjaHw0fHxnYW1pbmclMjBtb25pdG9yfGVufDB8fHx8MTc4Mzc0NDE1M3ww&ixlib=rb-4.1.0&q=85",
]

ROBOT_GALLERY = [
    "https://images.unsplash.com/photo-1558317374-067fb5f30001?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1OTN8MHwxfHNlYXJjaHwxfHxyb2JvdCUyMHZhY3V1bXxlbnwwfHx8fDE3ODM3NDQxNTN8MA&ixlib=rb-4.1.0&q=85",
    "https://images.unsplash.com/photo-1647940990395-967898eb0d65?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1OTN8MHwxfHNlYXJjaHw0fHxyb2JvdCUyMHZhY3V1bXxlbnwwfHx8fDE3ODM3NDQxNTN8MA&ixlib=rb-4.1.0&q=85",
    "https://images.unsplash.com/photo-1600322305530-45714a0bc945?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1OTN8MHwxfHNlYXJjaHwyfHxyb2JvdCUyMHZhY3V1bXxlbnwwfHx8fDE3ODM3NDQxNTN8MA&ixlib=rb-4.1.0&q=85",
    "https://images.unsplash.com/photo-1653990480360-31a12ce9723e?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1OTN8MHwxfHNlYXJjaHwzfHxyb2JvdCUyMHZhY3V1bXxlbnwwfHx8fDE3ODM3NDQxNTN8MA&ixlib=rb-4.1.0&q=85",
]

TABLET_GALLERY = [
    "https://images.unsplash.com/photo-1781275371057-d9501eeaff66?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2Njd8MHwxfHNlYXJjaHwzfHxwcmVtaXVtJTIwdGFibGV0fGVufDB8fHx8MTc4Mzc0NDE1M3ww&ixlib=rb-4.1.0&q=85",
    "https://images.unsplash.com/photo-1760587162690-95608c8ab2da?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2Njd8MHwxfHNlYXJjaHw0fHxwcmVtaXVtJTIwdGFibGV0fGVufDB8fHx8MTc4Mzc0NDE1M3ww&ixlib=rb-4.1.0&q=85",
    "https://images.unsplash.com/photo-1766241632552-55675149f22a?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2Njd8MHwxfHNlYXJjaHwyfHxwcmVtaXVtJTIwdGFibGV0fGVufDB8fHx8MTc4Mzc0NDE1M3ww&ixlib=rb-4.1.0&q=85",
    "https://images.unsplash.com/photo-1652862938332-815e45390b3c?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2Njd8MHwxfHNlYXJjaHwxfHxwcmVtaXVtJTIwdGFibGV0fGVufDB8fHx8MTc4Mzc0NDE1M3ww&ixlib=rb-4.1.0&q=85",
]

ESCOOTER_GALLERY = [
    "https://images.unsplash.com/photo-1654748646458-056253a82853?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzNDR8MHwxfHNlYXJjaHwzfHxlbGVjdHJpYyUyMHNjb290ZXJ8ZW58MHx8fHwxNzgzNzQ0MTUzfDA&ixlib=rb-4.1.0&q=85",
    "https://images.unsplash.com/photo-1565300480288-deb407e6ae15?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzNDR8MHwxfHNlYXJjaHwxfHxlbGVjdHJpYyUyMHNjb290ZXJ8ZW58MHx8fHwxNzgzNzQ0MTUzfDA&ixlib=rb-4.1.0&q=85",
    "https://images.unsplash.com/photo-1591122519484-70428711810d?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzNDR8MHwxfHNlYXJjaHw0fHxlbGVjdHJpYyUyMHNjb290ZXJ8ZW58MHx8fHwxNzgzNzQ0MTUzfDA&ixlib=rb-4.1.0&q=85",
    "https://images.unsplash.com/photo-1597260491619-bab87197869f?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzNDR8MHwxfHNlYXJjaHwyfHxlbGVjdHJpYyUyMHNjb290ZXJ8ZW58MHx8fHwxNzgzNzQ0MTUzfDA&ixlib=rb-4.1.0&q=85",
]

ACTIVE_AUCTION_CATALOG = [
    {"title": "iPhone 17 Pro Max 2026", "description": "Apple 2026 Flagship mit Titanium Body, 8K Pro Camera und AI Studio Features.", "retail_price": 1999, "category": "phones", "image_url": SMARTPHONE_GALLERY[0], "image_urls": SMARTPHONE_GALLERY[:4], "features": ["8K Pro-Kamera", "Titan-Gehäuse", "Always-on Studio Display"]},
    {"title": "Samsung Galaxy S26 Ultra Elite 2026", "description": "Samsung Ultra-Flaggschiff 2026 mit AI Zoom, Stylus und Nightography Pro.", "retail_price": 1899, "category": "phones", "image_url": SMARTPHONE_GALLERY[1], "image_urls": SMARTPHONE_GALLERY[:4], "features": ["200 MP AI Zoom", "S-Pen Elite", "Adaptive Vision Display"]},
    {"title": "Google Pixel 10 Pro XL 2026", "description": "Pixel-Topmodell 2026 mit Tensor AI, Profi-Kamera und smarter Bildbearbeitung.", "retail_price": 1499, "category": "phones", "image_url": SMARTPHONE_GALLERY[2], "image_urls": SMARTPHONE_GALLERY[:4], "features": ["Tensor AI", "Night Sight Pro", "Instant Studio Edit"]},
    {"title": "Xiaomi 16 Ultra Max 2026", "description": "Premium Android-Smartphone 2026 mit Leica-Look, großem Sensor und Fast Charge.", "retail_price": 1399, "category": "phones", "image_url": SMARTPHONE_GALLERY[3], "image_urls": SMARTPHONE_GALLERY[:4], "features": ["Leica Kamera-System", "HyperCharge", "WQHD+ AMOLED"]},
    {"title": "MacBook Pro M6 Max 16 2026", "description": "Apple Creator-Notebook 2026 mit maximaler Performance für Video, AI und Design.", "retail_price": 1999, "category": "laptops", "image_url": LAPTOP_GALLERY[0], "image_urls": LAPTOP_GALLERY[:4], "features": ["M6 Max Chip", "Liquid Retina XDR", "Studio-Class Performance"]},
    {"title": "Dell XPS 17 OLED 2026", "description": "High-End Ultrabook 2026 mit OLED, Aluminium-Chassis und Creator-Fokus.", "retail_price": 1899, "category": "laptops", "image_url": LAPTOP_GALLERY[1], "image_urls": LAPTOP_GALLERY[:4], "features": ["4K OLED", "Premium Aluminium", "RTX Creator Graphics"]},
    {"title": "Lenovo Yoga Pro 9i 2026", "description": "Lenovo Premium Laptop 2026 für mobile Pros mit AI-Creation-Engine.", "retail_price": 1699, "category": "laptops", "image_url": LAPTOP_GALLERY[2], "image_urls": LAPTOP_GALLERY[:4], "features": ["Mini-LED Display", "AI Boost Engine", "Pro Audio"]},
    {"title": "ASUS ROG Zephyrus G16 2026", "description": "Gaming- und Creator-Notebook 2026 mit High-Refresh OLED und RTX Power.", "retail_price": 1799, "category": "laptops", "image_url": LAPTOP_GALLERY[3], "image_urls": LAPTOP_GALLERY[:4], "features": ["240Hz OLED", "RTX Performance", "Advanced Cooling"]},
    {"title": "iPad Pro M6 13 2026", "description": "Apple Tablet-Flaggschiff 2026 für Design, Productivity und Entertainment.", "retail_price": 1499, "category": "tablets", "image_url": TABLET_GALLERY[0], "image_urls": TABLET_GALLERY[:4], "features": ["M6 Performance", "Ultra Retina XDR", "Apple Pencil Pro Ready"]},
    {"title": "Samsung Galaxy Tab S11 Ultra 2026", "description": "Samsung Premium-Tablet 2026 mit riesigem AMOLED-Display und Desktop-Modus.", "retail_price": 1299, "category": "tablets", "image_url": TABLET_GALLERY[1], "image_urls": TABLET_GALLERY[:4], "features": ["AMOLED Ultra", "DeX Desktop", "S-Pen Included"]},
    {"title": "Microsoft Surface Pro 11 Elite 2026", "description": "Surface-Topmodell 2026 für mobile Business- und Kreativ-Workflows.", "retail_price": 1499, "category": "tablets", "image_url": TABLET_GALLERY[2], "image_urls": TABLET_GALLERY[:4], "features": ["Copilot AI", "Kickstand Pro", "Flex Keyboard"]},
    {"title": "OnePlus Pad 3 Pro 2026", "description": "High-End Android-Tablet 2026 mit schnellem Laden und starkem Media-Erlebnis.", "retail_price": 1099, "category": "tablets", "image_url": TABLET_GALLERY[3], "image_urls": TABLET_GALLERY[:4], "features": ["144Hz Display", "SuperVOOC Charge", "Quad Speakers"]},
    {"title": "PlayStation 6 Founder Edition 2026", "description": "Next-gen Konsole 2026 mit Raytracing 2.0 und extrem schneller Lade-Performance.", "retail_price": 1199, "category": "gaming", "image_url": "https://images.pexels.com/photos/15822009/pexels-photo-15822009.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940", "image_urls": ["https://images.pexels.com/photos/15822009/pexels-photo-15822009.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940", "https://images.unsplash.com/photo-1593305841991-05c297ba4575?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzMjd8MHwxfHNlYXJjaHwyfHxnYW1pbmclMjBtb25pdG9yfGVufDB8fHx8MTc4Mzc0NDE1M3ww&ixlib=rb-4.1.0&q=85"], "features": ["8K Ready", "Raytracing 2.0", "Ultra Fast SSD"]},
    {"title": "Xbox Series X Infinite 2026", "description": "Xbox Premium-Edition 2026 mit 4K/120 und großem Speicherpaket.", "retail_price": 1099, "category": "gaming", "image_url": "https://images.pexels.com/photos/15822009/pexels-photo-15822009.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940", "image_urls": ["https://images.pexels.com/photos/15822009/pexels-photo-15822009.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940", "https://images.unsplash.com/photo-1534423861386-85a16f5d13fd?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzMjd8MHwxfHNlYXJjaHwxfHxnYW1pbmclMjBtb25pdG9yfGVufDB8fHx8MTc4Mzc0NDE1M3ww&ixlib=rb-4.1.0&q=85"], "features": ["4K 120 FPS", "2TB Storage", "Game Pass Ready"]},
    {"title": "Nintendo Switch 2 OLED Max 2026", "description": "Nintendo Handheld-Flaggschiff 2026 mit OLED, Dock Boost und Multiplayer-Ready.", "retail_price": 1099, "category": "gaming", "image_url": "https://images.pexels.com/photos/15822009/pexels-photo-15822009.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940", "image_urls": ["https://images.pexels.com/photos/15822009/pexels-photo-15822009.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940", "https://images.unsplash.com/photo-1614179924047-e1ab49a0a0cf?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzMjd8MHwxfHNlYXJjaHw0fHxnYW1pbmclMjBtb25pdG9yfGVufDB8fHx8MTc4Mzc0NDE1M3ww&ixlib=rb-4.1.0&q=85"], "features": ["OLED HDR", "Dock Boost", "Next-gen Joy Controllers"]},
    {"title": "Meta Quest 4 Pro 2026", "description": "Mixed-Reality Headset 2026 mit schlankerem Design, besserem Tracking und Premium Optics.", "retail_price": 1299, "category": "xr", "image_url": VR_GALLERY[0], "image_urls": VR_GALLERY[:4], "features": ["Mixed Reality", "Pro Controllers", "High-Res Optics"]},
    {"title": "Apple Vision Air 2026", "description": "Spatial-Computing Headset 2026 für Arbeit, Entertainment und immersive Apps.", "retail_price": 1999, "category": "xr", "image_url": VR_GALLERY[1], "image_urls": VR_GALLERY[:4], "features": ["Spatial UI", "Eye Tracking", "Cinema Mode"]},
    {"title": "Sony XR Creator Headset 2026", "description": "XR Headset 2026 für Creator, Modellierer und immersive Workflows.", "retail_price": 1699, "category": "xr", "image_url": VR_GALLERY[2], "image_urls": VR_GALLERY[:4], "features": ["Creator Tools", "Precision Tracking", "Dual 4K Panels"]},
    {"title": "HTC Vive Vision Max 2026", "description": "HTC Premium-VR-System 2026 mit großem Sichtfeld und starker Performance.", "retail_price": 1499, "category": "xr", "image_url": VR_GALLERY[3], "image_urls": VR_GALLERY[:4], "features": ["Wide FOV", "Inside-Out Tracking", "Premium Comfort"]},
    {"title": "DJI Mavic 4 Pro Cine 2026", "description": "Creator-Drohne 2026 mit 8K Capture, Cine Mode und Premium Stabilisierung.", "retail_price": 1999, "category": "tech", "image_url": DRONE_GALLERY[0], "image_urls": DRONE_GALLERY[:4], "features": ["8K Cine", "Triple Camera", "Pro Stabilization"]},
    {"title": "Autel EVO Max 4T 2026", "description": "Enterprise-Drohne 2026 mit AI Flight, starker Kamera und Premium Reichweite.", "retail_price": 1899, "category": "tech", "image_url": DRONE_GALLERY[1], "image_urls": DRONE_GALLERY[:4], "features": ["AI Flight Assist", "Long Range", "Pro Thermal Stack"]},
    {"title": "Skydio X10 Creator 2026", "description": "Autonome Premium-Drohne 2026 für smarte Tracking-Shots und Reisen.", "retail_price": 1799, "category": "tech", "image_url": DRONE_GALLERY[2], "image_urls": DRONE_GALLERY[:4], "features": ["Autonomous Tracking", "Cinematic Paths", "Obstacle AI"]},
    {"title": "GoPro Karma X Drone 2026", "description": "Kompakte Kamera-Drohne 2026 für Creator mit einfacher Steuerung und Capture-Modes.", "retail_price": 1299, "category": "tech", "image_url": DRONE_GALLERY[3], "image_urls": DRONE_GALLERY[:4], "features": ["Compact Fold Design", "Creator Modes", "Fast Setup"]},
    {"title": "VanMoof S6 Pro 2026", "description": "Connected City E-Bike 2026 mit Diebstahlschutz, Boost Button und App-Control.", "retail_price": 1999, "category": "mobility", "image_url": EBIKE_GALLERY[0], "image_urls": EBIKE_GALLERY[:4], "features": ["App Unlock", "Boost Button", "Anti-Theft Tracking"]},
    {"title": "Cowboy Cross 2026", "description": "Urban Premium E-Bike 2026 mit cleanem Design und smarter Navigation.", "retail_price": 1899, "category": "mobility", "image_url": EBIKE_GALLERY[1], "image_urls": EBIKE_GALLERY[:4], "features": ["Smart Navigation", "Adaptive Power", "Minimal Design"]},
    {"title": "Riese & Muller Nevo GT 2026", "description": "High-End E-Bike 2026 für Pendler mit starker Reichweite und Komfort.", "retail_price": 1999, "category": "mobility", "image_url": EBIKE_GALLERY[2], "image_urls": EBIKE_GALLERY[:4], "features": ["Long Range", "Premium Suspension", "Commuter Setup"]},
    {"title": "Stromer ST5 ABS 2026", "description": "Schnelles Smart E-Bike 2026 mit Connectivity, Power und Premium Frame.", "retail_price": 1999, "category": "mobility", "image_url": EBIKE_GALLERY[3], "image_urls": EBIKE_GALLERY[:4], "features": ["ABS Safety", "Smart Connect", "High Torque Drive"]},
    {"title": "Segway GT3 Ultra Scooter 2026", "description": "Leistungsstarker E-Scooter 2026 mit Dual Motor, großer Reichweite und App-Funktionen.", "retail_price": 1499, "category": "mobility", "image_url": ESCOOTER_GALLERY[0], "image_urls": ESCOOTER_GALLERY[:4], "features": ["Dual Motor", "Long Range", "App Lock"]},
    {"title": "Xiaomi Scooter 6 Pro Max 2026", "description": "Premium-Scooter 2026 für Stadt und Pendelwege mit starkem Akku und Komfort.", "retail_price": 1299, "category": "mobility", "image_url": ESCOOTER_GALLERY[1], "image_urls": ESCOOTER_GALLERY[:4], "features": ["Extended Battery", "Comfort Tires", "Fast Fold"]},
    {"title": "Samsung Odyssey G10 Neo 2026", "description": "Ultra-Premium Gaming Monitor 2026 mit Curved Mini-LED und immersivem Setup.", "retail_price": 1999, "category": "gaming", "image_url": MONITOR_GALLERY[0], "image_urls": MONITOR_GALLERY[:4], "features": ["Curved Mini-LED", "240Hz", "Ultra Wide Immersion"]},
    {"title": "LG UltraGear OLED 49 2026", "description": "LG Gaming-Monitor 2026 mit OLED, ultrabreitem Panel und Profi-Gaming-Look.", "retail_price": 1799, "category": "gaming", "image_url": MONITOR_GALLERY[1], "image_urls": MONITOR_GALLERY[:4], "features": ["OLED Panel", "Ultra Wide", "Pro Gaming Color"]},
    {"title": "Roborock S10 Max Ultra 2026", "description": "Premium Reinigungsroboter 2026 mit AI Mapping, Docking und vollautomatischer Pflege.", "retail_price": 1499, "category": "robots", "image_url": ROBOT_GALLERY[0], "image_urls": ROBOT_GALLERY[:4], "features": ["AI Mapping", "Self-Clean Dock", "Smart Home Ready"]},
    {"title": "iRobot Roomba X Combo 2026", "description": "High-End Robot Cleaner 2026 mit kombinierter Saugen/Wischen-Intelligenz.", "retail_price": 1299, "category": "robots", "image_url": ROBOT_GALLERY[1], "image_urls": ROBOT_GALLERY[:4], "features": ["Vacuum + Mop", "Smart Navigation", "Auto Empty Base"]},
]

ACTIVE_AUCTION_CATALOG = [
    {
        **product,
        "image_url": resolve_product_image(
            product["title"],
            product.get("image_url") or PRODUCT_IMAGES.get(product["title"], ""),
        ),
        "image_urls": resolve_product_gallery(
            product["title"],
            product.get("image_urls") or [],
            product.get("image_url") or PRODUCT_IMAGES.get(product["title"], ""),
        ),
    }
    for product in ACTIVE_AUCTION_CATALOG
]

TARGET_ACTIVE_AUCTIONS = 30


def _schedule_auction_end(now: datetime, slot_index: int = 0) -> tuple[datetime, int]:
    # Canonical customer auction duration: alternate 48h / 72h across catalog slots.
    duration_hours = 48 if int(slot_index or 0) % 2 == 0 else 72
    duration_seconds = duration_hours * 3600
    end_at = now + timedelta(seconds=duration_seconds)
    return end_at, duration_seconds


# ── Seed demo auctions ──
def _bot_target_for(retail_price: float) -> float:
    import random as _r
    if retail_price >= 1800:
        return round(_r.uniform(320, 520), 2)
    if retail_price >= 1500:
        return round(_r.uniform(260, 420), 2)
    if retail_price >= 1200:
        return round(_r.uniform(210, 340), 2)
    return round(_r.uniform(180, 280), 2)


def _build_auction_doc(d: dict, created_by: str, now: datetime, slot_index: int = 0) -> dict:
    """Build a full auction document with bot auto-bidding config."""
    auction_id = secrets.token_hex(8)
    scheduled_end_at, duration_seconds = _schedule_auction_end(now, slot_index)
    return {
        "auction_id": auction_id,
        "title": d["title"],
        "description": d["description"],
        # i18n: pre-translated catalog (DE/EN/SQ/TR) — None if not yet translated
        "translations": d.get("translations") or None,
        "image_url": resolve_product_image(d["title"], d.get("image_url") or PRODUCT_IMAGES.get(d["title"], "")),
        "image_urls": resolve_product_gallery(d["title"], d.get("image_urls") or [], d.get("image_url") or PRODUCT_IMAGES.get(d["title"], "")),
        "retail_price": d["retail_price"],
        "starting_price": 0.01,
        "current_price": 0.01,
        "price_increment": round(float(req.price_increment), 2),
        "bid_value_eur": round(float(req.bid_value_eur), 2),
        "revenue_target_eur": round(float(req.revenue_target_eur), 2),
        "product_cost_eur": round(float(req.product_cost_eur), 2),
        "shipping_cost_eur": round(float(req.shipping_cost_eur), 2),
        "other_costs_eur": round(float(req.other_costs_eur), 2),
        "target_net_profit_eur": round(float(req.target_net_profit_eur), 2),
        "timer_extension": TIMER_EXTENSION_SECONDS,
        "duration_seconds": duration_seconds,
        "ends_at": scheduled_end_at.isoformat(),
        "status": "active",
        "winner_id": None,
        "winner_name": None,
        "last_bidder_id": None,
        "last_bidder_name": None,
        "total_bids": 0,
        "created_by": created_by,
        "created_at": now.isoformat(),
        "category": d.get("category", ""),
        "features": d.get("features", []),
        "condition": d.get("condition", "Brand New — Factory Sealed"),
        # Real views only in production; synthetic viewer activity is test-only.
        "viewer_count": random.randint(8, 35) if TEST_MODE else 0,
        # Auto bot bidding is test-only unless an auction is explicitly bot_only.
        "bot_enabled": bool(TEST_MODE or d.get("bot_only")),
        "bot_target_price": _bot_target_for(d["retail_price"]),
        "bot_final_phase_seconds": 300,
        "bot_probability": 0.72,
        "bot_strategy": "aggressive",
        "bot_aggression": "extreme",
        "bot_min_seconds": 300,
        "bot_initial_target": round(max(12.0, min(34.0, d["retail_price"] * 0.02)), 2),
    }


async def seed_demo_auctions():
    """Seed demo auctions only in TEST_MODE; production inventory must be explicit."""
    if not TEST_MODE:
        return
    count = await db.auctions.count_documents({"status": "active"})
    if count > 0:
        return

    now = datetime.now(timezone.utc)
    for index, d in enumerate(ACTIVE_AUCTION_CATALOG[:TARGET_ACTIVE_AUCTIONS]):
        auction = _build_auction_doc(d, "system", now, index)
        await db.auctions.insert_one(auction)
        auction.pop("_id", None)


# ══════════════════════════════════════════════════════════════
# AUCTION MAINTENANCE LOOP
# - Marks expired auctions as ended
# - Auto-creates new auctions to keep count at TARGET_ACTIVE_AUCTIONS
# - Naturally fluctuates viewer counts for realism
# ══════════════════════════════════════════════════════════════
async def _next_product_for_restart() -> dict:
    """Pick a product to spawn — least recently used wins."""
    # Find the product titles that were ended most-long-ago
    last_ended = {}
    cursor = db.auctions.find(
        {"status": "ended"},
        {"_id": 0, "title": 1, "ended_at": 1, "created_at": 1},
    ).sort("ended_at", -1).limit(200)
    async for doc in cursor:
        last_ended.setdefault(doc.get("title"), doc.get("ended_at") or doc.get("created_at"))

    # Score each catalog product: prefer ones never ended (= None) or ended longest ago
    def score(p):
        return last_ended.get(p["title"]) or "0000"

    sorted_catalog = sorted(ACTIVE_AUCTION_CATALOG, key=score)
    return sorted_catalog[0]


async def auction_maintenance_loop():
    """Background loop: end expired, restart to maintain 30 active, fluctuate viewers."""
    import logging
    logger = logging.getLogger("bidblitz.auctions")
    logger.info("🎰 Auction maintenance loop STARTED")

    while True:
        try:
            now = datetime.now(timezone.utc)
            now_iso = now.isoformat()

            # 1) End expired auctions (timer fully ran out)
            expired = await db.auctions.find(
                {"status": "active", "ends_at": {"$lt": now_iso}},
                {"_id": 0, "auction_id": 1, "last_bidder_id": 1, "last_bidder_name": 1, "current_price": 1, "title": 1},
            ).to_list(100)

            for ex in expired:
                finalized, _ = await _finalize_auction_once(ex["auction_id"], now=now)
                if not finalized or finalized.get("status") != "ended":
                    continue

                # Push to watchlist users (auction ended). The auction leaves the
                # active set immediately, so this branch runs once per auction.
                try:
                    from routes.web_push import send_push_to_user
                    watchers = await db.watchlist.find(
                        {"auction_id": ex["auction_id"]}, {"_id": 0, "user_id": 1}
                    ).to_list(50)
                    for w in watchers:
                        if w["user_id"] != finalized.get("winner_id"):
                            asyncio.create_task(send_push_to_user(
                                user_id=w["user_id"],
                                title="⏱ Auktion beendet",
                                body=f"{finalized.get('title', 'Auktion')} ist beendet — Endpreis €{float(finalized.get('current_price') or 0):.2f}",
                                data={"type": "watchlist_ended", "auction_id": ex["auction_id"]},
                            ))
                except Exception:
                    pass

            # 2) Demo auto-restart is TEST_MODE-only. Production auctions must be explicitly created.
            if TEST_MODE:
                # 2) Auto-restart: ensure TARGET_ACTIVE_AUCTIONS are running
                #    User-spec: SAME product respawns ~5 min after end → enforce
                #    minimum cool-down so a freshly ended item doesn't reappear instantly.
                RESTART_COOLDOWN_SECONDS = 300  # 5 minutes
                cooldown_threshold = (now - timedelta(seconds=RESTART_COOLDOWN_SECONDS)).isoformat()

                active_count = await db.auctions.count_documents({"status": "active"})
                need = TARGET_ACTIVE_AUCTIONS - active_count

                if need > 0:
                    logger.info(f"🎰 Auto-restart check: need={need} (active={active_count}, target={TARGET_ACTIVE_AUCTIONS})")
                    created_titles = set()
                    # Get current active titles to avoid duplicates
                    async for a in db.auctions.find({"status": "active"}, {"_id": 0, "title": 1}):
                        created_titles.add(a.get("title"))

                    # Compute last_ended_map AND in_cooldown_titles in one pass
                    last_ended_map = {}
                    in_cooldown = set()
                    async for doc in db.auctions.find(
                        {"status": "ended"}, {"_id": 0, "title": 1, "ended_at": 1}
                    ).sort("ended_at", -1).limit(200):
                        title = doc.get("title")
                        ended = doc.get("ended_at") or ""
                        last_ended_map.setdefault(title, ended)
                        # If recently ended (< 5 min ago) → in cooldown, skip
                        if ended and ended > cooldown_threshold:
                            in_cooldown.add(title)

                    spawned = 0
                    sorted_cat = sorted(
                        ACTIVE_AUCTION_CATALOG, key=lambda p: last_ended_map.get(p["title"], "")
                    )

                    for d in sorted_cat:
                        if spawned >= need:
                            break
                        if d["title"] in created_titles:
                            continue
                        if d["title"] in in_cooldown:
                            # Recently ended — wait the 5-min cool-down before respawn
                            continue
                        auction = _build_auction_doc(d, "system_auto", now, spawned)
                        await db.auctions.insert_one(auction)
                        created_titles.add(d["title"])
                        spawned += 1


            # 3) Synthetic viewer fluctuations are TEST_MODE-only.
            if TEST_MODE:
                # 3) Naturally fluctuate viewer counts (every ~2 minutes per auction)
                actives = await db.auctions.find(
                    {"status": "active"}, {"_id": 0, "auction_id": 1, "viewer_count": 1, "ends_at": 1}
                ).to_list(100)

                for a in actives:
                    # Skew viewer fluctuations: more viewers as auction approaches end
                    try:
                        ends = datetime.fromisoformat(a["ends_at"])
                        remaining = (ends - now).total_seconds()
                    except Exception:
                        remaining = 86400

                    cur = int(a.get("viewer_count") or 10)
                    if remaining < 600:           # last 10 min: surge
                        delta = random.randint(-1, 6)
                        floor, ceil = 20, 250
                    elif remaining < 3600:        # last hour: rising
                        delta = random.randint(-2, 4)
                        floor, ceil = 12, 120
                    else:
                        delta = random.randint(-3, 3)
                        floor, ceil = 6, 80
                    new_v = max(floor, min(ceil, cur + delta))
                    if new_v != cur:
                        await db.auctions.update_one(
                            {"auction_id": a["auction_id"]},
                            {"$set": {"viewer_count": new_v}},
                        )


        except Exception as e:
            import logging
            logging.getLogger("bidblitz").error(f"Auction maintenance error: {e}")

        await asyncio.sleep(20)  # tick every 20s


def start_auction_maintenance_loop():
    """Start the auction maintenance background task."""
    asyncio.create_task(auction_maintenance_loop())


# ══════════════════════════════════════════════════════════════
# Viewer Tracking Endpoint
# ══════════════════════════════════════════════════════════════
@router.post("/{auction_id}/view")
async def track_auction_view(auction_id: str, request: Request):
    """Increment viewer count when a user opens the auction page."""
    auction = await db.auctions.find_one({"auction_id": auction_id}, {"_id": 0})
    if not auction:
        raise HTTPException(404, "Auction not found")
    await db.auctions.update_one(
        {"auction_id": auction_id},
        {"$inc": {"viewer_count": 1}},
    )
    new_count = (auction.get("viewer_count") or 0) + 1
    return {"viewer_count": new_count}


# ══════════════════════════════════════════════════════════════
# Admin: Force Reseed (clear & recreate 30 auctions)
# ══════════════════════════════════════════════════════════════
@router.post("/admin/reseed")
async def admin_reseed_auctions(request: Request):
    """Admin: End all active auctions and create 30 fresh ones from current catalog."""
    user = await get_current_user(request)
    if user.get("role") not in ("admin", "super_admin"):
        raise HTTPException(403, "Admin only")

    now = datetime.now(timezone.utc)
    now_iso = now.isoformat()

    await db.auctions.update_many(
        {"status": "active"}, {"$set": {"status": "ended", "ended_at": now_iso}}
    )

    created = []
    for index, d in enumerate(ACTIVE_AUCTION_CATALOG[:TARGET_ACTIVE_AUCTIONS]):
        auction = _build_auction_doc(d, str(user.get("_id") or "admin"), now, index)
        await db.auctions.insert_one(auction)
        auction.pop("_id", None)
        created.append({"auction_id": auction["auction_id"], "title": auction["title"]})

    return {"ok": True, "created": len(created), "auctions": created}


# ── Admin: Refresh product auctions ──
@router.post("/admin/refresh")
async def refresh_auctions(request: Request):
    """Admin: End all active auctions and launch fresh ones from catalog."""
    user = await get_current_user(request)
    if user.get("role") not in {"admin", "super_admin"}:
        raise HTTPException(status_code=403, detail="Admin only")

    now = datetime.now(timezone.utc)
    now_iso = now.isoformat()

    # End all active auctions
    await db.auctions.update_many(
        {"status": "active"},
        {"$set": {"status": "ended", "ended_at": now_iso}},
    )

    # Create new auctions from full catalog (with bot auto-bidding)
    created = []
    for index, d in enumerate(ACTIVE_AUCTION_CATALOG[:TARGET_ACTIVE_AUCTIONS]):
        auction = _build_auction_doc(d, str(user["_id"]), now, index)
        await db.auctions.insert_one(auction)
        auction.pop("_id", None)
        created.append(auction["auction_id"])

    return {"refreshed": len(created), "auction_ids": created}


# ── Admin: Get product catalog ──
@router.get("/admin/catalog")
async def get_catalog(request: Request):
    """Admin: View the current product catalog."""
    user = await get_current_user(request)
    if user.get("role") not in {"admin", "super_admin"}:
        raise HTTPException(status_code=403, detail="Admin only")
    return {"catalog": ACTIVE_AUCTION_CATALOG, "total": len(ACTIVE_AUCTION_CATALOG)}


# ── Watchlist Toggle ──
@router.post("/{auction_id}/watchlist")
async def toggle_watchlist(auction_id: str, request: Request):
    """Toggle auction in user's watchlist."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    existing = await db.watchlist.find_one({"user_id": user_id, "auction_id": auction_id})
    if existing:
        await db.watchlist.delete_one({"_id": existing["_id"]})
        return {"watched": False}
    await db.watchlist.insert_one({
        "user_id": user_id,
        "auction_id": auction_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return {"watched": True}


# ══════════════════════════════════════════════════════
# BOT ADMIN — Target Price & Auto-Bidding System
# ══════════════════════════════════════════════════════

BOT_NAMES = [
    "Max_B", "Lukas99", "AnnaMaria", "Sophie_K", "Leon2040",
    "EmmaW", "Felix_H", "Laura88", "Tim_S", "Julia_M",
    "Nico_R", "Lena_X", "Paul_T", "Clara92", "Ben_F",
    "Mia_Z", "David_W", "Hannah_G", "Simon_P", "Lisa_V",
    "Jan_K", "Marie_D", "Tom_A", "Sarah_N", "Alex_C",
    "Nina_E", "Moritz_L", "Elena_O", "Finn_J", "Lea_U",
]



class BotConfigRequest(BaseModel):
    auction_id: str
    bot_enabled: bool = True
    bot_target_price: float = Field(0, ge=0, le=100000)
    bot_min_seconds: int = Field(300, ge=0, le=86400)  # Bot starts bidding when remaining <= this
    # NEW: Extended bot options
    bot_aggression: str = Field("medium", pattern="^(low|medium|high|extreme)$")  # How fast bot bids
    bot_max_bids_per_minute: int = Field(5, ge=1, le=30)  # Max bids per minute
    bot_min_delay_seconds: int = Field(3, ge=1, le=60)  # Min delay between bids
    bot_max_delay_seconds: int = Field(15, ge=3, le=300)  # Max delay between bids
    bot_react_to_users: bool = Field(True)  # Bot reacts faster when real users bid
    bot_final_battle_mode: str = Field("aggressive", pattern="^(passive|normal|aggressive|berserker)$")


class BotStrategyRequest(BaseModel):
    auction_id: str
    strategy: str = Field("standard", pattern="^(standard|sniper|pressure|marathon|whale)$")


# Bot Aggression Settings
BOT_AGGRESSION_SETTINGS = {
    "low": {"min_delay": 10, "max_delay": 30, "bids_per_min": 3},
    "medium": {"min_delay": 5, "max_delay": 15, "bids_per_min": 6},
    "high": {"min_delay": 2, "max_delay": 8, "bids_per_min": 12},
    "extreme": {"min_delay": 1, "max_delay": 4, "bids_per_min": 20},
}

# Bot Strategies
BOT_STRATEGIES = {
    "standard": {
        "name": "Standard",
        "description": "Gleichmäßiges Bieten bis zum Zielpreis",
        "aggression": "medium",
        "final_battle": "normal",
    },
    "sniper": {
        "name": "Sniper",
        "description": "Wartet bis letzte Sekunden, dann aggressiv",
        "aggression": "low",
        "final_battle": "aggressive",
    },
    "pressure": {
        "name": "Pressure",
        "description": "Konstanter Druck, schnelle Gebote",
        "aggression": "high",
        "final_battle": "aggressive",
    },
    "marathon": {
        "name": "Marathon",
        "description": "Langsam und stetig über lange Zeit",
        "aggression": "low",
        "final_battle": "passive",
    },
    "whale": {
        "name": "Whale",
        "description": "Dominiert die Auktion komplett",
        "aggression": "extreme",
        "final_battle": "berserker",
    },
}


@router.get("/admin/list")
async def admin_list_auctions(request: Request):
    """Admin: list all auctions with bot config."""
    user = await get_current_user(request)
    if user.get("role") not in {"admin", "super_admin"}:
        raise HTTPException(status_code=403, detail="Admin only")

    auctions = await db.auctions.find(
        {}, {"_id": 0}
    ).sort("created_at", -1).to_list(200)

    now_dt = datetime.now(timezone.utc)
    for a in auctions:
        if a.get("status") == "active" and a.get("ends_at"):
            try:
                ends = datetime.fromisoformat(a["ends_at"])
                a["remaining_seconds"] = max(0, (ends - now_dt).total_seconds())
            except Exception:
                a["remaining_seconds"] = 0
        else:
            a["remaining_seconds"] = 0

        # Revenue calculation
        tp = a.get("bot_target_price", 0)
        if tp > 0:
            bids_needed = int(tp / PRICE_INCREMENT)
            a["bot_estimated_revenue"] = round(bids_needed * 0.50, 2)
        else:
            a["bot_estimated_revenue"] = 0

        # Bot/real bid counts + transparent minimum-profit guard
        bot_bids = await db.auction_bids.count_documents({
            "auction_id": a["auction_id"], "is_bot": True
        })
        real_paid_bids = await db.auction_bids.count_documents({
            "auction_id": a["auction_id"], "is_bot": {"$ne": True}
        })
        a["bot_bids_placed"] = bot_bids
        a["real_paid_bids"] = real_paid_bids
        a["profit_guard"] = _profit_guard_snapshot(a, real_paid_bids)
        
        # Add strategy info
        strategy = a.get("bot_strategy", "standard")
        a["bot_strategy_info"] = BOT_STRATEGIES.get(strategy, BOT_STRATEGIES["standard"])

    return {"auctions": auctions, "strategies": BOT_STRATEGIES, "aggression_settings": BOT_AGGRESSION_SETTINGS}


@router.get("/admin/bot-strategies")
async def get_bot_strategies(request: Request):
    """Admin: Get available bot strategies."""
    user = await get_current_user(request)
    if user.get("role") not in {"admin", "super_admin"}:
        raise HTTPException(status_code=403, detail="Admin only")
    
    return {
        "strategies": BOT_STRATEGIES,
        "aggression_settings": BOT_AGGRESSION_SETTINGS,
        "final_battle_modes": {
            "passive": "Wenig Aktivität in letzten Sekunden",
            "normal": "Normale Reaktion auf User-Gebote",
            "aggressive": "Schnelle Gegengebote",
            "berserker": "Sofortige Reaktion, maximale Intensität",
        }
    }


@router.post("/admin/bot-config")
async def set_bot_config(req: BotConfigRequest, request: Request):
    """Admin: configure bot for an auction with extended options."""
    user = await get_current_user(request)
    if user.get("role") not in {"admin", "super_admin"}:
        raise HTTPException(status_code=403, detail="Admin only")

    auction = await db.auctions.find_one({"auction_id": req.auction_id})
    if not auction:
        raise HTTPException(status_code=404, detail="Auction not found")
    if req.bot_enabled and not TEST_MODE and not auction.get("bot_only"):
        raise HTTPException(
            status_code=403,
            detail="Bots dürfen in Production nur auf klar markierten bot_only Demo-/Testauktionen aktiviert werden.",
        )

    await db.auctions.update_one(
        {"auction_id": req.auction_id},
        {"$set": {
            "bot_enabled": req.bot_enabled,
            "bot_target_price": req.bot_target_price,
            "bot_min_seconds": req.bot_min_seconds,
            "bot_aggression": req.bot_aggression,
            "bot_max_bids_per_minute": req.bot_max_bids_per_minute,
            "bot_min_delay_seconds": req.bot_min_delay_seconds,
            "bot_max_delay_seconds": req.bot_max_delay_seconds,
            "bot_react_to_users": req.bot_react_to_users,
            "bot_final_battle_mode": req.bot_final_battle_mode,
        }},
    )

    # Calculate estimated revenue
    bids_needed = int(req.bot_target_price / PRICE_INCREMENT) if req.bot_target_price > 0 else 0
    estimated_revenue = round(bids_needed * 0.50, 2)

    return {
        "ok": True,
        "auction_id": req.auction_id,
        "bot_enabled": req.bot_enabled,
        "bot_target_price": req.bot_target_price,
        "bot_aggression": req.bot_aggression,
        "estimated_revenue": estimated_revenue,
    }


@router.post("/admin/bot-strategy")
async def set_bot_strategy(req: BotStrategyRequest, request: Request):
    """Admin: set bot strategy for an auction."""
    user = await get_current_user(request)
    if user.get("role") not in {"admin", "super_admin"}:
        raise HTTPException(status_code=403, detail="Admin only")
    
    if req.strategy not in BOT_STRATEGIES:
        raise HTTPException(status_code=400, detail="Invalid strategy")
    
    auction = await db.auctions.find_one({"auction_id": req.auction_id})
    if not auction:
        raise HTTPException(status_code=404, detail="Auction not found")
    if not TEST_MODE and not auction.get("bot_only"):
        raise HTTPException(
            status_code=403,
            detail="Bot-Strategien sind in Production nur für bot_only Demo-/Testauktionen erlaubt.",
        )
    
    strategy = BOT_STRATEGIES[req.strategy]
    aggression = BOT_AGGRESSION_SETTINGS[strategy["aggression"]]
    
    await db.auctions.update_one(
        {"auction_id": req.auction_id},
        {"$set": {
            "bot_strategy": req.strategy,
            "bot_aggression": strategy["aggression"],
            "bot_final_battle_mode": strategy["final_battle"],
            "bot_min_delay_seconds": aggression["min_delay"],
            "bot_max_delay_seconds": aggression["max_delay"],
            "bot_max_bids_per_minute": aggression["bids_per_min"],
        }},
    )
    
    return {
        "ok": True,
        "strategy": req.strategy,
        "strategy_info": strategy,
    }


async def execute_bot_bid(auction):
    """Place a bot bid only in test mode or an explicit bot-only auction."""
    import logging
    logger = logging.getLogger("bidblitz.bots")

    if not TEST_MODE and not auction.get("bot_only"):
        logger.warning(
            "Blocked production bot bid on customer auction %s",
            auction.get("auction_id"),
        )
        return {"skipped": True, "reason": "customer_auction"}

    now = datetime.now(timezone.utc)
    now_iso = now.isoformat()

    bot_name = random.choice(BOT_NAMES)
    new_price = round(auction["current_price"] + PRICE_INCREMENT, 2)
    logger.info(f"🤖 Bot '{bot_name}' bids €{new_price:.2f} on '{auction['title'][:30]}...'")


    # Extend timer like a normal bid
    current_ends = datetime.fromisoformat(auction["ends_at"])
    remaining = (current_ends - now).total_seconds()
    if remaining <= FINAL_BATTLE_THRESHOLD:
        new_ends = now + timedelta(seconds=TIMER_EXTENSION_SECONDS)
    elif remaining < TIMER_EXTENSION_SECONDS:
        new_ends = now + timedelta(seconds=TIMER_EXTENSION_SECONDS)
    else:
        new_ends = current_ends

    await db.auctions.update_one(
        {"auction_id": auction["auction_id"]},
        {"$set": {
            "current_price": new_price,
            "ends_at": new_ends.isoformat(),
            "last_bidder_id": f"bot_{bot_name}",
            "last_bidder_name": bot_name,
        },
        "$inc": {"total_bids": 1}},
    )

    bid_record = {
        "bid_id": secrets.token_hex(6),
        "auction_id": auction["auction_id"],
        "user_id": f"bot_{bot_name}",
        "user_name": bot_name,
        "bid_price": new_price,
        "created_at": now_iso,
        "is_bot": True,
    }
    await db.auction_bids.insert_one(bid_record)


async def _get_admin_win_rate() -> float:
    """
    Returns the admin-configured probability (0..1) that a HUMAN customer
    should win when they're the current highest bidder in Phase 3.
    Default 0.20 → 20% of auctions go to customers, 80% to bots.
    """
    cfg = await db.auction_automation_config.find_one({"_id": "global"}, {"_id": 0})
    if not cfg:
        return 0.20
    pct = cfg.get("customer_win_rate_percent")
    if pct is None:
        return 0.20
    try:
        return max(0.0, min(1.0, float(pct) / 100.0))
    except (TypeError, ValueError):
        return 0.20


async def _get_bot_aggression() -> dict:
    """
    Returns Phase-3 bot timing/probability based on admin aggression slider 0..100.
    0 → slow & relaxed (users have lots of reaction time)
    50 → balanced default
    100 → sniper mode (rapid bids in last seconds)
    """
    cfg = await db.auction_automation_config.find_one({"_id": "global"}, {"_id": 0})
    level = 50.0
    if cfg and cfg.get("bot_aggression_level") is not None:
        try:
            level = max(0.0, min(100.0, float(cfg["bot_aggression_level"])))
        except (TypeError, ValueError):
            pass
    # Linear interpolate timing windows: t=0 → 8-15s,  t=100 → 0.5-1.5s
    t = level / 100.0
    pre_min = 8.0 - 7.5 * t   # 8.0 → 0.5
    pre_max = 15.0 - 13.5 * t # 15 → 1.5
    # Probability scales: 0 → 15%, 100 → 75%
    prob = 0.15 + 0.60 * t
    return {
        "level": level,
        "pre_min_s": max(0.3, pre_min),
        "pre_max_s": max(pre_min + 0.5, pre_max),
        "probability": prob,
    }


async def bot_bidding_loop():
    """Background loop: check bot-enabled auctions and place bids.
    
    NEW 3-PHASE BOT BIDDING STRATEGY:
    ═══════════════════════════════════════════════════════════════════
    Phase 1 (START): Bots bid until price reaches €3-5 to generate initial activity
    Phase 2 (PAUSE): Bots stop completely, let real customers bid
    Phase 3 (FINAL 5 MIN): If remaining < 5min AND price < target, bots resume
                          Bots bid until target price is reached, then STOP
    ═══════════════════════════════════════════════════════════════════
    """
    import logging
    logger = logging.getLogger("bidblitz.bots")
    logger.info("🤖 Bot bidding loop STARTED")
    
    while True:
        try:
            now = datetime.now(timezone.utc)
            now_iso = now.isoformat()

            bot_query = {
                "status": "active",
                "bot_enabled": True,
                "bot_target_price": {"$gt": 0},
                "ends_at": {"$gt": now_iso},
            }
            if not TEST_MODE:
                bot_query["bot_only"] = True
            bot_auctions = await db.auctions.find(bot_query).to_list(100)
            
            if bot_auctions:
                logger.info(f"🤖 Bot loop: Found {len(bot_auctions)} active bot auctions")

            for auction in bot_auctions:
                target = auction.get("bot_target_price", 50)  # z.B. €50.01
                current = auction.get("current_price", 0)
                
                # ═══ PHASE CHECK: Target already reached? STOP completely ═══
                if current >= target:
                    continue

                try:
                    ends = datetime.fromisoformat(auction["ends_at"])
                    remaining = (ends - now).total_seconds()
                except Exception:
                    continue

                # ═══════════════════════════════════════════════════════════
                # PHASE 1: START PHASE (Preis < initial_target)
                # Bots bieten bis €3-6 erreicht sind um Aktivität zu generieren
                # Jede Auktion bekommt einen eigenen zufälligen Zielwert
                # ═══════════════════════════════════════════════════════════
                initial_target = auction.get("bot_initial_target")
                if initial_target is None:
                    # Generate unique random target for this auction (3-10€ per User-Spec)
                    initial_target = round(random.uniform(3.0, 10.0), 2)
                    await db.auctions.update_one(
                        {"auction_id": auction["auction_id"]},
                        {"$set": {"bot_initial_target": initial_target}}
                    )
                
                if current < initial_target:
                    # In Phase 1: Biete bis initial_target erreicht
                    bid_probability = 0.4  # 40% Chance pro Loop
                    if random.random() > bid_probability:
                        continue
                    await asyncio.sleep(random.uniform(0.5, 2.0))
                    await execute_bot_bid(auction)
                    continue

                # ═══════════════════════════════════════════════════════════
                # PHASE 2: PAUSE PHASE (€5 < Preis < Target, Zeit > 5 Min)
                # Bots stoppen komplett, echte Kunden bieten
                # ═══════════════════════════════════════════════════════════
                final_phase_seconds = auction.get("bot_final_phase_seconds", 300)  # 5 Minuten
                
                if remaining > final_phase_seconds:
                    # Noch mehr als 5 Minuten übrig → PAUSE (keine Bot-Bids)
                    continue

                # ═══════════════════════════════════════════════════════════
                # PHASE 3: FINAL PHASE (Letzte 5 Minuten)
                # Bots bieten wieder bis Zielpreis erreicht ist.
                # NEU iter102: Wenn aktuell ein ECHTER USER führt, prüfe die
                # Admin-Win-Rate. Wenn dieser Auktion das "der Kunde gewinnt"-
                # Los gezogen wurde → Bots halten sich zurück und lassen
                # den User gewinnen.
                # ═══════════════════════════════════════════════════════════
                last_bidder_id = auction.get("last_bidder_id") or ""
                is_user_leading = (
                    last_bidder_id
                    and not last_bidder_id.startswith("bot_")
                    and last_bidder_id != "system"
                )
                if is_user_leading:
                    # Decide once per auction whether this one is reserved for the customer
                    reserve_decision = auction.get("customer_should_win")
                    if reserve_decision is None:
                        win_rate = await _get_admin_win_rate()
                        reserve_decision = random.random() < win_rate
                        await db.auctions.update_one(
                            {"auction_id": auction["auction_id"]},
                            {"$set": {"customer_should_win": reserve_decision}},
                        )
                    if reserve_decision:
                        # Customer-win lottery: bots stand down for the final battle
                        continue

                # Preis < Target UND weniger als 5 Minuten übrig
                # NEU iter103: nutze Admin-Aggressivitäts-Setting für Probability + Delay
                aggr = await _get_bot_aggression()
                bid_probability = aggr["probability"]
                if random.random() > bid_probability:
                    continue

                # Add random delay scaled by aggression
                await asyncio.sleep(random.uniform(aggr["pre_min_s"], aggr["pre_max_s"]))
                
                await execute_bot_bid(auction)

        except Exception as e:
            import logging
            logging.getLogger("bidblitz").error(f"Bot loop error: {e}")

        # Random sleep interval to avoid patterns
        await asyncio.sleep(random.uniform(3, 8))


def start_bot_loop():
    """Start the bot bidding background task."""
    asyncio.create_task(bot_bidding_loop())


# ═══════════════════════════════════════════════════════════════════════════════
# ADMIN AUCTION AUTOMATION SYSTEM
# Full admin control over auction lifecycle, scheduling, and auto-rotation
# ═══════════════════════════════════════════════════════════════════════════════

class AutomationConfigRequest(BaseModel):
    enabled: bool = True
    auto_create_enabled: bool = True
    min_active_auctions: int = Field(default=5, ge=1, le=50)
    max_active_auctions: int = Field(default=20, ge=1, le=100)
    default_duration_hours: int = Field(default=48, ge=48, le=72)
    auto_end_expired: bool = True
    auto_restart_ended: bool = False
    bot_default_enabled: bool = True
    bot_default_target_percent: float = Field(default=15.0, ge=0, le=50)  # % of retail price
    categories_enabled: list = Field(default=["phones", "gaming", "audio", "wearables", "laptops", "tablets"])
    # NEW iter102: Admin win-rate steering. 0-100 = % aller Auktionen die der KUNDE gewinnen soll.
    customer_win_rate_percent: float = Field(default=20.0, ge=0, le=100)
    # NEW iter103: Bot-Aggressivität 0-100. Beeinflusst Phase-3 Speed & Probability.
    # 0   = sehr langsam, Bots geben User viel Reaktionszeit
    # 50  = ausgewogen (Default)
    # 100 = Sniper-Modus, Bots schießen alle 0.5-1.5s
    bot_aggression_level: float = Field(default=50.0, ge=0, le=100)


class ScheduleAuctionRequest(BaseModel):
    product_index: int = Field(..., ge=0)  # Index in PRODUCT_CATALOG
    start_at: Optional[str] = None  # ISO datetime, None = start immediately
    duration_hours: int = Field(default=48, ge=48, le=72)
    bot_enabled: bool = True
    bot_target_price: Optional[float] = None  # None = auto-calculate
    featured: bool = False
    bid_value_eur: float = Field(default=0.50, ge=0.01, le=10.0)
    price_increment: float = Field(default=0.01, ge=0.01, le=1.0)
    revenue_target_eur: float = Field(default=0.0, ge=0.0, le=100000.0)
    product_cost_eur: float = Field(default=0.0, ge=0.0, le=100000.0)
    shipping_cost_eur: float = Field(default=0.0, ge=0.0, le=10000.0)
    other_costs_eur: float = Field(default=0.0, ge=0.0, le=10000.0)
    target_net_profit_eur: float = Field(default=0.0, ge=0.0, le=100000.0)


class BulkScheduleRequest(BaseModel):
    product_indices: list  # List of indices
    stagger_minutes: int = Field(default=30, ge=0, le=1440)
    duration_hours: int = Field(default=48, ge=48, le=72)
    bot_enabled: bool = True


@router.get("/admin/automation/config")
async def get_automation_config(request: Request):
    """Admin: Get current automation configuration."""
    user = await get_current_user(request)
    if user.get("role") not in {"admin", "super_admin"}:
        raise HTTPException(status_code=403, detail="Admin only")
    
    config = await db.auction_automation_config.find_one({"_id": "global"})
    if not config:
        config = {
            "enabled": True,
            "auto_create_enabled": True,
            "min_active_auctions": 5,
            "max_active_auctions": 20,
            "default_duration_hours": 48,
            "auto_end_expired": True,
            "auto_restart_ended": False,
            "bot_default_enabled": True,
            "bot_default_target_percent": 15.0,
            "categories_enabled": ["phones", "gaming", "audio", "wearables", "laptops", "tablets"],
            "customer_win_rate_percent": 20.0,
            "bot_aggression_level": 50.0,
        }
    
    config.pop("_id", None)
    if not TEST_MODE:
        config["bot_default_enabled"] = False
        config["bot_policy"] = "test_only"
        config["bot_controls_effective"] = False
    else:
        config["bot_policy"] = "enabled"
        config["bot_controls_effective"] = True
    
    # Add stats
    active_count = await db.auctions.count_documents({"status": "active"})
    scheduled_count = await db.auctions.count_documents({"status": "scheduled"})
    ended_today = await db.auctions.count_documents({
        "status": "ended",
        "ended_at": {"$gte": datetime.now(timezone.utc).replace(hour=0, minute=0, second=0).isoformat()}
    })
    
    config["stats"] = {
        "active_auctions": active_count,
        "scheduled_auctions": scheduled_count,
        "ended_today": ended_today,
        "catalog_size": len(ACTIVE_AUCTION_CATALOG),
    }

    # Win-rate stats: heute wer hat wieviel gewonnen?
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    won_today = await db.auctions.find(
        {"status": "ended", "ended_at": {"$gte": today_start}, "winner_id": {"$ne": None}},
        {"_id": 0, "winner_id": 1},
    ).to_list(1000)
    customer_wins = sum(1 for a in won_today if not str(a.get("winner_id", "")).startswith("bot_"))
    bot_wins = len(won_today) - customer_wins
    config["stats"]["customer_wins_today"] = customer_wins
    config["stats"]["bot_wins_today"] = bot_wins
    config["stats"]["actual_customer_win_rate"] = (
        round(100.0 * customer_wins / len(won_today), 1) if won_today else 0.0
    )

    return config


@router.post("/admin/automation/config")
async def set_automation_config(req: AutomationConfigRequest, request: Request):
    """Admin: Update automation configuration."""
    user = await get_current_user(request)
    if user.get("role") not in {"admin", "super_admin"}:
        raise HTTPException(status_code=403, detail="Admin only")
    
    config_dict = req.dict()
    if not TEST_MODE:
        config_dict["bot_default_enabled"] = False
        config_dict["bot_policy"] = "test_only"
        config_dict["bot_controls_effective"] = False
    else:
        config_dict["bot_policy"] = "enabled"
        config_dict["bot_controls_effective"] = True
    config_dict["updated_at"] = datetime.now(timezone.utc).isoformat()
    config_dict["updated_by"] = str(user["_id"])
    
    await db.auction_automation_config.update_one(
        {"_id": "global"},
        {"$set": config_dict},
        upsert=True
    )
    
    return {"ok": True, "config": config_dict}


@router.post("/admin/auction/schedule")
async def schedule_single_auction(req: ScheduleAuctionRequest, request: Request):
    """Admin: Schedule a single auction from catalog."""
    user = await get_current_user(request)
    if user.get("role") not in {"admin", "super_admin"}:
        raise HTTPException(status_code=403, detail="Admin only")
    
    if req.product_index >= len(ACTIVE_AUCTION_CATALOG):
        raise HTTPException(status_code=400, detail=f"Invalid product index. Max: {len(ACTIVE_AUCTION_CATALOG)-1}")
    
    product = ACTIVE_AUCTION_CATALOG[req.product_index]
    now = datetime.now(timezone.utc)
    
    if req.start_at:
        try:
            start_time = datetime.fromisoformat(req.start_at.replace("Z", "+00:00"))
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid start_at format")
        status = "scheduled" if start_time > now else "active"
    else:
        start_time = now
        status = "active"
    
    duration_seconds = req.duration_hours * 3600
    ends_at = start_time + timedelta(seconds=duration_seconds)
    
    # Auto-calculate bot target if not provided (15% of retail by default)
    if req.bot_target_price is None:
        bot_target = round(product["retail_price"] * 0.15, 2)
    else:
        bot_target = req.bot_target_price
    
    effective_bot_enabled = bool(req.bot_enabled and TEST_MODE)
    auction_id = secrets.token_hex(8)
    auction = {
        "auction_id": auction_id,
        "title": product["title"],
        "description": product["description"],
        "image_url": resolve_product_image(product["title"], product.get("image_url") or PRODUCT_IMAGES.get(product["title"], "")),
        "image_urls": resolve_product_gallery(product["title"], product.get("image_urls") or [], product.get("image_url") or PRODUCT_IMAGES.get(product["title"], "")),
        "retail_price": product["retail_price"],
        "starting_price": 0.01,
        "current_price": 0.01,
        "price_increment": round(float(req.price_increment), 2),
        "bid_value_eur": round(float(req.bid_value_eur), 2),
        "revenue_target_eur": round(float(req.revenue_target_eur), 2),
        "product_cost_eur": round(float(req.product_cost_eur), 2),
        "shipping_cost_eur": round(float(req.shipping_cost_eur), 2),
        "other_costs_eur": round(float(req.other_costs_eur), 2),
        "target_net_profit_eur": round(float(req.target_net_profit_eur), 2),
        "real_paid_bids": 0,
        "real_bid_revenue_eur": 0.0,
        "minimum_target_reached": req.target_net_profit_eur <= 0,
        "profit_guard_status": "target_not_met" if req.target_net_profit_eur > 0 else "not_enabled",
        "profit_guard_extensions": 0,
        "timer_extension": TIMER_EXTENSION_SECONDS,
        "duration_seconds": duration_seconds,
        "starts_at": start_time.isoformat(),
        "ends_at": ends_at.isoformat(),
        "status": status,
        "winner_id": None,
        "winner_name": None,
        "last_bidder_id": None,
        "last_bidder_name": None,
        "total_bids": 0,
        "created_by": str(user["_id"]),
        "created_at": now.isoformat(),
        "category": product.get("category", ""),
        "features": product.get("features", []),
        "condition": product.get("condition", "Brand New — Factory Sealed"),
        "bot_enabled": effective_bot_enabled,
        "bot_target_price": bot_target,
        "bot_min_seconds": 60,
        "bot_probability": 0.4,
        "featured": req.featured,
        "admin_scheduled": True,
    }
    
    await db.auctions.insert_one(auction)
    if req.featured:
        await db.auctions.update_many(
            {
                "auction_id": {"$ne": auction_id},
                "status": {"$in": ["active", "scheduled", "paused"]},
                "featured": True,
            },
            {"$set": {"featured": False}},
        )
    auction.pop("_id", None)
    
    return {
        "ok": True,
        "auction": auction,
        "bot_policy": (
            "test_only"
            if req.bot_enabled and not TEST_MODE
            else ("enabled" if effective_bot_enabled else "disabled")
        ),
        "message": f"Auction '{product['title']}' {'scheduled for ' + start_time.isoformat() if status == 'scheduled' else 'started immediately'}",
    }


@router.post("/admin/auction/bulk-schedule")
async def bulk_schedule_auctions(req: BulkScheduleRequest, request: Request):
    """Admin: Schedule multiple auctions with staggered start times."""
    user = await get_current_user(request)
    if user.get("role") not in {"admin", "super_admin"}:
        raise HTTPException(status_code=403, detail="Admin only")
    
    now = datetime.now(timezone.utc)
    effective_bot_enabled = bool(req.bot_enabled and TEST_MODE)
    created = []
    
    for i, idx in enumerate(req.product_indices):
        if idx >= len(ACTIVE_AUCTION_CATALOG):
            continue
        
        product = ACTIVE_AUCTION_CATALOG[idx]
        start_time = now + timedelta(minutes=i * req.stagger_minutes)
        duration_seconds = req.duration_hours * 3600
        ends_at = start_time + timedelta(seconds=duration_seconds)
        
        status = "scheduled" if start_time > now else "active"
        bot_target = round(product["retail_price"] * 0.15, 2)
        
        auction_id = secrets.token_hex(8)
        auction = {
            "auction_id": auction_id,
            "title": product["title"],
            "description": product["description"],
            "image_url": resolve_product_image(product["title"], product.get("image_url") or PRODUCT_IMAGES.get(product["title"], "")),
            "image_urls": resolve_product_gallery(product["title"], product.get("image_urls") or [], product.get("image_url") or PRODUCT_IMAGES.get(product["title"], "")),
            "retail_price": product["retail_price"],
            "starting_price": 0.01,
            "current_price": 0.01,
            "price_increment": PRICE_INCREMENT,
            "timer_extension": TIMER_EXTENSION_SECONDS,
            "duration_seconds": duration_seconds,
            "starts_at": start_time.isoformat(),
            "ends_at": ends_at.isoformat(),
            "status": status,
            "winner_id": None,
            "winner_name": None,
            "last_bidder_id": None,
            "last_bidder_name": None,
            "total_bids": 0,
            "real_paid_bids": 0,
            "real_bid_revenue_eur": 0.0,
            "created_by": str(user["_id"]),
            "created_at": now.isoformat(),
            "category": product.get("category", ""),
            "features": product.get("features", []),
            "condition": product.get("condition", "Brand New — Factory Sealed"),
            "bot_enabled": effective_bot_enabled,
            "bot_target_price": bot_target,
            "bot_min_seconds": 60,
            "bot_probability": 0.4,
            "admin_scheduled": True,
        }
        
        await db.auctions.insert_one(auction)
        created.append({"auction_id": auction_id, "title": product["title"], "starts_at": start_time.isoformat()})
    
    return {
        "ok": True,
        "created_count": len(created),
        "auctions": created,
        "bot_policy": (
            "test_only"
            if req.bot_enabled and not TEST_MODE
            else ("enabled" if effective_bot_enabled else "disabled")
        ),
    }


@router.post("/admin/auction/{auction_id}/pause")
async def pause_auction(auction_id: str, request: Request):
    """Admin: Pause an active auction."""
    user = await get_current_user(request)
    if user.get("role") not in {"admin", "super_admin"}:
        raise HTTPException(status_code=403, detail="Admin only")
    
    auction = await db.auctions.find_one({"auction_id": auction_id})
    if not auction:
        raise HTTPException(status_code=404, detail="Auction not found")
    
    if auction["status"] != "active":
        raise HTTPException(status_code=400, detail="Only active auctions can be paused")
    
    now = datetime.now(timezone.utc)
    ends_at = datetime.fromisoformat(auction["ends_at"])
    remaining = max(0.0, (ends_at - now).total_seconds())

    changed = await db.auctions.update_one(
        {
            "auction_id": auction_id,
            "status": "active",
            "ends_at": auction.get("ends_at"),
            "current_price": auction.get("current_price"),
            "last_bidder_id": auction.get("last_bidder_id"),
        },
        {"$set": {
            "status": "paused",
            "paused_at": now.isoformat(),
            "remaining_when_paused": remaining,
        }},
    )
    if changed.modified_count != 1:
        fresh = await db.auctions.find_one({"auction_id": auction_id}, {"_id": 0}) or {}
        if fresh.get("status") == "paused":
            return {
                "ok": True,
                "status": "paused",
                "remaining_seconds": float(fresh.get("remaining_when_paused") or 0),
                "replayed": True,
            }
        raise HTTPException(status_code=409, detail="Auktion änderte sich gleichzeitig. Bitte neu laden und erneut versuchen.")

    return {"ok": True, "status": "paused", "remaining_seconds": remaining, "replayed": False}


@router.post("/admin/auction/{auction_id}/resume")
async def resume_auction(auction_id: str, request: Request):
    """Admin: Resume a paused auction."""
    user = await get_current_user(request)
    if user.get("role") not in {"admin", "super_admin"}:
        raise HTTPException(status_code=403, detail="Admin only")
    
    auction = await db.auctions.find_one({"auction_id": auction_id})
    if not auction:
        raise HTTPException(status_code=404, detail="Auction not found")
    
    if auction["status"] != "paused":
        raise HTTPException(status_code=400, detail="Only paused auctions can be resumed")
    
    now = datetime.now(timezone.utc)
    remaining = max(0.0, float(auction.get("remaining_when_paused", 300) or 0))
    new_ends_at = now + timedelta(seconds=remaining)

    changed = await db.auctions.update_one(
        {
            "auction_id": auction_id,
            "status": "paused",
            "remaining_when_paused": auction.get("remaining_when_paused"),
        },
        {
            "$set": {
                "status": "active",
                "ends_at": new_ends_at.isoformat(),
                "resumed_at": now.isoformat(),
            },
            "$unset": {"paused_at": "", "remaining_when_paused": ""},
        },
    )
    if changed.modified_count != 1:
        fresh = await db.auctions.find_one({"auction_id": auction_id}, {"_id": 0}) or {}
        if fresh.get("status") == "active":
            return {"ok": True, "status": "active", "ends_at": fresh.get("ends_at"), "replayed": True}
        raise HTTPException(status_code=409, detail="Auktion änderte sich gleichzeitig. Resume wurde nicht angewendet.")

    return {"ok": True, "status": "active", "ends_at": new_ends_at.isoformat(), "replayed": False}


@router.post("/admin/auction/{auction_id}/end")
async def force_end_auction(auction_id: str, request: Request):
    """Admin: force-end an auction without racing a concurrent bid."""
    user = await get_current_user(request)
    if user.get("role") not in {"admin", "super_admin"}:
        raise HTTPException(status_code=403, detail="Admin only")

    finalized = None
    for _ in range(8):
        auction = await db.auctions.find_one({"auction_id": auction_id})
        if not auction:
            raise HTTPException(status_code=404, detail="Auction not found")
        if auction.get("status") == "ended":
            finalized = auction
            break

        winner_id = auction.get("last_bidder_id")
        winner_name = auction.get("last_bidder_name")
        bot_last_bidder = str(winner_id or "").startswith("bot_")
        needs_review = bool(bot_last_bidder and not auction.get("bot_only"))
        if bot_last_bidder:
            winner_id = None
            winner_name = None

        now_iso = datetime.now(timezone.utc).isoformat()
        claim = await db.auctions.update_one(
            {
                "auction_id": auction_id,
                "status": auction.get("status"),
                "current_price": auction.get("current_price"),
                "ends_at": auction.get("ends_at"),
                "last_bidder_id": auction.get("last_bidder_id"),
            },
            {"$set": {
                "status": "ended",
                "ended_at": now_iso,
                "winner_id": winner_id,
                "winner_name": winner_name,
                "requires_manual_review": needs_review,
                "end_reason": (
                    "bot_last_bidder_requires_review"
                    if needs_review
                    else ("bot_only_demo_complete" if bot_last_bidder else "force_ended")
                ),
                "force_ended_by": str(user["_id"]),
            }},
        )
        if claim.modified_count == 1:
            finalized = await db.auctions.find_one({"auction_id": auction_id})
            break

    if not finalized or finalized.get("status") != "ended":
        raise HTTPException(status_code=409, detail="Auktion änderte sich gleichzeitig. Bitte erneut versuchen.")

    # Publish the same deterministic winner notification used by natural expiry.
    finalized, _ = await _finalize_auction_once(auction_id)
    return {
        "ok": True,
        "status": "ended",
        "winner_id": finalized.get("winner_id") if finalized else None,
        "winner_name": finalized.get("winner_name") if finalized else None,
        "final_price": float((finalized or {}).get("current_price") or 0),
    }

@router.post("/admin/auction/{auction_id}/extend")
async def extend_auction(auction_id: str, request: Request):
    """Admin: Extend auction time."""
    user = await get_current_user(request)
    if user.get("role") not in {"admin", "super_admin"}:
        raise HTTPException(status_code=403, detail="Admin only")
    
    body = await request.json()
    try:
        extend_minutes = int(body.get("minutes", 60))
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="Ungültige Verlängerung")
    if not 1 <= extend_minutes <= 1440:
        raise HTTPException(status_code=400, detail="Verlängerung muss zwischen 1 und 1440 Minuten liegen")

    auction = await db.auctions.find_one({"auction_id": auction_id})
    if not auction:
        raise HTTPException(status_code=404, detail="Auction not found")
    
    if auction["status"] not in ("active", "paused"):
        raise HTTPException(status_code=400, detail="Cannot extend ended auction")

    extension_seconds = extend_minutes * 60
    current_duration_seconds = int(auction.get("duration_seconds") or 172800)
    new_duration_seconds = current_duration_seconds + extension_seconds
    if new_duration_seconds > 259200:
        raise HTTPException(
            status_code=409,
            detail="Auktions-Grunddauer darf maximal 72 Stunden betragen",
        )

    if auction["status"] == "paused":
        current_remaining = max(0.0, float(auction.get("remaining_when_paused") or 0))
        new_remaining = current_remaining + (extend_minutes * 60)
        if new_remaining > MAX_AUCTION_REMAINING_SECONDS:
            raise HTTPException(
                status_code=400,
                detail="Auktion darf maximal 72 Stunden Restlaufzeit haben",
            )
        changed = await db.auctions.update_one(
            {
                "auction_id": auction_id,
                "status": "paused",
                "remaining_when_paused": auction.get("remaining_when_paused"),
            },
            {"$set": {
                "remaining_when_paused": new_remaining,
                "duration_seconds": new_duration_seconds,
            }},
        )
        if changed.modified_count != 1:
            raise HTTPException(status_code=409, detail="Auktion änderte sich gleichzeitig. Verlängerung wurde nicht angewendet.")
        return {
            "ok": True,
            "status": "paused",
            "remaining_seconds": new_remaining,
            "extended_minutes": extend_minutes,
        }

    current_ends = datetime.fromisoformat(auction["ends_at"])
    new_ends = current_ends + timedelta(minutes=extend_minutes)
    max_ends = datetime.now(timezone.utc) + timedelta(seconds=MAX_AUCTION_REMAINING_SECONDS)
    if new_ends > max_ends:
        raise HTTPException(
            status_code=400,
            detail="Auktion darf maximal 72 Stunden Restlaufzeit haben",
        )
    changed = await db.auctions.update_one(
        {
            "auction_id": auction_id,
            "status": "active",
            "ends_at": auction.get("ends_at"),
            "current_price": auction.get("current_price"),
            "last_bidder_id": auction.get("last_bidder_id"),
        },
        {"$set": {
            "ends_at": new_ends.isoformat(),
            "duration_seconds": new_duration_seconds,
        }},
    )
    if changed.modified_count != 1:
        raise HTTPException(status_code=409, detail="Auktion änderte sich gleichzeitig. Verlängerung wurde nicht angewendet.")

    return {
        "ok": True,
        "status": "active",
        "new_ends_at": new_ends.isoformat(),
        "extended_minutes": extend_minutes,
    }


@router.delete("/admin/auction/{auction_id}")
async def delete_auction(auction_id: str, request: Request):
    """Admin: atomically freeze an auction before deleting it when no real bids exist."""
    user = await get_current_user(request)
    if user.get("role") not in {"admin", "super_admin"}:
        raise HTTPException(status_code=403, detail="Admin only")
    
    auction = await db.auctions.find_one({"auction_id": auction_id})
    if not auction:
        raise HTTPException(status_code=404, detail="Auction not found")

    original_status = auction.get("status")
    if original_status == "deleting":
        raise HTTPException(status_code=409, detail="Auktion wird bereits gelöscht")

    delete_claim_id = secrets.token_hex(8)
    claimed_at = datetime.now(timezone.utc).isoformat()
    claim = await db.auctions.update_one(
        {
            "auction_id": auction_id,
            "status": original_status,
            "current_price": auction.get("current_price"),
            "ends_at": auction.get("ends_at"),
            "last_bidder_id": auction.get("last_bidder_id"),
        },
        {"$set": {
            "status": "deleting",
            "delete_claim_id": delete_claim_id,
            "delete_claimed_at": claimed_at,
            "delete_claimed_by": str(user.get("_id") or ""),
        }},
    )
    if claim.modified_count != 1:
        fresh = await db.auctions.find_one({"auction_id": auction_id}, {"_id": 0})
        if not fresh:
            raise HTTPException(status_code=404, detail="Auction not found")
        raise HTTPException(status_code=409, detail="Auktion änderte sich gleichzeitig. Löschen wurde nicht gestartet")

    bid_count = await db.auction_bids.count_documents(
        {"auction_id": auction_id, "is_bot": {"$ne": True}}
    )
    if bid_count > 0:
        await db.auctions.update_one(
            {"auction_id": auction_id, "status": "deleting", "delete_claim_id": delete_claim_id},
            {
                "$set": {"status": original_status},
                "$unset": {
                    "delete_claim_id": "",
                    "delete_claimed_at": "",
                    "delete_claimed_by": "",
                },
            },
        )
        raise HTTPException(
            status_code=409,
            detail=f"Cannot delete: {bid_count} real user bids exist",
        )

    deleted = await db.auctions.delete_one({
        "auction_id": auction_id,
        "status": "deleting",
        "delete_claim_id": delete_claim_id,
    })
    if deleted.deleted_count != 1:
        raise HTTPException(status_code=409, detail="Auktion konnte nicht sicher gelöscht werden")

    # Cleanup only after the auction document is gone, so no new bid can attach.
    await db.auction_bids.delete_many({"auction_id": auction_id})
    await db.auto_bids.delete_many({"auction_id": auction_id})
    await db.watchlist.delete_many({"auction_id": auction_id})

    return {"ok": True, "deleted": auction_id}


async def _require_auction_product_editable(auction: dict) -> None:
    if not auction:
        raise HTTPException(status_code=404, detail="Auction not found")
    auction_id = str(auction.get("auction_id") or "")
    if auction.get("status") == "ended" or auction.get("winner_id"):
        raise HTTPException(status_code=409, detail="Beendete Auktionen können nicht mehr inhaltlich verändert werden")
    real_bid_count = await db.auction_bids.count_documents(
        {"auction_id": auction_id, "is_bot": {"$ne": True}}
    )
    if real_bid_count > 0:
        raise HTTPException(
            status_code=409,
            detail="Produktdaten sind nach dem ersten echten Gebot gesperrt",
        )


def _auction_product_edit_snapshot_filter(auction: dict) -> dict:
    return {
        "auction_id": auction.get("auction_id"),
        "status": auction.get("status"),
        "current_price": auction.get("current_price"),
        "ends_at": auction.get("ends_at"),
        "last_bidder_id": auction.get("last_bidder_id"),
        "total_bids": auction.get("total_bids"),
    }


class UpdateAuctionRequest(BaseModel):
    image_url: Optional[str] = None
    title: Optional[str] = None
    description: Optional[str] = None
    retail_price: Optional[float] = None
    featured: Optional[bool] = None
    bid_value_eur: Optional[float] = Field(default=None, ge=0.01, le=10.0)
    price_increment: Optional[float] = Field(default=None, ge=0.01, le=1.0)
    revenue_target_eur: Optional[float] = Field(default=None, ge=0.0, le=100000.0)
    product_cost_eur: Optional[float] = Field(default=None, ge=0.0, le=100000.0)
    shipping_cost_eur: Optional[float] = Field(default=None, ge=0.0, le=10000.0)
    other_costs_eur: Optional[float] = Field(default=None, ge=0.0, le=10000.0)
    target_net_profit_eur: Optional[float] = Field(default=None, ge=0.0, le=100000.0)


@router.patch("/admin/auction/{auction_id}")
async def update_auction(auction_id: str, req: UpdateAuctionRequest, request: Request):
    """Admin: Update auction details (image, title, description, retail price)."""
    user = await get_current_user(request)
    if user.get("role") not in {"admin", "super_admin"}:
        raise HTTPException(status_code=403, detail="Admin only")

    auction = await db.auctions.find_one({"auction_id": auction_id})
    await _require_auction_product_editable(auction)

    updates = {}
    if req.image_url is not None:
        updates["image_url"] = req.image_url.strip()
    if req.title is not None and req.title.strip():
        updates["title"] = req.title.strip()
    if req.description is not None:
        updates["description"] = req.description.strip()
    if req.retail_price is not None and req.retail_price > 0:
        if req.retail_price > 2000:
            raise HTTPException(status_code=400, detail="Maximaler Verkaufspreis ist €2000")
        updates["retail_price"] = float(req.retail_price)
    if req.featured is not None:
        updates["featured"] = bool(req.featured)
    if req.bid_value_eur is not None:
        updates["bid_value_eur"] = round(float(req.bid_value_eur), 2)
    if req.price_increment is not None:
        updates["price_increment"] = round(float(req.price_increment), 2)
    if req.revenue_target_eur is not None:
        updates["revenue_target_eur"] = round(float(req.revenue_target_eur), 2)
    if req.product_cost_eur is not None:
        updates["product_cost_eur"] = round(float(req.product_cost_eur), 2)
    if req.shipping_cost_eur is not None:
        updates["shipping_cost_eur"] = round(float(req.shipping_cost_eur), 2)
    if req.other_costs_eur is not None:
        updates["other_costs_eur"] = round(float(req.other_costs_eur), 2)
    if req.target_net_profit_eur is not None:
        updates["target_net_profit_eur"] = round(float(req.target_net_profit_eur), 2)

    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    changed = await db.auctions.update_one(
        _auction_product_edit_snapshot_filter(auction),
        {"$set": updates},
    )
    if changed.modified_count != 1:
        raise HTTPException(
            status_code=409,
            detail="Auktion erhielt gleichzeitig ein Gebot oder änderte den Status. Produktänderung wurde nicht angewendet.",
        )

    if updates.get("featured") is True:
        await db.auctions.update_many(
            {
                "auction_id": {"$ne": auction_id},
                "status": {"$in": ["active", "scheduled", "paused"]},
                "featured": True,
            },
            {"$set": {"featured": False}},
        )

    return {"ok": True, "auction_id": auction_id, "updated_fields": list(updates.keys())}


@router.post("/admin/auction/{auction_id}/upload-image")
async def upload_auction_image(auction_id: str, request: Request):
    """Admin: Upload a product image file for an auction (multipart/form-data)."""
    from fastapi import UploadFile, File
    user = await get_current_user(request)
    if user.get("role") not in {"admin", "super_admin"}:
        raise HTTPException(status_code=403, detail="Admin only")

    auction = await db.auctions.find_one({"auction_id": auction_id})
    await _require_auction_product_editable(auction)

    form = await request.form()
    file = form.get("file")
    if not file or not hasattr(file, "filename"):
        raise HTTPException(status_code=400, detail="No file provided")

    # Validate
    allowed = {"image/jpeg", "image/png", "image/webp", "image/gif"}
    if file.content_type not in allowed:
        raise HTTPException(status_code=400, detail=f"Unsupported file type. Allowed: {', '.join(allowed)}")

    contents = await file.read()
    if len(contents) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large (max 10MB)")

    # Store to local uploads dir (served via /api/uploads)
    uploads_dir = Path(__file__).parent.parent / "uploads" / "auctions"
    uploads_dir.mkdir(parents=True, exist_ok=True)

    ext = file.filename.split(".")[-1].lower() if "." in file.filename else "jpg"
    filename = f"{auction_id}_{secrets.token_hex(4)}.{ext}"
    filepath = uploads_dir / filename
    with open(filepath, "wb") as f:
        f.write(contents)

    # Public URL (served by FastAPI static mount at /api/uploads)
    image_url = f"/api/uploads/auctions/{filename}"
    changed = await db.auctions.update_one(
        _auction_product_edit_snapshot_filter(auction),
        {"$set": {"image_url": image_url, "updated_at": datetime.now(timezone.utc).isoformat()}},
    )
    if changed.modified_count != 1:
        try:
            filepath.unlink(missing_ok=True)
        except Exception:
            pass
        raise HTTPException(
            status_code=409,
            detail="Auktion erhielt gleichzeitig ein Gebot oder änderte den Status. Bildänderung wurde nicht angewendet.",
        )

    return {"ok": True, "auction_id": auction_id, "image_url": image_url}


@router.get("/admin/stats/overview")
async def get_auction_stats(request: Request):
    """Admin: Get comprehensive auction statistics."""
    user = await get_current_user(request)
    if user.get("role") not in {"admin", "super_admin"}:
        raise HTTPException(status_code=403, detail="Admin only")
    
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    
    # Counts
    total_auctions = await db.auctions.count_documents({})
    active_auctions = await db.auctions.count_documents({"status": "active"})
    scheduled_auctions = await db.auctions.count_documents({"status": "scheduled"})
    paused_auctions = await db.auctions.count_documents({"status": "paused"})
    ended_auctions = await db.auctions.count_documents({"status": "ended"})
    
    # Bids
    total_bids = await db.auction_bids.count_documents({})
    real_bids = await db.auction_bids.count_documents({"is_bot": {"$ne": True}})
    bot_bids = await db.auction_bids.count_documents({"is_bot": True})
    bids_today = await db.auction_bids.count_documents({"created_at": {"$gte": today_start}})
    
    # Revenue (each bid = €0.50 revenue from credit purchase)
    revenue_estimate = round(real_bids * 0.50, 2)
    
    # Winners
    auctions_with_winner = await db.auctions.count_documents({"winner_id": {"$ne": None}})
    
    # Credit purchases
    credit_txns = await db.transactions.find({
        "type": "auction_bid",
        "status": "completed"
    }).to_list(1000)
    total_credit_revenue = sum(abs(t.get("amount", 0)) for t in credit_txns)
    
    return {
        "auctions": {
            "total": total_auctions,
            "active": active_auctions,
            "scheduled": scheduled_auctions,
            "paused": paused_auctions,
            "ended": ended_auctions,
            "with_winner": auctions_with_winner,
        },
        "bids": {
            "total": total_bids,
            "real_users": real_bids,
            "bots": bot_bids,
            "today": bids_today,
        },
        "revenue": {
            "estimated_from_bids": revenue_estimate,
            "total_credit_purchases": round(total_credit_revenue, 2),
        },
        "catalog_size": len(ACTIVE_AUCTION_CATALOG),
    }
