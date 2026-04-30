"""
Gruppenchat — WeChat-style group messaging (DB-backed).
Real-time delivery uses existing chat_ws.py WebSocket infrastructure.
"""
import logging
import secrets
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from typing import List, Optional, Literal

from core.database import db
from core.security import get_current_user
from core.rate_limit import limiter

router = APIRouter(prefix="/api/groupchat", tags=["groupchat"])
logger = logging.getLogger("bidblitz.groupchat")


class GroupCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=80)
    avatar: Optional[str] = None
    initial_members: List[str] = Field(default_factory=list, max_length=50)  # handles


class GroupInviteRequest(BaseModel):
    handles: List[str] = Field(..., min_length=1, max_length=30)


class GroupMessageRequest(BaseModel):
    text: Optional[str] = Field(default=None, max_length=2000)
    attachment_url: Optional[str] = None
    attachment_type: Optional[Literal["image", "voice", "video", "file"]] = None
    reply_to: Optional[str] = None
    mentions: List[str] = Field(default_factory=list, max_length=20)  # mentioned user_ids


def _mask(d: dict) -> dict:
    d = dict(d or {})
    d.pop("_id", None)
    for k in ("created_at", "updated_at", "last_message_at"):
        if isinstance(d.get(k), datetime):
            d[k] = d[k].isoformat()
    return d


async def _resolve_handles(handles: List[str]) -> List[dict]:
    """Convert @handles → list of {user_id, name, handle}."""
    normalized = [h.strip().lstrip("@").lstrip("$").lower() for h in handles]
    users = await db.users.find(
        {"handle": {"$in": normalized}},
        {"_id": 1, "name": 1, "handle": 1, "avatar": 1},
    ).to_list(length=len(normalized))
    return [{"user_id": str(u["_id"]), "name": u.get("name"), "handle": u.get("handle"), "avatar": u.get("avatar")} for u in users]


@router.post("/create")
@limiter.limit("20/hour")
async def create_group(req: GroupCreateRequest, request: Request):
    user = await get_current_user(request)
    user_id = str(user["_id"])
    group_id = secrets.token_urlsafe(12)

    members = [{"user_id": user_id, "name": user.get("name"), "handle": user.get("handle"), "avatar": user.get("avatar"), "role": "admin", "joined_at": datetime.now(timezone.utc)}]
    if req.initial_members:
        resolved = await _resolve_handles(req.initial_members)
        for r in resolved:
            if r["user_id"] == user_id:
                continue
            r["role"] = "member"
            r["joined_at"] = datetime.now(timezone.utc)
            members.append(r)

    doc = {
        "group_id": group_id,
        "name": req.name,
        "avatar": req.avatar,
        "created_by": user_id,
        "members": members,
        "member_ids": [m["user_id"] for m in members],
        "last_message": None,
        "last_message_at": None,
        "unread_by": {},  # user_id → count
        "created_at": datetime.now(timezone.utc),
    }
    await db.chat_groups.insert_one(doc)
    return _mask(doc)


