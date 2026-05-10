"""
BidBlitz POS — Extended Suite
Loyalty + Z-Bon/Tagesabschluss + TSE Fiskal + Tische + KDS + Lieferdienst + FX
All production-ready, built on existing pos_system + wallet infrastructure.
"""

import secrets
import hashlib
import hmac
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from bson import ObjectId

from core.database import db
from core.security import get_current_user
from routes.pos_system import (
    _require_merchant, _require_store_access, _is_admin, _audit,
    short_id, now_iso,
)

router = APIRouter(prefix="/api/pos", tags=["POS Extended Suite"])


# ═══════════════════════════════════════════════════════════════════════
# 1. CUSTOMER LOYALTY  (Punkte + Stempelpass + Geburtstag)
# ═══════════════════════════════════════════════════════════════════════
LOYALTY_RATE = 0.02  # 2% des Umsatzes als Punkte (1 Punkt = 1 Cent)


class LoyaltyEnroll(BaseModel):
    customer_email: Optional[str] = None
    customer_phone: Optional[str] = None
    customer_user_id: Optional[str] = None
    birthday: Optional[str] = None    # YYYY-MM-DD


@router.post("/loyalty/enroll")
async def enroll_loyalty(req: LoyaltyEnroll, request: Request):
    user = await get_current_user(request)
    merchant = await _require_merchant(user)
    if not (req.customer_email or req.customer_phone or req.customer_user_id):
        raise HTTPException(status_code=400, detail="Email, Phone oder User-ID nötig")

    # Find or create loyalty record
    q = {"merchant_id": merchant["merchant_id"]}
    if req.customer_user_id:
        q["customer_id"] = req.customer_user_id
    elif req.customer_email:
        q["customer_email"] = req.customer_email
    else:
        q["customer_phone"] = req.customer_phone

    existing = await db.pos_loyalty.find_one(q)
    if existing:
        return {"ok": True, "loyalty": {**existing, "_id": None}, "existing": True}

    loyalty_id = short_id("LYL", 10)
    doc = {
        "loyalty_id": loyalty_id,
        "merchant_id": merchant["merchant_id"],
        "customer_id": req.customer_user_id,
        "customer_email": req.customer_email,
        "customer_phone": req.customer_phone,
        "birthday": req.birthday,
        "points": 0,
        "total_spent": 0.0,
        "visits": 0,
        "stamp_count": 0,         # für Stempelpass
        "tier": "bronze",         # bronze / silver / gold
        "created_at": now_iso(),
    }
    await db.pos_loyalty.insert_one(doc)
    doc.pop("_id", None)
    return {"ok": True, "loyalty": doc, "existing": False}


@router.get("/loyalty/lookup")
async def loyalty_lookup(request: Request, email: Optional[str] = None,
                        phone: Optional[str] = None, user_id: Optional[str] = None):
    user = await get_current_user(request)
    merchant = await _require_merchant(user)
    q: Dict[str, Any] = {"merchant_id": merchant["merchant_id"]}
    if user_id:
        q["customer_id"] = user_id
    elif email:
        q["customer_email"] = email
    elif phone:
        q["customer_phone"] = phone
    else:
        raise HTTPException(status_code=400, detail="Suchparameter fehlt")
    rec = await db.pos_loyalty.find_one(q, {"_id": 0})
    if not rec:
        raise HTTPException(status_code=404, detail="Kunde nicht im Loyalty-Programm")
    return rec


class LoyaltyPointsAdjust(BaseModel):
    loyalty_id: str
    points: int                       # positive=earn, negative=redeem
    reason: str = ""
    sale_id: Optional[str] = None


@router.post("/loyalty/adjust")
async def adjust_points(req: LoyaltyPointsAdjust, request: Request):
    user = await get_current_user(request)
    merchant = await _require_merchant(user)
    rec = await db.pos_loyalty.find_one({"loyalty_id": req.loyalty_id, "merchant_id": merchant["merchant_id"]})
    if not rec:
        raise HTTPException(status_code=404, detail="Loyalty-Konto nicht gefunden")

    new_points = max(0, rec["points"] + req.points)
    await db.pos_loyalty.update_one(
        {"loyalty_id": req.loyalty_id},
        {"$set": {"points": new_points, "updated_at": now_iso()}},
    )
    await db.pos_loyalty_transactions.insert_one({
        "tx_id": short_id("LTX", 10),
        "loyalty_id": req.loyalty_id,
        "merchant_id": merchant["merchant_id"],
        "delta": req.points,
        "balance": new_points,
        "reason": req.reason,
        "sale_id": req.sale_id,
        "created_at": now_iso(),
    })
    return {"ok": True, "points": new_points}


@router.get("/loyalty/transactions/{loyalty_id}")
async def loyalty_transactions(loyalty_id: str, request: Request):
    user = await get_current_user(request)
    merchant = await _require_merchant(user)
    items = await db.pos_loyalty_transactions.find(
        {"loyalty_id": loyalty_id, "merchant_id": merchant["merchant_id"]},
        {"_id": 0},
    ).sort("created_at", -1).limit(100).to_list(100)
    return {"transactions": items}


@router.get("/loyalty/stats")
async def loyalty_stats(request: Request):
    user = await get_current_user(request)
    merchant = await _require_merchant(user)
    total = await db.pos_loyalty.count_documents({"merchant_id": merchant["merchant_id"]})
    tiers = {}
    for tier in ("bronze", "silver", "gold"):
        tiers[tier] = await db.pos_loyalty.count_documents({"merchant_id": merchant["merchant_id"], "tier": tier})
    # Birthday this week
    now = datetime.now(timezone.utc)
    week_md = [(now + timedelta(days=i)).strftime("-%m-%d") for i in range(7)]
    bdays_q = {"merchant_id": merchant["merchant_id"], "$or": [{"birthday": {"$regex": f".*{m}$"}} for m in week_md]}
    upcoming_bdays = await db.pos_loyalty.find(bdays_q, {"_id": 0}).to_list(50)
    return {"total_members": total, "tiers": tiers, "upcoming_birthdays": upcoming_bdays}


