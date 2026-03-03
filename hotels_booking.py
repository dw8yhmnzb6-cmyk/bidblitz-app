# BIDBLITZ HOTEL BOOKING SYSTEM
# Level + Booking + Discount
# Updated: 2026-03-03

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
import uuid

from config import db
from dependencies import get_current_user
from utils.genius import add_activity

router = APIRouter(prefix="/hotels", tags=["Hotels Booking"])

# -------------------------
# MODELS
# -------------------------

class HotelCreate(BaseModel):
    name: str
    city: str
    country: str = "VAE"
    price_per_night: float
    stars: int = 4
    rating: float = 4.5
    image: Optional[str] = None
    description: Optional[str] = None
    amenities: List[str] = []

class BookingRequest(BaseModel):
    hotel_id: str
    check_in: str
    check_out: str
    nights: int
    guests: int = 2
    room_type: str = "standard"

# -------------------------
# LEVEL SYSTEM
# -------------------------

def calculate_user_level(total_bookings: int, total_spent: float):
    level = 1
    discount = 10

    if total_bookings >= 5 or total_spent >= 500:
        level = 2
        discount = 15

    if total_bookings >= 15 or total_spent >= 1500:
        level = 3
        discount = 20

    return level, discount

# -------------------------
# LIST HOTELS
# -------------------------

@router.get("")
async def list_hotels(city: Optional[str] = None, country: Optional[str] = None):
    query = {}
    if city:
        query["city"] = {"$regex": city, "$options": "i"}
    if country:
        query["country"] = {"$regex": country, "$options": "i"}
    
    hotels = []
    cursor = db.hotels.find(query)
    async for hotel in cursor:
        hotel["_id"] = str(hotel["_id"])
        hotels.append(hotel)
    
    if not hotels:
        hotels = [
            {"id": "hotel-1", "name": "Burj Al Arab", "city": "Dubai", "country": "VAE", "price_per_night": 1500, "stars": 5, "rating": 4.9, "image": "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=400"},
            {"id": "hotel-2", "name": "Atlantis The Palm", "city": "Dubai", "country": "VAE", "price_per_night": 450, "stars": 5, "rating": 4.7, "image": "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=400"},
            {"id": "hotel-3", "name": "JW Marriott", "city": "Dubai", "country": "VAE", "price_per_night": 280, "stars": 5, "rating": 4.6, "image": "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=400"},
            {"id": "hotel-4", "name": "Hilton Garden Inn", "city": "Dubai", "country": "VAE", "price_per_night": 150, "stars": 4, "rating": 4.4, "image": "https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=400"},
            {"id": "hotel-5", "name": "Swiss Hotel Prishtina", "city": "Prishtina", "country": "Kosovo", "price_per_night": 120, "stars": 4, "rating": 4.5, "image": "https://images.unsplash.com/photo-1564501049412-61c2a3083791?w=400"},
            {"id": "hotel-6", "name": "Hotel Sirius", "city": "Prishtina", "country": "Kosovo", "price_per_night": 80, "stars": 3, "rating": 4.2, "image": "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=400"},
        ]
    
    return {"hotels": hotels}

# -------------------------
# GET SINGLE HOTEL
# -------------------------

@router.get("/{hotel_id}")
async def get_hotel(hotel_id: str):
    hotel = await db.hotels.find_one({"id": hotel_id})
    if not hotel:
        sample_hotels = {
            "hotel-1": {"id": "hotel-1", "name": "Burj Al Arab", "city": "Dubai", "country": "VAE", "price_per_night": 1500, "stars": 5, "rating": 4.9},
            "hotel-2": {"id": "hotel-2", "name": "Atlantis The Palm", "city": "Dubai", "country": "VAE", "price_per_night": 450, "stars": 5, "rating": 4.7},
        }
        hotel = sample_hotels.get(hotel_id)
        if not hotel:
            raise HTTPException(404, "Hotel not found")
    else:
        hotel["_id"] = str(hotel["_id"])
    return hotel

# -------------------------
# BOOK HOTEL (WITH LEVEL DISCOUNT)
# -------------------------

