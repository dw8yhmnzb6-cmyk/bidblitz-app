"""The Eye Action Center, technician assignments and work-order tickets."""

from __future__ import annotations

import secrets
from datetime import datetime, timezone
from typing import Any, Dict, List, Literal, Optional

from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel, Field

from core.database import db
from core.security import get_current_user
from core.the_eye_live import broadcast_the_eye_event


router = APIRouter(prefix="/api/the-eye", tags=["The Eye Actions"])

Priority = Literal["p1", "p2", "p3", "p4"]
ActionStatus = Literal["new", "assigned", "in_progress", "waiting", "blocked", "done", "cancelled"]
TicketStatus = Literal["open", "assigned", "in_progress", "waiting_parts", "resolved", "closed", "cancelled"]


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


async def _require_admin(request: Request) -> dict:
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin required")
    return user


class ActionCreate(BaseModel):
    title: str = Field(..., min_length=3, max_length=240)
    description: Optional[str] = Field(default=None, max_length=4000)
    priority: Priority = "p3"
    project: Optional[str] = Field(default=None, max_length=120)
    site_id: Optional[str] = Field(default=None, max_length=128)
    location_id: Optional[str] = Field(default=None, max_length=128)
    incident_id: Optional[str] = Field(default=None, max_length=128)
    assigned_to: Optional[str] = Field(default=None, max_length=128)
    due_at: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)


class ActionStatusUpdate(BaseModel):
    status: ActionStatus
    note: Optional[str] = Field(default=None, max_length=2000)


class AssignmentRequest(BaseModel):
    assigned_to: Optional[str] = Field(default=None, max_length=128)
    assigned_team: Optional[str] = Field(default=None, max_length=128)
    note: Optional[str] = Field(default=None, max_length=2000)


class TicketCreate(BaseModel):
    title: str = Field(..., min_length=3, max_length=240)
    description: Optional[str] = Field(default=None, max_length=4000)
    priority: Priority = "p3"
    category: Literal[
        "camera",
        "network",
        "power",
        "aion",
        "power_station",
        "charging",
        "scooter",
        "vehicle",
        "firmware",
        "account",
        "billing",
        "other",
    ] = "other"
    incident_id: Optional[str] = Field(default=None, max_length=128)
    site_id: Optional[str] = Field(default=None, max_length=128)
    location_id: Optional[str] = Field(default=None, max_length=128)
    device_id: Optional[str] = Field(default=None, max_length=128)
    camera_id: Optional[str] = Field(default=None, max_length=128)
    assigned_to: Optional[str] = Field(default=None, max_length=128)
    assigned_team: Optional[str] = Field(default=None, max_length=128)
    due_at: Optional[str] = None


class TicketStatusUpdate(BaseModel):
    status: TicketStatus
    note: Optional[str] = Field(default=None, max_length=2000)


async def _validate_incident(incident_id: Optional[str]) -> Optional[dict]:
    if not incident_id:
        return None
    row = await db.the_eye_incidents.find_one({"incident_id": incident_id}, {"_id": 0})
    if not row:
        raise HTTPException(status_code=400, detail="Incident not found")
    return row


async def _load_assignee(assignee: Optional[str]) -> Optional[dict]:
    if not assignee:
        return None
    queries = [
        {"id": assignee},
        {"user_id": assignee},
        {"email": assignee},
        {"username": assignee},
    ]
    for query in queries:
        row = await db.users.find_one(query, {"password_hash": 0, "password": 0})
        if row:
            return row
    return None


@router.post("/admin/actions")
async def create_action(req: ActionCreate, request: Request):
    admin = await _require_admin(request)
    await _validate_incident(req.incident_id)

    now = _now()
    action_id = "ACT-" + secrets.token_hex(8).upper()
    doc = {
        "action_id": action_id,
        "title": req.title,
        "description": req.description,
        "priority": req.priority,
        "status": "assigned" if req.assigned_to else "new",
        "project": req.project,
        "site_id": req.site_id,
        "location_id": req.location_id,
        "incident_id": req.incident_id,
        "assigned_to": req.assigned_to,
        "assigned_team": None,
        "due_at": req.due_at,
        "metadata": req.metadata,
        "created_at": now,
        "updated_at": now,
        "created_by": str(admin.get("_id") or admin.get("id") or admin.get("email")),
        "timeline": [{
            "at": now,
            "type": "created",
            "by": str(admin.get("_id") or admin.get("id") or admin.get("email")),
            "note": "Action created",
        }],
    }
    await db.the_eye_actions.insert_one(doc)
    doc.pop("_id", None)
    await broadcast_the_eye_event("action.created", doc)
    return {"ok": True, "action": doc}


