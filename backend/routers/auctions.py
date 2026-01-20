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

# ==================== PUBLIC ENDPOINTS ====================

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
