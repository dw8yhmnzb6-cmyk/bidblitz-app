"""Notifications router - Push notifications and in-app notifications"""
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone, timedelta
from typing import Optional, List
import uuid
import json
import os
import httpx

from config import db, logger
from dependencies import get_current_user, get_admin_user

router = APIRouter(prefix="/notifications", tags=["Notifications"])

# VAPID Configuration
VAPID_PUBLIC_KEY = os.environ.get("VAPID_PUBLIC_KEY", "")
VAPID_PRIVATE_KEY_FILE = os.environ.get("VAPID_PRIVATE_KEY_FILE", "/app/backend/vapid_private.pem")
VAPID_CLAIMS_EMAIL = os.environ.get("VAPID_CLAIMS_EMAIL", "mailto:support@bidblitz.de")

# ==================== VAPID PUBLIC KEY ====================

@router.get("/vapid-public-key")
async def get_vapid_public_key():
    """Get VAPID public key for push subscription"""
    if not VAPID_PUBLIC_KEY:
        raise HTTPException(status_code=503, detail="Push notifications not configured")
    return {"publicKey": VAPID_PUBLIC_KEY}

# ==================== PUSH SUBSCRIPTIONS ====================

@router.post("/subscribe")
async def subscribe_push(
    subscription: dict,
    user: dict = Depends(get_current_user)
):
    """Subscribe to push notifications"""
    if not subscription.get("endpoint"):
        raise HTTPException(status_code=400, detail="Invalid subscription")
    
    # Store subscription
    sub_id = str(uuid.uuid4())
    await db.push_subscriptions.update_one(
        {"user_id": user["id"], "endpoint": subscription["endpoint"]},
        {
            "$set": {
                "id": sub_id,
                "user_id": user["id"],
                "subscription": subscription,
                "endpoint": subscription["endpoint"],
                "created_at": datetime.now(timezone.utc).isoformat(),
                "active": True
            }
        },
        upsert=True
    )
    
    logger.info(f"Push subscription added for user {user['id']}")
    return {"message": "Erfolgreich für Push-Benachrichtigungen angemeldet", "id": sub_id}


