"""
POS Self-Checkout — Kunden-eigener Checkout via App/QR.
Kunde scannt QR am Eingang → öffnet Self-Checkout → scannt Produkte →
zahlt direkt vom Wallet (kein Personal nötig).

Alle Endpunkte arbeiten unabhängig von Schichten/Kassierer-Rechten.
"""
import secrets
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from bson import ObjectId
from core.database import db
from core.security import get_current_user
from core.payment_engine import debit_wallet, TransactionType
from routes.pos_features import is_feature_enabled

router = APIRouter(prefix="/api/pos/selfcheckout", tags=["POS Self-Checkout"])


def _now():
    return datetime.now(timezone.utc).isoformat()


# ═══════════════════════════════════════════════════════════
# 1. STORE-INFO + KATALOG (öffentlich, kein Login nötig)
# ═══════════════════════════════════════════════════════════
@router.get("/store/{store_id}")
async def get_store_info(store_id: str):
    """Store-Info + ob Self-Checkout-Feature aktiv ist."""
    store = await db.pos_stores.find_one({"store_id": store_id}, {"_id": 0})
    if not store:
        raise HTTPException(404, "Filiale nicht gefunden")
    merchant = await db.pos_merchants.find_one(
        {"merchant_id": store["merchant_id"]}, {"_id": 0, "owner_id": 0, "api_key": 0}
    )
    enabled = await is_feature_enabled(store["merchant_id"], "self_checkout")
    return {
        "store": store,
        "merchant": {
            "merchant_id": merchant.get("merchant_id"),
            "business_name": merchant.get("business_name"),
            "status": merchant.get("status"),
        } if merchant else None,
        "self_checkout_enabled": enabled,
    }


@router.get("/catalog/{store_id}")
async def selfcheckout_catalog(store_id: str, q: Optional[str] = None, limit: int = 200):
    """Produkt-Katalog für Self-Checkout (auch Suche per ?q=...)."""
    store = await db.pos_stores.find_one({"store_id": store_id})
    if not store:
        raise HTTPException(404, "Filiale nicht gefunden")
    if not await is_feature_enabled(store["merchant_id"], "self_checkout"):
        raise HTTPException(402, "Self-Checkout für diese Filiale nicht aktiviert")

    query: dict = {"store_id": store_id, "active": True}
    if q:
        query["$or"] = [
            {"name": {"$regex": q, "$options": "i"}},
            {"barcode": q},
            {"sku": {"$regex": q, "$options": "i"}},
        ]
    products = await db.pos_products.find(
        query, {"_id": 0, "purchase_price": 0}
    ).limit(limit).to_list(limit)
    return {"products": products, "count": len(products)}


@router.get("/product/barcode/{barcode}")
async def selfcheckout_lookup_barcode(barcode: str, store_id: str):
    """Schneller Barcode-Lookup für Scan."""
    store = await db.pos_stores.find_one({"store_id": store_id})
    if not store:
        raise HTTPException(404, "Filiale nicht gefunden")
    if not await is_feature_enabled(store["merchant_id"], "self_checkout"):
        raise HTTPException(402, "Self-Checkout nicht aktiviert")

    p = await db.pos_products.find_one(
        {"store_id": store_id, "barcode": barcode, "active": True},
        {"_id": 0, "purchase_price": 0},
    )
    if not p:
        raise HTTPException(404, "Produkt nicht gefunden")
    return p


# ═══════════════════════════════════════════════════════════
# 2. SESSION (offener Self-Checkout-Cart)
# ═══════════════════════════════════════════════════════════
class SessionStart(BaseModel):
    store_id: str


@router.post("/session/start")
async def start_session(req: SessionStart, request: Request):
    """Kunde startet einen Self-Checkout (eingeloggter User)."""
    user = await get_current_user(request)
    store = await db.pos_stores.find_one({"store_id": req.store_id})
    if not store:
        raise HTTPException(404, "Filiale nicht gefunden")
    if not await is_feature_enabled(store["merchant_id"], "self_checkout"):
        raise HTTPException(402, "Self-Checkout nicht aktiviert")

    session_id = "SCO-" + secrets.token_hex(6).upper()
    doc = {
        "session_id": session_id,
        "store_id": req.store_id,
        "merchant_id": store["merchant_id"],
        "customer_id": str(user["_id"]),
        "customer_email": user.get("email"),
        "items": [],
        "total": 0.0,
        "status": "active",
        "created_at": _now(),
    }
    await db.pos_selfcheckout_sessions.insert_one(doc)
    doc.pop("_id", None)
    return {"ok": True, "session": doc}


