"""
BidBlitz V2 - User Profile Routes
Profile viewing, editing, password management, and KYC.
"""

from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel, Field
from typing import Optional
from bson import ObjectId
from datetime import datetime, timezone
from core.database import db
from core.security import get_current_user, hash_password, verify_password, serialize_user, clear_auth_cookies
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
    """Compatibility view backed by the canonical /api/kyc status fields."""
    user = await get_current_user(request)
    raw = str(user.get("kyc_status") or "not_started").strip().lower()
    status = "approved" if raw == "verified" else "rejected" if raw in {"failed", "error"} else raw
    verified = status == "approved" and bool(user.get("kyc_verified", True))
    return {
        "status": status,
        "kyc_status": status,
        "kyc_verified": verified,
        "submitted_at": user.get("kyc_submitted_at"),
        "reviewed_at": user.get("kyc_reviewed_at"),
        "rejection_reason": user.get("kyc_rejection_reason"),
        "canonical_endpoint": "/api/kyc/status",
    }


@router.post("/kyc")
async def submit_kyc(req: KYCSubmitRequest, request: Request):
    """Retired text-only KYC path; document KYC is required for financial access."""
    await get_current_user(request)
    raise HTTPException(
        status_code=410,
        detail="Dieser alte KYC-Pfad ist deaktiviert. Bitte nutze die Dokument-Verifizierung unter /api/kyc/submit.",
    )


class ProfileUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    language: Optional[str] = Field(None, max_length=10)
    notifications_enabled: Optional[bool] = None
    email_notifications: Optional[bool] = None
    biometric_enabled: Optional[bool] = None
    dark_mode: Optional[bool] = None


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(..., min_length=1)
    new_password: str = Field(..., min_length=8, max_length=128)


class AccountDeletionRequest(BaseModel):
    current_password: str = Field(..., min_length=1, max_length=128)
    confirmation: str = Field(..., min_length=6, max_length=32)
    reason: Optional[str] = Field(None, max_length=500)


@router.get("/profile")
async def get_profile(request: Request):
    """Get current user profile."""
    user = await get_current_user(request)
    return {
        **serialize_user(user),
        "language": user.get("language", "de"),
        "kyc_level": user.get("kyc_level", "basic"),
        "kyc_status": user.get("kyc_status", "not_started"),
        "kyc_verified": bool(user.get("kyc_status") in ("approved", "verified") and user.get("kyc_verified", True)),
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
        "kyc_status": updated_user.get("kyc_status", "not_started"),
        "kyc_verified": bool(updated_user.get("kyc_status") in ("approved", "verified") and updated_user.get("kyc_verified", True)),
        "notifications_enabled": updated_user.get("notifications_enabled", True),
        "email_notifications": updated_user.get("email_notifications", True),
        "biometric_enabled": updated_user.get("biometric_enabled", False),
        "dark_mode": updated_user.get("dark_mode", True),
    }


@router.post("/change-password")
@limiter.limit(RATE_PASSWORD)
async def change_password(req: ChangePasswordRequest, request: Request, response: Response):
    """Change password and revoke every previously issued credential."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    ip, ua = get_client_info(request)

    password_hash = (user.get("password_hash") or "").strip()
    if not password_hash or not verify_password(req.current_password, password_hash):
        await log_audit(AuditEvent.PASSWORD_CHANGE, user_id=user_id, email=user["email"],
                        ip=ip, user_agent=ua, details={"success": False}, severity="warn")
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    if req.new_password == req.current_password:
        raise HTTPException(status_code=400, detail="Das neue Passwort muss sich vom aktuellen Passwort unterscheiden")

    new_hash = hash_password(req.new_password)
    changed_at = datetime.now(timezone.utc).isoformat()
    await db.users.update_one(
        {"_id": user["_id"]},
        {
            "$set": {
                "password_hash": new_hash,
                "updated_at": changed_at,
                "password_changed_at": changed_at,
            },
            "$inc": {"auth_version": 1},
            "$unset": {"password": ""},
        },
    )

    from routes.sessions import revoke_all_sessions
    await revoke_all_sessions(user_id)
    await db.pending_2fa.delete_many({"user_id": user_id})
    await db.otp_codes.delete_many({"user_id": user_id})
    clear_auth_cookies(response)
    response.delete_cookie("pending_2fa_session", path="/")

    await log_audit(AuditEvent.PASSWORD_CHANGE, user_id=user_id, email=user["email"],
                    ip=ip, user_agent=ua, details={"success": True, "all_sessions_revoked": True})

    return {
        "success": True,
        "message": "Passwort aktualisiert. Bitte melde dich auf deinen Geräten neu an.",
        "sessions_revoked": True,
    }


# ═══════════════════════════════════════════════════
# ACCOUNT CLOSURE / PRIVACY REQUEST
# ═══════════════════════════════════════════════════

@router.get("/deletion-request")
async def get_account_deletion_request(request: Request):
    """Return the current user's account-closure request status."""
    user = await get_current_user(request)
    req = await db.privacy_requests.find_one(
        {"user_id": str(user["_id"]), "type": "account_deletion"},
        {"_id": 0},
        sort=[("created_at", -1)],
    )
    return {
        "requested": bool(req),
        "request": req,
        "account_status": user.get("account_closure_status"),
    }


