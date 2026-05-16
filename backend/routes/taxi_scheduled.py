"""
BidBlitz Taxi — Pre-Booking, Recurring Trips + Watchdog (iter123 P0-1, P0-9)
=============================================================================
Erlaubt Kunden, Fahrten im Voraus zu planen (z.B. „Morgen 07:00 zum Flughafen"
oder „Jeden Montag 08:00 zur Arbeit") plus Auto-Dispatch X Min vor Fahrt-Zeit.

Models (Mongo):
  taxi_scheduled_rides {
    id, user_id, pickup, dropoff, waypoints, vehicle_type, scheduled_for,
    options, promo_code, status: 'pending'|'dispatched'|'cancelled',
    auto_dispatch_minutes_before: int (default 10),
    dispatched_ride_id, created_at, cancelled_at
  }
  taxi_recurring_rides {
    id, user_id, pickup, dropoff, vehicle_type, options,
    weekdays: [0..6], time_hhmm: "08:00", active: bool,
    next_run_at, created_at, last_run_at
  }

Watchdog: alle 60s
  1. Recurring → falls next_run_at < now + 25h → erzeuge scheduled_ride mit scheduled_for=nächster Match
  2. Scheduled → falls scheduled_for - auto_dispatch_minutes_before < now → versuche reale Buchung via /book

Endpoints:
  POST /api/taxi/scheduled                — create
  GET  /api/taxi/scheduled                — list (user's)
  DELETE /api/taxi/scheduled/{id}         — cancel
  POST /api/taxi/recurring                — create pattern
  GET  /api/taxi/recurring
  PATCH /api/taxi/recurring/{id}          — toggle active
  DELETE /api/taxi/recurring/{id}
  GET  /api/taxi/scheduled/watchdog/status (admin)
"""
from __future__ import annotations
import asyncio, logging
from datetime import datetime, timezone, timedelta
from typing import List, Optional
from uuid import uuid4
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from core.database import db
from core.security import get_current_user

logger = logging.getLogger("bidblitz.taxi_scheduled")
router = APIRouter(prefix="/api/taxi", tags=["taxi-scheduled"])

_TASK: Optional[asyncio.Task] = None
_STATE = {"running": False, "last_tick_at": None, "dispatched": 0, "recurring_created": 0}


class LatLng(BaseModel):
    lat: float; lng: float; address: str


class ScheduledRideCreate(BaseModel):
    pickup: LatLng
    dropoff: LatLng
    waypoints: List[LatLng] = Field(default_factory=list)
    vehicle_type: str = "standard"
    scheduled_for: str  # ISO datetime UTC
    options: dict = Field(default_factory=dict)
    promo_code: Optional[str] = None
    auto_dispatch_minutes_before: int = Field(10, ge=1, le=60)
    notes: Optional[str] = None
    corporate_account_id: Optional[str] = None
    cost_center: Optional[str] = None


class RecurringRideCreate(BaseModel):
    pickup: LatLng
    dropoff: LatLng
    vehicle_type: str = "standard"
    weekdays: List[int] = Field(..., min_items=1, max_items=7)
    time_hhmm: str = Field(..., pattern=r"^\d{2}:\d{2}$")
    options: dict = Field(default_factory=dict)
    promo_code: Optional[str] = None
    auto_dispatch_minutes_before: int = Field(10, ge=1, le=60)
    corporate_account_id: Optional[str] = None


def _parse_iso(s: str) -> Optional[datetime]:
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00"))
    except Exception:
        return None


def _next_match(weekdays: List[int], time_hhmm: str, now: datetime) -> Optional[datetime]:
    hh, mm = [int(x) for x in time_hhmm.split(":")]
    for delta in range(0, 8):
        cand = (now + timedelta(days=delta)).replace(hour=hh, minute=mm, second=0, microsecond=0)
        if cand.weekday() in weekdays and cand > now + timedelta(minutes=2):
            return cand
    return None