class SessionAddItem(BaseModel):
    session_id: str
    product_id: str
    quantity: float = 1


@router.post("/session/add")
async def add_item(req: SessionAddItem, request: Request):
    """Produkt zum Cart hinzufügen."""
    user = await get_current_user(request)
    sess = await db.pos_selfcheckout_sessions.find_one(
        {"session_id": req.session_id, "customer_id": str(user["_id"])}
    )
    if not sess:
        raise HTTPException(404, "Session nicht gefunden")
    if sess["status"] != "active":
        raise HTTPException(400, "Session nicht mehr aktiv")

    product = await db.pos_products.find_one(
        {"product_id": req.product_id, "store_id": sess["store_id"], "active": True},
        {"_id": 0, "purchase_price": 0},
    )
    if not product:
        raise HTTPException(404, "Produkt nicht gefunden")

    items = sess.get("items", [])
    found = False
    for it in items:
        if it["product_id"] == req.product_id:
            it["quantity"] = round(it["quantity"] + req.quantity, 3)
            it["line_total"] = round(it["quantity"] * it["price"], 2)
            found = True
            break
    if not found:
        items.append({
            "product_id": req.product_id,
            "name": product["name"],
            "price": float(product["price"]),
            "tax_rate": float(product.get("tax_rate", 0.19)),
            "unit": product.get("unit", "Stk"),
            "quantity": req.quantity,
            "line_total": round(req.quantity * float(product["price"]), 2),
        })

    total = sum(it["line_total"] for it in items)
    await db.pos_selfcheckout_sessions.update_one(
        {"session_id": req.session_id},
        {"$set": {"items": items, "total": round(total, 2), "updated_at": _now()}},
    )
    sess["items"] = items
    sess["total"] = round(total, 2)
    sess.pop("_id", None)
    return {"ok": True, "session": sess}


class SessionUpdateQty(BaseModel):
    session_id: str
    product_id: str
    quantity: float


@router.post("/session/update-qty")
async def update_qty(req: SessionUpdateQty, request: Request):
    user = await get_current_user(request)
    sess = await db.pos_selfcheckout_sessions.find_one(
        {"session_id": req.session_id, "customer_id": str(user["_id"])}
    )
    if not sess:
        raise HTTPException(404, "Session nicht gefunden")
    items = []
    for it in sess.get("items", []):
        if it["product_id"] == req.product_id:
            if req.quantity <= 0:
                continue
            it["quantity"] = req.quantity
            it["line_total"] = round(req.quantity * it["price"], 2)
        items.append(it)
    total = sum(it["line_total"] for it in items)
    await db.pos_selfcheckout_sessions.update_one(
        {"session_id": req.session_id},
        {"$set": {"items": items, "total": round(total, 2), "updated_at": _now()}},
    )
    sess["items"] = items
    sess["total"] = round(total, 2)
    sess.pop("_id", None)
    return {"ok": True, "session": sess}


@router.get("/session/{session_id}")
async def get_session(session_id: str, request: Request):
    user = await get_current_user(request)
    sess = await db.pos_selfcheckout_sessions.find_one(
        {"session_id": session_id, "customer_id": str(user["_id"])}, {"_id": 0}
    )
    if not sess:
        raise HTTPException(404, "Session nicht gefunden")
    return {"session": sess}


# ═══════════════════════════════════════════════════════════
# 3. ZAHLUNG (Wallet)
# ═══════════════════════════════════════════════════════════
class SessionPay(BaseModel):
    session_id: str


