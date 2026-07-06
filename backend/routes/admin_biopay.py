from fastapi import APIRouter, HTTPException, Request
from datetime import datetime, timezone

from core.database import db
from core.security import get_current_user
from services.biopay import compute_fraud_summary, get_terminal_diagnostics, public_terminal_view


router = APIRouter(prefix="/api/admin/biopay", tags=["admin-biopay"])


async def require_admin(request: Request):
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


@router.get("/overview")
async def admin_biopay_overview(request: Request):
    await require_admin(request)
    terminals = await db.biopay_terminals.find({}, {"_id": 0}).sort("updated_at", -1).limit(100).to_list(100)
    sessions = await db.biopay_sessions.find({}, {"_id": 0}).sort("created_at", -1).limit(100).to_list(100)
    diagnostics = await db.biopay_terminal_diagnostics.find({}, {"_id": 0}).sort("created_at", -1).limit(100).to_list(100)
    fraud_by_merchant = []
    merchant_ids = sorted({item.get("merchant_id", "") for item in terminals if item.get("merchant_id")})
    for merchant_id in merchant_ids[:20]:
        fraud_by_merchant.append({"merchant_id": merchant_id, **(await compute_fraud_summary(merchant_id))})
    return {"terminals": [public_terminal_view(item) for item in terminals], "sessions": sessions, "diagnostics": diagnostics, "fraud_by_merchant": fraud_by_merchant}


@router.get("/audit-center")
async def admin_biopay_audit_center(request: Request, limit: int = 100):
    await require_admin(request)
    logs = await db.audit_logs.find({"event": {"$regex": "^(biopay_|biotime_)|pos_suspicious_cashier_activity|pos_manager_approval_requested"}}, {"_id": 0}).sort("timestamp", -1).limit(max(1, min(limit, 300))).to_list(limit)
    alerts = await db.pos_security_alerts.find({"type": {"$regex": "biopay|failed_customer_lookups|payment_pin_lock|excessive_refunds|unusual_topup|suspicious_cashier_activity"}}, {"_id": 0}).sort("created_at", -1).limit(100).to_list(100)
    return {"audit_logs": logs, "alerts": alerts}


@router.get("/terminal-diagnostics")
async def admin_biopay_terminal_diagnostics(request: Request):
    await require_admin(request)
    merchant_ids = await db.biopay_terminals.distinct("merchant_id")
    diagnostics = []
    for merchant_id in merchant_ids[:50]:
        diagnostics.extend(await get_terminal_diagnostics(merchant_id))
    diagnostics.sort(key=lambda item: item.get("created_at", ""), reverse=True)
    return {"diagnostics": diagnostics[:200]}


@router.get("/vendor-diagnostics")
async def admin_biopay_vendor_diagnostics(request: Request):
    await require_admin(request)
    terminals = await db.biopay_terminals.find({}, {"_id": 0}).sort("updated_at", -1).limit(300).to_list(300)
    diagnostics = await db.biopay_terminal_diagnostics.find({}, {"_id": 0}).sort("created_at", -1).limit(500).to_list(500)
    alerts = await db.pos_security_alerts.find(
        {"type": {"$regex": "biopay|failed_customer_lookups|payment_pin_lock|excessive_refunds|unusual_topup|suspicious_cashier_activity"}},
        {"_id": 0},
    ).sort("created_at", -1).limit(400).to_list(400)

    terminal_map = {item.get("terminal_id"): item for item in terminals}
    vendor_rollup = {}
    warning_workflows = []

    for terminal in terminals:
        vendor_name = terminal.get("vendor_name") or "BidBlitz BioPay"
        row = vendor_rollup.setdefault(vendor_name, {
            "vendor_name": vendor_name,
            "terminals_total": 0,
            "critical_terminals": 0,
            "warning_terminals": 0,
            "avg_score": 0.0,
            "scores": [],
            "face_enabled": 0,
            "palm_enabled": 0,
            "last_seen_at": terminal.get("last_seen_at") or terminal.get("updated_at") or "",
        })
        row["terminals_total"] += 1
        score = float(terminal.get("diagnostic_score") or 0)
        row["scores"].append(score)
        if terminal.get("health_status") == "critical":
            row["critical_terminals"] += 1
        elif terminal.get("health_status") == "warning":
            row["warning_terminals"] += 1
        if terminal.get("face_enabled"):
            row["face_enabled"] += 1
        if terminal.get("palm_enabled"):
            row["palm_enabled"] += 1

    for vendor in vendor_rollup.values():
        scores = vendor.pop("scores", [])
        vendor["avg_score"] = round(sum(scores) / len(scores), 2) if scores else 0.0

    for diag in diagnostics[:120]:
        terminal = terminal_map.get(diag.get("terminal_id"), {})
        if float(diag.get("score") or 0) >= 60 and terminal.get("health_status") not in {"critical", "warning"}:
            continue
        warning_workflows.append({
            "workflow_id": f"warn_{diag.get('diagnostic_id')}",
            "terminal_id": diag.get("terminal_id"),
            "merchant_id": terminal.get("merchant_id", ""),
            "store_id": terminal.get("store_id", ""),
            "vendor_name": terminal.get("vendor_name") or "BidBlitz BioPay",
            "severity": "critical" if float(diag.get("score") or 0) < 60 or terminal.get("health_status") == "critical" else "warning",
            "title": f"{diag.get('check_type', 'diagnostic')} benötigt Maßnahme",
            "recommended_action": "Terminal prüfen, Firmware/Netzwerk testen und Merchant informieren",
            "flags": diag.get("flags") or [],
            "created_at": diag.get("created_at"),
        })

    for alert in alerts[:80]:
        details = alert.get("details") or {}
        terminal_id = details.get("terminal_id")
        if not terminal_id:
            continue
        terminal = terminal_map.get(terminal_id, {})
        warning_workflows.append({
            "workflow_id": f"alert_{alert.get('alert_id', terminal_id)}",
            "terminal_id": terminal_id,
            "merchant_id": alert.get("merchant_id", terminal.get("merchant_id", "")),
            "store_id": alert.get("store_id", terminal.get("store_id", "")),
            "vendor_name": terminal.get("vendor_name") or "BidBlitz BioPay",
            "severity": alert.get("severity", "medium"),
            "title": alert.get("title", alert.get("type", "Security Alert")),
            "recommended_action": "Alert review, Cashier prüfen und Merchant eskalieren",
            "flags": [alert.get("type", "alert")],
            "created_at": alert.get("created_at"),
        })

    warning_workflows.sort(key=lambda item: (0 if item.get("severity") == "critical" else 1, str(item.get("created_at", ""))), reverse=False)
    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "vendors": sorted(vendor_rollup.values(), key=lambda item: (item.get("critical_terminals", 0), item.get("warning_terminals", 0), -item.get("avg_score", 0)), reverse=True),
        "warning_workflows": warning_workflows[:120],
        "terminals": [public_terminal_view(item) for item in terminals[:120]],
    }
