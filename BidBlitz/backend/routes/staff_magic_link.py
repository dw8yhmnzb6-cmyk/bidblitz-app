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
    """Generate a magic login link. Sendet via Resend (E-Mail) wenn konfiguriert."""
    from utils.rate_limit import enforce_rate_limit
    # 3 Versuche / 5 Minuten / 15 Min Lockout
    enforce_rate_limit(request, f"magic_link:{(req.email or req.phone or 'x')[:40]}", max_attempts=3, window_sec=300, lockout_sec=900)

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
    dev_return = os.getenv("STAFF_DEV_RETURN_MAGIC_URL", "true").lower() == "true"

    # Resend Email Versand (wenn Email + Resend Key vorhanden)
    delivery_status = "queued"
    if req.email:
        resend_key = os.getenv("RESEND_API_KEY", "")
        if resend_key:
            try:
                import httpx
                async with httpx.AsyncClient(timeout=8.0) as ac:
                    r = await ac.post(
                        "https://api.resend.com/emails",
                        headers={"Authorization": f"Bearer {resend_key}", "Content-Type": "application/json"},
                        json={
                            "from": os.getenv("FROM_EMAIL", "BidBlitz <noreply@bidblitz.ae>"),
                            "to": [req.email],
                            "subject": "Dein BidBlitz Staff Login-Link",
                            "html": f"""<div style="font-family:system-ui,sans-serif;padding:24px;max-width:480px;margin:auto;background:#0A0A0A;color:#fff;border-radius:16px">
<h2 style="margin:0 0 12px;font-size:20px">BidBlitz Staff</h2>
<p style="color:#aaa;font-size:14px">Hallo {member.get('name','')},</p>
<p style="font-size:14px">Klicke auf den folgenden Button um dich anzumelden. Der Link ist {TOKEN_TTL_MIN} Minuten gültig.</p>
<p style="margin:24px 0"><a href="{magic_url}" style="background:linear-gradient(90deg,#00C2FF,#A855F7);color:#fff;padding:14px 28px;border-radius:12px;text-decoration:none;font-weight:600;display:inline-block">Jetzt anmelden</a></p>
<p style="color:#666;font-size:11px">Falls du das nicht angefordert hast, ignoriere diese Mail.</p>
</div>""",
                        },
                    )
                    delivery_status = "sent" if r.status_code < 400 else f"resend_{r.status_code}"
            except Exception as e:
                logger.warning(f"Resend send failed: {e}")
                delivery_status = "resend_error"

    # TODO: Twilio SMS for phone-based magic link
    resp = {
        "success": True,
        "sent": True,
        "expires_minutes": TOKEN_TTL_MIN,
        "delivery_method": "email" if req.email else "sms",
        "delivery_status": delivery_status,
    }
    if dev_return:
        resp["magic_url"] = magic_url
    return resp


@router.get("/verify-token")
async def verify_token(token: str, response: Response, request: Request):
    """Verify magic-link token, set session cookie, return staff."""
    from utils.rate_limit import enforce_rate_limit
    # 10 Versuche / 5 Min / 15 Min Lockout per IP
    enforce_rate_limit(request, "verify_token", max_attempts=10, window_sec=300, lockout_sec=900)

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
