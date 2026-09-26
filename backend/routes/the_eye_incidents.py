"""The Eye incident correlation and alert center foundation."""

from __future__ import annotations

import secrets
from datetime import datetime, timezone
from typing import Any, Dict, List, Literal, Optional

from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel, Field

from core.database import db
from core.security import get_current_user
from core.the_eye_live import broadcast_the_eye_event


router = APIRouter(prefix="/api/the-eye", tags=["The Eye Incidents"])

Severity = Literal["info", "low", "medium", "high", "critical"]
IncidentStatus = Literal[
    "new",
    "acknowledged",
    "investigating",
    "mitigating",
    "resolved",
    "closed",
]


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


async def _require_admin(request: Request) -> dict:
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin required")
    return user


class IncidentCreate(BaseModel):
    title: str = Field(..., min_length=3, max_length=240)
    severity: Severity = "medium"
    site_id: Optional[str] = Field(default=None, max_length=128)
    location_id: Optional[str] = Field(default=None, max_length=128)
    category: str = Field(default="operations", max_length=80)
    root_cause: Optional[str] = Field(default=None, max_length=160)
    confidence: Optional[float] = Field(default=None, ge=0, le=1)
    evidence: List[str] = Field(default_factory=list, max_length=100)
    affected_devices: List[str] = Field(default_factory=list, max_length=5000)
    affected_cameras: List[str] = Field(default_factory=list, max_length=5000)
    affected_network_nodes: List[str] = Field(default_factory=list, max_length=1000)
    metadata: Dict[str, Any] = Field(default_factory=dict)


class IncidentStatusUpdate(BaseModel):
    status: IncidentStatus
    note: Optional[str] = Field(default=None, max_length=2000)


def _severity_for_counts(camera_count: int, device_count: int, network_count: int) -> Severity:
    affected = camera_count + device_count + network_count
    if network_count > 0 and camera_count >= 10:
        return "critical"
    if affected >= 20:
        return "critical"
    if affected >= 8:
        return "high"
    if affected >= 3:
        return "medium"
    return "low"


async def _site_snapshot(site_id: str) -> dict:
    network = await db.the_eye_network_nodes.find(
        {"site_id": site_id, "status": {"$ne": "disabled"}},
        {"_id": 0},
    ).to_list(1000)
    cameras = await db.the_eye_cameras.find(
        {"site_id": site_id, "status": {"$ne": "disabled"}},
        {"_id": 0, "stream_path": 0, "privacy_masks": 0, "metadata": 0},
    ).to_list(5000)
    devices = await db.the_eye_devices.find(
        {"site_id": site_id, "status": {"$ne": "disabled"}},
        {"_id": 0, "token_hash": 0, "metadata": 0, "last_telemetry": 0},
    ).to_list(10000)

    offline_nodes = [n for n in network if n.get("connection_status") == "offline"]
    offline_cameras = [c for c in cameras if c.get("connection_status") == "offline"]
    offline_devices = [d for d in devices if d.get("connection_status") == "offline"]

    offline_poe = [n for n in offline_nodes if n.get("node_type") == "poe_switch"]
    offline_upstream = [
        n for n in offline_nodes
        if n.get("node_type") in {"router", "wan", "modem"}
    ]
    ups_on_battery = [
        n for n in network
        if (n.get("last_health") or {}).get("ups_on_battery") is True
    ]

    root_cause = None
    confidence = None
    evidence: List[str] = []

    if offline_upstream and len(offline_cameras) >= 2:
        root_cause = "upstream_network"
        confidence = 0.92
        evidence = [
            f"{len(offline_cameras)} cameras offline",
            f"{len(offline_upstream)} upstream node(s) offline",
        ]
    elif offline_poe and len(offline_cameras) >= 2:
        root_cause = "poe_switch"
        confidence = 0.90
        evidence = [
            f"{len(offline_cameras)} cameras offline",
            f"{len(offline_poe)} PoE switch(es) offline",
        ]
    elif ups_on_battery and (offline_cameras or offline_nodes):
        root_cause = "power_instability"
        confidence = 0.78
        evidence = [
            "UPS reports battery mode",
            f"{len(offline_cameras)} cameras offline",
            f"{len(offline_nodes)} network nodes offline",
        ]
    elif offline_cameras:
        root_cause = "camera_or_local_link"
        confidence = 0.55
        evidence = [
            f"{len(offline_cameras)} cameras offline",
            "No shared upstream failure confirmed",
        ]

    return {
        "network": network,
        "cameras": cameras,
        "devices": devices,
        "offline_nodes": offline_nodes,
        "offline_cameras": offline_cameras,
        "offline_devices": offline_devices,
        "root_cause": root_cause,
        "confidence": confidence,
        "evidence": evidence,
    }


