"""
BidBlitz POS — Mega Advanced Suite
OCR + Voice + Etiketten + Auto-PO + Bulk-Import + Inventur + Chargen + Rezepte +
Schichtplan + Performance + KI-Forecast + Cross-Sell + DATEV + P&L + Online-Sync +
Reservierung + Marketing + Gutscheine + Alterskontrolle.
"""
import secrets
import io
import csv
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException, Request, UploadFile, File
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from core.database import db
from core.security import get_current_user
from routes.pos_system import (
    _require_merchant, _require_store_access, _audit, short_id, now_iso,
)

router = APIRouter(prefix="/api/pos", tags=["POS Advanced"])
log = logging.getLogger("bidblitz.pos.adv")


# ── 1. LIEFERSCHEIN-OCR ────────────────────────────────────────────────
class OcrRequest(BaseModel):
    image_base64: str
    store_id: str
    po_id: Optional[str] = None


@router.post("/ocr/delivery-note")
async def ocr_delivery_note(req: OcrRequest, request: Request):
    user = await get_current_user(request)
    await _require_store_access(user, req.store_id, {"merchant_admin", "store_manager"})
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent
        import os, re, json
        chat = LlmChat(
            api_key=os.environ.get("EMERGENT_LLM_KEY"),
            session_id=f"pos-ocr-{secrets.token_hex(4)}",
            system_message=(
                "Du bist ein Lieferschein-Parser. Extrahiere alle Artikel als JSON: "
                '[{"name":"Coca-Cola 1L","quantity":24,"unit_price":1.20,"total":28.80,"barcode":"5449000054227"}]. '
                "Nur JSON ohne Erklärung."
            ),
        ).with_model("gemini", "gemini-2.0-flash")
        msg = UserMessage(text="Extrahiere die Artikel:", file_contents=[ImageContent(image_base64=req.image_base64)])
        result = await chat.send_message(msg)
        m = re.search(r"\[.*\]", result, re.DOTALL)
        items = json.loads(m.group(0)) if m else []
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"OCR fehlgeschlagen: {e}")
    return {"ok": True, "items": items, "count": len(items)}


# ── 2. VOICE COMMANDS ──────────────────────────────────────────────────
class VoiceCommand(BaseModel):
    audio_base64: str
    register_id: Optional[str] = None


@router.post("/voice/transcribe")
async def transcribe_voice(req: VoiceCommand, request: Request):
    await get_current_user(request)
    try:
        import openai
        import os
        import base64 as b64
        import re
        client = openai.OpenAI(api_key=os.environ.get("EMERGENT_LLM_KEY"))
        audio_bytes = b64.b64decode(req.audio_base64)
        buf = io.BytesIO(audio_bytes)
        buf.name = "voice.webm"
        result = client.audio.transcriptions.create(model="whisper-1", file=buf, language="de")
        text = result.text
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Transcribe fehlgeschlagen: {e}")
    t = text.lower()
    cmd = {"action": "unknown"}
    m = re.search(r"(\d+)\s+(\w+)", t)
    if ("hinzufüg" in t or "zufüg" in t) and m:
        cmd = {"action": "add_item", "quantity": int(m.group(1)), "name": m.group(2)}
    elif "rabatt" in t:
        m2 = re.search(r"(\d+)\s*(?:prozent|%)", t)
        if m2:
            cmd = {"action": "apply_discount", "percent": int(m2.group(1))}
    elif "stornier" in t or "abbrech" in t:
        cmd = {"action": "cancel"}
    return {"text": text, "command": cmd}


# ── 3. ETIKETTEN-DRUCK ────────────────────────────────────────────────
class LabelPrintRequest(BaseModel):
    product_ids: List[str]
    copies_per_product: int = 1


