"""Wishlist & Watch List - Track products and get alerts"""
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone
from typing import Optional
import uuid

from config import db, logger
from dependencies import get_current_user

router = APIRouter(prefix="/wishlist", tags=["Wishlist"])

# ==================== WISHLIST ENDPOINTS ====================

@router.get("/")
async def get_wishlist(user: dict = Depends(get_current_user)):
    """Get user's wishlist with active auctions"""
    user_id = user["id"]
    
    # Get wishlist items
    wishlist = await db.wishlists.find(
        {"user_id": user_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    # Enrich with product and auction info
    enriched = []
    for item in wishlist:
        product = await db.products.find_one({"id": item["product_id"]}, {"_id": 0})
        
        # Check for active auctions
        active_auction = await db.auctions.find_one({
            "product_id": item["product_id"],
            "status": "active"
        }, {"_id": 0, "id": 1, "current_price": 1, "end_time": 1})
        
        enriched.append({
            **item,
            "product": product,
            "active_auction": active_auction,
            "has_active_auction": active_auction is not None
        })
    
    return {"items": enriched, "count": len(enriched)}

@router.post("/add/{product_id}")
async def add_to_wishlist(
    product_id: str,
    notify_on_auction: bool = True,
    max_price_alert: Optional[float] = None,
    user: dict = Depends(get_current_user)
):
    """Add a product to wishlist"""
    user_id = user["id"]
    
    # Check if product exists
    product = await db.products.find_one({"id": product_id})
    if not product:
        raise HTTPException(status_code=404, detail="Produkt nicht gefunden")
    
    # Check if already in wishlist
    existing = await db.wishlists.find_one({
        "user_id": user_id,
        "product_id": product_id
    })
    
    if existing:
        raise HTTPException(status_code=400, detail="Produkt ist bereits auf deiner Wunschliste")
    
    wishlist_item = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "product_id": product_id,
        "product_name": product.get("name", ""),
        "notify_on_auction": notify_on_auction,
        "max_price_alert": max_price_alert,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.wishlists.insert_one(wishlist_item)
    
    logger.info(f"Wishlist: {user_id} added {product.get('name')}")
    
    return {
        "message": "Zur Wunschliste hinzugefügt!",
        "item": wishlist_item
    }

@router.delete("/remove/{product_id}")
async def remove_from_wishlist(product_id: str, user: dict = Depends(get_current_user)):
    """Remove a product from wishlist"""
    result = await db.wishlists.delete_one({
        "user_id": user["id"],
        "product_id": product_id
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Produkt nicht auf Wunschliste")
    
    return {"message": "Von Wunschliste entfernt"}

@router.put("/settings/{product_id}")
async def update_wishlist_settings(
    product_id: str,
    notify_on_auction: Optional[bool] = None,
    max_price_alert: Optional[float] = None,
    user: dict = Depends(get_current_user)
):
    """Update wishlist item notification settings"""
    update = {}
    if notify_on_auction is not None:
        update["notify_on_auction"] = notify_on_auction
    if max_price_alert is not None:
        update["max_price_alert"] = max_price_alert
    
    if not update:
        raise HTTPException(status_code=400, detail="Keine Änderungen angegeben")
    
    result = await db.wishlists.update_one(
        {"user_id": user["id"], "product_id": product_id},
        {"$set": update}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Produkt nicht auf Wunschliste")
    
    return {"message": "Einstellungen aktualisiert"}

# ==================== WATCH LIST (AUCTIONS) ====================

@router.get("/watching")
async def get_watched_auctions(user: dict = Depends(get_current_user)):
    """Get auctions the user is watching"""
    watched = await db.watched_auctions.find(
        {"user_id": user["id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    
    # Enrich with auction data
    enriched = []
    for item in watched:
        auction = await db.auctions.find_one({"id": item["auction_id"]}, {"_id": 0})
        if auction:
            product = await db.products.find_one({"id": auction.get("product_id")}, {"_id": 0})
            enriched.append({
                **item,
                "auction": auction,
                "product": product
            })
    
    return {"auctions": enriched, "count": len(enriched)}

@router.post("/watch/{auction_id}")
async def watch_auction(auction_id: str, user: dict = Depends(get_current_user)):
    """Start watching an auction without bidding"""
    auction = await db.auctions.find_one({"id": auction_id})
    if not auction:
        raise HTTPException(status_code=404, detail="Auktion nicht gefunden")
    
    # Check if already watching
    existing = await db.watched_auctions.find_one({
        "user_id": user["id"],
        "auction_id": auction_id
    })
    
    if existing:
        raise HTTPException(status_code=400, detail="Du beobachtest diese Auktion bereits")
    
    await db.watched_auctions.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "auction_id": auction_id,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {"message": "Auktion wird beobachtet"}

@router.delete("/unwatch/{auction_id}")
async def unwatch_auction(auction_id: str, user: dict = Depends(get_current_user)):
    """Stop watching an auction"""
    result = await db.watched_auctions.delete_one({
        "user_id": user["id"],
        "auction_id": auction_id
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Auktion nicht beobachtet")
    
    return {"message": "Beobachtung beendet"}

# ==================== NOTIFICATION FUNCTIONS ====================

async def notify_wishlist_auction_started(product_id: str, auction_id: str):
    """Notify users when a wishlisted product goes to auction"""
    product = await db.products.find_one({"id": product_id}, {"_id": 0, "name": 1, "image_url": 1})
    if not product:
        return
    
    # Find all users with this product on wishlist
    wishlist_items = await db.wishlists.find({
        "product_id": product_id,
        "notify_on_auction": True
    }).to_list(1000)
    
    for item in wishlist_items:
        await db.notifications.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": item["user_id"],
            "type": "wishlist_auction",
            "title": "🎯 Dein Wunschprodukt wird versteigert!",
            "message": f"{product.get('name', 'Ein Produkt')} ist jetzt in einer Auktion!",
            "action_url": f"/auctions/{auction_id}",
            "image_url": product.get("image_url"),
            "read": False,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
    
    logger.info(f"Notified {len(wishlist_items)} users about wishlist auction for {product.get('name')}")

async def notify_price_alert(auction_id: str, current_price: float):
    """Notify watchers when price drops below their alert threshold"""
    auction = await db.auctions.find_one({"id": auction_id}, {"_id": 0, "product_id": 1})
    if not auction:
        return
    
    # Find wishlist items with price alerts
    alerts = await db.wishlists.find({
        "product_id": auction["product_id"],
        "max_price_alert": {"$gte": current_price}
    }).to_list(1000)
    
    for item in alerts:
        # Check if already notified for this auction
        existing = await db.notifications.find_one({
            "user_id": item["user_id"],
            "type": "price_alert",
            "action_url": f"/auctions/{auction_id}"
        })
        
        if not existing:
            await db.notifications.insert_one({
                "id": str(uuid.uuid4()),
                "user_id": item["user_id"],
                "type": "price_alert",
                "title": "💰 Preisalarm!",
                "message": f"{item.get('product_name', 'Ein Produkt')} ist jetzt unter €{item['max_price_alert']:.2f}!",
                "action_url": f"/auctions/{auction_id}",
                "read": False,
                "created_at": datetime.now(timezone.utc).isoformat()
            })

__all__ = ['notify_wishlist_auction_started', 'notify_price_alert']
