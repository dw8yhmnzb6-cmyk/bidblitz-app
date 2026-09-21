"""
BidBlitz V2 — Mining Phase 2: Marketplace, Card, Launchpad
"""

import secrets
import hashlib
from typing import Optional
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from core.database import db
from core.config import TEST_MODE
from core.security import get_current_user
from routes.mining import _require_mining_value_mode, _mining_capabilities, _safe_mining_float, get_vip_level

router = APIRouter(prefix="/api/mining", tags=["mining-phase2"])

BLZ_TO_EUR = 0.10


# ══════════════════════════════════════
# MARKETPLACE — Buy/Sell Miners
# ══════════════════════════════════════

class ListMinerRequest(BaseModel):
    miner_id: str
    price_blz: float = Field(..., gt=0, le=1000000)


class BuyListingRequest(BaseModel):
    listing_id: str
    idempotency_key: Optional[str] = None


@router.get("/marketplace")
async def get_marketplace(request: Request):
    """Preview marketplace; real BLZ trading is test-only until provider integration."""
    await get_current_user(request)
    if not TEST_MODE:
        return {"listings": [], "capabilities": _mining_capabilities()}
    listings = await db.mining_marketplace.find(
        {"status": "active"}, {"_id": 0}
    ).sort("listed_at", -1).to_list(50)
    return {"listings": listings, "capabilities": _mining_capabilities()}


@router.post("/marketplace/list")
async def list_miner_for_sale(req: ListMinerRequest, request: Request):
    """List one owned miner with an atomic active→listed transition."""
    _require_mining_value_mode()
    user = await get_current_user(request)
    user_id = str(user["_id"])
    price_blz = round(float(req.price_blz), 4)

    miner = await db.mining_miners.find_one({"miner_id": req.miner_id, "user_id": user_id})
    if not miner:
        raise HTTPException(status_code=404, detail="Miner not found")

    if miner.get("status") == "listed":
        listing_id = miner.get("marketplace_listing_id")
        listed_price = round(float(miner.get("marketplace_listing_price_blz") or 0), 4)
        if listing_id and listed_price == price_blz:
            existing = await db.mining_marketplace.find_one({"listing_id": listing_id}, {"_id": 0})
            if existing:
                return {"listing": existing, "replayed": True}
            # Recover a crash after the miner reservation but before listing persistence.
        else:
            raise HTTPException(status_code=409, detail="Miner already listed")
    elif miner.get("status") != "active":
        raise HTTPException(status_code=409, detail="Miner is not available for listing")
    else:
        listing_id = secrets.token_hex(6)
        reserved = await db.mining_miners.update_one(
            {"miner_id": req.miner_id, "user_id": user_id, "status": "active"},
            {"$set": {
                "status": "listed",
                "marketplace_listing_id": listing_id,
                "marketplace_listing_price_blz": price_blz,
                "marketplace_listed_at": datetime.now(timezone.utc).isoformat(),
            }},
        )
        if reserved.modified_count != 1:
            fresh = await db.mining_miners.find_one({"miner_id": req.miner_id, "user_id": user_id}) or {}
            if (
                fresh.get("status") == "listed"
                and fresh.get("marketplace_listing_id")
                and round(float(fresh.get("marketplace_listing_price_blz") or 0), 4) == price_blz
            ):
                listing_id = fresh["marketplace_listing_id"]
                miner = fresh
            else:
                raise HTTPException(status_code=409, detail="Miner listing state changed")

    now = datetime.now(timezone.utc).isoformat()
    listing = {
        "listing_id": listing_id,
        "miner_id": req.miner_id,
        "seller_id": user_id,
        "seller_name": user.get("name", "Anonymous"),
        "miner_name": miner.get("name", ""),
        "package_id": miner.get("package_id", ""),
        "hashrate": miner.get("hashrate", 0),
        "efficiency": miner.get("efficiency", 0),
        "power_level": miner.get("power_level", 0),
        "efficiency_level": miner.get("efficiency_level", 0),
        "icon": miner.get("icon", "cpu"),
        "price_blz": price_blz,
        "price_eur": round(price_blz * BLZ_TO_EUR, 2),
        "status": "active",
        "listed_at": now,
    }
    try:
        await db.mining_marketplace.update_one(
            {"listing_id": listing_id},
            {"$setOnInsert": listing},
            upsert=True,
        )
    except Exception as exc:
        rolled_back = await db.mining_miners.update_one(
            {
                "miner_id": req.miner_id,
                "user_id": user_id,
                "status": "listed",
                "marketplace_listing_id": listing_id,
            },
            {
                "$set": {"status": "active"},
                "$unset": {
                    "marketplace_listing_id": "",
                    "marketplace_listing_price_blz": "",
                    "marketplace_listed_at": "",
                },
            },
        )
        if rolled_back.modified_count != 1:
            raise HTTPException(
                status_code=503,
                detail="Listing-Speicherung fehlgeschlagen; Miner-Zustand benötigt Abstimmung",
            ) from exc
        raise HTTPException(status_code=500, detail="Listing konnte nicht sicher gespeichert werden") from exc

    stored = await db.mining_marketplace.find_one({"listing_id": listing_id}, {"_id": 0}) or listing
    if (
        stored.get("miner_id") != req.miner_id
        or stored.get("seller_id") != user_id
        or round(float(stored.get("price_blz") or 0), 4) != price_blz
    ):
        raise HTTPException(status_code=503, detail="Listing-Daten benötigen Abstimmung")
    return {"listing": stored, "replayed": miner.get("status") == "listed" and bool(miner.get("marketplace_listing_id"))}


