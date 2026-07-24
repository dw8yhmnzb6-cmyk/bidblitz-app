"""
BidBlitz V2 - Merchant Portal / Händler-Dashboard
Umsatz, Bestellungen, Produkte, Mitarbeiter, Finanzen, Bewertungen,
Restaurant-Reservierungen, Hotel-Buchungen, Job-Anzeigen, Events, Termine
"""
import json
import os
import uuid

from dotenv import load_dotenv
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse
from emergentintegrations.llm.chat import LlmChat, StreamDone, TextDelta, UserMessage
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone, timedelta
from core.database import db
from core.security import get_current_user
import secrets

load_dotenv()

router = APIRouter(prefix="/api/merchant-portal", tags=["merchant-portal"])

EXECUTIVE_AI_COLLECTION = "merchant_executive_ai_reports"
EXECUTIVE_AI_PROVIDER = "openai"
EXECUTIVE_AI_MODEL = "gpt-5.4"
BUSINESS_AUTOMATION_SETTINGS_COLLECTION = "merchant_automation_settings"
BUSINESS_AUTOMATION_RUNS_COLLECTION = "merchant_automation_runs"
OPS_COMPANIES_COLLECTION = "merchant_v5_companies"
OPS_DOCUMENTS_COLLECTION = "merchant_v5_documents"
OPS_MAINTENANCE_COLLECTION = "merchant_v5_maintenance"
EXECUTIVE_AI_FALLBACKS = [
    ("openai", "gpt-5.4"),
    ("openai", "gpt-5.2"),
    ("gemini", "gemini-3.1-pro-preview"),
    ("gemini", "gemini-3-flash-preview"),
]


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


class ExecutiveAiBriefRequest(BaseModel):
    focus: str = "full executive briefing"


class BusinessAutomationSettingsUpdate(BaseModel):
    procurement_enabled: Optional[bool] = None
    operations_enabled: Optional[bool] = None
    revenue_enabled: Optional[bool] = None
    reorder_days_cover_threshold: Optional[int] = None
    flash_sale_discount_pct: Optional[int] = None
    flash_sale_duration_minutes: Optional[int] = None
    late_shift_grace_minutes: Optional[int] = None


class ProcurementAutomationRunRequest(BaseModel):
    max_purchase_orders: int = 5


class OperationsAutomationRunRequest(BaseModel):
    assign_late_staff_tasks: bool = True
    convert_alerts_to_tasks: bool = True


class RevenueAutomationRunRequest(BaseModel):
    limit: int = 3


class OpsCompanyUpsertRequest(BaseModel):
    company_id: Optional[str] = None
    name: str
    legal_name: str = ""
    country: str = ""
    status: str = "active"
    manager_email: str = ""
    tax_id: str = ""
    wallet_budget: float = 0
    branch_count: int = 1


class OpsDocumentUpsertRequest(BaseModel):
    document_id: Optional[str] = None
    title: str
    category: str = "general"
    status: str = "draft"
    linked_company_id: str = ""
    expiry_date: str = ""
    external_url: str = ""
    notes: str = ""


class OpsMaintenanceUpsertRequest(BaseModel):
    ticket_id: Optional[str] = None
    asset_name: str
    asset_type: str = "terminal"
    priority: str = "medium"
    status: str = "open"
    linked_company_id: str = ""
    vendor_name: str = ""
    next_check_at: str = ""
    notes: str = ""


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


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _remaining_seconds(ends_at: Optional[str]) -> int:
    end_dt = _parse_iso(ends_at)
    if not end_dt:
        return 0
    return max(0, int((end_dt - datetime.now(timezone.utc)).total_seconds()))


def _parse_iso(value: Any) -> Optional[datetime]:
    if not value or not isinstance(value, str):
        return None
    try:
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
        # Ensure timezone-aware datetime
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except ValueError:
        return None


def _pct_delta(current: float, previous: float) -> float:
    if previous <= 0:
        return 0.0 if current <= 0 else 100.0
    return round(((current - previous) / previous) * 100, 2)


def _margin(amount: float, revenue: float) -> float:
    if revenue <= 0:
        return 0.0
    return round((amount / revenue) * 100, 2)


def _clamp(value: float, minimum: float, maximum: float) -> float:
    return max(minimum, min(maximum, value))


def _chunk_text(text: str, chunk_size: int = 220):
    if not text:
        return []
    return [text[i:i + chunk_size] for i in range(0, len(text), chunk_size)]


def _business_automation_defaults() -> Dict[str, Any]:
    return {
        "procurement_enabled": True,
        "operations_enabled": True,
        "revenue_enabled": True,
        "reorder_days_cover_threshold": 14,
        "flash_sale_discount_pct": 18,
        "flash_sale_duration_minutes": 180,
        "late_shift_grace_minutes": 15,
    }


async def _get_business_automation_settings(user_id: str) -> Dict[str, Any]:
    stored = await db[BUSINESS_AUTOMATION_SETTINGS_COLLECTION].find_one({"user_id": user_id}, {"_id": 0})
    defaults = _business_automation_defaults()
    if not stored:
        return defaults
    return {**defaults, **stored}


def _ops_status(value: str, allowed: List[str], fallback: str) -> str:
    if value in allowed:
        return value
    return fallback


def _with_deadline_meta(items: List[Dict[str, Any]], field_name: str) -> List[Dict[str, Any]]:
    now = datetime.now(timezone.utc)
    enriched = []
    for item in items:
        enriched_item = {**item}
        target = _parse_iso(item.get(field_name))
        if target:
            enriched_item["days_until_deadline"] = (target - now).days
        enriched.append(enriched_item)
    return enriched


async def _ensure_primary_ops_company(user: dict, enterprise: Dict[str, Any]) -> None:
    uid = str(user["_id"])
    existing = await db[OPS_COMPANIES_COLLECTION].find_one({"user_id": uid, "is_primary": True}, {"_id": 0, "company_id": 1})
    if existing:
        return
    primary_company = {
        "company_id": f"mco_{uuid.uuid4().hex[:10]}",
        "user_id": uid,
        "merchant_id": enterprise.get("company", {}).get("merchant_id"),
        "name": enterprise.get("company", {}).get("business_name") or user.get("name") or user.get("email") or "BidBlitz Merchant",
        "legal_name": enterprise.get("company", {}).get("business_name") or user.get("name") or "BidBlitz Merchant",
        "country": (enterprise.get("profile") or {}).get("city") or "Kosovo",
        "status": enterprise.get("company", {}).get("status") or "active",
        "manager_email": (enterprise.get("profile") or {}).get("email") or user.get("email") or "",
        "tax_id": "",
        "wallet_budget": round(_num(enterprise.get("company", {}).get("wallet_balance")), 2),
        "branch_count": max(1, len(enterprise.get("branches") or [])),
        "is_primary": True,
        "created_at": _now_iso(),
        "updated_at": _now_iso(),
    }
    await db[OPS_COMPANIES_COLLECTION].insert_one(primary_company)


