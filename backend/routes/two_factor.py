"""
BidBlitz V2 - Two-Factor Authentication (2FA)
Email OTP + TOTP Authenticator App based 2FA system.
"""

import secrets
import logging
import hashlib
import io
import base64
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from bson import ObjectId
import pyotp
import qrcode

from core.database import db
from core.security import get_current_user
from core.config import TEST_MODE

router = APIRouter(prefix="/api/2fa", tags=["2FA"])
logger = logging.getLogger("bidblitz.2fa")

# OTP Configuration
OTP_LENGTH = 6
OTP_EXPIRY_MINUTES = 10
OTP_MAX_ATTEMPTS = 3


class Enable2FARequest(BaseModel):
    method: str = "email"  # email or app


class VerifyOTPRequest(BaseModel):
    code: str


def generate_otp() -> str:
    """Generate a 6-digit OTP."""
    return ''.join([str(secrets.randbelow(10)) for _ in range(OTP_LENGTH)])


def _hash_otp_code(code: str) -> str:
    return hashlib.sha256(f"2fa-otp:{code}".encode("utf-8")).hexdigest()


def _hash_pending_token(token: str) -> str:
    return hashlib.sha256(f"2fa:{token}".encode("utf-8")).hexdigest()


def _otp_matches(doc: dict, code: str) -> bool:
    stored_hash = doc.get("code_hash")
    if stored_hash:
        return secrets.compare_digest(stored_hash, _hash_otp_code(code))
    legacy = str(doc.get("code") or "")
    return bool(legacy) and secrets.compare_digest(legacy, code)


def _backup_code_hash(code: str) -> str:
    return hashlib.sha256(f"2fa-backup:{code.upper()}".encode("utf-8")).hexdigest()



async def send_otp_email(email: str, otp: str, purpose: str = "verification", user_name: str = ""):
    """
    Send OTP via email using core email service.
    """
    try:
        from core.email import send_otp_email as core_send_otp
        result = core_send_otp(email, otp, purpose, user_name)
        return result
    except Exception as e:
        logger.warning(f"Email sending failed: {e}")
        return False


@router.get("/status")
async def get_2fa_status(request: Request):
    """Get user's 2FA status."""
    user = await get_current_user(request)
    
    is_enabled = user.get("two_factor_enabled", False)
    method = user.get("two_factor_method", None)
    
    backup_hashes = user.get("totp_backup_code_hashes") or []
    legacy_backup_codes = user.get("totp_backup_codes") or []
    return {
        "enabled": is_enabled,
        "method": method,
        "verified": user.get("two_factor_verified", False),
        "enabled_at": user.get("two_factor_enabled_at"),
        "backup_codes_remaining": len(backup_hashes) if backup_hashes else len(legacy_backup_codes),
    }


@router.post("/enable")
async def enable_2fa(req: Enable2FARequest, request: Request):
    """
    Enable 2FA for user.
    Sends OTP to email for verification.
    """
    user = await get_current_user(request)
    user_id = str(user["_id"])
    email = user.get("email")
    
    if user.get("two_factor_enabled"):
        raise HTTPException(status_code=400, detail="2FA bereits aktiviert")
    
    if req.method not in ["email"]:
        raise HTTPException(status_code=400, detail="Nur Email-2FA verfügbar")
    
    # Generate OTP
    otp = generate_otp()
    now = datetime.now(timezone.utc)
    expires = now + timedelta(minutes=OTP_EXPIRY_MINUTES)
    
    # Store OTP
    await db.otp_codes.delete_many({"user_id": user_id, "purpose": "enable_2fa"})
    await db.otp_codes.insert_one({
        "user_id": user_id,
        "code_hash": _hash_otp_code(otp),
        "purpose": "enable_2fa",
        "method": req.method,
        "attempts": 0,
        "created_at": now.isoformat(),
        "expires_at": expires.isoformat(),
    })
    
    # Send OTP
    sent = await send_otp_email(email, otp, "2FA Aktivierung")
    if not sent and not TEST_MODE:
        await db.otp_codes.delete_many({"user_id": user_id, "purpose": "enable_2fa"})
        raise HTTPException(status_code=503, detail="2FA-Code konnte nicht zugestellt werden")
    
    response = {
        "ok": True,
        "message": f"Bestätigungscode an {email[:3]}***{email[-10:]} gesendet",
        "expires_in_minutes": OTP_EXPIRY_MINUTES,
        "email_sent": sent,
    }
    if TEST_MODE and not sent:
        response["_test_otp"] = otp
    return response


