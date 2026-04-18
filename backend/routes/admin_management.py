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
            "password_hash": 0, "otp_hash": 0, "reset_token": 0,
            "biometric_credentials": 0,
        },
    ).sort("created_at", -1).skip(skip).limit(limit)

    customers = []
    async for u in cursor:
        uid = str(u.pop("_id", None))
        u["user_id"] = uid
        customers.append(u)
    return {"customers": customers, "total": total, "skip": skip, "limit": limit}


@router.get("/customers/{user_id}")
async def get_customer(user_id: str, request: Request):
    """Einzelner Kunde mit vollständigen Details."""
    await _require_admin(request)
    user = await db.users.find_one(
        {"_id": _oid(user_id)},
        {"password_hash": 0, "otp_hash": 0, "biometric_credentials": 0}
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


class ResetPasswordRequest(BaseModel):
    new_password: str = Field(..., min_length=6)


@router.post("/customers/{user_id}/reset-password")
async def reset_password(user_id: str, req: ResetPasswordRequest, request: Request):
    """Passwort zurücksetzen (Admin-only)."""
    from core.security import hash_password
    await _require_admin(request)
    result = await db.users.update_one(
        {"_id": _oid(user_id)},
        {"$set": {
            "password_hash": hash_password(req.new_password),
            "password_reset_at": datetime.now(timezone.utc).isoformat(),
        }},
    )
    if result.matched_count == 0:
        raise HTTPException(404, "Kunde nicht gefunden")
    return {"ok": True}


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
