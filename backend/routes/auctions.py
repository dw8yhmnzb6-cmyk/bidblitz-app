"""
BidBlitz V2 - Penny Auction System
Users buy bid credits, each bid costs 1 credit, increases price by €0.01, extends timer.
"""

import secrets
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from typing import Optional
from core.database import db
from core.security import get_current_user
from core.audit import log_audit, AuditEvent, get_client_info

router = APIRouter(prefix="/api/auctions", tags=["auctions"])

PRICE_INCREMENT = 0.01
TIMER_EXTENSION_SECONDS = 10
DEFAULT_DURATION_SECONDS = 300  # 5 minutes

CREDIT_PACKAGES = {
    "10": {"credits": 10, "price": 5.00},
    "25": {"credits": 25, "price": 10.00},
    "50": {"credits": 50, "price": 18.00},
    "100": {"credits": 100, "price": 30.00},
}


# ── List auctions ──
@router.get("")
async def list_auctions(request: Request):
    """List active and upcoming auctions."""
    now = datetime.now(timezone.utc).isoformat()

    # Auto-end expired auctions
    expired = await db.auctions.find(
        {"status": "active", "ends_at": {"$lt": now}}
    ).to_list(100)
    for auc in expired:
        # Find last bidder
        last_bid = await db.auction_bids.find_one(
            {"auction_id": auc["auction_id"]},
            sort=[("created_at", -1)],
        )
        winner_id = last_bid["user_id"] if last_bid else None
        winner_name = last_bid["user_name"] if last_bid else None
        await db.auctions.update_one(
            {"auction_id": auc["auction_id"]},
            {"$set": {
                "status": "ended",
                "winner_id": winner_id,
                "winner_name": winner_name,
                "ended_at": now,
            }},
        )

    auctions = await db.auctions.find(
        {"status": {"$in": ["active", "upcoming", "ended"]}},
        {"_id": 0},
    ).sort("created_at", -1).to_list(50)

    return {"auctions": auctions}


# ── Get single auction with bids ──
@router.get("/{auction_id}")
async def get_auction(auction_id: str, request: Request):
    """Get auction details with recent bid history."""
    now = datetime.now(timezone.utc).isoformat()

    auction = await db.auctions.find_one(
        {"auction_id": auction_id}, {"_id": 0}
    )
    if not auction:
        raise HTTPException(status_code=404, detail="Auction not found")

    # Auto-end if expired
    if auction["status"] == "active" and auction["ends_at"] < now:
        last_bid = await db.auction_bids.find_one(
            {"auction_id": auction_id},
            sort=[("created_at", -1)],
        )
        winner_id = last_bid["user_id"] if last_bid else None
        winner_name = last_bid["user_name"] if last_bid else None
        await db.auctions.update_one(
            {"auction_id": auction_id},
            {"$set": {
                "status": "ended",
                "winner_id": winner_id,
                "winner_name": winner_name,
                "ended_at": now,
            }},
        )
        auction["status"] = "ended"
        auction["winner_id"] = winner_id
        auction["winner_name"] = winner_name

    # Get recent bids (last 30)
    bids = await db.auction_bids.find(
        {"auction_id": auction_id}, {"_id": 0}
    ).sort("created_at", -1).to_list(30)

    return {"auction": auction, "bids": bids}


# ── Place a bid ──
class BidRequest(BaseModel):
    auction_id: str


