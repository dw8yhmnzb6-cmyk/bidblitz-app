"""AION intelligence layer for The Eye.

Read-only analysis is available directly. Any state-changing action is prepared
first and must pass the existing Approval Center before execution.
"""

from __future__ import annotations

import secrets
from datetime import datetime, timezone
from typing import Any, Dict, Literal, Optional

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from pymongo.errors import DuplicateKeyError

from core.database import db
from core.the_eye_access import require_the_eye_access
from core.the_eye_data_safety import safe_the_eye_document, sanitize_the_eye_payload
from core.the_eye_live import broadcast_the_eye_event
from core.the_eye_guard import require_the_eye_writes_allowed


router = APIRouter(prefix="/api/the-eye", tags=["The Eye AION"])


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


async def _require_admin(request: Request) -> dict:
    access = await require_the_eye_access(request, {"super_admin", "admin"})
    return dict(access.user)


def _actor_id(user: dict) -> str:
    return str(user.get("_id") or user.get("id") or user.get("email"))


class AionQuery(BaseModel):
    question: str = Field(..., min_length=2, max_length=2000)
    context: Dict[str, Any] = Field(default_factory=dict)


class AionActionPrepare(BaseModel):
    action_type: Literal[
        "restart_device",
        "create_ticket",
        "bulk_restart",
        "bulk_ota",
        "disable_site",
        "config_change",
    ]
    target_type: str = Field(..., min_length=2, max_length=120)
    target_id: Optional[str] = Field(default=None, max_length=160)
    project: Optional[str] = Field(default=None, max_length=120)
    site_id: Optional[str] = Field(default=None, max_length=160)
    payload: Dict[str, Any] = Field(default_factory=dict)
    reason: str = Field(..., min_length=3, max_length=2000)


async def _project_summary() -> dict:
    projects = await db.the_eye_projects.find({}, {"_id": 0}).to_list(2000)
    rows = []
    for project in projects:
        snap = project.get("last_snapshot") or {}
        rows.append({
            "project_key": project.get("project_key"),
            "name": project.get("name"),
            "status": project.get("status"),
            "health_score": project.get("health_score"),
            "risk_score": project.get("risk_score"),
            "data_trust_score": project.get("data_trust_score"),
            "revenue": float(snap.get("revenue") or 0),
            "cost": float(snap.get("cost") or 0),
            "profit": float(snap.get("profit") or 0),
            "open_incidents": int(snap.get("open_incidents") or 0),
        })
    rows.sort(key=lambda row: (
        0 if row.get("status") in {"critical", "offline"} else 1,
        -(float(row.get("risk_score") or 0)),
    ))
    return {
        "count": len(rows),
        "revenue": round(sum(row["revenue"] for row in rows), 2),
        "cost": round(sum(row["cost"] for row in rows), 2),
        "profit": round(sum(row["profit"] for row in rows), 2),
        "projects": rows[:10],
    }


async def _incident_summary() -> dict:
    rows = await db.the_eye_incidents.find(
        {"status": {"$nin": ["resolved", "closed"]}},
        {"_id": 0},
    ).sort([("severity", -1), ("updated_at", -1)]).to_list(200)
    return {
        "count": len(rows),
        "critical": sum(1 for row in rows if row.get("severity") == "critical"),
        "high": sum(1 for row in rows if row.get("severity") == "high"),
        "incidents": rows[:10],
    }


async def _device_summary() -> dict:
    total = await db.the_eye_devices.count_documents({"status": {"$ne": "disabled"}})
    online = await db.the_eye_devices.count_documents({
        "status": {"$ne": "disabled"},
        "connection_status": "online",
    })
    warning = await db.the_eye_devices.count_documents({
        "status": {"$ne": "disabled"},
        "connection_status": "warning",
    })
    offline = max(total - online - warning, 0)
    return {
        "total": total,
        "online": online,
        "warning": warning,
        "offline": offline,
    }


async def _provider_summary() -> dict:
    rows = await db.the_eye_providers.find({}, {"_id": 0}).sort("risk_score", -1).to_list(200)
    return {
        "count": len(rows),
        "down": sum(1 for row in rows if row.get("status") in {"partial_outage", "down"}),
        "high_risk": sum(1 for row in rows if row.get("risk_level") in {"high", "critical"}),
        "without_fallback": sum(1 for row in rows if not row.get("fallback_provider_id")),
        "providers": rows[:10],
    }


