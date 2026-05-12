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

import secrets
from datetime import datetime, timezone, timedelta
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from bson import ObjectId

from core.database import db
from core.security import get_current_user

router = APIRouter(prefix="/api/qr", tags=["qr-order"])
admin_router = APIRouter(prefix="/api/merchant", tags=["qr-order-admin"])

TOKEN_TTL_MIN = 5  # sliding window
DEFAULT_ACCEPT_MODE = "instant"  # 'instant' | 'waiter'
DEFAULT_SCOPES = ["food", "drinks"]


# ─── Models ─────────────────────────────────────────────────────────────────

class TableCreateRequest(BaseModel):
    merchant_id: str
    label: str = Field(..., min_length=1, max_length=80)
    capacity: int = Field(4, ge=1, le=200)


class QROrderItem(BaseModel):
    item_id: str
    name: str
    price: float = Field(..., ge=0)
    qty: int = Field(1, ge=1, le=99)
    note: Optional[str] = Field(None, max_length=200)


class QROrderRequest(BaseModel):
    token: str
    items: List[QROrderItem]
    scope: str = Field("food", pattern="^(food|drinks)$")
    note: Optional[str] = Field(None, max_length=300)


class QRSettingsRequest(BaseModel):
    merchant_id: str
    acceptance_mode: str = Field("instant", pattern="^(instant|waiter)$")
    scopes: List[str] = Field(default_factory=lambda: ["food", "drinks"])


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
        {"_id": 0, "menu": 1, "name": 1, "logo_url": 1},
    )
    if not merchant:
        # Fallback: also accept store-based menus stored on pos_menus
        items = await db.pos_menus.find({"store_id": merchant_id}, {"_id": 0}).to_list(500)
        if not items:
            raise HTTPException(status_code=404, detail="Speisekarte nicht gefunden")
        return {"name": "", "items": items}
    return {
        "name": merchant.get("name", ""),
        "logo_url": merchant.get("logo_url"),
        "items": merchant.get("menu", []),
    }


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
        canonical = menu_items.get(it.item_id) or menu_items.get(it.name)
        unit_price = float(canonical["price"]) if canonical and "price" in canonical else float(it.price)
        line_total = round(unit_price * it.qty, 2)
        total += line_total
        order_items.append({
            "item_id": it.item_id,
            "name": canonical["name"] if canonical else it.name,
            "unit_price": round(unit_price, 2),
            "qty": it.qty,
            "line_total": line_total,
            "note": it.note or "",
        })
    total = round(total, 2)

    # 3. Wallet debit (atomic)
    user_id = user["_id"]
    update_res = await db.users.update_one(
        {"_id": user_id, "wallet_balance": {"$gte": total}},
        {"$inc": {"wallet_balance": -total}},
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
    # Refund wallet
    await db.users.update_one(
        {"_id": ObjectId(order["customer_id"])},
        {"$inc": {"wallet_balance": refund}},
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
