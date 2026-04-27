"""
BidBlitz POS Pro — Compliance + Restaurant + KI + Operational Suite

Implementiert:
  a) TSE / Fiskaly (KassenSichV-konforme Signatur jedes Bons)
  b) GoBD-Archiv (10-Jahre, unveränderbare Bon-Speicherung)
  f) KDS — Kitchen Display System
  g) QR-Tisch-Bestellung + Self-Service
  h) Pfandsystem (Mehrweg-Tracking)
  i) KI-Chat-Assistent für Händler (GPT)
  j) Produkt-Bilderkennung ohne Barcode (Gemini Vision)
  k) Dynamic Pricing Rules
  l) Kunden-Display (separater Screen)
  m) Mitarbeiter-Stempeluhr
  n) Trinkgeld-Pool
  p) Public API + Webhooks
"""
import secrets
import hashlib
import hmac
import json
import logging
import os
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException, Request, BackgroundTasks
from pydantic import BaseModel, Field

from core.database import db
from core.security import get_current_user
from routes.pos_system import (
    _require_merchant, _require_store_access, _audit, short_id, now_iso,
)

router = APIRouter(prefix="/api/pos", tags=["POS Pro"])
log = logging.getLogger("bidblitz.pos.pro")


# ═══════════════════════════════════════════════════════════════════════
# a) TSE — extended TSE config exists in pos_extended.py (/tse/configure,
#    /tse/sign-payment, /tse/status). Here we only add unique ADV features:
#    GoBD-archive + sign-sale (operates on pos_sales not pos_payments).
# ═══════════════════════════════════════════════════════════════════════


# ═══════════════════════════════════════════════════════════════════════
# b) GOBD ARCHIVE
# ═══════════════════════════════════════════════════════════════════════

@router.get("/gobd/archive/list")
async def gobd_list(request: Request, year: int, month: Optional[int] = None):
    user = await get_current_user(request)
    merchant = await _require_merchant(user)
    start = datetime(year, month or 1, 1, tzinfo=timezone.utc)
    end = datetime(year + (1 if not month and 12 == 12 else 0), (month or 12) + 1 if (month or 12) < 12 else 1,
                   1, tzinfo=timezone.utc) if month else datetime(year + 1, 1, 1, tzinfo=timezone.utc)
    items = await db.pos_gobd_archive.find({
        "merchant_id": merchant["merchant_id"],
        "archived_at": {"$gte": start.isoformat(), "$lt": end.isoformat()},
    }, {"_id": 0}).sort("archived_at", 1).to_list(50000)
    return {"count": len(items), "items": items[:500], "truncated": len(items) > 500}


@router.get("/gobd/integrity-check")
async def gobd_integrity(request: Request):
    user = await get_current_user(request)
    merchant = await _require_merchant(user)
    total = await db.pos_gobd_archive.count_documents({"merchant_id": merchant["merchant_id"]})
    sales_signed = await db.pos_sales.count_documents({
        "merchant_id": merchant["merchant_id"],
        "tse_signature": {"$exists": True},
    })
    sales_total = await db.pos_sales.count_documents({
        "merchant_id": merchant["merchant_id"],
        "status": "paid",
    })
    return {
        "gobd_archived": total,
        "sales_signed": sales_signed,
        "sales_paid_total": sales_total,
        "compliance_rate": round(sales_signed / max(sales_total, 1) * 100, 1),
        "ok": sales_signed >= sales_total,
    }


# ═══════════════════════════════════════════════════════════════════════
# f) KDS — Kitchen Display System
# ═══════════════════════════════════════════════════════════════════════

class KDSStation(BaseModel):
    name: str
    categories: List[str] = Field(default_factory=list)  # e.g. ["Speisen", "Vorspeise"]


@router.post("/kds/stations/create")
async def create_kds_station(req: KDSStation, request: Request, store_id: str):
    user = await get_current_user(request)
    await _require_store_access(user, store_id, {"merchant_admin", "store_manager"})
    sid = short_id("KDS", 10)
    await db.pos_kds_stations.insert_one({
        "station_id": sid, "store_id": store_id,
        "name": req.name, "categories": req.categories,
        "active": True, "created_at": now_iso(),
    })
    return {"ok": True, "station_id": sid}


