"""
P1/P2 Features Extension — 
Bulk-Discount, Performance-Metrics, Cash-Management-Advanced,
Vendor-Return, AI-Upsell, Shelf-QR, Pick-by-Light, Video-Replay
"""
import secrets
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from core.database import db
from core.security import get_current_user
from routes.pos_system import (
    _require_merchant, _require_store_access, short_id, now_iso,
)

router = APIRouter(prefix="/api/pos/retail", tags=["POS Retail P1P2"])


# ═══════════════════════════════════════════════════════════════════════
# P1-5: BULK-DISCOUNT ENGINE (3 für 2, Mengenrabatt)
# ═══════════════════════════════════════════════════════════════════════

class BulkDiscountRule(BaseModel):
    product_id: Optional[str] = None
    category: Optional[str] = None
    buy_quantity: int = 3
    pay_quantity: int = 2  # 3 kaufen, 2 bezahlen
    discount_percent: Optional[float] = None  # Alternative: 10% bei 10 Stk

@router.post("/bulk-discount/create")
async def create_bulk_discount(req: BulkDiscountRule, request: Request, store_id: str):
    user = await get_current_user(request)
    await _require_store_access(user, store_id, {"merchant_admin"})
    
    rule_id = short_id("BDR", 10)
    await db.pos_bulk_discount_rules.insert_one({
        "rule_id": rule_id,
        "store_id": store_id,
        **req.dict(),
        "active": True,
        "created_at": now_iso(),
    })
    return {"ok": True, "rule_id": rule_id}

