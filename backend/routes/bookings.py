"""
BidBlitz V2 — Termin-Buchungssystem (V2)

Features:
- Provider-Liste (seeded PROVIDERS) + DB-Overrides
- Wochen-Verfügbarkeit (opening_hours pro Weekday)
- Blockierte Tage (Urlaub, Krankheit)
- Slot-Berechnung: gibt freie Slots für ein Datum zurück
- Buchung (date + time required), verhindert Doppelbuchungen
- Provider-Admin: Services, Opening Hours, Blocks, Buchungen ansehen/accept/reject

Provider-Owner: `provider.owner_id` (set by admin via seed or dashboard).
"""
import secrets
from datetime import datetime, timezone, timedelta, date, time as dtime
from typing import List, Optional, Dict

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from core.database import db
from core.security import get_current_user

router = APIRouter(prefix="/api/bookings", tags=["bookings"])
admin_router = APIRouter(prefix="/api/provider", tags=["provider-admin"])

# ── Seed providers (used first-run, editable in DB later) ──
SEED_PROVIDERS = [
    {"id": "b1", "name": "Salon Elegance", "type": "Friseur", "city": "Berlin", "rating": 4.8, "reviews": 234,
     "services": [
         {"service_id": "b1s1", "name": "Herrenschnitt",  "price": 25, "duration": 30},
         {"service_id": "b1s2", "name": "Damenschnitt",   "price": 45, "duration": 60},
         {"service_id": "b1s3", "name": "Faerben",        "price": 65, "duration": 90},
         {"service_id": "b1s4", "name": "Bartpflege",     "price": 15, "duration": 20},
     ], "color": "#EC4899"},
    {"id": "b2", "name": "Dr. Mueller Praxis", "type": "Arzt", "city": "Berlin", "rating": 4.9, "reviews": 567,
     "services": [
         {"service_id": "b2s1", "name": "Erstberatung",  "price": 0,  "duration": 30},
         {"service_id": "b2s2", "name": "Check-Up",      "price": 50, "duration": 45},
         {"service_id": "b2s3", "name": "Impfung",       "price": 30, "duration": 15},
         {"service_id": "b2s4", "name": "Blutabnahme",   "price": 20, "duration": 10},
     ], "color": "#3B82F6"},
    {"id": "b3", "name": "Massage Oase", "type": "Wellness", "city": "Muenchen", "rating": 4.7, "reviews": 189,
     "services": [
         {"service_id": "b3s1", "name": "Ganzkoerpermassage", "price": 79, "duration": 60},
         {"service_id": "b3s2", "name": "Rueckenmassage",     "price": 45, "duration": 30},
         {"service_id": "b3s3", "name": "Hot Stone",          "price": 89, "duration": 75},
         {"service_id": "b3s4", "name": "Fussreflexzonen",    "price": 39, "duration": 30},
     ], "color": "#10B981"},
    {"id": "b4", "name": "AutoFit Werkstatt", "type": "KFZ", "city": "Hamburg", "rating": 4.6, "reviews": 312,
     "services": [
         {"service_id": "b4s1", "name": "Inspektion",       "price": 149, "duration": 120},
         {"service_id": "b4s2", "name": "Oelwechsel",       "price": 49,  "duration": 30},
         {"service_id": "b4s3", "name": "Reifenwechsel",    "price": 39,  "duration": 30},
         {"service_id": "b4s4", "name": "TUeV Vorbereitung","price": 89,  "duration": 60},
     ], "color": "#F59E0B"},
]

# Default weekly opening hours — Mo–Fr 09:00–18:00, Sa 10:00–14:00, Su geschlossen
DEFAULT_HOURS = {
    "0": {"open": "09:00", "close": "18:00"},  # Mon
    "1": {"open": "09:00", "close": "18:00"},
    "2": {"open": "09:00", "close": "18:00"},
    "3": {"open": "09:00", "close": "18:00"},
    "4": {"open": "09:00", "close": "18:00"},
    "5": {"open": "10:00", "close": "14:00"},  # Sat
    "6": None,                                  # Sun closed
}

SLOT_INTERVAL_MIN = 15  # appointments start at every 15-min boundary


# ── Helpers ──
def _now():
    return datetime.now(timezone.utc)


