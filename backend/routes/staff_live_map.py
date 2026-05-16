"""
BidBlitz Staff — Manager Live-Map (Live-Pins aller aktiven Mitarbeiter)
============================================================================
Endpoint für das Manager-Cockpit: liefert alle aktiven Staff-Members
mit ihrer letzten bekannten GPS-Position, dem aktuellen Clock-Status,
Geofence-Status (inside/outside/unknown), Shift-Dauer und Anomaly-Flag.

Auth: Merchant/Admin (siehe staff_open_shifts._manager Pattern).

Endpoints:
  GET /api/staff/live-map/positions          — alle aktiven Staff-Pins
  GET /api/staff/live-map/anomalies          — letzte 50 ungeprüfte Anomalien
  POST /api/staff/live-map/anomalies/{id}/review — Anomalie als geprüft markieren
"""
from __future__ import annotations

import math
from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import APIRouter, HTTPException, Request

from core.database import db
from core.security import get_current_user

router = APIRouter(prefix="/api/staff/live-map", tags=["staff-live-map"])

EARTH_R_KM = 6371.0


async def _manager(request: Request) -> dict:
    user = await get_current_user(request)
    role = user.get("role")
    if role not in ("merchant", "admin"):
        raise HTTPException(403, "Nur Manager")
    uid = str(user.get("_id") or user.get("id") or "")
    merchant = await db.merchants.find_one({"owner_user_id": uid}, {"_id": 1})
    if not merchant:
        merchant = await db.merchants.find_one({"email": user.get("email")}, {"_id": 1})
    merchant_id = str(merchant["_id"]) if merchant else uid
    return {"id": uid, "merchant_id": merchant_id}


def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2) ** 2
    return EARTH_R_KM * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _parse_iso(ts: Optional[str]) -> Optional[datetime]:
    if not ts:
        return None
    try:
        return datetime.fromisoformat(ts.replace("Z", "+00:00"))
    except Exception:
        return None


async def _compute_shift_state(staff_id: str) -> dict:
    """
    Liefert für einen Staff den aktuellen Clock-State + Shift-Start.
    State: 'working' | 'on_break' | 'off'
    """
    cursor = db.staff_clock_events.find(
        {"staff_id": staff_id},
        {"_id": 0, "action": 1, "timestamp": 1, "lat": 1, "lng": 1, "id": 1,
         "is_mock_suspected": 1},
    ).sort("timestamp", 1)

    shift_started_at: Optional[str] = None
    state = "off"
    last_position: Optional[dict] = None
    last_event: Optional[dict] = None
    has_anomaly = False

    async for ev in cursor:
        a = ev.get("action")
        if a == "clock_in":
            shift_started_at = ev["timestamp"]
            state = "working"
        elif a == "clock_out":
            shift_started_at = None
            state = "off"
        elif a == "break_start" and state == "working":
            state = "on_break"
        elif a == "break_end" and state == "on_break":
            state = "working"
        if ev.get("lat") is not None and ev.get("lng") is not None:
            last_position = {
                "lat": ev["lat"], "lng": ev["lng"],
                "captured_at": ev["timestamp"],
            }
        last_event = ev
        if ev.get("is_mock_suspected"):
            has_anomaly = True

    return {
        "state": state,
        "shift_started_at": shift_started_at,
        "last_position": last_position,
        "last_event": last_event,
        "has_anomaly_today": has_anomaly,
    }


