# BidBlitz - Safety Features
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timezone
from uuid import uuid4
from core.database import db
from routes.auth import get_current_user

router = APIRouter(prefix="/api/safety", tags=["Safety"])

class ShareLocationRequest(BaseModel):
    ride_id: str
    contacts: List[str]  # phone numbers or emails
    
class EmergencyRequest(BaseModel):
    ride_id: Optional[str] = None
    location: dict
    
class TripPinRequest(BaseModel):
    ride_id: str

@router.post("/share-location")
async def share_location(req: ShareLocationRequest, user=Depends(get_current_user)):
    """Share live location with trusted contacts during ride"""
    ride = await db.taxi_rides.find_one({"ride_id": req.ride_id, "user_id": user["user_id"]}, {"_id": 0})
    if not ride:
        raise HTTPException(404, "Ride not found")
    
    share_id = str(uuid4())
    share = {
        "share_id": share_id,
        "user_id": user["user_id"],
        "ride_id": req.ride_id,
        "contacts": req.contacts,
        "active": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    
    await db.location_shares.insert_one(share)
    
    # Send SMS/Email to contacts
    for contact in req.contacts:
        message = f"{user['first_name']} is sharing their ride with you. Track: https://bidblitz.ae/track/{share_id}"
        # TODO: Send via SMS/Email service
    
    return {"success": True, "share_id": share_id, "track_url": f"https://bidblitz.ae/track/{share_id}"}

@router.get("/track/{share_id}")
async def track_shared_ride(share_id: str):
    """Public endpoint to track shared ride"""
    share = await db.location_shares.find_one({"share_id": share_id, "active": True}, {"_id": 0})
    if not share:
        raise HTTPException(404, "Share not found or expired")
    
    ride = await db.taxi_rides.find_one({"ride_id": share["ride_id"]}, {"_id": 0})
    if not ride:
        raise HTTPException(404, "Ride not found")
    
    return {
        "rider_name": f"{ride.get('user_name', 'Rider')}",
        "pickup": ride.get("pickup"),
        "destination": ride.get("destination"),
        "status": ride.get("status"),
        "current_location": ride.get("current_location"),
        "eta": ride.get("eta"),
    }

@router.post("/emergency")
async def trigger_emergency(req: EmergencyRequest, user=Depends(get_current_user)):
    """Trigger emergency alert - contacts authorities"""
    emergency_id = str(uuid4())
    emergency = {
        "emergency_id": emergency_id,
        "user_id": user["user_id"],
        "ride_id": req.ride_id,
        "location": req.location,
        "status": "active",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    
    await db.emergencies.insert_one(emergency)
    
    # Send alert to admin
    await db.notifications.insert_one({
        "notification_id": str(uuid4()),
        "user_id": "admin",  # System admin
        "type": "emergency",
        "title": "🚨 EMERGENCY ALERT",
        "message": f"User {user['first_name']} triggered emergency",
        "data": emergency,
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    
    # TODO: Call emergency services API or send SMS to authorities
    
    return {"success": True, "emergency_id": emergency_id, "message": "Emergency services contacted"}

@router.post("/verify-trip")
async def generate_trip_pin(req: TripPinRequest, user=Depends(get_current_user)):
    """Generate PIN for trip verification"""
    import random
    pin = str(random.randint(1000, 9999))
    
    await db.taxi_rides.update_one(
        {"ride_id": req.ride_id, "user_id": user["user_id"]},
        {"$set": {"verification_pin": pin}}
    )
    
    return {"success": True, "pin": pin}

@router.post("/verify-pin")
async def verify_trip_pin(ride_id: str, pin: str):
    """Driver verifies PIN before starting trip"""
    ride = await db.taxi_rides.find_one({"ride_id": ride_id}, {"_id": 0})
    if not ride:
        raise HTTPException(404, "Ride not found")
    
    if ride.get("verification_pin") != pin:
        raise HTTPException(400, "Invalid PIN")
    
    await db.taxi_rides.update_one(
        {"ride_id": ride_id},
        {"$set": {"pin_verified": True}}
    )
    
    return {"success": True, "message": "Trip verified"}

@router.get("/my-emergency-contacts")
async def get_emergency_contacts(user=Depends(get_current_user)):
    """Get user's emergency contacts"""
    contacts = await db.users.find_one(
        {"user_id": user["user_id"]},
        {"_id": 0, "emergency_contacts": 1}
    )
    
    return {"contacts": contacts.get("emergency_contacts", [])}

@router.post("/add-emergency-contact")
async def add_emergency_contact(name: str, phone: str, user=Depends(get_current_user)):
    """Add emergency contact"""
    await db.users.update_one(
        {"user_id": user["user_id"]},
        {"$push": {"emergency_contacts": {"name": name, "phone": phone}}}
    )
    
    return {"success": True}
