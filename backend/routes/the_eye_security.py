"""The Eye security intelligence, immutable-style audit and approval center."""

from __future__ import annotations

import hashlib
import json
import secrets
from datetime import datetime, timezone
from typing import Any, Dict, List, Literal, Optional

from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel, Field

from core.database import db
from core.the_eye_access import TheEyeAccess, require_the_eye_access
from core.the_eye_live import broadcast_the_eye_event


router = APIRouter(prefix="/api/the-eye", tags=["The Eye Security"])

SecuritySeverity = Literal["low", "medium", "high", "critical"]
ApprovalStatus = Literal["pending", "approved", "rejected", "cancelled", "executed", "expired"]
ApprovalMode = Literal["single", "four_eyes"]


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


async def _require_admin(request: Request) -> dict:
    access = await require_the_eye_access(request, {"super_admin", "admin"})
    return dict(access.user)


async def _require_security_reader(request: Request) -> TheEyeAccess:
    return await require_the_eye_access(
        request,
        {"super_admin", "admin", "project_admin", "site_manager"},
    )


async def _require_security_operator(request: Request) -> TheEyeAccess:
    return await require_the_eye_access(
        request,
        {"super_admin", "admin", "project_admin", "site_manager"},
    )


def _actor_id(user: dict) -> str:
    return str(user.get("_id") or user.get("id") or user.get("email"))


def _hash_payload(payload: Dict[str, Any]) -> str:
    raw = json.dumps(payload, sort_keys=True, separators=(",", ":"), default=str)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


async def _write_audit(
    *,
    actor: str,
    action: str,
    target_type: Optional[str] = None,
    target_id: Optional[str] = None,
    project: Optional[str] = None,
    project_id: Optional[str] = None,
    tenant_id: Optional[str] = None,
    customer_id: Optional[str] = None,
    site_id: Optional[str] = None,
    before: Any = None,
    after: Any = None,
    result: str = "success",
    source: str = "the_eye",
    metadata: Optional[Dict[str, Any]] = None,
) -> dict:
    now = _now()
    doc = {
        "audit_id": "AUD-" + secrets.token_hex(10).upper(),
        "actor": actor,
        "action": action,
        "target_type": target_type,
        "target_id": target_id,
        "project": project,
        "project_id": project_id,
        "tenant_id": tenant_id,
        "customer_id": customer_id,
        "site_id": site_id,
        "before": before,
        "after": after,
        "result": result,
        "source": source,
        "metadata": metadata or {},
        "created_at": now,
    }
    doc["integrity_hash"] = _hash_payload({k: v for k, v in doc.items() if k != "integrity_hash"})
    await db.the_eye_audit_logs.insert_one(doc)
    doc.pop("_id", None)
    await broadcast_the_eye_event("security.audit", doc)
    return doc


class SecurityEventCreate(BaseModel):
    event_type: str = Field(..., min_length=3, max_length=180)
    severity: SecuritySeverity = "medium"
    category: Literal[
        "auth",
        "device",
        "payment",
        "api",
        "account_takeover",
        "automation",
        "admin_action",
        "infrastructure",
        "trade",
        "other",
    ] = "other"
    project: Optional[str] = Field(default=None, max_length=120)
    project_id: Optional[str] = Field(default=None, max_length=160)
    tenant_id: Optional[str] = Field(default=None, max_length=160)
    customer_id: Optional[str] = Field(default=None, max_length=160)
    site_id: Optional[str] = Field(default=None, max_length=160)
    user_id: Optional[str] = Field(default=None, max_length=160)
    device_id: Optional[str] = Field(default=None, max_length=160)
    source_ip: Optional[str] = Field(default=None, max_length=128)
    description: str = Field(..., min_length=3, max_length=2000)
    signals: Dict[str, Any] = Field(default_factory=dict)
    metadata: Dict[str, Any] = Field(default_factory=dict)


