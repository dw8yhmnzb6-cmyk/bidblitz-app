"""
BidBlitz V2 - Admin Grants & Coupon System
Admin can grant balance, coins, create coupons. Users can redeem coupons.
"""

from datetime import datetime, timedelta, timezone
from typing import Optional
import secrets
import string

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from core.database import db
from core.payment_engine import TransactionType, credit_wallet
from core.security import get_current_user

router = APIRouter(prefix="/api/admin/grants", tags=["admin-grants"])

ALLOWED_COUPON_TYPES = {"eur", "coins", "bid_credits", "blz", "kids_abo", "premium_month"}


def _status_value(result) -> str:
    return str(getattr(result.status, "value", result.status) or "")


async def _notify_once(notification_id: str, payload: dict) -> None:
    await db.notifications.update_one(
        {"id": notification_id},
        {"$setOnInsert": {"id": notification_id, **payload}},
        upsert=True,
    )


async def _record_transaction_once(transaction_id: str, payload: dict) -> None:
    await db.transactions.update_one(
        {"id": transaction_id},
        {"$setOnInsert": {"id": transaction_id, **payload}},
        upsert=True,
    )


async def _claim_coupon_redemption(coupon: dict, user_id: str, now: str) -> tuple[str, dict, bool]:
    """Create a durable per-user redemption record using MongoDB's unique _id."""
    redemption_id = f"coupon:{coupon['coupon_id']}:{user_id}"
    existing = await db.coupon_redemptions.find_one({"_id": redemption_id})
    if existing:
        return redemption_id, existing, False

    doc = {
        "_id": redemption_id,
        "coupon_id": coupon["coupon_id"],
        "coupon_code": coupon["code"],
        "user_id": user_id,
        "coupon_type": coupon["coupon_type"],
        "value": coupon["value"],
        "status": "processing",
        "coupon_claimed": False,
        "created_at": now,
        "updated_at": now,
    }
    try:
        await db.coupon_redemptions.insert_one(doc)
        return redemption_id, doc, True
    except Exception:
        existing = await db.coupon_redemptions.find_one({"_id": redemption_id})
        if not existing:
            raise
        return redemption_id, existing, False


async def _claim_coupon_usage(coupon: dict, user_id: str, redemption_id: str, redemption: dict, now: str) -> None:
    """Reserve one coupon use exactly once before applying its reward."""
    if redemption.get("coupon_claimed"):
        return

    result = await db.coupons.update_one(
        {
            "coupon_id": coupon["coupon_id"],
            "active": True,
            "used_count": {"$lt": coupon["max_uses"]},
            "used_by": {"$ne": user_id},
        },
        {
            "$inc": {"used_count": 1},
            "$addToSet": {"used_by": user_id},
        },
    )

    if result.modified_count != 1:
        latest = await db.coupons.find_one({"coupon_id": coupon["coupon_id"]})
        # Recovery path: the coupon usage may have been claimed immediately before
        # a crash, while coupon_redemptions.coupon_claimed was not persisted yet.
        if latest and user_id in latest.get("used_by", []):
            await db.coupon_redemptions.update_one(
                {"_id": redemption_id},
                {"$set": {"coupon_claimed": True, "updated_at": now}},
            )
            return

        await db.coupon_redemptions.update_one(
            {"_id": redemption_id},
            {"$set": {"status": "claim_failed", "updated_at": now}},
        )
        if latest and latest.get("used_count", 0) >= latest.get("max_uses", 0):
            raise HTTPException(400, "Gutschein wurde bereits vollständig eingelöst")
        raise HTTPException(400, "Du hast diesen Gutschein bereits eingelöst")

    await db.coupon_redemptions.update_one(
        {"_id": redemption_id},
        {"$set": {"coupon_claimed": True, "updated_at": now}},
    )


