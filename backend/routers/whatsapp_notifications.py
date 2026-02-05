"""WhatsApp Business Notifications"""
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone
from typing import Optional
import httpx
import os

from config import db, logger
from dependencies import get_current_user

router = APIRouter(prefix="/whatsapp", tags=["WhatsApp Notifications"])

# WhatsApp Business API Configuration
WHATSAPP_API_URL = os.environ.get("WHATSAPP_API_URL", "")
WHATSAPP_ACCESS_TOKEN = os.environ.get("WHATSAPP_ACCESS_TOKEN", "")
WHATSAPP_PHONE_ID = os.environ.get("WHATSAPP_PHONE_ID", "")

async def send_whatsapp_message(phone_number: str, template: str, params: list = None):
    """Send WhatsApp message using Business API"""
    if not WHATSAPP_ACCESS_TOKEN or not WHATSAPP_PHONE_ID:
        logger.warning("WhatsApp not configured - message not sent")
        return {"success": False, "reason": "WhatsApp not configured"}
    
    # Format phone number (remove + and spaces)
    phone = phone_number.replace("+", "").replace(" ", "").replace("-", "")
    if not phone.startswith("49") and not phone.startswith("43") and not phone.startswith("41"):
        # Add German country code if no code present
        if phone.startswith("0"):
            phone = "49" + phone[1:]
        else:
            phone = "49" + phone
    
    url = f"https://graph.facebook.com/v18.0/{WHATSAPP_PHONE_ID}/messages"
    headers = {
        "Authorization": f"Bearer {WHATSAPP_ACCESS_TOKEN}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "messaging_product": "whatsapp",
        "to": phone,
        "type": "template",
        "template": {
            "name": template,
            "language": {"code": "de"},
            "components": []
        }
    }
    
    if params:
        payload["template"]["components"].append({
            "type": "body",
            "parameters": [{"type": "text", "text": p} for p in params]
        })
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(url, headers=headers, json=payload)
            if response.status_code == 200:
                return {"success": True, "message_id": response.json().get("messages", [{}])[0].get("id")}
            else:
                logger.error(f"WhatsApp API error: {response.text}")
                return {"success": False, "error": response.text}
    except Exception as e:
        logger.error(f"WhatsApp send error: {e}")
        return {"success": False, "error": str(e)}

# ==================== USER ENDPOINTS ====================

@router.post("/subscribe")
async def subscribe_whatsapp(
    phone_number: str,
    user: dict = Depends(get_current_user)
):
    """Subscribe to WhatsApp notifications"""
    # Save phone number
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {
            "whatsapp_phone": phone_number,
            "whatsapp_subscribed": True,
            "whatsapp_subscribed_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Update notification preferences
    await db.notification_preferences.update_one(
        {"user_id": user["id"]},
        {"$set": {
            "whatsapp_enabled": True,
            "whatsapp_phone": phone_number,
            "auction_ending": True,
            "auction_won": True,
            "outbid": True,
            "deals": True
        }},
        upsert=True
    )
    
    # Send welcome message
    result = await send_whatsapp_message(
        phone_number,
        "bidblitz_welcome",
        [user.get("name", "Nutzer")]
    )
    
    return {
        "success": True,
        "message": "WhatsApp-Benachrichtigungen aktiviert!",
        "welcome_sent": result.get("success", False)
    }

@router.delete("/unsubscribe")
async def unsubscribe_whatsapp(user: dict = Depends(get_current_user)):
    """Unsubscribe from WhatsApp notifications"""
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"whatsapp_subscribed": False}}
    )
    
    await db.notification_preferences.update_one(
        {"user_id": user["id"]},
        {"$set": {"whatsapp_enabled": False}}
    )
    
    return {"success": True, "message": "WhatsApp-Benachrichtigungen deaktiviert"}

@router.get("/status")
async def get_whatsapp_status(user: dict = Depends(get_current_user)):
    """Get WhatsApp subscription status"""
    user_data = await db.users.find_one({"id": user["id"]}, {"_id": 0, "whatsapp_phone": 1, "whatsapp_subscribed": 1})
    prefs = await db.notification_preferences.find_one({"user_id": user["id"]}, {"_id": 0})
    
    return {
        "subscribed": user_data.get("whatsapp_subscribed", False) if user_data else False,
        "phone": user_data.get("whatsapp_phone") if user_data else None,
        "preferences": prefs or {}
    }

@router.put("/preferences")
async def update_whatsapp_preferences(
    auction_ending: bool = True,
    auction_won: bool = True,
    outbid: bool = True,
    deals: bool = True,
    daily_digest: bool = False,
    user: dict = Depends(get_current_user)
):
    """Update WhatsApp notification preferences"""
    await db.notification_preferences.update_one(
        {"user_id": user["id"]},
        {"$set": {
            "auction_ending": auction_ending,
            "auction_won": auction_won,
            "outbid": outbid,
            "deals": deals,
            "daily_digest": daily_digest
        }},
        upsert=True
    )
    
    return {"success": True, "message": "Einstellungen gespeichert"}

# ==================== NOTIFICATION FUNCTIONS ====================

async def notify_auction_ending(user_id: str, auction_id: str, product_name: str, minutes_left: int):
    """Notify user that their watched auction is ending"""
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "whatsapp_phone": 1, "whatsapp_subscribed": 1})
    if not user or not user.get("whatsapp_subscribed"):
        return
    
    prefs = await db.notification_preferences.find_one({"user_id": user_id})
    if not prefs or not prefs.get("auction_ending"):
        return
    
    await send_whatsapp_message(
        user["whatsapp_phone"],
        "auction_ending",
        [product_name, str(minutes_left)]
    )

async def notify_auction_won(user_id: str, product_name: str, final_price: float):
    """Notify user they won an auction"""
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "whatsapp_phone": 1, "whatsapp_subscribed": 1})
    if not user or not user.get("whatsapp_subscribed"):
        return
    
    prefs = await db.notification_preferences.find_one({"user_id": user_id})
    if not prefs or not prefs.get("auction_won"):
        return
    
    await send_whatsapp_message(
        user["whatsapp_phone"],
        "auction_won",
        [product_name, f"€{final_price:.2f}"]
    )

async def notify_outbid(user_id: str, product_name: str, new_price: float):
    """Notify user they were outbid"""
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "whatsapp_phone": 1, "whatsapp_subscribed": 1})
    if not user or not user.get("whatsapp_subscribed"):
        return
    
    prefs = await db.notification_preferences.find_one({"user_id": user_id})
    if not prefs or not prefs.get("outbid"):
        return
    
    await send_whatsapp_message(
        user["whatsapp_phone"],
        "outbid_alert",
        [product_name, f"€{new_price:.2f}"]
    )

# Export notification functions
__all__ = ['notify_auction_ending', 'notify_auction_won', 'notify_outbid', 'send_whatsapp_message']
