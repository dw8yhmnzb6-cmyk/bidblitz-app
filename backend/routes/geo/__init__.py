"""
BidBlitz - Geo Autocomplete API
================================
Lightweight in-memory fuzzy search for cities + airports.
Curated dataset (no external API call, ~120 KB total) covering DACH+EU+top global.

Endpoints:
  GET /api/geo/cities?q=ber          → [{name, country, country_code, lat, lon}, ...]
  GET /api/geo/airports?q=ber        → [{iata, name, city, country}, ...]
"""
from fastapi import APIRouter, Query
from .geo_data import CITIES, AIRPORTS  # noqa: F401

router = APIRouter(prefix="/api/geo", tags=["geo"])


def _score(needle: str, haystack: str) -> int:
    """Rank: prefix match > substring match > word-prefix > fuzzy."""
    n = needle.lower()
    h = haystack.lower()
    if h.startswith(n):
        return 100 - len(h)  # shorter = better
    if any(part.startswith(n) for part in h.split()):
        return 50 - len(h)
    if n in h:
        return 25 - len(h)
    return -1


@router.get("/cities")
async def search_cities(
    q: str = Query("", min_length=0, max_length=64),
    limit: int = Query(10, ge=1, le=30),
    country: str = Query("", max_length=2),
):
    if len(q.strip()) < 2:
        return {"results": [], "count": 0}
    pool = CITIES
    if country:
        cu = country.upper()
        pool = [c for c in CITIES if c.get("country_code") == cu]
    scored = []
    for c in pool:
        s1 = _score(q, c["name"])
        s2 = _score(q, c.get("region", ""))
        s = max(s1, s2)
        if s >= 0:
            scored.append((s, c))
    scored.sort(key=lambda x: -x[0])
    return {"results": [c for _, c in scored[:limit]], "count": min(len(scored), limit)}


@router.get("/airports")
async def search_airports(
    q: str = Query("", min_length=0, max_length=64),
    limit: int = Query(10, ge=1, le=30),
):
    if len(q.strip()) < 2:
        return {"results": [], "count": 0}
    qup = q.upper().strip()
    scored = []
    for a in AIRPORTS:
        # Direct IATA match wins
        if a["iata"] == qup:
            scored.append((1000, a))
            continue
        s = max(_score(q, a["city"]), _score(q, a["name"]), _score(q, a["iata"]))
        if s >= 0:
            scored.append((s, a))
    scored.sort(key=lambda x: -x[0])
    return {"results": [a for _, a in scored[:limit]], "count": min(len(scored), limit)}