@router.get("/kds/stations")
async def list_kds_stations(request: Request, store_id: str):
    await get_current_user(request)
    items = await db.pos_kds_stations.find({"store_id": store_id, "active": True},
                                           {"_id": 0}).to_list(100)
    return {"stations": items}


@router.get("/kds/orders/{station_id}")
async def kds_orders(station_id: str, request: Request):
    """Orders to display on the kitchen tablet — open + in-progress."""
    await get_current_user(request)
    station = await db.pos_kds_stations.find_one({"station_id": station_id})
    if not station:
        raise HTTPException(status_code=404, detail="Station nicht gefunden")
    orders = await db.pos_kds_orders.find({
        "station_id": station_id,
        "status": {"$in": ["open", "in_progress"]},
    }, {"_id": 0}).sort("created_at", 1).to_list(100)
    return {"orders": orders, "station_name": station["name"]}


class KDSOrderItem(BaseModel):
    cart_id: Optional[str] = None
    table_number: Optional[str] = None
    items: List[Dict[str, Any]]  # [{name, qty, modifiers, notes}]
    station_id: str


@router.post("/kds/orders/create")
async def create_kds_order(req: KDSOrderItem, request: Request):
    await get_current_user(request)
    oid = short_id("KOR", 10)
    await db.pos_kds_orders.insert_one({
        "kds_order_id": oid, "station_id": req.station_id,
        "cart_id": req.cart_id, "table_number": req.table_number,
        "items": req.items, "status": "open",
        "created_at": now_iso(), "updated_at": now_iso(),
    })
    return {"ok": True, "kds_order_id": oid}


@router.post("/kds/orders/{kds_order_id}/status")
async def update_kds_status(kds_order_id: str, request: Request, status: str):
    await get_current_user(request)
    if status not in ("open", "in_progress", "ready", "served", "cancelled"):
        raise HTTPException(status_code=400, detail="Ungültiger Status")
    await db.pos_kds_orders.update_one(
        {"kds_order_id": kds_order_id},
        {"$set": {"status": status, "updated_at": now_iso()}},
    )
    return {"ok": True, "status": status}


# ═══════════════════════════════════════════════════════════════════════
# g) QR-TISCH-BESTELLUNG (Self-Service)
# Uses existing pos_tables collection from pos_extended; we just add
# QR token generation + public guest-order endpoints.
# ═══════════════════════════════════════════════════════════════════════

@router.post("/tables/{table_id}/qr-enable")
async def enable_qr_for_table(table_id: str, request: Request):
    user = await get_current_user(request)
    table = await db.pos_tables.find_one({"table_id": table_id})
    if not table:
        raise HTTPException(status_code=404, detail="Tisch nicht gefunden")
    await _require_store_access(user, table["store_id"], {"merchant_admin", "store_manager"})
    qr_token = table.get("qr_token") or secrets.token_urlsafe(12)
    await db.pos_tables.update_one(
        {"table_id": table_id}, {"$set": {"qr_token": qr_token}}
    )
    return {"ok": True, "qr_token": qr_token, "public_url": f"/order/{qr_token}"}


@router.get("/public/order/{qr_token}")
async def public_order_lookup(qr_token: str):
    """PUBLIC — guest scans QR, gets store catalog + table info."""
    table = await db.pos_tables.find_one({"qr_token": qr_token}, {"_id": 0})
    if not table:
        raise HTTPException(status_code=404, detail="Tisch nicht gefunden")
    products = await db.pos_products.find(
        {"store_id": table["store_id"], "active": True},
        {"_id": 0, "purchase_price": 0},
    ).to_list(500)
    store = await db.pos_stores.find_one({"store_id": table["store_id"]}, {"_id": 0})
    return {"table": table, "store": store, "products": products, "table_label": table.get("name") or table.get("number") or table.get("table_id")}


