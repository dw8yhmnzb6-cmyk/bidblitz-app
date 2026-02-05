"""Influencer Auctions - Influencers host exclusive auctions with signed items"""
from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime, timezone, timedelta
from typing import Optional
import uuid

from config import db, logger
from dependencies import get_current_user, get_admin_user

router = APIRouter(prefix="/influencer-auctions", tags=["Influencer Auctions"])

@router.get("/active")
async def get_active_influencer_auctions():
    """Get all active influencer-hosted auctions"""
    auctions = await db.auctions.find(
        {"status": "active", "is_influencer_auction": True},
        {"_id": 0}
    ).to_list(50)
    
    result = []
    for auction in auctions:
        product = await db.products.find_one(
            {"id": auction.get("product_id")},
            {"_id": 0}
        )
        
        influencer = await db.influencers.find_one(
            {"id": auction.get("influencer_id")},
            {"_id": 0, "name": 1, "handle": 1, "avatar_url": 1, "followers": 1, "platform": 1}
        )
        
        result.append({
            **auction,
            "product": product,
            "influencer": influencer
        })
    
    return {"auctions": result}

@router.get("/influencer/{influencer_id}")
async def get_influencer_profile(influencer_id: str):
    """Get influencer profile and their auctions"""
    influencer = await db.influencers.find_one(
        {"id": influencer_id},
        {"_id": 0}
    )
    
    if not influencer:
        raise HTTPException(status_code=404, detail="Influencer nicht gefunden")
    
    # Get their auctions
    auctions = await db.auctions.find(
        {"influencer_id": influencer_id},
        {"_id": 0}
    ).sort("created_at", -1).limit(20).to_list(20)
    
    # Enrich auctions with product info
    auction_list = []
    for auction in auctions:
        product = await db.products.find_one(
            {"id": auction.get("product_id")},
            {"_id": 0, "name": 1, "image_url": 1}
        )
        auction_list.append({
            **auction,
            "product_name": product.get("name") if product else "Produkt",
            "product_image": product.get("image_url") if product else None
        })
    
    # Get stats
    total_raised = await db.auction_history.aggregate([
        {"$match": {"influencer_id": influencer_id}},
        {"$group": {"_id": None, "total": {"$sum": "$final_price"}}}
    ]).to_list(1)
    
    total_amount = total_raised[0]["total"] if total_raised else 0
    total_auctions = await db.auctions.count_documents({"influencer_id": influencer_id})
    
    return {
        "influencer": influencer,
        "auctions": auction_list,
        "stats": {
            "total_auctions": total_auctions,
            "total_raised": round(total_amount, 2)
        }
    }

@router.get("/featured")
async def get_featured_influencers():
    """Get featured influencers"""
    influencers = await db.influencers.find(
        {"is_featured": True},
        {"_id": 0}
    ).limit(10).to_list(10)
    
    result = []
    for inf in influencers:
        # Get active auction count
        active = await db.auctions.count_documents({
            "influencer_id": inf["id"],
            "status": "active"
        })
        
        result.append({
            **inf,
            "active_auctions": active
        })
    
    return {"featured_influencers": result}

@router.post("/follow/{influencer_id}")
async def follow_influencer(influencer_id: str, user: dict = Depends(get_current_user)):
    """Follow an influencer to get notified of their auctions"""
    influencer = await db.influencers.find_one({"id": influencer_id})
    if not influencer:
        raise HTTPException(status_code=404, detail="Influencer nicht gefunden")
    
    # Check if already following
    existing = await db.influencer_followers.find_one({
        "influencer_id": influencer_id,
        "user_id": user["id"]
    })
    
    if existing:
        raise HTTPException(status_code=400, detail="Du folgst bereits")
    
    await db.influencer_followers.insert_one({
        "influencer_id": influencer_id,
        "user_id": user["id"],
        "followed_at": datetime.now(timezone.utc).isoformat()
    })
    
    # Increment follower count
    await db.influencers.update_one(
        {"id": influencer_id},
        {"$inc": {"follower_count": 1}}
    )
    
    return {"success": True, "message": f"Du folgst jetzt {influencer.get('name', 'dem Influencer')}!"}

