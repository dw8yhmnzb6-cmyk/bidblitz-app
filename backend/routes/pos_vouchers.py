"""
BidBlitz POS - Gutschein & Karten-Aufladung System
Ermöglicht Verkauf von Gutscheinen und Wallet-Aufladungen am POS
"""

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime, timezone, timedelta
import secrets
import hashlib
from core.database import db
from core.security import get_current_user
from core.config import TEST_MODE
from core.payment_engine import credit_wallet, TransactionType
from services.pos_security import (
    audit_pos_security_event,
    build_customer_public_view,
    create_security_alert,
    evaluate_transaction_limits,
    execute_secure_topup,
    get_actor_context,
    get_effective_limits,
    get_resolution_customer,
    request_manager_approval,
    require_permission,
)

router = APIRouter(prefix="/api/pos/vouchers", tags=["POS Vouchers"])


class VoucherCreateRequest(BaseModel):
    store_id: str
    register_id: str
    amount: float = Field(..., gt=0, le=2000)
    payment_method: str = Field(default="cash", min_length=2, max_length=32)
    recipient_email: Optional[str] = None
    message: Optional[str] = Field(default=None, max_length=500)
    idempotency_key: Optional[str] = None


class WalletTopUpRequest(BaseModel):
    store_id: str
    register_id: str
    customer_user_number: str | None = None
    resolution_id: str | None = None
    amount: float
    payment_method: str = "cash"


class CustomerResolveRequest(BaseModel):
    lookup_type: str
    value: str
    store_id: str
    register_id: str = ""


class VoucherRedeemPayRequest(BaseModel):
    voucher_code: str
    cart_id: str


# ═══════════════════════════════════════════════════════════
# GUTSCHEIN-VERKAUF
# ═══════════════════════════════════════════════════════════