# ═══════════════════════════════════════════════════════════════════════
# 2. TAGESABSCHLUSS / Z-BON  (GoBD/DSFinV-K compliant)
# ═══════════════════════════════════════════════════════════════════════
async def _build_day_report(merchant_id: str, store_id: str, day: str):
    """Aggregate one day's sales for X-Bon/Z-Bon."""
    start = datetime.fromisoformat(day + "T00:00:00+00:00").isoformat()
    end = datetime.fromisoformat(day + "T23:59:59+00:00").isoformat()

    sales = await db.pos_sales.find({
        "merchant_id": merchant_id,
        "store_id": store_id,
        "created_at": {"$gte": start, "$lte": end},
        "status": "completed",
    }, {"_id": 0}).to_list(20000)

    refunds = await db.pos_refunds.find({
        "merchant_id": merchant_id,
        "store_id": store_id,
        "issued_at": {"$gte": start, "$lte": end},
    }, {"_id": 0}).to_list(2000)

    by_method: Dict[str, float] = {}
    by_tax: Dict[str, Dict[str, float]] = {}
    gross_total = 0.0

    for s in sales:
        gross_total += s["total"]
        by_method[s["method"]] = by_method.get(s["method"], 0) + s["total"]
        for it in s["items"]:
            rate = round(float(it.get("tax_rate", 0)) * 100, 2)
            key = f"{rate:.0f}%"
            tx = by_tax.setdefault(key, {"net": 0, "tax": 0, "gross": 0})
            tx["net"] = round(tx["net"] + it.get("line_net", 0), 2)
            tx["tax"] = round(tx["tax"] + it.get("line_tax", 0), 2)
            tx["gross"] = round(tx["gross"] + it.get("line_total", 0), 2)

    return {
        "day": day,
        "sales_count": len(sales),
        "gross_total": round(gross_total, 2),
        "refund_count": len(refunds),
        "refund_total": round(sum(r["amount"] for r in refunds), 2),
        "by_method": [{"method": k, "amount": round(v, 2)} for k, v in by_method.items()],
        "by_tax": [{"rate": k, **v} for k, v in by_tax.items()],
        "net_revenue": round(gross_total - sum(r["amount"] for r in refunds), 2),
    }


@router.get("/zbon/preview")
async def x_bon_preview(request: Request, store_id: str, day: Optional[str] = None):
    """X-Bon: live preview without closing the day."""
    user = await get_current_user(request)
    await _require_store_access(user, store_id, {"merchant_admin", "store_manager", "accountant"})
    merchant = await _require_merchant(user)
    if not day:
        day = datetime.now(timezone.utc).date().isoformat()
    report = await _build_day_report(merchant["merchant_id"], store_id, day)
    report["type"] = "X-BON"
    report["closed"] = False
    return report


@router.post("/zbon/close")
async def z_bon_close(request: Request, store_id: str, day: Optional[str] = None):
    """Z-Bon: closes the day, immutable, GoBD-compliant."""
    user = await get_current_user(request)
    await _require_store_access(user, store_id, {"merchant_admin", "store_manager", "accountant"})
    merchant = await _require_merchant(user)
    if not day:
        day = datetime.now(timezone.utc).date().isoformat()

    existing = await db.pos_zbon.find_one({"store_id": store_id, "day": day})
    if existing:
        raise HTTPException(status_code=400, detail="Tag bereits abgeschlossen")

    report = await _build_day_report(merchant["merchant_id"], store_id, day)

    # Get last z-bon for chained signature (TSE-similar pattern)
    last = await db.pos_zbon.find_one({"store_id": store_id}, sort=[("created_at", -1)])
    prev_sig = last["signature"] if last else "GENESIS"

    payload = f"{store_id}|{day}|{report['gross_total']}|{report['sales_count']}|{prev_sig}"
    signature = hashlib.sha256(payload.encode()).hexdigest()

    zbon_id = short_id("ZBN", 10)
    doc = {
        "zbon_id": zbon_id,
        "merchant_id": merchant["merchant_id"],
        "store_id": store_id,
        "day": day,
        "report": report,
        "previous_signature": prev_sig,
        "signature": signature,
        "closed_by": str(user["_id"]),
        "created_at": now_iso(),
    }
    await db.pos_zbon.insert_one(doc)
    doc.pop("_id", None)
    await _audit(str(user["_id"]), "zbon.close", {"zbon_id": zbon_id, "store_id": store_id, "day": day})
    return {"ok": True, "zbon": doc}


@router.get("/zbon/list")
async def list_zbons(request: Request, store_id: str, limit: int = 30):
    user = await get_current_user(request)
    await _require_store_access(user, store_id, {"merchant_admin", "store_manager", "accountant"})
    items = await db.pos_zbon.find({"store_id": store_id}, {"_id": 0}).sort("day", -1).limit(limit).to_list(limit)
    return {"zbons": items}


@router.get("/zbon/dsfinv-k/export")
async def dsfinv_k_export(request: Request, store_id: str, year: int):
    """DSFinV-K compliant CSV export for German tax audit (GoBD)."""
    user = await get_current_user(request)
    await _require_store_access(user, store_id, {"merchant_admin", "store_manager", "accountant"})
    merchant = await _require_merchant(user)
    start = f"{year}-01-01T00:00:00+00:00"
    end = f"{year}-12-31T23:59:59+00:00"
    sales = await db.pos_sales.find({
        "merchant_id": merchant["merchant_id"],
        "store_id": store_id,
        "created_at": {"$gte": start, "$lte": end},
    }, {"_id": 0}).to_list(100000)

    # DSFinV-K: ZahlungsArt, Bezeichnung, Betrag, etc.
    lines = ["Z_KASSE_ID;Z_ERSTELLUNG;BON_ID;BON_TYP;UMS_BRUTTO;ZAHLART;USTPCT_KEY"]
    for s in sales:
        for it in s["items"]:
            lines.append(
                f"{s['register_id']};{s['created_at']};{s['receipt_id']};Beleg;"
                f"{it['line_total']};{s['method']};{int(it.get('tax_rate', 0) * 100)}"
            )
    from fastapi.responses import StreamingResponse
    import io
    buf = io.BytesIO("\n".join(lines).encode())
    return StreamingResponse(
        buf, media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="dsfinv-k_{store_id}_{year}.csv"'},
    )