class ApprovalCreate(BaseModel):
    title: str = Field(..., min_length=3, max_length=240)
    action_type: str = Field(..., min_length=3, max_length=160)
    target_type: Optional[str] = Field(default=None, max_length=120)
    target_id: Optional[str] = Field(default=None, max_length=160)
    project: Optional[str] = Field(default=None, max_length=120)
    project_id: Optional[str] = Field(default=None, max_length=160)
    tenant_id: Optional[str] = Field(default=None, max_length=160)
    customer_id: Optional[str] = Field(default=None, max_length=160)
    site_id: Optional[str] = Field(default=None, max_length=160)
    mode: ApprovalMode = "single"
    risk_level: Literal["medium", "high", "critical"] = "high"
    dry_run: Dict[str, Any] = Field(default_factory=dict)
    impact: Dict[str, Any] = Field(default_factory=dict)
    proposed_payload: Dict[str, Any] = Field(default_factory=dict)
    expires_at: Optional[str] = None
    reason: Optional[str] = Field(default=None, max_length=2000)


class ApprovalDecision(BaseModel):
    decision: Literal["approve", "reject", "cancel"]
    note: Optional[str] = Field(default=None, max_length=2000)


HIGH_IMPACT_ACTIONS = {
    "bulk_restart",
    "bulk_ota",
    "mass_command",
    "delete_recording",
    "revoke_api_key",
    "disable_site",
    "refund",
    "free_month",
    "trade_real_action",
    "config_change",
}


def _security_risk_score(severity: str, signals: Dict[str, Any]) -> int:
    score = {
        "low": 15,
        "medium": 35,
        "high": 65,
        "critical": 90,
    }.get(severity, 35)

    if signals.get("repeated_failures"):
        score += 8
    if signals.get("new_device"):
        score += 5
    if signals.get("privileged_action"):
        score += 10
    if signals.get("credential_issue"):
        score += 12
    if signals.get("mass_export"):
        score += 10
    return min(score, 100)



@router.post("/admin/security/events")
async def create_security_event(req: SecurityEventCreate, request: Request):
    access = await _require_security_operator(request)
    now = _now()
    event_id = "SEC-" + secrets.token_hex(10).upper()
    risk_score = _security_risk_score(req.severity, req.signals)
    doc = {
        "event_id": event_id,
        "event_type": req.event_type,
        "severity": req.severity,
        "category": req.category,
        "project": req.project,
        "project_id": req.project_id,
        "tenant_id": req.tenant_id,
        "customer_id": req.customer_id,
        "site_id": req.site_id,
        "user_id": req.user_id,
        "device_id": req.device_id,
        "source_ip": req.source_ip,
        "description": req.description,
        "signals": req.signals,
        "metadata": req.metadata,
        "risk_score": risk_score,
        "status": "open",
        "created_at": now,
        "updated_at": now,
        "created_by": access.actor_id,
    }
    access.assert_document(doc)
    await db.the_eye_security_events.insert_one(doc)
    doc.pop("_id", None)
    await _write_audit(
        actor=access.actor_id,
        action="security.event.create",
        target_type="security_event",
        target_id=event_id,
        project=req.project,
        project_id=req.project_id,
        tenant_id=req.tenant_id,
        customer_id=req.customer_id,
        site_id=req.site_id,
        after=doc,
    )
    await broadcast_the_eye_event("security.event", doc)
    return {"ok": True, "event": doc}


@router.get("/admin/security/events")
async def list_security_events(
    request: Request,
    severity: Optional[str] = None,
    category: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = Query(default=200, ge=1, le=2000),
):
    access = await _require_security_reader(request)
    query: Dict[str, Any] = {}
    if severity:
        query["severity"] = severity
    if category:
        query["category"] = category
    if status:
        query["status"] = status
    query = access.scope_query(query)
    rows = await db.the_eye_security_events.find(query, {"_id": 0}).sort(
        [("risk_score", -1), ("created_at", -1)]
    ).to_list(limit)
    return {"ok": True, "count": len(rows), "events": rows}


