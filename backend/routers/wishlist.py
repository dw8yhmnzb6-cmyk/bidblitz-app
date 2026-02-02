"""Product Wishlist Router - User voting for wanted products"""
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone
from pydantic import BaseModel
from typing import Optional, List
import uuid

from config import db, logger
from dependencies import get_current_user, get_admin_user

router = APIRouter(prefix="/wishlist", tags=["Product Wishlist"])

# ==================== SCHEMAS ====================

class WishCreate(BaseModel):
    product_name: str
    category: Optional[str] = None
    description: Optional[str] = None
    estimated_price: Optional[float] = None
    image_url: Optional[str] = None

class WishVote(BaseModel):
    wish_id: str

# ==================== ENDPOINTS ====================

@router.post("/suggest")
async def suggest_product(data: WishCreate, user: dict = Depends(get_current_user)):
    """Suggest a new product for auctions"""
    user_id = user["id"]
    
    if not data.product_name or len(data.product_name) < 3:
        raise HTTPException(status_code=400, detail="Produktname muss mindestens 3 Zeichen haben")
    
    if len(data.product_name) > 100:
        raise HTTPException(status_code=400, detail="Produktname zu lang (max 100 Zeichen)")
    
    # Check for duplicate suggestions
    existing = await db.product_wishes.find_one({
        "product_name": {"$regex": f"^{data.product_name}$", "$options": "i"}
    })
    
    if existing:
        # Just vote for existing instead
        return await vote_for_wish(WishVote(wish_id=existing["id"]), user)
    
    user_data = await db.users.find_one({"id": user_id}, {"_id": 0})
    
    wish = {
        "id": str(uuid.uuid4()),
        "product_name": data.product_name,
        "category": data.category or "Sonstiges",
        "description": data.description,
        "estimated_price": data.estimated_price,
        "image_url": data.image_url,
        "suggested_by": user_id,
        "suggested_by_name": user_data.get("username", "Benutzer") if user_data else "Benutzer",
        "votes": [user_id],  # Auto-vote by suggester
        "vote_count": 1,
        "status": "pending",  # pending, approved, rejected, completed
        "admin_notes": None,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.product_wishes.insert_one(wish)
    
    logger.info(f"Product wish created: {data.product_name} by {user_id}")
    
    return {
        "success": True,
        "message": f"'{data.product_name}' vorgeschlagen! Andere können dafür abstimmen.",
        "wish_id": wish["id"]
    }

@router.post("/vote")
async def vote_for_wish(data: WishVote, user: dict = Depends(get_current_user)):
    """Vote for a product wish"""
    user_id = user["id"]
    
    wish = await db.product_wishes.find_one({"id": data.wish_id}, {"_id": 0})
    
    if not wish:
        raise HTTPException(status_code=404, detail="Vorschlag nicht gefunden")
    
    if wish.get("status") not in ["pending", "approved"]:
        raise HTTPException(status_code=400, detail="Abstimmung nicht mehr möglich")
    
    if user_id in wish.get("votes", []):
        raise HTTPException(status_code=400, detail="Du hast bereits abgestimmt")
    
    await db.product_wishes.update_one(
        {"id": data.wish_id},
        {
            "$push": {"votes": user_id},
            "$inc": {"vote_count": 1}
        }
    )
    
    new_count = wish.get("vote_count", 0) + 1
    
    logger.info(f"Vote for wish {data.wish_id} by {user_id} - now {new_count} votes")
    
    return {
        "success": True,
        "message": f"Stimme abgegeben! ({new_count} Stimmen)",
        "new_vote_count": new_count
    }

@router.delete("/unvote/{wish_id}")
async def unvote_wish(wish_id: str, user: dict = Depends(get_current_user)):
    """Remove vote from a wish"""
    user_id = user["id"]
    
    wish = await db.product_wishes.find_one({"id": wish_id}, {"_id": 0})
    
    if not wish:
        raise HTTPException(status_code=404, detail="Vorschlag nicht gefunden")
    
    if user_id not in wish.get("votes", []):
        raise HTTPException(status_code=400, detail="Du hast nicht abgestimmt")
    
    # Can't unvote if you're the suggester
    if wish.get("suggested_by") == user_id:
        raise HTTPException(status_code=400, detail="Du kannst deinen eigenen Vorschlag nicht zurückziehen")
    
    await db.product_wishes.update_one(
        {"id": wish_id},
        {
            "$pull": {"votes": user_id},
            "$inc": {"vote_count": -1}
        }
    )
    
    return {"success": True, "message": "Stimme zurückgezogen"}

@router.get("/top")
async def get_top_wishes(limit: int = 20, category: Optional[str] = None):
    """Get top voted product wishes"""
    query = {"status": {"$in": ["pending", "approved"]}}
    if category:
        query["category"] = category
    
    wishes = await db.product_wishes.find(
        query,
        {"_id": 0, "votes": 0}  # Don't return voter list
    ).sort("vote_count", -1).to_list(limit)
    
    return {"wishes": wishes}

@router.get("/my-wishes")
async def get_my_wishes(user: dict = Depends(get_current_user)):
    """Get wishes suggested by user"""
    wishes = await db.product_wishes.find(
        {"suggested_by": user["id"]},
        {"_id": 0, "votes": 0}
    ).sort("created_at", -1).to_list(50)
    
    return {"wishes": wishes}

@router.get("/my-votes")
async def get_my_votes(user: dict = Depends(get_current_user)):
    """Get wishes user has voted for"""
    wishes = await db.product_wishes.find(
        {"votes": user["id"]},
        {"_id": 0, "votes": 0}
    ).sort("vote_count", -1).to_list(50)
    
    return {"wishes": wishes}

@router.get("/categories")
async def get_wish_categories():
    """Get available categories for wishes"""
    categories = [
        {"id": "electronics", "name": "Elektronik", "icon": "📱"},
        {"id": "gaming", "name": "Gaming", "icon": "🎮"},
        {"id": "home", "name": "Haushalt", "icon": "🏠"},
        {"id": "fashion", "name": "Mode", "icon": "👗"},
        {"id": "sports", "name": "Sport", "icon": "⚽"},
        {"id": "beauty", "name": "Beauty", "icon": "💄"},
        {"id": "tools", "name": "Werkzeug", "icon": "🔧"},
        {"id": "other", "name": "Sonstiges", "icon": "📦"}
    ]
    return {"categories": categories}

# ==================== ADMIN ENDPOINTS ====================

@router.post("/admin/{wish_id}/approve")
async def approve_wish(wish_id: str, admin: dict = Depends(get_admin_user)):
    """Approve a product wish"""
    await db.product_wishes.update_one(
        {"id": wish_id},
        {"$set": {
            "status": "approved",
            "approved_by": admin["id"],
            "approved_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    return {"success": True, "message": "Vorschlag genehmigt"}

@router.post("/admin/{wish_id}/reject")
async def reject_wish(wish_id: str, reason: Optional[str] = None, admin: dict = Depends(get_admin_user)):
    """Reject a product wish"""
    await db.product_wishes.update_one(
        {"id": wish_id},
        {"$set": {
            "status": "rejected",
            "rejected_by": admin["id"],
            "admin_notes": reason,
            "rejected_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    return {"success": True, "message": "Vorschlag abgelehnt"}

@router.post("/admin/{wish_id}/complete")
async def complete_wish(wish_id: str, auction_id: Optional[str] = None, admin: dict = Depends(get_admin_user)):
    """Mark wish as completed (auction created)"""
    await db.product_wishes.update_one(
        {"id": wish_id},
        {"$set": {
            "status": "completed",
            "completed_by": admin["id"],
            "auction_id": auction_id,
            "completed_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Notify voters
    wish = await db.product_wishes.find_one({"id": wish_id}, {"_id": 0})
    if wish:
        for voter_id in wish.get("votes", []):
            notification = {
                "id": str(uuid.uuid4()),
                "user_id": voter_id,
                "type": "wish_completed",
                "title": "Dein Wunschprodukt ist da!",
                "message": f"'{wish['product_name']}' ist jetzt als Auktion verfügbar!",
                "auction_id": auction_id,
                "read": False,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.notifications.insert_one(notification)
    
    return {"success": True, "message": "Vorschlag als erledigt markiert"}

@router.get("/admin/all")
async def get_all_wishes(status: Optional[str] = None, admin: dict = Depends(get_admin_user)):
    """Get all wishes (admin view)"""
    query = {}
    if status:
        query["status"] = status
    
    wishes = await db.product_wishes.find(
        query,
        {"_id": 0}
    ).sort("vote_count", -1).to_list(100)
    
    return {"wishes": wishes}


wishlist_router = router
