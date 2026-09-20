"""
BidBlitz V2 - BlitzBoost (Social Media Marketing Panel)
Buy followers, likes, views for Instagram, TikTok, YouTube, Twitter.
Pay with wallet. Drip-feed & mass order support.
"""
import secrets
import hashlib
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional
from core.database import db
from core.security import get_current_user
from core.payment_engine import debit_wallet, credit_wallet, TransactionType
from core.config import TEST_MODE
from routes import smm_provider

router = APIRouter(prefix="/api/smm", tags=["smm-boost"])


def _require_smm_idempotency_key(body_key: Optional[str], request: Request, *, prefix: str) -> str:
    key = (body_key or request.headers.get("Idempotency-Key") or "").strip()
    if not 8 <= len(key) <= 200:
        raise HTTPException(status_code=400, detail="Idempotency-Key erforderlich")
    return f"{prefix}:{key}"


def _smm_key_hash(key: str) -> str:
    return hashlib.sha256(key.encode("utf-8")).hexdigest()[:20]


def _require_live_smm_provider_for_value_action() -> None:
    if not TEST_MODE and not smm_provider.is_configured():
        raise HTTPException(
            status_code=503,
            detail="BlitzBoost ist in Production deaktiviert, bis ein verifizierter SMM-Provider live verbunden ist. Das Wallet wurde nicht belastet.",
        )


