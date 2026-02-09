"""Social Media Share Router - Share wins and achievements on social media"""
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone, timedelta
from typing import Optional, List
from pydantic import BaseModel
import uuid
import urllib.parse

from config import db, logger
from dependencies import get_current_user, get_admin_user

router = APIRouter(prefix="/social-media-share", tags=["Social Media Share"])

# Sharing rewards configuration
SHARE_REWARDS = {
    "win": 5,           # 5 bids for sharing a win
    "achievement": 3,   # 3 bids for sharing achievement
    "referral": 10,     # 10 bids for successful referral via share
    "first_share": 10   # 10 bids bonus for first share ever
}

# ==================== SCHEMAS ====================

class ShareRequest(BaseModel):
    share_type: str  # win, achievement, referral, product
    content_id: str  # auction_id, achievement_id, etc.
    platform: str    # facebook, twitter, whatsapp, instagram, copy

class ShareTemplateRequest(BaseModel):
    template_type: str
    custom_message: Optional[str] = None

# ==================== HELPER FUNCTIONS ====================

def generate_share_urls(content: dict, platform: str, user_code: str) -> dict:
    """Generate share URLs for different platforms"""
    base_url = f"https://bidblitz.de?ref={user_code}"
    
    # Prepare share text
    text = content.get("share_text", "Schau dir BidBlitz an!")
    url = content.get("url", base_url)
    
    encoded_text = urllib.parse.quote(text)
    encoded_url = urllib.parse.quote(url)
    
    urls = {
        "facebook": f"https://www.facebook.com/sharer/sharer.php?u={encoded_url}&quote={encoded_text}",
        "twitter": f"https://twitter.com/intent/tweet?text={encoded_text}&url={encoded_url}",
        "whatsapp": f"https://wa.me/?text={encoded_text}%20{encoded_url}",
        "telegram": f"https://t.me/share/url?url={encoded_url}&text={encoded_text}",
        "linkedin": f"https://www.linkedin.com/sharing/share-offsite/?url={encoded_url}",
        "email": f"mailto:?subject=BidBlitz%20Empfehlung&body={encoded_text}%20{encoded_url}",
        "copy": url
    }
    
    return urls.get(platform, urls)

# ==================== USER ENDPOINTS ====================

@router.get("/shareable-content")
async def get_shareable_content(user: dict = Depends(get_current_user)):
    """Get content user can share"""
    user_id = user["id"]
    
    # Get user's referral code
    user_data = await db.users.find_one({"id": user_id}, {"_id": 0, "referral_code": 1})
    ref_code = user_data.get("referral_code", user_id[:8])
    
    shareable = []
    
    # Recent wins
    wins = await db.auctions.find(
        {"winner_id": user_id, "status": "ended"},
        {"_id": 0, "id": 1, "product_id": 1, "current_price": 1, "ended_at": 1}
    ).sort("ended_at", -1).limit(5).to_list(5)
    
    for win in wins:
        product = await db.products.find_one(
            {"id": win.get("product_id")},
            {"_id": 0, "name": 1, "retail_price": 1, "image_url": 1}
        )
        if product:
            savings = round((1 - win.get("current_price", 0) / product.get("retail_price", 1)) * 100)
            shareable.append({
                "type": "win",
                "content_id": win["id"],
                "title": f"{product['name']} gewonnen!",
                "description": f"Nur €{win.get('current_price', 0):.2f} statt €{product.get('retail_price', 0):.2f} - {savings}% gespart!",
                "image": product.get("image_url"),
                "reward_bids": SHARE_REWARDS["win"]
            })
    
    # Achievements
    achievements = await db.user_achievements.find(
        {"user_id": user_id, "unlocked": True},
        {"_id": 0}
    ).sort("unlocked_at", -1).limit(3).to_list(3)
    
    for achievement in achievements:
        shareable.append({
            "type": "achievement",
            "content_id": achievement.get("achievement_id"),
            "title": f"Achievement: {achievement.get('name', 'Erfolg')}",
            "description": achievement.get("description", ""),
            "image": achievement.get("icon"),
            "reward_bids": SHARE_REWARDS["achievement"]
        })
    
    # General referral
    shareable.append({
        "type": "referral",
        "content_id": "general",
        "title": "Freunde einladen",
        "description": "Lade Freunde ein und erhalte Bonus-Gebote!",
        "image": None,
        "reward_bids": SHARE_REWARDS["referral"]
    })
    
    return {
        "shareable": shareable,
        "referral_code": ref_code,
        "referral_link": f"https://bidblitz.de?ref={ref_code}"
    }

