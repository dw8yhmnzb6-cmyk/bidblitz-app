# BidBlitz - Scheduled Booking System
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
from uuid import uuid4
from core.database import db
from routes.auth import get_current_user

router = APIRouter(prefix="/api/scheduled", tags=["Scheduled Booking"])

class ScheduleRequest(BaseModel):
    service_type: str  # taxi, food
    scheduled_time: str  # ISO format
    pickup: Optional[str] = None
    destination: Optional[str] = None
    restaurant_id: Optional[str] = None
    items: Optional[list] = None

@router.post("/create")
async def create_scheduled_booking(req: ScheduleRequest, user=Depends(get_current_user)):
    """Schedule a ride or food order"""
    scheduled_dt = datetime.fromisoformat(req.scheduled_time.replace('Z', '+00:00'))
    now = datetime.now(timezone.utc)
    
    if scheduled_dt <= now:
        raise HTTPException(400, "Scheduled time must be in the future")
    
    if (scheduled_dt - now).days > 30:
        raise HTTPException(400, "Cannot schedule more than 30 days in advance")
    
    booking_id = str(uuid4())
    booking = {
        "booking_id": booking_id,
        "user_id": user["user_id"],
        "service_type": req.service_type,
        "scheduled_time": req.scheduled_time,
        "status": "scheduled",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    
    if req.service_type == "taxi":
        booking["pickup"] = req.pickup
        booking["destination"] = req.destination
    elif req.service_type == "food":
        booking["restaurant_id"] = req.restaurant_id
        booking["items"] = req.items
    
    await db.scheduled_bookings.insert_one(booking)
    
    return {"success": True, "booking_id": booking_id}

@router.get("/my-bookings")
async def get_my_bookings(user=Depends(get_current_user)):
    """Get user's scheduled bookings"""
    bookings = await db.scheduled_bookings.find({
        "user_id": user["user_id"],
        "status": {"$in": ["scheduled", "active"]},
    }, {"_id": 0}).sort("scheduled_time", 1).to_list(50)
    
    return {"bookings": bookings}

@router.delete("/{booking_id}")
async def cancel_scheduled_booking(booking_id: str, user=Depends(get_current_user)):
    """Cancel a scheduled booking"""
    booking = await db.scheduled_bookings.find_one({
        "booking_id": booking_id,
        "user_id": user["user_id"],
    })
    
    if not booking:
        raise HTTPException(404, "Booking not found")
    
    if booking["status"] != "scheduled":
        raise HTTPException(400, "Cannot cancel this booking")
    
    await db.scheduled_bookings.update_one(
        {"booking_id": booking_id},
        {"$set": {"status": "cancelled"}}
    )
    
    return {"success": True}