async def _security_summary() -> dict:
    events = await db.the_eye_security_events.find(
        {"status": {"$ne": "resolved"}},
        {"_id": 0},
    ).sort("risk_score", -1).to_list(200)
    approvals = await db.the_eye_approvals.find(
        {"status": "pending"},
        {"_id": 0},
    ).sort("created_at", -1).to_list(100)
    return {
        "open_events": len(events),
        "critical": sum(1 for row in events if row.get("severity") == "critical"),
        "pending_approvals": len(approvals),
        "events": events[:10],
        "approvals": approvals[:10],
    }


async def _quality_summary(project: Optional[str] = None) -> dict:
    source_query: Dict[str, Any] = {}
    issue_query: Dict[str, Any] = {"status": {"$ne": "resolved"}}
    if project:
        source_query["project"] = project
        issue_query["project"] = project

    sources = await db.the_eye_data_sources.find(source_query, {"_id": 0}).to_list(2000)
    issues = await db.the_eye_data_quality_issues.find(
        issue_query,
        {"_id": 0},
    ).sort("created_at", -1).to_list(200)

    scores = [float(row.get("trust_score") or 0) for row in sources]
    trust = round(sum(scores) / len(scores), 1) if scores else None
    state = (
        "unknown"
        if trust is None
        else "trusted"
        if trust >= 90
        else "acceptable"
        if trust >= 70
        else "degraded"
        if trust >= 50
        else "unreliable"
    )
    return {
        "trust": trust,
        "state": state,
        "sources": len(sources),
        "issues": len(issues),
        "conflicts": sum(1 for row in issues if row.get("issue_type") == "data_conflict"),
        "recent_issues": issues[:10],
    }


def _confidence_for_quality(base: float, quality: dict) -> float:
    trust = quality.get("trust")
    if trust is None:
        return min(base, 0.35)
    trust = float(trust)
    if trust >= 90:
        return min(base, 0.92)
    if trust >= 70:
        return min(base, 0.78)
    if trust >= 50:
        return min(base, 0.58)
    return min(base, 0.35)


ACTION_MIN_DATA_TRUST = {
    "create_ticket": 0.0,
    "restart_device": 70.0,
    "bulk_restart": 90.0,
    "bulk_ota": 90.0,
    "disable_site": 90.0,
    "config_change": 90.0,
}


def _assert_action_data_trust(action_type: str, quality: dict) -> float:
    minimum = float(ACTION_MIN_DATA_TRUST.get(action_type, 90.0))
    if minimum <= 0:
        return minimum
    trust = quality.get("trust")
    if trust is None:
        raise HTTPException(
            status_code=409,
            detail=f"AION action blocked: data trust is UNKNOWN; minimum required is {minimum:.0f}",
        )
    if float(trust) < minimum:
        raise HTTPException(
            status_code=409,
            detail=f"AION action blocked: data trust {float(trust):.1f} is below required {minimum:.0f}",
        )
    return minimum


async def _maintenance_summary() -> dict:
    return {
        "work_orders": await db.the_eye_work_orders.count_documents(
            {"status": {"$nin": ["completed", "cancelled"]}}
        ),
        "waiting_parts": await db.the_eye_work_orders.count_documents(
            {"status": "waiting_parts"}
        ),
        "tickets": await db.the_eye_tickets.count_documents(
            {"status": {"$nin": ["resolved", "closed", "cancelled"]}}
        ),
        "rma": await db.the_eye_rma.count_documents(
            {"status": {"$nin": ["closed", "credited", "rejected"]}}
        ),
    }


def _detect_intent(question: str) -> str:
    q = question.lower()
    mapping = [
        ("security", ["security", "sicherheit", "angriff", "login", "api missbrauch", "fraud"]),
        ("providers", ["provider", "anbieter", "stripe", "openai", "cloudflare", "ausfall"]),
        ("incidents", ["incident", "störung", "fehler", "offline", "root cause", "ursache"]),
        ("maintenance", ["wartung", "techniker", "ticket", "ersatzteil", "rma", "maintenance"]),
        ("data_quality", ["datenqualität", "data quality", "trust", "freshness", "konflikt", "stale"]),
        ("devices", ["gerät", "geräte", "device", "kamera", "cameras", "online"]),
        ("projects", ["projekt", "projekte", "project", "trade", "power", "charging", "bidblitz"]),
        ("executive", ["gesamt", "übersicht", "summary", "executive", "heute", "brief", "lage"]),
    ]
    for intent, words in mapping:
        if any(word in q for word in words):
            return intent
    return "executive"


def _fact(label: str, value: Any) -> dict:
    return {"kind": "fact", "label": label, "value": value}


