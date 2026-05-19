"""
BidBlitz V2 — POS / Cashier System
Complete production POS for supermarkets, shops, restaurants, kiosks.
Built on top of existing wallet, merchant, and payment_engine infrastructure.

Hierarchy: Merchant -> Stores -> Registers -> Shifts -> Sales
Roles: merchant_admin, store_manager, cashier, accountant, bidblitz_admin
"""

import secrets
import logging
import io
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from bson import ObjectId

from core.database import db
from core.security import get_current_user
from core.payment_engine import debit_wallet, credit_wallet, TransactionType
from services.pos_auto_order import run_auto_order_for_store

router = APIRouter(prefix="/api/pos", tags=["POS System"])
logger = logging.getLogger("bidblitz.pos")

# ───────────────────────────────────────────────────────────────────────
# Constants
# ───────────────────────────────────────────────────────────────────────
DEFAULT_MERCHANT_FEE = 0.015          # 1.5% per BidBlitz wallet payment
PAYMENT_QR_TTL_SECONDS = 180          # 3 min validity for payment QR
PAYMENT_STATUS_PENDING = "pending"
PAYMENT_STATUS_PAID = "paid"
PAYMENT_STATUS_EXPIRED = "expired"
PAYMENT_STATUS_REFUNDED = "refunded"
PAYMENT_STATUS_CANCELLED = "cancelled"

POS_ROLES = {"merchant_admin", "store_manager", "cashier", "accountant", "bidblitz_admin"}


# ───────────────────────────────────────────────────────────────────────
# Helpers
# ───────────────────────────────────────────────────────────────────────
def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def short_id(prefix: str, n: int = 8) -> str:
    return f"{prefix}-{secrets.token_hex(n // 2).upper()}"


async def _audit(actor_id: str, action: str, ref: dict | None = None):
    await db.pos_audit_log.insert_one({
        "audit_id": short_id("AUD", 10),
        "actor_id": actor_id,
        "action": action,
        "ref": ref or {},
        "ts": now_iso(),
    })


async def _is_admin(user) -> bool:
    return bool(
        user.get("is_admin")
        or user.get("role") in ("admin", "bidblitz_admin")
    )


async def _get_pos_role(user_id: str, store_id: str | None = None) -> str | None:
    """Look up merchant team membership; falls back to legacy `users.role`."""
    if store_id:
        membership = await db.pos_staff.find_one(
            {"user_id": user_id, "store_id": store_id, "active": True},
            {"_id": 0, "role": 1},
        )
        if membership:
            return membership["role"]
    membership = await db.pos_staff.find_one(
        {"user_id": user_id, "active": True}, {"_id": 0, "role": 1}
    )
    if membership:
        return membership["role"]
    return None


async def _require_merchant(user, merchant_id: str | None = None):
    """Ensure the user owns or is a merchant_admin. Returns merchant_id."""
    user_id = str(user["_id"])
    if merchant_id:
        merchant = await db.pos_merchants.find_one({"merchant_id": merchant_id})
        if not merchant:
            raise HTTPException(status_code=404, detail="Merchant nicht gefunden")
        if merchant["owner_id"] != user_id and not await _is_admin(user):
            raise HTTPException(status_code=403, detail="Nicht berechtigt")
        return merchant
    merchant = await db.pos_merchants.find_one({"owner_id": user_id})
    if not merchant:
        raise HTTPException(status_code=404, detail="Kein POS-Merchant-Profil — bitte erst registrieren")
    return merchant


async def _require_store_access(user, store_id: str, allow_roles=None):
    """Validate access to a store. Returns the store doc."""
    allow_roles = allow_roles or {"merchant_admin", "store_manager", "cashier", "accountant"}
    user_id = str(user["_id"])
    store = await db.pos_stores.find_one({"store_id": store_id})
    if not store:
        raise HTTPException(status_code=404, detail="Store nicht gefunden")
    merchant = await db.pos_merchants.find_one({"merchant_id": store["merchant_id"]})

    if await _is_admin(user):
        return store
    if merchant and merchant["owner_id"] == user_id:
        return store

    role = await _get_pos_role(user_id, store_id)
    if not role or role not in allow_roles:
        raise HTTPException(status_code=403, detail="Nicht berechtigt für diesen Store")
    return store


# ───────────────────────────────────────────────────────────────────────
# Models
# ───────────────────────────────────────────────────────────────────────
class MerchantRegister(BaseModel):
    business_name: str
    business_type: str = "retail"      # retail | restaurant | kiosk | supermarket | other
    tax_id: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    country: str = "DE"


class StoreCreate(BaseModel):
    name: str
    address: str = ""
    city: str = ""
    country: str = "DE"
    timezone: str = "Europe/Berlin"
    lat: Optional[float] = None
    lng: Optional[float] = None


class RegisterCreate(BaseModel):
    store_id: str
    name: str = "Kasse 1"
    location: str = ""           # e.g. "Eingang links"


class StaffInvite(BaseModel):
    store_id: str
    user_email: str
    role: str = "cashier"        # cashier | store_manager | accountant


class ProductCreate(BaseModel):
    store_id: str
    name: str
    description: Optional[str] = None
    brand: Optional[str] = None
    barcode: Optional[str] = None
    sku: Optional[str] = None
    price: float = Field(..., ge=0, le=2000, description="Max €2000 pro Artikel")
    purchase_price: float = 0
    tax_rate: float = 0.19           # 19% DE Mehrwertsteuer
    category: str = ""
    unit: str = "Stk"
    stock: float = 0
    minimum_stock: float = 0
    track_stock: bool = True
    allow_negative_stock: bool = False
    supplier_id: Optional[str] = None
    image_url: Optional[str] = None


class ProductUpdate(BaseModel):
    product_id: str
    name: Optional[str] = None
    price: Optional[float] = None
    tax_rate: Optional[float] = None
    category: Optional[str] = None
    stock: Optional[float] = None
    active: Optional[bool] = None


class ShiftOpen(BaseModel):
    register_id: str
    opening_cash: float = 0


class ShiftClose(BaseModel):
    shift_id: str
    closing_cash: float = 0
    notes: Optional[str] = ""


class CartItemModel(BaseModel):
    product_id: Optional[str] = None
    barcode: Optional[str] = None
    name: Optional[str] = None      # for free-form items
    quantity: float = 1
    price: Optional[float] = None   # required if no product_id
    tax_rate: Optional[float] = None
    discount_pct: float = 0          # per-line discount %
    discount_amount: float = 0       # absolute discount


