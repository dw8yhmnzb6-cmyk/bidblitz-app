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
    """User: Create a new support ticket."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    ticket_id = secrets.token_hex(6)
    now = datetime.now(timezone.utc).isoformat()
    
    ticket = {
        "ticket_id": ticket_id,
        "user_id": user_id,
        "user_name": user.get("name", ""),
        "user_email": user.get("email", ""),
        "subject": req.subject,
        "category": req.category,
        "status": "open",  # open, in_progress, resolved, closed
        "priority": "normal",  # low, normal, high, urgent
        "messages": [
            {
                "from_user_id": user_id,
                "from_name": user.get("name", ""),
                "message": req.message,
                "is_admin": False,
                "created_at": now,
            }
        ],
        "created_at": now,
        "updated_at": now,
    }
    
    await db.support_tickets.insert_one(ticket)
    
    # Notify admin
    admin = await db.users.find_one({"role": "admin"})
    if admin:
        try:
            asyncio.create_task(send_push_to_user(
                str(admin["_id"]),
                title="🆘 Neues Support-Ticket",
                body=f"{req.subject} von {user.get('name', 'User')}",
                data={"type": "new_ticket", "ticket_id": ticket_id},
            ))
        except Exception:
            pass
    
    return {
        "ok": True,
        "ticket_id": ticket_id,
        "message": "Ticket erstellt. Wir melden uns bald.",
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
    """Reply to a ticket (user or admin)."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    is_admin = user.get("role") == "admin"
    
    ticket = await db.support_tickets.find_one({"ticket_id": req.ticket_id})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket nicht gefunden")
    
    # Check permission
    is_owner = ticket["user_id"] == user_id
    if not (is_admin or is_owner):
        raise HTTPException(status_code=403, detail="Keine Berechtigung")
    
    now = datetime.now(timezone.utc).isoformat()
    
    new_message = {
        "from_user_id": user_id,
        "from_name": user.get("name", "Admin" if is_admin else ""),
        "message": req.message,
        "is_admin": is_admin,
        "created_at": now,
    }
    
    # Update ticket
    update_data = {
        "updated_at": now,
    }
    
    if is_admin and ticket["status"] == "open":
        update_data["status"] = "in_progress"
    
    await db.support_tickets.update_one(
        {"ticket_id": req.ticket_id},
        {
            "$push": {"messages": new_message},
            "$set": update_data,
        },
    )
    
    # Send notification to the other party
    notify_user_id = ticket["user_id"] if is_admin else None
    if notify_user_id:
        try:
            asyncio.create_task(send_push_to_user(
                notify_user_id,
                title=f"💬 Neue Antwort auf Ticket #{req.ticket_id[:6]}",
                body=req.message[:50],
                data={"type": "ticket_reply", "ticket_id": req.ticket_id},
            ))
        except Exception:
            pass
    
    return {"ok": True, "message": "Antwort gesendet"}


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
    """Admin: Get all tickets with optional status filter."""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    
    query = {}
    if status:
        query["status"] = status
    
    tickets = await db.support_tickets.find(
        query,
        {"_id": 0, "messages": 0}
    ).sort("updated_at", -1).to_list(200)
    
    return {"tickets": tickets, "total": len(tickets)}


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
