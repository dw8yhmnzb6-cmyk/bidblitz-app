"""
BidBlitz Taxi — Driver-Pro Suite (iter123 P0-4, P0-5, P1-14)
=============================================================
Vereint:
  - Driver-Demand-Heatmap (P0-4): wo sind in den letzten 14T Anfragen entstanden?
    Aggregate auf 50m H3-Grid → für Driver-App, „wo sollte ich hinfahren".
  - Driver-Documents (P0-5): Dokumente mit Expiry tracken (TÜV, Führerschein,
    P-Schein, Versicherung). Daily-Check via Watchdog warnt 30/14/7T vor Ablauf.
  - Driver-Earnings-Pro (P1-14): Wochen/Monats-Aggregat + CSV-Export.

Models:
  taxi_driver_documents {
    id, driver_id, type: 'tuev'|'license'|'p_schein'|'insurance'|'concession',
    file_url, expires_on (yyyy-mm-dd), uploaded_at, status: 'active'|'expired'
  }
  taxi_demand_grid (Aggregate-Cache, materialized stündlich):
    {grid_key (lat10*100+lng10), lat, lng, count, last_event_at}
"""
from __future__ import annotations
import csv
import io
import math
from datetime import datetime, timezone, timedelta
from typing import List, Optional
from uuid import uuid4
from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel, Field
from core.database import db
from core.security import get_current_user

router = APIRouter(prefix="/api/taxi/driver", tags=["taxi-driver-pro"])


class DocumentCreate(BaseModel):
    type: str = Field(..., pattern=r"^(tuev|license|p_schein|insurance|concession|other)$")
    expires_on: str = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$")
    file_url: Optional[str] = None
    note: Optional[str] = None


async def _driver(request: Request) -> dict:
    user = await get_current_user(request)
    if user.get("role") not in ("driver", "operator", "admin"):
        raise HTTPException(403, "Nur Fahrer/Operator")
    return user


REQUIRED_DRIVER_DOCUMENTS = {
    "license": "Führerschein",
    "p_schein": "P-Schein",
    "insurance": "Versicherung",
    "tuev": "TÜV",
}

DOCUMENT_LABELS = {
    **REQUIRED_DRIVER_DOCUMENTS,
    "concession": "Konzession",
    "other": "Sonstiges",
}


def _document_alert_level(days_until_expiry: Optional[int]) -> str:
    if days_until_expiry is None:
        return "unknown"
    if days_until_expiry < 0:
        return "expired"
    if days_until_expiry <= 7:
        return "urgent"
    if days_until_expiry <= 14:
        return "warning"
    if days_until_expiry <= 30:
        return "notice"
    return "ok"


def _annotate_document(doc: dict) -> dict:
    out = {**doc}
    today = datetime.now(timezone.utc).date()
    try:
        exp = datetime.fromisoformat(out["expires_on"]).date()
        days_until_expiry = (exp - today).days
    except Exception:
        days_until_expiry = None
    out["days_until_expiry"] = days_until_expiry
    out["alert_level"] = _document_alert_level(days_until_expiry)
    out["type_label"] = DOCUMENT_LABELS.get(out.get("type"), out.get("type", "Dokument"))
    if days_until_expiry is not None and days_until_expiry < 0:
        out["status"] = "expired"
    return out


# ─── DRIVER HEATMAP ────────────────────────────────────────────────────
@router.get("/demand-heatmap")
async def demand_heatmap(request: Request, days: int = 14, lat: float = 52.52, lng: float = 13.405,
                         radius_km: float = 10.0):
    """
    Aggregate aller (auch nicht-akzeptierten) Estimate-Requests/Bookings in einem
    Radius zu einem (lat10, lng10) Grid (~1km Auflösung).
    """
    await _driver(request)
    t_from = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    rides_cursor = db.taxi_rides.find(
        {"created_at": {"$gte": t_from},
         "pickup.lat": {"$ne": None}},
        {"_id": 0, "pickup": 1, "created_at": 1, "status": 1},
    )
    cells: dict[tuple, dict] = {}
    async for r in rides_cursor:
        p = r.get("pickup") or {}
        plat, plng = p.get("lat"), p.get("lng")
        if plat is None or plng is None:
            continue
        # Filter by radius
        d_km = _haversine_km(plat, plng, lat, lng)
        if d_km > radius_km:
            continue
        # Snap to 0.01 grid (~1km)
        k = (round(plat * 100) / 100, round(plng * 100) / 100)
        c = cells.setdefault(k, {"lat": k[0], "lng": k[1], "count": 0, "completed": 0})
        c["count"] += 1
        if r.get("status") == "completed":
            c["completed"] += 1
    out = list(cells.values())
    out.sort(key=lambda x: -x["count"])
    return {"days": days, "center": {"lat": lat, "lng": lng},
            "radius_km": radius_km, "cells": out[:300]}


# ─── DRIVER DOCUMENTS ────────────────────────────────────────────────────
@router.post("/documents")
async def add_document(payload: DocumentCreate, request: Request):
    user = await _driver(request)
    driver_id = str(user.get("_id") or user.get("id"))
    doc = {
        "id": str(uuid4()),
        "driver_id": driver_id,
        "type": payload.type,
        "expires_on": payload.expires_on,
        "file_url": payload.file_url,
        "note": payload.note,
        "uploaded_at": datetime.now(timezone.utc).isoformat(),
        "status": "active",
    }
    await db.taxi_driver_documents.insert_one(doc)
    doc.pop("_id", None)
    return {"success": True, "document": _annotate_document(doc)}