async def _build_ops_suite(user: dict) -> Dict[str, Any]:
    uid = str(user["_id"])
    enterprise = await _build_enterprise_overview_data(user)
    await _ensure_primary_ops_company(user, enterprise)

    companies = await db[OPS_COMPANIES_COLLECTION].find({"user_id": uid}, {"_id": 0}).sort("created_at", 1).to_list(50)
    documents = await db[OPS_DOCUMENTS_COLLECTION].find({"user_id": uid}, {"_id": 0}).sort("updated_at", -1).to_list(100)
    maintenance = await db[OPS_MAINTENANCE_COLLECTION].find({"user_id": uid}, {"_id": 0}).sort("updated_at", -1).to_list(100)

    documents = _with_deadline_meta(documents, "expiry_date")
    maintenance = _with_deadline_meta(maintenance, "next_check_at")
    companies_by_id = {item.get("company_id"): item.get("name") for item in companies}

    for item in documents:
        item["linked_company_name"] = companies_by_id.get(item.get("linked_company_id"), "Nicht zugewiesen")
    for item in maintenance:
        item["linked_company_name"] = companies_by_id.get(item.get("linked_company_id"), "Nicht zugewiesen")

    expiring_soon = len([item for item in documents if isinstance(item.get("days_until_deadline"), int) and item.get("days_until_deadline") <= 30])
    overdue_maintenance = len([item for item in maintenance if isinstance(item.get("days_until_deadline"), int) and item.get("days_until_deadline") < 0])
    open_maintenance = len([item for item in maintenance if item.get("status") not in {"done", "archived"}])
    high_priority_open = len([item for item in maintenance if item.get("priority") == "high" and item.get("status") not in {"done", "archived"}])

    return {
        "generated_at": _now_iso(),
        "summary": {
            "companies_total": len(companies),
            "active_companies": len([item for item in companies if item.get("status") == "active"]),
            "documents_total": len(documents),
            "documents_expiring_soon": expiring_soon,
            "maintenance_open": open_maintenance,
            "maintenance_overdue": overdue_maintenance,
            "maintenance_high_priority": high_priority_open,
        },
        "companies": companies,
        "documents": documents,
        "maintenance": maintenance,
        "enterprise_snapshot": {
            "merchant_id": enterprise.get("company", {}).get("merchant_id"),
            "business_name": enterprise.get("company", {}).get("business_name"),
            "wallet_balance": enterprise.get("company", {}).get("wallet_balance"),
            "branches": len(enterprise.get("branches") or []),
        },
    }


async def _record_business_automation_run(user_id: str, merchant_id: Optional[str], run_type: str, status: str, summary: str, details: Dict[str, Any]):
    doc = {
        "run_id": f"auto_{uuid.uuid4().hex[:12]}",
        "user_id": user_id,
        "merchant_id": merchant_id,
        "run_type": run_type,
        "status": status,
        "summary": summary,
        "details": details,
        "created_at": _now_iso(),
    }
    await db[BUSINESS_AUTOMATION_RUNS_COLLECTION].insert_one(doc)
    doc.pop("_id", None)
    return doc


def _build_revenue_opportunities(listings: List[dict], settings: Dict[str, Any]) -> List[dict]:
    opportunities = []
    discount_pct = int(settings.get("flash_sale_discount_pct") or 18)
    duration_minutes = int(settings.get("flash_sale_duration_minutes") or 180)
    now = datetime.now(timezone.utc)
    for listing in listings:
        created_at = _parse_iso(listing.get("created_at"))
        age_days = (now - created_at).days if created_at else 0
        views = int(listing.get("views") or 0)
        favorites = int(listing.get("favorites") or 0)
        messages_count = int(listing.get("messages_count") or 0)
        if age_days < 7:
            continue
        if favorites > 1 and messages_count > 0:
            continue
        if views < 8 and age_days < 14:
            continue
        price = round(_num(listing.get("price")), 2)
        if price <= 0:
            continue
        opportunity_discount = discount_pct + (4 if age_days >= 21 else 0) + (3 if views >= 30 and favorites == 0 else 0)
        opportunity_discount = int(_clamp(opportunity_discount, 10, 35))
        sale_price = round(price * (1 - opportunity_discount / 100), 2)
        if sale_price >= price:
            continue
        opportunities.append({
            "listing_id": listing.get("listing_id"),
            "title": listing.get("title"),
            "price": price,
            "views": views,
            "favorites": favorites,
            "messages_count": messages_count,
            "age_days": age_days,
            "discount_pct": opportunity_discount,
            "sale_price": sale_price,
            "duration_minutes": duration_minutes,
            "image_url": (listing.get("images") or [""])[0],
            "reason": "Stale listing" if age_days >= 14 else "Low conversion",
        })
    return sorted(opportunities, key=lambda item: (-item.get("age_days", 0), -item.get("views", 0), item.get("favorites", 0)))


async def _build_business_automation_dashboard(user: dict) -> Dict[str, Any]:
    uid = str(user["_id"])
    enterprise = await _build_enterprise_overview_data(user)
    merchant_id = enterprise.get("company", {}).get("merchant_id")
    settings = await _get_business_automation_settings(uid)

    open_purchase_orders = await db.pos_purchase_orders.find(
        {"merchant_id": merchant_id, "status": {"$in": ["draft", "submitted", "approved", "ordered", "delivered"]}} if merchant_id else {"merchant_id": "__none__"},
        {"_id": 0, "po_id": 1, "supplier_name": 1, "status": 1, "created_at": 1, "ordered_at": 1, "delivered_at": 1, "total_cost": 1, "items": 1},
    ).sort("created_at", -1).to_list(50)
    staff_tasks = await db.staff_tasks.find(
        {"merchant_id": uid, "status": "open", "tags": {"$in": ["automation"]}},
        {"_id": 0, "id": 1, "title": 1, "staff_id": 1, "priority": 1, "due_date": 1, "tags": 1, "created_at": 1},
    ).sort("created_at", -1).limit(8).to_list(8)
    recent_runs = await db[BUSINESS_AUTOMATION_RUNS_COLLECTION].find(
        {"user_id": uid},
        {"_id": 0},
    ).sort("created_at", -1).limit(12).to_list(12)
    listings = await db.marketplace_listings.find(
        {"seller_id": uid, "status": "active"},
        {"_id": 0, "listing_id": 1, "title": 1, "price": 1, "views": 1, "favorites": 1, "messages_count": 1, "created_at": 1, "images": 1},
    ).sort("created_at", -1).to_list(60)
    active_flash_sale_ids = set(await db.commerce_flash_sales.distinct(
        "listing_id",
        {"seller_id": uid, "status": {"$in": ["active", "processing"]}, "remaining_units": {"$gt": 0}},
    ))

    revenue_opportunities = [item for item in _build_revenue_opportunities(listings, settings) if item.get("listing_id") not in active_flash_sale_ids]

    escalations = []
    now = datetime.now(timezone.utc)
    for po in open_purchase_orders:
        base_date = _parse_iso(po.get("ordered_at") or po.get("created_at"))
        if not base_date:
            continue
        age_days = (now - base_date).days
        if po.get("status") in {"ordered", "approved"} and age_days >= 5:
            escalations.append({
                "po_id": po.get("po_id"),
                "supplier_name": po.get("supplier_name"),
                "status": po.get("status"),
                "age_days": age_days,
                "severity": "high" if age_days >= 10 else "medium",
                "total_cost": round(_num(po.get("total_cost")), 2),
            })

    procurement_queue = []
    for item in enterprise.get("insights", {}).get("purchase_recommendations", [])[:10]:
        procurement_queue.append({
            **item,
            "priority": "high" if (item.get("days_of_cover") is not None and item.get("days_of_cover") <= 7) or item.get("stock", 0) <= item.get("minimum_stock", 0) else "medium",
        })

    return {
        "generated_at": _now_iso(),
        "settings": settings,
        "overview": {
            "procurement_actions": len(procurement_queue),
            "operations_actions": len(enterprise.get("staff", {}).get("late_staff", [])) + len(enterprise.get("insights", {}).get("business_alerts", [])),
            "revenue_actions": len(revenue_opportunities),
            "open_automation_tasks": len(staff_tasks),
            "active_flash_sales": len(active_flash_sale_ids),
            "runs_today": len([run for run in recent_runs if str(run.get("created_at", ""))[:10] == str(_now_iso())[:10]]),
        },
        "procurement": {
            "queue": procurement_queue,
            "open_purchase_orders": open_purchase_orders[:8],
            "escalations": escalations[:6],
            "submitted_count": len([po for po in open_purchase_orders if po.get("status") == "submitted"]),
        },
        "operations": {
            "late_staff": enterprise.get("staff", {}).get("late_staff", [])[:8],
            "alerts": enterprise.get("insights", {}).get("business_alerts", [])[:8],
            "automation_tasks": staff_tasks,
            "next_shifts": enterprise.get("staff", {}).get("next_shifts", [])[:5],
        },
        "revenue": {
            "opportunities": revenue_opportunities[:8],
            "active_flash_sales": len(active_flash_sale_ids),
            "top_products": enterprise.get("pos", {}).get("top_products", [])[:4],
            "slow_products": enterprise.get("pos", {}).get("slow_products", [])[:4],
        },
        "history": recent_runs,
    }


