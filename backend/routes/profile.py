"""
BidBlitz V2 - User Profile Routes
Profile viewing, editing, password management, and KYC.
"""

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from typing import Optional
from bson import ObjectId
from datetime import datetime, timezone
from core.database import db
from core.security import get_current_user, hash_password, verify_password, serialize_user
from core.audit import log_audit, AuditEvent, get_client_info
from core.rate_limit import limiter, RATE_PASSWORD

router = APIRouter(prefix="/api/user", tags=["user"])


# ═══════════════════════════════════════════════════
# KYC (Know Your Customer)
# ═══════════════════════════════════════════════════

class KYCSubmitRequest(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=200)
    date_of_birth: str = Field(..., description="YYYY-MM-DD")
    street: str = Field(..., min_length=2, max_length=200)
    city: str = Field(..., min_length=1, max_length=100)
    postal_code: str = Field(..., min_length=2, max_length=20)
    country: str = Field(..., min_length=2, max_length=100)


@router.get("/kyc")
async def get_kyc_status(request: Request):
    """Get current user's KYC data and verification status."""
    user = await get_current_user(request)
    kyc = user.get("kyc")
    if not kyc:
        return {"status": "not_submitted", "data": None}
    return {
        "status": kyc.get("status", "not_submitted"),
        "data": {
            "full_name": kyc.get("full_name", ""),
            "date_of_birth": kyc.get("date_of_birth", ""),
            "street": kyc.get("street", ""),
            "city": kyc.get("city", ""),
            "postal_code": kyc.get("postal_code", ""),
            "country": kyc.get("country", ""),
        },
        "submitted_at": kyc.get("submitted_at"),
        "reviewed_at": kyc.get("reviewed_at"),
    }


@router.post("/kyc")
async def submit_kyc(req: KYCSubmitRequest, request: Request):
    """Submit KYC data for verification."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    ip, ua = get_client_info(request)

    # Validate date of birth format
    try:
        dob = datetime.strptime(req.date_of_birth, "%Y-%m-%d")
        age = (datetime.now() - dob).days // 365
        if age < 16:
            raise HTTPException(status_code=400, detail="You must be at least 16 years old")
        if age > 120:
            raise HTTPException(status_code=400, detail="Invalid date of birth")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")

    kyc_data = {
        "full_name": req.full_name.strip(),
        "date_of_birth": req.date_of_birth,
        "street": req.street.strip(),
        "city": req.city.strip(),
        "postal_code": req.postal_code.strip(),
        "country": req.country.strip(),
        "status": "pending",
        "submitted_at": datetime.now(timezone.utc).isoformat(),
        "reviewed_at": None,
    }

    await db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {"kyc": kyc_data, "kyc_level": "pending"}},
    )

    await log_audit(AuditEvent.PROFILE_UPDATE, user_id=user_id, email=user["email"],
                    ip=ip, user_agent=ua,
                    details={"action": "kyc_submitted"})

    return {
        "status": "pending",
        "message": "KYC data submitted successfully. Verification in progress.",
    }


class ProfileUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    language: Optional[str] = Field(None, max_length=10)
    notifications_enabled: Optional[bool] = None
    email_notifications: Optional[bool] = None
    biometric_enabled: Optional[bool] = None
    dark_mode: Optional[bool] = None


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(..., min_length=1)
    new_password: str = Field(..., min_length=6, max_length=128)


@router.get("/profile")
async def get_profile(request: Request):
    """Get current user profile."""
    user = await get_current_user(request)
    return {
        **serialize_user(user),
        "language": user.get("language", "de"),
        "kyc_level": user.get("kyc_level", "basic"),
        "kyc_verified": user.get("kyc_level", "basic") in ("verified", "premium"),
        "notifications_enabled": user.get("notifications_enabled", True),
        "email_notifications": user.get("email_notifications", True),
        "biometric_enabled": user.get("biometric_enabled", False),
        "dark_mode": user.get("dark_mode", True),
    }


@router.put("/profile")
async def update_profile(req: ProfileUpdate, request: Request):
    """Update user profile fields."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    ip, ua = get_client_info(request)

    update = {}
    if req.name is not None:
        update["name"] = req.name.strip()
    if req.language is not None:
        update["language"] = req.language
    if req.notifications_enabled is not None:
        update["notifications_enabled"] = req.notifications_enabled
    if req.email_notifications is not None:
        update["email_notifications"] = req.email_notifications
    if req.biometric_enabled is not None:
        update["biometric_enabled"] = req.biometric_enabled
    if req.dark_mode is not None:
        update["dark_mode"] = req.dark_mode

    if not update:
        raise HTTPException(status_code=400, detail="No fields to update")

    update["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.users.update_one({"_id": user["_id"]}, {"$set": update})

    await log_audit(AuditEvent.PROFILE_UPDATE, user_id=user_id, email=user["email"],
                    ip=ip, user_agent=ua,
                    details={"fields_changed": list(update.keys())})

    updated_user = await db.users.find_one({"_id": user["_id"]})
    return {
        **serialize_user(updated_user),
        "language": updated_user.get("language", "de"),
        "kyc_level": updated_user.get("kyc_level", "basic"),
        "kyc_verified": updated_user.get("kyc_level", "basic") in ("verified", "premium"),
        "notifications_enabled": updated_user.get("notifications_enabled", True),
        "email_notifications": updated_user.get("email_notifications", True),
        "biometric_enabled": updated_user.get("biometric_enabled", False),
        "dark_mode": updated_user.get("dark_mode", True),
    }


@router.post("/change-password")
@limiter.limit(RATE_PASSWORD)
async def change_password(req: ChangePasswordRequest, request: Request):
    """Change user password."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    ip, ua = get_client_info(request)

    if not verify_password(req.current_password, user["password_hash"]):
        await log_audit(AuditEvent.PASSWORD_CHANGE, user_id=user_id, email=user["email"],
                        ip=ip, user_agent=ua, details={"success": False}, severity="warn")
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    new_hash = hash_password(req.new_password)
    await db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {"password_hash": new_hash, "updated_at": datetime.now(timezone.utc).isoformat()}},
    )

    await log_audit(AuditEvent.PASSWORD_CHANGE, user_id=user_id, email=user["email"],
                    ip=ip, user_agent=ua, details={"success": True})

    return {"success": True, "message": "Password updated successfully"}
