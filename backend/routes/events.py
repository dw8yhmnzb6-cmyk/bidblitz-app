"""
BidBlitz V2 - Event-Buchung (Tickets kaufen + VIP versteigern)
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from typing import Optional, List
from bson import ObjectId
from datetime import datetime, timezone
from core.database import db
from core.security import get_current_user
import secrets

router = APIRouter(prefix="/api/events", tags=["events"])

CASHBACK_RATE = 0.02


class EventCreate(BaseModel):
    title: str
    description: str = ""
    category: str = "concert"  # concert, sports, comedy, theater, festival, other
    venue: str = ""
    city: str = ""
    date: str  # YYYY-MM-DD
    time: str = "20:00"
    ticket_price: float = Field(..., gt=0)
    vip_price: float = 0
    total_tickets: int = 100
    total_vip: int = 10
    image_url: str = ""


class TicketPurchase(BaseModel):
    event_id: str
    ticket_type: str = "standard"  # standard | vip
    quantity: int = Field(1, ge=1, le=10)


# ─── Events ───

@router.get("/list")
async def list_events(city: str = "", category: str = "", limit: int = 30):
    query = {"status": "active"}
    if city:
        query["city"] = {"$regex": city, "$options": "i"}
    if category:
        query["category"] = category
    events = await db.events.find(query, {"_id": 0}).sort("date", 1).limit(limit).to_list(limit)
    return {"events": events, "count": len(events)}


@router.get("/categories")
async def get_categories():
    return {
        "categories": [
            {"id": "concert", "label": "Konzerte", "icon": "music"},
            {"id": "sports", "label": "Sport", "icon": "trophy"},
            {"id": "comedy", "label": "Comedy", "icon": "laugh"},
            {"id": "theater", "label": "Theater", "icon": "drama"},
            {"id": "festival", "label": "Festivals", "icon": "tent"},
            {"id": "other", "label": "Sonstiges", "icon": "calendar"},
        ]
    }


@router.get("/my-tickets")
async def my_tickets(request: Request):
    user = await get_current_user(request)
    tickets = await db.event_tickets.find(
        {"buyer_id": str(user["_id"])}, {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    return {"tickets": tickets}


@router.get("/{event_id}")
async def get_event(event_id: str):
    e = await db.events.find_one({"event_id": event_id}, {"_id": 0})
    if not e:
        raise HTTPException(status_code=404, detail="Event nicht gefunden")
    return e


@router.post("/create")
async def create_event(req: EventCreate, request: Request):
    user = await get_current_user(request)
    if user.get("role") not in ("admin", "merchant"):
        raise HTTPException(status_code=403, detail="Nur Händler/Admins können Events erstellen")

    now = datetime.now(timezone.utc).isoformat()
    event_id = secrets.token_hex(8)
    doc = {
        "event_id": event_id,
        "organizer_id": str(user["_id"]),
        "organizer_name": user.get("name", ""),
        "title": req.title,
        "description": req.description,
        "category": req.category,
        "venue": req.venue,
        "city": req.city,
        "date": req.date,
        "time": req.time,
        "ticket_price": req.ticket_price,
        "vip_price": req.vip_price or req.ticket_price * 3,
        "total_tickets": req.total_tickets,
        "total_vip": req.total_vip,
        "tickets_sold": 0,
        "vip_sold": 0,
        "image_url": req.image_url,
        "status": "active",
        "created_at": now,
    }
    await db.events.insert_one(doc)
    doc.pop("_id", None)
    return {"ok": True, "event": doc}


@router.post("/buy")
async def buy_ticket(req: TicketPurchase, request: Request):
    user = await get_current_user(request)
    user_id = str(user["_id"])

    event = await db.events.find_one({"event_id": req.event_id, "status": "active"})
    if not event:
        raise HTTPException(status_code=404, detail="Event nicht gefunden")

    is_vip = req.ticket_type == "vip"
    price = event["vip_price"] if is_vip else event["ticket_price"]
    total = round(price * req.quantity, 2)

    # Check availability
    sold_field = "vip_sold" if is_vip else "tickets_sold"
    max_field = "total_vip" if is_vip else "total_tickets"
    if event.get(sold_field, 0) + req.quantity > event.get(max_field, 0):
        raise HTTPException(status_code=400, detail="Nicht genug Tickets verfügbar")

    balance = user.get("balance", 0)
    if balance < total:
        raise HTTPException(status_code=400, detail=f"Nicht genug Guthaben. Benötigt: €{total:.2f}")

    # Charge
    result = await db.users.update_one(
        {"_id": user["_id"], "balance": {"$gte": total}},
        {"$inc": {"balance": -total}},
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=400, detail="Zahlung fehlgeschlagen")

    # Credit organizer (90%)
    if event.get("organizer_id"):
        await db.users.update_one(
            {"_id": ObjectId(event["organizer_id"])},
            {"$inc": {"balance": round(total * 0.9, 2)}},
        )

    # Cashback
    cashback = round(total * CASHBACK_RATE, 2)
    if cashback > 0:
        await db.users.update_one({"_id": user["_id"]}, {"$inc": {"balance": cashback}})

    # Update sold count
    await db.events.update_one({"event_id": req.event_id}, {"$inc": {sold_field: req.quantity}})

    now = datetime.now(timezone.utc).isoformat()
    ticket_id = secrets.token_hex(8)
    ref = f"EVT-{secrets.token_hex(4).upper()}"

    ticket = {
        "ticket_id": ticket_id,
        "event_id": req.event_id,
        "event_title": event["title"],
        "event_date": event["date"],
        "event_time": event.get("time", ""),
        "event_venue": event.get("venue", ""),
        "buyer_id": user_id,
        "buyer_name": user.get("name", ""),
        "buyer_email": user.get("email", ""),
        "ticket_type": req.ticket_type,
        "quantity": req.quantity,
        "price_each": price,
        "total": total,
        "cashback": cashback,
        "qr_code": f"BLZEVT-{ticket_id.upper()}",
        "status": "valid",
        "reference": ref,
        "created_at": now,
    }
    await db.event_tickets.insert_one(ticket)
    ticket.pop("_id", None)

    await db.transactions.insert_one({
        "id": ticket_id, "user_id": user_id, "type": "event_ticket",
        "amount": -total, "description": f"Ticket: {event['title']} ({req.ticket_type.upper()} x{req.quantity})",
        "status": "completed", "reference": ref, "category": "event", "created_at": now,
    })

    return {"ok": True, "ticket": ticket}