@router.post("/labels/generate")
async def generate_labels(req: LabelPrintRequest, request: Request):
    await get_current_user(request)
    products = await db.pos_products.find({"product_id": {"$in": req.product_ids}}, {"_id": 0}).to_list(500)
    if not products:
        raise HTTPException(status_code=404, detail="Keine Produkte gefunden")
    from fpdf import FPDF
    pdf = FPDF(unit="mm", format="A4")
    pdf.add_page()
    pdf.set_auto_page_break(False)
    x, y = 5, 5
    label_w, label_h = 65, 40
    col, row = 0, 0
    for p in products:
        for _ in range(req.copies_per_product):
            base_x = x + col * label_w
            base_y = y + row * label_h
            pdf.set_xy(base_x, base_y)
            pdf.set_font("Helvetica", "B", 9)
            pdf.cell(label_w, 5, p["name"][:25], ln=0)
            pdf.set_font("Helvetica", "", 7)
            pdf.set_xy(base_x, base_y + 8)
            pdf.cell(label_w, 4, f"EAN: {p.get('barcode', '-')}", ln=0)
            pdf.set_xy(base_x, base_y + 15)
            pdf.set_font("Helvetica", "B", 14)
            pdf.cell(label_w, 8, f"EUR {p.get('price', 0):.2f}", ln=0)
            col += 1
            if col >= 3:
                col = 0
                row += 1
            if row >= 6:
                pdf.add_page()
                col = 0
                row = 0
    buf = io.BytesIO()
    pdf.output(buf)
    buf.seek(0)
    return StreamingResponse(buf, media_type="application/pdf",
                             headers={"Content-Disposition": 'inline; filename="labels.pdf"'})


# ── 4. AUTO-BESTELLUNG ────────────────────────────────────────────────
@router.post("/auto-order/run")
async def run_auto_order(request: Request, store_id: str):
    user = await get_current_user(request)
    await _require_store_access(user, store_id, {"merchant_admin", "store_manager"})
    merchant = await _require_merchant(user)
    low = await db.pos_products.find({
        "store_id": store_id, "active": True, "track_stock": True,
        "minimum_stock": {"$gt": 0},
        "$expr": {"$lte": ["$stock", "$minimum_stock"]},
        "supplier_id": {"$ne": None, "$exists": True},
    }, {"_id": 0}).to_list(500)
    by_supplier: Dict[str, list] = {}
    for p in low:
        by_supplier.setdefault(p["supplier_id"], []).append(p)
    created = []
    for sup_id, items in by_supplier.items():
        po_id = short_id("PO", 12)
        lines = []
        total = 0.0
        for p in items:
            qty = max((p.get("minimum_stock", 0) or 0) * 2 - p.get("stock", 0), 1)
            ep = p.get("purchase_price", 0) or 0
            lt = round(qty * ep, 2)
            total += lt
            lines.append({
                "product_id": p["product_id"], "product_name": p["name"],
                "barcode": p.get("barcode"), "quantity": qty,
                "purchase_price": ep, "line_total": lt, "received": 0,
            })
        sup = await db.pos_suppliers.find_one({"supplier_id": sup_id})
        await db.pos_purchase_orders.insert_one({
            "po_id": po_id, "merchant_id": merchant["merchant_id"], "store_id": store_id,
            "supplier_id": sup_id, "supplier_name": sup.get("name", "") if sup else "",
            "items": lines, "total_cost": round(total, 2), "status": "draft",
            "auto_generated": True, "created_at": now_iso(),
        })
        created.append({"po_id": po_id, "supplier": sup_id, "lines": len(lines), "total": total})
    return {"ok": True, "created_pos": created, "low_stock_count": len(low)}


# ── 5. CSV BULK-IMPORT ────────────────────────────────────────────────
@router.post("/products/bulk-import")
async def bulk_import_products(request: Request, store_id: str, file: UploadFile = File(...)):
    user = await get_current_user(request)
    store = await _require_store_access(user, store_id, {"merchant_admin", "store_manager"})
    content = (await file.read()).decode("utf-8", errors="ignore")
    lines = content.splitlines()
    delim = ";" if lines and ";" in lines[0] else ","
    reader = csv.DictReader(io.StringIO(content), delimiter=delim)
    created, skipped, errors = 0, 0, []
    for i, row in enumerate(reader):
        name = (row.get("name") or "").strip()
        if not name:
            skipped += 1
            continue
        try:
            await db.pos_products.insert_one({
                "product_id": short_id("PRD", 10), "store_id": store_id,
                "merchant_id": store["merchant_id"], "name": name,
                "barcode": (row.get("barcode") or "").strip() or None,
                "sku": (row.get("sku") or "").strip() or None,
                "price": float(row.get("price", 0) or 0),
                "purchase_price": float(row.get("purchase_price", 0) or 0),
                "tax_rate": float(row.get("tax_rate", 0.19) or 0.19),
                "stock": float(row.get("stock", 0) or 0),
                "minimum_stock": float(row.get("minimum_stock", 0) or 0),
                "unit": (row.get("unit") or "Stk").strip(),
                "category": (row.get("category") or "").strip(),
                "track_stock": True, "active": True, "created_at": now_iso(),
            })
            created += 1
        except Exception as e:
            errors.append({"row": i + 1, "error": str(e)[:100]})
    return {"ok": True, "created": created, "skipped": skipped, "errors": errors[:20]}