class GuestOrder(BaseModel):
    qr_token: str
    items: List[Dict[str, Any]]
    guest_name: Optional[str] = None
    notes: Optional[str] = None


@router.post("/public/order/submit")
async def public_order_submit(req: GuestOrder):
    """PUBLIC — guest submits an order from their phone (pay-at-counter or pay-now)."""
    table = await db.pos_tables.find_one({"qr_token": req.qr_token})
    if not table:
        raise HTTPException(status_code=404, detail="Tisch nicht gefunden")
    total = 0.0
    enriched = []
    for it in req.items:
        prod = await db.pos_products.find_one({"product_id": it.get("product_id")})
        if not prod:
            continue
        qty = int(it.get("quantity", 1))
        line = prod["price"] * qty
        total += line
        enriched.append({
            "product_id": prod["product_id"], "name": prod["name"],
            "quantity": qty, "unit_price": prod["price"], "line_total": line,
            "notes": it.get("notes"),
        })
    oid = short_id("GST", 12)
    await db.pos_guest_orders.insert_one({
        "guest_order_id": oid, "table_id": table["table_id"],
        "store_id": table["store_id"], "table_number": table.get("name") or table.get("number"),
        "items": enriched, "total": round(total, 2),
        "guest_name": req.guest_name, "notes": req.notes,
        "status": "pending", "created_at": now_iso(),
    })
    # Auto-create KDS orders if station with matching category exists
    stations = await db.pos_kds_stations.find({"store_id": table["store_id"], "active": True}).to_list(50)
    for st in stations:
        items_for_station = [i for i in enriched
                             if any(c in (i.get("category", "")) for c in st.get("categories", []))]
        if items_for_station:
            await db.pos_kds_orders.insert_one({
                "kds_order_id": short_id("KOR", 10), "station_id": st["station_id"],
                "table_number": table["number"], "items": items_for_station,
                "status": "open", "created_at": now_iso(), "updated_at": now_iso(),
            })
    return {"ok": True, "guest_order_id": oid, "total": round(total, 2)}


# ═══════════════════════════════════════════════════════════════════════
# h) PFANDSYSTEM
# ═══════════════════════════════════════════════════════════════════════

class DepositRegister(BaseModel):
    sale_id: str
    item_type: str  # "cup", "bottle"
    deposit_amount: float = 1.0
    quantity: int = 1


@router.post("/deposits/register")
async def register_deposit(req: DepositRegister, request: Request):
    user = await get_current_user(request)
    sale = await db.pos_sales.find_one({"sale_id": req.sale_id})
    if not sale:
        raise HTTPException(status_code=404, detail="Sale nicht gefunden")
    did = short_id("DEP", 10)
    await db.pos_deposits.insert_one({
        "deposit_id": did, "sale_id": req.sale_id,
        "store_id": sale["store_id"], "merchant_id": sale["merchant_id"],
        "item_type": req.item_type, "deposit_amount": req.deposit_amount,
        "quantity": req.quantity, "status": "outstanding",
        "registered_by": str(user["_id"]), "registered_at": now_iso(),
    })
    return {"ok": True, "deposit_id": did}


class DepositReturn(BaseModel):
    deposit_id: Optional[str] = None
    item_type: Optional[str] = None
    quantity: int = 1


@router.post("/deposits/return")
async def return_deposit(req: DepositReturn, request: Request, store_id: str):
    user = await get_current_user(request)
    await _require_store_access(user, store_id)
    if req.deposit_id:
        dep = await db.pos_deposits.find_one({"deposit_id": req.deposit_id})
        if not dep or dep["status"] != "outstanding":
            raise HTTPException(status_code=400, detail="Pfand bereits zurück oder unbekannt")
        await db.pos_deposits.update_one(
            {"deposit_id": req.deposit_id},
            {"$set": {"status": "returned", "returned_at": now_iso()}},
        )
        amount = dep["deposit_amount"] * min(req.quantity, dep["quantity"])
    else:
        amount = (1.0 if req.item_type == "cup" else 0.25) * req.quantity
    return {"ok": True, "refund_amount": round(amount, 2)}


