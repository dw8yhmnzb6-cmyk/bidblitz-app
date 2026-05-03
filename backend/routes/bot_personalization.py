"""
BidBlitz — Bot Personalization
==============================
Users can name their personal bot, subscribe to its activity, and get
notified when "their" bot enters / leads / wins an auction.

Endpoints:
  POST /api/bots/me/setup        — name your personal bot (one-time or rename)
  GET  /api/bots/me              — my bot profile
  GET  /api/bots/active-auctions — auctions where bot personas are active
  POST /api/bots/follow/{name}   — follow another user's bot

Collection: bot_profiles
  user_id (unique), bot_name, bot_color, total_wins, total_bids, created_at
"""
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from core.database import db
from core.security import get_current_user

router = APIRouter(prefix="/api/bots", tags=["bot-personalization"])


class BotSetupRequest(BaseModel):
    bot_name: str = Field(..., min_length=3, max_length=20, pattern=r"^[a-zA-Z0-9_-]+$")
    bot_color: str = Field("#A855F7", pattern=r"^#[0-9A-Fa-f]{6}$")


@router.post("/me/setup")
async def setup_bot(req: BotSetupRequest, request: Request):
    user = await get_current_user(request)
    user_id = str(user["_id"])
    now = datetime.now(timezone.utc).isoformat()

    # Uniqueness: bot_name must be globally unique (case-insensitive)
    existing = await db.bot_profiles.find_one({"bot_name_lower": req.bot_name.lower()}, {"_id": 0, "user_id": 1})
    if existing and existing.get("user_id") != user_id:
        raise HTTPException(status_code=409, detail="Bot-Name bereits vergeben")

    await db.bot_profiles.update_one(
        {"user_id": user_id},
        {"$set": {
            "user_id": user_id,
            "bot_name": req.bot_name,
            "bot_name_lower": req.bot_name.lower(),
            "bot_color": req.bot_color,
            "updated_at": now,
        }, "$setOnInsert": {
            "total_wins": 0,
            "total_bids": 0,
            "followers": 0,
            "created_at": now,
        }},
        upsert=True,
    )
    profile = await db.bot_profiles.find_one({"user_id": user_id}, {"_id": 0})
    return {"ok": True, "bot": profile}


@router.get("/me")
async def my_bot(request: Request):
    user = await get_current_user(request)
    user_id = str(user["_id"])
    profile = await db.bot_profiles.find_one({"user_id": user_id}, {"_id": 0})
    if not profile:
        return {"bot": None, "needs_setup": True}
    # Recent bot activity
    activity = await db.transactions.find(
        {"type": "bot_bid", "metadata.bot_user_id": user_id},
        {"_id": 0}
    ).sort("created_at", -1).limit(10).to_list(10)
    return {"bot": profile, "needs_setup": False, "recent_activity": activity}


@router.get("/active-auctions")
async def bot_active_auctions(request: Request):
    """
    Auctions where any bot persona is currently active.
    Useful for the spectator UX: 'Watch live as MaxBidder99 fights GoldHunter42'.
    """
    auctions = await db.auctions.find(
        {"status": "active", "bot_only": True},
        {"_id": 0, "auction_id": 1, "title": 1, "image_url": 1, "current_price": 1,
         "ends_at": 1, "total_bids": 1, "last_bidder_name": 1}
    ).sort("total_bids", -1).limit(30).to_list(30)
    return {"auctions": auctions, "count": len(auctions)}


@router.post("/follow/{bot_name}")
async def follow_bot(bot_name: str, request: Request):
    user = await get_current_user(request)
    user_id = str(user["_id"])
    target = await db.bot_profiles.find_one({"bot_name_lower": bot_name.lower()}, {"_id": 0, "user_id": 1, "bot_name": 1})
    if not target:
        raise HTTPException(status_code=404, detail="Bot nicht gefunden")

    # Toggle follow
    existing = await db.bot_followers.find_one({"follower_id": user_id, "target_user_id": target["user_id"]})
    if existing:
        await db.bot_followers.delete_one({"_id": existing["_id"]})
        await db.bot_profiles.update_one({"user_id": target["user_id"]}, {"$inc": {"followers": -1}})
        return {"ok": True, "following": False}
    await db.bot_followers.insert_one({
        "follower_id": user_id,
        "target_user_id": target["user_id"],
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    await db.bot_profiles.update_one({"user_id": target["user_id"]}, {"$inc": {"followers": 1}})
    return {"ok": True, "following": True, "bot_name": target["bot_name"]}
