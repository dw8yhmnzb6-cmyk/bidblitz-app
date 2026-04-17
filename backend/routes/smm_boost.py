"""
BidBlitz V2 - BlitzBoost (Social Media Marketing Panel)
Buy followers, likes, views for Instagram, TikTok, YouTube, Twitter.
Pay with wallet. Drip-feed & mass order support.
"""
import secrets
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional
from core.database import db
from core.security import get_current_user

router = APIRouter(prefix="/api/smm", tags=["smm-boost"])

# ── Service Catalog ──
SMM_SERVICES = [
    # Instagram
    {"id": "ig_followers_1k", "platform": "instagram", "type": "followers", "name": "Instagram Follower", "quantity": 1000, "price": 4.99, "min_qty": 100, "max_qty": 50000, "price_per_1k": 4.99, "delivery_time": "1-24h", "quality": "HQ", "refill": True},
    {"id": "ig_followers_premium", "platform": "instagram", "type": "followers", "name": "Instagram Premium Follower", "quantity": 1000, "price": 8.99, "min_qty": 50, "max_qty": 20000, "price_per_1k": 8.99, "delivery_time": "1-12h", "quality": "Premium", "refill": True},
    {"id": "ig_likes_1k", "platform": "instagram", "type": "likes", "name": "Instagram Likes", "quantity": 1000, "price": 2.49, "min_qty": 50, "max_qty": 100000, "price_per_1k": 2.49, "delivery_time": "0-1h", "quality": "HQ", "refill": False},
    {"id": "ig_views_1k", "platform": "instagram", "type": "views", "name": "Instagram Reel Views", "quantity": 1000, "price": 0.99, "min_qty": 100, "max_qty": 1000000, "price_per_1k": 0.99, "delivery_time": "0-1h", "quality": "HQ", "refill": False},
    {"id": "ig_comments", "platform": "instagram", "type": "comments", "name": "Instagram Kommentare", "quantity": 100, "price": 5.99, "min_qty": 10, "max_qty": 5000, "price_per_1k": 59.90, "delivery_time": "1-6h", "quality": "Custom", "refill": False},
    {"id": "ig_saves", "platform": "instagram", "type": "saves", "name": "Instagram Saves", "quantity": 1000, "price": 3.49, "min_qty": 100, "max_qty": 50000, "price_per_1k": 3.49, "delivery_time": "0-2h", "quality": "HQ", "refill": False},
    # TikTok
    {"id": "tt_followers_1k", "platform": "tiktok", "type": "followers", "name": "TikTok Follower", "quantity": 1000, "price": 5.99, "min_qty": 100, "max_qty": 100000, "price_per_1k": 5.99, "delivery_time": "1-24h", "quality": "HQ", "refill": True},
    {"id": "tt_likes_1k", "platform": "tiktok", "type": "likes", "name": "TikTok Likes", "quantity": 1000, "price": 1.99, "min_qty": 50, "max_qty": 500000, "price_per_1k": 1.99, "delivery_time": "0-2h", "quality": "HQ", "refill": False},
    {"id": "tt_views_1k", "platform": "tiktok", "type": "views", "name": "TikTok Views", "quantity": 1000, "price": 0.49, "min_qty": 500, "max_qty": 10000000, "price_per_1k": 0.49, "delivery_time": "0-1h", "quality": "HQ", "refill": False},
    {"id": "tt_shares", "platform": "tiktok", "type": "shares", "name": "TikTok Shares", "quantity": 1000, "price": 3.99, "min_qty": 100, "max_qty": 100000, "price_per_1k": 3.99, "delivery_time": "1-6h", "quality": "HQ", "refill": False},
    # YouTube
    {"id": "yt_subs_1k", "platform": "youtube", "type": "subscribers", "name": "YouTube Abonnenten", "quantity": 1000, "price": 19.99, "min_qty": 50, "max_qty": 50000, "price_per_1k": 19.99, "delivery_time": "1-48h", "quality": "HQ", "refill": True},
    {"id": "yt_views_1k", "platform": "youtube", "type": "views", "name": "YouTube Views", "quantity": 1000, "price": 3.99, "min_qty": 500, "max_qty": 1000000, "price_per_1k": 3.99, "delivery_time": "1-24h", "quality": "HQ", "refill": False},
    {"id": "yt_likes_1k", "platform": "youtube", "type": "likes", "name": "YouTube Likes", "quantity": 1000, "price": 6.99, "min_qty": 50, "max_qty": 50000, "price_per_1k": 6.99, "delivery_time": "1-12h", "quality": "HQ", "refill": False},
    {"id": "yt_watch_hours", "platform": "youtube", "type": "watch_hours", "name": "YouTube Watch Hours", "quantity": 1000, "price": 29.99, "min_qty": 100, "max_qty": 10000, "price_per_1k": 29.99, "delivery_time": "1-7d", "quality": "Premium", "refill": False},
    # Twitter/X
    {"id": "tw_followers_1k", "platform": "twitter", "type": "followers", "name": "Twitter/X Follower", "quantity": 1000, "price": 6.99, "min_qty": 100, "max_qty": 100000, "price_per_1k": 6.99, "delivery_time": "1-24h", "quality": "HQ", "refill": True},
    {"id": "tw_likes_1k", "platform": "twitter", "type": "likes", "name": "Twitter/X Likes", "quantity": 1000, "price": 2.99, "min_qty": 50, "max_qty": 100000, "price_per_1k": 2.99, "delivery_time": "0-2h", "quality": "HQ", "refill": False},
    {"id": "tw_retweets", "platform": "twitter", "type": "retweets", "name": "Twitter/X Retweets", "quantity": 1000, "price": 4.99, "min_qty": 50, "max_qty": 50000, "price_per_1k": 4.99, "delivery_time": "0-6h", "quality": "HQ", "refill": False},
    # Telegram
    {"id": "tg_members_1k", "platform": "telegram", "type": "members", "name": "Telegram Mitglieder", "quantity": 1000, "price": 7.99, "min_qty": 100, "max_qty": 100000, "price_per_1k": 7.99, "delivery_time": "1-48h", "quality": "HQ", "refill": False},
    {"id": "tg_views", "platform": "telegram", "type": "views", "name": "Telegram Post Views", "quantity": 1000, "price": 0.99, "min_qty": 100, "max_qty": 1000000, "price_per_1k": 0.99, "delivery_time": "0-1h", "quality": "HQ", "refill": False},
    # Spotify
    {"id": "sp_plays_1k", "platform": "spotify", "type": "plays", "name": "Spotify Plays", "quantity": 1000, "price": 3.49, "min_qty": 500, "max_qty": 1000000, "price_per_1k": 3.49, "delivery_time": "1-24h", "quality": "Premium", "refill": False},
    {"id": "sp_followers", "platform": "spotify", "type": "followers", "name": "Spotify Follower", "quantity": 1000, "price": 9.99, "min_qty": 100, "max_qty": 50000, "price_per_1k": 9.99, "delivery_time": "1-48h", "quality": "HQ", "refill": True},
]

