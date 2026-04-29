# BidBlitz - Advanced Filter & Search
from fastapi import APIRouter, Query
from typing import Optional, List
from core.database import db

router = APIRouter(prefix="/api/filters", tags=["Filters"])

@router.get("/food/restaurants")
async def filter_restaurants(
    cuisine: Optional[List[str]] = Query(None),
    dietary: Optional[List[str]] = Query(None),  # vegan, vegetarian, halal, gluten_free
    delivery_time_max: Optional[int] = None,
    rating_min: Optional[float] = None,
    free_delivery: Optional[bool] = None,
    min_order_max: Optional[float] = None,
    open_now: Optional[bool] = None,
    search: Optional[str] = None,
    sort_by: Optional[str] = "rating",  # rating, delivery_time, min_order
):
    """Advanced restaurant filtering"""
    query = {"status": "active"}
    
    if cuisine:
        query["cuisine"] = {"$in": cuisine}
    
    if dietary:
        query["dietary_options"] = {"$all": dietary}
    
    if delivery_time_max:
        query["delivery_time"] = {"$lte": delivery_time_max}
    
    if rating_min:
        query["rating"] = {"$gte": rating_min}
    
    if free_delivery:
        query["delivery_free"] = True
    
    if min_order_max:
        query["min_order"] = {"$lte": min_order_max}
    
    if open_now:
        # TODO: Check opening hours
        pass
    
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}},
        ]
    
    sort_map = {
        "rating": ("rating", -1),
        "delivery_time": ("delivery_time", 1),
        "min_order": ("min_order", 1),
    }
    sort_field, sort_order = sort_map.get(sort_by, ("rating", -1))
    
    restaurants = await db.food_restaurants.find(query, {"_id": 0}).sort(sort_field, sort_order).to_list(100)
    
    return {"restaurants": restaurants}

@router.get("/marketplace/products")
async def filter_products(
    category: Optional[str] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    rating_min: Optional[float] = None,
    in_stock: Optional[bool] = True,
    brand: Optional[List[str]] = Query(None),
    search: Optional[str] = None,
    sort_by: Optional[str] = "relevance",  # relevance, price_low, price_high, rating, newest
):
    """Advanced product filtering"""
    query = {}
    
    if category:
        query["category"] = category
    
    if min_price or max_price:
        query["price"] = {}
        if min_price:
            query["price"]["$gte"] = min_price
        if max_price:
            query["price"]["$lte"] = max_price
    
    if rating_min:
        query["rating"] = {"$gte": rating_min}
    
    if in_stock:
        query["stock"] = {"$gt": 0}
    
    if brand:
        query["brand"] = {"$in": brand}
    
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}},
            {"tags": {"$regex": search, "$options": "i"}},
        ]
    
    sort_map = {
        "relevance": ("_id", -1),
        "price_low": ("price", 1),
        "price_high": ("price", -1),
        "rating": ("rating", -1),
        "newest": ("created_at", -1),
    }
    sort_field, sort_order = sort_map.get(sort_by, ("_id", -1))
    
    products = await db.marketplace_products.find(query, {"_id": 0}).sort(sort_field, sort_order).to_list(100)
    
    return {"products": products}

@router.get("/food/cuisines")
async def get_available_cuisines():
    """Get list of available cuisines"""
    cuisines = await db.food_restaurants.distinct("cuisine")
    return {"cuisines": sorted(cuisines)}

@router.get("/marketplace/categories")
async def get_categories():
    """Get marketplace categories"""
    categories = await db.marketplace_products.distinct("category")
    return {"categories": sorted(categories)}

@router.get("/marketplace/brands")
async def get_brands():
    """Get available brands"""
    brands = await db.marketplace_products.distinct("brand")
    return {"brands": sorted(brands)}
