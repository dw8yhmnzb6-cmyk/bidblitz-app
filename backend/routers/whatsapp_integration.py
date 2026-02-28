"""
WhatsApp Integration - Customer support + notifications via WhatsApp
Uses WhatsApp Business API (Click-to-Chat for now, Cloud API later)
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
import uuid

from dependencies import get_current_user, get_admin_user
from config import db

router = APIRouter(prefix="/whatsapp", tags=["WhatsApp"])

# WhatsApp Business number (configured by admin)
DEFAULT_WA_NUMBER = "+971501234567"  # Change to actual number


class WhatsAppConfig(BaseModel):
    business_number: str
    welcome_message: Optional[str] = None
    auto_reply_enabled: bool = True


@router.get("/config")
async def get_whatsapp_config():
    """Get WhatsApp config for click-to-chat"""
    config = await db.platform_config.find_one({"key": "whatsapp"}, {"_id": 0})
    number = config.get("value", {}).get("business_number", DEFAULT_WA_NUMBER) if config else DEFAULT_WA_NUMBER
    welcome = config.get("value", {}).get("welcome_message", "Hallo! Wie kann ich Ihnen helfen?") if config else "Hallo! Wie kann ich Ihnen helfen?"

    return {
        "number": number,
        "welcome_message": welcome,
        "chat_url": f"https://wa.me/{number.replace('+', '').replace(' ', '')}?text={welcome.replace(' ', '%20')}",
        "support_url": f"https://wa.me/{number.replace('+', '').replace(' ', '')}?text=Support%20Anfrage%20von%20BidBlitz",
    }


@router.put("/config")
async def update_whatsapp_config(data: WhatsAppConfig, admin: dict = Depends(get_admin_user)):
    """Admin: Update WhatsApp configuration"""
    await db.platform_config.update_one(
        {"key": "whatsapp"},
        {"$set": {"value": {
            "business_number": data.business_number,
            "welcome_message": data.welcome_message or "Hallo! Wie kann ich Ihnen helfen?",
            "auto_reply_enabled": data.auto_reply_enabled
        }}},
        upsert=True
    )
    return {"success": True, "message": "WhatsApp Konfiguration aktualisiert"}


@router.post("/send-support-request")
async def send_support_via_whatsapp(user: dict = Depends(get_current_user)):
    """Log a WhatsApp support request and return chat URL"""
    config = await db.platform_config.find_one({"key": "whatsapp"}, {"_id": 0})
    number = config.get("value", {}).get("business_number", DEFAULT_WA_NUMBER) if config else DEFAULT_WA_NUMBER

    # Log the request
    await db.whatsapp_requests.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "user_name": user.get("name"),
        "user_email": user.get("email"),
        "type": "support",
        "status": "initiated",
        "created_at": datetime.now(timezone.utc).isoformat()
    })

    clean_number = number.replace("+", "").replace(" ", "")
    name = user.get("name", "Kunde")
    text = f"Hallo, ich bin {name} (BidBlitz Kunde). Ich brauche Hilfe."

    return {
        "chat_url": f"https://wa.me/{clean_number}?text={text.replace(' ', '%20')}",
        "number": number,
        "message": "WhatsApp wird geöffnet..."
    }


@router.get("/admin/requests")
async def get_whatsapp_requests(admin: dict = Depends(get_admin_user)):
    """Admin: Get WhatsApp support requests"""
    requests = await db.whatsapp_requests.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return {"requests": requests, "total": len(requests)}
