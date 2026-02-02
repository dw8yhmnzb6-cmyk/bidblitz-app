"""Free Auction System - Gratis-Gutscheine with limits"""
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone, timedelta
from typing import Optional
from pydantic import BaseModel

from config import db, logger
from dependencies import get_current_user

router = APIRouter(prefix="/free-auctions", tags=["Free Auctions"])

# Constants
MAX_FREE_BIDS_PER_WEEK = 20
MAX_FREE_WINS = 1  # Maximum free auction wins per user (lifetime)

class FreeBidResponse(BaseModel):
    success: bool
    bids_remaining: int
    bids_used: int
    message: str

@router.get("/limits")
async def get_free_auction_limits(user: dict = Depends(get_current_user)):
    """Get user's free auction bid limits"""
    user_id = user["id"]
    
    # Calculate start of current week (Monday)
    now = datetime.now(timezone.utc)
    days_since_monday = now.weekday()
    week_start = (now - timedelta(days=days_since_monday)).replace(hour=0, minute=0, second=0, microsecond=0)
    
    # Count bids this week
    bids_this_week = await db.free_auction_bids.count_documents({
        "user_id": user_id,
        "created_at": {"$gte": week_start.isoformat()}
    })
    
    # Check if user has already won a free auction
    free_wins = await db.free_auction_wins.count_documents({"user_id": user_id})
    
    return {
        "bids_used_this_week": bids_this_week,
        "bids_remaining_this_week": max(0, MAX_FREE_BIDS_PER_WEEK - bids_this_week),
        "max_bids_per_week": MAX_FREE_BIDS_PER_WEEK,
        "free_wins": free_wins,
        "can_win_free": free_wins < MAX_FREE_WINS,
        "week_resets_at": (week_start + timedelta(days=7)).isoformat()
    }

@router.post("/bid/{auction_id}")
async def place_free_bid(auction_id: str, user: dict = Depends(get_current_user)):
    """Place a free bid on a gratis auction"""
    user_id = user["id"]
    
    # Get auction
    auction = await db.auctions.find_one({"id": auction_id}, {"_id": 0})
    if not auction:
        raise HTTPException(status_code=404, detail="Auktion nicht gefunden")
    
    # Check if it's a free auction
    if not auction.get("is_free_auction"):
        raise HTTPException(status_code=400, detail="Dies ist keine Gratis-Auktion")
    
    # Check if auction is active
    if auction.get("status") != "active":
        raise HTTPException(status_code=400, detail="Auktion ist nicht aktiv")
    
    # Check if user has already won a free auction
    free_wins = await db.free_auction_wins.count_documents({"user_id": user_id})
    if free_wins >= MAX_FREE_WINS:
        raise HTTPException(
            status_code=400, 
            detail=f"Sie haben bereits {MAX_FREE_WINS} Gratis-Auktion(en) gewonnen. Nur ein Gewinn pro Nutzer erlaubt."
        )
    
    # Calculate week start
    now = datetime.now(timezone.utc)
    days_since_monday = now.weekday()
    week_start = (now - timedelta(days=days_since_monday)).replace(hour=0, minute=0, second=0, microsecond=0)
    
    # Count bids this week
    bids_this_week = await db.free_auction_bids.count_documents({
        "user_id": user_id,
        "created_at": {"$gte": week_start.isoformat()}
    })
    
    if bids_this_week >= MAX_FREE_BIDS_PER_WEEK:
        raise HTTPException(
            status_code=400, 
            detail=f"Sie haben diese Woche bereits {MAX_FREE_BIDS_PER_WEEK} Gratis-Gebote verwendet. Versuchen Sie es nächste Woche erneut!"
        )
    
    # Record the free bid
    await db.free_auction_bids.insert_one({
        "user_id": user_id,
        "auction_id": auction_id,
        "created_at": now.isoformat()
    })
    
    # Update auction with new bid
    new_price = round(auction.get("current_price", 0) + auction.get("bid_increment", 0.01), 2)
    new_end_time = (datetime.fromisoformat(auction["end_time"].replace("Z", "+00:00")) + timedelta(seconds=10)).isoformat()
    
    await db.auctions.update_one(
        {"id": auction_id},
        {"$set": {
            "current_price": new_price,
            "last_bidder_id": user_id,
            "last_bidder_name": user.get("name", "Bieter"),
            "end_time": new_end_time,
            "bid_count": auction.get("bid_count", 0) + 1
        },
        "$push": {
            "bid_history": {
                "user_id": user_id,
                "user_name": user.get("name", "Bieter"),
                "price": new_price,
                "timestamp": now.isoformat(),
                "is_free_bid": True
            }
        }}
    )
    
    bids_remaining = MAX_FREE_BIDS_PER_WEEK - bids_this_week - 1
    
    logger.info(f"Free bid placed by {user.get('email')} on auction {auction_id}. Bids remaining: {bids_remaining}")
    
    return {
        "success": True,
        "new_price": new_price,
        "bids_remaining_this_week": bids_remaining,
        "bids_used_this_week": bids_this_week + 1,
        "message": f"Gratis-Gebot erfolgreich! Noch {bids_remaining} Gebote diese Woche übrig."
    }

@router.post("/record-win/{auction_id}")
async def record_free_win(auction_id: str, user_id: str):
    """Record a free auction win (called by auction end processor)"""
    # Record the win
    await db.free_auction_wins.insert_one({
        "user_id": user_id,
        "auction_id": auction_id,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    logger.info(f"Free auction win recorded for user {user_id} on auction {auction_id}")
    
    return {"success": True}

@router.get("/available")
async def get_available_free_auctions():
    """Get all available free auctions"""
    auctions = await db.auctions.find(
        {"is_free_auction": True, "status": "active"},
        {"_id": 0}
    ).to_list(50)
    
    # Add product info
    for auction in auctions:
        product = await db.products.find_one({"id": auction.get("product_id")}, {"_id": 0})
        if product:
            auction["product"] = product
    
    return {"auctions": auctions, "count": len(auctions)}
