"""Kosovo Address Autocomplete with strict bounding box"""
from fastapi import APIRouter, Query
import httpx

router = APIRouter(prefix="/taxi/geocode", tags=["Geocoding"])

KOSOVO_BOUNDS = {"south": 41.85, "west": 20.01, "north": 43.27, "east": 21.79}

# Common Kosovo places for offline fallback
KOSOVO_PLACES = [
    {"name": "Pristina Zentrum", "lat": 42.6629, "lng": 21.1655},
    {"name": "Pristina Flughafen (PIA)", "lat": 42.5728, "lng": 21.0358},
    {"name": "Mother Teresa Boulevard", "lat": 42.6600, "lng": 21.1600},
    {"name": "Germia Park", "lat": 42.6700, "lng": 21.1800},
    {"name": "Dragodan", "lat": 42.6580, "lng": 21.1500},
    {"name": "Arberia", "lat": 42.6550, "lng": 21.1700},
    {"name": "Sunny Hill", "lat": 42.6540, "lng": 21.1650},
    {"name": "Prizren Zentrum", "lat": 42.2089, "lng": 20.7433},
    {"name": "Peja Zentrum", "lat": 42.6593, "lng": 20.2887},
    {"name": "Mitrovica", "lat": 42.8833, "lng": 20.8667},
    {"name": "Gjilan", "lat": 42.4635, "lng": 21.4694},
    {"name": "Ferizaj", "lat": 42.3702, "lng": 21.1553},
    {"name": "Gjakova", "lat": 42.3803, "lng": 20.4308},
    {"name": "Vushtrri", "lat": 42.8231, "lng": 20.9675},
    {"name": "Suhareka", "lat": 42.3592, "lng": 20.8269},
    {"name": "Gracanica", "lat": 42.5992, "lng": 21.1903},
    {"name": "Lipjan", "lat": 42.5214, "lng": 21.1239},
    {"name": "Fushe Kosove", "lat": 42.6350, "lng": 21.0950},
    {"name": "Grand Hotel Pristina", "lat": 42.6612, "lng": 21.1635},
    {"name": "Albi Mall Pristina", "lat": 42.6485, "lng": 21.1595},
    {"name": "Pristina City Center", "lat": 42.6629, "lng": 21.1655},
    {"name": "Newborn Monument", "lat": 42.6597, "lng": 21.1597},
    {"name": "Skanderbeg Square", "lat": 42.6630, "lng": 21.1630},
    {"name": "Stadium Pristina", "lat": 42.6575, "lng": 21.1540},
    {"name": "University of Pristina", "lat": 42.6517, "lng": 21.1650},
]


@router.get("/search")
async def search_address(q: str = Query(..., min_length=2)):
    """Search for addresses in Kosovo (bounding box restricted)"""
    # Local search first
    q_lower = q.lower()
    local_results = [p for p in KOSOVO_PLACES if q_lower in p["name"].lower()]

    # Try Nominatim (OpenStreetMap) with Kosovo bounds
    osm_results = []
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            r = await client.get("https://nominatim.openstreetmap.org/search", params={
                "q": q, "format": "json", "limit": 5, "addressdetails": 1,
                "viewbox": f"{KOSOVO_BOUNDS['west']},{KOSOVO_BOUNDS['north']},{KOSOVO_BOUNDS['east']},{KOSOVO_BOUNDS['south']}",
                "bounded": 1
            }, headers={"User-Agent": "BidBlitz/1.0"})
            if r.status_code == 200:
                for item in r.json():
                    lat, lng = float(item["lat"]), float(item["lon"])
                    if KOSOVO_BOUNDS["south"] <= lat <= KOSOVO_BOUNDS["north"] and KOSOVO_BOUNDS["west"] <= lng <= KOSOVO_BOUNDS["east"]:
                        osm_results.append({"name": item["display_name"].split(",")[0], "full_address": item["display_name"], "lat": lat, "lng": lng})
    except:
        pass

    # Combine and deduplicate
    results = []
    seen = set()
    for p in local_results + osm_results:
        key = f"{p['lat']:.3f},{p['lng']:.3f}"
        if key not in seen:
            seen.add(key)
            results.append({"name": p["name"], "lat": p["lat"], "lng": p["lng"], "full_address": p.get("full_address", p["name"])})

    return {"results": results[:10], "bounds": KOSOVO_BOUNDS}
