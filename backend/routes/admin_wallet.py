"""
Admin Wallet Tool — credit / debit user wallets + self-topup.

Endpoints (admin-only):
- GET  /api/admin/wallet/users?q=        → search users by email/name
- POST /api/admin/wallet/credit          → credit any user (EUR + BLZ)
- POST /api/admin/wallet/debit           → debit any user (careful!)
- POST /api/admin/wallet/self-topup      → quick self-topup for admin
- GET  /api/admin/wallet/transactions    → list admin-initiated transactions
"""
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from bson import ObjectId

from core.database import db
from core.security import get_current_user
from core.payment_engine import credit_wallet, debit_wallet, TransactionType

router = APIRouter(prefix="/api/admin/wallet", tags=["admin-wallet"])


async def _require_admin(request: Request):
    user = await get_current_user(request)
    if (user.get("role") or "") not in ("admin", "super_admin"):
        raise HTTPException(403, "Admin-Rechte erforderlich.")
    return user


async def _canonical_admin_balances() -> tuple[float, float]:
    canonical_admin = await db.users.find_one({"email": "admin@bidblitz.ae"}, {"_id": 0, "balance": 1, "balance_blz": 1})
    return (
        float((canonical_admin or {}).get("balance", 0) or 0),
        float((canonical_admin or {}).get("balance_blz", 0) or 0),
    )


def _normalize_admin_user_row(row: dict, canonical_balance: float, canonical_blz: float) -> dict:
    email = row.get("email") or ""
    if row.get("role") == "admin" and email in {"admin@bidblitz.ae", "admin@bidblitz.com"}:
        row["email"] = "admin@bidblitz.ae"
        row["canonical_email"] = "admin@bidblitz.ae"
        row["balance"] = canonical_balance
        row["balance_blz"] = canonical_blz
    return row


async def _serialize_login_history(user_id: str, limit: int = 20):
    rows = await db.audit_logs.find(
        {"user_id": user_id, "event": {"$in": ["login_success", "register"]}},
        {"_id": 0, "event": 1, "timestamp": 1, "ip": 1, "user_agent": 1, "details": 1},
    ).sort("timestamp", -1).limit(limit).to_list(limit)
    return [
        {
            "event": row.get("event", ""),
            "timestamp": row.get("timestamp", ""),
            "ip": row.get("ip", ""),
            "user_agent": row.get("user_agent", ""),
            "details": row.get("details", {}),
        }
        for row in rows
    ]


def _risk_level(users_balance: float, wallets_balance: float, tx_sum: float, wallet_tx_sum: float) -> str:
    delta = round(users_balance - wallets_balance, 2)
    combined_ledger_gap = round(users_balance - (tx_sum + wallet_tx_sum), 2)
    magnitude = max(abs(delta), abs(combined_ledger_gap))
    if magnitude >= 1000:
        return "high"
    if magnitude >= 100:
        return "medium"
    return "low"


def _recommended_repair(users_balance: float, wallets_balance: float, tx_sum: float, wallet_tx_sum: float) -> str:
    delta = round(users_balance - wallets_balance, 2)
    combined_ledger = round(tx_sum + wallet_tx_sum, 2)
    if abs(delta) < 0.01 and abs(users_balance - combined_ledger) < 0.01:
        return "Kein Eingriff nötig. Anzeige bereits konsistent."
    if abs(delta) >= 0.01:
        return "Visible Wallet bei users.balance belassen; Legacy wallets/ledger manuell prüfen und später gezielt reconciliieren."
    return "Ledger-Differenz prüfen; keine automatische Korrektur ohne manuelle Freigabe."


