import json
import os
from datetime import datetime, timezone
from math import radians, sin, cos, asin, sqrt
from typing import Optional, List, Any
from urllib.parse import urlencode
from uuid import uuid4

import httpx
from dotenv import load_dotenv
from emergentintegrations.llm.chat import LlmChat, UserMessage
from emergentintegrations.payments.stripe.checkout import StripeCheckout, CheckoutSessionRequest
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from core.config import STRIPE_API_KEY
from core.database import db
from core.payment_engine import debit_wallet, TransactionType
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

TRANSPORT_PAYMENT_METHODS = ["wallet", "nfc", "qr", "apple_pay", "google_pay", "credit_card", "cash"]
STRIPE_CHECKOUT_METHODS = {"nfc", "qr", "apple_pay", "google_pay", "credit_card"}
DIRECT_BOOKING_METHODS = {"wallet", "cash"}


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
        "bike": {"label": "E-Bike", "icon": "bike", "base": 0.55, "per_km": 0.22, "per_min": 0.04, "speed_factor": 1.32, "wallet_only": True},
        "ev": {"label": "EV Drive", "icon": "zap", "base": 4.2, "per_km": 0.42, "per_min": 0.08, "speed_factor": 1.08, "wallet_only": False},
        "car_sharing": {"label": "Carsharing", "icon": "car", "base": 2.8, "per_km": 0.36, "per_min": 0.11, "speed_factor": 1.02, "wallet_only": False},
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
    favorite_id: Optional[str] = Field(default=None, max_length=80)
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
    preferences: Optional[dict] = None


class MobilityBookingLocation(BaseModel):
    address: str = Field(..., min_length=2, max_length=280)
    lat: float
    lng: float


class MobilityBookingRequest(BaseModel):
    transport_type: str = Field(..., min_length=2, max_length=60)
    transport_label: str = Field(..., min_length=2, max_length=80)
    price_eur: float = Field(..., gt=0)
    duration_min: int = Field(..., gt=0)
    distance_km: float = Field(..., gt=0)
    payment_method: str = Field(default="wallet")
    pickup: MobilityBookingLocation
    dropoff: MobilityBookingLocation
    preferences: Optional[dict] = None
    ai_recommendation: Optional[dict] = None


class MobilityCheckoutSessionRequest(BaseModel):
    transport_type: str = Field(..., min_length=2, max_length=60)
    payment_method: str = Field(..., min_length=2, max_length=40)
    origin_url: str = Field(..., min_length=8, max_length=220)
    pickup: MobilityBookingLocation
    dropoff: MobilityBookingLocation
    preferences: Optional[dict] = None
    ai_recommendation: Optional[dict] = None


class MobilityPreferencesRequest(BaseModel):
    priority: str = Field(default="balance")
    luggage: bool = False
    childSeat: bool = False


class MobilityCompareSummaryRequest(BaseModel):
    pickup: MobilityBookingLocation
    dropoff: MobilityBookingLocation
    focus_modes: Optional[List[str]] = Field(default_factory=lambda: ["taxi", "scooter", "bike", "ev", "car_sharing", "car_rental"])


class BestRouteBookRequest(BaseModel):
    route_id: str
    transport_type: str
    payment_method: str = Field(default="wallet")


class FrequentRouteSaveRequest(BaseModel):
    label: str
    pickup: MobilityBookingLocation
    dropoff: MobilityBookingLocation
    preferred_transport_type: str = Field(default="taxi")
    payment_method: str = Field(default="wallet")


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


def _parse_iso_datetime(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value)
    except Exception:
        return None


def _normalize_route_points(geometry: Optional[list]) -> list[dict]:
    points = []
    for item in geometry or []:
        if not isinstance(item, (list, tuple)) or len(item) < 2:
            continue
        lng, lat = item[0], item[1]
        if lat is None or lng is None:
            continue
        points.append({"lat": float(lat), "lng": float(lng)})
    return points


def _interpolate_live_position(route_points: list[dict], ratio: float) -> Optional[dict]:
    if len(route_points) < 2:
        return route_points[0] if route_points else None

    clamped_ratio = max(0.0, min(1.0, ratio))
    segment_lengths = []
    total_length = 0.0
    for index in range(len(route_points) - 1):
        start = route_points[index]
        end = route_points[index + 1]
        segment = haversine_distance(start["lat"], start["lng"], end["lat"], end["lng"])
        segment_lengths.append(segment)
        total_length += segment

    if total_length <= 0:
        return route_points[-1]

    target_distance = total_length * clamped_ratio
    walked = 0.0
    for index, segment in enumerate(segment_lengths):
        if walked + segment >= target_distance:
            local_ratio = 0 if segment == 0 else (target_distance - walked) / segment
            start = route_points[index]
            end = route_points[index + 1]
            return {
                "lat": round(start["lat"] + ((end["lat"] - start["lat"]) * local_ratio), 6),
                "lng": round(start["lng"] + ((end["lng"] - start["lng"]) * local_ratio), 6),
            }
        walked += segment
    return route_points[-1]


def _build_tracking_timeline(status: str, live_status: str) -> list[dict]:
    order = ["payment_pending", "confirmed", "resource_assigned", "en_route", "almost_arrived", "completed"]
    current = live_status if live_status in order else status
    current_index = order.index(current) if current in order else 1
    labels = {
        "payment_pending": ("Checkout offen", "Zahlung wird bestätigt"),
        "confirmed": ("Buchung bestätigt", "Deine Mobility-Buchung ist aktiv"),
        "resource_assigned": ("Fahrzeug zugewiesen", "Ein passendes Fahrzeug ist für dich reserviert"),
        "en_route": ("Unterwegs", "Die Fahrt läuft live auf der Karte"),
        "almost_arrived": ("Fast da", "Die Ankunft steht kurz bevor"),
        "completed": ("Abgeschlossen", "Die Buchung wurde erfolgreich beendet"),
    }
    timeline = []
    for index, key in enumerate(order):
        label, detail = labels[key]
        timeline.append({
            "id": key,
            "label": label,
            "detail": detail,
            "done": current_index >= index,
            "active": current_index == index,
        })
    if status == "cancelled":
        timeline.append({
            "id": "cancelled",
            "label": "Storniert",
            "detail": "Diese Buchung wurde beendet, bevor sie abgeschlossen wurde.",
            "done": True,
            "active": True,
        })
    return timeline