@router.get("/deposits/outstanding")
async def deposits_outstanding(request: Request, store_id: str):
    await get_current_user(request)
    items = await db.pos_deposits.find({"store_id": store_id, "status": "outstanding"},
                                       {"_id": 0}).to_list(500)
    total = sum(d["deposit_amount"] * d["quantity"] for d in items)
    return {"count": len(items), "total_outstanding": round(total, 2), "items": items[:50]}


# ═══════════════════════════════════════════════════════════════════════
# i) KI-CHAT-ASSISTENT FÜR HÄNDLER
# ═══════════════════════════════════════════════════════════════════════

class AssistantQuery(BaseModel):
    question: str
    store_id: Optional[str] = None


@router.post("/assistant/ask")
async def assistant_ask(req: AssistantQuery, request: Request):
    user = await get_current_user(request)
    merchant = await _require_merchant(user)
    # Gather business context from DB
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    week_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    q: Dict[str, Any] = {"merchant_id": merchant["merchant_id"], "status": "paid"}
    if req.store_id:
        q["store_id"] = req.store_id
    sales_today = await db.pos_sales.count_documents({**q, "paid_at": {"$gte": today}})
    revenue_today = await db.pos_sales.aggregate([
        {"$match": {**q, "paid_at": {"$gte": today}}},
        {"$group": {"_id": None, "total": {"$sum": "$total"}}},
    ]).to_list(1)
    revenue_today_val = revenue_today[0]["total"] if revenue_today else 0
    sales_week = await db.pos_sales.count_documents({**q, "paid_at": {"$gte": week_ago}})
    low_stock = await db.pos_products.count_documents({
        "merchant_id": merchant["merchant_id"], "active": True,
        "track_stock": True, "minimum_stock": {"$gt": 0},
        "$expr": {"$lte": ["$stock", "$minimum_stock"]},
    })
    context = (
        f"Händler: {merchant.get('business_name', '?')}\n"
        f"Heute Umsatz: €{revenue_today_val:.2f} aus {sales_today} Verkäufen\n"
        f"Letzte 7 Tage: {sales_week} Verkäufe\n"
        f"Niedriger Bestand bei {low_stock} Artikeln\n"
    )
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        api_key = os.environ.get("EMERGENT_LLM_KEY")
        if not api_key:
            raise RuntimeError("EMERGENT_LLM_KEY fehlt")
        chat = LlmChat(
            api_key=api_key,
            session_id=f"pos-asst-{merchant['merchant_id']}-{secrets.token_hex(3)}",
            system_message=(
                "Du bist ein freundlicher KI-Assistent für Einzelhandel und Gastro in DE. "
                "Antworte präzise auf DEUTSCH, max. 4 Sätze. Nutze die übergebenen Geschäftsdaten."
            ),
        ).with_model("openai", "gpt-5.1")
        msg = UserMessage(text=f"{context}\n\nFrage: {req.question}")
        answer = await chat.send_message(msg)
        answer_text = answer if isinstance(answer, str) else getattr(answer, "text", str(answer))
    except Exception as e:
        log.exception("assistant failed")
        raise HTTPException(status_code=500, detail=f"KI-Assistent: {e}")
    await db.pos_assistant_log.insert_one({
        "merchant_id": merchant["merchant_id"], "user_id": str(user["_id"]),
        "question": req.question, "answer": answer_text,
        "context_summary": context, "created_at": now_iso(),
    })
    return {"answer": answer_text, "context": context}


# ═══════════════════════════════════════════════════════════════════════
# j) PRODUKT-BILDERKENNUNG OHNE BARCODE
# ═══════════════════════════════════════════════════════════════════════

class ProductRecognize(BaseModel):
    image_base64: str
    store_id: str


