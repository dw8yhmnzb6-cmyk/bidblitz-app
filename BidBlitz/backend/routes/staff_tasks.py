"""
BidBlitz Staff — Tasks (Tags, Sub-Tasks, Comments, Photo Attachments)
=====================================================================
Collections:
- staff_tasks: {id, merchant_id, staff_id, title, description, due_date, status, tags[], subtasks[], attachments[], comment_count, ...}
- staff_task_comments: {id, task_id, author_type, author_id, author_name, body, created_at}
"""
from fastapi import APIRouter, HTTPException, Request, Depends
from pydantic import BaseModel, Field
from typing import Optional, Literal, List
from datetime import datetime, timezone
from uuid import uuid4
import os
from motor.motor_asyncio import AsyncIOMotorClient

router = APIRouter(prefix="/api/staff/tasks", tags=["staff-tasks"])
client = AsyncIOMotorClient(os.getenv("MONGO_URL"))
db = client[os.getenv("DB_NAME", "bidblitz")]


async def _merchant_id(request: Request) -> str:
    from routes.auth import get_current_user as auth_user
    user = await auth_user(request)
    if user.get("role") not in ("merchant", "admin"):
        raise HTTPException(403, "Nur für Händler oder Administratoren")
    return str(user.get("user_id") or user.get("id"))


async def _staff_session(request: Request) -> dict:
    sid = request.cookies.get("staff_session")
    if not sid:
        raise HTTPException(401, "Nicht angemeldet")
    m = await db.staff_members.find_one({"id": sid, "active": True}, {"_id": 0, "pin_hash": 0, "password_hash": 0})
    if not m:
        raise HTTPException(401, "Session ungültig")
    return m


async def _resolve_actor(request: Request):
    """Returns (author_type, author_id, author_name, merchant_id) — Merchant ODER Staff erlaubt."""
    # Try staff first
    sid = request.cookies.get("staff_session")
    if sid:
        m = await db.staff_members.find_one({"id": sid, "active": True}, {"_id": 0})
        if m:
            return "staff", m["id"], m.get("name", "Mitarbeiter"), m["merchant_id"]
    # Then merchant
    try:
        from routes.auth import get_current_user as auth_user
        user = await auth_user(request)
        if user.get("role") in ("merchant", "admin"):
            mid = str(user.get("user_id") or user.get("id"))
            return "merchant", mid, user.get("name") or user.get("email") or "Manager", mid
    except Exception:
        pass
    raise HTTPException(401, "Nicht angemeldet")


class Subtask(BaseModel):
    title: str
    done: bool = False


class Attachment(BaseModel):
    url: str
    name: Optional[str] = None
    type: Optional[str] = "image"
    uploaded_at: Optional[str] = None


class TaskCreate(BaseModel):
    staff_id: str
    title: str = Field(..., min_length=1)
    description: Optional[str] = ""
    due_date: Optional[str] = None
    tags: List[str] = []
    subtasks: List[Subtask] = []
    attachments: List[Attachment] = []
    priority: Optional[Literal["low", "normal", "high"]] = "normal"


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    due_date: Optional[str] = None
    tags: Optional[List[str]] = None
    subtasks: Optional[List[Subtask]] = None
    attachments: Optional[List[Attachment]] = None
    priority: Optional[Literal["low", "normal", "high"]] = None
    status: Optional[Literal["open", "done"]] = None


class CommentCreate(BaseModel):
    body: str = Field(..., min_length=1, max_length=2000)


class AttachmentAdd(BaseModel):
    url: str
    name: Optional[str] = None
    type: Optional[str] = "image"


class SubtaskToggle(BaseModel):
    index: int
    done: bool


@router.post("/create")
async def create_task(data: TaskCreate, request: Request):
    mid = await _merchant_id(request)
    member = await db.staff_members.find_one({"id": data.staff_id, "merchant_id": mid, "active": True})
    if not member:
        raise HTTPException(404, "Mitarbeiter nicht gefunden")
    now_iso = datetime.now(timezone.utc).isoformat()
    task = {
        "id": str(uuid4()),
        "merchant_id": mid,
        "staff_id": data.staff_id,
        "title": data.title,
        "description": data.description or "",
        "due_date": data.due_date,
        "status": "open",
        "priority": data.priority or "normal",
        "tags": data.tags or [],
        "subtasks": [s.model_dump() for s in (data.subtasks or [])],
        "attachments": [{**a.model_dump(), "uploaded_at": a.uploaded_at or now_iso} for a in (data.attachments or [])],
        "comment_count": 0,
        "created_at": now_iso,
        "completed_at": None,
    }
    await db.staff_tasks.insert_one(task)
    task.pop("_id", None)
    return {"success": True, "task": task}


