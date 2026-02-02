"""Countdown Alarm Router - Auction ending notifications"""
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone, timedelta
from pydantic import BaseModel
from typing import Optional, List
import uuid

from config import db, logger
from dependencies import get_current_user

router = APIRouter(prefix="/countdown-alarm", tags=["Countdown Alarm"])

# ==================== SCHEMAS ====================

class AlarmCreate(BaseModel):
    auction_id: str
    notify_minutes: int = 5  # Minutes before end to notify (1, 5, 10, 15, 30)

class AlarmUpdate(BaseModel):
    notify_minutes: Optional[int] = None
    is_active: Optional[bool] = None

# ==================== ENDPOINTS ====================

@router.post("/set")
async def set_countdown_alarm(data: AlarmCreate, user: dict = Depends(get_current_user)):
    """Set a countdown alarm for an auction"""
    user_id = user["id"]
    
    # Validate notify_minutes
    valid_minutes = [1, 5, 10, 15, 30, 60]
    if data.notify_minutes not in valid_minutes:
        data.notify_minutes = 5  # Default to 5 minutes
    
    # Check if auction exists and is active
    auction = await db.auctions.find_one({
        "id": data.auction_id,
        "status": "active"
    }, {"_id": 0})
    
    if not auction:
        raise HTTPException(status_code=404, detail="Auktion nicht gefunden oder nicht aktiv")
    
    # Check for existing alarm
    existing = await db.countdown_alarms.find_one({
        "user_id": user_id,
        "auction_id": data.auction_id
    })
    
    if existing:
        # Update existing
        await db.countdown_alarms.update_one(
            {"id": existing["id"]},
            {"$set": {
                "notify_minutes": data.notify_minutes,
                "is_active": True,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        return {
            "success": True,
            "message": f"Alarm aktualisiert auf {data.notify_minutes} Min. vor Ende",
            "alarm_id": existing["id"]
        }
    
    # Get product info
    product = await db.products.find_one({"id": auction.get("product_id")}, {"_id": 0})
    
    alarm = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "auction_id": data.auction_id,
        "product_name": product.get("name") if product else auction.get("product_name", "Auktion"),
        "product_image": product.get("image_url") if product else auction.get("product_image"),
        "notify_minutes": data.notify_minutes,
        "is_active": True,
        "notified": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.countdown_alarms.insert_one(alarm)
    
    logger.info(f"Countdown alarm set: {user_id} for auction {data.auction_id} ({data.notify_minutes} min)")
    
    return {
        "success": True,
        "message": f"Alarm gesetzt! Du wirst {data.notify_minutes} Min. vor Ende benachrichtigt.",
        "alarm_id": alarm["id"]
    }

@router.delete("/remove/{auction_id}")
async def remove_alarm(auction_id: str, user: dict = Depends(get_current_user)):
    """Remove a countdown alarm"""
    result = await db.countdown_alarms.delete_one({
        "user_id": user["id"],
        "auction_id": auction_id
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Alarm nicht gefunden")
    
    return {"success": True, "message": "Alarm entfernt"}

@router.get("/my-alarms")
async def get_my_alarms(user: dict = Depends(get_current_user)):
    """Get all active alarms for the user"""
    alarms = await db.countdown_alarms.find(
        {"user_id": user["id"], "is_active": True},
        {"_id": 0}
    ).to_list(50)
    
    # Enrich with current auction status
    for alarm in alarms:
        auction = await db.auctions.find_one(
            {"id": alarm["auction_id"]},
            {"_id": 0, "current_price": 1, "status": 1, "end_time": 1}
        )
        if auction:
            alarm["auction_status"] = auction.get("status")
            alarm["current_price"] = auction.get("current_price")
            alarm["end_time"] = auction.get("end_time")
            
            # Calculate time until notification
            if auction.get("end_time"):
                try:
                    end_time = datetime.fromisoformat(auction["end_time"].replace("Z", "+00:00"))
                    notify_time = end_time - timedelta(minutes=alarm["notify_minutes"])
                    seconds_until = (notify_time - datetime.now(timezone.utc)).total_seconds()
                    alarm["seconds_until_notification"] = max(0, int(seconds_until))
                except:
                    pass
    
    return {"alarms": alarms}

@router.get("/status/{auction_id}")
async def get_alarm_status(auction_id: str, user: dict = Depends(get_current_user)):
    """Check if user has an alarm for this auction"""
    alarm = await db.countdown_alarms.find_one(
        {"user_id": user["id"], "auction_id": auction_id, "is_active": True},
        {"_id": 0}
    )
    
    if not alarm:
        return {"has_alarm": False, "alarm": None}
    
    return {
        "has_alarm": True,
        "alarm": alarm
    }


# ==================== BACKGROUND PROCESSOR (called from server.py) ====================

async def process_countdown_alarms():
    """Process countdown alarms and send notifications"""
    now = datetime.now(timezone.utc)
    
    # Get active auctions
    active_auctions = await db.auctions.find(
        {"status": "active"},
        {"_id": 0, "id": 1, "end_time": 1}
    ).to_list(500)
    
    for auction in active_auctions:
        try:
            end_time = datetime.fromisoformat(auction["end_time"].replace("Z", "+00:00"))
            minutes_until_end = (end_time - now).total_seconds() / 60
            
            if minutes_until_end <= 0:
                continue
            
            # Find alarms that should be triggered
            alarms = await db.countdown_alarms.find({
                "auction_id": auction["id"],
                "is_active": True,
                "notified": False,
                "notify_minutes": {"$gte": minutes_until_end}
            }).to_list(100)
            
            for alarm in alarms:
                # Mark as notified
                await db.countdown_alarms.update_one(
                    {"id": alarm["id"]},
                    {"$set": {"notified": True, "notified_at": now.isoformat()}}
                )
                
                # Create notification
                notification = {
                    "id": str(uuid.uuid4()),
                    "user_id": alarm["user_id"],
                    "type": "countdown_alarm",
                    "title": "Auktion endet bald!",
                    "message": f"{alarm['product_name']} endet in {int(minutes_until_end)} Minuten!",
                    "auction_id": auction["id"],
                    "read": False,
                    "created_at": now.isoformat()
                }
                
                await db.notifications.insert_one(notification)
                
                # Also try to send push notification if user has web push enabled
                try:
                    from routers.notifications import send_push_to_user
                    await send_push_to_user(
                        alarm["user_id"],
                        "Auktion endet bald!",
                        f"{alarm['product_name']} endet in {int(minutes_until_end)} Minuten!"
                    )
                except:
                    pass
                
                logger.info(f"Countdown alarm triggered: {alarm['user_id']} - {alarm['product_name']}")
                
        except Exception as e:
            logger.error(f"Error processing countdown alarm for auction {auction['id']}: {e}")


countdown_alarm_router = router
