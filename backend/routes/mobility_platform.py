from datetime import datetime, timezone
from math import radians, sin, cos, asin, sqrt
from typing import Optional, List

import httpx
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from core.database import db
from core.security import get_current_user

router = APIRouter(prefix="/api/mobility-platform", tags=["Mobility Platform"])

NOMINATIM_URL = "https://nominatim.openstreetmap.org"
OSRM_URL = "https://router.project-osrm.org"
SEARCH_LANGS = {"de": "de", "en": "en", "sq": "sq"}


def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    lon1, lat1, lon2, lat2 = map(radians, [lon1, lat1, lon2, lat2])
    dlon = lon2 - lon1
    dlat = lat2 - lat1
    a = sin(dlat / 2) ** 2 + cos(lat1) * cos(lat2) * sin(dlon / 2) ** 2
    c = 2 * asin(sqrt(a))
    return c * 6371


def format_location_label(parts: dict) -> str:
    road = parts.get("road") or parts.get("pedestrian") or parts.get("footway") or parts.get("street") or ""
    house = parts.get("house_number") or ""
    city = parts.get("city") or parts.get("town") or parts.get("village") or parts.get("municipality") or ""
    country = parts.get("country") or ""
    first = " ".join([x for x in [road, house] if x]).strip()
    second = ", ".join([x for x in [city, country] if x]).strip()
    return ", ".join([x for x in [first, second] if x]).strip()


def score_place(item: dict, query: str) -> int:
    q = (query or "").strip().lower()
    text = f"{item.get('display_name', '')} {item.get('name', '')}".lower()
    place_class = item.get("class", "")
    place_type = item.get("type", "")
    score = 0
    if text.startswith(q):
        score += 140
    if q in text:
        score += 80
    if place_class == "aeroway":
        score += 45
    if place_type in {"hotel", "road", "house", "residential", "airport"}:
        score += 35
    if item.get("importance"):
        score += round(item.get("importance", 0) * 20)
    return score


def build_option(
    option_type: str,
    distance_km: float,
    duration_min: int,
    demand_multiplier: float,
    eco_score: int,
) -> dict:
    base = {
        "taxi": {"label": "Taxi", "icon": "car-front", "base": 2.4, "per_km": 1.15, "per_min": 0.16, "speed_factor": 1.0, "wallet_only": False},
        "scooter": {"label": "E-Scooter", "icon": "zap", "base": 0.35, "per_km": 0.28, "per_min": 0.06, "speed_factor": 1.25, "wallet_only": True},
        "bike": {"label": "Fahrrad", "icon": "bike", "base": 0.15, "per_km": 0.18, "per_min": 0.03, "speed_factor": 1.55, "wallet_only": True},
        "car_rental": {"label": "Mietwagen", "icon": "car", "base": 8.5, "per_km": 0.32, "per_min": 0.05, "speed_factor": 1.05, "wallet_only": False},
        "airport_shuttle": {"label": "Airport Shuttle", "icon": "plane", "base": 5.0, "per_km": 0.48, "per_min": 0.07, "speed_factor": 1.12, "wallet_only": False},
        "vip": {"label": "VIP Chauffeur", "icon": "crown", "base": 12.0, "per_km": 1.6, "per_min": 0.22, "speed_factor": 0.92, "wallet_only": False},
    }[option_type]
    adjusted_duration = max(2, round(duration_min * base["speed_factor"]))
    fare = round((base["base"] + distance_km * base["per_km"] + adjusted_duration * base["per_min"]) * demand_multiplier, 2)
    return {
        "type": option_type,
        "label": base["label"],
        "icon": base["icon"],
        "price_eur": fare,
        "duration_min": adjusted_duration,
        "distance_km": round(distance_km, 2),
        "wallet_only": base["wallet_only"],
        "eco_score": eco_score,
        "payment_methods": ["wallet", "nfc", "qr", "apple_pay", "google_pay"],
    }


