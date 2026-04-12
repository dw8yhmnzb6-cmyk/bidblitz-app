"""
BidBlitz V2 - Empfehlungssystem
Personalisierte Karussells auf der Startseite
"""
from fastapi import APIRouter, HTTPException, Request
from core.database import db
from core.security import get_current_user

router = APIRouter(prefix="/api/recommendations", tags=["recommendations"])


@router.get("/home")
async def get_home_recommendations(request: Request):
    """Get personalized recommendations for the home page."""
    try:
        user = await get_current_user(request)
        user_id = str(user["_id"])
    except Exception:
        user_id = None

    sections = []

    # 1. Popular Hotels
    hotels = await db.properties.find(
        {"status": "active"}, {"_id": 0}
    ).sort("booking_count", -1).limit(6).to_list(6)
    if hotels:
        sections.append({
            "id": "popular_hotels",
            "title": "Beliebte Unterkünfte",
            "subtitle": "Top bewertete Hotels & Apartments",
            "type": "hotel",
            "items": hotels,
        })

    # 2. Upcoming Events
    events = await db.events.find(
        {"status": "active"}, {"_id": 0}
    ).sort("date", 1).limit(6).to_list(6)
    if events:
        sections.append({
            "id": "upcoming_events",
            "title": "Events diese Woche",
            "subtitle": "Konzerte, Sport & mehr",
            "type": "event",
            "items": events,
        })

    # 3. Top Restaurants
    restaurants = await db.restaurants.find(
        {"status": "active"}, {"_id": 0}
    ).sort("rating", -1).limit(6).to_list(6)
    if restaurants:
        sections.append({
            "id": "top_restaurants",
            "title": "Top Restaurants",
            "subtitle": "Bestbewertete Restaurants",
            "type": "restaurant",
            "items": restaurants,
        })

    # 4. Hot Jobs
    jobs = await db.jobs.find(
        {"status": "active"}, {"_id": 0}
    ).sort([("is_boosted", -1), ("created_at", -1)]).limit(6).to_list(6)
    if jobs:
        sections.append({
            "id": "hot_jobs",
            "title": "Top Jobs",
            "subtitle": "Aktuelle Stellenangebote",
            "type": "job",
            "items": jobs,
        })

    # 5. Insurance Deals
    insurance = await db.insurance_products.find(
        {"status": "active"}, {"_id": 0}
    ).sort("monthly_price", 1).limit(4).to_list(4)
    if insurance:
        sections.append({
            "id": "insurance_deals",
            "title": "Versicherungs-Deals",
            "subtitle": "Günstige Absicherung",
            "type": "insurance",
            "items": insurance,
        })

    # 6. Popular Flights
    flights = await db.flights.find(
        {"status": "active"}, {"_id": 0}
    ).sort("booking_count", -1).limit(6).to_list(6)
    if flights:
        sections.append({
            "id": "popular_flights",
            "title": "Beliebte Flüge",
            "subtitle": "Günstige Flugverbindungen",
            "type": "flight",
            "items": flights,
        })

    return {"sections": sections}