@router.get("/me")
async def my_tasks(status: Optional[Literal["open", "done", "all"]] = "open",
                   member=Depends(_staff_session)):
    q: dict = {"merchant_id": member["merchant_id"], "staff_id": member["id"]}
    if status and status != "all":
        q["status"] = status
    tasks = await db.staff_tasks.find(q, {"_id": 0}).sort("created_at", -1).to_list(200)
    return {"success": True, "tasks": tasks, "count": len(tasks)}


@router.post("/{task_id}/complete")
async def complete_task(task_id: str, member=Depends(_staff_session)):
    t = await db.staff_tasks.find_one({"id": task_id, "staff_id": member["id"]})
    if not t:
        raise HTTPException(404, "Aufgabe nicht gefunden")
    await db.staff_tasks.update_one(
        {"id": task_id},
        {"$set": {"status": "done", "completed_at": datetime.now(timezone.utc).isoformat()}},
    )
    return {"success": True}


@router.get("/list")
async def list_team_tasks(request: Request, staff_id: Optional[str] = None,
                          status: Optional[Literal["open", "done", "all"]] = "all"):
    mid = await _merchant_id(request)
    q: dict = {"merchant_id": mid}
    if staff_id:
        q["staff_id"] = staff_id
    if status and status != "all":
        q["status"] = status
    tasks = await db.staff_tasks.find(q, {"_id": 0}).sort("created_at", -1).to_list(500)
    return {"success": True, "tasks": tasks, "count": len(tasks)}


@router.delete("/{task_id}")
async def delete_task(task_id: str, request: Request):
    mid = await _merchant_id(request)
    res = await db.staff_tasks.delete_one({"id": task_id, "merchant_id": mid})
    if res.deleted_count == 0:
        raise HTTPException(404, "Aufgabe nicht gefunden")
    return {"success": True}



# ───────────────────────────────────────────────────────────────────────
# Detail / Comments / Subtasks / Attachments
# ───────────────────────────────────────────────────────────────────────

async def _can_access_task(task: dict, request: Request) -> tuple:
    """Returns (actor_tuple, task). Raises 403 if not allowed."""
    actor = await _resolve_actor(request)
    actor_type, actor_id, actor_name, mid = actor
    if task["merchant_id"] != mid:
        raise HTTPException(403, "Keine Berechtigung")
    if actor_type == "staff" and task["staff_id"] != actor_id:
        raise HTTPException(403, "Nicht deine Aufgabe")
    return actor


@router.get("/{task_id}")
async def task_detail(task_id: str, request: Request):
    t = await db.staff_tasks.find_one({"id": task_id}, {"_id": 0})
    if not t:
        raise HTTPException(404, "Aufgabe nicht gefunden")
    await _can_access_task(t, request)
    # Fetch comments inline
    comments = await db.staff_task_comments.find({"task_id": task_id}, {"_id": 0}).sort("created_at", 1).to_list(200)
    t["comments"] = comments
    return {"success": True, "task": t}


