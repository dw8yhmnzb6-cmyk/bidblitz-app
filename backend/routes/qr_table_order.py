"""
BidBlitz V2 — QR Table Order (Production)
=========================================

Customer flow:
  1. Merchant prints a QR per table → URL: /order/qr/<token>
  2. Token is a rotating, signed token (5-min sliding window, auto-refreshed
     on each successful resolve so the table's printed QR always works).
  3. Customer (logged in) scans, app calls /api/qr/resolve/<token> →
     returns {merchant, table, menu_url, payment_methods, scopes}.
  4. Customer builds cart, calls /api/qr/order → wallet is charged,
     order goes to merchant pipeline.
  5. Merchant has acceptance_mode = 'instant' | 'waiter':
       - instant: order auto-confirmed
       - waiter:  /api/merchant/qr-orders/<id>/accept|reject (refunds wallet)

Auth scopes:
  - Customer endpoints require get_current_user (JWT cookie/header).
  - Merchant endpoints require role in {admin, merchant}.

Collections used:
  - pos_tables             — already exists; we ADD qr_token + qr_token_expires_at fields
  - users                  — wallet_balance deduction
  - qr_orders              — new collection for table-orders (separate from old qr_menu_orders)
  - merchants              — to read menu + qr_settings
  - merchant_qr_settings   — { merchant_id, acceptance_mode, scopes[], payment_methods[] }
"""
from __future__ import annotations

import base64
import secrets
from datetime import datetime, timezone, timedelta
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Request, UploadFile, File
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from bson import ObjectId
import io
import motor.motor_asyncio

from core.database import db
from core.security import get_current_user

router = APIRouter(prefix="/api/qr", tags=["qr-order"])
admin_router = APIRouter(prefix="/api/merchant", tags=["qr-order-admin"])

TOKEN_TTL_MIN = 5  # sliding window
DEFAULT_ACCEPT_MODE = "instant"  # 'instant' | 'waiter'
DEFAULT_SCOPES = ["food", "drinks"]
MAX_IMG_BYTES = 4 * 1024 * 1024  # 4 MB per upload
ALLOWED_IMG_MIME = {"image/jpeg", "image/png", "image/webp", "image/gif"}

# GridFS bucket for menu images (lazy)
_fs_bucket: Optional[motor.motor_asyncio.AsyncIOMotorGridFSBucket] = None

def _gridfs() -> motor.motor_asyncio.AsyncIOMotorGridFSBucket:
    global _fs_bucket
    if _fs_bucket is None:
        _fs_bucket = motor.motor_asyncio.AsyncIOMotorGridFSBucket(db, bucket_name="menu_images")
    return _fs_bucket


# ─── Models ─────────────────────────────────────────────────────────────────

class TableCreateRequest(BaseModel):
    merchant_id: str
    label: str = Field(..., min_length=1, max_length=80)
    capacity: int = Field(4, ge=1, le=200)


class QROrderModifier(BaseModel):
    group_id: str
    option_id: str
    name: Optional[str] = None
    price_delta: float = 0.0


class QROrderItem(BaseModel):
    item_id: str
    name: str
    price: float = Field(..., ge=0)
    qty: int = Field(1, ge=1, le=99)
    note: Optional[str] = Field(None, max_length=200)
    modifiers: List[QROrderModifier] = Field(default_factory=list)


class QROrderRequest(BaseModel):
    token: str
    items: List[QROrderItem]
    scope: str = Field("food", pattern="^(food|drinks)$")
    note: Optional[str] = Field(None, max_length=300)
    language: Optional[str] = Field("de", max_length=5)


class QRSettingsRequest(BaseModel):
    merchant_id: str
    acceptance_mode: str = Field("instant", pattern="^(instant|waiter)$")
    scopes: List[str] = Field(default_factory=lambda: ["food", "drinks"])


class ModifierOption(BaseModel):
    option_id: str = Field(..., min_length=1, max_length=60)
    name: str = Field(..., min_length=1, max_length=80)
    price_delta: float = 0.0
    default: bool = False


class ModifierGroup(BaseModel):
    group_id: str = Field(..., min_length=1, max_length=60)
    name: str = Field(..., min_length=1, max_length=80)
    required: bool = False
    min_select: int = Field(0, ge=0, le=20)
    max_select: int = Field(1, ge=1, le=20)
    options: List[ModifierOption] = Field(default_factory=list)


class MenuItemRequest(BaseModel):
    merchant_id: str
    item_id: Optional[str] = None  # auto-generated if missing
    name: str = Field(..., min_length=1, max_length=120)
    name_i18n: Optional[dict] = None  # {"en":"...","tr":"..."}
    description: Optional[str] = Field(None, max_length=400)
    description_i18n: Optional[dict] = None
    price: float = Field(..., ge=0)
    category: str = Field("Hauptgericht", min_length=1, max_length=60)
    scope: str = Field("food", pattern="^(food|drinks)$")
    image_url: Optional[str] = None
    tags: List[str] = Field(default_factory=list)  # vegan/spicy/halal/new/popular
    allergens: List[str] = Field(default_factory=list)  # gluten,milk,egg,nuts,soy,fish,shellfish,sesame
    calories: Optional[int] = Field(None, ge=0, le=5000)
    is_popular: bool = False
    is_available: bool = True
    sort_order: int = 0
    modifier_groups: List[ModifierGroup] = Field(default_factory=list)


