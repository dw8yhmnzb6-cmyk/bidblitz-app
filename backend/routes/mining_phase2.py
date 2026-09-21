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
from routes.mining import _require_mining_value_mode, _mining_capabilities, _safe_mining_float

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
    """List a miner for sale on the marketplace."""
    _require_mining_value_mode()
    user = await get_current_user(request)
    user_id = str(user["_id"])

    miner = await db.mining_miners.find_one({"miner_id": req.miner_id, "user_id": user_id, "status": "active"})
    if not miner:
        raise HTTPException(status_code=404, detail="Miner not found or not active")

    existing = await db.mining_marketplace.find_one({"miner_id": req.miner_id, "status": "active"})
    if existing:
        raise HTTPException(status_code=400, detail="Miner already listed")

    listing_id = secrets.token_hex(6)
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
        "price_blz": req.price_blz,
        "price_eur": round(req.price_blz * BLZ_TO_EUR, 2),
        "status": "active",
        "listed_at": now,
    }
    await db.mining_marketplace.insert_one(listing)
    listing.pop("_id", None)

    await db.mining_miners.update_one({"miner_id": req.miner_id}, {"$set": {"status": "listed"}})

    return {"listing": listing}


@router.post("/marketplace/buy")
async def buy_marketplace_listing(req: BuyListingRequest, request: Request):
    """Buy one active listing exactly once; preview value flow stays TEST_MODE-only."""
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
    if existing_purchase and existing_purchase.get("status") == "completed":
        return {
            "ok": True,
            "miner_name": existing_purchase.get("miner_name"),
            "purchase_id": purchase_id,
            "replayed": True,
        }

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

    claim = await db.mining_marketplace.update_one(
        {
            "listing_id": req.listing_id,
            "status": "active",
            "seller_id": {"$ne": user_id},
        },
        {"$set": {
            "status": "processing",
            "purchase_id": purchase_id,
            "buyer_id": user_id,
            "purchase_started_at": datetime.now(timezone.utc).isoformat(),
        }},
    )
    if claim.modified_count != 1:
        current = await db.mining_marketplace.find_one({"listing_id": req.listing_id}, {"_id": 0}) or {}
        if current.get("status") == "sold" and current.get("purchase_id") == purchase_id:
            purchase = await db.mining_marketplace_purchases.find_one({"_id": purchase_id}, {"_id": 0}) or {}
            return {
                "ok": True,
                "miner_name": purchase.get("miner_name") or current.get("miner_name"),
                "purchase_id": purchase_id,
                "replayed": True,
            }
        raise HTTPException(status_code=409, detail="Listing wird bereits gekauft oder ist nicht mehr verfügbar")

    price = round(float(listing.get("price_blz") or 0), 4)
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
            "miner_id": listing["miner_id"],
            "user_id": listing["seller_id"],
            "status": "listed",
        },
        {"$set": {"user_id": user_id, "status": "active", "marketplace_purchase_id": purchase_id}},
    )
    if ownership.modified_count != 1:
        await db.mining_wallets.update_one(
            {
                "user_id": user_id,
                buyer_marker: {"$exists": True},
                f"marketplace_purchase_refunds.{purchase_id}": {"$exists": False},
            },
            {
                "$inc": {"blz_balance": price},
                "$set": {f"marketplace_purchase_refunds.{purchase_id}": {
                    "amount_blz": price,
                    "created_at": datetime.now(timezone.utc).isoformat(),
                }},
            },
        )
        await db.mining_marketplace.update_one(
            {"listing_id": req.listing_id, "status": "processing", "purchase_id": purchase_id},
            {"$set": {"status": "active"}, "$unset": {"purchase_id": "", "buyer_id": "", "purchase_started_at": ""}},
        )
        await db.mining_marketplace_purchases.update_one(
            {"_id": purchase_id},
            {"$set": {"status": "failed_refunded", "reason": "ownership_transfer_failed"}},
        )
        raise HTTPException(status_code=409, detail="Miner ownership changed; BLZ wurden zurückgebucht")

    seller_marker = f"marketplace_sale_markers.{purchase_id}"
    await db.mining_wallets.update_one(
        {"user_id": listing["seller_id"]},
        {"$setOnInsert": {"user_id": listing["seller_id"], "blz_balance": 0.0}},
        upsert=True,
    )
    seller_credit = await db.mining_wallets.update_one(
        {"user_id": listing["seller_id"], seller_marker: {"$exists": False}},
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
            {"user_id": listing["seller_id"], seller_marker: {"$exists": True}},
            {"_id": 1},
        )
        if not existing_credit:
            await db.mining_marketplace_purchases.update_one(
                {"_id": purchase_id},
                {"$set": {"status": "reconciliation_required", "reason": "seller_credit_failed"}},
            )
            raise HTTPException(status_code=500, detail="Miner übertragen; Verkäufergutschrift benötigt Abstimmung")

    now = datetime.now(timezone.utc).isoformat()
    finalized = await db.mining_marketplace.update_one(
        {"listing_id": req.listing_id, "status": "processing", "purchase_id": purchase_id},
        {"$set": {"status": "sold", "sold_at": now}},
    )
    if finalized.modified_count != 1:
        await db.mining_marketplace_purchases.update_one(
            {"_id": purchase_id},
            {"$set": {"status": "reconciliation_required", "reason": "listing_finalize_failed"}},
        )
        raise HTTPException(status_code=500, detail="Zahlung abgeschlossen; Listing-Abschluss benötigt Abstimmung")

    await db.mining_marketplace_purchases.update_one(
        {"_id": purchase_id},
        {"$set": {"status": "completed", "completed_at": now}},
    )
    for suffix, uid, amt, tx_type, desc in [
        ("BUY", user_id, -price, "marketplace_buy", f"Bought {listing['miner_name']} on marketplace"),
        ("SELL", listing["seller_id"], price, "marketplace_sell", f"Sold {listing['miner_name']} on marketplace"),
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
                "created_at": now,
            }},
            upsert=True,
        )

    return {
        "ok": True,
        "miner_name": listing["miner_name"],
        "purchase_id": purchase_id,
        "replayed": False,
    }


