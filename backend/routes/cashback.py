"""
BidBlitz V2 - Cashback & Affiliate Shopping
Users earn 2-8% cashback on partner purchases — paid to BidBlitz Wallet
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
from core.database import db
from core.security import get_current_user
import secrets

router = APIRouter(prefix="/api/cashback", tags=["cashback"])


# Simulated partner shops with cashback rates
PARTNER_SHOPS = [
    {"id": "amazon", "name": "Amazon", "logo": "https://logo.clearbit.com/amazon.de", "cashback_pct": 3, "category": "Alles", "color": "#FF9900", "popular": True},
    {"id": "nike", "name": "Nike", "logo": "https://logo.clearbit.com/nike.com", "cashback_pct": 6, "category": "Fashion", "color": "#111", "popular": True},
    {"id": "adidas", "name": "Adidas", "logo": "https://logo.clearbit.com/adidas.de", "cashback_pct": 5, "category": "Fashion", "color": "#000", "popular": True},
    {"id": "zalando", "name": "Zalando", "logo": "https://logo.clearbit.com/zalando.de", "cashback_pct": 4, "category": "Fashion", "color": "#FF6900", "popular": True},
    {"id": "mediamarkt", "name": "MediaMarkt", "logo": "https://logo.clearbit.com/mediamarkt.de", "cashback_pct": 2, "category": "Elektronik", "color": "#DF0000", "popular": True},
    {"id": "aboutyou", "name": "About You", "logo": "https://logo.clearbit.com/aboutyou.de", "cashback_pct": 7, "category": "Fashion", "color": "#E91E63"},
    {"id": "dm", "name": "dm Drogerie", "logo": "https://logo.clearbit.com/dm.de", "cashback_pct": 3, "category": "Drogerie", "color": "#005BAA"},
    {"id": "lieferando", "name": "Lieferando", "logo": "https://logo.clearbit.com/lieferando.de", "cashback_pct": 2, "category": "Essen", "color": "#FF8000"},
    {"id": "spotify", "name": "Spotify", "logo": "https://logo.clearbit.com/spotify.com", "cashback_pct": 8, "category": "Musik", "color": "#1DB954"},
    {"id": "apple", "name": "Apple", "logo": "https://logo.clearbit.com/apple.com", "cashback_pct": 1.5, "category": "Elektronik", "color": "#555"},
    {"id": "samsung", "name": "Samsung", "logo": "https://logo.clearbit.com/samsung.com", "cashback_pct": 3, "category": "Elektronik", "color": "#1428A0"},
    {"id": "douglas", "name": "Douglas", "logo": "https://logo.clearbit.com/douglas.de", "cashback_pct": 5, "category": "Beauty", "color": "#000"},
    {"id": "booking", "name": "Booking.com", "logo": "https://logo.clearbit.com/booking.com", "cashback_pct": 4, "category": "Reisen", "color": "#003580"},
    {"id": "expedia", "name": "Expedia", "logo": "https://logo.clearbit.com/expedia.de", "cashback_pct": 3.5, "category": "Reisen", "color": "#FBCE01"},
    {"id": "otto", "name": "OTTO", "logo": "https://logo.clearbit.com/otto.de", "cashback_pct": 4, "category": "Alles", "color": "#E20613"},
    {"id": "hm", "name": "H&M", "logo": "https://logo.clearbit.com/hm.com", "cashback_pct": 5, "category": "Fashion", "color": "#E50010"},
    {"id": "snipes", "name": "SNIPES", "logo": "https://logo.clearbit.com/snipes.com", "cashback_pct": 6, "category": "Sneakers", "color": "#000"},
    {"id": "footlocker", "name": "Foot Locker", "logo": "https://logo.clearbit.com/footlocker.de", "cashback_pct": 5, "category": "Sneakers", "color": "#000"},
    {"id": "ps_store", "name": "PlayStation Store", "logo": "https://logo.clearbit.com/playstation.com", "cashback_pct": 2, "category": "Gaming", "color": "#003791"},
    {"id": "steam", "name": "Steam", "logo": "https://logo.clearbit.com/steampowered.com", "cashback_pct": 2.5, "category": "Gaming", "color": "#1B2838"},
]

CATEGORIES = sorted(set(s["category"] for s in PARTNER_SHOPS))


class CashbackClaim(BaseModel):
    shop_id: str
    amount: float  # Purchase amount
    order_ref: str = ""  # User's order reference


@router.get("/shops")
async def get_shops(category: Optional[str] = None, search: Optional[str] = None):
    shops = PARTNER_SHOPS
    if category:
        shops = [s for s in shops if s["category"] == category]
    if search:
        q = search.lower()
        shops = [s for s in shops if q in s["name"].lower() or q in s["category"].lower()]
    return {"shops": shops, "total": len(shops), "categories": CATEGORIES}


@router.get("/shops/{shop_id}")
async def get_shop(shop_id: str):
    shop = next((s for s in PARTNER_SHOPS if s["id"] == shop_id), None)
    if not shop:
        raise HTTPException(404, "Shop nicht gefunden")
    return shop


@router.post("/claim")
async def claim_cashback(req: CashbackClaim, request: Request):
    """User claims cashback for a purchase (simulated — in production, verified via affiliate API)."""
    user = await get_current_user(request)
    email = user.get("email", "")

    shop = next((s for s in PARTNER_SHOPS if s["id"] == req.shop_id), None)
    if not shop:
        raise HTTPException(404, "Shop nicht gefunden")

    cashback_pct = shop["cashback_pct"]
    cashback_amount = round(req.amount * cashback_pct / 100, 2)

    # Credit to wallet (in production: pending → confirmed after 30 days)
    await db.users.update_one({"email": email}, {"$inc": {"balance": cashback_amount}})

    claim = {
        "claim_id": secrets.token_hex(8),
        "user_email": email,
        "shop_id": req.shop_id,
        "shop_name": shop["name"],
        "purchase_amount": req.amount,
        "cashback_pct": cashback_pct,
        "cashback_amount": cashback_amount,
        "order_ref": req.order_ref,
        "status": "confirmed",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.cashback_claims.insert_one(claim)

    return {
        "ok": True,
        "cashback_amount": cashback_amount,
        "message": f"€{cashback_amount:.2f} Cashback ({cashback_pct}%) von {shop['name']} gutgeschrieben!",
    }


@router.get("/my-cashback")
async def my_cashback(request: Request):
    user = await get_current_user(request)
    claims = await db.cashback_claims.find(
        {"user_email": user.get("email", "")}, {"_id": 0}
    ).sort("created_at", -1).to_list(50)

    total = sum(c.get("cashback_amount", 0) for c in claims)
    return {"claims": claims, "total_earned": round(total, 2), "count": len(claims)}


@router.get("/stats")
async def cashback_stats():
    total_claims = await db.cashback_claims.count_documents({})
    pipeline = [{"$group": {"_id": None, "total": {"$sum": "$cashback_amount"}}}]
    result = await db.cashback_claims.aggregate(pipeline).to_list(1)
    total_paid = result[0]["total"] if result else 0
    return {"total_claims": total_claims, "total_cashback_paid": round(total_paid, 2),
            "partner_count": len(PARTNER_SHOPS)}
