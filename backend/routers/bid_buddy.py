"""Bid Buddy Router - Automatic bidding system for customers"""
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone
from pydantic import BaseModel
from typing import Optional, List
import uuid
import asyncio

from config import db, logger
from dependencies import get_current_user

router = APIRouter(prefix="/bid-buddy", tags=["Bid Buddy"])

# ==================== SCHEMAS ====================

class BidBuddyCreate(BaseModel):
    auction_id: str
    max_bids: int  # Maximum number of bids to place
    max_price: Optional[float] = None  # Stop when price reaches this
    strategy: str = "aggressive"  # aggressive, balanced, conservative
    bid_on_outbid: bool = True  # Auto-bid when outbid
    min_seconds_before_end: int = 5  # Only bid when timer is below this

class BidBuddyUpdate(BaseModel):
    max_bids: Optional[int] = None
    max_price: Optional[float] = None
    is_active: Optional[bool] = None
    strategy: Optional[str] = None
    bid_on_outbid: Optional[bool] = None
    min_seconds_before_end: Optional[int] = None

# Bid Buddy Strategies
BID_STRATEGIES = {
    "aggressive": {
        "name": "Aggressiv",
        "description": "Bietet sofort nach dem Überboten werden",
        "delay_seconds": (0.5, 1.5),
        "priority": 1
    },
    "balanced": {
        "name": "Ausgewogen", 
        "description": "Bietet mit kurzem Delay nach dem Überboten werden",
        "delay_seconds": (1.5, 3.0),
        "priority": 2
    },
    "conservative": {
        "name": "Konservativ",
        "description": "Wartet bis kurz vor Ende und bietet dann",
        "delay_seconds": (3.0, 6.0),
        "priority": 3
    },
    "sniper": {
        "name": "Sniper",
        "description": "Bietet nur in den letzten 3 Sekunden",
        "delay_seconds": (0.1, 0.5),
        "priority": 0,
        "min_seconds": 3
    }
}

# ==================== ENDPOINTS ====================

