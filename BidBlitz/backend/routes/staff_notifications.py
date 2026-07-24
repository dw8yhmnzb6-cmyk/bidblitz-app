"""
BidBlitz Staff - Notifications Center
======================================
Typen:
- shift_reminder (Schicht-Erinnerung)
- leave_approved (Urlaub genehmigt)
- leave_rejected (Urlaub abgelehnt)
- missed_clock_out (fehlender Check-out)
- new_shift (neue Schicht erhalten)
- warning_assigned

Collection: staff_notifications
"""
from fastapi import APIRouter, HTTPException, Request, Depends
from pydantic import BaseModel
from typing import Optional, Literal, List
from datetime import datetime, timezone
from uuid import uuid4
import os
from motor.motor_asyncio import AsyncIOMotorClient

router = APIRouter(prefix="/api/staff/notifications", tags=["staff-notifications"])
client = AsyncIOMotorClient(os.getenv("MONGO_URL"))
db = client[os.getenv("DB_NAME", "bidblitz")]


NOTIFICATION_TYPES = {
    "shift_reminder": {"label": "Schicht-Erinnerung", "icon": "calendar"},
    "leave_approved": {"label": "Urlaub genehmigt", "icon": "check"},
    "leave_rejected": {"label": "Urlaub abgelehnt", "icon": "x"},
    "missed_clock_out": {"label": "Check-out fehlt", "icon": "alert"},
    "new_shift": {"label": "Neue Schicht", "icon": "calendar"},
    "warning_assigned": {"label": "Warnung", "icon": "alert"},
    "info": {"label": "Info", "icon": "info"},
}


class NotificationCreate(BaseModel):
    staff_id: str
    type: Literal["shift_reminder", "leave_approved", "leave_rejected", "missed_clock_out", "new_shift", "warning_assigned", "info"]
    title: str
    body: Optional[str] = None
    link: Optional[str] = None
    meta: Optional[dict] = None


async def get_staff_from_session(request: Request) -> dict:
    sid = request.cookies.get("staff_session")
    if not sid:
        raise HTTPException(401, "Nicht angemeldet")
    member = await db.staff_members.find_one({"id": sid, "active": True}, {"_id": 0})
    if not member:
        raise HTTPException(401, "Session ungültig")
    return member


async def _merchant_id(request: Request) -> str:
    from routes.auth import get_current_user as auth_user
    user = await auth_user(request)
    if user.get("role") not in ("merchant", "admin"):
        raise HTTPException(403, "Nur für Händler oder Administratoren")
    return str(user.get("user_id") or user.get("id"))


async def create_notification(merchant_id: str, staff_id: str, ntype: str, title: str, body: Optional[str] = None, link: Optional[str] = None, meta: Optional[dict] = None) -> dict:
    """Internal helper - callable from other modules."""
    doc = {
        "id": str(uuid4()),
        "merchant_id": merchant_id,
        "staff_id": staff_id,
        "type": ntype,
        "title": title,
        "body": body,
        "link": link,
        "meta": meta or {},
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.staff_notifications.insert_one(doc)
    doc.pop("_id", None)

    # OneSignal Push (best-effort, no-op if not configured)
    try:
        from utils.onesignal_push import send_to_staff, is_configured
        if is_configured():
            await send_to_staff(
                staff_id=staff_id,
                title=title,
                body=body or "",
                data={"type": ntype, "notification_id": doc["id"], "link": link or ""},
                url=link,
            )
            doc["push_attempted"] = True
    except Exception as e:
        pass

    return doc


# ───────────────────────────────────────────────────────────────────────
# Employee (staff_session)
# ───────────────────────────────────────────────────────────────────────
@router.get("/list")
async def list_my_notifications(
    member=Depends(get_staff_from_session),
    only_unread: bool = False,
    limit: int = 50,
):
    q = {"merchant_id": member["merchant_id"], "staff_id": member["id"]}
    if only_unread:
        q["read"] = False
    items = await db.staff_notifications.find(q, {"_id": 0}).sort("created_at", -1).to_list(length=limit)
    unread = await db.staff_notifications.count_documents({**q, "read": False})
    return {"success": True, "notifications": items, "unread_count": unread, "total": len(items)}


@router.post("/{notif_id}/read")
async def mark_read(notif_id: str, member=Depends(get_staff_from_session)):
    res = await db.staff_notifications.update_one(
        {"id": notif_id, "merchant_id": member["merchant_id"], "staff_id": member["id"]},
        {"$set": {"read": True, "read_at": datetime.now(timezone.utc).isoformat()}},
    )
    if res.matched_count == 0:
        raise HTTPException(404, "Notification nicht gefunden")
    return {"success": True}


@router.post("/mark-all-read")
async def mark_all_read(member=Depends(get_staff_from_session)):
    res = await db.staff_notifications.update_many(
        {"merchant_id": member["merchant_id"], "staff_id": member["id"], "read": False},
        {"$set": {"read": True, "read_at": datetime.now(timezone.utc).isoformat()}},
    )
    return {"success": True, "marked": res.modified_count}


@router.delete("/{notif_id}")
async def delete_notification(notif_id: str, member=Depends(get_staff_from_session)):
    res = await db.staff_notifications.delete_one(
        {"id": notif_id, "merchant_id": member["merchant_id"], "staff_id": member["id"]}
    )
    if res.deleted_count == 0:
        raise HTTPException(404, "Notification nicht gefunden")
    return {"success": True}


# ───────────────────────────────────────────────────────────────────────
# Merchant (creates notifications for staff)
# ───────────────────────────────────────────────────────────────────────
@router.post("/send")
async def send_notification(req: NotificationCreate, request: Request):
    mid = await _merchant_id(request)
    member = await db.staff_members.find_one({"id": req.staff_id, "merchant_id": mid}, {"_id": 0})
    if not member:
        raise HTTPException(404, "Mitarbeiter nicht gefunden")
    doc = await create_notification(mid, req.staff_id, req.type, req.title, req.body, req.link, req.meta)
    return {"success": True, "notification": doc}


@router.get("/types")
async def list_types():
    return {"success": True, "types": [{"id": k, **v} for k, v in NOTIFICATION_TYPES.items()]}