@router.post("/verify-enable")
async def verify_enable_2fa(req: VerifyOTPRequest, request: Request):
    """Verify OTP to complete 2FA enablement."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    now = datetime.now(timezone.utc)
    
    # Find OTP
    otp_doc = await db.otp_codes.find_one({
        "user_id": user_id,
        "purpose": "enable_2fa",
        "expires_at": {"$gt": now.isoformat()}
    })
    
    if not otp_doc:
        raise HTTPException(status_code=400, detail="Kein gültiger Code gefunden")
    
    if otp_doc.get("attempts", 0) >= OTP_MAX_ATTEMPTS:
        await db.otp_codes.delete_one({"_id": otp_doc["_id"]})
        raise HTTPException(status_code=400, detail="Zu viele Versuche. Bitte neu anfordern.")
    
    # Check code
    if not _otp_matches(otp_doc, req.code):
        await db.otp_codes.update_one(
            {"_id": otp_doc["_id"]},
            {"$inc": {"attempts": 1}}
        )
        remaining = OTP_MAX_ATTEMPTS - otp_doc.get("attempts", 0) - 1
        raise HTTPException(status_code=400, detail=f"Falscher Code. {remaining} Versuche übrig.")
    
    # Enable 2FA
    await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {
            "two_factor_enabled": True,
            "two_factor_method": otp_doc["method"],
            "two_factor_verified": True,
            "two_factor_enabled_at": now.isoformat(),
        }}
    )
    
    # Delete OTP
    await db.otp_codes.delete_one({"_id": otp_doc["_id"]})
    
    # Create notification
    await db.notifications.insert_one({
        "id": secrets.token_hex(8),
        "user_id": user_id,
        "type": "security",
        "title": "2FA aktiviert",
        "message": "Zwei-Faktor-Authentifizierung wurde erfolgreich aktiviert.",
        "read": False,
        "created_at": now.isoformat(),
    })
    
    logger.info(f"2FA enabled for user {user_id}")
    
    return {
        "ok": True,
        "message": "2FA erfolgreich aktiviert!",
    }


@router.post("/disable")
async def disable_2fa(req: VerifyOTPRequest, request: Request):
    """Disable 2FA only after verifying the user's current second factor."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    if not user.get("two_factor_enabled"):
        raise HTTPException(status_code=400, detail="2FA nicht aktiviert")

    method = user.get("two_factor_method") or "email"
    valid = False
    used_backup_hash = None

    if method == "totp":
        secret = user.get("totp_secret")
        if secret:
            valid = pyotp.TOTP(secret).verify(req.code, valid_window=1)
        if not valid:
            candidate_hash = _backup_code_hash(req.code)
            hashes = list(user.get("totp_backup_code_hashes") or [])
            if candidate_hash in hashes:
                valid = True
                used_backup_hash = candidate_hash
            elif req.code.upper() in (user.get("totp_backup_codes") or []):
                # One-time migration support for legacy plaintext backup codes.
                valid = True
    else:
        now = datetime.now(timezone.utc)
        otp_doc = await db.otp_codes.find_one({
            "user_id": user_id,
            "purpose": "disable_2fa",
            "expires_at": {"$gt": now.isoformat()},
        })
        if otp_doc and otp_doc.get("attempts", 0) < OTP_MAX_ATTEMPTS:
            valid = _otp_matches(otp_doc, req.code)
            if not valid:
                await db.otp_codes.update_one({"_id": otp_doc["_id"]}, {"$inc": {"attempts": 1}})
            else:
                await db.otp_codes.delete_one({"_id": otp_doc["_id"]})

    if not valid:
        raise HTTPException(status_code=400, detail="Ungültiger 2FA-Code")

    update = {
        "$set": {
            "two_factor_enabled": False,
            "two_factor_method": None,
            "two_factor_verified": False,
            "two_factor_disabled_at": datetime.now(timezone.utc).isoformat(),
        },
        "$unset": {
            "totp_secret": "",
            "totp_secret_pending": "",
            "totp_backup_codes": "",
            "totp_backup_code_hashes": "",
        },
        "$inc": {"auth_version": 1},
    }
    await db.users.update_one({"_id": user["_id"]}, update)

    from routes.sessions import revoke_all_sessions
    await revoke_all_sessions(user_id)
    await db.pending_2fa.delete_many({"user_id": user_id})
    await db.otp_codes.delete_many({"user_id": user_id})

    logger.info("2FA disabled for user %s", user_id)
    return {"ok": True, "message": "2FA deaktiviert"}


