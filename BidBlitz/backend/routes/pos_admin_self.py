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
    PAYMENT_STATUS_PENDING, PAYMENT_QR_TTL_SECONDS,
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
    """Customer pays their self-checkout cart from their own wallet."""
    user = await get_current_user(request)
    user_id = str(user["_id"])

    cart = await db.pos_carts.find_one({"cart_id": req.cart_id})
    if not cart:
        raise HTTPException(status_code=404, detail="Cart nicht gefunden")
    if cart["status"] != "open":
        raise HTTPException(status_code=400, detail=f"Cart bereits {cart['status']}")
    if cart.get("customer_id") != user_id:
        raise HTTPException(status_code=403, detail="Nicht dein Cart")

    merchant = await db.pos_merchants.find_one({"merchant_id": cart["merchant_id"]})
    if not merchant or merchant.get("status") != "approved":
        raise HTTPException(status_code=403, detail="Self-Checkout nicht aktiv")

    fee_rate = float(merchant.get("fee_rate", DEFAULT_MERCHANT_FEE))
    total = float(cart["total"])
    payment_id = short_id("PAY", 12)
    now = datetime.now(timezone.utc)

    # Create payment doc
    payment = {
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
    await db.pos_payments.insert_one(payment)
    payment.pop("_id", None)

    # Atomic wallet debit + merchant credit (mirror pos_system._settle_wallet_payment)
    from core.payment_engine import debit_wallet, TransactionType
    debit = await debit_wallet(
        user_id=user_id,
        amount=total,
        tx_type=TransactionType.MERCHANT_PAYMENT,
        description=f"Self-Checkout — {cart['store_id']}",
        reference=payment_id,
        metadata={"payment_id": payment_id, "store_id": cart["store_id"], "self": True},
    )
    if not debit.success:
        await db.pos_payments.update_one(
            {"payment_id": payment_id}, {"$set": {"status": "cancelled", "error": debit.error}}
        )
        raise HTTPException(status_code=400, detail=debit.error)

    fee = round(total * fee_rate, 2)
    net = round(total - fee, 2)
    await db.users.update_one(
        {"_id": ObjectId(merchant["owner_id"])}, {"$inc": {"balance": net}}
    )
    await db.pos_merchants.update_one(
        {"merchant_id": cart["merchant_id"]},
        {"$inc": {"settlement_balance": net, "lifetime_volume": total}},
    )

    paid_at = now_iso()
    await db.pos_payments.update_one(
        {"payment_id": payment_id},
        {"$set": {
            "status": "paid",
            "paid_at": paid_at,
            "fee_amount": fee,
            "net_to_merchant": net,
        }},
    )
    payment["status"] = "paid"
    payment["paid_at"] = paid_at

    # Build sale + decrement stock + record movements (same as cashier flow)
    receipt_id = short_id("RCP", 10)
    sale = {
        "sale_id": short_id("SAL", 10),
        "receipt_id": receipt_id,
        "payment_id": payment_id,
        "cart_id": cart["cart_id"],
        "register_id": "SELF",
        "store_id": cart["store_id"],
        "merchant_id": cart["merchant_id"],
        "shift_id": "SELF",
        "cashier_id": user_id,
        "customer_id": user_id,
        "items": cart["items"],
        "subtotal": cart["subtotal"],
        "net_total": cart["net_total"],
        "tax_total": cart["tax_total"],
        "discount": 0,
        "total": cart["total"],
        "method": "self_checkout",
        "fee": fee,
        "merchant_received": net,
        "customer_paid": total,
        "change": 0,
        "self_checkout": True,
        "created_at": now_iso(),
        "status": "completed",
    }
    await db.pos_sales.insert_one(sale)
    sale.pop("_id", None)

    # Stock decrement + movement
    for it in cart["items"]:
        if it.get("product_id"):
            product = await db.pos_products.find_one({"product_id": it["product_id"]})
            if not product or not product.get("track_stock"):
                continue
            before = float(product.get("stock", 0))
            after = round(before - float(it["quantity"]), 3)
            await db.pos_products.update_one(
                {"product_id": it["product_id"]},
                {"$set": {"stock": after, "updated_at": now_iso()}},
            )
            await db.pos_stock_movements.insert_one({
                "movement_id": short_id("MOV", 10),
                "product_id": product["product_id"],
                "product_name": product["name"],
                "barcode": product.get("barcode"),
                "merchant_id": cart["merchant_id"],
                "store_id": cart["store_id"],
                "type": "sale",
                "quantity": -float(it["quantity"]),
                "before_stock": before,
                "after_stock": after,
                "reference_id": sale["sale_id"],
                "created_by": user_id,
                "note": f"Self-Checkout {receipt_id}",
                "created_at": now_iso(),
            })

    await db.pos_carts.update_one(
        {"cart_id": cart["cart_id"]}, {"$set": {"status": "paid"}}
    )
    await _audit(user_id, "self_checkout.paid", {"payment_id": payment_id, "store_id": cart["store_id"], "amount": total})
    return {"ok": True, "payment": payment, "sale": sale}
