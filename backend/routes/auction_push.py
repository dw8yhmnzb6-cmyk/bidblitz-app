"""
BidBlitz - Auction Push Notifications & Filters
Erweiterte Push-Benachrichtigungen für Auktions-Events + Filter-System
"""
import asyncio
from datetime import datetime, timezone, timedelta
from typing import Optional, List
from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel
from core.database import db
from core.security import get_current_user

router = APIRouter(prefix="/api/auctions", tags=["auction-push"])


class AuctionFilterRequest(BaseModel):
    category: Optional[str] = None
    min_price: Optional[float] = None
    max_price: Optional[float] = None
    status: Optional[str] = "active"  # active, upcoming, ended
    sort_by: str = "ending_soon"  # ending_soon, newest, price_low, price_high, popular


class WatchlistRequest(BaseModel):
    auction_id: str


class NotificationPreferences(BaseModel):
    outbid: bool = True
    won: bool = True
    ending_soon: bool = True  # 5 minutes before end
    price_drop: bool = False  # wenn Preis unter bestimmten Schwellenwert fällt


@router.post("/watchlist/add")
async def add_to_watchlist(req: WatchlistRequest, request: Request):
    """Füge Auktion zur Watchlist hinzu."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    # Check if auction exists
    auction = await db.auctions.find_one({"auction_id": req.auction_id}, {"_id": 0})
    if not auction:
        raise HTTPException(status_code=404, detail="Auction not found")
    
    # Add to watchlist (avoid duplicates)
    await db.auction_watchlist.update_one(
        {"user_id": user_id, "auction_id": req.auction_id},
        {"$set": {
            "user_id": user_id,
            "auction_id": req.auction_id,
            "auction_title": auction.get("title", ""),
            "added_at": datetime.now(timezone.utc).isoformat(),
        }},
        upsert=True,
    )
    
    return {"ok": True, "message": "Zur Watchlist hinzugefügt"}


@router.delete("/watchlist/remove")
async def remove_from_watchlist(req: WatchlistRequest, request: Request):
    """Entferne Auktion von der Watchlist."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    result = await db.auction_watchlist.delete_one({
        "user_id": user_id,
        "auction_id": req.auction_id,
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Not in watchlist")
    
    return {"ok": True, "message": "Von Watchlist entfernt"}


@router.get("/watchlist")
async def get_watchlist(request: Request):
    """Liste alle Auktionen auf der Watchlist."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    watchlist = await db.auction_watchlist.find(
        {"user_id": user_id},
        {"_id": 0}
    ).sort("added_at", -1).to_list(100)
    
    # Enrich with current auction data
    auction_ids = [w["auction_id"] for w in watchlist]
    auctions = await db.auctions.find(
        {"auction_id": {"$in": auction_ids}},
        {"_id": 0}
    ).to_list(100)
    
    auction_map = {a["auction_id"]: a for a in auctions}
    
    for w in watchlist:
        w["auction"] = auction_map.get(w["auction_id"])
    
    return {"watchlist": watchlist, "total": len(watchlist)}


@router.post("/notifications/preferences")
async def set_notification_preferences(prefs: NotificationPreferences, request: Request):
    """Setze Benachrichtigungs-Einstellungen für Auktionen."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    await db.auction_notification_prefs.update_one(
        {"user_id": user_id},
        {"$set": {
            "user_id": user_id,
            "outbid": prefs.outbid,
            "won": prefs.won,
            "ending_soon": prefs.ending_soon,
            "price_drop": prefs.price_drop,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }},
        upsert=True,
    )
    
    return {"ok": True, "message": "Einstellungen gespeichert"}