@router.post("/admin/aion/query")
async def aion_query(req: AionQuery, request: Request):
    admin = await _require_admin(request)
    intent = _detect_intent(req.question)

    quality = await _quality_summary()
    confidence = _confidence_for_quality(0.92, quality)
    facts = []
    analysis = []
    assumptions = []

    if quality["trust"] is None:
        assumptions.append(
            "Data Trust ist UNKNOWN, weil keine normalisierten Datenquellen vorliegen."
        )
    elif float(quality["trust"]) < 50:
        assumptions.append(
            "Data Trust ist unzuverlässig; AION behandelt operative Schlussfolgerungen als unsicher."
        )
    elif float(quality["trust"]) < 70:
        assumptions.append(
            "Data Trust ist degradiert; AION reduziert die Aussagekonfidenz."
        )

    if intent == "projects":
        data = await _project_summary()
        facts = [
            _fact("Projekte", data["count"]),
            _fact("Umsatz", data["revenue"]),
            _fact("Kosten", data["cost"]),
            _fact("Profit", data["profit"]),
        ]
        risky = [p for p in data["projects"] if p.get("status") in {"warning", "degraded", "critical", "offline"}]
        analysis.append(
            f"{len(risky)} der geladenen Projekte zeigen aktuell einen Status außerhalb von healthy."
            if risky else "Die geladenen Projekte zeigen aktuell keinen Status außerhalb von healthy."
        )
        source = data
    elif intent == "incidents":
        data = await _incident_summary()
        facts = [
            _fact("Offene Incidents", data["count"]),
            _fact("Critical", data["critical"]),
            _fact("High", data["high"]),
        ]
        if data["incidents"]:
            top = data["incidents"][0]
            assessment = top.get("root_cause_assessment") or {}
            likely_cause = (
                assessment.get("likely_cause")
                or top.get("root_cause")
                or "noch offen"
            )
            cause_confidence = assessment.get("confidence")
            confidence_text = (
                f" ({round(float(cause_confidence) * 100)}% Confidence)"
                if cause_confidence is not None
                else ""
            )
            analysis.append(
                f"Priorität hat aktuell {top.get('incident_id')} mit Severity "
                f"{top.get('severity')}. Likely Cause: {likely_cause}{confidence_text}."
            )
        source = data
    elif intent == "devices":
        data = await _device_summary()
        facts = [
            _fact("Geräte gesamt", data["total"]),
            _fact("Online", data["online"]),
            _fact("Warning", data["warning"]),
            _fact("Offline/sonstige", data["offline"]),
        ]
        if data["total"]:
            online_ratio = round(data["online"] / data["total"] * 100, 1)
            analysis.append(f"{online_ratio}% der aktiven Geräte melden aktuell online.")
        source = data
    elif intent == "providers":
        data = await _provider_summary()
        facts = [
            _fact("Provider", data["count"]),
            _fact("Down/Partial", data["down"]),
            _fact("High Risk", data["high_risk"]),
            _fact("Ohne Fallback", data["without_fallback"]),
        ]
        if data["without_fallback"]:
            analysis.append("Mindestens ein Provider ist ohne registrierten Fallback und stellt damit ein erhöhtes Abhängigkeitsrisiko dar.")
        source = data
    elif intent == "security":
        data = await _security_summary()
        facts = [
            _fact("Offene Security Events", data["open_events"]),
            _fact("Critical", data["critical"]),
            _fact("Wartende Freigaben", data["pending_approvals"]),
        ]
        if data["critical"]:
            analysis.append("Kritische Security Events sollten vor nicht notwendigen administrativen Änderungen priorisiert werden.")
        source = data
    elif intent == "data_quality":
        data = quality
        facts = [
            _fact("Trust Score", data["trust"]),
            _fact("Datenquellen", data["sources"]),
            _fact("Offene Issues", data["issues"]),
            _fact("Konflikte", data["conflicts"]),
        ]
        if data["trust"] is None:
            analysis.append(
                "Es liegen keine normalisierten Datenquellen vor; der Data-Trust-Status ist UNKNOWN."
            )
        elif float(data["trust"]) < 80:
            analysis.append(
                "Der aktuelle Data-Trust-Wert reduziert die Verlässlichkeit der AION-Analyse."
            )
        source = data
    elif intent == "maintenance":
        data = await _maintenance_summary()
        facts = [
            _fact("Work Orders", data["work_orders"]),
            _fact("Warten auf Teile", data["waiting_parts"]),
            _fact("Tickets", data["tickets"]),
            _fact("RMA", data["rma"]),
        ]
        if data["waiting_parts"]:
            analysis.append("Offene Work Orders mit fehlenden Teilen können die Wiederherstellungszeit verlängern.")
        source = data
    else:
        projects = await _project_summary()
        incidents = await _incident_summary()
        security = await _security_summary()
        providers = await _provider_summary()
        facts = [
            _fact("Projekte", projects["count"]),
            _fact("Profit", projects["profit"]),
            _fact("Offene Incidents", incidents["count"]),
            _fact("Security Events", security["open_events"]),
            _fact("Provider High Risk", providers["high_risk"]),
            _fact("Data Trust", quality["trust"]),
        ]
        if incidents["critical"]:
            analysis.append(f"{incidents['critical']} kritische Incidents sind aktuell offen.")
        if security["critical"]:
            analysis.append(f"{security['critical']} kritische Security Events sind aktuell offen.")
        if providers["high_risk"]:
            analysis.append(f"{providers['high_risk']} Provider sind als high/critical risk markiert.")
        source = {
            "projects": projects,
            "incidents": incidents,
            "security": security,
            "providers": providers,
            "data_quality": quality,
        }

    if not facts:
        confidence = min(confidence, 0.5)
        assumptions.append("Für diese Frage liegen noch keine normalisierten The-Eye-Daten vor.")

    answer = {
        "intent": intent,
        "facts": facts,
        "analysis": analysis,
        "assumptions": assumptions,
        "confidence": confidence,
        "data_quality": {
            "trust_score": quality.get("trust"),
            "trust_state": quality.get("state"),
            "sources": quality.get("sources"),
        },
        "source_snapshot": source,
    }

    session_id = req.context.get("session_id") or ("AION-" + secrets.token_hex(8).upper())
    now = _now()
    await db.the_eye_aion_messages.insert_one({
        "session_id": session_id,
        "user_id": _actor_id(admin),
        "question": req.question,
        "answer": answer,
        "context": sanitize_the_eye_payload(req.context),
        "created_at": now,
    })
    await broadcast_the_eye_event("aion.answer", {
        "session_id": session_id,
        "intent": intent,
        "confidence": confidence,
        "created_at": now,
    })
    return {"ok": True, "session_id": session_id, "answer": answer}


