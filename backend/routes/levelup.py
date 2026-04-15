"""
BidBlitz V2 - Level Up Subscription (Tiered Rewards)
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from datetime import datetime, timezone
from core.database import db
from core.security import get_current_user
import secrets

router = APIRouter(prefix="/api/levelup", tags=["levelup"])

TIERS = [
    {"id": "starter", "name": "Starter", "price": 0, "cashback": 1, "earn_bonus": 0, "features": ["Basis-Trading", "1% Cashback", "Standard Support"], "color": "#6B7280"},
    {"id": "silver", "name": "Silver", "price": 4.99, "cashback": 2, "earn_bonus": 0.5, "features": ["2% Cashback", "+0.5% Earn Bonus", "Prioritaet-Support", "Keine Trading-Gebuehren bis 500 EUR/Mo"], "color": "#94A3B8"},
    {"id": "gold", "name": "Gold", "price": 9.99, "cashback": 3, "earn_bonus": 1.0, "features": ["3% Cashback", "+1% Earn Bonus", "VIP Support", "Keine Trading-Gebuehren bis 2.000 EUR/Mo", "Exklusive Airdrops"], "color": "#F59E0B"},
    {"id": "platinum", "name": "Platinum", "price": 19.99, "cashback": 5, "earn_bonus": 2.0, "features": ["5% Cashback", "+2% Earn Bonus", "Persoenlicher Berater", "Unbegrenzt kostenlos traden", "Priority Airdrops", "Lounge-Zugang Events"], "color": "#8B5CF6"},
    {"id": "obsidian", "name": "Obsidian", "price": 49.99, "cashback": 8, "earn_bonus": 3.0, "features": ["8% Cashback", "+3% Earn Bonus", "Dedizierter Account Manager", "Private Events", "Metal-Karte", "Airport Lounge weltweit"], "color": "#0F0F0F"},
]


class SubscribeTier(BaseModel):
    tier_id: str


@router.get("/tiers")
async def get_tiers():
    return {"tiers": TIERS}


@router.get("/my-tier")
async def get_my_tier(request: Request):
    user = await get_current_user(request)
    sub = await db.levelup_subscriptions.find_one(
        {"user_email": user.get("email", ""), "status": "active"}, {"_id": 0}
    )
    if not sub:
        return {"tier": TIERS[0], "subscribed": False}
    tier = next((t for t in TIERS if t["id"] == sub.get("tier_id")), TIERS[0])
    return {"tier": tier, "subscribed": True, "since": sub.get("created_at")}


@router.post("/subscribe")
async def subscribe(req: SubscribeTier, request: Request):
    user = await get_current_user(request)
    tier = next((t for t in TIERS if t["id"] == req.tier_id), None)
    if not tier:
        raise HTTPException(404, "Tier nicht gefunden")
    await db.levelup_subscriptions.update_many(
        {"user_email": user.get("email", ""), "status": "active"},
        {"$set": {"status": "cancelled"}}
    )
    sub = {
        "sub_id": f"lvl_{secrets.token_hex(6)}",
        "user_email": user.get("email", ""),
        "tier_id": req.tier_id,
        "tier_name": tier["name"],
        "price": tier["price"],
        "status": "active",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.levelup_subscriptions.insert_one(sub)
    return {"ok": True, "tier": tier, "message": f"{tier['name']} Abo aktiviert!"}
