"""
BidBlitz Staff Chat — 1:1 Manager ↔ Staff Messaging MVP
=========================================================
Simple, polling-based threads + messages model.

Collections (MongoDB):
─────────────────────
staff_chat_threads:
  id, merchant_id, manager_user_id, staff_id,
  last_message_at, last_message_preview, last_sender_role,
  unread_manager (int), unread_staff (int),
  created_at

staff_chat_messages:
  id, thread_id, sender_id, sender_role ("manager"|"staff"),
  text, created_at, read_at?

API:
────
GET    /api/staff/chat/threads                 — Liste eigener Threads
POST   /api/staff/chat/threads                 — Manager öffnet Thread mit staff_id
GET    /api/staff/chat/threads/{id}/messages   — letzte 50 (cursor support)
POST   /api/staff/chat/threads/{id}/messages   — Nachricht senden
PATCH  /api/staff/chat/threads/{id}/read       — als gelesen markieren
"""
from datetime import datetime, timezone
from typing import Optional
from uuid import uuid4
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from core.database import db
from core.security import get_current_user

router = APIRouter(prefix="/api/staff/chat", tags=["staff-chat"])


# ──────────────────────────────────────────────────────────
# Auth helper — supports both Staff cookie & Merchant token
# ──────────────────────────────────────────────────────────
async def _actor(request: Request) -> dict:
    sid = request.cookies.get("staff_session")
    if sid:
        m = await db.staff_members.find_one({"id": sid, "active": True}, {"_id": 0})
        if m:
            return {"id": m["id"], "role": "staff", "merchant_id": m["merchant_id"], "name": m.get("name")}
    user = await get_current_user(request)
    role = user.get("role")
    if role not in ("merchant", "admin"):
        raise HTTPException(403, "Nur Manager oder Mitarbeiter")
    uid = str(user.get("_id") or user.get("id") or "")
    merchant = await db.merchants.find_one({"owner_user_id": uid}, {"_id": 1})
    if not merchant:
        merchant = await db.merchants.find_one({"email": user.get("email")}, {"_id": 1})
    merchant_id = str(merchant["_id"]) if merchant else uid
    return {"id": uid, "role": "manager", "merchant_id": merchant_id, "name": user.get("name") or user.get("email")}


# ──────────────────────────────────────────────────────────
# Models
# ──────────────────────────────────────────────────────────
class ThreadCreate(BaseModel):
    staff_id: str


class MessageCreate(BaseModel):
    text: str


# ──────────────────────────────────────────────────────────
# Endpoints
# ──────────────────────────────────────────────────────────
@router.get("/threads")
async def list_threads(request: Request):
    actor = await _actor(request)
    q = {"merchant_id": actor["merchant_id"]}
    if actor["role"] == "staff":
        q["staff_id"] = actor["id"]
    threads = await db.staff_chat_threads.find(q, {"_id": 0}).sort("last_message_at", -1).to_list(200)

    # Hydrate staff name + manager name
    staff_ids = list({t["staff_id"] for t in threads})
    members = {}
    if staff_ids:
        async for m in db.staff_members.find({"id": {"$in": staff_ids}}, {"_id": 0, "id": 1, "name": 1, "email": 1, "role": 1}):
            members[m["id"]] = m
    for t in threads:
        t["staff"] = members.get(t["staff_id"], {"name": "Unbekannt"})
        t["unread"] = t.get("unread_manager" if actor["role"] == "manager" else "unread_staff", 0)
    return {"threads": threads, "count": len(threads)}


@router.post("/threads")
async def create_thread(body: ThreadCreate, request: Request):
    actor = await _actor(request)
    if actor["role"] != "manager":
        raise HTTPException(403, "Nur Manager dürfen Threads öffnen")
    staff = await db.staff_members.find_one({"id": body.staff_id, "merchant_id": actor["merchant_id"]}, {"_id": 0})
    if not staff:
        raise HTTPException(404, "Mitarbeiter nicht gefunden")
    existing = await db.staff_chat_threads.find_one(
        {"merchant_id": actor["merchant_id"], "staff_id": body.staff_id}, {"_id": 0}
    )
    if existing:
        existing["staff"] = {"id": staff["id"], "name": staff.get("name"), "email": staff.get("email")}
        return {"thread": existing, "existing": True}
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "id": str(uuid4()),
        "merchant_id": actor["merchant_id"],
        "manager_user_id": actor["id"],
        "staff_id": body.staff_id,
        "last_message_at": now,
        "last_message_preview": "",
        "last_sender_role": None,
        "unread_manager": 0,
        "unread_staff": 0,
        "created_at": now,
    }
    await db.staff_chat_threads.insert_one(doc.copy())
    doc.pop("_id", None)
    doc["staff"] = {"id": staff["id"], "name": staff.get("name"), "email": staff.get("email")}
    return {"thread": doc, "existing": False}


