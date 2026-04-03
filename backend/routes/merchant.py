from fastapi import APIRouter, Request
from datetime import datetime, timezone
from core.database import db
from core.security import get_current_user

router = APIRouter(prefix="/api/merchant", tags=["merchant"])


@router.get("/dashboard")
async def get_dashboard(request: Request):
    user = await get_current_user(request)
    user_id = str(user["_id"])

    merchant = await db.merchants.find_one({"user_id": user_id}, {"_id": 0})
    if not merchant:
        return {
            "merchant_id": "",
            "business_name": f"{user.get('name', 'User')}'s Store",
            "total_earnings": 0.0,
            "total_transactions": 0,
            "today_earnings": 0.0,
            "today_transactions": 0,
            "recent_payments": [],
        }

    # Get today's stats
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()

    # Recent payments to this merchant's user
    recent = await db.transactions.find(
        {"user_id": user_id, "type": {"$in": ["payment"]}},
        {"_id": 0}
    ).sort("created_at", -1).limit(10).to_list(10)

    # Today's earnings from transactions
    today_txns = await db.transactions.find(
        {"user_id": user_id, "type": "payment", "created_at": {"$gte": today_start}},
        {"_id": 0}
    ).to_list(100)

    today_earnings = sum(abs(t.get("amount", 0)) for t in today_txns)

    return {
        "merchant_id": merchant.get("user_id", ""),
        "business_name": merchant.get("business_name", ""),
        "total_earnings": merchant.get("total_earnings", 0.0),
        "total_transactions": merchant.get("total_transactions", 0),
        "today_earnings": today_earnings,
        "today_transactions": len(today_txns),
        "recent_payments": recent,
    }