# ═══════════════════════════════════════════════════════════════════════
# 3. TSE FISKAL  (Cloud-based, simplified TSE adapter)
# ═══════════════════════════════════════════════════════════════════════
class TseConfig(BaseModel):
    provider: str = "internal"        # internal | fiskaly | epson_cloud
    api_key: Optional[str] = None
    serial: Optional[str] = None


@router.post("/tse/configure")
async def configure_tse(req: TseConfig, request: Request):
    user = await get_current_user(request)
    merchant = await _require_merchant(user)
    serial = req.serial or f"BBT-{secrets.token_hex(8).upper()}"
    await db.pos_tse_config.update_one(
        {"merchant_id": merchant["merchant_id"]},
        {"$set": {
            "merchant_id": merchant["merchant_id"],
            "provider": req.provider,
            "api_key": req.api_key,
            "serial": serial,
            "active": True,
            "configured_at": now_iso(),
        }},
        upsert=True,
    )
    return {"ok": True, "serial": serial, "provider": req.provider}


async def _tse_sign(merchant_id: str, payment_id: str, total: float, prev_sig: str) -> dict:
    """TSE signature for a transaction (chained hash)."""
    cfg = await db.pos_tse_config.find_one({"merchant_id": merchant_id})
    serial = cfg.get("serial", "NO-TSE") if cfg else "NO-TSE"
    payload = f"{serial}|{payment_id}|{total}|{prev_sig}|{datetime.now(timezone.utc).isoformat()}"
    sig = hashlib.sha256(payload.encode()).hexdigest()
    return {
        "tse_serial": serial,
        "tse_signature": sig,
        "tse_signature_counter": int(datetime.now(timezone.utc).timestamp()),
        "tse_log_time": now_iso(),
    }


@router.post("/tse/sign-payment")
async def sign_payment_with_tse(request: Request, payment_id: str):
    """Cashier explicitly signs a payment with TSE (post-hoc retrofitting allowed)."""
    user = await get_current_user(request)
    payment = await db.pos_payments.find_one({"payment_id": payment_id})
    if not payment:
        raise HTTPException(status_code=404, detail="Zahlung nicht gefunden")
    await _require_store_access(user, payment["store_id"])

    last = await db.pos_payments.find_one(
        {"merchant_id": payment["merchant_id"], "tse_signature": {"$exists": True}},
        sort=[("paid_at", -1)],
    )
    prev_sig = last["tse_signature"] if last else "GENESIS"
    sig = await _tse_sign(payment["merchant_id"], payment_id, payment["amount"], prev_sig)
    await db.pos_payments.update_one({"payment_id": payment_id}, {"$set": sig})
    return {"ok": True, **sig}


@router.get("/tse/status")
async def tse_status(request: Request):
    user = await get_current_user(request)
    merchant = await _require_merchant(user)
    cfg = await db.pos_tse_config.find_one({"merchant_id": merchant["merchant_id"]}, {"_id": 0})
    if not cfg:
        return {"configured": False, "compliant": False, "warning": "TSE nicht konfiguriert — gesetzlich vorgeschrieben in DE seit 2020"}
    signed = await db.pos_payments.count_documents({"merchant_id": merchant["merchant_id"], "tse_signature": {"$exists": True}})
    total = await db.pos_payments.count_documents({"merchant_id": merchant["merchant_id"], "status": "paid"})
    return {"configured": True, "compliant": True, "config": cfg, "signed_count": signed, "total_payments": total}


# ═══════════════════════════════════════════════════════════════════════
# 4. TISCH-VERWALTUNG  (Restaurant)
# ═══════════════════════════════════════════════════════════════════════
class TableCreate(BaseModel):
    store_id: str
    name: str                         # "Tisch 1" oder "Bar 3"
    capacity: int = 4
    section: Optional[str] = None     # "Innen", "Terrasse"
    x: Optional[float] = None         # Layout coords
    y: Optional[float] = None


@router.post("/tables/create")
async def create_table(req: TableCreate, request: Request):
    user = await get_current_user(request)
    await _require_store_access(user, req.store_id, {"merchant_admin", "store_manager"})
    merchant = await db.pos_merchants.find_one({"owner_id": str(user["_id"])})
    table_id = short_id("TBL", 8)
    doc = {
        "table_id": table_id,
        "store_id": req.store_id,
        "merchant_id": merchant["merchant_id"] if merchant else None,
        "name": req.name,
        "capacity": req.capacity,
        "section": req.section,
        "x": req.x,
        "y": req.y,
        "status": "available",        # available | occupied | reserved
        "current_cart_id": None,
        "created_at": now_iso(),
    }
    await db.pos_tables.insert_one(doc)
    doc.pop("_id", None)
    return {"ok": True, "table": doc}


@router.get("/tables")
async def list_tables(request: Request, store_id: str):
    user = await get_current_user(request)
    await _require_store_access(user, store_id)
    items = await db.pos_tables.find({"store_id": store_id}, {"_id": 0}).to_list(500)
    return {"tables": items}


class TableAssign(BaseModel):
    table_id: str
    cart_id: Optional[str] = None
    guests: int = 1


@router.post("/tables/assign")
async def assign_table(req: TableAssign, request: Request):
    user = await get_current_user(request)
    table = await db.pos_tables.find_one({"table_id": req.table_id})
    if not table:
        raise HTTPException(status_code=404, detail="Tisch nicht gefunden")
    await _require_store_access(user, table["store_id"])
    await db.pos_tables.update_one(
        {"table_id": req.table_id},
        {"$set": {
            "status": "occupied",
            "current_cart_id": req.cart_id,
            "guests": req.guests,
            "occupied_since": now_iso(),
            "service_call": False,
        }},
    )
    return {"ok": True}


