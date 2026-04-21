"""
BidBlitz V2 - Web Push Notifications (VAPID)
Real-time browser notifications for auction updates, wins, friend activities.
Uses py-vapid and pywebpush for Web Push Protocol.
"""
import os
import json
import secrets
from datetime import datetime, timezone
from typing import Optional, List
from fastapi import APIRouter, Request, HTTPException, BackgroundTasks
from pydantic import BaseModel, Field

from core.database import db
from core.security import get_current_user
from core.rate_limit import limiter

router = APIRouter(prefix="/api/push", tags=["web-push"])

# VAPID keys (generate once, store in env) - Decode \n literals
VAPID_PRIVATE_KEY = os.environ.get("VAPID_PRIVATE_KEY", "").replace("\\n", "\n")
VAPID_PUBLIC_KEY = os.environ.get("VAPID_PUBLIC_KEY", "").replace("\\n", "\n")
VAPID_CLAIMS = {"sub": "mailto:noreply@bidblitz.com"}


class PushSubscription(BaseModel):
    endpoint: str
    keys: dict = Field(..., description="Must contain 'p256dh' and 'auth'")


class PushTestRequest(BaseModel):
    title: str = "Test Notification"
    body: str = "Dies ist eine Test-Benachrichtigung von BidBlitz!"
    icon: Optional[str] = None
    badge: Optional[str] = None
    data: Optional[dict] = None


@router.get("/vapid-public-key")
async def get_vapid_public_key():
    """Return VAPID public key for frontend subscription."""
    if not VAPID_PUBLIC_KEY:
        raise HTTPException(
            status_code=503,
            detail="VAPID keys not configured. Generate keys first."
        )
    return {"publicKey": VAPID_PUBLIC_KEY}


@router.post("/subscribe")
@limiter.limit("10/minute")
async def subscribe_push(subscription: PushSubscription, request: Request):
    """Save user's push subscription."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    # Validate keys
    if "p256dh" not in subscription.keys or "auth" not in subscription.keys:
        raise HTTPException(status_code=400, detail="Invalid subscription keys")
    
    # Store subscription (upsert by endpoint to avoid duplicates)
    sub_doc = {
        "user_id": user_id,
        "email": user.get("email", ""),
        "endpoint": subscription.endpoint,
        "p256dh": subscription.keys["p256dh"],
        "auth": subscription.keys["auth"],
        "subscribed_at": datetime.now(timezone.utc).isoformat(),
        "last_used": datetime.now(timezone.utc).isoformat(),
        "active": True,
    }
    
    await db.push_subscriptions.update_one(
        {"endpoint": subscription.endpoint},
        {"$set": sub_doc},
        upsert=True,
    )
    
    return {"ok": True, "message": "Push-Benachrichtigungen aktiviert!"}


@router.delete("/unsubscribe")
async def unsubscribe_push(subscription: PushSubscription, request: Request):
    """Remove user's push subscription."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    result = await db.push_subscriptions.delete_one({
        "user_id": user_id,
        "endpoint": subscription.endpoint,
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Subscription not found")
    
    return {"ok": True, "message": "Push-Benachrichtigungen deaktiviert"}


@router.get("/subscription-status")
async def get_subscription_status(request: Request):
    """Check if user has active push subscriptions."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    count = await db.push_subscriptions.count_documents({
        "user_id": user_id,
        "active": True,
    })
    
    return {"subscribed": count > 0, "subscription_count": count}


@router.post("/test")
@limiter.limit("5/minute")
async def send_test_push(
    req: PushTestRequest,
    request: Request,
    background_tasks: BackgroundTasks,
):
    """Send a test push notification to the user."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    # Get user's subscriptions
    subs = await db.push_subscriptions.find(
        {"user_id": user_id, "active": True},
        {"_id": 0},
    ).to_list(10)
    
    if not subs:
        raise HTTPException(
            status_code=404,
            detail="Keine aktiven Push-Abonnements gefunden. Bitte aktivieren Sie Benachrichtigungen."
        )
    
    payload = {
        "title": req.title,
        "body": req.body,
        "icon": req.icon or "/logo192.png",
        "badge": req.badge or "/favicon.ico",
        "data": req.data or {},
    }
    
    # Send to all user's subscriptions in background
    sent_count = 0
    for sub in subs:
        try:
            background_tasks.add_task(_send_push_notification, sub, payload)
            sent_count += 1
        except Exception:
            pass
    
    return {
        "ok": True,
        "message": f"Test-Benachrichtigung an {sent_count} Gerät(e) gesendet!",
        "sent_to": sent_count,
    }


# ══════════════════════════════════════════════════════════════
# Internal Helper: Send Web Push
# ══════════════════════════════════════════════════════════════

async def _send_push_notification(subscription: dict, payload: dict):
    """
    Send a Web Push notification using pywebpush.
    Called in background tasks.
    """
    if not VAPID_PRIVATE_KEY or not VAPID_PUBLIC_KEY:
        return  # Silently skip if VAPID not configured
    
    try:
        from pywebpush import webpush, WebPushException
        
        subscription_info = {
            "endpoint": subscription["endpoint"],
            "keys": {
                "p256dh": subscription["p256dh"],
                "auth": subscription["auth"],
            }
        }
        
        webpush(
            subscription_info=subscription_info,
            data=json.dumps(payload),
            vapid_private_key=VAPID_PRIVATE_KEY,
            vapid_claims=VAPID_CLAIMS,
        )
        
        # Update last_used timestamp
        await db.push_subscriptions.update_one(
            {"endpoint": subscription["endpoint"]},
            {"$set": {"last_used": datetime.now(timezone.utc).isoformat()}},
        )
        
    except WebPushException as e:
        # Subscription expired or invalid - mark as inactive
        if e.response and e.response.status_code in (404, 410):
            await db.push_subscriptions.update_one(
                {"endpoint": subscription["endpoint"]},
                {"$set": {"active": False}},
            )
    except Exception:
        pass  # Log errors but don't crash


# ══════════════════════════════════════════════════════════════
# Public API: Send push to user(s)
# ══════════════════════════════════════════════════════════════

async def send_push_to_user(
    user_id: str,
    title: str,
    body: str,
    icon: Optional[str] = None,
    data: Optional[dict] = None,
):
    """
    Send push notification to all active subscriptions of a user.
    Call this from other routes (auction wins, friend requests, etc.)
    """
    subs = await db.push_subscriptions.find(
        {"user_id": user_id, "active": True},
        {"_id": 0},
    ).to_list(10)
    
    payload = {
        "title": title,
        "body": body,
        "icon": icon or "/logo192.png",
        "data": data or {},
    }
    
    for sub in subs:
        try:
            await _send_push_notification(sub, payload)
        except Exception:
            pass


async def send_push_to_users(
    user_ids: List[str],
    title: str,
    body: str,
    icon: Optional[str] = None,
    data: Optional[dict] = None,
):
    """
    Send push notification to multiple users.
    Useful for bulk notifications (e.g., friend group activities).
    """
    for user_id in user_ids:
        try:
            await send_push_to_user(user_id, title, body, icon, data)
        except Exception:
            pass