def _build_tracking_payload(booking: dict, route_doc: Optional[dict]) -> dict:
    status = booking.get("tracking_status") or booking.get("status") or "confirmed"
    total_minutes = max(1, int(booking.get("duration_min") or 1))
    transport_type = booking.get("transport_type") or "taxi"
    created_at = _parse_iso_datetime(booking.get("confirmed_at") or booking.get("created_at"))
    now = datetime.now(timezone.utc)
    elapsed_minutes = 0.0
    if created_at:
        elapsed_minutes = max(0.0, (now - created_at).total_seconds() / 60)

    progress_profile = booking.get("live_progress_profile") or {}
    vehicle_phase = progress_profile.get("vehicle_phase") or ("approach" if transport_type in {"airport_shuttle", "vip"} else "trip")
    approach_ratio = float(progress_profile.get("approach_ratio") or (0.32 if transport_type == "airport_shuttle" else 0.24 if transport_type == "vip" else 0.18))
    stop_count = int(progress_profile.get("stop_count") or (2 if transport_type == "airport_shuttle" else 0))
    checkpoint_count = int(progress_profile.get("checkpoint_count") or (3 if transport_type == "vip" else 2 if transport_type == "airport_shuttle" else 0))
    if status == "cancelled":
        progress_percent = 0
    elif status == "completed":
        progress_percent = 100
    elif status == "payment_pending":
        progress_percent = 6
    else:
        progress_percent = max(12, min(96, round((elapsed_minutes / total_minutes) * 100)))

    if status == "cancelled":
        live_status = "cancelled"
        phase_label = "Buchung storniert"
        next_event_label = "Keine weiteren Live-Updates"
    elif status == "payment_pending":
        live_status = "payment_pending"
        phase_label = "Checkout abschließen"
        next_event_label = "Nach erfolgreicher Zahlung startet das Tracking automatisch"
    elif status == "completed":
        live_status = "completed"
        phase_label = "Ziel erreicht"
        next_event_label = "Danke für deine Buchung"
    elif progress_percent < 28:
        live_status = "resource_assigned"
        phase_label = "Fahrzeug wird bereitgestellt"
        next_event_label = "Der Fahrer fährt zur Abholung"
    elif progress_percent < 76:
        live_status = "en_route"
        phase_label = "Unterwegs auf deiner Route"
        next_event_label = "Nächster Schritt: Ankunft am Ziel"
    else:
        live_status = "almost_arrived"
        phase_label = "Fast am Ziel"
        next_event_label = "Bitte halte dein Ziel im Blick"

    eta_minutes = 0 if status == "completed" else max(0, int(round(total_minutes * max(0, 1 - (progress_percent / 100)))))
    route_points = _normalize_route_points((route_doc or {}).get("geometry") or [])
    live_position = None
    if live_status in {"resource_assigned", "en_route", "almost_arrived", "completed"}:
        live_position = _interpolate_live_position(route_points, 1 if status == "completed" else min(0.98, max(0.08, progress_percent / 100)))

    route_progress_ratio = min(1, max(0, progress_percent / 100))
    approach_progress_ratio = min(0.95, route_progress_ratio * max(0.18, approach_ratio))
    trip_progress_ratio = min(0.99, max(0.02, route_progress_ratio))
    if transport_type in {"airport_shuttle", "vip"} and live_status in {"resource_assigned", "en_route", "almost_arrived", "completed"}:
        if live_status == "resource_assigned":
            vehicle_phase = "approach"
        elif live_status in {"en_route", "almost_arrived", "completed"}:
            vehicle_phase = "trip"

    approach_position = _interpolate_live_position(route_points, approach_progress_ratio) if route_points else None
    trip_position = _interpolate_live_position(route_points, trip_progress_ratio) if route_points else None

    checkpoints = []
    if route_points and checkpoint_count > 0:
        for index in range(checkpoint_count):
            ratio = (index + 1) / (checkpoint_count + 1)
            point = _interpolate_live_position(route_points, ratio)
            checkpoints.append({
                "checkpoint_id": f"cp-{index + 1}",
                "label": f"Checkpoint {index + 1}",
                "lat": point.get("lat"),
                "lng": point.get("lng"),
                "passed": route_progress_ratio >= ratio,
            })

    shuttle_stops = []
    if transport_type == "airport_shuttle" and route_points and stop_count > 0:
        for index in range(stop_count):
            ratio = (index + 1) / (stop_count + 2)
            point = _interpolate_live_position(route_points, ratio)
            shuttle_stops.append({
                "stop_id": f"stop-{index + 1}",
                "label": f"Shuttle Stop {index + 1}",
                "lat": point.get("lat"),
                "lng": point.get("lng"),
                "served": route_progress_ratio >= ratio,
            })

    resource = {**(booking.get("assigned_resource") or {})}
    if live_position:
        resource["live_position"] = live_position
        resource.setdefault("lat", live_position["lat"])
        resource.setdefault("lng", live_position["lng"])
    if transport_type in {"airport_shuttle", "vip"}:
        if approach_position:
            resource["approach_position"] = approach_position
        if trip_position:
            resource["trip_position"] = trip_position

    return {
        "status": status,
        "live_status": live_status,
        "transport_type": transport_type,
        "phase_label": phase_label,
        "next_event_label": next_event_label,
        "eta_minutes": eta_minutes,
        "assigned_resource": resource,
        "support_channel": "/support-chat",
        "can_cancel": booking.get("status") in {"confirmed", "payment_pending"},
        "progress_percent": progress_percent,
        "vehicle_phase": vehicle_phase,
        "approach_progress_percent": min(100, round(approach_progress_ratio * 100)),
        "trip_progress_percent": min(100, round(trip_progress_ratio * 100)),
        "checkpoints": checkpoints,
        "shuttle_stops": shuttle_stops,
        "timeline": _build_tracking_timeline(status, live_status),
        "route_points": route_points,
    }


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
        "Die Werte im Feld best_option_type und secondary_option_type müssen exakt einem dieser Types entsprechen: taxi, scooter, bike, ev, car_sharing, car_rental, airport_shuttle, vip.\n"
        "Antwortformat:\n"
        "{\n"
        '  "headline": "kurze Headline",\n'
        '  "summary": "1-2 Sätze Empfehlung",\n'
        '  "reason_short": "kurzer Hauptgrund",\n'
        '  "best_option_type": "taxi|scooter|bike|ev|car_sharing|car_rental|airport_shuttle|vip",\n'
        '  "secondary_option_type": "taxi|scooter|bike|ev|car_sharing|car_rental|airport_shuttle|vip",\n'
        '  "watchouts": ["Hinweis 1", "Hinweis 2"],\n'
        '  "confidence": 0-100\n'
        "}\n\n"
        f"Pickup: {payload.pickup_address}\n"
        f"Dropoff: {payload.dropoff_address}\n"
        f"Gesamtdistanz: {round(payload.distance_km, 2)} km\n"
        f"Basisdauer: {payload.duration_min} Minuten\n"
        f"Nutzerpräferenzen: {json.dumps(payload.preferences or {}, ensure_ascii=False)}\n"
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