@router.post("/products/recognize")
async def recognize_product(req: ProductRecognize, request: Request):
    user = await get_current_user(request)
    await _require_store_access(user, req.store_id)
    # Gather store products as a hint corpus
    products = await db.pos_products.find(
        {"store_id": req.store_id, "active": True},
        {"_id": 0, "product_id": 1, "name": 1, "category": 1, "price": 1},
    ).to_list(500)
    catalog_hint = ", ".join(f"{p['name']}" for p in products[:80])
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent
        api_key = os.environ.get("EMERGENT_LLM_KEY")
        chat = LlmChat(
            api_key=api_key,
            session_id=f"pos-recognize-{secrets.token_hex(3)}",
            system_message=(
                "Du bist ein Produkt-Erkennungs-Modell für eine Kasse. "
                f"Verfügbare Produkte (eines davon erkennen, falls passend): {catalog_hint}. "
                'Antworte als JSON: {"name":"…","confidence":0.9,"matched_product_name":"…","price":2.49} '
                "Nur JSON, kein Text drumherum."
            ),
        ).with_model("gemini", "gemini-2.5-pro")
        msg = UserMessage(
            text="Erkenne das Produkt auf dem Bild und gib das JSON zurück.",
            file_contents=[ImageContent(image_base64=req.image_base64)],
        )
        result = await chat.send_message(msg)
        text = result if isinstance(result, str) else getattr(result, "text", str(result))
        import re
        m = re.search(r"\{.*\}", text, re.DOTALL)
        parsed = json.loads(m.group(0)) if m else {"name": "Unbekannt", "confidence": 0}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erkennung fehlgeschlagen: {e}")
    matched = next((p for p in products
                    if p["name"].lower() == (parsed.get("matched_product_name") or "").lower()), None)
    return {"recognition": parsed, "matched_product": matched}


# ═══════════════════════════════════════════════════════════════════════
# k) DYNAMIC PRICING
# ═══════════════════════════════════════════════════════════════════════

class PricingRule(BaseModel):
    name: str
    product_id: Optional[str] = None
    category: Optional[str] = None
    rule_type: str  # "time_window" | "stock_level" | "happy_hour"
    discount_percent: Optional[float] = None
    surcharge_percent: Optional[float] = None
    starts_at_hour: Optional[int] = None  # 0-23
    ends_at_hour: Optional[int] = None
    days_of_week: Optional[List[int]] = None  # 0=Mon
    min_stock: Optional[float] = None  # rule fires when stock <= this


@router.post("/pricing/rules/create")
async def create_pricing_rule(req: PricingRule, request: Request, store_id: str):
    user = await get_current_user(request)
    await _require_store_access(user, store_id, {"merchant_admin", "store_manager"})
    rid = short_id("PRC", 10)
    await db.pos_pricing_rules.insert_one({
        "rule_id": rid, "store_id": store_id,
        **req.dict(), "active": True, "created_at": now_iso(),
    })
    return {"ok": True, "rule_id": rid}


@router.get("/pricing/rules")
async def list_pricing_rules(request: Request, store_id: str):
    await get_current_user(request)
    items = await db.pos_pricing_rules.find({"store_id": store_id, "active": True},
                                            {"_id": 0}).to_list(200)
    return {"rules": items}


@router.delete("/pricing/rules/{rule_id}")
async def delete_pricing_rule(rule_id: str, request: Request):
    user = await get_current_user(request)
    rule = await db.pos_pricing_rules.find_one({"rule_id": rule_id})
    if not rule:
        raise HTTPException(status_code=404, detail="Regel nicht gefunden")
    await _require_store_access(user, rule["store_id"], {"merchant_admin", "store_manager"})
    await db.pos_pricing_rules.update_one({"rule_id": rule_id}, {"$set": {"active": False}})
    return {"ok": True}