def build_recommendations(options: List[dict]) -> dict:
    cheapest = min(options, key=lambda x: x["price_eur"])
    fastest = min(options, key=lambda x: x["duration_min"])
    eco = max(options, key=lambda x: x["eco_score"])
    balance = min(options, key=lambda x: x["price_eur"] * 0.45 + x["duration_min"] * 0.55)
    return {
        "cheapest": {"type": cheapest["type"], "label": cheapest["label"], "reason": "Günstigste Option"},
        "fastest": {"type": fastest["type"], "label": fastest["label"], "reason": "Schnellste Ankunft"},
        "balance": {"type": balance["type"], "label": balance["label"], "reason": "Beste Balance aus Preis und Zeit"},
        "eco": {"type": eco["type"], "label": eco["label"], "reason": "Niedrigste Emissionen"},
    }


class MobilityRouteRequest(BaseModel):
    pickup_lat: float
    pickup_lng: float
    dropoff_lat: float
    dropoff_lng: float
    pickup_address: Optional[str] = ""
    dropoff_address: Optional[str] = ""


class SavedLocationRequest(BaseModel):
    label: str = Field(..., min_length=1, max_length=60)
    address: str = Field(..., min_length=2, max_length=280)
    lat: float
    lng: float
    kind: str = Field(default="favorite")


async def _nominatim_get(path: str, params: dict):
    headers = {"User-Agent": "BidBlitzMobility/1.0 (support@bidblitz.com)"}
    async with httpx.AsyncClient(timeout=8.0) as client:
        response = await client.get(f"{NOMINATIM_URL}{path}", params=params, headers=headers)
        response.raise_for_status()
        return response.json()


@router.get("/search")
async def search_places(q: str, lang: str = "de", limit: int = 8, lat: Optional[float] = None, lng: Optional[float] = None):
    query = (q or "").strip()
    if len(query) < 2:
        return {"results": []}
    params = {
        "q": query,
        "format": "jsonv2",
        "addressdetails": 1,
        "limit": max(1, min(limit, 10)),
        "accept-language": SEARCH_LANGS.get(lang, "de"),
        "countrycodes": "xk,al,de,ch,at,mk,me",
        "dedupe": 1,
    }
    if lat is not None and lng is not None:
        params["viewbox"] = f"{lng-0.4},{lat+0.3},{lng+0.4},{lat-0.3}"
        params["bounded"] = 0
    try:
        data = await _nominatim_get("/search", params)
    except Exception as exc:
        raise HTTPException(502, f"Adresssuche nicht erreichbar: {exc}")

    ranked = sorted(data, key=lambda item: score_place(item, query), reverse=True)
    results = []
    for item in ranked:
        addr = item.get("address", {})
        results.append({
            "id": str(item.get("osm_id") or item.get("place_id")),
            "name": item.get("name") or format_location_label(addr) or item.get("display_name", ""),
            "address": item.get("display_name", ""),
            "lat": float(item.get("lat")),
            "lng": float(item.get("lon")),
            "city": addr.get("city") or addr.get("town") or addr.get("village") or "",
            "type": item.get("type", "address"),
            "class": item.get("class", ""),
        })
    return {"results": results}


@router.get("/reverse")
async def reverse_place(lat: float, lng: float, lang: str = "de"):
    try:
        item = await _nominatim_get("/reverse", {
            "lat": lat,
            "lon": lng,
            "format": "jsonv2",
            "addressdetails": 1,
            "accept-language": SEARCH_LANGS.get(lang, "de"),
        })
    except Exception as exc:
        raise HTTPException(502, f"Reverse Geocoding nicht erreichbar: {exc}")
    addr = item.get("address", {})
    return {
        "address": item.get("display_name", ""),
        "street": addr.get("road") or addr.get("pedestrian") or "",
        "city": addr.get("city") or addr.get("town") or addr.get("village") or "",
        "country": addr.get("country") or "",
        "lat": lat,
        "lng": lng,
    }