# ── Service Catalog ──
SMM_SERVICES = [
    # Instagram (8 Services)
    {"id": "ig_followers_1k", "platform": "instagram", "type": "followers", "name": "Instagram Follower", "quantity": 1000, "price": 4.99, "min_qty": 100, "max_qty": 50000, "price_per_1k": 4.99, "delivery_time": "1-24h", "quality": "HQ", "refill": True},
    {"id": "ig_followers_premium", "platform": "instagram", "type": "followers", "name": "Instagram Premium Follower", "quantity": 1000, "price": 8.99, "min_qty": 50, "max_qty": 20000, "price_per_1k": 8.99, "delivery_time": "1-12h", "quality": "Premium", "refill": True},
    {"id": "ig_followers_real", "platform": "instagram", "type": "followers", "name": "Instagram Echte Follower (DE)", "quantity": 1000, "price": 14.99, "min_qty": 50, "max_qty": 10000, "price_per_1k": 14.99, "delivery_time": "2-48h", "quality": "Real", "refill": True},
    {"id": "ig_likes_1k", "platform": "instagram", "type": "likes", "name": "Instagram Likes", "quantity": 1000, "price": 2.49, "min_qty": 50, "max_qty": 100000, "price_per_1k": 2.49, "delivery_time": "0-1h", "quality": "HQ", "refill": False},
    {"id": "ig_likes_power", "platform": "instagram", "type": "likes", "name": "Instagram Power Likes (verifiziert)", "quantity": 1000, "price": 6.99, "min_qty": 50, "max_qty": 20000, "price_per_1k": 6.99, "delivery_time": "0-3h", "quality": "Premium", "refill": False},
    {"id": "ig_views_1k", "platform": "instagram", "type": "views", "name": "Instagram Reel Views", "quantity": 1000, "price": 0.99, "min_qty": 100, "max_qty": 1000000, "price_per_1k": 0.99, "delivery_time": "0-1h", "quality": "HQ", "refill": False},
    {"id": "ig_story_views", "platform": "instagram", "type": "views", "name": "Instagram Story Views", "quantity": 1000, "price": 1.49, "min_qty": 100, "max_qty": 500000, "price_per_1k": 1.49, "delivery_time": "0-1h", "quality": "HQ", "refill": False},
    {"id": "ig_comments", "platform": "instagram", "type": "comments", "name": "Instagram Kommentare", "quantity": 100, "price": 5.99, "min_qty": 10, "max_qty": 5000, "price_per_1k": 59.90, "delivery_time": "1-6h", "quality": "Custom", "refill": False},
    {"id": "ig_saves", "platform": "instagram", "type": "saves", "name": "Instagram Saves", "quantity": 1000, "price": 3.49, "min_qty": 100, "max_qty": 50000, "price_per_1k": 3.49, "delivery_time": "0-2h", "quality": "HQ", "refill": False},
    {"id": "ig_impressions", "platform": "instagram", "type": "impressions", "name": "Instagram Impressions + Reichweite", "quantity": 1000, "price": 1.99, "min_qty": 500, "max_qty": 1000000, "price_per_1k": 1.99, "delivery_time": "0-2h", "quality": "HQ", "refill": False},
    # TikTok (6 Services)
    {"id": "tt_followers_1k", "platform": "tiktok", "type": "followers", "name": "TikTok Follower", "quantity": 1000, "price": 5.99, "min_qty": 100, "max_qty": 100000, "price_per_1k": 5.99, "delivery_time": "1-24h", "quality": "HQ", "refill": True},
    {"id": "tt_followers_real", "platform": "tiktok", "type": "followers", "name": "TikTok Echte Follower (aktiv)", "quantity": 1000, "price": 12.99, "min_qty": 50, "max_qty": 20000, "price_per_1k": 12.99, "delivery_time": "2-48h", "quality": "Real", "refill": True},
    {"id": "tt_likes_1k", "platform": "tiktok", "type": "likes", "name": "TikTok Likes", "quantity": 1000, "price": 1.99, "min_qty": 50, "max_qty": 500000, "price_per_1k": 1.99, "delivery_time": "0-2h", "quality": "HQ", "refill": False},
    {"id": "tt_views_1k", "platform": "tiktok", "type": "views", "name": "TikTok Views", "quantity": 1000, "price": 0.49, "min_qty": 500, "max_qty": 10000000, "price_per_1k": 0.49, "delivery_time": "0-1h", "quality": "HQ", "refill": False},
    {"id": "tt_shares", "platform": "tiktok", "type": "shares", "name": "TikTok Shares", "quantity": 1000, "price": 3.99, "min_qty": 100, "max_qty": 100000, "price_per_1k": 3.99, "delivery_time": "1-6h", "quality": "HQ", "refill": False},
    {"id": "tt_comments", "platform": "tiktok", "type": "comments", "name": "TikTok Kommentare (Custom)", "quantity": 100, "price": 7.99, "min_qty": 10, "max_qty": 5000, "price_per_1k": 79.90, "delivery_time": "1-12h", "quality": "Custom", "refill": False},
    {"id": "tt_live_views", "platform": "tiktok", "type": "live_views", "name": "TikTok LIVE Zuschauer (30 Min)", "quantity": 100, "price": 4.99, "min_qty": 50, "max_qty": 10000, "price_per_1k": 49.90, "delivery_time": "Sofort", "quality": "Premium", "refill": False},
    # YouTube (6 Services)
    {"id": "yt_subs_1k", "platform": "youtube", "type": "subscribers", "name": "YouTube Abonnenten", "quantity": 1000, "price": 19.99, "min_qty": 50, "max_qty": 50000, "price_per_1k": 19.99, "delivery_time": "1-48h", "quality": "HQ", "refill": True},
    {"id": "yt_subs_real", "platform": "youtube", "type": "subscribers", "name": "YouTube Echte Abonnenten (aktiv)", "quantity": 1000, "price": 34.99, "min_qty": 50, "max_qty": 10000, "price_per_1k": 34.99, "delivery_time": "3-7d", "quality": "Real", "refill": True},
    {"id": "yt_views_1k", "platform": "youtube", "type": "views", "name": "YouTube Views", "quantity": 1000, "price": 3.99, "min_qty": 500, "max_qty": 1000000, "price_per_1k": 3.99, "delivery_time": "1-24h", "quality": "HQ", "refill": False},
    {"id": "yt_views_retention", "platform": "youtube", "type": "views", "name": "YouTube Views (hohe Retention)", "quantity": 1000, "price": 8.99, "min_qty": 500, "max_qty": 500000, "price_per_1k": 8.99, "delivery_time": "1-48h", "quality": "Premium", "refill": False},
    {"id": "yt_likes_1k", "platform": "youtube", "type": "likes", "name": "YouTube Likes", "quantity": 1000, "price": 6.99, "min_qty": 50, "max_qty": 50000, "price_per_1k": 6.99, "delivery_time": "1-12h", "quality": "HQ", "refill": False},
    {"id": "yt_watch_hours", "platform": "youtube", "type": "watch_hours", "name": "YouTube Watch Hours", "quantity": 1000, "price": 29.99, "min_qty": 100, "max_qty": 10000, "price_per_1k": 29.99, "delivery_time": "1-7d", "quality": "Premium", "refill": False},
    {"id": "yt_comments", "platform": "youtube", "type": "comments", "name": "YouTube Kommentare (Custom)", "quantity": 100, "price": 9.99, "min_qty": 5, "max_qty": 2000, "price_per_1k": 99.90, "delivery_time": "1-24h", "quality": "Custom", "refill": False},
    {"id": "yt_shorts_views", "platform": "youtube", "type": "views", "name": "YouTube Shorts Views", "quantity": 1000, "price": 1.99, "min_qty": 500, "max_qty": 5000000, "price_per_1k": 1.99, "delivery_time": "0-6h", "quality": "HQ", "refill": False},
    # Twitter/X (5 Services)
    {"id": "tw_followers_1k", "platform": "twitter", "type": "followers", "name": "Twitter/X Follower", "quantity": 1000, "price": 6.99, "min_qty": 100, "max_qty": 100000, "price_per_1k": 6.99, "delivery_time": "1-24h", "quality": "HQ", "refill": True},
    {"id": "tw_followers_real", "platform": "twitter", "type": "followers", "name": "Twitter/X Echte Follower", "quantity": 1000, "price": 14.99, "min_qty": 50, "max_qty": 20000, "price_per_1k": 14.99, "delivery_time": "2-48h", "quality": "Real", "refill": True},
    {"id": "tw_likes_1k", "platform": "twitter", "type": "likes", "name": "Twitter/X Likes", "quantity": 1000, "price": 2.99, "min_qty": 50, "max_qty": 100000, "price_per_1k": 2.99, "delivery_time": "0-2h", "quality": "HQ", "refill": False},
    {"id": "tw_retweets", "platform": "twitter", "type": "retweets", "name": "Twitter/X Retweets", "quantity": 1000, "price": 4.99, "min_qty": 50, "max_qty": 50000, "price_per_1k": 4.99, "delivery_time": "0-6h", "quality": "HQ", "refill": False},
    {"id": "tw_views", "platform": "twitter", "type": "views", "name": "Twitter/X Post Views", "quantity": 1000, "price": 0.79, "min_qty": 500, "max_qty": 10000000, "price_per_1k": 0.79, "delivery_time": "0-1h", "quality": "HQ", "refill": False},
    {"id": "tw_space_listeners", "platform": "twitter", "type": "listeners", "name": "Twitter/X Space Zuhoerer", "quantity": 100, "price": 3.99, "min_qty": 50, "max_qty": 5000, "price_per_1k": 39.90, "delivery_time": "Sofort", "quality": "Premium", "refill": False},
    # Telegram (4 Services)
    {"id": "tg_members_1k", "platform": "telegram", "type": "members", "name": "Telegram Mitglieder", "quantity": 1000, "price": 7.99, "min_qty": 100, "max_qty": 100000, "price_per_1k": 7.99, "delivery_time": "1-48h", "quality": "HQ", "refill": False},
    {"id": "tg_members_real", "platform": "telegram", "type": "members", "name": "Telegram Echte Mitglieder", "quantity": 1000, "price": 16.99, "min_qty": 50, "max_qty": 20000, "price_per_1k": 16.99, "delivery_time": "2-72h", "quality": "Real", "refill": False},
    {"id": "tg_views", "platform": "telegram", "type": "views", "name": "Telegram Post Views", "quantity": 1000, "price": 0.99, "min_qty": 100, "max_qty": 1000000, "price_per_1k": 0.99, "delivery_time": "0-1h", "quality": "HQ", "refill": False},
    {"id": "tg_reactions", "platform": "telegram", "type": "reactions", "name": "Telegram Reaktionen", "quantity": 1000, "price": 2.49, "min_qty": 50, "max_qty": 100000, "price_per_1k": 2.49, "delivery_time": "0-2h", "quality": "HQ", "refill": False},
    {"id": "tg_shares", "platform": "telegram", "type": "shares", "name": "Telegram Post Shares", "quantity": 1000, "price": 3.99, "min_qty": 100, "max_qty": 50000, "price_per_1k": 3.99, "delivery_time": "1-6h", "quality": "HQ", "refill": False},
    # Spotify (4 Services)
    {"id": "sp_plays_1k", "platform": "spotify", "type": "plays", "name": "Spotify Plays", "quantity": 1000, "price": 3.49, "min_qty": 500, "max_qty": 1000000, "price_per_1k": 3.49, "delivery_time": "1-24h", "quality": "Premium", "refill": False},
    {"id": "sp_plays_premium", "platform": "spotify", "type": "plays", "name": "Spotify Premium Plays (Algorithmus-Boost)", "quantity": 1000, "price": 6.99, "min_qty": 500, "max_qty": 500000, "price_per_1k": 6.99, "delivery_time": "1-48h", "quality": "Premium", "refill": False},
    {"id": "sp_followers", "platform": "spotify", "type": "followers", "name": "Spotify Follower", "quantity": 1000, "price": 9.99, "min_qty": 100, "max_qty": 50000, "price_per_1k": 9.99, "delivery_time": "1-48h", "quality": "HQ", "refill": True},
    {"id": "sp_monthly_listeners", "platform": "spotify", "type": "listeners", "name": "Spotify Monatliche Hoerer", "quantity": 1000, "price": 4.99, "min_qty": 500, "max_qty": 500000, "price_per_1k": 4.99, "delivery_time": "1-72h", "quality": "Premium", "refill": False},
    {"id": "sp_playlist_adds", "platform": "spotify", "type": "playlist", "name": "Spotify Playlist-Platzierung", "quantity": 1, "price": 14.99, "min_qty": 1, "max_qty": 50, "price_per_1k": 14990, "delivery_time": "1-7d", "quality": "Premium", "refill": False},
    # Facebook (NEU - 4 Services)
    {"id": "fb_likes_page", "platform": "facebook", "type": "likes", "name": "Facebook Seiten-Likes", "quantity": 1000, "price": 7.99, "min_qty": 100, "max_qty": 50000, "price_per_1k": 7.99, "delivery_time": "1-48h", "quality": "HQ", "refill": True},
    {"id": "fb_followers", "platform": "facebook", "type": "followers", "name": "Facebook Follower", "quantity": 1000, "price": 5.99, "min_qty": 100, "max_qty": 100000, "price_per_1k": 5.99, "delivery_time": "1-24h", "quality": "HQ", "refill": True},
    {"id": "fb_post_likes", "platform": "facebook", "type": "likes", "name": "Facebook Post Likes", "quantity": 1000, "price": 2.99, "min_qty": 50, "max_qty": 100000, "price_per_1k": 2.99, "delivery_time": "0-6h", "quality": "HQ", "refill": False},
    {"id": "fb_views", "platform": "facebook", "type": "views", "name": "Facebook Video Views", "quantity": 1000, "price": 1.49, "min_qty": 500, "max_qty": 5000000, "price_per_1k": 1.49, "delivery_time": "0-3h", "quality": "HQ", "refill": False},
    # LinkedIn (NEU - 3 Services)
    {"id": "li_followers", "platform": "linkedin", "type": "followers", "name": "LinkedIn Follower", "quantity": 1000, "price": 12.99, "min_qty": 50, "max_qty": 25000, "price_per_1k": 12.99, "delivery_time": "2-48h", "quality": "HQ", "refill": True},
    {"id": "li_likes", "platform": "linkedin", "type": "likes", "name": "LinkedIn Post Likes", "quantity": 1000, "price": 5.99, "min_qty": 50, "max_qty": 50000, "price_per_1k": 5.99, "delivery_time": "1-12h", "quality": "HQ", "refill": False},
    {"id": "li_connections", "platform": "linkedin", "type": "connections", "name": "LinkedIn Connections", "quantity": 100, "price": 9.99, "min_qty": 10, "max_qty": 5000, "price_per_1k": 99.90, "delivery_time": "2-72h", "quality": "Real", "refill": False},
    # Threads (NEU - 3 Services)
    {"id": "th_followers", "platform": "threads", "type": "followers", "name": "Threads Follower", "quantity": 1000, "price": 6.99, "min_qty": 100, "max_qty": 50000, "price_per_1k": 6.99, "delivery_time": "1-24h", "quality": "HQ", "refill": True},
    {"id": "th_likes", "platform": "threads", "type": "likes", "name": "Threads Likes", "quantity": 1000, "price": 2.99, "min_qty": 50, "max_qty": 100000, "price_per_1k": 2.99, "delivery_time": "0-3h", "quality": "HQ", "refill": False},
    {"id": "th_reposts", "platform": "threads", "type": "reposts", "name": "Threads Reposts", "quantity": 1000, "price": 4.49, "min_qty": 50, "max_qty": 50000, "price_per_1k": 4.49, "delivery_time": "0-6h", "quality": "HQ", "refill": False},
]