@router.get("/admin/actions")
async def list_actions(
    request: Request,
    status: Optional[str] = None,
    priority: Optional[str] = None,
    incident_id: Optional[str] = None,
    assigned_to: Optional[str] = None,
    limit: int = Query(default=200, ge=1, le=2000),
):
    await _require_admin(request)
    query: Dict[str, Any] = {}
    if status:
        query["status"] = status
    if priority:
        query["priority"] = priority
    if incident_id:
        query["incident_id"] = incident_id
    if assigned_to:
        query["assigned_to"] = assigned_to

    rows = await db.the_eye_actions.find(query, {"_id": 0}).sort("updated_at", -1).to_list(limit)
    return {"ok": True, "count": len(rows), "actions": rows}


@router.patch("/admin/actions/{action_id}/status")
async def update_action_status(action_id: str, req: ActionStatusUpdate, request: Request):
    admin = await _require_admin(request)
    current = await db.the_eye_actions.find_one({"action_id": action_id}, {"_id": 0})
    if not current:
        raise HTTPException(status_code=404, detail="Action not found")

    now = _now()
    actor = str(admin.get("_id") or admin.get("id") or admin.get("email"))
    update: Dict[str, Any] = {"status": req.status, "updated_at": now}
    if req.status == "done":
        update["completed_at"] = now
        update["completed_by"] = actor

    await db.the_eye_actions.update_one(
        {"action_id": action_id},
        {
            "$set": update,
            "$push": {
                "timeline": {
                    "at": now,
                    "type": "status_changed",
                    "from": current.get("status"),
                    "to": req.status,
                    "by": actor,
                    "note": req.note,
                }
            },
        },
    )
    fresh = await db.the_eye_actions.find_one({"action_id": action_id}, {"_id": 0})
    await broadcast_the_eye_event("action.updated", fresh)
    return {"ok": True, "action": fresh}


@router.patch("/admin/actions/{action_id}/assign")
async def assign_action(action_id: str, req: AssignmentRequest, request: Request):
    admin = await _require_admin(request)
    current = await db.the_eye_actions.find_one({"action_id": action_id}, {"_id": 0})
    if not current:
        raise HTTPException(status_code=404, detail="Action not found")

    if req.assigned_to and not await _load_assignee(req.assigned_to):
        raise HTTPException(status_code=400, detail="Assignee not found")

    now = _now()
    actor = str(admin.get("_id") or admin.get("id") or admin.get("email"))
    new_status = "assigned" if (req.assigned_to or req.assigned_team) and current.get("status") == "new" else current.get("status")
    await db.the_eye_actions.update_one(
        {"action_id": action_id},
        {
            "$set": {
                "assigned_to": req.assigned_to,
                "assigned_team": req.assigned_team,
                "status": new_status,
                "updated_at": now,
            },
            "$push": {
                "timeline": {
                    "at": now,
                    "type": "assigned",
                    "by": actor,
                    "assigned_to": req.assigned_to,
                    "assigned_team": req.assigned_team,
                    "note": req.note,
                }
            },
        },
    )
    fresh = await db.the_eye_actions.find_one({"action_id": action_id}, {"_id": 0})
    await broadcast_the_eye_event("action.updated", fresh)
    return {"ok": True, "action": fresh}


