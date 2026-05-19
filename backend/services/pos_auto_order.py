from datetime import datetime, timezone, timedelta
from math import ceil
import secrets
from typing import Any, Dict, List

from core.database import db


def short_id(prefix: str, n: int = 8) -> str:
    return f"{prefix}_{secrets.token_hex(max(2, n // 2)).upper()[:n]}"


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def default_auto_order_settings(store_id: str, merchant_id: str | None = None) -> Dict[str, Any]:
    return {
        "store_id": store_id,
        "merchant_id": merchant_id,
        "enabled": False,
        "trigger_low_stock": True,
        "trigger_velocity": True,
        "trigger_daily_time": False,
        "run_time": "20:00",
        "velocity_days": 7,
        "lookahead_days": 3,
        "auto_submit_orders": True,
        "print_delivery_note": True,
        "last_run_at": None,
        "updated_at": None,
    }


async def get_auto_order_settings(store_id: str, merchant_id: str | None = None) -> Dict[str, Any]:
    doc = await db.pos_auto_order_settings.find_one({"store_id": store_id}, {"_id": 0})
    base = default_auto_order_settings(store_id, merchant_id)
    if doc:
        base.update(doc)
    return base


def _should_run_for_time(settings: Dict[str, Any], now: datetime) -> bool:
    if not settings.get("trigger_daily_time"):
        return True
    run_time = (settings.get("run_time") or "20:00").strip()
    try:
        hour, minute = [int(x) for x in run_time.split(":", 1)]
    except Exception:
        hour, minute = 20, 0
    if (now.hour, now.minute) < (hour, minute):
        return False
    last = settings.get("last_run_at")
    if last and isinstance(last, str) and last[:10] == now.date().isoformat():
        return False
    return True


async def list_auto_order_items(store_id: str) -> List[Dict[str, Any]]:
    products = await db.pos_products.find(
        {"store_id": store_id, "active": True, "track_stock": True},
        {
            "_id": 0,
            "product_id": 1,
            "name": 1,
            "barcode": 1,
            "sku": 1,
            "stock": 1,
            "minimum_stock": 1,
            "unit": 1,
            "supplier_id": 1,
            "auto_reorder_enabled": 1,
            "reorder_target_stock": 1,
            "order_unit_size": 1,
            "order_unit_label": 1,
            "reorder_note": 1,
        },
    ).sort("name", 1).to_list(1000)
    supplier_ids = [p.get("supplier_id") for p in products if p.get("supplier_id")]
    suppliers = await db.pos_suppliers.find({"supplier_id": {"$in": supplier_ids}}, {"_id": 0, "supplier_id": 1, "name": 1}).to_list(500) if supplier_ids else []
    sup_map = {s["supplier_id"]: s.get("name", "") for s in suppliers}
    for p in products:
        p["supplier_name"] = sup_map.get(p.get("supplier_id"), "")
        p["auto_reorder_enabled"] = bool(p.get("auto_reorder_enabled", False))
        p["reorder_target_stock"] = float(p.get("reorder_target_stock") or 0)
        p["order_unit_size"] = float(p.get("order_unit_size") or 1)
        p["order_unit_label"] = p.get("order_unit_label") or p.get("unit") or "Stk"
        p["reorder_note"] = p.get("reorder_note") or ""
    return products


async def save_auto_order_items(store_id: str, items: List[Dict[str, Any]]) -> int:
    updated = 0
    for item in items:
        product_id = item.get("product_id")
        if not product_id:
            continue
        await db.pos_products.update_one(
            {"store_id": store_id, "product_id": product_id},
            {
                "$set": {
                    "auto_reorder_enabled": bool(item.get("auto_reorder_enabled", False)),
                    "reorder_target_stock": float(item.get("reorder_target_stock") or 0),
                    "order_unit_size": max(float(item.get("order_unit_size") or 1), 1),
                    "order_unit_label": (item.get("order_unit_label") or "Stk").strip() or "Stk",
                    "reorder_note": (item.get("reorder_note") or "").strip(),
                    "updated_at": now_iso(),
                }
            },
        )
        updated += 1
    return updated


async def _velocity_map(store_id: str, velocity_days: int) -> Dict[str, float]:
    since = (datetime.now(timezone.utc) - timedelta(days=max(1, velocity_days))).isoformat()
    sales = await db.pos_sales.find(
        {"store_id": store_id, "status": "completed", "created_at": {"$gte": since}},
        {"_id": 0, "items": 1},
    ).to_list(1000)
    totals: Dict[str, float] = {}
    for sale in sales:
        for item in sale.get("items", []):
            pid = item.get("product_id")
            if not pid:
                continue
            totals[pid] = totals.get(pid, 0) + float(item.get("quantity") or 0)
    return {pid: qty / max(1, velocity_days) for pid, qty in totals.items()}


def _calc_required_qty(product: Dict[str, Any], settings: Dict[str, Any], daily_avg: float) -> float:
    stock = float(product.get("stock") or 0)
    minimum = float(product.get("minimum_stock") or 0)
    target = float(product.get("reorder_target_stock") or 0)
    unit_size = max(float(product.get("order_unit_size") or 1), 1)
    lookahead = max(int(settings.get("lookahead_days") or 1), 1)

    shortage_low = 0.0
    if settings.get("trigger_low_stock") and minimum > 0 and stock <= minimum:
        fallback_target = target or max(minimum * 2, minimum + unit_size)
        shortage_low = max(fallback_target - stock, unit_size)

    shortage_velocity = 0.0
    if settings.get("trigger_velocity") and daily_avg > 0:
        projected_need = daily_avg * lookahead
        fallback_target = target or projected_need
        if stock <= projected_need:
            shortage_velocity = max(fallback_target - stock, daily_avg)

    required = max(shortage_low, shortage_velocity, 0)
    if required <= 0:
        return 0
    return ceil(required / unit_size) * unit_size


