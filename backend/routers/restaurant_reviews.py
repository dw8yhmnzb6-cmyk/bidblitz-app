"""
Restaurant Reviews System
- Customers can rate restaurants after redeeming vouchers
- Reviews are displayed on restaurant pages
- Restaurants get average ratings
"""
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone
from typing import Optional, List
from pydantic import BaseModel
import uuid

from config import db, logger
from dependencies import get_current_user

router = APIRouter(prefix="/restaurant-reviews", tags=["Restaurant Reviews"])

# ==================== SCHEMAS ====================

class ReviewCreate(BaseModel):
    restaurant_id: str
    voucher_code: str
    rating: int  # 1-5 stars
    title: Optional[str] = None
    comment: Optional[str] = None
    food_rating: Optional[int] = None  # 1-5
    service_rating: Optional[int] = None  # 1-5
    ambiance_rating: Optional[int] = None  # 1-5
    would_recommend: bool = True
    photos: Optional[List[str]] = []  # URLs to uploaded photos

class ReviewResponse(BaseModel):
    helpful: bool

# ==================== REVIEW ENDPOINTS ====================

@router.post("/submit")
async def submit_review(review: ReviewCreate, user = Depends(get_current_user)):
    """Submit a review for a restaurant after voucher redemption"""
    
    # Verify voucher was redeemed by this user
    voucher = await db.vouchers.find_one({
        "code": review.voucher_code.upper(),
        "used_by": user["id"]
    })
    
    if not voucher:
        # Also check redemption records
        redemption = await db.voucher_redemptions.find_one({
            "voucher_code": review.voucher_code.upper()
        })
        if not redemption:
            raise HTTPException(status_code=400, detail="Gutschein nicht gefunden oder nicht von Ihnen eingelöst")
    
    # Check if already reviewed
    existing = await db.restaurant_reviews.find_one({
        "user_id": user["id"],
        "voucher_code": review.voucher_code.upper()
    })
    
    if existing:
        raise HTTPException(status_code=400, detail="Sie haben diesen Gutschein bereits bewertet")
    
    # Validate rating
    if not 1 <= review.rating <= 5:
        raise HTTPException(status_code=400, detail="Bewertung muss zwischen 1 und 5 sein")
    
    review_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    # Get restaurant info
    restaurant = await db.restaurant_accounts.find_one(
        {"id": review.restaurant_id},
        {"restaurant_name": 1}
    )
    restaurant_name = restaurant.get("restaurant_name", "Unknown") if restaurant else "Unknown"
    
    # Create review document
    review_doc = {
        "id": review_id,
        "restaurant_id": review.restaurant_id,
        "restaurant_name": restaurant_name,
        "user_id": user["id"],
        "username": user.get("username", "Anonym"),
        "user_avatar": user.get("avatar_url"),
        "voucher_code": review.voucher_code.upper(),
        "rating": review.rating,
        "title": review.title,
        "comment": review.comment,
        "food_rating": review.food_rating,
        "service_rating": review.service_rating,
        "ambiance_rating": review.ambiance_rating,
        "would_recommend": review.would_recommend,
        "photos": review.photos or [],
        "helpful_count": 0,
        "created_at": now,
        "is_verified": True,  # Verified purchase
        "status": "published"
    }
    
    await db.restaurant_reviews.insert_one(review_doc)
    
    # Update restaurant average rating
    await update_restaurant_rating(review.restaurant_id)
    
    # Award bonus bids for review
    bonus_bids = 2
    if review.photos and len(review.photos) > 0:
        bonus_bids = 5  # Extra for photos
    
    await db.users.update_one(
        {"id": user["id"]},
        {
            "$inc": {"bids_balance": bonus_bids},
            "$push": {
                "bid_history": {
                    "type": "review_bonus",
                    "amount": bonus_bids,
                    "description": f"Bonus für Restaurant-Bewertung",
                    "date": now
                }
            }
        }
    )
    
    logger.info(f"Review {review_id} submitted by {user['id']} for restaurant {review.restaurant_id}")
    
    return {
        "success": True,
        "message": f"Danke für Ihre Bewertung! Sie haben {bonus_bids} Bonus-Gebote erhalten.",
        "review_id": review_id,
        "bonus_bids": bonus_bids
    }

