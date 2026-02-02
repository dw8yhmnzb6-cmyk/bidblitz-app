"""Excitement Features Router - Jackpot, Lucky Bid, Happy Hour, Turbo, Duel, Sniper"""
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone, timedelta
from pydantic import BaseModel
from typing import Optional, List
import uuid
import random

from config import db, logger
from dependencies import get_current_user, get_admin_user

router = APIRouter(prefix="/excitement", tags=["Excitement Features"])

# ==================== CONFIGURATION ====================

LUCKY_BID_INTERVAL = 50  # Every 50th bid wins
LUCKY_BID_REWARD = 10  # Free bids reward
HAPPY_HOUR_MULTIPLIER = 2.0  # Double bids during happy hour
SNIPER_THRESHOLD_SECONDS = 5  # Last 5 seconds = sniper
DUEL_THRESHOLD_BIDS = 5  # 5+ alternating bids = duel

# Happy Hour Schedule (UTC)
HAPPY_HOURS = [
    {"start": 12, "end": 13},  # 12:00-13:00 UTC
    {"start": 18, "end": 19},  # 18:00-19:00 UTC
    {"start": 21, "end": 22},  # 21:00-22:00 UTC
]

# ==================== SCHEMAS ====================

class JackpotAuctionCreate(BaseModel):
    auction_id: str
    initial_jackpot: int = 100  # Starting jackpot bids
    bid_contribution: int = 1  # Bids added per bid

class TurboAuctionCreate(BaseModel):
    product_id: str
    duration_seconds: int = 30  # Ultra-short duration

class MysteryAuctionCreate(BaseModel):
    product_id: str
    hint: str = "Wert: €100-€500"
    reveal_at_end: bool = True

# ==================== GLOBAL JACKPOT SYSTEM ====================

@router.get("/global-jackpot")
async def get_global_jackpot():
    """Get the global jackpot status - visible to everyone"""
    jackpot = await db.global_jackpot.find_one({"type": "global"}, {"_id": 0})
    if not jackpot:
        # Create default if not exists
        jackpot = {
            "id": "global-jackpot",
            "type": "global",
            "current_amount": 500,
            "contribution_per_bid": 1,
            "last_winner": None,
            "last_won_at": None,
            "total_won": 0
        }
        await db.global_jackpot.insert_one(jackpot)
    
    return {
        "current_amount": jackpot.get("current_amount", 0),
        "contribution_per_bid": jackpot.get("contribution_per_bid", 1),
        "last_winner": jackpot.get("last_winner"),
        "last_won_at": jackpot.get("last_won_at"),
        "total_won": jackpot.get("total_won", 0),
        "message": f"🏆 JACKPOT: {jackpot.get('current_amount', 0)} Gratis-Gebote!"
    }

@router.post("/global-jackpot/contribute")
async def contribute_to_global_jackpot(user: dict = Depends(get_current_user)):
    """Called when someone places a bid - increases the global jackpot"""
    result = await db.global_jackpot.find_one_and_update(
        {"type": "global"},
        {"$inc": {"current_amount": 1}},
        return_document=True
    )
    
    if result:
        new_amount = result.get("current_amount", 0)
        logger.info(f"Global jackpot increased to {new_amount} by {user.get('name', 'Unknown')}")
        return {"success": True, "new_amount": new_amount}
    
    return {"success": False}

@router.post("/global-jackpot/award/{user_id}")
async def award_global_jackpot(user_id: str, admin: dict = Depends(get_admin_user)):
    """Award the global jackpot to a user (Admin only - called when auction ends)"""
    jackpot = await db.global_jackpot.find_one({"type": "global"})
    if not jackpot:
        raise HTTPException(status_code=404, detail="Jackpot nicht gefunden")
    
    amount = jackpot.get("current_amount", 0)
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Jackpot ist leer")
    
    # Get winner info
    winner = await db.users.find_one({"id": user_id})
    if not winner:
        raise HTTPException(status_code=404, detail="Benutzer nicht gefunden")
    
    # Award bids to winner
    await db.users.update_one(
        {"id": user_id},
        {"$inc": {"bids_balance": amount}}
    )
    
    # Reset jackpot and record winner
    await db.global_jackpot.update_one(
        {"type": "global"},
        {
            "$set": {
                "current_amount": 100,  # Reset to 100 starting
                "last_winner": winner.get("name", "Unknown"),
                "last_winner_id": user_id,
                "last_won_at": datetime.now(timezone.utc).isoformat(),
                "last_won_amount": amount
            },
            "$inc": {"total_won": amount}
        }
    )
    
    # Log in jackpot history
    await db.jackpot_history.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "user_name": winner.get("name", "Unknown"),
        "amount": amount,
        "won_at": datetime.now(timezone.utc).isoformat()
    })
    
    logger.info(f"🏆 JACKPOT WON! {winner.get('name')} won {amount} free bids!")
    
    return {
        "success": True,
        "winner": winner.get("name"),
        "amount": amount,
        "message": f"🏆 {winner.get('name')} hat den Jackpot von {amount} Geboten gewonnen!"
    }

