"""Auctions router - All auction-related endpoints"""
from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from datetime import datetime, timezone, timedelta
from typing import List, Optional
import uuid

from config import db, logger
from dependencies import get_current_user, get_admin_user
from schemas import AuctionCreate, AuctionUpdate, AutobidderCreate
from services.websocket import broadcast_bid_update, broadcast_auction_ended

router = APIRouter(tags=["Auctions"])

# Business hours configuration (Berlin timezone = UTC+1 in winter, UTC+2 in summer)
BUSINESS_START_HOUR = 9   # 9:00 AM
BUSINESS_END_HOUR = 24    # Midnight (24:00)

def is_within_business_hours():
    """Check if current time is within business hours (9:00 - 24:00 Berlin time)"""
    now = datetime.now(timezone.utc)
    # Approximate Berlin time (UTC+1)
    berlin_hour = (now.hour + 1) % 24
    return BUSINESS_START_HOUR <= berlin_hour < BUSINESS_END_HOUR

def get_next_business_opening():
    """Get the next time auctions will open (9:00 Berlin time)"""
    now = datetime.now(timezone.utc)
    berlin_hour = (now.hour + 1) % 24
    
    if berlin_hour >= BUSINESS_END_HOUR or berlin_hour < BUSINESS_START_HOUR:
        # Outside business hours - calculate next 9:00 AM
        hours_until_opening = (BUSINESS_START_HOUR - berlin_hour) % 24
        if hours_until_opening == 0:
            hours_until_opening = 24
        next_opening = now + timedelta(hours=hours_until_opening)
        return next_opening.replace(minute=0, second=0, microsecond=0)
    return None

# ==================== PUBLIC ENDPOINTS ====================

@router.get("/auctions/business-hours")
async def get_business_hours():
    """Get business hours status"""
    is_open = is_within_business_hours()
    next_opening = get_next_business_opening() if not is_open else None
    
    return {
        "is_open": is_open,
        "business_start": f"{BUSINESS_START_HOUR:02d}:00",
        "business_end": f"{BUSINESS_END_HOUR:02d}:00",
        "next_opening": next_opening.isoformat() if next_opening else None,
        "timezone": "Europe/Berlin"
    }

@router.get("/auctions/featured")
async def get_featured_auction():
    """Get the featured/VIP auction to display prominently"""
    # First try to find a VIP-marked auction
    featured = await db.auctions.find_one(
        {"status": "active", "is_featured": True},
        {"_id": 0}
    )
    
    # If no featured auction, get the auction with highest retail price that's active
    if not featured:
        auctions = await db.auctions.find(
            {"status": "active"},
            {"_id": 0}
        ).to_list(100)
        
        if auctions:
            # Find auction with highest value product
            best = None
            best_value = 0
            
            for auction in auctions:
                product = await db.products.find_one({"id": auction.get("product_id")}, {"_id": 0})
                if product:
                    value = product.get("retail_price", 0)
                    if value > best_value:
                        best_value = value
                        best = auction
                        best["product"] = product
            
            featured = best
    
    if featured and "product" not in featured:
        product = await db.products.find_one({"id": featured.get("product_id")}, {"_id": 0})
        if product:
            featured["product"] = product
    
    return featured

@router.get("/auctions")
async def get_auctions():
    """Get all auctions with product details"""
    auctions = await db.auctions.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)
    
    # Attach product info
    for auction in auctions:
        product = await db.products.find_one({"id": auction.get("product_id")}, {"_id": 0})
        if product:
            auction["product"] = product
    
    return auctions

@router.get("/auctions/vip-only")
async def get_vip_only_auctions():
    """Get VIP-only auctions"""
    auctions = await db.auctions.find(
        {"status": "active", "is_vip_only": True},
        {"_id": 0}
    ).sort("end_time", 1).to_list(100)
    
    for auction in auctions:
        product = await db.products.find_one({"id": auction.get("product_id")}, {"_id": 0})
        if product:
            auction["product"] = product
    
    return auctions

@router.get("/auctions/active")
async def get_active_auctions():
    """Get only active auctions"""
    now = datetime.now(timezone.utc).isoformat()
    auctions = await db.auctions.find(
        {"status": "active"},
        {"_id": 0}
    ).sort("end_time", 1).to_list(100)
    
    for auction in auctions:
        product = await db.products.find_one({"id": auction.get("product_id")}, {"_id": 0})
        if product:
            auction["product"] = product
    
    return auctions

