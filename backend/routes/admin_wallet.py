"""
Admin Wallet Tool — credit / debit user wallets + self-topup.

Endpoints (admin-only):
- GET  /api/admin/wallet/users?q=        → search users by email/name
- POST /api/admin/wallet/credit          → credit any user (EUR + BLZ)
- POST /api/admin/wallet/debit           → debit any user (careful!)
- POST /api/admin/wallet/self-topup      → quick self-topup for admin
- GET  /api/admin/wallet/transactions    → list admin-initiated transactions
"""
from collections import defaultdict
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from bson import ObjectId

from core.database import db
from core.security import get_current_user
from core.payment_engine import credit_wallet, debit_wallet, TransactionType
from core.audit import log_audit, AuditEvent, get_client_info
from core.security import verify_password

router = APIRouter(prefix="/api/admin/wallet", tags=["admin-wallet"])


async def _require_admin(request: Request):
    user = await get_current_user(request)
    if (user.get("role") or "") not in ("admin", "super_admin"):
        raise HTTPException(403, "Admin-Rechte erforderlich.")
    return user


async def _verify_admin_step_up(admin: dict, password: str, otp_code: Optional[str] = None):
    admin_db = await db.users.find_one({"_id": admin["_id"]}, {"password_hash": 1, "password": 1, "two_factor_enabled": 1})
    password_hash = ((admin_db or {}).get("password_hash") or (admin_db or {}).get("password") or "").strip()
    if not password or not password_hash or not verify_password(password, password_hash):
        raise HTTPException(403, "Admin-Passwort ungültig.")

    if (admin_db or {}).get("two_factor_enabled"):
        if not otp_code:
            raise HTTPException(403, "2FA-Code erforderlich.")
        otp_doc = await db.otp_codes.find_one({
            "user_id": str(admin["_id"]),
            "purpose": "wallet_repair_stepup",
            "expires_at": {"$gt": datetime.now(timezone.utc).isoformat()},
        })
        if not otp_doc or otp_doc.get("code") != otp_code:
            raise HTTPException(403, "2FA-Code ungültig.")
        await db.otp_codes.delete_one({"_id": otp_doc["_id"]})


async def _build_repair_context(user_id: str):
    try:
        query = {"_id": ObjectId(user_id)}
    except Exception as exc:
        raise HTTPException(404, "Wallet nicht gefunden.") from exc
    rows, _summary = await _build_reconciliation_rows(query, 1)
    if not rows:
        raise HTTPException(404, "Wallet nicht gefunden.")
    row = rows[0]
    wallet_doc = await db.wallets.find_one({"user_id": user_id}, {"_id": 1, "balance": 1, "currency": 1}) or {}
    return row, wallet_doc


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


def _risk_band(delta: float, ledger_gap: float) -> str:
    score = max(abs(delta), abs(ledger_gap))
    if score < 0.01:
        return "green"
    if score < 10:
        return "yellow"
    if score < 250:
        return "orange"
    return "red"


