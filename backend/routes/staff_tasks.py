"""
BidBlitz Staff — Tasks (minimal)
=================================
Manager weisen Aufgaben einem Mitarbeiter zu.
Mitarbeiter sehen ihre offenen Aufgaben und können sie als erledigt markieren.

Collections:
- staff_tasks: {id, merchant_id, staff_id, title, description, due_date, status, created_at, completed_at}
"""
from fastapi import APIRouter, HTTPException, Request, Depends
from pydantic import BaseModel
from typing import Optional, Literal
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


class TaskCreate(BaseModel):
    staff_id: str
    title: str
    description: Optional[str] = ""
    due_date: Optional[str] = None  # ISO date


@router.post("/create")
async def create_task(data: TaskCreate, request: Request):
    mid = await _merchant_id(request)
    member = await db.staff_members.find_one({"id": data.staff_id, "merchant_id": mid, "active": True})
    if not member:
        raise HTTPException(404, "Mitarbeiter nicht gefunden")
    task = {
        "id": str(uuid4()),
        "merchant_id": mid,
        "staff_id": data.staff_id,
        "title": data.title,
        "description": data.description or "",
        "due_date": data.due_date,
        "status": "open",
        "created_at": datetime.now(timezone.utc).isoformat(),
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