@router.get("/auctions/{auction_id}")
async def get_auction(auction_id: str):
    """Get single auction by ID with product details"""
    auction = await db.auctions.find_one({"id": auction_id}, {"_id": 0})
    if not auction:
        raise HTTPException(status_code=404, detail="Auction not found")
    
    product = await db.products.find_one({"id": auction.get("product_id")}, {"_id": 0})
    if product:
        auction["product"] = product
    
    return auction

# ==================== BIDDING ====================

@router.post("/auctions/{auction_id}/bid")
async def place_bid(auction_id: str, user: dict = Depends(get_current_user)):
    """Place a bid on an auction"""
    
    # CHECK BUSINESS HOURS - No bidding outside 9:00-24:00 Berlin time
    if not is_within_business_hours():
        next_opening = get_next_business_opening()
        raise HTTPException(
            status_code=403, 
            detail=f"Auktionen sind pausiert. Öffnungszeiten: 09:00 - 24:00 Uhr. Nächste Öffnung: {next_opening.strftime('%d.%m.%Y %H:%M') if next_opening else '09:00'} Uhr"
        )
    
    auction = await db.auctions.find_one({"id": auction_id}, {"_id": 0})
    if not auction:
        raise HTTPException(status_code=404, detail="Auction not found")
    
    if auction["status"] != "active":
        raise HTTPException(status_code=400, detail="Auction is not active")
    
    # Check if auction has ended
    end_time = datetime.fromisoformat(auction["end_time"].replace('Z', '+00:00'))
    if datetime.now(timezone.utc) > end_time:
        raise HTTPException(status_code=400, detail="Auction has ended")
    
    # Check user's bid balance
    if user["bids_balance"] < 1:
        raise HTTPException(status_code=400, detail="Insufficient bids. Please buy more bids.")
    
    # Deduct bid from user
    await db.users.update_one(
        {"id": user["id"]},
        {"$inc": {"bids_balance": -1, "total_bids_placed": 1}}
    )
    
    # Update auction - extend timer by 10-15 seconds, don't reset
    new_price = round(auction["current_price"] + auction["bid_increment"], 2)
    current_end_time = datetime.fromisoformat(auction["end_time"].replace('Z', '+00:00'))
    now = datetime.now(timezone.utc)
    
    # Only extend if less than 60 seconds remaining
    time_remaining = (current_end_time - now).total_seconds()
    if time_remaining < 60:
        if time_remaining < 15:
            new_end_time = now + timedelta(seconds=15)
        else:
            new_end_time = current_end_time + timedelta(seconds=10)
    else:
        new_end_time = current_end_time
    
    await db.auctions.update_one(
        {"id": auction_id},
        {
            "$set": {
                "current_price": new_price,
                "end_time": new_end_time.isoformat(),
                "last_bidder_id": user["id"],
                "last_bidder_name": user["name"]
            },
            "$inc": {"total_bids": 1},
            "$push": {
                "bid_history": {
                    "user_id": user["id"],
                    "user_name": user["name"],
                    "price": new_price,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "is_autobid": False
                }
            }
        }
    )
    
    # Broadcast bid update via WebSocket
    try:
        await broadcast_bid_update(auction_id, {
            "current_price": new_price,
            "end_time": new_end_time.isoformat(),
            "last_bidder_name": user["name"],
            "total_bids": auction.get("total_bids", 0) + 1,
            "bidder_message": f"{user['name']} hat geboten!"
        })
    except Exception as e:
        logger.error(f"WebSocket broadcast error: {e}")
    
    return {
        "message": "Bid placed successfully",
        "new_price": new_price,
        "new_end_time": new_end_time.isoformat(),
        "bids_remaining": user["bids_balance"] - 1
    }

# ==================== AUTOBIDDER ====================