@router.post("/send-disable-code")
async def send_disable_code(request: Request):
    """Send an email OTP for disabling email-based 2FA."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    email = user.get("email")

    if not user.get("two_factor_enabled"):
        raise HTTPException(status_code=400, detail="2FA nicht aktiviert")
    if (user.get("two_factor_method") or "email") != "email":
        raise HTTPException(status_code=400, detail="Nutze den aktuellen Authenticator-Code zum Deaktivieren")

    otp = generate_otp()
    now = datetime.now(timezone.utc)
    expires = now + timedelta(minutes=OTP_EXPIRY_MINUTES)
    await db.otp_codes.delete_many({"user_id": user_id, "purpose": "disable_2fa"})
    await db.otp_codes.insert_one({
        "user_id": user_id,
        "code_hash": _hash_otp_code(otp),
        "purpose": "disable_2fa",
        "attempts": 0,
        "created_at": now.isoformat(),
        "expires_at": expires.isoformat(),
    })

    sent = await send_otp_email(email, otp, "2FA Deaktivierung")
    if not sent and not TEST_MODE:
        await db.otp_codes.delete_many({"user_id": user_id, "purpose": "disable_2fa"})
        raise HTTPException(status_code=503, detail="2FA-Code konnte nicht zugestellt werden")

    response = {"ok": True, "message": "Code gesendet", "expires_in_minutes": OTP_EXPIRY_MINUTES}
    if TEST_MODE and not sent:
        response["_test_otp"] = otp
    return response


@router.post("/login-verify")
async def verify_login_otp(req: VerifyOTPRequest, request: Request):
    """
    Verify OTP during login (called after password verification).
    """
    # Get pending login session
    session_token = request.cookies.get("pending_2fa_session")
    if not session_token:
        raise HTTPException(status_code=400, detail="Keine ausstehende Anmeldung")
    
    pending = await db.pending_2fa.find_one({
        "$or": [
            {"token_hash": _hash_pending_token(session_token)},
            {"token": session_token},
        ]
    })
    if not pending:
        raise HTTPException(status_code=400, detail="Session abgelaufen")
    
    user_id = pending["user_id"]
    now = datetime.now(timezone.utc)
    
    # Verify OTP
    otp_doc = await db.otp_codes.find_one({
        "user_id": user_id,
        "purpose": "login",
        "expires_at": {"$gt": now.isoformat()}
    })
    
    if not otp_doc:
        raise HTTPException(status_code=400, detail="Kein Code gefunden")
    
    if otp_doc.get("attempts", 0) >= OTP_MAX_ATTEMPTS:
        await db.otp_codes.delete_one({"_id": otp_doc["_id"]})
        await db.pending_2fa.delete_one({"_id": pending["_id"]})
        raise HTTPException(status_code=400, detail="Zu viele Versuche")
    
    if not _otp_matches(otp_doc, req.code):
        await db.otp_codes.update_one(
            {"_id": otp_doc["_id"]},
            {"$inc": {"attempts": 1}}
        )
        raise HTTPException(status_code=400, detail="Falscher Code")
    
    # Clean up
    await db.otp_codes.delete_one({"_id": otp_doc["_id"]})
    await db.pending_2fa.delete_one({"_id": pending["_id"]})
    
    # Return success - auth route will complete login
    return {
        "ok": True,
        "user_id": user_id,
        "verified": True,
    }


# ═══════════════════════════════════════════════════════════════
# AUTHENTICATOR APP (TOTP) - NEW
# ═══════════════════════════════════════════════════════════════

@router.post("/totp/setup")
async def setup_totp(request: Request):
    """
    Setup TOTP (Time-based One-Time Password) for Authenticator apps.
    Returns QR code + secret for user to scan with Google Authenticator, Authy, etc.
    """
    user = await get_current_user(request)
    user_id = str(user["_id"])
    email = user.get("email", "")
    
    # Generate TOTP secret
    totp_secret = pyotp.random_base32()
    
    # Generate provisioning URI (for QR code)
    totp = pyotp.TOTP(totp_secret)
    provisioning_uri = totp.provisioning_uri(
        name=email,
        issuer_name="BidBlitz"
    )
    
    # Generate QR code
    qr = qrcode.QRCode(version=1, box_size=10, border=4)
    qr.add_data(provisioning_uri)
    qr.make(fit=True)
    
    img = qr.make_image(fill_color="black", back_color="white")
    
    # Convert to base64
    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    buffer.seek(0)
    qr_base64 = base64.b64encode(buffer.getvalue()).decode()
    
    # Store temp secret (not enabled yet until verified)
    await db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {"totp_secret_pending": totp_secret}},
    )
    
    return {
        "ok": True,
        "secret": totp_secret,
        "qr_code": f"data:image/png;base64,{qr_base64}",
        "provisioning_uri": provisioning_uri,
        "message": "Scanne den QR-Code mit deiner Authenticator-App",
    }


@router.post("/totp/verify-and-enable")
async def verify_and_enable_totp(otp: VerifyOTPRequest, request: Request):
    """
    Verify TOTP code and enable 2FA.
    User must provide correct code from their Authenticator app.
    """
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    totp_secret = user.get("totp_secret_pending")
    if not totp_secret:
        raise HTTPException(status_code=400, detail="TOTP nicht eingerichtet. Ruf zuerst /totp/setup auf")
    
    # Verify code
    totp = pyotp.TOTP(totp_secret)
    if not totp.verify(otp.code, valid_window=1):  # Allow 30s window
        raise HTTPException(status_code=400, detail="Ungültiger Code")
    
    # Generate one-time backup codes; store only hashes.
    backup_codes = [secrets.token_hex(4).upper() for _ in range(10)]
    backup_code_hashes = [_backup_code_hash(code) for code in backup_codes]
    
    await db.users.update_one(
        {"_id": user["_id"]},
        {
            "$set": {
                "two_factor_enabled": True,
                "two_factor_method": "totp",
                "two_factor_verified": True,
                "totp_secret": totp_secret,
                "totp_backup_code_hashes": backup_code_hashes,
                "two_factor_enabled_at": datetime.now(timezone.utc).isoformat(),
            },
            "$unset": {"totp_secret_pending": "", "totp_backup_codes": ""},
        },
    )
    
    logger.info(f"User {user_id} enabled TOTP 2FA")
    
    return {
        "ok": True,
        "message": "2FA erfolgreich aktiviert",
        "backup_codes": backup_codes,
        "backup_codes_warning": "Speichere diese Codes sicher. Du brauchst sie, wenn du dein Gerät verlierst.",
    }


@router.post("/totp/verify")
async def verify_totp_login(otp: VerifyOTPRequest, session_token: str):
    """
    Verify TOTP code during login.
    Called after successful username/password login when 2FA is enabled.
    """
    # Get pending 2FA session
    pending = await db.pending_2fa.find_one({
        "$or": [
            {"token_hash": _hash_pending_token(session_token)},
            {"token": session_token},
        ]
    })
    if not pending:
        raise HTTPException(status_code=400, detail="Ungültige oder abgelaufene Session")
    
    # Check expiry (10 min)
    created_at = datetime.fromisoformat(pending["created_at"].replace("Z", "+00:00"))
    if created_at.tzinfo is None:
        created_at = created_at.replace(tzinfo=timezone.utc)
    
    if (datetime.now(timezone.utc) - created_at).total_seconds() > 600:
        await db.pending_2fa.delete_one({"_id": pending["_id"]})
        raise HTTPException(status_code=400, detail="Session abgelaufen")
    
    user_id = pending["user_id"]
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=404, detail="Benutzer nicht gefunden")
    
    totp_secret = user.get("totp_secret")
    if not totp_secret:
        raise HTTPException(status_code=400, detail="TOTP nicht aktiviert")
    
    # Verify code (allow backup codes)
    totp = pyotp.TOTP(totp_secret)
    code_valid = totp.verify(otp.code, valid_window=1)
    
    # Check one-time backup codes by hash, with legacy migration fallback.
    candidate_hash = _backup_code_hash(otp.code)
    backup_hashes = list(user.get("totp_backup_code_hashes") or [])
    legacy_backup_codes = list(user.get("totp_backup_codes") or [])
    is_backup_code = candidate_hash in backup_hashes or otp.code.upper() in legacy_backup_codes

    if not code_valid and not is_backup_code:
        raise HTTPException(status_code=400, detail="Ungültiger Code")

    if is_backup_code:
        if candidate_hash in backup_hashes:
            backup_hashes.remove(candidate_hash)
        if otp.code.upper() in legacy_backup_codes:
            legacy_backup_codes.remove(otp.code.upper())
        await db.users.update_one(
            {"_id": user["_id"]},
            {
                "$set": {"totp_backup_code_hashes": backup_hashes},
                "$unset": {"totp_backup_codes": ""},
            },
        )
        logger.info("User %s used backup code for TOTP login", user_id)
    
    # Clean up pending session
    await db.pending_2fa.delete_one({"_id": pending["_id"]})
    
    return {
        "ok": True,
        "user_id": user_id,
        "verified": True,
        "backup_code_used": is_backup_code,
        "remaining_backup_codes": len(backup_hashes) if is_backup_code else None,
    }




