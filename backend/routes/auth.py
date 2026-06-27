from fastapi import APIRouter, HTTPException, Request, Response
from datetime import datetime, timezone, timedelta
import hashlib
from bson import ObjectId
from core.database import db
from core.security import (
    hash_password, verify_password, create_access_token, create_refresh_token,
    set_auth_cookies, clear_auth_cookies, serialize_user, get_current_user
)
from core.config import MAX_LOGIN_ATTEMPTS, LOCKOUT_MINUTES
from core.rate_limit import limiter, RATE_REGISTER, RATE_LOGIN
from core.audit import log_audit, AuditEvent, get_client_info
from core.soft_launch import is_email_whitelisted, is_registration_open, validate_invite_code, redeem_invite_code
from schemas.models import RegisterRequest, LoginRequest
import secrets
import random
import bcrypt
import logging

logger = logging.getLogger("bidblitz.auth")
router = APIRouter(prefix="/api/auth", tags=["auth"])


def _auth_email_candidates(raw_email: str) -> list[str]:
    email = (raw_email or "").lower().strip()
    if not email:
        return [""]
    candidates = [email]
    if email.endswith("@bidblitz.ae"):
        candidates.append(email[:-2] + "com")
    elif email.endswith("@bidblitz.com"):
        candidates.append(email[:-3] + "ae")
    return list(dict.fromkeys(candidates))


async def _record_login_success(user_id: str, ip: str, user_agent: str):
    await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {
            "$set": {
                "last_login_at": datetime.now(timezone.utc).isoformat(),
                "last_login_ip": ip,
                "last_login_user_agent": (user_agent or "")[:256],
            },
            "$inc": {"login_count": 1},
        },
    )


def _get_password_hash(user: dict) -> str:
    return (user.get("password_hash") or user.get("password") or "").strip()


def _verify_legacy_password(plain_password: str, user: dict) -> str | None:
    candidates = []
    for key in ("password_hash", "password"):
        value = (user.get(key) or "").strip()
        if value and value not in candidates:
            candidates.append(value)
    for hashed_value in candidates:
        try:
            if verify_password(plain_password, hashed_value):
                return hashed_value
        except Exception:
            continue
    return None


def _hash_reset_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _parse_reset_expiry(value) -> datetime:
    parsed = value if isinstance(value, datetime) else datetime.fromisoformat(str(value))
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed


async def _issue_password_reset(
    email: str,
    request: Request | None = None,
    issued_by: str = "self_service",
    reason: str = "forgot_password",
    force_password_change: bool = False,
):
    user = await db.users.find_one({"email": email})
    if not user:
        return None

    raw_token = secrets.token_urlsafe(32)
    token_hash = _hash_reset_token(raw_token)
    now = datetime.now(timezone.utc)
    expires = now + timedelta(hours=1)
    ip, ua = get_client_info(request) if request else ("", "")

    await db.password_resets.update_many(
        {"email": email, "used_at": None},
        {"$set": {"revoked_at": now.isoformat(), "revoked_reason": "superseded"}},
    )

    await db.password_resets.insert_one({
        "email": email,
        "user_id": str(user["_id"]),
        "token_hash": token_hash,
        "expires_at": expires,
        "created_at": now,
        "used_at": None,
        "verified_at": None,
        "issued_by": issued_by,
        "reason": reason,
        "requested_ip": ip,
        "requested_user_agent": ua,
        "force_password_change": force_password_change,
    })

    if force_password_change:
        await db.users.update_one(
            {"_id": user["_id"]},
            {"$set": {
                "force_password_change": True,
                "force_password_change_reason": reason,
                "force_password_change_requested_at": now.isoformat(),
            }},
        )

    await log_audit(
        "password_reset_requested",
        user_id=str(user["_id"]),
        email=email,
        ip=ip,
        user_agent=ua,
        details={
            "issued_by": issued_by,
            "reason": reason,
            "expires_at": expires.isoformat(),
            "force_password_change": force_password_change,
        },
        severity="info",
    )

    email_sent = False
    try:
        from core.email import send_password_reset_email
        user_name = user.get("name") or user.get("full_name") or user.get("username", "")
        email_sent = bool(send_password_reset_email(email, raw_token, user_name))
    except Exception as e:
        logger.error(f"Failed to send password reset email to {email}: {e}")

    return {
        "token": raw_token,
        "expires_at": expires.isoformat(),
        "user_id": str(user["_id"]),
        "email": email,
        "force_password_change": force_password_change,
        "email_sent": email_sent,
    }


