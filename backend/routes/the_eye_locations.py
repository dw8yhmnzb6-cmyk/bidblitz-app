"""Location hierarchy and Digital Twin administration for The Eye."""

from __future__ import annotations

import re
import secrets
from datetime import datetime, timezone
from typing import Any, Dict, List, Literal, Optional

from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel, Field

from core.database import db
from core.security import get_current_user
from core.the_eye_live import broadcast_the_eye_event


router = APIRouter(prefix="/api/the-eye", tags=["The Eye Locations"])

LocationType = Literal[
    "country",
    "region",
    "city",
    "district",
    "street",
    "site",
    "zone",
]

PARENT_RULES = {
    "country": set(),
    "region": {"country"},
    "city": {"country", "region"},
    "district": {"city"},
    "street": {"city", "district"},
    "site": {"country", "region", "city", "district", "street"},
    "zone": {"country", "region", "city", "district", "street", "site"},
}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


async def _require_admin(request: Request) -> dict:
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin required")
    return user


class Coordinates(BaseModel):
    lat: float = Field(..., ge=-90, le=90)
    lng: float = Field(..., ge=-180, le=180)


class LocationCreate(BaseModel):
    location_type: LocationType
    name: str = Field(..., min_length=2, max_length=160)
    code: Optional[str] = Field(default=None, max_length=64)
    parent_id: Optional[str] = Field(default=None, max_length=128)
    country: Optional[str] = Field(default=None, max_length=2)
    region: Optional[str] = Field(default=None, max_length=160)
    city: Optional[str] = Field(default=None, max_length=160)
    district: Optional[str] = Field(default=None, max_length=160)
    street: Optional[str] = Field(default=None, max_length=200)
    address: Optional[str] = Field(default=None, max_length=300)
    location: Optional[Coordinates] = None
    health_score: Optional[float] = Field(default=None, ge=0, le=100)
    metadata: Dict[str, Any] = Field(default_factory=dict)


class LocationUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=2, max_length=160)
    code: Optional[str] = Field(default=None, max_length=64)
    parent_id: Optional[str] = Field(default=None, max_length=128)
    region: Optional[str] = Field(default=None, max_length=160)
    city: Optional[str] = Field(default=None, max_length=160)
    district: Optional[str] = Field(default=None, max_length=160)
    street: Optional[str] = Field(default=None, max_length=200)
    address: Optional[str] = Field(default=None, max_length=300)
    location: Optional[Coordinates] = None
    health_score: Optional[float] = Field(default=None, ge=0, le=100)
    metadata: Optional[Dict[str, Any]] = None


async def _load_parent(parent_id: Optional[str]) -> Optional[dict]:
    if not parent_id:
        return None
    parent = await db.the_eye_locations.find_one(
        {"location_id": parent_id, "status": {"$ne": "deleted"}},
        {"_id": 0},
    )
    if not parent:
        raise HTTPException(status_code=400, detail="Parent location not found")
    return parent


def _validate_parent(location_type: str, parent: Optional[dict]) -> None:
    allowed = PARENT_RULES[location_type]
    if not parent:
        if allowed and location_type not in {"city", "site", "zone"}:
            raise HTTPException(status_code=400, detail=f"{location_type} requires a parent")
        return
    parent_type = parent.get("location_type")
    if parent_type not in allowed:
        raise HTTPException(
            status_code=400,
            detail=f"{location_type} cannot be placed under {parent_type}",
        )


def _inherit_geo(req: LocationCreate, parent: Optional[dict]) -> dict:
    inherited = {
        "country": (req.country or (parent or {}).get("country")),
        "region": req.region or (parent or {}).get("region"),
        "city": req.city or (parent or {}).get("city"),
        "district": req.district or (parent or {}).get("district"),
        "street": req.street or (parent or {}).get("street"),
    }

    if req.location_type == "country":
        inherited["country"] = (req.country or req.code or req.name)[:2].upper()
    elif req.location_type == "region":
        inherited["region"] = req.name
    elif req.location_type == "city":
        inherited["city"] = req.name
    elif req.location_type == "district":
        inherited["district"] = req.name
    elif req.location_type == "street":
        inherited["street"] = req.name

    if inherited["country"]:
        inherited["country"] = str(inherited["country"]).upper()
    return inherited


@router.post("/admin/locations")
async def create_location(req: LocationCreate, request: Request):
    admin = await _require_admin(request)
    parent = await _load_parent(req.parent_id)
    _validate_parent(req.location_type, parent)

    if req.code:
        existing = await db.the_eye_locations.find_one(
            {"code": req.code, "status": {"$ne": "deleted"}},
            {"_id": 0, "location_id": 1},
        )
        if existing:
            raise HTTPException(status_code=409, detail="Location code already exists")

    now = _now()
    location_id = "LOC-" + secrets.token_hex(8).upper()
    geo = _inherit_geo(req, parent)
    doc = {
        "location_id": location_id,
        "location_type": req.location_type,
        "name": req.name,
        "code": req.code,
        "parent_id": req.parent_id,
        **geo,
        "address": req.address,
        "location": req.location.model_dump() if req.location else None,
        "health_score": req.health_score,
        "metadata": req.metadata,
        "status": "active",
        "created_at": now,
        "updated_at": now,
        "created_by": str(admin.get("_id") or admin.get("id") or admin.get("email")),
    }
    await db.the_eye_locations.insert_one(doc)
    safe = {k: v for k, v in doc.items() if k != "_id"}
    await broadcast_the_eye_event("location.created", safe)
    return {"ok": True, "location": safe}