@router.post("/route")
async def calculate_route(req: MobilityRouteRequest):
    coords = f"{req.pickup_lng},{req.pickup_lat};{req.dropoff_lng},{req.dropoff_lat}"
    distance_km = haversine_distance(req.pickup_lat, req.pickup_lng, req.dropoff_lat, req.dropoff_lng)
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            res = await client.get(
                f"{OSRM_URL}/route/v1/driving/{coords}",
                params={"overview": "full", "geometries": "geojson", "steps": "true", "alternatives": "false"},
            )
            res.raise_for_status()
            data = res.json()
        route = (data.get("routes") or [None])[0]
        if not route:
            raise HTTPException(404, "Keine Route gefunden")
        duration_min = max(2, round(route["duration"] / 60))
        demand_multiplier = 1.0 + min(0.22, distance_km / 90)
        options = [
            build_option("taxi", distance_km, duration_min, demand_multiplier, 55),
            build_option("scooter", distance_km, duration_min, 1.0, 86),
            build_option("bike", distance_km, duration_min, 1.0, 96),
            build_option("car_rental", distance_km, duration_min, 1.0, 48),
            build_option("airport_shuttle", distance_km, duration_min, 1.0, 63),
            build_option("vip", distance_km, duration_min, 1.08, 28),
        ]
        return {
            "distance_km": round(distance_km, 2),
            "duration_min": duration_min,
            "geometry": route.get("geometry", {}).get("coordinates", []),
            "pickup": {"address": req.pickup_address, "lat": req.pickup_lat, "lng": req.pickup_lng},
            "dropoff": {"address": req.dropoff_address, "lat": req.dropoff_lat, "lng": req.dropoff_lng},
            "options": options,
            "recommendations": build_recommendations(options),
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(502, f"Routing nicht erreichbar: {exc}")


@router.get("/saved-locations")
async def get_saved_locations(request: Request):
    user = await get_current_user(request)
    user_id = str(user["_id"])
    items = await db.mobility_saved_locations.find({"user_id": user_id}, {"_id": 0}).sort("updated_at", -1).to_list(50)
    return {"locations": items}


@router.post("/saved-locations")
async def save_location(req: SavedLocationRequest, request: Request):
    user = await get_current_user(request)
    user_id = str(user["_id"])
    now = datetime.now(timezone.utc).isoformat()
    await db.mobility_saved_locations.update_one(
        {"user_id": user_id, "label": req.label},
        {"$set": {
            "user_id": user_id,
            "label": req.label,
            "address": req.address,
            "lat": req.lat,
            "lng": req.lng,
            "kind": req.kind,
            "updated_at": now,
        }},
        upsert=True,
    )
    return {"ok": True}


@router.post("/recent-locations")
async def add_recent_location(req: SavedLocationRequest, request: Request):
    user = await get_current_user(request)
    user_id = str(user["_id"])
    now = datetime.now(timezone.utc).isoformat()
    await db.mobility_recent_locations.update_one(
        {"user_id": user_id, "address": req.address},
        {"$set": {
            "user_id": user_id,
            "label": req.label,
            "address": req.address,
            "lat": req.lat,
            "lng": req.lng,
            "kind": req.kind,
            "updated_at": now,
        }, "$inc": {"use_count": 1}},
        upsert=True,
    )
    return {"ok": True}


@router.get("/recent-locations")
async def get_recent_locations(request: Request, limit: int = 8):
    user = await get_current_user(request)
    user_id = str(user["_id"])
    items = await db.mobility_recent_locations.find({"user_id": user_id}, {"_id": 0}).sort("updated_at", -1).limit(max(1, min(limit, 20))).to_list(max(1, min(limit, 20)))
    return {"locations": items}


@router.get("/payment-options")
async def mobility_payment_options(request: Request):
    user = await get_current_user(request)
    return {
        "wallet_balance": round(user.get("balance", 0), 2),
        "methods": [
            {"id": "wallet", "label": "BidBlitz Wallet", "enabled": True},
            {"id": "nfc", "label": "NFC", "enabled": True},
            {"id": "qr", "label": "QR Payment", "enabled": True},
            {"id": "apple_pay", "label": "Apple Pay", "enabled": True},
            {"id": "google_pay", "label": "Google Pay", "enabled": True},
        ],
    }