"""The Eye network topology, site health and root-cause foundation."""

from __future__ import annotations

import secrets
from datetime import datetime, timezone
from typing import Any, Dict, List, Literal, Optional

from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel, Field

from core.database import db
from core.security import get_current_user
from core.the_eye_live import broadcast_the_eye_event


router = APIRouter(prefix="/api/the-eye", tags=["The Eye Network"])

NetworkNodeType = Literal["router", "switch", "poe_switch", "ups", "edge_gateway", "modem", "wan", "other"]
HealthStatus = Literal["online", "warning", "offline", "maintenance"]


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


async def _require_admin(request: Request) -> dict:
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin required")
    return user


class NetworkNodeCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=160)
    node_type: NetworkNodeType
    location_id: Optional[str] = Field(default=None, max_length=128)
    site_id: Optional[str] = Field(default=None, max_length=128)
    parent_node_id: Optional[str] = Field(default=None, max_length=128)
    management_ip: Optional[str] = Field(default=None, max_length=128)
    serial_number: Optional[str] = Field(default=None, max_length=128)
    model: Optional[str] = Field(default=None, max_length=160)
    vendor: Optional[str] = Field(default=None, max_length=160)
    poe_port_count: Optional[int] = Field(default=None, ge=0, le=256)
    metadata: Dict[str, Any] = Field(default_factory=dict)


class NetworkNodeHealth(BaseModel):
    status: HealthStatus = "online"
    latency_ms: Optional[float] = Field(default=None, ge=0, le=600000)
    packet_loss_percent: Optional[float] = Field(default=None, ge=0, le=100)
    cpu_percent: Optional[float] = Field(default=None, ge=0, le=100)
    memory_percent: Optional[float] = Field(default=None, ge=0, le=100)
    temperature_c: Optional[float] = Field(default=None, ge=-100, le=250)
    uptime_seconds: Optional[int] = Field(default=None, ge=0)
    wan_primary_online: Optional[bool] = None
    wan_backup_online: Optional[bool] = None
    ups_on_battery: Optional[bool] = None
    ups_battery_percent: Optional[float] = Field(default=None, ge=0, le=100)
    ups_runtime_minutes: Optional[float] = Field(default=None, ge=0)
    poe_draw_watts: Optional[float] = Field(default=None, ge=0)
    poe_capacity_watts: Optional[float] = Field(default=None, ge=0)
    details: Dict[str, Any] = Field(default_factory=dict)


class PortHealth(BaseModel):
    port: int = Field(..., ge=1, le=512)
    status: Literal["up", "down", "disabled", "warning"]
    poe_enabled: Optional[bool] = None
    poe_watts: Optional[float] = Field(default=None, ge=0)
    linked_device_id: Optional[str] = Field(default=None, max_length=128)
    linked_camera_id: Optional[str] = Field(default=None, max_length=128)
    speed_mbps: Optional[int] = Field(default=None, ge=0)
    rx_errors: Optional[int] = Field(default=None, ge=0)
    tx_errors: Optional[int] = Field(default=None, ge=0)


async def _validate_location(location_id: Optional[str]) -> Optional[dict]:
    if not location_id:
        return None
    row = await db.the_eye_locations.find_one(
        {"location_id": location_id, "status": {"$ne": "deleted"}},
        {"_id": 0},
    )
    if not row:
        raise HTTPException(status_code=400, detail="Location not found")
    return row


async def _validate_parent(parent_node_id: Optional[str]) -> Optional[dict]:
    if not parent_node_id:
        return None
    row = await db.the_eye_network_nodes.find_one(
        {"node_id": parent_node_id, "status": {"$ne": "disabled"}},
        {"_id": 0},
    )
    if not row:
        raise HTTPException(status_code=400, detail="Parent network node not found")
    return row


@router.post("/admin/network/nodes")
async def create_network_node(req: NetworkNodeCreate, request: Request):
    admin = await _require_admin(request)
    location = await _validate_location(req.location_id)
    await _validate_parent(req.parent_node_id)

    if req.serial_number:
        exists = await db.the_eye_network_nodes.find_one(
            {"serial_number": req.serial_number, "status": {"$ne": "disabled"}},
            {"_id": 0, "node_id": 1},
        )
        if exists:
            raise HTTPException(status_code=409, detail="Serial number already registered")

    now = _now()
    node_id = "NET-" + secrets.token_hex(8).upper()
    doc = {
        "node_id": node_id,
        "name": req.name,
        "node_type": req.node_type,
        "location_id": req.location_id,
        "site_id": req.site_id or (location or {}).get("code"),
        "parent_node_id": req.parent_node_id,
        "management_ip": req.management_ip,
        "serial_number": req.serial_number,
        "model": req.model,
        "vendor": req.vendor,
        "poe_port_count": req.poe_port_count,
        "metadata": req.metadata,
        "status": "active",
        "connection_status": "never_seen",
        "last_health": None,
        "created_at": now,
        "updated_at": now,
        "created_by": str(admin.get("_id") or admin.get("id") or admin.get("email")),
    }
    await db.the_eye_network_nodes.insert_one(doc)
    doc.pop("_id", None)
    await broadcast_the_eye_event("network.node_created", doc)
    return {"ok": True, "node": doc}


@router.get("/admin/network/nodes")
async def list_network_nodes(
    request: Request,
    location_id: Optional[str] = None,
    site_id: Optional[str] = None,
    node_type: Optional[str] = None,
    limit: int = Query(default=500, ge=1, le=5000),
):
    await _require_admin(request)
    query: Dict[str, Any] = {"status": {"$ne": "disabled"}}
    if location_id:
        query["location_id"] = location_id
    if site_id:
        query["site_id"] = site_id
    if node_type:
        query["node_type"] = node_type

    rows = await db.the_eye_network_nodes.find(query, {"_id": 0}).sort("name", 1).to_list(limit)
    return {"ok": True, "count": len(rows), "nodes": rows}


