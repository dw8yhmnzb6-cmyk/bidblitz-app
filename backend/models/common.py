"""
Common/Shared Pydantic Models
Used across multiple modules (Taxi, Food, Scooter, etc.)
"""

from pydantic import BaseModel, Field
from typing import Optional


class Coordinates(BaseModel):
    """GPS coordinates for locations"""
    latitude: float = Field(..., ge=-90, le=90, description="Latitude (-90 to 90)")
    longitude: float = Field(..., ge=-180, le=180, description="Longitude (-180 to 180)")


class Address(BaseModel):
    """Structured address with coordinates"""
    street: str = Field(..., min_length=1, max_length=200)
    house_number: Optional[str] = Field(None, max_length=20)
    postal_code: Optional[str] = Field(None, max_length=20)
    city: str = Field(..., min_length=1, max_length=100)
    country: str = Field(default="Deutschland", max_length=100)
    latitude: Optional[float] = Field(None, ge=-90, le=90)
    longitude: Optional[float] = Field(None, ge=-180, le=180)
    
    @property
    def full_address(self) -> str:
        """Get formatted full address string"""
        parts = [
            f"{self.street} {self.house_number}".strip() if self.house_number else self.street,
            f"{self.postal_code} {self.city}" if self.postal_code else self.city,
            self.country
        ]
        return ", ".join(filter(None, parts))
