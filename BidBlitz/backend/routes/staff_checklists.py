"""
BidBlitz Staff — Checklists & Forms (Daily Checklist, Inspections, etc.)
========================================================================
Collections:
- staff_checklist_templates: {id, merchant_id, title, description, items[{key,type,label,required}]}
- staff_checklist_submissions: {id, template_id, merchant_id, staff_id, answers[{key,value}], status, submitted_at}

Item types:
- "text"       → string answer
- "checkbox"   → boolean
- "photo"      → URL (data:image/...) base64
- "signature"  → URL (data:image/png;base64,..) handwritten signature
- "rating"     → 1..5
"""
from fastapi import APIRouter, HTTPException, Request, Depends
from pydantic import BaseModel, Field
from typing import Optional, List, Literal, Any
from datetime import datetime, timezone
from uuid import uuid4
import os
from motor.motor_asyncio import AsyncIOMotorClient

router = APIRouter(prefix="/api/staff/checklists", tags=["staff-checklists"])
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


class ChecklistItem(BaseModel):
    key: str
    type: Literal["text", "checkbox", "photo", "signature", "rating"]
    label: str
    required: bool = False
    placeholder: Optional[str] = None


class TemplateCreate(BaseModel):
    title: str = Field(..., min_length=1)
    description: Optional[str] = ""
    items: List[ChecklistItem] = []
    assign_role: Optional[str] = None
    schedule: Optional[Literal["once", "daily", "weekly"]] = "once"


class Answer(BaseModel):
    key: str
    value: Any  # str | bool | url | int


class SubmissionCreate(BaseModel):
    template_id: str
    answers: List[Answer]


# Templates (Merchant) -----------------------------------------------------
@router.post("/templates")
async def create_template(data: TemplateCreate, request: Request):
    mid = await _merchant_id(request)
    tpl = {
        "id": str(uuid4()),
        "merchant_id": mid,
        "title": data.title,
        "description": data.description or "",
        "items": [i.model_dump() for i in data.items],
        "assign_role": data.assign_role,
        "schedule": data.schedule,
        "active": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.staff_checklist_templates.insert_one(tpl)
    tpl.pop("_id", None)
    return {"success": True, "template": tpl}


@router.get("/templates")
async def list_templates(request: Request):
    mid = await _merchant_id(request)
    tpls = await db.staff_checklist_templates.find({"merchant_id": mid, "active": True}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return {"success": True, "templates": tpls}


@router.delete("/templates/{tpl_id}")
async def delete_template(tpl_id: str, request: Request):
    mid = await _merchant_id(request)
    res = await db.staff_checklist_templates.delete_one({"id": tpl_id, "merchant_id": mid})
    if res.deleted_count == 0:
        raise HTTPException(404, "Template nicht gefunden")
    return {"success": True}


# Staff: list available templates + submit -------------------------------
@router.get("/me/templates")
async def my_templates(member=Depends(_staff_session)):
    """Templates die der MA ausfüllen kann (active, ggf. rollenspezifisch)."""
    q: dict = {"merchant_id": member["merchant_id"], "active": True}
    tpls = await db.staff_checklist_templates.find(q, {"_id": 0}).sort("created_at", -1).to_list(100)
    # Filter on assign_role if set
    role = member.get("staff_role") or member.get("role")
    tpls = [t for t in tpls if not t.get("assign_role") or t.get("assign_role") == role]

    # Heute submitted?
    today = datetime.now(timezone.utc).date().isoformat()
    submitted_today = await db.staff_checklist_submissions.distinct(
        "template_id",
        {"merchant_id": member["merchant_id"], "staff_id": member["id"], "submitted_at": {"$regex": f"^{today}"}},
    )
    for t in tpls:
        t["completed_today"] = t["id"] in submitted_today
    return {"success": True, "templates": tpls}


@router.post("/submissions")
async def submit_checklist(data: SubmissionCreate, member=Depends(_staff_session)):
    tpl = await db.staff_checklist_templates.find_one({"id": data.template_id, "merchant_id": member["merchant_id"], "active": True})
    if not tpl:
        raise HTTPException(404, "Template nicht gefunden")
    # Validate required
    answers_map = {a.key: a.value for a in data.answers}
    for it in tpl["items"]:
        if it.get("required") and not answers_map.get(it["key"]):
            raise HTTPException(400, f"Pflichtfeld fehlt: {it['label']}")
    sub = {
        "id": str(uuid4()),
        "template_id": data.template_id,
        "template_title": tpl["title"],
        "merchant_id": member["merchant_id"],
        "staff_id": member["id"],
        "staff_name": member["name"],
        "answers": [a.model_dump() for a in data.answers],
        "status": "submitted",
        "submitted_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.staff_checklist_submissions.insert_one(sub)
    sub.pop("_id", None)
    return {"success": True, "submission": sub}


@router.get("/me/submissions")
async def my_submissions(member=Depends(_staff_session), limit: int = 30):
    items = await db.staff_checklist_submissions.find(
        {"merchant_id": member["merchant_id"], "staff_id": member["id"]},
        {"_id": 0},
    ).sort("submitted_at", -1).to_list(limit)
    return {"success": True, "submissions": items}


@router.get("/submissions")
async def list_submissions(request: Request, template_id: Optional[str] = None, staff_id: Optional[str] = None, limit: int = 100):
    mid = await _merchant_id(request)
    q: dict = {"merchant_id": mid}
    if template_id: q["template_id"] = template_id
    if staff_id: q["staff_id"] = staff_id
    items = await db.staff_checklist_submissions.find(q, {"_id": 0}).sort("submitted_at", -1).to_list(limit)
    return {"success": True, "submissions": items, "count": len(items)}


@router.get("/submissions/{sub_id}")
async def get_submission(sub_id: str, request: Request):
    # Both staff and merchant can fetch
    mid_or_sid = await _resolve_id(request)
    s = await db.staff_checklist_submissions.find_one({"id": sub_id}, {"_id": 0})
    if not s:
        raise HTTPException(404, "Submission nicht gefunden")
    if s["merchant_id"] != mid_or_sid["merchant_id"]:
        raise HTTPException(403, "Keine Berechtigung")
    if mid_or_sid["type"] == "staff" and s["staff_id"] != mid_or_sid["id"]:
        raise HTTPException(403, "Nicht deine Submission")
    return {"success": True, "submission": s}


async def _resolve_id(request: Request):
    sid = request.cookies.get("staff_session")
    if sid:
        m = await db.staff_members.find_one({"id": sid, "active": True}, {"_id": 0})
        if m:
            return {"type": "staff", "id": m["id"], "merchant_id": m["merchant_id"]}
    from routes.auth import get_current_user as auth_user
    u = await auth_user(request)
    if u.get("role") in ("merchant", "admin"):
        mid = str(u.get("user_id") or u.get("id"))
        return {"type": "merchant", "id": mid, "merchant_id": mid}
    raise HTTPException(401, "Nicht angemeldet")
