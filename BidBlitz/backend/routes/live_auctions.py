"""
BidBlitz V2 - Live Auctions with Countdown Timer
Real-time bidding — last bidder wins when timer hits 0
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from datetime import datetime, timezone, timedelta
from core.database import db
from core.security import get_current_user
import secrets

router = APIRouter(prefix="/api/live-auctions", tags=["live-auctions"])

PLATFORM_FEE = 0.10  # 10%


class AuctionCreate(BaseModel):
    title: str = Field(..., min_length=2, max_length=100)
    description: str = ""
    start_price: float = Field(1.0, ge=0.01)
    duration_seconds: int = Field(300, ge=60, le=3600)
    category: str = "Allgemein"
    image_url: str = ""


class BidRequest(BaseModel):
    auction_id: str
    amount: float


@router.get("/active")
async def get_active_auctions():
    now = datetime.now(timezone.utc).isoformat()
    auctions = await db.live_auctions.find(
        {"status": "active", "ends_at": {"$gt": now}}, {"_id": 0}
    ).sort("ends_at", 1).to_list(30)
    return {"auctions": auctions}


@router.get("/auction/{auction_id}")
async def get_auction(auction_id: str):
    a = await db.live_auctions.find_one({"auction_id": auction_id}, {"_id": 0})
    if not a:
        raise HTTPException(404, "Auktion nicht gefunden")
    return a


@router.post("/create")
async def create_auction(req: AuctionCreate, request: Request):
    user = await get_current_user(request)
    now = datetime.now(timezone.utc)
    auction = {
        "auction_id": f"la_{secrets.token_hex(6)}",
        "seller_email": user.get("email", ""),
        "seller_name": user.get("name", ""),
        "title": req.title,
        "description": req.description,
        "start_price": req.start_price,
        "current_price": req.start_price,
        "category": req.category,
        "image_url": req.image_url,
        "bids": [],
        "bid_count": 0,
        "highest_bidder": None,
        "status": "active",
        "created_at": now.isoformat(),
        "ends_at": (now + timedelta(seconds=req.duration_seconds)).isoformat(),
        "duration_seconds": req.duration_seconds,
    }
    await db.live_auctions.insert_one(auction)
    auction.pop("_id", None)
    return {"ok": True, "auction": auction}


@router.post("/bid")
async def place_bid(req: BidRequest, request: Request):
    user = await get_current_user(request)
    email = user.get("email", "")
    
    auction = await db.live_auctions.find_one({"auction_id": req.auction_id, "status": "active"})
    if not auction:
        raise HTTPException(404, "Auktion nicht gefunden")
    
    now = datetime.now(timezone.utc)
    ends = datetime.fromisoformat(auction["ends_at"].replace("Z", "+00:00"))
    if now > ends:
        raise HTTPException(400, "Auktion beendet")
    
    if auction["seller_email"] == email:
        raise HTTPException(400, "Eigene Auktion")
    
    if req.amount <= auction["current_price"]:
        raise HTTPException(400, f"Gebot muss höher als €{auction['current_price']:.2f} sein")
    
    balance = user.get("balance", 0)
    if balance < req.amount:
        raise HTTPException(400, "Nicht genug Guthaben")
    
    bid = {
        "bidder_email": email,
        "bidder_name": user.get("name", email),
        "amount": req.amount,
        "time": now.isoformat(),
    }
    
    # Extend timer by 15 seconds on last-second bids
    new_ends = ends
    remaining = (ends - now).total_seconds()
    if remaining < 30:
        new_ends = now + timedelta(seconds=30)
    
    await db.live_auctions.update_one(
        {"auction_id": req.auction_id},
        {"$set": {"current_price": req.amount, "highest_bidder": email, "ends_at": new_ends.isoformat()},
         "$push": {"bids": bid}, "$inc": {"bid_count": 1}}
    )
    
    return {"ok": True, "new_price": req.amount, "remaining_seconds": max(0, (new_ends - now).total_seconds())}


@router.get("/ended")
async def get_ended_auctions():
    now = datetime.now(timezone.utc).isoformat()
    ended = await db.live_auctions.find(
        {"ends_at": {"$lt": now}}, {"_id": 0}
    ).sort("ends_at", -1).to_list(20)
    return {"auctions": ended}
