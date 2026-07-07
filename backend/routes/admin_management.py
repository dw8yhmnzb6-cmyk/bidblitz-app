"""
Admin Management API — Customer management + Transactions + Generic CRUD
Provides CRUD operations for all admin-managed collections.
"""
from datetime import datetime, timezone
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from bson import ObjectId

from core.database import db
from core.security import get_current_user
from core.audit import log_audit, AuditEvent, get_client_info
from routes.auth import _issue_password_reset

router = APIRouter(prefix="/api/admin", tags=["admin-management"])


async def _require_admin(request: Request):
    user = await get_current_user(request)
    if (user.get("role") or "") not in ("admin", "super_admin"):
        raise HTTPException(403, "Admin-Rechte erforderlich.")
    return user


def _oid(s):
    try:
        return ObjectId(s)
    except Exception:
        return s


# ═══════════════════════════════════════════════════════════════
# KUNDEN-VERWALTUNG
# ═══════════════════════════════════════════════════════════════

@router.get("/customers")
async def list_customers(
    request: Request,
    q: str = "",
    role: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = 50,
    skip: int = 0,
):
    """Alle Kunden mit Filter und Suche."""
    await _require_admin(request)
    query = {}
    if q:
        query["$or"] = [
            {"email": {"$regex": q, "$options": "i"}},
            {"name": {"$regex": q, "$options": "i"}},
            {"username": {"$regex": q, "$options": "i"}},
        ]
    if role:
        query["role"] = role
    if status == "banned":
        query["banned"] = True
    elif status == "active":
        query["banned"] = {"$ne": True}

    total = await db.users.count_documents(query)
    cursor = db.users.find(
        query,
        {
            "password_hash": 0, "password": 0, "otp_hash": 0, "reset_token": 0,
            "biometric_credentials": 0, "recovery_codes": 0,
        },
    ).sort("created_at", -1).skip(skip).limit(limit)

    customers = []
    async for u in cursor:
        # V2 uses ObjectId _id, V1 uses string id field
        uid = u.pop("_id", None)
        if uid is None:
            uid = u.get("id")
        u["user_id"] = str(uid) if uid else ""
        # Also drop V1 legacy fields
        u.pop("id", None)
        customers.append(u)
    return {"customers": customers, "total": total, "skip": skip, "limit": limit}


@router.get("/customers/{user_id}")
async def get_customer(user_id: str, request: Request):
    """Einzelner Kunde mit vollständigen Details."""
    await _require_admin(request)
    user = await db.users.find_one(
        {"_id": _oid(user_id)},
        {"password_hash": 0, "password": 0, "otp_hash": 0, "biometric_credentials": 0, "recovery_codes": 0}
    )
    if not user:
        raise HTTPException(404, "Kunde nicht gefunden")
    user["user_id"] = str(user.pop("_id"))

    # Aggregate stats
    tx_count = await db.transactions.count_documents({"user_id": user["user_id"]})
    last_tx = await db.transactions.find_one(
        {"user_id": user["user_id"]}, {"_id": 0, "created_at": 1, "type": 1, "amount": 1}, sort=[("created_at", -1)]
    )
    return {
        "customer": user,
        "stats": {"transactions": tx_count, "last_transaction": last_tx},
    }


class BanRequest(BaseModel):
    banned: bool
    reason: Optional[str] = "Policy violation"


@router.post("/customers/{user_id}/ban")
async def ban_customer(user_id: str, req: BanRequest, request: Request):
    """Kunde sperren oder entsperren."""
    admin = await _require_admin(request)
    result = await db.users.update_one(
        {"_id": _oid(user_id)},
        {"$set": {
            "banned": req.banned,
            "ban_reason": req.reason if req.banned else None,
            "banned_at": datetime.now(timezone.utc).isoformat() if req.banned else None,
            "banned_by": str(admin.get("_id") or admin.get("id")) if req.banned else None,
        }},
    )
    if result.matched_count == 0:
        raise HTTPException(404, "Kunde nicht gefunden")
    return {"ok": True, "banned": req.banned}


