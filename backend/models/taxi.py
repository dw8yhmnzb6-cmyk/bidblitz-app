"""
Taxi Module - Pydantic Models
Ride booking, driver management, operator registration
"""

from pydantic import BaseModel, Field
from typing import Optional, List
from enum import Enum


# ══════════════════════════════════════════════════════════════════════════════
# OPERATOR MODELS
# ══════════════════════════════════════════════════════════════════════════════

class OperatorRegistration(BaseModel):
    """Taxi operator/company registration request"""
    company_name: str = Field(..., min_length=2, max_length=100)
    contact_name: str = Field(..., min_length=2, max_length=100)
    email: str = Field(..., pattern=r'^[^@]+@[^@]+\.[^@]+$')
    phone: str = Field(..., min_length=8, max_length=20)
    city: str = Field(..., min_length=2, max_length=50)
    country: str = Field(default="Deutschland")
    fleet_size: int = Field(..., ge=1, le=500, description="Number of vehicles")
    license_number: str = Field(..., min_length=5, max_length=50, description="Business license")
    tax_id: Optional[str] = Field(None, description="Tax ID (optional)")


# ══════════════════════════════════════════════════════════════════════════════
# DRIVER MODELS
# ══════════════════════════════════════════════════════════════════════════════

class DriverType(str, Enum):
    """Driver type: business (operator) or private (gig)"""
    BUSINESS = "business"
    PRIVATE = "private"


class VehicleType(str, Enum):
    """Vehicle categories"""
    STANDARD = "standard"
    PREMIUM = "premium"
    VAN = "van"


class DriverOnboardRequest(BaseModel):
    """Driver onboarding application (both business & private)"""
    name: str = Field(..., min_length=2, max_length=100)
    email: str = Field(..., pattern=r'^[^@]+@[^@]+\.[^@]+$')
    phone: str = Field(..., min_length=8, max_length=20)
    license_number: str = Field(..., min_length=5, max_length=50, description="Driver's license")
    vehicle_type: VehicleType
    driver_type: DriverType
    city: Optional[str] = Field(None, max_length=100)
    message: Optional[str] = Field(None, max_length=500, description="Additional info")
    # Vehicle capability flags (taxi.eu options-matching)
    pet_friendly: bool = False
    luggage_class: Optional[str] = Field(None, max_length=20)  # 'small'|'much'|'much_combi'|'combi'|'wagon'|'large'
    assistance: bool = False  # Helps passengers in/out (e.g. wheelchair-accessible)


class AddDriverRequest(BaseModel):
    """Add driver to operator fleet"""
    name: str = Field(..., min_length=2, max_length=100)
    email: str = Field(..., pattern=r'^[^@]+@[^@]+\.[^@]+$')
    phone: str = Field(..., min_length=8, max_length=20)
    license_number: str = Field(..., min_length=5, max_length=50)
    vehicle_type: VehicleType
    vehicle_plate: str = Field(..., min_length=2, max_length=20)


class DriverRegisterRequest(BaseModel):
    """Private driver registration (creates user account)"""
    name: str = Field(..., min_length=2)
    email: str = Field(..., pattern=r'^[^@]+@[^@]+\.[^@]+$')
    password: str = Field(..., min_length=6)
    phone: str = Field(..., min_length=8)
    license_number: str = Field(..., min_length=5)
    vehicle_type: VehicleType = VehicleType.STANDARD
    vehicle_plate: Optional[str] = None
    city: Optional[str] = None


class PrivateDriverRegistration(BaseModel):
    """Private driver registration for existing users"""
    vehicle_plate: str = Field(..., min_length=2, max_length=20)
    vehicle_model: Optional[str] = Field(None, max_length=50)
    vehicle_year: Optional[int] = Field(None, ge=1990, le=2030)
    car_type: VehicleType = VehicleType.STANDARD
    license_number: str = Field(..., min_length=5, max_length=50)
    city: Optional[str] = Field(None, max_length=100)


class LocationUpdate(BaseModel):
    """Driver location update (real-time tracking)"""
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    heading: Optional[float] = Field(None, ge=0, lt=360, description="Direction in degrees")
    speed: Optional[float] = Field(None, ge=0, description="Speed in km/h")


# ══════════════════════════════════════════════════════════════════════════════
# RIDE BOOKING MODELS
# ══════════════════════════════════════════════════════════════════════════════

class EstimateRequest(BaseModel):
    """Request fare estimate"""
    pickup_lat: float = Field(..., ge=-90, le=90)
    pickup_lng: float = Field(..., ge=-180, le=180)
    dropoff_lat: float = Field(..., ge=-90, le=90)
    dropoff_lng: float = Field(..., ge=-180, le=180)
    
    def get_coords(self):
        """Helper method for backward compatibility with taxi.py route"""
        return (
            self.pickup_lat,
            self.pickup_lng,
            self.dropoff_lat,
            self.dropoff_lng,
            "",  # pickup_address (not in EstimateRequest)
            ""   # dropoff_address (not in EstimateRequest)
        )


