"""
POS Public API v1 — externe Software-Integrationen
Authentifizierung via API-Key (X-API-Key Header).
Feature-Flag-Gating: Endpunkte nur verfügbar wenn Add-On aktiv.
Rate-Limiting: Per-API-Key Limits via slowapi.
"""
import hashlib
from typing import Optional
from fastapi import APIRouter, HTTPException, Header, Request
from pydantic import BaseModel
from datetime import datetime, timezone
from core.database import db
from routes.pos_features import is_feature_enabled
from core.rate_limit import limiter_api_key, RATE_POS_PUBLIC_READ, RATE_POS_PUBLIC_WRITE

router = APIRouter(prefix="/api/pos/public/v1", tags=["POS Public API"])


def _now():
    return datetime.now(timezone.utc).isoformat()


async def _auth_api_key(x_api_key: Optional[str]) -> dict:
    """Validiere API-Key und liefere Merchant zurück."""
    if not x_api_key or not x_api_key.startswith("bbsec_"):
        raise HTTPException(401, "API-Key fehlt oder ungültig (Header X-API-Key)")
    key_hash = hashlib.sha256(x_api_key.encode()).hexdigest()
    key_doc = await db.pos_api_keys.find_one({"key_secret_hash": key_hash, "active": True})
    if not key_doc:
        raise HTTPException(401, "API-Key ungültig oder widerrufen")
    merchant = await db.pos_merchants.find_one({"merchant_id": key_doc["merchant_id"]}, {"_id": 0})
    if not merchant:
        raise HTTPException(404, "Merchant nicht gefunden")
    # Track last used
    await db.pos_api_keys.update_one(
        {"key_id": key_doc["key_id"]},
        {"$set": {"last_used_at": _now()}, "$inc": {"call_count": 1}},
    )
    return {"merchant": merchant, "key": key_doc, "scopes": key_doc.get("scopes", [])}


def _require_scope(ctx: dict, scope: str):
    scopes = ctx.get("scopes", [])
    if scope not in scopes and "admin" not in scopes:
        raise HTTPException(403, f"API-Key hat keinen Zugriff auf scope '{scope}'")


async def _require_feature(merchant_id: str, feature_key: str):
    if not await is_feature_enabled(merchant_id, feature_key):
        raise HTTPException(402, f"Add-On '{feature_key}' nicht aktiviert — bitte beim Anbieter zubuchen")


# ═══════════════════════════════════════════════════════════
# META
# ═══════════════════════════════════════════════════════════
@router.get("/me")
@limiter_api_key.limit(RATE_POS_PUBLIC_READ)
async def public_me(request: Request, x_api_key: Optional[str] = Header(None, alias="X-API-Key")):
    """Wer bin ich? Zeigt aktiven Merchant + Scopes + aktive Features."""
    ctx = await _auth_api_key(x_api_key)
    features = await db.pos_merchant_features.find(
        {"merchant_id": ctx["merchant"]["merchant_id"], "enabled": True}, {"_id": 0}
    ).to_list(100)
    return {
        "merchant": {
            "merchant_id": ctx["merchant"]["merchant_id"],
            "business_name": ctx["merchant"].get("business_name"),
            "status": ctx["merchant"].get("status"),
        },
        "scopes": ctx["scopes"],
        "active_features": [f["feature_key"] for f in features],
    }


@router.get("/payment-flow")
async def public_payment_flow():
    return {
        "title": "BidBlitz an der Kasse",
        "steps": [
            {"step": 1, "role": "cashier", "text": "Kasse wählt 'Mit BidBlitz bezahlen' und sucht Kunde per Kundennummer/QR/Telefon."},
            {"step": 2, "role": "api", "endpoint": "POST /api/pos/customer/resolve", "text": "Backend gibt nur maskierten Namen + Kundennummer zurück. Kein Kontostand, keine E-Mail."},
            {"step": 3, "role": "cashier", "endpoint": "POST /api/pos/payment/prepare", "text": "Kasse sendet Betrag/Warenkorb. Zahlung wartet auf Kunden-PIN oder BioPay."},
            {"step": 4, "role": "customer", "endpoint": "POST /api/pos/payment/confirm-pin", "text": "Kunde bestätigt mit 4-stelligem PIN oder PalmPay. Bei zu wenig Guthaben: nur 'Payment declined'."},
            {"step": 5, "role": "system", "text": "Wallet wird belastet, Händlerumsatz gebucht, Audit/Fraud-Log geschrieben, Beleg erzeugt."},
        ],
        "voucher_sale": [
            "Kassierer verkauft Gutschein über POST /api/pos/vouchers/sell.",
            "Kunde bekommt Code/QR BIDBLITZ-VOUCHER:GS-XXXX.",
            "Einlösung als Wallet-Guthaben: POST /api/pos/vouchers/{code}/redeem.",
            "Einlösung als Zahlungsmittel im Laden: POST /api/pos/vouchers/redeem-payment.",
        ],
        "wallet_topup": [
            "Kunde nennt Kundennummer oder scannt QR.",
            "Kasse löst Kunde über POST /api/pos/customer/resolve auf.",
            "Top-up läuft über POST /api/pos/wallet/top-up oder /api/pos/vouchers/topup.",
            "Für Aufladung ist kein Kunden-PIN nötig; bei hohen Beträgen greift Manager-Freigabe.",
        ],
        "admin_control": "Admin schaltet Module/Preise/API unter /admin/merchant-features oder POST /api/pos/features/admin/provision-merchant frei.",
    }


