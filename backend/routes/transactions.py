from fastapi import APIRouter, Request, Query
from core.database import db
from core.security import get_current_user
from core.performance import query_cache

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

    # Optimized query using compound index (user_id, type, created_at)
    transactions = await db.transactions.find(
        query, {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)

    # Cache count for 30 seconds to reduce DB load
    count_cache_key = f"txn_count:{user_id}:{type or 'all'}:{status or 'all'}"
    total = query_cache.get(count_cache_key)
    if total is None:
        total = await db.transactions.count_documents(query)
        query_cache.set(count_cache_key, total, 30)

    return {
        "transactions": transactions,
        "total": total,
        "limit": limit,
        "skip": skip,
    }


@router.get("/recent")
async def get_recent_transactions(request: Request, limit: int = Query(10, ge=1, le=50)):
    """Get user's recent transactions - optimized for dashboard."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    # Use projection to reduce data transfer
    transactions = await db.transactions.find(
        {"user_id": user_id},
        {"_id": 0, "id": 1, "type": 1, "amount": 1, "description": 1, "created_at": 1, "status": 1}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    return {"transactions": transactions}
