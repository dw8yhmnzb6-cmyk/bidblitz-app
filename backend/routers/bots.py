"""Bots router - Bot management for admin"""
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone, timedelta
from typing import List, Optional
import uuid
import random
import asyncio

from config import db, logger
from dependencies import get_admin_user
from schemas import BotCreate, BotBidRequest, MultiBotBidRequest

router = APIRouter(prefix="/admin/bots", tags=["Bots"])

# ==================== BOT CRUD ====================

@router.post("")
async def create_bot(bot: BotCreate, admin: dict = Depends(get_admin_user)):
    """Create a new bot"""
    bot_id = str(uuid.uuid4())
    doc = {
        "id": bot_id,
        "name": bot.name,
        "bids_placed": 0,
        "wins": 0,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.bots.insert_one(doc)
    return doc

@router.get("")
async def get_bots(admin: dict = Depends(get_admin_user)):
    """Get all bots"""
    bots = await db.bots.find({}, {"_id": 0}).to_list(100)
    return bots

@router.delete("/{bot_id}")
async def delete_bot(bot_id: str, admin: dict = Depends(get_admin_user)):
    """Delete a bot"""
    result = await db.bots.delete_one({"id": bot_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Bot not found")
    return {"message": "Bot deleted"}

# ==================== BOT BIDDING ====================

@router.post("/bid")
async def bot_bid(request: BotBidRequest, admin: dict = Depends(get_admin_user)):
    """Make a bot place a single bid"""
    bot = await db.bots.find_one({"id": request.bot_id}, {"_id": 0})
    if not bot:
        raise HTTPException(status_code=404, detail="Bot not found")
    
    auction = await db.auctions.find_one({"id": request.auction_id}, {"_id": 0})
    if not auction:
        raise HTTPException(status_code=404, detail="Auction not found")
    
    if auction["status"] != "active":
        raise HTTPException(status_code=400, detail="Auction is not active")
    
    # Place bid
    new_price = round(auction["current_price"] + auction["bid_increment"], 2)
    new_end_time = datetime.now(timezone.utc) + timedelta(seconds=15)
    
    await db.auctions.update_one(
        {"id": request.auction_id},
        {
            "$set": {
                "current_price": new_price,
                "last_bidder_id": f"bot_{bot['id']}",
                "last_bidder_name": bot["name"],
                "end_time": new_end_time.isoformat()
            },
            "$inc": {"total_bids": 1},
            "$push": {
                "bid_history": {
                    "bidder_id": f"bot_{bot['id']}",
                    "bidder_name": bot["name"],
                    "price": new_price,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "is_bot": True
                }
            }
        }
    )
    
    # Update bot stats
    await db.bots.update_one({"id": bot["id"]}, {"$inc": {"bids_placed": 1}})
    
    return {
        "success": True,
        "new_price": new_price,
        "bot_name": bot["name"]
    }

@router.post("/multi-bid")
async def multi_bot_bid(request: MultiBotBidRequest, admin: dict = Depends(get_admin_user)):
    """Start multiple bots bidding against each other until target price"""
    auction = await db.auctions.find_one({"id": request.auction_id}, {"_id": 0})
    if not auction:
        raise HTTPException(status_code=404, detail="Auction not found")
    
    if auction["status"] != "active":
        raise HTTPException(status_code=400, detail="Auction is not active")
    
    # Get all bots
    bots = await db.bots.find({}, {"_id": 0}).to_list(100)
    if len(bots) < 2:
        raise HTTPException(status_code=400, detail="Need at least 2 bots")
    
    # Update auction with target price for background task
    await db.auctions.update_one(
        {"id": request.auction_id},
        {"$set": {"bot_target_price": request.target_price}}
    )
    
    return {
        "success": True,
        "message": f"Bots will bid until €{request.target_price:.2f}",
        "auction_id": request.auction_id
    }
