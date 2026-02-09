"""Email Marketing Automation Router - Automated email campaigns"""
from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from datetime import datetime, timezone, timedelta
from typing import Optional, List
from pydantic import BaseModel
import uuid
import os

from config import db, logger
from dependencies import get_current_user, get_admin_user

router = APIRouter(prefix="/email-marketing", tags=["Email Marketing"])

# Email Templates
EMAIL_TEMPLATES = {
    "welcome": {
        "subject": {
            "de": "🎉 Willkommen bei BidBlitz - Deine Gratis-Gebote warten!",
            "en": "🎉 Welcome to BidBlitz - Your free bids are waiting!",
            "xk": "🎉 Mirë se vini në BidBlitz - Ofertat tuaja falas ju presin!"
        },
        "delay_hours": 0
    },
    "welcome_day2": {
        "subject": {
            "de": "💡 So gewinnst du bei BidBlitz - Tipps vom Profi",
            "en": "💡 How to win at BidBlitz - Pro tips",
            "xk": "💡 Si të fitoni në BidBlitz - Këshilla profesionale"
        },
        "delay_hours": 48
    },
    "welcome_day5": {
        "subject": {
            "de": "🎁 Exklusiv für dich: 10 Bonus-Gebote!",
            "en": "🎁 Exclusive for you: 10 bonus bids!",
            "xk": "🎁 Ekskluzivisht për ty: 10 oferta bonus!"
        },
        "delay_hours": 120
    },
    "lost_auction": {
        "subject": {
            "de": "😢 Knapp verloren! Hier sind 5 Trost-Gebote",
            "en": "😢 So close! Here are 5 consolation bids",
            "xk": "😢 Aq afër! Ja 5 oferta ngushëllimi"
        },
        "delay_hours": 0
    },
    "abandoned_cart": {
        "subject": {
            "de": "🛒 Du hast Gebote im Warenkorb vergessen!",
            "en": "🛒 You forgot bids in your cart!",
            "xk": "🛒 Keni harruar ofertat në shportë!"
        },
        "delay_hours": 2
    },
    "favorite_back": {
        "subject": {
            "de": "⭐ Dein Wunschprodukt ist wieder in Auktion!",
            "en": "⭐ Your wishlist item is back in auction!",
            "xk": "⭐ Produkti juaj i dëshiruar është përsëri në ankand!"
        },
        "delay_hours": 0
    },
    "inactive_7days": {
        "subject": {
            "de": "👋 Wir vermissen dich! Hier ist ein Geschenk",
            "en": "👋 We miss you! Here's a gift",
            "xk": "👋 Na mungon! Ja një dhuratë"
        },
        "delay_hours": 168
    },
    "bid_low_balance": {
        "subject": {
            "de": "⚠️ Nur noch wenige Gebote übrig!",
            "en": "⚠️ Only a few bids left!",
            "xk": "⚠️ Vetëm disa oferta të mbetura!"
        },
        "delay_hours": 0
    },
    "weekly_digest": {
        "subject": {
            "de": "📊 Dein Wochen-Rückblick bei BidBlitz",
            "en": "📊 Your weekly BidBlitz recap",
            "xk": "📊 Përmbledhja juaj javore në BidBlitz"
        },
        "delay_hours": 168
    }
}

# ==================== SCHEMAS ====================

class EmailCampaignCreate(BaseModel):
    name: str
    template_type: str
    subject: str
    body_html: str
    target_segment: str  # all, new_users, inactive, vip, etc.
    send_at: Optional[str] = None  # ISO datetime or None for immediate

class EmailPreferences(BaseModel):
    marketing: bool = True
    auction_updates: bool = True
    win_notifications: bool = True
    weekly_digest: bool = True

# ==================== USER ENDPOINTS ====================