class CartCreate(BaseModel):
    register_id: str
    items: List[CartItemModel]
    discount_pct: float = 0           # whole-cart discount %
    customer_note: Optional[str] = ""


class PaymentCreate(BaseModel):
    cart_id: str
    method: str = "wallet_qr"        # wallet_qr | barcode | cash | card_external
    cash_received: Optional[float] = None
    card_reference: Optional[str] = None
    customer_user_id: Optional[str] = None       # If known up front
    customer_barcode: Optional[str] = None       # Optional: customer barcode scanned


class PaymentConfirm(BaseModel):
    payment_id: str


class RefundRequest(BaseModel):
    payment_id: str
    amount: Optional[float] = None    # None = full refund
    reason: Optional[str] = ""


# ───────────────────────────────────────────────────────────────────────
# 1. MERCHANT  /  STORES  /  REGISTERS
# ───────────────────────────────────────────────────────────────────────
@router.post("/merchants/register")
async def register_pos_merchant(req: MerchantRegister, request: Request):
    user = await get_current_user(request)
    user_id = str(user["_id"])

    if await db.pos_merchants.find_one({"owner_id": user_id}):
        raise HTTPException(status_code=400, detail="Du hast bereits einen POS-Merchant")

    merchant_id = short_id("MER", 12)
    api_key = secrets.token_urlsafe(32)
    doc = {
        "merchant_id": merchant_id,
        "owner_id": user_id,
        "owner_email": user.get("email", ""),
        "business_name": req.business_name,
        "business_type": req.business_type,
        "tax_id": req.tax_id,
        "contact_email": req.contact_email or user.get("email", ""),
        "contact_phone": req.contact_phone,
        "country": req.country,
        "status": "pending",            # pending -> approved -> suspended
        "fee_rate": DEFAULT_MERCHANT_FEE,
        "api_key": api_key,
        "settlement_balance": 0,
        "lifetime_volume": 0,
        "created_at": now_iso(),
    }
    await db.pos_merchants.insert_one(doc)
    doc.pop("_id", None)
    await _audit(user_id, "merchant.register", {"merchant_id": merchant_id})
    # Default-Add-Ons aktivieren (loyalty, vouchers)
    try:
        from routes.pos_features import _ensure_defaults
        await _ensure_defaults(merchant_id)
    except Exception:
        pass
    return {"ok": True, "merchant": doc}


@router.get("/merchants/me")
async def get_my_merchant(request: Request):
    user = await get_current_user(request)
    user_id = str(user["_id"])
    m = await db.pos_merchants.find_one({"owner_id": user_id}, {"_id": 0})
    if not m:
        return {"merchant": None}
    return {"merchant": m}


@router.post("/stores/create")
async def create_store(req: StoreCreate, request: Request):
    user = await get_current_user(request)
    merchant = await _require_merchant(user)
    if merchant.get("status") != "approved" and not await _is_admin(user):
        # Allow store creation while pending; payments require approval
        pass

    store_id = short_id("STR", 10)
    doc = {
        "store_id": store_id,
        "merchant_id": merchant["merchant_id"],
        "name": req.name,
        "address": req.address,
        "city": req.city,
        "country": req.country,
        "timezone": req.timezone,
        "lat": req.lat,
        "lng": req.lng,
        "status": "active",
        "created_at": now_iso(),
    }
    await db.pos_stores.insert_one(doc)
    doc.pop("_id", None)

    # Owner gets merchant_admin role for the store
    await db.pos_staff.update_one(
        {"user_id": str(user["_id"]), "store_id": store_id},
        {"$set": {
            "user_id": str(user["_id"]),
            "store_id": store_id,
            "merchant_id": merchant["merchant_id"],
            "role": "merchant_admin",
            "active": True,
            "added_at": now_iso(),
        }},
        upsert=True,
    )
    await _audit(str(user["_id"]), "store.create", {"store_id": store_id})
    return {"ok": True, "store": doc}


