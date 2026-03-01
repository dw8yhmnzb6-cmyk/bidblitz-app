"""
Business Accounts - Invite Codes, Join, Members, Payment Source
Atomic join with Motor (async), rate limiting, invite code hashing
"""
import os
import re
import secrets
import hashlib
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel
from typing import Optional
from pymongo import ReturnDocument

from dependencies import get_current_user, get_admin_user
from config import db, logger

router = APIRouter(prefix="/business", tags=["Business Accounts"])

# ==================== UTILS ====================

ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
CODE_RE = re.compile(r"^[A-Z0-9]{3}-[A-Z0-9]{4}-[A-Z0-9]{4}$")
INVITE_CODE_SALT = os.getenv("INVITE_CODE_SALT", "bidblitz_invite_salt_2026")

def _utcnow():
    return datetime.now(timezone.utc)

def generate_invite_code():
    p2 = "".join(secrets.choice(ALPHABET) for _ in range(4))
    p3 = "".join(secrets.choice(ALPHABET) for _ in range(4))
    return f"BBX-{p2}-{p3}"

def validate_code_format(code):
    return bool(CODE_RE.match(code.strip().upper()))

def hash_code(code):
    payload = (code.strip().upper() + "|" + INVITE_CODE_SALT).encode()
    return hashlib.sha256(payload).hexdigest()

async def rate_limit_or_429(key: str):
    window = int(os.getenv("JOIN_RATE_LIMIT_WINDOW_SECONDS", "600"))
    max_hits = int(os.getenv("JOIN_RATE_LIMIT_MAX", "10"))
    now = _utcnow()

    doc = await db.rate_limits.find_one({"key": key})
    if doc and doc.get("expires_at") and doc["expires_at"] < now:
        await db.rate_limits.delete_one({"key": key})
        doc = None

    if not doc:
        await db.rate_limits.insert_one({"key": key, "count": 1, "first_at": now, "expires_at": now + timedelta(seconds=window)})
        return

    if doc["count"] >= max_hits:
        raise HTTPException(429, "Zu viele Versuche. Bitte warten.")

    await db.rate_limits.update_one({"key": key}, {"$inc": {"count": 1}, "$set": {"expires_at": now + timedelta(seconds=window)}})


# ==================== INDEXES (call once on startup) ====================

async def ensure_business_indexes():
    try:
        await db.business_accounts.create_index("business_id", unique=True)
        await db.business_members.create_index([("business_id", 1), ("user_id", 1)], unique=True)
        await db.business_invites.create_index("invite_id", unique=True)
        await db.business_invites.create_index("code_hash")
        await db.rate_limits.create_index("key", unique=True)
        logger.info("Business indexes ensured")
    except Exception as e:
        logger.warning(f"Index creation: {e}")


# ==================== SCHEMAS ====================

class CreateBusiness(BaseModel):
    name: str
    tax_id: Optional[str] = None
    billing_email: Optional[str] = None

class CreateInvite(BaseModel):
    expires_in_days: int = 7
    max_uses: int = 20
    note: Optional[str] = None

class JoinCode(BaseModel):
    code: str

class RidePaymentSource(BaseModel):
    payment_source: str = "personal"  # personal or business
    business_id: Optional[str] = None


# ==================== BUSINESS CRUD ====================

@router.post("/create")
async def create_business(data: CreateBusiness, user: dict = Depends(get_current_user)):
    existing = await db.business_members.find_one({"user_id": user["id"], "role": "business_admin"})
    if existing:
        raise HTTPException(409, "Sie haben bereits ein Firmenkonto")

    bid = f"BIZ-{secrets.token_hex(3).upper()}"
    now = _utcnow()

    await db.business_accounts.insert_one({
        "business_id": bid, "name": data.name, "tax_id": data.tax_id,
        "billing_email": data.billing_email or user.get("email"),
        "owner_user_id": user["id"], "status": "active",
        "created_at": now.isoformat()
    })

    await db.business_members.insert_one({
        "business_id": bid, "user_id": user["id"], "role": "business_admin",
        "status": "active", "created_at": now,
        "limits": {"monthly_cap_eur": None, "monthly_spent_eur": 0, "reset_day": 1}
    })

    return {"success": True, "business_id": bid, "message": f"Firmenkonto '{data.name}' erstellt"}


@router.get("/me")
async def my_businesses(user: dict = Depends(get_current_user)):
    memberships = []
    async for m in db.business_members.find({"user_id": user["id"], "status": "active"}):
        b = await db.business_accounts.find_one({"business_id": m["business_id"]}, {"_id": 0})
        memberships.append({
            "business_id": m["business_id"],
            "business_name": b.get("name") if b else None,
            "role": m.get("role"),
            "limits": m.get("limits")
        })
    return {"memberships": memberships}


# ==================== INVITE CODES ====================

@router.post("/invites")
async def create_invite(data: CreateInvite, user: dict = Depends(get_current_user)):
    member = await db.business_members.find_one({"user_id": user["id"], "role": "business_admin", "status": "active"})
    if not member:
        raise HTTPException(403, "Nur Business-Admins können Einladungen erstellen")

    code = generate_invite_code()
    code_h = hash_code(code)
    now = _utcnow()

    invite = {
        "invite_id": "inv_" + secrets.token_urlsafe(12),
        "business_id": member["business_id"],
        "created_by_user_id": user["id"],
        "code_hash": code_h,
        "expires_at": now + timedelta(days=max(1, min(data.expires_in_days, 365))),
        "max_uses": max(1, min(data.max_uses, 1000)),
        "uses_count": 0,
        "status": "active",
        "created_at": now,
        "note": data.note,
        "last_used_at": None
    }
    await db.business_invites.insert_one(invite)

    return {
        "invite_id": invite["invite_id"],
        "code": code,
        "expires_at": invite["expires_at"].isoformat(),
        "max_uses": invite["max_uses"],
        "status": "active",
        "note": data.note,
        "message": f"Einladungscode: {code}"
    }