@router.get("/preferences")
async def get_email_preferences(user: dict = Depends(get_current_user)):
    """Get user's email preferences"""
    prefs = await db.email_preferences.find_one(
        {"user_id": user["id"]},
        {"_id": 0}
    )
    
    if not prefs:
        # Default preferences
        return {
            "marketing": True,
            "auction_updates": True,
            "win_notifications": True,
            "weekly_digest": True
        }
    
    return prefs

@router.put("/preferences")
async def update_email_preferences(prefs: EmailPreferences, user: dict = Depends(get_current_user)):
    """Update user's email preferences"""
    await db.email_preferences.update_one(
        {"user_id": user["id"]},
        {"$set": {
            "user_id": user["id"],
            "marketing": prefs.marketing,
            "auction_updates": prefs.auction_updates,
            "win_notifications": prefs.win_notifications,
            "weekly_digest": prefs.weekly_digest,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }},
        upsert=True
    )
    
    return {"success": True, "message": "Einstellungen gespeichert"}

@router.post("/unsubscribe/{token}")
async def unsubscribe_from_emails(token: str):
    """Unsubscribe from marketing emails via token link"""
    # Find user by unsubscribe token
    user = await db.users.find_one({"unsubscribe_token": token})
    
    if not user:
        raise HTTPException(status_code=404, detail="Ungültiger Link")
    
    # Update preferences
    await db.email_preferences.update_one(
        {"user_id": user["id"]},
        {"$set": {"marketing": False}},
        upsert=True
    )
    
    return {"success": True, "message": "Du wurdest von Marketing-E-Mails abgemeldet"}

# ==================== AUTOMATION TRIGGERS ====================

@router.post("/trigger/welcome")
async def trigger_welcome_series(user_id: str, background_tasks: BackgroundTasks):
    """Trigger welcome email series for new user (internal use)"""
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        return {"success": False, "error": "User not found"}
    
    # Schedule welcome series
    for template_key, template in EMAIL_TEMPLATES.items():
        if template_key.startswith("welcome"):
            await db.email_queue.insert_one({
                "id": str(uuid.uuid4()),
                "user_id": user_id,
                "user_email": user.get("email"),
                "template": template_key,
                "subject": template["subject"].get("de", template["subject"].get("en")),
                "status": "scheduled",
                "send_at": (datetime.now(timezone.utc) + timedelta(hours=template["delay_hours"])).isoformat(),
                "created_at": datetime.now(timezone.utc).isoformat()
            })
    
    logger.info(f"📧 Welcome email series scheduled for user {user_id}")
    return {"success": True, "emails_scheduled": 3}

@router.post("/trigger/lost-auction")
async def trigger_lost_auction_email(user_id: str, auction_id: str):
    """Send consolation email when user loses auction (internal use)"""
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        return {"success": False}
    
    # Check email preferences
    prefs = await db.email_preferences.find_one({"user_id": user_id})
    if prefs and not prefs.get("auction_updates", True):
        return {"success": False, "reason": "User opted out"}
    
    # Get auction info
    auction = await db.auctions.find_one({"id": auction_id}, {"_id": 0})
    
    await db.email_queue.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "user_email": user.get("email"),
        "template": "lost_auction",
        "auction_id": auction_id,
        "auction_name": auction.get("title") if auction else "Auktion",
        "status": "pending",
        "send_at": datetime.now(timezone.utc).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    logger.info(f"📧 Lost auction email queued for user {user_id}")
    return {"success": True}

@router.post("/trigger/favorite-back")
async def trigger_favorite_back_email(product_id: str):
    """Notify users when their favorite product is back in auction"""
    # Find users who favorited this product
    favorites = await db.favorites.find(
        {"product_id": product_id},
        {"_id": 0, "user_id": 1}
    ).to_list(1000)
    
    count = 0
    for fav in favorites:
        user = await db.users.find_one({"id": fav["user_id"]}, {"_id": 0, "email": 1})
        if user:
            await db.email_queue.insert_one({
                "id": str(uuid.uuid4()),
                "user_id": fav["user_id"],
                "user_email": user.get("email"),
                "template": "favorite_back",
                "product_id": product_id,
                "status": "pending",
                "send_at": datetime.now(timezone.utc).isoformat(),
                "created_at": datetime.now(timezone.utc).isoformat()
            })
            count += 1
    
    logger.info(f"📧 Favorite-back emails queued for {count} users")
    return {"success": True, "emails_queued": count}