@router.post("/marketplace/cancel")
async def cancel_listing(req: BuyListingRequest, request: Request):
    """Cancel own marketplace listing."""
    _require_mining_value_mode()
    user = await get_current_user(request)
    user_id = str(user["_id"])

    listing = await db.mining_marketplace.find_one({"listing_id": req.listing_id, "status": "active"})
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    if listing["seller_id"] != user_id:
        raise HTTPException(status_code=403, detail="Not your listing")

    cancelled = await db.mining_marketplace.update_one(
        {"listing_id": req.listing_id, "seller_id": user_id, "status": "active"},
        {"$set": {"status": "cancelled", "cancelled_at": datetime.now(timezone.utc).isoformat()}},
    )
    if cancelled.modified_count != 1:
        raise HTTPException(status_code=409, detail="Listing wird bereits verarbeitet oder wurde verkauft")
    await db.mining_miners.update_one(
        {"miner_id": listing["miner_id"], "user_id": user_id, "status": "listed"},
        {"$set": {"status": "active"}},
    )

    return {"ok": True}


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
    card = {
        **card,
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
    today_spent = 0.0
    for tx in recent_transactions:
        tx["amount_eur"] = _safe_mining_float(tx.get("amount_eur"))
        tx["amount_blz"] = _safe_mining_float(tx.get("amount_blz"))
        tx["cashback_blz"] = _safe_mining_float(tx.get("cashback_blz"))
        if str(tx.get("date") or "") == today:
            today_spent += tx["amount_eur"]

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


@router.post("/card/spend")
async def card_spend(req: CardSpendRequest, request: Request):
    """Simulate a card payment (deducts BLZ)."""
    _require_mining_value_mode()
    user = await get_current_user(request)
    user_id = str(user["_id"])

    card = await db.mining_cards.find_one({"user_id": user_id})
    if not card:
        raise HTTPException(status_code=404, detail="No card found")
    if card.get("frozen"):
        raise HTTPException(status_code=400, detail="Card is frozen")

    # Check daily limit
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    today_txns = await db.mining_card_txns.find({"user_id": user_id, "date": today}).to_list(100)
    today_spent = sum(t.get("amount_eur", 0) for t in today_txns)
    if today_spent + req.amount_eur > card.get("daily_limit", 100):
        raise HTTPException(status_code=400, detail="Daily limit exceeded")

    # Deduct BLZ
    blz_needed = req.amount_eur / BLZ_TO_EUR
    wallet = await db.mining_wallets.find_one({"user_id": user_id})
    if not wallet or wallet.get("blz_balance", 0) < blz_needed:
        raise HTTPException(status_code=400, detail="Insufficient BLZ balance")

    cashback_rate = card.get("cashback_rate", 0.01)
    cashback_blz = round(blz_needed * cashback_rate, 4)

    await db.mining_wallets.update_one(
        {"user_id": user_id},
        {"$inc": {"blz_balance": -(blz_needed - cashback_blz)}},
    )

    now = datetime.now(timezone.utc).isoformat()
    await db.mining_card_txns.insert_one({
        "txn_id": secrets.token_hex(6),
        "user_id": user_id,
        "amount_eur": req.amount_eur,
        "amount_blz": blz_needed,
        "cashback_blz": cashback_blz,
        "merchant": req.merchant or "Purchase",
        "date": today,
        "created_at": now,
    })

    await db.mining_cards.update_one(
        {"user_id": user_id},
        {"$inc": {"total_spent": req.amount_eur, "total_cashback": cashback_blz}},
    )

    return {
        "ok": True,
        "spent_eur": req.amount_eur,
        "spent_blz": round(blz_needed, 4),
        "cashback_blz": cashback_blz,
    }


class UpgradeCardRequest(BaseModel):
    tier: str


@router.post("/card/upgrade")
async def upgrade_card(req: UpgradeCardRequest, request: Request):
    """Upgrade card tier."""
    _require_mining_value_mode()
    user = await get_current_user(request)
    user_id = str(user["_id"])

    target = next((t for t in CARD_TIERS if t["tier"] == req.tier), None)
    if not target:
        raise HTTPException(status_code=400, detail="Invalid tier")

    card = await db.mining_cards.find_one({"user_id": user_id})
    if not card:
        raise HTTPException(status_code=404, detail="No card found")

    current_idx = next((i for i, t in enumerate(CARD_TIERS) if t["tier"] == card.get("tier")), 0)
    target_idx = next((i for i, t in enumerate(CARD_TIERS) if t["tier"] == req.tier), 0)
    if target_idx <= current_idx:
        raise HTTPException(status_code=400, detail="Already at this tier or higher")

    if target["cost_blz"] > 0:
        wallet = await db.mining_wallets.find_one({"user_id": user_id})
        if not wallet or wallet.get("blz_balance", 0) < target["cost_blz"]:
            raise HTTPException(status_code=400, detail="Insufficient BLZ")
        await db.mining_wallets.update_one({"user_id": user_id}, {"$inc": {"blz_balance": -target["cost_blz"]}})

    await db.mining_cards.update_one(
        {"user_id": user_id},
        {"$set": {
            "tier": target["tier"], "tier_name": target["name"],
            "color": target["color"], "daily_limit": target["daily_limit"],
            "cashback_rate": target["cashback"],
        }},
    )

    return {"ok": True, "new_tier": target["name"]}


@router.post("/card/freeze")
async def toggle_freeze(request: Request):
    """Toggle card freeze only while the test card simulator is enabled."""
    _require_mining_value_mode()
    user = await get_current_user(request)
    user_id = str(user["_id"])
    card = await db.mining_cards.find_one({"user_id": user_id})
    if not card:
        raise HTTPException(status_code=404, detail="No card")
    new_state = not card.get("frozen", False)
    await db.mining_cards.update_one({"user_id": user_id}, {"$set": {"frozen": new_state}})
    return {"frozen": new_state}


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
                await db.mining_launchpad_buys.update_one(
                    {"purchase_id": purchase_id},
                    {"$set": {"status": "refunded", "refund_transaction_id": refund.transaction_id if refund.success else None}},
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