def _confidence_score(users_balance: float, wallets_balance: float, tx_sum: float, wallet_tx_sum: float) -> int:
    score = 100
    delta = abs(round(users_balance - wallets_balance, 2))
    ledger_gap = abs(round(users_balance - (tx_sum + wallet_tx_sum), 2))
    if delta >= 0.01:
        score -= min(45, int(delta // 5) + 15)
    if ledger_gap >= 0.01:
        score -= min(40, int(ledger_gap // 5) + 10)
    if wallets_balance == 0 and users_balance > 0:
        score -= 10
    return max(5, min(100, score))


def _recommended_action(users_balance: float, wallets_balance: float, tx_sum: float, wallet_tx_sum: float, duplicate_flags: list[str]) -> str:
    delta = round(users_balance - wallets_balance, 2)
    ledger_gap = round(users_balance - (tx_sum + wallet_tx_sum), 2)
    if duplicate_flags:
        if any(flag in {"duplicate_wallet", "duplicate_email", "duplicate_canonical_user"} for flag in duplicate_flags):
            return "Manual review"
        if "duplicate_admin_alias" in duplicate_flags:
            return "Ignore legacy wallet"
    if abs(delta) < 0.01 and abs(ledger_gap) < 0.01:
        return "No action"
    if wallets_balance == 0 and users_balance > 0:
        return "Ignore legacy wallet"
    if abs(ledger_gap) > abs(delta) and abs(ledger_gap) >= 25:
        return "Rebuild from ledger"
    if abs(delta) >= 250:
        return "Manual review"
    if abs(delta) >= 10:
        return "Investigate"
    return "Investigate"


def _expected_balance(users_balance: float, wallets_balance: float, tx_sum: float, wallet_tx_sum: float) -> float:
    ledger_total = round(tx_sum + wallet_tx_sum, 2)
    if abs(users_balance - ledger_total) <= abs(wallets_balance - ledger_total):
        return ledger_total
    return users_balance


async def _build_reconciliation_rows(query: dict, limit: int):
    cap = min(max(limit, 1), 500)
    users = await db.users.find(
        query,
        {
            "_id": 1,
            "email": 1,
            "canonical_email": 1,
            "email_aliases": 1,
            "role": 1,
            "balance": 1,
            "user_number": 1,
            "created_at": 1,
        },
    ).sort("created_at", -1).limit(cap).to_list(cap)

    email_counts = defaultdict(int)
    canonical_counts = defaultdict(int)
    for user in users:
        email_counts[(user.get("email") or "").strip().lower()] += 1
        canonical_counts[(user.get("canonical_email") or user.get("email") or "").strip().lower()] += 1

    wallet_docs = await db.wallets.find({}, {"_id": 0, "user_id": 1, "balance": 1, "currency": 1}).to_list(5000)
    wallet_count_by_user = defaultdict(int)
    for wallet in wallet_docs:
        if wallet.get("user_id"):
            wallet_count_by_user[wallet["user_id"]] += 1

    user_ids = [str(user["_id"]) for user in users]
    latest_repairs = {}
    if user_ids:
        repair_rows = await db.wallet_repair_actions.find(
            {"user_id": {"$in": user_ids}},
            {"_id": 0, "repair_id": 1, "user_id": 1, "action_type": 1, "status": 1, "reason": 1, "approved_by": 1, "approved_at": 1},
        ).sort("approved_at", -1).to_list(2000)
        for repair in repair_rows:
            uid = repair.get("user_id")
            if uid and uid not in latest_repairs:
                latest_repairs[uid] = repair

    rows = []
    mismatch_count = 0
    healthy_count = 0
    duplicate_wallets = 0
    duplicate_users = 0
    critical_cases = 0
    legacy_wallets = 0

    for user in users:
        uid = str(user["_id"])
        wallet_doc = await db.wallets.find_one({"user_id": uid}, {"_id": 0, "balance": 1, "currency": 1}) or {}
        tx_rows = await db.transactions.find({"user_id": uid}, {"_id": 0, "amount": 1, "status": 1, "type": 1}).to_list(5000)
        wallet_tx_rows = await db.wallet_transactions.find({"user_id": uid}, {"_id": 0, "amount": 1, "type": 1}).to_list(5000)

        users_balance = round(float(user.get("balance", 0) or 0), 2)
        wallets_balance = round(float(wallet_doc.get("balance", 0) or 0), 2)
        tx_sum = round(sum(float(t.get("amount") or 0) for t in tx_rows if isinstance(t.get("amount"), (int, float)) and t.get("status", "completed") == "completed"), 2)
        wallet_tx_sum = round(sum(float(t.get("amount") or 0) for t in wallet_tx_rows if isinstance(t.get("amount"), (int, float))), 2)
        expected_balance = round(_expected_balance(users_balance, wallets_balance, tx_sum, wallet_tx_sum), 2)
        displayed_balance = users_balance
        delta = round(displayed_balance - wallets_balance, 2)
        ledger_gap = round(displayed_balance - (tx_sum + wallet_tx_sum), 2)
        confidence_score = _confidence_score(users_balance, wallets_balance, tx_sum, wallet_tx_sum)
        risk_level = _risk_level(users_balance, wallets_balance, tx_sum, wallet_tx_sum)
        risk_band = _risk_band(delta, ledger_gap)

        duplicate_flags = []
        email_key = (user.get("email") or "").strip().lower()
        canonical_key = (user.get("canonical_email") or user.get("email") or "").strip().lower()
        if email_key and email_counts[email_key] > 1:
            duplicate_flags.append("duplicate_email")
        if canonical_key and canonical_counts[canonical_key] > 1:
            duplicate_flags.append("duplicate_canonical_user")
        if wallet_count_by_user[uid] > 1:
            duplicate_flags.append("duplicate_wallet")
        if user.get("role") == "admin" and email_key in {"admin@bidblitz.ae", "admin@bidblitz.com"}:
            duplicate_flags.append("duplicate_admin_alias")

        recommended_action = _recommended_action(users_balance, wallets_balance, tx_sum, wallet_tx_sum, duplicate_flags)
        recommended_repair = _recommended_repair(users_balance, wallets_balance, tx_sum, wallet_tx_sum)
        latest_repair = latest_repairs.get(uid)
        latest_repair_action = (latest_repair or {}).get("action_type")
        latest_repair_status = (latest_repair or {}).get("status")
        latest_repair_reason = (latest_repair or {}).get("reason")
        latest_repair_at = (latest_repair or {}).get("approved_at") or None

        base_pending = abs(delta) >= 0.01 or bool(duplicate_flags)
        if latest_repair_status == "approved" and latest_repair_action in {
            "mark_reviewed",
            "ignore_legacy_wallet",
            "sync_displayed_balance_to_canonical_users_balance",
            "create_adjustment_entry",
            "merge_duplicate_wallet",
            "send_to_investigation",
        }:
            pending_reconciliation = False
        else:
            pending_reconciliation = base_pending

        if abs(delta) >= 0.01:
            mismatch_count += 1
        else:
            healthy_count += 1
        if wallet_count_by_user[uid] > 1:
            duplicate_wallets += 1
        if any(flag in {"duplicate_email", "duplicate_canonical_user", "duplicate_admin_alias"} for flag in duplicate_flags):
            duplicate_users += 1
        if risk_band == "red":
            critical_cases += 1
        if wallets_balance != 0 and displayed_balance != wallets_balance:
            legacy_wallets += 1

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
            "expected_balance": expected_balance,
            "displayed_balance": displayed_balance,
            "delta": delta,
            "ledger_gap": ledger_gap,
            "confidence_score": confidence_score,
            "risk_level": risk_level,
            "risk_band": risk_band,
            "recommended_action": recommended_action,
            "recommended_repair": recommended_repair,
            "duplicate_flags": duplicate_flags,
            "wallet_exists": bool(wallet_doc),
            "wallet_count": wallet_count_by_user[uid],
            "legacy_wallet": wallets_balance != 0 and displayed_balance != wallets_balance,
            "pending_reconciliation": pending_reconciliation,
            "latest_repair_action": latest_repair_action,
            "latest_repair_status": latest_repair_status,
            "latest_repair_reason": latest_repair_reason,
            "latest_repair_at": latest_repair_at,
        })

    rows.sort(key=lambda row: (row["risk_band"] != "red", -abs(row["delta"]), row["confidence_score"]))
    summary = {
        "total_wallets": len(rows),
        "healthy_wallets": healthy_count,
        "mismatched_wallets": mismatch_count,
        "duplicate_wallets": duplicate_wallets,
        "duplicate_users": duplicate_users,
        "critical_cases": critical_cases,
        "legacy_wallets": legacy_wallets,
        "pending_reconciliation": sum(1 for row in rows if row["pending_reconciliation"]),
        "last_reconciliation_run": datetime.now(timezone.utc).isoformat(),
        "automatic_changes_performed": "NO",
    }
    return rows, summary


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
    reason: str = Field(..., min_length=3, max_length=240)
    idempotency_key: Optional[str] = None


class DebitReq(BaseModel):
    user_id: str
    amount_eur: float = 0
    amount_blz: float = 0
    reason: str = Field(..., min_length=3, max_length=240)
    idempotency_key: Optional[str] = None


class SelfTopupReq(BaseModel):
    amount_eur: float = 0
    amount_blz: float = 0
    reason: str = Field(..., min_length=3, max_length=240)
    idempotency_key: Optional[str] = None


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
            metadata={"admin_id": admin_id, "audit_metadata": {"route": "admin_wallet.credit"}},
            idempotency_key=req.idempotency_key,
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
            idempotency_key=req.idempotency_key,
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
            metadata={"self_topup": True, "audit_metadata": {"route": "admin_wallet.self_topup"}},
            idempotency_key=req.idempotency_key,
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

    rows, summary = await _build_reconciliation_rows(query, limit)
    return {
        "rows": rows,
        "count": len(rows),
        "mismatch_count": summary["mismatched_wallets"],
        "canonical_visible_source": "users.balance",
        "note": "Read-only forensic view. No balances were modified.",
        "summary": summary,
    }


@router.get("/reconciliation/dashboard")
async def reconciliation_dashboard(request: Request):
    await _require_admin(request)
    rows, summary = await _build_reconciliation_rows({}, 500)

    queue_items = []
    for row in rows:
        if row["pending_reconciliation"]:
            queue_items.append({
                "user_id": row["user_id"],
                "email": row["email"],
                "risk_band": row["risk_band"],
                "recommended_action": row["recommended_action"],
                "delta": row["delta"],
                "status": "pending_review",
            })

    duplicate_groups = {
        "duplicate_email": [row for row in rows if "duplicate_email" in row["duplicate_flags"]],
        "duplicate_wallet": [row for row in rows if "duplicate_wallet" in row["duplicate_flags"]],
        "duplicate_canonical_user": [row for row in rows if "duplicate_canonical_user" in row["duplicate_flags"]],
        "duplicate_admin_alias": [row for row in rows if "duplicate_admin_alias" in row["duplicate_flags"]],
    }

    return {
        "summary": summary,
        "dashboard": {
            "healthy_wallets": summary["healthy_wallets"],
            "needs_review": summary["pending_reconciliation"],
            "critical": summary["critical_cases"],
            "duplicate_users": summary["duplicate_users"],
            "legacy_wallets": summary["legacy_wallets"],
        },
        "queue": queue_items[:100],
        "duplicate_groups": {key: [{"user_id": row["user_id"], "email": row["email"], "canonical_email": row["canonical_email"], "wallet_count": row["wallet_count"]} for row in value[:100]] for key, value in duplicate_groups.items()},
        "automatic_changes_performed": "NO",
        "ready_for_manual_reconciliation": True,
        "note": "Read-only dashboard. Manual approvals required for every future repair.",
    }


@router.get("/reconciliation/history/{user_id}")
async def reconciliation_history(request: Request, user_id: str):
    await _require_admin(request)

    target = await db.users.find_one({"_id": ObjectId(user_id)}, {"_id": 1, "email": 1, "canonical_email": 1, "balance": 1, "balance_blz": 1, "role": 1})
    if not target:
        raise HTTPException(404, "User nicht gefunden.")

    uid = str(target["_id"])
    ledger = await db.transactions.find({"user_id": uid}, {"_id": 0}).sort("created_at", -1).limit(500).to_list(500)
    wallet_history = await db.wallet_transactions.find({"user_id": uid}, {"_id": 0}).sort("created_at", -1).limit(500).to_list(500)
    payment_history = [row for row in ledger if row.get("type") in {"payment", "merchant_payment", "merchant_payment_received", "transfer", "topup"}]
    refund_history = [row for row in ledger if row.get("type") == "refund"]
    cashback_history = [row for row in ledger if row.get("type") in {"reward", "reward_wallet_credit", "cashback"}]
    adjustment_history = [row for row in ledger if str(row.get("type", "")).startswith("admin_") or row.get("metadata", {}).get("admin_id")]
    reviews = await db.wallet_reconciliation_reviews.find({"user_id": uid}, {"_id": 0}).sort("timestamp", -1).limit(200).to_list(200)

    return {
        "user": {
            "user_id": uid,
            "email": target.get("email", ""),
            "canonical_email": target.get("canonical_email") or target.get("email", ""),
            "role": target.get("role", "user"),
            "users_balance": round(float(target.get("balance", 0) or 0), 2),
            "balance_blz": round(float(target.get("balance_blz", 0) or 0), 2),
        },
        "complete_ledger": ledger,
        "complete_transaction_history": ledger,
        "wallet_transaction_history": wallet_history,
        "adjustment_history": adjustment_history,
        "payment_history": payment_history,
        "refund_history": refund_history,
        "cashback_history": cashback_history,
        "review_history": reviews,
        "note": "Read-only history viewer. No balances or transactions modified.",
    }


class ReconciliationReviewReq(BaseModel):
    user_id: str
    reason: str = Field(..., min_length=3, max_length=400)
    result: str = Field(..., min_length=2, max_length=120)


@router.post("/reconciliation/review")
async def create_reconciliation_review(req: ReconciliationReviewReq, request: Request):
    reviewer = await _require_admin(request)
    doc = {
        "review_id": f"WRV-{ObjectId()}"[-12:],
        "user_id": req.user_id,
        "reviewer": reviewer.get("email", "admin@bidblitz.ae"),
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "reason": req.reason,
        "result": req.result,
        "queue_status": "pending_manual_repair",
    }
    await db.wallet_reconciliation_reviews.insert_one(doc)
    doc.pop("_id", None)
    return {"ok": True, "review": doc, "automatic_changes_performed": "NO"}


class RepairPreviewReq(BaseModel):
    user_id: str
    action_type: str = Field(..., min_length=2, max_length=80)
    reason: str = Field(..., min_length=3, max_length=400)
    adjustment_amount: float = 0
    target_wallet_id: Optional[str] = None


class RepairApproveReq(BaseModel):
    repair_id: str
    reason: str = Field(..., min_length=3, max_length=400)
    admin_password: str = Field(..., min_length=6, max_length=200)
    otp_code: Optional[str] = None


ALLOWED_REPAIR_ACTIONS = {
    "mark_reviewed",
    "ignore_legacy_wallet",
    "sync_displayed_balance_to_canonical_users_balance",
    "create_adjustment_entry",
    "merge_duplicate_wallet",
    "send_to_investigation",
}


def _validate_safe_repair(req: RepairPreviewReq, row: dict):
    if req.action_type not in ALLOWED_REPAIR_ACTIONS:
        raise HTTPException(400, "Action nicht erlaubt.")
    if req.action_type == "create_adjustment_entry" and req.adjustment_amount == 0:
        raise HTTPException(400, "Adjustment-Betrag erforderlich.")
    if req.action_type == "create_adjustment_entry" and abs(req.adjustment_amount) == abs(row.get("users_balance", 0)) and row.get("users_balance", 0) != 0:
        raise HTTPException(400, "Gefährliche Vollüberschreibung blockiert.")
    if req.action_type == "merge_duplicate_wallet" and not req.target_wallet_id:
        raise HTTPException(400, "Ziel-Wallet erforderlich.")


@router.post("/reconciliation/repair/preview")
async def repair_preview(req: RepairPreviewReq, request: Request):
    admin = await _require_admin(request)
    row, wallet_doc = await _build_repair_context(req.user_id)
    _validate_safe_repair(req, row)
    ip, ua = get_client_info(request)

    pending = {
        "repair_id": f"WRP-{ObjectId()}"[-12:],
        "user_id": req.user_id,
        "wallet_id": str(wallet_doc.get("_id") or req.user_id),
        "action_type": req.action_type,
        "before_users_balance": row["users_balance"],
        "before_wallets_balance": row["wallets_balance"],
        "after_users_balance": row["users_balance"] if req.action_type != "create_adjustment_entry" else round(row["users_balance"] + float(req.adjustment_amount or 0), 2),
        "after_wallets_balance": row["wallets_balance"],
        "delta": row["delta"],
        "reason": req.reason,
        "approved_by": admin.get("email", "admin@bidblitz.ae"),
        "approved_at": None,
        "status": "pending_approval",
        "audit_metadata": {
            "risk_level": row["risk_level"],
            "risk_band": row["risk_band"],
            "recommended_action": row["recommended_action"],
            "duplicate_flags": row["duplicate_flags"],
            "ip": ip,
            "user_agent": ua,
            "target_wallet_id": req.target_wallet_id,
            "adjustment_amount": float(req.adjustment_amount or 0),
        },
    }
    pending_response = {**pending}
    await db.wallet_repair_actions.insert_one(pending)
    await log_audit(
        AuditEvent.ADMIN_ACTION,
        user_id=str(admin["_id"]),
        email=admin.get("email", ""),
        ip=ip,
        user_agent=ua,
        details={"action": "wallet_repair_preview", "repair_id": pending["repair_id"], "target_user_id": req.user_id, "action_type": req.action_type},
        severity="info",
    )
    return {"ok": True, "repair": pending_response, "automatic_changes_performed": "NO", "confirmation_required": True}


@router.post("/reconciliation/repair/request-2fa")
async def repair_request_2fa(request: Request):
    admin = await _require_admin(request)
    if not admin.get("two_factor_enabled"):
        return {"ok": True, "two_factor_required": False}
    from routes.two_factor import generate_otp, send_otp_email, OTP_EXPIRY_MINUTES

    otp = generate_otp()
    now = datetime.now(timezone.utc)
    expires = now.isoformat()
    expires_at = (now.replace() + __import__('datetime').timedelta(minutes=OTP_EXPIRY_MINUTES)).isoformat()
    await db.otp_codes.delete_many({"user_id": str(admin["_id"]), "purpose": "wallet_repair_stepup"})
    await db.otp_codes.insert_one({
        "user_id": str(admin["_id"]),
        "code": otp,
        "purpose": "wallet_repair_stepup",
        "attempts": 0,
        "created_at": expires,
        "expires_at": expires_at,
    })
    sent = await send_otp_email(admin.get("email", ""), otp, "wallet_repair", admin.get("name", ""))
    return {"ok": True, "two_factor_required": True, "email_sent": sent, "_test_otp": otp if not sent else None}


@router.post("/reconciliation/repair/approve")
async def approve_repair(req: RepairApproveReq, request: Request):
    admin = await _require_admin(request)
    repair = await db.wallet_repair_actions.find_one({"repair_id": req.repair_id})
    if not repair:
        raise HTTPException(404, "Repair nicht gefunden.")
    if repair.get("status") != "pending_approval":
        raise HTTPException(400, "Repair ist nicht mehr freigabebereit.")
    if not req.reason.strip():
        raise HTTPException(400, "Grund erforderlich.")

    await _verify_admin_step_up(admin, req.admin_password, req.otp_code)

    action_type = repair.get("action_type")
    if action_type == "create_adjustment_entry":
        amount = float((repair.get("audit_metadata") or {}).get("adjustment_amount") or 0)
        if amount == 0:
            raise HTTPException(400, "Adjustment ohne Betrag blockiert.")
        if repair.get("after_users_balance") == 0 and repair.get("before_users_balance") != 0:
            raise HTTPException(400, "Setzen auf 0 ist blockiert.")
        if amount > 0:
            result = await credit_wallet(
                user_id=repair["user_id"],
                amount=amount,
                tx_type=TransactionType.ADMIN_CREDIT,
                description=f"Wallet Repair Adjustment: {req.reason}",
                source="wallet_repair_adjustment",
                metadata={"repair_id": req.repair_id, "admin_id": str(admin["_id"]), "audit_metadata": {"route": "admin_wallet.repair.approve"}},
                idempotency_key=f"repair:{req.repair_id}",
            )
        else:
            result = await debit_wallet(
                user_id=repair["user_id"],
                amount=abs(amount),
                tx_type=TransactionType.ADMIN_DEBIT,
                description=f"Wallet Repair Adjustment: {req.reason}",
                metadata={"repair_id": req.repair_id, "admin_id": str(admin["_id"]), "audit_metadata": {"route": "admin_wallet.repair.approve"}},
                idempotency_key=f"repair:{req.repair_id}",
            )
        if not result.success:
            raise HTTPException(400, result.error or "Adjustment fehlgeschlagen.")
    elif action_type == "ignore_legacy_wallet":
        await db.wallets.update_many({"user_id": repair["user_id"]}, {"$set": {"legacy_ignored": True, "legacy_ignored_at": datetime.now(timezone.utc).isoformat(), "legacy_ignored_by": admin.get("email", "")}})
    elif action_type == "sync_displayed_balance_to_canonical_users_balance":
        await db.wallets.update_many({"user_id": repair["user_id"]}, {"$set": {"display_source": "users.balance", "display_sync_reviewed_at": datetime.now(timezone.utc).isoformat(), "display_sync_reviewed_by": admin.get("email", "")}})
    elif action_type == "merge_duplicate_wallet":
        target_wallet_id = (repair.get("audit_metadata") or {}).get("target_wallet_id")
        if not target_wallet_id:
            raise HTTPException(400, "Target-Wallet fehlt.")
        target_wallet = await db.wallets.find_one({"_id": ObjectId(target_wallet_id)})
        if not target_wallet or str(target_wallet.get("user_id")) != str(repair["user_id"]):
            raise HTTPException(400, "Merge nur innerhalb derselben kanonischen User-ID erlaubt.")
        await db.wallets.update_many({"user_id": repair["user_id"]}, {"$set": {"merge_candidate": True, "merge_candidate_target": target_wallet_id, "merge_candidate_reviewed_at": datetime.now(timezone.utc).isoformat()}})
    elif action_type in {"mark_reviewed", "send_to_investigation"}:
        pass
    else:
        raise HTTPException(400, "Action blockiert.")

    approved_at = datetime.now(timezone.utc).isoformat()
    await db.wallet_repair_actions.update_one(
        {"repair_id": req.repair_id},
        {"$set": {"status": "approved", "approved_at": approved_at, "approved_by": admin.get("email", ""), "reason": req.reason, "audit_metadata.approval_reason": req.reason}}
    )
    await log_audit(
        AuditEvent.ADMIN_ACTION,
        user_id=str(admin["_id"]),
        email=admin.get("email", ""),
        ip=get_client_info(request)[0],
        user_agent=get_client_info(request)[1],
        details={"action": "wallet_repair_approved", "repair_id": req.repair_id, "action_type": action_type, "target_user_id": repair["user_id"]},
        severity="warn" if action_type in {"create_adjustment_entry", "merge_duplicate_wallet"} else "info",
    )
    updated = await db.wallet_repair_actions.find_one({"repair_id": req.repair_id}, {"_id": 0})
    return {"ok": True, "repair": updated, "automatic_changes_performed": "NO" if action_type != "create_adjustment_entry" else "NO_AUTO_ONLY_MANUAL_APPROVED"}


@router.get("/reconciliation/repair-history")
async def repair_history(request: Request, limit: int = 100):
    await _require_admin(request)
    rows = await db.wallet_repair_actions.find({}, {"_id": 0}).sort("approved_at", -1).limit(min(max(limit, 1), 300)).to_list(min(max(limit, 1), 300))
    return {"repairs": rows, "count": len(rows), "automatic_changes_performed": "NO"}


@router.get("/reconciliation/final-report")
async def reconciliation_final_report(request: Request):
    await _require_admin(request)
    rows, summary = await _build_reconciliation_rows({}, 500)
    return {
        "wallets_analysed": summary["total_wallets"],
        "wallets_healthy": summary["healthy_wallets"],
        "wallets_mismatched": summary["mismatched_wallets"],
        "duplicate_wallets": summary["duplicate_wallets"],
        "duplicate_users": summary["duplicate_users"],
        "critical_cases": summary["critical_cases"],
        "automatic_changes_performed": "NO",
        "ready_for_manual_reconciliation": True,
        "last_reconciliation_run": summary["last_reconciliation_run"],
        "note": "Read-only banking-style reconciliation prepared. No balances modified automatically.",
        "top_cases": [
            {
                "user_id": row["user_id"],
                "email": row["email"],
                "delta": row["delta"],
                "risk_band": row["risk_band"],
                "recommended_action": row["recommended_action"],
            }
            for row in rows[:25]
        ],
    }