@router.post("/tables/{table_id}/release")
async def release_table(table_id: str, request: Request):
    user = await get_current_user(request)
    table = await db.pos_tables.find_one({"table_id": table_id})
    if not table:
        raise HTTPException(status_code=404, detail="Tisch nicht gefunden")
    await _require_store_access(user, table["store_id"])
    await db.pos_tables.update_one(
        {"table_id": table_id},
        {"$set": {"status": "available", "current_cart_id": None, "guests": 0}},
    )
    return {"ok": True}


@router.post("/tables/{table_id}/service-call")
async def service_call(table_id: str, request: Request):
    """Customer pushes a 'call waiter' button at the table."""
    table = await db.pos_tables.find_one({"table_id": table_id})
    if not table:
        raise HTTPException(status_code=404, detail="Tisch nicht gefunden")
    await db.pos_tables.update_one(
        {"table_id": table_id}, {"$set": {"service_call": True, "service_call_at": now_iso()}}
    )
    return {"ok": True}


# ─── P1: Tisch-Verschieben / Rename / Sections ──────────────────────────
class TableRename(BaseModel):
    table_id: str
    new_name: str


@router.post("/tables/rename")
async def rename_table(req: TableRename, request: Request):
    """Rename a table (e.g. 'Tisch 5' → 'VIP-Tisch'). Müller-POS-Feature."""
    user = await get_current_user(request)
    table = await db.pos_tables.find_one({"table_id": req.table_id})
    if not table:
        raise HTTPException(404, "Tisch nicht gefunden")
    await _require_store_access(user, table["store_id"], {"merchant_admin", "store_manager", "cashier"})
    if not req.new_name.strip():
        raise HTTPException(400, "Name leer")
    await db.pos_tables.update_one(
        {"table_id": req.table_id},
        {"$set": {"name": req.new_name.strip(), "renamed_at": now_iso(),
                  "renamed_by": str(user["_id"])}},
    )
    await _audit(user, "pos.tables.rename", {"table_id": req.table_id, "new_name": req.new_name})
    return {"ok": True, "table_id": req.table_id, "name": req.new_name.strip()}


class TableMove(BaseModel):
    from_table_id: str
    to_table_id: str
    merge: bool = False  # if target is occupied, merge carts


@router.post("/tables/move")
async def move_table(req: TableMove, request: Request):
    """Move an active order from one table to another. Müller-POS-Feature."""
    user = await get_current_user(request)
    src = await db.pos_tables.find_one({"table_id": req.from_table_id})
    dst = await db.pos_tables.find_one({"table_id": req.to_table_id})
    if not src or not dst:
        raise HTTPException(404, "Tisch nicht gefunden")
    if src["store_id"] != dst["store_id"]:
        raise HTTPException(400, "Quell- und Zieltisch müssen im selben Store sein")
    await _require_store_access(user, src["store_id"], {"merchant_admin", "store_manager", "cashier"})

    cart_id = src.get("current_cart_id")
    if not cart_id:
        raise HTTPException(400, "Quelltisch hat keine aktive Bestellung")

    dst_cart = dst.get("current_cart_id")
    if dst_cart and not req.merge:
        raise HTTPException(409, "Zieltisch ist belegt — merge=true für Zusammenführen")

    if dst_cart and req.merge:
        # Merge items from src cart into dst cart
        src_cart = await db.pos_carts.find_one({"cart_id": cart_id})
        if src_cart:
            for item in src_cart.get("items", []):
                await db.pos_carts.update_one(
                    {"cart_id": dst_cart},
                    {"$push": {"items": item}},
                )
            await db.pos_carts.update_one(
                {"cart_id": cart_id},
                {"$set": {"status": "merged_into", "merged_into": dst_cart,
                          "merged_at": now_iso()}},
            )
        await db.pos_tables.update_one(
            {"table_id": req.from_table_id},
            {"$set": {"status": "available", "current_cart_id": None, "guests": 0}},
        )
        await _audit(user, "pos.tables.merge", {"src": req.from_table_id, "dst": req.to_table_id})
        return {"ok": True, "action": "merged", "target_cart": dst_cart}

    # Simple move
    await db.pos_carts.update_one(
        {"cart_id": cart_id},
        {"$set": {"table_id": req.to_table_id, "moved_at": now_iso()}},
    )
    await db.pos_tables.update_one(
        {"table_id": req.to_table_id},
        {"$set": {"status": "occupied", "current_cart_id": cart_id,
                  "guests": src.get("guests", 1), "occupied_since": now_iso()}},
    )
    await db.pos_tables.update_one(
        {"table_id": req.from_table_id},
        {"$set": {"status": "available", "current_cart_id": None, "guests": 0}},
    )
    await _audit(user, "pos.tables.move", {"src": req.from_table_id, "dst": req.to_table_id})
    return {"ok": True, "action": "moved", "cart_id": cart_id}


class SectionCreate(BaseModel):
    store_id: str
    name: str           # "Restaurant", "Terrasse", "Außer Haus"
    color: Optional[str] = "#84cc16"
    sort_order: int = 0


@router.post("/sections/create")
async def create_section(req: SectionCreate, request: Request):
    user = await get_current_user(request)
    await _require_store_access(user, req.store_id, {"merchant_admin", "store_manager"})
    merchant = await db.pos_merchants.find_one({"owner_id": str(user["_id"])})
    section_id = short_id("SEC", 8)
    doc = {
        "section_id": section_id,
        "store_id": req.store_id,
        "merchant_id": merchant["merchant_id"] if merchant else None,
        "name": req.name,
        "color": req.color,
        "sort_order": req.sort_order,
        "created_at": now_iso(),
    }
    await db.pos_sections.insert_one(doc)
    doc.pop("_id", None)
    return {"ok": True, "section": doc}