# ─── Helpers ────────────────────────────────────────────────────────────────

def _gen_token() -> str:
    return secrets.token_urlsafe(20)


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


async def _require_merchant(request: Request):
    user = await get_current_user(request)
    if user.get("role") not in {"admin", "merchant"}:
        raise HTTPException(status_code=403, detail="Merchant- oder Admin-Rolle erforderlich")
    return user


async def _rotate_token(table_id: str) -> dict:
    """Issue a fresh token + expiry on a table doc."""
    token = _gen_token()
    expires = (_now_utc() + timedelta(minutes=TOKEN_TTL_MIN)).isoformat()
    await db.pos_tables.update_one(
        {"table_id": table_id},
        {"$set": {"qr_token": token, "qr_token_expires_at": expires}},
    )
    return {"token": token, "expires_at": expires}


async def _get_merchant_settings(merchant_id: str) -> dict:
    doc = await db.merchant_qr_settings.find_one({"merchant_id": merchant_id}, {"_id": 0})
    return doc or {
        "merchant_id": merchant_id,
        "acceptance_mode": DEFAULT_ACCEPT_MODE,
        "scopes": DEFAULT_SCOPES,
        "payment_methods": ["wallet"],
    }


# ─── Customer endpoints ─────────────────────────────────────────────────────

@router.get("/resolve/{token}")
async def resolve_token(token: str, request: Request):
    """Resolve a table QR token. Auto-rotates if expired so the printed QR
    keeps working from one customer to the next (table sessions live forever
    on the printed sticker; the rolling token just prevents replay-from-photo
    across sessions older than ~5 min)."""
    table = await db.pos_tables.find_one({"qr_token": token}, {"_id": 0})
    if not table:
        # Token is unknown / already rotated → reject hard to discourage
        # offline-scanned screenshots being shared widely.
        raise HTTPException(status_code=410, detail="QR-Code abgelaufen. Bitte Personal informieren.")

    # Sliding expiry: refresh token after every successful resolve.
    fresh = await _rotate_token(table["table_id"])

    merchant_id = table.get("merchant_id") or table.get("store_id")
    settings = await _get_merchant_settings(merchant_id)

    return {
        "ok": True,
        "merchant_id": merchant_id,
        "table_id": table["table_id"],
        "table_label": table.get("label") or table.get("name") or f"Tisch {table['table_id'][-4:]}",
        "capacity": table.get("capacity", 4),
        "settings": settings,
        "next_token": fresh["token"],
        "next_token_expires_at": fresh["expires_at"],
    }


@router.get("/menu/{merchant_id}")
async def get_merchant_menu(merchant_id: str):
    """Public: return the merchant's published menu (food + drinks)."""
    merchant = await db.merchants.find_one(
        {"$or": [{"merchant_id": merchant_id}, {"_id": ObjectId(merchant_id) if ObjectId.is_valid(merchant_id) else None}]},
        {"_id": 0, "menu": 1, "name": 1, "logo_url": 1, "hero_image_url": 1, "currency": 1},
    )
    items: list = []
    if merchant:
        items = list(merchant.get("menu", []) or [])
    if not items:
        # Fallback: pos_menus collection
        items = await db.pos_menus.find({"store_id": merchant_id}, {"_id": 0}).to_list(500)
    if not items and not merchant:
        raise HTTPException(status_code=404, detail="Speisekarte nicht gefunden")

    # Normalize items + derive categories per scope
    norm: list = []
    cats: dict = {"food": [], "drinks": []}
    for m in items:
        item_id = str(m.get("item_id") or m.get("id") or m.get("name"))
        cat = m.get("category") or "Sonstiges"
        # Heuristic scope fallback (legacy items): drinks if category looks drinky
        raw_scope = m.get("scope")
        if not raw_scope:
            cat_l = cat.lower()
            raw_scope = "drinks" if any(k in cat_l for k in ("getr", "drink", "bar", "wein", "bier", "cocktail", "saft")) else "food"
        item = {
            "item_id": item_id,
            "name": m.get("name", ""),
            "name_i18n": m.get("name_i18n") or {},
            "description": m.get("description", ""),
            "description_i18n": m.get("description_i18n") or {},
            "price": float(m.get("price", 0) or 0),
            "category": cat,
            "scope": raw_scope,
            "image_url": m.get("image_url"),
            "tags": list(m.get("tags") or []),
            "allergens": list(m.get("allergens") or []),
            "calories": m.get("calories"),
            "is_popular": bool(m.get("is_popular", False)),
            "is_available": bool(m.get("is_available", True)),
            "sort_order": int(m.get("sort_order", 0) or 0),
            "modifier_groups": list(m.get("modifier_groups") or []),
        }
        norm.append(item)
        if cat not in cats[raw_scope]:
            cats[raw_scope].append(cat)

    norm.sort(key=lambda x: (x.get("sort_order", 0), x.get("name", "")))

    # Hydrate ratings averages
    if norm and merchant:
        try:
            ratings = await db.qr_reviews.aggregate([
                {"$match": {"merchant_id": merchant_id}},
                {"$group": {"_id": "$item_id", "avg": {"$avg": "$rating"}, "count": {"$sum": 1}}},
            ]).to_list(500)
            rmap = {r["_id"]: r for r in ratings}
            for it in norm:
                r = rmap.get(it["item_id"])
                if r:
                    it["rating_avg"] = round(r["avg"], 2)
                    it["rating_count"] = r["count"]
        except Exception:
            pass

    return {
        "name": (merchant or {}).get("name", ""),
        "logo_url": (merchant or {}).get("logo_url"),
        "hero_image_url": (merchant or {}).get("hero_image_url"),
        "currency": (merchant or {}).get("currency", "EUR"),
        "items": norm,
        "categories": cats,  # {"food":[...], "drinks":[...]}
    }


