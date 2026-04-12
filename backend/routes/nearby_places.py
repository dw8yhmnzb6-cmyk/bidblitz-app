"""
BidBlitz V2 - Nearby / In der Nähe
Aggregiert Restaurants, Termine-Anbieter, Hotels etc. mit Geo-Koordinaten
"""
from fastapi import APIRouter, Request
from core.database import db
from core.security import get_current_user
import random

router = APIRouter(prefix="/api/nearby", tags=["nearby"])

# Preset coordinates for cities (used for seed data that lacks coords)
CITY_COORDS = {
    "dubai": {"lat": 25.2048, "lng": 55.2708},
    "berlin": {"lat": 52.5200, "lng": 13.4050},
    "münchen": {"lat": 48.1351, "lng": 11.5820},
    "munich": {"lat": 48.1351, "lng": 11.5820},
    "wien": {"lat": 48.2082, "lng": 16.3738},
    "vienna": {"lat": 48.2082, "lng": 16.3738},
    "istanbul": {"lat": 41.0082, "lng": 28.9784},
    "zürich": {"lat": 47.3769, "lng": 8.5417},
    "zurich": {"lat": 47.3769, "lng": 8.5417},
    "antalya": {"lat": 36.8969, "lng": 30.7133},
    "hamburg": {"lat": 53.5511, "lng": 9.9937},
    "köln": {"lat": 50.9375, "lng": 6.9603},
    "mannheim": {"lat": 49.4875, "lng": 8.4660},
    "antwerpen": {"lat": 51.2194, "lng": 4.4025},
}


def get_coords_for_city(city: str):
    if not city:
        return None
    c = city.lower().strip()
    if c in CITY_COORDS:
        return CITY_COORDS[c]
    # Fuzzy match
    for k, v in CITY_COORDS.items():
        if k in c or c in k:
            return v
    return None


def jitter(base, spread=0.015):
    """Add small random offset to coordinates so markers don't overlap."""
    return base + random.uniform(-spread, spread)


@router.get("/all")
async def get_nearby(lat: float = 25.2, lng: float = 55.27, radius_km: float = 50):
    """Get all nearby places: restaurants, appointment providers, hotels, events."""
    markers = []

    # Restaurants
    restaurants = await db.restaurants.find({"status": "active"}, {"_id": 0}).limit(30).to_list(30)
    for r in restaurants:
        coords = get_coords_for_city(r.get("city", ""))
        if coords:
            markers.append({
                "id": r["restaurant_id"],
                "type": "restaurant",
                "name": r["name"],
                "subtitle": f"{r.get('cuisine', '').capitalize()} — {r.get('city', '')}",
                "rating": r.get("rating", 0),
                "image": r.get("images", [None])[0],
                "lat": jitter(coords["lat"]),
                "lng": jitter(coords["lng"]),
                "route": "/restaurants",
                "color": "#F59E0B",
            })

    # Appointment Providers
    providers = await db.appointment_providers.find({"status": "active"}, {"_id": 0}).limit(30).to_list(30)
    for p in providers:
        coords = get_coords_for_city(p.get("city", ""))
        if coords:
            markers.append({
                "id": p["provider_id"],
                "type": "appointment",
                "name": p["name"],
                "subtitle": f"{p.get('branch', '')} — {p.get('city', '')}",
                "rating": p.get("rating", 0),
                "image": p.get("images", [None])[0] if p.get("images") else None,
                "lat": jitter(coords["lat"]),
                "lng": jitter(coords["lng"]),
                "route": "/appointments",
                "color": "#3B82F6",
            })

    # Hotels
    hotels = await db.properties.find({"status": "active"}, {"_id": 0}).limit(30).to_list(30)
    for h in hotels:
        coords = get_coords_for_city(h.get("city", ""))
        if coords:
            markers.append({
                "id": h["property_id"],
                "type": "hotel",
                "name": h["title"],
                "subtitle": f"€{h.get('price_per_night', 0)}/Nacht — {h.get('city', '')}",
                "rating": h.get("rating", 0),
                "image": h.get("images", [None])[0] if h.get("images") else None,
                "lat": jitter(coords["lat"]),
                "lng": jitter(coords["lng"]),
                "route": "/hotels",
                "color": "#6366F1",
            })

    # Events
    events = await db.events.find({"status": "active"}, {"_id": 0}).limit(20).to_list(20)
    for e in events:
        coords = get_coords_for_city(e.get("city", ""))
        if coords:
            markers.append({
                "id": e["event_id"],
                "type": "event",
                "name": e["title"],
                "subtitle": f"{e.get('date', '')} — {e.get('venue', '')}",
                "rating": 0,
                "image": e.get("image_url"),
                "lat": jitter(coords["lat"], 0.02),
                "lng": jitter(coords["lng"], 0.02),
                "route": "/events",
                "color": "#A855F7",
            })

    return {"markers": markers, "count": len(markers)}