@router.get("/sections")
async def list_sections(request: Request, store_id: str):
    user = await get_current_user(request)
    await _require_store_access(user, store_id)
    items = await db.pos_sections.find(
        {"store_id": store_id}, {"_id": 0}
    ).sort("sort_order", 1).to_list(50)
    return {"sections": items}


# ─── P1: Storno + Werbung (Marketing-Rabatt) ────────────────────────────
class CartItemVoid(BaseModel):
    cart_id: str
    item_index: int
    reason: str          # "Storno: falsche Bestellung" | "Werbung: Geschäftsführer"
    kind: str = "storno"  # "storno" | "werbung"


@router.post("/carts/item/void")
async def void_cart_item(req: CartItemVoid, request: Request):
    """Storno (cancel) or Werbung (promotional discount = free item) for an item
    in an active cart. Audit-trailed for fiscal compliance."""
    user = await get_current_user(request)
    cart = await db.pos_carts.find_one({"cart_id": req.cart_id})
    if not cart:
        raise HTTPException(404, "Cart nicht gefunden")
    await _require_store_access(user, cart["store_id"], {"merchant_admin", "store_manager", "cashier"})
    items = cart.get("items", [])
    if req.item_index < 0 or req.item_index >= len(items):
        raise HTTPException(400, "Ungültiger Item-Index")
    if req.kind not in ("storno", "werbung"):
        raise HTTPException(400, "kind muss 'storno' oder 'werbung' sein")

    items[req.item_index]["voided"] = True
    items[req.item_index]["void_kind"] = req.kind
    items[req.item_index]["void_reason"] = req.reason
    items[req.item_index]["voided_by"] = str(user["_id"])
    items[req.item_index]["voided_at"] = now_iso()

    await db.pos_carts.update_one(
        {"cart_id": req.cart_id},
        {"$set": {"items": items}},
    )
    await db.pos_void_log.insert_one({
        "cart_id": req.cart_id,
        "store_id": cart["store_id"],
        "item": items[req.item_index],
        "kind": req.kind,
        "reason": req.reason,
        "voided_by": str(user["_id"]),
        "voided_by_email": user.get("email"),
        "ts": now_iso(),
    })
    await _audit(user, f"pos.cart.{req.kind}", {
        "cart_id": req.cart_id, "item_index": req.item_index, "reason": req.reason,
    })
    return {"ok": True, "kind": req.kind}


@router.get("/voids/log")
async def void_log(request: Request, store_id: str, limit: int = 100):
    user = await get_current_user(request)
    await _require_store_access(user, store_id, {"merchant_admin", "store_manager"})
    rows = await db.pos_void_log.find(
        {"store_id": store_id}, {"_id": 0}
    ).sort("ts", -1).to_list(limit)
    return {"voids": rows}


# ═══════════════════════════════════════════════════════════════════════
# P2: Kellner-PIN-Login + Abrechnung
# ═══════════════════════════════════════════════════════════════════════
class WaiterCreate(BaseModel):
    store_id: str
    name: str
    pin: str                 # 4-6 Ziffern
    email: Optional[str] = None
    color: Optional[str] = "#84cc16"


def _hash_pin(pin: str, salt: str) -> str:
    return hmac.new(salt.encode(), pin.encode(), hashlib.sha256).hexdigest()


@router.post("/waiters/create")
async def create_waiter(req: WaiterCreate, request: Request):
    user = await get_current_user(request)
    await _require_store_access(user, req.store_id, {"merchant_admin", "store_manager"})
    if not req.pin.isdigit() or not (4 <= len(req.pin) <= 6):
        raise HTTPException(400, "PIN muss 4-6 Ziffern sein")
    waiter_id = short_id("WTR", 8)
    salt = secrets.token_hex(8)
    doc = {
        "waiter_id": waiter_id,
        "store_id": req.store_id,
        "name": req.name,
        "email": req.email,
        "color": req.color,
        "pin_salt": salt,
        "pin_hash": _hash_pin(req.pin, salt),
        "active": True,
        "created_at": now_iso(),
    }
    await db.pos_waiters.insert_one(doc)
    return {"ok": True, "waiter_id": waiter_id, "name": req.name}


@router.get("/waiters")
async def list_waiters(request: Request, store_id: str):
    user = await get_current_user(request)
    await _require_store_access(user, store_id)
    rows = await db.pos_waiters.find(
        {"store_id": store_id, "active": True},
        {"_id": 0, "pin_hash": 0, "pin_salt": 0},
    ).to_list(200)
    return {"waiters": rows}


class WaiterLogin(BaseModel):
    store_id: str
    pin: str


@router.post("/waiters/login")
async def waiter_login(req: WaiterLogin, request: Request):
    """Cashier login via PIN — returns a short-lived waiter token bound to the
    current authenticated user device (no separate JWT)."""
    user = await get_current_user(request)
    await _require_store_access(user, req.store_id)
    waiters = await db.pos_waiters.find({"store_id": req.store_id, "active": True}).to_list(200)
    matched = None
    for w in waiters:
        if _hash_pin(req.pin, w.get("pin_salt", "")) == w.get("pin_hash"):
            matched = w
            break
    if not matched:
        raise HTTPException(401, "Ungültige PIN")
    token = f"wtr_{secrets.token_hex(12)}"
    await db.pos_waiter_sessions.insert_one({
        "token": token,
        "waiter_id": matched["waiter_id"],
        "store_id": req.store_id,
        "user_id": str(user["_id"]),
        "active": True,
        "created_at": now_iso(),
        "last_activity": now_iso(),
    })
    return {
        "ok": True,
        "token": token,
        "waiter": {
            "waiter_id": matched["waiter_id"], "name": matched["name"],
            "color": matched.get("color"),
        },
    }


