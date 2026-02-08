"""
Maintenance Mode Router
Allows admins to enable/disable maintenance mode for the platform
"""
from fastapi import APIRouter, Depends, HTTPException, Request
from datetime import datetime, timezone
from config import db, logger
from dependencies import get_admin_user

router = APIRouter(prefix="/maintenance", tags=["Maintenance"])

# ==================== MAINTENANCE MODE ENDPOINTS ====================

@router.get("/status")
async def get_maintenance_status():
    """Get current maintenance mode status - public endpoint"""
    settings = db.settings.find_one({"type": "maintenance"})
    if not settings:
        return {
            "enabled": False,
            "message": "",
            "estimated_end": None
        }
    return {
        "enabled": settings.get("enabled", False),
        "message": settings.get("message", ""),
        "estimated_end": settings.get("estimated_end")
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
                        __import__('datetime').timedelta(minutes=estimated_minutes)).isoformat()
    
    db.settings.update_one(
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


@router.get("/admin/status")
async def get_maintenance_admin_status(admin = Depends(get_admin_user)):
    """Get detailed maintenance status for admin panel"""
    settings = db.settings.find_one({"type": "maintenance"})
    if not settings:
        return {
            "enabled": False,
            "message": "",
            "estimated_end": None,
            "updated_by": None,
            "updated_at": None
        }
    return {
        "enabled": settings.get("enabled", False),
        "message": settings.get("message", ""),
        "estimated_end": settings.get("estimated_end"),
        "updated_by": settings.get("updated_by"),
        "updated_at": settings.get("updated_at")
    }