async def run_auto_order_for_store(store_id: str, merchant_id: str, actor_id: str, trigger: str = "manual", force: bool = False) -> Dict[str, Any]:
    settings = await get_auto_order_settings(store_id, merchant_id)
    now = datetime.now(timezone.utc)
    if not force and not settings.get("enabled"):
        return {"ok": True, "created_pos": [], "low_stock_count": 0, "reason": "disabled"}
    if not force and not _should_run_for_time(settings, now):
        return {"ok": True, "created_pos": [], "low_stock_count": 0, "reason": "time_window"}

    products = await db.pos_products.find(
        {
            "store_id": store_id,
            "active": True,
            "track_stock": True,
            "supplier_id": {"$exists": True, "$ne": None},
            "auto_reorder_enabled": True,
        },
        {"_id": 0},
    ).to_list(1000)

    velocity = await _velocity_map(store_id, max(int(settings.get("velocity_days") or 7), 1)) if settings.get("trigger_velocity") else {}

    triggered: List[Dict[str, Any]] = []
    for product in products:
        daily_avg = float(velocity.get(product["product_id"], 0))
        qty = _calc_required_qty(product, settings, daily_avg)
        if qty <= 0:
            continue
        product["_required_qty"] = qty
        triggered.append(product)

    by_supplier: Dict[str, List[Dict[str, Any]]] = {}
    for product in triggered:
        by_supplier.setdefault(product["supplier_id"], []).append(product)

    created_pos = []
    today_prefix = now.date().isoformat()
    for supplier_id, items in by_supplier.items():
        supplier = await db.pos_suppliers.find_one({"supplier_id": supplier_id}, {"_id": 0})
        lines = []
        total = 0.0
        for product in items:
            qty = float(product["_required_qty"])
            price = float(product.get("purchase_price") or 0)
            line_total = round(qty * price, 2)
            total += line_total
            lines.append({
                "product_id": product["product_id"],
                "product_name": product["name"],
                "barcode": product.get("barcode"),
                "quantity": qty,
                "purchase_price": price,
                "line_total": line_total,
                "received": 0,
                "order_unit_size": float(product.get("order_unit_size") or 1),
                "order_unit_label": product.get("order_unit_label") or product.get("unit") or "Stk",
                "reorder_note": product.get("reorder_note") or "",
            })

        existing = await db.pos_purchase_orders.find_one(
            {
                "store_id": store_id,
                "supplier_id": supplier_id,
                "auto_generated": True,
                "status": {"$in": ["draft", "ordered"]},
                "created_at": {"$regex": f"^{today_prefix}"},
            },
            {"_id": 0},
        )

        if existing:
            merged = {line["product_id"]: dict(line) for line in existing.get("items", [])}
            for line in lines:
                if line["product_id"] in merged:
                    merged[line["product_id"]]["quantity"] = max(float(merged[line["product_id"]].get("quantity") or 0), line["quantity"])
                    merged[line["product_id"]]["line_total"] = round(merged[line["product_id"]]["quantity"] * float(merged[line["product_id"]].get("purchase_price") or 0), 2)
                else:
                    merged[line["product_id"]] = line
            merged_lines = list(merged.values())
            total = round(sum(float(line.get("line_total") or 0) for line in merged_lines), 2)
            update = {
                "items": merged_lines,
                "total_cost": total,
                "delivery_note_id": existing.get("delivery_note_id") or short_id("LFS", 10),
                "auto_order_trigger": trigger,
                "auto_order_last_run_at": now_iso(),
                "updated_at": now_iso(),
                "status": "ordered" if settings.get("auto_submit_orders") else existing.get("status", "draft"),
            }
            if settings.get("auto_submit_orders"):
                update["ordered_at"] = now_iso()
            await db.pos_purchase_orders.update_one({"po_id": existing["po_id"]}, {"$set": update})
            created_pos.append({
                "po_id": existing["po_id"],
                "supplier": supplier_id,
                "supplier_name": supplier.get("name", "") if supplier else "",
                "lines": len(merged_lines),
                "total": total,
                "delivery_note_url": f"/api/pos/purchase-orders/{existing['po_id']}/delivery-note.pdf",
            })
            continue

        po_id = short_id("PO", 12)
        status = "ordered" if settings.get("auto_submit_orders") else "draft"
        await db.pos_purchase_orders.insert_one({
            "po_id": po_id,
            "merchant_id": merchant_id,
            "store_id": store_id,
            "supplier_id": supplier_id,
            "supplier_name": supplier.get("name", "") if supplier else "",
            "items": lines,
            "total_cost": round(total, 2),
            "status": status,
            "auto_generated": True,
            "auto_order_trigger": trigger,
            "created_by": actor_id,
            "created_at": now_iso(),
            "ordered_at": now_iso() if status == "ordered" else None,
            "delivery_note_id": short_id("LFS", 10),
            "delivery_note_ready": bool(settings.get("print_delivery_note", True)),
        })
        created_pos.append({
            "po_id": po_id,
            "supplier": supplier_id,
            "supplier_name": supplier.get("name", "") if supplier else "",
            "lines": len(lines),
            "total": round(total, 2),
            "delivery_note_url": f"/api/pos/purchase-orders/{po_id}/delivery-note.pdf",
        })

    await db.pos_auto_order_settings.update_one(
        {"store_id": store_id},
        {"$set": {**settings, "merchant_id": merchant_id, "last_run_at": now_iso(), "updated_at": now_iso()}},
        upsert=True,
    )
    return {"ok": True, "created_pos": created_pos, "low_stock_count": len(triggered)}