@router.post("/deletion-request")
@limiter.limit(RATE_PASSWORD)
async def request_account_deletion(req: AccountDeletionRequest, request: Request, response: Response):
    """Deactivate access and create a traceable privacy deletion/anonymisation request."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    ip, ua = get_client_info(request)

    if user.get("role") in {"admin", "super_admin"}:
        raise HTTPException(status_code=403, detail="Admin-Konten müssen über den internen Sicherheitsprozess geschlossen werden")

    confirmation = req.confirmation.strip().upper()
    if confirmation not in {"DELETE", "LÖSCHEN", "LOESCHEN"}:
        raise HTTPException(status_code=400, detail="Bitte Löschbestätigung eingeben")

    password_hash = (user.get("password_hash") or "").strip()
    if not password_hash or not verify_password(req.current_password, password_hash):
        await log_audit(
            AuditEvent.ADMIN_ACTION,
            user_id=user_id,
            email=user.get("email", ""),
            ip=ip,
            user_agent=ua,
            details={"action": "account_deletion_request", "success": False, "reason": "password_mismatch"},
            severity="warn",
        )
        raise HTTPException(status_code=400, detail="Aktuelles Passwort ist falsch")

    existing = await db.privacy_requests.find_one(
        {"user_id": user_id, "type": "account_deletion", "status": {"$in": ["requested", "reviewing", "retention_hold"]}},
        {"_id": 0},
    )
    if existing:
        clear_auth_cookies(response)
        return {"ok": True, "status": existing.get("status"), "request_id": existing.get("request_id"), "replayed": True}

    now = datetime.now(timezone.utc).isoformat()
    request_id = f"PRIV-{__import__('secrets').token_hex(8).upper()}"
    privacy_request = {
        "request_id": request_id,
        "type": "account_deletion",
        "user_id": user_id,
        "email": user.get("email", ""),
        "status": "requested",
        "reason": (req.reason or "").strip(),
        "retention_review_required": True,
        "requested_at": now,
        "created_at": now,
    }
    await db.privacy_requests.insert_one(privacy_request)

    await db.users.update_one(
        {"_id": user["_id"]},
        {
            "$set": {
                "login_disabled": True,
                "account_closure_status": "requested",
                "account_closure_requested_at": now,
                "account_closure_request_id": request_id,
            },
            "$inc": {"auth_version": 1},
        },
    )

    from routes.sessions import revoke_all_sessions
    await revoke_all_sessions(user_id)
    await db.pending_2fa.delete_many({"user_id": user_id})
    await db.otp_codes.delete_many({"user_id": user_id})
    clear_auth_cookies(response)
    response.delete_cookie("pending_2fa_session", path="/")

    await log_audit(
        AuditEvent.ADMIN_ACTION,
        user_id=user_id,
        email=user.get("email", ""),
        ip=ip,
        user_agent=ua,
        details={
            "action": "account_deletion_request",
            "request_id": request_id,
            "retention_review_required": True,
        },
        severity="info",
    )

    return {
        "ok": True,
        "status": "requested",
        "request_id": request_id,
        "message": "Dein Konto wurde deaktiviert und die Lösch-/Anonymisierungsprüfung wurde gestartet.",
        "replayed": False,
    }


# ═══════════════════════════════════════════════════
# QUICK ACCESS SHORTCUTS
# ═══════════════════════════════════════════════════

from typing import List


class QuickAccessUpdate(BaseModel):
    shortcuts: List[str]  # List of shortcut IDs like ["taxi", "scooter", "hotels"]


@router.get("/quick-access")
async def get_quick_access(request: Request):
    """Get user's personalized quick access shortcuts."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    doc = await db.user_preferences.find_one({"user_id": user_id}, {"_id": 0})
    shortcuts = doc.get("shortcuts", []) if doc else []
    return {"shortcuts": shortcuts}


@router.post("/quick-access")
async def update_quick_access(req: QuickAccessUpdate, request: Request):
    """Save user's personalized quick access shortcuts."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    # Max 8 shortcuts
    shortcuts = req.shortcuts[:8]
    await db.user_preferences.update_one(
        {"user_id": user_id},
        {"$set": {"shortcuts": shortcuts, "updated_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True,
    )
    return {"ok": True, "shortcuts": shortcuts}
