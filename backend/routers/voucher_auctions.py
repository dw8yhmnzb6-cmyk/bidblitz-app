"""Voucher Auction System - Gutschein-Auktionen with paid bids but free prizes"""
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone, timedelta
from typing import Optional
from pydantic import BaseModel

from config import db, logger
from dependencies import get_current_user

router = APIRouter(prefix="/voucher-auctions", tags=["Voucher Auctions"])

# Constants
MAX_VOUCHER_BIDS_PER_WEEK = 20  # Max bids per week on voucher auctions
MAX_VOUCHER_WINS = 1  # Maximum voucher wins per user (lifetime) - prize is FREE

class VoucherBidLimits(BaseModel):
    bids_used_this_week: int
    bids_remaining_this_week: int
    max_bids_per_week: int
    voucher_wins: int
    can_win_voucher: bool
    week_resets_at: str

@router.get("/limits")
async def get_voucher_auction_limits(user: dict = Depends(get_current_user)):
    """Get user's voucher auction bid limits - bids cost money but prize is FREE"""
    user_id = user["id"]
    
    # Calculate start of current week (Monday)
    now = datetime.now(timezone.utc)
    days_since_monday = now.weekday()
    week_start = (now - timedelta(days=days_since_monday)).replace(hour=0, minute=0, second=0, microsecond=0)
    
    # Count bids this week on voucher auctions
    bids_this_week = await db.voucher_auction_bids.count_documents({
        "user_id": user_id,
        "created_at": {"$gte": week_start.isoformat()}
    })
    
    # Check if user has already won a voucher auction
    voucher_wins = await db.voucher_auction_wins.count_documents({"user_id": user_id})
    
    return {
        "bids_used_this_week": bids_this_week,
        "bids_remaining_this_week": max(0, MAX_VOUCHER_BIDS_PER_WEEK - bids_this_week),
        "max_bids_per_week": MAX_VOUCHER_BIDS_PER_WEEK,
        "voucher_wins": voucher_wins,
        "can_win_voucher": voucher_wins < MAX_VOUCHER_WINS,
        "week_resets_at": (week_start + timedelta(days=7)).isoformat(),
        "note": "Gebote kosten Geld, aber der Gutschein ist GRATIS wenn Sie gewinnen!"
    }

@router.post("/check-can-bid/{auction_id}")
async def check_can_bid_voucher(auction_id: str, user: dict = Depends(get_current_user)):
    """Check if user can bid on a voucher auction (has remaining weekly bids and hasn't won yet)"""
    user_id = user["id"]
    
    # Get auction
    auction = await db.auctions.find_one({"id": auction_id}, {"_id": 0})
    if not auction:
        raise HTTPException(status_code=404, detail="Auktion nicht gefunden")
    
    # Check if it's a voucher/free auction
    if not auction.get("is_free_auction"):
        return {"can_bid": True, "is_voucher_auction": False}
    
    # Check if user has already won a voucher auction
    voucher_wins = await db.voucher_auction_wins.count_documents({"user_id": user_id})
    if voucher_wins >= MAX_VOUCHER_WINS:
        return {
            "can_bid": False,
            "is_voucher_auction": True,
            "reason": f"Sie haben bereits {MAX_VOUCHER_WINS} Gratis-Gutschein gewonnen. Nur ein Gewinn pro Nutzer erlaubt.",
            "voucher_wins": voucher_wins
        }
    
    # Calculate week start
    now = datetime.now(timezone.utc)
    days_since_monday = now.weekday()
    week_start = (now - timedelta(days=days_since_monday)).replace(hour=0, minute=0, second=0, microsecond=0)
    
    # Count bids this week
    bids_this_week = await db.voucher_auction_bids.count_documents({
        "user_id": user_id,
        "created_at": {"$gte": week_start.isoformat()}
    })
    
    if bids_this_week >= MAX_VOUCHER_BIDS_PER_WEEK:
        return {
            "can_bid": False,
            "is_voucher_auction": True,
            "reason": f"Sie haben diese Woche bereits {MAX_VOUCHER_BIDS_PER_WEEK} Mal auf Gutschein-Auktionen geboten. Nächste Woche können Sie wieder bieten!",
            "bids_used": bids_this_week,
            "bids_remaining": 0
        }
    
    return {
        "can_bid": True,
        "is_voucher_auction": True,
        "bids_used": bids_this_week,
        "bids_remaining": MAX_VOUCHER_BIDS_PER_WEEK - bids_this_week,
        "note": "Gebot kostet 1 Gebot aus Ihrem Konto. Bei Gewinn ist der Gutschein GRATIS!"
    }