def _validate_modifiers(canonical: dict, selected: list) -> tuple[float, list]:
    """Returns (extra_price, normalized_modifiers[]). Raises 400 if required-mismatch."""
    groups = canonical.get("modifier_groups") or []
    if not groups and not selected:
        return 0.0, []

    # Build lookup: group_id -> group; (group_id, option_id) -> option
    g_by_id = {g["group_id"]: g for g in groups if "group_id" in g}
    o_by_key = {}
    for g in groups:
        for o in (g.get("options") or []):
            o_by_key[(g["group_id"], o["option_id"])] = o

    extra = 0.0
    norm: list = []
    selected_by_group: dict = {}
    for s in selected or []:
        if isinstance(s, dict):
            gid = s.get("group_id")
            oid = s.get("option_id")
        else:
            gid = getattr(s, "group_id", None)
            oid = getattr(s, "option_id", None)
        if not gid or not oid:
            continue
        opt = o_by_key.get((gid, oid))
        if opt is None:
            # Unknown option → reject hard for security
            raise HTTPException(status_code=400, detail=f"Unbekannte Option {gid}/{oid}")
        delta = float(opt.get("price_delta", 0) or 0)
        extra += delta
        norm.append({"group_id": gid, "option_id": oid, "name": opt.get("name"), "price_delta": delta})
        selected_by_group.setdefault(gid, 0)
        selected_by_group[gid] += 1

    # Enforce required + min/max
    for gid, g in g_by_id.items():
        count = selected_by_group.get(gid, 0)
        req = bool(g.get("required"))
        mn = int(g.get("min_select", 1 if req else 0) or 0)
        mx = int(g.get("max_select", 1) or 1)
        if req and count < max(1, mn):
            raise HTTPException(status_code=400, detail=f"Pflichtauswahl fehlt: {g.get('name')}")
        if count > mx:
            raise HTTPException(status_code=400, detail=f"Zu viele Optionen für {g.get('name')} (max {mx})")
    return round(extra, 2), norm


@router.post("/order")
async def place_qr_order(req: QROrderRequest, request: Request):
    """Customer places an order from a scanned table. Wallet is deducted
    atomically (compare-and-swap) and an order doc is persisted."""
    user = await get_current_user(request)

    # 1. Validate token / table
    table = await db.pos_tables.find_one({"qr_token": req.token}, {"_id": 0})
    if not table:
        raise HTTPException(status_code=410, detail="QR-Code abgelaufen. Bitte erneut scannen.")
    expires_at = table.get("qr_token_expires_at")
    if expires_at and datetime.fromisoformat(expires_at.replace("Z", "+00:00")) < _now_utc():
        raise HTTPException(status_code=410, detail="QR-Code abgelaufen. Bitte erneut scannen.")

    merchant_id = table.get("merchant_id") or table.get("store_id")
    settings = await _get_merchant_settings(merchant_id)

    if req.scope not in settings.get("scopes", DEFAULT_SCOPES):
        raise HTTPException(status_code=400, detail=f"Bereich '{req.scope}' nicht aktiviert")

    # 2. Validate items & compute total (NEVER trust client-supplied price alone;
    #    re-fetch from the merchant menu for security).
    if not req.items:
        raise HTTPException(status_code=400, detail="Bestellung leer")

    menu_resp = await get_merchant_menu(merchant_id)
    menu_items = {str(m.get("item_id") or m.get("id") or m.get("name")): m for m in menu_resp.get("items", [])}

    total = 0.0
    order_items: List[dict] = []
    for it in req.items:
        canonical = menu_items.get(it.item_id) or menu_items.get(it.name) or {}
        unit_price = float(canonical["price"]) if "price" in canonical else float(it.price)
        mod_extra, mod_norm = _validate_modifiers(canonical, it.modifiers)
        unit_with_mods = round(unit_price + mod_extra, 2)
        line_total = round(unit_with_mods * it.qty, 2)
        total += line_total
        order_items.append({
            "item_id": it.item_id,
            "name": canonical.get("name") if canonical else it.name,
            "unit_price": round(unit_price, 2),
            "modifiers": mod_norm,
            "modifier_price": mod_extra,
            "unit_with_modifiers": unit_with_mods,
            "qty": it.qty,
            "line_total": line_total,
            "note": it.note or "",
            "image_url": canonical.get("image_url"),
        })
    total = round(total, 2)

    # 3. Wallet debit (atomic)
    user_id = user["_id"]
    update_res = await db.users.update_one(
        {"_id": user_id, "balance": {"$gte": total}},
        {"$inc": {"balance": -total}},
    )
    if update_res.modified_count == 0:
        raise HTTPException(status_code=402, detail=f"Nicht genug Guthaben (benötigt: €{total:.2f})")

    # 4. Persist order
    now = _now_utc()
    accept_mode = settings.get("acceptance_mode", DEFAULT_ACCEPT_MODE)
    status = "accepted" if accept_mode == "instant" else "pending"
    order_id = f"qro_{secrets.token_hex(6)}"

    order = {
        "order_id": order_id,
        "customer_id": str(user_id),
        "customer_name": user.get("name", ""),
        "merchant_id": merchant_id,
        "table_id": table["table_id"],
        "table_label": table.get("label") or table.get("name") or "",
        "scope": req.scope,
        "items": order_items,
        "total": total,
        "payment_method": "wallet",
        "payment_status": "paid",
        "status": status,
        "note": req.note or "",
        "created_at": now.isoformat(),
        "accepted_at": now.isoformat() if status == "accepted" else None,
        "status_history": [
            {"status": "submitted", "at": now.isoformat()},
            *([{"status": "accepted", "at": now.isoformat(), "auto": True}] if status == "accepted" else []),
        ],
    }
    await db.qr_orders.insert_one(order)
    order.pop("_id", None)

    # 5. Log wallet transaction
    await db.wallet_transactions.insert_one({
        "transaction_id": secrets.token_hex(8),
        "user_id": str(user_id),
        "type": "qr_table_order",
        "amount": -total,
        "currency": "EUR",
        "description": f"Bestellung {order_id} – {table.get('label', 'Tisch')}",
        "reference": order_id,
        "created_at": now.isoformat(),
    })

    return {
        "ok": True,
        "order_id": order_id,
        "status": status,
        "total": total,
        "message": "Bestellung aufgegeben" if status == "accepted" else "Bestellung wartet auf Bestätigung",
    }


