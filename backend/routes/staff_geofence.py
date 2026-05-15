"""
BidBlitz Staff Geofence — automatische Mitarbeiter-Zeiterfassung
================================================================

Ziel: Mitarbeiter wird beim Ankommen automatisch erkannt.

Datenmodell (MongoDB-Collections):
─────────────────────────────────
staff_geofences:
    id, merchant_id, name, lat, lng, radius_m, type (office/warehouse/branch),
    bluetooth_beacon_id?, wifi_ssid?, auto_checkin (bool), active, created_at

staff_geofence_events:
    id, staff_id, merchant_id, geofence_id, event_type (entered|exited|checked_in|skipped),
    lat, lng, accuracy_m, ts, suspected_spoof (bool)

API-Endpoints:
──────────────
POST   /api/staff/geofence              — create
GET    /api/staff/geofence              — list (merchant scope)
PATCH  /api/staff/geofence/{id}         — update
DELETE /api/staff/geofence/{id}
POST   /api/staff/geofence/check-presence — Mitarbeiter sendet lat/lng → returnt nearest fence
POST   /api/staff/geofence/auto-checkin   — bestätigt + clock_in
GET    /api/staff/geofence/events         — letzte Events
"""
from datetime import datetime, timezone, timedelta
from typing import Optional
from uuid import uuid4
from math import radians, sin, cos, asin, sqrt
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from core.database import db
from core.security import get_current_user

router = APIRouter(prefix="/api/staff/geofence", tags=["staff-geofence"])

# ──────────────────────────────────────────────────────────
# Constants
# ──────────────────────────────────────────────────────────
DEFAULT_RADIUS_M = 100
MAX_ACCURACY_M = 100           # GPS accuracy worse than this is suspicious
MIN_COOLDOWN_SECONDS = 60      # Same fence: only 1 entry-event per minute
SUSPICIOUS_SPEED_KMH = 200     # Teleportation = spoof


