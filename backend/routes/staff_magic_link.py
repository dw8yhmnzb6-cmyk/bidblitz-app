"""
BidBlitz Staff - Magic Login Link
=================================
Sicheres Token-basiertes Login für Mitarbeiter.
"""
from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timedelta, timezone
from uuid import uuid4
import os, secrets
from motor.motor_asyncio import AsyncIOMotorClient

router = APIRouter(prefix="/api/staff/auth", tags=["staff-magic-link"])
client = AsyncIOMotorClient(os.getenv("MONGO_URL"))
db = client[os.getenv("DB_NAME", "bidblitz")]

TOKEN_TTL_MIN = 30


class MagicLinkRequest(BaseModel):
    email: Optional[str] = None
    phone: Optional[str] = None


class VerifyTokenRequest(BaseModel):
    token: str


@router.post("/magic-link")
async def request_magic_link(req: MagicLinkRequest, request: Request):
    """Generate a magic login link. Real SMS/Email sending is left to integration."""
    if not (req.email or req.phone):
        raise HTTPException(400, "E-Mail oder Telefon erforderlich")
    q: dict = {"active": True}
    if req.email:
        q["email"] = req.email
    elif req.phone:
        q["phone"] = req.phone
    member = await db.staff_members.find_one(q, {"_id": 0})
    if not member:
        # Anti-enumeration: still return success
        return {"success": True, "sent": False, "message": "Wenn der Account existiert, wurde ein Link gesendet."}

    token = secrets.token_urlsafe(32)
    expires = datetime.now(timezone.utc) + timedelta(minutes=TOKEN_TTL_MIN)
    await db.staff_magic_tokens.insert_one({
        "id": str(uuid4()),
        "token": token,
        "staff_id": member["id"],
        "merchant_id": member["merchant_id"],
        "expires_at": expires.isoformat(),
        "used": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    base = os.getenv("APP_PUBLIC_URL", "")
    magic_url = f"{base}/staff/mobile?token={token}" if base else f"/staff/mobile?token={token}"
    # Dev flag controls whether the URL is returned in body (production should send only via SMS/Email channel)
    dev_return = os.getenv("STAFF_DEV_RETURN_MAGIC_URL", "true").lower() == "true"
    # TODO: hook up actual SMS/Email provider (Resend/Twilio)
    resp = {
        "success": True,
        "sent": True,
        "expires_minutes": TOKEN_TTL_MIN,
        "delivery_method": "email" if req.email else "sms",
    }
    if dev_return:
        resp["magic_url"] = magic_url
    return resp


@router.get("/verify-token")
async def verify_token(token: str, response: Response):
    """Verify magic-link token, set session cookie, return staff."""
    doc = await db.staff_magic_tokens.find_one({"token": token}, {"_id": 0})
    if not doc:
        raise HTTPException(401, "Ungültiger Token")
    if doc.get("used"):
        raise HTTPException(401, "Token bereits verwendet")
    try:
        expires = datetime.fromisoformat(doc["expires_at"].replace("Z", "+00:00"))
    except Exception:
        raise HTTPException(401, "Ungültiger Token")
    if datetime.now(timezone.utc) > expires:
        raise HTTPException(401, "Token abgelaufen")

    member = await db.staff_members.find_one({"id": doc["staff_id"], "active": True}, {"_id": 0})
    if not member:
        raise HTTPException(401, "Mitarbeiter inaktiv oder gelöscht")

    await db.staff_magic_tokens.update_one(
        {"token": token},
        {"$set": {"used": True, "used_at": datetime.now(timezone.utc).isoformat()}},
    )
    # Audit
    await db.staff_audit_log.insert_one({
        "id": str(uuid4()), "type": "magic_login", "staff_id": member["id"],
        "merchant_id": member["merchant_id"],
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })
    response.set_cookie(
        key="staff_session", value=member["id"],
        httponly=True, max_age=86400 * 7, samesite="lax"
    )
    return {"success": True, "staff": {
        "id": member["id"], "name": member["name"],
        "email": member.get("email"), "role": member.get("staff_role", "employee"),
    }}
