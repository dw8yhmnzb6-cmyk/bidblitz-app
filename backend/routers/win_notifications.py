"""Win Notifications Router - FOMO-inducing win push notifications"""
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone, timedelta
from pydantic import BaseModel
from typing import Optional, List
import uuid
import random

from config import db, logger
from dependencies import get_current_user, get_admin_user

router = APIRouter(prefix="/win-notifications", tags=["Win Notifications"])

# ==================== CONFIGURATION ====================

# Notification templates with FOMO elements
NOTIFICATION_TEMPLATES = {
    "de": [
        "{username} hat gerade {product} für nur €{price:.2f} gewonnen! 🎉",
        "WOW! {product} ging für unglaubliche €{price:.2f} an {username}! 💰",
        "Schnäppchen-Alarm: {username} sicherte sich {product} für €{price:.2f}! ⚡",
        "{username} hat {savings}% gespart bei {product}! Nur €{price:.2f}! 🔥",
        "GEWONNEN! {product} für €{price:.2f} - Glückwunsch {username}! 🏆"
    ],
    "en": [
        "{username} just won {product} for only €{price:.2f}! 🎉",
        "WOW! {product} went for an incredible €{price:.2f} to {username}! 💰",
        "Deal Alert: {username} secured {product} for €{price:.2f}! ⚡",
        "{username} saved {savings}% on {product}! Only €{price:.2f}! 🔥",
        "WON! {product} for €{price:.2f} - Congrats {username}! 🏆"
    ]
}

# ==================== SCHEMAS ====================

class NotificationPreference(BaseModel):
    receive_win_notifications: bool = True
    push_enabled: bool = True
    email_enabled: bool = False

# ==================== ENDPOINTS ====================

@router.get("/recent")
async def get_recent_wins(limit: int = 10, language: str = "de"):
    """Get recent win notifications for display"""
    # Get recent ended auctions with winners
    recent_wins = await db.auctions.find(
        {
            "status": "ended",
            "winner_id": {"$ne": None},
            "ended_at": {"$gte": (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()}
        },
        {"_id": 0}
    ).sort("ended_at", -1).to_list(limit)
    
    notifications = []
    templates = NOTIFICATION_TEMPLATES.get(language, NOTIFICATION_TEMPLATES["de"])
    
    for win in recent_wins:
        # Get product info
        product = await db.products.find_one({"id": win.get("product_id")}, {"_id": 0})
        product_name = product.get("name") if product else win.get("product_name", "Produkt")
        retail_price = product.get("retail_price", 100) if product else 100
        final_price = win.get("final_price", win.get("current_price", 0))
        
        # Calculate savings
        savings = int(((retail_price - final_price) / retail_price) * 100) if retail_price > 0 else 95
        
        # Anonymize username (first name + initial)
        winner_name = win.get("winner_name", "Benutzer")
        if " " in winner_name:
            parts = winner_name.split()
            winner_name = f"{parts[0]} {parts[-1][0]}."
        elif len(winner_name) > 2:
            winner_name = f"{winner_name[:1]}***{winner_name[-1]}."
        
        # Format notification
        template = random.choice(templates)
        message = template.format(
            username=winner_name,
            product=product_name[:30] + "..." if len(product_name) > 30 else product_name,
            price=final_price,
            savings=savings
        )
        
        notifications.append({
            "id": win["id"],
            "message": message,
            "product_name": product_name,
            "product_image": product.get("image_url") if product else None,
            "final_price": final_price,
            "retail_price": retail_price,
            "savings_percent": savings,
            "winner_name": winner_name,
            "timestamp": win.get("ended_at"),
            "auction_id": win["id"]
        })
    
    return {"notifications": notifications}

@router.get("/preferences")
async def get_notification_preferences(user: dict = Depends(get_current_user)):
    """Get user's win notification preferences"""
    prefs = await db.notification_preferences.find_one(
        {"user_id": user["id"]},
        {"_id": 0}
    )
    
    if not prefs:
        return {
            "receive_win_notifications": True,
            "push_enabled": True,
            "email_enabled": False
        }
    
    return prefs

@router.post("/preferences")
async def update_notification_preferences(
    data: NotificationPreference,
    user: dict = Depends(get_current_user)
):
    """Update user's win notification preferences"""
    await db.notification_preferences.update_one(
        {"user_id": user["id"]},
        {"$set": {
            "user_id": user["id"],
            "receive_win_notifications": data.receive_win_notifications,
            "push_enabled": data.push_enabled,
            "email_enabled": data.email_enabled,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }},
        upsert=True
    )
    
    return {"success": True, "message": "Einstellungen gespeichert"}

@router.post("/broadcast")
async def broadcast_win_notification(
    auction_id: str,
    admin: dict = Depends(get_admin_user)
):
    """Manually broadcast a win notification (admin only)"""
    auction = await db.auctions.find_one(
        {"id": auction_id, "status": "ended", "winner_id": {"$ne": None}},
        {"_id": 0}
    )
    
    if not auction:
        raise HTTPException(status_code=404, detail="Auktion nicht gefunden oder kein Gewinner")
    
    # Get product
    product = await db.products.find_one({"id": auction.get("product_id")}, {"_id": 0})
    
    # Create broadcast notification
    notification = {
        "id": str(uuid.uuid4()),
        "type": "win_broadcast",
        "auction_id": auction_id,
        "product_name": product.get("name") if product else auction.get("product_name"),
        "product_image": product.get("image_url") if product else None,
        "final_price": auction.get("final_price", auction.get("current_price")),
        "retail_price": product.get("retail_price", 0) if product else 0,
        "winner_name": auction.get("winner_name"),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.win_broadcasts.insert_one(notification)
    
    # Send push to all users with notifications enabled
    users_with_push = await db.notification_preferences.find(
        {"receive_win_notifications": True, "push_enabled": True},
        {"_id": 0, "user_id": 1}
    ).to_list(1000)
    
    logger.info(f"Broadcasting win notification for {product.get('name') if product else auction_id} to {len(users_with_push)} users")
    
    return {
        "success": True,
        "message": f"Benachrichtigung an {len(users_with_push)} Benutzer gesendet"
    }


# ==================== HELPER FUNCTION (called when auction ends) ====================

async def create_win_notification(auction_id: str, winner_id: str, winner_name: str, product_name: str, final_price: float):
    """Create and optionally broadcast a win notification"""
    # Store the win event
    win_event = {
        "id": str(uuid.uuid4()),
        "auction_id": auction_id,
        "winner_id": winner_id,
        "winner_name": winner_name,
        "product_name": product_name,
        "final_price": final_price,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.win_events.insert_one(win_event)
    
    # The actual push notification is handled by the notifications router
    # This just records the event for display purposes
    
    logger.info(f"Win notification created: {winner_name} won {product_name} for €{final_price:.2f}")
    
    return win_event


win_notifications_router = router
