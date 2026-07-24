# BidBlitz - Reorder & Favorites
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from datetime import datetime, timezone
from uuid import uuid4
from core.database import db
from routes.auth import get_current_user

router = APIRouter(prefix="/api/quick", tags=["Quick Actions"])

@router.post("/reorder/{service_type}/{order_id}")
async def reorder(service_type: str, order_id: str, user=Depends(get_current_user)):
    """1-Tap reorder from history"""
    if service_type == "taxi":
        original = await db.taxi_rides.find_one({"ride_id": order_id, "user_id": user["user_id"]}, {"_id": 0})
        if not original:
            raise HTTPException(404, "Original ride not found")
        
        # Create new ride with same details
        new_ride_id = str(uuid4())
        new_ride = {
            "ride_id": new_ride_id,
            "user_id": user["user_id"],
            "pickup": original.get("pickup"),
            "destination": original.get("destination"),
            "vehicle_type": original.get("vehicle_type"),
            "status": "requested",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.taxi_rides.insert_one(new_ride)
        return {"success": True, "ride_id": new_ride_id}
    
    elif service_type == "food":
        original = await db.food_orders.find_one({"order_id": order_id, "user_id": user["user_id"]}, {"_id": 0})
        if not original:
            raise HTTPException(404, "Original order not found")
        
        new_order_id = str(uuid4())
        new_order = {
            "order_id": new_order_id,
            "user_id": user["user_id"],
            "restaurant_id": original.get("restaurant_id"),
            "items": original.get("items"),
            "status": "pending",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.food_orders.insert_one(new_order)
        return {"success": True, "order_id": new_order_id}
    
    raise HTTPException(400, "Invalid service_type. Must be 'taxi' or 'food'.")

@router.post("/favorite")
async def add_to_favorites(item_type: str, item_id: str, user=Depends(get_current_user)):
    """Add restaurant/product/destination to favorites"""
    await db.favorites.update_one(
        {"user_id": user["user_id"]},
        {
            "$push": {
                "items": {
                    "item_type": item_type,
                    "item_id": item_id,
                    "added_at": datetime.now(timezone.utc).isoformat(),
                }
            }
        },
        upsert=True
    )
    return {"success": True}

@router.delete("/favorite/{item_type}/{item_id}")
async def remove_from_favorites(item_type: str, item_id: str, user=Depends(get_current_user)):
    """Remove from favorites"""
    await db.favorites.update_one(
        {"user_id": user["user_id"]},
        {"$pull": {"items": {"item_type": item_type, "item_id": item_id}}}
    )
    return {"success": True}

@router.get("/favorites")
async def get_favorites(user=Depends(get_current_user)):
    """Get user's favorites"""
    fav = await db.favorites.find_one({"user_id": user["user_id"]}, {"_id": 0})
    if not fav:
        return {"favorites": []}
    
    # Populate details for each favorite
    populated = []
    for item in fav.get("items", []):
        if item["item_type"] == "restaurant":
            details = await db.food_restaurants.find_one({"restaurant_id": item["item_id"]}, {"_id": 0})
        elif item["item_type"] == "product":
            details = await db.marketplace_products.find_one({"product_id": item["item_id"]}, {"_id": 0})
        else:
            details = None
        
        if details:
            populated.append({**item, "details": details})
    
    return {"favorites": populated}

@router.post("/wishlist")
async def add_to_wishlist(product_id: str, user=Depends(get_current_user)):
    """Add product to wishlist"""
    await db.wishlist.update_one(
        {"user_id": user["user_id"]},
        {"$push": {"products": {"product_id": product_id, "added_at": datetime.now(timezone.utc).isoformat()}}},
        upsert=True
    )
    return {"success": True}

@router.get("/wishlist")
async def get_wishlist(user=Depends(get_current_user)):
    """Get user's wishlist"""
    wishlist = await db.wishlist.find_one({"user_id": user["user_id"]}, {"_id": 0})
    if not wishlist:
        return {"products": []}
    
    # Populate product details
    products = []
    for item in wishlist.get("products", []):
        product = await db.marketplace_products.find_one({"product_id": item["product_id"]}, {"_id": 0})
        if product:
            products.append({**item, "details": product})
    
    return {"products": products}