async def _apply_non_eur_coupon_reward(
    *,
    user: dict,
    user_id: str,
    coupon: dict,
    redemption_id: str,
    claimed_at: str,
) -> str:
    """Apply non-EUR coupon rewards in a retry-safe way."""
    coupon_type = coupon["coupon_type"]
    value = coupon["value"]

    if coupon_type in {"coins", "bid_credits", "blz"}:
        field = {
            "coins": "coins",
            "bid_credits": "bid_credits",
            "blz": "blz_balance",
        }[coupon_type]
        delta = int(value) if coupon_type == "bid_credits" else value
        marker = f"coupon_reward:{coupon['coupon_id']}:{user_id}"
        update_result = await db.users.update_one(
            {"_id": user["_id"], "coupon_reward_markers": {"$ne": marker}},
            {
                "$inc": {field: delta},
                "$addToSet": {"coupon_reward_markers": marker},
            },
        )
        if update_result.modified_count != 1:
            latest_user = await db.users.find_one({"_id": user["_id"]})
            if not latest_user or marker not in latest_user.get("coupon_reward_markers", []):
                raise RuntimeError("Coupon reward could not be applied safely")

        if coupon_type == "coins":
            return f"{int(value)} Coins"
        if coupon_type == "bid_credits":
            return f"{int(value)} Bid Credits"
        return f"{value:.2f} BLZ Token"

    claimed_at_dt = datetime.fromisoformat(claimed_at.replace("Z", "+00:00"))
    expires_at = (claimed_at_dt + timedelta(days=int(value) * 30)).isoformat()

    if coupon_type == "kids_abo":
        await db.kids_subscriptions.update_one(
            {"user_id": user_id},
            {
                "$set": {
                    "plan": "premium",
                    "status": "active",
                    "granted_by_coupon": coupon["code"],
                    "coupon_redemption_id": redemption_id,
                },
                "$max": {"expires_at": expires_at},
            },
            upsert=True,
        )
        return f"BidBlitz Kids Premium ({int(value)} Monate)"

    if coupon_type == "premium_month":
        await db.subscriptions.update_one(
            {"user_id": user_id},
            {
                "$set": {
                    "plan": "premium",
                    "status": "active",
                    "granted_by_coupon": coupon["code"],
                    "coupon_redemption_id": redemption_id,
                },
                "$max": {"expires_at": expires_at},
            },
            upsert=True,
        )
        return f"Premium-Abo ({int(value)} Monate)"

    raise RuntimeError(f"Unsupported coupon type: {coupon_type}")


# ══════════════════════════════════════════════════════════════════════════════
# ADMIN: Grant Balance / Coins to User
# ══════════════════════════════════════════════════════════════════════════════

class GrantRequest(BaseModel):
    user_email: str
    grant_type: str  # "eur", "coins", "bid_credits", "blz"
    amount: float = Field(..., gt=0)
    reason: str = ""
    idempotency_key: Optional[str] = None