@router.post("/share")
async def record_share(share: ShareRequest, user: dict = Depends(get_current_user)):
    """Record a share action and award bids"""
    user_id = user["id"]
    
    # Get user's referral code
    user_data = await db.users.find_one({"id": user_id}, {"_id": 0, "referral_code": 1})
    ref_code = user_data.get("referral_code", user_id[:8])
    
    # Check for duplicate share (same content, same platform, within 24 hours)
    day_ago = datetime.now(timezone.utc) - timedelta(hours=24)
    existing = await db.social_shares.find_one({
        "user_id": user_id,
        "share_type": share.share_type,
        "content_id": share.content_id,
        "platform": share.platform,
        "created_at": {"$gte": day_ago.isoformat()}
    })
    
    if existing:
        return {
            "success": True,
            "already_shared": True,
            "message": "Du hast dies bereits geteilt",
            "bids_awarded": 0
        }
    
    # Check if first share ever
    first_share = await db.social_shares.count_documents({"user_id": user_id}) == 0
    
    # Calculate reward
    base_reward = SHARE_REWARDS.get(share.share_type, 3)
    bonus = SHARE_REWARDS["first_share"] if first_share else 0
    total_reward = base_reward + bonus
    
    # Record share
    share_id = str(uuid.uuid4())
    await db.social_shares.insert_one({
        "id": share_id,
        "user_id": user_id,
        "share_type": share.share_type,
        "content_id": share.content_id,
        "platform": share.platform,
        "referral_code": ref_code,
        "bids_awarded": total_reward,
        "first_share_bonus": first_share,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    # Award bids
    await db.users.update_one(
        {"id": user_id},
        {"$inc": {"bids_balance": total_reward}}
    )
    
    # Generate share URL
    content = {}
    if share.share_type == "win":
        auction = await db.auctions.find_one({"id": share.content_id}, {"_id": 0})
        if auction:
            product = await db.products.find_one({"id": auction.get("product_id")}, {"_id": 0})
            if product:
                savings = round((1 - auction.get("current_price", 0) / product.get("retail_price", 1)) * 100)
                content = {
                    "share_text": f"Ich habe gerade {product['name']} für nur €{auction.get('current_price', 0):.2f} gewonnen ({savings}% gespart)! Probier es auch:",
                    "url": f"https://bidblitz.de?ref={ref_code}"
                }
    
    if not content:
        content = {
            "share_text": "Ich spare bis zu 90% bei BidBlitz Auktionen! Probier es auch:",
            "url": f"https://bidblitz.de?ref={ref_code}"
        }
    
    share_urls = generate_share_urls(content, share.platform, ref_code)
    
    message = f"Du hast {total_reward} Gebote erhalten!"
    if first_share:
        message = f"Glückwunsch zum ersten Teilen! {total_reward} Gebote erhalten (inkl. {SHARE_REWARDS['first_share']} Bonus)!"
    
    logger.info(f"Share recorded: {user_id} shared {share.share_type} on {share.platform}")
    
    return {
        "success": True,
        "share_id": share_id,
        "bids_awarded": total_reward,
        "first_share_bonus": first_share,
        "message": message,
        "share_url": share_urls if isinstance(share_urls, str) else share_urls.get(share.platform)
    }

@router.get("/my-shares")
async def get_my_shares(user: dict = Depends(get_current_user)):
    """Get user's share history"""
    shares = await db.social_shares.find(
        {"user_id": user["id"]},
        {"_id": 0}
    ).sort("created_at", -1).limit(50).to_list(50)
    
    # Calculate total bids earned
    total_bids = sum(s.get("bids_awarded", 0) for s in shares)
    
    return {
        "shares": shares,
        "total_shares": len(shares),
        "total_bids_earned": total_bids
    }

@router.get("/share-templates")
async def get_share_templates(language: str = "de"):
    """Get pre-made share templates"""
    templates = {
        "de": {
            "win": [
                "Gerade {product} für nur €{price} gewonnen! {savings}% gespart bei @BidBlitz",
                "Unglaublich! {product} für €{price} statt €{retail}. Danke @BidBlitz!",
                "Wieder gewonnen bei BidBlitz! {product} zum Schnäppchenpreis von €{price}"
            ],
            "general": [
                "Spare bis zu 90% bei Auktionen auf BidBlitz!",
                "Die spannendste Art zu sparen - probier BidBlitz!",
                "Penny Auktionen mit echten Gewinnen. Ich bin dabei!"
            ],
            "achievement": [
                "Neues Achievement bei BidBlitz: {achievement}!",
                "Level Up bei BidBlitz! Habe gerade {achievement} freigeschaltet"
            ]
        },
        "en": {
            "win": [
                "Just won {product} for only €{price}! Saved {savings}% at @BidBlitz",
                "Amazing! {product} for €{price} instead of €{retail}. Thanks @BidBlitz!"
            ],
            "general": [
                "Save up to 90% at BidBlitz auctions!",
                "The most exciting way to save - try BidBlitz!"
            ]
        }
    }
    
    return {"templates": templates.get(language, templates["de"])}

@router.get("/leaderboard")
async def get_share_leaderboard(period: str = "week"):
    """Get top sharers leaderboard"""
    if period == "week":
        start_date = datetime.now(timezone.utc) - timedelta(days=7)
    elif period == "month":
        start_date = datetime.now(timezone.utc) - timedelta(days=30)
    else:
        start_date = datetime.now(timezone.utc) - timedelta(days=365)
    
    pipeline = [
        {"$match": {"created_at": {"$gte": start_date.isoformat()}}},
        {"$group": {
            "_id": "$user_id",
            "share_count": {"$sum": 1},
            "bids_earned": {"$sum": "$bids_awarded"}
        }},
        {"$sort": {"share_count": -1}},
        {"$limit": 10}
    ]
    
    top_sharers = await db.social_shares.aggregate(pipeline).to_list(10)
    
    # Get user names
    for sharer in top_sharers:
        user = await db.users.find_one({"id": sharer["_id"]}, {"_id": 0, "name": 1, "username": 1})
        if user:
            name = user.get("name", user.get("username", "Nutzer"))
            # Anonymize
            sharer["user_name"] = f"{name.split()[0]} {name.split()[-1][0]}." if len(name.split()) > 1 else name[:3] + "***"
        else:
            sharer["user_name"] = "Nutzer"
    
    return {"leaderboard": top_sharers, "period": period}

# ==================== ADMIN ENDPOINTS ====================

@router.get("/admin/stats")
async def get_share_stats(admin: dict = Depends(get_admin_user)):
    """Get social sharing statistics"""
    now = datetime.now(timezone.utc)
    week_ago = now - timedelta(days=7)
    
    total_shares = await db.social_shares.count_documents({})
    weekly_shares = await db.social_shares.count_documents({
        "created_at": {"$gte": week_ago.isoformat()}
    })
    
    # By platform
    platform_pipeline = [
        {"$group": {"_id": "$platform", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]
    by_platform = await db.social_shares.aggregate(platform_pipeline).to_list(10)
    
    # By type
    type_pipeline = [
        {"$group": {"_id": "$share_type", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]
    by_type = await db.social_shares.aggregate(type_pipeline).to_list(10)
    
    # Total bids awarded
    bids_pipeline = [
        {"$group": {"_id": None, "total": {"$sum": "$bids_awarded"}}}
    ]
    total_bids = await db.social_shares.aggregate(bids_pipeline).to_list(1)
    
    return {
        "total_shares": total_shares,
        "weekly_shares": weekly_shares,
        "by_platform": {p["_id"]: p["count"] for p in by_platform},
        "by_type": {t["_id"]: t["count"] for t in by_type},
        "total_bids_awarded": total_bids[0]["total"] if total_bids else 0
    }


social_media_share_router = router