@router.post("/cart/apply-bulk-discounts")
async def apply_bulk_discounts(request: Request, cart_id: str):
    """Prüft Cart-Items gegen Bulk-Discount-Regeln."""
    await get_current_user(request)
    cart = await db.pos_carts.find_one({"cart_id": cart_id})
    if not cart:
        raise HTTPException(status_code=404, detail="Cart nicht gefunden")
    
    rules = await db.pos_bulk_discount_rules.find(
        {"store_id": cart["store_id"], "active": True}
    ).to_list(50)
    
    total_discount = 0.0
    applied_rules = []
    for it in cart["items"]:
        for rule in rules:
            if (rule.get("product_id") == it.get("product_id") or 
                (rule.get("category") and it.get("category") == rule["category"])):
                qty = float(it["quantity"])
                if rule.get("buy_quantity") and qty >= rule["buy_quantity"]:
                    # 3 für 2
                    free_items = int(qty // rule["buy_quantity"]) * (rule["buy_quantity"] - rule["pay_quantity"])
                    discount = round(free_items * float(it["unit_price"]), 2)
                    total_discount += discount
                    applied_rules.append({"product": it["name"], "discount": discount, "rule": rule["rule_id"]})
    
    return {"cart_id": cart_id, "total_discount": total_discount, "applied_rules": applied_rules}


# ═══════════════════════════════════════════════════════════════════════
# P1-6: EMPLOYEE PERFORMANCE METRICS
# ═══════════════════════════════════════════════════════════════════════

@router.get("/metrics/employee-performance")
async def employee_performance(request: Request, store_id: str, days: int = 7):
    user = await get_current_user(request)
    await _require_store_access(user, store_id, {"merchant_admin", "store_manager"})
    
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    
    # Sales pro Mitarbeiter
    sales = await db.pos_sales.aggregate([
        {"$match": {"store_id": store_id, "created_at": {"$gte": cutoff}, "status": "completed"}},
        {"$group": {
            "_id": "$cashier_id",
            "sales_count": {"$sum": 1},
            "total_revenue": {"$sum": "$total"},
        }}
    ]).to_list(100)
    
    # Scan-Geschwindigkeit (Items/Stunde)
    for s in sales:
        shifts = await db.pos_shifts.find({
            "cashier_id": s["_id"],
            "store_id": store_id,
            "opened_at": {"$gte": cutoff}
        }).to_list(50)
        hours = sum((datetime.fromisoformat(sh.get("closed_at", now_iso())) - 
                     datetime.fromisoformat(sh["opened_at"])).total_seconds() / 3600 
                    for sh in shifts if sh.get("closed_at"))
        s["items_per_hour"] = round(s["sales_count"] / max(hours, 1), 1)
        s["avg_transaction_value"] = round(s["total_revenue"] / max(s["sales_count"], 1), 2)
    
    # Leaderboard
    leaderboard = sorted(sales, key=lambda x: x["total_revenue"], reverse=True)
    
    return {"period_days": days, "employees": leaderboard}


# ═══════════════════════════════════════════════════════════════════════
# P1-7: CASH-MANAGEMENT ADVANCED (Safedrop, Wechselgeld)
# ═══════════════════════════════════════════════════════════════════════

class SafeDrop(BaseModel):
    register_id: str
    amount: float
    notes: Optional[str] = None

@router.post("/cash/safedrop")
async def safe_drop(req: SafeDrop, request: Request):
    """Geld während Schicht ins Tresor legen (ohne Schicht zu schließen)."""
    user = await get_current_user(request)
    reg = await db.pos_registers.find_one({"register_id": req.register_id})
    if not reg:
        raise HTTPException(status_code=404, detail="Kasse nicht gefunden")
    
    shift = await db.pos_shifts.find_one({"shift_id": reg.get("current_shift_id"), "status": "open"})
    if not shift:
        raise HTTPException(status_code=400, detail="Keine offene Schicht")
    
    drop_id = short_id("DRP", 10)
    await db.pos_safe_drops.insert_one({
        "drop_id": drop_id,
        "register_id": req.register_id,
        "shift_id": shift["shift_id"],
        "amount": req.amount,
        "cashier_id": str(user["_id"]),
        "notes": req.notes,
        "created_at": now_iso(),
    })
    
    # Schicht Expected-Cash reduzieren
    await db.pos_shifts.update_one(
        {"shift_id": shift["shift_id"]},
        {"$inc": {"expected_cash": -req.amount, "safe_drops_total": req.amount}}
    )
    return {"ok": True, "drop_id": drop_id}

@router.get("/cash/change-suggestion")
async def change_suggestion(amount_due: float, cash_tendered: float):
    """Wechselgeld-Optimierung (Münzen/Scheine)."""
    change = round(cash_tendered - amount_due, 2)
    if change < 0:
        raise HTTPException(status_code=400, detail="Zu wenig Bargeld")
    
    denominations = [50, 20, 10, 5, 2, 1, 0.5, 0.2, 0.1, 0.05, 0.02, 0.01]
    breakdown = {}
    remaining = change
    for denom in denominations:
        count = int(remaining / denom)
        if count > 0:
            breakdown[f"€{denom}"] = count
            remaining = round(remaining - (denom * count), 2)
    
    return {"change_total": change, "breakdown": breakdown}


# ═══════════════════════════════════════════════════════════════════════
# P1-8: VENDOR-RETURN MANAGEMENT
# ═══════════════════════════════════════════════════════════════════════

class VendorReturn(BaseModel):
    supplier_id: str
    items: List[Dict[str, Any]]  # [{product_id, quantity, reason}]
    notes: Optional[str] = None

@router.post("/vendor-returns/create")
async def create_vendor_return(req: VendorReturn, request: Request, store_id: str):
    user = await get_current_user(request)
    await _require_store_access(user, store_id, {"merchant_admin", "store_manager"})
    
    return_id = short_id("VDR", 10)
    total_value = 0.0
    for it in req.items:
        p = await db.pos_products.find_one({"product_id": it.get("product_id")})
        if p:
            total_value += float(p.get("purchase_price", 0)) * float(it.get("quantity", 1))
    
    await db.pos_vendor_returns.insert_one({
        "return_id": return_id,
        "supplier_id": req.supplier_id,
        "store_id": store_id,
        "items": req.items,
        "total_value": round(total_value, 2),
        "status": "pending",
        "notes": req.notes,
        "created_by": str(user["_id"]),
        "created_at": now_iso(),
    })
    return {"ok": True, "return_id": return_id, "total_value": round(total_value, 2)}


# ═══════════════════════════════════════════════════════════════════════
# P2-1: AI-UPSELL PROMPTS (Rule-based)
# ═══════════════════════════════════════════════════════════════════════

@router.post("/cart/upsell-suggestions")
async def upsell_suggestions(request: Request, cart_id: str):
    await get_current_user(request)
    cart = await db.pos_carts.find_one({"cart_id": cart_id})
    if not cart:
        raise HTTPException(status_code=404, detail="Cart nicht gefunden")
    
    suggestions = []
    # Rule: Bier gekauft → Chips vorschlagen
    has_beer = any("bier" in it.get("name", "").lower() for it in cart["items"])
    if has_beer:
        chips = await db.pos_products.find_one({
            "store_id": cart["store_id"],
            "category": {"$regex": "snack", "$options": "i"},
            "active": True
        })
        if chips:
            suggestions.append(chips)
    
    return {"cart_id": cart_id, "suggestions": suggestions}


# ═══════════════════════════════════════════════════════════════════════
# P2-2: SHELF-QR CODES (Produktinfo-Deeplink)
# ═══════════════════════════════════════════════════════════════════════

@router.get("/public/product-info/{product_id}")
async def public_product_info(product_id: str):
    """PUBLIC Produktinfo via QR-Code-Scan."""
    p = await db.pos_products.find_one(
        {"product_id": product_id, "active": True}, 
        {"_id": 0, "purchase_price": 0, "merchant_id": 0}
    )
    if not p:
        raise HTTPException(status_code=404, detail="Produkt nicht gefunden")
    return {"product": p, "qr_url": f"/api/pos/retail/public/product-info/{product_id}"}


# ═══════════════════════════════════════════════════════════════════════
# P2-3: PICK-BY-LIGHT SIMULATION (für Online-Order-Fulfillment)
# ═══════════════════════════════════════════════════════════════════════

class PickTask(BaseModel):
    order_id: str
    items: List[Dict[str, Any]]

@router.post("/pick/task/create")
async def create_pick_task(req: PickTask, request: Request, store_id: str):
    user = await get_current_user(request)
    await _require_store_access(user, store_id)
    
    task_id = short_id("PCK", 10)
    await db.pos_pick_tasks.insert_one({
        "task_id": task_id,
        "order_id": req.order_id,
        "store_id": store_id,
        "items": req.items,
        "status": "pending",
        "assigned_to": None,
        "created_at": now_iso(),
    })
    return {"ok": True, "task_id": task_id}

@router.get("/pick/tasks/pending")
async def pending_pick_tasks(request: Request, store_id: str):
    await get_current_user(request)
    tasks = await db.pos_pick_tasks.find(
        {"store_id": store_id, "status": "pending"},
        {"_id": 0}
    ).to_list(50)
    return {"tasks": tasks}


# ═══════════════════════════════════════════════════════════════════════
# P2-4: VIDEO-BON-REPLAY PLACEHOLDER
# ═══════════════════════════════════════════════════════════════════════

@router.get("/video-replay/{receipt_id}")
async def video_replay(receipt_id: str, request: Request):
    user = await get_current_user(request)
    
    # Fetch sale to get store_id
    sale = await db.pos_sales.find_one({"receipt_id": receipt_id}, {"_id": 0, "store_id": 1})
    if not sale:
        raise HTTPException(status_code=404, detail="Beleg nicht gefunden")
    
    await _require_store_access(user, sale["store_id"], {"merchant_admin"})
    
    # Placeholder: In Production würde hier eine Kamera-Clip-URL zurückgegeben
    return {
        "receipt_id": receipt_id,
        "video_available": False,
        "message": "Video-Integration erfordert Kamera-Hardware + Storage",
        "placeholder_url": f"/videos/{receipt_id}.mp4",
    }