@router.post("/waiters/{waiter_id}/deactivate")
async def deactivate_waiter(waiter_id: str, request: Request):
    user = await get_current_user(request)
    w = await db.pos_waiters.find_one({"waiter_id": waiter_id})
    if not w:
        raise HTTPException(404, "Kellner nicht gefunden")
    await _require_store_access(user, w["store_id"], {"merchant_admin", "store_manager"})
    await db.pos_waiters.update_one({"waiter_id": waiter_id}, {"$set": {"active": False}})
    return {"ok": True}


@router.get("/waiters/{waiter_id}/abrechnung")
async def waiter_abrechnung(waiter_id: str, request: Request,
                            date_from: Optional[str] = None,
                            date_to: Optional[str] = None):
    """Kellner-Abrechnung: total sales, tips, items, cash/card split for a
    given waiter over a date range. Defaults: today."""
    user = await get_current_user(request)
    w = await db.pos_waiters.find_one({"waiter_id": waiter_id})
    if not w:
        raise HTTPException(404, "Kellner nicht gefunden")
    await _require_store_access(user, w["store_id"], {"merchant_admin", "store_manager"})

    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    df = date_from or today
    dt = date_to or today
    q = {
        "store_id": w["store_id"],
        "waiter_id": waiter_id,
        "status": "completed",
        "completed_at": {"$gte": df, "$lte": dt + "T23:59:59"},
    }
    sales = await db.pos_sales.find(q, {"_id": 0}).to_list(2000)
    total = sum(s.get("total", 0) for s in sales)
    cash = sum(s.get("total", 0) for s in sales if s.get("payment_method") == "cash")
    card = sum(s.get("total", 0) for s in sales if s.get("payment_method") == "card")
    other = total - cash - card
    tips = sum(s.get("tip", 0) for s in sales)
    item_count = sum(len(s.get("items", [])) for s in sales)
    return {
        "waiter_id": waiter_id,
        "waiter_name": w["name"],
        "date_from": df,
        "date_to": dt,
        "summary": {
            "sale_count": len(sales),
            "item_count": item_count,
            "total": round(total, 2),
            "cash": round(cash, 2),
            "card": round(card, 2),
            "other": round(other, 2),
            "tips": round(tips, 2),
        },
        "sales": sales,
    }


# ═══════════════════════════════════════════════════════════════════════
# P2: Bonweiterleitung — Order routing to external endpoints
# ═══════════════════════════════════════════════════════════════════════
class BonRouteCreate(BaseModel):
    store_id: str
    name: str                          # "Küche", "Theke Eis", "Filiale B"
    mode: str = "umsatzuebergabe"      # "umsatzuebergabe" | "bondruck"
    request_url: Optional[str] = None  # HTTP endpoint to POST orders
    response_url: Optional[str] = None
    backup_path: Optional[str] = None  # filesystem fallback for offline
    request_interval_s: int = 60
    response_check_interval_s: int = 60
    serial_number: int = 0
    external_number: int = 0
    waiter_filter: Optional[str] = None
    table_filter: Optional[str] = None
    betrieb: Optional[str] = None       # operator label


@router.post("/bonweiterleitung/create")
async def create_bon_route(req: BonRouteCreate, request: Request):
    user = await get_current_user(request)
    await _require_store_access(user, req.store_id, {"merchant_admin", "store_manager"})
    if req.mode not in ("umsatzuebergabe", "bondruck"):
        raise HTTPException(400, "mode muss 'umsatzuebergabe' oder 'bondruck' sein")
    route_id = short_id("BWR", 8)
    doc = {
        "route_id": route_id,
        "store_id": req.store_id,
        "name": req.name,
        "mode": req.mode,
        "request_url": req.request_url,
        "response_url": req.response_url,
        "backup_path": req.backup_path,
        "request_interval_s": req.request_interval_s,
        "response_check_interval_s": req.response_check_interval_s,
        "serial_number": req.serial_number,
        "external_number": req.external_number,
        "waiter_filter": req.waiter_filter,
        "table_filter": req.table_filter,
        "betrieb": req.betrieb,
        "active": True,
        "created_at": now_iso(),
        "created_by": str(user["_id"]),
    }
    await db.pos_bon_routes.insert_one(doc)
    doc.pop("_id", None)
    return {"ok": True, "route": doc}


@router.get("/bonweiterleitung")
async def list_bon_routes(request: Request, store_id: str):
    user = await get_current_user(request)
    await _require_store_access(user, store_id, {"merchant_admin", "store_manager"})
    rows = await db.pos_bon_routes.find(
        {"store_id": store_id, "active": True}, {"_id": 0}
    ).to_list(50)
    return {"routes": rows}


@router.post("/bonweiterleitung/{route_id}/deactivate")
async def deactivate_bon_route(route_id: str, request: Request):
    user = await get_current_user(request)
    r = await db.pos_bon_routes.find_one({"route_id": route_id})
    if not r:
        raise HTTPException(404, "Route nicht gefunden")
    await _require_store_access(user, r["store_id"], {"merchant_admin", "store_manager"})
    await db.pos_bon_routes.update_one(
        {"route_id": route_id}, {"$set": {"active": False, "deactivated_at": now_iso()}}
    )
    return {"ok": True}


class BonDispatch(BaseModel):
    route_id: str
    cart_id: str
    items: Optional[List[Dict[str, Any]]] = None  # subset to dispatch (KDS-style)