@router.get("/notifications/preferences")
async def get_notification_preferences(request: Request):
    """Hole Benachrichtigungs-Einstellungen."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    prefs = await db.auction_notification_prefs.find_one(
        {"user_id": user_id},
        {"_id": 0}
    )
    
    if not prefs:
        # Default preferences
        prefs = {
            "user_id": user_id,
            "outbid": True,
            "won": True,
            "ending_soon": True,
            "price_drop": False,
        }
    
    return {"preferences": prefs}


@router.post("/filter")
async def filter_auctions(filters: AuctionFilterRequest, request: Request):
    """Erweiterte Filter für Auktionen."""
    query = {}
    
    # Status filter
    if filters.status:
        query["status"] = filters.status
    
    # Category filter
    if filters.category:
        query["category"] = filters.category
    
    # Price range filter
    if filters.min_price is not None or filters.max_price is not None:
        query["current_price"] = {}
        if filters.min_price is not None:
            query["current_price"]["$gte"] = filters.min_price
        if filters.max_price is not None:
            query["current_price"]["$lte"] = filters.max_price
    
    # Sort logic
    sort_field = "created_at"
    sort_order = -1
    
    if filters.sort_by == "ending_soon":
        sort_field = "ends_at"
        sort_order = 1
    elif filters.sort_by == "newest":
        sort_field = "created_at"
        sort_order = -1
    elif filters.sort_by == "price_low":
        sort_field = "current_price"
        sort_order = 1
    elif filters.sort_by == "price_high":
        sort_field = "current_price"
        sort_order = -1
    elif filters.sort_by == "popular":
        sort_field = "total_bids"
        sort_order = -1
    
    auctions = await db.auctions.find(query, {"_id": 0}).sort(sort_field, sort_order).to_list(100)
    
    # Calculate remaining time for each auction
    now = datetime.now(timezone.utc)
    for a in auctions:
        if a.get("status") == "active" and a.get("ends_at"):
            try:
                ends = datetime.fromisoformat(a["ends_at"])
                remaining = (ends - now).total_seconds()
                a["remaining_seconds"] = max(0, remaining)
                a["final_battle"] = 0 < remaining <= 60
            except Exception:
                a["remaining_seconds"] = 0
                a["final_battle"] = False
    
    return {"auctions": auctions, "total": len(auctions), "filters_applied": filters.dict()}


# Background job: Check for ending-soon auctions and send notifications
async def check_ending_soon_notifications():
    """Läuft alle 30 Sekunden und prüft Auktionen, die in 5 Minuten enden."""
    while True:
        try:
            now = datetime.now(timezone.utc)
            five_min_later = now + timedelta(minutes=5)
            
            # Find auctions ending in next 5 minutes
            auctions = await db.auctions.find({
                "status": "active",
                "ends_at": {
                    "$gte": now.isoformat(),
                    "$lte": five_min_later.isoformat(),
                }
            }, {"_id": 0}).to_list(100)
            
            for auction in auctions:
                # Check if we already sent notification for this auction
                notif_exists = await db.auction_notifications.find_one({
                    "auction_id": auction["auction_id"],
                    "type": "ending_soon",
                })
                
                if notif_exists:
                    continue
                
                # Find all users watching this auction
                watchers = await db.auction_watchlist.find({
                    "auction_id": auction["auction_id"]
                }).to_list(100)
                
                # Find users who bid on this auction
                bidders = await db.auction_bids.find({
                    "auction_id": auction["auction_id"]
                }).to_list(1000)
                
                # Get unique user IDs
                user_ids = set()
                for w in watchers:
                    user_ids.add(w["user_id"])
                for b in bidders:
                    user_ids.add(b["user_id"])
                
                # Send notification to each user
                for user_id in user_ids:
                    # Check user preferences
                    prefs = await db.auction_notification_prefs.find_one({"user_id": user_id})
                    if prefs and not prefs.get("ending_soon", True):
                        continue
                    
                    # Create notification
                    await db.auction_notifications.insert_one({
                        "user_id": user_id,
                        "type": "ending_soon",
                        "auction_id": auction["auction_id"],
                        "message": f"⏰ {auction['title']} endet in 5 Minuten!",
                        "read": False,
                        "created_at": now.isoformat(),
                    })
                    
                    # Send web push notification
                    try:
                        from routes.web_push import send_push_to_user
                        asyncio.create_task(send_push_to_user(
                            user_id=user_id,
                            title="⏰ Auktion endet bald!",
                            body=f"{auction['title']} endet in 5 Minuten. Aktueller Preis: €{auction.get('current_price', 0):.2f}",
                            icon="/logo192.png",
                            data={"url": f"/auction/{auction['auction_id']}", "type": "ending_soon"},
                        ))
                    except Exception as e:
                        print(f"Push notification error: {e}")
            
            await asyncio.sleep(30)  # Check every 30 seconds
        except Exception as e:
            print(f"Ending soon check error: {e}")
            await asyncio.sleep(30)


@router.on_event("startup")
async def start_background_tasks():
    """Start background notification checker."""
    asyncio.create_task(check_ending_soon_notifications())
