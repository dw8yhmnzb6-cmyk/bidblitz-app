"""Winner Gallery Router - Verified winner photos and testimonials"""
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from datetime import datetime, timezone
from typing import Optional
import uuid
import base64

from config import db, logger
from dependencies import get_current_user, get_admin_user

router = APIRouter(prefix="/winner-gallery", tags=["winner-gallery"])

# ==================== USER ENDPOINTS ====================

@router.post("/upload")
async def upload_winner_photo(
    auction_id: str,
    caption: Optional[str] = None,
    image_base64: Optional[str] = None,
    user: dict = Depends(get_current_user)
):
    """Upload a winner photo for a won auction"""
    user_id = user["id"]
    
    # Verify user won this auction
    auction = await db.auctions.find_one({
        "id": auction_id,
        "winner_id": user_id
    }, {"_id": 0})
    
    if not auction:
        raise HTTPException(status_code=403, detail="Du hast diese Auktion nicht gewonnen")
    
    # Check if already submitted
    existing = await db.winner_gallery.find_one({
        "auction_id": auction_id,
        "user_id": user_id
    })
    
    if existing:
        raise HTTPException(status_code=400, detail="Foto bereits eingereicht")
    
    # Get product info
    product = await db.products.find_one({"id": auction.get("product_id")}, {"_id": 0})
    
    # Create gallery entry
    gallery_id = str(uuid.uuid4())
    entry = {
        "id": gallery_id,
        "user_id": user_id,
        "user_name": user.get("name", "Gewinner"),
        "auction_id": auction_id,
        "product_id": auction.get("product_id"),
        "product_name": product.get("name") if product else "Produkt",
        "product_image": product.get("image_url") if product else None,
        "winner_image": image_base64,  # Base64 encoded image
        "caption": caption or "",
        "final_price": auction.get("current_price", 0),
        "retail_price": product.get("retail_price", 0) if product else 0,
        "savings": (product.get("retail_price", 0) - auction.get("current_price", 0)) if product else 0,
        "status": "pending",  # pending, approved, rejected
        "featured": False,
        "likes": 0,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.winner_gallery.insert_one(entry)
    
    # Award bonus bids for submitting photo
    bonus_bids = 5
    await db.users.update_one(
        {"id": user_id},
        {"$inc": {"bids_balance": bonus_bids}}
    )
    
    logger.info(f"Winner photo uploaded: {user_id} for auction {auction_id}")
    
    return {
        "message": f"Foto eingereicht! Du erhältst {bonus_bids} Bonus-Gebote nach Freigabe.",
        "gallery_id": gallery_id,
        "bonus_bids": bonus_bids
    }


@router.get("/my-submissions")
async def get_my_submissions(user: dict = Depends(get_current_user)):
    """Get user's gallery submissions"""
    submissions = await db.winner_gallery.find(
        {"user_id": user["id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    
    return {"submissions": submissions}


@router.get("/feed")
async def get_gallery_feed(
    limit: int = 20,
    offset: int = 0,
    featured_only: bool = False
):
    """Get public winner gallery feed"""
    query = {"status": "approved"}
    if featured_only:
        query["featured"] = True
    
    entries = await db.winner_gallery.find(
        query,
        {"_id": 0, "winner_image": 0}  # Exclude large image data for list
    ).sort("created_at", -1).skip(offset).limit(limit).to_list(limit)
    
    total = await db.winner_gallery.count_documents(query)
    
    return {
        "entries": entries,
        "total": total,
        "has_more": offset + limit < total
    }


@router.get("/{gallery_id}")
async def get_gallery_entry(gallery_id: str):
    """Get a single gallery entry with full image"""
    entry = await db.winner_gallery.find_one(
        {"id": gallery_id, "status": "approved"},
        {"_id": 0}
    )
    
    if not entry:
        raise HTTPException(status_code=404, detail="Eintrag nicht gefunden")
    
    return entry


@router.post("/{gallery_id}/like")
async def like_gallery_entry(gallery_id: str, user: dict = Depends(get_current_user)):
    """Like a gallery entry"""
    # Check if already liked
    existing = await db.gallery_likes.find_one({
        "gallery_id": gallery_id,
        "user_id": user["id"]
    })
    
    if existing:
        # Unlike
        await db.gallery_likes.delete_one({"_id": existing["_id"]})
        await db.winner_gallery.update_one(
            {"id": gallery_id},
            {"$inc": {"likes": -1}}
        )
        return {"liked": False}
    
    # Like
    await db.gallery_likes.insert_one({
        "id": str(uuid.uuid4()),
        "gallery_id": gallery_id,
        "user_id": user["id"],
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    await db.winner_gallery.update_one(
        {"id": gallery_id},
        {"$inc": {"likes": 1}}
    )
    
    return {"liked": True}


# ==================== ADMIN ENDPOINTS ====================

@router.get("/admin/pending")
async def get_pending_submissions(admin: dict = Depends(get_admin_user)):
    """Get pending gallery submissions for review"""
    pending = await db.winner_gallery.find(
        {"status": "pending"},
        {"_id": 0}
    ).sort("created_at", 1).to_list(50)
    
    return {"pending": pending, "count": len(pending)}


@router.put("/admin/{gallery_id}/approve")
async def approve_gallery_entry(gallery_id: str, admin: dict = Depends(get_admin_user)):
    """Approve a gallery submission"""
    entry = await db.winner_gallery.find_one({"id": gallery_id})
    if not entry:
        raise HTTPException(status_code=404, detail="Eintrag nicht gefunden")
    
    await db.winner_gallery.update_one(
        {"id": gallery_id},
        {"$set": {"status": "approved", "approved_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    # Notify user
    await db.notifications.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": entry["user_id"],
        "type": "gallery_approved",
        "title": "📸 Foto freigegeben!",
        "message": "Dein Gewinner-Foto ist jetzt in der Galerie sichtbar!",
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    logger.info(f"Gallery entry approved: {gallery_id}")
    
    return {"message": "Eintrag freigegeben"}


@router.put("/admin/{gallery_id}/reject")
async def reject_gallery_entry(
    gallery_id: str,
    reason: Optional[str] = None,
    admin: dict = Depends(get_admin_user)
):
    """Reject a gallery submission"""
    entry = await db.winner_gallery.find_one({"id": gallery_id})
    if not entry:
        raise HTTPException(status_code=404, detail="Eintrag nicht gefunden")
    
    await db.winner_gallery.update_one(
        {"id": gallery_id},
        {"$set": {"status": "rejected", "reject_reason": reason}}
    )
    
    # Notify user
    await db.notifications.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": entry["user_id"],
        "type": "gallery_rejected",
        "title": "📸 Foto nicht freigegeben",
        "message": f"Dein Gewinner-Foto wurde leider nicht freigegeben. {reason or ''}",
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {"message": "Eintrag abgelehnt"}


@router.put("/admin/{gallery_id}/feature")
async def toggle_featured(gallery_id: str, admin: dict = Depends(get_admin_user)):
    """Toggle featured status of a gallery entry"""
    entry = await db.winner_gallery.find_one({"id": gallery_id})
    if not entry:
        raise HTTPException(status_code=404, detail="Eintrag nicht gefunden")
    
    new_featured = not entry.get("featured", False)
    
    await db.winner_gallery.update_one(
        {"id": gallery_id},
        {"$set": {"featured": new_featured}}
    )
    
    return {"message": "Featured-Status geändert", "featured": new_featured}


@router.get("/admin/stats")
async def get_gallery_stats(admin: dict = Depends(get_admin_user)):
    """Get gallery statistics"""
    total = await db.winner_gallery.count_documents({})
    approved = await db.winner_gallery.count_documents({"status": "approved"})
    pending = await db.winner_gallery.count_documents({"status": "pending"})
    featured = await db.winner_gallery.count_documents({"featured": True})
    
    # Total savings showcased
    pipeline = [
        {"$match": {"status": "approved"}},
        {"$group": {"_id": None, "total_savings": {"$sum": "$savings"}}}
    ]
    savings = await db.winner_gallery.aggregate(pipeline).to_list(1)
    total_savings = savings[0]["total_savings"] if savings else 0
    
    return {
        "total_submissions": total,
        "approved": approved,
        "pending": pending,
        "featured": featured,
        "total_savings_showcased": round(total_savings, 2)
    }
