"""
BidBlitz V2 - Haendler-Verwaltung (Admin)
Haendler-IDs, Remote-Control, Session-Management, Fehler-Logs
"""
import secrets
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional
from core.database import db
from core.security import get_current_user

router = APIRouter(prefix="/api/admin/merchants", tags=["admin-merchants"])


async def require_admin(request: Request):
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    return user


def generate_merchant_id():
    num = secrets.randbelow(9000) + 1000
    return f"BZ-M-{num}"


# ── List all merchants with status ──
@router.get("/list")
async def list_merchants(request: Request, status: Optional[str] = None, limit: int = 50, skip: int = 0):
    await require_admin(request)
    query = {"role": "merchant"}
    if status == "active":
        query["is_suspended"] = {"$ne": True}
    elif status == "suspended":
        query["is_suspended"] = True

    merchants = await db.users.find(query, {"password_hash": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.users.count_documents(query)

    result = []
    for m in merchants:
        mid = m.get("merchant_id") or m.get("id") or str(m["_id"])
        # Get last activity
        last_txn = await db.merchant_transactions.find_one(
            {"merchant_email": m.get("email")},
            sort=[("created_at", -1)]
        )
        # Get error logs
        error_count = await db.merchant_errors.count_documents({"merchant_email": m.get("email"), "created_at": {"$gte": (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()}})
        # Get session info
        session = await db.merchant_sessions.find_one({"merchant_email": m.get("email")}, sort=[("last_active", -1)])

        result.append({
            "id": mid,
            "merchant_id": m.get("merchant_id", ""),
            "name": m.get("name", ""),
            "email": m.get("email", ""),
            "business_name": m.get("business_name", m.get("name", "")),
            "balance": round(m.get("balance", m.get("bids_balance", 0)), 2),
            "is_suspended": m.get("is_suspended", False),
            "is_online": bool(session and session.get("status") == "online"),
            "last_activity": last_txn.get("created_at", "") if last_txn else "",
            "device_info": session.get("device_info", "") if session else "",
            "errors_24h": error_count,
            "created_at": m.get("created_at", ""),
        })

    return {"merchants": result, "total": total}


# ── Get single merchant detail ──
@router.get("/{merchant_email}/detail")
async def merchant_detail(merchant_email: str, request: Request):
    await require_admin(request)
    m = await db.users.find_one({"email": merchant_email, "role": "merchant"}, {"password_hash": 0})
    if not m:
        raise HTTPException(404, "Haendler nicht gefunden")

    # Transactions
    txns = await db.merchant_transactions.find(
        {"merchant_email": merchant_email}, {"_id": 0}
    ).sort("created_at", -1).limit(20).to_list(20)

    # Error logs
    errors = await db.merchant_errors.find(
        {"merchant_email": merchant_email}, {"_id": 0}
    ).sort("created_at", -1).limit(20).to_list(20)

    # Sessions
    sessions = await db.merchant_sessions.find(
        {"merchant_email": merchant_email}, {"_id": 0}
    ).sort("last_active", -1).limit(10).to_list(10)

    # Revenue stats
    pipeline = [
        {"$match": {"merchant_email": merchant_email, "status": "completed"}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}, "count": {"$sum": 1}}}
    ]
    rev = await db.merchant_transactions.aggregate(pipeline).to_list(1)
    revenue = rev[0] if rev else {"total": 0, "count": 0}

    return {
        "merchant": {
            "id": m.get("id") or str(m["_id"]),
            "merchant_id": m.get("merchant_id", ""),
            "name": m.get("name", ""),
            "email": m.get("email"),
            "business_name": m.get("business_name", ""),
            "balance": round(m.get("balance", m.get("bids_balance", 0)), 2),
            "is_suspended": m.get("is_suspended", False),
            "created_at": m.get("created_at", ""),
        },
        "revenue_total": round(revenue.get("total", 0), 2),
        "transaction_count": revenue.get("count", 0),
        "recent_transactions": txns,
        "recent_errors": errors,
        "sessions": sessions,
    }


# ── Assign merchant ID ──
class AssignIdRequest(BaseModel):
    merchant_id: Optional[str] = None

@router.post("/{merchant_email}/assign-id")
async def assign_merchant_id(merchant_email: str, req: AssignIdRequest, request: Request):
    await require_admin(request)
    m = await db.users.find_one({"email": merchant_email})
    if not m:
        raise HTTPException(404, "Haendler nicht gefunden")

    new_id = req.merchant_id or generate_merchant_id()

    # Check uniqueness
    existing = await db.users.find_one({"merchant_id": new_id, "email": {"$ne": merchant_email}})
    if existing:
        raise HTTPException(400, f"ID {new_id} ist bereits vergeben")

    await db.users.update_one({"email": merchant_email}, {"$set": {"merchant_id": new_id}})
    return {"ok": True, "merchant_id": new_id, "message": f"Haendler-ID {new_id} zugewiesen"}


# ── Remote restart (force re-login) ──
@router.post("/{merchant_email}/restart")
async def restart_merchant_session(merchant_email: str, request: Request):
    admin = await require_admin(request)
    m = await db.users.find_one({"email": merchant_email})
    if not m:
        raise HTTPException(404, "Haendler nicht gefunden")

    # Invalidate all sessions
    await db.merchant_sessions.update_many(
        {"merchant_email": merchant_email},
        {"$set": {"status": "force_restart", "restarted_by": admin.get("email"), "restarted_at": datetime.now(timezone.utc).isoformat()}}
    )

    # Set force_restart flag on user
    await db.users.update_one(
        {"email": merchant_email},
        {"$set": {"force_restart": True, "force_restart_at": datetime.now(timezone.utc).isoformat()}}
    )

    # Log the action
    await db.merchant_errors.insert_one({
        "merchant_email": merchant_email,
        "type": "admin_restart",
        "message": f"Session neugestartet durch Admin ({admin.get('email')})",
        "severity": "info",
        "created_at": datetime.now(timezone.utc).isoformat(),
    })

    return {"ok": True, "message": f"Neustart fuer {merchant_email} ausgeloest. Haendler wird beim naechsten Request ausgeloggt."}


# ── Suspend / Activate merchant ──
@router.post("/{merchant_email}/suspend")
async def suspend_merchant(merchant_email: str, request: Request):
    admin = await require_admin(request)
    m = await db.users.find_one({"email": merchant_email})
    if not m:
        raise HTTPException(404, "Haendler nicht gefunden")

    is_suspended = m.get("is_suspended", False)
    new_status = not is_suspended

    await db.users.update_one(
        {"email": merchant_email},
        {"$set": {"is_suspended": new_status, "suspended_at": datetime.now(timezone.utc).isoformat() if new_status else None}}
    )

    action = "gesperrt" if new_status else "aktiviert"
    await db.merchant_errors.insert_one({
        "merchant_email": merchant_email,
        "type": "admin_action",
        "message": f"Haendler {action} durch Admin ({admin.get('email')})",
        "severity": "warning",
        "created_at": datetime.now(timezone.utc).isoformat(),
    })

    return {"ok": True, "is_suspended": new_status, "message": f"Haendler {action}"}


# ── Log merchant error (called by frontend) ──
class ErrorLogRequest(BaseModel):
    message: str
    severity: str = "error"
    device_info: str = ""
    page: str = ""

@router.post("/log-error")
async def log_merchant_error(req: ErrorLogRequest, request: Request):
    user = await get_current_user(request)
    await db.merchant_errors.insert_one({
        "merchant_email": user.get("email", ""),
        "type": "client_error",
        "message": req.message,
        "severity": req.severity,
        "device_info": req.device_info,
        "page": req.page,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return {"ok": True}


# ── Heartbeat (merchant device pings this) ──
class HeartbeatRequest(BaseModel):
    device_info: str = ""
    app_version: str = ""
    battery_pct: int = -1

@router.post("/heartbeat")
async def merchant_heartbeat(req: HeartbeatRequest, request: Request):
    user = await get_current_user(request)
    now = datetime.now(timezone.utc).isoformat()

    await db.merchant_sessions.update_one(
        {"merchant_email": user.get("email")},
        {"$set": {
            "merchant_email": user.get("email"),
            "status": "online",
            "device_info": req.device_info,
            "app_version": req.app_version,
            "battery_pct": req.battery_pct,
            "last_active": now,
        }},
        upsert=True,
    )

    # Check if force_restart
    if user.get("force_restart"):
        await db.users.update_one({"email": user.get("email")}, {"$unset": {"force_restart": "", "force_restart_at": ""}})
        return {"ok": True, "action": "restart", "message": "Admin hat Neustart angefordert"}

    return {"ok": True, "action": "none"}


# ── Bulk assign IDs to all merchants without one ──
@router.post("/bulk-assign-ids")
async def bulk_assign_ids(request: Request):
    await require_admin(request)
    merchants = await db.users.find({"role": "merchant", "merchant_id": {"$exists": False}}).to_list(None)
    merchants += await db.users.find({"role": "merchant", "merchant_id": ""}).to_list(None)

    assigned = 0
    for m in merchants:
        new_id = generate_merchant_id()
        while await db.users.find_one({"merchant_id": new_id}):
            new_id = generate_merchant_id()
        await db.users.update_one({"_id": m["_id"]}, {"$set": {"merchant_id": new_id}})
        assigned += 1

    return {"ok": True, "assigned": assigned, "message": f"{assigned} Haendler-IDs vergeben"}
