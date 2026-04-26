"""
BidBlitz V2 — POS Inventory / Warenwirtschaft Extension
Suppliers, Purchase Orders, Stock Movements, NFC Sessions, Reports.
Built on top of /app/backend/routes/pos_system.py.
"""

import secrets
import logging
import io
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from core.database import db
from core.security import get_current_user
from core.payment_engine import debit_wallet, credit_wallet, TransactionType
from bson import ObjectId

# Re-use shared helpers from the main POS module
from routes.pos_system import (
    _require_merchant, _require_store_access, _is_admin, _audit,
    short_id, now_iso, DEFAULT_MERCHANT_FEE,
    PAYMENT_STATUS_PENDING, PAYMENT_STATUS_PAID, PAYMENT_STATUS_EXPIRED,
)

router = APIRouter(prefix="/api/pos", tags=["POS Inventory"])
logger = logging.getLogger("bidblitz.pos.inv")

NFC_SESSION_TTL = 60       # seconds; NFC tap should be near-instant


# ───────────────────────────────────────────────────────────────────────
# Stock movement helper
# ───────────────────────────────────────────────────────────────────────
async def _record_movement(*, product, store_id, merchant_id, type_,
                           qty: float, before: float, after: float,
                           reference_id: str | None, actor_id: str,
                           note: str = ""):
    await db.pos_stock_movements.insert_one({
        "movement_id": short_id("MOV", 10),
        "product_id": product["product_id"],
        "product_name": product["name"],
        "barcode": product.get("barcode"),
        "merchant_id": merchant_id,
        "store_id": store_id,
        "type": type_,
        "quantity": qty,
        "before_stock": before,
        "after_stock": after,
        "reference_id": reference_id,
        "created_by": actor_id,
        "note": note,
        "created_at": now_iso(),
    })


# ───────────────────────────────────────────────────────────────────────
# 1. STOCK ADJUSTMENTS  (manual)
# ───────────────────────────────────────────────────────────────────────
class StockAdjust(BaseModel):
    product_id: str
    delta: float                       # signed (negative = take out, positive = add)
    reason: str = "adjustment"        # adjustment | damage | recount | transfer | return
    note: Optional[str] = ""


@router.post("/products/{product_id}/stock-adjust")
async def adjust_stock(product_id: str, req: StockAdjust, request: Request):
    user = await get_current_user(request)
    product = await db.pos_products.find_one({"product_id": product_id})
    if not product:
        raise HTTPException(status_code=404, detail="Produkt nicht gefunden")
    await _require_store_access(user, product["store_id"], {"merchant_admin", "store_manager"})

    before = float(product.get("stock", 0))
    after = round(before + float(req.delta), 3)
    if after < 0 and not product.get("allow_negative_stock"):
        raise HTTPException(status_code=400, detail=f"Bestand würde negativ ({after})")

    await db.pos_products.update_one(
        {"product_id": product_id},
        {"$set": {"stock": after, "updated_at": now_iso()}},
    )
    await _record_movement(
        product=product, store_id=product["store_id"], merchant_id=product["merchant_id"],
        type_=req.reason if req.reason in {"adjustment", "damage", "recount", "transfer", "return"} else "adjustment",
        qty=req.delta, before=before, after=after,
        reference_id=None, actor_id=str(user["_id"]), note=req.note or "",
    )

    # Low stock check
    low = product.get("minimum_stock") and after <= float(product["minimum_stock"])
    return {"ok": True, "before": before, "after": after, "low_stock": bool(low)}


