"""
BidBlitz V2 - Support Ticket Routes
Store and manage support requests from users.
"""

from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Request, Query
from pydantic import BaseModel, Field
from core.database import db
from core.security import get_current_user
import secrets

router = APIRouter(prefix="/api/support", tags=["support"])


class CreateTicketRequest(BaseModel):
    subject: str = Field(..., min_length=1, max_length=200)
    message: str = Field(..., min_length=1, max_length=2000)
    category: str = Field("general", max_length=50)
    reference: str = Field("", max_length=100)


@router.post("/tickets")
async def create_ticket(req: CreateTicketRequest, request: Request):
    user = await get_current_user(request)
    user_id = str(user["_id"])
    now = datetime.now(timezone.utc).isoformat()
    ticket_id = f"TK-{secrets.token_hex(4).upper()}"

    ticket = {
        "ticket_id": ticket_id,
        "user_id": user_id,
        "user_email": user.get("email", ""),
        "user_name": user.get("name", ""),
        "subject": req.subject,
        "message": req.message,
        "category": req.category,
        "reference": req.reference or "",
        "status": "open",
        "created_at": now,
        "updated_at": now,
    }
    await db.support_tickets.insert_one(ticket)
    ticket.pop("_id", None)

    return {"success": True, "ticket_id": ticket_id, "status": "open"}


@router.get("/tickets")
async def get_my_tickets(request: Request, limit: int = Query(20, le=100)):
    user = await get_current_user(request)
    user_id = str(user["_id"])

    tickets = await db.support_tickets.find(
        {"user_id": user_id}, {"_id": 0}
    ).sort("created_at", -1).to_list(limit)

    return {"tickets": tickets, "total": len(tickets)}


@router.get("/admin/tickets")
async def admin_get_tickets(
    request: Request,
    status: str = Query("", description="open, resolved, closed"),
    limit: int = Query(50, le=200),
    skip: int = Query(0, ge=0),
):
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    query = {}
    if status:
        query["status"] = status

    tickets = await db.support_tickets.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.support_tickets.count_documents(query)

    return {"tickets": tickets, "total": total}


class ResolveTicketRequest(BaseModel):
    response: str = Field("", max_length=2000)


@router.post("/admin/tickets/{ticket_id}/resolve")
async def admin_resolve_ticket(ticket_id: str, req: ResolveTicketRequest, request: Request):
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    ticket = await db.support_tickets.find_one({"ticket_id": ticket_id})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    now = datetime.now(timezone.utc).isoformat()
    await db.support_tickets.update_one(
        {"ticket_id": ticket_id},
        {"$set": {
            "status": "resolved",
            "resolved_at": now,
            "resolved_by": str(user["_id"]),
            "admin_response": req.response,
            "updated_at": now,
        }},
    )

    return {"success": True, "ticket_id": ticket_id, "status": "resolved"}
