import secrets
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from core.database import db
from core.security import get_current_user
from core.payment_engine import transfer_between_wallets, TransactionType


router = APIRouter(prefix="/api/audi-tickets", tags=["audi-tickets"])

AUDI_EVENT_OWNER_EMAIL = "admin@bidblitz.ae"

AUDI_TICKET_CATALOG = [
    {
        "ticket_type_id": "grandstand-premium",
        "title": "Audi Tribüne Premium",
        "subtitle": "Beste Sicht auf Start/Ziel mit Lounge-Zugang",
        "description": "Premium Sitzplatz mit Priority Entry, Welcome Drink und Audi Fan Package.",
        "price": 149.0,
        "currency": "EUR",
        "inventory_total": 180,
        "inventory_reserved": 0,
        "max_per_order": 4,
        "badge": "Premium",
        "gradient": "linear-gradient(135deg, #D90429 0%, #7B1022 100%)",
        "perks": ["Priority Entry", "Lounge Zugang", "Audi Fan Package"],
    },
    {
        "ticket_type_id": "track-day",
        "title": "Audi Track Day Pass",
        "subtitle": "Ganztägiger Zugang zu Rennstrecke und Markenwelt",
        "description": "Ideal für Fans, die Experience-Zonen, Showcars und Track-Atmosphäre live erleben wollen.",
        "price": 79.0,
        "currency": "EUR",
        "inventory_total": 420,
        "inventory_reserved": 0,
        "max_per_order": 6,
        "badge": "Beliebt",
        "gradient": "linear-gradient(135deg, #111827 0%, #374151 100%)",
        "perks": ["Ganztageszugang", "Experience Zone", "Merch & Food Area"],
    },
    {
        "ticket_type_id": "vip-hospitality",
        "title": "Audi VIP Hospitality",
        "subtitle": "Exklusiver Hospitality-Bereich mit Fahrerblick",
        "description": "Business- und VIP-Gäste erhalten Hospitality, Catering, Fast Lane und exklusive Audi Präsentation.",
        "price": 329.0,
        "currency": "EUR",
        "inventory_total": 60,
        "inventory_reserved": 0,
        "max_per_order": 2,
        "badge": "VIP",
        "gradient": "linear-gradient(135deg, #C9A227 0%, #7C5E10 100%)",
        "perks": ["Hospitality", "Premium Catering", "Fast Lane Check-in"],
    },
]

AUDI_EVENT_TEMPLATE = {
    "event_id": "audi-summer-drive-2026",
    "slug": "audi-summer-drive-2026",
    "title": "Audi Summer Drive 2026",
    "subtitle": "Tickets direkt mit deinem BidBlitz Wallet bezahlen",
    "description": "Sichere dir Tribünen-, Track- oder VIP-Tickets für das Audi Erlebnis-Wochenende – direkt über dein Wallet, ohne externen Checkout.",
    "city": "Dubai",
    "venue": "Audi Performance Arena",
    "event_date": "2026-08-21",
    "event_time": "18:30",
    "hero_image": "https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1400&q=80",
    "gallery": [
        "https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1200&q=80",
        "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=1200&q=80",
        "https://images.unsplash.com/photo-1511919884226-fd3cad34687c?auto=format&fit=crop&w=1200&q=80",
    ],
    "highlights": [
        "Wallet-Zahlung in Sekunden",
        "Digitale Tickets mit QR-Code",
        "Live Bestandsanzeige pro Kategorie",
    ],
    "status": "active",
}


class AudiTicketPurchaseRequest(BaseModel):
    ticket_type_id: str
    quantity: int = Field(1, ge=1, le=10)
    attendee_name: Optional[str] = None
    attendee_email: Optional[str] = None
    attendee_phone: Optional[str] = None
    note: Optional[str] = None


class AudiCheckInRequest(BaseModel):
    ticket_code: str


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _sanitize_ticket_doc(doc: Optional[dict]) -> Optional[dict]:
    if not doc:
        return None
    clean = {**doc}
    clean.pop("_id", None)
    return clean


def _sanitize_order_doc(doc: Optional[dict]) -> Optional[dict]:
    if not doc:
        return None
    clean = {**doc}
    clean.pop("_id", None)
    return clean


async def _ensure_audi_seed():
    event = await db.audi_ticket_events.find_one({"event_id": AUDI_EVENT_TEMPLATE["event_id"]})
    if not event:
        await db.audi_ticket_events.insert_one({
            **AUDI_EVENT_TEMPLATE,
            "created_at": _utc_now_iso(),
            "updated_at": _utc_now_iso(),
        })

    for item in AUDI_TICKET_CATALOG:
        existing = await db.audi_ticket_types.find_one({"ticket_type_id": item["ticket_type_id"]})
        if existing:
            continue
        await db.audi_ticket_types.insert_one({
            **item,
            "sold_count": 0,
            "status": "active",
            "created_at": _utc_now_iso(),
            "updated_at": _utc_now_iso(),
        })


