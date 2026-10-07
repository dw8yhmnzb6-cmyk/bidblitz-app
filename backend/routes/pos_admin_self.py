"""
BidBlitz POS Admin Audit Search + Self-Checkout Module
- Global audit-log search with filters (admin only)
- Self-checkout: customer scans own items via /api/pos/self/* endpoints
"""

import secrets
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from bson import ObjectId

from core.database import db
from core.security import get_current_user
from routes.pos_system import (
    _is_admin, _audit, short_id, now_iso, DEFAULT_MERCHANT_FEE,
    PAYMENT_STATUS_PENDING, PAYMENT_STATUS_PAID, PAYMENT_QR_TTL_SECONDS,
    _settle_wallet_payment,
)

router = APIRouter(prefix="/api/pos", tags=["POS Admin & Self-Checkout"])


# ───────────────────────────────────────────────────────────────────────
# 1. ADMIN AUDIT-LOG SEARCH
# ───────────────────────────────────────────────────────────────────────
@router.get("/admin/audit-search")
async def admin_audit_search(
    request: Request,
    q: Optional[str] = None,             # text in action or actor
    action: Optional[str] = None,        # exact action match
    actor_id: Optional[str] = None,
    merchant_id: Optional[str] = None,
    store_id: Optional[str] = None,
    days: int = 30,
    limit: int = 200,
):
    user = await get_current_user(request)
    if not await _is_admin(user):
        raise HTTPException(status_code=403, detail="Nur Admin")

    since = (datetime.now(timezone.utc) - timedelta(days=max(1, days))).isoformat()
    query: Dict[str, Any] = {"ts": {"$gte": since}}

    if action:
        query["action"] = action
    if actor_id:
        query["actor_id"] = actor_id
    if merchant_id:
        query["ref.merchant_id"] = merchant_id
    if store_id:
        query["ref.store_id"] = store_id
    if q:
        query["$or"] = [
            {"action": {"$regex": q, "$options": "i"}},
            {"actor_id": q},
        ]

    items = await db.pos_audit_log.find(query, {"_id": 0}).sort("ts", -1).limit(limit).to_list(limit)

    # Aggregate top actions
    pipeline = [
        {"$match": query},
        {"$group": {"_id": "$action", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 20},
    ]
    actions = []
    async for row in db.pos_audit_log.aggregate(pipeline):
        actions.append({"action": row["_id"], "count": row["count"]})

    return {"log": items, "count": len(items), "top_actions": actions, "days": days}


@router.get("/admin/audit-actions")
async def list_audit_actions(request: Request):
    """Distinct actions across all audit log (for filter dropdown)."""
    user = await get_current_user(request)
    if not await _is_admin(user):
        raise HTTPException(status_code=403, detail="Nur Admin")
    actions = await db.pos_audit_log.distinct("action")
    return {"actions": sorted(actions)}


# ───────────────────────────────────────────────────────────────────────
# 2. SELF-CHECKOUT  (Customer scans own items, pays via wallet)
# ───────────────────────────────────────────────────────────────────────
class SelfCartCreate(BaseModel):
    store_id: str
    items: List[Dict[str, Any]]   # [{barcode, quantity}] or [{product_id, quantity}]


class SelfCheckoutPay(BaseModel):
    cart_id: str


@router.get("/self/store/{store_id}")
async def get_self_store_info(store_id: str):
    """Public store info for self-checkout landing page (no auth)."""
    store = await db.pos_stores.find_one(
        {"store_id": store_id, "status": "active"}, {"_id": 0}
    )
    if not store:
        raise HTTPException(status_code=404, detail="Filiale nicht gefunden")
    merchant = await db.pos_merchants.find_one(
        {"merchant_id": store["merchant_id"]},
        {"_id": 0, "business_name": 1, "status": 1},
    )
    if not merchant or merchant.get("status") != "approved":
        raise HTTPException(status_code=403, detail="Self-Checkout für diese Filiale nicht aktiv")
    return {
        "store_id": store_id,
        "store_name": store["name"],
        "city": store.get("city", ""),
        "merchant_name": merchant["business_name"],
    }


@router.get("/self/scan/{store_id}/{barcode}")
async def self_scan(store_id: str, barcode: str, request: Request):
    """Customer scans a barcode (auth required)."""
    user = await get_current_user(request)  # noqa: F841 — ensures customer is logged in
    p = await db.pos_products.find_one(
        {"store_id": store_id, "barcode": barcode, "active": True}, {"_id": 0}
    )
    if not p:
        raise HTTPException(status_code=404, detail="Artikel nicht gefunden")
    return {
        "product_id": p["product_id"],
        "name": p["name"],
        "price": p["price"],
        "tax_rate": p["tax_rate"],
        "barcode": p.get("barcode"),
        "image_url": p.get("image_url"),
        "unit": p.get("unit", "Stk"),
        "stock_ok": (not p.get("track_stock")) or float(p.get("stock", 0)) > 0,
    }


@router.post("/self/cart/create")
async def self_cart_create(req: SelfCartCreate, request: Request):
    """Create a self-checkout cart on behalf of the customer."""
    user = await get_current_user(request)
    user_id = str(user["_id"])

    store = await db.pos_stores.find_one({"store_id": req.store_id})
    if not store:
        raise HTTPException(status_code=404, detail="Filiale nicht gefunden")

    merchant = await db.pos_merchants.find_one({"merchant_id": store["merchant_id"]})
    if not merchant or merchant.get("status") != "approved":
        raise HTTPException(status_code=403, detail="Self-Checkout nicht aktiv")

    # Resolve products
    resolved = []
    subtotal = 0.0
    tax_total = 0.0

    for it in req.items:
        product = None
        if it.get("product_id"):
            product = await db.pos_products.find_one({"product_id": it["product_id"], "active": True})
        elif it.get("barcode"):
            product = await db.pos_products.find_one(
                {"store_id": req.store_id, "barcode": it["barcode"], "active": True}
            )
        if not product:
            raise HTTPException(status_code=400, detail=f"Artikel {it.get('barcode') or it.get('product_id')} nicht gefunden")

        qty = float(it.get("quantity", 1) or 1)
        if product.get("track_stock") and float(product.get("stock", 0)) < qty:
            raise HTTPException(
                status_code=400,
                detail=f"Bestand zu niedrig: {product['name']}",
            )

        line_total = round(product["price"] * qty, 2)
        tax_rate = float(product.get("tax_rate", 0.19))
        line_tax = round(line_total - line_total / (1 + tax_rate), 2)

        resolved.append({
            "product_id": product["product_id"],
            "name": product["name"],
            "unit_price": product["price"],
            "quantity": qty,
            "tax_rate": tax_rate,
            "discount": 0,
            "line_net": round(line_total - line_tax, 2),
            "line_tax": line_tax,
            "line_total": line_total,
            "barcode": product.get("barcode"),
        })
        subtotal += line_total
        tax_total += line_tax

    cart_id = short_id("SCT", 10)   # Self-checkout cart prefix
    doc = {
        "cart_id": cart_id,
        "store_id": req.store_id,
        "merchant_id": store["merchant_id"],
        "register_id": "SELF",
        "shift_id": "SELF",
        "cashier_id": user_id,           # self
        "customer_id": user_id,
        "items": resolved,
        "subtotal": round(subtotal, 2),
        "net_total": round(subtotal - tax_total, 2),
        "tax_total": round(tax_total, 2),
        "cart_discount_pct": 0,
        "cart_discount": 0,
        "total": round(subtotal, 2),
        "status": "open",
        "self_checkout": True,
        "created_at": now_iso(),
    }
    await db.pos_carts.insert_one(doc)
    doc.pop("_id", None)
    return {"ok": True, "cart": doc}


@router.post("/self/pay")
async def self_pay(req: SelfCheckoutPay, request: Request):
    """Customer pays a self-checkout cart through the canonical wallet settlement."""
    user = await get_current_user(request)
    user_id = str(user["_id"])

    cart = await db.pos_carts.find_one({"cart_id": req.cart_id})
    if not cart:
        raise HTTPException(status_code=404, detail="Cart nicht gefunden")
    if cart.get("customer_id") != user_id:
        raise HTTPException(status_code=403, detail="Nicht dein Cart")

    payment_id = f"SELF-{cart['cart_id']}"
    if cart.get("status") != "open":
        existing_payment = await db.pos_payments.find_one(
            {"payment_id": payment_id, "status": PAYMENT_STATUS_PAID},
            {"_id": 0},
        )
        existing_sale = await db.pos_sales.find_one({"payment_id": payment_id}, {"_id": 0})
        if existing_payment and existing_sale:
            return {"ok": True, "payment": existing_payment, "sale": existing_sale, "replayed": True}
        raise HTTPException(status_code=400, detail=f"Cart bereits {cart.get('status')}")

    merchant = await db.pos_merchants.find_one({"merchant_id": cart["merchant_id"]})
    if not merchant or merchant.get("status") != "approved":
        raise HTTPException(status_code=403, detail="Self-Checkout nicht aktiv")

    fee_rate = float(merchant.get("fee_rate", DEFAULT_MERCHANT_FEE))
    total = round(float(cart["total"]), 2)
    now = datetime.now(timezone.utc)
    payment_doc = {
        "payment_id": payment_id,
        "cart_id": cart["cart_id"],
        "register_id": "SELF",
        "store_id": cart["store_id"],
        "merchant_id": cart["merchant_id"],
        "amount": total,
        "fee_rate": fee_rate,
        "method": "self_checkout",
        "status": PAYMENT_STATUS_PENDING,
        "expires_at": (now + timedelta(seconds=PAYMENT_QR_TTL_SECONDS)).isoformat(),
        "created_at": now.isoformat(),
        "qr_code": None,
        "barcode": payment_id,
        "customer_id": user_id,
        "self_checkout": True,
    }
    await db.pos_payments.update_one(
        {"payment_id": payment_id},
        {"$setOnInsert": payment_doc},
        upsert=True,
    )
    payment = await db.pos_payments.find_one({"payment_id": payment_id}, {"_id": 0}) or payment_doc

    if payment.get("status") == PAYMENT_STATUS_PAID:
        sale = await db.pos_sales.find_one({"payment_id": payment_id}, {"_id": 0})
        if sale:
            return {"ok": True, "payment": payment, "sale": sale, "replayed": True}

    if payment.get("status") != PAYMENT_STATUS_PENDING:
        raise HTTPException(status_code=409, detail=f"Zahlung ist im Status {payment.get('status')}")

    result = await _settle_wallet_payment(payment, cart, user, fee_rate)
    await _audit(user_id, "self_checkout.paid", {"payment_id": payment_id, "store_id": cart["store_id"], "amount": total})
    return {**result, "replayed": False}