class RoleRequest(BaseModel):
    role: str = Field(..., pattern="^(user|customer|merchant|admin|super_admin)$")


class KYCDecisionRequest(BaseModel):
    decision: str = Field(..., pattern="^(approve|reject)$")
    reason: Optional[str] = "Admin manuelle KYC-Freischaltung"


@router.post("/customers/{user_id}/role")
async def change_role(user_id: str, req: RoleRequest, request: Request):
    """Rolle eines Kunden ändern."""
    await _require_admin(request)
    result = await db.users.update_one(
        {"_id": _oid(user_id)},
        {"$set": {"role": req.role}},
    )
    if result.matched_count == 0:
        raise HTTPException(404, "Kunde nicht gefunden")
    return {"ok": True, "role": req.role}


@router.post("/customers/{user_id}/kyc")
async def admin_customer_kyc_decision(user_id: str, req: KYCDecisionRequest, request: Request):
    """KYC für Kunden manuell freischalten oder ablehnen."""
    admin = await _require_admin(request)
    now = datetime.now(timezone.utc).isoformat()
    approved = req.decision == "approve"
    admin_id = str(admin.get("_id") or admin.get("id"))
    update = {
        "kyc_status": "approved" if approved else "rejected",
        "kyc_verified": approved,
        "kyc_reviewed_at": now,
        "kyc_reviewed_by": admin_id,
        "kyc_admin_reason": req.reason,
    }
    if not approved:
        update["kyc_rejection_reason"] = req.reason or "Von Admin abgelehnt"
    else:
        update["kyc_rejection_reason"] = None
    result = await db.users.update_one({"_id": _oid(user_id)}, {"$set": update})
    if result.matched_count == 0:
        raise HTTPException(404, "Kunde nicht gefunden")
    await db.kyc_reviews.update_many(
        {"user_id": user_id},
        {"$set": {"status": update["kyc_status"], "reviewed_at": now, "reviewed_by": admin_id, "admin_reason": req.reason}},
    )
    ip, ua = get_client_info(request)
    await log_audit(
        AuditEvent.ADMIN_ACTION,
        user_id=admin_id,
        email=admin.get("email", ""),
        ip=ip,
        user_agent=ua,
        details={"action": "manual_kyc_decision", "target_user_id": user_id, "decision": req.decision, "reason": req.reason},
    )
    return {"ok": True, "user_id": user_id, "kyc_status": update["kyc_status"], "kyc_verified": approved}


class ResetPasswordRequest(BaseModel):
    reason: Optional[str] = "Admin security reset"


def _password_format_info(user: dict):
    pwd_hash = (user.get("password_hash") or "").strip()
    legacy_pwd = (user.get("password") or "").strip()
    registered_at = user.get("registered_at") or user.get("created_at") or ""
    if pwd_hash and legacy_pwd and pwd_hash != legacy_pwd:
        return {"registered_at": registered_at, "password_format": "conflicting_hash_fields", "risk_level": "high", "recommended_action": "Sofort Reset-Link senden und Legacy-Feld bereinigen"}
    if legacy_pwd and not pwd_hash:
        return {"registered_at": registered_at, "password_format": "legacy_password_field_bcrypt" if legacy_pwd.startswith("$2") else "legacy_password_field_unknown", "risk_level": "medium", "recommended_action": "Reset-Link senden oder Auto-Migration beim nächsten Login zulassen"}
    if pwd_hash and legacy_pwd and pwd_hash == legacy_pwd:
        return {"registered_at": registered_at, "password_format": "duplicate_hash_fields", "risk_level": "medium", "recommended_action": "Legacy-Feld bereinigen und Passwortstatus prüfen"}
    if pwd_hash:
        return {"registered_at": registered_at, "password_format": "password_hash_bcrypt" if pwd_hash.startswith("$2") else "password_hash_unknown", "risk_level": "low", "recommended_action": "Keine Aktion erforderlich"}
    return {"registered_at": registered_at, "password_format": "missing_password_fields", "risk_level": "critical", "recommended_action": "Sofort Reset-Link senden und Konto prüfen"}


