"""
Partner Rating System - Kunden bewerten Partner nach Gutschein-Einlösung
Sterne + Kommentare für Vertrauensbildung
"""
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone
from typing import Optional, List
from pydantic import BaseModel
import uuid

from config import db, logger
from dependencies import get_current_user

router = APIRouter(prefix="/partner-ratings", tags=["Partner Ratings"])

# ==================== SCHEMAS ====================

class RatingCreate(BaseModel):
    partner_id: str
    voucher_id: Optional[str] = None
    rating: int  # 1-5 stars
    comment: Optional[str] = None
    recommend: Optional[bool] = True

class RatingResponse(BaseModel):
    id: str
    rating: int
    comment: Optional[str]
    user_name: str
    created_at: str
    voucher_name: Optional[str]

# ==================== ENDPOINTS ====================

@router.post("/submit")
async def submit_rating(data: RatingCreate, user: dict = Depends(get_current_user)):
    """Submit a rating for a partner after voucher redemption"""
    user_id = user["id"]
    
    # Validate rating
    if data.rating < 1 or data.rating > 5:
        raise HTTPException(status_code=400, detail="Bewertung muss zwischen 1 und 5 sein")
    
    # Check if partner exists
    partner = await db.partners.find_one({"id": data.partner_id}, {"_id": 0})
    if not partner:
        raise HTTPException(status_code=404, detail="Partner nicht gefunden")
    
    # Check if user has redeemed a voucher from this partner (optional verification)
    if data.voucher_id:
        voucher = await db.vouchers.find_one({
            "id": data.voucher_id,
            "partner_id": data.partner_id,
            "redeemed_by": user_id
        })
        if not voucher:
            raise HTTPException(status_code=400, detail="Sie haben diesen Gutschein nicht eingelöst")
    
    # Check for existing rating from this user for this partner
    existing = await db.partner_ratings.find_one({
        "partner_id": data.partner_id,
        "user_id": user_id
    })
    
    if existing:
        # Update existing rating
        await db.partner_ratings.update_one(
            {"id": existing["id"]},
            {
                "$set": {
                    "rating": data.rating,
                    "comment": data.comment,
                    "recommend": data.recommend,
                    "voucher_id": data.voucher_id,
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }
            }
        )
        rating_id = existing["id"]
        message = "Bewertung aktualisiert"
    else:
        # Create new rating
        rating_id = str(uuid.uuid4())
        await db.partner_ratings.insert_one({
            "id": rating_id,
            "partner_id": data.partner_id,
            "user_id": user_id,
            "user_name": user.get("name", "Anonym"),
            "voucher_id": data.voucher_id,
            "rating": data.rating,
            "comment": data.comment,
            "recommend": data.recommend,
            "status": "published",
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        message = "Bewertung abgegeben"
    
    # Update partner's average rating
    await update_partner_average_rating(data.partner_id)
    
    logger.info(f"Rating submitted: {user_id} -> {data.partner_id}, {data.rating} stars")
    
    return {
        "success": True,
        "message": message,
        "rating_id": rating_id
    }


async def update_partner_average_rating(partner_id: str):
    """Recalculate and update partner's average rating"""
    pipeline = [
        {"$match": {"partner_id": partner_id, "status": "published"}},
        {"$group": {
            "_id": "$partner_id",
            "average_rating": {"$avg": "$rating"},
            "total_ratings": {"$sum": 1},
            "recommend_count": {"$sum": {"$cond": ["$recommend", 1, 0]}}
        }}
    ]
    
    result = await db.partner_ratings.aggregate(pipeline).to_list(1)
    
    if result:
        stats = result[0]
        recommend_rate = (stats["recommend_count"] / stats["total_ratings"] * 100) if stats["total_ratings"] > 0 else 0
        
        await db.partners.update_one(
            {"id": partner_id},
            {
                "$set": {
                    "average_rating": round(stats["average_rating"], 1),
                    "total_ratings": stats["total_ratings"],
                    "recommend_rate": round(recommend_rate, 0)
                }
            }
        )


@router.get("/partner/{partner_id}")
async def get_partner_ratings(partner_id: str, limit: int = 20, skip: int = 0):
    """Get all ratings for a specific partner"""
    partner = await db.partners.find_one({"id": partner_id}, {"_id": 0})
    if not partner:
        raise HTTPException(status_code=404, detail="Partner nicht gefunden")
    
    # Get ratings
    ratings = await db.partner_ratings.find(
        {"partner_id": partner_id, "status": "published"},
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    # Enrich with voucher info
    for rating in ratings:
        if rating.get("voucher_id"):
            voucher = await db.vouchers.find_one(
                {"id": rating["voucher_id"]},
                {"_id": 0, "name": 1}
            )
            rating["voucher_name"] = voucher.get("name") if voucher else None
    
    # Get stats
    total = await db.partner_ratings.count_documents({"partner_id": partner_id, "status": "published"})
    
    # Rating distribution
    distribution = {1: 0, 2: 0, 3: 0, 4: 0, 5: 0}
    all_ratings = await db.partner_ratings.find(
        {"partner_id": partner_id, "status": "published"},
        {"_id": 0, "rating": 1}
    ).to_list(1000)
    
    for r in all_ratings:
        distribution[r["rating"]] = distribution.get(r["rating"], 0) + 1
    
    return {
        "partner_name": partner.get("name"),
        "average_rating": partner.get("average_rating", 0),
        "total_ratings": total,
        "recommend_rate": partner.get("recommend_rate", 0),
        "distribution": distribution,
        "ratings": ratings
    }


@router.get("/my-ratings")
async def get_my_ratings(user: dict = Depends(get_current_user)):
    """Get all ratings submitted by current user"""
    user_id = user["id"]
    
    ratings = await db.partner_ratings.find(
        {"user_id": user_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    # Enrich with partner info
    for rating in ratings:
        partner = await db.partners.find_one(
            {"id": rating["partner_id"]},
            {"_id": 0, "name": 1, "logo_url": 1, "business_type": 1}
        )
        if partner:
            rating["partner_name"] = partner.get("name")
            rating["partner_logo"] = partner.get("logo_url")
            rating["partner_type"] = partner.get("business_type")
    
    return {"ratings": ratings}


@router.delete("/{rating_id}")
async def delete_rating(rating_id: str, user: dict = Depends(get_current_user)):
    """Delete a rating (user can only delete their own)"""
    user_id = user["id"]
    
    rating = await db.partner_ratings.find_one({"id": rating_id})
    if not rating:
        raise HTTPException(status_code=404, detail="Bewertung nicht gefunden")
    
    if rating["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Keine Berechtigung")
    
    partner_id = rating["partner_id"]
    
    await db.partner_ratings.delete_one({"id": rating_id})
    
    # Update partner's average
    await update_partner_average_rating(partner_id)
    
    return {"success": True, "message": "Bewertung gelöscht"}


@router.get("/top-partners")
async def get_top_rated_partners(limit: int = 10, business_type: Optional[str] = None):
    """Get top-rated partners"""
    query = {"average_rating": {"$exists": True, "$gt": 0}}
    if business_type:
        query["business_type"] = business_type
    
    partners = await db.partners.find(
        query,
        {"_id": 0, "id": 1, "name": 1, "logo_url": 1, "business_type": 1, 
         "average_rating": 1, "total_ratings": 1, "recommend_rate": 1,
         "address": 1, "city": 1}
    ).sort("average_rating", -1).limit(limit).to_list(limit)
    
    return {"top_partners": partners}


@router.post("/report/{rating_id}")
async def report_rating(rating_id: str, reason: str, user: dict = Depends(get_current_user)):
    """Report an inappropriate rating"""
    rating = await db.partner_ratings.find_one({"id": rating_id})
    if not rating:
        raise HTTPException(status_code=404, detail="Bewertung nicht gefunden")
    
    # Create report
    report_id = str(uuid.uuid4())
    await db.rating_reports.insert_one({
        "id": report_id,
        "rating_id": rating_id,
        "reported_by": user["id"],
        "reason": reason,
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {"success": True, "message": "Bewertung gemeldet"}