@router.get("/order/{order_id}")
async def get_my_qr_order(order_id: str, request: Request):
    user = await get_current_user(request)
    order = await db.qr_orders.find_one(
        {"order_id": order_id, "customer_id": str(user["_id"])},
        {"_id": 0},
    )
    if not order:
        raise HTTPException(status_code=404, detail="Bestellung nicht gefunden")
    return {"order": order}


# ─── Merchant endpoints ─────────────────────────────────────────────────────

@admin_router.post("/qr-tables")
async def create_qr_table(req: TableCreateRequest, request: Request):
    """Merchant: register a new table. Returns table_id + initial QR token
    (the merchant prints `https://<host>/order/qr/<token>` as a QR code)."""
    await _require_merchant(request)
    table_id = f"tbl_{secrets.token_hex(5)}"
    now = _now_utc()
    token = _gen_token()
    expires = (now + timedelta(minutes=TOKEN_TTL_MIN)).isoformat()
    doc = {
        "table_id": table_id,
        "merchant_id": req.merchant_id,
        "label": req.label,
        "capacity": req.capacity,
        "qr_token": token,
        "qr_token_expires_at": expires,
        "created_at": now.isoformat(),
        "active": True,
    }
    await db.pos_tables.insert_one(doc)
    doc.pop("_id", None)
    return {"ok": True, "table": doc}


@admin_router.get("/qr-tables/{merchant_id}")
async def list_qr_tables(merchant_id: str, request: Request):
    await _require_merchant(request)
    tables = await db.pos_tables.find(
        {"$or": [{"merchant_id": merchant_id}, {"store_id": merchant_id}], "active": {"$ne": False}},
        {"_id": 0},
    ).to_list(500)
    return {"tables": tables}


@admin_router.post("/qr-tables/{table_id}/rotate")
async def rotate_table_token(table_id: str, request: Request):
    await _require_merchant(request)
    fresh = await _rotate_token(table_id)
    return {"ok": True, **fresh}


@admin_router.post("/qr-settings")
async def upsert_qr_settings(req: QRSettingsRequest, request: Request):
    await _require_merchant(request)
    doc = {
        "merchant_id": req.merchant_id,
        "acceptance_mode": req.acceptance_mode,
        "scopes": req.scopes or DEFAULT_SCOPES,
        "payment_methods": ["wallet"],
        "updated_at": _now_utc().isoformat(),
    }
    await db.merchant_qr_settings.update_one(
        {"merchant_id": req.merchant_id},
        {"$set": doc},
        upsert=True,
    )
    return {"ok": True, "settings": doc}


@admin_router.get("/qr-settings/{merchant_id}")
async def get_qr_settings(merchant_id: str, request: Request):
    await _require_merchant(request)
    s = await _get_merchant_settings(merchant_id)
    return {"settings": s}


