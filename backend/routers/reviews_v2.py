"""
Winner Reviews Router - Verifizierte Gewinner-Bewertungen
"""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
import uuid

from config import db
from dependencies import get_current_user, get_admin_user as get_current_admin

router = APIRouter(prefix="/reviews", tags=["reviews"])


class ReviewCreate(BaseModel):
    auction_id: str
    rating: int  # 1-5
    title: str
    content: str
    would_recommend: bool = True
    delivery_rating: int = 5  # 1-5
    product_quality_rating: int = 5  # 1-5


@router.post("/create")
async def create_review(review: ReviewCreate, user: dict = Depends(get_current_user)):
    """Create a review for a won auction"""
    # Verify user won this auction
    auction = await db.auctions.find_one({
        "id": review.auction_id,
        "winner_id": user["id"],
        "status": "completed"
    }, {"_id": 0})
    
    if not auction:
        raise HTTPException(
            status_code=403, 
            detail="Du kannst nur Auktionen bewerten, die du gewonnen hast"
        )
    
    # Check if already reviewed
    existing = await db.reviews.find_one({
        "auction_id": review.auction_id,
        "user_id": user["id"]
    })
    
    if existing:
        raise HTTPException(status_code=400, detail="Du hast diese Auktion bereits bewertet")
    
    # Get product info
    product = await db.products.find_one(
        {"id": auction.get("product_id")},
        {"_id": 0, "name": 1, "image_url": 1}
    )
    
    now = datetime.now(timezone.utc)
    
    review_doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "user_name": user.get("name", "Anonym"),
        "auction_id": review.auction_id,
        "product_id": auction.get("product_id"),
        "product_name": product.get("name") if product else "Produkt",
        "product_image": product.get("image_url") if product else None,
        "rating": min(max(review.rating, 1), 5),
        "title": review.title[:100],
        "content": review.content[:1000],
        "would_recommend": review.would_recommend,
        "delivery_rating": min(max(review.delivery_rating, 1), 5),
        "product_quality_rating": min(max(review.product_quality_rating, 1), 5),
        "final_price": auction.get("current_price", 0),
        "retail_price": product.get("retail_price", 0) if product else 0,
        "is_verified": True,  # Auto-verified since we checked they won
        "is_approved": False,  # Needs admin approval
        "photos": [],
        "video_url": None,
        "helpful_count": 0,
        "created_at": now.isoformat()
    }
    
    await db.reviews.insert_one(review_doc)
    
    # Award bonus bids for review
    await db.users.update_one(
        {"id": user["id"]},
        {"$inc": {"bids_balance": 2}}
    )
    
    return {
        "success": True,
        "message": "Bewertung erstellt! +2 Gebote als Dankeschön",
        "review_id": review_doc["id"]
    }


@router.get("/public")
async def get_public_reviews(limit: int = 20, offset: int = 0):
    """Get approved public reviews"""
    reviews = await db.reviews.find(
        {"is_approved": True},
        {"_id": 0}
    ).sort("created_at", -1).skip(offset).limit(limit).to_list(limit)
    
    total = await db.reviews.count_documents({"is_approved": True})
    
    # Calculate average rating
    avg_rating = 0
    if reviews:
        avg_rating = sum(r.get("rating", 0) for r in reviews) / len(reviews)
    
    return {
        "reviews": reviews,
        "total": total,
        "average_rating": round(avg_rating, 1)
    }


@router.get("/product/{product_id}")
async def get_product_reviews(product_id: str):
    """Get reviews for a specific product"""
    reviews = await db.reviews.find(
        {"product_id": product_id, "is_approved": True},
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    
    if not reviews:
        return {"reviews": [], "average_rating": 0, "total": 0}
    
    avg_rating = sum(r.get("rating", 0) for r in reviews) / len(reviews)
    
    return {
        "reviews": reviews,
        "average_rating": round(avg_rating, 1),
        "total": len(reviews),
        "rating_breakdown": {
            "5": sum(1 for r in reviews if r.get("rating") == 5),
            "4": sum(1 for r in reviews if r.get("rating") == 4),
            "3": sum(1 for r in reviews if r.get("rating") == 3),
            "2": sum(1 for r in reviews if r.get("rating") == 2),
            "1": sum(1 for r in reviews if r.get("rating") == 1),
        }
    }


@router.get("/my-pending")
async def get_my_pending_reviews(user: dict = Depends(get_current_user)):
    """Get auctions user won but hasn't reviewed yet"""
    # Get won auctions
    won_auctions = await db.auctions.find({
        "winner_id": user["id"],
        "status": "completed"
    }, {"_id": 0, "id": 1, "product_id": 1, "current_price": 1, "ended_at": 1}).to_list(50)
    
    if not won_auctions:
        return {"pending": [], "count": 0}
    
    # Get existing reviews
    auction_ids = [a["id"] for a in won_auctions]
    existing_reviews = await db.reviews.find(
        {"auction_id": {"$in": auction_ids}, "user_id": user["id"]},
        {"auction_id": 1}
    ).to_list(100)
    
    reviewed_ids = {r["auction_id"] for r in existing_reviews}
    
    # Filter to unreviewed
    pending = []
    for auction in won_auctions:
        if auction["id"] not in reviewed_ids:
            product = await db.products.find_one(
                {"id": auction.get("product_id")},
                {"_id": 0, "name": 1, "image_url": 1, "retail_price": 1}
            )
            if product:
                pending.append({
                    "auction_id": auction["id"],
                    "product": product,
                    "final_price": auction.get("current_price", 0),
                    "ended_at": auction.get("ended_at")
                })
    
    return {
        "pending": pending,
        "count": len(pending),
        "bonus_per_review": 2
    }


@router.post("/helpful/{review_id}")
async def mark_review_helpful(review_id: str, user: dict = Depends(get_current_user)):
    """Mark a review as helpful"""
    review = await db.reviews.find_one({"id": review_id})
    if not review:
        raise HTTPException(status_code=404, detail="Bewertung nicht gefunden")
    
    # Check if user already voted
    existing_vote = await db.review_votes.find_one({
        "review_id": review_id,
        "user_id": user["id"]
    })
    
    if existing_vote:
        raise HTTPException(status_code=400, detail="Du hast bereits abgestimmt")
    
    # Add vote
    await db.review_votes.insert_one({
        "review_id": review_id,
        "user_id": user["id"],
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    # Increment count
    await db.reviews.update_one(
        {"id": review_id},
        {"$inc": {"helpful_count": 1}}
    )
    
    return {"success": True}


# Admin endpoints
@router.get("/admin/pending")
async def get_pending_reviews(admin: dict = Depends(get_current_admin)):
    """Get reviews pending approval"""
    reviews = await db.reviews.find(
        {"is_approved": False},
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    
    return {"reviews": reviews, "count": len(reviews)}


@router.post("/admin/approve/{review_id}")
async def approve_review(review_id: str, admin: dict = Depends(get_current_admin)):
    """Approve a review"""
    result = await db.reviews.update_one(
        {"id": review_id},
        {
            "$set": {
                "is_approved": True,
                "approved_by": admin["id"],
                "approved_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Bewertung nicht gefunden")
    
    return {"success": True}


@router.delete("/admin/reject/{review_id}")
async def reject_review(review_id: str, admin: dict = Depends(get_current_admin)):
    """Reject/delete a review"""
    result = await db.reviews.delete_one({"id": review_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Bewertung nicht gefunden")
    
    return {"success": True}


reviews_router = router
