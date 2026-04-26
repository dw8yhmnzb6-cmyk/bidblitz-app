"""
BidBlitz V2 — User Watchlist (Auktionen merken)
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from datetime import datetime, timezone

from core.database import db
from core.security import get_current_user

router = APIRouter(prefix="/api/watchlist", tags=["watchlist"])


class WatchlistAdd(BaseModel):
    auction_id: str


@router.get("")
async def get_watchlist(request: Request):
    user = await get_current_user(request)
    uid = str(user.get("_id") or user.get("id"))
    items = await db.watchlist.find({"user_id": uid}, {"_id": 0}).sort("created_at", -1).to_list(100)

    # Fetch fresh auction data for each watched item
    enriched = []
    for w in items:
        auction = await db.auctions.find_one(
            {"auction_id": w["auction_id"]},
            {"_id": 0, "auction_id": 1, "title": 1, "image_url": 1,
             "current_price": 1, "ends_at": 1, "status": 1, "total_bids": 1,
             "viewer_count": 1, "translations": 1, "retail_price": 1, "category": 1},
        )
        if auction:
            enriched.append({**auction, "watched_at": w["created_at"]})
    return {"items": enriched, "count": len(enriched)}


@router.get("/ids")
async def get_watchlist_ids(request: Request):
    """Lightweight: returns just auction_ids the user is watching."""
    user = await get_current_user(request)
    uid = str(user.get("_id") or user.get("id"))
    items = await db.watchlist.find({"user_id": uid}, {"_id": 0, "auction_id": 1}).to_list(500)
    return {"ids": [w["auction_id"] for w in items]}


@router.post("/add")
async def add_watchlist(req: WatchlistAdd, request: Request):
    user = await get_current_user(request)
    uid = str(user.get("_id") or user.get("id"))

    # Verify auction exists
    auction = await db.auctions.find_one({"auction_id": req.auction_id}, {"_id": 0, "auction_id": 1})
    if not auction:
        raise HTTPException(404, "Auktion nicht gefunden")

    now = datetime.now(timezone.utc).isoformat()
    await db.watchlist.update_one(
        {"user_id": uid, "auction_id": req.auction_id},
        {"$set": {"user_id": uid, "auction_id": req.auction_id, "created_at": now}},
        upsert=True,
    )
    return {"ok": True, "watching": True}


@router.delete("/{auction_id}")
async def remove_watchlist(auction_id: str, request: Request):
    user = await get_current_user(request)
    uid = str(user.get("_id") or user.get("id"))
    await db.watchlist.delete_one({"user_id": uid, "auction_id": auction_id})
    return {"ok": True, "watching": False}


@router.post("/toggle/{auction_id}")
async def toggle_watchlist(auction_id: str, request: Request):
    """Convenience: toggle on/off in one call."""
    user = await get_current_user(request)
    uid = str(user.get("_id") or user.get("id"))

    existing = await db.watchlist.find_one({"user_id": uid, "auction_id": auction_id}, {"_id": 1})
    if existing:
        await db.watchlist.delete_one({"user_id": uid, "auction_id": auction_id})
        return {"ok": True, "watching": False}

    auction = await db.auctions.find_one({"auction_id": auction_id}, {"_id": 0, "auction_id": 1})
    if not auction:
        raise HTTPException(404, "Auktion nicht gefunden")

    now = datetime.now(timezone.utc).isoformat()
    await db.watchlist.insert_one({"user_id": uid, "auction_id": auction_id, "created_at": now})
    return {"ok": True, "watching": True}
