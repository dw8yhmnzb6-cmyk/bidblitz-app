"""
Staff Module Settings
=====================
Merchant configuration for Staff Module
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
import os

router = APIRouter(prefix="/api/staff/settings", tags=["staff-settings"])

from motor.motor_asyncio import AsyncIOMotorClient
MONGO_URL = os.getenv("MONGO_URL")
client = AsyncIOMotorClient(MONGO_URL)
db = client[os.getenv("DB_NAME", "bidblitz")]

class StaffSettings(BaseModel):
    work_week_days: List[int] = [1, 2, 3, 4, 5]  # Monday-Friday
    work_hours_per_day: float = 8.0
    break_rule_minutes: int = 30
    overtime_rule: str = "auto"  # auto, manual, disabled
    gps_checkin_required: bool = False
    qr_checkin_enabled: bool = True
    nfc_checkin_enabled: bool = False
    default_vacation_days: int = 24
    shift_reminder_enabled: bool = True
    shift_reminder_minutes: int = 30
    auto_checkout_hours: Optional[int] = None  # Auto checkout after X hours
    geofence_radius_km: float = 0.1

@router.get("/")
async def get_staff_settings(merchant_id: str = "test-merchant"):
    """Get merchant's staff settings"""
    settings = await db.staff_settings.find_one(
        {"merchant_id": merchant_id},
        {"_id": 0}
    )
    
    if not settings:
        # Return defaults
        default_settings = StaffSettings().dict()
        default_settings["merchant_id"] = merchant_id
        return {"success": True, "settings": default_settings}
    
    return {"success": True, "settings": settings}

@router.put("/")
async def update_staff_settings(
    settings: StaffSettings,
    merchant_id: str = "test-merchant"
):
    """Update staff settings"""
    settings_data = settings.dict()
    settings_data["merchant_id"] = merchant_id
    settings_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.staff_settings.update_one(
        {"merchant_id": merchant_id},
        {"$set": settings_data},
        upsert=True
    )
    
    return {
        "success": True,
        "message": "Einstellungen gespeichert",
        "settings": settings_data
    }