@router.post("/admin/network/nodes/{node_id}/health")
async def update_network_health(node_id: str, req: NetworkNodeHealth, request: Request):
    await _require_admin(request)
    node = await db.the_eye_network_nodes.find_one(
        {"node_id": node_id, "status": {"$ne": "disabled"}},
        {"_id": 0},
    )
    if not node:
        raise HTTPException(status_code=404, detail="Network node not found")

    now = _now()
    health = {**req.model_dump(), "recorded_at": now}
    await db.the_eye_network_nodes.update_one(
        {"node_id": node_id},
        {"$set": {
            "connection_status": req.status,
            "last_health": health,
            "last_seen_at": now,
            "updated_at": now,
        }},
    )
    await db.the_eye_network_health.insert_one({"node_id": node_id, **health})
    await broadcast_the_eye_event(
        "network.health",
        {"node_id": node_id, "connection_status": req.status, "last_health": health, "last_seen_at": now},
    )
    return {"ok": True, "node_id": node_id, "health": health}


@router.post("/admin/network/nodes/{node_id}/ports")
async def upsert_port_health(node_id: str, req: PortHealth, request: Request):
    await _require_admin(request)
    node = await db.the_eye_network_nodes.find_one(
        {"node_id": node_id, "status": {"$ne": "disabled"}},
        {"_id": 0, "node_type": 1},
    )
    if not node:
        raise HTTPException(status_code=404, detail="Network node not found")
    if node.get("node_type") not in {"switch", "poe_switch", "router", "edge_gateway"}:
        raise HTTPException(status_code=400, detail="This node type does not expose managed ports")

    now = _now()
    doc = {"node_id": node_id, **req.model_dump(), "updated_at": now}
    await db.the_eye_network_ports.update_one(
        {"node_id": node_id, "port": req.port},
        {"$set": doc},
        upsert=True,
    )
    await broadcast_the_eye_event("network.port", doc)
    return {"ok": True, "port": doc}


def _score_component(status: str) -> int:
    return {"online": 100, "warning": 65, "maintenance": 80, "offline": 0, "never_seen": 40}.get(status, 50)


@router.get("/admin/sites/{site_id}/health")
async def site_health(site_id: str, request: Request):
    await _require_admin(request)

    network = await db.the_eye_network_nodes.find(
        {"site_id": site_id, "status": {"$ne": "disabled"}},
        {"_id": 0},
    ).to_list(500)
    cameras = await db.the_eye_cameras.find(
        {"site_id": site_id, "status": {"$ne": "disabled"}},
        {"_id": 0, "stream_path": 0, "privacy_masks": 0, "metadata": 0},
    ).to_list(2000)
    devices = await db.the_eye_devices.find(
        {"site_id": site_id, "status": {"$ne": "disabled"}},
        {"_id": 0, "token_hash": 0, "metadata": 0, "last_telemetry": 0},
    ).to_list(5000)

    node_scores = [_score_component(str(n.get("connection_status") or "never_seen")) for n in network]
    camera_scores = [_score_component(str(c.get("connection_status") or "never_seen")) for c in cameras]
    device_scores = [_score_component(str(d.get("connection_status") or "never_seen")) for d in devices]
    all_scores = node_scores + camera_scores + device_scores
    health_score = round(sum(all_scores) / len(all_scores), 1) if all_scores else 100.0

    offline_nodes = [n for n in network if n.get("connection_status") == "offline"]
    offline_cameras = [c for c in cameras if c.get("connection_status") == "offline"]
    warning_nodes = [n for n in network if n.get("connection_status") == "warning"]

    root_cause = None
    confidence = None
    evidence: List[str] = []

    offline_poe = [n for n in offline_nodes if n.get("node_type") == "poe_switch"]
    offline_router = [n for n in offline_nodes if n.get("node_type") in {"router", "wan", "modem"}]
    ups_on_battery = [
        n for n in network
        if (n.get("last_health") or {}).get("ups_on_battery") is True
    ]

    if offline_router and len(offline_cameras) >= 2:
        root_cause = "upstream_network"
        confidence = 0.92
        evidence = [f"{len(offline_cameras)} cameras offline", f"{len(offline_router)} upstream network node offline"]
    elif offline_poe and len(offline_cameras) >= 2:
        root_cause = "poe_switch"
        confidence = 0.9
        evidence = [f"{len(offline_cameras)} cameras offline", f"{len(offline_poe)} PoE switch offline"]
    elif ups_on_battery and (offline_cameras or offline_nodes):
        root_cause = "power_instability"
        confidence = 0.78
        evidence = ["UPS reports battery mode", f"{len(offline_cameras)} cameras offline", f"{len(offline_nodes)} network nodes offline"]
    elif offline_cameras:
        root_cause = "camera_or_local_link"
        confidence = 0.55
        evidence = [f"{len(offline_cameras)} cameras offline", "No shared upstream failure confirmed"]

    return {
        "ok": True,
        "site_id": site_id,
        "health_score": health_score,
        "summary": {
            "network_nodes": len(network),
            "network_offline": len(offline_nodes),
            "network_warning": len(warning_nodes),
            "cameras": len(cameras),
            "cameras_offline": len(offline_cameras),
            "devices": len(devices),
            "devices_offline": len([d for d in devices if d.get("connection_status") == "offline"]),
        },
        "root_cause": {
            "classification": root_cause,
            "confidence": confidence,
            "evidence": evidence,
        } if root_cause else None,
        "network": network,
    }