@router.get("/global-jackpot/history")
async def get_jackpot_history(limit: int = 10):
    """Get jackpot winner history"""
    history = await db.jackpot_history.find(
        {},
        {"_id": 0}
    ).sort("won_at", -1).to_list(limit)
    
    return {"winners": history}

@router.post("/global-jackpot/set")
async def set_global_jackpot(data: dict, admin: dict = Depends(get_admin_user)):
    """Set the global jackpot amount (Admin only)"""
    amount = data.get("amount", 500)
    
    await db.global_jackpot.update_one(
        {"type": "global"},
        {"$set": {"current_amount": amount}},
        upsert=True
    )
    
    logger.info(f"Admin set global jackpot to {amount}")
    return {"success": True, "new_amount": amount}

# ==================== JACKPOT SYSTEM ====================

@router.get("/jackpot/active")
async def get_active_jackpots():
    """Get all active jackpot auctions"""
    jackpots = await db.jackpot_auctions.find(
        {"is_active": True},
        {"_id": 0}
    ).to_list(50)
    
    # Enrich with auction data
    for jp in jackpots:
        auction = await db.auctions.find_one(
            {"id": jp["auction_id"]},
            {"_id": 0, "title": 1, "current_price": 1, "image_url": 1, "ends_at": 1}
        )
        if auction:
            jp["auction"] = auction
    
    return {"jackpots": jackpots}

@router.get("/jackpot/{auction_id}")
async def get_jackpot_status(auction_id: str):
    """Get jackpot status for an auction"""
    jackpot = await db.jackpot_auctions.find_one(
        {"auction_id": auction_id},
        {"_id": 0}
    )
    if not jackpot:
        return {"has_jackpot": False}
    
    return {
        "has_jackpot": True,
        "current_jackpot": jackpot.get("current_jackpot", 0),
        "total_contributions": jackpot.get("total_contributions", 0),
        "winner_gets": f"{jackpot.get('current_jackpot', 0)} Gratis-Gebote"
    }

@router.post("/jackpot/contribute/{auction_id}")
async def contribute_to_jackpot(auction_id: str):
    """Called when someone bids on a jackpot auction - increases the jackpot"""
    jackpot = await db.jackpot_auctions.find_one({"auction_id": auction_id})
    if not jackpot:
        return {"contributed": False}
    
    contribution = jackpot.get("bid_contribution", 1)
    
    await db.jackpot_auctions.update_one(
        {"auction_id": auction_id},
        {
            "$inc": {
                "current_jackpot": contribution,
                "total_contributions": 1
            }
        }
    )
    
    updated = await db.jackpot_auctions.find_one({"auction_id": auction_id}, {"_id": 0})
    return {
        "contributed": True,
        "new_jackpot": updated.get("current_jackpot", 0)
    }