@router.post("/marketplace/buy")
async def buy_marketplace_listing(req: BuyListingRequest, request: Request):
    """Buy one active listing exactly once and resume safely after partial completion."""
    _require_mining_value_mode()
    user = await get_current_user(request)
    user_id = str(user["_id"])

    raw_key = (req.idempotency_key or request.headers.get("Idempotency-Key") or "").strip()
    if not 8 <= len(raw_key) <= 200:
        raise HTTPException(status_code=400, detail="Idempotency-Key erforderlich")
    purchase_id = "MINMKT-" + hashlib.sha256(
        f"{user_id}:{req.listing_id}:{raw_key}".encode("utf-8")
    ).hexdigest()[:20].upper()

    existing_purchase = await db.mining_marketplace_purchases.find_one({"_id": purchase_id}, {"_id": 0})
    if existing_purchase and existing_purchase.get("listing_id") != req.listing_id:
        raise HTTPException(status_code=409, detail="Idempotency-Key wurde mit anderen Daten verwendet")
    if existing_purchase and existing_purchase.get("buyer_id") not in (None, user_id):
        raise HTTPException(status_code=409, detail="Idempotency-Key gehört zu einem anderen Käufer")
    if existing_purchase and existing_purchase.get("status") == "reconciliation_required":
        raise HTTPException(status_code=503, detail="Marketplace-Kauf benötigt Abstimmung; keine erneute Belastung wird ausgeführt")
    if existing_purchase and existing_purchase.get("status") in {"failed", "failed_refunded", "refunded"}:
        raise HTTPException(status_code=409, detail="Früherer Marketplace-Kauf wurde beendet oder zurückgebucht")

    listing = await db.mining_marketplace.find_one({"listing_id": req.listing_id})
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    if listing.get("seller_id") == user_id:
        raise HTTPException(status_code=400, detail="Cannot buy your own listing")

    await db.mining_marketplace_purchases.update_one(
        {"_id": purchase_id},
        {"$setOnInsert": {
            "_id": purchase_id,
            "listing_id": req.listing_id,
            "buyer_id": user_id,
            "seller_id": listing.get("seller_id"),
            "miner_id": listing.get("miner_id"),
            "miner_name": listing.get("miner_name"),
            "price_blz": float(listing.get("price_blz") or 0),
            "status": "pending",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }},
        upsert=True,
    )
    purchase = await db.mining_marketplace_purchases.find_one({"_id": purchase_id}, {"_id": 0}) or {}
    if purchase.get("listing_id") != req.listing_id or purchase.get("buyer_id") != user_id:
        raise HTTPException(status_code=409, detail="Marketplace-Kaufdaten stimmen nicht mit dem Idempotency-Key überein")

    price = round(float(purchase.get("price_blz") or listing.get("price_blz") or 0), 4)
    seller_id = str(purchase.get("seller_id") or listing.get("seller_id") or "")
    miner_id = purchase.get("miner_id") or listing.get("miner_id")
    miner_name = purchase.get("miner_name") or listing.get("miner_name") or ""
    if price <= 0 or not seller_id or not miner_id:
        await db.mining_marketplace_purchases.update_one(
            {"_id": purchase_id},
            {"$set": {"status": "reconciliation_required", "reason": "invalid_persisted_purchase_data"}},
        )
        raise HTTPException(status_code=503, detail="Marketplace-Kaufdaten benötigen Abstimmung")

    async def record_marketplace_transactions(now_iso: str) -> None:
        for suffix, uid, amt, tx_type, desc in [
            ("BUY", user_id, -price, "marketplace_buy", f"Bought {miner_name} on marketplace"),
            ("SELL", seller_id, price, "marketplace_sell", f"Sold {miner_name} on marketplace"),
        ]:
            await db.mining_transactions.update_one(
                {"txn_id": f"{purchase_id}-{suffix}"},
                {"$setOnInsert": {
                    "txn_id": f"{purchase_id}-{suffix}",
                    "user_id": uid,
                    "type": tx_type,
                    "amount_blz": amt,
                    "description": desc,
                    "purchase_id": purchase_id,
                    "created_at": now_iso,
                }},
                upsert=True,
            )

    if purchase.get("status") == "completed":
        await record_marketplace_transactions(purchase.get("completed_at") or datetime.now(timezone.utc).isoformat())
        return {"ok": True, "miner_name": miner_name, "purchase_id": purchase_id, "replayed": True}

    listing_status = listing.get("status")
    if listing_status == "sold":
        if listing.get("purchase_id") != purchase_id or listing.get("buyer_id") != user_id:
            raise HTTPException(status_code=409, detail="Listing wurde von einem anderen Kauf abgeschlossen")
        now = listing.get("sold_at") or datetime.now(timezone.utc).isoformat()
        await db.mining_marketplace_purchases.update_one(
            {"_id": purchase_id},
            {"$set": {"status": "completed", "completed_at": now}},
        )
        await record_marketplace_transactions(now)
        return {"ok": True, "miner_name": miner_name, "purchase_id": purchase_id, "replayed": True}

    if listing_status == "active":
        claim = await db.mining_marketplace.update_one(
            {
                "listing_id": req.listing_id,
                "status": "active",
                "seller_id": seller_id,
            },
            {"$set": {
                "status": "processing",
                "purchase_id": purchase_id,
                "buyer_id": user_id,
                "purchase_started_at": datetime.now(timezone.utc).isoformat(),
            }},
        )
        if claim.modified_count != 1:
            listing = await db.mining_marketplace.find_one({"listing_id": req.listing_id}) or {}
            listing_status = listing.get("status")
        else:
            listing_status = "processing"

    if listing_status != "processing" or listing.get("purchase_id") not in (None, purchase_id) or listing.get("buyer_id") not in (None, user_id):
        current = await db.mining_marketplace.find_one({"listing_id": req.listing_id}, {"_id": 0}) or {}
        if current.get("status") == "processing" and current.get("purchase_id") == purchase_id and current.get("buyer_id") == user_id:
            listing = current
        else:
            raise HTTPException(status_code=409, detail="Listing wird bereits gekauft oder ist nicht mehr verfügbar")

    buyer_marker = f"marketplace_purchase_markers.{purchase_id}"
    buyer_debit = await db.mining_wallets.update_one(
        {
            "user_id": user_id,
            "blz_balance": {"$gte": price},
            buyer_marker: {"$exists": False},
        },
        {
            "$inc": {"blz_balance": -price},
            "$set": {buyer_marker: {
                "listing_id": req.listing_id,
                "amount_blz": price,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }},
        },
    )
    if buyer_debit.modified_count != 1:
        existing_debit = await db.mining_wallets.find_one(
            {"user_id": user_id, buyer_marker: {"$exists": True}},
            {"_id": 1},
        )
        if not existing_debit:
            await db.mining_marketplace.update_one(
                {"listing_id": req.listing_id, "status": "processing", "purchase_id": purchase_id},
                {"$set": {"status": "active"}, "$unset": {"purchase_id": "", "buyer_id": "", "purchase_started_at": ""}},
            )
            await db.mining_marketplace_purchases.update_one(
                {"_id": purchase_id},
                {"$set": {"status": "failed", "reason": "insufficient_blz"}},
            )
            raise HTTPException(status_code=400, detail="Insufficient BLZ balance")

    ownership = await db.mining_miners.update_one(
        {
            "miner_id": miner_id,
            "user_id": seller_id,
            "status": "listed",
        },
        {
            "$set": {"user_id": user_id, "status": "active", "marketplace_purchase_id": purchase_id},
            "$unset": {
                "marketplace_listing_id": "",
                "marketplace_listing_price_blz": "",
                "marketplace_listed_at": "",
            },
        },
    )
    if ownership.modified_count != 1:
        fresh_miner = await db.mining_miners.find_one({"miner_id": miner_id}) or {}
        ownership_already_applied = (
            str(fresh_miner.get("user_id") or "") == user_id
            and fresh_miner.get("status") == "active"
            and fresh_miner.get("marketplace_purchase_id") == purchase_id
        )
        if not ownership_already_applied:
            refund_marker = f"marketplace_purchase_refunds.{purchase_id}"
            refund = await db.mining_wallets.update_one(
                {
                    "user_id": user_id,
                    buyer_marker: {"$exists": True},
                    refund_marker: {"$exists": False},
                },
                {
                    "$inc": {"blz_balance": price},
                    "$set": {refund_marker: {
                        "amount_blz": price,
                        "created_at": datetime.now(timezone.utc).isoformat(),
                    }},
                },
            )
            refund_wallet = await db.mining_wallets.find_one({"user_id": user_id}) or {}
            refund_confirmed = refund.modified_count == 1 or bool(
                (refund_wallet.get("marketplace_purchase_refunds") or {}).get(purchase_id)
            )
            if not refund_confirmed:
                await db.mining_marketplace_purchases.update_one(
                    {"_id": purchase_id},
                    {"$set": {"status": "reconciliation_required", "reason": "ownership_failed_refund_not_confirmed"}},
                )
                raise HTTPException(status_code=503, detail="Marketplace-Kauf benötigt Abstimmung; Rückbuchung nicht bestätigt")

            if str(fresh_miner.get("user_id") or "") == seller_id and fresh_miner.get("status") == "listed":
                await db.mining_marketplace.update_one(
                    {"listing_id": req.listing_id, "status": "processing", "purchase_id": purchase_id},
                    {"$set": {"status": "active"}, "$unset": {"purchase_id": "", "buyer_id": "", "purchase_started_at": ""}},
                )
                await db.mining_marketplace_purchases.update_one(
                    {"_id": purchase_id},
                    {"$set": {"status": "failed_refunded", "reason": "ownership_transfer_failed"}},
                )
                raise HTTPException(status_code=409, detail="Miner ownership changed; BLZ wurden zurückgebucht")

            await db.mining_marketplace_purchases.update_one(
                {"_id": purchase_id},
                {"$set": {"status": "reconciliation_required", "reason": "ownership_state_unclear_after_refund"}},
            )
            raise HTTPException(status_code=503, detail="BLZ wurden zurückgebucht; Miner-Ownership benötigt Abstimmung")

    seller_marker = f"marketplace_sale_markers.{purchase_id}"
    await db.mining_wallets.update_one(
        {"user_id": seller_id},
        {"$setOnInsert": {"user_id": seller_id, "blz_balance": 0.0}},
        upsert=True,
    )
    seller_credit = await db.mining_wallets.update_one(
        {"user_id": seller_id, seller_marker: {"$exists": False}},
        {
            "$inc": {"blz_balance": price},
            "$set": {seller_marker: {
                "listing_id": req.listing_id,
                "amount_blz": price,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }},
        },
    )
    if seller_credit.modified_count != 1:
        existing_credit = await db.mining_wallets.find_one(
            {"user_id": seller_id, seller_marker: {"$exists": True}},
            {"_id": 1},
        )
        if not existing_credit:
            await db.mining_marketplace_purchases.update_one(
                {"_id": purchase_id},
                {"$set": {"status": "reconciliation_required", "reason": "seller_credit_failed"}},
            )
            raise HTTPException(status_code=503, detail="Miner übertragen; Verkäufergutschrift benötigt Abstimmung")

    now = datetime.now(timezone.utc).isoformat()
    finalized = await db.mining_marketplace.update_one(
        {"listing_id": req.listing_id, "status": "processing", "purchase_id": purchase_id, "buyer_id": user_id},
        {"$set": {"status": "sold", "sold_at": now}},
    )
    if finalized.modified_count != 1:
        current = await db.mining_marketplace.find_one({"listing_id": req.listing_id}, {"_id": 0}) or {}
        if not (current.get("status") == "sold" and current.get("purchase_id") == purchase_id and current.get("buyer_id") == user_id):
            await db.mining_marketplace_purchases.update_one(
                {"_id": purchase_id},
                {"$set": {"status": "reconciliation_required", "reason": "listing_finalize_failed"}},
            )
            raise HTTPException(status_code=503, detail="Zahlung abgeschlossen; Listing-Abschluss benötigt Abstimmung")

    await db.mining_marketplace_purchases.update_one(
        {"_id": purchase_id},
        {"$set": {"status": "completed", "completed_at": now}},
    )
    await record_marketplace_transactions(now)

    return {"ok": True, "miner_name": miner_name, "purchase_id": purchase_id, "replayed": bool(existing_purchase)}