@router.get("/threads/{thread_id}/messages")
async def list_messages(thread_id: str, request: Request, limit: int = 100):
    actor = await _actor(request)
    thread = await db.staff_chat_threads.find_one({"id": thread_id, "merchant_id": actor["merchant_id"]}, {"_id": 0})
    if not thread:
        raise HTTPException(404, "Thread nicht gefunden")
    if actor["role"] == "staff" and thread["staff_id"] != actor["id"]:
        raise HTTPException(403, "Kein Zugriff")
    items = await db.staff_chat_messages.find({"thread_id": thread_id}, {"_id": 0}).sort("created_at", 1).limit(min(limit, 500)).to_list(500)
    return {"messages": items, "thread": thread}


@router.post("/threads/{thread_id}/messages")
async def send_message(thread_id: str, body: MessageCreate, request: Request):
    actor = await _actor(request)
    text = (body.text or "").strip()
    if not text:
        raise HTTPException(400, "Leere Nachricht")
    if len(text) > 4000:
        raise HTTPException(400, "Nachricht zu lang (max 4000 Zeichen)")
    thread = await db.staff_chat_threads.find_one({"id": thread_id, "merchant_id": actor["merchant_id"]}, {"_id": 0})
    if not thread:
        raise HTTPException(404, "Thread nicht gefunden")
    if actor["role"] == "staff" and thread["staff_id"] != actor["id"]:
        raise HTTPException(403, "Kein Zugriff")

    now = datetime.now(timezone.utc).isoformat()
    msg = {
        "id": str(uuid4()),
        "thread_id": thread_id,
        "sender_id": actor["id"],
        "sender_role": actor["role"],
        "sender_name": actor.get("name"),
        "text": text,
        "created_at": now,
    }
    await db.staff_chat_messages.insert_one(msg.copy())
    msg.pop("_id", None)

    inc = {"unread_staff": 1} if actor["role"] == "manager" else {"unread_manager": 1}
    await db.staff_chat_threads.update_one(
        {"id": thread_id},
        {
            "$set": {
                "last_message_at": now,
                "last_message_preview": text[:140],
                "last_sender_role": actor["role"],
            },
            "$inc": inc,
        },
    )

    # Best-effort push to recipient (does not block)
    try:
        from utils.onesignal_push import send_to_staff, is_configured
        if actor["role"] == "manager" and is_configured():
            preview = text[:120]
            await send_to_staff(thread["staff_id"], f"Neue Nachricht von {actor.get('name') or 'Manager'}", preview)
    except Exception:
        pass

    return {"success": True, "message": msg}


@router.patch("/threads/{thread_id}/read")
async def mark_read(thread_id: str, request: Request):
    actor = await _actor(request)
    thread = await db.staff_chat_threads.find_one({"id": thread_id, "merchant_id": actor["merchant_id"]}, {"_id": 0})
    if not thread:
        raise HTTPException(404, "Thread nicht gefunden")
    if actor["role"] == "staff" and thread["staff_id"] != actor["id"]:
        raise HTTPException(403, "Kein Zugriff")
    field = "unread_staff" if actor["role"] == "staff" else "unread_manager"
    await db.staff_chat_messages.update_many(
        {"thread_id": thread_id, "sender_role": {"$ne": actor["role"]}, "read_at": {"$exists": False}},
        {"$set": {"read_at": datetime.now(timezone.utc).isoformat()}},
    )
    await db.staff_chat_threads.update_one({"id": thread_id}, {"$set": {field: 0}})
    return {"success": True}


@router.get("/unread-count")
async def unread_count(request: Request):
    actor = await _actor(request)
    q = {"merchant_id": actor["merchant_id"]}
    field = "unread_staff" if actor["role"] == "staff" else "unread_manager"
    if actor["role"] == "staff":
        q["staff_id"] = actor["id"]
    pipeline = [
        {"$match": q},
        {"$group": {"_id": None, "total": {"$sum": f"${field}"}}},
    ]
    res = await db.staff_chat_threads.aggregate(pipeline).to_list(1)
    total = res[0]["total"] if res else 0
    return {"unread": int(total)}