@router.post("/admin/incidents/{incident_id}/actions")
async def create_incident_action(incident_id: str, req: ActionCreate, request: Request):
    admin = await _require_admin(request)
    incident = await _validate_incident(incident_id)
    now = _now()
    action_id = "ACT-" + secrets.token_hex(8).upper()

    doc = {
        "action_id": action_id,
        "title": req.title,
        "description": req.description,
        "priority": req.priority,
        "status": "assigned" if req.assigned_to else "new",
        "project": req.project,
        "site_id": req.site_id or incident.get("site_id"),
        "location_id": req.location_id or incident.get("location_id"),
        "incident_id": incident_id,
        "assigned_to": req.assigned_to,
        "assigned_team": None,
        "due_at": req.due_at,
        "metadata": req.metadata,
        "created_at": now,
        "updated_at": now,
        "created_by": str(admin.get("_id") or admin.get("id") or admin.get("email")),
        "timeline": [{
            "at": now,
            "type": "created_from_incident",
            "by": str(admin.get("_id") or admin.get("id") or admin.get("email")),
            "note": f"Created from incident {incident_id}",
        }],
    }
    await db.the_eye_actions.insert_one(doc)
    doc.pop("_id", None)

    await db.the_eye_incidents.update_one(
        {"incident_id": incident_id},
        {
            "$addToSet": {"action_ids": action_id},
            "$set": {"updated_at": now},
            "$push": {"timeline": {
                "at": now,
                "type": "action_created",
                "by": doc["created_by"],
                "action_id": action_id,
                "note": req.title,
            }},
        },
    )
    await broadcast_the_eye_event("action.created", doc)
    return {"ok": True, "action": doc}


@router.post("/admin/tickets")
async def create_ticket(req: TicketCreate, request: Request):
    admin = await _require_admin(request)
    incident = await _validate_incident(req.incident_id)

    if req.assigned_to and not await _load_assignee(req.assigned_to):
        raise HTTPException(status_code=400, detail="Assignee not found")

    now = _now()
    ticket_id = "TKT-" + secrets.token_hex(8).upper()
    doc = {
        "ticket_id": ticket_id,
        "title": req.title,
        "description": req.description,
        "priority": req.priority,
        "category": req.category,
        "status": "assigned" if (req.assigned_to or req.assigned_team) else "open",
        "incident_id": req.incident_id,
        "site_id": req.site_id or (incident or {}).get("site_id"),
        "location_id": req.location_id or (incident or {}).get("location_id"),
        "device_id": req.device_id,
        "camera_id": req.camera_id,
        "assigned_to": req.assigned_to,
        "assigned_team": req.assigned_team,
        "due_at": req.due_at,
        "created_at": now,
        "updated_at": now,
        "created_by": str(admin.get("_id") or admin.get("id") or admin.get("email")),
        "timeline": [{
            "at": now,
            "type": "created",
            "by": str(admin.get("_id") or admin.get("id") or admin.get("email")),
            "note": "Ticket created",
        }],
    }
    await db.the_eye_tickets.insert_one(doc)
    doc.pop("_id", None)

    if req.incident_id:
        await db.the_eye_incidents.update_one(
            {"incident_id": req.incident_id},
            {
                "$addToSet": {"ticket_ids": ticket_id},
                "$set": {"updated_at": now},
            },
        )

    await broadcast_the_eye_event("ticket.created", doc)
    return {"ok": True, "ticket": doc}


@router.get("/admin/tickets")
async def list_tickets(
    request: Request,
    status: Optional[str] = None,
    priority: Optional[str] = None,
    incident_id: Optional[str] = None,
    assigned_to: Optional[str] = None,
    limit: int = Query(default=200, ge=1, le=2000),
):
    await _require_admin(request)
    query: Dict[str, Any] = {}
    if status:
        query["status"] = status
    if priority:
        query["priority"] = priority
    if incident_id:
        query["incident_id"] = incident_id
    if assigned_to:
        query["assigned_to"] = assigned_to
    rows = await db.the_eye_tickets.find(query, {"_id": 0}).sort("updated_at", -1).to_list(limit)
    return {"ok": True, "count": len(rows), "tickets": rows}


@router.patch("/admin/tickets/{ticket_id}/assign")
async def assign_ticket(ticket_id: str, req: AssignmentRequest, request: Request):
    admin = await _require_admin(request)
    current = await db.the_eye_tickets.find_one({"ticket_id": ticket_id}, {"_id": 0})
    if not current:
        raise HTTPException(status_code=404, detail="Ticket not found")
    if req.assigned_to and not await _load_assignee(req.assigned_to):
        raise HTTPException(status_code=400, detail="Assignee not found")

    now = _now()
    actor = str(admin.get("_id") or admin.get("id") or admin.get("email"))
    await db.the_eye_tickets.update_one(
        {"ticket_id": ticket_id},
        {
            "$set": {
                "assigned_to": req.assigned_to,
                "assigned_team": req.assigned_team,
                "status": "assigned" if (req.assigned_to or req.assigned_team) else current.get("status"),
                "updated_at": now,
            },
            "$push": {"timeline": {
                "at": now,
                "type": "assigned",
                "by": actor,
                "assigned_to": req.assigned_to,
                "assigned_team": req.assigned_team,
                "note": req.note,
            }},
        },
    )
    fresh = await db.the_eye_tickets.find_one({"ticket_id": ticket_id}, {"_id": 0})
    await broadcast_the_eye_event("ticket.updated", fresh)
    return {"ok": True, "ticket": fresh}