@router.get("/users")
async def search_users(request: Request, q: str = "", limit: int = 30):
    await _require_admin(request)
    canonical_balance, canonical_blz = await _canonical_admin_balances()
    query = {}
    q = (q or "").strip().lower()
    if q:
        query = {
            "$or": [
                {"email": {"$regex": q, "$options": "i"}},
                {"email_aliases": {"$elemMatch": {"$regex": q, "$options": "i"}}},
                {"canonical_email": {"$regex": q, "$options": "i"}},
                {"username": {"$regex": q, "$options": "i"}},
                {"full_name": {"$regex": q, "$options": "i"}},
                {"name": {"$regex": q, "$options": "i"}},
            ]
        }
    cur = db.users.find(query, {
        "_id": 1, "id": 1, "email": 1, "username": 1, "full_name": 1,
        "role": 1, "balance": 1, "balance_blz": 1, "wallet_balance": 1, "created_at": 1, "registered_at": 1,
        "last_login_at": 1, "login_count": 1,
    }).sort("created_at", -1).limit(limit)

    users = []
    async for u in cur:
        u = _normalize_admin_user_row(u, canonical_balance, canonical_blz)
        uid = str(u.get("_id") or u.get("id"))
        users.append({
            "user_id": uid,
            "email": u.get("email", ""),
            "canonical_email": u.get("canonical_email") or u.get("email", ""),
            "email_aliases": u.get("email_aliases") or [],
            "username": u.get("username") or u.get("full_name", ""),
            "role": u.get("role", "user"),
            "balance_eur": float(u.get("balance", 0) or 0),
            "balance_blz": float(u.get("balance_blz", 0) or 0),
            "created_at": u.get("created_at"),
            "registered_at": u.get("registered_at") or u.get("created_at"),
            "last_login_at": u.get("last_login_at"),
            "login_count": int(u.get("login_count", 0) or 0),
        })
    return {"users": users, "count": len(users)}


@router.get("/users/{user_id}/login-history")
async def user_login_history(user_id: str, request: Request, limit: int = 20):
    await _require_admin(request)
    canonical_balance, canonical_blz = await _canonical_admin_balances()
    try:
        target = await db.users.find_one(
            {"_id": ObjectId(user_id)},
            {"_id": 1, "email": 1, "canonical_email": 1, "email_aliases": 1, "name": 1, "username": 1, "role": 1, "created_at": 1, "registered_at": 1, "last_login_at": 1, "login_count": 1, "balance": 1, "balance_blz": 1, "kyc_status": 1},
        )
    except Exception as exc:
        raise HTTPException(404, "User nicht gefunden.") from exc
    if not target:
        raise HTTPException(404, "User nicht gefunden.")
    target = _normalize_admin_user_row(target, canonical_balance, canonical_blz)
    history = await _serialize_login_history(user_id, min(max(limit, 1), 50))
    return {
        "user": {
            "user_id": str(target["_id"]),
            "email": target.get("email", ""),
            "canonical_email": target.get("canonical_email") or target.get("email", ""),
            "email_aliases": target.get("email_aliases") or [],
            "name": target.get("name") or target.get("username", ""),
            "role": target.get("role", "user"),
            "balance_eur": float(target.get("balance", 0) or 0),
            "balance_blz": float(target.get("balance_blz", 0) or 0),
            "kyc_status": target.get("kyc_status") or "not_started",
            "registered_at": target.get("registered_at") or target.get("created_at"),
            "last_login_at": target.get("last_login_at"),
            "login_count": int(target.get("login_count", 0) or 0),
        },
        "history": history,
    }


class CreditReq(BaseModel):
    user_id: str = Field(..., description="Target user _id (string)")
    amount_eur: float = 0
    amount_blz: float = 0
    reason: Optional[str] = "Admin-Zuschreibung"


class DebitReq(BaseModel):
    user_id: str
    amount_eur: float = 0
    amount_blz: float = 0
    reason: Optional[str] = "Admin-Abzug"


class SelfTopupReq(BaseModel):
    amount_eur: float = 0
    amount_blz: float = 0
    reason: Optional[str] = "Admin Self-Topup"


async def _credit_blz(user_id: str, amount: float, admin_id: str, reason: str):
    """BLZ uses users.balance_blz, same source as mining/rewards UI."""
    if amount <= 0:
        return
    query = {"id": user_id}
    try:
        query = {"$or": [{"id": user_id}, {"_id": ObjectId(user_id)}]}
    except Exception:
        pass
    await db.users.update_one(query, {"$inc": {"balance_blz": amount}})
    await db.transactions.insert_one({
        "user_id": user_id,
        "type": "admin_credit_blz",
        "amount_blz": amount,
        "amount_eur": 0.0,
        "description": reason,
        "admin_id": admin_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })


