from datetime import datetime, timezone, timedelta
from typing import Any, Dict
import csv
import io

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import Response

from core.database import db
from core.security import get_current_user

router = APIRouter(prefix="/api/executive", tags=["executive-center"])


async def _require_access(request: Request):
    user = await get_current_user(request)
    if user.get("role") not in {"admin", "investor", "merchant"}:
        raise HTTPException(status_code=403, detail="Nur Admin, Investor oder Merchant")
    return user


def _sum_amount(rows, key: str) -> float:
    total = 0.0
    for row in rows:
        try:
            total += float(row.get(key, 0) or 0)
        except Exception:
            continue
    return round(total, 2)


async def _build_platform_kpis() -> Dict[str, Any]:
    now = datetime.now(timezone.utc)
    today = now.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    month_ago = (now - timedelta(days=30)).isoformat()
    year_ago = (now - timedelta(days=365)).isoformat()

    total_users = await db.users.count_documents({})
    active_users = await db.users.count_documents({"last_active_date": {"$gte": today[:10]}})
    total_merchants = await db.users.count_documents({"role": "merchant"})
    active_merchants = await db.users.count_documents({"role": "merchant", "last_active_date": {"$gte": today[:10]}})

    transactions = await db.transactions.find({"created_at": {"$gte": month_ago}}, {"_id": 0, "amount": 1, "type": 1, "created_at": 1}).to_list(20000)
    wallet_volume = _sum_amount([t for t in transactions if t.get("type") in {"wallet_topup", "wallet_transfer", "payment", "merchant_payment"}], "amount")
    taxi_volume = _sum_amount(await db.taxi_rides.find({"created_at": {"$gte": month_ago}}, {"_id": 0, "price": 1}).to_list(5000), "price")
    ev_volume = _sum_amount(await db.ev_sessions.find({"created_at": {"$gte": month_ago}}, {"_id": 0, "total_cost": 1}).to_list(5000), "total_cost")
    marketplace_volume = _sum_amount(await db.marketplace_orders.find({"created_at": {"$gte": month_ago}}, {"_id": 0, "total": 1}).to_list(5000), "total")
    pos_revenue = _sum_amount(await db.pos_sales.find({"created_at": {"$gte": month_ago}, "status": "completed"}, {"_id": 0, "total": 1}).to_list(20000), "total")

    users_month = await db.users.count_documents({"created_at": {"$gte": month_ago}})
    merchants_month = await db.users.count_documents({"role": "merchant", "created_at": {"$gte": month_ago}})
    txn_growth = len(transactions)

    revenue_events = await db.revenue_events.find({"created_at": {"$gte": year_ago}}, {"_id": 0, "source": 1, "amount": 1, "created_at": 1}).to_list(30000)
    monthly_buckets: Dict[str, float] = {}
    for row in revenue_events:
        key = str(row.get("created_at", ""))[:7]
        if key:
            monthly_buckets[key] = round(monthly_buckets.get(key, 0.0) + float(row.get("amount", 0) or 0), 2)
    months_sorted = sorted(monthly_buckets.items())[-6:]
    avg_mrr = round(sum(v for _, v in months_sorted) / len(months_sorted), 2) if months_sorted else 0
    forecast = round(avg_mrr * 1.12, 2) if avg_mrr else 0

    return {
        "executive": {
            "total_users": total_users,
            "active_users": active_users,
            "merchants": total_merchants,
            "active_merchants": active_merchants,
            "transactions": len(transactions),
            "wallet_volume": wallet_volume,
            "taxi_volume": taxi_volume,
            "ev_volume": ev_volume,
        },
        "investor": {
            "monthly_recurring_revenue": avg_mrr,
            "merchant_growth": merchants_month,
            "user_growth": users_month,
            "transaction_growth": txn_growth,
            "revenue_forecast": forecast,
        },
        "revenue_center": {
            "pos_revenue": pos_revenue,
            "wallet_revenue": wallet_volume,
            "taxi_revenue": taxi_volume,
            "ev_revenue": ev_volume,
            "marketplace_revenue": marketplace_volume,
        },
        "public_statistics": {
            "active_merchants": active_merchants,
            "active_users": active_users,
            "transactions": len(transactions),
        },
        "monthly_revenue": [{"period": k, "revenue": v} for k, v in months_sorted],
    }


@router.get("/dashboard")
async def executive_dashboard(request: Request):
    await _require_access(request)
    return await _build_platform_kpis()


