"""Auction Watchers Router - Track how many users are watching each auction"""
from fastapi import APIRouter, HTTPException, Depends, WebSocket, WebSocketDisconnect
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, List
import uuid

from config import db, logger
from dependencies import get_current_user

router = APIRouter(prefix="/watchers", tags=["Auction Watchers"])

# In-memory watcher counts (updated via WebSocket)
auction_watchers: Dict[str, int] = {}

# ==================== ENDPOINTS ====================
# NOTE: Specific routes must come BEFORE parameterized routes to avoid conflicts

@router.get("/hot-auctions")
async def get_most_watched_auctions(limit: int = 10):
    """Get auctions with most watchers"""
    five_mins_ago = (datetime.now(timezone.utc) - timedelta(minutes=5)).isoformat()
    
    # Aggregate watcher counts
    pipeline = [
        {"$match": {"last_seen": {"$gte": five_mins_ago}}},
        {"$group": {"_id": "$auction_id", "watcher_count": {"$sum": 1}}},
        {"$sort": {"watcher_count": -1}},
        {"$limit": limit}
    ]
    
    hot = await db.auction_views.aggregate(pipeline).to_list(limit)
    
    # Get auction details
    results = []
    for h in hot:
        auction = await db.auctions.find_one(
            {"id": h["_id"], "status": "active"},
            {"_id": 0}
        )
        if auction:
            auction["watchers"] = h["watcher_count"]
            results.append(auction)
    
    return {"hot_auctions": results}

@router.get("/stats")
async def get_watcher_stats():
    """Get overall watcher statistics"""
    five_mins_ago = (datetime.now(timezone.utc) - timedelta(minutes=5)).isoformat()
    
    # Total active viewers
    total_viewers = await db.auction_views.count_documents({
        "last_seen": {"$gte": five_mins_ago}
    })
    
    # Unique auctions being watched
    unique_auctions = await db.auction_views.distinct("auction_id", {
        "last_seen": {"$gte": five_mins_ago}
    })
    
    return {
        "total_viewers": total_viewers,
        "auctions_being_watched": len(unique_auctions),
        "average_per_auction": round(total_viewers / len(unique_auctions), 1) if unique_auctions else 0
    }

@router.get("/{auction_id}")
async def get_watcher_count(auction_id: str):
    """Get number of users currently watching an auction"""
    # Get from in-memory count
    live_count = auction_watchers.get(auction_id, 0)
    
    # Also check DB for recent activity
    five_mins_ago = (datetime.now(timezone.utc) - timedelta(minutes=5)).isoformat()
    db_count = await db.auction_views.count_documents({
        "auction_id": auction_id,
        "last_seen": {"$gte": five_mins_ago}
    })
    
    total = max(live_count, db_count)
    
    return {
        "auction_id": auction_id,
        "watchers": total,
        "live_watchers": live_count,
        "message": f"{total} Personen schauen gerade zu" if total > 0 else "Sei der Erste!"
    }

@router.post("/{auction_id}/view")
async def record_auction_view(
    auction_id: str, 
    user: Optional[dict] = Depends(get_current_user)
):
    """Record that a user is viewing an auction"""
    now = datetime.now(timezone.utc)
    user_id = user["id"] if user else f"anon_{uuid.uuid4().hex[:8]}"
    
    # Upsert view record
    await db.auction_views.update_one(
        {"auction_id": auction_id, "user_id": user_id},
        {
            "$set": {
                "last_seen": now.isoformat(),
                "updated_at": now.isoformat()
            },
            "$setOnInsert": {
                "id": str(uuid.uuid4()),
                "auction_id": auction_id,
                "user_id": user_id,
                "created_at": now.isoformat()
            }
        },
        upsert=True
    )
    
    # Update in-memory count
    if auction_id not in auction_watchers:
        auction_watchers[auction_id] = 0
    auction_watchers[auction_id] += 1
    
    # Get current count
    count = await get_watcher_count(auction_id)
    
    return count

@router.delete("/{auction_id}/leave")
async def leave_auction_view(auction_id: str, user: dict = Depends(get_current_user)):
    """Record that user left the auction view"""
    await db.auction_views.delete_one({
        "auction_id": auction_id,
        "user_id": user["id"]
    })
    
    # Update in-memory count
    if auction_id in auction_watchers:
        auction_watchers[auction_id] = max(0, auction_watchers[auction_id] - 1)
    
    return {"success": True}


watchers_router = router
