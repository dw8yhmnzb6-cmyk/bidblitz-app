"""
Maintenance Mode Router
Allows admins to enable/disable maintenance mode for the platform
Supports scheduled maintenance with start and end times
"""
from fastapi import APIRouter, Depends, HTTPException, Request
from datetime import datetime, timezone, timedelta
from pydantic import BaseModel
from typing import Optional
from config import db, logger
from dependencies import get_admin_user

router = APIRouter(prefix="/maintenance", tags=["Maintenance"])

# ==================== SCHEMAS ====================

class ScheduleMaintenanceRequest(BaseModel):
    message: str = "Wir führen gerade Wartungsarbeiten durch. Bitte versuchen Sie es später erneut."
    start_time: str  # ISO format
    end_time: str    # ISO format

# ==================== MAINTENANCE MODE ENDPOINTS ====================

@router.get("/status")
async def get_maintenance_status():
    """Get current maintenance mode status - public endpoint"""
    settings = await db.settings.find_one({"type": "maintenance"})
    if not settings:
        return {
            "enabled": False,
            "message": "",
            "estimated_end": None,
            "scheduled": None
        }
    
    now = datetime.now(timezone.utc)
    
    # Check if scheduled maintenance is active
    scheduled = settings.get("scheduled")
    if scheduled and scheduled.get("start_time") and scheduled.get("end_time"):
        start_time = datetime.fromisoformat(scheduled["start_time"].replace('Z', '+00:00'))
        end_time = datetime.fromisoformat(scheduled["end_time"].replace('Z', '+00:00'))
        
        if start_time <= now <= end_time:
            return {
                "enabled": True,
                "message": scheduled.get("message", settings.get("message", "")),
                "estimated_end": scheduled["end_time"],
                "scheduled": scheduled,
                "is_scheduled_active": True
            }
    
    return {
        "enabled": settings.get("enabled", False),
        "message": settings.get("message", ""),
        "estimated_end": settings.get("estimated_end"),
        "scheduled": scheduled
    }


@router.post("/toggle")
async def toggle_maintenance_mode(
    enabled: bool = True,
    message: str = "Wir führen gerade Wartungsarbeiten durch. Bitte versuchen Sie es später erneut.",
    estimated_minutes: int = None,
    admin = Depends(get_admin_user)
):
    """Toggle maintenance mode - admin only"""
    estimated_end = None
    if enabled and estimated_minutes:
        estimated_end = (datetime.now(timezone.utc) + 
                        timedelta(minutes=estimated_minutes)).isoformat()
    
    await db.settings.update_one(
        {"type": "maintenance"},
        {
            "$set": {
                "enabled": enabled,
                "message": message,
                "estimated_end": estimated_end,
                "updated_by": admin["email"],
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        },
        upsert=True
    )
    
    logger.info(f"Maintenance mode {'enabled' if enabled else 'disabled'} by {admin['email']}")
    
    return {
        "success": True,
        "enabled": enabled,
        "message": message,
        "estimated_end": estimated_end
    }


@router.post("/schedule")
async def schedule_maintenance(
    data: ScheduleMaintenanceRequest,
    admin = Depends(get_admin_user)
):
    """Schedule maintenance for a specific time window - admin only"""
    try:
        start_time = datetime.fromisoformat(data.start_time.replace('Z', '+00:00'))
        end_time = datetime.fromisoformat(data.end_time.replace('Z', '+00:00'))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Ungültiges Datumsformat: {str(e)}")
    
    if end_time <= start_time:
        raise HTTPException(status_code=400, detail="Endzeit muss nach Startzeit liegen")
    
    if start_time < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Startzeit kann nicht in der Vergangenheit liegen")
    
    scheduled = {
        "start_time": start_time.isoformat(),
        "end_time": end_time.isoformat(),
        "message": data.message,
        "created_by": admin["email"],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.settings.update_one(
        {"type": "maintenance"},
        {
            "$set": {
                "scheduled": scheduled,
                "updated_by": admin["email"],
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        },
        upsert=True
    )
    
    logger.info(f"Maintenance scheduled by {admin['email']}: {start_time} to {end_time}")
    
    return {
        "success": True,
        "scheduled": scheduled
    }


@router.delete("/schedule")
async def cancel_scheduled_maintenance(admin = Depends(get_admin_user)):
    """Cancel scheduled maintenance - admin only"""
    await db.settings.update_one(
        {"type": "maintenance"},
        {
            "$unset": {"scheduled": ""},
            "$set": {
                "updated_by": admin["email"],
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    logger.info(f"Scheduled maintenance cancelled by {admin['email']}")
    
    return {"success": True, "message": "Geplante Wartung wurde abgebrochen"}


@router.get("/admin/status")
async def get_maintenance_admin_status(admin = Depends(get_admin_user)):
    """Get detailed maintenance status for admin panel"""
    settings = await db.settings.find_one({"type": "maintenance"})
    if not settings:
        return {
            "enabled": False,
            "message": "",
            "estimated_end": None,
            "updated_by": None,
            "updated_at": None,
            "scheduled": None
        }
    return {
        "enabled": settings.get("enabled", False),
        "message": settings.get("message", ""),
        "estimated_end": settings.get("estimated_end"),
        "updated_by": settings.get("updated_by"),
        "updated_at": settings.get("updated_at"),
        "scheduled": settings.get("scheduled")
    }