def _build_executive_ai_prompt(context: Dict[str, Any]) -> str:
    return (
        "Erstelle ein präzises Executive-Briefing auf Deutsch für ein Merchant-Management-Team. "
        "Nutze ausschließlich die gelieferten Daten. Keine Halluzinationen, keine erfundenen Ursachen, keine externen Annahmen. "
        "Formatiere die Antwort exakt mit diesen Markdown-Überschriften und jeweils 2-4 dichten Bullet Points:\n"
        "## Executive Summary\n"
        "## Revenue Insights\n"
        "## Inventory Insights\n"
        "## Staff Insights\n"
        "## Sales Forecasts\n"
        "## Purchase Recommendations\n"
        "## Business Alerts\n\n"
        f"Fokus: {context.get('focus', 'full executive briefing')}\n\n"
        "Wichtige Regeln:\n"
        "- Nenne konkrete Zahlen und Trends.\n"
        "- Wenn ein Risiko fehlt, sage das nicht extra, sondern fokussiere die relevantesten Punkte.\n"
        "- Kaufempfehlungen nur mit Produkten nennen, die im Datensatz enthalten sind.\n"
        "- Alerts nach Geschäftsauswirkung priorisieren.\n\n"
        f"Datensatz:\n{json.dumps(context, ensure_ascii=False)}"
    )


def _build_fallback_executive_report(context: Dict[str, Any]) -> str:
    revenue = context.get("revenue", {})
    inventory = context.get("inventory", {})
    staff = context.get("staff", {})
    forecast = context.get("sales_forecast", {})
    recommendations = context.get("purchase_recommendations", [])[:4]
    alerts = context.get("business_alerts", [])[:4]
    summary = context.get("executive_summary", [])[:4]

    recommendation_lines = "\n".join(
        f"- {item.get('name', 'Produkt')}: {item.get('suggested_qty', 0)} nachbestellen, Bestand {item.get('stock', 0)}, Reichweite {item.get('days_of_cover') or 'n/a'} Tage."
        for item in recommendations
    ) or "- Aktuell keine akute Nachbestellung aus dem Datensatz erforderlich."

    alert_lines = "\n".join(
        f"- {item.get('title', 'Hinweis')}: {item.get('body', '')}"
        for item in alerts
    ) or "- Aktuell keine kritischen Alerts aus den vorhandenen Modulen erkannt."

    summary_lines = "\n".join(f"- {item}" for item in summary) or "- Executive Snapshot erfolgreich aus bestehenden Modulen erzeugt."

    return (
        "## Executive Summary\n"
        f"{summary_lines}\n\n"
        "## Revenue Insights\n"
        f"- 30-Tage-Umsatz: €{revenue.get('revenue_30d', 0):,.2f}.\n"
        f"- Wachstum vs. Vorperiode: {revenue.get('growth_pct', 0):,.2f}%.\n"
        f"- 30-Tage-Profit: €{revenue.get('profit_30d', 0):,.2f} bei {revenue.get('margin_pct', 0):,.2f}% Marge.\n"
        f"- Durchschnittsbon: €{revenue.get('avg_ticket', 0):,.2f}.\n\n"
        "## Inventory Insights\n"
        f"- Low-Stock-Produkte: {inventory.get('low_stock_count', 0)}.\n"
        f"- Auto-Reorder-Kandidaten: {inventory.get('auto_reorder_count', 0)}.\n"
        f"- Expiring Batches: {inventory.get('expiring_batches_count', 0)}.\n"
        f"- Dead Stock: {inventory.get('dead_stock_count', 0)} Produkte.\n\n"
        "## Staff Insights\n"
        f"- Aktive Mitarbeitende: {staff.get('active_staff', 0)}.\n"
        f"- Eingestempelt: {staff.get('clocked_in', 0)}.\n"
        f"- Zu spät / ungeclockt: {staff.get('late_staff_count', 0)}.\n"
        f"- Umsatz pro Mitarbeiter (30 Tage): €{staff.get('revenue_per_staff_30d', 0):,.2f}.\n\n"
        "## Sales Forecasts\n"
        f"- Forecast nächste 7 Tage: €{forecast.get('next_7_days_revenue', 0):,.2f}.\n"
        f"- Forecast nächste 30 Tage: €{forecast.get('next_30_days_revenue', 0):,.2f}.\n"
        f"- Forecast Profit 30 Tage: €{forecast.get('next_30_days_profit', 0):,.2f}.\n"
        f"- Confidence: {forecast.get('confidence', 'medium')}.\n\n"
        "## Purchase Recommendations\n"
        f"{recommendation_lines}\n\n"
        "## Business Alerts\n"
        f"{alert_lines}"
    )


