"""Video Testimonials Router - Winner video testimonials"""
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from datetime import datetime, timezone
from pydantic import BaseModel
from typing import Optional, List
import uuid

from config import db, logger
from dependencies import get_current_user, get_admin_user

router = APIRouter(prefix="/testimonials", tags=["Testimonials"])

# ==================== SCHEMAS ====================

class TestimonialCreate(BaseModel):
    auction_id: str
    video_url: str
    description: Optional[str] = None

# ==================== ENDPOINTS ====================

@router.get("/videos")
async def get_video_testimonials(limit: int = 20, featured_only: bool = False):
    """Get approved video testimonials"""
    query = {"status": "approved"}
    if featured_only:
        query["featured"] = True
    
    testimonials = await db.video_testimonials.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).to_list(limit)
    
    return {"videos": testimonials}

@router.post("/submit")
async def submit_testimonial(data: TestimonialCreate, user: dict = Depends(get_current_user)):
    """Submit a video testimonial for review"""
    user_id = user["id"]
    
    # Check if user won this auction
    auction = await db.auctions.find_one({
        "id": data.auction_id,
        "winner_id": user_id,
        "status": "ended"
    }, {"_id": 0})
    
    if not auction:
        raise HTTPException(status_code=400, detail="Du hast diese Auktion nicht gewonnen")
    
    # Check for existing testimonial
    existing = await db.video_testimonials.find_one({
        "user_id": user_id,
        "auction_id": data.auction_id
    })
    
    if existing:
        raise HTTPException(status_code=400, detail="Du hast bereits ein Video für diese Auktion eingereicht")
    
    # Get product info
    product = await db.products.find_one({"id": auction.get("product_id")}, {"_id": 0})
    
    user_data = await db.users.find_one({"id": user_id}, {"_id": 0})
    
    testimonial = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "username": user_data.get("username", user_data.get("email", "").split("@")[0]) if user_data else "Benutzer",
        "auction_id": data.auction_id,
        "product_name": product.get("name") if product else auction.get("product_name", "Produkt"),
        "product_id": auction.get("product_id"),
        "final_price": auction.get("final_price", auction.get("current_price", 0)),
        "retail_price": product.get("retail_price", 0) if product else 0,
        "video_url": data.video_url,
        "thumbnail": product.get("image_url") if product else None,
        "description": data.description,
        "views": 0,
        "likes": 0,
        "featured": False,
        "status": "pending",  # pending, approved, rejected
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.video_testimonials.insert_one(testimonial)
    
    logger.info(f"Video testimonial submitted: {user_id} for auction {data.auction_id}")
    
    return {
        "success": True,
        "message": "Video eingereicht! Es wird nach Prüfung veröffentlicht. Du erhältst 15 Gebote nach Genehmigung.",
        "testimonial_id": testimonial["id"]
    }

@router.get("/my-testimonials")
async def get_my_testimonials(user: dict = Depends(get_current_user)):
    """Get user's own testimonials"""
    testimonials = await db.video_testimonials.find(
        {"user_id": user["id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(20)
    
    return {"testimonials": testimonials}

@router.post("/{testimonial_id}/like")
async def like_testimonial(testimonial_id: str, user: dict = Depends(get_current_user)):
    """Like a video testimonial"""
    testimonial = await db.video_testimonials.find_one(
        {"id": testimonial_id, "status": "approved"},
        {"_id": 0}
    )
    
    if not testimonial:
        raise HTTPException(status_code=404, detail="Video nicht gefunden")
    
    # Check for existing like
    existing_like = await db.testimonial_likes.find_one({
        "user_id": user["id"],
        "testimonial_id": testimonial_id
    })
    
    if existing_like:
        # Unlike
        await db.testimonial_likes.delete_one({"id": existing_like["id"]})
        await db.video_testimonials.update_one(
            {"id": testimonial_id},
            {"$inc": {"likes": -1}}
        )
        return {"success": True, "liked": False}
    
    # Add like
    like = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "testimonial_id": testimonial_id,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.testimonial_likes.insert_one(like)
    await db.video_testimonials.update_one(
        {"id": testimonial_id},
        {"$inc": {"likes": 1}}
    )
    
    return {"success": True, "liked": True}

@router.post("/{testimonial_id}/view")
async def record_view(testimonial_id: str):
    """Record a view on a testimonial"""
    await db.video_testimonials.update_one(
        {"id": testimonial_id, "status": "approved"},
        {"$inc": {"views": 1}}
    )
    return {"success": True}

# ==================== ADMIN ENDPOINTS ====================

@router.get("/admin/pending")
async def get_pending_testimonials(admin: dict = Depends(get_admin_user)):
    """Get pending testimonials for review"""
    pending = await db.video_testimonials.find(
        {"status": "pending"},
        {"_id": 0}
    ).sort("created_at", 1).to_list(50)
    
    return {"pending": pending}

@router.post("/admin/{testimonial_id}/approve")
async def approve_testimonial(testimonial_id: str, admin: dict = Depends(get_admin_user)):
    """Approve a testimonial and award bonus bids"""
    testimonial = await db.video_testimonials.find_one({"id": testimonial_id}, {"_id": 0})
    
    if not testimonial:
        raise HTTPException(status_code=404, detail="Testimonial nicht gefunden")
    
    if testimonial.get("status") == "approved":
        raise HTTPException(status_code=400, detail="Bereits genehmigt")
    
    # Approve
    await db.video_testimonials.update_one(
        {"id": testimonial_id},
        {"$set": {
            "status": "approved",
            "approved_at": datetime.now(timezone.utc).isoformat(),
            "approved_by": admin["id"]
        }}
    )
    
    # Award 15 bonus bids
    await db.users.update_one(
        {"id": testimonial["user_id"]},
        {"$inc": {"bids": 15}}
    )
    
    logger.info(f"Testimonial approved: {testimonial_id} - User {testimonial['user_id']} got +15 bids")
    
    return {"success": True, "message": "Testimonial genehmigt. Benutzer erhält 15 Gebote."}

@router.post("/admin/{testimonial_id}/reject")
async def reject_testimonial(testimonial_id: str, admin: dict = Depends(get_admin_user)):
    """Reject a testimonial"""
    await db.video_testimonials.update_one(
        {"id": testimonial_id},
        {"$set": {
            "status": "rejected",
            "rejected_at": datetime.now(timezone.utc).isoformat(),
            "rejected_by": admin["id"]
        }}
    )
    
    return {"success": True, "message": "Testimonial abgelehnt"}

@router.post("/admin/{testimonial_id}/feature")
async def toggle_featured(testimonial_id: str, admin: dict = Depends(get_admin_user)):
    """Toggle featured status"""
    testimonial = await db.video_testimonials.find_one({"id": testimonial_id}, {"_id": 0})
    
    if not testimonial:
        raise HTTPException(status_code=404, detail="Testimonial nicht gefunden")
    
    new_featured = not testimonial.get("featured", False)
    
    await db.video_testimonials.update_one(
        {"id": testimonial_id},
        {"$set": {"featured": new_featured}}
    )
    
    return {"success": True, "featured": new_featured}


testimonials_router = router