@router.get("/products/bulk-export")
async def bulk_export_products(request: Request, store_id: str):
    user = await get_current_user(request)
    await _require_store_access(user, store_id)
    products = await db.pos_products.find({"store_id": store_id}, {"_id": 0}).to_list(10000)
    buf = io.StringIO()
    keys = ["name", "barcode", "sku", "price", "purchase_price", "tax_rate",
            "stock", "minimum_stock", "unit", "category"]
    w = csv.DictWriter(buf, fieldnames=keys, delimiter=";")
    w.writeheader()
    for p in products:
        w.writerow({k: p.get(k, "") for k in keys})
    return StreamingResponse(io.BytesIO(buf.getvalue().encode()), media_type="text/csv",
                             headers={"Content-Disposition": f'attachment; filename="products_{store_id}.csv"'})


# ── 6. INVENTUR ────────────────────────────────────────────────────────
class StocktakeStart(BaseModel):
    store_id: str
    name: str = "Inventur"


@router.post("/stocktake/start")
async def start_stocktake(req: StocktakeStart, request: Request):
    user = await get_current_user(request)
    await _require_store_access(user, req.store_id, {"merchant_admin", "store_manager"})
    sid = short_id("STK", 10)
    doc = {"stocktake_id": sid, "store_id": req.store_id, "name": req.name,
           "status": "open", "counts": [], "started_by": str(user["_id"]),
           "started_at": now_iso()}
    await db.pos_stocktakes.insert_one(doc)
    doc.pop("_id", None)
    return {"ok": True, "stocktake": doc}


class StocktakeCount(BaseModel):
    stocktake_id: str
    product_id: str
    counted: float


@router.post("/stocktake/count")
async def count_stock(req: StocktakeCount, request: Request):
    user = await get_current_user(request)
    st = await db.pos_stocktakes.find_one({"stocktake_id": req.stocktake_id})
    if not st or st["status"] != "open":
        raise HTTPException(status_code=400, detail="Inventur nicht offen")
    await _require_store_access(user, st["store_id"])
    p = await db.pos_products.find_one({"product_id": req.product_id})
    if not p:
        raise HTTPException(status_code=404, detail="Produkt nicht gefunden")
    entry = {"product_id": req.product_id, "name": p["name"],
             "expected": p.get("stock", 0), "counted": req.counted,
             "diff": round(req.counted - p.get("stock", 0), 3),
             "by": str(user["_id"]), "at": now_iso()}
    await db.pos_stocktakes.update_one(
        {"stocktake_id": req.stocktake_id, "counts.product_id": {"$ne": req.product_id}},
        {"$push": {"counts": entry}})
    await db.pos_stocktakes.update_one(
        {"stocktake_id": req.stocktake_id, "counts.product_id": req.product_id},
        {"$set": {"counts.$": entry}})
    return {"ok": True, "diff": entry["diff"]}


@router.post("/stocktake/{stocktake_id}/finalize")
async def finalize_stocktake(stocktake_id: str, request: Request):
    user = await get_current_user(request)
    st = await db.pos_stocktakes.find_one({"stocktake_id": stocktake_id})
    if not st:
        raise HTTPException(status_code=404, detail="Inventur nicht gefunden")
    await _require_store_access(user, st["store_id"], {"merchant_admin", "store_manager"})
    total_diff = 0
    for c in st.get("counts", []):
        product = await db.pos_products.find_one({"product_id": c["product_id"]})
        if not product:
            continue
        before = float(product.get("stock", 0))
        after = float(c["counted"])
        await db.pos_products.update_one({"product_id": c["product_id"]},
                                         {"$set": {"stock": after, "updated_at": now_iso()}})
        await db.pos_stock_movements.insert_one({
            "movement_id": short_id("MOV", 10), "product_id": c["product_id"],
            "product_name": product["name"], "merchant_id": product["merchant_id"],
            "store_id": st["store_id"], "type": "recount",
            "quantity": after - before, "before_stock": before, "after_stock": after,
            "reference_id": stocktake_id, "created_by": str(user["_id"]),
            "note": f"Inventur {st['name']}", "created_at": now_iso(),
        })
        total_diff += abs(after - before)
    await db.pos_stocktakes.update_one({"stocktake_id": stocktake_id},
        {"$set": {"status": "closed", "closed_at": now_iso(),
                  "closed_by": str(user["_id"]), "total_diff_units": total_diff}})
    await _audit(str(user["_id"]), "stocktake.finalize", {"id": stocktake_id, "diff": total_diff})
    return {"ok": True, "total_diff_units": total_diff}


