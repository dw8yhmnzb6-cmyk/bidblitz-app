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

from core.database import db
from core.security import get_current_user
from core.payment_engine import credit_wallet, debit_wallet, TransactionType

router = APIRouter(prefix="/api/admin/wallet", tags=["admin-wallet"])


async def _require_admin(request: Request):
    user = await get_current_user(request)
    if (user.get("role") or "") not in ("admin", "super_admin"):
        raise HTTPException(403, "Admin-Rechte erforderlich.")
    return user


@router.get("/users")
async def search_users(request: Request, q: str = "", limit: int = 30):
    await _require_admin(request)
    query = {}
    q = (q or "").strip().lower()
    if q:
        query = {
            "$or": [
                {"email": {"$regex": q, "$options": "i"}},
                {"username": {"$regex": q, "$options": "i"}},
                {"full_name": {"$regex": q, "$options": "i"}},
            ]
        }
    cur = db.users.find(query, {
        "_id": 1, "id": 1, "email": 1, "username": 1, "full_name": 1,
        "role": 1, "wallet_balance": 1, "created_at": 1,
    }).sort("created_at", -1).limit(limit)

    users = []
    async for u in cur:
        uid = str(u.get("_id") or u.get("id"))
        # Look up actual wallet doc for BLZ balance
        wallet = await db.wallets.find_one({"user_id": uid}, {"_id": 0, "balance": 1, "balance_blz": 1})
        users.append({
            "user_id": uid,
            "email": u.get("email", ""),
            "username": u.get("username") or u.get("full_name", ""),
            "role": u.get("role", "user"),
            "balance_eur": float((wallet or {}).get("balance", u.get("wallet_balance", 0)) or 0),
            "balance_blz": float((wallet or {}).get("balance_blz", 0) or 0),
            "created_at": u.get("created_at"),
        })
    return {"users": users, "count": len(users)}


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
    """BLZ uses a separate balance_blz field in wallets collection."""
    if amount <= 0:
        return
    await db.wallets.update_one(
        {"user_id": user_id},
        {"$inc": {"balance_blz": amount}, "$setOnInsert": {"user_id": user_id, "balance": 0}},
        upsert=True,
    )
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
    wallet = await db.wallets.find_one({"user_id": user_id}, {"_id": 0, "balance_blz": 1})
    if not wallet or (wallet.get("balance_blz", 0) or 0) < amount:
        raise HTTPException(400, "Nutzer hat nicht genug BLZ.")
    await db.wallets.update_one(
        {"user_id": user_id}, {"$inc": {"balance_blz": -amount}}
    )
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

    if req.amount_blz > 0:
        await _credit_blz(req.user_id, req.amount_blz, admin_id, req.reason)

    return {
        "ok": True,
        "credited_eur": req.amount_eur,
        "credited_blz": req.amount_blz,
        "user_email": target.get("email"),
        "tx_id": eur_result.get("tx_id") if eur_result else None,
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
            tx_type=TransactionType.ADMIN_CREDIT,
            description=f"Abzug: {req.reason}",
            metadata={"admin_id": admin_id, "direction": "debit"},
        )
        if not res.get("success"):
            raise HTTPException(400, res.get("error", "Debit fehlgeschlagen."))

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

    # Return new balance
    wallet = await db.wallets.find_one({"user_id": admin_id}, {"_id": 0, "balance": 1, "balance_blz": 1}) or {}
    return {
        "ok": True,
        "balance_eur": float(wallet.get("balance", 0) or 0),
        "balance_blz": float(wallet.get("balance_blz", 0) or 0),
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