@router.patch("/admin/security/events/{event_id}/resolve")
async def resolve_security_event(event_id: str, request: Request):
    access = await _require_security_operator(request)
    current_query = access.scope_query({"event_id": event_id})
    current = await db.the_eye_security_events.find_one(current_query, {"_id": 0})
    if not current:
        raise HTTPException(status_code=404, detail="Security event not found")
    now = _now()
    await db.the_eye_security_events.update_one(
        current_query,
        {"$set": {
            "status": "resolved",
            "resolved_at": now,
            "resolved_by": access.actor_id,
            "updated_at": now,
        }},
    )
    fresh = await db.the_eye_security_events.find_one(current_query, {"_id": 0})
    await _write_audit(
        actor=access.actor_id,
        action="security.event.resolve",
        target_type="security_event",
        target_id=event_id,
        project=current.get("project"),
        project_id=current.get("project_id"),
        tenant_id=current.get("tenant_id"),
        customer_id=current.get("customer_id"),
        site_id=current.get("site_id"),
        before=current,
        after=fresh,
    )
    await broadcast_the_eye_event("security.event_resolved", fresh)
    return {"ok": True, "event": fresh}


@router.post("/admin/approvals")
async def create_approval(req: ApprovalCreate, request: Request):
    access = await _require_security_operator(request)
    high_impact = req.action_type in HIGH_IMPACT_ACTIONS
    if high_impact and not req.dry_run:
        raise HTTPException(status_code=400, detail="High-impact actions require a dry_run payload")

    now = _now()
    approval_id = "APR-" + secrets.token_hex(10).upper()
    effective_mode: ApprovalMode = "four_eyes" if high_impact else req.mode
    doc = {
        "approval_id": approval_id,
        "title": req.title,
        "action_type": req.action_type,
        "target_type": req.target_type,
        "target_id": req.target_id,
        "project": req.project,
        "project_id": req.project_id,
        "tenant_id": req.tenant_id,
        "customer_id": req.customer_id,
        "site_id": req.site_id,
        "mode": effective_mode,
        "risk_level": req.risk_level,
        "dry_run": req.dry_run,
        "impact": req.impact,
        "proposed_payload": req.proposed_payload,
        "reason": req.reason,
        "status": "pending",
        "requested_by": access.actor_id,
        "first_approved_by": None,
        "approved_by": [],
        "rejected_by": None,
        "expires_at": req.expires_at,
        "created_at": now,
        "updated_at": now,
    }
    access.assert_document(doc)
    await db.the_eye_approvals.insert_one(doc)
    doc.pop("_id", None)
    await _write_audit(
        actor=access.actor_id,
        action="approval.create",
        target_type=req.target_type,
        target_id=req.target_id,
        project=req.project,
        project_id=req.project_id,
        tenant_id=req.tenant_id,
        customer_id=req.customer_id,
        site_id=req.site_id,
        after=doc,
        metadata={"approval_id": approval_id},
    )
    await broadcast_the_eye_event("approval.created", doc)
    return {"ok": True, "approval": doc}


@router.get("/admin/approvals")
async def list_approvals(
    request: Request,
    status: Optional[str] = None,
    risk_level: Optional[str] = None,
    limit: int = Query(default=200, ge=1, le=2000),
):
    access = await _require_security_reader(request)
    query: Dict[str, Any] = {}
    if status:
        query["status"] = status
    if risk_level:
        query["risk_level"] = risk_level
    query = access.scope_query(query)
    rows = await db.the_eye_approvals.find(query, {"_id": 0}).sort("created_at", -1).to_list(limit)
    return {"ok": True, "count": len(rows), "approvals": rows}