PLATFORMS = {
    "instagram": {"name": "Instagram", "icon": "instagram", "color": "#E1306C"},
    "tiktok": {"name": "TikTok", "icon": "tiktok", "color": "#00F2EA"},
    "youtube": {"name": "YouTube", "icon": "youtube", "color": "#FF0000"},
    "twitter": {"name": "Twitter/X", "icon": "twitter", "color": "#1DA1F2"},
    "telegram": {"name": "Telegram", "icon": "telegram", "color": "#0088CC"},
    "spotify": {"name": "Spotify", "icon": "spotify", "color": "#1DB954"},
    "facebook": {"name": "Facebook", "icon": "facebook", "color": "#1877F2"},
    "linkedin": {"name": "LinkedIn", "icon": "linkedin", "color": "#0A66C2"},
    "threads": {"name": "Threads", "icon": "threads", "color": "#000000"},
}


# ── List all services ──
@router.get("/services")
async def list_services(platform: Optional[str] = None):
    services = SMM_SERVICES
    if platform:
        services = [s for s in services if s["platform"] == platform]
    return {
        "services": services,
        "platforms": PLATFORMS,
        "total": len(services),
    }


# ── Get service detail ──
@router.get("/services/{service_id}")
async def get_service(service_id: str):
    svc = next((s for s in SMM_SERVICES if s["id"] == service_id), None)
    if not svc:
        raise HTTPException(404, "Service nicht gefunden")
    return svc


