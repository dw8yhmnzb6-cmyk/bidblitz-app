"""
BidBlitz V2 - Web Push Notifications
Supports Kids SOS alerts, Geofencing violations, low battery warnings
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional
from core.database import db
from core.security import get_current_user
from pywebpush import webpush, WebPushException
import os
import json
import logging

logger = logging.getLogger("bidblitz.push")
router = APIRouter(prefix="/api/push", tags=["push"])

# VAPID Configuration
VAPID_PUBLIC_KEY = os.environ.get("VAPID_PUBLIC_KEY", "").replace("\\n", "\n")
VAPID_PRIVATE_KEY = os.environ.get("VAPID_PRIVATE_KEY", "").replace("\\n", "\n")
VAPID_SUBJECT = os.environ.get("VAPID_SUBJECT", "mailto:noreply@bidblitz.ae")

PUSH_ENABLED = bool(VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY)

if not PUSH_ENABLED:
    logger.warning("⚠️ VAPID keys not configured - push notifications disabled")


class PushSubscription(BaseModel):
    endpoint: str
    keys: dict  # {p256dh, auth}


class PushMessage(BaseModel):
    title: str
    body: str
    icon: Optional[str] = "/logo192.png"
    badge: Optional[str] = "/logo192.png"
    tag: Optional[str] = None
    data: Optional[dict] = None


# ═════════════════════════════════════════════════════════════════
# SUBSCRIPTION MANAGEMENT
# ═════════════════════════════════════════════════════════════════

@router.get("/vapid-public-key")
async def get_vapid_public_key():
    """Return VAPID public key for frontend."""
    if not PUSH_ENABLED:
        raise HTTPException(503, "Push notifications not configured")
    return {"publicKey": VAPID_PUBLIC_KEY}


@router.post("/subscribe")
async def subscribe_push(subscription: PushSubscription, request: Request):
    """Save push subscription for a user."""
    user = await get_current_user(request)
    user_id = user.get("id") or str(user["_id"])
    
    # Store subscription in database
    await db.push_subscriptions.update_one(
        {"user_id": user_id, "endpoint": subscription.endpoint},
        {"$set": {
            "user_id": user_id,
            "email": user.get("email"),
            "subscription": subscription.dict(),
            "created_at": user.get("created_at"),
            "updated_at": user.get("created_at"),
        }},
        upsert=True
    )
    
    logger.info(f"✅ Push subscription saved for user {user_id}")
    return {"ok": True, "message": "Push-Benachrichtigungen aktiviert"}


@router.post("/unsubscribe")
async def unsubscribe_push(subscription: PushSubscription, request: Request):
    """Remove push subscription."""
    user = await get_current_user(request)
    user_id = user.get("id") or str(user["_id"])
    
    await db.push_subscriptions.delete_one({
        "user_id": user_id,
        "endpoint": subscription.endpoint
    })
    
    return {"ok": True, "message": "Push-Benachrichtigungen deaktiviert"}


# ═════════════════════════════════════════════════════════════════
# SEND PUSH NOTIFICATIONS
# ═════════════════════════════════════════════════════════════════

async def send_push_to_user(user_id: str, message: PushMessage) -> int:
    """Send push notification to all devices of a user. Returns count sent."""
    if not PUSH_ENABLED:
        logger.warning(f"Push disabled - would send to {user_id}: {message.title}")
        return 0
    
    # Get all subscriptions for user
    subscriptions = await db.push_subscriptions.find({"user_id": user_id}).to_list(100)
    
    if not subscriptions:
        logger.info(f"No push subscriptions for user {user_id}")
        return 0
    
    sent_count = 0
    payload = json.dumps({
        "title": message.title,
        "body": message.body,
        "icon": message.icon,
        "badge": message.badge,
        "tag": message.tag,
        "data": message.data or {},
    })
    
    for sub in subscriptions:
        try:
            webpush(
                subscription_info=sub["subscription"],
                data=payload,
                vapid_private_key=VAPID_PRIVATE_KEY,
                vapid_claims={"sub": VAPID_SUBJECT}
            )
            sent_count += 1
            logger.info(f"✅ Push sent to {user_id} ({sub['endpoint'][:50]}...)")
        except WebPushException as e:
            logger.error(f"❌ Push failed for {user_id}: {e}")
            # If subscription is invalid (410 Gone), remove it
            if e.response and e.response.status_code == 410:
                await db.push_subscriptions.delete_one({"_id": sub["_id"]})
                logger.info(f"🗑️ Removed invalid subscription for {user_id}")
    
    return sent_count


# ═════════════════════════════════════════════════════════════════
# KIDS SAFETY NOTIFICATIONS
# ═════════════════════════════════════════════════════════════════

async def notify_sos_alert(parent_user_id: str, child_name: str, location: dict):
    """Send SOS alert to parent."""
    lat, lng = location.get("lat", 0), location.get("lng", 0)
    maps_url = f"https://www.google.com/maps?q={lat},{lng}"
    
    message = PushMessage(
        title=f"🆘 SOS von {child_name}!",
        body=f"{child_name} hat einen Notfall-Alarm ausgelöst. Standort: {maps_url}",
        icon="/logo192.png",
        badge="/logo192.png",
        tag="sos_alert",
        data={
            "type": "sos",
            "child_name": child_name,
            "location": location,
            "url": f"/kids?child={child_name}"
        }
    )
    
    count = await send_push_to_user(parent_user_id, message)
    logger.info(f"🆘 SOS alert sent to {parent_user_id}: {count} devices")
    return count


async def notify_geofence_violation(parent_user_id: str, child_name: str, zone_name: str, violation_type: str):
    """Send geofence violation alert to parent."""
    emoji = "🚨" if violation_type == "left" else "✅"
    action = "verlassen" if violation_type == "left" else "betreten"
    
    message = PushMessage(
        title=f"{emoji} Geofencing-Alarm",
        body=f"{child_name} hat die Zone '{zone_name}' {action}.",
        icon="/logo192.png",
        badge="/logo192.png",
        tag="geofence_alert",
        data={
            "type": "geofence",
            "child_name": child_name,
            "zone_name": zone_name,
            "violation_type": violation_type,
            "url": "/kids?tab=gps"
        }
    )
    
    count = await send_push_to_user(parent_user_id, message)
    logger.info(f"🚨 Geofence alert sent to {parent_user_id}: {count} devices")
    return count


async def notify_low_battery(parent_user_id: str, child_name: str, battery_level: int):
    """Send low battery warning to parent."""
    message = PushMessage(
        title=f"🔋 Niedriger Akku: {child_name}",
        body=f"Das Gerät von {child_name} hat nur noch {battery_level}% Akku.",
        icon="/logo192.png",
        badge="/logo192.png",
        tag="low_battery",
        data={
            "type": "low_battery",
            "child_name": child_name,
            "battery_level": battery_level,
            "url": "/kids"
        }
    )
    
    count = await send_push_to_user(parent_user_id, message)
    return count


# ═════════════════════════════════════════════════════════════════
# TEST ENDPOINT (Development)
# ═════════════════════════════════════════════════════════════════

@router.post("/test")
async def test_push(request: Request):
    """Send test push notification to current user."""
    user = await get_current_user(request)
    user_id = user.get("id") or str(user["_id"])
    
    message = PushMessage(
        title="🎉 Test-Benachrichtigung",
        body="Push-Benachrichtigungen funktionieren! Du erhältst jetzt Echtzeit-Updates.",
        icon="/logo192.png",
        data={"type": "test"}
    )
    
    count = await send_push_to_user(user_id, message)
    
    if count == 0:
        raise HTTPException(404, "Keine Push-Subscriptions gefunden. Bitte aktiviere Benachrichtigungen.")
    
    return {"ok": True, "sent": count, "message": f"Test-Push an {count} Gerät(e) gesendet"}
