"""Taxi Ratings - Post-ride rating system"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
import uuid
from dependencies import get_current_user
from config import db

router = APIRouter(prefix="/taxi/ratings", tags=["Taxi Ratings"])

class RideRating(BaseModel):
    ride_id: str
    rating: int  # 1-5
    comment: Optional[str] = None

@router.post("/rate-driver")
async def rate_driver(data: RideRating, user: dict = Depends(get_current_user)):
    """Rider rates driver after ride"""
    if not 1 <= data.rating <= 5:
        raise HTTPException(400, "Bewertung 1-5")
    ride = await db.taxi_rides.find_one({"id": data.ride_id, "rider_user_id": user["id"], "status": "completed"})
    if not ride:
        raise HTTPException(404, "Fahrt nicht gefunden")
    if ride.get("rating_driver") is not None:
        raise HTTPException(409, "Bereits bewertet")

    await db.taxi_rides.update_one({"id": data.ride_id}, {"$set": {"rating_driver": data.rating}})
    await db.taxi_ride_ratings.insert_one({
        "id": str(uuid.uuid4()), "ride_id": data.ride_id, "from_user_id": user["id"],
        "to_user_id": ride["driver_user_id"], "type": "rider_to_driver",
        "rating": data.rating, "comment": data.comment,
        "created_at": datetime.now(timezone.utc).isoformat()
    })

    # Update driver average
    pipeline = [{"$match": {"to_user_id": ride["driver_user_id"], "type": "rider_to_driver"}},
                {"$group": {"_id": None, "avg": {"$avg": "$rating"}}}]
    result = await db.taxi_ride_ratings.aggregate(pipeline).to_list(1)
    if result:
        await db.taxi_driver_profiles.update_one({"user_id": ride["driver_user_id"]}, {"$set": {"rating_avg": round(result[0]["avg"], 1)}})

    return {"success": True, "message": "Danke fuer Ihre Bewertung!"}

@router.post("/rate-rider")
async def rate_rider(data: RideRating, user: dict = Depends(get_current_user)):
    """Driver rates rider after ride"""
    if not 1 <= data.rating <= 5:
        raise HTTPException(400, "Bewertung 1-5")
    ride = await db.taxi_rides.find_one({"id": data.ride_id, "driver_user_id": user["id"], "status": "completed"})
    if not ride:
        raise HTTPException(404, "Fahrt nicht gefunden")
    if ride.get("rating_rider") is not None:
        raise HTTPException(409, "Bereits bewertet")

    await db.taxi_rides.update_one({"id": data.ride_id}, {"$set": {"rating_rider": data.rating}})
    await db.taxi_ride_ratings.insert_one({
        "id": str(uuid.uuid4()), "ride_id": data.ride_id, "from_user_id": user["id"],
        "to_user_id": ride["rider_user_id"], "type": "driver_to_rider",
        "rating": data.rating, "comment": data.comment,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    return {"success": True, "message": "Bewertung gespeichert!"}

@router.get("/my-ratings")
async def get_my_ratings(user: dict = Depends(get_current_user)):
    received = await db.taxi_ride_ratings.find({"to_user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(50)
    pipeline = [{"$match": {"to_user_id": user["id"]}}, {"$group": {"_id": None, "avg": {"$avg": "$rating"}, "count": {"$sum": 1}}}]
    result = await db.taxi_ride_ratings.aggregate(pipeline).to_list(1)
    avg = round(result[0]["avg"], 1) if result else 5.0
    count = result[0]["count"] if result else 0
    return {"ratings": received, "average": avg, "total": count}