@router.get("/stores")
async def list_stores(request: Request):
    user = await get_current_user(request)
    merchant = await db.pos_merchants.find_one({"owner_id": str(user["_id"])})
    if not merchant:
        return {"stores": []}
    stores = await db.pos_stores.find(
        {"merchant_id": merchant["merchant_id"]}, {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    return {"stores": stores}


@router.post("/registers/create")
async def create_register(req: RegisterCreate, request: Request):
    user = await get_current_user(request)
    store = await _require_store_access(user, req.store_id, {"merchant_admin", "store_manager"})

    register_id = short_id("REG", 8)
    api_key = secrets.token_urlsafe(24)
    doc = {
        "register_id": register_id,
        "store_id": req.store_id,
        "merchant_id": store["merchant_id"],
        "name": req.name,
        "location": req.location,
        "status": "active",
        "api_key": api_key,
        "current_shift_id": None,
        "created_at": now_iso(),
    }
    await db.pos_registers.insert_one(doc)
    doc.pop("_id", None)
    await _audit(str(user["_id"]), "register.create", {"register_id": register_id})
    return {"ok": True, "register": doc}


@router.get("/registers")
async def list_registers(request: Request, store_id: Optional[str] = None):
    user = await get_current_user(request)
    merchant = await db.pos_merchants.find_one({"owner_id": str(user["_id"])})
    if not merchant and not await _is_admin(user):
        return {"registers": []}
    q = {}
    if merchant:
        q["merchant_id"] = merchant["merchant_id"]
    if store_id:
        q["store_id"] = store_id
    regs = await db.pos_registers.find(q, {"_id": 0, "api_key": 0}).sort("created_at", -1).to_list(200)
    return {"registers": regs}


@router.post("/staff/invite")
async def invite_staff(req: StaffInvite, request: Request):
    user = await get_current_user(request)
    store = await _require_store_access(user, req.store_id, {"merchant_admin", "store_manager"})
    if req.role not in {"cashier", "store_manager", "accountant"}:
        raise HTTPException(status_code=400, detail="Rolle ungültig")

    target = await db.users.find_one({"email": req.user_email})
    if not target:
        raise HTTPException(status_code=404, detail="User nicht gefunden")

    await db.pos_staff.update_one(
        {"user_id": str(target["_id"]), "store_id": req.store_id},
        {"$set": {
            "user_id": str(target["_id"]),
            "user_email": req.user_email,
            "store_id": req.store_id,
            "merchant_id": store["merchant_id"],
            "role": req.role,
            "active": True,
            "added_by": str(user["_id"]),
            "added_at": now_iso(),
        }},
        upsert=True,
    )
    await _audit(str(user["_id"]), "staff.invite", {"store_id": req.store_id, "email": req.user_email, "role": req.role})
    return {"ok": True}


# ───────────────────────────────────────────────────────────────────────
# 2. PRODUCTS
# ───────────────────────────────────────────────────────────────────────
@router.post("/products/create")
async def create_product(req: ProductCreate, request: Request):
    user = await get_current_user(request)
    store = await _require_store_access(user, req.store_id, {"merchant_admin", "store_manager"})

    product_id = short_id("PRD", 10)
    doc = {
        "product_id": product_id,
        "store_id": req.store_id,
        "merchant_id": store["merchant_id"],
        "name": req.name,
        "description": req.description,
        "brand": req.brand,
        "barcode": req.barcode,
        "sku": req.sku,
        "price": round(req.price, 2),
        "purchase_price": round(req.purchase_price, 2),
        "tax_rate": req.tax_rate,
        "category": req.category,
        "unit": req.unit,
        "stock": req.stock,
        "minimum_stock": req.minimum_stock,
        "track_stock": req.track_stock,
        "allow_negative_stock": req.allow_negative_stock,
        "supplier_id": req.supplier_id,
        "image_url": req.image_url,
        "active": True,
        "created_at": now_iso(),
    }
    await db.pos_products.insert_one(doc)
    doc.pop("_id", None)
    return {"ok": True, "product": doc}


@router.post("/products/update")
async def update_product(req: ProductUpdate, request: Request):
    user = await get_current_user(request)
    p = await db.pos_products.find_one({"product_id": req.product_id})
    if not p:
        raise HTTPException(status_code=404, detail="Produkt nicht gefunden")
    await _require_store_access(user, p["store_id"], {"merchant_admin", "store_manager"})

    upd = {k: v for k, v in req.dict().items() if v is not None and k != "product_id"}
    if "price" in upd:
        upd["price"] = round(upd["price"], 2)
    upd["updated_at"] = now_iso()
    await db.pos_products.update_one({"product_id": req.product_id}, {"$set": upd})
    return {"ok": True}


@router.get("/products/search")
async def search_products(request: Request, store_id: str, q: Optional[str] = None,
                          barcode: Optional[str] = None, limit: int = 50):
    user = await get_current_user(request)
    await _require_store_access(user, store_id)

    query: Dict[str, Any] = {"store_id": store_id, "active": True}
    if barcode:
        query["barcode"] = barcode
    if q:
        query["$or"] = [
            {"name": {"$regex": q, "$options": "i"}},
            {"sku": {"$regex": q, "$options": "i"}},
            {"barcode": q},
        ]
    items = await db.pos_products.find(query, {"_id": 0}).sort("name", 1).limit(limit).to_list(limit)
    return {"products": items, "count": len(items)}


@router.get("/products/lookup")
async def product_by_barcode(request: Request, store_id: str, barcode: str):
    user = await get_current_user(request)
    await _require_store_access(user, store_id)
    p = await db.pos_products.find_one(
        {"store_id": store_id, "barcode": barcode, "active": True}, {"_id": 0}
    )
    if not p:
        raise HTTPException(status_code=404, detail="Barcode nicht gefunden")
    return p


# ───────────────────────────────────────────────────────────────────────
# 3. SHIFTS
# ───────────────────────────────────────────────────────────────────────
@router.post("/shift/open")
async def shift_open(req: ShiftOpen, request: Request):
    user = await get_current_user(request)
    reg = await db.pos_registers.find_one({"register_id": req.register_id})
    if not reg:
        raise HTTPException(status_code=404, detail="Kasse nicht gefunden")
    await _require_store_access(user, reg["store_id"])

    if reg.get("current_shift_id"):
        existing = await db.pos_shifts.find_one(
            {"shift_id": reg["current_shift_id"], "status": "open"}, {"_id": 0}
        )
        if existing:
            return {"ok": True, "shift": existing, "message": "Schicht bereits offen"}

    shift_id = short_id("SHF", 10)
    doc = {
        "shift_id": shift_id,
        "register_id": req.register_id,
        "store_id": reg["store_id"],
        "merchant_id": reg["merchant_id"],
        "cashier_id": str(user["_id"]),
        "cashier_name": user.get("name", user.get("email", "")),
        "opening_cash": req.opening_cash,
        "expected_cash": req.opening_cash,
        "actual_cash": 0,
        "sales_count": 0,
        "sales_total": 0,
        "refund_total": 0,
        "by_method": {"wallet_qr": 0, "barcode": 0, "cash": 0, "card_external": 0},
        "status": "open",
        "opened_at": now_iso(),
        "closed_at": None,
    }
    await db.pos_shifts.insert_one(doc)
    doc.pop("_id", None)

    await db.pos_registers.update_one(
        {"register_id": req.register_id}, {"$set": {"current_shift_id": shift_id}}
    )
    await _audit(str(user["_id"]), "shift.open", {"shift_id": shift_id})
    return {"ok": True, "shift": doc}


@router.post("/shift/close")
async def shift_close(req: ShiftClose, request: Request):
    user = await get_current_user(request)
    shift = await db.pos_shifts.find_one({"shift_id": req.shift_id})
    if not shift:
        raise HTTPException(status_code=404, detail="Schicht nicht gefunden")
    if shift["cashier_id"] != str(user["_id"]):
        await _require_store_access(user, shift["store_id"], {"merchant_admin", "store_manager"})
    if shift["status"] != "open":
        raise HTTPException(status_code=400, detail="Schicht bereits geschlossen")

    expected = shift.get("opening_cash", 0) + shift["by_method"].get("cash", 0) - shift.get("refund_total", 0)
    diff = round(req.closing_cash - expected, 2)

    await db.pos_shifts.update_one(
        {"shift_id": req.shift_id},
        {"$set": {
            "status": "closed",
            "closed_at": now_iso(),
            "actual_cash": req.closing_cash,
            "expected_cash": round(expected, 2),
            "cash_difference": diff,
            "notes": req.notes or "",
        }},
    )
    await db.pos_registers.update_one(
        {"register_id": shift["register_id"]}, {"$set": {"current_shift_id": None}}
    )
    await _audit(str(user["_id"]), "shift.close", {"shift_id": req.shift_id, "diff": diff})
    return {"ok": True, "expected_cash": expected, "actual_cash": req.closing_cash, "difference": diff}


@router.get("/shift/current")
async def get_current_shift(request: Request, register_id: str):
    user = await get_current_user(request)
    reg = await db.pos_registers.find_one({"register_id": register_id})
    if not reg:
        raise HTTPException(status_code=404, detail="Kasse nicht gefunden")
    await _require_store_access(user, reg["store_id"])
    if not reg.get("current_shift_id"):
        return {"shift": None}
    shift = await db.pos_shifts.find_one(
        {"shift_id": reg["current_shift_id"]}, {"_id": 0}
    )
    return {"shift": shift}


@router.get("/shifts")
async def list_shifts(request: Request, store_id: str, limit: int = 50):
    user = await get_current_user(request)
    await _require_store_access(user, store_id, {"merchant_admin", "store_manager", "accountant"})
    shifts = await db.pos_shifts.find(
        {"store_id": store_id}, {"_id": 0}
    ).sort("opened_at", -1).limit(limit).to_list(limit)
    return {"shifts": shifts}


# ───────────────────────────────────────────────────────────────────────
# 4. CART  (build a checkout cart)
# ───────────────────────────────────────────────────────────────────────
async def _resolve_cart_items(store_id: str, items: List[CartItemModel]) -> Dict[str, Any]:
    """Resolves products and computes totals. Validates stock for products that track it."""
    resolved = []
    subtotal = 0.0
    tax_total = 0.0
    warnings: List[str] = []

    for it in items:
        product = None
        if it.product_id:
            product = await db.pos_products.find_one({"product_id": it.product_id, "active": True})
        elif it.barcode:
            product = await db.pos_products.find_one(
                {"store_id": store_id, "barcode": it.barcode, "active": True}
            )

        if product:
            name = product["name"]
            unit_price = float(product["price"])
            tax_rate = float(product.get("tax_rate", 0.19))
            product_id = product["product_id"]

            # Stock validation
            if product.get("track_stock"):
                qty = float(it.quantity or 1)
                stock = float(product.get("stock", 0))
                if stock < qty and not product.get("allow_negative_stock"):
                    raise HTTPException(
                        status_code=400,
                        detail=f"Bestand zu niedrig: {name} ({stock} verfügbar, {qty} angefordert)",
                    )
                if stock < qty:
                    warnings.append(f"{name}: Bestand wird negativ ({stock - qty})")
        else:
            if it.price is None or it.name is None:
                raise HTTPException(status_code=400, detail="Manueller Artikel braucht Name & Preis")
            name = it.name
            unit_price = float(it.price)
            tax_rate = float(it.tax_rate or 0.19)
            product_id = None

        qty = float(it.quantity or 1)
        line_gross = round(unit_price * qty, 2)
        # Apply line discount
        disc_pct = float(it.discount_pct or 0)
        disc_abs = float(it.discount_amount or 0)
        line_disc = round(line_gross * disc_pct / 100, 2) + disc_abs
        line_disc = min(line_disc, line_gross)
        line_net_gross = round(line_gross - line_disc, 2)

        # tax_rate is e.g. 0.19 (gross) — extract net
        line_tax = round(line_net_gross - line_net_gross / (1 + tax_rate), 2)
        line_net = round(line_net_gross - line_tax, 2)

        resolved.append({
            "product_id": product_id,
            "name": name,
            "unit_price": unit_price,
            "quantity": qty,
            "tax_rate": tax_rate,
            "discount": line_disc,
            "line_net": line_net,
            "line_tax": line_tax,
            "line_total": line_net_gross,
            "barcode": product.get("barcode") if product else it.barcode,
        })
        subtotal += line_net_gross
        tax_total += line_tax

    return {
        "items": resolved,
        "subtotal": round(subtotal, 2),
        "tax_total": round(tax_total, 2),
        "net_total": round(subtotal - tax_total, 2),
        "warnings": warnings,
    }


@router.post("/cart/create")
async def create_cart(req: CartCreate, request: Request):
    user = await get_current_user(request)
    reg = await db.pos_registers.find_one({"register_id": req.register_id})
    if not reg:
        raise HTTPException(status_code=404, detail="Kasse nicht gefunden")
    await _require_store_access(user, reg["store_id"])
    if not reg.get("current_shift_id"):
        raise HTTPException(status_code=400, detail="Bitte erst Schicht öffnen")

    if not req.items:
        raise HTTPException(status_code=400, detail="Cart ist leer")

    resolved = await _resolve_cart_items(reg["store_id"], req.items)
    cart_total = resolved["subtotal"]
    cart_disc_pct = float(req.discount_pct or 0)
    cart_disc = round(cart_total * cart_disc_pct / 100, 2)
    final_total = round(cart_total - cart_disc, 2)

    cart_id = short_id("CRT", 10)
    doc = {
        "cart_id": cart_id,
        "register_id": req.register_id,
        "store_id": reg["store_id"],
        "merchant_id": reg["merchant_id"],
        "shift_id": reg["current_shift_id"],
        "cashier_id": str(user["_id"]),
        "items": resolved["items"],
        "subtotal": resolved["subtotal"],
        "net_total": resolved["net_total"],
        "tax_total": resolved["tax_total"],
        "cart_discount_pct": cart_disc_pct,
        "cart_discount": cart_disc,
        "total": final_total,
        "status": "open",
        "customer_note": req.customer_note,
        "created_at": now_iso(),
    }
    await db.pos_carts.insert_one(doc)
    doc.pop("_id", None)
    return {"ok": True, "cart": doc}


@router.get("/cart/{cart_id}")
async def get_cart(cart_id: str, request: Request):
    user = await get_current_user(request)
    cart = await db.pos_carts.find_one({"cart_id": cart_id}, {"_id": 0})
    if not cart:
        raise HTTPException(status_code=404, detail="Cart nicht gefunden")
    await _require_store_access(user, cart["store_id"])
    return cart


# ───────────────────────────────────────────────────────────────────────
# 5. PAYMENTS
# ───────────────────────────────────────────────────────────────────────
async def _finalise_sale(payment: dict, cart: dict, paid_by_user_id: str | None,
                         method: str, fee_amount: float, customer_paid: float):
    """Common path after a payment is collected — records sale, updates shift, stock, audit."""
    receipt_id = short_id("RCP", 10)
    sale = {
        "sale_id": short_id("SAL", 10),
        "receipt_id": receipt_id,
        "payment_id": payment["payment_id"],
        "cart_id": cart["cart_id"],
        "register_id": cart["register_id"],
        "store_id": cart["store_id"],
        "merchant_id": cart["merchant_id"],
        "shift_id": cart["shift_id"],
        "cashier_id": cart["cashier_id"],
        "customer_id": paid_by_user_id,
        "items": cart["items"],
        "subtotal": cart["subtotal"],
        "net_total": cart["net_total"],
        "tax_total": cart["tax_total"],
        "discount": cart.get("cart_discount", 0),
        "total": cart["total"],
        "method": method,
        "fee": fee_amount,
        "merchant_received": round(cart["total"] - fee_amount, 2),
        "customer_paid": customer_paid,
        "change": round(customer_paid - cart["total"], 2) if method == "cash" else 0,
        "created_at": now_iso(),
        "status": "completed",
    }
    await db.pos_sales.insert_one(sale)
    sale.pop("_id", None)

    # Update shift
    await db.pos_shifts.update_one(
        {"shift_id": cart["shift_id"]},
        {"$inc": {
            "sales_count": 1,
            "sales_total": cart["total"],
            f"by_method.{method}": cart["total"],
        }},
    )
    # Stock decrement + record movement
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
                "created_by": cart["cashier_id"],
                "note": f"Sale {sale['receipt_id']}",
                "created_at": now_iso(),
            })
    try:
        await run_auto_order_for_store(cart["store_id"], cart["merchant_id"], cart["cashier_id"], trigger="sale", force=False)
    except Exception:
        pass
    # Mark cart paid
    await db.pos_carts.update_one(
        {"cart_id": cart["cart_id"]}, {"$set": {"status": "paid"}}
    )
    return sale