async def _debit_blz(user_id: str, amount: float, admin_id: str, reason: str):
    if amount <= 0:
        return
    query = {"id": user_id}
    try:
        query = {"$or": [{"id": user_id}, {"_id": ObjectId(user_id)}]}
    except Exception:
        pass
    user = await db.users.find_one(query, {"_id": 1, "balance_blz": 1})
    if not user or (user.get("balance_blz", 0) or 0) < amount:
        raise HTTPException(400, "Nutzer hat nicht genug BLZ.")
    await db.users.update_one({"_id": user["_id"]}, {"$inc": {"balance_blz": -amount}})
    await db.transactions.insert_one({
        "user_id": user_id,
        "type": "admin_debit_blz",
        "amount_blz": -amount,
        "amount_eur": 0.0,
        "description": reason,
        "admin_id": admin_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })


@router.post("/credit")
async def credit_user(req: CreditReq, request: Request):
    admin = await _require_admin(request)
    admin_id = str(admin.get("_id") or admin.get("id"))

    if req.amount_eur <= 0 and req.amount_blz <= 0:
        raise HTTPException(400, "Bitte EUR- oder BLZ-Betrag angeben.")

    # Validate user exists
    from bson import ObjectId
    uq = {"$or": [{"id": req.user_id}]}
    try:
        uq["$or"].append({"_id": ObjectId(req.user_id)})
    except Exception:
        pass
    target = await db.users.find_one(uq, {"_id": 1, "email": 1, "username": 1})
    if not target:
        raise HTTPException(404, "User nicht gefunden.")

    eur_result = None
    if req.amount_eur > 0:
        eur_result = await credit_wallet(
            user_id=req.user_id,
            amount=req.amount_eur,
            tx_type=TransactionType.ADMIN_CREDIT,
            description=req.reason,
            metadata={"admin_id": admin_id},
        )
        if not eur_result.success:
            raise HTTPException(400, eur_result.error or "Credit fehlgeschlagen.")

    if req.amount_blz > 0:
        await _credit_blz(req.user_id, req.amount_blz, admin_id, req.reason)

    return {
        "ok": True,
        "credited_eur": req.amount_eur,
        "credited_blz": req.amount_blz,
        "user_email": target.get("email"),
        "tx_id": eur_result.transaction_id if eur_result else None,
    }


@router.post("/debit")
async def debit_user(req: DebitReq, request: Request):
    admin = await _require_admin(request)
    admin_id = str(admin.get("_id") or admin.get("id"))

    if req.amount_eur <= 0 and req.amount_blz <= 0:
        raise HTTPException(400, "Bitte EUR- oder BLZ-Betrag angeben.")

    if req.amount_eur > 0:
        res = await debit_wallet(
            user_id=req.user_id,
            amount=req.amount_eur,
            tx_type=TransactionType.ADMIN_DEBIT,
            description=f"Abzug: {req.reason}",
            metadata={"admin_id": admin_id, "audit_metadata": {"route": "admin_wallet.debit"}},
        )
        if not res.success:
            raise HTTPException(400, res.error or "Debit fehlgeschlagen.")

    if req.amount_blz > 0:
        await _debit_blz(req.user_id, req.amount_blz, admin_id, f"Abzug: {req.reason}")

    return {"ok": True, "debited_eur": req.amount_eur, "debited_blz": req.amount_blz}


@router.post("/self-topup")
async def self_topup(req: SelfTopupReq, request: Request):
    admin = await _require_admin(request)
    admin_id = str(admin.get("_id") or admin.get("id"))

    if req.amount_eur <= 0 and req.amount_blz <= 0:
        raise HTTPException(400, "Bitte EUR- oder BLZ-Betrag angeben.")

    if req.amount_eur > 0:
        await credit_wallet(
            user_id=admin_id,
            amount=req.amount_eur,
            tx_type=TransactionType.ADMIN_CREDIT,
            description=req.reason,
            metadata={"self_topup": True},
        )

    if req.amount_blz > 0:
        await _credit_blz(admin_id, req.amount_blz, admin_id, req.reason)

    # Return new balance from canonical user wallet fields
    fresh_admin = await db.users.find_one({"_id": ObjectId(admin_id)}, {"_id": 0, "balance": 1, "balance_blz": 1}) or {}
    return {
        "ok": True,
        "balance_eur": float(fresh_admin.get("balance", 0) or 0),
        "balance_blz": float(fresh_admin.get("balance_blz", 0) or 0),
    }