@router.post("/bid")
async def place_bid(req: BidRequest, request: Request):
    """Place a bid on an auction. Costs 1 credit."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    ip, ua = get_client_info(request)

    now = datetime.now(timezone.utc)
    now_iso = now.isoformat()

    # Check auction exists and is active
    auction = await db.auctions.find_one({"auction_id": req.auction_id})
    if not auction:
        raise HTTPException(status_code=404, detail="Auction not found")
    if auction["status"] != "active":
        raise HTTPException(status_code=400, detail="Auction is not active")
    if auction["ends_at"] < now_iso:
        raise HTTPException(status_code=400, detail="Auction has ended")

    # Check user has credits
    credits = user.get("bid_credits", 0)
    if credits < 1:
        raise HTTPException(status_code=400, detail="Not enough bid credits")

    # Deduct 1 credit
    await db.users.update_one(
        {"_id": user["_id"]},
        {"$inc": {"bid_credits": -1}},
    )

    # Calculate new price
    new_price = round(auction["current_price"] + PRICE_INCREMENT, 2)

    # Extend timer
    current_ends = datetime.fromisoformat(auction["ends_at"])
    remaining = (current_ends - now).total_seconds()
    if remaining < TIMER_EXTENSION_SECONDS:
        new_ends = now + timedelta(seconds=TIMER_EXTENSION_SECONDS)
    else:
        new_ends = current_ends
    new_ends_iso = new_ends.isoformat()

    # Update auction
    await db.auctions.update_one(
        {"auction_id": req.auction_id},
        {"$set": {
            "current_price": new_price,
            "ends_at": new_ends_iso,
            "last_bidder_id": user_id,
            "last_bidder_name": user.get("name", "Anonymous"),
        },
        "$inc": {"total_bids": 1}},
    )

    # Record bid
    bid_record = {
        "bid_id": secrets.token_hex(6),
        "auction_id": req.auction_id,
        "user_id": user_id,
        "user_name": user.get("name", "Anonymous"),
        "bid_price": new_price,
        "created_at": now_iso,
    }
    await db.auction_bids.insert_one(bid_record)
    bid_record.pop("_id", None)

    updated_user = await db.users.find_one({"_id": user["_id"]})

    return {
        "bid": bid_record,
        "new_price": new_price,
        "ends_at": new_ends_iso,
        "total_bids": auction["total_bids"] + 1,
        "remaining_credits": updated_user.get("bid_credits", 0),
    }


# ── Buy bid credits ──
class BuyCreditsRequest(BaseModel):
    package_id: str


@router.post("/buy-credits")
async def buy_credits(req: BuyCreditsRequest, request: Request):
    """Buy bid credits using wallet balance."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    ip, ua = get_client_info(request)

    if req.package_id not in CREDIT_PACKAGES:
        raise HTTPException(status_code=400, detail="Invalid package")

    pkg = CREDIT_PACKAGES[req.package_id]
    price = pkg["price"]
    credits = pkg["credits"]

    # Check balance
    balance = user.get("balance", 0)
    if balance < price:
        raise HTTPException(status_code=400, detail="Insufficient wallet balance")

    # Deduct balance and add credits
    await db.users.update_one(
        {"_id": user["_id"]},
        {
            "$inc": {"balance": -price, "bid_credits": credits},
        },
    )

    # Create transaction
    txn = {
        "id": secrets.token_hex(8),
        "user_id": user_id,
        "type": "purchase",
        "amount": -price,
        "description": f"Bid Credits ({credits}x)",
        "status": "completed",
        "reference": f"BIDS-{secrets.token_hex(4).upper()}",
        "category": "auction",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.transactions.insert_one(txn)
    txn.pop("_id", None)

    updated_user = await db.users.find_one({"_id": user["_id"]})

    return {
        "credits_added": credits,
        "total_credits": updated_user.get("bid_credits", 0),
        "new_balance": updated_user.get("balance", 0),
    }


# ── Get user's credit balance ──
@router.get("/credits/balance")
async def get_credits(request: Request):
    """Get user's current bid credit balance."""
    user = await get_current_user(request)
    return {"bid_credits": user.get("bid_credits", 0)}


# ── Admin: Create auction ──
class CreateAuctionRequest(BaseModel):
    title: str = Field(..., min_length=2, max_length=200)
    description: Optional[str] = ""
    image_url: Optional[str] = ""
    retail_price: float = Field(..., gt=0)
    duration_seconds: int = Field(default=300, ge=60, le=3600)
    start_now: bool = True


@router.post("/admin/create")
async def create_auction(req: CreateAuctionRequest, request: Request):
    """Admin creates a new auction."""
    user = await get_current_user(request)
    if user.get("role") not in ("admin",):
        raise HTTPException(status_code=403, detail="Admin only")

    now = datetime.now(timezone.utc)
    auction_id = secrets.token_hex(8)
    ends_at = (now + timedelta(seconds=req.duration_seconds)).isoformat()

    auction = {
        "auction_id": auction_id,
        "title": req.title.strip(),
        "description": (req.description or "").strip(),
        "image_url": req.image_url or "",
        "retail_price": req.retail_price,
        "starting_price": 0.00,
        "current_price": 0.00,
        "price_increment": PRICE_INCREMENT,
        "timer_extension": TIMER_EXTENSION_SECONDS,
        "duration_seconds": req.duration_seconds,
        "ends_at": ends_at if req.start_now else "",
        "status": "active" if req.start_now else "upcoming",
        "winner_id": None,
        "winner_name": None,
        "last_bidder_id": None,
        "last_bidder_name": None,
        "total_bids": 0,
        "created_by": str(user["_id"]),
        "created_at": now.isoformat(),
    }
    await db.auctions.insert_one(auction)
    auction.pop("_id", None)

    return {"auction": auction}


# ── Seed demo auctions ──
async def seed_demo_auctions():
    """Seed demo auctions if none exist."""
    count = await db.auctions.count_documents({})
    if count > 0:
        return

    now = datetime.now(timezone.utc)
    demos = [
        {
            "title": "iPhone 16 Pro Max",
            "description": "Brand new Apple iPhone 16 Pro Max 256GB",
            "retail_price": 1399.00,
            "duration": 600,
        },
        {
            "title": "PlayStation 5 Pro",
            "description": "Sony PS5 Pro with DualSense controller",
            "retail_price": 799.00,
            "duration": 480,
        },
        {
            "title": "AirPods Pro 3",
            "description": "Apple AirPods Pro 3rd Generation with case",
            "retail_price": 279.00,
            "duration": 300,
        },
        {
            "title": "Samsung Galaxy Watch 7",
            "description": "Samsung Galaxy Watch 7 Classic 47mm",
            "retail_price": 429.00,
            "duration": 360,
        },
    ]

    for d in demos:
        auction_id = secrets.token_hex(8)
        ends_at = (now + timedelta(seconds=d["duration"])).isoformat()
        auction = {
            "auction_id": auction_id,
            "title": d["title"],
            "description": d["description"],
            "image_url": "",
            "retail_price": d["retail_price"],
            "starting_price": 0.00,
            "current_price": 0.00,
            "price_increment": PRICE_INCREMENT,
            "timer_extension": TIMER_EXTENSION_SECONDS,
            "duration_seconds": d["duration"],
            "ends_at": ends_at,
            "status": "active",
            "winner_id": None,
            "winner_name": None,
            "last_bidder_id": None,
            "last_bidder_name": None,
            "total_bids": 0,
            "created_by": "system",
            "created_at": now.isoformat(),
        }
        await db.auctions.insert_one(auction)
        auction.pop("_id", None)