# ── Calculate price ──
class PriceCalcRequest(BaseModel):
    service_id: str
    quantity: int

@router.post("/calculate")
async def calculate_price(req: PriceCalcRequest):
    svc = next((s for s in SMM_SERVICES if s["id"] == req.service_id), None)
    if not svc:
        raise HTTPException(404, "Service nicht gefunden")
    if req.quantity < svc["min_qty"]:
        raise HTTPException(400, f"Mindestmenge: {svc['min_qty']}")
    if req.quantity > svc["max_qty"]:
        raise HTTPException(400, f"Maximalmenge: {svc['max_qty']:,}")

    price = round(req.quantity / 1000 * svc["price_per_1k"], 2)
    return {
        "service": svc["name"],
        "quantity": req.quantity,
        "price_per_1k": svc["price_per_1k"],
        "total_price": price,
        "currency": "EUR",
        "delivery_time": svc["delivery_time"],
    }


# ── Place order ──
class OrderRequest(BaseModel):
    service_id: str
    target_url: str
    quantity: int
    drip_feed: bool = False
    drip_feed_interval_min: int = 60
    drip_feed_runs: int = 1
    idempotency_key: Optional[str] = None

@router.post("/order")
async def place_order(req: OrderRequest, request: Request):
    user = await get_current_user(request)
    user_id = str(user["_id"])
    _require_live_smm_provider_for_value_action()
    idempotency_key = _require_smm_idempotency_key(req.idempotency_key, request, prefix="smm-order")
    key_hash = _smm_key_hash(idempotency_key)

    existing = await db.smm_orders.find_one(
        {"user_id": user_id, "idempotency_key_hash": key_hash},
        {"_id": 0},
    )
    if existing:
        return {
            "ok": True,
            "order_id": existing["order_id"],
            "provider_order_id": existing.get("provider_order_id"),
            "provider_error": existing.get("provider_error"),
            "service": existing.get("service_name"),
            "quantity": existing.get("total_quantity"),
            "total_price": existing.get("total_price"),
            "new_balance": existing.get("balance_after"),
            "delivery_time": existing.get("delivery_time"),
            "status": existing.get("status"),
            "message": f"Bestellung {existing['order_id']} bereits verarbeitet.",
            "replayed": True,
        }

    svc = next((s for s in SMM_SERVICES if s["id"] == req.service_id), None)
    if not svc:
        raise HTTPException(404, "Service nicht gefunden")
    if req.quantity < svc["min_qty"]:
        raise HTTPException(400, f"Mindestmenge: {svc['min_qty']}")
    if req.quantity > svc["max_qty"]:
        raise HTTPException(400, f"Maximalmenge: {svc['max_qty']:,}")
    if not req.target_url:
        raise HTTPException(400, "Bitte Link/URL angeben")

    total_qty = req.quantity * (req.drip_feed_runs if req.drip_feed else 1)
    total_price = round(total_qty / 1000 * svc["price_per_1k"], 2)
    order_id = f"SMM-{key_hash[:8].upper()}"
    now = datetime.now(timezone.utc)

    payment = await debit_wallet(
        user_id=user_id,
        amount=total_price,
        tx_type=TransactionType.PAYMENT,
        description=f"BlitzBoost: {total_qty:,}x {svc['name']}",
        reference=f"SMM-{key_hash[:12].upper()}",
        metadata={
            "kind": "smm_boost",
            "order_id": order_id,
            "service_id": svc["id"],
            "quantity": total_qty,
        },
        idempotency_key=idempotency_key,
    )
    if not payment.success:
        raise HTTPException(status_code=400, detail=payment.error or "Wallet-Zahlung fehlgeschlagen")

    order = {
        "order_id": order_id,
        "user_email": user.get("email"),
        "user_id": user_id,
        "service_id": svc["id"],
        "service_name": svc["name"],
        "platform": svc["platform"],
        "type": svc["type"],
        "target_url": req.target_url,
        "quantity": req.quantity,
        "total_quantity": total_qty,
        "price_per_1k": svc["price_per_1k"],
        "total_price": total_price,
        "drip_feed": req.drip_feed,
        "drip_feed_interval_min": req.drip_feed_interval_min if req.drip_feed else 0,
        "drip_feed_runs": req.drip_feed_runs if req.drip_feed else 1,
        "start_count": 0,
        "remains": total_qty,
        "status": "pending",
        "delivery_time": svc["delivery_time"],
        "idempotency_key_hash": key_hash,
        "wallet_transaction_id": payment.transaction_id,
        "balance_after": payment.new_balance,
        "created_at": now.isoformat(),
    }

    try:
        await db.smm_orders.update_one(
            {"user_id": user_id, "idempotency_key_hash": key_hash},
            {"$setOnInsert": order},
            upsert=True,
        )
        stored = await db.smm_orders.find_one(
            {"user_id": user_id, "idempotency_key_hash": key_hash},
            {"_id": 0},
        )
        if not stored:
            raise RuntimeError("smm_order_not_persisted")
        order = stored
    except Exception as exc:
        refund = await credit_wallet(
            user_id=user_id,
            amount=total_price,
            tx_type=TransactionType.REFUND,
            description="BlitzBoost Rückbuchung",
            reference=f"SMM-REF-{key_hash[:10].upper()}",
            source="smm_order_rollback",
            metadata={"order_id": order_id, "reason": str(exc)[:200]},
            idempotency_key=f"smm-order-refund:{idempotency_key}",
        )
        if not refund.success:
            raise HTTPException(status_code=500, detail="Auftragsspeicherung und Rückbuchung fehlgeschlagen. Manuelle Prüfung erforderlich.")
        raise HTTPException(status_code=500, detail="Auftrag konnte nicht gespeichert werden. Zahlung wurde zurückgebucht.")

    provider_order_id = None
    provider_error = None
    provider_uncertain = False

    if smm_provider.is_configured() and not order.get("provider_order_id") and order.get("status") == "pending":
        try:
            provider_result = await smm_provider.place_order(svc["id"], req.target_url, total_qty, db=db)
            if provider_result.get("order"):
                provider_order_id = int(provider_result["order"])
                await db.smm_orders.update_one(
                    {"order_id": order_id, "provider_order_id": {"$exists": False}},
                    {"$set": {
                        "provider_order_id": provider_order_id,
                        "status": "in_progress",
                        "provider_raw": provider_result,
                        "provider_submitted_at": datetime.now(timezone.utc).isoformat(),
                    }},
                )
            elif provider_result.get("error"):
                provider_error = str(provider_result["error"])
                refund = await credit_wallet(
                    user_id=user_id,
                    amount=total_price,
                    tx_type=TransactionType.REFUND,
                    description="BlitzBoost Provider-Ablehnung",
                    reference=f"SMM-REF-{key_hash[:10].upper()}",
                    source="smm_provider_rejected",
                    metadata={"order_id": order_id, "provider_error": provider_error},
                    idempotency_key=f"smm-provider-refund:{idempotency_key}",
                )
                await db.smm_orders.update_one(
                    {"order_id": order_id},
                    {"$set": {
                        "provider_error": provider_error,
                        "status": "refunded_provider_failed" if refund.success else "reconciliation_required",
                        "refund_transaction_id": refund.transaction_id if refund.success else None,
                        "refunded_at": datetime.now(timezone.utc).isoformat() if refund.success else None,
                    }},
                )
                if not refund.success:
                    raise HTTPException(status_code=500, detail="Provider hat abgelehnt und Rückbuchung muss manuell geprüft werden.")
        except HTTPException:
            raise
        except Exception as exc:
            # Network/provider timeout may have occurred after the provider accepted
            # the request. Never refund automatically in an uncertain state.
            provider_error = str(exc)
            provider_uncertain = True
            await db.smm_orders.update_one(
                {"order_id": order_id},
                {"$set": {
                    "provider_error": provider_error[:500],
                    "status": "provider_uncertain",
                    "provider_uncertain_at": datetime.now(timezone.utc).isoformat(),
                }},
            )
    elif not smm_provider.is_configured():
        await db.smm_orders.update_one(
            {"order_id": order_id, "status": "pending"},
            {"$set": {"status": "pending_manual", "provider_configured": False}},
        )

    final_order = await db.smm_orders.find_one({"order_id": order_id}, {"_id": 0}) or order
    return {
        "ok": True,
        "order_id": order_id,
        "provider_order_id": final_order.get("provider_order_id"),
        "provider_error": final_order.get("provider_error"),
        "provider_uncertain": provider_uncertain,
        "service": svc["name"],
        "quantity": total_qty,
        "total_price": total_price,
        "new_balance": payment.new_balance,
        "delivery_time": svc["delivery_time"],
        "status": final_order.get("status"),
        "message": f"Bestellung {order_id} aufgegeben! {total_qty:,}x {svc['name']} fuer EUR {total_price:.2f}.",
        "replayed": bool(payment.idempotent_replay),
    }