@router.patch("/admin/approvals/{approval_id}/decision")
async def approval_decision(approval_id: str, req: ApprovalDecision, request: Request):
    access = await _require_security_operator(request)
    current_query = access.scope_query({"approval_id": approval_id})
    current = await db.the_eye_approvals.find_one(current_query, {"_id": 0})
    if not current:
        raise HTTPException(status_code=404, detail="Approval not found")
    if current.get("status") != "pending":
        raise HTTPException(status_code=409, detail="Approval is no longer pending")

    actor = access.actor_id
    now = _now()
    update: Dict[str, Any] = {"updated_at": now}
    if req.decision == "reject":
        update.update({"status": "rejected", "rejected_by": actor, "rejected_at": now, "decision_note": req.note})
    elif req.decision == "cancel":
        if actor != current.get("requested_by"):
            raise HTTPException(status_code=403, detail="Only requester can cancel")
        update.update({"status": "cancelled", "cancelled_by": actor, "cancelled_at": now, "decision_note": req.note})
    else:
        approved_by = list(current.get("approved_by") or [])
        if actor in approved_by:
            raise HTTPException(status_code=409, detail="This admin already approved")
        if current.get("mode") == "four_eyes" and actor == current.get("requested_by"):
            raise HTTPException(status_code=409, detail="Four-eyes approval requires a different admin")
        approved_by.append(actor)
        update["approved_by"] = approved_by
        update["decision_note"] = req.note
        update["status"] = "approved"
        update["approved_at"] = now

    await db.the_eye_approvals.update_one(current_query, {"$set": update})
    fresh = await db.the_eye_approvals.find_one(current_query, {"_id": 0})
    await _write_audit(
        actor=actor,
        action=f"approval.{req.decision}",
        target_type=current.get("target_type"),
        target_id=current.get("target_id"),
        project=current.get("project"),
        project_id=current.get("project_id"),
        tenant_id=current.get("tenant_id"),
        customer_id=current.get("customer_id"),
        site_id=current.get("site_id"),
        before=current,
        after=fresh,
        metadata={"approval_id": approval_id},
    )
    await broadcast_the_eye_event("approval.updated", fresh)
    return {"ok": True, "approval": fresh}


@router.get("/admin/audit")
async def list_audit_logs(
    request: Request,
    actor: Optional[str] = None,
    action: Optional[str] = None,
    target_type: Optional[str] = None,
    limit: int = Query(default=200, ge=1, le=2000),
):
    access = await _require_security_reader(request)
    query: Dict[str, Any] = {}
    if actor:
        query["actor"] = actor
    if action:
        query["action"] = action
    if target_type:
        query["target_type"] = target_type
    query = access.scope_query(query)
    rows = await db.the_eye_audit_logs.find(query, {"_id": 0}).sort("created_at", -1).to_list(limit)
    return {"ok": True, "count": len(rows), "audit_logs": rows}

@router.get("/admin/security/overview")
async def security_overview(request: Request):
    access = await _require_security_reader(request)
    event_query = access.scope_query({"status": {"$ne": "resolved"}})
    approval_query = access.scope_query({"status": "pending"})
    events = await db.the_eye_security_events.find(
        event_query, {"_id": 0}
    ).sort([("risk_score", -1), ("created_at", -1)]).to_list(1000)
    approvals = await db.the_eye_approvals.find(
        approval_query, {"_id": 0}
    ).sort("created_at", -1).to_list(1000)

    critical = sum(1 for row in events if row.get("severity") == "critical")
    high = sum(1 for row in events if row.get("severity") == "high")
    auth_events = sum(1 for row in events if row.get("category") in {"auth", "account_takeover"})
    device_events = sum(1 for row in events if row.get("category") == "device")
    api_events = sum(1 for row in events if row.get("category") == "api")
    return {
        "ok": True,
        "open_security_events": len(events),
        "critical": critical,
        "high": high,
        "auth_events": auth_events,
        "device_events": device_events,
        "api_events": api_events,
        "pending_approvals": len(approvals),
        "events": events[:20],
        "approvals": approvals[:20],
    }