@router.post("/customers/{user_id}/reset-password")
async def reset_password(user_id: str, req: ResetPasswordRequest, request: Request):
    """Sicheren Reset-Link per E-Mail senden (Admin-only)."""
    admin = await _require_admin(request)
    user = await db.users.find_one({"_id": _oid(user_id)}, {"email": 1})
    if not user:
        raise HTTPException(404, "Kunde nicht gefunden")
    issued = await _issue_password_reset(user.get("email", ""), request=request, issued_by=str(admin.get("_id") or admin.get("id") or "admin"), reason=req.reason or "admin_security_reset", force_password_change=True)
    if not issued:
        raise HTTPException(404, "Kunde nicht gefunden")
    if not issued.get("email_sent", False):
        raise HTTPException(502, "Reset-E-Mail konnte nicht zugestellt werden. Bitte Resend-Senderdomain prüfen.")
    ip, ua = get_client_info(request)
    await log_audit(
        AuditEvent.ADMIN_ACTION,
        user_id=str(admin.get("_id") or admin.get("id") or ""),
        email=admin.get("email", ""),
        ip=ip,
        user_agent=ua,
        details={"action": "send_password_reset_link", "target_user_id": user_id, "target_email": user.get("email", ""), "reason": req.reason or "admin_security_reset"},
        severity="info",
    )
    return {"ok": True, "email": user.get("email", ""), "expires_at": issued.get("expires_at")}


@router.get("/customers-report/legacy-passwords")
async def legacy_password_report(request: Request, role: Optional[str] = None):
    await _require_admin(request)
    query = {"role": {"$nin": ["admin", "super_admin"]}}
    if role:
        query["role"] = role
    cursor = db.users.find(query, {"_id": 1, "email": 1, "role": 1, "created_at": 1, "registered_at": 1, "password_hash": 1, "password": 1}).sort("created_at", -1)
    report = []
    async for user in cursor:
        info = _password_format_info(user)
        report.append({
            "user_id": str(user["_id"]),
            "email": user.get("email", ""),
            "registered_at": info["registered_at"],
            "password_format": info["password_format"],
            "risk_level": info["risk_level"],
            "recommended_action": info["recommended_action"],
            "role": user.get("role", "user"),
        })
    return {"items": report, "summary": {"total": len(report), "critical": len([r for r in report if r["risk_level"] == "critical"]), "high": len([r for r in report if r["risk_level"] == "high"]), "medium": len([r for r in report if r["risk_level"] == "medium"]), "low": len([r for r in report if r["risk_level"] == "low"])}}


@router.delete("/customers/{user_id}")
async def delete_customer(user_id: str, request: Request):
    """Kunde dauerhaft löschen."""
    admin = await _require_admin(request)
    admin_id = str(admin.get("_id") or admin.get("id"))
    if admin_id == user_id:
        raise HTTPException(400, "Du kannst dich nicht selbst löschen")
    result = await db.users.delete_one({"_id": _oid(user_id)})
    if result.deleted_count == 0:
        raise HTTPException(404, "Kunde nicht gefunden")
    # Soft-clean related data
    await db.transactions.update_many({"user_id": user_id}, {"$set": {"user_deleted": True}})
    return {"ok": True}


# ═══════════════════════════════════════════════════════════════
# TRANSAKTIONEN & REFUNDS
# ═══════════════════════════════════════════════════════════════

@router.get("/transactions")
async def list_transactions(
    request: Request,
    q: str = "",
    user_id: Optional[str] = None,
    type: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = 50,
    skip: int = 0,
):
    """Alle Transaktionen mit Filter."""
    await _require_admin(request)
    query = {}
    if q:
        query["$or"] = [
            {"reference": {"$regex": q, "$options": "i"}},
            {"description": {"$regex": q, "$options": "i"}},
            {"merchant_name": {"$regex": q, "$options": "i"}},
        ]
    if user_id:
        query["user_id"] = user_id
    if type:
        query["type"] = type
    if status:
        query["status"] = status

    total = await db.transactions.count_documents(query)
    cursor = db.transactions.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit)
    tx = await cursor.to_list(length=limit)

    # Enrich with user email
    user_ids = list({t.get("user_id") for t in tx if t.get("user_id")})
    users_map = {}
    for uid in user_ids:
        u = await db.users.find_one({"_id": _oid(uid)}, {"email": 1, "name": 1})
        if u:
            users_map[uid] = {"email": u.get("email", ""), "name": u.get("name", "")}
    for t in tx:
        t["user_info"] = users_map.get(t.get("user_id"), {})

    return {"transactions": tx, "total": total, "skip": skip, "limit": limit}


