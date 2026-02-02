"""Power Hour & Special Events - Time-based bonus systems"""
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone, timedelta
from typing import Optional
import uuid

from config import db, logger
from dependencies import get_current_user, get_admin_user as get_current_admin

router = APIRouter(prefix="/power-hour", tags=["Power Hour"])

# ==================== POWER HOUR SCHEDULE ====================

# Default power hours (can be overridden by admin)
DEFAULT_POWER_HOURS = [
    {"hour": 12, "name": "Mittagszeit", "multiplier": 2.0},  # 12:00 UTC
    {"hour": 18, "name": "Feierabend", "multiplier": 2.0},   # 18:00 UTC
    {"hour": 21, "name": "Prime Time", "multiplier": 2.5},   # 21:00 UTC
]

# ==================== PUBLIC ENDPOINTS ====================

@router.get("/status")
async def get_power_hour_status():
    """Check if power hour is currently active"""
    now = datetime.now(timezone.utc)
    current_hour = now.hour
    
    # Check for admin-scheduled power hours
    scheduled = await db.power_hours.find_one({
        "start_time": {"$lte": now.isoformat()},
        "end_time": {"$gte": now.isoformat()},
        "is_active": True
    }, {"_id": 0})
    
    if scheduled:
        end_time = datetime.fromisoformat(scheduled["end_time"].replace('Z', '+00:00'))
        return {
            "is_active": True,
            "name": scheduled.get("name", "Power Hour"),
            "multiplier": scheduled.get("multiplier", 2.0),
            "bonus_type": scheduled.get("bonus_type", "xp"),
            "seconds_remaining": max(0, int((end_time - now).total_seconds())),
            "description": scheduled.get("description", "Doppelte XP!")
        }
    
    # Check default schedule
    for ph in DEFAULT_POWER_HOURS:
        if current_hour == ph["hour"]:
            # Calculate time until end of hour
            next_hour = (now + timedelta(hours=1)).replace(minute=0, second=0, microsecond=0)
            return {
                "is_active": True,
                "name": ph["name"],
                "multiplier": ph["multiplier"],
                "bonus_type": "xp",
                "seconds_remaining": int((next_hour - now).total_seconds()),
                "description": f"{ph['multiplier']}x XP!"
            }
    
    # Find next power hour
    next_power_hour = None
    min_hours_until = 25
    
    for ph in DEFAULT_POWER_HOURS:
        hours_until = (ph["hour"] - current_hour) % 24
        if hours_until == 0:
            hours_until = 24
        if hours_until < min_hours_until:
            min_hours_until = hours_until
            next_power_hour = ph
    
    return {
        "is_active": False,
        "next_power_hour": next_power_hour,
        "hours_until_next": min_hours_until,
        "schedule": DEFAULT_POWER_HOURS
    }

@router.get("/schedule")
async def get_power_hour_schedule():
    """Get the power hour schedule"""
    now = datetime.now(timezone.utc)
    
    # Get upcoming scheduled power hours
    scheduled = await db.power_hours.find({
        "end_time": {"$gte": now.isoformat()},
        "is_active": True
    }, {"_id": 0}).sort("start_time", 1).limit(10).to_list(10)
    
    return {
        "default_schedule": DEFAULT_POWER_HOURS,
        "special_events": scheduled,
        "current_hour_utc": now.hour
    }

# ==================== ADMIN ENDPOINTS ====================

@router.post("/admin/create")
async def create_power_hour(
    name: str,
    multiplier: float = 2.0,
    bonus_type: str = "xp",  # xp, bids, both
    duration_minutes: int = 60,
    start_in_minutes: int = 0,
    description: Optional[str] = None,
    admin: dict = Depends(get_current_admin)
):
    """Create a special power hour event"""
    now = datetime.now(timezone.utc)
    start_time = now + timedelta(minutes=start_in_minutes)
    end_time = start_time + timedelta(minutes=duration_minutes)
    
    power_hour = {
        "id": str(uuid.uuid4()),
        "name": name,
        "description": description or f"{multiplier}x {bonus_type.upper()}!",
        "multiplier": multiplier,
        "bonus_type": bonus_type,
        "start_time": start_time.isoformat(),
        "end_time": end_time.isoformat(),
        "is_active": True,
        "created_by": admin["id"],
        "created_at": now.isoformat()
    }
    
    await db.power_hours.insert_one(power_hour)
    
    # Notify all users if starting now
    if start_in_minutes == 0:
        await notify_power_hour_start(power_hour)
    
    logger.info(f"Power hour created: {name} by {admin.get('name')}")
    
    return {"power_hour": power_hour, "message": "Power Hour erstellt!"}

@router.delete("/admin/{power_hour_id}")
async def cancel_power_hour(power_hour_id: str, admin: dict = Depends(get_current_admin)):
    """Cancel a scheduled power hour"""
    await db.power_hours.update_one(
        {"id": power_hour_id},
        {"$set": {"is_active": False}}
    )
    return {"message": "Power Hour abgesagt"}

# ==================== HELPER FUNCTIONS ====================

async def notify_power_hour_start(power_hour: dict):
    """Notify users that power hour has started"""
    # Get all users who want notifications
    users = await db.users.find(
        {"notification_preferences.power_hour": {"$ne": False}},
        {"_id": 0, "id": 1}
    ).limit(10000).to_list(10000)
    
    for user in users:
        await db.notifications.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": user["id"],
            "type": "power_hour",
            "title": f"⚡ {power_hour['name']} gestartet!",
            "message": power_hour.get("description", "Jetzt doppelte XP sammeln!"),
            "action_url": "/auctions",
            "read": False,
            "created_at": datetime.now(timezone.utc).isoformat()
        })

async def get_xp_multiplier(user_id: str = None) -> float:
    """Get current XP multiplier (for use in other modules)"""
    now = datetime.now(timezone.utc)
    
    # Check scheduled power hours
    scheduled = await db.power_hours.find_one({
        "start_time": {"$lte": now.isoformat()},
        "end_time": {"$gte": now.isoformat()},
        "is_active": True,
        "bonus_type": {"$in": ["xp", "both"]}
    })
    
    if scheduled:
        return scheduled.get("multiplier", 1.0)
    
    # Check default schedule
    current_hour = now.hour
    for ph in DEFAULT_POWER_HOURS:
        if current_hour == ph["hour"]:
            return ph["multiplier"]
    
    return 1.0

__all__ = ['get_xp_multiplier', 'DEFAULT_POWER_HOURS']