@router.post("/jackpot/create")
async def create_jackpot_auction(data: JackpotAuctionCreate, admin: dict = Depends(get_admin_user)):
    """Create a jackpot auction (Admin only)"""
    # Check auction exists
    auction = await db.auctions.find_one({"id": data.auction_id})
    if not auction:
        raise HTTPException(status_code=404, detail="Auktion nicht gefunden")
    
    jackpot = {
        "id": str(uuid.uuid4()),
        "auction_id": data.auction_id,
        "initial_jackpot": data.initial_jackpot,
        "current_jackpot": data.initial_jackpot,
        "bid_contribution": data.bid_contribution,
        "total_contributions": 0,
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.jackpot_auctions.insert_one(jackpot)
    
    # Mark auction as jackpot
    await db.auctions.update_one(
        {"id": data.auction_id},
        {"$set": {"is_jackpot": True, "jackpot_id": jackpot["id"]}}
    )
    
    logger.info(f"Jackpot auction created for {data.auction_id} with {data.initial_jackpot} initial bids")
    return {"success": True, "jackpot": {k: v for k, v in jackpot.items() if k != "_id"}}

# ==================== LUCKY BID SYSTEM ====================

@router.get("/lucky-bid/status")
async def get_lucky_bid_status():
    """Get current lucky bid counter"""
    stats = await db.lucky_bid_stats.find_one({"type": "global"})
    if not stats:
        stats = {"total_bids": 0, "next_lucky": LUCKY_BID_INTERVAL}
    
    bids_until_lucky = LUCKY_BID_INTERVAL - (stats.get("total_bids", 0) % LUCKY_BID_INTERVAL)
    
    return {
        "total_bids_today": stats.get("total_bids", 0),
        "bids_until_lucky": bids_until_lucky,
        "lucky_bid_reward": LUCKY_BID_REWARD,
        "interval": LUCKY_BID_INTERVAL
    }

@router.post("/lucky-bid/check")
async def check_lucky_bid(user: dict = Depends(get_current_user)):
    """Check if current bid is a lucky bid and award bonus"""
    stats = await db.lucky_bid_stats.find_one({"type": "global"})
    total_bids = stats.get("total_bids", 0) if stats else 0
    
    # Increment counter
    await db.lucky_bid_stats.update_one(
        {"type": "global"},
        {"$inc": {"total_bids": 1}},
        upsert=True
    )
    
    new_total = total_bids + 1
    is_lucky = new_total % LUCKY_BID_INTERVAL == 0
    
    if is_lucky:
        # Award bonus bids
        await db.users.update_one(
            {"id": user["id"]},
            {"$inc": {"bids_balance": LUCKY_BID_REWARD}}
        )
        
        # Log lucky bid
        await db.lucky_bid_history.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": user["id"],
            "user_name": user.get("name", "Unknown"),
            "bid_number": new_total,
            "reward": LUCKY_BID_REWARD,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        
        logger.info(f"🎁 LUCKY BID! User {user['name']} won {LUCKY_BID_REWARD} free bids on bid #{new_total}")
        
        return {
            "is_lucky": True,
            "reward": LUCKY_BID_REWARD,
            "message": f"🎉 LUCKY BID! Sie haben {LUCKY_BID_REWARD} Gratis-Gebote gewonnen!",
            "bid_number": new_total
        }
    
    return {
        "is_lucky": False,
        "bids_until_lucky": LUCKY_BID_INTERVAL - (new_total % LUCKY_BID_INTERVAL)
    }

@router.get("/lucky-bid/history")
async def get_lucky_bid_history(limit: int = 20):
    """Get recent lucky bid winners"""
    history = await db.lucky_bid_history.find(
        {},
        {"_id": 0}
    ).sort("created_at", -1).to_list(limit)
    
    return {"winners": history}

# ==================== HAPPY HOUR ====================

@router.get("/happy-hour/status")
async def get_happy_hour_status():
    """Check if happy hour is currently active"""
    now = datetime.now(timezone.utc)
    current_hour = now.hour
    
    is_active = False
    current_session = None
    next_session = None
    
    for hh in HAPPY_HOURS:
        if hh["start"] <= current_hour < hh["end"]:
            is_active = True
            current_session = hh
            break
    
    # Find next happy hour
    if not is_active:
        for hh in sorted(HAPPY_HOURS, key=lambda x: x["start"]):
            if hh["start"] > current_hour:
                next_session = hh
                break
        if not next_session:
            next_session = HAPPY_HOURS[0]  # Tomorrow's first
    
    # Calculate time remaining/until
    if is_active:
        end_time = now.replace(hour=current_session["end"], minute=0, second=0)
        remaining_seconds = (end_time - now).total_seconds()
    else:
        if next_session["start"] > current_hour:
            start_time = now.replace(hour=next_session["start"], minute=0, second=0)
        else:
            start_time = (now + timedelta(days=1)).replace(hour=next_session["start"], minute=0, second=0)
        remaining_seconds = (start_time - now).total_seconds()
    
    return {
        "is_active": is_active,
        "multiplier": HAPPY_HOUR_MULTIPLIER if is_active else 1.0,
        "bonus_text": "🔥 HAPPY HOUR! Doppelte Gebote beim Kauf!" if is_active else None,
        "remaining_seconds": int(remaining_seconds) if is_active else None,
        "next_happy_hour_in": int(remaining_seconds) if not is_active else None,
        "schedule": HAPPY_HOURS
    }

# ==================== TURBO AUCTIONS ====================

@router.get("/turbo/active")
async def get_turbo_auctions():
    """Get all active turbo (30-second) auctions"""
    auctions = await db.auctions.find(
        {
            "is_turbo": True,
            "status": "active"
        },
        {"_id": 0}
    ).to_list(20)
    
    return {"turbo_auctions": auctions}

@router.post("/turbo/create")
async def create_turbo_auction(data: TurboAuctionCreate, admin: dict = Depends(get_admin_user)):
    """Create a turbo auction (Admin only)"""
    product = await db.products.find_one({"id": data.product_id})
    if not product:
        raise HTTPException(status_code=404, detail="Produkt nicht gefunden")
    
    auction = {
        "id": str(uuid.uuid4()),
        "product_id": data.product_id,
        "title": f"⚡ TURBO: {product['name']}",
        "description": product.get("description", ""),
        "image_url": product.get("image_url", ""),
        "retail_price": product.get("retail_price", 0),
        "starting_price": 0,
        "current_price": 0,
        "bid_increment": 0.01,
        "timer_seconds": data.duration_seconds,
        "timer_increment": 5,  # Only 5 seconds added per bid
        "status": "scheduled",
        "is_turbo": True,
        "is_featured": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.auctions.insert_one(auction)
    logger.info(f"⚡ Turbo auction created: {auction['title']}")
    
    return {"success": True, "auction": {k: v for k, v in auction.items() if k != "_id"}}

# ==================== MYSTERY AUCTIONS ====================

@router.get("/mystery/active")
async def get_mystery_auctions():
    """Get all active mystery auctions"""
    auctions = await db.auctions.find(
        {
            "is_mystery": True,
            "status": "active"
        },
        {"_id": 0}
    ).to_list(20)
    
    # Hide actual product details for mystery auctions
    for auction in auctions:
        if not auction.get("is_revealed", False):
            auction["title"] = "🎲 MYSTERY AUKTION"
            auction["image_url"] = "/mystery-box.png"
            auction["description"] = auction.get("mystery_hint", "Was verbirgt sich hier?")
    
    return {"mystery_auctions": auctions}

@router.post("/mystery/create")
async def create_mystery_auction(data: MysteryAuctionCreate, admin: dict = Depends(get_admin_user)):
    """Create a mystery auction (Admin only)"""
    product = await db.products.find_one({"id": data.product_id})
    if not product:
        raise HTTPException(status_code=404, detail="Produkt nicht gefunden")
    
    auction = {
        "id": str(uuid.uuid4()),
        "product_id": data.product_id,
        "title": f"🎲 MYSTERY AUKTION",
        "real_title": product["name"],
        "description": data.hint,
        "real_description": product.get("description", ""),
        "image_url": "/mystery-box.png",
        "real_image_url": product.get("image_url", ""),
        "retail_price": product.get("retail_price", 0),
        "mystery_hint": data.hint,
        "starting_price": 0,
        "current_price": 0,
        "bid_increment": 0.01,
        "timer_seconds": 20,
        "timer_increment": 10,
        "status": "scheduled",
        "is_mystery": True,
        "is_revealed": False,
        "reveal_at_end": data.reveal_at_end,
        "is_featured": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.auctions.insert_one(auction)
    logger.info(f"🎲 Mystery auction created for product: {product['name']}")
    
    return {"success": True, "auction": {k: v for k, v in auction.items() if k != "_id"}}

@router.post("/mystery/reveal/{auction_id}")
async def reveal_mystery_auction(auction_id: str):
    """Reveal a mystery auction (called when auction ends)"""
    auction = await db.auctions.find_one({"id": auction_id, "is_mystery": True})
    if not auction:
        raise HTTPException(status_code=404, detail="Mystery-Auktion nicht gefunden")
    
    await db.auctions.update_one(
        {"id": auction_id},
        {"$set": {
            "is_revealed": True,
            "title": auction.get("real_title", auction["title"]),
            "description": auction.get("real_description", ""),
            "image_url": auction.get("real_image_url", auction["image_url"]),
            "revealed_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    logger.info(f"🎲 Mystery auction {auction_id} revealed!")
    return {"success": True, "message": "Mystery enthüllt!"}

# ==================== DUEL DETECTION ====================

@router.get("/duel/check/{auction_id}")
async def check_duel_status(auction_id: str):
    """Check if there's an active duel on an auction"""
    # Get recent bids
    recent_bids = await db.bids.find(
        {"auction_id": auction_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(20)
    
    if len(recent_bids) < DUEL_THRESHOLD_BIDS * 2:
        return {"is_duel": False}
    
    # Check for alternating bidders
    bidders = [b["user_id"] for b in recent_bids[:DUEL_THRESHOLD_BIDS * 2]]
    unique_recent = set(bidders[:DUEL_THRESHOLD_BIDS * 2])
    
    if len(unique_recent) == 2:
        # Only 2 bidders in last N bids = DUEL!
        bidder_names = []
        for uid in unique_recent:
            user = await db.users.find_one({"id": uid}, {"_id": 0, "name": 1})
            if user:
                bidder_names.append(user.get("name", "Unbekannt"))
        
        return {
            "is_duel": True,
            "duelers": bidder_names,
            "message": f"⚔️ DUELL: {bidder_names[0]} vs. {bidder_names[1]}!",
            "bid_count": DUEL_THRESHOLD_BIDS * 2
        }
    
    return {"is_duel": False}

# ==================== SNIPER DETECTION ====================

@router.post("/sniper/detect")
async def detect_sniper(auction_id: str, remaining_seconds: int, user: dict = Depends(get_current_user)):
    """Detect and alert about sniper bids"""
    is_sniper = remaining_seconds <= SNIPER_THRESHOLD_SECONDS
    
    if is_sniper:
        # Log sniper activity
        await db.sniper_alerts.insert_one({
            "id": str(uuid.uuid4()),
            "auction_id": auction_id,
            "sniper_user_id": user["id"],
            "sniper_name": user.get("name", "Unknown"),
            "remaining_seconds": remaining_seconds,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        
        return {
            "is_sniper": True,
            "alert": "⚠️ SNIPER ERKANNT!",
            "message": f"{user.get('name', 'Jemand')} versucht in letzter Sekunde zu bieten!",
            "defender_bonus": 2  # Defender gets 2 extra seconds
        }
    
    return {"is_sniper": False}

@router.get("/sniper/alerts/{auction_id}")
async def get_sniper_alerts(auction_id: str, limit: int = 10):
    """Get sniper alerts for an auction"""
    alerts = await db.sniper_alerts.find(
        {"auction_id": auction_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(limit)
    
    return {"alerts": alerts}

# ==================== COMBINED EXCITEMENT STATUS ====================

@router.get("/status")
async def get_all_excitement_status():
    """Get combined status of all excitement features"""
    # Happy Hour
    now = datetime.now(timezone.utc)
    current_hour = now.hour
    is_happy_hour = any(hh["start"] <= current_hour < hh["end"] for hh in HAPPY_HOURS)
    
    # Lucky Bid
    stats = await db.lucky_bid_stats.find_one({"type": "global"})
    total_bids = stats.get("total_bids", 0) if stats else 0
    bids_until_lucky = LUCKY_BID_INTERVAL - (total_bids % LUCKY_BID_INTERVAL)
    
    # Active counts
    jackpot_count = await db.jackpot_auctions.count_documents({"is_active": True})
    turbo_count = await db.auctions.count_documents({"is_turbo": True, "status": "active"})
    mystery_count = await db.auctions.count_documents({"is_mystery": True, "status": "active"})
    
    return {
        "happy_hour": {
            "is_active": is_happy_hour,
            "multiplier": HAPPY_HOUR_MULTIPLIER if is_happy_hour else 1.0
        },
        "lucky_bid": {
            "bids_until_lucky": bids_until_lucky,
            "reward": LUCKY_BID_REWARD
        },
        "active_counts": {
            "jackpot_auctions": jackpot_count,
            "turbo_auctions": turbo_count,
            "mystery_auctions": mystery_count
        },
        "features_enabled": {
            "jackpot": True,
            "lucky_bid": True,
            "happy_hour": True,
            "turbo": True,
            "mystery": True,
            "duel_detection": True,
            "sniper_alert": True
        }
    }