class RefundRequest(BaseModel):
    reason: Optional[str] = "Admin-Refund"


@router.post("/transactions/{reference}/refund")
async def refund_transaction(reference: str, req: RefundRequest, request: Request):
    """Transaktion zurückerstatten — fügt EUR-Betrag wieder auf Wallet zurück."""
    admin = await _require_admin(request)
    admin_id = str(admin.get("_id") or admin.get("id"))

    tx = await db.transactions.find_one({"reference": reference})
    if not tx:
        tx = await db.transactions.find_one({"tx_id": reference})
    if not tx:
        raise HTTPException(404, "Transaktion nicht gefunden")
    if tx.get("refunded"):
        raise HTTPException(400, "Bereits refundiert")
    if tx.get("status") != "completed":
        raise HTTPException(400, "Nur erfolgreiche Transaktionen können refundiert werden")

    user_id = tx.get("user_id")
    amount = float(tx.get("amount", 0))
    currency = tx.get("currency", "EUR")
    if amount <= 0:
        raise HTTPException(400, "Ungültiger Betrag")

    # Refund direction: for payments/topup-debits → add back to balance
    # Flip amount sign based on transaction type
    refund_field = "balance" if currency == "EUR" else "balance_blz"
    await db.users.update_one(
        {"_id": _oid(user_id)},
        {"$inc": {refund_field: amount}},
    )

    # Log refund transaction
    refund_ref = f"REF-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}"
    await db.transactions.insert_one({
        "user_id": user_id,
        "type": "refund",
        "amount": amount,
        "currency": currency,
        "status": "completed",
        "description": f"Refund: {req.reason}",
        "merchant_name": "BidBlitz Admin",
        "category": "refund",
        "reference": refund_ref,
        "date": datetime.now(timezone.utc).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "refund_of": tx.get("reference") or tx.get("tx_id"),
        "admin_id": admin_id,
    })

    # Mark original as refunded
    await db.transactions.update_one(
        {"reference": tx.get("reference") or tx.get("tx_id")},
        {"$set": {"refunded": True, "refund_ref": refund_ref, "refunded_at": datetime.now(timezone.utc).isoformat()}},
    )
    return {"ok": True, "refund_ref": refund_ref, "amount": amount, "currency": currency}


# ═══════════════════════════════════════════════════════════════
# GENERIC CRUD für Service-Module
# ═══════════════════════════════════════════════════════════════

# Map admin module keys → MongoDB collection + primary key strategy
MODULE_COLLECTIONS = {
    "handwerker": ("handwerker", "name"),
    "gebrauchtwagen": ("gebrauchtwagen", "title"),
    "reinigung": ("cleaning_services", "name"),
    "umzug": ("moving_companies", "name"),
    "tierbetreuung": ("pet_sitters", "name"),
    "streaming": ("streaming_content", "title"),
    "telemedizin": ("telemedicine_doctors", "name"),
    "dating": ("dating_profiles", "name"),
    "fitness": ("fitness_gyms", "name"),
    "reisen": ("travel_trips", "title"),
    "ladesaeulen": ("ev_charging_stations", "name"),
    "scooter-abos": ("scooter_plans", "name"),
}


@router.post("/module/{module_key}/create")
async def module_create(module_key: str, data: dict, request: Request):
    """Neuen Eintrag in Service-Modul anlegen."""
    await _require_admin(request)
    if module_key not in MODULE_COLLECTIONS:
        raise HTTPException(400, f"Unbekanntes Modul: {module_key}")
    coll_name, _ = MODULE_COLLECTIONS[module_key]
    data["created_at"] = datetime.now(timezone.utc).isoformat()
    data["id"] = data.get("id") or f"{module_key[:3].upper()}-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S%f')[:14]}"
    await db[coll_name].insert_one(data)
    data.pop("_id", None)
    return {"ok": True, "item": data}


