from fastapi import APIRouter, Request, Query
from core.database import db
from core.security import get_current_user

router = APIRouter(prefix="/api/transactions", tags=["transactions"])


@router.get("")
async def get_transactions(
    request: Request,
    type: str = Query(None, description="Filter by type: payment, topup, send, receive"),
    status: str = Query(None, description="Filter by status: completed, pending, failed"),
    limit: int = Query(50, ge=1, le=200),
    skip: int = Query(0, ge=0),
):
    user = await get_current_user(request)
    user_id = str(user["_id"])

    query = {"user_id": user_id}
    if type:
        query["type"] = type
    if status:
        query["status"] = status

    transactions = await db.transactions.find(
        query, {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)

    total = await db.transactions.count_documents(query)

    return {
        "transactions": transactions,
        "total": total,
        "limit": limit,
        "skip": skip,
    }