@router.get("/stock/movements")
async def list_stock_movements(request: Request, store_id: Optional[str] = None,
                               product_id: Optional[str] = None, limit: int = 100):
    user = await get_current_user(request)
    merchant = await _require_merchant(user)
    q: Dict[str, Any] = {"merchant_id": merchant["merchant_id"]}
    if store_id:
        q["store_id"] = store_id
    if product_id:
        q["product_id"] = product_id
    items = await db.pos_stock_movements.find(q, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    return {"movements": items, "count": len(items)}


@router.get("/stock/low")
async def low_stock_alert(request: Request, store_id: Optional[str] = None):
    """Products at or below minimum_stock."""
    user = await get_current_user(request)
    merchant = await _require_merchant(user)
    q = {
        "merchant_id": merchant["merchant_id"],
        "active": True,
        "track_stock": True,
        "minimum_stock": {"$gt": 0},
    }
    if store_id:
        q["store_id"] = store_id
    candidates = await db.pos_products.find(q, {"_id": 0}).to_list(1000)
    low = [p for p in candidates if float(p.get("stock", 0)) <= float(p.get("minimum_stock", 0))]
    return {"products": low, "count": len(low)}


@router.get("/products/barcode/{barcode}")
async def find_by_barcode(barcode: str, request: Request, store_id: str):
    """Public-style barcode lookup (still requires staff role for the store)."""
    user = await get_current_user(request)
    await _require_store_access(user, store_id)
    p = await db.pos_products.find_one(
        {"store_id": store_id, "barcode": barcode, "active": True}, {"_id": 0}
    )
    if not p:
        raise HTTPException(status_code=404, detail="Barcode nicht gefunden")
    p["low_stock"] = (
        bool(p.get("track_stock"))
        and float(p.get("minimum_stock", 0) or 0) > 0
        and float(p.get("stock", 0)) <= float(p.get("minimum_stock", 0))
    )
    return p


# ───────────────────────────────────────────────────────────────────────
# 2. SUPPLIERS
# ───────────────────────────────────────────────────────────────────────
class SupplierCreate(BaseModel):
    name: str
    contact_person: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    tax_number: Optional[str] = None
    notes: Optional[str] = None


class SupplierUpdate(BaseModel):
    name: Optional[str] = None
    contact_person: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    tax_number: Optional[str] = None
    notes: Optional[str] = None
    active: Optional[bool] = None


@router.post("/suppliers/create")
async def create_supplier(req: SupplierCreate, request: Request):
    user = await get_current_user(request)
    merchant = await _require_merchant(user)
    supplier_id = short_id("SUP", 10)
    doc = {
        "supplier_id": supplier_id,
        "merchant_id": merchant["merchant_id"],
        **req.dict(),
        "active": True,
        "created_at": now_iso(),
    }
    await db.pos_suppliers.insert_one(doc)
    doc.pop("_id", None)
    await _audit(str(user["_id"]), "supplier.create", {"supplier_id": supplier_id})
    return {"ok": True, "supplier": doc}


@router.get("/suppliers")
async def list_suppliers(request: Request):
    user = await get_current_user(request)
    merchant = await _require_merchant(user)
    items = await db.pos_suppliers.find(
        {"merchant_id": merchant["merchant_id"]}, {"_id": 0}
    ).sort("name", 1).to_list(500)
    return {"suppliers": items}


@router.put("/suppliers/{supplier_id}")
async def update_supplier(supplier_id: str, req: SupplierUpdate, request: Request):
    user = await get_current_user(request)
    merchant = await _require_merchant(user)
    s = await db.pos_suppliers.find_one({"supplier_id": supplier_id})
    if not s or s["merchant_id"] != merchant["merchant_id"]:
        raise HTTPException(status_code=404, detail="Supplier nicht gefunden")
    upd = {k: v for k, v in req.dict().items() if v is not None}
    upd["updated_at"] = now_iso()
    await db.pos_suppliers.update_one({"supplier_id": supplier_id}, {"$set": upd})
    return {"ok": True}


@router.get("/suppliers/{supplier_id}/products")
async def supplier_products(supplier_id: str, request: Request):
    user = await get_current_user(request)
    merchant = await _require_merchant(user)
    items = await db.pos_products.find(
        {"merchant_id": merchant["merchant_id"], "supplier_id": supplier_id}, {"_id": 0}
    ).to_list(500)
    return {"products": items}


# ───────────────────────────────────────────────────────────────────────
# 3. PURCHASE ORDERS
# ───────────────────────────────────────────────────────────────────────
class PoLine(BaseModel):
    product_id: str
    quantity: float = Field(..., gt=0)
    purchase_price: float = Field(..., ge=0)


class PurchaseOrderCreate(BaseModel):
    supplier_id: str
    store_id: str
    items: List[PoLine]
    note: Optional[str] = ""


@router.post("/purchase-orders/create")
async def create_purchase_order(req: PurchaseOrderCreate, request: Request):
    user = await get_current_user(request)
    merchant = await _require_merchant(user)
    await _require_store_access(user, req.store_id, {"merchant_admin", "store_manager"})

    supplier = await db.pos_suppliers.find_one({"supplier_id": req.supplier_id})
    if not supplier or supplier["merchant_id"] != merchant["merchant_id"]:
        raise HTTPException(status_code=404, detail="Supplier nicht gefunden")

    enriched = []
    total = 0.0
    for line in req.items:
        product = await db.pos_products.find_one({"product_id": line.product_id})
        if not product:
            raise HTTPException(status_code=400, detail=f"Produkt {line.product_id} fehlt")
        lt = round(line.quantity * line.purchase_price, 2)
        total += lt
        enriched.append({
            "product_id": line.product_id,
            "product_name": product["name"],
            "barcode": product.get("barcode"),
            "quantity": line.quantity,
            "purchase_price": line.purchase_price,
            "line_total": lt,
            "received": 0,
        })

    po_id = short_id("PO", 12)
    doc = {
        "po_id": po_id,
        "merchant_id": merchant["merchant_id"],
        "store_id": req.store_id,
        "supplier_id": req.supplier_id,
        "supplier_name": supplier["name"],
        "items": enriched,
        "total_cost": round(total, 2),
        "status": "draft",
        "note": req.note,
        "created_by": str(user["_id"]),
        "created_at": now_iso(),
    }
    await db.pos_purchase_orders.insert_one(doc)
    doc.pop("_id", None)
    await _audit(str(user["_id"]), "po.create", {"po_id": po_id})
    return {"ok": True, "purchase_order": doc}


@router.get("/purchase-orders")
async def list_purchase_orders(request: Request, status: Optional[str] = None):
    user = await get_current_user(request)
    merchant = await _require_merchant(user)
    q = {"merchant_id": merchant["merchant_id"]}
    if status:
        q["status"] = status
    items = await db.pos_purchase_orders.find(q, {"_id": 0}).sort("created_at", -1).to_list(500)
    return {"purchase_orders": items}


@router.post("/purchase-orders/{po_id}/order")
async def mark_po_ordered(po_id: str, request: Request):
    user = await get_current_user(request)
    merchant = await _require_merchant(user)
    po = await db.pos_purchase_orders.find_one({"po_id": po_id})
    if not po or po["merchant_id"] != merchant["merchant_id"]:
        raise HTTPException(status_code=404, detail="PO nicht gefunden")
    if po["status"] != "draft":
        raise HTTPException(status_code=400, detail="Nur Entwürfe können bestellt werden")
    await db.pos_purchase_orders.update_one(
        {"po_id": po_id}, {"$set": {"status": "ordered", "ordered_at": now_iso()}}
    )
    await _audit(str(user["_id"]), "po.order", {"po_id": po_id})
    return {"ok": True}


@router.post("/purchase-orders/{po_id}/receive")
async def receive_purchase_order(po_id: str, request: Request):
    """Mark PO received -> increment stock, write movements, update product purchase_price."""
    user = await get_current_user(request)
    merchant = await _require_merchant(user)
    po = await db.pos_purchase_orders.find_one({"po_id": po_id})
    if not po or po["merchant_id"] != merchant["merchant_id"]:
        raise HTTPException(status_code=404, detail="PO nicht gefunden")
    if po["status"] not in {"draft", "ordered"}:
        raise HTTPException(status_code=400, detail=f"PO Status {po['status']} — nicht empfangsfähig")

    for line in po["items"]:
        product = await db.pos_products.find_one({"product_id": line["product_id"]})
        if not product:
            continue
        before = float(product.get("stock", 0))
        after = round(before + float(line["quantity"]), 3)
        await db.pos_products.update_one(
            {"product_id": line["product_id"]},
            {"$set": {
                "stock": after,
                "purchase_price": line["purchase_price"],
                "supplier_id": po["supplier_id"],
                "updated_at": now_iso(),
            }},
        )
        await _record_movement(
            product=product, store_id=po["store_id"], merchant_id=merchant["merchant_id"],
            type_="purchase", qty=float(line["quantity"]),
            before=before, after=after,
            reference_id=po_id, actor_id=str(user["_id"]),
            note=f"PO {po_id}",
        )

    await db.pos_purchase_orders.update_one(
        {"po_id": po_id},
        {"$set": {
            "status": "received",
            "received_at": now_iso(),
            "received_by": str(user["_id"]),
        }},
    )
    await _audit(str(user["_id"]), "po.receive", {"po_id": po_id})
    return {"ok": True, "status": "received"}


@router.post("/purchase-orders/{po_id}/cancel")
async def cancel_po(po_id: str, request: Request):
    user = await get_current_user(request)
    merchant = await _require_merchant(user)
    po = await db.pos_purchase_orders.find_one({"po_id": po_id})
    if not po or po["merchant_id"] != merchant["merchant_id"]:
        raise HTTPException(status_code=404, detail="PO nicht gefunden")
    if po["status"] == "received":
        raise HTTPException(status_code=400, detail="Bereits empfangen")
    await db.pos_purchase_orders.update_one(
        {"po_id": po_id}, {"$set": {"status": "cancelled", "cancelled_at": now_iso()}}
    )
    return {"ok": True}


# ───────────────────────────────────────────────────────────────────────
# 4. NFC PAYMENT SESSIONS  (NFC-ready architecture)
# ───────────────────────────────────────────────────────────────────────
class NfcSessionCreate(BaseModel):
    register_id: str
    cart_id: Optional[str] = None
    amount: float = Field(..., gt=0)


class NfcSessionConfirm(BaseModel):
    session_id: str


@router.post("/nfc/session/create")
async def create_nfc_session(req: NfcSessionCreate, request: Request):
    user = await get_current_user(request)
    reg = await db.pos_registers.find_one({"register_id": req.register_id})
    if not reg:
        raise HTTPException(status_code=404, detail="Kasse nicht gefunden")
    await _require_store_access(user, reg["store_id"])

    sid = short_id("NFC", 14)
    now = datetime.now(timezone.utc)
    doc = {
        "session_id": sid,
        "merchant_id": reg["merchant_id"],
        "store_id": reg["store_id"],
        "register_id": req.register_id,
        "cart_id": req.cart_id,
        "amount": round(float(req.amount), 2),
        "status": PAYMENT_STATUS_PENDING,
        "created_by": str(user["_id"]),
        "user_id": None,
        "expires_at": (now + timedelta(seconds=NFC_SESSION_TTL)).isoformat(),
        "created_at": now.isoformat(),
        # NFC-ready: real hardware should write a one-shot token here
        "nfc_token_hash": None,
        "channel": "qr_fallback",
    }
    await db.pos_nfc_sessions.insert_one(doc)
    doc.pop("_id", None)
    return {"ok": True, "session": doc, "ttl_seconds": NFC_SESSION_TTL,
            "fallback_qr": f"BIDBLITZ-NFC:{sid}"}


@router.post("/nfc/session/confirm")
async def confirm_nfc_session(req: NfcSessionConfirm, request: Request):
    """
    Customer confirms (server-side) the NFC tap by calling this endpoint
    from the BidBlitz mobile app. No fake hardware confirmations are accepted.
    """
    user = await get_current_user(request)
    sess = await db.pos_nfc_sessions.find_one({"session_id": req.session_id})
    if not sess:
        raise HTTPException(status_code=404, detail="Session nicht gefunden")
    if sess["status"] != PAYMENT_STATUS_PENDING:
        raise HTTPException(status_code=400, detail=f"Status {sess['status']}")

    # Expiry check
    try:
        if datetime.fromisoformat(sess["expires_at"]) < datetime.now(timezone.utc):
            await db.pos_nfc_sessions.update_one(
                {"session_id": req.session_id}, {"$set": {"status": PAYMENT_STATUS_EXPIRED}}
            )
            raise HTTPException(status_code=400, detail="Session abgelaufen")
    except (KeyError, ValueError):
        pass

    amount = float(sess["amount"])
    # Atomic wallet debit (uses payment_engine)
    debit = await debit_wallet(
        user_id=str(user["_id"]),
        amount=amount,
        tx_type=TransactionType.MERCHANT_PAYMENT,
        description=f"NFC POS — {sess['register_id']}",
        reference=sess["session_id"],
        metadata={"session_id": sess["session_id"], "store_id": sess["store_id"]},
    )
    if not debit.success:
        await db.pos_nfc_sessions.update_one(
            {"session_id": req.session_id},
            {"$set": {"status": "failed", "error": debit.error}},
        )
        raise HTTPException(status_code=400, detail=debit.error)

    merchant = await db.pos_merchants.find_one({"merchant_id": sess["merchant_id"]})
    fee_rate = float(merchant.get("fee_rate", DEFAULT_MERCHANT_FEE)) if merchant else DEFAULT_MERCHANT_FEE
    fee = round(amount * fee_rate, 2)
    net = round(amount - fee, 2)
    if merchant:
        await db.users.update_one(
            {"_id": ObjectId(merchant["owner_id"])}, {"$inc": {"balance": net}}
        )
        await db.pos_merchants.update_one(
            {"merchant_id": sess["merchant_id"]},
            {"$inc": {"settlement_balance": net, "lifetime_volume": amount}},
        )

    await db.pos_nfc_sessions.update_one(
        {"session_id": req.session_id},
        {"$set": {
            "status": PAYMENT_STATUS_PAID,
            "user_id": str(user["_id"]),
            "fee": fee,
            "net_to_merchant": net,
            "confirmed_at": now_iso(),
        }},
    )
    await _audit(str(user["_id"]), "nfc.confirm", {"session_id": req.session_id, "amount": amount})

    return {
        "ok": True,
        "session_id": req.session_id,
        "amount": amount,
        "status": PAYMENT_STATUS_PAID,
        "merchant_received": net,
        "fee": fee,
    }


@router.get("/nfc/session/{session_id}")
async def get_nfc_session(session_id: str, request: Request):
    user = await get_current_user(request)
    sess = await db.pos_nfc_sessions.find_one({"session_id": session_id}, {"_id": 0})
    if not sess:
        raise HTTPException(status_code=404, detail="Session nicht gefunden")
    if sess.get("user_id") != str(user["_id"]):
        await _require_store_access(user, sess["store_id"])
    return sess


# ───────────────────────────────────────────────────────────────────────
# 5. REPORTS
# ───────────────────────────────────────────────────────────────────────
def _period_start(period: str) -> datetime:
    now = datetime.now(timezone.utc)
    if period == "today":
        return now.replace(hour=0, minute=0, second=0, microsecond=0)
    if period == "7d":
        return now - timedelta(days=7)
    if period == "30d":
        return now - timedelta(days=30)
    if period == "90d":
        return now - timedelta(days=90)
    return now - timedelta(days=365)


@router.get("/reports/sales")
async def report_sales(request: Request, period: str = "30d"):
    user = await get_current_user(request)
    merchant = await _require_merchant(user)
    start = _period_start(period).isoformat()
    sales = await db.pos_sales.find(
        {"merchant_id": merchant["merchant_id"], "created_at": {"$gte": start}, "status": "completed"},
        {"_id": 0},
    ).to_list(20000)

    # Top products
    top: Dict[str, Dict[str, Any]] = {}
    for s in sales:
        for it in s["items"]:
            pid = it.get("product_id") or it["name"]
            row = top.setdefault(pid, {"product_id": pid, "name": it["name"], "qty": 0, "revenue": 0})
            row["qty"] += float(it["quantity"])
            row["revenue"] = round(row["revenue"] + float(it["line_total"]), 2)
    top_list = sorted(top.values(), key=lambda r: r["revenue"], reverse=True)[:30]

    return {
        "period": period,
        "sales_count": len(sales),
        "revenue": round(sum(s["total"] for s in sales), 2),
        "fees_paid": round(sum(s.get("fee", 0) for s in sales), 2),
        "net": round(sum(s.get("merchant_received", s["total"]) for s in sales), 2),
        "top_products": top_list,
    }


@router.get("/reports/inventory")
async def report_inventory(request: Request, store_id: Optional[str] = None):
    user = await get_current_user(request)
    merchant = await _require_merchant(user)
    q = {"merchant_id": merchant["merchant_id"], "active": True}
    if store_id:
        q["store_id"] = store_id
    products = await db.pos_products.find(q, {"_id": 0}).to_list(5000)

    total_stock_value_cost = 0.0
    total_stock_value_retail = 0.0
    low = []
    for p in products:
        stock = float(p.get("stock", 0))
        total_stock_value_cost += stock * float(p.get("purchase_price", 0) or 0)
        total_stock_value_retail += stock * float(p.get("price", 0) or 0)
        if (
            p.get("track_stock")
            and float(p.get("minimum_stock", 0) or 0) > 0
            and stock <= float(p.get("minimum_stock", 0))
        ):
            low.append(p)

    return {
        "products_total": len(products),
        "stock_value_cost": round(total_stock_value_cost, 2),
        "stock_value_retail": round(total_stock_value_retail, 2),
        "potential_margin": round(total_stock_value_retail - total_stock_value_cost, 2),
        "low_stock_count": len(low),
        "low_stock": low[:50],
    }


@router.get("/reports/tax")
async def report_tax(request: Request, period: str = "30d"):
    user = await get_current_user(request)
    merchant = await _require_merchant(user)
    start = _period_start(period).isoformat()
    sales = await db.pos_sales.find(
        {"merchant_id": merchant["merchant_id"], "created_at": {"$gte": start}, "status": "completed"},
        {"_id": 0},
    ).to_list(20000)

    by_rate: Dict[str, Dict[str, float]] = {}
    for s in sales:
        for it in s["items"]:
            rate = round(float(it.get("tax_rate", 0)) * 100, 2)
            key = f"{rate:.0f}%"
            row = by_rate.setdefault(key, {"net": 0, "tax": 0, "gross": 0})
            row["net"] = round(row["net"] + float(it.get("line_net", 0)), 2)
            row["tax"] = round(row["tax"] + float(it.get("line_tax", 0)), 2)
            row["gross"] = round(row["gross"] + float(it.get("line_total", 0)), 2)

    return {
        "period": period,
        "by_rate": [{"rate": k, **v} for k, v in by_rate.items()],
        "total_tax": round(sum(v["tax"] for v in by_rate.values()), 2),
        "total_net": round(sum(v["net"] for v in by_rate.values()), 2),
        "total_gross": round(sum(v["gross"] for v in by_rate.values()), 2),
    }


@router.get("/reports/refunds")
async def report_refunds(request: Request, period: str = "30d"):
    user = await get_current_user(request)
    merchant = await _require_merchant(user)
    start = _period_start(period).isoformat()
    refunds = await db.pos_refunds.find(
        {"merchant_id": merchant["merchant_id"], "issued_at": {"$gte": start}}, {"_id": 0}
    ).to_list(2000)
    return {
        "period": period,
        "count": len(refunds),
        "total": round(sum(r["amount"] for r in refunds), 2),
        "refunds": refunds,
    }


# ───────────────────────────────────────────────────────────────────────
# 6. RETURN-WITH-STOCK  (extends refund to optionally restock items)
# ───────────────────────────────────────────────────────────────────────
class ItemReturnRequest(BaseModel):
    payment_id: str
    items: List[Dict[str, Any]]   # [{product_id, quantity, refund_amount}]
    reason: Optional[str] = ""
    restock: bool = True


@router.post("/refund/items")
async def refund_with_items(req: ItemReturnRequest, request: Request):
    """Partial / item-level refund with optional stock return."""
    user = await get_current_user(request)
    payment = await db.pos_payments.find_one({"payment_id": req.payment_id})
    if not payment:
        raise HTTPException(status_code=404, detail="Zahlung nicht gefunden")
    if payment["status"] not in {PAYMENT_STATUS_PAID, "partial_refund"}:
        raise HTTPException(status_code=400, detail="Zahlung nicht erstattbar")
    await _require_store_access(user, payment["store_id"], {"merchant_admin", "store_manager", "accountant"})

    refund_total = round(sum(float(i.get("refund_amount", 0)) for i in req.items), 2)
    if refund_total <= 0 or refund_total > float(payment["amount"]):
        raise HTTPException(status_code=400, detail="Erstattungsbetrag ungültig")

    refund_id = short_id("RFD", 10)

    # Wallet reverse if BidBlitz wallet payment
    if payment["method"] in ("wallet_qr", "barcode") and payment.get("customer_id"):
        merchant = await db.pos_merchants.find_one({"merchant_id": payment["merchant_id"]})
        if merchant:
            await db.users.update_one(
                {"_id": ObjectId(merchant["owner_id"])}, {"$inc": {"balance": -refund_total}}
            )
            await db.pos_merchants.update_one(
                {"merchant_id": payment["merchant_id"]},
                {"$inc": {"settlement_balance": -refund_total}},
            )
        await credit_wallet(
            user_id=payment["customer_id"],
            amount=refund_total,
            tx_type=TransactionType.REFUND,
            description=f"POS Item-Refund {payment['payment_id']}",
            reference=refund_id,
        )

    # Restock items + log movement
    if req.restock:
        for it in req.items:
            pid = it.get("product_id")
            qty = float(it.get("quantity", 0) or 0)
            if not pid or qty <= 0:
                continue
            product = await db.pos_products.find_one({"product_id": pid})
            if not product:
                continue
            before = float(product.get("stock", 0))
            after = round(before + qty, 3)
            await db.pos_products.update_one(
                {"product_id": pid}, {"$set": {"stock": after, "updated_at": now_iso()}}
            )
            await _record_movement(
                product=product, store_id=payment["store_id"], merchant_id=payment["merchant_id"],
                type_="return", qty=qty, before=before, after=after,
                reference_id=refund_id, actor_id=str(user["_id"]),
                note=f"Refund {payment['payment_id']}",
            )

    await db.pos_refunds.insert_one({
        "refund_id": refund_id,
        "payment_id": payment["payment_id"],
        "store_id": payment["store_id"],
        "merchant_id": payment["merchant_id"],
        "amount": refund_total,
        "items": req.items,
        "method": payment["method"],
        "reason": req.reason,
        "restocked": req.restock,
        "issued_by": str(user["_id"]),
        "issued_at": now_iso(),
    })
    new_status = "refunded" if refund_total >= float(payment["amount"]) else "partial_refund"
    await db.pos_payments.update_one(
        {"payment_id": payment["payment_id"]},
        {"$set": {"status": new_status}, "$inc": {"refunded_total": refund_total}},
    )
    return {"ok": True, "refund_id": refund_id, "amount": refund_total, "status": new_status}


# ───────────────────────────────────────────────────────────────────────
# 7. CHECKOUT ALIAS  (creates cart + payment in one call for fast flow)
# ───────────────────────────────────────────────────────────────────────
class FastCheckout(BaseModel):
    register_id: str
    items: List[Dict[str, Any]]
    method: str = "wallet_qr"
    discount_pct: float = 0
    cash_received: Optional[float] = None
    customer_user_id: Optional[str] = None
    customer_barcode: Optional[str] = None


@router.post("/checkout")
async def fast_checkout(req: FastCheckout, request: Request):
    """Convenience: build cart + create payment in one POST."""
    from routes.pos_system import (
        create_cart, create_payment, CartCreate, CartItemModel, PaymentCreate,
    )
    cart_resp = await create_cart(
        CartCreate(
            register_id=req.register_id,
            items=[CartItemModel(**i) for i in req.items],
            discount_pct=req.discount_pct,
        ),
        request,
    )
    cart_id = cart_resp["cart"]["cart_id"]
    pay_resp = await create_payment(
        PaymentCreate(
            cart_id=cart_id,
            method=req.method,
            cash_received=req.cash_received,
            customer_user_id=req.customer_user_id,
            customer_barcode=req.customer_barcode,
        ),
        request,
    )
    return {"ok": True, "cart": cart_resp["cart"], "payment": pay_resp.get("payment"), "sale": pay_resp.get("sale")}


# ───────────────────────────────────────────────────────────────────────
# 8. ADMIN: NFC + failed payments
# ───────────────────────────────────────────────────────────────────────
@router.get("/admin/nfc-sessions")
async def admin_nfc_sessions(request: Request, status: Optional[str] = None, limit: int = 100):
    user = await get_current_user(request)
    if not await _is_admin(user):
        raise HTTPException(status_code=403, detail="Nur Admin")
    q = {}
    if status:
        q["status"] = status
    items = await db.pos_nfc_sessions.find(q, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    return {"sessions": items}


@router.get("/admin/failed-payments")
async def admin_failed_payments(request: Request, limit: int = 100):
    user = await get_current_user(request)
    if not await _is_admin(user):
        raise HTTPException(status_code=403, detail="Nur Admin")
    items = await db.pos_payments.find(
        {"status": {"$in": ["cancelled", "failed", "expired"]}}, {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    return {"failed": items}


# ───────────────────────────────────────────────────────────────────────
# 9. EXPORT REPORTS (CSV)
# ───────────────────────────────────────────────────────────────────────
@router.get("/reports/sales/export.csv")
async def export_sales_csv(request: Request, period: str = "30d"):
    user = await get_current_user(request)
    merchant = await _require_merchant(user)
    start = _period_start(period).isoformat()
    sales = await db.pos_sales.find(
        {"merchant_id": merchant["merchant_id"], "created_at": {"$gte": start}}, {"_id": 0},
    ).to_list(20000)

    buf = io.StringIO()
    buf.write("created_at;receipt_id;store_id;register_id;cashier_id;method;subtotal;tax;total;fee;net\n")
    for s in sales:
        buf.write(f"{s['created_at']};{s['receipt_id']};{s['store_id']};{s['register_id']};"
                  f"{s['cashier_id']};{s['method']};{s['subtotal']};{s['tax_total']};"
                  f"{s['total']};{s.get('fee', 0)};{s.get('merchant_received', s['total'])}\n")
    return StreamingResponse(
        io.BytesIO(buf.getvalue().encode()),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="sales_{period}.csv"'},
    )