@router.get("/documents")
async def list_documents(request: Request):
    user = await _driver(request)
    driver_id = str(user.get("_id") or user.get("id"))
    cursor = db.taxi_driver_documents.find({"driver_id": driver_id}, {"_id": 0})
    items = [_annotate_document(d) async for d in cursor]
    items.sort(key=lambda x: x.get("days_until_expiry") if x.get("days_until_expiry") is not None else 9999)
    return {"items": items}


@router.get("/documents/summary")
async def documents_summary(request: Request):
    user = await _driver(request)
    driver_id = str(user.get("_id") or user.get("id"))
    cursor = db.taxi_driver_documents.find({"driver_id": driver_id}, {"_id": 0})
    items = [_annotate_document(d) async for d in cursor]
    counts = {"expired": 0, "urgent": 0, "warning": 0, "notice": 0, "ok": 0, "unknown": 0}
    for item in items:
        counts[item["alert_level"]] = counts.get(item["alert_level"], 0) + 1
    missing_required = [
        {"type": key, "label": label}
        for key, label in REQUIRED_DRIVER_DOCUMENTS.items()
        if not any(i.get("type") == key for i in items)
    ]
    next_expiring = next((item for item in sorted(items, key=lambda x: x.get("days_until_expiry") if x.get("days_until_expiry") is not None else 9999) if item.get("days_until_expiry") is not None), None)
    alerts = []
    if counts["expired"]:
        alerts.append({"tone": "red", "title": "Dokument abgelaufen", "text": f"{counts['expired']} Dokument(e) sind bereits abgelaufen."})
    if counts["urgent"]:
        alerts.append({"tone": "amber", "title": "Sofort prüfen", "text": f"{counts['urgent']} Dokument(e) laufen in 7 Tagen oder früher ab."})
    if missing_required:
        alerts.append({"tone": "violet", "title": "Pflichtdokument fehlt", "text": ", ".join(x["label"] for x in missing_required)})
    return {
        "counts": counts,
        "missing_required": missing_required,
        "next_expiring": next_expiring,
        "alerts": alerts,
        "has_blocker": bool(counts["expired"] or missing_required),
    }


@router.delete("/documents/{did}")
async def delete_document(did: str, request: Request):
    user = await _driver(request)
    driver_id = str(user.get("_id") or user.get("id"))
    await db.taxi_driver_documents.delete_one({"id": did, "driver_id": driver_id})
    return {"success": True}


# ─── DRIVER EARNINGS PRO + CSV EXPORT ───────────────────────────────────
@router.get("/earnings/pro")
async def earnings_pro(request: Request, days: int = 30):
    user = await _driver(request)
    driver_id = str(user.get("_id") or user.get("id"))
    t_from = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    cursor = db.taxi_rides.find(
        {"driver_id": driver_id, "completed_at": {"$gte": t_from}, "status": "completed"},
        {"_id": 0, "ride_id": 1, "fare": 1, "final_fare": 1, "tip": 1,
         "completed_at": 1, "distance_km": 1, "duration_min": 1, "vehicle_type": 1},
    )
    items = [r async for r in cursor]
    gross = sum((r.get("final_fare") or r.get("fare") or 0) for r in items)
    tips = sum((r.get("tip") or 0) for r in items)
    by_day: dict = {}
    for r in items:
        try:
            day = r["completed_at"][:10]
        except Exception:
            continue
        by_day[day] = by_day.get(day, 0) + (r.get("final_fare") or r.get("fare") or 0) + (r.get("tip") or 0)
    return {"days": days, "ride_count": len(items),
            "gross_eur": round(gross, 2), "tips_eur": round(tips, 2),
            "total_eur": round(gross + tips, 2),
            "by_day": [{"date": k, "total": round(v, 2)} for k, v in sorted(by_day.items())]}


@router.get("/earnings/export.csv")
async def earnings_csv(request: Request, days: int = 30):
    user = await _driver(request)
    driver_id = str(user.get("_id") or user.get("id"))
    t_from = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    cursor = db.taxi_rides.find(
        {"driver_id": driver_id, "completed_at": {"$gte": t_from}, "status": "completed"},
        {"_id": 0, "ride_id": 1, "fare": 1, "final_fare": 1, "tip": 1,
         "completed_at": 1, "distance_km": 1, "duration_min": 1, "vehicle_type": 1,
         "pickup": 1, "dropoff": 1},
    )
    items = [r async for r in cursor]
    buf = io.StringIO()
    w = csv.writer(buf, delimiter=";")
    w.writerow(["ride_id", "completed_at", "pickup", "dropoff",
                "distance_km", "duration_min", "vehicle_type", "fare_eur", "tip_eur", "total_eur"])
    for r in items:
        pickup = (r.get("pickup") or {}).get("address", "")
        drop = (r.get("dropoff") or {}).get("address", "")
        fare = r.get("final_fare") or r.get("fare") or 0
        tip = r.get("tip") or 0
        w.writerow([r["ride_id"], r["completed_at"], pickup, drop,
                    r.get("distance_km", 0), r.get("duration_min", 0),
                    r.get("vehicle_type", ""), fare, tip, fare + tip])
    return Response(content=buf.getvalue(), media_type="text/csv",
                    headers={"Content-Disposition": f'attachment; filename="earnings_{days}d.csv"'})


def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2) ** 2
    return 6371.0 * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