@router.post("/pricing/apply")
async def apply_pricing(request: Request, product_id: str):
    """Returns the effective price for a product based on active pricing rules."""
    await get_current_user(request)
    prod = await db.pos_products.find_one({"product_id": product_id})
    if not prod:
        raise HTTPException(status_code=404, detail="Produkt nicht gefunden")
    base_price = prod["price"]
    now = datetime.now(timezone.utc)
    hour = now.hour
    weekday = now.weekday()
    rules = await db.pos_pricing_rules.find({
        "store_id": prod["store_id"], "active": True,
        "$or": [{"product_id": product_id}, {"product_id": None, "category": prod.get("category")}],
    }).to_list(50)
    applied = []
    for r in rules:
        fires = False
        if r["rule_type"] == "time_window":
            in_hours = r.get("starts_at_hour") is not None and r.get("ends_at_hour") is not None and \
                       r["starts_at_hour"] <= hour < r["ends_at_hour"]
            in_days = not r.get("days_of_week") or weekday in r["days_of_week"]
            fires = in_hours and in_days
        elif r["rule_type"] == "happy_hour":
            fires = r.get("starts_at_hour", 17) <= hour < r.get("ends_at_hour", 19)
        elif r["rule_type"] == "stock_level":
            fires = r.get("min_stock") is not None and prod.get("stock", 0) <= r["min_stock"]
        if fires:
            if r.get("discount_percent"):
                base_price *= (1 - r["discount_percent"] / 100)
                applied.append({"rule": r["name"], "discount_percent": r["discount_percent"]})
            if r.get("surcharge_percent"):
                base_price *= (1 + r["surcharge_percent"] / 100)
                applied.append({"rule": r["name"], "surcharge_percent": r["surcharge_percent"]})
    return {
        "product_id": product_id, "list_price": prod["price"],
        "effective_price": round(base_price, 2),
        "applied_rules": applied,
    }


# ═══════════════════════════════════════════════════════════════════════
# l) KUNDEN-DISPLAY (Public Cart View)
# ═══════════════════════════════════════════════════════════════════════

@router.get("/customer-display/{register_id}")
async def customer_display(register_id: str):
    """PUBLIC view of the active cart at a register — for second-screen display."""
    cart = await db.pos_carts.find_one(
        {"register_id": register_id, "status": {"$in": ["open", "pending_payment"]}},
        {"_id": 0, "merchant_id": 0},
    )
    register = await db.pos_registers.find_one({"register_id": register_id}, {"_id": 0, "merchant_id": 0})
    return {
        "register": register,
        "cart": cart,
        "ad_message": "Zahle bequem mit BidBlitz Wallet — scanne den QR-Code unten ↓",
        "polled_at": now_iso(),
    }


# ═══════════════════════════════════════════════════════════════════════
# m) MITARBEITER-STEMPELUHR
# ═══════════════════════════════════════════════════════════════════════

class TimeClock(BaseModel):
    store_id: str
    action: str  # "in" | "out" | "break_start" | "break_end"
    notes: Optional[str] = None


@router.post("/timeclock/punch")
async def time_clock_punch(req: TimeClock, request: Request):
    user = await get_current_user(request)
    await _require_store_access(user, req.store_id)
    if req.action not in ("in", "out", "break_start", "break_end"):
        raise HTTPException(status_code=400, detail="Ungültige Aktion")
    pid = short_id("CLK", 10)
    await db.pos_timeclock.insert_one({
        "punch_id": pid, "user_id": str(user["_id"]), "store_id": req.store_id,
        "action": req.action, "timestamp": now_iso(), "notes": req.notes,
    })
    return {"ok": True, "punch_id": pid, "action": req.action}


@router.get("/timeclock/me")
async def my_timeclock(request: Request, days: int = 30):
    user = await get_current_user(request)
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    items = await db.pos_timeclock.find(
        {"user_id": str(user["_id"]), "timestamp": {"$gte": cutoff}},
        {"_id": 0},
    ).sort("timestamp", -1).to_list(500)
    return {"punches": items}


@router.get("/timeclock/store")
async def store_timeclock(request: Request, store_id: str, day: Optional[str] = None):
    user = await get_current_user(request)
    await _require_store_access(user, store_id, {"merchant_admin", "store_manager"})
    q: Dict[str, Any] = {"store_id": store_id}
    if day:
        q["timestamp"] = {"$gte": day, "$lt": day + "T23:59:59"}
    items = await db.pos_timeclock.find(q, {"_id": 0}).sort("timestamp", -1).to_list(1000)
    return {"punches": items}