@router.post("/payment/create")
async def create_payment(req: PaymentCreate, request: Request):
    user = await get_current_user(request)
    cart = await db.pos_carts.find_one({"cart_id": req.cart_id})
    if not cart:
        raise HTTPException(status_code=404, detail="Cart nicht gefunden")
    if cart["status"] != "open":
        raise HTTPException(status_code=400, detail="Cart bereits abgeschlossen")
    await _require_store_access(user, cart["store_id"])

    merchant = await db.pos_merchants.find_one({"merchant_id": cart["merchant_id"]})
    if merchant.get("status") != "approved" and req.method in ("wallet_qr", "barcode"):
        raise HTTPException(status_code=403, detail="Merchant noch nicht freigeschaltet (BidBlitz Admin Approval erforderlich)")

    fee_rate = float(merchant.get("fee_rate", DEFAULT_MERCHANT_FEE))
    total = float(cart["total"])
    payment_id = short_id("PAY", 12)
    now = datetime.now(timezone.utc)

    payment_doc = {
        "payment_id": payment_id,
        "cart_id": cart["cart_id"],
        "register_id": cart["register_id"],
        "store_id": cart["store_id"],
        "merchant_id": cart["merchant_id"],
        "amount": total,
        "fee_rate": fee_rate if req.method in ("wallet_qr", "barcode") else 0,
        "method": req.method,
        "status": PAYMENT_STATUS_PENDING,
        "expires_at": (now + timedelta(seconds=PAYMENT_QR_TTL_SECONDS)).isoformat(),
        "created_at": now.isoformat(),
        "qr_code": None,
        "barcode": None,
        "customer_id": None,
    }

    # ─── Cash ───
    if req.method == "cash":
        if req.cash_received is None or req.cash_received < total:
            raise HTTPException(status_code=400, detail=f"Bargeld zu wenig (€{total:.2f} nötig)")
        payment_doc["status"] = PAYMENT_STATUS_PAID
        payment_doc["paid_at"] = now.isoformat()
        await db.pos_payments.insert_one(payment_doc)
        payment_doc.pop("_id", None)
        sale = await _finalise_sale(payment_doc, cart, None, "cash", 0, req.cash_received)
        return {"ok": True, "payment": payment_doc, "sale": sale}

    # ─── Card external (terminal handles charge) ───
    if req.method == "card_external":
        if not req.card_reference:
            raise HTTPException(status_code=400, detail="Karten-Referenz erforderlich")
        payment_doc["status"] = PAYMENT_STATUS_PAID
        payment_doc["paid_at"] = now.isoformat()
        payment_doc["card_reference"] = req.card_reference
        await db.pos_payments.insert_one(payment_doc)
        payment_doc.pop("_id", None)
        sale = await _finalise_sale(payment_doc, cart, None, "card_external", 0, total)
        return {"ok": True, "payment": payment_doc, "sale": sale}

    # ─── BidBlitz Wallet QR / Barcode ───
    if req.method in ("wallet_qr", "barcode"):
        # Generate scannable code carrying payment_id
        code_payload = f"BIDBLITZ-PAY:{payment_id}"
        payment_doc["qr_code"] = code_payload
        payment_doc["barcode"] = payment_id  # numeric/short for legacy scanners

        # If customer barcode is supplied directly, immediately settle
        immediate_user = None
        if req.customer_user_id:
            try:
                immediate_user = await db.users.find_one({"_id": ObjectId(req.customer_user_id)})
            except Exception:
                immediate_user = None
        elif req.customer_barcode:
            immediate_user = await db.users.find_one({"customer_barcode": req.customer_barcode})

        await db.pos_payments.insert_one(payment_doc)
        payment_doc.pop("_id", None)

        if immediate_user:
            return await _settle_wallet_payment(payment_doc, cart, immediate_user, fee_rate)

        return {"ok": True, "payment": payment_doc, "awaiting_customer": True}

    raise HTTPException(status_code=400, detail=f"Methode '{req.method}' nicht unterstützt")


