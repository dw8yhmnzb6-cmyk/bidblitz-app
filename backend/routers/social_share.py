"""Social Sharing - Bonus for sharing wins on social media"""
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone, timedelta
from typing import Optional
import uuid
import hashlib

from config import db, logger
from dependencies import get_current_user

router = APIRouter(prefix="/social", tags=["Social"])

# Sharing bonus configuration
SHARE_BONUS_BIDS = 3
SHARE_COOLDOWN_HOURS = 24  # Can only get bonus once per 24 hours per win

# ==================== SHARE ENDPOINTS ====================

@router.post("/share/{auction_id}")
async def record_share(
    auction_id: str,
    platform: str,  # facebook, twitter, whatsapp, telegram, instagram
    user: dict = Depends(get_current_user)
):
    """Record a social share and award bonus bids"""
    user_id = user["id"]
    
    # Verify user won this auction
    won_auction = await db.won_auctions.find_one({
        "auction_id": auction_id,
        "user_id": user_id
    })
    
    if not won_auction:
        raise HTTPException(status_code=403, detail="Du hast diese Auktion nicht gewonnen")
    
    # Check cooldown
    cutoff = (datetime.now(timezone.utc) - timedelta(hours=SHARE_COOLDOWN_HOURS)).isoformat()
    recent_share = await db.social_shares.find_one({
        "user_id": user_id,
        "auction_id": auction_id,
        "created_at": {"$gte": cutoff}
    })
    
    if recent_share:
        raise HTTPException(status_code=400, detail="Du hast diesen Gewinn bereits geteilt")
    
    # Record share
    share = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "auction_id": auction_id,
        "platform": platform,
        "bonus_awarded": SHARE_BONUS_BIDS,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.social_shares.insert_one(share)
    
    # Award bonus bids
    await db.users.update_one(
        {"id": user_id},
        {"$inc": {"bids_balance": SHARE_BONUS_BIDS}}
    )
    
    # Award XP
    try:
        from routers.levels import award_xp
        await award_xp(user_id, "social_share", 10, f"Gewinn auf {platform} geteilt")
    except:
        pass
    
    logger.info(f"Social share: {user_id} shared auction {auction_id} on {platform}")
    
    return {
        "message": f"Danke fürs Teilen! Du erhältst {SHARE_BONUS_BIDS} Bonus-Gebote!",
        "bids_earned": SHARE_BONUS_BIDS,
        "platform": platform
    }

@router.get("/share-links/{auction_id}")
async def get_share_links(auction_id: str, user: dict = Depends(get_current_user)):
    """Get share links for a won auction"""
    # Verify user won this auction
    won_auction = await db.won_auctions.find_one({
        "auction_id": auction_id,
        "user_id": user["id"]
    }, {"_id": 0})
    
    if not won_auction:
        raise HTTPException(status_code=403, detail="Du hast diese Auktion nicht gewonnen")
    
    # Get product info
    product = await db.products.find_one(
        {"id": won_auction.get("product_id")},
        {"_id": 0, "name": 1, "image_url": 1}
    )
    
    product_name = product.get("name", "Produkt") if product else "Produkt"
    savings = won_auction.get("retail_price", 0) - won_auction.get("final_price", 0)
    
    share_text = f"🎉 Ich habe gerade {product_name} bei BidBlitz für nur €{won_auction.get('final_price', 0):.2f} gewonnen und €{savings:.2f} gespart! 🔥"
    share_url = "https://bidblitz.de"
    
    # Check if already shared
    cutoff = (datetime.now(timezone.utc) - timedelta(hours=SHARE_COOLDOWN_HOURS)).isoformat()
    recent_share = await db.social_shares.find_one({
        "user_id": user["id"],
        "auction_id": auction_id,
        "created_at": {"$gte": cutoff}
    })
    
    return {
        "share_text": share_text,
        "share_url": share_url,
        "product_name": product_name,
        "savings": savings,
        "final_price": won_auction.get("final_price", 0),
        "already_shared": recent_share is not None,
        "bonus_bids": SHARE_BONUS_BIDS if not recent_share else 0,
        "links": {
            "facebook": f"https://www.facebook.com/sharer/sharer.php?u={share_url}&quote={share_text}",
            "twitter": f"https://twitter.com/intent/tweet?text={share_text}&url={share_url}",
            "whatsapp": f"https://wa.me/?text={share_text} {share_url}",
            "telegram": f"https://t.me/share/url?url={share_url}&text={share_text}"
        }
    }

@router.get("/my-shares")
async def get_my_shares(user: dict = Depends(get_current_user)):
    """Get user's sharing history"""
    shares = await db.social_shares.find(
        {"user_id": user["id"]},
        {"_id": 0}
    ).sort("created_at", -1).limit(50).to_list(50)
    
    total_bonus = sum(s.get("bonus_awarded", 0) for s in shares)
    
    return {
        "shares": shares,
        "total_shares": len(shares),
        "total_bonus_earned": total_bonus
    }

# ==================== SHAREABLE WINS ====================

@router.get("/shareable-wins")
async def get_shareable_wins(user: dict = Depends(get_current_user)):
    """Get list of won auctions that can be shared for bonus"""
    user_id = user["id"]
    cutoff = (datetime.now(timezone.utc) - timedelta(hours=SHARE_COOLDOWN_HOURS)).isoformat()
    
    # Get all won auctions
    won_auctions = await db.won_auctions.find(
        {"user_id": user_id},
        {"_id": 0}
    ).sort("won_at", -1).limit(20).to_list(20)
    
    # Get recent shares
    recent_shares = await db.social_shares.find({
        "user_id": user_id,
        "created_at": {"$gte": cutoff}
    }).to_list(100)
    
    shared_auction_ids = {s["auction_id"] for s in recent_shares}
    
    shareable = []
    for win in won_auctions:
        can_share = win["auction_id"] not in shared_auction_ids
        
        product = await db.products.find_one(
            {"id": win.get("product_id")},
            {"_id": 0, "name": 1, "image_url": 1}
        )
        
        shareable.append({
            **win,
            "product": product,
            "can_share": can_share,
            "bonus_bids": SHARE_BONUS_BIDS if can_share else 0
        })
    
    return {"wins": shareable}

__all__ = ['SHARE_BONUS_BIDS']
