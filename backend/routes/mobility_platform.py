import json
import os
from datetime import datetime, timezone
from math import radians, sin, cos, asin, sqrt
from typing import Optional, List
from urllib.parse import urlencode
from uuid import uuid4

import httpx
from dotenv import load_dotenv
from emergentintegrations.llm.chat import LlmChat, UserMessage
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from core.database import db
from core.security import get_current_user

load_dotenv()

router = APIRouter(prefix="/api/mobility-platform", tags=["Mobility Platform"])

NOMINATIM_URL = "https://nominatim.openstreetmap.org"
OSRM_URL = "https://router.project-osrm.org"
SEARCH_LANGS = {"de": "de", "en": "en", "sq": "sq"}
AI_MODEL_FALLBACKS = [
    ("openai", "gpt-5.2"),
    ("gemini", "gemini-3-flash-preview"),
    ("anthropic", "claude-sonnet-4-5-20250929"),
]

TRANSPORT_PAYMENT_METHODS = ["wallet", "nfc", "qr", "apple_pay", "google_pay"]


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


class MobilityAiRecommendationRequest(BaseModel):
    pickup_address: str = Field(..., min_length=2, max_length=280)
    dropoff_address: str = Field(..., min_length=2, max_length=280)
    distance_km: float
    duration_min: int
    options: List[dict] = Field(default_factory=list)
    recommendations: Optional[dict] = None


def _cache_key(path: str, params: dict) -> str:
    clean = {k: v for k, v in params.items() if v is not None}
    return f"{path}?{urlencode(sorted(clean.items()), doseq=True)}"


async def _read_geo_cache(key: str):
    cached = await db.mobility_geo_cache.find_one({"key": key}, {"_id": 0, "payload": 1})
    return cached.get("payload") if cached else None


async def _write_geo_cache(key: str, payload):
    await db.mobility_geo_cache.update_one(
        {"key": key},
        {"$set": {
            "key": key,
            "payload": payload,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }},
        upsert=True,
    )


def _round_money(value: float) -> float:
    return round(float(value or 0), 2)


def _service_marker(marker_type: str, marker_id: str, label: str, lat: float, lng: float, **extra):
    return {
        "id": marker_id,
        "type": marker_type,
        "label": label,
        "lat": lat,
        "lng": lng,
        **extra,
    }


