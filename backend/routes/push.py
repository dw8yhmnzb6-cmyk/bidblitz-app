"""
Firebase Cloud Messaging (FCM) Push Notifications
Backend: Send notifications on Order Status, Driver Updates, Auctions
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import os

router = APIRouter(prefix="/api/fcm", tags=["fcm"])

# Firebase Admin SDK
try:
    import firebase_admin
    from firebase_admin import credentials, messaging
    
    # Initialize Firebase (only once)
    if not firebase_admin._apps:
        # Try to load service account from file or env
        service_account_path = os.getenv("FIREBASE_SERVICE_ACCOUNT_PATH", "/app/backend/firebase-service-account-demo.json")
        
        if os.path.exists(service_account_path):
            cred = credentials.Certificate(service_account_path)
            firebase_admin.initialize_app(cred)
            print("✅ Firebase Admin SDK initialized")
        else:
            print("⚠️ Firebase service account not found - Push disabled")
            firebase_admin = None
except Exception as e:
    print(f"⚠️ Firebase initialization failed: {e}")
    firebase_admin = None

# ─── Models ───
class SubscribeRequest(BaseModel):
    token: str  # FCM device token from frontend
    
class SendNotificationRequest(BaseModel):
    user_id: str
    title: str
    body: str
    data: Optional[dict] = {}
    image: Optional[str] = None

# ─── Subscribe Device Token ───
@router.post("/subscribe")
async def subscribe_push(req: SubscribeRequest, user=Depends(lambda: {"user_id": "demo_user"})):
    """
    Save FCM device token for user
    Frontend calls this after requesting notification permission
    """
    from motor.motor_asyncio import AsyncIOMotorClient
    
    client = AsyncIOMotorClient(os.getenv("MONGO_URL"))
    db = client[os.getenv("DB_NAME", "bidblitz")]
    
    # Store token
    await db.push_tokens.update_one(
        {"user_id": user["user_id"]},
        {
            "$addToSet": {"tokens": req.token},
            "$set": {"updated_at": "now"}
        },
        upsert=True
    )
    
    return {"success": True, "message": "Subscribed to push notifications"}

# ─── Send Notification ───
@router.post("/send")
async def send_notification(req: SendNotificationRequest):
    """
    Send push notification to user
    Called internally by other services (Order updates, etc.)
    """
    if not firebase_admin:
        return {"success": False, "error": "Firebase not configured"}
    
    from motor.motor_asyncio import AsyncIOMotorClient
    
    client = AsyncIOMotorClient(os.getenv("MONGO_URL"))
    db = client[os.getenv("DB_NAME", "bidblitz")]
    
    # Get user's tokens
    user_tokens = await db.push_tokens.find_one({"user_id": req.user_id})
    
    if not user_tokens or not user_tokens.get("tokens"):
        return {"success": False, "error": "No tokens found for user"}
    
    # Send to all user's devices
    tokens = user_tokens["tokens"]
    
    try:
        # Build notification
        notification = messaging.Notification(
            title=req.title,
            body=req.body,
            image=req.image
        )
        
        # Send multicast
        message = messaging.MulticastMessage(
            notification=notification,
            data=req.data,
            tokens=tokens
        )
        
        response = messaging.send_multicast(message)
        
        # Remove invalid tokens
        if response.failure_count > 0:
            failed_tokens = [tokens[i] for i, resp in enumerate(response.responses) if not resp.success]
            await db.push_tokens.update_one(
                {"user_id": req.user_id},
                {"$pullAll": {"tokens": failed_tokens}}
            )
        
        return {
            "success": True,
            "sent": response.success_count,
            "failed": response.failure_count
        }
    
    except Exception as e:
        raise HTTPException(500, f"Failed to send notification: {str(e)}")

# ─── Helper: Send Order Status Notification ───
async def notify_order_status(user_id: str, order_type: str, status: str, order_id: str):
    """
    Helper function to send order status notifications
    Call this from taxi/food/scooter routes
    """
    status_messages = {
        "accepted": "Deine Bestellung wurde angenommen!",
        "preparing": "Deine Bestellung wird vorbereitet",
        "on_the_way": "Der Fahrer ist unterwegs zu dir",
        "arrived": "Dein Fahrer ist da!",
        "delivered": "Bestellung zugestellt!",
        "completed": "Bestellung abgeschlossen",
    }
    
    title_map = {
        "taxi": "🚕 Taxi Update",
        "food": "🍕 Essens Update",
        "scooter": "🛴 Scooter Update",
    }
    
    await send_notification(SendNotificationRequest(
        user_id=user_id,
        title=title_map.get(order_type, "BidBlitz Update"),
        body=status_messages.get(status, f"Status: {status}"),
        data={
            "type": "order_status",
            "order_type": order_type,
            "order_id": order_id,
            "status": status
        }
    ))