@router.post("/record-bid/{auction_id}")
async def record_voucher_bid(auction_id: str, user: dict = Depends(get_current_user)):
    """Record a bid on a voucher auction (called after successful paid bid)"""
    user_id = user["id"]
    
    # Record the bid for limit tracking
    await db.voucher_auction_bids.insert_one({
        "user_id": user_id,
        "auction_id": auction_id,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    logger.info(f"Voucher auction bid recorded for user {user_id} on auction {auction_id}")
    
    return {"success": True}

@router.post("/record-win/{auction_id}")
async def record_voucher_win(auction_id: str, user_id: str):
    """Record a voucher auction win (called by auction end processor)"""
    # Record the win - user gets the voucher for FREE
    await db.voucher_auction_wins.insert_one({
        "user_id": user_id,
        "auction_id": auction_id,
        "prize_status": "free",  # No payment required for the prize
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    logger.info(f"FREE voucher win recorded for user {user_id} on auction {auction_id}")
    
    return {"success": True, "message": "Herzlichen Glückwunsch! Sie haben einen GRATIS Gutschein gewonnen!"}

@router.get("/available")
async def get_available_voucher_auctions():
    """Get all available voucher auctions (free prize auctions)"""
    auctions = await db.auctions.find(
        {"is_free_auction": True, "status": "active"},
        {"_id": 0}
    ).to_list(50)
    
    # Add product info
    for auction in auctions:
        product = await db.products.find_one({"id": auction.get("product_id")}, {"_id": 0})
        if product:
            auction["product"] = product
            auction["prize_info"] = "🎁 GRATIS bei Gewinn - Gebote kosten normal"
    
    return {
        "auctions": auctions, 
        "count": len(auctions),
        "info": "Bieten Sie mit Ihren gekauften Geboten. Bei Gewinn erhalten Sie den Gutschein GRATIS!"
    }

@router.get("/active")
async def get_active_voucher_auctions():
    """Get all active voucher auctions for the homepage section"""
    # Get voucher auctions from multiple sources
    auctions = []
    
    # 1. Free prize auctions (is_free_auction=True)
    free_auctions = await db.auctions.find(
        {"is_free_auction": True, "status": "active"},
        {"_id": 0}
    ).to_list(20)
    auctions.extend(free_auctions)
    
    # 2. Restaurant voucher auctions
    restaurant_auctions = await db.auctions.find(
        {"auction_type": "restaurant_voucher", "status": "active"},
        {"_id": 0}
    ).to_list(20)
    auctions.extend(restaurant_auctions)
    
    # 3. Auctions with voucher category
    voucher_category_auctions = await db.auctions.find(
        {"category": {"$in": ["voucher", "restaurant_voucher", "partner_voucher"]}, "status": "active"},
        {"_id": 0}
    ).to_list(20)
    auctions.extend(voucher_category_auctions)
    
    # 4. Auctions marked as voucher
    is_voucher_auctions = await db.auctions.find(
        {"is_voucher": True, "status": "active"},
        {"_id": 0}
    ).to_list(20)
    auctions.extend(is_voucher_auctions)
    
    # Remove duplicates by ID
    seen_ids = set()
    unique_auctions = []
    for auction in auctions:
        if auction.get("id") not in seen_ids:
            seen_ids.add(auction.get("id"))
            unique_auctions.append(auction)
    
    # Add product info and format
    for auction in unique_auctions:
        product = await db.products.find_one({"id": auction.get("product_id")}, {"_id": 0})
        if product:
            auction["product"] = product
            auction["product_name"] = product.get("name", auction.get("product_name", "Gutschein"))
            auction["product_image"] = product.get("image_url")
            auction["voucher_value"] = product.get("retail_price", 50)
        
        # Get restaurant info if available
        if auction.get("restaurant_info"):
            auction["merchant"] = auction["restaurant_info"].get("name", "Partner")
            auction["voucher_value"] = auction["restaurant_info"].get("voucher_value", 25)
            auction["category"] = auction["restaurant_info"].get("category", "restaurant")
    
    # Sort by end_time (ending soon first)
    unique_auctions.sort(key=lambda x: x.get("end_time", "9999"))
    
    return {
        "auctions": unique_auctions[:20],
        "count": len(unique_auctions),
        "info": "Händler-Gutscheine - Ersteigere Gutscheine für Restaurants, Bars & mehr!"
    }