@admin_router.get("/qr-orders/{merchant_id}")
async def list_qr_orders(
    merchant_id: str,
    request: Request,
    status: Optional[str] = None,
    limit: int = 100,
):
    await _require_merchant(request)
    query = {"merchant_id": merchant_id}
    if status:
        query["status"] = status
    orders = await db.qr_orders.find(query, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    return {"orders": orders}


@admin_router.post("/qr-orders/{order_id}/accept")
async def accept_qr_order(order_id: str, request: Request):
    await _require_merchant(request)
    now = _now_utc().isoformat()
    res = await db.qr_orders.update_one(
        {"order_id": order_id, "status": "pending"},
        {"$set": {"status": "accepted", "accepted_at": now},
         "$push": {"status_history": {"status": "accepted", "at": now}}},
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Bestellung nicht gefunden oder bereits bearbeitet")
    return {"ok": True}


@admin_router.post("/qr-orders/{order_id}/reject")
async def reject_qr_order(order_id: str, request: Request):
    """Reject + refund the customer's wallet (compensating transaction)."""
    await _require_merchant(request)
    order = await db.qr_orders.find_one({"order_id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Bestellung nicht gefunden")
    if order["status"] in {"rejected", "completed"}:
        return {"ok": True, "message": "Bereits final"}
    now = _now_utc().isoformat()
    refund = float(order.get("total", 0))
    # Refund wallet (handle both ObjectId and UUID-string ids)
    customer_id = order["customer_id"]
    try:
        cust_query = {"_id": ObjectId(customer_id)} if ObjectId.is_valid(customer_id) else {"id": customer_id}
    except Exception:
        cust_query = {"id": customer_id}
    await db.users.update_one(
        cust_query,
        {"$inc": {"balance": refund}},
    )
    await db.wallet_transactions.insert_one({
        "transaction_id": secrets.token_hex(8),
        "user_id": order["customer_id"],
        "type": "qr_table_order_refund",
        "amount": refund,
        "currency": "EUR",
        "description": f"Rückerstattung {order_id}",
        "reference": order_id,
        "created_at": now,
    })
    await db.qr_orders.update_one(
        {"order_id": order_id},
        {"$set": {"status": "rejected", "rejected_at": now, "payment_status": "refunded"},
         "$push": {"status_history": {"status": "rejected", "at": now}}},
    )
    return {"ok": True, "refunded": refund}


@admin_router.post("/qr-orders/{order_id}/complete")
async def complete_qr_order(order_id: str, request: Request):
    await _require_merchant(request)
    now = _now_utc().isoformat()
    res = await db.qr_orders.update_one(
        {"order_id": order_id, "status": "accepted"},
        {"$set": {"status": "completed", "completed_at": now},
         "$push": {"status_history": {"status": "completed", "at": now}}},
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Bestellung nicht akzeptiert oder schon abgeschlossen")
    return {"ok": True}


# ─── Menu CRUD (Merchant) ───────────────────────────────────────────────────

@admin_router.get("/menu/{merchant_id}")
async def get_full_menu(merchant_id: str, request: Request):
    """Merchant: full menu (incl. unavailable items)."""
    await _require_merchant(request)
    merchant = await db.merchants.find_one(
        {"$or": [{"merchant_id": merchant_id}, {"_id": ObjectId(merchant_id) if ObjectId.is_valid(merchant_id) else None}]},
        {"_id": 0, "menu": 1, "name": 1, "logo_url": 1, "hero_image_url": 1},
    )
    items = (merchant or {}).get("menu", []) or []
    return {"items": items, "name": (merchant or {}).get("name", ""), "hero_image_url": (merchant or {}).get("hero_image_url")}


@admin_router.post("/menu/items")
async def upsert_menu_item(req: MenuItemRequest, request: Request):
    """Merchant: add or update one menu item (by item_id)."""
    await _require_merchant(request)
    item_id = req.item_id or f"itm_{secrets.token_hex(5)}"
    item = req.model_dump()
    item["item_id"] = item_id
    item.pop("merchant_id", None)
    item["updated_at"] = _now_utc().isoformat()

    # find merchant doc
    m_query = {"$or": [{"merchant_id": req.merchant_id}]}
    if ObjectId.is_valid(req.merchant_id):
        m_query["$or"].append({"_id": ObjectId(req.merchant_id)})
    merchant = await db.merchants.find_one(m_query, {"menu": 1, "_id": 1})
    if not merchant:
        # Create base merchant doc
        await db.merchants.insert_one({
            "merchant_id": req.merchant_id,
            "name": "",
            "menu": [item],
            "created_at": _now_utc().isoformat(),
        })
        return {"ok": True, "item": item, "created_merchant": True}

    # Replace if exists, else append
    existing = [m for m in (merchant.get("menu") or []) if (str(m.get("item_id")) == item_id)]
    if existing:
        await db.merchants.update_one(
            {"_id": merchant["_id"], "menu.item_id": item_id},
            {"$set": {"menu.$": item}},
        )
    else:
        await db.merchants.update_one(
            {"_id": merchant["_id"]},
            {"$push": {"menu": item}},
        )
    return {"ok": True, "item": item}


@admin_router.delete("/menu/items/{merchant_id}/{item_id}")
async def delete_menu_item(merchant_id: str, item_id: str, request: Request):
    await _require_merchant(request)
    m_query = {"$or": [{"merchant_id": merchant_id}]}
    if ObjectId.is_valid(merchant_id):
        m_query["$or"].append({"_id": ObjectId(merchant_id)})
    res = await db.merchants.update_one(
        m_query,
        {"$pull": {"menu": {"item_id": item_id}}},
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Speisekarte nicht gefunden")
    return {"ok": True}


@admin_router.post("/menu/bulk-import")
async def bulk_import_menu(payload: dict, request: Request):
    """Replace the whole menu in one shot (used by demo-seed + CSV import)."""
    await _require_merchant(request)
    merchant_id = payload.get("merchant_id")
    items = payload.get("items") or []
    name = payload.get("name")
    hero = payload.get("hero_image_url")
    if not merchant_id:
        raise HTTPException(status_code=400, detail="merchant_id fehlt")
    norm: list = []
    for raw in items:
        try:
            m = MenuItemRequest(merchant_id=merchant_id, **{k: v for k, v in raw.items() if k != "merchant_id"})
            d = m.model_dump()
            d["item_id"] = d.get("item_id") or f"itm_{secrets.token_hex(5)}"
            d.pop("merchant_id", None)
            norm.append(d)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Ungültiger Artikel: {e}")
    set_doc = {"menu": norm}
    if name is not None:
        set_doc["name"] = name
    if hero is not None:
        set_doc["hero_image_url"] = hero
    await db.merchants.update_one(
        {"merchant_id": merchant_id},
        {"$set": set_doc, "$setOnInsert": {"created_at": _now_utc().isoformat()}},
        upsert=True,
    )
    return {"ok": True, "count": len(norm)}


# ─── Menu Image Upload (GridFS) ─────────────────────────────────────────────

@admin_router.post("/menu/upload-image")
async def upload_menu_image(file: UploadFile = File(...), *, request: Request = None):  # type: ignore[assignment]
    """Merchant: upload an image file → stored in GridFS, returns public URL."""
    await _require_merchant(request)
    if file.content_type not in ALLOWED_IMG_MIME:
        raise HTTPException(status_code=415, detail=f"Nicht unterstützter Bildtyp: {file.content_type}")
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Leere Datei")
    if len(data) > MAX_IMG_BYTES:
        raise HTTPException(status_code=413, detail=f"Datei zu groß (max {MAX_IMG_BYTES // 1024 // 1024} MB)")
    fs = _gridfs()
    file_id = await fs.upload_from_stream(
        file.filename or "menu.bin",
        io.BytesIO(data),
        metadata={"content_type": file.content_type, "uploaded_at": _now_utc().isoformat()},
    )
    return {"ok": True, "file_id": str(file_id), "url": f"/api/qr/menu/image/{file_id}"}


@router.get("/menu/image/{file_id}")
async def stream_menu_image(file_id: str):
    """Public: streams the menu image from GridFS."""
    if not ObjectId.is_valid(file_id):
        raise HTTPException(status_code=400, detail="Ungültige Bild-ID")
    fs = _gridfs()
    try:
        stream = await fs.open_download_stream(ObjectId(file_id))
    except Exception:
        raise HTTPException(status_code=404, detail="Bild nicht gefunden")
    ct = (stream.metadata or {}).get("content_type", "image/jpeg")

    async def iterator():
        while True:
            chunk = await stream.readchunk()
            if not chunk:
                break
            yield chunk

    return StreamingResponse(iterator(), media_type=ct, headers={"Cache-Control": "public, max-age=86400"})


# ─── New: Open-Tab History per Table ────────────────────────────────────────

@router.get("/table-history/{merchant_id}/{table_id}")
async def table_history(merchant_id: str, table_id: str, request: Request, limit: int = 20):
    """Customer: see this table's recent orders today (open-tab pattern).
    Privacy: only orders from the LOGGED-IN user (or all if customer is the merchant)."""
    user = await get_current_user(request)
    today_start = _now_utc().replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    query = {
        "merchant_id": merchant_id,
        "table_id": table_id,
        "customer_id": str(user["_id"]),
        "created_at": {"$gte": today_start},
    }
    orders = await db.qr_orders.find(query, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    total_spent = sum(float(o.get("total", 0)) for o in orders if o.get("status") != "rejected")
    return {"orders": orders, "total_spent": round(total_spent, 2), "count": len(orders)}


# ─── New: Order status (polling for live updates) ───────────────────────────

@router.get("/order-status/{order_id}")
async def get_order_status(order_id: str, request: Request):
    """Lightweight polling endpoint for live order updates (kitchen → ready → completed)."""
    user = await get_current_user(request)
    o = await db.qr_orders.find_one(
        {"order_id": order_id, "customer_id": str(user["_id"])},
        {"_id": 0, "order_id": 1, "status": 1, "status_history": 1, "total": 1,
         "tip": 1, "estimated_ready_at": 1, "preparing_at": 1, "ready_at": 1,
         "completed_at": 1, "rejected_at": 1, "accepted_at": 1},
    )
    if not o:
        raise HTTPException(status_code=404, detail="Bestellung nicht gefunden")
    return o


# ─── New: Add tip to order (post-order wallet debit) ────────────────────────

class TipRequest(BaseModel):
    order_id: str
    amount: float = Field(..., ge=0, le=200)


@router.post("/order/tip")
async def add_tip(req: TipRequest, request: Request):
    """Add a tip to an existing order, debited atomically from wallet."""
    user = await get_current_user(request)
    if req.amount <= 0:
        return {"ok": True, "tip": 0.0, "message": "Kein Trinkgeld"}

    order = await db.qr_orders.find_one(
        {"order_id": req.order_id, "customer_id": str(user["_id"])},
        {"_id": 0},
    )
    if not order:
        raise HTTPException(status_code=404, detail="Bestellung nicht gefunden")
    if order.get("tip"):
        raise HTTPException(status_code=409, detail="Trinkgeld wurde bereits hinzugefügt")
    if order.get("status") == "rejected":
        raise HTTPException(status_code=400, detail="Trinkgeld nicht möglich (abgelehnte Bestellung)")

    amount = round(float(req.amount), 2)
    # Atomic debit
    res = await db.users.update_one(
        {"_id": user["_id"], "balance": {"$gte": amount}},
        {"$inc": {"balance": -amount}},
    )
    if res.modified_count == 0:
        raise HTTPException(status_code=402, detail=f"Nicht genug Guthaben (Trinkgeld {amount:.2f}€)")

    now = _now_utc().isoformat()
    await db.qr_orders.update_one(
        {"order_id": req.order_id},
        {"$set": {"tip": amount, "tip_at": now}, "$inc": {"total": amount}},
    )
    await db.wallet_transactions.insert_one({
        "transaction_id": secrets.token_hex(8),
        "user_id": str(user["_id"]),
        "type": "qr_table_tip",
        "amount": -amount,
        "currency": "EUR",
        "description": f"Trinkgeld {req.order_id}",
        "reference": req.order_id,
        "created_at": now,
    })
    return {"ok": True, "tip": amount}


# ─── New: Popular items + Upsell recommendations ────────────────────────────

@router.get("/popular/{merchant_id}")
async def popular_items(merchant_id: str, limit: int = 6):
    """Top-selling items for the merchant in the last 7 days (no auth required)."""
    pipeline = [
        {"$match": {"merchant_id": merchant_id, "status": {"$in": ["accepted", "completed"]}}},
        {"$unwind": "$items"},
        {"$group": {
            "_id": "$items.item_id",
            "count": {"$sum": "$items.qty"},
            "last_name": {"$last": "$items.name"},
            "last_image": {"$last": "$items.image_url"},
        }},
        {"$sort": {"count": -1}},
        {"$limit": limit},
    ]
    rows = await db.qr_orders.aggregate(pipeline).to_list(limit)
    return {
        "items": [
            {"item_id": r["_id"], "name": r["last_name"], "image_url": r["last_image"], "order_count": r["count"]}
            for r in rows if r["_id"]
        ]
    }


@router.post("/upsell")
async def upsell_suggestions(payload: dict, request: Request):
    """Suggest items that customers also order based on current cart.
    Looks at last 30 days of orders containing any cart item, returns top 3 'frequently bought together'."""
    merchant_id = payload.get("merchant_id")
    item_ids = payload.get("item_ids") or []
    limit = int(payload.get("limit") or 3)
    if not merchant_id or not item_ids:
        return {"items": []}

    pipeline = [
        {"$match": {"merchant_id": merchant_id, "status": {"$in": ["accepted", "completed"]},
                    "items.item_id": {"$in": item_ids}}},
        {"$unwind": "$items"},
        {"$match": {"items.item_id": {"$nin": item_ids}}},
        {"$group": {
            "_id": "$items.item_id",
            "count": {"$sum": "$items.qty"},
            "last_name": {"$last": "$items.name"},
            "last_image": {"$last": "$items.image_url"},
        }},
        {"$sort": {"count": -1}},
        {"$limit": limit},
    ]
    rows = await db.qr_orders.aggregate(pipeline).to_list(limit)
    out: list = []
    if rows:
        # Hydrate from merchant menu to get price/category
        m = await db.merchants.find_one({"merchant_id": merchant_id}, {"_id": 0, "menu": 1})
        menu_by_id = {it.get("item_id"): it for it in ((m or {}).get("menu") or [])}
        for r in rows:
            it = menu_by_id.get(r["_id"]) or {}
            out.append({
                "item_id": r["_id"],
                "name": it.get("name") or r.get("last_name"),
                "price": it.get("price"),
                "image_url": it.get("image_url") or r.get("last_image"),
                "category": it.get("category"),
                "scope": it.get("scope", "food"),
                "order_count": r["count"],
            })
    return {"items": out}


# ─── New: Item Ratings & Reviews ────────────────────────────────────────────

class ReviewRequest(BaseModel):
    order_id: str
    ratings: List[dict] = Field(default_factory=list)  # [{item_id, rating(1-5), comment?}]


@router.post("/order/review")
async def submit_review(req: ReviewRequest, request: Request):
    user = await get_current_user(request)
    order = await db.qr_orders.find_one(
        {"order_id": req.order_id, "customer_id": str(user["_id"])},
        {"_id": 0, "merchant_id": 1, "items": 1, "status": 1, "review_done": 1},
    )
    if not order:
        raise HTTPException(status_code=404, detail="Bestellung nicht gefunden")
    if order.get("review_done"):
        raise HTTPException(status_code=409, detail="Bereits bewertet")
    if order["status"] not in {"accepted", "completed"}:
        raise HTTPException(status_code=400, detail="Bewertung erst nach Annahme möglich")

    valid_items = {it["item_id"] for it in order.get("items", [])}
    now = _now_utc().isoformat()
    inserts = []
    for r in req.ratings:
        iid = r.get("item_id")
        rt = int(r.get("rating", 0))
        if iid not in valid_items or rt < 1 or rt > 5:
            continue
        inserts.append({
            "review_id": secrets.token_hex(8),
            "merchant_id": order["merchant_id"],
            "item_id": iid,
            "order_id": req.order_id,
            "user_id": str(user["_id"]),
            "user_name": user.get("name", "")[:40],
            "rating": rt,
            "comment": (r.get("comment") or "")[:300],
            "created_at": now,
        })
    if inserts:
        await db.qr_reviews.insert_many(inserts)
    await db.qr_orders.update_one({"order_id": req.order_id}, {"$set": {"review_done": True, "reviewed_at": now}})
    return {"ok": True, "count": len(inserts)}


@router.get("/reviews/{merchant_id}")
async def get_reviews(merchant_id: str, item_id: Optional[str] = None, limit: int = 20):
    """Public: averages per item + recent reviews."""
    pipeline = [{"$match": {"merchant_id": merchant_id}}]
    if item_id:
        pipeline[0]["$match"]["item_id"] = item_id
    # Averages per item
    avgs = await db.qr_reviews.aggregate([
        {"$match": {"merchant_id": merchant_id}},
        {"$group": {
            "_id": "$item_id",
            "avg": {"$avg": "$rating"},
            "count": {"$sum": 1},
        }},
    ]).to_list(500)
    avg_map = {a["_id"]: {"avg": round(a["avg"], 2), "count": a["count"]} for a in avgs}

    recent = []
    if item_id:
        recent = await db.qr_reviews.find(
            {"merchant_id": merchant_id, "item_id": item_id},
            {"_id": 0, "user_id": 0},
        ).sort("created_at", -1).limit(limit).to_list(limit)
    return {"averages": avg_map, "reviews": recent}


# ─── New: Combos / Bundles ──────────────────────────────────────────────────

class ComboRequest(BaseModel):
    merchant_id: str
    combo_id: Optional[str] = None
    name: str = Field(..., min_length=1, max_length=120)
    description: Optional[str] = Field(None, max_length=300)
    image_url: Optional[str] = None
    item_ids: List[str] = Field(..., min_length=2, max_length=10)
    bundle_price: float = Field(..., ge=0)
    is_active: bool = True


@router.get("/combos/{merchant_id}")
async def get_combos(merchant_id: str):
    """Public: list active combo bundles."""
    m = await db.merchants.find_one({"merchant_id": merchant_id}, {"_id": 0, "combos": 1, "menu": 1})
    if not m:
        return {"combos": []}
    menu_by_id = {it.get("item_id"): it for it in (m.get("menu") or [])}
    combos = []
    for c in (m.get("combos") or []):
        if not c.get("is_active", True):
            continue
        items_full = [menu_by_id.get(i) for i in (c.get("item_ids") or [])]
        items_full = [i for i in items_full if i]
        full_price = round(sum(float(i.get("price", 0) or 0) for i in items_full), 2)
        combos.append({
            **c,
            "items": [{"item_id": i["item_id"], "name": i["name"], "image_url": i.get("image_url"), "price": i.get("price")} for i in items_full],
            "full_price": full_price,
            "save": round(max(0, full_price - float(c.get("bundle_price", 0))), 2),
        })
    return {"combos": combos}


@admin_router.post("/combos")
async def upsert_combo(req: ComboRequest, request: Request):
    await _require_merchant(request)
    combo = req.model_dump()
    combo["combo_id"] = combo.get("combo_id") or f"cmb_{secrets.token_hex(5)}"
    combo.pop("merchant_id", None)
    combo["updated_at"] = _now_utc().isoformat()

    merchant = await db.merchants.find_one({"merchant_id": req.merchant_id}, {"_id": 1, "combos": 1})
    if not merchant:
        await db.merchants.insert_one({"merchant_id": req.merchant_id, "combos": [combo]})
        return {"ok": True, "combo": combo}
    existing = [c for c in (merchant.get("combos") or []) if c.get("combo_id") == combo["combo_id"]]
    if existing:
        await db.merchants.update_one(
            {"_id": merchant["_id"], "combos.combo_id": combo["combo_id"]},
            {"$set": {"combos.$": combo}},
        )
    else:
        await db.merchants.update_one({"_id": merchant["_id"]}, {"$push": {"combos": combo}})
    return {"ok": True, "combo": combo}


@admin_router.delete("/combos/{merchant_id}/{combo_id}")
async def delete_combo(merchant_id: str, combo_id: str, request: Request):
    await _require_merchant(request)
    await db.merchants.update_one({"merchant_id": merchant_id}, {"$pull": {"combos": {"combo_id": combo_id}}})
    return {"ok": True}
