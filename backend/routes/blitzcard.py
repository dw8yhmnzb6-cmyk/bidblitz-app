"""
BidBlitz V2 - BlitzCard (Visa/Debit Card with Crypto Cashback)
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from datetime import datetime, timezone
from core.database import db
from core.security import get_current_user
import secrets, random

router = APIRouter(prefix="/api/blitzcard", tags=["blitzcard"])

CARD_TIERS = [
    {"id": "midnight", "name": "Midnight Blue", "cashback": 1, "fee": 0, "limit_monthly": 2000, "perks": ["1% CRO Cashback", "Spotify gratis"], "color": "#1E3A5F", "gradient": "linear-gradient(135deg, #0F2027, #203A43, #2C5364)"},
    {"id": "ruby", "name": "Ruby Steel", "cashback": 2, "fee": 0, "limit_monthly": 5000, "perks": ["2% CRO Cashback", "Spotify + Netflix gratis", "Airport Lounge 2x/Jahr"], "color": "#C41E3A", "gradient": "linear-gradient(135deg, #8B0000, #C41E3A, #FF4444)"},
    {"id": "jade", "name": "Royal Indigo", "cashback": 3, "fee": 4.99, "limit_monthly": 15000, "perks": ["3% CRO Cashback", "Alle Streaming gratis", "Airport Lounge 4x/Jahr", "Priority Support"], "color": "#4B0082", "gradient": "linear-gradient(135deg, #1a0533, #4B0082, #6A0DAD)"},
    {"id": "icy", "name": "Icy White", "cashback": 5, "fee": 9.99, "limit_monthly": 50000, "perks": ["5% CRO Cashback", "Alle Perks inklusive", "Unlimited Airport Lounge", "Concierge Service", "Metal-Karte"], "color": "#B8D4E3", "gradient": "linear-gradient(135deg, #E8F4FD, #B8D4E3, #86B3D1)"},
    {"id": "obsidian", "name": "Obsidian", "cashback": 8, "fee": 49.99, "limit_monthly": 999999, "perks": ["8% CRO Cashback", "Private Banking", "Dedizierter Manager", "Unlimited alles", "Exklusive Events"], "color": "#0F0F0F", "gradient": "linear-gradient(135deg, #0a0a0a, #1a1a1a, #333333)"},
]


class OrderCard(BaseModel):
    card_tier: str
    shipping_address: str = ""


@router.get("/tiers")
async def get_card_tiers():
    return {"tiers": CARD_TIERS}


@router.get("/my-card")
async def get_my_card(request: Request):
    user = await get_current_user(request)
    card = await db.blitz_cards.find_one(
        {"user_email": user.get("email", ""), "status": "active"}, {"_id": 0}
    )
    if not card:
        return {"has_card": False}
    return {"has_card": True, "card": card}


@router.post("/order")
async def order_card(req: OrderCard, request: Request):
    user = await get_current_user(request)
    tier = next((t for t in CARD_TIERS if t["id"] == req.card_tier), None)
    if not tier:
        raise HTTPException(404, "Karten-Tier nicht gefunden")
    await db.blitz_cards.update_many(
        {"user_email": user.get("email", ""), "status": "active"},
        {"$set": {"status": "replaced"}}
    )
    num = f"{random.randint(4000,4999)} {random.randint(1000,9999)} {random.randint(1000,9999)} {random.randint(1000,9999)}"
    card = {
        "card_id": f"card_{secrets.token_hex(6)}",
        "user_email": user.get("email", ""),
        "tier_id": req.card_tier,
        "tier_name": tier["name"],
        "card_number": num,
        "cashback": tier["cashback"],
        "limit_monthly": tier["limit_monthly"],
        "spent_this_month": 0,
        "cashback_earned": 0,
        "gradient": tier["gradient"],
        "status": "active",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.blitz_cards.insert_one(card)
    return {"ok": True, "card_id": card["card_id"], "card_number": num,
            "message": f"{tier['name']} Karte bestellt! {tier['cashback']}% Cashback aktiv."}


@router.get("/transactions")
async def card_transactions(request: Request):
    user = await get_current_user(request)
    txs = await db.blitz_card_transactions.find(
        {"user_email": user.get("email", "")}, {"_id": 0}
    ).sort("created_at", -1).to_list(30)
    return {"transactions": txs}