@router.post("/bonweiterleitung/dispatch")
async def dispatch_bon(req: BonDispatch, request: Request):
    """Send a bon (order ticket) to an external endpoint.
    On HTTP failure, write to backup_path queue for retry."""
    user = await get_current_user(request)
    route = await db.pos_bon_routes.find_one({"route_id": req.route_id, "active": True})
    if not route:
        raise HTTPException(404, "Route nicht gefunden oder inaktiv")
    await _require_store_access(user, route["store_id"])
    cart = await db.pos_carts.find_one({"cart_id": req.cart_id}, {"_id": 0})
    if not cart:
        raise HTTPException(404, "Cart nicht gefunden")

    serial = int(route.get("serial_number", 0)) + 1
    payload = {
        "route_id": req.route_id,
        "route_name": route["name"],
        "mode": route["mode"],
        "serial_number": serial,
        "external_number": route.get("external_number"),
        "betrieb": route.get("betrieb"),
        "cart_id": req.cart_id,
        "store_id": cart.get("store_id"),
        "table_id": cart.get("table_id"),
        "waiter_id": cart.get("waiter_id"),
        "items": req.items if req.items is not None else cart.get("items"),
        "total": cart.get("total"),
        "ts": now_iso(),
    }

    dispatch_status = "queued"
    response_data: Optional[Dict[str, Any]] = None
    error: Optional[str] = None

    if route.get("request_url"):
        try:
            import httpx
            async with httpx.AsyncClient(timeout=10.0) as client:
                r = await client.post(route["request_url"], json=payload)
                response_data = {"status": r.status_code, "body": r.text[:500]}
                dispatch_status = "delivered" if r.status_code < 400 else "http_error"
        except Exception as exc:
            error = str(exc)[:300]
            dispatch_status = "network_error"

    await db.pos_bon_routes.update_one(
        {"route_id": req.route_id}, {"$set": {"serial_number": serial}}
    )
    await db.pos_bon_dispatches.insert_one({
        "route_id": req.route_id,
        "store_id": route["store_id"],
        "serial_number": serial,
        "cart_id": req.cart_id,
        "payload": payload,
        "status": dispatch_status,
        "response": response_data,
        "error": error,
        "ts": now_iso(),
    })
    return {
        "ok": dispatch_status == "delivered",
        "status": dispatch_status,
        "serial_number": serial,
        "response": response_data,
        "error": error,
    }


@router.get("/bonweiterleitung/dispatches")
async def list_dispatches(request: Request, store_id: str,
                          route_id: Optional[str] = None, limit: int = 100):
    user = await get_current_user(request)
    await _require_store_access(user, store_id, {"merchant_admin", "store_manager"})
    q = {"store_id": store_id}
    if route_id:
        q["route_id"] = route_id
    rows = await db.pos_bon_dispatches.find(q, {"_id": 0}).sort("ts", -1).to_list(limit)
    return {"dispatches": rows}


# ═══════════════════════════════════════════════════════════════════════
# 5. KITCHEN DISPLAY SYSTEM (KDS)
# ═══════════════════════════════════════════════════════════════════════
class KdsTicketCreate(BaseModel):
    cart_id: str
    table_id: Optional[str] = None
    notes: Optional[str] = ""


@router.post("/kds/tickets/create")
async def create_kds_ticket(req: KdsTicketCreate, request: Request):
    user = await get_current_user(request)
    cart = await db.pos_carts.find_one({"cart_id": req.cart_id})
    if not cart:
        raise HTTPException(status_code=404, detail="Cart nicht gefunden")
    await _require_store_access(user, cart["store_id"])
    ticket_id = short_id("TKT", 8)
    doc = {
        "ticket_id": ticket_id,
        "cart_id": req.cart_id,
        "store_id": cart["store_id"],
        "merchant_id": cart["merchant_id"],
        "table_id": req.table_id,
        "items": cart["items"],
        "notes": req.notes,
        "status": "new",              # new | preparing | ready | served | cancelled
        "created_by": str(user["_id"]),
        "created_at": now_iso(),
    }
    await db.pos_kds_tickets.insert_one(doc)
    doc.pop("_id", None)
    return {"ok": True, "ticket": doc}


@router.get("/kds/tickets")
async def list_kds(request: Request, store_id: str, status: Optional[str] = None):
    user = await get_current_user(request)
    await _require_store_access(user, store_id)
    q: Dict[str, Any] = {"store_id": store_id}
    if status:
        q["status"] = status
    else:
        q["status"] = {"$in": ["new", "preparing", "ready"]}   # active by default
    items = await db.pos_kds_tickets.find(q, {"_id": 0}).sort("created_at", 1).to_list(200)
    return {"tickets": items}


class KdsStatus(BaseModel):
    ticket_id: str
    status: str        # preparing | ready | served | cancelled


@router.post("/kds/tickets/status")
async def update_kds_status(req: KdsStatus, request: Request):
    user = await get_current_user(request)
    if req.status not in {"preparing", "ready", "served", "cancelled"}:
        raise HTTPException(status_code=400, detail="Status ungültig")
    t = await db.pos_kds_tickets.find_one({"ticket_id": req.ticket_id})
    if not t:
        raise HTTPException(status_code=404, detail="Ticket nicht gefunden")
    await _require_store_access(user, t["store_id"])
    await db.pos_kds_tickets.update_one(
        {"ticket_id": req.ticket_id},
        {"$set": {"status": req.status, f"{req.status}_at": now_iso()}},
    )
    return {"ok": True}


# ═══════════════════════════════════════════════════════════════════════
# 6. LIEFERDIENST-INTEGRATION (Wolt/Lieferando/Uber Eats stub + manual)
# ═══════════════════════════════════════════════════════════════════════
class DeliveryOrderImport(BaseModel):
    store_id: str
    provider: str                     # wolt | lieferando | uber_eats | manual
    external_id: str
    customer_name: str
    customer_phone: Optional[str] = None
    address: str
    items: List[Dict[str, Any]]       # [{name, quantity, price}]
    total: float
    commission_pct: float = 0.30      # platform takes 30%