@router.patch("/admin/tickets/{ticket_id}/status")
async def update_ticket_status(ticket_id: str, req: TicketStatusUpdate, request: Request):
    admin = await _require_admin(request)
    current = await db.the_eye_tickets.find_one({"ticket_id": ticket_id}, {"_id": 0})
    if not current:
        raise HTTPException(status_code=404, detail="Ticket not found")

    now = _now()
    actor = str(admin.get("_id") or admin.get("id") or admin.get("email"))
    update: Dict[str, Any] = {"status": req.status, "updated_at": now}
    if req.status in {"resolved", "closed"}:
        update[f"{req.status}_at"] = now
        update[f"{req.status}_by"] = actor

    await db.the_eye_tickets.update_one(
        {"ticket_id": ticket_id},
        {
            "$set": update,
            "$push": {"timeline": {
                "at": now,
                "type": "status_changed",
                "from": current.get("status"),
                "to": req.status,
                "by": actor,
                "note": req.note,
            }},
        },
    )
    fresh = await db.the_eye_tickets.find_one({"ticket_id": ticket_id}, {"_id": 0})
    await broadcast_the_eye_event("ticket.updated", fresh)
    return {"ok": True, "ticket": fresh}


@router.get("/admin/technicians")
async def list_technicians(
    request: Request,
    q: Optional[str] = None,
    limit: int = Query(default=100, ge=1, le=500),
):
    await _require_admin(request)

    role_filter: Dict[str, Any] = {
        "$or": [
            {"role": {"$in": ["technician", "support", "admin"]}},
            {"is_technician": True},
        ]
    }
    if q:
        role_filter = {
            "$and": [
                role_filter,
                {"$or": [
                    {"name": {"$regex": q, "$options": "i"}},
                    {"email": {"$regex": q, "$options": "i"}},
                    {"username": {"$regex": q, "$options": "i"}},
                ]},
            ]
        }

    rows = await db.users.find(
        role_filter,
        {
            "password": 0,
            "password_hash": 0,
            "token": 0,
            "refresh_token": 0,
        },
    ).limit(limit).to_list(limit)

    technicians = []
    for row in rows:
        technician_id = str(row.get("_id") or row.get("id") or row.get("email"))
        open_tickets = await db.the_eye_tickets.count_documents({
            "assigned_to": {"$in": [technician_id, row.get("id"), row.get("email")]},
            "status": {"$nin": ["resolved", "closed", "cancelled"]},
        })
        technicians.append({
            "technician_id": technician_id,
            "name": row.get("name") or row.get("username") or row.get("email"),
            "email": row.get("email"),
            "role": row.get("role"),
            "open_tickets": open_tickets,
            "region": row.get("region"),
            "skills": row.get("skills") or [],
        })

    return {"ok": True, "count": len(technicians), "technicians": technicians}


@router.get("/admin/actions/summary")
async def action_summary(request: Request):
    await _require_admin(request)

    action_rows = await db.the_eye_actions.aggregate([
        {"$match": {"status": {"$nin": ["done", "cancelled"]}}},
        {"$group": {"_id": "$priority", "count": {"$sum": 1}}},
    ]).to_list(20)
    ticket_rows = await db.the_eye_tickets.aggregate([
        {"$match": {"status": {"$nin": ["resolved", "closed", "cancelled"]}}},
        {"$group": {"_id": "$priority", "count": {"$sum": 1}}},
    ]).to_list(20)

    actions = {str(r.get("_id") or "unknown"): int(r.get("count") or 0) for r in action_rows}
    tickets = {str(r.get("_id") or "unknown"): int(r.get("count") or 0) for r in ticket_rows}
    return {
        "ok": True,
        "open_actions": sum(actions.values()),
        "open_tickets": sum(tickets.values()),
        "actions_by_priority": actions,
        "tickets_by_priority": tickets,
    }