# ==================== ADMIN ENDPOINTS ====================

@router.get("/admin/queue")
async def get_email_queue(
    status: Optional[str] = None,
    limit: int = 50,
    admin: dict = Depends(get_admin_user)
):
    """Get email queue (admin only)"""
    query = {}
    if status:
        query["status"] = status
    
    emails = await db.email_queue.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    return {"emails": emails, "count": len(emails)}

@router.get("/admin/stats")
async def get_email_stats(admin: dict = Depends(get_admin_user)):
    """Get email marketing statistics"""
    now = datetime.now(timezone.utc)
    week_ago = now - timedelta(days=7)
    
    # Count by status
    pending = await db.email_queue.count_documents({"status": "pending"})
    sent = await db.email_queue.count_documents({"status": "sent"})
    failed = await db.email_queue.count_documents({"status": "failed"})
    
    # This week
    sent_this_week = await db.email_queue.count_documents({
        "status": "sent",
        "sent_at": {"$gte": week_ago.isoformat()}
    })
    
    # Open rate (if tracking implemented)
    opened = await db.email_queue.count_documents({"opened": True})
    open_rate = (opened / sent * 100) if sent > 0 else 0
    
    return {
        "queue": {
            "pending": pending,
            "sent": sent,
            "failed": failed
        },
        "this_week": {
            "sent": sent_this_week
        },
        "metrics": {
            "open_rate": round(open_rate, 1)
        }
    }

@router.post("/admin/campaign")
async def create_email_campaign(campaign: EmailCampaignCreate, admin: dict = Depends(get_admin_user)):
    """Create a new email campaign (admin only)"""
    campaign_id = str(uuid.uuid4())
    
    # Get target users based on segment
    query = {}
    if campaign.target_segment == "new_users":
        week_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
        query["created_at"] = {"$gte": week_ago}
    elif campaign.target_segment == "inactive":
        week_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
        query["last_login"] = {"$lte": week_ago}
    elif campaign.target_segment == "vip":
        query["is_vip"] = True
    
    # Get users
    users = await db.users.find(query, {"_id": 0, "id": 1, "email": 1}).to_list(10000)
    
    # Create campaign
    campaign_doc = {
        "id": campaign_id,
        "name": campaign.name,
        "template_type": campaign.template_type,
        "subject": campaign.subject,
        "body_html": campaign.body_html,
        "target_segment": campaign.target_segment,
        "recipient_count": len(users),
        "send_at": campaign.send_at or datetime.now(timezone.utc).isoformat(),
        "status": "scheduled",
        "created_by": admin["id"],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.email_campaigns.insert_one(campaign_doc)
    
    # Queue emails for all recipients
    for user in users:
        await db.email_queue.insert_one({
            "id": str(uuid.uuid4()),
            "campaign_id": campaign_id,
            "user_id": user["id"],
            "user_email": user.get("email"),
            "template": campaign.template_type,
            "subject": campaign.subject,
            "status": "scheduled",
            "send_at": campaign.send_at or datetime.now(timezone.utc).isoformat(),
            "created_at": datetime.now(timezone.utc).isoformat()
        })
    
    logger.info(f"📧 Campaign '{campaign.name}' created with {len(users)} recipients")
    
    return {
        "success": True,
        "campaign_id": campaign_id,
        "recipients": len(users)
    }

@router.get("/admin/campaigns")
async def get_email_campaigns(admin: dict = Depends(get_admin_user)):
    """Get all email campaigns"""
    campaigns = await db.email_campaigns.find(
        {},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    return {"campaigns": campaigns}


email_marketing_router = router