async def _seed_providers():
    for p in SEED_PROVIDERS:
        exists = await db.appointment_providers.find_one({"id": p["id"]}, {"id": 1, "_id": 0})
        if exists:
            continue
        doc = {
            **p,
            "opening_hours": DEFAULT_HOURS,
            "blocks": [],
            "owner_id": None,
            "created_at": _now().isoformat(),
        }
        await db.appointment_providers.insert_one(doc)


async def _list_providers(city: str = "") -> List[dict]:
    await _seed_providers()
    q = {}
    if city:
        q["city"] = {"$regex": f"^{city}$", "$options": "i"}
    out = await db.appointment_providers.find(q, {"_id": 0}).to_list(200)
    return out


async def _get_provider(pid: str) -> Optional[dict]:
    await _seed_providers()
    return await db.appointment_providers.find_one({"id": pid}, {"_id": 0})


def _parse_hhmm(s: str) -> dtime:
    h, m = s.split(":")
    return dtime(int(h), int(m))


def _combine(d: date, t: dtime) -> datetime:
    return datetime(d.year, d.month, d.day, t.hour, t.minute, tzinfo=timezone.utc)


async def _compute_slots(provider: dict, date_str: str, service_duration: int) -> List[str]:
    """
    Returns a list of "HH:MM" slots available on `date_str` for a service of given duration.
    """
    try:
        target = datetime.fromisoformat(date_str).date()
    except Exception:
        raise HTTPException(400, "Ungueltiges Datum (erwartet YYYY-MM-DD).")

    # Day of week (0=Mon..6=Sun)
    weekday = str(target.weekday())

    hours = (provider.get("opening_hours") or DEFAULT_HOURS).get(weekday)
    if not hours:
        return []

    # Check block dates
    for b in provider.get("blocks", []):
        if b.get("date") == date_str:
            return []

    open_t = _parse_hhmm(hours["open"])
    close_t = _parse_hhmm(hours["close"])
    open_dt = _combine(target, open_t)
    close_dt = _combine(target, close_t)

    # Fetch existing bookings for this provider+date
    existing = await db.appointments.find(
        {"provider_id": provider["id"], "date": date_str, "status": {"$ne": "cancelled"}},
        {"_id": 0, "time": 1, "duration_min": 1},
    ).to_list(500)
    taken: List[tuple] = []
    for e in existing:
        try:
            st = _combine(target, _parse_hhmm(e["time"]))
            en = st + timedelta(minutes=int(e.get("duration_min", 30)))
            taken.append((st, en))
        except Exception:
            continue

    slots = []
    now = _now()
    cur = open_dt
    step = timedelta(minutes=SLOT_INTERVAL_MIN)
    service_td = timedelta(minutes=service_duration)
    while cur + service_td <= close_dt:
        end = cur + service_td
        # Don't offer past slots for today
        if cur <= now + timedelta(minutes=15):
            cur += step
            continue
        # Check overlap with existing
        overlap = any(not (end <= s or cur >= e) for s, e in taken)
        if not overlap:
            slots.append(cur.strftime("%H:%M"))
        cur += step
    return slots


# ──────────────────────────────────────────────────────────────
# Public customer endpoints
# ──────────────────────────────────────────────────────────────
@router.get("/providers")
async def get_providers(city: str = ""):
    providers = await _list_providers(city)
    # strip admin-only fields
    lite = []
    for p in providers:
        lite.append({
            "id": p["id"],
            "name": p["name"],
            "type": p["type"],
            "city": p["city"],
            "rating": p.get("rating", 4.5),
            "reviews": p.get("reviews", 0),
            "services": p.get("services", []),
            "color": p.get("color", "#00C2FF"),
        })
    return {"providers": lite}


@router.get("/providers/{pid}")
async def get_provider(pid: str):
    p = await _get_provider(pid)
    if not p:
        raise HTTPException(404, "Anbieter nicht gefunden.")
    return {
        "id": p["id"], "name": p["name"], "type": p["type"], "city": p["city"],
        "rating": p.get("rating", 4.5), "reviews": p.get("reviews", 0),
        "services": p.get("services", []), "color": p.get("color", "#00C2FF"),
        "opening_hours": p.get("opening_hours") or DEFAULT_HOURS,
        "blocks": p.get("blocks", []),
    }


@router.get("/providers/{pid}/slots")
async def get_slots(pid: str, date: str, service_id: str):
    p = await _get_provider(pid)
    if not p:
        raise HTTPException(404, "Anbieter nicht gefunden.")
    service = next((s for s in p.get("services", []) if s.get("service_id") == service_id), None)
    if not service:
        raise HTTPException(404, "Service nicht gefunden.")
    slots = await _compute_slots(p, date, int(service.get("duration", 30)))
    return {"date": date, "slots": slots, "service": service}


