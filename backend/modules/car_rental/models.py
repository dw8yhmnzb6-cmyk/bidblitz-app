"""
BidBlitz V2 - Car Rental Models
MongoDB document schemas and enums for the car rental module.
"""

from enum import Enum
from typing import Optional, List, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field
import secrets


# ══════════════════════════════════════════════════════════════════════════════
# ENUMS
# ══════════════════════════════════════════════════════════════════════════════

class VendorStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    SUSPENDED = "suspended"
    REJECTED = "rejected"


class CarStatus(str, Enum):
    AVAILABLE = "available"
    RESERVED = "reserved"
    RENTED = "rented"
    MAINTENANCE = "maintenance"
    BLOCKED = "blocked"
    ARCHIVED = "archived"


class FuelType(str, Enum):
    PETROL = "petrol"
    DIESEL = "diesel"
    ELECTRIC = "electric"
    HYBRID = "hybrid"
    LPG = "lpg"


class GearboxType(str, Enum):
    MANUAL = "manual"
    AUTOMATIC = "automatic"
    SEMI_AUTOMATIC = "semi_automatic"


class BookingStatus(str, Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    READY_FOR_HANDOVER = "ready_for_handover"
    ACTIVE = "active"  # Vehicle handed over
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    REJECTED = "rejected"
    NO_SHOW = "no_show"


class PaymentStatus(str, Enum):
    PENDING = "pending"
    PAID = "paid"
    PARTIALLY_PAID = "partially_paid"
    REFUNDED = "refunded"
    FAILED = "failed"


class InvoiceStatus(str, Enum):
    DRAFT = "draft"
    ISSUED = "issued"
    PAID = "paid"
    OVERDUE = "overdue"
    CANCELLED = "cancelled"
    REFUNDED = "refunded"


class DamageSeverity(str, Enum):
    MINOR = "minor"
    MODERATE = "moderate"
    SEVERE = "severe"


class StaffRole(str, Enum):
    MANAGER = "manager"
    EMPLOYEE = "employee"
    VIEWER = "viewer"


# ══════════════════════════════════════════════════════════════════════════════
# ID GENERATORS
# ══════════════════════════════════════════════════════════════════════════════

def generate_vendor_id() -> str:
    return f"VND-{secrets.token_hex(6).upper()}"


def generate_car_id() -> str:
    return f"CAR-{secrets.token_hex(6).upper()}"


def generate_booking_id() -> str:
    return f"BK-{secrets.token_hex(8).upper()}"


def generate_invoice_id() -> str:
    return f"INV-{secrets.token_hex(6).upper()}"


def generate_contract_id() -> str:
    return f"CTR-{secrets.token_hex(6).upper()}"


def generate_damage_id() -> str:
    return f"DMG-{secrets.token_hex(6).upper()}"


def generate_payout_id() -> str:
    return f"PO-{secrets.token_hex(6).upper()}"


def generate_review_id() -> str:
    return f"REV-{secrets.token_hex(6).upper()}"


# ══════════════════════════════════════════════════════════════════════════════
# DOCUMENT MODELS
# ══════════════════════════════════════════════════════════════════════════════

class VendorCompanyInfo(BaseModel):
    """Vendor company/business information for invoices."""
    company_name: str
    legal_name: Optional[str] = None
    tax_id: Optional[str] = None
    vat_id: Optional[str] = None
    registration_number: Optional[str] = None
    address: str
    city: str
    postal_code: str
    country: str = "DE"
    phone: str
    email: str
    website: Optional[str] = None
    bank_name: Optional[str] = None
    iban: Optional[str] = None
    bic: Optional[str] = None


class VendorSettings(BaseModel):
    """Vendor-specific settings."""
    auto_approve_bookings: bool = False
    min_booking_hours: int = 4
    max_booking_days: int = 30
    cancellation_hours: int = 24
    cancellation_fee_percent: float = 20.0
    late_return_fee_per_hour: float = 15.0
    cleaning_fee: float = 50.0
    fuel_fee_per_liter: float = 2.50
    allow_one_way_rental: bool = False
    require_deposit: bool = True
    require_documents: bool = True
    accept_cash: bool = False
    accept_card: bool = True
    accept_wallet: bool = True


class CarExtra(BaseModel):
    """Optional extras for car rental."""
    extra_id: str = Field(default_factory=lambda: secrets.token_hex(4))
    name: str
    description: Optional[str] = None
    price_per_day: float
    price_per_rental: Optional[float] = None
    is_active: bool = True


class CarLocation(BaseModel):
    """Car pickup/return location."""
    address: str
    city: str
    postal_code: str
    country: str = "DE"
    lat: Optional[float] = None
    lng: Optional[float] = None
    instructions: Optional[str] = None


class CarInsurance(BaseModel):
    """Car insurance information."""
    provider: str
    policy_number: str
    coverage_type: str
    deductible: float
    expires_at: str


class HandoverRecord(BaseModel):
    """Vehicle handover/return record."""
    mileage: int
    fuel_level: int  # 0-100 percent
    photos: List[str] = []
    existing_damages: List[str] = []
    accessories_checklist: Dict[str, bool] = {}
    notes: Optional[str] = None
    signature_customer: Optional[str] = None
    signature_staff: Optional[str] = None
    recorded_by: str
    recorded_at: str


class InvoiceLineItem(BaseModel):
    """Single line item in an invoice."""
    description: str
    quantity: float = 1.0
    unit_price: float
    total: float
    tax_rate: float = 19.0
    tax_amount: float


class CustomerDocument(BaseModel):
    """Customer uploaded document."""
    doc_type: str  # license, id_card, passport, etc.
    file_url: str
    verified: bool = False
    verified_by: Optional[str] = None
    verified_at: Optional[str] = None
    expires_at: Optional[str] = None
