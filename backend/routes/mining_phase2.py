"""
BidBlitz V2 — Mining Phase 2: Marketplace, Card, Launchpad
"""

import secrets
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from core.database import db
from core.security import get_current_user

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


@router.get("/marketplace")
async def get_marketplace(request: Request):
    """Get all active marketplace listings."""
    await get_current_user(request)
    listings = await db.mining_marketplace.find(
        {"status": "active"}, {"_id": 0}
    ).sort("listed_at", -1).to_list(50)
    return {"listings": listings}


@router.post("/marketplace/list")
async def list_miner_for_sale(req: ListMinerRequest, request: Request):
    """List a miner for sale on the marketplace."""
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
    """Buy a miner from the marketplace."""
    user = await get_current_user(request)
    user_id = str(user["_id"])

    listing = await db.mining_marketplace.find_one({"listing_id": req.listing_id, "status": "active"})
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")

    if listing["seller_id"] == user_id:
        raise HTTPException(status_code=400, detail="Cannot buy your own listing")

    wallet = await db.mining_wallets.find_one({"user_id": user_id})
    if not wallet or wallet.get("blz_balance", 0) < listing["price_blz"]:
        raise HTTPException(status_code=400, detail="Insufficient BLZ balance")

    now = datetime.now(timezone.utc).isoformat()

    # Deduct BLZ from buyer
    await db.mining_wallets.update_one({"user_id": user_id}, {"$inc": {"blz_balance": -listing["price_blz"]}})
    # Credit seller
    await db.mining_wallets.update_one(
        {"user_id": listing["seller_id"]},
        {"$inc": {"blz_balance": listing["price_blz"]}},
        upsert=True,
    )

    # Transfer miner ownership
    await db.mining_miners.update_one(
        {"miner_id": listing["miner_id"]},
        {"$set": {"user_id": user_id, "status": "active"}},
    )

    # Close listing
    await db.mining_marketplace.update_one(
        {"listing_id": req.listing_id},
        {"$set": {"status": "sold", "buyer_id": user_id, "sold_at": now}},
    )

    # Transaction records
    for uid, amt, desc in [
        (user_id, -listing["price_blz"], f"Bought {listing['miner_name']} on marketplace"),
        (listing["seller_id"], listing["price_blz"], f"Sold {listing['miner_name']} on marketplace"),
    ]:
        await db.mining_transactions.insert_one({
            "txn_id": secrets.token_hex(6),
            "user_id": uid,
            "type": "marketplace_buy" if amt < 0 else "marketplace_sell",
            "amount_blz": amt,
            "description": desc,
            "created_at": now,
        })

    return {"ok": True, "miner_name": listing["miner_name"]}