async def _build_enterprise_overview_data(user: dict):
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
        "executive_overview": {
            "revenue_30d": 0,
            "profit_30d": 0,
            "margin_pct": 0,
            "branches": 0,
            "inventory_items": 0,
            "pos_registers": 0,
            "staff_active": 0,
            "wallet_balance": round(_num(user.get("balance")), 2),
            "avg_ticket": 0,
        },
        "financials": {
            "revenue_7d": 0,
            "revenue_30d": 0,
            "revenue_previous_30d": 0,
            "revenue_growth_pct": 0,
            "profit_30d": 0,
            "profit_previous_30d": 0,
            "profit_growth_pct": 0,
            "margin_pct": 0,
            "fees_30d": 0,
            "cogs_30d": 0,
            "avg_ticket": 0,
            "refunds_pending": 0,
            "wallet_inflow_30d": 0,
            "wallet_outflow_30d": 0,
        },
        "branches": [],
        "inventory": {"low_stock": [], "auto_reorder": [], "expiring_batches": [], "stock_value_cost": 0, "stock_value_retail": 0},
        "supplier_workflow": {"draft": 0, "submitted": 0, "approved": 0, "ordered": 0, "delivered": 0, "received": 0},
        "wallet": {"balance": round(_num(user.get("balance")), 2), "transactions": [], "refunds": 0, "commission_total": 0, "payouts": {"pending": 0, "processed": 0}},
        "analytics": {"daily": [], "weekly": [], "monthly": [], "yearly": [], "best_products": [], "worst_products": [], "employee_performance": []},
        "loyalty": {"total_members": 0, "tiers": {}, "points_issued": 0, "coupons_available": 0},
        "staff": {"source_mix": [], "next_shifts": [], "late_staff": []},
        "pos": {"registers": 0, "active_registers": 0, "avg_ticket": 0, "top_products": [], "slow_products": []},
        "merchant_kpis": {
            "revenue_per_branch": 0,
            "profit_per_branch": 0,
            "revenue_per_staff": 0,
            "stock_turnover_estimate": 0,
            "wallet_runway_days": None,
        },
        "insights": {
            "revenue": {},
            "inventory": {},
            "staff": {},
            "sales_forecast": {},
            "purchase_recommendations": [],
            "business_alerts": [],
            "executive_summary": [],
        },
    }

    if not pos_merchant:
        return base

    merchant_id = pos_merchant["merchant_id"]
    now = datetime.now(timezone.utc)
    start_30d_dt = now - timedelta(days=30)
    start_60d_dt = now - timedelta(days=60)
    start_14d_dt = now - timedelta(days=14)
    start_7d_dt = now - timedelta(days=7)
    start_30d = start_30d_dt.isoformat()
    start_365d = (now - timedelta(days=365)).isoformat()
    today_start = _today_start_iso()
    expiring_until = (now + timedelta(days=21)).date().isoformat()

    stores = await db.pos_stores.find({"merchant_id": merchant_id}, {"_id": 0}).to_list(300)
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
        {"_id": 0, "store_id": 1, "created_at": 1, "total": 1, "merchant_received": 1, "items": 1, "cashier_id": 1, "fee": 1},
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
    wallet_transactions_30d = await db.transactions.find(
        {"user_id": uid, "created_at": {"$gte": start_30d}},
        {"_id": 0, "amount": 1, "type": 1, "created_at": 1},
    ).to_list(5000)
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

    product_cost_by_id = {}
    product_cost_by_name = {}
    supplier_names = {}
    for supplier in suppliers:
        supplier_id = supplier.get("supplier_id")
        if supplier_id:
            supplier_names[supplier_id] = supplier.get("name") or supplier.get("company_name") or supplier.get("supplier_name") or supplier.get("contact_person") or supplier_id
    for product in products:
        cost = _num(product.get("purchase_price"))
        product_id = product.get("product_id")
        if product_id:
            product_cost_by_id[product_id] = cost
        name = product.get("name")
        if isinstance(name, str) and name.strip():
            product_cost_by_name[name.strip().lower()] = cost

    product_performance: Dict[str, Dict[str, Any]] = {}
    employee_performance: Dict[str, Dict[str, Any]] = {}
    branch_metrics: Dict[str, Dict[str, float]] = {}
    daily: Dict[str, float] = {}
    weekly: Dict[str, float] = {}
    monthly: Dict[str, float] = {}
    yearly: Dict[str, float] = {}
    units_sold_30d: Dict[str, float] = {}

    recent_revenue = 0.0
    recent_profit = 0.0
    recent_fees = 0.0
    recent_cogs = 0.0
    previous_revenue = 0.0
    previous_profit = 0.0
    previous_fees = 0.0
    previous_cogs = 0.0
    revenue_7d = 0.0
    revenue_prev_7d = 0.0
    commission_total = 0.0

    for sale in all_sales:
        sale_dt = _parse_iso(sale.get("created_at"))
        revenue_amount = _num(sale.get("merchant_received", sale.get("total")))
        fee_amount = _num(sale.get("fee"))
        sale_cost = 0.0
        sale_store_id = sale.get("store_id")

        for item in sale.get("items", []):
            qty = _num(item.get("quantity") or item.get("qty") or 1)
            product_id = item.get("product_id")
            name = item.get("name")
            cost_price = product_cost_by_id.get(product_id, product_cost_by_name.get(str(name or "").strip().lower(), 0.0))
            line_revenue = _num(item.get("line_total"))
            if line_revenue <= 0:
                line_revenue = _num(item.get("price")) * qty
            sale_cost += cost_price * qty

            perf_key = product_id or str(name or "Unbekannt")
            row = product_performance.setdefault(perf_key, {
                "product_id": product_id or perf_key,
                "name": name or perf_key,
                "qty": 0,
                "revenue": 0,
                "cost": 0,
                "profit": 0,
            })
            row["qty"] += qty
            row["revenue"] = round(row["revenue"] + line_revenue, 2)
            row["cost"] = round(row["cost"] + (cost_price * qty), 2)
            row["profit"] = round(row["profit"] + (line_revenue - (cost_price * qty)), 2)

            if sale_dt and sale_dt >= start_30d_dt:
                units_sold_30d[perf_key] = round(units_sold_30d.get(perf_key, 0.0) + qty, 2)

        profit_amount = revenue_amount - sale_cost - fee_amount
        commission_total += fee_amount

        cashier_id = sale.get("cashier_id") or "unknown"
        employee_perf = employee_performance.setdefault(cashier_id, {"cashier_id": cashier_id, "sales": 0, "revenue": 0, "profit": 0})
        employee_perf["sales"] += 1
        employee_perf["revenue"] = round(employee_perf["revenue"] + revenue_amount, 2)
        employee_perf["profit"] = round(employee_perf["profit"] + profit_amount, 2)

        if sale_dt:
            day_key = sale_dt.strftime("%Y-%m-%d")
            week_key = f"{sale_dt.isocalendar().year}-W{sale_dt.isocalendar().week:02d}"
            month_key = sale_dt.strftime("%Y-%m")
            year_key = sale_dt.strftime("%Y")
            daily[day_key] = round(daily.get(day_key, 0.0) + revenue_amount, 2)
            weekly[week_key] = round(weekly.get(week_key, 0.0) + revenue_amount, 2)
            monthly[month_key] = round(monthly.get(month_key, 0.0) + revenue_amount, 2)
            yearly[year_key] = round(yearly.get(year_key, 0.0) + revenue_amount, 2)

            if sale_dt >= start_30d_dt:
                recent_revenue += revenue_amount
                recent_profit += profit_amount
                recent_fees += fee_amount
                recent_cogs += sale_cost
                if sale_store_id:
                    branch_row = branch_metrics.setdefault(sale_store_id, {"orders": 0, "revenue": 0, "profit": 0})
                    branch_row["orders"] += 1
                    branch_row["revenue"] = round(branch_row["revenue"] + revenue_amount, 2)
                    branch_row["profit"] = round(branch_row["profit"] + profit_amount, 2)
            elif sale_dt >= start_60d_dt:
                previous_revenue += revenue_amount
                previous_profit += profit_amount
                previous_fees += fee_amount
                previous_cogs += sale_cost

            if sale_dt >= start_7d_dt:
                revenue_7d += revenue_amount
            elif sale_dt >= start_14d_dt:
                revenue_prev_7d += revenue_amount

    registers_per_store: Dict[str, int] = {}
    active_registers = 0
    for register in registers:
        registers_per_store[register["store_id"]] = registers_per_store.get(register["store_id"], 0) + 1
        if register.get("status") == "active":
            active_registers += 1

    low_stock = []
    auto_reorder = []
    stock_value_cost = 0.0
    stock_value_retail = 0.0
    products_by_store: Dict[str, int] = {}
    dead_stock_products = []
    purchase_recommendations = []
    for product in products:
        stock = _num(product.get("stock"))
        min_stock = _num(product.get("minimum_stock"))
        purchase_price = _num(product.get("purchase_price"))
        retail_price = _num(product.get("price"))
        stock_value_cost += stock * purchase_price
        stock_value_retail += stock * retail_price
        products_by_store[product["store_id"]] = products_by_store.get(product["store_id"], 0) + 1

        if product.get("track_stock") and min_stock > 0 and stock <= min_stock:
            low_stock.append(product)

        target_stock = _num(product.get("reorder_target_stock") or min_stock)
        if product.get("auto_reorder_enabled") and target_stock > stock:
            auto_reorder.append({
                "product_id": product["product_id"],
                "name": product.get("name"),
                "store_id": product.get("store_id"),
                "stock": stock,
                "target_stock": target_stock,
                "suggested_qty": round(max(0, target_stock - stock), 2),
                "supplier_id": product.get("supplier_id"),
            })

        perf_key = product.get("product_id") or str(product.get("name") or "")
        qty_sold_30d = _num(units_sold_30d.get(perf_key))
        daily_velocity = qty_sold_30d / 30 if qty_sold_30d > 0 else 0
        days_of_cover = round(stock / daily_velocity, 1) if daily_velocity > 0 else None
        recommendation_target = max(target_stock, min_stock, daily_velocity * 21)
        recommended_qty = round(max(0, recommendation_target - stock), 2)

        if stock > 0 and qty_sold_30d <= 0:
            dead_stock_products.append({
                "product_id": product.get("product_id"),
                "name": product.get("name"),
                "store_id": product.get("store_id"),
                "stock": stock,
                "stock_value_cost": round(stock * purchase_price, 2),
            })

        if product.get("track_stock") and recommended_qty > 0 and (stock <= min_stock or (days_of_cover is not None and days_of_cover < 14)):
            purchase_recommendations.append({
                "product_id": product.get("product_id"),
                "name": product.get("name"),
                "store_id": product.get("store_id"),
                "supplier_id": product.get("supplier_id"),
                "supplier_name": supplier_names.get(product.get("supplier_id")),
                "stock": round(stock, 2),
                "minimum_stock": round(min_stock, 2),
                "qty_sold_30d": round(qty_sold_30d, 2),
                "days_of_cover": days_of_cover,
                "suggested_qty": recommended_qty,
                "reason": "Low stock" if stock <= min_stock else "Fast moving",
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
        store_metrics = branch_metrics.get(store["store_id"], {"orders": 0, "revenue": 0, "profit": 0})
        branches.append({
            "store_id": store["store_id"],
            "name": store.get("name"),
            "city": store.get("city"),
            "status": store.get("status"),
            "registers": registers_per_store.get(store["store_id"], 0),
            "products": products_by_store.get(store["store_id"], 0),
            "low_stock": len([p for p in low_stock if p.get("store_id") == store["store_id"]]),
            "orders_30d": store_metrics.get("orders", 0),
            "revenue_30d": round(store_metrics.get("revenue", 0), 2),
            "profit_30d": round(store_metrics.get("profit", 0), 2),
            "margin_pct": _margin(store_metrics.get("profit", 0), store_metrics.get("revenue", 0)),
        })
    branches.sort(key=lambda item: item.get("revenue_30d", 0), reverse=True)

    processed_payouts = round(sum(_num(p.get("amount")) for p in payouts if p.get("status") == "processed"), 2)
    pending_payouts = round(sum(_num(p.get("amount")) for p in payouts if p.get("status") in {"pending", "approved"}), 2)
    wallet_inflow_30d = round(sum(_num(tx.get("amount")) for tx in wallet_transactions_30d if _num(tx.get("amount")) > 0), 2)
    wallet_outflow_30d = round(sum(abs(_num(tx.get("amount"))) for tx in wallet_transactions_30d if _num(tx.get("amount")) < 0), 2)

    best_products = sorted(product_performance.values(), key=lambda item: item["revenue"], reverse=True)[:5]
    worst_products = sorted(dead_stock_products, key=lambda item: item.get("stock_value_cost", 0), reverse=True)[:5]
    best_employees = sorted(employee_performance.values(), key=lambda item: item["revenue"], reverse=True)[:6]
    purchase_recommendations.sort(key=lambda item: ((item.get("days_of_cover") if item.get("days_of_cover") is not None else 9999), -item.get("qty_sold_30d", 0)))

    revenue_growth_pct = _pct_delta(recent_revenue, previous_revenue)
    profit_growth_pct = _pct_delta(recent_profit, previous_profit)
    avg_ticket = round(recent_revenue / len(sales_30d), 2) if sales_30d else 0
    next_7_days_revenue = round((revenue_7d or (recent_revenue / 30 * 7)) * (1 + _clamp((_pct_delta(revenue_7d, revenue_prev_7d) / 100) * 0.6, -0.18, 0.22)), 2)
    next_30_days_revenue = round((recent_revenue or (revenue_7d * 4.2)) * (1 + _clamp((_pct_delta(revenue_7d, revenue_prev_7d) / 100) * 0.8, -0.22, 0.28)), 2)
    next_30_days_profit = round(next_30_days_revenue * (_margin(recent_profit, recent_revenue) / 100), 2)
    forecast_confidence = "high" if len(sales_30d) >= 80 else "medium" if len(sales_30d) >= 20 else "low"

    alerts = []
    if revenue_growth_pct <= -8:
        alerts.append({"severity": "high", "title": "Umsatztrend rückläufig", "body": f"Der 30-Tage-Umsatz liegt {abs(revenue_growth_pct):.1f}% unter der Vorperiode."})
    if len(low_stock) > 0:
        alerts.append({"severity": "high", "title": "Low-Stock-Risiko", "body": f"{len(low_stock)} Produkte liegen bereits auf oder unter Mindestbestand."})
    if len(batches) > 0:
        alerts.append({"severity": "medium", "title": "Ablaufende Bestände", "body": f"{len(batches)} Chargen laufen in den nächsten 21 Tagen ab."})
    if len(late_staff) > 0:
        alerts.append({"severity": "medium", "title": "Schichtabdeckung gefährdet", "body": f"{len(late_staff)} Mitarbeitende sind für bereits gestartete Schichten noch nicht eingeclockt."})
    if refunds_pending > 0:
        alerts.append({"severity": "medium", "title": "Offene Refunds", "body": f"{refunds_pending} Rückerstattungen warten auf Bearbeitung."})
    if pending_payouts > 0:
        alerts.append({"severity": "medium", "title": "Ausstehende Auszahlungen", "body": f"€{pending_payouts:,.2f} sind noch nicht ausgezahlt."})
    if registers and active_registers < len(registers):
        alerts.append({"severity": "low", "title": "POS nicht vollständig aktiv", "body": f"Nur {active_registers} von {len(registers)} Kassen sind aktiv."})

    top_branch = branches[0] if branches else None
    executive_summary = [
        f"30-Tage-Umsatz €{recent_revenue:,.2f} mit €{recent_profit:,.2f} Profit und {(_margin(recent_profit, recent_revenue)):.2f}% Marge.",
        f"{len(stores)} Filialen, {len(registers)} POS-Kassen und {len(staff_members)} aktive Mitarbeitende sind in der aktuellen Operating-Lage sichtbar.",
        f"Top-Filiale ist {top_branch.get('name')} mit €{top_branch.get('revenue_30d', 0):,.2f} Umsatz." if top_branch else "Noch keine Filialumsätze verfügbar.",
        f"{len(purchase_recommendations)} priorisierte Nachkauf-Empfehlungen und {len(alerts)} operative Alerts wurden aus POS, Inventory, Wallet und Staff-Modulen erzeugt.",
    ]

    wallet_runway_days = None
    if wallet_outflow_30d > 0:
        wallet_runway_days = round(_num(user.get("balance")) / max(wallet_outflow_30d / 30, 0.01), 1)

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
            "revenue_30d": round(recent_revenue, 2),
            "sales_30d": len(sales_30d),
            "wallet_transactions": len(wallet_transactions),
            "payouts_pending": pending_payouts,
            "payouts_processed": processed_payouts,
            "staff_active": len(staff_members),
            "staff_clocked_in": active_now,
            "staff_on_break": on_break,
        },
        "executive_overview": {
            "revenue_30d": round(recent_revenue, 2),
            "profit_30d": round(recent_profit, 2),
            "margin_pct": _margin(recent_profit, recent_revenue),
            "branches": len(stores),
            "inventory_items": len(products),
            "pos_registers": len(registers),
            "staff_active": len(staff_members),
            "wallet_balance": round(_num(user.get("balance")), 2),
            "avg_ticket": avg_ticket,
        },
        "financials": {
            "revenue_7d": round(revenue_7d, 2),
            "revenue_30d": round(recent_revenue, 2),
            "revenue_previous_30d": round(previous_revenue, 2),
            "revenue_growth_pct": revenue_growth_pct,
            "profit_30d": round(recent_profit, 2),
            "profit_previous_30d": round(previous_profit, 2),
            "profit_growth_pct": profit_growth_pct,
            "margin_pct": _margin(recent_profit, recent_revenue),
            "fees_30d": round(recent_fees, 2),
            "cogs_30d": round(recent_cogs, 2),
            "avg_ticket": avg_ticket,
            "refunds_pending": refunds_pending,
            "wallet_inflow_30d": wallet_inflow_30d,
            "wallet_outflow_30d": wallet_outflow_30d,
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
            "inflow_30d": wallet_inflow_30d,
            "outflow_30d": wallet_outflow_30d,
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
        "pos": {
            "registers": len(registers),
            "active_registers": active_registers,
            "avg_ticket": avg_ticket,
            "top_products": best_products,
            "slow_products": worst_products,
        },
        "merchant_kpis": {
            "revenue_per_branch": round(recent_revenue / max(len(stores), 1), 2),
            "profit_per_branch": round(recent_profit / max(len(stores), 1), 2),
            "revenue_per_staff": round(recent_revenue / max(len(staff_members), 1), 2),
            "stock_turnover_estimate": round(recent_cogs / max(stock_value_cost, 1), 2) if stock_value_cost > 0 else 0,
            "wallet_runway_days": wallet_runway_days,
        },
        "insights": {
            "revenue": {
                "revenue_30d": round(recent_revenue, 2),
                "revenue_previous_30d": round(previous_revenue, 2),
                "growth_pct": revenue_growth_pct,
                "profit_30d": round(recent_profit, 2),
                "margin_pct": _margin(recent_profit, recent_revenue),
                "avg_ticket": avg_ticket,
                "top_branch": top_branch,
                "run_rate_monthly": round((revenue_7d / 7) * 30, 2) if revenue_7d > 0 else round(recent_revenue, 2),
            },
            "inventory": {
                "low_stock_count": len(low_stock),
                "auto_reorder_count": len(auto_reorder),
                "expiring_batches_count": len(batches),
                "dead_stock_count": len(dead_stock_products),
                "stock_value_cost": round(stock_value_cost, 2),
                "stock_value_retail": round(stock_value_retail, 2),
                "top_risk_items": purchase_recommendations[:5],
            },
            "staff": {
                "active_staff": len(staff_members),
                "clocked_in": active_now,
                "on_break": on_break,
                "late_staff_count": len(late_staff),
                "revenue_per_staff_30d": round(recent_revenue / max(len(staff_members), 1), 2),
                "top_performers": [
                    {**item, "name": staff_map.get(item["cashier_id"], {}).get("name", item["cashier_id"])}
                    for item in best_employees[:3]
                ],
            },
            "sales_forecast": {
                "next_7_days_revenue": next_7_days_revenue,
                "next_30_days_revenue": next_30_days_revenue,
                "next_30_days_profit": next_30_days_profit,
                "confidence": forecast_confidence,
                "basis": "recent_sales_trend",
            },
            "purchase_recommendations": purchase_recommendations[:8],
            "business_alerts": alerts[:8],
            "executive_summary": executive_summary,
        },
    }


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
    merchant_doc = await db.merchants.find_one({"user_id": uid}, {"_id": 0, "public_slug": 1, "business_name": 1})
    public_slug = (profile or {}).get("public_slug") or (merchant_doc or {}).get("public_slug")

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
        "public_slug": public_slug,
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
    return await _build_enterprise_overview_data(user)


@router.get("/v5/dashboard")
async def get_v5_dashboard(request: Request):
    user = await require_merchant(request)
    data = await _build_enterprise_overview_data(user)
    return {"generated_at": datetime.now(timezone.utc).isoformat(), **data}


@router.get("/v5/executive-ai/latest")
async def get_v5_executive_ai_latest(request: Request):
    user = await require_merchant(request)
    uid = str(user["_id"])
    reports = await db[EXECUTIVE_AI_COLLECTION].find(
        {"user_id": uid},
        {"_id": 0},
    ).sort("created_at", -1).limit(5).to_list(5)
    latest = reports[0] if reports else None
    return {"report": latest, "history": reports}


@router.post("/v5/executive-ai/stream")
async def stream_v5_executive_ai(request: Request, payload: ExecutiveAiBriefRequest):
    user = await require_merchant(request)
    uid = str(user["_id"])
    enterprise = await _build_enterprise_overview_data(user)
    context = {
        "focus": payload.focus,
        "company": enterprise.get("company"),
        "executive_overview": enterprise.get("executive_overview"),
        "financials": enterprise.get("financials"),
        "merchant_kpis": enterprise.get("merchant_kpis"),
        "branches": enterprise.get("branches", [])[:5],
        "revenue": enterprise.get("insights", {}).get("revenue", {}),
        "inventory": enterprise.get("insights", {}).get("inventory", {}),
        "staff": enterprise.get("insights", {}).get("staff", {}),
        "sales_forecast": enterprise.get("insights", {}).get("sales_forecast", {}),
        "purchase_recommendations": enterprise.get("insights", {}).get("purchase_recommendations", [])[:5],
        "business_alerts": enterprise.get("insights", {}).get("business_alerts", [])[:6],
        "executive_summary": enterprise.get("insights", {}).get("executive_summary", []),
    }
    prompt = _build_executive_ai_prompt(context)
    report_id = f"mxr_{uuid.uuid4().hex[:12]}"
    now_iso = datetime.now(timezone.utc).isoformat()

    await db[EXECUTIVE_AI_COLLECTION].insert_one({
        "report_id": report_id,
        "user_id": uid,
        "merchant_id": enterprise.get("company", {}).get("merchant_id"),
        "focus": payload.focus,
        "status": "generating",
        "provider": EXECUTIVE_AI_PROVIDER,
        "model": EXECUTIVE_AI_MODEL,
        "prompt": prompt,
        "context_snapshot": context,
        "created_at": now_iso,
        "updated_at": now_iso,
    })

    async def event_stream():
        yield f"data: {json.dumps({'type': 'meta', 'report_id': report_id})}\n\n"
        final_text = ""
        api_key = os.getenv("EMERGENT_LLM_KEY")
        final_provider = "rules-fallback"
        final_model = "deterministic"

        if api_key:
            last_error = None
            for provider, model in EXECUTIVE_AI_FALLBACKS:
                try:
                    chat = LlmChat(
                        api_key=api_key,
                        session_id=f"merchant-v5-{uid}-{report_id}-{provider}",
                        system_message="You are BidBlitz Executive AI. You write concise, board-ready merchant briefings grounded only in the supplied business data.",
                    ).with_model(provider, model)
                    final_provider = provider
                    final_model = model
                    async for event in chat.stream_message(UserMessage(text=prompt)):
                        if isinstance(event, TextDelta):
                            final_text += event.content
                            yield f"data: {json.dumps({'type': 'chunk', 'content': event.content})}\n\n"
                        elif isinstance(event, StreamDone):
                            break
                    if final_text.strip():
                        break
                except Exception as exc:
                    last_error = exc
                    final_text = ""
                    continue

            if not final_text.strip():
                exc = last_error or RuntimeError("No executive AI model returned content")
                final_text = _build_fallback_executive_report(context)
                await db[EXECUTIVE_AI_COLLECTION].update_one(
                    {"report_id": report_id},
                    {"$set": {"provider": "rules-fallback", "status": "completed", "report_text": final_text, "error": str(exc), "updated_at": datetime.now(timezone.utc).isoformat()}},
                )
                for chunk in _chunk_text(final_text):
                    yield f"data: {json.dumps({'type': 'chunk', 'content': chunk})}\n\n"
                yield f"data: {json.dumps({'type': 'done', 'report_id': report_id, 'provider': 'rules-fallback'})}\n\n"
                return

        if not final_text.strip():
            final_text = _build_fallback_executive_report(context)

        await db[EXECUTIVE_AI_COLLECTION].update_one(
            {"report_id": report_id},
            {"$set": {"status": "completed", "report_text": final_text, "updated_at": datetime.now(timezone.utc).isoformat(), "provider": final_provider, "model": final_model}},
        )
        yield f"data: {json.dumps({'type': 'done', 'report_id': report_id, 'provider': final_provider})}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.get("/v5/business-automation")
async def get_v5_business_automation(request: Request):
    user = await require_merchant(request)
    return await _build_business_automation_dashboard(user)


@router.post("/v5/business-automation/settings")
async def update_v5_business_automation_settings(request: Request, payload: BusinessAutomationSettingsUpdate):
    user = await require_merchant(request)
    uid = str(user["_id"])
    updates = payload.model_dump(exclude_none=True)
    if "reorder_days_cover_threshold" in updates:
        updates["reorder_days_cover_threshold"] = int(_clamp(int(updates["reorder_days_cover_threshold"]), 3, 45))
    if "flash_sale_discount_pct" in updates:
        updates["flash_sale_discount_pct"] = int(_clamp(int(updates["flash_sale_discount_pct"]), 5, 40))
    if "flash_sale_duration_minutes" in updates:
        updates["flash_sale_duration_minutes"] = int(_clamp(int(updates["flash_sale_duration_minutes"]), 15, 1440))
    if "late_shift_grace_minutes" in updates:
        updates["late_shift_grace_minutes"] = int(_clamp(int(updates["late_shift_grace_minutes"]), 0, 120))
    updates["user_id"] = uid
    updates["updated_at"] = _now_iso()
    await db[BUSINESS_AUTOMATION_SETTINGS_COLLECTION].update_one(
        {"user_id": uid},
        {"$set": updates},
        upsert=True,
    )
    return {"ok": True, "settings": await _get_business_automation_settings(uid)}


@router.post("/v5/business-automation/run/procurement")
async def run_v5_business_automation_procurement(request: Request, payload: ProcurementAutomationRunRequest):
    user = await require_merchant(request)
    uid = str(user["_id"])
    enterprise = await _build_enterprise_overview_data(user)
    merchant_id = enterprise.get("company", {}).get("merchant_id")
    if not merchant_id:
        run = await _record_business_automation_run(uid, None, "procurement", "skipped", "Kein POS-Händlerprofil für Procurement Automation vorhanden", {"created_purchase_orders": []})
        return {"ok": True, "run": run, "purchase_orders": []}

    queue = enterprise.get("insights", {}).get("purchase_recommendations", [])[: max(1, min(payload.max_purchase_orders, 12))]
    if not queue:
        run = await _record_business_automation_run(uid, merchant_id, "procurement", "skipped", "Keine Nachbestell-Empfehlungen vorhanden", {"created_purchase_orders": []})
        return {"ok": True, "run": run, "purchase_orders": []}

    created_purchase_orders = []
    open_purchase_orders = await db.pos_purchase_orders.find(
        {"merchant_id": merchant_id, "status": {"$in": ["draft", "submitted", "approved", "ordered", "delivered"]}},
        {"_id": 0, "po_id": 1, "supplier_id": 1, "store_id": 1, "items": 1},
    ).to_list(500)
    existing_signatures = set()
    for po in open_purchase_orders:
        for item in po.get("items", []):
            existing_signatures.add((po.get("supplier_id"), po.get("store_id"), item.get("product_id")))

    grouped: Dict[tuple, list] = {}
    for recommendation in queue:
        signature = (recommendation.get("supplier_id"), recommendation.get("store_id"), recommendation.get("product_id"))
        if not signature[0] or signature in existing_signatures:
            continue
        grouped.setdefault((recommendation.get("supplier_id"), recommendation.get("store_id")), []).append(recommendation)

    for (supplier_id, store_id), items in list(grouped.items())[: max(1, min(payload.max_purchase_orders, 12))]:
        supplier = await db.pos_suppliers.find_one({"supplier_id": supplier_id, "merchant_id": merchant_id}, {"_id": 0, "name": 1})
        if not supplier:
            continue
        enriched_items = []
        total_cost = 0.0
        for item in items:
            product = await db.pos_products.find_one({"product_id": item.get("product_id"), "merchant_id": merchant_id}, {"_id": 0})
            if not product:
                continue
            quantity = round(max(_num(item.get("suggested_qty")), 1), 2)
            purchase_price = round(_num(product.get("purchase_price")), 2)
            line_total = round(quantity * purchase_price, 2)
            total_cost += line_total
            enriched_items.append({
                "product_id": product.get("product_id"),
                "product_name": product.get("name"),
                "barcode": product.get("barcode"),
                "quantity": quantity,
                "purchase_price": purchase_price,
                "line_total": line_total,
                "received": 0,
                "reorder_note": f"Auto-generated · {item.get('reason', 'Reorder')} · Cover {item.get('days_of_cover') or 'n/a'} Tage",
            })
        if not enriched_items:
            continue

        po_id = f"POAUTO{uuid.uuid4().hex[:8].upper()}"
        po_doc = {
            "po_id": po_id,
            "merchant_id": merchant_id,
            "store_id": store_id,
            "supplier_id": supplier_id,
            "supplier_name": supplier.get("name") or supplier_id,
            "items": enriched_items,
            "total_cost": round(total_cost, 2),
            "status": "submitted",
            "note": "Auto-generated by Merchant Platform V5 Business Automation",
            "created_by": uid,
            "created_at": _now_iso(),
            "submitted_at": _now_iso(),
            "submitted_by": uid,
            "automation_source": "business_automation",
        }
        await db.pos_purchase_orders.insert_one(po_doc)
        created_purchase_orders.append({k: v for k, v in po_doc.items() if k != "_id"})

    run = await _record_business_automation_run(
        uid,
        merchant_id,
        "procurement",
        "completed" if created_purchase_orders else "skipped",
        f"{len(created_purchase_orders)} automatische PO(s) erstellt",
        {"created_purchase_orders": created_purchase_orders},
    )
    return {"ok": True, "run": run, "purchase_orders": created_purchase_orders}


@router.post("/v5/business-automation/run/operations")
async def run_v5_business_automation_operations(request: Request, payload: OperationsAutomationRunRequest):
    user = await require_merchant(request)
    uid = str(user["_id"])
    enterprise = await _build_enterprise_overview_data(user)
    staff_members = await db.staff_members.find({"merchant_id": uid, "active": True}, {"_id": 0, "id": 1, "name": 1, "role": 1}).to_list(500)
    if not staff_members:
        run = await _record_business_automation_run(uid, enterprise.get("company", {}).get("merchant_id"), "operations", "skipped", "Keine aktiven Mitarbeiter für Operations Automation vorhanden", {"tasks": []})
        return {"ok": True, "run": run, "tasks": []}
    manager_assignee = next((member for member in staff_members if member.get("role") in {"manager", "lead", "supervisor"}), staff_members[0])
    created_tasks = []
    now_iso = _now_iso()

    async def ensure_task(staff_id: str, title: str, description: str, tags: List[str], priority: str = "normal", due_date: Optional[str] = None):
        existing = await db.staff_tasks.find_one(
            {"merchant_id": uid, "staff_id": staff_id, "title": title, "status": "open"},
            {"_id": 0, "id": 1},
        )
        if existing:
            return None
        task = {
            "id": str(uuid.uuid4()),
            "merchant_id": uid,
            "staff_id": staff_id,
            "title": title,
            "description": description,
            "due_date": due_date,
            "status": "open",
            "priority": priority,
            "tags": tags,
            "subtasks": [],
            "attachments": [],
            "comment_count": 0,
            "created_at": now_iso,
            "completed_at": None,
        }
        await db.staff_tasks.insert_one(task)
        created_tasks.append({k: v for k, v in task.items() if k != "_id"})
        return task

    if payload.assign_late_staff_tasks:
        for item in enterprise.get("staff", {}).get("late_staff", [])[:8]:
            await ensure_task(
                item.get("staff_id"),
                "Clock-in Ausnahme prüfen",
                f"Bitte Schichtstatus für {item.get('title') or 'heutige Schicht'} am Standort {item.get('location') or 'offen'} bestätigen.",
                ["automation", "attendance"],
                "high",
                now_iso,
            )

    if payload.convert_alerts_to_tasks:
        for alert in enterprise.get("insights", {}).get("business_alerts", [])[:6]:
            await ensure_task(
                manager_assignee.get("id"),
                f"Automation Alert: {alert.get('title')}",
                alert.get("body") or "Bitte prüfen und Maßnahme einleiten.",
                ["automation", "alert", alert.get("severity") or "info"],
                "high" if alert.get("severity") == "high" else "normal",
                now_iso,
            )

    run = await _record_business_automation_run(
        uid,
        enterprise.get("company", {}).get("merchant_id"),
        "operations",
        "completed" if created_tasks else "skipped",
        f"{len(created_tasks)} Operations-Task(s) erzeugt",
        {"tasks": created_tasks},
    )
    return {"ok": True, "run": run, "tasks": created_tasks}


@router.post("/v5/business-automation/run/revenue")
async def run_v5_business_automation_revenue(request: Request, payload: RevenueAutomationRunRequest):
    user = await require_merchant(request)
    uid = str(user["_id"])
    settings = await _get_business_automation_settings(uid)
    dashboard = await _build_business_automation_dashboard(user)
    opportunities = dashboard.get("revenue", {}).get("opportunities", [])[: max(1, min(payload.limit, 6))]
    created_sales = []
    now = datetime.now(timezone.utc)

    for item in opportunities:
        listing = await db.marketplace_listings.find_one({"listing_id": item.get("listing_id"), "seller_id": uid, "status": "active"}, {"_id": 0})
        if not listing:
            continue
        existing = await db.commerce_flash_sales.find_one(
            {"listing_id": item.get("listing_id"), "status": {"$in": ["active", "processing"]}, "remaining_units": {"$gt": 0}},
            {"_id": 0, "sale_id": 1},
        )
        if existing:
            continue
        sale = {
            "sale_id": f"flash_{secrets.token_hex(5)}",
            "listing_id": item.get("listing_id"),
            "seller_id": uid,
            "seller_name": listing.get("seller_name") or user.get("name") or user.get("email") or "BidBlitz Deals",
            "title": listing.get("title", "Flash Deal"),
            "category": listing.get("category", "other"),
            "category_label": listing.get("category_label") or listing.get("category", "Sonstiges"),
            "image_url": (listing.get("images") or [""])[0],
            "location": listing.get("location", ""),
            "original_price": round(_num(listing.get("price")), 2),
            "sale_price": round(_num(item.get("sale_price")), 2),
            "discount_pct": int(item.get("discount_pct") or settings.get("flash_sale_discount_pct") or 18),
            "shipping_available": bool(listing.get("shipping_available")),
            "shipping_cost": round(_num(listing.get("shipping_cost")), 2),
            "remaining_units": 1,
            "status": "active",
            "starts_at": now.isoformat(),
            "ends_at": (now + timedelta(minutes=int(item.get("duration_minutes") or settings.get("flash_sale_duration_minutes") or 180))).isoformat(),
            "created_at": now.isoformat(),
            "created_via": "business_automation",
        }
        await db.commerce_flash_sales.insert_one(sale)
        created_sales.append({**sale, "remaining_seconds": _remaining_seconds(sale.get("ends_at"))})

    run = await _record_business_automation_run(
        uid,
        dashboard.get("overview", {}).get("merchant_id"),
        "revenue",
        "completed" if created_sales else "skipped",
        f"{len(created_sales)} Flash-Sale-Aktion(en) erzeugt",
        {"flash_sales": created_sales},
    )
    return {"ok": True, "run": run, "flash_sales": created_sales}


@router.post("/v5/business-automation/run/full")
async def run_v5_business_automation_full(request: Request):
    user = await require_merchant(request)
    procurement = await run_v5_business_automation_procurement(request, ProcurementAutomationRunRequest(max_purchase_orders=4))
    operations = await run_v5_business_automation_operations(request, OperationsAutomationRunRequest(assign_late_staff_tasks=True, convert_alerts_to_tasks=True))
    revenue = await run_v5_business_automation_revenue(request, RevenueAutomationRunRequest(limit=3))
    summary = {
        "purchase_orders_created": len(procurement.get("purchase_orders", [])),
        "tasks_created": len(operations.get("tasks", [])),
        "flash_sales_created": len(revenue.get("flash_sales", [])),
    }
    run = await _record_business_automation_run(
        str(user["_id"]),
        None,
        "full",
        "completed",
        f"Full automation run: {summary['purchase_orders_created']} POs, {summary['tasks_created']} Tasks, {summary['flash_sales_created']} Flash Sales",
        summary,
    )
    return {"ok": True, "summary": summary, "run": run, "procurement": procurement, "operations": operations, "revenue": revenue}


@router.get("/v5/ops-suite")
async def get_v5_ops_suite(request: Request):
    user = await require_merchant(request)
    return await _build_ops_suite(user)


@router.post("/v5/companies/upsert")
async def upsert_v5_ops_company(request: Request, payload: OpsCompanyUpsertRequest):
    user = await require_merchant(request)
    uid = str(user["_id"])
    company_id = payload.company_id or f"mco_{uuid.uuid4().hex[:10]}"
    current = await db[OPS_COMPANIES_COLLECTION].find_one({"user_id": uid, "company_id": company_id}, {"_id": 0, "is_primary": 1, "merchant_id": 1})
    company_doc = {
        "company_id": company_id,
        "user_id": uid,
        "merchant_id": (current or {}).get("merchant_id"),
        "name": payload.name.strip(),
        "legal_name": payload.legal_name.strip(),
        "country": payload.country.strip(),
        "status": _ops_status(payload.status, ["active", "paused", "onboarding", "archived"], "active"),
        "manager_email": payload.manager_email.strip(),
        "tax_id": payload.tax_id.strip(),
        "wallet_budget": round(_num(payload.wallet_budget), 2),
        "branch_count": max(1, min(int(payload.branch_count or 1), 999)),
        "is_primary": bool((current or {}).get("is_primary", False)),
        "updated_at": _now_iso(),
    }
    if not current:
        company_doc["created_at"] = _now_iso()
    await db[OPS_COMPANIES_COLLECTION].update_one(
        {"user_id": uid, "company_id": company_id},
        {"$set": company_doc},
        upsert=True,
    )
    saved = await db[OPS_COMPANIES_COLLECTION].find_one({"user_id": uid, "company_id": company_id}, {"_id": 0})
    return {"ok": True, "company": saved}


@router.post("/v5/documents/upsert")
async def upsert_v5_ops_document(request: Request, payload: OpsDocumentUpsertRequest):
    user = await require_merchant(request)
    uid = str(user["_id"])
    document_id = payload.document_id or f"mdoc_{uuid.uuid4().hex[:10]}"
    document_doc = {
        "document_id": document_id,
        "user_id": uid,
        "title": payload.title.strip(),
        "category": _ops_status(payload.category, ["compliance", "finance", "operations", "contract", "general"], "general"),
        "status": _ops_status(payload.status, ["draft", "active", "expiring", "archived"], "draft"),
        "linked_company_id": payload.linked_company_id.strip(),
        "expiry_date": payload.expiry_date.strip(),
        "external_url": payload.external_url.strip(),
        "notes": payload.notes.strip(),
        "updated_at": _now_iso(),
    }
    await db[OPS_DOCUMENTS_COLLECTION].update_one(
        {"user_id": uid, "document_id": document_id},
        {"$set": {**document_doc, "created_at": document_doc.get("created_at") or _now_iso()}},
        upsert=True,
    )
    saved = await db[OPS_DOCUMENTS_COLLECTION].find_one({"user_id": uid, "document_id": document_id}, {"_id": 0})
    return {"ok": True, "document": saved}


@router.post("/v5/maintenance/upsert")
async def upsert_v5_ops_maintenance(request: Request, payload: OpsMaintenanceUpsertRequest):
    user = await require_merchant(request)
    uid = str(user["_id"])
    ticket_id = payload.ticket_id or f"mmt_{uuid.uuid4().hex[:10]}"
    ticket_doc = {
        "ticket_id": ticket_id,
        "user_id": uid,
        "asset_name": payload.asset_name.strip(),
        "asset_type": _ops_status(payload.asset_type, ["terminal", "printer", "display", "store", "vehicle", "other"], "terminal"),
        "priority": _ops_status(payload.priority, ["low", "medium", "high"], "medium"),
        "status": _ops_status(payload.status, ["open", "scheduled", "in_progress", "done", "archived"], "open"),
        "linked_company_id": payload.linked_company_id.strip(),
        "vendor_name": payload.vendor_name.strip(),
        "next_check_at": payload.next_check_at.strip(),
        "notes": payload.notes.strip(),
        "updated_at": _now_iso(),
    }
    await db[OPS_MAINTENANCE_COLLECTION].update_one(
        {"user_id": uid, "ticket_id": ticket_id},
        {"$set": {**ticket_doc, "created_at": ticket_doc.get("created_at") or _now_iso()}},
        upsert=True,
    )
    saved = await db[OPS_MAINTENANCE_COLLECTION].find_one({"user_id": uid, "ticket_id": ticket_id}, {"_id": 0})
    return {"ok": True, "ticket": saved}