@router.get("/module/{module_key}/list")
async def module_list(module_key: str, request: Request, limit: int = 100):
    """Liste alle Einträge eines Service-Moduls."""
    await _require_admin(request)
    if module_key not in MODULE_COLLECTIONS:
        raise HTTPException(400, f"Unbekanntes Modul: {module_key}")
    coll_name, _ = MODULE_COLLECTIONS[module_key]
    cursor = db[coll_name].find({}, {"_id": 0}).limit(limit)
    items = await cursor.to_list(length=limit)
    return {"items": items, "count": len(items), "collection": coll_name}


@router.put("/module/{module_key}/{item_id}")
async def module_update(module_key: str, item_id: str, data: dict, request: Request):
    """Eintrag im Service-Modul aktualisieren."""
    await _require_admin(request)
    if module_key not in MODULE_COLLECTIONS:
        raise HTTPException(400, f"Unbekanntes Modul: {module_key}")
    coll_name, _ = MODULE_COLLECTIONS[module_key]
    data.pop("_id", None)
    data["updated_at"] = datetime.now(timezone.utc).isoformat()
    # Try _id first, then id field
    query = {"id": item_id}
    result = await db[coll_name].update_one(query, {"$set": data})
    if result.matched_count == 0:
        # Fallback to _id
        try:
            result = await db[coll_name].update_one({"_id": _oid(item_id)}, {"$set": data})
        except Exception:
            pass
    if result.matched_count == 0:
        raise HTTPException(404, "Eintrag nicht gefunden")
    return {"ok": True}


@router.delete("/module/{module_key}/{item_id}")
async def module_delete(module_key: str, item_id: str, request: Request):
    """Eintrag aus Service-Modul löschen."""
    await _require_admin(request)
    if module_key not in MODULE_COLLECTIONS:
        raise HTTPException(400, f"Unbekanntes Modul: {module_key}")
    coll_name, _ = MODULE_COLLECTIONS[module_key]
    result = await db[coll_name].delete_one({"id": item_id})
    if result.deleted_count == 0:
        try:
            result = await db[coll_name].delete_one({"_id": _oid(item_id)})
        except Exception:
            pass
    if result.deleted_count == 0:
        raise HTTPException(404, "Eintrag nicht gefunden")
    return {"ok": True}


# ═══════════════════════════════════════════════════════════════
# LIVE ANALYTICS — Online User, Top Spender, Last-Seen
# ═══════════════════════════════════════════════════════════════

@router.get("/analytics/online")
async def online_users(request: Request, minutes: int = 5):
    """Alle User, die in den letzten X Minuten aktiv waren."""
    await _require_admin(request)
    from datetime import datetime, timezone, timedelta
    threshold = (datetime.now(timezone.utc) - timedelta(minutes=minutes)).isoformat()
    canonical_admin = await db.users.find_one({"email": "admin@bidblitz.ae"}, {"_id": 0, "balance": 1, "balance_blz": 1})
    canonical_balance = float((canonical_admin or {}).get("balance", 0) or 0)
    canonical_blz = float((canonical_admin or {}).get("balance_blz", 0) or 0)
    cursor = db.users.find(
        {"last_seen": {"$gte": threshold}},
        {"_id": 1, "email": 1, "name": 1, "role": 1, "last_seen": 1, "balance": 1, "balance_blz": 1},
    ).sort("last_seen", -1).limit(100)
    users = []
    async for u in cursor:
        if u.get("role") == "admin" and u.get("email") in {"admin@bidblitz.ae", "admin@bidblitz.com"}:
            u["email"] = "admin@bidblitz.ae"
            u["balance"] = canonical_balance
            u["balance_blz"] = canonical_blz
        users.append({
            "user_id": str(u.pop("_id")),
            "email": u.get("email", ""),
            "name": u.get("name", "") or "",
            "role": u.get("role", "user"),
            "last_seen": u.get("last_seen"),
            "balance_eur": float(u.get("balance", 0) or 0),
            "balance_blz": float(u.get("balance_blz", 0) or 0),
        })
    return {"online_users": users, "count": len(users), "threshold_minutes": minutes}


