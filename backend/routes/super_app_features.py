"""
BidBlitz Super App — Feature Extensions
Neue Marketplace-Features, Wallet-Erweiterungen, Gaming-Optimierungen
"""
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from core.database import db
from core.security import get_current_user
from core.payment_engine import credit_wallet, TransactionType
from routes.pos_system import short_id

router = APIRouter(prefix="/api/super-app", tags=["Super App Extensions"])
log = logging.getLogger("bidblitz.super_app")


# ═══════════════════════════════════════════════════════════════════════
# MARKETPLACE: NEUE KATEGORIEN
# ═══════════════════════════════════════════════════════════════════════

class MarketplaceItem(BaseModel):
    category: str  # "car_rental", "event_tickets", "services", "education"
    title: str
    description: str
    price: float
    seller_id: str
    images: List[str] = []
    metadata: dict = {}

@router.post("/marketplace/items")
async def create_marketplace_item(item: MarketplaceItem, request: Request):
    """Create new marketplace listing."""
    user = await get_current_user(request)
    
    item_id = short_id("MKT", 10)
    
    await db.marketplace_items.insert_one({
        "item_id": item_id,
        "category": item.category,
        "title": item.title,
        "description": item.description,
        "price": item.price,
        "seller_id": item.seller_id,
        "images": item.images,
        "metadata": item.metadata,
        "status": "active",
        "created_by": str(user["_id"]),
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    
    log.info(f"Marketplace item created: {item.title}")
    
    return {"ok": True, "item_id": item_id}

@router.get("/marketplace/categories")
async def get_marketplace_categories():
    """Get all marketplace categories with counts."""
    
    categories = [
        {"id": "flights", "name": "Flüge", "icon": "✈️"},
        {"id": "hotels", "name": "Hotels", "icon": "🏨"},
        {"id": "shopping", "name": "Shopping", "icon": "🛍️"},
        {"id": "taxi", "name": "Taxi", "icon": "🚕"},
        {"id": "food", "name": "Food Delivery", "icon": "🍔"},
        {"id": "real_estate", "name": "Immobilien", "icon": "🏠"},
        {"id": "car_rental", "name": "Mietwagen", "icon": "🚗"},
        {"id": "event_tickets", "name": "Event-Tickets", "icon": "🎫"},
        {"id": "services", "name": "Dienstleistungen", "icon": "🔧"},
        {"id": "education", "name": "Kurse & Lernen", "icon": "📚"},
    ]
    
    for cat in categories:
        count = await db.marketplace_items.count_documents({"category": cat["id"], "status": "active"})
        cat["count"] = count
    
    return {"categories": categories}


# ═══════════════════════════════════════════════════════════════════════
# WALLET: ERWEITERTE FEATURES
# ═══════════════════════════════════════════════════════════════════════

class WalletTopup(BaseModel):
    amount: float
    method: str  # "card", "bank_transfer", "crypto"
    idempotency_key: Optional[str] = None

@router.post("/wallet/topup")
async def wallet_topup(req: WalletTopup, request: Request):
    """Legacy endpoint routed through canonical wallet engine."""
    user = await get_current_user(request)

    result = await credit_wallet(
        user_id=str(user["_id"]),
        amount=round(float(req.amount or 0), 2),
        tx_type=TransactionType.TOPUP,
        description=f"Legacy Top-up via {req.method}",
        source="super_app_legacy",
        metadata={
            "payment_method": req.method,
            "route": "super_app.wallet.topup",
            "audit_metadata": {"legacy": True},
        },
        idempotency_key=req.idempotency_key,
    )
    if not result.success:
        raise HTTPException(status_code=400, detail=result.error or "Top-up fehlgeschlagen")

    log.info(f"Legacy wallet topup routed to engine: {result.transaction_id} (€{req.amount})")
    return {"transaction_id": result.transaction_id, "status": result.status.value, "new_balance": result.new_balance, "deprecated": True}

@router.get("/wallet/balance")
async def get_wallet_balance(request: Request):
    """Legacy read endpoint using canonical users.balance."""
    user = await get_current_user(request)

    wallet = await db.wallets.find_one({"user_id": str(user["_id"])}, {"_id": 0, "balance": 1})

    transactions = await db.transactions.find(
        {"user_id": str(user["_id"])},
        {"_id": 0, "id": 1, "type": 1, "amount": 1, "description": 1, "status": 1, "created_at": 1, "reference": 1}
    ).sort("created_at", -1).limit(10).to_list(10)

    return {
        "balance": round(float(user.get("balance", 0.0) or 0.0), 2),
        "currency": "EUR",
        "recent_transactions": transactions,
        "wallet_exists": wallet is not None,
        "legacy_wallet_balance": round(float((wallet or {}).get("balance", 0.0) or 0.0), 2),
        "canonical_source": "users.balance",
        "deprecated": True,
    }


# ═══════════════════════════════════════════════════════════════════════
# GAMING: OPTIMIERUNGEN
# ═══════════════════════════════════════════════════════════════════════

class GameSession(BaseModel):
    game_type: str  # "penny_auction", "spin_wheel", "scratch_card"
    bet_amount: float

@router.post("/gaming/session")
async def start_game_session(session: GameSession, request: Request):
    """Start gaming session."""
    user = await get_current_user(request)
    
    # Check wallet balance
    wallet = await db.wallets.find_one({"user_id": str(user["_id"])})
    if not wallet or wallet.get("balance", 0) < session.bet_amount:
        raise HTTPException(status_code=400, detail="Insufficient balance")
    
    session_id = short_id("GAME", 10)
    
    await db.game_sessions.insert_one({
        "session_id": session_id,
        "user_id": str(user["_id"]),
        "game_type": session.game_type,
        "bet_amount": session.bet_amount,
        "status": "active",
        "started_at": datetime.now(timezone.utc).isoformat(),
    })
    
    # Deduct bet from wallet
    await db.wallets.update_one(
        {"user_id": str(user["_id"])},
        {"$inc": {"balance": -session.bet_amount}}
    )
    
    log.info(f"Game session started: {session_id} ({session.game_type})")
    
    return {"session_id": session_id, "status": "active"}

@router.get("/gaming/leaderboard")
async def get_gaming_leaderboard(game_type: Optional[str] = None):
    """Get gaming leaderboard."""
    
    # Aggregate wins by user
    pipeline = [
        {"$match": {"status": "won"}},
        {"$group": {
            "_id": "$user_id",
            "total_wins": {"$sum": 1},
            "total_winnings": {"$sum": "$winnings"}
        }},
        {"$sort": {"total_winnings": -1}},
        {"$limit": 100}
    ]
    
    if game_type:
        pipeline[0]["$match"]["game_type"] = game_type
    
    leaderboard = await db.game_sessions.aggregate(pipeline).to_list(100)
    
    # Enrich with user data
    for entry in leaderboard:
        user = await db.users.find_one({"_id": entry["_id"]}, {"_id": 0, "username": 1})
        entry["username"] = user.get("username", "Anonymous") if user else "Anonymous"
    
    return {"leaderboard": leaderboard}


# ═══════════════════════════════════════════════════════════════════════
# CREATOR ECONOMY: SUBSCRIPTION TIERS
# ═══════════════════════════════════════════════════════════════════════

class CreatorSubscription(BaseModel):
    creator_id: str
    tier: str  # "basic", "premium", "vip"
    monthly_price: float
    benefits: List[str]

@router.post("/creator/subscription-tiers")
async def create_subscription_tier(tier: CreatorSubscription, request: Request):
    """Creator erstellt Subscription-Tier."""
    user = await get_current_user(request)
    
    tier_id = short_id("TIER", 10)
    
    await db.creator_subscription_tiers.insert_one({
        "tier_id": tier_id,
        "creator_id": tier.creator_id,
        "tier": tier.tier,
        "monthly_price": tier.monthly_price,
        "benefits": tier.benefits,
        "active": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    
    log.info(f"Subscription tier created: {tier.tier} by {tier.creator_id}")
    
    return {"tier_id": tier_id}

@router.post("/creator/subscribe")
async def subscribe_to_creator(creator_id: str, tier_id: str, request: Request):
    """User abonniert Creator."""
    user = await get_current_user(request)
    
    tier = await db.creator_subscription_tiers.find_one({"tier_id": tier_id})
    if not tier:
        raise HTTPException(status_code=404, detail="Tier not found")
    
    # Check wallet balance
    wallet = await db.wallets.find_one({"user_id": str(user["_id"])})
    if not wallet or wallet.get("balance", 0) < tier["monthly_price"]:
        raise HTTPException(status_code=400, detail="Insufficient balance")
    
    subscription_id = short_id("SUB", 10)
    
    await db.creator_subscriptions.insert_one({
        "subscription_id": subscription_id,
        "user_id": str(user["_id"]),
        "creator_id": creator_id,
        "tier_id": tier_id,
        "monthly_price": tier["monthly_price"],
        "status": "active",
        "next_billing_date": (datetime.now(timezone.utc) + timedelta(days=30)).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    
    # Deduct from wallet
    await db.wallets.update_one(
        {"user_id": str(user["_id"])},
        {"$inc": {"balance": -tier["monthly_price"]}}
    )
    
    # Credit creator
    await db.wallets.update_one(
        {"user_id": creator_id},
        {"$inc": {"balance": tier["monthly_price"] * 0.85}},  # 85% to creator, 15% platform fee
        upsert=True
    )
    
    log.info(f"Subscription created: {subscription_id}")
    
    return {"subscription_id": subscription_id, "status": "active"}


# ═══════════════════════════════════════════════════════════════════════
# ANALYTICS & INSIGHTS
# ═══════════════════════════════════════════════════════════════════════

@router.get("/analytics/overview")
async def get_app_analytics(request: Request):
    """Get Super App usage analytics (Admin only)."""
    user = await get_current_user(request)
    
    if user.get("role") != "admin" and not user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin only")
    
    total_users = await db.users.count_documents({})
    total_transactions = await db.wallet_transactions.count_documents({})
    total_marketplace_items = await db.marketplace_items.count_documents({"status": "active"})
    total_game_sessions = await db.game_sessions.count_documents({})
    total_subscriptions = await db.creator_subscriptions.count_documents({"status": "active"})
    
    # Revenue calculation
    revenue_pipeline = [
        {"$match": {"type": {"$in": ["purchase", "subscription", "game_win"]}}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
    ]
    revenue_data = await db.wallet_transactions.aggregate(revenue_pipeline).to_list(1)
    total_revenue = revenue_data[0]["total"] if revenue_data else 0
    
    return {
        "total_users": total_users,
        "total_transactions": total_transactions,
        "total_marketplace_items": total_marketplace_items,
        "total_game_sessions": total_game_sessions,
        "total_subscriptions": total_subscriptions,
        "total_revenue": total_revenue,
    }

@router.get("/health")
async def super_app_health():
    return {"status": "ok", "features": ["marketplace", "wallet", "gaming", "creator"]}