@router.post("/balance")
async def admin_grant_balance(req: GrantRequest, request: Request):
    """Admin: Grant EUR, Coins, Bid Credits, or BLZ to a user."""
    admin = await get_current_user(request)
    if admin.get("role") not in ("admin", "super_admin"):
        raise HTTPException(403, "Nur für Admins")

    user = await db.users.find_one({"email": req.user_email})
    if not user:
        raise HTTPException(404, f"User '{req.user_email}' nicht gefunden")

    now = datetime.now(timezone.utc).isoformat()
    user_id = str(user["_id"])
    admin_id = str(admin["_id"])
    field_map = {"eur": "balance", "coins": "coins", "bid_credits": "bid_credits", "blz": "blz_balance"}
    field = field_map.get(req.grant_type)
    if not field:
        raise HTTPException(400, f"Unbekannter Typ: {req.grant_type}. Erlaubt: eur, coins, bid_credits, blz")

    client_idempotency_key = (req.idempotency_key or request.headers.get("Idempotency-Key") or "").strip()
    transaction_id = None

    if req.grant_type == "eur":
        canonical_idempotency_key = (
            f"admin_grant:{admin_id}:{client_idempotency_key}"
            if client_idempotency_key
            else None
        )
        stable_reference = (
            f"ADMIN-GRANT-{admin_id}-{client_idempotency_key}"
            if client_idempotency_key
            else None
        )
        result = await credit_wallet(
            user_id=user_id,
            amount=req.amount,
            tx_type=TransactionType.ADMIN_CREDIT,
            description=f"Admin-Gutschrift: {req.reason or 'Keine Angabe'}",
            reference=stable_reference,
            source="admin_grant",
            metadata={
                "granted_by": admin_id,
                "admin_email": admin.get("email", ""),
                "grant_type": "eur",
                "reason": req.reason,
                "route": "admin_grants.balance",
                "audit_metadata": {"kind": "admin_grant"},
            },
            idempotency_key=canonical_idempotency_key,
        )
        if not result.success:
            status = _status_value(result)
            status_code = 409 if status in {"pending", "reconciliation_required"} else 400
            raise HTTPException(status_code, result.error or "Admin-Gutschrift fehlgeschlagen")
        transaction_id = result.transaction_id
        new_value = result.new_balance
    else:
        # Non-EUR reward balances are separate product counters. Preserve their
        # existing storage model, but honor an idempotency key when a caller sends one.
        marker = f"admin_grant:{admin_id}:{client_idempotency_key}" if client_idempotency_key else None
        selector = {"_id": user["_id"]}
        update = {"$inc": {field: req.amount}}
        if marker:
            selector["admin_grant_markers"] = {"$ne": marker}
            update["$addToSet"] = {"admin_grant_markers": marker}
        update_result = await db.users.update_one(selector, update)
        if marker and update_result.modified_count != 1:
            latest_user = await db.users.find_one({"_id": user["_id"]})
            if not latest_user or marker not in latest_user.get("admin_grant_markers", []):
                raise HTTPException(409, "Admin-Gutschrift konnte nicht sicher verarbeitet werden")

        transaction_id = f"ADMIN-GRANT-{admin_id}-{client_idempotency_key}" if client_idempotency_key else f"ADMIN-GRANT-{secrets.token_hex(8)}"
        await _record_transaction_once(
            transaction_id,
            {
                "tx_id": transaction_id,
                "user_id": user_id,
                "type": "ADMIN_GRANT",
                "amount": req.amount,
                "description": f"Admin-Gutschrift: {req.amount} {req.grant_type.upper()} — {req.reason or 'Keine Angabe'}",
                "granted_by": admin_id,
                "grant_type": req.grant_type,
                "status": "completed",
                "created_at": now,
            },
        )
        updated = await db.users.find_one({"_id": user["_id"]})
        new_value = updated.get(field, 0)

    type_labels = {"eur": "EUR", "coins": "Coins", "bid_credits": "Bid Credits", "blz": "BLZ Token"}
    notification_id = f"admin-grant:{transaction_id}" if transaction_id else f"admin-grant:{secrets.token_hex(8)}"
    await _notify_once(
        notification_id,
        {
            "user_id": user_id,
            "type": "admin_grant",
            "title": "Gutschrift erhalten!",
            "message": f"Du hast {req.amount:.2f} {type_labels.get(req.grant_type, req.grant_type)} erhalten. {req.reason}",
            "read": False,
            "created_at": now,
        },
    )

    return {
        "ok": True,
        "user_email": req.user_email,
        "granted": req.amount,
        "type": req.grant_type,
        "new_value": new_value,
        "transaction_id": transaction_id,
    }


# ══════════════════════════════════════════════════════════════════════════════
# ADMIN: Create Coupons
# ══════════════════════════════════════════════════════════════════════════════

class CreateCouponRequest(BaseModel):
    coupon_type: str  # "eur", "coins", "bid_credits", "blz", "kids_abo", "premium_month"
    value: float = Field(..., gt=0)
    max_uses: int = Field(default=1, ge=1, le=10000)
    code: Optional[str] = None  # auto-generate if not provided
    description: str = ""
    expires_days: int = Field(default=30, ge=1, le=365)


