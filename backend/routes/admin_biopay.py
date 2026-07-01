from fastapi import APIRouter, HTTPException, Request

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