async def _compute_route_payload(
    pickup_lat: float,
    pickup_lng: float,
    dropoff_lat: float,
    dropoff_lng: float,
    pickup_address: str,
    dropoff_address: str,
):
    coords = f"{pickup_lng},{pickup_lat};{dropoff_lng},{dropoff_lat}"
    distance_km = haversine_distance(pickup_lat, pickup_lng, dropoff_lat, dropoff_lng)
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
        build_option("bike", distance_km, duration_min, 1.0, 94),
        build_option("ev", distance_km, duration_min, 1.0, 92),
        build_option("car_sharing", distance_km, duration_min, 1.0, 64),
        build_option("car_rental", distance_km, duration_min, 1.0, 48),
        build_option("airport_shuttle", distance_km, duration_min, 1.0, 63),
        build_option("vip", distance_km, duration_min, 1.08, 28),
    ]
    return {
        "distance_km": round(distance_km, 2),
        "duration_min": duration_min,
        "geometry": route.get("geometry", {}).get("coordinates", []),
        "pickup": {"address": pickup_address, "lat": pickup_lat, "lng": pickup_lng},
        "dropoff": {"address": dropoff_address, "lat": dropoff_lat, "lng": dropoff_lng},
        "options": options,
        "recommendations": build_recommendations(options),
    }


def _find_option(options: list[dict], transport_type: str):
    return next((item for item in options if item.get("type") == transport_type), None)


def _focus_mode_cards(route_payload: dict, focus_modes: Optional[list[str]] = None) -> list[dict]:
    focus = [mode for mode in (focus_modes or ["taxi", "scooter", "bike", "ev", "car_sharing", "car_rental"]) if mode]
    cards = [item for item in route_payload.get("options") or [] if item.get("type") in focus]
    cards.sort(key=lambda item: focus.index(item.get("type")) if item.get("type") in focus else 999)
    if not cards:
        return []

    cheapest = min(cards, key=lambda item: item.get("price_eur") or 0)
    fastest = min(cards, key=lambda item: item.get("duration_min") or 0)
    eco = max(cards, key=lambda item: item.get("eco_score") or 0)
    balance = min(cards, key=lambda item: (item.get("price_eur") or 0) * 0.45 + (item.get("duration_min") or 0) * 0.55)
    taxi_option = _find_option(cards, "taxi") or cheapest

    summary_cards = []
    for item in cards:
        tags = []
        if item.get("type") == cheapest.get("type"):
            tags.append("Günstigste")
        if item.get("type") == fastest.get("type"):
            tags.append("Schnellste")
        if item.get("type") == eco.get("type"):
            tags.append("Eco")
        if item.get("type") == balance.get("type"):
            tags.append("Beste Balance")
        summary_cards.append({
            "type": item.get("type"),
            "label": item.get("label"),
            "price_eur": _round_money(item.get("price_eur") or 0),
            "duration_min": int(item.get("duration_min") or 0),
            "distance_km": round(float(item.get("distance_km") or 0), 2),
            "eco_score": int(item.get("eco_score") or 0),
            "price_delta_vs_taxi": _round_money((item.get("price_eur") or 0) - (taxi_option.get("price_eur") or 0)),
            "time_delta_vs_taxi": int((item.get("duration_min") or 0) - (taxi_option.get("duration_min") or 0)),
            "tags": tags,
        })

    return summary_cards


def _build_compare_summary(route_payload: dict, focus_modes: Optional[list[str]] = None) -> dict:
    cards = _focus_mode_cards(route_payload, focus_modes)
    if not cards:
        return {
            "cards": [],
            "best": {},
            "route": {
                "pickup": route_payload.get("pickup") or {},
                "dropoff": route_payload.get("dropoff") or {},
                "distance_km": round(float(route_payload.get("distance_km") or 0), 2),
                "duration_min": int(route_payload.get("duration_min") or 0),
            },
        }

    cheapest = min(cards, key=lambda item: item["price_eur"])
    fastest = min(cards, key=lambda item: item["duration_min"])
    eco = max(cards, key=lambda item: item["eco_score"])
    balance = min(cards, key=lambda item: item["price_eur"] * 0.45 + item["duration_min"] * 0.55)
    return {
        "route": {
            "pickup": route_payload.get("pickup") or {},
            "dropoff": route_payload.get("dropoff") or {},
            "distance_km": round(float(route_payload.get("distance_km") or 0), 2),
            "duration_min": int(route_payload.get("duration_min") or 0),
        },
        "cards": cards,
        "best": {
            "cheapest": {"type": cheapest["type"], "label": cheapest["label"], "reason": "Niedrigster Preis"},
            "fastest": {"type": fastest["type"], "label": fastest["label"], "reason": "Kürzeste ETA"},
            "eco": {"type": eco["type"], "label": eco["label"], "reason": "Beste Eco-Bilanz"},
            "balance": {"type": balance["type"], "label": balance["label"], "reason": "Preis und Zeit am ausgewogensten"},
        },
    }


async def _store_route_snapshot(
    user_id: Optional[str],
    route_payload: dict,
    source: str,
    preferences: Optional[dict] = None,
    transport_type: Optional[str] = None,
):
    route_id = f"route-{uuid4().hex[:12]}"
    now = datetime.now(timezone.utc).isoformat()
    route_doc = {
        "route_id": route_id,
        "user_id": user_id,
        "source": source,
        "transport_type": transport_type,
        "pickup": route_payload.get("pickup") or {},
        "dropoff": route_payload.get("dropoff") or {},
        "distance_km": round(float(route_payload.get("distance_km") or 0), 2),
        "duration_min": int(route_payload.get("duration_min") or 0),
        "geometry": route_payload.get("geometry") or [],
        "options": route_payload.get("options") or [],
        "recommendations": route_payload.get("recommendations") or {},
        "preferences": preferences or {},
        "created_at": now,
    }
    await db.mobility_routes.insert_one(route_doc)
    return route_doc


async def _upsert_trip_snapshot(booking: dict):
    booking_id = booking.get("booking_id")
    if not booking_id:
        return
    now = datetime.now(timezone.utc).isoformat()
    trip_doc = {
        "trip_id": booking_id,
        "booking_id": booking_id,
        "user_id": booking.get("user_id"),
        "transport_type": booking.get("transport_type"),
        "transport_label": booking.get("transport_label"),
        "status": booking.get("status"),
        "tracking_status": booking.get("tracking_status"),
        "payment_method": booking.get("payment_method"),
        "payment_status": booking.get("payment_status"),
        "price_eur": booking.get("price_eur"),
        "distance_km": booking.get("distance_km"),
        "duration_min": booking.get("duration_min"),
        "pickup": booking.get("pickup") or {},
        "dropoff": booking.get("dropoff") or {},
        "preferences": booking.get("preferences") or {},
        "ai_recommendation": booking.get("ai_recommendation") or {},
        "route_id": booking.get("route_id"),
        "assigned_resource": booking.get("assigned_resource") or None,
        "updated_at": now,
    }
    await db.mobility_trips.update_one(
        {"booking_id": booking_id},
        {"$set": trip_doc, "$setOnInsert": {"created_at": booking.get("created_at") or now}},
        upsert=True,
    )