@router.post("/coupon/create")
async def admin_create_coupon(req: CreateCouponRequest, request: Request):
    """Admin: Create a coupon code."""
    admin = await get_current_user(request)
    if admin.get("role") not in ("admin", "super_admin"):
        raise HTTPException(403, "Nur für Admins")

    if req.coupon_type not in ALLOWED_COUPON_TYPES:
        raise HTTPException(400, f"Unbekannter Gutscheintyp: {req.coupon_type}")

    code = req.code or ("BLITZ-" + "".join(secrets.choice(string.ascii_uppercase + string.digits) for _ in range(6)))
    code = code.upper().strip()

    existing = await db.coupons.find_one({"code": code})
    if existing:
        raise HTTPException(400, f"Code '{code}' existiert bereits")

    now = datetime.now(timezone.utc)
    expires = now + timedelta(days=req.expires_days)

    coupon = {
        "coupon_id": secrets.token_hex(8),
        "code": code,
        "coupon_type": req.coupon_type,
        "value": req.value,
        "description": req.description or f"{req.value} {req.coupon_type.upper()}",
        "max_uses": req.max_uses,
        "used_count": 0,
        "used_by": [],
        "created_by": str(admin["_id"]),
        "created_at": now.isoformat(),
        "expires_at": expires.isoformat(),
        "active": True,
    }
    await db.coupons.insert_one(coupon)
    coupon.pop("_id", None)

    return {"ok": True, "coupon": coupon}


