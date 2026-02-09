"""
Mystery Box Router - Blind auctions with surprise products
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone, timedelta
from bson import ObjectId
import random

router = APIRouter(prefix="/mystery-box", tags=["Mystery Box"])

# Mystery box tiers with value ranges
MYSTERY_TIERS = {
    "bronze": {
        "name": "Bronze Box",
        "emoji": "🥉",
        "min_value": 50,
        "max_value": 150,
        "color": "#CD7F32",
        "entry_bids": 5
    },
    "silver": {
        "name": "Silber Box",
        "emoji": "🥈",
        "min_value": 150,
        "max_value": 400,
        "color": "#C0C0C0",
        "entry_bids": 15
    },
    "gold": {
        "name": "Gold Box",
        "emoji": "🥇",
        "min_value": 400,
        "max_value": 1000,
        "color": "#FFD700",
        "entry_bids": 30
    },
    "diamond": {
        "name": "Diamant Box",
        "emoji": "💎",
        "min_value": 1000,
        "max_value": 5000,
        "color": "#B9F2FF",
        "entry_bids": 100
    }
}

# Possible hints for mystery boxes
MYSTERY_HINTS = [
    "Perfekt für Technik-Fans",
    "Macht dein Zuhause schöner",
    "Ideal für unterwegs",
    "Ein echtes Highlight",
    "Überraschung des Monats",
    "Limitierte Edition",
    "Bestseller-Produkt",
    "Premium-Qualität"
]

class CreateMysteryBoxRequest(BaseModel):
    tier: str  # bronze, silver, gold, diamond
    duration_hours: int = 24
    hint: Optional[str] = None

class RevealVoteRequest(BaseModel):
    vote: str  # "reveal" or "keep_mystery"

@router.get("/tiers")
async def get_mystery_tiers():
    """Get all mystery box tiers and their details"""
    return MYSTERY_TIERS

@router.get("/active")
async def get_active_mystery_boxes():
    """Get all active mystery box auctions"""
    from server import db
    
    boxes = await db.mystery_boxes.find({
        "status": "active",
        "end_time": {"$gt": datetime.now(timezone.utc).isoformat()}
    }).sort("end_time", 1).to_list(20)
    
    for box in boxes:
        box["id"] = str(box.pop("_id"))
        box["tier_info"] = MYSTERY_TIERS.get(box.get("tier"), MYSTERY_TIERS["bronze"])
        
        # Calculate time remaining
        end_time = datetime.fromisoformat(box["end_time"].replace("Z", "+00:00"))
        time_remaining = max(0, (end_time - datetime.now(timezone.utc)).total_seconds())
        box["time_remaining"] = int(time_remaining)
        
        # Hide actual product info
        if "product" in box and not box.get("revealed"):
            box["product"] = {
                "name": "??? Mystery Produkt ???",
                "image_url": None,
                "category": "Mystery"
            }
    
    return boxes

@router.get("/{box_id}")
async def get_mystery_box(box_id: str):
    """Get mystery box details"""
    from server import db
    
    box = await db.mystery_boxes.find_one({"_id": ObjectId(box_id)})
    if not box:
        raise HTTPException(status_code=404, detail="Mystery Box nicht gefunden")
    
    box["id"] = str(box.pop("_id"))
    box["tier_info"] = MYSTERY_TIERS.get(box.get("tier"), MYSTERY_TIERS["bronze"])
    
    # Calculate time remaining
    if box.get("end_time"):
        end_time = datetime.fromisoformat(box["end_time"].replace("Z", "+00:00"))
        time_remaining = max(0, (end_time - datetime.now(timezone.utc)).total_seconds())
        box["time_remaining"] = int(time_remaining)
    
    # Only show product if revealed or auction ended
    if not box.get("revealed") and box.get("status") == "active":
        actual_product = box.get("product", {})
        box["product"] = {
            "name": "??? Mystery Produkt ???",
            "image_url": None,
            "category": "Mystery",
            "value_hint": f"Wert: €{box['tier_info']['min_value']} - €{box['tier_info']['max_value']}"
        }
        box["actual_product_hidden"] = True
    
    # Get bid history
    bids = await db.mystery_bids.find({
        "box_id": box_id
    }).sort("created_at", -1).limit(10).to_list(10)
    
    for bid in bids:
        bid["id"] = str(bid.pop("_id"))
    
    box["recent_bids"] = bids
    
    return box

@router.post("/{box_id}/bid")
async def bid_on_mystery_box(box_id: str):
    """Place a bid on a mystery box"""
    from server import db
    
    box = await db.mystery_boxes.find_one({"_id": ObjectId(box_id)})
    if not box:
        raise HTTPException(status_code=404, detail="Mystery Box nicht gefunden")
    
    if box.get("status") != "active":
        raise HTTPException(status_code=400, detail="Diese Mystery Box ist nicht mehr aktiv")
    
    # Check if ended
    end_time = datetime.fromisoformat(box["end_time"].replace("Z", "+00:00"))
    if datetime.now(timezone.utc) >= end_time:
        raise HTTPException(status_code=400, detail="Auktion ist beendet")
    
    # Place bid
    new_price = box.get("current_price", 0) + 0.01
    bidder_name = f"Bieter_{random.randint(100, 999)}"
    
    # Record bid
    bid = {
        "box_id": box_id,
        "bidder_name": bidder_name,
        "price": round(new_price, 2),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.mystery_bids.insert_one(bid)
    
    # Update box
    await db.mystery_boxes.update_one(
        {"_id": ObjectId(box_id)},
        {
            "$set": {
                "current_price": round(new_price, 2),
                "last_bidder": bidder_name
            },
            "$inc": {"total_bids": 1}
        }
    )
    
    return {
        "success": True,
        "new_price": round(new_price, 2),
        "message": "Gebot platziert! 🎁",
        "hint": random.choice(MYSTERY_HINTS) if random.random() > 0.7 else None
    }

@router.post("/{box_id}/reveal-vote")
async def vote_to_reveal(box_id: str, data: RevealVoteRequest):
    """Vote to reveal the mystery product early"""
    from server import db
    
    box = await db.mystery_boxes.find_one({"_id": ObjectId(box_id)})
    if not box:
        raise HTTPException(status_code=404, detail="Mystery Box nicht gefunden")
    
    # Record vote
    vote_field = "reveal_votes" if data.vote == "reveal" else "mystery_votes"
    
    await db.mystery_boxes.update_one(
        {"_id": ObjectId(box_id)},
        {"$inc": {vote_field: 1}}
    )
    
    # Check if enough votes to reveal (e.g., 10 votes)
    reveal_votes = box.get("reveal_votes", 0) + (1 if data.vote == "reveal" else 0)
    if reveal_votes >= 10 and not box.get("revealed"):
        await db.mystery_boxes.update_one(
            {"_id": ObjectId(box_id)},
            {"$set": {"revealed": True}}
        )
        return {
            "success": True,
            "revealed": True,
            "message": "🎉 Die Mystery Box wurde enthüllt!"
        }
    
    return {
        "success": True,
        "revealed": False,
        "reveal_votes": reveal_votes,
        "votes_needed": 10 - reveal_votes,
        "message": f"Stimme gezählt! Noch {10 - reveal_votes} Stimmen bis zur Enthüllung."
    }

@router.get("/{box_id}/reveal")
async def reveal_mystery_box(box_id: str):
    """Reveal the mystery box content (only for winner or after auction ends)"""
    from server import db
    
    box = await db.mystery_boxes.find_one({"_id": ObjectId(box_id)})
    if not box:
        raise HTTPException(status_code=404, detail="Mystery Box nicht gefunden")
    
    # Check if auction ended
    end_time = datetime.fromisoformat(box["end_time"].replace("Z", "+00:00"))
    if datetime.now(timezone.utc) < end_time and not box.get("revealed"):
        raise HTTPException(status_code=400, detail="Mystery Box kann noch nicht enthüllt werden")
    
    # Return actual product
    product = box.get("product", {})
    tier_info = MYSTERY_TIERS.get(box.get("tier"), MYSTERY_TIERS["bronze"])
    
    return {
        "box_id": box_id,
        "revealed": True,
        "product": product,
        "tier": box.get("tier"),
        "tier_info": tier_info,
        "final_price": box.get("current_price", 0),
        "winner": box.get("last_bidder"),
        "total_bids": box.get("total_bids", 0),
        "savings": product.get("retail_price", 0) - box.get("current_price", 0),
        "reveal_animation": "confetti"  # Frontend can use this for effects
    }

@router.get("/history/wins")
async def get_mystery_wins():
    """Get recent mystery box wins to show what people won"""
    from server import db
    
    wins = await db.mystery_boxes.find({
        "status": "ended",
        "last_bidder": {"$ne": None}
    }).sort("end_time", -1).limit(10).to_list(10)
    
    results = []
    for box in wins:
        product = box.get("product", {})
        tier_info = MYSTERY_TIERS.get(box.get("tier"), MYSTERY_TIERS["bronze"])
        
        results.append({
            "id": str(box["_id"]),
            "tier": box.get("tier"),
            "tier_emoji": tier_info["emoji"],
            "product_name": product.get("name", "Mystery Produkt"),
            "product_image": product.get("image_url"),
            "retail_value": product.get("retail_price", 0),
            "won_for": box.get("current_price", 0),
            "winner": box.get("last_bidder"),
            "savings_percent": round((1 - box.get("current_price", 0) / max(1, product.get("retail_price", 1))) * 100)
        })
    
    return results