async def _build_frequent_route_cards(user_id: str, limit: int = 6) -> list[dict]:
    pipeline = [
        {"$match": {"user_id": user_id, "status": {"$in": ["confirmed", "payment_pending", "completed", "in_progress"]}}},
        {"$group": {
            "_id": {
                "pickup": "$pickup.address",
                "dropoff": "$dropoff.address",
                "transport_type": "$transport_type",
            },
            "count": {"$sum": 1},
            "last_used_at": {"$max": "$created_at"},
            "avg_price": {"$avg": "$price_eur"},
            "avg_duration": {"$avg": "$duration_min"},
            "pickup": {"$first": "$pickup"},
            "dropoff": {"$first": "$dropoff"},
            "transport_label": {"$first": "$transport_label"},
            "payment_method": {"$first": "$payment_method"},
            "last_route_id": {"$first": "$route_id"},
            "last_booking_id": {"$first": "$booking_id"},
        }},
        {"$sort": {"count": -1, "last_used_at": -1}},
        {"$limit": limit},
    ]
    saved = await db.mobility_frequent_routes.find({"user_id": user_id}, {"_id": 0}).sort("updated_at", -1).limit(limit).to_list(limit)
    rows = await db.mobility_bookings.aggregate(pipeline).to_list(limit)
    cards = []
    for item in saved:
        cards.append({
            "route_id": item.get("route_id"),
            "source_route_id": item.get("source_route_id"),
            "source_booking_id": item.get("source_booking_id"),
            "label": item.get("label") or f"{(item.get('pickup') or {}).get('address', 'Start')} → {(item.get('dropoff') or {}).get('address', 'Ziel')}",
            "pickup": item.get("pickup") or {},
            "dropoff": item.get("dropoff") or {},
            "transport_type": item.get("transport_type") or "taxi",
            "transport_label": item.get("transport_label") or "Mobility Ride",
            "payment_method": item.get("payment_method") or "wallet",
            "usage_count": int(item.get("usage_count") or 0),
            "avg_price_eur": _round_money(item.get("avg_price_eur") or 0),
            "avg_duration_min": int(item.get("avg_duration_min") or 0),
            "last_used_at": item.get("updated_at"),
            "is_saved": True,
        })
    for item in rows:
        cards.append({
            "route_id": f"freq-{str(item.get('last_booking_id') or uuid4().hex[:10])}",
            "source_route_id": item.get("last_route_id"),
            "source_booking_id": item.get("last_booking_id"),
            "label": f"{(item.get('pickup') or {}).get('address', 'Start')} → {(item.get('dropoff') or {}).get('address', 'Ziel')}",
            "pickup": item.get("pickup") or {},
            "dropoff": item.get("dropoff") or {},
            "transport_type": item.get("_id", {}).get("transport_type") or "taxi",
            "transport_label": item.get("transport_label") or "Mobility Ride",
            "payment_method": item.get("payment_method") or "wallet",
            "usage_count": int(item.get("count") or 0),
            "avg_price_eur": _round_money(item.get("avg_price") or 0),
            "avg_duration_min": int(round(item.get("avg_duration") or 0)),
            "last_used_at": item.get("last_used_at"),
            "is_saved": False,
        })
    deduped = []
    seen = set()
    for item in cards:
        key = (item.get("pickup", {}).get("address"), item.get("dropoff", {}).get("address"), item.get("transport_type"))
        if key in seen:
            continue
        seen.add(key)
        deduped.append(item)
    return deduped[:limit]


async def _sync_nearby_inventory(markers: list[dict], counts: dict, lat: float, lng: float):
    now = datetime.now(timezone.utc).isoformat()
    await db.mobility_drivers.update_one(
        {"driver_id": "availability-summary"},
        {"$set": {
            "driver_id": "availability-summary",
            "type": "availability_summary",
            "center": {"lat": lat, "lng": lng},
            "live_counts": counts,
            "updated_at": now,
        }},
        upsert=True,
    )

    for marker in markers:
        base_doc = {
            "label": marker.get("label"),
            "type": marker.get("type"),
            "lat": marker.get("lat"),
            "lng": marker.get("lng"),
            "distance_km": marker.get("distance_km"),
            "subtitle": marker.get("subtitle"),
            "payment_methods": marker.get("payment_methods") or TRANSPORT_PAYMENT_METHODS,
            "updated_at": now,
        }
        if marker.get("type") == "taxi":
            await db.mobility_drivers.update_one(
                {"driver_id": marker.get("id")},
                {"$set": {"driver_id": marker.get("id"), **base_doc, "eta_minutes": marker.get("eta_minutes")}},
                upsert=True,
            )
        else:
            await db.mobility_vehicles.update_one(
                {"vehicle_id": marker.get("id")},
                {"$set": {"vehicle_id": marker.get("id"), **base_doc, "price_hint": marker.get("price_hint"), "battery_percent": marker.get("battery_percent")}},
                upsert=True,
            )

    for item in [
        {"vehicle_id": "bike-on-demand", "type": "bike", "label": "Fahrrad", "subtitle": "On-demand verfügbar"},
        {"vehicle_id": "airport-shuttle-on-demand", "type": "airport_shuttle", "label": "Airport Shuttle", "subtitle": "Direkt zum Terminal"},
        {"vehicle_id": "vip-chauffeur-on-demand", "type": "vip", "label": "VIP Chauffeur", "subtitle": "Premium on-demand"},
    ]:
        await db.mobility_vehicles.update_one(
            {"vehicle_id": item["vehicle_id"]},
            {"$set": {
                **item,
                "lat": lat,
                "lng": lng,
                "distance_km": 0,
                "payment_methods": TRANSPORT_PAYMENT_METHODS,
                "updated_at": now,
            }},
            upsert=True,
        )


