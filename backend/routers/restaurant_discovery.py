"""
Restaurant Discovery & Categories System
- Browse restaurants by category
- Location-based recommendations
- Featured/Premium restaurants
"""
from fastapi import APIRouter, HTTPException, Query
from datetime import datetime, timezone
from typing import Optional, List
from pydantic import BaseModel
import uuid

from config import db, logger

router = APIRouter(prefix="/restaurants", tags=["Restaurant Discovery"])

# ==================== CATEGORIES ====================

RESTAURANT_CATEGORIES = [
    {"id": "italian", "name": "Italienisch", "name_en": "Italian", "icon": "🍕", "color": "#E53935"},
    {"id": "german", "name": "Deutsch", "name_en": "German", "icon": "🥨", "color": "#FFC107"},
    {"id": "asian", "name": "Asiatisch", "name_en": "Asian", "icon": "🍜", "color": "#FF5722"},
    {"id": "burger", "name": "Burger", "name_en": "Burger", "icon": "🍔", "color": "#795548"},
    {"id": "pizza", "name": "Pizza", "name_en": "Pizza", "icon": "🍕", "color": "#F44336"},
    {"id": "sushi", "name": "Sushi", "name_en": "Sushi", "icon": "🍣", "color": "#E91E63"},
    {"id": "mexican", "name": "Mexikanisch", "name_en": "Mexican", "icon": "🌮", "color": "#4CAF50"},
    {"id": "indian", "name": "Indisch", "name_en": "Indian", "icon": "🍛", "color": "#FF9800"},
    {"id": "turkish", "name": "Türkisch", "name_en": "Turkish", "icon": "🥙", "color": "#9C27B0"},
    {"id": "greek", "name": "Griechisch", "name_en": "Greek", "icon": "🥗", "color": "#2196F3"},
    {"id": "cafe", "name": "Café", "name_en": "Café", "icon": "☕", "color": "#8D6E63"},
    {"id": "fine_dining", "name": "Fine Dining", "name_en": "Fine Dining", "icon": "🍽️", "color": "#9E9E9E"},
    {"id": "fast_food", "name": "Fast Food", "name_en": "Fast Food", "icon": "🍟", "color": "#FFEB3B"},
    {"id": "seafood", "name": "Fisch & Meer", "name_en": "Seafood", "icon": "🦐", "color": "#00BCD4"},
    {"id": "vegetarian", "name": "Vegetarisch", "name_en": "Vegetarian", "icon": "🥬", "color": "#8BC34A"},
    {"id": "dessert", "name": "Dessert", "name_en": "Dessert", "icon": "🍰", "color": "#F48FB1"},
]

# German cities with coordinates
CITIES = [
    {"id": "berlin", "name": "Berlin", "lat": 52.52, "lng": 13.405},
    {"id": "munich", "name": "München", "lat": 48.137, "lng": 11.576},
    {"id": "hamburg", "name": "Hamburg", "lat": 53.551, "lng": 9.993},
    {"id": "cologne", "name": "Köln", "lat": 50.937, "lng": 6.96},
    {"id": "frankfurt", "name": "Frankfurt", "lat": 50.11, "lng": 8.682},
    {"id": "stuttgart", "name": "Stuttgart", "lat": 48.775, "lng": 9.182},
    {"id": "dusseldorf", "name": "Düsseldorf", "lat": 51.227, "lng": 6.773},
    {"id": "vienna", "name": "Wien", "lat": 48.208, "lng": 16.373},
    {"id": "zurich", "name": "Zürich", "lat": 47.376, "lng": 8.541},
    {"id": "dubai", "name": "Dubai", "lat": 25.204, "lng": 55.270},
    {"id": "prishtina", "name": "Prishtina", "lat": 42.662, "lng": 21.165},
]

# ==================== SCHEMAS ====================