@router.get("/stocktake/list")
async def list_stocktakes(request: Request, store_id: str):
    user = await get_current_user(request)
    await _require_store_access(user, store_id)
    items = await db.pos_stocktakes.find({"store_id": store_id}, {"_id": 0}).sort("started_at", -1).to_list(100)
    return {"stocktakes": items}


# ── 7. CHARGEN / MHD ───────────────────────────────────────────────────
class BatchCreate(BaseModel):
    product_id: str
    batch_number: str
    quantity: float
    expiry_date: Optional[str] = None
    received_at: Optional[str] = None


@router.post("/batches/create")
async def create_batch(req: BatchCreate, request: Request):
    user = await get_current_user(request)
    p = await db.pos_products.find_one({"product_id": req.product_id})
    if not p:
        raise HTTPException(status_code=404, detail="Produkt nicht gefunden")
    await _require_store_access(user, p["store_id"], {"merchant_admin", "store_manager"})
    doc = {"batch_id": short_id("BAT", 10), "product_id": req.product_id,
           "store_id": p["store_id"], "merchant_id": p["merchant_id"],
           "batch_number": req.batch_number, "quantity_initial": req.quantity,
           "quantity_remaining": req.quantity, "expiry_date": req.expiry_date,
           "received_at": req.received_at or now_iso(), "created_at": now_iso()}
    await db.pos_batches.insert_one(doc)
    doc.pop("_id", None)
    return {"ok": True, "batch": doc}


@router.get("/batches/expiring")
async def expiring_batches(request: Request, store_id: str, days: int = 14):
    user = await get_current_user(request)
    await _require_store_access(user, store_id)
    until = (datetime.now(timezone.utc) + timedelta(days=days)).date().isoformat()
    items = await db.pos_batches.find({
        "store_id": store_id, "quantity_remaining": {"$gt": 0},
        "expiry_date": {"$ne": None, "$lte": until},
    }, {"_id": 0}).sort("expiry_date", 1).to_list(200)
    return {"expiring": items, "until": until, "count": len(items)}


# ── 8. REZEPTE ─────────────────────────────────────────────────────────
class RecipeCreate(BaseModel):
    product_id: str
    components: List[Dict[str, Any]]


@router.post("/recipes/create")
async def create_recipe(req: RecipeCreate, request: Request):
    user = await get_current_user(request)
    p = await db.pos_products.find_one({"product_id": req.product_id})
    if not p:
        raise HTTPException(status_code=404, detail="Produkt nicht gefunden")
    await _require_store_access(user, p["store_id"], {"merchant_admin", "store_manager"})
    cost = 0.0
    for c in req.components:
        cp = await db.pos_products.find_one({"product_id": c["product_id"]})
        if cp:
            cost += float(cp.get("purchase_price", 0)) * float(c.get("quantity", 0))
    await db.pos_recipes.update_one({"product_id": req.product_id},
        {"$set": {"product_id": req.product_id, "store_id": p["store_id"],
                  "components": req.components, "cost": round(cost, 2),
                  "margin": round(p.get("price", 0) - cost, 2),
                  "updated_at": now_iso()}}, upsert=True)
    return {"ok": True, "cost": round(cost, 2), "margin": round(p.get("price", 0) - cost, 2)}


@router.get("/recipes/{product_id}")
async def get_recipe(product_id: str, request: Request):
    await get_current_user(request)
    r = await db.pos_recipes.find_one({"product_id": product_id}, {"_id": 0})
    return r or {"recipe": None}