async def _migrate_legacy_favorites(user_id: str):
    existing = await db.mobility_favorites.count_documents({"user_id": user_id}, limit=1)
    if existing:
        return
    legacy_items = await db.mobility_saved_locations.find({"user_id": user_id}, {"_id": 0}).to_list(50)
    for item in legacy_items:
        favorite_id = item.get("favorite_id") or (item.get("label") if item.get("label") in {"home", "work"} else f"fav-{uuid4().hex[:10]}")
        await db.mobility_favorites.update_one(
            {"user_id": user_id, "favorite_id": favorite_id},
            {"$set": {
                "user_id": user_id,
                "favorite_id": favorite_id,
                "label": item.get("label") or "Favorit",
                "address": item.get("address"),
                "lat": item.get("lat"),
                "lng": item.get("lng"),
                "kind": item.get("kind") or "favorite",
                "updated_at": item.get("updated_at") or datetime.now(timezone.utc).isoformat(),
            }, "$setOnInsert": {"created_at": item.get("updated_at") or datetime.now(timezone.utc).isoformat()}},
            upsert=True,
        )


async def _assign_booking_resource(transport_type: str, pickup: dict):
    nearby = await get_nearby_mobility(pickup["lat"], pickup["lng"], 6)
    marker = next((item for item in nearby.get("markers", []) if item.get("type") == transport_type), None)
    if not marker:
        return None
    return {
        "resource_id": marker.get("id"),
        "label": marker.get("label"),
        "subtitle": marker.get("subtitle"),
        "lat": marker.get("lat"),
        "lng": marker.get("lng"),
        "eta_minutes": marker.get("eta_minutes") or max(2, round((marker.get("distance_km") or 1) * 3)),
    }


def _build_live_progress_profile(transport_type: str, duration_min: Any, distance_km: Any) -> dict:
    duration_value = max(1, int(duration_min or 1))
    distance_value = max(0.1, float(distance_km or 0.1))
    if transport_type == "airport_shuttle":
        return {
            "vehicle_phase": "approach",
            "approach_ratio": 0.38,
            "stop_count": 2 if distance_value >= 6 else 1,
            "checkpoint_count": 3,
            "dispatch_buffer_min": max(3, min(10, round(duration_value * 0.18))),
        }
    if transport_type == "vip":
        return {
            "vehicle_phase": "approach",
            "approach_ratio": 0.28,
            "stop_count": 0,
            "checkpoint_count": 3,
            "dispatch_buffer_min": max(2, min(8, round(duration_value * 0.12))),
        }
    return {
        "vehicle_phase": "trip",
        "approach_ratio": 0.18,
        "stop_count": 0,
        "checkpoint_count": 0,
        "dispatch_buffer_min": max(1, min(5, round(duration_value * 0.08))),
    }


