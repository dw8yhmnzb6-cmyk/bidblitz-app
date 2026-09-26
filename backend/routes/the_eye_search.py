"""Admin search and location intelligence foundation for The Eye."""

from __future__ import annotations

import re
from typing import Any, Dict, List

from fastapi import APIRouter, HTTPException, Query, Request

from core.database import db
from core.security import get_current_user


router = APIRouter(prefix="/api/the-eye", tags=["The Eye Search"])


async def _require_admin(request: Request) -> dict:
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin required")
    return user


def _regex(value: str, anchored: bool = False) -> Dict[str, Any]:
    escaped = re.escape(value.strip())
    pattern = f"^{escaped}$" if anchored else escaped
    return {"$regex": pattern, "$options": "i"}


def _device_result(row: dict) -> dict:
    return {
        "entity_type": "device",
        "entity_id": row.get("device_id"),
        "title": row.get("name") or row.get("device_id"),
        "subtitle": " · ".join(
            [
                str(v)
                for v in [
                    row.get("device_type"),
                    row.get("city"),
                    row.get("country"),
                ]
                if v
            ]
        ),
        "status": row.get("connection_status"),
        "country": row.get("country"),
        "city": row.get("city"),
        "location": row.get("location"),
        "device_type": row.get("device_type"),
    }


def _location_result(row: dict) -> dict:
    location_type = row.get("location_type") or row.get("type") or "location"
    entity_id = (
        row.get("location_id")
        or row.get("site_id")
        or row.get("street_id")
        or row.get("city_id")
        or row.get("country_id")
    )
    title = (
        row.get("name")
        or row.get("street")
        or row.get("district")
        or row.get("city")
        or row.get("country")
        or entity_id
    )
    subtitle = " · ".join(
        [
            str(v)
            for v in [
                row.get("city"),
                row.get("region"),
                row.get("country"),
            ]
            if v and str(v) != str(title)
        ]
    )
    return {
        "entity_type": location_type,
        "entity_id": entity_id,
        "title": title,
        "subtitle": subtitle,
        "country": row.get("country"),
        "region": row.get("region"),
        "city": row.get("city"),
        "district": row.get("district"),
        "street": row.get("street"),
        "site_id": row.get("site_id"),
        "location": row.get("location"),
        "health_score": row.get("health_score"),
    }


@router.get("/admin/search")
async def global_search(
    request: Request,
    q: str = Query(..., min_length=2, max_length=120),
    limit: int = Query(default=12, ge=1, le=50),
):
    """Search known The Eye devices and internal location entities."""
    await _require_admin(request)
    needle = q.strip()
    rx = _regex(needle)

    device_rows = await db.the_eye_devices.find(
        {
            "$or": [
                {"device_id": rx},
                {"serial_number": rx},
                {"name": rx},
                {"device_type": rx},
                {"city": rx},
                {"country": rx},
            ]
        },
        {
            "_id": 0,
            "token_hash": 0,
            "metadata": 0,
            "last_telemetry": 0,
        },
    ).limit(limit).to_list(limit)

    location_rows = await db.the_eye_locations.find(
        {
            "$or": [
                {"name": rx},
                {"country": rx},
                {"region": rx},
                {"city": rx},
                {"district": rx},
                {"street": rx},
                {"site_id": rx},
                {"location_id": rx},
            ]
        },
        {"_id": 0},
    ).limit(limit).to_list(limit)

    results: List[dict] = [
        *[_device_result(row) for row in device_rows],
        *[_location_result(row) for row in location_rows],
    ]

    lowered = needle.lower()

    def score(item: dict) -> tuple:
        title = str(item.get("title") or "").lower()
        entity_id = str(item.get("entity_id") or "").lower()
        exact = 0 if lowered in {title, entity_id} else 1
        prefix = 0 if title.startswith(lowered) or entity_id.startswith(lowered) else 1
        return (exact, prefix, title)

    results.sort(key=score)
    return {
        "ok": True,
        "query": needle,
        "count": min(len(results), limit),
        "results": results[:limit],
    }


@router.get("/admin/location-summary")
async def location_summary(
    request: Request,
    city: str = Query(..., min_length=2, max_length=120),
    country: str | None = Query(default=None, max_length=2),
):
    """Return a live device summary for a known city/location context."""
    await _require_admin(request)

    query: Dict[str, Any] = {"city": _regex(city, anchored=True)}
    if country:
        query["country"] = _regex(country, anchored=True)

    total = await db.the_eye_devices.count_documents(query)
    online = await db.the_eye_devices.count_documents(
        {**query, "connection_status": "online"}
    )
    warning = await db.the_eye_devices.count_documents(
        {**query, "connection_status": "warning"}
    )
    offline = await db.the_eye_devices.count_documents(
        {
            **query,
            "connection_status": {
                "$nin": ["online", "warning"],
            },
        }
    )

    by_type_rows = await db.the_eye_devices.aggregate(
        [
            {"$match": query},
            {"$group": {"_id": "$device_type", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}},
        ]
    ).to_list(100)

    location_doc = await db.the_eye_locations.find_one(
        {
            "city": _regex(city, anchored=True),
            **({"country": _regex(country, anchored=True)} if country else {}),
        },
        {"_id": 0},
    )

    return {
        "ok": True,
        "location": {
            "city": city,
            "country": country.upper() if country else (location_doc or {}).get("country"),
            "location_id": (location_doc or {}).get("location_id"),
            "location": (location_doc or {}).get("location"),
            "health_score": (location_doc or {}).get("health_score"),
        },
        "devices": {
            "total": total,
            "online": online,
            "warning": warning,
            "offline": offline,
            "by_type": {
                str(row.get("_id") or "other"): int(row.get("count") or 0)
                for row in by_type_rows
            },
        },
    }
