"""
Twilio SMS Notifications Backend
Order Status Updates, 2FA, Delivery Notifications
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
import os

router = APIRouter(prefix="/api/sms", tags=["sms"])

# Twilio Client (Install: pip install twilio)
try:
    from twilio.rest import Client
    
    TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID", "DEMO_SID")
    TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN", "DEMO_TOKEN")
    TWILIO_PHONE_NUMBER = os.getenv("TWILIO_PHONE_NUMBER", "+15555555555")
    
    twilio_client = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
    print("✅ Twilio initialized")
except Exception as e:
    print(f"⚠️ Twilio initialization failed: {e}")
    twilio_client = None

class SMSRequest(BaseModel):
    to: str  # Phone number in E.164 format (+491234567890)
    message: str

class OrderSMSRequest(BaseModel):
    user_id: str
    phone_number: str
    order_type: str  # taxi, food, scooter
    status: str
    order_id: str

@router.post("/send")
async def send_sms(req: SMSRequest):
    """Send SMS via Twilio"""
    if not twilio_client:
        return {"success": False, "error": "Twilio not configured"}
    
    try:
        message = twilio_client.messages.create(
            body=req.message,
            from_=TWILIO_PHONE_NUMBER,
            to=req.to
        )
        
        return {
            "success": True,
            "message_sid": message.sid,
            "status": message.status
        }
    except Exception as e:
        raise HTTPException(500, f"SMS sending failed: {str(e)}")

@router.post("/order-notification")
async def send_order_sms(req: OrderSMSRequest):
    """Send order status SMS notification"""
    if not twilio_client:
        return {"success": False, "error": "Twilio not configured"}
    
    # Build message based on status
    messages = {
        "accepted": f"✅ Deine {req.order_type}-Bestellung #{req.order_id[:8]} wurde angenommen!",
        "on_the_way": f"🚗 Dein Fahrer ist unterwegs! Bestellung #{req.order_id[:8]}",
        "arrived": f"📍 Dein Fahrer ist da! Bestellung #{req.order_id[:8]}",
        "delivered": f"✅ Bestellung #{req.order_id[:8]} zugestellt. Danke für deine Bestellung!",
        "cancelled": f"❌ Bestellung #{req.order_id[:8]} wurde storniert.",
    }
    
    message_text = messages.get(req.status, f"Status-Update: {req.status}")
    message_text += "\n\n- BidBlitz Team"
    
    try:
        message = twilio_client.messages.create(
            body=message_text,
            from_=TWILIO_PHONE_NUMBER,
            to=req.phone_number
        )
        
        return {"success": True, "message_sid": message.sid}
    except Exception as e:
        raise HTTPException(500, f"SMS failed: {str(e)}")