class BookingReq(BaseModel):
    provider_id: str
    service_id: str
    date: str
    time: str
    customer_name: Optional[str] = ""
    customer_phone: Optional[str] = ""
    notes: Optional[str] = ""


@router.post("/book")
async def book(req: BookingReq, request: Request):
    user = await get_current_user(request)
    p = await _get_provider(req.provider_id)
    if not p:
        raise HTTPException(404, "Anbieter nicht gefunden.")
    service = next((s for s in p.get("services", []) if s.get("service_id") == req.service_id), None)
    if not service:
        raise HTTPException(404, "Service nicht gefunden.")

    # Verify slot is still free
    free = await _compute_slots(p, req.date, int(service.get("duration", 30)))
    if req.time not in free:
        raise HTTPException(409, "Dieser Zeitslot ist nicht (mehr) verfuegbar.")

    fee = round(float(service["price"]) * 0.05, 2)
    booking = {
        "appointment_id": f"appt_{secrets.token_hex(6)}",
        "user_id": str(user.get("_id") or user.get("id")),
        "user_email": user.get("email", ""),
        "customer_name": req.customer_name or user.get("username") or user.get("email", ""),
        "customer_phone": req.customer_phone or "",
        "notes": req.notes or "",
        "provider_id": req.provider_id,
        "provider_name": p["name"],
        "provider_type": p["type"],
        "service_id": service["service_id"],
        "service_name": service["name"],
        "price": service["price"],
        "duration_min": service["duration"],
        "platform_fee": fee,
        "date": req.date,
        "time": req.time,
        "status": "confirmed",
        "created_at": _now().isoformat(),
    }
    await db.appointments.insert_one(booking)
    booking.pop("_id", None)

    # Send booking confirmation email (non-blocking)
    try:
        from routes.email_service import notify_booking_confirmed
        import asyncio
        asyncio.create_task(notify_booking_confirmed(
            user_email=user.get("email", ""),
            user_name=booking["customer_name"],
            provider_name=p["name"],
            service_name=service["name"],
            date=req.date,
            time=req.time,
            price=float(service["price"]),
            appointment_id=booking["appointment_id"],
        ))
    except Exception as _e:
        pass

    return {
        "ok": True,
        "appointment_id": booking["appointment_id"],
        "price": service["price"],
        "message": f"Termin gebucht: {p['name']} · {service['name']} am {req.date} um {req.time}",
    }


