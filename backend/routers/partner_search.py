"""
Partner Local Search - Kunden finden Partner in ihrer Nähe
Geolocation-basierte Suche
"""
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone
from typing import Optional, List
from pydantic import BaseModel
import math

from config import db, logger
from dependencies import get_current_user

router = APIRouter(prefix="/partner-search", tags=["Partner Search"])

# ==================== HELPER FUNCTIONS ====================

def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate distance between two coordinates in km"""
    R = 6371  # Earth's radius in km
    
    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    delta_lat = math.radians(lat2 - lat1)
    delta_lon = math.radians(lon2 - lon1)
    
    a = math.sin(delta_lat/2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lon/2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    
    return R * c

# ==================== SCHEMAS ====================

class LocationSearch(BaseModel):
    latitude: float
    longitude: float
    radius_km: float = 5.0
    business_type: Optional[str] = None
    min_rating: Optional[float] = None
    has_vouchers: bool = False

class PartnerLocation(BaseModel):
    id: str
    name: str
    business_type: str
    latitude: float
    longitude: float
    distance_km: float
    average_rating: Optional[float]
    total_ratings: int
    address: str
    city: str

# ==================== ENDPOINTS ====================

@router.post("/nearby")
async def find_nearby_partners(data: LocationSearch):
    """Find partners within a radius of the given location"""
    # Get all partners with coordinates
    query = {
        "status": "approved",
        "latitude": {"$exists": True, "$ne": None},
        "longitude": {"$exists": True, "$ne": None}
    }
    
    if data.business_type:
        query["business_type"] = data.business_type
    
    if data.min_rating:
        query["average_rating"] = {"$gte": data.min_rating}
    
    partners = await db.partner_accounts.find(
        query,
        {"_id": 0, "id": 1, "name": 1, "business_type": 1, "latitude": 1, "longitude": 1,
         "average_rating": 1, "total_ratings": 1, "address": 1, "city": 1, "logo_url": 1,
         "phone": 1, "opening_hours": 1}
    ).to_list(500)
    
    # Calculate distances and filter by radius
    nearby = []
    for partner in partners:
        try:
            distance = haversine_distance(
                data.latitude, data.longitude,
                float(partner.get("latitude", 0)), float(partner.get("longitude", 0))
            )
            
            if distance <= data.radius_km:
                partner["distance_km"] = round(distance, 2)
                
                # Check if partner has active vouchers
                if data.has_vouchers:
                    voucher_count = await db.vouchers.count_documents({
                        "partner_id": partner["id"],
                        "is_sold": False,
                        "is_redeemed": False
                    })
                    if voucher_count == 0:
                        continue
                    partner["available_vouchers"] = voucher_count
                
                nearby.append(partner)
        except (TypeError, ValueError):
            continue
    
    # Sort by distance
    nearby.sort(key=lambda x: x["distance_km"])
    
    return {
        "count": len(nearby),
        "radius_km": data.radius_km,
        "partners": nearby[:50]  # Limit to 50 results
    }


@router.get("/cities")
async def get_cities_with_partners():
    """Get list of cities with active partners"""
    pipeline = [
        {"$match": {"status": "approved", "city": {"$exists": True, "$ne": ""}}},
        {"$group": {
            "_id": "$city",
            "partner_count": {"$sum": 1}
        }},
        {"$sort": {"partner_count": -1}},
        {"$limit": 50}
    ]
    
    cities = await db.partner_accounts.aggregate(pipeline).to_list(50)
    
    return {
        "cities": [
            {"name": city["_id"], "partner_count": city["partner_count"]}
            for city in cities if city["_id"]
        ]
    }


@router.get("/by-city/{city}")
async def get_partners_by_city(
    city: str,
    business_type: Optional[str] = None,
    min_rating: Optional[float] = None,
    sort_by: str = "rating",  # rating, name, vouchers
    limit: int = 50
):
    """Get all partners in a specific city"""
    # Support 'all' to get all partners regardless of city
    if city.lower() == "all":
        query = {"status": "approved"}
    else:
        query = {
            "status": "approved",
            "city": {"$regex": f"^{city}$", "$options": "i"}
        }
    
    if business_type:
        query["business_type"] = business_type
    
    if min_rating:
        query["average_rating"] = {"$gte": min_rating}
    
    # Determine sort field
    sort_field = "average_rating" if sort_by == "rating" else "name"
    sort_order = -1 if sort_by == "rating" else 1
    
    partners = await db.partner_accounts.find(
        query,
        {"_id": 0, "id": 1, "name": 1, "business_type": 1, "address": 1, "city": 1,
         "average_rating": 1, "total_ratings": 1, "logo_url": 1, "phone": 1,
         "latitude": 1, "longitude": 1}
    ).sort(sort_field, sort_order).limit(limit).to_list(limit)
    
    # Get voucher counts
    for partner in partners:
        voucher_count = await db.vouchers.count_documents({
            "partner_id": partner["id"],
            "is_sold": False,
            "is_redeemed": False
        })
        partner["voucher_count"] = voucher_count
    
    return {
        "partners": partners,
        "total": len(partners)
    }


# ==================== MAP ENDPOINT ====================

@router.get("/map")
async def get_partners_for_map():
    """Get all partners with coordinates for map display"""
    partners = await db.partner_accounts.find(
        {"status": "approved"},
        {"_id": 0}
    ).to_list(500)
    
    # Get cashback settings
    cashback_settings = await db.merchant_cashback_settings.find(
        {},
        {"_id": 0, "merchant_id": 1, "cashback_rate": 1, "special_rate": 1}
    ).to_list(500)
    
    cashback_map = {s["merchant_id"]: s for s in cashback_settings}
    
    result = []
    for p in partners:
        partner_data = {
            "id": p.get("id"),
            "business_name": p.get("business_name") or p.get("name"),
            "address": p.get("address", ""),
            "city": p.get("city", ""),
            "latitude": p.get("latitude"),
            "longitude": p.get("longitude"),
            "is_premium": p.get("is_premium", False),
            "category": p.get("business_type") or p.get("category", "other"),
            "phone": p.get("phone"),
            "logo_url": p.get("logo_url"),
            "average_rating": p.get("average_rating")
        }
        
        # Add cashback info
        cashback = cashback_map.get(p.get("id"), {})
        partner_data["cashback_rate"] = cashback.get("special_rate") or cashback.get("cashback_rate") or (5 if p.get("is_premium") else 3)
        
        result.append(partner_data)
    
    return {
        "partners": result,
        "total": len(result)
    }


@router.get("/business-types")
async def get_business_types():
    """Get list of all business types with counts"""
    pipeline = [
        {"$match": {"status": "approved"}},
        {"$group": {
            "_id": "$business_type",
            "count": {"$sum": 1}
        }},
        {"$sort": {"count": -1}}
    ]
    
    types = await db.partner_accounts.aggregate(pipeline).to_list(50)
    
    # Business type translations
    type_names = {
        "restaurant": {"name": "Restaurant", "icon": "🍕"},
        "bar": {"name": "Bar & Club", "icon": "🍺"},
        "cafe": {"name": "Café", "icon": "☕"},
        "gas_station": {"name": "Tankstelle", "icon": "⛽"},
        "cinema": {"name": "Kino", "icon": "🎬"},
        "retail": {"name": "Einzelhandel", "icon": "🛒"},
        "wellness": {"name": "Wellness & Spa", "icon": "💆"},
        "fitness": {"name": "Fitness-Studio", "icon": "🏋️"},
        "beauty": {"name": "Friseur & Beauty", "icon": "💇"},
        "hotel": {"name": "Hotel & Unterkunft", "icon": "🏨"},
        "entertainment": {"name": "Unterhaltung", "icon": "🎯"},
        "supermarket": {"name": "Supermarkt", "icon": "🛍️"},
        "pharmacy": {"name": "Apotheke", "icon": "💊"},
        "other": {"name": "Sonstiges", "icon": "🏪"}
    }
    
    return {
        "business_types": [
            {
                "id": t["_id"],
                "name": type_names.get(t["_id"], {"name": t["_id"], "icon": "🏪"})["name"],
                "icon": type_names.get(t["_id"], {"name": t["_id"], "icon": "🏪"})["icon"],
                "count": t["count"]
            }
            for t in types if t["_id"]
        ]
    }


@router.put("/update-location")
async def update_partner_location(token: str, latitude: float, longitude: float):
    """Update partner's location coordinates"""
    partner = await db.partner_accounts.find_one({"auth_token": token}, {"_id": 0})
    if not partner:
        raise HTTPException(status_code=401, detail="Ungültiger Token")
    
    # Validate coordinates
    if not (-90 <= latitude <= 90) or not (-180 <= longitude <= 180):
        raise HTTPException(status_code=400, detail="Ungültige Koordinaten")
    
    await db.partner_accounts.update_one(
        {"id": partner.get("id")},
        {
            "$set": {
                "latitude": latitude,
                "longitude": longitude,
                "location_updated_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    return {"success": True, "message": "Standort aktualisiert"}


@router.get("/map-data")
async def get_map_data(
    north: float,
    south: float,
    east: float,
    west: float,
    business_type: Optional[str] = None
):
    """Get partners within map bounds for display on map"""
    query = {
        "status": "approved",
        "latitude": {"$gte": south, "$lte": north},
        "longitude": {"$gte": west, "$lte": east}
    }
    
    if business_type:
        query["business_type"] = business_type
    
    partners = await db.partner_accounts.find(
        query,
        {"_id": 0, "id": 1, "name": 1, "business_type": 1, "latitude": 1, "longitude": 1,
         "average_rating": 1, "logo_url": 1, "address": 1}
    ).limit(100).to_list(100)
    
    return {
        "count": len(partners),
        "markers": [
            {
                "id": p["id"],
                "name": p.get("name"),
                "type": p.get("business_type"),
                "lat": p.get("latitude"),
                "lng": p.get("longitude"),
                "rating": p.get("average_rating"),
                "logo": p.get("logo_url"),
                "address": p.get("address")
            }
            for p in partners
        ]
    }
