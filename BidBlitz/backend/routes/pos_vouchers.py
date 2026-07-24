"""
BidBlitz POS - Gutschein & Karten-Aufladung System
Ermöglicht Verkauf von Gutscheinen und Wallet-Aufladungen am POS
"""

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone, timedelta
import secrets
from core.database import db
from core.security import get_current_user
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
    amount: float
    payment_method: str = "cash"
    recipient_email: Optional[str] = None
    message: Optional[str] = None


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
    """Verkaufe einen Gutschein am POS."""
    user = await get_current_user(request)

    if req.amount <= 0 or req.amount > 2000:
        raise HTTPException(400, "Gutschein-Betrag muss zwischen €0.01 und €2000 liegen")

    voucher_code = f"GS-{secrets.token_hex(6).upper()}"
    now = datetime.now(timezone.utc)
    valid_until = now + timedelta(days=365)

    voucher = {
        "voucher_code": voucher_code,
        "type": "gift_card",
        "amount": req.amount,
        "balance": req.amount,
        "currency": "EUR",
        "status": "active",
        "sold_at": now.isoformat(),
        "sold_by_user_id": str(user["_id"]),
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

    await db.pos_vouchers.insert_one(voucher)

    sale = {
        "sale_id": f"SALE-{secrets.token_hex(6).upper()}",
        "receipt_id": f"GS-{secrets.token_hex(4).upper()}",
        "store_id": req.store_id,
        "register_id": req.register_id,
        "cashier_user_id": str(user["_id"]),
        "type": "voucher_sale",
        "items": [{
            "product_id": "VOUCHER",
            "name": f"BidBlitz Gutschein €{req.amount:.2f}",
            "quantity": 1,
            "price": req.amount,
            "tax_rate": 0.0,
        }],
        "subtotal": req.amount,
        "tax_total": 0.0,
        "discount": 0.0,
        "total": req.amount,
        "method": req.payment_method,
        "status": "completed",
        "created_at": now.isoformat(),
    }

    await db.pos_sales.insert_one(sale)
    sale.pop("_id", None)

    return {
        "ok": True,
        "voucher": {
            "code": voucher_code,
            "amount": req.amount,
            "valid_until": valid_until.isoformat(),
            "qr_code": f"BIDBLITZ-VOUCHER:{voucher_code}",
        },
        "sale": sale,
        "message": "Gutschein erfolgreich verkauft",
    }


@router.post("/redeem")
async def redeem_voucher(voucher_code: str, request: Request):
    """Gutschein einlösen → Guthaben ins Wallet."""
    user = await get_current_user(request)

    voucher = await db.pos_vouchers.find_one({"voucher_code": voucher_code.upper()}, {"_id": 0})
    if not voucher:
        raise HTTPException(404, "Gutschein nicht gefunden")
    if voucher["status"] != "active" or voucher["redeemed"]:
        raise HTTPException(400, "Gutschein bereits eingelöst oder inaktiv")

    valid_until = datetime.fromisoformat(voucher["valid_until"])
    if datetime.now(timezone.utc) > valid_until:
        raise HTTPException(400, "Gutschein ist abgelaufen")

    user_id = str(user["_id"])
    result = await credit_wallet(
        user_id=user_id,
        amount=voucher["balance"],
        tx_type=TransactionType.VOUCHER_REDEMPTION,
        description=f"Gutschein {voucher_code} eingelöst",
        metadata={"voucher_code": voucher_code},
    )

    await db.pos_vouchers.update_one(
        {"voucher_code": voucher_code.upper()},
        {"$set": {
            "redeemed": True,
            "redeemed_at": datetime.now(timezone.utc).isoformat(),
            "redeemed_by": user_id,
            "status": "redeemed",
            "balance": 0.0,
        }},
    )

    return {
        "ok": True,
        "amount": voucher["balance"],
        "new_wallet_balance": result.new_balance if result.success else None,
        "message": f"€{voucher['balance']:.2f} zu deinem Wallet hinzugefügt!",
    }


@router.post("/redeem-as-payment")
async def redeem_voucher_as_payment(req: VoucherRedeemPayRequest, request: Request):
    """
    Gutschein direkt am POS als Zahlung verwenden (ohne Wallet-Umweg).
    Wertet den Gutschein gegen einen offenen Cart aus.
    """
    user = await get_current_user(request)
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

    cart_total = float(cart["total"])
    voucher_balance = float(voucher["balance"])
    applied = min(cart_total, voucher_balance)
    remaining_voucher = voucher_balance - applied
    remaining_cart = cart_total - applied

    now = datetime.now(timezone.utc).isoformat()

    if remaining_voucher <= 0:
        await db.pos_vouchers.update_one(
            {"voucher_code": code},
            {"$set": {"redeemed": True, "redeemed_at": now, "redeemed_by": str(user["_id"]),
                      "status": "redeemed", "balance": 0.0}},
        )
    else:
        await db.pos_vouchers.update_one(
            {"voucher_code": code},
            {"$set": {"balance": round(remaining_voucher, 2), "last_used_at": now}},
        )

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
    await get_current_user(request)
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