async def _find_open_correlated_incident(site_id: str, root_cause: Optional[str]) -> Optional[dict]:
    query: Dict[str, Any] = {
        "site_id": site_id,
        "status": {"$nin": ["resolved", "closed"]},
    }
    if root_cause:
        query["root_cause"] = root_cause
    return await db.the_eye_incidents.find_one(query, {"_id": 0})


@router.post("/admin/incidents")
async def create_incident(req: IncidentCreate, request: Request):
    admin = await _require_admin(request)
    now = _now()
    incident_id = "INC-" + secrets.token_hex(8).upper()
    doc = {
        "incident_id": incident_id,
        "title": req.title,
        "severity": req.severity,
        "status": "new",
        "site_id": req.site_id,
        "location_id": req.location_id,
        "category": req.category,
        "root_cause": req.root_cause,
        "confidence": req.confidence,
        "evidence": req.evidence,
        "affected_devices": list(dict.fromkeys(req.affected_devices)),
        "affected_cameras": list(dict.fromkeys(req.affected_cameras)),
        "affected_network_nodes": list(dict.fromkeys(req.affected_network_nodes)),
        "metadata": req.metadata,
        "created_at": now,
        "updated_at": now,
        "created_by": str(admin.get("_id") or admin.get("id") or admin.get("email")),
        "timeline": [{
            "at": now,
            "type": "created",
            "by": str(admin.get("_id") or admin.get("id") or admin.get("email")),
            "note": "Incident created",
        }],
    }
    await db.the_eye_incidents.insert_one(doc)
    doc.pop("_id", None)
    await broadcast_the_eye_event("incident.created", doc)
    return {"ok": True, "incident": doc}


@router.post("/admin/incidents/correlate-site/{site_id}")
async def correlate_site_incident(site_id: str, request: Request):
    admin = await _require_admin(request)
    snapshot = await _site_snapshot(site_id)

    offline_cameras = snapshot["offline_cameras"]
    offline_devices = snapshot["offline_devices"]
    offline_nodes = snapshot["offline_nodes"]

    if not (offline_cameras or offline_devices or offline_nodes):
        return {
            "ok": True,
            "created": False,
            "message": "No current outage signals to correlate",
            "site_id": site_id,
        }

    root_cause = snapshot["root_cause"]
    existing = await _find_open_correlated_incident(site_id, root_cause)
    now = _now()

    affected_cameras = [c.get("camera_id") for c in offline_cameras if c.get("camera_id")]
    affected_devices = [d.get("device_id") for d in offline_devices if d.get("device_id")]
    affected_nodes = [n.get("node_id") for n in offline_nodes if n.get("node_id")]
    severity = _severity_for_counts(
        len(affected_cameras),
        len(affected_devices),
        len(affected_nodes),
    )

    if existing:
        update = {
            "severity": severity,
            "root_cause": root_cause,
            "confidence": snapshot["confidence"],
            "evidence": snapshot["evidence"],
            "affected_cameras": affected_cameras,
            "affected_devices": affected_devices,
            "affected_network_nodes": affected_nodes,
            "updated_at": now,
        }
        await db.the_eye_incidents.update_one(
            {"incident_id": existing["incident_id"]},
            {
                "$set": update,
                "$push": {
                    "timeline": {
                        "at": now,
                        "type": "correlated",
                        "by": str(admin.get("_id") or admin.get("id") or admin.get("email")),
                        "note": "Correlation refreshed",
                    }
                },
            },
        )
        fresh = await db.the_eye_incidents.find_one(
            {"incident_id": existing["incident_id"]},
            {"_id": 0},
        )
        await broadcast_the_eye_event("incident.updated", fresh)
        return {"ok": True, "created": False, "incident": fresh}

    incident_id = "INC-" + secrets.token_hex(8).upper()
    title = f"Site {site_id}: {len(affected_cameras)} camera(s), {len(affected_nodes)} network node(s) affected"
    doc = {
        "incident_id": incident_id,
        "title": title,
        "severity": severity,
        "status": "new",
        "site_id": site_id,
        "location_id": None,
        "category": "site_outage",
        "root_cause": root_cause,
        "confidence": snapshot["confidence"],
        "evidence": snapshot["evidence"],
        "affected_devices": affected_devices,
        "affected_cameras": affected_cameras,
        "affected_network_nodes": affected_nodes,
        "metadata": {"auto_correlated": True},
        "created_at": now,
        "updated_at": now,
        "created_by": "the_eye_correlation_engine",
        "timeline": [{
            "at": now,
            "type": "auto_correlated",
            "by": "the_eye_correlation_engine",
            "note": "Grouped related site outage signals into one incident",
        }],
    }
    await db.the_eye_incidents.insert_one(doc)
    doc.pop("_id", None)
    await broadcast_the_eye_event("incident.created", doc)
    return {"ok": True, "created": True, "incident": doc}