@router.get("/my-appointments")
async def my_appointments(request: Request):
    user = await get_current_user(request)
    uid = str(user.get("_id") or user.get("id"))
    email = user.get("email", "")
    appts = await db.appointments.find(
        {"$or": [{"user_id": uid}, {"user_email": email}]}, {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    return {"appointments": appts}


@router.post("/cancel/{appointment_id}")
async def cancel_appointment(appointment_id: str, request: Request):
    user = await get_current_user(request)
    uid = str(user.get("_id") or user.get("id"))
    email = user.get("email", "")
    appt = await db.appointments.find_one({"appointment_id": appointment_id})
    if not appt:
        raise HTTPException(404, "Termin nicht gefunden.")
    if appt.get("user_id") != uid and appt.get("user_email") != email:
        raise HTTPException(403, "Kein Zugriff auf diesen Termin.")
    await db.appointments.update_one(
        {"appointment_id": appointment_id},
        {"$set": {"status": "cancelled", "cancelled_at": _now().isoformat()}},
    )
    return {"ok": True}


# ──────────────────────────────────────────────────────────────
# Provider Admin endpoints
# ──────────────────────────────────────────────────────────────
async def _require_provider_owner(request: Request, pid: str) -> dict:
    """Check that the current user owns the given provider (or is admin)."""
    user = await get_current_user(request)
    uid = str(user.get("_id") or user.get("id"))
    is_admin = (user.get("role") or "") in ("admin", "super_admin")
    provider = await _get_provider(pid)
    if not provider:
        raise HTTPException(404, "Anbieter nicht gefunden.")
    if not is_admin and provider.get("owner_id") != uid:
        raise HTTPException(403, "Kein Zugriff auf diesen Anbieter.")
    return provider


@admin_router.get("/my-providers")
async def my_providers(request: Request):
    """Returns providers owned by the current user, or ALL if admin."""
    user = await get_current_user(request)
    uid = str(user.get("_id") or user.get("id"))
    is_admin = (user.get("role") or "") in ("admin", "super_admin")
    await _seed_providers()
    q = {} if is_admin else {"owner_id": uid}
    out = await db.appointment_providers.find(q, {"_id": 0}).to_list(200)
    return {"providers": out, "is_admin": is_admin}


class ProviderUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[str] = None
    city: Optional[str] = None
    color: Optional[str] = None
    owner_email: Optional[str] = None  # admin can assign owner


@admin_router.put("/{pid}")
async def update_provider(pid: str, payload: ProviderUpdate, request: Request):
    await _require_provider_owner(request, pid)
    updates = {}
    for field in ("name", "type", "city", "color"):
        val = getattr(payload, field)
        if val is not None:
            updates[field] = val
    # Admin-only: set owner by email
    user = await get_current_user(request)
    is_admin = (user.get("role") or "") in ("admin", "super_admin")
    if is_admin and payload.owner_email:
        owner = await db.users.find_one({"email": payload.owner_email}, {"_id": 1})
        if not owner:
            raise HTTPException(404, "Owner-User nicht gefunden.")
        updates["owner_id"] = str(owner["_id"])
    if updates:
        await db.appointment_providers.update_one({"id": pid}, {"$set": updates})
    return {"ok": True, "updates": updates}


class ServiceItem(BaseModel):
    service_id: Optional[str] = None
    name: str
    price: float = 0
    duration: int = 30


@admin_router.put("/{pid}/services")
async def update_services(pid: str, services: List[ServiceItem], request: Request):
    await _require_provider_owner(request, pid)
    out = []
    for s in services:
        sid = s.service_id or f"{pid}s{secrets.token_hex(3)}"
        out.append({"service_id": sid, "name": s.name, "price": s.price, "duration": s.duration})
    await db.appointment_providers.update_one({"id": pid}, {"$set": {"services": out}})
    return {"ok": True, "services": out}


class HoursUpdate(BaseModel):
    opening_hours: Dict[str, Optional[Dict[str, str]]]


@admin_router.put("/{pid}/hours")
async def update_hours(pid: str, payload: HoursUpdate, request: Request):
    await _require_provider_owner(request, pid)
    # validate
    cleaned = {}
    for k in ("0", "1", "2", "3", "4", "5", "6"):
        v = payload.opening_hours.get(k)
        if v is None:
            cleaned[k] = None
        else:
            if "open" not in v or "close" not in v:
                raise HTTPException(400, f"Tag {k}: open/close fehlen.")
            cleaned[k] = {"open": v["open"], "close": v["close"]}
    await db.appointment_providers.update_one({"id": pid}, {"$set": {"opening_hours": cleaned}})
    return {"ok": True, "opening_hours": cleaned}


class BlockAdd(BaseModel):
    date: str
    reason: Optional[str] = ""


@admin_router.post("/{pid}/blocks")
async def add_block(pid: str, payload: BlockAdd, request: Request):
    await _require_provider_owner(request, pid)
    await db.appointment_providers.update_one(
        {"id": pid},
        {"$addToSet": {"blocks": {"date": payload.date, "reason": payload.reason or ""}}},
    )
    return {"ok": True}


@admin_router.delete("/{pid}/blocks/{block_date}")
async def remove_block(pid: str, block_date: str, request: Request):
    await _require_provider_owner(request, pid)
    await db.appointment_providers.update_one(
        {"id": pid},
        {"$pull": {"blocks": {"date": block_date}}},
    )
    return {"ok": True}


@admin_router.get("/{pid}/appointments")
async def provider_appointments(pid: str, request: Request, status: str = ""):
    await _require_provider_owner(request, pid)
    q = {"provider_id": pid}
    if status:
        q["status"] = status
    items = await db.appointments.find(q, {"_id": 0}).sort("date", 1).to_list(500)
    return {"appointments": items}


@admin_router.post("/{pid}/appointments/{appointment_id}/status")
async def set_appointment_status(pid: str, appointment_id: str, request: Request, status: str):
    await _require_provider_owner(request, pid)
    if status not in ("confirmed", "cancelled", "completed", "no_show"):
        raise HTTPException(400, "Ungueltiger Status.")
    await db.appointments.update_one(
        {"appointment_id": appointment_id, "provider_id": pid},
        {"$set": {"status": status, "updated_at": _now().isoformat()}},
    )
    return {"ok": True}
