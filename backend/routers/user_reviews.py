"""User Reviews Router - Product and platform reviews"""
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone, timedelta
from typing import Optional, List
from pydantic import BaseModel
import uuid

from config import db, logger
from dependencies import get_current_user, get_admin_user

router = APIRouter(prefix="/user-reviews", tags=["User Reviews"])

# ==================== SCHEMAS ====================

class ReviewCreate(BaseModel):
    auction_id: str
    rating: int  # 1-5
    title: Optional[str] = None
    comment: Optional[str] = None
    would_recommend: bool = True

class ReviewResponse(BaseModel):
    response: str

# ==================== USER ENDPOINTS ====================

@router.get("/can-review")
async def get_reviewable_wins(user: dict = Depends(get_current_user)):
    """Get wins that user can review"""
    user_id = user["id"]
    
    # Get won auctions
    won = await db.auctions.find(
        {"winner_id": user_id, "status": "ended"},
        {"_id": 0, "id": 1, "product_id": 1, "ended_at": 1}
    ).to_list(50)
    
    reviewable = []
    for auction in won:
        # Check if already reviewed
        existing = await db.user_reviews.find_one({
            "auction_id": auction["id"],
            "user_id": user_id
        })
        
        if not existing:
            product = await db.products.find_one(
                {"id": auction.get("product_id")},
                {"_id": 0, "name": 1, "image_url": 1}
            )
            reviewable.append({
                "auction_id": auction["id"],
                "product_name": product.get("name") if product else "Produkt",
                "product_image": product.get("image_url") if product else None,
                "won_at": auction.get("ended_at")
            })
    
    return {"reviewable": reviewable, "count": len(reviewable)}

