"""
BidBlitz V2 - Booking & Reservation System
Hotels, Restaurants, Ärzte, Handwerker buchen
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, timezone, timedelta
from core.database import db
from core.security import get_current_user
import secrets

router = APIRouter(prefix="/api/reservations", tags=["reservations"])

# ══════════════════════════════════════════════════════════════════════════════
# PRICING & MODELS
# ══════════════════════════════════════════════════════════════════════════════

BOOKING_TYPES = {
    "hotel": {"commission_rate": 0.15, "no_show_fee": 30.00},
    "restaurant": {"commission_rate": 0.10, "no_show_fee": 20.00},
    "doctor": {"commission_rate": 0.08, "no_show_fee": 25.00},
    "handyman": {"commission_rate": 0.12, "no_show_fee": 15.00},
    "salon": {"commission_rate": 0.10, "no_show_fee": 15.00},
}

class ServiceProviderRegister(BaseModel):
    business_name: str = Field(..., min_length=2)
    service_type: str  # hotel, restaurant, doctor, handyman, salon
    phone: str
    email: str
    address: str
    city: str
    country_code: str
    description: str = ""
    booking_settings: dict = {}

class ReservationCreate(BaseModel):
    provider_id: str
    service_type: str
    booking_date: str
    booking_time: str
    duration_minutes: int = 60
    guest_count: int = 1
    special_requests: str = ""
    contact_phone: str
    contact_email: str

class ReservationUpdate(BaseModel):
    status: Optional[str] = None
    notes: Optional[str] = None

# ... (Rest des Codes identisch mit bookings.py, nur router name geändert)