def _extract_json_payload(text: str) -> dict:
    cleaned = (text or "").strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`")
        if cleaned.startswith("json"):
            cleaned = cleaned[4:]
        cleaned = cleaned.strip()
    try:
        return json.loads(cleaned)
    except Exception:
        start = cleaned.find("{")
        end = cleaned.rfind("}")
        if start >= 0 and end > start:
            return json.loads(cleaned[start:end + 1])
        raise


async def _generate_ai_route_recommendation(payload: MobilityAiRecommendationRequest) -> dict:
    api_key = os.getenv("EMERGENT_LLM_KEY")
    if not api_key:
        return {
            "available": False,
            "headline": "AI aktuell nicht verfügbar",
            "summary": "Regelwerk bleibt aktiv, aber der Universal Key fehlt im Backend.",
            "provider": None,
            "model": None,
        }

    compact_options = [
        {
            "type": item.get("type"),
            "label": item.get("label"),
            "price_eur": item.get("price_eur"),
            "duration_min": item.get("duration_min"),
            "distance_km": item.get("distance_km"),
            "eco_score": item.get("eco_score"),
        }
        for item in payload.options
    ]
    prompt = (
        "Du bist BidBlitz Mobility AI. Analysiere die Transportoptionen und antworte NUR als gültiges JSON ohne Markdown.\n"
        "Wähle die beste Option für diese konkrete Strecke und gib eine kurze, hilfreiche Begründung auf Deutsch.\n"
        "Die Werte im Feld best_option_type und secondary_option_type müssen exakt einem dieser Types entsprechen: taxi, scooter, bike, car_rental, airport_shuttle, vip.\n"
        "Antwortformat:\n"
        "{\n"
        '  "headline": "kurze Headline",\n'
        '  "summary": "1-2 Sätze Empfehlung",\n'
        '  "reason_short": "kurzer Hauptgrund",\n'
        '  "best_option_type": "taxi|scooter|bike|car_rental|airport_shuttle|vip",\n'
        '  "secondary_option_type": "taxi|scooter|bike|car_rental|airport_shuttle|vip",\n'
        '  "watchouts": ["Hinweis 1", "Hinweis 2"],\n'
        '  "confidence": 0-100\n'
        "}\n\n"
        f"Pickup: {payload.pickup_address}\n"
        f"Dropoff: {payload.dropoff_address}\n"
        f"Gesamtdistanz: {round(payload.distance_km, 2)} km\n"
        f"Basisdauer: {payload.duration_min} Minuten\n"
        f"Regelwerk-Empfehlungen: {json.dumps(payload.recommendations or {}, ensure_ascii=False)}\n"
        f"Optionen: {json.dumps(compact_options, ensure_ascii=False)}"
    )

    last_error = None
    for provider, model in AI_MODEL_FALLBACKS:
        try:
            chat = LlmChat(
                api_key=api_key,
                session_id=f"mobility-ai-{uuid4().hex}",
                system_message="Du bist BidBlitz Mobility AI. Antworte nur mit JSON.",
            ).with_model(provider, model)
            text = await chat.send_message(UserMessage(text=prompt))
            parsed = _extract_json_payload(text)
            recommendation = {
                "available": True,
                "headline": parsed.get("headline") or "AI-Empfehlung bereit",
                "summary": parsed.get("summary") or parsed.get("reason_short") or "AI-Empfehlung wurde erzeugt.",
                "reason_short": parsed.get("reason_short") or "Beste Gesamtwahl",
                "best_option_type": parsed.get("best_option_type"),
                "secondary_option_type": parsed.get("secondary_option_type"),
                "watchouts": parsed.get("watchouts") or [],
                "confidence": int(parsed.get("confidence") or 0),
                "provider": provider,
                "model": model,
            }
            await db.mobility_ai_recommendations.insert_one({
                "created_at": datetime.now(timezone.utc).isoformat(),
                "provider": provider,
                "model": model,
                "pickup_address": payload.pickup_address,
                "dropoff_address": payload.dropoff_address,
                "distance_km": payload.distance_km,
                "duration_min": payload.duration_min,
                "options": compact_options,
                "recommendations": payload.recommendations or {},
                "response": recommendation,
            })
            return recommendation
        except Exception as exc:
            last_error = str(exc)

    return {
        "available": False,
        "headline": "AI-Empfehlung derzeit nicht erreichbar",
        "summary": "Regelwerk bleibt aktiv. Bitte versuche die KI-Empfehlung gleich noch einmal.",
        "reason_short": "Fallback auf Regelwerk",
        "best_option_type": None,
        "secondary_option_type": None,
        "watchouts": [],
        "confidence": 0,
        "provider": None,
        "model": None,
        "error": last_error,
    }


async def _nominatim_get(path: str, params: dict):
    key = _cache_key(path, params)
    cached = await _read_geo_cache(key)
    if cached is not None:
        return cached
    headers = {"User-Agent": "BidBlitzMobility/1.0 (support@bidblitz.com)"}
    async with httpx.AsyncClient(timeout=8.0) as client:
        response = await client.get(f"{NOMINATIM_URL}{path}", params=params, headers=headers)
        response.raise_for_status()
        payload = response.json()
        await _write_geo_cache(key, payload)
        return payload


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


@router.post("/ai-recommendation")
async def mobility_ai_recommendation(req: MobilityAiRecommendationRequest):
    if not req.options:
        raise HTTPException(400, "Keine Transportoptionen für AI-Empfehlung übergeben")
    return await _generate_ai_route_recommendation(req)


@router.get("/nearby")
async def get_nearby_mobility(lat: float, lng: float, radius: float = 5.0):
    radius_km = max(0.5, min(radius, 25.0))

    driver_rows = await db.drivers.find(
        {"online": True, "verified": True, "status": "approved"},
        {"_id": 0, "driver_id": 1, "name": 1, "car": 1, "location": 1},
    ).to_list(150)
    driver_locations = await db.driver_locations.find({}, {"_id": 0, "driver_id": 1, "lat": 1, "lng": 1}).to_list(250)
    driver_loc_map = {
        item.get("driver_id"): {"lat": item.get("lat"), "lng": item.get("lng")}
        for item in driver_locations
        if item.get("driver_id")
    }

    scooter_rows = await db.scooters.find(
        {"status": {"$in": ["available", "locked"]}, "battery": {"$gte": 15}},
        {"_id": 0, "scooter_id": 1, "name": 1, "model": 1, "battery": 1, "battery_percent": 1, "location": 1, "lat": 1, "lng": 1},
    ).to_list(150)

    car_rows = await db.car_rental_cars.find(
        {"status": "available"},
        {"_id": 0, "car_id": 1, "title": 1, "brand": 1, "model": 1, "city": 1, "lat": 1, "lng": 1, "price_per_day": 1, "main_image": 1},
    ).to_list(150)

    markers = []
    counts = {"taxi": 0, "scooter": 0, "car_rental": 0}

    for driver in driver_rows:
        loc = driver_loc_map.get(driver.get("driver_id")) or driver.get("location") or {}
        dlat = loc.get("lat")
        dlng = loc.get("lng")
        if not dlat or not dlng:
            continue
        distance_km = haversine_distance(lat, lng, dlat, dlng)
        if distance_km > radius_km:
            continue
        counts["taxi"] += 1
        car_info = driver.get("car") or {}
        markers.append(_service_marker(
            "taxi",
            driver.get("driver_id") or f"taxi-{counts['taxi']}",
            driver.get("name") or car_info.get("brand") or "Taxi in der Nähe",
            dlat,
            dlng,
            distance_km=round(distance_km, 2),
            eta_minutes=max(2, round(distance_km * 2.5)),
            subtitle=car_info.get("brand") or car_info.get("model") or "Verifizierter Fahrer",
            payment_methods=TRANSPORT_PAYMENT_METHODS,
        ))

    for scooter in scooter_rows:
        loc = scooter.get("location") or {}
        slat = loc.get("lat") or scooter.get("lat")
        slng = loc.get("lng") or scooter.get("lng")
        if not slat or not slng:
            continue
        distance_km = haversine_distance(lat, lng, slat, slng)
        if distance_km > radius_km:
            continue
        counts["scooter"] += 1
        markers.append(_service_marker(
            "scooter",
            scooter.get("scooter_id") or f"scooter-{counts['scooter']}",
            scooter.get("model") or scooter.get("name") or "E-Scooter",
            slat,
            slng,
            distance_km=round(distance_km, 2),
            battery_percent=int(scooter.get("battery_percent") or scooter.get("battery") or 0),
            subtitle="Sofort entsperrbar",
            payment_methods=TRANSPORT_PAYMENT_METHODS,
        ))

    for car in car_rows:
        clat = car.get("lat")
        clng = car.get("lng")
        if not clat or not clng:
            continue
        distance_km = haversine_distance(lat, lng, clat, clng)
        if distance_km > radius_km:
            continue
        counts["car_rental"] += 1
        markers.append(_service_marker(
            "car_rental",
            car.get("car_id") or f"car-{counts['car_rental']}",
            car.get("title") or "Mietwagen",
            clat,
            clng,
            distance_km=round(distance_km, 2),
            price_hint=_round_money(car.get("price_per_day") or 0),
            subtitle=car.get("city") or f"{car.get('brand', '')} {car.get('model', '')}".strip() or "Tagesmiete",
            image_url=car.get("main_image"),
            payment_methods=TRANSPORT_PAYMENT_METHODS,
        ))

    markers.sort(key=lambda item: (item.get("distance_km") or 999, item.get("label") or ""))

    return {
        "center": {"lat": lat, "lng": lng},
        "radius_km": radius_km,
        "counts": counts,
        "markers": markers[:60],
        "available_modes": [
            {"type": "taxi", "label": "Taxi", "live": counts["taxi"] > 0, "count": counts["taxi"]},
            {"type": "scooter", "label": "E-Scooter", "live": counts["scooter"] > 0, "count": counts["scooter"]},
            {"type": "bike", "label": "Fahrrad", "live": True, "count": None},
            {"type": "car_rental", "label": "Mietwagen", "live": counts["car_rental"] > 0, "count": counts["car_rental"]},
            {"type": "airport_shuttle", "label": "Airport Shuttle", "live": True, "count": None},
            {"type": "vip", "label": "VIP Chauffeur", "live": True, "count": None},
        ],
    }


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