@router.post("/autobidder")
async def create_autobidder(config: AutobidderCreate, user: dict = Depends(get_current_user)):
    """Create or update autobidder for an auction"""
    auction = await db.auctions.find_one({"id": config.auction_id}, {"_id": 0})
    if not auction:
        raise HTTPException(status_code=404, detail="Auction not found")
    
    if auction["status"] != "active":
        raise HTTPException(status_code=400, detail="Auction is not active")
    
    if user["bids_balance"] < config.max_bids:
        raise HTTPException(status_code=400, detail=f"Not enough bids. You have {user['bids_balance']}, need {config.max_bids}")
    
    # Check for existing autobidder
    existing = await db.autobidders.find_one({
        "user_id": user["id"],
        "auction_id": config.auction_id,
        "is_active": True
    })
    
    if existing:
        # Update existing
        await db.autobidders.update_one(
            {"id": existing["id"]},
            {"$set": {
                "max_bids": config.max_bids,
                "max_price": config.max_price,
                "bid_in_last_seconds": config.bid_in_last_seconds
            }}
        )
        return {"message": "Autobidder updated", "id": existing["id"]}
    
    # Create new autobidder
    autobidder = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "user_name": user["name"],
        "auction_id": config.auction_id,
        "max_bids": config.max_bids,
        "max_price": config.max_price,
        "bid_in_last_seconds": config.bid_in_last_seconds,
        "bids_placed": 0,
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.autobidders.insert_one(autobidder)
    return {"message": "Autobidder created", "id": autobidder["id"]}

@router.get("/autobidder/{auction_id}")
async def get_autobidder(auction_id: str, user: dict = Depends(get_current_user)):
    """Get user's autobidder for an auction"""
    autobidder = await db.autobidders.find_one({
        "user_id": user["id"],
        "auction_id": auction_id,
        "is_active": True
    }, {"_id": 0})
    
    return autobidder

