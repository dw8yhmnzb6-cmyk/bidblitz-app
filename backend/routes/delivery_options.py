# BidBlitz - Contact-Free Delivery & Delivery Instructions
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
from uuid import uuid4
from core.database import db
from routes.auth import get_current_user

router = APIRouter(prefix="/api/delivery", tags=["Delivery Options"])

class DeliveryPreferences(BaseModel):
    contact_free: bool = False
    leave_at_door: bool = False
    instructions: Optional[str] = None
    doorbell: Optional[bool] = True
    floor: Optional[str] = None
    building_code: Optional[str] = None
    photo_proof: bool = False

@router.post("/preferences")
async def set_delivery_preferences(prefs: DeliveryPreferences, user=Depends(get_current_user)):
    """Set default delivery preferences"""
    await db.users.update_one(
        {"user_id": user["user_id"]},
        {"$set": {"delivery_preferences": prefs.dict()}}
    )
    return {"success": True}

@router.get("/preferences")
async def get_delivery_preferences(user=Depends(get_current_user)):
    """Get user's delivery preferences"""
    user_doc = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0})
    prefs = user_doc.get("delivery_preferences", {
        "contact_free": False,
        "leave_at_door": False,
        "doorbell": True,
    })
    return prefs

@router.post("/order/{order_id}/instructions")
async def set_order_instructions(
    order_id: str,
    instructions: str,
    contact_free: bool = False,
    user=Depends(get_current_user)
):
    """Set delivery instructions for specific order"""
    order = await db.food_orders.find_one({"order_id": order_id, "user_id": user["user_id"]})
    if not order:
        raise HTTPException(404, "Order not found")
    
    await db.food_orders.update_one(
        {"order_id": order_id},
        {"$set": {
            "delivery_instructions": instructions,
            "contact_free": contact_free,
        }}
    )
    
    return {"success": True}

@router.post("/delivery/{order_id}/photo")
async def upload_delivery_photo(order_id: str, photo_url: str, driver=Depends(get_current_user)):
    """Driver uploads delivery proof photo"""
    await db.food_orders.update_one(
        {"order_id": order_id},
        {"$set": {
            "delivery_photo": photo_url,
            "photo_uploaded_at": datetime.now(timezone.utc).isoformat(),
        }}
    )
    
    # Notify customer
    order = await db.food_orders.find_one({"order_id": order_id}, {"_id": 0})
    if order:
        await db.notifications.insert_one({
            "notification_id": str(uuid4()),
            "user_id": order["user_id"],
            "type": "delivery_photo",
            "title": "Order delivered!",
            "message": "Photo proof available",
            "data": {"photo_url": photo_url},
            "read": False,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    
    return {"success": True}