@router.post("/activate")
async def activate_bid_buddy(data: BidBuddyCreate, user: dict = Depends(get_current_user)):
    """Activate Bid Buddy for an auction"""
    user_id = user["id"]
    
    # Check if user has enough bids
    user_data = await db.users.find_one({"id": user_id})
    if not user_data:
        raise HTTPException(status_code=404, detail="User nicht gefunden")
    
    available_bids = user_data.get("bids", 0)
    if available_bids < data.max_bids:
        raise HTTPException(status_code=400, detail=f"Nicht genug Gebote. Verfügbar: {available_bids}")
    
    # Check if auction exists and is active
    auction = await db.auctions.find_one({"id": data.auction_id, "status": "active"})
    if not auction:
        raise HTTPException(status_code=404, detail="Auktion nicht gefunden oder nicht aktiv")
    
    # Check if already has a bid buddy for this auction
    existing = await db.bid_buddies.find_one({
        "user_id": user_id,
        "auction_id": data.auction_id,
        "is_active": True
    })
    
    if existing:
        # Update existing
        await db.bid_buddies.update_one(
            {"id": existing["id"]},
            {"$set": {
                "max_bids": data.max_bids,
                "max_price": data.max_price,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        return {"success": True, "message": "Bid Buddy aktualisiert", "bid_buddy_id": existing["id"]}
    
    # Create new bid buddy
    strategy_info = BID_STRATEGIES.get(data.strategy, BID_STRATEGIES["aggressive"])
    
    bid_buddy = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "user_name": user_data.get("username", user_data.get("email", "User")),
        "auction_id": data.auction_id,
        "auction_name": auction.get("product_name", "Auktion"),
        "max_bids": data.max_bids,
        "max_price": data.max_price,
        "bids_placed": 0,
        "is_active": True,
        "strategy": data.strategy,
        "strategy_name": strategy_info["name"],
        "bid_on_outbid": data.bid_on_outbid,
        "min_seconds_before_end": data.min_seconds_before_end,
        "wins": 0,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.bid_buddies.insert_one(bid_buddy)
    
    logger.info(f"Bid Buddy activated: {user_data.get('username')} for auction {data.auction_id} with {data.max_bids} max bids")
    
    return {
        "success": True,
        "message": f"Bid Buddy aktiviert! Max {data.max_bids} Gebote",
        "bid_buddy_id": bid_buddy["id"],
        "bid_buddy": {
            "id": bid_buddy["id"],
            "auction_id": data.auction_id,
            "auction_name": bid_buddy["auction_name"],
            "max_bids": data.max_bids,
            "max_price": data.max_price,
            "bids_placed": 0,
            "is_active": True
        }
    }

@router.delete("/deactivate/{auction_id}")
async def deactivate_bid_buddy(auction_id: str, user: dict = Depends(get_current_user)):
    """Deactivate Bid Buddy for an auction"""
    result = await db.bid_buddies.update_one(
        {"user_id": user["id"], "auction_id": auction_id, "is_active": True},
        {"$set": {"is_active": False, "deactivated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Kein aktiver Bid Buddy gefunden")
    
    return {"success": True, "message": "Bid Buddy deaktiviert"}

@router.get("/my-buddies")
async def get_my_bid_buddies(user: dict = Depends(get_current_user)):
    """Get all active bid buddies for the user"""
    buddies = await db.bid_buddies.find(
        {"user_id": user["id"], "is_active": True},
        {"_id": 0}
    ).to_list(50)
    
    # Enrich with current auction status
    for buddy in buddies:
        auction = await db.auctions.find_one(
            {"id": buddy["auction_id"]},
            {"_id": 0, "current_price": 1, "status": 1, "end_time": 1, "product_name": 1, "product_image": 1}
        )
        if auction:
            buddy["auction"] = auction
            buddy["remaining_bids"] = buddy["max_bids"] - buddy["bids_placed"]
    
    return {"bid_buddies": buddies}

@router.get("/status/{auction_id}")
async def get_bid_buddy_status(auction_id: str, user: dict = Depends(get_current_user)):
    """Get bid buddy status for a specific auction"""
    buddy = await db.bid_buddies.find_one(
        {"user_id": user["id"], "auction_id": auction_id, "is_active": True},
        {"_id": 0}
    )
    
    if not buddy:
        return {"active": False, "bid_buddy": None}
    
    return {
        "active": True,
        "bid_buddy": buddy,
        "remaining_bids": buddy["max_bids"] - buddy["bids_placed"]
    }

# ==================== INTERNAL FUNCTION (called by auction system) ====================

async def process_bid_buddies(auction_id: str, current_price: float, last_bidder_id: str):
    """Process all bid buddies for an auction (called after each bid)"""
    # Get all active bid buddies for this auction (except the last bidder)
    buddies = await db.bid_buddies.find({
        "auction_id": auction_id,
        "is_active": True,
        "user_id": {"$ne": last_bidder_id}
    }).to_list(100)
    
    for buddy in buddies:
        # Check if buddy should bid
        should_bid = True
        
        # Check max price
        if buddy.get("max_price") and current_price >= buddy["max_price"]:
            should_bid = False
            # Deactivate buddy
            await db.bid_buddies.update_one(
                {"id": buddy["id"]},
                {"$set": {"is_active": False, "stop_reason": "max_price_reached"}}
            )
        
        # Check remaining bids
        if buddy["bids_placed"] >= buddy["max_bids"]:
            should_bid = False
            await db.bid_buddies.update_one(
                {"id": buddy["id"]},
                {"$set": {"is_active": False, "stop_reason": "max_bids_reached"}}
            )
        
        # Check if user has bids
        user = await db.users.find_one({"id": buddy["user_id"]})
        if not user or user.get("bids", 0) <= 0:
            should_bid = False
            await db.bid_buddies.update_one(
                {"id": buddy["id"]},
                {"$set": {"is_active": False, "stop_reason": "no_bids_left"}}
            )
        
        if should_bid:
            # Place a bid for this buddy (with small delay to seem natural)
            await asyncio.sleep(0.5 + (hash(buddy["id"]) % 20) / 10)  # 0.5-2.5 second delay
            
            # The actual bid placement would be handled by the auction system
            # This just returns the buddy that should bid
            return buddy
    
    return None


bid_buddy_router = router