@router.post("/marketplace/cancel")
async def cancel_listing(req: BuyListingRequest, request: Request):
    """Cancel own marketplace listing."""
    user = await get_current_user(request)
    user_id = str(user["_id"])

    listing = await db.mining_marketplace.find_one({"listing_id": req.listing_id, "status": "active"})
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    if listing["seller_id"] != user_id:
        raise HTTPException(status_code=403, detail="Not your listing")

    await db.mining_marketplace.update_one({"listing_id": req.listing_id}, {"$set": {"status": "cancelled"}})
    await db.mining_miners.update_one({"miner_id": listing["miner_id"]}, {"$set": {"status": "active"}})

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
async def get_card(request: Request):
    """Get user's virtual card info."""
    user = await get_current_user(request)
    user_id = str(user["_id"])

    card = await db.mining_cards.find_one({"user_id": user_id}, {"_id": 0})
    if not card:
        # Auto-create standard card
        card = {
            "user_id": user_id,
            "card_id": f"BLZ-{secrets.token_hex(4).upper()}",
            "card_number": f"4242 **** **** {secrets.token_hex(2).upper()[:4]}",
            "tier": "standard",
            "tier_name": "Standard",
            "color": "#C0C0C0",
            "daily_limit": 100,
            "cashback_rate": 0.01,
            "total_spent": 0,
            "total_cashback": 0,
            "frozen": False,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.mining_cards.insert_one(card)
        card.pop("_id", None)

    # Today's spending
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    today_spent = 0
    today_txns = await db.mining_card_txns.find(
        {"user_id": user_id, "date": today}, {"_id": 0}
    ).to_list(100)
    today_spent = sum(t.get("amount_eur", 0) for t in today_txns)

    # Recent card transactions
    recent = await db.mining_card_txns.find(
        {"user_id": user_id}, {"_id": 0}
    ).sort("created_at", -1).to_list(20)

    return {
        "card": card,
        "today_spent": round(today_spent, 2),
        "remaining_limit": round(card.get("daily_limit", 100) - today_spent, 2),
        "tiers": CARD_TIERS,
        "recent_transactions": recent,
    }


class CardSpendRequest(BaseModel):
    amount_eur: float = Field(..., gt=0, le=10000)
    merchant: str = Field("", max_length=100)


@router.post("/card/spend")
async def card_spend(req: CardSpendRequest, request: Request):
    """Simulate a card payment (deducts BLZ)."""
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
    """Toggle card freeze."""
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
    """Get launchpad projects."""
    await get_current_user(request)

    projects = await db.mining_launchpad.find({}, {"_id": 0}).to_list(20)

    if not projects:
        # Seed from defaults
        now = datetime.now(timezone.utc).isoformat()
        for p in LAUNCHPAD_PROJECTS:
            p_copy = {**p, "created_at": now}
            await db.mining_launchpad.insert_one(p_copy)
        projects = await db.mining_launchpad.find({}, {"_id": 0}).to_list(20)

    return {"projects": projects}


class LaunchpadBuyRequest(BaseModel):
    project_id: str


@router.post("/launchpad/buy")
async def buy_launchpad(req: LaunchpadBuyRequest, request: Request):
    """Buy a launchpad miner."""
    user = await get_current_user(request)
    user_id = str(user["_id"])

    project = await db.mining_launchpad.find_one({"project_id": req.project_id})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if project.get("launch_status") != "active":
        raise HTTPException(status_code=400, detail="Launch not active")
    if project.get("sold", 0) >= project.get("total_supply", 0):
        raise HTTPException(status_code=400, detail="Sold out")

    # Check existing purchase
    existing = await db.mining_launchpad_buys.find_one({"user_id": user_id, "project_id": req.project_id})
    if existing:
        raise HTTPException(status_code=400, detail="Already purchased this launch")

    # Check balance (use EUR wallet)
    balance = user.get("balance", 0)
    if balance < project["price_eur"]:
        raise HTTPException(status_code=400, detail="Insufficient wallet balance")

    now = datetime.now(timezone.utc).isoformat()

    # Deduct EUR
    from bson import ObjectId
    await db.users.update_one({"_id": user["_id"]}, {"$inc": {"balance": -project["price_eur"]}})

    # Create miner with bonus
    miner_id = secrets.token_hex(6)
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
    }
    await db.mining_miners.insert_one(miner)

    # Record purchase
    await db.mining_launchpad_buys.insert_one({
        "user_id": user_id, "project_id": req.project_id, "purchased_at": now,
    })

    # Increment sold count
    await db.mining_launchpad.update_one(
        {"project_id": req.project_id}, {"$inc": {"sold": 1}},
    )

    # Transaction
    await db.mining_transactions.insert_one({
        "txn_id": secrets.token_hex(6),
        "user_id": user_id,
        "type": "launchpad",
        "amount_eur": -project["price_eur"],
        "description": f"Launchpad: {project['name']} (Launch Edition)",
        "created_at": now,
    })

    updated_user = await db.users.find_one({"_id": user["_id"]})

    return {
        "ok": True,
        "miner_name": miner["name"],
        "hashrate": miner["hashrate"],
        "new_balance": updated_user.get("balance", 0),
    }