# ── 9. SCHICHTPLANUNG ─────────────────────────────────────────────────
class ScheduleEntry(BaseModel):
    store_id: str
    user_id: str
    user_name: str
    start: str
    end: str
    role: str = "cashier"


@router.post("/schedule/add")
async def add_schedule(req: ScheduleEntry, request: Request):
    user = await get_current_user(request)
    await _require_store_access(user, req.store_id, {"merchant_admin", "store_manager"})
    doc = {"entry_id": short_id("SCH", 10), "store_id": req.store_id,
           "user_id": req.user_id, "user_name": req.user_name, "start": req.start,
           "end": req.end, "role": req.role, "status": "scheduled",
           "created_by": str(user["_id"]), "created_at": now_iso()}
    await db.pos_schedules.insert_one(doc)
    doc.pop("_id", None)
    return {"ok": True, "entry": doc}


@router.get("/schedule/week")
async def schedule_week(request: Request, store_id: str, week_start: str):
    user = await get_current_user(request)
    await _require_store_access(user, store_id)
    end = (datetime.fromisoformat(week_start) + timedelta(days=7)).isoformat()
    items = await db.pos_schedules.find({"store_id": store_id, "start": {"$gte": week_start, "$lt": end}},
                                         {"_id": 0}).sort("start", 1).to_list(500)
    return {"entries": items}


# ── 10. CASHIER PERFORMANCE ───────────────────────────────────────────
@router.get("/performance/cashiers")
async def cashier_performance(request: Request, store_id: str, days: int = 30):
    user = await get_current_user(request)
    await _require_store_access(user, store_id, {"merchant_admin", "store_manager", "accountant"})
    since = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    sales = await db.pos_sales.find({"store_id": store_id, "created_at": {"$gte": since},
                                      "status": "completed"}, {"_id": 0}).to_list(20000)
    refunds = await db.pos_refunds.find({"store_id": store_id, "issued_at": {"$gte": since}},
                                         {"_id": 0}).to_list(2000)
    by: Dict[str, Dict[str, float]] = {}
    for s in sales:
        c = s["cashier_id"]
        row = by.setdefault(c, {"cashier_id": c, "sales": 0, "revenue": 0, "refunds": 0, "refund_amount": 0})
        row["sales"] += 1
        row["revenue"] = round(row["revenue"] + s["total"], 2)
    for r in refunds:
        c = r.get("issued_by")
        if c:
            row = by.setdefault(c, {"cashier_id": c, "sales": 0, "revenue": 0, "refunds": 0, "refund_amount": 0})
            row["refunds"] += 1
            row["refund_amount"] = round(row["refund_amount"] + r["amount"], 2)
    rows = list(by.values())
    for r in rows:
        r["avg_basket"] = round(r["revenue"] / r["sales"], 2) if r["sales"] else 0
        r["refund_rate"] = round((r["refunds"] / r["sales"]) * 100, 1) if r["sales"] else 0
    rows.sort(key=lambda x: x["revenue"], reverse=True)
    return {"period_days": days, "cashiers": rows}


# ── 11. KI-VERKAUFSPROGNOSE ───────────────────────────────────────────
@router.get("/forecast/sales")
async def forecast_sales(request: Request, store_id: str, days_ahead: int = 7):
    user = await get_current_user(request)
    await _require_store_access(user, store_id)
    since = (datetime.now(timezone.utc) - timedelta(days=28)).isoformat()
    sales = await db.pos_sales.find({"store_id": store_id, "created_at": {"$gte": since},
                                      "status": "completed"},
                                     {"_id": 0, "items": 1, "created_at": 1}).to_list(20000)
    daily_qty: Dict[str, Dict[str, float]] = {}
    for s in sales:
        for it in s["items"]:
            pid = it.get("product_id") or it["name"]
            day = s["created_at"][:10]
            daily_qty.setdefault(pid, {})
            daily_qty[pid][day] = daily_qty[pid].get(day, 0) + float(it["quantity"])
    forecast = []
    for pid, days_data in daily_qty.items():
        avg = sum(days_data.values()) / max(28, len(days_data))
        product = await db.pos_products.find_one({"product_id": pid},
                                                  {"_id": 0, "name": 1, "stock": 1, "minimum_stock": 1})
        if not product:
            continue
        days_until_stockout = (product.get("stock", 0) / avg) if avg > 0 else 999
        forecast.append({
            "product_id": pid, "name": product["name"],
            "current_stock": product.get("stock", 0), "daily_avg": round(avg, 2),
            "predicted_demand": round(avg * days_ahead, 1),
            "days_until_stockout": round(days_until_stockout, 1),
            "needs_reorder": days_until_stockout < days_ahead,
        })
    forecast.sort(key=lambda x: x["days_until_stockout"])
    return {"days_ahead": days_ahead, "forecast": forecast[:50]}