class RestaurantUpdate(BaseModel):
    categories: Optional[List[str]] = None
    city: Optional[str] = None
    description: Optional[str] = None
    price_range: Optional[int] = None  # 1-4 (€ to €€€€)
    opening_hours: Optional[str] = None
    features: Optional[List[str]] = None  # ["outdoor_seating", "wifi", "parking"]
    cover_image: Optional[str] = None
    gallery_images: Optional[List[str]] = None
    is_premium: Optional[bool] = None

# ==================== ENDPOINTS ====================

@router.get("/categories")
async def get_categories():
    """Get all restaurant categories"""
    return RESTAURANT_CATEGORIES

@router.get("/cities")
async def get_cities():
    """Get available cities"""
    return CITIES

@router.get("/discover")
async def discover_restaurants(
    category: Optional[str] = None,
    city: Optional[str] = None,
    min_rating: Optional[float] = None,
    price_range: Optional[int] = None,
    has_vouchers: bool = True,
    sort_by: str = "rating",  # rating, reviews, newest
    limit: int = 20,
    skip: int = 0
):
    """Discover restaurants with filters"""
    
    # Build query
    query = {"is_verified": True, "is_active": True}
    
    if category:
        query["categories"] = category
    
    if city:
        query["city"] = city
    
    if min_rating:
        query["avg_rating"] = {"$gte": min_rating}
    
    if price_range:
        query["price_range"] = price_range
    
    # Sort options
    sort_field = "avg_rating"
    if sort_by == "reviews":
        sort_field = "total_reviews"
    elif sort_by == "newest":
        sort_field = "created_at"
    
    restaurants = await db.restaurant_accounts.find(
        query,
        {"_id": 0, "password_hash": 0, "auth_token": 0, "iban": 0}
    ).sort(sort_field, -1).skip(skip).limit(limit).to_list(limit)
    
    # Add voucher count for each restaurant
    for restaurant in restaurants:
        voucher_count = await db.vouchers.count_documents({
            "merchant_id": restaurant["id"],
            "is_active": True,
            "used_count": {"$lt": 1}
        })
        restaurant["available_vouchers"] = voucher_count
    
    # Filter by has_vouchers if specified
    if has_vouchers:
        restaurants = [r for r in restaurants if r.get("available_vouchers", 0) > 0]
    
    return {
        "restaurants": restaurants,
        "total": len(restaurants),
        "filters": {
            "category": category,
            "city": city,
            "min_rating": min_rating,
            "price_range": price_range
        }
    }

@router.get("/featured")
async def get_featured_restaurants(limit: int = 6):
    """Get featured/premium restaurants"""
    
    # First get premium restaurants
    premium = await db.restaurant_accounts.find(
        {"is_verified": True, "is_active": True, "is_premium": True},
        {"_id": 0, "password_hash": 0, "auth_token": 0, "iban": 0}
    ).sort("avg_rating", -1).limit(limit).to_list(limit)
    
    # If not enough premium, fill with top-rated
    if len(premium) < limit:
        remaining = limit - len(premium)
        premium_ids = [r["id"] for r in premium]
        
        top_rated = await db.restaurant_accounts.find(
            {
                "is_verified": True, 
                "is_active": True, 
                "id": {"$nin": premium_ids},
                "total_reviews": {"$gte": 1}
            },
            {"_id": 0, "password_hash": 0, "auth_token": 0, "iban": 0}
        ).sort("avg_rating", -1).limit(remaining).to_list(remaining)
        
        premium.extend(top_rated)
    
    # Add voucher availability
    for restaurant in premium:
        voucher_count = await db.vouchers.count_documents({
            "merchant_id": restaurant["id"],
            "is_active": True,
            "used_count": {"$lt": 1}
        })
        restaurant["available_vouchers"] = voucher_count
    
    return premium