@router.delete("/autobidder/{auction_id}")
async def delete_autobidder(auction_id: str, user: dict = Depends(get_current_user)):
    """Deactivate autobidder for an auction"""
    result = await db.autobidders.update_one(
        {"user_id": user["id"], "auction_id": auction_id, "is_active": True},
        {"$set": {"is_active": False}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="No active autobidder found")
    
    return {"message": "Autobidder deactivated"}

@router.get("/autobidders/all")
async def get_all_user_autobidders(user: dict = Depends(get_current_user)):
    """Get all autobidders for a user"""
    autobidders = await db.autobidders.find(
        {"user_id": user["id"], "is_active": True},
        {"_id": 0}
    ).to_list(100)
    
    # Enrich with auction info
    for ab in autobidders:
        auction = await db.auctions.find_one({"id": ab["auction_id"]}, {"_id": 0})
        if auction:
            product = await db.products.find_one({"id": auction.get("product_id")}, {"_id": 0})
            ab["auction"] = {
                "id": auction["id"],
                "current_price": auction.get("current_price"),
                "status": auction.get("status"),
                "end_time": auction.get("end_time"),
                "product_name": product.get("name") if product else "Unknown",
                "product_image": product.get("image_url") if product else ""
            }
    
    return autobidders

@router.get("/autobidder/my")
async def get_my_autobidders(user: dict = Depends(get_current_user)):
    """Get all autobidders for the current user (alias for frontend)"""
    autobidders = await db.autobidders.find(
        {"user_id": user["id"]},
        {"_id": 0}
    ).to_list(100)
    
    # Enrich with auction info
    for ab in autobidders:
        auction = await db.auctions.find_one({"id": ab["auction_id"]}, {"_id": 0})
        if auction:
            product = await db.products.find_one({"id": auction.get("product_id")}, {"_id": 0})
            ab["auction"] = {
                "id": auction["id"],
                "current_price": auction.get("current_price"),
                "status": auction.get("status"),
                "end_time": auction.get("end_time"),
                "product_name": product.get("name") if product else "Unknown",
                "product_image": product.get("image_url") if product else ""
            }
    
    return autobidders if autobidders else []

@router.put("/autobidder/{auction_id}/settings")
async def update_autobidder_settings(
    auction_id: str, 
    max_bids: Optional[int] = None,
    max_price: Optional[float] = None,
    bid_in_last_seconds: Optional[int] = None,
    pause: Optional[bool] = None,
    user: dict = Depends(get_current_user)
):
    """Update autobidder settings"""
    autobidder = await db.autobidders.find_one({
        "user_id": user["id"],
        "auction_id": auction_id,
        "is_active": True
    })
    
    if not autobidder:
        raise HTTPException(status_code=404, detail="Autobidder nicht gefunden")
    
    updates = {}
    if max_bids is not None:
        if user["bids_balance"] < max_bids:
            raise HTTPException(status_code=400, detail=f"Nicht genug Gebote. Du hast {user['bids_balance']}")
        updates["max_bids"] = max_bids
    if max_price is not None:
        updates["max_price"] = max_price
    if bid_in_last_seconds is not None:
        updates["bid_in_last_seconds"] = max(5, min(60, bid_in_last_seconds))  # 5-60 seconds
    if pause is not None:
        updates["is_paused"] = pause
    
    if updates:
        await db.autobidders.update_one({"id": autobidder["id"]}, {"$set": updates})
    
    updated = await db.autobidders.find_one({"id": autobidder["id"]}, {"_id": 0})
    return {"message": "Einstellungen aktualisiert", "autobidder": updated}

@router.get("/autobidder/{auction_id}/stats")
async def get_autobidder_stats(auction_id: str, user: dict = Depends(get_current_user)):
    """Get autobidder statistics for an auction"""
    autobidder = await db.autobidders.find_one({
        "user_id": user["id"],
        "auction_id": auction_id
    }, {"_id": 0})
    
    if not autobidder:
        return {"active": False, "stats": None}
    
    auction = await db.auctions.find_one({"id": auction_id}, {"_id": 0})
    
    return {
        "active": autobidder.get("is_active", False),
        "paused": autobidder.get("is_paused", False),
        "stats": {
            "bids_placed": autobidder.get("bids_placed", 0),
            "max_bids": autobidder.get("max_bids", 0),
            "remaining_bids": autobidder.get("max_bids", 0) - autobidder.get("bids_placed", 0),
            "max_price": autobidder.get("max_price"),
            "current_price": auction.get("current_price") if auction else None,
            "will_continue": (
                autobidder.get("is_active", False) and
                not autobidder.get("is_paused", False) and
                autobidder.get("bids_placed", 0) < autobidder.get("max_bids", 0) and
                (autobidder.get("max_price") is None or 
                 (auction and auction.get("current_price", 0) < autobidder.get("max_price", float('inf'))))
            )
        }
    }

@router.put("/autobidder/{autobidder_id}/toggle")
async def toggle_autobidder(autobidder_id: str, user: dict = Depends(get_current_user)):
    """Toggle autobidder active/paused state"""
    # Find autobidder by ID
    autobidder = await db.autobidders.find_one({
        "id": autobidder_id,
        "user_id": user["id"]
    })
    
    if not autobidder:
        raise HTTPException(status_code=404, detail="Autobidder nicht gefunden")
    
    # Toggle the paused state
    new_paused = not autobidder.get("is_paused", False)
    
    await db.autobidders.update_one(
        {"id": autobidder_id},
        {"$set": {"is_paused": new_paused}}
    )
    
    status_msg = "pausiert" if new_paused else "aktiviert"
    return {
        "message": f"Autobidder {status_msg}",
        "is_paused": new_paused,
        "is_active": autobidder.get("is_active", True)
    }

# ==================== ADMIN ENDPOINTS ====================

@router.post("/admin/auctions")
async def create_auction(auction: AuctionCreate, admin: dict = Depends(get_admin_user)):
    """Create a new auction (admin only)"""
    product = await db.products.find_one({"id": auction.product_id}, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    now = datetime.now(timezone.utc)
    
    # Determine start_time and end_time
    if auction.start_time and auction.end_time:
        start_time = datetime.fromisoformat(auction.start_time.replace('Z', '+00:00'))
        end_time = datetime.fromisoformat(auction.end_time.replace('Z', '+00:00'))
        status = "scheduled" if start_time > now else "active"
    elif auction.duration_seconds:
        start_time = now
        end_time = now + timedelta(seconds=auction.duration_seconds)
        status = "active"
    else:
        start_time = now
        end_time = now + timedelta(hours=24)  # Default 24 hours
        status = "active"
    
    auction_id = str(uuid.uuid4())
    doc = {
        "id": auction_id,
        "product_id": auction.product_id,
        "starting_price": auction.starting_price,
        "current_price": auction.starting_price,
        "bid_increment": auction.bid_increment,
        "start_time": start_time.isoformat(),
        "end_time": end_time.isoformat(),
        "status": status,
        "total_bids": 0,
        "last_bidder_id": None,
        "last_bidder_name": None,
        "winner_id": None,
        "winner_name": None,
        "bid_history": [],
        "bot_target_price": auction.bot_target_price,
        "buy_now_price": auction.buy_now_price,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.auctions.insert_one(doc)
    
    # Add product info to response
    doc["product"] = product
    
    return doc

@router.put("/admin/auctions/{auction_id}")
async def update_auction(auction_id: str, auction: AuctionUpdate, admin: dict = Depends(get_admin_user)):
    """Update an auction (admin only)"""
    existing = await db.auctions.find_one({"id": auction_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Auction not found")
    
    updates = {}
    
    if auction.status:
        updates["status"] = auction.status
    
    if auction.duration_seconds:
        new_end_time = datetime.now(timezone.utc) + timedelta(seconds=auction.duration_seconds)
        updates["end_time"] = new_end_time.isoformat()
    
    if auction.end_time:
        updates["end_time"] = auction.end_time
    
    if auction.start_time:
        updates["start_time"] = auction.start_time
    
    if updates:
        await db.auctions.update_one({"id": auction_id}, {"$set": updates})
    
    updated = await db.auctions.find_one({"id": auction_id}, {"_id": 0})
    return updated

@router.post("/admin/auctions/{auction_id}/end")
async def end_auction(auction_id: str, admin: dict = Depends(get_admin_user)):
    """Manually end an auction (admin only)"""
    auction = await db.auctions.find_one({"id": auction_id}, {"_id": 0})
    if not auction:
        raise HTTPException(status_code=404, detail="Auction not found")
    
    if auction["status"] == "ended":
        raise HTTPException(status_code=400, detail="Auction already ended")
    
    winner_id = auction.get("last_bidder_id")
    winner_name = auction.get("last_bidder_name")
    final_price = auction.get("current_price")
    
    await db.auctions.update_one(
        {"id": auction_id},
        {"$set": {
            "status": "ended",
            "ended_at": datetime.now(timezone.utc).isoformat(),
            "winner_id": winner_id,
            "winner_name": winner_name,
            "final_price": final_price
        }}
    )
    
    # Notify winner
    if winner_id and not winner_id.startswith("bot_"):
        await db.users.update_one(
            {"id": winner_id},
            {"$push": {"won_auctions": auction_id}}
        )
    
    # Broadcast auction ended
    try:
        await broadcast_auction_ended(auction_id, winner_name or "Kein Gewinner", final_price)
    except Exception as e:
        logger.error(f"Failed to broadcast auction end: {e}")
    
    return {
        "message": "Auction ended",
        "winner_name": winner_name,
        "final_price": final_price
    }

@router.delete("/admin/auctions/{auction_id}")
async def delete_auction(auction_id: str, admin: dict = Depends(get_admin_user)):
    """Delete an auction (admin only)"""
    result = await db.auctions.delete_one({"id": auction_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Auction not found")
    return {"message": "Auction deleted"}

@router.put("/admin/auctions/{auction_id}/featured")
async def set_featured_auction(auction_id: str, is_featured: bool = True, admin: dict = Depends(get_admin_user)):
    """Set an auction as the featured/VIP auction (admin only)"""
    auction = await db.auctions.find_one({"id": auction_id})
    if not auction:
        raise HTTPException(status_code=404, detail="Auktion nicht gefunden")
    
    # If setting as featured, unfeature all other auctions first
    if is_featured:
        await db.auctions.update_many({}, {"$set": {"is_featured": False}})
    
    # Update this auction
    await db.auctions.update_one(
        {"id": auction_id},
        {"$set": {"is_featured": is_featured}}
    )
    
    return {
        "message": f"Auktion {'als VIP markiert' if is_featured else 'VIP-Status entfernt'}",
        "auction_id": auction_id,
        "is_featured": is_featured
    }

@router.put("/admin/auctions/{auction_id}/vip-only")
async def set_vip_only_auction(auction_id: str, is_vip_only: bool = True, admin: dict = Depends(get_admin_user)):
    """Set an auction as VIP-only (only VIP members can bid)"""
    auction = await db.auctions.find_one({"id": auction_id})
    if not auction:
        raise HTTPException(status_code=404, detail="Auktion nicht gefunden")
    
    await db.auctions.update_one(
        {"id": auction_id},
        {"$set": {"is_vip_only": is_vip_only}}
    )
    
    return {
        "message": f"Auktion {'als VIP-Only markiert' if is_vip_only else 'VIP-Only Status entfernt'}",
        "auction_id": auction_id,
        "is_vip_only": is_vip_only
    }

@router.post("/admin/auctions/{auction_id}/restart")
async def restart_auction(
    auction_id: str, 
    duration_seconds: int = 600,
    bot_target_price: Optional[float] = None,
    admin: dict = Depends(get_admin_user)
):
    """Restart an ended auction with a new end time"""
    auction = await db.auctions.find_one({"id": auction_id})
    if not auction:
        raise HTTPException(status_code=404, detail="Auktion nicht gefunden")
    
    now = datetime.now(timezone.utc)
    new_end_time = now + timedelta(seconds=duration_seconds)
    
    # Reset auction to active state
    update_data = {
        "status": "active",
        "start_time": now.isoformat(),
        "end_time": new_end_time.isoformat(),
        "current_price": 0.01,
        "total_bids": 0,
        "last_bidder_id": None,
        "last_bidder_name": None,
        "winner_id": None,
        "winner_name": None,
        "bid_history": [],
        "ended_at": None,
        "final_price": None
    }
    
    # Set bot target price if provided
    if bot_target_price is not None:
        update_data["bot_target_price"] = bot_target_price
    
    await db.auctions.update_one({"id": auction_id}, {"$set": update_data})
    
    # Get product info
    product = await db.products.find_one({"id": auction.get("product_id")}, {"_id": 0})
    
    response_data = {
        "message": "Auktion neu gestartet",
        "auction_id": auction_id,
        "new_end_time": new_end_time.isoformat(),
        "bot_target_price": bot_target_price
    }
    
    return response_data

@router.put("/admin/auctions/{auction_id}/auto-restart")
async def set_auto_restart(
    auction_id: str,
    duration_minutes: int = 10,
    bot_target_price: float = 0,
    admin: dict = Depends(get_admin_user)
):
    """Set auto-restart configuration for an auction"""
    auction = await db.auctions.find_one({"id": auction_id})
    if not auction:
        raise HTTPException(status_code=404, detail="Auktion nicht gefunden")
    
    # Store auto-restart configuration
    auto_restart_config = None
    if duration_minutes > 0:
        auto_restart_config = {
            "enabled": True,
            "duration_minutes": duration_minutes,
            "bot_target_price": bot_target_price if bot_target_price > 0 else None
        }
    
    await db.auctions.update_one(
        {"id": auction_id},
        {"$set": {"auto_restart": auto_restart_config}}
    )
    
    return {
        "message": f"Auto-Neustart {'aktiviert' if duration_minutes > 0 else 'deaktiviert'}",
        "auction_id": auction_id,
        "auto_restart": auto_restart_config
    }

@router.post("/admin/auctions/batch")
async def create_batch_auctions(
    count: int = 100,
    duration_minutes: int = 30,
    bot_target_percentage: int = 20,
    immediate_percent: int = 50,
    admin: dict = Depends(get_admin_user)
):
    """Create multiple auctions at once for testing (admin only)
    
    Args:
        count: Number of auctions to create
        duration_minutes: Base duration for each auction
        bot_target_percentage: Bot target price as percentage of retail price
        immediate_percent: Percentage of auctions to start immediately (0-100)
    """
    import random
    
    products = await db.products.find({}, {"_id": 0}).to_list(1000)
    if not products:
        raise HTTPException(status_code=400, detail="No products available")
    
    now = datetime.now(timezone.utc)
    created_auctions = []
    immediate_count = int(count * (immediate_percent / 100))
    
    for i in range(count):
        product = random.choice(products)
        
        # First 'immediate_count' auctions start immediately, rest are scheduled
        if i < immediate_count:
            start_time = now
            status = "active"
        else:
            # Randomize start times over the next hours for variety
            start_offset = random.randint(5, 120)  # 5-120 minutes
            start_time = now + timedelta(minutes=start_offset)
            status = "scheduled"
        
        end_time = start_time + timedelta(minutes=duration_minutes + random.randint(0, 30))
        
        # Calculate bot target price (percentage of retail price)
        retail_price = product.get("retail_price", 100)
        bot_target = round(retail_price * (bot_target_percentage / 100), 2)
        
        # Buy now price at 70-90% of retail
        buy_now_price = round(retail_price * random.uniform(0.7, 0.9), 2)
        
        auction_id = str(uuid.uuid4())
        doc = {
            "id": auction_id,
            "product_id": product["id"],
            "starting_price": 0.01,
            "current_price": 0.01,
            "bid_increment": 0.01,
            "start_time": start_time.isoformat(),
            "end_time": end_time.isoformat(),
            "status": status,
            "total_bids": 0,
            "last_bidder_id": None,
            "last_bidder_name": None,
            "winner_id": None,
            "winner_name": None,
            "bid_history": [],
            "bot_target_price": bot_target,
            "buy_now_price": buy_now_price,
            "created_at": now.isoformat()
        }
        
        await db.auctions.insert_one(doc)
        created_auctions.append({
            "id": auction_id,
            "product": product["name"],
            "status": status,
            "bot_target": bot_target,
            "buy_now_price": buy_now_price
        })
    
    return {
        "message": f"{count} Auktionen erstellt",
        "active": len([a for a in created_auctions if a["status"] == "active"]),
        "scheduled": len([a for a in created_auctions if a["status"] == "scheduled"]),
        "auctions": created_auctions[:10]  # Return first 10 as sample
    }

# ==================== BUY IT NOW ====================

@router.post("/auctions/{auction_id}/buy-now")
async def buy_now(auction_id: str, user: dict = Depends(get_current_user)):
    """Buy the item immediately at the buy-now price"""
    auction = await db.auctions.find_one({"id": auction_id}, {"_id": 0})
    if not auction:
        raise HTTPException(status_code=404, detail="Auction not found")
    
    if auction["status"] != "active":
        raise HTTPException(status_code=400, detail="Auktion ist nicht aktiv")
    
    buy_now_price = auction.get("buy_now_price")
    if not buy_now_price:
        raise HTTPException(status_code=400, detail="Sofortkauf nicht verfügbar")
    
    # Get product info
    product = await db.products.find_one({"id": auction.get("product_id")}, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    # Create purchase record
    purchase_id = str(uuid.uuid4())
    purchase = {
        "id": purchase_id,
        "user_id": user["id"],
        "user_email": user["email"],
        "auction_id": auction_id,
        "product_id": auction["product_id"],
        "product_name": product.get("name", "Unknown"),
        "product_image": product.get("image_url", ""),
        "purchase_type": "buy_now",
        "price": buy_now_price,
        "status": "pending_payment",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.purchases.insert_one(purchase)
    
    # End the auction
    await db.auctions.update_one(
        {"id": auction_id},
        {"$set": {
            "status": "ended",
            "ended_at": datetime.now(timezone.utc).isoformat(),
            "winner_id": user["id"],
            "winner_name": user.get("name", user["email"]),
            "final_price": buy_now_price,
            "buy_now_used": True
        }}
    )
    
    # Add to user's won auctions
    await db.users.update_one(
        {"id": user["id"]},
        {"$push": {"won_auctions": auction_id}}
    )
    
    # Grant achievement
    await grant_achievement(user["id"], "first_buy_now", "Sofortkäufer", "Ersten Artikel mit Sofortkauf erworben")
    
    # Broadcast auction ended
    try:
        await broadcast_auction_ended(auction_id, user.get("name", user["email"]), buy_now_price)
    except Exception as e:
        logger.error(f"Failed to broadcast: {e}")
    
    return {
        "message": "Sofortkauf erfolgreich!",
        "purchase_id": purchase_id,
        "product": product.get("name"),
        "price": buy_now_price,
        "status": "pending_payment"
    }

@router.get("/auctions/{auction_id}/buy-now-price")
async def get_buy_now_price(auction_id: str):
    """Get the buy-now price for an auction"""
    auction = await db.auctions.find_one({"id": auction_id}, {"_id": 0, "buy_now_price": 1, "status": 1})
    if not auction:
        raise HTTPException(status_code=404, detail="Auction not found")
    
    return {
        "auction_id": auction_id,
        "buy_now_price": auction.get("buy_now_price"),
        "available": auction.get("status") == "active" and auction.get("buy_now_price") is not None
    }

# ==================== ACHIEVEMENTS HELPER ====================

async def grant_achievement(user_id: str, achievement_id: str, name: str, description: str):
    """Grant an achievement to a user"""
    existing = await db.achievements.find_one({
        "user_id": user_id,
        "achievement_id": achievement_id
    })
    
    if not existing:
        await db.achievements.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "achievement_id": achievement_id,
            "name": name,
            "description": description,
            "earned_at": datetime.now(timezone.utc).isoformat()
        })
        return True
    return False
