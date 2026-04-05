"""
BidBlitz V2 - Penny Auction System
Users buy bid credits, each bid costs 1 credit, increases price by €0.01, extends timer.
"""

import secrets
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from typing import Optional
from bson import ObjectId
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


# ── Get user's credit balance ──
@router.get("/credits/balance")
async def get_credits(request: Request):
    """Get user's current bid credit balance."""
    user = await get_current_user(request)
    return {"bid_credits": user.get("bid_credits", 0)}


# ── Daily Reward ──
DAILY_REWARD_CREDITS = 3

@router.post("/daily-reward")
async def claim_daily_reward(request: Request):
    """Claim daily free bid credits."""
    user = await get_current_user(request)
    now = datetime.now(timezone.utc)
    last_claim = user.get("last_daily_claim")
    if last_claim:
        last_dt = datetime.fromisoformat(last_claim)
        if (now - last_dt).total_seconds() < 86400:
            remaining_secs = int(86400 - (now - last_dt).total_seconds())
            raise HTTPException(status_code=400, detail=f"Already claimed. Next in {remaining_secs}s")
    await db.users.update_one(
        {"_id": user["_id"]},
        {"$inc": {"bid_credits": DAILY_REWARD_CREDITS}, "$set": {"last_daily_claim": now.isoformat()}},
    )
    updated = await db.users.find_one({"_id": user["_id"]})
    return {"credits_awarded": DAILY_REWARD_CREDITS, "total_credits": updated.get("bid_credits", 0)}


@router.get("/daily-reward")
async def check_daily_reward(request: Request):
    """Check if daily reward is available."""
    user = await get_current_user(request)
    now = datetime.now(timezone.utc)
    last_claim = user.get("last_daily_claim")
    if not last_claim:
        return {"available": True, "remaining_seconds": 0}
    last_dt = datetime.fromisoformat(last_claim)
    elapsed = (now - last_dt).total_seconds()
    if elapsed >= 86400:
        return {"available": True, "remaining_seconds": 0}
    return {"available": False, "remaining_seconds": int(86400 - elapsed)}


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

    # Count unique bidders
    unique_bidders = await db.auction_bids.distinct("user_id", {"auction_id": auction_id})

    return {"auction": auction, "bids": bids, "unique_bidders": len(unique_bidders)}


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

    # Trigger auto-bids from other users
    try:
        await process_auto_bids(req.auction_id, user_id)
    except Exception:
        pass

    return {
        "bid": bid_record,
        "new_price": new_price,
        "ends_at": new_ends_iso,
        "total_bids": auction["total_bids"] + 1,
        "remaining_credits": updated_user.get("bid_credits", 0),
    }


# ── Process auto-bids after a manual bid ──
async def process_auto_bids(auction_id: str, last_bidder_id: str):
    """Check if any auto-bidders should respond to this bid."""
    auto_bids = await db.auto_bids.find(
        {"auction_id": auction_id, "active": True, "user_id": {"$ne": last_bidder_id}}
    ).to_list(50)

    for ab in auto_bids:
        if ab["bids_placed"] >= ab["max_bids"]:
            await db.auto_bids.update_one({"_id": ab["_id"]}, {"$set": {"active": False}})
            continue

        user = await db.users.find_one({"_id": ObjectId(ab["user_id"])})
        if not user or user.get("bid_credits", 0) < 1:
            await db.auto_bids.update_one({"_id": ab["_id"]}, {"$set": {"active": False}})
            continue

        auction = await db.auctions.find_one({"auction_id": auction_id})
        if not auction or auction["status"] != "active":
            break

        now = datetime.now(timezone.utc)
        now_iso = now.isoformat()
        if auction["ends_at"] < now_iso:
            break

        # Deduct credit
        await db.users.update_one({"_id": user["_id"]}, {"$inc": {"bid_credits": -1}})

        new_price = round(auction["current_price"] + PRICE_INCREMENT, 2)
        current_ends = datetime.fromisoformat(auction["ends_at"])
        remaining = (current_ends - now).total_seconds()
        new_ends = (now + timedelta(seconds=TIMER_EXTENSION_SECONDS)) if remaining < TIMER_EXTENSION_SECONDS else current_ends

        await db.auctions.update_one(
            {"auction_id": auction_id},
            {"$set": {"current_price": new_price, "ends_at": new_ends.isoformat(),
                      "last_bidder_id": ab["user_id"], "last_bidder_name": user.get("name", "Anonymous")},
             "$inc": {"total_bids": 1}},
        )

        bid_record = {
            "bid_id": secrets.token_hex(6), "auction_id": auction_id,
            "user_id": ab["user_id"], "user_name": user.get("name", "Anonymous"),
            "bid_price": new_price, "created_at": now_iso, "is_auto": True,
        }
        await db.auction_bids.insert_one(bid_record)

        await db.auto_bids.update_one({"_id": ab["_id"]}, {"$inc": {"bids_placed": 1}})
        break  # Only one auto-bid per trigger


