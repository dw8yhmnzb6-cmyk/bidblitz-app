"""
BidBlitz V2 - OpenStreetMap Overpass Integration
Real Nearby Places (no API key, no signup, free)
Replaces seeded fake nearby_places data.
"""
from fastapi import APIRouter, HTTPException, Query
from typing import Optional
import httpx
import math
import time

router = APIRouter(prefix="/api/osm", tags=["OSM"])

OVERPASS_URL = "https://overpass-api.de/api/interpreter"

# Whitelist of OSM amenity tags grouped by category
CATEGORY_FILTERS = {
    "all": 'amenity~"restaurant|cafe|bar|fast_food|bank|atm|pharmacy|fuel|hospital|charging_station|parking|cinema|library|post_office"',
    "food": 'amenity~"restaurant|cafe|bar|fast_food|food_court|ice_cream"',
    "shop": 'shop~"supermarket|convenience|bakery|kiosk|mall"',
    "money": 'amenity~"bank|atm|bureau_de_change"',
    "health": 'amenity~"pharmacy|hospital|clinic|dentist|doctors"',
    "fuel": 'amenity~"fuel|charging_station"',
    "fun": 'amenity~"cinema|theatre|nightclub|arts_centre"',
    "transport": 'amenity~"parking|bus_station|taxi"',
}

# Simple in-memory cache (15 min TTL)
_cache: dict = {}
_TTL = 900


def haversine(lat1, lng1, lat2, lng2):
    R = 6371
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlng / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _cache_get(key):
    item = _cache.get(key)
    if item and time.time() - item[0] < _TTL:
        return item[1]
    return None


def _cache_set(key, value):
    _cache[key] = (time.time(), value)
    # Trim cache if too large
    if len(_cache) > 200:
        oldest = min(_cache.items(), key=lambda x: x[1][0])
        _cache.pop(oldest[0], None)


@router.get("/places")
async def osm_nearby_places(
    lat: float = Query(..., ge=-90, le=90),
    lng: float = Query(..., ge=-180, le=180),
    radius_m: int = Query(1500, ge=100, le=5000),
    category: str = Query("all"),
    limit: int = Query(50, ge=1, le=200),
):
    """
    Fetch real nearby places from OpenStreetMap Overpass API.
    Free, no API key required.
    """
    cat_filter = CATEGORY_FILTERS.get(category, CATEGORY_FILTERS["all"])
    cache_key = f"{round(lat, 3)}:{round(lng, 3)}:{radius_m}:{category}"

    cached = _cache_get(cache_key)
    if cached:
        return {**cached, "cached": True}

    # Build Overpass QL query
    if category == "shop":
        query = f"""
        [out:json][timeout:20];
        (
          node[{cat_filter}](around:{radius_m},{lat},{lng});
          way[{cat_filter}](around:{radius_m},{lat},{lng});
        );
        out center {limit};
        """
    else:
        query = f"""
        [out:json][timeout:20];
        (
          node[{cat_filter}](around:{radius_m},{lat},{lng});
        );
        out body {limit};
        """

    try:
        async with httpx.AsyncClient(timeout=25.0, headers={"User-Agent": "BidBlitz/2.0 (contact@bidblitz.com)"}) as client:
            r = await client.post(OVERPASS_URL, data={"data": query})
            r.raise_for_status()
            data = r.json()
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"OSM Overpass error: {str(e)[:100]}")

    elements = data.get("elements", [])
    places = []
    for el in elements:
        # Use center for ways, lat/lon for nodes
        plat = el.get("lat") or el.get("center", {}).get("lat")
        plng = el.get("lon") or el.get("center", {}).get("lon")
        if plat is None or plng is None:
            continue

        tags = el.get("tags", {})
        name = tags.get("name") or tags.get("brand") or tags.get("operator")
        if not name:
            continue

        amenity = tags.get("amenity") or tags.get("shop") or "place"
        distance_m = round(haversine(lat, lng, plat, plng) * 1000)

        places.append({
            "id": f"osm_{el.get('id')}",
            "name": name,
            "category": amenity,
            "lat": plat,
            "lng": plng,
            "distance_m": distance_m,
            "address": ", ".join(filter(None, [
                tags.get("addr:street"),
                tags.get("addr:housenumber"),
                tags.get("addr:postcode"),
                tags.get("addr:city"),
            ])) or None,
            "phone": tags.get("phone") or tags.get("contact:phone"),
            "website": tags.get("website") or tags.get("contact:website"),
            "opening_hours": tags.get("opening_hours"),
            "cuisine": tags.get("cuisine"),
            "wheelchair": tags.get("wheelchair"),
        })

    places.sort(key=lambda x: x["distance_m"])
    result = {
        "places": places[:limit],
        "count": len(places),
        "source": "openstreetmap",
        "center": {"lat": lat, "lng": lng},
        "radius_m": radius_m,
        "category": category,
    }
    _cache_set(cache_key, result)
    return result


@router.get("/categories")
async def osm_categories():
    """List available categories for the frontend."""
    return {
        "categories": [
            {"id": "all", "label": "Alle", "icon": "📍"},
            {"id": "food", "label": "Essen & Trinken", "icon": "🍴"},
            {"id": "shop", "label": "Einkaufen", "icon": "🛒"},
            {"id": "money", "label": "Geld & Bank", "icon": "🏦"},
            {"id": "health", "label": "Gesundheit", "icon": "💊"},
            {"id": "fuel", "label": "Tanken & Laden", "icon": "⛽"},
            {"id": "fun", "label": "Unterhaltung", "icon": "🎭"},
            {"id": "transport", "label": "Transport", "icon": "🚍"},
        ]
    }