# ═══════════════════════════════════════════════════════════════════════
# n) TRINKGELD-POOL
# ═══════════════════════════════════════════════════════════════════════

class TipAdd(BaseModel):
    sale_id: str
    amount: float
    method: str = "card"


@router.post("/tips/add")
async def add_tip(req: TipAdd, request: Request):
    user = await get_current_user(request)
    sale = await db.pos_sales.find_one({"sale_id": req.sale_id})
    if not sale:
        raise HTTPException(status_code=404, detail="Sale nicht gefunden")
    tid = short_id("TIP", 10)
    await db.pos_tips.insert_one({
        "tip_id": tid, "sale_id": req.sale_id,
        "store_id": sale["store_id"], "merchant_id": sale["merchant_id"],
        "amount": req.amount, "method": req.method,
        "cashier_id": str(user["_id"]), "status": "pending_distribution",
        "created_at": now_iso(),
    })
    return {"ok": True, "tip_id": tid}


@router.post("/tips/pool/distribute")
async def distribute_tip_pool(request: Request, store_id: str, day: Optional[str] = None):
    user = await get_current_user(request)
    await _require_store_access(user, store_id, {"merchant_admin", "store_manager"})
    target_day = day or datetime.now(timezone.utc).strftime("%Y-%m-%d")
    tips = await db.pos_tips.find({
        "store_id": store_id,
        "status": "pending_distribution",
        "created_at": {"$regex": f"^{target_day}"},
    }).to_list(1000)
    if not tips:
        return {"ok": True, "distributed": 0, "recipients": 0}
    # Find clocked-in staff for that day
    clock = await db.pos_timeclock.find({
        "store_id": store_id, "action": "in",
        "timestamp": {"$regex": f"^{target_day}"},
    }).to_list(100)
    staff_ids = list({c["user_id"] for c in clock})
    if not staff_ids:
        raise HTTPException(status_code=400, detail="Kein Personal an diesem Tag eingestempelt")
    total = sum(t["amount"] for t in tips)
    per_head = round(total / len(staff_ids), 2)
    for sid in staff_ids:
        await db.pos_tip_payouts.insert_one({
            "payout_id": short_id("TPO", 10), "user_id": sid, "store_id": store_id,
            "day": target_day, "amount": per_head, "tip_count": len(tips),
            "created_at": now_iso(),
        })
    await db.pos_tips.update_many(
        {"tip_id": {"$in": [t["tip_id"] for t in tips]}},
        {"$set": {"status": "distributed", "distributed_at": now_iso()}},
    )
    return {"ok": True, "total_pool": round(total, 2), "per_person": per_head,
            "recipients": len(staff_ids), "distributed_tips": len(tips)}


@router.get("/tips/my-payouts")
async def my_tips(request: Request, days: int = 30):
    user = await get_current_user(request)
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    items = await db.pos_tip_payouts.find(
        {"user_id": str(user["_id"]), "created_at": {"$gte": cutoff}},
        {"_id": 0},
    ).sort("created_at", -1).to_list(200)
    total = sum(i["amount"] for i in items)
    return {"payouts": items, "total": round(total, 2)}


# ═══════════════════════════════════════════════════════════════════════
# p) PUBLIC API + WEBHOOKS
# ═══════════════════════════════════════════════════════════════════════

class WebhookCreate(BaseModel):
    url: str
    events: List[str]  # ["sale.completed", "stock.low", "shift.closed"]


@router.post("/webhooks/create")
async def create_webhook(req: WebhookCreate, request: Request):
    user = await get_current_user(request)
    merchant = await _require_merchant(user)
    wid = short_id("WHK", 12)
    secret = secrets.token_urlsafe(32)
    await db.pos_webhooks.insert_one({
        "webhook_id": wid, "merchant_id": merchant["merchant_id"],
        "url": req.url, "events": req.events, "secret": secret,
        "active": True, "delivery_count": 0, "fail_count": 0,
        "created_at": now_iso(),
    })
    return {"ok": True, "webhook_id": wid, "secret": secret,
            "info": "Bewahre 'secret' auf — wird zur HMAC-Signatur-Validierung der Pakete verwendet."}


