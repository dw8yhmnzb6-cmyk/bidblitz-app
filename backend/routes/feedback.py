"""
BidBlitz V2 - Feedback Routes
Collect and manage user/merchant feedback during soft launch.
"""

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from datetime import datetime, timezone
from core.database import db
from core.security import get_current_user
from typing import Optional

router = APIRouter(prefix="/api/feedback", tags=["feedback"])


class FeedbackRequest(BaseModel):
    category: str = Field(..., description="payments, onboarding, ui, performance, merchant, general")
    rating: int = Field(..., ge=1, le=5)
    message: str = Field(..., min_length=3)
    page: Optional[str] = None


@router.post("")
async def submit_feedback(req: FeedbackRequest, request: Request):
    user = await get_current_user(request)
    doc = {
        "user_id": str(user["_id"]),
        "email": user["email"],
        "name": user.get("name", ""),
        "role": user.get("role", "user"),
        "category": req.category,
        "rating": req.rating,
        "message": req.message,
        "page": req.page or "",
        "status": "new",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.feedback.insert_one(doc)
    return {"success": True}


@router.get("")
async def list_feedback(request: Request, category: str = "", status: str = "", limit: int = 100):
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    query = {}
    if category:
        query["category"] = category
    if status:
        query["status"] = status
    items = await db.feedback.find(query, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    total = await db.feedback.count_documents(query)

    # Summary stats
    all_fb = await db.feedback.find({}, {"rating": 1, "category": 1, "_id": 0}).to_list(500)
    avg_rating = round(sum(f["rating"] for f in all_fb) / len(all_fb), 1) if all_fb else 0
    by_cat = {}
    for f in all_fb:
        c = f["category"]
        by_cat.setdefault(c, []).append(f["rating"])
    cat_summary = {c: {"count": len(r), "avg": round(sum(r)/len(r), 1)} for c, r in by_cat.items()}

    return {
        "feedback": items,
        "total": total,
        "avg_rating": avg_rating,
        "by_category": cat_summary,
    }