# ── My orders ──
@router.get("/orders")
async def my_orders(request: Request, status: Optional[str] = None):
    user = await get_current_user(request)
    query = {"user_email": user.get("email")}
    if status:
        query["status"] = status
    orders = await db.smm_orders.find(query, {"_id": 0}).sort("created_at", -1).limit(50).to_list(50)
    return {"orders": orders, "total": len(orders)}


# ── Order detail ──
@router.get("/orders/{order_id}")
async def order_detail(order_id: str, request: Request):
    user = await get_current_user(request)
    order = await db.smm_orders.find_one({"order_id": order_id, "user_email": user.get("email")}, {"_id": 0})
    if not order:
        raise HTTPException(404, "Bestellung nicht gefunden")
    return order


# ── Mass order ──
class MassOrderItem(BaseModel):
    service_id: str
    target_url: str
    quantity: int

class MassOrderRequest(BaseModel):
    orders: list[MassOrderItem]
    idempotency_key: Optional[str] = None

@router.post("/mass-order")
async def mass_order(req: MassOrderRequest, request: Request):
    user = await get_current_user(request)
    user_id = str(user["_id"])
    _require_live_smm_provider_for_value_action()
    if not req.orders:
        raise HTTPException(status_code=400, detail="Keine Bestellungen")
    if len(req.orders) > 50:
        raise HTTPException(400, "Maximal 50 Bestellungen pro Mass-Order")

    idempotency_key = _require_smm_idempotency_key(req.idempotency_key, request, prefix="smm-mass")
    key_hash = _smm_key_hash(idempotency_key)
    batch_id = f"SMMB-{key_hash[:10].upper()}"

    existing_batch = await db.smm_mass_batches.find_one(
        {"user_id": user_id, "idempotency_key_hash": key_hash},
        {"_id": 0},
    )
    if existing_batch and existing_batch.get("status") == "completed":
        return {
            "ok": True,
            "order_ids": existing_batch.get("order_ids", []),
            "total_orders": len(existing_batch.get("order_ids", [])),
            "total_price": existing_batch.get("total_price", 0),
            "new_balance": existing_batch.get("balance_after"),
            "message": "Mass-Order bereits verarbeitet",
            "replayed": True,
        }

    total_price = 0.0
    validated = []
    for item in req.orders:
        svc = next((s for s in SMM_SERVICES if s["id"] == item.service_id), None)
        if not svc:
            raise HTTPException(400, f"Service {item.service_id} nicht gefunden")
        if item.quantity < svc["min_qty"] or item.quantity > svc["max_qty"]:
            raise HTTPException(400, f"Menge fuer {svc['name']} ungueltig ({svc['min_qty']}-{svc['max_qty']:,})")
        if not item.target_url:
            raise HTTPException(400, f"Ziel-URL für {svc['name']} fehlt")
        price = round(item.quantity / 1000 * svc["price_per_1k"], 2)
        total_price = round(total_price + price, 2)
        validated.append({"svc": svc, "item": item, "price": price})

    payment = await debit_wallet(
        user_id=user_id,
        amount=total_price,
        tx_type=TransactionType.PAYMENT,
        description=f"BlitzBoost Mass-Order: {len(validated)} Bestellungen",
        reference=f"SMMB-{key_hash[:12].upper()}",
        metadata={"kind": "smm_boost_mass", "batch_id": batch_id, "count": len(validated)},
        idempotency_key=idempotency_key,
    )
    if not payment.success:
        raise HTTPException(status_code=400, detail=payment.error or "Wallet-Zahlung fehlgeschlagen")

    now = datetime.now(timezone.utc)
    order_ids = []
    try:
        for index, v in enumerate(validated):
            oid = f"SMM-{key_hash[:8].upper()}-{index + 1:02d}"
            order_ids.append(oid)
            await db.smm_orders.update_one(
                {"order_id": oid, "user_id": user_id},
                {"$setOnInsert": {
                    "order_id": oid,
                    "batch_id": batch_id,
                    "user_email": user.get("email"),
                    "user_id": user_id,
                    "service_id": v["svc"]["id"],
                    "service_name": v["svc"]["name"],
                    "platform": v["svc"]["platform"],
                    "type": v["svc"]["type"],
                    "target_url": v["item"].target_url,
                    "quantity": v["item"].quantity,
                    "total_quantity": v["item"].quantity,
                    "total_price": v["price"],
                    "status": "pending_manual" if not smm_provider.is_configured() else "pending",
                    "mass_order": True,
                    "idempotency_key_hash": key_hash,
                    "wallet_transaction_id": payment.transaction_id,
                    "created_at": now.isoformat(),
                }},
                upsert=True,
            )

        batch = {
            "batch_id": batch_id,
            "user_id": user_id,
            "idempotency_key_hash": key_hash,
            "order_ids": order_ids,
            "total_price": total_price,
            "wallet_transaction_id": payment.transaction_id,
            "balance_after": payment.new_balance,
            "status": "completed",
            "created_at": now.isoformat(),
        }
        await db.smm_mass_batches.update_one(
            {"user_id": user_id, "idempotency_key_hash": key_hash},
            {"$setOnInsert": batch},
            upsert=True,
        )
    except Exception as exc:
        await db.smm_orders.update_many(
            {"batch_id": batch_id, "user_id": user_id},
            {"$set": {"status": "cancelled_rollback", "rollback_reason": str(exc)[:300]}},
        )
        refund = await credit_wallet(
            user_id=user_id,
            amount=total_price,
            tx_type=TransactionType.REFUND,
            description="BlitzBoost Mass-Order Rückbuchung",
            reference=f"SMMB-REF-{key_hash[:9].upper()}",
            source="smm_mass_rollback",
            metadata={"batch_id": batch_id},
            idempotency_key=f"smm-mass-refund:{idempotency_key}",
        )
        if not refund.success:
            raise HTTPException(status_code=500, detail="Mass-Order und Rückbuchung benötigen manuelle Prüfung.")
        raise HTTPException(status_code=500, detail="Mass-Order konnte nicht gespeichert werden. Zahlung wurde zurückgebucht.")

    return {
        "ok": True,
        "order_ids": order_ids,
        "total_orders": len(order_ids),
        "total_price": total_price,
        "new_balance": payment.new_balance,
        "message": f"{len(order_ids)} Bestellungen aufgegeben fuer EUR {total_price:.2f}",
        "replayed": bool(payment.idempotent_replay),
    }