# ──────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────
def _haversine_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Distance in meters between two GPS points."""
    R = 6371000
    p1, p2 = radians(lat1), radians(lat2)
    dp = radians(lat2 - lat1)
    dl = radians(lng2 - lng1)
    a = sin(dp / 2) ** 2 + cos(p1) * cos(p2) * sin(dl / 2) ** 2
    return 2 * R * asin(sqrt(a))


async def _get_actor(request: Request) -> dict:
    """Returns dict with {id, role, email, merchant_id_hint}.
    Works for both Merchant/Admin (via core auth) AND Staff (via staff_session cookie).
    """
    # Try staff session first
    staff_session = request.cookies.get("staff_session")
    if staff_session:
        staff = await db.staff_members.find_one({"id": staff_session}, {"_id": 0})
        if staff and staff.get("active") is not False:
            return {
                "id": staff["id"],
                "role": "staff",
                "email": staff.get("email"),
                "merchant_id": staff.get("merchant_id"),
            }
    # Fall back to core auth
    user = await get_current_user(request)
    return {
        "id": str(user.get("_id") or user.get("id") or ""),
        "role": user.get("role"),
        "email": user.get("email"),
        "merchant_id": None,
    }


async def _resolve_merchant(actor: dict) -> str:
    """Find merchant_id for the current actor."""
    if actor.get("merchant_id"):
        return str(actor["merchant_id"])
    role = actor.get("role")
    uid = actor["id"]
    if role in ("merchant", "admin"):
        m = await db.merchants.find_one({"owner_user_id": uid}, {"_id": 1})
        if m:
            return str(m["_id"])
        m = await db.merchants.find_one({"email": actor.get("email")}, {"_id": 1})
        if m:
            return str(m["_id"])
        return uid
    return "demo-merchant"


# ──────────────────────────────────────────────────────────
# Models
# ──────────────────────────────────────────────────────────
class GeofenceCreate(BaseModel):
    name: str
    lat: float
    lng: float
    radius_m: int = DEFAULT_RADIUS_M
    type: str = "office"  # office | warehouse | branch | site | other
    auto_checkin: bool = False
    bluetooth_beacon_id: Optional[str] = None
    wifi_ssid: Optional[str] = None


class GeofencePatch(BaseModel):
    name: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    radius_m: Optional[int] = None
    type: Optional[str] = None
    auto_checkin: Optional[bool] = None
    active: Optional[bool] = None
    bluetooth_beacon_id: Optional[str] = None
    wifi_ssid: Optional[str] = None


class PresenceCheck(BaseModel):
    lat: float
    lng: float
    accuracy_m: Optional[float] = None
    wifi_ssid: Optional[str] = None
    bluetooth_beacons: Optional[list] = None  # [{id, rssi}]
    timestamp: Optional[str] = None


class AutoCheckinBody(BaseModel):
    geofence_id: str
    lat: float
    lng: float
    accuracy_m: Optional[float] = None
    confirmed: bool = True  # if false → skip event only


# ──────────────────────────────────────────────────────────
# CRUD (Manager)
# ──────────────────────────────────────────────────────────
@router.post("")
async def create_geofence(body: GeofenceCreate, request: Request):
    actor = await _get_actor(request)
    if actor.get("role") not in ("merchant", "admin"):
        raise HTTPException(403, "Nur Manager/Admin")
    merchant_id = await _resolve_merchant(actor)
    if body.radius_m < 10 or body.radius_m > 5000:
        raise HTTPException(400, "Radius muss zwischen 10–5000m liegen")
    doc = {
        "id": str(uuid4()),
        "merchant_id": merchant_id,
        "name": body.name.strip(),
        "lat": body.lat,
        "lng": body.lng,
        "radius_m": body.radius_m,
        "type": body.type,
        "auto_checkin": body.auto_checkin,
        "bluetooth_beacon_id": body.bluetooth_beacon_id,
        "wifi_ssid": body.wifi_ssid,
        "active": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": actor.get("email"),
    }
    await db.staff_geofences.insert_one(doc.copy())
    doc.pop("_id", None)
    return {"success": True, "geofence": doc}


@router.get("")
async def list_geofences(request: Request, include_inactive: bool = False):
    actor = await _get_actor(request)
    merchant_id = await _resolve_merchant(actor)
    q = {"merchant_id": merchant_id}
    if not include_inactive:
        q["active"] = True
    items = await db.staff_geofences.find(q, {"_id": 0}).sort("created_at", -1).to_list(500)
    return {"geofences": items, "count": len(items)}


@router.patch("/{geo_id}")
async def update_geofence(geo_id: str, body: GeofencePatch, request: Request):
    actor = await _get_actor(request)
    if actor.get("role") not in ("merchant", "admin"):
        raise HTTPException(403, "Nur Manager/Admin")
    merchant_id = await _resolve_merchant(actor)
    upd = {k: v for k, v in body.dict(exclude_unset=True).items() if v is not None}
    if not upd:
        raise HTTPException(400, "Keine Änderungen")
    upd["updated_at"] = datetime.now(timezone.utc).isoformat()
    res = await db.staff_geofences.update_one(
        {"id": geo_id, "merchant_id": merchant_id}, {"$set": upd}
    )
    if res.matched_count == 0:
        raise HTTPException(404, "Geofence nicht gefunden")
    return {"success": True, "updated": upd}


@router.delete("/{geo_id}")
async def delete_geofence(geo_id: str, request: Request):
    actor = await _get_actor(request)
    if actor.get("role") not in ("merchant", "admin"):
        raise HTTPException(403, "Nur Manager/Admin")
    merchant_id = await _resolve_merchant(actor)
    res = await db.staff_geofences.update_one(
        {"id": geo_id, "merchant_id": merchant_id}, {"$set": {"active": False}}
    )
    if res.matched_count == 0:
        raise HTTPException(404, "Geofence nicht gefunden")
    return {"success": True}


# ──────────────────────────────────────────────────────────
# Mobile Presence-Check (Staff sends position periodically)
# ──────────────────────────────────────────────────────────
@router.post("/check-presence")
async def check_presence(body: PresenceCheck, request: Request):
    actor = await _get_actor(request)
    merchant_id = await _resolve_merchant(actor)
    staff_id = actor["id"]

    suspected_spoof = False
    spoof_reason = None
    if body.accuracy_m and body.accuracy_m > MAX_ACCURACY_M:
        suspected_spoof = True
        spoof_reason = f"GPS-Genauigkeit zu schlecht: {body.accuracy_m:.0f}m"

    # Teleportation check
    last_event = await db.staff_geofence_events.find_one(
        {"staff_id": staff_id, "ts": {"$gte": (datetime.now(timezone.utc) - timedelta(minutes=5)).isoformat()}},
        {"_id": 0, "lat": 1, "lng": 1, "ts": 1},
        sort=[("ts", -1)],
    )
    if last_event and last_event.get("lat") is not None:
        dist = _haversine_m(last_event["lat"], last_event["lng"], body.lat, body.lng)
        try:
            last_ts = datetime.fromisoformat(last_event["ts"].replace("Z", "+00:00"))
            elapsed_s = max(1, (datetime.now(timezone.utc) - last_ts).total_seconds())
            speed_kmh = (dist / 1000) / (elapsed_s / 3600)
            if speed_kmh > SUSPICIOUS_SPEED_KMH:
                suspected_spoof = True
                spoof_reason = f"Verdächtige Geschwindigkeit: {speed_kmh:.0f} km/h"
        except Exception:
            pass

    fences = await db.staff_geofences.find(
        {"merchant_id": merchant_id, "active": True}, {"_id": 0}
    ).to_list(200)

    nearby = []
    for f in fences:
        d = _haversine_m(body.lat, body.lng, f["lat"], f["lng"])
        if d <= f["radius_m"]:
            status = "inside"
        elif d <= f["radius_m"] * 3:
            status = "approaching"
        else:
            continue
        nearby.append({"geofence": f, "distance_m": round(d, 1), "status": status})

    nearby.sort(key=lambda x: (0 if x["status"] == "inside" else 1, x["distance_m"]))

    inside_fence = None
    auto_checkin_suggested = False
    match_source = None
    last_clock = None
    if nearby and nearby[0]["status"] == "inside" and not suspected_spoof:
        f = nearby[0]["geofence"]
        recent = await db.staff_geofence_events.find_one({
            "staff_id": staff_id,
            "geofence_id": f["id"],
            "event_type": "entered",
            "ts": {"$gte": (datetime.now(timezone.utc) - timedelta(seconds=MIN_COOLDOWN_SECONDS)).isoformat()},
        })
        if not recent:
            await db.staff_geofence_events.insert_one({
                "id": str(uuid4()),
                "staff_id": staff_id,
                "merchant_id": merchant_id,
                "geofence_id": f["id"],
                "event_type": "entered",
                "lat": body.lat,
                "lng": body.lng,
                "accuracy_m": body.accuracy_m,
                "wifi_ssid_seen": body.wifi_ssid,
                "ts": datetime.now(timezone.utc).isoformat(),
                "suspected_spoof": suspected_spoof,
                "spoof_reason": spoof_reason,
            })

        last_clock = await db.staff_clock_events.find_one(
            {"staff_id": staff_id}, {"_id": 0, "action": 1}, sort=[("timestamp", -1)],
        )
        is_off_shift = (not last_clock) or last_clock.get("action") == "clock_out"
        inside_fence = f
        auto_checkin_suggested = is_off_shift and not suspected_spoof
        match_source = "gps"

    wifi_match = None
    wifi_match_fence = None
    for f in fences:
        if f.get("wifi_ssid") and body.wifi_ssid and f["wifi_ssid"].lower() == body.wifi_ssid.lower():
            wifi_match = f["id"]
            wifi_match_fence = f
            break

    bt_match = None
    bt_match_fence = None
    if body.bluetooth_beacons:
        for f in fences:
            if f.get("bluetooth_beacon_id"):
                for b in body.bluetooth_beacons:
                    if (b.get("id") or "").lower() == f["bluetooth_beacon_id"].lower():
                        bt_match = f["id"]
                        bt_match_fence = f
                        break
            if bt_match:
                break

    # Multi-Signal Boost: WiFi/BT-Match suggests check-in even if GPS is uncertain
    if not inside_fence and not suspected_spoof:
        booster_fence = wifi_match_fence or bt_match_fence
        if booster_fence:
            if last_clock is None:
                last_clock = await db.staff_clock_events.find_one(
                    {"staff_id": staff_id}, {"_id": 0, "action": 1}, sort=[("timestamp", -1)],
                )
            is_off_shift = (not last_clock) or last_clock.get("action") == "clock_out"
            inside_fence = booster_fence
            auto_checkin_suggested = is_off_shift
            match_source = "wifi" if wifi_match_fence else "bluetooth"
    elif inside_fence and (wifi_match or bt_match):
        # Combined signal — record stronger match
        match_source = "combined"

    return {
        "success": True,
        "nearby": nearby,
        "inside_fence": inside_fence,
        "auto_checkin_suggested": auto_checkin_suggested,
        "match_source": match_source,
        "wifi_match": wifi_match,
        "bluetooth_match": bt_match,
        "suspected_spoof": suspected_spoof,
        "spoof_reason": spoof_reason,
        "smart_status": _compute_smart_status(nearby, last_clock),
    }


def _compute_smart_status(nearby, last_clock):
    last_action = (last_clock or {}).get("action") if last_clock else None
    if last_action == "clock_in" or last_action == "break_end":
        return "working"
    if last_action == "break_start":
        return "break"
    if nearby and nearby[0]["status"] == "inside":
        return "arrived"
    if nearby and nearby[0]["status"] == "approaching":
        return "approaching"
    return "off"


@router.post("/auto-checkin")
async def auto_checkin(body: AutoCheckinBody, request: Request):
    actor = await _get_actor(request)
    merchant_id = await _resolve_merchant(actor)
    staff_id = actor["id"]

    fence = await db.staff_geofences.find_one(
        {"id": body.geofence_id, "merchant_id": merchant_id, "active": True}, {"_id": 0}
    )
    if not fence:
        raise HTTPException(404, "Geofence nicht gefunden")

    dist = _haversine_m(body.lat, body.lng, fence["lat"], fence["lng"])
    if dist > fence["radius_m"] * 1.2:
        raise HTTPException(400, f"Position außerhalb des Geofence ({dist:.0f}m / {fence['radius_m']}m)")

    if not body.confirmed:
        await db.staff_geofence_events.insert_one({
            "id": str(uuid4()),
            "staff_id": staff_id,
            "merchant_id": merchant_id,
            "geofence_id": body.geofence_id,
            "event_type": "skipped",
            "lat": body.lat,
            "lng": body.lng,
            "accuracy_m": body.accuracy_m,
            "ts": datetime.now(timezone.utc).isoformat(),
        })
        return {"success": True, "action": "skipped"}

    clock_event = {
        "id": str(uuid4()),
        "staff_id": staff_id,
        "merchant_id": merchant_id,
        "action": "clock_in",
        "source": "geofence_auto",
        "geofence_id": body.geofence_id,
        "lat": body.lat,
        "lng": body.lng,
        "accuracy_m": body.accuracy_m,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    await db.staff_clock_events.insert_one(clock_event.copy())
    clock_event.pop("_id", None)

    await db.staff_geofence_events.insert_one({
        "id": str(uuid4()),
        "staff_id": staff_id,
        "merchant_id": merchant_id,
        "geofence_id": body.geofence_id,
        "event_type": "checked_in",
        "lat": body.lat,
        "lng": body.lng,
        "accuracy_m": body.accuracy_m,
        "ts": datetime.now(timezone.utc).isoformat(),
    })

    return {"success": True, "action": "checked_in", "fence": fence, "clock_event": clock_event}


@router.get("/events")
async def list_events(request: Request, limit: int = 50):
    actor = await _get_actor(request)
    merchant_id = await _resolve_merchant(actor)
    is_manager = actor.get("role") in ("merchant", "admin")
    q = {"merchant_id": merchant_id}
    if not is_manager:
        q["staff_id"] = actor["id"]
    items = await db.staff_geofence_events.find(q, {"_id": 0}).sort("ts", -1).limit(min(limit, 500)).to_list(500)
    return {"events": items, "count": len(items)}