async def _settle_wallet_payment(payment: dict, cart: dict, customer: dict, fee_rate: float):
    """Atomic wallet debit/credit between customer and merchant."""
    # Refresh latest payment status (avoid double pay)
    fresh = await db.pos_payments.find_one({"payment_id": payment["payment_id"]})
    if not fresh or fresh["status"] != PAYMENT_STATUS_PENDING:
        raise HTTPException(status_code=400, detail="Zahlung nicht mehr aktiv")
    # Expiry guard
    try:
        if datetime.fromisoformat(fresh["expires_at"]) < datetime.now(timezone.utc):
            await db.pos_payments.update_one(
                {"payment_id": payment["payment_id"]}, {"$set": {"status": PAYMENT_STATUS_EXPIRED}}
            )
            raise HTTPException(status_code=400, detail="Zahlung abgelaufen")
    except (ValueError, KeyError):
        pass

    total = float(cart["total"])
    customer_id = str(customer["_id"])

    # Debit customer
    debit = await debit_wallet(
        user_id=customer_id,
        amount=total,
        tx_type=TransactionType.MERCHANT_PAYMENT,
        description=f"POS Zahlung — {cart['store_id']}",
        reference=payment["payment_id"],
        merchant_name=cart.get("merchant_name", ""),
        metadata={"payment_id": payment["payment_id"], "store_id": cart["store_id"]},
    )
    if not debit.success:
        await db.pos_payments.update_one(
            {"payment_id": payment["payment_id"]},
            {"$set": {"status": PAYMENT_STATUS_CANCELLED, "error": debit.error}},
        )
        raise HTTPException(status_code=400, detail=debit.error)

    # Compute fee, credit merchant owner wallet (net)
    fee = round(total * fee_rate, 2)
    net_to_merchant = round(total - fee, 2)
    merchant = await db.pos_merchants.find_one({"merchant_id": cart["merchant_id"]})
    if merchant:
        await db.users.update_one(
            {"_id": ObjectId(merchant["owner_id"])},
            {"$inc": {"balance": net_to_merchant}},
        )
        await db.pos_merchants.update_one(
            {"merchant_id": cart["merchant_id"]},
            {"$inc": {"settlement_balance": net_to_merchant, "lifetime_volume": total}},
        )

    # Mark payment paid
    paid_at = now_iso()
    await db.pos_payments.update_one(
        {"payment_id": payment["payment_id"]},
        {"$set": {
            "status": PAYMENT_STATUS_PAID,
            "paid_at": paid_at,
            "customer_id": customer_id,
            "fee_amount": fee,
            "net_to_merchant": net_to_merchant,
        }},
    )
    payment["status"] = PAYMENT_STATUS_PAID
    payment["paid_at"] = paid_at
    payment["customer_id"] = customer_id

    sale = await _finalise_sale(payment, cart, customer_id, payment["method"], fee, total)
    await _audit("system", "payment.paid", {"payment_id": payment["payment_id"], "amount": total})
    return {"ok": True, "payment": payment, "sale": sale}