# ── 12. CROSS-SELL ─────────────────────────────────────────────────────
@router.get("/cross-sell/{product_id}")
async def cross_sell(product_id: str, request: Request, store_id: str):
    user = await get_current_user(request)
    await _require_store_access(user, store_id)
    sales = await db.pos_sales.find({"store_id": store_id, "items.product_id": product_id,
                                      "status": "completed"}, {"_id": 0, "items": 1}).limit(2000).to_list(2000)
    counter: Dict[str, int] = {}
    for s in sales:
        for it in s["items"]:
            other = it.get("product_id")
            if other and other != product_id:
                counter[other] = counter.get(other, 0) + 1
    top_ids = sorted(counter.items(), key=lambda x: x[1], reverse=True)[:8]
    suggestions = []
    for pid, cnt in top_ids:
        p = await db.pos_products.find_one({"product_id": pid}, {"_id": 0, "name": 1, "price": 1})
        if p:
            suggestions.append({**p, "co_count": cnt})
    return {"product_id": product_id, "suggestions": suggestions}


# ── 13. DATEV / LEXOFFICE EXPORT ──────────────────────────────────────
@router.get("/accounting/datev/export")
async def datev_export(request: Request, store_id: str, year: int, month: int):
    user = await get_current_user(request)
    await _require_store_access(user, store_id, {"merchant_admin", "accountant"})
    start = datetime(year, month, 1, tzinfo=timezone.utc).isoformat()
    end_year, end_month = (year, month + 1) if month < 12 else (year + 1, 1)
    end = datetime(end_year, end_month, 1, tzinfo=timezone.utc).isoformat()
    sales = await db.pos_sales.find({"store_id": store_id, "created_at": {"$gte": start, "$lt": end},
                                      "status": "completed"}, {"_id": 0}).to_list(50000)
    lines = ["Umsatz;Soll/Haben;WKZ;Konto;Gegenkonto;Datum;Belegfeld1;Buchungstext;BU-Schluessel"]
    for s in sales:
        date_de = datetime.fromisoformat(s["created_at"].replace("Z", "+00:00")).strftime("%d.%m.%Y")
        has_19 = any(it.get("tax_rate", 0) > 0.1 for it in s["items"])
        konto_haben = "8400" if has_19 else "8300"
        lines.append(f"{s['total']:.2f};S;EUR;1200;{konto_haben};{date_de};{s['receipt_id']};POS Verkauf;9")
    buf = io.BytesIO("\r\n".join(lines).encode("cp1252", errors="replace"))
    return StreamingResponse(buf, media_type="text/csv",
                             headers={"Content-Disposition": f'attachment; filename="datev_{year}_{month:02d}.csv"'})


@router.get("/accounting/lexoffice/export")
async def lexoffice_export(request: Request, store_id: str, year: int, month: int):
    user = await get_current_user(request)
    await _require_store_access(user, store_id, {"merchant_admin", "accountant"})
    start = datetime(year, month, 1, tzinfo=timezone.utc).isoformat()
    end_year, end_month = (year, month + 1) if month < 12 else (year + 1, 1)
    end = datetime(end_year, end_month, 1, tzinfo=timezone.utc).isoformat()
    sales = await db.pos_sales.find({"store_id": store_id, "created_at": {"$gte": start, "$lt": end},
                                      "status": "completed"}, {"_id": 0}).to_list(50000)
    return {"format": "lexoffice-v1", "period": f"{year}-{month:02d}",
            "vouchers": [{"voucherType": "salesinvoice", "voucherNumber": s["receipt_id"],
                          "voucherDate": s["created_at"][:10], "totalAmount": s["total"],
                          "totalTax": s["tax_total"],
                          "lineItems": [{"name": it["name"], "quantity": it["quantity"],
                                         "unitPrice": it["unit_price"], "totalAmount": it["line_total"]}
                                        for it in s["items"]]}
                         for s in sales]}


