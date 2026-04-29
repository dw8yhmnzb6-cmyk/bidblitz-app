# BidBlitz - Reviews & Ratings System
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
from uuid import uuid4
from core.database import db
from routes.auth import get_current_user

router = APIRouter(prefix="/api/reviews", tags=["Reviews"])

class ReviewRequest(BaseModel):
    service_type: str  # taxi, scooter, food, marketplace
    service_id: str  # ride_id, rental_id, order_id, product_id
    rating: int  # 1-5
    comment: Optional[str] = None
    photos: Optional[List[str]] = None

@router.post("/create")
async def create_review(req: ReviewRequest, user=Depends(get_current_user)):
    """Create a review"""
    if req.rating < 1 or req.rating > 5:
        raise HTTPException(400, "Rating must be between 1 and 5")
    
    # Check if user already reviewed
    existing = await db.reviews.find_one({
        "user_id": user["user_id"],
        "service_type": req.service_type,
        "service_id": req.service_id,
    })
    
    if existing:
        raise HTTPException(400, "You already reviewed this")
    
    review_id = str(uuid4())
    review = {
        "review_id": review_id,
        "user_id": user["user_id"],
        "user_name": f"{user.get('first_name', '')} {user.get('last_name', '')[0]}.",
        "service_type": req.service_type,
        "service_id": req.service_id,
        "rating": req.rating,
        "comment": req.comment,
        "photos": req.photos or [],
        "helpful_count": 0,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    
    await db.reviews.insert_one(review)
    
    # Update average rating
    await update_average_rating(req.service_type, req.service_id)
    
    # Award loyalty points (best-effort)
    try:
        from datetime import datetime as _dt, timezone as _tz
        existing_loyalty = await db.loyalty.find_one({"user_id": user["user_id"]})
        if existing_loyalty:
            await db.loyalty.update_one(
                {"user_id": user["user_id"]},
                {"$inc": {"points": 10},
                 "$push": {"history": {"points": 10, "reason": f"Review for {req.service_type}", "timestamp": _dt.now(_tz.utc).isoformat()}}}
            )
        else:
            await db.loyalty.insert_one({
                "user_id": user["user_id"],
                "points": 10,
                "level": 0,
                "stamps": {"taxi": 0, "scooter": 0, "food": 0},
                "history": [{"points": 10, "reason": f"Review for {req.service_type}", "timestamp": _dt.now(_tz.utc).isoformat()}],
                "created_at": _dt.now(_tz.utc).isoformat(),
            })
    except Exception as e:
        import logging
        logging.getLogger("bidblitz.reviews").exception("loyalty award failed: %s", e)
    
    return {"success": True, "review_id": review_id}

@router.get("/{service_type}/{service_id}")
async def get_reviews(service_type: str, service_id: str, limit: int = 20):
    """Get reviews for a service"""
    reviews = await db.reviews.find({
        "service_type": service_type,
        "service_id": service_id,
    }, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    
    avg_rating = 0
    if reviews:
        avg_rating = sum(r["rating"] for r in reviews) / len(reviews)
    
    return {
        "reviews": reviews,
        "average_rating": round(avg_rating, 1),
        "total_reviews": len(reviews),
    }

@router.post("/{review_id}/helpful")
async def mark_helpful(review_id: str, user=Depends(get_current_user)):
    """Mark review as helpful"""
    await db.reviews.update_one(
        {"review_id": review_id},
        {"$inc": {"helpful_count": 1}}
    )
    return {"success": True}

async def update_average_rating(service_type: str, service_id: str):
    """Update average rating for a service"""
    reviews = await db.reviews.find({
        "service_type": service_type,
        "service_id": service_id,
    }, {"_id": 0, "rating": 1}).to_list(1000)
    
    if not reviews:
        return
    
    avg_rating = sum(r["rating"] for r in reviews) / len(reviews)
    
    # Update in respective collection
    collection_map = {
        "taxi": "taxi_drivers",
        "food": "food_restaurants",
        "marketplace": "marketplace_products",
    }
    
    if service_type in collection_map:
        collection = getattr(db, collection_map[service_type])
        await collection.update_one(
            {f"{service_type[0]}_id": service_id},  # driver_id, restaurant_id, product_id
            {"$set": {
                "rating": round(avg_rating, 1),
                "review_count": len(reviews),
            }}
        )