@router.post("/payment/customer-confirm")
async def customer_confirm_payment(req: PaymentConfirm, request: Request):
    """
    Endpoint that the BidBlitz customer app calls after scanning the merchant QR code
    (payload format `BIDBLITZ-PAY:<payment_id>`). Customer must be logged-in.
    """
    user = await get_current_user(request)
    payment = await db.pos_payments.find_one({"payment_id": req.payment_id})
    if not payment:
        raise HTTPException(status_code=404, detail="Zahlung nicht gefunden")
    if payment["status"] != PAYMENT_STATUS_PENDING:
        raise HTTPException(status_code=400, detail=f"Zahlungsstatus: {payment['status']}")

    cart = await db.pos_carts.find_one({"cart_id": payment["cart_id"]})
    if not cart:
        raise HTTPException(status_code=404, detail="Cart fehlt")
    fee_rate = float(payment.get("fee_rate", DEFAULT_MERCHANT_FEE))
    payment.pop("_id", None)
    return await _settle_wallet_payment(payment, cart, user, fee_rate)


@router.get("/payment/status/{payment_id}")
async def payment_status(payment_id: str, request: Request):
    user = await get_current_user(request)
    payment = await db.pos_payments.find_one({"payment_id": payment_id}, {"_id": 0})
    if not payment:
        raise HTTPException(status_code=404, detail="Zahlung nicht gefunden")
    # Allow either staff at the store, or the customer who paid
    if payment.get("customer_id") != str(user["_id"]):
        await _require_store_access(user, payment["store_id"])
    return payment


@router.post("/payment/refund")
async def refund_payment(req: RefundRequest, request: Request):
    user = await get_current_user(request)
    payment = await db.pos_payments.find_one({"payment_id": req.payment_id})
    if not payment:
        raise HTTPException(status_code=404, detail="Zahlung nicht gefunden")
    if payment["status"] != PAYMENT_STATUS_PAID:
        raise HTTPException(status_code=400, detail="Nur bezahlte Zahlungen erstattbar")

    # Authorisation: merchant_admin / store_manager / accountant only
    await _require_store_access(user, payment["store_id"], {"merchant_admin", "store_manager", "accountant"})

    refund_amount = float(req.amount) if req.amount else float(payment["amount"])
    if refund_amount <= 0 or refund_amount > float(payment["amount"]):
        raise HTTPException(status_code=400, detail="Refund-Betrag ungültig")

    refund_id = short_id("RFD", 10)
    method = payment["method"]

    if method in ("wallet_qr", "barcode") and payment.get("customer_id"):
        # Reverse wallet flow: take from merchant owner, credit customer
        merchant = await db.pos_merchants.find_one({"merchant_id": payment["merchant_id"]})
        if merchant:
            await db.users.update_one(
                {"_id": ObjectId(merchant["owner_id"])},
                {"$inc": {"balance": -refund_amount}},
            )
            await db.pos_merchants.update_one(
                {"merchant_id": payment["merchant_id"]},
                {"$inc": {"settlement_balance": -refund_amount}},
            )
        await credit_wallet(
            user_id=payment["customer_id"],
            amount=refund_amount,
            tx_type=TransactionType.REFUND,
            description=f"POS Refund {payment['payment_id']}",
            reference=refund_id,
        )

    # For cash/card_external the refund is informational; merchant settles outside.
    refund_doc = {
        "refund_id": refund_id,
        "payment_id": payment["payment_id"],
        "store_id": payment["store_id"],
        "merchant_id": payment["merchant_id"],
        "amount": refund_amount,
        "method": method,
        "reason": req.reason or "",
        "issued_by": str(user["_id"]),
        "issued_at": now_iso(),
    }
    await db.pos_refunds.insert_one(refund_doc)
    refund_doc.pop("_id", None)

    new_status = PAYMENT_STATUS_REFUNDED if refund_amount >= float(payment["amount"]) else "partial_refund"
    await db.pos_payments.update_one(
        {"payment_id": payment["payment_id"]},
        {"$set": {"status": new_status}, "$inc": {"refunded_total": refund_amount}},
    )
    await db.pos_shifts.update_one(
        {"shift_id": payment.get("shift_id") or ""},
        {"$inc": {"refund_total": refund_amount}},
    )
    await _audit(str(user["_id"]), "payment.refund", {"payment_id": payment["payment_id"], "amount": refund_amount})
    return {"ok": True, "refund": refund_doc, "new_status": new_status}


