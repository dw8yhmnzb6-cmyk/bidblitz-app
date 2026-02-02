"""Flash Auctions & Events Router - Special time-limited auctions"""
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone, timedelta
from typing import Optional, List
import uuid

from config import db, logger
from dependencies import get_current_user, get_admin_user

router = APIRouter(prefix="/events", tags=["events"])

# ==================== FLASH AUCTION ENDPOINTS ====================

@router.post("/flash-auction")
async def create_flash_auction(
    product_id: str,
    start_time: str,  # ISO format
    duration_minutes: int = 30,
    title: Optional[str] = None,
    description: Optional[str] = None,
    notify_users: bool = True,
    admin: dict = Depends(get_admin_user)
):
    """Create a flash auction event (Admin only)"""
    # Get product
    product = await db.products.find_one({"id": product_id}, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="Produkt nicht gefunden")
    
    # Parse start time
    try:
        start_dt = datetime.fromisoformat(start_time.replace('Z', '+00:00'))
    except:
        raise HTTPException(status_code=400, detail="Ungültiges Startzeit-Format")
    
    # Create the flash auction
    auction_id = str(uuid.uuid4())
    end_time = start_dt + timedelta(minutes=duration_minutes)
    
    flash_auction = {
        "id": auction_id,
        "product_id": product_id,
        "starting_price": 0.01,
        "current_price": 0.01,
        "bid_increment": 0.01,
        "start_time": start_dt.isoformat(),
        "end_time": end_time.isoformat(),
        "status": "scheduled",
        "is_flash_auction": True,
        "flash_title": title or f"⚡ Flash: {product.get('name', 'Produkt')}",
        "flash_description": description or "Limitierte Flash-Auktion!",
        "duration_minutes": duration_minutes,
        "total_bids": 0,
        "bid_history": [],
        "last_bidder_id": None,
        "last_bidder_name": None,
        "winner_id": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": admin.get("email")
    }
    
    await db.auctions.insert_one(flash_auction)
    
    # Create event record
    event_id = str(uuid.uuid4())
    event = {
        "id": event_id,
        "type": "flash_auction",
        "auction_id": auction_id,
        "product_id": product_id,
        "title": flash_auction["flash_title"],
        "description": flash_auction["flash_description"],
        "start_time": start_dt.isoformat(),
        "end_time": end_time.isoformat(),
        "status": "scheduled",
        "notify_users": notify_users,
        "notified": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.events.insert_one(event)
    
    logger.info(f"⚡ Flash auction created: {auction_id} starting at {start_time}")
    
    # Schedule notifications if requested
    if notify_users:
        await schedule_flash_notifications(event_id, start_dt, flash_auction["flash_title"], product)
    
    return {
        "message": "Flash-Auktion erstellt!",
        "auction_id": auction_id,
        "event_id": event_id,
        "start_time": start_dt.isoformat(),
        "end_time": end_time.isoformat()
    }


async def schedule_flash_notifications(event_id: str, start_time: datetime, title: str, product: dict):
    """Schedule notifications for flash auction"""
    # Create notification records for 1 hour and 5 minutes before
    notifications = [
        {"minutes_before": 60, "message": f"⚡ In 1 Stunde: {title}"},
        {"minutes_before": 5, "message": f"⚡ In 5 Minuten: {title} - Jetzt vorbereiten!"}
    ]
    
    for notif in notifications:
        notify_at = start_time - timedelta(minutes=notif["minutes_before"])
        if notify_at > datetime.now(timezone.utc):
            await db.scheduled_notifications.insert_one({
                "id": str(uuid.uuid4()),
                "event_id": event_id,
                "type": "flash_auction_reminder",
                "title": title,
                "message": notif["message"],
                "product_image": product.get("image_url"),
                "notify_at": notify_at.isoformat(),
                "sent": False,
                "created_at": datetime.now(timezone.utc).isoformat()
            })


@router.get("/upcoming")
async def get_upcoming_events(limit: int = 10):
    """Get upcoming flash auctions and events"""
    now = datetime.now(timezone.utc)
    
    events = await db.events.find({
        "start_time": {"$gt": now.isoformat()},
        "status": {"$in": ["scheduled", "active"]}
    }, {"_id": 0}).sort("start_time", 1).limit(limit).to_list(limit)
    
    # Enrich with product data
    for event in events:
        if event.get("product_id"):
            product = await db.products.find_one({"id": event["product_id"]}, {"_id": 0})
            if product:
                event["product"] = product
    
    return {"events": events, "count": len(events)}


@router.get("/active")
async def get_active_flash_auctions():
    """Get currently active flash auctions"""
    now = datetime.now(timezone.utc)
    
    auctions = await db.auctions.find({
        "is_flash_auction": True,
        "status": "active",
        "end_time": {"$gt": now.isoformat()}
    }, {"_id": 0, "bid_history": 0}).to_list(20)
    
    # Enrich with product data
    for auction in auctions:
        if auction.get("product_id"):
            product = await db.products.find_one({"id": auction["product_id"]}, {"_id": 0})
            if product:
                auction["product"] = product
    
    return {"flash_auctions": auctions}


@router.delete("/flash-auction/{auction_id}")
async def cancel_flash_auction(auction_id: str, admin: dict = Depends(get_admin_user)):
    """Cancel a scheduled flash auction (Admin only)"""
    auction = await db.auctions.find_one({"id": auction_id, "is_flash_auction": True})
    
    if not auction:
        raise HTTPException(status_code=404, detail="Flash-Auktion nicht gefunden")
    
    if auction.get("status") not in ["scheduled", "active"]:
        raise HTTPException(status_code=400, detail="Auktion kann nicht mehr storniert werden")
    
    # Update auction status
    await db.auctions.update_one(
        {"id": auction_id},
        {"$set": {"status": "cancelled"}}
    )
    
    # Update event status
    await db.events.update_one(
        {"auction_id": auction_id},
        {"$set": {"status": "cancelled"}}
    )
    
    logger.info(f"Flash auction cancelled: {auction_id}")
    
    return {"message": "Flash-Auktion storniert"}


# ==================== SUBSCRIPTION TO EVENTS ====================

@router.post("/subscribe/{event_id}")
async def subscribe_to_event(event_id: str, user: dict = Depends(get_current_user)):
    """Subscribe to event notifications"""
    event = await db.events.find_one({"id": event_id})
    if not event:
        raise HTTPException(status_code=404, detail="Event nicht gefunden")
    
    # Check if already subscribed
    existing = await db.event_subscriptions.find_one({
        "user_id": user["id"],
        "event_id": event_id
    })
    
    if existing:
        return {"message": "Bereits angemeldet", "subscribed": True}
    
    await db.event_subscriptions.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "event_id": event_id,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {"message": "Benachrichtigung aktiviert!", "subscribed": True}


@router.delete("/subscribe/{event_id}")
async def unsubscribe_from_event(event_id: str, user: dict = Depends(get_current_user)):
    """Unsubscribe from event notifications"""
    await db.event_subscriptions.delete_one({
        "user_id": user["id"],
        "event_id": event_id
    })
    
    return {"message": "Benachrichtigung deaktiviert", "subscribed": False}


# ==================== ADMIN STATS ====================

@router.get("/admin/stats")
async def get_event_stats(admin: dict = Depends(get_admin_user)):
    """Get event statistics"""
    now = datetime.now(timezone.utc)
    
    total_events = await db.events.count_documents({})
    upcoming_events = await db.events.count_documents({
        "start_time": {"$gt": now.isoformat()},
        "status": "scheduled"
    })
    completed_events = await db.events.count_documents({"status": "completed"})
    
    # Get recent flash auction performance
    recent_flash = await db.auctions.find({
        "is_flash_auction": True,
        "status": "ended"
    }, {"_id": 0, "total_bids": 1, "current_price": 1}).sort("end_time", -1).limit(10).to_list(10)
    
    avg_bids = sum(a.get("total_bids", 0) for a in recent_flash) / len(recent_flash) if recent_flash else 0
    avg_price = sum(a.get("current_price", 0) for a in recent_flash) / len(recent_flash) if recent_flash else 0
    
    return {
        "total_events": total_events,
        "upcoming_events": upcoming_events,
        "completed_events": completed_events,
        "flash_auction_stats": {
            "avg_bids": round(avg_bids, 1),
            "avg_final_price": round(avg_price, 2)
        }
    }