# ── 14. P&L DASHBOARD ─────────────────────────────────────────────────
@router.get("/pnl/today")
async def pnl_today(request: Request, store_id: str):
    user = await get_current_user(request)
    await _require_store_access(user, store_id, {"merchant_admin", "store_manager", "accountant"})
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    sales = await db.pos_sales.find({"store_id": store_id, "created_at": {"$gte": today},
                                      "status": "completed"}, {"_id": 0}).to_list(10000)
    revenue = round(sum(s["total"] for s in sales), 2)
    fees = round(sum(s.get("fee", 0) for s in sales), 2)
    cogs = 0.0
    for s in sales:
        for it in s["items"]:
            if it.get("product_id"):
                p = await db.pos_products.find_one({"product_id": it["product_id"]},
                                                    {"_id": 0, "purchase_price": 1})
                if p:
                    cogs += float(p.get("purchase_price", 0)) * float(it["quantity"])
    refunds = await db.pos_refunds.find({"store_id": store_id, "issued_at": {"$gte": today}},
                                         {"_id": 0}).to_list(2000)
    refund_total = round(sum(r["amount"] for r in refunds), 2)
    gross_margin = round(revenue - cogs - refund_total, 2)
    return {"day": today[:10], "revenue": revenue, "refunds": refund_total,
            "cogs": round(cogs, 2), "gross_margin": gross_margin, "fees": fees,
            "net_estimate": round(gross_margin - fees, 2),
            "margin_pct": round((gross_margin / revenue) * 100, 1) if revenue else 0}


# ── 15. ONLINE-SHOP CATALOG ───────────────────────────────────────────
@router.get("/public/catalog/{store_id}")
async def public_catalog(store_id: str):
    store = await db.pos_stores.find_one({"store_id": store_id, "status": "active"}, {"_id": 0})
    if not store:
        raise HTTPException(status_code=404, detail="Store nicht aktiv")
    products = await db.pos_products.find({"store_id": store_id, "active": True,
                                            "online_visible": {"$ne": False}},
                                           {"_id": 0, "purchase_price": 0}).to_list(5000)
    merchant = await db.pos_merchants.find_one({"merchant_id": store["merchant_id"]},
                                                {"_id": 0, "business_name": 1})
    return {"store": store, "merchant": merchant, "products": products, "total": len(products)}


# ── 16. RESERVIERUNGEN ────────────────────────────────────────────────
class ReservationCreate(BaseModel):
    store_id: str
    name: str
    phone: Optional[str] = None
    email: Optional[str] = None
    guests: int = 2
    when: str
    duration_minutes: int = 90
    table_id: Optional[str] = None
    note: Optional[str] = ""


@router.post("/reservations/create")
async def create_reservation(req: ReservationCreate, request: Request):
    user = await get_current_user(request)
    rid = short_id("RES", 10)
    doc = {"reservation_id": rid, "store_id": req.store_id, "name": req.name,
           "phone": req.phone, "email": req.email, "guests": req.guests,
           "when": req.when, "duration_minutes": req.duration_minutes,
           "table_id": req.table_id, "note": req.note, "status": "confirmed",
           "created_by": str(user["_id"]), "created_at": now_iso()}
    await db.pos_reservations.insert_one(doc)
    doc.pop("_id", None)
    return {"ok": True, "reservation": doc}


@router.get("/reservations")
async def list_reservations(request: Request, store_id: str, day: Optional[str] = None):
    user = await get_current_user(request)
    await _require_store_access(user, store_id)
    q: Dict[str, Any] = {"store_id": store_id}
    if day:
        q["when"] = {"$gte": day + "T00:00:00", "$lt": day + "T23:59:59"}
    items = await db.pos_reservations.find(q, {"_id": 0}).sort("when", 1).to_list(500)
    return {"reservations": items}


# ── 17. MARKETING CAMPAIGNS ───────────────────────────────────────────
class CampaignCreate(BaseModel):
    name: str
    subject: str
    html: str
    target_tier: Optional[str] = None
    target_inactive_days: Optional[int] = None


