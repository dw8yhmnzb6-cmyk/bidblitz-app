"""
BidBlitz V2 - Event-Buchung (Tickets kaufen + VIP versteigern)
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from typing import Optional, List, Literal
from bson import ObjectId
from datetime import datetime, timezone
from core.database import db
from core.payment_engine import transfer_between_wallets, TransactionType
from core.security import get_current_user
import secrets
import hashlib
import os

router = APIRouter(prefix="/api/events", tags=["events"])

CASHBACK_RATE = 0.02
ORGANIZER_SHARE_RATE = 0.90


def _event_purchase_key(body_key: Optional[str], request: Request) -> str:
    key = (body_key or request.headers.get("Idempotency-Key") or "").strip()
    if not 8 <= len(key) <= 200:
        raise HTTPException(status_code=400, detail="Idempotency-Key erforderlich")
    return key


async def _event_platform_user_id() -> Optional[str]:
    email = os.environ.get("PLATFORM_POOL_EMAIL", "admin@bidblitz.ae").strip().lower()
    pool = await db.users.find_one({"email": email}, {"_id": 1})
    return str(pool["_id"]) if pool else None


async def _rollback_event_inventory(
    event_id: str,
    sold_field: str,
    quantity: int,
    marker_field: str,
    ticket_id: str,
) -> None:
    await db.events.update_one(
        {
            "event_id": event_id,
            f"{marker_field}.ticket_id": ticket_id,
            f"{marker_field}.status": "reserved",
        },
        {
            "$inc": {sold_field: -int(quantity)},
            "$unset": {marker_field: ""},
        },
    )


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
    ticket_type: Literal["standard", "vip"] = "standard"
    quantity: int = Field(1, ge=1, le=10)
    idempotency_key: Optional[str] = Field(default=None, max_length=200)


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
    if user.get("role") != "admin" and user.get("kyc_status") != "approved":
        raise HTTPException(
            status_code=403,
            detail={
                "error": "kyc_required",
                "message": "KYC-Verifizierung erforderlich, bevor ein Event veröffentlicht werden kann.",
                "kyc_status": user.get("kyc_status", "not_started"),
            },
        )

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
    """Reserve inventory and settle an event ticket exactly once through canonical wallets."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    idempotency_key = _event_purchase_key(req.idempotency_key, request)
    key_hash = hashlib.sha256(f"{user_id}:{idempotency_key}".encode("utf-8")).hexdigest()[:20]
    ticket_id = f"EVT-{key_hash.upper()}"

    existing = await db.event_tickets.find_one(
        {"ticket_id": ticket_id, "buyer_id": user_id},
        {"_id": 0},
    )
    if existing:
        expected = (req.event_id, req.ticket_type, int(req.quantity))
        actual = (
            existing.get("event_id"),
            existing.get("ticket_type"),
            int(existing.get("quantity") or 0),
        )
        if actual != expected:
            raise HTTPException(status_code=409, detail="Idempotency-Key wurde bereits für einen anderen Ticketkauf verwendet")
        return {"ok": True, "ticket": existing, "replayed": True}

    event = await db.events.find_one({"event_id": req.event_id, "status": "active"})
    if not event:
        raise HTTPException(status_code=404, detail="Event nicht gefunden")

    organizer_id = str(event.get("organizer_id") or "")
    if not organizer_id or not ObjectId.is_valid(organizer_id):
        raise HTTPException(status_code=409, detail="Event hat keinen verifizierten Veranstalter")
    if organizer_id == user_id:
        raise HTTPException(status_code=400, detail="Eigene Event-Tickets können nicht gekauft werden")

    is_vip = req.ticket_type == "vip"
    price = round(float(event["vip_price"] if is_vip else event["ticket_price"]), 2)
    if price <= 0:
        raise HTTPException(status_code=400, detail="Ungültiger Ticketpreis")
    total = round(price * int(req.quantity), 2)

    sold_field = "vip_sold" if is_vip else "tickets_sold"
    max_field = "total_vip" if is_vip else "total_tickets"
    marker_hash = hashlib.sha256(f"event-ticket:{ticket_id}".encode("utf-8")).hexdigest()[:24]
    marker_field = f"ticket_reservations.{marker_hash}"

    reserve = await db.events.update_one(
        {
            "event_id": req.event_id,
            "status": "active",
            marker_field: {"$exists": False},
            "$expr": {
                "$lte": [
                    {"$add": [{"$ifNull": ["$" + sold_field, 0]}, int(req.quantity)]},
                    {"$ifNull": ["$" + max_field, 0]},
                ]
            },
        },
        {
            "$inc": {sold_field: int(req.quantity)},
            "$set": {
                marker_field: {
                    "ticket_id": ticket_id,
                    "buyer_id": user_id,
                    "quantity": int(req.quantity),
                    "ticket_type": req.ticket_type,
                    "status": "reserved",
                    "reserved_at": datetime.now(timezone.utc).isoformat(),
                }
            },
        },
    )
    if reserve.modified_count != 1:
        refreshed = await db.events.find_one({"event_id": req.event_id})
        marker = ((refreshed or {}).get("ticket_reservations") or {}).get(marker_hash)
        if not marker or marker.get("ticket_id") != ticket_id:
            raise HTTPException(status_code=409, detail="Nicht genug Tickets verfügbar")

    platform_user_id = await _event_platform_user_id()
    if not platform_user_id:
        await _rollback_event_inventory(req.event_id, sold_field, req.quantity, marker_field, ticket_id)
        raise HTTPException(status_code=503, detail="Event-Settlement-Wallet ist nicht konfiguriert")
    if platform_user_id == user_id:
        await _rollback_event_inventory(req.event_id, sold_field, req.quantity, marker_field, ticket_id)
        raise HTTPException(status_code=409, detail="Plattform-Wallet darf nicht Käufer-Wallet sein")

    payment = await transfer_between_wallets(
        from_user_id=user_id,
        to_user_id=platform_user_id,
        amount=total,
        tx_type=TransactionType.PAYMENT,
        description=f"Event Ticket: {event['title']} ({req.ticket_type} x{req.quantity})",
        reference=f"EVT-PAY-{key_hash[:12].upper()}",
        metadata={
            "kind": "event_ticket_purchase",
            "ticket_id": ticket_id,
            "event_id": req.event_id,
            "organizer_id": organizer_id,
        },
        idempotency_key=f"event:payment:{ticket_id}",
    )
    if not payment.success:
        status = str(getattr(payment.status, "value", payment.status))
        if status not in {"pending", "reconciliation_required"}:
            await _rollback_event_inventory(req.event_id, sold_field, req.quantity, marker_field, ticket_id)
        else:
            await db.events.update_one(
                {"event_id": req.event_id, f"{marker_field}.ticket_id": ticket_id},
                {"$set": {f"{marker_field}.status": "payment_reconciliation"}},
            )
        raise HTTPException(
            status_code=409 if status in {"pending", "reconciliation_required"} else 402,
            detail=payment.error or "Ticket-Zahlung fehlgeschlagen",
        )

    organizer_share = round(total * ORGANIZER_SHARE_RATE, 2)
    cashback = round(total * CASHBACK_RATE, 2)
    platform_net = round(total - organizer_share - cashback, 2)
    if platform_net < 0:
        raise HTTPException(status_code=500, detail="Ungültige Event-Provisionskonfiguration")

    organizer_payment = None
    if organizer_id != platform_user_id and organizer_share > 0:
        organizer_payment = await transfer_between_wallets(
            from_user_id=platform_user_id,
            to_user_id=organizer_id,
            amount=organizer_share,
            tx_type=TransactionType.MERCHANT_CREDIT,
            description=f"Event Erlös: {event['title']}",
            reference=f"EVT-ORG-{key_hash[:12].upper()}",
            metadata={
                "kind": "event_organizer_settlement",
                "ticket_id": ticket_id,
                "event_id": req.event_id,
                "gross": total,
            },
            idempotency_key=f"event:organizer:{ticket_id}",
        )
        if not organizer_payment.success:
            await db.events.update_one(
                {"event_id": req.event_id, f"{marker_field}.ticket_id": ticket_id},
                {"$set": {
                    f"{marker_field}.status": "reconciliation_required",
                    f"{marker_field}.error": organizer_payment.error,
                }},
            )
            raise HTTPException(status_code=409, detail=organizer_payment.error or "Veranstalter-Auszahlung benötigt Abstimmung")

    cashback_payment = None
    if cashback > 0:
        cashback_payment = await transfer_between_wallets(
            from_user_id=platform_user_id,
            to_user_id=user_id,
            amount=cashback,
            tx_type=TransactionType.LOYALTY_CASHBACK,
            description=f"Event Cashback: {event['title']}",
            reference=f"EVT-CB-{key_hash[:12].upper()}",
            metadata={
                "kind": "event_cashback",
                "ticket_id": ticket_id,
                "event_id": req.event_id,
            },
            idempotency_key=f"event:cashback:{ticket_id}",
        )
        if not cashback_payment.success:
            await db.events.update_one(
                {"event_id": req.event_id, f"{marker_field}.ticket_id": ticket_id},
                {"$set": {
                    f"{marker_field}.status": "reconciliation_required",
                    f"{marker_field}.error": cashback_payment.error,
                }},
            )
            raise HTTPException(status_code=409, detail=cashback_payment.error or "Cashback benötigt Abstimmung")

    now = datetime.now(timezone.utc).isoformat()
    ticket = {
        "_id": ticket_id,
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
        "quantity": int(req.quantity),
        "price_each": price,
        "total": total,
        "organizer_share": organizer_share,
        "cashback": cashback,
        "platform_net": platform_net,
        "qr_code": f"BLZEVT-{ticket_id.upper()}",
        "status": "valid",
        "reference": payment.reference,
        "payment_transaction_id": payment.transaction_id,
        "organizer_transaction_id": organizer_payment.transaction_id if organizer_payment else None,
        "cashback_transaction_id": cashback_payment.transaction_id if cashback_payment else None,
        "idempotency_key": idempotency_key,
        "created_at": now,
    }

    try:
        await db.event_tickets.update_one(
            {"_id": ticket_id},
            {"$setOnInsert": ticket},
            upsert=True,
        )
    except Exception as exc:
        await db.events.update_one(
            {"event_id": req.event_id, f"{marker_field}.ticket_id": ticket_id},
            {"$set": {
                f"{marker_field}.status": "reconciliation_required",
                f"{marker_field}.error": f"ticket_persistence:{str(exc)[:200]}",
            }},
        )
        raise HTTPException(status_code=500, detail="Zahlung erfolgt; Ticket-Speicherung benötigt Abstimmung")

    await db.events.update_one(
        {"event_id": req.event_id, f"{marker_field}.ticket_id": ticket_id},
        {"$set": {
            f"{marker_field}.status": "completed",
            f"{marker_field}.completed_at": now,
        }},
    )
    await db.platform_fees.update_one(
        {"_id": f"event:{ticket_id}"},
        {"$setOnInsert": {
            "_id": f"event:{ticket_id}",
            "type": "event",
            "event_id": req.event_id,
            "ticket_id": ticket_id,
            "gross": total,
            "organizer_share": organizer_share,
            "cashback": cashback,
            "platform_fee": platform_net,
            "created_at": now,
        }},
        upsert=True,
    )

    saved = await db.event_tickets.find_one({"_id": ticket_id}, {"_id": 0}) or ticket
    return {
        "ok": True,
        "ticket": saved,
        "replayed": bool(
            payment.idempotent_replay
            or (organizer_payment and organizer_payment.idempotent_replay)
            or (cashback_payment and cashback_payment.idempotent_replay)
        ),
    }

