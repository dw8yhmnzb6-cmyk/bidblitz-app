"""
BidBlitz V2 - Rating & Review System
Rate users after BlitzJobs, Reselling, Taxi rides
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from datetime import datetime, timezone
from core.database import db
from core.security import get_current_user
import secrets

router = APIRouter(prefix="/api/ratings", tags=["ratings"])


class RateUser(BaseModel):
    rated_email: str
    rating: int = Field(..., ge=1, le=5)
    comment: str = ""
    context_type: str = ""
    context_id: str = ""


@router.post("/rate")
async def rate_user(req: RateUser, request: Request):
    user = await get_current_user(request)
    email = user.get("email", "")
    if email == req.rated_email:
        raise HTTPException(400, "Selbstbewertung nicht möglich")
    
    rating = {
        "rating_id": secrets.token_hex(6),
        "rater_email": email,
        "rater_name": user.get("name", email),
        "rated_email": req.rated_email,
        "rating": req.rating,
        "comment": req.comment,
        "context_type": req.context_type,
        "context_id": req.context_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.user_ratings.insert_one(rating)
    
    pipeline = [
        {"$match": {"rated_email": req.rated_email}},
        {"$group": {"_id": None, "avg": {"$avg": "$rating"}, "count": {"$sum": 1}}}
    ]
    result = await db.user_ratings.aggregate(pipeline).to_list(1)
    if result:
        await db.users.update_one(
            {"email": req.rated_email},
            {"$set": {"avg_rating": round(result[0]["avg"], 1), "rating_count": result[0]["count"]}}
        )
    return {"ok": True, "message": f"Bewertung: {req.rating}/5 abgegeben!"}


@router.get("/user/{user_email}")
async def get_ratings(user_email: str):
    ratings = await db.user_ratings.find({"rated_email": user_email}, {"_id": 0}).sort("created_at", -1).to_list(20)
    pipeline = [{"$match": {"rated_email": user_email}}, {"$group": {"_id": None, "avg": {"$avg": "$rating"}, "count": {"$sum": 1}}}]
    result = await db.user_ratings.aggregate(pipeline).to_list(1)
    return {"ratings": ratings, "average": round(result[0]["avg"], 1) if result else 0, "count": result[0]["count"] if result else 0}
