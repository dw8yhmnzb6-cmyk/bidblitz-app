import bcrypt
import jwt
from datetime import datetime, timezone, timedelta
from fastapi import HTTPException, Request
from bson import ObjectId
from core.config import JWT_SECRET, JWT_ALGORITHM, ACCESS_TOKEN_EXPIRE_MINUTES, REFRESH_TOKEN_EXPIRE_DAYS, COOKIE_SECURE, COOKIE_SAMESITE
from core.database import db


def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))


def create_access_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
        "type": "access",
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def create_refresh_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS),
        "type": "refresh",
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def set_auth_cookies(response, access_token: str, refresh_token: str, remember_me: bool = True):
    # Short session: 15 min access, 1 day refresh
    # Remember me: 15 min access, 30 days refresh
    access_max_age = ACCESS_TOKEN_EXPIRE_MINUTES * 60  # 15 minutes
    refresh_max_age = 30 * 24 * 60 * 60 if remember_me else 24 * 60 * 60  # 30 days or 1 day
    
    response.set_cookie(key="access_token", value=access_token, httponly=True, secure=COOKIE_SECURE, samesite=COOKIE_SAMESITE, max_age=access_max_age, path="/")
    response.set_cookie(key="refresh_token", value=refresh_token, httponly=True, secure=COOKIE_SECURE, samesite=COOKIE_SAMESITE, max_age=refresh_max_age, path="/")


def clear_auth_cookies(response):
    response.delete_cookie(key="access_token", path="/", secure=COOKIE_SECURE, samesite=COOKIE_SAMESITE)
    response.delete_cookie(key="refresh_token", path="/", secure=COOKIE_SECURE, samesite=COOKIE_SAMESITE)


def serialize_user(user: dict) -> dict:
    role = user.get("role", "user")
    modes = ["personal"]
    
    if role == "admin":
        modes = ["personal", "kids", "merchant"]
    else:
        if user.get("kids_subscribed") or user.get("has_kids"):
            modes.append("kids")
        if role == "merchant":
            modes.append("merchant")
    
    return {
        "id": user.get("id") or str(user["_id"]),
        "email": user["email"],
        "name": user.get("name", ""),
        "role": role,
        "modes": modes,
        "balance": round(user.get("balance", user.get("bids_balance", 0.0)), 2),
        "currency": user.get("currency", "EUR"),
        "card_number": user.get("card_number", ""),
        "card_expiry": user.get("card_expiry", ""),
        "created_at": user.get("created_at", ""),
        "language": user.get("language", "de"),
        "notifications_enabled": user.get("notifications_enabled", True),
        "email_notifications": user.get("email_notifications", True),
        "biometric_enabled": user.get("biometric_enabled", False),
        "dark_mode": user.get("dark_mode", True),
    }


async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        # V2 tokens use "sub" with ObjectId, V1 tokens use "user_id" with UUID
        user_ref = payload.get("sub") or payload.get("user_id")
        if not user_ref:
            raise HTTPException(status_code=401, detail="Invalid token payload")
        
        # Skip type check for V1 tokens (they don't have "type" field)
        token_type = payload.get("type")
        if token_type and token_type != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
        
        # Try ObjectId lookup first (V2), then UUID string lookup (V1)
        user = None
        try:
            user = await db.users.find_one({"_id": ObjectId(user_ref)})
        except Exception:
            pass
        if not user:
            user = await db.users.find_one({"id": user_ref})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        # Track last_seen (non-blocking, async fire-and-forget)
        try:
            from datetime import datetime, timezone
            import asyncio
            now_iso = datetime.now(timezone.utc).isoformat()
            asyncio.create_task(
                db.users.update_one(
                    {"_id": user["_id"]},
                    {"$set": {"last_seen": now_iso}},
                )
            )
        except Exception:
            pass
        # Normalize user dict for downstream routes
        user["user_id"] = str(user.get("_id", user.get("id", "")))
        full_name = user.get("name", "") or ""
        name_parts = full_name.split(" ", 1) if full_name else ["", ""]
        if "first_name" not in user:
            user["first_name"] = user.get("first_name") or (name_parts[0] if name_parts else "")
        if "last_name" not in user:
            user["last_name"] = user.get("last_name") or (name_parts[1] if len(name_parts) > 1 else "")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")



async def get_current_user_from_token(token: str) -> dict:
    """Validate JWT token and return user (for WebSocket authentication)."""
    if not token:
        raise HTTPException(status_code=401, detail="Token required")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_ref = payload.get("sub") or payload.get("user_id")
        if not user_ref:
            raise HTTPException(status_code=401, detail="Invalid token payload")
        
        token_type = payload.get("type")
        if token_type and token_type != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
        
        # Try ObjectId lookup first (V2), then UUID string lookup (V1)
        user = None
        try:
            user = await db.users.find_one({"_id": ObjectId(user_ref)})
        except Exception:
            pass
        if not user:
            user = await db.users.find_one({"id": user_ref})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
