"""
Clock-Event Anomaly Detector (P1 — GPS Fake Detection)
========================================================
Server-seitige Heuristik um verdächtige Clock-Events zu markieren:

  - **Speed-Anomalie**: Geschwindigkeit zwischen zwei aufeinanderfolgenden
    Events > 200 km/h (z.B. „Teleport" durch Mock-GPS).
  - **Sprung-Anomalie**: Distanz > 2 km in < 60s (physisch unmöglich).
  - **Identische-Koordinaten-Häufung**: 5+ Events mit exakt gleichen Koordinaten
    in 24h → Indikator für Mock-Provider (echte GPS hat min. ~5m Drift).

Markiert das Event mit `is_mock_suspected=True` + `mock_reason`.
Schreibt zusätzlich einen Eintrag in `staff_anomalies` für Manager-Reports.
"""
from __future__ import annotations

import math
from datetime import datetime, timezone
from typing import Optional
from uuid import uuid4

from core.database import db

EARTH_R_KM = 6371.0
SPEED_LIMIT_KMH = 200.0
JUMP_DISTANCE_KM = 2.0
JUMP_MAX_SECONDS = 60
STATIC_CLUSTER_THRESHOLD = 5  # exakt gleiche Koordinaten innerhalb 24h


def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Haversine-Distanz in km."""
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return EARTH_R_KM * c


def _parse_iso(ts: str) -> Optional[datetime]:
    try:
        return datetime.fromisoformat(ts.replace("Z", "+00:00"))
    except Exception:
        return None


async def check_anomaly(staff_id: str, merchant_id: str, event_id: str,
                        lat: Optional[float], lng: Optional[float],
                        timestamp_iso: str) -> Optional[dict]:
    """
    Prüft das frisch eingefügte Event auf Anomalien.
    Returns None wenn ok, sonst dict mit { reason, severity, prev_event_id }.
    Markiert das Event im DB-Update als is_mock_suspected.
    """
    if lat is None or lng is None:
        return None

    # Letzten Event mit Koordinaten finden (vor diesem)
    prev = await db.staff_clock_events.find_one(
        {
            "staff_id": staff_id,
            "id": {"$ne": event_id},
            "lat": {"$ne": None},
            "lng": {"$ne": None},
        },
        sort=[("timestamp", -1)],
        projection={"_id": 0, "id": 1, "lat": 1, "lng": 1, "timestamp": 1},
    )

    anomaly: Optional[dict] = None

    if prev:
        d_km = _haversine_km(prev["lat"], prev["lng"], lat, lng)
        t_curr = _parse_iso(timestamp_iso)
        t_prev = _parse_iso(prev.get("timestamp", ""))
        if t_curr and t_prev:
            dt = (t_curr - t_prev).total_seconds()
            if dt > 0:
                speed_kmh = (d_km / dt) * 3600.0 if dt > 0 else 0.0
                if d_km >= JUMP_DISTANCE_KM and dt <= JUMP_MAX_SECONDS:
                    anomaly = {
                        "reason": "impossible_jump",
                        "severity": "high",
                        "distance_km": round(d_km, 3),
                        "delta_seconds": round(dt, 1),
                        "prev_event_id": prev["id"],
                    }
                elif speed_kmh > SPEED_LIMIT_KMH:
                    anomaly = {
                        "reason": "speed_exceeded",
                        "severity": "medium",
                        "speed_kmh": round(speed_kmh, 1),
                        "distance_km": round(d_km, 3),
                        "delta_seconds": round(dt, 1),
                        "prev_event_id": prev["id"],
                    }

    # Static-Cluster: exakt gleiche Koordinaten in den letzten 24h?
    if anomaly is None:
        from datetime import timedelta
        cutoff = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
        identical = await db.staff_clock_events.count_documents({
            "staff_id": staff_id,
            "lat": lat,
            "lng": lng,
            "timestamp": {"$gte": cutoff},
            "id": {"$ne": event_id},
        })
        if identical >= STATIC_CLUSTER_THRESHOLD:
            anomaly = {
                "reason": "static_cluster",
                "severity": "low",
                "identical_count": identical + 1,
            }

    if anomaly:
        # Mark Event
        await db.staff_clock_events.update_one(
            {"id": event_id},
            {"$set": {
                "is_mock_suspected": True,
                "mock_reason": anomaly["reason"],
                "anomaly": anomaly,
            }},
        )
        # Anomaly-Log
        try:
            await db.staff_anomalies.insert_one({
                "id": str(uuid4()),
                "merchant_id": merchant_id,
                "staff_id": staff_id,
                "event_id": event_id,
                "type": anomaly["reason"],
                "severity": anomaly["severity"],
                "details": anomaly,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "reviewed": False,
            })
        except Exception:
            pass

    return anomaly
