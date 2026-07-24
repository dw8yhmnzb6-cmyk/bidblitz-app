"""
BidBlitz Taxi — Zone & Time Multi-Tarif Helper
==============================================
Findet die zum Pickup passende Tarif-Zone und berechnet
Zeit-Zuschläge (Nacht 22-06, Wochenende, Feiertag).

Keine LLM-Calls. Pure Daten-Logik.
"""
from __future__ import annotations

import math
from datetime import datetime, timezone
from typing import Optional

from core.database import db


# Wenige fixe Feiertage (DE) — minimal, keine Library-Abhängigkeit
_FIXED_HOLIDAYS_DE = {
    (1, 1),    # Neujahr
    (5, 1),    # Tag der Arbeit
    (10, 3),   # Tag der Dt. Einheit
    (12, 24),  # Heiligabend
    (12, 25),  # 1. Weihnachtstag
    (12, 26),  # 2. Weihnachtstag
    (12, 31),  # Silvester
}


def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = (math.sin(dlat / 2) ** 2
         + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2))
         * math.sin(dlng / 2) ** 2)
    return 2 * R * math.asin(math.sqrt(a))


async def find_matching_zone(lat: float, lng: float) -> Optional[dict]:
    """Returns the first active tariff zone whose circle contains (lat,lng), or None."""
    if lat is None or lng is None:
        return None
    cursor = db.taxi_tariff_zones.find({"active": {"$ne": False}}, {"_id": 0})
    best = None
    best_dist = None
    async for z in cursor:
        c_lat = z.get("center_lat")
        c_lng = z.get("center_lng")
        if c_lat is None or c_lng is None:
            continue
        d = _haversine_km(lat, lng, c_lat, c_lng)
        if d <= float(z.get("radius_km", 0)):
            # Prefer smaller zone (more specific)
            if best is None or d < best_dist:
                best = z
                best_dist = d
    return best


def compute_time_multiplier(zone: Optional[dict] = None, now: Optional[datetime] = None) -> dict:
    """Returns {multiplier, night, weekend, holiday, label} based on the current time
    and zone-specific multipliers (or sensible defaults)."""
    now = now or datetime.now(timezone.utc)
    # Convert to local (Europe/Berlin ~ UTC+1/+2). Naive +1 fallback if zoneinfo missing.
    try:
        from zoneinfo import ZoneInfo
        local = now.astimezone(ZoneInfo("Europe/Berlin"))
    except Exception:
        local = now

    h = local.hour
    wd = local.weekday()  # 0=Mon..6=Sun

    mults = (zone or {}).get("multipliers") or {}
    night_m = float(mults.get("night_22_06", 1.20))
    weekend_m = float(mults.get("weekend", 1.15))
    holiday_m = float(mults.get("holiday", 1.30))

    is_night = (h >= 22 or h < 6)
    is_weekend = wd >= 5
    is_holiday = (local.month, local.day) in _FIXED_HOLIDAYS_DE

    # Combine: highest single multiplier wins (don't compound — would be unfair to user)
    mult = 1.0
    label_parts = []
    if is_holiday and holiday_m > mult:
        mult = holiday_m
        label_parts.append("Feiertag")
    if is_night and night_m > mult:
        mult = night_m
        label_parts.append("Nachttarif")
    if is_weekend and weekend_m > mult:
        mult = weekend_m
        label_parts.append("Wochenende")

    return {
        "multiplier": round(mult, 3),
        "night": is_night,
        "weekend": is_weekend,
        "holiday": is_holiday,
        "label": " · ".join(label_parts) if label_parts else "",
    }


def apply_multi_tariff(fare: dict, zone: Optional[dict], time_info: dict) -> dict:
    """Adjusts a fare dict from calculate_fare() with zone base/per-km overrides
    and time multiplier. Returns a new dict (does NOT mutate input)."""
    out = dict(fare)
    mult = float(time_info.get("multiplier") or 1.0)

    # Zone-based base override (additive surcharge on top of region base)
    zone_surcharge = 0.0
    if zone:
        # If zone has its own base_fare, treat the diff as surcharge
        zb = float(zone.get("base_fare") or 0)
        rb = float(out.get("base_fare") or 0)
        if zb > rb:
            zone_surcharge = round(zb - rb, 2)

    total = float(out.get("total") or 0) + zone_surcharge
    total = round(total * mult, 2)
    out["total"] = total
    out["zone_surcharge"] = zone_surcharge
    out["time_multiplier"] = mult
    out["time_label"] = time_info.get("label", "")
    if zone:
        out["zone_name"] = zone.get("name")
        out["zone_id"] = zone.get("id")
    # Recompute commission split
    try:
        from .commission import DRIVER_COMMISSION, PLATFORM_COMMISSION  # type: ignore
    except Exception:
        DRIVER_COMMISSION = 0.85
        PLATFORM_COMMISSION = 0.15
    out["driver_earnings"] = round(total * DRIVER_COMMISSION, 2)
    out["platform_fee"] = round(total * PLATFORM_COMMISSION, 2)
    return out