async def update_restaurant_rating(restaurant_id: str):
    """Recalculate restaurant's average rating"""
    pipeline = [
        {"$match": {"restaurant_id": restaurant_id, "status": "published"}},
        {"$group": {
            "_id": "$restaurant_id",
            "avg_rating": {"$avg": "$rating"},
            "avg_food": {"$avg": "$food_rating"},
            "avg_service": {"$avg": "$service_rating"},
            "avg_ambiance": {"$avg": "$ambiance_rating"},
            "total_reviews": {"$sum": 1},
            "recommend_percent": {"$avg": {"$cond": ["$would_recommend", 100, 0]}}
        }}
    ]
    
    result = await db.restaurant_reviews.aggregate(pipeline).to_list(1)
    
    if result:
        stats = result[0]
        await db.restaurant_accounts.update_one(
            {"id": restaurant_id},
            {"$set": {
                "avg_rating": round(stats["avg_rating"], 1),
                "avg_food_rating": round(stats["avg_food"] or 0, 1),
                "avg_service_rating": round(stats["avg_service"] or 0, 1),
                "avg_ambiance_rating": round(stats["avg_ambiance"] or 0, 1),
                "total_reviews": stats["total_reviews"],
                "recommend_percent": round(stats["recommend_percent"] or 0)
            }}
        )

@router.get("/restaurant/{restaurant_id}")
async def get_restaurant_reviews(restaurant_id: str, limit: int = 20, skip: int = 0):
    """Get all reviews for a restaurant"""
    
    reviews = await db.restaurant_reviews.find(
        {"restaurant_id": restaurant_id, "status": "published"},
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    # Get restaurant stats
    restaurant = await db.restaurant_accounts.find_one(
        {"id": restaurant_id},
        {"_id": 0, "password_hash": 0, "auth_token": 0, "iban": 0}
    )
    
    stats = {
        "avg_rating": restaurant.get("avg_rating", 0) if restaurant else 0,
        "total_reviews": restaurant.get("total_reviews", 0) if restaurant else 0,
        "recommend_percent": restaurant.get("recommend_percent", 0) if restaurant else 0
    }
    
    return {
        "restaurant_id": restaurant_id,
        "stats": stats,
        "reviews": reviews
    }

@router.get("/pending")
async def get_pending_review(user = Depends(get_current_user)):
    """Check if user has unredeemed vouchers that need reviews"""
    
    # Find redeemed vouchers without reviews
    redeemed = await db.vouchers.find(
        {
            "used_by": user["id"],
            "type": "restaurant"
        },
        {"_id": 0, "code": 1, "merchant_name": 1, "merchant_id": 1, "redeemed_at": 1}
    ).to_list(50)
    
    pending = []
    for voucher in redeemed:
        # Check if already reviewed
        reviewed = await db.restaurant_reviews.find_one({
            "user_id": user["id"],
            "voucher_code": voucher["code"]
        })
        
        if not reviewed:
            pending.append({
                "voucher_code": voucher["code"],
                "restaurant_name": voucher.get("merchant_name"),
                "restaurant_id": voucher.get("merchant_id"),
                "redeemed_at": voucher.get("redeemed_at")
            })
    
    return {"pending_reviews": pending}

@router.post("/{review_id}/helpful")
async def mark_review_helpful(review_id: str, response: ReviewResponse, user = Depends(get_current_user)):
    """Mark a review as helpful or not"""
    
    # Check if user already voted
    existing_vote = await db.review_votes.find_one({
        "review_id": review_id,
        "user_id": user["id"]
    })
    
    if existing_vote:
        raise HTTPException(status_code=400, detail="Sie haben bereits abgestimmt")
    
    # Record vote
    await db.review_votes.insert_one({
        "review_id": review_id,
        "user_id": user["id"],
        "helpful": response.helpful,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    # Update helpful count
    if response.helpful:
        await db.restaurant_reviews.update_one(
            {"id": review_id},
            {"$inc": {"helpful_count": 1}}
        )
    
    return {"success": True}

@router.get("/top-rated")
async def get_top_rated_restaurants(limit: int = 10):
    """Get top rated restaurants"""
    
    restaurants = await db.restaurant_accounts.find(
        {"is_verified": True, "is_active": True, "total_reviews": {"$gte": 1}},
        {"_id": 0, "password_hash": 0, "auth_token": 0, "iban": 0}
    ).sort("avg_rating", -1).limit(limit).to_list(limit)
    
    return restaurants

# ==================== REVIEW PROMPT SYSTEM ====================

@router.get("/should-prompt/{voucher_code}")
async def should_prompt_review(voucher_code: str, user = Depends(get_current_user)):
    """Check if we should prompt user to review after redemption"""
    
    # Check if voucher was redeemed
    voucher = await db.vouchers.find_one({
        "code": voucher_code.upper(),
        "used_by": user["id"]
    })
    
    if not voucher:
        return {"should_prompt": False}
    
    # Check if already reviewed
    reviewed = await db.restaurant_reviews.find_one({
        "user_id": user["id"],
        "voucher_code": voucher_code.upper()
    })
    
    if reviewed:
        return {"should_prompt": False}
    
    return {
        "should_prompt": True,
        "restaurant_id": voucher.get("merchant_id"),
        "restaurant_name": voucher.get("merchant_name"),
        "voucher_code": voucher["code"]
    }

restaurant_reviews_router = router