@router.post("/marketing/campaigns/send")
async def send_campaign(req: CampaignCreate, request: Request):
    user = await get_current_user(request)
    merchant = await _require_merchant(user)
    q: Dict[str, Any] = {"merchant_id": merchant["merchant_id"]}
    if req.target_tier and req.target_tier != "all":
        q["tier"] = req.target_tier
    members = await db.pos_loyalty.find(q, {"_id": 0}).to_list(10000)
    if req.target_inactive_days:
        cutoff = (datetime.now(timezone.utc) - timedelta(days=req.target_inactive_days)).isoformat()
        members = [m for m in members if (m.get("last_visit") or "0") < cutoff]
    sent, failed = 0, 0
    try:
        from core.email import send_email
        for m in members:
            email = m.get("customer_email")
            if not email:
                continue
            try:
                send_email(email, req.subject, req.html)
                sent += 1
            except Exception:
                failed += 1
    except Exception:
        raise HTTPException(status_code=500, detail="Email-Service nicht verfügbar")
    cid = short_id("CMP", 10)
    await db.pos_campaigns.insert_one({"campaign_id": cid, "merchant_id": merchant["merchant_id"],
                                        "name": req.name, "subject": req.subject,
                                        "target": req.dict(), "sent": sent, "failed": failed,
                                        "created_at": now_iso()})
    return {"ok": True, "campaign_id": cid, "sent": sent, "failed": failed,
            "total_members": len(members)}


# ── 18. GIFTCARDS ──────────────────────────────────────────────────────
class GiftCardCreate(BaseModel):
    amount: float
    recipient_email: Optional[str] = None
    recipient_name: Optional[str] = None
    message: Optional[str] = None


@router.post("/giftcards/create")
async def create_giftcard(req: GiftCardCreate, request: Request):
    user = await get_current_user(request)
    merchant = await _require_merchant(user)
    code = secrets.token_urlsafe(8).upper()[:10]
    doc = {"giftcard_id": short_id("GFT", 10), "code": code,
           "merchant_id": merchant["merchant_id"], "initial_amount": req.amount,
           "balance": req.amount, "recipient_email": req.recipient_email,
           "recipient_name": req.recipient_name, "message": req.message,
           "status": "active", "issued_by": str(user["_id"]), "issued_at": now_iso()}
    await db.pos_giftcards.insert_one(doc)
    doc.pop("_id", None)
    return {"ok": True, "giftcard": doc}


class GiftCardRedeem(BaseModel):
    code: str
    amount: float


@router.post("/giftcards/redeem")
async def redeem_giftcard(req: GiftCardRedeem, request: Request):
    await get_current_user(request)
    gc = await db.pos_giftcards.find_one({"code": req.code, "status": "active"})
    if not gc:
        raise HTTPException(status_code=404, detail="Gutschein ungültig")
    if gc["balance"] < req.amount:
        raise HTTPException(status_code=400, detail=f"Nur €{gc['balance']:.2f} verfügbar")
    new_balance = round(gc["balance"] - req.amount, 2)
    await db.pos_giftcards.update_one({"giftcard_id": gc["giftcard_id"]},
        {"$set": {"balance": new_balance,
                  "status": "redeemed" if new_balance == 0 else "active",
                  "last_used_at": now_iso()}})
    return {"ok": True, "redeemed": req.amount, "remaining_balance": new_balance}


# ── 19. ALTERSKONTROLLE ───────────────────────────────────────────────
class AgeCheckLog(BaseModel):
    cart_id: str
    cashier_id: str
    age_verified: bool
    minimum_age: int = 18
    method: str = "visual"


@router.post("/age-check/log")
async def log_age_check(req: AgeCheckLog, request: Request):
    user = await get_current_user(request)
    cart = await db.pos_carts.find_one({"cart_id": req.cart_id})
    if not cart:
        raise HTTPException(status_code=404, detail="Cart nicht gefunden")
    await _require_store_access(user, cart["store_id"])
    await db.pos_age_checks.insert_one({"check_id": short_id("AGE", 8), "cart_id": req.cart_id,
                                         "store_id": cart["store_id"],
                                         "cashier_id": req.cashier_id or str(user["_id"]),
                                         "age_verified": req.age_verified,
                                         "minimum_age": req.minimum_age, "method": req.method,
                                         "created_at": now_iso()})
    return {"ok": True}