@router.post("/session/pay")
async def pay_session(req: SessionPay, request: Request):
    """Kunde zahlt aus eigenem Wallet → Self-Checkout abgeschlossen."""
    user = await get_current_user(request)
    sess = await db.pos_selfcheckout_sessions.find_one(
        {"session_id": req.session_id, "customer_id": str(user["_id"])}
    )
    if not sess:
        raise HTTPException(404, "Session nicht gefunden")
    if sess["status"] != "active":
        raise HTTPException(400, f"Session ist {sess['status']}")
    if not sess.get("items"):
        raise HTTPException(400, "Cart ist leer")

    total = float(sess["total"])
    if total <= 0:
        raise HTTPException(400, "Betrag ist 0")

    # Merchant-Status & Fee
    merchant = await db.pos_merchants.find_one({"merchant_id": sess["merchant_id"]})
    if not merchant or merchant.get("status") != "approved":
        raise HTTPException(402, "Filiale ist nicht für Wallet-Zahlung freigeschaltet")
    fee_rate = float(merchant.get("fee_rate", 0.015))
    fee = round(total * fee_rate, 2)
    net_to_merchant = round(total - fee, 2)

    customer_id = str(user["_id"])

    # Wallet debit
    debit = await debit_wallet(
        user_id=customer_id,
        amount=total,
        tx_type=TransactionType.MERCHANT_PAYMENT,
        description=f"Self-Checkout — {merchant.get('business_name', '')}",
        reference=req.session_id,
        merchant_name=merchant.get("business_name", ""),
        metadata={"session_id": req.session_id, "store_id": sess["store_id"], "self_checkout": True},
    )
    if not debit.success:
        raise HTTPException(400, debit.error or "Wallet-Zahlung fehlgeschlagen")

    # Merchant Owner credit
    if merchant.get("owner_id"):
        try:
            await db.users.update_one(
                {"_id": ObjectId(merchant["owner_id"])},
                {"$inc": {"balance": net_to_merchant}},
            )
        except Exception:
            pass
        await db.pos_merchants.update_one(
            {"merchant_id": merchant["merchant_id"]},
            {"$inc": {"settlement_balance": net_to_merchant, "lifetime_volume": total}},
        )

    # Sale-Datensatz (für Buchhaltung & Z-Bon)
    receipt_id = "SCO-" + secrets.token_hex(4).upper()
    sale_id = "SALE-" + secrets.token_hex(6).upper()
    items_with_tax = []
    tax_total = 0.0
    net_total = 0.0
    for it in sess["items"]:
        gross = it["line_total"]
        rate = it.get("tax_rate", 0.19)
        net = gross / (1 + rate) if rate else gross
        tax = gross - net
        items_with_tax.append({**it, "net": round(net, 2), "tax": round(tax, 2)})
        net_total += net
        tax_total += tax

    sale = {
        "sale_id": sale_id,
        "receipt_id": receipt_id,
        "merchant_id": sess["merchant_id"],
        "store_id": sess["store_id"],
        "session_id": req.session_id,
        "customer_user_id": customer_id,
        "type": "self_checkout",
        "items": items_with_tax,
        "subtotal": total,
        "net_total": round(net_total, 2),
        "tax_total": round(tax_total, 2),
        "discount": 0.0,
        "total": total,
        "fee_amount": fee,
        "net_to_merchant": net_to_merchant,
        "method": "wallet_qr",
        "status": "completed",
        "created_at": _now(),
    }
    await db.pos_sales.insert_one(sale)
    sale.pop("_id", None)

    # Session schließen
    await db.pos_selfcheckout_sessions.update_one(
        {"session_id": req.session_id},
        {"$set": {"status": "paid", "paid_at": _now(), "receipt_id": receipt_id, "sale_id": sale_id}},
    )

    # Bestand reduzieren
    for it in sess["items"]:
        try:
            await db.pos_products.update_one(
                {"product_id": it["product_id"], "store_id": sess["store_id"]},
                {"$inc": {"stock": -float(it["quantity"])}},
            )
        except Exception:
            pass

    return {
        "ok": True,
        "sale": sale,
        "new_wallet_balance": debit.new_balance,
        "message": f"Bezahlt — Beleg {receipt_id}",
    }


@router.post("/session/cancel")
async def cancel_session(req: SessionPay, request: Request):
    user = await get_current_user(request)
    res = await db.pos_selfcheckout_sessions.update_one(
        {"session_id": req.session_id, "customer_id": str(user["_id"]), "status": "active"},
        {"$set": {"status": "cancelled", "cancelled_at": _now()}},
    )
    if res.modified_count == 0:
        raise HTTPException(404, "Session nicht aktiv")
    return {"ok": True}


@router.get("/my-sessions")
async def my_sessions(request: Request, limit: int = 20):
    user = await get_current_user(request)
    items = await db.pos_selfcheckout_sessions.find(
        {"customer_id": str(user["_id"])}, {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    return {"sessions": items}
