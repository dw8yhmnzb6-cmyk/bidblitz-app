"""
BidBlitz V2 - Support Ticket System
Professional ticketing system for customer support with status tracking and admin panel.
"""
import secrets
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from bson import ObjectId
import asyncio

from core.database import db
from core.security import get_current_user
from routes.web_push import send_push_to_user

router = APIRouter(prefix="/api/support/tickets", tags=["support-tickets"])


class CreateTicketRequest(BaseModel):
    subject: str
    message: str
    category: str  # account, payment, technical, other


class ReplyTicketRequest(BaseModel):
    ticket_id: str
    message: str


@router.post("/create")
async def create_ticket(req: CreateTicketRequest, request: Request):
    """Backward-compatible wrapper around the canonical support ticket flow."""
    from routes.support import CreateTicketRequest as CanonicalCreateTicketRequest, create_ticket as canonical_create_ticket
    result = await canonical_create_ticket(
        CanonicalCreateTicketRequest(
            subject=req.subject,
            message=req.message,
            category=req.category,
        ),
        request,
    )
    return {
        "ok": True,
        "ticket_id": result["ticket_id"],
        "status": result.get("status", "open"),
        "message": "Ticket erstellt. Wir melden uns bald.",
        "canonical": True,
    }


@router.get("/my")
async def get_my_tickets(request: Request):
    """User: Get all my tickets."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    tickets = await db.support_tickets.find(
        {"user_id": user_id},
        {"_id": 0, "messages": 0}
    ).sort("updated_at", -1).to_list(100)
    
    return {"tickets": tickets, "total": len(tickets)}


@router.get("/{ticket_id}")
async def get_ticket_detail(ticket_id: str, request: Request):
    """Get full ticket details including messages."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    ticket = await db.support_tickets.find_one({"ticket_id": ticket_id}, {"_id": 0})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket nicht gefunden")
    
    # Check permission
    is_admin = user.get("role") == "admin"
    is_owner = ticket["user_id"] == user_id
    
    if not (is_admin or is_owner):
        raise HTTPException(status_code=403, detail="Keine Berechtigung")
    
    return ticket


@router.post("/reply")
async def reply_to_ticket(req: ReplyTicketRequest, request: Request):
    """Backward-compatible wrapper around canonical threaded support messages."""
    from routes.support import TicketMessageRequest as CanonicalTicketMessageRequest, send_ticket_message
    result = await send_ticket_message(
        req.ticket_id,
        CanonicalTicketMessageRequest(message=req.message),
        request,
    )
    return {
        "ok": True,
        "message": "Antwort gesendet",
        "ticket_message": result.get("message"),
        "canonical": True,
    }


@router.post("/{ticket_id}/close")
async def close_ticket(ticket_id: str, request: Request):
    """User: Close/resolve a ticket."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    ticket = await db.support_tickets.find_one({"ticket_id": ticket_id})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket nicht gefunden")
    
    # Only owner or admin can close
    is_admin = user.get("role") == "admin"
    is_owner = ticket["user_id"] == user_id
    if not (is_admin or is_owner):
        raise HTTPException(status_code=403, detail="Keine Berechtigung")
    
    await db.support_tickets.update_one(
        {"ticket_id": ticket_id},
        {
            "$set": {
                "status": "closed",
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }
        },
    )
    
    return {"ok": True, "message": "Ticket geschlossen"}


# Admin endpoints
@router.get("/admin/all")
async def get_all_tickets(request: Request, status: Optional[str] = None):
    """Legacy admin listing backed by canonical support records."""
    from routes.support import admin_get_tickets
    return await admin_get_tickets(request=request, status=status or "", limit=100, skip=0)


@router.post("/admin/{ticket_id}/status")
async def update_ticket_status(ticket_id: str, status: str, request: Request):
    """Admin: Update ticket status."""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    
    valid_statuses = ["open", "in_progress", "resolved", "closed"]
    if status not in valid_statuses:
        raise HTTPException(status_code=400, detail="Ungültiger Status")
    
    await db.support_tickets.update_one(
        {"ticket_id": ticket_id},
        {
            "$set": {
                "status": status,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }
        },
    )
    
    return {"ok": True, "status": status}