# ── Admin: Update order status ──
class UpdateStatusRequest(BaseModel):
    status: str
    start_count: int = 0
    remains: int = 0

@router.post("/admin/orders/{order_id}/status")
async def update_order_status(order_id: str, req: UpdateStatusRequest, request: Request):
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(403, "Admin only")
    order = await db.smm_orders.find_one({"order_id": order_id})
    if not order:
        raise HTTPException(404, "Bestellung nicht gefunden")

    update = {"status": req.status}
    if req.start_count:
        update["start_count"] = req.start_count
    if req.remains >= 0:
        update["remains"] = req.remains
    if req.status == "completed":
        update["completed_at"] = datetime.now(timezone.utc).isoformat()

    await db.smm_orders.update_one({"order_id": order_id}, {"$set": update})
    return {"ok": True, "message": f"Order {order_id} -> {req.status}"}


# ── Admin: All orders ──
@router.get("/admin/orders")
async def admin_all_orders(request: Request, status: Optional[str] = None, limit: int = 100):
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(403, "Admin only")
    query = {}
    if status:
        query["status"] = status
    orders = await db.smm_orders.find(query, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    total = await db.smm_orders.count_documents(query)
    revenue = sum(o.get("total_price", 0) for o in orders)
    return {"orders": orders, "total": total, "revenue": round(revenue, 2)}



# ── Provider Integration Admin Endpoints ──
@router.get("/admin/provider/status")
async def provider_status(request: Request):
    """Check if SMM Provider is configured and reachable."""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(403, "Admin only")
    return {
        "configured": smm_provider.is_configured(),
        "provider_url": smm_provider.SMM_PROVIDER_URL,
        "api_key_present": bool(smm_provider.SMM_PROVIDER_API_KEY),
    }


@router.get("/admin/provider/balance")
async def provider_balance(request: Request):
    """Fetch remaining balance at SMM provider."""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(403, "Admin only")
    if not smm_provider.is_configured():
        raise HTTPException(503, "SMM Provider not configured")
    return await smm_provider.get_balance()


@router.post("/admin/orders/{order_id}/sync")
async def sync_order_status(order_id: str, request: Request):
    """Poll SMM provider for latest order status and update DB."""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(403, "Admin only")
    order = await db.smm_orders.find_one({"order_id": order_id})
    if not order:
        raise HTTPException(404, "Bestellung nicht gefunden")
    pid = order.get("provider_order_id")
    if not pid:
        raise HTTPException(400, "Order has no provider_order_id")
    status_data = await smm_provider.get_order_status(int(pid))
    # Provider returns: { status, charge, start_count, remains, currency }
    update = {"provider_status_raw": status_data}
    provider_status_val = (status_data.get("status") or "").lower()
    if provider_status_val == "completed":
        update["status"] = "completed"
        update["completed_at"] = datetime.now(timezone.utc).isoformat()
    elif provider_status_val in ("in progress", "processing"):
        update["status"] = "in_progress"
    elif provider_status_val == "canceled":
        update["status"] = "canceled"
    if status_data.get("start_count") is not None:
        update["start_count"] = int(status_data["start_count"])
    if status_data.get("remains") is not None:
        update["remains"] = int(status_data["remains"])
    await db.smm_orders.update_one({"order_id": order_id}, {"$set": update})
    return {"ok": True, "provider_status": provider_status_val, "updates": update}


class ServiceMappingRequest(BaseModel):
    internal_id: str
    provider_service_id: int


@router.post("/admin/provider/mapping")
async def set_service_mapping(req: ServiceMappingRequest, request: Request):
    """Override provider service ID mapping for a specific BidBlitz service."""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(403, "Admin only")
    await db.smm_service_mapping.update_one(
        {"internal_id": req.internal_id},
        {"$set": {
            "internal_id": req.internal_id,
            "provider_service_id": req.provider_service_id,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }},
        upsert=True,
    )
    return {"ok": True, "mapping": {req.internal_id: req.provider_service_id}}


@router.get("/admin/provider/services")
async def list_provider_services(request: Request):
    """Fetch raw list of services from SMM provider (to discover service IDs)."""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(403, "Admin only")
    if not smm_provider.is_configured():
        raise HTTPException(503, "SMM Provider not configured")
    return {"services": await smm_provider.get_provider_services()}