@router.delete("/unsubscribe")
async def unsubscribe_push(
    endpoint: str,
    user: dict = Depends(get_current_user)
):
    """Unsubscribe from push notifications"""
    result = await db.push_subscriptions.delete_one({
        "user_id": user["id"],
        "endpoint": endpoint
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Subscription not found")
    
    return {"message": "Push-Benachrichtigungen deaktiviert"}


@router.get("/subscription-status")
async def get_subscription_status(user: dict = Depends(get_current_user)):
    """Check if user has active push subscription"""
    count = await db.push_subscriptions.count_documents({
        "user_id": user["id"],
        "active": True
    })
    
    return {
        "subscribed": count > 0,
        "subscription_count": count
    }


# ==================== IN-APP NOTIFICATIONS ====================

@router.get("")
async def get_notifications(
    unread_only: bool = False,
    limit: int = 50,
    user: dict = Depends(get_current_user)
):
    """Get user notifications"""
    query = {"user_id": user["id"]}
    if unread_only:
        query["read"] = False
    
    notifications = await db.notifications.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    unread_count = await db.notifications.count_documents({
        "user_id": user["id"],
        "read": False
    })
    
    return {
        "notifications": notifications,
        "unread_count": unread_count
    }


@router.put("/{notification_id}/read")
async def mark_notification_read(
    notification_id: str,
    user: dict = Depends(get_current_user)
):
    """Mark notification as read"""
    result = await db.notifications.update_one(
        {"id": notification_id, "user_id": user["id"]},
        {"$set": {"read": True, "read_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    return {"message": "Benachrichtigung als gelesen markiert"}


@router.put("/read-all")
async def mark_all_read(user: dict = Depends(get_current_user)):
    """Mark all notifications as read"""
    result = await db.notifications.update_many(
        {"user_id": user["id"], "read": False},
        {"$set": {"read": True, "read_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"message": f"{result.modified_count} Benachrichtigungen als gelesen markiert"}


@router.delete("/{notification_id}")
async def delete_notification(
    notification_id: str,
    user: dict = Depends(get_current_user)
):
    """Delete a notification"""
    result = await db.notifications.delete_one({
        "id": notification_id,
        "user_id": user["id"]
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    return {"message": "Benachrichtigung gelöscht"}


# ==================== NOTIFICATION PREFERENCES ====================

@router.get("/preferences")
async def get_notification_preferences(user: dict = Depends(get_current_user)):
    """Get user's notification preferences"""
    prefs = await db.notification_preferences.find_one(
        {"user_id": user["id"]},
        {"_id": 0}
    )
    
    if not prefs:
        # Default preferences
        prefs = {
            "user_id": user["id"],
            "push_enabled": True,
            "email_enabled": True,
            "auction_ending": True,
            "auction_won": True,
            "outbid": True,
            "daily_deals": True,
            "new_auctions": False,
            "marketing": False
        }
    
    return prefs


@router.put("/preferences")
async def update_notification_preferences(
    preferences: dict,
    user: dict = Depends(get_current_user)
):
    """Update notification preferences"""
    allowed_keys = [
        "push_enabled", "email_enabled", "auction_ending",
        "auction_won", "outbid", "daily_deals", "new_auctions", "marketing"
    ]
    
    updates = {k: v for k, v in preferences.items() if k in allowed_keys}
    
    await db.notification_preferences.update_one(
        {"user_id": user["id"]},
        {"$set": {**updates, "updated_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True
    )
    
    return {"message": "Einstellungen aktualisiert", "preferences": updates}


# ==================== ADMIN: SEND NOTIFICATIONS ====================

@router.post("/admin/send")
async def send_notification_to_user(
    user_id: str,
    title: str,
    message: str,
    notification_type: str = "info",
    link: Optional[str] = None,
    admin: dict = Depends(get_admin_user)
):
    """Send notification to a specific user (admin only)"""
    notification_id = str(uuid.uuid4())
    
    notification = {
        "id": notification_id,
        "user_id": user_id,
        "title": title,
        "message": message,
        "type": notification_type,  # info, success, warning, auction, reward
        "link": link,
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.notifications.insert_one(notification)
    
    return {"message": "Benachrichtigung gesendet", "id": notification_id}


@router.post("/admin/broadcast")
async def broadcast_notification(
    title: str,
    message: str,
    notification_type: str = "info",
    target_group: str = "all",
    link: Optional[str] = None,
    admin: dict = Depends(get_admin_user)
):
    """Broadcast notification to all users (admin only)"""
    # Build query
    query = {"is_admin": {"$ne": True}, "is_bot": {"$ne": True}}
    
    if target_group == "active":
        week_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
        query["last_login"] = {"$gte": week_ago}
    elif target_group == "paying":
        query["total_deposits"] = {"$gt": 0}
    
    users = await db.users.find(query, {"_id": 0, "id": 1}).to_list(10000)
    
    if not users:
        return {"sent": 0, "message": "Keine Benutzer in der Zielgruppe"}
    
    # Create notifications
    now = datetime.now(timezone.utc).isoformat()
    notifications = []
    for user in users:
        notifications.append({
            "id": str(uuid.uuid4()),
            "user_id": user["id"],
            "title": title,
            "message": message,
            "type": notification_type,
            "link": link,
            "read": False,
            "created_at": now
        })
    
    if notifications:
        await db.notifications.insert_many(notifications)
    
    return {"sent": len(notifications), "message": f"Benachrichtigung an {len(notifications)} Benutzer gesendet"}


# ==================== HELPER: CREATE NOTIFICATION ====================

async def create_notification(
    user_id: str,
    title: str,
    message: str,
    notification_type: str = "info",
    link: Optional[str] = None
):
    """Helper function to create a notification"""
    notification = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "title": title,
        "message": message,
        "type": notification_type,
        "link": link,
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.notifications.insert_one(notification)
    return notification


# Export helper for use in other modules
__all__ = ['create_notification']