async def _confirm_booking_after_external_payment(booking_id: str, session_id: str):
    booking = await db.mobility_bookings.find_one({"booking_id": booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(404, "Buchung nicht gefunden")
    if booking.get("status") == "confirmed":
        return booking
    assignment = await _assign_booking_resource(booking.get("transport_type"), booking.get("pickup") or {})
    await db.mobility_bookings.update_one(
        {"booking_id": booking_id},
        {"$set": {
            "status": "confirmed",
            "payment_status": "paid",
            "assigned_resource": assignment,
            "tracking_status": "confirmed",
            "confirmed_at": datetime.now(timezone.utc).isoformat(),
            "stripe_session_id": session_id,
        }},
    )
    updated = await db.mobility_bookings.find_one({"booking_id": booking_id}, {"_id": 0})
    await _upsert_trip_snapshot(updated)
    return updated


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
    try:
        payload = await _compute_route_payload(
            req.pickup_lat,
            req.pickup_lng,
            req.dropoff_lat,
            req.dropoff_lng,
            req.pickup_address,
            req.dropoff_address,
        )
        await _store_route_snapshot(None, payload, "route_preview")
        return payload
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(502, f"Routing nicht erreichbar: {exc}")


@router.post("/ai-recommendation")
async def mobility_ai_recommendation(req: MobilityAiRecommendationRequest):
    if not req.options:
        raise HTTPException(400, "Keine Transportoptionen für AI-Empfehlung übergeben")
    return await _generate_ai_route_recommendation(req)


@router.post("/compare-summary")
async def get_compare_summary(req: MobilityCompareSummaryRequest, request: Request):
    user = await get_current_user(request)
    try:
        payload = await _compute_route_payload(
            req.pickup.lat,
            req.pickup.lng,
            req.dropoff.lat,
            req.dropoff.lng,
            req.pickup.address,
            req.dropoff.address,
        )
        await _store_route_snapshot(str(user["_id"]), payload, "mobility_center_compare", transport_type="comparison")
        return _build_compare_summary(payload, req.focus_modes)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(502, f"Vergleich aktuell nicht erreichbar: {exc}")


@router.get("/preferences")
async def get_mobility_preferences(request: Request):
    user = await get_current_user(request)
    return {
        "preferences": user.get("mobility_preferences") or {"priority": "balance", "luggage": False, "childSeat": False}
    }


@router.post("/preferences")
async def save_mobility_preferences(req: MobilityPreferencesRequest, request: Request):
    user = await get_current_user(request)
    prefs = req.model_dump()
    await db.users.update_one({"_id": user["_id"]}, {"$set": {"mobility_preferences": prefs}})
    return {"ok": True, "preferences": prefs}


@router.post("/book")
async def create_mobility_booking(req: MobilityBookingRequest, request: Request):
    user = await get_current_user(request)
    user_id = str(user["_id"])

    if req.payment_method not in DIRECT_BOOKING_METHODS:
        raise HTTPException(400, "Direktbuchung ist nur mit Wallet oder Cash verfügbar")

    route_payload = await _compute_route_payload(
        req.pickup.lat,
        req.pickup.lng,
        req.dropoff.lat,
        req.dropoff.lng,
        req.pickup.address,
        req.dropoff.address,
    )
    option = _find_option(route_payload["options"], req.transport_type)
    if not option:
        raise HTTPException(404, "Transportart nicht verfügbar")
    route_doc = await _store_route_snapshot(user_id, route_payload, "direct_booking", req.preferences, req.transport_type)

    from routes.mobility_payments import process_payment

    booking_id = f"mob-{uuid4().hex[:12]}"
    assignment = await _assign_booking_resource(req.transport_type, req.pickup.model_dump())
    payment_result = None
    payment_status = "cash_due" if req.payment_method == "cash" else "paid"
    payment_id = None
    if req.payment_method == "wallet":
        payment_result = await process_payment(
            user_id=user_id,
            amount=round(option["price_eur"], 2),
            payment_type="mobility_booking",
            reference_id=booking_id,
            reference_type="mobility_booking",
            description=f"{option['label']} · {req.pickup.address} → {req.dropoff.address}",
            commission_category=req.transport_type,
        )
        payment_id = ((payment_result or {}).get("payment") or {}).get("payment_id")
    else:
        payment_id = f"cash-{uuid4().hex[:12]}"
        now = datetime.now(timezone.utc).isoformat()
        await db.payment_transactions.insert_one({
            "transaction_id": payment_id,
            "session_id": payment_id,
            "user_id": user_id,
            "user_email": user.get("email"),
            "amount": float(option["price_eur"]),
            "currency": "eur",
            "type": "mobility_booking",
            "status": "cash_due",
            "payment_status": "cash_due",
            "metadata": {
                "type": "mobility_booking",
                "booking_id": booking_id,
                "transport_type": req.transport_type,
                "payment_method": "cash",
            },
            "created_at": now,
            "updated_at": now,
        })

    booking = {
        "booking_id": booking_id,
        "user_id": user_id,
        "user_email": user.get("email"),
        "transport_type": option["type"],
        "transport_label": option["label"],
        "price_eur": round(option["price_eur"], 2),
        "duration_min": option["duration_min"],
        "distance_km": round(option["distance_km"], 2),
        "payment_method": req.payment_method,
        "payment_status": payment_status,
        "payment_id": payment_id,
        "status": "confirmed",
        "tracking_status": "confirmed",
        "route_id": route_doc["route_id"],
        "assigned_resource": assignment,
        "live_progress_profile": _build_live_progress_profile(option["type"], option["duration_min"], option["distance_km"]),
        "pickup": req.pickup.model_dump(),
        "dropoff": req.dropoff.model_dump(),
        "preferences": req.preferences or {},
        "ai_recommendation": req.ai_recommendation or {},
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.mobility_bookings.insert_one(booking)
    await _upsert_trip_snapshot(booking)
    booking_response = {**booking}
    booking_response.pop("_id", None)

    return {
        "ok": True,
        "booking": booking_response,
        "new_balance": payment_result.get("new_balance") if payment_result else None,
    }


@router.get("/my-bookings")
async def get_my_mobility_bookings(request: Request):
    user = await get_current_user(request)
    bookings = await db.mobility_bookings.find(
        {"user_id": str(user["_id"])},
        {"_id": 0},
    ).sort("created_at", -1).limit(20).to_list(20)
    return {"bookings": bookings}


@router.get("/frequent-routes")
async def get_frequent_routes(request: Request):
    user = await get_current_user(request)
    items = await _build_frequent_route_cards(str(user["_id"]))
    return {"routes": items}


@router.post("/frequent-routes")
async def save_frequent_route(req: FrequentRouteSaveRequest, request: Request):
    user = await get_current_user(request)
    user_id = str(user["_id"])
    now = datetime.now(timezone.utc).isoformat()
    route_id = f"fr-{uuid4().hex[:12]}"
    doc = {
        "route_id": route_id,
        "user_id": user_id,
        "label": req.label,
        "pickup": req.pickup.model_dump(),
        "dropoff": req.dropoff.model_dump(),
        "transport_type": req.preferred_transport_type,
        "transport_label": req.preferred_transport_type.replace("_", " ").title(),
        "payment_method": req.payment_method,
        "usage_count": 1,
        "avg_price_eur": 0,
        "avg_duration_min": 0,
        "updated_at": now,
        "created_at": now,
    }
    await db.mobility_frequent_routes.update_one(
        {"user_id": user_id, "label": req.label},
        {"$set": doc},
        upsert=True,
    )
    return {"ok": True, "route_id": route_id}


@router.post("/best-route-book")
async def book_best_route(req: BestRouteBookRequest, request: Request):
    user = await get_current_user(request)
    user_id = str(user["_id"])
    frequent = await db.mobility_frequent_routes.find_one({"route_id": req.route_id, "user_id": user_id}, {"_id": 0})
    source = frequent
    if not source:
        candidates = await _build_frequent_route_cards(user_id, limit=8)
        source = next((item for item in candidates if item.get("route_id") == req.route_id), None)
    if not source:
        raise HTTPException(404, "Frequent Route nicht gefunden")

    route_payload = await _compute_route_payload(
        source["pickup"]["lat"],
        source["pickup"]["lng"],
        source["dropoff"]["lat"],
        source["dropoff"]["lng"],
        source["pickup"]["address"],
        source["dropoff"]["address"],
    )
    option = _find_option(route_payload["options"], req.transport_type or source.get("transport_type") or "taxi")
    if not option:
        raise HTTPException(404, "Transportart nicht verfügbar")
    route_doc = await _store_route_snapshot(user_id, route_payload, "frequent_route_rebook", transport_type=option["type"])
    ai_recommendation = await _generate_ai_route_recommendation(MobilityAiRecommendationRequest(
        pickup_address=source["pickup"]["address"],
        dropoff_address=source["dropoff"]["address"],
        distance_km=route_payload["distance_km"],
        duration_min=route_payload["duration_min"],
        options=route_payload["options"],
        recommendations=route_payload["recommendations"],
        preferences={"source": "frequent_route"},
    ))

    payment_result = None
    if req.payment_method == "wallet":
        payment_result = await debit_wallet(
            user_id=user_id,
            amount=float(option["price_eur"]),
            tx_type=TransactionType.PAYMENT,
            description=f"Mobility Rebook: {option['label']}",
            reference=f"MOB-FREQ-{uuid4().hex[:8].upper()}",
            metadata={"type": "mobility_rebook", "route_id": req.route_id, "transport_type": option["type"]},
        )
        if not payment_result.success:
            raise HTTPException(400, payment_result.error or "Wallet-Zahlung fehlgeschlagen")

    booking_id = f"mob-{uuid4().hex[:12]}"
    now = datetime.now(timezone.utc).isoformat()
    booking = {
        "booking_id": booking_id,
        "user_id": user_id,
        "transport_type": option["type"],
        "transport_label": option["label"],
        "price_eur": option["price_eur"],
        "distance_km": option["distance_km"],
        "duration_min": option["duration_min"],
        "pickup": source["pickup"],
        "dropoff": source["dropoff"],
        "preferences": {"source": "frequent_route", "route_id": req.route_id},
        "payment_method": req.payment_method,
        "payment_status": "paid" if req.payment_method == "wallet" else "pending",
        "status": "confirmed" if req.payment_method == "wallet" else "payment_pending",
        "tracking_status": "confirmed" if req.payment_method == "wallet" else "payment_pending",
        "route_id": route_doc["route_id"],
        "assigned_resource": await _assign_booking_resource(option["type"], source["pickup"]),
        "live_progress_profile": _build_live_progress_profile(option["type"], option["duration_min"], option["distance_km"]),
        "ai_recommendation": ai_recommendation,
        "created_at": now,
        "updated_at": now,
    }
    await db.mobility_bookings.insert_one(booking)
    await _upsert_trip_snapshot(booking)
    booking_response = {k: v for k, v in booking.items() if k != "_id"}
    await db.mobility_frequent_routes.update_one(
        {"user_id": user_id, "label": source.get("label") or f"{source['pickup']['address']} → {source['dropoff']['address']}"},
        {"$set": {
            "route_id": source.get("route_id") if str(source.get("route_id", "")).startswith("fr-") else f"fr-{uuid4().hex[:12]}",
            "user_id": user_id,
            "label": source.get("label") or f"{source['pickup']['address']} → {source['dropoff']['address']}",
            "pickup": source["pickup"],
            "dropoff": source["dropoff"],
            "transport_type": option["type"],
            "transport_label": option["label"],
            "payment_method": req.payment_method,
            "source_route_id": route_doc["route_id"],
            "source_booking_id": booking_id,
            "avg_price_eur": option["price_eur"],
            "avg_duration_min": option["duration_min"],
            "updated_at": now,
        }, "$inc": {"usage_count": 1}},
        upsert=True,
    )
    return {"ok": True, "booking": booking_response, "new_balance": payment_result.new_balance if payment_result else None}


@router.post("/checkout/session")
async def create_mobility_checkout_session(req: MobilityCheckoutSessionRequest, request: Request):
    user = await get_current_user(request)
    user_id = str(user["_id"])
    if req.payment_method not in STRIPE_CHECKOUT_METHODS:
        raise HTTPException(400, "Diese Checkout-Methode läuft nicht über Stripe")
    route_payload = await _compute_route_payload(
        req.pickup.lat,
        req.pickup.lng,
        req.dropoff.lat,
        req.dropoff.lng,
        req.pickup.address,
        req.dropoff.address,
    )
    option = _find_option(route_payload["options"], req.transport_type)
    if not option:
        raise HTTPException(404, "Transportart nicht verfügbar")
    route_doc = await _store_route_snapshot(user_id, route_payload, "stripe_checkout", req.preferences, req.transport_type)

    booking_id = f"mob-{uuid4().hex[:12]}"
    origin = req.origin_url.rstrip("/")
    success_url = f"{origin}/mobility-map?mobility_session_id={{CHECKOUT_SESSION_ID}}&mobility_booking_id={booking_id}"
    cancel_url = f"{origin}/mobility-map?mobility_booking_cancelled={booking_id}"
    host_url = str(request.base_url).rstrip("/")
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=f"{host_url}/api/webhook/stripe")

    checkout_request = CheckoutSessionRequest(
        amount=float(option["price_eur"]),
        currency="eur",
        success_url=success_url,
        cancel_url=cancel_url,
        payment_methods=["card"],
        metadata={
            "type": "mobility_booking",
            "booking_id": booking_id,
            "user_id": user_id,
            "transport_type": req.transport_type,
            "payment_method": req.payment_method,
        },
    )
    session = await stripe_checkout.create_checkout_session(checkout_request)

    booking_doc = {
        "booking_id": booking_id,
        "user_id": user_id,
        "user_email": user.get("email"),
        "transport_type": option["type"],
        "transport_label": option["label"],
        "price_eur": round(option["price_eur"], 2),
        "duration_min": option["duration_min"],
        "distance_km": round(option["distance_km"], 2),
        "payment_method": req.payment_method,
        "payment_status": "pending",
        "status": "payment_pending",
        "tracking_status": "payment_pending",
        "route_id": route_doc["route_id"],
        "pickup": req.pickup.model_dump(),
        "dropoff": req.dropoff.model_dump(),
        "live_progress_profile": _build_live_progress_profile(option["type"], option["duration_min"], option["distance_km"]),
        "preferences": req.preferences or {},
        "ai_recommendation": req.ai_recommendation or {},
        "stripe_session_id": session.session_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.mobility_bookings.insert_one(booking_doc)
    await _upsert_trip_snapshot(booking_doc)
    await db.payment_transactions.insert_one({
        "transaction_id": f"stripe-{uuid4().hex[:12]}",
        "session_id": session.session_id,
        "user_id": user_id,
        "user_email": user.get("email"),
        "amount": float(option["price_eur"]),
        "currency": "eur",
        "type": "mobility_booking",
        "status": "initiated",
        "payment_status": "pending",
        "metadata": {
            "type": "mobility_booking",
            "booking_id": booking_id,
            "transport_type": option["type"],
            "payment_method": req.payment_method,
        },
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    })
    return {"checkout_url": session.url, "session_id": session.session_id, "booking_id": booking_id}


@router.get("/checkout/status/{session_id}")
async def get_mobility_checkout_status(session_id: str, request: Request):
    user = await get_current_user(request)
    txn = await db.payment_transactions.find_one({"session_id": session_id, "user_id": str(user["_id"])}, {"_id": 0})
    if not txn:
        raise HTTPException(404, "Checkout nicht gefunden")
    host_url = str(request.base_url).rstrip("/")
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=f"{host_url}/api/webhook/stripe")
    status = await stripe_checkout.get_checkout_status(session_id)
    await db.payment_transactions.update_one(
        {"session_id": session_id},
        {"$set": {
            "status": status.status,
            "payment_status": status.payment_status,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }},
    )
    booking = None
    booking_id = (txn.get("metadata") or {}).get("booking_id")
    if status.payment_status == "paid" and booking_id:
        booking = await _confirm_booking_after_external_payment(booking_id, session_id)
    return {
        "status": status.status,
        "payment_status": status.payment_status,
        "amount_total": status.amount_total,
        "currency": status.currency,
        "metadata": status.metadata,
        "booking": booking,
    }


@router.get("/booking/{booking_id}")
async def get_mobility_booking_detail(booking_id: str, request: Request):
    user = await get_current_user(request)
    booking = await db.mobility_bookings.find_one({"booking_id": booking_id, "user_id": str(user["_id"])}, {"_id": 0})
    if not booking:
        raise HTTPException(404, "Buchung nicht gefunden")
    route_doc = None
    if booking.get("route_id"):
        route_doc = await db.mobility_routes.find_one({"route_id": booking.get("route_id")}, {"_id": 0, "geometry": 1})
    tracking = _build_tracking_payload(booking, route_doc)
    return {
        "booking": booking,
        "tracking": tracking,
    }


@router.post("/booking/{booking_id}/cancel")
async def cancel_mobility_booking(booking_id: str, request: Request):
    user = await get_current_user(request)
    booking = await db.mobility_bookings.find_one({"booking_id": booking_id, "user_id": str(user["_id"])}, {"_id": 0})
    if not booking:
        raise HTTPException(404, "Buchung nicht gefunden")
    if booking.get("status") not in {"confirmed", "payment_pending"}:
        raise HTTPException(400, "Buchung kann nicht mehr storniert werden")
    await db.mobility_bookings.update_one(
        {"booking_id": booking_id},
        {"$set": {"status": "cancelled", "tracking_status": "cancelled", "cancelled_at": datetime.now(timezone.utc).isoformat()}},
    )
    await db.payment_transactions.update_many(
        {"metadata.booking_id": booking_id},
        {"$set": {"status": "cancelled", "payment_status": "cancelled", "updated_at": datetime.now(timezone.utc).isoformat()}},
    )
    updated = await db.mobility_bookings.find_one({"booking_id": booking_id}, {"_id": 0})
    await _upsert_trip_snapshot(updated)
    return {"ok": True, "booking_id": booking_id, "status": "cancelled"}


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

    ev_rows = await db.charging_stations.find(
        {"status": {"$in": ["available", "active", "online"]}},
        {"_id": 0, "station_id": 1, "name": 1, "address": 1, "city": 1, "lat": 1, "lng": 1, "connector_types": 1},
    ).to_list(120)

    markers = []
    counts = {"taxi": 0, "scooter": 0, "bike": 0, "ev": 0, "car_sharing": 0, "car_rental": 0}

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

    ebike_seed = [
        item for item in markers
        if item.get("type") == "scooter"
    ][:3]
    for index, seed in enumerate(ebike_seed):
        counts["bike"] += 1
        lat_offset = seed.get("lat", lat) + ((index + 1) * 0.00012)
        lng_offset = seed.get("lng", lng) - ((index + 1) * 0.0001)
        markers.append(_service_marker(
            "bike",
            f"ebike-{index + 1}",
            f"E-Bike Hub {index + 1}",
            lat_offset,
            lng_offset,
            distance_km=round(haversine_distance(lat, lng, lat_offset, lng_offset), 2),
            battery_percent=seed.get("battery_percent") or 82,
            subtitle="Leise, schnell und direkt für Kurzstrecken",
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

    for index, car in enumerate(car_rows[:3]):
        clat = car.get("lat")
        clng = car.get("lng")
        if not clat or not clng:
            continue
        counts["car_sharing"] += 1
        markers.append(_service_marker(
            "car_sharing",
            f"share-{car.get('car_id') or index + 1}",
            f"Carsharing {car.get('brand') or ''} {car.get('model') or ''}".strip(),
            clat + ((index + 1) * 0.00008),
            clng + ((index + 1) * 0.00006),
            distance_km=round(haversine_distance(lat, lng, clat, clng), 2),
            price_hint=_round_money((car.get("price_per_day") or 12) / 12),
            subtitle="Flexible Minuten- oder Stundenfahrt",
            image_url=car.get("main_image"),
            payment_methods=TRANSPORT_PAYMENT_METHODS,
        ))

    for station in ev_rows:
        elat = station.get("lat")
        elng = station.get("lng")
        if not elat or not elng:
            continue
        distance_km = haversine_distance(lat, lng, elat, elng)
        if distance_km > radius_km:
            continue
        counts["ev"] += 1
        markers.append(_service_marker(
            "ev",
            station.get("station_id") or f"ev-{counts['ev']}",
            station.get("name") or "EV Hub",
            elat,
            elng,
            distance_km=round(distance_km, 2),
            subtitle=station.get("city") or station.get("address") or "EV Charging & Pick-up",
            payment_methods=TRANSPORT_PAYMENT_METHODS,
        ))

    markers.sort(key=lambda item: (item.get("distance_km") or 999, item.get("label") or ""))
    await _sync_nearby_inventory(markers[:60], counts, lat, lng)

    return {
        "center": {"lat": lat, "lng": lng},
        "radius_km": radius_km,
        "counts": counts,
        "markers": markers[:60],
        "available_modes": [
            {"type": "taxi", "label": "Taxi", "live": counts["taxi"] > 0, "count": counts["taxi"]},
            {"type": "scooter", "label": "E-Scooter", "live": counts["scooter"] > 0, "count": counts["scooter"]},
            {"type": "bike", "label": "E-Bike", "live": counts["bike"] > 0, "count": counts["bike"]},
            {"type": "ev", "label": "EV Drive", "live": counts["ev"] > 0, "count": counts["ev"]},
            {"type": "car_sharing", "label": "Carsharing", "live": counts["car_sharing"] > 0, "count": counts["car_sharing"]},
            {"type": "car_rental", "label": "Mietwagen", "live": counts["car_rental"] > 0, "count": counts["car_rental"]},
            {"type": "airport_shuttle", "label": "Airport Shuttle", "live": True, "count": None},
            {"type": "vip", "label": "VIP Chauffeur", "live": True, "count": None},
        ],
    }


@router.get("/saved-locations")
async def get_saved_locations(request: Request):
    user = await get_current_user(request)
    user_id = str(user["_id"])
    await _migrate_legacy_favorites(user_id)
    items = await db.mobility_favorites.find({"user_id": user_id}, {"_id": 0}).sort("updated_at", -1).to_list(50)
    return {"locations": items}


@router.get("/favorites")
async def get_favorite_locations(request: Request):
    return await get_saved_locations(request)


@router.post("/saved-locations")
async def save_location(req: SavedLocationRequest, request: Request):
    user = await get_current_user(request)
    user_id = str(user["_id"])
    now = datetime.now(timezone.utc).isoformat()
    favorite_id = req.favorite_id or (req.kind if req.kind in {"home", "work"} else f"fav-{uuid4().hex[:10]}")
    location_doc = {
        "user_id": user_id,
        "favorite_id": favorite_id,
        "label": req.label,
        "address": req.address,
        "lat": req.lat,
        "lng": req.lng,
        "kind": req.kind,
        "updated_at": now,
    }
    await db.mobility_favorites.update_one(
        {"user_id": user_id, "favorite_id": favorite_id},
        {"$set": {
            **location_doc,
        }, "$setOnInsert": {"created_at": now}},
        upsert=True,
    )
    return {"ok": True, "location": location_doc}


@router.delete("/saved-locations/{favorite_id}")
async def delete_saved_location(favorite_id: str, request: Request):
    user = await get_current_user(request)
    user_id = str(user["_id"])
    await db.mobility_favorites.delete_one({"user_id": user_id, "favorite_id": favorite_id})
    return {"ok": True, "favorite_id": favorite_id}


@router.delete("/favorites/{favorite_id}")
async def delete_favorite_location(favorite_id: str, request: Request):
    return await delete_saved_location(favorite_id, request)


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
            {"id": "credit_card", "label": "Credit Card", "enabled": True},
            {"id": "cash", "label": "Cash", "enabled": True},
        ],
    }