@router.get("/invites")
async def list_invites(user: dict = Depends(get_current_user)):
    member = await db.business_members.find_one({"user_id": user["id"], "role": "business_admin"})
    if not member:
        raise HTTPException(403, "Nicht berechtigt")

    invites = []
    async for d in db.business_invites.find({"business_id": member["business_id"]}).sort("created_at", -1):
        invites.append({
            "invite_id": d["invite_id"],
            "expires_at": d["expires_at"].isoformat() if isinstance(d["expires_at"], datetime) else d["expires_at"],
            "max_uses": d.get("max_uses", 0),
            "uses_count": d.get("uses_count", 0),
            "status": d.get("status"),
            "note": d.get("note")
        })
    return {"invites": invites}


@router.patch("/invites/{invite_id}/disable")
async def disable_invite(invite_id: str, user: dict = Depends(get_current_user)):
    member = await db.business_members.find_one({"user_id": user["id"], "role": "business_admin"})
    if not member:
        raise HTTPException(403, "Nicht berechtigt")

    r = await db.business_invites.update_one(
        {"business_id": member["business_id"], "invite_id": invite_id},
        {"$set": {"status": "disabled"}}
    )
    if r.matched_count == 0:
        raise HTTPException(404, "Einladung nicht gefunden")
    return {"success": True}


# ==================== ATOMIC JOIN ====================

@router.post("/join")
async def join_business(data: JoinCode, request: Request, user: dict = Depends(get_current_user)):
    code = data.code.strip().upper()
    if not validate_code_format(code):
        raise HTTPException(400, "Ungültiges Code-Format (BBX-XXXX-XXXX)")

    # Rate limit
    ip = request.client.host if request.client else "unknown"
    await rate_limit_or_429(f"join:u:{user['id']}")
    await rate_limit_or_429(f"join:ip:{ip}")

    code_h = hash_code(code)
    now = _utcnow()

    # Atomic: reserve slot on active invite
    invite = await db.business_invites.find_one_and_update(
        {
            "code_hash": code_h,
            "status": "active",
            "expires_at": {"$gt": now},
            "$expr": {"$lt": ["$uses_count", "$max_uses"]}
        },
        {"$inc": {"uses_count": 1}, "$set": {"last_used_at": now}},
        return_document=ReturnDocument.AFTER
    )

    if not invite:
        raise HTTPException(400, "Code ungültig, abgelaufen oder maximale Nutzungen erreicht")

    business_id = invite["business_id"]

    # Insert membership (unique constraint prevents duplicates)
    try:
        await db.business_members.insert_one({
            "business_id": business_id, "user_id": user["id"],
            "role": "employee", "status": "active", "created_at": now,
            "limits": {"monthly_cap_eur": None, "monthly_spent_eur": 0, "reset_day": 1}
        })
    except Exception:
        # Already member - rollback slot
        await db.business_invites.update_one(
            {"_id": invite["_id"], "uses_count": {"$gt": 0}},
            {"$inc": {"uses_count": -1}}
        )
        return {"success": True, "business_id": business_id, "already_member": True}

    # Get business name
    biz = await db.business_accounts.find_one({"business_id": business_id}, {"name": 1})
    name = biz.get("name", business_id) if biz else business_id

    return {"success": True, "business_id": business_id, "business_name": name, "role": "employee", "message": f"Willkommen bei {name}!"}


# ==================== MEMBERS MANAGEMENT ====================

@router.get("/members")
async def list_members(user: dict = Depends(get_current_user)):
    member = await db.business_members.find_one({"user_id": user["id"], "role": "business_admin"})
    if not member:
        raise HTTPException(403, "Nicht berechtigt")

    members = []
    async for m in db.business_members.find({"business_id": member["business_id"]}):
        u = await db.users.find_one({"id": m["user_id"]}, {"_id": 0, "name": 1, "email": 1})
        members.append({
            "user_id": m["user_id"],
            "name": u.get("name") if u else None,
            "email": u.get("email") if u else None,
            "role": m.get("role"),
            "status": m.get("status"),
            "limits": m.get("limits")
        })
    return {"members": members}


@router.patch("/members/{member_user_id}/limits")
async def set_member_limits(member_user_id: str, monthly_cap_eur: float = None, user: dict = Depends(get_current_user)):
    admin = await db.business_members.find_one({"user_id": user["id"], "role": "business_admin"})
    if not admin:
        raise HTTPException(403, "Nicht berechtigt")

    await db.business_members.update_one(
        {"business_id": admin["business_id"], "user_id": member_user_id},
        {"$set": {"limits.monthly_cap_eur": monthly_cap_eur}}
    )
    return {"success": True}


@router.delete("/members/{member_user_id}")
async def remove_member(member_user_id: str, user: dict = Depends(get_current_user)):
    admin = await db.business_members.find_one({"user_id": user["id"], "role": "business_admin"})
    if not admin:
        raise HTTPException(403, "Nicht berechtigt")

    await db.business_members.update_one(
        {"business_id": admin["business_id"], "user_id": member_user_id},
        {"$set": {"status": "removed"}}
    )
    return {"success": True}