@router.post("/submit")
async def submit_review(review: ReviewCreate, user: dict = Depends(get_current_user)):
    """Submit a review for a won auction"""
    user_id = user["id"]
    
    # Verify user won this auction
    auction = await db.auctions.find_one({
        "id": review.auction_id,
        "winner_id": user_id,
        "status": "ended"
    })
    
    if not auction:
        raise HTTPException(status_code=403, detail="Du hast diese Auktion nicht gewonnen")
    
    # Check if already reviewed
    existing = await db.user_reviews.find_one({
        "auction_id": review.auction_id,
        "user_id": user_id
    })
    
    if existing:
        raise HTTPException(status_code=400, detail="Du hast bereits eine Bewertung abgegeben")
    
    # Validate rating
    if review.rating < 1 or review.rating > 5:
        raise HTTPException(status_code=400, detail="Bewertung muss zwischen 1 und 5 sein")
    
    # Get product info
    product = await db.products.find_one({"id": auction.get("product_id")}, {"_id": 0})
    
    # Create review
    review_id = str(uuid.uuid4())
    review_doc = {
        "id": review_id,
        "user_id": user_id,
        "user_name": user.get("name", user.get("username", "Nutzer")),
        "auction_id": review.auction_id,
        "product_id": auction.get("product_id"),
        "product_name": product.get("name") if product else "Produkt",
        "rating": review.rating,
        "title": review.title,
        "comment": review.comment,
        "would_recommend": review.would_recommend,
        "status": "pending",  # pending, approved, rejected
        "helpful_votes": 0,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.user_reviews.insert_one(review_doc)
    
    # Award bonus bids for review
    REVIEW_BONUS = 3
    await db.users.update_one(
        {"id": user_id},
        {"$inc": {"bids_balance": REVIEW_BONUS}}
    )
    
    logger.info(f"Review submitted by {user_id} for auction {review.auction_id}")
    
    return {
        "success": True,
        "message": f"Danke für deine Bewertung! Du hast {REVIEW_BONUS} Bonus-Gebote erhalten!",
        "review_id": review_id,
        "bonus_bids": REVIEW_BONUS
    }

@router.get("/my-reviews")
async def get_my_reviews(user: dict = Depends(get_current_user)):
    """Get user's submitted reviews"""
    reviews = await db.user_reviews.find(
        {"user_id": user["id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    
    return {"reviews": reviews}

# ==================== PUBLIC ENDPOINTS ====================

@router.get("/product/{product_id}")
async def get_product_reviews(product_id: str, limit: int = 20):
    """Get reviews for a specific product"""
    reviews = await db.user_reviews.find(
        {"product_id": product_id, "status": "approved"},
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    # Calculate average rating
    pipeline = [
        {"$match": {"product_id": product_id, "status": "approved"}},
        {"$group": {
            "_id": None,
            "avg_rating": {"$avg": "$rating"},
            "total": {"$sum": 1},
            "recommend_rate": {"$avg": {"$cond": ["$would_recommend", 1, 0]}}
        }}
    ]
    stats = await db.user_reviews.aggregate(pipeline).to_list(1)
    
    return {
        "reviews": reviews,
        "stats": {
            "average_rating": round(stats[0]["avg_rating"], 1) if stats else 0,
            "total_reviews": stats[0]["total"] if stats else 0,
            "recommend_rate": round(stats[0]["recommend_rate"] * 100) if stats else 0
        }
    }

@router.get("/featured")
async def get_featured_reviews(limit: int = 5):
    """Get featured reviews for homepage"""
    reviews = await db.user_reviews.find(
        {"status": "approved", "rating": {"$gte": 4}},
        {"_id": 0}
    ).sort("helpful_votes", -1).limit(limit).to_list(limit)
    
    return {"featured": reviews}

@router.get("/platform-rating")
async def get_platform_rating():
    """Get overall platform rating"""
    pipeline = [
        {"$match": {"status": "approved"}},
        {"$group": {
            "_id": None,
            "avg_rating": {"$avg": "$rating"},
            "total": {"$sum": 1},
            "five_star": {"$sum": {"$cond": [{"$eq": ["$rating", 5]}, 1, 0]}},
            "four_star": {"$sum": {"$cond": [{"$eq": ["$rating", 4]}, 1, 0]}},
            "three_star": {"$sum": {"$cond": [{"$eq": ["$rating", 3]}, 1, 0]}},
            "two_star": {"$sum": {"$cond": [{"$eq": ["$rating", 2]}, 1, 0]}},
            "one_star": {"$sum": {"$cond": [{"$eq": ["$rating", 1]}, 1, 0]}}
        }}
    ]
    stats = await db.user_reviews.aggregate(pipeline).to_list(1)
    
    if not stats:
        return {
            "average_rating": 4.8,
            "total_reviews": 0,
            "distribution": {"5": 0, "4": 0, "3": 0, "2": 0, "1": 0}
        }
    
    s = stats[0]
    return {
        "average_rating": round(s["avg_rating"], 1),
        "total_reviews": s["total"],
        "distribution": {
            "5": s["five_star"],
            "4": s["four_star"],
            "3": s["three_star"],
            "2": s["two_star"],
            "1": s["one_star"]
        }
    }

@router.post("/{review_id}/helpful")
async def mark_helpful(review_id: str, user: dict = Depends(get_current_user)):
    """Mark a review as helpful"""
    # Check if already voted
    existing = await db.review_votes.find_one({
        "review_id": review_id,
        "user_id": user["id"]
    })
    
    if existing:
        return {"already_voted": True}
    
    await db.review_votes.insert_one({
        "review_id": review_id,
        "user_id": user["id"],
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    await db.user_reviews.update_one(
        {"id": review_id},
        {"$inc": {"helpful_votes": 1}}
    )
    
    return {"success": True}

# ==================== ADMIN ENDPOINTS ====================

@router.get("/admin/pending")
async def get_pending_reviews(admin: dict = Depends(get_admin_user)):
    """Get reviews pending approval"""
    pending = await db.user_reviews.find(
        {"status": "pending"},
        {"_id": 0}
    ).sort("created_at", 1).to_list(100)
    
    return {"pending": pending, "count": len(pending)}

@router.put("/admin/{review_id}/approve")
async def approve_review(review_id: str, admin: dict = Depends(get_admin_user)):
    """Approve a review"""
    result = await db.user_reviews.update_one(
        {"id": review_id},
        {"$set": {
            "status": "approved",
            "approved_by": admin["id"],
            "approved_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Bewertung nicht gefunden")
    
    return {"success": True}

@router.put("/admin/{review_id}/reject")
async def reject_review(review_id: str, reason: str = None, admin: dict = Depends(get_admin_user)):
    """Reject a review"""
    result = await db.user_reviews.update_one(
        {"id": review_id},
        {"$set": {
            "status": "rejected",
            "rejection_reason": reason,
            "rejected_by": admin["id"],
            "rejected_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Bewertung nicht gefunden")
    
    return {"success": True}

@router.post("/admin/{review_id}/respond")
async def respond_to_review(review_id: str, response: ReviewResponse, admin: dict = Depends(get_admin_user)):
    """Add admin response to a review"""
    result = await db.user_reviews.update_one(
        {"id": review_id},
        {"$set": {
            "admin_response": response.response,
            "responded_by": admin["id"],
            "responded_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Bewertung nicht gefunden")
    
    return {"success": True}


user_reviews_router = router
