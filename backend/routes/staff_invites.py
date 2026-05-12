"""
BidBlitz Staff - Invite Flow
============================
Merchant lädt Mitarbeiter via E-Mail/Telefon ein.
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timedelta, timezone
from uuid import uuid4
import os, secrets
from motor.motor_asyncio import AsyncIOMotorClient

router = APIRouter(prefix="/api/staff/invites", tags=["staff-invites"])
client = AsyncIOMotorClient(os.getenv("MONGO_URL"))
db = client[os.getenv("DB_NAME", "bidblitz")]

INVITE_TTL_DAYS = 7


class InviteCreate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    role: str = "employee"


class InviteAccept(BaseModel):
    token: str
    name: Optional[str] = None
    pin: Optional[str] = None  # for first-time PIN setup


async def _merchant_id(request: Request) -> str:
    from routes.auth import get_current_user as auth_user
    user = await auth_user(request)
    if user.get("role") not in ("merchant", "admin"):
        raise HTTPException(403, "Nur für Händler oder Administratoren")
    return str(user.get("user_id") or user.get("id"))


@router.post("/create")
async def create_invite(req: InviteCreate, request: Request):
    mid = await _merchant_id(request)
    if not (req.email or req.phone):
        raise HTTPException(400, "E-Mail oder Telefon erforderlich")

    # Subscription limit check
    from routes.staff_subscription import get_subscription_for_merchant
    sub = await get_subscription_for_merchant(mid)
    if not sub or sub.get("status") not in ("trialing", "active"):
        raise HTTPException(402, "Keine aktive Subscription")
    max_staff = sub.get("max_staff_override") or sub.get("max_staff", 0)
    active_count = await db.staff_members.count_documents({"merchant_id": mid, "active": True})
    pending_count = await db.staff_invites.count_documents({"merchant_id": mid, "status": "pending"})
    if active_count + pending_count >= max_staff:
        raise HTTPException(403, detail={
            "code": "limit_reached",
            "message": f"Limit erreicht ({active_count + pending_count}/{max_staff})",
        })

    token = secrets.token_urlsafe(24)
    expires = datetime.now(timezone.utc) + timedelta(days=INVITE_TTL_DAYS)
    doc = {
        "id": str(uuid4()),
        "merchant_id": mid,
        "name": req.name,
        "email": req.email,
        "phone": req.phone,
        "role": req.role,
        "token": token,
        "status": "pending",
        "expires_at": expires.isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.staff_invites.insert_one(doc)
    doc.pop("_id", None)
    base = os.getenv("APP_PUBLIC_URL", "")
    doc["invite_url"] = f"{base}/staff/invite?token={token}" if base else f"/staff/invite?token={token}"
    return {"success": True, "invite": doc}


@router.get("/list")
async def list_invites(request: Request, status: Optional[str] = None):
    mid = await _merchant_id(request)
    q = {"merchant_id": mid}
    if status:
        q["status"] = status
    items = await db.staff_invites.find(q, {"_id": 0}).sort("created_at", -1).to_list(length=200)
    # Auto-expire
    now = datetime.now(timezone.utc)
    for it in items:
        if it["status"] == "pending":
            try:
                ex = datetime.fromisoformat(it["expires_at"].replace("Z", "+00:00"))
                if now > ex:
                    it["status"] = "expired"
                    await db.staff_invites.update_one({"id": it["id"]}, {"$set": {"status": "expired"}})
            except Exception:
                pass
    return {"success": True, "invites": items, "count": len(items)}


@router.delete("/{invite_id}")
async def revoke_invite(invite_id: str, request: Request):
    mid = await _merchant_id(request)
    res = await db.staff_invites.update_one(
        {"id": invite_id, "merchant_id": mid, "status": "pending"},
        {"$set": {"status": "revoked"}},
    )
    if res.matched_count == 0:
        raise HTTPException(404, "Einladung nicht gefunden oder bereits genutzt")
    return {"success": True}


@router.get("/preview/{token}")
async def preview_invite(token: str):
    inv = await db.staff_invites.find_one({"token": token}, {"_id": 0})
    if not inv:
        raise HTTPException(404, "Einladung nicht gefunden")
    if inv["status"] != "pending":
        raise HTTPException(410, f"Einladung Status: {inv['status']}")
    try:
        ex = datetime.fromisoformat(inv["expires_at"].replace("Z", "+00:00"))
        if datetime.now(timezone.utc) > ex:
            await db.staff_invites.update_one({"token": token}, {"$set": {"status": "expired"}})
            raise HTTPException(410, "Einladung abgelaufen")
    except HTTPException:
        raise
    except Exception:
        pass
    # Return safe public preview
    return {
        "success": True,
        "invite": {
            "name": inv.get("name"),
            "email": inv.get("email"),
            "phone": inv.get("phone"),
            "role": inv.get("role"),
        },
    }


@router.post("/accept")
async def accept_invite(req: InviteAccept):
    """Mitarbeiter akzeptiert die Einladung → wird als staff_member angelegt."""
    import bcrypt
    inv = await db.staff_invites.find_one({"token": req.token}, {"_id": 0})
    if not inv:
        raise HTTPException(404, "Einladung nicht gefunden")
    if inv["status"] != "pending":
        raise HTTPException(410, f"Einladung Status: {inv['status']}")
    try:
        ex = datetime.fromisoformat(inv["expires_at"].replace("Z", "+00:00"))
        if datetime.now(timezone.utc) > ex:
            raise HTTPException(410, "Einladung abgelaufen")
    except HTTPException:
        raise
    except Exception:
        pass

    name = req.name or inv.get("name") or "Mitarbeiter"

    # Re-check subscription limits at accept time (merchant may have downgraded)
    from routes.staff_subscription import get_subscription_for_merchant
    sub = await get_subscription_for_merchant(inv["merchant_id"])
    if not sub or sub.get("status") not in ("trialing", "active"):
        raise HTTPException(402, "Subscription nicht aktiv. Bitte mit dem Händler Kontakt aufnehmen.")
    max_staff = sub.get("max_staff_override") or sub.get("max_staff", 0)
    active_count = await db.staff_members.count_documents({"merchant_id": inv["merchant_id"], "active": True})
    if active_count >= max_staff:
        raise HTTPException(403, detail={
            "code": "limit_reached",
            "message": f"Mitarbeiter-Limit erreicht ({active_count}/{max_staff}). Bitte Händler kontaktieren.",
        })

    member_doc = {
        "id": str(uuid4()),
        "merchant_id": inv["merchant_id"],
        "name": name,
        "email": inv.get("email"),
        "phone": inv.get("phone"),
        "role": "employee",
        "staff_role": inv.get("role", "employee"),
        "hourly_rate": 12.0,
        "vacation_days_yearly": 24,
        "vacation_days_used": 0,
        "active": True,
        "from_invite_id": inv["id"],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    if req.pin and req.pin.isdigit() and 6 <= len(req.pin) <= 8:
        if req.pin in ("000000", "111111", "123456", "654321"):
            raise HTTPException(400, "PIN ist zu unsicher")
        member_doc["pin_hash"] = bcrypt.hashpw(req.pin.encode(), bcrypt.gensalt()).decode()
    elif req.pin:
        raise HTTPException(400, "PIN muss 6-8 Ziffern haben")
    await db.staff_members.insert_one(member_doc)
    await db.staff_invites.update_one(
        {"token": req.token},
        {"$set": {"status": "accepted", "accepted_at": datetime.now(timezone.utc).isoformat(), "member_id": member_doc["id"]}},
    )
    member_doc.pop("_id", None)
    member_doc.pop("pin_hash", None)
    return {"success": True, "member": member_doc}