@router.get("/positions")
async def list_live_positions(request: Request):
    """Liefert alle aktiven Staff mit Live-Position + State + Geofence."""
    mgr = await _manager(request)
    merchant_id = mgr["merchant_id"]

    members_cursor = db.staff_members.find(
        {"merchant_id": merchant_id, "active": True},
        {"_id": 0, "id": 1, "name": 1, "email": 1, "role": 1, "avatar_url": 1,
         "phone": 1, "department": 1},
    )
    members = [m async for m in members_cursor]

    # Geofences einmal laden
    geofences = []
    async for g in db.staff_geofences.find(
        {"merchant_id": merchant_id, "active": {"$ne": False}},
        {"_id": 0, "id": 1, "name": 1, "lat": 1, "lng": 1, "radius_m": 1},
    ):
        geofences.append(g)

    out = []
    for m in members:
        st = await _compute_shift_state(m["id"])
        last_pos = st["last_position"]
        geofence_status = "unknown"
        nearest_geofence = None
        if last_pos and geofences:
            nearest_d_m = None
            for g in geofences:
                if g.get("lat") is None or g.get("lng") is None:
                    continue
                d_km = _haversine_km(last_pos["lat"], last_pos["lng"], g["lat"], g["lng"])
                d_m = d_km * 1000
                if nearest_d_m is None or d_m < nearest_d_m:
                    nearest_d_m = d_m
                    nearest_geofence = {"id": g["id"], "name": g["name"],
                                        "distance_m": round(d_m, 0),
                                        "radius_m": g.get("radius_m", 100)}
            if nearest_geofence:
                inside = nearest_d_m <= (nearest_geofence.get("radius_m") or 100)
                geofence_status = "inside" if inside else "outside"

        # Stale-Check: letzte Position älter als 15min → 'stale'
        stale = False
        if last_pos:
            t = _parse_iso(last_pos["captured_at"])
            if t and (datetime.now(timezone.utc) - t) > timedelta(minutes=15):
                stale = True

        out.append({
            "staff_id": m["id"],
            "name": m.get("name") or m.get("email") or "Unbekannt",
            "avatar_url": m.get("avatar_url"),
            "department": m.get("department"),
            "state": st["state"],
            "shift_started_at": st["shift_started_at"],
            "last_position": last_pos,
            "last_event_action": (st["last_event"] or {}).get("action"),
            "last_event_at": (st["last_event"] or {}).get("timestamp"),
            "geofence_status": geofence_status,
            "nearest_geofence": nearest_geofence,
            "stale": stale,
            "has_anomaly_today": st["has_anomaly_today"],
        })

    # sort: working first, then on_break, then off
    rank = {"working": 0, "on_break": 1, "off": 2}
    out.sort(key=lambda x: (rank.get(x["state"], 9), x["name"].lower()))
    return {
        "merchant_id": merchant_id,
        "server_time": datetime.now(timezone.utc).isoformat(),
        "total": len(out),
        "active_count": sum(1 for x in out if x["state"] in ("working", "on_break")),
        "anomaly_count": sum(1 for x in out if x["has_anomaly_today"]),
        "positions": out,
        "geofences": geofences,
    }


@router.get("/anomalies")
async def list_anomalies(request: Request, limit: int = 50, only_unreviewed: bool = True):
    """Letzte Anomalien (Manager-Inbox)."""
    mgr = await _manager(request)
    q: dict = {"merchant_id": mgr["merchant_id"]}
    if only_unreviewed:
        q["reviewed"] = False
    cursor = db.staff_anomalies.find(q, {"_id": 0}).sort("created_at", -1).limit(max(1, min(limit, 200)))
    items = [x async for x in cursor]
    # join staff name
    ids = list({x["staff_id"] for x in items})
    name_map = {}
    if ids:
        async for s in db.staff_members.find({"id": {"$in": ids}}, {"_id": 0, "id": 1, "name": 1, "email": 1}):
            name_map[s["id"]] = s.get("name") or s.get("email")
    for x in items:
        x["staff_name"] = name_map.get(x["staff_id"]) or "—"
    return {"total": len(items), "items": items}


@router.post("/anomalies/{anomaly_id}/review")
async def review_anomaly(anomaly_id: str, request: Request):
    mgr = await _manager(request)
    res = await db.staff_anomalies.update_one(
        {"id": anomaly_id, "merchant_id": mgr["merchant_id"], "reviewed": False},
        {"$set": {
            "reviewed": True,
            "reviewed_by": mgr["id"],
            "reviewed_at": datetime.now(timezone.utc).isoformat(),
        }},
    )
    if res.matched_count == 0:
        raise HTTPException(404, "Anomaly nicht gefunden oder bereits geprüft")
    return {"success": True}
