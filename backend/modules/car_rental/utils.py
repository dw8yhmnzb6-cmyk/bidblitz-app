"""
BidBlitz V2 - Car Rental Utilities
Helper functions for the car rental module.
"""

from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any


def calculate_rental_days(start_date: str, end_date: str) -> int:
    """Calculate number of rental days."""
    start = datetime.fromisoformat(start_date.replace("Z", "+00:00"))
    end = datetime.fromisoformat(end_date.replace("Z", "+00:00"))
    
    days = (end - start).days
    return max(1, days)


def format_currency(amount: float, currency: str = "EUR") -> str:
    """Format amount as currency string."""
    if currency == "EUR":
        return f"€{amount:,.2f}"
    return f"{amount:,.2f} {currency}"


def format_date(date_str: str, format_type: str = "short") -> str:
    """Format ISO date string for display."""
    dt = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
    
    if format_type == "short":
        return dt.strftime("%d.%m.%Y")
    elif format_type == "long":
        return dt.strftime("%d. %B %Y")
    elif format_type == "datetime":
        return dt.strftime("%d.%m.%Y %H:%M")
    
    return date_str


def get_booking_status_label(status: str) -> str:
    """Get German label for booking status."""
    labels = {
        "pending": "Ausstehend",
        "confirmed": "Bestätigt",
        "ready_for_handover": "Bereit zur Übergabe",
        "active": "Aktiv",
        "completed": "Abgeschlossen",
        "cancelled": "Storniert",
        "rejected": "Abgelehnt",
        "no_show": "Nicht erschienen",
    }
    return labels.get(status, status)


def get_car_status_label(status: str) -> str:
    """Get German label for car status."""
    labels = {
        "available": "Verfügbar",
        "reserved": "Reserviert",
        "rented": "Vermietet",
        "maintenance": "Wartung",
        "blocked": "Gesperrt",
        "archived": "Archiviert",
    }
    return labels.get(status, status)


def get_fuel_type_label(fuel_type: str) -> str:
    """Get German label for fuel type."""
    labels = {
        "petrol": "Benzin",
        "diesel": "Diesel",
        "electric": "Elektro",
        "hybrid": "Hybrid",
        "lpg": "Autogas (LPG)",
    }
    return labels.get(fuel_type, fuel_type)


def get_gearbox_label(gearbox: str) -> str:
    """Get German label for gearbox type."""
    labels = {
        "manual": "Schaltgetriebe",
        "automatic": "Automatik",
        "semi_automatic": "Halbautomatik",
    }
    return labels.get(gearbox, gearbox)


def calculate_late_return_hours(expected_return: str, actual_return: str, grace_minutes: int = 30) -> float:
    """Calculate hours of late return."""
    expected = datetime.fromisoformat(expected_return.replace("Z", "+00:00"))
    actual = datetime.fromisoformat(actual_return.replace("Z", "+00:00"))
    
    # Add grace period
    expected_with_grace = expected + timedelta(minutes=grace_minutes)
    
    if actual <= expected_with_grace:
        return 0
    
    late_minutes = (actual - expected_with_grace).total_seconds() / 60
    late_hours = late_minutes / 60
    
    # Round up to next half hour
    return round(late_hours * 2) / 2


def generate_booking_reference() -> str:
    """Generate human-readable booking reference."""
    import secrets
    return f"CR{secrets.token_hex(3).upper()}"


def validate_license_plate(plate: str, country: str = "DE") -> bool:
    """Validate license plate format."""
    if country == "DE":
        # German format: 1-3 letters, 1-2 letters, 1-4 numbers
        import re
        pattern = r'^[A-ZÄÖÜ]{1,3}-[A-Z]{1,2}\s?\d{1,4}$'
        return bool(re.match(pattern, plate.upper()))
    return True


def get_vehicle_category(brand: str, seats: int = 5) -> str:
    """Determine vehicle category based on brand and seats."""
    luxury_brands = ["Mercedes", "BMW", "Audi", "Porsche", "Jaguar", "Lexus", "Tesla"]
    suv_brands = ["Land Rover", "Jeep", "Toyota", "Volvo"]
    
    if seats >= 7:
        return "Van"
    elif brand in luxury_brands:
        return "Luxus"
    elif brand in suv_brands:
        return "SUV"
    elif seats <= 2:
        return "Sport"
    else:
        return "Standard"


def sanitize_phone(phone: str) -> str:
    """Sanitize phone number for consistent storage."""
    import re
    # Remove all non-digit characters except +
    sanitized = re.sub(r'[^\d+]', '', phone)
    
    # Add German country code if missing
    if sanitized.startswith('0'):
        sanitized = '+49' + sanitized[1:]
    
    return sanitized