PLATFORMS = {
    "instagram": {"name": "Instagram", "icon": "instagram", "color": "#E1306C"},
    "tiktok": {"name": "TikTok", "icon": "tiktok", "color": "#000000"},
    "youtube": {"name": "YouTube", "icon": "youtube", "color": "#FF0000"},
    "twitter": {"name": "Twitter/X", "icon": "twitter", "color": "#1DA1F2"},
    "telegram": {"name": "Telegram", "icon": "telegram", "color": "#0088CC"},
    "spotify": {"name": "Spotify", "icon": "spotify", "color": "#1DB954"},
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

@router.post("/order")
async def place_order(req: OrderRequest, request: Request):
    user = await get_current_user(request)
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

    balance = user.get("balance", user.get("bids_balance", 0))
    if balance < total_price:
        raise HTTPException(400, f"Nicht genug Guthaben. Benoetig: EUR {total_price:.2f}, Verfuegbar: EUR {balance:.2f}")

    # Deduct from wallet
    await db.users.update_one({"_id": user["_id"]}, {"$inc": {"balance": -total_price}})

    now = datetime.now(timezone.utc)
    order_id = f"SMM-{secrets.token_hex(4).upper()}"

    order = {
        "order_id": order_id,
        "user_email": user.get("email"),
        "user_id": user.get("id") or str(user["_id"]),
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
        "created_at": now.isoformat(),
    }

    await db.smm_orders.insert_one(order)

    # Transaction record
    await db.transactions.insert_one({
        "transaction_id": f"smm_{secrets.token_hex(6)}",
        "user_id": user.get("id") or str(user["_id"]),
        "user_email": user.get("email"),
        "type": "smm_boost",
        "amount": -total_price,
        "description": f"BlitzBoost: {total_qty:,}x {svc['name']}",
        "status": "completed",
        "created_at": now.isoformat(),
    })

    return {
        "ok": True,
        "order_id": order_id,
        "service": svc["name"],
        "quantity": total_qty,
        "total_price": total_price,
        "new_balance": round(balance - total_price, 2),
        "delivery_time": svc["delivery_time"],
        "status": "pending",
        "message": f"Bestellung {order_id} aufgegeben! {total_qty:,}x {svc['name']} fuer EUR {total_price:.2f}. Lieferung: {svc['delivery_time']}.",
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

@router.post("/mass-order")
async def mass_order(req: MassOrderRequest, request: Request):
    user = await get_current_user(request)
    if len(req.orders) > 50:
        raise HTTPException(400, "Maximal 50 Bestellungen pro Mass-Order")

    total_price = 0
    validated = []
    for item in req.orders:
        svc = next((s for s in SMM_SERVICES if s["id"] == item.service_id), None)
        if not svc:
            raise HTTPException(400, f"Service {item.service_id} nicht gefunden")
        if item.quantity < svc["min_qty"] or item.quantity > svc["max_qty"]:
            raise HTTPException(400, f"Menge fuer {svc['name']} ungueltig ({svc['min_qty']}-{svc['max_qty']:,})")
        price = round(item.quantity / 1000 * svc["price_per_1k"], 2)
        total_price += price
        validated.append({"svc": svc, "item": item, "price": price})

    balance = user.get("balance", user.get("bids_balance", 0))
    if balance < total_price:
        raise HTTPException(400, f"Nicht genug Guthaben. Benoetig: EUR {total_price:.2f}")

    await db.users.update_one({"_id": user["_id"]}, {"$inc": {"balance": -total_price}})

    now = datetime.now(timezone.utc)
    order_ids = []
    for v in validated:
        oid = f"SMM-{secrets.token_hex(4).upper()}"
        order_ids.append(oid)
        await db.smm_orders.insert_one({
            "order_id": oid,
            "user_email": user.get("email"),
            "user_id": user.get("id") or str(user["_id"]),
            "service_id": v["svc"]["id"],
            "service_name": v["svc"]["name"],
            "platform": v["svc"]["platform"],
            "type": v["svc"]["type"],
            "target_url": v["item"].target_url,
            "quantity": v["item"].quantity,
            "total_quantity": v["item"].quantity,
            "total_price": v["price"],
            "status": "pending",
            "mass_order": True,
            "created_at": now.isoformat(),
        })

    await db.transactions.insert_one({
        "transaction_id": f"smm_mass_{secrets.token_hex(6)}",
        "user_id": user.get("id") or str(user["_id"]),
        "user_email": user.get("email"),
        "type": "smm_boost",
        "amount": -total_price,
        "description": f"BlitzBoost Mass-Order: {len(order_ids)} Bestellungen",
        "status": "completed",
        "created_at": now.isoformat(),
    })

    return {
        "ok": True,
        "order_ids": order_ids,
        "total_orders": len(order_ids),
        "total_price": round(total_price, 2),
        "new_balance": round(balance - total_price, 2),
        "message": f"{len(order_ids)} Bestellungen aufgegeben fuer EUR {total_price:.2f}",
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
