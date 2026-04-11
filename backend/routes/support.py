"""
BidBlitz V2 - Support Ticket Routes
Store and manage support requests from users.
Now with threaded chat messages per ticket.
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


class TicketMessageRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000)


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
        "category": req.category,
        "reference": req.reference or "",
        "status": "open",
        "created_at": now,
        "updated_at": now,
    }
    await db.support_tickets.insert_one(ticket)
    ticket.pop("_id", None)

    # Create initial message
    msg = {
        "ticket_id": ticket_id,
        "sender_id": user_id,
        "sender_name": user.get("name", ""),
        "sender_role": "user",
        "message": req.message,
        "created_at": now,
    }
    await db.support_messages.insert_one(msg)

    return {"success": True, "ticket_id": ticket_id, "status": "open"}


@router.get("/tickets")
async def get_my_tickets(request: Request, limit: int = Query(20, le=100)):
    user = await get_current_user(request)
    user_id = str(user["_id"])

    tickets = await db.support_tickets.find(
        {"user_id": user_id}, {"_id": 0}
    ).sort("created_at", -1).to_list(limit)

    # Attach last message + unread count
    for t in tickets:
        last = await db.support_messages.find(
            {"ticket_id": t["ticket_id"]}, {"_id": 0}
        ).sort("created_at", -1).limit(1).to_list(1)
        t["last_message"] = last[0]["message"][:80] if last else ""
        t["last_message_at"] = last[0]["created_at"] if last else t["created_at"]
        msg_count = await db.support_messages.count_documents({"ticket_id": t["ticket_id"]})
        t["message_count"] = msg_count

    return {"tickets": tickets, "total": len(tickets)}


@router.get("/tickets/{ticket_id}")
async def get_ticket_detail(ticket_id: str, request: Request):
    user = await get_current_user(request)
    user_id = str(user["_id"])
    is_admin = user.get("role") in ["admin", "super_admin"]

    ticket = await db.support_tickets.find_one({"ticket_id": ticket_id}, {"_id": 0})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket nicht gefunden")

    if ticket["user_id"] != user_id and not is_admin:
        raise HTTPException(status_code=403, detail="Kein Zugriff")

    messages = await db.support_messages.find(
        {"ticket_id": ticket_id}, {"_id": 0}
    ).sort("created_at", 1).to_list(500)

    return {"ticket": ticket, "messages": messages}


@router.post("/tickets/{ticket_id}/messages")
async def send_ticket_message(ticket_id: str, req: TicketMessageRequest, request: Request):
    user = await get_current_user(request)
    user_id = str(user["_id"])
    is_admin = user.get("role") in ["admin", "super_admin"]

    ticket = await db.support_tickets.find_one({"ticket_id": ticket_id})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket nicht gefunden")

    if ticket["user_id"] != user_id and not is_admin:
        raise HTTPException(status_code=403, detail="Kein Zugriff")

    now = datetime.now(timezone.utc).isoformat()

    msg = {
        "ticket_id": ticket_id,
        "sender_id": user_id,
        "sender_name": user.get("name", ""),
        "sender_role": "admin" if is_admin else "user",
        "message": req.message,
        "created_at": now,
    }
    await db.support_messages.insert_one(msg)
    msg.pop("_id", None)

    # Reopen if closed and user sends message
    if ticket["status"] == "resolved" and not is_admin:
        await db.support_tickets.update_one(
            {"ticket_id": ticket_id},
            {"$set": {"status": "open", "updated_at": now}}
        )

    await db.support_tickets.update_one(
        {"ticket_id": ticket_id},
        {"$set": {"updated_at": now}}
    )

    return {"ok": True, "message": msg}


@router.post("/tickets/{ticket_id}/close")
async def close_ticket(ticket_id: str, request: Request):
    user = await get_current_user(request)
    user_id = str(user["_id"])
    is_admin = user.get("role") in ["admin", "super_admin"]

    ticket = await db.support_tickets.find_one({"ticket_id": ticket_id})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket nicht gefunden")
    if ticket["user_id"] != user_id and not is_admin:
        raise HTTPException(status_code=403, detail="Kein Zugriff")

    now = datetime.now(timezone.utc).isoformat()
    await db.support_tickets.update_one(
        {"ticket_id": ticket_id},
        {"$set": {"status": "resolved", "updated_at": now, "resolved_at": now}}
    )
    return {"ok": True}


# ══════════════════════════════════════════════════════════════════════════════
# ADMIN ROUTES
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/admin/tickets")
async def admin_get_tickets(
    request: Request,
    status: str = Query("", description="open, resolved, closed"),
    limit: int = Query(50, le=200),
    skip: int = Query(0, ge=0),
):
    user = await get_current_user(request)
    if user.get("role") not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")

    query = {}
    if status:
        query["status"] = status

    tickets = await db.support_tickets.find(query, {"_id": 0}).sort("updated_at", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.support_tickets.count_documents(query)

    for t in tickets:
        msg_count = await db.support_messages.count_documents({"ticket_id": t["ticket_id"]})
        t["message_count"] = msg_count

    return {"tickets": tickets, "total": total}


class ResolveTicketRequest(BaseModel):
    response: str = Field("", max_length=2000)


@router.post("/admin/tickets/{ticket_id}/resolve")
async def admin_resolve_ticket(ticket_id: str, req: ResolveTicketRequest, request: Request):
    user = await get_current_user(request)
    if user.get("role") not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")

    ticket = await db.support_tickets.find_one({"ticket_id": ticket_id})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    now = datetime.now(timezone.utc).isoformat()

    # Add admin response as a message
    if req.response:
        msg = {
            "ticket_id": ticket_id,
            "sender_id": str(user["_id"]),
            "sender_name": user.get("name", "Admin"),
            "sender_role": "admin",
            "message": req.response,
            "created_at": now,
        }
        await db.support_messages.insert_one(msg)

    await db.support_tickets.update_one(
        {"ticket_id": ticket_id},
        {"$set": {
            "status": "resolved",
            "resolved_at": now,
            "resolved_by": str(user["_id"]),
            "updated_at": now,
        }},
    )

    return {"success": True, "ticket_id": ticket_id, "status": "resolved"}