@router.get("/list")
async def list_groups(request: Request):
    """Return all groups current user is a member of, sorted by last_message_at desc."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    cursor = db.chat_groups.find(
        {"member_ids": user_id},
        {"_id": 0, "member_ids": 0},
    ).sort("last_message_at", -1).limit(100)
    items = []
    async for g in cursor:
        g = _mask(g)
        g["unread_count"] = (g.get("unread_by") or {}).get(user_id, 0)
        items.append(g)
    return {"groups": items}


@router.get("/{group_id}")
async def get_group(group_id: str, request: Request):
    user = await get_current_user(request)
    user_id = str(user["_id"])
    g = await db.chat_groups.find_one({"group_id": group_id, "member_ids": user_id}, {"_id": 0})
    if not g:
        raise HTTPException(404, "Group not found or not a member")
    # Clear unread for this user
    await db.chat_groups.update_one({"group_id": group_id}, {"$set": {f"unread_by.{user_id}": 0}})
    return _mask(g)


@router.post("/{group_id}/invite")
async def invite_members(group_id: str, req: GroupInviteRequest, request: Request):
    user = await get_current_user(request)
    user_id = str(user["_id"])
    g = await db.chat_groups.find_one({"group_id": group_id, "member_ids": user_id})
    if not g:
        raise HTTPException(404, "Group not found")

    resolved = await _resolve_handles(req.handles)
    existing_ids = set(g.get("member_ids", []))
    new_members = []
    for r in resolved:
        if r["user_id"] in existing_ids:
            continue
        r["role"] = "member"
        r["joined_at"] = datetime.now(timezone.utc)
        new_members.append(r)

    if not new_members:
        return {"ok": True, "added": 0}

    await db.chat_groups.update_one(
        {"group_id": group_id},
        {
            "$push": {"members": {"$each": new_members}},
            "$addToSet": {"member_ids": {"$each": [m["user_id"] for m in new_members]}},
            "$set": {"updated_at": datetime.now(timezone.utc)},
        },
    )
    return {"ok": True, "added": len(new_members), "members": [{"handle": m["handle"], "name": m["name"]} for m in new_members]}


@router.post("/{group_id}/leave")
async def leave_group(group_id: str, request: Request):
    user = await get_current_user(request)
    user_id = str(user["_id"])
    g = await db.chat_groups.find_one({"group_id": group_id, "member_ids": user_id})
    if not g:
        raise HTTPException(404, "Group not found")

    await db.chat_groups.update_one(
        {"group_id": group_id},
        {
            "$pull": {"members": {"user_id": user_id}, "member_ids": user_id},
            "$unset": {f"unread_by.{user_id}": ""},
        },
    )
    return {"ok": True}


@router.post("/{group_id}/message")
@limiter.limit("60/minute")
async def post_message(group_id: str, req: GroupMessageRequest, request: Request):
    if not req.text and not req.attachment_url:
        raise HTTPException(400, "Empty message")
    user = await get_current_user(request)
    user_id = str(user["_id"])
    g = await db.chat_groups.find_one({"group_id": group_id, "member_ids": user_id}, {"member_ids": 1, "members": 1})
    if not g:
        raise HTTPException(404, "Group not found")

    message_id = secrets.token_urlsafe(10)
    now = datetime.now(timezone.utc)
    msg = {
        "message_id": message_id,
        "group_id": group_id,
        "sender_id": user_id,
        "sender_name": user.get("name"),
        "sender_handle": user.get("handle"),
        "sender_avatar": user.get("avatar"),
        "text": req.text,
        "attachment_url": req.attachment_url,
        "attachment_type": req.attachment_type,
        "reply_to": req.reply_to,
        "mentions": req.mentions,
        "read_by": [user_id],
        "created_at": now,
    }
    await db.chat_group_messages.insert_one(msg)

    # Bump last_message_at + increment unread for other members
    unread_increments = {f"unread_by.{m}": 1 for m in g["member_ids"] if m != user_id}
    preview = req.text[:80] if req.text else f"[{req.attachment_type or 'file'}]"
    await db.chat_groups.update_one(
        {"group_id": group_id},
        {
            "$set": {
                "last_message_at": now,
                "last_message": {"text": preview, "sender_handle": user.get("handle"), "sender_name": user.get("name")},
            },
            "$inc": unread_increments or {"_no_op": 0},
        },
    )
    # Fire-and-forget websocket broadcast via existing chat_ws if available
    try:
        from routes.chat_ws import broadcast_group_message
        await broadcast_group_message(group_id, _mask(msg))
    except Exception:
        pass  # WS optional; REST still returns

    return _mask(msg)


@router.get("/{group_id}/messages")
async def get_messages(group_id: str, request: Request, limit: int = 50, before: Optional[str] = None):
    user = await get_current_user(request)
    user_id = str(user["_id"])
    g = await db.chat_groups.find_one({"group_id": group_id, "member_ids": user_id}, {"member_ids": 1})
    if not g:
        raise HTTPException(404, "Group not found")

    q = {"group_id": group_id}
    if before:
        q["message_id"] = {"$lt": before}
    cursor = db.chat_group_messages.find(q, {"_id": 0}).sort("created_at", -1).limit(min(limit, 200))
    items = []
    async for m in cursor:
        items.append(_mask(m))
    items.reverse()
    return {"messages": items}


@router.post("/{group_id}/read")
async def mark_read(group_id: str, request: Request):
    user = await get_current_user(request)
    user_id = str(user["_id"])
    await db.chat_groups.update_one(
        {"group_id": group_id, "member_ids": user_id},
        {"$set": {f"unread_by.{user_id}": 0}},
    )
    return {"ok": True}