@router.post("/marketplace/cancel")
async def cancel_listing(req: BuyListingRequest, request: Request):
    """Cancel an owned listing with retry-safe miner restoration."""
    _require_mining_value_mode()
    user = await get_current_user(request)
    user_id = str(user["_id"])

    listing = await db.mining_marketplace.find_one({"listing_id": req.listing_id})
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    if listing.get("seller_id") != user_id:
        raise HTTPException(status_code=403, detail="Not your listing")
    if listing.get("status") == "cancelled":
        await db.mining_miners.update_one(
            {
                "miner_id": listing["miner_id"],
                "user_id": user_id,
                "status": "listed",
                "marketplace_listing_id": req.listing_id,
            },
            {
                "$set": {"status": "active"},
                "$unset": {
                    "marketplace_listing_id": "",
                    "marketplace_listing_price_blz": "",
                    "marketplace_listed_at": "",
                },
            },
        )
        return {"ok": True, "replayed": True}
    if listing.get("status") not in {"active", "cancelling"}:
        raise HTTPException(status_code=409, detail="Listing wird bereits gekauft oder ist nicht mehr stornierbar")

    if listing.get("status") == "active":
        claimed = await db.mining_marketplace.update_one(
            {"listing_id": req.listing_id, "seller_id": user_id, "status": "active"},
            {"$set": {"status": "cancelling", "cancel_started_at": datetime.now(timezone.utc).isoformat()}},
        )
        if claimed.modified_count != 1:
            listing = await db.mining_marketplace.find_one({"listing_id": req.listing_id}) or {}
            if listing.get("status") not in {"cancelling", "cancelled"}:
                raise HTTPException(status_code=409, detail="Listing wird bereits verarbeitet oder wurde verkauft")

    restored = await db.mining_miners.update_one(
        {
            "miner_id": listing["miner_id"],
            "user_id": user_id,
            "status": "listed",
            "marketplace_listing_id": req.listing_id,
        },
        {
            "$set": {"status": "active"},
            "$unset": {
                "marketplace_listing_id": "",
                "marketplace_listing_price_blz": "",
                "marketplace_listed_at": "",
            },
        },
    )
    if restored.modified_count != 1:
        miner = await db.mining_miners.find_one({"miner_id": listing["miner_id"], "user_id": user_id}) or {}
        if miner.get("status") != "active":
            raise HTTPException(status_code=503, detail="Listing-Cancel benötigt Abstimmung; Miner wurde nicht freigegeben")

    finalized = await db.mining_marketplace.update_one(
        {"listing_id": req.listing_id, "seller_id": user_id, "status": "cancelling"},
        {"$set": {"status": "cancelled", "cancelled_at": datetime.now(timezone.utc).isoformat()}},
    )
    if finalized.modified_count != 1:
        current = await db.mining_marketplace.find_one({"listing_id": req.listing_id}, {"_id": 0}) or {}
        if current.get("status") != "cancelled":
            raise HTTPException(status_code=503, detail="Miner wurde freigegeben; Listing-Abschluss benötigt Abstimmung")

    return {"ok": True, "replayed": listing.get("status") == "cancelling"}


