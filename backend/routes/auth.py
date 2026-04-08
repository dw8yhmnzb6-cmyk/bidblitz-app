from fastapi import APIRouter, HTTPException, Request, Response
from datetime import datetime, timezone, timedelta
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

    # Soft launch gate: invite code OR whitelist OR open registration
    invite_used = None
    invite_type = "user"
    if not await is_registration_open():
        if req.invite_code:
            valid, msg, code_type = await validate_invite_code(req.invite_code)
            if not valid:
                raise HTTPException(status_code=403, detail=msg)
            invite_used = req.invite_code.strip().upper()
            invite_type = code_type or "user"
        elif not await is_email_whitelisted(email):
            raise HTTPException(status_code=403, detail="Registration requires an invite code during soft launch.")

    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    role = "merchant" if invite_type == "merchant" else "user"
    user_doc = {
        "email": email,
        "password_hash": hash_password(req.password),
        "name": req.name.strip(),
        "role": role,
        "balance": 0.0,
        "currency": "EUR",
        "card_number": generate_card_number(),
        "card_expiry": generate_card_expiry(),
        "payment_barcode": f"BLZ-{secrets.token_hex(6).upper()}",
        "created_at": datetime.now(timezone.utc).isoformat(),
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

    return serialize_user(user_doc)


@router.post("/login")
@limiter.limit(RATE_LOGIN)
async def login(req: LoginRequest, request: Request, response: Response):
    email = req.email.lower().strip()
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

    user = await db.users.find_one({"email": email})

    # Soft launch gate (before password check to avoid leaking user existence)
    if user and not await is_email_whitelisted(email):
        raise HTTPException(status_code=403, detail="Access restricted during soft launch. Contact support.")

    if not user or not verify_password(req.password, user["password_hash"]):
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

        await log_audit(AuditEvent.LOGIN_FAILED, email=email, ip=ip, user_agent=ua,
                        details={"reason": "invalid_credentials"}, severity="warn")
        raise HTTPException(status_code=401, detail="Invalid email or password")

    # Clear failed attempts on success
    await db.login_attempts.delete_many({"identifier": identifier})

    user_id = str(user["_id"])
    access_token = create_access_token(user_id, email)
    refresh_token = create_refresh_token(user_id)
    set_auth_cookies(response, access_token, refresh_token, req.remember_me)

    await log_audit(AuditEvent.LOGIN_SUCCESS, user_id=user_id, email=email,
                    ip=ip, user_agent=ua, details={"role": user.get("role", "user")})

    return serialize_user(user)


@router.get("/me")
async def get_me(request: Request):
    user = await get_current_user(request)
    return serialize_user(user)


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
        from core.config import COOKIE_SECURE, COOKIE_SAMESITE
        response.set_cookie(key="access_token", value=new_access, httponly=True, secure=COOKIE_SECURE, samesite=COOKIE_SAMESITE, max_age=900, path="/")
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
    
    # Generate reset token
    reset_token = secrets.token_urlsafe(32)
    expires = datetime.now(timezone.utc) + timedelta(hours=1)
    
    await db.password_resets.update_one(
        {"email": email},
        {"$set": {
            "token": reset_token,
            "expires_at": expires.isoformat(),
            "created_at": datetime.now(timezone.utc).isoformat(),
        }},
        upsert=True
    )
    
    # Send password reset email
    try:
        from core.email import send_password_reset_email
        user_name = user.get("name", "")
        send_password_reset_email(email, reset_token, user_name)
        logger.info(f"Password reset email sent to {email}")
    except Exception as e:
        logger.error(f"Failed to send password reset email to {email}: {e}")
    
    return {"ok": True, "message": "If account exists, reset link sent"}


@router.post("/reset-password")
async def reset_password(request: Request):
    """Reset password using token."""
    body = await request.json()
    token = body.get("token", "").strip()
    new_password = body.get("password", "")
    
    if not token or not new_password:
        raise HTTPException(status_code=400, detail="Token and password required")
    
    if len(new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    
    reset_entry = await db.password_resets.find_one({"token": token})
    if not reset_entry:
        raise HTTPException(status_code=400, detail="Invalid or expired token")
    
    # Check expiry
    expires = datetime.fromisoformat(reset_entry["expires_at"])
    if datetime.now(timezone.utc) > expires:
        await db.password_resets.delete_one({"token": token})
        raise HTTPException(status_code=400, detail="Token expired")
    
    email = reset_entry["email"]
    user = await db.users.find_one({"email": email})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Hash new password - MUST use password_hash (same field as registration)
    hashed = hash_password(new_password)
    
    await db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {"password_hash": hashed}}
    )
    
    # Delete reset token
    await db.password_resets.delete_one({"token": token})
    
    logger.info(f"Password reset completed for {email}")
    
    return {"ok": True, "message": "Password updated successfully"}