@router.post("/book")
async def book_hotel(booking: BookingRequest, user: dict = Depends(get_current_user)):
    # Get hotel
    hotel = await db.hotels.find_one({"id": booking.hotel_id})
    if not hotel:
        sample_prices = {
            "hotel-1": 1500, "hotel-2": 450, "hotel-3": 280, 
            "hotel-4": 150, "hotel-5": 120, "hotel-6": 80
        }
        price_per_night = sample_prices.get(booking.hotel_id, 200)
        hotel_name = booking.hotel_id
    else:
        price_per_night = hotel.get("price_per_night", 200)
        hotel_name = hotel.get("name", "Hotel")
    
    # Get user's genius data
    genius_doc = await db.genius.find_one({"user_id": user["id"]})
    if genius_doc:
        total_bookings = genius_doc.get("total_bookings", 0)
        total_spent = genius_doc.get("total_spent_cents", 0) / 100
    else:
        total_bookings = 0
        total_spent = 0
    
    # Calculate level and discount
    level, discount = calculate_user_level(total_bookings, total_spent)
    
    # Calculate prices
    original_price = price_per_night * booking.nights
    discount_amount = original_price * (discount / 100)
    final_price = original_price - discount_amount
    
    # Create booking record
    booking_id = str(uuid.uuid4())
    booking_record = {
        "id": booking_id,
        "user_id": user["id"],
        "user_name": user.get("name", "Guest"),
        "hotel_id": booking.hotel_id,
        "hotel_name": hotel_name,
        "check_in": booking.check_in,
        "check_out": booking.check_out,
        "nights": booking.nights,
        "guests": booking.guests,
        "room_type": booking.room_type,
        "original_price": original_price,
        "discount_percent": discount,
        "discount_amount": discount_amount,
        "final_price": final_price,
        "user_level": level,
        "status": "confirmed",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    # Save booking
    await db.hotel_bookings.insert_one(booking_record)
    
    # Update Genius level
    await add_activity(
        db, 
        user["id"], 
        spend_cents=int(final_price * 100),
        booking_inc=1,
        reason="hotel_booking",
        meta={"booking_id": booking_id, "hotel_id": booking.hotel_id}
    )
    
    # Calculate NEW level
    new_genius = await db.genius.find_one({"user_id": user["id"]})
    new_level, new_discount = calculate_user_level(
        new_genius.get("total_bookings", 0),
        new_genius.get("total_spent_cents", 0) / 100
    )
    
    level_up = new_level > level
    
    return {
        "success": True,
        "booking": {
            "id": booking_id,
            "hotel": hotel_name,
            "check_in": booking.check_in,
            "check_out": booking.check_out,
            "nights": booking.nights,
            "guests": booking.guests,
            "original_price": f"{original_price:.2f} EUR",
            "discount": f"-{discount}% ({discount_amount:.2f} EUR)",
            "final_price": f"{final_price:.2f} EUR",
        },
        "user_level": {
            "level": level,
            "discount_applied": f"{discount}%",
            "level_name": ["Starter", "Gold", "Platinum"][level - 1]
        },
        "level_up": {
            "happened": level_up,
            "new_level": new_level if level_up else None,
            "new_discount": f"{new_discount}%" if level_up else None,
            "message": f"Glueckwunsch! Sie sind jetzt Level {new_level}!" if level_up else None
        }
    }

# -------------------------
# USER LEVEL CHECK
# -------------------------

@router.get("/user/level")
async def get_user_level(user: dict = Depends(get_current_user)):
    genius_doc = await db.genius.find_one({"user_id": user["id"]})
    
    if genius_doc:
        total_bookings = genius_doc.get("total_bookings", 0)
        total_spent = genius_doc.get("total_spent_cents", 0) / 100
    else:
        total_bookings = 0
        total_spent = 0
    
    level, discount = calculate_user_level(total_bookings, total_spent)
    
    next_level_info = None
    if level == 1:
        bookings_needed = max(0, 5 - total_bookings)
        spent_needed = max(0, 500 - total_spent)
        next_level_info = {
            "next_level": 2,
            "bookings_needed": bookings_needed,
            "spent_needed": f"{spent_needed:.2f} EUR",
            "progress_bookings": min(100, (total_bookings / 5) * 100),
            "progress_spent": min(100, (total_spent / 500) * 100)
        }
    elif level == 2:
        bookings_needed = max(0, 15 - total_bookings)
        spent_needed = max(0, 1500 - total_spent)
        next_level_info = {
            "next_level": 3,
            "bookings_needed": bookings_needed,
            "spent_needed": f"{spent_needed:.2f} EUR",
            "progress_bookings": min(100, (total_bookings / 15) * 100),
            "progress_spent": min(100, (total_spent / 1500) * 100)
        }
    
    return {
        "user": user.get("name", "Guest"),
        "level": level,
        "level_name": ["Starter", "Gold", "Platinum"][level - 1],
        "discount": f"{discount}%",
        "stats": {
            "total_bookings": total_bookings,
            "total_spent": f"{total_spent:.2f} EUR"
        },
        "next_level": next_level_info
    }

# -------------------------
# USER BOOKINGS HISTORY
# -------------------------

@router.get("/user/bookings")
async def get_user_bookings(user: dict = Depends(get_current_user)):
    bookings = []
    cursor = db.hotel_bookings.find({"user_id": user["id"]}).sort("created_at", -1)
    async for booking in cursor:
        booking["_id"] = str(booking["_id"])
        bookings.append(booking)
    
    return {"bookings": bookings, "total": len(bookings)}

# -------------------------
# ADMIN: ADD HOTEL
# -------------------------

@router.post("/admin/add")
async def add_hotel(hotel: HotelCreate, user: dict = Depends(get_current_user)):
    if not user.get("is_admin"):
        raise HTTPException(403, "Admin access required")
    
    hotel_doc = {
        "id": str(uuid.uuid4()),
        "name": hotel.name,
        "city": hotel.city,
        "country": hotel.country,
        "price_per_night": hotel.price_per_night,
        "stars": hotel.stars,
        "rating": hotel.rating,
        "image": hotel.image,
        "description": hotel.description,
        "amenities": hotel.amenities,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.hotels.insert_one(hotel_doc)
    hotel_doc.pop("_id", None)
    
    return {"status": "hotel added", "hotel": hotel_doc}