@router.get("/admin/incidents")
async def list_incidents(
    request: Request,
    status: Optional[str] = None,
    severity: Optional[str] = None,
    site_id: Optional[str] = None,
    limit: int = Query(default=200, ge=1, le=2000),
):
    await _require_admin(request)
    query: Dict[str, Any] = {}
    if status:
        query["status"] = status
    if severity:
        query["severity"] = severity
    if site_id:
        query["site_id"] = site_id
    rows = await db.the_eye_incidents.find(query, {"_id": 0}).sort("updated_at", -1).to_list(limit)
    return {"ok": True, "count": len(rows), "incidents": rows}


@router.get("/admin/incidents/summary")
async def incident_summary(request: Request):
    await _require_admin(request)
    rows = await db.the_eye_incidents.aggregate([
        {
            "$match": {
                "status": {"$nin": ["resolved", "closed"]},
            }
        },
        {
            "$group": {
                "_id": "$severity",
                "count": {"$sum": 1},
            }
        },
    ]).to_list(20)
    counts = {str(row.get("_id") or "unknown"): int(row.get("count") or 0) for row in rows}
    return {
        "ok": True,
        "open_total": sum(counts.values()),
        "by_severity": counts,
    }


@router.get("/admin/incidents/{incident_id}")
async def get_incident(incident_id: str, request: Request):
    await _require_admin(request)
    row = await db.the_eye_incidents.find_one({"incident_id": incident_id}, {"_id": 0})
    if not row:
        raise HTTPException(status_code=404, detail="Incident not found")
    return {"ok": True, "incident": row}


@router.patch("/admin/incidents/{incident_id}/status")
async def update_incident_status(
    incident_id: str,
    req: IncidentStatusUpdate,
    request: Request,
):
    admin = await _require_admin(request)
    current = await db.the_eye_incidents.find_one(
        {"incident_id": incident_id},
        {"_id": 0},
    )
    if not current:
        raise HTTPException(status_code=404, detail="Incident not found")

    now = _now()
    actor = str(admin.get("_id") or admin.get("id") or admin.get("email"))
    timeline_entry = {
        "at": now,
        "type": "status_changed",
        "by": actor,
        "from": current.get("status"),
        "to": req.status,
        "note": req.note,
    }
    update: Dict[str, Any] = {"status": req.status, "updated_at": now}
    if req.status == "acknowledged":
        update["acknowledged_at"] = now
        update["acknowledged_by"] = actor
    if req.status == "resolved":
        update["resolved_at"] = now
        update["resolved_by"] = actor
    if req.status == "closed":
        update["closed_at"] = now
        update["closed_by"] = actor

    await db.the_eye_incidents.update_one(
        {"incident_id": incident_id},
        {"$set": update, "$push": {"timeline": timeline_entry}},
    )
    fresh = await db.the_eye_incidents.find_one({"incident_id": incident_id}, {"_id": 0})
    await broadcast_the_eye_event("incident.updated", fresh)
    return {"ok": True, "incident": fresh}
