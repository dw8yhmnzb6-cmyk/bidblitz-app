"""
BidBlitz V2 - Live Shopping (TikTok Shop Style)
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from datetime import datetime, timezone
from core.database import db
from core.security import get_current_user
import secrets, random

router = APIRouter(prefix="/api/live-shopping", tags=["live-shopping"])

LIVE_STREAMS = [
    {"id": "ls1", "title": "Sneaker Drop: Nike Air Max 2026", "host": "SneakerKing", "viewers": 1243, "product": "Nike Air Max 2026", "price": 189.99, "discount": 30, "stock": 12, "category": "Fashion", "thumbnail": "sneaker"},
    {"id": "ls2", "title": "Tech Deals: AirPods Pro 3 Unboxing", "host": "TechBuzz", "viewers": 892, "product": "AirPods Pro 3", "price": 279.00, "discount": 15, "stock": 25, "category": "Tech", "thumbnail": "airpods"},
    {"id": "ls3", "title": "Beauty Haul: Korean Skincare Set", "host": "GlowUp_Lisa", "viewers": 2105, "product": "K-Beauty 10-Step Set", "price": 89.99, "discount": 40, "stock": 50, "category": "Beauty", "thumbnail": "beauty"},
    {"id": "ls4", "title": "Gaming Setup unter 500 EUR", "host": "ProGamer_DE", "viewers": 567, "product": "RGB Gaming Bundle", "price": 449.00, "discount": 20, "stock": 8, "category": "Gaming", "thumbnail": "gaming"},
    {"id": "ls5", "title": "Sammlerstuecke: Pokemon Karten OVP", "host": "CardMaster", "viewers": 3401, "product": "Pokemon Booster Box 2026", "price": 159.99, "discount": 10, "stock": 5, "category": "Collectibles", "thumbnail": "pokemon"},
    {"id": "ls6", "title": "Fitness Supplements Flash Sale", "host": "FitLife_Max", "viewers": 445, "product": "Protein & Pre-Workout Bundle", "price": 69.99, "discount": 35, "stock": 100, "category": "Fitness", "thumbnail": "supplements"},
]

class BuyFromStream(BaseModel):
    stream_id: str
    quantity: int = Field(default=1, ge=1, le=5)

@router.get("/streams")
async def get_streams():
    streams = []
    for s in LIVE_STREAMS:
        s_copy = dict(s)
        s_copy["viewers"] = s["viewers"] + random.randint(-50, 100)
        s_copy["sale_price"] = round(s["price"] * (1 - s["discount"] / 100), 2)
        streams.append(s_copy)
    return {"streams": streams}

@router.post("/buy")
async def buy_from_stream(req: BuyFromStream, request: Request):
    user = await get_current_user(request)
    stream = next((s for s in LIVE_STREAMS if s["id"] == req.stream_id), None)
    if not stream:
        raise HTTPException(404, "Stream nicht gefunden")
    sale_price = round(stream["price"] * (1 - stream["discount"] / 100), 2)
    total = round(sale_price * req.quantity, 2)
    order = {
        "order_id": f"live_{secrets.token_hex(6)}",
        "user_email": user.get("email", ""),
        "stream_id": req.stream_id,
        "product": stream["product"],
        "quantity": req.quantity,
        "unit_price": sale_price,
        "total": total,
        "discount_pct": stream["discount"],
        "host": stream["host"],
        "status": "confirmed",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.live_shopping_orders.insert_one(order)
    return {"ok": True, "order_id": order["order_id"], "total": total,
            "message": f"{stream['product']} gekauft fuer {total} EUR ({stream['discount']}% Rabatt)!"}

@router.get("/my-orders")
async def my_orders(request: Request):
    user = await get_current_user(request)
    orders = await db.live_shopping_orders.find({"user_email": user.get("email", "")}, {"_id": 0}).sort("created_at", -1).to_list(20)
    return {"orders": orders}
