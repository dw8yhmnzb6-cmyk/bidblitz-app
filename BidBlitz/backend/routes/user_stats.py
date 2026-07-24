"""
BidBlitz V2 - User Statistics Dashboard
Spending analysis, income vs expenses, top categories
"""
from fastapi import APIRouter, Request, HTTPException
from datetime import datetime, timezone, timedelta
from core.security import get_current_user
from core.database import db

router = APIRouter(prefix="/api/stats", tags=["stats"])


@router.get("/overview")
async def user_stats_overview(request: Request, months: int = 6):
    user = await get_current_user(request)
    user_id = str(user["_id"])
    now = datetime.now(timezone.utc)

    # Monthly breakdown
    monthly = []
    for i in range(months):
        target = now.replace(day=1) - timedelta(days=i * 30)
        m_start = target.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        m_end = m_start.replace(month=m_start.month + 1) if m_start.month < 12 else m_start.replace(year=m_start.year + 1, month=1)

        txns = await db.transactions.find({
            "user_id": user_id,
            "created_at": {"$gte": m_start.isoformat(), "$lt": m_end.isoformat()}
        }, {"_id": 0, "type": 1, "amount": 1, "category": 1}).to_list(500)

        income = sum(t["amount"] for t in txns if t.get("type") in ("topup", "CREDIT_RECEIVED", "ADMIN_GRANT", "COUPON_REDEEM", "transfer_in", "credit", "reward"))
        expense = sum(t["amount"] for t in txns if t.get("type") in ("payment", "debit", "transfer_out", "CREDIT_PAYMENT"))

        monthly.append({
            "month": m_start.strftime("%Y-%m"),
            "label": m_start.strftime("%b %y"),
            "income": round(income, 2),
            "expense": round(expense, 2),
            "net": round(income - expense, 2),
            "tx_count": len(txns),
        })
    monthly.reverse()

    # Top categories (all time recent 200 txns)
    recent = await db.transactions.find(
        {"user_id": user_id, "type": {"$in": ["payment", "debit"]}},
        {"_id": 0, "category": 1, "amount": 1}
    ).sort("created_at", -1).limit(200).to_list(200)

    cat_totals = {}
    for t in recent:
        cat = t.get("category", "other")
        cat_totals[cat] = cat_totals.get(cat, 0) + t.get("amount", 0)
    top_categories = sorted([{"category": k, "total": round(v, 2)} for k, v in cat_totals.items()], key=lambda x: x["total"], reverse=True)[:8]

    # Cashback earned
    cashback = await db.transactions.find(
        {"user_id": user_id, "type": "reward"},
        {"_id": 0, "amount": 1}
    ).to_list(200)
    total_cashback = sum(c.get("amount", 0) for c in cashback)

    return {
        "monthly": monthly,
        "top_categories": top_categories,
        "total_cashback": round(total_cashback, 2),
        "balance": user.get("balance", 0),
        "coins": user.get("coins", 0),
    }