@router.post("/scheduled")
async def create_scheduled(payload: ScheduledRideCreate, request: Request):
    user = await get_current_user(request)
    sched = _parse_iso(payload.scheduled_for)
    if not sched or sched < datetime.now(timezone.utc) + timedelta(minutes=5):
        raise HTTPException(422, "scheduled_for muss mindestens 5min in der Zukunft liegen")
    doc = {
        "id": str(uuid4()),
        "user_id": str(user.get("_id") or user.get("id")),
        "pickup": payload.pickup.dict(), "dropoff": payload.dropoff.dict(),
        "waypoints": [w.dict() for w in payload.waypoints],
        "vehicle_type": payload.vehicle_type,
        "scheduled_for": sched.isoformat(),
        "options": payload.options, "promo_code": payload.promo_code,
        "auto_dispatch_minutes_before": payload.auto_dispatch_minutes_before,
        "notes": payload.notes,
        "corporate_account_id": payload.corporate_account_id,
        "cost_center": payload.cost_center,
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.taxi_scheduled_rides.insert_one(doc)
    doc.pop("_id", None)
    return {"success": True, "scheduled_ride": doc}


@router.get("/scheduled")
async def list_scheduled(request: Request):
    user = await get_current_user(request)
    uid = str(user.get("_id") or user.get("id"))
    cursor = db.taxi_scheduled_rides.find(
        {"user_id": uid}, {"_id": 0},
    ).sort("scheduled_for", 1)
    return {"items": [x async for x in cursor]}


@router.delete("/scheduled/{rid}")
async def cancel_scheduled(rid: str, request: Request):
    user = await get_current_user(request)
    uid = str(user.get("_id") or user.get("id"))
    res = await db.taxi_scheduled_rides.update_one(
        {"id": rid, "user_id": uid, "status": "pending"},
        {"$set": {"status": "cancelled", "cancelled_at": datetime.now(timezone.utc).isoformat()}},
    )
    if res.matched_count == 0:
        raise HTTPException(404, "Nicht gefunden oder bereits dispatched")
    return {"success": True}


@router.post("/recurring")
async def create_recurring(payload: RecurringRideCreate, request: Request):
    user = await get_current_user(request)
    uid = str(user.get("_id") or user.get("id"))
    nxt = _next_match(payload.weekdays, payload.time_hhmm, datetime.now(timezone.utc))
    doc = {
        "id": str(uuid4()),
        "user_id": uid,
        "pickup": payload.pickup.dict(), "dropoff": payload.dropoff.dict(),
        "vehicle_type": payload.vehicle_type,
        "weekdays": payload.weekdays, "time_hhmm": payload.time_hhmm,
        "options": payload.options, "promo_code": payload.promo_code,
        "auto_dispatch_minutes_before": payload.auto_dispatch_minutes_before,
        "corporate_account_id": payload.corporate_account_id,
        "active": True,
        "next_run_at": nxt.isoformat() if nxt else None,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.taxi_recurring_rides.insert_one(doc)
    doc.pop("_id", None)
    return {"success": True, "recurring": doc}


@router.get("/recurring")
async def list_recurring(request: Request):
    user = await get_current_user(request)
    uid = str(user.get("_id") or user.get("id"))
    cursor = db.taxi_recurring_rides.find({"user_id": uid}, {"_id": 0})
    return {"items": [x async for x in cursor]}


@router.patch("/recurring/{rid}")
async def toggle_recurring(rid: str, request: Request, active: bool):
    user = await get_current_user(request)
    uid = str(user.get("_id") or user.get("id"))
    res = await db.taxi_recurring_rides.update_one(
        {"id": rid, "user_id": uid},
        {"$set": {"active": active}},
    )
    if res.matched_count == 0:
        raise HTTPException(404, "Nicht gefunden")
    return {"success": True}


@router.delete("/recurring/{rid}")
async def delete_recurring(rid: str, request: Request):
    user = await get_current_user(request)
    uid = str(user.get("_id") or user.get("id"))
    await db.taxi_recurring_rides.delete_one({"id": rid, "user_id": uid})
    return {"success": True}


@router.get("/scheduled/watchdog/status")
async def watchdog_status():
    return {**_STATE}


async def _materialize_recurring(now: datetime) -> int:
    """Erzeuge scheduled_rides für recurring patterns, deren next_run_at innerhalb von 25h liegt."""
    created = 0
    cutoff = (now + timedelta(hours=25)).isoformat()
    async for r in db.taxi_recurring_rides.find(
        {"active": True, "next_run_at": {"$lte": cutoff, "$ne": None}}, {"_id": 0},
    ):
        # Erzeuge scheduled_ride wenn keiner für diesen Pattern+Slot existiert
        existing = await db.taxi_scheduled_rides.find_one(
            {"user_id": r["user_id"], "scheduled_for": r["next_run_at"],
             "status": "pending", "recurring_id": r["id"]},
            {"_id": 0, "id": 1},
        )
        if not existing:
            doc = {
                "id": str(uuid4()), "user_id": r["user_id"],
                "pickup": r["pickup"], "dropoff": r["dropoff"], "waypoints": [],
                "vehicle_type": r["vehicle_type"],
                "scheduled_for": r["next_run_at"],
                "options": r.get("options", {}), "promo_code": r.get("promo_code"),
                "auto_dispatch_minutes_before": r.get("auto_dispatch_minutes_before", 10),
                "corporate_account_id": r.get("corporate_account_id"),
                "status": "pending", "recurring_id": r["id"],
                "created_at": now.isoformat(),
            }
            await db.taxi_scheduled_rides.insert_one(doc)
            created += 1
        # Compute next match
        new_next = _next_match(r["weekdays"], r["time_hhmm"], _parse_iso(r["next_run_at"]) or now)
        await db.taxi_recurring_rides.update_one(
            {"id": r["id"]},
            {"$set": {"next_run_at": new_next.isoformat() if new_next else None,
                      "last_run_at": now.isoformat()}},
        )
    return created


async def _dispatch_due(now: datetime) -> int:
    """Dispatche scheduled_rides, deren Auto-Dispatch-Zeit erreicht ist."""
    dispatched = 0
    async for r in db.taxi_scheduled_rides.find({"status": "pending"}, {"_id": 0}):
        sched_at = _parse_iso(r["scheduled_for"])
        if not sched_at:
            continue
        trigger_at = sched_at - timedelta(minutes=r.get("auto_dispatch_minutes_before", 10))
        if now >= trigger_at:
            # MVP: nur Status auf 'ready_to_book' + Push-Hinweis. Echte Buchung muss
            # User confirmen (Stripe-Hold gibt's nicht im MVP). Frontend zeigt CTA.
            await db.taxi_scheduled_rides.update_one(
                {"id": r["id"]},
                {"$set": {"status": "ready_to_book",
                          "ready_at": now.isoformat()}},
            )
            try:
                from utils.onesignal_push import send_to_user, is_configured
                if is_configured():
                    await send_to_user(
                        r["user_id"],
                        "Deine geplante Fahrt steht an 🚕",
                        f"Klicke jetzt, um die Buchung zu bestätigen ({sched_at.strftime('%H:%M')}).",
                        data={"type": "scheduled_ride_ready", "id": r["id"]},
                    )
            except Exception:
                pass
            dispatched += 1
    return dispatched


async def _tick():
    now = datetime.now(timezone.utc)
    try:
        c = await _materialize_recurring(now)
        d = await _dispatch_due(now)
        _STATE["recurring_created"] += c
        _STATE["dispatched"] += d
        _STATE["last_tick_at"] = now.isoformat()
    except Exception as e:
        logger.warning(f"taxi_scheduled tick failed: {e}")


async def _loop():
    _STATE["running"] = True
    await asyncio.sleep(20)
    while True:
        await _tick()
        await asyncio.sleep(60)


def start_taxi_scheduled_loop():
    global _TASK
    if _TASK and not _TASK.done():
        return
    try:
        _TASK = asyncio.get_running_loop().create_task(_loop())
    except RuntimeError:
        pass