@router.get("/transactions")
async def admin_transactions(request: Request, limit: int = 50):
    await _require_admin(request)
    cur = db.transactions.find(
        {"$or": [
            {"type": "admin_credit"},
            {"type": "admin_credit_blz"},
            {"type": "admin_debit"},
            {"type": "admin_debit_blz"},
            {"metadata.admin_id": {"$exists": True}},
        ]},
        {"_id": 0},
    ).sort("created_at", -1).limit(limit)
    items = await cur.to_list(limit)

    # enrich with user email
    uids = {t.get("user_id") for t in items if t.get("user_id")}
    emails = {}
    if uids:
        from bson import ObjectId
        obj_ids = []
        for i in uids:
            try:
                obj_ids.append(ObjectId(i))
            except Exception:
                pass
        async for u in db.users.find(
            {"$or": [{"_id": {"$in": obj_ids}}, {"id": {"$in": list(uids)}}]},
            {"email": 1, "username": 1, "id": 1},
        ):
            emails[str(u["_id"])] = u.get("email") or u.get("username")
            if u.get("id"):
                emails[u["id"]] = u.get("email") or u.get("username")
    for t in items:
        t["user_email"] = emails.get(t.get("user_id"), "")

    return {"transactions": items}


@router.get("/reconciliation")
async def reconciliation_overview(request: Request, q: str = "", limit: int = 50):
    await _require_admin(request)
    query = {}
    q = (q or "").strip().lower()
    if q:
        query = {
            "$or": [
                {"email": {"$regex": q, "$options": "i"}},
                {"canonical_email": {"$regex": q, "$options": "i"}},
                {"email_aliases": {"$elemMatch": {"$regex": q, "$options": "i"}}},
                {"user_number": {"$regex": q, "$options": "i"}},
                {"name": {"$regex": q, "$options": "i"}},
                {"full_name": {"$regex": q, "$options": "i"}},
            ]
        }

    cap = min(max(limit, 1), 200)
    users = await db.users.find(
        query,
        {"_id": 1, "email": 1, "canonical_email": 1, "role": 1, "balance": 1, "user_number": 1},
    ).sort("created_at", -1).limit(cap).to_list(cap)

    rows = []
    mismatch_count = 0
    for user in users:
        uid = str(user["_id"])
        wallet_doc = await db.wallets.find_one({"user_id": uid}, {"_id": 0, "balance": 1}) or {}
        tx_rows = await db.transactions.find({"user_id": uid}, {"_id": 0, "amount": 1, "status": 1}).to_list(5000)
        wallet_tx_rows = await db.wallet_transactions.find({"user_id": uid}, {"_id": 0, "amount": 1}).to_list(5000)

        users_balance = round(float(user.get("balance", 0) or 0), 2)
        wallets_balance = round(float(wallet_doc.get("balance", 0) or 0), 2)
        tx_sum = round(sum(float(t.get("amount") or 0) for t in tx_rows if isinstance(t.get("amount"), (int, float)) and t.get("status", "completed") == "completed"), 2)
        wallet_tx_sum = round(sum(float(t.get("amount") or 0) for t in wallet_tx_rows if isinstance(t.get("amount"), (int, float))), 2)
        delta = round(users_balance - wallets_balance, 2)
        if abs(delta) >= 0.01:
            mismatch_count += 1

        rows.append({
            "user_id": uid,
            "email": user.get("email", ""),
            "canonical_email": user.get("canonical_email") or user.get("email", ""),
            "role": user.get("role", "user"),
            "user_number": user.get("user_number", ""),
            "users_balance": users_balance,
            "wallets_balance": wallets_balance,
            "transactions_sum": tx_sum,
            "wallet_transactions_sum": wallet_tx_sum,
            "delta": delta,
            "recommended_repair": _recommended_repair(users_balance, wallets_balance, tx_sum, wallet_tx_sum),
            "risk_level": _risk_level(users_balance, wallets_balance, tx_sum, wallet_tx_sum),
        })

    rows.sort(key=lambda row: abs(row["delta"]), reverse=True)
    return {
        "rows": rows,
        "count": len(rows),
        "mismatch_count": mismatch_count,
        "canonical_visible_source": "users.balance",
        "note": "Read-only forensic view. No balances were modified.",
    }