@router.post("/sell")
async def sell_voucher(req: VoucherCreateRequest, request: Request):
    """Verkaufe einen Gutschein genau einmal über einen berechtigten POS."""
    cashier = await get_current_user(request)
    actor = await get_actor_context(cashier, req.store_id, req.register_id)
    require_permission(actor, "giftcard.create")

    raw_key = str(req.idempotency_key or request.headers.get("Idempotency-Key") or "").strip()
    if not 8 <= len(raw_key) <= 200:
        raise HTTPException(status_code=400, detail="Idempotency-Key erforderlich")
    key_hash = hashlib.sha256(
        f"{actor['user_id']}:{req.store_id}:{raw_key}".encode("utf-8")
    ).hexdigest()[:24]
    if not TEST_MODE and req.payment_method != "cash":
        raise HTTPException(
            status_code=503,
            detail="Nicht-Bar-Gutscheinverkauf erfordert eine verifizierte Terminal-Zahlungsreferenz.",
        )

    limits = await get_effective_limits(actor["merchant_id"], actor["store_id"], actor["user_id"], actor["role"])
    approval_limit = float(limits.get("gift_card_approval_limit", 0) or 0)
    if approval_limit > 0 and req.amount >= approval_limit:
        approval = await request_manager_approval(
            actor,
            "gift_card_create",
            req.amount,
            {
                "store_id": req.store_id,
                "register_id": req.register_id,
                "payment_method": req.payment_method,
                "recipient_email": req.recipient_email,
                "message": req.message,
            },
            "Gift card creation requires manager approval",
            idempotency_key=f"voucher-sale:{key_hash}",
        )
        return {
            "ok": True,
            "status": "approval_required",
            "approval": approval,
            "message": "Gutscheinverkauf wartet auf Manager-Freigabe",
        }

    sale_id = f"VSALE-{key_hash.upper()}"
    voucher_code = f"GS-{key_hash[:12].upper()}"
    payload = {
        "store_id": req.store_id,
        "register_id": req.register_id,
        "amount": round(float(req.amount), 2),
        "payment_method": req.payment_method,
        "recipient_email": req.recipient_email,
        "message": req.message,
    }

    existing = await db.pos_vouchers.find_one({"sale_id": sale_id}, {"_id": 0})
    if existing:
        if existing.get("sale_payload") != payload:
            raise HTTPException(status_code=409, detail="Idempotency-Key wurde mit anderen Gutscheindaten verwendet")
        if existing.get("status") == "active":
            sale = await db.pos_sales.find_one({"sale_id": sale_id}, {"_id": 0}) or {}
            return {
                "ok": True,
                "voucher": {
                    "code": existing["voucher_code"],
                    "amount": existing["amount"],
                    "valid_until": existing["valid_until"],
                    "qr_code": f"BIDBLITZ-VOUCHER:{existing['voucher_code']}",
                },
                "sale": sale,
                "message": "Gutschein bereits verarbeitet",
                "replayed": True,
            }

    now = datetime.now(timezone.utc)
    valid_until = now + timedelta(days=365)
    voucher = {
        "voucher_code": voucher_code,
        "sale_id": sale_id,
        "sale_payload": payload,
        "type": "gift_card",
        "amount": round(float(req.amount), 2),
        "balance": round(float(req.amount), 2),
        "currency": "EUR",
        "status": "pending_sale",
        "sold_at": now.isoformat(),
        "sold_by_user_id": str(cashier["_id"]),
        "sold_at_store": req.store_id,
        "sold_at_register": req.register_id,
        "payment_method": req.payment_method,
        "valid_until": valid_until.isoformat(),
        "recipient_email": req.recipient_email,
        "message": req.message,
        "redeemed": False,
        "redeemed_at": None,
        "redeemed_by": None,
        "created_at": now.isoformat(),
    }
    await db.pos_vouchers.update_one(
        {"sale_id": sale_id},
        {"$setOnInsert": voucher},
        upsert=True,
    )

    sale = {
        "sale_id": sale_id,
        "receipt_id": f"GS-{key_hash[:8].upper()}",
        "store_id": req.store_id,
        "register_id": req.register_id,
        "cashier_user_id": str(cashier["_id"]),
        "type": "voucher_sale",
        "items": [{
            "product_id": "VOUCHER",
            "name": f"BidBlitz Gutschein €{req.amount:.2f}",
            "quantity": 1,
            "price": round(float(req.amount), 2),
            "tax_rate": 0.0,
        }],
        "subtotal": round(float(req.amount), 2),
        "tax_total": 0.0,
        "discount": 0.0,
        "total": round(float(req.amount), 2),
        "method": req.payment_method,
        "status": "completed",
        "idempotency_key": raw_key,
        "created_at": now.isoformat(),
    }
    await db.pos_sales.update_one(
        {"sale_id": sale_id},
        {"$setOnInsert": sale},
        upsert=True,
    )

    activated = await db.pos_vouchers.update_one(
        {"sale_id": sale_id, "status": "pending_sale"},
        {"$set": {"status": "active", "activated_at": now.isoformat()}},
    )
    current = await db.pos_vouchers.find_one({"sale_id": sale_id}, {"_id": 0}) or voucher
    if activated.modified_count != 1 and current.get("status") != "active":
        raise HTTPException(status_code=500, detail="Gutscheinverkauf benötigt Abstimmung")

    sale.pop("_id", None)
    return {
        "ok": True,
        "voucher": {
            "code": voucher_code,
            "amount": round(float(req.amount), 2),
            "valid_until": valid_until.isoformat(),
            "qr_code": f"BIDBLITZ-VOUCHER:{voucher_code}",
        },
        "sale": sale,
        "message": "Gutschein erfolgreich verkauft",
        "replayed": False,
    }