@router.post("/admin/aion/actions/prepare")
async def prepare_aion_action(req: AionActionPrepare, request: Request):
    admin = await _require_admin(request)
    quality = await _quality_summary(req.project)
    minimum_data_trust = _assert_action_data_trust(req.action_type, quality)
    now = _now()
    approval_id = "APR-" + secrets.token_hex(10).upper()

    high_impact = req.action_type in {"bulk_restart", "bulk_ota", "disable_site", "config_change"}
    mode = "four_eyes" if high_impact else "single"
    risk_level = "critical" if req.action_type in {"bulk_ota", "disable_site"} else "high"

    dry_run = {
        "action_type": req.action_type,
        "target_type": req.target_type,
        "target_id": req.target_id,
        "site_id": req.site_id,
        "payload_keys": sorted(req.payload.keys()),
        "will_execute_now": False,
    }
    impact = {
        "state_change": True,
        "high_impact": high_impact,
        "requires_approval": True,
    }

    doc = {
        "approval_id": approval_id,
        "title": f"AION: {req.action_type}",
        "action_type": req.action_type,
        "target_type": req.target_type,
        "target_id": req.target_id,
        "project": req.project,
        "site_id": req.site_id,
        "mode": mode,
        "risk_level": risk_level,
        "dry_run": dry_run,
        "impact": impact,
        "data_trust_score": quality.get("trust"),
        "data_trust_state": quality.get("state"),
        "minimum_data_trust": minimum_data_trust,
        "proposed_payload": sanitize_the_eye_payload(req.payload),
        "reason": req.reason,
        "status": "pending",
        "requested_by": _actor_id(admin),
        "approved_by": [],
        "created_at": now,
        "updated_at": now,
        "source": "aion",
    }
    await db.the_eye_approvals.insert_one(doc)
    doc.pop("_id", None)
    await db.the_eye_aion_actions.insert_one({
        "action_id": "AIA-" + secrets.token_hex(8).upper(),
        "approval_id": approval_id,
        "requested_by": _actor_id(admin),
        "action_type": req.action_type,
        "status": "pending_approval",
        "created_at": now,
    })
    await broadcast_the_eye_event("approval.created", doc)
    return {
        "ok": True,
        "approval": doc,
        "message": "Action prepared only. No state-changing command has been executed.",
    }