@router.get("/admin/locations")
async def list_locations(
    request: Request,
    location_type: Optional[str] = None,
    parent_id: Optional[str] = None,
    city: Optional[str] = None,
    limit: int = Query(default=500, ge=1, le=5000),
):
    await _require_admin(request)
    query: Dict[str, Any] = {"status": {"$ne": "deleted"}}
    if location_type:
        query["location_type"] = location_type
    if parent_id:
        query["parent_id"] = parent_id
    if city:
        query["city"] = {"$regex": f"^{re.escape(city)}$", "$options": "i"}

    rows = await db.the_eye_locations.find(query, {"_id": 0}).sort(
        [("country", 1), ("city", 1), ("name", 1)]
    ).to_list(limit)
    return {"ok": True, "count": len(rows), "locations": rows}


@router.get("/admin/locations/{location_id}")
async def get_location(location_id: str, request: Request):
    await _require_admin(request)
    row = await db.the_eye_locations.find_one(
        {"location_id": location_id, "status": {"$ne": "deleted"}},
        {"_id": 0},
    )
    if not row:
        raise HTTPException(status_code=404, detail="Location not found")

    ancestors: List[dict] = []
    cursor = row
    seen = {location_id}
    while cursor.get("parent_id") and len(ancestors) < 10:
        parent_id = cursor["parent_id"]
        if parent_id in seen:
            break
        seen.add(parent_id)
        parent = await db.the_eye_locations.find_one(
            {"location_id": parent_id, "status": {"$ne": "deleted"}},
            {"_id": 0, "location_id": 1, "location_type": 1, "name": 1, "parent_id": 1},
        )
        if not parent:
            break
        ancestors.append(parent)
        cursor = parent
    ancestors.reverse()

    children = await db.the_eye_locations.find(
        {"parent_id": location_id, "status": {"$ne": "deleted"}},
        {"_id": 0, "location_id": 1, "location_type": 1, "name": 1, "health_score": 1},
    ).sort("name", 1).to_list(500)

    device_query: Dict[str, Any] = {}
    if row.get("location_type") == "site":
        device_query["metadata.site_id"] = row.get("code") or row.get("location_id")
    elif row.get("city"):
        device_query["city"] = {"$regex": f"^{re.escape(str(row['city']))}$", "$options": "i"}
        if row.get("country"):
            device_query["country"] = {"$regex": f"^{re.escape(str(row['country']))}$", "$options": "i"}

    total_devices = await db.the_eye_devices.count_documents(device_query) if device_query else 0
    online_devices = await db.the_eye_devices.count_documents(
        {**device_query, "connection_status": "online"}
    ) if device_query else 0

    return {
        "ok": True,
        "location": row,
        "breadcrumb": [*ancestors, {
            "location_id": row["location_id"],
            "location_type": row["location_type"],
            "name": row["name"],
        }],
        "children": children,
        "device_summary": {
            "total": total_devices,
            "online": online_devices,
            "offline": max(total_devices - online_devices, 0),
        },
    }


@router.patch("/admin/locations/{location_id}")
async def update_location(location_id: str, req: LocationUpdate, request: Request):
    await _require_admin(request)
    current = await db.the_eye_locations.find_one(
        {"location_id": location_id, "status": {"$ne": "deleted"}},
        {"_id": 0},
    )
    if not current:
        raise HTTPException(status_code=404, detail="Location not found")

    update = req.model_dump(exclude_unset=True)
    if "parent_id" in update:
        if update["parent_id"] == location_id:
            raise HTTPException(status_code=400, detail="Location cannot be its own parent")
        parent = await _load_parent(update["parent_id"])
        _validate_parent(current["location_type"], parent)

    if "location" in update and update["location"] is not None and hasattr(update["location"], "model_dump"):
        update["location"] = update["location"].model_dump()

    update["updated_at"] = _now()
    await db.the_eye_locations.update_one(
        {"location_id": location_id},
        {"$set": update},
    )
    fresh = await db.the_eye_locations.find_one({"location_id": location_id}, {"_id": 0})
    await broadcast_the_eye_event("location.updated", fresh)
    return {"ok": True, "location": fresh}


@router.delete("/admin/locations/{location_id}")
async def delete_location(location_id: str, request: Request):
    await _require_admin(request)
    child_count = await db.the_eye_locations.count_documents(
        {"parent_id": location_id, "status": {"$ne": "deleted"}}
    )
    if child_count:
        raise HTTPException(
            status_code=409,
            detail="Location has active children and cannot be deleted",
        )

    result = await db.the_eye_locations.update_one(
        {"location_id": location_id, "status": {"$ne": "deleted"}},
        {"$set": {"status": "deleted", "updated_at": _now()}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Location not found")

    await broadcast_the_eye_event(
        "location.deleted",
        {"location_id": location_id},
    )
    return {"ok": True, "location_id": location_id, "status": "deleted"}
