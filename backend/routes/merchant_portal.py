"""
BidBlitz V2 - Merchant Portal / Händler-Dashboard
Umsatz, Bestellungen, Produkte, Mitarbeiter, Finanzen, Bewertungen,
Restaurant-Reservierungen, Hotel-Buchungen, Job-Anzeigen, Events, Termine
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone, timedelta
from core.database import db
from core.security import get_current_user
import secrets

router = APIRouter(prefix="/api/merchant-portal", tags=["merchant-portal"])


class MerchantProfileUpdate(BaseModel):
    business_name: str = ""
    logo_url: str = ""
    description: str = ""
    phone: str = ""
    email: str = ""
    website: str = ""
    address: str = ""
    city: str = ""
    opening_hours: str = ""
    category: str = ""


async def require_merchant(request: Request):
    user = await get_current_user(request)
    if user.get("role") not in ("merchant", "admin"):
        raise HTTPException(status_code=403, detail="Nur für Händler")
    return user


def _num(value: Any) -> float:
    try:
        return float(value or 0)
    except (TypeError, ValueError):
        return 0.0


async def _get_pos_merchant_for_user(user: dict):
    uid = str(user["_id"])
    merchant = await db.pos_merchants.find_one({"owner_id": uid}, {"_id": 0})
    if merchant:
        return merchant
    if user.get("role") == "admin":
        return await db.pos_merchants.find_one({}, {"_id": 0})
    return None


def _today_start_iso() -> str:
    return datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()


# ─── Dashboard Stats ───

@router.get("/dashboard")
async def get_dashboard(request: Request):
    user = await require_merchant(request)
    uid = str(user["_id"])
    now = datetime.now(timezone.utc)
    today = now.replace(hour=0, minute=0, second=0).isoformat()
    week_ago = (now - timedelta(days=7)).isoformat()
    month_ago = (now - timedelta(days=30)).isoformat()

    # Transactions where merchant received money
    all_txns = await db.transactions.find(
        {"user_id": uid, "amount": {"$gt": 0}}, {"_id": 0, "amount": 1, "created_at": 1, "type": 1}
    ).sort("created_at", -1).limit(500).to_list(500)

    revenue_today = sum(t["amount"] for t in all_txns if t.get("created_at", "") >= today)
    revenue_week = sum(t["amount"] for t in all_txns if t.get("created_at", "") >= week_ago)
    revenue_month = sum(t["amount"] for t in all_txns if t.get("created_at", "") >= month_ago)
    revenue_total = sum(t["amount"] for t in all_txns)

    # Tips received
    tips = await db.tips.find({"staff_id": uid}, {"_id": 0, "amount": 1}).to_list(200)
    tips_total = sum(t["amount"] for t in tips)

    # Counts
    orders_today = len([t for t in all_txns if t.get("created_at", "") >= today])
    orders_month = len([t for t in all_txns if t.get("created_at", "") >= month_ago])

    # Restaurant reservations
    my_restaurants = await db.restaurants.find({"owner_id": uid}, {"_id": 0, "restaurant_id": 1}).to_list(10)
    rest_ids = [r["restaurant_id"] for r in my_restaurants]
    reservations = await db.reservations.count_documents({"restaurant_id": {"$in": rest_ids}, "status": "confirmed"}) if rest_ids else 0

    # Hotel bookings
    my_hotels = await db.properties.find({"owner_id": uid}, {"_id": 0, "property_id": 1}).to_list(10)
    hotel_ids = [h["property_id"] for h in my_hotels]
    hotel_bookings = await db.hotel_bookings.count_documents({"property_id": {"$in": hotel_ids}, "status": "confirmed"}) if hotel_ids else 0

    # Jobs
    my_jobs = await db.jobs.count_documents({"poster_id": uid, "status": "active"})
    job_applications = await db.job_applications.count_documents({"job_id": {"$in": [j["job_id"] for j in await db.jobs.find({"poster_id": uid}, {"_id": 0, "job_id": 1}).to_list(50)]}}) if my_jobs > 0 else 0

    # Events
    my_events = await db.events.count_documents({"organizer_id": uid, "status": "active"})

    # Appointments
    my_providers = await db.appointment_providers.find({"owner_id": uid}, {"_id": 0, "provider_id": 1}).to_list(10)
    prov_ids = [p["provider_id"] for p in my_providers]
    appointments = await db.appointments.count_documents({"provider_id": {"$in": prov_ids}, "status": "confirmed"}) if prov_ids else 0

    # Profile
    profile = await db.merchant_profiles.find_one({"user_id": uid}, {"_id": 0})

    return {
        "revenue": {
            "today": round(revenue_today, 2),
            "week": round(revenue_week, 2),
            "month": round(revenue_month, 2),
            "total": round(revenue_total, 2),
        },
        "orders": {"today": orders_today, "month": orders_month},
        "tips_total": round(tips_total, 2),
        "wallet_balance": round(user.get("balance", 0), 2),
        "reservations": reservations,
        "hotel_bookings": hotel_bookings,
        "active_jobs": my_jobs,
        "job_applications": job_applications,
        "active_events": my_events,
        "appointments": appointments,
        "restaurants": len(my_restaurants),
        "hotels": len(my_hotels),
        "profile": profile,
    }


# ─── Merchant Profile ───

@router.get("/profile")
async def get_merchant_profile(request: Request):
    user = await require_merchant(request)
    profile = await db.merchant_profiles.find_one({"user_id": str(user["_id"])}, {"_id": 0})
    return {"profile": profile or {
        "business_name": user.get("name", ""),
        "email": user.get("email", ""),
    }}


@router.post("/profile")
async def update_merchant_profile(req: MerchantProfileUpdate, request: Request):
    user = await require_merchant(request)
    uid = str(user["_id"])
    now = datetime.now(timezone.utc).isoformat()

    await db.merchant_profiles.update_one(
        {"user_id": uid},
        {"$set": {
            "user_id": uid,
            "business_name": req.business_name,
            "logo_url": req.logo_url,
            "description": req.description,
            "phone": req.phone,
            "email": req.email,
            "website": req.website,
            "address": req.address,
            "city": req.city,
            "opening_hours": req.opening_hours,
            "category": req.category,
            "updated_at": now,
        }},
        upsert=True,
    )
    return {"ok": True}


# ─── Recent Transactions ───

@router.get("/transactions")
async def get_merchant_transactions(request: Request, limit: int = 50):
    user = await require_merchant(request)
    txns = await db.transactions.find(
        {"user_id": str(user["_id"])}, {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    return {"transactions": txns}


# ─── Restaurant Reservations ───

@router.get("/reservations")
async def get_merchant_reservations(request: Request):
    user = await require_merchant(request)
    uid = str(user["_id"])
    my_rests = await db.restaurants.find({"owner_id": uid}, {"_id": 0, "restaurant_id": 1}).to_list(10)
    rest_ids = [r["restaurant_id"] for r in my_rests]
    if not rest_ids:
        return {"reservations": []}
    reservations = await db.reservations.find(
        {"restaurant_id": {"$in": rest_ids}}, {"_id": 0}
    ).sort("date", -1).limit(50).to_list(50)
    return {"reservations": reservations}


# ─── Hotel Bookings ───

@router.get("/hotel-bookings")
async def get_merchant_hotel_bookings(request: Request):
    user = await require_merchant(request)
    uid = str(user["_id"])
    my_hotels = await db.properties.find({"owner_id": uid}, {"_id": 0, "property_id": 1}).to_list(10)
    hotel_ids = [h["property_id"] for h in my_hotels]
    if not hotel_ids:
        return {"bookings": []}
    bookings = await db.hotel_bookings.find(
        {"property_id": {"$in": hotel_ids}}, {"_id": 0}
    ).sort("created_at", -1).limit(50).to_list(50)
    return {"bookings": bookings}


# ─── Appointments ───

@router.get("/appointments")
async def get_merchant_appointments(request: Request):
    user = await require_merchant(request)
    uid = str(user["_id"])
    my_provs = await db.appointment_providers.find({"owner_id": uid}, {"_id": 0, "provider_id": 1}).to_list(10)
    prov_ids = [p["provider_id"] for p in my_provs]
    if not prov_ids:
        return {"appointments": []}
    apts = await db.appointments.find(
        {"provider_id": {"$in": prov_ids}}, {"_id": 0}
    ).sort("date", -1).limit(50).to_list(50)
    return {"appointments": apts}


# ─── Tips Received ───

@router.get("/tips")
async def get_merchant_tips(request: Request, limit: int = 30):
    user = await require_merchant(request)
    tips = await db.tips.find(
        {"staff_id": str(user["_id"])}, {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    total = sum(t.get("amount", 0) for t in tips)
    return {"tips": tips, "total": round(total, 2)}


@router.get("/enterprise-overview")
async def get_enterprise_overview(request: Request):
    user = await require_merchant(request)
    uid = str(user["_id"])
    profile = await db.merchant_profiles.find_one({"user_id": uid}, {"_id": 0})
    pos_merchant = await _get_pos_merchant_for_user(user)

    base = {
        "profile": profile,
        "company": {
            "business_name": (profile or {}).get("business_name") or user.get("name") or "BidBlitz Merchant",
            "wallet_balance": round(_num(user.get("balance")), 2),
            "merchant_id": None,
            "status": None,
        },
        "kpis": {
            "branches": 0,
            "registers": 0,
            "suppliers": 0,
            "products": 0,
            "low_stock": 0,
            "auto_reorder": 0,
            "purchase_orders_open": 0,
            "expiring_batches": 0,
            "pending_refunds": 0,
            "revenue_30d": 0,
            "sales_30d": 0,
            "wallet_transactions": 0,
            "payouts_pending": 0,
            "payouts_processed": 0,
            "staff_active": 0,
            "staff_clocked_in": 0,
            "staff_on_break": 0,
        },
        "branches": [],
        "inventory": {"low_stock": [], "auto_reorder": [], "expiring_batches": [], "stock_value_cost": 0, "stock_value_retail": 0},
        "supplier_workflow": {"draft": 0, "submitted": 0, "approved": 0, "ordered": 0, "delivered": 0, "received": 0},
        "wallet": {"balance": round(_num(user.get("balance")), 2), "transactions": [], "refunds": 0, "commission_total": 0, "payouts": {"pending": 0, "processed": 0}},
        "analytics": {"daily": [], "weekly": [], "monthly": [], "yearly": []},
        "loyalty": {"total_members": 0, "tiers": {}, "points_issued": 0, "coupons_available": 0},
        "staff": {"source_mix": [], "next_shifts": [], "late_staff": []},
    }

    if not pos_merchant:
        return base

    merchant_id = pos_merchant["merchant_id"]
    now = datetime.now(timezone.utc)
    start_30d = (now - timedelta(days=30)).isoformat()
    start_365d = (now - timedelta(days=365)).isoformat()
    today_start = _today_start_iso()
    expiring_until = (now + timedelta(days=21)).date().isoformat()

    stores = await db.pos_stores.find({"merchant_id": merchant_id}, {"_id": 0}).to_list(300)
    store_ids = [store["store_id"] for store in stores]
    registers = await db.pos_registers.find({"merchant_id": merchant_id}, {"_id": 0, "api_key": 0}).to_list(500)
    suppliers = await db.pos_suppliers.find({"merchant_id": merchant_id}, {"_id": 0}).to_list(1000)
    products = await db.pos_products.find({"merchant_id": merchant_id, "active": True}, {"_id": 0}).to_list(10000)
    purchase_orders = await db.pos_purchase_orders.find({"merchant_id": merchant_id}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    refunds_pending = await db.pos_refund_requests.count_documents({"merchant_id": merchant_id, "status": "pending"})
    refunds_total = await db.pos_refunds.count_documents({"merchant_id": merchant_id})
    sales_30d = await db.pos_sales.find(
        {"merchant_id": merchant_id, "created_at": {"$gte": start_30d}, "status": "completed"},
        {"_id": 0, "store_id": 1, "register_id": 1, "cashier_id": 1, "created_at": 1, "total": 1, "merchant_received": 1, "fee": 1, "items": 1},
    ).to_list(10000)
    all_sales = await db.pos_sales.find(
        {"merchant_id": merchant_id, "created_at": {"$gte": start_365d}, "status": "completed"},
        {"_id": 0, "created_at": 1, "total": 1, "merchant_received": 1, "items": 1, "cashier_id": 1},
    ).to_list(25000)
    batches = await db.pos_batches.find(
        {
            "merchant_id": merchant_id,
            "quantity_remaining": {"$gt": 0},
            "expiry_date": {"$ne": None, "$lte": expiring_until},
        },
        {"_id": 0},
    ).sort("expiry_date", 1).to_list(300)

    wallet_transactions = await db.transactions.find(
        {"user_id": uid},
        {"_id": 0, "id": 1, "type": 1, "amount": 1, "description": 1, "status": 1, "created_at": 1, "reference": 1},
    ).sort("created_at", -1).limit(12).to_list(12)
    payouts = await db.payouts.find({"user_id": uid}, {"_id": 0, "amount": 1, "status": 1}).to_list(500)

    staff_members = await db.staff_members.find({"merchant_id": uid, "active": True}, {"_id": 0, "id": 1, "name": 1, "role": 1}).to_list(1000)
    staff_map = {member["id"]: member for member in staff_members}
    staff_events = await db.staff_clock_events.find(
        {"merchant_id": uid, "timestamp": {"$gte": today_start}},
        {"_id": 0, "staff_id": 1, "action": 1, "source": 1, "timestamp": 1, "lat": 1, "lng": 1},
    ).sort("timestamp", 1).to_list(4000)
    next_shifts = await db.staff_shifts.find(
        {"merchant_id": uid, "start_time": {"$gte": now.isoformat()}},
        {"_id": 0, "staff_id": 1, "title": 1, "start_time": 1, "end_time": 1, "location": 1},
    ).sort("start_time", 1).limit(8).to_list(8)
    started_shifts = await db.staff_shifts.find(
        {"merchant_id": uid, "start_time": {"$gte": today_start, "$lte": now.isoformat()}},
        {"_id": 0, "staff_id": 1, "title": 1, "start_time": 1, "location": 1},
    ).to_list(500)

    loyalty_total = await db.pos_loyalty.count_documents({"merchant_id": merchant_id})
    loyalty_tiers = {}
    for tier in ("bronze", "silver", "gold"):
        loyalty_tiers[tier] = await db.pos_loyalty.count_documents({"merchant_id": merchant_id, "tier": tier})
    loyalty_txs = await db.pos_loyalty_transactions.find({"merchant_id": merchant_id}, {"_id": 0, "delta": 1}).to_list(5000)
    coupons_available = await db.coupons.count_documents({"is_active": True})

    sales_by_store: Dict[str, Dict[str, float]] = {}
    product_performance: Dict[str, Dict[str, float]] = {}
    employee_performance: Dict[str, Dict[str, float]] = {}
    daily: Dict[str, float] = {}
    weekly: Dict[str, float] = {}
    monthly: Dict[str, float] = {}
    yearly: Dict[str, float] = {}
    commission_total = 0.0
    for sale in all_sales:
        day = str(sale.get("created_at", ""))[:10]
        day_dt = None
        try:
            day_dt = datetime.fromisoformat(sale["created_at"])
        except Exception:
            day_dt = None
        if day:
            daily[day] = round(daily.get(day, 0.0) + _num(sale.get("merchant_received", sale.get("total"))), 2)
        if day_dt:
            week_key = f"{day_dt.isocalendar().year}-W{day_dt.isocalendar().week:02d}"
            month_key = day_dt.strftime("%Y-%m")
            year_key = day_dt.strftime("%Y")
            weekly[week_key] = round(weekly.get(week_key, 0.0) + _num(sale.get("merchant_received", sale.get("total"))), 2)
            monthly[month_key] = round(monthly.get(month_key, 0.0) + _num(sale.get("merchant_received", sale.get("total"))), 2)
            yearly[year_key] = round(yearly.get(year_key, 0.0) + _num(sale.get("merchant_received", sale.get("total"))), 2)
        commission_total += _num(sale.get("fee"))
        cashier_id = sale.get("cashier_id") or "unknown"
        perf = employee_performance.setdefault(cashier_id, {"cashier_id": cashier_id, "sales": 0, "revenue": 0})
        perf["sales"] += 1
        perf["revenue"] = round(perf["revenue"] + _num(sale.get("merchant_received", sale.get("total"))), 2)
        for item in sale.get("items", []):
            key = item.get("product_id") or item.get("name")
            row = product_performance.setdefault(key, {"product_id": key, "name": item.get("name", key), "qty": 0, "revenue": 0})
            row["qty"] += _num(item.get("quantity"))
            row["revenue"] = round(row["revenue"] + _num(item.get("line_total")), 2)

    registers_per_store: Dict[str, int] = {}
    for register in registers:
        registers_per_store[register["store_id"]] = registers_per_store.get(register["store_id"], 0) + 1
    low_stock = []
    auto_reorder = []
    stock_value_cost = 0.0
    stock_value_retail = 0.0
    products_by_store: Dict[str, int] = {}
    for product in products:
        stock = _num(product.get("stock"))
        stock_value_cost += stock * _num(product.get("purchase_price"))
        stock_value_retail += stock * _num(product.get("price"))
        products_by_store[product["store_id"]] = products_by_store.get(product["store_id"], 0) + 1
        minimum = _num(product.get("minimum_stock"))
        if product.get("track_stock") and minimum > 0 and stock <= minimum:
            low_stock.append(product)
        target = _num(product.get("reorder_target_stock") or minimum)
        if product.get("auto_reorder_enabled") and target > stock:
            auto_reorder.append({
                "product_id": product["product_id"],
                "name": product.get("name"),
                "store_id": product.get("store_id"),
                "stock": stock,
                "target_stock": target,
                "suggested_qty": round(max(0, target - stock), 2),
                "supplier_id": product.get("supplier_id"),
            })

    workflow = {"draft": 0, "submitted": 0, "approved": 0, "ordered": 0, "delivered": 0, "received": 0}
    open_purchase_orders = 0
    for po in purchase_orders:
        status = po.get("status") or "draft"
        if status in workflow:
            workflow[status] += 1
        if status not in {"received", "cancelled"}:
            open_purchase_orders += 1

    latest_events: Dict[str, dict] = {}
    source_mix: Dict[str, int] = {}
    checked_in_staff = set()
    active_now = 0
    on_break = 0
    for event in staff_events:
        latest_events[event.get("staff_id")] = event
        source = event.get("source") or ("gps" if event.get("lat") is not None and event.get("lng") is not None else "web")
        source_mix[source] = source_mix.get(source, 0) + 1
        if event.get("action") == "clock_in":
            checked_in_staff.add(event.get("staff_id"))
    for event in latest_events.values():
        if event.get("action") in {"clock_in", "break_end"}:
            active_now += 1
        elif event.get("action") == "break_start":
            on_break += 1

    late_staff = []
    for shift in started_shifts:
        if shift.get("staff_id") not in checked_in_staff:
            late_staff.append({
                "staff_id": shift.get("staff_id"),
                "name": staff_map.get(shift.get("staff_id"), {}).get("name", "Unbekannt"),
                "title": shift.get("title"),
                "start_time": shift.get("start_time"),
                "location": shift.get("location"),
            })

    branches = []
    for store in stores:
        branch_sales = [s for s in sales_30d if s.get("store_id") == store["store_id"]]
        revenue = round(sum(_num(s.get("merchant_received", s.get("total"))) for s in branch_sales), 2)
        branches.append({
            "store_id": store["store_id"],
            "name": store.get("name"),
            "city": store.get("city"),
            "status": store.get("status"),
            "registers": registers_per_store.get(store["store_id"], 0),
            "products": products_by_store.get(store["store_id"], 0),
            "low_stock": len([p for p in low_stock if p.get("store_id") == store["store_id"]]),
            "orders_30d": len(branch_sales),
            "revenue_30d": revenue,
        })
    branches.sort(key=lambda item: item.get("revenue_30d", 0), reverse=True)

    processed_payouts = round(sum(_num(p.get("amount")) for p in payouts if p.get("status") == "processed"), 2)
    pending_payouts = round(sum(_num(p.get("amount")) for p in payouts if p.get("status") in {"pending", "approved"}), 2)

    best_products = sorted(product_performance.values(), key=lambda item: item["revenue"], reverse=True)[:5]
    worst_products = sorted(product_performance.values(), key=lambda item: item["revenue"])[:5]
    best_employees = sorted(employee_performance.values(), key=lambda item: item["revenue"], reverse=True)[:6]

    return {
        "profile": profile,
        "company": {
            "business_name": pos_merchant.get("business_name") or (profile or {}).get("business_name") or user.get("name") or "BidBlitz Merchant",
            "wallet_balance": round(_num(user.get("balance")), 2),
            "merchant_id": merchant_id,
            "status": pos_merchant.get("status"),
        },
        "kpis": {
            "branches": len(stores),
            "registers": len(registers),
            "suppliers": len(suppliers),
            "products": len(products),
            "low_stock": len(low_stock),
            "auto_reorder": len(auto_reorder),
            "purchase_orders_open": open_purchase_orders,
            "expiring_batches": len(batches),
            "pending_refunds": refunds_pending,
            "revenue_30d": round(sum(_num(s.get("merchant_received", s.get("total"))) for s in sales_30d), 2),
            "sales_30d": len(sales_30d),
            "wallet_transactions": len(wallet_transactions),
            "payouts_pending": pending_payouts,
            "payouts_processed": processed_payouts,
            "staff_active": len(staff_members),
            "staff_clocked_in": active_now,
            "staff_on_break": on_break,
        },
        "branches": branches,
        "inventory": {
            "low_stock": low_stock[:10],
            "auto_reorder": sorted(auto_reorder, key=lambda item: item["suggested_qty"], reverse=True)[:10],
            "expiring_batches": batches[:10],
            "stock_value_cost": round(stock_value_cost, 2),
            "stock_value_retail": round(stock_value_retail, 2),
        },
        "supplier_workflow": workflow,
        "wallet": {
            "balance": round(_num(user.get("balance")), 2),
            "transactions": wallet_transactions,
            "refunds": refunds_total,
            "commission_total": round(commission_total, 2),
            "payouts": {"pending": pending_payouts, "processed": processed_payouts},
        },
        "analytics": {
            "daily": [{"period": key, "revenue": value} for key, value in sorted(daily.items())[-14:]],
            "weekly": [{"period": key, "revenue": value} for key, value in sorted(weekly.items())[-12:]],
            "monthly": [{"period": key, "revenue": value} for key, value in sorted(monthly.items())[-12:]],
            "yearly": [{"period": key, "revenue": value} for key, value in sorted(yearly.items())[-4:]],
            "best_products": best_products,
            "worst_products": worst_products,
            "employee_performance": [
                {**item, "name": staff_map.get(item["cashier_id"], {}).get("name", item["cashier_id"])}
                for item in best_employees
            ],
        },
        "loyalty": {
            "total_members": loyalty_total,
            "tiers": loyalty_tiers,
            "points_issued": sum(int(tx.get("delta", 0) or 0) for tx in loyalty_txs if int(tx.get("delta", 0) or 0) > 0),
            "coupons_available": coupons_available,
        },
        "staff": {
            "source_mix": [{"source": source, "count": count} for source, count in sorted(source_mix.items(), key=lambda item: item[1], reverse=True)],
            "next_shifts": [{**shift, "name": staff_map.get(shift.get("staff_id"), {}).get("name", "Unbekannt")} for shift in next_shifts],
            "late_staff": late_staff[:8],
        },
    }