# ══════════════════════════════════════
# CARD — Virtual BLZ Spending Card
# ══════════════════════════════════════

CARD_TIERS = [
    {"tier": "standard", "name": "Standard", "color": "#C0C0C0", "daily_limit": 100, "cashback": 0.01, "cost_blz": 0},
    {"tier": "gold", "name": "Gold", "color": "#FFD700", "daily_limit": 500, "cashback": 0.02, "cost_blz": 50},
    {"tier": "platinum", "name": "Platinum", "color": "#E5E4E2", "daily_limit": 2000, "cashback": 0.03, "cost_blz": 200},
    {"tier": "black", "name": "Black", "color": "#1A1A1A", "daily_limit": 10000, "cashback": 0.05, "cost_blz": 1000},
]


@router.get("/card")
async def get_mining_card(request: Request):
    """Mining card is a test simulator only until a real issuer exists."""
    user = await get_current_user(request)
    if not TEST_MODE:
        return {
            "has_card": False,
            "issuer_live": False,
            "capabilities": _mining_capabilities(),
            "message": "Mining Card ist in Production deaktiviert, bis ein verifizierter Karten-Issuer verbunden ist.",
        }
    user_id = str(user["_id"])
    card = await db.mining_cards.find_one({"user_id": user_id}, {"_id": 0})
    if not card:
        tier = CARD_TIERS[0]
        card = {
            "user_id": user_id,
            "tier": tier["tier"],
            "tier_name": tier["name"],
            "color": tier["color"],
            "daily_limit": tier["daily_limit"],
            "cashback_rate": tier["cashback"],
            "total_spent": 0.0,
            "total_cashback": 0.0,
            "frozen": False,
            "is_demo": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.mining_cards.insert_one(dict(card))
        card.pop("_id", None)
    demo_card_id = f"demo_{hashlib.sha256(user_id.encode('utf-8')).hexdigest()[:12]}"
    card = {
        **card,
        "card_number": str(card.get("card_number") or "TEST •••• 0000"),
        "card_id": str(card.get("card_id") or demo_card_id),
        "is_demo": True,
        "daily_limit": _safe_mining_float(card.get("daily_limit"), 100.0),
        "cashback_rate": _safe_mining_float(card.get("cashback_rate"), 0.01),
        "total_spent": _safe_mining_float(card.get("total_spent")),
        "total_cashback": _safe_mining_float(card.get("total_cashback")),
    }
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    recent_transactions = await db.mining_card_txns.find(
        {"user_id": user_id},
        {"_id": 0},
    ).sort("created_at", -1).limit(20).to_list(20)
    daily_spend = card.get("daily_spend_eur") if isinstance(card.get("daily_spend_eur"), dict) else {}
    has_persisted_daily_spend = today in daily_spend
    today_spent = _safe_mining_float(daily_spend.get(today)) if has_persisted_daily_spend else 0.0
    legacy_today_spent = 0.0
    for tx in recent_transactions:
        tx["amount_eur"] = _safe_mining_float(tx.get("amount_eur"))
        tx["amount_blz"] = _safe_mining_float(tx.get("amount_blz"))
        tx["cashback_blz"] = _safe_mining_float(tx.get("cashback_blz"))
        if str(tx.get("date") or "") == today:
            legacy_today_spent += tx["amount_eur"]
    if not has_persisted_daily_spend:
        today_spent = legacy_today_spent

    return {
        "has_card": True,
        "card": card,
        "tiers": CARD_TIERS,
        "remaining_limit": round(max(0.0, card["daily_limit"] - today_spent), 2),
        "recent_transactions": recent_transactions,
        "issuer_live": False,
        "capabilities": _mining_capabilities(),
    }

class CardSpendRequest(BaseModel):
    amount_eur: float = Field(..., gt=0, le=10000)
    merchant: str = Field("", max_length=100)
    idempotency_key: Optional[str] = None


@router.post("/card/spend")
async def card_spend(req: CardSpendRequest, request: Request):
    """Simulate a test-card payment exactly once; production remains disabled."""
    _require_mining_value_mode()
    user = await get_current_user(request)
    user_id = str(user["_id"])
    raw_key = (req.idempotency_key or request.headers.get("Idempotency-Key") or "").strip()
    if not 8 <= len(raw_key) <= 200:
        raise HTTPException(status_code=400, detail="Idempotency-Key erforderlich")

    amount_eur = round(float(req.amount_eur), 2)
    merchant = (req.merchant or "Purchase").strip() or "Purchase"
    operation_hash = hashlib.sha256(f"{user_id}:{raw_key}".encode("utf-8")).hexdigest()[:20]
    operation_id = f"MCSP-{operation_hash.upper()}"
    operation_key = f"mining-card-spend:{user_id}:{raw_key}"
    now = datetime.now(timezone.utc).isoformat()

    await db.mining_card_operations.update_one(
        {"_id": operation_id},
        {"$setOnInsert": {
            "_id": operation_id,
            "kind": "spend",
            "user_id": user_id,
            "amount_eur": amount_eur,
            "merchant": merchant,
            "idempotency_key": operation_key,
            "status": "processing",
            "created_at": now,
        }},
        upsert=True,
    )
    operation = await db.mining_card_operations.find_one({"_id": operation_id}, {"_id": 0}) or {}
    if (
        operation.get("kind") != "spend"
        or round(_safe_mining_float(operation.get("amount_eur")), 2) != amount_eur
        or str(operation.get("merchant") or "") != merchant
    ):
        raise HTTPException(status_code=409, detail="Idempotency-Key wurde mit anderen Kartendaten verwendet")
    if operation.get("status") == "completed":
        return {
            "ok": True,
            "spent_eur": amount_eur,
            "spent_blz": _safe_mining_float(operation.get("spent_blz")),
            "cashback_blz": _safe_mining_float(operation.get("cashback_blz")),
            "operation_id": operation_id,
            "replayed": True,
        }
    if operation.get("status") == "reconciliation_required":
        raise HTTPException(status_code=503, detail="Kartenzahlung benötigt Abstimmung; keine erneute Belastung wird ausgeführt")
    if operation.get("status") == "failed":
        raise HTTPException(status_code=400, detail=operation.get("error") or "Kartenzahlung fehlgeschlagen")

    card = await db.mining_cards.find_one({"user_id": user_id})
    if not card:
        await db.mining_card_operations.update_one({"_id": operation_id}, {"$set": {"status": "failed", "error": "No card found"}})
        raise HTTPException(status_code=404, detail="No card found")
    if card.get("frozen"):
        await db.mining_card_operations.update_one({"_id": operation_id}, {"$set": {"status": "failed", "error": "Card is frozen"}})
        raise HTTPException(status_code=400, detail="Card is frozen")

    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    daily_limit = _safe_mining_float(card.get("daily_limit"), 100.0)
    cashback_rate = _safe_mining_float(card.get("cashback_rate"), 0.01)
    blz_needed = round(amount_eur / BLZ_TO_EUR, 8)
    cashback_blz = round(blz_needed * cashback_rate, 8)
    net_blz_debit = round(blz_needed - cashback_blz, 8)
    card_marker = f"card_spend_markers.{operation_hash}"
    daily_field = f"daily_spend_eur.{today}"

    existing_card_marker = (card.get("card_spend_markers") or {}).get(operation_hash)
    if not existing_card_marker:
        remaining_before = round(max(0.0, daily_limit - amount_eur), 2)
        reserved = await db.mining_cards.update_one(
            {
                "user_id": user_id,
                "frozen": {"$ne": True},
                card_marker: {"$exists": False},
                "$or": [
                    {daily_field: {"$exists": False}},
                    {daily_field: {"$lte": remaining_before}},
                ],
            },
            {
                "$inc": {daily_field: amount_eur, "total_spent": amount_eur},
                "$set": {card_marker: {
                    "operation_id": operation_id,
                    "status": "reserved",
                    "amount_eur": amount_eur,
                    "reserved_at": now,
                }},
            },
        )
        if reserved.modified_count != 1:
            fresh_card = await db.mining_cards.find_one({"user_id": user_id}) or {}
            fresh_marker = (fresh_card.get("card_spend_markers") or {}).get(operation_hash)
            if not fresh_marker:
                error = "Card is frozen" if fresh_card.get("frozen") else "Daily limit exceeded"
                await db.mining_card_operations.update_one(
                    {"_id": operation_id},
                    {"$set": {"status": "failed", "error": error, "failed_at": datetime.now(timezone.utc).isoformat()}},
                )
                raise HTTPException(status_code=400, detail=error)

    wallet_marker = f"card_spend_debits.{operation_hash}"
    debit = await db.mining_wallets.update_one(
        {
            "user_id": user_id,
            "blz_balance": {"$gte": net_blz_debit},
            wallet_marker: {"$exists": False},
        },
        {
            "$inc": {"blz_balance": -net_blz_debit},
            "$set": {wallet_marker: {
                "operation_id": operation_id,
                "amount_blz": net_blz_debit,
                "debited_at": datetime.now(timezone.utc).isoformat(),
            }},
        },
    )
    if debit.modified_count != 1:
        wallet = await db.mining_wallets.find_one({"user_id": user_id}) or {}
        existing_debit = (wallet.get("card_spend_debits") or {}).get(operation_hash)
        if not existing_debit:
            rolled_back = await db.mining_cards.update_one(
                {"user_id": user_id, f"{card_marker}.status": "reserved"},
                {
                    "$inc": {daily_field: -amount_eur, "total_spent": -amount_eur},
                    "$set": {
                        f"{card_marker}.status": "failed",
                        f"{card_marker}.error": "insufficient_blz",
                        f"{card_marker}.rolled_back_at": datetime.now(timezone.utc).isoformat(),
                    },
                },
            )
            if rolled_back.modified_count != 1:
                await db.mining_card_operations.update_one(
                    {"_id": operation_id},
                    {"$set": {
                        "status": "reconciliation_required",
                        "error": "wallet_debit_failed_card_reservation_unclear",
                        "reconciliation_required_at": datetime.now(timezone.utc).isoformat(),
                    }},
                )
                raise HTTPException(status_code=503, detail="Kartenzahlungszustand unklar; Abstimmung erforderlich")
            await db.mining_card_operations.update_one(
                {"_id": operation_id},
                {"$set": {"status": "failed", "error": "Insufficient BLZ balance", "failed_at": datetime.now(timezone.utc).isoformat()}},
            )
            raise HTTPException(status_code=400, detail="Insufficient BLZ balance")

    summary = await db.mining_cards.update_one(
        {
            "user_id": user_id,
            f"{card_marker}.status": "reserved",
            f"{card_marker}.summary_applied": {"$ne": True},
        },
        {
            "$inc": {"total_cashback": cashback_blz},
            "$set": {
                f"{card_marker}.summary_applied": True,
                f"{card_marker}.summary_applied_at": datetime.now(timezone.utc).isoformat(),
            },
        },
    )
    if summary.modified_count != 1:
        fresh_card = await db.mining_cards.find_one({"user_id": user_id}) or {}
        fresh_marker = (fresh_card.get("card_spend_markers") or {}).get(operation_hash) or {}
        if not fresh_marker.get("summary_applied"):
            await db.mining_card_operations.update_one(
                {"_id": operation_id},
                {"$set": {
                    "status": "reconciliation_required",
                    "error": "card_summary_not_confirmed",
                    "reconciliation_required_at": datetime.now(timezone.utc).isoformat(),
                }},
            )
            raise HTTPException(status_code=503, detail="Kartenzahlung belastet; Kartenstatus benötigt Abstimmung")

    await db.mining_card_txns.update_one(
        {"txn_id": operation_id},
        {"$setOnInsert": {
            "txn_id": operation_id,
            "user_id": user_id,
            "amount_eur": amount_eur,
            "amount_blz": blz_needed,
            "cashback_blz": cashback_blz,
            "merchant": merchant,
            "date": today,
            "idempotency_key": operation_key,
            "created_at": now,
        }},
        upsert=True,
    )
    completed_at = datetime.now(timezone.utc).isoformat()
    await db.mining_cards.update_one(
        {"user_id": user_id, card_marker: {"$exists": True}},
        {"$set": {f"{card_marker}.status": "completed", f"{card_marker}.completed_at": completed_at}},
    )
    await db.mining_card_operations.update_one(
        {"_id": operation_id},
        {"$set": {
            "status": "completed",
            "spent_blz": blz_needed,
            "cashback_blz": cashback_blz,
            "completed_at": completed_at,
        }},
    )

    return {
        "ok": True,
        "spent_eur": amount_eur,
        "spent_blz": blz_needed,
        "cashback_blz": cashback_blz,
        "operation_id": operation_id,
        "replayed": False,
    }


class UpgradeCardRequest(BaseModel):
    tier: str
    idempotency_key: Optional[str] = None


@router.post("/card/upgrade")
async def upgrade_card(req: UpgradeCardRequest, request: Request):
    """Upgrade the test card tier exactly once; production remains disabled."""
    _require_mining_value_mode()
    user = await get_current_user(request)
    user_id = str(user["_id"])
    raw_key = (req.idempotency_key or request.headers.get("Idempotency-Key") or "").strip()
    if not 8 <= len(raw_key) <= 200:
        raise HTTPException(status_code=400, detail="Idempotency-Key erforderlich")

    target = next((t for t in CARD_TIERS if t["tier"] == req.tier), None)
    if not target:
        raise HTTPException(status_code=400, detail="Invalid tier")

    card = await db.mining_cards.find_one({"user_id": user_id})
    if not card:
        raise HTTPException(status_code=404, detail="No card found")

    operation_hash = hashlib.sha256(f"{user_id}:{raw_key}".encode("utf-8")).hexdigest()[:20]
    operation_id = f"MCUP-{operation_hash.upper()}"
    operation_key = f"mining-card-upgrade:{user_id}:{raw_key}"
    operation = await db.mining_card_operations.find_one({"_id": operation_id}, {"_id": 0})
    if operation:
        if operation.get("kind") != "upgrade" or operation.get("target_tier") != req.tier:
            raise HTTPException(status_code=409, detail="Idempotency-Key wurde mit anderen Upgrade-Daten verwendet")
        if operation.get("status") == "completed":
            return {"ok": True, "new_tier": operation.get("new_tier"), "operation_id": operation_id, "replayed": True}
        if operation.get("status") == "reconciliation_required":
            raise HTTPException(status_code=503, detail="Karten-Upgrade benötigt Abstimmung; keine erneute Belastung wird ausgeführt")
        if operation.get("status") in ("failed", "refunded"):
            raise HTTPException(status_code=409, detail=operation.get("error") or "Karten-Upgrade wurde nicht ausgeführt")
    else:
        current_idx = next((i for i, t in enumerate(CARD_TIERS) if t["tier"] == card.get("tier")), 0)
        target_idx = next((i for i, t in enumerate(CARD_TIERS) if t["tier"] == req.tier), 0)
        if target_idx <= current_idx:
            raise HTTPException(status_code=400, detail="Already at this tier or higher")
        now = datetime.now(timezone.utc).isoformat()
        await db.mining_card_operations.update_one(
            {"_id": operation_id},
            {"$setOnInsert": {
                "_id": operation_id,
                "kind": "upgrade",
                "user_id": user_id,
                "from_tier": card.get("tier"),
                "target_tier": req.tier,
                "target_name": target["name"],
                "cost_blz": target["cost_blz"],
                "idempotency_key": operation_key,
                "status": "processing",
                "created_at": now,
            }},
            upsert=True,
        )
        operation = await db.mining_card_operations.find_one({"_id": operation_id}, {"_id": 0}) or {}

    from_tier = operation.get("from_tier")
    cost_blz = _safe_mining_float(operation.get("cost_blz"))
    debit_marker = f"card_upgrade_debits.{operation_hash}"
    if cost_blz > 0:
        debit = await db.mining_wallets.update_one(
            {
                "user_id": user_id,
                "blz_balance": {"$gte": cost_blz},
                debit_marker: {"$exists": False},
            },
            {
                "$inc": {"blz_balance": -cost_blz},
                "$set": {debit_marker: {
                    "operation_id": operation_id,
                    "amount_blz": cost_blz,
                    "debited_at": datetime.now(timezone.utc).isoformat(),
                }},
            },
        )
        if debit.modified_count != 1:
            wallet = await db.mining_wallets.find_one({"user_id": user_id}) or {}
            existing_debit = (wallet.get("card_upgrade_debits") or {}).get(operation_hash)
            if not existing_debit:
                await db.mining_card_operations.update_one(
                    {"_id": operation_id},
                    {"$set": {"status": "failed", "error": "Insufficient BLZ", "failed_at": datetime.now(timezone.utc).isoformat()}},
                )
                raise HTTPException(status_code=400, detail="Insufficient BLZ")

    applied_marker = f"card_upgrade_applied.{operation_hash}"
    applied = await db.mining_cards.update_one(
        {
            "user_id": user_id,
            "tier": from_tier,
            applied_marker: {"$exists": False},
        },
        {"$set": {
            "tier": target["tier"],
            "tier_name": target["name"],
            "color": target["color"],
            "daily_limit": target["daily_limit"],
            "cashback_rate": target["cashback"],
            applied_marker: {
                "operation_id": operation_id,
                "from_tier": from_tier,
                "target_tier": target["tier"],
                "applied_at": datetime.now(timezone.utc).isoformat(),
            },
        }},
    )
    if applied.modified_count != 1:
        fresh_card = await db.mining_cards.find_one({"user_id": user_id}) or {}
        existing_apply = (fresh_card.get("card_upgrade_applied") or {}).get(operation_hash)
        if not existing_apply:
            if cost_blz > 0:
                refund_marker = f"card_upgrade_refunds.{operation_hash}"
                refunded = await db.mining_wallets.update_one(
                    {
                        "user_id": user_id,
                        debit_marker: {"$exists": True},
                        refund_marker: {"$exists": False},
                    },
                    {
                        "$inc": {"blz_balance": cost_blz},
                        "$set": {refund_marker: {
                            "operation_id": operation_id,
                            "amount_blz": cost_blz,
                            "refunded_at": datetime.now(timezone.utc).isoformat(),
                        }},
                    },
                )
                if refunded.modified_count != 1:
                    wallet = await db.mining_wallets.find_one({"user_id": user_id}) or {}
                    if not (wallet.get("card_upgrade_refunds") or {}).get(operation_hash):
                        await db.mining_card_operations.update_one(
                            {"_id": operation_id},
                            {"$set": {
                                "status": "reconciliation_required",
                                "error": "upgrade_apply_failed_refund_unclear",
                                "reconciliation_required_at": datetime.now(timezone.utc).isoformat(),
                            }},
                        )
                        raise HTTPException(status_code=503, detail="Karten-Upgradezustand unklar; Abstimmung erforderlich")
            await db.mining_card_operations.update_one(
                {"_id": operation_id},
                {"$set": {
                    "status": "refunded",
                    "error": "Kartenstufe wurde parallel verändert; BLZ wurden zurückgebucht",
                    "refunded_at": datetime.now(timezone.utc).isoformat(),
                }},
            )
            raise HTTPException(status_code=409, detail="Kartenstufe wurde parallel verändert; BLZ wurden zurückgebucht")

    now = datetime.now(timezone.utc).isoformat()
    await db.mining_transactions.update_one(
        {"txn_id": operation_id},
        {"$setOnInsert": {
            "txn_id": operation_id,
            "user_id": user_id,
            "type": "card_upgrade",
            "amount_blz": -cost_blz,
            "description": f"Mining Card upgrade: {target['name']}",
            "idempotency_key": operation_key,
            "created_at": now,
        }},
        upsert=True,
    )
    await db.mining_card_operations.update_one(
        {"_id": operation_id},
        {"$set": {"status": "completed", "new_tier": target["name"], "completed_at": now}},
    )
    return {"ok": True, "new_tier": target["name"], "operation_id": operation_id, "replayed": False}


class FreezeCardRequest(BaseModel):
    frozen: bool


@router.post("/card/freeze")
async def set_card_freeze(req: FreezeCardRequest, request: Request):
    """Set test-card freeze state idempotently; production remains disabled."""
    _require_mining_value_mode()
    user = await get_current_user(request)
    user_id = str(user["_id"])
    result = await db.mining_cards.update_one(
        {"user_id": user_id},
        {"$set": {"frozen": bool(req.frozen), "freeze_updated_at": datetime.now(timezone.utc).isoformat()}},
    )
    if result.matched_count != 1:
        raise HTTPException(status_code=404, detail="No card")
    return {"frozen": bool(req.frozen)}


# ══════════════════════════════════════
# LAUNCHPAD — New Miner Token Launches
# ══════════════════════════════════════

LAUNCHPAD_PROJECTS = [
    {
        "project_id": "fusion-x1",
        "name": "Fusion X1",
        "description": "Next-gen quantum fusion miner with 3x efficiency boost",
        "hashrate": 8000,
        "efficiency": 0.99,
        "icon": "atom",
        "total_supply": 100,
        "sold": 0,
        "price_blz": 5000,
        "price_eur": 500,
        "min_vip": "Silver",
        "launch_status": "active",
        "bonus_hashrate": 500,
    },
    {
        "project_id": "neural-v2",
        "name": "Neural V2",
        "description": "AI-optimized neural network miner — auto-adjusts efficiency",
        "hashrate": 3000,
        "efficiency": 0.97,
        "icon": "zap",
        "total_supply": 250,
        "sold": 0,
        "price_blz": 2000,
        "price_eur": 200,
        "min_vip": "Bronze",
        "launch_status": "active",
        "bonus_hashrate": 200,
    },
    {
        "project_id": "solar-mk3",
        "name": "Solar MK3",
        "description": "Zero-energy solar mining rig — pure profit potential",
        "hashrate": 1500,
        "efficiency": 0.95,
        "icon": "flame",
        "total_supply": 500,
        "sold": 0,
        "price_blz": 800,
        "price_eur": 80,
        "min_vip": "Bronze",
        "launch_status": "active",
        "bonus_hashrate": 100,
    },
]


@router.get("/launchpad")
async def get_launchpad(request: Request):
    """Preview launchpad; purchases remain disabled without a live provider."""
    await get_current_user(request)
    if not TEST_MODE:
        return {"projects": [], "capabilities": _mining_capabilities()}

    projects = await db.mining_launchpad.find({}, {"_id": 0}).to_list(20)
    if not projects:
        now = datetime.now(timezone.utc).isoformat()
        for source in LAUNCHPAD_PROJECTS:
            p_copy = {**source, "created_at": now, "is_demo": True}
            await db.mining_launchpad.insert_one(p_copy)
        projects = await db.mining_launchpad.find({}, {"_id": 0}).to_list(20)
    return {"projects": projects, "capabilities": _mining_capabilities()}

class LaunchpadBuyRequest(BaseModel):
    project_id: str
    idempotency_key: Optional[str] = None


@router.post("/launchpad/buy")
async def buy_launchpad(req: LaunchpadBuyRequest, request: Request):
    """Buy one launchpad miner with canonical wallet debit and exactly-once supply reservation."""
    _require_mining_value_mode()
    from core.payment_engine import debit_wallet, credit_wallet, TransactionType

    user = await get_current_user(request)
    user_id = str(user["_id"])
    raw_key = (req.idempotency_key or request.headers.get("Idempotency-Key") or "").strip()
    if not 8 <= len(raw_key) <= 200:
        raise HTTPException(status_code=400, detail="Idempotency-Key erforderlich")
    idempotency_key = f"mining-launchpad:{raw_key}"
    purchase_hash = hashlib.sha256(f"{user_id}:{req.project_id}:{idempotency_key}".encode("utf-8")).hexdigest()[:20]
    purchase_id = f"MLP-{purchase_hash.upper()}"

    project = await db.mining_launchpad.find_one({"project_id": req.project_id})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if project.get("launch_status") != "active":
        raise HTTPException(status_code=400, detail="Launch not active")

    vip_order = ["Bronze", "Silver", "Gold", "Platinum", "Diamond"]
    miners = await db.mining_miners.find(
        {"user_id": user_id, "status": "active"},
        {"hashrate": 1, "power_level": 1, "_id": 0},
    ).to_list(100)
    total_hashrate = sum(
        _safe_mining_float(miner.get("hashrate"))
        * (1 + _safe_mining_float(miner.get("power_level")) * 0.1)
        for miner in miners
    )
    current_vip = get_vip_level(total_hashrate).get("name", "Bronze")
    required_vip = str(project.get("min_vip") or "Bronze")
    current_idx = vip_order.index(current_vip) if current_vip in vip_order else 0
    required_idx = vip_order.index(required_vip) if required_vip in vip_order else 0
    if current_idx < required_idx:
        raise HTTPException(
            status_code=403,
            detail=f"VIP-Level {required_vip} erforderlich",
        )

    now = datetime.now(timezone.utc).isoformat()
    await db.mining_launchpad_buys.update_one(
        {"user_id": user_id, "project_id": req.project_id},
        {"$setOnInsert": {
            "purchase_id": purchase_id,
            "user_id": user_id,
            "project_id": req.project_id,
            "idempotency_key": idempotency_key,
            "status": "processing",
            "created_at": now,
        }},
        upsert=True,
    )
    purchase = await db.mining_launchpad_buys.find_one(
        {"user_id": user_id, "project_id": req.project_id},
        {"_id": 0},
    ) or {}
    if purchase.get("purchase_id") != purchase_id:
        raise HTTPException(status_code=409, detail="Dieses Launchpad-Angebot wurde bereits mit einer anderen Kaufanfrage verwendet")

    if purchase.get("status") == "completed":
        miner = await db.mining_miners.find_one({"miner_id": purchase.get("miner_id")}, {"_id": 0}) or {}
        fresh_user = await db.users.find_one({"_id": user["_id"]}, {"balance": 1, "_id": 0}) or {}
        return {
            "ok": True,
            "miner_name": miner.get("name"),
            "hashrate": miner.get("hashrate"),
            "new_balance": round(float(fresh_user.get("balance") or 0), 2),
            "replayed": True,
        }
    if purchase.get("status") == "reconciliation_required":
        raise HTTPException(status_code=503, detail="Launchpad-Kauf benötigt finanzielle Abstimmung; keine erneute Belastung wird ausgeführt")
    if purchase.get("status") in {"refunded", "failed"}:
        raise HTTPException(status_code=409, detail="Launchpad-Kauf wurde beendet oder zurückgebucht")

    price = round(float(project.get("price_eur") or 0), 2)
    debit = await debit_wallet(
        user_id=user_id,
        amount=price,
        tx_type=TransactionType.MINING_PURCHASE,
        description=f"Launchpad: {project['name']} (Launch Edition)",
        reference=f"MIN-LAUNCH-{purchase_hash[:12].upper()}",
        metadata={"project_id": req.project_id, "purchase_id": purchase_id, "kind": "mining_launchpad"},
        idempotency_key=idempotency_key,
    )
    if not debit.success:
        raise HTTPException(status_code=400, detail=debit.error or "Wallet-Zahlung fehlgeschlagen")

    marker_field = f"purchase_markers.{purchase_hash}"
    latest_project = await db.mining_launchpad.find_one({"project_id": req.project_id}) or project
    marker_exists = bool((latest_project.get("purchase_markers") or {}).get(purchase_hash))
    if not marker_exists:
        reserve = await db.mining_launchpad.update_one(
            {
                "project_id": req.project_id,
                "launch_status": "active",
                "sold": {"$lt": int(project.get("total_supply") or 0)},
                marker_field: {"$exists": False},
            },
            {
                "$inc": {"sold": 1},
                "$set": {
                    marker_field: {
                        "purchase_id": purchase_id,
                        "user_id": user_id,
                        "reserved_at": datetime.now(timezone.utc).isoformat(),
                    }
                },
            },
        )
        if reserve.modified_count != 1:
            latest_project = await db.mining_launchpad.find_one({"project_id": req.project_id}) or {}
            if not (latest_project.get("purchase_markers") or {}).get(purchase_hash):
                refund = await credit_wallet(
                    user_id=user_id,
                    amount=price,
                    tx_type=TransactionType.REFUND,
                    description="Mining Launchpad Rückerstattung",
                    reference=f"MIN-LAUNCH-REF-{purchase_hash[:10].upper()}",
                    source="mining_launchpad_sold_out",
                    metadata={"project_id": req.project_id, "purchase_id": purchase_id},
                    idempotency_key=f"mining-launchpad-refund:{purchase_id}",
                )
                if not refund.success:
                    await db.mining_launchpad_buys.update_one(
                        {"purchase_id": purchase_id},
                        {"$set": {
                            "status": "reconciliation_required",
                            "refund_transaction_id": getattr(refund, "transaction_id", None),
                            "refund_error": refund.error,
                            "reconciliation_required_at": datetime.now(timezone.utc).isoformat(),
                        }},
                    )
                    raise HTTPException(
                        status_code=503,
                        detail="Launchpad ist ausverkauft; Rückbuchung benötigt finanzielle Abstimmung.",
                    )
                await db.mining_launchpad_buys.update_one(
                    {"purchase_id": purchase_id},
                    {"$set": {
                        "status": "refunded",
                        "refund_transaction_id": refund.transaction_id,
                        "refunded_at": datetime.now(timezone.utc).isoformat(),
                    }},
                )
                raise HTTPException(status_code=409, detail="Launchpad ist ausverkauft. Zahlung wurde zurückgebucht.")

    miner_id = f"launch_{purchase_hash[:12]}"
    miner = {
        "miner_id": miner_id,
        "user_id": user_id,
        "package_id": f"launch_{project['project_id']}",
        "name": f"{project['name']} (Launch Edition)",
        "hashrate": project["hashrate"] + project.get("bonus_hashrate", 0),
        "efficiency": project["efficiency"],
        "power_level": 0,
        "efficiency_level": 0,
        "status": "active",
        "purchased_at": now,
        "icon": project.get("icon", "atom"),
        "is_launch_edition": True,
        "purchase_id": purchase_id,
    }
    await db.mining_miners.update_one(
        {"miner_id": miner_id},
        {"$setOnInsert": miner},
        upsert=True,
    )

    await db.mining_launchpad_buys.update_one(
        {"purchase_id": purchase_id},
        {"$set": {
            "status": "completed",
            "miner_id": miner_id,
            "payment_transaction_id": debit.transaction_id,
            "completed_at": datetime.now(timezone.utc).isoformat(),
        }},
    )
    await db.mining_transactions.update_one(
        {"txn_id": purchase_id},
        {"$setOnInsert": {
            "txn_id": purchase_id,
            "user_id": user_id,
            "type": "launchpad",
            "amount_eur": -price,
            "description": f"Launchpad: {project['name']} (Launch Edition)",
            "wallet_transaction_id": debit.transaction_id,
            "created_at": now,
        }},
        upsert=True,
    )

    return {
        "ok": True,
        "miner_name": miner["name"],
        "hashrate": miner["hashrate"],
        "new_balance": debit.new_balance,
        "replayed": debit.idempotent_replay,
    }