# ───────────────────────────────────────────────────────────────────────
# 6. RECEIPTS
# ───────────────────────────────────────────────────────────────────────
def _build_receipt_html(sale: dict, merchant: dict, store: dict) -> str:
    rows = "".join(
        f"<tr><td>{i['quantity']:g} × {i['name']}</td>"
        f"<td style='text-align:right'>€{i['line_total']:.2f}</td></tr>"
        for i in sale["items"]
    )
    return f"""
    <html><head><meta charset='utf-8'><title>Receipt {sale['receipt_id']}</title>
    <style>body{{font-family:monospace;max-width:340px;margin:auto;padding:12px}}
    h2{{text-align:center;margin:4px 0}}td{{padding:2px 0;font-size:12px}}
    .line{{border-top:1px dashed #000;margin:6px 0}}</style></head>
    <body>
    <h2>{merchant.get('business_name', 'BidBlitz POS')}</h2>
    <p style='text-align:center;font-size:11px'>{store.get('name','')} · {store.get('address','')}<br/>
    {store.get('city','')} · {store.get('country','')}</p>
    <div class='line'></div>
    <p style='font-size:11px'>Beleg: {sale['receipt_id']}<br/>
    Datum: {sale['created_at'][:19].replace('T',' ')}<br/>
    Kasse: {sale['register_id']} · Kassierer: {sale['cashier_id'][:6]}</p>
    <div class='line'></div>
    <table style='width:100%'>{rows}</table>
    <div class='line'></div>
    <p>Zwischensumme: <span style='float:right'>€{sale['subtotal']:.2f}</span></p>
    <p>Rabatt: <span style='float:right'>−€{sale['discount']:.2f}</span></p>
    <p>MwSt: <span style='float:right'>€{sale['tax_total']:.2f}</span></p>
    <h3>Gesamt: <span style='float:right'>€{sale['total']:.2f}</span></h3>
    <p style='font-size:11px'>Zahlung: {sale['method']}<br/>Ref: {sale['payment_id']}</p>
    <div class='line'></div>
    <p style='text-align:center;font-size:10px'>Vielen Dank!<br/>Powered by BidBlitz</p>
    </body></html>
    """


@router.get("/receipts/{receipt_id}")
async def get_receipt(receipt_id: str, request: Request):
    user = await get_current_user(request)
    sale = await db.pos_sales.find_one({"receipt_id": receipt_id}, {"_id": 0})
    if not sale:
        raise HTTPException(status_code=404, detail="Beleg nicht gefunden")
    if sale.get("customer_id") != str(user["_id"]):
        await _require_store_access(user, sale["store_id"])
    merchant = await db.pos_merchants.find_one({"merchant_id": sale["merchant_id"]}, {"_id": 0}) or {}
    store = await db.pos_stores.find_one({"store_id": sale["store_id"]}, {"_id": 0}) or {}
    return {"sale": sale, "merchant": merchant, "store": store}


@router.get("/receipts/{receipt_id}/pdf")
async def get_receipt_pdf(receipt_id: str, request: Request):
    user = await get_current_user(request)
    sale = await db.pos_sales.find_one({"receipt_id": receipt_id})
    if not sale:
        raise HTTPException(status_code=404, detail="Beleg nicht gefunden")
    if sale.get("customer_id") != str(user["_id"]):
        await _require_store_access(user, sale["store_id"])
    merchant = await db.pos_merchants.find_one({"merchant_id": sale["merchant_id"]}) or {}
    store = await db.pos_stores.find_one({"store_id": sale["store_id"]}) or {}

    # Lightweight PDF via fpdf2 (already in requirements via pos_payments)
    try:
        from fpdf import FPDF
    except ImportError:
        # Fall back to HTML
        html = _build_receipt_html(sale, merchant, store)
        return StreamingResponse(io.BytesIO(html.encode()), media_type="text/html")

    pdf = FPDF(unit="mm", format=(80, 200))
    pdf.add_page()
    pdf.set_font("Helvetica", "B", 12)
    pdf.cell(0, 6, merchant.get("business_name", "BidBlitz POS"), ln=1, align="C")
    pdf.set_font("Helvetica", "", 8)
    pdf.cell(0, 4, f"{store.get('name','')} - {store.get('city','')}", ln=1, align="C")
    pdf.cell(0, 4, f"Beleg: {sale['receipt_id']}", ln=1)
    pdf.cell(0, 4, sale["created_at"][:19].replace("T", " "), ln=1)
    pdf.cell(0, 2, "-" * 50, ln=1)
    for it in sale["items"]:
        name = (it["name"] or "")[:20].replace("—", "-").replace("–", "-")
        pdf.cell(50, 4, f"{it['quantity']:g} x {name}")
        pdf.cell(0, 4, f"EUR {it['line_total']:.2f}", ln=1, align="R")
    pdf.cell(0, 2, "-" * 50, ln=1)
    pdf.cell(50, 4, "Zwischensumme")
    pdf.cell(0, 4, f"EUR {sale['subtotal']:.2f}", ln=1, align="R")
    pdf.cell(50, 4, "MwSt")
    pdf.cell(0, 4, f"EUR {sale['tax_total']:.2f}", ln=1, align="R")
    pdf.set_font("Helvetica", "B", 11)
    pdf.cell(50, 6, "Gesamt")
    pdf.cell(0, 6, f"EUR {sale['total']:.2f}", ln=1, align="R")
    pdf.set_font("Helvetica", "", 8)
    pdf.cell(0, 4, f"Zahlung: {sale['method']}", ln=1)
    pdf.cell(0, 4, f"Ref: {sale['payment_id']}", ln=1)
    pdf.cell(0, 6, "Powered by BidBlitz", ln=1, align="C")

    buf = io.BytesIO()
    pdf.output(buf)
    buf.seek(0)
    return StreamingResponse(
        buf, media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{receipt_id}.pdf"'},
    )