def generate_card_number():
    groups = [str(random.randint(1000, 9999)) for _ in range(4)]
    return " ".join(groups)


def generate_card_expiry():
    month = random.randint(1, 12)
    year = random.randint(27, 32)
    return f"{month:02d}/{year}"


@router.post("/register")
@limiter.limit(RATE_REGISTER)
async def register(req: RegisterRequest, request: Request, response: Response):
    email = req.email.lower().strip()
    ip, ua = get_client_info(request)

    # TEMPORARY FIX: Registration always open (soft launch disabled)
    invite_used = None
    invite_type = "user"
    # Soft launch gate: invite code OR whitelist OR open registration
    # if not await is_registration_open():
    #     if req.invite_code:
    #         valid, msg, code_type = await validate_invite_code(req.invite_code)
    #         if not valid:
    #             raise HTTPException(status_code=403, detail=msg)
    #         invite_used = req.invite_code.strip().upper()
    #         invite_type = code_type or "user"
    #     elif not await is_email_whitelisted(email):
    #         raise HTTPException(status_code=403, detail="Registration requires an invite code during soft launch.")

    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    role = "merchant" if invite_type == "merchant" else "user"
    # 🎁 WELCOME BONUS: 5€ EUR + 10 BLZ für jeden neuen User
    WELCOME_EUR = 5.0
    WELCOME_BLZ = 10.0
    
    # Generate unique user number (BE + 5 digits)
    user_number = None
    while True:
        potential_number = f"BE{random.randint(10000, 99999)}"
        existing = await db.users.find_one({"user_number": potential_number})
        if not existing:
            user_number = potential_number
            break
    
    user_doc = {
        "email": email,
        "password_hash": hash_password(req.password),
        "name": req.name.strip(),
        "role": role,
        "user_number": user_number,
        "balance": WELCOME_EUR,
        "balance_blz": WELCOME_BLZ,
        "currency": "EUR",
        "card_number": generate_card_number(),
        "card_expiry": generate_card_expiry(),
        "payment_barcode": f"BLZ-{secrets.token_hex(6).upper()}",
        "welcome_bonus_received": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "registered_at": datetime.now(timezone.utc).isoformat(),
        "last_login_at": None,
        "last_login_ip": "",
        "last_login_user_agent": "",
        "login_count": 0,
    }
    # Save requested role if provided (admin approval required)
    if req.requested_role and req.requested_role in ("merchant", "influencer", "manager", "investor"):
        user_doc["requested_role"] = req.requested_role
        user_doc["approval_status"] = "pending"
    result = await db.users.insert_one(user_doc)
    user_doc["_id"] = result.inserted_id
    user_id = str(result.inserted_id)

    # Create merchant profile
    merchant_doc = {
        "user_id": user_id,
        "business_name": req.name.strip() if role == "merchant" else f"{req.name.strip()}'s Store",
        "total_earnings": 0.0,
        "gross_earnings": 0.0,
        "total_fees": 0.0,
        "available_payout": 0.0,
        "pending_payout": 0.0,
        "total_transactions": 0,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.merchants.insert_one(merchant_doc)

    # 🎁 Welcome Bonus Transaction für Verlauf
    try:
        await db.transactions.insert_one({
            "user_id": user_id,
            "type": "bonus",
            "amount": WELCOME_EUR,
            "currency": "EUR",
            "status": "completed",
            "description": "Willkommens-Bonus",
            "merchant_name": "BidBlitz",
            "category": "bonus",
            "reference": f"WELCOME-{secrets.token_hex(4).upper()}",
            "date": datetime.now(timezone.utc).isoformat(),
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    except Exception as e:
        logger.warning(f"Welcome bonus tx failed: {e}")

    access_token = create_access_token(user_id, email)
    refresh_token = create_refresh_token(user_id)
    set_auth_cookies(response, access_token, refresh_token)

    await log_audit(AuditEvent.REGISTER, user_id=user_id, email=email,
                    ip=ip, user_agent=ua, details={"role": role, "invite_code": invite_used or ""})

    # Redeem invite code if used
    if invite_used:
        await redeem_invite_code(invite_used, email, user_id)

    # Send onboarding notifications
    try:
        from routes.notifications import create_onboarding_notifications
        await create_onboarding_notifications(user_id, req.name.strip())
    except Exception:
        pass
    
    # Send welcome email
    try:
        from core.email import send_welcome_email
        send_welcome_email(email, req.name.strip())
    except Exception as e:
        logger.warning(f"Failed to send welcome email: {e}")

    # Track registration conversion
    try:
        day_key = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        await db.conversion_events.insert_one({
            "event": "register_complete",
            "session_id": "",
            "meta": {"role": role, "invite_code": invite_used or ""},
            "day": day_key,
            "ts": datetime.now(timezone.utc).isoformat(),
            "user_id": user_id,
            "ip": ip,
        })
        await db.conversion_metrics.update_one(
            {"day": day_key, "event": "register_complete"},
            {"$inc": {"count": 1}, "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}},
            upsert=True,
        )
    except Exception:
        pass

    # Send welcome email (non-blocking)
    try:
        from routes.email_service import notify_welcome
        import asyncio as _aio
        _aio.create_task(notify_welcome(
            user_email=email,
            user_name=user_doc.get("username") or user_doc.get("full_name") or email.split("@")[0],
        ))
    except Exception:
        pass

    return serialize_user(user_doc)


@router.post("/login")
@limiter.limit(RATE_LOGIN)
async def login(req: LoginRequest, request: Request, response: Response):
    email_candidates = _auth_email_candidates(req.email)
    email = email_candidates[0]
    ip, ua = get_client_info(request)
    identifier = f"{ip}:{email}"

    # Brute force check
    attempt = await db.login_attempts.find_one({"identifier": identifier})
    if attempt and attempt.get("attempts", 0) >= MAX_LOGIN_ATTEMPTS:
        locked_until = attempt.get("locked_until")
        if locked_until and datetime.now(timezone.utc) < datetime.fromisoformat(locked_until):
            await log_audit(AuditEvent.LOGIN_LOCKED, email=email, ip=ip, user_agent=ua,
                            details={"reason": "brute_force_lockout"}, severity="warn")
            raise HTTPException(status_code=429, detail=f"Account locked. Try again in {LOCKOUT_MINUTES} minutes.")
        else:
            await db.login_attempts.delete_one({"identifier": identifier})

    user = None
    matched_email = email
    for candidate in email_candidates:
        user = await db.users.find_one({"email": candidate})
        if user:
            matched_email = candidate
            break

    # Soft launch gate (before password check to avoid leaking user existence)
    if user and not await is_email_whitelisted(matched_email):
        raise HTTPException(status_code=403, detail="Access restricted during soft launch. Contact support.")

    matched_hash = _verify_legacy_password(req.password, user) if user else None
    if not user or not matched_hash:
        # Track failed attempt
        if attempt:
            new_attempts = attempt.get("attempts", 0) + 1
            update = {"$set": {"attempts": new_attempts}}
            if new_attempts >= MAX_LOGIN_ATTEMPTS:
                locked = (datetime.now(timezone.utc) + __import__("datetime").timedelta(minutes=LOCKOUT_MINUTES)).isoformat()
                update["$set"]["locked_until"] = locked
            await db.login_attempts.update_one({"identifier": identifier}, update)
        else:
            await db.login_attempts.insert_one({"identifier": identifier, "attempts": 1})

        await log_audit(AuditEvent.LOGIN_FAILED, email=matched_email, ip=ip, user_agent=ua,
                        details={"reason": "invalid_credentials"}, severity="warn")
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if user.get("force_password_change"):
        await log_audit(
            "password_reset_enforced",
            user_id=str(user["_id"]),
            email=matched_email,
            ip=ip,
            user_agent=ua,
            details={"reason": user.get("force_password_change_reason", "password_reset_required")},
            severity="info",
        )
        raise HTTPException(status_code=403, detail="Passwort-Reset erforderlich. Bitte prüfe deine E-Mail und setze dein Passwort neu.")

    # Clear failed attempts on success
    await db.login_attempts.delete_many({"identifier": identifier})

    if user.get("password") or user.get("password_hash") != matched_hash:
        await db.users.update_one(
            {"_id": user["_id"]},
            {
                "$set": {"password_hash": matched_hash},
                "$unset": {"password": ""},
            },
        )
        user["password_hash"] = matched_hash
        user.pop("password", None)

    user_id = str(user["_id"])
    
    # Check if 2FA is enabled
    if user.get("two_factor_enabled"):
        # Generate and send OTP
        otp = ''.join([str(random.randint(0, 9)) for _ in range(6)])
        now = datetime.now(timezone.utc)
        expires = now + timedelta(minutes=10)
        
        # Store OTP
        await db.otp_codes.delete_many({"user_id": user_id, "purpose": "login"})
        await db.otp_codes.insert_one({
            "user_id": user_id,
            "code": otp,
            "purpose": "login",
            "attempts": 0,
            "created_at": now.isoformat(),
            "expires_at": expires.isoformat(),
        })
        
        # Create pending 2FA session
        pending_token = secrets.token_urlsafe(32)
        await db.pending_2fa.delete_many({"user_id": user_id})
        await db.pending_2fa.insert_one({
            "token": pending_token,
            "user_id": user_id,
            "created_at": now.isoformat(),
            "expires_at": expires.isoformat(),
        })
        
        # Send OTP email
        try:
            from core.email import send_otp_email
            send_otp_email(matched_email, otp, "login", user.get("name", ""))
        except Exception as e:
            logger.warning(f"Failed to send OTP email: {e}")
        
        # Set pending session cookie
        response.set_cookie(
            key="pending_2fa_session",
            value=pending_token,
            httponly=True,
            secure=True,
            samesite="lax",
            max_age=600,
            path="/"
        )
        
        return {
            "requires_2fa": True,
            "message": "2FA-Code an deine E-Mail gesendet",
            "email_hint": f"{email[:3]}***{email[-10:]}",
        }
    
    access_token = create_access_token(user_id, email)
    refresh_token = create_refresh_token(user_id)
    set_auth_cookies(response, access_token, refresh_token, req.remember_me)
    await _record_login_success(user_id, ip, ua)

    await log_audit(AuditEvent.LOGIN_SUCCESS, user_id=user_id, email=email,
                    ip=ip, user_agent=ua, details={"role": user.get("role", "user")})

    return serialize_user(user)


@router.get("/me")
async def get_me(request: Request):
    user = await get_current_user(request)
    return serialize_user(user)


@router.get("/ws-token")
async def ws_token(request: Request):
    """Liefert kurzlebiges JWT für WebSocket-Auth (5 Min). Browser können httpOnly-Cookies nicht in WS-URL einbauen."""
    user = await get_current_user(request)
    import jwt as _jwt
    from core.config import JWT_SECRET, JWT_ALGORITHM
    from datetime import datetime, timedelta, timezone
    payload = {
        "sub": str(user["_id"]),
        "email": user.get("email", ""),
        "exp": datetime.now(timezone.utc) + timedelta(seconds=300),
        "type": "access",
    }
    token = _jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)
    return {"token": token, "expires_in": 300}


@router.post("/logout")
async def logout(request: Request, response: Response):
    try:
        user = await get_current_user(request)
        ip, ua = get_client_info(request)
        await log_audit(AuditEvent.LOGOUT, user_id=str(user["_id"]), email=user.get("email", ""),
                        ip=ip, user_agent=ua)
    except Exception:
        pass
    clear_auth_cookies(response)
    return {"message": "Logged out"}


@router.post("/refresh")
async def refresh_token(request: Request, response: Response):
    import jwt as pyjwt
    from core.config import JWT_SECRET, JWT_ALGORITHM

    token = request.cookies.get("refresh_token")
    if not token:
        raise HTTPException(status_code=401, detail="No refresh token")
    try:
        payload = pyjwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        new_access = create_access_token(str(user["_id"]), user["email"])
        from core.config import COOKIE_SECURE, COOKIE_SAMESITE, ACCESS_TOKEN_EXPIRE_MINUTES
        response.set_cookie(key="access_token", value=new_access, httponly=True, secure=COOKIE_SECURE, samesite=COOKIE_SAMESITE, max_age=ACCESS_TOKEN_EXPIRE_MINUTES * 60, path="/")
        return serialize_user(user)
    except pyjwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Refresh token expired")
    except pyjwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid refresh token")



# ═══════════════════════════════════════════════════
# PASSWORD RESET
# ═══════════════════════════════════════════════════

@router.post("/forgot-password")
async def forgot_password(request: Request):
    """Request password reset link."""
    body = await request.json()
    email = body.get("email", "").strip().lower()
    
    if not email:
        raise HTTPException(status_code=400, detail="Email required")
    
    user = await db.users.find_one({"email": email})
    if not user:
        # Don't reveal if email exists
        return {"ok": True, "message": "If account exists, reset link sent"}

    await _issue_password_reset(email, request=request, issued_by="self_service", reason="forgot_password", force_password_change=False)
    return {"ok": True, "message": "If account exists, reset link sent"}


@router.get("/reset-password/verify")
async def verify_password_reset_token(token: str):
    token_hash = _hash_reset_token(token.strip())
    entry = await db.password_resets.find_one({"token_hash": token_hash, "used_at": None})
    if not entry:
        raise HTTPException(status_code=400, detail="Invalid or expired token")
    if datetime.now(timezone.utc) > _parse_reset_expiry(entry.get("expires_at")):
        raise HTTPException(status_code=400, detail="Token expired")
    await db.password_resets.update_one({"_id": entry["_id"]}, {"$set": {"verified_at": datetime.now(timezone.utc).isoformat()}})
    expires_value = entry.get("expires_at")
    expires_iso = expires_value.isoformat() if isinstance(expires_value, datetime) else str(expires_value)
    return {"ok": True, "email": entry.get("email", ""), "expires_at": expires_iso}


@router.post("/reset-password")
async def reset_password(request: Request):
    """Reset password using token."""
    body = await request.json()
    token = body.get("token", "").strip()
    new_password = body.get("password", "")
    confirm_password = body.get("confirm_password", "")
    
    if not token or not new_password:
        raise HTTPException(status_code=400, detail="Token and password required")
    if confirm_password and confirm_password != new_password:
        raise HTTPException(status_code=400, detail="Passwörter stimmen nicht überein")
    
    if len(new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    
    reset_entry = await db.password_resets.find_one({"token_hash": _hash_reset_token(token), "used_at": None})
    if not reset_entry:
        raise HTTPException(status_code=400, detail="Invalid or expired token")
    
    # Check expiry
    expires = _parse_reset_expiry(reset_entry["expires_at"])
    if datetime.now(timezone.utc) > expires:
        await db.password_resets.update_one({"_id": reset_entry["_id"]}, {"$set": {"used_at": datetime.now(timezone.utc).isoformat(), "used_reason": "expired"}})
        raise HTTPException(status_code=400, detail="Token expired")
    
    email = reset_entry["email"]
    user = await db.users.find_one({"email": email})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Hash new password - MUST use password_hash (same field as registration)
    hashed = hash_password(new_password)
    
    await db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {
            "password_hash": hashed,
            "password_reset_at": datetime.now(timezone.utc).isoformat(),
            "force_password_change": False,
            "force_password_change_reason": None,
            "force_password_change_requested_at": None,
        }, "$unset": {"password": ""}}
    )

    await db.password_resets.update_one({"_id": reset_entry["_id"]}, {"$set": {"used_at": datetime.now(timezone.utc).isoformat(), "used_reason": "password_reset_completed"}})

    ip, ua = get_client_info(request)
    await log_audit(
        AuditEvent.PASSWORD_CHANGE,
        user_id=str(user["_id"]),
        email=email,
        ip=ip,
        user_agent=ua,
        details={"via": "password_reset", "issued_by": reset_entry.get("issued_by", "self_service")},
        severity="info",
    )

    logger.info(f"Password reset completed for {email}")
    
    return {"ok": True, "message": "Password updated successfully"}


# ═══════════════════════════════════════════════════
# 2FA VERIFY LOGIN
# ═══════════════════════════════════════════════════

@router.post("/verify-2fa")
async def verify_2fa_login(request: Request, response: Response):
    """Complete login after 2FA OTP verification."""
    body = await request.json()
    code = body.get("code", "").strip()
    
    if not code or len(code) != 6:
        raise HTTPException(status_code=400, detail="6-stelliger Code erforderlich")
    
    # Get pending session
    pending_token = request.cookies.get("pending_2fa_session")
    if not pending_token:
        raise HTTPException(status_code=400, detail="Keine ausstehende Anmeldung")
    
    pending = await db.pending_2fa.find_one({"token": pending_token})
    if not pending:
        raise HTTPException(status_code=400, detail="Session abgelaufen. Bitte erneut einloggen.")
    
    user_id = pending["user_id"]
    now = datetime.now(timezone.utc)
    
    # Check expiry
    if pending.get("expires_at") and now > datetime.fromisoformat(pending["expires_at"]):
        await db.pending_2fa.delete_one({"token": pending_token})
        raise HTTPException(status_code=400, detail="Session abgelaufen")
    
    # Find OTP
    otp_doc = await db.otp_codes.find_one({
        "user_id": user_id,
        "purpose": "login",
        "expires_at": {"$gt": now.isoformat()}
    })
    
    if not otp_doc:
        raise HTTPException(status_code=400, detail="Code abgelaufen. Bitte erneut einloggen.")
    
    if otp_doc.get("attempts", 0) >= 3:
        await db.otp_codes.delete_one({"_id": otp_doc["_id"]})
        await db.pending_2fa.delete_one({"token": pending_token})
        raise HTTPException(status_code=400, detail="Zu viele Versuche. Bitte erneut einloggen.")
    
    # Verify code
    if otp_doc["code"] != code:
        await db.otp_codes.update_one(
            {"_id": otp_doc["_id"]},
            {"$inc": {"attempts": 1}}
        )
        remaining = 3 - otp_doc.get("attempts", 0) - 1
        raise HTTPException(status_code=400, detail=f"Falscher Code. {remaining} Versuche übrig.")
    
    # Clean up
    await db.otp_codes.delete_one({"_id": otp_doc["_id"]})
    await db.pending_2fa.delete_one({"token": pending_token})
    response.delete_cookie("pending_2fa_session")
    
    # Get user and complete login
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=404, detail="Benutzer nicht gefunden")
    
    email = user["email"]
    ip, ua = get_client_info(request)
    
    access_token = create_access_token(user_id, email)
    refresh_token = create_refresh_token(user_id)
    set_auth_cookies(response, access_token, refresh_token, remember=True)
    await _record_login_success(user_id, ip, ua)
    
    await log_audit(AuditEvent.LOGIN_SUCCESS, user_id=user_id, email=email,
                    ip=ip, user_agent=ua, details={"role": user.get("role", "user"), "2fa": True})
    
    logger.info(f"2FA login completed for {email}")
    
    return serialize_user(user)
