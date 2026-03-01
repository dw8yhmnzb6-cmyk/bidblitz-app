"""
Business Dashboard - KPIs, Charts, Module Breakdown, Top Employees
Angepasst an BidBlitz DB: wallet_balance_cents in business_accounts
"""
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, HTTPException, Depends, Query

from dependencies import get_current_user
from config import db

router = APIRouter(prefix="/business/dashboard", tags=["Business Dashboard"])

UTC = timezone.utc
def utcnow(): return datetime.now(UTC)

def month_range(dt):
    start = datetime(dt.year, dt.month, 1, tzinfo=UTC)
    end = datetime(dt.year + 1, 1, 1, tzinfo=UTC) if dt.month == 12 else datetime(dt.year, dt.month + 1, 1, tzinfo=UTC)
    return start, end


async def require_business_member(business_id, user_id):
    m = await db.business_members.find_one({"business_id": business_id, "user_id": user_id, "status": "active"})
    if not m:
        raise HTTPException(403, "NOT_BUSINESS_MEMBER")
    return m


@router.get("")
async def get_dashboard(business_id: str = Query(...), user: dict = Depends(get_current_user)):
    member = await require_business_member(business_id, user["id"])
    is_admin = member.get("role") == "business_admin"

    business = await db.business_accounts.find_one({"business_id": business_id})
    if not business:
        raise HTTPException(404, "BUSINESS_NOT_FOUND")

    # BidBlitz uses wallet_balance_cents directly on business_accounts
    wallet_cents = int(business.get("wallet_balance_cents", 0))

    now = utcnow()
    m_start, m_end = month_range(now)
    last7 = now - timedelta(days=7)
    last30 = now - timedelta(days=30)

    # Month sum + count
    month_agg = await db.business_ledger.aggregate([
        {"$match": {"business_id": business_id, "created_at": {"$gte": m_start.isoformat(), "$lt": m_end.isoformat()}}},
        {"$group": {"_id": None, "sum": {"$sum": "$amount_cents"}, "count": {"$sum": 1}}}
    ]).to_list(1)
    month_sum = month_agg[0]["sum"] if month_agg else 0
    month_count = month_agg[0]["count"] if month_agg else 0

    # Last 7 days
    last7_agg = await db.business_ledger.aggregate([
        {"$match": {"business_id": business_id, "created_at": {"$gte": last7.isoformat()}}},
        {"$group": {"_id": None, "sum": {"$sum": "$amount_cents"}}}
    ]).to_list(1)
    last7_sum = last7_agg[0]["sum"] if last7_agg else 0

    # Module breakdown (taxi, scooter, food, services)
    module_agg = await db.business_ledger.aggregate([
        {"$match": {"business_id": business_id, "created_at": {"$gte": m_start.isoformat(), "$lt": m_end.isoformat()}}},
        {"$group": {"_id": {"$ifNull": ["$source_module", "other"]}, "amount": {"$sum": "$amount_cents"}, "count": {"$sum": 1}}},
        {"$sort": {"amount": -1}}
    ]).to_list(20)

    breakdown = []
    module_map = {}
    for r in module_agg:
        mod = r["_id"] or "other"
        module_map[mod] = int(r["amount"])
        breakdown.append({"module": mod, "amount_cents": int(r["amount"]), "count": int(r["count"])})

    # Daily spend last 30 days
    daily_agg = await db.business_ledger.aggregate([
        {"$match": {"business_id": business_id, "created_at": {"$gte": last30.isoformat()}}},
        {"$group": {"_id": {"$substr": ["$created_at", 0, 10]}, "amount": {"$sum": "$amount_cents"}}},
        {"$sort": {"_id": 1}}
    ]).to_list(100)
    daily_map = {r["_id"]: int(r["amount"]) for r in daily_agg}

    daily_list = []
    for i in range(30):
        day = (now - timedelta(days=29 - i)).date().isoformat()
        daily_list.append({"date": day, "amount_cents": daily_map.get(day, 0)})

    # Top employees (admin only)
    top_employees = []
    if is_admin:
        top_agg = await db.business_ledger.aggregate([
            {"$match": {"business_id": business_id, "created_at": {"$gte": m_start.isoformat()}}},
            {"$group": {"_id": "$user_id", "amount": {"$sum": "$amount_cents"}, "count": {"$sum": 1}}},
            {"$sort": {"amount": -1}}, {"$limit": 10}
        ]).to_list(10)
        for r in top_agg:
            u = await db.users.find_one({"id": r["_id"]}, {"_id": 0, "name": 1, "email": 1})
            top_employees.append({
                "user_id": r["_id"],
                "name": u.get("name") if u else None,
                "amount_cents": int(r["amount"]),
                "count": int(r["count"])
            })

    # Latest invoice
    inv = await db.business_invoices.find({"business_id": business_id}).sort("issued_at", -1).to_list(1)
    latest_inv = None
    if inv:
        d = inv[0]
        latest_inv = {"invoice_id": d.get("invoice_id"), "status": d.get("status"), "total_cents": int(d.get("total_cents", 0))}

    overdue = bool(await db.business_invoices.find_one({"business_id": business_id, "status": "overdue"}))

    return {
        "business": {
            "business_id": business_id,
            "name": business.get("name"),
            "wallet_balance_cents": wallet_cents,
        },
        "alerts": {"invoice_overdue": overdue, "latest_invoice": latest_inv},
        "kpis": {
            "month_spend_cents": month_sum,
            "last_7d_spend_cents": last7_sum,
            "month_txn_count": month_count,
            "avg_spend_per_txn_cents": int(month_sum / month_count) if month_count > 0 else 0,
            "month_taxi_spend_cents": module_map.get("taxi", 0),
            "month_scooter_spend_cents": module_map.get("scooter", 0),
            "month_food_spend_cents": module_map.get("food", 0),
            "month_services_spend_cents": module_map.get("services", 0),
        },
        "charts": {"daily_spend_last_30d": daily_list, "module_breakdown_month": breakdown},
        "top_employees": top_employees,
        "permissions": {"is_admin": is_admin},
    }