@router.get("/analytics/top-spenders")
async def top_spenders(request: Request, days: int = 30, limit: int = 20):
    """Top User nach Ausgaben in den letzten X Tagen."""
    await _require_admin(request)
    from datetime import datetime, timezone, timedelta
    since = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    pipeline = [
        {"$match": {
            "created_at": {"$gte": since},
            "currency": "EUR",
            "status": "completed",
            "type": {"$in": ["payment", "topup", "purchase", "debit", "transfer", "game"]},
        }},
        {"$group": {
            "_id": "$user_id",
            "total_spent": {"$sum": "$amount"},
            "tx_count": {"$sum": 1},
            "last_tx": {"$max": "$created_at"},
        }},
        {"$sort": {"total_spent": -1}},
        {"$limit": limit},
    ]
    rows = []
    async for row in db.transactions.aggregate(pipeline):
        uid = row["_id"]
        if not uid:
            continue
        user = await db.users.find_one({"_id": _oid(uid)}, {"email": 1, "name": 1})
        rows.append({
            "user_id": str(uid),
            "email": (user or {}).get("email", "") or "",
            "name": (user or {}).get("name", "") or "",
            "total_spent": round(float(row["total_spent"]), 2),
            "tx_count": row["tx_count"],
            "last_tx": row["last_tx"],
        })
    return {"top_spenders": rows, "days": days}


@router.get("/analytics/last-seen")
async def all_last_seen(request: Request, limit: int = 50, include_never: bool = False):
    """Alle User mit last_seen, sortiert von aktuell nach alt."""
    await _require_admin(request)
    query = {} if include_never else {"last_seen": {"$exists": True}}
    cursor = db.users.find(
        query,
        {"_id": 1, "email": 1, "name": 1, "role": 1, "last_seen": 1, "created_at": 1, "banned": 1},
    ).sort("last_seen", -1).limit(limit)
    users = []
    async for u in cursor:
        if u.get("role") == "admin" and u.get("email") in {"admin@bidblitz.ae", "admin@bidblitz.com"}:
            u["email"] = "admin@bidblitz.ae"
        users.append({
            "user_id": str(u.pop("_id")),
            "email": u.get("email", ""),
            "name": u.get("name", "") or "",
            "role": u.get("role", "user"),
            "last_seen": u.get("last_seen") or None,
            "created_at": u.get("created_at"),
            "banned": bool(u.get("banned", False)),
        })
    return {"users": users, "count": len(users)}


@router.get("/analytics/overview")
async def analytics_overview(request: Request):
    """Gesamt-Statistik für Admin Dashboard."""
    await _require_admin(request)
    from datetime import datetime, timezone, timedelta
    now = datetime.now(timezone.utc)
    online_5m = (now - timedelta(minutes=5)).isoformat()
    active_24h = (now - timedelta(hours=24)).isoformat()
    active_7d = (now - timedelta(days=7)).isoformat()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()

    total_users = await db.users.count_documents({})
    online_now = await db.users.count_documents({"last_seen": {"$gte": online_5m}})
    active_day = await db.users.count_documents({"last_seen": {"$gte": active_24h}})
    active_week = await db.users.count_documents({"last_seen": {"$gte": active_7d}})
    new_today = await db.users.count_documents({"created_at": {"$gte": today_start}})

    # Revenue today
    rev_pipe = [
        {"$match": {"created_at": {"$gte": today_start}, "status": "completed", "currency": "EUR"}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}, "count": {"$sum": 1}}},
    ]
    rev_doc = None
    async for r in db.transactions.aggregate(rev_pipe):
        rev_doc = r
        break

    return {
        "total_users": total_users,
        "online_now": online_now,
        "active_24h": active_day,
        "active_7d": active_week,
        "new_today": new_today,
        "revenue_today": round(float((rev_doc or {}).get("total", 0)), 2),
        "tx_today": int((rev_doc or {}).get("count", 0)),
    }
