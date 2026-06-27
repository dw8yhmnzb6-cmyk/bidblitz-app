"""
BidBlitz V2 - Promo Codes, Leaderboard, Global Search
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime, timezone
from core.database import db
from core.security import get_current_user
import secrets

router = APIRouter(prefix="/api/extras", tags=["extras"])

PUBLIC_LEADERBOARD_BLOCKLIST = [
    "test",
    "demo",
    "admin",
    "bidblitz",
    "mitarbeiter",
    "staff",
    "merchant",
    "haendler",
    "system",
]


def _is_public_leaderboard_candidate(user: dict) -> bool:
    role = str(user.get("role") or "").lower()
    if role in {"admin", "merchant", "staff"}:
        return False

    haystack = " ".join([
        str(user.get("name") or ""),
        str(user.get("email") or ""),
    ]).lower()
    return not any(token in haystack for token in PUBLIC_LEADERBOARD_BLOCKLIST)


def _public_name(user: dict) -> str:
    name = str(user.get("name") or "").strip()
    email = str(user.get("email") or "").strip()
    if name:
        return name
    return email.split("@")[0] if email else "Nutzer"


def _leaderboard_entries(users: list[dict], formatter) -> list[dict]:
    entries = []
    for user in users:
        if not _is_public_leaderboard_candidate(user):
            continue
        entries.append({
            "name": _public_name(user),
            "premium": user.get("is_premium", False),
            "value": formatter(user),
        })
        if len(entries) >= 20:
            break

    return [
        {"rank": index + 1, **entry}
        for index, entry in enumerate(entries)
    ]


# ═══ PROMO CODES ═══
class PromoRedeem(BaseModel):
    code: str

class PromoCreate(BaseModel):
    code: str = Field(..., min_length=3, max_length=20)
    type: str = "percent"  # percent, fixed, credit
    value: float = Field(..., gt=0)
    max_uses: int = 100
    description: str = ""

@router.post("/promo/redeem")
async def redeem_promo(req: PromoRedeem, request: Request):
    user = await get_current_user(request)
    email = user.get("email", "")
    code = req.code.strip().upper()
    
    promo = await db.promo_codes.find_one({"code": code, "active": True})
    if not promo:
        raise HTTPException(404, "Code ungültig oder abgelaufen")
    
    if promo.get("used_count", 0) >= promo.get("max_uses", 100):
        raise HTTPException(400, "Code wurde zu oft verwendet")
    
    used_by = promo.get("used_by", [])
    if email in used_by:
        raise HTTPException(400, "Code bereits eingelöst")
    
    # Apply benefit
    benefit = 0
    if promo["type"] == "credit":
        benefit = promo["value"]
        await db.users.update_one({"email": email}, {"$inc": {"balance": benefit}})
    elif promo["type"] == "fixed":
        benefit = promo["value"]
        await db.users.update_one({"email": email}, {"$inc": {"balance": benefit}})
    
    await db.promo_codes.update_one(
        {"code": code},
        {"$inc": {"used_count": 1}, "$push": {"used_by": email}}
    )
    
    return {"ok": True, "message": f"Code eingelöst! +€{benefit:.2f} Guthaben", "benefit": benefit}

@router.post("/promo/create")
async def create_promo(req: PromoCreate, request: Request):
    user = await get_current_user(request)
    if user.get("role") not in ["admin", "merchant"]:
        raise HTTPException(403, "Nur Admin/Händler")
    
    promo = {
        "code": req.code.upper(),
        "type": req.type,
        "value": req.value,
        "max_uses": req.max_uses,
        "description": req.description,
        "creator_email": user.get("email", ""),
        "active": True,
        "used_count": 0,
        "used_by": [],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.promo_codes.insert_one(promo)
    return {"ok": True, "code": promo["code"]}

@router.get("/promo/list")
async def list_promos(request: Request):
    user = await get_current_user(request)
    if user.get("role") not in ["admin", "merchant"]:
        raise HTTPException(403, "Nur Admin/Händler")
    promos = await db.promo_codes.find({}, {"_id": 0}).sort("created_at", -1).to_list(50)
    return {"promos": promos}


# ═══ LEADERBOARD ═══
@router.get("/leaderboard")
async def get_leaderboard(type: str = "balance"):
    if type == "balance":
        users = await db.users.find({}, {"_id": 0, "name": 1, "email": 1, "balance": 1, "is_premium": 1, "role": 1}).sort("balance", -1).limit(100).to_list(100)
        return {
            "type": "Wallet Ranking",
            "hide_values": True,
            "entries": _leaderboard_entries(users, lambda _: ""),
        }
    elif type == "gaming":
        users = await db.users.find({"gaming_coins": {"$gt": 0}}, {"_id": 0, "name": 1, "email": 1, "gaming_coins": 1, "role": 1, "is_premium": 1}).sort("gaming_coins", -1).limit(100).to_list(100)
        return {"type": "Top Gamer", "entries": _leaderboard_entries(users, lambda user: f"{user.get('gaming_coins', 0)} Coins")}
    elif type == "rating":
        users = await db.users.find({"avg_rating": {"$gt": 0}}, {"_id": 0, "name": 1, "email": 1, "avg_rating": 1, "rating_count": 1, "role": 1, "is_premium": 1}).sort("avg_rating", -1).limit(100).to_list(100)
        return {"type": "Top Bewertungen", "entries": _leaderboard_entries(users, lambda user: f"{user.get('avg_rating', 0)}/5 ({user.get('rating_count', 0)})")}
    else:
        return {"type": "Unbekannt", "entries": []}


# ═══ GLOBAL SEARCH ═══
@router.get("/search")
async def global_search(q: str = "", limit: int = 10):
    if not q or len(q) < 2:
        return {"results": []}
    
    regex = {"$regex": q, "$options": "i"}
    results = []
    
    # Restaurants
    restaurants = await db.food_restaurants.find({"name": regex, "status": "approved"}, {"_id": 0, "restaurant_id": 1, "name": 1, "category": 1}).limit(3).to_list(3)
    for restaurant in restaurants:
        results.append({"type": "restaurant", "icon": "🍕", "title": restaurant["name"], "subtitle": restaurant.get("category", ""), "route": "/food"})
    
    # Reselling
    listings = await db.resell_listings.find({"title": regex, "status": "active"}, {"_id": 0, "listing_id": 1, "title": 1, "price": 1}).limit(3).to_list(3)
    for listing in listings:
        results.append({"type": "listing", "icon": "🏷️", "title": listing["title"], "subtitle": f"€{listing['price']:.2f}", "route": "/reselling"})
    
    # BlitzJobs
    jobs = await db.blitz_jobs.find({"title": regex, "status": "open"}, {"_id": 0, "job_id": 1, "title": 1, "budget": 1}).limit(3).to_list(3)
    for j in jobs:
        results.append({"type": "job", "icon": "💼", "title": j["title"], "subtitle": f"€{j['budget']}", "route": "/blitzjobs"})
    
    # BlitzLearn
    offers = await db.blitzlearn_offers.find({"title": regex, "status": "active"}, {"_id": 0, "offer_id": 1, "title": 1, "price_per_hour": 1}).limit(3).to_list(3)
    for o in offers:
        results.append({"type": "learn", "icon": "📚", "title": o["title"], "subtitle": f"€{o['price_per_hour']}/h", "route": "/blitzlearn"})
    
    # Cashback Shops
    from routes.cashback import PARTNER_SHOPS
    shop_results = [s for s in PARTNER_SHOPS if q.lower() in s["name"].lower()][:3]
    for s in shop_results:
        results.append({"type": "cashback", "icon": "💰", "title": s["name"], "subtitle": f"{s['cashback_pct']}% Cashback", "route": "/cashback"})
    
    return {"results": results[:limit], "query": q}


# ═══ ABO CALCULATOR ═══
@router.get("/abo-calculator")
async def abo_calculator(request: Request):
    user = await get_current_user(request)
    email = user.get("email", "")
    
    # Calculate monthly savings with Premium
    resell_tx = await db.resell_transactions.count_documents({"seller_email": email})
    cashback_claims = await db.cashback_claims.count_documents({"user_email": email})
    cashout_count = await db.cashouts.count_documents({"user_email": email})
    
    # Estimate savings
    p2p_savings = resell_tx * 0.50  # No P2P fees
    cashback_boost = cashback_claims * 1.20  # Higher cashback rate
    cashout_savings = cashout_count * 0.99  # Free instant cashout
    scooter_savings = 3.80  # Free minutes
    total_savings = p2p_savings + cashback_boost + cashout_savings + scooter_savings
    
    return {
        "current_plan": user.get("premium_plan"),
        "estimated_monthly_savings": round(total_savings, 2),
        "breakdown": {
            "p2p_fees_saved": round(p2p_savings, 2),
            "cashback_bonus": round(cashback_boost, 2),
            "cashout_fees_saved": round(cashout_savings, 2),
            "scooter_minutes": round(scooter_savings, 2),
        },
        "recommendation": "Pro" if total_savings > 9.99 else "Basic" if total_savings > 4.99 else "Kein Abo nötig",
        "plans": [
            {"id": "basic", "price": 4.99, "worth_it": total_savings > 4.99},
            {"id": "pro", "price": 9.99, "worth_it": total_savings > 9.99},
            {"id": "elite", "price": 14.99, "worth_it": total_savings > 14.99},
        ],
    }