# ═══════════════════════════════════════════════════════════
# PRODUKTE (READ)
# ═══════════════════════════════════════════════════════════
@router.get("/products")
async def public_list_products(
    store_id: str,
    limit: int = 100,
    x_api_key: Optional[str] = Header(None, alias="X-API-Key"),
):
    ctx = await _auth_api_key(x_api_key)
    _require_scope(ctx, "read")
    items = await db.pos_products.find(
        {"merchant_id": ctx["merchant"]["merchant_id"], "store_id": store_id},
        {"_id": 0},
    ).limit(limit).to_list(limit)
    return {"products": items, "count": len(items)}


@router.get("/products/{product_id}")
async def public_get_product(
    product_id: str,
    x_api_key: Optional[str] = Header(None, alias="X-API-Key"),
):
    ctx = await _auth_api_key(x_api_key)
    _require_scope(ctx, "read")
    p = await db.pos_products.find_one(
        {"product_id": product_id, "merchant_id": ctx["merchant"]["merchant_id"]},
        {"_id": 0},
    )
    if not p:
        raise HTTPException(404, "Produkt nicht gefunden")
    return p


# ═══════════════════════════════════════════════════════════
# VERKÄUFE (READ)
# ═══════════════════════════════════════════════════════════
@router.get("/sales")
async def public_list_sales(
    store_id: Optional[str] = None,
    limit: int = 50,
    x_api_key: Optional[str] = Header(None, alias="X-API-Key"),
):
    ctx = await _auth_api_key(x_api_key)
    _require_scope(ctx, "read")
    q = {"merchant_id": ctx["merchant"]["merchant_id"]}
    if store_id:
        q["store_id"] = store_id
    items = await db.pos_sales.find(q, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    return {"sales": items, "count": len(items)}


# ═══════════════════════════════════════════════════════════
# TISCH-RESERVIERUNGEN  (FEATURE: table_reservations)
# ═══════════════════════════════════════════════════════════
class ReservationCreate(BaseModel):
    store_id: str
    guest_name: str
    guest_phone: Optional[str] = None
    guest_email: Optional[str] = None
    party_size: int = 2
    when: str  # ISO-Datum/Zeit
    notes: Optional[str] = None


@router.post("/reservations")
async def public_create_reservation(
    req: ReservationCreate,
    x_api_key: Optional[str] = Header(None, alias="X-API-Key"),
):
    """Externe Reservierungs-Software kann Reservierungen pushen."""
    ctx = await _auth_api_key(x_api_key)
    _require_scope(ctx, "write")
    await _require_feature(ctx["merchant"]["merchant_id"], "table_reservations")

    import secrets
    res_id = "RES-" + secrets.token_hex(5).upper()
    doc = {
        "reservation_id": res_id,
        "merchant_id": ctx["merchant"]["merchant_id"],
        "store_id": req.store_id,
        "guest_name": req.guest_name,
        "guest_phone": req.guest_phone,
        "guest_email": req.guest_email,
        "party_size": req.party_size,
        "when": req.when,
        "notes": req.notes,
        "status": "confirmed",
        "source": "api",
        "api_key_id": ctx["key"]["key_id"],
        "created_at": _now(),
    }
    await db.pos_reservations.insert_one(doc)
    doc.pop("_id", None)
    return {"ok": True, "reservation": doc}


@router.get("/reservations")
async def public_list_reservations(
    store_id: Optional[str] = None,
    limit: int = 50,
    x_api_key: Optional[str] = Header(None, alias="X-API-Key"),
):
    ctx = await _auth_api_key(x_api_key)
    _require_scope(ctx, "read")
    await _require_feature(ctx["merchant"]["merchant_id"], "table_reservations")
    q = {"merchant_id": ctx["merchant"]["merchant_id"]}
    if store_id:
        q["store_id"] = store_id
    items = await db.pos_reservations.find(q, {"_id": 0}).sort("when", -1).limit(limit).to_list(limit)
    return {"reservations": items}


# ═══════════════════════════════════════════════════════════
# TISCH-BESTELLUNG VIA QR  (FEATURE: table_qr_orders)
# ═══════════════════════════════════════════════════════════
class TableOrderItem(BaseModel):
    product_id: str
    quantity: int
    notes: Optional[str] = None


class TableOrderCreate(BaseModel):
    store_id: str
    table_id: str
    items: list[TableOrderItem]
    guest_name: Optional[str] = None
    guest_phone: Optional[str] = None


@router.post("/table-orders")
async def public_create_table_order(
    req: TableOrderCreate,
    x_api_key: Optional[str] = Header(None, alias="X-API-Key"),
):
    """Gast scannt QR am Tisch, App schickt Bestellung via API."""
    ctx = await _auth_api_key(x_api_key)
    _require_scope(ctx, "write")
    await _require_feature(ctx["merchant"]["merchant_id"], "table_qr_orders")

    import secrets
    order_id = "TO-" + secrets.token_hex(5).upper()
    # Resolve products
    items_resolved = []
    total = 0.0
    for it in req.items:
        p = await db.pos_products.find_one(
            {"product_id": it.product_id, "merchant_id": ctx["merchant"]["merchant_id"]},
            {"_id": 0},
        )
        if not p:
            raise HTTPException(400, f"Produkt {it.product_id} nicht gefunden")
        line_total = p["price"] * it.quantity
        total += line_total
        items_resolved.append({
            "product_id": it.product_id,
            "name": p["name"],
            "price": p["price"],
            "quantity": it.quantity,
            "notes": it.notes,
            "line_total": line_total,
        })

    doc = {
        "order_id": order_id,
        "merchant_id": ctx["merchant"]["merchant_id"],
        "store_id": req.store_id,
        "table_id": req.table_id,
        "items": items_resolved,
        "total": round(total, 2),
        "guest_name": req.guest_name,
        "guest_phone": req.guest_phone,
        "status": "received",
        "source": "qr_table",
        "api_key_id": ctx["key"]["key_id"],
        "created_at": _now(),
    }
    await db.pos_table_orders.insert_one(doc)
    doc.pop("_id", None)
    return {"ok": True, "order": doc}


@router.get("/table-orders")
async def public_list_table_orders(
    store_id: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = 50,
    x_api_key: Optional[str] = Header(None, alias="X-API-Key"),
):
    ctx = await _auth_api_key(x_api_key)
    _require_scope(ctx, "read")
    await _require_feature(ctx["merchant"]["merchant_id"], "table_qr_orders")
    q = {"merchant_id": ctx["merchant"]["merchant_id"]}
    if store_id:
        q["store_id"] = store_id
    if status:
        q["status"] = status
    items = await db.pos_table_orders.find(q, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    return {"orders": items}


# ═══════════════════════════════════════════════════════════
# DELIVERY ORDERS  (FEATURE: delivery_orders)
# ═══════════════════════════════════════════════════════════
class DeliveryOrderImport(BaseModel):
    store_id: str
    external_id: str
    platform: str  # lieferando, ubereats, wolt
    customer_name: str
    customer_phone: Optional[str] = None
    items: list[dict]
    total: float
    delivery_address: Optional[str] = None


@router.post("/delivery/import")
async def public_import_delivery(
    req: DeliveryOrderImport,
    x_api_key: Optional[str] = Header(None, alias="X-API-Key"),
):
    """Lieferdienste importieren ihre Bestellungen via API."""
    ctx = await _auth_api_key(x_api_key)
    _require_scope(ctx, "write")
    await _require_feature(ctx["merchant"]["merchant_id"], "delivery_orders")

    import secrets
    order_id = "DEL-" + secrets.token_hex(5).upper()
    doc = {
        "delivery_id": order_id,
        "merchant_id": ctx["merchant"]["merchant_id"],
        "store_id": req.store_id,
        "external_id": req.external_id,
        "platform": req.platform,
        "customer_name": req.customer_name,
        "customer_phone": req.customer_phone,
        "items": req.items,
        "total": req.total,
        "delivery_address": req.delivery_address,
        "status": "received",
        "source": "api",
        "api_key_id": ctx["key"]["key_id"],
        "created_at": _now(),
    }
    await db.pos_delivery_orders.insert_one(doc)
    doc.pop("_id", None)
    return {"ok": True, "order": doc}