@router.get("/coupons")
async def admin_list_coupons(request: Request):
    """Admin: List all coupons."""
    admin = await get_current_user(request)
    if admin.get("role") not in ("admin", "super_admin"):
        raise HTTPException(403, "Nur für Admins")

    coupons = await db.coupons.find({}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return {"coupons": coupons, "total": len(coupons)}


@router.delete("/coupon/{coupon_id}")
async def admin_delete_coupon(coupon_id: str, request: Request):
    """Admin: Deactivate a coupon."""
    admin = await get_current_user(request)
    if admin.get("role") not in ("admin", "super_admin"):
        raise HTTPException(403, "Nur für Admins")

    await db.coupons.update_one({"coupon_id": coupon_id}, {"$set": {"active": False}})
    return {"ok": True}


# ══════════════════════════════════════════════════════════════════════════════
# USER: Redeem Coupon
# ══════════════════════════════════════════════════════════════════════════════

class RedeemRequest(BaseModel):
    code: str


@router.post("/coupon/redeem")
async def redeem_coupon(req: RedeemRequest, request: Request):
    """Redeem a coupon exactly once per user, with retry-safe EUR settlement."""
    user = await get_current_user(request)
    user_id = str(user["_id"])

    code = req.code.upper().strip()
    coupon = await db.coupons.find_one({"code": code, "active": True})
    if not coupon:
        raise HTTPException(404, "Ungültiger Gutscheincode")

    if coupon.get("coupon_type") not in ALLOWED_COUPON_TYPES:
        raise HTTPException(400, f"Unbekannter Gutscheintyp: {coupon.get('coupon_type')}")

    if coupon.get("expires_at"):
        expires = datetime.fromisoformat(coupon["expires_at"].replace("Z", "+00:00"))
        if datetime.now(timezone.utc) > expires:
            raise HTTPException(400, "Gutschein ist abgelaufen")

    now = datetime.now(timezone.utc).isoformat()
    redemption_id, redemption, is_new = await _claim_coupon_redemption(coupon, user_id, now)

    if redemption.get("status") == "completed":
        response = redemption.get("response") or {}
        return {**response, "idempotent_replay": True}

    if is_new:
        if coupon.get("used_count", 0) >= coupon.get("max_uses", 0):
            await db.coupon_redemptions.update_one(
                {"_id": redemption_id},
                {"$set": {"status": "claim_failed", "updated_at": now}},
            )
            raise HTTPException(400, "Gutschein wurde bereits vollständig eingelöst")
        if user_id in coupon.get("used_by", []):
            await db.coupon_redemptions.update_one(
                {"_id": redemption_id},
                {"$set": {"status": "claim_failed", "updated_at": now}},
            )
            raise HTTPException(400, "Du hast diesen Gutschein bereits eingelöst")

    await _claim_coupon_usage(coupon, user_id, redemption_id, redemption, now)

    coupon_type = coupon["coupon_type"]
    value = coupon["value"]
    settlement_transaction_id = None

    try:
        if coupon_type == "eur":
            settlement_key = f"coupon_redemption:{coupon['coupon_id']}:{user_id}"
            stable_reference = f"COUPON-{coupon['coupon_id']}-{user_id}"
            result = await credit_wallet(
                user_id=user_id,
                amount=value,
                tx_type=TransactionType.VOUCHER_REDEMPTION,
                description=f"Gutschein eingelöst: {code}",
                reference=stable_reference,
                source="coupon_redemption",
                metadata={
                    "coupon_id": coupon["coupon_id"],
                    "coupon_code": code,
                    "redemption_id": redemption_id,
                    "route": "admin_grants.coupon_redeem",
                    "audit_metadata": {"kind": "coupon_redemption"},
                },
                idempotency_key=settlement_key,
            )
            if not result.success:
                status = _status_value(result)
                await db.coupon_redemptions.update_one(
                    {"_id": redemption_id},
                    {"$set": {
                        "status": "settlement_pending" if status == "pending" else "settlement_failed",
                        "settlement_status": status,
                        "settlement_error": result.error,
                        "updated_at": datetime.now(timezone.utc).isoformat(),
                    }},
                )
                status_code = 409 if status in {"pending", "reconciliation_required"} else 400
                raise HTTPException(status_code, result.error or "Gutschein-Gutschrift fehlgeschlagen")
            reward_msg = f"€{value:.2f} Guthaben"
            settlement_transaction_id = result.transaction_id
        else:
            reward_msg = await _apply_non_eur_coupon_reward(
                user=user,
                user_id=user_id,
                coupon=coupon,
                redemption_id=redemption_id,
                claimed_at=redemption.get("created_at") or now,
            )
            await _record_transaction_once(
                redemption_id,
                {
                    "tx_id": redemption_id,
                    "user_id": user_id,
                    "type": "COUPON_REDEEM",
                    "amount": value,
                    "description": f"Gutschein eingelöst: {code} — {reward_msg}",
                    "coupon_code": code,
                    "coupon_id": coupon["coupon_id"],
                    "status": "completed",
                    "created_at": redemption.get("created_at") or now,
                },
            )
    except HTTPException:
        raise
    except Exception as exc:
        await db.coupon_redemptions.update_one(
            {"_id": redemption_id},
            {"$set": {
                "status": "settlement_failed",
                "settlement_error": str(exc),
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }},
        )
        raise HTTPException(409, "Gutschein wurde reserviert, die Gutschrift muss erneut versucht werden")

    completed_at = datetime.now(timezone.utc).isoformat()
    response = {
        "ok": True,
        "reward": reward_msg,
        "coupon_type": coupon_type,
        "value": value,
        "message": f"{reward_msg} erfolgreich eingelöst!",
        "settlement_transaction_id": settlement_transaction_id,
    }
    await db.coupon_redemptions.update_one(
        {"_id": redemption_id},
        {"$set": {
            "status": "completed",
            "settlement_transaction_id": settlement_transaction_id,
            "response": response,
            "completed_at": completed_at,
            "updated_at": completed_at,
        }},
    )

    await _notify_once(
        f"coupon-redeemed:{coupon['coupon_id']}:{user_id}",
        {
            "user_id": user_id,
            "type": "coupon_redeemed",
            "title": "Gutschein eingelöst!",
            "message": f"{reward_msg} wurde deinem Konto gutgeschrieben.",
            "read": False,
            "created_at": completed_at,
        },
    )

    return response


# ══════════════════════════════════════════════════════════════════════════════
# ADMIN: Grant History
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/history")
async def admin_grant_history(request: Request):
    """Admin: Get grant/coupon redemption history."""
    admin = await get_current_user(request)
    if admin.get("role") not in ("admin", "super_admin"):
        raise HTTPException(403, "Nur für Admins")

    grants = await db.transactions.find(
        {"type": {"$in": ["ADMIN_GRANT", "COUPON_REDEEM", "admin_credit", "voucher_redemption"]}},
        {"_id": 0}
    ).sort("created_at", -1).limit(100).to_list(100)

    return {"history": grants, "total": len(grants)}
