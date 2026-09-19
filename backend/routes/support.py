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
from core.rate_limit import limiter
import secrets

router = APIRouter(prefix="/api/support", tags=["support"])


class CreateTicketRequest(BaseModel):
    subject: str = Field(..., min_length=1, max_length=200)
    message: str = Field(..., min_length=1, max_length=2000)
    category: str = Field("general", pattern="^(general|payments|account|security|merchant)$")
    reference: str = Field("", max_length=100)


class TicketMessageRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000)


@router.post("/tickets")
@limiter.limit("10/hour")
async def create_ticket(req: CreateTicketRequest, request: Request):
    user = await get_current_user(request)
    user_id = str(user["_id"])
    subject = req.subject.strip()
    message = req.message.strip()
    if not subject or not message:
        raise HTTPException(status_code=400, detail="Betreff und Nachricht dürfen nicht leer sein")

    open_count = await db.support_tickets.count_documents({
        "user_id": user_id,
        "status": {"$in": ["open", "in_progress"]},
    })
    if open_count >= 10:
        raise HTTPException(status_code=429, detail="Zu viele offene Support-Tickets. Bitte bestehende Anfrage weiterführen.")

    now = datetime.now(timezone.utc).isoformat()
    ticket_id = f"TK-{secrets.token_hex(8).upper()}"

    ticket = {
        "ticket_id": ticket_id,
        "user_id": user_id,
        "user_email": user.get("email", ""),
        "user_name": user.get("name", ""),
        "subject": subject,
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
        "message": message,
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
@limiter.limit("60/minute")
async def send_ticket_message(ticket_id: str, req: TicketMessageRequest, request: Request):
    user = await get_current_user(request)
    user_id = str(user["_id"])
    is_admin = user.get("role") in ["admin", "super_admin"]

    ticket = await db.support_tickets.find_one({"ticket_id": ticket_id})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket nicht gefunden")

    if ticket["user_id"] != user_id and not is_admin:
        raise HTTPException(status_code=403, detail="Kein Zugriff")
    if ticket.get("status") == "closed":
        raise HTTPException(status_code=409, detail="Ticket ist geschlossen. Bitte erstelle bei Bedarf eine neue Anfrage.")

    message = req.message.strip()
    if not message:
        raise HTTPException(status_code=400, detail="Nachricht darf nicht leer sein")
    now = datetime.now(timezone.utc).isoformat()

    msg = {
        "ticket_id": ticket_id,
        "sender_id": user_id,
        "sender_name": user.get("name", ""),
        "sender_role": "admin" if is_admin else "user",
        "message": message,
        "created_at": now,
    }
    await db.support_messages.insert_one(msg)
    msg.pop("_id", None)

    # A user reply to a resolved ticket reopens it; a fully closed ticket is immutable.
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

    if ticket.get("status") == "closed":
        return {"ok": True, "status": "closed", "replayed": True}

    now = datetime.now(timezone.utc).isoformat()
    await db.support_tickets.update_one(
        {"ticket_id": ticket_id, "status": {"$ne": "closed"}},
        {"$set": {
            "status": "closed",
            "updated_at": now,
            "closed_at": now,
            "closed_by": user_id,
        }}
    )
    return {"ok": True, "status": "closed", "replayed": False}


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
        if status not in {"open", "in_progress", "resolved", "closed"}:
            raise HTTPException(status_code=400, detail="Ungültiger Ticket-Status")
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