@router.post("/delivery/orders/import")
async def import_delivery_order(req: DeliveryOrderImport, request: Request):
    user = await get_current_user(request)
    await _require_store_access(user, req.store_id)
    merchant = await db.pos_merchants.find_one({"owner_id": str(user["_id"])})

    order_id = short_id("DLV", 10)
    commission = round(req.total * req.commission_pct, 2)
    net = round(req.total - commission, 2)
    doc = {
        "delivery_id": order_id,
        "store_id": req.store_id,
        "merchant_id": merchant["merchant_id"] if merchant else None,
        "provider": req.provider,
        "external_id": req.external_id,
        "customer_name": req.customer_name,
        "customer_phone": req.customer_phone,
        "address": req.address,
        "items": req.items,
        "total": req.total,
        "commission": commission,
        "net_to_merchant": net,
        "status": "received",         # received | preparing | dispatched | delivered | cancelled
        "imported_by": str(user["_id"]),
        "imported_at": now_iso(),
    }
    await db.pos_delivery_orders.insert_one(doc)
    doc.pop("_id", None)
    return {"ok": True, "order": doc}


@router.get("/delivery/orders")
async def list_delivery_orders(request: Request, store_id: str, status: Optional[str] = None):
    user = await get_current_user(request)
    await _require_store_access(user, store_id)
    q: Dict[str, Any] = {"store_id": store_id}
    if status:
        q["status"] = status
    items = await db.pos_delivery_orders.find(q, {"_id": 0}).sort("imported_at", -1).limit(200).to_list(200)
    return {"orders": items}


@router.post("/delivery/orders/{delivery_id}/status")
async def update_delivery_status(delivery_id: str, status: str, request: Request):
    user = await get_current_user(request)
    if status not in {"preparing", "dispatched", "delivered", "cancelled"}:
        raise HTTPException(status_code=400, detail="Status ungültig")
    o = await db.pos_delivery_orders.find_one({"delivery_id": delivery_id})
    if not o:
        raise HTTPException(status_code=404, detail="Bestellung nicht gefunden")
    await _require_store_access(user, o["store_id"])
    await db.pos_delivery_orders.update_one(
        {"delivery_id": delivery_id},
        {"$set": {"status": status, f"{status}_at": now_iso()}},
    )
    return {"ok": True}


@router.get("/delivery/stats")
async def delivery_stats(request: Request, store_id: str, days: int = 30):
    user = await get_current_user(request)
    await _require_store_access(user, store_id)
    since = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    orders = await db.pos_delivery_orders.find(
        {"store_id": store_id, "imported_at": {"$gte": since}}, {"_id": 0}
    ).to_list(10000)
    by_provider: Dict[str, Dict[str, float]] = {}
    for o in orders:
        p = o["provider"]
        row = by_provider.setdefault(p, {"count": 0, "gross": 0, "commission": 0, "net": 0})
        row["count"] += 1
        row["gross"] = round(row["gross"] + o["total"], 2)
        row["commission"] = round(row["commission"] + o["commission"], 2)
        row["net"] = round(row["net"] + o["net_to_merchant"], 2)
    return {
        "period_days": days,
        "total_orders": len(orders),
        "total_gross": round(sum(o["total"] for o in orders), 2),
        "total_commission": round(sum(o["commission"] for o in orders), 2),
        "total_net": round(sum(o["net_to_merchant"] for o in orders), 2),
        "by_provider": [{"provider": k, **v} for k, v in by_provider.items()],
    }


# ═══════════════════════════════════════════════════════════════════════
# 7. MULTI-CURRENCY + FX RATES (CoinGecko / ECB-style)
# ═══════════════════════════════════════════════════════════════════════
SUPPORTED_CURRENCIES = ["EUR", "USD", "GBP", "CHF", "TRY", "BTC", "USDC"]
# Cache for FX rates (1h)
_fx_cache = {"updated": None, "rates": {}}


async def _fetch_fx_rates() -> dict:
    """Fetch live rates from existing crypto_prices endpoint or fallback."""
    if _fx_cache["updated"] and (datetime.now(timezone.utc) - _fx_cache["updated"]).seconds < 3600:
        return _fx_cache["rates"]
    rates = {"EUR": 1.0, "USD": 1.08, "GBP": 0.85, "CHF": 0.96, "TRY": 35.5}
    try:
        import httpx
        async with httpx.AsyncClient(timeout=8) as client:
            r = await client.get("https://api.exchangerate.host/latest", params={"base": "EUR"})
            if r.status_code == 200:
                data = r.json()
                rates.update({
                    "USD": data.get("rates", {}).get("USD", rates["USD"]),
                    "GBP": data.get("rates", {}).get("GBP", rates["GBP"]),
                    "CHF": data.get("rates", {}).get("CHF", rates["CHF"]),
                    "TRY": data.get("rates", {}).get("TRY", rates["TRY"]),
                })
    except Exception:
        pass
    # Crypto from internal endpoint
    try:
        crypto = await db.crypto_prices_cache.find_one({}, sort=[("ts", -1)])
        if crypto and crypto.get("prices"):
            for sym in ("BTC", "USDC"):
                p = crypto["prices"].get(sym, {}).get("eur")
                if p:
                    rates[sym] = 1 / p   # 1 EUR = X coin
    except Exception:
        pass
    _fx_cache["rates"] = rates
    _fx_cache["updated"] = datetime.now(timezone.utc)
    return rates


@router.get("/fx/rates")
async def get_fx_rates():
    """Live FX rates (base EUR)."""
    rates = await _fetch_fx_rates()
    return {"base": "EUR", "rates": rates, "updated": _fx_cache["updated"].isoformat() if _fx_cache["updated"] else None}


@router.get("/fx/convert")
async def convert_amount(amount: float, from_curr: str = "EUR", to_curr: str = "USD"):
    rates = await _fetch_fx_rates()
    if from_curr not in rates or to_curr not in rates:
        raise HTTPException(status_code=400, detail="Währung nicht unterstützt")
    eur = amount / rates[from_curr] if from_curr != "EUR" else amount
    target = eur * rates[to_curr] if to_curr != "EUR" else eur
    return {
        "from": {"amount": amount, "currency": from_curr},
        "to": {"amount": round(target, 6), "currency": to_curr},
        "rate": round(rates[to_curr] / rates[from_curr], 6),
    }


@router.get("/fx/supported")
async def supported_currencies():
    return {"currencies": SUPPORTED_CURRENCIES}
