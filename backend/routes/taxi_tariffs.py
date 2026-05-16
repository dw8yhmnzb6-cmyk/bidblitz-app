"""
BidBlitz Taxi — Multi-Tarif Zonen + Airport Queue (iter123 P0-7, P0-8)
========================================================================
Tarif-Zonen (Polygon-basiert vereinfacht zu Circle): Tag/Nacht/Wochenende
plus regional unterschiedliche €/km Sätze.
Airport-Queue: FIFO-Liste von Fahrern, die am Flughafen warten.

Models:
  taxi_tariff_zones {
    id, merchant_id|null (null = global default), name, center_lat, center_lng,
    radius_km, base_fare, per_km, per_min, multipliers:{
      night_22_06: 1.2, weekend: 1.15, holiday: 1.3
    }, active
  }
  taxi_airport_queue {
    id, airport_code (e.g. BER, MUC, TXL),
    drivers: [{driver_id, joined_at, position}], updated_at
  }
"""
from __future__ import annotations
from datetime import datetime, timezone
from typing import List, Optional
from uuid import uuid4
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from core.database import db
from core.security import get_current_user

router = APIRouter(prefix="/api/taxi", tags=["taxi-tariffs"])


class ZoneCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=80)
    center_lat: float; center_lng: float
    radius_km: float = Field(15.0, ge=0.5, le=200)
    base_fare: float = Field(3.50, ge=0)
    per_km: float = Field(1.80, ge=0)
    per_min: float = Field(0.30, ge=0)
    night_multiplier: float = Field(1.20, ge=1.0, le=3.0)
    weekend_multiplier: float = Field(1.15, ge=1.0, le=3.0)


async def _admin(request: Request):
    u = await get_current_user(request)
    if u.get("role") not in ("admin", "merchant"):
        raise HTTPException(403, "Nur Admin/Merchant")
    return u


@router.get("/tariff-zones")
async def list_zones(request: Request):
    cursor = db.taxi_tariff_zones.find({"active": {"$ne": False}}, {"_id": 0})
    return {"items": [z async for z in cursor]}


@router.post("/admin/tariff-zones")
async def create_zone(payload: ZoneCreate, request: Request):
    await _admin(request)
    doc = {
        "id": str(uuid4()),
        "name": payload.name,
        "center_lat": payload.center_lat, "center_lng": payload.center_lng,
        "radius_km": payload.radius_km,
        "base_fare": payload.base_fare, "per_km": payload.per_km, "per_min": payload.per_min,
        "multipliers": {
            "night_22_06": payload.night_multiplier,
            "weekend": payload.weekend_multiplier,
        },
        "active": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.taxi_tariff_zones.insert_one(doc)
    doc.pop("_id", None)
    return {"success": True, "zone": doc}


@router.delete("/admin/tariff-zones/{zid}")
async def delete_zone(zid: str, request: Request):
    await _admin(request)
    await db.taxi_tariff_zones.update_one({"id": zid}, {"$set": {"active": False}})
    return {"success": True}


# ── Airport Queue (FIFO) ─────────────────────────────────────────────────
class JoinQueueBody(BaseModel):
    airport_code: str = Field(..., pattern=r"^[A-Z]{3}$")


@router.post("/airport-queue/join")
async def join_queue(payload: JoinQueueBody, request: Request):
    user = await get_current_user(request)
    if user.get("role") not in ("driver", "operator", "admin"):
        raise HTTPException(403, "Nur Fahrer")
    driver_id = str(user.get("_id") or user.get("id"))
    now = datetime.now(timezone.utc).isoformat()
    # Remove existing entry (re-join → tail)
    await db.taxi_airport_queue.update_one(
        {"airport_code": payload.airport_code},
        {"$pull": {"drivers": {"driver_id": driver_id}}},
    )
    await db.taxi_airport_queue.update_one(
        {"airport_code": payload.airport_code},
        {"$push": {"drivers": {"driver_id": driver_id, "joined_at": now}},
         "$set": {"updated_at": now}},
        upsert=True,
    )
    q = await db.taxi_airport_queue.find_one(
        {"airport_code": payload.airport_code}, {"_id": 0},
    )
    pos = next((i + 1 for i, d in enumerate(q.get("drivers", []))
                if d["driver_id"] == driver_id), None)
    return {"success": True, "position": pos, "total": len(q.get("drivers", []))}


@router.post("/airport-queue/leave")
async def leave_queue(payload: JoinQueueBody, request: Request):
    user = await get_current_user(request)
    driver_id = str(user.get("_id") or user.get("id"))
    await db.taxi_airport_queue.update_one(
        {"airport_code": payload.airport_code},
        {"$pull": {"drivers": {"driver_id": driver_id}},
         "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}},
    )
    return {"success": True}


@router.get("/airport-queue/{code}")
async def queue_status(code: str, request: Request):
    user = await get_current_user(request)
    driver_id = str(user.get("_id") or user.get("id"))
    q = await db.taxi_airport_queue.find_one({"airport_code": code}, {"_id": 0})
    if not q:
        return {"airport_code": code, "total": 0, "position": None, "drivers": []}
    drivers = q.get("drivers", [])
    pos = next((i + 1 for i, d in enumerate(drivers) if d["driver_id"] == driver_id), None)
    return {"airport_code": code, "total": len(drivers), "position": pos,
            "updated_at": q.get("updated_at")}


# ── Public Demand Marketing Map (P3) ─────────────────────────────────────
@router.get("/public/demand-marketing")
async def public_demand_map(lat: float = 52.52, lng: float = 13.405, radius_km: float = 10.0):
    """Public endpoint für Marketing-Site: zeigt anonyme Demand-Pins der letzten 24h."""
    from datetime import timedelta
    t_from = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
    cursor = db.taxi_rides.find(
        {"created_at": {"$gte": t_from}}, {"_id": 0, "pickup": 1},
    ).limit(500)
    cells: dict = {}
    async for r in cursor:
        p = r.get("pickup") or {}
        if p.get("lat") is None: continue
        k = (round(p["lat"] * 50) / 50, round(p["lng"] * 50) / 50)  # ~2km grid
        cells[k] = cells.get(k, 0) + 1
    out = [{"lat": k[0], "lng": k[1], "count": v} for k, v in cells.items()]
    out.sort(key=lambda x: -x["count"])
    return {"updated_at": datetime.now(timezone.utc).isoformat(),
            "cells": out[:100]}