async def _get_event_overview() -> dict:
    await _ensure_audi_seed()
    event = await db.audi_ticket_events.find_one({"event_id": AUDI_EVENT_TEMPLATE["event_id"]}, {"_id": 0})
    ticket_types = await db.audi_ticket_types.find({"status": "active"}, {"_id": 0}).sort("price", 1).to_list(20)
    for item in ticket_types:
        sold = int(item.get("sold_count", 0) or 0)
        reserved = int(item.get("inventory_reserved", 0) or 0)
        total = int(item.get("inventory_total", 0) or 0)
        item["inventory_available"] = max(total - sold - reserved, 0)
    stats = {
        "ticket_types": len(ticket_types),
        "tickets_sold": sum(int(item.get("sold_count", 0) or 0) for item in ticket_types),
        "tickets_available": sum(int(item.get("inventory_available", 0) or 0) for item in ticket_types),
        "lowest_price": min((float(item.get("price", 0) or 0) for item in ticket_types), default=0.0),
    }
    return {"event": event, "ticket_types": ticket_types, "stats": stats}


async def _get_platform_wallet_owner() -> dict:
    owner = await db.users.find_one({"email": AUDI_EVENT_OWNER_EMAIL})
    if not owner:
        raise HTTPException(status_code=500, detail="Plattform-Wallet für Audi-Tickets fehlt")
    return owner


@router.get("/public/overview")
async def get_audi_public_overview():
    return await _get_event_overview()


@router.get("/my-orders")
async def get_my_audi_orders(request: Request):
    user = await get_current_user(request)
    orders = await db.audi_ticket_orders.find({"buyer_id": str(user["_id"])}, {"_id": 0}).sort("created_at", -1).to_list(50)
    return {"orders": orders}