@router.post("/admin/aion/actions/{approval_id}/execute")
async def execute_aion_action(approval_id: str, request: Request):
    admin = await _require_admin(request)
    await require_the_eye_writes_allowed("aion_execute")
    approval = await db.the_eye_approvals.find_one({"approval_id": approval_id}, {"_id": 0})
    if not approval:
        raise HTTPException(status_code=404, detail="Approval not found")
    if approval.get("status") != "approved":
        raise HTTPException(status_code=409, detail="Action is not approved")

    action_type = approval.get("action_type")
    target_id = approval.get("target_id")
    payload = approval.get("proposed_payload") or {}

    quality = await _quality_summary(approval.get("project"))
    _assert_action_data_trust(str(action_type or ""), quality)

    now = _now()
    result: Dict[str, Any]

    if action_type == "restart_device":
        if not target_id:
            raise HTTPException(status_code=400, detail="Target device required")
        device = await db.the_eye_devices.find_one(
            {"device_id": target_id, "status": {"$ne": "disabled"}},
            {"_id": 0, "device_id": 1},
        )
        if not device:
            raise HTTPException(status_code=404, detail="Device not found or disabled")

        command_id = "CMD-" + secrets.token_hex(8).upper()
        idempotency_key = f"aion:{approval_id}"
        now_dt = datetime.now(timezone.utc)
        expires_at = datetime.fromtimestamp(
            now_dt.timestamp() + 300,
            tz=timezone.utc,
        ).isoformat()
        command = {
            "command_id": command_id,
            "execution_key": command_id,
            "idempotency_key": idempotency_key,
            "device_id": target_id,
            "site_id": approval.get("site_id"),
            "command": "restart",
            "payload": payload,
            "status": "queued",
            "delivery_attempts": 0,
            "created_at": now,
            "expires_at": expires_at,
            "created_by": _actor_id(admin),
            "approval_id": approval_id,
            "source": "aion",
            "delivered_at": None,
            "ack_deadline_at": None,
            "acknowledged_at": None,
            "accepted_at": None,
            "completed_at": None,
            "unknown_at": None,
            "unknown_reason": None,
            "result": None,
        }
        existing = await db.the_eye_device_commands.find_one(
            {"device_id": target_id, "idempotency_key": idempotency_key},
            {"_id": 0},
        )
        if existing:
            command = existing
        else:
            try:
                await db.the_eye_device_commands.insert_one(command)
                command.pop("_id", None)
                await broadcast_the_eye_event("command.queued", command)
            except DuplicateKeyError:
                command = await db.the_eye_device_commands.find_one(
                    {"device_id": target_id, "idempotency_key": idempotency_key},
                    {"_id": 0},
                )
                if not command:
                    raise
        result = {"command": safe_the_eye_document(command)}
    elif action_type == "create_ticket":
        ticket_id = "TKT-" + secrets.token_hex(8).upper()
        ticket = {
            "ticket_id": ticket_id,
            "title": payload.get("title") or f"AION action for {target_id or 'target'}",
            "description": payload.get("description") or approval.get("reason"),
            "priority": payload.get("priority") or "p3",
            "category": payload.get("category") or "other",
            "status": "open",
            "incident_id": payload.get("incident_id"),
            "site_id": approval.get("site_id"),
            "device_id": target_id if approval.get("target_type") == "device" else None,
            "created_at": now,
            "updated_at": now,
            "created_by": _actor_id(admin),
            "source": "aion",
        }
        await db.the_eye_tickets.insert_one(ticket)
        ticket.pop("_id", None)
        await broadcast_the_eye_event("ticket.created", ticket)
        result = {"ticket": ticket}
    else:
        raise HTTPException(
            status_code=409,
            detail="Approved action type is not executable by the current AION tool adapter",
        )

    await db.the_eye_approvals.update_one(
        {"approval_id": approval_id},
        {"$set": {
            "status": "executed",
            "executed_at": now,
            "executed_by": _actor_id(admin),
            "execution_result": result,
            "updated_at": now,
        }},
    )
    await db.the_eye_aion_actions.update_one(
        {"approval_id": approval_id},
        {"$set": {
            "status": "executed",
            "executed_at": now,
            "executed_by": _actor_id(admin),
            "result": result,
        }},
    )
    await broadcast_the_eye_event("aion.action_executed", {
        "approval_id": approval_id,
        "action_type": action_type,
        "target_id": target_id,
        "result": result,
    })
    return {"ok": True, "approval_id": approval_id, "result": result}