@router.get("/franchise-dashboard")
async def franchise_dashboard(request: Request):
    await _require_access(request)
    branches = await db.pos_stores.find({}, {"_id": 0, "store_id": 1, "name": 1, "city": 1, "merchant_id": 1}).to_list(500)
    staff = await db.staff_members.find({"active": True}, {"_id": 0, "merchant_id": 1, "name": 1}).to_list(5000)
    inventory = await db.pos_products.find({"active": True}, {"_id": 0, "store_id": 1, "stock": 1, "minimum_stock": 1}).to_list(10000)
    sales = await db.pos_sales.find({"status": "completed"}, {"_id": 0, "store_id": 1, "total": 1}).sort("created_at", -1).limit(20000).to_list(20000)
    cards = []
    for branch in branches:
        branch_sales = [s for s in sales if s.get("store_id") == branch["store_id"]]
        branch_inventory = [p for p in inventory if p.get("store_id") == branch["store_id"]]
        low_stock = len([p for p in branch_inventory if float(p.get("minimum_stock", 0) or 0) > 0 and float(p.get("stock", 0) or 0) <= float(p.get("minimum_stock", 0) or 0)])
        branch_staff = [m for m in staff if m.get("merchant_id") == branch.get("merchant_id")]
        cards.append({
            "store_id": branch["store_id"],
            "name": branch.get("name"),
            "city": branch.get("city"),
            "revenue": round(sum(float(s.get("total", 0) or 0) for s in branch_sales), 2),
            "transactions": len(branch_sales),
            "staff_count": len(branch_staff),
            "inventory_low_stock": low_stock,
        })
    cards.sort(key=lambda row: row["revenue"], reverse=True)
    return {"branches": cards[:100], "count": len(cards)}


@router.get("/partner-portal")
async def partner_portal(request: Request):
    user = await _require_access(request)
    return {
        "partner_type": user.get("role"),
        "modules": [
            {"name": "POS Resellers", "count": await db.partner_resellers.count_documents({}), "route": "/pos"},
            {"name": "Franchise Partners", "count": await db.franchise_applications.count_documents({"status": {"$in": ["pending", "approved"]}}), "route": "/merchant-portal"},
            {"name": "EV Operators", "count": await db.ev_operators.count_documents({}), "route": "/ev/overview"},
            {"name": "Taxi Partners", "count": await db.taxi_partners.count_documents({}), "route": "/taxi"},
        ],
    }


@router.get("/compliance-center")
async def compliance_center(request: Request):
    await _require_access(request)
    kyc_pending = await db.users.count_documents({"kyc_status": {"$in": ["pending", "submitted"]}})
    kyc_verified = await db.users.count_documents({"kyc_verified": True})
    aml_flags = await db.fraud_alerts.count_documents({"rule": {"$regex": "aml", "$options": "i"}})
    audit_recent = await db.audit_logs.find({}, {"_id": 0}).sort("timestamp", -1).limit(20).to_list(20)
    risk_alerts = await db.fraud_alerts.find({}, {"_id": 0}).sort("created_at", -1).limit(20).to_list(20)
    return {"kyc": {"pending": kyc_pending, "verified": kyc_verified}, "aml": {"flags": aml_flags}, "audit_logs": audit_recent, "risk_monitoring": risk_alerts}


@router.get("/launch-certification")
async def launch_certification(request: Request):
    await _require_access(request)
    kpis = await _build_platform_kpis()
    issues = []
    if kpis["executive"]["total_users"] == 0:
        issues.append("Keine User gefunden")
    if kpis["executive"]["transactions"] == 0:
        issues.append("Keine Transaktionen gefunden")
    if kpis["revenue_center"]["wallet_revenue"] == 0:
        issues.append("Kein Wallet-Volumen erfasst")
    return {"ready": len(issues) == 0, "issues": issues, "checked_at": datetime.now(timezone.utc).isoformat()}


@router.get("/enterprise-report.csv")
async def export_enterprise_csv(request: Request):
    dashboard = await executive_dashboard(request)
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(["section", "metric", "value"])
    for section, values in dashboard.items():
        if isinstance(values, dict):
            for key, value in values.items():
                writer.writerow([section, key, value])
    return Response(content=buffer.getvalue(), media_type="text/csv", headers={"Content-Disposition": "attachment; filename=bidblitz_enterprise_report.csv"})