@router.post("/redeem")
async def redeem_voucher(voucher_code: str, request: Request):
    """Gutschein genau einmal in das kanonische Wallet einlösen."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    code = voucher_code.strip().upper().replace("BIDBLITZ-VOUCHER:", "")

    voucher = await db.pos_vouchers.find_one({"voucher_code": code}, {"_id": 0})
    if not voucher:
        raise HTTPException(404, "Gutschein nicht gefunden")
    if datetime.now(timezone.utc) > datetime.fromisoformat(voucher["valid_until"]):
        raise HTTPException(400, "Gutschein ist abgelaufen")

    if voucher.get("status") == "redeemed" and voucher.get("redeemed_by") == user_id:
        return {
            "ok": True,
            "amount": float(voucher.get("amount") or 0),
            "new_wallet_balance": None,
            "message": "Gutschein bereits eingelöst",
            "replayed": True,
        }
    if voucher.get("status") not in {"active", "redeeming"} or voucher.get("redeemed"):
        raise HTTPException(400, "Gutschein bereits eingelöst oder inaktiv")
    if voucher.get("status") == "redeeming" and voucher.get("redeeming_by") != user_id:
        raise HTTPException(status_code=409, detail="Gutschein wird bereits verarbeitet")

    amount = round(float(voucher.get("balance") or 0), 2)
    if amount <= 0:
        raise HTTPException(status_code=409, detail="Gutschein hat kein verfügbares Guthaben")

    if voucher.get("status") == "active":
        claim = await db.pos_vouchers.update_one(
            {"voucher_code": code, "status": "active", "redeemed": False, "balance": voucher.get("balance")},
            {"$set": {
                "status": "redeeming",
                "redeeming_by": user_id,
                "redeeming_at": datetime.now(timezone.utc).isoformat(),
            }},
        )
        if claim.modified_count != 1:
            raise HTTPException(status_code=409, detail="Gutschein wird bereits verarbeitet")

    result = await credit_wallet(
        user_id=user_id,
        amount=amount,
        tx_type=TransactionType.VOUCHER_REDEMPTION,
        description=f"Gutschein {code} eingelöst",
        reference=f"VOUCHER-{code}",
        metadata={"voucher_code": code},
        idempotency_key=f"pos-voucher-redeem:{code}",
    )
    if not result.success:
        state = str(getattr(result.status, "value", result.status))
        if state in {"pending", "reconciliation_required"}:
            await db.pos_vouchers.update_one(
                {"voucher_code": code, "status": "redeeming", "redeeming_by": user_id},
                {"$set": {
                    "status": "reconciliation_required",
                    "wallet_error": (result.error or "wallet_credit_pending")[:300],
                    "wallet_transaction_id": result.transaction_id,
                }},
            )
            raise HTTPException(status_code=409, detail="Gutschein-Gutschrift benötigt Abstimmung")
        await db.pos_vouchers.update_one(
            {"voucher_code": code, "status": "redeeming", "redeeming_by": user_id},
            {"$set": {"status": "active"}, "$unset": {"redeeming_by": "", "redeeming_at": ""}},
        )
        raise HTTPException(status_code=400, detail=result.error or "Gutschein-Gutschrift fehlgeschlagen")

    finalized = await db.pos_vouchers.update_one(
        {"voucher_code": code, "status": "redeeming", "redeeming_by": user_id},
        {"$set": {
            "redeemed": True,
            "redeemed_at": datetime.now(timezone.utc).isoformat(),
            "redeemed_by": user_id,
            "status": "redeemed",
            "balance": 0.0,
            "wallet_transaction_id": result.transaction_id,
        }, "$unset": {"redeeming_by": "", "redeeming_at": "", "wallet_error": ""}},
    )
    if finalized.modified_count != 1:
        current = await db.pos_vouchers.find_one({"voucher_code": code}, {"_id": 0}) or {}
        if current.get("status") != "redeemed":
            await db.pos_vouchers.update_one(
                {"voucher_code": code},
                {"$set": {
                    "status": "reconciliation_required",
                    "wallet_transaction_id": result.transaction_id,
                }},
            )
            raise HTTPException(status_code=500, detail="Wallet wurde gutgeschrieben; Gutscheinstatus benötigt Abstimmung")

    return {
        "ok": True,
        "amount": amount,
        "new_wallet_balance": result.new_balance,
        "message": f"€{amount:.2f} zu deinem Wallet hinzugefügt!",
        "replayed": bool(result.idempotent_replay),
    }


@router.post("/redeem-as-payment")
async def redeem_voucher_as_payment(req: VoucherRedeemPayRequest, request: Request):
    """Legacy voucher-as-payment preview until canonical cart settlement is implemented."""
    user = await get_current_user(request)
    if not TEST_MODE:
        raise HTTPException(
            status_code=503,
            detail="Gutschein-Zahlung am Cart ist in Production bis zum kanonischen Settlement deaktiviert.",
        )
    code = req.voucher_code.strip().upper().replace("BIDBLITZ-VOUCHER:", "")

    voucher = await db.pos_vouchers.find_one({"voucher_code": code}, {"_id": 0})
    if not voucher:
        raise HTTPException(404, "Gutschein nicht gefunden")
    if voucher["status"] != "active" or voucher["redeemed"]:
        raise HTTPException(400, "Gutschein nicht einlösbar")
    if datetime.now(timezone.utc) > datetime.fromisoformat(voucher["valid_until"]):
        raise HTTPException(400, "Gutschein abgelaufen")

    cart = await db.pos_carts.find_one({"cart_id": req.cart_id})
    if not cart or cart.get("status") != "open":
        raise HTTPException(400, "Cart nicht offen")
    actor = await get_actor_context(user, cart["store_id"], cart.get("register_id", ""))
    require_permission(actor, "payment.collect")

    cart_total = float(cart["total"])
    voucher_balance = float(voucher["balance"])
    applied = min(cart_total, voucher_balance)
    remaining_voucher = voucher_balance - applied
    remaining_cart = cart_total - applied

    now = datetime.now(timezone.utc).isoformat()

    voucher_update = (
        {"$set": {
            "redeemed": True,
            "redeemed_at": now,
            "redeemed_by": str(user["_id"]),
            "status": "redeemed",
            "balance": 0.0,
        }}
        if remaining_voucher <= 0
        else {"$set": {"balance": round(remaining_voucher, 2), "last_used_at": now}}
    )
    consumed = await db.pos_vouchers.update_one(
        {
            "voucher_code": code,
            "status": "active",
            "redeemed": False,
            "balance": voucher_balance,
        },
        voucher_update,
    )
    if consumed.modified_count != 1:
        raise HTTPException(status_code=409, detail="Gutschein wurde parallel verändert")

    return {
        "ok": True,
        "voucher_code": code,
        "applied": round(applied, 2),
        "remaining_voucher_balance": round(remaining_voucher, 2),
        "remaining_cart_amount": round(remaining_cart, 2),
        "message": f"€{applied:.2f} vom Gutschein verrechnet",
    }


# ═══════════════════════════════════════════════════════════
# WALLET-AUFLADUNG (POS)
# ═══════════════════════════════════════════════════════════

@router.post("/topup")
async def wallet_topup_at_pos(req: WalletTopUpRequest, request: Request):
    cashier = await get_current_user(request)
    actor = await get_actor_context(cashier, req.store_id, req.register_id)
    require_permission(actor, "wallet.topup")
    if req.amount <= 0 or req.amount > 5000:
        raise HTTPException(400, "Aufladebetrag muss zwischen €0.01 und €5000 liegen")
    customer = await get_resolution_customer(actor, req.resolution_id, req.customer_user_number)
    limits = await get_effective_limits(actor["merchant_id"], actor["store_id"], actor["user_id"], actor["role"])
    policy = evaluate_transaction_limits(actor, "topup", req.amount, limits)
    await audit_pos_security_event("pos_topup_attempt", request=request, user_id=actor["user_id"], email=cashier.get("email", ""), details={"amount": req.amount, "customer_number": customer.get("user_number", ""), "store_id": req.store_id, "register_id": req.register_id, "payment_method": req.payment_method}, severity="info")
    if policy["hard_limit"] and req.amount > policy["hard_limit"]:
        raise HTTPException(403, "Top-up überschreitet das zulässige Limit")
    if policy["needs_approval"]:
        approval = await request_manager_approval(actor, "wallet_topup", req.amount, {"store_id": req.store_id, "register_id": req.register_id, "customer_id": str(customer["_id"]), "payment_method": req.payment_method}, "Large top-up requires manager approval")
        return {"ok": True, "status": "approval_required", "approval": approval, "customer": build_customer_public_view(customer), "message": "Top-up wartet auf Manager-Freigabe"}
    if req.amount >= 300:
        await create_security_alert(actor["merchant_id"], actor["store_id"], "unusual_topup", "Ungewöhnlich hoher POS-Top-up erkannt", {"customer_number": customer.get("user_number", ""), "amount": req.amount}, "medium", actor["user_id"], str(customer["_id"]))
    return await execute_secure_topup(actor, customer, req.amount, req.payment_method, request=request)


@router.post("/resolve-customer")
async def resolve_wallet_topup_customer(req: CustomerResolveRequest, request: Request):
    cashier = await get_current_user(request)
    actor = await get_actor_context(cashier, req.store_id, req.register_id)
    require_permission(actor, "customer.resolve")
    await audit_pos_security_event("pos_customer_lookup_attempt", request=request, user_id=actor["user_id"], email=cashier.get("email", ""), details={"lookup_type": req.lookup_type, "store_id": req.store_id, "register_id": req.register_id}, severity="info")
    try:
        from services.pos_security import resolve_customer_by_lookup, create_resolution_session, reset_lookup_failures, register_failed_lookup
        customer = await resolve_customer_by_lookup(req.lookup_type, req.value)
    except HTTPException:
        from services.pos_security import register_failed_lookup
        await register_failed_lookup(actor, request, req.lookup_type, req.value)
        await audit_pos_security_event("pos_customer_lookup_failed", request=request, user_id=actor["user_id"], email=cashier.get("email", ""), details={"lookup_type": req.lookup_type, "store_id": req.store_id, "register_id": req.register_id}, severity="warning")
        raise
    from services.pos_security import create_resolution_session, reset_lookup_failures
    await reset_lookup_failures(actor)
    resolution = await create_resolution_session(actor, customer, req.lookup_type)
    await audit_pos_security_event("pos_customer_lookup_success", request=request, user_id=actor["user_id"], email=cashier.get("email", ""), details={"lookup_type": req.lookup_type, "customer_number": customer.get("user_number", ""), "resolution_id": resolution["resolution_id"]}, severity="info")
    return {"ok": True, "resolution_id": resolution["resolution_id"], "expires_at": resolution["expires_at"], "customer": build_customer_public_view(customer, req.lookup_type)}


@router.get("/check/{code}")
async def check_voucher(code: str):
    """Gutschein-Status prüfen (ohne einzulösen)."""
    voucher = await db.pos_vouchers.find_one({"voucher_code": code.upper()}, {"_id": 0})
    if not voucher:
        raise HTTPException(404, "Gutschein nicht gefunden")

    valid = (
        voucher["status"] == "active" and
        not voucher["redeemed"] and
        datetime.now(timezone.utc) < datetime.fromisoformat(voucher["valid_until"])
    )
    return {
        "code": code.upper(),
        "amount": voucher["amount"],
        "balance": voucher["balance"],
        "valid": valid,
        "status": voucher["status"],
        "valid_until": voucher["valid_until"],
        "redeemed": voucher["redeemed"],
    }


@router.get("/sales/today")
async def voucher_sales_today(store_id: str, request: Request):
    """Heutige Gutschein-Verkäufe & Aufladungen."""
    user = await get_current_user(request)
    actor = await get_actor_context(user, store_id, "")
    require_permission(actor, "reports.view")
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)

    voucher_count = await db.pos_sales.count_documents({
        "store_id": store_id, "type": "voucher_sale",
        "created_at": {"$gte": today_start.isoformat()},
    })
    topup_count = await db.pos_sales.count_documents({
        "store_id": store_id, "type": "wallet_topup",
        "created_at": {"$gte": today_start.isoformat()},
    })

    voucher_total = await db.pos_sales.aggregate([
        {"$match": {"store_id": store_id, "type": "voucher_sale", "created_at": {"$gte": today_start.isoformat()}}},
        {"$group": {"_id": None, "total": {"$sum": "$total"}}},
    ]).to_list(1)
    topup_total = await db.pos_sales.aggregate([
        {"$match": {"store_id": store_id, "type": "wallet_topup", "created_at": {"$gte": today_start.isoformat()}}},
        {"$group": {"_id": None, "total": {"$sum": "$total"}}},
    ]).to_list(1)

    return {
        "store_id": store_id,
        "date": today_start.date().isoformat(),
        "vouchers": {"count": voucher_count, "total": voucher_total[0]["total"] if voucher_total else 0.0},
        "topups": {"count": topup_count, "total": topup_total[0]["total"] if topup_total else 0.0},
    }