class BookRideRequest(BaseModel):
    """Book a taxi ride"""
    pickup_address: str = Field(..., min_length=1)
    pickup_lat: float = Field(..., ge=-90, le=90)
    pickup_lng: float = Field(..., ge=-180, le=180)
    dropoff_address: str = Field(..., min_length=1)
    dropoff_lat: float = Field(..., ge=-90, le=90)
    dropoff_lng: float = Field(..., ge=-180, le=180)
    vehicle_type: VehicleType = VehicleType.STANDARD
    driver_type: DriverType = DriverType.PRIVATE
    notes: Optional[str] = Field(None, max_length=500)


class Stop(BaseModel):
    address: str
    lat: float = Field(..., ge=-90, le=90)
    lng: float = Field(..., ge=-180, le=180)
    notes: Optional[str] = Field(None, max_length=300)


class FlexBookRequest(BaseModel):
    """Flexible ride booking (can book for another user)"""
    pickup_address: str
    pickup_lat: float = Field(..., ge=-90, le=90)
    pickup_lng: float = Field(..., ge=-180, le=180)
    pickup_notes: Optional[str] = Field(None, max_length=300)
    dropoff_address: str
    dropoff_lat: float = Field(..., ge=-90, le=90)
    dropoff_lng: float = Field(..., ge=-180, le=180)
    dropoff_notes: Optional[str] = Field(None, max_length=300)
    vehicle_type: VehicleType = VehicleType.STANDARD
    notes: Optional[str] = None
    rider_email: Optional[str] = None  # Book for another user
    rider_phone: Optional[str] = None

    # Multiple waypoints (between pickup and dropoff)
    stops: List[Stop] = Field(default_factory=list)

    # taxi.eu-parity order options
    language: Optional[str] = Field(None, max_length=10)  # "de" | "en" | ...
    with_pet: bool = False
    luggage: Optional[str] = Field(None, max_length=20)  # "none" | "small" | "much" | "much_combi"
    assistance: bool = False
    scheduled_at: Optional[str] = None  # ISO datetime; None => "Jetzt"
    
    def get_coords(self):
        """Helper method for backward compatibility with taxi.py route"""
        return (
            self.pickup_lat,
            self.pickup_lng,
            self.dropoff_lat,
            self.dropoff_lng,
            self.pickup_address,
            self.dropoff_address,
            self.vehicle_type.value  # Return string value of enum
        )


class RideActionRequest(BaseModel):
    """Driver actions: accept, start, complete, cancel ride"""
    action: str = Field(..., pattern=r'^(accept|start|complete|cancel)$')
    reason: Optional[str] = Field(None, description="Required for cancellation")


# ══════════════════════════════════════════════════════════════════════════════
# FAVORITE LOCATIONS
# ══════════════════════════════════════════════════════════════════════════════

class FavoriteLocationRequest(BaseModel):
    """Save/update favorite location"""
    name: str = Field(..., min_length=1, max_length=50, description="Home, Work, Gym, etc.")
    address: str = Field(..., min_length=1)
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    icon: str = Field(default="star", pattern=r'^(home|work|star|heart|pin)$')


# ══════════════════════════════════════════════════════════════════════════════
# MISCELLANEOUS
# ══════════════════════════════════════════════════════════════════════════════

class SavePlaceReq(BaseModel):
    """Save frequently used place"""
    name: str = Field(..., min_length=1, max_length=50)
    address: str
    lat: float = Field(..., ge=-90, le=90)
    lng: float = Field(..., ge=-180, le=180)
    icon: str = Field(default="star")


class VehicleCreateRequest(BaseModel):
    """Add vehicle to operator fleet"""
    vehicle_type: VehicleType
    license_plate: str = Field(..., min_length=2, max_length=20)
    brand: Optional[str] = Field(None, max_length=50)
    model: Optional[str] = Field(None, max_length=50)
    year: Optional[int] = Field(None, ge=1990, le=2030)
    color: Optional[str] = Field(None, max_length=30)


class VehicleUpdateRequest(BaseModel):
    """Update vehicle details"""
    vehicle_type: Optional[VehicleType] = None
    brand: Optional[str] = Field(None, max_length=50)
    model: Optional[str] = Field(None, max_length=50)
    year: Optional[int] = Field(None, ge=1990, le=2030)
    color: Optional[str] = Field(None, max_length=30)
    status: Optional[str] = Field(None, pattern=r'^(active|maintenance|inactive)$')


class SosRequest(BaseModel):
    """Emergency SOS alert"""
    ride_id: str
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    message: Optional[str] = Field(None, max_length=500)


class TipRequest(BaseModel):
    """Add tip after ride completion"""
    ride_id: str
    tip_amount: float = Field(..., gt=0, le=100, description="Tip in EUR")
    rating: Optional[int] = Field(None, ge=1, le=5)
    feedback: Optional[str] = Field(None, max_length=500)