@router.patch("/{task_id}")
async def update_task(task_id: str, data: TaskUpdate, request: Request):
    """Merchant kann alle Felder ändern, Staff darf Subtasks toggeln (via separater Endpoint), Status done."""
    actor_type, actor_id, _, mid = await _resolve_actor(request)
    t = await db.staff_tasks.find_one({"id": task_id, "merchant_id": mid}, {"_id": 0})
    if not t:
        raise HTTPException(404, "Aufgabe nicht gefunden")
    if actor_type == "staff" and t["staff_id"] != actor_id:
        raise HTTPException(403, "Nicht deine Aufgabe")

    update = data.model_dump(exclude_none=True)
    # Staff: nur status/subtasks erlaubt
    if actor_type == "staff":
        allowed = {k: v for k, v in update.items() if k in ("status", "subtasks")}
        update = allowed
    if update.get("status") == "done" and not t.get("completed_at"):
        update["completed_at"] = datetime.now(timezone.utc).isoformat()
    if update.get("subtasks") is not None:
        update["subtasks"] = [s if isinstance(s, dict) else s.model_dump() for s in update["subtasks"]]
    if not update:
        return {"success": True, "no_change": True}
    update["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.staff_tasks.update_one({"id": task_id}, {"$set": update})
    new_t = await db.staff_tasks.find_one({"id": task_id}, {"_id": 0})
    return {"success": True, "task": new_t}


@router.post("/{task_id}/subtasks/toggle")
async def toggle_subtask(task_id: str, data: SubtaskToggle, request: Request):
    actor = await _resolve_actor(request)
    actor_type, actor_id, _, mid = actor
    t = await db.staff_tasks.find_one({"id": task_id, "merchant_id": mid})
    if not t:
        raise HTTPException(404, "Aufgabe nicht gefunden")
    if actor_type == "staff" and t["staff_id"] != actor_id:
        raise HTTPException(403, "Nicht deine Aufgabe")
    subs = t.get("subtasks", []) or []
    if data.index < 0 or data.index >= len(subs):
        raise HTTPException(400, "Ungültiger Subtask-Index")
    subs[data.index]["done"] = data.done
    await db.staff_tasks.update_one({"id": task_id}, {"$set": {"subtasks": subs, "updated_at": datetime.now(timezone.utc).isoformat()}})
    return {"success": True, "subtasks": subs}


@router.post("/{task_id}/attachments")
async def add_attachment(task_id: str, data: AttachmentAdd, request: Request):
    actor = await _resolve_actor(request)
    actor_type, actor_id, _, mid = actor
    t = await db.staff_tasks.find_one({"id": task_id, "merchant_id": mid})
    if not t:
        raise HTTPException(404, "Aufgabe nicht gefunden")
    if actor_type == "staff" and t["staff_id"] != actor_id:
        raise HTTPException(403, "Nicht deine Aufgabe")
    # Validate base64 size (max ~5MB for data URLs)
    if data.url.startswith("data:") and len(data.url) > 7_000_000:
        raise HTTPException(413, "Bild zu groß (max 5MB)")
    att = {"url": data.url, "name": data.name, "type": data.type or "image",
           "uploaded_at": datetime.now(timezone.utc).isoformat(),
           "uploaded_by": actor_id, "uploader_type": actor_type}
    await db.staff_tasks.update_one({"id": task_id}, {"$push": {"attachments": att}})
    return {"success": True, "attachment": att}


@router.delete("/{task_id}/attachments/{idx}")
async def remove_attachment(task_id: str, idx: int, request: Request):
    actor = await _resolve_actor(request)
    actor_type, actor_id, _, mid = actor
    t = await db.staff_tasks.find_one({"id": task_id, "merchant_id": mid})
    if not t:
        raise HTTPException(404, "Aufgabe nicht gefunden")
    if actor_type == "staff" and t["staff_id"] != actor_id:
        raise HTTPException(403, "Nicht deine Aufgabe")
    attachments = t.get("attachments", []) or []
    if idx < 0 or idx >= len(attachments):
        raise HTTPException(400, "Ungültiger Index")
    attachments.pop(idx)
    await db.staff_tasks.update_one({"id": task_id}, {"$set": {"attachments": attachments}})
    return {"success": True}


@router.get("/{task_id}/comments")
async def list_comments(task_id: str, request: Request):
    t = await db.staff_tasks.find_one({"id": task_id}, {"_id": 0})
    if not t:
        raise HTTPException(404, "Aufgabe nicht gefunden")
    await _can_access_task(t, request)
    comments = await db.staff_task_comments.find({"task_id": task_id}, {"_id": 0}).sort("created_at", 1).to_list(500)
    return {"success": True, "comments": comments, "count": len(comments)}


@router.post("/{task_id}/comments")
async def add_comment(task_id: str, data: CommentCreate, request: Request):
    t = await db.staff_tasks.find_one({"id": task_id}, {"_id": 0})
    if not t:
        raise HTTPException(404, "Aufgabe nicht gefunden")
    actor_type, actor_id, actor_name, _mid = await _can_access_task(t, request)
    comment = {
        "id": str(uuid4()),
        "task_id": task_id,
        "author_type": actor_type,
        "author_id": actor_id,
        "author_name": actor_name,
        "body": data.body.strip(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.staff_task_comments.insert_one(comment)
    await db.staff_tasks.update_one({"id": task_id}, {"$inc": {"comment_count": 1}})
    comment.pop("_id", None)
    return {"success": True, "comment": comment}


@router.get("/tags/list")
async def list_tags(request: Request):
    """Distinct Tags across team's tasks — Autocomplete-Quelle."""
    mid = await _merchant_id(request)
    tags = await db.staff_tasks.distinct("tags", {"merchant_id": mid})
    return {"success": True, "tags": sorted([t for t in tags if t])}