# ───────────────────────────────────────────────────────────────────────
# 7. MERCHANT DASHBOARD
# ───────────────────────────────────────────────────────────────────────
@router.get("/dashboard/summary")
async def merchant_dashboard(request: Request, period: str = "today"):
    user = await get_current_user(request)
    merchant = await _require_merchant(user)
    now = datetime.now(timezone.utc)
    if period == "today":
        start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    elif period == "7d":
        start = now - timedelta(days=7)
    elif period == "30d":
        start = now - timedelta(days=30)
    else:
        start = now - timedelta(days=365)
    start_iso = start.isoformat()

    sales = await db.pos_sales.find(
        {"merchant_id": merchant["merchant_id"], "created_at": {"$gte": start_iso}, "status": "completed"},
        {"_id": 0},
    ).to_list(5000)

    by_store: Dict[str, float] = {}
    by_register: Dict[str, float] = {}
    by_cashier: Dict[str, float] = {}
    by_method: Dict[str, float] = {}
    total = 0.0
    for s in sales:
        total += s["total"]
        by_store[s["store_id"]] = by_store.get(s["store_id"], 0) + s["total"]
        by_register[s["register_id"]] = by_register.get(s["register_id"], 0) + s["total"]
        by_cashier[s["cashier_id"]] = by_cashier.get(s["cashier_id"], 0) + s["total"]
        by_method[s["method"]] = by_method.get(s["method"], 0) + s["total"]

    refunds = await db.pos_refunds.find(
        {"merchant_id": merchant["merchant_id"], "issued_at": {"$gte": start_iso}}, {"_id": 0},
    ).to_list(2000)
    refund_total = sum(r["amount"] for r in refunds)

    return {
        "period": period,
        "merchant": {
            "merchant_id": merchant["merchant_id"],
            "business_name": merchant["business_name"],
            "settlement_balance": merchant.get("settlement_balance", 0),
            "fee_rate": merchant.get("fee_rate", DEFAULT_MERCHANT_FEE),
            "status": merchant.get("status"),
        },
        "totals": {
            "sales_count": len(sales),
            "sales_total": round(total, 2),
            "refund_count": len(refunds),
            "refund_total": round(refund_total, 2),
            "net": round(total - refund_total, 2),
        },
        "by_store": [{"store_id": k, "amount": round(v, 2)} for k, v in by_store.items()],
        "by_register": [{"register_id": k, "amount": round(v, 2)} for k, v in by_register.items()],
        "by_cashier": [{"cashier_id": k, "amount": round(v, 2)} for k, v in by_cashier.items()],
        "by_method": [{"method": k, "amount": round(v, 2)} for k, v in by_method.items()],
    }


@router.get("/sales")
async def list_sales(request: Request, store_id: Optional[str] = None,
                     register_id: Optional[str] = None, limit: int = 100):
    user = await get_current_user(request)
    merchant = await _require_merchant(user)
    q: Dict[str, Any] = {"merchant_id": merchant["merchant_id"]}
    if store_id:
        q["store_id"] = store_id
    if register_id:
        q["register_id"] = register_id
    sales = await db.pos_sales.find(q, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    return {"sales": sales, "count": len(sales)}


# ───────────────────────────────────────────────────────────────────────
# 8. ADMIN  (BidBlitz platform admin)
# ───────────────────────────────────────────────────────────────────────
@router.get("/admin/merchants")
async def admin_list_merchants(request: Request, status: Optional[str] = None):
    user = await get_current_user(request)
    if not await _is_admin(user):
        raise HTTPException(status_code=403, detail="Nur Admin")
    q = {}
    if status:
        q["status"] = status
    merchants = await db.pos_merchants.find(q, {"_id": 0}).sort("created_at", -1).to_list(500)
    return {"merchants": merchants}


@router.post("/admin/merchants/{merchant_id}/approve")
async def admin_approve_merchant(merchant_id: str, request: Request):
    user = await get_current_user(request)
    if not await _is_admin(user):
        raise HTTPException(status_code=403, detail="Nur Admin")
    res = await db.pos_merchants.update_one(
        {"merchant_id": merchant_id}, {"$set": {"status": "approved", "approved_at": now_iso()}}
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Merchant nicht gefunden")
    await _audit(str(user["_id"]), "admin.merchant.approve", {"merchant_id": merchant_id})
    return {"ok": True}


@router.post("/admin/merchants/{merchant_id}/suspend")
async def admin_suspend_merchant(merchant_id: str, request: Request):
    user = await get_current_user(request)
    if not await _is_admin(user):
        raise HTTPException(status_code=403, detail="Nur Admin")
    await db.pos_merchants.update_one(
        {"merchant_id": merchant_id}, {"$set": {"status": "suspended", "suspended_at": now_iso()}}
    )
    await _audit(str(user["_id"]), "admin.merchant.suspend", {"merchant_id": merchant_id})
    return {"ok": True}


class FeeUpdate(BaseModel):
    fee_rate: float = Field(..., ge=0, le=0.2)


@router.post("/admin/merchants/{merchant_id}/fee")
async def admin_set_fee(merchant_id: str, req: FeeUpdate, request: Request):
    user = await get_current_user(request)
    if not await _is_admin(user):
        raise HTTPException(status_code=403, detail="Nur Admin")
    await db.pos_merchants.update_one(
        {"merchant_id": merchant_id}, {"$set": {"fee_rate": req.fee_rate}}
    )
    await _audit(str(user["_id"]), "admin.fee.update", {"merchant_id": merchant_id, "fee": req.fee_rate})
    return {"ok": True}


@router.get("/admin/transactions")
async def admin_transactions(request: Request, merchant_id: Optional[str] = None, limit: int = 200):
    user = await get_current_user(request)
    if not await _is_admin(user):
        raise HTTPException(status_code=403, detail="Nur Admin")
    q = {}
    if merchant_id:
        q["merchant_id"] = merchant_id
    sales = await db.pos_sales.find(q, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    return {"sales": sales}


@router.get("/admin/overview")
async def admin_overview(request: Request):
    user = await get_current_user(request)
    if not await _is_admin(user):
        raise HTTPException(status_code=403, detail="Nur Admin")
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    sales_today = await db.pos_sales.find({"created_at": {"$gte": today}}, {"_id": 0, "total": 1, "fee": 1}).to_list(10000)
    return {
        "merchants": await db.pos_merchants.count_documents({}),
        "merchants_pending": await db.pos_merchants.count_documents({"status": "pending"}),
        "merchants_approved": await db.pos_merchants.count_documents({"status": "approved"}),
        "stores": await db.pos_stores.count_documents({}),
        "registers": await db.pos_registers.count_documents({}),
        "sales_today": len(sales_today),
        "volume_today": round(sum(s["total"] for s in sales_today), 2),
        "fees_today": round(sum(s.get("fee", 0) for s in sales_today), 2),
    }


# ───────────────────────────────────────────────────────────────────────
# 9. AUDIT LOG (visible to merchant_admin + admin)
# ───────────────────────────────────────────────────────────────────────
@router.get("/audit-log")
async def get_audit_log(request: Request, limit: int = 100):
    user = await get_current_user(request)
    user_id = str(user["_id"])
    q = {}
    if not await _is_admin(user):
        merchant = await db.pos_merchants.find_one({"owner_id": user_id})
        if not merchant:
            return {"log": []}
        # Match audits where actor belongs to merchant or system
        store_ids = [s["store_id"] async for s in db.pos_stores.find({"merchant_id": merchant["merchant_id"]}, {"store_id": 1})]
        q["$or"] = [
            {"actor_id": user_id},
            {"ref.store_id": {"$in": store_ids}},
            {"ref.merchant_id": merchant["merchant_id"]},
        ]
    log = await db.pos_audit_log.find(q, {"_id": 0}).sort("ts", -1).limit(limit).to_list(limit)
    return {"log": log}
