"""
BidBlitz Staff — Shift Watchdog (P2 Push-Reminder Engine)
============================================================
Background loop, der alle 5 Minuten alle aktiven Schichten prüft:

  - Wenn `clock_in` > 6h her und kein `break_start` seit Clock-In:
       Push „Pause vergessen?" (idempotent — max. 1 pro Shift)
  - Wenn `clock_in` > 10h her und kein `clock_out`:
       Push „Auschecken nicht vergessen 👋"

Idempotenz-Tracking via Collection `staff_reminders_sent`:
   { staff_id, shift_started_at, reminder_type, sent_at }

Wird in `server.py` Startup gestartet (analog auctions loops).

Manuelle Endpoints (für Debug / Force-Trigger):
  GET  /api/staff/watchdog/status    — Watchdog-State + letzte Tick-Zeit
  POST /api/staff/watchdog/tick      — Trigger eine Iteration manuell (admin/merchant)
"""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import APIRouter, HTTPException, Request

from core.database import db
from core.security import get_current_user

logger = logging.getLogger("bidblitz.staff_watchdog")

router = APIRouter(prefix="/api/staff/watchdog", tags=["staff-watchdog"])

_WATCHDOG_TASK: Optional[asyncio.Task] = None
_WATCHDOG_STATE = {
    "running": False,
    "last_tick_at": None,
    "last_tick_count": 0,
    "total_break_reminders": 0,
    "total_checkout_reminders": 0,
}

TICK_INTERVAL_SECONDS = 5 * 60  # 5min
BREAK_REMINDER_AFTER_HOURS = 6
CHECKOUT_REMINDER_AFTER_HOURS = 10


def _parse_iso(s: Optional[str]) -> Optional[datetime]:
    if not s:
        return None
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00"))
    except Exception:
        return None


async def _push_safe(staff_id: str, title: str, body: str, data: Optional[dict] = None):
    try:
        from utils.onesignal_push import send_to_staff, is_configured
        if is_configured():
            await send_to_staff(staff_id, title, body, data=data or {})
    except Exception as e:
        logger.debug(f"push_safe skipped: {e}")


async def _already_reminded(staff_id: str, shift_started_at: str, reminder_type: str) -> bool:
    doc = await db.staff_reminders_sent.find_one({
        "staff_id": staff_id,
        "shift_started_at": shift_started_at,
        "reminder_type": reminder_type,
    }, {"_id": 0, "id": 1})
    return bool(doc)


async def _mark_reminded(staff_id: str, merchant_id: str, shift_started_at: str,
                         reminder_type: str):
    from uuid import uuid4
    try:
        await db.staff_reminders_sent.insert_one({
            "id": str(uuid4()),
            "staff_id": staff_id,
            "merchant_id": merchant_id,
            "shift_started_at": shift_started_at,
            "reminder_type": reminder_type,
            "sent_at": datetime.now(timezone.utc).isoformat(),
        })
    except Exception:
        pass


async def _evaluate_staff(staff: dict, now: datetime) -> dict:
    """Evaluate one staff member; return dict with reminders sent counts."""
    sent_break = 0
    sent_checkout = 0

    # Get latest events (ordered) — figure out current shift state
    cursor = db.staff_clock_events.find(
        {"staff_id": staff["id"]},
        {"_id": 0, "action": 1, "timestamp": 1},
    ).sort("timestamp", 1)

    shift_started_at: Optional[str] = None
    last_break_start_at: Optional[str] = None
    on_break = False

    async for ev in cursor:
        a = ev["action"]
        ts = ev["timestamp"]
        if a == "clock_in":
            shift_started_at = ts
            last_break_start_at = None
            on_break = False
        elif a == "clock_out":
            shift_started_at = None
            last_break_start_at = None
            on_break = False
        elif a == "break_start":
            last_break_start_at = ts
            on_break = True
        elif a == "break_end":
            on_break = False

    if not shift_started_at:
        return {"break": 0, "checkout": 0}

    start_dt = _parse_iso(shift_started_at)
    if not start_dt:
        return {"break": 0, "checkout": 0}

    elapsed_h = (now - start_dt).total_seconds() / 3600.0

    # --- Break reminder ---
    if elapsed_h >= BREAK_REMINDER_AFTER_HOURS and not on_break and last_break_start_at is None:
        if not await _already_reminded(staff["id"], shift_started_at, "break"):
            await _push_safe(staff["id"], "Pause vergessen?",
                             f"Du arbeitest seit {int(elapsed_h)}h. Zeit für eine Pause 👋",
                             data={"type": "break_reminder", "shift_started_at": shift_started_at})
            await _mark_reminded(staff["id"], staff.get("merchant_id", ""), shift_started_at, "break")
            sent_break += 1

    # --- Auto-checkout reminder ---
    if elapsed_h >= CHECKOUT_REMINDER_AFTER_HOURS:
        if not await _already_reminded(staff["id"], shift_started_at, "checkout"):
            await _push_safe(staff["id"], "Auschecken nicht vergessen 👋",
                             f"Schicht läuft seit {int(elapsed_h)}h. Hast du vergessen auszustempeln?",
                             data={"type": "checkout_reminder", "shift_started_at": shift_started_at})
            await _mark_reminded(staff["id"], staff.get("merchant_id", ""), shift_started_at, "checkout")
            sent_checkout += 1

    return {"break": sent_break, "checkout": sent_checkout}


async def _tick() -> dict:
    """One pass through all active staff."""
    now = datetime.now(timezone.utc)
    total_b = 0
    total_c = 0
    count = 0
    async for staff in db.staff_members.find(
        {"active": True},
        {"_id": 0, "id": 1, "merchant_id": 1},
    ):
        count += 1
        r = await _evaluate_staff(staff, now)
        total_b += r["break"]
        total_c += r["checkout"]
    _WATCHDOG_STATE["last_tick_at"] = now.isoformat()
    _WATCHDOG_STATE["last_tick_count"] = count
    _WATCHDOG_STATE["total_break_reminders"] += total_b
    _WATCHDOG_STATE["total_checkout_reminders"] += total_c
    return {"checked": count, "break_sent": total_b, "checkout_sent": total_c}


async def _watchdog_loop():
    _WATCHDOG_STATE["running"] = True
    logger.info("✓ staff_shift_watchdog loop started")
    # Small grace period after startup
    await asyncio.sleep(30)
    while True:
        try:
            r = await _tick()
            if r["break_sent"] or r["checkout_sent"]:
                logger.info(f"[watchdog] tick: {r}")
        except Exception as e:
            logger.warning(f"[watchdog] tick failed: {e}")
        await asyncio.sleep(TICK_INTERVAL_SECONDS)


def start_watchdog_loop():
    """Idempotent starter — called from server.py startup."""
    global _WATCHDOG_TASK
    if _WATCHDOG_TASK and not _WATCHDOG_TASK.done():
        return
    try:
        loop = asyncio.get_running_loop()
        _WATCHDOG_TASK = loop.create_task(_watchdog_loop())
    except RuntimeError:
        # No loop running — caller should retry from inside an async context
        pass


@router.get("/status")
async def watchdog_status():
    return {**_WATCHDOG_STATE}


@router.post("/tick")
async def watchdog_force_tick(request: Request):
    user = await get_current_user(request)
    if user.get("role") not in ("merchant", "admin"):
        raise HTTPException(403, "Nur Manager/Admin")
    r = await _tick()
    return {"success": True, **r}