@router.delete("/unfollow/{influencer_id}")
async def unfollow_influencer(influencer_id: str, user: dict = Depends(get_current_user)):
    """Unfollow an influencer"""
    result = await db.influencer_followers.delete_one({
        "influencer_id": influencer_id,
        "user_id": user["id"]
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=400, detail="Du folgst nicht")
    
    await db.influencers.update_one(
        {"id": influencer_id, "follower_count": {"$gt": 0}},
        {"$inc": {"follower_count": -1}}
    )
    
    return {"success": True, "message": "Entfolgt"}

@router.get("/my-follows")
async def get_my_followed_influencers(user: dict = Depends(get_current_user)):
    """Get influencers the user follows"""
    follows = await db.influencer_followers.find(
        {"user_id": user["id"]},
        {"_id": 0}
    ).to_list(100)
    
    result = []
    for follow in follows:
        influencer = await db.influencers.find_one(
            {"id": follow["influencer_id"]},
            {"_id": 0}
        )
        if influencer:
            # Check for active auctions
            active = await db.auctions.count_documents({
                "influencer_id": influencer["id"],
                "status": "active"
            })
            
            result.append({
                **influencer,
                "active_auctions": active,
                "followed_at": follow.get("followed_at")
            })
    
    return {"following": result}

# Admin endpoints for influencer management
@router.post("/admin/create-influencer")
async def create_influencer(
    name: str,
    handle: str,
    platform: str,
    avatar_url: str = None,
    bio: str = "",
    followers: int = 0,
    admin: dict = Depends(get_admin_user)
):
    """Create a new influencer profile"""
    influencer_id = str(uuid.uuid4())
    
    influencer = {
        "id": influencer_id,
        "name": name,
        "handle": handle,
        "platform": platform,  # instagram, tiktok, youtube, twitch
        "avatar_url": avatar_url,
        "bio": bio,
        "followers": followers,
        "follower_count": 0,  # BidBlitz followers
        "is_featured": False,
        "is_verified": True,
        "total_auctions": 0,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": admin["id"]
    }
    
    await db.influencers.insert_one(influencer)
    
    del influencer["_id"]
    return {"influencer": influencer}

@router.post("/admin/create-auction")
async def create_influencer_auction(
    influencer_id: str,
    product_id: str,
    starting_price: float = 0.01,
    duration_hours: int = 24,
    is_signed: bool = False,
    is_meet_greet: bool = False,
    special_note: str = "",
    admin: dict = Depends(get_admin_user)
):
    """Create an influencer-hosted auction"""
    influencer = await db.influencers.find_one({"id": influencer_id})
    if not influencer:
        raise HTTPException(status_code=404, detail="Influencer nicht gefunden")
    
    product = await db.products.find_one({"id": product_id})
    if not product:
        raise HTTPException(status_code=404, detail="Produkt nicht gefunden")
    
    auction_id = str(uuid.uuid4())
    end_time = datetime.now(timezone.utc) + timedelta(hours=duration_hours)
    
    auction = {
        "id": auction_id,
        "product_id": product_id,
        "influencer_id": influencer_id,
        "is_influencer_auction": True,
        "is_signed": is_signed,
        "is_meet_greet": is_meet_greet,
        "special_note": special_note,
        "starting_price": starting_price,
        "current_price": starting_price,
        "bid_increment": 0.01,
        "end_time": end_time.isoformat(),
        "is_fixed_end": True,
        "status": "active",
        "total_bids": 0,
        "bid_history": [],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.auctions.insert_one(auction)
    
    # Update influencer stats
    await db.influencers.update_one(
        {"id": influencer_id},
        {"$inc": {"total_auctions": 1}}
    )
    
    # Notify followers
    followers = await db.influencer_followers.find(
        {"influencer_id": influencer_id},
        {"_id": 0, "user_id": 1}
    ).to_list(10000)
    
    # Queue notifications (simplified)
    for follower in followers:
        await db.notifications.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": follower["user_id"],
            "type": "influencer_auction",
            "title": f"Neue Auktion von {influencer['name']}!",
            "message": f"{influencer['name']} hat eine neue Auktion gestartet: {product.get('name', 'Produkt')}",
            "auction_id": auction_id,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "read": False
        })
    
    del auction["_id"]
    return {
        "auction": auction,
        "followers_notified": len(followers)
    }

@router.get("/upcoming")
async def get_upcoming_influencer_auctions():
    """Get upcoming/scheduled influencer auctions"""
    now = datetime.now(timezone.utc).isoformat()
    
    auctions = await db.auctions.find({
        "is_influencer_auction": True,
        "status": "scheduled",
        "start_time": {"$gt": now}
    }, {"_id": 0}).sort("start_time", 1).limit(10).to_list(10)
    
    result = []
    for auction in auctions:
        product = await db.products.find_one({"id": auction.get("product_id")}, {"_id": 0, "name": 1, "image_url": 1})
        influencer = await db.influencers.find_one({"id": auction.get("influencer_id")}, {"_id": 0})
        
        result.append({
            **auction,
            "product": product,
            "influencer": influencer
        })
    
    return {"upcoming": result}