# ── Set Auto-Bid ──
class AutoBidRequest(BaseModel):
    auction_id: str
    max_bids: int = Field(..., ge=1, le=500)


@router.post("/auto-bid")
async def set_auto_bid(req: AutoBidRequest, request: Request):
    """Set auto-bid for an auction."""
    user = await get_current_user(request)
    user_id = str(user["_id"])

    auction = await db.auctions.find_one({"auction_id": req.auction_id})
    if not auction or auction["status"] != "active":
        raise HTTPException(status_code=400, detail="Auction not active")

    credits = user.get("bid_credits", 0)
    if credits < 1:
        raise HTTPException(status_code=400, detail="Not enough bid credits")

    # Upsert auto-bid
    await db.auto_bids.update_one(
        {"user_id": user_id, "auction_id": req.auction_id},
        {"$set": {"active": True, "max_bids": req.max_bids, "updated_at": datetime.now(timezone.utc).isoformat()},
         "$setOnInsert": {"bids_placed": 0, "created_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True,
    )
    return {"ok": True, "max_bids": req.max_bids}


@router.delete("/auto-bid/{auction_id}")
async def cancel_auto_bid(auction_id: str, request: Request):
    """Cancel auto-bid for an auction."""
    user = await get_current_user(request)
    await db.auto_bids.update_one(
        {"user_id": str(user["_id"]), "auction_id": auction_id},
        {"$set": {"active": False}},
    )
    return {"ok": True}


@router.get("/auto-bid/{auction_id}")
async def get_auto_bid(auction_id: str, request: Request):
    """Get auto-bid status for an auction."""
    user = await get_current_user(request)
    ab = await db.auto_bids.find_one(
        {"user_id": str(user["_id"]), "auction_id": auction_id},
        {"_id": 0},
    )
    if not ab or not ab.get("active"):
        return {"active": False}
    return {"active": True, "max_bids": ab.get("max_bids", 0), "bids_placed": ab.get("bids_placed", 0)}


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


# ══════════════════════════════════════════════════════
# Product Catalog — Easy to update by admin
# Keep this list current with trending, high-demand items
# Last updated: April 2026
# ══════════════════════════════════════════════════════

# Product images mapped by title
PRODUCT_IMAGES = {
    "Samsung Galaxy S26 Ultra": "https://images.unsplash.com/photo-1773414422164-eefdc240da58?w=600&h=400&fit=crop&q=80",
    "iPhone 17 Pro Max": "https://images.unsplash.com/photo-1769594362058-d561f024a235?w=600&h=400&fit=crop&q=80",
    "Google Pixel 10 Pro": "https://images.unsplash.com/photo-1639885339994-59a8ffd15bdb?w=600&h=400&fit=crop&q=80",
    "Nintendo Switch 2": "https://images.unsplash.com/photo-1761395013766-8416415b0207?w=600&h=400&fit=crop&q=80",
    "PlayStation 5 Pro": "https://images.unsplash.com/photo-1693929291343-f38cb7519d5d?w=600&h=400&fit=crop&q=80",
    "AirPods Pro 3": "https://images.unsplash.com/photo-1677346414290-d337cbc682a6?w=600&h=400&fit=crop&q=80",
    "Sony WH-1000XM6": "https://images.unsplash.com/photo-1748792321323-25d97044ba2c?w=600&h=400&fit=crop&q=80",
    "Apple Watch Ultra 3": "https://images.unsplash.com/photo-1585823339274-26b392cefe45?w=600&h=400&fit=crop&q=80",
    "Samsung Galaxy Ring 2": "https://images.unsplash.com/photo-1760088348194-a5ac70a8aa9f?w=600&h=400&fit=crop&q=80",
    "MacBook Pro 16\" M5 Pro": "https://images.unsplash.com/photo-1627766556564-5d89b3765c46?w=600&h=400&fit=crop&q=80",
    "iPad Pro 13\" M5": "https://images.unsplash.com/photo-1622849030045-1f2c32ae3099?w=600&h=400&fit=crop&q=80",
    "Meta Quest 4": "https://images.unsplash.com/photo-1758523670318-f1b79559e1d1?w=600&h=400&fit=crop&q=80",
    "Dyson Airstrait Pro": "https://images.unsplash.com/photo-1629397683830-9805395892e8?w=600&h=400&fit=crop&q=80",
}

PRODUCT_CATALOG = [
    # Smartphones
    {"title": "Samsung Galaxy S26 Ultra", "description": "Samsung Galaxy S26 Ultra 512GB Titanium — AMOLED 6.9\", Snapdragon 8 Elite 2, 200MP Camera", "retail_price": 1499.00, "duration": 600, "category": "phones",
     "features": ["6.9\" Dynamic AMOLED 2X, 3120x1440", "Snapdragon 8 Elite 2 Processor", "200MP Main + 50MP Ultra-Wide + 10MP Telephoto", "5000mAh Battery, 65W Fast Charge", "512GB Storage, 16GB RAM", "S Pen Built-in, IP68 Water Resistant"],
     "condition": "Brand New — Factory Sealed"},
    {"title": "iPhone 17 Pro Max", "description": "Apple iPhone 17 Pro Max 256GB — A19 Pro Chip, 48MP Triple Camera, Titanium Design", "retail_price": 1449.00, "duration": 600, "category": "phones",
     "features": ["6.9\" Super Retina XDR, ProMotion 120Hz", "A19 Pro Chip, 6-Core GPU", "48MP Fusion + 48MP Ultra-Wide + 12MP Telephoto 5x", "Titanium Frame, Ceramic Shield Front", "USB-C, Wi-Fi 7, 5G", "Action Button, Camera Control"],
     "condition": "Brand New — Factory Sealed"},
    {"title": "Google Pixel 10 Pro", "description": "Google Pixel 10 Pro 256GB — Tensor G5, AI-First Camera, 7 Years Updates", "retail_price": 1099.00, "duration": 480, "category": "phones",
     "features": ["6.7\" LTPO OLED, 1-120Hz, 2400 nits", "Google Tensor G5 Processor", "50MP Main + 48MP Ultra-Wide + 48MP Telephoto 5x", "AI Magic Eraser, Best Take, Night Sight", "7 Years OS & Security Updates", "5000mAh Battery, 45W Charging"],
     "condition": "Brand New — Factory Sealed"},
    # Gaming
    {"title": "Nintendo Switch 2", "description": "Nintendo Switch 2 Console — 8\" LCD, Magnetic Joy-Cons, Backwards Compatible", "retail_price": 449.00, "duration": 480, "category": "gaming",
     "features": ["8\" 1080p LCD Display", "NVIDIA Custom Processor", "Magnetic Joy-Con 2 Controllers", "Backwards Compatible with Switch Games", "64GB Internal Storage, microSD Slot", "USB-C Dock for 4K TV Output"],
     "condition": "Brand New — Factory Sealed"},
    {"title": "PlayStation 5 Pro", "description": "Sony PS5 Pro 2TB — Enhanced GPU, 8K Output, DualSense Edge Controller", "retail_price": 799.00, "duration": 540, "category": "gaming",
     "features": ["Enhanced GPU with Ray Tracing", "2TB SSD Ultra-Fast Storage", "8K Video Output Support", "DualSense Edge Wireless Controller", "Tempest 3D Audio Engine", "4K Gaming at 120fps"],
     "condition": "Brand New — Factory Sealed"},
    # Audio
    {"title": "AirPods Pro 3", "description": "Apple AirPods Pro 3 — H3 Chip, Adaptive Audio, USB-C MagSafe Case", "retail_price": 299.00, "duration": 300, "category": "audio",
     "features": ["Apple H3 Chip for Intelligent Audio", "Adaptive Noise Cancellation", "Personalized Spatial Audio with Head Tracking", "USB-C MagSafe Charging Case", "Up to 6h Listening, 30h with Case", "IP54 Dust & Water Resistant"],
     "condition": "Brand New — Factory Sealed"},
    {"title": "Sony WH-1000XM6", "description": "Sony WH-1000XM6 Wireless — Best-in-class ANC, 40h Battery, LDAC Hi-Res", "retail_price": 399.00, "duration": 360, "category": "audio",
     "features": ["Industry-Leading Noise Cancellation", "40h Battery Life, 3min Quick Charge = 3h", "LDAC Hi-Res Audio, DSEE Extreme", "Multipoint Connection (2 Devices)", "Speak-to-Chat & Adaptive Sound Control", "Ultra Lightweight 250g, Premium Comfort"],
     "condition": "Brand New — Factory Sealed"},
    # Wearables
    {"title": "Apple Watch Ultra 3", "description": "Apple Watch Ultra 3 — Titanium, Satellite SOS, 72h Battery, S10 Chip", "retail_price": 899.00, "duration": 420, "category": "wearables",
     "features": ["49mm Titanium Case, Sapphire Crystal", "Apple S10 Chip, Double Tap Gesture", "72h Battery, 36h Normal Use", "Satellite Emergency SOS", "100m Water Resistant, EN13319 Dive", "Precision Dual-Frequency GPS"],
     "condition": "Brand New — Factory Sealed"},
    {"title": "Samsung Galaxy Ring 2", "description": "Samsung Galaxy Ring 2 — Health Tracking, Sleep Analysis, Titanium, 7-Day Battery", "retail_price": 449.00, "duration": 300, "category": "wearables",
     "features": ["Titanium Build, 2.6g Ultra-Light", "Heart Rate & SpO2 Monitoring 24/7", "Advanced Sleep & Stress Tracking", "Cycle Tracking & Skin Temperature", "7-Day Battery, Wireless Charging Case", "IP68 + 10ATM Water Resistant"],
     "condition": "Brand New — Factory Sealed"},
    # Laptops & Tablets
    {"title": "MacBook Pro 16\" M5 Pro", "description": "Apple MacBook Pro 16\" M5 Pro — 18GB RAM, 512GB SSD, Liquid Retina XDR", "retail_price": 2899.00, "duration": 720, "category": "laptops",
     "features": ["16.2\" Liquid Retina XDR, 3456x2234", "Apple M5 Pro, 12-Core CPU, 18-Core GPU", "18GB Unified Memory, 512GB SSD", "Up to 22h Battery Life", "Thunderbolt 5, HDMI 2.1, SD Card Slot", "6-Speaker Sound System, Spatial Audio"],
     "condition": "Brand New — Factory Sealed"},
    {"title": "iPad Pro 13\" M5", "description": "Apple iPad Pro 13\" M5 — Tandem OLED, Apple Pencil 3, Thunderbolt 5", "retail_price": 1399.00, "duration": 540, "category": "tablets",
     "features": ["13\" Tandem OLED, 2752x2064, ProMotion", "Apple M5 Chip, Hardware Ray Tracing", "Apple Pencil 3 & Magic Keyboard Support", "Thunderbolt 5 / USB 4", "12MP Ultra-Wide Front, LiDAR Scanner", "Face ID, Wi-Fi 7, 5G Optional"],
     "condition": "Brand New — Factory Sealed"},
    # XR / Smart Home
    {"title": "Meta Quest 4", "description": "Meta Quest 4 — Mixed Reality, Snapdragon XR3, 4K per Eye, 256GB", "retail_price": 549.00, "duration": 420, "category": "xr",
     "features": ["Snapdragon XR3 Gen 1 Processor", "4K per Eye, Pancake Lens 2.0", "Full-Color Mixed Reality Passthrough", "256GB Storage, Wi-Fi 7", "Hand Tracking 3.0, Eye Tracking", "Meta Horizon OS, 1000+ Apps & Games"],
     "condition": "Brand New — Factory Sealed"},
    {"title": "Dyson Airstrait Pro", "description": "Dyson Airstrait Pro — Wet-to-Dry Straightener, Intelligent Heat Control", "retail_price": 549.00, "duration": 360, "category": "home",
     "features": ["Wet-to-Dry Straightening Technology", "Intelligent Heat Control Every 100x/sec", "Flexing Plates for Root-to-Tip Styling", "3 Heat Settings + Cool Mode", "Dual Airflow Jets for Fast Drying", "360° Swivel Cable, Heat-Resistant Case"],
     "condition": "Brand New — Factory Sealed"},
]


# ── Seed demo auctions ──
async def seed_demo_auctions():
    """Seed auctions from product catalog if none exist."""
    count = await db.auctions.count_documents({"status": "active"})
    if count > 0:
        return

    now = datetime.now(timezone.utc)
    # Pick first 6 products for initial seed
    for d in PRODUCT_CATALOG[:6]:
        auction_id = secrets.token_hex(8)
        ends_at = (now + timedelta(seconds=d["duration"])).isoformat()
        auction = {
            "auction_id": auction_id,
            "title": d["title"],
            "description": d["description"],
            "image_url": PRODUCT_IMAGES.get(d["title"], ""),
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
            "category": d.get("category", ""),
            "features": d.get("features", []),
            "condition": d.get("condition", "Brand New — Factory Sealed"),
        }
        await db.auctions.insert_one(auction)
        auction.pop("_id", None)


# ── Admin: Refresh product auctions ──
@router.post("/admin/refresh")
async def refresh_auctions(request: Request):
    """Admin: End all active auctions and launch fresh ones from catalog."""
    user = await get_current_user(request)
    if user.get("role") not in ("admin",):
        raise HTTPException(status_code=403, detail="Admin only")

    now = datetime.now(timezone.utc)
    now_iso = now.isoformat()

    # End all active auctions
    await db.auctions.update_many(
        {"status": "active"},
        {"$set": {"status": "ended", "ended_at": now_iso}},
    )

    # Create new auctions from full catalog
    created = []
    for d in PRODUCT_CATALOG:
        auction_id = secrets.token_hex(8)
        ends_at = (now + timedelta(seconds=d["duration"])).isoformat()
        auction = {
            "auction_id": auction_id,
            "title": d["title"],
            "description": d["description"],
            "image_url": PRODUCT_IMAGES.get(d["title"], ""),
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
            "created_by": str(user["_id"]),
            "created_at": now_iso,
            "category": d.get("category", ""),
            "features": d.get("features", []),
            "condition": d.get("condition", "Brand New — Factory Sealed"),
        }
        await db.auctions.insert_one(auction)
        auction.pop("_id", None)
        created.append(auction["auction_id"])

    return {"refreshed": len(created), "auction_ids": created}


# ── Admin: Get product catalog ──
@router.get("/admin/catalog")
async def get_catalog(request: Request):
    """Admin: View the current product catalog."""
    user = await get_current_user(request)
    if user.get("role") not in ("admin",):
        raise HTTPException(status_code=403, detail="Admin only")
    return {"products": PRODUCT_CATALOG, "total": len(PRODUCT_CATALOG)}