@router.get("/webhooks")
async def list_webhooks(request: Request):
    user = await get_current_user(request)
    merchant = await _require_merchant(user)
    items = await db.pos_webhooks.find(
        {"merchant_id": merchant["merchant_id"]},
        {"_id": 0, "secret": 0},
    ).to_list(100)
    return {"webhooks": items}


@router.delete("/webhooks/{webhook_id}")
async def delete_webhook(webhook_id: str, request: Request):
    user = await get_current_user(request)
    merchant = await _require_merchant(user)
    await db.pos_webhooks.update_one(
        {"webhook_id": webhook_id, "merchant_id": merchant["merchant_id"]},
        {"$set": {"active": False}},
    )
    return {"ok": True}


@router.post("/webhooks/{webhook_id}/test")
async def test_webhook(webhook_id: str, request: Request, background: BackgroundTasks):
    user = await get_current_user(request)
    merchant = await _require_merchant(user)
    hook = await db.pos_webhooks.find_one({
        "webhook_id": webhook_id, "merchant_id": merchant["merchant_id"], "active": True,
    })
    if not hook:
        raise HTTPException(status_code=404, detail="Webhook nicht gefunden")

    async def _fire():
        try:
            import httpx
            payload = {"event": "webhook.test", "timestamp": now_iso(),
                       "data": {"message": "Hallo von BidBlitz POS!"}}
            body = json.dumps(payload)
            sig = hmac.new(hook["secret"].encode(), body.encode(), hashlib.sha256).hexdigest()
            async with httpx.AsyncClient(timeout=10) as cx:
                r = await cx.post(hook["url"], content=body,
                                  headers={"Content-Type": "application/json",
                                           "X-BidBlitz-Signature": sig})
            await db.pos_webhooks.update_one(
                {"webhook_id": webhook_id},
                {"$inc": {"delivery_count": 1, "fail_count": 0 if r.status_code < 400 else 1},
                 "$set": {"last_status": r.status_code, "last_attempt_at": now_iso()}},
            )
        except Exception as e:
            log.warning(f"webhook fire failed: {e}")
            await db.pos_webhooks.update_one(
                {"webhook_id": webhook_id},
                {"$inc": {"fail_count": 1},
                 "$set": {"last_error": str(e)[:200], "last_attempt_at": now_iso()}},
            )

    background.add_task(_fire)
    return {"ok": True, "queued": True}


@router.get("/api-keys")
async def list_api_keys(request: Request):
    user = await get_current_user(request)
    merchant = await _require_merchant(user)
    items = await db.pos_api_keys.find(
        {"merchant_id": merchant["merchant_id"], "active": True},
        {"_id": 0, "key_secret": 0},
    ).to_list(50)
    return {"keys": items}


@router.post("/api-keys/create")
async def create_api_key(request: Request, name: str, scopes: str = "read"):
    user = await get_current_user(request)
    merchant = await _require_merchant(user)
    key_id = "bbpub_" + secrets.token_urlsafe(8)
    key_secret = "bbsec_" + secrets.token_urlsafe(32)
    await db.pos_api_keys.insert_one({
        "key_id": key_id, "merchant_id": merchant["merchant_id"],
        "name": name, "scopes": scopes.split(","),
        "key_secret_hash": hashlib.sha256(key_secret.encode()).hexdigest(),
        "active": True, "created_at": now_iso(),
    })
    return {"ok": True, "key_id": key_id, "key_secret": key_secret,
            "warning": "Speichere key_secret JETZT — wird nicht erneut gezeigt."}


@router.delete("/api-keys/{key_id}")
async def revoke_api_key(key_id: str, request: Request):
    user = await get_current_user(request)
    merchant = await _require_merchant(user)
    await db.pos_api_keys.update_one(
        {"key_id": key_id, "merchant_id": merchant["merchant_id"]},
        {"$set": {"active": False, "revoked_at": now_iso()}},
    )
    return {"ok": True}