@router.get("/nearby")
async def get_nearby_restaurants(lat: float, lng: float, radius_km: float = 10, limit: int = 10):
    """Get restaurants near a location"""
    
    # Simple distance calculation (for demo - use proper geospatial in production)
    restaurants = await db.restaurant_accounts.find(
        {"is_verified": True, "is_active": True, "lat": {"$exists": True}},
        {"_id": 0, "password_hash": 0, "auth_token": 0, "iban": 0}
    ).to_list(100)
    
    # Calculate distances
    import math
    
    def haversine(lat1, lon1, lat2, lon2):
        R = 6371  # Earth's radius in km
        dlat = math.radians(lat2 - lat1)
        dlon = math.radians(lon2 - lon1)
        a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon/2)**2
        return 2 * R * math.asin(math.sqrt(a))
    
    nearby = []
    for r in restaurants:
        if r.get("lat") and r.get("lng"):
            distance = haversine(lat, lng, r["lat"], r["lng"])
            if distance <= radius_km:
                r["distance_km"] = round(distance, 1)
                nearby.append(r)
    
    # Sort by distance
    nearby.sort(key=lambda x: x.get("distance_km", 999))
    
    return nearby[:limit]

@router.get("/{restaurant_id}")
async def get_restaurant_details(restaurant_id: str):
    """Get full restaurant details"""
    
    restaurant = await db.restaurant_accounts.find_one(
        {"id": restaurant_id},
        {"_id": 0, "password_hash": 0, "auth_token": 0, "iban": 0}
    )
    
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant nicht gefunden")
    
    # Get available vouchers
    vouchers = await db.vouchers.find(
        {
            "merchant_id": restaurant_id,
            "is_active": True,
            "used_count": {"$lt": 1}
        },
        {"_id": 0}
    ).to_list(20)
    
    # Get recent reviews
    reviews = await db.restaurant_reviews.find(
        {"restaurant_id": restaurant_id, "status": "published"},
        {"_id": 0}
    ).sort("created_at", -1).limit(5).to_list(5)
    
    # Get category info
    categories_info = []
    for cat_id in restaurant.get("categories", []):
        cat = next((c for c in RESTAURANT_CATEGORIES if c["id"] == cat_id), None)
        if cat:
            categories_info.append(cat)
    
    return {
        "restaurant": restaurant,
        "categories": categories_info,
        "available_vouchers": vouchers,
        "recent_reviews": reviews,
        "stats": {
            "avg_rating": restaurant.get("avg_rating", 0),
            "total_reviews": restaurant.get("total_reviews", 0),
            "recommend_percent": restaurant.get("recommend_percent", 0)
        }
    }

@router.put("/{restaurant_id}")
async def update_restaurant(restaurant_id: str, data: RestaurantUpdate):
    """Update restaurant profile (for restaurant owners)"""
    
    update_data = {k: v for k, v in data.dict().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.restaurant_accounts.update_one(
        {"id": restaurant_id},
        {"$set": update_data}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Restaurant nicht gefunden")
    
    return {"success": True, "message": "Restaurant aktualisiert"}

# ==================== PREMIUM SUBSCRIPTION ====================

@router.post("/{restaurant_id}/upgrade-premium")
async def upgrade_to_premium(restaurant_id: str, months: int = 1):
    """Upgrade restaurant to premium listing"""
    
    # In production, integrate with Stripe for payment
    price_per_month = 49.99
    total = price_per_month * months
    
    now = datetime.now(timezone.utc)
    from datetime import timedelta
    expires = now + timedelta(days=30 * months)
    
    await db.restaurant_accounts.update_one(
        {"id": restaurant_id},
        {"$set": {
            "is_premium": True,
            "premium_since": now.isoformat(),
            "premium_expires": expires.isoformat()
        }}
    )
    
    # Create premium subscription record
    await db.premium_subscriptions.insert_one({
        "id": str(uuid.uuid4()),
        "restaurant_id": restaurant_id,
        "months": months,
        "amount": total,
        "started_at": now.isoformat(),
        "expires_at": expires.isoformat(),
        "status": "active"
    })
    
    logger.info(f"Restaurant {restaurant_id} upgraded to premium for {months} months")
    
    return {
        "success": True,
        "message": f"Premium aktiviert für {months} Monat(e)!",
        "expires": expires.isoformat(),
        "amount_charged": total
    }

restaurant_discovery_router = router
