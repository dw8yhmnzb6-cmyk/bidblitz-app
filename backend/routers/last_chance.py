"""
Last Chance Auctions & Ending Soon - Auktionen die bald enden
"""
from fastapi import APIRouter, Depends
from datetime import datetime, timezone, timedelta

from config import db
from dependencies import get_current_user

router = APIRouter(prefix="/last-chance", tags=["last-chance"])


@router.get("/auctions")
async def get_last_chance_auctions(minutes: int = 5):
    """Get auctions ending within specified minutes"""
    now = datetime.now(timezone.utc)
    cutoff = now + timedelta(minutes=minutes)
    
    # Find auctions ending soon
    auctions = await db.auctions.find({
        "status": "active",
        "end_time": {
            "$gte": now.isoformat(),
            "$lte": cutoff.isoformat()
        }
    }, {"_id": 0}).sort("end_time", 1).to_list(20)
    
    # Enrich with product data
    result = []
    for auction in auctions:
        product = await db.products.find_one(
            {"id": auction.get("product_id")},
            {"_id": 0, "name": 1, "retail_price": 1, "image_url": 1}
        )
        
        if product:
            # Calculate remaining seconds
            try:
                end_time = datetime.fromisoformat(auction["end_time"].replace('Z', '+00:00'))
                remaining = int((end_time - now).total_seconds())
            except:
                remaining = 0
            
            result.append({
                **auction,
                "product": product,
                "remaining_seconds": remaining,
                "is_last_chance": remaining <= 300,  # < 5 min
                "is_final_moments": remaining <= 60   # < 1 min
            })
    
    return {
        "auctions": result,
        "count": len(result),
        "cutoff_minutes": minutes
    }


@router.get("/ending-soon")
async def get_ending_soon_auctions():
    """Get auctions ending in different time brackets"""
    now = datetime.now(timezone.utc)
    
    brackets = {
        "under_1_min": [],
        "under_5_min": [],
        "under_15_min": [],
        "under_1_hour": []
    }
    
    # Get all active auctions
    auctions = await db.auctions.find({
        "status": "active",
        "end_time": {"$gte": now.isoformat()}
    }, {"_id": 0}).sort("end_time", 1).to_list(100)
    
    for auction in auctions:
        try:
            end_time = datetime.fromisoformat(auction["end_time"].replace('Z', '+00:00'))
            remaining = (end_time - now).total_seconds()
            
            product = await db.products.find_one(
                {"id": auction.get("product_id")},
                {"_id": 0, "name": 1, "retail_price": 1, "image_url": 1}
            )
            
            if not product:
                continue
                
            auction_data = {
                **auction,
                "product": product,
                "remaining_seconds": int(remaining)
            }
            
            if remaining <= 60:
                brackets["under_1_min"].append(auction_data)
            elif remaining <= 300:
                brackets["under_5_min"].append(auction_data)
            elif remaining <= 900:
                brackets["under_15_min"].append(auction_data)
            elif remaining <= 3600:
                brackets["under_1_hour"].append(auction_data)
                
        except:
            continue
    
    return {
        "brackets": brackets,
        "total_ending_soon": sum(len(b) for b in brackets.values())
    }


@router.get("/hot")
async def get_hot_auctions():
    """Get 'hot' auctions - most bids in last 5 minutes"""
    now = datetime.now(timezone.utc)
    five_min_ago = now - timedelta(minutes=5)
    
    # Get active auctions
    auctions = await db.auctions.find({
        "status": "active",
        "end_time": {"$gte": now.isoformat()}
    }, {"_id": 0}).to_list(100)
    
    hot_auctions = []
    
    for auction in auctions:
        # Count recent bids
        recent_bids = await db.bids.count_documents({
            "auction_id": auction["id"],
            "created_at": {"$gte": five_min_ago.isoformat()}
        })
        
        if recent_bids >= 3:  # At least 3 bids in 5 min = hot
            product = await db.products.find_one(
                {"id": auction.get("product_id")},
                {"_id": 0, "name": 1, "retail_price": 1, "image_url": 1}
            )
            
            if product:
                try:
                    end_time = datetime.fromisoformat(auction["end_time"].replace('Z', '+00:00'))
                    remaining = int((end_time - now).total_seconds())
                except:
                    remaining = 0
                
                hot_auctions.append({
                    **auction,
                    "product": product,
                    "recent_bids": recent_bids,
                    "remaining_seconds": remaining,
                    "heat_level": "fire" if recent_bids >= 10 else "hot" if recent_bids >= 5 else "warm"
                })
    
    # Sort by recent bids
    hot_auctions.sort(key=lambda x: x["recent_bids"], reverse=True)
    
    return {
        "hot_auctions": hot_auctions[:10],
        "count": len(hot_auctions)
    }


last_chance_router = router