@router.post("/purchase")
async def purchase_audi_ticket(req: AudiTicketPurchaseRequest, request: Request):
    user = await get_current_user(request)
    user_id = str(user["_id"])
    await _ensure_audi_seed()

    ticket_type = await db.audi_ticket_types.find_one({"ticket_type_id": req.ticket_type_id, "status": "active"})
    if not ticket_type:
        raise HTTPException(status_code=404, detail="Tickettyp nicht gefunden")

    max_per_order = int(ticket_type.get("max_per_order", 10) or 10)
    if req.quantity > max_per_order:
        raise HTTPException(status_code=400, detail=f"Maximal {max_per_order} Tickets für diesen Tarif erlaubt")

    sold_count = int(ticket_type.get("sold_count", 0) or 0)
    reserved_count = int(ticket_type.get("inventory_reserved", 0) or 0)
    inventory_total = int(ticket_type.get("inventory_total", 0) or 0)
    available = inventory_total - sold_count - reserved_count
    if available < req.quantity:
        raise HTTPException(status_code=400, detail="Nicht genug Audi-Tickets verfügbar")

    total_amount = round(float(ticket_type.get("price", 0) or 0) * req.quantity, 2)
    owner = await _get_platform_wallet_owner()

    reference = f"AUDI-{secrets.token_hex(4).upper()}"
    transfer_result = await transfer_between_wallets(
        from_user_id=user_id,
        to_user_id=str(owner["_id"]),
        amount=total_amount,
        tx_type=TransactionType.PAYMENT,
        description=f"Audi Ticket {ticket_type.get('title', req.ticket_type_id)}",
        reference=reference,
        metadata={
            "module": "audi_tickets",
            "ticket_type_id": req.ticket_type_id,
            "quantity": req.quantity,
            "buyer_email": user.get("email", ""),
        },
    )
    if not transfer_result.success:
        raise HTTPException(status_code=400, detail=transfer_result.error or "Wallet-Zahlung fehlgeschlagen")

    update_result = await db.audi_ticket_types.update_one(
        {
            "ticket_type_id": req.ticket_type_id,
            "status": "active",
            "$expr": {
                "$gte": [
                    {"$subtract": ["$inventory_total", {"$add": ["$sold_count", "$inventory_reserved"]}]},
                    req.quantity,
                ]
            },
        },
        {
            "$inc": {"sold_count": req.quantity},
            "$set": {"updated_at": _utc_now_iso()},
        },
    )
    if update_result.modified_count == 0:
        raise HTTPException(status_code=409, detail="Bestand hat sich geändert. Bitte erneut versuchen.")

    now = _utc_now_iso()
    order_id = f"AUDI-ORD-{secrets.token_hex(6).upper()}"
    ticket_codes: List[str] = [f"AUDI-TKT-{secrets.token_hex(4).upper()}" for _ in range(req.quantity)]
    order_doc = {
        "order_id": order_id,
        "event_id": AUDI_EVENT_TEMPLATE["event_id"],
        "buyer_id": user_id,
        "buyer_name": user.get("name") or user.get("full_name") or "",
        "buyer_email": user.get("email", ""),
        "attendee_name": req.attendee_name or user.get("name") or user.get("full_name") or "",
        "attendee_email": req.attendee_email or user.get("email", ""),
        "attendee_phone": req.attendee_phone or "",
        "ticket_type_id": req.ticket_type_id,
        "ticket_type_title": ticket_type.get("title", req.ticket_type_id),
        "quantity": req.quantity,
        "price_each": round(float(ticket_type.get("price", 0) or 0), 2),
        "total_amount": total_amount,
        "currency": ticket_type.get("currency", "EUR"),
        "wallet_reference": transfer_result.reference,
        "wallet_transaction_id": transfer_result.transaction_id,
        "status": "paid",
        "checkin_status": "not_checked_in",
        "ticket_codes": ticket_codes,
        "note": req.note or "",
        "created_at": now,
        "updated_at": now,
    }
    await db.audi_ticket_orders.insert_one(order_doc)
    order_clean = _sanitize_order_doc(order_doc)

    ticket_docs = []
    for ticket_code in ticket_codes:
        ticket_doc = {
            "ticket_code": ticket_code,
            "order_id": order_id,
            "event_id": AUDI_EVENT_TEMPLATE["event_id"],
            "buyer_id": user_id,
            "buyer_email": user.get("email", ""),
            "ticket_type_id": req.ticket_type_id,
            "ticket_type_title": ticket_type.get("title", req.ticket_type_id),
            "status": "valid",
            "checked_in_at": None,
            "created_at": now,
            "qr_payload": {
                "type": "audi_ticket",
                "event_id": AUDI_EVENT_TEMPLATE["event_id"],
                "ticket_code": ticket_code,
                "order_id": order_id,
            },
        }
        ticket_docs.append(ticket_doc)
    if ticket_docs:
        await db.audi_tickets.insert_many(ticket_docs)
    ticket_cleans = [_sanitize_ticket_doc(item) for item in ticket_docs]

    return {
        "ok": True,
        "message": "Audi-Tickets erfolgreich mit Wallet bezahlt",
        "order": order_clean,
        "wallet": {
            "reference": transfer_result.reference,
            "transaction_id": transfer_result.transaction_id,
            "new_balance": transfer_result.new_balance,
        },
        "tickets": ticket_cleans,
    }


@router.get("/admin/dashboard")
async def get_audi_admin_dashboard(request: Request):
    admin = await get_current_user(request)
    if (admin.get("role") or "") not in ("admin", "super_admin"):
        raise HTTPException(status_code=403, detail="Nur Admin")

    overview = await _get_event_overview()
    recent_orders = await db.audi_ticket_orders.find({}, {"_id": 0}).sort("created_at", -1).to_list(20)
    recent_checkins = await db.audi_tickets.find({"checked_in_at": {"$ne": None}}, {"_id": 0}).sort("checked_in_at", -1).to_list(20)
    revenue = sum(float(item.get("total_amount", 0) or 0) for item in recent_orders)
    return {
        **overview,
        "recent_orders": recent_orders,
        "recent_checkins": recent_checkins,
        "metrics": {
            "revenue_eur": round(revenue, 2),
            "orders_count": len(recent_orders),
            "checked_in_count": len(recent_checkins),
        },
    }


@router.post("/admin/checkin")
async def audi_admin_checkin(req: AudiCheckInRequest, request: Request):
    admin = await get_current_user(request)
    if (admin.get("role") or "") not in ("admin", "super_admin"):
        raise HTTPException(status_code=403, detail="Nur Admin")

    now = _utc_now_iso()
    ticket = await db.audi_tickets.find_one_and_update(
        {"ticket_code": req.ticket_code, "status": "valid", "checked_in_at": None},
        {"$set": {"checked_in_at": now, "status": "checked_in"}},
    )
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket ungültig oder bereits eingecheckt")

    ticket_clean = _sanitize_ticket_doc(ticket)
    await db.audi_ticket_orders.update_one(
        {"order_id": ticket_clean.get("order_id")},
        {"$set": {"checkin_status": "checked_in", "updated_at": now}},
    )
    ticket_clean["checked_in_at"] = now
    ticket_clean["status"] = "checked_in"
    return {"ok": True, "ticket": ticket_clean}